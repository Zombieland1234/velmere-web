import { createHash } from 'node:crypto';
import { verifyDynamicMarketDenominator } from './pass35-market-runtime-coverage.mjs';

const SHA=/^sha256:[a-f0-9]{64}$/u;
const ADDRESS=/^0x[a-fA-F0-9]{40}$/u;
const stable=(value)=>JSON.stringify(sortDeep(value));
function sortDeep(value){if(Array.isArray(value))return value.map(sortDeep);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,sortDeep(value[key])]));return value;}
const digest=(value)=>`sha256:${createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex')}`;
const uniq=(items)=>[...new Set(items)].sort();

export const PASS35_A13_WHALE_TOKEN_DENOMINATOR_ID='pass35-a13-whale-supported-token-denominator-v1';

function verifyBinding(binding){
  return binding&&binding.schemaVersion==='velmere.pass35.token-chain-binding.v1'&&binding.chainId===1&&ADDRESS.test(binding.address)&&/^crypto:[A-Z0-9._-]+$/u.test(binding.canonicalAssetId)&&SHA.test(binding.bindingDigest)&&digest(Object.fromEntries(Object.entries(binding).filter(([key])=>key!=='bindingDigest')))===binding.bindingDigest;
}

export function buildPass35A13TokenBinding(input){
  const unsigned={schemaVersion:'velmere.pass35.token-chain-binding.v1',canonicalAssetId:String(input.canonicalAssetId),symbol:String(input.symbol).toUpperCase(),chainId:Number(input.chainId),address:String(input.address).toLowerCase(),source:String(input.source??'SIGNED_MANUAL_REGISTRY'),verifiedAt:new Date(input.verifiedAt).toISOString(),expiresAt:new Date(input.expiresAt).toISOString(),verificationMode:String(input.verificationMode??'ADDRESS_CHAIN_EXACT')};
  if(unsigned.chainId!==1||!ADDRESS.test(unsigned.address)||!/^crypto:[A-Z0-9._-]+$/u.test(unsigned.canonicalAssetId))throw new Error('token_binding_invalid');
  return {...unsigned,bindingDigest:digest(unsigned)};
}

function evidenceState(row,now){
  if(!row)return 'MISSING';
  if(!SHA.test(String(row.receiptDigest??'')))return 'INVALID';
  if(!Number.isFinite(Date.parse(row.observedAt)))return 'INVALID';
  const age=Math.max(0,(now.getTime()-Date.parse(row.observedAt))/1000);
  if(age>Number(row.maxAgeSeconds??86_400))return 'STALE';
  return row.status==='AVAILABLE'?'AVAILABLE':row.status==='CONFLICTED'?'CONFLICTED':'MISSING';
}

function unsigned(value){const {integrity,...rest}=value;return rest;}
export function verifyPass35A13WhaleTokenDenominator(value){
  try{
    if(value.schemaVersion!=='velmere.pass35.whale-token-denominator.v1'||!SHA.test(value.integrity?.digest)||digest(unsigned(value))!==value.integrity.digest)return false;
    if(!Array.isArray(value.rows)||value.assetDenominator!==value.rows.length||value.sellEnabled!==false||value.paidDeliveryEligible!==false)return false;
    if(value.rows.some((row)=>row.chainBound&&(!ADDRESS.test(row.address)||row.chainId!==1)))return false;
    return true;
  }catch{return false;}
}

export function buildPass35A13WhaleTokenDenominator(args){
  const denominator=args?.marketDenominator;
  if(!verifyDynamicMarketDenominator(denominator))throw new Error('whale_market_denominator_invalid');
  const evaluatedAt=new Date(args.evaluatedAt??denominator.evaluatedAt);
  const bindings=new Map((args.bindings??[]).filter(verifyBinding).map((binding)=>[binding.canonicalAssetId,binding]));
  const evidenceByAsset=new Map();
  for(const row of args.evidence??[]){const list=evidenceByAsset.get(row.canonicalAssetId)??[];list.push(row);evidenceByAsset.set(row.canonicalAssetId,list);}
  const assets=denominator.assets.filter((asset)=>asset.assetClass==='crypto').sort((a,b)=>a.canonicalAssetId.localeCompare(b.canonicalAssetId));
  const rows=assets.map((asset)=>{
    const binding=bindings.get(asset.canonicalAssetId)??null;
    const evidence=evidenceByAsset.get(asset.canonicalAssetId)??[];
    const capability=(name)=>evidenceState(evidence.find((row)=>row.capability===name),evaluatedAt);
    const holders=capability('holders');const transfers=capability('transfers');const labels=capability('labels');const marketImpact=capability('market_impact');
    const basicEligible=Boolean(binding)&&holders==='AVAILABLE'&&transfers==='AVAILABLE';
    const proEligible=basicEligible&&labels==='AVAILABLE';
    const advancedEligible=proEligible&&marketImpact==='AVAILABLE';
    const blockers=[];
    if(!binding)blockers.push('exact_chain_address_binding_missing');
    for(const [name,state] of Object.entries({holders,transfers,labels,marketImpact}))if(state!=='AVAILABLE')blockers.push(`${name}_${state.toLowerCase()}`);
    return {canonicalAssetId:asset.canonicalAssetId,symbol:asset.symbol,providerFamilies:asset.providerFamilies,chainBound:Boolean(binding),chainId:binding?.chainId??null,address:binding?.address??null,bindingDigest:binding?.bindingDigest??null,evidenceStates:{holders,transfers,labels,marketImpact},tiers:{basic:{state:basicEligible?'ELIGIBLE':'UNAVAILABLE'},pro:{state:proEligible?'ELIGIBLE':'UNAVAILABLE'},advanced:{state:advancedEligible?'ELIGIBLE':'UNAVAILABLE'}},blockers:uniq(blockers),sellEnabled:false};
  });
  const unsignedValue={schemaVersion:'velmere.pass35.whale-token-denominator.v1',runtimeId:PASS35_A13_WHALE_TOKEN_DENOMINATOR_ID,evaluatedAt:evaluatedAt.toISOString(),marketDenominatorDigest:denominator.denominatorDigest,assetDenominator:rows.length,boundTokenCount:rows.filter((row)=>row.chainBound).length,basicEligibleCount:rows.filter((row)=>row.tiers.basic.state==='ELIGIBLE').length,proEligibleCount:rows.filter((row)=>row.tiers.pro.state==='ELIGIBLE').length,advancedEligibleCount:rows.filter((row)=>row.tiers.advanced.state==='ELIGIBLE').length,bindingCoverageBps:rows.length?Math.floor(rows.filter((row)=>row.chainBound).length*10_000/rows.length):0,rows,productionDenominatorRule:'Every normalized active crypto asset is counted. A symbol without exact chain/address binding is unavailable, never silently omitted or inferred.',sellEnabled:false,paidDeliveryEligible:false,liveClaimed:false,truthBoundary:'This denominator measures supported-token readiness over the complete active crypto catalog. Fixture bindings/evidence prove the algorithm only. Real keys, current chain state, labels, monitoring and customer outcomes are not claimed.'};
  const value={...unsignedValue,integrity:{algorithm:'sha256',digest:digest(unsignedValue)}};
  if(!verifyPass35A13WhaleTokenDenominator(value))throw new Error('whale_token_denominator_integrity_invalid');
  return value;
}

export const pass35A13WhaleDenominatorInternals={digest,verifyBinding,evidenceState};
