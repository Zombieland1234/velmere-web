import { createHash } from 'node:crypto';
import { verifyDynamicMarketDenominator } from './pass35-market-runtime-coverage.mjs';

const SHA=/^sha256:[a-f0-9]{64}$/u;
const stable=(value)=>JSON.stringify(sortDeep(value));
function sortDeep(value){if(Array.isArray(value))return value.map(sortDeep);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,sortDeep(value[key])]));return value;}
const digest=(value)=>`sha256:${createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex')}`;
const uniq=(items)=>[...new Set(items)].sort();
const PROVIDER_DEFAULTS=Object.freeze({
  binance:{requestsPerMinute:900,maxConcurrent:12,roles:['spot_quote','klines','order_book']},
  mexc:{requestsPerMinute:600,maxConcurrent:8,roles:['spot_quote','klines','order_book']},
  coinbase:{requestsPerMinute:300,maxConcurrent:6,roles:['spot_quote','klines','order_book']},
  kraken:{requestsPerMinute:120,maxConcurrent:4,roles:['spot_quote','klines','order_book']},
});

export const PASS35_A13_MARKET_TARGET_SCHEDULER_ID='pass35-a13-market-target-scheduler-v1';

function priorityFor(listing){
  let score=0;
  if(['USD','USDT','USDC','EUR'].includes(listing.quoteSymbol))score+=40;
  if(['BTC','ETH','SOL','BNB','XRP','DOGE','ADA'].includes(listing.symbol))score+=35;
  score+=Math.max(0,20-Math.min(20,listing.snapshotAgeSeconds/30));
  return Number(score.toFixed(2));
}

function buildJob(listing,role,sequence,windowStart){
  const providerPolicy=PROVIDER_DEFAULTS[listing.providerId]??{requestsPerMinute:60,maxConcurrent:2,roles:['spot_quote']};
  const intervalMs=Math.ceil(60_000/providerPolicy.requestsPerMinute);
  return {
    jobId:digest(`${listing.providerId}:${listing.providerInstrumentId}:${role}:${sequence}`),
    providerId:listing.providerId,
    providerFamily:listing.providerFamily,
    providerInstrumentId:listing.providerInstrumentId,
    canonicalAssetId:listing.canonicalAssetId,
    role,
    venue:listing.venue,
    quoteSymbol:listing.quoteSymbol,
    priority:priorityFor(listing),
    scheduledAt:new Date(windowStart.getTime()+sequence*intervalMs).toISOString(),
    maximumAgeSeconds:role==='order_book'?20:role==='spot_quote'?60:300,
    requestBudgetPerMinute:providerPolicy.requestsPerMinute,
    maximumConcurrent:providerPolicy.maxConcurrent,
    state:'SCHEDULED',
  };
}

function unsigned(value){const {integrity,...rest}=value;return rest;}
export function verifyPass35A13MarketTargetSchedule(value){
  try{
    if(value.schemaVersion!=='velmere.pass35.market-target-schedule.v1'||!SHA.test(value.integrity?.digest)||digest(unsigned(value))!==value.integrity.digest)return false;
    if(!Array.isArray(value.jobs)||!Array.isArray(value.unavailable)||value.jobCount!==value.jobs.length)return false;
    if(value.jobs.some((job)=>!SHA.test(String(job.jobId))))return false;
    if(value.fullCatalogPlanned!==true||value.sellEnabled!==false||value.paidDeliveryEligible!==false)return false;
    const ids=new Set(value.jobs.map((job)=>job.jobId));if(ids.size!==value.jobs.length)return false;
    return true;
  }catch{return false;}
}

export function buildPass35A13MarketTargetSchedule(args){
  const denominator=args?.denominator;
  if(!verifyDynamicMarketDenominator(denominator))throw new Error('market_target_denominator_invalid');
  const generatedAt=new Date(args.generatedAt??denominator.evaluatedAt);
  const requestedRoles=uniq(args.roles??['spot_quote','klines','order_book']);
  const jobs=[];const unavailable=[];const providerSequence=new Map();
  const listings=[...denominator.listings].sort((a,b)=>priorityFor(b)-priorityFor(a)||`${a.providerId}:${a.providerInstrumentId}`.localeCompare(`${b.providerId}:${b.providerInstrumentId}`));
  for(const listing of listings){
    const policy=PROVIDER_DEFAULTS[listing.providerId];
    if(!policy){unavailable.push({canonicalAssetId:listing.canonicalAssetId,providerId:listing.providerId,providerInstrumentId:listing.providerInstrumentId,reason:'provider_scheduler_policy_missing'});continue;}
    for(const role of requestedRoles){
      if(!policy.roles.includes(role)){unavailable.push({canonicalAssetId:listing.canonicalAssetId,providerId:listing.providerId,providerInstrumentId:listing.providerInstrumentId,role,reason:'provider_role_unsupported'});continue;}
      const current=providerSequence.get(listing.providerId)??0;
      jobs.push(buildJob(listing,role,current,generatedAt));providerSequence.set(listing.providerId,current+1);
    }
  }
  jobs.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||b.priority-a.priority||a.jobId.localeCompare(b.jobId));
  const assetCoverage=new Map();
  for(const asset of denominator.assets)assetCoverage.set(asset.canonicalAssetId,{canonicalAssetId:asset.canonicalAssetId,listingCount:asset.listingIds.length,scheduledRoles:[],providerFamilies:asset.providerFamilies});
  for(const job of jobs){const row=assetCoverage.get(job.canonicalAssetId);row.scheduledRoles.push(job.role);}
  const assets=[...assetCoverage.values()].map((row)=>({...row,scheduledRoles:uniq(row.scheduledRoles),shieldBasicPlanned:row.scheduledRoles.includes('spot_quote')&&row.scheduledRoles.includes('klines'),shieldProPlanned:row.scheduledRoles.includes('order_book'),marketImpactPlanned:row.scheduledRoles.includes('order_book')})).sort((a,b)=>a.canonicalAssetId.localeCompare(b.canonicalAssetId));
  const providerPlans=Object.keys(PROVIDER_DEFAULTS).map((providerId)=>{const providerJobs=jobs.filter((job)=>job.providerId===providerId);return {providerId,jobCount:providerJobs.length,firstScheduledAt:providerJobs[0]?.scheduledAt??null,lastScheduledAt:providerJobs.at(-1)?.scheduledAt??null,requestBudgetPerMinute:PROVIDER_DEFAULTS[providerId].requestsPerMinute,maximumConcurrent:PROVIDER_DEFAULTS[providerId].maxConcurrent};});
  const unsignedValue={schemaVersion:'velmere.pass35.market-target-schedule.v1',schedulerId:PASS35_A13_MARKET_TARGET_SCHEDULER_ID,generatedAt:generatedAt.toISOString(),denominatorDigest:denominator.denominatorDigest,activeAssetDenominator:denominator.activeAssetDenominator,activeListingDenominator:denominator.activeListingDenominator,requestedRoles,jobCount:jobs.length,unavailableCount:unavailable.length,assetPlanCount:assets.length,providerPlans,jobs,unavailable,assets,fullCatalogPlanned:assets.length===denominator.activeAssetDenominator,shieldBasicAssetPlanCount:assets.filter((row)=>row.shieldBasicPlanned).length,shieldProAssetPlanCount:assets.filter((row)=>row.shieldProPlanned).length,marketImpactAssetPlanCount:assets.filter((row)=>row.marketImpactPlanned).length,executionStatus:'PLAN_ONLY_NOT_NETWORK_EXECUTED',sellEnabled:false,paidDeliveryEligible:false,truthBoundary:'This plan covers every listing and normalized asset in the fresh dynamic denominator. It schedules public requests under provider budgets but does not claim that any network request, field observation, order book, customer output or paid delivery has executed.'};
  const value={...unsignedValue,integrity:{algorithm:'sha256',digest:digest(unsignedValue)}};
  if(!verifyPass35A13MarketTargetSchedule(value))throw new Error('market_target_schedule_integrity_invalid');
  return value;
}

export const pass35A13MarketTargetInternals={digest,priorityFor,PROVIDER_DEFAULTS};
