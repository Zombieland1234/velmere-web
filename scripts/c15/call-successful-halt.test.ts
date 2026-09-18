import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disassembleBytecode, buildControlFlowGraph } from '../../lib/security/v2/evm-cfg-dataflow-engine';
import { analyzeUncheckedLowLevelCalls } from '../../lib/security/v2/unchecked-low-level-call-engine';
const address = '0x0000000000000000000000000000000000000015';
for (const op of ['f1', 'f2', 'f4', 'fa']) {
  const prefix = '6000'.repeat(op === 'f1' || op === 'f2' ? 5 : 4) + '60015a' + op;
  const run = (code: string) => analyzeUncheckedLowLevelCalls(address, buildControlFlowGraph(disassembleBytecode('0x' + code).instructions));
  for (const [name, suffix] of [['STOP', '00'], ['END_OF_CODE', '']] as const) {
    test(`C15 ${op}: ${name} abandons the success word without requiring POP`, () => {
      const findings = run(prefix + suffix); assert.equal(findings.length, 1);
      assert.equal(findings[0].taxonomy.swcId, 'SWC-104'); assert.ok(findings[0].evidence.opcodeTraceExcerpt?.includes(name));
      assert.equal(findings[0].severity, 'high');
    });
  }
  test(`C15 ${op}: REVERT still does not count as successful abandonment`, () => {
    assert.deepEqual(run(prefix + '5f5ffd'), []);
  });
  test(`C15 ${op}: RETURN may consume the result, so this narrow rule does not guess`, () => {
    assert.deepEqual(run(prefix + 'f3'), []);
  });
}
