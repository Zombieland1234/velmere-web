import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolveProviderDeliveryRights} from '../../lib/compliance/provider-delivery-rights-gate.mjs';
import {resolveProviderRights} from '../../lib/compliance/provider-rights-resolver.mjs';
import {buildBrowserDeliveryPreflight} from '../../lib/search/browser-delivery-policy';
import {executeBoundedSymbolicAnalysis} from '../../lib/security/v2/symbolic-formal-engine';
import {validateRemediationPatch} from '../../lib/security/v2/patch-validation-engine';
import {buildControlFlowGraph,disassembleBytecode} from '../../lib/security/v2/evm-cfg-dataflow-engine';
import {analyzeContextualReentrancy} from '../../lib/security/v2/contextual-reentrancy-engine';
import type {StandardFindingV2} from '../../lib/security/v2/types';
const now=Date.parse('2026-09-17T00:00:00.000Z');
function canonical(value:unknown):string {if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';return JSON.stringify(value);}
const digest=(x:unknown)=>createHash('sha256').update(typeof x==='string'?x:canonical(x)).digest('hex');
function fixture(change:(p:{status:string;evidence:{expiresAt:string;reviewBy:string}})=>void=()=>{}) {
 const policy={schemaVersion:'velmere.provider-use-policy.v1',providerId:'synthetic',policyVersion:'test-1',status:'approved',evidence:{reference:'SYNTHETIC_NO_LEGAL_GRANT',reviewStatus:'verified',verifiedAt:'2026-09-16T00:00:00.000Z',reviewBy:'2026-09-18T00:00:00.000Z',effectiveFrom:'2026-09-16T00:00:00.000Z',expiresAt:'2026-09-18T00:00:00.000Z'},grants:[{datasetId:'synthetic-data',productId:'synthetic-product',environment:'internal_test',operations:['display_derived','export_derived_pdf','cache'],maxCacheTtlSeconds:60}]};change(policy);
 const source={url:'https://example.invalid/synthetic-rights',sourceLocationHash:digest('https://example.invalid/synthetic-rights')};const boundSource={...source,observationSha256:digest(source)};
 const provider={providerId:'synthetic',sourceIds:['test'],legalApprovalStatus:'APPROVED',internalDiagnosticAllowed:false,rights:{customerDeliveryAllowed:true,pdfExportAllowed:true,cachingAllowed:true},operationPolicy:policy};
 const boundProvider={...provider,decisionSha256:digest(provider)};
 const matrix={sourceDocumentHashAvailable:true,sources:{test:boundSource},providers:[boundProvider]};return {...matrix,matrixSha256:digest(matrix)};
}
const scope={datasetId:'synthetic-data',productId:'synthetic-product',environment:'internal_test' as const,dataClass:'derived' as const};
function decision(purpose:'customer_delivery'|'pdf_export'|'caching',matrix=fixture(),operationScope:typeof scope & {cacheTtlSeconds?:number}=scope){return resolveProviderDeliveryRights({providerId:'synthetic',purpose,matrix,operationScope,nowMs:now});}
test('real shared delivery boundary accepts exact current synthetic permission',()=>{assert.equal(decision('customer_delivery').allowed,true);});
test('real shared delivery boundary rejects revoked policy despite static APPROVED',()=>{assert.equal(decision('customer_delivery',fixture(p=>{p.status='revoked';})).allowed,false);});
test('real shared delivery boundary rejects expired permission',()=>{assert.equal(decision('pdf_export',fixture(p=>{p.evidence.expiresAt='2026-09-16T12:00:00.000Z';})).allowed,false);});
test('real shared delivery boundary requires re-review after deadline',()=>{assert.equal(decision('customer_delivery',fixture(p=>{p.evidence.reviewBy='2026-09-16T12:00:00.000Z';})).allowed,false);});
test('real shared delivery boundary does not infer a missing operation scope',()=>{assert.equal(resolveProviderDeliveryRights({providerId:'synthetic',purpose:'customer_delivery',matrix:fixture(),nowMs:now}).allowed,false);});
test('real shared delivery boundary rejects dataset substitution',()=>{assert.equal(decision('customer_delivery',fixture(),{...scope,datasetId:'other'}).allowed,false);});
test('real shared delivery boundary enforces cache retention limit',()=>{assert.equal(decision('caching',fixture(),{...scope,cacheTtlSeconds:61}).allowed,false);assert.equal(decision('caching',fixture(),{...scope,cacheTtlSeconds:60}).allowed,true);});
test('derived output flag does not grant upstream rights in actual Browser policy',()=>{const p=buildBrowserDeliveryPreflight('lens_preview',{mode:'derived_analytics',derivedAllowed:true},now);assert.equal(p.customerDeliveryAllowed,false);assert.equal(p.providerNetworkAllowed,false);});
test('legacy rights resolver fails closed for an invalid server time',()=>{
 const result=resolveProviderRights({providerId:'synthetic',now:'not-a-date',registry:{providers:[{id:'synthetic',technicalState:'CODE_PRESENT'}]},evidenceManifest:{evidence:[{providerId:'synthetic',reviewDecision:'APPROVED',reviewer:{legalReview:true},documentSha256:'1'.repeat(64),effectiveAt:'2026-09-16T00:00:00.000Z',rights:{displayUseAllowed:true}}]}});assert.equal(result.allowed,false);
});
test('actual symbolic layer cannot claim SMT proofs from an empty CFG',()=>{const cfg=buildControlFlowGraph(disassembleBytecode('0x00').instructions).cfg;const r=executeBoundedSymbolicAnalysis(cfg,'0x'+'1'.repeat(40));assert.ok(r.formalAssurance.every(x=>x.proven===false&&x.status==='NOT_VERIFIED'&&x.solver==='NOT_RUN'));});
test('actual patch layer cannot claim compilation from a keyword in a diff',()=>{
 const r=validateRemediationPatch({findingId:'VLM-SEC-REENTRANCY-01',remediation:{solidityPatchDiff:'--- a/X.sol\n+++ b/X.sol\n@@ -1 +1 @@\n-f()\n+f() nonReentrant'}} as StandardFindingV2,'not valid Solidity');assert.equal(r.validationStatus,'INCONCLUSIVE');assert.equal(r.patchApplied,false);assert.equal(r.compilationClean,false);assert.equal(r.vulnerabilityEliminated,false);assert.match(r.validationProofDigest,/^sha256:[a-f0-9]{64}$/);
});
test('actual reentrancy detector follows multiple CFG successors without comment suppression',()=>{
 const cfg=buildControlFlowGraph(disassembleBytecode('0xf16005565b5b6009555b00').instructions);
 // Independent compiler-based observations cover realistic contracts. This small
 // test ensures the source-text word lock cannot remove an existing CFG finding.
 const a=analyzeContextualReentrancy('test',cfg,'contract X {}'),b=analyzeContextualReentrancy('test',cfg,'// lock\ncontract X {}');assert.deepEqual(a.findings,b.findings);
});
