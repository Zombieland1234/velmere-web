/** Actual source variants on unmodified C8 versus candidate. Not new R16 closures. */
import {execFileSync} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';import{pathToFileURL}from'node:url';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{analyzeReentrancyGuardCoverage as currentGuard}from'../../lib/security/solidity-structured-signal.mjs';
import{disassembleBytecode,buildControlFlowGraph}from'../../lib/security/v2/evm-cfg-dataflow-engine';
const base='0609ef1c5aeecfab6de3ada8144efaa089064c71',dir=process.argv[2]??'/tmp/c9-evidence';fs.mkdirSync(dir,{recursive:true});
const temp=path.resolve('lib/security/c9-baseline-guard.mjs'),tempCfg=path.resolve('lib/security/v2/c9-baseline-cfg.ts');
async function main(){try{
 fs.writeFileSync(temp,execFileSync('git',['show',base+':lib/security/solidity-structured-signal.mjs']));
 fs.writeFileSync(tempCfg,execFileSync('git',['show',base+':lib/security/v2/evm-cfg-dataflow-engine.ts']));
 const old=await import(pathToFileURL(temp).href),cfg=await import(pathToFileURL(tempCfg).href);
 const broken:Record<string,string>={'unlock-before-body':'require(!entered);entered=true;entered=false;_;','enter-after-body':'require(!entered);_;entered=true;entered=false;','mixed-variables':'require(!locked);entered=true;_;entered=false;','tautology':'require(entered||true);entered=true;_;entered=false;','dead-code':'if(false){require(!entered);entered=true;entered=false;}_;','local-shadow':'bool entered=false;require(!entered);entered=true;_;entered=false;','double-placeholder':'require(!entered);entered=true;_;entered=false;_;'};
 const rows:object[]=[];
 for(const [id,guard]of Object.entries(broken)){
 const s=`pragma solidity ^0.8.20;contract Case{mapping(address=>uint)b;bool entered;bool locked;modifier mutex(){${guard}}function w()external mutex{uint x=b[msg.sender];(bool ok,)=msg.sender.call{value:x}("");require(ok);b[msg.sender]=0;}}`;
 const before=old.analyzeReentrancyGuardCoverage(s).allSupportedPathsGuarded,after=currentGuard(s).allSupportedPathsGuarded;
 assert.equal(before,true);assert.equal(after,false);rows.push({id:'C9-MUTEX-'+id,before,after,expected:false,source:s,sourceSha256:createHash('sha256').update(s).digest('hex'),scope:'STRUCTURED_SOURCE_ORACLE_COMPILED_EQUIVALENTS_IN_SEPARATE_TEST_SUITE'});
 }
 const beforePadding=cfg.disassembleBytecode('61ff').instructions[0].pushValueHex,afterPadding=disassembleBytecode('61ff').instructions[0].pushValueHex;assert.equal(beforePadding,'00ff');assert.equal(afterPadding,'ff00');rows.push({id:'C9-EVM-PADDING',before:beforePadding,after:afterPadding,expected:'ff00'});
 const beforeStore=[...cfg.buildControlFlowGraph(cfg.disassembleBytecode('600160025500').instructions).storageSlotsWritten],afterStore=[...buildControlFlowGraph(disassembleBytecode('600160025500').instructions).storageSlotsWritten];assert.deepEqual(beforeStore,['0x1']);assert.deepEqual(afterStore,['0x2']);rows.push({id:'C9-EVM-SSTORE',before:beforeStore,after:afterStore,expected:['0x2']});
 const beforeJump=cfg.buildControlFlowGraph(cfg.disassembleBytecode('60005700').instructions).cfg.unresolvedDynamicJumps,afterJump=buildControlFlowGraph(disassembleBytecode('60005700').instructions).cfg.unresolvedDynamicJumps;assert.equal(beforeJump,0);assert.equal(afterJump,1);rows.push({id:'C9-EVM-JUMPDEST',before:beforeJump,after:afterJump,expected:1});
 assert.doesNotThrow(()=>cfg.disassembleBytecode('6000gg'));assert.throws(()=>disassembleBytecode('6000gg'));rows.push({id:'C9-EVM-HEX',before:'SILENT_TRUNCATION',after:'CONTROLLED_THROW',expected:'CONTROLLED_THROW'});
 fs.writeFileSync(path.join(dir,'C8_C9_REPRODUCTIONS.json'),JSON.stringify({baselineSourceSha:base,candidateSourceSha:process.env.GITHUB_SHA??'LOCAL_UNCOMMITTED',recordedAt:new Date().toISOString(),rows,r16Mapping:'UNAVAILABLE_ORIGINAL_LEDGER_NOT_LOADED'},null,2));console.log(JSON.stringify(rows,null,2));
}finally{for(const p of[temp,tempCfg])if(fs.existsSync(p))fs.unlinkSync(p);}}
main().catch(e=>{console.error(e);process.exitCode=1;});
