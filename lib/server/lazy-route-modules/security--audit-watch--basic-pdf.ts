import { NextResponse } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import { getAuditCaseForOwningAccount } from "@/lib/security/audit-intake-case-vault";
import { getAuditReviewCustomerProjection } from "@/lib/security/audit-review-orchestration";
import { readAuditBasicReportForOwner } from "@/lib/security/audit-basic-report-store";
import { validateExactSearchParams } from "@/lib/security/exact-request-boundary";
import { buildExactCustomerPdfDelivery } from "@/lib/reporting/exact-customer-pdf-delivery";

function noStoreJson(body: unknown, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff", ...extra },
  });
}

function cleanCaseRef(value: string | null) {
  const normalized = (value ?? "").trim().toUpperCase();
  return /^AUD-[A-Z0-9]{8,16}$/.test(normalized) ? normalized : "";
}

function cleanReportId(value: string | null) {
  const normalized = (value ?? "").trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,119}$/.test(normalized) ? normalized : "";
}

async function handleBasicAuditPdfGet(request: Request) {
  const account = await resolveRequestAccount(request);
  if (!account) return noStoreJson({ ok: false, error: "account_session_required" }, 401);
  const url = new URL(request.url);
  const exact = validateExactSearchParams(url, ["caseRef", "reportId", "reportVersionHash", "disposition"]);
  if (!exact.ok) return exact.response;
  const caseRef = cleanCaseRef(exact.values.caseRef);
  const reportId = exact.values.reportId ? cleanReportId(exact.values.reportId) : "";
  const reportVersionHash = (exact.values.reportVersionHash ?? "").trim().toLowerCase();
  const disposition = exact.values.disposition === "preview" ? "inline" as const : exact.values.disposition === "download" || exact.values.disposition === null ? "attachment" as const : null;
  if (!caseRef || (exact.values.reportId && !reportId)
    || (reportVersionHash && !/^sha256:[a-f0-9]{64}$/.test(reportVersionHash)) || !disposition) {
    return noStoreJson({ ok: false, error: "audit_basic_pdf_binding_invalid" }, 400);
  }
  const owned = await getAuditCaseForOwningAccount({ caseRef, accountId: account.accountId });
  if (!owned.ok || !owned.record) return noStoreJson({ ok: false, error: "audit_case_not_found" }, 404);
  const record = owned.record;
  if (record.tier !== "basic" || record.status !== "queued_basic_prescreen"
    || record.entitlementRequired || record.entitlementVerified || record.entitlementId) {
    return noStoreJson({ ok: false, error: "audit_basic_case_binding_invalid" }, 409);
  }
  const review = await getAuditReviewCustomerProjection(record);
  if (!review.available) return noStoreJson({ ok: false, error: "review_orchestration_unavailable" }, 503, { "retry-after": "15" });
  if (review.processingMode !== "basic_prescreen" || review.state !== "completed") {
    return noStoreJson({ ok: false, error: "basic_automation_not_completed", reviewState: review.state }, 409);
  }
  const lookup = await readAuditBasicReportForOwner({ caseRef, accountId: account.accountId, reportId: reportId || null });
  if (!lookup.ok) return noStoreJson({ ok: false, error: lookup.error, retryable: lookup.retryable }, lookup.retryable ? 503 : 409);
  const report = lookup.record;
  if (reportVersionHash && reportVersionHash !== report.reportVersionHash) return noStoreJson({ ok: false, error: "audit_basic_pdf_version_mismatch" }, 409);
  if (report.snapshot.customerEligibility?.commercialUseReady !== true
    || report.snapshot.auditExecutionRelease?.expectedTier !== "basic") {
    return noStoreJson({ ok: false, error: "audit_basic_pdf_release_binding_invalid" }, 409);
  }
  const delivery = buildExactCustomerPdfDelivery({
    pdfBytes: report.pdfBytes,
    expectedPdfSha256: report.pdfDigest,
    disposition,
    filenameStem: `${report.requestId}-velmere-basic-audit`,
    fallbackStem: "velmere-basic-audit",
  });
  if (delivery.byteLength !== report.pdfByteLength) return noStoreJson({ ok: false, error: "audit_basic_pdf_stored_length_mismatch" }, 409);
  return new NextResponse(delivery.bytes, {
    headers: {
      ...delivery.headers,
      "cache-control": "private, no-store, max-age=0",
      "content-security-policy": "sandbox",
      "cross-origin-resource-policy": "same-origin",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "x-velmere-audit-pdf-tier": "basic",
      "x-velmere-audit-pdf-digest": report.pdfDigest,
      "x-velmere-audit-snapshot": report.snapshotDigest,
      "x-velmere-audit-pdf-render-contract": report.renderContractId,
      "x-velmere-audit-preview-parity": "same_immutable_blob",
      "x-velmere-audit-pdf-storage": "render-once-immutable-basic-blob",
    },
  });
}

export async function GET(request: Request) {
  return withExpensiveRouteBudget(request, "pro_audit_pdf_get", () => handleBasicAuditPdfGet(request));
}
