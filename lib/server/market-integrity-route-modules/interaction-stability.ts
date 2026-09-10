import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { getPersistentRiskHistory } from "@/lib/market-integrity/risk-ledger";
import { buildTerminalInteractionStability } from "@/lib/market-integrity/terminal-interaction-stability";

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
    const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
    const history = await getPersistentRiskHistory(id, 72);
    const console = buildTerminalInteractionStability(result, {
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      historyCount: history.length,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      activeCommand: searchParams.get("command") ?? "stability",
      terminalBootDeferred: true,
      modalChunkSplit: true,
      heavyPanelsDeferred: true,
      modalErrorBoundary: true,
      focusedPanelRouting: true,
      sourceCooldownActive: false,
      searchLocalFirst: true,
      suggestionDismissOnOutsideClick: true,
      shieldMapDetached: true,
      tableWheelUnlocked: true,
      stressScenarioHelpers: true,
      noRawJsonButtons: true,
    });

    return NextResponse.json({
      mode: "computed",
      publication: { scope: "runtime_configuration", liveMarketClaimed: false },
      terminalInteractionStability: console,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/interaction-stability", code: "interaction_stability_failed", status: 502 });
  }
}
