import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const sha = value => createHash('sha256').update(value).digest('hex');
const stable = 'export function executeFullAuditV2(){return {findings:[]};}\n';
const failing = 'export function executeFullAuditV2(){throw new Error("INTENTIONAL_CONTROL_ANALYZER_FAILURE");}\n';
// Explicit test double: thread identity deliberately makes repeat output differ.
// Neither this analyzer nor these inert bytes are product or external corpus input.
const unstable = 'import {threadId} from "node:worker_threads"; export function executeFullAuditV2(){return {findings:[{findingId:"CONTROL_"+threadId,severity:"low",taxonomy:{swcId:"SWC-104"},claimState:"CONTROL",analysisMethod:"CONTROL"}]};}\n';
for (const [scenario, baseCode, candidateCode, expectedExit] of [
  ['stable',stable,stable,0],
  ['baseline-failure',failing,stable,1],
  ['unstable-repeat',stable,unstable,1],
]) {
  test(`actual benchmark runner gate: ${scenario}`, t => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'velmere-gate-control-'));
    t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const baseline=path.join(root,'base'),candidate=path.join(root,'candidate');
    for (const [dir,code] of [[baseline,baseCode],[candidate,candidateCode]]) {
      const filename=path.join(dir,'lib/security/v2/master-audit-orchestrator.ts');
      fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,code);
    }
    const inputRoot=path.join(root,'inputs'),out=path.join(root,'output');
    fs.mkdirSync(inputRoot);fs.mkdirSync(out);
    const rows=['00','5b00'].map((hex,i)=>{
      const runtimeFile=path.join(inputRoot,`${i}.hex`);fs.writeFileSync(runtimeFile,hex);
      return {id:`inert-control-${i}`,runtimeSha256:sha(Buffer.from(hex,'hex')),runtimeBytes:hex.length/2,sourceSha256:null,sourceBinding:'NO_SOURCE',contractName:'InertControl',consensusLabels:[{swc:'104',expected:false,ambiguous:false}],runtimeFile,sourceFile:null};
    }).sort((a,b)=>a.runtimeSha256.localeCompare(b.runtimeSha256));
    const cases=rows.map(({runtimeFile: _runtimeFile,sourceFile: _sourceFile,...rest})=>rest);
    const manifest={selectedUniqueRuntimeHashes:rows.length,selectionDigestSha256:sha(rows.map(x=>x.runtimeSha256).join('\n')+'\n'),allCasesPreviouslyObservedInC9:false,cases};
    const raw=JSON.stringify(manifest);fs.writeFileSync(path.join(out,'MANIFEST.json'),raw);fs.writeFileSync(path.join(out,'MANIFEST_SHA256.txt'),sha(raw)+'\n');fs.writeFileSync(path.join(out,'private-inputs.json'),JSON.stringify(rows));
    const child=spawnSync(process.execPath,[path.resolve('scripts/c14-integration/run-corpus.mjs'),baseline,candidate,out,inputRoot,'e718df06d20a8129ffe261eef9c6c74cc5c91729'],{cwd:process.cwd(),encoding:'utf8',timeout:30000,maxBuffer:1024*1024,env:{...process.env,GITHUB_SHA:'0000000000000000000000000000000000000001'}});
    assert.ifError(child.error);assert.equal(child.signal,null);
    const comparison=JSON.parse(fs.readFileSync(path.join(out,'COMPARISON.json'),'utf8'));
    const gatePath=path.join(out,'MEASUREMENT_GATE.json');const gate=fs.existsSync(gatePath)?JSON.parse(fs.readFileSync(gatePath,'utf8')):null;
    const receipt={scenario,exitCode:child.status,expectedExit,baselineErrors:comparison.baseline.errors,candidateErrors:comparison.candidate.errors,unstable:comparison.stabilitySubset.unstable,gate,scope:'CONTROLLED_ANALYZERS_TWO_INERT_INPUTS_NOT_PRODUCT_BENCHMARK'};
    t.diagnostic(JSON.stringify(receipt));
    if (process.env.C15_GATE_EVIDENCE_DIR) {
      const save=path.join(process.env.C15_GATE_EVIDENCE_DIR,scenario);fs.mkdirSync(save,{recursive:true});
      fs.writeFileSync(path.join(save,'RESULT.json'),JSON.stringify(receipt,null,2),{flag:'wx'});
      fs.writeFileSync(path.join(save,'stdout.log'),child.stdout,{flag:'wx'});fs.writeFileSync(path.join(save,'stderr.log'),child.stderr,{flag:'wx'});
    }
    assert.equal(child.status,expectedExit,'Measurement failure must propagate to the real CLI exit status');
    if(gate){assert.equal(gate.status,expectedExit===0?'PASS':'FAIL');assert.equal(gate.releaseApproved,false);}
    if(scenario==='baseline-failure')assert.equal(comparison.baseline.errors,2);
    if(scenario==='unstable-repeat')assert.equal(comparison.stabilitySubset.unstable.length,2);
  });
}
