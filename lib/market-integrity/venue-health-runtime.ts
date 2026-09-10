import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import { applyDurableRateLimit } from "@/lib/security/durable-rate-limit";
import { executeUpstashRestCommand, executeUpstashRestEval } from "@/lib/security/upstash-rest-atomic";
import {
  normalizePass463AssetSymbol,
  resolvePass463VenuePair,
  type Pass463PairResolutionState,
  type Pass463QuoteCurrency,
} from "./canonical-pair-coverage";

export type Pass461VenueId = "binance" | "mexc" | "coinbase";
export type Pass461VenueState =
  | "source_bound"
  | "review"
  | "stale"
  | "provider_error"
  | "unsupported";
export type Pass461StorageMode =
  | "upstash_rest"
  | "upstash_fallback_memory"
  | "memory";

export type Pass461VenueMetric = {
  id:
    | "connectivity"
    | "server_clock"
    | "book_ticker"
    | "orderbook_depth"
    | "kline_continuity"
    | "market_activity"
    | "websocket_policy";
  label: string;
  value: string;
  state: "ok" | "watch" | "missing";
  source: string;
};

export type Pass461VenueHealthSnapshot = {
  version: "venue-health-runtime";
  venueId: Pass461VenueId;
  venue: string;
  assetSymbol: string;
  pair: string;
  baseCurrency: string;
  quoteCurrency: Pass463QuoteCurrency;
  pairResolutionState: Pass463PairResolutionState;
  pairResolutionNote: string;
  state: Pass461VenueState;
  source: string;
  observedAt: string;
  sourceTimestamp: number | null;
  freshnessSeconds: number | null;
  latencyMs: number | null;
  serverClockDriftMs: number | null;
  spreadBps: number | null;
  referencePrice: number | null;
  bidDepthUsd: number | null;
  askDepthUsd: number | null;
  depthImbalancePercent: number | null;
  klineContinuityPercent: number | null;
  priceChange24h: number | null;
  volume24h: number | null;
  confidenceCap: number;
  healthScore: number;
  cacheState: "hit" | "miss" | "stale_fallback";
  storageMode: Pass461StorageMode;
  quotaMode: string;
  quotaRemaining: number | null;
  providerErrors: string[];
  metrics: Pass461VenueMetric[];
  websocketPolicy: {
    endpoint: string;
    heartbeat: string;
    reconnect: string;
    expiry: string;
  };
  boundary: string;
};

type JsonRecord = Record<string, unknown>;
type CachedSnapshot = { expiresAt: number; value: Pass461VenueHealthSnapshot };
type TimedResponse = { payload: unknown; latencyMs: number };

const memoryCache = new Map<string, CachedSnapshot>();
const inflight = new Map<string, Promise<Pass461VenueHealthSnapshot>>();
const CACHE_TTL_MS = 20_000;
const STALE_FALLBACK_MS = 10 * 60_000;

const VENUES: Record<
  Pass461VenueId,
  {
    label: string;
    baseUrl: string;
    pair: string;
    apiStyle: "binance_like" | "coinbase_exchange";
    websocketPolicy: Pass461VenueHealthSnapshot["websocketPolicy"];
  }
> = {
  binance: {
    label: "Binance",
    baseUrl: "https://data-api.binance.vision/api/v3",
    pair: "BTCUSDT",
    apiStyle: "binance_like",
    websocketPolicy: {
      endpoint: "wss://stream.binance.com:9443/ws/<symbol>@bookTicker",
      heartbeat: "Server ping/pong must stay acknowledged; REST freshness is shown separately.",
      reconnect: "Reconnect with jitter, resubscribe and rebuild depth from a fresh REST snapshot.",
      expiry: "Rotate long-lived connections before the documented 24-hour connection boundary.",
    },
  },
  mexc: {
    label: "MEXC",
    baseUrl: "https://api.mexc.com/api/v3",
    pair: "BTCUSDT",
    apiStyle: "binance_like",
    websocketPolicy: {
      endpoint: "wss://wbs-api.mexc.com/ws",
      heartbeat: "Send/verify heartbeat and expose the last accepted market event timestamp.",
      reconnect: "Reconnect with jitter, resubscribe and mark fallback until a fresh event is received.",
      expiry: "Rotate the connection before the documented 24-hour validity limit.",
    },
  },
  coinbase: {
    label: "Coinbase Exchange",
    baseUrl: "https://api.exchange.coinbase.com",
    pair: "BTC-USD",
    apiStyle: "coinbase_exchange",
    websocketPolicy: {
      endpoint: "wss://advanced-trade-ws.coinbase.com",
      heartbeat: "Subscribe to heartbeats alongside ticker/level2 so quiet channels do not look healthy after updates stop.",
      reconnect: "Reconnect with jitter, resubscribe and rebuild the book after disconnects or sequence gaps.",
      expiry: "No fixed 24-hour expiry is assumed; rotate on disconnect, stale heartbeat or sequence-gap evidence.",
    },
  },
};

function finite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function normalizeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9:_@.-]/g, "_").slice(0, 180);
}

function resolveStorageMode(): Pass461StorageMode {
  return process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
    ? "upstash_rest"
    : "memory";
}

function venueStorageConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url: url.replace(/\/$/, ""), token, provider: "upstash" as const } : null;
}

async function readDurableSnapshot(
  venueId: Pass461VenueId,
  assetSymbol = "BTC",
): Promise<Pass461VenueHealthSnapshot | null> {
  const config = venueStorageConfig();
  if (!config) return null;
  const canonicalAsset = normalizePass463AssetSymbol(assetSymbol);
  const key = normalizeKey(`velmere:pass461:venue:${venueId}:${canonicalAsset}:snapshot`);
  try {
    const raw = await executeUpstashRestCommand<unknown>(["GET", key], {
      config,
      timeoutMs: 1_250,
      maxResponseBytes: 512 * 1024,
      operation: "pass461_venue_snapshot_read",
    });
    if (typeof raw !== "string") return null;
    const parsed = JSON.parse(raw) as Pass461VenueHealthSnapshot;
    return parsed?.version === "venue-health-runtime" ? parsed : null;
  } catch {
    return null;
  }
}

async function writeDurableSnapshot(snapshot: Pass461VenueHealthSnapshot) {
  const config = venueStorageConfig();
  if (!config) return null;
  const snapshotKey = normalizeKey(
    `velmere:pass461:venue:${snapshot.venueId}:${snapshot.assetSymbol}:snapshot`,
  );
  const ledgerKey = normalizeKey(
    process.env.VELMERE_MARKET_PROVIDER_LEDGER_KEY ||
      "velmere:pass461:provider-ledger",
  );
  const ttlSeconds = Math.max(
    30,
    Number(process.env.VELMERE_MARKET_PROVIDER_CACHE_TTL_SECONDS || 180),
  );
  const ledgerMax = Math.max(
    50,
    Math.min(
      Number(process.env.VELMERE_MARKET_PROVIDER_LEDGER_MAX || 600),
      2_000,
    ),
  );
  const safeLedgerRow = JSON.stringify({
    version: snapshot.version,
    venueId: snapshot.venueId,
    assetSymbol: snapshot.assetSymbol,
    pair: snapshot.pair,
    pairResolutionState: snapshot.pairResolutionState,
    state: snapshot.state,
    observedAt: snapshot.observedAt,
    freshnessSeconds: snapshot.freshnessSeconds,
    latencyMs: snapshot.latencyMs,
    spreadBps: snapshot.spreadBps,
    healthScore: snapshot.healthScore,
    confidenceCap: snapshot.confidenceCap,
    providerErrors: snapshot.providerErrors.slice(0, 4),
  });
  const lua = [
    "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])",
    "redis.call('LPUSH', KEYS[2], ARGV[3])",
    "redis.call('LTRIM', KEYS[2], 0, tonumber(ARGV[4]) - 1)",
    "return 1",
  ].join("\n");
  try {
    const result = await executeUpstashRestEval<unknown>({
      script: lua,
      keys: [snapshotKey, ledgerKey],
      argv: [JSON.stringify(snapshot), String(ttlSeconds), safeLedgerRow, String(ledgerMax)],
      config,
      timeoutMs: 1_250,
      maxResponseBytes: 512 * 1024,
      operation: "pass461_venue_snapshot_write",
    });
    return Number(result) === 1 ? result : null;
  } catch {
    return null;
  }
}

async function timedJson(url: string): Promise<TimedResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_750);
  const startedAt = Date.now();
  try {
    const response = await brokeredEgressFetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Velmere-Venue-Health/461",
      },
      cache: "no-store",
      signal: controller.signal,
    }, { profile: "venue_health", operation: "venue_health_probe", timeoutMs: 3_750 });
    if (!response.ok) throw new Error(`http_${response.status}`);
    return { payload: await readJsonResponseBounded<unknown>(response, 512 * 1024), latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

function depthMetrics(payload: unknown, midpoint: number | null) {
  const data = record(payload);
  const bids = array(data.bids).slice(0, 20);
  const asks = array(data.asks).slice(0, 20);
  const notional = (levels: unknown[]): number =>
    levels.reduce<number>((sum, level) => {
      const row = array(level);
      const price = finite(row[0]);
      const quantity = finite(row[1]);
      return price !== null && quantity !== null
        ? sum + price * quantity
        : sum;
    }, 0);
  const bidDepthUsd = bids.length ? notional(bids) : null;
  const askDepthUsd = asks.length ? notional(asks) : null;
  const denominator = (bidDepthUsd || 0) + (askDepthUsd || 0);
  const depthImbalancePercent =
    denominator > 0 && bidDepthUsd !== null && askDepthUsd !== null
      ? ((bidDepthUsd - askDepthUsd) / denominator) * 100
      : null;
  return {
    bidDepthUsd,
    askDepthUsd,
    depthImbalancePercent,
    midpoint,
  };
}

function klineMetrics(payload: unknown, apiStyle: "binance_like" | "coinbase_exchange") {
  const rawRows = array(payload).map((row) => array(row));
  const rows = apiStyle === "coinbase_exchange"
    ? rawRows
        .filter((row) => row.length >= 6)
        .map((row) => ({
          openTimestampMs: (finite(row[0]) ?? 0) * 1_000,
          closeTimestampMs: ((finite(row[0]) ?? 0) + 60) * 1_000,
        }))
        .sort((a, b) => a.openTimestampMs - b.openTimestampMs)
    : rawRows
        .filter((row) => row.length >= 7)
        .map((row) => ({
          openTimestampMs: finite(row[0]) ?? 0,
          closeTimestampMs: finite(row[6]) ?? 0,
        }));
  if (rows.length < 2)
    return {
      continuityPercent: null,
      latestTimestamp: null as number | null,
    };
  let expected = 0;
  let continuous = 0;
  for (let index = 1; index < rows.length; index += 1) {
    const previousOpen = rows[index - 1].openTimestampMs;
    const currentOpen = rows[index].openTimestampMs;
    if (!previousOpen || !currentOpen) continue;
    expected += 1;
    if (Math.abs(currentOpen - previousOpen - 60_000) <= 2_000) continuous += 1;
  }
  const latestClose = rows.at(-1)?.closeTimestampMs || null;
  return {
    continuityPercent: expected ? (continuous / expected) * 100 : null,
    latestTimestamp:
      latestClose !== null ? Math.floor(latestClose / 1_000) : null,
  };
}

function metric(
  id: Pass461VenueMetric["id"],
  label: string,
  value: string,
  state: Pass461VenueMetric["state"],
  source: string,
): Pass461VenueMetric {
  return { id, label, value, state, source };
}

function formatNumber(value: number | null, suffix = "") {
  return value === null
    ? "source required"
    : `${new Intl.NumberFormat("en-US", {
        maximumFractionDigits: value >= 1_000 ? 0 : 2,
      }).format(value)}${suffix}`;
}

function stateFromSignals(input: {
  errors: string[];
  freshnessSeconds: number | null;
  latencyMs: number | null;
  serverClockDriftMs: number | null;
  spreadBps: number | null;
  depthImbalancePercent: number | null;
  klineContinuityPercent: number | null;
}): Pick<Pass461VenueHealthSnapshot, "state" | "healthScore" | "confidenceCap"> {
  if (input.errors.length >= 4)
    return { state: "provider_error", healthScore: 20, confidenceCap: 20 };
  if (input.freshnessSeconds === null || input.freshnessSeconds > 180)
    return { state: "stale", healthScore: 42, confidenceCap: 38 };

  let penalty = input.errors.length * 7;
  if ((input.latencyMs ?? 0) > 1_500) penalty += 18;
  else if ((input.latencyMs ?? 0) > 800) penalty += 8;
  if ((input.serverClockDriftMs ?? 0) > 5_000) penalty += 14;
  else if ((input.serverClockDriftMs ?? 0) > 2_000) penalty += 6;
  if ((input.spreadBps ?? 0) > 15) penalty += 18;
  else if ((input.spreadBps ?? 0) > 7) penalty += 8;
  if (Math.abs(input.depthImbalancePercent ?? 0) > 70) penalty += 14;
  else if (Math.abs(input.depthImbalancePercent ?? 0) > 50) penalty += 6;
  if ((input.klineContinuityPercent ?? 100) < 90) penalty += 16;
  else if ((input.klineContinuityPercent ?? 100) < 97) penalty += 6;

  const healthScore = Math.max(20, Math.min(96, 96 - penalty));
  if (penalty >= 18)
    return {
      state: "review",
      healthScore,
      confidenceCap: Math.min(70, healthScore),
    };
  return {
    state: "source_bound",
    healthScore,
    confidenceCap: Math.min(88, healthScore),
  };
}

function unavailableVenueSnapshot({
  venueId,
  requestedAsset,
  reason,
  state = "unsupported",
  quotaMode = "not_run",
  quotaRemaining = null,
}: {
  venueId: Pass461VenueId;
  requestedAsset: string;
  reason: string;
  state?: Extract<Pass461VenueState, "unsupported" | "provider_error">;
  quotaMode?: string;
  quotaRemaining?: number | null;
}): Pass461VenueHealthSnapshot {
  const config = VENUES[venueId];
  const target = resolvePass463VenuePair(venueId, requestedAsset);
  return {
    version: "venue-health-runtime",
    venueId,
    venue: config.label,
    assetSymbol: target.assetSymbol,
    pair: target.pair ?? "source-required",
    baseCurrency: target.baseCurrency,
    quoteCurrency: target.quoteCurrency,
    pairResolutionState: target.resolutionState,
    pairResolutionNote: target.resolutionNote,
    state,
    source: `${config.label} public market-data probe · PASS463 pair resolver`,
    observedAt: new Date().toISOString(),
    sourceTimestamp: null,
    freshnessSeconds: null,
    latencyMs: null,
    serverClockDriftMs: null,
    spreadBps: null,
    referencePrice: null,
    bidDepthUsd: null,
    askDepthUsd: null,
    depthImbalancePercent: null,
    klineContinuityPercent: null,
    priceChange24h: null,
    volume24h: null,
    confidenceCap: state === "unsupported" ? 18 : 20,
    healthScore: 20,
    cacheState: "miss",
    storageMode: resolveStorageMode(),
    quotaMode,
    quotaRemaining,
    providerErrors: [reason],
    metrics: [
      metric(
        "connectivity",
        "Pair coverage",
        target.pair ?? "source required",
        "missing",
        target.resolutionNote,
      ),
    ],
    websocketPolicy: config.websocketPolicy,
    boundary:
      "No venue telemetry is emitted without a resolvable public spot pair. Pair coverage is not proof of reserves, solvency, withdrawals or exchange safety.",
  };
}

async function probeVenue(
  venueId: Pass461VenueId,
  requestedAsset = "BTC",
): Promise<Pass461VenueHealthSnapshot> {
  const config = VENUES[venueId];
  const target = resolvePass463VenuePair(venueId, requestedAsset);
  const cacheKey = `${venueId}:${target.assetSymbol}`;
  if (!target.pair) {
    return unavailableVenueSnapshot({
      venueId,
      requestedAsset: target.assetSymbol,
      reason: target.resolutionNote,
    });
  }
  const pair = target.pair;
  const now = Date.now();
  const quota = await applyDurableRateLimit({
    key: cacheKey,
    namespace: "velmere:pass461:venue-probe",
    limit: Math.max(
      2,
      Number(process.env.VELMERE_VENUE_PROBE_MAX_PER_MINUTE || 12),
    ),
    windowMs: 60_000,
  });

  if (!quota.ok) {
    const cached =
      memoryCache.get(cacheKey)?.value ||
      (await readDurableSnapshot(venueId, target.assetSymbol));
    if (cached) {
      return {
        ...cached,
        cacheState: "stale_fallback",
        storageMode:
          quota.mode === "upstash_rest"
            ? "upstash_rest"
            : quota.mode === "upstash_fallback_memory"
              ? "upstash_fallback_memory"
              : "memory",
        quotaMode: quota.mode,
        quotaRemaining: quota.remaining,
        providerErrors: [
          ...cached.providerErrors,
          "Venue probe quota guarded; showing the latest cached snapshot.",
        ].slice(0, 6),
        confidenceCap: Math.min(cached.confidenceCap, 62),
      };
    }
    return unavailableVenueSnapshot({
      venueId,
      requestedAsset: target.assetSymbol,
      state: "provider_error",
      quotaMode: quota.mode,
      quotaRemaining: quota.remaining,
      reason: `Venue probe quota guarded; retry after ${quota.retryAfterSeconds ?? 60}s.`,
    });
  }

  const endpoints =
    config.apiStyle === "coinbase_exchange"
      ? {
          ping: `${config.baseUrl}/products/${pair}`,
          time: `${config.baseUrl}/products/${pair}/ticker`,
          ticker: `${config.baseUrl}/products/${pair}/stats`,
          book: `${config.baseUrl}/products/${pair}/ticker`,
          depth: `${config.baseUrl}/products/${pair}/book?level=2`,
          klines: `${config.baseUrl}/products/${pair}/candles?granularity=60`,
        }
      : {
          ping: `${config.baseUrl}/ping`,
          time: `${config.baseUrl}/time`,
          ticker: `${config.baseUrl}/ticker/24hr?symbol=${pair}`,
          book: `${config.baseUrl}/ticker/bookTicker?symbol=${pair}`,
          depth: `${config.baseUrl}/depth?symbol=${pair}&limit=100`,
          klines: `${config.baseUrl}/klines?symbol=${pair}&interval=1m&limit=30`,
        };

  const errors: string[] = [];
  const entries = await Promise.all(
    Object.entries(endpoints).map(async ([name, endpoint]) => {
      try {
        return [name, await timedJson(endpoint)] as const;
      } catch (error) {
        errors.push(
          `${name}:${error instanceof Error ? error.message.slice(0, 80) : "provider_error"}`,
        );
        return [name, null] as const;
      }
    }),
  );
  const responseMap = new Map(entries);
  const payload = (name: keyof typeof endpoints) => responseMap.get(name)?.payload;
  const latencyValues = entries
    .map(([, response]) => response?.latencyMs)
    .filter((value): value is number => typeof value === "number");
  const latencyMs = latencyValues.length
    ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
    : null;

  const isCoinbase = config.apiStyle === "coinbase_exchange";
  const time = record(payload("time"));
  const ticker = record(payload("ticker"));
  const book = record(payload("book"));
  const coinbaseTimeMs = isCoinbase && typeof book.time === "string"
    ? Date.parse(book.time)
    : isCoinbase && typeof time.time === "string"
      ? Date.parse(time.time)
      : null;
  const serverTime = isCoinbase
    ? Number.isFinite(coinbaseTimeMs) ? coinbaseTimeMs : null
    : finite(time.serverTime);
  const serverClockDriftMs = serverTime === null ? null : Math.abs(now - serverTime);
  const bid = isCoinbase ? finite(book.bid) : finite(book.bidPrice);
  const ask = isCoinbase ? finite(book.ask) : finite(book.askPrice);
  const midpoint =
    bid !== null && ask !== null && bid > 0 && ask > 0 ? (bid + ask) / 2 : null;
  const referencePrice = isCoinbase
    ? finite(book.price) ?? finite(ticker.last) ?? midpoint
    : finite(ticker.lastPrice) ?? finite(book.price) ?? midpoint;
  const spreadBps =
    midpoint && bid !== null && ask !== null
      ? Math.abs(((ask - bid) / midpoint) * 10_000)
      : null;
  const depth = depthMetrics(payload("depth"), midpoint);
  const klines = klineMetrics(payload("klines"), config.apiStyle);
  const tickerTimestampMs = isCoinbase
    ? Number.isFinite(coinbaseTimeMs) ? coinbaseTimeMs : null
    : finite(ticker.closeTime) || finite(ticker.timestamp) || finite(ticker.ts);
  const sourceTimestamp =
    tickerTimestampMs !== null
      ? Math.floor(tickerTimestampMs / 1_000)
      : klines.latestTimestamp;
  const freshnessSeconds =
    sourceTimestamp === null
      ? null
      : Math.max(0, Math.floor(Date.now() / 1_000) - sourceTimestamp);
  const coinbaseOpen = finite(ticker.open);
  const coinbaseLast = finite(ticker.last) ?? referencePrice;
  const priceChange24h = isCoinbase
    ? coinbaseOpen !== null && coinbaseLast !== null && coinbaseOpen > 0
      ? ((coinbaseLast - coinbaseOpen) / coinbaseOpen) * 100
      : null
    : finite(ticker.priceChangePercent);
  const baseVolume = finite(ticker.volume);
  const volume24h = isCoinbase
    ? baseVolume !== null && referencePrice !== null
      ? baseVolume * referencePrice
      : null
    : finite(ticker.quoteVolume) || baseVolume;

  const evaluated = stateFromSignals({
    errors,
    freshnessSeconds,
    latencyMs,
    serverClockDriftMs,
    spreadBps,
    depthImbalancePercent: depth.depthImbalancePercent,
    klineContinuityPercent: klines.continuityPercent,
  });
  const storageMode: Pass461StorageMode =
    quota.mode === "upstash_rest"
      ? "upstash_rest"
      : quota.mode === "upstash_fallback_memory"
        ? "upstash_fallback_memory"
        : resolveStorageMode();
  const endpointSource = {
    connectivity: isCoinbase
      ? `${config.label} GET /products/${pair}`
      : `${config.label} GET /api/v3/ping`,
    clock: isCoinbase
      ? `${config.label} GET /products/${pair}/ticker`
      : `${config.label} GET /api/v3/time`,
    book: isCoinbase
      ? `${config.label} GET /products/${pair}/ticker`
      : `${config.label} GET /api/v3/ticker/bookTicker`,
    depth: isCoinbase
      ? `${config.label} GET /products/${pair}/book?level=2`
      : `${config.label} GET /api/v3/depth`,
    klines: isCoinbase
      ? `${config.label} GET /products/${pair}/candles?granularity=60`
      : `${config.label} GET /api/v3/klines`,
    activity: isCoinbase
      ? `${config.label} GET /products/${pair}/stats`
      : `${config.label} GET /api/v3/ticker/24hr`,
  };

  const snapshot: Pass461VenueHealthSnapshot = {
    version: "venue-health-runtime",
    venueId,
    venue: config.label,
    assetSymbol: target.assetSymbol,
    pair,
    baseCurrency: target.baseCurrency,
    quoteCurrency: target.quoteCurrency,
    pairResolutionState: target.resolutionState,
    pairResolutionNote: target.resolutionNote,
    state: evaluated.state,
    source: isCoinbase
      ? `${config.label} public Exchange REST · product/ticker/stats/book/candles`
      : `${config.label} public Spot REST · ping/time/ticker/book/depth/klines`,
    observedAt: new Date().toISOString(),
    sourceTimestamp,
    freshnessSeconds,
    latencyMs,
    serverClockDriftMs,
    spreadBps,
    referencePrice,
    bidDepthUsd: depth.bidDepthUsd,
    askDepthUsd: depth.askDepthUsd,
    depthImbalancePercent: depth.depthImbalancePercent,
    klineContinuityPercent: klines.continuityPercent,
    priceChange24h,
    volume24h,
    confidenceCap: evaluated.confidenceCap,
    healthScore: evaluated.healthScore,
    cacheState: "miss",
    storageMode,
    quotaMode: quota.mode,
    quotaRemaining: quota.remaining,
    providerErrors: errors.slice(0, 6),
    websocketPolicy: config.websocketPolicy,
    metrics: [
      metric(
        "connectivity",
        "REST connectivity",
        errors.some((value) => value.startsWith("ping:"))
          ? "ping failed"
          : "public endpoint reachable",
        errors.some((value) => value.startsWith("ping:")) ? "missing" : "ok",
        endpointSource.connectivity,
      ),
      metric(
        "server_clock",
        "Server clock drift",
        formatNumber(serverClockDriftMs, " ms"),
        serverClockDriftMs === null
          ? "missing"
          : serverClockDriftMs > 5_000
            ? "watch"
            : "ok",
        endpointSource.clock,
      ),
      metric(
        "book_ticker",
        "Top-of-book spread",
        formatNumber(spreadBps, " bps"),
        spreadBps === null ? "missing" : spreadBps > 15 ? "watch" : "ok",
        endpointSource.book,
      ),
      metric(
        "orderbook_depth",
        "Top-20 depth",
        `bid ${formatNumber(depth.bidDepthUsd, " USD")} · ask ${formatNumber(depth.askDepthUsd, " USD")} · imbalance ${formatNumber(depth.depthImbalancePercent, "%")}`,
        depth.bidDepthUsd === null || depth.askDepthUsd === null
          ? "missing"
          : Math.abs(depth.depthImbalancePercent || 0) > 70
            ? "watch"
            : "ok",
        endpointSource.depth,
      ),
      metric(
        "kline_continuity",
        "1m candle continuity",
        formatNumber(klines.continuityPercent, "%"),
        klines.continuityPercent === null
          ? "missing"
          : klines.continuityPercent < 90
            ? "watch"
            : "ok",
        endpointSource.klines,
      ),
      metric(
        "market_activity",
        "24h market activity",
        `${formatNumber(priceChange24h, "%")} · ${formatNumber(volume24h, " quote volume")}`,
        priceChange24h === null && volume24h === null ? "missing" : "ok",
        endpointSource.activity,
      ),
      metric(
        "websocket_policy",
        "WebSocket lifecycle",
        `${config.websocketPolicy.heartbeat} ${config.websocketPolicy.expiry}`,
        "ok",
        config.websocketPolicy.endpoint,
      ),
    ],
    boundary:
      "Venue health is a connectivity, freshness, spread, depth and continuity probe. It is not proof of reserves, solvency, withdrawal availability or exchange safety.",
  };

  const durableWrite = await writeDurableSnapshot(snapshot);
  const finalSnapshot =
    snapshot.storageMode === "upstash_rest" && !durableWrite
      ? { ...snapshot, storageMode: "upstash_fallback_memory" as const }
      : snapshot;
  memoryCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: finalSnapshot,
  });
  return finalSnapshot;
}

export async function resolvePass461VenueHealth(
  venueId: string,
  requestedAsset = "BTC",
): Promise<Pass461VenueHealthSnapshot | null> {
  const normalized = venueId.toLowerCase();
  if (normalized !== "binance" && normalized !== "mexc" && normalized !== "coinbase") return null;
  const venueKey = normalized as Pass461VenueId;
  const assetSymbol = normalizePass463AssetSymbol(requestedAsset || "BTC");
  const cacheKey = `${venueKey}:${assetSymbol}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.value, cacheState: "hit" };
  }
  const pending = inflight.get(cacheKey);
  if (pending) return pending;
  const request = probeVenue(venueKey, assetSymbol).finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, request);
  return request;
}

export async function resolvePass461VenueHealthWithFallback(
  venueId: string,
  requestedAsset = "BTC",
): Promise<Pass461VenueHealthSnapshot | null> {
  try {
    return await resolvePass461VenueHealth(venueId, requestedAsset);
  } catch (error) {
    const normalized = venueId.toLowerCase();
    if (normalized !== "binance" && normalized !== "mexc" && normalized !== "coinbase") return null;
    const venueKey = normalized as Pass461VenueId;
    const assetSymbol = normalizePass463AssetSymbol(requestedAsset || "BTC");
    const cacheKey = `${venueKey}:${assetSymbol}`;
    const memory = memoryCache.get(cacheKey);
    const durable = memory?.value || (await readDurableSnapshot(venueKey, assetSymbol));
    if (durable && Date.now() - Date.parse(durable.observedAt) <= STALE_FALLBACK_MS) {
      return {
        ...durable,
        state: "stale",
        cacheState: "stale_fallback",
        confidenceCap: Math.min(durable.confidenceCap, 38),
        providerErrors: [
          ...durable.providerErrors,
          error instanceof Error ? error.message.slice(0, 120) : "venue_probe_error",
        ].slice(0, 6),
      };
    }
    throw error;
  }
}

export const pass461VenueHealthContract = {
  id: "PASS461_VENUE_HEALTH",
  liveVenues: ["Binance", "MEXC", "Coinbase Exchange"],
  pairCoverage: "PASS463 canonical venue + asset resolver; cache and durable snapshots are isolated per canonical asset.",
  probes: [
    "REST connectivity and server clock drift",
    "24h ticker and book-ticker freshness",
    "top-20 bid/ask depth and imbalance",
    "1m kline continuity",
    "WebSocket heartbeat, reconnect and venue-specific connection lifecycle policy",
  ],
  persistence:
    "Upstash REST snapshot + redacted provider ledger when configured; memory cache remains the explicit fallback.",
  boundary:
    "No venue-health score is a solvency certificate, reserve proof, withdrawal guarantee or trading recommendation.",
};
