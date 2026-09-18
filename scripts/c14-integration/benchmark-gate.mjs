/** Measurement completeness, not a quality threshold or a release GO. */
export function evaluateBenchmarkGate({ baseline, candidate, stability, unstable,
  expectedCases, expectedPairs, expectedStability }) {
  const blockers = [];
  const count = value => Number.isSafeInteger(value) && value >= 0;
  if (!count(expectedCases) || expectedCases === 0 || !count(expectedPairs)
    || !count(expectedStability) || expectedStability > expectedCases) {
    blockers.push('INVALID_EXPECTATIONS');
  }
  function lane(label, summary, cases, pairs) {
    if (!summary || summary.uniqueInputCount !== cases || summary.completed !== cases
      || summary.errors !== 0 || summary.timeouts !== 0) {
      blockers.push(`${label}_INCOMPLETE`);
    }
    if (pairs === null) return;
    const matrix = summary?.totalAssessmentPairs;
    if (!matrix || !['tp', 'tn', 'fp', 'fn', 'unassessed'].every(key => count(matrix[key]))
      || matrix.unassessed !== 0 || matrix.tp + matrix.tn + matrix.fp + matrix.fn !== pairs) {
      blockers.push(`${label}_ASSESSMENTS_INCOMPLETE`);
    }
  }
  lane('BASELINE', baseline, expectedCases, expectedPairs);
  lane('CANDIDATE', candidate, expectedCases, expectedPairs);
  lane('STABILITY', stability, expectedStability, null);
  if (!Array.isArray(unstable) || unstable.length !== 0) blockers.push('STABILITY_MISMATCH');
  return {
    schema: 'velmere.c15q2.measurement-gate.v1',
    status: blockers.length ? 'FAIL' : 'PASS',
    blockers,
    scope: 'COMPLETE_BASELINE_CANDIDATE_AND_STABLE_REPEAT_ONLY',
    detectorQualityQualified: false,
    generalizationVerified: false,
    releaseApproved: false,
  };
}
