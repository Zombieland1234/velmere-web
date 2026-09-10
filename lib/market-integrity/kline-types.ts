export type BinanceKlineInterval = "1m" | "15m" | "1h" | "4h" | "1d" | "7d" | "1mo";

export type MarketCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume?: number;
  trades?: number;
};
