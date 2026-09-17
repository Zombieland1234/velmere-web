import { test } from 'node:test';
import assert from 'node:assert/strict';
import solc from 'solc';
import { executeFullAuditV2 } from '../../lib/security/v2/master-audit-orchestrator';
import { computeMultiDimensionalScores, generateAuditSnapshotId } from '../../lib/security/v2/scoring-and-evidence-engine';
import { fuseStructuredSourceCandidates } from '../../lib/security/v2/structured-source-fusion';
import { analyzeReentrancyGuardCoverage } from '../../lib/security/solidity-structured-signal.mjs';

const PRE='// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n';
const ADDRESS='0x00000000000000000000000000000000000000c7';

function compile(source:string, contractName:string):string {
  const compiled=JSON.parse(solc.compile(JSON.stringify({
    language:'Solidity',sources:{'Case.sol':{content:source}},
    settings:{optimizer:{enabled:false},outputSelection:{'*':{'*':['evm.deployedBytecode.object']}}}
  })));
  const errors=(compiled.errors??[]).filter((e:any)=>e.severity==='error');
  assert.equal(errors.length,0,JSON.stringify(errors));
  const object=compiled.contracts['Case.sol'][contractName].evm.deployedBytecode.object;
  return '0x'+object;
}

function audit(source:string, bytecode:string, extra:Record<string,unknown>={}) {
  return executeFullAuditV2({contractAddress:ADDRESS,chainId:'1',sourceCode:source,bytecode,contractName:'Case',tier:'ADVANCED',fuzzIterations:8,...extra});
}

test('placeholder or missing bytecode coverage cannot produce a 99 safety score',()=>{
  const r=audit(PRE+'contract Case {}','0x00');
  assert.equal(r.scores.assessmentState,'ANALYSIS_INCOMPLETE');
  assert.equal(r.scores.overallScore,null);
  assert.ok(r.scores.coverage.limitations.includes('BYTECODE_MISSING_OR_PLACEHOLDER'));
  assert.equal(r.scores.scopeStatement,'AVAILABLE_DETECTORS_ONLY_NOT_SECURITY_CERTIFICATION');
});

test('snapshot digest is content-stable while observation timestamp remains metadata',()=>{
  const input={contractAddress:ADDRESS,chainId:'1',bytecode:'0x60006000',sourceCode:'contract Case{}'};
  const a=generateAuditSnapshotId(input),b=generateAuditSnapshotId(input);
  assert.equal(a.snapshotDigest,b.snapshotDigest);
  assert.match(a.snapshotDigest,/^0x[a-f0-9]{64}$/);
});

test('no block number is invented when the caller did not provide one',()=>{
  const source=PRE+'contract Case { function x() external pure returns(uint){return 1;} }';
  const r=audit(source,compile(source,'Case'));
  assert.equal(r.snapshot.blockNumber,undefined);
});

test('synthetic fuzz results never claim target-bytecode execution',()=>{
  const source=PRE+'contract Case { function x() external pure returns(uint){return 1;} }';
  const r=audit(source,compile(source,'Case'));
  assert.equal(r.fuzzResults.executionScope,'SYNTHETIC_BALANCE_MODEL_NOT_TARGET_BYTECODE');
  assert.equal(r.fuzzResults.targetExecuted,false);
  assert.ok(r.invariants.every(x=>x.evaluationScope==='SYNTHETIC_BALANCE_MODEL_ONLY'&&x.targetEvaluated===false));
  assert.ok(r.formalAssurance.every(x=>x.proven===false&&x.status==='NOT_VERIFIED'&&x.solver==='NOT_RUN'));
});

test('remediation proposals remain explicitly un-applied without an executor/compiler/regression runner',()=>{
  const source=PRE+'contract Case { mapping(address=>uint) b; function w() external { uint x=b[msg.sender]; (bool ok,)=msg.sender.call{value:x}(""); require(ok); b[msg.sender]=0; } }';
  const r=audit(source,compile(source,'Case'));
  const withPatch=r.findings.filter(f=>Boolean(f.remediation.solidityPatchDiff));
  assert.ok(withPatch.length>0);
  assert.ok(withPatch.every(f=>f.remediation.appliedSuccessfully===false&&f.remediation.regressionPassed===false));
  assert.equal(r.patchValidation.patchesPassingRegression,0);
});

test('recognized function-scoped mutex suppresses CALL->guard-exit-SSTORE false positive without comment/name suppression',()=>{
  const unsafe=PRE+'contract Case { mapping(address=>uint) b; function w() external { uint x=b[msg.sender]; (bool ok,)=msg.sender.call{value:x}(""); require(ok); b[msg.sender]=0; } }';
  const guarded=PRE+'contract Case { mapping(address=>uint) b; bool private entered; modifier nonReentrant(){require(!entered);entered=true;_;entered=false;} function w() external nonReentrant { uint x=b[msg.sender]; (bool ok,)=msg.sender.call{value:x}(""); require(ok); b[msg.sender]=0; } }';
  const a=audit(unsafe,compile(unsafe,'Case'));
  const b=audit(guarded,compile(guarded,'Case'));
  assert.equal(a.findings.some(f=>f.findingId==='VLM-SEC-REENTRANCY-01'),true);
  assert.equal(b.findings.some(f=>f.findingId==='VLM-SEC-REENTRANCY-01'),false);
  const coverage=analyzeReentrancyGuardCoverage(guarded);
  assert.equal(coverage.allSupportedPathsGuarded,true);
  assert.equal(coverage.unguardedPaths,0);
});

test('structured source signals survive Full V2 as bounded candidates, not scored confirmed findings',()=>{
  const source=PRE+`contract Case { function verify(bytes32 h,uint8 v,bytes32 r,bytes32 s) external pure returns(address){ return ecrecover(h,v,r,s); } }`;
  const candidates=fuseStructuredSourceCandidates(ADDRESS,source);
  const replay=candidates.find(f=>f.findingId.includes('SIGNATURE-REPLAY'));
  assert.ok(replay);
  assert.equal(replay?.claimState,'HEURISTIC_CANDIDATE');
  assert.equal(replay?.analysisMethod,'STRUCTURED_SOURCE_HEURISTIC');
  assert.equal(replay?.exploitability,'theoretical');
  const scores=computeMultiDimensionalScores(candidates,{blockCount:3,cyclomaticComplexity:2,instructionCount:80,unresolvedDynamicJumps:0},false,{sourceProvided:true,meaningfulBytecode:true});
  assert.equal(scores.coverage.heuristicCandidateCount,candidates.length);
  assert.equal(scores.overallScore,null);
  assert.ok(scores.coverage.limitations.some(x=>x.startsWith('HEURISTIC_CANDIDATES_EXCLUDED_FROM_SCORE:')));
});

const ercTemplate=(transferHeader:string)=>PRE+`contract Case {
  mapping(address=>uint) private b; uint private s;
  constructor(){b[msg.sender]=1;s=1;}
  function totalSupply() external view returns(uint){return s;}
  function balanceOf(address a) external view returns(uint){return b[a];}
  ${transferHeader} { b[msg.sender]-=v; b[to]+=v; }
}`;

const missingBoolHeaders=[
  'function transfer(address to,uint v) external',
  'function transfer ( address to , uint v ) external',
  'function\ntransfer(address to,uint v)\nexternal',
  'function transfer /* comment */ (address to,uint v) external',
  'function transfer(address to,uint v) public',
  'function transfer(address to, uint256 v) external',
  'function transfer(address /*dest*/ to,uint256 v) external',
  'function transfer( address to, uint256 v ) /*x*/ external',
];

test('ERC-20 missing-bool detector is whitespace/comment invariant and requires deployed ERC-20 selector evidence',()=>{
  for(const header of missingBoolHeaders){
    const source=ercTemplate(header),r=audit(source,compile(source,'Case'));
    assert.equal(r.findings.some(f=>f.findingId==='VLM-SEC-ERC-NON-STANDARD-RETURN-01'),true,header);
  }
  const helper=PRE+'contract Case { function transfer(address,uint) external {} }';
  const r=audit(helper,compile(helper,'Case'));
  assert.equal(r.findings.some(f=>f.findingId==='VLM-SEC-ERC-NON-STANDARD-RETURN-01'),false);
});

test('ERC-20 bool return survives formatting mutations without false positive',()=>{
  const headers=[
    'function transfer(address to,uint v) external returns(bool)',
    'function transfer (address to,uint v) external returns ( bool )',
    'function transfer(address to,uint v) external returns /*comment*/ (bool ok)',
  ];
  for(const header of headers){
    // Build valid variants explicitly so the body can return true.
    const valid=PRE+`contract Case { mapping(address=>uint) private b; uint private s; constructor(){b[msg.sender]=1;s=1;} function totalSupply() external view returns(uint){return s;} function balanceOf(address a) external view returns(uint){return b[a];} ${header} { b[msg.sender]-=v;b[to]+=v;return true;} }`;
    const r=audit(valid,compile(valid,'Case'));
    assert.equal(r.findings.some(f=>f.findingId==='VLM-SEC-ERC-NON-STANDARD-RETURN-01'),false,header);
  }
});

test('all V2 finding evidence hashes emitted in a compiled unsafe case are real SHA-256 labels',()=>{
  const source=PRE+'contract Case { mapping(address=>uint) b; function w() external { uint x=b[msg.sender]; (bool ok,)=msg.sender.call{value:x}(""); require(ok); b[msg.sender]=0; } }';
  const r=audit(source,compile(source,'Case'));
  assert.ok(r.findings.length>0);
  for(const f of r.findings) assert.match(f.evidence.hashProof,/^sha256:[a-f0-9]{64}$/,f.findingId);
});
