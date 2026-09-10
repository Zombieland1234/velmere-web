import {
  buildPass419MarketCoverageUniverse,
  pass419AssetVisualPatch,
} from "@/lib/market-integrity/terminal-payload-stabilizer";
import { PASS481_ASSET_IDENTITIES } from "@/lib/market-integrity/asset-identity-registry";
import type { UniversalAssetRow } from "@/lib/market-integrity/universal-asset-market-matrix";

export type Pass466LensMarketClass = "stock" | "etf" | "real_estate";

export type Pass466LensMarketRow = Pick<
  UniversalAssetRow,
  | "id"
  | "rank"
  | "symbol"
  | "name"
  | "assetClass"
  | "riskPressure"
  | "confidenceFloor"
  | "adapterState"
  | "humanCopy"
  | "priceLane"
  | "volumeLane"
  | "proofOrDisclosureLane"
  | "secondSourceLane"
  | "nextAdapterStep"
> & {
  assetClass: Pass466LensMarketClass;
  glyph: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeMarketSymbol(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._/-]/g, "")
    .slice(0, 24);
}

function score(row: Pass466LensMarketRow, query: string) {
  const q = clean(query);
  const symbol = clean(row.symbol);
  const name = clean(row.name);
  const id = clean(row.id);
  const words = name.split(/[^a-z0-9]+/).filter(Boolean);
  if (!q) return row.rank;
  if (symbol === q) return 0;
  if (id === q) return 1;
  if (name === q) return 2;
  if (symbol.startsWith(q)) return 3;
  if (words.some((word) => word.startsWith(q))) return 4;
  if (id.startsWith(q)) return 5;
  if (q.length >= 3 && name.includes(q)) return 7;
  return Number.POSITIVE_INFINITY;
}

let catalogCache: Pass466LensMarketRow[] | null = null;

export function buildPass466LensMarketCatalog(): Pass466LensMarketRow[] {
  if (catalogCache) return catalogCache;
  const seen = new Set<string>();
  const baseRows = buildPass419MarketCoverageUniverse()
    .filter(
      (row): row is UniversalAssetRow & { assetClass: Pass466LensMarketClass } =>
        row.assetClass === "stock" ||
        row.assetClass === "etf" ||
        row.assetClass === "real_estate",
    );
  const registryRows: Array<UniversalAssetRow & { assetClass: Pass466LensMarketClass }> = PASS481_ASSET_IDENTITIES
    .filter(
      (row): row is typeof row & { assetClass: Pass466LensMarketClass } =>
        row.assetClass === "stock" ||
        row.assetClass === "etf" ||
        row.assetClass === "real_estate",
    )
    .map((row, index) => ({
      id: row.symbol.toLowerCase(),
      rank: 200 + index,
      symbol: row.symbol,
      name: row.label,
      assetClass: row.assetClass,
      riskPressure: 25,
      confidenceFloor: 80,
      adapterState: "daily_reference" as const,
      sourceRhythm: "daily" as const,
      sparkTone: "up" as const,
      humanCopy: `${row.label} (${row.symbol})`,
      priceLane: "real-markets",
      volumeLane: "real-markets",
      proofOrDisclosureLane: "Real Markets official catalog",
      secondSourceLane: "SEC EDGAR / Official market feed",
      nextAdapterStep: "Inspect quote and risk in Real Markets",
    }));

  catalogCache = [...baseRows, ...registryRows]
    .filter((row) => {
      const symbol = normalizeMarketSymbol(row.symbol);
      const key = `${row.assetClass}:${symbol}`;
      if (!symbol || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((row) => {
      const symbol = normalizeMarketSymbol(row.symbol);
      return {
        ...row,
        symbol,
        glyph: pass419AssetVisualPatch[symbol]?.glyph || symbol.slice(0, 2),
      };
    })
    .sort((left, right) => left.rank - right.rank || left.symbol.localeCompare(right.symbol));
  return catalogCache;
}

export function searchPass466LensMarkets(query: string, limit = 12) {
  const scored = buildPass466LensMarketCatalog()
    .map((row) => ({ row, score: score(row, query) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.row.rank - right.row.rank ||
        left.row.symbol.localeCompare(right.row.symbol),
    );
  const exact = (scored[0]?.score ?? Number.POSITIVE_INFINITY) <= 2;
  return (exact ? scored.slice(0, 1) : scored.slice(0, Math.max(1, limit))).map(
    (entry) => entry.row,
  );
}

export function isPass466ExactMarketMatch(row: Pass466LensMarketRow, query: string) {
  return score(row, query) <= 2;
}

export const pass466RealMarketLensContract = {
  id: "PASS466_REAL_MARKET_LENS",
  rules: [
    "Lens searches the same stock, ETF and REIT universe as Real Markets instead of maintaining a disconnected miniature list.",
    "Suggestion requests remain catalog-only; keyed quotes and heavy fundamentals run only for a committed exact detail search.",
    "Stock market capitalization comes from the keyed provider when available; ETF/REIT net assets remain distinct from issuer market capitalization.",
    "Missing Alpha Vantage or SEC configuration stays visible as source required and never becomes a fabricated number.",
  ],
} as const;
