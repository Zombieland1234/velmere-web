import {test} from 'node:test';
import assert from 'node:assert/strict';
import solc from 'solc';
import {executeFullAuditV2} from '../../lib/security/v2/master-audit-orchestrator';
import {computeMultiDimensionalScores} from '../../lib/security/v2/scoring-and-evidence-engine';
import {analyzeReentrancyGuardCoverage} from '../../lib/security/solidity-structured-signal.mjs';
import {analyzeContextualReentrancy} from '../../lib/security/v2/contextual-reentrancy-engine';
import {disassembleBytecode,buildControlFlowGraph} from '../../lib/security/v2/evm-cfg-dataflow-engine';
const addr='0x00000000000000000000000000000000000000c9';
const action='uint x=b[msg.sender];(bool ok,)=msg.sender.call{value:x}("");require(ok);b[msg.sender]=0;';
const unsafe=`pragma solidity ^0.8.20; contract A {mapping(address=>uint)b;function w()external{${action}}}`;
const guarded=`pragma solidity ^0.8.20; contract A {mapping(address=>uint)b;bool entered;modifier guard(){require(!entered);entered=true;_;entered=false;}function w()external guard{${action}}}`;
function compile(source:string){const c=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'A.sol':{content:source}},settings:{outputSelection:{'*':{'*':['evm.deployedBytecode.object']}}}})));assert.deepEqual((c.errors??[]).filter((e:{severity:string})=>e.severity==='error'),[]);return '0x'+c.contracts['A.sol'].A.evm.deployedBytecode.object;}
test('unrelated guarded source cannot suppress a compiled vulnerable runtime finding',()=>{
 assert.ok(analyzeReentrancyGuardCoverage(guarded).allSupportedPathsGuarded);
 const r=executeFullAuditV2({contractAddress:addr,chainId:'1',bytecode:compile(unsafe),sourceCode:guarded,fuzzIterations:1});
 assert.ok(r.findings.some(f=>f.findingId==='VLM-SEC-REENTRANCY-01'));
 assert.ok(r.findings.every(f=>f.claimState==='HEURISTIC_CANDIDATE'));
 assert.ok(r.findings.every(f=>f.confidence!=='certain'&&f.confidence!=='high'));
 assert.equal(r.scores.overallScore,null);assert.equal(r.scores.assessmentConfidence,null);
});
test('no findings with supplied source and deep resolved CFG still cannot claim 99 or complete coverage',()=>{
 const score=computeMultiDimensionalScores([],{instructionCount:1000,blockCount:60,cyclomaticComplexity:4,unresolvedDynamicJumps:0},false,{sourceProvided:true,meaningfulBytecode:true});
 assert.equal(score.overallScore,null);assert.equal(score.assessmentConfidence,null);assert.equal(score.assessmentState,'ANALYSIS_INCOMPLETE');assert.ok(score.coverage.limitations.includes('SOURCE_RUNTIME_IDENTITY_NOT_VERIFIED'));
});
test('no represented reentrancy signal is not a CEI proof when jumps are unresolved',()=>{
 const cfg=buildControlFlowGraph(disassembleBytecode('60005700').instructions);
 const result=analyzeContextualReentrancy(addr,cfg);
 assert.equal(result.ceiAdherence,null);assert.ok(result.limitations.some(x=>x.startsWith('UNRESOLVED_DYNAMIC_JUMPS:')));
});
test('all bounded bytecode observations carry explicit unexecuted candidate status',()=>{
 const r=executeFullAuditV2({contractAddress:addr,chainId:'1',bytecode:'0x32ff',fuzzIterations:1});
 assert.ok(r.findings.length);assert.ok(r.findings.every(f=>f.claimState==='HEURISTIC_CANDIDATE'&&f.exploitability==='theoretical'));assert.ok(r.findings.every(f=>f.limitations?.some(x=>x.includes('No target exploit execution'))));
});
