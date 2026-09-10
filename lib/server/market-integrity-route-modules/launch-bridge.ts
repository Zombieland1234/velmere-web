import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { getPersistentRiskHistory } from "@/lib/market-integrity/risk-ledger";
import { buildTerminalLaunchBridge } from "@/lib/market-integrity/terminal-launch-bridge";
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
      terminalLaunchBridge: buildTerminalLaunchBridge(result, {
        candlesCount: result.chart?.sevenDay?.length ?? 0,
        chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
        hasOrderBook: false,
        historyCount: history.length,
        activeCommand: searchParams.get("command") ?? "launch",
        sessionMode: "operator_session",
        terminalBootDeferred: true,
        modalChunkSplit: true,
        shieldMapDetached: true,
        tableWheelUnlocked: true,
        searchResolverGuarded: true,
        suggestionDismissOnOutsideClick: true,
        sourceHonestyVisible: true,
      }),
      generatedAt,
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/market-integrity/launch-bridge",
      code: "launch_bridge_failed",
      status: 502,
    });
  }
}
