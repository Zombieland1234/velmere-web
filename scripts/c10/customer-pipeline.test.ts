import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { GET as getJson, POST as postJson } from '../../app/api/audit/report/route';
import { GET as getPdf } from '../../app/api/audit/report-pdf/route';
import { acquireAuditRuntimeSnapshot, auditRuntimeAcquisitionDependencies } from '../../lib/security/audit-runtime-snapshot';
import { customerAuditPipelineDependencies, buildCustomerAuditReport } from '../../lib/security/customer-audit-pipeline';
import { normalizeCustomerReportInput, prepareCustomerReport } from '../../lib/security/customer-report-request';
import { generateAuditSnapshotId } from '../../lib/security/v2/scoring-and-evidence-engine';
import { BENCHMARK_20_CONTRACTS } from '../../lib/security/contract-audit-profiles';
import { canonicalJson } from '../../lib/security/canonical-json';
import { sha256Digest } from '../../lib/security/cryptographic-digest';
import { lintCanonicalReport } from '../../lib/security/report-semantic-linter';

const target = '0x9300700000000000000000000000000000000010';
const reference = Object.keys(BENCHMARK_20_CONTRACTS)[0];
const refChain = BENCHMARK_20_CONTRACTS[reference].chainId;
const bh = '0x'+'c0'.repeat(32);
const code = '0x60006000336000600060006000f150600060005500';
const digest = (hex: string) => 'sha256:'+createHash('sha256').update(Buffer.from(hex.slice(2),'hex')).digest('hex');
const methods: {method:string;params:unknown[]}[]=[];
function goodFetch(overrides: Record<string, unknown> = {}) {
  return async (_url: string | URL | Request, init?: RequestInit) => {
    const req=JSON.parse(String(init?.body));methods.push({method:req.method,params:req.params});
    const results:Record<string,unknown> = {eth_chainId:'0x1',eth_getBlockByNumber:{number:'0x100',hash:bh,timestamp:'0x65000000'},eth_getCode:code,...overrides};
    return Response.json({jsonrpc:'2.0',id:req.id,result:results[req.method]});
  };
}
function rpcMock(t: TestContext, overrides: Record<string,unknown>={}) {
  methods.length=0;return t.mock.method(auditRuntimeAcquisitionDependencies,'fetch',goodFetch(overrides));
}
function request(path:string,params:Record<string,string>) {
  return new NextRequest('http://localhost:3000'+path+'?'+new URLSearchParams(params));
}

test('EIP1898 acquisition binds eth_chainId, exact block hash and decoded runtime digest',async t=>{
  rpcMock(t);const r=await acquireAuditRuntimeSnapshot(target,'1');assert.ok(r.ok);
  if(r.ok){assert.equal(r.snapshot.bytecodeSha256,digest(code));assert.equal(r.snapshot.blockHash,bh);assert.equal(r.snapshot.independentlyVerified,false);}
  assert.deepEqual(methods.map(x=>x.method),['eth_chainId','eth_getBlockByNumber','eth_getCode']);
  assert.deepEqual(methods[2].params,[target,{blockHash:bh,requireCanonical:true}]);
});
test('snapshot never uses cached or unpinned latest code as proof',async t=>{
  rpcMock(t);await acquireAuditRuntimeSnapshot(target,'1');await acquireAuditRuntimeSnapshot(target,'1');
  assert.equal(methods.filter(x=>x.method==='eth_getCode').length,2);assert.ok(methods.filter(x=>x.method==='eth_getCode').every(x=>typeof x.params[1]==='object'));
});
for(const [label,overrides,error] of [
  ['wrong-chain',{eth_chainId:'0x38'},'rpc_chain_mismatch'],
  ['padded-chain',{eth_chainId:'0x01'},'rpc_chain_mismatch'],
  ['null-block',{eth_getBlockByNumber:null},'rpc_block_invalid'],
  ['pending-block',{eth_getBlockByNumber:{number:null,hash:null,timestamp:'0x1'}},'rpc_block_invalid'],
  ['invalid-time',{eth_getBlockByNumber:{number:'0x1',hash:bh,timestamp:'0xffffffffffffffff'}},'rpc_block_time_invalid'],
  ['odd-bytecode',{eth_getCode:'0x600'},'rpc_runtime_invalid'],
  ['non-hex',{eth_getCode:'0xzz'},'rpc_runtime_invalid'],
  ['empty-code',{eth_getCode:'0x'},'eoa_or_empty_code'],
] as const) test(`snapshot ${label}: no invented observation`,async t=>{
  rpcMock(t,overrides);const r=await acquireAuditRuntimeSnapshot(target,'1');assert.equal(r.ok,false);if(!r.ok)assert.equal(r.error,error);
});
test('unsupported network or invalid address is refused before provider request',async t=>{
  const m=rpcMock(t);assert.equal((await acquireAuditRuntimeSnapshot(target,'constructor')).ok,false);assert.equal((await acquireAuditRuntimeSnapshot('btc','1')).ok,false);assert.equal(m.mock.callCount(),0);
});
test('a node refusing blockHash must not trigger a weaker block-number/latest fallback',async t=>{
  const valid=goodFetch();t.mock.method(auditRuntimeAcquisitionDependencies,'fetch',async (u,init)=>{
    const r=JSON.parse(String(init?.body));if(r.method==='eth_getCode') {methods.push(r);return Response.json({jsonrpc:'2.0',id:r.id,error:{code:-32602,message:'unsupported'}});} return valid(u,init);
  });
  const r=await acquireAuditRuntimeSnapshot(target,'1');assert.equal(r.ok,false);assert.ok(methods.filter(x=>x.method==='eth_getCode').every(x=>typeof x.params[1]==='object'));
});
test('mismatched response id and simultaneous error/result are rejected',async t=>{
  for(const obj of [{jsonrpc:'2.0',id:88,result:'0x1'},{jsonrpc:'2.0',id:1,result:'0x1',error:null}]){
    const m=t.mock.method(auditRuntimeAcquisitionDependencies,'fetch',async()=>Response.json(obj));assert.equal((await acquireAuditRuntimeSnapshot(target,'1')).ok,false);m.mock.restore();
  }
});
test('acquisition abort covers response body even after headers',async t=>{
  t.mock.method(auditRuntimeAcquisitionDependencies,'fetch',async()=>new Response(new ReadableStream({cancel(){return new Promise<void>(()=>{});}})));
  const start=performance.now();const r=await acquireAuditRuntimeSnapshot(target,'1',undefined,30);assert.equal(r.ok,false);assert.ok(performance.now()-start<1000);
});
test('acquisition never-settling adapter is bounded and pre-aborted request performs no IO',async t=>{
  const m=t.mock.method(auditRuntimeAcquisitionDependencies,'fetch',()=>new Promise<Response>(()=>{}));
  const ctrl=new AbortController();ctrl.abort();assert.equal((await acquireAuditRuntimeSnapshot(target,'1',ctrl.signal)).ok,false);assert.equal(m.mock.callCount(),0);
  const r=await acquireAuditRuntimeSnapshot(target,'1',undefined,30);assert.equal(r.ok,false);
});
test('oversized acquisition body is refused without buffering entire payload',async t=>{
  t.mock.method(auditRuntimeAcquisitionDependencies,'fetch',async()=>new Response(new Uint8Array(140000)));
  const r=await acquireAuditRuntimeSnapshot(target,'1');assert.equal(r.ok,false);
});
test('Full V2 snapshot hash identifies decoded bytes, not hexadecimal spelling',()=>{
  const input={contractAddress:target,chainId:'1',bytecode:'0x60ab'};
  const a=generateAuditSnapshotId(input),b=generateAuditSnapshotId({...input,bytecode:'0x60AB'});
  assert.equal(a.bytecodeSha256,'0x'+createHash('sha256').update(Buffer.from([0x60,0xab])).digest('hex'));assert.equal(a.snapshotDigest,b.snapshotDigest);
  assert.throws(()=>generateAuditSnapshotId({...input,bytecode:'0x0'}),/INVALID_HEX/);
});
for(const method of ['GET','POST'] as const)test(`real JSON ${method} calls real Full V2 with exact server-acquired bytes`,async t=>{
  rpcMock(t);const actual=customerAuditPipelineDependencies.execute;let callCount=0;
  t.mock.method(customerAuditPipelineDependencies,'execute',args=>{callCount++;assert.equal(args.bytecode,code);assert.equal(args.chainId,'1');assert.equal(args.blockNumber,256);assert.equal(args.sourceCode,undefined);return actual(args);});
  const params={address:target,chainId:'1',tier:'basic',analysisMode:'runtime'};
  const r=method==='GET'?await getJson(request('/api/audit/report',params)):await postJson(new NextRequest('http://localhost:3000/api/audit/report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(params)}));
  assert.equal(r.status,200);const b=await r.json();assert.equal(callCount,1);assert.equal(b.report.runtimeAnalysis.status,'STATIC_ANALYSIS_COMPLETED');assert.equal(b.report.runtimeAnalysis.inputBytecodeSha256,digest(code));assert.equal(b.report.verdict.riskScore,null);assert.equal(b.report.verdict.confidenceScore,null);assert.equal(b.report.verdict.evidenceCoverage,null);assert.equal(b.report.humanReviewEvidencePresent,false);assert.equal(b.report.pkiAttestation,undefined);assert.equal(b.report.merkleRoot,undefined);
  const {reportDigest,...core}=b.report;assert.equal(reportDigest,sha256Digest(canonicalJson(core)));
  mkdirSync('/tmp/c10-evidence',{recursive:true});writeFileSync(`/tmp/c10-evidence/RUNTIME_JSON_${method}.json`,JSON.stringify({scope:'REAL_ROUTE_AND_ENGINE_WITH_CONTROLLED_RPC_NOT_LIVE_PAYMENT',sourceSha:process.env.GITHUB_SHA,body:b},null,2));
});
test('real PDF route invokes same engine and receipt, returns integrity-bound PDF',async t=>{
  rpcMock(t);const actual=customerAuditPipelineDependencies.execute;let count=0;t.mock.method(customerAuditPipelineDependencies,'execute',args=>{count++;return actual(args);});
  const r=await getPdf(request('/api/audit/report-pdf',{address:target,chainId:'1',analysisMode:'runtime',locale:'en'}));
  assert.equal(r.status,200);assert.equal(count,1);assert.equal(r.headers.get('x-velmere-analysis-status'),'STATIC_ANALYSIS_COMPLETED');
  const raw=Buffer.from(await r.arrayBuffer());assert.equal(raw.subarray(0,5).toString(),'%PDF-');assert.equal(r.headers.get('x-velmere-audit-pdf-digest'),'sha256:'+createHash('sha256').update(raw).digest('hex'));
  mkdirSync('/tmp/c10-evidence',{recursive:true});writeFileSync('/tmp/c10-evidence/RUNTIME_CONTROLLED_RPC.pdf',raw);
});
test('reference report cannot expose legacy scores, execution percentages or attestations in JSON',async t=>{
  const m=t.mock.method(customerAuditPipelineDependencies,'execute',()=>{throw new Error('REFERENCE_MUST_NOT_EXECUTE');});
  const r=await getJson(request('/api/audit/report',{address:reference,chainId:refChain,tier:'basic'}));assert.equal(r.status,200);const b=await r.json();assert.equal(m.mock.callCount(),0);
  assert.equal(b.report.runtimeAnalysis.status,'REFERENCE_ONLY');assert.equal(b.report.verdict.auditQualityScore,null);assert.equal(b.report.verdict.snapshotProvenance,undefined);assert.equal(b.report.verdict.coverageTuple,undefined);assert.equal(b.report.auditScopeManifest,undefined);assert.ok(b.report.sections.every((s:{data?:{metrics?:unknown[]}})=>!s.data?.metrics));
});
test('explicit runtime mode analyzes an exact reference address without inheriting its findings',async t=>{
  const expected='0x'+BigInt(refChain).toString(16);rpcMock(t,{eth_chainId:expected,eth_getCode:'0x600060005260206000f3'});
  const r=await getJson(request('/api/audit/report',{address:reference,chainId:refChain,analysisMode:'runtime'}));const b=await r.json();assert.equal(b.report.runtimeAnalysis.status,'STATIC_ANALYSIS_COMPLETED');assert.ok(b.report.sections.flatMap((s:{data?:{findings?:{category:string}[]}})=>s.data?.findings??[]).every((f:{category:string})=>f.category!=='REFERENCE_PROFILE'));
});
test('failed RPC yields an explicitly unavailable analysis without falling back to a safe score',async t=>{
  t.mock.method(auditRuntimeAcquisitionDependencies,'fetch',async()=>Response.json({error:'offline'},{status:503}));
  const r=await getJson(request('/api/audit/report',{address:target,chainId:'1'}));const b=await r.json();assert.equal(b.report.runtimeAnalysis.status,'ANALYSIS_UNAVAILABLE');assert.equal(b.report.verdict.riskScore,null);assert.equal(b.report.runtimeAnalysis.resultSha256,null);
});
test('mismatched acquisition adapter identity never reaches Full V2',async t=>{
  t.mock.method(customerAuditPipelineDependencies,'acquire',async()=>({ok:true as const,snapshot:{address:target,chainId:'56',blockNumber:'0x100',blockHash:bh,blockTimestamp:'2023-09-12T06:06:56.000Z',observedAt:new Date().toISOString(),providerOrigin:'https://node.invalid',binding:'EIP1898_BLOCK_HASH_REQUIRE_CANONICAL' as const,independentlyVerified:false as const,bytecode:code,bytecodeSha256:digest(code)}}));
  const m=t.mock.method(customerAuditPipelineDependencies,'execute',()=>{throw new Error('MUST_NOT_RUN');});
  const r=await buildCustomerAuditReport({reportId:'c10',contractAddress:target,contractName:'Target',chainId:'1'},'basic');assert.equal(r.runtimeAnalysis?.errorCode,'runtime_snapshot_identity_mismatch');assert.equal(m.mock.callCount(),0);
});
test('excessive instruction complexity is refused before Full V2',async t=>{
  rpcMock(t,{eth_getCode:'0x'+'00'.repeat(8200)});const m=t.mock.method(customerAuditPipelineDependencies,'execute',()=>{throw new Error('MUST_NOT_RUN');});
  const r=await getJson(request('/api/audit/report',{address:target,chainId:'1'}));const b=await r.json();assert.equal(b.report.runtimeAnalysis.status,'ANALYSIS_UNAVAILABLE');assert.equal(b.report.runtimeAnalysis.errorCode,'runtime_analysis_complexity_limit');assert.equal(m.mock.callCount(),0);
});
test('full result digest is stable for identical observation context, despite response timestamp',async t=>{
  rpcMock(t);const input={reportId:'same',contractAddress:target,contractName:'Target',chainId:'1'};const a=await buildCustomerAuditReport(input,'basic'),b=await buildCustomerAuditReport(input,'basic');assert.equal(a.runtimeAnalysis?.status,'STATIC_ANALYSIS_COMPLETED');assert.equal(a.runtimeAnalysis?.resultSha256,b.runtimeAnalysis?.resultSha256);
});
for(const tier of ['pro','advanced'])test(`shared SSR preparation denies anonymous ${tier} even for known reference`,async()=>{
  await assert.rejects(()=>prepareCustomerReport(request('/security/audits/report/x',{}),{address:reference,chainId:refChain,tier}),e=>e instanceof Error&&e.message==='current_audit_entitlement_required');
});
for(const [name,params,status]of [
  ['partial alias',{assetId:'usd'},400],['invented name target',{name:'Unknown'},400],
  ['conflicting identity',{assetId:'USDT',address:target,chainId:'1'},409],['untrusted bytecode',{address:target,bytecode:'0x60ab'},409],
  ['wrong non-EVM mode',{assetId:'btc',analysisMode:'runtime'},400],
]as const)test(`real PDF rejects ${name} rather than analyzing another target`,async()=>{
  const r=await getPdf(request('/api/audit/report-pdf',params));assert.equal(r.status,status);
});
test('PDF query duplicates and unknown parameters fail closed',async()=>{
  for(const q of [`address=${reference}&address=${reference}`,`address=${reference}&unknown=x`])assert.equal((await getPdf(new NextRequest('http://localhost:3000/api/audit/report-pdf?'+q))).status,400);
});
test('nullable metrics cannot be relabelled VERIFIED by caller',async()=>{
  const r=await buildCustomerAuditReport({reportId:'r10',contractAddress:reference,contractName:'Ref',chainId:refChain},'basic');r.verdict.releaseDecision='PASS';assert.equal(lintCanonicalReport(r,'evm_contract').valid,false);
});
test('route uses one shared preparation in JSON/PDF/SSR; layout classes unchanged is reviewed separately',()=>{
  for(const f of ['app/api/audit/report/route.ts','app/api/audit/report-pdf/route.ts','app/[locale]/security/audits/report/[id]/page.tsx']){
    const s=readFileSync(f,'utf8');assert.match(s,/prepareCustomerReport/);assert.doesNotMatch(s,/entitlementVerified|isBenchmark\)/);
  }
});
test('target parser refuses arrays and preserves actual chain in recognized asset references',()=>{
  assert.throws(()=>normalizeCustomerReportInput({address:[reference]}),/invalid_body_field_type/);
  assert.equal(normalizeCustomerReportInput({assetId:'USDT'}).target.chainId,'1');
});
