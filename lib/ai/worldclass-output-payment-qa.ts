import { independentProviderFamilies } from "./evidence-normalization";
import { vlmTierPaidLocked, vlmTierPriceEur, vlmTierRequiresPayment } from "./paid-tier-policy";

export const PASS2283_WORLDCLASS_OUTPUT_PAYMENT_QA_ID =
  "pass2283_worldclass_output_payment_qa_v1" as const;

export type Pass2283Depth = "basic" | "pro" | "advanced";
export type Pass2283Surface = "pdf" | "shield" | "real_markets" | "angel" | "checkout";
export type Pass2283AssetFamily = "native_crypto" | "equity" | "etf" | "index" | "token_contract" | "unknown";

export type Pass2283AssetFixture = {
  canonical: string;
  family: Pass2283AssetFamily;
  aliases: string[];
  primaryLane: string;
  secondLane: string;
  premiumLane: string;
  missingLanes: string[];
  forbiddenWithoutScope: string[];
  staticScoreRule: string;
};

export const PASS2283_OUTPUT_ASSET_FIXTURES: Record<string, Pass2283AssetFixture> = {
  BTC: {
    canonical: "BTC",
    family: "native_crypto",
    aliases: ["btc", "bitcoin"],
    primaryLane: "native market quote / price source",
    secondLane: "independent venue or provider confirmation",
    premiumLane: "venue depth, cross-venue divergence and persistent history",
    missingLanes: ["independent second native-market source", "venue depth snapshot", "cross-venue confirmation", "persistent history snapshot"],
    forbiddenWithoutScope: ["ERC20 holder concentration", "contract owner/admin", "sell tax", "honeypot", "mint/blacklist controls"],
    staticScoreRule: "BTC 35-like score is source-gap review priority unless live venue/depth evidence proves elevated risk.",
  },
  ETH: {
    canonical: "ETH",
    family: "native_crypto",
    aliases: ["eth", "ethereum"],
    primaryLane: "native market quote / chain identity",
    secondLane: "independent native-market provider confirmation",
    premiumLane: "venue depth, cross-venue divergence and chain/network status",
    missingLanes: ["independent second native-market source", "venue depth snapshot", "network status lane", "persistent history snapshot"],
    forbiddenWithoutScope: ["ERC20 owner/admin", "honeypot", "sell tax", "mint/blacklist controls"],
    staticScoreRule: "ETH static score is review priority; never translate native ETH gaps into ERC20 token-admin claims.",
  },
  SOL: {
    canonical: "SOL",
    family: "native_crypto",
    aliases: ["sol", "solana"],
    primaryLane: "native market quote / network identity",
    secondLane: "independent native-market provider confirmation",
    premiumLane: "venue depth, cross-venue divergence and network incident status",
    missingLanes: ["independent second native-market source", "venue depth snapshot", "network incident source", "persistent history snapshot"],
    forbiddenWithoutScope: ["ERC20 owner/admin", "honeypot", "sell tax", "mint/blacklist controls"],
    staticScoreRule: "SOL score must separate network/source confidence from token-contract risk.",
  },
  NVDA: {
    canonical: "NVDA",
    family: "equity",
    aliases: ["nvda", "nvidia"],
    primaryLane: "equity quote with timestamp",
    secondLane: "independent quote/provider confirmation",
    premiumLane: "filing/news freshness, volume/candle cadence and provider divergence",
    missingLanes: ["independent quote", "issuer filing/news freshness", "volume/candle freshness", "provider divergence"],
    forbiddenWithoutScope: ["DEX liquidity", "wallet holders", "contract permissions", "honeypot", "token tax"],
    staticScoreRule: "NVDA 35-like score is a data-confidence placeholder unless sourced market anomaly evidence exists.",
  },
  AAPL: {
    canonical: "AAPL",
    family: "equity",
    aliases: ["aapl", "apple"],
    primaryLane: "equity quote with timestamp",
    secondLane: "independent quote/provider confirmation",
    premiumLane: "filing/news freshness, volume/candle cadence and provider divergence",
    missingLanes: ["independent quote", "issuer filing/news freshness", "volume/candle freshness", "provider divergence"],
    forbiddenWithoutScope: ["DEX liquidity", "wallet holders", "contract permissions", "honeypot", "token tax"],
    staticScoreRule: "AAPL equity gaps cap source confidence and must never become token-scam language.",
  },
  SPY: {
    canonical: "SPY",
    family: "etf",
    aliases: ["spy", "spdr s&p 500", "spdr sp500"],
    primaryLane: "ETF quote with timestamp",
    secondLane: "independent quote/provider confirmation",
    premiumLane: "benchmark, holdings/composition freshness and provider divergence",
    missingLanes: ["independent quote", "ETF composition freshness", "benchmark confirmation", "provider divergence"],
    forbiddenWithoutScope: ["token contract", "DEX slippage", "wallet holder clusters", "mint/blacklist controls"],
    staticScoreRule: "SPY score is market/ETF review priority, not token-contract danger.",
  },
  "S&P 500": {
    canonical: "S&P 500",
    family: "index",
    aliases: ["s&p 500", "sp500", "s&p500", "^gspc", "gspc", "standard and poor"],
    primaryLane: "index quote with timestamp",
    secondLane: "independent index/provider confirmation",
    premiumLane: "macro/breadth context, methodology and provider divergence",
    missingLanes: ["independent index source", "provider timestamp", "macro/breadth source", "index methodology link"],
    forbiddenWithoutScope: ["wallet holders", "token contract", "DEX liquidity", "transfer tax"],
    staticScoreRule: "S&P 500 static score is a review-priority placeholder until index freshness and macro lanes are sourced.",
  },
  QQQ: {
    canonical: "QQQ",
    family: "etf",
    aliases: ["qqq", "nasdaq 100 etf", "invesco qqq"],
    primaryLane: "ETF quote with timestamp",
    secondLane: "independent quote/provider confirmation",
    premiumLane: "Nasdaq benchmark, holdings freshness and provider divergence",
    missingLanes: ["independent quote", "ETF composition freshness", "benchmark confirmation", "provider divergence"],
    forbiddenWithoutScope: ["token contract", "DEX liquidity", "wallet holder clusters", "mint/blacklist controls"],
    staticScoreRule: "QQQ score is ETF/market review priority; missing lanes cap confidence.",
  },
};

export const PASS2283_DEPTH_OUTPUT_CONTRACTS: Record<Pass2283Depth, {
  paidRequired: boolean;
  minConfirmedSources: number;
  visibleSections: string[];
  proofDepth: string;
  maxPublicMissingLanes: number;
}> = {
  basic: {
    paidRequired: false,
    minConfirmedSources: 1,
    visibleSections: ["asset family", "primary source", "risk vs confidence", "top gaps", "next check"],
    proofDepth: "short triage; useful but confidence-capped",
    maxPublicMissingLanes: 4,
  },
  pro: {
    paidRequired: false,
    minConfirmedSources: 2,
    visibleSections: ["asset family", "source cadence", "second-provider status", "score drivers", "gaps", "next checks"],
    proofDepth: "invitation-only Pro provider/cadence review; no Advanced appendix leakage",
    maxPublicMissingLanes: 8,
  },
  advanced: {
    paidRequired: false,
    minConfirmedSources: 2,
    visibleSections: ["scope", "evidence table", "source confidence", "contradiction scan", "severity", "remediation", "boundary"],
    proofDepth: "unreleased Advanced evidence workflow; customer delivery is blocked",
    maxPublicMissingLanes: 14,
  },
};

function includesAlias(text: string, aliases: string[]) {
  const lower = text.toLowerCase();
  return aliases.some((alias) => lower.includes(alias.toLowerCase()));
}

export function detectPass2283AssetFixture(text = "") {
  return Object.values(PASS2283_OUTPUT_ASSET_FIXTURES).find((asset) => includesAlias(text, [asset.canonical, ...asset.aliases])) ?? null;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildPass2283SourceConfidence(args: {
  depth: Pass2283Depth;
  confirmedSources?: string[] | null;
  missingLanes?: string[] | null;
  paidAccessVerified?: boolean;
}) {
  const depth = PASS2283_DEPTH_OUTPUT_CONTRACTS[args.depth];
  const confirmed = independentProviderFamilies(args.confirmedSources);
  const missing = unique(args.missingLanes ?? []);
  const enoughSources = confirmed.length >= depth.minConfirmedSources;
  const paidOk = !vlmTierRequiresPayment(args.depth) || Boolean(args.paidAccessVerified);
  const base = 34 + Math.min(confirmed.length, 4) * 12 - Math.min(missing.length, 8) * 4 + (enoughSources ? 10 : 0) + (paidOk && args.depth === "advanced" ? 8 : 0);
  const cap = clampPercent(base);
  const state = !paidOk
    ? "locked_paid_evidence"
    : enoughSources && cap >= 70
      ? "source_bound"
      : confirmed.length > 0
        ? "partial_confidence"
        : "source_gap";
  return { cap, state, enoughSources, confirmedCount: confirmed.length, missingCount: missing.length } as const;
}

export function buildPass2283OutputQualityGate(args: {
  surface: Pass2283Surface;
  depth: Pass2283Depth;
  assetText?: string | null;
  confirmedSources?: string[] | null;
  missingLanes?: string[] | null;
  rawScore?: number | null;
  confidenceCap?: number | null;
  paidAccessVerified?: boolean;
}) {
  const asset = detectPass2283AssetFixture(args.assetText ?? "") ?? {
    canonical: "unconfirmed asset",
    family: "unknown" as const,
    aliases: [],
    primaryLane: "asset identity and primary source",
    secondLane: "independent source confirmation",
    premiumLane: "contradiction scan and operator evidence table",
    missingLanes: ["asset identity", "primary source", "second source", "freshness timestamp"],
    forbiddenWithoutScope: ["strong verdict", "guarantee", "fake certificate", "wallet connect as payment proof"],
    staticScoreRule: "Unknown scope uses review priority only until primary source and asset identity are confirmed.",
  };
  const depth = PASS2283_DEPTH_OUTPUT_CONTRACTS[args.depth];
  const confirmed = independentProviderFamilies(args.confirmedSources);
  const missing = unique([...(args.missingLanes ?? []), ...asset.missingLanes]).slice(0, depth.maxPublicMissingLanes);
  const sourceConfidence = buildPass2283SourceConfidence({
    depth: args.depth,
    confirmedSources: confirmed,
    missingLanes: missing,
    paidAccessVerified: args.paidAccessVerified,
  });
  const raw = typeof args.rawScore === "number" && Number.isFinite(args.rawScore) ? clampPercent(args.rawScore) : null;
  const static35 = raw !== null && raw >= 33 && raw <= 37 && sourceConfidence.confirmedCount < depth.minConfirmedSources && missing.length > 0;
  const displayedScore = static35
    ? asset.family === "native_crypto"
      ? 24
      : asset.family === "equity"
        ? 26
        : asset.family === "etf" || asset.family === "index"
          ? 28
          : raw
    : raw;
  const paidLocked = vlmTierPaidLocked(args.depth, args.paidAccessVerified);
  return {
    schemaVersion: PASS2283_WORLDCLASS_OUTPUT_PAYMENT_QA_ID,
    surface: args.surface,
    depth: args.depth,
    auditPriceEur: null,
    tierPriceEur: vlmTierPriceEur(args.depth),
    paidRequired: vlmTierRequiresPayment(args.depth),
    paidAccessVerified: Boolean(args.paidAccessVerified),
    paidLocked,
    asset: asset.canonical,
    family: asset.family,
    primaryLane: asset.primaryLane,
    secondLane: asset.secondLane,
    premiumLane: asset.premiumLane,
    visibleSections: depth.visibleSections,
    proofDepth: depth.proofDepth,
    confirmedSources: confirmed,
    missingLanes: missing,
    sourceConfidence,
    rawScore: raw,
    displayedScore,
    static35Reframed: static35,
    scoreRule: static35 ? asset.staticScoreRule : "Risk score is review priority; confidence cap is source coverage.",
    forbiddenWithoutScope: asset.forbiddenWithoutScope,
    paymentBoundary: args.depth === "basic" ? "Basic is a free limited prescreen." : args.depth === "pro" ? "Pro is invitation-only controlled beta and requires server-bound invitation entitlement; public checkout is disabled." : "Advanced is not for sale and cannot be unlocked.",
    outputStatus: paidLocked
      ? `${args.depth}_locked_payment_required`
      : sourceConfidence.state === "source_bound"
        ? "source_bound_ready"
        : sourceConfidence.state === "partial_confidence"
          ? "useful_but_confidence_capped"
          : "source_gap_before_verdict",
  } as const;
}

export function buildPass2283AngelDirective(locale: "pl" | "en" | "de") {
  if (locale === "pl") {
    return "PASS2283: Angel ma odpowiadać jak płatny produkt Pro Beta nur auf Einladung / Advanced nicht zum Verkauf: najpierw rodzina aktywa i źródła, potem braki, osobno score i confidence, bez tokenowych lane dla BTC/NVDA/SPY/S&P500, Advanced tylko po server-side payment proof.";
  }
  if (locale === "de") {
    return "PASS2283: Angel zeigt zuerst Asset-Familie und Quellen, dann Lücken sowie getrennte Risiko- und Konfidenzwerte. Pro ist Beta nur auf Einladung; Advanced ist nicht zum Verkauf.";
  }
  return "PASS2283: Angel must show asset family and sources first, then gaps with risk and confidence separated. Pro is invitation-only beta; Advanced is not for sale.";
}

export function buildPass2283AuditRegressionPack() {
  return {
    schemaVersion: PASS2283_WORLDCLASS_OUTPUT_PAYMENT_QA_ID,
    tierPricesEur: { basic: null, pro: null, advanced: null },
    sampleAssets: Object.keys(PASS2283_OUTPUT_ASSET_FIXTURES),
    depthContracts: PASS2283_DEPTH_OUTPUT_CONTRACTS,
    regressionAssertions: [
      "Basic/Pro/Advanced must visibly differ by proof depth and source budget.",
      "BTC/ETH/SOL native crypto must not show ERC20 holder/admin/honeypot lanes without token-contract scope.",
      "NVDA/AAPL/SPY/QQQ/S&P500 must use equity/ETF/index source language, not DEX or holder language.",
      "A 35-like score from missing sources is reframed as review priority/confidence cap, not live danger proof.",
      "Pro requires server-bound invitation entitlement; Advanced is not for sale. Public payment and wallet connection unlock neither tier.",
    ],
  } as const;
}

// PASS2283 markers: PASS2283_WORLDCLASS_OUTPUT_PAYMENT_QA_ID · Angel Advanced NOT_FOR_SALE audit product · BTC NVDA SPY S&P500 source gaps · static35Reframed · server-side Stripe/BLIK/Web3 entitlement · wallet connect is not payment proof
