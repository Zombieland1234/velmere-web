import { createHash, createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify, type KeyObject } from "node:crypto";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";
import type { ReleaseProvenanceIndexArtifact, ReleaseProvenanceSignature } from "@/lib/market-integrity/release-provenance-index";

export type ReleaseProofPublicKey = {
  keyId: string;
  publicKeyPem: string;
  fingerprint: string;
  status: "active" | "retiring" | "revoked";
  notBefore?: number;
  notAfter?: number;
};
export type ReleaseProofPackageSignature = { keyId: string; signature: string };
export type ReleaseProofPackageUnsigned = {
  packageId: string;
  environment: "staging" | "production";
  audience: string;
  sequence: number;
  previousPackageDigest?: string | null;
  provenanceIndex: ReleaseProvenanceIndexArtifact;
  keys: Array<Omit<ReleaseProofPublicKey, "fingerprint"> & { fingerprint?: string }>;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};
export type ReleaseProofPackageRequest = ReleaseProofPackageUnsigned & { signatures: ReleaseProofPackageSignature[] };
export type ReleaseProofPackageArtifact = {
  schemaVersion: "velmere.release-proof-package.v1";
  payload: {
    packageId: string;
    environment: "staging" | "production";
    audience: string;
    audienceHash: string;
    sequence: number;
    previousPackageDigest: string | null;
    provenanceIndex: ReleaseProvenanceIndexArtifact;
    keys: ReleaseProofPublicKey[];
    keyRegistryDigest: string;
    signatureThreshold: number;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
  };
  signatures: ReleaseProofPackageSignature[];
  packageDigest: string;
};

type EnvLike = Record<string, string | undefined>;
type RpcRunner = (input: { operation: SupabaseRpcOperation; args?: Record<string, unknown> }) => Promise<{ data: unknown }>;
const clean = (v: unknown) => String(v ?? "").trim();
const sha = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const isSha = (v: string) => /^[0-9a-f]{64}$/.test(v);
const safeId = (v: string, min = 4, max = 160) => new RegExp(`^[A-Za-z0-9._:-]{${min},${max}}$`).test(v);
const stable = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(",")}}`;
};
function publicKey(pem: string): KeyObject { const key = createPublicKey(clean(pem).replace(/\\n/g, "\n")); if (key.asymmetricKeyType !== "ed25519") throw new Error("release_proof_public_key_not_ed25519"); return key; }
function privateKey(pem: string): KeyObject { const key = createPrivateKey(clean(pem).replace(/\\n/g, "\n")); if (key.asymmetricKeyType !== "ed25519") throw new Error("release_proof_private_key_not_ed25519"); return key; }
function fingerprint(pem: string) { return sha(publicKey(pem).export({ type: "spki", format: "der" }) as Buffer); }
function threshold(env: EnvLike) { const n = Number(env.VELMERE_RELEASE_PROOF_SIGNATURE_THRESHOLD ?? env.VELMERE_RELEASE_PROVENANCE_SIGNATURE_THRESHOLD ?? "2"); if (!Number.isInteger(n) || n < 2 || n > 5) throw new Error("release_proof_threshold_invalid"); return n; }
function normalizeKeys(input: ReleaseProofPackageUnsigned["keys"]): ReleaseProofPublicKey[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > 8) throw new Error("release_proof_keys_invalid");
  const seen = new Set<string>();
  const keys = input.map((item) => {
    const keyId = clean(item.keyId), publicKeyPem = clean(item.publicKeyPem).replace(/\\n/g, "\n"), status = item.status;
    if (!safeId(keyId, 4, 96) || seen.has(keyId)) throw new Error("release_proof_key_id_invalid");
    seen.add(keyId);
    if (!(status === "active" || status === "retiring" || status === "revoked")) throw new Error("release_proof_key_status_invalid");
    const computed = fingerprint(publicKeyPem);
    if (item.fingerprint && clean(item.fingerprint).toLowerCase() !== computed) throw new Error("release_proof_key_fingerprint_mismatch");
    const notBefore = item.notBefore === undefined ? undefined : Number(item.notBefore), notAfter = item.notAfter === undefined ? undefined : Number(item.notAfter);
    if ((notBefore !== undefined && !Number.isInteger(notBefore)) || (notAfter !== undefined && !Number.isInteger(notAfter)) || (notBefore !== undefined && notAfter !== undefined && notAfter <= notBefore)) throw new Error("release_proof_key_window_invalid");
    return { keyId, publicKeyPem, fingerprint: computed, status, ...(notBefore === undefined ? {} : { notBefore }), ...(notAfter === undefined ? {} : { notAfter }) } as ReleaseProofPublicKey;
  }).sort((a,b)=>a.keyId.localeCompare(b.keyId));
  if (!keys.some((k) => k.status === "active")) throw new Error("release_proof_active_key_required");
  return keys;
}
function registryDigest(keys: ReleaseProofPublicKey[]) { return sha(stable(keys.map(({ publicKeyPem, ...rest }) => ({ ...rest, publicKeySpki: Buffer.from(publicKey(publicKeyPem).export({type:"spki",format:"der"}) as Buffer).toString("base64") })))); }
function indexBasePayload(index: ReleaseProvenanceIndexArtifact) { const { signerSetDigest: _ignored, ...base } = index.payload as ReleaseProvenanceIndexArtifact["payload"] & { signerSetDigest?: string }; return base; }
function validateIndex(index: ReleaseProvenanceIndexArtifact, keys: ReleaseProofPublicKey[], environment: string, audienceHash: string) {
  if (!index || index.schemaVersion !== "velmere.release-provenance-index.v1") throw new Error("release_proof_index_invalid");
  if (index.payload.environment !== environment || index.payload.audienceHash !== audienceHash) throw new Error("release_proof_index_binding_mismatch");
  if (!isSha(index.indexDigest) || index.indexDigest !== sha(JSON.stringify({ payload: index.payload, signatures: index.signatures }))) throw new Error("release_proof_index_digest_invalid");
  const leaves = index.payload.entries.map((entry) => sha(JSON.stringify({ path: entry.path, sha256: entry.sha256, sizeBytes: entry.sizeBytes, mediaType: entry.mediaType })));
  if (index.payload.artifactsRoot !== sha(JSON.stringify({ schemaVersion: "velmere.release-provenance-artifacts-root.v1", leaves }))) throw new Error("release_proof_artifacts_root_invalid");
  const chain = sha(JSON.stringify({ schemaVersion: "velmere.release-provenance-chain-root.v1", previousIndexDigest: index.payload.previousIndexDigest, sequence: index.payload.sequence, artifactsRoot: index.payload.artifactsRoot, candidateAttestationDigest: index.payload.candidateAttestationDigest }));
  if (index.payload.chainRoot !== chain) throw new Error("release_proof_chain_root_invalid");
  const keyMap = new Map(keys.map((k) => [k.keyId, k])); const seen = new Set<string>(); let active = 0;
  for (const sig of index.signatures as ReleaseProvenanceSignature[]) {
    if (seen.has(sig.keyId)) throw new Error("release_proof_index_duplicate_signer"); seen.add(sig.keyId);
    const key = keyMap.get(sig.keyId); if (!key || key.status === "revoked") throw new Error("release_proof_index_signer_untrusted");
    if (key.notBefore !== undefined && index.payload.issuedAt < key.notBefore) throw new Error("release_proof_index_signer_not_yet_valid");
    if (key.notAfter !== undefined && index.payload.issuedAt > key.notAfter) throw new Error("release_proof_index_signer_expired");
    if (key.status === "active") active++;
    if (!cryptoVerify(null, Buffer.from(JSON.stringify(indexBasePayload(index))), publicKey(key.publicKeyPem), Buffer.from(sig.signature, "base64url"))) throw new Error("release_proof_index_signature_invalid");
  }
  if (index.signatures.length < index.payload.threshold || active < 1) throw new Error("release_proof_index_threshold_invalid");
}
function canonicalPayload(input: ReleaseProofPackageUnsigned, env: EnvLike) {
  const keys = normalizeKeys(input.keys), audience = clean(input.audience), audienceHash = sha(audience), signatureThreshold = threshold(env);
  validateIndex(input.provenanceIndex, keys, input.environment, audienceHash);
  return { packageId: clean(input.packageId), environment: input.environment, audience, audienceHash, sequence: Number(input.sequence), previousPackageDigest: input.previousPackageDigest ? clean(input.previousPackageDigest).toLowerCase() : null, provenanceIndex: input.provenanceIndex, keys, keyRegistryDigest: registryDigest(keys), signatureThreshold, issuedAt: Number(input.issuedAt), expiresAt: Number(input.expiresAt), nonce: clean(input.nonce) };
}
function validateUnsigned(input: ReleaseProofPackageUnsigned, now: number) {
  if (!safeId(clean(input.packageId), 8, 128) || !(input.environment === "staging" || input.environment === "production") || !safeId(clean(input.audience).replace(/\//g, ":"), 8, 160)) throw new Error("release_proof_identity_invalid");
  if (!Number.isInteger(input.sequence) || input.sequence < 1) throw new Error("release_proof_sequence_invalid");
  const previous = input.previousPackageDigest ? clean(input.previousPackageDigest).toLowerCase() : null;
  if ((input.sequence === 1 && previous) || (input.sequence > 1 && !isSha(previous ?? ""))) throw new Error("release_proof_previous_invalid");
  if (!Number.isInteger(input.issuedAt) || !Number.isInteger(input.expiresAt) || input.issuedAt > now + 60_000 || input.issuedAt < now - 5*60_000 || input.expiresAt <= now || input.expiresAt > input.issuedAt + 30*60_000) throw new Error("release_proof_freshness_invalid");
  if (!safeId(clean(input.nonce), 8, 160)) throw new Error("release_proof_nonce_invalid");
}
export function signReleaseProofPackage(input: ReleaseProofPackageUnsigned, keyId: string, privateKeyPem: string, env: EnvLike = process.env): ReleaseProofPackageSignature {
  validateUnsigned(input, input.issuedAt); const payload = canonicalPayload(input, env);
  return { keyId: clean(keyId), signature: cryptoSign(null, Buffer.from(stable(payload)), privateKey(privateKeyPem)).toString("base64url") };
}
export function buildAndVerifyReleaseProofPackage(input: ReleaseProofPackageRequest, env: EnvLike = process.env, now = Date.now()): ReleaseProofPackageArtifact {
  validateUnsigned(input, now); const payload = canonicalPayload(input, env); const keyMap = new Map(payload.keys.map((k)=>[k.keyId,k])); const seen = new Set<string>(); let active=0;
  if (!Array.isArray(input.signatures) || input.signatures.length < payload.signatureThreshold || input.signatures.length > 8) throw new Error("release_proof_signature_threshold_not_met");
  for (const sig of input.signatures) {
    const keyId=clean(sig.keyId); if (seen.has(keyId)) throw new Error("release_proof_signature_duplicate"); seen.add(keyId);
    const key=keyMap.get(keyId); if(!key) throw new Error("release_proof_signer_unknown"); if(key.status==="revoked") throw new Error("release_proof_signer_revoked");
    if(key.notBefore!==undefined&&payload.issuedAt<key.notBefore) throw new Error("release_proof_signer_not_yet_valid"); if(key.notAfter!==undefined&&payload.issuedAt>key.notAfter) throw new Error("release_proof_signer_expired"); if(key.status==="active")active++;
    if(!cryptoVerify(null,Buffer.from(stable(payload)),publicKey(key.publicKeyPem),Buffer.from(clean(sig.signature),"base64url"))) throw new Error("release_proof_signature_invalid");
  }
  if(active<1) throw new Error("release_proof_active_signer_required");
  const signatures=input.signatures.map((s)=>({keyId:clean(s.keyId),signature:clean(s.signature)})).sort((a,b)=>a.keyId.localeCompare(b.keyId));
  return { schemaVersion:"velmere.release-proof-package.v1", payload, signatures, packageDigest:sha(stable({payload,signatures})) };
}
export async function recordReleaseProofPackage(input:{request:ReleaseProofPackageRequest;env?:EnvLike;dependencies?:{rpc:RpcRunner;now:()=>Date}}){
  const deps=input.dependencies??{rpc:runRegisteredServiceRoleRpc,now:()=>new Date()}; const artifact=buildAndVerifyReleaseProofPackage(input.request,input.env??process.env,deps.now().getTime());
  const {data}=await deps.rpc({operation:"release_proof_package_record",args:{p_idempotency_key:sha(`${artifact.packageDigest}:${artifact.payload.nonce}`),p_package_id_hash:sha(artifact.payload.packageId),p_environment:artifact.payload.environment,p_audience_hash:artifact.payload.audienceHash,p_sequence:artifact.payload.sequence,p_previous_package_digest:artifact.payload.previousPackageDigest,p_index_digest:artifact.payload.provenanceIndex.indexDigest,p_key_registry_digest:artifact.payload.keyRegistryDigest,p_signature_count:artifact.signatures.length,p_signature_threshold:artifact.payload.signatureThreshold,p_package_digest:artifact.packageDigest,p_package_json:artifact,p_issued_at:new Date(artifact.payload.issuedAt).toISOString(),p_expires_at:new Date(artifact.payload.expiresAt).toISOString()}});
  const first=Array.isArray(data)?data[0]:data; if(!first||typeof first!=="object")throw new Error("release_proof_record_empty");
  const verified=await deps.rpc({operation:"release_proof_package_verify",args:{p_package_digest:artifact.packageDigest}}); const status=Array.isArray(verified.data)?verified.data[0]:verified.data;
  return {schemaVersion:"velmere.release-proof-package-record.v1" as const,ok:clean((status as Record<string,unknown>)?.state??(first as Record<string,unknown>).state)==="verified",packageDigest:artifact.packageDigest,indexDigest:artifact.payload.provenanceIndex.indexDigest,sequence:artifact.payload.sequence,keyRegistryDigest:artifact.payload.keyRegistryDigest,privacyBoundary:"Public keys, signatures and release hashes only; no private keys, operator identity, customer data or provider payloads."};
}
export async function getPublicReleaseProofPackages(input:{environment?:"staging"|"production";limit?:number;trustedFingerprints?:string[];dependencies?:{rpc:RpcRunner}}={}):Promise<{schemaVersion:"velmere.public-release-proof-packages.v1";ok:boolean;packages:ReleaseProofPackageArtifact[];feedDigest:string;privacyBoundary:string}>{
  const deps=input.dependencies??{rpc:runRegisteredServiceRoleRpc}; const limit=Math.max(1,Math.min(20,Math.trunc(input.limit??5)));
  const {data}=await deps.rpc({operation:"release_proof_package_public_feed",args:{p_environment:input.environment??null,p_limit:limit}}); const rows=Array.isArray(data)?data:[]; const packages:ReleaseProofPackageArtifact[]=[];
  for(const item of rows){if(!item||typeof item!=="object")continue;const raw=(item as Record<string,unknown>).package_json;try{const artifact: ReleaseProofPackageArtifact = (typeof raw==="string"?JSON.parse(raw):raw) as ReleaseProofPackageArtifact;const rebuilt=buildAndVerifyReleaseProofPackage({...artifact.payload,signatures:artifact.signatures}, {VELMERE_RELEASE_PROOF_SIGNATURE_THRESHOLD:String(artifact.payload.signatureThreshold)}, artifact.payload.issuedAt);if(rebuilt.packageDigest!==artifact.packageDigest)continue;if(input.trustedFingerprints?.length&&!artifact.payload.keys.some((k)=>input.trustedFingerprints!.includes(k.fingerprint)&&k.status!=="revoked"))continue;packages.push(artifact)}catch{continue}}
  packages.sort((a,b)=>b.payload.sequence-a.payload.sequence); for(let i=0;i<packages.length-1;i++){const current=packages[i],previous=packages[i+1];if(current.payload.sequence===previous.payload.sequence+1&&current.payload.previousPackageDigest!==previous.packageDigest)throw new Error("release_proof_public_chain_inconsistent")}
  return {schemaVersion:"velmere.public-release-proof-packages.v1",ok:true,packages,feedDigest:sha(stable(packages.map((p)=>p.packageDigest))),privacyBoundary:"Public proof packages expose public keys, signatures and release hashes for independent verification. Private keys, operator identity, reasons, customer data and provider payloads are never exposed."};
}
