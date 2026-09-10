export const PASS4825_REAL_MARKET_QUERY_POLICY_ID = "pass4825-real-market-query-policy-v1" as const;

const REAL_MARKET_ALIASES = new Set([
  "apple", "aapl", "nvidia", "nvda", "microsoft", "msft", "google", "alphabet", "googl", "goog",
  "tesla", "tsla", "amazon", "amzn", "meta", "amd", "adidas", "ads", "lvmh", "spy", "qqq", "voo",
  "s&p 500", "s&p500", "sp500", "nasdaq", "nasdaq 100", "dax", "vix", "gold", "xauusd", "oil", "wti",
  "eurusd", "eur/usd",
]);

const CORE_EQUITY_MARKET_ALIASES = new Set([
  "apple", "aapl", "nvidia", "nvda", "microsoft", "msft", "google", "alphabet", "googl", "goog",
  "tesla", "tsla", "amazon", "amzn", "meta", "amd", "spy", "qqq", "voo", "s&p 500", "s&p500",
  "sp500", "nasdaq", "nasdaq 100",
]);

export function normalizePass4825RealMarketQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Preserves the exact legacy alias set while giving every runtime one owner. */
export function shouldForceNonCryptoRealMarket(query: string, policy: "full" | "core_equity" = "full") {
  const aliases = policy === "core_equity" ? CORE_EQUITY_MARKET_ALIASES : REAL_MARKET_ALIASES;
  return aliases.has(normalizePass4825RealMarketQuery(query));
}

export function inspectPass4825RealMarketQueryPolicy() {
  const aliases = [...REAL_MARKET_ALIASES].sort();
  const errors = aliases.filter((alias) => !alias || alias !== normalizePass4825RealMarketQuery(alias));
  return {
    schemaVersion: PASS4825_REAL_MARKET_QUERY_POLICY_ID,
    status: errors.length === 0 ? "passed" as const : "failed" as const,
    aliasCount: aliases.length,
    coreEquityAliasCount: CORE_EQUITY_MARKET_ALIASES.size,
    aliases,
    errors,
  };
}
