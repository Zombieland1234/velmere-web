import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { verifyAdminSessionRequest } from "@/lib/admin/session-roles";
import { appendAdminAuditLog } from "@/lib/admin/audit-log";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
} from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import {
  readFulfilmentOutboxDeadLetterSummary,
  recoverFulfilmentOutboxDeadLetter,
} from "@/lib/orders/fulfilment-outbox-recovery";
import { hasApiErrorCodePrefix, publicApiError } from "@/lib/security/api-error-envelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fingerprint(actorId: string) {
  return `operator_${createHash("sha256").update(actorId).digest("hex").slice(0, 20)}`;
}

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

export async function GET(request: Request) {
  const admin = verifyAdminSessionRequest(request, "fulfilment:incident");
  if (!admin.ok) return admin.response;
  try {
    const summary = await readFulfilmentOutboxDeadLetterSummary();
    return json({
      ok: true,
      summary,
      privacyBoundary: "Aggregate counts and age only; no event, order, evidence or provider identifiers are returned.",
    });
  } catch {
    return json({ ok: false, retryable: true, error: "fulfilment_outbox_summary_unavailable" }, 503);
  }
}

export async function POST(request: Request) {
  const size = rejectLargeContentLength(request, 8 * 1024);
  if (size) return size;
  const origin = assertSameOriginRequest(request, { allowMissingOrigin: false });
  if (origin) return origin;
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "fulfilment-outbox-dead-letter-recovery",
    limit: 6,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;
  const admin = verifyAdminSessionRequest(request, "fulfilment:retry");
  if (!admin.ok) return admin.response;
  const body = await readBoundedJsonBody<{
    eventId?: string;
    action?: "requeue" | "discard";
    requestId?: string;
    reasonCode?: string;
    evidenceReference?: string;
  }>(request, 8 * 1024, { maxDepth: 2 });
  if (!body.ok) return body.response;

  try {
    const result = await recoverFulfilmentOutboxDeadLetter({
      eventId: body.value.eventId ?? "",
      action: body.value.action ?? "requeue",
      requestId: body.value.requestId ?? "",
      reasonCode: body.value.reasonCode ?? "",
      evidenceReference: body.value.evidenceReference ?? "",
      operatorFingerprint: fingerprint(admin.session.actorId),
    });
    const audit = await appendAdminAuditLog({
      actorId: admin.session.actorId,
      actorRole: admin.session.role,
      action: "incident_outbox_recovery",
      targetType: "fulfilment_incident_outbox",
      targetId: "redacted_outbox_event",
      payload: {
        action: result.action,
        status: result.status,
        evidenceProvided: true,
      },
    });
    const status = result.status === "not_found" ? 404 : result.status === "conflict" ? 409 : 200;
    return json({
      ok: status === 200,
      result,
      audit,
      privacyBoundary: "Event ID, request ID, operator fingerprint and evidence reference are never echoed.",
    }, status);
  } catch (error) {
    const invalid = hasApiErrorCodePrefix(error, ["fulfilment_outbox_recovery_invalid_"]);
    return publicApiError(error, {
      route: "/api/admin/orders/fulfilment-outbox-dead-letter",
      code: invalid ? "fulfilment_outbox_recovery_invalid_request" : "fulfilment_outbox_recovery_unavailable",
      status: invalid ? 400 : 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}
