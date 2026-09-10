import { publicApiError } from "@/lib/security/api-error-envelope";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildInvestigationPlan } from "@/lib/market-integrity/investigation-plan";
import { buildAttackSurface } from "@/lib/market-integrity/attack-playbook";
import { recordSingleResult } from "@/lib/market-integrity/market-memory";
import { getPersistentRiskHistory, persistRiskSnapshots } from "@/lib/market-integrity/risk-ledger";
import { buildSingleAssetRuleHits } from "@/lib/market-integrity/rule-engine";
import { buildRiskBrain } from "@/lib/market-integrity/risk-brain";
import { buildHolderIntelligence } from "@/lib/market-integrity/holder-intelligence";
import { buildStressScenarios } from "@/lib/market-integrity/stress-simulator";
import { buildRiskReplay } from "@/lib/market-integrity/risk-replay";
import { buildAiRiskBotBrief } from "@/lib/market-integrity/ai-risk-bot";
import { buildAiRiskOrchestrator } from "@/lib/market-integrity/ai-orchestrator";
import { buildShieldChatResponse } from "@/lib/market-integrity/shield-chat";
import { buildChartRegime } from "@/lib/market-integrity/chart-regime";
import { buildSocTerminalBrief } from "@/lib/market-integrity/soc-orchestrator";
import { buildVlmShieldAccess } from "@/lib/market-integrity/vlm-access-layer";
import { buildEvidenceWorkflow } from "@/lib/market-integrity/evidence-workflow";
import { buildLiquidityIntelligence } from "@/lib/market-integrity/liquidity-intelligence";
import { buildProductOpsAudit } from "@/lib/market-integrity/product-ops-audit";
import { buildTerminalControlPlane } from "@/lib/market-integrity/terminal-control-plane";
import { buildTerminalRiskWorkspace } from "@/lib/market-integrity/terminal-risk-workspace";
import { buildProductionHardening } from "@/lib/market-integrity/production-hardening";
import { buildTerminalUsabilityGuard } from "@/lib/market-integrity/terminal-usability-guard";
import { buildTerminalPerformanceGuard } from "@/lib/market-integrity/terminal-performance-guard";
import { buildTerminalOperatorCopilot } from "@/lib/market-integrity/terminal-operator-copilot";
import { buildTerminalLaunchBridge } from "@/lib/market-integrity/terminal-launch-bridge";
import { buildTerminalSourceTrust } from "@/lib/market-integrity/terminal-source-trust";
import { buildTerminalEvidenceExport } from "@/lib/market-integrity/terminal-evidence-export";
import { buildTerminalRuntimeHealth } from "@/lib/market-integrity/terminal-runtime-health";
import { buildTerminalOperatorFocus } from "@/lib/market-integrity/terminal-operator-focus";
import { buildTerminalInteractionStability } from "@/lib/market-integrity/terminal-interaction-stability";
import { buildTerminalReviewDeck } from "@/lib/market-integrity/terminal-review-deck";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { buildAnalysisReadiness } from "@/lib/market-integrity/analysis-readiness";
import { buildPass4645ProviderEvidenceLedger, persistPass4645ProviderEvidenceLedger } from "@/lib/market-integrity/provider-evidence-ledger";
import { PDF_V2_ACCEPTANCE_GATES, buildCustomerReportPayload, type VelmereReportAssetFamily } from "@/lib/market-integrity/customer-report-payload";
import type { Pass4825RuntimeFieldValue } from "@/lib/reporting/runtime-canonical-field-adapter";
import { buildCustomerReportDecisionSections } from "@/lib/market-integrity/customer-report-decision-sections";
import { buildCustomerReportLayoutModel } from "@/lib/market-integrity/customer-report-layout-model";
import { issuePass4818CustomerReportRenderToken } from "@/lib/market-integrity/customer-report-render-token";
import { createPass4823RealMarketsPaidAccountArtifact } from "@/lib/market-integrity/real-markets-paid-account-artifact";
import { buildChartLifecycleReceipt, type VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import { normalizeConfidencePercent } from "@/lib/market-integrity/confidence-calibration";
import { buildPass2811TierSuite } from "@/lib/market-integrity/top1-tier-differentiation";
import { resolveVlmPaidSurfaceAccess, toVlmPaidSurfacePaymentRequiredPayload } from "@/lib/commerce/vlm-paid-surface-guard";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { buildPass2812PaidTierSecuritySuiteV2, buildReportAccessDecision } from "@/lib/market-integrity/top1-entitlement-report-access";
import { buildPass2814ReportInputFirewall, buildPass2814SourcePoisoningFirewall } from "@/lib/market-integrity/top1-source-poisoning-ssrf-firewall";
import { PASS2813_VLM_BRAIN_ACCEPTANCE_GATES } from "@/lib/market-integrity/top1-vlm-brain-source-router";
import { PASS2815_REPORT_INTEGRITY_ACCEPTANCE_GATES } from "@/lib/market-integrity/top1-report-integrity-vault";
import { PASS2816_RUNTIME_OBSERVABILITY_ACCEPTANCE_GATES } from "@/lib/market-integrity/top1-runtime-observability-ledger";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";
import {
  buildP98CustomerPaidTierExactDeliveryDecision,
  toP98CustomerPaidTierDeliveryProjection,
  toP98CustomerPaidTierWithheldPayload,
} from "@/lib/market-integrity/customer-paid-tier-exact-delivery-policy";

type ErrorPayload = { mode: "error"; error: string };

function tierFromSearchParams(value: string | null): VelmereTier {
  const normalized = (value ?? "Basic").toLowerCase();
  if (normalized === "advanced") return "Advanced";
  if (normalized === "pro") return "Pro";
  return "Basic";
}

function reportFamilyFromAssetClass(value: string | undefined): VelmereReportAssetFamily {
  if (value === "stock") return "equity";
  if (value === "etf") return "etf";
  if (value === "fx") return "fx";
  if (value === "commodity") return "commodity";
  if (value === "real_estate") return "real_estate";
  if (value === "exchange_equity") return "exchange_health";
  return "native_crypto";
}

async function handleMarketReportGet(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  const localeCandidate = searchParams.get("locale")?.trim() || "pl";
  const locale = localeCandidate === "de" || localeCandidate === "en" ? localeCandidate : "pl";
  if (!query) return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400 });
  const requestedReportTier = tierFromSearchParams(searchParams.get("tier"));
  // P98: the analysis tier is always the exact requested tier. An unavailable
  // paid tier is WITHHELD and cannot silently become Pro or Basic.
  const reportTier: VelmereTier = requestedReportTier;
  const requestedReportDepth = requestedReportTier === "Advanced" ? "advanced" : requestedReportTier === "Pro" ? "pro" : "basic";
  const reportDepth = requestedReportDepth;
  const paidAccessGate = await resolveVlmPaidSurfaceAccess({
    policyId: "market_report",
    request,
    depth: requestedReportDepth,
    locale,
    assetId: query,
    symbol: query,
    requestId: searchParams.get("requestId"),
    returnPath: searchParams.get("returnPath"),
  });
  if (!paidAccessGate.ok) {
    return NextResponse.json(toVlmPaidSurfacePaymentRequiredPayload(paidAccessGate), { status: 402, headers: paidAccessGate.headers });
  }

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const generatedAt = new Date().toISOString();
    const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
    if (reportTier !== "Basic" && publication.evidenceState !== "verified") {
      const pass98SourceEvidenceWithheld = buildP98CustomerPaidTierExactDeliveryDecision({
        requestedTier: requestedReportTier,
        analyzedTier: reportTier,
        payloadTier: null,
        deliveryPolicy: { visibleTier: null, status: "unavailable", paidEvidenceAllowed: false },
      });
      return NextResponse.json(
        toP98CustomerPaidTierWithheldPayload(pass98SourceEvidenceWithheld),
        { status: 424, headers: { "cache-control": "no-store" } },
      );
    }
    const memory = recordSingleResult(result);
    const ledger = memory?.lastSnapshot ? await persistRiskSnapshots([memory.lastSnapshot]) : undefined;
    const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
    const history = await getPersistentRiskHistory(id, 144);
    const investigationPlan = buildInvestigationPlan(result, history);
    const attackSurface = buildAttackSurface(result);
    const rules = buildSingleAssetRuleHits(result, searchParams.get("watchlist"));
    const riskBrain = buildRiskBrain(result, history);
    const holderIntelligence = buildHolderIntelligence(result);
    const stressSimulator = buildStressScenarios(result);
    const riskReplay = buildRiskReplay(result, history);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama, history });
    const resolvedAccount = await resolveRequestAccount(request);
    const verifiedEntitlement = paidAccessGate.paidRequired && "entitlement" in paidAccessGate
      ? paidAccessGate.entitlement
      : null;
    const entitlementId = verifiedEntitlement?.entitlement?.id ?? "";
    const entitlementDigest = entitlementId ? createHash("sha256").update(entitlementId, "utf8").digest("hex") : "";
    const accessTokenDigest = entitlementDigest;
    const pass2812AccessContext = {
      tier: reportTier,
      accountId: resolvedAccount?.accountId ?? null,
      serverReceiptId: reportTier === "Basic" || !entitlementDigest ? null : `vlm_receipt_${entitlementDigest.slice(0, 32)}`,
      reportToken: reportTier === "Basic" || !accessTokenDigest ? null : `vlm_rpt_${accessTokenDigest.slice(0, 40)}`,
      payloadHash: reportTier === "Basic" ? null : paidAccessGate.context.accountIdHash
        ? createHash("sha256").update(JSON.stringify(paidAccessGate.context), "utf8").digest("hex")
        : null,
      manualReviewReceiptId: null,
      manualReviewRequired: false,
      advancedDeliveryMode: "automated" as const,
      verification: reportTier === "Basic" ? undefined : {
        accountBound: Boolean(resolvedAccount && paidAccessGate.context.accountIdHash),
        serverReceiptVerified: Boolean(verifiedEntitlement?.entitlement),
        reportTokenVerified: Boolean(verifiedEntitlement?.entitlement),
        payloadHashBound: Boolean(paidAccessGate.context.accountIdHash),
        manualReviewVerified: false,
        source: "server_entitlement" as const,
      },
    };
    const pass2812ReportAccessDecision = buildReportAccessDecision(pass2812AccessContext);
    const pass2812PaidTierSecuritySuite = buildPass2812PaidTierSecuritySuiteV2(
      pass2812AccessContext,
      "automated",
    );
    if (reportTier !== "Basic" && !pass2812ReportAccessDecision.paidEvidenceAllowed) {
      const pass98EntitlementWithheld = buildP98CustomerPaidTierExactDeliveryDecision({
        requestedTier: requestedReportTier,
        analyzedTier: reportTier,
        payloadTier: null,
        deliveryPolicy: { visibleTier: null, status: "unavailable", paidEvidenceAllowed: false },
      });
      return NextResponse.json(
        toP98CustomerPaidTierWithheldPayload(pass98EntitlementWithheld),
        { status: 402, headers: { "cache-control": "no-store" } },
      );
    }
    const pass4645ProviderEvidenceLedger = buildPass4645ProviderEvidenceLedger({
      receipts: result.providerEvidenceReceipts,
      requestedIdentity: query,
      surface: "crypto",
      depth: reportDepth,
      generatedAt: new Date(),
      signingSecret: process.env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET?.trim() || null,
    });
    const pass4645ProviderEvidencePersistence = await persistPass4645ProviderEvidenceLedger(pass4645ProviderEvidenceLedger).catch((error) => ({
      schemaVersion: "pass4645_provider_evidence_persistence_v1" as const,
      durable: false,
      mode: "not_configured" as const,
      ledgerId: pass4645ProviderEvidenceLedger.ledgerId,
      headHash: pass4645ProviderEvidenceLedger.headHash,
      recordCount: pass4645ProviderEvidenceLedger.entries.length,
      readBackVerified: false,
      persistedAt: null,
      locator: null,
      blockers: [`pdf_provider_receipt_persistence_error:${error instanceof Error ? error.name : "unknown"}`],
    }));
    result.providerEvidenceLedger = pass4645ProviderEvidenceLedger;
    result.providerEvidencePersistence = pass4645ProviderEvidencePersistence;
    const pass4645AnalysisReadiness = buildAnalysisReadiness(result, locale);
    if (reportTier !== "Basic" && (!result.providerRiskDelivery || result.providerRiskDelivery.state !== "verified")) {
      return NextResponse.json(
        { mode: "withheld", error: "premium_report_source_evidence_not_ready" },
        { status: 424, headers: { "cache-control": "no-store" } },
      );
    }
    if (reportTier !== "Basic" && !pass4645AnalysisReadiness.tiers[reportDepth].sellReady) {
      const basicAvailable = pass4645AnalysisReadiness.tiers.basic.sellReady;
      const pass98ReadinessWithheld = buildP98CustomerPaidTierExactDeliveryDecision({
        requestedTier: requestedReportTier,
        analyzedTier: reportTier,
        payloadTier: basicAvailable ? "Basic" : null,
        deliveryPolicy: basicAvailable
          ? { visibleTier: "Basic", status: "redacted_to_basic", paidEvidenceAllowed: false }
          : { visibleTier: null, status: "unavailable", paidEvidenceAllowed: false },
      });
      return NextResponse.json(
        toP98CustomerPaidTierWithheldPayload(pass98ReadinessWithheld),
        { status: 409, headers: { "cache-control": "no-store" } },
      );
    }
    const aiRiskBot = buildAiRiskBotBrief(result, history, defiLlama);
    const aiOrchestrator = buildAiRiskOrchestrator(result, history);
    const shieldChat = buildShieldChatResponse(result, history, searchParams.get("prompt") ?? "Explain the current risk.", locale);
    const chartRegime = buildChartRegime(result, {
      bars: result.chart?.sevenDay?.length ?? 0,
      source: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
    });
    const socTerminal = buildSocTerminalBrief(result, history);
    const vlmAccessLayer = buildVlmShieldAccess(result);
    const liquidityIntelligence = buildLiquidityIntelligence(result);
    const evidenceWorkflow = buildEvidenceWorkflow(result, {
      historyCount: history.length,
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      activeCommand: searchParams.get("command") ?? "risk",
    });
    const productOpsAudit = buildProductOpsAudit(result, {
      historyCount: history.length,
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      activeCommand: searchParams.get("command") ?? "ops",
      sessionMode: "operator_session",
    });
    const terminalControlPlane = buildTerminalControlPlane(result, {
      historyCount: history.length,
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      activeCommand: searchParams.get("command") ?? "control",
      sessionMode: "operator_session",
    });
    const terminalRiskWorkspace = buildTerminalRiskWorkspace(result, {
      historyCount: history.length,
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      activeCommand: searchParams.get("command") ?? "workspace",
      sessionMode: "operator_session",
    });
    const productionHardening = buildProductionHardening(result, {
      historyCount: history.length,
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      activeCommand: searchParams.get("command") ?? "production",
      sessionMode: "operator_session",
    });
    const terminalUsabilityGuard = buildTerminalUsabilityGuard(result, {
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
    const terminalPerformanceGuard = buildTerminalPerformanceGuard(result, {
      terminalBootDeferred: true,
      modalChunkSplit: true,
      orderBookDeferred: true,
      historyDeferred: true,
      heavyPanelsDeferred: true,
      shieldMapDetached: true,
      tableWheelUnlocked: true,
    });
    const terminalOperatorCopilot = buildTerminalOperatorCopilot(result, {
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      historyCount: history.length,
      activeCommand: searchParams.get("command") ?? "copilot",
      terminalBootDeferred: true,
      shieldMapDetached: true,
      sourceHonestyVisible: true,
      chatHistoryCount: 0,
    });
    const terminalLaunchBridge = buildTerminalLaunchBridge(result, {
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      historyCount: history.length,
      activeCommand: searchParams.get("command") ?? "launch",
      sessionMode: "operator_session",
      terminalBootDeferred: true,
      modalChunkSplit: true,
      shieldMapDetached: true,
      tableWheelUnlocked: true,
      searchResolverGuarded: true,
      suggestionDismissOnOutsideClick: true,
      sourceHonestyVisible: true,
    });
    const terminalSourceTrust = buildTerminalSourceTrust(result, {
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      historyCount: history.length,
      activeCommand: searchParams.get("command") ?? "sources",
      searchResolverGuarded: true,
      suggestionDismissOnOutsideClick: true,
      sourceCooldownActive: false,
      terminalBootDeferred: true,
      modalChunkSplit: true,
      tableWheelUnlocked: true,
      walletSessionReady: false,
      exportInfrastructureReady: false,
      rateLimitMiddlewareReady: false,
    });
    const terminalEvidenceExport = buildTerminalEvidenceExport(result, {
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      historyCount: history.length,
      activeCommand: searchParams.get("command") ?? "export",
      sessionMode: "operator_session",
      walletSessionReady: false,
      exportInfrastructureReady: false,
      rateLimitMiddlewareReady: false,
      persistentAuditLogReady: false,
    });
    const terminalRuntimeHealth = buildTerminalRuntimeHealth(result, {
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      historyCount: history.length,
      activeCommand: searchParams.get("command") ?? "runtime",
      modalErrorBoundary: true,
      terminalBootDeferred: true,
      modalChunkSplit: true,
      heavyPanelsDeferred: true,
      shieldMapDetached: true,
      tableWheelUnlocked: true,
      suggestionDismissOnOutsideClick: true,
      sourceCooldownActive: false,
      rateLimitMiddlewareReady: false,
      exportInfrastructureReady: false,
      persistentAuditLogReady: false,
      walletSessionReady: false,
    });
    const terminalOperatorFocus = buildTerminalOperatorFocus(result, {
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      historyCount: history.length,
      activeCommand: searchParams.get("command") ?? "review",
      terminalBootDeferred: true,
      modalChunkSplit: true,
      heavyPanelsDeferred: true,
      modalErrorBoundary: true,
      focusedPanelRouting: true,
      sourceCooldownActive: false,
      rateLimitMiddlewareReady: false,
      exportInfrastructureReady: false,
      persistentAuditLogReady: false,
      walletSessionReady: false,
    });
    const terminalInteractionStability = buildTerminalInteractionStability(result, {
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      historyCount: history.length,
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
    const terminalReviewDeck = buildTerminalReviewDeck(result, {
      candlesCount: result.chart?.sevenDay?.length ?? 0,
      chartSource: result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics",
      hasOrderBook: false,
      historyCount: history.length,
      activeCommand: searchParams.get("command") ?? "deck",
      terminalBootDeferred: true,
      modalChunkSplit: true,
      heavyPanelsDeferred: true,
      sourceCooldownActive: false,
      searchLocalFirst: true,
      suggestionDismissOnOutsideClick: true,
      tableWheelUnlocked: true,
      shieldMapDetached: true,
      focusedPanelRouting: true,
      rateLimitMiddlewareReady: false,
      exportInfrastructureReady: false,
      persistentAuditLogReady: false,
      walletSessionReady: false,
    });

    const pass2814ProjectUrl = searchParams.get("projectUrl") ?? searchParams.get("sourceUrl") ?? null;
    const pass2814ReportInputFirewall = buildPass2814ReportInputFirewall({
      assetFamily: reportFamilyFromAssetClass(result.token.assetClass),
      tier: reportTier,
      query,
      projectUrl: pass2814ProjectUrl,
    });
    const pass2814SourcePoisoningFirewall = buildPass2814SourcePoisoningFirewall({
      surface: "PDF",
      sourceFamily: result.dataSources.length >= 2 ? "coingecko" : "velmere_internal",
      targetUrl: pass2814ProjectUrl,
      assetFamily: reportFamilyFromAssetClass(result.token.assetClass),
      tier: reportTier,
      query,
      projectUrl: pass2814ProjectUrl,
    });
    const reportChartPointCount = result.chart?.sevenDay?.length ?? 0;
    const reportChartLifecycleReceipt = buildChartLifecycleReceipt({
      state: reportChartPointCount >= 2 ? "source_bound" : "unavailable_skeleton",
      sourceLabel: reportChartPointCount >= 2 ? "Shield market chart payload" : "Shield chart source unavailable",
      timeframeLabel: "7D source sparkline",
      lastUpdatedLabel: result.generatedAt,
      candleCount: reportChartPointCount,
      confidenceScore: result.confidence === undefined ? 0 : normalizeConfidencePercent(result.confidence, 0),
    });
    const customerReportDecisionSections = buildCustomerReportDecisionSections({
      result,
      readiness: pass4645AnalysisReadiness,
      riskBrain,
      holderIntelligence,
      liquidityIntelligence,
      stressSimulator,
    });
    const customerReportStressEvidenceReady = stressSimulator.scenarios.length > 0
      && result.metrics.liquidityUsd !== undefined
      && pass4645AnalysisReadiness.receiptProof.providerFamilyCount >= 2;
    const customerReportEvidenceLedgerReady = pass4645ProviderEvidencePersistence.durable
      && pass4645ProviderEvidencePersistence.readBackVerified;
    const customerReportProviderTimestamps = (result.providerEvidenceReceipts ?? [])
      .filter((receipt) => receipt.commercialEvidenceEligible)
      .map((receipt) => receipt.observedAt);
    const customerReportGeneratedAtMs = Date.parse(result.generatedAt);
    const customerReportLatestObservationAt = customerReportProviderTimestamps
      .filter((timestamp) => Number.isFinite(Date.parse(timestamp)))
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
    const customerReportLatestObservationMs = customerReportLatestObservationAt
      ? Date.parse(customerReportLatestObservationAt)
      : Number.NaN;
    const customerReportCanonicalSourceReady = result.dataQuality === "live"
      && pass4645AnalysisReadiness.receiptProof.providerFamilyCount > 0
      && Number.isFinite(customerReportGeneratedAtMs)
      && Number.isFinite(customerReportLatestObservationMs)
      && customerReportLatestObservationMs <= customerReportGeneratedAtMs + 1_000
      && customerReportGeneratedAtMs - customerReportLatestObservationMs <= 300_000;
    const customerReportCanonicalConfidence = normalizeConfidencePercent(result.confidence, 0);
    const customerReportMetric = (
      value: unknown,
      missingReason: string,
      options: { currency?: string; min?: number; max?: number } = {},
    ): Pass4825RuntimeFieldValue => {
      const numeric = typeof value === "number" && Number.isFinite(value) ? value : null;
      const inRange = numeric !== null
        && (options.min === undefined || numeric >= options.min)
        && (options.max === undefined || numeric <= options.max);
      const available = customerReportCanonicalSourceReady && inRange;
      return {
        value: available ? numeric : null,
        missingReason: available ? null : missingReason,
        currency: options.currency,
        confidence: available ? customerReportCanonicalConfidence : 0,
        quality: available ? customerReportCanonicalConfidence : 0,
        observedAt: available ? customerReportLatestObservationAt! : result.generatedAt,
      };
    };
    const tenThousandSellScenario = stressSimulator.scenarios.find((scenario) => scenario.id === "sell_10000");
    const customerReportRuntimeCanonicalValues: Record<string, Pass4825RuntimeFieldValue> = {
      "market.price": customerReportMetric(result.metrics.currentPrice, "fresh source-bound market price unavailable", { currency: "USD", min: Number.MIN_VALUE }),
      "market.change_24h": customerReportMetric(result.metrics.priceChange24h, "fresh source-bound 24h change unavailable", { min: -100, max: 1_000_000 }),
      "market.volume_24h": customerReportMetric(result.metrics.volume24h, "fresh source-bound 24h volume unavailable", { currency: "USD", min: 0 }),
      "market.change_1h": customerReportMetric(result.metrics.priceChange1h, "fresh source-bound 1h change unavailable", { min: -100, max: 1_000_000 }),
      "market.liquidity_usd": customerReportMetric(result.metrics.liquidityUsd, "fresh source-bound liquidity unavailable", { currency: "USD", min: 0 }),
      "market.impact_10k_bps": customerReportMetric(
        typeof result.metrics.simulatedSlippage10k === "number" ? result.metrics.simulatedSlippage10k * 100 : null,
        "source-bound 10k impact unavailable",
        { min: 0, max: 1_000_000 },
      ),
      "scenario.stress_loss_percent": {
        ...customerReportMetric(
          customerReportStressEvidenceReady && typeof result.metrics.priceChange24h === "number"
            ? tenThousandSellScenario?.estimatedDrawdownPercent
            : null,
          "evidence-complete named stress scenario unavailable",
          { min: 0, max: 100 },
        ),
        formula: tenThousandSellScenario
          ? `${stressSimulator.version}:${tenThousandSellScenario.id}:estimated_drawdown_percent`
          : null,
      },
      "holder.concentration_percent": customerReportMetric(
        result.token.tokenAddress ? result.metrics.top10HolderPercent : null,
        "address-and-scope-bound holder concentration unavailable",
        { min: 0, max: 100 },
      ),
      "evidence.claim_ledger": {
        value: customerReportEvidenceLedgerReady ? {
          state: "verified",
          claims: customerReportDecisionSections.map((section) => ({
            id: section.id,
            state: section.state,
            evidenceCount: section.evidence.length,
          })),
        } : { state: "unavailable", limitation: "durable_evidence_ledger_not_verified" },
        confidence: customerReportEvidenceLedgerReady ? customerReportCanonicalConfidence : 0,
      },
    };
    const pass2811TierSuite = buildPass2811TierSuite();
    const pass2811TierPayloadMatrix = pass2811TierSuite.profiles.map((profile) => {
      const payload = buildCustomerReportPayload({
        locale,
        tier: profile.tier,
        symbol: result.token.symbol,
        name: result.token.name,
        family: reportFamilyFromAssetClass(result.token.assetClass),
        riskScore: result.score,
        sourceFamilyCount: pass4645AnalysisReadiness.receiptProof.providerFamilyCount,
        missingEvidence: [
          result.dataQuality === "live" ? null : "live source quorum not confirmed",
          result.chart?.sevenDay?.length ? null : "OHLCV/chart payload missing",
          result.dataSources.length >= 2 ? null : "second source family missing",
          result.signals.some((signal) => signal.id === "insufficient_data") ? "insufficient data signal active" : null,
        ].filter(Boolean) as string[],
        providerConflicts: [],
        chartMode: reportChartPointCount >= 2 ? "fallback" : "unavailable",
        chartLifecycleReceipt: reportChartLifecycleReceipt,
        providerEvidenceReceipts: result.providerEvidenceReceipts,
        observedSourceLabels: result.dataSources,
        stressTestExecuted: customerReportStressEvidenceReady,
        evidenceLedgerPresent: customerReportEvidenceLedgerReady,
        advancedDeliveryMode: "automated",
        advancedAutomationVerified: profile.tier !== "Advanced" || Boolean(
          customerReportStressEvidenceReady
          && customerReportEvidenceLedgerReady
          && pass4645AnalysisReadiness.receiptProof.providerFamilyCount >= 3
        ),
        providerTimestamps: customerReportProviderTimestamps,
        decisionSections: customerReportDecisionSections,
        accountId: profile.tier === reportTier ? pass2812AccessContext.accountId : null,
        serverReceiptId: profile.tier === reportTier ? pass2812AccessContext.serverReceiptId : null,
        reportToken: profile.tier === reportTier ? pass2812AccessContext.reportToken : null,
        payloadHash: profile.tier === reportTier ? pass2812AccessContext.payloadHash : null,
        manualReviewReceiptId: profile.tier === reportTier ? pass2812AccessContext.manualReviewReceiptId : null,
        accessVerification: profile.tier === reportTier ? pass2812AccessContext.verification : undefined,
        projectUrl: pass2814ProjectUrl,
        generatedAt: result.generatedAt,
        runtimeCanonicalValues: customerReportRuntimeCanonicalValues,
      });
      return {
        tier: profile.tier,
        reportId: payload.reportId,
        pageCount: payload.pages.length,
        receiptCount: payload.receipts.length,
        visibleLaneCount: payload.tierEvidenceProfile.visibleLanes.length,
        lockedLaneCount: payload.tierEvidenceProfile.lockedLanes.length,
        chartAcceptedForTierPdf: payload.chartTierPdfGuard.acceptedForTierPdf,
        chartBlockedReasons: payload.chartTierPdfGuard.blockedReasons,
        paidEvidenceAllowed: payload.reportAccessDecision.paidEvidenceAllowed,
        accessStatus: payload.reportAccessDecision.status,
        accessBlockedReasons: payload.reportAccessDecision.blockedReasons,
        fingerprint: payload.chartManifest.evidenceFingerprint,
        payloadHash: payload.reportIntegrityVault.payloadHash,
        sourceReceiptMerkleRoot: payload.reportIntegrityVault.sourceReceiptMerkleRoot,
        integrityReleaseGate: payload.reportIntegrityVault.releaseGate,
        tierValueGate: payload.tierValueGate,
      };
    });

    const pdfPayloadV2 = buildCustomerReportPayload({
      locale,
      tier: reportTier,
      symbol: result.token.symbol,
      name: result.token.name,
      family: reportFamilyFromAssetClass(result.token.assetClass),
      riskScore: result.score,
      sourceFamilyCount: pass4645AnalysisReadiness.receiptProof.providerFamilyCount,
      missingEvidence: [
        result.dataQuality === "live" ? null : "live source quorum not confirmed",
        result.chart?.sevenDay?.length ? null : "OHLCV/chart payload missing",
        result.dataSources.length >= 2 ? null : "second source family missing",
        result.signals.some((signal) => signal.id === "insufficient_data") ? "insufficient data signal active" : null,
      ].filter(Boolean) as string[],
      providerConflicts: [],
      chartMode: reportChartPointCount >= 2 ? "fallback" : "unavailable",
      chartLifecycleReceipt: reportChartLifecycleReceipt,
      providerEvidenceReceipts: result.providerEvidenceReceipts,
      observedSourceLabels: result.dataSources,
      stressTestExecuted: customerReportStressEvidenceReady,
      evidenceLedgerPresent: customerReportEvidenceLedgerReady,
      advancedDeliveryMode: "automated",
      advancedAutomationVerified: requestedReportTier !== "Advanced" || Boolean(
        customerReportStressEvidenceReady
        && customerReportEvidenceLedgerReady
        && pass4645AnalysisReadiness.receiptProof.providerFamilyCount >= 3
      ),
      providerTimestamps: customerReportProviderTimestamps,
      decisionSections: customerReportDecisionSections,
      accountId: pass2812AccessContext.accountId,
      serverReceiptId: pass2812AccessContext.serverReceiptId,
      reportToken: pass2812AccessContext.reportToken,
      payloadHash: pass2812AccessContext.payloadHash,
      manualReviewReceiptId: pass2812AccessContext.manualReviewReceiptId,
      accessVerification: pass2812AccessContext.verification,
      projectUrl: pass2814ProjectUrl,
      generatedAt: result.generatedAt,
      runtimeCanonicalValues: customerReportRuntimeCanonicalValues,
    });
    const pass98PaidTierDeliveryDecision = buildP98CustomerPaidTierExactDeliveryDecision({
      requestedTier: requestedReportTier,
      analyzedTier: reportTier,
      payloadTier: pdfPayloadV2.tier,
      deliveryPolicy: pdfPayloadV2.deliveryPolicy,
    });
    if (requestedReportTier !== "Basic" && !pass98PaidTierDeliveryDecision.artifactCreationAllowed) {
      return NextResponse.json(
        toP98CustomerPaidTierWithheldPayload(pass98PaidTierDeliveryDecision),
        { status: 409, headers: { "cache-control": "no-store" } },
      );
    }

    const customerReportPreviewLayout = buildCustomerReportLayoutModel(pdfPayloadV2);
    let customerReportPdfToken:
      | ReturnType<typeof issuePass4818CustomerReportRenderToken>
      | Awaited<ReturnType<typeof createPass4823RealMarketsPaidAccountArtifact>>["pdfToken"];
    let accountCustomerArtifact:
      | Awaited<ReturnType<typeof createPass4823RealMarketsPaidAccountArtifact>>["accountArtifact"]
      | null = null;

    if (reportTier === "Basic") {
      // Basic remains an explicitly non-final dynamic compatibility artifact. Paid tiers must never
      // enter this payload-carrying token contract because verification rerenders the document.
      customerReportPdfToken = issuePass4818CustomerReportRenderToken({
        payload: pdfPayloadV2,
        accountId: null,
        requestedTier: "Basic",
      });
    } else {
      if (!resolvedAccount) {
        return NextResponse.json({
          mode: "error",
          error: "account_session_required_for_paid_artifact",
        }, { status: 401, headers: { "cache-control": "no-store" } });
      }
      if (pdfPayloadV2.deliveryPolicy.visibleTier !== requestedReportTier) {
        return NextResponse.json({
          mode: "withheld",
          error: "paid_tier_exact_artifact_delivery_mismatch",
          requestedReportTier,
          deliveredReportTier: pdfPayloadV2.deliveryPolicy.visibleTier,
          retryable: false,
          blocker: "exact_paid_artifact_must_match_the_explicitly_accepted_tier",
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
      try {
        const paidArtifact = await createPass4823RealMarketsPaidAccountArtifact({
          payload: pdfPayloadV2,
          accountId: resolvedAccount.accountId,
          requestedTier: reportTier,
        });
        customerReportPdfToken = paidArtifact.pdfToken;
        accountCustomerArtifact = paidArtifact.accountArtifact;
      } catch (error) {
        return NextResponse.json({
          mode: "error",
          error: "real_markets_paid_artifact_unavailable",
          detail: error instanceof Error ? error.message : "unknown",
        }, { status: 503, headers: { "cache-control": "no-store" } });
      }
    }

    return NextResponse.json({
      mode: publication.mode,
      publication,
      requestedReportTier,
      deliveredReportTier: pdfPayloadV2.deliveryPolicy.visibleTier,
      pass98PaidTierDelivery: toP98CustomerPaidTierDeliveryProjection(pass98PaidTierDeliveryDecision),
      reportType: "velmere-shield-market-integrity-evidence-bundle",
      result,
      memory,
      ledger,
      history,
      investigationPlan,
      attackSurface,
      rules,
      riskBrain,
      holderIntelligence,
      stressSimulator,
      riskReplay,
      defiLlama,
      sourceSync,
      reportEvidenceCapsule: sourceSync.pass2453,
      reportEvidenceFingerprint: sourceSync.pass2453?.canonicalEvidenceFingerprint,
      aiRiskBot,
      aiOrchestrator,
      shieldChat,
      chartRegime,
      socTerminal,
      vlmAccessLayer,
      liquidityIntelligence,
      evidenceWorkflow,
      productOpsAudit,
      terminalControlPlane,
      terminalRiskWorkspace,
      productionHardening,
      terminalUsabilityGuard,
      terminalPerformanceGuard,
      terminalOperatorCopilot,
      terminalLaunchBridge,
      terminalSourceTrust,
      terminalEvidenceExport,
      terminalRuntimeHealth,
      terminalOperatorFocus,
      terminalInteractionStability,
      terminalReviewDeck,
      pdfPayloadV2,
      customerReportPreviewLayout,
      accountCustomerArtifact,
      pdfArtifact: customerReportPdfToken.ok ? {
        available: true,
        endpoint: "/api/market-integrity/report-pdf",
        method: "POST",
        renderToken: customerReportPdfToken.token,
        expiresAt: customerReportPdfToken.expiresAt,
        ...customerReportPdfToken.artifact,
      } : {
        available: false,
        error: customerReportPdfToken.error,
      },
      pass4645AnalysisReadiness,
      pass4645ProviderEvidenceLedger,
      pass4645ProviderEvidencePersistence,
      pass2811TierSuite,
      pass2811TierPayloadMatrix,
      pass2811TierDifferentiationGate: pass2811TierSuite.gate,
      pass2812ReportAccessDecision,
      pass2812PaidTierSecuritySuite,
      pass2812PaidEvidenceRendererRule: pass2812ReportAccessDecision.rendererRule,
      pass2813VlmBrainSourcePlan: pdfPayloadV2.vlmBrainSourcePlan,
      pass2813VlmBrainClaimFirewall: pdfPayloadV2.vlmBrainClaimFirewall,
      pass2813VlmBrainAcceptanceGates: PASS2813_VLM_BRAIN_ACCEPTANCE_GATES,
      pass2813VlmBrainPdfParityRule: "Report route exposes the same VLM Brain source plan embedded inside PDF Payload V2 so UI/PDF/Angel cannot drift.",
      pass2814ReportInputFirewall,
      pass2814SourcePoisoningFirewall,
      pass2814PdfSourcePoisoningRule: "Report/PDF URLs and source text are untrusted until SSRF/source-poisoning policy, server fetch guard and source receipt hash pass.",
      pass2815ReportIntegrityVault: pdfPayloadV2.reportIntegrityVault,
      pass2815ReportIntegrityAcceptanceGates: PASS2815_REPORT_INTEGRITY_ACCEPTANCE_GATES,
      pass2815ReportIntegrityRule: "UI preview, PDF download and account delivery must share payloadHash + sourceReceiptMerkleRoot; paid replay mismatch renders locked/basic evidence only.",
      pass2816RuntimeObservabilityLedger: pdfPayloadV2.runtimeObservabilityLedger,
      pass2816RuntimeObservabilityAcceptanceGates: PASS2816_RUNTIME_OBSERVABILITY_ACCEPTANCE_GATES,
      pass2816RuntimeObservabilityRule: "Report/PDF runtime state must downgrade charts and paid evidence when source-bound data, receipt integrity or provider safety is degraded.",
      pdfPayloadAcceptanceGates: PDF_V2_ACCEPTANCE_GATES,
      legalNote: "Automated market-integrity signal. Not legal proof, not an accusation, not financial advice.",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/market-integrity/report",
      code: "report_generation_failed",
      status: 502,
    });
  }
}

export async function GET(request: Request) {
  return withExpensiveRouteBudget(request, "market_report_get", () => handleMarketReportGet(request));
}
