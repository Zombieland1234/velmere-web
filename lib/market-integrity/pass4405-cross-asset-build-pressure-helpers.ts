import type { Pass4413CrossAssetQuote } from "@/lib/market-integrity/pass4413-cross-asset-runtime-normalizers";

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

export type Pass4405QuoteSelectionShape = Pass4413CrossAssetQuote;

export const PASS4405_REAL_MARKETS_MARKET_CAP_FALLBACKS: Record<string, number> = {
  AAPL: 2_900_000_000_000,
  NVDA: 2_700_000_000_000,
  MSFT: 2_800_000_000_000,
  GOOGL: 1_850_000_000_000,
  GOOG: 1_850_000_000_000,
  AMZN: 1_750_000_000_000,
  META: 1_250_000_000_000,
  TSLA: 620_000_000_000,
  MC: 390_000_000_000,
  "MC.PA": 390_000_000_000,
  JPM: 560_000_000_000,
  ASML: 400_000_000_000,
  SAP: 280_000_000_000,
  AMD: 260_000_000_000,
  TSM: 900_000_000_000,
  AVGO: 850_000_000_000,
  GS: 180_000_000_000,
  BAC: 300_000_000_000,
  V: 550_000_000_000,
  MA: 430_000_000_000,
  NVO: 450_000_000_000,
  AIR: 130_000_000_000,
  "AIR.PA": 130_000_000_000,
  BMW: 55_000_000_000,
  "BMW.DE": 55_000_000_000,
  MBG: 65_000_000_000,
  "MBG.DE": 65_000_000_000,
  VOW3: 55_000_000_000,
  "VOW3.DE": 55_000_000_000,
  ADS: 42_000_000_000,
  "ADS.DE": 42_000_000_000,
};

export const PASS4405_REAL_MARKETS_VOLUME_24H_FALLBACKS: Record<string, number> = {
  AAPL: 8_900_000_000,
  NVDA: 29_000_000_000,
  MSFT: 6_400_000_000,
  GOOGL: 4_200_000_000,
  GOOG: 4_200_000_000,
  AMZN: 7_600_000_000,
  META: 5_700_000_000,
  TSLA: 15_500_000_000,
  JPM: 2_100_000_000,
  ASML: 1_400_000_000,
  SAP: 820_000_000,
  AMD: 7_300_000_000,
  TSM: 3_400_000_000,
  AVGO: 2_900_000_000,
  GS: 1_100_000_000,
  BAC: 3_100_000_000,
  V: 1_900_000_000,
  MA: 1_700_000_000,
  NVO: 780_000_000,
  AIR: 390_000_000,
  "AIR.PA": 390_000_000,
  BMW: 430_000_000,
  "BMW.DE": 430_000_000,
  MBG: 410_000_000,
  "MBG.DE": 410_000_000,
  VOW3: 690_000_000,
  "VOW3.DE": 690_000_000,
  ADS: 250_000_000,
  "ADS.DE": 250_000_000,
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
  if (!asset) return null;
  const keys = [asset.providerSymbol, asset.symbol, asset.symbol.replace(/\.[A-Z]+$/, "")]
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean);
  for (const key of keys) {
    const value = PASS4405_REAL_MARKETS_MARKET_CAP_FALLBACKS[key];
    if (typeof value === "number") return value;
  }
  return null;
}

export function fallbackVolume24h(asset: Pass4405RealMarketsAssetKeyShape | null | undefined) {
  if (!asset) return null;
  const keys = [asset.providerSymbol, asset.symbol, asset.symbol.replace(/\.[A-Z]+$/, "")]
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean);
  for (const key of keys) {
    const value = PASS4405_REAL_MARKETS_VOLUME_24H_FALLBACKS[key];
    if (typeof value === "number") return value;
  }
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

export function quoteForAsset(
  quotes: Record<string, Pass4413CrossAssetQuote>,
  asset: Pass4405RealMarketsAssetKeyShape | null | undefined,
): Pass4413CrossAssetQuote | undefined {
  const symbols = quoteSymbolsForAsset(asset);
  const available = symbols
    .map((symbol) => quotes[symbol])
    .filter((quote): quote is Pass4413CrossAssetQuote => Boolean(quote));
  return available.find(
    (quote) => quote.state === "live" && quote.currentPrice !== null,
  ) ?? available[0];
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
