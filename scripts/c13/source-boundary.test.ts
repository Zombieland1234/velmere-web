import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeFullAuditV2 } from '../../lib/security/v2/master-audit-orchestrator';
import { preserveBytecodeCandidates, UNBOUND_SOURCE_LIMITATION } from '../../lib/security/v2/detector-source-boundary';
import type { StandardFindingV2 } from '../../lib/security/v2/types';

const address = '0x0000000000000000000000000000000000000013';
const audit = (bytecode: string, sourceCode?: string) => executeFullAuditV2({ contractAddress: address, chainId: '1', bytecode, sourceCode, fuzzIterations: 0 });
const runtimes = [
  { id: 'stale-feed', bytes: '0x63feaf968c00', finding: 'VLM-SEC-ORACLE-STALE-CHAINLINK-02' },
  { id: 'spot-reserves', bytes: '0x630902f1ac00', finding: 'VLM-SEC-ORACLE-SPOT-MANIPULATION-01' },
  { id: 'destruct', bytes: '0x32ff', finding: 'VLM-SEC-EVM-SELFDESTRUCT-02' },
];
const sources = [
  'contract Unrelated { string constant note = "HEARTBEAT answeredInRound"; }',
  'contract Unrelated { string constant note = "consult( price0CumulativeLast observe( UniswapV2OracleLibrary"; }',
  'contract Other { function read(uint updatedAt,uint roundId,uint answeredInRound) external view {require(updatedAt > block.timestamp - 60);require(answeredInRound >= roundId);} }',
  '// HEARTBEAT answeredInRound consult(\ncontract CommentOnly {}',
  'contract Other { modifier onlyOwner(){_;} modifier nonReentrant(){_;} }',
  'contract Other { string constant q="Ownable2Step acceptOwnership pendingOwner initializer onlyProxy"; }',
];
for (const runtime of runtimes) for (const [i, source] of sources.entries()) {
  test(`source cannot erase or rewrite bytecode observation: ${runtime.id}/${i}`, () => {
    const baseline = audit(runtime.bytes);
    assert.ok(baseline.findings.some(f => f.findingId === runtime.finding));
    const result = audit(runtime.bytes, source);
    for (const finding of baseline.findings) assert.deepEqual(result.findings.find(f => f.findingId === finding.findingId), finding);
    assert.deepEqual(result.contractProfile, baseline.contractProfile);
    assert.deepEqual(result.economicSimulations, baseline.economicSimulations);
    assert.equal(result.scores.overallScore, null);
    assert.ok(result.findings.every(f => f.claimState === 'HEURISTIC_CANDIDATE' && f.exploitability === 'theoretical'));
  });
}
test('source-only oracle hint has an explicit unbound evidence method, not bytecode proof', () => {
  const result = audit('0x00', 'contract Other { function price() external { getReserves(); } }');
  const finding = result.findings.find(f => f.findingId === 'VLM-SEC-ORACLE-SPOT-MANIPULATION-01');
  assert.ok(finding);
  assert.equal(finding.analysisMethod, 'SUBMITTED_SOURCE_HEURISTIC');
  assert.ok(finding.limitations?.includes(UNBOUND_SOURCE_LIMITATION));
  assert.equal(finding.claimState, 'HEURISTIC_CANDIDATE');
});
test('blank and absent source evaluate a single lane', () => {
  for (const source of [undefined, '', ' \n\t']) {
    let calls = 0;
    const result = preserveBytecodeCandidates(() => { calls++; return { findings: [], observed: false }; }, source);
    assert.equal(calls, 1); assert.equal(result.observed, false);
  }
});
test('wrapper preserves metadata, deduplicates source ids and does not mutate detector objects', () => {
  const original = audit('0x32ff').findings[0];
  const baseline = { findings: [original], observed: false };
  const sourceFinding: StandardFindingV2 = { ...original, findingId: 'SOURCE_ONLY' };
  const source = { findings: [{ ...original, severity: 'low' as const }, sourceFinding, sourceFinding], observed: true };
  const before = JSON.stringify([baseline, source]);
  const result = preserveBytecodeCandidates(text => text ? source : baseline, 'text');
  assert.equal(JSON.stringify([baseline, source]), before);
  assert.equal(result.observed, false);
  assert.equal(result.findings.length, 2);
  assert.deepEqual(result.findings[0], original);
  assert.equal(result.findings[1].analysisMethod, 'SUBMITTED_SOURCE_HEURISTIC');
});
test('structured source method remains distinct from submitted-text detector hints', () => {
  const finding = { ...audit('0x32ff').findings[0], analysisMethod: 'STRUCTURED_SOURCE_HEURISTIC' as const };
  const result = preserveBytecodeCandidates(source => ({ findings: source ? [finding] : [] }), 'source');
  assert.equal(result.findings[0].analysisMethod, 'STRUCTURED_SOURCE_HEURISTIC');
  assert.ok(result.findings[0].limitations?.includes(UNBOUND_SOURCE_LIMITATION));
});
test('adding unbound source changes the input receipt and never asserts verified coverage', () => {
  const before = audit('0x63feaf968c00');
  const after = audit('0x63feaf968c00', sources[0]);
  assert.notDeepEqual(before.snapshot, after.snapshot);
  assert.ok(after.scores.coverage.limitations.includes('SOURCE_RUNTIME_IDENTITY_NOT_VERIFIED'));
});
