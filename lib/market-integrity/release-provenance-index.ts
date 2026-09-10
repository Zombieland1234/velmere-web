import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";

export type ReleaseProvenanceEntry = {
  path: string;
  sha256: string;
  sizeBytes: number;
  mediaType: string;
};
export type ReleaseProvenanceSignature = { keyId: string; signature: string };
export type ReleaseProvenanceIndexRequest = {
  indexId: string;
  environment: "staging" | "production";
  audience: string;
  candidateAttestationDigest: string;
  releaseBundleDigest: string;
  sourceSha256: string;
  buildSha256: string;
  buildId: string;
  exactCheckpoint: number;
  sequence: number;
  previousIndexDigest?: string | null;
  entries: ReleaseProvenanceEntry[];
  operatorId: string;
  reason: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  signatures: ReleaseProvenanceSignature[];
};
export type ReleaseProvenanceIndexArtifact = {
  schemaVersion: "velmere.release-provenance-index.v1";
  payload: {
    indexId: string;
    environment: "staging" | "production";
    audienceHash: string;
    candidateAttestationDigest: string;
    releaseBundleDigest: string;
    sourceSha256: string;
    buildSha256: string;
    buildIdHash: string;
    exactCheckpoint: number;
    sequence: number;
    previousIndexDigest: string | null;
    entries: ReleaseProvenanceEntry[];
    artifactsRoot: string;
    chainRoot: string;
    signerSetDigest: string;
    threshold: number;
    operatorHash: string;
    reasonHash: string;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
  };
  signatures: ReleaseProvenanceSignature[];
  indexDigest: string;
};
export type ReleaseProvenanceIndexGate = {
  schemaVersion: "velmere.release-provenance-index-gate.v1";
  ready: boolean;
  required: boolean;
  state: "not_required" | "missing" | "verified" | "consumed" | "expired" | "revoked" | "blocked" | "store_failed";
  indexDigest: string | null;
  candidateAttestationDigest: string | null;
  artifactsRoot: string | null;
  signerSetDigest: string | null;
  signatureCount: number;
  threshold: number;
  sequence: number | null;
  expiresAt: string | null;
  blockers: string[];
  privacyBoundary: string;
};

type EnvLike = Record<string, string | undefined>;
type RpcRunner = (input: { operation: SupabaseRpcOperation; args?: Record<string, unknown> }) => Promise<{ data: unknown }>;
type KeyStatus = "active" | "retiring" | "revoked";
type KeyRecord = { publicKeyPem: string; status: KeyStatus; notBefore?: number; notAfter?: number };

const clean = (value: unknown) => String(value ?? "").trim();
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const isSha = (value: string) => /^[0-9a-f]{64}$/.test(value);
const safeId = (value: string, min = 4, max = 128) => new RegExp(`^[A-Za-z0-9._:-]{${min},${max}}$`).test(value);
const safePath = (value: string) => value.length >= 1 && value.length <= 240 && !value.startsWith("/") && !value.includes("..") && /^[A-Za-z0-9._/@+-]+$/.test(value);
const safeMedia = (value: string) => /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(value) && value.length <= 96;
const row = (data: unknown): Record<string, unknown> | null => Array.isArray(data)
  ? (data.find((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) ?? null)
  : data && typeof data === "object" ? data as Record<string, unknown> : null;
function normalizePem(value: string) { return clean(value).replace(/\\n/g, "\n"); }
function publicKey(value: string): KeyObject {
  const key = createPublicKey(normalizePem(value));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("release_provenance_public_key_not_ed25519");
  return key;
}
function privateKey(value: string): KeyObject {
  const key = createPrivateKey(normalizePem(value));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("release_provenance_private_key_not_ed25519");
  return key;
}
function parseRegistry(env: EnvLike): Record<string, KeyRecord> {
  const raw = clean(env.VELMERE_RELEASE_PROVENANCE_PUBLIC_KEYS_JSON);
  if (!raw) throw new Error("release_provenance_public_key_registry_missing");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("release_provenance_public_key_registry_invalid"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("release_provenance_public_key_registry_invalid");
  const result: Record<string, KeyRecord> = {};
  for (const [keyId, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!safeId(keyId, 4, 96) || !value || typeof value !== "object") throw new Error("release_provenance_public_key_registry_invalid");
    const item = value as Record<string, unknown>;
    const status = clean(item.status) as KeyStatus;
    if (!(["active", "retiring", "revoked"] as string[]).includes(status)) throw new Error("release_provenance_key_status_invalid");
    const publicKeyPem = normalizePem(clean(item.publicKeyPem));
    publicKey(publicKeyPem);
    const notBefore = item.notBefore === undefined ? undefined : Number(item.notBefore);
    const notAfter = item.notAfter === undefined ? undefined : Number(item.notAfter);
    if (notBefore !== undefined && !Number.isInteger(notBefore)) throw new Error("release_provenance_key_window_invalid");
    if (notAfter !== undefined && !Number.isInteger(notAfter)) throw new Error("release_provenance_key_window_invalid");
    result[keyId] = { publicKeyPem, status, notBefore, notAfter };
  }
  return result;
}
function threshold(env: EnvLike) {
  const parsed = Number(env.VELMERE_RELEASE_PROVENANCE_SIGNATURE_THRESHOLD ?? "2");
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 5) throw new Error("release_provenance_threshold_invalid");
  return parsed;
}
function normalizeEntries(entries: ReleaseProvenanceEntry[]) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 128) throw new Error("release_provenance_entries_invalid");
  const normalized = entries.map((entry) => ({
    path: clean(entry.path),
    sha256: clean(entry.sha256).toLowerCase(),
    sizeBytes: Number(entry.sizeBytes),
    mediaType: clean(entry.mediaType).toLowerCase(),
  }));
  const seen = new Set<string>();
  for (const entry of normalized) {
    if (!safePath(entry.path) || !isSha(entry.sha256) || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 0 || entry.sizeBytes > 2_147_483_647 || !safeMedia(entry.mediaType)) throw new Error("release_provenance_entry_invalid");
    if (seen.has(entry.path)) throw new Error("release_provenance_entry_duplicate");
    seen.add(entry.path);
  }
  return normalized.sort((a, b) => a.path.localeCompare(b.path));
}
function artifactsRoot(entries: ReleaseProvenanceEntry[]) {
  const leaves = entries.map((entry) => sha(JSON.stringify({ path: entry.path, sha256: entry.sha256, sizeBytes: entry.sizeBytes, mediaType: entry.mediaType })));
  return sha(JSON.stringify({ schemaVersion: "velmere.release-provenance-artifacts-root.v1", leaves }));
}
function signerSetDigest(signatures: ReleaseProvenanceSignature[]) {
  return sha(JSON.stringify(signatures.map((item) => item.keyId).sort()));
}
function canonicalPayload(input: Omit<ReleaseProvenanceIndexRequest, "signatures">, signatureThreshold: number) {
  const entries = normalizeEntries(input.entries);
  const payload = {
    schemaVersion: "velmere.release-provenance-index.v1",
    indexId: clean(input.indexId),
    environment: input.environment,
    audienceHash: sha(clean(input.audience)),
    candidateAttestationDigest: clean(input.candidateAttestationDigest).toLowerCase(),
    releaseBundleDigest: clean(input.releaseBundleDigest).toLowerCase(),
    sourceSha256: clean(input.sourceSha256).toLowerCase(),
    buildSha256: clean(input.buildSha256).toLowerCase(),
    buildIdHash: sha(clean(input.buildId)),
    exactCheckpoint: Number(input.exactCheckpoint),
    sequence: Number(input.sequence),
    previousIndexDigest: input.previousIndexDigest ? clean(input.previousIndexDigest).toLowerCase() : null,
    entries,
    artifactsRoot: artifactsRoot(entries),
    threshold: signatureThreshold,
    operatorHash: sha(clean(input.operatorId)),
    reasonHash: sha(clean(input.reason)),
    issuedAt: Number(input.issuedAt),
    expiresAt: Number(input.expiresAt),
    nonce: clean(input.nonce),
  };
  const chainRoot = sha(JSON.stringify({ schemaVersion: "velmere.release-provenance-chain-root.v1", previousIndexDigest: payload.previousIndexDigest, sequence: payload.sequence, artifactsRoot: payload.artifactsRoot, candidateAttestationDigest: payload.candidateAttestationDigest }));
  return { ...payload, chainRoot };
}
function validateUnsigned(input: Omit<ReleaseProvenanceIndexRequest, "signatures">, now: number) {
  if (!safeId(clean(input.indexId), 8, 128)) throw new Error("release_provenance_index_id_invalid");
  if (!(input.environment === "staging" || input.environment === "production")) throw new Error("release_provenance_environment_invalid");
  if (!safeId(clean(input.audience).replace(/\//g, ":"), 8, 160)) throw new Error("release_provenance_audience_invalid");
  for (const value of [input.candidateAttestationDigest, input.releaseBundleDigest, input.sourceSha256, input.buildSha256]) if (!isSha(clean(value).toLowerCase())) throw new Error("release_provenance_digest_invalid");
  if (!safeId(clean(input.buildId), 8, 128)) throw new Error("release_provenance_build_id_invalid");
  if (!Number.isInteger(input.exactCheckpoint) || input.exactCheckpoint < 4725) throw new Error("release_provenance_checkpoint_invalid");
  if (!Number.isInteger(input.sequence) || input.sequence < 1) throw new Error("release_provenance_sequence_invalid");
  const previous = input.previousIndexDigest ? clean(input.previousIndexDigest).toLowerCase() : null;
  if ((input.sequence === 1 && previous) || (input.sequence > 1 && !isSha(previous ?? ""))) throw new Error("release_provenance_chain_invalid");
  if (!safeId(clean(input.operatorId), 8, 128) || clean(input.reason).length < 12 || clean(input.reason).length > 512) throw new Error("release_provenance_operator_invalid");
  if (!Number.isInteger(input.issuedAt) || !Number.isInteger(input.expiresAt) || input.issuedAt > now + 60_000 || input.issuedAt < now - 5 * 60_000 || input.expiresAt <= now || input.expiresAt > input.issuedAt + 30 * 60_000) throw new Error("release_provenance_freshness_invalid");
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(clean(input.nonce))) throw new Error("release_provenance_nonce_invalid");
  normalizeEntries(input.entries);
}
export function signReleaseProvenanceIndex(input: Omit<ReleaseProvenanceIndexRequest, "signatures">, keyId: string, privateKeyPem: string, signatureThreshold = 2): ReleaseProvenanceSignature {
  if (!safeId(keyId, 4, 96)) throw new Error("release_provenance_key_id_invalid");
  const payload = canonicalPayload(input, signatureThreshold);
  return { keyId, signature: cryptoSign(null, Buffer.from(JSON.stringify(payload)), privateKey(privateKeyPem)).toString("base64url") };
}
export function buildAndVerifyReleaseProvenanceIndex(input: ReleaseProvenanceIndexRequest, env: EnvLike = process.env, now = Date.now()): ReleaseProvenanceIndexArtifact {
  const unsigned = { ...input } as ReleaseProvenanceIndexRequest;
  delete (unsigned as Partial<ReleaseProvenanceIndexRequest>).signatures;
  validateUnsigned(unsigned, now);
  const boundEnvironment = clean(env.VELMERE_DEPLOYMENT_ENVIRONMENT || env.VERCEL_ENV || "staging").toLowerCase();
  const boundAudience = clean(env.VELMERE_RELEASE_PROVENANCE_AUDIENCE || env.VELMERE_RELEASE_CANDIDATE_AUDIENCE || env.VELMERE_RELEASE_BUNDLE_AUDIENCE);
  if (boundEnvironment !== input.environment) throw new Error("release_provenance_environment_binding_mismatch");
  if (!boundAudience || boundAudience !== input.audience) throw new Error("release_provenance_audience_binding_mismatch");
  const required = threshold(env);
  const registry = parseRegistry(env);
  if (!Array.isArray(input.signatures) || input.signatures.length < required || input.signatures.length > 8) throw new Error("release_provenance_signature_threshold_not_met");
  const keyIds = new Set<string>();
  let active = 0;
  const payloadBase = canonicalPayload(unsigned, required);
  for (const signature of input.signatures) {
    const keyId = clean(signature.keyId);
    if (!safeId(keyId, 4, 96) || keyIds.has(keyId)) throw new Error("release_provenance_signature_duplicate");
    keyIds.add(keyId);
    const record = registry[keyId];
    if (!record) throw new Error("release_provenance_signer_unknown");
    if (record.status === "revoked") throw new Error("release_provenance_signer_revoked");
    if (record.notBefore !== undefined && input.issuedAt < record.notBefore) throw new Error("release_provenance_signer_not_yet_valid");
    if (record.notAfter !== undefined && input.issuedAt > record.notAfter) throw new Error("release_provenance_signer_expired");
    if (record.status === "active") active += 1;
    const ok = cryptoVerify(null, Buffer.from(JSON.stringify(payloadBase)), publicKey(record.publicKeyPem), Buffer.from(clean(signature.signature), "base64url"));
    if (!ok) throw new Error("release_provenance_signature_invalid");
  }
  if (active < 1) throw new Error("release_provenance_active_signer_required");
  const signatures = input.signatures.map((item) => ({ keyId: clean(item.keyId), signature: clean(item.signature) })).sort((a, b) => a.keyId.localeCompare(b.keyId));
  const payload = { ...payloadBase, signerSetDigest: signerSetDigest(signatures) };
  return { schemaVersion: "velmere.release-provenance-index.v1", payload, signatures, indexDigest: sha(JSON.stringify({ payload, signatures })) };
}
export async function recordReleaseProvenanceIndex(input: { request: ReleaseProvenanceIndexRequest; env?: EnvLike; dependencies?: { rpc: RpcRunner; now: () => Date } }) {
  const env = input.env ?? process.env;
  const deps = input.dependencies ?? { rpc: runRegisteredServiceRoleRpc, now: () => new Date() };
  const artifact = buildAndVerifyReleaseProvenanceIndex(input.request, env, deps.now().getTime());
  const { data } = await deps.rpc({ operation: "release_provenance_index_record", args: {
    p_idempotency_key: sha(`${artifact.indexDigest}:${artifact.payload.nonce}`), p_index_id_hash: sha(artifact.payload.indexId), p_environment: artifact.payload.environment,
    p_audience_hash: artifact.payload.audienceHash, p_candidate_attestation_digest: artifact.payload.candidateAttestationDigest, p_release_bundle_digest: artifact.payload.releaseBundleDigest,
    p_source_sha256: artifact.payload.sourceSha256, p_build_sha256: artifact.payload.buildSha256, p_build_id_hash: artifact.payload.buildIdHash, p_exact_checkpoint: artifact.payload.exactCheckpoint,
    p_sequence: artifact.payload.sequence, p_previous_index_digest: artifact.payload.previousIndexDigest, p_artifacts_root: artifact.payload.artifactsRoot, p_chain_root: artifact.payload.chainRoot,
    p_signer_set_digest: artifact.payload.signerSetDigest, p_signature_count: artifact.signatures.length, p_signature_threshold: artifact.payload.threshold, p_index_digest: artifact.indexDigest,
    p_operator_hash: artifact.payload.operatorHash, p_reason_hash: artifact.payload.reasonHash, p_issued_at: new Date(artifact.payload.issuedAt).toISOString(), p_expires_at: new Date(artifact.payload.expiresAt).toISOString(),
  }});
  const stored = row(data);
  if (!stored) throw new Error("release_provenance_record_empty");
  const verified = await deps.rpc({ operation: "release_provenance_index_verify", args: { p_index_digest: artifact.indexDigest } });
  const status = row(verified.data);
  return { schemaVersion: "velmere.release-provenance-index-record.v1" as const, ok: String(status?.state ?? stored.state) === "verified", state: String(status?.state ?? stored.state ?? "blocked"), indexDigest: artifact.indexDigest, artifactsRoot: artifact.payload.artifactsRoot, chainRoot: artifact.payload.chainRoot, signerSetDigest: artifact.payload.signerSetDigest, signatureCount: artifact.signatures.length, threshold: artifact.payload.threshold, sequence: artifact.payload.sequence, privacyBoundary: "Only hashes, counts, sequence and aggregate signer metadata are returned. Paths, signatures, operator identity, reason and key material are omitted." };
}
export async function getReleaseProvenanceIndexGate(input: { env?: EnvLike; expected?: Partial<{ candidateAttestationDigest: string; releaseBundleDigest: string; sourceSha256: string; buildSha256: string; exactCheckpoint: number }>; dependencies?: { rpc: RpcRunner } } = {}): Promise<ReleaseProvenanceIndexGate> {
  const env = input.env ?? process.env;
  const required = clean(env.VELMERE_RELEASE_PROVENANCE_REQUIRED).toLowerCase() !== "false";
  if (!required) return { schemaVersion: "velmere.release-provenance-index-gate.v1", ready: true, required: false, state: "not_required", indexDigest: null, candidateAttestationDigest: null, artifactsRoot: null, signerSetDigest: null, signatureCount: 0, threshold: 0, sequence: null, expiresAt: null, blockers: [], privacyBoundary: "aggregate" };
  try {
    const deps = input.dependencies ?? { rpc: runRegisteredServiceRoleRpc };
    const { data } = await deps.rpc({ operation: "release_provenance_index_status", args: { p_candidate_attestation_digest: input.expected?.candidateAttestationDigest ?? null } });
    const value = row(data);
    if (!value) throw new Error("release_provenance_status_empty");
    const state = clean(value.state) as ReleaseProvenanceIndexGate["state"];
    const blockers: string[] = [];
    const compare = (column: string, expected?: string) => { if (expected && clean(value[column]).toLowerCase() !== expected.toLowerCase()) blockers.push(`release_provenance_${column}_mismatch`); };
    compare("candidate_attestation_digest", input.expected?.candidateAttestationDigest); compare("release_bundle_digest", input.expected?.releaseBundleDigest); compare("source_sha256", input.expected?.sourceSha256); compare("build_sha256", input.expected?.buildSha256);
    if (input.expected?.exactCheckpoint && Number(value.exact_checkpoint) !== input.expected.exactCheckpoint) blockers.push("release_provenance_exact_checkpoint_mismatch");
    const count = Number(value.signature_count ?? 0), requiredThreshold = Number(value.signature_threshold ?? 0);
    if (count < requiredThreshold || requiredThreshold < 2) blockers.push("release_provenance_signature_threshold_not_met");
    if (state !== "verified") blockers.push(`release_provenance_${state || "missing"}`);
    return { schemaVersion: "velmere.release-provenance-index-gate.v1", ready: blockers.length === 0, required: true, state: state || "missing", indexDigest: isSha(clean(value.index_digest)) ? clean(value.index_digest) : null, candidateAttestationDigest: isSha(clean(value.candidate_attestation_digest)) ? clean(value.candidate_attestation_digest) : null, artifactsRoot: isSha(clean(value.artifacts_root)) ? clean(value.artifacts_root) : null, signerSetDigest: isSha(clean(value.signer_set_digest)) ? clean(value.signer_set_digest) : null, signatureCount: count, threshold: requiredThreshold, sequence: Number.isInteger(Number(value.sequence)) ? Number(value.sequence) : null, expiresAt: value.expires_at ? String(value.expires_at) : null, blockers, privacyBoundary: "Only aggregate provenance state and digests are returned." };
  } catch {
    return { schemaVersion: "velmere.release-provenance-index-gate.v1", ready: false, required: true, state: "store_failed", indexDigest: null, candidateAttestationDigest: null, artifactsRoot: null, signerSetDigest: null, signatureCount: 0, threshold: threshold(env), sequence: null, expiresAt: null, blockers: ["release_provenance_store_unavailable"], privacyBoundary: "aggregate" };
  }
}

export type PublicReleaseProvenanceFeedItem = {
  indexDigest: string;
  environment: "staging" | "production";
  sequence: number;
  previousIndexDigest: string | null;
  artifactsRoot: string;
  chainRoot: string;
  signerSetDigest: string;
  signatureCount: number;
  signatureThreshold: number;
  exactCheckpoint: number;
  verifiedAt: string | null;
  consumedAt: string | null;
};

export async function getPublicReleaseProvenanceFeed(input: {
  limit?: number;
  environment?: "staging" | "production";
  dependencies?: { rpc: RpcRunner };
} = {}): Promise<{
  schemaVersion: "velmere.public-release-provenance-feed.v1";
  ok: boolean;
  items: PublicReleaseProvenanceFeedItem[];
  feedDigest: string;
  privacyBoundary: string;
}> {
  const dependencies = input.dependencies ?? { rpc: runRegisteredServiceRoleRpc };
  const limit = Math.max(1, Math.min(50, Math.trunc(input.limit ?? 20)));
  const environment = input.environment;
  if (environment && environment !== "staging" && environment !== "production") {
    throw new Error("release_provenance_feed_environment_invalid");
  }
  const { data } = await dependencies.rpc({
    operation: "release_provenance_public_feed",
    args: {
      p_environment: environment ?? null,
      p_limit: limit,
    },
  });
  const rows = Array.isArray(data) ? data : [];
  const items = rows.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const indexDigest = clean(value.index_digest).toLowerCase();
    const env = clean(value.environment);
    const artifacts = clean(value.artifacts_root).toLowerCase();
    const chain = clean(value.chain_root).toLowerCase();
    const signers = clean(value.signer_set_digest).toLowerCase();
    const previous = clean(value.previous_index_digest).toLowerCase();
    const sequence = Number(value.sequence);
    const signatureCount = Number(value.signature_count);
    const signatureThreshold = Number(value.signature_threshold);
    const exactCheckpoint = Number(value.exact_checkpoint);
    if (
      !isSha(indexDigest) ||
      !(env === "staging" || env === "production") ||
      !isSha(artifacts) ||
      !isSha(chain) ||
      !isSha(signers) ||
      (previous && !isSha(previous)) ||
      !Number.isInteger(sequence) ||
      sequence < 1 ||
      !Number.isInteger(signatureCount) ||
      !Number.isInteger(signatureThreshold) ||
      signatureCount < signatureThreshold ||
      signatureThreshold < 2 ||
      !Number.isInteger(exactCheckpoint)
    ) return [];
    return [{
      indexDigest,
      environment: env,
      sequence,
      previousIndexDigest: previous || null,
      artifactsRoot: artifacts,
      chainRoot: chain,
      signerSetDigest: signers,
      signatureCount,
      signatureThreshold,
      exactCheckpoint,
      verifiedAt: value.verified_at ? String(value.verified_at) : null,
      consumedAt: value.consumed_at ? String(value.consumed_at) : null,
    } satisfies PublicReleaseProvenanceFeedItem];
  });
  const feedDigest = sha(JSON.stringify({
    schemaVersion: "velmere.public-release-provenance-feed.v1",
    items,
  }));
  return {
    schemaVersion: "velmere.public-release-provenance-feed.v1",
    ok: true,
    items,
    feedDigest,
    privacyBoundary:
      "Public feed exposes only release hashes, sequence, threshold counts, checkpoint and verification timestamps. Artifact paths, signatures, operator identity, reasons, key material and customer data are omitted.",
  };
}
