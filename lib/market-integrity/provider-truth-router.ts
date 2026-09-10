import {
  fetchBinanceKlines,
  type BinanceKlineInterval,
} from "./binance-klines";
import { fetchCoinGeckoMarkets } from "./coingecko";
import {
  buildPass460ProviderConsensus,
  type Pass460ConsensusState,
  type Pass460FreshnessState,
} from "./provider-consensus";
import {
  isPass459AlphaVantageConfigured,
  resolvePass459AlphaVantageSnapshot,
  type Pass459ProviderEvidence,
  type Pass459ProviderState,
  type Pass459Fundamentals,
} from "./alpha-vantage-provider";
import {
  resolvePass461VenueHealthWithFallback,
  type Pass461VenueHealthSnapshot,
  type Pass461VenueId,
} from "./venue-health-runtime";
import {
  buildPass462CrossVenueComparison,
  preferredPass462SecondaryVenue,
  type Pass462CrossVenueComparison,
} from "./cross-venue-consensus";
import {
  normalizePass463AssetSymbol,
  pass463CanonicalPairCoverageContract,
} from "./canonical-pair-coverage";

export type Pass458TruthAssetClass =
  | "crypto"
  | "stock"
  | "index"
  | "fx"
  | "etf"
  | "commodity"
  | "real_estate"
  | "exchange_equity"
  | "venue_health";

export type Pass458TruthState =
  | "source_bound"
  | "compatibility_adapter"
  | "source_required"
  | "provider_error";

export type Pass458Candle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type Pass458LegacyQuote = {
  id: string;
  symbol: string;
  state: "live" | "unavailable";
  source: string;
  sourceTimestamp: number | null;
  exchange: string | null;
  currency: string | null;
  currentPrice: number | null;
  changePercent: number | null;
  candles: Pass458Candle[];
  marketCap?: number | null;
  volume24h?: number | null;
  high24h?: number | null;
  low24h?: number | null;
  priceChange1h?: number | null;
  priceChange24h?: number | null;
  priceChange7d?: number | null;
};

export type Pass458TruthQuote = Pass458LegacyQuote & {
  assetClass: Pass458TruthAssetClass;
  truthState: Pass458TruthState;
  providerKind:
    | "coingecko_market"
    | "binance_klines"
    | "alpha_vantage_required"
    | "alpha_vantage_market"
    | "alpha_vantage_fx"
    | "alpha_vantage_commodity"
    | "venue_health_required"
    | "binance_venue_health"
    | "mexc_venue_health"
    | "coinbase_venue_health"
    | "venue_health_unsupported"
    | "compatibility_yahoo"
    | "provider_pending";
  sourceContract: string;
  sourcePolicy: string;
  providerPlan: string[];
  missingReason: string | null;
  secondSourceRequired: boolean;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  high24h: number | null;
  low24h: number | null;
  priceChange1h: number | null;
  priceChange24h: number | null;
  priceChange7d: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  docs: string[];
  providerStatus: Pass459ProviderState;
  primaryProviderConfigured: boolean;
  providerFunctions: string[];
  providerEvidence: Pass459ProviderEvidence[];
  fundamentals?: Pass459Fundamentals;
  consensusState: Pass460ConsensusState;
  freshnessState: Pass460FreshnessState;
  freshnessSeconds: number | null;
  divergenceBps: number | null;
  divergenceThresholdBps: number;
  confidenceCap: number;
  primaryPrice: number | null;
  secondaryPrice: number | null;
  secondarySource: string | null;
  consensusNotes: string[];
  venueHealth?: Pass461VenueHealthSnapshot | null;
  venueComparison?: Pass462CrossVenueComparison | null;
};

export type Pass458ProviderRoute = {
  assetClass: Pass458TruthAssetClass;
  normalizedSymbol: string;
  baseSymbol: string;
  coingeckoId?: string;
  sourceContract: string;
  sourcePolicy: string;
  providerPlan: string[];
  providerKind: Pass458TruthQuote["providerKind"];
  secondSourceRequired: boolean;
};

export type Pass458RangeKey = "15m" | "1h" | "4h" | "1d" | "1w" | "1mo";

type CompatibilityLoader = (
  id: string,
  symbol: string,
  rangeKey: Pass458RangeKey,
) => Promise<Pass458LegacyQuote>;

function consensusFields({
  assetClass,
  primaryPrice,
  secondaryPrice,
  sourceTimestamp,
  primaryLabel,
  secondaryLabel,
}: {
  assetClass: Pass458TruthAssetClass;
  primaryPrice: number | null | undefined;
  secondaryPrice: number | null | undefined;
  sourceTimestamp: number | null | undefined;
  primaryLabel: string;
  secondaryLabel?: string | null;
}) {
  const consensus = buildPass460ProviderConsensus({
    assetClass,
    primaryPrice,
    secondaryPrice,
    sourceTimestamp,
    primaryLabel,
    secondaryLabel,
  });
  return {
    consensusState: consensus.state,
    freshnessState: consensus.freshnessState,
    freshnessSeconds: consensus.freshnessSeconds,
    divergenceBps: consensus.divergenceBps,
    divergenceThresholdBps: consensus.divergenceThresholdBps,
    confidenceCap: consensus.confidenceCap,
    primaryPrice: consensus.primaryPrice,
    secondaryPrice: consensus.secondaryPrice,
    secondarySource: consensus.secondaryLabel,
    consensusNotes: consensus.notes,
  };
}


const PASS463_CONSENSUS_RANK: Record<Pass460ConsensusState, number> = {
  aligned: 0,
  watch: 1,
  single_source: 2,
  stale: 3,
  divergent: 4,
  unavailable: 5,
};

function stricterPass463Consensus(
  primary: Pass460ConsensusState,
  secondary?: Pass460ConsensusState | null,
): Pass460ConsensusState {
  if (!secondary) return primary;
  return PASS463_CONSENSUS_RANK[secondary] > PASS463_CONSENSUS_RANK[primary]
    ? secondary
    : primary;
}

const CRYPTO_TO_COINGECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  LINK: "chainlink",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  XLM: "stellar",
  UNI: "uniswap",
  ATOM: "cosmos",
  NEAR: "near",
  AAVE: "aave",
  ETC: "ethereum-classic",
  USDT: "tether",
  USDC: "usd-coin",
};

const ETF_SYMBOLS = new Set([
  "SPY",
  "QQQ",
  "TLT",
  "HYG",
  "EFA",
  "GLD",
  "VNQ",
  "IYR",
  "XLRE",
]);
const REAL_ESTATE_SYMBOLS = new Set(["VNQ", "IYR", "XLRE", "PLD"]);
const EXCHANGE_EQUITIES = new Set([
  "COIN",
  "CME",
  "ICE",
  "NDAQ",
  "LSEG.L",
  "DB1.DE",
  "0388.HK",
]);
const COMMODITY_SYMBOLS = new Set([
  "GC=F",
  "SI=F",
  "CL=F",
  "BZ=F",
  "HG=F",
  "NG=F",
  "ZW=F",
  "PL=F",
  "CC=F",
  "KC=F",
  "XAU/USD",
  "XAG/USD",
  "WTI",
  "BRENT",
]);

function stripCryptoBase(symbol: string) {
  return symbol
    .trim()
    .toUpperCase()
    .replace(/[-_/]USD$/, "")
    .replace(/USDT$/, "")
    .replace(/[^A-Z0-9]/g, "");
}

function compactPlan(assetClass: Pass458TruthAssetClass): string[] {
  if (assetClass === "crypto") {
    return [
      "CoinGecko /coins/markets for price, market cap, FDV, supply and 24h volume.",
      "Binance spot klines for source-bound candles when the pair is available.",
      "Second venue comparison remains required before stronger AI copy.",
    ];
  }
  if (assetClass === "venue_health") {
    return [
      "Venue health is status/depth/websocket cadence, not a fake equity price.",
      "Binance/MEXC streams require ping-pong, reconnect and 24h expiry guards.",
      "Customer copy must say source gap or review priority, never solvency certainty.",
    ];
  }
  if (assetClass === "fx") {
    return [
      "FX uses reference/intraday rate providers, not market cap.",
      "Alpha Vantage FX endpoint or paid FX feed should supply the truth lane.",
      "Fallback chart data stays labelled as compatibility, not institutional live truth.",
    ];
  }
  if (assetClass === "commodity") {
    return [
      "Commodity rows need explicit contract method, expiry and exchange timestamp.",
      "Alpha Vantage commodity endpoints or futures provider should supply the truth lane.",
      "Fallback chart data stays labelled as compatibility until contract metadata is present.",
    ];
  }
  if (assetClass === "etf" || assetClass === "real_estate") {
    return [
      "ETF/REIT rows need quote, volume, holdings cadence and issuer/fund disclosure date.",
      "Alpha Vantage quote plus issuer/holdings lane should supply the truth lane.",
      "Market cap is fund/issuer proxy only when the provider exposes it explicitly.",
    ];
  }
  if (assetClass === "index") {
    return [
      "Index rows show index level and breadth/concentration later, not company market cap.",
      "Constituent breadth and weight concentration require a separate index provider.",
      "Fallback chart data stays labelled as compatibility.",
    ];
  }
  return [
    "Equity rows need quote, volume, market cap and issuer filing/disclosure timestamp.",
    "Alpha Vantage GLOBAL_QUOTE plus OVERVIEW/company disclosure is the production truth lane.",
    "Fallback chart data stays labelled as compatibility until the keyed provider is configured.",
  ];
}

export function classifyPass458ProviderRoute(
  id: string,
  symbol: string,
): Pass458ProviderRoute {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cleanId = id.trim().toLowerCase();
  const baseSymbol = stripCryptoBase(normalizedSymbol);

  if (/VENUE$/i.test(normalizedSymbol) || cleanId.includes("venue")) {
    return {
      assetClass: "venue_health",
      normalizedSymbol,
      baseSymbol,
      sourceContract:
        "Venue health route: status/depth/websocket cadence only; no fake exchange price.",
      sourcePolicy:
        "Requires exchange-specific REST/WebSocket adapter, timeout ledger, reconnect state and second-source comparison.",
      providerPlan: compactPlan("venue_health"),
      providerKind: "venue_health_required",
      secondSourceRequired: true,
    };
  }

  if (CRYPTO_TO_COINGECKO[baseSymbol]) {
    return {
      assetClass: "crypto",
      normalizedSymbol,
      baseSymbol,
      coingeckoId: CRYPTO_TO_COINGECKO[baseSymbol],
      sourceContract:
        "Crypto route: CoinGecko market snapshot plus Binance candle lane when available.",
      sourcePolicy:
        "Price/market-cap/volume/supply must come from a market-data endpoint, not AI filler.",
      providerPlan: compactPlan("crypto"),
      providerKind: "coingecko_market",
      secondSourceRequired: true,
    };
  }

  if (normalizedSymbol.includes("=X")) {
    return {
      assetClass: "fx",
      normalizedSymbol,
      baseSymbol,
      sourceContract:
        "FX route: rate provider and reference timestamp; market cap is not applicable.",
      sourcePolicy:
        "Do not render market cap for FX. Use spread/volatility/reference freshness instead.",
      providerPlan: compactPlan("fx"),
      providerKind: "alpha_vantage_required",
      secondSourceRequired: true,
    };
  }

  if (
    normalizedSymbol.startsWith("^") ||
    cleanId.includes("stoxx") ||
    cleanId.includes("nikkei")
  ) {
    return {
      assetClass: "index",
      normalizedSymbol,
      baseSymbol,
      sourceContract:
        "Index route: index level, breadth and constituent concentration; no issuer market cap.",
      sourcePolicy:
        "An index level is not a company valuation. Breadth needs a separate constituent provider.",
      providerPlan: compactPlan("index"),
      providerKind: "alpha_vantage_required",
      secondSourceRequired: true,
    };
  }

  if (COMMODITY_SYMBOLS.has(normalizedSymbol)) {
    return {
      assetClass: "commodity",
      normalizedSymbol,
      baseSymbol,
      sourceContract:
        "Commodity route: contract method, expiry and futures/spot source timestamp.",
      sourcePolicy:
        "Do not treat one futures proxy as a universal spot truth without method disclosure.",
      providerPlan: compactPlan("commodity"),
      providerKind: "alpha_vantage_required",
      secondSourceRequired: true,
    };
  }

  if (
    REAL_ESTATE_SYMBOLS.has(normalizedSymbol) ||
    ["vnq", "iyr", "xlre", "pld"].includes(cleanId)
  ) {
    return {
      assetClass: "real_estate",
      normalizedSymbol,
      baseSymbol,
      sourceContract:
        "Real estate route: REIT/ETF quote plus slow macro and disclosure cadence.",
      sourcePolicy:
        "Real estate is a slow macro lane; do not mix it with second-by-second venue alarms.",
      providerPlan: compactPlan("real_estate"),
      providerKind: "alpha_vantage_required",
      secondSourceRequired: true,
    };
  }

  if (ETF_SYMBOLS.has(normalizedSymbol)) {
    return {
      assetClass: "etf",
      normalizedSymbol,
      baseSymbol,
      sourceContract:
        "ETF route: fund quote, volume, holdings cadence and issuer disclosure.",
      sourcePolicy:
        "ETF rows need fund/holdings context before stronger risk copy.",
      providerPlan: compactPlan("etf"),
      providerKind: "alpha_vantage_required",
      secondSourceRequired: true,
    };
  }

  if (EXCHANGE_EQUITIES.has(normalizedSymbol)) {
    return {
      assetClass: "exchange_equity",
      normalizedSymbol,
      baseSymbol,
      sourceContract:
        "Listed exchange operator route: equity quote plus issuer filing; separate from venue health.",
      sourcePolicy:
        "A listed operator stock is not proof of venue solvency. Keep filing and venue lanes separate.",
      providerPlan: compactPlan("stock"),
      providerKind: "alpha_vantage_required",
      secondSourceRequired: true,
    };
  }

  return {
    assetClass: "stock",
    normalizedSymbol,
    baseSymbol,
    sourceContract:
      "Equity route: quote, volume, market cap and issuer filing timestamp.",
    sourcePolicy:
      "Stock analysis requires a keyed market-data provider plus issuer disclosure before stronger AI copy.",
    providerPlan: compactPlan("stock"),
    providerKind: "alpha_vantage_required",
    secondSourceRequired: true,
  };
}

function rangeToBinance(range: Pass458RangeKey): BinanceKlineInterval {
  if (range === "15m") return "15m";
  if (range === "1h") return "1h";
  if (range === "4h") return "4h";
  if (range === "1d") return "1d";
  if (range === "1mo") return "1mo";
  return "7d";
}

function emptyTruthQuote(
  id: string,
  symbol: string,
  route: Pass458ProviderRoute,
  missingReason: string,
): Pass458TruthQuote {
  return {
    id,
    symbol,
    state: "unavailable",
    source: "Velmère PASS458 Provider Truth Router",
    sourceTimestamp: null,
    exchange: null,
    currency: null,
    currentPrice: null,
    changePercent: null,
    candles: [],
    assetClass: route.assetClass,
    truthState:
      route.assetClass === "venue_health"
        ? "source_required"
        : "provider_error",
    providerKind: route.providerKind,
    sourceContract: route.sourceContract,
    sourcePolicy: route.sourcePolicy,
    providerPlan: route.providerPlan,
    missingReason,
    secondSourceRequired: route.secondSourceRequired,
    marketCap: null,
    fdv: null,
    volume24h: null,
    high24h: null,
    low24h: null,
    priceChange1h: null,
    priceChange24h: null,
    priceChange7d: null,
    circulatingSupply: null,
    totalSupply: null,
    maxSupply: null,
    docs: pass458ProviderTruthDocs(route.assetClass),
    providerStatus:
      route.assetClass === "venue_health"
        ? "unsupported"
        : isPass459AlphaVantageConfigured()
          ? "provider_error"
          : "not_configured",
    primaryProviderConfigured: isPass459AlphaVantageConfigured(),
    providerFunctions: [],
    providerEvidence: [],
    ...consensusFields({
      assetClass: route.assetClass,
      primaryPrice: null,
      secondaryPrice: null,
      sourceTimestamp: null,
      primaryLabel: "provider required",
    }),
  };
}

function venueIdFromRoute(id: string, symbol: string): Pass461VenueId | null {
  const value = `${id} ${symbol}`.toLowerCase();
  if (value.includes("binance")) return "binance";
  if (value.includes("mexc")) return "mexc";
  if (value.includes("coinbase")) return "coinbase";
  return null;
}

function upgradeVenueHealthQuote(
  id: string,
  symbol: string,
  route: Pass458ProviderRoute,
  snapshot: Pass461VenueHealthSnapshot,
  venueComparison: Pass462CrossVenueComparison | null,
): Pass458TruthQuote {
  const consensusState: Pass460ConsensusState =
    snapshot.state === "source_bound"
      ? "aligned"
      : snapshot.state === "review"
        ? "watch"
        : snapshot.state === "stale"
          ? "stale"
          : "unavailable";
  const freshnessState: Pass460FreshnessState =
    snapshot.freshnessSeconds === null
      ? "missing"
      : snapshot.freshnessSeconds <= 90
        ? "fresh"
        : snapshot.freshnessSeconds <= 270
          ? "aging"
          : "stale";
  const usable = snapshot.state !== "provider_error" && snapshot.state !== "unsupported";
  return {
    id,
    symbol,
    state: usable ? "live" : "unavailable",
    source: snapshot.source,
    sourceTimestamp: snapshot.sourceTimestamp,
    exchange: snapshot.venue,
    currency: null,
    currentPrice: null,
    changePercent: null,
    candles: [],
    assetClass: "venue_health",
    truthState: usable ? "source_bound" : "provider_error",
    providerKind:
      snapshot.venueId === "binance"
        ? "binance_venue_health"
        : snapshot.venueId === "mexc"
          ? "mexc_venue_health"
          : "coinbase_venue_health",
    sourceContract:
      "Venue health route: public REST connectivity, clock, ticker, depth and kline continuity with an explicit WebSocket lifecycle policy.",
    sourcePolicy:
      "Venue telemetry can describe freshness and market-data resilience; it cannot certify reserves, solvency, withdrawals or exchange safety.",
    providerPlan: [
      `Probe ${snapshot.venue} ping/time/ticker/book/depth/klines for ${snapshot.pair}.`,
      "Persist a redacted snapshot and quota ledger through Upstash REST when configured.",
      "Keep WebSocket heartbeat/reconnect lifecycle visible and compare against a neutral second venue before strong wording.",
    ],
    missingReason:
      snapshot.providerErrors.length > 0
        ? snapshot.providerErrors.join(" · ")
        : null,
    secondSourceRequired: true,
    marketCap: null,
    fdv: null,
    volume24h: snapshot.volume24h,
    high24h: null,
    low24h: null,
    priceChange1h: null,
    priceChange24h: snapshot.priceChange24h,
    priceChange7d: null,
    circulatingSupply: null,
    totalSupply: null,
    maxSupply: null,
    docs: pass458ProviderTruthDocs("venue_health"),
    providerStatus: usable ? "source_bound" : "provider_error",
    primaryProviderConfigured: true,
    providerFunctions: Array.from(
      new Set(snapshot.metrics.map((item) => item.source)),
    ).slice(0, 8),
    providerEvidence: snapshot.metrics.map((item) => ({
      label: item.label,
      value: item.value,
      source: item.source,
    })),
    consensusState: venueComparison?.state ?? consensusState,
    freshnessState,
    freshnessSeconds: snapshot.freshnessSeconds,
    divergenceBps: venueComparison?.priceDivergenceBps ?? null,
    divergenceThresholdBps: 75,
    confidenceCap: Math.min(
      snapshot.confidenceCap,
      venueComparison?.confidenceCap ?? snapshot.confidenceCap,
    ),
    primaryPrice: snapshot.referencePrice,
    secondaryPrice: null,
    secondarySource: venueComparison?.secondaryVenue ?? null,
    consensusNotes: venueComparison?.notes ?? [
      `${snapshot.venue} venue health ${snapshot.state} · score ${snapshot.healthScore}/100.`,
      `cache ${snapshot.cacheState} · storage ${snapshot.storageMode} · quota ${snapshot.quotaMode}.`,
      snapshot.boundary,
    ],
    venueHealth: snapshot,
    venueComparison,
  };
}

function upgradeCompatibilityQuote(
  quote: Pass458LegacyQuote,
  route: Pass458ProviderRoute,
  reason: string | null,
): Pass458TruthQuote {
  return {
    ...quote,
    assetClass: route.assetClass,
    truthState:
      quote.state === "live" ? "compatibility_adapter" : "source_required",
    providerKind:
      quote.state === "live" ? "compatibility_yahoo" : route.providerKind,
    source:
      quote.state === "live"
        ? `${quote.source} · compatibility fallback`
        : "Velmère PASS458 Provider Truth Router",
    sourceContract: route.sourceContract,
    sourcePolicy: route.sourcePolicy,
    providerPlan: route.providerPlan,
    missingReason:
      quote.state === "live"
        ? reason
        : (reason ??
          "Primary truth provider is not configured or unavailable."),
    secondSourceRequired: route.secondSourceRequired,
    marketCap: quote.marketCap ?? null,
    fdv: null,
    volume24h: quote.volume24h ?? null,
    high24h: quote.high24h ?? null,
    low24h: quote.low24h ?? null,
    priceChange1h: quote.priceChange1h ?? null,
    priceChange24h: quote.priceChange24h ?? quote.changePercent ?? null,
    priceChange7d: quote.priceChange7d ?? null,
    circulatingSupply: null,
    totalSupply: null,
    maxSupply: null,
    docs: pass458ProviderTruthDocs(route.assetClass),
    providerStatus: isPass459AlphaVantageConfigured()
      ? "provider_error"
      : "not_configured",
    primaryProviderConfigured: isPass459AlphaVantageConfigured(),
    providerFunctions: [],
    providerEvidence: [],
    ...consensusFields({
      assetClass: route.assetClass,
      primaryPrice: quote.currentPrice,
      secondaryPrice: null,
      sourceTimestamp: quote.sourceTimestamp,
      primaryLabel: quote.source,
    }),
  };
}

function upgradeAlphaVantageQuote(
  quote: Pass458LegacyQuote | null,
  route: Pass458ProviderRoute,
  snapshot: Awaited<ReturnType<typeof resolvePass459AlphaVantageSnapshot>>,
): Pass458TruthQuote {
  const currentPrice = snapshot.currentPrice ?? quote?.currentPrice ?? null;
  const providerConsensus = consensusFields({
    assetClass: route.assetClass,
    primaryPrice: snapshot.currentPrice,
    secondaryPrice: quote?.currentPrice,
    sourceTimestamp: snapshot.sourceTimestamp ?? quote?.sourceTimestamp,
    primaryLabel: snapshot.source,
    secondaryLabel: quote?.state === "live" ? quote.source : null,
  });
  const fundamentalCap = snapshot.fundamentals.quality.confidenceCap;
  return {
    id: quote?.id ?? route.normalizedSymbol.toLowerCase(),
    symbol: quote?.symbol ?? route.normalizedSymbol,
    state: currentPrice !== null ? "live" : "unavailable",
    source: [
      snapshot.source,
      quote?.candles?.length ? `${quote.source} · chart compatibility` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    sourceTimestamp: snapshot.sourceTimestamp ?? quote?.sourceTimestamp ?? null,
    exchange: snapshot.exchange ?? quote?.exchange ?? null,
    currency: snapshot.currency ?? quote?.currency ?? null,
    currentPrice,
    changePercent: snapshot.changePercent ?? quote?.changePercent ?? null,
    candles: quote?.candles ?? [],
    assetClass: route.assetClass,
    truthState:
      snapshot.state === "source_bound"
        ? "source_bound"
        : quote?.state === "live"
          ? "compatibility_adapter"
          : "source_required",
    providerKind: snapshot.providerKind,
    sourceContract: route.sourceContract,
    sourcePolicy: route.sourcePolicy,
    providerPlan: route.providerPlan,
    missingReason: snapshot.missingReason,
    secondSourceRequired: route.secondSourceRequired,
    marketCap: snapshot.marketCap,
    fdv: null,
    volume24h: snapshot.volume24h,
    high24h: snapshot.high24h,
    low24h: snapshot.low24h,
    priceChange1h: null,
    priceChange24h: snapshot.changePercent,
    priceChange7d: null,
    circulatingSupply: null,
    totalSupply: null,
    maxSupply: null,
    docs: pass458ProviderTruthDocs(route.assetClass),
    providerStatus: snapshot.state,
    primaryProviderConfigured: isPass459AlphaVantageConfigured(),
    providerFunctions: snapshot.providerFunctions,
    providerEvidence: snapshot.providerEvidence,
    fundamentals: snapshot.fundamentals,
    ...providerConsensus,
    confidenceCap: Math.min(providerConsensus.confidenceCap, fundamentalCap),
    consensusNotes: [
      ...providerConsensus.consensusNotes,
      `PASS464 fundamental quality cap ${fundamentalCap}/100 (${snapshot.fundamentals.quality.state}).`,
    ],
  };
}

export function pass458ProviderTruthDocs(
  assetClass: Pass458TruthAssetClass,
): string[] {
  if (assetClass === "crypto")
    return [
      "CoinGecko /coins/markets",
      "Binance Spot klines/depth",
      "Velmère source quorum",
    ];
  if (assetClass === "venue_health")
    return [
      "Binance WebSocket limits",
      "MEXC 24h WebSocket validity",
      "Coinbase Exchange public market-data and heartbeat channels",
      "Velmère venue incident ledger",
    ];
  if (assetClass === "fx")
    return [
      "Alpha Vantage FX endpoint",
      "reference-rate timestamp",
      "intraday provider comparison",
    ];
  if (assetClass === "commodity")
    return [
      "Alpha Vantage commodity endpoint",
      "futures contract method",
      "roll/expiry disclosure",
    ];
  if (assetClass === "etf" || assetClass === "real_estate")
    return [
      "Alpha Vantage quote",
      "fund/issuer disclosure cadence",
      "holdings or REIT report",
    ];
  if (assetClass === "index")
    return [
      "index level provider",
      "constituent breadth",
      "weight concentration",
    ];
  return [
    "Alpha Vantage GLOBAL_QUOTE",
    "Alpha Vantage OVERVIEW",
    "issuer filing timestamp",
  ];
}

async function resolveCryptoTruthQuote(
  id: string,
  symbol: string,
  route: Pass458ProviderRoute,
  rangeKey: Pass458RangeKey,
  compatibilityLoader: CompatibilityLoader,
  hydrateVenueEvidence = false,
): Promise<Pass458TruthQuote> {
  if (!route.coingeckoId)
    return emptyTruthQuote(
      id,
      symbol,
      route,
      "Missing CoinGecko id mapping for crypto symbol.",
    );
  const [marketRows, binanceCandles, compatibility] = await Promise.all([
    fetchCoinGeckoMarkets({ ids: [route.coingeckoId], perPage: 10 }).catch(
      () => [],
    ),
    fetchBinanceKlines(route.baseSymbol, rangeToBinance(rangeKey)).catch(
      () => null,
    ),
    compatibilityLoader(id, symbol, rangeKey).catch(() => null),
  ]);
  const canonicalAsset = normalizePass463AssetSymbol(route.baseSymbol);
  const secondaryVenueId = preferredPass462SecondaryVenue("binance", canonicalAsset);
  const [venueHealth, secondaryVenueHealth] = hydrateVenueEvidence
    ? await Promise.all([
        resolvePass461VenueHealthWithFallback("binance", canonicalAsset).catch(
          () => null,
        ),
        resolvePass461VenueHealthWithFallback(
          secondaryVenueId,
          canonicalAsset,
        ).catch(() => null),
      ])
    : [null, null];
  const venueComparison = venueHealth
    ? buildPass462CrossVenueComparison(venueHealth, secondaryVenueHealth)
    : null;
  const market = marketRows[0];
  const candles =
    binanceCandles?.candles.map((candle) => ({
      timestamp: Math.floor(candle.timestamp / 1000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume ?? null,
    })) ??
    compatibility?.candles ??
    [];
  if (!market && !compatibility) {
    return emptyTruthQuote(
      id,
      symbol,
      route,
      "CoinGecko and fallback chart providers are unavailable.",
    );
  }
  const currentPrice = market?.price ?? compatibility?.currentPrice ?? null;
  const change24h =
    market?.priceChange24h ?? compatibility?.changePercent ?? null;
  const marketTimestamp = market?.observedAt
    ? Date.parse(market.observedAt)
    : Number.NaN;
  const latestTimestamp = Number.isFinite(marketTimestamp)
    ? Math.floor(marketTimestamp / 1000)
    : (compatibility?.sourceTimestamp ?? null);
  const providerConsensus = consensusFields({
    assetClass: route.assetClass,
    primaryPrice: market?.price ?? compatibility?.currentPrice,
    secondaryPrice:
      binanceCandles?.candles.at(-1)?.close ?? compatibility?.currentPrice,
    sourceTimestamp: latestTimestamp,
    primaryLabel: market
      ? "CoinGecko /coins/markets"
      : "compatibility chart fallback",
    secondaryLabel: binanceCandles
      ? "Binance last kline close"
      : compatibility
        ? compatibility.source
        : null,
  });
  const combinedConsensusState = stricterPass463Consensus(
    providerConsensus.consensusState,
    venueComparison?.state,
  );
  const combinedConfidenceCap = Math.min(
    providerConsensus.confidenceCap,
    venueComparison?.confidenceCap ?? 100,
  );

  return {
    id,
    symbol,
    state: currentPrice !== null ? "live" : "unavailable",
    source:
      [
        market ? "CoinGecko /coins/markets" : null,
        binanceCandles?.source ?? null,
        compatibility && !binanceCandles
          ? "compatibility chart fallback"
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Velmère PASS458 crypto truth router",
    sourceTimestamp: latestTimestamp,
    exchange: binanceCandles?.pair
      ? "Binance"
      : (compatibility?.exchange ?? null),
    currency: "USD",
    currentPrice,
    changePercent: market?.priceChange7d ?? change24h,
    candles,
    assetClass: route.assetClass,
    truthState: market ? "source_bound" : "compatibility_adapter",
    providerKind: market ? "coingecko_market" : "compatibility_yahoo",
    sourceContract: route.sourceContract,
    sourcePolicy: route.sourcePolicy,
    providerPlan: route.providerPlan,
    missingReason: market
      ? binanceCandles
        ? null
        : "Binance kline lane unavailable; chart uses fallback if present."
      : "CoinGecko market snapshot unavailable; compatibility chart only.",
    secondSourceRequired: route.secondSourceRequired,
    marketCap: market?.marketCap ?? null,
    fdv: market?.fdv ?? null,
    volume24h:
      market?.volume24h ??
      compatibility?.candles?.reduce(
        (sum, candle) => sum + (candle.volume || 0),
        0,
      ) ??
      null,
    high24h: market?.high24h ?? null,
    low24h: market?.low24h ?? null,
    priceChange1h: market?.priceChange1h ?? null,
    priceChange24h: change24h,
    priceChange7d: market?.priceChange7d ?? null,
    circulatingSupply: market?.circulatingSupply ?? null,
    totalSupply: market?.totalSupply ?? null,
    maxSupply: market?.maxSupply ?? null,
    docs: pass458ProviderTruthDocs(route.assetClass),
    providerStatus: market ? "source_bound" : "provider_error",
    primaryProviderConfigured: true,
    providerFunctions: [
      "CoinGecko /coins/markets",
      ...(binanceCandles ? ["Binance klines"] : []),
    ],
    providerEvidence: [
      {
        label: "Market snapshot",
        value: market
          ? "price, market cap, volume and supply attached"
          : "source required",
        source: "CoinGecko /coins/markets",
      },
      {
        label: "Candles",
        value: binanceCandles
          ? "Binance pair attached"
          : compatibility?.candles?.length
            ? "compatibility chart only"
            : "source required",
        source: binanceCandles ? "Binance klines" : "fallback",
      },
    ],
    ...providerConsensus,
    consensusState: combinedConsensusState,
    confidenceCap: combinedConfidenceCap,
    divergenceBps:
      venueComparison?.priceDivergenceBps ?? providerConsensus.divergenceBps,
    primaryPrice:
      venueHealth?.referencePrice ?? providerConsensus.primaryPrice,
    secondaryPrice:
      secondaryVenueHealth?.referencePrice ?? providerConsensus.secondaryPrice,
    secondarySource:
      venueComparison?.secondaryVenue ?? providerConsensus.secondarySource,
    consensusNotes: [
      ...providerConsensus.consensusNotes,
      ...(venueComparison?.notes ?? []),
      ...(venueComparison ? [venueComparison.boundary] : []),
    ],
    venueHealth,
    venueComparison,
  };
}

export async function resolvePass458ProviderTruthQuote({
  id,
  symbol,
  rangeKey,
  compatibilityLoader,
  allowKeyedProvider = false,
}: {
  id: string;
  symbol: string;
  rangeKey: Pass458RangeKey;
  compatibilityLoader: CompatibilityLoader;
  allowKeyedProvider?: boolean;
}): Promise<Pass458TruthQuote> {
  const route = classifyPass458ProviderRoute(id, symbol);
  if (route.assetClass === "venue_health") {
    const venueId = venueIdFromRoute(id, symbol);
    if (!allowKeyedProvider) {
      return emptyTruthQuote(
        id,
        symbol,
        route,
        "Open this venue in detail mode to run the protected PASS461 connectivity/depth/freshness probe.",
      );
    }
    if (!venueId) {
      return {
        ...emptyTruthQuote(
          id,
          symbol,
          route,
          "PASS462 live venue health is implemented for Binance, MEXC and Coinbase Exchange; this venue remains a coverage candidate.",
        ),
        providerKind: "venue_health_unsupported",
      };
    }
    const venueAsset = "BTC";
    const secondaryVenueId = preferredPass462SecondaryVenue(venueId, venueAsset);
    const [snapshot, secondarySnapshot] = await Promise.all([
      resolvePass461VenueHealthWithFallback(venueId, venueAsset),
      resolvePass461VenueHealthWithFallback(secondaryVenueId, venueAsset).catch(() => null),
    ]);
    const venueComparison = snapshot
      ? buildPass462CrossVenueComparison(snapshot, secondarySnapshot)
      : null;
    return snapshot
      ? upgradeVenueHealthQuote(id, symbol, route, snapshot, venueComparison)
      : {
          ...emptyTruthQuote(
            id,
            symbol,
            route,
            "Venue-health probe returned no snapshot.",
          ),
          providerKind: "venue_health_unsupported",
        };
  }
  if (route.assetClass === "crypto") {
    return resolveCryptoTruthQuote(
      id,
      symbol,
      route,
      rangeKey,
      compatibilityLoader,
      allowKeyedProvider,
    );
  }
  const [legacy, primary] = await Promise.all([
    compatibilityLoader(id, symbol, rangeKey).catch(() => null),
    allowKeyedProvider
      ? resolvePass459AlphaVantageSnapshot({
          symbol,
          assetClass: route.assetClass as Exclude<
            Pass458TruthAssetClass,
            "crypto" | "venue_health"
          >,
        })
      : Promise.resolve(null),
  ]);
  if (primary?.state === "source_bound")
    return upgradeAlphaVantageQuote(legacy, route, primary);
  if (!legacy) {
    const reason =
      primary?.missingReason ||
      (allowKeyedProvider
        ? "Compatibility chart provider is unavailable and the keyed primary provider returned no usable snapshot."
        : "Compatibility chart provider is unavailable. Open a single-instrument detail request to hydrate the keyed provider.");
    return emptyTruthQuote(id, symbol, route, reason);
  }
  const primaryRequired = primary
    ? primary.missingReason ||
      `Primary provider state: ${primary.state}. Compatibility chart remains labelled.`
    : allowKeyedProvider
      ? "Primary Alpha Vantage/issuer truth lane is unavailable; compatibility chart remains labelled."
      : "Table batch uses compatibility data to preserve provider quota. Selecting the instrument triggers keyed hydration.";
  const fallback = upgradeCompatibilityQuote(legacy, route, primaryRequired);
  if (!primary) return fallback;
  return {
    ...fallback,
    providerKind: primary.providerKind,
    providerStatus: primary.state,
    primaryProviderConfigured: isPass459AlphaVantageConfigured(),
    providerFunctions: primary.providerFunctions,
    providerEvidence: primary.providerEvidence,
    fundamentals: primary.fundamentals,
  };
}

export const pass458ProviderTruthRouterContract = {
  pass463PairCoverage: pass463CanonicalPairCoverageContract,
  id: "PASS458_PROVIDER_TRUTH_ROUTER",
  rules: [
    "Crypto market cap, price, FDV, supply and 24h volume route through CoinGecko /coins/markets before AI copy.",
    "Crypto candles prefer Binance klines and expose fallback if a pair is unavailable.",
    "Stock, ETF, REIT, FX and commodity rows are labelled as compatibility data until a keyed truth provider and disclosure lane exist.",
    "Binance/MEXC/OKX/Kraken/Bybit/Coinbase venue health rows never pretend to have a stock-style price.",
    "Every quote returns sourceContract, sourcePolicy, providerPlan, missingReason and docs for the UI/PDF/bot.",
    "PASS459 hydrates Alpha Vantage only for one selected detail request so the visible table cannot exhaust keyed-provider quota.",
    "PASS460 compares primary and secondary prices, grades freshness and caps confidence when sources are stale or divergent.",
    "PASS462 compares Binance/MEXC venue telemetry with Coinbase Exchange before stronger venue-health wording.",
    "PASS463 resolves canonical crypto pairs per venue and keeps USD/USDT/USDC basis penalties explicit.",
    "PASS464 caps equity/ETF confidence with statement freshness, leverage, free-cash-flow and holdings-concentration quality.",
  ],
};
