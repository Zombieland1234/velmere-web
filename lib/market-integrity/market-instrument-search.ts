export type SearchableMarketInstrument = {
  id: string;
  name: string;
  symbol: string;
  source?: string | null;
  canonicalId?: string | null;
  aliases?: readonly string[] | null;
};

export function normalizeMarketQuery(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function marketInstrumentCanonicalId(
  instrument: SearchableMarketInstrument,
): string {
  const explicit = normalizeMarketQuery(instrument.canonicalId ?? "");
  if (explicit) return explicit;
  const source = normalizeMarketQuery(instrument.source ?? "market") || "market";
  const id = normalizeMarketQuery(instrument.id);
  if (id) return `${source}:${id}`;
  return `${source}:${normalizeMarketQuery(instrument.symbol)}:${normalizeMarketQuery(instrument.name)}`;
}

export function dedupeMarketInstruments<T extends SearchableMarketInstrument>(
  instruments: readonly T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const instrument of instruments) {
    const canonicalId = marketInstrumentCanonicalId(instrument);
    if (seen.has(canonicalId)) continue;
    seen.add(canonicalId);
    result.push(instrument);
  }
  return result;
}

function matchPriority(
  instrument: SearchableMarketInstrument,
  normalizedQuery: string,
): number | null {
  if (!normalizedQuery) return 0;

  const symbol = normalizeMarketQuery(instrument.symbol);
  const name = normalizeMarketQuery(instrument.name);
  const aliases = (instrument.aliases ?? []).map(normalizeMarketQuery).filter(Boolean);

  if (symbol === normalizedQuery) return 0;
  if (symbol.startsWith(normalizedQuery)) return 1;
  if (name === normalizedQuery) return 2;
  if (name.startsWith(normalizedQuery)) return 3;
  if (name.includes(normalizedQuery)) return 4;
  if (aliases.some((alias) => alias === normalizedQuery)) return 5;
  if (aliases.some((alias) => alias.startsWith(normalizedQuery))) return 6;
  if (aliases.some((alias) => alias.includes(normalizedQuery))) return 7;
  return null;
}

/**
 * Strict identity-only market search. It intentionally never inspects ids,
 * descriptions, scores, tags, prices or any other market-data field.
 */
export function filterMarketInstruments<T extends SearchableMarketInstrument>(
  instruments: readonly T[],
  query: string,
): T[] {
  const unique = dedupeMarketInstruments(instruments);
  const normalizedQuery = normalizeMarketQuery(query);
  if (!normalizedQuery) return unique;

  return unique
    .map((instrument, index) => ({
      instrument,
      index,
      priority: matchPriority(instrument, normalizedQuery),
    }))
    .filter(
      (entry): entry is typeof entry & { priority: number } =>
        entry.priority !== null,
    )
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ instrument }) => instrument);
}

