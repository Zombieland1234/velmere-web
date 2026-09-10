import { independentProviderFamilies } from "@/lib/ai/evidence-normalization";
import { vlmTierPaidLocked, vlmTierPriceEur, vlmTierRequiresPayment } from "@/lib/ai/paid-tier-policy";

export const PASS2285_PREMIUM_OUTPUT_GATE_ID = "pass2285_premium_output_gate_v1" as const;

export type Pass2285Depth = "basic" | "pro" | "advanced";
export type Pass2285Surface = "pdf" | "shield" | "real_markets" | "angel" | "checkout";
export type Pass2285AssetFamily =
  | "native_crypto"
  | "equity"
  | "etf"
  | "index"
  | "token_contract"
  | "unknown";

type Pass2285Fixture = {
  asset: string;
  family: Pass2285AssetFamily;
  aliases: string[];
  mustShow: string[];
  proAdds: string[];
  advancedAdds: string[];
  forbidden: string[];
  sourceNotes: string[];
};

const PASS2285_FIXTURES: Pass2285Fixture[] = [
  {
    asset: "BTC",
    family: "native_crypto",
    aliases: ["btc", "bitcoin"],
    mustShow: ["native asset", "primary market source", "timestamp", "confidence cap", "missing lanes"],
    proAdds: ["second native quote/provider", "cross-venue/cadence", "score drivers"],
    advancedAdds: ["venue depth", "spread/liquidity evidence", "independent review status", "controlled evidence packet"],
    forbidden: ["ERC20 holder concentration", "contract owner", "sell tax", "honeypot", "mint authority"],
    sourceNotes: ["BTC source gaps cap confidence", "static 35 is review priority, not live danger proof"],
  },
  {
    asset: "ETH",
    family: "native_crypto",
    aliases: ["eth", "ethereum"],
    mustShow: ["native asset", "primary market source", "timestamp", "network identity", "confidence cap"],
    proAdds: ["second native quote/provider", "cadence", "network status source"],
    advancedAdds: ["venue depth", "cross-venue divergence", "independent review status", "controlled evidence packet"],
    forbidden: ["ERC20 owner", "honeypot", "sell tax", "mint/blacklist controls"],
    sourceNotes: ["ETH native analysis is not ERC20 contract audit unless an ERC20 contract is provided"],
  },
  {
    asset: "SOL",
    family: "native_crypto",
    aliases: ["sol", "solana"],
    mustShow: ["native asset", "primary market source", "timestamp", "network identity", "confidence cap"],
    proAdds: ["second native quote/provider", "network incident lane", "cadence"],
    advancedAdds: ["venue depth", "network status source", "independent review status", "controlled evidence packet"],
    forbidden: ["ERC20 owner", "honeypot", "sell tax", "mint/blacklist controls"],
    sourceNotes: ["SOL source gaps are network/source confidence issues, not EVM token admin risk"],
  },
  {
    asset: "NVDA",
    family: "equity",
    aliases: ["nvda", "nvidia"],
    mustShow: ["listed equity", "quote provider", "market session timestamp", "issuer identity", "confidence cap"],
    proAdds: ["second quote provider", "volume/candle cadence", "filing/news freshness"],
    advancedAdds: ["provider divergence", "event/news table", "independent anomaly review status", "controlled evidence packet"],
    forbidden: ["DEX liquidity", "wallet holders", "token tax", "contract permissions", "honeypot"],
    sourceNotes: ["NVDA is an equity; token lanes are forbidden without tokenized-security scope"],
  },
  {
    asset: "SPY",
    family: "etf",
    aliases: ["spy", "spdr s&p 500", "spdr sp500"],
    mustShow: ["ETF", "quote provider", "benchmark identity", "timestamp", "confidence cap"],
    proAdds: ["second quote provider", "holdings/composition freshness", "benchmark cadence"],
    advancedAdds: ["provider divergence", "holdings appendix", "macro/breadth context", "controlled evidence packet"],
    forbidden: ["token contract", "DEX liquidity", "wallet holder clusters", "mint/blacklist controls"],
    sourceNotes: ["SPY is an ETF; contract/DEX wording is blocked"],
  },
  {
    asset: "S&P 500",
    family: "index",
    aliases: ["s&p 500", "s&p500", "sp500", "^gspc", "gspc", "standard and poor"],
    mustShow: ["index", "index provider", "timestamp", "methodology/source", "confidence cap"],
    proAdds: ["second index provider", "macro/breadth source", "session/cadence"],
    advancedAdds: ["provider divergence", "methodology appendix", "macro/breadth table", "controlled evidence packet"],
    forbidden: ["wallet holders", "token contract", "DEX liquidity", "transfer tax", "honeypot"],
    sourceNotes: ["S&P 500 is an index; wallet/DEX/token-risk wording is blocked"],
  },
];

const PASS2285_TIER_SHAPE: Record<Pass2285Depth, {
  minSources: number;
  paidRequired: boolean;
  visibleCards: string[];
  maxPublicSentences: number;
}> = {
  basic: {
    minSources: 1,
    paidRequired: false,
    visibleCards: ["identity", "primary source", "risk vs confidence", "top gaps", "safe next check"],
    maxPublicSentences: 6,
  },
  pro: {
    minSources: 2,
    paidRequired: false,
    visibleCards: ["identity", "source cadence", "second-source status", "score drivers", "gaps", "next checks"],
    maxPublicSentences: 10,
  },
  advanced: {
    minSources: 2,
    paidRequired: false,
    visibleCards: ["paid scope", "evidence table", "contradictions", "severity", "remediation", "human boundary"],
    maxPublicSentences: 14,
  },
};

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}


export function detectPass2285Asset(text = "") {
  const lower = text.toLowerCase();
  return PASS2285_FIXTURES.find((fixture) => [fixture.asset, ...fixture.aliases].some((alias) => lower.includes(alias.toLowerCase()))) ?? null;
}

function fallbackFixture(assetText = ""): Pass2285Fixture {
  const looksContract = /0x[a-f0-9]{40}|contract|erc20|token/i.test(assetText);
  return {
    asset: clean(assetText).slice(0, 44) || "unconfirmed asset",
    family: looksContract ? "token_contract" : "unknown",
    aliases: [],
    mustShow: ["asset identity", "primary source", "timestamp", "confidence cap", "missing lanes"],
    proAdds: ["second source", "cadence", "score drivers"],
    advancedAdds: ["evidence table", "contradiction scan", "independent review status", "controlled evidence packet"],
    forbidden: ["guaranteed safe", "guaranteed profit", "final verdict without sources", "wallet connect proves payment"],
    sourceNotes: ["Unknown scope must stay confidence-capped until identity and source coverage are confirmed"],
  };
}

function findHits(text: string, needles: string[]) {
  const lower = text.toLowerCase();
  return needles.filter((needle) => lower.includes(needle.toLowerCase()));
}

function sentenceCount(text: string) {
  return clean(text).split(/[.!?]+\s+/).filter(Boolean).length;
}

export function buildPass2285PremiumOutputGate(args: {
  surface: Pass2285Surface;
  depth: Pass2285Depth;
  assetText?: string | null;
  confirmedSources?: string[] | null;
  missingLanes?: string[] | null;
  rawScore?: number | null;
  confidenceCap?: number | null;
  paidAccessVerified?: boolean | null;
  customerOutputText?: string | null;
}) {
  const fixture = detectPass2285Asset(args.assetText ?? "") ?? fallbackFixture(args.assetText ?? "");
  const shape = PASS2285_TIER_SHAPE[args.depth];
  const externalProviderFamilies = independentProviderFamilies(args.confirmedSources);
  const requiredLanes = args.depth === "basic"
    ? fixture.mustShow
    : args.depth === "pro"
      ? [...fixture.mustShow, ...fixture.proAdds]
      : [...fixture.mustShow, ...fixture.proAdds, ...fixture.advancedAdds];
  const explicitMissing = unique(args.missingLanes ?? []);
  const missingLanes = unique(explicitMissing.length ? explicitMissing : requiredLanes).slice(0, args.depth === "basic" ? 6 : args.depth === "pro" ? 10 : 16);
  const rawScore = typeof args.rawScore === "number" && Number.isFinite(args.rawScore) ? clamp(args.rawScore) : null;
  const confidenceCap = typeof args.confidenceCap === "number" && Number.isFinite(args.confidenceCap)
    ? clamp(args.confidenceCap)
    : clamp(40 + externalProviderFamilies.length * 15 - Math.min(missingLanes.length, 10) * 3);
  const static35Detected = rawScore !== null && rawScore >= 33 && rawScore <= 37;
  const paidLocked = vlmTierPaidLocked(args.depth, args.paidAccessVerified);
  const text = clean(args.customerOutputText);
  const forbiddenHits = findHits(text, fixture.forbidden);
  const missingRequiredPhrases = text
    ? ["source", "confidence", "missing"].filter((needle) => !text.toLowerCase().includes(needle))
    : ["customer output unavailable"];
  const tooLong = text ? sentenceCount(text) > shape.maxPublicSentences + 3 : false;
  const issues = unique([
    ...forbiddenHits.map((hit) => `forbidden/no-scope language: ${hit}`),
    ...missingRequiredPhrases.map((hit) => `output does not visibly show ${hit}`),
    args.depth === "advanced" ? "Advanced is not for sale" : paidLocked ? "Pro controlled-beta evidence requested without server-bound invitation entitlement" : null,
    args.depth !== "basic" && externalProviderFamilies.length < shape.minSources ? "tier needs more independent external source families" : null,
    tooLong ? "output too long for premium minimal answer" : null,
  ]);
  const displayRisk = static35Detected && (externalProviderFamilies.length < shape.minSources || missingLanes.length >= 3)
    ? fixture.family === "native_crypto"
      ? 24
      : fixture.family === "equity"
        ? 26
        : fixture.family === "etf" || fixture.family === "index"
          ? 28
          : rawScore
    : rawScore;
  const outputReadiness = paidLocked
    ? "paid_locked_redacted"
    : issues.length
      ? "rewrite_before_customer"
      : externalProviderFamilies.length >= shape.minSources && confidenceCap >= 72
        ? "premium_ready"
        : externalProviderFamilies.length > 0
          ? "premium_ready_confidence_capped"
          : "source_gap_only";

  return {
    schemaVersion: PASS2285_PREMIUM_OUTPUT_GATE_ID,
    surface: args.surface,
    depth: args.depth,
    auditPriceEur: vlmTierPriceEur(args.depth),
    tierPriceEur: vlmTierPriceEur(args.depth),
    asset: fixture.asset,
    family: fixture.family,
    externalProviderFamilies,
    sourceCount: externalProviderFamilies.length,
    minSources: shape.minSources,
    missingLanes,
    mustShow: fixture.mustShow,
    proAdds: args.depth !== "basic" ? fixture.proAdds : [],
    advancedAdds: args.depth === "advanced" ? fixture.advancedAdds : [],
    confidenceCap,
    rawScore,
    displayRisk,
    static35Detected,
    static35Policy: static35Detected
      ? "Static 35-like value is shown as source-gap review priority, not a live danger verdict."
      : "Risk score remains separate from source confidence.",
    visibleCards: shape.visibleCards,
    outputReadiness,
    issues,
    forbiddenLanguage: fixture.forbidden,
    sourceNotes: fixture.sourceNotes,
    paidRequired: vlmTierRequiresPayment(args.depth),
    paidAccessVerified: Boolean(args.paidAccessVerified),
    paymentBoundary: args.depth === "basic"
      ? "Basic is a free limited prescreen."
      : args.depth === "pro"
        ? "Pro is an invitation-only controlled beta and requires current server-bound invitation entitlement plus internal quality control; public checkout is disabled."
        : "Advanced is not for sale and cannot be unlocked by payment, entitlement, or wallet connection.",
    nextAction: issues.length
      ? "Rewrite output: family → sources → confidence cap → missing lanes → short verdict → next check."
      : paidLocked
        ? "Keep controlled evidence redacted and show the tier-specific payment-required boundary."
        : "Ready for customer display with confidence-capped wording.",
  } as const;
}

export function buildPass2285AngelDirective(locale: "pl" | "en" | "de") {
  if (locale === "pl") {
    return "PASS2285: Angel odpowiada krótko i źródłowo: rodzina aktywa, źródła, limit pewności, braki, werdykt i następny bezpieczny test. Pro jest betą na zaproszenie; Advanced nie jest na sprzedaż; publiczny checkout jest wyłączony.";
  }
  if (locale === "de") {
    return "PASS2285: Angel antwortet premium-minimal: 1) Asset-Familie, 2) bestaetigte Quellen, 3) Confidence Cap, 4) Missing Lanes, 5) kurzes Urteil, 6) naechster sicherer Test. Keine Token/DEX/Holder-Lanes fuer NVDA/SPY/S&P500 und keine ERC20-Lanes fuer BTC/ETH/SOL ohne Contract-Scope. Pro Beta nur auf Einladung und Advanced nicht zum Verkauf brauchen tiergebundenen serverseitigen Receipt; Wallet Connect ist keine Zahlung.";
  }
  return "PASS2285: Angel answers in a concise source-bound form: asset family, sources, confidence cap, missing evidence, verdict, and next safe check. Pro is invitation-only beta; Advanced is not for sale; public checkout is disabled.";
}

export function buildPass2285RegressionMatrix() {
  return {
    schemaVersion: PASS2285_PREMIUM_OUTPUT_GATE_ID,
    tierPricesEur: { basic: null, pro: null, advanced: null },
    sampleAssets: PASS2285_FIXTURES.map((fixture) => `${fixture.asset}:${fixture.family}`),
    tierShape: PASS2285_TIER_SHAPE,
    mandatoryRegressionQueries: ["BTC basic/pro/advanced", "NVDA basic/pro/advanced", "SPY basic/pro/advanced", "S&P 500 basic/pro/advanced"],
    assertions: [
      "Basic/Pro/Advanced must differ visibly by cards, source budget and redaction boundary.",
      "Static 35 is not a live danger proof when sources are missing.",
      "Angel output must show source/confidence/missing before verdict.",
      "Real-market assets never receive token-tax, DEX-liquidity or wallet-holder language without explicit tokenized-security scope.",
      "Pro is visible only as an invitation-only beta request. Advanced is not for sale. Neither may be unlocked by public payment or wallet connection.",
      "Wallet connect is never payment proof.",
    ],
  } as const;
}

// PASS2285 markers: pass2285_premium_output_gate_v1 · Angel premium-minimal answer · BTC static 35 source-gap · NVDA SPY S&P500 no token/DEX/holder lanes · Advanced Audit 149€ server-side receipt · wallet connect is not payment proof
