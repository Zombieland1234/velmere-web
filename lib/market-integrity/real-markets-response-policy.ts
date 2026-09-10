import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { VelmereReportAssetFamily } from "@/lib/market-integrity/report-asset-family";
import { rangeConfig } from "@/lib/market-integrity/real-markets-catalog";

export function tierFromRealMarketsRequest(value: string | null): VelmereTier {
  const normalized = (value ?? "Basic").toLowerCase();
  if (normalized === "advanced") return "Advanced";
  if (normalized === "pro") return "Pro";
  return "Basic";
}

export function pass2813RealMarketFamilyForSymbol(symbol: string): VelmereReportAssetFamily {
  const normalized = symbol.toUpperCase();
  if (normalized.includes("=X") || normalized.includes("/")) return "fx";
  if (normalized.endsWith("=F") || ["GC", "SI", "CL", "BZ", "NG", "HG", "ZW"].includes(normalized)) return "commodity";
  if (["SPY", "QQQ", "TLT", "HYG", "EFA", "GLD", "VNQ", "IYR", "XLRE", "VOO", "VTI", "DIA", "IWM"].includes(normalized)) return "etf";
  if (normalized.includes("REIT") || ["PLD", "O", "AMT", "DLR", "EQIX", "WELL", "VICI"].includes(normalized)) return "real_estate";
  if (normalized.endsWith("-USD") || ["BINANCE", "MEXC", "OKX", "BYBIT", "KRAKEN"].includes(normalized)) return "exchange_health";
  return "equity";
}

export function buildPass2808ChartReceipt(quote: { candles?: Array<{ close?: number }>; source?: string | null; sourceTimestamp?: number | null; confidenceCap?: number | null }, rangeKey: keyof typeof rangeConfig) {
  const candleCount = (quote.candles ?? []).filter((candle) => typeof candle.close === "number" && Number.isFinite(candle.close)).length;
  const source = quote.source || "Velmère source registry pending";
  return {
    schemaVersion: "pass2808_chart_receipt_v1" as const,
    status: candleCount >= 2 ? "source_bound" as const : "skeleton_required" as const,
    range: rangeKey,
    candleCount,
    source,
    sourceTimestamp: quote.sourceTimestamp ?? null,
    confidence: typeof quote.confidenceCap === "number" ? quote.confidenceCap : candleCount >= 2 ? 58 : 25,
    rule: "UI/PDF chart parity gate: chart can look live only when source candles are attached; otherwise render neutral skeleton and missing evidence.",
  };
}
