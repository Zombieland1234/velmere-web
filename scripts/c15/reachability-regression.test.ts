import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildControlFlowGraph, disassembleBytecode } from '../../lib/security/v2/evm-cfg-dataflow-engine';
import { analyzeUncheckedLowLevelCalls } from '../../lib/security/v2/unchecked-low-level-call-engine';
import { executeFullAuditV2 } from '../../lib/security/v2/master-audit-orchestrator';

const address = '0x0000000000000000000000000000000000000015';
const calls = ['f1', 'f2', 'f4', 'fa'] as const;
function unchecked(op: string) { return '6000'.repeat(op === 'f1' || op === 'f2' ? 5 : 4) + '60015a' + op + '50'; }
const analyze = (hex: string) => analyzeUncheckedLowLevelCalls(address, buildControlFlowGraph(disassembleBytecode('0x' + hex).instructions));
for (const op of calls) {
  test(`C15 ${op}: live immediate status discard remains a candidate`, () => {
    const f = analyze(unchecked(op) + '00');
    assert.equal(f.length, 1); assert.equal(f[0].taxonomy.swcId, 'SWC-104'); assert.equal(f[0].severity, 'high');
  });
  for (const halt of ['00', '5f5ff3', '5f5ffd', 'fe', '5fff', '0c']) {
    test(`C15 ${op}: unreachable tail after ${halt} is not a candidate`, () => {
      assert.deepEqual(analyze(halt + unchecked(op) + '00'), []);
    });
  }
  test(`C15 ${op}: unreferenced JUMPDEST after STOP is not an entry point`, () => {
    assert.deepEqual(analyze('005b' + unchecked(op) + '00'), []);
  });
  test(`C15 ${op}: static JUMP can reach a call beyond STOP`, () => {
    assert.equal(analyze('600456005b' + unchecked(op) + '00').length, 1);
  });
  test(`C15 ${op}: dynamic JUMP retains a legal destination`, () => {
    assert.equal(analyze('5f3556005b' + unchecked(op) + '00').length, 1);
  });
  test(`C15 ${op}: dynamic JUMPI retains fallthrough`, () => {
    assert.equal(analyze('365f3557' + unchecked(op) + '00').length, 1);
  });
  test(`C15 ${op}: invalid immediate JUMP into PUSH-data has no successful continuation`, () => {
    assert.deepEqual(analyze('600456615b00005b' + unchecked(op) + '00'), []);
  });
}

test('C15 shared selector evidence and raw CFG are not mutated', () => {
  const cfg = buildControlFlowGraph(disassembleBytecode('0x0063feaf968c' + unchecked('f1') + '00').instructions);
  const blocks = [...cfg.cfg.blocks.values()].map(b => [b.id, [...b.successors], b.instructions.length]);
  analyzeUncheckedLowLevelCalls(address, cfg);
  assert.equal(cfg.selectorsDiscovered.has('0xfeaf968c'), true);
  assert.deepEqual([...cfg.cfg.blocks.values()].map(b => [b.id, [...b.successors], b.instructions.length]), blocks);
});

test('C15 full orchestrator excludes dead call evidence but preserves live evidence', () => {
  const run = (code: string, sourceCode?: string) => executeFullAuditV2({ contractAddress: address, chainId: '1', bytecode: '0x' + code, sourceCode, fuzzIterations: 0 });
  const find = (r: ReturnType<typeof run>) => r.findings.filter(f => f.findingId === 'VLM-SEC-UNCHECKED-LOW-LEVEL-CALL-01');
  assert.equal(find(run('00' + unchecked('f1') + '00')).length, 0);
  assert.equal(find(run(unchecked('f1') + '00')).length, 1);
  assert.equal(find(run(unchecked('f1') + '00', 'contract Unbound { function f() external { require(true); } }')).length, 1);
});
