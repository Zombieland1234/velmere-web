/** Reproduce on unmodified C7 files; never counts historical results as C8 runs. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const base='61a43c4169cd7f1d7937617b0fde9ca7268dd82d';
const files=['lib/security/payment-webhook-guard.ts','app/api/auth/recovery/route.ts','app/api/auth/email-change/route.ts','lib/payments/stripe-webhook/ingress.ts'];
const temps: string[]=[];
const out=process.argv[2] || '/tmp/c8-evidence'; mkdirSync(out,{recursive:true});
const rows: object[]=[];
async function load(path:string) {
  const temp=path.replace(/\.ts$/,'.c8-baseline.ts');
  writeFileSync(temp,execFileSync('git',['show',`${base}:${path}`]));temps.push(temp);
  return import(pathToFileURL(resolve(temp)).href);
}
async function watchdog(p:Promise<unknown>,ms=100) {
  let timer: ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([p,new Promise(resolve=>{timer=setTimeout(()=>resolve('DID_NOT_SETTLE'),ms);})]);}
  finally{if(timer)clearTimeout(timer);}
}
async function main(){
 try{
  const guard=await load(files[0]);
  const infinite=await guard.readBoundedJsonBody(new Request('http://localhost:3000/api/test',{method:'POST',headers:{'content-type':'application/json'},body:'{"n":1e999}'}),1024);
  assert.equal(infinite.ok,true);assert.equal(infinite.value.n,Infinity);rows.push({case:'overflow_number',original:'ACCEPTED_INFINITY',expected:'REJECT'});
  const req=new Request('http://localhost:3000/api/test',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(33));},cancel(){return new Promise<void>(()=>{});}}),duplex:'half'} as RequestInit & {duplex:'half'});
  const oversized=await watchdog(guard.readBoundedBodyBytes(req,32));assert.equal(oversized,'DID_NOT_SETTLE');rows.push({case:'oversized_cancel_never_settles',original:oversized,expected:'413_WITHOUT_WAITING_FOR_CANCEL',watchdogMs:100});
  const chunk=new Uint8Array([65]);let step=0;
  const reuseReq=new Request('http://localhost:3000/api/test',{method:'POST',body:new ReadableStream({pull(c){if(step++===0)c.enqueue(chunk);else{chunk[0]=66;c.close();}}},{highWaterMark:0}),duplex:'half'} as RequestInit & {duplex:'half'});
  const reused=await guard.readBoundedBodyBytes(reuseReq,32);assert.equal(reused.ok,true);assert.equal(reused.bytes[0],66);rows.push({case:'delivered_buffer_mutation',originalByte:66,expectedByte:65});
  for(const [index,path] of files.slice(1,3).entries()){
    const module=await load(path);let error:string|null=null;
    try{await module.POST(new Request('http://localhost:3000/api/auth/recovery',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':`192.0.2.${210+index}`},body:'{"email":42}'}));}catch(e){error=e instanceof Error?e.name:String(e);}
    assert.equal(error,'TypeError');rows.push({case:path,original:'UNCAUGHT_TYPE_ERROR',expected:'400_INVALID_FIELD_TYPE'});
  }
  const ingress=await load(files[3]);let error:string|null=null;
  try{await ingress.handleStripeWebhookRequest(new Request('http://localhost:3000/api/stripe/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':'t=1,v1=fixture'},body:'{}'}),{...ingress.stripeWebhookIngressDependencies,webhookSecret:()=> 'whsec_noncredential_fixture',getStripe:()=>{throw new Error('BASELINE_CLIENT_FAILURE');}});}catch(e){error=e instanceof Error?e.message:String(e);}
  assert.equal(error,'BASELINE_CLIENT_FAILURE');rows.push({case:'webhook_client_initialization',original:'UNCAUGHT_DEPENDENCY_ERROR',expected:'503_RETRYABLE'});
  writeFileSync(`${out}/BASELINE_REPLAY.json`,JSON.stringify({baseSha:base,candidateSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),recordedAt:new Date().toISOString(),scope:'REPRODUCTIONS_ON_C7_FILES_WITH_CANDIDATE_DEPENDENCY_GRAPH_NO_EXTERNAL_ACCOUNTS',rows},null,2));
  console.log(JSON.stringify(rows,null,2));
 }finally{for(const p of temps)unlinkSync(p);}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
