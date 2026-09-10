import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import {
  type BinanceKlineInterval,
  type MarketCandle,
} from "./binance-klines";
import {
  canonicalKlineIdentityDigest,
  isCanonicalKlineAssetIdentity,
  type ResolvedKlineAssetIdentity,
} from "./kline-asset-identity";
import {
  aggregateCandles,
  assessKlineSeriesQuality,
  buildKlineBarConsensus,
  klineRangeProfile,
  normalizeClosedCandles,
  rankKlineProviders,
  type KlineBarConsensus,
  type KlineSeriesQuality,
} from "./verified-kline-quality";

export type VerifiedKlineProviderId = "binance" | "kraken" | "coinbase";

export type VerifiedKlineProviderReceipt = {
  provider: VerifiedKlineProviderId;
  ok: boolean;
  source?: string;
  pair?: string;
  bars?: number;
  latestTimestamp?: number;
  latestClose?: number;
  latencyMs: number;
  qualityScore?: number;
  qualityState?: KlineSeriesQuality["state"];
  coveragePercent?: number;
  gapCount?: number;
  staleIntervals?: number | null;
  seriesDigest?: string;
  pages?: number;
  sourceObservedAt?: string;
  receivedAt: string;
  identityDigest: string;
  requestedIdentity: {
    assetClass: "crypto";
    marketId: string;
    symbol: string;
    quote: "USD";
    chainId: string | null;
    address: string | null;
  };
  resolvedIdentity?: {
    assetClass: "crypto";
    marketId: string;
    symbol: string;
    quote: "USD";
    chainId: string | null;
    address: string | null;
    pair: string;
  };
  identityMatched: boolean;
  error?: string;
};

export type VerifiedKlineConsensus = KlineBarConsensus & {
  successfulProviders: VerifiedKlineProviderId[];
  providerCount: number;
  selectedProvider: VerifiedKlineProviderId;
  selectedQualityScore: number;
  selectionScore: number;
};

export type VerifiedKlineResult = {
  identity: ResolvedKlineAssetIdentity;
  pair: string;
  source: string;
  candles: MarketCandle[];
  quality: KlineSeriesQuality;
  providerErrors: string[];
  providerReceipts: VerifiedKlineProviderReceipt[];
  consensus: VerifiedKlineConsensus;
  receivedAt: string;
  delivery: KlineDeliveryDecision;
};

export type KlineDeliveryDecision = {
  state: "live_verified" | "live_partial" | "conflict";
  withholdCandles: boolean;
  exactIdentity: boolean;
  independentProviderCount: number;
  goodProviderCount: number;
  freshProviderCount: number;
  worstSourceAgeMs: number | null;
  blockers: string[];
};

type ProviderSuccess = {
  provider: VerifiedKlineProviderId;
  pair: string;
  source: string;
  candles: MarketCandle[];
  quality: KlineSeriesQuality;
  pages: number;
  sourceObservedAt: string;
  receivedAt: string;
};

type FetchLike = typeof fetch;

type VerifiedProviderOptions = {
  fetchImpl?: FetchLike;
  nowMs?: number;
  requestTimeoutMs?: number;
};

type ProviderRuntimeOptions = Required<Pick<VerifiedProviderOptions, "fetchImpl" | "nowMs" | "requestTimeoutMs">> & {
  receivedNowMs: () => number;
};

const PROVIDER_PRIORITY: readonly VerifiedKlineProviderId[] = ["kraken", "coinbase", "binance"];
const REQUEST_TIMEOUT_MS = 7_000;

function finiteNumber(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function cleanBaseSymbol(symbol: string) {
  const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) throw new Error("Missing symbol");
  return clean.endsWith("USDT") ? clean.slice(0, -4) : clean.endsWith("USD") ? clean.slice(0, -3) : clean;
}

function sourceObservedAt(quality: KlineSeriesQuality) {
  if (quality.latestClosedTimestamp === null) throw new Error("provider:missing-latest-closed-candle");
  return new Date(quality.latestClosedTimestamp + quality.expectedIntervalMs).toISOString();
}

function requestedReceiptIdentity(identity: ResolvedKlineAssetIdentity) {
  return {
    assetClass: identity.assetClass,
    marketId: identity.marketId,
    symbol: identity.symbol,
    quote: identity.quote,
    chainId: identity.chainId,
    address: identity.address,
  } as const;
}

function receiptMatchesCanonicalIdentity(receipt: VerifiedKlineProviderReceipt, expectedIdentityDigest: string) {
  if (!receipt.ok || !receipt.identityMatched || !receipt.resolvedIdentity) return false;
  const requested = receipt.requestedIdentity;
  const { pair, ...resolved } = receipt.resolvedIdentity;
  return (
    receipt.identityDigest === expectedIdentityDigest &&
    canonicalKlineIdentityDigest(requested) === expectedIdentityDigest &&
    canonicalKlineIdentityDigest(resolved) === expectedIdentityDigest &&
    receipt.pair === pair &&
    requested.quote === "USD" &&
    resolved.quote === "USD"
  );
}

function parseCoinbaseRows(payload: unknown): MarketCandle[] {
  if (!Array.isArray(payload)) throw new Error("coinbase:invalid-payload");
  return payload.flatMap((row) => {
    if (!Array.isArray(row)) return [];
    const timestamp = finiteNumber(row[0]);
    const low = finiteNumber(row[1]);
    const high = finiteNumber(row[2]);
    const open = finiteNumber(row[3]);
    const close = finiteNumber(row[4]);
    const volume = finiteNumber(row[5]);
    if ([timestamp, open, high, low, close, volume].some((value) => value === null)) return [];
    return [{
      timestamp: (timestamp as number) * 1000,
      open: open as number,
      high: high as number,
      low: low as number,
      close: close as number,
      volume: volume as number,
    } satisfies MarketCandle];
  });
}

function krakenBaseSymbol(base: string) {
  if (base === "BTC") return "XBT";
  if (base === "DOGE") return "XDG";
  return base;
}

async function fetchKrakenKlines(
  identity: ResolvedKlineAssetIdentity,
  range: BinanceKlineInterval,
  options: ProviderRuntimeOptions,
): Promise<ProviderSuccess> {
  const profile = klineRangeProfile(range);
  const base = cleanBaseSymbol(identity.symbol);
  const pair = `${krakenBaseSymbol(base)}USD`;
  const params = new URLSearchParams({ pair, interval: String(profile.providerSourceInterval.krakenMinutes) });
  const response = await options.fetchImpl(`https://api.kraken.com/0/public/OHLC?${params.toString()}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(options.requestTimeoutMs),
  });
  if (!response.ok) throw new Error(`kraken:${response.status}`);
  const payload = await readJsonResponseBounded<{ error?: unknown; result?: Record<string, unknown> }>(response, 4_194_304);
  if (Array.isArray(payload.error) && payload.error.length) throw new Error(`kraken:${payload.error.join("|")}`);
  const result = payload.result;
  if (!result || typeof result !== "object") throw new Error("kraken:invalid-payload");
  const seriesEntries = Object.entries(result).filter(([key, value]) => key !== "last" && Array.isArray(value));
  if (seriesEntries.length !== 1) throw new Error("kraken:ambiguous-pair-response");
  const [resolvedPair, rows] = seriesEntries[0];
  const normalizedResolvedPair = resolvedPair.toUpperCase().replace(/[^A-Z0-9]/gu, "");
  const krakenBase = krakenBaseSymbol(base);
  const acceptedPairs = new Set([`${krakenBase}USD`, `X${krakenBase}ZUSD`, `${base}USD`, `X${base}ZUSD`]);
  if (!acceptedPairs.has(normalizedResolvedPair)) throw new Error("kraken:identity-mismatch");
  if (!Array.isArray(rows)) throw new Error("kraken:pair-unavailable");
  // Kraken's last row is the currently forming interval.
  const committedRows = rows.length > 1 ? rows.slice(0, -1) : [];
  const rawCandles = committedRows.flatMap((row) => {
    if (!Array.isArray(row)) return [];
    const timestamp = finiteNumber(row[0]);
    const open = finiteNumber(row[1]);
    const high = finiteNumber(row[2]);
    const low = finiteNumber(row[3]);
    const close = finiteNumber(row[4]);
    const volume = finiteNumber(row[6]);
    const trades = finiteNumber(row[7]);
    if ([timestamp, open, high, low, close, volume].some((value) => value === null)) return [];
    return [{
      timestamp: (timestamp as number) * 1000,
      open: open as number,
      high: high as number,
      low: low as number,
      close: close as number,
      volume: volume as number,
      trades: trades ?? undefined,
    } satisfies MarketCandle];
  });
  const assessed = assessKlineSeriesQuality({ rawCandles, range, nowMs: options.nowMs });
  if (assessed.candles.length < profile.minimumBars || assessed.quality.state === "rejected") {
    throw new Error(`kraken:quality-${assessed.quality.state}-${assessed.candles.length}/${profile.minimumBars}`);
  }
  return {
    provider: "kraken",
    pair,
    source: `Kraken Spot · public OHLC · ${profile.providerSourceInterval.krakenMinutes}m · ${assessed.candles.length} closed bars`,
    candles: assessed.candles,
    quality: assessed.quality,
    pages: 1,
    sourceObservedAt: sourceObservedAt(assessed.quality),
    receivedAt: new Date(options.receivedNowMs()).toISOString(),
  };
}

async function fetchCoinbaseKlines(
  identity: ResolvedKlineAssetIdentity,
  range: BinanceKlineInterval,
  options: ProviderRuntimeOptions,
): Promise<ProviderSuccess> {
  const profile = klineRangeProfile(range);
  const base = cleanBaseSymbol(identity.symbol);
  const pair = `${base}-USD`;
  const granularity = profile.providerSourceInterval.coinbaseGranularitySeconds;
  const aggregateFactor = profile.providerSourceInterval.coinbaseAggregateFactor;
  const sourceIntervalMs = granularity * 1_000;
  const targetSourceBars = Math.min(3_000, profile.targetBars * aggregateFactor);
  const maxPages = Math.min(12, Math.max(1, Math.ceil(targetSourceBars / 300)));
  const rawCandles: MarketCandle[] = [];
  let endMs = options.nowMs;
  let pages = 0;

  while (pages < maxPages && rawCandles.length < targetSourceBars) {
    const pageBars = Math.min(300, targetSourceBars - rawCandles.length);
    const startMs = endMs - pageBars * sourceIntervalMs;
    const params = new URLSearchParams({
      granularity: String(granularity),
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    });
    const response = await options.fetchImpl(`https://api.exchange.coinbase.com/products/${encodeURIComponent(pair)}/candles?${params.toString()}`, {
      headers: { accept: "application/json", "user-agent": "Velmere-Market-Integrity/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(options.requestTimeoutMs),
    });
    if (!response.ok) throw new Error(`coinbase:${response.status}`);
    const payload = await readJsonResponseBounded<unknown>(response, 4_194_304);
    const page = parseCoinbaseRows(payload);
    pages += 1;
    if (!page.length) break;
    rawCandles.push(...page);
    const earliest = Math.min(...page.map((row) => row.timestamp));
    if (!Number.isFinite(earliest) || earliest >= endMs) break;
    endMs = earliest - 1;
    if (page.length < pageBars) break;
  }

  const normalizedSource = normalizeClosedCandles({
    candles: rawCandles,
    range: aggregateFactor === 1 ? range : (granularity === 3600 ? "1h" : "1d"),
    nowMs: options.nowMs,
    maximumBars: targetSourceBars,
  });
  const aggregated = aggregateFactor === 1
    ? normalizedSource.candles
    : aggregateCandles({
        candles: normalizedSource.candles,
        sourceIntervalMs,
        targetIntervalMs: profile.intervalMs,
      });
  const assessed = assessKlineSeriesQuality({ rawCandles: aggregated, range, nowMs: options.nowMs });
  const coinbaseMinimum = Math.min(profile.minimumBars, 220);
  if (assessed.candles.length < coinbaseMinimum || assessed.quality.state === "rejected") {
    throw new Error(`coinbase:quality-${assessed.quality.state}-${assessed.candles.length}/${coinbaseMinimum}`);
  }
  return {
    provider: "coinbase",
    pair,
    source: `Coinbase Exchange Spot · ${granularity}s source${aggregateFactor > 1 ? ` aggregated x${aggregateFactor}` : ""} · ${assessed.candles.length} closed bars · ${pages} page(s)`,
    candles: assessed.candles,
    quality: assessed.quality,
    pages,
    sourceObservedAt: sourceObservedAt(assessed.quality),
    receivedAt: new Date(options.receivedNowMs()).toISOString(),
  };
}

async function timedProvider(
  provider: VerifiedKlineProviderId,
  identity: ResolvedKlineAssetIdentity,
  receivedNowMs: () => number,
  task: () => Promise<ProviderSuccess>,
): Promise<{ success?: ProviderSuccess; receipt: VerifiedKlineProviderReceipt }> {
  const startedAt = Date.now();
  try {
    const success = await task();
    const latest = success.candles.at(-1);
    return {
      success,
      receipt: {
        provider,
        ok: true,
        source: success.source,
        pair: success.pair,
        bars: success.candles.length,
        latestTimestamp: latest?.timestamp,
        latestClose: latest?.close,
        latencyMs: Date.now() - startedAt,
        qualityScore: success.quality.qualityScore,
        qualityState: success.quality.state,
        coveragePercent: success.quality.coveragePercent,
        gapCount: success.quality.gapCount,
        staleIntervals: success.quality.staleIntervals,
        seriesDigest: success.quality.seriesDigest,
        pages: success.pages,
        sourceObservedAt: success.sourceObservedAt,
        receivedAt: success.receivedAt,
        identityDigest: identity.identityDigest,
        requestedIdentity: requestedReceiptIdentity(identity),
        resolvedIdentity: {
          assetClass: "crypto",
          marketId: identity.marketId,
          symbol: identity.symbol,
          quote: "USD",
          chainId: identity.chainId,
          address: identity.address,
          pair: success.pair,
        },
        identityMatched: true,
      },
    };
  } catch (error) {
    return {
      receipt: {
        provider,
        ok: false,
        latencyMs: Date.now() - startedAt,
        receivedAt: new Date(receivedNowMs()).toISOString(),
        identityDigest: identity.identityDigest,
        requestedIdentity: requestedReceiptIdentity(identity),
        identityMatched: false,
        error: error instanceof Error ? error.message : `${provider}:unknown-error`,
      },
    };
  }
}

export function classifyKlineDelivery(args: {
  identityExact: boolean;
  expectedIdentityDigest: string;
  providerReceipts: VerifiedKlineProviderReceipt[];
  consensus: KlineBarConsensus;
  selectedQuality: KlineSeriesQuality;
  range: BinanceKlineInterval;
  nowMs?: number;
}): KlineDeliveryDecision {
  const nowMs = typeof args.nowMs === "number" && Number.isFinite(args.nowMs) ? args.nowMs : Date.now();
  const profile = klineRangeProfile(args.range);
  const exactReceipts = args.providerReceipts.filter((receipt) =>
    receiptMatchesCanonicalIdentity(receipt, args.expectedIdentityDigest));
  const providerIdentityMismatch = args.providerReceipts.some((receipt) =>
    receipt.ok && !receiptMatchesCanonicalIdentity(receipt, args.expectedIdentityDigest));
  const independentProviderCount = new Set(exactReceipts.map((receipt) => receipt.provider)).size;
  const goodReceipts = exactReceipts.filter((receipt) => receipt.qualityState === "good" || receipt.qualityState === "excellent");
  const goodProviderCount = new Set(goodReceipts.map((receipt) => receipt.provider)).size;
  const maxFreshAgeMs = (profile.maxStaleIntervals + 1) * profile.intervalMs + 5_000;
  const sourceTimings = exactReceipts.flatMap((receipt) => {
    if (!receipt.sourceObservedAt) return [];
    const observed = Date.parse(receipt.sourceObservedAt);
    const received = Date.parse(receipt.receivedAt);
    return Number.isFinite(observed) && Number.isFinite(received) ? [{ observed, received }] : [];
  });
  const sourceAges = sourceTimings.flatMap(({ observed, received }) => [nowMs - observed, nowMs - received]);
  const futureTimestamp = sourceAges.some((ageMs) => ageMs < -5_000);
  const invalidTimestampOrder = sourceTimings.some(({ observed, received }) => observed > received + 5_000);
  const latestCloseDivergence =
    typeof args.consensus.latestCloseSpreadPct === "number" &&
    args.consensus.latestCloseSpreadPct > profile.divergenceWarningPct;
  const freshProviderCount = new Set(exactReceipts.filter((receipt) => {
    if (!receipt.sourceObservedAt) return false;
    const observed = Date.parse(receipt.sourceObservedAt);
    const received = Date.parse(receipt.receivedAt);
    const observedAgeMs = nowMs - observed;
    const receivedAgeMs = nowMs - received;
    return (
      Number.isFinite(observed) && Number.isFinite(received) &&
      observed <= received + 5_000 &&
      observedAgeMs >= -5_000 && observedAgeMs <= maxFreshAgeMs &&
      receivedAgeMs >= -5_000 && receivedAgeMs <= maxFreshAgeMs
    );
  }).map((receipt) => receipt.provider)).size;
  const worstSourceAgeMs = sourceAges.length ? Math.max(...sourceAges.map((ageMs) => Math.max(0, ageMs))) : null;
  const minimumConsensusBars = Math.max(32, Math.ceil(profile.minimumBars * 0.5));
  const blockers: string[] = [];
  if (!args.identityExact) blockers.push("identity_not_exact");
  if (providerIdentityMismatch) blockers.push("provider_identity_mismatch");
  if (independentProviderCount < 2) blockers.push(`provider_quorum:${independentProviderCount}/2`);
  if (goodProviderCount < 2) blockers.push(`good_provider_quorum:${goodProviderCount}/2`);
  if (freshProviderCount < 2) blockers.push(`fresh_provider_quorum:${freshProviderCount}/2`);
  if (args.selectedQuality.state !== "good" && args.selectedQuality.state !== "excellent") blockers.push(`selected_quality:${args.selectedQuality.state}`);
  if (args.consensus.state !== "corroborated") blockers.push(`consensus:${args.consensus.state}`);
  if (args.consensus.comparedBars < minimumConsensusBars) blockers.push(`consensus_depth:${args.consensus.comparedBars}/${minimumConsensusBars}`);
  if (futureTimestamp) blockers.push("provider_timestamp_in_future");
  if (invalidTimestampOrder) blockers.push("provider_timestamp_order_invalid");
  if (latestCloseDivergence) blockers.push("latest_close_divergence");

  const conflict =
    !args.identityExact ||
    providerIdentityMismatch ||
    futureTimestamp ||
    invalidTimestampOrder ||
    latestCloseDivergence ||
    args.consensus.state === "partial" ||
    args.consensus.state === "divergence_warning";
  if (conflict) {
    return {
      state: "conflict",
      withholdCandles: true,
      exactIdentity: args.identityExact,
      independentProviderCount,
      goodProviderCount,
      freshProviderCount,
      worstSourceAgeMs,
      blockers,
    };
  }

  const verified = blockers.length === 0;
  return {
    state: verified ? "live_verified" : "live_partial",
    withholdCandles: false,
    exactIdentity: args.identityExact,
    independentProviderCount,
    goodProviderCount,
    freshProviderCount,
    worstSourceAgeMs,
    blockers,
  };
}

export async function fetchVerifiedKlines(
  identity: ResolvedKlineAssetIdentity,
  range: BinanceKlineInterval = "7d",
  options: VerifiedProviderOptions = {},
): Promise<VerifiedKlineResult> {
  if (
    !isCanonicalKlineAssetIdentity(identity) ||
    identity.exactMatch !== true ||
    identity.resolver !== "coingecko_coin_id_and_server_venue_registry" ||
    canonicalKlineIdentityDigest(identity) !== identity.identityDigest
  ) throw new Error("Kline identity is not an exact server-resolved identity");
  const fixedNowMs = typeof options.nowMs === "number" && Number.isFinite(options.nowMs) ? options.nowMs : null;
  const nowMs = fixedNowMs ?? Date.now();
  const receivedNowMs = () => fixedNowMs ?? Date.now();
  const requestTimeoutMs = Math.max(1_000, Math.min(15_000, options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS));
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => {
    const target = typeof input === "string" || input instanceof URL ? input : input.url;
    return brokeredEgressFetch(target, init, {
      profile: "market_intelligence",
      operation: "verified_exact_usd_kline_provider",
      timeoutMs: requestTimeoutMs,
      maxRedirects: 0,
      maxResponseBytes: 4_194_304,
    });
  });
  const normalizedOptions = { fetchImpl, nowMs, requestTimeoutMs, receivedNowMs };

  const results = await Promise.all([
    Promise.resolve({
      success: undefined,
      receipt: {
        provider: "binance" as const,
        ok: false,
        latencyMs: 0,
        receivedAt: new Date(receivedNowMs()).toISOString(),
        identityDigest: identity.identityDigest,
        requestedIdentity: requestedReceiptIdentity(identity),
        identityMatched: false,
        error: "binance:exact-USD-quote-not-supported",
      } satisfies VerifiedKlineProviderReceipt,
    }),
    timedProvider("kraken", identity, receivedNowMs, () => fetchKrakenKlines(identity, range, normalizedOptions)),
    timedProvider("coinbase", identity, receivedNowMs, () => fetchCoinbaseKlines(identity, range, normalizedOptions)),
  ]);

  const successes = results.flatMap((item) => (item.success ? [item.success] : []));
  if (!successes.length) {
    throw new Error(`Verified kline providers unavailable (${results.map((item) => item.receipt.error).filter(Boolean).join(", ")})`);
  }

  const barConsensus = buildKlineBarConsensus({ series: successes, range });
  const ranked = rankKlineProviders({ series: successes, consensus: barConsensus, priority: PROVIDER_PRIORITY });
  const selected = ranked[0];
  if (!selected) throw new Error("Verified kline provider selection failed");
  const consensus: VerifiedKlineConsensus = {
    ...barConsensus,
    successfulProviders: successes.map((item) => item.provider),
    providerCount: successes.length,
    selectedProvider: selected.provider,
    selectedQualityScore: selected.quality.qualityScore,
    selectionScore: selected.selectionScore,
  };
  const providerReceipts = results.map((item) => item.receipt);
  const delivery = classifyKlineDelivery({
    identityExact: identity.exactMatch && identity.identityDigest.length > 0,
    expectedIdentityDigest: identity.identityDigest,
    providerReceipts,
    consensus,
    selectedQuality: selected.quality,
    range,
    nowMs: receivedNowMs(),
  });

  return {
    identity,
    pair: selected.pair,
    source: selected.source,
    candles: selected.candles,
    quality: selected.quality,
    providerErrors: results.filter((item) => !item.receipt.ok).map((item) => item.receipt.error ?? `${item.receipt.provider}:failed`),
    providerReceipts,
    consensus,
    receivedAt: new Date(receivedNowMs()).toISOString(),
    delivery,
  };
}
