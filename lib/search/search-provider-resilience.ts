import type { ProviderResilienceResult } from "@/lib/market-integrity/provider-resilience-runtime";
import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";

function ageLabel(ageMs: number | null) {
  if (ageMs == null) return "age unknown";
  if (ageMs < 1_000) return `${ageMs} ms`;
  if (ageMs < 60_000) return `${Math.round(ageMs / 1_000)} s`;
  return `${Math.round(ageMs / 60_000)} min`;
}

export function applySearchProviderResilience<T>(
  rows: VelmereSearchResult[],
  result: ProviderResilienceResult<T>,
  sourceId: string,
): VelmereSearchResult[] {
  if (!result.ok || result.value === null) return [];
  const stale = !result.evidenceEligible || result.status === "stale_cache";
  const freshness = result.status === "live"
    ? "request-time"
    : `${result.status.replaceAll("_", " ")} · ${ageLabel(result.cacheAgeMs)}`;
  const digest = result.valueSha256 ? result.valueSha256.slice(0, 12) : "digest unavailable";
  const resilienceNote = `${result.status}; circuit ${result.circuitState}; digest ${digest}; ${stale ? "not eligible as fresh paid evidence" : "fresh evidence eligible"}`;

  return rows.map((row) => {
    const sources = row.sources.map((source) => source.id === sourceId
      ? {
          ...source,
          mode: stale ? ("fallback" as const) : source.mode,
          freshness,
          confidence: stale ? Math.min(source.confidence, 48) : source.confidence,
          note: `${source.note} · ${resilienceNote}`,
        }
      : source);
    const missingData = stale
      ? Array.from(new Set([...row.missingData, "fresh provider evidence required; stale cache cannot support paid-depth claims"]))
      : row.missingData;
    const chips = result.status === "live"
      ? row.chips
      : Array.from(new Set([...row.chips, result.status === "stale_cache" ? "stale provider cache" : "provider cache"]));
    return {
      ...row,
      sourceMode: stale ? ("fallback" as const) : row.sourceMode,
      sourceConfidence: stale ? Math.min(row.sourceConfidence, 48) : row.sourceConfidence,
      missingData,
      chips,
      sources,
    };
  });
}
