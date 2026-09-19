import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET, POST } from '../../app/api/audit/report/route';
import { BENCHMARK_20_CONTRACTS } from '../../lib/security/contract-audit-profiles';
import { buildVelmereAccountSession, bindVelmereAccountSessionToFamily, buildVelmereAccountCookie, hashVelmereAccountBinding, resolveRequestAccountDependencies } from '../../lib/auth/account-session';
import { authSessionSubjectFingerprint, buildAuthSessionFamilyCookie, type AuthSessionFamilyState } from '../../lib/auth/auth-session-family';
import { seedMemoryEntitlementRecord, clearMemoryEntitlements, updateMemoryVlmPaidEntitlementStatus, requiresDurableVlmPaidEntitlementLedger } from '../../lib/commerce/vlm-entitlement-ledger';
import { createAuditIntakeCase, buildAuditContractTargetHash, getAuditCaseForOwningAccount } from '../../lib/security/audit-intake-case-vault';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Actual route/builders/auth resolver, but isolated memory authority is controlled.
// These tests do NOT perform real sign-in, payments or production database writes.
const fixture = Object.keys(BENCHMARK_20_CONTRACTS)[0], profile = BENCHMARK_20_CONTRACTS[fixture];
const subject = 'c9b03000-0017-4170-8170-000000000001', accountId = `supabase:${subject}`;
function cookie() {
  const family: AuthSessionFamilyState = { schemaVersion: 'velmere.auth-session-family.v1', familyId: 'c9b03000-0017-4170-8170-000000000101', generation: 1, subjectFingerprint: authSessionSubjectFingerprint(subject), expiresAt: Math.floor(Date.now()/1000)+3600 };
  const account = bindVelmereAccountSessionToFamily(buildVelmereAccountSession({accountId,provider:'email',displayName:'Synthetic C9 report account'}),family,subject);
  return [buildVelmereAccountCookie(account),buildAuthSessionFamilyCookie(family)].map(x=>x.split(';')[0]).join('; ');
}
function request(method: 'GET'|'POST', input: Record<string,unknown>, headers: Record<string,string> = {}) {
  if (method==='GET') return new NextRequest('http://localhost:3000/api/audit/report?'+new URLSearchParams(input as Record<string,string>),{headers});
  return new NextRequest('http://localhost:3000/api/audit/report',{method,headers:{'content-type':'application/json',...headers},body:JSON.stringify(input)});
}
const input = {address:fixture,chainId:profile.chainId,tier:'basic'};
for(const method of ['GET','POST'] as const) {
  const handler=method==='GET'?GET:POST;
  test(`actual JSON ${method}: anonymous requested Pro is refused, not silently downgraded`,async()=>{
    const r=await handler(request(method,{...input,tier:'pro'}));assert.equal(r.status,401);assert.equal((await r.json()).error,'current_audit_entitlement_required');
  });
  for(const [change,error,status] of [
    [{bytecode:'0x6000'},'untrusted_runtime_bytecode_not_exportable',409],
    [{chainId:'99999'},'unsupported_chain_id',400],
    [{chainId:profile.chainId==='1'?'56':'1'},'reference_profile_chain_mismatch',409],
    [{locale:'xx'},'invalid_report_locale',400],
    [{tier:'constructor'},'invalid_audit_tier',400],
  ] as const) test(`actual JSON ${method}: ${error} before provider work`,async()=>{
    const r=await handler(request(method,{...input,...change}));assert.equal(r.status,status);assert.equal((await r.json()).error,error);
  });
  test(`actual JSON ${method}: basic reference output remains available with explicit NOT_VERIFIED`,async()=>{
    const r=await handler(request(method,input));assert.equal(r.status,200);const body=await r.json();assert.equal(body.clientTier,'basic');assert.equal(body.report.executionEvidence.qualification,'NOT_VERIFIED');assert.match(r.headers.get('cache-control')||'',/no-store/);
  });
}
for(const raw of ['null','[]','{"address":42}','{"address":"a","address":"b"}','{"address":"a","x":1e999}']) test(`actual JSON POST malformed input ${raw}: bounded refusal`,async()=>{
  const r=await POST(new NextRequest('http://localhost:3000/api/audit/report',{method:'POST',body:raw,headers:{'content-type':'application/json'}}));assert.equal(r.status,400);
});
test('actual JSON POST oversized body refused before parsing/auth',async()=>{
  const r=await POST(new NextRequest('http://localhost:3000/api/audit/report',{method:'POST',body:'x'.repeat(17000),headers:{'content-type':'application/json'}}));assert.equal(r.status,413);
});
test('actual JSON GET duplicate fields cannot select a different target',async()=>{
  const r=await GET(new NextRequest(`http://localhost:3000/api/audit/report?address=${fixture}&address=${fixture}`));assert.equal(r.status,400);assert.equal((await r.json()).error,'duplicate_query_parameter');
});
test('actual JSON POST cross-origin request is refused',async()=>{
  const r=await POST(request('POST',input,{origin:'https://attacker.example.invalid'}));assert.equal(r.status,403);
});
for(const mode of ['stable','session-revoked','grant-revoked'] as const) for(const method of ['GET','POST'] as const) test(`actual JSON final authority ${method}/${mode}`,async()=>{
  assert.equal(requiresDurableVlmPaidEntitlementLedger(),false);clearMemoryEntitlements();const id='c9-report-grant-fixture';
  seedMemoryEntitlementRecord({id,stripeSessionId:'cs_test_C9_SYNTHETIC_NOT_A_PAYMENT',productId:'vlm_pro_audit_review',accessScope:'audit_review',status:'active',contextHash:createHash('sha256').update('c9synthetic').digest('hex'),context:{surface:'audit',locale:'en',depth:'pro',accountIdHash:hashVelmereAccountBinding(accountId)},locale:'en',amountTotal:null,currency:null,source:'manual_repair',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
  const old=resolveRequestAccountDependencies.verifyFamily,desc=Object.getOwnPropertyDescriptor(profile,'riskScore')!;let generated=false,checks=0;
  resolveRequestAccountDependencies.verifyFamily=async state=>{checks++;return {...state,status:generated&&mode==='session-revoked'?'revoked':'active'};};
  Object.defineProperty(profile,'riskScore',{configurable:true,enumerable:true,get(){generated=true;if(mode==='grant-revoked')updateMemoryVlmPaidEntitlementStatus({entitlementId:id,status:'revoked'});return desc.value;}});
  try {
    const r=await (method==='GET'?GET:POST)(request(method,{...input,tier:'pro'},{cookie:cookie(),'x-velmere-entitlement-id':id}));
    assert.ok(generated);assert.equal(checks,2);assert.equal(r.status,mode==='stable'?200:mode==='session-revoked'?401:403);
    const result=await r.json();if(mode==='stable')assert.equal(result.clientTier,'pro');else assert.equal(result.report,undefined);
  } finally {Object.defineProperty(profile,'riskScore',desc);resolveRequestAccountDependencies.verifyFamily=old;clearMemoryEntitlements();}
});

test('C8 historical case bypass reproduced; C9 requires active grant despite historic entitlementVerified',async()=>{
  assert.equal(requiresDurableVlmPaidEntitlementLedger(),false);clearMemoryEntitlements();
  const created=await createAuditIntakeCase({requestId:'c9-historical-report-fixture',accountId,tier:'pro',locale:'en',target:{kind:'contract',canonicalTarget:fixture,displayLabel:'Synthetic C9 target',chainId:'56',chainName:'BSC',targetHash:buildAuditContractTargetHash('56',fixture)}});
  assert.ok(created.ok&&created.record,'isolated case fixture created');const caseRef=created.record!.caseRef;
  // Persisted historical status, deliberately without an active entitlement.
  const record=await getAuditCaseForOwningAccount({caseRef,accountId});assert.ok(record.record);record.record!.entitlementVerified=true;
  const path='app/api/audit/report/c9-baseline-route.ts';
  // Q13: the exact Git blob is shipped as a text fixture. Verify it before the
  // historical replay instead of requiring unavailable Git history in a ZIP.
  const raw=readFileSync(new URL('../c15-q13/fixtures/c8-report-route.ts.txt',import.meta.url));
  assert.equal(createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex'),'158f0f6294d56925089e1baace57ba26d09aafdc');
  writeFileSync(path,raw);
  const old=resolveRequestAccountDependencies.verifyFamily;resolveRequestAccountDependencies.verifyFamily=async state=>({...state,status:'active'});
  try {
    const baseline=await import(pathToFileURL(resolve(path)).href);
    const params={...input,caseRef,tier:'pro'},headers={cookie:cookie()};
    const before=await baseline.GET(request('GET',params,headers));assert.equal(before.status,200);assert.equal((await before.json()).clientTier,'pro');
    const after=await GET(request('GET',params,headers));assert.equal(after.status,403);assert.equal((await after.json()).error,'current_audit_entitlement_required');
    mkdirSync('/tmp/c9-evidence',{recursive:true});writeFileSync('/tmp/c9-evidence/JSON_AUTHORITY_REPLAY.json',JSON.stringify({baselineSha:'0609ef1c5aeecfab6de3ada8144efaa089064c71',sourceSha:process.env.GITHUB_SHA??null,at:new Date().toISOString(),before:{http:200,clientTier:'pro',currentGrant:false},after:{http:403},scope:'REAL_ROUTES_CONTROLLED_IN_MEMORY_AUTHORITY_NOT_PAID_USER_E2E'},null,2));
  } finally {unlinkSync(path);resolveRequestAccountDependencies.verifyFamily=old;record.record!.entitlementVerified=false;clearMemoryEntitlements();}
});
