import { NextResponse } from "next/server";
import { checkRateLimit, guardrailHeaders, noStoreHeaders } from "@/lib/market-integrity/api-guardrails";
import { buildCustomerReadiness } from "@/lib/market-integrity/customer-readiness";

function durablePersistenceConfigured() {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
      (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
  );
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, "market-integrity");
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const payload = buildCustomerReadiness({
    vercelEnvironment: process.env.VERCEL_ENV,
    durablePersistenceConfigured: durablePersistenceConfigured(),
  });

  return NextResponse.json(payload, {
    status: 503,
    headers: noStoreHeaders({
      ...guardrailHeaders(rateLimit),
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "x-velmere-readiness-contract": payload.contractVersion,
    }),
  });
}
