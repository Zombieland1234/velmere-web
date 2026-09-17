import { NextRequest, NextResponse } from "next/server";
import { prepareCustomerReport, CUSTOMER_REPORT_FIELDS, CustomerReportRequestError } from "@/lib/security/customer-report-request";
import { validateExactSearchParams } from "@/lib/security/exact-request-boundary";
import { publicApiError } from "@/lib/security/api-error-envelope";
import { renderCanonicalReportToPdf } from "@/lib/security/audit-canonical-report";
import { buildExactCustomerPdfDelivery } from "@/lib/reporting/exact-customer-pdf-delivery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: {
  "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff",
} });
export async function GET(request: NextRequest) {
  try {
    if (Buffer.byteLength(request.url, "utf8") > 16 * 1024) return json(413, { ok: false, error: "report_parameter_too_large" });
    const exact = validateExactSearchParams(request.nextUrl, [...CUSTOMER_REPORT_FIELDS, "entitlementId", "disposition"]);
    if (!exact.ok) return exact.response;
    if (exact.values.disposition && !["preview", "attachment"].includes(exact.values.disposition)) return json(400, { ok: false, error: "invalid_report_disposition" });
    const input = Object.fromEntries(Object.entries(exact.values).filter(([key, value]) => !["entitlementId", "disposition"].includes(key) && value !== null));
    const prepared = await prepareCustomerReport(request, input);
    const { report, tier } = prepared;
    if (report.runtimeAnalysis?.status === "ANALYSIS_UNAVAILABLE") {
      await prepared.authorizeDelivery();
      return json(503, { ok: false, error: "runtime_analysis_unavailable", analysis: report.runtimeAnalysis });
    }
    const { pdfBytes, pdfDigest } = renderCanonicalReportToPdf(report);
    const delivery = buildExactCustomerPdfDelivery({ pdfBytes, expectedPdfSha256: pdfDigest,
      disposition: exact.values.disposition === "preview" ? "inline" : "attachment",
      filenameStem: `${report.target.contractName.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}-${tier}-audit`, fallbackStem: `velmere-${tier}-audit`,
    });
    await prepared.authorizeDelivery();
    return new NextResponse(delivery.bytes as BodyInit, { status: 200, headers: {
      ...delivery.headers, "cache-control": "private, no-store, max-age=0", "content-security-policy": "sandbox",
      "cross-origin-resource-policy": "same-origin", "x-frame-options": "DENY", "referrer-policy": "no-referrer",
      "x-velmere-audit-pdf-tier": tier, "x-velmere-audit-source-mode": report.executionEvidence?.sourceMode ?? "insufficient-evidence",
      "x-velmere-audit-pdf-digest": pdfDigest, "x-velmere-audit-report-digest": report.reportDigest,
      "x-velmere-analysis-status": report.runtimeAnalysis?.status ?? "ANALYSIS_UNAVAILABLE",
      "x-velmere-preview-download-parity": "canonical_shared_model",
    } });
  } catch (error) {
    return error instanceof CustomerReportRequestError ? (error.response ?? json(error.status, { ok: false, error: error.code })) : publicApiError(error, { route: "/api/audit/report-pdf", code: "report_pdf_unavailable" });
  }
}
