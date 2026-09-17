import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NextRequest} from 'next/server';
import {fetchOnChainBytecode} from '../../lib/security/evm-rpc-fetcher';
import {GET as pdf} from '../../app/api/audit/report-pdf/route';
import {BENCHMARK_20_CONTRACTS} from '../../lib/security/contract-audit-profiles';
import {buildVelmereAccountSession,bindVelmereAccountSessionToFamily,buildVelmereAccountCookie,hashVelmereAccountBinding,resolveRequestAccountDependencies} from '../../lib/auth/account-session';
import {authSessionSubjectFingerprint,buildAuthSessionFamilyCookie,type AuthSessionFamilyState} from '../../lib/auth/auth-session-family';
import {seedMemoryEntitlementRecord,clearMemoryEntitlements,updateMemoryVlmPaidEntitlementStatus,requiresDurableVlmPaidEntitlementLedger} from '../../lib/commerce/vlm-entitlement-ledger';
const fixture=Object.keys(BENCHMARK_20_CONTRACTS)[0],profile=BENCHMARK_20_CONTRACTS[fixture];
let nextAddress=0x6d000;
const address=()=>`0x${(++nextAddress).toString(16).padStart(40,'0')}`;
for(const chainId of ['999999','constructor','__proto__'])test(`unsupported RPC chain ${chainId} cannot fall back or call a provider`,async t=>{
 const stub=t.mock.method(globalThis,'fetch',async()=>{throw new Error('unexpected network');});
 const r=await fetchOnChainBytecode(address(),chainId);assert.equal(r.ok,false);assert.equal(r.error,'unsupported_chain_id');assert.equal(r.chainId,chainId);assert.equal(stub.mock.callCount(),0);
});
const invalidResponses=[['odd-length',{jsonrpc:'2.0',id:1,result:'0x0'},200],['wrong-id',{jsonrpc:'2.0',id:2,result:'0x6000'},200],['missing-version',{id:1,result:'0x6000'},200],['rpc-error-plus-result',{jsonrpc:'2.0',id:1,result:'0x6000',error:{code:-1}},200],['http-error',{jsonrpc:'2.0',id:1,result:'0x6000'},503],['non-hex',{jsonrpc:'2.0',id:1,result:'0xGG'},200]] as const;
for(const [id,body,status]of invalidResponses)test(`invalid actual RPC response ${id} is not cached as bytecode`,async t=>{
 const target=address();const stub=t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}}));
 assert.equal((await fetchOnChainBytecode(target,'1')).ok,false);assert.ok(stub.mock.callCount()>0);
 stub.mock.mockImplementation(async()=>new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:'0x6000'}),{headers:{'content-type':'application/json'}}));
 const good=await fetchOnChainBytecode(target,'1');assert.equal(good.source,'live_rpc');assert.equal(good.bytecode,'0x6000');
});
test('empty DATA is no-code, not an invented runtime',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:'0x'}),{headers:{'content-type':'application/json'}}));
 const r=await fetchOnChainBytecode(address(),'1');assert.equal(r.ok,false);assert.equal(r.source,'eoa_no_code');
});
test('actual RPC cache stays bounded and evicts oldest entries',async t=>{
 const stub=t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:'0x6000'}),{headers:{'content-type':'application/json'}}));
 const first=address();await fetchOnChainBytecode(first,'1');for(let n=0;n<256;n++)await fetchOnChainBytecode(address(),'1');const count=stub.mock.callCount();
 assert.equal((await fetchOnChainBytecode(first,'1')).source,'live_rpc');assert.equal(stub.mock.callCount(),count+1);
});
for(const [extra,expected,error]of [['chainId=999999',400,'unsupported_chain_id'],['locale=xx',400,'invalid_report_locale'],['bytecode=0x0',400,'invalid_runtime_bytecode'],['bytecode=0x6000',409,'untrusted_runtime_bytecode_not_exportable'],[`chainId=${profile.chainId==='1'?'56':'1'}`,409,'reference_profile_chain_mismatch']]as const)test(`actual PDF rejects ${error}`,async()=>{
 const r=await pdf(new NextRequest(`http://localhost/api/audit/report-pdf?address=${fixture}&tier=basic&${extra}`));assert.equal(r.status,expected);assert.equal((await r.json()).error,error);
});
for(const mode of ['stable','session-revoked-during-render','grant-revoked-during-render']as const)test(`actual paid PDF final authority boundary: ${mode}`,async()=>{
 assert.equal(requiresDurableVlmPaidEntitlementLedger(),false,'test requires isolated non-production memory ledger');
 clearMemoryEntitlements();
 const subject='c6d03000-0017-4170-8170-000000000001',accountId=`supabase:${subject}`;
 const family:AuthSessionFamilyState={schemaVersion:'velmere.auth-session-family.v1',familyId:'c6d03000-0017-4170-8170-000000000101',generation:1,subjectFingerprint:authSessionSubjectFingerprint(subject),expiresAt:Math.floor(Date.now()/1000)+3600};
 const account=bindVelmereAccountSessionToFamily(buildVelmereAccountSession({accountId,provider:'email',displayName:'Synthetic C6D account'}),family,subject);
 const cookie=[buildVelmereAccountCookie(account),buildAuthSessionFamilyCookie(family)].map(x=>x.split(';')[0]).join('; ');
 const id='c6d_synthetic_entitlement';seedMemoryEntitlementRecord({id,stripeSessionId:'cs_test_C6D_SYNTHETIC_NOT_A_PAYMENT',productId:'vlm_pro_audit_review',accessScope:'audit_review',status:'active',contextHash:createHash('sha256').update('synthetic-context').digest('hex'),context:{surface:'audit',locale:'en',depth:'pro',accountIdHash:hashVelmereAccountBinding(accountId)},locale:'en',amountTotal:null,currency:null,source:'manual_repair',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
 const oldVerify=resolveRequestAccountDependencies.verifyFamily,descriptor=Object.getOwnPropertyDescriptor(profile,'riskScore')!;let checks=0,renderObserved=false;
 resolveRequestAccountDependencies.verifyFamily=async state=>{checks++;return {...state,status:renderObserved&&mode==='session-revoked-during-render'?'revoked':'active'};};
 Object.defineProperty(profile,'riskScore',{configurable:true,enumerable:true,get(){renderObserved=true;if(mode==='grant-revoked-during-render')updateMemoryVlmPaidEntitlementStatus({entitlementId:id,status:'revoked'});return descriptor.value;}});
 try{
  const r=await pdf(new NextRequest(`http://localhost/api/audit/report-pdf?address=${fixture}&chainId=${profile.chainId}&tier=pro`,{headers:{cookie,'x-velmere-entitlement-id':id}}));
  assert.equal(renderObserved,true,'fault was actually injected after first authorization');assert.equal(checks,2,'session authority must be read twice');
  assert.equal(r.status,mode==='stable'?200:mode==='session-revoked-during-render'?401:403);
  if(mode==='stable'){const bytes=Buffer.from(await r.arrayBuffer());assert.equal(r.headers.get('x-velmere-audit-pdf-digest')?.replace(/^sha256:/,''),createHash('sha256').update(bytes).digest('hex'));}else assert.equal(r.headers.get('content-type')?.includes('application/pdf'),false);
 }finally{Object.defineProperty(profile,'riskScore',descriptor);resolveRequestAccountDependencies.verifyFamily=oldVerify;clearMemoryEntitlements();}
});
