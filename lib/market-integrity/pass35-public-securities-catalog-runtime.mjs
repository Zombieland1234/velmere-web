import { createHash } from 'node:crypto';

const SHA=/^sha256:[a-f0-9]{64}$/u;
const MODES=new Set(['PUBLIC_NETWORK','LOCAL_HTTP_FIXTURE','INJECTED_FIXTURE']);
const MAX_RESPONSE_BYTES=8*1024*1024;
const stable=(value)=>JSON.stringify(sortDeep(value));
function sortDeep(value){if(Array.isArray(value))return value.map(sortDeep);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,sortDeep(value[key])]));return value;}
const digest=(value)=>`sha256:${createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex')}`;
const upper=(value)=>String(value??'').trim().toUpperCase();
const uniq=(items)=>[...new Set(items)].sort();
const cache=new Map();
const inflight=new Map();

export const PASS35_A14_SECURITIES_ENDPOINTS=Object.freeze({
  nasdaq_listed:{providerFamily:'nasdaq_trader',endpointId:'nasdaq_listed_symbols',url:'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt'},
  other_listed:{providerFamily:'nasdaq_trader',endpointId:'other_exchange_symbols',url:'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt'},
  sec_tickers:{providerFamily:'sec_edgar',endpointId:'sec_company_tickers_exchange',url:'https://www.sec.gov/files/company_tickers_exchange.json'},
});

function parsePipe(text){const lines=String(text).replace(/\r/gu,'').split('\n').filter(Boolean);if(lines.length<2)throw new Error('symbol_directory_empty');const header=lines[0].split('|').map(upper);return lines.slice(1).filter((line)=>!line.startsWith('File Creation Time')).map((line)=>{const cells=line.split('|');return Object.fromEntries(header.map((name,index)=>[name,cells[index]??'']));});}
function safeTicker(value){const ticker=upper(value).replace(/\s+/gu,'');return /^[A-Z0-9.^-]{1,20}$/u.test(ticker)?ticker:null;}
function normalizeRow({ticker,name,exchange,etf,providerFamily,sourceRef,cik=null,status='ACTIVE'}){const symbol=safeTicker(ticker);if(!symbol||!String(name??'').trim())return null;const assetClass=etf===true?'etf':'equity';return {canonicalAssetId:`${assetClass}:US:${symbol}`,assetClass,symbol,name:String(name).trim(),exchange:upper(exchange)||'UNKNOWN',cik:cik===null?null:String(cik).padStart(10,'0'),status,providerFamily,sourceRef};}

export function parseNasdaqListedSymbols(text){return parsePipe(text).map((row)=>normalizeRow({ticker:row.SYMBOL,name:row['SECURITY NAME'],exchange:'NASDAQ',etf:upper(row.ETF)==='Y',providerFamily:'nasdaq_trader',sourceRef:`nasdaq_listed:${row.SYMBOL}`,status:upper(row['TEST ISSUE'])==='Y'?'TEST':upper(row['FINANCIAL STATUS'])==='D'?'DEFICIENT':'ACTIVE'})).filter(Boolean);}
export function parseOtherListedSymbols(text){return parsePipe(text).map((row)=>normalizeRow({ticker:row['ACT SYMBOL'],name:row['SECURITY NAME'],exchange:row.EXCHANGE,etf:upper(row.ETF)==='Y',providerFamily:'nasdaq_trader',sourceRef:`other_listed:${row['ACT SYMBOL']}`,status:upper(row['TEST ISSUE'])==='Y'?'TEST':'ACTIVE'})).filter(Boolean);}
export function parseSecCompanyTickersExchange(payload){
  if(Array.isArray(payload?.fields)&&Array.isArray(payload?.data)){
    const index=Object.fromEntries(payload.fields.map((field,i)=>[String(field).toLowerCase(),i]));
    return payload.data.map((row)=>normalizeRow({ticker:row[index.ticker],name:row[index.name],exchange:row[index.exchange],etf:false,providerFamily:'sec_edgar',sourceRef:`sec:${row[index.cik]}`,cik:row[index.cik]})).filter(Boolean);
  }
  if(payload&&typeof payload==='object'){const values=Object.values(payload);if(!values.length||values.some((row)=>!row||typeof row!=='object'||!row.ticker||!row.title))throw new Error('sec_ticker_schema_invalid');const parsed=values.map((row)=>normalizeRow({ticker:row.ticker,name:row.title,exchange:'UNKNOWN',etf:false,providerFamily:'sec_edgar',sourceRef:`sec:${row.cik_str}`,cik:row.cik_str})).filter(Boolean);if(!parsed.length)throw new Error('sec_ticker_schema_invalid');return parsed;}
  throw new Error('sec_ticker_schema_invalid');
}

async function bounded(response){const length=Number(response.headers?.get?.('content-length')??0);if(Number.isFinite(length)&&length>MAX_RESPONSE_BYTES)throw new Error('securities_response_too_large');const text=await response.text();if(Buffer.byteLength(text)>MAX_RESPONSE_BYTES)throw new Error('securities_response_too_large');return {text,rawDigest:digest(text),bytes:Buffer.byteLength(text)};}
function unsigned(value){const {integrity,...rest}=value;return rest;}
export function verifyPass35A14PublicSecuritiesCatalog(value){try{if(value.schemaVersion!=='velmere.pass35.public-securities-catalog.v1'||!SHA.test(value.integrity?.digest)||digest(unsigned(value))!==value.integrity.digest)return false;if(!MODES.has(value.executionMode)||!Array.isArray(value.instruments)||value.instrumentCount!==value.instruments.length)return false;if(value.sellEnabled!==false||value.paidDeliveryEligible!==false||value.liveClaimed!==false||value.quoteCoverageBps!==0)return false;if(new Set(value.instruments.map((row)=>row.canonicalAssetId)).size!==value.instruments.length)return false;return true;}catch{return false;}}

export async function runPass35A14PublicSecuritiesCatalog(args={}){
  const now=args.now??new Date();const executionMode=args.executionMode??(args.fetchImpl?'INJECTED_FIXTURE':'PUBLIC_NETWORK');if(!MODES.has(executionMode))throw new Error('securities_execution_mode_invalid');const fetchImpl=args.fetchImpl??globalThis.fetch;if(typeof fetchImpl!=='function')throw new Error('securities_fetch_unavailable');
  const endpoints={...PASS35_A14_SECURITIES_ENDPOINTS,...(args.endpointOverrides??{})};const key=digest({executionMode,endpoints});const ttl=Math.max(1000,args.cacheTtlMs??300_000);const cached=cache.get(key);if(!args.bypassCache&&cached&&cached.expiresAt>now.getTime()){const value=structuredClone(cached.value);value.cacheState='hit';value.integrity={algorithm:'sha256',digest:digest(unsigned(value))};return value;}if(!args.bypassCache&&inflight.has(key))return structuredClone(await inflight.get(key));
  const promise=(async()=>{
    const receipts=[];const rows=[];
    for(const id of ['nasdaq_listed','other_listed','sec_tickers']){
      const endpoint=endpoints[id];try{const response=await fetchImpl(endpoint.url,{headers:{accept:id==='sec_tickers'?'application/json':'text/plain','user-agent':'Velmere-Market-Research/1.0 contact@example.invalid'}});if(!response.ok)throw new Error(`http_${response.status}`);const body=await bounded(response);const parsed=id==='nasdaq_listed'?parseNasdaqListedSymbols(body.text):id==='other_listed'?parseOtherListedSymbols(body.text):parseSecCompanyTickersExchange(JSON.parse(body.text));if(!parsed.length)throw new Error('securities_provider_records_missing');rows.push(...parsed);receipts.push({endpointId:endpoint.endpointId,providerFamily:endpoint.providerFamily,state:'AVAILABLE',recordCount:parsed.length,rawDigest:body.rawDigest,bytes:body.bytes,observedAt:now.toISOString()});}catch(error){receipts.push({endpointId:endpoint.endpointId,providerFamily:endpoint.providerFamily,state:'UNAVAILABLE',recordCount:0,rawDigest:null,bytes:0,observedAt:now.toISOString(),errorCode:String(error?.message??error)});}
    }
    const grouped=new Map();for(const row of rows.filter((item)=>item.status==='ACTIVE')){const key=`${row.symbol}`;const list=grouped.get(key)??[];list.push(row);grouped.set(key,list);}
    const instruments=[...grouped.entries()].map(([symbol,list])=>{const etf=list.some((row)=>row.assetClass==='etf');const preferred=list.find((row)=>row.providerFamily==='nasdaq_trader')??list[0];const assetClass=etf?'etf':'equity';return {canonicalAssetId:`${assetClass}:US:${symbol}`,assetClass,symbol,name:preferred.name,exchanges:uniq(list.map((row)=>row.exchange).filter((x)=>x!=='UNKNOWN')),cik:list.find((row)=>row.cik)?.cik??null,providerFamilies:uniq(list.map((row)=>row.providerFamily)),sourceRefs:uniq(list.map((row)=>row.sourceRef)),identityState:list.length>=2?'RECONCILED':'SINGLE_SOURCE',quoteState:'UNAVAILABLE_NOT_IN_CATALOG_FEED',sellEnabled:false};}).sort((a,b)=>a.canonicalAssetId.localeCompare(b.canonicalAssetId));
    const unsignedValue={schemaVersion:'velmere.pass35.public-securities-catalog.v1',runtimeId:'pass35-a14-public-securities-catalog-v1',generatedAt:now.toISOString(),executionMode,receipts,successfulProviderFamilies:uniq(receipts.filter((row)=>row.state==='AVAILABLE').map((row)=>row.providerFamily)),instrumentCount:instruments.length,equityCount:instruments.filter((row)=>row.assetClass==='equity').length,etfCount:instruments.filter((row)=>row.assetClass==='etf').length,reconciledIdentityCount:instruments.filter((row)=>row.identityState==='RECONCILED').length,quoteCoverageBps:0,instruments,cacheState:'miss',catalogCoverageRule:'Every active ticker from the returned Nasdaq symbol directories and SEC ticker association file is normalized. Catalog identity does not imply a quote, corporate action, rights or paid-delivery entitlement.',sellEnabled:false,paidDeliveryEligible:false,liveClaimed:false,truthBoundary:'A14 proves parsing, reconciliation and complete catalog accounting over official-format local HTTP fixtures. It does not claim current public-network retrieval, quote coverage, provider rights, staging or customer value.'};const value={...unsignedValue,integrity:{algorithm:'sha256',digest:digest(unsignedValue)}};if(!verifyPass35A14PublicSecuritiesCatalog(value))throw new Error('securities_catalog_integrity_invalid');cache.set(key,{expiresAt:now.getTime()+ttl,value});return value;
  })();inflight.set(key,promise);try{return structuredClone(await promise);}finally{inflight.delete(key);}
}

export function clearPass35A14PublicSecuritiesCatalogForTests(){cache.clear();inflight.clear();}
export const pass35A14PublicSecuritiesInternals={digest,parsePipe};
