import catalog from "@/data/real-markets-customer-catalog.json";

export type RealMarketsCustomerCatalogRow = {
  id: string;
  rank: number;
  symbol: string;
  name: string;
  assetClass: "stock" | "fx" | "etf" | "commodity" | "real_estate" | "crypto" | "exchange_token" | "index" | "exchange";
  riskPressure: number;
  sparkTone: string;
  sourceRhythm: string;
  priceLane: string;
  volumeLane: string;
  proofOrDisclosureLane: string;
  secondSourceLane: string;
  confidenceFloor: number;
  adapterState: string;
  humanCopy: string;
  nextAdapterStep: string;
};

export const REAL_MARKETS_CUSTOMER_CATALOG_SOURCE_SHA256 = catalog.sourceSha256;
export const REAL_MARKETS_CUSTOMER_CATALOG_SHA256 = catalog.catalogSha256;
export const REAL_MARKETS_CUSTOMER_CATALOG_SNAPSHOT_AT = catalog.catalogSnapshotAt ?? null;
export const REAL_MARKETS_CUSTOMER_CATALOG_DATA_MODE = catalog.dataMode;
export const REAL_MARKETS_CUSTOMER_CATALOG_LIVE_DATA_INCLUDED = catalog.liveDataIncluded;
export const REAL_MARKETS_CUSTOMER_CATALOG_COMMERCIAL_RIGHTS_VERIFIED = catalog.commercialRightsVerified;
export const REAL_MARKETS_CUSTOMER_CATALOG_COUNTS = catalog.counts;

const catalogRows = catalog.rows as readonly RealMarketsCustomerCatalogRow[];
const catalogIds = new Set(catalogRows.map((row) => row.id));
const catalogSymbols = new Set(catalogRows.map((row) => row.symbol.trim().toUpperCase()));
const supportedAssetClasses = new Set(["stock", "fx", "etf", "commodity", "real_estate", "crypto", "exchange_token", "index", "exchange"]);
const countSum = catalog.counts.stocks + catalog.counts.fx + catalog.counts.etf + catalog.counts.commodities + catalog.counts.realEstate + catalog.counts.crypto + catalog.counts.exchangeTokens + catalog.counts.indices + catalog.counts.exchanges;
if (
  catalog.schemaVersion !== "real_markets_customer_catalog_v4"
  || catalog.dataMode !== "STATIC_REFERENCE_UNIVERSE"
  || catalog.liveDataIncluded !== false
  || catalog.commercialRightsVerified !== false
  || catalog.counts.total !== catalogRows.length
  || catalog.counts.uniqueSymbols !== catalogRows.length
  || countSum !== catalogRows.length
  || catalogIds.size !== catalogRows.length
  || catalogSymbols.size !== catalogRows.length
  || catalogRows.some((row) => !supportedAssetClasses.has(row.assetClass))
) {
  throw new Error("real_markets_customer_catalog_identity_contract_invalid");
}

export const REAL_MARKETS_CUSTOMER_CATALOG_ROWS = catalogRows;
