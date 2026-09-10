import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";
import {
  verifyReleaseTrustCheckpointArtifact,
  type ReleaseTrustCheckpointArtifact,
} from "@/lib/market-integrity/release-trust-checkpoint";

export type ReleaseTrustConsistencySignature = { keyId: string; signature: string };
export type ReleaseTrustConsistencyMode = "continuous" | "emergency_rebootstrap";
export type ReleaseTrustConsistencyUnsigned = {
  proofId: string;
  environment: "staging" | "production";
  audience: string;
  checkpoints: ReleaseTrustCheckpointArtifact[];
  mode: ReleaseTrustConsistencyMode;
  emergencyIncidentDigest?: string;
  emergencyApprovalDigest?: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};
export type ReleaseTrustConsistencyRequest = ReleaseTrustConsistencyUnsigned & {
  signatures: ReleaseTrustConsistencySignature[];
};
export type ReleaseTrustConsistencyArtifact = {
  schemaVersion: "velmere.release-trust-consistency-proof.v1";
  payload: {
    proofId: string;
    environment: "staging" | "production";
    audience: string;
    audienceHash: string;
    mode: ReleaseTrustConsistencyMode;
    fromCheckpointDigest: string;
    toCheckpointDigest: string;
    fromSequence: number;
    toSequence: number;
    checkpointDigests: string[];
    trustEpochStart: number;
    trustEpochEnd: number;
    revokedAdded: string[];
    supersededAdded: string[];
    latestKeyRegistryDigest: string;
    emergencyIncidentDigest: string | null;
    emergencyApprovalDigest: string | null;
    signatureThreshold: number;
    consistencyRoot: string;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
  };
  signatures: ReleaseTrustConsistencySignature[];
  proofDigest: string;
};

type EnvLike = Record<string, string | undefined>;
type RpcRunner = (input: { operation: SupabaseRpcOperation; args?: Record<string, unknown> }) => Promise<{ data: unknown }>;
const clean = (v: unknown) => String(v ?? "").trim();
const sha = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const isSha = (v: string) => /^[0-9a-f]{64}$/.test(v);
const stable = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(",")}}`;
};
const safeId = (v: string, min = 6, max = 160) => new RegExp(`^[A-Za-z0-9._:-]{${min},${max}}$`).test(v);
function pub(pem: string): KeyObject { const k = createPublicKey(clean(pem).replace(/\\n/g, "\n")); if (k.asymmetricKeyType !== "ed25519") throw new Error("release_consistency_public_key_not_ed25519"); return k; }
function priv(pem: string): KeyObject { const k = createPrivateKey(clean(pem).replace(/\\n/g, "\n")); if (k.asymmetricKeyType !== "ed25519") throw new Error("release_consistency_private_key_not_ed25519"); return k; }
function threshold(env: EnvLike) {
  const n = Number(env.VELMERE_RELEASE_CONSISTENCY_SIGNATURE_THRESHOLD ?? env.VELMERE_RELEASE_TRUST_SIGNATURE_THRESHOLD ?? "2");
  if (!Number.isInteger(n) || n < 2 || n > 5) throw new Error("release_consistency_threshold_invalid");
  return n;
}
function trustedGenesisFingerprints(env: EnvLike) {
  const values = clean(env.VELMERE_RELEASE_TRUSTED_GENESIS_FINGERPRINTS).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (values.some((value) => !isSha(value))) throw new Error("release_consistency_genesis_fingerprint_invalid");
  return values;
}
function latestActiveKeys(checkpoint: ReleaseTrustCheckpointArtifact) {
  return checkpoint.payload.keys.filter((k) => k.status === "active");
}
function validateChain(input: ReleaseTrustConsistencyUnsigned, env: EnvLike) {
  if (!safeId(clean(input.proofId), 8, 128) || !(input.environment === "staging" || input.environment === "production") || !safeId(clean(input.audience).replace(/\//g, ":"), 8, 160)) {
    throw new Error("release_consistency_identity_invalid");
  }
  if (!Array.isArray(input.checkpoints) || input.checkpoints.length < 2 || input.checkpoints.length > 128) throw new Error("release_consistency_checkpoint_count_invalid");
  for (let i = 0; i < input.checkpoints.length; i += 1) {
    const current = input.checkpoints[i];
    const previous = i === 0 ? null : input.checkpoints[i - 1];
    verifyReleaseTrustCheckpointArtifact(current, { expectedEnvironment: input.environment, expectedAudience: input.audience, previousCheckpoint: previous, trustedFingerprints: trustedGenesisFingerprints(env), requireExternalAnchor: i === 0 });
    if (previous && current.payload.sequence !== previous.payload.sequence + 1) throw new Error("release_consistency_sequence_gap");
  }
  if (!(input.mode === "continuous" || input.mode === "emergency_rebootstrap")) throw new Error("release_consistency_mode_invalid");
  const first = input.checkpoints[0], latest = input.checkpoints[input.checkpoints.length - 1];
  const firstRevoked = new Set(first.payload.revokedKeyFingerprints);
  const revokedAdded = latest.payload.revokedKeyFingerprints.filter((v) => !firstRevoked.has(v)).sort();
  if (input.mode === "continuous") {
    if (input.emergencyIncidentDigest || input.emergencyApprovalDigest) throw new Error("release_consistency_emergency_metadata_forbidden");
  } else {
    const incident = clean(input.emergencyIncidentDigest).toLowerCase();
    const approval = clean(input.emergencyApprovalDigest).toLowerCase();
    if (!isSha(incident) || !isSha(approval)) throw new Error("release_consistency_emergency_evidence_required");
    if (latest.payload.trustEpoch <= first.payload.trustEpoch || revokedAdded.length < 1) throw new Error("release_consistency_emergency_rotation_required");
    if (latestActiveKeys(latest).length < 2) throw new Error("release_consistency_emergency_active_quorum_required");
  }
  return { first, latest, revokedAdded };
}
function payload(input: ReleaseTrustConsistencyUnsigned, env: EnvLike) {
  const { first, latest, revokedAdded } = validateChain(input, env);
  const firstSup = new Set(first.payload.supersededPackageDigests);
  const supersededAdded = latest.payload.supersededPackageDigests.filter((v) => !firstSup.has(v)).sort();
  const checkpointDigests = input.checkpoints.map((c) => c.checkpointDigest);
  const core = {
    proofId: clean(input.proofId), environment: input.environment, audience: clean(input.audience), audienceHash: sha(clean(input.audience)), mode: input.mode,
    fromCheckpointDigest: first.checkpointDigest, toCheckpointDigest: latest.checkpointDigest,
    fromSequence: first.payload.sequence, toSequence: latest.payload.sequence, checkpointDigests,
    trustEpochStart: first.payload.trustEpoch, trustEpochEnd: latest.payload.trustEpoch,
    revokedAdded, supersededAdded, latestKeyRegistryDigest: latest.payload.keyRegistryDigest,
    emergencyIncidentDigest: input.mode === "emergency_rebootstrap" ? clean(input.emergencyIncidentDigest).toLowerCase() : null,
    emergencyApprovalDigest: input.mode === "emergency_rebootstrap" ? clean(input.emergencyApprovalDigest).toLowerCase() : null,
    signatureThreshold: threshold(env), issuedAt: Number(input.issuedAt), expiresAt: Number(input.expiresAt), nonce: clean(input.nonce),
  };
  return { ...core, consistencyRoot: sha(stable({ checkpointDigests, trustEpochStart: core.trustEpochStart, trustEpochEnd: core.trustEpochEnd, revokedAdded, supersededAdded, latestKeyRegistryDigest: core.latestKeyRegistryDigest, mode: core.mode, emergencyIncidentDigest: core.emergencyIncidentDigest })) };
}
function validateFresh(input: ReleaseTrustConsistencyUnsigned, now: number) {
  if (!Number.isInteger(input.issuedAt) || !Number.isInteger(input.expiresAt) || input.issuedAt > now + 60_000 || input.issuedAt < now - 5 * 60_000 || input.expiresAt <= now || input.expiresAt > input.issuedAt + 30 * 60_000) throw new Error("release_consistency_freshness_invalid");
  if (!safeId(clean(input.nonce), 8, 160)) throw new Error("release_consistency_nonce_invalid");
}
export function signReleaseTrustConsistencyProof(input: ReleaseTrustConsistencyUnsigned, keyId: string, privateKeyPem: string, env: EnvLike = process.env): ReleaseTrustConsistencySignature {
  validateFresh(input, input.issuedAt); const p = payload(input, env); return { keyId: clean(keyId), signature: cryptoSign(null, Buffer.from(stable(p)), priv(privateKeyPem)).toString("base64url") };
}
export function buildAndVerifyReleaseTrustConsistencyProof(input: ReleaseTrustConsistencyRequest, env: EnvLike = process.env, now = Date.now()): ReleaseTrustConsistencyArtifact {
  validateFresh(input, now); const p = payload(input, env); const latest = input.checkpoints[input.checkpoints.length - 1];
  const keys = new Map(latest.payload.keys.map((k) => [k.keyId, k])); const seen = new Set<string>(); let active = 0;
  if (!Array.isArray(input.signatures) || input.signatures.length < p.signatureThreshold || input.signatures.length > 8) throw new Error("release_consistency_signature_threshold_not_met");
  for (const s of input.signatures) { const id = clean(s.keyId); if (seen.has(id)) throw new Error("release_consistency_signature_duplicate"); seen.add(id); const k = keys.get(id); if (!k || k.status === "revoked") throw new Error("release_consistency_signer_revoked"); if (k.status === "active") active += 1; if (!cryptoVerify(null, Buffer.from(stable(p)), pub(k.publicKeyPem), Buffer.from(clean(s.signature), "base64url"))) throw new Error("release_consistency_signature_invalid"); }
  if (active < 1) throw new Error("release_consistency_active_signer_required");
  const signatures = input.signatures.map((s) => ({ keyId: clean(s.keyId), signature: clean(s.signature) })).sort((a,b)=>a.keyId.localeCompare(b.keyId));
  return { schemaVersion: "velmere.release-trust-consistency-proof.v1", payload: p, signatures, proofDigest: sha(stable({ payload: p, signatures })) };
}
export function verifyReleaseTrustConsistencyArtifact(artifact: ReleaseTrustConsistencyArtifact, checkpoints: ReleaseTrustCheckpointArtifact[], env: EnvLike = process.env) {
  const rebuilt = buildAndVerifyReleaseTrustConsistencyProof({
    proofId: artifact.payload.proofId, environment: artifact.payload.environment, audience: artifact.payload.audience, checkpoints, mode: artifact.payload.mode,
    emergencyIncidentDigest: artifact.payload.emergencyIncidentDigest ?? undefined, emergencyApprovalDigest: artifact.payload.emergencyApprovalDigest ?? undefined,
    issuedAt: artifact.payload.issuedAt, expiresAt: artifact.payload.expiresAt, nonce: artifact.payload.nonce, signatures: artifact.signatures,
  }, { ...env, VELMERE_RELEASE_CONSISTENCY_SIGNATURE_THRESHOLD: String(artifact.payload.signatureThreshold) }, artifact.payload.issuedAt);
  if (rebuilt.proofDigest !== artifact.proofDigest || rebuilt.payload.consistencyRoot !== artifact.payload.consistencyRoot) throw new Error("release_consistency_artifact_digest_invalid");
  return true;
}
export async function recordReleaseTrustConsistencyProof(input: { request: ReleaseTrustConsistencyRequest; env?: EnvLike; dependencies?: { rpc: RpcRunner; now: () => Date } }) {
  const dependencies = input.dependencies ?? { rpc: runRegisteredServiceRoleRpc, now: () => new Date() };
  const artifact = buildAndVerifyReleaseTrustConsistencyProof(input.request, input.env ?? process.env, dependencies.now().getTime());
  await dependencies.rpc({ operation: "release_trust_consistency_record", args: { p_idempotency_key: sha(`${artifact.proofDigest}:${artifact.payload.nonce}`), p_proof_digest: artifact.proofDigest, p_environment: artifact.payload.environment, p_audience_hash: artifact.payload.audienceHash, p_mode: artifact.payload.mode, p_from_checkpoint_digest: artifact.payload.fromCheckpointDigest, p_to_checkpoint_digest: artifact.payload.toCheckpointDigest, p_from_sequence: artifact.payload.fromSequence, p_to_sequence: artifact.payload.toSequence, p_consistency_root: artifact.payload.consistencyRoot, p_trust_epoch_start: artifact.payload.trustEpochStart, p_trust_epoch_end: artifact.payload.trustEpochEnd, p_signature_count: artifact.signatures.length, p_signature_threshold: artifact.payload.signatureThreshold, p_proof_json: artifact, p_issued_at: new Date(artifact.payload.issuedAt).toISOString(), p_expires_at: new Date(artifact.payload.expiresAt).toISOString() } });
  const { data } = await dependencies.rpc({ operation: "release_trust_consistency_verify", args: { p_proof_digest: artifact.proofDigest } });
  return { schemaVersion: "velmere.release-trust-consistency-record.v1", ok: true, artifact, data, privacyBoundary: "hashes-and-aggregate-trust-transitions" };
}
export async function getPublicReleaseTrustConsistencyProofs(input: { environment?: "staging" | "production"; limit?: number; dependencies?: { rpc: RpcRunner } }) {
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc; const limit = Math.max(1, Math.min(50, Number(input.limit ?? 10)));
  const { data } = await rpc({ operation: "release_trust_consistency_public_feed", args: { p_environment: input.environment ?? null, p_limit: limit } });
  const rows = Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row))
    : [];
  return { schemaVersion: "velmere.public-release-trust-consistency.v1", ok: true, proofs: rows.map((r) => ({ proofDigest: clean(r.proof_digest), environment: clean(r.environment), mode: clean(r.mode), fromCheckpointDigest: clean(r.from_checkpoint_digest), toCheckpointDigest: clean(r.to_checkpoint_digest), fromSequence: Number(r.from_sequence), toSequence: Number(r.to_sequence), consistencyRoot: clean(r.consistency_root), trustEpochStart: Number(r.trust_epoch_start), trustEpochEnd: Number(r.trust_epoch_end), signatureCount: Number(r.signature_count), signatureThreshold: Number(r.signature_threshold), verifiedAt: r.verified_at ?? null })), privacyBoundary: "no-keys-no-signatures-no-operator-data" };
}
