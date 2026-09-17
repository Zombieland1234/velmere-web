import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as pdf } from '../../app/api/audit/report-pdf/route';
import { GET as legacyGet, POST as legacyPost } from '../../app/api/checkout/stripe-analysis/route';
import { GET as legacyExport } from '../../app/api/market-integrity/export/route';
import { BENCHMARK_20_CONTRACTS } from '../../lib/security/contract-audit-profiles';
import { EvidenceReplayEngine } from '../../lib/security/replay/evidence-replay-engine';
import { resolveCanonicalRequestOrigins } from '../../lib/security/api-edge-boundary';
import { readFileSync } from 'node:fs';
const fixture = Object.keys(BENCHMARK_20_CONTRACTS)[0];
assert.ok(/^0x[0-9a-f]{40}$/i.test(fixture), 'actual source contains a fixture');
const request = (query: string) => new NextRequest(`http://127.0.0.1/api/audit/report-pdf?${query}`);
test('actual PDF rejects empty target instead of selecting the first corpus row',async()=>{
 const r=await pdf(request(''));assert.equal(r.status,400);assert.equal((await r.json()).error,'invalid_contract_address');
});
for (const tier of ['pro','advanced']) test(`actual fixture cannot grant ${tier} to anonymous account`,async()=>{
 const r=await pdf(request(`address=${fixture}&tier=${tier}`));assert.equal(r.status,401);assert.equal((await r.json()).error,'current_audit_entitlement_required');
});
test('actual Basic fixture PDF retains a verifiable byte digest',async()=>{
 const r=await pdf(request(`address=${fixture}&tier=basic`));assert.equal(r.status,200);assert.equal(r.headers.get('x-velmere-audit-pdf-tier'),'basic');
 const b=Buffer.from(await r.arrayBuffer());assert.equal(b.subarray(0,5).toString(),'%PDF-');
 assert.equal(r.headers.get('x-velmere-audit-pdf-digest')?.replace(/^sha256:/,''),createHash('sha256').update(b).digest('hex'));
});
test('actual PDF invalid tier cannot manufacture output',async()=>{assert.equal((await pdf(request(`address=${fixture}&tier=owner`))).status,400);});
test('retired checkout cannot disclose customer identity or paid access',async()=>{
 const r=await (legacyGet as (...args: unknown[])=>Promise<Response>|Response)(new NextRequest('http://127.0.0.1/api/checkout/stripe-analysis?sessionId=cs_test_not_owned'));
 assert.equal(r.status,410);const j=await r.json();assert.equal(j.paid,false);assert.equal(j.customerEmail,undefined);
});
test('retired checkout cannot create an unbound payment session',async()=>{
 const r=await (legacyPost as (...args: unknown[])=>Promise<Response>|Response)(new NextRequest('http://127.0.0.1/api/checkout/stripe-analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tier:'advanced',serviceType:'audit'})}));
 assert.equal(r.status,410);assert.equal((await r.json()).sessionId,undefined);
});
test('legacy market export cannot certify client metrics as VERIFIED',async()=>{
 const r=await (legacyExport as (...args: unknown[])=>Promise<Response>|Response)(new NextRequest('http://127.0.0.1/api/market-integrity/export?format=json&price=1&confidence=100&riskScore=0'));
 assert.equal(r.status,409);const s=await r.text();assert.ok(!s.includes('VERIFIED'));assert.ok(s.includes('verified_stored_report_required'));
});
test('differential excludes absent finding identifiers',()=>{
 const r=EvidenceReplayEngine.computeDifferential({sections:[{data:{findings:[{}]}}]},{sections:[{data:{findings:[{title:'new'}]}}]});assert.deepEqual(r.newFindings,['new']);assert.deepEqual(r.resolvedFindings,[]);
});
test('production canonical origin is never derived from attacker Host',()=>{
 const r=resolveCanonicalRequestOrigins(new Request('https://attacker.invalid/api/auth/session'),{NODE_ENV:'production',VERCEL_ENV:'production',VERCEL:'1'});assert.equal(r.origins.size,0);
});
test('both actual modals gate paid execution before local analysis',()=>{
 for(const p of ['components/market-integrity/AssetDetailModal.tsx','components/backup/legacy/LegacyAssetPopup.tsx']){
  const s=readFileSync(p,'utf8'),start=s.indexOf('async function launchAnalysis('),paid=s.indexOf('const paidTier =',start),gate=s.indexOf('const pass35PaidUiStopSell',paid),launch=s.indexOf('startLocalAnalysis(tier)',paid);assert.ok(start>=0&&paid>start&&gate>paid&&launch>gate,p);
 }
});
test('actual build no longer suppresses TypeScript failures',()=>{assert.doesNotMatch(readFileSync('next.config.mjs','utf8'),/ignoreBuildErrors:\s*true/);});
