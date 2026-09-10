import type {
  Pass4413CrossAssetQuote as Quote,
  Pass4413RealMarketsAsset as Asset,
  Pass4413AssetCategory,
} from "./cross-asset-runtime-normalizers";
import { analyzeTokenRisk } from "./risk-engine";
import type { TokenRiskInput, TokenRiskResult, VelmereMarketAssetClass } from "./risk-types";

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function percentChange(candles: Quote["candles"], seconds: number): number | undefined {
  if (candles.length < 2) return undefined;
  const ordered = [...candles].sort((left, right) => left.timestamp - right.timestamp);
  const latest = ordered.at(-1);
  if (!latest || latest.close <= 0) return undefined;
  const target = latest.timestamp - seconds;
  const reference = [...ordered].reverse().find((candle) => candle.timestamp <= target);
  if (!reference || reference.close <= 0) return undefined;
  return ((latest.close - reference.close) / reference.close) * 100;
}

function averageDailyVolume(candles: Quote["candles"]): number | undefined {
  const rows = candles
    .filter((candle) => finite(candle.volume) !== undefined)
    .sort((left, right) => left.timestamp - right.timestamp);
  if (rows.length < 2) return undefined;
  const first = rows[0];
  const last = rows.at(-1);
  if (!first || !last) return undefined;
  const coveredDays = Math.max(1 / 24, (last.timestamp - first.timestamp) / 86_400);
  const volume = rows.reduce((sum, candle) => sum + (finite(candle.volume) ?? 0), 0);
  return volume > 0 ? volume / coveredDays : undefined;
}

function marketCapFromQuote(quote: Quote): number | undefined {
  const direct = finite(quote.marketCap);
  if (direct !== undefined && direct > 0) return direct;
  const shares = finite(quote.fundamentals?.sharesOutstanding);
  const price = finite(quote.currentPrice);
  return shares !== undefined && shares > 0 && price !== undefined && price > 0
    ? shares * price
    : undefined;
}

function sourceList(quote: Quote): string[] {
  return Array.from(new Set([
    quote.source,
    quote.secondarySource,
    quote.providerKind,
    ...(quote.providerPlan ?? []),
    ...(quote.providerEvidence ?? []).map((row) => row.source),
    quote.venueHealth?.source,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

export function canonicalAssetClass(category: Pass4413AssetCategory, quoteClass?: Quote["assetClass"]): VelmereMarketAssetClass {
  if (quoteClass && quoteClass !== "venue_health") return quoteClass;
  if (category === "stocks") return "stock";
  if (category === "indices") return "index";
  if (category === "fx") return "fx";
  if (category === "etf") return "etf";
  if (category === "commodities") return "commodity";
  if (category === "real_estate") return "real_estate";
  if (category === "exchanges") return "exchange_equity";
  return "crypto";
}

export function buildCanonicalRiskInputFromRealMarkets(
  quote: Quote,
  asset: Asset,
): TokenRiskInput {
  const marketCap = marketCapFromQuote(quote);
  const providerHealthScore = finite(quote.venueHealth?.healthScore);
  const currentPrice = finite(quote.currentPrice);
  const priceChange1h = finite(quote.priceChange1h) ?? percentChange(quote.candles, 3_600);
  const priceChange24h = finite(quote.priceChange24h) ?? finite(quote.changePercent) ?? percentChange(quote.candles, 86_400);
  const priceChange7d = finite(quote.priceChange7d) ?? percentChange(quote.candles, 7 * 86_400);
  const liquidityUsd = quote.venueHealth
    ? Math.max(0, (finite(quote.venueHealth.bidDepthUsd) ?? 0) + (finite(quote.venueHealth.askDepthUsd) ?? 0)) || undefined
    : undefined;

  return {
    marketId: asset.id,
    symbol: quote.symbol || asset.symbol,
    name: asset.name,
    assetClass: canonicalAssetClass(asset.category, quote.assetClass),
    currentPrice,
    marketCap,
    fdv: finite(quote.fdv),
    liquidityUsd,
    volume24h: finite(quote.volume24h) ?? finite(quote.venueHealth?.volume24h),
    averageVolume7d: averageDailyVolume(quote.candles),
    priceChange1h,
    priceChange6h: percentChange(quote.candles, 6 * 3_600),
    priceChange24h,
    priceChange7d,
    priceChange14d: percentChange(quote.candles, 14 * 86_400),
    priceChange30d: percentChange(quote.candles, 30 * 86_400),
    bidAskImbalancePercent: finite(quote.venueHealth?.depthImbalancePercent),
    circulatingSupply: finite(quote.circulatingSupply),
    totalSupply: finite(quote.totalSupply),
    maxSupply: finite(quote.maxSupply),
    providerHealthScore,
    sourceDivergenceBps: finite(quote.divergenceBps) ?? finite(quote.venueComparison?.priceDivergenceBps),
    freshnessSeconds: finite(quote.freshnessSeconds) ?? finite(quote.venueHealth?.freshnessSeconds),
    freshnessState: quote.freshnessState,
    consensusState: quote.consensusState ?? quote.venueComparison?.state,
    dataSources: sourceList(quote),
    sparkline7d: quote.candles
      .map((candle) => candle.close)
      .filter((value) => Number.isFinite(value) && value > 0)
      .slice(-224),
  };
}

export function analyzeCanonicalRealMarketsRisk(
  quote: Quote,
  asset: Asset,
): TokenRiskResult {
  const input = buildCanonicalRiskInputFromRealMarkets(quote, asset);
  const live = quote.state === "live" && quote.truthState !== "provider_error";
  const sourceBound = quote.truthState === "source_bound" && input.dataSources && input.dataSources.length >= 1;
  return analyzeTokenRisk(input, live && sourceBound ? "live" : live ? "partial" : "demo");
}
