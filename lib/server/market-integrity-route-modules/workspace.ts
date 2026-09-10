import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { getPersistentRiskHistory } from "@/lib/market-integrity/risk-ledger";
import { buildTerminalRiskWorkspace } from "@/lib/market-integrity/terminal-risk-workspace";
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
    const history = await getPersistentRiskHistory(id, 144);
    const workspace = buildTerminalRiskWorkspace(result, {
      historyCount: history.length,
      candlesCount: result.chart?.sevenDay?.length ?? marketRow?.sparkline7d?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "risk-result sparkline" : marketRow?.sparkline7d?.length ? "market-row sparkline" : "metric fallback",
      hasOrderBook: false,
      chatEnabled: true,
      accessLayerVisible: true,
      activeCommand: searchParams.get("command") ?? "workspace",
      sessionMode: "operator_session",
    });

    return NextResponse.json({
      mode: publication.mode,
      publication,
      query,
      token: result.token,
      workspace,
      legalNote: "PASS63 workspace is operator triage only. Not financial advice. Algorithmic risk flag only. Not legal proof or an accusation.",
      generatedAt,
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/workspace", code: "terminal_risk_workspace_generation_failed", status: 502 });
  }
}
