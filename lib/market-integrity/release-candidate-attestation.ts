import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";
import { probeDurableComputationStaging } from "@/lib/jobs/durable-computation-staging";
import { getProviderRecoveryReleaseBundleGate } from "@/lib/market-integrity/provider-recovery-release-bundle";

type EnvLike = Record<string, string | undefined>;
type RpcRunner = (input: { operation: SupabaseRpcOperation; args?: Record<string, unknown> }) => Promise<{ data: unknown }>;
type Dependencies = {
  rpc: RpcRunner;
  now: () => Date;
  probe: typeof probeDurableComputationStaging;
  bundleGate: typeof getProviderRecoveryReleaseBundleGate;
};
const defaults: Dependencies = {
  rpc: runRegisteredServiceRoleRpc,
  now: () => new Date(),
  probe: probeDurableComputationStaging,
  bundleGate: getProviderRecoveryReleaseBundleGate,
};

export type ReleaseCandidateAttestationRequest = {
  candidateId: string;
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
  releaseBundleDigest: string;
  keyId: string;
  operatorId: string;
  reason: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  signature: string;
};

export type ReleaseCandidateAttestationArtifact = {
  schemaVersion: "velmere.release-candidate-attestation.v1";
  payload: Omit<ReleaseCandidateAttestationRequest, "signature" | "operatorId" | "reason"> & {
    operatorHash: string;
    reasonHash: string;
    buildIdHash: string;
    audienceHash: string;
    publicKeyFingerprint: string;
    manifestRoot: string;
  };
  signature: string;
  attestationDigest: string;
};

export type ReleaseCandidateAttestationGate = {
  schemaVersion: "velmere.release-candidate-attestation-gate.v1";
  ready: boolean;
  required: boolean;
  state: "not_required" | "missing" | "verified" | "consumed" | "expired" | "revoked" | "blocked" | "store_failed";
  attestationDigest: string | null;
  releaseBundleDigest: string | null;
  manifestRoot: string | null;
  keyIdHash: string | null;
  expiresAt: string | null;
  blockers: string[];
  privacyBoundary: string;
};

const clean = (value: unknown) => String(value ?? "").trim();
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const isSha = (value: string) => /^[0-9a-f]{64}$/.test(value);
const candidateOk = (value: string) => /^[A-Za-z0-9._-]{8,128}$/.test(value);
const audienceOk = (value: string) => /^[A-Za-z0-9._:/-]{8,160}$/.test(value);
const keyIdOk = (value: string) => /^[A-Za-z0-9._:-]{4,96}$/.test(value);
const buildOk = (value: string) => /^[A-Za-z0-9._-]{8,128}$/.test(value);
const checkpoint = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 4725 && parsed <= 999999 ? parsed : null;
};
const row = (data: unknown): Record<string, unknown> | null =>
  Array.isArray(data)
    ? (data.find((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) ?? null)
    : data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;

function normalizePem(value: string) {
  return clean(value).replace(/\\n/g, "\n");
}
function ed25519PrivateKey(value: string): KeyObject {
  const key = createPrivateKey(normalizePem(value));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("release_candidate_private_key_not_ed25519");
  return key;
}
function ed25519PublicKey(value: string): KeyObject {
  const key = createPublicKey(normalizePem(value));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("release_candidate_public_key_not_ed25519");
  return key;
}
function publicKeyFingerprint(key: KeyObject) {
  return sha(key.export({ type: "spki", format: "der" }) as Buffer);
}
function trustedPublicKeyFingerprint(env: EnvLike) {
  const value = clean(env.VELMERE_RELEASE_CANDIDATE_TRUSTED_PUBLIC_KEY_SHA256).toLowerCase();
  return isSha(value) ? value : null;
}
function environmentBinding(env: EnvLike) {
  const raw = clean(env.VELMERE_DEPLOYMENT_ENVIRONMENT || env.VERCEL_ENV || "staging").toLowerCase();
  const environment = raw === "production" ? "production" : raw === "staging" ? "staging" : null;
  const audience = clean(env.VELMERE_RELEASE_CANDIDATE_AUDIENCE || env.VELMERE_RELEASE_BUNDLE_AUDIENCE);
  return { environment, audience: audienceOk(audience) ? audience : null };
}
function releaseEvidence(env: EnvLike) {
  const sourceSha256 = clean(env.VELMERE_DURABLE_EXACT_SOURCE_SHA256).toLowerCase();
  const buildSha256 = clean(env.VELMERE_DURABLE_EXACT_BUILD_SHA256).toLowerCase();
  const buildId = clean(env.VELMERE_DURABLE_EXACT_BUILD_ID);
  return {
    sourceSha256: isSha(sourceSha256) ? sourceSha256 : null,
    buildSha256: isSha(buildSha256) ? buildSha256 : null,
    buildId: buildOk(buildId) ? buildId : null,
    exactCheckpoint: checkpoint(env.VELMERE_DURABLE_EXACT_CHECKPOINT),
  };
}
function namedManifestRoot(input: Omit<ReleaseCandidateAttestationRequest, "signature">) {
  const leaves: Array<[string, string]> = [
    ["candidate", sha(input.candidateId)],
    ["environment", sha(input.environment)],
    ["audience", sha(input.audience)],
    ["deployment", input.deploymentFingerprint],
    ["rollback", input.rollbackExecutionDigest],
    ["incident", input.incidentDigest],
    ["quality", input.qualityDigest],
    ["capability", input.capabilityDigest],
    ["source", input.sourceSha256],
    ["build", input.buildSha256],
    ["buildId", sha(input.buildId)],
    ["checkpoint", sha(String(input.exactCheckpoint))],
    ["recovery", input.recoveryProofDigest],
    ["customerSmoke", input.customerSmokeDigest],
    ["providerSmoke", input.providerSmokeDigest],
    ["certificate", input.releaseCertificateDigest],
    ["bundle", input.releaseBundleDigest],
    ["keyId", sha(input.keyId)],
    ["operator", sha(input.operatorId)],
    ["reason", sha(input.reason)],
    ["issuedAt", sha(String(input.issuedAt))],
    ["expiresAt", sha(String(input.expiresAt))],
    ["nonce", sha(input.nonce)],
  ];
  const namedLeaves = leaves.map(([name, digest]) => sha(`${name}:${digest}`)).sort();
  return sha(JSON.stringify({ schemaVersion: "velmere.release-candidate-manifest-root.v1", leaves: namedLeaves }));
}
function canonicalPayload(input: Omit<ReleaseCandidateAttestationRequest, "signature">, fingerprint: string) {
  return JSON.stringify({
    schemaVersion: "velmere.release-candidate-attestation.v1",
    candidateId: input.candidateId,
    environment: input.environment,
    audienceHash: sha(input.audience),
    deploymentFingerprint: input.deploymentFingerprint,
    rollbackExecutionDigest: input.rollbackExecutionDigest,
    incidentDigest: input.incidentDigest,
    qualityDigest: input.qualityDigest,
    capabilityDigest: input.capabilityDigest,
    sourceSha256: input.sourceSha256,
    buildSha256: input.buildSha256,
    buildIdHash: sha(input.buildId),
    exactCheckpoint: input.exactCheckpoint,
    recoveryProofDigest: input.recoveryProofDigest,
    customerSmokeDigest: input.customerSmokeDigest,
    providerSmokeDigest: input.providerSmokeDigest,
    releaseCertificateDigest: input.releaseCertificateDigest,
    releaseBundleDigest: input.releaseBundleDigest,
    keyId: input.keyId,
    publicKeyFingerprint: fingerprint,
    operatorHash: sha(input.operatorId),
    reasonHash: sha(input.reason),
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    nonce: input.nonce,
    manifestRoot: namedManifestRoot(input),
  });
}
function normalize(request: ReleaseCandidateAttestationRequest): ReleaseCandidateAttestationRequest {
  const value = {
    ...request,
    candidateId: clean(request.candidateId),
    environment: clean(request.environment).toLowerCase() as "staging" | "production",
    audience: clean(request.audience),
    deploymentFingerprint: clean(request.deploymentFingerprint).toLowerCase(),
    rollbackExecutionDigest: clean(request.rollbackExecutionDigest).toLowerCase(),
    incidentDigest: clean(request.incidentDigest).toLowerCase(),
    qualityDigest: clean(request.qualityDigest).toLowerCase(),
    capabilityDigest: clean(request.capabilityDigest).toLowerCase(),
    sourceSha256: clean(request.sourceSha256).toLowerCase(),
    buildSha256: clean(request.buildSha256).toLowerCase(),
    buildId: clean(request.buildId),
    exactCheckpoint: Number(request.exactCheckpoint),
    recoveryProofDigest: clean(request.recoveryProofDigest).toLowerCase(),
    customerSmokeDigest: clean(request.customerSmokeDigest).toLowerCase(),
    providerSmokeDigest: clean(request.providerSmokeDigest).toLowerCase(),
    releaseCertificateDigest: clean(request.releaseCertificateDigest).toLowerCase(),
    releaseBundleDigest: clean(request.releaseBundleDigest).toLowerCase(),
    keyId: clean(request.keyId),
    operatorId: clean(request.operatorId),
    reason: clean(request.reason),
    issuedAt: Number(request.issuedAt),
    expiresAt: Number(request.expiresAt),
    nonce: clean(request.nonce),
    signature: clean(request.signature),
  };
  if (!candidateOk(value.candidateId)) throw new Error("release_candidate_id_invalid");
  if (!(["staging", "production"] as string[]).includes(value.environment)) throw new Error("release_candidate_environment_invalid");
  if (!audienceOk(value.audience)) throw new Error("release_candidate_audience_invalid");
  if (![value.deploymentFingerprint, value.rollbackExecutionDigest, value.incidentDigest, value.qualityDigest, value.capabilityDigest, value.sourceSha256, value.buildSha256, value.recoveryProofDigest, value.customerSmokeDigest, value.providerSmokeDigest, value.releaseCertificateDigest, value.releaseBundleDigest].every(isSha)) throw new Error("release_candidate_digest_invalid");
  if (!buildOk(value.buildId) || checkpoint(value.exactCheckpoint) === null) throw new Error("release_candidate_exact_invalid");
  if (!keyIdOk(value.keyId)) throw new Error("release_candidate_key_id_invalid");
  if (value.operatorId.length < 3 || value.operatorId.length > 160 || value.reason.length < 12 || value.reason.length > 500) throw new Error("release_candidate_operator_reason_invalid");
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(value.nonce)) throw new Error("release_candidate_nonce_invalid");
  if (!/^[A-Za-z0-9_-]{80,120}$/.test(value.signature)) throw new Error("release_candidate_signature_invalid");
  return value;
}

export function signReleaseCandidateAttestation(
  input: Omit<ReleaseCandidateAttestationRequest, "signature">,
  privateKeyPem: string,
  publicKeyPem?: string,
) {
  const privateKey = ed25519PrivateKey(privateKeyPem);
  const publicKey = publicKeyPem ? ed25519PublicKey(publicKeyPem) : createPublicKey(privateKey);
  const payload = canonicalPayload(input, publicKeyFingerprint(publicKey));
  return cryptoSign(null, Buffer.from(payload), privateKey).toString("base64url");
}

export function verifyReleaseCandidateAttestationArtifact(input: {
  artifact: ReleaseCandidateAttestationArtifact;
  publicKeyPem: string;
  now?: Date;
  expectedEnvironment?: "staging" | "production";
  expectedAudience?: string;
  trustedPublicKeyFingerprint?: string;
}) {
  const key = ed25519PublicKey(input.publicKeyPem);
  const fingerprint = publicKeyFingerprint(key);
  const artifact = input.artifact;
  const blockers: string[] = [];
  if (artifact.schemaVersion !== "velmere.release-candidate-attestation.v1") blockers.push("schema_invalid");
  if (artifact.payload.publicKeyFingerprint !== fingerprint) blockers.push("public_key_fingerprint_mismatch");
  if (input.trustedPublicKeyFingerprint && input.trustedPublicKeyFingerprint !== fingerprint) blockers.push("external_trust_anchor_mismatch");
  if (input.expectedEnvironment && artifact.payload.environment !== input.expectedEnvironment) blockers.push("environment_mismatch");
  if (input.expectedAudience && artifact.payload.audienceHash !== sha(input.expectedAudience)) blockers.push("audience_mismatch");
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (artifact.payload.issuedAt > nowSeconds + 60 || artifact.payload.expiresAt <= nowSeconds || artifact.payload.expiresAt - artifact.payload.issuedAt > 1800) blockers.push("freshness_invalid");
  const payloadForVerification = JSON.stringify({ ...artifact.payload });
  const signatureOk = /^[A-Za-z0-9_-]{80,120}$/.test(artifact.signature) && cryptoVerify(null, Buffer.from(payloadForVerification), key, Buffer.from(artifact.signature, "base64url"));
  if (!signatureOk) blockers.push("signature_invalid");
  const digest = sha(`${payloadForVerification}.${artifact.signature}`);
  if (digest !== artifact.attestationDigest) blockers.push("attestation_digest_mismatch");
  return {
    schemaVersion: "velmere.release-candidate-attestation-verification.v1" as const,
    ok: blockers.length === 0,
    attestationDigest: digest,
    manifestRoot: artifact.payload.manifestRoot,
    keyFingerprint: fingerprint,
    blockers,
  };
}

export function buildReleaseCandidateAttestationArtifact(input: {
  request: ReleaseCandidateAttestationRequest;
  publicKeyPem: string;
}): ReleaseCandidateAttestationArtifact {
  const request = normalize(input.request);
  const publicKey = ed25519PublicKey(input.publicKeyPem);
  const fingerprint = publicKeyFingerprint(publicKey);
  const unsigned = { ...request };
  delete (unsigned as Partial<ReleaseCandidateAttestationRequest>).signature;
  const canonical = canonicalPayload(unsigned, fingerprint);
  const parsed = JSON.parse(canonical) as ReleaseCandidateAttestationArtifact["payload"];
  return {
    schemaVersion: "velmere.release-candidate-attestation.v1",
    payload: parsed,
    signature: request.signature,
    attestationDigest: sha(`${canonical}.${request.signature}`),
  };
}

export async function recordReleaseCandidateAttestation(input: {
  request: ReleaseCandidateAttestationRequest;
  env?: EnvLike;
  dependencies?: Partial<Dependencies>;
}) {
  const env = input.env ?? process.env;
  const dependencies = { ...defaults, ...input.dependencies };
  const request = normalize(input.request);
  const now = dependencies.now();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (request.issuedAt > nowSeconds + 60 || request.issuedAt < nowSeconds - 300 || request.expiresAt <= nowSeconds || request.expiresAt - request.issuedAt > 1800) throw new Error("release_candidate_freshness_invalid");
  const binding = environmentBinding(env);
  if (request.environment !== binding.environment || request.audience !== binding.audience) throw new Error("release_candidate_environment_binding_mismatch");
  const keyId = clean(env.VELMERE_RELEASE_CANDIDATE_KEY_ID);
  if (request.keyId !== keyId || !keyIdOk(keyId)) throw new Error("release_candidate_key_id_mismatch");
  const publicKeyPem = normalizePem(clean(env.VELMERE_RELEASE_CANDIDATE_PUBLIC_KEY_PEM));
  const publicKey = ed25519PublicKey(publicKeyPem);
  const fingerprint = publicKeyFingerprint(publicKey);
  const trustedFingerprint = trustedPublicKeyFingerprint(env);
  if (!trustedFingerprint || trustedFingerprint !== fingerprint) throw new Error("release_candidate_external_trust_anchor_missing_or_mismatch");
  const unsigned = { ...request };
  delete (unsigned as Partial<ReleaseCandidateAttestationRequest>).signature;
  const canonical = canonicalPayload(unsigned, fingerprint);
  if (!cryptoVerify(null, Buffer.from(canonical), publicKey, Buffer.from(request.signature, "base64url"))) throw new Error("release_candidate_signature_mismatch");
  const release = releaseEvidence(env);
  if (request.sourceSha256 !== release.sourceSha256 || request.buildSha256 !== release.buildSha256 || request.buildId !== release.buildId || request.exactCheckpoint !== release.exactCheckpoint) throw new Error("release_candidate_exact_release_mismatch");
  const probe = await dependencies.probe({ env });
  if (!probe.stagingProven || probe.capabilityDigest !== request.capabilityDigest || probe.deploymentFingerprint !== request.deploymentFingerprint) throw new Error("release_candidate_staging_not_proven");
  const bundleGate = await dependencies.bundleGate({
    env,
    expected: {
      environment: request.environment,
      audience: request.audience,
      deploymentFingerprint: request.deploymentFingerprint,
      rollbackExecutionDigest: request.rollbackExecutionDigest,
      incidentDigest: request.incidentDigest,
      qualityDigest: request.qualityDigest,
      capabilityDigest: request.capabilityDigest,
      sourceSha256: request.sourceSha256,
      buildSha256: request.buildSha256,
      buildId: request.buildId,
      exactCheckpoint: request.exactCheckpoint,
      recoveryProofDigest: request.recoveryProofDigest,
      customerSmokeDigest: request.customerSmokeDigest,
      providerSmokeDigest: request.providerSmokeDigest,
      releaseCertificateDigest: request.releaseCertificateDigest,
    },
  });
  if (!bundleGate.ready || bundleGate.bundleDigest !== request.releaseBundleDigest) throw new Error("release_candidate_release_bundle_not_verified");
  const artifact = buildReleaseCandidateAttestationArtifact({ request, publicKeyPem });
  const verified = verifyReleaseCandidateAttestationArtifact({ artifact, publicKeyPem, now, expectedEnvironment: request.environment, expectedAudience: request.audience, trustedPublicKeyFingerprint: trustedFingerprint });
  if (!verified.ok) throw new Error(`release_candidate_offline_verification_failed_${verified.blockers.join("_")}`);
  const idempotencyKey = sha(`release-candidate|${request.environment}|${artifact.attestationDigest}|${request.candidateId}`);
  const args = {
    p_idempotency_key: idempotencyKey,
    p_candidate_id_hash: sha(request.candidateId),
    p_environment: request.environment,
    p_audience_hash: sha(request.audience),
    p_deployment_fingerprint: request.deploymentFingerprint,
    p_rollback_execution_digest: request.rollbackExecutionDigest,
    p_incident_digest: request.incidentDigest,
    p_quality_digest: request.qualityDigest,
    p_capability_digest: request.capabilityDigest,
    p_source_sha256: request.sourceSha256,
    p_build_sha256: request.buildSha256,
    p_build_id_hash: sha(request.buildId),
    p_exact_checkpoint: request.exactCheckpoint,
    p_recovery_proof_digest: request.recoveryProofDigest,
    p_customer_smoke_digest: request.customerSmokeDigest,
    p_provider_smoke_digest: request.providerSmokeDigest,
    p_release_certificate_digest: request.releaseCertificateDigest,
    p_release_bundle_digest: request.releaseBundleDigest,
    p_manifest_root: artifact.payload.manifestRoot,
    p_key_id_hash: sha(request.keyId),
    p_public_key_fingerprint: fingerprint,
    p_signature_digest: sha(request.signature),
    p_attestation_digest: artifact.attestationDigest,
    p_operator_hash: sha(request.operatorId),
    p_reason_hash: sha(request.reason),
    p_issued_at: new Date(request.issuedAt * 1000).toISOString(),
    p_expires_at: new Date(request.expiresAt * 1000).toISOString(),
  };
  const recorded = row((await dependencies.rpc({ operation: "release_candidate_attestation_record", args })).data);
  if (clean(recorded?.state) !== "recorded" || clean(recorded?.attestation_digest).toLowerCase() !== artifact.attestationDigest) throw new Error("release_candidate_record_failed");
  const stored = row((await dependencies.rpc({ operation: "release_candidate_attestation_verify", args: { ...args, p_attestation_digest: artifact.attestationDigest } })).data);
  if (clean(stored?.state) !== "verified" || clean(stored?.attestation_digest).toLowerCase() !== artifact.attestationDigest) throw new Error("release_candidate_verification_failed");
  return {
    schemaVersion: "velmere.release-candidate-attestation-record.v1" as const,
    ok: true,
    state: "verified" as const,
    attestationDigest: artifact.attestationDigest,
    manifestRoot: artifact.payload.manifestRoot,
    publicKeyFingerprint: fingerprint,
    keyIdHash: sha(request.keyId),
    expiresAt: new Date(request.expiresAt * 1000).toISOString(),
    artifact,
    privacyBoundary: "Public verification artifact contains hashes, checkpoint, environment/audience binding, Ed25519 signature and public-key fingerprint only. Private key, raw operator identity, reason, account data, payloads and secrets are excluded.",
  };
}

export async function getReleaseCandidateAttestationGate(input: {
  env?: EnvLike;
  expected: Partial<Omit<ReleaseCandidateAttestationRequest, "signature" | "operatorId" | "reason" | "issuedAt" | "expiresAt" | "nonce" | "candidateId" | "keyId">>;
  dependencies?: Pick<Dependencies, "rpc" | "now">;
}): Promise<ReleaseCandidateAttestationGate> {
  const env = input.env ?? process.env;
  const dependencies = { rpc: input.dependencies?.rpc ?? defaults.rpc, now: input.dependencies?.now ?? defaults.now };
  const releaseBundleDigest = clean(input.expected.releaseBundleDigest).toLowerCase();
  const rollbackExecutionDigest = clean(input.expected.rollbackExecutionDigest).toLowerCase();
  if (!releaseBundleDigest && !rollbackExecutionDigest) {
    return { schemaVersion: "velmere.release-candidate-attestation-gate.v1", ready: true, required: false, state: "not_required", attestationDigest: null, releaseBundleDigest: null, manifestRoot: null, keyIdHash: null, expiresAt: null, blockers: [], privacyBoundary: "No rollback history; release candidate attestation is not required for first promotion." };
  }
  const binding = environmentBinding(env);
  const keyId = clean(env.VELMERE_RELEASE_CANDIDATE_KEY_ID);
  const publicKeyPem = clean(env.VELMERE_RELEASE_CANDIDATE_PUBLIC_KEY_PEM);
  const trustedFingerprint = trustedPublicKeyFingerprint(env);
  const blockers: string[] = [];
  if (!binding.environment || !binding.audience) blockers.push("release_candidate_environment_binding_missing");
  if (!keyIdOk(keyId)) blockers.push("release_candidate_key_id_missing");
  let fingerprint: string | null = null;
  try { fingerprint = publicKeyFingerprint(ed25519PublicKey(publicKeyPem)); } catch { blockers.push("release_candidate_public_key_missing_or_invalid"); }
  if (!trustedFingerprint) blockers.push("release_candidate_trusted_public_key_fingerprint_missing");
  else if (fingerprint && trustedFingerprint !== fingerprint) blockers.push("release_candidate_external_trust_anchor_mismatch");
  const expectedDigests = [input.expected.deploymentFingerprint, input.expected.rollbackExecutionDigest, input.expected.incidentDigest, input.expected.qualityDigest, input.expected.capabilityDigest, input.expected.sourceSha256, input.expected.buildSha256, input.expected.recoveryProofDigest, input.expected.customerSmokeDigest, input.expected.providerSmokeDigest, input.expected.releaseCertificateDigest, input.expected.releaseBundleDigest].map(clean).map((value) => value.toLowerCase());
  if (!expectedDigests.every(isSha)) blockers.push("release_candidate_expected_evidence_missing");
  if (blockers.length) return { schemaVersion: "velmere.release-candidate-attestation-gate.v1", ready: false, required: true, state: "blocked", attestationDigest: null, releaseBundleDigest: releaseBundleDigest || null, manifestRoot: null, keyIdHash: keyIdOk(keyId) ? sha(keyId) : null, expiresAt: null, blockers, privacyBoundary: "Only hashes and blocker codes are returned." };
  try {
    const status = row((await dependencies.rpc({ operation: "release_candidate_attestation_status", args: {
      p_environment: binding.environment,
      p_audience_hash: sha(binding.audience!),
      p_deployment_fingerprint: clean(input.expected.deploymentFingerprint).toLowerCase(),
      p_rollback_execution_digest: rollbackExecutionDigest,
      p_incident_digest: clean(input.expected.incidentDigest).toLowerCase(),
      p_quality_digest: clean(input.expected.qualityDigest).toLowerCase(),
      p_capability_digest: clean(input.expected.capabilityDigest).toLowerCase(),
      p_source_sha256: clean(input.expected.sourceSha256).toLowerCase(),
      p_build_sha256: clean(input.expected.buildSha256).toLowerCase(),
      p_build_id_hash: sha(clean(input.expected.buildId)),
      p_exact_checkpoint: checkpoint(input.expected.exactCheckpoint),
      p_recovery_proof_digest: clean(input.expected.recoveryProofDigest).toLowerCase(),
      p_customer_smoke_digest: clean(input.expected.customerSmokeDigest).toLowerCase(),
      p_provider_smoke_digest: clean(input.expected.providerSmokeDigest).toLowerCase(),
      p_release_certificate_digest: clean(input.expected.releaseCertificateDigest).toLowerCase(),
      p_release_bundle_digest: releaseBundleDigest,
      p_key_id_hash: sha(keyId),
      p_public_key_fingerprint: fingerprint,
      p_now: dependencies.now().toISOString(),
    } })).data);
    const state = clean(status?.state) as ReleaseCandidateAttestationGate["state"];
    const attestationDigest = clean(status?.attestation_digest).toLowerCase();
    const storedBlockers = Array.isArray(status?.blockers) ? status.blockers.map(clean) : [];
    const ready = state === "verified" && isSha(attestationDigest) && storedBlockers.length === 0;
    return { schemaVersion: "velmere.release-candidate-attestation-gate.v1", ready, required: true, state: state || "missing", attestationDigest: isSha(attestationDigest) ? attestationDigest : null, releaseBundleDigest, manifestRoot: isSha(clean(status?.manifest_root).toLowerCase()) ? clean(status?.manifest_root).toLowerCase() : null, keyIdHash: sha(keyId), expiresAt: clean(status?.expires_at) || null, blockers: storedBlockers, privacyBoundary: "Only hashes, aggregate state and blocker codes are returned." };
  } catch {
    return { schemaVersion: "velmere.release-candidate-attestation-gate.v1", ready: false, required: true, state: "store_failed", attestationDigest: null, releaseBundleDigest, manifestRoot: null, keyIdHash: sha(keyId), expiresAt: null, blockers: ["release_candidate_attestation_store_failed"], privacyBoundary: "Store errors are reduced to a stable blocker code." };
  }
}
