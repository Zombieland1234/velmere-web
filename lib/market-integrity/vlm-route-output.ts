import { buildAnalysisReadiness, premiumDepthNotReady } from "@/lib/market-integrity/analysis-readiness";
import { buildPass4643ProviderRuntimeSummary } from "@/lib/market-integrity/provider-runtime-inventory";
import { buildPublicVlmEvidencePacket } from "@/lib/ai/vlm-public-evidence-packet";
import { buildPass2281WorldclassOutputContract, detectPass2281AssetContract } from "@/lib/ai/worldclass-output-contract";
import { buildPass2282RiskPresentation, buildPass2282VisibleOutputPlan } from "@/lib/ai/live-output-audit-harness";
import { buildPass2283OutputQualityGate } from "@/lib/ai/worldclass-output-payment-qa";
import { buildPass2284LiveOutputQualityLedger } from "@/lib/ai/live-output-quality-ledger";
import { buildPass2285PremiumOutputGate } from "@/lib/ai/premium-output-gate";
import { buildPass2286WorldclassLiveOutputPaymentQa } from "@/lib/ai/worldclass-live-output-payment-qa";
import { applyPass2287RuntimeOutputFirewall } from "@/lib/ai/runtime-output-firewall";
import { buildPass2288ClaimProofFirewall } from "@/lib/ai/claim-proof-firewall";
import { buildPass2289CustomerReleaseGate } from "@/lib/ai/customer-release-gate";
import { buildPass2290ReleaseTraceLedger } from "@/lib/ai/release-trace-ledger";
import { buildPass2291ProductionReplayGate } from "@/lib/ai/production-replay-gate";
import { buildPass4651CommercialDeliveryDecision } from "@/lib/market-integrity/commercial-delivery-state";
import { securityJson } from "@/lib/security/api-guard";
import type { VlmBrainOutput, VlmDepth, VlmLocale, VlmSurface } from "@/lib/ai/vlm-brain";
import type { FullResolvedVlmAnalysis, PremiumFailFastAnalysis, ResolvedVlmAnalysis } from "@/lib/market-integrity/vlm-route-analysis";

export function buildCommercialReadiness(payload: Pick<ResolvedVlmAnalysis, "result">, depth: VlmDepth, resolvedLocale: VlmLocale) {
  const readiness = buildAnalysisReadiness(payload.result, resolvedLocale);
  const continuity = payload.result.pass4653Continuity;
  const proContinuityAllowed = continuity ? continuity.paidContinuityEligible.pro : true;
  const advancedContinuityAllowed = continuity ? continuity.paidContinuityEligible.advanced : true;
  const tiers = {
    ...readiness.tiers,
    pro: {
      ...readiness.tiers.pro,
      sellReady: readiness.tiers.pro.sellReady && proContinuityAllowed,
      reason: readiness.tiers.pro.sellReady && !proContinuityAllowed
        ? `${readiness.tiers.pro.reason},continuity_live_core_not_ready_for_pro`
        : readiness.tiers.pro.reason,
    },
    advanced: {
      ...readiness.tiers.advanced,
      sellReady: readiness.tiers.advanced.sellReady && advancedContinuityAllowed,
      reason: readiness.tiers.advanced.sellReady && !advancedContinuityAllowed
        ? `${readiness.tiers.advanced.reason},continuity_live_core_not_ready_for_advanced`
        : readiness.tiers.advanced.reason,
    },
  };
  const providerSurface = payload.result.token.assetClass && payload.result.token.assetClass !== "crypto" && payload.result.token.assetClass !== "unknown"
    ? "real_markets" as const
    : "crypto" as const;
  const providerRuntime = buildPass4643ProviderRuntimeSummary(providerSurface);
  const normalizedDepth: "basic" | "pro" | "advanced" = depth === "pro" || depth === "advanced" ? depth : "basic";
  return {
    ...readiness,
    tiers,
    requestedDepth: normalizedDepth,
    requestedTierSellReady: tiers[normalizedDepth].sellReady,
    checkoutAllowed: normalizedDepth === "basic" ? true : tiers[normalizedDepth].sellReady,
    providerRuntime,
    continuity,
    rule: "Paid Pro/Advanced checkout requires independent provider families, durable evidence, measurable tier value and the PASS4653 live-core continuity policy. Short cache-only outages may keep Pro available; Advanced always retains a live-core requirement.",
  };
}

export function buildCommercialDeliveryState(payload: Pick<ResolvedVlmAnalysis, "result" | "sourceMode">, depth: VlmDepth, commercialReadiness: ReturnType<typeof buildCommercialReadiness>, entitlementVerified: boolean, outputReady: boolean) {
  const normalizedDepth: "basic" | "pro" | "advanced" = depth === "pro" || depth === "advanced" ? depth : "basic";
  const tier = commercialReadiness.tiers[normalizedDepth];
  return buildPass4651CommercialDeliveryDecision({
    tier: normalizedDepth,
    surface: payload.sourceMode === "real_markets" ? "real_markets" : "shield",
    entitlementVerified,
    preCheckoutReady: normalizedDepth === "basic" || (tier.valueDeltaProven && tier.missingCategories.length === 0 && commercialReadiness.providerQuality.commerciallyUsable),
    analysisSellReady: tier.sellReady,
    durableEvidenceReady: normalizedDepth === "basic" || tier.durableReceiptReady,
    outputReady,
    providerDegraded: commercialReadiness.providerQuality.blockers.length > 0,
    operatorSignReady: true,
  });
}

export function buildCustomerRiskResult(payload: ResolvedVlmAnalysis, commercialReadiness: ReturnType<typeof buildCommercialReadiness>) {
  const publishNumeric = commercialReadiness.status !== "insufficient_data";
  return {
    token: payload.result.token,
    score: publishNumeric ? payload.result.score : null,
    confidence: publishNumeric ? payload.result.confidence : 0,
    level: publishNumeric ? payload.result.level : null,
    badge: publishNumeric ? payload.result.badge : "insufficient_data",
    signals: publishNumeric ? payload.result.signals.slice(0, 20) : [],
    metrics: payload.result.metrics,
    dataQuality: payload.result.dataQuality,
    dataSources: payload.result.dataSources.slice(0, 12),
    limitations: (payload.result.limitations ?? []).slice(0, 16),
    generatedAt: payload.result.generatedAt,
    metaModel: payload.result.metaModel
      ? {
          version: payload.result.metaModel.version,
          verdict: payload.result.metaModel.verdict,
          summary: payload.result.metaModel.summary,
          escalation: payload.result.metaModel.escalation,
          limitations: payload.result.metaModel.limitations?.slice(0, 12),
        }
      : null,
    continuity: payload.result.pass4653Continuity
      ? {
          mode: payload.result.pass4653Continuity.mode,
          cacheHit: payload.result.pass4653Continuity.cacheHit,
          snapshotAgeMs: payload.result.pass4653Continuity.snapshotAgeMs,
          liveReceiptCount: payload.result.pass4653Continuity.liveReceiptCount,
          replayedReceiptCount: payload.result.pass4653Continuity.replayedReceiptCount,
          paidContinuityEligible: payload.result.pass4653Continuity.paidContinuityEligible,
          blockers: payload.result.pass4653Continuity.blockers.slice(0, 8),
        }
      : null,
    customerVerdict: publishNumeric ? commercialReadiness.status : "insufficient_data" as const,
    numericVerdictPublished: publishNumeric,
  };
}

export function buildPublicKernelSummary(payload: ResolvedVlmAnalysis, commercialReadiness: ReturnType<typeof buildCommercialReadiness>) {
  if (payload.premiumFailFast || !payload.kernel) return null;
  const numericVerdictPublished = commercialReadiness.status !== "insufficient_data";
  return {
    schemaVersion: payload.kernel.schemaVersion,
    generatedAt: payload.kernel.generatedAt,
    surface: payload.kernel.surface,
    depth: payload.kernel.depth,
    locale: payload.kernel.locale,
    status: payload.kernel.status,
    confidence: numericVerdictPublished ? payload.kernel.confidence : 0,
    confidenceCap: numericVerdictPublished ? payload.kernel.confidenceCap : 0,
    sourceCount: payload.kernel.sourceCount,
    sourceFamilies: payload.kernel.sourceFamilies,
    headline: payload.kernel.headline,
    summary: payload.kernel.summary,
    findings: payload.kernel.findings.slice(0, 8).map((finding) => ({
      id: finding.id,
      title: finding.title,
      body: finding.body,
      severity: finding.severity,
      confidence: numericVerdictPublished ? finding.confidence : 0,
      evidenceIds: finding.evidenceIds.slice(0, 8),
    })),
    missingData: payload.kernel.missingData.slice(0, 12),
    nextActions: payload.kernel.nextActions.slice(0, 8),
    numericVerdictPublished,
  };
}

export function buildPublicCustomerNarrative(
  commercialReadiness: ReturnType<typeof buildCommercialReadiness>,
  resolvedLocale: VlmLocale,
  original: string,
) {
  if (commercialReadiness.status !== "insufficient_data") return original;
  if (resolvedLocale === "de") {
    return "Kein numerischer Risikowert wird veröffentlicht. Unabhängige Live-Quellen und das erforderliche Evidenzquorum fehlen; der Output bleibt ein kostenloser, vorsichtiger Prescreen.";
  }
  if (resolvedLocale === "en") {
    return "No numeric risk score is published. Independent live sources and the required evidence quorum are missing, so this output remains a free, cautious prescreen.";
  }
  return "Liczbowy wynik ryzyka nie jest publikowany. Brakuje niezależnych źródeł live i wymaganego kworum dowodów, dlatego wynik pozostaje darmowym, ostrożnym prescreeningiem.";
}

export function buildPublicAiSummary(
  payload: FullResolvedVlmAnalysis,
  commercialReadiness: ReturnType<typeof buildCommercialReadiness>,
  customerNarrative: string,
  resolvedLocale: VlmLocale,
) {
  const output = payload?.ai?.output || {
    schemaVersion: "vlm-brain-output-v1",
    generatedAt: new Date().toISOString(),
    locale: resolvedLocale,
    depth: payload?.ai?.depth || "basic",
    providerMode: "heuristic",
    asset: payload?.result?.token || { symbol: "ASSET", name: "Asset" },
    verdict: "review",
    headline: "Automated Evidence Review",
    summary: payload?.result?.aiSummary || payload?.result?.metaModel?.summary || "Analysis ready",
    confidence: 0,
    facts: [],
    keyFindings: [],
    contradictions: [],
    missingData: [],
    nextChecks: [],
    sources: [],
    report: null,
    diagnostics: {},
  };
  const numericVerdictPublished = commercialReadiness.status !== "insufficient_data";
  return {
    version: payload.ai.version,
    mode: payload.ai.mode,
    surface: payload.ai.surface,
    depth: payload.ai.depth,
    locale: payload.ai.locale,
    model: payload.ai.model,
    traceId: payload.ai.traceId,
    generatedAt: payload.ai.generatedAt,
    durationMs: payload.ai.durationMs,
    attempts: payload.ai.attempts,
    output: {
      schemaVersion: output.schemaVersion,
      generatedAt: output.generatedAt,
      locale: output.locale,
      depth: output.depth,
      providerMode: output.providerMode,
      asset: output.asset,
      verdict: numericVerdictPublished ? output.verdict : "review",
      headline: output.headline,
      summary: output.summary,
      confidence: numericVerdictPublished ? output.confidence : 0,
      facts: output.facts
        .filter((fact: VlmBrainOutput["facts"][number]) => numericVerdictPublished || fact.id !== "risk-score")
        .slice(0, 16),
      keyFindings: output.keyFindings.slice(0, 12).map((finding: VlmBrainOutput["keyFindings"][number]) => ({
        ...finding,
        confidence: numericVerdictPublished ? finding.confidence : 0,
      })),
      contradictions: output.contradictions.slice(0, 12),
      missingData: output.missingData.slice(0, 16),
      nextChecks: output.nextChecks.slice(0, 12),
      sources: output.sources.slice(0, 12),
      report: output.report,
      diagnostics: {
        fallbackReason: output.diagnostics?.fallbackReason,
        sourceCount: output.diagnostics?.sourceCount,
        missingDataCount: output.diagnostics?.missingDataCount,
        verdictGovernorStatus: output.diagnostics?.verdictGovernorStatus,
        missingProofLanes: output.diagnostics?.missingProofLanes,
        numericVerdictPublished,
      },
    },
    customerNarrative: buildPublicCustomerNarrative(commercialReadiness, resolvedLocale, customerNarrative),
    numericVerdictPublished,
  };
}

export function buildPublicCommercialReadiness(commercialReadiness: ReturnType<typeof buildCommercialReadiness>) {
  const valueContracts = {
    basic: {
      role: "free_source_bound_prescreen",
      customerDeliverables: [
        "canonical asset identity",
        "current market snapshot when independently confirmed",
        "source and confidence disclosure",
        "missing-proof map and next safe check",
      ],
      exclusiveEvidenceLanes: ["identity", "market"],
      purchasePromise: "No payment is required; no numerical verdict is published without corroborated evidence.",
    },
    pro: {
      role: "paid_execution_and_structure_analysis",
      customerDeliverables: [
        "independent-provider conflict analysis",
        "history and volatility context",
        "liquidity, spread, depth or execution-risk evidence",
        "holders, ownership or fundamentals lane appropriate to the asset",
        "durable signed evidence receipt",
      ],
      exclusiveEvidenceLanes: ["liquidity", "history_volatility", "holders_ownership", "fundamentals_filings"],
      purchasePromise: "Pro is released only when it adds measurable evidence beyond Basic and its receipt survives durable read-back.",
    },
    advanced: {
      role: "institutional_stress_and_dependency_analysis",
      customerDeliverables: [
        "cross-venue microstructure or derivatives evidence",
        "scenario, stress and dependency analysis",
        "contract-permission or supply-tokenomics proof when applicable",
        "single-provider-family outage resilience",
        "operator-review escalation for high-impact uncertainty",
      ],
      exclusiveEvidenceLanes: ["derivatives_microstructure", "scenario_dependency", "contract_permissions", "supply_tokenomics"],
      purchasePromise: "Advanced is released only when it remains evidence-complete after losing any one provider family and proves a unique delta over Pro.",
    },
  } as const;
  const tier = (depth: keyof typeof valueContracts, value: (typeof commercialReadiness.tiers)[keyof typeof commercialReadiness.tiers]) => ({
    sellReady: value.sellReady,
    valueDeltaProven: value.valueDeltaProven,
    durableReceiptReady: value.durableReceiptReady,
    minimumSources: value.minimumSources,
    minimumSourceFamilies: value.minimumSourceFamilies,
    minimumConfidence: value.minimumConfidence,
    minimumEvidenceCategories: value.minimumEvidenceCategories,
    minimumUniqueEvidenceDelta: value.minimumUniqueEvidenceDelta,
    missingCategories: value.missingCategories,
    reason: value.reason,
    valueContract: valueContracts[depth],
  });
  return {
    schemaVersion: commercialReadiness.schemaVersion,
    status: commercialReadiness.status,
    requestedDepth: commercialReadiness.requestedDepth,
    requestedTierSellReady: commercialReadiness.requestedTierSellReady,
    checkoutAllowed: commercialReadiness.checkoutAllowed,
    riskScore: commercialReadiness.riskScore,
    confidencePercent: commercialReadiness.confidencePercent,
    sourceCount: commercialReadiness.sourceCount,
    sourceFamilyCount: commercialReadiness.sourceFamilyCount,
    verifiedReceiptCount: commercialReadiness.verifiedReceiptCount,
    evidenceCategoryCount: commercialReadiness.evidenceCategoryCount,
    corroboratedCategoryCount: commercialReadiness.corroboratedCategoryCount,
    customerMessage: commercialReadiness.customerMessage,
    missingProof: commercialReadiness.missingProof.slice(0, 12),
    tiers: {
      basic: tier("basic", commercialReadiness.tiers.basic),
      pro: tier("pro", commercialReadiness.tiers.pro),
      advanced: tier("advanced", commercialReadiness.tiers.advanced),
    },
    continuity: commercialReadiness.continuity
      ? {
          mode: commercialReadiness.continuity.mode,
          cacheHit: commercialReadiness.continuity.cacheHit,
          snapshotAgeMs: commercialReadiness.continuity.snapshotAgeMs,
          paidContinuityEligible: commercialReadiness.continuity.paidContinuityEligible,
          blockers: commercialReadiness.continuity.blockers.slice(0, 8),
        }
      : null,
    rule: commercialReadiness.rule,
  };
}

export function premiumNotReadyResponse(payload: FullResolvedVlmAnalysis, depth: VlmDepth, resolvedLocale: VlmLocale, entitlementVerified: boolean) {
  const commercialReadiness = buildCommercialReadiness(payload, depth, resolvedLocale);
  if (!premiumDepthNotReady(commercialReadiness, depth)) return null;
  return securityJson({
    mode: "limited",
    error: "premium_analysis_not_ready",
    sourceMode: payload.sourceMode,
    result: buildCustomerRiskResult(payload, commercialReadiness),
    publicRiskScore: commercialReadiness.riskScore,
    kernel: buildPublicKernelSummary(payload, commercialReadiness),
    commercialReadiness: buildPublicCommercialReadiness(commercialReadiness),
    commercialDelivery: buildCommercialDeliveryState(payload, depth, commercialReadiness, entitlementVerified, false),
    basicFallbackAvailable: true,
    premiumFailFast: payload.premiumFailFast,
    customerMessage: commercialReadiness.customerMessage,
  }, { status: 422 });
}

export function premiumFailFastResponse(payload: PremiumFailFastAnalysis, depth: VlmDepth, resolvedLocale: VlmLocale, entitlementVerified: boolean) {
  const commercialReadiness = buildCommercialReadiness(payload, depth, resolvedLocale);
  return securityJson({
    mode: "limited",
    error: "premium_analysis_not_ready",
    sourceMode: payload.sourceMode,
    result: buildCustomerRiskResult(payload, commercialReadiness),
    publicRiskScore: commercialReadiness.riskScore,
    kernel: null,
    commercialReadiness: buildPublicCommercialReadiness(commercialReadiness),
    commercialDelivery: buildCommercialDeliveryState(payload, depth, commercialReadiness, entitlementVerified, false),
    basicFallbackAvailable: true,
    premiumFailFast: true,
    failFastStage: payload.failFastStage,
    customerMessage: commercialReadiness.customerMessage,
  }, { status: 422 });
}

export function safeVlmReasons(payload: FullResolvedVlmAnalysis) {
  const reasons = (payload.result as { reasons?: unknown }).reasons;
  if (Array.isArray(reasons)) return reasons.map((reason) => String(reason)).filter(Boolean);
  const limitations = Array.isArray(payload.result.limitations) ? payload.result.limitations : [];
  const sources = Array.isArray(payload.result.dataSources) ? payload.result.dataSources : [];
  return [
    ...limitations.slice(0, 8).map((item: unknown) => `missing:${String(item)}`),
    ...sources.slice(0, 8).map((item: unknown) => `source:${String(item)}`),
  ];
}

export function safeVlmCustomerOutput(payload: FullResolvedVlmAnalysis) {
  const aiOutput = payload?.ai?.output || payload?.result?.aiSummary || payload?.result?.metaModel?.summary || "";
  return `${aiOutput} ${safeVlmReasons(payload).join(" ")}`.trim();
}

export function buildPublicEvidencePacket(
  payload: FullResolvedVlmAnalysis,
  binding: { query: string; depth: VlmDepth; surface: VlmSurface; requestId?: string | null },
) {
  const packet = buildPublicVlmEvidencePacket(payload.ai);
  return {
    ...packet,
    requestBinding: {
      ...(binding.requestId ? { requestId: binding.requestId } : {}),
      query: binding.query.trim(),
      depth: binding.depth,
      surface: binding.surface,
      issuedAt: new Date().toISOString(),
    },
  };
}

export function buildPass2281OutputQuality(payload: FullResolvedVlmAnalysis, depth: VlmDepth) {
  const contract = buildPass2281WorldclassOutputContract();
  const assetContract = detectPass2281AssetContract(`${payload.result.token.symbol} ${payload.result.token.name} ${payload.result.token.assetClass ?? ""}`);
  return {
    schemaVersion: contract.schemaVersion,
    depth,
    advancedAuditPriceEur: contract.tierPricesEur.advanced,
    advancedPaid: depth === "advanced",
    assetFamily: assetContract?.family ?? payload.result.token.assetClass ?? "unknown",
    notApplicableWithoutScope: assetContract?.notApplicableWithoutScope ?? [],
    sourceGapRule: assetContract?.sourceGapRule ?? "Missing sources cap confidence before stronger public claims.",
    scoreVsConfidence: "risk score is review priority; confidence cap is source coverage; missing source is a visible gap",
    paymentRule: contract.paymentRule,
  };
}

export function buildPass2282OutputAudit(payload: FullResolvedVlmAnalysis, depth: VlmDepth) {
  const confirmedSources = Array.isArray(payload.result.dataSources) ? payload.result.dataSources : [];
  const missingLanes = Array.isArray(payload.result.limitations) ? payload.result.limitations.slice(0, 8) : [];
  const assetText = `${payload.result.token.symbol} ${payload.result.token.name} ${payload.result.token.assetClass ?? ""}`;
  const plan = buildPass2282VisibleOutputPlan({ depth, assetText, confirmedSources });
  const risk = buildPass2282RiskPresentation({
    symbol: payload.result.token.symbol,
    assetClass: payload.result.token.assetClass ?? null,
    rawScore: payload.result.score,
    confidenceCap: Math.round((payload.result.confidence ?? 0) * 100),
    confirmedSources,
    missingLanes,
  });
  return {
    ...plan,
    riskPresentation: risk,
    scoreVsConfidence: "PASS2282: show risk score vs confidence clearly: risk score is review priority and confidence is source coverage; missing source lanes must be visible before verdict.",
  };
}

export function buildPass2283OutputGate(payload: FullResolvedVlmAnalysis, depth: VlmDepth, paidAccessVerified = false) {
  const confirmedSources = Array.isArray(payload.result.dataSources) ? payload.result.dataSources : [];
  const missingLanes = Array.isArray(payload.result.limitations) ? payload.result.limitations.slice(0, 10) : [];
  const assetText = `${payload.result.token.symbol} ${payload.result.token.name} ${payload.result.token.assetClass ?? ""}`;
  return buildPass2283OutputQualityGate({
    surface: payload.sourceMode === "real_markets" ? "real_markets" : "shield",
    depth,
    assetText,
    confirmedSources,
    missingLanes,
    rawScore: payload.result.score,
    paidAccessVerified,
  });
}


export function buildPass2284OutputLedger(payload: FullResolvedVlmAnalysis, depth: VlmDepth, paidAccessVerified = false) {
  const confirmedSources = Array.isArray(payload.result.dataSources) ? payload.result.dataSources : [];
  const missingLanes = Array.isArray(payload.result.limitations) ? payload.result.limitations.slice(0, 12) : [];
  const assetText = `${payload.result.token.symbol} ${payload.result.token.name} ${payload.result.token.assetClass ?? ""}`;
  return buildPass2284LiveOutputQualityLedger({
    surface: payload.sourceMode === "real_markets" ? "real_markets" : "shield",
    depth,
    assetText,
    confirmedSources,
    missingLanes,
    rawScore: payload.result.score,
    confidenceCap: Math.round((payload.result.confidence ?? 0) * 100),
    paidAccessVerified,
    customerOutputText: safeVlmCustomerOutput(payload),
  });
}

export function buildPass2285OutputGate(payload: FullResolvedVlmAnalysis, depth: VlmDepth, paidAccessVerified = false) {
  const confirmedSources = Array.isArray(payload.result.dataSources) ? payload.result.dataSources : [];
  const missingLanes = Array.isArray(payload.result.limitations) ? payload.result.limitations.slice(0, 12) : [];
  const assetText = `${payload.result.token.symbol} ${payload.result.token.name} ${payload.result.token.assetClass ?? ""}`;
  return buildPass2285PremiumOutputGate({
    surface: payload.sourceMode === "real_markets" ? "real_markets" : "shield",
    depth,
    assetText,
    confirmedSources,
    missingLanes,
    rawScore: payload.result.score,
    confidenceCap: Math.round((payload.result.confidence ?? 0) * 100),
    paidAccessVerified,
    customerOutputText: safeVlmCustomerOutput(payload),
  });
}

export function buildPass2286OutputQa(payload: FullResolvedVlmAnalysis, depth: VlmDepth, paidAccessVerified = false) {
  const confirmedSources = Array.isArray(payload.result.dataSources) ? payload.result.dataSources : [];
  const missingLanes = Array.isArray(payload.result.limitations) ? payload.result.limitations.slice(0, 14) : [];
  const assetText = `${payload.result.token.symbol} ${payload.result.token.name} ${payload.result.token.assetClass ?? ""}`;
  return buildPass2286WorldclassLiveOutputPaymentQa({
    surface: payload.sourceMode === "real_markets" ? "real_markets" : "shield",
    depth,
    assetText,
    confirmedSources,
    missingLanes,
    rawScore: payload.result.score,
    confidenceCap: Math.round((payload.result.confidence ?? 0) * 100),
    paidAccessVerified,
    customerOutputText: safeVlmCustomerOutput(payload),
  });
}


export function buildPass2287RuntimeOutputFirewall(payload: FullResolvedVlmAnalysis, depth: VlmDepth, paidAccessVerified = false, resolvedLocale: VlmLocale = "pl") {
  const confirmedSources = Array.isArray(payload.result.dataSources) ? payload.result.dataSources : [];
  const missingLanes = Array.isArray(payload.result.limitations) ? payload.result.limitations.slice(0, 16) : [];
  const assetText = `${payload.result.token.symbol} ${payload.result.token.name} ${payload.result.token.assetClass ?? ""}`;
  return applyPass2287RuntimeOutputFirewall({
    locale: resolvedLocale,
    surface: payload.sourceMode === "real_markets" ? "real_markets" : "shield",
    depth,
    assetText,
    confirmedSources,
    missingLanes,
    rawScore: payload.result.score,
    confidenceCap: Math.round((payload.result.confidence ?? 0) * 100),
    paidAccessVerified,
    customerOutputText: safeVlmCustomerOutput(payload),
  });
}

export function buildPass2288ClaimProofFirewallOutput(payload: FullResolvedVlmAnalysis, depth: VlmDepth, paidAccessVerified = false, resolvedLocale: VlmLocale = "pl", customerOutputText?: string) {
  const confirmedSources = Array.isArray(payload.result.dataSources) ? payload.result.dataSources : [];
  const missingLanes = Array.isArray(payload.result.limitations) ? payload.result.limitations.slice(0, 18) : [];
  const assetText = `${payload.result.token.symbol} ${payload.result.token.name} ${payload.result.token.assetClass ?? ""}`;
  return buildPass2288ClaimProofFirewall({
    locale: resolvedLocale,
    surface: payload.sourceMode === "real_markets" ? "real_markets" : "shield",
    depth,
    assetText,
    confirmedSources,
    missingLanes,
    rawScore: payload.result.score,
    confidenceCap: Math.round((payload.result.confidence ?? 0) * 100),
    paidAccessVerified,
    customerOutputText: customerOutputText ?? safeVlmCustomerOutput(payload),
  });
}

export function buildPass2289CustomerReleaseGateOutput(payload: FullResolvedVlmAnalysis, depth: VlmDepth, paidAccessVerified = false, resolvedLocale: VlmLocale = "pl", customerOutputText?: string) {
  const confirmedSources = Array.isArray(payload.result.dataSources) ? payload.result.dataSources : [];
  const missingLanes = Array.isArray(payload.result.limitations) ? payload.result.limitations.slice(0, 20) : [];
  const assetText = `${payload.result.token.symbol} ${payload.result.token.name} ${payload.result.token.assetClass ?? ""}`;
  return buildPass2289CustomerReleaseGate({
    locale: resolvedLocale,
    surface: payload.sourceMode === "real_markets" ? "real_markets" : "shield",
    depth,
    assetText,
    confirmedSources,
    missingLanes,
    rawScore: payload.result.score,
    confidenceCap: Math.round((payload.result.confidence ?? 0) * 100),
    paidAccessVerified,
    customerOutputText: customerOutputText ?? safeVlmCustomerOutput(payload),
  });
}

export function buildPass2290ReleaseTraceLedgerOutput(payload: FullResolvedVlmAnalysis, depth: VlmDepth, paidAccessVerified = false, resolvedLocale: VlmLocale = "pl", customerOutputText?: string, upstreamGate?: ReturnType<typeof buildPass2289CustomerReleaseGate>) {
  const confirmedSources = Array.isArray(payload.result.dataSources) ? payload.result.dataSources : [];
  const missingLanes = Array.isArray(payload.result.limitations) ? payload.result.limitations.slice(0, 22) : [];
  const assetText = `${payload.result.token.symbol} ${payload.result.token.name} ${payload.result.token.assetClass ?? ""}`;
  return buildPass2290ReleaseTraceLedger({
    locale: resolvedLocale,
    surface: payload.sourceMode === "real_markets" ? "real_markets" : "shield",
    depth,
    assetText,
    confirmedSources,
    missingLanes,
    rawScore: payload.result.score,
    confidenceCap: Math.round((payload.result.confidence ?? 0) * 100),
    paidAccessVerified,
    customerOutputText: customerOutputText ?? safeVlmCustomerOutput(payload),
    upstreamGate,
  });
}


export function buildPass2291ProductionReplayGateOutput(payload: FullResolvedVlmAnalysis, depth: VlmDepth, paidAccessVerified = false, resolvedLocale: VlmLocale = "pl", customerOutputText?: string, upstreamLedger?: ReturnType<typeof buildPass2290ReleaseTraceLedger>) {
  const confirmedSources = Array.isArray(payload.result.dataSources) ? payload.result.dataSources : [];
  const missingLanes = Array.isArray(payload.result.limitations) ? payload.result.limitations.slice(0, 24) : [];
  const assetText = `${payload.result.token.symbol} ${payload.result.token.name} ${payload.result.token.assetClass ?? ""}`;
  return buildPass2291ProductionReplayGate({
    locale: resolvedLocale,
    surface: payload.sourceMode === "real_markets" ? "real_markets" : "shield",
    depth,
    assetText,
    confirmedSources,
    missingLanes,
    rawScore: payload.result.score,
    confidenceCap: Math.round((payload.result.confidence ?? 0) * 100),
    paidAccessVerified,
    customerOutputText: customerOutputText ?? safeVlmCustomerOutput(payload),
    upstreamLedger,
  });
}

export function buildPass2318RiskConfidenceSeparation(payload: FullResolvedVlmAnalysis, depth: VlmDepth, surface: VlmSurface) {
  const confidencePercent = Math.round((payload.result.confidence ?? 0) * 100);
  const missingLanes = Array.isArray(payload.result.limitations) ? payload.result.limitations.slice(0, 12) : [];
  const confirmedSources = Array.isArray(payload.result.dataSources) ? payload.result.dataSources : [];
  const assetClass = payload.result.token.assetClass ?? "unknown";
  const staticSourceGapScore = payload.result.score >= 30 && payload.result.score <= 45 && confidencePercent <= 42;
  return {
    schemaVersion: "pass2318_risk_confidence_separation_v1",
    requestedSurface: surface,
    resolvedSourceMode: payload.sourceMode,
    depth,
    asset: {
      symbol: payload.result.token.symbol,
      name: payload.result.token.name,
      assetClass,
    },
    riskScore: payload.result.score,
    dataConfidencePercent: confidencePercent,
    confirmedSources,
    missingLanes,
    publicCopyRule: "Show risk score as review priority and confidence as source coverage. A low confidence cap is not the same thing as a proven danger verdict.",
    staticSourceGapScore,
    realMarketsCryptoRouting: payload.sourceMode === "real_markets" && assetClass === "crypto"
      ? "crypto symbol resolved through Real Markets quote/chart lane; holder, DEX, depth and contract lanes stay visibly missing until attached"
      : "not a Real Markets crypto lane",
    batchAuditAdvice: {
      vlmLimitPerMinute: 36,
      pdfLimitPerMinute: 12,
      rule: "Large 200+ asset audits need queue/cache/job runner instead of firing every VLM/PDF route in one browser minute.",
    },
  };
}
