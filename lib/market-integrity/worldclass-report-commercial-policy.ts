import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { VelmereReportAssetFamily } from "@/lib/market-integrity/report-asset-family";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest, sha256Token } from "@/lib/security/cryptographic-digest";
import { getVlmCurrentSkuTruth } from "@/lib/commerce/vlm-current-sku-truth";
import type { AdvancedDeliveryMode } from "@/lib/market-integrity/top1-entitlement-report-access";

export type VelmereReportSurface = "shield" | "real_markets" | "security";
export type CoverageDimensionId =
  | "data"
  | "provider"
  | "historical"
  | "evidence"
  | "onchain"
  | "security";

export type ReportCoverageInput = Partial<Record<CoverageDimensionId, number>>;

export type ReportCoverageScore = {
  schemaVersion: "velmere.report-coverage.v1";
  surface: VelmereReportSurface;
  dimensions: Record<CoverageDimensionId, number | null>;
  applicableDimensions: CoverageDimensionId[];
  overall: number;
  missingCriticalEvidence: number;
  completenessLabel: "insufficient" | "limited" | "substantial" | "high";
};

export type ReportCommercialDecision = {
  schemaVersion: "velmere.report-commercial-decision.v1";
  requestedTier: VelmereTier;
  deliverableTier: VelmereTier | null;
  status: "ready" | "downgraded" | "refund_or_credit" | "unavailable";
  paidDeliveryAllowed: boolean;
  blockedReasons: string[];
  customerAction: string;
};

export type ReportCommercialEnvelope = {
  schemaVersion: "velmere.worldclass-report-envelope.v1";
  surface: VelmereReportSurface;
  requestedTier: VelmereTier;
  productName: string;
  legalProductCategory: "screening" | "automated_assessment" | "ai_assisted_assessment";
  pricing: {
    currency: "EUR";
    launchPrice: null;
    targetPrice: null;
    publicPriceLabel: string;
    billingMode: "not_publicly_available";
  };
  coverage: ReportCoverageScore;
  decision: ReportCommercialDecision;
  monitoring: {
    includedDays: number;
    includedRechecks: number;
    changeAlertsIncluded: boolean;
    comparisonIncluded: boolean;
  };
  methodology: {
    version: "velmere-report-methodology-2026.07";
    analyzerVersion: "velmere-analyzer-pass4784";
    standards: string[];
    safeVerdictVocabulary: string[];
  };
  integrity: {
    reportId: string;
    generatedAt: string;
    validAsOf: string;
    expiresAt: string;
    assetIdentifier: string;
    chainId: string | null;
    blockNumber: number | null;
    dataWindow: string;
    providerTimestamps: string[];
    executedTests: string[];
    unexecutedTests: string[];
    evidencePacketHash: string;
    reportHash: string;
  };
  surfaceModel: {
    includedLanes: string[];
    forbiddenGenericSubstitutions: string[];
  };
};

const DIMENSIONS: CoverageDimensionId[] = ["data", "provider", "historical", "evidence", "onchain", "security"];

const SURFACE_DIMENSIONS: Record<VelmereReportSurface, CoverageDimensionId[]> = {
  shield: ["data", "provider", "historical", "evidence", "onchain", "security"],
  real_markets: ["data", "provider", "historical", "evidence"],
  security: ["provider", "historical", "evidence", "onchain", "security"],
};

const SURFACE_WEIGHTS: Record<VelmereReportSurface, Partial<Record<CoverageDimensionId, number>>> = {
  shield: { data: 0.18, provider: 0.17, historical: 0.12, evidence: 0.2, onchain: 0.2, security: 0.13 },
  real_markets: { data: 0.3, provider: 0.25, historical: 0.25, evidence: 0.2 },
  security: { provider: 0.15, historical: 0.1, evidence: 0.25, onchain: 0.15, security: 0.35 },
};

const PRODUCT_NAMES: Record<VelmereReportSurface, Record<VelmereTier, string>> = {
  shield: {
    Basic: "Shield Basic Market Screening",
    Pro: "Shield Pro Automated Market Assessment",
    Advanced: "Shield Advanced AI-Assisted Market Assessment",
  },
  real_markets: {
    Basic: "Real Markets Basic Screening",
    Pro: "Real Markets Pro Automated Market Assessment",
    Advanced: "Real Markets Advanced AI-Assisted Market Assessment",
  },
  security: {
    Basic: "Basic Security Screening",
    Pro: "Pro Automated Security Assessment",
    Advanced: "Advanced AI-Assisted Security Assessment",
  },
};

const SURFACE_LANES: Record<VelmereReportSurface, string[]> = {
  shield: [
    "holders_and_concentration",
    "liquidity_and_slippage",
    "cex_dex_flows",
    "smart_money_and_treasury",
    "bridge_and_stablecoin_flows",
    "funding_open_interest_liquidations",
    "contract_permissions",
    "unlock_and_supply_events",
  ],
  real_markets: [
    "benchmark_and_sector_correlation",
    "financial_results_and_filings",
    "earnings_and_corporate_events",
    "volatility_regime_and_drawdown",
    "liquidity_spread_and_market_depth",
    "macro_and_currency_sensitivity",
    "etf_concentration",
    "commodity_inventory_and_futures",
  ],
  security: [
    "source_and_bytecode_verification",
    "permissions_and_access_control",
    "proxy_and_upgradeability",
    "business_logic_review",
    "holder_liquidity_and_lock_evidence",
    "threat_model_and_exploitability",
    "remediation_and_retest",
  ],
};

const SAFE_VERDICTS = [
  "Critical risk detected",
  "High risk detected",
  "Elevated risk",
  "No critical risk detected within the tested scope",
  "Insufficient evidence",
  "Analysis unavailable",
];

function clamp(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Number(value)));
}

function inferSurface(family: VelmereReportAssetFamily): VelmereReportSurface {
  if (["equity", "etf", "fx", "commodity", "real_estate"].includes(family)) return "real_markets";
  return "shield";
}

export function buildReportCoverageScore(args: {
  surface: VelmereReportSurface;
  input: ReportCoverageInput;
  missingCriticalEvidence: number;
}): ReportCoverageScore {
  const applicableDimensions = SURFACE_DIMENSIONS[args.surface];
  const dimensions = DIMENSIONS.reduce((record, id) => {
    record[id] = applicableDimensions.includes(id) ? clamp(args.input[id]) : null;
    return record;
  }, {} as Record<CoverageDimensionId, number | null>);
  const weights = SURFACE_WEIGHTS[args.surface];
  const weighted = applicableDimensions.reduce((sum, id) => sum + (dimensions[id] ?? 0) * (weights[id] ?? 0), 0);
  const overall = Number(weighted.toFixed(2));
  const completenessLabel = overall >= 85 ? "high" : overall >= 70 ? "substantial" : overall >= 50 ? "limited" : "insufficient";
  return {
    schemaVersion: "velmere.report-coverage.v1",
    surface: args.surface,
    dimensions,
    applicableDimensions,
    overall,
    missingCriticalEvidence: Math.max(0, Math.trunc(args.missingCriticalEvidence)),
    completenessLabel,
  };
}

export function buildReportCommercialDecision(args: {
  tier: VelmereTier;
  coverage: ReportCoverageScore;
  sourceFamilyCount: number;
  providerConflictCount: number;
  stressTestExecuted: boolean;
  evidenceLedgerPresent: boolean;
  manualReviewVerified: boolean;
  advancedDeliveryMode?: AdvancedDeliveryMode;
  advancedAutomationVerified?: boolean;
}): ReportCommercialDecision {
  const blockedReasons: string[] = [];
  const overall = args.coverage.overall;
  if (args.tier === "Basic") {
    if (overall < 30) {
      return {
        schemaVersion: "velmere.report-commercial-decision.v1",
        requestedTier: args.tier,
        deliverableTier: null,
        status: "unavailable",
        paidDeliveryAllowed: false,
        blockedReasons: ["Coverage below 30%; even a screening would be misleading."],
        customerAction: "Explain missing data and do not present a risk verdict.",
      };
    }
    return {
      schemaVersion: "velmere.report-commercial-decision.v1",
      requestedTier: args.tier,
      deliverableTier: "Basic",
      status: "ready",
      paidDeliveryAllowed: false,
      blockedReasons: [],
      customerAction: "Deliver free screening with explicit missing-evidence boundaries.",
    };
  }

  const proThreshold = args.coverage.surface === "security" ? 72 : 68;
  const advancedThreshold = args.coverage.surface === "security" ? 85 : 82;
  const providerCoverage = args.coverage.dimensions.provider ?? 0;
  const evidenceCoverage = args.coverage.dimensions.evidence ?? 0;
  const historicalCoverage = args.coverage.dimensions.historical ?? 0;
  const proSourceMinimum = args.coverage.surface === "real_markets" ? 2 : 3;
  const advancedSourceMinimum = args.coverage.surface === "real_markets" ? 3 : 5;

  if (args.tier === "Pro") {
    if (overall < proThreshold) blockedReasons.push(`Overall coverage ${overall}% is below Pro threshold ${proThreshold}%.`);
    if (providerCoverage < 60) blockedReasons.push("Provider coverage below 60%.");
    if (evidenceCoverage < 60) blockedReasons.push("Evidence completeness below 60%.");
    if (args.sourceFamilyCount < proSourceMinimum) blockedReasons.push(`Fewer than ${proSourceMinimum} independent upstream sources for ${args.coverage.surface} Pro.`);
    if (args.coverage.missingCriticalEvidence > 3) blockedReasons.push("Too many missing critical evidence items for Pro.");
    if (blockedReasons.length) {
      return {
        schemaVersion: "velmere.report-commercial-decision.v1",
        requestedTier: args.tier,
        deliverableTier: overall >= 30 ? "Basic" : null,
        status: "downgraded",
        paidDeliveryAllowed: false,
        blockedReasons,
        customerAction: "Downgrade to Basic and return payment as refund or account credit.",
      };
    }
    return {
      schemaVersion: "velmere.report-commercial-decision.v1",
      requestedTier: args.tier,
      deliverableTier: overall >= 30 ? "Basic" : null,
      status: "unavailable",
      paidDeliveryAllowed: false,
      blockedReasons: ["Pro is an invitation-only controlled beta. Public checkout and public paid delivery are disabled."],
      customerAction: "Offer the bounded Basic prescreen or direct an eligible tester to the controlled beta intake; do not charge publicly.",
    };
  }

  if (args.tier === "Advanced") {
    const advancedDeliveryMode = args.advancedDeliveryMode ?? "manual_review";
    if (overall < advancedThreshold) blockedReasons.push(`Overall coverage ${overall}% is below Advanced threshold ${advancedThreshold}%.`);
    if (providerCoverage < 75) blockedReasons.push("Provider coverage below 75%.");
    if (evidenceCoverage < 80) blockedReasons.push("Evidence completeness below 80%.");
    if (historicalCoverage < 70) blockedReasons.push("Historical coverage below 70%.");
    if (args.sourceFamilyCount < advancedSourceMinimum) blockedReasons.push(`Fewer than ${advancedSourceMinimum} independent upstream sources for ${args.coverage.surface} Advanced.`);
    if (args.coverage.surface !== "security" && !args.stressTestExecuted) blockedReasons.push("Required stress test was not executed.");
    if (!args.evidenceLedgerPresent) blockedReasons.push("Evidence ledger is missing.");
    if (advancedDeliveryMode === "automated") {
      if (!args.advancedAutomationVerified) blockedReasons.push("Advanced automated evidence synthesis is not verified.");
    } else if (!args.manualReviewVerified) {
      blockedReasons.push("Advanced manual-review receipt is not verified.");
    }
    if (args.providerConflictCount > 2) blockedReasons.push("Unresolved provider conflicts exceed Advanced tolerance.");
    if (args.coverage.missingCriticalEvidence > 1) blockedReasons.push("More than one critical evidence item is missing.");
    return {
      schemaVersion: "velmere.report-commercial-decision.v1",
      requestedTier: args.tier,
      deliverableTier: overall >= 30 ? "Basic" : null,
      status: "unavailable",
      paidDeliveryAllowed: false,
      blockedReasons: [
        ...blockedReasons,
        advancedDeliveryMode === "automated"
          ? "Advanced is NOT_FOR_SALE. Optional human QA cannot unlock, substitute for, or add entitlement credit to the automated product."
          : "Advanced is NOT_FOR_SALE and includes no independent certification.",
      ],
      customerAction: "Do not offer checkout, silently downgrade or create a paid artifact. Show only the requested-tier unavailable state and a separately selectable lower tier where applicable.",
    };
  }

  return {
    schemaVersion: "velmere.report-commercial-decision.v1",
    requestedTier: args.tier,
    deliverableTier: null,
    status: "unavailable",
    paidDeliveryAllowed: false,
    blockedReasons: ["Current SKU truth does not permit public paid delivery."],
    customerAction: "Do not charge or deliver a paid tier.",
  };
}

export function buildWorldclassReportCommercialEnvelope(args: {
  tier: VelmereTier;
  family: VelmereReportAssetFamily;
  surface?: VelmereReportSurface;
  symbol: string;
  generatedAt: string;
  sourceFamilyCount: number;
  providerConflictCount: number;
  missingCriticalEvidence: number;
  coverageInput: ReportCoverageInput;
  stressTestExecuted: boolean;
  evidenceLedgerPresent: boolean;
  manualReviewVerified: boolean;
  advancedDeliveryMode?: AdvancedDeliveryMode;
  advancedAutomationVerified?: boolean;
  providerTimestamps: string[];
  executedTests: string[];
  unexecutedTests: string[];
  chainId?: string | null;
  blockNumber?: number | null;
  dataWindow?: string;
}): ReportCommercialEnvelope {
  const surface = args.surface ?? inferSurface(args.family);
  const coverage = buildReportCoverageScore({
    surface,
    input: args.coverageInput,
    missingCriticalEvidence: args.missingCriticalEvidence,
  });
  const decision = buildReportCommercialDecision({
    tier: args.tier,
    coverage,
    sourceFamilyCount: args.sourceFamilyCount,
    providerConflictCount: args.providerConflictCount,
    stressTestExecuted: args.stressTestExecuted,
    evidenceLedgerPresent: args.evidenceLedgerPresent,
    manualReviewVerified: args.manualReviewVerified,
    advancedDeliveryMode: args.advancedDeliveryMode,
    advancedAutomationVerified: args.advancedAutomationVerified,
  });
  const skuTruth = getVlmCurrentSkuTruth(args.tier === "Basic" ? "basic" : args.tier === "Pro" ? "pro" : "advanced", "en");
  const monitoring = args.tier === "Advanced"
    ? { includedDays: surface === "security" ? 30 : 14, includedRechecks: 1, changeAlertsIncluded: true, comparisonIncluded: true }
    : args.tier === "Pro"
      ? { includedDays: 0, includedRechecks: 0, changeAlertsIncluded: false, comparisonIncluded: false }
      : { includedDays: 0, includedRechecks: 0, changeAlertsIncluded: false, comparisonIncluded: false };
  const expiresMs = surface === "real_markets" ? 24 * 60 * 60 * 1000 : surface === "shield" ? 6 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.parse(args.generatedAt) + expiresMs).toISOString();
  const evidencePayload = {
    surface,
    tier: args.tier,
    symbol: args.symbol,
    coverage,
    providers: args.providerTimestamps,
    executedTests: args.executedTests,
    unexecutedTests: args.unexecutedTests,
  };
  const evidencePacketHash = sha256Digest(canonicalJson(evidencePayload));
  const reportId = `VLM-${surface.replace("_", "-").toUpperCase()}-${args.symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase()}-${sha256Token(`${args.generatedAt}:${evidencePacketHash}`, 20).toUpperCase()}`;
  const reportCore = {
    reportId,
    generatedAt: args.generatedAt,
    validAsOf: args.generatedAt,
    expiresAt,
    assetIdentifier: args.symbol,
    chainId: args.chainId ?? null,
    blockNumber: args.blockNumber ?? null,
    dataWindow: args.dataWindow ?? (surface === "real_markets" ? "latest close plus 1y history" : "latest observation plus 90d history"),
    evidencePacketHash,
  };
  const reportHash = sha256Digest(canonicalJson(reportCore));
  const standards = surface === "security"
    ? ["OWASP Smart Contract Top 10 2026", "OWASP SCSVS", "OWASP SCSTG", "EEA EthTrust Security Levels v3", "CWE", "SWC legacy cross-reference"]
    : ["Velmère evidence-bound market methodology", "Provider provenance and freshness policy", "No investment-advice boundary"];

  return {
    schemaVersion: "velmere.worldclass-report-envelope.v1",
    surface,
    requestedTier: args.tier,
    productName: PRODUCT_NAMES[surface][args.tier],
    legalProductCategory: args.tier === "Basic" ? "screening" : args.tier === "Pro" ? "automated_assessment" : "ai_assisted_assessment",
    pricing: {
      currency: "EUR",
      launchPrice: null,
      targetPrice: null,
      publicPriceLabel: skuTruth.publicPriceLabel,
      billingMode: "not_publicly_available",
    },
    coverage,
    decision,
    monitoring,
    methodology: {
      version: "velmere-report-methodology-2026.07",
      analyzerVersion: "velmere-analyzer-pass4784",
      standards,
      safeVerdictVocabulary: SAFE_VERDICTS,
    },
    integrity: {
      ...reportCore,
      providerTimestamps: [...args.providerTimestamps],
      executedTests: [...args.executedTests],
      unexecutedTests: [...args.unexecutedTests],
      reportHash,
    },
    surfaceModel: {
      includedLanes: SURFACE_LANES[surface],
      forbiddenGenericSubstitutions: surface === "shield"
        ? ["Do not replace on-chain flow lanes with equity fundamentals.", "Do not call CEX depth a contract-security finding."]
        : surface === "real_markets"
          ? ["Do not replace filings/earnings with token-holder analytics.", "Do not use token unlock logic for equities, FX or commodities."]
          : ["Do not call automated assessment a manual audit.", "Do not issue SAFE or guaranteed-secure verdicts."],
    },
  };
}

export const PASS4783_REPORT_ACCEPTANCE_GATES = [
  "Market analysis and contract security use different product names and price curves.",
  "Advanced contains monitoring, one recheck, change alerts and comparison entitlement; it is not only a longer PDF.",
  "Pro and Advanced fail closed on insufficient coverage and automatically downgrade/refund or credit.",
  "Every paid report carries report/evidence hashes, provider timestamps, methodology version, executed and unexecuted tests, validity window and asset identity.",
  "Shield and Real Markets expose distinct lane models instead of one generator with a renamed asset.",
  "Security uses screening/automated assessment/AI-assisted assessment terminology and never claims manual audit equivalence.",
] as const;
