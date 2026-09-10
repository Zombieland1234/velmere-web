import type { MarketIntegrityRow } from "./market-row-types";

/**
 * Canonical field/value surface retained in a market provider receipt.
 * Nullable keys make missing provider facts explicit and hash-bound.
 */
export function buildMarketRowEvidencePayload(row: MarketIntegrityRow) {
  return {
    identity: {
      marketId: row.id,
      symbol: row.symbol,
      name: row.name,
    },
    market: {
      rank: row.rank ?? null,
      image: row.image ?? null,
      price: row.price ?? null,
      priceChange1h: row.priceChange1h ?? null,
      priceChange24h: row.priceChange24h ?? null,
      priceChange7d: row.priceChange7d ?? null,
      priceChange14d: row.priceChange14d ?? null,
      priceChange30d: row.priceChange30d ?? null,
      marketCap: row.marketCap ?? null,
      fdv: row.fdv ?? null,
      volume24h: row.volume24h ?? null,
      high24h: row.high24h ?? null,
      low24h: row.low24h ?? null,
      observedAt: row.observedAt ?? null,
      ath: row.ath ?? null,
      athChangePercent: row.athChangePercent ?? null,
      circulatingSupply: row.circulatingSupply ?? null,
      totalSupply: row.totalSupply ?? null,
      maxSupply: row.maxSupply ?? null,
      sparkline7d: row.sparkline7d,
    },
  } as const;
}
