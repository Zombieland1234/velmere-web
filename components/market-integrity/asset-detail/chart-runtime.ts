import type { VlmAssetDetailModalData } from "./contract";
import type { RemoteCandleSet, VlmAssetTimeframe } from "./chart-model";
import { fetchVerifiedAssetDetailCandles } from "./chart-provider";
import { buildPass4408AssetDetailChartCacheKey } from "../../../lib/market-integrity/asset-detail-client-helpers";

type ChartCacheEntry = {
  value: RemoteCandleSet;
  expiresAt: number;
};

type ChartInflightEntry = {
  controller: AbortController;
  promise: Promise<RemoteCandleSet>;
  consumers: number;
  settled: boolean;
};

const chartCache = new Map<string, ChartCacheEntry>();
const chartInflight = new Map<string, ChartInflightEntry>();

export const ASSET_DETAIL_CHART_CACHE_LIMIT = 96;
export const ASSET_DETAIL_CHART_LIVE_TTL_MS = 12_000;
export const ASSET_DETAIL_CHART_PARTIAL_TTL_MS = 30_000;
export const ASSET_DETAIL_CHART_LAST_KNOWN_TTL_MS = 60_000;
export const ASSET_DETAIL_CHART_REFERENCE_TTL_MS = 5 * 60_000;

let runtimeNow = () => Date.now();
let requestsStarted = 0;
let cacheHits = 0;
let inflightJoins = 0;

export function assetDetailChartRuntimeKey(
  data: Pick<VlmAssetDetailModalData, "symbol" | "providerSymbol" | "assetClass" | "venue" | "assetClassLabel" | "exchangeLabel" | "marketDataState">,
  timeframe: VlmAssetTimeframe,
) {
  return buildPass4408AssetDetailChartCacheKey(data, timeframe);
}

function cacheTtl(value: RemoteCandleSet) {
  if (value.freshness === "local_reference") return ASSET_DETAIL_CHART_REFERENCE_TTL_MS;
  if (value.freshness === "last_known_good") return ASSET_DETAIL_CHART_LAST_KNOWN_TTL_MS;
  if (value.freshness === "live_verified") return ASSET_DETAIL_CHART_LIVE_TTL_MS;
  return ASSET_DETAIL_CHART_PARTIAL_TTL_MS;
}

function pruneCache() {
  const now = runtimeNow();
  for (const [key, entry] of chartCache) {
    if (entry.expiresAt <= now) chartCache.delete(key);
  }
  while (chartCache.size > ASSET_DETAIL_CHART_CACHE_LIMIT) {
    const oldest = chartCache.keys().next().value as string | undefined;
    if (!oldest) break;
    chartCache.delete(oldest);
  }
}

export function readAssetDetailChartRuntimeCache(
  data: Pick<VlmAssetDetailModalData, "symbol" | "providerSymbol" | "assetClass" | "venue" | "assetClassLabel" | "exchangeLabel" | "marketDataState">,
  timeframe: VlmAssetTimeframe,
) {
  pruneCache();
  const key = assetDetailChartRuntimeKey(data, timeframe);
  const entry = chartCache.get(key);
  if (!entry || entry.expiresAt <= runtimeNow()) {
    chartCache.delete(key);
    return null;
  }
  chartCache.delete(key);
  chartCache.set(key, entry);
  cacheHits += 1;
  return entry.value;
}

function releaseConsumer(key: string, entry: ChartInflightEntry) {
  entry.consumers = Math.max(0, entry.consumers - 1);
  if (entry.consumers === 0 && !entry.settled) {
    entry.controller.abort();
    // Remove an aborted orphan immediately. A rapid close/reopen must start a
    // fresh request instead of joining the short window before the aborted
    // promise settles.
    if (chartInflight.get(key) === entry) chartInflight.delete(key);
    return;
  }
  if (entry.settled && entry.consumers === 0 && chartInflight.get(key) === entry) chartInflight.delete(key);
}

function subscribe(key: string, entry: ChartInflightEntry, signal?: AbortSignal) {
  entry.consumers += 1;
  if (!signal) {
    return entry.promise.finally(() => releaseConsumer(key, entry));
  }
  if (signal.aborted) {
    releaseConsumer(key, entry);
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise<RemoteCandleSet>((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return false;
      finished = true;
      signal.removeEventListener("abort", onAbort);
      releaseConsumer(key, entry);
      return true;
    };
    const onAbort = () => {
      if (!finish()) return;
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    entry.promise.then(
      (value) => { if (finish()) resolve(value); },
      (error) => { if (finish()) reject(error); },
    );
  });
}

export function invalidateAssetDetailChartRuntime(
  data: Pick<VlmAssetDetailModalData, "symbol" | "providerSymbol" | "assetClass" | "venue" | "assetClassLabel" | "exchangeLabel" | "marketDataState">,
  timeframe: VlmAssetTimeframe,
) {
  chartCache.delete(assetDetailChartRuntimeKey(data, timeframe));
}

export function shouldAutoRefreshAssetDetailChart(value: RemoteCandleSet | null | undefined) {
  return value?.freshness === "live_verified" || value?.freshness === "partial_not_live";
}

export async function fetchAssetDetailChartRuntime(args: {
  data: VlmAssetDetailModalData;
  timeframe: VlmAssetTimeframe;
  signal?: AbortSignal;
  force?: boolean;
}) {
  const key = assetDetailChartRuntimeKey(args.data, args.timeframe);
  if (!args.force) {
    const cached = readAssetDetailChartRuntimeCache(args.data, args.timeframe);
    if (cached) return cached;
  } else {
    chartCache.delete(key);
  }

  const existing = chartInflight.get(key);
  if (existing && !existing.settled && !existing.controller.signal.aborted) {
    inflightJoins += 1;
    return subscribe(key, existing, args.signal);
  }
  if (existing && chartInflight.get(key) === existing) chartInflight.delete(key);

  const controller = new AbortController();
  requestsStarted += 1;
  const entry: ChartInflightEntry = {
    controller,
    consumers: 0,
    settled: false,
    promise: Promise.resolve(null as never),
  };
  entry.promise = fetchVerifiedAssetDetailCandles({
    data: args.data,
    timeframe: args.timeframe,
    signal: controller.signal,
  }).then((value) => {
    if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
    chartCache.set(key, { value, expiresAt: runtimeNow() + cacheTtl(value) });
    pruneCache();
    return value;
  }).finally(() => {
    entry.settled = true;
    if (entry.consumers === 0 && chartInflight.get(key) === entry) chartInflight.delete(key);
  });
  chartInflight.set(key, entry);
  return subscribe(key, entry, args.signal);
}

export function assetDetailChartRuntimeDiagnostics() {
  pruneCache();
  return {
    cacheEntries: chartCache.size,
    inflightEntries: chartInflight.size,
    requestsStarted,
    cacheHits,
    inflightJoins,
  };
}

export function configureAssetDetailChartRuntimeForTests(now: () => number) {
  runtimeNow = now;
}

export function resetAssetDetailChartRuntimeForTests() {
  for (const entry of chartInflight.values()) entry.controller.abort();
  chartCache.clear();
  chartInflight.clear();
  runtimeNow = () => Date.now();
  requestsStarted = 0;
  cacheHits = 0;
  inflightJoins = 0;
}
