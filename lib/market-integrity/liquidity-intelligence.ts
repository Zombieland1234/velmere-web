import type { TokenRiskResult } from "./risk-types";

export type LiquiditySourceMode = "live_orderbook" | "market_metrics" | "fallback_uncertain";
export type LiquidityReviewPriority = "low" | "watch" | "high" | "critical";

export type LiquidityOrderBookInput = {
  bestBid?: number;
  bestAsk?: number;
  spreadPercent?: number;
  bidDepthUsd?: number;
  askDepthUsd?: number;
  bidAskImbalancePercent?: number;
  simulatedSellSlippage10k?: number;
  simulatedBuySlippage10k?: number;
  riskPoints?: number;
  signals?: Array<{ id: string; label: string; points: number }>;
  bids?: unknown[];
  asks?: unknown[];
  source?: string;
};

export type LiquidityIntelligenceZone = {
  id: string;
  label: string;
  value: string;
  priority: LiquidityReviewPriority;
  explanation: string;
  command: string;
};

export type LiquidityIntelligenceBrief = {
  version: "velmere_liquidity_intelligence_v3_pass62_control_plane";
  symbol: string;
  sourceMode: LiquiditySourceMode;
  reviewPriority: LiquidityReviewPriority;
  liquidityScore: number;
  uncertaintyPercent: number;
  headline: string;
  sourceTruth: string;
  zones: LiquidityIntelligenceZone[];
  depthStress: Array<{ id: string; label: string; value: string; note: string }>;
  missingData: string[];
  analystCommands: string[];
  legalGuardrails: string[];
  generatedAt: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function finite(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatUsdCompact(value?: number) {
  const finiteValue = finite(value);
  if (finiteValue === undefined) return "source required";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(finiteValue) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(finiteValue);
}

function formatPercent(value?: number) {
  const finiteValue = finite(value);
  if (finiteValue === undefined) return "source required";
  const sign = finiteValue > 0 ? "+" : "";
  return `${sign}${finiteValue.toFixed(Math.abs(finiteValue) >= 10 ? 1 : 2)}%`;
}

function priorityFromScore(score: number): LiquidityReviewPriority {
  if (score >= 82) return "critical";
  if (score >= 62) return "high";
  if (score >= 34) return "watch";
  return "low";
}

function priorityText(priority: LiquidityReviewPriority) {
  if (priority === "critical") return "critical review priority";
  if (priority === "high") return "high review priority";
  if (priority === "watch") return "watchlist review priority";
  return "low detected liquidity pressure";
}

export function buildLiquidityIntelligence(
  result: TokenRiskResult,
  orderbook?: LiquidityOrderBookInput | null,
): LiquidityIntelligenceBrief {
  const hasOrderBook = Boolean(orderbook && (orderbook.bids || orderbook.asks || orderbook.bidDepthUsd || orderbook.askDepthUsd || orderbook.bestBid || orderbook.bestAsk));
  const liquidityUsd = finite(result.metrics.liquidityUsd);
  const marketCap = finite(result.metrics.marketCap);
  const volume24h = finite(result.metrics.volume24h);
  const volumeToLiquidity = finite(result.metrics.volumeToLiquidityRatio);
  const liquidityToMarketCap = finite(result.metrics.liquidityToMarketCapPercent);
  const spread = finite(orderbook?.spreadPercent);
  const sellSlippage = finite(orderbook?.simulatedSellSlippage10k ?? result.metrics.simulatedSlippage10k);
  const imbalance = finite(orderbook?.bidAskImbalancePercent ?? result.metrics.bidAskImbalancePercent);
  const bookRisk = finite(orderbook?.riskPoints) ?? 0;

  const sourceMode: LiquiditySourceMode = hasOrderBook
    ? "live_orderbook"
    : liquidityUsd || volume24h || marketCap
      ? "market_metrics"
      : "fallback_uncertain";

  const thinLiquidityPenalty = liquidityUsd === undefined
    ? 18
    : liquidityUsd < 75_000
      ? 32
      : liquidityUsd < 250_000
        ? 21
        : liquidityUsd < 1_000_000
          ? 10
          : 0;
  const volumeStressPenalty = volumeToLiquidity === undefined
    ? 8
    : volumeToLiquidity > 8
      ? 28
      : volumeToLiquidity > 4
        ? 18
        : volumeToLiquidity > 2
          ? 8
          : 0;
  const marketCapDepthPenalty = liquidityToMarketCap === undefined
    ? 8
    : liquidityToMarketCap < 0.15
      ? 24
      : liquidityToMarketCap < 0.45
        ? 14
        : liquidityToMarketCap < 1
          ? 6
          : 0;
  const slippagePenalty = sellSlippage === undefined
    ? 6
    : sellSlippage > 14
      ? 25
      : sellSlippage > 8
        ? 16
        : sellSlippage > 3
          ? 7
          : 0;
  const imbalancePenalty = imbalance === undefined
    ? 4
    : Math.abs(imbalance) > 65
      ? 18
      : Math.abs(imbalance) > 42
        ? 10
        : 0;
  const spreadPenalty = spread === undefined
    ? 4
    : spread > 2
      ? 18
      : spread > 0.75
        ? 9
        : 0;
  const fallbackPenalty = sourceMode === "fallback_uncertain" ? 22 : sourceMode === "market_metrics" ? 10 : 0;

  const liquidityScore = Math.round(clamp(
    thinLiquidityPenalty + volumeStressPenalty + marketCapDepthPenalty + slippagePenalty + imbalancePenalty + spreadPenalty + bookRisk * 0.42 + fallbackPenalty,
  ));
  const reviewPriority = priorityFromScore(liquidityScore);
  const uncertaintyPercent = Math.round(clamp(
    (sourceMode === "live_orderbook" ? 18 : sourceMode === "market_metrics" ? 42 : 74) +
      (sellSlippage === undefined ? 8 : 0) +
      (liquidityUsd === undefined ? 8 : 0) +
      (volumeToLiquidity === undefined ? 6 : 0),
  ));

  const zones: LiquidityIntelligenceZone[] = [
    {
      id: "visible-depth",
      label: "Visible depth",
      value: hasOrderBook
        ? `${formatUsdCompact(orderbook?.bidDepthUsd)} bid / ${formatUsdCompact(orderbook?.askDepthUsd)} ask`
        : formatUsdCompact(liquidityUsd),
      priority: hasOrderBook && ((orderbook?.bidDepthUsd ?? 0) + (orderbook?.askDepthUsd ?? 0)) < 250_000 ? "high" : liquidityUsd && liquidityUsd < 250_000 ? "watch" : "low",
      explanation: "Visible depth shows how much market pressure can be absorbed before the chart becomes unreliable.",
      command: "/liquidity.depth compare bid-depth ask-depth spread",
    },
    {
      id: "slippage-simulation",
      label: "$10k slippage simulation",
      value: formatPercent(sellSlippage),
      priority: sellSlippage === undefined ? "watch" : priorityFromScore(sellSlippage * 6),
      explanation: "High simulated slippage means a normal-sized sell can move execution away from the shown price.",
      command: "/liquidity.slippage simulate 10k sell buy",
    },
    {
      id: "volume-pressure",
      label: "Volume pressure",
      value: volumeToLiquidity === undefined ? "source required" : `${volumeToLiquidity.toFixed(2)}x volume/liquidity`,
      priority: volumeStressPenalty >= 18 ? "high" : volumeStressPenalty >= 8 ? "watch" : "low",
      explanation: "Volume that is too large compared with liquidity can indicate fragile execution conditions or noisy prints.",
      command: "/liquidity.volume compare 24h-volume liquidity market-cap",
    },
    {
      id: "book-imbalance",
      label: "Bid/ask imbalance",
      value: formatPercent(imbalance),
      priority: imbalance === undefined ? "watch" : priorityFromScore(Math.abs(imbalance) * 1.25),
      explanation: "Imbalance is a microstructure anomaly signal, not proof of intent or manipulation.",
      command: "/orderbook.imbalance replay depth snapshots",
    },
  ];

  const depthStress = [
    {
      id: "spread",
      label: "Spread",
      value: formatPercent(spread),
      note: spread === undefined ? "Spread unavailable; keep uncertainty visible." : "Compare with volatility before escalating.",
    },
    {
      id: "sell-impact",
      label: "Sell impact",
      value: formatPercent(sellSlippage),
      note: "Uses visible depth only; hidden liquidity and CEX routing may change outcome.",
    },
    {
      id: "market-depth-ratio",
      label: "Liquidity / market cap",
      value: formatPercent(liquidityToMarketCap),
      note: "Low ratio can make the chart look stronger than executable depth.",
    },
  ];

  const missingData = [
    !hasOrderBook ? "multi-exchange order book snapshots" : null,
    sellSlippage === undefined ? "standardized $10k/$50k slippage simulations" : null,
    !result.token.pairAddress ? "DEX pool address and LP event history" : null,
    !result.token.chainId ? "chain id for pool and wallet routing" : null,
    result.dataQuality !== "live" ? "source freshness metadata and stable live data contract" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    version: "velmere_liquidity_intelligence_v3_pass62_control_plane",
    symbol: result.token.symbol,
    sourceMode,
    reviewPriority,
    liquidityScore,
    uncertaintyPercent,
    headline: `${result.token.symbol} liquidity is ${priorityText(reviewPriority)} under current data quality.`,
    sourceTruth: sourceMode === "live_orderbook"
      ? `Live depth layer is available from ${orderbook?.source ?? "order book source"}, but it still needs exchange/pool cross-checking.`
      : sourceMode === "market_metrics"
        ? "No live depth snapshot is available; Shield uses market metrics and keeps uncertainty elevated."
        : "Liquidity data is too incomplete for strong conclusions; the terminal must stay in manual-review mode.",
    zones,
    depthStress,
    missingData,
    analystCommands: [
      "/liquidity.depth open heatmap",
      "/liquidity.slippage simulate 10k sell",
      "/pool.events request lp-add lp-remove",
      "/source.freshness verify orderbook candles holders",
    ],
    legalGuardrails: [
      "Liquidity warnings are anomaly flags only, not investment advice.",
      "Thin depth does not prove manipulation or fraud.",
      "Missing depth data increases uncertainty and must not be hidden by premium UI.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
