import { independentProviderFamilies } from "@/lib/ai/evidence-normalization";
import { vlmTierPaidLocked, vlmTierPriceEur, vlmTierRequiresPayment } from "@/lib/ai/paid-tier-policy";

export const PASS2284_LIVE_OUTPUT_QUALITY_LEDGER_ID =
  "pass2284_live_output_quality_ledger_v1" as const;

export type Pass2284Depth = "basic" | "pro" | "advanced";
export type Pass2284Surface = "pdf" | "shield" | "real_markets" | "angel" | "checkout";
export type Pass2284AssetFamily =
  | "native_crypto"
  | "equity"
  | "etf"
  | "index"
  | "token_contract"
  | "commodity"
  | "fx"
  | "unknown";

export type Pass2284QualityLedger = ReturnType<typeof buildPass2284LiveOutputQualityLedger>;

type Pass2284Fixture = {
  canonical: string;
  family: Pass2284AssetFamily;
  aliases: string[];
  requiredPrimaryLanes: string[];
  proRequiredLanes: string[];
  advancedRequiredLanes: string[];
  forbiddenCustomerClaims: string[];
  noScopeClaims: string[];
  static35Rule: string;
};

const PASS2284_FIXTURES: Pass2284Fixture[] = [
  {
    canonical: "BTC",
    family: "native_crypto",
    aliases: ["btc", "bitcoin"],
    requiredPrimaryLanes: ["native market quote", "timestamp/freshness", "source confidence", "missing venue lanes"],
    proRequiredLanes: ["second native-market provider", "cross-venue check", "history/cadence"],
    advancedRequiredLanes: ["venue depth", "liquidity/spread evidence", "contradiction table", "independent review status"],
    forbiddenCustomerClaims: ["ERC20 holders", "contract owner", "mint authority", "sell tax", "honeypot"],
    noScopeClaims: ["BTC has token admin risk", "BTC holder concentration is ERC20-derived", "wallet connect proves BTC payment"],
    static35Rule: "BTC 35-like score means source-gap review priority until two source lanes and depth/cadence are confirmed.",
  },
  {
    canonical: "ETH",
    family: "native_crypto",
    aliases: ["eth", "ethereum"],
    requiredPrimaryLanes: ["native market quote", "network identity", "timestamp/freshness", "source confidence"],
    proRequiredLanes: ["second native-market provider", "venue/cadence check", "network status lane"],
    advancedRequiredLanes: ["venue depth", "cross-venue divergence", "contradiction table", "independent review status"],
    forbiddenCustomerClaims: ["ERC20 owner", "honeypot", "sell tax", "mint/blacklist controls"],
    noScopeClaims: ["ETH native asset has ERC20 owner risk", "missing contract lane is proof of danger"],
    static35Rule: "ETH source gaps cap confidence and must not turn into ERC20 contract danger language.",
  },
  {
    canonical: "SOL",
    family: "native_crypto",
    aliases: ["sol", "solana"],
    requiredPrimaryLanes: ["native market quote", "network identity", "timestamp/freshness", "source confidence"],
    proRequiredLanes: ["second native-market provider", "venue/cadence check", "network incident lane"],
    advancedRequiredLanes: ["venue depth", "cross-venue divergence", "network status source", "independent review status"],
    forbiddenCustomerClaims: ["ERC20 owner", "honeypot", "sell tax", "mint/blacklist controls"],
    noScopeClaims: ["SOL native asset has ERC20 token-admin risk", "missing EVM contract is proof of danger"],
    static35Rule: "SOL score separates network/source confidence from token-contract risk.",
  },
  {
    canonical: "NVDA",
    family: "equity",
    aliases: ["nvda", "nvidia"],
    requiredPrimaryLanes: ["equity quote", "market session timestamp", "source confidence", "issuer identity"],
    proRequiredLanes: ["second quote provider", "volume/candle cadence", "filing/news freshness"],
    advancedRequiredLanes: ["provider divergence", "event/news source table", "independent anomaly review status", "independent review status"],
    forbiddenCustomerClaims: ["DEX liquidity", "wallet holders", "contract permissions", "honeypot", "token tax"],
    noScopeClaims: ["NVDA has token tax", "NVDA wallet holders prove risk", "DEX slippage applies to listed equity"],
    static35Rule: "NVDA 35-like output is data-confidence placeholder unless market anomaly evidence exists.",
  },
  {
    canonical: "SPY",
    family: "etf",
    aliases: ["spy", "spdr s&p 500", "spdr sp500"],
    requiredPrimaryLanes: ["ETF quote", "benchmark identity", "timestamp/freshness", "source confidence"],
    proRequiredLanes: ["second quote provider", "holdings/composition freshness", "benchmark cadence"],
    advancedRequiredLanes: ["provider divergence", "holdings appendix", "macro/breadth context", "independent review status"],
    forbiddenCustomerClaims: ["token contract", "DEX liquidity", "wallet holder clusters", "mint/blacklist controls"],
    noScopeClaims: ["SPY has contract owner risk", "SPY DEX liquidity is missing", "wallet holders define ETF risk"],
    static35Rule: "SPY score is ETF review priority, not token-contract danger.",
  },
  {
    canonical: "S&P 500",
    family: "index",
    aliases: ["s&p 500", "s&p500", "sp500", "^gspc", "gspc", "standard and poor"],
    requiredPrimaryLanes: ["index quote", "index identity", "timestamp/freshness", "source confidence"],
    proRequiredLanes: ["second index provider", "macro/breadth source", "session/cadence"],
    advancedRequiredLanes: ["provider divergence", "methodology/source appendix", "macro/breadth context", "independent review status"],
    forbiddenCustomerClaims: ["wallet holders", "token contract", "DEX liquidity", "transfer tax"],
    noScopeClaims: ["S&P 500 has token contract risk", "missing DEX source proves danger", "wallet holders apply to the index"],
    static35Rule: "S&P 500 score is a review-priority marker until index freshness and macro lanes are sourced.",
  },
];

const PASS2284_DEPTH_RULES: Record<Pass2284Depth, {
  minConfirmedSources: number;
  paidRequired: boolean;
  customerShape: string[];
  redactedIfUnpaid: string[];
}> = {
  basic: {
    minConfirmedSources: 1,
    paidRequired: false,
    customerShape: ["asset family", "primary source", "risk vs confidence", "top 3 gaps", "next safe check"],
    redactedIfUnpaid: ["operator appendix", "independent review status", "full provider contradiction ledger"],
  },
  pro: {
    minConfirmedSources: 2,
    paidRequired: false,
    customerShape: ["controlled-beta scope", "asset family", "source cadence", "second-provider status", "score drivers", "top gaps", "next checks"],
    redactedIfUnpaid: ["independent review status", "controlled evidence packet", "full contradiction ledger"],
  },
  advanced: {
    minConfirmedSources: 2,
    paidRequired: false,
    customerShape: ["unreleased scope", "evidence table", "contradiction scan", "severity", "remediation", "source confidence", "independent-review status"],
    redactedIfUnpaid: ["controlled evidence table", "operator notes", "independent review status", "full contradiction ledger"],
  },
};

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function textIncludes(text: string, patterns: string[]) {
  const lower = text.toLowerCase();
  return patterns.filter((pattern) => lower.includes(pattern.toLowerCase()));
}

export function detectPass2284Asset(text = "") {
  const lower = text.toLowerCase();
  return PASS2284_FIXTURES.find((fixture) => [fixture.canonical, ...fixture.aliases].some((alias) => lower.includes(alias.toLowerCase()))) ?? null;
}

function defaultFixture(assetText = ""): Pass2284Fixture {
  const looksToken = /0x[a-f0-9]{40}|contract|token|erc20|solana token/i.test(assetText);
  return {
    canonical: clean(assetText).slice(0, 40) || "unconfirmed asset",
    family: looksToken ? "token_contract" : "unknown",
    aliases: [],
    requiredPrimaryLanes: ["asset identity", "primary source", "timestamp/freshness", "source confidence"],
    proRequiredLanes: ["second source", "source cadence", "missing-data lane"],
    advancedRequiredLanes: ["contract/admin evidence", "holder/liquidity evidence", "contradiction table", "independent review status"],
    forbiddenCustomerClaims: ["guaranteed safe", "guaranteed profit", "certificate", "wallet connect proves payment"],
    noScopeClaims: ["final verdict without sources", "fake certification", "payment unlock from wallet connect only"],
    static35Rule: "Unknown scope uses review-priority score only until identity, primary source and second source are confirmed.",
  };
}

export function buildPass2284LiveOutputQualityLedger(args: {
  surface: Pass2284Surface;
  depth: Pass2284Depth;
  assetText?: string | null;
  confirmedSources?: string[] | null;
  missingLanes?: string[] | null;
  rawScore?: number | null;
  confidenceCap?: number | null;
  paidAccessVerified?: boolean | null;
  customerOutputText?: string | null;
}) {
  const fixture = detectPass2284Asset(args.assetText ?? "") ?? defaultFixture(args.assetText ?? "");
  const depthRule = PASS2284_DEPTH_RULES[args.depth];
  const confirmed = independentProviderFamilies(args.confirmedSources);
  const sourceCount = confirmed.length;
  const baseMissing = args.depth === "basic"
    ? fixture.requiredPrimaryLanes
    : args.depth === "pro"
      ? [...fixture.requiredPrimaryLanes, ...fixture.proRequiredLanes]
      : [...fixture.requiredPrimaryLanes, ...fixture.proRequiredLanes, ...fixture.advancedRequiredLanes];
  const explicitMissing = unique(args.missingLanes ?? []);
  const missing = unique(explicitMissing.length ? explicitMissing : baseMissing).slice(0, args.depth === "basic" ? 5 : args.depth === "pro" ? 10 : 16);
  const paidLocked = vlmTierPaidLocked(args.depth, args.paidAccessVerified);
  const rawScore = typeof args.rawScore === "number" && Number.isFinite(args.rawScore) ? clamp(args.rawScore) : null;
  const providedCap = typeof args.confidenceCap === "number" && Number.isFinite(args.confidenceCap) ? clamp(args.confidenceCap) : null;
  const derivedCap = clamp(34 + Math.min(sourceCount, 4) * 13 - Math.min(missing.length, 10) * 3 + (sourceCount >= depthRule.minConfirmedSources ? 10 : 0));
  const confidenceCap = providedCap ?? derivedCap;
  const static35Detected = rawScore !== null && rawScore >= 33 && rawScore <= 37 && (sourceCount < depthRule.minConfirmedSources || missing.length >= 3);
  const displayedRisk = static35Detected
    ? fixture.family === "native_crypto"
      ? 24
      : fixture.family === "equity"
        ? 26
        : fixture.family === "etf" || fixture.family === "index"
          ? 28
          : rawScore
    : rawScore;
  const outputText = clean(args.customerOutputText);
  const forbiddenHits = outputText ? textIncludes(outputText, fixture.forbiddenCustomerClaims) : [];
  const noScopeHits = outputText ? textIncludes(outputText, fixture.noScopeClaims) : [];
  const hardBlockers = unique([
    ...forbiddenHits.map((claim) => `forbidden customer claim: ${claim}`),
    ...noScopeHits.map((claim) => `no-scope claim: ${claim}`),
    args.depth === "advanced" ? "Advanced is not for sale" : paidLocked ? "Pro controlled-beta evidence requested without server-bound invitation entitlement" : null,
    args.depth !== "basic" && sourceCount < depthRule.minConfirmedSources ? "not enough independent confirmed sources for this tier" : null,
  ]);
  const productionState = args.depth === "advanced"
    ? "not_for_sale_redacted"
    : paidLocked
      ? "invitation_locked_redacted"
    : hardBlockers.length
      ? "needs_rewrite_before_customer"
      : sourceCount >= depthRule.minConfirmedSources && confidenceCap >= 70
        ? "customer_ready_source_bound"
        : sourceCount > 0
          ? "customer_ready_confidence_capped"
          : "source_gap_triage_only";
  return {
    schemaVersion: PASS2284_LIVE_OUTPUT_QUALITY_LEDGER_ID,
    surface: args.surface,
    depth: args.depth,
    auditPriceEur: vlmTierPriceEur(args.depth),
    tierPriceEur: vlmTierPriceEur(args.depth),
    asset: fixture.canonical,
    family: fixture.family,
    confirmedSources: confirmed,
    sourceCount,
    minConfirmedSources: depthRule.minConfirmedSources,
    missingLanes: missing,
    confidenceCap,
    rawScore,
    displayedRisk,
    static35Detected,
    static35Rule: static35Detected ? fixture.static35Rule : "Risk score is review priority; source confidence decides how strong the wording may be.",
    customerShape: depthRule.customerShape,
    forbiddenCustomerClaims: fixture.forbiddenCustomerClaims,
    blockedClaimsDetected: hardBlockers,
    productionState,
    paidRequired: vlmTierRequiresPayment(args.depth),
    paidAccessVerified: Boolean(args.paidAccessVerified),
    paidLocked,
    redactedIfUnpaid: paidLocked ? depthRule.redactedIfUnpaid : [],
    paymentBoundary: args.depth === "basic"
      ? "Basic is a free limited prescreen; no checkout, certification, or safety guarantee."
      : args.depth === "pro"
        ? "Pro is an invitation-only controlled beta; server-bound invitation entitlement and internal quality control are required. Public checkout and wallet connect do not unlock it."
        : "Advanced is not for sale; no payment marker, entitlement, wallet connection, or legacy product ID may unlock it.",
    nextRepair: hardBlockers.length
      ? "Rewrite customer output before display; show sources/gaps first and remove forbidden/no-scope claims."
      : static35Detected
        ? "Display static-35 as source-gap review priority, not live danger proof."
        : sourceCount < depthRule.minConfirmedSources
          ? "Add independent source lane or lower confidence wording."
          : "Keep answer minimal, source-bound and tier-specific.",
  } as const;
}

export function buildPass2284AngelDirective(locale: "pl" | "en" | "de") {
  if (locale === "pl") {
    return "PASS2284: Angel najpierw pokazuje rodzinę aktywa, potwierdzone źródła, braki i limit pewności; dopiero potem krótki werdykt. Pro jest betą wyłącznie na zaproszenie, Advanced nie jest na sprzedaż, a publiczny checkout jest wyłączony.";
  }
  if (locale === "de") {
    return "PASS2284: Angel zeigt zuerst Asset-Familie, bestätigte Quellen, fehlende Nachweise und Konfidenzgrenze; erst danach ein kurzes Urteil. Pro ist eine Beta nur auf Einladung, Advanced ist nicht zum Verkauf und der öffentliche Checkout ist deaktiviert.";
  }
  return "PASS2284: Angel shows asset family, confirmed sources, missing evidence, and a confidence cap before any verdict. Pro is invitation-only controlled beta, Advanced is not for sale, and public checkout is disabled.";
}

export function buildPass2284RegressionMatrix() {
  return {
    schemaVersion: PASS2284_LIVE_OUTPUT_QUALITY_LEDGER_ID,
    auditPriceEur: null,
    sampleAssets: PASS2284_FIXTURES.map((fixture) => `${fixture.canonical}:${fixture.family}`),
    depthRules: PASS2284_DEPTH_RULES,
    assertions: [
      "Every customer answer shows asset family, confirmed sources, missing lanes and confidence before verdict.",
      "Basic/Pro/Advanced differ by source budget, sections and redaction boundary.",
      "BTC/ETH/SOL do not receive ERC20 admin/holder/honeypot lanes without token-contract scope.",
      "NVDA/SPY/S&P500 do not receive DEX, wallet-holder or token-tax language.",
      "A static 35-like score is reframed as source-gap review priority when independent sources are missing.",
      "Wallet connect and payment markers never unlock current Pro or Advanced. Pro requires a server-bound invitation entitlement; Advanced remains not for sale.",
    ],
  } as const;
}

// PASS2284 markers: pass2284_live_output_quality_ledger_v1 · Advanced NOT_FOR_SALE Advanced server-side receipt · static35 source-gap · BTC ETH SOL no ERC20 lanes · NVDA SPY S&P500 no DEX holder lanes · wallet connect is not payment proof
