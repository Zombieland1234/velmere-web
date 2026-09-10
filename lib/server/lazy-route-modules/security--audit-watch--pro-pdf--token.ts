import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../../security/ascii-control-characters";

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { resolveVlmPaidSurfaceAccess, toVlmPaidSurfacePaymentRequiredPayload } from "@/lib/commerce/vlm-paid-surface-guard";
import { readPublicMutationJsonBody } from "@/lib/security/mutation-request-boundary";
import {
  issuePass4657AuditPdfDownloadToken,
  PASS4657_AUDIT_PDF_DOWNLOAD_TOKEN_ID,
} from "@/lib/security/audit-pdf-download-token";
import { getAuditCaseForOwningAccount } from "@/lib/security/audit-intake-case-vault";
import { getAuditReviewCustomerProjection } from "@/lib/security/audit-review-orchestration";
import { readAuditReportSnapshotForDelivery } from "@/lib/security/audit-report-snapshot-store";
import { buildAuditCanonicalPreview } from "@/lib/security/audit-canonical-preview";

type IssueBody = {
  reportId?: unknown;
  auditCaseRef?: unknown;
  requestId?: unknown;
  target?: unknown;
  chain?: unknown;
  locale?: unknown;
};

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/[^a-zA-Z0-9:._-]+/g, "-").slice(0, max) : "";
}

function cleanAuditTarget(value: unknown) {
  return typeof value === "string" ? value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, "").trim().slice(0, 600) : "";
}

export async function POST(request: Request) {
  const account = await resolveRequestAccount(request);
  if (!account) return NextResponse.json({ ok: false, error: "account_session_required" }, { status: 401, headers: { "cache-control": "no-store" } });

  const parsed = await readPublicMutationJsonBody<IssueBody>(request, {
    keyPrefix: "pass4806-pro-pdf-token-issue",
    maxBytes: 16 * 1024,
    maxDepth: 6,
    rateLimit: 8,
    windowMs: 60_000,
    maxUrlLength: 2_048,
  });
  if (!parsed.ok) return parsed.response;
  const locale = parsed.value.locale === "pl" || parsed.value.locale === "de" ? parsed.value.locale : "en";
  const requestedReportId = clean(parsed.value.reportId, 120);
  const auditCaseRef = clean(parsed.value.auditCaseRef, 160).toUpperCase();
  const requestedRequestId = clean(parsed.value.requestId, 120);
  const requestedTarget = cleanAuditTarget(parsed.value.target);
  const requestedChain = clean(parsed.value.chain, 48);
  if (!auditCaseRef) return NextResponse.json({ ok: false, error: "audit_case_ref_required" }, { status: 400, headers: { "cache-control": "no-store" } });

  const auditCase = await getAuditCaseForOwningAccount({ caseRef: auditCaseRef, accountId: account.accountId });
  if (!auditCase.ok || !auditCase.record) return NextResponse.json({ ok: false, error: "audit_case_not_found_or_not_owned" }, { status: 404, headers: { "cache-control": "no-store" } });
  const record = auditCase.record;
  const expectedTier = record.tier === "advanced" ? "advanced" : record.tier === "pro" ? "pro" : null;
  if (!expectedTier) return NextResponse.json({ ok: false, error: "paid_audit_tier_required" }, { status: 409, headers: { "cache-control": "no-store" } });

  const access = await resolveVlmPaidSurfaceAccess({
    policyId: "audit_pdf_issue",
    request,
    depth: expectedTier,
    locale,
    auditCaseRef,
    requestId: record.requestId,
    returnPath: null,
  });
  if (!access.ok) return NextResponse.json(toVlmPaidSurfacePaymentRequiredPayload(access), { status: 402, headers: { ...access.headers, "cache-control": "no-store" } });
  if (access.reason !== "paid_entitlement_verified") return NextResponse.json({ ok: false, error: "durable_paid_entitlement_required" }, { status: 402, headers: { "cache-control": "no-store" } });
  const entitlementId = access.entitlement.entitlement?.id;
  if (!entitlementId || access.entitlement.ledgerMode !== "durable") return NextResponse.json({ ok: false, error: "durable_paid_entitlement_required" }, { status: 402, headers: { "cache-control": "no-store" } });

  if (record.entitlementId !== entitlementId || !record.entitlementVerified || record.status !== "queued_paid_review") {
    return NextResponse.json({ ok: false, error: "audit_case_report_binding_mismatch" }, { status: 409, headers: { "cache-control": "no-store" } });
  }

  const snapshotLookup = await readAuditReportSnapshotForDelivery({
    caseRef: auditCaseRef,
    accountId: account.accountId,
    entitlementId,
    tier: expectedTier,
    reportId: requestedReportId || null,
  });
  if (!snapshotLookup.ok) {
    return NextResponse.json({ ok: false, error: snapshotLookup.error, retryable: snapshotLookup.retryable }, { status: snapshotLookup.retryable ? 503 : 409, headers: { "cache-control": "no-store" } });
  }
  const report = snapshotLookup.record;
  const paidEvidenceReady = expectedTier === "advanced" ? report.snapshot.evidenceReadiness.advancedReady : report.snapshot.evidenceReadiness.proReady;
  if (!paidEvidenceReady) {
    return NextResponse.json({
      ok: false,
      error: "paid_audit_evidence_not_ready",
      reasons: report.snapshot.evidenceReadiness.reasons,
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (
    (requestedRequestId && requestedRequestId !== report.requestId)
    || (requestedTarget && requestedTarget !== report.snapshot.target)
    || (requestedChain && requestedChain !== report.snapshot.chain)
  ) {
    return NextResponse.json({ ok: false, error: "audit_case_snapshot_binding_mismatch" }, { status: 409, headers: { "cache-control": "no-store" } });
  }

  const review = await getAuditReviewCustomerProjection(record);
  if (!review.available) return NextResponse.json({ ok: false, error: "review_orchestration_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  const expectedProcessingMode = expectedTier === "advanced" ? "advanced_automation" : "pro_automation";
  if (review.processingMode !== expectedProcessingMode) return NextResponse.json({ ok: false, error: "audit_automation_processing_mode_mismatch" }, { status: 409, headers: { "cache-control": "no-store" } });
  if (review.state !== "completed") return NextResponse.json({ ok: false, error: `${expectedTier}_automation_not_completed`, reviewState: review.state }, { status: 409, headers: { "cache-control": "no-store" } });

  const issued = issuePass4657AuditPdfDownloadToken({
    accountId: account.accountId,
    entitlementId,
    reportId: report.reportId,
    reportVersionHash: report.reportVersionHash,
    nonce: randomBytes(24).toString("base64url"),
  });
  if (!issued.ok) return NextResponse.json({ ok: false, error: issued.error }, { status: 503, headers: { "cache-control": "no-store" } });

  const canonicalPreview = buildAuditCanonicalPreview(report.snapshot);

  return NextResponse.json({
    ok: true,
    token: issued.token,
    entitlementId,
    reportId: report.reportId,
    reportVersionHash: report.reportVersionHash,
    expiresAt: issued.expiresAt,
    downloadPath: `/api/security/audit-watch/pro-pdf?reportId=${encodeURIComponent(report.reportId)}&auditCaseRef=${encodeURIComponent(auditCaseRef)}&entitlementId=${encodeURIComponent(entitlementId)}&reportVersionHash=${encodeURIComponent(report.reportVersionHash)}`,
    reportBinding: {
      auditCaseRef,
      requestId: report.requestId,
      targetHash: report.targetHash,
      tier: report.tier,
      snapshotDigest: report.snapshotDigest,
      sourceReceiptRoot: report.sourceReceiptRoot,
      pdfDigest: report.pdfDigest,
      pdfByteLength: report.pdfByteLength,
      renderContractId: report.renderContractId,
      exactPdfStorage: "render_once_immutable_blob",
      strictQuorumMet: report.snapshot.providerTruth.strictQuorumMet,
      independentUpstreamRoots: report.snapshot.providerTruth.independentUpstreamRoots,
      paidEvidenceReady,
      evidenceRoots: report.snapshot.evidenceRoots,
      layoutDigest: report.snapshot.layout.layoutDigest,
      storageMode: report.storageMode,
    },
    canonicalPreview,
    authorization: { mode: "bearer_header", header: "Authorization", scheme: "Bearer", queryTokenAllowed: false },
    security: PASS4657_AUDIT_PDF_DOWNLOAD_TOKEN_ID,
  }, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
}
