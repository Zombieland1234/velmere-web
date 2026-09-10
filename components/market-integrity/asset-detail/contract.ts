export type VlmAssetDetailCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

export type VlmAssetDetailMetricTone =
  | "positive"
  | "warning"
  | "danger"
  | "neutral"
  | "evidence";

export type VlmAssetDetailMetric = {
  label: string;
  value: string;
  caption?: string | null;
  tone?: VlmAssetDetailMetricTone;
};

export type VlmAssetDetailModalData = {
  symbol: string;
  name: string;
  analysisSurface?: "shield-pro";
  providerSymbol?: string;
  imageUrl?: string;
  assetClass?: "crypto" | "exchange_token" | "stock" | "etf" | "fx" | "commodity" | "real_estate" | "index" | "exchange" | "market";
  venue?: string;
  assetClassLabel?: string;
  exchangeLabel?: string | null;
  priceLabel: string;
  changeLabel?: string | null;
  changeTone?: "up" | "down" | "neutral";
  sourceLabel?: string | null;
  sourceVerified?: boolean;
  sourceTimeLabel?: string | null;
  currencyLabel?: string | null;
  marketStatusLabel?: string | null;
  confidenceLabel?: string | null;
  confidenceCalibrated?: boolean;
  riskLabel?: string | null;
  candles?: VlmAssetDetailCandle[];
  sparkline?: number[];
  detailMetrics?: VlmAssetDetailMetric[];
  evidenceNotes?: string[];
  marketDataState?:
    | "live_verified"
    | "partial_not_live"
    | "last_known_good"
    | "local_reference"
    | "unverified";
};
