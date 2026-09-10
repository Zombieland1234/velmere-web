import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { getPersistentRiskHistory } from "@/lib/market-integrity/risk-ledger";
import { buildTerminalUsabilityGuard } from "@/lib/market-integrity/terminal-usability-guard";
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
    const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
    const history = await getPersistentRiskHistory(id, 72);
    const guard = buildTerminalUsabilityGuard(result, {
      historyCount: history.length,
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      activeCommand: searchParams.get("command") ?? "usability",
      sessionMode: "operator_session",
      searchHasIconSubmit: true,
      searchHasEmptyPlaceholder: true,
      shieldMapDetached: true,
      modalErrorBoundary: true,
      sortToggleEnabled: true,
      mobileBottomSheet: true,
    });

    return NextResponse.json({
      mode: publication.mode,
      publication,
      guard,
      historyCount: history.length,
      generatedAt,
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/usability-guard", code: "usability_guard_failed", status: 502 });
  }
}
