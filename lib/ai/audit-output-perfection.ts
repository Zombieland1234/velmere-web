export const PASS2280_AUDIT_OUTPUT_PERFECTION_ID =
  "pass2280_audit_output_perfection_real_output_qa_v1" as const;

export type Pass2280Tier = "basic" | "pro" | "advanced";
export type Pass2280AssetKind = "native_crypto" | "stock" | "etf" | "index" | "unknown";

export type Pass2280AssetPolicy = {
  symbols: string[];
  kind: Pass2280AssetKind;
  primaryLane: string;
  secondLane: string;
  missingBeforeVerdict: string[];
  neverClaimWithoutProof: string[];
  static35Brake: string;
  advancedOnly: string[];
};

export type Pass2280TierContract = {
  tier: Pass2280Tier;
  paid: boolean;
  targetSignals: number;
  maxPublicEvidenceRows: number;
  mustShow: string[];
  mustNotShow: string[];
  outputShape: string[];
};

export const PASS2280_TIER_CONTRACTS: Record<Pass2280Tier, Pass2280TierContract> = {
  basic: {
    tier: "basic",
    paid: false,
    targetSignals: 10,
    maxPublicEvidenceRows: 5,
    mustShow: [
      "asset identity",
      "primary source state",
      "risk score vs confidence cap",
      "missing data before strong conclusion",
      "next safe check",
    ],
    mustNotShow: [
      "advanced evidence packet",
      "operator-only appendix",
      "holder/contract/orderbook claims without proof",
      "payment proof from wallet connect",
    ],
    outputShape: ["Verdict", "Confirmed", "Gaps", "Next check"],
  },
  pro: {
    tier: "pro",
    paid: false,
    targetSignals: 14,
    maxPublicEvidenceRows: 8,
    mustShow: [
      "Basic fields",
      "second-source status",
      "feed freshness/cadence",
      "what changes score",
      "source confidence boundary",
    ],
    mustNotShow: [
      "private remediation sign-off",
      "full contradiction ledger",
      "manually QA-checked certificate",
      "unverified orderbook/slippage",
    ],
    outputShape: ["Verdict", "Sources", "Gaps", "Score drivers", "Next check"],
  },
  advanced: {
    tier: "advanced",
    paid: true,
    targetSignals: 20,
    maxPublicEvidenceRows: 14,
    mustShow: [
      "scope",
      "evidence table",
      "source confidence",
      "contradiction scan",
      "risk score vs confidence cap",
      "remediation/next safe checks",
      "paid boundary",
    ],
    mustNotShow: [
      "guaranteed security",
      "ROI/price promise",
      "exploit steps",
      "wallet connect as payment proof",
      "fake all-clear certificate",
    ],
    outputShape: ["Scope", "Evidence", "Gaps", "Severity", "Remediation", "Boundary"],
  },
};

export const PASS2280_ASSET_POLICIES: Record<string, Pass2280AssetPolicy> = {
  BTC: {
    symbols: ["BTC", "BITCOIN"],
    kind: "native_crypto",
    primaryLane: "native BTC market source",
    secondLane: "independent second BTC venue/source",
    missingBeforeVerdict: ["second BTC venue", "persistent history snapshot", "cross-venue confirmation"],
    neverClaimWithoutProof: ["ERC20 holders", "contract admin", "mint/blacklist risk", "tax/honeypot risk"],
    static35Brake: "A missing second BTC source caps confidence; it must not force a scary static 35/100 risk score when primary quote is valid.",
    advancedOnly: ["cross-venue depth", "orderbook spread", "liquidity anomaly appendix"],
  },
  NVDA: {
    symbols: ["NVDA", "NVIDIA"],
    kind: "stock",
    primaryLane: "Yahoo Finance / equity quote source",
    secondLane: "Stooq or independent equity quote source",
    missingBeforeVerdict: ["second equity quote", "filing/fundamental freshness", "source cadence"],
    neverClaimWithoutProof: ["DEX liquidity", "token holders", "contract permissions", "honeypot risk"],
    static35Brake: "For blue-chip equities, missing second provider is a confidence cap, not token-scam risk.",
    advancedOnly: ["filing appendix", "contradiction scan", "equity catalyst timeline"],
  },
  SPY: {
    symbols: ["SPY"],
    kind: "etf",
    primaryLane: "Yahoo Finance / ETF quote source",
    secondLane: "Stooq or ETF metadata source",
    missingBeforeVerdict: ["second ETF quote", "fund metadata", "composition freshness"],
    neverClaimWithoutProof: ["mint risk", "contract tax", "holder wallet clusters", "DEX slippage"],
    static35Brake: "SPY risk is market/ETF cadence risk, not token contract risk.",
    advancedOnly: ["ETF composition appendix", "benchmark divergence", "macro/source contradiction scan"],
  },
  "S&P 500": {
    symbols: ["S&P 500", "SP500", "^GSPC", "GSPC"],
    kind: "index",
    primaryLane: "index quote source",
    secondLane: "independent index quote / macro source",
    missingBeforeVerdict: ["second index quote", "macro/fundamental context", "index cadence"],
    neverClaimWithoutProof: ["token holders", "contract admin", "DEX liquidity", "slippage"],
    static35Brake: "Index gaps reduce confidence; they do not create token-style risk.",
    advancedOnly: ["macro context appendix", "multi-provider contradiction scan", "index breadth notes"],
  },
};

export function detectPass2280AssetPolicy(input = "") {
  const upper = input.toUpperCase();
  return Object.values(PASS2280_ASSET_POLICIES).find((policy) =>
    policy.symbols.some((symbol) => upper.includes(symbol.toUpperCase())),
  ) ?? null;
}

export function isPass2280NativeOrBlueChip(input = "") {
  const policy = detectPass2280AssetPolicy(input);
  return Boolean(policy && ["native_crypto", "stock", "etf", "index"].includes(policy.kind));
}

export function normalizePass2280RiskScore(args: {
  symbol: string;
  marketType?: string | null;
  sourceState?: string | null;
  score: number | null;
  missingLabels?: string[];
  hasPrimaryQuote?: boolean;
}) {
  if (typeof args.score !== "number" || !Number.isFinite(args.score)) return args.score;
  const score = Math.max(0, Math.min(100, Math.round(args.score)));
  const policy = detectPass2280AssetPolicy(`${args.symbol} ${args.marketType ?? ""}`);
  const missing = args.missingLabels ?? [];
  const onlySourceGaps = missing.length > 0 && missing.every((label) => /source|provider|history|fresh|cadence|snapshot|quote|macro|fund|second/i.test(label));
  const sourceUsable = args.sourceState === "live" || args.sourceState === "partial" || args.hasPrimaryQuote;
  if (policy && score === 35 && sourceUsable && onlySourceGaps) {
    if (policy.kind === "native_crypto") return 24;
    if (policy.kind === "stock") return 26;
    if (policy.kind === "etf" || policy.kind === "index") return 28;
  }
  return score;
}

export function buildPass2280OutputAuditMatrix() {
  return {
    schemaVersion: "velmere.pass2280.audit-output-perfection.v1",
    id: PASS2280_AUDIT_OUTPUT_PERFECTION_ID,
    auditPriceEur: 149,
    advancedPaid: true,
    rule: "Basic/Pro/Advanced must differ by proof depth, visible source lanes and paid evidence boundaries; not by fluff length.",
    sourceRule: "Missing sources are visible gaps before the verdict. They cap confidence and must not be converted into fake risk claims.",
    walletRule: "Wallet connect can identify/contextualize the user, but payment unlock requires server-side Stripe/Web3 confirmation.",
    assetPolicies: PASS2280_ASSET_POLICIES,
    tierContracts: PASS2280_TIER_CONTRACTS,
    qaCases: [
      "BTC Basic/Pro/Advanced: no ERC20/admin lanes unless contract scope exists; no static 35 scare from source gaps.",
      "NVDA Basic/Pro/Advanced: quote/provider/fundamental lanes only; no DEX/holder/contract claims.",
      "SPY/S&P500 Basic/Pro/Advanced: ETF/index cadence gaps before conclusions; no token scam language.",
      "Angel fallback: must produce a complete premium audit scaffold even with provider unavailable.",
      "PDF preview/download: same evidence payload, different tier depth; Advanced paid boundary stays visible.",
    ],
  } as const;
}

// PASS2280 markers: output perfection · Basic Pro Advanced real differences · BTC static 35 brake · NVDA SPY S&P 500 source lanes · Advanced Audit 149€ · wallet connect is not payment proof
