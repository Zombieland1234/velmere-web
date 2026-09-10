// PASS4405 no-visual build-pressure extraction for CrossAssetCollapseRadarPanel.
// Boundary: helper-only refactor, no UI copy/layout/style changes.

export const PASS4405_CROSS_ASSET_BUILD_PRESSURE_HELPERS_BOUNDARY = {
  passId: "PASS4405",
  mode: "no_visual_real_markets_helper_extraction",
  visualChanges: false,
  purpose:
    "Move Real Markets alias, quote-symbol and fallback market-size helpers out of the client component monolith to reduce build pressure.",
  publicTopkaLiveAllowed: false,
} as const;

export type Pass4405RealMarketsAssetKeyShape = {
  symbol: string;
  providerSymbol: string;
  name: string;
  id: string;
  exchange?: string | null;
};

export type Pass4405QuoteSelectionShape = {
  state?: string;
  currentPrice?: number | null;
};

export const PASS4405_REAL_MARKET_ALIASES: Record<string, string[]> = {
  BNB: ["bnb", "binance coin", "binance token", "binance native token"],
  BINANCE: ["binance", "binance venue", "binance venue health", "binance hill", "binance health", "bnb venue", "binance exchange"],
  MEXC: ["mexc", "mexc venue", "mexc venue health", "mexc hill", "mx", "mx token", "mexc token", "mexc exchange"],
  COINBASE: ["coinbase", "coinbase venue", "coinbase health", "coin venue", "coinbase exchange"],
  OKX: ["okx", "okx venue", "okb", "okb venue", "okx exchange"],
  KRAKEN: ["kraken", "kraken venue", "kraken exchange"],
  BYBIT: ["bybit", "bybit venue", "mnt", "mantle", "bybit exchange"],
  MSFT: ["microsoft", "microsoft corp", "microsoft corporation", "msft"],
  AAPL: ["apple", "apple inc", "aapl"],
  NVDA: ["nvidia", "nvidia corp", "nvda"],
  GOOGL: ["alphabet", "google", "googl", "goog"],
  AMZN: ["amazon", "amazon.com", "amzn"],
  META: ["meta", "facebook", "meta platforms"],
  TSLA: ["tesla", "tsla"],
  AMD: ["amd", "advanced micro devices"],
  INTC: ["intel", "intel corporation", "intc"],
  ORCL: ["oracle", "oracle corporation", "orcl"],
  IBM: ["ibm", "international business machines"],
  SAP: ["sap", "sap se", "sap.de"],
  CRM: ["salesforce", "salesforce inc", "crm"],
  ADBE: ["adobe", "adbe"],
  NFLX: ["netflix", "nflx"],
  JPM: ["jpmorgan", "jpmorgan chase", "jpm"],
  V: ["visa", "visa inc"],
  MA: ["mastercard", "mastercard inc"],
};

export const PASS4405_REAL_MARKETS_QUOTE_FALLBACKS: Record<string, string[]> = {
  BINANCE: ["BNB-USD", "BNB-USD"],
  MEXC: ["MX-USD", "MEXC-USD"],
  OKX: ["OKB-USD"],
  BYBIT: ["MNT-USD"],
  COINBASE: ["COIN"],
  KRAKEN: ["KRAKENVENUE"],
  EUREX: ["DB1.DE"],
  XETRA: ["DB1.DE"],
};

export function fallbackMarketCap(asset: Pass4405RealMarketsAssetKeyShape | null | undefined) {
  void asset;
  // Compatibility export only. A catalog identity is not a market-cap
  // observation, so missing provider/fundamental evidence stays unavailable.
  return null;
}

export function fallbackVolume24h(asset: Pass4405RealMarketsAssetKeyShape | null | undefined) {
  void asset;
  // Compatibility export only. Volume must come from a source-bound quote or
  // candle response; it is never projected from a static catalog constant.
  return null;
}

export function normalizePass4405MarketAlias(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function pass4405FallbackKeysForAsset(asset: Pass4405RealMarketsAssetKeyShape) {
  const rawValues = [asset.symbol, asset.providerSymbol, asset.name, asset.id, asset.exchange]
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean);
  return Array.from(
    new Set(
      rawValues.flatMap((value) => [
        value,
        value.replace(/[-/](USD|USDT|USDC)$/i, ""),
        value.replace(/\s+VENUE\s+HEALTH$/i, ""),
        value.replace(/[^A-Z0-9.]/g, ""),
      ]),
    ),
  );
}

export function quoteSymbolsForAsset(asset: Pass4405RealMarketsAssetKeyShape | null | undefined) {
  if (!asset) return [] as string[];
  const fallbackSymbols = pass4405FallbackKeysForAsset(asset).flatMap(
    (key) => PASS4405_REAL_MARKETS_QUOTE_FALLBACKS[key] ?? [],
  );
  return Array.from(
    new Set(
      [asset.providerSymbol, asset.symbol, ...fallbackSymbols]
        .map((value) => String(value || "").trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

export function quoteForAsset<TQuote extends Pass4405QuoteSelectionShape>(
  quotes: Record<string, TQuote>,
  asset: Pass4405RealMarketsAssetKeyShape | null | undefined,
) {
  const symbols = quoteSymbolsForAsset(asset);
  const available = symbols.map((symbol) => quotes[symbol]).filter(Boolean);
  return available.find((quote) => quote.state === "live" && quote.currentPrice !== null) ?? available[0];
}

export function matchPass1994ManualMarketAliases<TAsset extends Pass4405RealMarketsAssetKeyShape>(
  query: string,
  assets: readonly TAsset[],
) {
  const normalized = normalizePass4405MarketAlias(query);
  if (!normalized || normalized.length < 2) return [] as TAsset[];
  const matches = new Set<string>();
  for (const [symbol, aliases] of Object.entries(PASS4405_REAL_MARKET_ALIASES)) {
    if (symbol.toLowerCase() === normalized) matches.add(symbol);
    if (aliases.some((alias) => {
      const cleanAlias = normalizePass4405MarketAlias(alias);
      return cleanAlias === normalized || cleanAlias.includes(normalized) || normalized.includes(cleanAlias);
    })) {
      matches.add(symbol);
    }
  }
  if (!matches.size) return [] as TAsset[];
  return assets.filter((asset) => {
    const symbol = String(asset.symbol || "").toUpperCase();
    const providerSymbol = String(asset.providerSymbol || "").toUpperCase();
    const name = normalizePass4405MarketAlias(asset.name);
    return (
      matches.has(symbol) ||
      matches.has(providerSymbol) ||
      Array.from(matches).some((match) => name.includes(normalizePass4405MarketAlias(match)))
    );
  });
}
