import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getShieldInstantBootstrapRows } from '../../lib/market-integrity/shield-instant-bootstrap';
import { shieldProFieldVerified, shieldProCalibratedRiskConfidence, shieldProPrimaryMarketSourceAsOf } from '../../lib/market-integrity/shield-pro-customer-truth';
import { projectShieldProTableRow } from '../../lib/market-integrity/shield-pro-table-customer-projection';
import { buildRiskHistoryCurrentObservation, verifyRiskHistoryCurrentObservation } from '../../lib/market-integrity/risk-history-current-alignment';
import type { TokenRiskResult } from '../../lib/market-integrity/risk-types';
import { resolveCanonicalRequestOrigins, inspectApiEdgeRequest } from '../../lib/security/api-edge-boundary';
import { analyzeContextualReentrancy } from '../../lib/security/v2/contextual-reentrancy-engine';
import type { CfgAnalysisResult } from '../../lib/security/v2/evm-cfg-dataflow-engine';

test('actual Shield bootstrap does not fabricate prices, providers, risk or candle history',()=>{
 assert.deepEqual(getShieldInstantBootstrapRows(),[]);
 assert.doesNotMatch(readFileSync('lib/market-integrity/shield-instant-bootstrap.ts','utf8'),/new Date|Math\.random|dataQuality:\s*["']live/);
});
test('absence of a delivery receipt and demo data are never verified market observations',()=>{
 assert.equal(shieldProFieldVerified({},'market.price'),false);
 assert.equal(shieldProFieldVerified({result:{dataQuality:'demo'}},'market.price'),false);
 assert.equal(shieldProFieldVerified({delivery:{fields:{'market.price':{state:'verified'}}}},'market.price'),true);
 assert.equal(shieldProPrimaryMarketSourceAsOf({observedAt:'2026-09-17T00:00:00.000Z'}),null);
});
test('confidence requires risk evidence and never defaults to a manufactured 88 percent',()=>{
 assert.equal(shieldProCalibratedRiskConfidence({}),null);
 assert.equal(shieldProCalibratedRiskConfidence({result:{confidence:.94}}),null);
 const evidence={delivery:{risk:{state:'verified'}},result:{customerTruth:{confidenceClass:'EVIDENCE_BOUND' as const},confidence:.94}};
 assert.equal(shieldProCalibratedRiskConfidence(evidence),94);
 assert.equal(shieldProCalibratedRiskConfidence({...evidence,result:{...evidence.result,confidence:Infinity}}),null);
 assert.equal(shieldProCalibratedRiskConfidence({...evidence,result:{...evidence.result,confidence:0}}),0);
});
test('a live-labeled row without field provenance is withheld by actual customer projection',()=>{
 assert.equal(projectShieldProTableRow({id:'not-observed',symbol:'FAKE',name:'Not an observation',price:123,result:{dataQuality:'live'}},'live'),null);
});
test('missing current score is a valid WITHHELD history observation, not 28 with render-time provenance',()=>{
 const r=buildRiskHistoryCurrentObservation({assetId:'unobserved',result:{} as TokenRiskResult,publishedScore:null});
 assert.equal(r.status,'WITHHELD');assert.equal(r.score,null);assert.equal(r.observedAt,null);assert.equal(verifyRiskHistoryCurrentObservation(r),true);
});
test('actual Shield component uses source history and does not bypass a failed projection',()=>{
 const s=readFileSync('components/market-integrity/ShieldRealMarketsParityClient.tsx','utf8');
 assert.doesNotMatch(s,/sessionStorage\.getItem|const safeScore = score \?\? 28|const gaussian|if \(!projection\) return \[row\]/);
 assert.match(s,/return buildRiskHistoryCurrentObservation\(/);assert.match(s,/if \(!projection\) return \[\];/);assert.match(s,/if \(loading \|\| sample\.length < 2\)/);
});
test('loopback qualification remains explicit and rejects unrelated Host without widening production trust',()=>{
 const env={NODE_ENV:'production' as const,VELMERE_CANONICAL_ORIGIN:'http://localhost:3000'};
 const good=new Request('http://localhost:3000/api/auth/session',{headers:{host:'localhost:3000'}});
 assert.equal(inspectApiEdgeRequest(good,env).ok,true);
 const hostile=new Request('http://attacker.invalid/api/auth/session',{headers:{host:'attacker.invalid'}});
 assert.equal(inspectApiEdgeRequest(hostile,env).ok,false);
 assert.equal(resolveCanonicalRequestOrigins(hostile,{NODE_ENV:'production',VERCEL:'1'}).origins.size,0);
});
const selectorCfg=(selector:string):CfgAnalysisResult=>({cfg:{blocks:new Map(),entryBlockId:'none',totalInstructions:0,cyclomaticComplexity:0,unresolvedDynamicJumps:0},selectorsDiscovered:new Map([[selector,16]]),storageSlotsRead:new Set(),storageSlotsWritten:new Set(),taintSinks:[],hasReentrancyGuard:false,guardedStorageSlots:new Set()});
test('actual engine does not let arbitrary source comments suppress selector review',()=>{
 const cfg=selectorCfg('0xbb7b8686');
 const a=analyzeContextualReentrancy('0x00000000000000000000000000000000000000c6',cfg,'contract Case {}');
 const b=analyzeContextualReentrancy('0x00000000000000000000000000000000000000c6',cfg,'// nonReentrantView claim_admin_fees is_reentrant\ncontract Case {}');
 assert.deepEqual(b.findings,a.findings);assert.equal(a.findings.length,1);
 const f=a.findings[0];assert.equal(f.exploitability,'theoretical');assert.equal(f.confidence,'low');assert.equal(f.remediation.appliedSuccessfully,false);assert.equal(f.remediation.regressionPassed,false);assert.match(f.evidence.hashProof,/^sha256:[a-f0-9]{64}$/);
});
test('ERC-777 selector observation is not reported as a confirmed active exploit',()=>{
 const f=analyzeContextualReentrancy('0x00000000000000000000000000000000000000c6',selectorCfg('0x0023de29')).findings[0];
 assert.equal(f.confidence,'low');assert.equal(f.exploitability,'theoretical');assert.match(f.proofOfConcept.summary,/UNEXECUTED/);assert.match(f.evidence.hashProof,/^sha256:[a-f0-9]{64}$/);
});
