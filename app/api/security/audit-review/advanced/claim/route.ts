import { randomBytes } from "node:crypto";
import { applyApiRateLimit, securityJson } from "@/lib/security/api-guard";
import { getAuditCaseForInternalUse } from "@/lib/security/audit-intake-case-vault";
import { claimAdvancedAuditWorkerLease, PASS4616_AUDIT_REVIEW_ORCHESTRATION_BOUNDARY, PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID } from "@/lib/security/audit-review-orchestration";
import {
  verifySecurityAdminMutationAssertionAfterToken,
  verifySecurityAdminToken,
} from "@/lib/security/security-admin-auth";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requiredScopes = ["security:console"] as const;
  const rate = await applyApiRateLimit(request, { keyPrefix: "p75-advanced-worker-claim", limit: 30, windowMs: 60_000 });
  if (!rate.ok) return rate.response;
  const adminToken = verifySecurityAdminToken(request, [...requiredScopes], undefined, {
    deferBodyBoundMutationAssertion: true,
  });
  if (!adminToken.ok) return adminToken.response;

  const parsedBody = await readBoundedJsonBody<Record<string, unknown>>(request, 8192, { maxDepth: 8 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  const mutation = await verifySecurityAdminMutationAssertionAfterToken({
    request,
    requiredScopes: [...requiredScopes],
    operatorRequirement: { role: "security_admin", requirePhishingResistantMfa: true },
    requestBody: body,
  });
  if (!mutation.ok) return mutation.response;
  const caseRef = typeof body.caseRef === "string" ? body.caseRef.trim() : "";
  if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(caseRef)) {
    return securityJson({ ok: false, error: "invalid_case_ref" }, { status: 400 });
  }
  const workerPrincipal = typeof body.workerPrincipal === "string" ? body.workerPrincipal.trim() : mutation.operator.id;
  if (!/^[a-zA-Z0-9@._:+-]{3,160}$/.test(workerPrincipal)) {
    return securityJson({ ok: false, error: "invalid_worker_principal" }, { status: 400 });
  }
  const claimRequestId = typeof body.claimRequestId === "string"
    ? body.claimRequestId.trim()
    : request.headers.get("x-request-id")?.trim() ?? "";
  if (claimRequestId && !/^[a-zA-Z0-9:_-]{1,160}$/.test(claimRequestId)) {
    return securityJson({ ok: false, error: "invalid_claim_request_id" }, { status: 400 });
  }
  const requestedLeaseSeconds = Number(body.leaseSeconds ?? 300);
  if (!Number.isInteger(requestedLeaseSeconds) || requestedLeaseSeconds < 30 || requestedLeaseSeconds > 900) {
    return securityJson({ ok: false, error: "invalid_lease_seconds", acceptedRange: [30, 900] }, { status: 400 });
  }
  const lookup = await getAuditCaseForInternalUse(caseRef);
  if (!lookup.ok || !lookup.record) return securityJson({ ok: false, error: "case_not_found" }, { status: 404 });
  const leaseToken = randomBytes(32).toString("base64url");
  const result = await claimAdvancedAuditWorkerLease({
    record: lookup.record,
    workerPrincipal,
    claimRequestId,
    leaseToken,
    leaseSeconds: requestedLeaseSeconds,
  });
  return securityJson({
    ok: result.ok,
    result,
    leaseToken: result.ok ? leaseToken : undefined,
    leaseTokenBoundary: "Returned once to the authenticated worker; only SHA-256 is persisted.",
    boundary: PASS4616_AUDIT_REVIEW_ORCHESTRATION_BOUNDARY,
  }, {
    status: result.ok ? 200 : result.error === "review_orchestration_unavailable" ? 503 : 409,
    headers: { "cache-control": "no-store", "x-velmere-pass4616-review-orchestration": PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID },
  });
}
