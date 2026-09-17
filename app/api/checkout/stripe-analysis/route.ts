import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Legacy sessions lack account/readiness bindings. Payment status alone is not an entitlement. */
function retiredCheckout() {
  return NextResponse.json({ ok: false, error: "legacy_checkout_retired",
    checkoutRoute: "/api/checkout/vlm-service", verificationRoute: "/api/checkout/vlm-service/verify",
    paid: false, retryable: false,
  }, { status: 410, headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
export function POST() { return retiredCheckout(); }
export function GET() { return retiredCheckout(); }
