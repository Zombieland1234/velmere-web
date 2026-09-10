import { NextResponse } from "next/server";
import { fetchGeckoTerminalPoolOhlcv } from "@/lib/market-integrity/geckoterminal-adapter";
import { buildPass2449ChartOverlayReconciler } from "@/lib/market-integrity/chart-overlay-reconciler";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "geckoterminal-ohlcv", limit: 18, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const network = sanitizeBoundedParam(searchParams.get("network"), { maxLength: 40, fallback: "" });
  const poolAddress = sanitizeBoundedParam(searchParams.get("pool") ?? searchParams.get("poolAddress"), { maxLength: 120, fallback: "" });
  const timeframe = sanitizeBoundedParam(searchParams.get("timeframe"), { maxLength: 12, fallback: "day" });
  const aggregate = Number(searchParams.get("aggregate") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 365);
  const range = sanitizeBoundedParam(searchParams.get("range"), { maxLength: 12, fallback: "2y" });
  const symbol = sanitizeBoundedParam(searchParams.get("symbol"), { maxLength: 24, fallback: "" }).toUpperCase();

  if (!network || !poolAddress) {
    return NextResponse.json<ErrorPayload>(
      { mode: "error", error: "Missing network or pool address. GeckoTerminal OHLCV is pool-specific, so both are required." },
      { status: 400 },
    );
  }

  const geckoTerminal = await fetchGeckoTerminalPoolOhlcv({ network, poolAddress, timeframe, aggregate, limit });
  const pass2449ChartOverlay = buildPass2449ChartOverlayReconciler({
    symbol,
    range,
    pointCount: geckoTerminal.points.length,
    network,
    poolAddress,
  });

  return securityJson({
    mode: geckoTerminal.mode,
    geckoTerminal,
    pass2449ChartOverlay,
    boundary: "This route is a DEX pool overlay, not a replacement for listed-asset market chart, CEX depth, TVL or contract security evidence.",
    rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
    generatedAt: new Date().toISOString(),
  }, geckoTerminal.mode === "degraded" ? { status: 502 } : undefined);
}
