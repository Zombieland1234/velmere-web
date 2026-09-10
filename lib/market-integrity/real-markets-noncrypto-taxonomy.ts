export const PASS617_PUBLIC_REAL_MARKETS_CATEGORIES = [
  "all",
  "stocks",
  "indices",
  "fx",
  "etf",
  "commodities",
  "real_estate",
  "exchanges",
] as const;

export type Pass617PublicRealMarketsCategory =
  (typeof PASS617_PUBLIC_REAL_MARKETS_CATEGORIES)[number];

const CRYPTO_CLASSES = new Set([
  "crypto",
  "exchange_token",
  "crypto_reference",
  "token",
  "stablecoin",
]);

export type Pass617TaxonomyReceipt = {
  version: "real-markets-noncrypto-taxonomy";
  inputCount: number;
  publicCount: number;
  removedCount: number;
  removedIds: string[];
  categories: Pass617PublicRealMarketsCategory[];
  cryptoRoute: "/market-integrity";
  invariant: "real-markets-public-surface-has-no-crypto";
};

function normalized(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function isPass617CryptoClass(value: unknown) {
  return CRYPTO_CLASSES.has(normalized(value));
}

export function isPass617PublicRealMarketsRow(row: {
  category?: unknown;
  assetClass?: unknown;
}) {
  return !isPass617CryptoClass(row.category) && !isPass617CryptoClass(row.assetClass);
}

export function filterPass617PublicRealMarketsRows<
  T extends { id?: string; symbol?: string; category?: unknown; assetClass?: unknown },
>(rows: readonly T[]): T[] {
  return rows.filter(isPass617PublicRealMarketsRow);
}

export function buildPass617TaxonomyReceipt<
  T extends { id?: string; symbol?: string; category?: unknown; assetClass?: unknown },
>(rows: readonly T[]): Pass617TaxonomyReceipt {
  const publicRows = filterPass617PublicRealMarketsRows(rows);
  const publicSet = new Set(publicRows);
  return {
    version: "real-markets-noncrypto-taxonomy",
    inputCount: rows.length,
    publicCount: publicRows.length,
    removedCount: rows.length - publicRows.length,
    removedIds: rows
      .filter((row) => !publicSet.has(row))
      .map((row) => String(row.id ?? row.symbol ?? "unknown")),
    categories: [...PASS617_PUBLIC_REAL_MARKETS_CATEGORIES],
    cryptoRoute: "/market-integrity",
    invariant: "real-markets-public-surface-has-no-crypto",
  };
}
