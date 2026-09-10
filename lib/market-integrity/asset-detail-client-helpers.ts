// PASS4408 no-visual AssetDetail build-pressure extraction.
// Boundary: pure data/URL normalizers only. No JSX, CSS, className, layout or customer-visible visual changes.

export const PASS4408_ASSET_DETAIL_CLIENT_HELPER_BOUNDARY = {
  passId: "PASS4408",
  mode: "no_visual_asset_detail_fetch_normalizer_extraction",
  visualChanges: false,
  purpose:
    "Move AssetDetailModal API candle normalization, remote time formatting and chart fetch URL decisions out of the client component to reduce build parse pressure.",
  publicTopkaLiveAllowed: false,
} as const;

export type Pass4408AssetDetailCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

export type Pass4408AssetDetailLike = {
  symbol: string;
  providerSymbol?: string | null;
  marketId?: string | null;
  quote?: string | null;
  assetClass?: string | null;
  venue?: string | null;
  assetClassLabel?: string | null;
  exchangeLabel?: string | null;
  marketDataState?: string | null;
};

export type Pass4408RemoteTimeFormatter = Pick<Intl.DateTimeFormatOptions, "dateStyle" | "timeStyle">;

function pass4408Finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const PASS4408_CRYPTO_ASSET_CLASSES = new Set([
  "crypto",
  "crypto_reference",
  "exchange_token",
  "native_crypto",
]);

const PASS4408_CRYPTO_VENUES = new Set([
  "binance",
  "coinbase",
  "kraken",
  "mexc",
  "shield",
  "shield-pro",
]);

function pass4408CanonicalToken(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/gu, "_");
}

export function isPass4408ShieldCryptoAsset(data: Pass4408AssetDetailLike) {
  const assetClass = pass4408CanonicalToken(data.assetClass);
  if (assetClass) return PASS4408_CRYPTO_ASSET_CLASSES.has(assetClass);

  // Legacy callers that do not yet provide assetClass may use the canonical
  // venue identifier. Customer-facing/localized labels are deliberately not
  // consulted: PL/EN/DE copy must never change provider routing.
  const venue = pass4408CanonicalToken(data.venue);
  return PASS4408_CRYPTO_VENUES.has(venue);
}


export type Pass4408AssetSessionPolicy = "crypto_24_7" | "session_market" | "mixed_provider";

const PASS4408_MIXED_PROVIDER_VENUES = new Set([
  "aggregated",
  "mixed",
  "multi_provider",
  "provider_quorum",
  "proxy",
]);

export function resolvePass4408AssetSessionPolicy(data: Pass4408AssetDetailLike): Pass4408AssetSessionPolicy {
  if (isPass4408ShieldCryptoAsset(data)) return "crypto_24_7";
  const venue = pass4408CanonicalToken(data.venue);
  if (PASS4408_MIXED_PROVIDER_VENUES.has(venue)) return "mixed_provider";
  return "session_market";
}

const PASS4408_MINUTE_MS = 60_000;
const PASS4408_HOUR_MS = 60 * PASS4408_MINUTE_MS;
const PASS4408_DAY_MS = 24 * PASS4408_HOUR_MS;

export function resolvePass4408AssetDetailChartIntervalMs(
  data: Pass4408AssetDetailLike,
  timeframe: string,
) {
  const key = String(timeframe ?? "").trim().toUpperCase();
  const shield = isPass4408ShieldCryptoAsset(data);
  if (key === "15M") return 15 * PASS4408_MINUTE_MS;
  if (key === "1H") return PASS4408_HOUR_MS;
  // Real Markets intentionally returns provider-native hourly bars for the 4H
  // viewport, while Shield returns aggregated 4H candles. Treating both as 4H
  // made three of every four stock bars look like duplicates.
  if (key === "4H") return shield ? 4 * PASS4408_HOUR_MS : PASS4408_HOUR_MS;
  if (key === "1D") return PASS4408_DAY_MS;
  if (key === "1W") return 7 * PASS4408_DAY_MS;
  // Shield's 1M control means a one-month range of daily candles; Real Markets
  // uses the same control for a long-horizon monthly provider series.
  if (key === "1M") return shield ? PASS4408_DAY_MS : 30 * PASS4408_DAY_MS;
  return PASS4408_DAY_MS;
}

export type Pass4408ChartEvidenceMode =
  | "live_verified"
  | "partial_not_live"
  | "last_known_good"
  | "local_reference"
  | "pending";

export function resolvePass4408ChartEvidenceMode(
  data: Pass4408AssetDetailLike,
  candleCount: number,
): Pass4408ChartEvidenceMode {
  if (!Number.isInteger(candleCount) || candleCount < 8) return "pending";
  if (data.marketDataState === "live_verified") return "live_verified";
  if (data.marketDataState === "last_known_good") return "last_known_good";
  if (data.marketDataState === "local_reference") return "local_reference";
  return "partial_not_live";
}

export function normalizePass4408ApiCandles(input: unknown): Pass4408AssetDetailCandle[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    const record = item as Partial<Pass4408AssetDetailCandle>;
    if (
      !pass4408Finite(record.timestamp) ||
      !pass4408Finite(record.open) ||
      !pass4408Finite(record.high) ||
      !pass4408Finite(record.low) ||
      !pass4408Finite(record.close)
    ) {
      return [];
    }
    if (
      record.timestamp <= 0 ||
      record.open <= 0 ||
      record.close <= 0 ||
      record.high < Math.max(record.open, record.close) ||
      record.low <= 0 ||
      record.low > Math.min(record.open, record.close)
    ) {
      return [];
    }
    return [{
      timestamp: record.timestamp,
      open: record.open,
      high: record.high,
      low: record.low,
      close: record.close,
      volume: pass4408Finite(record.volume) && record.volume >= 0 ? record.volume : null,
    }];
  });
}

export function formatPass4408RemoteTime(
  input: unknown,
  locale = "en-US",
  format: Pass4408RemoteTimeFormatter = { dateStyle: "medium", timeStyle: "short" },
) {
  if (typeof input === "string") {
    const parsed = Date.parse(input);
    if (Number.isFinite(parsed)) {
      return new Intl.DateTimeFormat(locale, format).format(new Date(parsed));
    }
    return input;
  }
  if (!pass4408Finite(input)) return null;
  const raw = input > 10_000_000_000 ? input : input * 1000;
  return new Intl.DateTimeFormat(locale, format).format(new Date(raw));
}

export type Pass4408AssetDetailRangeConfig = {
  realMarketsRange: string;
  shieldRange: string;
};

function pass4408IdentityPart(value: unknown) {
  return encodeURIComponent(String(value ?? "").trim().toUpperCase());
}

export function buildPass4408AssetDetailChartCacheKey(
  data: Pass4408AssetDetailLike,
  timeframe: string,
) {
  const providerIdentity = data.providerSymbol?.trim() || data.symbol.trim();
  return [
    "v2",
    pass4408IdentityPart(providerIdentity),
    pass4408IdentityPart(data.marketId),
    pass4408IdentityPart(data.quote),
    pass4408IdentityPart(data.symbol),
    pass4408IdentityPart(timeframe),
    pass4408IdentityPart(data.assetClass),
    pass4408IdentityPart(data.venue),
    pass4408IdentityPart(data.marketDataState),
  ].join(":");
}

export function buildPass4408AssetDetailChartFetchUrl(
  data: Pass4408AssetDetailLike,
  config: Pass4408AssetDetailRangeConfig,
) {
  const requestSymbol = data.providerSymbol?.trim() || data.symbol.trim();
  const encodedSymbol = encodeURIComponent(requestSymbol.toUpperCase());
  if (isPass4408ShieldCryptoAsset(data)) {
    const params = new URLSearchParams({
      assetClass: "crypto",
      // Do not synthesize a provider market id from a ticker. Callers without a
      // canonical id intentionally fail the server contract before any network.
      marketId: data.marketId?.trim().toLowerCase() ?? "",
      symbol: requestSymbol.toUpperCase(),
      quote: (data.quote?.trim() || "USD").toUpperCase(),
      range: config.shieldRange,
    });
    return `/api/market-integrity/klines?${params.toString()}`;
  }
  return `/api/market-integrity/real-markets?symbols=${encodedSymbol}&range=${encodeURIComponent(config.realMarketsRange)}&detail=1`;
}
