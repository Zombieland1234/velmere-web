export type Pass582CitationState = "confirmed" | "partial" | "missing";

export type Pass582SourceCitation = {
  id: `S${string}`;
  anchor: `lens-source-${string}`;
  label: string;
  mode: string;
  freshness: string;
  /** Calibrated confidence only when explicitly authorized upstream; otherwise zero. */
  confidence: number;
  /** Deterministic source-lane evidence coverage; not probability or confidence. */
  coverage: number;
  note: string;
  state: Pass582CitationState;
};

export type Pass582SourceCitationRail = {
  version: "source-citation-rail";
  citations: Pass582SourceCitation[];
  confirmed: number;
  partial: number;
  missing: number;
  boundary: string;
};

export function buildPass582SourceCitationRail(
  sources: readonly {
    label: string;
    mode: string;
    freshness: string;
    confidence: number;
    coverage?: number;
    note: string;
    evidenceState: Pass582CitationState;
  }[],
): Pass582SourceCitationRail {
  const citations = sources.map((source, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      id: `S${number}` as const,
      anchor: `lens-source-${number}` as const,
      label: source.label,
      mode: source.mode,
      freshness: source.freshness,
      confidence: Math.max(0, Math.min(100, Math.round(source.confidence))),
      coverage: Math.max(
        0,
        Math.min(
          100,
          Math.round(
            Number.isFinite(source.coverage)
              ? Number(source.coverage)
              : source.evidenceState === "confirmed"
                ? 100
                : source.evidenceState === "partial"
                  ? 50
                  : 0,
          ),
        ),
      ),
      note: source.note,
      state: source.evidenceState,
    };
  });

  return {
    version: "source-citation-rail",
    citations,
    confirmed: citations.filter((citation) => citation.state === "confirmed")
      .length,
    partial: citations.filter((citation) => citation.state === "partial")
      .length,
    missing: citations.filter((citation) => citation.state === "missing")
      .length,
    boundary:
      "Compact source IDs keep the A4 page readable; full freshness, deterministic evidence coverage, calibrated confidence when available, and source notes remain available on demand.",
  };
}
