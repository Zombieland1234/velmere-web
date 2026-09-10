export type ShieldMapSuggestionIdentity = {
  id: string;
  symbol: string;
};

export function normalizeShieldMapSuggestionKey(
  suggestion: ShieldMapSuggestionIdentity,
): string {
  const rawKey = suggestion.id.trim() || suggestion.symbol.trim();
  return rawKey.normalize("NFKC").toLocaleLowerCase("en-US");
}

export function deduplicateShieldMapSuggestions<
  T extends ShieldMapSuggestionIdentity,
>(suggestions: readonly T[]): T[] {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    const key = normalizeShieldMapSuggestionKey(suggestion);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
