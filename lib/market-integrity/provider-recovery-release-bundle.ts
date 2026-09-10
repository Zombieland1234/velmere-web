import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";
import { probeDurableComputationStaging } from "@/lib/jobs/durable-computation-staging";
import { getProviderRecoveryReleaseCertificateGate } from "@/lib/market-integrity/provider-recovery-release-certificate";

type EnvLike = Record<string, string | undefined>;
type RpcRunner = (input: { operation: SupabaseRpcOperation; args?: Record<string, unknown> }) => Promise<{ data: unknown }>;
type Dependencies = { rpc: RpcRunner; now: () => Date; probe: typeof probeDurableComputationStaging; certificateGate: typeof getProviderRecoveryReleaseCertificateGate };
const defaults: Dependencies = { rpc: runRegisteredServiceRoleRpc, now: () => new Date(), probe: probeDurableComputationStaging, certificateGate: getProviderRecoveryReleaseCertificateGate };

export type ProviderRecoveryReleaseBundleRequest = {
  environment: "staging" | "production";
  audience: string;
  deploymentFingerprint: string;
  rollbackExecutionDigest: string;
  incidentDigest: string;
  qualityDigest: string;
  capabilityDigest: string;
  sourceSha256: string;
  buildSha256: string;
  buildId: string;
  exactCheckpoint: number;
  recoveryProofDigest: string;
  customerSmokeDigest: string;
  providerSmokeDigest: string;
  releaseCertificateDigest: string;
  operatorId: string;
  reason: string;
  approvalTimestamp: number;
  approvalNonce: string;
  approvalSignature: string;
};

export type ProviderRecoveryReleaseBundleGate = {
  schemaVersion: "velmere.provider-recovery-release-bundle-gate.v1";
  ready: boolean;
  required: boolean;
  state: "not_required" | "missing" | "verified" | "consumed" | "expired" | "blocked" | "store_failed";
  bundleDigest: string | null;
  certificateDigest: string | null;
  evidenceRoot: string | null;
  expiresAt: string | null;
  blockers: string[];
  privacyBoundary: string;
};

const clean=(v:unknown)=>String(v??"").trim();
const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
const isSha=(v:string)=>/^[0-9a-f]{64}$/.test(v);
const secretOk=(v:string)=>v.length>=32&&!/(example|placeholder|changeme|dummy|replace[-_ ]?me)/i.test(v);
const buildOk=(v:string)=>/^[A-Za-z0-9._-]{8,128}$/.test(v);
const audienceOk=(v:string)=>/^[A-Za-z0-9._:/-]{8,160}$/.test(v);
const checkpoint=(v:unknown)=>{const n=Number(v);return Number.isInteger(n)&&n>=4725&&n<=999999?n:null};
const row=(d:unknown):Record<string,unknown>|null=>Array.isArray(d)?(d.find((x):x is Record<string,unknown>=>!!x&&typeof x==="object")??null):(d&&typeof d==="object"?d as Record<string,unknown>:null);

function environmentBinding(env: EnvLike) {
  const environment=clean(env.VELMERE_DEPLOYMENT_ENVIRONMENT||env.VERCEL_ENV||"staging").toLowerCase();
  const audience=clean(env.VELMERE_RELEASE_BUNDLE_AUDIENCE);
  return { environment: environment==="production"?"production":environment==="staging"?"staging":null, audience: audienceOk(audience)?audience:null };
}
function releaseEvidence(env:EnvLike){
  const sourceSha256=clean(env.VELMERE_DURABLE_EXACT_SOURCE_SHA256).toLowerCase();
  const buildSha256=clean(env.VELMERE_DURABLE_EXACT_BUILD_SHA256).toLowerCase();
  const buildId=clean(env.VELMERE_DURABLE_EXACT_BUILD_ID);
  return {sourceSha256:isSha(sourceSha256)?sourceSha256:null,buildSha256:isSha(buildSha256)?buildSha256:null,buildId:buildOk(buildId)?buildId:null,exactCheckpoint:checkpoint(env.VELMERE_DURABLE_EXACT_CHECKPOINT)};
}
function evidenceRoot(input: ProviderRecoveryReleaseBundleRequest){
  const leaves=[
    ["deployment",input.deploymentFingerprint],["rollback",input.rollbackExecutionDigest],["incident",input.incidentDigest],["quality",input.qualityDigest],["capability",input.capabilityDigest],["source",input.sourceSha256],["build",input.buildSha256],["buildId",sha(input.buildId)],["checkpoint",sha(String(input.exactCheckpoint))],["recovery",input.recoveryProofDigest],["customerSmoke",input.customerSmokeDigest],["providerSmoke",input.providerSmokeDigest],["certificate",input.releaseCertificateDigest],["environment",sha(input.environment)],["audience",sha(input.audience)],
  ].map(([name,digest])=>sha(`${name}:${digest}`)).sort();
  return sha(JSON.stringify({schemaVersion:"velmere.provider-recovery-release-bundle-root.v1",leaves}));
}
function canonical(input: Omit<ProviderRecoveryReleaseBundleRequest,"approvalSignature">){
  return JSON.stringify({schemaVersion:"velmere.provider-recovery-release-bundle-approval.v1",...input,buildIdHash:sha(input.buildId),operatorHash:sha(input.operatorId),reasonHash:sha(input.reason),evidenceRoot:evidenceRoot({...input,approvalSignature:""})});
}
export function signProviderRecoveryReleaseBundle(input:Omit<ProviderRecoveryReleaseBundleRequest,"approvalSignature">,secret:string){if(!secretOk(secret))throw new Error("provider_recovery_release_bundle_secret_missing_or_weak");return createHmac("sha256",secret).update(canonical(input)).digest("hex")}
function normalize(r:ProviderRecoveryReleaseBundleRequest):ProviderRecoveryReleaseBundleRequest{
  const n={...r,environment:clean(r.environment).toLowerCase() as "staging"|"production",audience:clean(r.audience),deploymentFingerprint:clean(r.deploymentFingerprint).toLowerCase(),rollbackExecutionDigest:clean(r.rollbackExecutionDigest).toLowerCase(),incidentDigest:clean(r.incidentDigest).toLowerCase(),qualityDigest:clean(r.qualityDigest).toLowerCase(),capabilityDigest:clean(r.capabilityDigest).toLowerCase(),sourceSha256:clean(r.sourceSha256).toLowerCase(),buildSha256:clean(r.buildSha256).toLowerCase(),buildId:clean(r.buildId),exactCheckpoint:Number(r.exactCheckpoint),recoveryProofDigest:clean(r.recoveryProofDigest).toLowerCase(),customerSmokeDigest:clean(r.customerSmokeDigest).toLowerCase(),providerSmokeDigest:clean(r.providerSmokeDigest).toLowerCase(),releaseCertificateDigest:clean(r.releaseCertificateDigest).toLowerCase(),operatorId:clean(r.operatorId),reason:clean(r.reason),approvalTimestamp:Number(r.approvalTimestamp),approvalNonce:clean(r.approvalNonce),approvalSignature:clean(r.approvalSignature).toLowerCase()};
  if(!["staging","production"].includes(n.environment))throw new Error("provider_recovery_release_bundle_environment_invalid");
  if(!audienceOk(n.audience))throw new Error("provider_recovery_release_bundle_audience_invalid");
  if(![n.deploymentFingerprint,n.rollbackExecutionDigest,n.incidentDigest,n.qualityDigest,n.capabilityDigest,n.sourceSha256,n.buildSha256,n.recoveryProofDigest,n.customerSmokeDigest,n.providerSmokeDigest,n.releaseCertificateDigest].every(isSha))throw new Error("provider_recovery_release_bundle_digest_invalid");
  if(!buildOk(n.buildId)||checkpoint(n.exactCheckpoint)===null)throw new Error("provider_recovery_release_bundle_exact_invalid");
  if(n.operatorId.length<3||n.operatorId.length>160||n.reason.length<12||n.reason.length>500)throw new Error("provider_recovery_release_bundle_operator_reason_invalid");
  if(!/^[A-Za-z0-9_-]{16,96}$/.test(n.approvalNonce)||!isSha(n.approvalSignature))throw new Error("provider_recovery_release_bundle_approval_invalid");
  return n;
}

export async function recordProviderRecoveryReleaseBundle(input:{request:ProviderRecoveryReleaseBundleRequest;env?:EnvLike;dependencies?:Partial<Dependencies>}){
  const env=input.env??process.env;const deps={...defaults,...input.dependencies};const request=normalize(input.request);const now=deps.now();const nowSeconds=Math.floor(now.getTime()/1000);
  if(Math.abs(nowSeconds-request.approvalTimestamp)>300)throw new Error("provider_recovery_release_bundle_approval_expired_or_future");
  const secret=clean(env.VELMERE_PROVIDER_RECOVERY_RELEASE_BUNDLE_SECRET);if(!secretOk(secret))throw new Error("provider_recovery_release_bundle_secret_missing_or_weak");
  const unsigned={...request};delete (unsigned as Partial<ProviderRecoveryReleaseBundleRequest>).approvalSignature;const expected=signProviderRecoveryReleaseBundle(unsigned,secret);const a=Buffer.from(expected,"hex"),b=Buffer.from(request.approvalSignature,"hex");if(a.length!==b.length||!timingSafeEqual(a,b))throw new Error("provider_recovery_release_bundle_signature_mismatch");
  const binding=environmentBinding(env);if(request.environment!==binding.environment||request.audience!==binding.audience)throw new Error("provider_recovery_release_bundle_environment_binding_mismatch");
  const release=releaseEvidence(env);if(request.sourceSha256!==release.sourceSha256||request.buildSha256!==release.buildSha256||request.buildId!==release.buildId||request.exactCheckpoint!==release.exactCheckpoint)throw new Error("provider_recovery_release_bundle_exact_release_mismatch");
  const probe=await deps.probe({env});if(!probe.stagingProven||probe.capabilityDigest!==request.capabilityDigest||probe.deploymentFingerprint!==request.deploymentFingerprint)throw new Error("provider_recovery_release_bundle_staging_not_proven");
  const cert=await deps.certificateGate({env,expected:{rollbackExecutionDigest:request.rollbackExecutionDigest,incidentDigest:request.incidentDigest,qualityDigest:request.qualityDigest,capabilityDigest:request.capabilityDigest,sourceSha256:request.sourceSha256,buildSha256:request.buildSha256,buildId:request.buildId,exactCheckpoint:request.exactCheckpoint,recoveryProofDigest:request.recoveryProofDigest,customerSmokeDigest:request.customerSmokeDigest,providerSmokeDigest:request.providerSmokeDigest}});
  if(!cert.ready||cert.certificateDigest!==request.releaseCertificateDigest)throw new Error("provider_recovery_release_bundle_certificate_not_verified");
  const root=evidenceRoot(request);const approvalDigest=sha(canonical(unsigned));const idempotencyKey=sha(`release-bundle|${request.environment}|${request.audience}|${root}|${request.releaseCertificateDigest}`);const expiresAt=new Date(now.getTime()+30*60*1000);
  const args={p_idempotency_key:idempotencyKey,p_environment:request.environment,p_audience_hash:sha(request.audience),p_deployment_fingerprint:request.deploymentFingerprint,p_rollback_execution_digest:request.rollbackExecutionDigest,p_incident_digest:request.incidentDigest,p_quality_digest:request.qualityDigest,p_capability_digest:request.capabilityDigest,p_source_sha256:request.sourceSha256,p_build_sha256:request.buildSha256,p_build_id_hash:sha(request.buildId),p_exact_checkpoint:request.exactCheckpoint,p_recovery_proof_digest:request.recoveryProofDigest,p_customer_smoke_digest:request.customerSmokeDigest,p_provider_smoke_digest:request.providerSmokeDigest,p_release_certificate_digest:request.releaseCertificateDigest,p_evidence_root:root,p_operator_hash:sha(request.operatorId),p_reason_hash:sha(request.reason),p_approval_digest:approvalDigest,p_expires_at:expiresAt.toISOString()};
  const recorded=row((await deps.rpc({operation:"provider_recovery_release_bundle_record",args})).data);const bundleDigest=clean(recorded?.bundle_digest).toLowerCase();if(clean(recorded?.state)!=="recorded"||!isSha(bundleDigest))throw new Error("provider_recovery_release_bundle_record_failed");
  const verified=row((await deps.rpc({operation:"provider_recovery_release_bundle_verify",args:{p_bundle_digest:bundleDigest,...args}})).data);if(clean(verified?.state)!=="verified"||clean(verified?.bundle_digest).toLowerCase()!==bundleDigest)throw new Error("provider_recovery_release_bundle_verification_failed");
  return {schemaVersion:"velmere.provider-recovery-release-bundle-result.v1" as const,ok:true,state:"verified" as const,bundleDigest,evidenceRoot:root,releaseCertificateDigest:request.releaseCertificateDigest,expiresAt:expiresAt.toISOString(),privacyBoundary:"Only aggregate state and SHA-256 digests are returned. No operator identity, reason, raw audience, build ID, customer data, provider payloads or signatures are exposed."};
}

export async function getProviderRecoveryReleaseBundleGate(input:{env?:EnvLike;expected?:Partial<ProviderRecoveryReleaseBundleRequest>;dependencies?:Partial<Dependencies>}={}):Promise<ProviderRecoveryReleaseBundleGate>{
  const env=input.env??process.env;const deps={...defaults,...input.dependencies};const privacyBoundary="Only aggregate state, expiry and SHA-256 digests are exposed.";const cert=clean(input.expected?.releaseCertificateDigest).toLowerCase();if(!isSha(cert))return{schemaVersion:"velmere.provider-recovery-release-bundle-gate.v1",ready:true,required:false,state:"not_required",bundleDigest:null,certificateDigest:null,evidenceRoot:null,expiresAt:null,blockers:[],privacyBoundary};
  const binding=environmentBinding(env),release=releaseEvidence(env);const e=input.expected??{};const fields={environment:clean(e.environment??binding.environment),audience:clean(e.audience??binding.audience),deploymentFingerprint:clean(e.deploymentFingerprint).toLowerCase(),rollbackExecutionDigest:clean(e.rollbackExecutionDigest).toLowerCase(),incidentDigest:clean(e.incidentDigest).toLowerCase(),qualityDigest:clean(e.qualityDigest).toLowerCase(),capabilityDigest:clean(e.capabilityDigest).toLowerCase(),sourceSha256:clean(e.sourceSha256??release.sourceSha256).toLowerCase(),buildSha256:clean(e.buildSha256??release.buildSha256).toLowerCase(),buildId:clean(e.buildId??release.buildId),exactCheckpoint:e.exactCheckpoint??release.exactCheckpoint,recoveryProofDigest:clean(e.recoveryProofDigest).toLowerCase(),customerSmokeDigest:clean(e.customerSmokeDigest).toLowerCase(),providerSmokeDigest:clean(e.providerSmokeDigest).toLowerCase(),releaseCertificateDigest:cert};
  const blockers:string[]=[];if(![fields.deploymentFingerprint,fields.rollbackExecutionDigest,fields.incidentDigest,fields.qualityDigest,fields.capabilityDigest,fields.sourceSha256,fields.buildSha256,fields.recoveryProofDigest,fields.customerSmokeDigest,fields.providerSmokeDigest,fields.releaseCertificateDigest].every(isSha))blockers.push("provider_recovery_release_bundle_evidence_missing");if(!fields.environment||!audienceOk(fields.audience)||!buildOk(fields.buildId)||checkpoint(fields.exactCheckpoint)===null)blockers.push("provider_recovery_release_bundle_binding_missing");if(blockers.length)return{schemaVersion:"velmere.provider-recovery-release-bundle-gate.v1",ready:false,required:true,state:"blocked",bundleDigest:null,certificateDigest:cert,evidenceRoot:null,expiresAt:null,blockers,privacyBoundary};
  const synthetic={...fields,operatorId:"gate",reason:"gate status lookup",approvalTimestamp:0,approvalNonce:"gate_status_lookup_0001",approvalSignature:"0".repeat(64)} as ProviderRecoveryReleaseBundleRequest;const root=evidenceRoot(synthetic);
  try{const status=row((await deps.rpc({operation:"provider_recovery_release_bundle_status",args:{p_environment:fields.environment,p_audience_hash:sha(fields.audience),p_deployment_fingerprint:fields.deploymentFingerprint,p_rollback_execution_digest:fields.rollbackExecutionDigest,p_incident_digest:fields.incidentDigest,p_quality_digest:fields.qualityDigest,p_capability_digest:fields.capabilityDigest,p_source_sha256:fields.sourceSha256,p_build_sha256:fields.buildSha256,p_build_id_hash:sha(fields.buildId),p_exact_checkpoint:fields.exactCheckpoint,p_recovery_proof_digest:fields.recoveryProofDigest,p_customer_smoke_digest:fields.customerSmokeDigest,p_provider_smoke_digest:fields.providerSmokeDigest,p_release_certificate_digest:fields.releaseCertificateDigest,p_evidence_root:root,p_now:deps.now().toISOString()}})).data);const state=clean(status?.state) as ProviderRecoveryReleaseBundleGate["state"];const bundleDigest=clean(status?.bundle_digest).toLowerCase();const expiresAt=clean(status?.expires_at)||null;const bs=Array.isArray(status?.blockers)?status!.blockers as string[]:[];const ready=state==="verified"&&isSha(bundleDigest)&&bs.length===0;return{schemaVersion:"velmere.provider-recovery-release-bundle-gate.v1",ready,required:true,state:ready?"verified":state||"missing",bundleDigest:isSha(bundleDigest)?bundleDigest:null,certificateDigest:cert,evidenceRoot:root,expiresAt,blockers:ready?[]:bs.length?bs:["provider_recovery_release_bundle_not_verified"],privacyBoundary};}catch{return{schemaVersion:"velmere.provider-recovery-release-bundle-gate.v1",ready:false,required:true,state:"store_failed",bundleDigest:null,certificateDigest:cert,evidenceRoot:root,expiresAt:null,blockers:["provider_recovery_release_bundle_store_failed"],privacyBoundary};}
}
