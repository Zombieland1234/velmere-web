import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import {
  runRegisteredServiceRoleRpc,
  type SupabaseRpcOperation,
} from "@/lib/db/supabase-rpc-operation-registry";
import type { ReleaseTransparencyCheckpointArtifact } from "@/lib/market-integrity/release-transparency-checkpoint";

export type ReleaseTransparencyWitnessKey = {
  witnessId: string;
  organization: string;
  publicKeyPem: string;
  status: "active" | "retiring" | "revoked";
  validFrom: number;
  validUntil?: number | null;
};

export type ReleaseTransparencyWitnessSignature = {
  witnessId: string;
  signature: string;
};

export type ReleaseTransparencyWitnessUnsigned = {
  quorumId: string;
  environment: "staging" | "production";
  audience: string;
  checkpoint: ReleaseTransparencyCheckpointArtifact;
  witnesses: ReleaseTransparencyWitnessKey[];
  threshold: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export type ReleaseTransparencyWitnessRequest = ReleaseTransparencyWitnessUnsigned & {
  signatures: ReleaseTransparencyWitnessSignature[];
};

export type ReleaseTransparencyWitnessArtifact = {
  schemaVersion: "velmere.release-transparency-witness-quorum.v1";
  payload: {
    quorumId: string;
    environment: "staging" | "production";
    audience: string;
    audienceHash: string;
    checkpointDigest: string;
    checkpointSequence: number;
    treeSize: number;
    entriesRoot: string;
    latestLogRoot: string;
    consistencyDigest: string;
    trustCheckpointDigest: string;
    witnessSetDigest: string;
    witnessOrganizations: string[];
    threshold: number;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
  };
  witnesses: Array<{
    witnessId: string;
    organizationHash: string;
    publicKeyFingerprint: string;
    status: "active" | "retiring";
    validFrom: number;
    validUntil: number | null;
  }>;
  signatures: ReleaseTransparencyWitnessSignature[];
  quorumDigest: string;
};

export type ReleaseTransparencySplitViewEvidence = {
  schemaVersion: "velmere.release-transparency-split-view-evidence.v1";
  environment: "staging" | "production";
  audienceHash: string;
  treeSize: number;
  leftCheckpointDigest: string;
  rightCheckpointDigest: string;
  leftEntriesRoot: string;
  rightEntriesRoot: string;
  leftQuorumDigest: string;
  rightQuorumDigest: string;
  evidenceDigest: string;
};

type EnvLike = Record<string, string | undefined>;
type RpcRunner = (input: {
  operation: SupabaseRpcOperation;
  args?: Record<string, unknown>;
}) => Promise<{ data: unknown }>;

const clean = (value: unknown) => String(value ?? "").trim();
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const isSha = (value: string) => /^[0-9a-f]{64}$/.test(value);
const stable = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
};
const safeId = (value: string, min = 6, max = 160) =>
  new RegExp(`^[A-Za-z0-9._:-]{${min},${max}}$`).test(value);

function publicKey(pem: string): KeyObject {
  const key = createPublicKey(clean(pem).replace(/\\n/g, "\n"));
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("release_transparency_witness_public_key_not_ed25519");
  }
  return key;
}

function privateKey(pem: string): KeyObject {
  const key = createPrivateKey(clean(pem).replace(/\\n/g, "\n"));
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("release_transparency_witness_private_key_not_ed25519");
  }
  return key;
}

function fingerprint(pem: string) {
  return sha(publicKey(pem).export({ type: "spki", format: "der" }) as Buffer);
}

function validateFresh(input: ReleaseTransparencyWitnessUnsigned, now: number) {
  if (
    !Number.isInteger(input.issuedAt) ||
    !Number.isInteger(input.expiresAt) ||
    input.issuedAt > now + 60_000 ||
    input.issuedAt < now - 5 * 60_000 ||
    input.expiresAt <= now ||
    input.expiresAt > input.issuedAt + 30 * 60_000
  ) {
    throw new Error("release_transparency_witness_freshness_invalid");
  }
  if (!safeId(clean(input.nonce), 8, 160)) {
    throw new Error("release_transparency_witness_nonce_invalid");
  }
}

function normalizeWitnesses(input: ReleaseTransparencyWitnessUnsigned) {
  if (!Array.isArray(input.witnesses) || input.witnesses.length < 2 || input.witnesses.length > 16) {
    throw new Error("release_transparency_witness_set_invalid");
  }
  if (!Number.isInteger(input.threshold) || input.threshold < 2 || input.threshold > 8) {
    throw new Error("release_transparency_witness_threshold_invalid");
  }
  const ids = new Set<string>();
  const organizations = new Set<string>();
  const normalized = input.witnesses.map((witness) => {
    const witnessId = clean(witness.witnessId);
    const organization = clean(witness.organization);
    if (!safeId(witnessId, 6, 96) || !safeId(organization.replace(/\//g, ":"), 3, 160)) {
      throw new Error("release_transparency_witness_identity_invalid");
    }
    if (ids.has(witnessId)) throw new Error("release_transparency_witness_duplicate_id");
    ids.add(witnessId);
    organizations.add(organization);
    if (witness.status === "revoked") {
      throw new Error("release_transparency_witness_revoked");
    }
    if (!Number.isInteger(witness.validFrom) || witness.validFrom > input.issuedAt) {
      throw new Error("release_transparency_witness_not_yet_valid");
    }
    if (witness.validUntil != null && (!Number.isInteger(witness.validUntil) || witness.validUntil < input.expiresAt)) {
      throw new Error("release_transparency_witness_expired");
    }
    return {
      witnessId,
      organization,
      organizationHash: sha(organization),
      publicKeyPem: clean(witness.publicKeyPem).replace(/\\n/g, "\n"),
      publicKeyFingerprint: fingerprint(witness.publicKeyPem),
      status: witness.status as "active" | "retiring",
      validFrom: witness.validFrom,
      validUntil: witness.validUntil ?? null,
    };
  });
  if (organizations.size < input.threshold) {
    throw new Error("release_transparency_witness_organization_threshold_not_met");
  }
  return normalized.sort((a, b) => a.witnessId.localeCompare(b.witnessId));
}

function canonicalPayload(input: ReleaseTransparencyWitnessUnsigned) {
  const quorumId = clean(input.quorumId);
  const audience = clean(input.audience);
  if (!safeId(quorumId, 8, 128) || !safeId(audience.replace(/\//g, ":"), 8, 160)) {
    throw new Error("release_transparency_witness_quorum_identity_invalid");
  }
  if (input.environment !== input.checkpoint.payload.environment || audience !== input.checkpoint.payload.audience) {
    throw new Error("release_transparency_witness_checkpoint_binding_mismatch");
  }
  if (!isSha(input.checkpoint.checkpointDigest)) {
    throw new Error("release_transparency_witness_checkpoint_digest_invalid");
  }
  const witnesses = normalizeWitnesses(input);
  const witnessSetDigest = sha(stable(witnesses.map((witness) => ({
    witnessId: witness.witnessId,
    organizationHash: witness.organizationHash,
    publicKeyFingerprint: witness.publicKeyFingerprint,
    status: witness.status,
    validFrom: witness.validFrom,
    validUntil: witness.validUntil,
  }))));
  return {
    quorumId,
    environment: input.environment,
    audience,
    audienceHash: sha(audience),
    checkpointDigest: input.checkpoint.checkpointDigest,
    checkpointSequence: input.checkpoint.payload.sequence,
    treeSize: input.checkpoint.payload.treeSize,
    entriesRoot: input.checkpoint.payload.entriesRoot,
    latestLogRoot: input.checkpoint.payload.latestLogRoot,
    consistencyDigest: input.checkpoint.payload.consistencyDigest,
    trustCheckpointDigest: input.checkpoint.payload.trustCheckpointDigest,
    witnessSetDigest,
    witnessOrganizations: [...new Set(witnesses.map((witness) => witness.organizationHash))].sort(),
    threshold: input.threshold,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    nonce: clean(input.nonce),
  };
}

export function signReleaseTransparencyWitnessStatement(
  input: ReleaseTransparencyWitnessUnsigned,
  witnessId: string,
  privateKeyPem: string,
): ReleaseTransparencyWitnessSignature {
  validateFresh(input, input.issuedAt);
  const payload = canonicalPayload(input);
  return {
    witnessId: clean(witnessId),
    signature: cryptoSign(null, Buffer.from(stable(payload)), privateKey(privateKeyPem)).toString("base64url"),
  };
}

export function buildAndVerifyReleaseTransparencyWitnessQuorum(
  input: ReleaseTransparencyWitnessRequest,
  now = Date.now(),
): ReleaseTransparencyWitnessArtifact {
  validateFresh(input, now);
  const payload = canonicalPayload(input);
  const witnesses = normalizeWitnesses(input);
  const witnessMap = new Map(witnesses.map((witness) => [witness.witnessId, witness]));
  if (!Array.isArray(input.signatures) || input.signatures.length < payload.threshold || input.signatures.length > 16) {
    throw new Error("release_transparency_witness_signature_threshold_not_met");
  }
  const seenWitnesses = new Set<string>();
  const seenOrganizations = new Set<string>();
  let active = 0;
  for (const signature of input.signatures) {
    const witnessId = clean(signature.witnessId);
    if (seenWitnesses.has(witnessId)) throw new Error("release_transparency_witness_signature_duplicate");
    seenWitnesses.add(witnessId);
    const witness = witnessMap.get(witnessId);
    if (!witness) throw new Error("release_transparency_witness_unknown_signer");
    if (seenOrganizations.has(witness.organizationHash)) {
      throw new Error("release_transparency_witness_organization_duplicate");
    }
    seenOrganizations.add(witness.organizationHash);
    if (witness.status === "active") active += 1;
    if (!cryptoVerify(null, Buffer.from(stable(payload)), publicKey(witness.publicKeyPem), Buffer.from(clean(signature.signature), "base64url"))) {
      throw new Error("release_transparency_witness_signature_invalid");
    }
  }
  if (seenOrganizations.size < payload.threshold) {
    throw new Error("release_transparency_witness_organization_threshold_not_met");
  }
  if (active < 1) throw new Error("release_transparency_witness_active_required");
  const publicWitnesses = witnesses.map((witness) => ({
    witnessId: witness.witnessId,
    organizationHash: witness.organizationHash,
    publicKeyFingerprint: witness.publicKeyFingerprint,
    status: witness.status,
    validFrom: witness.validFrom,
    validUntil: witness.validUntil,
  }));
  const signatures = input.signatures
    .map((signature) => ({ witnessId: clean(signature.witnessId), signature: clean(signature.signature) }))
    .sort((a, b) => a.witnessId.localeCompare(b.witnessId));
  return {
    schemaVersion: "velmere.release-transparency-witness-quorum.v1",
    payload,
    witnesses: publicWitnesses,
    signatures,
    quorumDigest: sha(stable({ payload, witnesses: publicWitnesses, signatures })),
  };
}

export function verifyReleaseTransparencyWitnessArtifact(
  artifact: ReleaseTransparencyWitnessArtifact,
  checkpoint: ReleaseTransparencyCheckpointArtifact,
  witnesses: ReleaseTransparencyWitnessKey[],
) {
  if (artifact.payload.checkpointDigest !== checkpoint.checkpointDigest) {
    throw new Error("release_transparency_witness_checkpoint_digest_mismatch");
  }
  const rebuilt = buildAndVerifyReleaseTransparencyWitnessQuorum({
    quorumId: artifact.payload.quorumId,
    environment: artifact.payload.environment,
    audience: artifact.payload.audience,
    checkpoint,
    witnesses,
    threshold: artifact.payload.threshold,
    issuedAt: artifact.payload.issuedAt,
    expiresAt: artifact.payload.expiresAt,
    nonce: artifact.payload.nonce,
    signatures: artifact.signatures,
  }, artifact.payload.issuedAt);
  if (
    rebuilt.quorumDigest !== artifact.quorumDigest ||
    rebuilt.payload.witnessSetDigest !== artifact.payload.witnessSetDigest ||
    stable(rebuilt.payload) !== stable(artifact.payload) ||
    stable(rebuilt.witnesses) !== stable(artifact.witnesses) ||
    stable(rebuilt.signatures) !== stable(artifact.signatures)
  ) {
    throw new Error("release_transparency_witness_artifact_digest_invalid");
  }
  return true;
}

export function detectReleaseTransparencySplitView(
  left: ReleaseTransparencyWitnessArtifact,
  right: ReleaseTransparencyWitnessArtifact,
): ReleaseTransparencySplitViewEvidence | null {
  if (
    left.payload.environment !== right.payload.environment ||
    left.payload.audienceHash !== right.payload.audienceHash ||
    left.payload.treeSize !== right.payload.treeSize
  ) {
    return null;
  }
  if (
    left.payload.checkpointDigest === right.payload.checkpointDigest &&
    left.payload.entriesRoot === right.payload.entriesRoot &&
    left.payload.latestLogRoot === right.payload.latestLogRoot
  ) {
    return null;
  }
  const evidence = {
    schemaVersion: "velmere.release-transparency-split-view-evidence.v1" as const,
    environment: left.payload.environment,
    audienceHash: left.payload.audienceHash,
    treeSize: left.payload.treeSize,
    leftCheckpointDigest: left.payload.checkpointDigest,
    rightCheckpointDigest: right.payload.checkpointDigest,
    leftEntriesRoot: left.payload.entriesRoot,
    rightEntriesRoot: right.payload.entriesRoot,
    leftQuorumDigest: left.quorumDigest,
    rightQuorumDigest: right.quorumDigest,
  };
  return { ...evidence, evidenceDigest: sha(stable(evidence)) };
}

export async function recordReleaseTransparencyWitnessQuorum(input: {
  request: ReleaseTransparencyWitnessRequest;
  dependencies?: { rpc: RpcRunner; now: () => Date };
}) {
  const dependencies = input.dependencies ?? { rpc: runRegisteredServiceRoleRpc, now: () => new Date() };
  const artifact = buildAndVerifyReleaseTransparencyWitnessQuorum(input.request, dependencies.now().getTime());
  await dependencies.rpc({
    operation: "release_transparency_witness_record",
    args: {
      p_idempotency_key: sha(`${artifact.quorumDigest}:${artifact.payload.nonce}`),
      p_quorum_digest: artifact.quorumDigest,
      p_environment: artifact.payload.environment,
      p_audience_hash: artifact.payload.audienceHash,
      p_checkpoint_digest: artifact.payload.checkpointDigest,
      p_checkpoint_sequence: artifact.payload.checkpointSequence,
      p_tree_size: artifact.payload.treeSize,
      p_entries_root: artifact.payload.entriesRoot,
      p_latest_log_root: artifact.payload.latestLogRoot,
      p_consistency_digest: artifact.payload.consistencyDigest,
      p_witness_set_digest: artifact.payload.witnessSetDigest,
      p_witness_count: artifact.signatures.length,
      p_organization_count: artifact.payload.witnessOrganizations.length,
      p_signature_threshold: artifact.payload.threshold,
      p_quorum_json: artifact,
      p_issued_at: new Date(artifact.payload.issuedAt).toISOString(),
      p_expires_at: new Date(artifact.payload.expiresAt).toISOString(),
    },
  });
  const { data } = await dependencies.rpc({
    operation: "release_transparency_witness_verify",
    args: { p_quorum_digest: artifact.quorumDigest },
  });
  return {
    schemaVersion: "velmere.release-transparency-witness-record.v1" as const,
    ok: true,
    artifact,
    data,
    privacyBoundary: "public-witness-fingerprints-and-checkpoint-hashes-only",
  };
}

export async function getPublicReleaseTransparencyWitnessQuorums(input: {
  environment?: "staging" | "production";
  limit?: number;
  dependencies?: { rpc: RpcRunner };
}) {
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const limit = Math.max(1, Math.min(50, Number(input.limit ?? 10)));
  const { data } = await rpc({
    operation: "release_transparency_witness_public_feed",
    args: { p_environment: input.environment ?? null, p_limit: limit },
  });
  const rows = Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row))
    : [];
  const quorums = rows.map((row) => ({
    quorumDigest: clean(row.quorum_digest),
    environment: clean(row.environment),
    checkpointDigest: clean(row.checkpoint_digest),
    checkpointSequence: Number(row.checkpoint_sequence),
    treeSize: Number(row.tree_size),
    entriesRoot: clean(row.entries_root),
    latestLogRoot: clean(row.latest_log_root),
    witnessSetDigest: clean(row.witness_set_digest),
    witnessCount: Number(row.witness_count),
    organizationCount: Number(row.organization_count),
    signatureThreshold: Number(row.signature_threshold),
    verifiedAt: row.verified_at ?? null,
  }));
  return {
    schemaVersion: "velmere.public-release-transparency-witness-quorums.v1" as const,
    ok: true,
    quorums,
    feedDigest: sha(stable(quorums)),
    privacyBoundary: "no-private-keys-no-raw-signatures-no-operator-data",
  };
}


export type ReleaseTransparencyWitnessPromotionGate = {
  schemaVersion: "velmere.release-transparency-witness-promotion-gate.v1";
  ready: boolean;
  required: true;
  state: "verified" | "consumed" | "missing" | "blocked";
  quorumDigest: string | null;
  checkpointDigest: string | null;
  provenanceIndexDigest: string | null;
  treeSize: number | null;
  organizationCount: number;
  signatureThreshold: number;
  expiresAt: string | null;
  blockers: string[];
  privacyBoundary: string;
};

export async function getReleaseTransparencyWitnessPromotionGate(input: {
  env?: EnvLike;
  expected: {
    provenanceIndexDigest?: string | null;
    sourceSha256?: string | null;
    buildSha256?: string | null;
    exactCheckpoint?: number | null;
  };
  dependencies?: { rpc: RpcRunner; now: () => Date };
}): Promise<ReleaseTransparencyWitnessPromotionGate> {
  const env = input.env ?? process.env;
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const now = input.dependencies?.now?.() ?? new Date();
  const quorumDigest = clean(env.VELMERE_RELEASE_TRANSPARENCY_WITNESS_QUORUM_DIGEST).toLowerCase();
  const environment = clean(env.VELMERE_DEPLOYMENT_ENVIRONMENT ?? env.VERCEL_ENV ?? "staging");
  const audience = clean(env.VELMERE_RELEASE_BUNDLE_AUDIENCE);
  const blockers: string[] = [];
  if (!isSha(quorumDigest)) blockers.push("release_transparency_witness_quorum_digest_missing_or_invalid");
  if (!['staging','production'].includes(environment)) blockers.push("release_transparency_witness_environment_invalid");
  if (!safeId(audience.replace(/\//g, ':'), 8, 160)) blockers.push("release_transparency_witness_audience_missing_or_invalid");
  if (!isSha(clean(input.expected.provenanceIndexDigest).toLowerCase())) blockers.push("release_transparency_witness_provenance_digest_missing_or_invalid");
  if (!isSha(clean(input.expected.sourceSha256).toLowerCase())) blockers.push("release_transparency_witness_source_digest_missing_or_invalid");
  if (!isSha(clean(input.expected.buildSha256).toLowerCase())) blockers.push("release_transparency_witness_build_digest_missing_or_invalid");
  if (!Number.isInteger(input.expected.exactCheckpoint) || Number(input.expected.exactCheckpoint) < 1) blockers.push("release_transparency_witness_checkpoint_number_invalid");
  if (blockers.length) return {
    schemaVersion: "velmere.release-transparency-witness-promotion-gate.v1", ready: false, required: true,
    state: "missing", quorumDigest: isSha(quorumDigest) ? quorumDigest : null, checkpointDigest: null,
    provenanceIndexDigest: null, treeSize: null, organizationCount: 0, signatureThreshold: 0, expiresAt: null,
    blockers, privacyBoundary: "Only hashes, counts, state and expiry are returned; witness signatures, public keys and operator data are omitted.",
  };
  const { data } = await rpc({ operation: "release_transparency_witness_status", args: { p_quorum_digest: quorumDigest } });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') blockers.push("release_transparency_witness_quorum_not_found");
  const value = (row ?? {}) as Record<string, unknown>;
  const state = clean(value.state);
  const expiresAt = clean(value.expires_at);
  const rowEnvironment = clean(value.environment);
  const audienceHash = clean(value.audience_hash);
  const checkpointDigest = clean(value.checkpoint_digest);
  const provenanceIndexDigest = clean(value.provenance_index_digest);
  const sourceSha256 = clean(value.source_sha256);
  const buildSha256 = clean(value.build_sha256);
  const exactCheckpoint = Number(value.exact_checkpoint);
  const organizationCount = Number(value.organization_count ?? 0);
  const signatureThreshold = Number(value.signature_threshold ?? 0);
  const witnessCount = Number(value.witness_count ?? 0);
  if (state !== 'verified') blockers.push(state === 'consumed' ? "release_transparency_witness_quorum_already_consumed" : "release_transparency_witness_quorum_not_verified");
  if (!expiresAt || Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now.getTime()) blockers.push("release_transparency_witness_quorum_expired");
  if (rowEnvironment !== environment || audienceHash !== sha(audience)) blockers.push("release_transparency_witness_environment_binding_mismatch");
  if (provenanceIndexDigest !== clean(input.expected.provenanceIndexDigest).toLowerCase()) blockers.push("release_transparency_witness_provenance_binding_mismatch");
  if (sourceSha256 !== clean(input.expected.sourceSha256).toLowerCase() || buildSha256 !== clean(input.expected.buildSha256).toLowerCase() || exactCheckpoint !== Number(input.expected.exactCheckpoint)) blockers.push("release_transparency_witness_exact_release_mismatch");
  if (organizationCount < 2 || signatureThreshold < 2 || organizationCount < signatureThreshold || witnessCount < signatureThreshold) blockers.push("release_transparency_witness_threshold_not_met");
  return {
    schemaVersion: "velmere.release-transparency-witness-promotion-gate.v1", ready: blockers.length === 0, required: true,
    state: state === 'verified' ? 'verified' : state === 'consumed' ? 'consumed' : state ? 'blocked' : 'missing',
    quorumDigest, checkpointDigest: isSha(checkpointDigest) ? checkpointDigest : null,
    provenanceIndexDigest: isSha(provenanceIndexDigest) ? provenanceIndexDigest : null,
    treeSize: Number.isInteger(Number(value.tree_size)) ? Number(value.tree_size) : null,
    organizationCount, signatureThreshold, expiresAt: expiresAt || null, blockers,
    privacyBoundary: "Only hashes, counts, state and expiry are returned; witness signatures, public keys and operator data are omitted.",
  };
}
