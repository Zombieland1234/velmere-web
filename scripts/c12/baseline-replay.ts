/** Execute C11's exact route files with the same controlled outage adapter graph.
 * No external calls or customer writes. Each response is a separate execution.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { NextRequest } from 'next/server';
import { customerAuditPipelineDependencies } from '../../lib/security/customer-audit-pipeline';
import { customerRuntimeResourceDependencies } from '../../lib/security/customer-runtime-resource-guard';
const base='9ca2860e4133e9f8695076b50f323c7825a1c7b3';
const out=process.argv[2]||'/tmp/c12-evidence';mkdirSync(out,{recursive:true});
async function main(){
 const rows: object[]=[];const temps:string[]=[];
 try{
  mock.method(customerAuditPipelineDependencies,'acquire',async()=>({ok:false,error:'runtime_snapshot_timeout'}));
  mock.method(customerRuntimeResourceDependencies,'rateLimit',async()=>({ok:true,remaining:5,resetAt:Date.now()+60000}));
  for(const kind of ['json','pdf']){
   const api=kind==='json'?'report':'report-pdf';const path=`app/api/audit/${api}/route.ts`;
   const temp=path.replace(/\.ts$/,'.c12-baseline.ts');writeFileSync(temp,execFileSync('git',['show',`${base}:${path}`]));temps.push(temp);
   const route=await import(pathToFileURL(resolve(temp)).href);
   const response=await route.GET(new NextRequest(`http://localhost:3000/api/audit/${api}?address=0x1000000000000000000000000000000000000001&chainId=1&analysisMode=runtime`));
   assert.equal(response.status,200);
   if(kind==='json'){const body=await response.json();assert.equal(body.report.runtimeAnalysis.status,'ANALYSIS_UNAVAILABLE');assert.equal(body.ok,true);}
   else {assert.match(response.headers.get('content-disposition')??'',/attachment/);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');}
   rows.push({case:kind,baselineSha:base,observedHttp:response.status,incorrectSuccess:true,requiredHttp:503,at:new Date().toISOString()});
  }
  writeFileSync(`${out}/C11_RESPONSE_REPLAY.json`,JSON.stringify({sourceSha:process.env.GITHUB_SHA,baselineSha:base,scope:'EXACT_OLD_ROUTE_FILES_CONTROLLED_OUTAGE_SHARED_CURRENT_DEPENDENCIES_NOT_LIVE_PAYMENT',rows},null,2));console.log(JSON.stringify(rows,null,2));
 }finally{mock.restoreAll();for(const p of temps)unlinkSync(p);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
