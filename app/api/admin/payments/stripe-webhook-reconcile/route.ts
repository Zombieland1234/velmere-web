import { NextResponse } from "next/server";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
} from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { verifyAdminSessionRequest } from "@/lib/admin/session-roles";
import {
  buildStripeWebhookReconciliationReadiness,
  reconcileStripeWebhookEffects,
} from "@/lib/payments/stripe-webhook-reconciler";
import { isStripeWebhookReconciliationRouteOk } from "@/lib/payments/stripe-webhook-reconciliation-policy";
import {
  buildPaymentOperatorAssertionReadiness,
  executePaymentOperatorAction,
  PaymentOperatorAuthorizationError,
} from "@/lib/payments/payment-operator-assertions";
import { publicApiError } from "@/lib/security/api-error-envelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_PATH = "/api/admin/payments/stripe-webhook-reconcile";
const ALLOWED_BODY_KEYS = new Set(["staleAfterSeconds", "retryThreshold", "limit", "deadlineMs"]);

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function exactBodyKeys(body: Record<string, unknown>) {
  const unknown = Object.keys(body).filter((key) => !ALLOWED_BODY_KEYS.has(key));
  return unknown.length ? response({ ok: false, error: "payment_reconciliation_unknown_fields", fields: unknown.sort() }, 400) : null;
}

export async function GET(req: Request) {
  const admin = verifyAdminSessionRequest(req, "payment:reconcile");
  if (!admin.ok) return admin.response;
  return response({
    ok: true,
    readiness: buildStripeWebhookReconciliationReadiness(),
    operatorAssertion: buildPaymentOperatorAssertionReadiness(),
    actorRole: admin.session.role,
  });
}

export async function POST(req: Request) {
  const sizeGuard = rejectLargeContentLength(req, 16 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(req, { allowMissingOrigin: false });
  if (originGuard) return originGuard;
  const rate = await applyApiRateLimit(req, {
    keyPrefix: "admin-stripe-webhook-reconcile",
    limit: 6,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;
  const admin = verifyAdminSessionRequest(req, "payment:reconcile");
  if (!admin.ok) return admin.response;

  const parsed = await readBoundedJsonBody<Record<string, unknown>>(req, 16 * 1024, {
    maxDepth: 4,
    requireObject: true,
    rejectDuplicateKeys: true,
    rejectDangerousKeys: true,
  });
  if (!parsed.ok) return parsed.response;
  const keyGuard = exactBodyKeys(parsed.value);
  if (keyGuard) return keyGuard;

  try {
    const execution = await executePaymentOperatorAction({
      session: admin.session,
      scope: "payment:reconcile",
      method: "POST",
      path: ROUTE_PATH,
      rawBody: parsed.raw,
      assertionToken: req.headers.get("x-velmere-payment-operator-assertion"),
      execute: async () => reconcileStripeWebhookEffects({
        staleAfterSeconds: parsed.value.staleAfterSeconds as number | undefined,
        retryThreshold: parsed.value.retryThreshold as number | undefined,
        limit: parsed.value.limit as number | undefined,
        deadlineMs: parsed.value.deadlineMs as number | undefined,
        emitAlert: true,
      }),
    });
    return response({
      ok: isStripeWebhookReconciliationRouteOk(execution.result),
      summary: execution.result,
      authorization: {
        scope: execution.authorization.scope,
        actionDigest: execution.authorization.actionDigest,
        primaryAssertionIdHash: execution.authorization.primaryAssertionIdHash,
        bodyBound: true,
        singleUseConsumed: execution.consumption.consumed,
        independentApprovalRequired: false,
      },
      privacyBoundary:
        "Aggregate operational counts and hashed authorization receipts only. No Stripe event IDs, effect keys, assertion tokens, session IDs, payloads, customer data or provider bodies are returned.",
    });
  } catch (error) {
    if (error instanceof PaymentOperatorAuthorizationError) {
      return response({ ok: false, error: error.code }, error.status);
    }
    return publicApiError(error, {
      route: ROUTE_PATH,
      code: "stripe_webhook_reconciliation_failed",
      status: 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}
