import {
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import type { CommercialCohortReproducibleBuildProvenance } from "@/lib/worldclass/commercial-cohort-supply-chain-provenance";
import type {
  CommercialCohortDetachedSignature,
  CommercialCohortPrivateSigner,
  CommercialCohortPublicCheckpoint,
  CommercialCohortTrustBundle,
  CommercialCohortTrustKey,
} from "@/lib/worldclass/commercial-cohort-public-checkpoint";

export const PASS4813_DEPLOYMENT_RECEIPT_POLICY_ID = "pass4813-deployment-receipt-supply-chain-v2" as const;
export const PASS4813_DEPLOYMENT_RECEIPT_SCHEMA = "velmere.commercial-cohort-deployment-receipt.v2" as const;
// Compatibility aliases for imports created before PASS4813. New receipts use the v2 values.
export const PASS4812_DEPLOYMENT_RECEIPT_POLICY_ID = PASS4813_DEPLOYMENT_RECEIPT_POLICY_ID;
export const PASS4812_DEPLOYMENT_RECEIPT_SCHEMA = PASS4813_DEPLOYMENT_RECEIPT_SCHEMA;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,191}$/;
const MAX_RECEIPT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;
const CLOCK_SKEW_MS = 60_000;

export type CommercialCohortDeploymentReceiptCore = {
  schemaVersion: typeof PASS4813_DEPLOYMENT_RECEIPT_SCHEMA;
  policyVersion: typeof PASS4813_DEPLOYMENT_RECEIPT_POLICY_ID;
  environment: "staging" | "production";
  audience: string;
  deploymentSequence: number;
  previousDeploymentReceiptDigest: string | null;
  deploymentId: string;
  rolloutId: string;
  checkpointSequence: number;
  checkpointDigest: string;
  trustEpoch: number;
  trustBundleDigest: string;
  runtimeVersionRoot: string;
  providerConfigRoot: string;
  modelConfigRoot: string;
  buildArtifactDigest: string;
  sourcePackageDigest: string;
  supplyChainProvenanceDigest: string;
  sbomDigest: string;
  vulnerabilitySnapshotDigest: string;
  buildRecipeDigest: string;
  deploymentConfigRoot: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
};

export type CommercialCohortDeploymentReceipt = CommercialCohortDeploymentReceiptCore & {
  signatures: CommercialCohortDetachedSignature[];
  deploymentReceiptDigest: string;
};

export type CommercialCohortDeploymentReceiptPreparation = {
  core: CommercialCohortDeploymentReceiptCore;
  coreDigest: string;
  signaturePayload: ReturnType<typeof commercialCohortDeploymentSignaturePayload>;
};

export type CommercialCohortDeploymentReceiptVerification = {
  verified: boolean;
  deploymentReceiptVerified: boolean;
  artifactBound: boolean;
  supplyChainBound: boolean;
  deploymentRollbackProtected: boolean;
  deploymentSequence: number | null;
  deploymentReceiptDigest: string | null;
  blockers: string[];
};

function clean(value: unknown, max = 4096): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requiredId(value: unknown, code: string): string {
  const text = clean(value, 192);
  if (!SAFE_ID.test(text)) throw new Error(code);
  return text;
}

function requiredDigest(value: unknown, code: string): string {
  const text = clean(value, 80).toLowerCase();
  if (!DIGEST.test(text)) throw new Error(code);
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
  if (key.asymmetricKeyType !== "ed25519") throw new Error("deployment_receipt_public_key_not_ed25519");
  return key;
}

function ed25519PrivateKey(value: unknown): KeyObject {
  const key = createPrivateKey(normalizePem(value));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("deployment_receipt_private_key_not_ed25519");
  return key;
}

function requiredSignature(value: unknown, code: string): string {
  const text = clean(value, 256).replace(/=+$/g, "");
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error(code);
  const bytes = Buffer.from(text, "base64url");
  if (bytes.length !== 64 || bytes.toString("base64url") !== text) throw new Error(code);
  return text;
}

function deploymentCore(receipt: CommercialCohortDeploymentReceiptCore) {
  return receipt;
}

export function commercialCohortDeploymentSignaturePayload(coreDigest: string) {
  return {
    schemaVersion: "velmere.commercial-cohort-deployment-signature.v1",
    policyVersion: PASS4813_DEPLOYMENT_RECEIPT_POLICY_ID,
    coreDigest: requiredDigest(coreDigest, "deployment_receipt_core_digest_invalid"),
  } as const;
}

function signPayload(privateKeyPem: string, payload: unknown): string {
  return cryptoSign(null, Buffer.from(canonicalJson(payload), "utf8"), ed25519PrivateKey(privateKeyPem)).toString("base64url");
}

function verifyPayload(publicKeyPem: string, payload: unknown, signature: string): boolean {
  try {
    return cryptoVerify(
      null,
      Buffer.from(canonicalJson(payload), "utf8"),
      ed25519PublicKey(publicKeyPem),
      Buffer.from(requiredSignature(signature, "deployment_receipt_signature_encoding_invalid"), "base64url"),
    );
  } catch {
    return false;
  }
}

function normalizeCore(input: CommercialCohortDeploymentReceiptCore): CommercialCohortDeploymentReceiptCore {
  if (!input || input.schemaVersion !== PASS4813_DEPLOYMENT_RECEIPT_SCHEMA || input.policyVersion !== PASS4813_DEPLOYMENT_RECEIPT_POLICY_ID) {
    throw new Error("deployment_receipt_schema_invalid");
  }
  if (!(input.environment === "staging" || input.environment === "production")) throw new Error("deployment_receipt_environment_invalid");
  const deploymentSequence = Number(input.deploymentSequence);
  if (!Number.isInteger(deploymentSequence) || deploymentSequence < 1 || deploymentSequence > 1_000_000_000) throw new Error("deployment_receipt_sequence_invalid");
  const previousDeploymentReceiptDigest = deploymentSequence === 1
    ? (input.previousDeploymentReceiptDigest === null ? null : (() => { throw new Error("deployment_receipt_genesis_previous_forbidden"); })())
    : requiredDigest(input.previousDeploymentReceiptDigest, "deployment_receipt_previous_digest_invalid");
  const checkpointSequence = Number(input.checkpointSequence);
  const trustEpoch = Number(input.trustEpoch);
  if (!Number.isInteger(checkpointSequence) || checkpointSequence < 1) throw new Error("deployment_receipt_checkpoint_sequence_invalid");
  if (!Number.isInteger(trustEpoch) || trustEpoch < 1) throw new Error("deployment_receipt_trust_epoch_invalid");
  const issuedAt = parseDate(input.issuedAt, "deployment_receipt_issued_at_invalid");
  const expiresAt = parseDate(input.expiresAt, "deployment_receipt_expires_at_invalid");
  if (expiresAt.getTime() <= issuedAt.getTime() || expiresAt.getTime() - issuedAt.getTime() > MAX_RECEIPT_LIFETIME_MS) {
    throw new Error("deployment_receipt_window_invalid");
  }
  const normalized = {
    schemaVersion: PASS4812_DEPLOYMENT_RECEIPT_SCHEMA,
    policyVersion: PASS4813_DEPLOYMENT_RECEIPT_POLICY_ID,
    environment: input.environment,
    audience: requiredId(input.audience, "deployment_receipt_audience_invalid"),
    deploymentSequence,
    previousDeploymentReceiptDigest,
    deploymentId: requiredId(input.deploymentId, "deployment_receipt_deployment_id_invalid"),
    rolloutId: requiredId(input.rolloutId, "deployment_receipt_rollout_id_invalid"),
    checkpointSequence,
    checkpointDigest: requiredDigest(input.checkpointDigest, "deployment_receipt_checkpoint_digest_invalid"),
    trustEpoch,
    trustBundleDigest: requiredDigest(input.trustBundleDigest, "deployment_receipt_trust_bundle_digest_invalid"),
    runtimeVersionRoot: requiredDigest(input.runtimeVersionRoot, "deployment_receipt_runtime_root_invalid"),
    providerConfigRoot: requiredDigest(input.providerConfigRoot, "deployment_receipt_provider_root_invalid"),
    modelConfigRoot: requiredDigest(input.modelConfigRoot, "deployment_receipt_model_root_invalid"),
    buildArtifactDigest: requiredDigest(input.buildArtifactDigest, "deployment_receipt_build_artifact_digest_invalid"),
    sourcePackageDigest: requiredDigest(input.sourcePackageDigest, "deployment_receipt_source_package_digest_invalid"),
    supplyChainProvenanceDigest: requiredDigest(input.supplyChainProvenanceDigest, "deployment_receipt_supply_chain_provenance_digest_invalid"),
    sbomDigest: requiredDigest(input.sbomDigest, "deployment_receipt_sbom_digest_invalid"),
    vulnerabilitySnapshotDigest: requiredDigest(input.vulnerabilitySnapshotDigest, "deployment_receipt_vulnerability_snapshot_digest_invalid"),
    buildRecipeDigest: requiredDigest(input.buildRecipeDigest, "deployment_receipt_build_recipe_digest_invalid"),
    deploymentConfigRoot: requiredDigest(input.deploymentConfigRoot, "deployment_receipt_config_root_invalid"),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    nonce: requiredId(input.nonce, "deployment_receipt_nonce_invalid"),
  } as const;
  const expectedConfigRoot = sha256Digest(canonicalJson({
    environment: normalized.environment,
    audience: normalized.audience,
    checkpointDigest: normalized.checkpointDigest,
    runtimeVersionRoot: normalized.runtimeVersionRoot,
    providerConfigRoot: normalized.providerConfigRoot,
    modelConfigRoot: normalized.modelConfigRoot,
    buildArtifactDigest: normalized.buildArtifactDigest,
    sourcePackageDigest: normalized.sourcePackageDigest,
    supplyChainProvenanceDigest: normalized.supplyChainProvenanceDigest,
    sbomDigest: normalized.sbomDigest,
    vulnerabilitySnapshotDigest: normalized.vulnerabilitySnapshotDigest,
    buildRecipeDigest: normalized.buildRecipeDigest,
  }));
  if (normalized.deploymentConfigRoot !== expectedConfigRoot) throw new Error("deployment_receipt_config_root_mismatch");
  return normalized;
}

export function prepareCommercialCohortDeploymentReceipt(args: {
  environment: "staging" | "production";
  audience: string;
  deploymentSequence: number;
  previousDeploymentReceipt?: CommercialCohortDeploymentReceipt | null;
  deploymentId: string;
  rolloutId: string;
  checkpoint: CommercialCohortPublicCheckpoint;
  trustBundle: CommercialCohortTrustBundle;
  modelConfigRoot: string;
  buildArtifactDigest: string;
  sourcePackageDigest: string;
  supplyChainProvenance?: CommercialCohortReproducibleBuildProvenance | null;
  issuedAt?: Date;
  expiresAt: Date;
  nonce: string;
}): CommercialCohortDeploymentReceiptPreparation {
  const issuedAt = args.issuedAt ?? new Date();
  if (args.checkpoint.environment !== args.environment || args.checkpoint.audience !== args.audience) throw new Error("deployment_receipt_checkpoint_identity_mismatch");
  if (args.checkpoint.trustBundleDigest !== args.trustBundle.bundleDigest || args.checkpoint.trustEpoch !== args.trustBundle.epoch) {
    throw new Error("deployment_receipt_trust_binding_invalid");
  }
  if (args.expiresAt.getTime() > new Date(args.checkpoint.expiresAt).getTime()) throw new Error("deployment_receipt_outlives_checkpoint");
  if (args.deploymentSequence === 1 && args.previousDeploymentReceipt) throw new Error("deployment_receipt_genesis_previous_forbidden");
  if (args.deploymentSequence > 1 && (!args.previousDeploymentReceipt || args.previousDeploymentReceipt.deploymentSequence !== args.deploymentSequence - 1)) {
    throw new Error("deployment_receipt_previous_sequence_invalid");
  }
  const modelConfigRoot = requiredDigest(args.modelConfigRoot, "deployment_receipt_model_root_invalid");
  const buildArtifactDigest = requiredDigest(args.buildArtifactDigest, "deployment_receipt_build_artifact_digest_invalid");
  const sourcePackageDigest = requiredDigest(args.sourcePackageDigest, "deployment_receipt_source_package_digest_invalid");
  const supplyChain = args.supplyChainProvenance ?? null;
  if (args.environment === "production" && !supplyChain) throw new Error("deployment_receipt_supply_chain_provenance_required");
  if (supplyChain && (supplyChain.environment !== args.environment || supplyChain.audience !== args.audience)) throw new Error("deployment_receipt_supply_chain_identity_mismatch");
  if (supplyChain && new Date(supplyChain.expiresAt).getTime() < args.expiresAt.getTime()) throw new Error("deployment_receipt_outlives_supply_chain_provenance");
  if (supplyChain && supplyChain.buildArtifactDigest !== buildArtifactDigest) throw new Error("deployment_receipt_supply_chain_build_digest_mismatch");
  if (supplyChain && supplyChain.sourcePackageDigest !== sourcePackageDigest) throw new Error("deployment_receipt_supply_chain_source_digest_mismatch");
  const legacySupplyChainRoot = sha256Digest(canonicalJson({ legacyStagingOnly: true, buildArtifactDigest, sourcePackageDigest }));
  const supplyChainProvenanceDigest = requiredDigest(supplyChain?.provenanceDigest ?? legacySupplyChainRoot, "deployment_receipt_supply_chain_provenance_digest_invalid");
  const sbomDigest = requiredDigest(supplyChain?.sbomDigest ?? legacySupplyChainRoot, "deployment_receipt_sbom_digest_invalid");
  const vulnerabilitySnapshotDigest = requiredDigest(supplyChain?.vulnerabilitySnapshotDigest ?? legacySupplyChainRoot, "deployment_receipt_vulnerability_snapshot_digest_invalid");
  const buildRecipeDigest = requiredDigest(supplyChain?.buildRecipeDigest ?? legacySupplyChainRoot, "deployment_receipt_build_recipe_digest_invalid");
  const deploymentConfigRoot = sha256Digest(canonicalJson({
    environment: args.environment,
    audience: args.audience,
    checkpointDigest: args.checkpoint.checkpointDigest,
    runtimeVersionRoot: args.checkpoint.runtimeVersionRoot,
    providerConfigRoot: args.checkpoint.providerConfigRoot,
    modelConfigRoot,
    buildArtifactDigest,
    sourcePackageDigest,
    supplyChainProvenanceDigest,
    sbomDigest,
    vulnerabilitySnapshotDigest,
    buildRecipeDigest,
  }));
  const core = normalizeCore({
    schemaVersion: PASS4812_DEPLOYMENT_RECEIPT_SCHEMA,
    policyVersion: PASS4813_DEPLOYMENT_RECEIPT_POLICY_ID,
    environment: args.environment,
    audience: args.audience,
    deploymentSequence: args.deploymentSequence,
    previousDeploymentReceiptDigest: args.previousDeploymentReceipt?.deploymentReceiptDigest ?? null,
    deploymentId: args.deploymentId,
    rolloutId: args.rolloutId,
    checkpointSequence: args.checkpoint.sequence,
    checkpointDigest: args.checkpoint.checkpointDigest,
    trustEpoch: args.trustBundle.epoch,
    trustBundleDigest: args.trustBundle.bundleDigest,
    runtimeVersionRoot: args.checkpoint.runtimeVersionRoot,
    providerConfigRoot: args.checkpoint.providerConfigRoot,
    modelConfigRoot,
    buildArtifactDigest,
    sourcePackageDigest,
    supplyChainProvenanceDigest,
    sbomDigest,
    vulnerabilitySnapshotDigest,
    buildRecipeDigest,
    deploymentConfigRoot,
    issuedAt: issuedAt.toISOString(),
    expiresAt: args.expiresAt.toISOString(),
    nonce: args.nonce,
  });
  const coreDigest = sha256Digest(canonicalJson(deploymentCore(core)));
  return { core, coreDigest, signaturePayload: commercialCohortDeploymentSignaturePayload(coreDigest) };
}

export function finalizeCommercialCohortDeploymentReceipt(args: {
  preparation: CommercialCohortDeploymentReceiptPreparation;
  signatures: CommercialCohortDetachedSignature[];
}): CommercialCohortDeploymentReceipt {
  const signatures = (args.signatures ?? []).map((item) => ({
    keyId: requiredId(item?.keyId, "deployment_receipt_signature_key_invalid"),
    signature: requiredSignature(item?.signature, "deployment_receipt_signature_encoding_invalid"),
  })).sort((left, right) => left.keyId.localeCompare(right.keyId));
  if (new Set(signatures.map((item) => item.keyId)).size !== signatures.length) throw new Error("deployment_receipt_signature_key_duplicate");
  const deploymentReceiptDigest = sha256Digest(canonicalJson({ core: args.preparation.core, signatures }));
  return { ...args.preparation.core, signatures, deploymentReceiptDigest };
}

export function buildCommercialCohortDeploymentReceipt(args: Parameters<typeof prepareCommercialCohortDeploymentReceipt>[0] & {
  signers: CommercialCohortPrivateSigner[];
}): CommercialCohortDeploymentReceipt {
  const preparation = prepareCommercialCohortDeploymentReceipt(args);
  return finalizeCommercialCohortDeploymentReceipt({
    preparation,
    signatures: args.signers.map((signer) => ({ keyId: signer.keyId, signature: signPayload(signer.privateKeyPem, preparation.signaturePayload) })),
  });
}

function keyUsableAt(key: CommercialCohortTrustKey, at: Date): boolean {
  return key.purpose === "release"
    && key.status !== "revoked"
    && at.getTime() >= new Date(key.notBefore).getTime()
    && at.getTime() < new Date(key.notAfter).getTime();
}

function verifySingleReceipt(args: {
  receipt: CommercialCohortDeploymentReceipt;
  previousReceipt: CommercialCohortDeploymentReceipt | null;
  checkpoint: CommercialCohortPublicCheckpoint;
  trustBundle: CommercialCohortTrustBundle;
  current: boolean;
  now: Date;
}): string[] {
  const blockers: string[] = [];
  try {
    const { signatures: _signatures, deploymentReceiptDigest: _digest, ...rawCore } = args.receipt;
    const core = normalizeCore(rawCore);
    if (core.deploymentSequence === 1) {
      if (args.previousReceipt) blockers.push("deployment_receipt_genesis_previous_present");
    } else if (!args.previousReceipt || args.previousReceipt.deploymentSequence !== core.deploymentSequence - 1 || core.previousDeploymentReceiptDigest !== args.previousReceipt.deploymentReceiptDigest) {
      blockers.push(`deployment_receipt_previous_binding_invalid:${core.deploymentSequence}`);
    }
    if (core.checkpointSequence !== args.checkpoint.sequence || core.checkpointDigest !== args.checkpoint.checkpointDigest) blockers.push(`deployment_receipt_checkpoint_binding_invalid:${core.deploymentSequence}`);
    if (core.trustEpoch !== args.trustBundle.epoch || core.trustBundleDigest !== args.trustBundle.bundleDigest) blockers.push(`deployment_receipt_trust_binding_invalid:${core.deploymentSequence}`);
    if (core.runtimeVersionRoot !== args.checkpoint.runtimeVersionRoot || core.providerConfigRoot !== args.checkpoint.providerConfigRoot) blockers.push(`deployment_receipt_runtime_binding_invalid:${core.deploymentSequence}`);
    const issuedAt = new Date(core.issuedAt);
    const expiresAt = new Date(core.expiresAt);
    if (expiresAt.getTime() > new Date(args.checkpoint.expiresAt).getTime()) blockers.push(`deployment_receipt_outlives_checkpoint:${core.deploymentSequence}`);
    if (args.current) {
      if (args.now.getTime() + CLOCK_SKEW_MS < issuedAt.getTime()) blockers.push("deployment_receipt_not_active");
      if (args.now.getTime() >= expiresAt.getTime()) blockers.push("deployment_receipt_expired");
    }
    const keys = new Map(args.trustBundle.keys.map((item) => [item.keyId, item]));
    const seen = new Set<string>();
    let valid = 0;
    let active = 0;
    const coreDigest = sha256Digest(canonicalJson(deploymentCore(core)));
    for (const signature of args.receipt.signatures ?? []) {
      const keyId = requiredId(signature?.keyId, "deployment_receipt_signature_key_invalid");
      if (seen.has(keyId)) {
        blockers.push(`deployment_receipt_signature_duplicate:${core.deploymentSequence}:${keyId}`);
        continue;
      }
      seen.add(keyId);
      const key = keys.get(keyId);
      if (!key || !keyUsableAt(key, issuedAt)) {
        blockers.push(`deployment_receipt_signer_invalid:${core.deploymentSequence}:${keyId}`);
        continue;
      }
      if (!verifyPayload(key.publicKeyPem, commercialCohortDeploymentSignaturePayload(coreDigest), signature.signature)) {
        blockers.push(`deployment_receipt_signature_invalid:${core.deploymentSequence}:${keyId}`);
      } else {
        valid += 1;
        if (key.status === "active") active += 1;
      }
    }
    if (valid < args.trustBundle.releaseSignatureThreshold) blockers.push(`deployment_receipt_signature_threshold:${core.deploymentSequence}:${valid}/${args.trustBundle.releaseSignatureThreshold}`);
    if (active < 1) blockers.push(`deployment_receipt_active_signer_missing:${core.deploymentSequence}`);
    const normalizedSignatures = (args.receipt.signatures ?? []).map((item) => ({ keyId: item.keyId, signature: item.signature })).sort((a, b) => a.keyId.localeCompare(b.keyId));
    const expectedDigest = sha256Digest(canonicalJson({ core, signatures: normalizedSignatures }));
    if (args.receipt.deploymentReceiptDigest !== expectedDigest) blockers.push(`deployment_receipt_digest_invalid:${core.deploymentSequence}`);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "deployment_receipt_validation_failed");
  }
  return Array.from(new Set(blockers.filter(Boolean))).sort();
}

export function verifyCommercialCohortDeploymentReceiptChain(args: {
  receipts: CommercialCohortDeploymentReceipt[];
  checkpoints: CommercialCohortPublicCheckpoint[];
  trustBundles: CommercialCohortTrustBundle[];
  expectedEnvironment: "staging" | "production";
  expectedAudience: string;
  minimumDeploymentSequence: number;
  expectedDeploymentId?: string | null;
  expectedBuildArtifactDigest: string;
  expectedSourcePackageDigest: string;
  expectedModelConfigRoot: string;
  expectedSupplyChainProvenanceDigest?: string | null;
  expectedSbomDigest?: string | null;
  expectedVulnerabilitySnapshotDigest?: string | null;
  expectedBuildRecipeDigest?: string | null;
  now?: Date;
}): CommercialCohortDeploymentReceiptVerification {
  const blockers: string[] = [];
  let current: CommercialCohortDeploymentReceipt | null = null;
  try {
    if (!Array.isArray(args.receipts) || args.receipts.length < 1 || args.receipts.length > 1024) throw new Error("deployment_receipt_chain_invalid");
    if (!Array.isArray(args.checkpoints) || !args.checkpoints.length || !Array.isArray(args.trustBundles) || !args.trustBundles.length) throw new Error("deployment_receipt_release_chain_missing");
    const currentCheckpoint = args.checkpoints.at(-1)!;
    const currentTrustBundle = args.trustBundles.at(-1)!;
    const now = args.now ?? new Date();
    const digests = new Set<string>();
    const nonces = new Set<string>();
    for (let index = 0; index < args.receipts.length; index += 1) {
      const receipt = args.receipts[index];
      if (receipt.deploymentSequence !== index + 1) blockers.push(`deployment_receipt_sequence_gap:${receipt.deploymentSequence}/${index + 1}`);
      if (digests.has(receipt.deploymentReceiptDigest)) blockers.push(`deployment_receipt_digest_reused:${receipt.deploymentSequence}`);
      if (nonces.has(receipt.nonce)) blockers.push(`deployment_receipt_nonce_reused:${receipt.deploymentSequence}`);
      digests.add(receipt.deploymentReceiptDigest);
      nonces.add(receipt.nonce);
      const checkpoint = args.checkpoints.find((item) => item.sequence === receipt.checkpointSequence && item.checkpointDigest === receipt.checkpointDigest) ?? null;
      const trustBundle = args.trustBundles.find((item) => item.epoch === receipt.trustEpoch && item.bundleDigest === receipt.trustBundleDigest) ?? null;
      if (!checkpoint) blockers.push(`deployment_receipt_checkpoint_missing:${receipt.deploymentSequence}`);
      if (!trustBundle) blockers.push(`deployment_receipt_trust_bundle_missing:${receipt.deploymentSequence}`);
      if (checkpoint && trustBundle) blockers.push(...verifySingleReceipt({
        receipt,
        previousReceipt: index > 0 ? args.receipts[index - 1] : null,
        checkpoint,
        trustBundle,
        current: index === args.receipts.length - 1,
        now,
      }));
      current = receipt;
    }
    if (!current) throw new Error("deployment_receipt_current_missing");
    const minimum = Number(args.minimumDeploymentSequence);
    if (!Number.isInteger(minimum) || minimum < 1) blockers.push("deployment_receipt_minimum_sequence_invalid");
    else if (current.deploymentSequence < minimum) blockers.push(`deployment_receipt_rollback_floor:${current.deploymentSequence}/${minimum}`);
    if (current.environment !== args.expectedEnvironment || current.audience !== args.expectedAudience) blockers.push("deployment_receipt_identity_mismatch");
    if (args.expectedDeploymentId && current.deploymentId !== args.expectedDeploymentId) blockers.push("deployment_receipt_deployment_id_mismatch");
    if (current.buildArtifactDigest !== requiredDigest(args.expectedBuildArtifactDigest, "deployment_receipt_expected_build_digest_invalid")) blockers.push("deployment_receipt_build_artifact_mismatch");
    if (current.sourcePackageDigest !== requiredDigest(args.expectedSourcePackageDigest, "deployment_receipt_expected_source_digest_invalid")) blockers.push("deployment_receipt_source_package_mismatch");
    if (current.modelConfigRoot !== requiredDigest(args.expectedModelConfigRoot, "deployment_receipt_expected_model_root_invalid")) blockers.push("deployment_receipt_model_config_mismatch");
    const requireSupplyChain = args.expectedEnvironment === "production" || Boolean(args.expectedSupplyChainProvenanceDigest || args.expectedSbomDigest || args.expectedVulnerabilitySnapshotDigest || args.expectedBuildRecipeDigest);
    if (requireSupplyChain) {
      if (!args.expectedSupplyChainProvenanceDigest || current.supplyChainProvenanceDigest !== requiredDigest(args.expectedSupplyChainProvenanceDigest, "deployment_receipt_expected_supply_chain_digest_invalid")) blockers.push("deployment_receipt_supply_chain_provenance_mismatch");
      if (!args.expectedSbomDigest || current.sbomDigest !== requiredDigest(args.expectedSbomDigest, "deployment_receipt_expected_sbom_digest_invalid")) blockers.push("deployment_receipt_sbom_mismatch");
      if (!args.expectedVulnerabilitySnapshotDigest || current.vulnerabilitySnapshotDigest !== requiredDigest(args.expectedVulnerabilitySnapshotDigest, "deployment_receipt_expected_vulnerability_digest_invalid")) blockers.push("deployment_receipt_vulnerability_snapshot_mismatch");
      if (!args.expectedBuildRecipeDigest || current.buildRecipeDigest !== requiredDigest(args.expectedBuildRecipeDigest, "deployment_receipt_expected_recipe_digest_invalid")) blockers.push("deployment_receipt_build_recipe_mismatch");
    }
    if (current.checkpointDigest !== currentCheckpoint.checkpointDigest || current.checkpointSequence !== currentCheckpoint.sequence) blockers.push("deployment_receipt_not_on_current_checkpoint");
    if (current.trustBundleDigest !== currentTrustBundle.bundleDigest || current.trustEpoch !== currentTrustBundle.epoch) blockers.push("deployment_receipt_not_on_current_trust_epoch");
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "deployment_receipt_chain_validation_failed");
  }
  const uniqueBlockers = Array.from(new Set(blockers.filter(Boolean))).sort();
  const deploymentReceiptVerified = uniqueBlockers.length === 0 && Boolean(current);
  const artifactBound = deploymentReceiptVerified && Boolean(current
    && current.buildArtifactDigest === args.expectedBuildArtifactDigest
    && current.sourcePackageDigest === args.expectedSourcePackageDigest
    && current.modelConfigRoot === args.expectedModelConfigRoot);
  const supplyChainExpected = args.expectedEnvironment === "production" || Boolean(args.expectedSupplyChainProvenanceDigest || args.expectedSbomDigest || args.expectedVulnerabilitySnapshotDigest || args.expectedBuildRecipeDigest);
  const supplyChainBound = deploymentReceiptVerified && Boolean(current) && (!supplyChainExpected || Boolean(
    args.expectedSupplyChainProvenanceDigest
    && args.expectedSbomDigest
    && args.expectedVulnerabilitySnapshotDigest
    && args.expectedBuildRecipeDigest
    && current!.supplyChainProvenanceDigest === args.expectedSupplyChainProvenanceDigest
    && current!.sbomDigest === args.expectedSbomDigest
    && current!.vulnerabilitySnapshotDigest === args.expectedVulnerabilitySnapshotDigest
    && current!.buildRecipeDigest === args.expectedBuildRecipeDigest
  ));
  const deploymentRollbackProtected = deploymentReceiptVerified && Boolean(current && current.deploymentSequence >= args.minimumDeploymentSequence);
  return {
    verified: deploymentReceiptVerified && artifactBound && supplyChainBound && deploymentRollbackProtected,
    deploymentReceiptVerified,
    artifactBound,
    supplyChainBound,
    deploymentRollbackProtected,
    deploymentSequence: current?.deploymentSequence ?? null,
    deploymentReceiptDigest: current?.deploymentReceiptDigest ?? null,
    blockers: uniqueBlockers,
  };
}
