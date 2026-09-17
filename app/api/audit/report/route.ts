import { NextRequest, NextResponse } from "next/server";
import { prepareCustomerReport, CUSTOMER_REPORT_FIELDS, CustomerReportRequestError } from "@/lib/security/customer-report-request";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { validateExactObjectKeys, validateExactSearchParams } from "@/lib/security/exact-request-boundary";
import { assertSameOriginRequest } from "@/lib/security/api-guard";
import { publicApiError } from "@/lib/security/api-error-envelope";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX = 16 * 1024;
const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: {
  "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff",
} });
async function generate(request: NextRequest, input: Record<string, unknown>) {
  const prepared = await prepareCustomerReport(request, input);
  const response = json(200, { ok: true, clientTier: prepared.tier, authorizedMaxTier: prepared.authorizedMaxTier,
    entitlementId: prepared.entitlementId, report: prepared.report });
  await prepared.authorizeDelivery();
  return response;
}
const failure = (error: unknown) => error instanceof CustomerReportRequestError ? json(error.status, { ok: false, error: error.code }) : publicApiError(error, { route: "/api/audit/report", code: "report_unavailable" });
export async function GET(request: NextRequest) {
  try {
    if (Buffer.byteLength(request.url, "utf8") > MAX) return json(413, { ok: false, error: "report_parameter_too_large" });
    const exact = validateExactSearchParams(request.nextUrl, [...CUSTOMER_REPORT_FIELDS, "entitlementId"]);
    if (!exact.ok) return exact.response;
    return await generate(request, Object.fromEntries(Object.entries(exact.values).filter(([key, value]) => key !== "entitlementId" && value !== null)));
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const origin = assertSameOriginRequest(request, { allowMissingOrigin: true }); if (origin) return origin;
    const query = validateExactSearchParams(request.nextUrl, ["entitlementId"]); if (!query.ok) return query.response;
    const body = await readBoundedJsonBody<Record<string, unknown>>(request, MAX, { maxDepth: 2 }); if (!body.ok) return body.response;
    const exact = validateExactObjectKeys(body.value, CUSTOMER_REPORT_FIELDS); if (!exact.ok) return exact.response;
    return await generate(request, body.value);
  } catch (error) { return failure(error); }
}
