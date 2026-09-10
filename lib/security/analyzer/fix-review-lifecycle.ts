/**
 * Velmère Furnace — Fix Review & Retest Closed-Loop Lifecycle (Phase 27, Override 29)
 *
 * Implements formal finding lifecycle tracking:
 * OPEN -> FIXED | PARTIALLY_FIXED | STILL_OPEN | WONT_FIX | REGRESSED
 * NO EVIDENCE = NO PASS.
 */

export type FindingLifecycleStatus =
  | 'OPEN'
  | 'FIXED'
  | 'PARTIALLY_FIXED'
  | 'STILL_OPEN'
  | 'WONT_FIX'
  | 'REGRESSED';

export type FixVerificationMethod =
  | 'STATIC_RECHECK'
  | 'FUZZ_RETEST'
  | 'SMT_REPROOF'
  | 'BYTECODE_DIFF_CONFIRMED'
  | 'INDEPENDENT_REINSPECTION';

export interface FindingFixRecord {
  readonly originalFindingId: string;
  readonly originalSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  readonly originalStatus: 'OPEN' | 'CONFIRMED';
  readonly retestBlockNumber: number;
  readonly newSourceHash: string;
  readonly verificationMethod: FixVerificationMethod;
  readonly newStatus: FindingLifecycleStatus;
  readonly verificationEvidenceHash: string;
  readonly notes: string;
}

export interface FixReviewReport {
  readonly auditReportId: string;
  readonly originalSourceHash: string;
  readonly retestSourceHash: string;
  readonly retestTimestamp: string;
  readonly findingsEvaluated: FindingFixRecord[];
  readonly totalFixed: number;
  readonly totalStillOpen: number;
  readonly totalRegressed: number;
  readonly isRegressionClean: boolean;
}

/**
 * Evaluates a set of retested findings and builds a cryptographically grounded Fix Review Report.
 */
export function buildFixReviewReport(options: {
  auditReportId: string;
  originalSourceHash: string;
  retestSourceHash: string;
  records: FindingFixRecord[];
}): FixReviewReport {
  const { auditReportId, originalSourceHash, retestSourceHash, records } = options;

  let totalFixed = 0;
  let totalStillOpen = 0;
  let totalRegressed = 0;

  for (const r of records) {
    if (r.newStatus === 'FIXED') {
      if (!r.verificationEvidenceHash || r.verificationEvidenceHash.length < 32) {
        throw new Error(
          `[FAIL-CLOSED FIX REVIEW] Finding ${r.originalFindingId} cannot be marked FIXED without a valid verificationEvidenceHash.`
        );
      }
      totalFixed++;
    } else if (r.newStatus === 'STILL_OPEN') {
      totalStillOpen++;
    } else if (r.newStatus === 'REGRESSED') {
      totalRegressed++;
    }
  }

  return {
    auditReportId,
    originalSourceHash,
    retestSourceHash,
    retestTimestamp: new Date().toISOString(),
    findingsEvaluated: records,
    totalFixed,
    totalStillOpen,
    totalRegressed,
    isRegressionClean: totalRegressed === 0,
  };
}
