import { vlmTierPriceEur, vlmTierPriceLabel, vlmTierRequiresPayment } from "./paid-tier-policy";

export const PASS2281_WORLDCLASS_OUTPUT_CONTRACT_ID =
  "pass2281_worldclass_output_contract_149_eur_v1" as const;

export type Pass2281Depth = "basic" | "pro" | "advanced";
export type Pass2281AssetFamily = "native_crypto" | "token_contract" | "equity" | "etf" | "index" | "unknown";

export type Pass2281AssetContract = {
  canonical: string;
  aliases: string[];
  family: Pass2281AssetFamily;
  applicableEvidence: string[];
  notApplicableWithoutScope: string[];
  minimumSourcesBeforeStrongVerdict: number;
  static35Rule: string;
  sourceGapRule: string;
};

export type Pass2281TierOutputContract = {
  depth: Pass2281Depth;
  freePreview: boolean;
  paidRequired: boolean;
  targetHumanValue: string;
  requiredVisibleSections: string[];
  sourceBudget: number;
  missingDataBudget: number;
  proofBudget: number;
  forbiddenOutput: string[];
};

export const PASS2281_ASSET_CONTRACTS: Record<string, Pass2281AssetContract> = {
  BTC: {
    canonical: "BTC",
    aliases: ["bitcoin", "btc"],
    family: "native_crypto",
    applicableEvidence: ["native market quote", "independent venue quote", "cross-venue history", "depth/spread snapshot when available"],
    notApplicableWithoutScope: ["ERC20 holder concentration", "contract owner/admin", "mint/blacklist/tax/honeypot controls"],
    minimumSourcesBeforeStrongVerdict: 2,
    static35Rule: "For BTC/native crypto, static 35/100 can only mean review priority or source gap. It must not be shown as live danger proof.",
    sourceGapRule: "Missing second venue caps confidence; it does not create token-contract risk.",
  },
  NVDA: {
    canonical: "NVDA",
    aliases: ["nvidia", "nvda"],
    family: "equity",
    applicableEvidence: ["equity quote", "independent quote/source", "market session/cadence", "filing/fundamental freshness"],
    notApplicableWithoutScope: ["DEX liquidity", "wallet holder concentration", "contract permissions", "honeypot/tax controls"],
    minimumSourcesBeforeStrongVerdict: 2,
    static35Rule: "For NVDA, missing second provider is a confidence cap, not a scam-risk score.",
    sourceGapRule: "Equity gaps must be expressed as source/fundamental freshness gaps, never token risk.",
  },
  SPY: {
    canonical: "SPY",
    aliases: ["spy", "spdr s&p 500"],
    family: "etf",
    applicableEvidence: ["ETF quote", "independent quote/source", "benchmark link", "composition/fund metadata freshness"],
    notApplicableWithoutScope: ["token contract admin", "DEX slippage", "wallet holder clusters", "mint/blacklist controls"],
    minimumSourcesBeforeStrongVerdict: 2,
    static35Rule: "For SPY, risk means market/ETF evidence priority; not token contract danger.",
    sourceGapRule: "Missing composition or second quote lowers confidence and becomes a visible gap.",
  },
  "S&P 500": {
    canonical: "S&P 500",
    aliases: ["s&p 500", "sp500", "^gspc", "gspc"],
    family: "index",
    applicableEvidence: ["index quote", "independent index source", "session/cadence", "macro/breadth context when available"],
    notApplicableWithoutScope: ["token holders", "contract owner/admin", "DEX liquidity", "transfer tax/honeypot"],
    minimumSourcesBeforeStrongVerdict: 2,
    static35Rule: "For an index, static 35/100 is a review priority placeholder, not live proof of danger.",
    sourceGapRule: "Index source gaps should be shown before verdict and never filled with invented macro certainty.",
  },
};

export const PASS2281_TIER_CONTRACTS: Record<Pass2281Depth, Pass2281TierOutputContract> = {
  basic: {
    depth: "basic",
    freePreview: true,
    paidRequired: false,
    targetHumanValue: "fast triage that tells a user what is known, what is missing, and what not to over-interpret",
    requiredVisibleSections: ["cautious verdict", "confirmed source", "risk vs confidence", "missing data", "next check"],
    sourceBudget: 3,
    missingDataBudget: 4,
    proofBudget: 0,
    forbiddenOutput: ["proof capsule", "operator appendix", "manually QA-checked certificate", "advanced contradiction ledger"],
  },
  pro: {
    depth: "pro",
    freePreview: false,
    paidRequired: false,
    targetHumanValue: "invitation-only Pro source-cadence and second-provider review without leaking unreleased Advanced evidence",
    requiredVisibleSections: ["verdict", "source table", "second provider status", "score drivers", "gaps", "next checks"],
    sourceBudget: 6,
    missingDataBudget: 8,
    proofBudget: 2,
    forbiddenOutput: ["operator appendix", "human sign-off", "paid proof capsule", "guaranteed all-clear"],
  },
  advanced: {
    depth: "advanced",
    freePreview: false,
    paidRequired: false,
    targetHumanValue: "unreleased Advanced evidence mode with table, contradictions, what-changes-the-score, and explicit NOT_FOR_SALE boundary",
    requiredVisibleSections: ["scope", "evidence table", "source confidence", "contradiction scan", "severity", "remediation", "boundary"],
    sourceBudget: 14,
    missingDataBudget: 16,
    proofBudget: 8,
    forbiddenOutput: ["ROI promise", "price prediction", "fake safety certificate", "exploit steps", "wallet connect as payment proof"],
  },
};

function includesAlias(text: string, aliases: string[]) {
  const lower = text.toLowerCase();
  return aliases.some((alias) => lower.includes(alias.toLowerCase()));
}

export function detectPass2281AssetContract(text = ""): Pass2281AssetContract | null {
  return Object.values(PASS2281_ASSET_CONTRACTS).find((contract) => includesAlias(text, [contract.canonical, ...contract.aliases])) ?? null;
}

export function buildPass2281SourceConfidence(args: {
  sourceCount: number;
  missingCount: number;
  hasSecondProvider?: boolean;
  dataQuality?: "demo" | "partial" | "live" | string | null;
}) {
  const liveBonus = args.dataQuality === "live" ? 12 : args.dataQuality === "partial" ? 4 : 0;
  const secondBonus = args.hasSecondProvider ? 18 : 0;
  const raw = 34 + Math.min(args.sourceCount, 4) * 8 + secondBonus + liveBonus - Math.min(args.missingCount, 10) * 3;
  const cap = Math.max(18, Math.min(92, Math.round(raw)));
  const state = cap >= 72 ? "source_bound" : cap >= 52 ? "partial" : "source_gap";
  return { cap, state } as const;
}

export function normalizePass2281RiskScore(args: {
  symbol: string;
  rawScore: number | null | undefined;
  sourceCount?: number;
  missingCount?: number;
  hasPrimaryQuote?: boolean;
  hasSecondProvider?: boolean;
  assetClass?: string | null;
}) {
  if (typeof args.rawScore !== "number" || !Number.isFinite(args.rawScore)) return args.rawScore;
  const score = Math.max(0, Math.min(100, Math.round(args.rawScore)));
  const contract = detectPass2281AssetContract(`${args.symbol} ${args.assetClass ?? ""}`);
  const onlySourceGap = Boolean(contract) && Boolean(args.hasPrimaryQuote) && !args.hasSecondProvider && (args.missingCount ?? 0) > 0;
  if (score === 35 && onlySourceGap) {
    if (contract?.family === "native_crypto") return 24;
    if (contract?.family === "equity") return 26;
    if (contract?.family === "etf" || contract?.family === "index") return 28;
  }
  return score;
}

export function buildPass2281TierReadout(depth: Pass2281Depth, locale: "pl" | "en" | "de" = "en") {
  const contract = PASS2281_TIER_CONTRACTS[depth];
  if (locale === "pl") {
    return `${depth.toUpperCase()}: ${contract.targetHumanValue}; sekcje: ${contract.requiredVisibleSections.join(", ")}; źródła max ${contract.sourceBudget}; publiczny checkout=${false}.`;
  }
  if (locale === "de") {
    return `${depth.toUpperCase()}: ${contract.targetHumanValue}; Sektionen: ${contract.requiredVisibleSections.join(", ")}; Quellen max ${contract.sourceBudget}; öffentlicher Checkout=${false}.`;
  }
  return `${depth.toUpperCase()}: ${contract.targetHumanValue}; sections: ${contract.requiredVisibleSections.join(", ")}; max sources ${contract.sourceBudget}; public checkout=${false}.`;
}

export function buildPass2281AngelPremiumAuditScaffold(args: {
  locale: "pl" | "en" | "de";
  assetHint?: string | null;
  depth: Pass2281Depth;
  sourceCount: number;
  missingCount: number;
  hasSecondProvider?: boolean;
}) {
  const asset = detectPass2281AssetContract(args.assetHint ?? "");
  const source = buildPass2281SourceConfidence({
    sourceCount: args.sourceCount,
    missingCount: args.missingCount,
    hasSecondProvider: args.hasSecondProvider,
    dataQuality: args.sourceCount ? "partial" : "demo",
  });
  const assetLine = asset
    ? `${asset.canonical} / ${asset.family}: applicable=${asset.applicableEvidence.slice(0, 3).join(", ")}; not-applicable=${asset.notApplicableWithoutScope.slice(0, 3).join(", ")}.`
    : "Asset scope must be confirmed before strong claims.";
  if (args.locale === "pl") {
    return [
      "PASS2281 Angel premium audit scaffold: verdict → źródła → braki → score/confidence → next safe test → Advanced boundary.",
      assetLine,
      `Tier: ${buildPass2281TierReadout(args.depth, args.locale)}`,
      `Source confidence: ${source.state} · cap ${source.cap}% · sources ${args.sourceCount} · missing ${args.missingCount}.`,
      `${vlmTierPriceLabel(args.depth, "pl")}: ${vlmTierRequiresPayment(args.depth) ? "wymaga tier-matched płatności server-side" : "darmowy Basic preview"}; wallet connect nie jest proofem płatności.`,
    ];
  }
  if (args.locale === "de") {
    return [
      "PASS2281 Angel Premium Audit Scaffold: Verdict → Quellen → Lücken → Score/Konfidenz → Next Safe Test → Advanced Boundary.",
      assetLine,
      `Tier: ${buildPass2281TierReadout(args.depth, args.locale)}`,
      `Source confidence: ${source.state} · cap ${source.cap}% · sources ${args.sourceCount} · missing ${args.missingCount}.`,
      `${vlmTierPriceLabel(args.depth, "de")}: ${vlmTierRequiresPayment(args.depth) ? "tiergebundene serverseitige Zahlung erforderlich" : "kostenlose Basic-Vorschau"}; Wallet Connect ist kein Payment Proof.`,
    ];
  }
  return [
    "PASS2281 Angel premium audit scaffold: verdict → sources → gaps → score/confidence → next safe test → Advanced boundary.",
    assetLine,
    `Tier: ${buildPass2281TierReadout(args.depth, args.locale)}`,
    `Source confidence: ${source.state} · cap ${source.cap}% · sources ${args.sourceCount} · missing ${args.missingCount}.`,
    `${vlmTierPriceLabel(args.depth, "en")}: ${vlmTierRequiresPayment(args.depth) ? "tier-matched server-side payment required" : "free Basic preview"}; wallet connect is not payment proof.`,
  ];
}

export function buildPass2281WorldclassOutputContract() {
  return {
    schemaVersion: PASS2281_WORLDCLASS_OUTPUT_CONTRACT_ID,
    tierPricesEur: { basic: vlmTierPriceEur("basic"), pro: vlmTierPriceEur("pro"), advanced: vlmTierPriceEur("advanced") },
    advancedGate: "server_side_entitlement_required",
    paymentRule: "Stripe/Web3 confirmation must be server-side; connect wallet alone never unlocks Pro or Advanced.",
    outputRule: "Every PDF/Shield/Angel output must show true Basic/Pro/Advanced difference, source gaps before verdict, and score vs confidence separation.",
    sampleAssets: Object.keys(PASS2281_ASSET_CONTRACTS),
    assetContracts: PASS2281_ASSET_CONTRACTS,
    tierContracts: PASS2281_TIER_CONTRACTS,
  } as const;
}

// PASS2281 markers: Pro invitation-only beta / Advanced not for sale · Basic Pro Advanced proof-depth QA · BTC NVDA SPY S&P 500 source-gap confidence cap · static 35 brake · wallet connect is not payment proof · Stripe/Web3 server-side entitlement
