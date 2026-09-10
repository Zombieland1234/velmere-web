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
  buildAndVerifyReleaseProofPackage,
  type ReleaseProofPackageArtifact,
  type ReleaseProofPublicKey,
} from "@/lib/market-integrity/release-proof-package";

export type ReleaseTrustCheckpointKey = ReleaseProofPublicKey & {
  revokedAt?: number;
  replacementFingerprint?: string;
  revocationCode?: "routine_rotation" | "suspected_compromise" | "confirmed_compromise" | "administrative";
};

export type ReleaseTrustCheckpointSignature = { keyId: string; signature: string };

export type ReleaseTrustCheckpointUnsigned = {
  checkpointId: string;
  environment: "staging" | "production";
  audience: string;
  sequence: number;
  previousCheckpointDigest?: string | null;
  previousCheckpoint?: ReleaseTrustCheckpointArtifact | null;
  latestPackage: ReleaseProofPackageArtifact;
  trustEpoch: number;
  keys: ReleaseTrustCheckpointKey[];
  supersededPackageDigests?: string[];
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export type ReleaseTrustCheckpointRequest = ReleaseTrustCheckpointUnsigned & {
  signatures: ReleaseTrustCheckpointSignature[];
};

export type ReleaseTrustCheckpointArtifact = {
  schemaVersion: "velmere.release-trust-checkpoint.v1";
  payload: {
    checkpointId: string;
    environment: "staging" | "production";
    audience: string;
    audienceHash: string;
    sequence: number;
    previousCheckpointDigest: string | null;
    latestPackageDigest: string;
    latestPackageSequence: number;
    trustEpoch: number;
    keys: ReleaseTrustCheckpointKey[];
    keyRegistryDigest: string;
    revokedKeyFingerprints: string[];
    supersededPackageDigests: string[];
    signatureThreshold: number;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
  };
  signatures: ReleaseTrustCheckpointSignature[];
  checkpointDigest: string;
};

type EnvLike = Record<string, string | undefined>;
type RpcRunner = (input: {
  operation: SupabaseRpcOperation;
  args?: Record<string, unknown>;
}) => Promise<{ data: unknown }>;

const clean = (value: unknown) => String(value ?? "").trim();
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const isSha = (value: string) => /^[0-9a-f]{64}$/.test(value);
const safeId = (value: string, min = 4, max = 160) =>
  new RegExp(`^[A-Za-z0-9._:-]{${min},${max}}$`).test(value);
const stable = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
};

function publicKey(pem: string): KeyObject {
  const key = createPublicKey(clean(pem).replace(/\\n/g, "\n"));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("release_trust_public_key_not_ed25519");
  return key;
}
function privateKey(pem: string): KeyObject {
  const key = createPrivateKey(clean(pem).replace(/\\n/g, "\n"));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("release_trust_private_key_not_ed25519");
  return key;
}
function fingerprint(pem: string) {
  return sha(publicKey(pem).export({ type: "spki", format: "der" }) as Buffer);
}
function trustedGenesisFingerprints(env: EnvLike) {
  const values = clean(env.VELMERE_RELEASE_TRUSTED_GENESIS_FINGERPRINTS)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (values.some((value) => !isSha(value))) throw new Error("release_trust_genesis_fingerprint_invalid");
  return new Set(values);
}
function threshold(env: EnvLike) {
  const parsed = Number(
    env.VELMERE_RELEASE_TRUST_SIGNATURE_THRESHOLD ??
      env.VELMERE_RELEASE_PROOF_SIGNATURE_THRESHOLD ??
      "2",
  );
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 5) {
    throw new Error("release_trust_threshold_invalid");
  }
  return parsed;
}
function sortedUniqueShas(values: unknown, field: string) {
  if (!Array.isArray(values) || values.length > 256) throw new Error(`${field}_invalid`);
  const normalized = values.map((value) => clean(value).toLowerCase());
  if (normalized.some((value) => !isSha(value)) || new Set(normalized).size !== normalized.length) {
    throw new Error(`${field}_invalid`);
  }
  return normalized.sort();
}
function normalizeKeys(input: ReleaseTrustCheckpointKey[]) {
  if (!Array.isArray(input) || input.length < 2 || input.length > 16) {
    throw new Error("release_trust_keys_invalid");
  }
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const keys = input
    .map((item) => {
      const keyId = clean(item.keyId);
      const publicKeyPem = clean(item.publicKeyPem).replace(/\\n/g, "\n");
      const computed = fingerprint(publicKeyPem);
      if (!safeId(keyId, 4, 96) || seenIds.has(keyId) || seenFingerprints.has(computed)) {
        throw new Error("release_trust_key_identity_invalid");
      }
      seenIds.add(keyId);
      seenFingerprints.add(computed);
      if (item.fingerprint && clean(item.fingerprint).toLowerCase() !== computed) {
        throw new Error("release_trust_key_fingerprint_mismatch");
      }
      if (!(item.status === "active" || item.status === "retiring" || item.status === "revoked")) {
        throw new Error("release_trust_key_status_invalid");
      }
      const notBefore = item.notBefore === undefined ? undefined : Number(item.notBefore);
      const notAfter = item.notAfter === undefined ? undefined : Number(item.notAfter);
      const revokedAt = item.revokedAt === undefined ? undefined : Number(item.revokedAt);
      if (
        (notBefore !== undefined && !Number.isInteger(notBefore)) ||
        (notAfter !== undefined && !Number.isInteger(notAfter)) ||
        (revokedAt !== undefined && !Number.isInteger(revokedAt)) ||
        (notBefore !== undefined && notAfter !== undefined && notAfter <= notBefore)
      ) {
        throw new Error("release_trust_key_window_invalid");
      }
      const replacementFingerprint = item.replacementFingerprint
        ? clean(item.replacementFingerprint).toLowerCase()
        : undefined;
      if (replacementFingerprint && !isSha(replacementFingerprint)) {
        throw new Error("release_trust_replacement_fingerprint_invalid");
      }
      if (item.status === "revoked" && revokedAt === undefined) {
        throw new Error("release_trust_revoked_at_required");
      }
      if (item.status !== "revoked" && (revokedAt !== undefined || item.revocationCode)) {
        throw new Error("release_trust_revocation_metadata_forbidden");
      }
      if (
        item.revocationCode &&
        !["routine_rotation", "suspected_compromise", "confirmed_compromise", "administrative"].includes(
          item.revocationCode,
        )
      ) {
        throw new Error("release_trust_revocation_code_invalid");
      }
      return {
        keyId,
        publicKeyPem,
        fingerprint: computed,
        status: item.status,
        ...(notBefore === undefined ? {} : { notBefore }),
        ...(notAfter === undefined ? {} : { notAfter }),
        ...(revokedAt === undefined ? {} : { revokedAt }),
        ...(replacementFingerprint ? { replacementFingerprint } : {}),
        ...(item.revocationCode ? { revocationCode: item.revocationCode } : {}),
      } satisfies ReleaseTrustCheckpointKey;
    })
    .sort((a, b) => a.keyId.localeCompare(b.keyId));
  if (!keys.some((key) => key.status === "active")) throw new Error("release_trust_active_key_required");
  for (const key of keys) {
    if (key.replacementFingerprint && !seenFingerprints.has(key.replacementFingerprint)) {
      throw new Error("release_trust_replacement_key_missing");
    }
  }
  return keys;
}
function registryDigest(keys: ReleaseTrustCheckpointKey[]) {
  return sha(
    stable(
      keys.map(({ publicKeyPem, ...rest }) => ({
        ...rest,
        publicKeySpki: Buffer.from(
          publicKey(publicKeyPem).export({ type: "spki", format: "der" }) as Buffer,
        ).toString("base64"),
      })),
    ),
  );
}
function canonicalPayload(input: ReleaseTrustCheckpointUnsigned, env: EnvLike) {
  const audience = clean(input.audience);
  const audienceHash = sha(audience);
  const keys = normalizeKeys(input.keys);
  const revokedKeyFingerprints = keys
    .filter((key) => key.status === "revoked")
    .map((key) => key.fingerprint)
    .sort();
  const supersededPackageDigests = sortedUniqueShas(
    input.supersededPackageDigests ?? [],
    "release_trust_superseded_packages",
  );
  const packageArtifact = buildAndVerifyReleaseProofPackage(
    { ...input.latestPackage.payload, signatures: input.latestPackage.signatures },
    { VELMERE_RELEASE_PROOF_SIGNATURE_THRESHOLD: String(input.latestPackage.payload.signatureThreshold) },
    input.latestPackage.payload.issuedAt,
  );
  if (packageArtifact.packageDigest !== input.latestPackage.packageDigest) {
    throw new Error("release_trust_latest_package_digest_invalid");
  }
  if (
    packageArtifact.payload.environment !== input.environment ||
    packageArtifact.payload.audienceHash !== audienceHash
  ) {
    throw new Error("release_trust_latest_package_binding_mismatch");
  }
  if (supersededPackageDigests.includes(packageArtifact.packageDigest)) {
    throw new Error("release_trust_latest_package_superseded");
  }
  const currentById = new Map(keys.map((key) => [key.keyId, key]));
  for (const signature of packageArtifact.signatures) {
    const current = currentById.get(signature.keyId);
    if (!current || current.status === "revoked") {
      throw new Error("release_trust_latest_package_signer_revoked");
    }
  }
  return {
    checkpointId: clean(input.checkpointId),
    environment: input.environment,
    audience,
    audienceHash,
    sequence: Number(input.sequence),
    previousCheckpointDigest: input.previousCheckpointDigest
      ? clean(input.previousCheckpointDigest).toLowerCase()
      : null,
    latestPackageDigest: packageArtifact.packageDigest,
    latestPackageSequence: packageArtifact.payload.sequence,
    trustEpoch: Number(input.trustEpoch),
    keys,
    keyRegistryDigest: registryDigest(keys),
    revokedKeyFingerprints,
    supersededPackageDigests,
    signatureThreshold: threshold(env),
    issuedAt: Number(input.issuedAt),
    expiresAt: Number(input.expiresAt),
    nonce: clean(input.nonce),
  };
}
function validateUnsigned(input: ReleaseTrustCheckpointUnsigned, now: number) {
  if (
    !safeId(clean(input.checkpointId), 8, 128) ||
    !(input.environment === "staging" || input.environment === "production") ||
    !safeId(clean(input.audience).replace(/\//g, ":"), 8, 160)
  ) {
    throw new Error("release_trust_identity_invalid");
  }
  if (!Number.isInteger(input.sequence) || input.sequence < 1) {
    throw new Error("release_trust_sequence_invalid");
  }
  if (!Number.isInteger(input.trustEpoch) || input.trustEpoch < 1) {
    throw new Error("release_trust_epoch_invalid");
  }
  const previousDigest = input.previousCheckpointDigest
    ? clean(input.previousCheckpointDigest).toLowerCase()
    : null;
  if ((input.sequence === 1 && previousDigest) || (input.sequence > 1 && !isSha(previousDigest ?? ""))) {
    throw new Error("release_trust_previous_invalid");
  }
  if (
    !Number.isInteger(input.issuedAt) ||
    !Number.isInteger(input.expiresAt) ||
    input.issuedAt > now + 60_000 ||
    input.issuedAt < now - 5 * 60_000 ||
    input.expiresAt <= now ||
    input.expiresAt > input.issuedAt + 30 * 60_000
  ) {
    throw new Error("release_trust_freshness_invalid");
  }
  if (!safeId(clean(input.nonce), 8, 160)) throw new Error("release_trust_nonce_invalid");
  if (input.sequence === 1 && input.previousCheckpoint) {
    throw new Error("release_trust_genesis_previous_forbidden");
  }
  if (input.sequence > 1) {
    const previous = input.previousCheckpoint;
    if (!previous || previous.schemaVersion !== "velmere.release-trust-checkpoint.v1") {
      throw new Error("release_trust_previous_checkpoint_required");
    }
    if (previous.checkpointDigest !== previousDigest) {
      throw new Error("release_trust_previous_checkpoint_mismatch");
    }
    if (
      previous.payload.environment !== input.environment ||
      previous.payload.audienceHash !== sha(clean(input.audience)) ||
      previous.payload.sequence + 1 !== input.sequence
    ) {
      throw new Error("release_trust_previous_checkpoint_binding_mismatch");
    }
  }
}
function validateMonotonicState(
  payload: ReturnType<typeof canonicalPayload>,
  previous: ReleaseTrustCheckpointArtifact | null | undefined,
) {
  if (!previous) return;
  const previousRevoked = new Set(previous.payload.revokedKeyFingerprints);
  if ([...previousRevoked].some((digest) => !payload.revokedKeyFingerprints.includes(digest))) {
    throw new Error("release_trust_revocation_set_regressed");
  }
  const previousSuperseded = new Set(previous.payload.supersededPackageDigests);
  if ([...previousSuperseded].some((digest) => !payload.supersededPackageDigests.includes(digest))) {
    throw new Error("release_trust_supersession_set_regressed");
  }
  const registryChanged = payload.keyRegistryDigest !== previous.payload.keyRegistryDigest;
  const expectedEpoch = registryChanged ? previous.payload.trustEpoch + 1 : previous.payload.trustEpoch;
  if (payload.trustEpoch !== expectedEpoch) throw new Error("release_trust_epoch_transition_invalid");
  if (payload.latestPackageSequence < previous.payload.latestPackageSequence) {
    throw new Error("release_trust_latest_package_regressed");
  }
}

export function signReleaseTrustCheckpoint(
  input: ReleaseTrustCheckpointUnsigned,
  keyId: string,
  privateKeyPem: string,
  env: EnvLike = process.env,
): ReleaseTrustCheckpointSignature {
  validateUnsigned(input, input.issuedAt);
  const payload = canonicalPayload(input, env);
  validateMonotonicState(payload, input.previousCheckpoint);
  return {
    keyId: clean(keyId),
    signature: cryptoSign(null, Buffer.from(stable(payload)), privateKey(privateKeyPem)).toString("base64url"),
  };
}

export function buildAndVerifyReleaseTrustCheckpoint(
  input: ReleaseTrustCheckpointRequest,
  env: EnvLike = process.env,
  now = Date.now(),
): ReleaseTrustCheckpointArtifact {
  validateUnsigned(input, now);
  const payload = canonicalPayload(input, env);
  validateMonotonicState(payload, input.previousCheckpoint);
  if (payload.sequence === 1) {
    const anchors = trustedGenesisFingerprints(env);
    if (anchors.size < 1 || !payload.keys.some((key) => key.status === "active" && anchors.has(key.fingerprint))) {
      throw new Error("release_trust_external_genesis_anchor_required");
    }
  }
  const keyMap = new Map(payload.keys.map((key) => [key.keyId, key]));
  const seen = new Set<string>();
  let active = 0;
  if (
    !Array.isArray(input.signatures) ||
    input.signatures.length < payload.signatureThreshold ||
    input.signatures.length > 8
  ) {
    throw new Error("release_trust_signature_threshold_not_met");
  }
  for (const signature of input.signatures) {
    const keyId = clean(signature.keyId);
    if (seen.has(keyId)) throw new Error("release_trust_signature_duplicate");
    seen.add(keyId);
    const key = keyMap.get(keyId);
    if (!key) throw new Error("release_trust_signer_unknown");
    if (key.status === "revoked") throw new Error("release_trust_signer_revoked");
    if (key.notBefore !== undefined && payload.issuedAt < key.notBefore) {
      throw new Error("release_trust_signer_not_yet_valid");
    }
    if (key.notAfter !== undefined && payload.issuedAt > key.notAfter) {
      throw new Error("release_trust_signer_expired");
    }
    if (key.status === "active") active += 1;
    if (
      !cryptoVerify(
        null,
        Buffer.from(stable(payload)),
        publicKey(key.publicKeyPem),
        Buffer.from(clean(signature.signature), "base64url"),
      )
    ) {
      throw new Error("release_trust_signature_invalid");
    }
  }
  if (active < 1) throw new Error("release_trust_active_signer_required");
  const signatures = input.signatures
    .map((signature) => ({ keyId: clean(signature.keyId), signature: clean(signature.signature) }))
    .sort((a, b) => a.keyId.localeCompare(b.keyId));
  return {
    schemaVersion: "velmere.release-trust-checkpoint.v1",
    payload,
    signatures,
    checkpointDigest: sha(stable({ payload, signatures })),
  };
}


export function verifyReleaseTrustCheckpointArtifact(
  artifact: ReleaseTrustCheckpointArtifact,
  options: {
    expectedEnvironment?: "staging" | "production";
    expectedAudience?: string;
    previousCheckpoint?: ReleaseTrustCheckpointArtifact | null;
    trustedFingerprints?: string[];
    requireExternalAnchor?: boolean;
  } = {},
) {
  if (!artifact || artifact.schemaVersion !== "velmere.release-trust-checkpoint.v1") {
    throw new Error("release_trust_artifact_invalid");
  }
  const payload = artifact.payload;
  if (options.expectedEnvironment && payload.environment !== options.expectedEnvironment) {
    throw new Error("release_trust_environment_mismatch");
  }
  if (options.expectedAudience && payload.audienceHash !== sha(clean(options.expectedAudience))) {
    throw new Error("release_trust_audience_mismatch");
  }
  if (payload.audienceHash !== sha(payload.audience)) throw new Error("release_trust_audience_hash_invalid");
  const keys = normalizeKeys(payload.keys);
  if (registryDigest(keys) !== payload.keyRegistryDigest) throw new Error("release_trust_registry_digest_invalid");
  const revoked = keys.filter((key) => key.status === "revoked").map((key) => key.fingerprint).sort();
  if (stable(revoked) !== stable(payload.revokedKeyFingerprints)) {
    throw new Error("release_trust_revocation_set_invalid");
  }
  if (payload.sequence === 1 && payload.previousCheckpointDigest) {
    throw new Error("release_trust_genesis_previous_forbidden");
  }
  if (payload.sequence === 1 && options.requireExternalAnchor) {
    const anchors = new Set((options.trustedFingerprints ?? []).map((value) => clean(value).toLowerCase()).filter(isSha));
    if (anchors.size < 1 || !keys.some((key) => key.status === "active" && anchors.has(key.fingerprint))) {
      throw new Error("release_trust_external_genesis_anchor_required");
    }
  }
  if (payload.sequence > 1 && !isSha(payload.previousCheckpointDigest ?? "")) {
    throw new Error("release_trust_previous_invalid");
  }
  if (options.previousCheckpoint) {
    const previous = options.previousCheckpoint;
    if (
      previous.checkpointDigest !== payload.previousCheckpointDigest ||
      previous.payload.sequence + 1 !== payload.sequence ||
      previous.payload.environment !== payload.environment ||
      previous.payload.audienceHash !== payload.audienceHash
    ) {
      throw new Error("release_trust_previous_checkpoint_mismatch");
    }
    validateMonotonicState(payload, previous);
  }
  const keyMap = new Map(keys.map((key) => [key.keyId, key]));
  const seen = new Set<string>();
  let active = 0;
  if (artifact.signatures.length < payload.signatureThreshold || artifact.signatures.length > 8) {
    throw new Error("release_trust_signature_threshold_not_met");
  }
  for (const signature of artifact.signatures) {
    if (seen.has(signature.keyId)) throw new Error("release_trust_signature_duplicate");
    seen.add(signature.keyId);
    const key = keyMap.get(signature.keyId);
    if (!key || key.status === "revoked") throw new Error("release_trust_signer_revoked");
    if (key.notBefore !== undefined && payload.issuedAt < key.notBefore) throw new Error("release_trust_signer_not_yet_valid");
    if (key.notAfter !== undefined && payload.issuedAt > key.notAfter) throw new Error("release_trust_signer_expired");
    if (key.status === "active") active += 1;
    if (!cryptoVerify(null, Buffer.from(stable(payload)), publicKey(key.publicKeyPem), Buffer.from(signature.signature, "base64url"))) {
      throw new Error("release_trust_signature_invalid");
    }
  }
  if (active < 1) throw new Error("release_trust_active_signer_required");
  const expectedDigest = sha(stable({ payload, signatures: [...artifact.signatures].sort((a, b) => a.keyId.localeCompare(b.keyId)) }));
  if (artifact.checkpointDigest !== expectedDigest) throw new Error("release_trust_checkpoint_digest_invalid");
  return true;
}

export async function recordReleaseTrustCheckpoint(input: {
  request: ReleaseTrustCheckpointRequest;
  env?: EnvLike;
  dependencies?: { rpc: RpcRunner; now: () => Date };
}) {
  const dependencies = input.dependencies ?? {
    rpc: runRegisteredServiceRoleRpc,
    now: () => new Date(),
  };
  const artifact = buildAndVerifyReleaseTrustCheckpoint(
    input.request,
    input.env ?? process.env,
    dependencies.now().getTime(),
  );
  const { data } = await dependencies.rpc({
    operation: "release_trust_checkpoint_record",
    args: {
      p_idempotency_key: sha(`${artifact.checkpointDigest}:${artifact.payload.nonce}`),
      p_checkpoint_id_hash: sha(artifact.payload.checkpointId),
      p_environment: artifact.payload.environment,
      p_audience_hash: artifact.payload.audienceHash,
      p_sequence: artifact.payload.sequence,
      p_previous_checkpoint_digest: artifact.payload.previousCheckpointDigest,
      p_latest_package_digest: artifact.payload.latestPackageDigest,
      p_latest_package_sequence: artifact.payload.latestPackageSequence,
      p_trust_epoch: artifact.payload.trustEpoch,
      p_key_registry_digest: artifact.payload.keyRegistryDigest,
      p_revoked_key_fingerprints: artifact.payload.revokedKeyFingerprints,
      p_superseded_package_digests: artifact.payload.supersededPackageDigests,
      p_signature_count: artifact.signatures.length,
      p_signature_threshold: artifact.payload.signatureThreshold,
      p_checkpoint_digest: artifact.checkpointDigest,
      p_checkpoint_json: artifact,
      p_issued_at: new Date(artifact.payload.issuedAt).toISOString(),
      p_expires_at: new Date(artifact.payload.expiresAt).toISOString(),
    },
  });
  const first = Array.isArray(data) ? data[0] : data;
  if (!first || typeof first !== "object") throw new Error("release_trust_record_empty");
  const verified = await dependencies.rpc({
    operation: "release_trust_checkpoint_verify",
    args: { p_checkpoint_digest: artifact.checkpointDigest },
  });
  const status = Array.isArray(verified.data) ? verified.data[0] : verified.data;
  return {
    schemaVersion: "velmere.release-trust-checkpoint-record.v1" as const,
    ok: clean((status as Record<string, unknown>)?.state ?? (first as Record<string, unknown>).state) === "verified",
    checkpointDigest: artifact.checkpointDigest,
    latestPackageDigest: artifact.payload.latestPackageDigest,
    trustEpoch: artifact.payload.trustEpoch,
    revokedKeyCount: artifact.payload.revokedKeyFingerprints.length,
    supersededPackageCount: artifact.payload.supersededPackageDigests.length,
    privacyBoundary:
      "Public keys, revocation fingerprints, package hashes and threshold signatures only; no private keys, operator identity, customer data or provider payloads.",
  };
}

export async function getPublicReleaseTrustCheckpoints(input: {
  environment?: "staging" | "production";
  limit?: number;
  dependencies?: { rpc: RpcRunner };
} = {}): Promise<{
  schemaVersion: "velmere.public-release-trust-checkpoints.v1";
  ok: boolean;
  checkpoints: ReleaseTrustCheckpointArtifact[];
  latestCheckpointDigest: string | null;
  feedDigest: string;
  privacyBoundary: string;
}> {
  const dependencies = input.dependencies ?? { rpc: runRegisteredServiceRoleRpc };
  const limit = Math.max(1, Math.min(50, Math.trunc(input.limit ?? 10)));
  const { data } = await dependencies.rpc({
    operation: "release_trust_checkpoint_public_feed",
    args: { p_environment: input.environment ?? null, p_limit: limit },
  });
  const rows = Array.isArray(data) ? data : [];
  const checkpoints: ReleaseTrustCheckpointArtifact[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const raw = (item as Record<string, unknown>).checkpoint_json;
    try {
      const artifact = (typeof raw === "string" ? JSON.parse(raw) : raw) as ReleaseTrustCheckpointArtifact;
      verifyReleaseTrustCheckpointArtifact(artifact, { expectedEnvironment: input.environment });
      checkpoints.push(artifact);
    } catch {
      // Public feed is fail-closed per row: malformed rows are excluded.
    }
  }
  checkpoints.sort((a, b) => b.payload.sequence - a.payload.sequence);
  for (let index = 0; index < checkpoints.length - 1; index += 1) {
    const current = checkpoints[index];
    const previous = checkpoints[index + 1];
    if (current.payload.sequence === previous.payload.sequence + 1) {
      verifyReleaseTrustCheckpointArtifact(current, {
        expectedEnvironment: input.environment,
        previousCheckpoint: previous,
      });
    }
  }
  return {
    schemaVersion: "velmere.public-release-trust-checkpoints.v1",
    ok: true,
    checkpoints,
    latestCheckpointDigest: checkpoints[0]?.checkpointDigest ?? null,
    feedDigest: sha(stable(checkpoints.map((checkpoint) => checkpoint.checkpointDigest))),
    privacyBoundary:
      "Public checkpoints expose public keys, revocation fingerprints, superseded package hashes and threshold signatures. Private keys, operator identity, reasons, customer data and provider payloads are never exposed.",
  };
}

