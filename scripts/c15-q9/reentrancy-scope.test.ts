import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeContextualReentrancy } from '../../lib/security/v2/contextual-reentrancy-engine';
import { buildControlFlowGraph, disassembleBytecode } from '../../lib/security/v2/evm-cfg-dataflow-engine';
const address = '0x0000000000000000000000000000000000000001';
// Inert instruction fixtures: decoded only. No deployed contracts or chain calls.
const call = '5f'.repeat(7) + 'f150';
const write = '6001600055';
const classic = 'VLM-SEC-REENTRANCY-01';
function result(hex: string, source?: string) {
  return analyzeContextualReentrancy(address, buildControlFlowGraph(disassembleBytecode(hex).instructions), source);
}
function found(hex: string, source?: string) { return result(hex, source).findings.some(f => f.findingId === classic); }
for (const [name, halt] of [['STOP','00'],['RETURN','5f5ff3'],['REVERT','5f5ffd'],['INVALID','fe']] as const) {
  test(`classic observation excludes code after entry ${name}`, () => {
    assert.equal(found(halt + call + write + '00'), false);
  });
}
for (const [name, halt] of [['REVERT','5f5ffd'],['INVALID','fe']] as const) {
  test(`classic successful-state hypothesis excludes exclusively ${name} continuation`, () => {
    assert.equal(found(call + write + halt), false);
  });
}
for (const [name, halt] of [['STOP','00'],['RETURN','5f5ff3'],['implicit STOP','']] as const) {
  test(`reachable post-call write before ${name} remains a candidate`, () => {
    assert.equal(found(call + write + halt), true);
  });
}
test('entry jump past an inert CALL/write block is respected', () => {
  const dead = call + write + '00';
  const dest = (3 + dead.length / 2).toString(16).padStart(2,'0');
  assert.equal(found('60' + dest + '56' + dead + '5b00'), false);
});
test('unknown jump destination conservatively retains the legal CALL/write destination', () => {
  assert.equal(found('5f35565b' + call + write + '00'), true);
});
test('source text cannot suppress an independent reachable bytecode observation', () => {
  assert.equal(found(call + write + '00', 'contract C { modifier nonReentrant(){_;} }'), true);
});
test('a state write before CALL is not a post-call write', () => {
  assert.equal(found(write + call + '00'), false);
});
test('a state write beyond STOP after CALL is not connected to that CALL', () => {
  assert.equal(found(call + '00' + write + '00'), false);
});
test('classic evidence is an observation, not a fabricated executed withdrawal', () => {
  const f = result(call + write + '00').findings.find(f => f.findingId === classic);
  assert.ok(f);
  assert.equal(f.exploitability, 'theoretical');
  assert.equal(f.remediation.appliedSuccessfully, false);
  assert.equal(f.remediation.regressionPassed, false);
  assert.ok(!f.proofOfConcept || f.proofOfConcept.sequence.length === 0);
  assert.doesNotMatch(f.impact, /draining protocol balances/);
});
test('scope analysis does not mutate shared CFG, selectors or storage observations', () => {
  const input = buildControlFlowGraph(disassembleBytecode(call + write + '00').instructions);
  const before = structuredClone(input);
  analyzeContextualReentrancy(address, input);
  assert.deepEqual(input,before);
});
