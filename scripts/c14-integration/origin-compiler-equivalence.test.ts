import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disassembleBytecode, buildControlFlowGraph } from '../../lib/security/v2/evm-cfg-dataflow-engine';
import { findOriginDependentBranches } from '../../lib/security/v2/origin-branch-dataflow';

// SUB/XOR of the exact two addresses is zero exactly when the addresses match.
// This is a generic arithmetic identity, not a compiler version or corpus match.
function trace(prefix: string) {
  const target = prefix.length / 2 + 5;
  const hex = '0x' + prefix + '61' + target.toString(16).padStart(4, '0') + '57005b00';
  return findOriginDependentBranches(buildControlFlowGraph(disassembleBytecode(hex).instructions).cfg);
}
for (const [id, prefix, pureComparison] of [
  ['origin caller subtraction', '323303', true],
  ['caller origin subtraction', '333203', true],
  ['origin caller xor', '323318', true],
  ['caller origin xor inversion', '33321815', true],
  ['owner storage subtraction remains candidate', '325f5403', false],
  ['constant address subtraction remains candidate', '32600103', false],
  ['compound owner predicate is not suppressed', '323303325f541416', false],
  ['adding identities is not an equality proof', '323301', false],
] as const) {
  test(`origin compiler equivalence: ${id}`, () => {
    const rows = trace(prefix);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].directCallerComparison, pureComparison);
  });
}
