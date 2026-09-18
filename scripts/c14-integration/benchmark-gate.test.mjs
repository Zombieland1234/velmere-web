import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBenchmarkGate } from './benchmark-gate.mjs';
function valid() {
  const lane = () => ({ uniqueInputCount: 2, completed: 2, errors: 0, timeouts: 0,
    totalAssessmentPairs: { tp: 1, tn: 1, fp: 0, fn: 0, unassessed: 0 } });
  return { baseline: lane(), candidate: lane(), stability: lane(), unstable: [],
    expectedCases: 2, expectedPairs: 2, expectedStability: 2 };
}
test('measurement gate: complete stable run passes without approving release', () => {
  const result = evaluateBenchmarkGate(valid());
  assert.equal(result.status, 'PASS'); assert.deepEqual(result.blockers, []);
  assert.equal(result.releaseApproved, false); assert.equal(result.generalizationVerified, false);
  assert.equal(result.detectorQualityQualified, false);
});
for (const lane of ['baseline', 'candidate', 'stability']) {
  for (const metric of ['errors', 'timeouts']) {
    test(`measurement gate: ${lane} ${metric} cannot yield success`, () => {
      const fixture = valid(); fixture[lane][metric] = 1; fixture[lane].completed = 1;
      const result = evaluateBenchmarkGate(fixture);
      assert.equal(result.status, 'FAIL');
      assert.ok(result.blockers.includes(`${lane.toUpperCase()}_INCOMPLETE`));
    });
  }
}
test('measurement gate: unstable repeat fails even when every call completed', () => {
  const fixture = valid(); fixture.unstable = ['synthetic-case'];
  assert.ok(evaluateBenchmarkGate(fixture).blockers.includes('STABILITY_MISMATCH'));
});
test('measurement gate: missing baseline results fail', () => {
  const fixture = valid(); fixture.baseline.completed = 1;
  assert.equal(evaluateBenchmarkGate(fixture).status, 'FAIL');
});
test('measurement gate: unassessed baseline labels cannot be hidden', () => {
  const fixture = valid(); fixture.baseline.totalAssessmentPairs.unassessed = 1;
  assert.ok(evaluateBenchmarkGate(fixture).blockers.includes('BASELINE_ASSESSMENTS_INCOMPLETE'));
});
test('measurement gate: candidate label total must match frozen input labels', () => {
  const fixture = valid(); fixture.candidate.totalAssessmentPairs.fn = 1;
  assert.ok(evaluateBenchmarkGate(fixture).blockers.includes('CANDIDATE_ASSESSMENTS_INCOMPLETE'));
});
test('measurement gate: empty or malformed expected counts fail closed', () => {
  for (const value of [0, -1, NaN, '2']) {
    const fixture = valid(); fixture.expectedCases = value;
    assert.ok(evaluateBenchmarkGate(fixture).blockers.includes('INVALID_EXPECTATIONS'));
  }
});
test('measurement gate: fractional or negative confusion counts are invalid', () => {
  for (const value of [0.5, -1]) {
    const fixture = valid(); fixture.candidate.totalAssessmentPairs.fp = value;
    assert.equal(evaluateBenchmarkGate(fixture).status, 'FAIL');
  }
});
test('measurement gate: poor accuracy still passes measurement completeness only', () => {
  const fixture = valid(); fixture.candidate.totalAssessmentPairs = {tp:0,tn:0,fp:1,fn:1,unassessed:0};
  const result = evaluateBenchmarkGate(fixture);
  assert.equal(result.status, 'PASS'); assert.equal(result.detectorQualityQualified, false);
});
