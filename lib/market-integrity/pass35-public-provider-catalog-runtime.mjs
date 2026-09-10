import { createHash } from 'node:crypto';
import { buildDynamicMarketDenominator, buildProviderCatalogSnapshot, verifyDynamicMarketDenominator, verifyProviderCatalogSnapshot } from './pass35-market-runtime-coverage.mjs';

const SHA=/^sha256:[a-f0-9]{64}$/u;
const MAX_RESPONSE_BYTES=12*1024*1024;
const DEFAULT_CACHE_TTL_MS=60_000;
const DEFAULT_TIMEOUT_MS=12_000;
const DEFAULT_ATTEMPTS=3;
const QUOTES=new Set(['USD','USDT','USDC','EUR','GBP','BTC','ETH']);
const stable=(value)=>JSON.stringify(sortDeep(value));
function sortDeep(value){if(Array.isArray(value))return value.map(sortDeep);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((k)=>[k,sortDeep(value[k])]));return value;}
const digest=(value)=>`sha256:${createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex')}`;
const upper=(value)=>String(value??'').trim().toUpperCase();
const lower=(value)=>String(value??'').trim().toLowerCase();
const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));

export const PASS35_A12_PROVIDER_CATALOG_RUNTIME_ID='pass35-a12-public-provider-catalog-runtime-v1';
export const PASS35_A12_PROVIDER_ENDPOINTS=Object.freeze({
  binance:{url:'https://api.binance.com/api/v3/exchangeInfo',endpointId:'binance_spot_exchange_info'},
  mexc:{url:'https://api.mexc.com/api/v3/exchangeInfo',endpointId:'mexc_spot_exchange_info'},
  coinbase:{url:'https://api.exchange.coinbase.com/products',endpointId:'coinbase_exchange_products'},
  kraken:{url:'https://api.kraken.com/0/public/AssetPairs',endpointId:'kraken_asset_pairs'},
});

const cache=new Map();
const inflight=new Map();
const budgets=new Map();

function cleanInstrument(args){
  const providerInstrumentId=String(args.providerInstrumentId??'').trim();
  const baseSymbol=upper(args.baseSymbol);
  const quoteSymbol=upper(args.quoteSymbol);
  if(!providerInstrumentId||!baseSymbol||!quoteSymbol) return null;
  return {
    providerInstrumentId,
    canonicalAssetId:`crypto:${baseSymbol}`,
    assetClass:'crypto',
    symbol:baseSymbol,
    baseSymbol,
    quoteSymbol,
    venue:upper(args.venue),
    marketType:'spot',
    status:args.status,
    sourceRef:String(args.sourceRef??`${lower(args.venue)}:${providerInstrumentId}`),
  };
}

function statusFromFlag(active,halted=false){return active?'ACTIVE':halted?'HALTED':'INACTIVE';}

export function parseBinanceCatalog(payload){
  const rows=payload?.symbols;
  if(!Array.isArray(rows)) throw new Error('binance_catalog_symbols_missing');
  return rows.flatMap((row)=>{
    if(!row||typeof row!=='object') return [];
    const symbol=String(row.symbol??'').trim();
    const base=upper(row.baseAsset); const quote=upper(row.quoteAsset);
    const spotAllowed=row.isSpotTradingAllowed!==false && (!Array.isArray(row.permissions)||row.permissions.length===0||row.permissions.includes('SPOT'));
    const status=upper(row.status);
    const active=status==='TRADING'&&spotAllowed;
    const halted=['BREAK','HALT','AUCTION_MATCH'].includes(status);
    const out=cleanInstrument({providerInstrumentId:symbol,baseSymbol:base,quoteSymbol:quote,venue:'BINANCE',status:statusFromFlag(active,halted),sourceRef:`binance:${symbol}`});
    return out?[out]:[];
  });
}

export function parseMexcCatalog(payload){
  const rows=payload?.symbols;
  if(!Array.isArray(rows)) throw new Error('mexc_catalog_symbols_missing');
  return rows.flatMap((row)=>{
    if(!row||typeof row!=='object') return [];
    const symbol=String(row.symbol??'').trim();
    const base=upper(row.baseAsset); const quote=upper(row.quoteAsset);
    const rawStatus=String(row.status??'').trim().toUpperCase();
    const allowed=row.isSpotTradingAllowed!==false && row.quoteOrderQtyMarketAllowed!==false;
    const active=allowed&&['1','ENABLED','TRADING','ONLINE',''].includes(rawStatus);
    const halted=['2','HALT','SUSPENDED','OFFLINE'].includes(rawStatus);
    const out=cleanInstrument({providerInstrumentId:symbol,baseSymbol:base,quoteSymbol:quote,venue:'MEXC',status:statusFromFlag(active,halted),sourceRef:`mexc:${symbol}`});
    return out?[out]:[];
  });
}

export function parseCoinbaseCatalog(payload){
  if(!Array.isArray(payload)) throw new Error('coinbase_catalog_products_missing');
  return payload.flatMap((row)=>{
    if(!row||typeof row!=='object') return [];
    const id=String(row.id??'').trim();
    const base=upper(row.base_currency??row.base); const quote=upper(row.quote_currency??row.quote);
    const status=lower(row.status??'online');
    const active=status==='online'&&row.trading_disabled!==true&&row.cancel_only!==true;
    const halted=row.trading_disabled===true||row.cancel_only===true||['offline','delisted','halted'].includes(status);
    const out=cleanInstrument({providerInstrumentId:id,baseSymbol:base,quoteSymbol:quote,venue:'COINBASE',status:statusFromFlag(active,halted),sourceRef:`coinbase:${id}`});
    return out?[out]:[];
  });
}

function krakenSymbol(value){
  const raw=upper(value).replace(/[^A-Z0-9.]/gu,'');
  const aliases={XXBT:'BTC',XBT:'BTC',XETH:'ETH',XXDG:'DOGE',XDG:'DOGE',ZUSD:'USD',ZEUR:'EUR',ZGBP:'GBP',USDT:'USDT',USDC:'USDC'};
  if(raw==='ZUSD')return 'USD'; if(raw==='ZEUR')return 'EUR'; if(raw==='ZGBP')return 'GBP';
  return aliases[raw]??raw.replace(/^X(?=[A-Z]{3,5}$)/u,'').replace(/^Z(?=[A-Z]{3}$)/u,'');
}

export function parseKrakenCatalog(payload){
  if(Array.isArray(payload?.error)&&payload.error.length>0) throw new Error('kraken_catalog_error');
  const result=payload?.result;
  if(!result||typeof result!=='object'||Array.isArray(result)) throw new Error('kraken_catalog_pairs_missing');
  return Object.entries(result).flatMap(([key,row])=>{
    if(!row||typeof row!=='object') return [];
    const pair=String(row.altname??key).trim();
    let base=krakenSymbol(row.base); let quote=krakenSymbol(row.quote);
    if(typeof row.wsname==='string'&&row.wsname.includes('/')){const parts=row.wsname.split('/');base=upper(parts[0]);quote=upper(parts[1]);}
    const status=lower(row.status??'online');
    const active=status==='online';
    const halted=['cancel_only','maintenance','post_only','reduce_only','offline'].includes(status);
    const out=cleanInstrument({providerInstrumentId:pair,baseSymbol:base,quoteSymbol:quote,venue:'KRAKEN',status:statusFromFlag(active,halted),sourceRef:`kraken:${key}`});
    return out?[out]:[];
  });
}

export const PASS35_A12_CATALOG_PARSERS=Object.freeze({binance:parseBinanceCatalog,mexc:parseMexcCatalog,coinbase:parseCoinbaseCatalog,kraken:parseKrakenCatalog});

function trimCatalog(rows,{quoteAllowlist=QUOTES,maxInstruments=20_000}={}){
  const seen=new Set(); const out=[];
  for(const row of rows){
    if(!quoteAllowlist.has(row.quoteSymbol)||seen.has(row.providerInstrumentId)) continue;
    seen.add(row.providerInstrumentId); out.push(row);
    if(out.length>=maxInstruments) break;
  }
  return out.sort((a,b)=>a.providerInstrumentId.localeCompare(b.providerInstrumentId));
}

async function boundedJson(response){
  const contentLength=Number(response.headers?.get?.('content-length')??0);
  if(Number.isFinite(contentLength)&&contentLength>MAX_RESPONSE_BYTES) throw new Error('provider_catalog_response_too_large');
  const text=await response.text();
  if(Buffer.byteLength(text)>MAX_RESPONSE_BYTES) throw new Error('provider_catalog_response_too_large');
  try{return {payload:JSON.parse(text),bytes:Buffer.byteLength(text),rawDigest:digest(text)};}catch{throw new Error('provider_catalog_json_invalid');}
}

function takeBudget(providerId,nowMs,limit=8,windowMs=60_000){
  const current=budgets.get(providerId);
  if(!current||current.resetAt<=nowMs){budgets.set(providerId,{remaining:Math.max(0,limit-1),resetAt:nowMs+windowMs});return {ok:true,remaining:Math.max(0,limit-1),resetAt:nowMs+windowMs};}
  if(current.remaining<=0)return {ok:false,remaining:0,resetAt:current.resetAt};
  current.remaining-=1; return {ok:true,remaining:current.remaining,resetAt:current.resetAt};
}

async function fetchOne({providerId,fetchImpl,now,executionMode,policy}){
  const endpoint=PASS35_A12_PROVIDER_ENDPOINTS[providerId];
  const parser=PASS35_A12_CATALOG_PARSERS[providerId];
  if(!endpoint||!parser) throw new Error(`provider_catalog_unknown:${providerId}`);
  const budget=takeBudget(providerId,now.getTime(),policy.quotaLimit,policy.quotaWindowMs);
  if(!budget.ok){
    const snapshot=buildProviderCatalogSnapshot({providerId,providerFamily:providerId,providerState:'DEGRADED',observedAt:now.toISOString(),rawPayloadDigest:digest(`${providerId}:rate_limited:${budget.resetAt}`),termsMode:'PUBLIC_FREE_UNVERIFIED',instruments:[]});
    return {snapshot,receipt:{providerId,endpointId:endpoint.endpointId,state:'RATE_LIMITED',attemptCount:0,latencyMs:0,httpStatus:null,responseBytes:0,rawPayloadDigest:snapshot.rawPayloadDigest,snapshotDigest:snapshot.snapshotDigest,instrumentCount:0,activeInstrumentCount:0,cacheState:'miss',quotaRemaining:0,quotaResetAt:new Date(budget.resetAt).toISOString(),errorCode:'provider_catalog_rate_limit',executionMode}};
  }
  const started=Date.now(); let lastError=null; let status=null;
  for(let attempt=1;attempt<=policy.maxAttempts;attempt+=1){
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),policy.timeoutMs);
    try{
      const response=await fetchImpl(endpoint.url,{headers:{accept:'application/json','user-agent':'Velmere-Public-Catalog/1.0'},cache:'no-store',signal:controller.signal});
      status=response.status;
      if(!response.ok) throw new Error(`provider_catalog_http_${response.status}`);
      const {payload,bytes,rawDigest}=await boundedJson(response);
      const instruments=trimCatalog(parser(payload),policy);
      if(instruments.length===0) throw new Error('provider_catalog_empty');
      const snapshot=buildProviderCatalogSnapshot({providerId,providerFamily:providerId,providerState:'LIVE',observedAt:now.toISOString(),rawPayloadDigest:rawDigest,termsMode:'PUBLIC_FREE_UNVERIFIED',instruments});
      return {snapshot,receipt:{providerId,endpointId:endpoint.endpointId,state:'OK',attemptCount:attempt,latencyMs:Date.now()-started,httpStatus:status,responseBytes:bytes,rawPayloadDigest:rawDigest,snapshotDigest:snapshot.snapshotDigest,instrumentCount:instruments.length,activeInstrumentCount:snapshot.activeInstrumentCount,cacheState:'miss',quotaRemaining:budget.remaining,quotaResetAt:new Date(budget.resetAt).toISOString(),errorCode:null,executionMode}};
    }catch(error){lastError=error; if(attempt<policy.maxAttempts) await sleep(Math.min(policy.retryMaxDelayMs,policy.retryBaseDelayMs*2**(attempt-1)));}
    finally{clearTimeout(timer);}
  }
  const errorCode=String(lastError instanceof Error?lastError.message:'provider_catalog_failed').toLowerCase().replace(/[^a-z0-9_:-]+/gu,'_').slice(0,120);
  const snapshot=buildProviderCatalogSnapshot({providerId,providerFamily:providerId,providerState:'DEGRADED',observedAt:now.toISOString(),rawPayloadDigest:digest({providerId,errorCode,observedAt:now.toISOString()}),termsMode:'PUBLIC_FREE_UNVERIFIED',instruments:[]});
  return {snapshot,receipt:{providerId,endpointId:endpoint.endpointId,state:errorCode.includes('schema')||errorCode.includes('missing')||errorCode.includes('empty')?'SCHEMA_REJECTED':'FAILED',attemptCount:policy.maxAttempts,latencyMs:Date.now()-started,httpStatus:status,responseBytes:0,rawPayloadDigest:snapshot.rawPayloadDigest,snapshotDigest:snapshot.snapshotDigest,instrumentCount:0,activeInstrumentCount:0,cacheState:'miss',quotaRemaining:budget.remaining,quotaResetAt:new Date(budget.resetAt).toISOString(),errorCode,executionMode}};
}

function unsignedRuntime(value){const {integrity,...rest}=value;return rest;}
export function verifyPublicProviderCatalogRuntime(value){
  try{
    if(value.schemaVersion!=='velmere.pass35.public-provider-catalog-runtime.v1'||!SHA.test(value.integrity?.digest)||digest(unsignedRuntime(value))!==value.integrity.digest)return false;
    if(!Array.isArray(value.snapshots)||!value.snapshots.every(verifyProviderCatalogSnapshot)||!verifyDynamicMarketDenominator(value.denominator))return false;
    if(value.providerCount!==value.snapshots.length||value.activeAssetCount!==value.denominator.activeAssetDenominator||value.activeListingCount!==value.denominator.activeListingDenominator)return false;
    if(value.sellEnabled!==false||value.paidDeliveryEligible!==false)return false;
    if(value.executionMode==='INJECTED_FIXTURE'&&value.liveClaimed!==false)return false;
    return true;
  }catch{return false;}
}

export async function fetchPublicProviderCatalogRuntime(args={}){
  const now=args.now??new Date();
  const providers=(args.providers??Object.keys(PASS35_A12_PROVIDER_ENDPOINTS)).map(lower).filter((id)=>PASS35_A12_PROVIDER_ENDPOINTS[id]);
  const executionMode=args.fetchImpl?'INJECTED_FIXTURE':'PUBLIC_NETWORK';
  const fetchImpl=args.fetchImpl??globalThis.fetch;
  if(typeof fetchImpl!=='function')throw new Error('provider_catalog_fetch_unavailable');
  const policy={cacheTtlMs:Math.max(1_000,args.policy?.cacheTtlMs??DEFAULT_CACHE_TTL_MS),timeoutMs:Math.max(100,args.policy?.timeoutMs??DEFAULT_TIMEOUT_MS),maxAttempts:Math.max(1,Math.min(5,args.policy?.maxAttempts??DEFAULT_ATTEMPTS)),retryBaseDelayMs:Math.max(0,args.policy?.retryBaseDelayMs??60),retryMaxDelayMs:Math.max(0,args.policy?.retryMaxDelayMs??500),quotaLimit:Math.max(1,args.policy?.quotaLimit??8),quotaWindowMs:Math.max(1_000,args.policy?.quotaWindowMs??60_000),maxInstruments:Math.max(1,args.policy?.maxInstruments??20_000),quoteAllowlist:new Set((args.policy?.quoteAllowlist??[...QUOTES]).map(upper))};
  const cacheKey=digest({providers,executionMode,quoteAllowlist:[...policy.quoteAllowlist].sort(),maxInstruments:policy.maxInstruments});
  const cached=cache.get(cacheKey);
  if(!args.bypassCache&&cached&&cached.expiresAt>now.getTime()){
    const value=structuredClone(cached.value);value.cacheState='hit';value.integrity={algorithm:'sha256',digest:digest(unsignedRuntime(value))};return value;
  }
  if(!args.bypassCache&&inflight.has(cacheKey)){
    const value=structuredClone(await inflight.get(cacheKey));value.cacheState='shared_inflight';value.integrity={algorithm:'sha256',digest:digest(unsignedRuntime(value))};return value;
  }
  const operation=(async()=>{
    const results=await Promise.all(providers.map((providerId)=>fetchOne({providerId,fetchImpl,now,executionMode,policy})));
    const snapshots=results.map((r)=>r.snapshot);
    const denominator=buildDynamicMarketDenominator({snapshots,evaluatedAt:now.toISOString(),maxSnapshotAgeSeconds:900});
    const failures=results.filter((r)=>r.receipt.state!=='OK').map((r)=>`${r.receipt.providerId}:${r.receipt.errorCode??r.receipt.state.toLowerCase()}`).sort();
    const unsigned={schemaVersion:'velmere.pass35.public-provider-catalog-runtime.v1',runtimeId:PASS35_A12_PROVIDER_CATALOG_RUNTIME_ID,generatedAt:now.toISOString(),executionMode,cacheState:'miss',providerCount:snapshots.length,successfulProviderCount:results.filter((r)=>r.receipt.state==='OK').length,activeListingCount:denominator.activeListingDenominator,activeAssetCount:denominator.activeAssetDenominator,snapshots,receipts:results.map((r)=>r.receipt),denominator,blockers:failures,liveClaimed:executionMode==='PUBLIC_NETWORK'&&failures.length===0,realPublicCatalogExecution:executionMode==='PUBLIC_NETWORK'&&failures.length===0,sellEnabled:false,paidDeliveryEligible:false,truthBoundary:'A successful public-network run proves a point-in-time provider catalog snapshot only. Injected fetches are fixture evidence. Neither mode guarantees uptime, rights, full field coverage, paid readiness or every global instrument.'};
    return {...unsigned,integrity:{algorithm:'sha256',digest:digest(unsigned)}};
  })();
  inflight.set(cacheKey,operation);
  try{const value=await operation;cache.set(cacheKey,{expiresAt:now.getTime()+policy.cacheTtlMs,value});while(cache.size>32)cache.delete(cache.keys().next().value);return value;}finally{inflight.delete(cacheKey);}
}

export function clearPublicProviderCatalogRuntimeForTests(){cache.clear();inflight.clear();budgets.clear();}
export const pass35A12CatalogInternals={digest,trimCatalog,krakenSymbol,takeBudget,cache,inflight,budgets};
