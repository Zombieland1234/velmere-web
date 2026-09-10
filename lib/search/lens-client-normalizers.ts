import type { LensReport } from "@/lib/search/lens-report";
import {
  sourceEvidenceCoverageForMode,
  sourceEvidenceCoverageScore,
  type VelmereSearchResult,
} from "@/lib/search/intelligence-search-contract";

// PASS4407 no-visual Browser/Lens build-pressure extraction.
// This module keeps runtime normalization outside the 5k+ line client component while
// preserving the exact search/PDF behavior and public safety boundaries.
export const LENS_SINGLE_RESULT_LIMIT = 1;

export type Pass4407SearchResponse = {
  ok: boolean;
  results?: VelmereSearchResult[];
};

export type Pass4407CanonicalReportResponse = {
  ok: boolean;
  report?: LensReport;
  renderToken?: string;
  renderTokenExpiresAt?: string;
  transport?: "signed_render_token" | "full_preview_with_signed_render_token" | "signed_source_token_required";
};

type Pass4407LensSourceInput =
  | Partial<VelmereSearchResult["sources"][number]>
  | Record<string, unknown>;

type Pass4407LensSourceIndex = number;

export function safeClientText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function safeClientStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => safeClientText(item))
    .filter(Boolean)
    .slice(0, 24);
}

export function normalizeClientSearchResult(
  value: unknown,
): VelmereSearchResult | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<VelmereSearchResult>;
  const symbol = safeClientText(item.symbol);
  const title = safeClientText(item.title, symbol || "Velmère research");
  const id = safeClientText(
    item.id,
    `result-${
      (symbol || title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 48) || "research"
    }`,
  );
  const categories = new Set([
    "token",
    "market",
    "contract",
    "velmere",
    "osint",
    "document",
  ]);
  const tones = new Set(["calm", "review", "elevated", "blocked"]);
  const sourceModes = new Set([
    "table",
    "live",
    "live_table",
    "fallback",
    "missing",
  ]);
  const sources = Array.isArray(item.sources)
    ? item.sources
        .filter(
          (source: unknown): source is Pass4407LensSourceInput =>
            Boolean(source) && typeof source === "object",
        )
        .map((source: Pass4407LensSourceInput, index: Pass4407LensSourceIndex) => {
          const candidate = source as Partial<
            VelmereSearchResult["sources"][number]
          >;
          const mode = sourceModes.has(String(candidate.mode))
            ? candidate.mode!
            : "missing";
          return {
            id: safeClientText(candidate.id, `source-${index + 1}`),
            label: safeClientText(candidate.label, "Source required"),
            mode,
            freshness: safeClientText(candidate.freshness, "missing"),
            confidence: candidate.confidenceCalibrated === true
              ? Math.max(0, Math.min(100, Number(candidate.confidence) || 0))
              : 0,
            confidenceCalibrated: candidate.confidenceCalibrated === true,
            coverage: sourceEvidenceCoverageForMode(mode),
            note: safeClientText(
              candidate.note,
              "Source boundary remains visible.",
            ),
          };
        })
        .slice(0, 16)
    : [];

  return {
    ...item,
    id,
    title,
    symbol: symbol || undefined,
    category: categories.has(String(item.category)) ? item.category! : "osint",
    tone: tones.has(String(item.tone)) ? item.tone! : "review",
    summary: safeClientText(
      item.summary,
      "The result needs a source-bound detail scan.",
    ),
    whyItMatters: safeClientText(
      item.whyItMatters,
      "Missing evidence limits the strength of the conclusion.",
    ),
    missingData: safeClientStringArray(item.missingData),
    nextOperatorStep: safeClientText(
      item.nextOperatorStep,
      "Open Shield and verify the missing source lanes.",
    ),
    sourceMode: sourceModes.has(String(item.sourceMode))
      ? item.sourceMode!
      : "missing",
    sourceConfidence: item.sourceConfidenceCalibrated === true
      ? Math.max(0, Math.min(100, Number(item.sourceConfidence) || 0))
      : 0,
    sourceConfidenceCalibrated: item.sourceConfidenceCalibrated === true,
    sourceCoverage: sourceEvidenceCoverageScore({ sources }),
    shieldHref: safeClientText(item.shieldHref, "/market-integrity"),
    sources,
    chips: safeClientStringArray(item.chips),
    marketSnapshot:
      item.marketSnapshot && typeof item.marketSnapshot === "object"
        ? item.marketSnapshot
        : undefined,
    lensSourceToken: safeClientText(item.lensSourceToken) || undefined,
    lensSourceTokenExpiresAt: safeClientText(item.lensSourceTokenExpiresAt) || undefined,
  };
}

export function normalizeClientSearchResults(value: unknown): VelmereSearchResult[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map(normalizeClientSearchResult)
    .filter((item): item is VelmereSearchResult => Boolean(item))
    .filter((item) => {
      const key = `${item.category}:${item.symbol || item.id}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

export function normalizeClientSearchResponse(
  value: unknown,
): Pass4407SearchResponse {
  if (!value || typeof value !== "object") return { ok: false, results: [] };
  const record = value as { ok?: unknown; results?: unknown };
  return {
    ok: record.ok === true,
    results: normalizeClientSearchResults(record.results),
  };
}

export function normalizeCanonicalReportResponse(
  value: unknown,
): Pass4407CanonicalReportResponse {
  if (!value || typeof value !== "object") return { ok: false };
  const record = value as {
    ok?: unknown;
    report?: unknown;
    renderToken?: unknown;
    renderTokenExpiresAt?: unknown;
    transport?: unknown;
  };
  const transport = record.transport === "signed_render_token" ||
    record.transport === "full_preview_with_signed_render_token" ||
    record.transport === "signed_source_token_required"
      ? record.transport
      : undefined;
  return {
    ok: record.ok === true,
    report:
      record.report && typeof record.report === "object"
        ? (record.report as LensReport)
        : undefined,
    renderToken: safeClientText(record.renderToken) || undefined,
    renderTokenExpiresAt: safeClientText(record.renderTokenExpiresAt) || undefined,
    transport,
  };
}

export function selectLensDetailResult(
  query: string,
  values: VelmereSearchResult[] | undefined,
): VelmereSearchResult[] {
  const items = normalizeClientSearchResults(values);
  const normalized = query.trim().toLowerCase();
  const exact = items.find((item) =>
    [item.symbol, item.title, item.id]
      .filter(Boolean)
      .some((value) => String(value).trim().toLowerCase() === normalized),
  );
  return exact ? [exact] : items.slice(0, LENS_SINGLE_RESULT_LIMIT);
}
