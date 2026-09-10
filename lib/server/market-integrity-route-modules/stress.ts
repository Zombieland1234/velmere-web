import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildStressScenarios } from "@/lib/market-integrity/stress-simulator";
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
    const stress = buildStressScenarios(result);
    return NextResponse.json({ mode: publication.mode, publication, stress, generatedAt });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/stress", code: "stress_simulation_failed", status: 502 });
  }
}
