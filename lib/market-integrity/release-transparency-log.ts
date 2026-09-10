import { createHash, createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify, type KeyObject } from "node:crypto";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";
import { verifyReleaseTrustCheckpointArtifact, type ReleaseTrustCheckpointArtifact } from "@/lib/market-integrity/release-trust-checkpoint";
import { verifyReleaseTrustConsistencyArtifact, type ReleaseTrustConsistencyArtifact } from "@/lib/market-integrity/release-trust-consistency";

export type ReleaseTransparencySignature = { keyId: string; signature: string };
export type ReleaseTransparencyUnsigned = {
  entryId: string;
  environment: "staging" | "production";
  audience: string;
  sequence: number;
  previousEntry?: ReleaseTransparencyArtifact | null;
  trustCheckpoint: ReleaseTrustCheckpointArtifact;
  consistencyProof: ReleaseTrustConsistencyArtifact;
  consistencyCheckpoints: ReleaseTrustCheckpointArtifact[];
  provenanceIndexDigest: string;
  proofPackageDigest: string;
  releaseCandidateAttestationDigest: string;
  sourceSha256: string;
  buildSha256: string;
  exactCheckpoint: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};
export type ReleaseTransparencyRequest = ReleaseTransparencyUnsigned & { signatures: ReleaseTransparencySignature[] };
export type ReleaseTransparencyArtifact = {
  schemaVersion: "velmere.release-transparency-entry.v1";
  payload: {
    entryId: string;
    environment: "staging" | "production";
    audience: string;
    audienceHash: string;
    sequence: number;
    previousEntryDigest: string | null;
    previousLogRoot: string | null;
    trustCheckpointDigest: string;
    trustCheckpointSequence: number;
    trustEpoch: number;
    consistencyProofDigest: string;
    provenanceIndexDigest: string;
    proofPackageDigest: string;
    releaseCandidateAttestationDigest: string;
    sourceSha256: string;
    buildSha256: string;
    exactCheckpoint: number;
    signatureThreshold: number;
    entryLeafDigest: string;
    logRoot: string;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
  };
  signatures: ReleaseTransparencySignature[];
  entryDigest: string;
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
function pub(pem: string): KeyObject { const k = createPublicKey(clean(pem).replace(/\\n/g, "\n")); if (k.asymmetricKeyType !== "ed25519") throw new Error("release_transparency_public_key_not_ed25519"); return k; }
function priv(pem: string): KeyObject { const k = createPrivateKey(clean(pem).replace(/\\n/g, "\n")); if (k.asymmetricKeyType !== "ed25519") throw new Error("release_transparency_private_key_not_ed25519"); return k; }
function trustedGenesisFingerprints(env: EnvLike) { const values = clean(env.VELMERE_RELEASE_TRUSTED_GENESIS_FINGERPRINTS).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean); if (values.some((value) => !isSha(value))) throw new Error("release_transparency_genesis_fingerprint_invalid"); return values; }
function threshold(env: EnvLike) { const n = Number(env.VELMERE_RELEASE_TRANSPARENCY_SIGNATURE_THRESHOLD ?? env.VELMERE_RELEASE_TRUST_SIGNATURE_THRESHOLD ?? "2"); if (!Number.isInteger(n) || n < 2 || n > 5) throw new Error("release_transparency_threshold_invalid"); return n; }
function validateFresh(input: ReleaseTransparencyUnsigned, now: number) {
  if (!Number.isInteger(input.issuedAt) || !Number.isInteger(input.expiresAt) || input.issuedAt > now + 60_000 || input.issuedAt < now - 5 * 60_000 || input.expiresAt <= now || input.expiresAt > input.issuedAt + 30 * 60_000) throw new Error("release_transparency_freshness_invalid");
  if (!safeId(clean(input.nonce), 8, 160)) throw new Error("release_transparency_nonce_invalid");
}
function canonicalPayload(input: ReleaseTransparencyUnsigned, env: EnvLike) {
  if (!safeId(clean(input.entryId), 8, 128) || !(input.environment === "staging" || input.environment === "production") || !safeId(clean(input.audience).replace(/\//g, ":"), 8, 160)) throw new Error("release_transparency_identity_invalid");
  if (!Number.isInteger(input.sequence) || input.sequence < 1 || !Number.isInteger(input.exactCheckpoint) || input.exactCheckpoint < 1) throw new Error("release_transparency_sequence_invalid");
  for (const digest of [input.provenanceIndexDigest, input.proofPackageDigest, input.releaseCandidateAttestationDigest, input.sourceSha256, input.buildSha256]) if (!isSha(clean(digest).toLowerCase())) throw new Error("release_transparency_digest_invalid");
  const genesisAnchors = trustedGenesisFingerprints(env);
  if (genesisAnchors.length < 1) throw new Error("release_transparency_external_genesis_anchor_required");
  verifyReleaseTrustCheckpointArtifact(input.trustCheckpoint, { expectedEnvironment: input.environment, expectedAudience: input.audience, previousCheckpoint: null, trustedFingerprints: genesisAnchors, requireExternalAnchor: input.trustCheckpoint.payload.sequence === 1 });
  verifyReleaseTrustConsistencyArtifact(input.consistencyProof, input.consistencyCheckpoints, env);
  if (input.consistencyProof.payload.environment !== input.environment || input.consistencyProof.payload.audience !== input.audience || input.consistencyProof.payload.toCheckpointDigest !== input.trustCheckpoint.checkpointDigest) throw new Error("release_transparency_trust_binding_invalid");
  const previous = input.previousEntry ?? null;
  if (input.sequence === 1 && previous) throw new Error("release_transparency_genesis_previous_forbidden");
  if (input.sequence > 1) {
    if (!previous) throw new Error("release_transparency_previous_required");
    verifyReleaseTransparencyArtifact(previous, { trustCheckpoint: input.trustCheckpoint, consistencyProof: input.consistencyProof, consistencyCheckpoints: input.consistencyCheckpoints, allowHistoricalTrustMismatch: true }, env);
    if (previous.payload.environment !== input.environment || previous.payload.audience !== input.audience || previous.payload.sequence !== input.sequence - 1) throw new Error("release_transparency_previous_binding_invalid");
  }
  const core = {
    entryId: clean(input.entryId), environment: input.environment, audience: clean(input.audience), audienceHash: sha(clean(input.audience)), sequence: input.sequence,
    previousEntryDigest: previous?.entryDigest ?? null, previousLogRoot: previous?.payload.logRoot ?? null,
    trustCheckpointDigest: input.trustCheckpoint.checkpointDigest, trustCheckpointSequence: input.trustCheckpoint.payload.sequence, trustEpoch: input.trustCheckpoint.payload.trustEpoch,
    consistencyProofDigest: input.consistencyProof.proofDigest,
    provenanceIndexDigest: clean(input.provenanceIndexDigest).toLowerCase(), proofPackageDigest: clean(input.proofPackageDigest).toLowerCase(), releaseCandidateAttestationDigest: clean(input.releaseCandidateAttestationDigest).toLowerCase(),
    sourceSha256: clean(input.sourceSha256).toLowerCase(), buildSha256: clean(input.buildSha256).toLowerCase(), exactCheckpoint: input.exactCheckpoint,
    signatureThreshold: threshold(env), issuedAt: input.issuedAt, expiresAt: input.expiresAt, nonce: clean(input.nonce),
  };
  const entryLeafDigest = sha(stable(core));
  const logRoot = sha(stable({ previousLogRoot: core.previousLogRoot, entryLeafDigest, sequence: core.sequence, environment: core.environment, audienceHash: core.audienceHash }));
  return { ...core, entryLeafDigest, logRoot };
}
export function signReleaseTransparencyEntry(input: ReleaseTransparencyUnsigned, keyId: string, privateKeyPem: string, env: EnvLike = process.env): ReleaseTransparencySignature {
  validateFresh(input, input.issuedAt); const payload = canonicalPayload(input, env); return { keyId: clean(keyId), signature: cryptoSign(null, Buffer.from(stable(payload)), priv(privateKeyPem)).toString("base64url") };
}
export function buildAndVerifyReleaseTransparencyEntry(input: ReleaseTransparencyRequest, env: EnvLike = process.env, now = Date.now()): ReleaseTransparencyArtifact {
  validateFresh(input, now); const payload = canonicalPayload(input, env); const keys = new Map(input.trustCheckpoint.payload.keys.map((k) => [k.keyId, k])); const seen = new Set<string>(); let active = 0;
  if (!Array.isArray(input.signatures) || input.signatures.length < payload.signatureThreshold || input.signatures.length > 8) throw new Error("release_transparency_signature_threshold_not_met");
  for (const sig of input.signatures) { const keyId = clean(sig.keyId); if (seen.has(keyId)) throw new Error("release_transparency_signature_duplicate"); seen.add(keyId); const key = keys.get(keyId); if (!key || key.status === "revoked") throw new Error("release_transparency_signer_revoked"); if (key.status === "active") active += 1; if (!cryptoVerify(null, Buffer.from(stable(payload)), pub(key.publicKeyPem), Buffer.from(clean(sig.signature), "base64url"))) throw new Error("release_transparency_signature_invalid"); }
  if (active < 1) throw new Error("release_transparency_active_signer_required");
  const signatures = input.signatures.map((s) => ({ keyId: clean(s.keyId), signature: clean(s.signature) })).sort((a,b)=>a.keyId.localeCompare(b.keyId));
  return { schemaVersion: "velmere.release-transparency-entry.v1", payload, signatures, entryDigest: sha(stable({ payload, signatures })) };
}
export function verifyReleaseTransparencyArtifact(artifact: ReleaseTransparencyArtifact, context: { trustCheckpoint: ReleaseTrustCheckpointArtifact; consistencyProof: ReleaseTrustConsistencyArtifact; consistencyCheckpoints: ReleaseTrustCheckpointArtifact[]; previousEntry?: ReleaseTransparencyArtifact | null; allowHistoricalTrustMismatch?: boolean }, env: EnvLike = process.env) {
  if (!context.allowHistoricalTrustMismatch && artifact.payload.trustCheckpointDigest !== context.trustCheckpoint.checkpointDigest) throw new Error("release_transparency_checkpoint_digest_mismatch");
  const rebuilt = buildAndVerifyReleaseTransparencyEntry({
    entryId: artifact.payload.entryId, environment: artifact.payload.environment, audience: artifact.payload.audience, sequence: artifact.payload.sequence, previousEntry: context.previousEntry ?? null,
    trustCheckpoint: context.trustCheckpoint, consistencyProof: context.consistencyProof, consistencyCheckpoints: context.consistencyCheckpoints,
    provenanceIndexDigest: artifact.payload.provenanceIndexDigest, proofPackageDigest: artifact.payload.proofPackageDigest, releaseCandidateAttestationDigest: artifact.payload.releaseCandidateAttestationDigest,
    sourceSha256: artifact.payload.sourceSha256, buildSha256: artifact.payload.buildSha256, exactCheckpoint: artifact.payload.exactCheckpoint,
    issuedAt: artifact.payload.issuedAt, expiresAt: artifact.payload.expiresAt, nonce: artifact.payload.nonce, signatures: artifact.signatures,
  }, { ...env, VELMERE_RELEASE_TRANSPARENCY_SIGNATURE_THRESHOLD: String(artifact.payload.signatureThreshold) }, artifact.payload.issuedAt);
  if (rebuilt.entryDigest !== artifact.entryDigest || rebuilt.payload.logRoot !== artifact.payload.logRoot || rebuilt.payload.entryLeafDigest !== artifact.payload.entryLeafDigest) throw new Error("release_transparency_artifact_digest_invalid");
  return true;
}
export async function recordReleaseTransparencyEntry(input: { request: ReleaseTransparencyRequest; env?: EnvLike; dependencies?: { rpc: RpcRunner; now: () => Date } }) {
  const dependencies = input.dependencies ?? { rpc: runRegisteredServiceRoleRpc, now: () => new Date() };
  const artifact = buildAndVerifyReleaseTransparencyEntry(input.request, input.env ?? process.env, dependencies.now().getTime());
  await dependencies.rpc({ operation: "release_transparency_record", args: { p_idempotency_key: sha(`${artifact.entryDigest}:${artifact.payload.nonce}`), p_entry_digest: artifact.entryDigest, p_environment: artifact.payload.environment, p_audience_hash: artifact.payload.audienceHash, p_sequence: artifact.payload.sequence, p_previous_entry_digest: artifact.payload.previousEntryDigest, p_previous_log_root: artifact.payload.previousLogRoot, p_trust_checkpoint_digest: artifact.payload.trustCheckpointDigest, p_consistency_proof_digest: artifact.payload.consistencyProofDigest, p_provenance_index_digest: artifact.payload.provenanceIndexDigest, p_proof_package_digest: artifact.payload.proofPackageDigest, p_candidate_attestation_digest: artifact.payload.releaseCandidateAttestationDigest, p_source_sha256: artifact.payload.sourceSha256, p_build_sha256: artifact.payload.buildSha256, p_exact_checkpoint: artifact.payload.exactCheckpoint, p_entry_leaf_digest: artifact.payload.entryLeafDigest, p_log_root: artifact.payload.logRoot, p_signature_count: artifact.signatures.length, p_signature_threshold: artifact.payload.signatureThreshold, p_entry_json: artifact, p_issued_at: new Date(artifact.payload.issuedAt).toISOString(), p_expires_at: new Date(artifact.payload.expiresAt).toISOString() } });
  const { data } = await dependencies.rpc({ operation: "release_transparency_verify", args: { p_entry_digest: artifact.entryDigest } });
  return { schemaVersion: "velmere.release-transparency-record.v1", ok: true, artifact, data, privacyBoundary: "public-hashes-signatures-no-private-keys-no-operator-data" };
}
export async function getPublicReleaseTransparencyEntries(input: { environment?: "staging" | "production"; limit?: number; dependencies?: { rpc: RpcRunner } }) {
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc; const limit = Math.max(1, Math.min(50, Number(input.limit ?? 10)));
  const { data } = await rpc({ operation: "release_transparency_public_feed", args: { p_environment: input.environment ?? null, p_limit: limit } });
  const rows = Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row))
    : [];
  return { schemaVersion: "velmere.public-release-transparency-log.v1", ok: true, entries: rows.map((r) => ({ entryDigest: clean(r.entry_digest), environment: clean(r.environment), sequence: Number(r.sequence), previousEntryDigest: r.previous_entry_digest ? clean(r.previous_entry_digest) : null, trustCheckpointDigest: clean(r.trust_checkpoint_digest), consistencyProofDigest: clean(r.consistency_proof_digest), provenanceIndexDigest: clean(r.provenance_index_digest), proofPackageDigest: clean(r.proof_package_digest), sourceSha256: clean(r.source_sha256), buildSha256: clean(r.build_sha256), exactCheckpoint: Number(r.exact_checkpoint), entryLeafDigest: clean(r.entry_leaf_digest), logRoot: clean(r.log_root), signatureCount: Number(r.signature_count), signatureThreshold: Number(r.signature_threshold), verifiedAt: r.verified_at ?? null })), privacyBoundary: "hashes-and-chain-metadata-only" };
}
