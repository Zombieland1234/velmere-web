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
import type { ReleaseTransparencyArtifact } from "@/lib/market-integrity/release-transparency-log";
import type { ReleaseTrustCheckpointArtifact } from "@/lib/market-integrity/release-trust-checkpoint";

export type ReleaseTransparencyCheckpointEntry = {
  sequence: number;
  entryDigest: string;
  entryLeafDigest: string;
  logRoot: string;
  trustCheckpointDigest: string;
  consistencyProofDigest: string;
  provenanceIndexDigest: string;
  proofPackageDigest: string;
  sourceSha256: string;
  buildSha256: string;
  exactCheckpoint: number;
};

export type ReleaseTransparencyCheckpointSignature = { keyId: string; signature: string };

export type ReleaseTransparencyCheckpointUnsigned = {
  checkpointId: string;
  environment: "staging" | "production";
  audience: string;
  sequence: number;
  previousCheckpoint?: ReleaseTransparencyCheckpointArtifact | null;
  entries: ReleaseTransparencyCheckpointEntry[];
  trustCheckpoint: ReleaseTrustCheckpointArtifact;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export type ReleaseTransparencyCheckpointRequest = ReleaseTransparencyCheckpointUnsigned & {
  signatures: ReleaseTransparencyCheckpointSignature[];
};

export type ReleaseTransparencyCheckpointArtifact = {
  schemaVersion: "velmere.release-transparency-checkpoint.v1";
  payload: {
    checkpointId: string;
    environment: "staging" | "production";
    audience: string;
    audienceHash: string;
    sequence: number;
    previousCheckpointDigest: string | null;
    previousTreeSize: number;
    previousEntriesRoot: string | null;
    treeSize: number;
    firstEntrySequence: number;
    lastEntrySequence: number;
    firstEntryDigest: string;
    lastEntryDigest: string;
    latestLogRoot: string;
    entriesRoot: string;
    consistencyDigest: string;
    trustCheckpointDigest: string;
    trustEpoch: number;
    signatureThreshold: number;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
  };
  entries: ReleaseTransparencyCheckpointEntry[];
  signatures: ReleaseTransparencyCheckpointSignature[];
  checkpointDigest: string;
};

export type ReleaseTransparencyInclusionProof = {
  schemaVersion: "velmere.release-transparency-inclusion-proof.v1";
  checkpointDigest: string;
  entriesRoot: string;
  treeSize: number;
  leafIndex: number;
  entry: ReleaseTransparencyCheckpointEntry;
  leafDigest: string;
  siblings: Array<{ side: "left" | "right"; digest: string }>;
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
    throw new Error("release_transparency_checkpoint_public_key_not_ed25519");
  }
  return key;
}
function privateKey(pem: string): KeyObject {
  const key = createPrivateKey(clean(pem).replace(/\\n/g, "\n"));
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("release_transparency_checkpoint_private_key_not_ed25519");
  }
  return key;
}
function threshold(env: EnvLike) {
  const value = Number(
    env.VELMERE_RELEASE_TRANSPARENCY_CHECKPOINT_SIGNATURE_THRESHOLD ??
      env.VELMERE_RELEASE_TRANSPARENCY_SIGNATURE_THRESHOLD ??
      env.VELMERE_RELEASE_TRUST_SIGNATURE_THRESHOLD ??
      "2",
  );
  if (!Number.isInteger(value) || value < 2 || value > 5) {
    throw new Error("release_transparency_checkpoint_threshold_invalid");
  }
  return value;
}
function normalizeEntry(entry: ReleaseTransparencyCheckpointEntry): ReleaseTransparencyCheckpointEntry {
  if (!Number.isInteger(entry.sequence) || entry.sequence < 1) {
    throw new Error("release_transparency_checkpoint_entry_sequence_invalid");
  }
  for (const digest of [
    entry.entryDigest,
    entry.entryLeafDigest,
    entry.logRoot,
    entry.trustCheckpointDigest,
    entry.consistencyProofDigest,
    entry.provenanceIndexDigest,
    entry.proofPackageDigest,
    entry.sourceSha256,
    entry.buildSha256,
  ]) {
    if (!isSha(clean(digest).toLowerCase())) {
      throw new Error("release_transparency_checkpoint_entry_digest_invalid");
    }
  }
  if (!Number.isInteger(entry.exactCheckpoint) || entry.exactCheckpoint < 1) {
    throw new Error("release_transparency_checkpoint_exact_checkpoint_invalid");
  }
  return {
    sequence: entry.sequence,
    entryDigest: clean(entry.entryDigest).toLowerCase(),
    entryLeafDigest: clean(entry.entryLeafDigest).toLowerCase(),
    logRoot: clean(entry.logRoot).toLowerCase(),
    trustCheckpointDigest: clean(entry.trustCheckpointDigest).toLowerCase(),
    consistencyProofDigest: clean(entry.consistencyProofDigest).toLowerCase(),
    provenanceIndexDigest: clean(entry.provenanceIndexDigest).toLowerCase(),
    proofPackageDigest: clean(entry.proofPackageDigest).toLowerCase(),
    sourceSha256: clean(entry.sourceSha256).toLowerCase(),
    buildSha256: clean(entry.buildSha256).toLowerCase(),
    exactCheckpoint: entry.exactCheckpoint,
  };
}
export function summarizeReleaseTransparencyArtifact(
  artifact: ReleaseTransparencyArtifact,
): ReleaseTransparencyCheckpointEntry {
  return normalizeEntry({
    sequence: artifact.payload.sequence,
    entryDigest: artifact.entryDigest,
    entryLeafDigest: artifact.payload.entryLeafDigest,
    logRoot: artifact.payload.logRoot,
    trustCheckpointDigest: artifact.payload.trustCheckpointDigest,
    consistencyProofDigest: artifact.payload.consistencyProofDigest,
    provenanceIndexDigest: artifact.payload.provenanceIndexDigest,
    proofPackageDigest: artifact.payload.proofPackageDigest,
    sourceSha256: artifact.payload.sourceSha256,
    buildSha256: artifact.payload.buildSha256,
    exactCheckpoint: artifact.payload.exactCheckpoint,
  });
}
function entryLeaf(entry: ReleaseTransparencyCheckpointEntry) {
  return sha(stable({ schemaVersion: "velmere.release-transparency-checkpoint-leaf.v1", entry }));
}
function parent(left: string, right: string) {
  return sha(stable({ schemaVersion: "velmere.release-transparency-merkle-node.v1", left, right }));
}
function merkleRoot(entries: ReleaseTransparencyCheckpointEntry[]) {
  if (entries.length === 0) throw new Error("release_transparency_checkpoint_entries_empty");
  let level = entries.map(entryLeaf);
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(parent(left, right));
    }
    level = next;
  }
  return level[0];
}
function validateEntries(entries: ReleaseTransparencyCheckpointEntry[]) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 4096) {
    throw new Error("release_transparency_checkpoint_entries_invalid");
  }
  const normalized = entries.map(normalizeEntry).sort((a, b) => a.sequence - b.sequence);
  if (normalized[0].sequence !== 1) {
    throw new Error("release_transparency_checkpoint_genesis_missing");
  }
  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index].sequence !== index + 1) {
      throw new Error("release_transparency_checkpoint_sequence_gap");
    }
    if (index > 0 && normalized[index].logRoot === normalized[index - 1].logRoot) {
      throw new Error("release_transparency_checkpoint_log_root_reused");
    }
  }
  if (new Set(normalized.map((entry) => entry.entryDigest)).size !== normalized.length) {
    throw new Error("release_transparency_checkpoint_entry_duplicate");
  }
  return normalized;
}
function validateFresh(input: ReleaseTransparencyCheckpointUnsigned, now: number) {
  if (
    !Number.isInteger(input.issuedAt) ||
    !Number.isInteger(input.expiresAt) ||
    input.issuedAt > now + 60_000 ||
    input.issuedAt < now - 5 * 60_000 ||
    input.expiresAt <= now ||
    input.expiresAt > input.issuedAt + 30 * 60_000
  ) {
    throw new Error("release_transparency_checkpoint_freshness_invalid");
  }
  if (!safeId(clean(input.nonce), 8, 160)) {
    throw new Error("release_transparency_checkpoint_nonce_invalid");
  }
}
function canonicalPayload(input: ReleaseTransparencyCheckpointUnsigned, env: EnvLike) {
  const checkpointId = clean(input.checkpointId);
  const audience = clean(input.audience);
  if (
    !safeId(checkpointId, 8, 128) ||
    !(input.environment === "staging" || input.environment === "production") ||
    !safeId(audience.replace(/\//g, ":"), 8, 160) ||
    !Number.isInteger(input.sequence) ||
    input.sequence < 1
  ) {
    throw new Error("release_transparency_checkpoint_identity_invalid");
  }
  const entries = validateEntries(input.entries);
  const previous = input.previousCheckpoint ?? null;
  if (input.sequence === 1 && previous) {
    throw new Error("release_transparency_checkpoint_genesis_previous_forbidden");
  }
  if (input.sequence > 1) {
    if (!previous) throw new Error("release_transparency_checkpoint_previous_required");
    if (
      previous.payload.environment !== input.environment ||
      previous.payload.audience !== audience ||
      previous.payload.sequence !== input.sequence - 1
    ) {
      throw new Error("release_transparency_checkpoint_previous_binding_invalid");
    }
    if (previous.payload.treeSize >= entries.length) {
      throw new Error("release_transparency_checkpoint_tree_not_extended");
    }
    const prefixRoot = merkleRoot(entries.slice(0, previous.payload.treeSize));
    if (prefixRoot !== previous.payload.entriesRoot) {
      throw new Error("release_transparency_checkpoint_prefix_rewrite_detected");
    }
  }
  if (
    input.trustCheckpoint.payload.environment !== input.environment ||
    input.trustCheckpoint.payload.audience !== audience
  ) {
    throw new Error("release_transparency_checkpoint_trust_binding_invalid");
  }
  const entriesRoot = merkleRoot(entries);
  const previousCheckpointDigest = previous?.checkpointDigest ?? null;
  const previousEntriesRoot = previous?.payload.entriesRoot ?? null;
  const previousTreeSize = previous?.payload.treeSize ?? 0;
  const consistencyDigest = sha(
    stable({
      schemaVersion: "velmere.release-transparency-checkpoint-consistency.v1",
      previousCheckpointDigest,
      previousEntriesRoot,
      previousTreeSize,
      entriesRoot,
      treeSize: entries.length,
      latestLogRoot: entries.at(-1)!.logRoot,
    }),
  );
  return {
    checkpointId,
    environment: input.environment,
    audience,
    audienceHash: sha(audience),
    sequence: input.sequence,
    previousCheckpointDigest,
    previousTreeSize,
    previousEntriesRoot,
    treeSize: entries.length,
    firstEntrySequence: entries[0].sequence,
    lastEntrySequence: entries.at(-1)!.sequence,
    firstEntryDigest: entries[0].entryDigest,
    lastEntryDigest: entries.at(-1)!.entryDigest,
    latestLogRoot: entries.at(-1)!.logRoot,
    entriesRoot,
    consistencyDigest,
    trustCheckpointDigest: input.trustCheckpoint.checkpointDigest,
    trustEpoch: input.trustCheckpoint.payload.trustEpoch,
    signatureThreshold: threshold(env),
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    nonce: clean(input.nonce),
  };
}

export function signReleaseTransparencyCheckpoint(
  input: ReleaseTransparencyCheckpointUnsigned,
  keyId: string,
  privateKeyPem: string,
  env: EnvLike = process.env,
): ReleaseTransparencyCheckpointSignature {
  validateFresh(input, input.issuedAt);
  const payload = canonicalPayload(input, env);
  return {
    keyId: clean(keyId),
    signature: cryptoSign(null, Buffer.from(stable(payload)), privateKey(privateKeyPem)).toString(
      "base64url",
    ),
  };
}

export function buildAndVerifyReleaseTransparencyCheckpoint(
  input: ReleaseTransparencyCheckpointRequest,
  env: EnvLike = process.env,
  now = Date.now(),
): ReleaseTransparencyCheckpointArtifact {
  validateFresh(input, now);
  const entries = validateEntries(input.entries);
  const payload = canonicalPayload({ ...input, entries }, env);
  const keys = new Map(input.trustCheckpoint.payload.keys.map((key) => [key.keyId, key]));
  const seen = new Set<string>();
  let activeSigners = 0;
  if (
    !Array.isArray(input.signatures) ||
    input.signatures.length < payload.signatureThreshold ||
    input.signatures.length > 8
  ) {
    throw new Error("release_transparency_checkpoint_signature_threshold_not_met");
  }
  for (const signature of input.signatures) {
    const keyId = clean(signature.keyId);
    if (seen.has(keyId)) throw new Error("release_transparency_checkpoint_signature_duplicate");
    seen.add(keyId);
    const key = keys.get(keyId);
    if (!key || key.status === "revoked") {
      throw new Error("release_transparency_checkpoint_signer_revoked");
    }
    if (key.status === "active") activeSigners += 1;
    if (
      !cryptoVerify(
        null,
        Buffer.from(stable(payload)),
        publicKey(key.publicKeyPem),
        Buffer.from(clean(signature.signature), "base64url"),
      )
    ) {
      throw new Error("release_transparency_checkpoint_signature_invalid");
    }
  }
  if (activeSigners < 1) {
    throw new Error("release_transparency_checkpoint_active_signer_required");
  }
  const signatures = input.signatures
    .map((signature) => ({ keyId: clean(signature.keyId), signature: clean(signature.signature) }))
    .sort((a, b) => a.keyId.localeCompare(b.keyId));
  return {
    schemaVersion: "velmere.release-transparency-checkpoint.v1",
    payload,
    entries,
    signatures,
    checkpointDigest: sha(stable({ payload, entries, signatures })),
  };
}

export function verifyReleaseTransparencyCheckpointArtifact(
  artifact: ReleaseTransparencyCheckpointArtifact,
  input: {
    trustCheckpoint: ReleaseTrustCheckpointArtifact;
    previousCheckpoint?: ReleaseTransparencyCheckpointArtifact | null;
  },
  env: EnvLike = process.env,
) {
  if (artifact.payload.trustCheckpointDigest !== input.trustCheckpoint.checkpointDigest) {
    throw new Error("release_transparency_checkpoint_trust_digest_mismatch");
  }
  const rebuilt = buildAndVerifyReleaseTransparencyCheckpoint(
    {
      checkpointId: artifact.payload.checkpointId,
      environment: artifact.payload.environment,
      audience: artifact.payload.audience,
      sequence: artifact.payload.sequence,
      previousCheckpoint: input.previousCheckpoint ?? null,
      entries: artifact.entries,
      trustCheckpoint: input.trustCheckpoint,
      issuedAt: artifact.payload.issuedAt,
      expiresAt: artifact.payload.expiresAt,
      nonce: artifact.payload.nonce,
      signatures: artifact.signatures,
    },
    {
      ...env,
      VELMERE_RELEASE_TRANSPARENCY_CHECKPOINT_SIGNATURE_THRESHOLD: String(
        artifact.payload.signatureThreshold,
      ),
    },
    artifact.payload.issuedAt,
  );
  if (
    rebuilt.checkpointDigest !== artifact.checkpointDigest ||
    rebuilt.payload.entriesRoot !== artifact.payload.entriesRoot ||
    rebuilt.payload.consistencyDigest !== artifact.payload.consistencyDigest
  ) {
    throw new Error("release_transparency_checkpoint_artifact_digest_invalid");
  }
  return true;
}

export function buildReleaseTransparencyInclusionProof(
  artifact: ReleaseTransparencyCheckpointArtifact,
  sequence: number,
): ReleaseTransparencyInclusionProof {
  const index = artifact.entries.findIndex((entry) => entry.sequence === sequence);
  if (index < 0) throw new Error("release_transparency_inclusion_entry_not_found");
  let level = artifact.entries.map(entryLeaf);
  let cursor = index;
  const siblings: ReleaseTransparencyInclusionProof["siblings"] = [];
  while (level.length > 1) {
    const siblingIndex = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
    const sibling = level[siblingIndex] ?? level[cursor];
    siblings.push({ side: cursor % 2 === 0 ? "right" : "left", digest: sibling });
    const next: string[] = [];
    for (let offset = 0; offset < level.length; offset += 2) {
      next.push(parent(level[offset], level[offset + 1] ?? level[offset]));
    }
    cursor = Math.floor(cursor / 2);
    level = next;
  }
  return {
    schemaVersion: "velmere.release-transparency-inclusion-proof.v1",
    checkpointDigest: artifact.checkpointDigest,
    entriesRoot: artifact.payload.entriesRoot,
    treeSize: artifact.payload.treeSize,
    leafIndex: index,
    entry: artifact.entries[index],
    leafDigest: entryLeaf(artifact.entries[index]),
    siblings,
  };
}

export function verifyReleaseTransparencyInclusionProof(proof: ReleaseTransparencyInclusionProof) {
  if (
    proof.schemaVersion !== "velmere.release-transparency-inclusion-proof.v1" ||
    !isSha(proof.entriesRoot) ||
    proof.treeSize < 1 ||
    proof.leafIndex < 0 ||
    proof.leafIndex >= proof.treeSize
  ) {
    throw new Error("release_transparency_inclusion_identity_invalid");
  }
  let digest = entryLeaf(normalizeEntry(proof.entry));
  if (digest !== proof.leafDigest) {
    throw new Error("release_transparency_inclusion_leaf_mismatch");
  }
  for (const sibling of proof.siblings) {
    if (!isSha(sibling.digest)) throw new Error("release_transparency_inclusion_sibling_invalid");
    digest = sibling.side === "left" ? parent(sibling.digest, digest) : parent(digest, sibling.digest);
  }
  if (digest !== proof.entriesRoot) {
    throw new Error("release_transparency_inclusion_root_mismatch");
  }
  return true;
}

export async function recordReleaseTransparencyCheckpoint(input: {
  request: ReleaseTransparencyCheckpointRequest;
  env?: EnvLike;
  dependencies?: { rpc: RpcRunner; now: () => Date };
}) {
  const dependencies = input.dependencies ?? {
    rpc: runRegisteredServiceRoleRpc,
    now: () => new Date(),
  };
  const artifact = buildAndVerifyReleaseTransparencyCheckpoint(
    input.request,
    input.env ?? process.env,
    dependencies.now().getTime(),
  );
  await dependencies.rpc({
    operation: "release_transparency_checkpoint_record",
    args: {
      p_idempotency_key: sha(`${artifact.checkpointDigest}:${artifact.payload.nonce}`),
      p_checkpoint_digest: artifact.checkpointDigest,
      p_environment: artifact.payload.environment,
      p_audience_hash: artifact.payload.audienceHash,
      p_sequence: artifact.payload.sequence,
      p_previous_checkpoint_digest: artifact.payload.previousCheckpointDigest,
      p_previous_tree_size: artifact.payload.previousTreeSize,
      p_previous_entries_root: artifact.payload.previousEntriesRoot,
      p_tree_size: artifact.payload.treeSize,
      p_first_entry_digest: artifact.payload.firstEntryDigest,
      p_last_entry_digest: artifact.payload.lastEntryDigest,
      p_latest_log_root: artifact.payload.latestLogRoot,
      p_entries_root: artifact.payload.entriesRoot,
      p_consistency_digest: artifact.payload.consistencyDigest,
      p_trust_checkpoint_digest: artifact.payload.trustCheckpointDigest,
      p_signature_count: artifact.signatures.length,
      p_signature_threshold: artifact.payload.signatureThreshold,
      p_checkpoint_json: artifact,
      p_issued_at: new Date(artifact.payload.issuedAt).toISOString(),
      p_expires_at: new Date(artifact.payload.expiresAt).toISOString(),
    },
  });
  const { data } = await dependencies.rpc({
    operation: "release_transparency_checkpoint_verify",
    args: { p_checkpoint_digest: artifact.checkpointDigest },
  });
  return {
    schemaVersion: "velmere.release-transparency-checkpoint-record.v1",
    ok: true,
    artifact,
    data,
    privacyBoundary: "hash-summaries-threshold-signatures-no-private-keys-no-operator-data",
  };
}

export async function getPublicReleaseTransparencyAuditSnapshots(input: {
  environment?: "staging" | "production";
  limit?: number;
  dependencies?: { rpc: RpcRunner };
}) {
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const limit = Math.max(1, Math.min(20, Number(input.limit ?? 5)));
  const { data } = await rpc({
    operation: "release_transparency_checkpoint_public_feed",
    args: { p_environment: input.environment ?? null, p_limit: limit },
  });
  const rows = Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row))
    : [];
  const snapshots = rows.map((row) => {
    const artifact = row.checkpoint_json as ReleaseTransparencyCheckpointArtifact;
    const sequences = artifact?.entries?.length
      ? [artifact.entries[0].sequence, artifact.entries.at(-1)!.sequence]
      : [];
    const inclusionProofs = sequences.map((sequence) =>
      buildReleaseTransparencyInclusionProof(artifact, sequence),
    );
    return {
      checkpointDigest: clean(row.checkpoint_digest),
      environment: clean(row.environment),
      sequence: Number(row.sequence),
      previousCheckpointDigest: row.previous_checkpoint_digest
        ? clean(row.previous_checkpoint_digest)
        : null,
      treeSize: Number(row.tree_size),
      entriesRoot: clean(row.entries_root),
      consistencyDigest: clean(row.consistency_digest),
      latestLogRoot: clean(row.latest_log_root),
      signatureCount: Number(row.signature_count),
      signatureThreshold: Number(row.signature_threshold),
      verifiedAt: row.verified_at ?? null,
      artifact,
      inclusionProofs,
    };
  });
  return {
    schemaVersion: "velmere.public-release-transparency-audit-snapshots.v1",
    ok: true,
    snapshots,
    feedDigest: sha(stable(snapshots.map((snapshot) => ({
      checkpointDigest: snapshot.checkpointDigest,
      sequence: snapshot.sequence,
      treeSize: snapshot.treeSize,
      entriesRoot: snapshot.entriesRoot,
      consistencyDigest: snapshot.consistencyDigest,
    })))),
    privacyBoundary: "public-entry-hash-summaries-and-inclusion-proofs-only",
  };
}
