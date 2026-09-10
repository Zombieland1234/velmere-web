import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";
import { probeDurableComputationStaging } from "@/lib/jobs/durable-computation-staging";
import { getProviderObservationPromotionQuality } from "@/lib/market-integrity/provider-observation-quarantine";
import { getProviderQualityIncidentGate } from "@/lib/market-integrity/provider-quality-incident-response";
import { getProviderQualityRollbackRecoveryGate } from "@/lib/market-integrity/provider-quality-auto-rollback";
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
  smokeGate: typeof getProviderRecoverySmokeGate;
};

const defaultDependencies: Dependencies = {
  rpc: runRegisteredServiceRoleRpc,
  now: () => new Date(),
  probe: probeDurableComputationStaging,
  providerQuality: getProviderObservationPromotionQuality,
  incidentGate: getProviderQualityIncidentGate,
  rollbackGate: getProviderQualityRollbackRecoveryGate,
  smokeGate: getProviderRecoverySmokeGate,
};

export type ProviderQualityRecoveryProofRequest = {
  rollbackExecutionDigest: string;
  incidentDigest: string;
  qualityDigest: string;
  capabilityDigest: string;
  sourceSha256: string;
  buildSha256: string;
  exactCheckpoint: number;
  customerSmokeDigest: string;
  providerSmokeDigest: string;
  operatorId: string;
  reason: string;
  approvalTimestamp: number;
  approvalNonce: string;
  approvalSignature: string;
};

export type ProviderQualityRecoveryProofGate = {
  schemaVersion: "velmere.provider-quality-recovery-proof-gate.v1";
  ready: boolean;
  required: boolean;
  state: "not_required" | "pending" | "verified" | "blocked" | "store_failed";
  proofDigest: string | null;
  rollbackExecutionDigest: string | null;
  customerSmokeDigest: string | null;
  providerSmokeDigest: string | null;
  blockers: string[];
  privacyBoundary: string;
};

function clean(value: unknown) { return String(value ?? "").trim(); }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function isSha(value: string) { return /^[0-9a-f]{64}$/.test(value); }
function usableSecret(value: string) { return value.length >= 32 && !/(example|placeholder|changeme|dummy|replace[-_ ]?me|never[-_ ]?production)/i.test(value); }
function row(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return data.find((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) ?? null;
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}
function exactCheckpoint(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 4725 && parsed <= 999999 ? parsed : null;
}

function releaseEvidence(env: EnvLike) {
  const sourceSha256 = clean(env.VELMERE_DURABLE_EXACT_SOURCE_SHA256).toLowerCase();
  const buildSha256 = clean(env.VELMERE_DURABLE_EXACT_BUILD_SHA256).toLowerCase();
  const checkpoint = exactCheckpoint(env.VELMERE_DURABLE_EXACT_CHECKPOINT);
  return {
    sourceSha256: isSha(sourceSha256) ? sourceSha256 : null,
    buildSha256: isSha(buildSha256) ? buildSha256 : null,
    exactCheckpoint: checkpoint,
  };
}

async function resolveSmokeEvidence(input: {
  env: EnvLike;
  dependencies: Dependencies;
  expected: { rollbackExecutionDigest: string; incidentDigest: string; qualityDigest: string; capabilityDigest: string; sourceSha256: string; buildSha256: string; exactCheckpoint: number };
}) {
  try {
    const gate = await input.dependencies.smokeGate({ expected: input.expected, dependencies: { rpc: input.dependencies.rpc } });
    if (gate.ready && gate.customerSmokeDigest && gate.providerSmokeDigest) return gate;
  } catch {
    // A non-production compatibility fallback keeps historical local fixtures executable.
  }
  const productionLike = input.env.NODE_ENV === "production" || input.env.VERCEL_ENV === "production";
  const customerSmokeDigest = clean(input.env.VELMERE_PROVIDER_RECOVERY_CUSTOMER_SMOKE_SHA256).toLowerCase();
  const providerSmokeDigest = clean(input.env.VELMERE_PROVIDER_RECOVERY_PROVIDER_SMOKE_SHA256).toLowerCase();
  if (!productionLike && isSha(customerSmokeDigest) && isSha(providerSmokeDigest)) {
    return { ready: true, customerSmokeDigest, providerSmokeDigest, blockers: ["legacy_nonproduction_smoke_digest_fallback"] };
  }
  return { ready: false, customerSmokeDigest: null, providerSmokeDigest: null, blockers: ["provider_recovery_smoke_receipts_not_verified"] };
}

function canonicalRequest(input: Omit<ProviderQualityRecoveryProofRequest, "approvalSignature">) {
  return JSON.stringify({
    rollbackExecutionDigest: input.rollbackExecutionDigest,
    incidentDigest: input.incidentDigest,
    qualityDigest: input.qualityDigest,
    capabilityDigest: input.capabilityDigest,
    sourceSha256: input.sourceSha256,
    buildSha256: input.buildSha256,
    exactCheckpoint: input.exactCheckpoint,
    customerSmokeDigest: input.customerSmokeDigest,
    providerSmokeDigest: input.providerSmokeDigest,
    operatorHash: sha256(input.operatorId),
    reasonHash: sha256(input.reason),
    approvalTimestamp: input.approvalTimestamp,
    approvalNonce: input.approvalNonce,
  });
}

export function signProviderQualityRecoveryProof(
  input: Omit<ProviderQualityRecoveryProofRequest, "approvalSignature">,
  secret: string,
) {
  if (!usableSecret(secret)) throw new Error("provider_recovery_proof_secret_missing_or_weak");
  return createHmac("sha256", secret).update(canonicalRequest(input)).digest("hex");
}

function normalizeRequest(input: ProviderQualityRecoveryProofRequest) {
  const request = {
    ...input,
    rollbackExecutionDigest: clean(input.rollbackExecutionDigest).toLowerCase(),
    incidentDigest: clean(input.incidentDigest).toLowerCase(),
    qualityDigest: clean(input.qualityDigest).toLowerCase(),
    capabilityDigest: clean(input.capabilityDigest).toLowerCase(),
    sourceSha256: clean(input.sourceSha256).toLowerCase(),
    buildSha256: clean(input.buildSha256).toLowerCase(),
    customerSmokeDigest: clean(input.customerSmokeDigest).toLowerCase(),
    providerSmokeDigest: clean(input.providerSmokeDigest).toLowerCase(),
    operatorId: clean(input.operatorId),
    reason: clean(input.reason),
    approvalNonce: clean(input.approvalNonce),
    approvalSignature: clean(input.approvalSignature).toLowerCase(),
  } satisfies ProviderQualityRecoveryProofRequest;
  if (![request.rollbackExecutionDigest, request.incidentDigest, request.qualityDigest, request.capabilityDigest, request.sourceSha256, request.buildSha256, request.customerSmokeDigest, request.providerSmokeDigest, request.approvalSignature].every(isSha)) {
    throw new Error("provider_recovery_proof_digest_invalid");
  }
  if (exactCheckpoint(request.exactCheckpoint) === null) throw new Error("provider_recovery_proof_checkpoint_invalid");
  if (request.operatorId.length < 3 || request.operatorId.length > 160) throw new Error("provider_recovery_proof_operator_invalid");
  if (request.reason.length < 12 || request.reason.length > 500) throw new Error("provider_recovery_proof_reason_invalid");
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(request.approvalNonce)) throw new Error("provider_recovery_proof_nonce_invalid");
  return request;
}

function verifyRequest(request: ProviderQualityRecoveryProofRequest, env: EnvLike, now: Date) {
  const secret = clean(env.VELMERE_PROVIDER_RECOVERY_PROOF_SECRET);
  if (!usableSecret(secret)) throw new Error("provider_recovery_proof_secret_missing_or_weak");
  const nowSeconds = Math.trunc(now.getTime() / 1000);
  if (!Number.isInteger(request.approvalTimestamp) || Math.abs(nowSeconds - request.approvalTimestamp) > 300) {
    throw new Error("provider_recovery_proof_approval_expired_or_future");
  }
  const { approvalSignature: _approvalSignature, ...unsigned } = request;
  const expected = signProviderQualityRecoveryProof(unsigned, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(request.approvalSignature, "hex");
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new Error("provider_recovery_proof_signature_mismatch");
  }
}

export async function recordProviderQualityRecoveryProof(input: {
  request: ProviderQualityRecoveryProofRequest;
  env?: EnvLike;
  dependencies?: Partial<Dependencies>;
}) {
  const env = input.env ?? process.env;
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  const request = normalizeRequest(input.request);
  verifyRequest(request, env, dependencies.now());
  const release = releaseEvidence(env);
  if (request.sourceSha256 !== release.sourceSha256 || request.buildSha256 !== release.buildSha256 || request.exactCheckpoint !== release.exactCheckpoint) {
    throw new Error("provider_recovery_proof_exact_release_mismatch");
  }
  const probe = await dependencies.probe({ env });
  if (!probe.stagingProven || !probe.capabilityDigest || request.capabilityDigest !== probe.capabilityDigest) {
    throw new Error("provider_recovery_proof_staging_not_proven");
  }
  const quality = await dependencies.providerQuality();
  if (!quality.ready || request.qualityDigest !== quality.qualityDigest) throw new Error("provider_recovery_proof_quality_not_proven");
  const incident = await dependencies.incidentGate({ expectedQualityDigest: quality.qualityDigest });
  if (!incident.ready || incident.state !== "resolved" || incident.qualityStableAgeSeconds < 900 || request.incidentDigest !== incident.incidentDigest) {
    throw new Error("provider_recovery_proof_incident_not_resolved");
  }
  const rollback = await dependencies.rollbackGate({ env });
  if (!rollback.executionVerified || !rollback.promotionReentryReady || request.rollbackExecutionDigest !== rollback.executionDigest) {
    throw new Error("provider_recovery_proof_rollback_not_verified");
  }
  const smoke = await resolveSmokeEvidence({
    env,
    dependencies,
    expected: {
      rollbackExecutionDigest: request.rollbackExecutionDigest,
      incidentDigest: request.incidentDigest,
      qualityDigest: request.qualityDigest,
      capabilityDigest: request.capabilityDigest,
      sourceSha256: request.sourceSha256,
      buildSha256: request.buildSha256,
      exactCheckpoint: request.exactCheckpoint,
    },
  });
  if (!smoke.ready || request.customerSmokeDigest !== smoke.customerSmokeDigest || request.providerSmokeDigest !== smoke.providerSmokeDigest) {
    throw new Error("provider_recovery_proof_smoke_digest_mismatch");
  }
  const { approvalSignature: _approvalSignature, ...unsigned } = request;
  const approvalDigest = sha256(canonicalRequest(unsigned));
  const idempotencyKey = sha256(`provider-quality-recovery-proof|${request.rollbackExecutionDigest}|${request.sourceSha256}|${request.buildSha256}`);
  const { data: recordData } = await dependencies.rpc({
    operation: "provider_quality_recovery_proof_record",
    args: {
      p_idempotency_key: idempotencyKey,
      p_rollback_execution_digest: request.rollbackExecutionDigest,
      p_incident_digest: request.incidentDigest,
      p_quality_digest: request.qualityDigest,
      p_capability_digest: request.capabilityDigest,
      p_source_sha256: request.sourceSha256,
      p_build_sha256: request.buildSha256,
      p_exact_checkpoint: request.exactCheckpoint,
      p_customer_smoke_digest: request.customerSmokeDigest,
      p_provider_smoke_digest: request.providerSmokeDigest,
      p_operator_hash: sha256(request.operatorId),
      p_reason_hash: sha256(request.reason),
      p_approval_digest: approvalDigest,
    },
  });
  const recorded = row(recordData);
  const proofDigest = clean(recorded?.proof_digest).toLowerCase();
  if (clean(recorded?.state) !== "recorded" || !isSha(proofDigest)) throw new Error("provider_recovery_proof_record_failed");
  const { data: verifyData } = await dependencies.rpc({
    operation: "provider_quality_recovery_proof_verify",
    args: {
      p_proof_digest: proofDigest,
      p_rollback_execution_digest: request.rollbackExecutionDigest,
      p_incident_digest: request.incidentDigest,
      p_quality_digest: request.qualityDigest,
      p_capability_digest: request.capabilityDigest,
      p_source_sha256: request.sourceSha256,
      p_build_sha256: request.buildSha256,
      p_exact_checkpoint: request.exactCheckpoint,
      p_customer_smoke_digest: request.customerSmokeDigest,
      p_provider_smoke_digest: request.providerSmokeDigest,
    },
  });
  const verified = row(verifyData);
  if (clean(verified?.state) !== "verified" || clean(verified?.proof_digest).toLowerCase() !== proofDigest) {
    throw new Error("provider_recovery_proof_verification_failed");
  }
  return {
    schemaVersion: "velmere.provider-quality-recovery-proof-result.v1" as const,
    ok: true,
    state: "verified" as const,
    idempotent: recorded?.idempotent === true,
    proofDigest,
    rollbackExecutionDigest: request.rollbackExecutionDigest,
    approvalDigest,
    exactCheckpoint: request.exactCheckpoint,
    privacyBoundary: "Only SHA-256 digests and aggregate state are returned. Operator identity, reason, signatures, nonces, customer data, provider payloads and database row IDs are omitted.",
  };
}

export async function getProviderQualityRecoveryProofGate(input: {
  env?: EnvLike;
  expected?: {
    rollbackExecutionDigest: string | null;
    incidentDigest: string | null;
    qualityDigest: string | null;
    capabilityDigest: string | null;
    sourceSha256: string | null;
    buildSha256: string | null;
    exactCheckpoint: number | null;
  };
  dependencies?: Partial<Dependencies>;
} = {}): Promise<ProviderQualityRecoveryProofGate> {
  const env = input.env ?? process.env;
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  const rollback = input.expected?.rollbackExecutionDigest
    ? { executionDigest: input.expected.rollbackExecutionDigest, executionVerified: true, status: "verified" }
    : await dependencies.rollbackGate({ env });
  const rollbackExecutionDigest = clean(rollback.executionDigest).toLowerCase();
  if (!isSha(rollbackExecutionDigest)) {
    return {
      schemaVersion: "velmere.provider-quality-recovery-proof-gate.v1",
      ready: true,
      required: false,
      state: "not_required",
      proofDigest: null,
      rollbackExecutionDigest: null,
      customerSmokeDigest: null,
      providerSmokeDigest: null,
      blockers: [],
      privacyBoundary: "No rollback history requires no recovery proof. Only aggregate state and SHA-256 digests are exposed.",
    };
  }
  const release = releaseEvidence(env);
  const expected = input.expected;
  const incidentDigest = clean(expected?.incidentDigest).toLowerCase();
  const qualityDigest = clean(expected?.qualityDigest).toLowerCase();
  const capabilityDigest = clean(expected?.capabilityDigest).toLowerCase();
  const sourceSha256 = clean(expected?.sourceSha256 ?? release.sourceSha256).toLowerCase();
  const buildSha256 = clean(expected?.buildSha256 ?? release.buildSha256).toLowerCase();
  const checkpoint = expected?.exactCheckpoint ?? release.exactCheckpoint;
  const blockers: string[] = [];
  if (!isSha(incidentDigest)) blockers.push("provider_recovery_incident_digest_missing");
  if (!isSha(qualityDigest)) blockers.push("provider_recovery_quality_digest_missing");
  if (!isSha(capabilityDigest)) blockers.push("provider_recovery_capability_digest_missing");
  if (!isSha(sourceSha256) || !isSha(buildSha256) || checkpoint === null) blockers.push("provider_recovery_exact_release_missing");
  let smoke: Awaited<ReturnType<typeof resolveSmokeEvidence>> | null = null;
  if (blockers.length === 0) {
    smoke = await resolveSmokeEvidence({ env, dependencies, expected: { rollbackExecutionDigest, incidentDigest, qualityDigest, capabilityDigest, sourceSha256, buildSha256, exactCheckpoint: checkpoint! } });
    if (!smoke.ready || !smoke.customerSmokeDigest) blockers.push("provider_recovery_customer_smoke_missing");
    if (!smoke.ready || !smoke.providerSmokeDigest) blockers.push("provider_recovery_provider_smoke_missing");
  }
  if (blockers.length > 0 || !smoke?.customerSmokeDigest || !smoke?.providerSmokeDigest) {
    return {
      schemaVersion: "velmere.provider-quality-recovery-proof-gate.v1", ready: false, required: true, state: "blocked", proofDigest: null,
      rollbackExecutionDigest, customerSmokeDigest: smoke?.customerSmokeDigest ?? null, providerSmokeDigest: smoke?.providerSmokeDigest ?? null, blockers,
      privacyBoundary: "Only aggregate state and SHA-256 digests are exposed. Smoke payloads, account data, provider payloads and secrets are omitted.",
    };
  }
  try {
    const { data } = await dependencies.rpc({
      operation: "provider_quality_recovery_proof_status",
      args: {
        p_rollback_execution_digest: rollbackExecutionDigest,
        p_incident_digest: incidentDigest,
        p_quality_digest: qualityDigest,
        p_capability_digest: capabilityDigest,
        p_source_sha256: sourceSha256,
        p_build_sha256: buildSha256,
        p_exact_checkpoint: checkpoint,
        p_customer_smoke_digest: smoke.customerSmokeDigest,
        p_provider_smoke_digest: smoke.providerSmokeDigest,
      },
    });
    const status = row(data);
    const state = clean(status?.state);
    const proofDigest = clean(status?.proof_digest).toLowerCase();
    const ready = state === "verified" && isSha(proofDigest);
    return {
      schemaVersion: "velmere.provider-quality-recovery-proof-gate.v1",
      ready,
      required: true,
      state: ready ? "verified" : state === "pending" ? "pending" : "blocked",
      proofDigest: ready ? proofDigest : null,
      rollbackExecutionDigest,
      customerSmokeDigest: smoke.customerSmokeDigest,
      providerSmokeDigest: smoke.providerSmokeDigest,
      blockers: ready ? [] : ["provider_recovery_proof_not_verified"],
      privacyBoundary: "Only aggregate state and SHA-256 digests are exposed. Smoke payloads, account data, provider payloads and secrets are omitted.",
    };
  } catch {
    return {
      schemaVersion: "velmere.provider-quality-recovery-proof-gate.v1", ready: false, required: true, state: "store_failed", proofDigest: null,
      rollbackExecutionDigest, customerSmokeDigest: smoke?.customerSmokeDigest ?? null, providerSmokeDigest: smoke?.providerSmokeDigest ?? null,
      blockers: ["provider_recovery_proof_store_failed"],
      privacyBoundary: "Only aggregate state and SHA-256 digests are exposed. Smoke payloads, account data, provider payloads and secrets are omitted.",
    };
  }
}
