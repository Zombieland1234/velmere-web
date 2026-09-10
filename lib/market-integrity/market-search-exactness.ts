import { isPass617PublicRealMarketsRow } from "@/lib/market-integrity/real-markets-noncrypto-taxonomy";

export type Pass621SearchCandidate = {
  id?: string;
  symbol: string;
  providerSymbol?: string;
  name: string;
  category?: unknown;
  assetClass?: unknown;
};

export type Pass621RankedCandidate<T extends Pass621SearchCandidate> = {
  item: T;
  score: number;
  match: "exact_symbol" | "exact_provider" | "exact_name" | "symbol_prefix" | "name_prefix" | "contains";
};

export type Pass621MarketSearchResolution<T extends Pass621SearchCandidate> = {
  version: "market-search-exactness";
  query: string;
  normalizedQuery: string;
  ranked: Pass621RankedCandidate<T>[];
  exact: T | null;
  autoOpen: boolean;
  requiresExplicitSelection: boolean;
  ambiguousExactCount: number;
  boundary: string;
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function tokens(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

function rankCandidate<T extends Pass621SearchCandidate>(
  item: T,
  query: string,
): Pass621RankedCandidate<T> | null {
  const q = normalize(query);
  if (!q) return null;
  const symbol = normalize(item.symbol);
  const provider = normalize(item.providerSymbol ?? "");
  const name = normalize(item.name);
  const nameTokens = tokens(item.name);

  if (symbol === q) return { item, score: 0, match: "exact_symbol" };
  if (provider && provider === q) return { item, score: 1, match: "exact_provider" };
  if (name === q) return { item, score: 2, match: "exact_name" };
  if (symbol.startsWith(q) || provider.startsWith(q)) {
    return { item, score: 10 + Math.min(symbol.length, provider.length || 999) - q.length, match: "symbol_prefix" };
  }
  if (nameTokens.some((token) => token.startsWith(q))) {
    return { item, score: 30 + name.length - q.length, match: "name_prefix" };
  }
  if (symbol.includes(q) || provider.includes(q) || name.includes(q)) {
    return { item, score: 60 + name.length, match: "contains" };
  }
  return null;
}

export function buildPass621MarketSearchResolution<T extends Pass621SearchCandidate>(
  query: string,
  candidates: readonly T[],
  limit = 8,
): Pass621MarketSearchResolution<T> {
  const normalizedQuery = normalize(query);
  const ranked = candidates
    .filter(isPass617PublicRealMarketsRow)
    .map((item) => rankCandidate(item, query))
    .filter((item): item is Pass621RankedCandidate<T> => Boolean(item))
    .sort((left, right) => left.score - right.score || left.item.symbol.localeCompare(right.item.symbol))
    .slice(0, Math.max(1, limit));
  const exactMatches = ranked.filter((item) => item.score <= 2);
  const exact = exactMatches.length === 1 ? exactMatches[0].item : null;
  const autoOpen = Boolean(exact) && normalizedQuery.length > 0;

  return {
    version: "market-search-exactness",
    query,
    normalizedQuery,
    ranked,
    exact,
    autoOpen,
    requiresExplicitSelection: ranked.length > 0 && !autoOpen,
    ambiguousExactCount: exactMatches.length,
    boundary:
      "Only one exact ticker, provider symbol or full instrument name may auto-open. Prefix and fuzzy matches stay in the suggestion list until the user explicitly selects one.",
  };
}
