/** Neutral cross-market identifiers used by runtime normalizers and sanity gates. */
export type Pass4413AssetCategory =
  | "crypto"
  | "stocks"
  | "indices"
  | "fx"
  | "etf"
  | "commodities"
  | "real_estate"
  | "exchanges";

export type Pass458TruthAssetClass =
  | "crypto"
  | "stock"
  | "index"
  | "fx"
  | "etf"
  | "commodity"
  | "real_estate"
  | "exchange_equity"
  | "venue_health";
export type Pass461VenueId = "binance" | "mexc" | "coinbase";
export type InvestigatorEvidenceStatus =
  "confirmed" | "likely" | "unverified" | "red_flag" | "unknown";
