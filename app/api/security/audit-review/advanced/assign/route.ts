import { applyApiRateLimit, securityJson } from "@/lib/security/api-guard";
import { getAuditCaseForInternalUse } from "@/lib/security/audit-intake-case-vault";
import { assignAdvancedAuditReviewer, PASS4616_AUDIT_REVIEW_ORCHESTRATION_BOUNDARY, PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID } from "@/lib/security/audit-review-orchestration";
import {
  verifySecurityAdminMutationAssertionAfterToken,
  verifySecurityAdminToken,
} from "@/lib/security/security-admin-auth";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requiredScopes = ["security:console"] as const;
  const rate = await applyApiRateLimit(request, { keyPrefix: "pass4616-advanced-reviewer-assign", limit: 20, windowMs: 60_000 });
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
  const reviewerPrincipal = typeof body.reviewerPrincipal === "string" ? body.reviewerPrincipal.trim() : mutation.operator.id;
  const assignmentRequestId = typeof body.assignmentRequestId === "string"
    ? body.assignmentRequestId.trim()
    : request.headers.get("x-request-id")?.trim() ?? "";
  const slaMinutes = Number(body.slaMinutes ?? 1440);
  if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(caseRef)) return securityJson({ ok: false, error: "invalid_case_ref" }, { status: 400 });
  if (!/^[a-zA-Z0-9@._:+-]{3,160}$/.test(reviewerPrincipal)) return securityJson({ ok: false, error: "invalid_reviewer_principal" }, { status: 400 });
  if (assignmentRequestId && !/^[a-zA-Z0-9:_-]{1,160}$/.test(assignmentRequestId)) return securityJson({ ok: false, error: "invalid_assignment_request_id" }, { status: 400 });
  if (!Number.isInteger(slaMinutes) || slaMinutes < 15 || slaMinutes > 10_080) {
    return securityJson({ ok: false, error: "invalid_sla_minutes", acceptedRange: [15, 10_080] }, { status: 400 });
  }
  const lookup = await getAuditCaseForInternalUse(caseRef);
  if (!lookup.ok || !lookup.record) return securityJson({ ok: false, error: "case_not_found" }, { status: 404 });
  const result = await assignAdvancedAuditReviewer({
    record: lookup.record,
    reviewerPrincipal,
    assignmentRequestId,
    slaMinutes,
  });
  return securityJson({ ok: result.ok, result, boundary: PASS4616_AUDIT_REVIEW_ORCHESTRATION_BOUNDARY }, {
    status: result.ok ? 200 : result.error === "review_orchestration_unavailable" ? 503 : 409,
    headers: { "cache-control": "no-store", "x-velmere-pass4616-review-orchestration": PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID },
  });
}
