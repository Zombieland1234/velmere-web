import { publicApiError } from "@/lib/security/api-error-envelope";
import { applyApiRateLimit, securityJson } from "@/lib/security/api-guard";
import { getAuditCaseForInternalUse } from "@/lib/security/audit-intake-case-vault";
import {
  PASS4616_AUDIT_REVIEW_ORCHESTRATION_BOUNDARY,
  PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID,
  executeAfterBasicAuditWorkerLeasePreflight,
  normalizeBasicAuditWorkerLeaseToken,
  settleBasicAuditWorkerLease,
} from "@/lib/security/audit-review-orchestration";
import {
  verifySecurityAdminMutationAssertionAfterToken,
  verifySecurityAdminToken,
} from "@/lib/security/security-admin-auth";
import { buildProAuditPdfSnapshotArtifact } from "@/lib/security/pro-audit-pdf/render-pro-audit-pdf";
import { completeBasicAuditWorkerLeaseWithExactPdf } from "@/lib/security/audit-basic-report-store";
import {
  buildAuditExecutionPacketReleaseGate,
  buildAuditExecutionReleaseSnapshotBinding,
  type AuditExecutionPacket,
  type AuditExecutionReleaseGateResult,
} from "@/lib/security/audit-execution-packet-release-gate";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import {
  publishCompletedAuditToPrivateVerify,
  type AuditVerifyInitialPublicationResult,
} from "@/lib/server/audit-verify-initial-publication-bridge";

export async function POST(request: Request) {
  const requiredScopes = ["security:console"] as const;
  const rate = await applyApiRateLimit(request, { keyPrefix: "audit-basic-worker-settle", limit: 40, windowMs: 60_000 });
  if (!rate.ok) return rate.response;
  const adminToken = verifySecurityAdminToken(request, [...requiredScopes], undefined, {
    deferBodyBoundMutationAssertion: true,
  });
  if (!adminToken.ok) return adminToken.response;
  const parsedBody = await readBoundedJsonBody<Record<string, unknown>>(request, 128 * 1024, { maxDepth: 16 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  const mutation = await verifySecurityAdminMutationAssertionAfterToken({
    request,
    requiredScopes: [...requiredScopes],
    operatorRequirement: { role: "security_admin", requirePhishingResistantMfa: true },
    requestBody: body,
  });
  if (!mutation.ok) return mutation.response;
  const outcome = body.outcome === "complete" || body.outcome === "retry" || body.outcome === "dead_letter" ? body.outcome : null;
  if (!outcome) return securityJson({ ok: false, error: "invalid_outcome" }, { status: 400 });
  const caseRef = typeof body.caseRef === "string" ? body.caseRef.trim() : "";
  const workerPrincipal = typeof body.workerPrincipal === "string" ? body.workerPrincipal.trim() : mutation.operator.id;
  const leaseToken = normalizeBasicAuditWorkerLeaseToken(body.leaseToken);
  const reasonCode = typeof body.reasonCode === "string" ? body.reasonCode.trim() : "worker_result";
  if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(caseRef)) return securityJson({ ok: false, error: "invalid_case_ref" }, { status: 400 });
  if (!/^[a-zA-Z0-9@._:+-]{3,160}$/.test(workerPrincipal)) return securityJson({ ok: false, error: "invalid_worker_principal" }, { status: 400 });
  if (!leaseToken) return securityJson({ ok: false, error: "invalid_lease_token" }, { status: 400 });
  if (!/^[a-zA-Z0-9:._-]{1,96}$/.test(reasonCode)) return securityJson({ ok: false, error: "invalid_reason_code" }, { status: 400 });
  const lookup = await getAuditCaseForInternalUse(caseRef);
  if (!lookup.ok || !lookup.record) return securityJson({ ok: false, error: "case_not_found" }, { status: 404 });
  const record = lookup.record;
  let reportBinding: Record<string, unknown> | null = null;
  let auditExecutionRelease: AuditExecutionReleaseGateResult | null = null;
  let atomicCompletionResult: { ok: true; caseRef: string; state: "completed"; attemptCount: number } | null = null;
  let verifyPublication: AuditVerifyInitialPublicationResult | null = null;

  if (outcome === "complete") {
    if (record.tier !== "basic" || !record.accountId || record.entitlementRequired
      || record.entitlementVerified || record.entitlementId || record.status !== "queued_basic_prescreen") {
      return securityJson({ ok: false, error: "basic_report_case_binding_invalid" }, { status: 409 });
    }
    auditExecutionRelease = buildAuditExecutionPacketReleaseGate({
      packet: body.executionPacket,
      record,
      expectedTier: "basic",
    });
    if (!auditExecutionRelease.completionAllowed || !auditExecutionRelease.persistAllowed) {
      return securityJson({ ok: false, error: "audit_execution_packet_withheld", auditExecutionRelease }, { status: 409 });
    }
    const executionPacket = body.executionPacket as AuditExecutionPacket;
    const executionReleaseBinding = buildAuditExecutionReleaseSnapshotBinding(auditExecutionRelease);
    const reportIdInput = typeof body.reportId === "string" ? body.reportId.trim() : "";
    const reportId = (reportIdInput || `${record.caseRef.toLowerCase()}-basic-v1`).replace(/[^a-zA-Z0-9:._-]+/g, "-").slice(0, 120);
    const chain = executionPacket.currentDeployment.receipt.target.chainName;
    const locale = body.locale === "pl" || body.locale === "de" || body.locale === "en" ? body.locale : record.locale;
    try {
      const protectedBuild = await executeAfterBasicAuditWorkerLeasePreflight({
        record,
        workerPrincipal,
        leaseToken,
        execute: () => buildProAuditPdfSnapshotArtifact({
          requestId: record.requestId,
          target: record.target.canonicalTarget,
          chain,
          locale,
          tier: "basic",
          sourceCandidates: record.sourceCandidates,
          executionReleaseBinding,
        }),
      });
      if (!protectedBuild.ok) {
        const preflight = protectedBuild.preflight;
        return securityJson({ ok: false, error: preflight.error, staleLease: preflight.staleLease }, {
          status: preflight.error === "review_orchestration_unavailable" ? 503 : 409,
        });
      }
      const { snapshot, pdfBytes } = protectedBuild.value;
      if (snapshot.auditExecutionRelease?.releaseBindingDigest !== auditExecutionRelease.releaseBindingDigest) {
        throw new Error("audit_execution_release_snapshot_binding_mismatch");
      }
      if (snapshot.customerEligibility?.commercialUseReady !== true) {
        const retryResult = await settleBasicAuditWorkerLease({
          record,
          workerPrincipal,
          leaseToken,
          outcome: "retry",
          reasonCode: "rights_currentness_not_met",
        });
        return securityJson({
          ok: false,
          error: "basic_customer_evidence_not_ready",
          retryScheduled: retryResult.ok,
          result: retryResult,
          customerEligibility: snapshot.customerEligibility ?? null,
        }, { status: retryResult.ok ? 409 : retryResult.error === "review_orchestration_unavailable" ? 503 : 409 });
      }
      const completed = await completeBasicAuditWorkerLeaseWithExactPdf({
        reportId,
        record,
        snapshot,
        pdfBytes,
        workerPrincipal,
        leaseToken,
        reasonCode,
      });
      if (!completed.ok) {
        return securityJson({ ok: false, error: completed.error, retryable: completed.retryable, staleLease: completed.staleLease }, { status: completed.retryable ? 503 : 409 });
      }
      reportBinding = {
        reportId: completed.record.reportId,
        reportVersionHash: completed.record.reportVersionHash,
        snapshotDigest: completed.record.snapshotDigest,
        sourceReceiptRoot: completed.record.sourceReceiptRoot,
        pdfDigest: completed.record.pdfDigest,
        pdfByteLength: completed.record.pdfByteLength,
        renderContractId: completed.record.renderContractId,
        exactPdfStorage: "render_once_immutable_basic_blob",
        storageMode: completed.record.storageMode,
        atomicCompletion: record.durable,
        idempotent: completed.idempotent,
        auditExecutionPacketDigest: auditExecutionRelease.packetDigest,
        currentDeploymentReceiptDigest: auditExecutionRelease.currentDeploymentReceiptDigest,
        matchedInputDigest: auditExecutionRelease.matchedInputDigest,
        auditExecutionReleaseBindingDigest: auditExecutionRelease.releaseBindingDigest,
      };
      atomicCompletionResult = { ok: true, caseRef: record.caseRef, state: "completed", attemptCount: completed.attemptCount };
      verifyPublication = await publishCompletedAuditToPrivateVerify(record.caseRef);
    } catch (error) {
      return publicApiError(error, {
        route: "/api/security/audit-review/basic/settle",
        code: "basic_report_snapshot_build_failed",
        status: 503,
      });
    }
  }

  const result = atomicCompletionResult ?? await settleBasicAuditWorkerLease({
    record,
    workerPrincipal,
    leaseToken,
    outcome,
    reasonCode,
  });
  return securityJson({ ok: result.ok, result, reportBinding, auditExecutionRelease, verifyPublication, boundary: PASS4616_AUDIT_REVIEW_ORCHESTRATION_BOUNDARY }, {
    status: result.ok ? 200 : result.error === "review_orchestration_unavailable" ? 503 : 409,
    headers: { "cache-control": "no-store", "x-velmere-pass4616-review-orchestration": PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID },
  });
}
