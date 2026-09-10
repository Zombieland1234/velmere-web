export type Pass482TerminalAsset = {
  symbol: string;
  providerSymbol: string;
  name: string;
  category: string;
};

export const PASS482_OVERVIEW_SYMBOLS = [
  "BTC",
  "ETH",
  "BINANCE",
  "MEXC",
  "COINBASE",
  "AAPL",
  "NVDA",
  "MSFT",
  "MC.PA",
  "ASML",
  "S&P 500",
  "NDX",
  "DAX",
  "VIX",
  "EUR/USD",
  "USD/JPY",
  "EUR/PLN",
  "GC",
  "CL",
  "HG",
  "SPY",
  "QQQ",
  "VNQ",
  "PLD",
] as const;

const priorityIndex = new Map<string, number>(
  PASS482_OVERVIEW_SYMBOLS.map((symbol, index) => [symbol, index]),
);

function normalized(value: string) {
  return value.trim().toUpperCase();
}

export function buildPass482TerminalOverview<T extends Pass482TerminalAsset>(assets: T[]) {
  const seen = new Set<string>();
  return assets
    .filter((asset) => priorityIndex.has(normalized(asset.symbol)))
    .filter((asset) => {
      const key = `${asset.category}:${normalized(asset.symbol)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (left, right) =>
        (priorityIndex.get(normalized(left.symbol)) ?? 999) -
        (priorityIndex.get(normalized(right.symbol)) ?? 999),
    );
}

export function scorePass482Search(asset: Pass482TerminalAsset, query: string) {
  const clean = normalized(query);
  if (!clean) return Number.POSITIVE_INFINITY;
  const symbol = normalized(asset.symbol);
  const provider = normalized(asset.providerSymbol);
  const name = normalized(asset.name);
  if (symbol === clean || provider === clean) return 0;
  if (symbol.startsWith(clean) || provider.startsWith(clean)) return 1;
  if (name.split(/\s+/).some((word) => word.startsWith(clean))) return 2;
  if (symbol.includes(clean) || provider.includes(clean)) return 3;
  if (name.includes(clean)) return 4;
  return Number.POSITIVE_INFINITY;
}
