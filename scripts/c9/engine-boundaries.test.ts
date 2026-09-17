import {test} from 'node:test';
import assert from 'node:assert/strict';
import solc from 'solc';
import {disassembleBytecode,buildControlFlowGraph} from '../../lib/security/v2/evm-cfg-dataflow-engine';
import {executeFullAuditV2} from '../../lib/security/v2/master-audit-orchestrator';
import {analyzeReentrancyGuardCoverage} from '../../lib/security/solidity-structured-signal.mjs';
const action='uint x=b[msg.sender];(bool ok,)=msg.sender.call{value:x}("");require(ok);b[msg.sender]=0;';
const source=(guard:string,extra='')=>`pragma solidity ^0.8.20;contract Case{mapping(address=>uint)b;bool entered;bool locked;modifier mutex(){${guard}}function w()external mutex{${action}}${extra}}`;
function compile(input:string){const result=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'Case.sol':{content:input}},settings:{optimizer:{enabled:false},outputSelection:{'*':{'*':['evm.deployedBytecode.object']}}}})));assert.deepEqual((result.errors??[]).filter((x:{severity:string})=>x.severity==='error'),[]);return '0x'+result.contracts['Case.sol'].Case.evm.deployedBytecode.object;}
const broken:{[key:string]:string}={
 'unlock-before-body':'require(!entered);entered=true;entered=false;_;',
 'enter-after-body':'require(!entered);_;entered=true;entered=false;',
 'mixed-lock-variables':'require(!locked);entered=true;_;entered=false;',
 'tautological-check':'require(entered||true);entered=true;_;entered=false;',
 'unreachable-lock':'if(false){require(!entered);entered=true;entered=false;}_;',
 'local-variable-shadow':'bool entered=false;require(!entered);entered=true;_;entered=false;',
 'double-placeholder':'require(!entered);entered=true;_;entered=false;_;',
};
for(const [id,guard]of Object.entries(broken))test(`C9-GUARD-${id}: compiled invalid mutex never suppresses the review candidate`,()=>{
 const text=source(guard);const runtime=compile(text);assert.equal(analyzeReentrancyGuardCoverage(text).allSupportedPathsGuarded,false);
 const r=executeFullAuditV2({contractAddress:'0x00000000000000000000000000000000000000c9',chainId:'1',bytecode:runtime,sourceCode:text,tier:'ADVANCED',fuzzIterations:2});
 assert.ok(r.findings.some(f=>f.findingId==='VLM-SEC-REENTRANCY-01'||f.findingId.includes('REENTRANCY-ORDER')),JSON.stringify(r.findings.map(f=>f.findingId)));
});
test('C9-GUARD-valid: straight-line storage boolean mutex remains recognized',()=>{
 const s=source('require(!entered);entered=true;_;entered=false;');compile(s);assert.equal(analyzeReentrancyGuardCoverage(s).allSupportedPathsGuarded,true);
});
test('C9-GUARD-external-reset: callable reset prevents global mutex suppression',()=>{
 const s=source('require(!entered);entered=true;_;entered=false;','function reset()external{entered=false;}');compile(s);assert.equal(analyzeReentrancyGuardCoverage(s).allSupportedPathsGuarded,false);
});
test('C9-GUARD-inline-late: lock-looking statements after the callback are not protection',()=>{
 const s=`pragma solidity ^0.8.20;contract Case{mapping(address=>uint)b;bool entered;function w()external{${action}require(!entered);entered=true;entered=false;}}`;compile(s);assert.equal(analyzeReentrancyGuardCoverage(s).allSupportedPathsGuarded,false);
});
test('C9-GUARD-name-independent: legitimate storage lock is not recognized by a magic identifier',()=>{
 for(const name of ['busy','mutexState','guardFlag']){const s=source('require(!entered);entered=true;_;entered=false;').replace(/entered/g,name);compile(s);assert.equal(analyzeReentrancyGuardCoverage(s).allSupportedPathsGuarded,true);}
});
test('C9-GUARD-comments: inert text is not guard control flow',()=>{
 const s=source('/* require(!entered);entered=true;_;entered=false; */ _;');compile(s);assert.equal(analyzeReentrancyGuardCoverage(s).allSupportedPathsGuarded,false);
});
test('C9-GUARD-no-name-exemption: a state variable named locked still contributes state effects',()=>{
 const s='pragma solidity ^0.8.20;contract Case{uint locked;function w()external{(bool ok,)=msg.sender.call{value:1}("");require(ok);locked=2;}}';compile(s);assert.equal(analyzeReentrancyGuardCoverage(s).unguardedPaths,1);
});
test('C9-EVM-push-padding: all immediate widths and truncation positions match right-zero semantics',()=>{
 for(let width=1;width<=32;width++)for(let actual=0;actual<=width;actual++){
  const hex=(0x5f+width).toString(16)+'ab'.repeat(actual);const r=disassembleBytecode(hex).instructions[0];
  const expected=BigInt('0x'+('ab'.repeat(actual)+'00'.repeat(width-actual)));
  assert.equal(r.pushValueBigInt,expected,`${width}/${actual}`);assert.equal(r.size,1+width);
 }
});
test('C9-EVM-push0: zero immediate and one-byte width are represented',()=>{
 const r=disassembleBytecode('0x5f').instructions[0];assert.equal(r.name,'PUSH0');assert.equal(r.pushValueBigInt,0n);assert.equal(r.size,1);
});
test('C9-EVM-opcodes: every DUP/SWAP/LOG opcode has its canonical name',()=>{
 for(let n=1;n<=16;n++){assert.equal(disassembleBytecode((0x7f+n).toString(16)).instructions[0].name,`DUP${n}`);assert.equal(disassembleBytecode((0x8f+n).toString(16)).instructions[0].name,`SWAP${n}`);}
 for(let n=0;n<=4;n++)assert.equal(disassembleBytecode((0xa0+n).toString(16)).instructions[0].name,`LOG${n}`);
});
for(const hex of ['0x0','0xgg','0x6000zz','0x60 00','0x600'])test(`C9-EVM-invalid-hex-${hex}: no silent Buffer truncation`,()=>assert.throws(()=>disassembleBytecode(hex),/INVALID_HEX/));
test('C9-EVM-input-bound: oversized buffers rejected before allocation',()=>assert.throws(()=>disassembleBytecode('00'.repeat(1000001)),/INPUT_LIMIT/));
test('C9-EVM-sstore: key is on top, not the preceding stored value',()=>{
 const r=buildControlFlowGraph(disassembleBytecode('0x600160025500').instructions);assert.deepEqual([...r.storageSlotsWritten],['0x2']);
});
test('C9-EVM-stack-shape: SLOAD/POP/caller do not leave stale keys as known writes',()=>{
 assert.deepEqual([...buildControlFlowGraph(disassembleBytecode('600260033355').instructions).storageSlotsWritten],['unknown']);
 assert.deepEqual([...buildControlFlowGraph(disassembleBytecode('60026001545055').instructions).storageSlotsWritten],['0x2']);
});
test('C9-EVM-no-mutex-from-constant: incidental SSTORE never proves a reentrancy guard',()=>{
 const r=buildControlFlowGraph(disassembleBytecode('6000600360015500').instructions);assert.equal(r.hasReentrancyGuard,false);assert.equal(r.guardedStorageSlots.size,0);
});
test('C9-EVM-invalid-jumpdest: byte inside a block is not a legal jump target',()=>{
 const r=buildControlFlowGraph(disassembleBytecode('60005700').instructions);assert.equal(r.cfg.unresolvedDynamicJumps,1);assert.ok(!r.cfg.blocks.get('block_0')!.successors.includes('block_0'));
});
test('C9-EVM-valid-jumpdest: real JUMPDEST edges remain present',()=>{
 const r=buildControlFlowGraph(disassembleBytecode('6003565b00').instructions);assert.equal(r.cfg.unresolvedDynamicJumps,0);assert.deepEqual(r.cfg.blocks.get('block_0')!.successors,['block_3']);
});
