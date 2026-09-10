import { analyzeTokenRisk } from "./risk-engine";
import type { TokenRiskInput, TokenRiskResult } from "./risk-types";

export const marketIntegrityDemoInputs: TokenRiskInput[] = [
  {
    symbol: "OM",
    name: "MANTRA case study",
    chainId: "cex/dex mixed",
    currentPrice: 0.2,
    athPrice: 6.4,
    marketCap: 200_000_000,
    liquidityUsd: 500_000,
    volume24h: 250_000_000,
    averageVolume7d: 20_000_000,
    priceChange24h: -91.4,
    top10HolderPercent: 55,
    hadRebrandAfterCrash: true,
    abnormalExchangeDeposits: true,
    orderBookDepthDropPercent: 74,
    dataSources: ["demo", "case-study"],
  },
  {
    symbol: "LOWLIQ",
    name: "Thin-liquidity token example",
    chainId: "ethereum",
    currentPrice: 0.018,
    marketCap: 45_000_000,
    liquidityUsd: 90_000,
    volume24h: 4_200_000,
    priceChange24h: -22.5,
    buys24h: 240,
    sells24h: 790,
    dataSources: ["demo"],
  },
  {
    symbol: "CORE",
    name: "Healthy liquidity example",
    chainId: "ethereum",
    currentPrice: 1.12,
    athPrice: 1.31,
    marketCap: 120_000_000,
    liquidityUsd: 8_500_000,
    volume24h: 2_100_000,
    priceChange24h: 2.4,
    buys24h: 520,
    sells24h: 505,
    dataSources: ["demo"],
  },
];

export const marketIntegrityDemoResults: TokenRiskResult[] = marketIntegrityDemoInputs.map((input) =>
  analyzeTokenRisk(input, "demo"),
);
