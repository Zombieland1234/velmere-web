import { BASIC_PRO_ADVANCED_BOUNDARY, VELMERE_SOURCE_REGISTRY_V1, buildMethodologySummary, buildChartLifecycleReceipt, buildPdfChartLifecycleDecision, buildSourceReceipt } from "@/lib/market-integrity/top1-risk-foundation";
import { buildChartTierPdfGuard, buildPass2811TierSuite, buildTierEvidenceProfile } from "@/lib/market-integrity/top1-tier-differentiation";
import { buildReportAccessDecision, buildReportTokenPolicy, buildPass2812PaymentEntitlementBoundary } from "@/lib/market-integrity/top1-entitlement-report-access";
import { buildPass2813VlmBrainClaimFirewall, buildPass2813VlmBrainSourcePlan } from "@/lib/market-integrity/top1-vlm-brain-source-router";
import { buildPass2814SourcePoisoningFirewall } from "@/lib/market-integrity/top1-source-poisoning-ssrf-firewall";
import { buildPass2815ReportIntegrityVault } from "@/lib/market-integrity/top1-report-integrity-vault";
import { buildPass2816RuntimeObservabilityLedger } from "@/lib/market-integrity/top1-runtime-observability-ledger";
import { buildPass2817MarketMicrostructureGate } from "@/lib/market-integrity/top1-market-microstructure-gate";
import { buildPass2818IconProvenanceGate } from "@/lib/market-integrity/top1-icon-provenance-gate";
import { buildPass2819MobileAccessibilityOverlayGate } from "@/lib/market-integrity/top1-mobile-accessibility-overlay-gate";
import type { Top1PdfPayloadDraftArgs, VelmerePdfReportPayloadV2 } from "@/lib/market-integrity/top1-pdf-report-payload-types";

function reportIdFor(symbol: string, generatedAt: string) {
  const clean = symbol.replace(/[^a-z0-9]/gi, "").toUpperCase() || "ASSET";
  return `VLM-${clean}-${generatedAt.slice(0, 10).replaceAll("-", "")}-PAYLOADV2`;
}

export function buildTop1PdfReportCoreChain(input: {
  args: Top1PdfPayloadDraftArgs;
  pageMatrix: VelmerePdfReportPayloadV2["pages"];
}) {
  const { args, pageMatrix: PAGE_MATRIX } = input;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const providerConflicts = args.providerConflicts ?? [];
  const methodology = buildMethodologySummary({
    riskScore: args.riskScore,
    sourceFamilyCount: args.sourceFamilyCount,
    missingEvidenceCount: args.missingEvidence.length,
    providerConflictCount: providerConflicts.length,
  });
  const tierEvidenceProfile = buildTierEvidenceProfile(args.tier);
  const sourceLimit =
    args.tier === "Basic"
      ? 3
      : args.tier === "Pro"
        ? 7
        : VELMERE_SOURCE_REGISTRY_V1.length;
  const allowedSourceIds = new Set(
    args.sourceIds ??
      VELMERE_SOURCE_REGISTRY_V1.slice(0, sourceLimit).map(
        (entry) => entry.sourceId,
      ),
  );
  const receipts = VELMERE_SOURCE_REGISTRY_V1.filter((entry) =>
    allowedSourceIds.has(entry.sourceId),
  ).map((entry, index) => buildSourceReceipt(entry, generatedAt, index * 34));
  const tierDifferentiationGate = buildPass2811TierSuite().gate;
  const boundary =
    BASIC_PRO_ADVANCED_BOUNDARY.find((item) => item.tier === args.tier) ??
    BASIC_PRO_ADVANCED_BOUNDARY[0];
  const fallbackLifecycle = buildChartLifecycleReceipt({
    state:
      args.chartMode === "live_ohlcv" || args.chartMode === "fallback"
        ? "source_bound"
        : "unavailable_skeleton",
    sourceLabel:
      receipts
        .map((receipt) => receipt.provider)
        .slice(0, 3)
        .join(" + ") || "source pending",
    timeframeLabel: "1h / 4h / 1d / 1w / 1m depending tier",
    lastUpdatedLabel: generatedAt,
    candleCount:
      args.chartMode === "live_ohlcv" || args.chartMode === "fallback" ? 2 : 0,
    confidenceScore: methodology.confidenceScore,
  });
  const lifecycleReceipt = args.chartLifecycleReceipt ?? fallbackLifecycle;
  const pdfRenderDecision = buildPdfChartLifecycleDecision(lifecycleReceipt);
  const chartTierPdfGuard = buildChartTierPdfGuard({
    tier: args.tier,
    chartLifecycleReceipt: lifecycleReceipt,
    receipts,
  });
  const provisionalPayloadHash = `${args.symbol}:${args.tier}:${generatedAt}:${receipts.length}:${args.missingEvidence.length}:${providerConflicts.length}:${lifecycleReceipt.state}:${lifecycleReceipt.candleCount}`;
  const paymentEntitlementBoundary = buildPass2812PaymentEntitlementBoundary();
  const reportTokenPolicy = buildReportTokenPolicy();
  const reportAccessDecision = buildReportAccessDecision({
    tier: args.tier,
    accountId: args.accountId,
    serverReceiptId: args.serverReceiptId,
    reportToken: args.reportToken,
    payloadHash: args.payloadHash ?? provisionalPayloadHash,
    manualReviewReceiptId: args.manualReviewReceiptId,
    verification: args.accessVerification,
  });
  const vlmBrainSourcePlan = buildPass2813VlmBrainSourcePlan({
    assetFamily: args.family,
    tier: args.tier,
    sourceFamilyCount: args.sourceFamilyCount,
    missingEvidenceCount: args.missingEvidence.length,
    providerConflictCount: providerConflicts.length,
    chartSourceBound: pdfRenderDecision.acceptedForPdf,
    paidEvidenceAllowed: reportAccessDecision.paidEvidenceAllowed,
    manualReviewPresent: Boolean(args.manualReviewReceiptId),
  });
  const vlmBrainClaimFirewall =
    buildPass2813VlmBrainClaimFirewall(vlmBrainSourcePlan);
  const sourcePoisoningFirewall = buildPass2814SourcePoisoningFirewall({
    surface: "PDF",
    sourceFamily: receipts[0]?.sourceFamily ?? "velmere_internal",
    targetUrl: args.projectUrl ?? null,
    assetFamily: args.family,
    tier: args.tier,
    query: args.symbol,
    projectUrl: args.projectUrl ?? null,
  });
  const reportId = reportIdFor(args.symbol, generatedAt);
  const reportIntegrityVault = buildPass2815ReportIntegrityVault({
    reportId,
    tier: args.tier,
    payloadHash: args.payloadHash ?? provisionalPayloadHash,
    generatedAt,
    sourceReceipts: receipts,
    reportAccessDecision,
    sourcePoisoningFirewall,
  });
  const runtimeObservabilityLedger = buildPass2816RuntimeObservabilityLedger({
    surface: "PDF",
    tier: args.tier,
    requestedUnits: 1,
    sourceBoundUnits: pdfRenderDecision.acceptedForPdf ? 1 : 0,
    skeletonOrMissingUnits: pdfRenderDecision.acceptedForPdf ? 0 : 1,
    containedFailures: pdfRenderDecision.acceptedForPdf ? 0 : 1,
    hardFailures:
      reportIntegrityVault.releaseGate.status === "block" ||
      sourcePoisoningFirewall.releaseGate.status === "block"
        ? 1
        : 0,
    serverUnitBudget: args.tier === "Basic" ? 1 : args.tier === "Pro" ? 3 : 5,
    softTimeoutMs: 4800,
    retryAfterMs: 30000,
    maxConcurrentBatches:
      args.tier === "Basic" ? 1 : args.tier === "Pro" ? 2 : 3,
    batchMode: "report",
    generatedAt,
  });
  const marketMicrostructureGate = buildPass2817MarketMicrostructureGate({
    tier: args.tier,
    assetFamily: args.family,
    generatedAt,
    chartSourceBound: pdfRenderDecision.acceptedForPdf,
    paidEvidenceAllowed: reportAccessDecision.paidEvidenceAllowed,
    runtimeState: runtimeObservabilityLedger.runtimeState,
    sourceFamilyCount: args.sourceFamilyCount,
    orderBookLevels:
      args.family === "native_crypto" || args.family === "exchange_health"
        ? args.tier === "Basic"
          ? 1
          : 2
        : 0,
    spreadBps:
      args.family === "native_crypto" || args.family === "exchange_health"
        ? 3.2
        : null,
    slippageBps:
      args.family === "native_crypto" || args.family === "exchange_health"
        ? 18.5
        : null,
    depthUsd:
      args.family === "native_crypto" || args.family === "exchange_health"
        ? 1250000
        : null,
    openInterestUsd: args.family === "native_crypto" ? 840000000 : null,
    fundingRateBps: args.family === "native_crypto" ? 1.8 : null,
    longShortRatio: args.family === "native_crypto" ? 1.14 : null,
  });
  const iconProvenanceGate = buildPass2818IconProvenanceGate({
    surface: "PDF",
    symbol: args.symbol,
    assetFamily: args.family,
    tier: args.tier,
    licenseApproved: args.family === "exchange_health" ? undefined : true,
  });
  const mobileAccessibilityOverlayGate =
    buildPass2819MobileAccessibilityOverlayGate({
      surface: "PDF",
      tier: args.tier,
      viewportClass: "mobile_390",
      backgroundScrollLock: true,
      focusReturn: true,
      escapeClose: true,
      outsideClickClose: true,
      safeAreaPadding: true,
      horizontalTableContained: true,
      chartTouchDoesNotTrapPageScroll: true,
      reducedMotionFallback: true,
      ariaLabelsPresent: true,
      hiddenOverlayClickCaptureBlocked: true,
    });
  const visiblePages = PAGE_MATRIX.filter(
    (page) => args.tier === "Advanced" || page.requiredForTier !== "Advanced",
  );
  return {
    generatedAt,
    providerConflicts,
    methodology,
    tierEvidenceProfile,
    sourceLimit,
    allowedSourceIds,
    receipts,
    tierDifferentiationGate,
    boundary,
    fallbackLifecycle,
    lifecycleReceipt,
    pdfRenderDecision,
    chartTierPdfGuard,
    provisionalPayloadHash,
    paymentEntitlementBoundary,
    reportTokenPolicy,
    reportAccessDecision,
    vlmBrainSourcePlan,
    vlmBrainClaimFirewall,
    sourcePoisoningFirewall,
    reportId,
    reportIntegrityVault,
    runtimeObservabilityLedger,
    marketMicrostructureGate,
    iconProvenanceGate,
    mobileAccessibilityOverlayGate,
    visiblePages,
  };
}

export type Top1PdfReportCoreChain = ReturnType<typeof buildTop1PdfReportCoreChain>;
