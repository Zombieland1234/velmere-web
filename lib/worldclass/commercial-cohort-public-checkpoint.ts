import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  verifyCommercialCohortApproval,
  verifyCommercialCohortAttestation,
  type CommercialCohortAttestation,
  type CommercialCohortManifest,
} from "@/lib/worldclass/commercial-cohort-policy";
import {
  verifyCommercialCohortAntiCherryPickReceipt,
  type CommercialCohortAntiCherryPickReceipt,
} from "@/lib/worldclass/commercial-cohort-anti-cherry-pick";

export const PASS4811_PUBLIC_CHECKPOINT_POLICY_ID = "pass4811-monotonic-public-checkpoint-v1" as const;
export const PASS4811_TRUST_BUNDLE_SCHEMA = "velmere.commercial-cohort-trust-bundle.v1" as const;
export const PASS4811_PUBLIC_CHECKPOINT_SCHEMA = "velmere.commercial-cohort-public-checkpoint.v1" as const;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,191}$/;
const MAX_TRUST_LIFETIME_MS = 180 * 24 * 60 * 60 * 1_000;
const MAX_CHECKPOINT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;
const CLOCK_SKEW_MS = 60_000;

export type CommercialCohortRootPublicKey = {
  keyId: string;
  publicKeyPem: string;
};

export type CommercialCohortPrivateSigner = {
  keyId: string;
  privateKeyPem: string;
};

export type CommercialCohortDetachedSignature = {
  keyId: string;
  signature: string;
};

export type CommercialCohortTrustBundlePreparation = {
  core: Omit<CommercialCohortTrustBundle, "bundleDigest" | "rootSignatures">;
  bundleDigest: string;
  rootSignaturePayload: ReturnType<typeof commercialCohortRootSignaturePayload>;
};

export type CommercialCohortPublicCheckpointPreparation = {
  core: Omit<CommercialCohortPublicCheckpoint, "releaseSignatures" | "externalWitnesses" | "checkpointDigest">;
  coreDigest: string;
  releaseSignaturePayload: ReturnType<typeof commercialCohortReleaseSignaturePayload>;
};

export type CommercialCohortUnsignedExternalWitness = Omit<CommercialCohortExternalWitness, "signature">;

export type CommercialCohortTrustKey = {
  keyId: string;
  purpose: "release" | "witness";
  status: "active" | "retiring" | "revoked";
  publicKeyPem: string;
  publicKeyFingerprint: string;
  notBefore: string;
  notAfter: string;
};

export type CommercialCohortRootSignature = {
  keyId: string;
  signature: string;
};

export type CommercialCohortTrustBundle = {
  schemaVersion: typeof PASS4811_TRUST_BUNDLE_SCHEMA;
  policyVersion: typeof PASS4811_PUBLIC_CHECKPOINT_POLICY_ID;
  epoch: number;
  issuedAt: string;
  notBefore: string;
  expiresAt: string;
  previousBundleDigest: string | null;
  releaseSignatureThreshold: number;
  witnessSignatureThreshold: number;
  keys: CommercialCohortTrustKey[];
  revokedCheckpointDigests: string[];
  bundleDigest: string;
  rootSignatures: CommercialCohortRootSignature[];
};

export type CommercialCohortReleaseSignature = {
  keyId: string;
  signature: string;
};

export type CommercialCohortExternalWitness = {
  keyId: string;
  sinkId: string;
  publicUrl: string;
  publishedAt: string;
  receiptDigest: string;
  logIndex: string;
  signature: string;
};

export type CommercialCohortPublicCheckpoint = {
  schemaVersion: typeof PASS4811_PUBLIC_CHECKPOINT_SCHEMA;
  policyVersion: typeof PASS4811_PUBLIC_CHECKPOINT_POLICY_ID;
  environment: "staging" | "production";
  audience: string;
  sequence: number;
  previousCheckpointDigest: string | null;
  trustBundleDigest: string;
  trustEpoch: number;
  manifestDigest: string;
  attestationDigest: string;
  antiCherryPickReceiptDigest: string;
  cohortWindowEnd: string;
  runtimeVersionRoot: string;
  providerConfigRoot: string;
  releaseContextDigest: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  releaseSignatures: CommercialCohortReleaseSignature[];
  externalWitnesses: CommercialCohortExternalWitness[];
  checkpointDigest: string;
};

export type CommercialCohortPublicCheckpointVerification = {
  verified: boolean;
  publicCheckpointVerified: boolean;
  rollbackProtected: boolean;
  externallyWitnessed: boolean;
  keyRotationVerified: boolean;
  deploymentReceiptVerified: boolean;
  artifactBound: boolean;
  deploymentRollbackProtected: boolean;
  deploymentSequence: number | null;
  deploymentReceiptDigest: string | null;
  checkpointSequence: number | null;
  checkpointDigest: string | null;
  trustEpoch: number | null;
  externalWitnessCount: number;
  blockers: string[];
};

function clean(value: unknown, max = 512): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function requiredDigest(value: unknown, code: string): string {
  const text = clean(value, 80).toLowerCase();
  if (!DIGEST.test(text)) throw new Error(code);
  return text;
}

function requiredId(value: unknown, code: string, pattern: RegExp = SAFE_ID): string {
  const text = clean(value, 192);
  if (!pattern.test(text)) throw new Error(code);
  return text;
}

function requiredEd25519Signature(value: unknown, code: string): string {
  const text = clean(value, 256).replace(/=+$/g, "");
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error(code);
  let bytes: Buffer;
  try {
    bytes = Buffer.from(text, "base64url");
  } catch {
    throw new Error(code);
  }
  if (bytes.length !== 64 || bytes.toString("base64url") !== text) throw new Error(code);
  return text;
}

function parseDate(value: unknown, code: string): Date {
  const text = clean(value, 64);
  const date = new Date(text);
  if (!text || !Number.isFinite(date.getTime())) throw new Error(code);
  return date;
}

function normalizePem(value: unknown): string {
  return clean(value, 16_384).replace(/\\n/g, "\n");
}

function ed25519PublicKey(value: unknown): KeyObject {
  const key = createPublicKey(normalizePem(value));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("commercial_checkpoint_public_key_not_ed25519");
  return key;
}

function ed25519PrivateKey(value: unknown): KeyObject {
  const key = createPrivateKey(normalizePem(value));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("commercial_checkpoint_private_key_not_ed25519");
  return key;
}

function keyFingerprint(key: KeyObject): string {
  const der = key.export({ type: "spki", format: "der" });
  return `sha256:${createHash("sha256").update(der).digest("hex")}`;
}

function signPayload(privateKeyPem: string, payload: unknown): string {
  return cryptoSign(null, Buffer.from(canonicalJson(payload)), ed25519PrivateKey(privateKeyPem)).toString("base64url");
}

function verifyPayload(publicKeyPem: string, payload: unknown, signature: string): boolean {
  try {
    return cryptoVerify(
      null,
      Buffer.from(canonicalJson(payload)),
      ed25519PublicKey(publicKeyPem),
      Buffer.from(clean(signature, 2048), "base64url"),
    );
  } catch {
    return false;
  }
}

function trustBundleCore(bundle: Omit<CommercialCohortTrustBundle, "bundleDigest" | "rootSignatures">) {
  return bundle;
}

export function commercialCohortRootSignaturePayload(bundleDigest: string, epoch: number) {
  return {
    schemaVersion: "velmere.commercial-cohort-trust-bundle-root-signature.v1",
    policyVersion: PASS4811_PUBLIC_CHECKPOINT_POLICY_ID,
    bundleDigest,
    epoch,
  } as const;
}

function normalizeRootKeys(keys: CommercialCohortRootPublicKey[]): CommercialCohortRootPublicKey[] {
  if (!Array.isArray(keys) || keys.length < 2 || keys.length > 8) throw new Error("commercial_checkpoint_root_keyring_invalid");
  const normalized = keys.map((item) => {
    const keyId = requiredId(item?.keyId, "commercial_checkpoint_root_key_id_invalid", KEY_ID);
    const publicKeyPem = normalizePem(item?.publicKeyPem);
    ed25519PublicKey(publicKeyPem);
    return { keyId, publicKeyPem };
  }).sort((left, right) => left.keyId.localeCompare(right.keyId));
  if (new Set(normalized.map((item) => item.keyId)).size !== normalized.length) throw new Error("commercial_checkpoint_root_key_id_duplicate");
  const fingerprints = normalized.map((item) => keyFingerprint(ed25519PublicKey(item.publicKeyPem)));
  if (new Set(fingerprints).size !== fingerprints.length) throw new Error("commercial_checkpoint_root_key_duplicate");
  return normalized;
}

function normalizeTrustKey(input: CommercialCohortTrustKey, bundleNotBefore: Date, bundleExpiresAt: Date): CommercialCohortTrustKey {
  const keyId = requiredId(input?.keyId, "commercial_checkpoint_trust_key_id_invalid", KEY_ID);
  if (!(input?.purpose === "release" || input?.purpose === "witness")) throw new Error("commercial_checkpoint_trust_key_purpose_invalid");
  if (!(input?.status === "active" || input?.status === "retiring" || input?.status === "revoked")) throw new Error("commercial_checkpoint_trust_key_status_invalid");
  const publicKeyPem = normalizePem(input.publicKeyPem);
  const publicKey = ed25519PublicKey(publicKeyPem);
  const fingerprint = keyFingerprint(publicKey);
  if (requiredDigest(input.publicKeyFingerprint, "commercial_checkpoint_trust_key_fingerprint_invalid") !== fingerprint) {
    throw new Error("commercial_checkpoint_trust_key_fingerprint_mismatch");
  }
  const notBefore = parseDate(input.notBefore, "commercial_checkpoint_trust_key_not_before_invalid");
  const notAfter = parseDate(input.notAfter, "commercial_checkpoint_trust_key_not_after_invalid");
  if (notAfter.getTime() <= notBefore.getTime()) throw new Error("commercial_checkpoint_trust_key_window_invalid");
  if (notBefore.getTime() < bundleNotBefore.getTime() - CLOCK_SKEW_MS || notAfter.getTime() > bundleExpiresAt.getTime() + CLOCK_SKEW_MS) {
    throw new Error("commercial_checkpoint_trust_key_outside_bundle_window");
  }
  return {
    keyId,
    purpose: input.purpose,
    status: input.status,
    publicKeyPem,
    publicKeyFingerprint: fingerprint,
    notBefore: notBefore.toISOString(),
    notAfter: notAfter.toISOString(),
  };
}

function validateThreshold(value: unknown, code: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 2 || number > 5) throw new Error(code);
  return number;
}

function normalizeTrustBundleCore(input: Omit<CommercialCohortTrustBundle, "bundleDigest" | "rootSignatures">) {
  if (!input || input.schemaVersion !== PASS4811_TRUST_BUNDLE_SCHEMA || input.policyVersion !== PASS4811_PUBLIC_CHECKPOINT_POLICY_ID) {
    throw new Error("commercial_checkpoint_trust_bundle_schema_invalid");
  }
  const epoch = Number(input.epoch);
  if (!Number.isInteger(epoch) || epoch < 1 || epoch > 1_000_000) throw new Error("commercial_checkpoint_trust_epoch_invalid");
  const issuedAt = parseDate(input.issuedAt, "commercial_checkpoint_trust_issued_at_invalid");
  const notBefore = parseDate(input.notBefore, "commercial_checkpoint_trust_not_before_invalid");
  const expiresAt = parseDate(input.expiresAt, "commercial_checkpoint_trust_expires_at_invalid");
  if (notBefore.getTime() < issuedAt.getTime() || expiresAt.getTime() <= notBefore.getTime()) throw new Error("commercial_checkpoint_trust_window_invalid");
  if (expiresAt.getTime() - issuedAt.getTime() > MAX_TRUST_LIFETIME_MS) throw new Error("commercial_checkpoint_trust_window_too_long");
  const releaseSignatureThreshold = validateThreshold(input.releaseSignatureThreshold, "commercial_checkpoint_release_threshold_invalid");
  const witnessSignatureThreshold = validateThreshold(input.witnessSignatureThreshold, "commercial_checkpoint_witness_threshold_invalid");
  const keys = input.keys.map((item) => normalizeTrustKey(item, notBefore, expiresAt)).sort((left, right) => left.keyId.localeCompare(right.keyId));
  if (keys.length < releaseSignatureThreshold + witnessSignatureThreshold || keys.length > 20) throw new Error("commercial_checkpoint_trust_key_count_invalid");
  if (new Set(keys.map((item) => item.keyId)).size !== keys.length) throw new Error("commercial_checkpoint_trust_key_id_duplicate");
  if (new Set(keys.map((item) => item.publicKeyFingerprint)).size !== keys.length) throw new Error("commercial_checkpoint_trust_key_fingerprint_duplicate");
  const activeRelease = keys.filter((item) => item.purpose === "release" && item.status === "active").length;
  const activeWitness = keys.filter((item) => item.purpose === "witness" && item.status === "active").length;
  const usableRelease = keys.filter((item) => item.purpose === "release" && item.status !== "revoked").length;
  const usableWitness = keys.filter((item) => item.purpose === "witness" && item.status !== "revoked").length;
  if (activeRelease < 1 || activeWitness < 1 || usableRelease < releaseSignatureThreshold || usableWitness < witnessSignatureThreshold) {
    throw new Error("commercial_checkpoint_trust_threshold_unserviceable");
  }
  const previousBundleDigest = epoch === 1
    ? (input.previousBundleDigest === null ? null : (() => { throw new Error("commercial_checkpoint_genesis_previous_bundle_forbidden"); })())
    : requiredDigest(input.previousBundleDigest, "commercial_checkpoint_previous_bundle_digest_invalid");
  const revokedCheckpointDigests = unique((input.revokedCheckpointDigests ?? []).map((item) => requiredDigest(item, "commercial_checkpoint_revoked_digest_invalid")));
  return {
    schemaVersion: PASS4811_TRUST_BUNDLE_SCHEMA,
    policyVersion: PASS4811_PUBLIC_CHECKPOINT_POLICY_ID,
    epoch,
    issuedAt: issuedAt.toISOString(),
    notBefore: notBefore.toISOString(),
    expiresAt: expiresAt.toISOString(),
    previousBundleDigest,
    releaseSignatureThreshold,
    witnessSignatureThreshold,
    keys,
    revokedCheckpointDigests,
  } as const;
}

export function prepareCommercialCohortTrustBundle(args: {
  epoch: number;
  issuedAt?: Date;
  notBefore: Date;
  expiresAt: Date;
  previousBundle?: CommercialCohortTrustBundle | null;
  releaseSignatureThreshold: number;
  witnessSignatureThreshold: number;
  keys: CommercialCohortTrustKey[];
  revokedCheckpointDigests?: string[];
}): CommercialCohortTrustBundlePreparation {
  const issuedAt = args.issuedAt ?? new Date();
  const core = normalizeTrustBundleCore({
    schemaVersion: PASS4811_TRUST_BUNDLE_SCHEMA,
    policyVersion: PASS4811_PUBLIC_CHECKPOINT_POLICY_ID,
    epoch: args.epoch,
    issuedAt: issuedAt.toISOString(),
    notBefore: args.notBefore.toISOString(),
    expiresAt: args.expiresAt.toISOString(),
    previousBundleDigest: args.previousBundle?.bundleDigest ?? null,
    releaseSignatureThreshold: args.releaseSignatureThreshold,
    witnessSignatureThreshold: args.witnessSignatureThreshold,
    keys: args.keys,
    revokedCheckpointDigests: args.revokedCheckpointDigests ?? [],
  });
  if (core.epoch > 1) {
    if (!args.previousBundle || args.previousBundle.epoch !== core.epoch - 1 || core.previousBundleDigest !== args.previousBundle.bundleDigest) {
      throw new Error("commercial_checkpoint_previous_bundle_binding_invalid");
    }
  }
  const bundleDigest = sha256Digest(canonicalJson(trustBundleCore(core)));
  return {
    core,
    bundleDigest,
    rootSignaturePayload: commercialCohortRootSignaturePayload(bundleDigest, core.epoch),
  };
}

export function finalizeCommercialCohortTrustBundle(args: {
  preparation: CommercialCohortTrustBundlePreparation;
  rootSignatures: CommercialCohortDetachedSignature[];
}): CommercialCohortTrustBundle {
  const rootSignatures = (args.rootSignatures ?? []).map((item) => ({
    keyId: requiredId(item?.keyId, "commercial_checkpoint_root_signature_key_invalid", KEY_ID),
    signature: requiredEd25519Signature(item?.signature, "commercial_checkpoint_root_signature_encoding_invalid"),
  })).sort((left, right) => left.keyId.localeCompare(right.keyId));
  if (new Set(rootSignatures.map((item) => item.keyId)).size !== rootSignatures.length) {
    throw new Error("commercial_checkpoint_root_signature_duplicate");
  }
  return { ...args.preparation.core, bundleDigest: args.preparation.bundleDigest, rootSignatures };
}

export function buildCommercialCohortTrustBundle(args: {
  epoch: number;
  issuedAt?: Date;
  notBefore: Date;
  expiresAt: Date;
  previousBundle?: CommercialCohortTrustBundle | null;
  releaseSignatureThreshold: number;
  witnessSignatureThreshold: number;
  keys: CommercialCohortTrustKey[];
  revokedCheckpointDigests?: string[];
  rootSigners: CommercialCohortPrivateSigner[];
}): CommercialCohortTrustBundle {
  const preparation = prepareCommercialCohortTrustBundle(args);
  return finalizeCommercialCohortTrustBundle({
    preparation,
    rootSignatures: args.rootSigners.map((signer) => ({
      keyId: requiredId(signer.keyId, "commercial_checkpoint_root_signer_id_invalid", KEY_ID),
      signature: signPayload(signer.privateKeyPem, preparation.rootSignaturePayload),
    })),
  });
}

export function verifyCommercialCohortTrustChain(args: {
  bundles: CommercialCohortTrustBundle[];
  rootPublicKeys: CommercialCohortRootPublicKey[];
  rootSignatureThreshold: number;
  now?: Date;
}): { verified: boolean; currentBundle: CommercialCohortTrustBundle | null; blockers: string[] } {
  const blockers: string[] = [];
  let currentBundle: CommercialCohortTrustBundle | null = null;
  try {
    const rootKeys = normalizeRootKeys(args.rootPublicKeys);
    const threshold = validateThreshold(args.rootSignatureThreshold, "commercial_checkpoint_root_threshold_invalid");
    if (rootKeys.length < threshold) throw new Error("commercial_checkpoint_root_threshold_unserviceable");
    if (!Array.isArray(args.bundles) || args.bundles.length < 1 || args.bundles.length > 128) throw new Error("commercial_checkpoint_trust_chain_invalid");
    const rootById = new Map(rootKeys.map((item) => [item.keyId, item]));
    let previousDigest: string | null = null;
    for (let index = 0; index < args.bundles.length; index += 1) {
      const bundle = args.bundles[index];
      const core = normalizeTrustBundleCore(bundle);
      if (core.epoch !== index + 1) blockers.push(`commercial_checkpoint_trust_epoch_gap:${core.epoch}/${index + 1}`);
      if (core.previousBundleDigest !== previousDigest) blockers.push(`commercial_checkpoint_trust_previous_mismatch:${core.epoch}`);
      const expectedDigest = sha256Digest(canonicalJson(trustBundleCore(core)));
      if (bundle.bundleDigest !== expectedDigest) blockers.push(`commercial_checkpoint_trust_digest_invalid:${core.epoch}`);
      const seen = new Set<string>();
      let validSignatures = 0;
      for (const signature of bundle.rootSignatures ?? []) {
        const keyId = requiredId(signature?.keyId, "commercial_checkpoint_root_signature_key_invalid", KEY_ID);
        if (seen.has(keyId)) {
          blockers.push(`commercial_checkpoint_root_signature_duplicate:${core.epoch}:${keyId}`);
          continue;
        }
        seen.add(keyId);
        const key = rootById.get(keyId);
        if (key && verifyPayload(key.publicKeyPem, commercialCohortRootSignaturePayload(bundle.bundleDigest, core.epoch), signature.signature)) validSignatures += 1;
        else blockers.push(`commercial_checkpoint_root_signature_invalid:${core.epoch}:${keyId}`);
      }
      if (validSignatures < threshold) blockers.push(`commercial_checkpoint_root_signature_threshold:${core.epoch}:${validSignatures}/${threshold}`);
      previousDigest = bundle.bundleDigest;
      currentBundle = bundle;
    }
    const now = args.now ?? new Date();
    if (currentBundle) {
      const notBefore = parseDate(currentBundle.notBefore, "commercial_checkpoint_current_trust_not_before_invalid");
      const expiresAt = parseDate(currentBundle.expiresAt, "commercial_checkpoint_current_trust_expires_at_invalid");
      if (now.getTime() + CLOCK_SKEW_MS < notBefore.getTime()) blockers.push("commercial_checkpoint_current_trust_not_active");
      if (now.getTime() >= expiresAt.getTime()) blockers.push("commercial_checkpoint_current_trust_expired");
    }
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "commercial_checkpoint_trust_chain_validation_failed");
  }
  const uniqueBlockers = unique(blockers);
  return { verified: uniqueBlockers.length === 0 && Boolean(currentBundle), currentBundle, blockers: uniqueBlockers };
}

function attestationDigest(attestation: CommercialCohortAttestation): string {
  return sha256Digest(canonicalJson(attestation));
}

function receiptDigest(receipt: CommercialCohortAntiCherryPickReceipt): string {
  return sha256Digest(canonicalJson(receipt));
}

function aggregateVersionRoot(manifest: CommercialCohortManifest, field: "runtimeVersions" | "providerConfigDigests"): string {
  const values = Object.entries(manifest.aggregateByProduct)
    .flatMap(([product, aggregate]) => aggregate[field].map((value) => `${product}:${value}`))
    .sort();
  if (!values.length) throw new Error(`commercial_checkpoint_${field}_missing`);
  return sha256Digest(canonicalJson(values));
}

function releaseContextDigest(manifest: CommercialCohortManifest, antiReceipt: CommercialCohortAntiCherryPickReceipt): string {
  return sha256Digest(canonicalJson({
    schemaVersion: "velmere.commercial-cohort-release-context.v1",
    checkpointPolicy: PASS4811_PUBLIC_CHECKPOINT_POLICY_ID,
    cohortPolicy: manifest.policyVersion,
    antiCherryPickPolicy: antiReceipt.policyVersion,
    manifestSchema: manifest.schemaVersion,
    antiCherryPickSchema: antiReceipt.schemaVersion,
  }));
}

export function commercialCohortCheckpointCore(
  checkpoint: Omit<CommercialCohortPublicCheckpoint, "releaseSignatures" | "externalWitnesses" | "checkpointDigest">,
) {
  return checkpoint;
}

export function commercialCohortCheckpointCoreDigest(
  checkpoint: Omit<CommercialCohortPublicCheckpoint, "releaseSignatures" | "externalWitnesses" | "checkpointDigest">,
): string {
  return sha256Digest(canonicalJson(commercialCohortCheckpointCore(checkpoint)));
}

export function commercialCohortReleaseSignaturePayload(coreDigest: string) {
  return {
    schemaVersion: "velmere.commercial-cohort-public-checkpoint-release-signature.v1",
    policyVersion: PASS4811_PUBLIC_CHECKPOINT_POLICY_ID,
    coreDigest,
  } as const;
}

export function commercialCohortReleaseSignatureRoot(signatures: CommercialCohortReleaseSignature[]): string {
  return sha256Digest(canonicalJson(signatures.map((item) => ({ keyId: item.keyId, signature: item.signature })).sort((a, b) => a.keyId.localeCompare(b.keyId))));
}

export function commercialCohortWitnessPayload(args: {
  coreDigest: string;
  releaseSignatureRoot: string;
  sinkId: string;
  publicUrl: string;
  publishedAt: string;
  receiptDigest: string;
  logIndex: string;
}) {
  return {
    schemaVersion: "velmere.commercial-cohort-public-checkpoint-witness.v1",
    policyVersion: PASS4811_PUBLIC_CHECKPOINT_POLICY_ID,
    ...args,
  } as const;
}

function witnessHostIsPublic(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (host === "::1" || host === "0:0:0:0:0:0:0:1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return false;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  return true;
}

function normalizePublicUrl(value: unknown): string {
  const text = clean(value, 1024);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("commercial_checkpoint_witness_url_invalid");
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash || !witnessHostIsPublic(url.hostname)) {
    throw new Error("commercial_checkpoint_witness_url_invalid");
  }
  return url.toString();
}

function normalizeCheckpointCore(input: Omit<CommercialCohortPublicCheckpoint, "releaseSignatures" | "externalWitnesses" | "checkpointDigest">) {
  if (!input || input.schemaVersion !== PASS4811_PUBLIC_CHECKPOINT_SCHEMA || input.policyVersion !== PASS4811_PUBLIC_CHECKPOINT_POLICY_ID) {
    throw new Error("commercial_checkpoint_schema_invalid");
  }
  if (!(input.environment === "staging" || input.environment === "production")) throw new Error("commercial_checkpoint_environment_invalid");
  const audience = requiredId(input.audience, "commercial_checkpoint_audience_invalid");
  const sequence = Number(input.sequence);
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 1_000_000_000) throw new Error("commercial_checkpoint_sequence_invalid");
  const previousCheckpointDigest = sequence === 1
    ? (input.previousCheckpointDigest === null ? null : (() => { throw new Error("commercial_checkpoint_genesis_previous_forbidden"); })())
    : requiredDigest(input.previousCheckpointDigest, "commercial_checkpoint_previous_digest_invalid");
  const trustEpoch = Number(input.trustEpoch);
  if (!Number.isInteger(trustEpoch) || trustEpoch < 1) throw new Error("commercial_checkpoint_trust_epoch_invalid");
  const issuedAt = parseDate(input.issuedAt, "commercial_checkpoint_issued_at_invalid");
  const expiresAt = parseDate(input.expiresAt, "commercial_checkpoint_expires_at_invalid");
  const cohortWindowEnd = parseDate(input.cohortWindowEnd, "commercial_checkpoint_window_end_invalid");
  if (cohortWindowEnd.getTime() > issuedAt.getTime()) throw new Error("commercial_checkpoint_before_cohort_window_end");
  if (expiresAt.getTime() <= issuedAt.getTime() || expiresAt.getTime() - issuedAt.getTime() > MAX_CHECKPOINT_LIFETIME_MS) throw new Error("commercial_checkpoint_freshness_window_invalid");
  const nonce = requiredId(input.nonce, "commercial_checkpoint_nonce_invalid");
  return {
    schemaVersion: PASS4811_PUBLIC_CHECKPOINT_SCHEMA,
    policyVersion: PASS4811_PUBLIC_CHECKPOINT_POLICY_ID,
    environment: input.environment,
    audience,
    sequence,
    previousCheckpointDigest,
    trustBundleDigest: requiredDigest(input.trustBundleDigest, "commercial_checkpoint_trust_bundle_digest_invalid"),
    trustEpoch,
    manifestDigest: requiredDigest(input.manifestDigest, "commercial_checkpoint_manifest_digest_invalid"),
    attestationDigest: requiredDigest(input.attestationDigest, "commercial_checkpoint_attestation_digest_invalid"),
    antiCherryPickReceiptDigest: requiredDigest(input.antiCherryPickReceiptDigest, "commercial_checkpoint_receipt_digest_invalid"),
    cohortWindowEnd: cohortWindowEnd.toISOString(),
    runtimeVersionRoot: requiredDigest(input.runtimeVersionRoot, "commercial_checkpoint_runtime_root_invalid"),
    providerConfigRoot: requiredDigest(input.providerConfigRoot, "commercial_checkpoint_provider_root_invalid"),
    releaseContextDigest: requiredDigest(input.releaseContextDigest, "commercial_checkpoint_context_digest_invalid"),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    nonce,
  } as const;
}

export function prepareCommercialCohortPublicCheckpoint(args: {
  environment: "staging" | "production";
  audience: string;
  sequence: number;
  previousCheckpoint?: CommercialCohortPublicCheckpoint | null;
  trustBundle: CommercialCohortTrustBundle;
  attestation: CommercialCohortAttestation;
  antiCherryPickReceipt: CommercialCohortAntiCherryPickReceipt;
  attestationSecret: string;
  attestationApproverSecret: string;
  antiCherryPickSecret: string;
  antiCherryPickApproverSecret: string;
  issuedAt?: Date;
  expiresAt: Date;
  nonce: string;
}): CommercialCohortPublicCheckpointPreparation {
  const issuedAt = args.issuedAt ?? new Date();
  const attestationVerification = verifyCommercialCohortAttestation({
    attestation: args.attestation,
    secret: args.attestationSecret,
    now: issuedAt,
  });
  if (!attestationVerification.verified) throw new Error(`commercial_checkpoint_attestation_invalid:${attestationVerification.blockers.join("|")}`);
  const approvalVerification = verifyCommercialCohortApproval({
    attestation: args.attestation,
    approverSecret: args.attestationApproverSecret,
    now: issuedAt,
  });
  if (!approvalVerification.verified) throw new Error(`commercial_checkpoint_attestation_approval_invalid:${approvalVerification.blockers.join("|")}`);
  const receiptVerification = verifyCommercialCohortAntiCherryPickReceipt({
    receipt: args.antiCherryPickReceipt,
    manifest: args.attestation.manifest,
    secret: args.antiCherryPickSecret,
    approverSecret: args.antiCherryPickApproverSecret,
    requireApproval: true,
    now: issuedAt,
  });
  if (!receiptVerification.verified) throw new Error(`commercial_checkpoint_anti_cherry_pick_invalid:${receiptVerification.blockers.join("|")}`);
  const attestationExpiresAt = parseDate(args.attestation.expiresAt, "commercial_checkpoint_attestation_expiry_invalid");
  if (args.expiresAt.getTime() > attestationExpiresAt.getTime()) throw new Error("commercial_checkpoint_outlives_attestation");
  if (args.sequence === 1 && args.previousCheckpoint) throw new Error("commercial_checkpoint_genesis_previous_forbidden");
  if (args.sequence > 1 && (!args.previousCheckpoint || args.previousCheckpoint.sequence !== args.sequence - 1)) {
    throw new Error("commercial_checkpoint_previous_sequence_invalid");
  }
  const core = normalizeCheckpointCore({
    schemaVersion: PASS4811_PUBLIC_CHECKPOINT_SCHEMA,
    policyVersion: PASS4811_PUBLIC_CHECKPOINT_POLICY_ID,
    environment: args.environment,
    audience: args.audience,
    sequence: args.sequence,
    previousCheckpointDigest: args.previousCheckpoint?.checkpointDigest ?? null,
    trustBundleDigest: args.trustBundle.bundleDigest,
    trustEpoch: args.trustBundle.epoch,
    manifestDigest: args.attestation.manifest.manifestDigest,
    attestationDigest: attestationDigest(args.attestation),
    antiCherryPickReceiptDigest: receiptDigest(args.antiCherryPickReceipt),
    cohortWindowEnd: args.attestation.manifest.windowEnd,
    runtimeVersionRoot: aggregateVersionRoot(args.attestation.manifest, "runtimeVersions"),
    providerConfigRoot: aggregateVersionRoot(args.attestation.manifest, "providerConfigDigests"),
    releaseContextDigest: releaseContextDigest(args.attestation.manifest, args.antiCherryPickReceipt),
    issuedAt: issuedAt.toISOString(),
    expiresAt: args.expiresAt.toISOString(),
    nonce: args.nonce,
  });
  const coreDigest = commercialCohortCheckpointCoreDigest(core);
  return { core, coreDigest, releaseSignaturePayload: commercialCohortReleaseSignaturePayload(coreDigest) };
}

export function finalizeCommercialCohortPublicCheckpoint(args: {
  preparation: CommercialCohortPublicCheckpointPreparation;
  releaseSignatures: CommercialCohortDetachedSignature[];
  externalWitnesses: Array<CommercialCohortUnsignedExternalWitness & { signature: string }>;
}): CommercialCohortPublicCheckpoint {
  const releaseSignatures = (args.releaseSignatures ?? []).map((item) => ({
    keyId: requiredId(item?.keyId, "commercial_checkpoint_release_signer_id_invalid", KEY_ID),
    signature: requiredEd25519Signature(item?.signature, "commercial_checkpoint_release_signature_encoding_invalid"),
  })).sort((left, right) => left.keyId.localeCompare(right.keyId));
  if (new Set(releaseSignatures.map((item) => item.keyId)).size !== releaseSignatures.length) {
    throw new Error("commercial_checkpoint_release_signature_duplicate");
  }
  const externalWitnesses = (args.externalWitnesses ?? []).map((item) => ({
    keyId: requiredId(item?.keyId, "commercial_checkpoint_witness_key_id_invalid", KEY_ID),
    sinkId: requiredId(item?.sinkId, "commercial_checkpoint_witness_sink_id_invalid"),
    publicUrl: normalizePublicUrl(item?.publicUrl),
    publishedAt: parseDate(item?.publishedAt, "commercial_checkpoint_witness_published_at_invalid").toISOString(),
    receiptDigest: requiredDigest(item?.receiptDigest, "commercial_checkpoint_witness_receipt_digest_invalid"),
    logIndex: requiredId(item?.logIndex, "commercial_checkpoint_witness_log_index_invalid"),
    signature: requiredEd25519Signature(item?.signature, "commercial_checkpoint_witness_signature_encoding_invalid"),
  })).sort((left, right) => left.keyId.localeCompare(right.keyId));
  if (new Set(externalWitnesses.map((item) => item.keyId)).size !== externalWitnesses.length) throw new Error("commercial_checkpoint_witness_key_duplicate");
  if (new Set(externalWitnesses.map((item) => item.sinkId)).size !== externalWitnesses.length) throw new Error("commercial_checkpoint_witness_sink_duplicate");
  const hosts = externalWitnesses.map((item) => new URL(item.publicUrl).hostname.toLowerCase());
  if (new Set(hosts).size !== hosts.length) throw new Error("commercial_checkpoint_witness_host_duplicate");
  const checkpointDigest = sha256Digest(canonicalJson({ core: args.preparation.core, releaseSignatures, externalWitnesses }));
  return { ...args.preparation.core, releaseSignatures, externalWitnesses, checkpointDigest };
}

export function buildCommercialCohortPublicCheckpoint(args: {
  environment: "staging" | "production";
  audience: string;
  sequence: number;
  previousCheckpoint?: CommercialCohortPublicCheckpoint | null;
  trustBundle: CommercialCohortTrustBundle;
  attestation: CommercialCohortAttestation;
  antiCherryPickReceipt: CommercialCohortAntiCherryPickReceipt;
  attestationSecret: string;
  attestationApproverSecret: string;
  antiCherryPickSecret: string;
  antiCherryPickApproverSecret: string;
  issuedAt?: Date;
  expiresAt: Date;
  nonce: string;
  releaseSigners: CommercialCohortPrivateSigner[];
  externalWitnessSigners: Array<CommercialCohortPrivateSigner & {
    sinkId: string;
    publicUrl: string;
    publishedAt: Date;
    receiptDigest: string;
    logIndex: string;
  }>;
}): CommercialCohortPublicCheckpoint {
  const preparation = prepareCommercialCohortPublicCheckpoint(args);
  const releaseSignatures = args.releaseSigners.map((signer) => ({
    keyId: requiredId(signer.keyId, "commercial_checkpoint_release_signer_id_invalid", KEY_ID),
    signature: signPayload(signer.privateKeyPem, preparation.releaseSignaturePayload),
  }));
  const releaseSignatureRoot = commercialCohortReleaseSignatureRoot(releaseSignatures);
  const externalWitnesses = args.externalWitnessSigners.map((signer) => {
    const unsigned = {
      keyId: requiredId(signer.keyId, "commercial_checkpoint_witness_key_id_invalid", KEY_ID),
      sinkId: requiredId(signer.sinkId, "commercial_checkpoint_witness_sink_id_invalid"),
      publicUrl: normalizePublicUrl(signer.publicUrl),
      publishedAt: signer.publishedAt.toISOString(),
      receiptDigest: requiredDigest(signer.receiptDigest, "commercial_checkpoint_witness_receipt_digest_invalid"),
      logIndex: requiredId(signer.logIndex, "commercial_checkpoint_witness_log_index_invalid"),
    };
    return {
      ...unsigned,
      signature: signPayload(signer.privateKeyPem, commercialCohortWitnessPayload({
        coreDigest: preparation.coreDigest,
        releaseSignatureRoot,
        sinkId: unsigned.sinkId,
        publicUrl: unsigned.publicUrl,
        publishedAt: unsigned.publishedAt,
        receiptDigest: unsigned.receiptDigest,
        logIndex: unsigned.logIndex,
      })),
    };
  });
  return finalizeCommercialCohortPublicCheckpoint({ preparation, releaseSignatures, externalWitnesses });
}

function findTrustBundle(bundles: CommercialCohortTrustBundle[], digest: string, epoch: number): CommercialCohortTrustBundle | null {
  return bundles.find((item) => item.bundleDigest === digest && item.epoch === epoch) ?? null;
}

function keyUsableAt(key: CommercialCohortTrustKey, purpose: CommercialCohortTrustKey["purpose"], at: Date): boolean {
  if (key.purpose !== purpose || key.status === "revoked") return false;
  return at.getTime() >= new Date(key.notBefore).getTime() && at.getTime() < new Date(key.notAfter).getTime();
}

function verifySingleCheckpoint(args: {
  checkpoint: CommercialCohortPublicCheckpoint;
  previousCheckpoint: CommercialCohortPublicCheckpoint | null;
  trustBundle: CommercialCohortTrustBundle;
  now: Date;
  current: boolean;
}): string[] {
  const blockers: string[] = [];
  try {
    const checkpoint = args.checkpoint;
    const core = normalizeCheckpointCore(checkpoint);
    if (core.trustBundleDigest !== args.trustBundle.bundleDigest || core.trustEpoch !== args.trustBundle.epoch) blockers.push(`commercial_checkpoint_trust_binding_invalid:${core.sequence}`);
    if (core.sequence === 1) {
      if (args.previousCheckpoint) blockers.push("commercial_checkpoint_genesis_previous_present");
    } else {
      if (!args.previousCheckpoint || args.previousCheckpoint.sequence !== core.sequence - 1 || core.previousCheckpointDigest !== args.previousCheckpoint.checkpointDigest) {
        blockers.push(`commercial_checkpoint_chain_previous_invalid:${core.sequence}`);
      }
      if (args.previousCheckpoint && core.trustEpoch < args.previousCheckpoint.trustEpoch) blockers.push(`commercial_checkpoint_trust_epoch_rollback:${core.sequence}`);
    }
    const issuedAt = new Date(core.issuedAt);
    const bundleNotBefore = new Date(args.trustBundle.notBefore);
    const bundleExpiresAt = new Date(args.trustBundle.expiresAt);
    if (issuedAt.getTime() < bundleNotBefore.getTime() || issuedAt.getTime() >= bundleExpiresAt.getTime()) blockers.push(`commercial_checkpoint_outside_trust_window:${core.sequence}`);
    if (args.current) {
      if (issuedAt.getTime() > args.now.getTime() + CLOCK_SKEW_MS) blockers.push("commercial_checkpoint_issued_in_future");
      if (new Date(core.expiresAt).getTime() <= args.now.getTime()) blockers.push("commercial_checkpoint_expired");
    }
    const coreDigest = commercialCohortCheckpointCoreDigest(core);
    const keys = new Map(args.trustBundle.keys.map((item) => [item.keyId, item]));
    const releaseSeen = new Set<string>();
    let releaseValid = 0;
    let activeRelease = 0;
    for (const signature of checkpoint.releaseSignatures ?? []) {
      const keyId = requiredId(signature?.keyId, "commercial_checkpoint_release_signature_key_invalid", KEY_ID);
      if (releaseSeen.has(keyId)) {
        blockers.push(`commercial_checkpoint_release_signature_duplicate:${core.sequence}:${keyId}`);
        continue;
      }
      releaseSeen.add(keyId);
      const key = keys.get(keyId);
      if (!key || !keyUsableAt(key, "release", issuedAt)) {
        blockers.push(`commercial_checkpoint_release_signer_invalid:${core.sequence}:${keyId}`);
        continue;
      }
      if (!verifyPayload(key.publicKeyPem, commercialCohortReleaseSignaturePayload(coreDigest), signature.signature)) blockers.push(`commercial_checkpoint_release_signature_invalid:${core.sequence}:${keyId}`);
      else {
        releaseValid += 1;
        if (key.status === "active") activeRelease += 1;
      }
    }
    if (releaseValid < args.trustBundle.releaseSignatureThreshold) blockers.push(`commercial_checkpoint_release_threshold:${core.sequence}:${releaseValid}/${args.trustBundle.releaseSignatureThreshold}`);
    if (activeRelease < 1) blockers.push(`commercial_checkpoint_active_release_signer_missing:${core.sequence}`);
    const normalizedReleaseSignatures = (checkpoint.releaseSignatures ?? []).map((item) => ({ keyId: item.keyId, signature: item.signature })).sort((a, b) => a.keyId.localeCompare(b.keyId));
    const signatureRoot = commercialCohortReleaseSignatureRoot(normalizedReleaseSignatures);
    const witnessSeen = new Set<string>();
    const sinkSeen = new Set<string>();
    const hostSeen = new Set<string>();
    let witnessValid = 0;
    let activeWitness = 0;
    for (const witness of checkpoint.externalWitnesses ?? []) {
      const keyId = requiredId(witness?.keyId, "commercial_checkpoint_witness_key_invalid", KEY_ID);
      const sinkId = requiredId(witness?.sinkId, "commercial_checkpoint_witness_sink_invalid");
      const publicUrl = normalizePublicUrl(witness?.publicUrl);
      const host = new URL(publicUrl).hostname.toLowerCase();
      if (witnessSeen.has(keyId) || sinkSeen.has(sinkId) || hostSeen.has(host)) {
        blockers.push(`commercial_checkpoint_witness_independence_invalid:${core.sequence}:${keyId}`);
        continue;
      }
      witnessSeen.add(keyId);
      sinkSeen.add(sinkId);
      hostSeen.add(host);
      const key = keys.get(keyId);
      const publishedAt = parseDate(witness.publishedAt, "commercial_checkpoint_witness_published_at_invalid");
      if (publishedAt.getTime() < issuedAt.getTime() || publishedAt.getTime() > new Date(core.expiresAt).getTime()) blockers.push(`commercial_checkpoint_witness_time_invalid:${core.sequence}:${keyId}`);
      if (args.current && publishedAt.getTime() > args.now.getTime() + CLOCK_SKEW_MS) blockers.push(`commercial_checkpoint_witness_published_in_future:${core.sequence}:${keyId}`);
      const receipt = requiredDigest(witness.receiptDigest, "commercial_checkpoint_witness_receipt_digest_invalid");
      const logIndex = requiredId(witness.logIndex, "commercial_checkpoint_witness_log_index_invalid");
      if (!key || !keyUsableAt(key, "witness", publishedAt)) {
        blockers.push(`commercial_checkpoint_witness_signer_invalid:${core.sequence}:${keyId}`);
        continue;
      }
      const payload = commercialCohortWitnessPayload({ coreDigest, releaseSignatureRoot: signatureRoot, sinkId, publicUrl, publishedAt: publishedAt.toISOString(), receiptDigest: receipt, logIndex });
      if (!verifyPayload(key.publicKeyPem, payload, witness.signature)) blockers.push(`commercial_checkpoint_witness_signature_invalid:${core.sequence}:${keyId}`);
      else {
        witnessValid += 1;
        if (key.status === "active") activeWitness += 1;
      }
    }
    if (witnessValid < args.trustBundle.witnessSignatureThreshold) blockers.push(`commercial_checkpoint_witness_threshold:${core.sequence}:${witnessValid}/${args.trustBundle.witnessSignatureThreshold}`);
    if (activeWitness < 1) blockers.push(`commercial_checkpoint_active_witness_missing:${core.sequence}`);
    const expectedDigest = sha256Digest(canonicalJson({ core, releaseSignatures: normalizedReleaseSignatures, externalWitnesses: (checkpoint.externalWitnesses ?? []).slice().sort((a, b) => a.keyId.localeCompare(b.keyId)) }));
    if (checkpoint.checkpointDigest !== expectedDigest) blockers.push(`commercial_checkpoint_digest_invalid:${core.sequence}`);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "commercial_checkpoint_validation_failed");
  }
  return unique(blockers);
}

export function verifyCommercialCohortPublicCheckpointChain(args: {
  checkpoints: CommercialCohortPublicCheckpoint[];
  trustBundles: CommercialCohortTrustBundle[];
  rootPublicKeys: CommercialCohortRootPublicKey[];
  rootSignatureThreshold: number;
  attestation: CommercialCohortAttestation;
  antiCherryPickReceipt: CommercialCohortAntiCherryPickReceipt;
  expectedEnvironment: "staging" | "production";
  expectedAudience: string;
  minimumSequence: number;
  now?: Date;
}): CommercialCohortPublicCheckpointVerification {
  const blockers: string[] = [];
  let current: CommercialCohortPublicCheckpoint | null = null;
  let trustEpoch: number | null = null;
  let externalWitnessCount = 0;
  let keyRotationVerified = false;
  try {
    const now = args.now ?? new Date();
    const trust = verifyCommercialCohortTrustChain({
      bundles: args.trustBundles,
      rootPublicKeys: args.rootPublicKeys,
      rootSignatureThreshold: args.rootSignatureThreshold,
      now,
    });
    blockers.push(...trust.blockers);
    keyRotationVerified = trust.verified && args.trustBundles.every((bundle, index) => bundle.epoch === index + 1 && bundle.previousBundleDigest === (index === 0 ? null : args.trustBundles[index - 1].bundleDigest));
    if (!Array.isArray(args.checkpoints) || args.checkpoints.length < 1 || args.checkpoints.length > 1024) throw new Error("commercial_checkpoint_chain_invalid");
    const checkpointDigests = new Set<string>();
    const nonces = new Set<string>();
    for (let index = 0; index < args.checkpoints.length; index += 1) {
      const checkpoint = args.checkpoints[index];
      if (checkpoint.sequence !== index + 1) blockers.push(`commercial_checkpoint_sequence_gap:${checkpoint.sequence}/${index + 1}`);
      if (checkpointDigests.has(checkpoint.checkpointDigest)) blockers.push(`commercial_checkpoint_digest_reused:${checkpoint.sequence}`);
      if (nonces.has(checkpoint.nonce)) blockers.push(`commercial_checkpoint_nonce_reused:${checkpoint.sequence}`);
      checkpointDigests.add(checkpoint.checkpointDigest);
      nonces.add(checkpoint.nonce);
      const bundle = findTrustBundle(args.trustBundles, checkpoint.trustBundleDigest, checkpoint.trustEpoch);
      if (!bundle) blockers.push(`commercial_checkpoint_trust_bundle_missing:${checkpoint.sequence}`);
      else blockers.push(...verifySingleCheckpoint({
        checkpoint,
        previousCheckpoint: index > 0 ? args.checkpoints[index - 1] : null,
        trustBundle: bundle,
        now,
        current: index === args.checkpoints.length - 1,
      }));
      current = checkpoint;
    }
    if (!current) throw new Error("commercial_checkpoint_current_missing");
    const minimumSequence = Number(args.minimumSequence);
    if (!Number.isInteger(minimumSequence) || minimumSequence < 1) blockers.push("commercial_checkpoint_minimum_sequence_invalid");
    else if (current.sequence < minimumSequence) blockers.push(`commercial_checkpoint_rollback_floor:${current.sequence}/${minimumSequence}`);
    if (current.environment !== args.expectedEnvironment) blockers.push("commercial_checkpoint_environment_mismatch");
    if (current.audience !== args.expectedAudience) blockers.push("commercial_checkpoint_audience_mismatch");
    const expectedAttestationDigest = attestationDigest(args.attestation);
    const expectedReceiptDigest = receiptDigest(args.antiCherryPickReceipt);
    if (current.manifestDigest !== args.attestation.manifest.manifestDigest || current.attestationDigest !== expectedAttestationDigest || current.antiCherryPickReceiptDigest !== expectedReceiptDigest) {
      blockers.push("commercial_checkpoint_runtime_binding_invalid");
    }
    if (current.cohortWindowEnd !== new Date(args.attestation.manifest.windowEnd).toISOString()) blockers.push("commercial_checkpoint_window_binding_invalid");
    if (current.runtimeVersionRoot !== aggregateVersionRoot(args.attestation.manifest, "runtimeVersions")) blockers.push("commercial_checkpoint_runtime_version_root_invalid");
    if (current.providerConfigRoot !== aggregateVersionRoot(args.attestation.manifest, "providerConfigDigests")) blockers.push("commercial_checkpoint_provider_config_root_invalid");
    if (current.releaseContextDigest !== releaseContextDigest(args.attestation.manifest, args.antiCherryPickReceipt)) blockers.push("commercial_checkpoint_release_context_invalid");
    const currentBundle = args.trustBundles.at(-1) ?? null;
    if (!currentBundle || current.trustBundleDigest !== currentBundle.bundleDigest || current.trustEpoch !== currentBundle.epoch) blockers.push("commercial_checkpoint_not_on_current_trust_epoch");
    if (currentBundle) {
      const revoked = new Set(currentBundle.revokedCheckpointDigests);
      for (const checkpoint of args.checkpoints) if (revoked.has(checkpoint.checkpointDigest)) blockers.push(`commercial_checkpoint_revoked:${checkpoint.sequence}`);
    }
    externalWitnessCount = current.externalWitnesses.length;
    trustEpoch = current.trustEpoch;
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "commercial_checkpoint_chain_validation_failed");
  }
  const uniqueBlockers = unique(blockers);
  const publicCheckpointVerified = uniqueBlockers.length === 0 && Boolean(current);
  const rollbackProtected = publicCheckpointVerified && Boolean(current && current.sequence >= args.minimumSequence && current.previousCheckpointDigest === (current.sequence === 1 ? null : args.checkpoints.at(-2)?.checkpointDigest));
  const externallyWitnessed = publicCheckpointVerified && externalWitnessCount >= 2;
  return {
    verified: publicCheckpointVerified && rollbackProtected && externallyWitnessed && keyRotationVerified,
    publicCheckpointVerified,
    rollbackProtected,
    externallyWitnessed,
    keyRotationVerified,
    deploymentReceiptVerified: false,
    artifactBound: false,
    deploymentRollbackProtected: false,
    deploymentSequence: null,
    deploymentReceiptDigest: null,
    checkpointSequence: current?.sequence ?? null,
    checkpointDigest: current?.checkpointDigest ?? null,
    trustEpoch,
    externalWitnessCount,
    blockers: uniqueBlockers,
  };
}

export function commercialCohortTrustKeyFromPublicKey(args: {
  keyId: string;
  purpose: CommercialCohortTrustKey["purpose"];
  status?: CommercialCohortTrustKey["status"];
  publicKeyPem: string;
  notBefore: Date;
  notAfter: Date;
}): CommercialCohortTrustKey {
  const publicKeyPem = normalizePem(args.publicKeyPem);
  return {
    keyId: requiredId(args.keyId, "commercial_checkpoint_trust_key_id_invalid", KEY_ID),
    purpose: args.purpose,
    status: args.status ?? "active",
    publicKeyPem,
    publicKeyFingerprint: keyFingerprint(ed25519PublicKey(publicKeyPem)),
    notBefore: args.notBefore.toISOString(),
    notAfter: args.notAfter.toISOString(),
  };
}
