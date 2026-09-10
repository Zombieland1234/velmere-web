import { NextResponse } from "next/server";
import { buildVlmAdvancedOnlyPolicySummary } from "@/lib/commerce/vlm-advanced-only-access-policy";
import { compareVlmTierDifferentiation } from "@/lib/ai/vlm-tier-differentiation";
import type { VlmLocale } from "@/lib/ai/vlm-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLocale = searchParams.get("locale");
  const locale: VlmLocale = rawLocale === "pl" || rawLocale === "de" || rawLocale === "en" ? rawLocale : "en";
  return NextResponse.json({
    ok: true,
    ...buildVlmAdvancedOnlyPolicySummary(locale),
    pass2174: {
      tierDifferentiation: compareVlmTierDifferentiation(locale),
      proof: "Basic is a limited prescreen pending final browser proof; Pro is invitation-only beta with mandatory manual QA and no public checkout; Advanced is not for sale.",
    },
    generatedAt: new Date().toISOString(),
  }, { headers: { "cache-control": "no-store" } });
}
