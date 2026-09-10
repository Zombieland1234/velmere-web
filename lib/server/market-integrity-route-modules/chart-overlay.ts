import { publicApiError } from "@/lib/security/api-error-envelope";
import { fetchCoinGeckoMarketChart, type MarketChartRange } from "@/lib/market-integrity/coingecko";
import { buildPass2444ChartQuality } from "@/lib/market-integrity/chart-quality";
import { buildPass2448ChartMethodologyContract } from "@/lib/market-integrity/provider-methodology-registry";
import { buildPass2449ChartOverlayReconciler } from "@/lib/market-integrity/chart-overlay-reconciler";
import { buildPass2450TierEvidenceParity } from "@/lib/market-integrity/tier-evidence-parity";
import { buildPass2451DataProvenanceLedger } from "@/lib/market-integrity/data-provenance-ledger";
import { buildPass2452RiskCalibrationKernel } from "@/lib/market-integrity/risk-calibration-kernel";
import { buildPass2453ReportEvidenceCapsule } from "@/lib/market-integrity/report-evidence-capsule";
import { buildPass2454ChartInstitutionalRouter } from "@/lib/market-integrity/institutional-source-router";
import { buildPass2455ChartUiProofStrip } from "@/lib/market-integrity/ui-proof-strip";
import { buildPass2456RuntimeParityQueue } from "@/lib/market-integrity/runtime-parity-queue";
import { buildPass2457OperatorActionQueue } from "@/lib/market-integrity/operator-action-queue";
import { buildPass2458ProviderCloseoutRuntime } from "@/lib/market-integrity/provider-closeout-runtime";
import { buildPass2459SourceFreshnessDriftSentinel } from "@/lib/market-integrity/source-freshness-drift-sentinel";
import { buildPass2460MacroChartIntegrityGate } from "@/lib/market-integrity/macro-chart-integrity-gate";
import { buildPass2461MacroGapReceipt } from "@/lib/market-integrity/macro-gap-receipt";
import { buildPass2462HistoricalBackfillOrchestrator } from "@/lib/market-integrity/historical-backfill-orchestrator";
import { buildPass2463HistoricalRangeWindowLedger } from "@/lib/market-integrity/historical-range-window-ledger";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

const ranges = new Set(["1m", "15m", "1h", "4h", "1d", "7d", "30d", "90d", "1y", "2y", "5y", "max"]);

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "chart-overlay", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const id = sanitizeBoundedParam(searchParams.get("id"), { maxLength: 80, fallback: "" });
  const symbol = sanitizeBoundedParam(searchParams.get("symbol"), { maxLength: 24, fallback: "" }).toUpperCase();
  const rangeParam = sanitizeBoundedParam(searchParams.get("range"), { maxLength: 12, fallback: "2y" });
  const range = (ranges.has(rangeParam) ? rangeParam : "2y") as MarketChartRange;
  const network = sanitizeBoundedParam(searchParams.get("network"), { maxLength: 40, fallback: "" });
  const poolAddress = sanitizeBoundedParam(searchParams.get("pool") ?? searchParams.get("poolAddress"), { maxLength: 120, fallback: "" });

  if (!id) {
    return securityJson({ mode: "error", error: "Missing coin id" }, { status: 400 });
  }

  try {
    const points = await fetchCoinGeckoMarketChart(id, range);
    const chartQuality = buildPass2444ChartQuality(points, range);
    const chartMethodology = buildPass2448ChartMethodologyContract({
      range,
      pointCount: points.length,
      continuityScore: chartQuality.continuityScore,
      missingForAdvanced: chartQuality.missingForAdvanced,
    });
    const chartOverlay = buildPass2449ChartOverlayReconciler({
      assetId: id,
      symbol,
      range,
      pointCount: points.length,
      chartQuality,
      chartMethodology,
      network,
      poolAddress,
    });
    const tierEvidenceParity = buildPass2450TierEvidenceParity({
      query: id,
      symbol,
      range,
      chartOverlay,
    });
    const dataProvenanceLedger = buildPass2451DataProvenanceLedger({
      query: id,
      symbol,
      chartOverlay,
      tierEvidence: tierEvidenceParity,
    });
    const riskCalibrationKernel = buildPass2452RiskCalibrationKernel({
      query: id,
      symbol,
      chartOverlay,
      tierEvidence: tierEvidenceParity,
      dataProvenance: dataProvenanceLedger,
    });
    const reportEvidenceCapsule = buildPass2453ReportEvidenceCapsule({
      query: id,
      symbol,
      tierEvidence: tierEvidenceParity,
      dataProvenance: dataProvenanceLedger,
      riskCalibration: riskCalibrationKernel,
    });
    const institutionalRouter = buildPass2454ChartInstitutionalRouter({
      id,
      symbol,
      range,
      pointCount: points.length,
      reportEvidence: reportEvidenceCapsule,
      payloadFingerprint: reportEvidenceCapsule.canonicalEvidenceFingerprint,
    });

    const uiProofStrip = buildPass2455ChartUiProofStrip({
      id,
      symbol,
      range,
      pointCount: points.length,
      institutionalRouter,
      reportEvidence: reportEvidenceCapsule,
      payloadFingerprint: reportEvidenceCapsule.canonicalEvidenceFingerprint,
    });
    const runtimeParityQueue = buildPass2456RuntimeParityQueue({
      query: id,
      symbol,
      uiProofStrip,
      reportEvidence: reportEvidenceCapsule,
      payloadFingerprint: reportEvidenceCapsule.canonicalEvidenceFingerprint,
    });
    const operatorActionQueue = buildPass2457OperatorActionQueue({
      query: id,
      symbol,
      runtimeParity: runtimeParityQueue,
      uiProofStrip,
      institutionalRouter,
    });
    const providerCloseoutRuntime = buildPass2458ProviderCloseoutRuntime({
      query: id,
      symbol,
      operatorActionQueue,
    });
    const sourceFreshnessDriftSentinel = buildPass2459SourceFreshnessDriftSentinel({
      query: id,
      symbol,
      range,
      providerCloseoutRuntime,
    });
    const macroChartIntegrityGate = buildPass2460MacroChartIntegrityGate({
      query: id,
      symbol,
      requestedRange: range,
      pointCount: points.length,
      chartOverlay,
      sourceFreshness: sourceFreshnessDriftSentinel,
      payloadFingerprint: reportEvidenceCapsule.canonicalEvidenceFingerprint,
    });
    const macroGapReceipt = buildPass2461MacroGapReceipt({
      query: id,
      symbol,
      requestedRange: range,
      pointCount: points.length,
      chartOverlay,
      macroGate: macroChartIntegrityGate,
      payloadFingerprint: macroChartIntegrityGate.macroChartFingerprint,
    });
    const historicalBackfillOrchestrator = buildPass2462HistoricalBackfillOrchestrator({
      query: id,
      symbol,
      requestedRange: range,
      pointCount: points.length,
      chartOverlay,
      macroGapReceipt,
      payloadFingerprint: macroGapReceipt.gapReceiptFingerprint,
    });
    const historicalRangeWindowLedger = buildPass2463HistoricalRangeWindowLedger({
      query: id,
      symbol,
      requestedRange: range,
      pointCount: points.length,
      historicalBackfill: historicalBackfillOrchestrator,
      payloadFingerprint: historicalBackfillOrchestrator.backfillFingerprint,
    });

    return securityJson({
      mode: "chart_overlay",
      id,
      symbol,
      range,
      pointCount: points.length,
      chartQuality,
      chartMethodology,
      chartOverlay,
      tierEvidenceParity,
      dataProvenanceLedger,
      riskCalibrationKernel,
      reportEvidenceCapsule,
      institutionalRouter,
      uiProofStrip,
      runtimeParityQueue,
      operatorActionQueue,
      providerCloseoutRuntime,
      sourceFreshnessDriftSentinel,
      macroChartIntegrityGate,
      macroGapReceipt,
      historicalBackfillOrchestrator,
      historicalRangeWindowLedger,
      canonicalEvidenceFingerprint: reportEvidenceCapsule.canonicalEvidenceFingerprint,
      pass2454InstitutionalRouterState: institutionalRouter.state,
      pass2454InstitutionalRouterScore: institutionalRouter.score,
      pass2455UiProofState: uiProofStrip.state,
      pass2455UiProofScore: uiProofStrip.score,
      pass2455PdfHardLocks: uiProofStrip.pdfHardLocks,
      pass2456RuntimeParityState: runtimeParityQueue.state,
      pass2456RuntimeParityScore: runtimeParityQueue.score,
      pass2456PdfHardReject: runtimeParityQueue.pdfRuntimeParityLock.hardReject,
      pass2456MissingProofQueue: runtimeParityQueue.missingProofQueue.slice(0, 8),
      advancedBlockers: chartOverlay.tierLocks.find((tier) => tier.tier === "advanced")?.blockedBy ?? [],
      pass2458ProviderCloseoutState: providerCloseoutRuntime.state,
      pass2458ProviderCloseoutScore: providerCloseoutRuntime.score,
      pass2458ActionReplay: providerCloseoutRuntime.actionReplay.slice(0, 6),
      pass2459FreshnessDriftState: sourceFreshnessDriftSentinel.state,
      pass2459FreshnessDriftScore: sourceFreshnessDriftSentinel.score,
      pass2460MacroChartState: macroChartIntegrityGate.state,
      pass2460MacroChartScore: macroChartIntegrityGate.score,
      pass2460MacroLocks: macroChartIntegrityGate.macroLocks.slice(0, 6),
      pass2461MacroGapReceiptState: macroGapReceipt.state,
      pass2461MacroGapReceiptScore: macroGapReceipt.score,
      pass2461GapReceiptFingerprint: macroGapReceipt.gapReceiptFingerprint,
      pass2461DataSyncLocks: macroGapReceipt.dataSyncLocks.slice(0, 6),
      pass2462HistoricalBackfillState: historicalBackfillOrchestrator.state,
      pass2462HistoricalBackfillScore: historicalBackfillOrchestrator.score,
      pass2462BackfillFingerprint: historicalBackfillOrchestrator.backfillFingerprint,
      pass2462HardLocks: historicalBackfillOrchestrator.hardLocks.slice(0, 6),
      pass2463HistoricalRangeWindowState: historicalRangeWindowLedger.state,
      pass2463HistoricalRangeWindowScore: historicalRangeWindowLedger.score,
      pass2463RangeWindowFingerprint: historicalRangeWindowLedger.rangeWindowFingerprint,
      pass2463WindowLocks: historicalRangeWindowLedger.hardLocks.slice(0, 6),
      uiBadges: chartOverlay.uiBadges,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/chart-overlay", code: "chart_overlay_request_failed", status: 502 });
  }
}
