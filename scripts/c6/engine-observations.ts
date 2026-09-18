import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import solc from 'solc';
import { executeFullAuditV2 } from '../../lib/security/v2/master-audit-orchestrator';

const root=process.argv[2];
if(!root) throw new Error('output directory required');
fs.mkdirSync(root,{recursive:true});

function isRecord(value:unknown):value is Record<string,unknown>{
 return typeof value==='object'&&value!==null&&!Array.isArray(value);
}

function parseSolcCompilation(raw:string):{diagnostics:Record<string,unknown>[];bytecode:string}{
 const parsed:unknown=JSON.parse(raw);
 if(!isRecord(parsed)) throw new Error('solc output must be an object');
 const diagnostics=Array.isArray(parsed.errors)?parsed.errors.filter(isRecord):[];
 if(!isRecord(parsed.contracts)) throw new Error('solc output missing contracts');
 const caseSol=parsed.contracts['Case.sol'];
 if(!isRecord(caseSol)) throw new Error('solc output missing Case.sol');
 const vault=caseSol.Vault;
 if(!isRecord(vault)||!isRecord(vault.evm)||!isRecord(vault.evm.deployedBytecode)) throw new Error('solc output missing Vault bytecode');
 const object=vault.evm.deployedBytecode.object;
 if(typeof object!=='string') throw new Error('solc deployed bytecode must be a string');
 return {diagnostics,bytecode:object};
}

type AuditFindings=ReturnType<typeof executeFullAuditV2>['findings'];
const normalizeFindings=(findings:AuditFindings)=>findings.map((finding)=>({
 id:finding.findingId,
 severity:finding.severity,
 confidence:finding.confidence,
 exploitability:finding.exploitability,
 offset:finding.bytecodeOffset,
}));

const pre='// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n';
const unsafe=`contract Vault { mapping(address=>uint) public balances; function deposit() external payable {balances[msg.sender]+=msg.value;} function withdraw() external {uint value=balances[msg.sender]; (bool ok,)=msg.sender.call{value:value}("");require(ok);balances[msg.sender]=0;} }`;
const safe=`contract Vault { mapping(address=>uint) public balances; function deposit() external payable {balances[msg.sender]+=msg.value;} function withdraw() external {uint value=balances[msg.sender];balances[msg.sender]=0;(bool ok,)=msg.sender.call{value:value}("");require(ok);} }`;
const samples=[
 {id:'unguarded-state-after-call',positive:true,code:unsafe},
 {id:'unguarded-harmless-lock-comment',positive:true,code:'// lock is only an ordinary comment, NOT a modifier.\n'+unsafe},
 {id:'unguarded-unrelated-clock-variable',positive:true,code:unsafe.replace('contract Vault {','contract Vault { uint public clock=1;')},
 {id:'unguarded-format-newlines',positive:true,code:unsafe.replaceAll(';',';\n').replaceAll('{','{\n')},
 {id:'unguarded-modifier-name-only',positive:true,code:unsafe.replace('contract Vault {','contract Vault { modifier nonReentrant() {_;}').replace('withdraw() external {','withdraw() external nonReentrant {')},
 {id:'cei-state-before-call',positive:false,code:safe},
 {id:'cei-state-before-call-formatted',positive:false,code:safe.replaceAll(';',';\n')},
 {id:'actual-mutex',positive:false,code:unsafe.replace('contract Vault {','contract Vault { bool private entered; modifier nonReentrant() {require(!entered);entered=true;_;entered=false;}').replace('withdraw() external {','withdraw() external nonReentrant {')},
 {id:'no-external-call',positive:false,code:'contract Vault { uint public value; function set(uint x) external {value=x;} }'},
 {id:'readonly-return',positive:false,code:'contract Vault { function answer() external pure returns(uint) {return 42;} }'},
];
const rows=[];
for(const sample of samples){
 const source=pre+sample.code;
 const compilation=parseSolcCompilation(solc.compile(JSON.stringify({language:'Solidity',sources:{'Case.sol':{content:source}},settings:{optimizer:{enabled:false},outputSelection:{'*':{'*':['evm.deployedBytecode.object'],'':['ast']}}}})));
 const errors=compilation.diagnostics.filter((diagnostic)=>diagnostic.severity==='error');
 if(errors.length) throw new Error(JSON.stringify(errors));
 const bytecode='0x'+compilation.bytecode;
 const options={contractAddress:'0x00000000000000000000000000000000000000c6',chainId:'1',bytecode,sourceCode:source,contractName:'Vault',blockNumber:19000000,tier:'ADVANCED' as const,fuzzIterations:16};
 const start=new Date().toISOString();
 const result=executeFullAuditV2(options),again=executeFullAuditV2(options);
 const found=result.findings.some(f=>f.findingId==='VLM-SEC-REENTRANCY-01');
 rows.push({id:sample.id,expectedClassicReentrancy:sample.positive,detectedClassicReentrancy:found,result:found===sample.positive?'PASS':sample.positive?'FALSE_NEGATIVE':'FALSE_POSITIVE',stableFindings:JSON.stringify(normalizeFindings(result.findings))===JSON.stringify(normalizeFindings(again.findings)),sourceSha256:createHash('sha256').update(source).digest('hex'),bytecodeSha256:createHash('sha256').update(bytecode).digest('hex'),source,bytecode,findings:normalizeFindings(result.findings),startedAt:start,finishedAt:new Date().toISOString()});
 console.log(sample.id,found===sample.positive?'PASS':sample.positive?'FALSE_NEGATIVE':'FALSE_POSITIVE','findings',result.findings.length);
}
const tp=rows.filter(r=>r.expectedClassicReentrancy&&r.detectedClassicReentrancy).length,fn=rows.filter(r=>r.expectedClassicReentrancy&&!r.detectedClassicReentrancy).length,fp=rows.filter(r=>!r.expectedClassicReentrancy&&r.detectedClassicReentrancy).length,tn=rows.filter(r=>!r.expectedClassicReentrancy&&!r.detectedClassicReentrancy).length;
fs.writeFileSync(path.join(root,'ENGINE_OBSERVATIONS.json'),JSON.stringify({schema:'velmere.c6.targeted-engine-observations.v1',scope:'SELF_AUTHORED_COMPILED_SOLIDITY_NOT_EXTERNAL_AUDIT_BENCHMARK',engine:'executeFullAuditV2',sourceSha:process.env.C6_SOURCE_SHA??null,compiler:solc.version(),matrix:{tp,fn,fp,tn},recall:tp/(tp+fn),precision:tp+fp?tp/(tp+fp):null,stabilityComparedRuns:2,uniqueCases:rows.length,rows},null,2));
