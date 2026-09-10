export const PASS2279_AUDIT_OUTPUT_QUALITY_ID =
  "pass2279_audit_output_quality_real_tier_matrix_v1" as const;

export type Pass2279Tier = "basic" | "pro" | "advanced";
export type Pass2279SampleAsset = "BTC" | "NVDA" | "SPY" | "S&P 500";

export type Pass2279TierOutputContract = {
  tier: Pass2279Tier;
  paid: boolean;
  targetSignals: number;
  requiredVisibleSections: string[];
  allowedClaims: string[];
  blockedWithoutProof: string[];
  sourceRule: string;
  humanValue: string;
};

export type Pass2279AuditSampleCase = {
  asset: Pass2279SampleAsset;
  assetClass: "native_crypto" | "stock" | "etf" | "index";
  primaryProvider: string;
  acceptableSecondProvider: string;
  neverFake: string[];
  riskScoreRule: string;
  missingSourceCopy: string;
};

export const PASS2279_TIER_OUTPUT_CONTRACTS: Record<Pass2279Tier, Pass2279TierOutputContract> = {
  basic: {
    tier: "basic",
    paid: false,
    targetSignals: 10,
    requiredVisibleSections: [
      "cautious verdict",
      "confirmed primary source",
      "risk score vs confidence cap",
      "missing data",
      "next safe check",
    ],
    allowedClaims: [
      "identity",
      "current quote when provided",
      "short risk interpretation",
      "first source status",
    ],
    blockedWithoutProof: [
      "orderbook depth",
      "holder concentration",
      "contract/admin risk",
      "full source quorum",
      "manually QA-checked audit conclusion",
    ],
    sourceRule:
      "Basic must show at least the primary source state and one visible missing-data line. It may not hide source gaps.",
    humanValue:
      "Fast triage: what is known, what is missing and whether the case deserves deeper review.",
  },
  pro: {
    tier: "pro",
    paid: false,
    targetSignals: 14,
    requiredVisibleSections: [
      "cautious verdict",
      "confirmed source lanes",
      "second provider status",
      "risk score vs confidence cap",
      "scenario / what to re-check",
      "missing data",
    ],
    allowedClaims: [
      "Basic claims",
      "trend/cadence context",
      "second-provider status when present",
      "feed health",
      "what would change the score",
    ],
    blockedWithoutProof: [
      "paid evidence packet",
      "private audit finding detail",
      "final remediation sign-off",
      "full contradiction ledger",
    ],
    sourceRule:
      "Pro may discuss second-source health, but must say missing if Stooq/chain/SEC/provider proof is not returned.",
    humanValue:
      "Analyst preview: clearer source confidence and a concrete next-check plan without leaking Advanced evidence.",
  },
  advanced: {
    tier: "advanced",
    paid: true,
    targetSignals: 20,
    requiredVisibleSections: [
      "scope",
      "evidence table",
      "source confidence",
      "contradiction scan",
      "risk score vs confidence cap",
      "what would change my mind",
      "remediation / next safe checks",
      "paid boundary",
    ],
    allowedClaims: [
      "Pro claims",
      "source ledger",
      "evidence packet",
      "contradiction scan",
      "operator-grade PDF appendix",
      "separate manual-QA handoff is not included in the automated SKU",
    ],
    blockedWithoutProof: [
      "guaranteed security",
      "ROI or price promise",
      "exploit instructions",
      "full audit certificate",
      "wallet connect as payment proof",
    ],
    sourceRule:
      "Advanced is paid and must still be source-bound. Missing proof stays visible even after payment.",
    humanValue:
      "Premium evidence mode: enough structure for an invitation-only technical beta while staying honest about limits.",
  },
};

export const PASS2279_SAMPLE_ASSET_CASES: Record<Pass2279SampleAsset, Pass2279AuditSampleCase> = {
  BTC: {
    asset: "BTC",
    assetClass: "native_crypto",
    primaryProvider: "CoinGecko/Binance market data or another live BTC source",
    acceptableSecondProvider: "second independent market venue/source, not an ERC-20 contract lane",
    neverFake: [
      "ERC-20 holder concentration",
      "mint/admin contract risk",
      "token blacklist risk",
      "static 35/100 as live danger proof",
    ],
    riskScoreRule:
      "For native BTC with a valid quote and no anomaly signals, missing history/second source may cap confidence but should not force a medium-looking static 35 score.",
    missingSourceCopy:
      "Missing: independent second BTC market source and persistent history snapshot, not contract/admin proof.",
  },
  NVDA: {
    asset: "NVDA",
    assetClass: "stock",
    primaryProvider: "Yahoo Finance market adapter",
    acceptableSecondProvider: "Stooq quote adapter or another external equity quote provider",
    neverFake: [
      "DEX liquidity",
      "token holder concentration",
      "contract permission review",
      "Velmère internal router as independent market source",
    ],
    riskScoreRule:
      "For NVDA, market risk should separate quote/volume/source freshness from token-style contract risk.",
    missingSourceCopy:
      "Missing: independent second quote, SEC/fundamental freshness or source cadence if provider is stale.",
  },
  SPY: {
    asset: "SPY",
    assetClass: "etf",
    primaryProvider: "Yahoo Finance market adapter",
    acceptableSecondProvider: "Stooq quote adapter plus ETF/fund metadata source when available",
    neverFake: [
      "contract tax",
      "honeypot risk",
      "mint risk",
      "holder wallet cluster as token proof",
    ],
    riskScoreRule:
      "SPY should explain ETF/benchmark and market-cadence uncertainty, not token scam signals.",
    missingSourceCopy:
      "Missing: independent quote, ETF composition/fundamental lane and provider freshness if not returned.",
  },
  "S&P 500": {
    asset: "S&P 500",
    assetClass: "index",
    primaryProvider: "Yahoo Finance index adapter",
    acceptableSecondProvider: "Stooq index quote or another external index provider",
    neverFake: [
      "share/holder token lanes",
      "contract/admin risk",
      "DEX slippage",
      "single-source confidence inflation",
    ],
    riskScoreRule:
      "Index analysis must be market-data and macro/source-cadence based; missing second provider limits confidence, not necessarily risk.",
    missingSourceCopy:
      "Missing: independent index quote and macro/fundamental context if not supplied.",
  },
};

export function buildPass2279TierComparisonRows() {
  return Object.values(PASS2279_TIER_OUTPUT_CONTRACTS).map((contract) => ({
    tier: contract.tier,
    paid: contract.paid,
    targetSignals: contract.targetSignals,
    minimumSections: contract.requiredVisibleSections.length,
    blockedClaims: contract.blockedWithoutProof.length,
    sourceRule: contract.sourceRule,
  }));
}

export function buildPass2279AuditOutputQualityMatrix() {
  return {
    schemaVersion: "velmere.pass2279.audit-output-quality.v1",
    id: PASS2279_AUDIT_OUTPUT_QUALITY_ID,
    auditPriceEur: 149,
    advancedPaidRule:
      "Advanced and Advanced Audit require server-side entitlement; wallet connect is identity/context only and never payment proof by itself.",
    sourceHonestyRule:
      "A missing source must lower confidence or add a missing-data row; it must not be converted into a fake live risk claim.",
    static35Brake:
      "BTC/native crypto and Real Markets blue-chip rows must not collapse into a static 35/100 when only history or second-source proof is missing.",
    tierRows: buildPass2279TierComparisonRows(),
    sampleCases: PASS2279_SAMPLE_ASSET_CASES,
    qaPrompts: [
      "BTC Basic/Pro/Advanced: verify native crypto lanes do not claim ERC-20 contract proof.",
      "NVDA Basic/Pro/Advanced: verify Yahoo/Stooq source family honesty and no token-style risk.",
      "SPY/S&P 500 Basic/Pro/Advanced: verify ETF/index source gaps are named before conclusions.",
      "Angel audit reply: verify minimal sections, tier availability boundary, source confidence and no fake certificate.",
      "PDF preview/download: verify Basic/Pro/Advanced use the same payload but different proof depth.",
    ],
  } as const;
}

// PASS2279 markers: PASS2279_AUDIT_OUTPUT_QUALITY_ID · BTC NVDA SPY S&P 500 tier output QA · Advanced unavailable · wallet connect is not payment proof · source gaps before verdict
// PASS2279 exact marker: Advanced is not for sale and wallet connect is identity/context, not payment proof.
