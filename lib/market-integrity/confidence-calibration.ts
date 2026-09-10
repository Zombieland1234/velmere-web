export type EvidenceConfidenceStatus = "verified" | "review" | "missing";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeConfidencePercent(
  value: number | null | undefined,
  fallback = 35,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return Math.round(clamp(fallback));
  }

  return Math.round(clamp(value <= 1 ? value * 100 : value));
}

export function normalizeConfidenceRatio(
  value: number | null | undefined,
  fallback = 0.35,
) {
  return normalizeConfidencePercent(value, fallback * 100) / 100;
}

export function evidenceCoveragePercent(
  statuses: EvidenceConfidenceStatus[],
) {
  if (!statuses.length) return 0;
  const score = statuses.reduce((sum, status) => {
    if (status === "verified") return sum + 1;
    if (status === "review") return sum + 0.55;
    return sum;
  }, 0);
  return Math.round(clamp((score / statuses.length) * 100));
}

export function calibrateConfidencePercent(input: {
  modelConfidence?: number | null;
  statuses: EvidenceConfidenceStatus[];
  hasSource: boolean;
  hasTimestamp: boolean;
  sourceCount?: number;
}) {
  const model = normalizeConfidencePercent(input.modelConfidence);
  const coverage = evidenceCoveragePercent(input.statuses);
  const sourceCeiling = !input.hasSource
    ? 28
    : !input.hasTimestamp
      ? 58
      : (input.sourceCount ?? 1) < 2
        ? 82
        : 96;
  const evidenceAdjusted = Math.round(model * 0.76 + coverage * 0.24);
  const confidence = Math.min(model, evidenceAdjusted, sourceCeiling);

  return {
    confidence: Math.round(clamp(confidence)),
    coverage,
    sourceCeiling,
  };
}
