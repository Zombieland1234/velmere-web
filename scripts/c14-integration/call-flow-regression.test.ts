import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { generateAuditSnapshotId } from '../../lib/security/v2/scoring-and-evidence-engine';
import assert from 'node:assert/strict';
import { buildControlFlowGraph, disassembleBytecode } from '../../lib/security/v2/evm-cfg-dataflow-engine';
import { analyzeCallContinuation } from '../../lib/security/v2/evm-call-continuation';
import { analyzeUncheckedLowLevelCalls } from '../../lib/security/v2/unchecked-low-level-call-engine';

// Static synthetic instruction fixtures, never executed against a chain or callee.
// Labels use PUSH2 so position changes cannot accidentally change instruction sizes.
const address = '0x0000000000000000000000000000000000000000';
const call = '6000600060006000600060005af150';
function assemble(parts: string[]): string {
  const labels = new Map<string, number>(); let pc = 0;
  for (const part of parts) {
    if (part.endsWith(':')) labels.set(part.slice(0, -1), pc);
    else pc += part.startsWith('@') ? 3 : part.length / 2;
  }
  return '0x' + parts.map(part => {
    if (part.endsWith(':')) return '';
    if (!part.startsWith('@')) return part;
    const dest = labels.get(part.slice(1));
    assert.notEqual(dest, undefined);
    return '61' + dest!.toString(16).padStart(4, '0');
  }).join('');
}
function findings(parts: string[]) {
  const cfg = buildControlFlowGraph(disassembleBytecode(assemble(parts)).instructions);
  return analyzeUncheckedLowLevelCalls(address, cfg);
}
for (const [label, prefix] of [
  ['STOP','00'], ['RETURN','60006000f3'], ['REVERT','60006000fd'], ['INVALID','fe'],
] as const) {
  test(`C14B excludes CALL/POP in a suffix cut off by ${label}`, () => {
    assert.deepEqual(findings([prefix, call, '00']), []);
  });
}
test('C14B excludes CALL/POP skipped by a known static jump', () => {
  assert.deepEqual(findings(['@end','56',call,'00','end:','5b00']), []);
});
test('C14B excludes discard when a successor unconditionally reverts', () => {
  assert.deepEqual(findings([call,'@abort','56','abort:','5b60006000fd']), []);
});
test('C14B excludes discard when both conditional successors abort', () => {
  assert.deepEqual(findings([call,'36','@abort','57','fe','abort:','5b60006000fd']), []);
});
test('C14B preserves discard with a possible successful continuation', () => {
  assert.equal(findings([call,'36','@abort','57','00','abort:','5b60006000fd']).length, 1);
});
test('C14B unknown entry jump retains every legal destination', () => {
  assert.equal(findings(['60003556','00','candidate:','5b',call,'00']).length, 1);
});
test('C14B unknown continuation retains a possible success destination', () => {
  assert.equal(findings([call,'60003556','fe','success:','5b00']).length, 1);
});
test('C14B ignores a dead unknown jump rather than reconnecting all code', () => {
  assert.deepEqual(findings(['00','60003556','dead:','5b',call,'00']), []);
});
test('C14B an unknown conditional retains both potential branches', () => {
  assert.equal(findings(['36','@candidate','57','00','candidate:','5b',call,'00']).length,1);
});
test('C14B zero conditional cannot enter a discard-only taken branch', () => {
  assert.deepEqual(findings(['6000','@candidate','57','00','candidate:','5b',call,'00']), []);
});
test('C14B known nonzero conditional skips dead fallthrough discard', () => {
  assert.deepEqual(findings(['6001','@end','57',call,'00','end:','5b00']), []);
});
test('C14B falloff after CALL/POP remains potential normal termination', () => {
  assert.equal(findings([call]).length,1);
});
test('C14B a loop with a possible STOP exit keeps the candidate', () => {
  assert.equal(findings(['loop:','5b',call,'36','@loop','57','00']).length,1);
});
test('C14B helper does not mutate legacy raw selectors or CFG', () => {
  const cfg = buildControlFlowGraph(disassembleBytecode(assemble(['63feaf968c50',call,'00'])).instructions);
  const before = structuredClone(cfg);
  analyzeUncheckedLowLevelCalls(address,cfg);
  assert.deepEqual(cfg,before);
  assert.ok(cfg.selectorsDiscovered.has('0xfeaf968c'));
});

for (const op of ['f1', 'f2', 'f4', 'fa']) {
  test(`C14B ${op} live candidate retained and disconnected candidate excluded`, () => {
    const fixture = call.replace('f150', op + '50');
    assert.equal(findings([fixture,'00']).length,1);
    assert.deepEqual(findings(['00',fixture,'00']),[]);
  });
}
test('C14B non-legacy entry disables pruning instead of claiming support', () => {
  const cfg = buildControlFlowGraph(disassembleBytecode('0xef00').instructions).cfg;
  const scope = analyzeCallContinuation(cfg);
  assert.equal(scope.pruningApplied,false);
  assert.deepEqual([...scope.entryReachable],[...cfg.blocks.keys()]);
});
test('C14B missing entry conservatively retains all provided blocks', () => {
  const cfg = buildControlFlowGraph(disassembleBytecode('0x00').instructions).cfg;
  const scope = analyzeCallContinuation({...cfg,entryBlockId:'absent'});
  assert.equal(scope.pruningApplied,false);
  assert.equal(scope.entryReachable.size,cfg.blocks.size);
});
test('C14B work limit cannot turn unassessed control flow into an empty finding', () => {
  const cfg = buildControlFlowGraph(disassembleBytecode('0x00').instructions).cfg;
  const block = cfg.blocks.values().next().value!;
  block.instructions=Array.from({length:200001},()=>block.instructions[0]);
  const scope=analyzeCallContinuation(cfg);
  assert.equal(scope.pruningApplied,false);
  assert.deepEqual([...scope.canReachSuccessfulExit],[...cfg.blocks.keys()]);
  assert.ok(scope.limitations.includes('FLOW_BUDGET_RETAINED'));
});
test('C14B unknown jump on both sides of a block retains a legal normal exit', () => {
  assert.equal(findings(['60003556','a:','5b',call,'60003556','b:','5b00']).length,1);
});
test('C14B a constant calculated jump obeys the stack rather than adjacent PUSH', () => {
  assert.deepEqual(findings(['@end','60000156',call,'00','end:','5b00']),[]);
});
test('C14B jump to immediate PUSH data is invalid, not an instruction destination', () => {
  assert.deepEqual(findings([call,'600156','615b00','00']),[]);
});
test('C14B self-contained unconditional cycle has no committing continuation', () => {
  assert.deepEqual(findings(['loop:','5b',call,'@loop','56']),[]);
});

test('C14B engine identity is revised while snapshot remains deterministic', () => {
  const input={contractAddress:address,chainId:'1',bytecode:'0x00'};
  const a=generateAuditSnapshotId(input),b=generateAuditSnapshotId(input);
  assert.equal(a.engineVersion,'Velmère-V2.5.1');
  assert.equal(a.snapshotDigest,b.snapshotDigest);
});
test('C14B snapshot cannot collide with prior engine version for identical code', () => {
  const input={contractAddress:address,chainId:'1',bytecode:'0x00'};
  const snapshot=generateAuditSnapshotId(input);
  const oldPayload=JSON.stringify({schema:'velmere.audit-content-snapshot.v2',address,chainId:'1',blockNumber:null,bytecodeSha256:createHash('sha256').update(Buffer.from('00','hex')).digest('hex'),sourceCodeSha256:null,engineVersion:'Velmère-V2.5.0'});
  assert.notEqual(snapshot.snapshotDigest,'0x'+createHash('sha256').update(oldPayload).digest('hex'));
});
