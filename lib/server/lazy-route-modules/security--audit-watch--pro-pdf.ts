import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { hashVelmereAccountBinding, resolveRequestAccount } from "@/lib/auth/account-session";
import { verifyVlmPaidSurfaceEntitlementById } from "@/lib/commerce/vlm-paid-surface-guard";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import { getAuditCaseForOwningAccount } from "@/lib/security/audit-intake-case-vault";
import { getAuditReviewCustomerProjection } from "@/lib/security/audit-review-orchestration";
import { readAuditReportSnapshotForDelivery } from "@/lib/security/audit-report-snapshot-store";
import {
  failPass4658AuditPdfDownloadReservation,
  finalizePass4658AuditPdfDownloadToken,
  PASS4658_AUDIT_PDF_TOKEN_LIFECYCLE_ID,
  reservePass4658AuditPdfDownloadToken,
  verifyPass4657AuditPdfDownloadToken,
} from "@/lib/security/audit-pdf-download-token";
import { cleanProAuditPdfInput } from "@/lib/security/pro-audit-pdf/customer-safe-renderer";
import { buildSafeDownloadDisposition } from "@/lib/security/download-response-boundary";
import { buildExactCustomerPdfDelivery } from "@/lib/reporting/exact-customer-pdf-delivery";

const PRO_PDF_RUNTIME_POLICY_ID = "p88-audit-render-once-stored-exact-pdf-download-v1";
const MAX_RESPONSE_HEADER_BYTES = 4096;

function noStoreJson(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...extraHeaders },
  });
}

function buildCompactPdfHeaders(args: {
  requestId: string;
  tokenMode: string;
  tokenAttempt: number;
  pdfByteLength: number;
  tier: "pro" | "advanced";
  snapshotDigest: string;
  pdfDigest: string;
  renderContractId: string;
  parityMode: "same_immutable_blob";
}) {
  const download = buildSafeDownloadDisposition({
    disposition: "attachment",
    filenameStem: `${args.requestId}-velmere-${args.tier}-audit`,
    mediaKind: "pdf",
    fallbackStem: `velmere-${args.tier}-audit`,
  });
  const headers = {
    "content-type": download.contentType,
    "content-length": String(args.pdfByteLength),
    "content-disposition": download.contentDisposition,
    "cache-control": "no-store, private, max-age=0",
    "x-content-type-options": "nosniff",
    "content-security-policy": "sandbox",
    "cross-origin-resource-policy": "same-origin",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "x-velmere-pro-pdf-policy": PRO_PDF_RUNTIME_POLICY_ID,
    "x-velmere-audit-pdf-tier": args.tier,
    "x-velmere-audit-snapshot": args.snapshotDigest,
    "x-velmere-audit-pdf-digest": args.pdfDigest,
    "x-velmere-audit-pdf-render-contract": args.renderContractId,
    "x-velmere-audit-preview-parity": args.parityMode,
    "x-velmere-pro-pdf-token-consumption": args.tokenMode,
    "x-velmere-pro-pdf-token-attempt": String(args.tokenAttempt),
    "x-velmere-customer-runtime": "immutable-exact-stored-bytes",
    "x-velmere-audit-pdf-storage": "render-once-immutable-blob",
  } satisfies Record<string, string>;
  const bytes = Object.entries(headers).reduce((total, [name, value]) => total + Buffer.byteLength(name) + Buffer.byteLength(value) + 4, 0);
  if (bytes > MAX_RESPONSE_HEADER_BYTES) throw new Error("pro_pdf_header_budget_exceeded");
  return headers;
}

async function handleProAuditPdfGet(request: Request) {
  const url = new URL(request.url);
  const requestedRequestId = cleanProAuditPdfInput(url.searchParams.get("requestId"), "", 80);
  const requestedTarget = cleanProAuditPdfInput(url.searchParams.get("target"), "", 600);
  const account = await resolveRequestAccount(request);
  if (!account) return noStoreJson({ ok: false, error: "account_session_required", message: "A signed account session is required to download this report." }, 401);

  const reportId = cleanProAuditPdfInput(url.searchParams.get("reportId") ?? request.headers.get("x-velmere-report-id"), "", 120);
  const auditCaseRef = cleanProAuditPdfInput(url.searchParams.get("auditCaseRef") ?? request.headers.get("x-velmere-audit-case-ref"), "", 160).toUpperCase();
  const entitlementId = cleanProAuditPdfInput(url.searchParams.get("entitlementId") ?? request.headers.get("x-velmere-entitlement-id"), "", 180);
  const suppliedReportVersionHash = cleanProAuditPdfInput(url.searchParams.get("reportVersionHash") ?? request.headers.get("x-velmere-report-version-hash"), "", 160);
  if (!reportId || !auditCaseRef || !entitlementId || !suppliedReportVersionHash) return noStoreJson({ ok: false, error: "pro_pdf_binding_fields_required" }, 400);

  const auditCase = await getAuditCaseForOwningAccount({ caseRef: auditCaseRef, accountId: account.accountId });
  if (!auditCase.ok || !auditCase.record) return noStoreJson({ ok: false, error: "audit_case_not_found_or_not_owned" }, 404);
  const auditCaseRecord = auditCase.record;
  const expectedCaseTier = auditCaseRecord.tier === "advanced" ? "advanced" : auditCaseRecord.tier === "pro" ? "pro" : null;
  if (!expectedCaseTier) return noStoreJson({ ok: false, error: "paid_audit_tier_required" }, 409);

  const entitlementVerdict = await verifyVlmPaidSurfaceEntitlementById({
    policyId: "audit_pdf_download",
    entitlementId,
    allowedProductIds: ["vlm_pro_audit_review", "vlm_advanced_audit_human_review"],
    accountIdHash: hashVelmereAccountBinding(account.accountId),
    auditCaseRef,
  });
  if (!entitlementVerdict.ok) return noStoreJson({ ok: false, error: "paid_entitlement_not_verified" }, 402);
  const entitlementTier = entitlementVerdict.entitlement.productId === "vlm_advanced_audit_human_review" ? "advanced" : "pro";
  if (
    entitlementTier !== expectedCaseTier
    || !auditCaseRecord.entitlementVerified
    || auditCaseRecord.status !== "queued_paid_review"
    || auditCaseRecord.entitlementId !== entitlementId
  ) return noStoreJson({ ok: false, error: "audit_case_entitlement_binding_invalid" }, 409);

  const snapshotLookup = await readAuditReportSnapshotForDelivery({
    caseRef: auditCaseRef,
    accountId: account.accountId,
    entitlementId,
    tier: expectedCaseTier,
    reportId,
  });
  if (!snapshotLookup.ok) return noStoreJson({ ok: false, error: snapshotLookup.error, retryable: snapshotLookup.retryable }, snapshotLookup.retryable ? 503 : 409);
  const report = snapshotLookup.record;
  const paidEvidenceReady = expectedCaseTier === "advanced" ? report.snapshot.evidenceReadiness.advancedReady : report.snapshot.evidenceReadiness.proReady;
  if (!paidEvidenceReady) return noStoreJson({ ok: false, error: "paid_audit_evidence_not_ready", reasons: report.snapshot.evidenceReadiness.reasons }, 409);
  if (suppliedReportVersionHash !== report.reportVersionHash) return noStoreJson({ ok: false, error: "audit_pdf_report_version_mismatch" }, 409);
  if ((requestedRequestId && requestedRequestId !== report.requestId) || (requestedTarget && requestedTarget !== report.snapshot.target)) {
    return noStoreJson({ ok: false, error: "audit_case_report_binding_mismatch" }, 409);
  }

  const review = await getAuditReviewCustomerProjection(auditCaseRecord);
  if (!review.available) return noStoreJson({ ok: false, error: "review_orchestration_unavailable" }, 503);
  const expectedProcessingMode = expectedCaseTier === "advanced" ? "advanced_automation" : "pro_automation";
  if (review.processingMode !== expectedProcessingMode) return noStoreJson({ ok: false, error: "audit_automation_processing_mode_mismatch" }, 409);
  if (review.state !== "completed") return noStoreJson({ ok: false, error: `${expectedCaseTier}_automation_not_completed`, reviewState: review.state }, 409);

  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const downloadToken = cleanProAuditPdfInput(request.headers.get("x-velmere-download-token") ?? request.headers.get("x-velmere-pro-pdf-token") ?? bearerToken, "", 16 * 1024);
  if (!downloadToken) return noStoreJson({ ok: false, error: "audit_pdf_token_required" }, 401);

  const tokenVerdict = verifyPass4657AuditPdfDownloadToken({
    token: downloadToken,
    accountId: account.accountId,
    entitlementId,
    expectedReportId: report.reportId,
    expectedReportVersionHash: report.reportVersionHash,
  });
  if (!tokenVerdict.ok) return noStoreJson({ ok: false, error: tokenVerdict.error }, tokenVerdict.error === "audit_pdf_token_expired" ? 423 : 401);

  const tokenReservation = await reservePass4658AuditPdfDownloadToken({
    tokenHash: tokenVerdict.tokenHash,
    payload: tokenVerdict.payload,
    accountId: account.accountId,
    entitlementId,
    reservationSeconds: 180,
  });
  if (!tokenReservation.ok) {
    const status = tokenReservation.error === "audit_pdf_token_in_progress" || tokenReservation.error === "audit_pdf_token_replayed" ? 409 : tokenReservation.error === "audit_pdf_token_expired" ? 423 : 503;
    return noStoreJson({ ok: false, error: tokenReservation.error }, status, {
      "retry-after": status === 503 ? "15" : tokenReservation.error === "audit_pdf_token_in_progress" ? "5" : "0",
      "x-velmere-audit-pdf-token-lifecycle": PASS4658_AUDIT_PDF_TOKEN_LIFECYCLE_ID,
    });
  }

  try {
    const delivery = buildExactCustomerPdfDelivery({
      pdfBytes: report.pdfBytes,
      expectedPdfSha256: report.pdfDigest,
      disposition: "attachment",
      filenameStem: `${report.requestId}-velmere-${expectedCaseTier}-audit`,
      fallbackStem: `velmere-${expectedCaseTier}-audit`,
    });
    if (delivery.byteLength !== report.pdfByteLength) throw new Error("audit_pdf_stored_length_mismatch");

    const tokenFinalization = await finalizePass4658AuditPdfDownloadToken({ tokenHash: tokenVerdict.tokenHash, reservationId: tokenReservation.reservationId });
    if (!tokenFinalization.ok) {
      return noStoreJson({ ok: false, error: tokenFinalization.error, message: "The secure download could not be committed." }, tokenFinalization.error === "audit_pdf_token_replayed" ? 409 : 503, { "retry-after": "15" });
    }

    return new NextResponse(delivery.bytes, {
      headers: buildCompactPdfHeaders({
        requestId: report.requestId,
        tokenMode: tokenFinalization.mode,
        tokenAttempt: tokenReservation.attemptCount,
        pdfByteLength: report.pdfByteLength,
        tier: expectedCaseTier,
        snapshotDigest: report.snapshotDigest,
        pdfDigest: report.pdfDigest,
        renderContractId: report.renderContractId,
        parityMode: "same_immutable_blob",
      }),
    });
  } catch (error) {
    await failPass4658AuditPdfDownloadReservation({ tokenHash: tokenVerdict.tokenHash, reservationId: tokenReservation.reservationId, failureCode: "pdf_delivery_failed" });
    return publicApiError(error, {
      route: "/api/security/audit-watch/pro-pdf",
      code: "pro_pdf_exact_blob_delivery_failed",
      status: 503,
      headers: { "retry-after": "15" },
    });
  }
}

export async function GET(request: Request) {
  return withExpensiveRouteBudget(request, "pro_audit_pdf_get", () => handleProAuditPdfGet(request));
}
