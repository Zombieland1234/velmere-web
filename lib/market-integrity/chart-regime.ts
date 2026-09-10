import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";

export type ChartRegimeInput = {
  bars?: number;
  rangePercent?: number;
  source?: string;
  hasOrderBook?: boolean;
};

export type ChartRegime = {
  version: "chart_regime_v2_pass56";
  regime:
    | "dense_terminal"
    | "thin_feed"
    | "volatile_breakout"
    | "high_drawdown"
    | "compressed_range"
    | "liquidity_uncertain";
  score: number;
  confidence: number;
  density: "poor" | "usable" | "terminal";
  headline: string;
  narrative: string;
  checks: Array<{ id: string; label: string; status: "clear" | "watch" | "warning"; value: string }>;
  nextActions: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function pct(value?: number) {
  if (value === undefined || value === null || !Number.isFinite(value)) return "source required";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
}

export function buildChartRegime(result: TokenRiskResult, input: ChartRegimeInput = {}): ChartRegime {
  const bars = input.bars ?? 0;
  const change24h = result.metrics.priceChange24h ?? 0;
  const change7d = result.metrics.priceChange7d ?? 0;
  const volumeRatio = result.metrics.volumeToMarketCapRatio ?? 0;
  const rangePercent = input.rangePercent ?? Math.max(Math.abs(change24h), Math.abs(change7d) / 2);
  const sparseSourcePenalty = input.source?.toLowerCase().includes("fallback") ? 10 : 0;
  const dataQualityPenalty = bars < 45 ? 30 : bars < 96 ? 14 : sparseSourcePenalty;
  const volatilityPressure = clamp(Math.abs(change24h) * 2.2 + Math.abs(change7d) * 0.8 + volumeRatio * 180, 0, 70);
  const liquidityPenalty = input.hasOrderBook ? 0 : 10;
  const score = Math.round(clamp(volatilityPressure + dataQualityPenalty + liquidityPenalty, 0, 100));
  const density: ChartRegime["density"] = bars >= 120 ? "terminal" : bars >= 64 ? "usable" : "poor";

  let regime: ChartRegime["regime"] = "dense_terminal";
  if (bars > 0 && bars < 45) regime = "thin_feed";
  else if (!input.hasOrderBook) regime = "liquidity_uncertain";
  else if (change24h <= -8 || change7d <= -18) regime = "high_drawdown";
  else if (Math.abs(change24h) >= 8 || volumeRatio >= 0.08) regime = "volatile_breakout";
  else if (rangePercent < 1.2) regime = "compressed_range";

  const headlineByRegime: Record<ChartRegime["regime"], string> = {
    dense_terminal: "Chart feed is dense enough for terminal-style review.",
    thin_feed: "Chart feed is too thin; treat candle interpretation as uncertain.",
    volatile_breakout: "Price/volume regime suggests elevated momentum review.",
    high_drawdown: "Drawdown regime requires liquidity and holder exit checks.",
    compressed_range: "Compressed range; watch for liquidity gaps before breakout.",
    liquidity_uncertain: "Chart exists, but order book context is incomplete.",
  };

  const checks: ChartRegime["checks"] = [
    {
      id: "bar_density",
      label: "Candle density",
      status: bars >= 120 ? "clear" : bars >= 64 ? "watch" : "warning",
      value: `${bars || "source required"} bars`,
    },
    {
      id: "range_pressure",
      label: "Range pressure",
      status: rangePercent >= 8 ? "warning" : rangePercent >= 2.5 ? "watch" : "clear",
      value: pct(rangePercent),
    },
    {
      id: "volume_pressure",
      label: "Volume / market cap",
      status: volumeRatio >= 0.12 ? "warning" : volumeRatio >= 0.04 ? "watch" : "clear",
      value: pct(volumeRatio * 100),
    },
    {
      id: "orderbook_context",
      label: "Order book context",
      status: input.hasOrderBook ? "clear" : "watch",
      value: input.hasOrderBook ? "available" : "missing / unsupported pair",
    },
  ];

  const nextActions = [
    density === "poor" ? "Use range-aware fallback candles and avoid over-reading sparse bars." : "Use candle structure with VWAP, POC and volume profile.",
    input.hasOrderBook ? "Compare candle impulse with bid/ask depth." : "Do not mark low risk until depth source is attached.",
    "Check holder pressure against liquidity zones before any verdict.",
  ];

  return {
    version: "chart_regime_v2_pass56",
    regime,
    score,
    confidence: clamp(0.72 - dataQualityPenalty / 100 - (input.hasOrderBook ? 0 : 0.08), 0.25, 0.92),
    density,
    headline: headlineByRegime[regime],
    narrative: `Bars=${bars || "source required"}, 24h=${pct(change24h)}, 7d=${pct(change7d)}, source=${input.source ?? "mixed"}. Shield treats chart analysis as a risk signal, not a price prediction.`,
    checks,
    nextActions,
  };
}
