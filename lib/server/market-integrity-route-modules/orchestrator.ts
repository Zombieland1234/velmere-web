import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { getPersistentRiskHistory } from "@/lib/market-integrity/risk-ledger";
import { buildAiRiskOrchestrator } from "@/lib/market-integrity/ai-orchestrator";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400 });
  }

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const generatedAt = new Date().toISOString();
    const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
    const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
    const history = await getPersistentRiskHistory(id, 144);
    const orchestrator = buildAiRiskOrchestrator(result, history);

    return NextResponse.json({
      mode: publication.mode,
      publication,
      orchestrator,
      result,
      generatedAt,
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/orchestrator", code: "ai_orchestrator_request_failed", status: 502 });
  }
}
