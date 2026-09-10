import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { Pass2449ChartOverlayReconciler } from "./chart-overlay-reconciler";
import type { Pass2456SurfaceId } from "./runtime-parity-queue";
import type { Pass2459SourceFreshnessDriftSentinel } from "./source-freshness-drift-sentinel";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";
import type { Pass2453ReportEvidenceCapsule } from "./report-evidence-capsule";

type Pass2460SourceSyncPacket = Omit<VelmereSourceSyncPacket, "pass2449"> & {
  pass2449?: Pass2449ChartOverlayReconciler;
  pass2453?: Pass2453ReportEvidenceCapsule;
  pass2459?: Pass2459SourceFreshnessDriftSentinel;
};

export type Pass2460MacroChartState = "ready" | "watch" | "blocked";
export type Pass2460RangeId = "30d" | "90d" | "1y" | "2y" | "5y" | "max";

export type Pass2460RangeGate = {
  range: Pass2460RangeId;
  label: string;
  state: Pass2460MacroChartState;
  requiredMinPoints: number;
  observedPointCount: number;
  pointCoveragePercent: number;
  requiredProviders: string[];
  confirmedProviders: string[];
  missingProof: string[];
  gapPolicy: string;
  resamplePolicy: string;
  customerSafeCopy: string;
  operatorNextAction: string;
};

export type Pass2460SurfaceMacroContract = {
  surface: Pass2456SurfaceId;
  state: Pass2460MacroChartState;
  requiredVisibleProof: string[];
  blockedBy: string[];
  copyRule: string;
};

export type Pass2460MacroChartIntegrityGate = {
  version: "macro-chart-integrity-gate-v1";
  state: Pass2460MacroChartState;
  score: number;
  query?: string;
  symbol?: string;
  requestedRange: string;
  canonicalEvidenceFingerprint: string;
  macroChartFingerprint: string;
  activeRangeGate: Pass2460RangeGate;
  rangeGates: Pass2460RangeGate[];
  surfaceContracts: Pass2460SurfaceMacroContract[];
  secondOverlayPolicy: string[];
  macroLocks: string[];
  hundredPercentUnlocks: string[];
  nextWorldClassSequence: string[];
  noForecastRule: string;
  generatedAt: string;
};

const MACRO_RANGES: Pass2460RangeId[] = ["30d", "90d", "1y", "2y", "5y", "max"];

const RANGE_MIN_POINTS: Record<Pass2460RangeId, number> = {
  "30d": 90,
  "90d": 120,
  "1y": 180,
  "2y": 365,
  "5y": 520,
  max: 730,
};

const RANGE_LABELS: Record<Pass2460RangeId, string> = {
  "30d": "30D density",
  "90d": "90D regime",
  "1y": "1Y context",
  "2y": "2Y macro",
  "5y": "5Y macro",
  max: "MAX history",
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
  return `pass2460-${sha256Token(stableSerialize(input), 24)}`;
}

function normalizeRange(range?: string): Pass2460RangeId {
  const normalized = (range ?? "2y").toLowerCase();
  if (
    normalized === "30d" ||
    normalized === "90d" ||
    normalized === "1y" ||
    normalized === "2y" ||
    normalized === "5y" ||
    normalized === "max"
  )
    return normalized;
  if (normalized === "1mo" || normalized === "1m") return "30d";
  if (normalized === "7d" || normalized === "1d") return "30d";
  return "2y";
}

function providerKey(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("coingecko")) return "coingecko";
  if (normalized.includes("dex screener") || normalized.includes("dexscreener"))
    return "dexscreener";
  if (
    normalized.includes("geckoterminal") ||
    normalized.includes("gecko terminal")
  )
    return "geckoterminal";
  if (normalized.includes("binance")) return "binance";
  if (normalized.includes("defillama")) return "defillama";
  return (
    normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
    "unknown-provider"
  );
}

function providerConfirmed(
  provider: string,
  args: {
    sourceSync?: Pass2460SourceSyncPacket;
    chartOverlay?: Pass2449ChartOverlayReconciler;
    freshness?: Pass2459SourceFreshnessDriftSentinel;
  },
) {
  const key = providerKey(provider);
  const sourceLane =
    args.sourceSync?.lanes.some(
      (lane) => providerKey(lane.label) === key || providerKey(lane.id) === key,
    ) ?? false;
  const overlayLane =
    args.chartOverlay?.providerOverlays.some(
      (lane) =>
        providerKey(lane.label) === key &&
        (lane.state === "ready" || lane.state === "watch"),
    ) ?? false;
  const freshnessLane =
    args.freshness?.lanes.some(
      (lane) => lane.providerKey === key && lane.status === "fresh_live",
    ) ?? false;
  if (provider === "coingecko")
    return sourceLane || overlayLane || freshnessLane;
  return (overlayLane || sourceLane || freshnessLane) && freshnessLane;
}

function rangeClass(range: Pass2460RangeId) {
  if (range === "30d" || range === "90d") return "medium";
  if (range === "1y") return "long";
  return "macro";
}

function requiredProvidersFor(range: Pass2460RangeId) {
  const base = ["coingecko"];
  if (range === "30d" || range === "90d")
    return [...base, "dexscreener or binance/geckoterminal"];
  if (range === "1y")
    return [...base, "coingecko_ohlc", "dexscreener or binance/geckoterminal"];
  return [
    ...base,
    "coingecko_ohlc",
    "binance or geckoterminal",
    "dexscreener liquidity snapshot",
    "PDF/chart same hash",
  ];
}

function buildRangeGate(
  range: Pass2460RangeId,
  args: {
    requestedRange: Pass2460RangeId;
    pointCount: number;
    sourceSync?: Pass2460SourceSyncPacket;
    chartOverlay?: Pass2449ChartOverlayReconciler;
    freshness?: Pass2459SourceFreshnessDriftSentinel;
  },
): Pass2460RangeGate {
  const requiredMinPoints = RANGE_MIN_POINTS[range];
  const observedPointCount =
    range === args.requestedRange ? args.pointCount : 0;
  const pointCoveragePercent = clamp(
    (observedPointCount / Math.max(1, requiredMinPoints)) * 100,
  );
  const providers = requiredProvidersFor(range);
  const hasCoinGecko = providerConfirmed("coingecko", args);
  const hasDexSnapshot = providerConfirmed("dexscreener", args);
  const hasBinance = providerConfirmed("binance", args);
  const hasGeckoTerminal = providerConfirmed("geckoterminal", args);
  const hasSecondOverlay =
    hasDexSnapshot ||
    hasBinance ||
    hasGeckoTerminal ||
    Boolean(
      args.chartOverlay?.providerOverlays.some(
        (lane) =>
          ["ready", "watch"].includes(lane.state) &&
          lane.provider !== "coingecko_market_chart",
      ),
    );
  const macro = rangeClass(range) === "macro";
  const missingProof = unique([
    observedPointCount < requiredMinPoints &&
      `${range} requires at least ${requiredMinPoints} points before Advanced macro copy`,
    !hasCoinGecko && "CoinGecko market_chart primary lane not confirmed",
    (range === "1y" || macro) &&
      !args.chartOverlay?.providerOverlays.some(
        (lane) =>
          lane.provider === "coingecko_ohlc" && lane.state !== "blocked",
      ) &&
      "CoinGecko OHLC confirmation not mounted",
    !hasSecondOverlay && "second chart/liquidity overlay missing",
    macro &&
      !hasBinance &&
      !hasGeckoTerminal &&
      "macro range needs Binance CEX or GeckoTerminal pool OHLCV overlay where applicable",
    macro &&
      !hasDexSnapshot &&
      "macro range needs DEX Screener liquidity snapshot as context where applicable",
    args.freshness?.state === "blocked" && "freshness drift blocks macro proof",
    !args.sourceSync?.pass2453?.canonicalEvidenceFingerprint &&
      "canonical report evidence fingerprint missing",
  ]).slice(0, 10);
  const state: Pass2460MacroChartState = missingProof.some(
    (item) =>
      item.includes("requires") ||
      item.includes("freshness drift") ||
      item.includes("fingerprint"),
  )
    ? "blocked"
    : missingProof.length
      ? "watch"
      : "ready";
  const confirmedProviders = unique([
    hasCoinGecko && "CoinGecko market_chart",
    args.chartOverlay?.providerOverlays.some(
      (lane) => lane.provider === "coingecko_ohlc" && lane.state !== "blocked",
    ) && "CoinGecko OHLC",
    hasDexSnapshot && "DEX Screener snapshot",
    hasBinance && "Binance klines/depth",
    hasGeckoTerminal && "GeckoTerminal pool OHLCV",
  ]);
  return {
    range,
    label: RANGE_LABELS[range],
    state,
    requiredMinPoints,
    observedPointCount,
    pointCoveragePercent,
    requiredProviders: providers,
    confirmedProviders,
    missingProof,
    gapPolicy:
      "Show point count, gap annotations, provider timestamp/max-age and resampling rule before any trend/regime sentence.",
    resamplePolicy: macro
      ? "Use provider-native daily/weekly macro history; do not stretch short-window sparklines into 2Y/5Y/MAX conclusions."
      : "Use native provider granularity; resampling must be disclosed in the chart receipt.",
    customerSafeCopy:
      state === "ready"
        ? `${RANGE_LABELS[range]} is sufficiently evidenced for context-only chart language.`
        : `${RANGE_LABELS[range]} is not complete proof yet; show the missing chart/source requirements instead of smoothing the gap.`,
    operatorNextAction:
      state === "ready"
        ? "Keep the same chart proof fingerprint across Shield, Brain, Browser and PDF."
        : `Unlock ${RANGE_LABELS[range]} by adding: ${missingProof.slice(0, 3).join("; ") || "second overlay and point-count receipt"}.`,
  };
}

function surfaceContract(
  surface: Pass2456SurfaceId,
  active: Pass2460RangeGate,
  fingerprint: string,
): Pass2460SurfaceMacroContract {
  const blockedBy = unique([
    ...active.missingProof,
    !fingerprint || fingerprint === "missing-fingerprint"
      ? "canonical macro chart fingerprint missing"
      : null,
    (surface === "pdf_preview" || surface === "pdf_download") &&
      active.state !== "ready" &&
      "PDF must not export macro chart without same range receipt",
    surface === "angel" &&
      active.state !== "ready" &&
      "Angel must say chart proof is incomplete before conclusion",
  ]).slice(0, 8);
  return {
    surface,
    state: blockedBy.some(
      (item) =>
        item.includes("PDF") ||
        item.includes("fingerprint") ||
        item.includes("requires"),
    )
      ? "blocked"
      : blockedBy.length
        ? "watch"
        : "ready",
    requiredVisibleProof: [
      "range label",
      "point count / minimum point count",
      "primary chart provider",
      "second overlay status",
      "freshness receipt",
      "canonical macro chart fingerprint",
      "context-only no-forecast disclaimer",
    ],
    blockedBy,
    copyRule: blockedBy.length
      ? "Show macro chart lock before any Advanced/PDF/Angel trend language."
      : "Macro chart copy may be shown as historical context only, never as future price prediction.",
  };
}

function stateFrom(
  rangeGates: Pass2460RangeGate[],
  surfaces: Pass2460SurfaceMacroContract[],
): Pass2460MacroChartState {
  if (
    rangeGates.some(
      (gate) => gate.range === "2y" && gate.state === "blocked",
    ) ||
    surfaces.some((surface) => surface.state === "blocked")
  )
    return "blocked";
  if (
    rangeGates.some((gate) => gate.state === "watch") ||
    surfaces.some((surface) => surface.state === "watch")
  )
    return "watch";
  return "ready";
}

export function buildPass2460MacroChartIntegrityGate(args: {
  query?: string;
  symbol?: string;
  requestedRange?: string;
  pointCount?: number;
  sourceSync?: Pass2460SourceSyncPacket;
  chartOverlay?: Pass2449ChartOverlayReconciler;
  sourceFreshness?: Pass2459SourceFreshnessDriftSentinel;
  payloadFingerprint?: string;
}): Pass2460MacroChartIntegrityGate {
  const requestedRange = normalizeRange(
    args.requestedRange ?? args.chartOverlay?.range,
  );
  const pointCount = Math.max(
    0,
    Math.floor(
      args.pointCount ??
        args.chartOverlay?.windowContract.actualPoints ??
        args.sourceSync?.pass2449?.windowContract.actualPoints ??
        0,
    ),
  );
  const chartOverlay = args.chartOverlay ?? args.sourceSync?.pass2449;
  const freshness = args.sourceFreshness ?? args.sourceSync?.pass2459;
  const rangeGates = MACRO_RANGES.map((range) =>
    buildRangeGate(range, {
      requestedRange,
      pointCount,
      sourceSync: args.sourceSync,
      chartOverlay,
      freshness,
    }),
  );
  const activeRangeGate =
    rangeGates.find((gate) => gate.range === requestedRange) ?? rangeGates[3];
  const canonicalEvidenceFingerprint =
    args.payloadFingerprint ??
    args.sourceSync?.pass2453?.canonicalEvidenceFingerprint ??
    freshness?.canonicalEvidenceFingerprint ??
    "missing-fingerprint";
  const macroChartFingerprint = smallHash({
    canonicalEvidenceFingerprint,
    requestedRange,
    pointCount,
    active: activeRangeGate.missingProof,
    freshness: freshness?.freshnessFingerprint,
  });
  const surfaceContracts = SURFACES.map((surface) =>
    surfaceContract(surface, activeRangeGate, macroChartFingerprint),
  );
  const state = stateFrom(rangeGates, surfaceContracts);
  const macroLocks = unique([
    ...activeRangeGate.missingProof,
    ...surfaceContracts.flatMap((surface) =>
      surface.state === "blocked"
        ? surface.blockedBy.map((item) => `${surface.surface}: ${item}`)
        : [],
    ),
  ]).slice(0, 16);
  const readyRanges = rangeGates.filter(
    (gate) => gate.state === "ready",
  ).length;
  const watchRanges = rangeGates.filter(
    (gate) => gate.state === "watch",
  ).length;
  const blockedRanges = rangeGates.filter(
    (gate) => gate.state === "blocked",
  ).length;
  const score = clamp(
    38 +
      readyRanges * 8 +
      watchRanges * 3 -
      blockedRanges * 5 +
      activeRangeGate.pointCoveragePercent * 0.18 -
      macroLocks.length * 2,
  );

  return {
    version: "macro-chart-integrity-gate-v1",
    state,
    score,
    query: args.query ?? args.sourceSync?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol,
    requestedRange,
    canonicalEvidenceFingerprint,
    macroChartFingerprint,
    activeRangeGate,
    rangeGates,
    surfaceContracts,
    secondOverlayPolicy: [
      "CoinGecko market_chart is the primary history lane for listed assets; it needs OHLC and second overlay before macro Advanced copy.",
      "GeckoTerminal pool OHLCV is pool-specific and must show network + pool address; it does not replace global market price.",
      "DEX Screener is a pair/liquidity/FDV snapshot lane; it supports chart context but is not a long-history candle source by itself.",
      "DefiLlama TVL/protocol/chain context can be overlaid as fundamentals context, never as price candle proof.",
      "Binance klines/depth are venue-specific and must remain labeled as one venue, not global truth.",
    ],
    macroLocks,
    hundredPercentUnlocks: [
      "30D/90D/1Y/2Y/5Y/MAX ranges each have visible point-count/minimum gates.",
      "Advanced macro language is blocked until primary history, second overlay, freshness and PDF hash are all visible.",
      "Chart, Browser, PDF, Brain and Angel all share one macroChartFingerprint.",
      "Short-window sparkline data can no longer masquerade as 2Y/5Y/MAX evidence.",
      "DefiLlama context is separated from price candles and kept in the correct methodology lane.",
    ],
    nextWorldClassSequence: [
      "Mount PASS2460 activeRangeGate into Browser Preview and PDF preview/download receipt.",
      "Fetch real CoinGecko market_chart/range for 2Y/5Y/MAX and store point-count receipts.",
      "Attach GeckoTerminal pool OHLCV when chain+pool are known and Binance klines when CEX mapping is valid.",
      "Add visual gap markers and source/timecode badges to the chart canvas.",
      "Start PASS2461: macro chart gap-marker renderer and PDF chart receipt parity.",
    ],
    noForecastRule:
      "Macro charts are historical context only. Velmère must not convert 2Y/5Y/MAX history into ROI, price target or trading instruction.",
    generatedAt: new Date().toISOString(),
  };
}
