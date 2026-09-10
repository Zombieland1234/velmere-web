import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildTerminalPerformanceGuard } from "@/lib/market-integrity/terminal-performance-guard";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() || "BTC";

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? (await analyzeDexScreenerToken(query));
    const generatedAt = new Date().toISOString();
    const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
    return NextResponse.json({
      mode: publication.mode,
      publication,
      performanceGuard: buildTerminalPerformanceGuard(result, {
        terminalBootDeferred: true,
        modalChunkSplit: true,
        orderBookDeferred: true,
        historyDeferred: true,
        heavyPanelsDeferred: true,
        shieldMapDetached: true,
        tableWheelUnlocked: true,
      }),
      generatedAt,
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/market-integrity/performance-guard",
      code: "performance_guard_failed",
      status: 502,
    });
  }
}
