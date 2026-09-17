import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildCanonicalAuditReport,canonicalReportToPdfLines,renderCanonicalReportToPdf,type AuditTier}from'../../lib/security/audit-canonical-report';
import {BENCHMARK_20_CONTRACTS}from'../../lib/security/contract-audit-profiles';
import {renderInstitutionalMerkleSealCard}from'../../lib/security/pdf-institutional-seal';
import {fetchOnChainBytecode}from'../../lib/security/evm-rpc-fetcher';
import {createHash}from'node:crypto';
const target=Object.values(BENCHMARK_20_CONTRACTS)[0];
for(const locale of ['pl','en','de'] as const)test(`customer PDF lines withhold unexecuted proof claims across tiers: ${locale}`,()=>{
 for(const tier of ['basic','pro','advanced']as AuditTier[]){
  const r=buildCanonicalAuditReport({reportId:`c6e_${locale}_${tier}`,locale,contractName:target.contractName,contractAddress:target.contractAddress,network:target.network,chainId:target.chainId},tier);
  assert.equal(r.executionEvidence?.qualification,'NOT_VERIFIED');
  const lines=canonicalReportToPdfLines(r).join('\n');assert.match(lines,/NOT_VERIFIED/);
  assert.doesNotMatch(lines,/RFC\s*3161|VERIFIED - IMMUTABLE|QF_LIA|\bUNSAT\b|DETERMINISTIC_REPRODUCIBLE|95\/100|96%|88%|FORMAL ANALYSIS/i);
  for(const section of r.sections.filter(s=>s.isLocked))for(const f of section.data?.findings??[])assert.ok(!lines.includes(f.id));
  const p=renderCanonicalReportToPdf(r);assert.equal(p.pdfDigest.replace(/^sha256:/,''),createHash('sha256').update(p.pdfBytes).digest('hex'));
 }
});
test('legacy report metadata and caller-provided verification flags cannot promote exported proof status',()=>{
 const r=buildCanonicalAuditReport({reportId:'c6e_legacy',locale:'en',contractName:target.contractName,contractAddress:target.contractAddress,network:target.network,chainId:target.chainId},'basic');
 delete r.executionEvidence;r.verdict.verificationStatus='VERIFIED';r.verdict.releaseDecision='PASS';r.humanReviewEvidencePresent=true;
 const lines=canonicalReportToPdfLines(r).join('\n');assert.match(lines,/insufficient-evidence/);assert.match(lines,/Qualification: NOT_VERIFIED/);assert.doesNotMatch(lines,/Release Decision: PASS|VERIFIED - IMMUTABLE/);
});
test('generic Merkle card does not invent timestamp or issuer attestation',()=>{
 const r=renderInstitutionalMerkleSealCard({merkleRoot:'sha256:'+'a'.repeat(64),documentId:'c6e',isVerified:true},500);
 const texts=[...r.commands.join('\n').matchAll(/<([0-9a-f]+)>/g)].map(m=>Buffer.from(m[1],'hex').toString('ascii')).join('\n');
 assert.match(texts,/HASH ONLY - NOT ATTESTED/);assert.doesNotMatch(texts,/RFC\s*3161|VERIFIED - IMMUTABLE|Non-Repudiation/);
});
test('wrong RPC response media type remains denied after test fixture correction',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:'0x6000'}),{headers:{'content-type':'text/plain'}}));
 assert.equal((await fetchOnChainBytecode('0x0000000000000000000000000000000000c6e001','1')).ok,false);
});
