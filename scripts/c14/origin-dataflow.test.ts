import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disassembleBytecode, buildControlFlowGraph } from '../../lib/security/v2/evm-cfg-dataflow-engine';
import { executeFullAuditV2 } from '../../lib/security/v2/master-audit-orchestrator';
import { findOriginDependentBranches, ORIGIN_DATAFLOW_LIMITATION } from '../../lib/security/v2/origin-branch-dataflow';

const address = '0x0000000000000000000000000000000000000014';
const graph = (hex: string) => buildControlFlowGraph(disassembleBytecode(hex).instructions).cfg;
const trace = (hex: string) => findOriginDependentBranches(graph(hex));
// Prefix leaves a conditional value on the top of stack. Branch destinations
// are actual JUMPDEST instruction boundaries, never guessed hand-counted PCs.
export function branch(prefix: string): string {
  const target = prefix.length / 2 + 5;
  assert.ok(target < 65536);
  return '0x' + prefix + '61' + target.toString(16).padStart(4, '0') + '57005b00';
}
const cases: Array<[string, string, boolean]> = [
  ['normal origin equality', '32600114', true],
  ['discarded origin cannot taint unrelated equality', '32506001600114', false],
  ['comparison without origin stays clean', '33600114', false],
  ['origin below unrelated EQ operands is not consumed', '326001600214', false],
  ['DUP preserves actual origin operand', '328050600114', true],
  ['SWAP moves origin to the condition', '3260019050600114', false],
  ['SWAP retains origin after discarding independent top', '3260019050', false],
  ['DUP2 retrieves origin below unrelated value', '32600181600114', true],
  ['POP destroys origin-comparison result', '326001145060013314', false],
  ['ISZERO propagates origin condition', '3260011415', true],
  ['origin direct conditional without EQ', '32', true],
  ['double ISZERO without EQ', '321515', true],
  ['AND address mask preserves origin', '3273'+'ff'.repeat(20)+'16600114', true],
  ['multiplication by zero kills dependence', '325f02600114', false],
  ['AND zero kills dependence', '325f16600114', false],
  ['SHL >=256 kills dependence', '326101001b600114', false],
  ['SHR >=256 kills dependence', '326101001c600114', false],
  ['ADD preserves possible dependence', '32600101600114', true],
  ['XOR preserves possible dependence', '32600118600114', true],
  ['NOT preserves possible dependence', '3219600114', true],
  ['LT consumes actual origin operand', '32600110', true],
  ['GT consumes actual origin operand', '32600111', true],
  ['stack operands consumed by MSTORE stay consumed', '325f5260013314', false],
  ['SSTORE does not taint later unrelated operands', '325f5560013314', false],
  ['SLOAD output not guessed from origin key', '3254600114', false],
  ['MLOAD output not guessed from origin offset', '3251600114', false],
  ['TLOAD output not guessed from origin key', '325c600114', false],
  ['CALL consumes origin argument and returns unknown', '32'+'5f'.repeat(6)+'f1600114', false],
  ['LOG1 consumes origin topic and does not poison stack', '325f5fa160013314', false],
];
for (const [label, code, expected] of cases) test(`origin operand dataflow: ${label}`, () => {
  assert.equal(trace(branch(code)).length > 0, expected);
});
for (const neutralPairs of [0, 1, 4, 8, 12, 32, 128]) test(`origin dependency beyond proximity window: ${neutralPairs} neutral pairs`, () => {
  const hex = branch('32' + '5f50'.repeat(neutralPairs) + '600114');
  const rows = trace(hex);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].originPc, 0);
  assert.equal(disassembleBytecode(hex).instructions.find(i => i.pc === rows[0].branchPc)?.name, 'JUMPI');
});
test('an origin equality returned as data is not called an authorization branch', () => {
  assert.equal(trace('0x326001145f5260205ff3').length, 0);
});
test('origin in JUMPI destination does not taint independent condition', () => {
  assert.equal(trace('0x6001325700').length, 0);
});
test('fallthrough carries actual stack provenance across JUMPDEST', () => {
  assert.equal(trace(branch('325b600114')).length, 1);
});
test('memory roundtrip is explicitly outside this block-local model', () => {
  assert.equal(trace(branch('325f525f51600114')).length, 0);
  assert.match(ORIGIN_DATAFLOW_LIMITATION, /memory\/storage\/call/);
});
test('overflowing local fragment cannot fabricate subsequent origin branch', () => {
  assert.equal(trace(branch('5f'.repeat(1025)+'32600114')).length, 0);
});
test('output bound is deterministic and does not mutate CFG input', () => {
  const hex = branch('32600114').slice(2).repeat(80);
  const cfg = graph(hex);
  const before = [...cfg.blocks.values()].map(b => [b.id, [...b.successors], [...b.predecessors]]);
  const rows = findOriginDependentBranches(cfg);
  assert.equal(rows.length, 64);
  assert.deepEqual(findOriginDependentBranches(cfg), rows);
  assert.deepEqual([...cfg.blocks.values()].map(b => [b.id, [...b.successors], [...b.predecessors]]), before);
});
test('actual FullV2 report uses exact branch endpoint and no confirmed authorization claim', () => {
  const hex = branch('32'+'5f50'.repeat(12)+'600114');
  const r = executeFullAuditV2({ contractAddress: address, chainId: '1', bytecode: hex, fuzzIterations: 0 });
  const f = r.findings.find(x => x.findingId === 'VLM-SEC-AUTH-TXORIGIN-01');
  assert.ok(f);
  assert.equal(f.bytecodeOffset?.pcEnd, trace(hex)[0].branchPc);
  assert.equal(f.claimState, 'HEURISTIC_CANDIDATE');
  assert.equal(f.exploitability, 'theoretical');
  assert.match(f.title, /Authorization Purpose Unverified/);
  assert.ok(f.limitations?.includes(ORIGIN_DATAFLOW_LIMITATION));
  assert.equal(r.scores.overallScore, null);
});
test('unbound submitted source cannot remove the observed origin branch', () => {
  const options = { contractAddress: address, chainId: '1', bytecode: branch('32600114'), fuzzIterations: 0 };
  const baseline = executeFullAuditV2(options);
  const other = executeFullAuditV2({ ...options, sourceCode: 'contract Other { function ok() external pure returns(bool) { return true; } }' });
  const find = (r: ReturnType<typeof executeFullAuditV2>) => r.findings.find(x => x.findingId === 'VLM-SEC-AUTH-TXORIGIN-01');
  assert.deepEqual(find(other), find(baseline));
});

for (const code of ['323314', '333214', '32331415', '3273'+'ff'.repeat(20)+'163373'+'ff'.repeat(20)+'161415']) test(`pure caller equality is a contextual observation: ${code}`, () => {
  const hex=branch(code); const b=trace(hex); assert.ok(b.some(x=>x.directCallerComparison));
  const r=executeFullAuditV2({contractAddress:address,chainId:'1',bytecode:hex,fuzzIterations:0});
  assert.ok(!r.findings.some(f=>f.findingId==='VLM-SEC-AUTH-TXORIGIN-01'));
  const context=r.findings.find(f=>f.findingId==='VLM-SEC-CONTEXT-ORIGIN-CALLER-01');assert.ok(context);assert.equal(context.taxonomy.swcId,undefined);
});
for (const code of ['3233143260011417', '323310', '32600114', '323314600117']) test(`compound or other comparisons are not suppressed: ${code}`,()=>{
  const r=trace(branch(code));assert.ok(r.some(x=>!x.directCallerComparison));
});
test('constant-resolved helper jump retains origin and return-address stack',()=>{
  // PUSH return-label; ORIGIN; PUSH helper; JUMP; return: comparison; branch.
  const hex='0x61000832610017565b60011461001457000000005b00005b9056';
  const rows=trace(hex);assert.ok(rows.some(x=>x.originPc===3 && x.branchPc===15));
});
test('an unresolved jump cannot borrow an unrelated later origin condition',()=>{
  assert.equal(trace('0x3235565b600114600b57005b00').length,0);
});
test('constant resolved loop terminates within deterministic bounds',()=>{
  const rows=trace('0x5b326000565b600114600e5700005b00');assert.deepEqual(rows,[]);
});
