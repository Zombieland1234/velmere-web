/**
 * Velmère Audit Furnace V3 - Deterministic Audit Invalidation Engine
 * Evaluates whether an audit assessment remains authoritative (CURRENT) or has been invalidated (OUTDATED).
 * All invalidation decisions are strictly deterministic and rule-based.
 */

export type AssessmentValidityState = "CURRENT" | "OUTDATED";

export type InvalidationReason =
  | "IMPLEMENTATION_UPGRADED"
  | "TIMELOCK_EXPIRED"
  | "FRESHNESS_WINDOW_ELAPSED"
  | "CVE_DEPENDENCY_DISCLOSED"
  | "METHODOLOGY_SUPERSEDED"
  | "MANUAL_OPERATOR_REVOCATION";

export interface AuditValidityResult {
  validity: AssessmentValidityState;
  reason?: InvalidationReason;
  reasonDetails?: string;
  evaluatedAt: string;
  daysSinceAssessment: number;
  supersededBy?: string;
  verifiedBlockNumber?: number;
}

export interface AuditValidityEvaluationInput {
  assessmentDate: string | Date;
  bytecodeHashAtAssessment?: string;
  bytecodeHashCurrent?: string;
  maxValidityDays?: number; // Default 90 days
  knownCVEs?: boolean;
  methodologyVersion?: string;
  activeMethodologyVersion?: string;
  supersededBySnapshotId?: string;
}

const DEFAULT_MAX_VALIDITY_DAYS = 90;
const CURRENT_ACTIVE_METHODOLOGY = "v3.2.0";

/**
 * Deterministically evaluates the validity state of an audit assessment.
 */
export function evaluateAuditValidity(input: AuditValidityEvaluationInput): AuditValidityResult {
  const evaluatedAt = new Date().toISOString();
  const assessmentTime = new Date(input.assessmentDate).getTime();
  const now = Date.now();
  const daysSinceAssessment = Math.max(0, Math.floor((now - assessmentTime) / (1000 * 60 * 60 * 24)));
  const maxDays = input.maxValidityDays ?? DEFAULT_MAX_VALIDITY_DAYS;

  // 1. Explicit supersession by a newer snapshot
  if (input.supersededBySnapshotId) {
    return {
      validity: "OUTDATED",
      reason: "METHODOLOGY_SUPERSEDED",
      reasonDetails: `Superseded by verified assessment snapshot ${input.supersededBySnapshotId}.`,
      evaluatedAt,
      daysSinceAssessment,
      supersededBy: input.supersededBySnapshotId,
    };
  }

  // 2. On-chain proxy implementation or bytecode change detected
  if (
    input.bytecodeHashAtAssessment &&
    input.bytecodeHashCurrent &&
    input.bytecodeHashAtAssessment.toLowerCase() !== input.bytecodeHashCurrent.toLowerCase()
  ) {
    return {
      validity: "OUTDATED",
      reason: "IMPLEMENTATION_UPGRADED",
      reasonDetails: "On-chain smart contract bytecode hash mutated since last certification. Re-audit required.",
      evaluatedAt,
      daysSinceAssessment,
    };
  }

  // 3. Known critical dependency CVE published
  if (input.knownCVEs) {
    return {
      validity: "OUTDATED",
      reason: "CVE_DEPENDENCY_DISCLOSED",
      reasonDetails: "New high/critical CVE disclosed affecting upstream protocol libraries.",
      evaluatedAt,
      daysSinceAssessment,
    };
  }

  // 4. Freshness expiration window elapsed
  if (daysSinceAssessment > maxDays) {
    return {
      validity: "OUTDATED",
      reason: "FRESHNESS_WINDOW_ELAPSED",
      reasonDetails: `Assessment validity window of ${maxDays} days has elapsed (${daysSinceAssessment} days old).`,
      evaluatedAt,
      daysSinceAssessment,
    };
  }

  // 5. Methodology superseded
  if (
    input.methodologyVersion &&
    input.activeMethodologyVersion &&
    input.methodologyVersion !== input.activeMethodologyVersion
  ) {
    return {
      validity: "OUTDATED",
      reason: "METHODOLOGY_SUPERSEDED",
      reasonDetails: `Methodology ${input.methodologyVersion} superseded by active standard ${input.activeMethodologyVersion}.`,
      evaluatedAt,
      daysSinceAssessment,
    };
  }

  // All invariants satisfied -> Assessment is CURRENT
  return {
    validity: "CURRENT",
    evaluatedAt,
    daysSinceAssessment,
  };
}
