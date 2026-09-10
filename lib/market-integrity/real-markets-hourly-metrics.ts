export type RealMarketsHourlyMetricCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type RealMarketsHourlyMetricName =
  | "priceChange1h"
  | "priceChange24h"
  | "priceChange7d"
  | "volume24h";

export type RealMarketsHourlyMetricReceipt = {
  schemaVersion: "real_markets_hourly_metrics_v1";
  status: "source_bound" | "insufficient_evidence";
  reason:
    | "source_missing"
    | "source_not_eligible"
    | "hourly_candles_missing"
    | "hourly_cadence_unproven"
    | "future_timestamp"
    | null;
  source: string | null;
  upstreamSourceTimestamp: number | null;
  sourceTimestamp: number | null;
  freshnessSeconds: number | null;
  freshnessState: "fresh" | "aging" | "stale" | "missing";
  candleCount: number;
  hourlyCadenceRatio: number | null;
  medianIntervalSeconds: number | null;
  coverageStartTimestamp: number | null;
  coverageEndTimestamp: number | null;
  referenceTimestamps: {
    priceChange1h: number | null;
    priceChange24h: number | null;
    priceChange7d: number | null;
    volume24hBoundary: number | null;
  };
  availableMetrics: RealMarketsHourlyMetricName[];
  missingMetrics: RealMarketsHourlyMetricName[];
  rule: string;
};

export type RealMarketsHourlyMetrics = {
  priceChange1h: number | null;
  priceChange24h: number | null;
  priceChange7d: number | null;
  volume24h: number | null;
  receipt: RealMarketsHourlyMetricReceipt;
};

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const WEEK_SECONDS = 7 * DAY_SECONDS;
// A seven-calendar-day anchor can fall on a weekend or exchange holiday. Use
// the nearest completed session within three days and expose its exact timestamp
// in the receipt instead of dropping a truthful 7D move.
const WEEK_REFERENCE_TOLERANCE_SECONDS = 3 * DAY_SECONDS;
const MAX_FUTURE_SKEW_SECONDS = 5 * 60;
const SOURCE_REJECTION_PATTERN = /(?:^|\b)(?:mock|fixture|synthetic|demo)(?:\b|$)/i;
const ALL_METRICS: RealMarketsHourlyMetricName[] = [
  "priceChange1h",
  "priceChange24h",
  "priceChange7d",
  "volume24h",
];

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function finiteProviderTimestamp(value: unknown): value is number {
  return finitePositive(value) && value < 100_000_000_000;
}

function normalizeCandle(
  candle: RealMarketsHourlyMetricCandle,
): RealMarketsHourlyMetricCandle | null {
  if (
    !finiteProviderTimestamp(candle.timestamp) ||
    !finitePositive(candle.open) ||
    !finitePositive(candle.high) ||
    !finitePositive(candle.low) ||
    !finitePositive(candle.close) ||
    candle.high < candle.low
  ) {
    return null;
  }
  const priceTolerance = Math.max(candle.high, candle.low) * 1e-9;
  if (
    candle.open > candle.high + priceTolerance ||
    candle.open < candle.low - priceTolerance ||
    candle.close > candle.high + priceTolerance ||
    candle.close < candle.low - priceTolerance
  ) {
    return null;
  }
  if (
    candle.volume !== null &&
    (typeof candle.volume !== "number" ||
      !Number.isFinite(candle.volume) ||
      candle.volume < 0)
  ) {
    return null;
  }
  return {
    ...candle,
    timestamp: Math.floor(candle.timestamp),
  };
}

function normalizedCandles(
  candles: readonly RealMarketsHourlyMetricCandle[],
) {
  const byTimestamp = new Map<number, RealMarketsHourlyMetricCandle>();
  for (const candidate of candles) {
    const candle = normalizeCandle(candidate);
    if (candle) byTimestamp.set(candle.timestamp, candle);
  }
  return Array.from(byTimestamp.values()).sort(
    (left, right) => left.timestamp - right.timestamp,
  );
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function freshnessState(ageSeconds: number | null) {
  if (ageSeconds === null) return "missing" as const;
  if (ageSeconds <= 2 * HOUR_SECONDS) return "fresh" as const;
  if (ageSeconds <= DAY_SECONDS) return "aging" as const;
  return "stale" as const;
}

function closestReference(
  candles: RealMarketsHourlyMetricCandle[],
  targetTimestamp: number,
  toleranceSeconds: number,
) {
  let closest: RealMarketsHourlyMetricCandle | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const candle of candles) {
    const distance = Math.abs(candle.timestamp - targetTimestamp);
    if (distance < closestDistance) {
      closest = candle;
      closestDistance = distance;
    }
  }
  return closest && closestDistance <= toleranceSeconds ? closest : null;
}

function percentChange(
  latest: RealMarketsHourlyMetricCandle,
  reference: RealMarketsHourlyMetricCandle | null,
) {
  if (!reference || !finitePositive(reference.close)) return null;
  const value = ((latest.close - reference.close) / reference.close) * 100;
  return Number.isFinite(value) ? value : null;
}

function emptyResult(
  receipt: Omit<
    RealMarketsHourlyMetricReceipt,
    | "schemaVersion"
    | "availableMetrics"
    | "missingMetrics"
    | "referenceTimestamps"
    | "rule"
  >,
): RealMarketsHourlyMetrics {
  return {
    priceChange1h: null,
    priceChange24h: null,
    priceChange7d: null,
    volume24h: null,
    receipt: {
      schemaVersion: "real_markets_hourly_metrics_v1",
      ...receipt,
      referenceTimestamps: {
        priceChange1h: null,
        priceChange24h: null,
        priceChange7d: null,
        volume24hBoundary: null,
      },
      availableMetrics: [],
      missingMetrics: [...ALL_METRICS],
      rule:
        "Metrics are emitted only from validated, timestamped hourly provider candles. Missing cadence, horizon references or volumes remain null; no metadata or synthetic fallback is substituted.",
    },
  };
}

export function deriveRealMarketsHourlyMetrics(input: {
  candles: readonly RealMarketsHourlyMetricCandle[];
  source?: string | null;
  sourceTimestamp?: number | null;
  nowSeconds?: number;
}): RealMarketsHourlyMetrics {
  const source = input.source?.trim() || null;
  const nowSeconds = finiteProviderTimestamp(input.nowSeconds)
    ? Math.floor(input.nowSeconds)
    : Math.floor(Date.now() / 1000);
  const upstreamSourceTimestamp = finiteProviderTimestamp(input.sourceTimestamp)
    ? Math.floor(input.sourceTimestamp)
    : null;
  const candles = normalizedCandles(input.candles);
  const coverageLatest = candles.at(-1) ?? null;
  const deltas = candles
    .slice(1)
    .map((candle, index) => candle.timestamp - candles[index].timestamp)
    .filter((delta) => Number.isFinite(delta) && delta > 0);
  const hourlyDeltas = deltas.filter(
    (delta) => delta >= 50 * 60 && delta <= 70 * 60,
  );
  const hourlyCadenceRatio = deltas.length
    ? hourlyDeltas.length / deltas.length
    : null;
  const medianIntervalSeconds = median(deltas);
  let latestHourlyAnchor: RealMarketsHourlyMetricCandle | null = null;
  for (let index = candles.length - 1; index > 0; index -= 1) {
    const delta = candles[index].timestamp - candles[index - 1].timestamp;
    if (delta >= 50 * 60 && delta <= 70 * 60) {
      latestHourlyAnchor = candles[index];
      break;
    }
  }
  const latest = latestHourlyAnchor ?? coverageLatest;
  const latestTimestamp = latest?.timestamp ?? null;
  const freshnessSeconds =
    latestTimestamp === null ? null : Math.max(0, nowSeconds - latestTimestamp);
  const baseReceipt = {
    source,
    upstreamSourceTimestamp,
    sourceTimestamp: latestTimestamp,
    freshnessSeconds,
    freshnessState: freshnessState(freshnessSeconds),
    candleCount: candles.length,
    hourlyCadenceRatio,
    medianIntervalSeconds,
    coverageStartTimestamp: candles.at(0)?.timestamp ?? null,
    coverageEndTimestamp: coverageLatest?.timestamp ?? null,
  };

  if (!source) {
    return emptyResult({
      ...baseReceipt,
      status: "insufficient_evidence",
      reason: "source_missing",
    });
  }
  if (SOURCE_REJECTION_PATTERN.test(source)) {
    return emptyResult({
      ...baseReceipt,
      status: "insufficient_evidence",
      reason: "source_not_eligible",
    });
  }
  if (!latest || candles.length < 2) {
    return emptyResult({
      ...baseReceipt,
      status: "insufficient_evidence",
      reason: "hourly_candles_missing",
    });
  }
  if (
    coverageLatest &&
    coverageLatest.timestamp > nowSeconds + MAX_FUTURE_SKEW_SECONDS
  ) {
    return emptyResult({
      ...baseReceipt,
      status: "insufficient_evidence",
      reason: "future_timestamp",
    });
  }
  if (
    hourlyDeltas.length === 0 ||
    hourlyCadenceRatio === null ||
    hourlyCadenceRatio < 0.5
  ) {
    return emptyResult({
      ...baseReceipt,
      status: "insufficient_evidence",
      reason: "hourly_cadence_unproven",
    });
  }

  const oneHourReference = closestReference(
    candles,
    latest.timestamp - HOUR_SECONDS,
    20 * 60,
  );
  const oneDayReference = closestReference(
    candles,
    latest.timestamp - DAY_SECONDS,
    90 * 60,
  );
  const oneWeekReference = closestReference(
    candles,
    latest.timestamp - WEEK_SECONDS,
    WEEK_REFERENCE_TOLERANCE_SECONDS,
  );
  const priceChange1h = percentChange(latest, oneHourReference);
  const priceChange24h = percentChange(latest, oneDayReference);
  const priceChange7d = percentChange(latest, oneWeekReference);
  const volumeWindow = candles.filter(
    (candle) =>
      candle.timestamp > latest.timestamp - DAY_SECONDS &&
      candle.timestamp <= latest.timestamp,
  );
  const volume24h =
    oneDayReference &&
    volumeWindow.length > 0 &&
    volumeWindow.every(
      (candle) =>
        typeof candle.volume === "number" &&
        Number.isFinite(candle.volume) &&
        candle.volume >= 0,
    )
      ? volumeWindow.reduce((sum, candle) => sum + (candle.volume as number), 0)
      : null;
  const boundedVolume24h =
    typeof volume24h === "number" && Number.isFinite(volume24h) && volume24h > 0
      ? volume24h
      : null;
  const values: Record<RealMarketsHourlyMetricName, number | null> = {
    priceChange1h,
    priceChange24h,
    priceChange7d,
    volume24h: boundedVolume24h,
  };
  const availableMetrics = ALL_METRICS.filter(
    (metric) => typeof values[metric] === "number" && Number.isFinite(values[metric]),
  );

  return {
    ...values,
    receipt: {
      schemaVersion: "real_markets_hourly_metrics_v1",
      status: "source_bound",
      reason: null,
      ...baseReceipt,
      referenceTimestamps: {
        priceChange1h: oneHourReference?.timestamp ?? null,
        priceChange24h: oneDayReference?.timestamp ?? null,
        priceChange7d: oneWeekReference?.timestamp ?? null,
        volume24hBoundary: oneDayReference?.timestamp ?? null,
      },
      availableMetrics,
      missingMetrics: ALL_METRICS.filter(
        (metric) => !availableMetrics.includes(metric),
      ),
      rule:
        "Metrics are emitted only from validated, timestamped hourly provider candles. Missing cadence, horizon references or volumes remain null; no metadata or synthetic fallback is substituted.",
    },
  };
}
