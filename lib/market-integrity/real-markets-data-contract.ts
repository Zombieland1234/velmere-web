export const REAL_MARKETS_DATA_CONTRACT_VERSION =
  "velmere.real_markets.instrument.v1" as const;

export type RealMarketsAssetClass =
  | "crypto"
  | "equity"
  | "index"
  | "fx"
  | "etf"
  | "commodity"
  | "reit"
  | "exchange"
  | "unknown";

export type RealMarketsFreshness =
  | "fresh"
  | "aging"
  | "stale"
  | "unknown";

export type CanonicalRealMarketInstrument = {
  schemaVersion: typeof REAL_MARKETS_DATA_CONTRACT_VERSION;
  id: string;
  symbol: string;
  assetClass: RealMarketsAssetClass;
  state: "available" | "unavailable";
  price: number | null;
  currency: string | null;
  changes: {
    oneHour: number | null;
    oneDay: number | null;
    sevenDays: number | null;
    thirtyDays: number | null;
  };
  marketCap: number | null;
  volume24h: number | null;
  source: {
    provider: string;
    observedAt: string | null;
    receivedAt: string | null;
    latencyMs: number | null;
    freshness: RealMarketsFreshness;
    exchange: string | null;
    capabilities: string[];
  };
  missingData: string[];
};

type ProviderQuoteLike = {
  id?: unknown;
  symbol?: unknown;
  assetClass?: unknown;
  state?: unknown;
  source?: unknown;
  sourceTimestamp?: unknown;
  sourceReceivedAt?: unknown;
  sourceLatencyMs?: unknown;
  sourceCapabilities?: unknown;
  exchange?: unknown;
  currency?: unknown;
  currentPrice?: unknown;
  changePercent?: unknown;
  priceChange1h?: unknown;
  priceChange24h?: unknown;
  priceChange7d?: unknown;
  priceChange30d?: unknown;
  marketCap?: unknown;
  volume24h?: unknown;
};

const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function normalizeAssetClass(value: unknown): RealMarketsAssetClass {
  switch (value) {
    case "crypto":
      return "crypto";
    case "stock":
    case "exchange_equity":
      return "equity";
    case "index":
      return "index";
    case "fx":
      return "fx";
    case "etf":
      return "etf";
    case "commodity":
      return "commodity";
    case "real_estate":
      return "reit";
    case "venue_health":
      return "exchange";
    default:
      return "unknown";
  }
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  const timestamp = finite(value);
  if (timestamp === null || timestamp <= 0) return null;
  const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeLatency(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function deriveObservedCapabilities(input: ProviderQuoteLike, observedAt: string | null) {
  return Array.from(new Set([
    text(input.symbol) || text(input.id) ? "identity" : null,
    finite(input.currentPrice) !== null ? "price" : null,
    finite(input.currentPrice) !== null ? "quote" : null,
    finite(input.priceChange1h) !== null
      || finite(input.priceChange24h) !== null
      || finite(input.changePercent) !== null
      || finite(input.priceChange7d) !== null
      || finite(input.priceChange30d) !== null ? "history" : null,
    finite(input.marketCap) !== null ? "market_cap" : null,
    finite(input.volume24h) !== null ? "volume" : null,
    text(input.currency) ? "currency" : null,
    text(input.exchange) ? "exchange" : null,
    observedAt ? "source_timestamp" : null,
  ].filter((value): value is string => Boolean(value)))).sort();
}

function normalizeDeclaredCapabilities(value: unknown) {
  if (!Array.isArray(value)) return null;
  return Array.from(new Set(value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"))))
    .sort();
}

function resolveFreshness(
  observedAt: string | null,
  nowMs: number,
): RealMarketsFreshness {
  if (!observedAt) return "unknown";
  const ageMs = Math.max(0, nowMs - new Date(observedAt).getTime());
  if (ageMs <= 15 * 60 * 1000) return "fresh";
  if (ageMs <= 24 * 60 * 60 * 1000) return "aging";
  return "stale";
}

export function toCanonicalRealMarketInstrument(
  input: ProviderQuoteLike,
  nowMs = Date.now(),
): CanonicalRealMarketInstrument {
  const id = text(input.id) ?? text(input.symbol) ?? "unknown";
  const symbol = text(input.symbol) ?? id.toUpperCase();
  const identityMissing = text(input.id) === null && text(input.symbol) === null;
  const observedAt = normalizeTimestamp(input.sourceTimestamp);
  const receivedAt = normalizeTimestamp(input.sourceReceivedAt);
  const latencyMs = normalizeLatency(input.sourceLatencyMs);
  const price = finite(input.currentPrice);
  const oneDay = finite(input.priceChange24h) ?? finite(input.changePercent);
  const provider = text(input.source);
  const exchange = text(input.exchange);
  const currency = text(input.currency);
  const assetClass = normalizeAssetClass(input.assetClass);
  const observedCapabilities = deriveObservedCapabilities(input, observedAt);
  const declaredCapabilities = normalizeDeclaredCapabilities(input.sourceCapabilities);
  // A provider may narrow the capability set, never expand beyond fields that
  // are actually present in this payload.
  const capabilities = declaredCapabilities === null
    ? observedCapabilities
    : observedCapabilities.filter((capability) => declaredCapabilities.includes(capability));
  const freshness = resolveFreshness(observedAt, nowMs);
  const state = input.state === "live"
    && price !== null
    && provider !== null
    && observedAt !== null
    && receivedAt !== null
    && latencyMs !== null
    && currency !== null
    && freshness !== "stale"
    ? "available"
    : "unavailable";
  const missingData = [
    identityMissing ? "asset_identity" : null,
    assetClass === "unknown" ? "asset_class" : null,
    price === null ? "price" : null,
    currency === null ? "currency" : null,
    finite(input.priceChange1h) === null ? "change_1h" : null,
    oneDay === null ? "change_1d" : null,
    finite(input.priceChange7d) === null ? "change_7d" : null,
    finite(input.priceChange30d) === null ? "change_30d" : null,
    finite(input.marketCap) === null ? "market_cap" : null,
    finite(input.volume24h) === null ? "volume_24h" : null,
    observedAt === null ? "source_timestamp" : null,
    receivedAt === null ? "source_received_at" : null,
    latencyMs === null ? "source_latency_ms" : null,
    provider === null ? "source_provider" : null,
    exchange === null ? "exchange" : null,
    capabilities.length === 0 ? "source_capabilities" : null,
  ].filter((value): value is string => Boolean(value));

  return {
    schemaVersion: REAL_MARKETS_DATA_CONTRACT_VERSION,
    id,
    symbol,
    assetClass,
    state,
    price,
    currency,
    changes: {
      oneHour: finite(input.priceChange1h),
      oneDay,
      sevenDays: finite(input.priceChange7d),
      thirtyDays: finite(input.priceChange30d),
    },
    marketCap: finite(input.marketCap),
    volume24h: finite(input.volume24h),
    source: {
      provider: provider ?? "source unavailable",
      observedAt,
      receivedAt,
      latencyMs,
      freshness,
      exchange,
      capabilities,
    },
    missingData,
  };
}

export const realMarketsDataContract = {
  schemaVersion: REAL_MARKETS_DATA_CONTRACT_VERSION,
  assetClasses: [
    "crypto",
    "equity",
    "index",
    "fx",
    "etf",
    "commodity",
    "reit",
    "exchange",
    "unknown",
  ] as const,
  sourceRules: {
    timestampRequiredForLiveLabel: true,
    unavailableValuesRemainNull: true,
    providerNameRequired: true,
    receivedAtRequiredForAvailableState: true,
    measuredLatencyRequiredForAvailableState: true,
    capabilitiesCannotExceedObservedFields: true,
    staleDataCannotBePresentedAsLive: true,
  },
} as const;
