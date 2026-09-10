import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { Pass2462HistoricalBackfillOrchestrator } from "./historical-backfill-orchestrator";
import type { Pass2456SurfaceId } from "./runtime-parity-queue";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";

export type Pass2463RangeWindowState = "ready" | "watch" | "blocked";
export type Pass2463EndpointWindowState = "ready_to_fetch" | "configured" | "blocked_missing_mapping" | "blocked_missing_timestamp" | "planned" | "not_applicable";
export type Pass2463RangeId = "30d" | "90d" | "1y" | "2y" | "5y" | "max";
export type Pass2463ProviderId = "coingecko" | "coingecko_ohlc" | "geckoterminal" | "binance" | "defillama" | "dexscreener" | "bitquery" | "pdf";

export type Pass2463NormalizedWindow = {
  range: Pass2463RangeId;
  fromUnix: number;
  toUnix: number;
  fromIso: string;
  toIso: string;
  lookbackDays: number;
  expectedGranularity: "hourly" | "daily" | "weekly" | "asset_genesis";
  minimumPoints: number;
  targetPoints: number;
  rangeWarning?: string;
};

export type Pass2463EndpointWindowContract = {
  provider: Pass2463ProviderId;
  label: string;
  endpointFamily: string;
  windowState: Pass2463EndpointWindowState;
  requiredParams: string[];
  normalizedParams: Record<string, string | number>;
  expectedFields: string[];
  missing: string[];
  cacheTtlSeconds: number;
  cursorPolicy: string;
  noMixBoundary: string;
};

export type Pass2463SurfaceWindowContract = {
  surface: Pass2456SurfaceId;
  state: Pass2463RangeWindowState;
  requiredWindowFields: string[];
  blockedBy: string[];
  renderRule: string;
};

export type Pass2463CacheContract = {
  namespace: "velmere:market-integrity:historical-range:v1";
  idempotencyKey: string;
  previewCacheKey: string;
  downloadCacheKey: string;
  parityState: "same_window_manifest" | "blocked_until_same_window_manifest";
  schemaFields: string[];
  hardRejectIf: string[];
};

export type Pass2463HistoricalRangeWindowLedger = {
  version: "historical-range-window-ledger-v1";
  state: Pass2463RangeWindowState;
  score: number;
  query?: string;
  symbol?: string;
  requestedRange: Pass2463RangeId;
  normalizedWindow: Pass2463NormalizedWindow;
  rangeWindowFingerprint: string;
  endpointWindows: Pass2463EndpointWindowContract[];
  surfaceWindowContracts: Pass2463SurfaceWindowContract[];
  cacheContract: Pass2463CacheContract;
  providerExecutionOrder: string[];
  hardLocks: string[];
  nextActions: string[];
  noSilentWindowRule: string;
  generatedAt: string;
};

const SURFACES: Pass2456SurfaceId[] = ["shield", "real_markets", "chart", "vlm_brain", "browser_preview", "pdf_preview", "pdf_download", "angel"];

function unique(items: Array<string | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function smallHash(input: unknown) {
  return `pass2463-${sha256Token(stableSerialize(input), 24)}`;
}

function normalizeRange(range?: string): Pass2463RangeId {
  const safe = (range || "2y").toLowerCase();
  if (["30d", "90d", "1y", "2y", "5y", "max"].includes(safe)) return safe as Pass2463RangeId;
  return "2y";
}

function windowProfile(range: Pass2463RangeId) {
  if (range === "30d") return { days: 30, minimumPoints: 30, targetPoints: 260, expectedGranularity: "hourly" as const, ttl: 900 };
  if (range === "90d") return { days: 90, minimumPoints: 90, targetPoints: 260, expectedGranularity: "hourly" as const, ttl: 1_800 };
  if (range === "1y") return { days: 365, minimumPoints: 220, targetPoints: 365, expectedGranularity: "daily" as const, ttl: 3_600 };
  if (range === "2y") return { days: 730, minimumPoints: 360, targetPoints: 520, expectedGranularity: "daily" as const, ttl: 21_600 };
  if (range === "5y") return { days: 1_825, minimumPoints: 520, targetPoints: 640, expectedGranularity: "weekly" as const, ttl: 86_400 };
  return { days: 3_650, minimumPoints: 720, targetPoints: 820, expectedGranularity: "asset_genesis" as const, ttl: 86_400 };
}

function normalizeWindow(range: Pass2463RangeId, nowMs: number): Pass2463NormalizedWindow {
  const profile = windowProfile(range);
  const toMs = Math.max(0, nowMs);
  const fromMs = Math.max(0, toMs - profile.days * 24 * 60 * 60 * 1000);
  return {
    range,
    fromUnix: Math.floor(fromMs / 1000),
    toUnix: Math.floor(toMs / 1000),
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(toMs).toISOString(),
    lookbackDays: profile.days,
    expectedGranularity: profile.expectedGranularity,
    minimumPoints: profile.minimumPoints,
    targetPoints: profile.targetPoints,
    rangeWarning: range === "max" ? "MAX range must use asset genesis when known; fallback uses ten-year window until genesis metadata is live." : undefined,
  };
}

function jobStatus(backfill: Pass2462HistoricalBackfillOrchestrator | undefined, jobId: string) {
  return backfill?.backfillJobs.find((job) => job.id === jobId)?.status;
}

function hasSourceLane(sourceSync: VelmereSourceSyncPacket | undefined, id: string) {
  return sourceSync?.lanes.some((lane) => lane.id === id && ["confirmed", "partial"].includes(lane.state)) ?? false;
}

function endpointState(args: {
  provider: Pass2463ProviderId;
  jobId?: string;
  historicalBackfill?: Pass2462HistoricalBackfillOrchestrator;
  sourceSync?: VelmereSourceSyncPacket;
  pointCount: number;
  minPoints: number;
}) : Pass2463EndpointWindowState {
  const job = args.jobId ? jobStatus(args.historicalBackfill, args.jobId) : undefined;
  if (job === "observed") return args.pointCount >= args.minPoints ? "ready_to_fetch" : "configured";
  if (job === "configured") return "configured";
  if (job === "needs_mapping") return "blocked_missing_mapping";
  if (job === "needs_backfill") return "configured";
  if (job === "planned") return "planned";
  if (job === "not_applicable") return "not_applicable";
  if (args.provider === "coingecko" && hasSourceLane(args.sourceSync, "coingecko")) return "configured";
  if (args.provider === "dexscreener" && hasSourceLane(args.sourceSync, "dexscreener")) return "configured";
  if (args.provider === "defillama" && args.sourceSync?.pass2446DefiLlama?.mode && args.sourceSync.pass2446DefiLlama.mode !== "unresolved") return "configured";
  return args.provider === "bitquery" ? "planned" : "blocked_missing_mapping";
}

function buildEndpointWindows(args: {
  sourceSync?: VelmereSourceSyncPacket;
  historicalBackfill?: Pass2462HistoricalBackfillOrchestrator;
  normalizedWindow: Pass2463NormalizedWindow;
  pointCount: number;
}): Pass2463EndpointWindowContract[] {
  const window = args.normalizedWindow;
  const profile = windowProfile(window.range);
  const densityMissing = args.pointCount < window.minimumPoints;
  return [
    {
      provider: "coingecko",
      label: "CoinGecko market chart range window",
      endpointFamily: "/coins/{id}/market_chart/range",
      windowState: endpointState({ provider: "coingecko", jobId: "coingecko_market_chart_range_backfill", historicalBackfill: args.historicalBackfill, sourceSync: args.sourceSync, pointCount: args.pointCount, minPoints: window.minimumPoints }),
      requiredParams: ["id", "vs_currency", "from", "to"],
      normalizedParams: { vs_currency: "usd", from: window.fromUnix, to: window.toUnix, targetPoints: window.targetPoints },
      expectedFields: ["prices[timestamp,value]", "market_caps[timestamp,value]", "total_volumes[timestamp,value]", "observedAt"],
      missing: unique([densityMissing && `point density below minimum ${window.minimumPoints}`, "field-level observedAt for each array", !hasSourceLane(args.sourceSync, "coingecko") && "coin id mapping"]),
      cacheTtlSeconds: profile.ttl,
      cursorPolicy: "Fetch exact UNIX window; resample only after raw points and gaps are preserved in receipt.",
      noMixBoundary: "CoinGecko range anchors market price, market cap and volume history only; it does not prove DEX liquidity, TVL safety or contract health.",
    },
    {
      provider: "coingecko_ohlc",
      label: "CoinGecko OHLC range window",
      endpointFamily: "/coins/{id}/ohlc/range or /coins/{id}/ohlc",
      windowState: endpointState({ provider: "coingecko_ohlc", jobId: "coingecko_ohlc_range_backfill", historicalBackfill: args.historicalBackfill, sourceSync: args.sourceSync, pointCount: args.pointCount, minPoints: window.minimumPoints }),
      requiredParams: ["id", "vs_currency", "from", "to"],
      normalizedParams: { vs_currency: "usd", from: window.fromUnix, to: window.toUnix, candleGranularity: window.expectedGranularity },
      expectedFields: ["timestamp", "open", "high", "low", "close", "observedAt"],
      missing: unique(["OHLC endpoint tier/key status", "candle granularity receipt", !hasSourceLane(args.sourceSync, "coingecko") && "coin id mapping"]),
      cacheTtlSeconds: profile.ttl,
      cursorPolicy: "If range OHLC is unavailable, downgrade to market_chart line proof and keep candle mode locked.",
      noMixBoundary: "OHLC confirms candles; it is not a holder graph, TVL proof or liquidity-depth proof.",
    },
    {
      provider: "geckoterminal",
      label: "GeckoTerminal pool OHLCV window",
      endpointFamily: "/networks/{network}/pools/{pool_address}/ohlcv/{timeframe}",
      windowState: endpointState({ provider: "geckoterminal", jobId: "geckoterminal_pool_ohlcv_overlay", historicalBackfill: args.historicalBackfill, sourceSync: args.sourceSync, pointCount: args.pointCount, minPoints: window.minimumPoints }),
      requiredParams: ["network", "pool_address", "timeframe", "aggregate", "before_timestamp"],
      normalizedParams: { timeframe: window.expectedGranularity === "weekly" || window.expectedGranularity === "asset_genesis" ? "day" : "hour", aggregate: window.expectedGranularity === "weekly" ? 7 : 1, before_timestamp: window.toUnix, targetFrom: window.fromUnix },
      expectedFields: ["ohlcv[timestamp,open,high,low,close,volume]", "poolAddress", "network", "observedAt"],
      missing: unique(["network + pool address mapping", "cursor replay until fromUnix", "pool observedAt", "DEX pair baseline"]),
      cacheTtlSeconds: 120,
      cursorPolicy: "Cursor backward from before_timestamp until fromUnix; stop if pool age is shorter and expose gap marker.",
      noMixBoundary: "GeckoTerminal is pool-level DEX OHLCV; it cannot replace centralized order-book depth or protocol TVL.",
    },
    {
      provider: "binance",
      label: "Binance klines/depth window",
      endpointFamily: "/api/v3/klines + /api/v3/depth",
      windowState: endpointState({ provider: "binance", jobId: "binance_klines_depth_backfill", historicalBackfill: args.historicalBackfill, sourceSync: args.sourceSync, pointCount: args.pointCount, minPoints: window.minimumPoints }),
      requiredParams: ["symbol", "interval", "startTime", "endTime", "limit"],
      normalizedParams: { interval: window.expectedGranularity === "hourly" ? "1h" : "1d", startTime: window.fromUnix * 1000, endTime: window.toUnix * 1000, limit: 1000 },
      expectedFields: ["openTime", "open", "high", "low", "close", "volume", "depthSnapshot", "observedAt"],
      missing: unique(["CEX symbol mapping", "chunked kline replay", "depth snapshot cache"]),
      cacheTtlSeconds: window.range === "30d" || window.range === "90d" ? 60 : 3_600,
      cursorPolicy: "Chunk klines by limit 1000 and attach depth snapshot only for current/live edge.",
      noMixBoundary: "Binance applies only to mapped CEX spot pairs; it cannot validate unlisted DEX liquidity.",
    },
    {
      provider: "defillama",
      label: "DefiLlama TVL/fundamentals window",
      endpointFamily: "/protocol/{protocol}, /v2/historicalChainTvl/{chain}, /overview/fees, /summary/fees/{protocol}",
      windowState: endpointState({ provider: "defillama", jobId: "defillama_tvl_protocol_backfill", historicalBackfill: args.historicalBackfill, sourceSync: args.sourceSync, pointCount: args.pointCount, minPoints: window.minimumPoints }),
      requiredParams: ["protocol_or_chain", "from", "to", "metric_family"],
      normalizedParams: { from: window.fromUnix, to: window.toUnix, metric_family: "tvl_fees_revenue_context" },
      expectedFields: ["tvl", "chainTvl", "fees", "revenue", "observedAt", "methodologyBoundary"],
      missing: unique([args.sourceSync?.pass2446DefiLlama?.mode === "unresolved" && "protocol/chain slug mapping", "metric family selection", "TVL observedAt"]),
      cacheTtlSeconds: 3_600,
      cursorPolicy: "Use exact metric window where available; annotate chart context only and never merge into price/liquidity proof.",
      noMixBoundary: "DefiLlama is TVL/protocol/chain/fundamentals context; it is not token contract security, price history or DEX depth.",
    },
    {
      provider: "dexscreener",
      label: "DEX Screener pair snapshot edge",
      endpointFamily: "/latest/dex/pairs/{chainId}/{pairId} or /tokens/v1/{chainId}/{tokenAddresses}",
      windowState: endpointState({ provider: "dexscreener", jobId: "dexscreener_pair_snapshot_anchor", historicalBackfill: args.historicalBackfill, sourceSync: args.sourceSync, pointCount: args.pointCount, minPoints: window.minimumPoints }),
      requiredParams: ["chainId", "pairId_or_tokenAddress", "snapshotObservedAt"],
      normalizedParams: { snapshotAtUnix: window.toUnix, purpose: "liquidity_fdv_volume_edge_anchor" },
      expectedFields: ["priceUsd", "liquidity.usd", "fdv", "volume", "txns", "observedAt"],
      missing: unique([!hasSourceLane(args.sourceSync, "dexscreener") && "chain + pair/token mapping", "snapshot observedAt", "edge-only history warning"]),
      cacheTtlSeconds: 60,
      cursorPolicy: "Use as live edge/snapshot next to the history window; do not backfill macro candles from pair snapshot alone.",
      noMixBoundary: "DEX Screener gives pair/snapshot liquidity and volume context; it cannot create 2Y/5Y macro price history by itself.",
    },
    {
      provider: "bitquery",
      label: "Bitquery holder/transfer window",
      endpointFamily: "planned GraphQL holder-transfer replay",
      windowState: "planned",
      requiredParams: ["chain", "tokenAddress", "from", "to", "entityResolutionPolicy"],
      normalizedParams: { from: window.fromUnix, to: window.toUnix, entityResolutionPolicy: "future_holder_flow_lane" },
      expectedFields: ["holderCount", "topHolderShare", "transferFlow", "entityCluster", "observedAt"],
      missing: ["API key", "adapter", "privacy/redaction policy", "chain token mapping"],
      cacheTtlSeconds: 3_600,
      cursorPolicy: "Planned Advanced lane; keep visible as roadmap task until live observedAt exists.",
      noMixBoundary: "Holder/transfer graph informs concentration and flow; it must not be substituted with price/TVL proxies.",
    },
  ];
}

function stateFromContracts(contracts: Pass2463EndpointWindowContract[], historicalState?: Pass2463RangeWindowState): Pass2463RangeWindowState {
  const critical = contracts.filter((contract) => contract.windowState === "blocked_missing_mapping" || contract.windowState === "blocked_missing_timestamp").length;
  const ready = contracts.filter((contract) => contract.windowState === "ready_to_fetch" || contract.windowState === "configured").length;
  if (critical >= 2 || historicalState === "blocked") return "blocked";
  if (critical > 0 || ready < 3 || historicalState === "watch") return "watch";
  return "ready";
}

function buildSurfaceContracts(args: {
  state: Pass2463RangeWindowState;
  range: Pass2463RangeId;
  endpointWindows: Pass2463EndpointWindowContract[];
  fingerprint: string;
}): Pass2463SurfaceWindowContract[] {
  const blockedBy = unique(args.endpointWindows.flatMap((window) => window.missing.map((item) => `${window.label}: ${item}`))).slice(0, 8);
  return SURFACES.map((surface) => ({
    surface,
    state: args.state === "ready" && !blockedBy.length ? "ready" : args.state === "blocked" ? "blocked" : "watch",
    requiredWindowFields: ["range", "fromUnix", "toUnix", "minimumPoints", "providerWindow", "observedAt", "rangeWindowFingerprint"],
    blockedBy: surface === "pdf_preview" || surface === "pdf_download" ? unique([...blockedBy, args.fingerprint === "missing" && "missing rangeWindowFingerprint", "preview/download must share same normalized from/to"]).slice(0, 8) : blockedBy,
    renderRule: `${surface} must show ${args.range} from/to window, provider window state, point density and ${args.fingerprint} before macro/Advanced wording.`,
  }));
}

export function buildPass2463HistoricalRangeWindowLedger(args: {
  query?: string;
  symbol?: string;
  requestedRange?: string;
  pointCount?: number;
  sourceSync?: VelmereSourceSyncPacket;
  historicalBackfill?: Pass2462HistoricalBackfillOrchestrator;
  payloadFingerprint?: string;
  now?: Date;
}): Pass2463HistoricalRangeWindowLedger {
  const requestedRange = normalizeRange(args.requestedRange ?? args.historicalBackfill?.requestedRange);
  const now = args.now ?? new Date();
  const normalizedWindow = normalizeWindow(requestedRange, now.getTime());
  const pointCount = Math.max(0, Math.floor(args.pointCount ?? args.historicalBackfill?.observedPointCount ?? 0));
  const endpointWindows = buildEndpointWindows({
    sourceSync: args.sourceSync,
    historicalBackfill: args.historicalBackfill,
    normalizedWindow,
    pointCount,
  });
  const rangeWindowFingerprint = smallHash({
    version: "historical-range-window-ledger-v1",
    query: args.query ?? args.sourceSync?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol,
    requestedRange,
    normalizedWindow,
    pointCount,
    backfillFingerprint: args.historicalBackfill?.backfillFingerprint,
    payloadFingerprint: args.payloadFingerprint,
  });
  const state = stateFromContracts(endpointWindows, args.historicalBackfill?.state);
  const hardLocks = unique([
    pointCount < normalizedWindow.minimumPoints && `${requestedRange} needs ${normalizedWindow.minimumPoints} points; observed ${pointCount}`,
    ...endpointWindows.filter((contract) => contract.windowState === "blocked_missing_mapping").map((contract) => `${contract.label}: mapping missing`),
    ...endpointWindows.filter((contract) => contract.windowState === "blocked_missing_timestamp").map((contract) => `${contract.label}: timestamp missing`),
    args.historicalBackfill?.pdfBackfillReceipt.parityState === "blocked_until_backfill_manifest" && "PDF preview/download backfill manifest parity blocked",
    requestedRange === "max" && "MAX needs asset genesis metadata before full green state",
  ]).slice(0, 12);
  const score = clamp(
    28 +
      endpointWindows.filter((contract) => contract.windowState === "ready_to_fetch").length * 10 +
      endpointWindows.filter((contract) => contract.windowState === "configured").length * 6 -
      hardLocks.length * 7 +
      (pointCount >= normalizedWindow.minimumPoints ? 12 : 0),
  );
  const cacheContract: Pass2463CacheContract = {
    namespace: "velmere:market-integrity:historical-range:v1",
    idempotencyKey: rangeWindowFingerprint,
    previewCacheKey: `${rangeWindowFingerprint}:preview`,
    downloadCacheKey: `${rangeWindowFingerprint}:download`,
    parityState: hardLocks.length ? "blocked_until_same_window_manifest" : "same_window_manifest",
    schemaFields: ["timestamp", "open", "high", "low", "close", "price", "volume", "marketCap", "provider", "observedAt", "gapMarker", "rangeWindowFingerprint"],
    hardRejectIf: unique([
      "PDF preview/download use different fromUnix/toUnix",
      "chart downsampling hides raw gap markers",
      "macro chart uses short 7d sparkline as 2Y/5Y/MAX proof",
      "DefiLlama TVL is merged into price or liquidity proof",
      ...hardLocks.slice(0, 6),
    ]),
  };
  const surfaceWindowContracts = buildSurfaceContracts({ state, range: requestedRange, endpointWindows, fingerprint: rangeWindowFingerprint });

  return {
    version: "historical-range-window-ledger-v1",
    state,
    score,
    query: args.query ?? args.sourceSync?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol,
    requestedRange,
    normalizedWindow,
    rangeWindowFingerprint,
    endpointWindows,
    surfaceWindowContracts,
    cacheContract,
    providerExecutionOrder: [
      "CoinGecko market_chart/range as primary line + market cap + volume window",
      "CoinGecko OHLC/range for candle mode when available",
      "GeckoTerminal pool OHLCV as DEX overlay when network/pool mapped",
      "Binance klines/depth as CEX overlay when symbol mapped",
      "DefiLlama TVL/fundamentals as context annotation only",
      "DEX Screener pair snapshot as live liquidity/FDV edge",
      "Bitquery holder/transfer graph as planned Advanced lane",
    ],
    hardLocks,
    nextActions: unique([
      "Persist raw historical arrays before resampling.",
      "Attach fromUnix/toUnix to PDF preview, PDF download, Browser and VLM Brain payloads.",
      "Add second overlay resolver for network+pool and CEX symbol mappings.",
      "Store observedAt per provider window and lower copy strength when stale.",
      requestedRange === "max" && "Add asset genesis resolver for MAX before full green.",
      pointCount < normalizedWindow.minimumPoints && "Backfill primary history until minimum point density passes.",
    ]),
    noSilentWindowRule: "A macro chart may be beautiful, but it is not institutional until range, from/to, raw point count, provider windows, gaps, cache parity and no-mix boundaries are visible.",
    generatedAt: now.toISOString(),
  };
}
