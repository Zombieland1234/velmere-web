import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildPass2460MacroChartIntegrityGate } from "@/lib/market-integrity/macro-chart-integrity-gate";
import { buildPass2461MacroGapReceipt } from "@/lib/market-integrity/macro-gap-receipt";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "macro-chart-integrity", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  const range = sanitizeBoundedParam(searchParams.get("range"), { maxLength: 12, fallback: "2y" });
  const pointCountParam = Number(searchParams.get("points") ?? "0");
  const pointCount = Number.isFinite(pointCountParam) && pointCountParam > 0 ? Math.floor(pointCountParam) : undefined;
  if (!query) return securityJson({ mode: "error", error: "Missing query" } satisfies ErrorPayload, { status: 400 });

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama });
    const macroChartIntegrityGate = buildPass2460MacroChartIntegrityGate({
      query,
      symbol: sourceSync.symbol,
      requestedRange: range,
      pointCount: pointCount ?? sourceSync.pass2449?.windowContract.actualPoints ?? result?.chart?.sevenDay?.length ?? 0,
      sourceSync,
      chartOverlay: sourceSync.pass2449,
      sourceFreshness: sourceSync.pass2459,
      payloadFingerprint: sourceSync.pass2453?.canonicalEvidenceFingerprint,
    });
    const macroGapReceipt = buildPass2461MacroGapReceipt({
      query,
      symbol: sourceSync.symbol,
      requestedRange: range,
      pointCount: pointCount ?? macroChartIntegrityGate.activeRangeGate.observedPointCount,
      sourceSync,
      chartOverlay: sourceSync.pass2449,
      macroGate: macroChartIntegrityGate,
      payloadFingerprint: macroChartIntegrityGate.macroChartFingerprint,
    });

    return securityJson({
      mode: "macro_chart_integrity_gate",
      query,
      range,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      macroChartIntegrityGate,
      macroGapReceipt,
      activeRangeGate: macroChartIntegrityGate.activeRangeGate,
      rangeGates: macroChartIntegrityGate.rangeGates,
      surfaceContracts: macroChartIntegrityGate.surfaceContracts,
      macroLocks: macroChartIntegrityGate.macroLocks,
      secondOverlayPolicy: macroChartIntegrityGate.secondOverlayPolicy,
      sourceFreshnessDriftSentinel: sourceSync.pass2459,
      chartOverlayReconciler: sourceSync.pass2449,
      providerCloseoutRuntime: sourceSync.pass2458,
      operatorActionQueue: sourceSync.pass2457,
      reportEvidenceCapsule: sourceSync.pass2453,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/macro-chart-integrity", code: "macro_chart_integrity_request_failed", status: 502 });
  }
}
