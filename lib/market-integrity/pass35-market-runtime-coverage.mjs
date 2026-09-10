import { createHash } from 'node:crypto';

const SHA=/^sha256:[a-f0-9]{64}$/u;
const TIER_ORDER={basic:0,pro:1,advanced:2};
const stable=(value)=>JSON.stringify(sortDeep(value));
function sortDeep(value){
  if(Array.isArray(value)) return value.map(sortDeep);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map((k)=>[k,sortDeep(value[k])]));
  return value;
}
const digest=(value)=>`sha256:${createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex')}`;
const upper=(value)=>String(value??'').trim().toUpperCase();
const uniq=(items)=>[...new Set(items)].sort();

function assertIso(value,label){ if(!Number.isFinite(Date.parse(value))) throw new Error(`invalid_iso:${label}`); }
function assertDigest(value,label){ if(!SHA.test(String(value??''))) throw new Error(`invalid_digest:${label}`); }
function canonicalAssetId(row){
  const explicit=String(row.canonicalAssetId??'').trim();
  if(explicit) return explicit;
  const cls=String(row.assetClass??'').trim().toLowerCase();
  const base=upper(row.baseSymbol||row.symbol);
  const venue=upper(row.venue||row.exchange||'GLOBAL');
  if(!cls||!base) throw new Error('catalog_identity_missing');
  return cls==='crypto'?`crypto:${base}`:`${cls}:${venue}:${base}`;
}

export function buildProviderCatalogSnapshot(input){
  if(!input||typeof input!=='object') throw new Error('snapshot_input_missing');
  const providerId=String(input.providerId??'').trim().toLowerCase();
  const providerFamily=String(input.providerFamily??providerId).trim().toLowerCase();
  if(!/^[a-z0-9_.-]{2,64}$/u.test(providerId)||!/^[a-z0-9_.-]{2,64}$/u.test(providerFamily)) throw new Error('provider_identity_invalid');
  assertIso(input.observedAt,'observedAt');
  assertDigest(input.rawPayloadDigest,'rawPayloadDigest');
  if(!['LIVE','DEGRADED','WITHDRAWN','FIXTURE'].includes(input.providerState)) throw new Error('provider_state_invalid');
  if(!Array.isArray(input.instruments)) throw new Error('instruments_missing');
  const seen=new Set();
  const rows=input.instruments.map((row,index)=>{
    const providerInstrumentId=String(row.providerInstrumentId??'').trim();
    if(!providerInstrumentId||seen.has(providerInstrumentId)) throw new Error(`provider_instrument_id_invalid:${index}`);
    seen.add(providerInstrumentId);
    const assetId=canonicalAssetId(row);
    const status=String(row.status??'').toUpperCase();
    if(!['ACTIVE','HALTED','DELISTED','INACTIVE'].includes(status)) throw new Error(`instrument_status_invalid:${providerInstrumentId}`);
    return {
      providerInstrumentId,
      canonicalAssetId:assetId,
      assetClass:String(row.assetClass??'').trim().toLowerCase(),
      symbol:upper(row.symbol||row.baseSymbol),
      baseSymbol:upper(row.baseSymbol||row.symbol),
      quoteSymbol:upper(row.quoteSymbol||''),
      venue:upper(row.venue||providerId),
      marketType:String(row.marketType??'spot').trim().toLowerCase(),
      status,
      firstSeenAt:String(row.firstSeenAt??input.observedAt),
      lastSeenAt:String(row.lastSeenAt??input.observedAt),
      sourceRef:String(row.sourceRef??`${providerId}:${providerInstrumentId}`),
    };
  }).sort((a,b)=>a.providerInstrumentId.localeCompare(b.providerInstrumentId));
  for(const row of rows){assertIso(row.firstSeenAt,`${row.providerInstrumentId}:firstSeenAt`);assertIso(row.lastSeenAt,`${row.providerInstrumentId}:lastSeenAt`);}
  const unsigned={
    schemaVersion:'velmere.pass35.provider-catalog-snapshot.v1',
    providerId,providerFamily,providerState:input.providerState,observedAt:new Date(input.observedAt).toISOString(),
    rawPayloadDigest:input.rawPayloadDigest,
    termsMode:String(input.termsMode??'PUBLIC_FREE_UNVERIFIED'),
    instruments:rows,
    activeInstrumentCount:rows.filter((r)=>r.status==='ACTIVE').length,
  };
  return {...unsigned,snapshotDigest:digest(unsigned)};
}

export function verifyProviderCatalogSnapshot(snapshot){
  try{
    const {snapshotDigest,...unsigned}=snapshot;
    if(snapshot.schemaVersion!=='velmere.pass35.provider-catalog-snapshot.v1'||!SHA.test(snapshotDigest)||digest(unsigned)!==snapshotDigest) return false;
    const rebuilt=buildProviderCatalogSnapshot({...unsigned,instruments:unsigned.instruments});
    return rebuilt.snapshotDigest===snapshotDigest;
  }catch{return false;}
}

export function buildDynamicMarketDenominator({snapshots,evaluatedAt,maxSnapshotAgeSeconds=900}){
  assertIso(evaluatedAt,'evaluatedAt');
  if(!Array.isArray(snapshots)||snapshots.length===0) throw new Error('catalog_snapshots_missing');
  const now=Date.parse(evaluatedAt); const providerIds=new Set();
  const listings=[]; const excluded=[];
  for(const snapshot of snapshots){
    if(!verifyProviderCatalogSnapshot(snapshot)) throw new Error(`catalog_snapshot_invalid:${snapshot?.providerId}`);
    if(providerIds.has(snapshot.providerId)) throw new Error(`duplicate_provider_snapshot:${snapshot.providerId}`);
    providerIds.add(snapshot.providerId);
    const age=Math.max(0,Math.floor((now-Date.parse(snapshot.observedAt))/1000));
    const snapshotUsable=snapshot.providerState==='LIVE'&&age<=maxSnapshotAgeSeconds;
    for(const row of snapshot.instruments){
      const item={...row,providerId:snapshot.providerId,providerFamily:snapshot.providerFamily,snapshotDigest:snapshot.snapshotDigest,snapshotAgeSeconds:age,termsMode:snapshot.termsMode};
      if(snapshotUsable&&row.status==='ACTIVE') listings.push(item); else excluded.push({...item,exclusionReason:!snapshotUsable?'provider_snapshot_not_live_or_fresh':`instrument_${row.status.toLowerCase()}`});
    }
  }
  listings.sort((a,b)=>`${a.canonicalAssetId}:${a.providerId}:${a.providerInstrumentId}`.localeCompare(`${b.canonicalAssetId}:${b.providerId}:${b.providerInstrumentId}`));
  const assetsMap=new Map();
  for(const row of listings){
    const current=assetsMap.get(row.canonicalAssetId)??{canonicalAssetId:row.canonicalAssetId,assetClass:row.assetClass,symbol:row.symbol,providerFamilies:[],providerIds:[],listingIds:[],venues:[],quoteSymbols:[]};
    current.providerFamilies.push(row.providerFamily);current.providerIds.push(row.providerId);current.listingIds.push(`${row.providerId}:${row.providerInstrumentId}`);current.venues.push(row.venue);if(row.quoteSymbol)current.quoteSymbols.push(row.quoteSymbol);
    assetsMap.set(row.canonicalAssetId,current);
  }
  const assets=[...assetsMap.values()].map((row)=>({...row,providerFamilies:uniq(row.providerFamilies),providerIds:uniq(row.providerIds),listingIds:uniq(row.listingIds),venues:uniq(row.venues),quoteSymbols:uniq(row.quoteSymbols)})).sort((a,b)=>a.canonicalAssetId.localeCompare(b.canonicalAssetId));
  const unsigned={
    schemaVersion:'velmere.pass35.dynamic-market-denominator.v1',
    evaluatedAt:new Date(evaluatedAt).toISOString(),maxSnapshotAgeSeconds,
    providerSnapshotDigests:snapshots.map((s)=>s.snapshotDigest).sort(),
    providerDenominator:providerIds.size,
    activeListingDenominator:listings.length,
    activeAssetDenominator:assets.length,
    excludedListingCount:excluded.length,
    listings,assets,excluded,
    truthBoundary:'Denominator is the normalized active catalog visible in fresh LIVE provider snapshots; it is not a fixed 50-case corpus and not every instrument globally.',
  };
  return {...unsigned,denominatorDigest:digest(unsigned)};
}

export function verifyDynamicMarketDenominator(receipt){
  try{
    const {denominatorDigest,...unsigned}=receipt;
    return receipt.schemaVersion==='velmere.pass35.dynamic-market-denominator.v1'&&SHA.test(denominatorDigest)&&digest(unsigned)===denominatorDigest
      &&receipt.activeAssetDenominator===receipt.assets.length&&receipt.activeListingDenominator===receipt.listings.length
      &&new Set(receipt.assets.map((a)=>a.canonicalAssetId)).size===receipt.assets.length;
  }catch{return false;}
}

function visibleRequirements(contract,surfaceId,tier){
  const surface=contract.surfaces.find((s)=>s.surfaceId===surfaceId); if(!surface) throw new Error(`surface_unknown:${surfaceId}`);
  const names=['basic','pro','advanced'].slice(0,TIER_ORDER[tier]+1);
  const fields=[];
  for(const name of names){for(const field of surface.tiers[name].requiredFields){if(!/^all_(basic|pro)_fields$/u.test(field)) fields.push(field);}}
  return uniq(fields);
}

export function buildSurfaceTierCoverage({contract,denominator,surfaceId,tier,observations,evaluatedAt}){
  if(!verifyDynamicMarketDenominator(denominator)) throw new Error('denominator_invalid');
  assertIso(evaluatedAt,'evaluatedAt');
  if(!['shield','shield_pro','real_markets'].includes(surfaceId)||!(tier in TIER_ORDER)) throw new Error('surface_or_tier_invalid');
  const requiredFields=visibleRequirements(contract,surfaceId,tier);
  const obs=Array.isArray(observations)?observations:[];
  const byAsset=new Map(); for(const row of obs){const list=byAsset.get(row.canonicalAssetId)??[];list.push(row);byAsset.set(row.canonicalAssetId,list);}
  const now=Date.parse(evaluatedAt); const minQuorum=tier==='basic'?1:tier==='pro'?2:3;
  const rows=denominator.assets.map((asset)=>{
    const assetObs=byAsset.get(asset.canonicalAssetId)??[];
    const fieldRows=requiredFields.map((fieldId)=>{
      const candidates=assetObs.filter((o)=>o.fieldId===fieldId&&o.state==='AVAILABLE'&&Number.isFinite(Date.parse(o.observedAt))&&Math.max(0,(now-Date.parse(o.observedAt))/1000)<=Number(o.maxAgeSeconds??300)&&SHA.test(String(o.contentDigest??'')));
      const roots=uniq(candidates.map((o)=>String(o.upstreamRoot??o.providerFamily??'').trim()).filter(Boolean));
      const conflicting=assetObs.some((o)=>o.fieldId===fieldId&&o.state==='CONFLICTED');
      const state=conflicting?'CONFLICTED':roots.length>=minQuorum?'AVAILABLE':assetObs.some((o)=>o.fieldId===fieldId&&o.state==='STALE')?'STALE':'MISSING';
      return {fieldId,state,independentUpstreamCount:roots.length,minimumIndependentQuorum:minQuorum,upstreamRoots:roots};
    });
    const available=fieldRows.filter((f)=>f.state==='AVAILABLE').length;
    const state=available===requiredFields.length?'ELIGIBLE':fieldRows.some((f)=>f.state==='CONFLICTED')?'CONFLICTED':fieldRows.some((f)=>f.state==='STALE')?'STALE':'UNAVAILABLE';
    return {canonicalAssetId:asset.canonicalAssetId,fieldDenominator:requiredFields.length,availableFieldNumerator:available,completenessBps:requiredFields.length?Math.floor(available*10000/requiredFields.length):0,state,fieldRows};
  });
  const fieldCellDenominator=rows.reduce((s,r)=>s+r.fieldDenominator,0); const availableFieldCellNumerator=rows.reduce((s,r)=>s+r.availableFieldNumerator,0);
  const unsigned={schemaVersion:'velmere.pass35.surface-tier-market-coverage.v1',evaluatedAt:new Date(evaluatedAt).toISOString(),surfaceId,tier,denominatorDigest:denominator.denominatorDigest,requiredFields,minimumIndependentQuorum:minQuorum,assetDenominator:rows.length,eligibleAssetCount:rows.filter((r)=>r.state==='ELIGIBLE').length,fieldCellDenominator,availableFieldCellNumerator,completenessBps:fieldCellDenominator?Math.floor(availableFieldCellNumerator*10000/fieldCellDenominator):0,rows,analysisEligibleForAllAssets:rows.length>0&&rows.every((r)=>r.state==='ELIGIBLE'),paidDeliveryEligible:false,sellEnabled:false,truthBoundary:'Coverage measures all assets in the current dynamic denominator. It never uses the 50-case regression corpus as market coverage and never unlocks billing by itself.'};
  return {...unsigned,coverageDigest:digest(unsigned)};
}

export function verifySurfaceTierCoverage(receipt){
  const {coverageDigest,...unsigned}=receipt;
  return receipt.schemaVersion==='velmere.pass35.surface-tier-market-coverage.v1'&&SHA.test(String(coverageDigest))&&digest(unsigned)===coverageDigest&&receipt.paidDeliveryEligible===false&&receipt.sellEnabled===false&&receipt.assetDenominator===receipt.rows.length;
}

export const pass35MarketRuntimeCoverageInternals={digest,stable,visibleRequirements};
