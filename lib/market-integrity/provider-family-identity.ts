const PROVIDER_ALIASES: Record<string, string> = {
  binance: "binance",
  "binance-spot": "binance",
  "binance.com": "binance",
  coinbase: "coinbase",
  "coinbase-exchange": "coinbase",
  "coinbase-advanced": "coinbase",
  gdax: "coinbase",
  kraken: "kraken",
  "kraken-spot": "kraken",
  coingecko: "coingecko",
  "coin-gecko": "coingecko",
  geckoterminal: "coingecko",
  "gecko-terminal": "coingecko",
  dexscreener: "dexscreener",
  "dex-screener": "dexscreener",
  etherscan: "etherscan",
  "etherscan-v2": "etherscan",
  polygonscan: "etherscan",
  arbiscan: "etherscan",
  basescan: "etherscan",
  snowtrace: "etherscan",
  yahoo: "yahoo-finance",
  yfinance: "yahoo-finance",
  "yahoo-finance": "yahoo-finance",
  "yahoo_finance": "yahoo-finance",
  sec: "sec-edgar",
  "sec-gov": "sec-edgar",
  edgar: "sec-edgar",
  "sec-edgar": "sec-edgar",
  "sec_edgar": "sec-edgar",
  finra: "finra",
  stooq: "stooq",
  alphavantage: "alpha-vantage",
  "alpha-vantage": "alpha-vantage",
  "alpha_vantage": "alpha-vantage",
  twelvedata: "twelve-data",
  "twelve-data": "twelve-data",
  "twelve_data": "twelve-data",
  polygon: "polygon-io",
  "polygon.io": "polygon-io",
  "polygon-io": "polygon-io",
  nasdaq: "nasdaq",
  nyse: "nyse",
  cboe: "cboe",
  cftc: "cftc",
  fred: "fred",
};

function normalizedProviderToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\?.*$/, "")
    .replace(/#.*$/, "")
    .replace(/\.(com|net|org|io)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Returns the organization-level provider family used by quorum checks.
 * Endpoint aliases and product names from the same organization intentionally
 * collapse to one family so they cannot masquerade as independent evidence.
 */
export function canonicalProviderFamily(value: string): string {
  const normalized = normalizedProviderToken(value);
  if (!normalized) return "";
  return PROVIDER_ALIASES[normalized] ?? normalized;
}

export function distinctProviderFamilies(values: Iterable<string>): string[] {
  return Array.from(
    new Set(Array.from(values, canonicalProviderFamily).filter(Boolean)),
  ).sort();
}

export function providerFamiliesAreIndependent(values: Iterable<string>, minimum = 2): boolean {
  return distinctProviderFamilies(values).length >= Math.max(1, Math.trunc(minimum));
}
