/** Tiny read-only/no-auth probe: none of these requests can reach a workspace write. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const out = process.argv[2] || '/tmp/c8-evidence';fs.mkdirSync(out,{recursive:true});
const url = 'https://yljjyowcvjgjcamffnvd.supabase.co/functions/v1/r7-shield-pro-paid-workspace-v1';
const valid={schemaVersion:'velmere.r7.shield-pro-paid-workspace-request.v1',tier:'pro',locale:'en',operation:'READ',workspaceId:'10000000-0000-4000-8000-000000000001'};
const cases=[['method','GET',undefined,405],['null','POST','null',400],['wrong-field-type','POST',JSON.stringify({...valid,tier:['pro']}),400],['missing-auth','POST',JSON.stringify(valid),401],['invalid-json','POST','{"tier":',400]];
const rows=[];
for(const [id,method,body,expected] of cases){
 const item={id,sourceSha:process.env.GITHUB_SHA||null,startedAt:new Date().toISOString(),url,method,expected,scope:'REAL_DEPLOYED_EDGE_UNAUTHENTICATED_NEGATIVE_REQUEST_NO_DATA_WRITES'};
 try{
  const response=await fetch(url,{method,body,headers:{'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  const text=await response.text();item.status=response.status;item.contentType=response.headers.get('content-type');item.cacheControl=response.headers.get('cache-control');item.bodySha256=createHash('sha256').update(text).digest('hex');
  if(text.length<2000){try{const j=JSON.parse(text);item.errorCode=typeof j.error==='string'?j.error:null;}catch{item.errorCode='non_json';}}
  item.result=response.status===expected?'PASS':'FAIL';
 }catch(error){item.result='ERROR';item.error=String(error?.message||error).slice(0,300);}
 item.finishedAt=new Date().toISOString();rows.push(item);
}
fs.writeFileSync(path.join(out,'EDGE_LIVE_PROBE.json'),JSON.stringify({sourceSha:process.env.GITHUB_SHA||null,functionSlug:'r7-shield-pro-paid-workspace-v1',expectedDeployedVersion:2,expectedBundleSha256:'6284ff1074df6c0cd471d85745e2890661c9a7c363a8212311198abc2d6934c0',rows},null,2));
console.log(JSON.stringify(rows,null,2));
if(rows.some(r=>r.result!=='PASS'))process.exitCode=1;
