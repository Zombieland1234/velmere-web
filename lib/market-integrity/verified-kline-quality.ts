import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import type { BinanceKlineInterval, MarketCandle } from "./kline-types";

export const PASS4799_KLINE_QUALITY_ID = "pass4799-kline-quality-consensus-v1" as const;

export type KlineRangeProfile = {
  range: BinanceKlineInterval;
  intervalMs: number;
  targetBars: number;
  minimumBars: number;
  maximumBars: number;
  maxStaleIntervals: number;
  divergenceWarningPct: number;
  providerSourceInterval: {
    binance: "1m" | "15m" | "1h" | "4h" | "1d" | "1w";
    krakenMinutes: 1 | 15 | 60 | 240 | 1440 | 10080;
    coinbaseGranularitySeconds: 60 | 900 | 3600 | 86400;
    coinbaseAggregateFactor: 1 | 4 | 7;
  };
};

export type KlineSeriesQuality = {
  schemaVersion: typeof PASS4799_KLINE_QUALITY_ID;
  range: BinanceKlineInterval;
  expectedIntervalMs: number;
  rawBars: number;
  validBars: number;
  closedBars: number;
  duplicateBars: number;
  invalidBars: number;
  gapCount: number;
  missingBars: number;
  maximumGapBars: number;
  coveragePercent: number;
  staleIntervals: number | null;
  latestClosedTimestamp: number | null;
  qualityScore: number;
  state: "excellent" | "good" | "limited" | "rejected";
  warnings: string[];
  seriesDigest: string;
};

export type KlineProviderSeries<TProvider extends string = string> = {
  provider: TProvider;
  candles: MarketCandle[];
  quality: KlineSeriesQuality;
};

export type KlineBarConsensus = {
  schemaVersion: typeof PASS4799_KLINE_QUALITY_ID;
  comparedProviders: string[];
  comparedBars: number;
  corroboratedBars: number;
  divergentBars: number;
  corroborationPercent: number;
  medianCloseSpreadPct: number | null;
  p95CloseSpreadPct: number | null;
  maximumCloseSpreadPct: number | null;
  latestCloseSpreadPct: number | null;
  providerSupport: Record<string, {
    overlappingBars: number;
    corroboratedBars: number;
    divergentBars: number;
    medianSpreadPct: number | null;
  }>;
  state: "single_source" | "corroborated" | "partial" | "divergence_warning";
  consensusDigest: string;
};

const PROFILES: Record<BinanceKlineInterval, KlineRangeProfile> = {
  "1m": {
    range: "1m",
    intervalMs: 60_000,
    targetBars: 1_200,
    minimumBars: 240,
    maximumBars: 1_400,
    maxStaleIntervals: 4,
    divergenceWarningPct: 1.25,
    providerSourceInterval: { binance: "1m", krakenMinutes: 1, coinbaseGranularitySeconds: 60, coinbaseAggregateFactor: 1 },
  },
  "15m": {
    range: "15m",
    intervalMs: 15 * 60_000,
    targetBars: 1_200,
    minimumBars: 220,
    maximumBars: 1_400,
    maxStaleIntervals: 3,
    divergenceWarningPct: 1.5,
    providerSourceInterval: { binance: "15m", krakenMinutes: 15, coinbaseGranularitySeconds: 900, coinbaseAggregateFactor: 1 },
  },
  "1h": {
    range: "1h",
    intervalMs: 60 * 60_000,
    targetBars: 1_000,
    minimumBars: 180,
    maximumBars: 1_400,
    maxStaleIntervals: 3,
    divergenceWarningPct: 1.75,
    providerSourceInterval: { binance: "1h", krakenMinutes: 60, coinbaseGranularitySeconds: 3600, coinbaseAggregateFactor: 1 },
  },
  "4h": {
    range: "4h",
    intervalMs: 4 * 60 * 60_000,
    targetBars: 900,
    minimumBars: 160,
    maximumBars: 1_200,
    maxStaleIntervals: 3,
    divergenceWarningPct: 2,
    providerSourceInterval: { binance: "4h", krakenMinutes: 240, coinbaseGranularitySeconds: 3600, coinbaseAggregateFactor: 4 },
  },
  "1d": {
    range: "1d",
    intervalMs: 24 * 60 * 60_000,
    targetBars: 900,
    minimumBars: 120,
    maximumBars: 1_200,
    maxStaleIntervals: 3,
    divergenceWarningPct: 2.25,
    providerSourceInterval: { binance: "1d", krakenMinutes: 1440, coinbaseGranularitySeconds: 86400, coinbaseAggregateFactor: 1 },
  },
  "7d": {
    range: "7d",
    intervalMs: 7 * 24 * 60 * 60_000,
    targetBars: 520,
    minimumBars: 80,
    maximumBars: 720,
    maxStaleIntervals: 3,
    divergenceWarningPct: 2.5,
    providerSourceInterval: { binance: "1w", krakenMinutes: 10080, coinbaseGranularitySeconds: 86400, coinbaseAggregateFactor: 7 },
  },
  "1mo": {
    range: "1mo",
    intervalMs: 24 * 60 * 60_000,
    targetBars: 1_000,
    minimumBars: 120,
    maximumBars: 1_200,
    maxStaleIntervals: 3,
    divergenceWarningPct: 2.25,
    providerSourceInterval: { binance: "1d", krakenMinutes: 1440, coinbaseGranularitySeconds: 86400, coinbaseAggregateFactor: 1 },
  },
};

export function klineRangeProfile(range: BinanceKlineInterval): KlineRangeProfile {
  return PROFILES[range];
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidMarketCandle(candle: MarketCandle): boolean {
  return (
    finite(candle.timestamp) && candle.timestamp > 0 &&
    finite(candle.open) && candle.open > 0 &&
    finite(candle.high) && candle.high >= Math.max(candle.open, candle.close) &&
    finite(candle.low) && candle.low > 0 && candle.low <= Math.min(candle.open, candle.close) &&
    finite(candle.close) && candle.close > 0 &&
    finite(candle.volume) && candle.volume >= 0
  );
}

export function normalizeClosedCandles(args: {
  candles: MarketCandle[];
  range: BinanceKlineInterval;
  nowMs?: number;
  maximumBars?: number;
}) {
  const profile = klineRangeProfile(args.range);
  const nowMs = finite(args.nowMs) ? args.nowMs : Date.now();
  const maximumBars = Math.max(8, Math.min(5_000, args.maximumBars ?? profile.maximumBars));
  const byTimestamp = new Map<number, MarketCandle>();
  let invalidBars = 0;
  let duplicateBars = 0;
  let openBars = 0;

  for (const candle of args.candles) {
    if (!isValidMarketCandle(candle)) {
      invalidBars += 1;
      continue;
    }
    if (candle.timestamp + profile.intervalMs > nowMs + 2_000) {
      openBars += 1;
      continue;
    }
    if (byTimestamp.has(candle.timestamp)) {
      duplicateBars += 1;
      continue;
    }
    byTimestamp.set(candle.timestamp, { ...candle });
  }

  const candles = Array.from(byTimestamp.values())
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-maximumBars);
  return { candles, invalidBars, duplicateBars, openBars };
}

function percentile(values: number[], quantile: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * quantile));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function rounded(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

export function assessKlineSeriesQuality(args: {
  rawCandles: MarketCandle[];
  range: BinanceKlineInterval;
  nowMs?: number;
}): { candles: MarketCandle[]; quality: KlineSeriesQuality } {
  const profile = klineRangeProfile(args.range);
  const nowMs = finite(args.nowMs) ? args.nowMs : Date.now();
  const normalized = normalizeClosedCandles({ candles: args.rawCandles, range: args.range, nowMs });
  const gaps: number[] = [];
  let gapCount = 0;
  let missingBars = 0;
  let maximumGapBars = 0;

  for (let index = 1; index < normalized.candles.length; index += 1) {
    const delta = normalized.candles[index].timestamp - normalized.candles[index - 1].timestamp;
    const intervalUnits = Math.max(1, Math.round(delta / profile.intervalMs));
    if (intervalUnits > 1) {
      const missing = intervalUnits - 1;
      gapCount += 1;
      missingBars += missing;
      maximumGapBars = Math.max(maximumGapBars, missing);
      gaps.push(missing);
    }
  }

  const latestClosedTimestamp = normalized.candles.at(-1)?.timestamp ?? null;
  const staleIntervals = latestClosedTimestamp === null
    ? null
    : Math.max(0, Math.floor((nowMs - (latestClosedTimestamp + profile.intervalMs)) / profile.intervalMs));
  const denominator = normalized.candles.length + missingBars;
  const continuityPercent = denominator > 0 ? (normalized.candles.length / denominator) * 100 : 0;
  const depthPercent = Math.min(100, (normalized.candles.length / profile.targetBars) * 100);
  const coveragePercent = rounded(continuityPercent * 0.65 + depthPercent * 0.35, 2);

  const invalidRate = args.rawCandles.length > 0
    ? (normalized.invalidBars + normalized.duplicateBars) / args.rawCandles.length
    : 1;
  const gapRate = denominator > 0 ? missingBars / denominator : 1;
  const stalePenalty = staleIntervals === null
    ? 20
    : Math.min(25, Math.max(0, staleIntervals - profile.maxStaleIntervals) * 5);
  const depthPenalty = Math.max(0, 1 - normalized.candles.length / profile.targetBars) * 30;
  const gapPenalty = Math.min(35, gapRate * 140);
  const invalidPenalty = Math.min(15, invalidRate * 100);
  const minimumPenalty = normalized.candles.length < profile.minimumBars ? 25 : 0;
  const qualityScore = rounded(Math.max(0, Math.min(100, 100 - stalePenalty - depthPenalty - gapPenalty - invalidPenalty - minimumPenalty)), 2);

  const warnings: string[] = [];
  if (normalized.candles.length < profile.minimumBars) warnings.push(`sparse_history:${normalized.candles.length}/${profile.minimumBars}`);
  if (gapCount > 0) warnings.push(`history_gaps:${gapCount}`);
  if (maximumGapBars > 3) warnings.push(`large_gap:${maximumGapBars}`);
  if (staleIntervals !== null && staleIntervals > profile.maxStaleIntervals) warnings.push(`stale_intervals:${staleIntervals}`);
  if (normalized.invalidBars > 0) warnings.push(`invalid_rows:${normalized.invalidBars}`);
  if (normalized.duplicateBars > 0) warnings.push(`duplicate_rows:${normalized.duplicateBars}`);
  if (normalized.openBars > 0) warnings.push(`open_rows_excluded:${normalized.openBars}`);

  const state: KlineSeriesQuality["state"] = normalized.candles.length < Math.min(8, profile.minimumBars)
    ? "rejected"
    : qualityScore >= 88
      ? "excellent"
      : qualityScore >= 70
        ? "good"
        : qualityScore >= 45
          ? "limited"
          : "rejected";

  const digestPayload = normalized.candles.map((candle) => ({
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    ...(finite(candle.quoteVolume) ? { quoteVolume: candle.quoteVolume } : {}),
    ...(finite(candle.trades) ? { trades: candle.trades } : {}),
  }));

  return {
    candles: normalized.candles,
    quality: {
      schemaVersion: PASS4799_KLINE_QUALITY_ID,
      range: args.range,
      expectedIntervalMs: profile.intervalMs,
      rawBars: args.rawCandles.length,
      validBars: normalized.candles.length,
      closedBars: normalized.candles.length,
      duplicateBars: normalized.duplicateBars,
      invalidBars: normalized.invalidBars,
      gapCount,
      missingBars,
      maximumGapBars,
      coveragePercent,
      staleIntervals,
      latestClosedTimestamp,
      qualityScore,
      state,
      warnings,
      seriesDigest: sha256Digest(canonicalJson({ range: args.range, candles: digestPayload })),
    },
  };
}

function closeSpreadPct(values: number[]): number | null {
  if (values.length < 2) return null;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const midpoint = (minimum + maximum) / 2;
  return midpoint > 0 ? ((maximum - minimum) / midpoint) * 100 : null;
}

export function buildKlineBarConsensus<TProvider extends string>(args: {
  series: Array<KlineProviderSeries<TProvider>>;
  range: BinanceKlineInterval;
}): KlineBarConsensus {
  const profile = klineRangeProfile(args.range);
  const byTimestamp = new Map<number, Array<{ provider: string; close: number }>>();
  const providerSupport: KlineBarConsensus["providerSupport"] = {};

  for (const row of args.series) {
    providerSupport[row.provider] = { overlappingBars: 0, corroboratedBars: 0, divergentBars: 0, medianSpreadPct: null };
    for (const candle of row.candles) {
      const rows = byTimestamp.get(candle.timestamp) ?? [];
      rows.push({ provider: row.provider, close: candle.close });
      byTimestamp.set(candle.timestamp, rows);
    }
  }

  const spreads: number[] = [];
  const perProviderSpreads = new Map<string, number[]>();
  let corroboratedBars = 0;
  let divergentBars = 0;
  let latestTimestamp = -1;
  let latestSpread: number | null = null;

  for (const [timestamp, rows] of byTimestamp.entries()) {
    if (rows.length < 2) continue;
    const spread = closeSpreadPct(rows.map((row) => row.close));
    if (spread === null) continue;
    spreads.push(spread);
    const divergent = spread > profile.divergenceWarningPct;
    if (divergent) divergentBars += 1;
    else corroboratedBars += 1;
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestSpread = spread;
    }
    for (const row of rows) {
      const support = providerSupport[row.provider];
      support.overlappingBars += 1;
      if (divergent) support.divergentBars += 1;
      else support.corroboratedBars += 1;
      const values = perProviderSpreads.get(row.provider) ?? [];
      values.push(spread);
      perProviderSpreads.set(row.provider, values);
    }
  }

  for (const [provider, values] of perProviderSpreads.entries()) {
    providerSupport[provider].medianSpreadPct = percentile(values, 0.5) === null
      ? null
      : rounded(percentile(values, 0.5) as number);
  }

  const comparedBars = corroboratedBars + divergentBars;
  const corroborationPercent = comparedBars > 0 ? rounded((corroboratedBars / comparedBars) * 100, 2) : 0;
  const median = percentile(spreads, 0.5);
  const p95 = percentile(spreads, 0.95);
  const maximum = spreads.length ? Math.max(...spreads) : null;
  const state: KlineBarConsensus["state"] = args.series.length < 2 || comparedBars === 0
    ? "single_source"
    : corroborationPercent >= 95 && (p95 ?? 0) <= profile.divergenceWarningPct
      ? "corroborated"
      : corroborationPercent >= 75
        ? "partial"
        : "divergence_warning";

  const outputWithoutDigest = {
    schemaVersion: PASS4799_KLINE_QUALITY_ID,
    comparedProviders: args.series.map((row) => row.provider).sort(),
    comparedBars,
    corroboratedBars,
    divergentBars,
    corroborationPercent,
    medianCloseSpreadPct: median === null ? null : rounded(median),
    p95CloseSpreadPct: p95 === null ? null : rounded(p95),
    maximumCloseSpreadPct: maximum === null ? null : rounded(maximum),
    latestCloseSpreadPct: latestSpread === null ? null : rounded(latestSpread),
    providerSupport,
    state,
  };

  return {
    ...outputWithoutDigest,
    consensusDigest: sha256Digest(canonicalJson(outputWithoutDigest)),
  };
}

export function rankKlineProviders<
  TProvider extends string,
  TSeries extends KlineProviderSeries<TProvider>,
>(args: {
  series: TSeries[];
  consensus: KlineBarConsensus;
  priority?: readonly TProvider[];
}) {
  const priority = args.priority ?? [];
  return [...args.series]
    .map((row) => {
      const support = args.consensus.providerSupport[row.provider];
      const divergenceRate = support?.overlappingBars
        ? support.divergentBars / support.overlappingBars
        : args.series.length > 1
          ? 1
          : 0;
      const overlapBonus = support?.overlappingBars
        ? Math.min(8, Math.log10(support.overlappingBars + 1) * 3)
        : 0;
      const divergencePenalty = Math.min(35, divergenceRate * 80);
      const priorityIndex = priority.indexOf(row.provider);
      const tieBreaker = priorityIndex < 0 ? 0 : Math.max(0, 0.001 - priorityIndex * 0.0001);
      return {
        ...row,
        selectionScore: rounded(row.quality.qualityScore + overlapBonus - divergencePenalty + tieBreaker, 6),
        divergenceRatePercent: rounded(divergenceRate * 100, 2),
      };
    })
    .sort((left, right) => right.selectionScore - left.selectionScore || right.candles.length - left.candles.length);
}

export function aggregateCandles(args: {
  candles: MarketCandle[];
  sourceIntervalMs: number;
  targetIntervalMs: number;
}) {
  if (args.targetIntervalMs <= args.sourceIntervalMs) return [...args.candles];
  if (args.targetIntervalMs % args.sourceIntervalMs !== 0) throw new Error("kline_aggregate_interval_mismatch");
  const buckets = new Map<number, MarketCandle[]>();
  for (const candle of args.candles) {
    const bucket = Math.floor(candle.timestamp / args.targetIntervalMs) * args.targetIntervalMs;
    const rows = buckets.get(bucket) ?? [];
    rows.push(candle);
    buckets.set(bucket, rows);
  }
  const expectedRows = args.targetIntervalMs / args.sourceIntervalMs;
  return Array.from(buckets.entries())
    .sort(([left], [right]) => left - right)
    .flatMap(([timestamp, rows]) => {
      const sorted = [...rows].sort((left, right) => left.timestamp - right.timestamp);
      if (sorted.length < expectedRows) return [];
      const open = sorted[0].open;
      const close = sorted.at(-1)!.close;
      return [{
        timestamp,
        open,
        high: Math.max(...sorted.map((row) => row.high)),
        low: Math.min(...sorted.map((row) => row.low)),
        close,
        volume: sorted.reduce((sum, row) => sum + row.volume, 0),
        quoteVolume: sorted.some((row) => finite(row.quoteVolume))
          ? sorted.reduce((sum, row) => sum + (finite(row.quoteVolume) ? row.quoteVolume : 0), 0)
          : undefined,
        trades: sorted.some((row) => finite(row.trades))
          ? sorted.reduce((sum, row) => sum + (finite(row.trades) ? row.trades : 0), 0)
          : undefined,
      } satisfies MarketCandle];
    });
}
