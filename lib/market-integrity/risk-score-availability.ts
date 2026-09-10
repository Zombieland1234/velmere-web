export const RISK_SCORE_UNAVAILABLE_CODE = "risk_score_unavailable" as const;

const PLAIN_RISK_SCORE = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)\s*(?:%|\/\s*100)?$/u;

/**
 * Parses only an explicit 0..100 score. Free-form prose is intentionally
 * rejected so a historical number inside an "unavailable" message cannot be
 * mistaken for current evidence.
 */
export function parseRiskScore(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || !PLAIN_RISK_SCORE.test(normalized)) return null;
  const numeric = Number(
    normalized
      .replace(/\s*%$/u, "")
      .replace(/\s*\/\s*100$/u, "")
      .replace(",", "."),
  );
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100
    ? numeric
    : null;
}

export class RiskScoreUnavailableError extends Error {
  readonly code = RISK_SCORE_UNAVAILABLE_CODE;
  readonly context: string;

  constructor(context: string) {
    super(`${RISK_SCORE_UNAVAILABLE_CODE}:${context}`);
    this.name = "RiskScoreUnavailableError";
    this.context = context;
  }
}

export function requireRiskScore(value: unknown, context: string): number {
  const score = parseRiskScore(value);
  if (score === null) throw new RiskScoreUnavailableError(context);
  return score;
}
