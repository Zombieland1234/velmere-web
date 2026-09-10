import { createHash } from 'node:crypto';
import { verifyPass35A13MarketTargetSchedule } from './pass35-market-target-scheduler.mjs';

const SHA=/^sha256:[a-f0-9]{64}$/u;
const STATES=new Set(['AVAILABLE','UNAVAILABLE','STALE','CONFLICTED','FAILED','RATE_LIMITED']);
const MODES=new Set(['PUBLIC_NETWORK','LOCAL_HTTP_FIXTURE','INJECTED_FIXTURE']);
const stable=(value)=>JSON.stringify(sortDeep(value));
function sortDeep(value){if(Array.isArray(value))return value.map(sortDeep);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,sortDeep(value[key])]));return value;}
const digest=(value)=>`sha256:${createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex')}`;
const uniq=(items)=>[...new Set(items)].sort();
const emptyCounts=()=>({AVAILABLE:0,UNAVAILABLE:0,STALE:0,CONFLICTED:0,FAILED:0,RATE_LIMITED:0});

export const PASS35_A14_EXECUTION_LEDGER_ID='pass35-a14-full-catalog-execution-ledger-v1';

function normalizeResult(job,result,evaluatedAt){
  if(!result)return {...job,state:'UNAVAILABLE',observedAt:null,ageSeconds:null,payloadDigest:null,errorCode:'result_missing',sourceMode:'MISSING_EXPLICIT'};
  if(result.jobId!==job.jobId||result.providerId!==job.providerId||result.role!==job.role||result.canonicalAssetId!==job.canonicalAssetId)throw new Error('execution_result_binding_mismatch');
  let state=String(result.state??'FAILED').toUpperCase();
  if(!STATES.has(state))throw new Error('execution_result_state_invalid');
  const observedAt=result.observedAt?new Date(result.observedAt):null;
  const ageSeconds=observedAt&&Number.isFinite(observedAt.getTime())?Math.max(0,(evaluatedAt.getTime()-observedAt.getTime())/1000):null;
  if(state==='AVAILABLE'&&(ageSeconds===null||ageSeconds>job.maximumAgeSeconds))state='STALE';
  const payloadDigest=result.payloadDigest??null;
  if(['AVAILABLE','STALE','CONFLICTED'].includes(state)&&!SHA.test(String(payloadDigest)))throw new Error('execution_result_payload_digest_missing');
  return {...job,state,observedAt:observedAt&&Number.isFinite(observedAt.getTime())?observedAt.toISOString():null,ageSeconds:ageSeconds===null?null:Number(ageSeconds.toFixed(3)),payloadDigest,errorCode:result.errorCode?String(result.errorCode):null,sourceMode:String(result.sourceMode??'UNSPECIFIED'),recordCount:Number.isFinite(Number(result.recordCount))?Math.max(0,Math.floor(Number(result.recordCount))):0,latencyMs:Number.isFinite(Number(result.latencyMs))?Math.max(0,Number(result.latencyMs)):null};
}

function summarize(rows,key){
  const map=new Map();
  for(const row of rows){const id=String(row[key]);const current=map.get(id)??{[key]:id,total:0,...emptyCounts()};current.total+=1;current[row.state]+=1;map.set(id,current);}
  return [...map.values()].map((row)=>({...row,availableCoverageBps:row.total?Math.floor(row.AVAILABLE*10_000/row.total):0,accountedCoverageBps:row.total?Math.floor(Object.values(STATES).reduce((sum,state)=>sum+row[state],0)*10_000/row.total):0})).sort((a,b)=>String(a[key]).localeCompare(String(b[key])));
}

function aggregateRoleStates(rows,role){
  const selected=rows.filter((row)=>row.role===role);const availableFamilies=uniq(selected.filter((row)=>row.state==='AVAILABLE').map((row)=>row.providerFamily));
  const states=uniq(selected.map((row)=>row.state));
  return {scheduled:selected.length,availableProviderFamilies:availableFamilies,states,state:selected.length===0?'UNAVAILABLE':availableFamilies.length>0?'AVAILABLE':states.includes('CONFLICTED')?'CONFLICTED':states.includes('STALE')?'STALE':'UNAVAILABLE'};
}

function unsigned(value){const {integrity,...rest}=value;return rest;}
export function verifyPass35A14ExecutionLedger(value){
  try{
    if(value.schemaVersion!=='velmere.pass35.full-catalog-execution-ledger.v1'||!SHA.test(value.integrity?.digest)||digest(unsigned(value))!==value.integrity.digest)return false;
    if(!Array.isArray(value.rows)||value.rowCount!==value.rows.length||value.rowCount!==value.scheduledJobCount)return false;
    if(value.fullCatalogAccounted!==true||value.orphanResultCount!==0||value.sellEnabled!==false||value.paidDeliveryEligible!==false||value.liveClaimed!==false)return false;
    if(!MODES.has(value.executionMode)||value.rows.some((row)=>!STATES.has(row.state)||!SHA.test(row.jobId)))return false;
    if(new Set(value.rows.map((row)=>row.jobId)).size!==value.rows.length)return false;
    return true;
  }catch{return false;}
}

export function buildPass35A14ExecutionLedger(args){
  const schedule=args?.schedule;if(!verifyPass35A13MarketTargetSchedule(schedule))throw new Error('execution_schedule_invalid');
  const executionMode=String(args.executionMode??'INJECTED_FIXTURE');if(!MODES.has(executionMode))throw new Error('execution_mode_invalid');
  const evaluatedAt=new Date(args.evaluatedAt??schedule.generatedAt);if(!Number.isFinite(evaluatedAt.getTime()))throw new Error('execution_evaluated_at_invalid');
  const resultMap=new Map();
  for(const result of args.results??[]){if(resultMap.has(result.jobId))throw new Error('execution_result_duplicate');resultMap.set(result.jobId,result);}
  const scheduleIds=new Set(schedule.jobs.map((job)=>job.jobId));
  const orphanResults=[...resultMap.keys()].filter((jobId)=>!scheduleIds.has(jobId));if(orphanResults.length)throw new Error('execution_result_orphan');
  const rows=schedule.jobs.map((job)=>normalizeResult(job,resultMap.get(job.jobId),evaluatedAt));
  const assetIds=uniq(schedule.assets.map((asset)=>asset.canonicalAssetId));
  const assets=assetIds.map((canonicalAssetId)=>{
    const assetRows=rows.filter((row)=>row.canonicalAssetId===canonicalAssetId);
    const quote=aggregateRoleStates(assetRows,'spot_quote');const klines=aggregateRoleStates(assetRows,'klines');const orderBook=aggregateRoleStates(assetRows,'order_book');
    const basic=quote.state==='AVAILABLE'&&klines.state==='AVAILABLE';
    const pro=basic&&orderBook.availableProviderFamilies.length>=2;
    const advanced=pro&&orderBook.availableProviderFamilies.length>=3;
    return {canonicalAssetId,spotQuote:quote,klines,orderBook,tiers:{basic:{state:basic?'ELIGIBLE':'UNAVAILABLE'},pro:{state:pro?'ELIGIBLE':'UNAVAILABLE'},advanced:{state:advanced?'ELIGIBLE':'UNAVAILABLE'}},sellEnabled:false};
  });
  const stateCounts=emptyCounts();for(const row of rows)stateCounts[row.state]+=1;
  const unsignedValue={schemaVersion:'velmere.pass35.full-catalog-execution-ledger.v1',ledgerId:PASS35_A14_EXECUTION_LEDGER_ID,generatedAt:new Date().toISOString(),evaluatedAt:evaluatedAt.toISOString(),executionMode,scheduleDigest:schedule.integrity.digest,denominatorDigest:schedule.denominatorDigest,scheduledJobCount:schedule.jobCount,rowCount:rows.length,orphanResultCount:0,stateCounts,availableCoverageBps:rows.length?Math.floor(stateCounts.AVAILABLE*10_000/rows.length):0,terminalCoverageBps:rows.length?10_000:0,byRole:summarize(rows,'role'),byProvider:summarize(rows,'providerId'),assetDenominator:assets.length,basicEligibleAssets:assets.filter((row)=>row.tiers.basic.state==='ELIGIBLE').length,proEligibleAssets:assets.filter((row)=>row.tiers.pro.state==='ELIGIBLE').length,advancedEligibleAssets:assets.filter((row)=>row.tiers.advanced.state==='ELIGIBLE').length,rows,assets,fullCatalogAccounted:rows.length===schedule.jobCount,productionRule:'Every scheduled job has exactly one terminal row. Missing, stale, conflicted, failed and rate-limited outcomes remain in the denominator and can never be silently dropped.',sellEnabled:false,paidDeliveryEligible:false,liveClaimed:false,truthBoundary:'A14 proves complete execution-ledger accounting over a scheduled catalog. Fixture or injected results do not prove public-network data, provider rights, staging, customer outcomes or paid readiness.'};
  const value={...unsignedValue,integrity:{algorithm:'sha256',digest:digest(unsignedValue)}};
  if(!verifyPass35A14ExecutionLedger(value))throw new Error('execution_ledger_integrity_invalid');
  return value;
}

export const pass35A14ExecutionLedgerInternals={digest,STATES,MODES};
