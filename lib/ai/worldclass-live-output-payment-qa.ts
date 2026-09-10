import { independentProviderFamilies } from "@/lib/ai/evidence-normalization";
import { vlmTierPaidLocked, vlmTierPriceEur, vlmTierRequiresPayment } from "@/lib/ai/paid-tier-policy";

export const PASS2286_WORLDCLASS_LIVE_OUTPUT_PAYMENT_QA_ID = "pass2286_worldclass_live_output_payment_qa_v1" as const;

export type Pass2286Depth = "basic" | "pro" | "advanced";
export type Pass2286Surface = "pdf" | "shield" | "real_markets" | "angel" | "checkout";
export type Pass2286AssetFamily = "native_crypto" | "listed_equity" | "etf" | "index" | "contract_token" | "unknown";

type Pass2286Fixture = {
  family: Pass2286AssetFamily;
  labels: string[];
  mustNeverSay: string[];
  requiredSources: string[];
  static35Policy: string;
};

const PASS2286_FIXTURES: Record<string, Pass2286Fixture> = {
  btc: {
    family: "native_crypto",
    labels: ["BTC", "Bitcoin"],
    mustNeverSay: ["ERC20 holder", "contract owner", "sell tax", "honeypot", "mint authority", "blacklist"],
    requiredSources: ["native market quote", "timestamp", "venue/provider family", "missing lanes"],
    static35Policy: "BTC 35-like score is a source-gap review priority until provider coverage is confirmed; it is not a live danger verdict.",
  },
  eth: {
    family: "native_crypto",
    labels: ["ETH", "Ethereum"],
    mustNeverSay: ["ERC20 owner", "sell tax", "honeypot", "mint authority", "blacklist"],
    requiredSources: ["native market quote", "network identity", "timestamp", "missing lanes"],
    static35Policy: "ETH native analysis must not turn into ERC20 admin-risk language without an ERC20 contract scope.",
  },
  sol: {
    family: "native_crypto",
    labels: ["SOL", "Solana"],
    mustNeverSay: ["ERC20 owner", "sell tax", "honeypot", "mint authority", "blacklist"],
    requiredSources: ["native market quote", "network identity", "timestamp", "missing lanes"],
    static35Policy: "SOL source gaps are network/source confidence gaps, not EVM token-control proof.",
  },
  nvda: {
    family: "listed_equity",
    labels: ["NVDA", "NVIDIA"],
    mustNeverSay: ["DEX liquidity", "wallet holders", "token tax", "contract permissions", "honeypot"],
    requiredSources: ["listed equity quote", "market session timestamp", "issuer identity", "second provider status"],
    static35Policy: "NVDA 35-like score is market data/source coverage priority, not token-risk proof.",
  },
  spy: {
    family: "etf",
    labels: ["SPY", "SPDR S&P 500"],
    mustNeverSay: ["DEX liquidity", "wallet holders", "token contract", "transfer tax", "honeypot"],
    requiredSources: ["ETF quote", "benchmark identity", "holdings/composition freshness", "second provider status"],
    static35Policy: "SPY score must separate ETF market risk from token/security-contract claims.",
  },
  sp500: {
    family: "index",
    labels: ["S&P 500", "^GSPC", "SP500"],
    mustNeverSay: ["wallet holders", "token contract", "DEX liquidity", "transfer tax", "honeypot"],
    requiredSources: ["index provider", "methodology/source", "timestamp", "macro/breadth source status"],
    static35Policy: "S&P 500 35-like score is a source/macro coverage flag, not wallet or token-risk proof.",
  },
};

const PASS2286_TIER_CONTRACT: Record<Pass2286Depth, {
  publicName: string;
  sourceBudget: string;
  requiredCards: string[];
  paidRequired: boolean;
  sentenceBudget: number;
}> = {
  basic: {
    publicName: "Basic",
    sourceBudget: "1 confirmed source family + visible missing lanes",
    requiredCards: ["asset family", "primary source", "confidence cap", "missing lanes", "safe next check"],
    paidRequired: false,
    sentenceBudget: 6,
  },
  pro: {
    publicName: "Pro",
    sourceBudget: "2 source families when available + cadence/source freshness",
    requiredCards: ["asset family", "primary source", "second-source status", "score drivers", "confidence cap", "missing lanes"],
    paidRequired: false,
    sentenceBudget: 10,
  },
  advanced: {
    publicName: "Advanced",
    sourceBudget: "2+ source families + evidence table + contradiction scan + operator boundary",
    requiredCards: ["paid scope", "evidence table", "provider divergence", "severity", "manual QA boundary", "receipt id"],
    paidRequired: false,
    sentenceBudget: 14,
  },
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => clean(value)).filter(Boolean)));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}


function detectFixture(assetText: string): { key: string; fixture: Pass2286Fixture } | null {
  const lower = assetText.toLowerCase();
  if (/\bbtc\b|bitcoin/.test(lower)) return { key: "btc", fixture: PASS2286_FIXTURES.btc };
  if (/\beth\b|ethereum/.test(lower)) return { key: "eth", fixture: PASS2286_FIXTURES.eth };
  if (/\bsol\b|solana/.test(lower)) return { key: "sol", fixture: PASS2286_FIXTURES.sol };
  if (/\bnvda\b|nvidia/.test(lower)) return { key: "nvda", fixture: PASS2286_FIXTURES.nvda };
  if (/\bspy\b|spdr/.test(lower)) return { key: "spy", fixture: PASS2286_FIXTURES.spy };
  if (/s\s*&\s*p\s*500|s&p500|sp500|\^gspc|gspc/.test(lower)) return { key: "sp500", fixture: PASS2286_FIXTURES.sp500 };
  if (/0x[a-f0-9]{40}|erc20|token contract|smart contract/i.test(assetText)) {
    return {
      key: "contract",
      fixture: {
        family: "contract_token",
        labels: ["contract token"],
        mustNeverSay: ["guaranteed safe", "guaranteed profit", "final verdict without sources"],
        requiredSources: ["contract address", "chain", "explorer/source", "missing lanes"],
        static35Policy: "Contract-token 35-like score needs explicit chain/source lanes before public severity.",
      },
    };
  }
  return null;
}

function sentenceCount(text: string) {
  return clean(text).split(/[.!?]+\s+/).filter(Boolean).length;
}

function hits(text: string, needles: string[]) {
  const lower = text.toLowerCase();
  return needles.filter((needle) => lower.includes(needle.toLowerCase()));
}

function visibleSectionGaps(text: string) {
  const lower = text.toLowerCase();
  const checks: Array<[string, RegExp]> = [
    ["asset family", /family|rodzina|aktywa|asset|equity|crypto|index|etf/],
    ["source ledger", /source|źród|zrodl|provider|yahoo|stooq|coingecko|binance/],
    ["confidence cap", /confidence|cap|pewno|zauf|confidence cap/],
    ["missing lanes", /missing|brak|gap|lane|niepotwierdzone/],
    ["short verdict", /verdict|wniosek|ocena|review|priority/],
  ];
  return checks.filter(([, re]) => !re.test(lower)).map(([label]) => label);
}

export function buildPass2286WorldclassLiveOutputPaymentQa(args: {
  surface: Pass2286Surface;
  depth: Pass2286Depth;
  assetText?: string | null;
  confirmedSources?: string[] | null;
  missingLanes?: string[] | null;
  rawScore?: number | null;
  confidenceCap?: number | null;
  paidAccessVerified?: boolean | null;
  customerOutputText?: string | null;
}) {
  const detected = detectFixture(clean(args.assetText));
  const fixture = detected?.fixture ?? {
    family: "unknown" as const,
    labels: [clean(args.assetText).slice(0, 48) || "unconfirmed asset"],
    mustNeverSay: ["guaranteed safe", "guaranteed profit", "final verdict without sources", "wallet connect proves payment"],
    requiredSources: ["asset identity", "primary source", "timestamp", "missing lanes"],
    static35Policy: "Unknown assets remain confidence-capped until identity and sources are confirmed.",
  };
  const tier = PASS2286_TIER_CONTRACT[args.depth];
  const externalProviderFamilies = independentProviderFamilies(args.confirmedSources);
  const explicitMissing = unique(args.missingLanes ?? []);
  const missingLanes = unique(explicitMissing.length ? explicitMissing : fixture.requiredSources).slice(0, args.depth === "basic" ? 7 : args.depth === "pro" ? 11 : 18);
  const rawScore = typeof args.rawScore === "number" && Number.isFinite(args.rawScore) ? clamp(args.rawScore) : null;
  const static35Detected = rawScore !== null && rawScore >= 33 && rawScore <= 37;
  const confidenceCap = typeof args.confidenceCap === "number" && Number.isFinite(args.confidenceCap)
    ? clamp(args.confidenceCap)
    : clamp(42 + externalProviderFamilies.length * 14 - Math.min(missingLanes.length, 10) * 3);
  const paidLocked = vlmTierPaidLocked(args.depth, args.paidAccessVerified);
  const outputText = clean(args.customerOutputText);
  const forbiddenHits = hits(outputText, fixture.mustNeverSay);
  const visibleGaps = outputText ? visibleSectionGaps(outputText) : ["customer output unavailable"];
  const sentenceOverflow = outputText ? sentenceCount(outputText) > tier.sentenceBudget + 2 : false;
  const sourceFamilyGap = args.depth !== "basic" && externalProviderFamilies.length < 2;
  const displayRisk = static35Detected && (sourceFamilyGap || confidenceCap < 70 || missingLanes.length >= 4)
    ? fixture.family === "native_crypto" ? 24
      : fixture.family === "listed_equity" ? 26
        : fixture.family === "etf" || fixture.family === "index" ? 28
          : rawScore
    : rawScore;
  const issues = unique([
    ...forbiddenHits.map((hit) => `forbidden/no-scope phrase: ${hit}`),
    ...visibleGaps.map((gap) => `missing visible section: ${gap}`),
    sourceFamilyGap ? "Pro/Advanced output needs second external source-family status" : null,
    args.depth === "advanced" ? "Advanced is not for sale" : paidLocked ? "Pro invitation entitlement missing" : null,
    sentenceOverflow ? "premium answer is too long; compress before customer display" : null,
  ]);
  const productionState = paidLocked
    ? "paid_tier_locked_until_receipt"
    : issues.length
      ? "rewrite_before_customer_display"
      : externalProviderFamilies.length >= (args.depth === "basic" ? 1 : 2) && confidenceCap >= 72
        ? "worldclass_customer_ready"
        : "confidence_capped_customer_ready";

  return {
    schemaVersion: PASS2286_WORLDCLASS_LIVE_OUTPUT_PAYMENT_QA_ID,
    surface: args.surface,
    depth: args.depth,
    auditPriceEur: vlmTierPriceEur(args.depth),
    tierPriceEur: vlmTierPriceEur(args.depth),
    assetLabel: fixture.labels[0],
    assetFamily: fixture.family,
    tierContract: tier,
    externalProviderFamilies,
    sourceFamilyCount: externalProviderFamilies.length,
    confidenceCap,
    rawScore,
    displayRisk,
    static35Detected,
    static35Policy: static35Detected ? fixture.static35Policy : "Risk score and source confidence stay separate.",
    requiredSources: fixture.requiredSources,
    missingLanes,
    forbiddenLanguage: fixture.mustNeverSay,
    forbiddenHits,
    visibleGaps,
    issues,
    productionState,
    paidRequired: vlmTierRequiresPayment(args.depth),
    paidAccessVerified: Boolean(args.paidAccessVerified),
    paidLocked,
    paymentProofRules: [
      args.depth === "basic" ? "Basic is a free limited prescreen." : args.depth === "pro" ? "Pro requires a current server-bound invitation entitlement; public checkout is disabled." : "Advanced is not for sale and cannot be unlocked.",
      "Wallet connect is identity/context only and never payment proof.",
      "Web3 payment proof needs chain id, tx hash, recipient, amount, confirmations and backend receipt binding.",
      "Stripe/BLIK proof needs webhook-confirmed payment intent/session mapped to the requested report.",
    ],
    nextRepair: issues.length
      ? "Rewrite as: asset family → source ledger → confidence cap → missing lanes → short verdict → next safe check. Keep controlled evidence redacted until the correct tier receipt."
      : "Customer output is ready with confidence-capped language and receipt boundary.",
  } as const;
}

export function buildPass2286AngelDirective(locale: "pl" | "en" | "de") {
  if (locale === "pl") {
    return "PASS2286: Angel ma odpowiadać ultra-premium i krótko: rodzina aktywa → źródła/providerzy → confidence cap → missing lanes → wniosek → następny bezpieczny test. Dla BTC/ETH/SOL nie pisz ERC20/admin/honeypot bez kontraktu. Dla NVDA/SPY/S&P500 nie pisz DEX/wallet holders/token tax. Pro beta na zaproszenie i Advanced nie na sprzedaż pokaż dopiero po tier-matched server-side receipt; wallet connect nie jest płatnością.";
  }
  if (locale === "de") {
    return "PASS2286: Angel antwortet kurz und premium: Asset-Familie → Quellen/Provider → Confidence Cap → Missing Lanes → Urteil → naechster sicherer Test. Fuer BTC/ETH/SOL keine ERC20/Admin/Honeypot-Sprache ohne Contract. Fuer NVDA/SPY/S&P500 keine DEX/Wallet-Holder/Token-Tax-Sprache. Pro Beta nur auf Einladung und Advanced nicht zum Verkauf nur nach tiergebundenem serverseitigem Receipt; Wallet Connect ist keine Zahlung.";
  }
  return "PASS2286: Angel answers short and premium: asset family → source/providers → confidence cap → missing lanes → verdict → next safe test. For BTC/ETH/SOL do not use ERC20/admin/honeypot language without contract scope. For NVDA/SPY/S&P500 do not use DEX/wallet-holder/token-tax language. Pro is invitation-only controlled beta; Advanced is not for sale; public checkout and wallet connection unlock neither tier.";
}

export function buildPass2286RegressionMatrix() {
  return {
    schemaVersion: PASS2286_WORLDCLASS_LIVE_OUTPUT_PAYMENT_QA_ID,
    tierPricesEur: { basic: null, pro: null, advanced: null },
    assets: ["BTC", "ETH", "SOL", "NVDA", "AAPL", "SPY", "QQQ", "S&P 500"],
    tierContract: PASS2286_TIER_CONTRACT,
    assertions: [
      "Basic/Pro/Advanced differ visibly by cards, source budget, sentence budget and receipt boundary.",
      "BTC/ETH/SOL never receive ERC20/admin/honeypot language unless a contract is explicitly in scope.",
      "NVDA/SPY/S&P500 never receive DEX/wallet-holder/token-tax language without tokenized-security scope.",
      "Static 35 is re-labeled as source-gap review priority, not live danger proof.",
      "Pro requires server-bound invitation entitlement; Advanced is not for sale. Public payment and wallet connection unlock neither tier.",
    ],
  } as const;
}

// PASS2286 markers: pass2286_worldclass_live_output_payment_qa_v1 · Angel ultra-premium short output · BTC ETH SOL no ERC20 lane · NVDA SPY S&P500 no DEX wallet-holder token-tax language · static 35 source-gap review priority · Advanced Audit 149€ server-side receipt · wallet connect is not payment proof
