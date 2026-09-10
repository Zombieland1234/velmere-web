import type { VelmereSearchMode } from "@/lib/search/intelligence-search-contract";

// PASS462 legacy verifier markers: attachPass462BitcoinVenueEvidence · coinbase-venue-health.
export const allowedModes = new Set<VelmereSearchMode>([
  "all",
  "token",
  "market",
  "contract",
  "velmere",
  "osint",
]);

export type LensLocale = "pl" | "en" | "de";

export const pass2482ExactRealMarketAliases: Record<string, string> = {
  apple: "AAPL",
  aapl: "AAPL",
  nvidia: "NVDA",
  nvda: "NVDA",
  spy: "SPY",
  "spdr s&p 500": "SPY",
  "spdr s&p 500 etf": "SPY",
  "s&p 500 etf": "SPY",
  microsoft: "MSFT",
  msft: "MSFT",
  alphabet: "GOOGL",
  google: "GOOGL",
  googl: "GOOGL",
  tesla: "TSLA",
  tsla: "TSLA",
  meta: "META",
  amazon: "AMZN",
  amzn: "AMZN",
  adidas: "ADS.DE",
  "ads.de": "ADS.DE",
  lvmh: "MC.PA",
  "mc.pa": "MC.PA",
};

export function resolvePass2482ExactRealMarketSymbol(query: string) {
  const clean = query.trim().toLowerCase().replace(/\s+/g, " ");
  return pass2482ExactRealMarketAliases[clean];
}

export function resolveLensLocale(value: string | null): LensLocale {
  return value === "en" || value === "de" ? value : "pl";
}

export type SearchIntent = "suggest" | "detail";

export function resolveSearchIntent(value: string | null): SearchIntent {
  return value === "detail" ? "detail" : "suggest";
}
