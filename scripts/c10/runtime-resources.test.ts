import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { reserveCustomerRuntimeRequest, customerRuntimeResourceDependencies } from '../../lib/security/customer-runtime-resource-guard';
import { prepareCustomerReport } from '../../lib/security/customer-report-request';
import { auditRuntimeAcquisitionDependencies } from '../../lib/security/audit-runtime-snapshot';
import { GET as getJson } from '../../app/api/audit/report/route';
import { GET as getPdf } from '../../app/api/audit/report-pdf/route';
import { buildCustomerAuditReport } from '../../lib/security/customer-audit-pipeline';
import { CrossAssetAndTierForensicEngine } from '../../lib/security/furnace/cross-asset-and-tier-forensics';
import { MASTER_50_ASSETS } from '../../lib/security/corpus/master-50-assets';
const target='0x9300700000000000000000000000000000000010';
const make=(path:string,ip:string)=>new NextRequest('http://localhost:3000'+path+'?address='+target+'&chainId=1',{headers:{'x-forwarded-for':ip}});

test('actual QA limiter has one six-request bucket across JSON, PDF and SSR routes',async()=>{
  for(let i=0;i<6;i++){
    const r=await reserveCustomerRuntimeRequest(make(['/api/audit/report','/api/audit/report-pdf','/en/security/audits/report/x'][i%3],'203.0.113.190'));
    assert.ok(r.ok);if(r.ok)r.release();
  }
  const denied=await reserveCustomerRuntimeRequest(make('/de/security/audits/report/different','203.0.113.190'));
  assert.equal(denied.ok,false);if(!denied.ok){assert.equal(denied.response.status,429);assert.ok(Number(denied.response.headers.get('retry-after'))>0);}
});
test('isolate concurrency allows two reservations and releases idempotently',async()=>{
  const a=await reserveCustomerRuntimeRequest(make('/a','203.0.113.191'));assert.ok(a.ok);
  const b=await reserveCustomerRuntimeRequest(make('/b','203.0.113.192'));assert.ok(b.ok);
  try{
    const c=await reserveCustomerRuntimeRequest(make('/c','203.0.113.193'));assert.equal(c.ok,false);if(!c.ok){assert.equal(c.response.status,503);assert.equal((await c.response.json()).error,'runtime_capacity_busy');}
  }finally{if(a.ok){a.release();a.release();}if(b.ok)b.release();}
  const c=await reserveCustomerRuntimeRequest(make('/d','203.0.113.194'));assert.ok(c.ok);if(c.ok)c.release();
});
for(const kind of ['json','pdf','ssr']as const)test(`${kind} enforces shared refusal before any RPC and preserves retry response`,async t=>{
  const paths:string[]=[];
  t.mock.method(customerRuntimeResourceDependencies,'rateLimit',async(r:Request)=>{paths.push(new URL(r.url).pathname);return {ok:false as const,response:Response.json({error:'rate_limited_fixture'},{status:429,headers:{'retry-after':'5','cache-control':'no-store'}})};});
  const rpc=t.mock.method(auditRuntimeAcquisitionDependencies,'fetch',()=>{throw new Error('SHOULD_NOT_CALL_RPC');});
  if(kind==='ssr')await assert.rejects(()=>prepareCustomerReport(make('/en/security/audits/report/x','203.0.113.195'),{address:target,chainId:'1'}),e=>typeof e==='object'&&e!==null&&'status'in e&&e.status===429);
  else{const r=await(kind==='json'?getJson:getPdf)(make(kind==='json'?'/api/audit/report':'/api/audit/report-pdf','203.0.113.195'));assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'5');}
  assert.equal(rpc.mock.callCount(),0);assert.deepEqual(paths,['/customer-runtime-analysis']);
});
test('production cannot silently downgrade runtime analysis to QA memory limiting',async t=>{
  const keys=['NODE_ENV','VERCEL_ENV','VERCEL','VELMERE_TRUSTED_PROXY_PROFILE','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','VELMERE_RATE_LIMIT_DISABLED'];
  const saved=new Map(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];process.env.NODE_ENV='production';process.env.VELMERE_RATE_LIMIT_DISABLED='1';
  const rpc=t.mock.method(auditRuntimeAcquisitionDependencies,'fetch',()=>{throw new Error('SHOULD_NOT_CALL_RPC');});
  try{const r=await getJson(make('/api/audit/report','203.0.113.196'));assert.equal(r.status,503);assert.equal(rpc.mock.callCount(),0);}
  finally{for(const[k,v]of saved){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('guard dependency exception refuses without exposing internals',async t=>{
  t.mock.method(customerRuntimeResourceDependencies,'rateLimit',async()=>{throw new Error('INTERNAL_PRIVATE');});
  const r=await reserveCustomerRuntimeRequest(make('/api/audit/report','203.0.113.197'));assert.equal(r.ok,false);
  if(!r.ok){assert.equal(r.response.status,503);assert.doesNotMatch(await r.response.text(),/INTERNAL_PRIVATE/);}
});
test('cancelled request never consumes quota or reservation',async t=>{
  const m=t.mock.method(customerRuntimeResourceDependencies,'rateLimit',async()=>{throw new Error('SHOULD_NOT_CALL');});
  const ctrl=new AbortController();ctrl.abort();const r=await reserveCustomerRuntimeRequest(new Request('https://example.invalid',{signal:ctrl.signal}));assert.equal(r.ok,false);assert.equal(m.mock.callCount(),0);
});
test('forensic scanner accepts unmeasured unverified fields but rejects certification and nonfinite scores',async()=>{
  const asset=MASTER_50_ASSETS[0];const report=await buildCustomerAuditReport({reportId:'c10-forensic',contractAddress:asset.address,chainId:asset.chainId,contractName:asset.name},'basic');
  const check=()=>new CrossAssetAndTierForensicEngine().auditCorpus([{asset,tier:'basic',report}]);
  assert.equal(check().violations.some(v=>v.code.startsWith('METRIC_')||v.code==='UNMEASURED_METRIC_CANNOT_CERTIFY'),false);
  report.verdict.releaseDecision='PASS';assert.ok(check().violations.some(v=>v.code==='UNMEASURED_METRIC_CANNOT_CERTIFY'));
  report.verdict.releaseDecision='NOT_VERIFIED';report.verdict.riskScore=NaN;assert.ok(check().violations.some(v=>v.code==='METRIC_RISK_OUT_OF_BOUNDS'));
});
