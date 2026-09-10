/**
 * First-Class Check Status & Aggregation Contract
 *
 * Implements strict status classification:
 * PASS | FAIL | UNVERIFIED | NOT_APPLICABLE | NOT_EXECUTED | LOCKED | UNAVAILABLE
 *
 * Guaranteed Invariants:
 * 1. NOT_APPLICABLE is NEVER counted as PASS or success.
 * 2. NOT_EXECUTED is NEVER counted as PASS or success.
 * 3. UNVERIFIED is NEVER converted to low risk.
 * 4. Pass rate denominator excludes NOT_APPLICABLE, but explicitly counts NOT_EXECUTED and UNVERIFIED.
 * 5. If coverage is below required threshold, risk classification is RISK_UNDETERMINED.
 */

export type CheckStatus =
  | "PASS"
  | "FAIL"
  | "UNVERIFIED"
  | "NOT_APPLICABLE"
  | "NOT_EXECUTED"
  | "LOCKED"
  | "UNAVAILABLE";

export interface EvaluatedCheck {
  checkId: string;
  name: string;
  category: string;
  status: CheckStatus;
  evidenceId?: string;
  evidenceDigest?: string;
  reason?: string;
  riskWeight: number; // 0 (informational) to 10 (critical)
  executedAt?: string;
}

export interface StatusAggregationResult {
  totalChecks: number;
  passedCount: number;
  failedCount: number;
  unverifiedCount: number;
  notApplicableCount: number;
  notExecutedCount: number;
  lockedCount: number;
  unavailableCount: number;
  applicableChecksCount: number;
  executedApplicableChecksCount: number;
  passRatePercentage: number; // 0 to 100 based strictly on applicable checks
  executionCoveragePercentage: number; // 0 to 100
  riskClassification: "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK" | "CRITICAL_RISK" | "RISK_UNDETERMINED";
  statusHonestyDigest: string;
}

/**
 * Computes deterministic status aggregation across evaluated checks.
 */
export function aggregateCheckStatuses(
  checks: EvaluatedCheck[],
  minimumRequiredCoverage = 60,
): StatusAggregationResult {
  let passedCount = 0;
  let failedCount = 0;
  let unverifiedCount = 0;
  let notApplicableCount = 0;
  let notExecutedCount = 0;
  let lockedCount = 0;
  let unavailableCount = 0;

  for (const check of checks) {
    switch (check.status) {
      case "PASS":
        passedCount++;
        break;
      case "FAIL":
        failedCount++;
        break;
      case "UNVERIFIED":
        unverifiedCount++;
        break;
      case "NOT_APPLICABLE":
        notApplicableCount++;
        break;
      case "NOT_EXECUTED":
        notExecutedCount++;
        break;
      case "LOCKED":
        lockedCount++;
        break;
      case "UNAVAILABLE":
        unavailableCount++;
        break;
    }
  }

  const totalChecks = checks.length;
  // NOT_APPLICABLE checks are outside the asset domain and cannot be evaluated
  const applicableChecksCount = totalChecks - notApplicableCount;

  // Checks that were actually executed
  const executedApplicableChecksCount = passedCount + failedCount;

  const executionCoveragePercentage =
    applicableChecksCount > 0
      ? Math.round((executedApplicableChecksCount / applicableChecksCount) * 100)
      : 0;

  // Pass rate is passed divided by applicable checks (UNVERIFIED / NOT_EXECUTED prevent 100% pass rate!)
  const passRatePercentage =
    applicableChecksCount > 0
      ? Math.round((passedCount / applicableChecksCount) * 100)
      : 0;

  // Determine Risk Classification:
  // If execution coverage is below threshold, risk CANNOT be determined (Anti-shortcut contract!)
  let riskClassification: StatusAggregationResult["riskClassification"];
  if (executionCoveragePercentage < minimumRequiredCoverage || applicableChecksCount === 0) {
    riskClassification = "RISK_UNDETERMINED";
  } else if (failedCount > 2 || checks.some((c) => c.status === "FAIL" && c.riskWeight >= 8)) {
    riskClassification = "CRITICAL_RISK";
  } else if (failedCount > 0 || unverifiedCount > 3) {
    riskClassification = "HIGH_RISK";
  } else if (unverifiedCount > 0 || passRatePercentage < 90) {
    riskClassification = "MODERATE_RISK";
  } else {
    riskClassification = "LOW_RISK";
  }

  return {
    totalChecks,
    passedCount,
    failedCount,
    unverifiedCount,
    notApplicableCount,
    notExecutedCount,
    lockedCount,
    unavailableCount,
    applicableChecksCount,
    executedApplicableChecksCount,
    passRatePercentage,
    executionCoveragePercentage,
    riskClassification,
    statusHonestyDigest: `checks:${totalChecks}|pass:${passedCount}|fail:${failedCount}|na:${notApplicableCount}|unexec:${notExecutedCount}|unver:${unverifiedCount}|rate:${passRatePercentage}%|cov:${executionCoveragePercentage}%|class:${riskClassification}`,
  };
}
