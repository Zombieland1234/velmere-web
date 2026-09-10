import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildHolderIntelligence } from "@/lib/market-integrity/holder-intelligence";
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
    const holderIntelligence = buildHolderIntelligence(result);

    return NextResponse.json({
      mode: publication.mode,
      publication,
      result,
      holderIntelligence,
      legalNote: "Holder intelligence is a risk signal only. It is not proof and not an accusation.",
      generatedAt,
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/holders", code: "holder_intelligence_generation_failed", status: 502 });
  }
}
