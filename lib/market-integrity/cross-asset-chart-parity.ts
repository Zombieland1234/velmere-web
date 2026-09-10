import type { Pass619ProviderLineage } from "@/lib/market-integrity/real-markets-provider-lineage";

export type Pass620ChartAssetClass =
  | "stock"
  | "index"
  | "fx"
  | "etf"
  | "commodity"
  | "real_estate"
  | "exchange";

export type Pass620CrossAssetChartParity = {
  version: "cross-asset-chart-parity";
  assetClass: Pass620ChartAssetClass;
  renderMode: "candles" | "line" | "evidence-placeholder";
  interactive: boolean;
  crosshair: boolean;
  panZoom: boolean;
  sourceRail: true;
  timestampVisible: true;
  confidenceVisible: true;
  volumeMode: "native" | "proxy" | "not-applicable";
  marketCapMode: "native" | "level" | "not-applicable" | "source-required";
  minimumCandles: 2;
  reason: string;
};

function normalizeClass(value: string): Pass620ChartAssetClass {
  const clean = value.toLowerCase();
  if (clean === "stocks" || clean === "exchange_equity") return "stock";
  if (clean === "indices") return "index";
  if (clean === "commodities") return "commodity";
  if (clean === "exchanges" || clean === "venue_health") return "exchange";
  if (clean === "real_estate") return "real_estate";
  if (clean === "etf") return "etf";
  return "fx";
}

export function buildPass620CrossAssetChartParity(input: {
  assetClass: string;
  candleCount: number;
  lineage: Pass619ProviderLineage;
}): Pass620CrossAssetChartParity {
  const assetClass = normalizeClass(input.assetClass);
  const enoughCandles = input.candleCount >= 2;
  const interactive = enoughCandles && input.lineage.chartReady;
  const renderMode = interactive
    ? "candles"
    : input.lineage.hasExecutablePrice
      ? "line"
      : "evidence-placeholder";
  const volumeMode = assetClass === "fx" || assetClass === "index"
    ? "not-applicable"
    : assetClass === "commodity" || assetClass === "real_estate"
      ? "proxy"
      : "native";
  const marketCapMode = assetClass === "stock" || assetClass === "etf" || assetClass === "real_estate"
    ? "native"
    : assetClass === "index"
      ? "level"
      : assetClass === "fx" || assetClass === "commodity"
        ? "not-applicable"
        : "source-required";

  return {
    version: "cross-asset-chart-parity",
    assetClass,
    renderMode,
    interactive,
    crosshair: interactive,
    panZoom: interactive,
    sourceRail: true,
    timestampVisible: true,
    confidenceVisible: true,
    volumeMode,
    marketCapMode,
    minimumCandles: 2,
    reason: interactive
      ? "Source-bound candles unlock the same crosshair, pan, zoom and evidence rail used by Shield."
      : input.lineage.hasExecutablePrice
        ? "A source-bound price exists, but candle history is insufficient for an interactive chart."
        : "The chart remains an evidence placeholder until provider timestamp and market observations are available.",
  };
}
