import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function unverifiedExport() {
  return NextResponse.json({ ok: false, error: "verified_stored_report_required",
    artifactRoute: "/api/account/customer-artifact", retryable: false,
  }, { status: 409, headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
/** Client-supplied prices, risk and confidence are not verified provider observations. */
export function GET() { return unverifiedExport(); }
export function POST() { return unverifiedExport(); }
