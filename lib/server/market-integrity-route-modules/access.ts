import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildVlmShieldAccess } from "@/lib/market-integrity/vlm-access-layer";
import { buildVlmAdvancedOnlyPolicySummary } from "@/lib/commerce/vlm-advanced-only-access-policy";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  if (!query) return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400 });

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const generatedAt = new Date().toISOString();
    const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
    const access = buildVlmShieldAccess(result);
    return NextResponse.json({
      mode: "computed",
      publication,
      query,
      token: result.token,
      access,
      advancedOnlyAccessPolicy: buildVlmAdvancedOnlyPolicySummary(searchParams.get("locale") || "en"),
      legalNote: "VLM Basic remains a limited prescreen pending final browser proof. Pro is invitation-only beta with mandatory manual QA and no public checkout. Advanced is not for sale. This endpoint is not investment advice, a sale offer, or a market-performance claim.",
      generatedAt,
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/market-integrity/access",
      code: "access_layer_generation_failed",
      status: 502,
    });
  }
}
