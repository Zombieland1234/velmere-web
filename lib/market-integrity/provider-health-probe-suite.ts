import { mapWithConcurrencyLimit } from "@/lib/runtime/bounded-concurrency";
import { readJsonResponseBounded, readTextResponseBounded } from "@/lib/network/fetch-with-deadline";
import { performance } from "node:perf_hooks";
import {
  evaluatePass4656ProviderObservation,
  type Pass4656ProviderObservation,
} from "./provider-failure-matrix";
import type { Pass4656ProviderHealthObservation } from "./provider-health-ledger";
import { recordPass4656ProviderHealthObservations } from "./provider-health-store";
import { providerFailureObservationFromRuntimeError } from "./provider-runtime-failure";

type EnvLike = Record<string, string | undefined>;
type FetchLike = typeof fetch;

type ProbeDefinition = {
  providerId: string;
  providerFamily: string;
  requestedIdentity: string;
  url: string;
  capabilities: string[];
  accept: "json" | "text";
  normalize: (payload: unknown) => { resolvedIdentity: string; payload: unknown; requiredFields?: string[] };
};

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cryptoProbeDefinitions(): ProbeDefinition[] {
  return [
    {
      providerId: "coingecko",
      providerFamily: "market_data",
      requestedIdentity: "BTC",
      url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true",
      capabilities: ["endpoint_health", "identity", "price"],
      accept: "json",
      normalize: (payload) => {
        const row = (payload as { bitcoin?: { usd?: unknown; last_updated_at?: unknown } })?.bitcoin;
        return { resolvedIdentity: "BTC", payload: { price: finiteNumber(row?.usd), lastUpdatedAt: finiteNumber(row?.last_updated_at) }, requiredFields: ["price"] };
      },
    },
    {
      providerId: "dexscreener",
      providerFamily: "dex_market",
      requestedIdentity: "BTC",
      url: "https://api.dexscreener.com/latest/dex/search?q=BTC",
      capabilities: ["endpoint_health", "pair_identity", "price", "liquidity"],
      accept: "json",
      normalize: (payload) => {
        const candidate = (payload as { pairs?: unknown })?.pairs;
        const pairs = Array.isArray(candidate)
          ? candidate as Array<{ baseToken?: { symbol?: unknown }; priceUsd?: unknown }>
          : [];
        const pair = pairs.find((row) => String(row.baseToken?.symbol ?? "").toUpperCase() === "BTC") ?? pairs[0];
        return { resolvedIdentity: String(pair?.baseToken?.symbol ?? "BTC"), payload: { pairCount: pairs.length, priceUsd: finiteNumber(pair?.priceUsd) }, requiredFields: ["pairCount"] };
      },
    },
    {
      providerId: "binance_spot",
      providerFamily: "cex_microstructure",
      requestedIdentity: "BTC",
      url: "https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=5",
      capabilities: ["endpoint_health", "orderbook", "spread", "depth"],
      accept: "json",
      normalize: (payload) => {
        const row = payload as { bids?: unknown[]; asks?: unknown[]; lastUpdateId?: unknown };
        return { resolvedIdentity: "BTC", payload: { bidCount: Array.isArray(row?.bids) ? row.bids.length : 0, askCount: Array.isArray(row?.asks) ? row.asks.length : 0, lastUpdateId: finiteNumber(row?.lastUpdateId) }, requiredFields: ["bidCount", "askCount"] };
      },
    },
    {
      providerId: "defillama",
      providerFamily: "protocol_fundamentals",
      requestedIdentity: "AAVE",
      url: "https://api.llama.fi/protocol/aave",
      capabilities: ["endpoint_health", "protocol_identity", "tvl"],
      accept: "json",
      normalize: (payload) => {
        const row = payload as { symbol?: unknown; name?: unknown; tvl?: unknown };
        return { resolvedIdentity: String(row?.symbol ?? "AAVE"), payload: { name: row?.name, tvl: finiteNumber(row?.tvl) }, requiredFields: ["tvl"] };
      },
    },
    {
      providerId: "binance_usdm",
      providerFamily: "derivatives_binance",
      requestedIdentity: "BTC",
      url: "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT",
      capabilities: ["endpoint_health", "funding", "mark_price", "index_price"],
      accept: "json",
      normalize: (payload) => {
        const row = payload as { symbol?: unknown; markPrice?: unknown; indexPrice?: unknown; lastFundingRate?: unknown };
        return { resolvedIdentity: String(row?.symbol ?? "BTC").replace(/USDT$/i, ""), payload: { markPrice: finiteNumber(row?.markPrice), indexPrice: finiteNumber(row?.indexPrice), fundingRate: finiteNumber(row?.lastFundingRate) }, requiredFields: ["markPrice", "indexPrice"] };
      },
    },
    {
      providerId: "bybit_linear",
      providerFamily: "derivatives_bybit",
      requestedIdentity: "BTC",
      url: "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT",
      capabilities: ["endpoint_health", "funding", "mark_price", "open_interest"],
      accept: "json",
      normalize: (payload) => {
        const row = (payload as { result?: { list?: Array<{ symbol?: unknown; markPrice?: unknown; openInterest?: unknown; fundingRate?: unknown }> } })?.result?.list?.[0];
        return { resolvedIdentity: String(row?.symbol ?? "BTC").replace(/USDT$/i, ""), payload: { markPrice: finiteNumber(row?.markPrice), openInterest: finiteNumber(row?.openInterest), fundingRate: finiteNumber(row?.fundingRate) }, requiredFields: ["markPrice"] };
      },
    },
  ];
}

function realMarketProbeDefinitions(): ProbeDefinition[] {
  return [
    {
      providerId: "yahoo_finance",
      providerFamily: "market_data",
      requestedIdentity: "AAPL",
      url: "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=5d",
      capabilities: ["endpoint_health", "identity", "quote", "history"],
      accept: "json",
      normalize: (payload) => {
        const meta = (payload as { chart?: { result?: Array<{ meta?: { symbol?: unknown; currency?: unknown; regularMarketPrice?: unknown } }> } })?.chart?.result?.[0]?.meta;
        return { resolvedIdentity: String(meta?.symbol ?? "AAPL"), payload: { currency: meta?.currency, regularMarketPrice: finiteNumber(meta?.regularMarketPrice) }, requiredFields: ["regularMarketPrice"] };
      },
    },
    {
      providerId: "stooq",
      providerFamily: "market_data_secondary",
      requestedIdentity: "AAPL",
      url: "https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv",
      capabilities: ["endpoint_health", "identity", "quote", "volume"],
      accept: "text",
      normalize: (payload) => {
        const text = String(payload ?? "");
        const rows = text.trim().split(/\r?\n/);
        return { resolvedIdentity: "AAPL", payload: { rowCount: rows.length, csv: text.slice(0, 300) }, requiredFields: ["rowCount"] };
      },
    },
  ];
}

async function runProbe(definition: ProbeDefinition, args: { fetchImpl: FetchLike; now: Date; timeoutMs: number }): Promise<Pass4656ProviderHealthObservation> {
  const started = performance.now();
  try {
    const response = await args.fetchImpl(definition.url, {
      headers: { accept: definition.accept === "json" ? "application/json" : "text/csv,text/plain;q=0.9,*/*;q=0.1", "user-agent": "Velmere-PASS4656-Provider-Health-Probe/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(args.timeoutMs),
    });
    const raw = definition.accept === "json"
      ? await readJsonResponseBounded<unknown>(response, 512 * 1024)
      : await readTextResponseBounded(response, 512 * 1024);
    const normalized = definition.normalize(raw);
    const observedAt = args.now.toISOString();
    const observation: Pass4656ProviderObservation = {
      providerId: definition.providerId,
      providerFamily: definition.providerFamily,
      requestedIdentity: definition.requestedIdentity,
      resolvedIdentity: normalized.resolvedIdentity,
      httpStatus: response.status,
      elapsedMs: Math.max(0, Math.round(performance.now() - started)),
      jsonParsed: definition.accept === "json" ? true : undefined,
      payload: normalized.payload,
      requiredFields: normalized.requiredFields ?? [],
      sourceTimestamp: observedAt,
      observedAt,
      maxAgeMs: 5 * 60_000,
      retryAfterSeconds: finiteNumber(response.headers.get("retry-after")),
      capabilities: definition.capabilities,
    };
    return {
      observedAt,
      elapsedMs: observation.elapsedMs,
      origin: "scheduled",
      verdict: evaluatePass4656ProviderObservation(observation, { nowMs: args.now.getTime() }),
    };
  } catch (error) {
    return providerFailureObservationFromRuntimeError({
      providerId: definition.providerId,
      providerFamily: definition.providerFamily,
      requestedIdentity: definition.requestedIdentity,
      error,
      elapsedMs: Math.max(0, Math.round(performance.now() - started)),
      capabilities: definition.capabilities,
      observedAt: args.now,
      origin: "scheduled",
    });
  }
}

export function pass4656ProviderHealthProbesEnabled(env: EnvLike = process.env) {
  const explicit = env.VELMERE_PROVIDER_HEALTH_PROBES_ENABLED?.trim();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

export async function runPass4656ProviderHealthProbeSuite(args: {
  now?: Date;
  env?: EnvLike;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  includeRealMarkets?: boolean;
  persist?: boolean;
} = {}) {
  const env = args.env ?? process.env;
  const now = args.now ?? new Date();
  if (!pass4656ProviderHealthProbesEnabled(env)) {
    return {
      schemaVersion: "pass4656_provider_health_probe_suite_v1" as const,
      enabled: false,
      generatedAt: now.toISOString(),
      observations: [] as Pass4656ProviderHealthObservation[],
      accepted: 0,
      failed: 0,
      persistence: null,
      blockers: ["provider_health_probes_disabled"],
    };
  }
  const definitions = [
    ...cryptoProbeDefinitions(),
    ...(args.includeRealMarkets === false ? [] : realMarketProbeDefinitions()),
  ];
  const observations = await mapWithConcurrencyLimit(definitions, 4, (definition) => runProbe(definition, {
    fetchImpl: args.fetchImpl ?? fetch,
    now,
    timeoutMs: Math.max(1_000, Math.min(15_000, args.timeoutMs ?? 5_000)),
  }));
  const persistence = args.persist === false
    ? null
    : await recordPass4656ProviderHealthObservations({ observations, now, ttlMs: 10 * 60_000, env });
  return {
    schemaVersion: "pass4656_provider_health_probe_suite_v1" as const,
    enabled: true,
    generatedAt: now.toISOString(),
    observations,
    accepted: observations.filter((row) => row.verdict.acceptedAsEvidence).length,
    failed: observations.filter((row) => !row.verdict.acceptedAsEvidence).length,
    persistence,
    blockers: observations.flatMap((row) => row.verdict.blockers.map((blocker) => `${row.verdict.providerId}:${blocker}`)),
  };
}
