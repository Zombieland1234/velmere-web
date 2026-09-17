import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {GET as json} from '../../app/api/audit/report/route';
import {GET as pdf} from '../../app/api/audit/report-pdf/route';
import {customerAuditPipelineDependencies} from '../../lib/security/customer-audit-pipeline';
import {customerRuntimeResourceDependencies} from '../../lib/security/customer-runtime-resource-guard';
const address='0x1000000000000000000000000000000000000001';
for(const kind of ['json','pdf'] as const)test(`actual ${kind} acquisition failure is 503, not a successful report download`,async t=>{
 t.mock.method(customerRuntimeResourceDependencies,'rateLimit',async()=>({ok:true as const,remaining:1,resetAt:Date.now()+1000}));
 t.mock.method(customerAuditPipelineDependencies,'acquire',async()=>({ok:false as const,error:'runtime_snapshot_timeout'}));
 const path=kind==='json'?'/api/audit/report':'/api/audit/report-pdf';
 const result=await(kind==='json'?json:pdf)(new NextRequest(`http://localhost:3000${path}?address=${address}&chainId=1&analysisMode=runtime`));
 assert.equal(result.status,503);assert.equal(result.headers.get('content-disposition'),null);
 assert.match(result.headers.get('cache-control')??'',/no-store/);const body=await result.json();assert.equal(body.ok,false);
 assert.equal((body.report?.runtimeAnalysis??body.analysis).status,'ANALYSIS_UNAVAILABLE');
});
test('server quota grouping does not replace the request or discard original signed proxy headers',async t=>{
 const r=new Request('http://localhost:3000/api/audit/report-pdf',{headers:{'x-velmere-proxy-address':'192.0.2.10'}});
 const {reserveCustomerRuntimeRequest}=await import('../../lib/security/customer-runtime-resource-guard');
 t.mock.method(customerRuntimeResourceDependencies,'rateLimit',async(request:Request,options?:{quotaPath?:string})=>{
  assert.equal(request,r);assert.equal(options?.quotaPath,'/customer-runtime-analysis');return{ok:true as const,remaining:5,resetAt:Date.now()+60000};
 });
 const result=await reserveCustomerRuntimeRequest(r);assert.equal(result.ok,true);if(result.ok){result.release();result.release();}
});
