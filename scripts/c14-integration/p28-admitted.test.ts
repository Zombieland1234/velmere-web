import { test } from "node:test";
import assert from "node:assert/strict";
import { disassembleBytecode, buildControlFlowGraph, type CfgAnalysisResult } from "../../lib/security/v2/evm-cfg-dataflow-engine";
import { analyzeUncheckedLowLevelCalls } from "../../lib/security/v2/unchecked-low-level-call-engine";
import { analyzeErcAndTokenQuirks } from "../../lib/security/v2/erc-and-nonstandard-token-engine";
const address = "0x000000000000000000000000000000000000c428";
const cfg = (hex: string) => buildControlFlowGraph(disassembleBytecode(hex).instructions);
const uncheckedCall = "0x6000600060006000600060015af15000";
const checkedCall = "0x6000600060006000600060015af115600f57005b00";
test('C14-P28 SWC-104 positive: CALL followed immediately by POP is detected from runtime bytecode', () => {
  const findings = analyzeUncheckedLowLevelCalls(address, cfg(uncheckedCall));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].taxonomy.swcId, 'SWC-104');
  assert.equal(findings[0].findingId, 'VLM-SEC-UNCHECKED-LOW-LEVEL-CALL-01');
});

test('C14-P28 SWC-104 negative: checked CALL result is not classified as unchecked', () => {
  assert.deepEqual(analyzeUncheckedLowLevelCalls(address, cfg(checkedCall)), []);
});

test('C14-P28 selector positive: real PUSH4/EQ/JUMPI dispatcher branch is admitted', () => {
  const result = cfg('0x8063a9059cbb14600a575b00');
  assert.ok(result.selectorsDiscovered.has('0xa9059cbb'));
});

test('C14-P28 selector negative: arbitrary PUSH4 constant is not a function selector', () => {
  const result = cfg('0x63a9059cbb5000');
  assert.equal(result.selectorsDiscovered.has('0xa9059cbb'), false);
});

test('C14-P28 taxonomy negative: ERC no-bool compatibility quirk is not mislabeled SWC-104', () => {
  const empty = cfg('0x00');
  const selectors = new Map<string, number>([
    ['0x18160ddd', 1], ['0x70a08231', 2], ['0xa9059cbb', 3],
  ]);
  const fake: CfgAnalysisResult = {...empty, selectorsDiscovered: selectors};
  const source = 'pragma solidity ^0.4.24; contract T { function transfer(address to,uint value) public { } }';
  const result = analyzeErcAndTokenQuirks(address, fake, source);
  const finding = result.findings.find(f => f.findingId === 'VLM-SEC-ERC-NON-STANDARD-RETURN-01');
  assert.ok(finding);
  assert.equal(finding.taxonomy.swcId, undefined);
});


for (const opcode of ["f1", "f2", "f4", "fa"]) {
  test(`C14 integration: CALL-family ${opcode} has a discarded-status candidate`, () => {
    const result = analyzeUncheckedLowLevelCalls(address, cfg(`0x6000600060006000600060015a${opcode}5000`));
    assert.equal(result.length, 1);
    assert.equal(result[0].taxonomy.swcId, "SWC-104");
  });
}
for (const suffix of ["60006000fd", "fe"]) {
  test(`C14 integration: unconditional exceptional termination ${suffix} is not unchecked success`, () => {
    const result = analyzeUncheckedLowLevelCalls(address, cfg(`0x6000600060006000600060015af150${suffix}`));
    assert.deepEqual(result, []);
  });
}
