import { createHash } from 'node:crypto';

const SHA=/^sha256:[a-f0-9]{64}$/u;
const DEFAULT_TIMEOUT_MS=12_000;
const DEFAULT_CACHE_TTL_MS=300_000;
const MAX_RESPONSE_BYTES=4*1024*1024;
const stable=(value)=>JSON.stringify(sortDeep(value));
function sortDeep(value){if(Array.isArray(value))return value.map(sortDeep);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,sortDeep(value[key])]));return value;}
const digest=(value)=>`sha256:${createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex')}`;
const upper=(value)=>String(value??'').trim().toUpperCase();
const finite=(value)=>Number.isFinite(Number(value))?Number(value):null;
const cache=new Map();
const inflight=new Map();
const budgets=new Map();
const EXECUTION_MODES=new Set(['PUBLIC_NETWORK','LOCAL_HTTP_FIXTURE','INJECTED_FIXTURE']);

export const PASS35_A13_PUBLIC_FX_RUNTIME_ID='pass35-a13-public-fx-runtime-v1';
export const PASS35_A13_FX_ENDPOINTS=Object.freeze({
  ecb:{
    providerFamily:'ecb',
    endpointId:'ecb_exr_daily_csv',
    url:'https://data-api.ecb.europa.eu/service/data/EXR/D..EUR.SP00.A?format=csvdata',
  },
  bank_of_canada:{
    providerFamily:'bank_of_canada',
    endpointId:'boc_valet_fx_daily_json',
    url:'https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXEURCAD,FXGBPCAD,FXJPYCAD/json?recent=15',
  },
});

function parseCsv(text){
  const rows=[];let row=[];let field='';let quoted=false;
  for(let index=0;index<text.length;index+=1){
    const char=text[index];
    if(quoted){
      if(char==='"'&&text[index+1]==='"'){field+='"';index+=1;continue;}
      if(char==='"'){quoted=false;continue;}
      field+=char;continue;
    }
    if(char==='"'){quoted=true;continue;}
    if(char===','){row.push(field);field='';continue;}
    if(char==='\n'){row.push(field.replace(/\r$/u,''));rows.push(row);row=[];field='';continue;}
    field+=char;
  }
  if(field||row.length){row.push(field.replace(/\r$/u,''));rows.push(row);}
  return rows.filter((items)=>items.some((item)=>item!==''));
}

function normalizeObservation({providerId,providerFamily,pair,date,rate,sourceRef}){
  const match=/^([A-Z]{3})\/([A-Z]{3})$/u.exec(upper(pair));
  const numeric=finite(rate);
  if(!match||numeric===null||numeric<=0||!/^\d{4}-\d{2}-\d{2}$/u.test(String(date)))return null;
  return {providerId,providerFamily,pair:`${match[1]}/${match[2]}`,baseCurrency:match[1],quoteCurrency:match[2],date:String(date),rate:numeric,sourceRef:String(sourceRef)};
}

export function parseEcbFxCsv(text){
  const rows=parseCsv(String(text));
  if(rows.length<2)throw new Error('ecb_fx_csv_empty');
  const header=rows[0].map((value)=>upper(value));
  const column=(...names)=>names.map(upper).map((name)=>header.indexOf(name)).find((index)=>index>=0)??-1;
  const currencyIndex=column('CURRENCY');
  const denominatorIndex=column('CURRENCY_DENOM');
  const dateIndex=column('TIME_PERIOD','TIME PERIOD');
  const valueIndex=column('OBS_VALUE','OBS VALUE');
  if([currencyIndex,denominatorIndex,dateIndex,valueIndex].some((index)=>index<0))throw new Error('ecb_fx_csv_schema_missing');
  const observations=[];
  for(const row of rows.slice(1)){
    const currency=upper(row[currencyIndex]);const denominator=upper(row[denominatorIndex]);
    if(!currency||denominator!=='EUR')continue;
    const record=normalizeObservation({providerId:'ecb',providerFamily:'ecb',pair:`EUR/${currency}`,date:row[dateIndex],rate:row[valueIndex],sourceRef:`ecb:EXR:D.${currency}.EUR.SP00.A:${row[dateIndex]}`});
    if(record)observations.push(record);
  }
  if(!observations.length)throw new Error('ecb_fx_observations_missing');
  return observations.sort((a,b)=>a.pair.localeCompare(b.pair)||a.date.localeCompare(b.date));
}

export function parseBankOfCanadaFx(payload){
  const rows=payload?.observations;
  if(!Array.isArray(rows))throw new Error('boc_fx_observations_missing');
  const observations=[];
  for(const row of rows){
    const date=String(row?.d??'');
    const usdCad=finite(row?.FXUSDCAD?.v);
    const eurCad=finite(row?.FXEURCAD?.v);
    const gbpCad=finite(row?.FXGBPCAD?.v);
    const jpyCad=finite(row?.FXJPYCAD?.v);
    const derived=[
      ['EUR/USD',eurCad!==null&&usdCad!==null?eurCad/usdCad:null,'FXEURCAD/FXUSDCAD'],
      ['GBP/USD',gbpCad!==null&&usdCad!==null?gbpCad/usdCad:null,'FXGBPCAD/FXUSDCAD'],
      ['EUR/GBP',eurCad!==null&&gbpCad!==null?eurCad/gbpCad:null,'FXEURCAD/FXGBPCAD'],
      ['EUR/JPY',eurCad!==null&&jpyCad!==null?eurCad/jpyCad:null,'FXEURCAD/FXJPYCAD'],
    ];
    for(const [pair,rate,series] of derived){
      const record=normalizeObservation({providerId:'bank_of_canada',providerFamily:'bank_of_canada',pair,date,rate,sourceRef:`bank_of_canada:${series}:${date}`});
      if(record)observations.push(record);
    }
  }
  if(!observations.length)throw new Error('boc_fx_derived_observations_missing');
  return observations.sort((a,b)=>a.pair.localeCompare(b.pair)||a.date.localeCompare(b.date));
}

function takeBudget(providerId,nowMs,{limit=12,windowMs=60_000}={}){
  const current=budgets.get(providerId);
  if(!current||current.resetAt<=nowMs){const next={remaining:Math.max(0,limit-1),resetAt:nowMs+windowMs};budgets.set(providerId,next);return {ok:true,...next};}
  if(current.remaining<=0)return {ok:false,...current};
  current.remaining-=1;return {ok:true,...current};
}

async function boundedText(response){
  const contentLength=Number(response.headers?.get?.('content-length')??0);
  if(Number.isFinite(contentLength)&&contentLength>MAX_RESPONSE_BYTES)throw new Error('fx_response_too_large');
  const text=await response.text();
  if(Buffer.byteLength(text)>MAX_RESPONSE_BYTES)throw new Error('fx_response_too_large');
  return {text,bytes:Buffer.byteLength(text),rawDigest:digest(text)};
}

function summarizePair(pair,providerSeries,evaluatedAt,maxAgeHours){
  const providerRows=[];
  for(const [providerFamily,observations] of providerSeries){
    const rows=observations.filter((row)=>row.pair===pair).sort((a,b)=>a.date.localeCompare(b.date));
    if(!rows.length)continue;
    const latest=rows.at(-1);const previous=rows.at(-2)??null;
    const ageHours=Math.max(0,(evaluatedAt.getTime()-new Date(`${latest.date}T16:00:00Z`).getTime())/3_600_000);
    providerRows.push({providerFamily,latestRate:latest.rate,latestDate:latest.date,previousRate:previous?.rate??null,change1dPercent:previous?((latest.rate/previous.rate)-1)*100:null,historyPointCount:rows.length,fresh:ageHours<=maxAgeHours,ageHours:Number(ageHours.toFixed(2)),sourceRefs:rows.slice(-10).map((row)=>row.sourceRef)});
  }
  const fresh=providerRows.filter((row)=>row.fresh);
  const rates=fresh.map((row)=>row.latestRate);
  const median=rates.length?[...rates].sort((a,b)=>a-b)[Math.floor((rates.length-1)/2)]:null;
  const divergenceBps=rates.length>=2&&median?Math.max(...rates.map((rate)=>Math.abs(rate-median)/median*10_000)):null;
  const latestDate=fresh.map((row)=>row.latestDate).sort().at(-1)??null;
  const basicEligible=fresh.length>=1;
  const proEligible=fresh.length>=2&&providerRows.every((row)=>row.historyPointCount>=2)&&(divergenceBps??Infinity)<=75;
  const advancedEligible=fresh.length>=3&&providerRows.every((row)=>row.historyPointCount>=5)&&(divergenceBps??Infinity)<=40;
  return {canonicalAssetId:`fx:${pair.replace('/','')}`,assetClass:'fx',pair,baseCurrency:pair.slice(0,3),quoteCurrency:pair.slice(4),latestDate,consensusRate:median===null?null:Number(median.toFixed(8)),providerFamilyCount:fresh.length,providerRows,divergenceBps:divergenceBps===null?null:Number(divergenceBps.toFixed(2)),tiers:{basic:{state:basicEligible?'ELIGIBLE':'UNAVAILABLE',requiredProviderFamilies:1},pro:{state:proEligible?'ELIGIBLE':fresh.length<2?'UNAVAILABLE':'CONFLICTED',requiredProviderFamilies:2},advanced:{state:advancedEligible?'ELIGIBLE':'UNAVAILABLE',requiredProviderFamilies:3}},sellEnabled:false};
}

function unsigned(value){const {integrity,...rest}=value;return rest;}
export function verifyPass35A13PublicFxRuntime(value){
  try{
    if(value.schemaVersion!=='velmere.pass35.public-fx-runtime.v1'||!SHA.test(value.integrity?.digest)||digest(unsigned(value))!==value.integrity.digest)return false;
    if(!Array.isArray(value.pairs)||!Array.isArray(value.receipts)||!Array.isArray(value.observations))return false;
    if(value.pairCount!==value.pairs.length||value.sellEnabled!==false||value.paidDeliveryEligible!==false)return false;
    if(!EXECUTION_MODES.has(value.executionMode)||value.executionMode!=='PUBLIC_NETWORK'&&value.liveClaimed!==false)return false;
    if(value.pairs.some((pair)=>pair.sellEnabled!==false||!pair.tiers?.basic||!pair.tiers?.pro||!pair.tiers?.advanced))return false;
    return true;
  }catch{return false;}
}

export async function runPass35A13PublicFxRuntime(args={}){
  const now=args.now??new Date();
  const providers=args.providers??['ecb','bank_of_canada'];
  const endpointOverrides=args.endpointOverrides??{};
  const executionMode=args.executionMode??(args.fetchImpl?'INJECTED_FIXTURE':'PUBLIC_NETWORK');
  if(!EXECUTION_MODES.has(executionMode))throw new Error('fx_execution_mode_invalid');
  const fetchImpl=args.fetchImpl??globalThis.fetch;
  if(typeof fetchImpl!=='function')throw new Error('fx_fetch_unavailable');
  const policy={timeoutMs:Math.max(100,args.policy?.timeoutMs??DEFAULT_TIMEOUT_MS),cacheTtlMs:Math.max(1000,args.policy?.cacheTtlMs??DEFAULT_CACHE_TTL_MS),quotaLimit:Math.max(1,args.policy?.quotaLimit??12),quotaWindowMs:Math.max(1000,args.policy?.quotaWindowMs??60_000),maxAgeHours:Math.max(24,args.policy?.maxAgeHours??120)};
  const key=digest({providers,executionMode,endpointOverrides,maxAgeHours:policy.maxAgeHours});
  const cached=cache.get(key);
  if(!args.bypassCache&&cached&&cached.expiresAt>now.getTime()){const value=structuredClone(cached.value);value.cacheState='hit';value.integrity={algorithm:'sha256',digest:digest(unsigned(value))};return value;}
  if(!args.bypassCache&&inflight.has(key)){const value=structuredClone(await inflight.get(key));value.cacheState='shared_inflight';value.integrity={algorithm:'sha256',digest:digest(unsigned(value))};return value;}
  const operation=(async()=>{
    const observations=[];const receipts=[];
    for(const providerId of providers){
      const endpoint=PASS35_A13_FX_ENDPOINTS[providerId];if(!endpoint)continue;
      const budget=takeBudget(providerId,now.getTime(),{limit:policy.quotaLimit,windowMs:policy.quotaWindowMs});
      if(!budget.ok){receipts.push({providerId,state:'RATE_LIMITED',observationCount:0,errorCode:'fx_rate_limited',rawDigest:digest(`${providerId}:${budget.resetAt}`),endpointId:endpoint.endpointId,executionMode});continue;}
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),policy.timeoutMs);
      try{
        const response=await fetchImpl(endpointOverrides[providerId]??endpoint.url,{headers:{accept:providerId==='ecb'?'text/csv,application/vnd.sdmx.data+csv':'application/json','user-agent':'Velmere-Public-FX/1.0'},signal:controller.signal,cache:'no-store'});
        if(!response.ok)throw new Error(`fx_http_${response.status}`);
        const {text,bytes,rawDigest}=await boundedText(response);
        const parsed=providerId==='ecb'?parseEcbFxCsv(text):parseBankOfCanadaFx(JSON.parse(text));
        observations.push(...parsed);
        receipts.push({providerId,providerFamily:endpoint.providerFamily,state:'OK',observationCount:parsed.length,responseBytes:bytes,rawDigest,endpointId:endpoint.endpointId,executionMode,errorCode:null,quotaRemaining:budget.remaining});
      }catch(error){receipts.push({providerId,providerFamily:endpoint.providerFamily,state:'FAILED',observationCount:0,responseBytes:0,rawDigest:digest({providerId,error:String(error)}),endpointId:endpoint.endpointId,executionMode,errorCode:String(error instanceof Error?error.message:error).slice(0,120),quotaRemaining:budget.remaining});}
      finally{clearTimeout(timer);}
    }
    const providerSeries=new Map();
    for(const observation of observations){const rows=providerSeries.get(observation.providerFamily)??[];rows.push(observation);providerSeries.set(observation.providerFamily,rows);}
    const pairs=[...new Set(observations.map((row)=>row.pair))].sort().map((pair)=>summarizePair(pair,providerSeries,now,policy.maxAgeHours));
    const blockers=receipts.filter((receipt)=>receipt.state!=='OK').map((receipt)=>`${receipt.providerId}:${receipt.errorCode}`).sort();
    const unsignedValue={schemaVersion:'velmere.pass35.public-fx-runtime.v1',runtimeId:PASS35_A13_PUBLIC_FX_RUNTIME_ID,generatedAt:now.toISOString(),executionMode,cacheState:'miss',providerCount:receipts.length,successfulProviderCount:receipts.filter((receipt)=>receipt.state==='OK').length,observationCount:observations.length,pairCount:pairs.length,eligibleBasicPairs:pairs.filter((pair)=>pair.tiers.basic.state==='ELIGIBLE').length,eligibleProPairs:pairs.filter((pair)=>pair.tiers.pro.state==='ELIGIBLE').length,eligibleAdvancedPairs:pairs.filter((pair)=>pair.tiers.advanced.state==='ELIGIBLE').length,observations,receipts,pairs,blockers,liveClaimed:executionMode==='PUBLIC_NETWORK'&&blockers.length===0,realPublicNetworkExecution:executionMode==='PUBLIC_NETWORK'&&blockers.length===0,sellEnabled:false,paidDeliveryEligible:false,truthBoundary:'This runtime proves point-in-time public FX ingestion and tier eligibility. Local/injected execution is not public-network LIVE. One or two central-bank sources do not satisfy Advanced three-family quorum, trading-price SLA, customer outcome or paid readiness.'};
    return {...unsignedValue,integrity:{algorithm:'sha256',digest:digest(unsignedValue)}};
  })();
  inflight.set(key,operation);
  try{const value=await operation;if(!verifyPass35A13PublicFxRuntime(value))throw new Error('fx_runtime_integrity_invalid');cache.set(key,{expiresAt:now.getTime()+policy.cacheTtlMs,value});return value;}finally{inflight.delete(key);}
}

export function clearPass35A13PublicFxRuntimeForTests(){cache.clear();inflight.clear();budgets.clear();}
export const pass35A13FxInternals={digest,parseCsv,takeBudget,cache,inflight,budgets};
