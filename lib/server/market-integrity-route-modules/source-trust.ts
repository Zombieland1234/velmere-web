import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { getPersistentRiskHistory } from "@/lib/market-integrity/risk-ledger";
import { buildTerminalSourceTrust } from "@/lib/market-integrity/terminal-source-trust";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() || "BTC";

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? (await analyzeDexScreenerToken(query));
    const generatedAt = new Date().toISOString();
    const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
    const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
    const history = await getPersistentRiskHistory(id, 144);

    return NextResponse.json({
      mode: publication.mode,
      publication,
      terminalSourceTrust: buildTerminalSourceTrust(result, {
        candlesCount: result.chart?.sevenDay?.length ?? 0,
        chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
        hasOrderBook: false,
        historyCount: history.length,
        activeCommand: searchParams.get("command") ?? "sources",
        searchResolverGuarded: true,
        suggestionDismissOnOutsideClick: true,
        sourceCooldownActive: false,
        terminalBootDeferred: true,
        modalChunkSplit: true,
        tableWheelUnlocked: true,
        walletSessionReady: false,
        exportInfrastructureReady: false,
        rateLimitMiddlewareReady: false,
      }),
      generatedAt,
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/market-integrity/source-trust",
      code: "source_trust_failed",
      status: 502,
    });
  }
}
