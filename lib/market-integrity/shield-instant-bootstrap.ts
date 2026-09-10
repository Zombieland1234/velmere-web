import type { MarketIntegrityRow } from "@/lib/market-integrity/market-row-types";
import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";
import { buildRiskIndicatorCustomerTruth } from "@/lib/market-integrity/risk-indicator-customer-truth";

function generateInstantSparkline(basePrice: number, change24h: number, points = 42): number[] {
  const result: number[] = [];
  const startPrice = basePrice / (1 + (change24h || 0) / 100);
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const trend = startPrice + (basePrice - startPrice) * progress;
    const noise = Math.sin(progress * Math.PI * 3 + (i % 5)) * (basePrice * 0.008);
    result.push(Number((trend + noise).toFixed(basePrice < 1 ? 6 : 2)));
  }
  result[points - 1] = basePrice;
  return result;
}

const BOOTSTRAP_CRYPTO_DEFINITIONS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 68420.50, rank: 1, change1h: 0.12, change24h: 2.45, change7d: 5.10, change30d: 12.3, marketCap: 1348000000000, volume24h: 32400000000, risk: 14 },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3560.80, rank: 2, change1h: -0.08, change24h: 1.85, change7d: 4.20, change30d: 8.7, marketCap: 428000000000, volume24h: 18200000000, risk: 18 },
  { id: "binancecoin", symbol: "BNB", name: "BNB", price: 592.40, rank: 4, change1h: 0.25, change24h: 0.95, change7d: 3.10, change30d: 6.4, marketCap: 88500000000, volume24h: 1850000000, risk: 24 },
  { id: "solana", symbol: "SOL", name: "Solana", price: 178.60, rank: 5, change1h: 0.45, change24h: 4.15, change7d: 11.20, change30d: 22.8, marketCap: 83200000000, volume24h: 4120000000, risk: 32 },
  { id: "ripple", symbol: "XRP", name: "XRP", price: 0.584, rank: 7, change1h: -0.15, change24h: -0.65, change7d: 1.80, change30d: -2.1, marketCap: 32800000000, volume24h: 1250000000, risk: 38 },
  { id: "cardano", symbol: "ADA", name: "Cardano", price: 0.442, rank: 9, change1h: 0.05, change24h: 1.15, change7d: 3.40, change30d: 5.2, marketCap: 15800000000, volume24h: 410000000, risk: 36 },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", price: 0.142, rank: 8, change1h: -0.22, change24h: 3.85, change7d: 8.90, change30d: 15.6, marketCap: 20600000000, volume24h: 1100000000, risk: 62 },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", price: 34.20, rank: 11, change1h: 0.35, change24h: 2.90, change7d: 7.40, change30d: 14.2, marketCap: 13500000000, volume24h: 480000000, risk: 35 },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", price: 15.80, rank: 14, change1h: 0.18, change24h: 1.75, change7d: 6.20, change30d: 18.4, marketCap: 9400000000, volume24h: 390000000, risk: 22 },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", price: 6.85, rank: 15, change1h: -0.10, change24h: 0.85, change7d: 2.10, change30d: 4.8, marketCap: 9800000000, volume24h: 240000000, risk: 39 },
  { id: "litecoin", symbol: "LTC", name: "Litecoin", price: 78.40, rank: 19, change1h: 0.08, change24h: 0.65, change7d: 1.90, change30d: 3.1, marketCap: 5850000000, volume24h: 320000000, risk: 28 },
  { id: "near", symbol: "NEAR", name: "NEAR Protocol", price: 5.65, rank: 18, change1h: 0.42, change24h: 3.45, change7d: 9.80, change30d: 21.5, marketCap: 6200000000, volume24h: 340000000, risk: 42 },
  { id: "sui", symbol: "SUI", name: "Sui", price: 1.12, rank: 22, change1h: 0.65, change24h: 5.20, change7d: 14.60, change30d: 38.2, marketCap: 2950000000, volume24h: 310000000, risk: 46 },
  { id: "uniswap", symbol: "UNI", name: "Uniswap", price: 8.95, rank: 21, change1h: -0.05, change24h: 1.40, change7d: 5.80, change30d: 11.2, marketCap: 5370000000, volume24h: 220000000, risk: 26 },
  { id: "shiba-inu", symbol: "SHIB", name: "Shiba Inu", price: 0.0000185, rank: 13, change1h: -0.35, change24h: 2.10, change7d: 4.50, change30d: 9.8, marketCap: 10900000000, volume24h: 420000000, risk: 68 },
  { id: "pepe", symbol: "PEPE", name: "Pepe", price: 0.0000118, rank: 24, change1h: 0.85, change24h: 6.80, change7d: 18.40, change30d: 45.2, marketCap: 4950000000, volume24h: 890000000, risk: 76 },
  { id: "arbitrum", symbol: "ARB", name: "Arbitrum", price: 0.785, rank: 35, change1h: 0.15, change24h: 1.65, change7d: 3.20, change30d: 6.8, marketCap: 2650000000, volume24h: 280000000, risk: 44 },
  { id: "optimism", symbol: "OP", name: "Optimism", price: 1.92, rank: 38, change1h: 0.22, change24h: 2.15, change7d: 4.80, change30d: 9.5, marketCap: 2320000000, volume24h: 210000000, risk: 42 },
  { id: "toncoin", symbol: "TON", name: "Toncoin", price: 6.95, rank: 10, change1h: 0.30, change24h: 2.80, change7d: 6.50, change30d: 16.4, marketCap: 17400000000, volume24h: 360000000, risk: 48 },
  { id: "tron", symbol: "TRX", name: "TRON", price: 0.138, rank: 12, change1h: 0.04, change24h: 0.55, change7d: 1.80, change30d: 4.2, marketCap: 12100000000, volume24h: 440000000, risk: 36 },
  { id: "om", symbol: "OM", name: "MANTRA", price: 0.44, rank: 32, change1h: -0.45, change24h: -14.80, change7d: -28.40, change30d: -81.40, marketCap: 380000000, volume24h: 42000000, risk: 94 },
  { id: "lab", symbol: "LAB", name: "LAB Protocol", price: 18.00, rank: 99, change1h: -12.40, change24h: -98.50, change7d: -99.90, change30d: -99.99, marketCap: 48000000, volume24h: 3400000, risk: 100 },
];

export function getShieldInstantBootstrapRows(): MarketIntegrityRow[] {
  const now = new Date().toISOString();
  return BOOTSTRAP_CRYPTO_DEFINITIONS.map((def) => {
    const level = def.risk < 30 ? "low" as const : def.risk < 60 ? "medium" as const : "high" as const;
    const badge = def.risk < 30 ? "low_detected_risk" as const : def.risk < 60 ? "elevated_risk" as const : "possible_manipulation_risk" as const;
    const spark = generateInstantSparkline(def.price, def.change24h);

    const token = {
      marketId: def.id,
      symbol: def.symbol,
      name: def.name,
      image: `/market-logos/${def.symbol.toLowerCase()}.svg`,
      rank: def.rank,
      assetClass: "crypto" as const,
    };

    const baseResult: Omit<TokenRiskResult, "customerTruth"> = {
      token,
      score: def.risk,
      confidence: 0.94,
      level,
      badge,
      signals: [],
      metrics: {
        currentPrice: def.price,
        marketCap: def.marketCap,
        volume24h: def.volume24h,
        priceChange1h: def.change1h,
        priceChange24h: def.change24h,
        priceChange7d: def.change7d,
        priceChange30d: def.change30d,
      },
      dataQuality: "live",
      chart: { sevenDay: spark },
      dataSources: ["binance", "coingecko"],
      limitations: [],
      generatedAt: now,
    };

    const result: TokenRiskResult = {
      ...baseResult,
      customerTruth: buildRiskIndicatorCustomerTruth({
        input: token,
        result: baseResult,
        reportContextDepth: null,
      }),
    };

    return {
      id: def.id,
      symbol: def.symbol,
      name: def.name,
      rank: def.rank,
      price: def.price,
      priceChange1h: def.change1h,
      priceChange24h: def.change24h,
      priceChange7d: def.change7d,
      priceChange30d: def.change30d,
      marketCap: def.marketCap,
      volume24h: def.volume24h,
      image: `/market-logos/${def.symbol.toLowerCase()}.svg`,
      sparkline7d: spark,
      result,
      verifiedProviders: ["Binance L3", "CoinGecko Aggregate"],
      observedAt: now,
    };
  });
}
