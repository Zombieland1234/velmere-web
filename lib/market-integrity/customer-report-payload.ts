import {
  BASIC_PRO_ADVANCED_BOUNDARY,
  buildMethodologySummary,
  buildChartLifecycleReceipt,
  buildPdfChartLifecycleDecision,
  formatDecimalPercent,
  type ChartLifecycleReceipt,
  type VelmereTier,
} from "@/lib/market-integrity/top1-risk-foundation";
import {
  buildChartTierPdfGuard,
  buildPass2811TierSuite,
  buildTierEvidenceProfile,
} from "@/lib/market-integrity/top1-tier-differentiation";
import {
  buildPass2812PaymentEntitlementBoundary,
  buildPass2812PaymentEntitlementBoundaryV2,
  buildReportAccessDecision,
  buildReportTokenPolicy,
  type AdvancedDeliveryMode,
} from "@/lib/market-integrity/top1-entitlement-report-access";
import {
  buildPass2813VlmBrainClaimFirewall,
  buildPass2813VlmBrainSourcePlan,
} from "@/lib/market-integrity/top1-vlm-brain-source-router";
import { buildPass2814SourcePoisoningFirewall } from "@/lib/market-integrity/top1-source-poisoning-ssrf-firewall";
import { buildPass2815ReportIntegrityVault } from "@/lib/market-integrity/top1-report-integrity-vault";
import { buildPass2816RuntimeObservabilityLedger } from "@/lib/market-integrity/top1-runtime-observability-ledger";
import { buildCustomerReportDeliveryPolicy, isTierVisible } from "@/lib/market-integrity/customer-report-delivery-policy";
import { buildCustomerReportSourceBinding } from "@/lib/market-integrity/customer-report-source-binding";
import { buildCustomerReportTierValueGate } from "@/lib/market-integrity/customer-report-tier-value";
import type { Pass4644ProviderEvidenceReceipt } from "@/lib/market-integrity/provider-evidence-receipt";
import {
  buildPass4825CustomerReportFieldContract,
  type Pass4825RuntimeFieldValue,
} from "@/lib/reporting/runtime-canonical-field-adapter";
import { buildPass6CommercialFieldCompletenessReceipt } from "@/lib/reporting/commercial-field-completeness";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  buildWorldclassReportCommercialEnvelope,
  type ReportCoverageInput,
  type VelmereReportSurface,
} from "@/lib/market-integrity/worldclass-report-commercial-policy";

export type { VelmereReportAssetFamily } from "@/lib/market-integrity/report-asset-family";
import type { VelmereReportAssetFamily } from "@/lib/market-integrity/report-asset-family";

export const PDF_V2_ACCEPTANCE_GATES = [
  "Customer report payload keeps Basic/Pro/Advanced evidence boundaries explicit.",
  "Paid evidence requires server entitlement, account binding, token binding and payload-hash parity.",
  "Missing evidence and provider conflicts lower confidence and remain visible.",
  "Charts render only from source-bound lifecycle receipts; otherwise a neutral unavailable state is returned.",
  "Source URLs and provider text remain behind SSRF/source-poisoning policy.",
  "Customer runtime exposes only product evidence, integrity and observability; historical release proof stays offline.",
] as const;

export type CustomerReportDecisionSection = {
  id: string;
  title: string;
  minimumTier: VelmereTier;
  state: "ready" | "watch" | "blocked" | "missing";
  summary: string;
  evidence: string[];
  actions: string[];
};

const CUSTOMER_REPORT_PAGES = [
  { page: 1, title: "Executive risk summary", requiredForTier: "Basic" },
  { page: 2, title: "Asset identity and market context", requiredForTier: "Basic" },
  { page: 3, title: "Risk drivers and evidence", requiredForTier: "Basic" },
  { page: 4, title: "Chart lifecycle and source status", requiredForTier: "Basic" },
  { page: 5, title: "Liquidity and holder intelligence", requiredForTier: "Pro" },
  { page: 6, title: "Scenario and replay analysis", requiredForTier: "Pro" },
  { page: 7, title: "Provider receipts and conflicts", requiredForTier: "Pro" },
  { page: 8, title: "Missing evidence", requiredForTier: "Basic" },
  { page: 9, title: "Manual QA and next checks", requiredForTier: "Advanced" },
  { page: 10, title: "Methodology and source registry", requiredForTier: "Pro" },
] as const;

function reportIdFor(symbol: string, generatedAt: string): string {
  const clean = symbol.replace(/[^a-z0-9]/gi, "").toUpperCase() || "ASSET";
  return `VLM-${clean}-${generatedAt.slice(0, 10).replaceAll("-", "")}-CUSTOMER`;
}

export function buildCustomerReportPayload(args: {
  locale: "pl" | "en" | "de";
  tier: VelmereTier;
  symbol: string;
  name: string;
  family: VelmereReportAssetFamily;
  riskScore: number;
  sourceFamilyCount: number;
  missingEvidence: string[];
  providerConflicts?: string[];
  chartMode?: "live_ohlcv" | "fallback" | "unavailable";
  chartLifecycleReceipt?: ChartLifecycleReceipt;
  /** Deprecated static allow-list. PASS4818 only counts observed, content-bound provider receipts. */
  sourceIds?: string[];
  providerEvidenceReceipts?: Pass4644ProviderEvidenceReceipt[] | null;
  observedSourceLabels?: string[] | null;
  /** Exact canonical target required before PASS4993 may project provider evidence into a customer report. */
  expectedCanonicalIdentity?: string | null;
  accountId?: string | null;
  serverReceiptId?: string | null;
  reportToken?: string | null;
  payloadHash?: string | null;
  manualReviewReceiptId?: string | null;
  accessVerification?: {
    accountBound: boolean;
    serverReceiptVerified: boolean;
    reportTokenVerified: boolean;
    payloadHashBound: boolean;
    manualReviewVerified?: boolean;
    source: "server_entitlement" | "trusted_internal" | "diagnostic_only";
  };
  advancedDeliveryMode?: AdvancedDeliveryMode;
  advancedAutomationVerified?: boolean;
  projectUrl?: string | null;
  generatedAt?: string;
  reportSurface?: VelmereReportSurface;
  coverageInput?: ReportCoverageInput;
  missingCriticalEvidence?: number;
  stressTestExecuted?: boolean;
  evidenceLedgerPresent?: boolean;
  executedTests?: string[];
  unexecutedTests?: string[];
  providerTimestamps?: string[];
  chainId?: string | null;
  contractAddress?: string | null;
  blockNumber?: number | null;
  dataWindow?: string;
  decisionSections?: CustomerReportDecisionSection[];
  runtimeCanonicalValues?: Readonly<Record<string, Pass4825RuntimeFieldValue | undefined>>;
}) {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const advancedDeliveryMode = args.advancedDeliveryMode ?? "manual_review";
  const providerConflicts = args.providerConflicts ?? [];
  const expectedCanonicalIdentity = String(args.expectedCanonicalIdentity ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:.^=\-_/]+/g, "");
  const sourceBinding = buildCustomerReportSourceBinding({
    providerEvidenceReceipts: args.providerEvidenceReceipts,
    observedSourceLabels: args.observedSourceLabels,
    generatedAt,
    expectedCanonicalIdentity,
  });
  const declaredSourceFamilyCount = Math.max(0, Math.trunc(args.sourceFamilyCount));
  const effectiveSourceFamilyCount = sourceBinding.independentContentBoundUpstreamCount;
  const sourceCountMismatch = declaredSourceFamilyCount !== effectiveSourceFamilyCount;
  const sourceBindingMissingEvidence = [
    ...args.missingEvidence,
    ...sourceBinding.blockers.map((blocker) => `source binding: ${blocker}`),
    sourceCountMismatch
      ? `declared source-family count ${declaredSourceFamilyCount} does not match content-bound count ${effectiveSourceFamilyCount}`
      : null,
  ].filter((value): value is string => Boolean(value));
  const methodology = buildMethodologySummary({
    riskScore: args.riskScore,
    sourceFamilyCount: effectiveSourceFamilyCount,
    missingEvidenceCount: sourceBindingMissingEvidence.length,
    providerConflictCount: providerConflicts.length,
  });
  const sourceLimit = args.tier === "Basic" ? 3 : args.tier === "Pro" ? 7 : Number.MAX_SAFE_INTEGER;
  const allowedSourceIds = args.sourceIds?.length ? new Set(args.sourceIds) : null;
  const receipts = sourceBinding.receipts
    .filter((receipt) => !allowedSourceIds || allowedSourceIds.has(receipt.registrySourceId ?? ""))
    .slice(0, sourceLimit);
  const fallbackLifecycle = buildChartLifecycleReceipt({
    state: args.chartMode === "live_ohlcv" || args.chartMode === "fallback" ? "source_bound" : "unavailable_skeleton",
    sourceLabel: receipts.map((receipt) => receipt.provider).slice(0, 3).join(" + ") || "source pending",
    timeframeLabel: "1h / 4h / 1d / 1w / 1m depending tier",
    lastUpdatedLabel: generatedAt,
    candleCount: args.chartMode === "live_ohlcv" || args.chartMode === "fallback" ? 2 : 0,
    confidenceScore: methodology.confidenceScore,
  });
  const lifecycleReceipt = args.chartLifecycleReceipt ?? fallbackLifecycle;
  const pdfRenderDecision = buildPdfChartLifecycleDecision(lifecycleReceipt);
  const provisionalPayloadHash = [
    args.symbol,
    args.tier,
    generatedAt,
    receipts.map((receipt) => receipt.payloadDigest ?? receipt.receiptId).join(","),
    sourceBindingMissingEvidence.length,
    providerConflicts.length,
    lifecycleReceipt.state,
    lifecycleReceipt.candleCount,
  ].join(":");
  const reportAccessDecision = buildReportAccessDecision({
    tier: args.tier,
    accountId: args.accountId,
    serverReceiptId: args.serverReceiptId,
    reportToken: args.reportToken,
    payloadHash: args.payloadHash ?? provisionalPayloadHash,
    manualReviewReceiptId: args.manualReviewReceiptId,
    manualReviewRequired: advancedDeliveryMode === "manual_review",
    advancedDeliveryMode,
    verification: args.accessVerification,
  });
  const vlmBrainSourcePlan = buildPass2813VlmBrainSourcePlan({
    assetFamily: args.family,
    tier: args.tier,
    sourceFamilyCount: effectiveSourceFamilyCount,
    missingEvidenceCount: sourceBindingMissingEvidence.length,
    providerConflictCount: providerConflicts.length,
    chartSourceBound: pdfRenderDecision.acceptedForPdf,
    paidEvidenceAllowed: reportAccessDecision.paidEvidenceAllowed,
    manualReviewPresent: Boolean(args.manualReviewReceiptId),
  });
  const vlmBrainClaimFirewall = buildPass2813VlmBrainClaimFirewall(vlmBrainSourcePlan);
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
  const defaultExecutedTests = [
    sourceBinding.contentBoundReceiptCount > 0 ? "source_binding" : null,
    effectiveSourceFamilyCount >= 2 ? "source_quorum" : null,
    receipts.some((receipt) => receipt.evidenceState === "content_bound") ? "freshness" : null,
    "chart_lifecycle",
    args.stressTestExecuted === true ? "stress_scenarios" : null,
    args.evidenceLedgerPresent === true && sourceBinding.evidenceLedgerEligible ? "evidence_ledger" : null,
    args.tier === "Advanced" && advancedDeliveryMode === "manual_review" && args.accessVerification?.manualReviewVerified === true ? "manual_review" : null,
    args.tier === "Advanced" && advancedDeliveryMode === "automated" && args.advancedAutomationVerified === true ? "advanced_automation" : null,
  ].filter((value): value is string => Boolean(value));
  const defaultUnexecutedTests = [
    effectiveSourceFamilyCount < 2 ? "source_quorum" : null,
    receipts.some((receipt) => receipt.evidenceState === "content_bound") ? null : "freshness",
    args.stressTestExecuted === true ? null : "stress_scenarios",
    args.evidenceLedgerPresent === true && sourceBinding.evidenceLedgerEligible ? null : "evidence_ledger",
    args.tier === "Advanced" && advancedDeliveryMode === "manual_review" && args.accessVerification?.manualReviewVerified !== true ? "manual_review" : null,
    args.tier === "Advanced" && advancedDeliveryMode === "automated" && args.advancedAutomationVerified !== true ? "advanced_automation" : null,
  ].filter((value): value is string => Boolean(value));

  const normalizedDecisionSections = (args.decisionSections ?? []).map((section) => ({
    ...section,
    id: section.id.trim().replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80),
    title: section.title.trim().slice(0, 140),
    summary: section.summary.trim().slice(0, 900),
    evidence: Array.from(new Set(section.evidence.map((item) => item.trim()).filter(Boolean))).slice(0, 12),
    actions: Array.from(new Set(section.actions.map((item) => item.trim()).filter(Boolean))).slice(0, 8),
  }));

  const commercialEnvelope = buildWorldclassReportCommercialEnvelope({
    tier: args.tier,
    family: args.family,
    surface: args.reportSurface,
    symbol: args.symbol,
    generatedAt,
    sourceFamilyCount: effectiveSourceFamilyCount,
    providerConflictCount: providerConflicts.length,
    missingCriticalEvidence: args.missingCriticalEvidence ?? sourceBindingMissingEvidence.length,
    coverageInput: args.coverageInput ?? {
      data: Math.min(100, 48 + effectiveSourceFamilyCount * 6 - sourceBindingMissingEvidence.length * 4),
      provider: Math.min(100, effectiveSourceFamilyCount * 11),
      historical: args.chartMode === "live_ohlcv" ? 88 : args.chartMode === "fallback" ? 62 : 25,
      evidence: Math.min(100, 52 + effectiveSourceFamilyCount * 6 - sourceBindingMissingEvidence.length * 5 - providerConflicts.length * 6),
      onchain: ["native_crypto", "erc20", "stablecoin", "defi_protocol", "exchange_health"].includes(args.family)
        ? Math.min(100, 45 + effectiveSourceFamilyCount * 7)
        : 0,
      security: ["erc20", "stablecoin", "defi_protocol"].includes(args.family)
        ? Math.min(100, 42 + effectiveSourceFamilyCount * 6)
        : 0,
    },
    stressTestExecuted: args.stressTestExecuted === true,
    evidenceLedgerPresent: args.evidenceLedgerPresent === true && sourceBinding.evidenceLedgerEligible,
    manualReviewVerified: args.accessVerification?.manualReviewVerified === true,
    advancedDeliveryMode,
    advancedAutomationVerified: args.advancedAutomationVerified === true,
    providerTimestamps: args.providerTimestamps ?? receipts
      .filter((receipt) => receipt.evidenceState === "content_bound")
      .map((receipt) => receipt.observedAt),
    executedTests: args.executedTests ?? defaultExecutedTests,
    unexecutedTests: args.unexecutedTests ?? defaultUnexecutedTests,
    chainId: args.chainId,
    blockNumber: args.blockNumber,
    dataWindow: args.dataWindow,
  });
  const tierValueGate = buildCustomerReportTierValueGate({
    requestedTier: args.tier,
    surface: args.reportSurface === "real_markets" ? "real_markets" : args.reportSurface === "security" ? "security" : "shield",
    coverageOverall: commercialEnvelope.coverage.overall,
    independentContentBoundUpstreams: sourceBinding.independentContentBoundUpstreamCount,
    contentBoundReceiptCount: sourceBinding.contentBoundReceiptCount,
    decisionSections: normalizedDecisionSections,
    executedTests: commercialEnvelope.integrity.executedTests,
    manualReviewVerified: args.accessVerification?.manualReviewVerified === true,
    monitoringConfigured: args.accessVerification?.manualReviewVerified === true && commercialEnvelope.monitoring.includedDays > 0,
    advancedDeliveryMode,
    advancedAutomationVerified: args.advancedAutomationVerified === true,
  });
  const deliveryPolicy = buildCustomerReportDeliveryPolicy({
    requestedTier: args.tier,
    coverage: commercialEnvelope.coverage,
    commercialDecision: commercialEnvelope.decision,
    reportAccessDecision,
    tierValueGate,
    advancedDeliveryMode,
  });
  const visibleTier = deliveryPolicy.visibleTier ?? "Basic";
  const customerReceipts = receipts.slice(0, deliveryPolicy.sourceReceiptLimit);
  const pageContract = advancedDeliveryMode === "automated"
    ? CUSTOMER_REPORT_PAGES.map((page) => page.page === 9
      ? { ...page, title: "Advanced automated synthesis and next checks" }
      : page)
    : CUSTOMER_REPORT_PAGES;
  const customerPages = deliveryPolicy.visibleTier === null
    ? []
    : pageContract.filter((page) => isTierVisible(page.requiredForTier, deliveryPolicy.visibleTier));
  const customerDecisionSections = deliveryPolicy.visibleTier === null
    ? []
    : normalizedDecisionSections.filter((section) => isTierVisible(section.minimumTier, deliveryPolicy.visibleTier));
  const customerBoundary = BASIC_PRO_ADVANCED_BOUNDARY.find((item) => item.tier === visibleTier) ?? BASIC_PRO_ADVANCED_BOUNDARY[0];
  const customerTierEvidenceProfile = buildTierEvidenceProfile(visibleTier);
  const customerChartTierPdfGuard = buildChartTierPdfGuard({
    tier: visibleTier,
    chartLifecycleReceipt: lifecycleReceipt,
    receipts: customerReceipts,
  });

  const runtimeObservabilityLedger = buildPass2816RuntimeObservabilityLedger({
    surface: "PDF",
    tier: args.tier,
    requestedUnits: 1,
    sourceBoundUnits: pdfRenderDecision.acceptedForPdf ? 1 : 0,
    skeletonOrMissingUnits: pdfRenderDecision.acceptedForPdf ? 0 : 1,
    containedFailures: pdfRenderDecision.acceptedForPdf ? 0 : 1,
    hardFailures: reportIntegrityVault.releaseGate.status === "block" || sourcePoisoningFirewall.releaseGate.status === "block" ? 1 : 0,
    serverUnitBudget: args.tier === "Basic" ? 1 : args.tier === "Pro" ? 3 : 5,
    softTimeoutMs: 4800,
    retryAfterMs: 30000,
    maxConcurrentBatches: args.tier === "Basic" ? 1 : args.tier === "Pro" ? 2 : 3,
    batchMode: "report",
    generatedAt,
  });

  const payload = {
    schemaVersion: "velmere-customer-report-payload-v1" as const,
    reportId,
    locale: args.locale,
    tier: args.tier,
    advancedDeliveryMode,
    generatedAt,
    methodologyVersion: "top1-risk-methodology-v1" as const,
    sourceRegistryVersion: "source-registry-v1" as const,
    target: { symbol: args.symbol, name: args.name, family: args.family },
    summary: {
      riskScore: methodology.riskScore,
      riskLabel: formatDecimalPercent(methodology.riskScore),
      confidenceScore: methodology.confidenceScore,
      confidenceLabel: formatDecimalPercent(methodology.confidenceScore),
      gradeLabel: methodology.gradeLabel,
      sourceQuorum: methodology.sourceQuorum,
      confidenceCapReason: methodology.confidenceCapReason,
    },
    pages: customerPages,
    decisionSections: customerDecisionSections,
    receipts: customerReceipts,
    missingEvidence: sourceBindingMissingEvidence,
    providerConflicts,
    sourceBinding: {
      ...sourceBinding,
      declaredSourceFamilyCount,
      effectiveSourceFamilyCount,
      sourceCountMismatch,
      deprecatedStaticSourceIdsIgnoredUnlessObserved: args.sourceIds ?? [],
    },
    chartManifest: {
      chartMode: pdfRenderDecision.acceptedForPdf ? (args.chartMode ?? "fallback") : "unavailable",
      timeframe: lifecycleReceipt.timeframeLabel,
      sourceLabel: lifecycleReceipt.sourceLabel,
      lastUpdated: lifecycleReceipt.lastUpdatedLabel,
      evidenceFingerprint: `${args.symbol}:${args.tier}:${generatedAt}:${receipts.map((receipt) => receipt.payloadDigest ?? receipt.receiptId).join("+")}:${sourceBindingMissingEvidence.length}:${providerConflicts.length}:${lifecycleReceipt.state}:${lifecycleReceipt.candleCount}:${pdfRenderDecision.renderMode}`,
      uiPdfParityRequired: true,
      lifecycleReceipt,
      pdfRenderDecision,
      rendererInstruction: pdfRenderDecision.requiredRendererRule,
    },
    tierBoundary: { visibleDepth: customerBoundary.visibleDepth, lockedDepth: customerBoundary.lockedDepth },
    tierEvidenceProfile: customerTierEvidenceProfile,
    tierDifferentiationGate: buildPass2811TierSuite().gate,
    chartTierPdfGuard: customerChartTierPdfGuard,
    paymentEntitlementBoundary: advancedDeliveryMode === "automated"
      ? buildPass2812PaymentEntitlementBoundaryV2({ advancedDeliveryMode })
      : buildPass2812PaymentEntitlementBoundary(),
    reportAccessDecision,
    reportTokenPolicy: buildReportTokenPolicy(),
    vlmBrainSourcePlan,
    vlmBrainClaimFirewall,
    sourcePoisoningFirewall,
    reportIntegrityVault,
    runtimeObservabilityLedger,
    commercialEnvelope,
    tierValueGate,
    deliveryPolicy,
    runtimeProofBoundary: {
      status: "customer_runtime_only" as const,
      archivedProofPlane: "scripts/contracts/market-integrity-report-legacy-proof-plane-pass4693.ts.txt",
      rule: "Historical release, customer-export and supervisory proof is not computed or returned by the customer report endpoint.",
    },
  };
  const fieldModule = commercialEnvelope.surface === "real_markets"
    ? "real_markets" as const
    : commercialEnvelope.surface === "security"
      ? "audit" as const
      : "shield" as const;
  // Bind the canonical packet to what the customer is actually allowed to see.
  // A downgraded paid request must never carry hidden Pro/Advanced fields in a
  // Basic delivery, even when the original request asked for a higher tier.
  const tier = visibleTier.toLowerCase() as "basic" | "pro" | "advanced";
  const chainId = String(args.chainId ?? "").trim() || null;
  const contractAddress = String(args.contractAddress ?? "").trim() || null;
  if (fieldModule === "audit" && (!chainId || !contractAddress)) {
    throw new Error("customer_report_audit_canonical_identity_required");
  }
  const canonicalId = expectedCanonicalIdentity || (fieldModule === "audit"
    ? `${chainId}:${contractAddress!.toLowerCase()}`
    : `${args.family}:${args.symbol.trim().toLowerCase()}`);
  const sourceDigest = sha256Digest(canonicalJson(payload));
  const runtimeFieldContract = buildPass4825CustomerReportFieldContract({
    reportId,
    module: fieldModule,
    tier,
    identity: {
      canonicalId,
      symbol: args.symbol,
      assetClass: args.family,
      chainId: fieldModule === "audit" ? chainId : null,
      contractAddress: fieldModule === "audit" ? contractAddress : null,
    },
    generatedAt,
    sourceDigest,
    riskScore: methodology.riskScore,
    confidenceScore: methodology.confidenceScore,
    missingEvidence: sourceBindingMissingEvidence,
    sourceQuorum: effectiveSourceFamilyCount,
    sourceReceipts: customerReceipts,
    values: args.runtimeCanonicalValues,
  });
  const commercialFieldCompleteness = buildPass6CommercialFieldCompletenessReceipt({
    packet: runtimeFieldContract.packet,
    sourceReceipts: customerReceipts,
    requestedTier: tier,
  });
  return {
    ...payload,
    pass4824CanonicalFieldPacket: runtimeFieldContract.packet,
    pass4825CanonicalFieldReceipt: runtimeFieldContract.receipt,
    pass6CommercialFieldCompleteness: commercialFieldCompleteness,
  };
}
