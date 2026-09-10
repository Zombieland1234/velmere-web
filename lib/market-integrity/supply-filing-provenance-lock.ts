import { createHash } from "node:crypto";
import type { TokenRiskResult, VelmereMarketAssetClass } from "./risk-types";
import type { Pass2484RuntimePremiumEvidenceHydration } from "./runtime-premium-evidence-hydrator";

export const PASS2488_SUPPLY_FILING_PROVENANCE_LOCK_ID = "supply-filing-provenance-lock-v1" as const;

export type Pass2488State = "paid_provenance_ready" | "qa_preview_only" | "watch" | "blocked" | "not_applicable";
export type Pass2488AssetFamily = "crypto" | "real_market" | "unknown";
export type Pass2488LaneState = "ready" | "watch" | "blocked" | "not_applicable";
export type Pass2488Lane = {
  id:
    | "crypto_supply_snapshot"
    | "crypto_holder_concentration"
    | "crypto_unlock_emission"
    | "real_market_sec_identity"
    | "real_market_sec_xbrl_freshness"
    | "real_market_fundamental_coverage"
    | "surface_provenance_parity";
  label: string;
  family: Pass2488AssetFamily | "all";
  requiredForPaidAdvanced: boolean;
  state: Pass2488LaneState;
  readyEvidence: string[];
  missingEvidence: string[];
  customerBoundary: string;
  operatorAction: string;
};


type Pass2488LaneInput = Omit<Pass2488Lane, "readyEvidence" | "missingEvidence"> & {
  readyEvidence: Array<string | false | null | undefined>;
  missingEvidence: Array<string | false | null | undefined>;
};

export type Pass2488SupplyFilingProvenanceLock = {
  version: typeof PASS2488_SUPPLY_FILING_PROVENANCE_LOCK_ID;
  state: Pass2488State;
  query?: string;
  symbol?: string;
  assetFamily: Pass2488AssetFamily;
  paidProvenanceAllowed: boolean;
  cryptoSupplyReady: boolean;
  cryptoHolderReady: boolean;
  cryptoUnlockReady: boolean;
  realSecIdentityReady: boolean;
  realSecXbrlFresh: boolean;
  realFundamentalCoverageReady: boolean;
  provenanceScore: number;
  readyLaneCount: number;
  watchLaneCount: number;
  blockedLaneCount: number;
  lanes: Pass2488Lane[];
  hardLocks: string[];
  customerVerdict: string;
  operatorVerdict: string;
  noOverclaimRules: string[];
  nextImplementationActions: string[];
  fingerprint: string;
  generatedAt: string;
};

type ExtendedResult = TokenRiskResult & {
  limitations?: string[];
  fundamentals?: {
    cik?: string | null;
    latestQuarter?: string | null;
    sharesOutstanding?: number | null;
    revenueTtm?: number | null;
    topHoldings?: unknown[];
    sectorAllocation?: unknown[];
    quality?: { state?: string; confidenceCap?: number; coverageScore?: number; latestQuarter?: string | null };
    secXbrl?: { state?: string; cik?: string | null; filingDate?: string | null; filingForm?: string | null; reportDate?: string | null; confidenceCap?: number; conceptCoverageScore?: number; missingConcepts?: string[] };
  };
};

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSymbol(value?: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function assetFamily(result?: TokenRiskResult | null, symbol?: string): Pass2488AssetFamily {
  const assetClass: VelmereMarketAssetClass | undefined = result?.token.assetClass;
  if (assetClass === "stock" || assetClass === "etf" || assetClass === "index" || assetClass === "fx" || assetClass === "commodity" || assetClass === "real_estate" || assetClass === "exchange_equity") return "real_market";
  const normalized = normalizeSymbol(symbol || result?.token.symbol);
  if (assetClass === "crypto" || result?.token.chainId || result?.token.tokenAddress || result?.token.pairAddress || result?.token.dexId) return "crypto";
  if (["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK", "PEPE", "LTC", "TRX"].includes(normalized)) return "crypto";
  return "unknown";
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function compactNumber(value?: number) {
  if (!Number.isFinite(value)) return "source required";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(Number(value));
}

function hasText(items: string[], pattern: RegExp) {
  return items.some((item) => pattern.test(item));
}

function resultLimitations(result?: TokenRiskResult | null) {
  const ext = result as ExtendedResult | null | undefined;
  return unique([...(result?.metaModel?.limitations ?? []), ...(ext?.limitations ?? [])]);
}

function lane(args: Pass2488LaneInput): Pass2488Lane {
  return {
    ...args,
    readyEvidence: unique(args.readyEvidence).slice(0, 10),
    missingEvidence: unique(args.missingEvidence).slice(0, 12),
  };
}

function cryptoSupplyLane(family: Pass2488AssetFamily, result?: TokenRiskResult | null): Pass2488Lane {
  const applies = family === "crypto";
  const circulating = finite(result?.metrics.circulatingSupply);
  const total = finite(result?.metrics.totalSupply);
  const max = finite(result?.metrics.maxSupply);
  const supplyCount = [circulating, total, max].filter((item) => item !== undefined).length;
  const hasSource = hasText(result?.dataSources ?? [], /coingecko|coinmarketcap|supply|market/i);
  const state: Pass2488LaneState = !applies ? "not_applicable" : supplyCount >= 2 && hasSource ? "ready" : supplyCount >= 1 ? "watch" : "blocked";
  return lane({
    id: "crypto_supply_snapshot",
    label: "Supply snapshot: circulating, total and max supply",
    family: "crypto",
    requiredForPaidAdvanced: applies,
    state,
    readyEvidence: [
      circulating !== undefined && `circulating ${compactNumber(circulating)}`,
      total !== undefined && `total ${compactNumber(total)}`,
      max !== undefined && `max ${compactNumber(max)}`,
      hasSource && "market/supply provider source observed",
    ],
    missingEvidence: [
      applies && circulating === undefined && "circulating supply snapshot",
      applies && total === undefined && "total supply snapshot",
      applies && max === undefined && "max supply or explicit infinite/not-applicable flag",
      applies && !hasSource && "supply source lineage, not only table value",
    ],
    customerBoundary: "Supply can support context only when the source, timestamp and missing max/total rules are visible.",
    operatorAction: "Attach CoinGecko markets + supply-chart lineage or an explicit provider not-applicable rule before Advanced says supply pressure is confirmed.",
  });
}

function cryptoHolderLane(family: Pass2488AssetFamily, result?: TokenRiskResult | null): Pass2488Lane {
  const applies = family === "crypto";
  const holderCount = finite(result?.metrics.holderCount);
  const top10 = finite(result?.metrics.top10HolderPercent);
  const nativeCoin = !result?.token.tokenAddress && !result?.token.pairAddress && !result?.token.dexId;
  const hasHolderMetric = holderCount !== undefined || top10 !== undefined;
  const state: Pass2488LaneState = !applies ? "not_applicable" : hasHolderMetric ? "ready" : nativeCoin ? "watch" : "blocked";
  return lane({
    id: "crypto_holder_concentration",
    label: "Holder concentration and role labels",
    family: "crypto",
    requiredForPaidAdvanced: applies,
    state,
    readyEvidence: [
      holderCount !== undefined && `${compactNumber(holderCount)} holders`,
      top10 !== undefined && `top10 ${top10.toFixed(top10 < 10 ? 1 : 0)}%`,
      nativeCoin && "native coin: ERC20 holder table not forced, but concentration methodology must be disclosed",
    ],
    missingEvidence: [
      applies && !hasHolderMetric && !nativeCoin && "holder count or top-holder concentration snapshot",
      applies && !hasHolderMetric && nativeCoin && "native-coin concentration methodology / exchange-custody boundary",
      applies && "wallet role labels: CEX/custody/team/LP/treasury/unknown",
      applies && "holder snapshot timestamp and replay fingerprint",
    ],
    customerBoundary: "A native coin may not have a simple ERC20 holder table, but Advanced must explain that boundary instead of pretending concentration is solved.",
    operatorAction: "For tokens, wire explorer/top-holder provider; for native coins, show explicit methodology boundary and custody/exchange-label gap.",
  });
}

function cryptoUnlockLane(family: Pass2488AssetFamily, result?: TokenRiskResult | null): Pass2488Lane {
  const applies = family === "crypto";
  const limitations = resultLimitations(result);
  const sources = result?.dataSources ?? [];
  const nativeCoin = !result?.token.tokenAddress && !result?.token.pairAddress && !result?.token.dexId;
  const hasMax = finite(result?.metrics.maxSupply) !== undefined;
  const explicitUnlock = hasText([...sources, ...limitations], /unlock|vesting|emission|schedule|tokenomics|supply chart|circulating_supply_chart|total_supply_chart/i);
  const state: Pass2488LaneState = !applies ? "not_applicable" : explicitUnlock || (nativeCoin && hasMax) ? "watch" : "blocked";
  return lane({
    id: "crypto_unlock_emission",
    label: "Unlock, vesting and emission boundary",
    family: "crypto",
    requiredForPaidAdvanced: applies,
    state,
    readyEvidence: [
      explicitUnlock && "unlock/emission/supply-chart lane surfaced",
      nativeCoin && hasMax && "native coin with max-supply boundary present",
    ],
    missingEvidence: [
      applies && !explicitUnlock && "unlock/vesting/emission schedule or explicit not-applicable reason",
      applies && "large holder unlock/event calendar if token has team/treasury allocations",
      applies && "paid PDF/Shield/Angel must show this as missing when unavailable",
    ],
    customerBoundary: "Unlock data is not a price forecast; it is only a source-bound supply-pressure context lane.",
    operatorAction: "Wire tokenomics/unlock source or a native-coin emission boundary before holder/supply can become a paid Advanced-ready lane.",
  });
}

function realSecIdentityLane(family: Pass2488AssetFamily, result?: TokenRiskResult | null, pass2484?: Pass2484RuntimePremiumEvidenceHydration | null): Pass2488Lane {
  const applies = family === "real_market";
  const ext = result as ExtendedResult | null | undefined;
  const sec = ext?.fundamentals?.secXbrl;
  const cik = sec?.cik || ext?.fundamentals?.cik || null;
  const sources = result?.dataSources ?? [];
  const receipts = pass2484?.providerReceipts ?? [];
  const secSource = hasText(sources, /sec|edgar|xbrl|companyfacts|filing/i) || receipts.some((receipt) => /filing|fundamental|sec|xbrl/i.test(`${receipt.provider} ${receipt.sourceContract}`));
  const state: Pass2488LaneState = !applies ? "not_applicable" : cik && secSource ? "ready" : secSource || cik ? "watch" : "blocked";
  return lane({
    id: "real_market_sec_identity",
    label: "SEC identity, CIK and filing source lineage",
    family: "real_market",
    requiredForPaidAdvanced: applies,
    state,
    readyEvidence: [cik && `CIK ${cik}`, secSource && "SEC/filing/fundamental source surfaced"],
    missingEvidence: [
      applies && !cik && "CIK / issuer identity mapping",
      applies && !secSource && "SEC EDGAR/companyfacts or issuer filing source lineage",
      applies && "filing URL and accession number for latest filing",
    ],
    customerBoundary: "A stock/ETF report is not premium just because price is live; issuer identity and filing lineage must be visible.",
    operatorAction: "Use SEC submissions/companyfacts with SEC_USER_AGENT for US equities/ETFs, and mark non-US instruments as filing-source-required.",
  });
}

function realSecXbrlFreshnessLane(family: Pass2488AssetFamily, result?: TokenRiskResult | null): Pass2488Lane {
  const applies = family === "real_market";
  const ext = result as ExtendedResult | null | undefined;
  const sec = ext?.fundamentals?.secXbrl;
  const stateValue = sec?.state ?? "";
  const coverage = finite(sec?.conceptCoverageScore) ?? finite(sec?.confidenceCap);
  const filingDate = sec?.filingDate ?? null;
  const aligned = /sec_aligned|sec_partial/i.test(stateValue);
  const limitations = resultLimitations(result);
  const gapSurfaced = hasText(limitations, /sec|xbrl|companyfacts|filing|latest filing/i);
  const state: Pass2488LaneState = !applies ? "not_applicable" : aligned && filingDate && (coverage ?? 0) >= 45 ? "ready" : aligned || filingDate || gapSurfaced ? "watch" : "blocked";
  return lane({
    id: "real_market_sec_xbrl_freshness",
    label: "SEC/XBRL concept coverage and filing freshness",
    family: "real_market",
    requiredForPaidAdvanced: applies,
    state,
    readyEvidence: [
      aligned && `SEC/XBRL ${stateValue}`,
      coverage !== undefined && `concept coverage ${coverage}/100`,
      filingDate && `latest filing ${filingDate}`,
      gapSurfaced && "SEC/XBRL gap visibly surfaced",
    ],
    missingEvidence: [
      applies && !aligned && "SEC Companyfacts concept extraction",
      applies && !filingDate && "latest filing date/report date",
      applies && (coverage ?? 0) < 45 && "minimum concept coverage for revenue/net income/assets/cash flow",
      applies && "freshness cap if the filing is stale",
    ],
    customerBoundary: "SEC/XBRL is a filings evidence lane, not a trade recommendation; missing concepts must lower confidence.",
    operatorAction: "Attach Companyfacts + submissions metadata and surface missing concepts before Real Markets Advanced can use premium fundamentals wording.",
  });
}

function realFundamentalCoverageLane(family: Pass2488AssetFamily, result?: TokenRiskResult | null): Pass2488Lane {
  const applies = family === "real_market";
  const ext = result as ExtendedResult | null | undefined;
  const fundamentals = ext?.fundamentals;
  const quality = fundamentals?.quality;
  const sources = result?.dataSources ?? [];
  const limitations = resultLimitations(result);
  const qualityCap = finite(quality?.confidenceCap) ?? finite(quality?.coverageScore);
  const hasStatements = fundamentals && [fundamentals.revenueTtm, fundamentals.sharesOutstanding, fundamentals.latestQuarter].some(Boolean);
  const hasEtfHoldings = Array.isArray(fundamentals?.topHoldings) && fundamentals.topHoldings.length > 0;
  const sourceSeen = hasText(sources, /alpha vantage|fundamental|earnings|issuer|holdings|companyfacts/i);
  const gapSurfaced = hasText(limitations, /fundamental|alpha vantage|earnings|holdings|cash flow|balance sheet|shares outstanding/i);
  const state: Pass2488LaneState = !applies ? "not_applicable" : (hasStatements || hasEtfHoldings || sourceSeen) && (qualityCap ?? 50) >= 45 ? "ready" : sourceSeen || gapSurfaced || fundamentals ? "watch" : "blocked";
  return lane({
    id: "real_market_fundamental_coverage",
    label: "Fundamental/issuer or ETF holding coverage",
    family: "real_market",
    requiredForPaidAdvanced: applies,
    state,
    readyEvidence: [
      sourceSeen && "fundamental/issuer/holdings source observed",
      hasStatements && "statement/share metrics present",
      hasEtfHoldings && "ETF holdings present",
      qualityCap !== undefined && `quality cap ${qualityCap}/100`,
    ],
    missingEvidence: [
      applies && !sourceSeen && !hasStatements && !hasEtfHoldings && "fundamental provider or issuer/ETF holdings payload",
      applies && "four-quarter freshness / latest quarter",
      applies && "shares outstanding or ETF holdings exposure where applicable",
    ],
    customerBoundary: "Fundamentals can improve context only when coverage and freshness are shown; otherwise Advanced stays a missing-proof map.",
    operatorAction: "Hydrate Alpha Vantage/issuer holdings and compare against SEC concepts before paid Real Markets Advanced wording.",
  });
}

function surfaceParityLane(family: Pass2488AssetFamily, result?: TokenRiskResult | null, pass2484?: Pass2484RuntimePremiumEvidenceHydration | null): Pass2488Lane {
  const hasTimestamp = Boolean(result?.generatedAt || pass2484?.generatedAt);
  const hasReceipt = Boolean(pass2484?.fingerprint || pass2484?.providerReceipts?.length);
  const state: Pass2488LaneState = family === "unknown" ? "blocked" : hasTimestamp && hasReceipt ? "watch" : hasTimestamp || hasReceipt ? "watch" : "blocked";
  return lane({
    id: "surface_provenance_parity",
    label: "Surface provenance parity: Shield/Real Markets, PDF, Brain and Angel",
    family: "all",
    requiredForPaidAdvanced: family !== "unknown",
    state,
    readyEvidence: [hasTimestamp && "runtime timestamp present", pass2484?.fingerprint && `PASS2484 ${pass2484.fingerprint}`, hasReceipt && "runtime provider receipt present"],
    missingEvidence: [
      !hasTimestamp && "observedAt/generatedAt timestamp",
      !hasReceipt && "runtime provider receipt/fingerprint",
      "same PASS2488 fingerprint shown in API, modal, PDF header and Angel context",
    ],
    customerBoundary: "The same provenance fingerprint must appear across all customer surfaces before paid copy is allowed.",
    operatorAction: "Write PASS2488 fingerprint into source-sync, modal proof strip, PDF headers and Angel guard; downgrade if any surface drifts.",
  });
}

export function buildPass2488SupplyFilingProvenanceLock(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  pass2484?: Pass2484RuntimePremiumEvidenceHydration | null;
  now?: Date;
} = {}): Pass2488SupplyFilingProvenanceLock {
  const now = args.now ?? new Date();
  const symbol = normalizeSymbol(args.symbol || args.result?.token.symbol || args.query);
  const family = assetFamily(args.result, symbol);
  const lanes = [
    cryptoSupplyLane(family, args.result),
    cryptoHolderLane(family, args.result),
    cryptoUnlockLane(family, args.result),
    realSecIdentityLane(family, args.result, args.pass2484),
    realSecXbrlFreshnessLane(family, args.result),
    realFundamentalCoverageLane(family, args.result),
    surfaceParityLane(family, args.result, args.pass2484),
  ];
  const required = lanes.filter((item) => item.requiredForPaidAdvanced && item.state !== "not_applicable");
  const readyLaneCount = required.filter((item) => item.state === "ready").length;
  const watchLaneCount = required.filter((item) => item.state === "watch").length;
  const blockedLaneCount = required.filter((item) => item.state === "blocked").length;
  const requiredCount = Math.max(1, required.length);
  const provenanceScore = clamp((readyLaneCount / requiredCount) * 76 + (watchLaneCount / requiredCount) * 20 - blockedLaneCount * 9);
  const cryptoSupplyReady = lanes.find((item) => item.id === "crypto_supply_snapshot")?.state === "ready";
  const cryptoHolderReady = lanes.find((item) => item.id === "crypto_holder_concentration")?.state === "ready";
  const cryptoUnlockReady = lanes.find((item) => item.id === "crypto_unlock_emission")?.state === "ready";
  const realSecIdentityReady = lanes.find((item) => item.id === "real_market_sec_identity")?.state === "ready";
  const realSecXbrlFresh = lanes.find((item) => item.id === "real_market_sec_xbrl_freshness")?.state === "ready";
  const realFundamentalCoverageReady = lanes.find((item) => item.id === "real_market_fundamental_coverage")?.state === "ready";
  const paidProvenanceAllowed = family !== "unknown" && required.length > 0 && blockedLaneCount === 0 && required.every((item) => item.state === "ready") && provenanceScore >= 82;
  const state: Pass2488State = paidProvenanceAllowed
    ? "paid_provenance_ready"
    : family === "unknown"
      ? "blocked"
      : blockedLaneCount >= Math.ceil(required.length * 0.6)
        ? "blocked"
        : readyLaneCount > 0 || watchLaneCount > 1
          ? "qa_preview_only"
          : "watch";
  const hardLocks = unique(required.filter((item) => item.state !== "ready").flatMap((item) => item.missingEvidence.map((missing) => `${item.label}: ${missing}`))).slice(0, 18);
  const fingerprint = `PASS2488-${hash({ query: args.query, symbol, family, state, provenanceScore, lanes: lanes.map((item) => [item.id, item.state]) })}`;
  return {
    version: PASS2488_SUPPLY_FILING_PROVENANCE_LOCK_ID,
    state,
    query: args.query,
    symbol,
    assetFamily: family,
    paidProvenanceAllowed,
    cryptoSupplyReady,
    cryptoHolderReady,
    cryptoUnlockReady,
    realSecIdentityReady,
    realSecXbrlFresh,
    realFundamentalCoverageReady,
    provenanceScore,
    readyLaneCount,
    watchLaneCount,
    blockedLaneCount,
    lanes,
    hardLocks,
    customerVerdict: paidProvenanceAllowed
      ? "Supply/holder or filing/fundamental provenance is strong enough to support paid Advanced depth, still without investment advice."
      : "Advanced stays QA preview / missing-proof map for supply, holder, filing or fundamental provenance until PASS2488 is ready.",
    operatorVerdict: paidProvenanceAllowed
      ? "Keep the PASS2488 fingerprint identical across source-sync, modal, PDF and Angel."
      : `Do not sell supply/fundamental claims as completed. Close PASS2488 locks: ${hardLocks.slice(0, 5).join(" · ") || "provenance lane missing"}.`,
    noOverclaimRules: [
      "Coin/stock price freshness does not prove supply, holder, filing or fundamental freshness.",
      "Native coins need explicit concentration-methodology boundaries; do not fake ERC20-style holder certainty.",
      "Token holder snapshots require wallet role labels before concentration can sound conclusive.",
      "Stocks and ETFs need SEC/issuer identity, filing freshness and fundamentals/holdings coverage before paid verdict copy.",
      "PASS2488 is a provenance lock; it is not financial advice, an entry/exit signal or a safety certificate.",
    ],
    nextImplementationActions: unique([
      family === "crypto" && "Wire CoinGecko supply-chart lineage and explicit max/total/infinite supply boundary.",
      family === "crypto" && "Add explorer/top-holder source with CEX/LP/team/unknown labels and holder snapshot timestamp.",
      family === "crypto" && "Add unlock/emission schedule source or native-coin not-applicable rule.",
      family === "real_market" && "Wire SEC submissions/companyfacts with SEC_USER_AGENT and latest filing URL/accession number.",
      family === "real_market" && "Attach Alpha Vantage/issuer fundamentals or ETF holdings and compare coverage with SEC concepts.",
      "Show PASS2488 fingerprint in API, modal proof strip, PDF headers and Angel guard.",
    ]).slice(0, 10),
    fingerprint,
    generatedAt: now.toISOString(),
  };
}
