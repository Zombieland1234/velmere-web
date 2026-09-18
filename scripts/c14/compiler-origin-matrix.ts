import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { executeFullAuditV2 } from '../../lib/security/v2/master-audit-orchestrator';
const require = createRequire(import.meta.url);
const solc = require('solc') as { compile(input: string): string; version(): string };
const out = process.argv[2];
if (!out) throw new Error('evidence directory required');
fs.mkdirSync(out, { recursive: true });
const fixtures = [
  { id: 'owner-authorization', expected: true, body: 'address owner; uint x; constructor(){owner=msg.sender;} function f() external {require(tx.origin == owner); x=7;}' },
  { id: 'caller-authorization-control', expected: false, body: 'address owner; uint x; constructor(){owner=msg.sender;} function f() external {require(msg.sender == owner); x=7;}' },
  { id: 'origin-inequality', expected: true, body: 'uint x; function f(address a) external {require(tx.origin != a); x=7;}' },
  { id: 'origin-view-only-control', expected: false, body: 'address owner; function f() external view returns(bool) {return tx.origin == owner;}' },
  { id: 'origin-discarded-before-caller-check', expected: false, body: 'uint x; function f(address a) external {assembly {pop(origin())} require(msg.sender == a); x=7;}' },
  { id: 'origin-via-invert', expected: true, body: 'uint x; function f(address a) external {if (!(tx.origin != a)) {x=7;} else {revert();}}' },
];
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
// Freeze source and settings before observing either detector result.
const cases = fixtures.flatMap(f => [false, true].flatMap(viaIR => [false, true].map(optimize => ({ ...f, viaIR, optimize }))));
fs.writeFileSync(path.join(out, 'COMPILER_INPUTS.json'), JSON.stringify({ sourceSha: process.env.GITHUB_SHA ?? null, compiler: solc.version(), evmVersion: 'cancun', scope: 'AUTHOR_CREATED_DEVELOPMENT_FIXTURES_NOT_BLIND_HOLDOUT', cases }, null, 2));
const rows = cases.map(f => {
  const source = '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0; contract Case {' + f.body + '}';
  const compiled = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'Case.sol': { content: source } }, settings: { evmVersion: 'cancun', viaIR: f.viaIR, optimizer: { enabled: f.optimize, runs: 200 }, metadata: { bytecodeHash: 'none' }, outputSelection: { '*': { '*': ['evm.deployedBytecode.object'] } } } })));
  const errors = (compiled.errors ?? []).filter((e: { severity: string }) => e.severity === 'error');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const runtime: string = compiled.contracts['Case.sol'].Case.evm.deployedBytecode.object;
  assert.ok(runtime.length > 0);
  // No submitted source: the assertion exercises the bytecode lane alone.
  const report = executeFullAuditV2({ contractAddress: '0x0000000000000000000000000000000000000014', chainId: '1', bytecode: '0x' + runtime, fuzzIterations: 0 });
  const findings = report.findings.filter(x => x.findingId === 'VLM-SEC-AUTH-TXORIGIN-01');
  return { id: f.id, viaIR: f.viaIR, optimize: f.optimize, sourceSha256: hash(source), runtimeSha256: hash(Buffer.from(runtime, 'hex')), runtimeBytes: runtime.length / 2, expectedCandidate: f.expected, candidateObserved: findings.length > 0, passed: (findings.length > 0) === f.expected, findings };
});
fs.writeFileSync(path.join(out, 'COMPILER_MATRIX.json'), JSON.stringify({ sourceSha: process.env.GITHUB_SHA ?? null, scope: 'ACTUAL_SOLC_COMPILATION_AND_STATIC_ANALYSIS_NOT_EVM_EXECUTION', compiler: solc.version(), compilerInvocations: rows.length, uniqueRuntimeCount: new Set(rows.map(r => r.runtimeSha256)).size, passed: rows.filter(r => r.passed).length, total: rows.length, rows }, null, 2));
console.log(JSON.stringify({ total: rows.length, passed: rows.filter(r => r.passed).length, failed: rows.filter(r => !r.passed).map(r => ({ id: r.id, viaIR: r.viaIR, optimize: r.optimize })) }));
if (rows.some(r => !r.passed)) process.exitCode = 1;
