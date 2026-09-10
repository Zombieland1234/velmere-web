import type { Pass461VenueId } from "./market-data-contract";

export type Pass463QuoteCurrency = "USD" | "USDT" | "USDC" | "EUR" | "UNKNOWN";
export type Pass463PairResolutionState =
  | "canonical"
  | "candidate"
  | "unsupported";
export type Pass463QuoteBasisState =
  | "same_quote"
  | "fiat_stable_proxy"
  | "stable_stable_proxy"
  | "unsupported";

export type Pass463VenuePairTarget = {
  version: "canonical-pair-coverage";
  venueId: Pass461VenueId;
  assetSymbol: string;
  pair: string | null;
  baseCurrency: string;
  quoteCurrency: Pass463QuoteCurrency;
  resolutionState: Pass463PairResolutionState;
  resolutionNote: string;
  aliases: string[];
};

export type Pass463QuoteBasisAssessment = {
  state: Pass463QuoteBasisState;
  comparable: boolean;
  confidencePenalty: number;
  note: string;
};

type CanonicalCryptoProfile = {
  aliases: string[];
  binance?: string | null;
  mexc?: string | null;
  coinbase?: string | null;
};

const CANONICAL_CRYPTO: Record<string, CanonicalCryptoProfile> = {
  BTC: { aliases: ["BTC", "XBT", "BITCOIN"], binance: "BTCUSDT", mexc: "BTCUSDT", coinbase: "BTC-USD" },
  ETH: { aliases: ["ETH", "ETHEREUM"], binance: "ETHUSDT", mexc: "ETHUSDT", coinbase: "ETH-USD" },
  SOL: { aliases: ["SOL", "SOLANA"], binance: "SOLUSDT", mexc: "SOLUSDT", coinbase: "SOL-USD" },
  BNB: { aliases: ["BNB", "BINANCECOIN"], binance: "BNBUSDT", mexc: "BNBUSDT", coinbase: null },
  XRP: { aliases: ["XRP", "RIPPLE"], binance: "XRPUSDT", mexc: "XRPUSDT", coinbase: "XRP-USD" },
  ADA: { aliases: ["ADA", "CARDANO"], binance: "ADAUSDT", mexc: "ADAUSDT", coinbase: "ADA-USD" },
  DOGE: { aliases: ["DOGE", "DOGECOIN"], binance: "DOGEUSDT", mexc: "DOGEUSDT", coinbase: "DOGE-USD" },
  LINK: { aliases: ["LINK", "CHAINLINK"], binance: "LINKUSDT", mexc: "LINKUSDT", coinbase: "LINK-USD" },
  AVAX: { aliases: ["AVAX", "AVALANCHE"], binance: "AVAXUSDT", mexc: "AVAXUSDT", coinbase: "AVAX-USD" },
  DOT: { aliases: ["DOT", "POLKADOT"], binance: "DOTUSDT", mexc: "DOTUSDT", coinbase: "DOT-USD" },
  LTC: { aliases: ["LTC", "LITECOIN"], binance: "LTCUSDT", mexc: "LTCUSDT", coinbase: "LTC-USD" },
  BCH: { aliases: ["BCH", "BITCOINCASH"], binance: "BCHUSDT", mexc: "BCHUSDT", coinbase: "BCH-USD" },
  XLM: { aliases: ["XLM", "STELLAR"], binance: "XLMUSDT", mexc: "XLMUSDT", coinbase: "XLM-USD" },
  UNI: { aliases: ["UNI", "UNISWAP"], binance: "UNIUSDT", mexc: "UNIUSDT", coinbase: "UNI-USD" },
  ATOM: { aliases: ["ATOM", "COSMOS"], binance: "ATOMUSDT", mexc: "ATOMUSDT", coinbase: "ATOM-USD" },
  NEAR: { aliases: ["NEAR", "NEARPROTOCOL"], binance: "NEARUSDT", mexc: "NEARUSDT", coinbase: "NEAR-USD" },
  AAVE: { aliases: ["AAVE"], binance: "AAVEUSDT", mexc: "AAVEUSDT", coinbase: "AAVE-USD" },
  ETC: { aliases: ["ETC", "ETHEREUMCLASSIC"], binance: "ETCUSDT", mexc: "ETCUSDT", coinbase: "ETC-USD" },
};

const QUOTE_SUFFIXES = ["USDT", "USDC", "USD", "EUR"] as const;

function safeUpper(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

function stripQuote(value: string | null | undefined) {
  let normalized = safeUpper(value).replace(/[_-]/g, "");
  for (const suffix of QUOTE_SUFFIXES) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
      normalized = normalized.slice(0, -suffix.length);
      break;
    }
  }
  return normalized;
}

export function normalizePass463AssetSymbol(value: string | null | undefined) {
  const normalized = stripQuote(value) || "BTC";
  const aliasMatch = Object.entries(CANONICAL_CRYPTO).find(([, profile]) =>
    profile.aliases.some((alias) => alias === normalized),
  );
  return aliasMatch?.[0] ?? normalized.slice(0, 12);
}

function quoteFromPair(venueId: Pass461VenueId, pair: string | null): Pass463QuoteCurrency {
  if (!pair) return "UNKNOWN";
  const normalized = pair.toUpperCase().replace(/[_-]/g, "");
  if (normalized.endsWith("USDT")) return "USDT";
  if (normalized.endsWith("USDC")) return "USDC";
  if (normalized.endsWith("USD")) return "USD";
  if (normalized.endsWith("EUR")) return "EUR";
  return "UNKNOWN";
}

export function resolvePass463VenuePair(
  venueId: Pass461VenueId,
  requestedAsset: string | null | undefined,
): Pass463VenuePairTarget {
  const assetSymbol = normalizePass463AssetSymbol(requestedAsset || "BTC");
  const profile = CANONICAL_CRYPTO[assetSymbol];
  const configured = profile?.[venueId];
  const aliases = profile?.aliases ?? [assetSymbol];

  if (configured === null) {
    return {
      version: "canonical-pair-coverage",
      venueId,
      assetSymbol,
      pair: null,
      baseCurrency: assetSymbol,
      quoteCurrency: "UNKNOWN",
      resolutionState: "unsupported",
      resolutionNote: `${assetSymbol} has no configured ${venueId} spot pair in the PASS463 canonical registry.`,
      aliases,
    };
  }

  if (typeof configured === "string") {
    return {
      version: "canonical-pair-coverage",
      venueId,
      assetSymbol,
      pair: configured,
      baseCurrency: assetSymbol,
      quoteCurrency: quoteFromPair(venueId, configured),
      resolutionState: "canonical",
      resolutionNote: `${configured} is the canonical PASS463 monitoring pair for ${assetSymbol} on ${venueId}.`,
      aliases,
    };
  }

  if (!/^[A-Z0-9]{2,12}$/.test(assetSymbol)) {
    return {
      version: "canonical-pair-coverage",
      venueId,
      assetSymbol,
      pair: null,
      baseCurrency: assetSymbol,
      quoteCurrency: "UNKNOWN",
      resolutionState: "unsupported",
      resolutionNote: "The requested asset cannot be converted into a safe public spot pair.",
      aliases,
    };
  }

  const pair = venueId === "coinbase" ? `${assetSymbol}-USD` : `${assetSymbol}USDT`;
  return {
    version: "canonical-pair-coverage",
    venueId,
    assetSymbol,
    pair,
    baseCurrency: assetSymbol,
    quoteCurrency: quoteFromPair(venueId, pair),
    resolutionState: "candidate",
    resolutionNote: `${pair} is a safe candidate pair; the live product endpoint must confirm availability before any source-bound wording.`,
    aliases,
  };
}

export function assessPass463QuoteBasis(
  primaryQuote: string,
  secondaryQuote: string,
): Pass463QuoteBasisAssessment {
  const primary = primaryQuote.toUpperCase();
  const secondary = secondaryQuote.toUpperCase();
  if (!primary || !secondary || primary === "UNKNOWN" || secondary === "UNKNOWN") {
    return {
      state: "unsupported",
      comparable: false,
      confidencePenalty: 24,
      note: "Quote-currency identity is missing; direct price divergence is not calculated.",
    };
  }
  if (primary === secondary) {
    return {
      state: "same_quote",
      comparable: true,
      confidencePenalty: 0,
      note: `Both venues use ${primary}; direct price divergence is comparable.`,
    };
  }
  const stable = new Set(["USDT", "USDC"]);
  if ((primary === "USD" && stable.has(secondary)) || (secondary === "USD" && stable.has(primary))) {
    return {
      state: "fiat_stable_proxy",
      comparable: true,
      confidencePenalty: 10,
      note: `${primary}/${secondary} is treated only as a monitoring proxy; stablecoin basis can explain part of the divergence.`,
    };
  }
  if (stable.has(primary) && stable.has(secondary)) {
    return {
      state: "stable_stable_proxy",
      comparable: true,
      confidencePenalty: 6,
      note: `${primary}/${secondary} is a stablecoin proxy comparison and keeps an explicit basis penalty.`,
    };
  }
  return {
    state: "unsupported",
    comparable: false,
    confidencePenalty: 24,
    note: `${primary}/${secondary} is not directly comparable without a separate FX/basis conversion source.`,
  };
}

export function preferredPass463SecondaryVenue(
  primary: Pass461VenueId,
  requestedAsset: string | null | undefined,
): Pass461VenueId {
  const asset = normalizePass463AssetSymbol(requestedAsset);
  if (primary === "coinbase") return "binance";
  const coinbase = resolvePass463VenuePair("coinbase", asset);
  if (coinbase.resolutionState !== "unsupported") return "coinbase";
  return primary === "binance" ? "mexc" : "binance";
}

export const pass463CanonicalPairCoverageContract = {
  id: "PASS463_CANONICAL_PAIR_COVERAGE",
  supportedCanonicalAssets: Object.keys(CANONICAL_CRYPTO),
  rules: [
    "Venue probes are keyed by venue + canonical asset, never by a single hard-coded BTC pair.",
    "A configured pair is still verified by the public product endpoint; HTTP/provider failure cannot become source-bound evidence.",
    "USD, USDT and USDC comparisons keep an explicit quote-basis state and confidence penalty.",
    "Unsupported pairs return a human-readable source gap instead of fake zeroes or raw unknown values.",
  ],
  boundary:
    "Pair coverage and cross-venue alignment are market-data quality signals, not exchange safety, reserve or solvency certificates.",
};
