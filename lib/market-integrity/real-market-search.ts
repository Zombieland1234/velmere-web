import type { UniversalAssetClass } from "@/lib/market-integrity/universal-asset-market-matrix";
import { inferPass4646AssetClass } from "@/lib/market-integrity/universal-asset-identity";

export type RealMarketSearchResult = {
  id: string;
  symbol: string;
  name: string;
  assetClass: UniversalAssetClass;
  exchange: string;
  country: string;
  currency: string;
  provider: "velmere_matrix" | "twelve_data";
  providerState: "curated_reference" | "catalog_live";
};

export type TwelveDataSymbolSearchItem = {
  symbol?: string;
  instrument_name?: string;
  exchange?: string;
  mic_code?: string;
  instrument_type?: string;
  country?: string;
  currency?: string;
};

export function resolveRealMarketAssetClass(
  instrumentType: string | undefined,
  symbol = "",
  name = "",
): UniversalAssetClass {
  const resolved = inferPass4646AssetClass({
    provider: "catalog",
    symbol,
    name,
    instrumentType,
  });
  // UniversalAssetClass intentionally does not expose index/exchange_equity. The
  // broader risk engine keeps those classes, while catalog search degrades them
  // to stock-shaped rows without inventing crypto semantics.
  if (resolved === "index" || resolved === "exchange_equity" || resolved === "unknown") return "stock";
  return resolved;
}

export function normalizeTwelveDataSearchItem(
  item: TwelveDataSymbolSearchItem,
): RealMarketSearchResult | null {
  const symbol = (item.symbol ?? "").trim().toUpperCase();
  const name = (item.instrument_name ?? "").trim();
  if (!symbol || !name) return null;

  const exchange = (item.exchange ?? item.mic_code ?? "Global market").trim();
  return {
    id: `twelve-data:${exchange}:${symbol}`.toLowerCase().replace(/\s+/g, "-"),
    symbol,
    name,
    assetClass: resolveRealMarketAssetClass(item.instrument_type, symbol, name),
    exchange,
    country: (item.country ?? "Global").trim(),
    currency: (item.currency ?? "").trim().toUpperCase(),
    provider: "twelve_data",
    providerState: "catalog_live",
  };
}
