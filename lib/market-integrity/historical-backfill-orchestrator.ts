import { sha256Token } from "../security/cryptographic-digest";
import type { Pass2449ChartOverlayReconciler } from "./chart-overlay-reconciler";
import type { Pass2461MacroGapReceipt } from "./macro-gap-receipt";
import type { Pass2456SurfaceId } from "./runtime-parity-queue";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";
import type { Pass2460MacroChartIntegrityGate } from "./macro-chart-integrity-gate";

type Pass2462SourceSyncPacket = Omit<VelmereSourceSyncPacket, "pass2449"> & {
  pass2449?: Pass2449ChartOverlayReconciler;
  pass2460?: Pass2460MacroChartIntegrityGate;
  pass2461?: Pass2461MacroGapReceipt;
};

export type Pass2462BackfillState = "ready" | "watch" | "blocked";
export type Pass2462BackfillStatus =
  | "observed"
  | "configured"
  | "needs_backfill"
  | "needs_mapping"
  | "planned"
  | "blocked"
  | "not_applicable";
export type Pass2462ProviderId =
  | "coingecko"
  | "coingecko_ohlc"
  | "geckoterminal"
  | "binance"
  | "defillama"
  | "dexscreener"
  | "bitquery"
  | "pdf";

export type Pass2462BackfillJob = {
  id: string;
  provider: Pass2462ProviderId;
  label: string;
  endpointFamily: string;
  status: Pass2462BackfillStatus;
  requiredFor: string[];
  unlocks: string[];
  missing: string[];
  maxAgeSeconds: number;
  surfaceImpact: Array<
    Pass2456SurfaceId | "operator_console" | "chart_backfill_cache"
  >;
  noMixBoundary: string;
};

export type Pass2462RangeBackfillPlan = {
  range: string;
  minimumPoints: number;
  observedPoints: number;
  primaryHistoryProvider: string;
  requiredSecondaryOverlay: string[];
  volumeMarketCapRequirement: string;
  gapHandling: string;
  state: Pass2462BackfillState;
};

export type Pass2462SurfaceBackfillContract = {
  surface: Pass2456SurfaceId;
  state: Pass2462BackfillState;
  requiredJobs: string[];
  blockedBy: string[];
  renderRule: string;
};

export type Pass2462PdfBackfillReceipt = {
  state: Pass2462BackfillState;
  previewFingerprint: string;
  downloadFingerprint: string;
  parityState: "same_backfill_manifest" | "blocked_until_backfill_manifest";
  hardRejectReasons: string[];
  requiredVisibleFields: string[];
};

export type Pass2462HistoricalBackfillOrchestrator = {
  version: "historical-backfill-orchestrator-v1";
  state: Pass2462BackfillState;
  score: number;
  query?: string;
  symbol?: string;
  requestedRange: string;
  observedPointCount: number;
  requiredMinPoints: number;
  backfillFingerprint: string;
  rangePlan: Pass2462RangeBackfillPlan;
  backfillJobs: Pass2462BackfillJob[];
  surfaceBackfillContracts: Pass2462SurfaceBackfillContract[];
  pdfBackfillReceipt: Pass2462PdfBackfillReceipt;
  providerBackfillOrder: string[];
  hardLocks: string[];
  nextProviderActions: string[];
  hundredPercentUnlocks: string[];
  noSilentGreenRule: string;
  generatedAt: string;
};

const SURFACES: Pass2456SurfaceId[] = [
  "shield",
  "real_markets",
  "chart",
  "vlm_brain",
  "browser_preview",
  "pdf_preview",
  "pdf_download",
  "angel",
];

function unique(items: Array<string | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function smallHash(input: unknown) {
  return `pass2462-${sha256Token(stableSerialize(input), 16)}`;
}

function normalizeRange(range?: string) {
  const safe = (range || "2y").toLowerCase();
  return ["30d", "90d", "1y", "2y", "5y", "max"].includes(safe) ? safe : "2y";
}

function requiredMinPoints(range: string) {
  if (range === "max") return 720;
  if (range === "5y") return 520;
  if (range === "2y") return 360;
  if (range === "1y") return 220;
  if (range === "90d") return 90;
  return 30;
}

function stateFromLocks(
  critical: number,
  watch: number,
): Pass2462BackfillState {
  if (critical > 0) return "blocked";
  if (watch > 0) return "watch";
  return "ready";
}

function hasLane(sourceSync: VelmereSourceSyncPacket | undefined, id: string) {
  return (
    sourceSync?.lanes.some(
      (lane) =>
        lane.id === id &&
        (lane.state === "confirmed" || lane.state === "partial"),
    ) ?? false
  );
}

function buildJobs(args: {
  sourceSync?: Pass2462SourceSyncPacket;
  chartOverlay?: Pass2449ChartOverlayReconciler;
  macroGapReceipt?: Pass2461MacroGapReceipt;
  range: string;
  pointCount: number;
  minPoints: number;
}): Pass2462BackfillJob[] {
  const hasCoingecko = hasLane(args.sourceSync, "coingecko");
  const hasDex = hasLane(args.sourceSync, "dexscreener");
  const hasBinance = hasLane(args.sourceSync, "binance");
  const defiMode = args.sourceSync?.pass2446DefiLlama?.mode ?? "unresolved";
  const overlayState =
    args.chartOverlay?.state ?? args.sourceSync?.pass2449?.state;
  const densityMissing = args.pointCount < args.minPoints;
  const macroBlocked =
    args.macroGapReceipt?.state === "blocked" ||
    args.sourceSync?.pass2461?.state === "blocked";

  const jobs: Pass2462BackfillJob[] = [
    {
      id: "coingecko_market_chart_range_backfill",
      provider: "coingecko",
      label: "CoinGecko market_chart/range backfill",
      endpointFamily:
        "/coins/{id}/market_chart/range + /coins/{id}/market_chart",
      status: hasCoingecko
        ? densityMissing
          ? "needs_backfill"
          : "observed"
        : "needs_mapping",
      requiredFor: [
        "2Y/5Y/MAX price history",
        "market-cap timeline",
        "volume timeline",
        "PDF chart parity",
      ],
      unlocks: [
        "primary macro price line",
        "historical volume/market-cap context",
        "macroChartFingerprint stability",
      ],
      missing: unique([
        !hasCoingecko && "coin id mapping",
        densityMissing &&
          `${args.range} requires ${args.minPoints} points; observed ${args.pointCount}`,
        "field-level observedAt for price/market cap/volume arrays",
      ]),
      maxAgeSeconds:
        args.range === "30d" || args.range === "90d" ? 900 : 86_400,
      surfaceImpact: [
        "chart",
        "vlm_brain",
        "browser_preview",
        "pdf_preview",
        "pdf_download",
        "angel",
      ],
      noMixBoundary:
        "CoinGecko history can anchor market price, market cap and volume; it cannot prove DEX liquidity, TVL safety or future returns.",
    },
    {
      id: "coingecko_ohlc_range_backfill",
      provider: "coingecko_ohlc",
      label: "CoinGecko OHLC range backfill",
      endpointFamily: "/coins/{id}/ohlc/range or /coins/{id}/ohlc",
      status: hasCoingecko ? "configured" : "needs_mapping",
      requiredFor: [
        "candlestick mode",
        "wicks/regime volatility",
        "gap replay",
        "Advanced chart proof",
      ],
      unlocks: [
        "candlestick renderer",
        "volatility component",
        "gap detection by candle",
      ],
      missing: unique([
        !hasCoingecko && "coin id mapping",
        "OHLC observedAt receipt",
        "range-specific candle granularity policy",
      ]),
      maxAgeSeconds: args.range === "30d" ? 900 : 86_400,
      surfaceImpact: [
        "chart",
        "vlm_brain",
        "pdf_preview",
        "pdf_download",
        "operator_console",
      ],
      noMixBoundary:
        "OHLC confirms historical candles only; it must not be blended with TVL or holder data as if it were one source.",
    },
    {
      id: "geckoterminal_pool_ohlcv_overlay",
      provider: "geckoterminal",
      label: "GeckoTerminal pool OHLCV overlay",
      endpointFamily:
        "/networks/{network}/pools/{pool_address}/ohlcv/{timeframe}",
      status:
        overlayState === "ready"
          ? "observed"
          : hasDex
            ? "needs_mapping"
            : "planned",
      requiredFor: [
        "DEX pool macro overlay",
        "pool-specific volume",
        "second source overlay",
        "liquidity-aware chart",
      ],
      unlocks: [
        "DEX overlay line",
        "pool OHLCV contrast",
        "price/liquidity divergence badge",
      ],
      missing: unique([
        overlayState !== "ready" && "network + pool address mapping",
        overlayState !== "ready" && "pool OHLCV observedAt",
        !hasDex && "DEX pair baseline from DEX Screener or pool resolver",
      ]),
      maxAgeSeconds: 120,
      surfaceImpact: [
        "chart",
        "real_markets",
        "vlm_brain",
        "browser_preview",
        "pdf_preview",
        "pdf_download",
        "angel",
      ],
      noMixBoundary:
        "GeckoTerminal is a pool-level DEX overlay; it cannot replace CEX order-book depth or protocol TVL.",
    },
    {
      id: "binance_klines_depth_backfill",
      provider: "binance",
      label: "Binance klines/depth backfill",
      endpointFamily: "/api/v3/klines + /api/v3/depth for listed spot pairs",
      status: hasBinance ? "configured" : "not_applicable",
      requiredFor: [
        "CEX second venue overlay",
        "order-book depth replay",
        "cross-venue disagreement",
      ],
      unlocks: [
        "CEX candle overlay",
        "depth/slippage lane",
        "venue disagreement matrix",
      ],
      missing: hasBinance
        ? [
            "pair mapping",
            "depth snapshot cache",
            "observedAt for klines and depth",
          ]
        : ["not applicable until active CEX pair mapping exists"],
      maxAgeSeconds: 60,
      surfaceImpact: [
        "chart",
        "vlm_brain",
        "pdf_preview",
        "pdf_download",
        "angel",
        "operator_console",
      ],
      noMixBoundary:
        "Binance klines/depth apply only to mapped CEX spot pairs and cannot prove DEX pool liquidity for unlisted tokens.",
    },
    {
      id: "defillama_tvl_protocol_backfill",
      provider: "defillama",
      label: "DefiLlama TVL/protocol historical context",
      endpointFamily:
        "/protocol/{protocol}, /v2/historicalChainTvl/{chain}, /overview/fees, /summary/fees/{protocol}",
      status: defiMode !== "unresolved" ? "configured" : "needs_mapping",
      requiredFor: [
        "TVL context strip",
        "protocol/chain annotation",
        "fee/revenue context",
        "stablecoin/chain lane",
      ],
      unlocks: [
        "TVL annotation",
        "protocol context rail",
        "DeFi fundamentals lane",
      ],
      missing: unique([
        defiMode === "unresolved" && "protocol/chain slug mapping",
        "TVL observedAt receipt",
        "fees/revenue endpoint selection",
      ]),
      maxAgeSeconds: 3_600,
      surfaceImpact: [
        "chart",
        "vlm_brain",
        "browser_preview",
        "pdf_preview",
        "pdf_download",
        "angel",
      ],
      noMixBoundary:
        "DefiLlama is TVL/protocol/chain/fundamentals context only; it must never be used as price candle, liquidity safety or contract-audit proof.",
    },
    {
      id: "dexscreener_pair_snapshot_anchor",
      provider: "dexscreener",
      label: "DEX Screener pair/liquidity snapshot anchor",
      endpointFamily:
        "/latest/dex/search, /latest/dex/pairs/{chainId}/{pairId}, /tokens/v1/{chainId}/{tokenAddresses}",
      status: hasDex ? "observed" : "planned",
      requiredFor: [
        "pair identity",
        "liquidity USD",
        "FDV/MC sanity",
        "volume/tx pressure",
      ],
      unlocks: [
        "pair snapshot card",
        "liquidity/FDV contrast",
        "DEX source badge",
      ],
      missing: hasDex
        ? ["snapshot observedAt and max-age badge"]
        : ["token address/chain mapping", "pair id resolver"],
      maxAgeSeconds: 120,
      surfaceImpact: [
        "shield",
        "chart",
        "vlm_brain",
        "browser_preview",
        "pdf_preview",
        "angel",
      ],
      noMixBoundary:
        "DEX Screener pair data can anchor liquidity/FDV/volume only; it cannot provide long-range market history by itself.",
    },
    {
      id: "pdf_backfill_manifest_parity",
      provider: "pdf",
      label: "PDF preview/download backfill manifest parity",
      endpointFamily: "internal canonical evidence payload",
      status: macroBlocked ? "blocked" : "configured",
      requiredFor: [
        "PDF preview",
        "PDF download",
        "Browser preview",
        "Angel answer",
      ],
      unlocks: [
        "same manifest hash across surfaces",
        "reject mismatched chart/pdf payload",
        "operator replay",
      ],
      missing: unique([
        macroBlocked && "PASS2461 macro gap receipt is blocked",
        "signed canonical manifest in preview and download",
      ]),
      maxAgeSeconds: 86_400,
      surfaceImpact: [
        "browser_preview",
        "pdf_preview",
        "pdf_download",
        "angel",
        "operator_console",
      ],
      noMixBoundary:
        "PDF cannot generate stronger claims than the source-sync/chart manifest; mismatched payloads must be regenerated.",
    },
    {
      id: "bitquery_holder_flow_future_backfill",
      provider: "bitquery",
      label: "Bitquery holder/flow future backfill",
      endpointFamily:
        "planned holder concentration, transfer flow and DEX trade graph",
      status: "planned",
      requiredFor: [
        "Advanced holder graph",
        "transfer flow",
        "DEX trade replay",
        "wash/cluster review",
      ],
      unlocks: [
        "holder-flow rail",
        "wallet concentration receipt",
        "transfer burst context",
      ],
      missing: [
        "API key",
        "query contract",
        "privacy redaction",
        "observedAt and retry policy",
      ],
      maxAgeSeconds: 300,
      surfaceImpact: [
        "vlm_brain",
        "pdf_preview",
        "pdf_download",
        "angel",
        "operator_console",
      ],
      noMixBoundary:
        "Planned holder/flow lanes are tasks, never live evidence, until adapter/key/query/observedAt exist.",
    },
  ];

  return jobs.slice(0, 10);
}

function buildSurfaceContracts(
  jobs: Pass2462BackfillJob[],
): Pass2462SurfaceBackfillContract[] {
  return SURFACES.map((surface) => {
    const relevant = jobs.filter((job) => job.surfaceImpact.includes(surface));
    const blockedBy = relevant
      .filter((job) =>
        ["needs_backfill", "needs_mapping", "planned", "blocked"].includes(
          job.status,
        ),
      )
      .flatMap((job) =>
        job.missing.map((missing) => `${job.label}: ${missing}`),
      )
      .slice(0, 8);
    return {
      surface,
      state: stateFromLocks(
        blockedBy.length,
        relevant.filter((job) => job.status === "configured").length,
      ),
      requiredJobs: relevant.map((job) => job.id).slice(0, 8),
      blockedBy,
      renderRule: blockedBy.length
        ? "Show the backfill manifest and blocked jobs before any Advanced macro chart, PDF or Angel conclusion."
        : "Render the canonical backfill manifest hash next to macro chart and PDF evidence.",
    };
  });
}

function buildPdfReceipt(
  fingerprint: string,
  jobs: Pass2462BackfillJob[],
  macroGapReceipt?: Pass2461MacroGapReceipt,
): Pass2462PdfBackfillReceipt {
  const hardRejectReasons = unique([
    ...jobs
      .filter(
        (job) =>
          job.surfaceImpact.includes("pdf_preview") ||
          job.surfaceImpact.includes("pdf_download"),
      )
      .filter((job) =>
        ["needs_backfill", "needs_mapping", "planned", "blocked"].includes(
          job.status,
        ),
      )
      .flatMap((job) =>
        job.missing.map((missing) => `${job.label}: ${missing}`),
      ),
    macroGapReceipt?.pdfChartReceipt.state === "blocked" &&
      "PASS2461 PDF chart receipt is blocked",
  ]).slice(0, 10);
  return {
    state: hardRejectReasons.length
      ? "blocked"
      : jobs.some((job) => job.status === "configured")
        ? "watch"
        : "ready",
    previewFingerprint: fingerprint,
    downloadFingerprint: fingerprint,
    parityState: hardRejectReasons.length
      ? "blocked_until_backfill_manifest"
      : "same_backfill_manifest",
    hardRejectReasons,
    requiredVisibleFields: [
      "requested range",
      "observed point count",
      "required minimum points",
      "provider backfill jobs",
      "provider observedAt/max-age",
      "backfillFingerprint",
      "macro gap receipt fingerprint",
      "DefiLlama TVL boundary",
      "no-forecast rule",
    ],
  };
}

export function buildPass2462HistoricalBackfillOrchestrator(args: {
  query?: string;
  symbol?: string;
  requestedRange?: string;
  pointCount?: number;
  sourceSync?: Pass2462SourceSyncPacket;
  chartOverlay?: Pass2449ChartOverlayReconciler;
  macroGapReceipt?: Pass2461MacroGapReceipt;
  payloadFingerprint?: string;
}): Pass2462HistoricalBackfillOrchestrator {
  const requestedRange = normalizeRange(
    args.requestedRange ?? args.sourceSync?.pass2461?.requestedRange ?? "2y",
  );
  const pointCount = Math.max(
    0,
    Math.round(
      args.pointCount ??
        args.sourceSync?.pass2461?.observedPointCount ??
        args.sourceSync?.pass2460?.activeRangeGate.observedPointCount ??
        0,
    ),
  );
  const minPoints = requiredMinPoints(requestedRange);
  const macroGapReceipt = args.macroGapReceipt ?? args.sourceSync?.pass2461;
  const chartOverlay = args.chartOverlay ?? args.sourceSync?.pass2449;
  const jobs = buildJobs({
    sourceSync: args.sourceSync,
    chartOverlay,
    macroGapReceipt,
    range: requestedRange,
    pointCount,
    minPoints,
  });
  const critical = jobs.filter((job) =>
    ["needs_backfill", "needs_mapping", "blocked"].includes(job.status),
  ).length;
  const watch = jobs.filter(
    (job) => job.status === "configured" || job.status === "planned",
  ).length;
  const state = stateFromLocks(critical, watch);
  const backfillFingerprint = smallHash({
    query: args.query ?? args.sourceSync?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol,
    requestedRange,
    pointCount,
    minPoints,
    payloadFingerprint:
      args.payloadFingerprint ?? macroGapReceipt?.gapReceiptFingerprint,
    jobs: jobs.map((job) => [job.id, job.status, job.missing]),
  });
  const surfaceBackfillContracts = buildSurfaceContracts(jobs);
  const pdfBackfillReceipt = buildPdfReceipt(
    backfillFingerprint,
    jobs,
    macroGapReceipt,
  );
  const hardLocks = unique([
    pointCount < minPoints &&
      `${requestedRange} backfill requires ${minPoints} points; observed ${pointCount}`,
    ...jobs
      .filter((job) =>
        ["needs_backfill", "needs_mapping", "blocked"].includes(job.status),
      )
      .flatMap((job) =>
        job.missing.map((missing) => `${job.label}: ${missing}`),
      ),
    pdfBackfillReceipt.state === "blocked" &&
      "PDF preview/download must carry the same backfill manifest before Advanced macro wording",
  ]).slice(0, 14);
  const score = clamp(
    100 -
      critical * 14 -
      watch * 5 +
      Math.min(12, Math.floor((pointCount / Math.max(1, minPoints)) * 12)),
  );

  return {
    version: "historical-backfill-orchestrator-v1",
    state,
    score,
    query: args.query ?? args.sourceSync?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol,
    requestedRange,
    observedPointCount: pointCount,
    requiredMinPoints: minPoints,
    backfillFingerprint,
    rangePlan: {
      range: requestedRange,
      minimumPoints: minPoints,
      observedPoints: pointCount,
      primaryHistoryProvider:
        "CoinGecko market_chart/range with price, market cap and volume arrays",
      requiredSecondaryOverlay: [
        "GeckoTerminal pool OHLCV for DEX tokens",
        "Binance klines/depth for mapped CEX pairs",
        "DEX Screener pair/liquidity snapshot as context",
      ],
      volumeMarketCapRequirement:
        "Macro charts must show whether price-only history lacks market-cap/volume arrays; missing arrays lower confidence.",
      gapHandling:
        "Never smooth missing macro points. Render backfill gaps and provider labels directly on chart, Brain, Browser and PDF.",
      state,
    },
    backfillJobs: jobs,
    surfaceBackfillContracts,
    pdfBackfillReceipt,
    providerBackfillOrder: jobs.map((job) => `${job.id}:${job.status}`),
    hardLocks,
    nextProviderActions: unique([
      "Implement persistent historical cache keyed by asset/range/provider/backfillFingerprint.",
      "Attach CoinGecko range/OHLC arrays to the chart payload before PDF generation.",
      "Resolve network + pool address for GeckoTerminal overlay before marking DEX macro charts ready.",
      "Attach DefiLlama TVL/protocol annotations as separate context strips, not price candles.",
      "Reject PDF download when preview/download backfillFingerprint differs.",
      "Keep Bitquery holder-flow lane planned until adapter, key, query contract and redaction exist.",
    ]).slice(0, 10),
    hundredPercentUnlocks: [
      "2Y/5Y/MAX chart has required point density and visible gap markers.",
      "Second overlay source is observed or explicit blocked marker is rendered.",
      "PDF preview/download share the same backfillFingerprint and gap receipt.",
      "DefiLlama TVL/protocol lane is separated from price and liquidity lanes.",
      "Angel and VLM Brain quote the same manifest locks before conclusions.",
    ],
    noSilentGreenRule:
      "A macro chart cannot become green only because one history endpoint returned data; it needs range density, observedAt/max-age, second overlay or visible backfill locks, and PDF parity.",
    generatedAt: new Date().toISOString(),
  };
}
