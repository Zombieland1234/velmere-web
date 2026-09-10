import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildPass2462HistoricalBackfillOrchestrator } from "@/lib/market-integrity/historical-backfill-orchestrator";
import { buildPass2463HistoricalRangeWindowLedger } from "@/lib/market-integrity/historical-range-window-ledger";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "historical-backfill", limit: 24, windowMs: 60_000 });
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
    const historicalBackfillOrchestrator = sourceSync.pass2462 ?? buildPass2462HistoricalBackfillOrchestrator({
      query,
      symbol: sourceSync.symbol,
      requestedRange: range,
      pointCount: pointCount ?? sourceSync.pass2461?.observedPointCount ?? sourceSync.pass2460?.activeRangeGate.observedPointCount ?? result?.chart?.sevenDay?.length ?? 0,
      sourceSync,
      chartOverlay: sourceSync.pass2449,
      macroGapReceipt: sourceSync.pass2461,
      payloadFingerprint: sourceSync.pass2461?.gapReceiptFingerprint ?? sourceSync.pass2453?.canonicalEvidenceFingerprint,
    });
    const historicalRangeWindowLedger = buildPass2463HistoricalRangeWindowLedger({
      query,
      symbol: sourceSync.symbol,
      requestedRange: range,
      pointCount: pointCount ?? historicalBackfillOrchestrator.observedPointCount,
      sourceSync,
      historicalBackfill: historicalBackfillOrchestrator,
      payloadFingerprint: historicalBackfillOrchestrator.backfillFingerprint,
    });

    return securityJson({
      mode: "historical_backfill_orchestrator",
      query,
      range,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      historicalBackfillOrchestrator,
      historicalRangeWindowLedger,
      rangePlan: historicalBackfillOrchestrator.rangePlan,
      backfillJobs: historicalBackfillOrchestrator.backfillJobs,
      surfaceBackfillContracts: historicalBackfillOrchestrator.surfaceBackfillContracts,
      pdfBackfillReceipt: historicalBackfillOrchestrator.pdfBackfillReceipt,
      hardLocks: historicalBackfillOrchestrator.hardLocks,
      rangeWindowFingerprint: historicalRangeWindowLedger.rangeWindowFingerprint,
      normalizedWindow: historicalRangeWindowLedger.normalizedWindow,
      endpointWindows: historicalRangeWindowLedger.endpointWindows,
      cacheContract: historicalRangeWindowLedger.cacheContract,
      macroGapReceipt: sourceSync.pass2461,
      macroChartIntegrityGate: sourceSync.pass2460,
      sourceFreshnessDriftSentinel: sourceSync.pass2459,
      providerCloseoutRuntime: sourceSync.pass2458,
      chartOverlayReconciler: sourceSync.pass2449,
      reportEvidenceCapsule: sourceSync.pass2453,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/historical-backfill", code: "historical_backfill_request_failed", status: 502 });
  }
}
