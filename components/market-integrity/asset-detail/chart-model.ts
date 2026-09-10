import type { VlmAssetDetailCandle, VlmAssetDetailModalData } from "./contract";
import {
  resolvePass4408AssetDetailChartIntervalMs,
  resolvePass4408AssetSessionPolicy,
} from "../../../lib/market-integrity/asset-detail-client-helpers";

export type VlmAssetTimeframe = "15M" | "1H" | "4H" | "1D" | "1W" | "1M";

export type TimeframeConfig = {
  key: VlmAssetTimeframe;
  label: string;
  realMarketsRange: "15m" | "1h" | "4h" | "1d" | "1w" | "1mo";
  shieldRange: "15m" | "1h" | "4h" | "1d" | "7d" | "1mo";
  intervalMs: number;
  visible: number;
  minimumVisible: number;
  intraday: boolean;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export const TIMEFRAMES: readonly TimeframeConfig[] = [
  { key: "15M", label: "15m", realMarketsRange: "15m", shieldRange: "15m", intervalMs: 15 * MINUTE, visible: 420, minimumVisible: 72, intraday: true },
  { key: "1H", label: "1H", realMarketsRange: "1h", shieldRange: "1h", intervalMs: HOUR, visible: 420, minimumVisible: 54, intraday: true },
  { key: "4H", label: "4H", realMarketsRange: "4h", shieldRange: "4h", intervalMs: 4 * HOUR, visible: 380, minimumVisible: 42, intraday: true },
  { key: "1D", label: "1D", realMarketsRange: "1d", shieldRange: "1d", intervalMs: DAY, visible: 360, minimumVisible: 36, intraday: false },
  { key: "1W", label: "1W", realMarketsRange: "1w", shieldRange: "7d", intervalMs: WEEK, visible: 260, minimumVisible: 28, intraday: false },
  { key: "1M", label: "1M", realMarketsRange: "1mo", shieldRange: "1mo", intervalMs: 30 * DAY, visible: 220, minimumVisible: 24, intraday: false },
] as const;

export type NormalizedCandle = Required<Pick<VlmAssetDetailCandle, "open" | "high" | "low" | "close">> & {
  timestamp: number;
  volume: number;
};

export type ChartRange = { from: number; to: number };
export type ChartHover = { x: number; y: number } | null;
export type ChartLayout = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  priceBottom: number;
  volumeTop: number;
  volumeBottom: number;
  bottom: number;
  plotWidth: number;
  priceHeight: number;
};

export type RemoteCandleSet = {
  candles: VlmAssetDetailCandle[];
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  verificationLabel?: string | null;
  freshness?: "live_verified" | "partial_not_live" | "last_known_good" | "local_reference";
  liveVerified: boolean;
  snapshotReadMode?: "memory" | "supabase" | null;
  staleAgeMs?: number | null;
};

export function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function timeframeConfig(key: VlmAssetTimeframe): TimeframeConfig {
  return TIMEFRAMES.find((item) => item.key === key) ?? TIMEFRAMES[TIMEFRAMES.length - 1];
}

export function assetDetailChartIntervalMs(data: VlmAssetDetailModalData, timeframe: VlmAssetTimeframe) {
  return resolvePass4408AssetDetailChartIntervalMs(data, timeframe);
}

export function pass4598DedupeSourceCandles(candles: NormalizedCandle[]) {
  const byTimestamp = new Map<number, NormalizedCandle>();
  for (const candle of candles) {
    const timestamp = Math.round(candle.timestamp);
    if (!byTimestamp.has(timestamp)) byTimestamp.set(timestamp, { ...candle, timestamp });
  }
  return Array.from(byTimestamp.values()).sort((left, right) => left.timestamp - right.timestamp).slice(-1400);
}

export function pass4534ChartPrecisionSummary(
  candles: NormalizedCandle[],
  timeframe: VlmAssetTimeframe,
  intervalMs = timeframeConfig(timeframe).intervalMs,
) {
  if (candles.length < 8) return { score: 0, duplicateCount: 0, gapCount: 0, largeOpenGaps: 0 };
  const step = intervalMs;
  let duplicateCount = 0;
  let gapCount = 0;
  let largeOpenGaps = 0;
  const seen = new Set<number>();
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const timestampKey = Math.round(candle.timestamp / Math.max(step, 1));
    if (seen.has(timestampKey)) duplicateCount += 1;
    seen.add(timestampKey);
    const previous = candles[index - 1];
    if (!previous) continue;
    if (candle.timestamp - previous.timestamp > step * 1.75) gapCount += 1;
    if (Math.abs(candle.open - previous.close) / Math.max(previous.close, 0.000001) > 0.08) largeOpenGaps += 1;
  }
  const score = Math.max(0, Math.min(100, 100 - duplicateCount * 5 - gapCount * 3 - largeOpenGaps * 4));
  return { score, duplicateCount, gapCount, largeOpenGaps };
}

export function pass4538ChartPrecisionLedger(
  candles: NormalizedCandle[],
  timeframe: VlmAssetTimeframe,
  sourceMode: "remote" | "pending",
  intervalMs = timeframeConfig(timeframe).intervalMs,
) {
  const config = timeframeConfig(timeframe);
  const step = intervalMs;
  const latest = candles[candles.length - 1] ?? null;
  const previous = candles[candles.length - 2] ?? null;
  const expectedBars = config.visible;
  const coverage = Math.max(0, Math.min(100, Math.round((Math.min(candles.length, expectedBars) / Math.max(1, expectedBars)) * 100)));
  const driftMs = latest && previous ? Math.abs(latest.timestamp - previous.timestamp - step) : 0;
  const driftBars = step ? driftMs / step : 0;
  const scoreBase = pass4534ChartPrecisionSummary(candles, timeframe, intervalMs).score;
  const sourcePenalty = sourceMode === "pending" ? 100 : 0;
  const driftPenalty = driftBars > 0.45 ? Math.min(10, Math.round(driftBars * 4)) : 0;
  const score = sourceMode === "pending" ? 0 : Math.max(0, Math.min(100, scoreBase - sourcePenalty - driftPenalty));
  return { score, coverage, latest, sourceMode, driftBars, stepLabel: config.label, barCount: candles.length, policy: sourceMode === "remote" ? "remote OHLC · exact first" : "source pending · no synthetic OHLC" };
}

export function pass4539SessionPolicy(data: VlmAssetDetailModalData) {
  return resolvePass4408AssetSessionPolicy(data);
}

export function pass4539GapAudit(
  candles: NormalizedCandle[],
  timeframe: VlmAssetTimeframe,
  intervalMs = timeframeConfig(timeframe).intervalMs,
) {
  const step = intervalMs;
  const gaps: Array<{ index: number; bars: number; timestamp: number }> = [];
  let openDriftCount = 0;
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const candle = candles[index];
    const bars = (candle.timestamp - previous.timestamp) / Math.max(step, 1);
    if (bars > 1.72) gaps.push({ index, bars, timestamp: candle.timestamp });
    if (Math.abs(candle.open - previous.close) / Math.max(previous.close, 0.000001) > 0.055) openDriftCount += 1;
  }
  const largestGapBars = gaps.reduce((max, gap) => Math.max(max, gap.bars), 0);
  return { gaps, gapCount: gaps.length, largestGapBars, openDriftCount };
}

export function pass4598SourceFaithfulCandles(candles: NormalizedCandle[]): NormalizedCandle[] {
  return pass4598DedupeSourceCandles(candles);
}

export function pass4539ChartPrecisionLedger(
  candles: NormalizedCandle[],
  timeframe: VlmAssetTimeframe,
  sourceMode: "remote" | "pending",
  sessionPolicy: ReturnType<typeof pass4539SessionPolicy>,
  intervalMs = timeframeConfig(timeframe).intervalMs,
) {
  const base = pass4538ChartPrecisionLedger(candles, timeframe, sourceMode, intervalMs);
  const gapAudit = pass4539GapAudit(candles, timeframe, intervalMs);
  const naturalGapPenalty = sessionPolicy === "session_market" ? Math.min(5, gapAudit.gapCount) : Math.min(18, gapAudit.gapCount * 4);
  const openDriftPenalty = Math.min(8, gapAudit.openDriftCount * 2);
  const score = Math.max(0, Math.min(100, base.score - naturalGapPenalty - openDriftPenalty));
  const policyLabel = sessionPolicy === "crypto_24_7" ? "crypto 24/7 · provider gaps disclosed" : sessionPolicy === "session_market" ? "session market · natural gaps marked" : "mixed provider · gaps disclosed";
  return { ...base, score, gapAudit, sessionPolicy, policyLabel };
}

export function normalizeCandles(data: VlmAssetDetailModalData, timeframe: VlmAssetTimeframe): NormalizedCandle[] {
  void timeframe;
  const sourceCandles = (data.candles ?? [])
    .filter((candle) => finite(candle.timestamp) && finite(candle.open) && finite(candle.high) && finite(candle.low) && finite(candle.close) && candle.timestamp > 0 && candle.open > 0 && candle.high >= Math.max(candle.open, candle.close) && candle.low <= Math.min(candle.open, candle.close) && candle.low > 0 && candle.close > 0)
    .map((candle) => ({ timestamp: candle.timestamp, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: finite(candle.volume) && candle.volume >= 0 ? candle.volume : 0 }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-1000);
  return sourceCandles.length >= 8 ? pass4598SourceFaithfulCandles(sourceCandles) : [];
}

export function formatDateLabel(timestamp: number, timeframe: VlmAssetTimeframe) {
  const date = new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000);
  if (timeframeConfig(timeframe).intraday) return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function formatPrice(value: number) {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const maxDigits = abs < 0.0001 ? 8 : abs < 0.01 ? 6 : abs < 1 ? 4 : abs < 10 ? 4 : 2;
  const minDigits = abs < 0.0001 ? 6 : abs < 0.01 ? 4 : 2;
  return value.toLocaleString("en-US", { maximumFractionDigits: maxDigits, minimumFractionDigits: minDigits });
}

export function futureSpaceBars(span: number) { return Math.max(1, Math.min(4, Math.round(span * 0.025))); }

export function clampRange(
  range: ChartRange,
  candlesLength: number,
  extraFutureBars = 0,
  minimumSpan = 5,
): ChartRange {
  if (candlesLength <= 1) return { from: 0, to: 0 };
  const boundedMinimumSpan = Math.min(Math.max(5, minimumSpan), Math.max(5, candlesLength - 1));
  const span = Math.max(boundedMinimumSpan, range.to - range.from);
  const maxTo = candlesLength - 1 + Math.max(0, extraFutureBars);
  const maxFrom = Math.max(0, maxTo - span);
  const from = Math.min(Math.max(0, range.from), maxFrom);
  return { from, to: from + span };
}

export function rangeForTimeframe(timeframe: VlmAssetTimeframe, candlesLength: number): ChartRange {
  const requestedVisible = timeframeConfig(timeframe).visible;
  const visible = Math.min(candlesLength, Math.max(24, Math.round(requestedVisible * 0.84)));
  const initialFuture = Math.max(2, Math.round(visible * 0.04));
  const to = Math.max(0, candlesLength - 1 + initialFuture);
  const from = Math.max(0, to - visible);
  return clampRange({ from, to }, candlesLength, futureSpaceBars(visible), timeframeConfig(timeframe).minimumVisible);
}

export function getChartLayout(width: number, height: number): ChartLayout {
  const compact = width < 720;
  const left = compact ? 16 : 24;
  const right = compact ? 68 : 84;
  const top = compact ? 26 : 32;
  const bottom = compact ? 28 : 34;
  const volumeHeight = Math.min(54, Math.max(28, (height - top - bottom) * 0.18));
  const volumeBottom = height - bottom;
  const volumeTop = volumeBottom - volumeHeight;
  const priceBottom = volumeTop - 8;
  const plotWidth = Math.max(120, width - left - right);
  const priceHeight = Math.max(120, priceBottom - top);
  return { width, height, left, right, top, priceBottom, volumeTop, volumeBottom, bottom, plotWidth, priceHeight };
}

export function getVisibleCandles(candles: NormalizedCandle[], range: ChartRange) {
  const start = Math.max(0, Math.floor(range.from) - 3);
  const end = Math.min(candles.length - 1, Math.ceil(range.to) + 3);
  return candles.slice(start, end + 1).map((candle, localIndex) => ({ candle, index: start + localIndex }));
}

export function crisp(value: number) { return Math.round(value) + 0.5; }
