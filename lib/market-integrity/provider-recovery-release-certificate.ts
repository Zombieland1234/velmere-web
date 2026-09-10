import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";
import { probeDurableComputationStaging } from "@/lib/jobs/durable-computation-staging";
import { getProviderObservationPromotionQuality } from "@/lib/market-integrity/provider-observation-quarantine";
import { getProviderQualityIncidentGate } from "@/lib/market-integrity/provider-quality-incident-response";
import { getProviderQualityRollbackRecoveryGate } from "@/lib/market-integrity/provider-quality-auto-rollback";
import { getProviderQualityRecoveryProofGate } from "@/lib/market-integrity/provider-quality-recovery-proof";
import { getProviderRecoverySmokeGate } from "@/lib/market-integrity/provider-recovery-smoke";

type EnvLike = Record<string, string | undefined>;
type RpcRunner = (input: { operation: SupabaseRpcOperation; args?: Record<string, unknown> }) => Promise<{ data: unknown }>;

type Dependencies = {
  rpc: RpcRunner;
  now: () => Date;
  probe: typeof probeDurableComputationStaging;
  providerQuality: typeof getProviderObservationPromotionQuality;
  incidentGate: typeof getProviderQualityIncidentGate;
  rollbackGate: typeof getProviderQualityRollbackRecoveryGate;
  recoveryProofGate: typeof getProviderQualityRecoveryProofGate;
  smokeGate: typeof getProviderRecoverySmokeGate;
};

const defaultDependencies: Dependencies = {
  rpc: runRegisteredServiceRoleRpc,
  now: () => new Date(),
  probe: probeDurableComputationStaging,
  providerQuality: getProviderObservationPromotionQuality,
  incidentGate: getProviderQualityIncidentGate,
  rollbackGate: getProviderQualityRollbackRecoveryGate,
  recoveryProofGate: getProviderQualityRecoveryProofGate,
  smokeGate: getProviderRecoverySmokeGate,
};

export type ProviderRecoveryReleaseCertificateRequest = {
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
  operatorId: string;
  reason: string;
  approvalTimestamp: number;
  approvalNonce: string;
  approvalSignature: string;
};

export type ProviderRecoveryReleaseCertificateGate = {
  schemaVersion: "velmere.provider-recovery-release-certificate-gate.v1";
  ready: boolean;
  required: boolean;
  state: "not_required" | "missing" | "verified" | "consumed" | "expired" | "blocked" | "store_failed";
  certificateDigest: string | null;
  rollbackExecutionDigest: string | null;
  expiresAt: string | null;
  blockers: string[];
  privacyBoundary: string;
};

function clean(value: unknown) { return String(value ?? "").trim(); }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function isSha(value: string) { return /^[0-9a-f]{64}$/.test(value); }
function usableSecret(value: string) { return value.length >= 32 && !/(example|placeholder|changeme|dummy|replace[-_ ]?me|never[-_ ]?production)/i.test(value); }
function safeBuildId(value: string) { return /^[A-Za-z0-9._-]{8,128}$/.test(value); }
function exactCheckpoint(value: unknown) { const n = Number(value); return Number.isInteger(n) && n >= 4725 && n <= 999999 ? n : null; }
function row(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return data.find((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")) ?? null;
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}
function canonical(input: Omit<ProviderRecoveryReleaseCertificateRequest, "approvalSignature">) {
  return JSON.stringify({
    schemaVersion: "velmere.provider-recovery-release-certificate-approval.v1",
    rollbackExecutionDigest: input.rollbackExecutionDigest,
    incidentDigest: input.incidentDigest,
    qualityDigest: input.qualityDigest,
    capabilityDigest: input.capabilityDigest,
    sourceSha256: input.sourceSha256,
    buildSha256: input.buildSha256,
    buildIdHash: sha256(input.buildId),
    exactCheckpoint: input.exactCheckpoint,
    recoveryProofDigest: input.recoveryProofDigest,
    customerSmokeDigest: input.customerSmokeDigest,
    providerSmokeDigest: input.providerSmokeDigest,
    operatorHash: sha256(input.operatorId),
    reasonHash: sha256(input.reason),
    approvalTimestamp: input.approvalTimestamp,
    approvalNonce: input.approvalNonce,
  });
}

export function signProviderRecoveryReleaseCertificate(
  input: Omit<ProviderRecoveryReleaseCertificateRequest, "approvalSignature">,
  secret: string,
) {
  if (!usableSecret(secret)) throw new Error("provider_recovery_release_certificate_secret_missing_or_weak");
  return createHmac("sha256", secret).update(canonical(input)).digest("hex");
}

function normalizeRequest(request: ProviderRecoveryReleaseCertificateRequest): ProviderRecoveryReleaseCertificateRequest {
  const normalized = {
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
    operatorId: clean(request.operatorId),
    reason: clean(request.reason),
    approvalTimestamp: Number(request.approvalTimestamp),
    approvalNonce: clean(request.approvalNonce),
    approvalSignature: clean(request.approvalSignature).toLowerCase(),
  };
  if (![normalized.rollbackExecutionDigest, normalized.incidentDigest, normalized.qualityDigest, normalized.capabilityDigest, normalized.sourceSha256, normalized.buildSha256, normalized.recoveryProofDigest, normalized.customerSmokeDigest, normalized.providerSmokeDigest].every(isSha)) throw new Error("provider_recovery_release_certificate_digest_invalid");
  if (!safeBuildId(normalized.buildId)) throw new Error("provider_recovery_release_certificate_build_id_invalid");
  if (exactCheckpoint(normalized.exactCheckpoint) === null) throw new Error("provider_recovery_release_certificate_checkpoint_invalid");
  if (normalized.operatorId.length < 3 || normalized.operatorId.length > 160) throw new Error("provider_recovery_release_certificate_operator_invalid");
  if (normalized.reason.length < 12 || normalized.reason.length > 500) throw new Error("provider_recovery_release_certificate_reason_invalid");
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(normalized.approvalNonce)) throw new Error("provider_recovery_release_certificate_nonce_invalid");
  if (!isSha(normalized.approvalSignature)) throw new Error("provider_recovery_release_certificate_signature_invalid");
  return normalized;
}

function releaseEvidence(env: EnvLike) {
  const sourceSha256 = clean(env.VELMERE_DURABLE_EXACT_SOURCE_SHA256).toLowerCase();
  const buildSha256 = clean(env.VELMERE_DURABLE_EXACT_BUILD_SHA256).toLowerCase();
  const buildId = clean(env.VELMERE_DURABLE_EXACT_BUILD_ID);
  const checkpoint = exactCheckpoint(env.VELMERE_DURABLE_EXACT_CHECKPOINT);
  return {
    sourceSha256: isSha(sourceSha256) ? sourceSha256 : null,
    buildSha256: isSha(buildSha256) ? buildSha256 : null,
    buildId: safeBuildId(buildId) ? buildId : null,
    exactCheckpoint: checkpoint,
  };
}

export async function recordProviderRecoveryReleaseCertificate(input: {
  request: ProviderRecoveryReleaseCertificateRequest;
  env?: EnvLike;
  dependencies?: Partial<Dependencies>;
}) {
  const env = input.env ?? process.env;
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  const request = normalizeRequest(input.request);
  const now = dependencies.now();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSeconds - request.approvalTimestamp) > 300) throw new Error("provider_recovery_release_certificate_approval_expired_or_future");
  const secret = clean(env.VELMERE_PROVIDER_RECOVERY_RELEASE_CERTIFICATE_SECRET);
  if (!usableSecret(secret)) throw new Error("provider_recovery_release_certificate_secret_missing_or_weak");
  const { approvalSignature: _approvalSignature, ...unsigned } = request;
  const expected = signProviderRecoveryReleaseCertificate(unsigned, secret);
  const a = Buffer.from(expected, "hex"); const b = Buffer.from(request.approvalSignature, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("provider_recovery_release_certificate_signature_mismatch");

  const release = releaseEvidence(env);
  if (request.sourceSha256 !== release.sourceSha256 || request.buildSha256 !== release.buildSha256 || request.buildId !== release.buildId || request.exactCheckpoint !== release.exactCheckpoint) throw new Error("provider_recovery_release_certificate_exact_release_mismatch");
  const probe = await dependencies.probe({ env });
  if (!probe.stagingProven || !probe.capabilityDigest || probe.capabilityDigest !== request.capabilityDigest) throw new Error("provider_recovery_release_certificate_staging_not_proven");
  const quality = await dependencies.providerQuality();
  if (!quality.ready || quality.qualityDigest !== request.qualityDigest) throw new Error("provider_recovery_release_certificate_quality_not_proven");
  const incident = await dependencies.incidentGate({ expectedQualityDigest: quality.qualityDigest });
  if (!incident.ready || incident.state !== "resolved" || incident.qualityStableAgeSeconds < 900 || incident.incidentDigest !== request.incidentDigest) throw new Error("provider_recovery_release_certificate_incident_not_resolved");
  const rollback = await dependencies.rollbackGate({ env });
  if (!rollback.executionVerified || !rollback.promotionReentryReady || rollback.executionDigest !== request.rollbackExecutionDigest) throw new Error("provider_recovery_release_certificate_rollback_not_verified");
  const smoke = await dependencies.smokeGate({ expected: { rollbackExecutionDigest: request.rollbackExecutionDigest, incidentDigest: request.incidentDigest, qualityDigest: request.qualityDigest, capabilityDigest: request.capabilityDigest, sourceSha256: request.sourceSha256, buildSha256: request.buildSha256, exactCheckpoint: request.exactCheckpoint }, dependencies: { rpc: dependencies.rpc }, now });
  if (!smoke.ready || smoke.customerSmokeDigest !== request.customerSmokeDigest || smoke.providerSmokeDigest !== request.providerSmokeDigest) throw new Error("provider_recovery_release_certificate_smoke_not_verified");
  const recovery = await dependencies.recoveryProofGate({ env, expected: { rollbackExecutionDigest: request.rollbackExecutionDigest, incidentDigest: request.incidentDigest, qualityDigest: request.qualityDigest, capabilityDigest: request.capabilityDigest, sourceSha256: request.sourceSha256, buildSha256: request.buildSha256, exactCheckpoint: request.exactCheckpoint } });
  if (!recovery.ready || recovery.proofDigest !== request.recoveryProofDigest) throw new Error("provider_recovery_release_certificate_recovery_proof_not_verified");

  const approvalDigest = sha256(canonical(unsigned));
  const idempotencyKey = sha256(`provider-recovery-release-certificate|${request.rollbackExecutionDigest}|${request.sourceSha256}|${request.buildSha256}|${request.recoveryProofDigest}`);
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
  const commonArgs = {
    p_idempotency_key: idempotencyKey,
    p_rollback_execution_digest: request.rollbackExecutionDigest,
    p_incident_digest: request.incidentDigest,
    p_quality_digest: request.qualityDigest,
    p_capability_digest: request.capabilityDigest,
    p_source_sha256: request.sourceSha256,
    p_build_sha256: request.buildSha256,
    p_build_id_hash: sha256(request.buildId),
    p_exact_checkpoint: request.exactCheckpoint,
    p_recovery_proof_digest: request.recoveryProofDigest,
    p_customer_smoke_digest: request.customerSmokeDigest,
    p_provider_smoke_digest: request.providerSmokeDigest,
    p_operator_hash: sha256(request.operatorId),
    p_reason_hash: sha256(request.reason),
    p_approval_digest: approvalDigest,
    p_expires_at: expiresAt.toISOString(),
  };
  const { data: recordData } = await dependencies.rpc({ operation: "provider_recovery_release_certificate_record", args: commonArgs });
  const recorded = row(recordData); const certificateDigest = clean(recorded?.certificate_digest).toLowerCase();
  if (clean(recorded?.state) !== "recorded" || !isSha(certificateDigest)) throw new Error("provider_recovery_release_certificate_record_failed");
  const { data: verifyData } = await dependencies.rpc({ operation: "provider_recovery_release_certificate_verify", args: { p_certificate_digest: certificateDigest, ...commonArgs } });
  const verified = row(verifyData);
  if (clean(verified?.state) !== "verified" || clean(verified?.certificate_digest).toLowerCase() !== certificateDigest) throw new Error("provider_recovery_release_certificate_verification_failed");
  return {
    schemaVersion: "velmere.provider-recovery-release-certificate-result.v1" as const,
    ok: true,
    state: "verified" as const,
    idempotent: recorded?.idempotent === true,
    certificateDigest,
    rollbackExecutionDigest: request.rollbackExecutionDigest,
    expiresAt: expiresAt.toISOString(),
    approvalDigest,
    privacyBoundary: "Only SHA-256 digests, expiry and aggregate state are returned. Operator identity, reason, signature, nonce, build ID, customer data and provider payloads are omitted.",
  };
}

export async function getProviderRecoveryReleaseCertificateGate(input: {
  env?: EnvLike;
  expected?: {
    rollbackExecutionDigest: string | null;
    incidentDigest: string | null;
    qualityDigest: string | null;
    capabilityDigest: string | null;
    sourceSha256: string | null;
    buildSha256: string | null;
    buildId: string | null;
    exactCheckpoint: number | null;
    recoveryProofDigest: string | null;
    customerSmokeDigest: string | null;
    providerSmokeDigest: string | null;
  };
  dependencies?: Partial<Dependencies>;
} = {}): Promise<ProviderRecoveryReleaseCertificateGate> {
  const env = input.env ?? process.env;
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  const rollback = input.expected?.rollbackExecutionDigest ? { executionDigest: input.expected.rollbackExecutionDigest } : await dependencies.rollbackGate({ env });
  const rollbackExecutionDigest = clean(rollback.executionDigest).toLowerCase();
  const privacyBoundary = "Only aggregate state, expiry and SHA-256 digests are exposed. Customer/provider payloads, operator data, build ID and secrets are omitted.";
  if (!isSha(rollbackExecutionDigest)) return { schemaVersion: "velmere.provider-recovery-release-certificate-gate.v1", ready: true, required: false, state: "not_required", certificateDigest: null, rollbackExecutionDigest: null, expiresAt: null, blockers: [], privacyBoundary };
  const release = releaseEvidence(env);
  const expected = input.expected;
  const fields = {
    incidentDigest: clean(expected?.incidentDigest).toLowerCase(), qualityDigest: clean(expected?.qualityDigest).toLowerCase(), capabilityDigest: clean(expected?.capabilityDigest).toLowerCase(),
    sourceSha256: clean(expected?.sourceSha256 ?? release.sourceSha256).toLowerCase(), buildSha256: clean(expected?.buildSha256 ?? release.buildSha256).toLowerCase(), buildId: clean(expected?.buildId ?? release.buildId),
    exactCheckpoint: expected?.exactCheckpoint ?? release.exactCheckpoint, recoveryProofDigest: clean(expected?.recoveryProofDigest).toLowerCase(), customerSmokeDigest: clean(expected?.customerSmokeDigest).toLowerCase(), providerSmokeDigest: clean(expected?.providerSmokeDigest).toLowerCase(),
  };
  const blockers: string[] = [];
  if (![fields.incidentDigest, fields.qualityDigest, fields.capabilityDigest, fields.sourceSha256, fields.buildSha256, fields.recoveryProofDigest, fields.customerSmokeDigest, fields.providerSmokeDigest].every(isSha)) blockers.push("provider_recovery_release_certificate_evidence_missing");
  if (!safeBuildId(fields.buildId) || fields.exactCheckpoint === null) blockers.push("provider_recovery_release_certificate_exact_release_missing");
  if (blockers.length > 0) return { schemaVersion: "velmere.provider-recovery-release-certificate-gate.v1", ready: false, required: true, state: "blocked", certificateDigest: null, rollbackExecutionDigest, expiresAt: null, blockers, privacyBoundary };
  try {
    const { data } = await dependencies.rpc({ operation: "provider_recovery_release_certificate_status", args: {
      p_rollback_execution_digest: rollbackExecutionDigest, p_incident_digest: fields.incidentDigest, p_quality_digest: fields.qualityDigest, p_capability_digest: fields.capabilityDigest,
      p_source_sha256: fields.sourceSha256, p_build_sha256: fields.buildSha256, p_build_id_hash: sha256(fields.buildId), p_exact_checkpoint: fields.exactCheckpoint,
      p_recovery_proof_digest: fields.recoveryProofDigest, p_customer_smoke_digest: fields.customerSmokeDigest, p_provider_smoke_digest: fields.providerSmokeDigest, p_now: dependencies.now().toISOString(),
    } });
    const status = row(data); const state = clean(status?.state) as ProviderRecoveryReleaseCertificateGate["state"];
    const certificateDigest = clean(status?.certificate_digest).toLowerCase(); const expiresAt = clean(status?.expires_at) || null;
    const statusBlockers = Array.isArray(status?.blockers) ? status.blockers.map(clean).filter(Boolean) : [];
    const ready = state === "verified" && isSha(certificateDigest) && statusBlockers.length === 0;
    return { schemaVersion: "velmere.provider-recovery-release-certificate-gate.v1", ready, required: true, state: ready ? "verified" : state || "missing", certificateDigest: isSha(certificateDigest) ? certificateDigest : null, rollbackExecutionDigest, expiresAt, blockers: ready ? [] : statusBlockers.length ? statusBlockers : ["provider_recovery_release_certificate_not_verified"], privacyBoundary };
  } catch {
    return { schemaVersion: "velmere.provider-recovery-release-certificate-gate.v1", ready: false, required: true, state: "store_failed", certificateDigest: null, rollbackExecutionDigest, expiresAt: null, blockers: ["provider_recovery_release_certificate_store_failed"], privacyBoundary };
  }
}
