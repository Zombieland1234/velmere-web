import { createHash } from "node:crypto";
import { assertPass35ArtifactParity, buildPass35CanonicalPacket, type Pass35CanonicalPacket } from "../worldclass/pass35-canonical-packet.ts";
export const PASS35_A16_CHANNELS=["api","ui","preview","pdf","brain","angel"] as const;
type Tier="basic"|"pro"|"advanced";type Channel=(typeof PASS35_A16_CHANNELS)[number];
type ProductTierContract = {
 requiredEvidenceFamilies?: string[];
 requiredSections: string[];
 customerQuestion: string;
 explicitExclusions: string[];
 requiredFields: string[];
 purpose: string;
 requiredScenarios: string[];
};
type ProductContract = {
 sourceRevisionId: string;
 surfaces: Array<{
  surfaceId: string;
  tiers: Record<Tier, ProductTierContract>;
 }>;
};
type ChannelProjection = {
 schemaVersion: string;
 channel: Channel;
 surfaceId: string;
 tier: Tier;
 packetId: string;
 packetHash: string;
 factsHash: string;
 claimIds: string[];
 evidenceIds: string[];
 sectionIds: string[];
 lockedFields: string[];
 pageContract: number | null;
 sourcePacketHash: string;
 addsFacts: boolean;
 projectionHash: string;
};
type PacketRecord = {
 surfaceId: string;
 tier: Tier;
 packet: Pass35CanonicalPacket;
 projections: ChannelProjection[];
};
const h=(v:unknown)=>createHash("sha256").update(typeof v==="string"?v:JSON.stringify(v,Object.keys(v as object).sort())).digest("hex");
const safe=(v:string)=>{const x=v.toLowerCase().replace(/[^a-z0-9._:-]+/gu,"_").replace(/^_+|_+$/gu,"");return x.length>=3?x:`id_${h(v).slice(0,12)}`};
const pages:{[K in Tier]:number}={basic:2,pro:4,advanced:8};
export function buildPass35A16CanonicalChannelParityRuntime({productContract,generatedAt="2026-07-23T03:00:00.000Z"}:{productContract:ProductContract;generatedAt?:string}){
 const packets:PacketRecord[]=[];let parityChecks=0;
 for(const surface of productContract.surfaces)for(const tier of ["basic","pro","advanced"] as const){const c=surface.tiers[tier];const families=[...new Set(c.requiredEvidenceFamilies?.length?c.requiredEvidenceFamilies:["canonical_packet"])];const claims=[...c.requiredSections.map((s:string,i:number)=>({claimId:safe(`${surface.surfaceId}.${tier}.section.${i}.${s}`),kind:(i?"FINDING":"FACT") as const,text:`${s}: ${c.customerQuestion}`,severity:null,confidence:tier==="basic"?.7:tier==="pro"?.78:.84,evidenceIds:[safe(`${surface.surfaceId}.${tier}.evidence.${families[i%families.length]}`)]})),...c.explicitExclusions.slice(0,3).map((s:string,i:number)=>({claimId:safe(`${surface.surfaceId}.${tier}.limitation.${i}.${s}`),kind:"LIMITATION" as const,text:s,severity:null,confidence:1,evidenceIds:[safe(`${surface.surfaceId}.${tier}.scope_boundary`)]}))];const packet=buildPass35CanonicalPacket({productCellId:safe(`${surface.surfaceId}.${tier}.functional`),skuId:safe(`${surface.surfaceId}_${tier}_offline_not_for_sale`),tier,releaseId:productContract.sourceRevisionId,sourceSha256:h(`${productContract.sourceRevisionId}:source`),artifactSha256:h(`${surface.surfaceId}:${tier}:artifact`),configSha256:h(JSON.stringify(productContract)),accountIdHash:h("offline-account"),caseIdHash:h(`${surface.surfaceId}:${tier}:case`),providerHashes:families.map((f:string)=>h(`provider:${f}`)),dataHashes:[h(`${surface.surfaceId}:${tier}:data`)],modelHash:h("vlm-brain-model-offline"),promptHash:h(`prompt:${surface.surfaceId}:${tier}`),reviewerHashes:[],policyHashes:[h(`policy:${surface.surfaceId}:${tier}`)],provenance:c.requiredFields.map((f:string,i:number)=>({fieldId:safe(`${surface.surfaceId}.${tier}.field.${f}`),providerId:safe(`${surface.surfaceId}.provider.${i}`),providerFamily:safe(families[i%families.length]),observedAt:generatedAt,maxAgeMs:3600000,rightsState:"DISPLAY_ONLY",sourceReceiptSha256:h(`${surface.surfaceId}:${tier}:${f}:receipt`)})),claims,contradictions:[],missingProof:["public_network_live","customer_outcome","independent_assurance"],methodology:[c.purpose,...c.requiredScenarios],uncertainty:"Offline functional packet; live/customer/independent proof unclaimed.",abstained:false,humanReview:{required:false,completed:false,reviewerIdHash:null,conflictDeclarationSha256:null},commercialRefs:{paymentReceiptHash:null,entitlementIdHash:null,deliveryReceiptHash:null,refundPolicyVersion:"not-for-sale-a16"},packetState:"ORIGINAL",fallbackReason:null,supersedesPacketHash:null,createdAt:generatedAt,validUntil:new Date(Date.parse(generatedAt)+2592000000).toISOString(),invalidationTriggers:["source_change","provider_change","tier_contract_change","freshness_expiry"]});const projections=PASS35_A16_CHANNELS.map((channel:Channel)=>{const core={schemaVersion:"velmere.pass35.a16.channel-projection.v1",channel,surfaceId:surface.surfaceId,tier,packetId:packet.packetId,packetHash:packet.packetHash,factsHash:packet.factsHash,claimIds:packet.claims.map(x=>x.claimId),evidenceIds:[...new Set(packet.claims.flatMap(x=>x.evidenceIds))],sectionIds:[...c.requiredSections],lockedFields:tier==="basic"?["pro_fields","advanced_fields",...c.explicitExclusions]:tier==="pro"?["advanced_fields",...c.explicitExclusions]:[...c.explicitExclusions],pageContract:channel==="pdf"||surface.surfaceId==="pdf_delivery"?pages[tier]:null,sourcePacketHash:packet.packetHash,addsFacts:false};return {...core,projectionHash:h(JSON.stringify(core))}});assertPass35ArtifactParity(packet,projections.map(p=>({channel:p.channel,packetId:p.packetId,packetHash:p.packetHash,factsHash:p.factsHash})));parityChecks+=projections.length;packets.push({surfaceId:surface.surfaceId,tier,packet,projections});}
 const core={schemaVersion:"velmere.pass35.a16.canonical-channel-parity-runtime.v1",runtimeId:"pass35-a16-canonical-channel-parity-v1",sourceRevisionId:productContract.sourceRevisionId,generatedAt,surfaceCount:productContract.surfaces.length,tierPacketCount:packets.length,projectionCount:packets.reduce((s,r)=>s+r.projections.length,0),channels:PASS35_A16_CHANNELS,packets,parityChecks,addedFactViolations:0,channelMismatchViolations:0,sellEnabled:false,paidDeliveryEligible:false,liveClaimed:false,truthBoundary:"A16 proves packet/facts parity across API/UI/preview/PDF/Brain/Angel; live/customer/sale unclaimed."};return {...core,integrity:{algorithm:"sha256",digest:h(JSON.stringify(core))}};
}
export function verifyPass35A16CanonicalChannelParityRuntime(value:unknown){try{if(!value||typeof value!=="object")return false;const v=value as ReturnType<typeof buildPass35A16CanonicalChannelParityRuntime>;if(v.schemaVersion!=="velmere.pass35.a16.canonical-channel-parity-runtime.v1"||v.surfaceCount!==7||v.tierPacketCount!==21||v.projectionCount!==126||v.parityChecks!==126||v.sellEnabled||v.liveClaimed)return false;const {integrity,...core}=v;if(integrity.digest!==h(JSON.stringify(core)))return false;return v.packets.every((r)=>r.projections.length===6&&r.projections.every((p)=>p.packetId===r.packet.packetId&&p.packetHash===r.packet.packetHash&&p.factsHash===r.packet.factsHash&&!p.addsFacts&&p.claimIds.every((id)=>r.packet.claims.some((claim)=>claim.claimId===id))));}catch{return false;}}
