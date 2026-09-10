import type { Pass2444ChartQuality } from "./chart-quality";
import type { Pass2448ChartMethodologyContract, Pass2448ProviderMethodologyRegistry } from "./provider-methodology-registry";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";

export type Pass2449OverlayState = "ready" | "watch" | "blocked" | "planned";
export type Pass2449ChartRangeClass = "intraday" | "short_window" | "medium_window" | "macro_window" | "all_time";
export type Pass2449ChartProvider =
  | "coingecko_market_chart"
  | "coingecko_ohlc"
  | "binance_klines"
  | "geckoterminal_pool_ohlcv"
  | "dexscreener_pair_snapshot"
  | "defillama_protocol_tvl"
  | "manual_csv_backfill";

export type Pass2449ProviderOverlayLane = {
  provider: Pass2449ChartProvider;
  label: string;
  state: Pass2449OverlayState;
  bestFor: string[];
  requiredInputs: string[];
  confirmedInputs: string[];
  missingInputs: string[];
  confidenceContribution: number;
  cadence: string;
  boundary: string;
};

export type Pass2449ChartWindowContract = {
  range: string;
  rangeClass: Pass2449ChartRangeClass;
  minimumPointsForUi: number;
  minimumPointsForAdvanced: number;
  actualPoints: number;
  pointScore: number;
  expectedFields: string[];
  missingFields: string[];
  resamplePolicy: string;
};

export type Pass2449ChartOverlayReconciler = {
  version: "chart-overlay-reconciler-v1";
  state: Pass2449OverlayState;
  score: number;
  assetId?: string;
  symbol?: string;
  range: string;
  windowContract: Pass2449ChartWindowContract;
  providerOverlays: Pass2449ProviderOverlayLane[];
  canonicalChartRules: string[];
  missingForWorldClass: string[];
  tierLocks: Array<{
    tier: "basic" | "pro" | "advanced";
    state: Pass2449OverlayState;
    required: string[];
    blockedBy: string[];
  }>;
  pdfParityRules: string[];
  uiBadges: string[];
  nextAdapterWork: string[];
  generatedAt: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(items: Array<string | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function classifyRange(range: string): Pass2449ChartRangeClass {
  if (["1m", "15m", "1h", "4h"].includes(range)) return "intraday";
  if (["1d", "7d", "30d"].includes(range)) return "short_window";
  if (["90d", "1y"].includes(range)) return "medium_window";
  if (["2y", "5y"].includes(range)) return "macro_window";
  return "all_time";
}

function minimumUiPoints(rangeClass: Pass2449ChartRangeClass) {
  if (rangeClass === "intraday") return 60;
  if (rangeClass === "short_window") return 40;
  if (rangeClass === "medium_window") return 90;
  if (rangeClass === "macro_window") return 180;
  return 240;
}

function minimumAdvancedPoints(rangeClass: Pass2449ChartRangeClass) {
  if (rangeClass === "intraday") return 120;
  if (rangeClass === "short_window") return 90;
  if (rangeClass === "medium_window") return 180;
  if (rangeClass === "macro_window") return 365;
  return 520;
}

function buildWindowContract(args: {
  range: string;
  pointCount: number;
  chartQuality?: Pass2444ChartQuality;
}): Pass2449ChartWindowContract {
  const rangeClass = classifyRange(args.range);
  const minimumPointsForUi = minimumUiPoints(rangeClass);
  const minimumPointsForAdvanced = minimumAdvancedPoints(rangeClass);
  const pointScore = clamp((args.pointCount / Math.max(minimumAdvancedPoints(rangeClass), 1)) * 100);
  const missingFields = unique([
    args.pointCount < minimumPointsForUi && "enough chart points for clean UI",
    args.pointCount < minimumPointsForAdvanced && "enough points for Advanced long-range conclusion",
    args.chartQuality?.missingForAdvanced?.includes("second provider overlay") && "second provider overlay",
    args.chartQuality?.missingForAdvanced?.includes("source observedAt badges") && "source observedAt badges",
    args.chartQuality?.missingForAdvanced?.includes("market-cap timeline") && "market-cap timeline",
    args.chartQuality?.missingForAdvanced?.includes("volume timeline") && "volume timeline",
  ]);
  return {
    range: args.range,
    rangeClass,
    minimumPointsForUi,
    minimumPointsForAdvanced,
    actualPoints: args.pointCount,
    pointScore,
    expectedFields: ["price points", "volume timeline", "market-cap timeline", "source observedAt", "gap annotation", "payload hash"],
    missingFields,
    resamplePolicy:
      rangeClass === "macro_window" || rangeClass === "all_time"
        ? "Use daily/4-day candles for macro views; never stretch a 7d sparkline into a 2Y narrative."
        : "Use native provider granularity where possible; show the provider granularity when it is auto-selected.",
  };
}

function providerLane(args: Pass2449ProviderOverlayLane): Pass2449ProviderOverlayLane {
  return {
    ...args,
    confirmedInputs: unique(args.confirmedInputs),
    missingInputs: unique(args.missingInputs),
    confidenceContribution: clamp(args.confidenceContribution),
  };
}

function hasSourceLane(sourceSync: VelmereSourceSyncPacket | undefined, id: string) {
  return Boolean(sourceSync?.lanes.some((lane) => lane.id === id && ["confirmed", "partial"].includes(lane.state)));
}

function buildProviderOverlays(args: {
  assetId?: string;
  symbol?: string;
  range: string;
  pointCount: number;
  network?: string;
  poolAddress?: string;
  sourceSync?: VelmereSourceSyncPacket;
  methodology?: Pass2448ProviderMethodologyRegistry;
}): Pass2449ProviderOverlayLane[] {
  const symbol = args.symbol?.toUpperCase();
  const isLikelyCexSymbol = Boolean(symbol && ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOT", "LINK", "AVAX", "DOGE"].includes(symbol));
  const hasMethodology = Boolean(args.methodology?.fieldContracts.length);
  const geckoPoolReady = Boolean(args.network && args.poolAddress);
  return [
    providerLane({
      provider: "coingecko_market_chart",
      label: "CoinGecko market_chart primary",
      state: args.pointCount > 0 ? "ready" : "blocked",
      bestFor: ["listed-coin historical price", "market cap timeline", "volume timeline", "2Y/5Y/MAX context"],
      requiredInputs: ["coin id", "range", "points", "timestamped payload"],
      confirmedInputs: unique([args.assetId && "coin id", args.range && "range", args.pointCount > 0 && "points"]),
      missingInputs: unique([!args.assetId && "coin id", !args.pointCount && "historical points", "field-level observedAt per series"]),
      confidenceContribution: args.pointCount > 0 ? 78 : 12,
      cadence: "Market chart cache depends on provider/range; macro windows can be cached longer than intraday.",
      boundary: "Primary chart source for listed assets; not enough alone for DEX pool slippage or holder-flow conclusions.",
    }),
    providerLane({
      provider: "coingecko_ohlc",
      label: "CoinGecko OHLC confirmation",
      state: args.assetId ? "watch" : "blocked",
      bestFor: ["candlestick confirmation", "auto granularity disclosure", "macro candle body"],
      requiredInputs: ["coin id", "range days", "OHLC endpoint response"],
      confirmedInputs: unique([args.assetId && "coin id"]),
      missingInputs: unique([!args.assetId && "coin id", "OHLC payload not attached yet", "granularity badge"]),
      confidenceContribution: args.assetId ? 42 : 8,
      cadence: "Use as confirmation lane; disclose provider auto granularity for OHLC candles.",
      boundary: "OHLC confirms candle shape; it does not replace market cap, volume, depth or contract evidence.",
    }),
    providerLane({
      provider: "binance_klines",
      label: "Binance CEX klines/depth overlay",
      state: isLikelyCexSymbol ? "watch" : "planned",
      bestFor: ["venue-specific OHLCV", "order-book depth", "spread/venue liquidity", "CEX sanity check"],
      requiredInputs: ["symbol mapping", "quote asset", "interval", "klines", "depth snapshot"],
      confirmedInputs: unique([isLikelyCexSymbol && "probable CEX symbol"]),
      missingInputs: isLikelyCexSymbol
        ? ["live Binance kline overlay", "depth snapshot", "second venue comparison"]
        : ["CEX pair mapping"],
      confidenceContribution: isLikelyCexSymbol ? 48 : 18,
      cadence: "Klines/depth are venue-specific; cache long-range klines, refresh depth much faster.",
      boundary: "Binance lane is not global truth and must be labeled as one venue.",
    }),
    providerLane({
      provider: "geckoterminal_pool_ohlcv",
      label: "GeckoTerminal DEX pool OHLCV overlay",
      state: geckoPoolReady ? "watch" : "planned",
      bestFor: ["DEX pool OHLCV", "small-cap pool history", "pool-specific price/volume overlay", "second DEX chart source"],
      requiredInputs: ["network", "pool address", "timeframe", "aggregate", "limit"],
      confirmedInputs: unique([args.network && "network", args.poolAddress && "pool address"]),
      missingInputs: unique([!args.network && "network", !args.poolAddress && "pool address", "pool OHLCV payload"]),
      confidenceContribution: geckoPoolReady ? 46 : 22,
      cadence: "Pool OHLCV can use minute/hour/day candles; show pool address because pools can diverge.",
      boundary: "Pool-specific data can diverge from aggregators. It cannot prove global market price or safety by itself.",
    }),
    providerLane({
      provider: "dexscreener_pair_snapshot",
      label: "DEX Screener pair snapshot overlay",
      state: hasSourceLane(args.sourceSync, "dexscreener") ? "watch" : "planned",
      bestFor: ["pair liquidity snapshot", "FDV", "DEX 24h volume", "pair discovery"],
      requiredInputs: ["chain", "token or pair address", "liquidity", "volume windows"],
      confirmedInputs: hasSourceLane(args.sourceSync, "dexscreener") ? ["pair/search market lane"] : [],
      missingInputs: hasSourceLane(args.sourceSync, "dexscreener") ? ["historical candles", "pool event history"] : ["DEX pair scope"],
      confidenceContribution: hasSourceLane(args.sourceSync, "dexscreener") ? 44 : 18,
      cadence: "Pair snapshots are fast context; do not use them as a full historical chart replacement.",
      boundary: "Visible liquidity is not guaranteed exit depth under stress.",
    }),
    providerLane({
      provider: "defillama_protocol_tvl",
      label: "DefiLlama protocol TVL overlay",
      state: hasSourceLane(args.sourceSync, "defillama") ? "watch" : "planned",
      bestFor: ["protocol TVL context", "chain TVL trend", "fees/revenue/yields/stablecoin context"],
      requiredInputs: ["matched protocol slug", "TVL timestamp", "methodology note"],
      confirmedInputs: hasSourceLane(args.sourceSync, "defillama") ? ["protocol lane attached"] : [],
      missingInputs: hasSourceLane(args.sourceSync, "defillama") ? ["pool-level exit depth", "security proof"] : ["matched protocol slug"],
      confidenceContribution: hasSourceLane(args.sourceSync, "defillama") ? 52 : 20,
      cadence: "TVL/fundamentals can be cached by protocol; show methodology and missing pool-depth proof.",
      boundary: "TVL is a fundamentals/context line. It is not a security certificate and not liquidity exit proof.",
    }),
    providerLane({
      provider: "manual_csv_backfill",
      label: "Operator CSV/backfill fallback",
      state: hasMethodology ? "planned" : "blocked",
      bestFor: ["manual remediation", "provider outage continuity", "institutional backfill after failed public provider"],
      requiredInputs: ["source URL", "import timestamp", "schema", "operator note", "checksum"],
      confirmedInputs: [],
      missingInputs: ["uploaded CSV/source snapshot", "operator checksum", "field mapping"],
      confidenceContribution: 12,
      cadence: "Manual only; requires operator audit trail and visible source label.",
      boundary: "Manual backfill must never be silently mixed with live data. Label it as manual/operator evidence.",
    }),
  ];
}

function calculateState(score: number, blockers: string[]): Pass2449OverlayState {
  if (blockers.length > 4) return "blocked";
  if (score >= 78 && blockers.length <= 1) return "ready";
  return "watch";
}

export function buildPass2449ChartOverlayReconciler(args: {
  assetId?: string;
  symbol?: string;
  range: string;
  pointCount: number;
  chartQuality?: Pass2444ChartQuality;
  chartMethodology?: Pass2448ChartMethodologyContract;
  sourceSync?: VelmereSourceSyncPacket;
  methodology?: Pass2448ProviderMethodologyRegistry;
  network?: string;
  poolAddress?: string;
}): Pass2449ChartOverlayReconciler {
  const windowContract = buildWindowContract({ range: args.range, pointCount: args.pointCount, chartQuality: args.chartQuality });
  const providerOverlays = buildProviderOverlays(args);
  const activeOverlayCount = providerOverlays.filter((lane) => lane.state === "ready" || lane.state === "watch").length;
  const requiredMissing = unique([
    ...windowContract.missingFields,
    ...providerOverlays.flatMap((lane) => lane.state === "blocked" || lane.state === "planned" ? lane.missingInputs.map((item) => `${lane.label}: ${item}`) : []),
    !args.chartMethodology && "PASS2448 chart methodology contract",
    "PDF preview/download canonical chart hash mount",
    "UI overlay badges mounted in Shield/Brain/Browser",
  ]).slice(0, 18);
  const overlayScore = clamp(
    windowContract.pointScore * 0.36 +
      activeOverlayCount * 8 +
      (args.chartQuality?.continuityScore ?? 0) * 0.22 +
      (args.chartMethodology?.score ?? 0) * 0.22,
  );
  const state = calculateState(overlayScore, requiredMissing);
  return {
    version: "chart-overlay-reconciler-v1",
    state,
    score: overlayScore,
    assetId: args.assetId,
    symbol: args.symbol,
    range: args.range,
    windowContract,
    providerOverlays,
    canonicalChartRules: [
      "Every Shield, Brain, Browser and PDF surface must consume the same canonical chart endpoint or display a drift warning.",
      "2Y/5Y/MAX views must show range, provider, point count, gap score and generatedAt before narrative text.",
      "CoinGecko market_chart is the listed-asset primary; GeckoTerminal is pool-specific; Binance is venue-specific; DefiLlama TVL is fundamentals context.",
      "Never stretch a short 7d sparkline into a macro conclusion and never convert TVL into safety or liquidity proof.",
    ],
    missingForWorldClass: requiredMissing,
    tierLocks: [
      {
        tier: "basic",
        state: args.pointCount > 0 ? "ready" : "blocked",
        required: ["price path", "range", "source label", "missing-data badge"],
        blockedBy: args.pointCount > 0 ? [] : ["primary chart points"],
      },
      {
        tier: "pro",
        state: windowContract.pointScore >= 45 ? "watch" : "blocked",
        required: ["volume timeline", "market-cap timeline", "gap annotation", "provider methodology"],
        blockedBy: unique([windowContract.pointScore < 45 && "chart point density", ...windowContract.missingFields]).slice(0, 6),
      },
      {
        tier: "advanced",
        state: requiredMissing.length <= 2 && overlayScore >= 78 ? "ready" : "blocked",
        required: ["2Y/5Y continuity", "second provider overlay", "payload hash parity", "observedAt badges", "methodology contract", "UI proof rail"],
        blockedBy: requiredMissing.slice(0, 8),
      },
    ],
    pdfParityRules: [
      "PDF preview and PDF download must include the same chart hash and PASS2449 overlay state.",
      "If PDF has a different point count than Shield/Brain, show chart_payload_drift instead of generating a confident report.",
      "Advanced PDF macro section unlocks only when second overlay and gap annotations are visible.",
    ],
    uiBadges: [
      `Chart: ${args.range} / ${args.pointCount} pts`,
      `Overlay: ${activeOverlayCount}/${providerOverlays.length} lanes active`,
      `State: ${state}`,
      `Score: ${overlayScore}/100`,
    ],
    nextAdapterWork: [
      "Mount PASS2449 overlay strip in Shield modal and VLM Brain right rail.",
      "Attach GeckoTerminal pool OHLCV when a token has chain + pool address.",
      "Attach Binance klines/depth for BTC/ETH/SOL large-cap CEX symbols.",
      "Attach PDF chart parity hash and drift warning.",
      "Add operator CSV/backfill path with checksum for provider outages.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
