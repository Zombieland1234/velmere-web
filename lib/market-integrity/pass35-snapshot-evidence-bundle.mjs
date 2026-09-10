import { createHash } from 'node:crypto';

const SHA=/^sha256:[a-f0-9]{64}$/u;
const MODES=new Set(['PUBLIC_NETWORK_EXPORT','FILE_IMPORT','INJECTED_FIXTURE']);
const stable=(value)=>JSON.stringify(sortDeep(value));
function sortDeep(value){if(Array.isArray(value))return value.map(sortDeep);if(value&&typeof value==='object'&&!Buffer.isBuffer(value))return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,sortDeep(value[key])]));return value;}
export const digestBytes=(value)=>`sha256:${createHash('sha256').update(Buffer.isBuffer(value)?value:typeof value==='string'?value:stable(value)).digest('hex')}`;
const normalizePayload=(payload)=>Buffer.isBuffer(payload)?payload:Buffer.from(typeof payload==='string'?payload:stable(payload));
function unsigned(value){const {integrity,...rest}=value;return rest;}

export const PASS35_A15_SNAPSHOT_BUNDLE_ID='pass35-a15-snapshot-evidence-bundle-v1';

export function buildPass35A15SnapshotEvidenceBundle(args){
  const providerId=String(args?.providerId??'').trim().toLowerCase();
  const providerFamily=String(args?.providerFamily??'').trim().toLowerCase();
  const datasetType=String(args?.datasetType??'').trim().toUpperCase();
  const sourceMode=String(args?.sourceMode??'INJECTED_FIXTURE').trim().toUpperCase();
  if(!providerId||!providerFamily||!datasetType||!MODES.has(sourceMode))throw new Error('snapshot_bundle_identity_invalid');
  const observedAt=new Date(args.observedAt);const exportedAt=new Date(args.exportedAt??args.observedAt);
  if(!Number.isFinite(observedAt.getTime())||!Number.isFinite(exportedAt.getTime())||observedAt>exportedAt)throw new Error('snapshot_bundle_time_invalid');
  const bytes=normalizePayload(args.payload);const maximumBytes=Math.max(1,Number(args.maximumBytes??10_000_000));
  if(bytes.length===0||bytes.length>maximumBytes)throw new Error('snapshot_bundle_payload_size_invalid');
  const core={schemaVersion:'velmere.pass35.snapshot-evidence-bundle.v1',bundleId:PASS35_A15_SNAPSHOT_BUNDLE_ID,providerId,providerFamily,datasetType,sourceMode,observedAt:observedAt.toISOString(),exportedAt:exportedAt.toISOString(),sourceUrlDigest:digestBytes(String(args.sourceUrl??'unknown')),payloadEncoding:String(args.payloadEncoding??'utf8'),payloadByteLength:bytes.length,payloadDigest:digestBytes(bytes),recordCount:Number.isFinite(Number(args.recordCount))?Math.max(0,Math.floor(Number(args.recordCount))):null,licenseHint:String(args.licenseHint??'UNRESOLVED'),publicNetworkExecuted:sourceMode==='PUBLIC_NETWORK_EXPORT',signatureReference:args.signatureReference??null,paidGateEligible:false,sellEnabled:false,liveClaimed:false};
  const value={...core,integrity:{algorithm:'sha256',digest:digestBytes(core)}};
  if(!verifyPass35A15SnapshotEvidenceBundle(value,bytes))throw new Error('snapshot_bundle_integrity_invalid');
  return {bundle:value,payloadBytes:bytes};
}

export function verifyPass35A15SnapshotEvidenceBundle(bundle,payload){
  try{
    const bytes=normalizePayload(payload);
    if(bundle.schemaVersion!=='velmere.pass35.snapshot-evidence-bundle.v1'||bundle.bundleId!==PASS35_A15_SNAPSHOT_BUNDLE_ID)return false;
    if(!MODES.has(bundle.sourceMode)||!SHA.test(bundle.integrity?.digest)||digestBytes(unsigned(bundle))!==bundle.integrity.digest)return false;
    if(bundle.payloadByteLength!==bytes.length||bundle.payloadDigest!==digestBytes(bytes)||!SHA.test(bundle.sourceUrlDigest))return false;
    if(bundle.paidGateEligible!==false||bundle.sellEnabled!==false||bundle.liveClaimed!==false)return false;
    const observed=Date.parse(bundle.observedAt),exported=Date.parse(bundle.exportedAt);if(!Number.isFinite(observed)||!Number.isFinite(exported)||observed>exported)return false;
    return true;
  }catch{return false;}
}

export function importPass35A15SnapshotEvidenceBundle(args){
  const bundle=args?.bundle;const bytes=normalizePayload(args?.payload);
  if(!verifyPass35A15SnapshotEvidenceBundle(bundle,bytes))throw new Error('snapshot_bundle_verify_failed');
  if(args.expectedProviderId&&bundle.providerId!==String(args.expectedProviderId).toLowerCase())throw new Error('snapshot_bundle_provider_mismatch');
  if(args.expectedDatasetType&&bundle.datasetType!==String(args.expectedDatasetType).toUpperCase())throw new Error('snapshot_bundle_dataset_mismatch');
  const now=new Date(args.now??bundle.exportedAt);const ageMs=now.getTime()-Date.parse(bundle.observedAt);const maximumAgeMs=Math.max(0,Number(args.maximumAgeMs??86_400_000));
  const state=ageMs<0?'FUTURE_DATED':ageMs>maximumAgeMs?'STALE':'ACCEPTED';
  return {state,ageMs,providerId:bundle.providerId,providerFamily:bundle.providerFamily,datasetType:bundle.datasetType,sourceMode:bundle.sourceMode,payloadDigest:bundle.payloadDigest,payloadByteLength:bundle.payloadByteLength,publicNetworkExecuted:bundle.publicNetworkExecuted===true,paidGateEligible:false,sellEnabled:false,liveClaimed:false,truthBoundary:'Imported bytes are hash-bound and freshness-checked. FILE_IMPORT or fixture execution is not automatically LIVE, licensed, customer-proven or sell-ready.'};
}
