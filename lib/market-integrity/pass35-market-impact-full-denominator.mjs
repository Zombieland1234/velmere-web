import { createHash } from 'node:crypto';
import { verifyDynamicMarketDenominator } from './pass35-market-runtime-coverage.mjs';
import { verifyPass35A14ExecutionLedger } from './pass35-full-catalog-execution-ledger.mjs';
import { verifyMarketImpactTierPacket } from './market-impact-whale-tier-runtime.ts';

const SHA=/^sha256:[a-f0-9]{64}$/u;
const stable=(value)=>JSON.stringify(sortDeep(value));
function sortDeep(value){if(Array.isArray(value))return value.map(sortDeep);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,sortDeep(value[key])]));return value;}
const digest=(value)=>`sha256:${createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex')}`;

export const PASS35_A14_MARKET_IMPACT_DENOMINATOR_ID='pass35-a14-market-impact-full-denominator-v1';
function unsigned(value){const {integrity,...rest}=value;return rest;}
export function verifyPass35A14MarketImpactDenominator(value){try{if(value.schemaVersion!=='velmere.pass35.market-impact-full-denominator.v1'||!SHA.test(value.integrity?.digest)||digest(unsigned(value))!==value.integrity.digest)return false;if(!Array.isArray(value.rows)||value.assetDenominator!==value.rows.length||value.sellEnabled!==false||value.paidDeliveryEligible!==false||value.liveClaimed!==false)return false;if(value.rows.some((row)=>!row.tiers?.basic||!row.tiers?.pro||!row.tiers?.advanced||row.sellEnabled!==false))return false;return true;}catch{return false;}}

export function buildPass35A14MarketImpactDenominator(args){
  const denominator=args?.marketDenominator;if(!verifyDynamicMarketDenominator(denominator))throw new Error('market_impact_denominator_invalid');
  const ledger=args?.executionLedger;if(!verifyPass35A14ExecutionLedger(ledger))throw new Error('market_impact_execution_ledger_invalid');
  if(ledger.denominatorDigest!==denominator.denominatorDigest)throw new Error('market_impact_denominator_digest_mismatch');
  const packets=args.tierPackets??[];const packetMap=new Map();
  for(const packet of packets){if(!verifyMarketImpactTierPacket(packet))throw new Error('market_impact_tier_packet_invalid');const key=`${String(packet.assetKey).toUpperCase()}:${packet.tier}`;if(packetMap.has(key))throw new Error('market_impact_tier_packet_duplicate');packetMap.set(key,packet);}
  const rows=denominator.assets.filter((asset)=>asset.assetClass==='crypto').sort((a,b)=>a.canonicalAssetId.localeCompare(b.canonicalAssetId)).map((asset)=>{
    const ledgerAsset=ledger.assets.find((row)=>row.canonicalAssetId===asset.canonicalAssetId);const availableFamilies=ledgerAsset?.orderBook?.availableProviderFamilies??[];
    const basic=packetMap.get(`${asset.symbol.toUpperCase()}:basic`)??null;const pro=packetMap.get(`${asset.symbol.toUpperCase()}:pro`)??null;const advanced=packetMap.get(`${asset.symbol.toUpperCase()}:advanced`)??null;
    const basicFunctional=availableFamilies.length>=1&&Boolean(basic);
    const proFunctional=availableFamilies.length>=2&&Boolean(pro);
    const advancedFunctional=availableFamilies.length>=3&&Boolean(advanced)&&Array.isArray(advanced.scenarios)&&advanced.scenarios.length>=5&&advanced.advancedStress!==null;
    const basicEligible=basicFunctional&&basic.analysisEligible===true;
    const proEligible=proFunctional&&pro.analysisEligible===true;
    const advancedEligible=advancedFunctional&&advanced.analysisEligible===true;
    const blockers=[];if(availableFamilies.length===0)blockers.push('fresh_order_book_missing');if(!basic)blockers.push('basic_packet_missing');if(availableFamilies.length<2)blockers.push('pro_provider_family_floor_not_met');if(!pro)blockers.push('pro_packet_missing');if(availableFamilies.length<3)blockers.push('advanced_provider_family_floor_not_met');if(!advanced)blockers.push('advanced_packet_missing');
    return {canonicalAssetId:asset.canonicalAssetId,symbol:asset.symbol,availableOrderBookProviderFamilies:availableFamilies,orderBookState:ledgerAsset?.orderBook?.state??'UNAVAILABLE',packetDigests:{basic:basic?.packetDigest??null,pro:pro?.packetDigest??null,advanced:advanced?.packetDigest??null},tiers:{basic:{state:basicEligible?'ELIGIBLE':basicFunctional?'FUNCTIONAL_READY_OFFLINE':'UNAVAILABLE'},pro:{state:proEligible?'ELIGIBLE':proFunctional?'FUNCTIONAL_READY_OFFLINE':'UNAVAILABLE'},advanced:{state:advancedEligible?'ELIGIBLE':advancedFunctional?'FUNCTIONAL_READY_OFFLINE':'UNAVAILABLE'}},blockers:[...new Set(blockers)].sort(),sellEnabled:false};
  });
  const unsignedValue={schemaVersion:'velmere.pass35.market-impact-full-denominator.v1',runtimeId:PASS35_A14_MARKET_IMPACT_DENOMINATOR_ID,evaluatedAt:new Date(args.evaluatedAt??ledger.evaluatedAt).toISOString(),marketDenominatorDigest:denominator.denominatorDigest,executionLedgerDigest:ledger.integrity.digest,assetDenominator:rows.length,basicEligibleCount:rows.filter((row)=>row.tiers.basic.state==='ELIGIBLE').length,proEligibleCount:rows.filter((row)=>row.tiers.pro.state==='ELIGIBLE').length,advancedEligibleCount:rows.filter((row)=>row.tiers.advanced.state==='ELIGIBLE').length,basicFunctionalReadyCount:rows.filter((row)=>row.tiers.basic.state==='FUNCTIONAL_READY_OFFLINE'||row.tiers.basic.state==='ELIGIBLE').length,proFunctionalReadyCount:rows.filter((row)=>row.tiers.pro.state==='FUNCTIONAL_READY_OFFLINE'||row.tiers.pro.state==='ELIGIBLE').length,advancedFunctionalReadyCount:rows.filter((row)=>row.tiers.advanced.state==='FUNCTIONAL_READY_OFFLINE'||row.tiers.advanced.state==='ELIGIBLE').length,explicitUnavailableCount:rows.filter((row)=>row.tiers.basic.state==='UNAVAILABLE').length,tierPacketCount:packets.length,rows,productionRule:'Every active crypto asset remains in the Market Impact denominator. Tier functional readiness requires fresh order-book execution-ledger evidence and a valid tier packet; ELIGIBLE additionally requires non-fixture analyzer eligibility; missing assets or providers remain explicit UNAVAILABLE.',sellEnabled:false,paidDeliveryEligible:false,liveClaimed:false,truthBoundary:'A14 proves full-denominator Market Impact accounting and tier projection over fixture order books. It does not prove current public-network books, realized slippage, provider rights, staging, customers or paid readiness.'};
  const value={...unsignedValue,integrity:{algorithm:'sha256',digest:digest(unsignedValue)}};if(!verifyPass35A14MarketImpactDenominator(value))throw new Error('market_impact_full_denominator_integrity_invalid');return value;
}
export const pass35A14MarketImpactDenominatorInternals={digest};
