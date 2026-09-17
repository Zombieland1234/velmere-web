import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {executeAuditInWorker,superviseAuditWorker,AUDIT_WORKER_LIMITS} from '../../lib/security/v2/isolated-audit-runner';
import {executeFullAuditV2} from '../../lib/security/v2/master-audit-orchestrator';
const options={contractAddress:'0x'+'12'.repeat(20),chainId:'1',bytecode:'0x60016002015400',blockNumber:1,fuzzIterations:0};
const thread=(code:string)=>new Worker(code,{eval:true,execArgv:[],stdout:true,stderr:true});

test('C11 real worker bundle returns the same findings/input identity as the direct engine',async()=>{
 const direct=executeFullAuditV2(options);const isolated=await executeAuditInWorker(options);
 assert.deepEqual(isolated.findings,direct.findings);assert.deepEqual(isolated.snapshot,direct.snapshot);
});
test('C11 generated bundle has a matching digest and tracked input manifest',()=>{
 const m=JSON.parse(readFileSync('.generated/audit-engine-worker-manifest.json','utf8'));
 assert.equal(createHash('sha256').update(readFileSync(m.output)).digest('hex'),m.sha256);
 assert.ok(m.sourceInputs.some((x:{path:string})=>x.path.endsWith('evm-local-stack.ts')));
});
test('C11 infinite-loop worker is terminated while the parent event loop remains responsive',async()=>{
 let beats=0;const pulse=setInterval(()=>beats++,5);const w=thread('while(true){}');
 try { await assert.rejects(superviseAuditWorker(()=>w,undefined,150),/runtime_analysis_budget_exceeded/);
 assert.ok(beats>0);assert.equal(w.threadId,-1); } finally {clearInterval(pulse);await w.terminate();}
});
test('C11 abort terminates a running worker before releasing its reservation',async()=>{
 const c=new AbortController(),w=thread('while(true){}');
 const p=superviseAuditWorker(()=>w,c.signal,2000);setTimeout(()=>c.abort(),40);
 await assert.rejects(p,/request_aborted/);assert.equal(w.threadId,-1);
});
test('C11 aborted input never creates a worker',async()=>{
 const c=new AbortController();c.abort();let called=false;
 await assert.rejects(superviseAuditWorker(()=>{called=true;return thread('');},c.signal),/request_aborted/);assert.equal(called,false);
});
test('C11 normal result worker is terminated even when its code would keep spinning',async()=>{
 const w=thread(`require('node:worker_threads').parentPort.postMessage({kind:'result',result:{fixture:true}});while(true){}`);
 const result=await superviseAuditWorker(()=>w);assert.deepEqual(result,{fixture:true});assert.equal(w.threadId,-1);
});
test('C11 thrown worker errors never disclose their private message',async()=>{
 await assert.rejects(superviseAuditWorker(()=>thread(`throw new Error('PRIVATE_TOKEN_VALUE')`)),e=>{
 assert.ok(e instanceof Error);assert.equal(e.message,'runtime_worker_failed');return true;});
});
test('C11 early exit cannot be interpreted as an empty successful analysis',async()=>{
 await assert.rejects(superviseAuditWorker(()=>thread('process.exit(0)')),/runtime_worker_exited_without_result/);
});
test('C11 invalid worker protocol and analysis errors fail closed',async()=>{
 for(const value of ['null','[]',"{kind:'error',code:'PRIVATE_DETAIL'}", "{kind:'result',result:null}"])
 await assert.rejects(superviseAuditWorker(()=>thread(`require('node:worker_threads').parentPort.postMessage(${value})`)),/runtime_(worker_message_invalid|analysis_failed)/);
});
test('C11 invalid server budgets or bytecode cannot disable limits',async()=>{
 await assert.rejects(superviseAuditWorker(()=>thread(''),undefined,Infinity),/budget_invalid/);
 await assert.rejects(executeAuditInWorker({...options,bytecode:'0x'+'60'.repeat(24577)}),/input_limit/);
 await assert.rejects(executeAuditInWorker({...options,bytecode:'0xZZ'}),/input_limit/);
 assert.equal(AUDIT_WORKER_LIMITS.maxOldGenerationSizeMb,128);
});
test('C11 worker construction failure is a controlled unavailable response',async()=>{
 await assert.rejects(superviseAuditWorker(()=>{throw new Error('PRIVATE_CONSTRUCTION_ERROR');}),/runtime_worker_unavailable/);
});
