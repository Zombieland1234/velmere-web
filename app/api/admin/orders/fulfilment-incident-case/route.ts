import { createHash } from "node:crypto";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { NextResponse } from "next/server";
import {
  applyApiRateLimit as applyPass2177SoftRateLimit,
  assertSameOriginRequest as assertPass2177SameOriginRequest,
  rejectLargeContentLength as rejectPass2177LargeContentLength,
} from "@/lib/security/api-guard";
import { verifyAdminSessionRequest } from "@/lib/admin/session-roles";
import { appendAdminAuditLog } from "@/lib/admin/audit-log";
import { upsertFulfilmentIncidentCase } from "@/lib/orders/fulfilment-incident-case-store";
import {
  buildFulfilmentIncidentResolutionReadiness,
  resolveFulfilmentIncidentCase,
} from "@/lib/orders/fulfilment-incident-resolution";
import { applyWriteApiRateLimit } from "@/lib/security/write-api-rate-limit";
import { hasApiErrorCodePrefix, publicApiError } from "@/lib/security/api-error-envelope";

export const runtime = "nodejs";

function operatorFingerprint(actorId: string) {
  return `operator_${createHash("sha256").update(actorId).digest("hex").slice(0, 20)}`;
}

export async function POST(req: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(req, 256 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(req, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(req, {
    keyPrefix: "pass2177-admin-orders-fulfilment-incident-case",
    limit: 24,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const rate = await applyWriteApiRateLimit(req, "fulfilment_incident");
  if (!rate.ok) return rate.response;
  const admin = verifyAdminSessionRequest(req, "fulfilment:incident");
  if (!admin.ok) return admin.response;
  const parsedBody = await readBoundedJsonBody<Record<string, unknown>>(req, 256 * 1024, { maxDepth: 16 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;

  if (body.action === "resolve") {
    if (
      typeof body.caseId !== "string" ||
      typeof body.resolution !== "string" ||
      typeof body.requestId !== "string"
    ) {
      return NextResponse.json(
        { error: "caseId, resolution and requestId are required." },
        { status: 400 },
      );
    }
    try {
      const result = await resolveFulfilmentIncidentCase({
        caseId: body.caseId,
        resolution: body.resolution,
        requestId: body.requestId,
        operatorFingerprint: operatorFingerprint(admin.session.actorId),
        evidence: body.evidence,
      });
      const audit = await appendAdminAuditLog({
        actorId: admin.session.actorId,
        actorRole: admin.session.role,
        action: "incident_case_resolve",
        targetType: "fulfilment_incident",
        targetId: result.caseId,
        payload: {
          status: result.status,
          resolution: result.resolution,
          outboxEventId: result.outboxEventId,
          evidenceKeys: Object.keys(result.evidence),
        },
      });
      return NextResponse.json(
        { result, audit },
        { status: result.status === "conflict" ? 409 : result.status === "not_found" ? 404 : 200 },
      );
    } catch (error) {
      const invalid = hasApiErrorCodePrefix(error, [
        "fulfilment_incident_resolution_invalid_",
        "fulfilment_incident_resolution_missing_",
      ]);
      return publicApiError(error, {
        route: "/api/admin/orders/fulfilment-incident-case",
        code: invalid ? "fulfilment_incident_resolution_invalid_request" : "fulfilment_incident_resolution_unavailable",
        status: invalid ? 400 : 503,
        headers: invalid ? undefined : { "retry-after": "10" },
      });
    }
  }

  if (typeof body.incidentType !== "string") {
    return NextResponse.json({ error: "incidentType is required." }, { status: 400 });
  }
  const result = await upsertFulfilmentIncidentCase({
    orderDraftId: typeof body.orderDraftId === "string" ? body.orderDraftId : undefined,
    retryQueueId: typeof body.retryQueueId === "string" ? body.retryQueueId : undefined,
    incidentType: body.incidentType,
    decision: typeof body.decision === "string" ? body.decision : undefined,
    operatorNote: typeof body.operatorNote === "string" ? body.operatorNote : undefined,
    supportPacket: typeof body.supportPacket === "object" && body.supportPacket
      ? body.supportPacket as Record<string, unknown>
      : undefined,
    redactedSnapshot: typeof body.redactedSnapshot === "object" && body.redactedSnapshot
      ? body.redactedSnapshot as Record<string, unknown>
      : undefined,
  });
  const audit = await appendAdminAuditLog({
    actorId: admin.session.actorId,
    actorRole: admin.session.role,
    action: "incident_case_update",
    targetType: "fulfilment_incident",
    targetId: result.snapshot.caseId,
    payload: {
      status: result.snapshot.status,
      severity: result.snapshot.severity,
      incidentType: result.snapshot.incidentType,
    },
  });
  return NextResponse.json({ ...result, audit });
}

export async function GET(req: Request) {
  const admin = verifyAdminSessionRequest(req, "fulfilment:incident");
  if (!admin.ok) return admin.response;
  return NextResponse.json(buildFulfilmentIncidentResolutionReadiness());
}
