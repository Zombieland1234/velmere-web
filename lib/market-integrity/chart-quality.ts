import type { MarketChartPoint, MarketChartRange } from "./coingecko";

export type Pass2444ChartQuality = {
  version: "chart-quality-v1";
  range: MarketChartRange;
  points: number;
  spanDays: number;
  gapCount: number;
  maxGapHours: number;
  continuityScore: number;
  dataDensity: "thin" | "acceptable" | "dense";
  macroReady: boolean;
  missingForAdvanced: string[];
  boundary: string;
};

function expectedSpanDays(range: MarketChartRange) {
  if (range === "1m") return 1;
  if (range === "15m") return 3;
  if (range === "1h") return 14;
  if (range === "4h") return 90;
  if (range === "1d" || range === "1y") return 365;
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  if (range === "2y") return 730;
  if (range === "5y") return 1825;
  return 3650;
}

function expectedStepHours(range: MarketChartRange) {
  if (range === "1m") return 0.25;
  if (range === "15m") return 0.5;
  if (range === "1h") return 2;
  if (range === "4h") return 8;
  if (range === "7d") return 4;
  if (range === "30d") return 12;
  if (range === "90d") return 24;
  if (range === "1d" || range === "1y" || range === "2y") return 48;
  return 24 * 14;
}

export function buildPass2444ChartQuality(points: MarketChartPoint[], range: MarketChartRange): Pass2444ChartQuality {
  const sorted = [...points]
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.price) && point.price > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  const first = sorted[0]?.timestamp ?? 0;
  const last = sorted.at(-1)?.timestamp ?? first;
  const spanDays = first && last ? Math.max(0, (last - first) / 86_400_000) : 0;
  const maxAllowedGapHours = expectedStepHours(range);
  let gapCount = 0;
  let maxGapHours = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const gapHours = (sorted[i].timestamp - sorted[i - 1].timestamp) / 3_600_000;
    if (gapHours > maxGapHours) maxGapHours = gapHours;
    if (gapHours > maxAllowedGapHours) gapCount += 1;
  }
  const expected: number = expectedSpanDays(range);
  const coverage = expected <= 0 ? 0 : Math.min(1, spanDays / expected);
  const pointScore = Math.min(1, sorted.length / (range === "2y" || range === "5y" || range === "max" ? 360 : 180));
  const gapPenalty = Math.min(0.45, gapCount * 0.04);
  const continuityScore = Math.round(Math.max(0, Math.min(1, coverage * 0.45 + pointScore * 0.45 + (1 - gapPenalty) * 0.1)) * 100);
  const dataDensity = sorted.length >= 360 ? "dense" : sorted.length >= 160 ? "acceptable" : "thin";
  const macroReady = ["1y", "2y", "5y", "max"].includes(range) && continuityScore >= 70 && sorted.length >= 240;
  const missingForAdvanced = [
    !macroReady && "macro continuity below Advanced threshold",
    gapCount > 0 && `${gapCount} chart gaps above expected cadence`,
    !sorted.some((point) => Number.isFinite(point.volume)) && "volume timeline",
    !sorted.some((point) => Number.isFinite(point.marketCap)) && "market-cap timeline",
    "second provider overlay for chart diff",
  ].filter(Boolean) as string[];

  return {
    version: "chart-quality-v1",
    range,
    points: sorted.length,
    spanDays: Math.round(spanDays * 10) / 10,
    gapCount,
    maxGapHours: Math.round(maxGapHours * 10) / 10,
    continuityScore,
    dataDensity,
    macroReady,
    missingForAdvanced,
    boundary: "Chart quality measures data coverage only. It is not an investment signal or a price forecast.",
  };
}
