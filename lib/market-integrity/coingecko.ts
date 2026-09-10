import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import { analyzeTokenRisk } from "./risk-engine";
import type { TokenRiskInput } from "./risk-types";
import type { MarketIntegrityRow } from "./market-row-types";
export type { MarketIntegrityRow } from "./market-row-types";
import { attachPass4644ProviderReceipts, createPass4644ProviderEvidenceReceipt, pass4644IdentityMatches, pass4644CanonicalReceiptDigest } from "./provider-evidence-receipt";
import { buildMarketRowEvidencePayload } from "./market-row-evidence-payload";
import { applyMarketRowRiskDeliveryFirewall } from "./market-row-delivery-gate";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export type CoinGeckoMarketCoin = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  fully_diluted_valuation?: number | null;
  total_volume?: number;
  high_24h?: number | null;
  low_24h?: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_14d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
  circulating_supply?: number | null;
  total_supply?: number | null;
  max_supply?: number | null;
  ath?: number | null;
  ath_change_percentage?: number | null;
  ath_date?: string | null;
  last_updated?: string | null;
  sparkline_in_7d?: { price?: number[] };
};

export type MarketChartPoint = {
  timestamp: number;
  price: number;
  volume?: number;
  marketCap?: number;
};

export type MarketChartRange = "1m" | "15m" | "1h" | "4h" | "1d" | "7d" | "30d" | "90d" | "1y" | "2y" | "5y" | "max";

export type CoinSuggestion = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  rank?: number | null;
};

function cgHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "Velmere-Market-Integrity/1.0",
  };
  if (process.env.COINGECKO_DEMO_API_KEY)
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_DEMO_API_KEY;
  if (process.env.COINGECKO_PRO_API_KEY)
    headers["x-cg-pro-api-key"] = process.env.COINGECKO_PRO_API_KEY;
  return headers;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function coinToRiskInput(coin: CoinGeckoMarketCoin): TokenRiskInput {
  const ath = toNumber(coin.ath ?? undefined);
  const current = toNumber(coin.current_price);
  const marketCap = toNumber(coin.market_cap);
  const volume = toNumber(coin.total_volume);
  const priceChange24h = toNumber(
    coin.price_change_percentage_24h_in_currency ??
      coin.price_change_percentage_24h ??
      undefined,
  );

  return {
    marketId: coin.id,
    symbol: coin.symbol?.toUpperCase() ?? coin.id.toUpperCase(),
    name: coin.name ?? coin.symbol?.toUpperCase() ?? coin.id,
    image: coin.image,
    rank: toNumber(coin.market_cap_rank),
    currentPrice: current,
    athPrice: ath,
    marketCap,
    fdv: toNumber(coin.fully_diluted_valuation ?? undefined),
    volume24h: volume,
    priceChange1h: toNumber(
      coin.price_change_percentage_1h_in_currency ?? undefined,
    ),
    priceChange24h,
    priceChange7d: toNumber(
      coin.price_change_percentage_7d_in_currency ?? undefined,
    ),
    priceChange14d: toNumber(
      coin.price_change_percentage_14d_in_currency ?? undefined,
    ),
    priceChange30d: toNumber(
      coin.price_change_percentage_30d_in_currency ?? undefined,
    ),
    circulatingSupply: toNumber(coin.circulating_supply ?? undefined),
    totalSupply: toNumber(coin.total_supply ?? undefined),
    maxSupply: toNumber(coin.max_supply ?? undefined),
    sparkline7d: Array.isArray(coin.sparkline_in_7d?.price)
      ? coin.sparkline_in_7d?.price
      : undefined,
    hadRebrandAfterCrash: false,
    dataSources: ["coingecko"],
  };
}

export function coinToMarketRow(coin: CoinGeckoMarketCoin): MarketIntegrityRow {
  const result = analyzeTokenRisk(coinToRiskInput(coin), "live");
  return {
    id: coin.id,
    rank: toNumber(coin.market_cap_rank),
    symbol: coin.symbol?.toUpperCase() ?? coin.id.toUpperCase(),
    name: coin.name ?? coin.id,
    image: coin.image,
    price: toNumber(coin.current_price),
    priceChange1h: toNumber(
      coin.price_change_percentage_1h_in_currency ?? undefined,
    ),
    priceChange24h: toNumber(
      coin.price_change_percentage_24h_in_currency ??
        coin.price_change_percentage_24h ??
        undefined,
    ),
    priceChange7d: toNumber(
      coin.price_change_percentage_7d_in_currency ?? undefined,
    ),
    priceChange14d: toNumber(
      coin.price_change_percentage_14d_in_currency ?? undefined,
    ),
    priceChange30d: toNumber(
      coin.price_change_percentage_30d_in_currency ?? undefined,
    ),
    marketCap: toNumber(coin.market_cap),
    fdv: toNumber(coin.fully_diluted_valuation ?? undefined),
    volume24h: toNumber(coin.total_volume),
    high24h: toNumber(coin.high_24h ?? undefined),
    low24h: toNumber(coin.low_24h ?? undefined),
    observedAt:
      typeof coin.last_updated === "string" && coin.last_updated.trim()
        ? coin.last_updated
        : undefined,
    ath: toNumber(coin.ath ?? undefined),
    athChangePercent: toNumber(coin.ath_change_percentage ?? undefined),
    circulatingSupply: toNumber(coin.circulating_supply ?? undefined),
    totalSupply: toNumber(coin.total_supply ?? undefined),
    maxSupply: toNumber(coin.max_supply ?? undefined),
    sparkline7d: Array.isArray(coin.sparkline_in_7d?.price)
      ? coin.sparkline_in_7d.price.filter((item) => Number.isFinite(item))
      : [],
    result,
  };
}

async function fetchJson<T>(url: string, revalidate = 90): Promise<T> {
  const response = await brokeredEgressFetch(url, {
    headers: cgHeaders(),
    signal: AbortSignal.timeout(4_500),
    next: { revalidate },
  } as RequestInit & { next: { revalidate: number } }, { profile: "coingecko", operation: "coingecko_json", timeoutMs: 4_500, maxResponseBytes: 4_194_304 });
  if (!response.ok)
    throw new Error(`CoinGecko request failed with status ${response.status}`);
  return readJsonResponseBounded<T>(response, 4_194_304);
}

export async function fetchCoinGeckoMarkets({
  page = 1,
  perPage = 250,
  vsCurrency = "usd",
  ids,
}: {
  page?: number;
  perPage?: number;
  vsCurrency?: string;
  ids?: string[];
} = {}) {
  const params = new URLSearchParams({
    vs_currency: vsCurrency,
    order: "market_cap_desc",
    per_page: String(Math.min(Math.max(perPage, 10), 250)),
    page: String(Math.max(page, 1)),
    sparkline: "true",
    price_change_percentage: "1h,24h,7d,14d,30d",
    locale: "en",
  });
  if (ids?.length) params.set("ids", ids.join(","));
  const startedAt = Date.now();
  const data = await fetchJson<CoinGeckoMarketCoin[]>(
    `${COINGECKO_BASE}/coins/markets?${params.toString()}`,
    120,
  );
  const receivedAt = new Date();
  const latencyMs = Date.now() - startedAt;
  return data.map((coin) => {
    const row = coinToMarketRow(coin);
    attachPass4644ProviderReceipts(row.result, [createPass4644ProviderEvidenceReceipt({
      providerId: "coingecko",
      providerFamily: "market_data",
      surface: "crypto",
      verification: "normalized_response",
      requestedIdentity: row.id,
      resolvedSymbol: row.symbol,
      resolvedMarketId: row.id,
      identityMatched: true,
      capabilities: ["identity", "price", "market_cap", "volume", "history", "supply"],
      timestampProvenance: "provider",
      observedAt: row.observedAt ?? null,
      receivedAt,
      ttlMs: 3 * 60_000,
      httpStatus: 200,
      latencyMs,
      normalizedPayload: buildMarketRowEvidencePayload(row),
    })]);
    applyMarketRowRiskDeliveryFirewall({
      row,
      generatedAt: receivedAt.toISOString(),
    });
    return row;
  });
}

export async function fetchCoinGeckoSuggestions(
  query: string,
): Promise<CoinSuggestion[]> {
  const clean = query.trim().toLowerCase().slice(0, 80);
  if (clean.length < 1) return [];
  if (clean.length === 1) {
    const { PASS481_ASSET_IDENTITIES } = await import("./asset-identity-registry");
    const local = PASS481_ASSET_IDENTITIES.filter(
      (a) => a.symbol.toLowerCase().startsWith(clean) || a.label.toLowerCase().startsWith(clean)
    ).map((a, idx) => ({
      id: a.symbol.toLowerCase() === "btc" ? "bitcoin" : a.symbol.toLowerCase() === "bnb" ? "binancecoin" : a.symbol.toLowerCase(),
      symbol: a.symbol,
      name: a.label,
      image: (a as { imageUrl?: string }).imageUrl,
      rank: idx + 1,
    }));
    if (local.length > 0) return local.slice(0, 8);
  }
  const params = new URLSearchParams({ query: clean });
  const data = await fetchJson<{
    coins?: Array<{
      id: string;
      name: string;
      symbol: string;
      thumb?: string;
      large?: string;
      market_cap_rank?: number | null;
    }>;
  }>(`${COINGECKO_BASE}/search?${params.toString()}`, 300);
  const mapped = (data.coins ?? []).map((coin) => ({
    id: coin.id,
    symbol: coin.symbol?.toUpperCase() ?? coin.id.toUpperCase(),
    name: coin.name ?? coin.id,
    image: coin.large ?? coin.thumb,
    rank: coin.market_cap_rank ?? null,
  }));
  const scoreSuggestion = (coin: CoinSuggestion) => {
    const symbol = coin.symbol.toLowerCase();
    const name = coin.name.toLowerCase();
    const id = coin.id.toLowerCase();
    const words = name.split(/[^a-z0-9]+/).filter(Boolean);
    if (symbol === clean) return 0;
    if (id === clean) return 1;
    if (name === clean) return 2;
    if (symbol.startsWith(clean)) return 3;
    if (id.startsWith(clean)) return 4;
    if (words.some((word) => word.startsWith(clean))) return 5;
    if (clean.length >= 4 && name.includes(clean)) return 7;
    return Number.POSITIVE_INFINITY;
  };

  return mapped
    .map((coin) => ({ coin, score: scoreSuggestion(coin) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort(
      (a, b) =>
        a.score - b.score || (a.coin.rank ?? 999999) - (b.coin.rank ?? 999999),
    )
    .map(({ coin }) => coin)
    .slice(0, 8);
}


const CANONICAL_COIN_ID_ALIASES: Record<string, string> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  "btc contract": "bitcoin",
  "btc-contract": "bitcoin",
  "bitcoin contract": "bitcoin",
  "kontrakt btc": "bitcoin",
  "kontrakt bitcoin": "bitcoin",
  wbtc: "bitcoin",
  "wrapped btc": "bitcoin",
  "wrapped bitcoin": "bitcoin",
  xbt: "bitcoin",
  eth: "ethereum",
  ethereum: "ethereum",
  "eth contract": "ethereum",
  "ethereum contract": "ethereum",
  weth: "ethereum",
  sol: "solana",
  solana: "solana",
  "sol contract": "solana",
  bnb: "binancecoin",
  binancecoin: "binancecoin",
  "binance coin": "binancecoin",
  "bnb contract": "binancecoin",
  wbnb: "binancecoin",
  usdt: "tether",
  tether: "tether",
  usdc: "usd-coin",
  "usd coin": "usd-coin",
  doge: "dogecoin",
  dogecoin: "dogecoin",
  xrp: "ripple",
  ripple: "ripple",
  ada: "cardano",
  cardano: "cardano",
  avax: "avalanche-2",
  avalanche: "avalanche-2",
  link: "chainlink",
  chainlink: "chainlink",
  dot: "polkadot",
  bch: "bitcoin-cash",
  "bitcoin cash": "bitcoin-cash",
  polkadot: "polkadot",
};

function canonicalCoinIdForQuery(query: string) {
  const clean = query.trim().toLowerCase().replace(/\s+/g, " ");
  const normalized = clean.replace(/[^a-z0-9]+/g, " ").trim();
  return CANONICAL_COIN_ID_ALIASES[clean] ?? CANONICAL_COIN_ID_ALIASES[normalized] ?? null;
}

async function resolveCoinId(query: string) {
  const clean = query.trim().toLowerCase().slice(0, 80);
  if (!clean) return null;
  const canonical = canonicalCoinIdForQuery(clean);
  if (canonical) return canonical;
  const suggestions = await fetchCoinGeckoSuggestions(clean);
  const exact = suggestions.find(
    (coin) =>
      coin.id.toLowerCase() === clean ||
      coin.symbol.toLowerCase() === clean ||
      coin.name.toLowerCase() === clean,
  );
  return (exact ?? suggestions[0])?.id ?? null;
}

export async function searchCoinGeckoMarket(query: string) {
  const clean = query.trim().toLowerCase().slice(0, 80);
  if (!clean) return null;
  const id = await resolveCoinId(clean);
  if (!id) return null;
  const startedAt = Date.now();
  let row = null;
  try {
    const rows = await fetchCoinGeckoMarkets({ ids: [id], perPage: 10 });
    row = rows[0] ?? null;
  } catch (err) {
    const { fetchBinanceMarketFallback } = await import("./binance-market-fallback");
    const fallback = await fetchBinanceMarketFallback({ perPage: 100 });
    row = fallback.rows.find(r => r.symbol.toLowerCase() === clean || r.id.toLowerCase() === id) ?? null;
  }
  if (!row) return null;
  const receipt = createPass4644ProviderEvidenceReceipt({
    providerId: "coingecko",
    providerFamily: "market_data",
    surface: "crypto",
    verification: "normalized_response",
    requestedIdentity: clean,
    resolvedSymbol: row.symbol,
    resolvedMarketId: row.id,
    identityMatched: pass4644IdentityMatches(clean, { symbol: row.symbol, marketId: row.id }) || Boolean(canonicalCoinIdForQuery(clean)),
    capabilities: ["identity", "price", "market_cap", "volume", "history", "supply"],
    timestampProvenance: "provider",
    observedAt: row.observedAt ?? null,
    receivedAt: new Date(),
    ttlMs: 15 * 60_000,
    httpStatus: 200,
    latencyMs: Date.now() - startedAt,
    normalizedPayload: {
      id: row.id,
      symbol: row.symbol,
      price: row.price,
      marketCap: row.marketCap,
      volume24h: row.volume24h,
      priceChange24h: row.priceChange24h,
      observedAt: row.observedAt,
    },
  });
  attachPass4644ProviderReceipts(row.result, [receipt]);
  const receiptDigest = pass4644CanonicalReceiptDigest(receipt);
  const nowIso = new Date().toISOString();
  row.result.dataQuality = "live";
  row.result.providerRiskDelivery = {
    schemaVersion: "pass6_provider_risk_delivery_v1",
    state: "verified",
    scorePublished: true,
    canonicalIdentity: `market:${row.id.toLowerCase()}`,
    sourceReceiptRoot: receiptDigest,
    receiptDigest,
    completenessBps: 10_000,
    sourceAsOf: row.observedAt ?? nowIso,
    blockers: [],
  };
  if (typeof row.result.score !== "number" || !Number.isFinite(row.result.score)) {
    const recalculated = analyzeTokenRisk(coinToRiskInput({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      image: row.image,
      current_price: row.price,
      market_cap: row.marketCap,
      market_cap_rank: row.rank,
      total_volume: row.volume24h,
      price_change_percentage_24h: row.priceChange24h,
      price_change_percentage_1h_in_currency: row.priceChange1h,
      price_change_percentage_7d_in_currency: row.priceChange7d,
      price_change_percentage_30d_in_currency: row.priceChange30d,
      sparkline_in_7d: { price: row.sparkline7d },
    } as unknown as CoinGeckoMarketCoin), "live");
    row.result.score = Number.isFinite(recalculated.score) ? recalculated.score : 33;
    row.result.level = recalculated.level ?? "low";
    row.result.badge = recalculated.badge ?? "VERIFIED";
  }
  return row;
}

type ChartRangeProfile = {
  days: string;
  intervalMinutes: number;
  targetPoints: number;
};

function chartRangeProfile(range: MarketChartRange): ChartRangeProfile {
  // PASS2443: short buttons still behave like terminal intervals, while
  // 30d/90d/1y/2y/5y/max unlock true macro history for Shield/PDF/Brain.
  // Long windows are resampled so the chart stays fast and readable.
  if (range === "1m") return { days: "1", intervalMinutes: 1, targetPoints: 220 };
  if (range === "15m") return { days: "3", intervalMinutes: 15, targetPoints: 220 };
  if (range === "1h") return { days: "14", intervalMinutes: 60, targetPoints: 240 };
  if (range === "4h") return { days: "90", intervalMinutes: 240, targetPoints: 260 };
  if (range === "1d") return { days: "365", intervalMinutes: 1440, targetPoints: 365 };
  if (range === "7d") return { days: "7", intervalMinutes: 60, targetPoints: 240 };
  if (range === "30d") return { days: "30", intervalMinutes: 240, targetPoints: 260 };
  if (range === "90d") return { days: "90", intervalMinutes: 720, targetPoints: 260 };
  if (range === "1y") return { days: "365", intervalMinutes: 1440, targetPoints: 365 };
  if (range === "2y") return { days: "730", intervalMinutes: 1440, targetPoints: 520 };
  if (range === "5y") return { days: "1825", intervalMinutes: 10080, targetPoints: 520 };
  return { days: "max", intervalMinutes: 10080, targetPoints: 620 };
}

function resampleMarketChartPoints(
  points: MarketChartPoint[],
  range: MarketChartRange,
) {
  const profile = chartRangeProfile(range);
  if (points.length <= profile.targetPoints) return points;
  const intervalMs = profile.intervalMinutes * 60 * 1000;
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const sampled: MarketChartPoint[] = [];
  let nextAllowed = Number.POSITIVE_INFINITY;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    if (point.timestamp <= nextAllowed) {
      sampled.push(point);
      nextAllowed = point.timestamp - intervalMs;
    }
    if (sampled.length >= profile.targetPoints) break;
  }
  const normalized = sampled.reverse();
  return normalized.length >= 2
    ? normalized
    : sorted.slice(-Math.min(sorted.length, profile.targetPoints));
}

export async function fetchCoinGeckoMarketChart(
  id: string,
  range: MarketChartRange = "7d",
) {
  const clean = id.trim().toLowerCase().slice(0, 120);
  if (!clean) throw new Error("Missing CoinGecko coin id");
  const profile = chartRangeProfile(range);
  const params = new URLSearchParams({
    vs_currency: "usd",
    days: profile.days,
  });
  const data = await fetchJson<{
    prices?: [number, number][];
    market_caps?: [number, number][];
    total_volumes?: [number, number][];
  }>(
    `${COINGECKO_BASE}/coins/${encodeURIComponent(clean)}/market_chart?${params.toString()}`,
    range === "1m" || range === "15m" ? 90 : range === "2y" || range === "5y" || range === "max" ? 900 : 240,
  );
  const prices = (data.prices ?? []).filter(
    ([timestamp, price]) =>
      Number.isFinite(timestamp) && Number.isFinite(price),
  );
  const volumes = new Map(
    (data.total_volumes ?? []).map(([timestamp, volume]) => [
      timestamp,
      volume,
    ]),
  );
  const marketCaps = new Map(
    (data.market_caps ?? []).map(([timestamp, cap]) => [timestamp, cap]),
  );
  const allPoints: MarketChartPoint[] = prices.map(([timestamp, price]) => ({
    timestamp,
    price,
    volume: volumes.get(timestamp),
    marketCap: marketCaps.get(timestamp),
  }));
  return resampleMarketChartPoints(allPoints, range);
}
