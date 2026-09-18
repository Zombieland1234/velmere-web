import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disassembleBytecode, buildControlFlowGraph, type CfgAnalysisResult } from '../../lib/security/v2/evm-cfg-dataflow-engine';
import { analyzeContextualReentrancy } from '../../lib/security/v2/contextual-reentrancy-engine';
import { analyzeUncheckedLowLevelCalls } from '../../lib/security/v2/unchecked-low-level-call-engine';
import { analyzeErcAndTokenQuirks } from '../../lib/security/v2/erc-and-nonstandard-token-engine';
import { fuseStructuredSourceCandidates } from '../../lib/security/v2/structured-source-fusion';
import { executeFullAuditV2 } from '../../lib/security/v2/master-audit-orchestrator';

const address = '0x000000000000000000000000000000000000c428';
const cfg = (hex: string) => buildControlFlowGraph(disassembleBytecode(hex).instructions);
const hasSwc = (findings: Array<{taxonomy:{swcId?:string}}>, swc: string) => findings.some(f => f.taxonomy.swcId === swc);

// SLOAD slot 0; POP; CALL arguments with GAS opcode; CALL; SSTORE slot 0; STOP.
const reentrantLike = '0x600054506000600060006000600060015af1600160005500';
// Same ordering but CALL is explicitly capped at 2300 gas (legacy send/transfer stipend).
const stipendCall = '0x600054506000600060006000600060016108fcf1600160005500';
// CALL -> SSTORE with no represented state read before the interaction.
const postWriteOnly = '0x6000600060006000600060015af1600160005500';
// CALL success word immediately discarded.
const uncheckedCall = '0x6000600060006000600060015af15000';
// CALL success participates in a conditional branch rather than POP.
const checkedCall = '0x6000600060006000600060015af115600f57005b00';

test('C14-P28 reentrancy positive: non-stipend CALL with represented pre-read and post-write keeps SWC-107', () => {
  const result = analyzeContextualReentrancy(address, cfg(reentrantLike));
  assert.ok(hasSwc(result.findings, 'SWC-107'), JSON.stringify(result.findings.map(f => ({id:f.findingId,swc:f.taxonomy.swcId}))));
  assert.ok(result.findings.some(f => f.findingId === 'VLM-SEC-REENTRANCY-01'));
});

test('C14-P28 reentrancy negative: 2300-gas send-style CALL is review-only, not SWC-107', () => {
  const result = analyzeContextualReentrancy(address, cfg(stipendCall));
  assert.equal(hasSwc(result.findings, 'SWC-107'), false);
  assert.ok(result.findings.some(f => f.findingId === 'VLM-SEC-EXTERNAL-CALL-POST-WRITE-REVIEW-01'));
});

test('C14-P28 reentrancy negative: post-call write without represented pre-call state read is review-only', () => {
  const result = analyzeContextualReentrancy(address, cfg(postWriteOnly));
  assert.equal(hasSwc(result.findings, 'SWC-107'), false);
  assert.ok(result.findings.some(f => f.findingId === 'VLM-SEC-EXTERNAL-CALL-POST-WRITE-REVIEW-01'));
});

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

test('C14-P28 source negative: checked send and stipend ordering produce neither unchecked-call nor reentrancy SWC candidate', () => {
  const source = `pragma solidity ^0.4.24; contract T { uint state; function pay(uint x) public { if (!msg.sender.send(x)) { revert(); } state = 1; } }`;
  const findings = fuseStructuredSourceCandidates(address, source);
  assert.equal(findings.some(f => f.findingId === 'VLM-SEC-STRUCTURED-UNCHECKED-CALL'), false);
  assert.equal(hasSwc(findings, 'SWC-107'), false);
});

test('C14-P28 source positive: genuinely discarded low-level call remains a structured SWC-104 candidate', () => {
  const source = `pragma solidity ^0.8.20; contract T { function ping(address to) external { to.call(""); } }`;
  const findings = fuseStructuredSourceCandidates(address, source);
  assert.ok(findings.some(f => f.findingId === 'VLM-SEC-STRUCTURED-UNCHECKED-CALL' && f.taxonomy.swcId === 'SWC-104'));
});

test('C14-P28 cross-class regression: SWC-104 runtime proof does not manufacture SWC-107', () => {
  const result = executeFullAuditV2({contractAddress:address, chainId:'1', bytecode:uncheckedCall, tier:'BASIC', fuzzIterations:0});
  assert.ok(result.findings.some(f => f.taxonomy.swcId === 'SWC-104'));
  assert.equal(result.findings.some(f => f.taxonomy.swcId === 'SWC-107'), false);
});
