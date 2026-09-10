import { publicApiError } from "@/lib/security/api-error-envelope";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
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
import { buildPass2464CrossProviderWindowReconciliation } from "@/lib/market-integrity/cross-provider-window-reconciliation";

const ranges = new Set(["1m", "15m", "1h", "4h", "1d", "7d", "30d", "90d", "1y", "2y", "5y", "max"]);

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  const rangeParam = searchParams.get("range")?.trim() ?? "7d";
  const range = (ranges.has(rangeParam) ? rangeParam : "7d") as MarketChartRange;
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const network = searchParams.get("network")?.trim();
  const poolAddress = searchParams.get("pool")?.trim() ?? searchParams.get("poolAddress")?.trim();

  if (!id) {
    return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing coin id" }, { status: 400 });
  }

  try {
    const points = await fetchCoinGeckoMarketChart(id, range);
    const pass2444ChartQuality = buildPass2444ChartQuality(points, range);
    const pass2448ChartMethodology = buildPass2448ChartMethodologyContract({
      range,
      pointCount: points.length,
      continuityScore: pass2444ChartQuality.continuityScore,
      missingForAdvanced: pass2444ChartQuality.missingForAdvanced,
    });
    const pass2449ChartOverlay = buildPass2449ChartOverlayReconciler({
      assetId: id,
      symbol,
      range,
      pointCount: points.length,
      chartQuality: pass2444ChartQuality,
      chartMethodology: pass2448ChartMethodology,
      network,
      poolAddress,
    });
    const pass2446PayloadFingerprint = createHash("sha256")
      .update(JSON.stringify({ id, range, points, pass2444ChartQuality, pass2448ChartMethodology, pass2449ChartOverlay }))
      .digest("hex");
    const pass2450TierEvidenceParity = buildPass2450TierEvidenceParity({
      query: id,
      symbol,
      range,
      chartOverlay: pass2449ChartOverlay,
      payloadFingerprint: pass2446PayloadFingerprint,
    });
    const pass2451DataProvenanceLedger = buildPass2451DataProvenanceLedger({
      query: id,
      symbol,
      chartOverlay: pass2449ChartOverlay,
      tierEvidence: pass2450TierEvidenceParity,
      payloadFingerprint: pass2446PayloadFingerprint,
    });
    const pass2452RiskCalibrationKernel = buildPass2452RiskCalibrationKernel({
      query: id,
      symbol,
      chartOverlay: pass2449ChartOverlay,
      tierEvidence: pass2450TierEvidenceParity,
      dataProvenance: pass2451DataProvenanceLedger,
    });
    const pass2453ReportEvidenceCapsule = buildPass2453ReportEvidenceCapsule({
      query: id,
      symbol,
      tierEvidence: pass2450TierEvidenceParity,
      dataProvenance: pass2451DataProvenanceLedger,
      riskCalibration: pass2452RiskCalibrationKernel,
      payloadFingerprint: pass2446PayloadFingerprint,
    });
    const pass2454ChartInstitutionalRouter = buildPass2454ChartInstitutionalRouter({
      id,
      symbol,
      range,
      pointCount: points.length,
      reportEvidence: pass2453ReportEvidenceCapsule,
      payloadFingerprint: pass2446PayloadFingerprint,
    });
    const pass2455ChartUiProofStrip = buildPass2455ChartUiProofStrip({
      id,
      symbol,
      range,
      pointCount: points.length,
      institutionalRouter: pass2454ChartInstitutionalRouter,
      reportEvidence: pass2453ReportEvidenceCapsule,
      payloadFingerprint: pass2446PayloadFingerprint,
    });
    const pass2456RuntimeParityQueue = buildPass2456RuntimeParityQueue({
      query: id,
      symbol,
      uiProofStrip: pass2455ChartUiProofStrip,
      reportEvidence: pass2453ReportEvidenceCapsule,
      payloadFingerprint: pass2446PayloadFingerprint,
    });
    const pass2457OperatorActionQueue = buildPass2457OperatorActionQueue({
      query: id,
      symbol,
      runtimeParity: pass2456RuntimeParityQueue,
      uiProofStrip: pass2455ChartUiProofStrip,
      institutionalRouter: pass2454ChartInstitutionalRouter,
    });
    const pass2458ProviderCloseoutRuntime = buildPass2458ProviderCloseoutRuntime({
      query: id,
      symbol,
      operatorActionQueue: pass2457OperatorActionQueue,
    });
    const pass2459SourceFreshnessDriftSentinel = buildPass2459SourceFreshnessDriftSentinel({
      query: id,
      symbol,
      range,
      providerCloseoutRuntime: pass2458ProviderCloseoutRuntime,
    });
    const pass2460MacroChartIntegrityGate = buildPass2460MacroChartIntegrityGate({
      query: id,
      symbol,
      requestedRange: range,
      pointCount: points.length,
      chartOverlay: pass2449ChartOverlay,
      sourceFreshness: pass2459SourceFreshnessDriftSentinel,
      payloadFingerprint: pass2453ReportEvidenceCapsule.canonicalEvidenceFingerprint,
    });
    const pass2461MacroGapReceipt = buildPass2461MacroGapReceipt({
      query: id,
      symbol,
      requestedRange: range,
      pointCount: points.length,
      chartOverlay: pass2449ChartOverlay,
      macroGate: pass2460MacroChartIntegrityGate,
      payloadFingerprint: pass2460MacroChartIntegrityGate.macroChartFingerprint,
    });
    const pass2462HistoricalBackfillOrchestrator = buildPass2462HistoricalBackfillOrchestrator({
      query: id,
      symbol,
      requestedRange: range,
      pointCount: points.length,
      chartOverlay: pass2449ChartOverlay,
      macroGapReceipt: pass2461MacroGapReceipt,
      payloadFingerprint: pass2461MacroGapReceipt.gapReceiptFingerprint,
    });
    const pass2463HistoricalRangeWindowLedger = buildPass2463HistoricalRangeWindowLedger({
      query: id,
      symbol,
      requestedRange: range,
      pointCount: points.length,
      historicalBackfill: pass2462HistoricalBackfillOrchestrator,
      payloadFingerprint: pass2462HistoricalBackfillOrchestrator.backfillFingerprint,
    });
    const pass2464CrossProviderWindowReconciliation = buildPass2464CrossProviderWindowReconciliation({
      query: id,
      symbol,
      historicalRangeWindow: pass2463HistoricalRangeWindowLedger,
      payloadFingerprint: pass2463HistoricalRangeWindowLedger.rangeWindowFingerprint,
    });

    return NextResponse.json({
      mode: "partial",
      publication: {
        evidenceState: "partial",
        liveClaimed: false,
        blockers: ["chart_signed_field_projection_missing", "independent_chart_quorum_missing"],
      },
      source: "CoinGecko market_chart",
      id,
      range,
      points,
      historyProfile: {
        version: "pass2443-deep-chart-spine-v1",
        points: points.length,
        macroRanges: ["1y", "2y", "5y", "max"],
        boundary: "Long-range chart is context for regime detection; it is not a price prediction.",
      },
      pass2444ChartQuality,
      pass2445ChartSla: {
        version: "pass2445-chart-source-sla-v1",
        state: pass2444ChartQuality.macroReady ? "ready" : pass2444ChartQuality.continuityScore >= 55 ? "watch" : "blocked",
        requiredForAdvanced: ["long-range continuity", "volume timeline", "market-cap timeline", "second provider overlay", "field-level observedAt"],
        sourceLocks: pass2444ChartQuality.missingForAdvanced,
        copyBoundary: "Chart SLA can improve confidence only when coverage, gaps and source provenance are visible; it is not a forecast.",
      },
      pass2448ChartMethodology,
      pass2449ChartOverlay,
      pass2450TierEvidenceParity,
      pass2451DataProvenanceLedger,
      pass2452RiskCalibrationKernel,
      pass2453ReportEvidenceCapsule,
      pass2454ChartInstitutionalRouter,
      pass2455ChartUiProofStrip,
      pass2456RuntimeParityQueue,
      pass2457OperatorActionQueue,
      pass2458ProviderCloseoutRuntime,
      pass2459SourceFreshnessDriftSentinel,
      pass2460MacroChartIntegrityGate,
      pass2461MacroGapReceipt,
      pass2462HistoricalBackfillOrchestrator,
      pass2463HistoricalRangeWindowLedger,
      pass2464CrossProviderWindowReconciliation,
      pass2447ChartConsensus: {
        version: "pass2447-chart-consensus-reconciler-v1",
        state: pass2444ChartQuality.macroReady ? "watch" : "blocked",
        rangeClass: ["2y", "5y", "max"].includes(range) ? "macro" : "short_window",
        requiredProviderPairing: ["CoinGecko market_chart/OHLC", "second venue overlay for CEX symbols", "gap annotations", "market-cap/volume timeline"],
        blockedBy: pass2444ChartQuality.missingForAdvanced,
        uiRule: "Do not write macro/regime conclusions from a short sparkline; show points, gaps, source and checksum first.",
      },
      pass2446ChartProofCapsule: {
        version: "pass2446-chart-proof-capsule-v1",
        payloadFingerprint: pass2446PayloadFingerprint,
        parityTargets: ["Shield chart", "VLM Brain", "Browser preview", "PDF preview", "PDF download"],
        fingerprintScope: ["coin id", "range", "points", "chart quality gate"],
        state: pass2444ChartQuality.macroReady ? "partial_ready" : "needs_more_proof",
        driftAction: "If any target uses a different chart payload hash, show a drift warning and regenerate PDF from the canonical chart endpoint.",
        advancedLock: pass2444ChartQuality.missingForAdvanced.length ? "blocked_until_missing_lanes_visible" : "ready_for_macro_context",
      },
      worldClassChartGate: {
        state: pass2444ChartQuality.macroReady ? "ready" : pass2444ChartQuality.continuityScore >= 55 ? "watch" : "blocked",
        score: pass2444ChartQuality.continuityScore,
        missingForAdvanced: pass2444ChartQuality.missingForAdvanced,
        requiredNext: ["second provider overlay", "gap annotations", "source observedAt badges", "PDF/chart payload parity", "PASS2448 methodology contract", "PASS2449 chart overlay reconciler"],
        pass2449State: pass2449ChartOverlay.state,
        pass2449Score: pass2449ChartOverlay.score,
        pass2450State: pass2450TierEvidenceParity.state,
        pass2450Score: pass2450TierEvidenceParity.score,
        pass2451State: pass2451DataProvenanceLedger.state,
        pass2451Score: pass2451DataProvenanceLedger.score,
        pass2452State: pass2452RiskCalibrationKernel.state,
        pass2452CalibratedRiskScore: pass2452RiskCalibrationKernel.calibratedRiskScore,
        pass2452ConfidenceCap: pass2452RiskCalibrationKernel.confidenceCap,
        pass2453ReportEvidenceState: pass2453ReportEvidenceCapsule.state,
        pass2453ReportEvidenceScore: pass2453ReportEvidenceCapsule.score,
        pass2453CanonicalFingerprint: pass2453ReportEvidenceCapsule.canonicalEvidenceFingerprint,
        pass2454InstitutionalRouterState: pass2454ChartInstitutionalRouter.state,
        pass2454InstitutionalRouterScore: pass2454ChartInstitutionalRouter.score,
        pass2454ChartExpansionBlockers: pass2454ChartInstitutionalRouter.chartDataExpansionPlan.blockedBy.slice(0, 6),
        pass2455UiProofState: pass2455ChartUiProofStrip.state,
        pass2455UiProofScore: pass2455ChartUiProofStrip.score,
        pass2455PdfHardLocks: pass2455ChartUiProofStrip.pdfHardLocks.slice(0, 6),
        pass2456RuntimeParityState: pass2456RuntimeParityQueue.state,
        pass2456RuntimeParityScore: pass2456RuntimeParityQueue.score,
        pass2456PdfHardReject: pass2456RuntimeParityQueue.pdfRuntimeParityLock.hardReject,
        pass2456MissingProofQueue: pass2456RuntimeParityQueue.missingProofQueue.slice(0, 6),
        pass2457OperatorActionState: pass2457OperatorActionQueue.state,
        pass2457OperatorActionScore: pass2457OperatorActionQueue.score,
        pass2457P0Actions: pass2457OperatorActionQueue.prioritizedActions.filter((action) => action.priority === "P0").slice(0, 6),
        pass2458ProviderCloseoutState: pass2458ProviderCloseoutRuntime.state,
        pass2458ProviderCloseoutScore: pass2458ProviderCloseoutRuntime.score,
        pass2458ActionReplay: pass2458ProviderCloseoutRuntime.actionReplay.slice(0, 6),
        pass2459FreshnessDriftState: pass2459SourceFreshnessDriftSentinel.state,
        pass2459FreshnessDriftScore: pass2459SourceFreshnessDriftSentinel.score,
        pass2459HardLocks: pass2459SourceFreshnessDriftSentinel.hardLocks.slice(0, 6),
        pass2460MacroChartState: pass2460MacroChartIntegrityGate.state,
        pass2460MacroChartScore: pass2460MacroChartIntegrityGate.score,
        pass2460ActiveRange: pass2460MacroChartIntegrityGate.activeRangeGate.range,
        pass2460MacroLocks: pass2460MacroChartIntegrityGate.macroLocks.slice(0, 6),
        pass2461MacroGapReceiptState: pass2461MacroGapReceipt.state,
        pass2461MacroGapReceiptScore: pass2461MacroGapReceipt.score,
        pass2461GapReceiptFingerprint: pass2461MacroGapReceipt.gapReceiptFingerprint,
        pass2461DataSyncLocks: pass2461MacroGapReceipt.dataSyncLocks.slice(0, 6),
        pass2462HistoricalBackfillState: pass2462HistoricalBackfillOrchestrator.state,
        pass2462HistoricalBackfillScore: pass2462HistoricalBackfillOrchestrator.score,
        pass2462BackfillFingerprint: pass2462HistoricalBackfillOrchestrator.backfillFingerprint,
        pass2462HardLocks: pass2462HistoricalBackfillOrchestrator.hardLocks.slice(0, 6),
        pass2463HistoricalRangeWindowState: pass2463HistoricalRangeWindowLedger.state,
        pass2463HistoricalRangeWindowScore: pass2463HistoricalRangeWindowLedger.score,
        pass2463RangeWindowFingerprint: pass2463HistoricalRangeWindowLedger.rangeWindowFingerprint,
        pass2463WindowLocks: pass2463HistoricalRangeWindowLedger.hardLocks.slice(0, 6),
        pass2464WindowReconciliationState: pass2464CrossProviderWindowReconciliation.state,
        pass2464WindowReconciliationScore: pass2464CrossProviderWindowReconciliation.score,
        pass2464ReconciliationFingerprint: pass2464CrossProviderWindowReconciliation.reconciliationFingerprint,
        pass2464SurfaceHardLocks: pass2464CrossProviderWindowReconciliation.surfaceHardLocks.slice(0, 6),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/chart", code: "chart_request_failed", status: 502 });
  }
}
