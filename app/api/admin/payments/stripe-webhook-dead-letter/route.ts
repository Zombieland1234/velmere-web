import { NextResponse } from "next/server";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
} from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { verifyAdminSessionRequest } from "@/lib/admin/session-roles";
import { requeueStripeWebhookDeadLetter } from "@/lib/payments/stripe-webhook-reconciler";
import {
  executePaymentOperatorAction,
  PaymentOperatorAuthorizationError,
} from "@/lib/payments/payment-operator-assertions";
import { hasApiErrorCodePrefix, publicApiError } from "@/lib/security/api-error-envelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_PATH = "/api/admin/payments/stripe-webhook-dead-letter";
const ALLOWED_BODY_KEYS = new Set(["eventId", "effectKey", "requestId", "reasonCode"]);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function POST(request: Request) {
  const size = rejectLargeContentLength(request, 8 * 1024);
  if (size) return size;
  const origin = assertSameOriginRequest(request, { allowMissingOrigin: false });
  if (origin) return origin;
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "stripe-dead-letter-requeue",
    limit: 4,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;
  const admin = verifyAdminSessionRequest(request, "payment:requeue");
  if (!admin.ok) return admin.response;
  const body = await readBoundedJsonBody<Record<string, unknown>>(request, 8 * 1024, {
    maxDepth: 2,
    requireObject: true,
    rejectDuplicateKeys: true,
    rejectDangerousKeys: true,
  });
  if (!body.ok) return body.response;
  const unknown = Object.keys(body.value).filter((key) => !ALLOWED_BODY_KEYS.has(key));
  if (unknown.length) return json({ ok: false, error: "payment_dead_letter_unknown_fields", fields: unknown.sort() }, 400);

  try {
    const execution = await executePaymentOperatorAction({
      session: admin.session,
      scope: "payment:requeue",
      method: "POST",
      path: ROUTE_PATH,
      rawBody: body.raw,
      assertionToken: request.headers.get("x-velmere-payment-operator-assertion"),
      independentApprovalToken: request.headers.get("x-velmere-payment-independent-approval"),
      execute: async () => requeueStripeWebhookDeadLetter({
        eventId: typeof body.value.eventId === "string" ? body.value.eventId : "",
        effectKey: typeof body.value.effectKey === "string" ? body.value.effectKey : "",
        requestId: typeof body.value.requestId === "string" ? body.value.requestId : "",
        reasonCode: typeof body.value.reasonCode === "string" ? body.value.reasonCode : "",
      }),
    });
    const result = execution.result;
    return json({
      ok: result.status !== "not_found",
      status: result.status,
      durable: true,
      authorization: {
        scope: execution.authorization.scope,
        actionDigest: execution.authorization.actionDigest,
        primaryAssertionIdHash: execution.authorization.primaryAssertionIdHash,
        independentApprovalIdHash: execution.authorization.independentApprovalIdHash,
        bodyBound: true,
        singleUseConsumed: execution.consumption.consumed,
        independentApprovalRequired: true,
      },
      privacyBoundary: "The response never echoes event ID, effect key, request ID, assertion/approval tokens, actor/session IDs, customer data or provider payload.",
    }, result.status === "not_found" ? 404 : 200);
  } catch (error) {
    if (error instanceof PaymentOperatorAuthorizationError) {
      return json({ ok: false, error: error.code }, error.status);
    }
    const invalid = hasApiErrorCodePrefix(error, ["stripe_webhook_requeue_invalid_"]);
    return publicApiError(error, {
      route: ROUTE_PATH,
      code: invalid ? "stripe_webhook_requeue_invalid_request" : "stripe_webhook_requeue_failed",
      status: invalid ? 400 : 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}
