import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  runRegisteredServiceRoleRpc,
  type SupabaseRpcOperation,
} from "@/lib/db/supabase-rpc-operation-registry";

export type WitnessHealthRecoveryState =
  | "eligible"
  | "blocked"
  | "rollback_required"
  | "already_healthy";

export type WitnessHealthRecoveryEligibilityInput = {
  healthState: string;
  releaseSuspended: boolean;
  rollbackRequired: boolean;
  blockerCodes: string[];
  validOrganizationCount: number;
  signatureThreshold: number;
  recoveryStartedAtMs?: number | null;
  minStableSeconds?: number;
  nowMs?: number;
};

export type WitnessHealthRecoveryEligibility = {
  schemaVersion: "velmere.release-transparency-witness-health-recovery-eligibility.v1";
  state: WitnessHealthRecoveryState;
  eligible: boolean;
  stableSeconds: number;
  requiredStableSeconds: number;
  blockers: string[];
  eligibilityDigest: string;
};

export type ReleaseTransparencyWitnessHealthRecoveryRequest = {
  environment: "staging" | "production";
  audience: string;
  healthDigest: string;
  quorumDigest: string;
  checkpointDigest: string;
  minStableSeconds: number;
  operatorId: string;
  reason: string;
  approvalTimestamp: number;
  approvalNonce: string;
  approvalSignature: string;
};

type RpcRunner = (input: {
  operation: SupabaseRpcOperation;
  args?: Record<string, unknown>;
}) => Promise<{ data: unknown }>;

const clean = (value: unknown) => String(value ?? "").trim();
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const isSha = (value: string) => /^[0-9a-f]{64}$/.test(value);
const stable = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
};
const usableSecret = (value: string) =>
  value.length >= 32 &&
  !/(example|placeholder|changeme|dummy|replace[-_ ]?me|never[-_ ]?production)/i.test(value);

export function evaluateReleaseTransparencyWitnessHealthRecovery(
  input: WitnessHealthRecoveryEligibilityInput,
): WitnessHealthRecoveryEligibility {
  const requiredStableSeconds = Math.max(
    300,
    Math.min(86_400, Math.trunc(input.minStableSeconds ?? 900)),
  );
  const nowMs = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();
  const startedAt = Number(input.recoveryStartedAtMs ?? 0);
  const stableSeconds = startedAt > 0
    ? Math.max(0, Math.floor((nowMs - startedAt) / 1000))
    : 0;
  const blockers = [...new Set((input.blockerCodes ?? []).map(clean).filter(Boolean))].sort();

  let state: WitnessHealthRecoveryState = "blocked";
  if (!input.releaseSuspended && input.healthState === "healthy") {
    state = "already_healthy";
  } else if (input.rollbackRequired || input.healthState === "rollback_required") {
    state = "rollback_required";
    blockers.push("witness_recovery_rollback_must_complete_first");
  } else {
    if (input.healthState !== "recovery_pending") blockers.push("witness_recovery_not_pending");
    if (!input.releaseSuspended) blockers.push("witness_recovery_release_not_suspended");
    if (blockers.length === 0 && input.validOrganizationCount < input.signatureThreshold) {
      blockers.push("witness_recovery_organization_threshold_not_met");
    }
    if (stableSeconds < requiredStableSeconds) blockers.push("witness_recovery_stability_window_incomplete");
    if (blockers.length === 0) state = "eligible";
  }

  const uniqueBlockers = [...new Set(blockers)].sort();
  const payload = {
    state,
    stableSeconds,
    requiredStableSeconds,
    validOrganizationCount: Math.max(0, Math.trunc(input.validOrganizationCount || 0)),
    signatureThreshold: Math.max(2, Math.trunc(input.signatureThreshold || 0)),
    blockers: uniqueBlockers,
  };
  return {
    schemaVersion: "velmere.release-transparency-witness-health-recovery-eligibility.v1",
    state,
    eligible: state === "eligible",
    stableSeconds,
    requiredStableSeconds,
    blockers: uniqueBlockers,
    eligibilityDigest: sha(stable(payload)),
  };
}

function canonicalRecoveryPayload(
  input: Omit<ReleaseTransparencyWitnessHealthRecoveryRequest, "approvalSignature">,
) {
  return stable({
    environment: input.environment,
    audienceHash: sha(clean(input.audience)),
    healthDigest: clean(input.healthDigest).toLowerCase(),
    quorumDigest: clean(input.quorumDigest).toLowerCase(),
    checkpointDigest: clean(input.checkpointDigest).toLowerCase(),
    minStableSeconds: Math.trunc(input.minStableSeconds),
    operatorHash: sha(clean(input.operatorId)),
    reasonHash: sha(clean(input.reason)),
    approvalTimestamp: Math.trunc(input.approvalTimestamp),
    approvalNonce: clean(input.approvalNonce),
  });
}

export function signReleaseTransparencyWitnessHealthRecovery(
  input: Omit<ReleaseTransparencyWitnessHealthRecoveryRequest, "approvalSignature">,
  secret: string,
) {
  if (!usableSecret(secret)) {
    throw new Error("release_transparency_witness_recovery_secret_missing_or_weak");
  }
  return createHmac("sha256", secret)
    .update(canonicalRecoveryPayload(input))
    .digest("hex");
}

export async function applyReleaseTransparencyWitnessHealthRecovery(input: {
  request: ReleaseTransparencyWitnessHealthRecoveryRequest;
  env?: Record<string, string | undefined>;
  dependencies?: { rpc: RpcRunner; now: () => Date };
}) {
  const env = input.env ?? process.env;
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const now = input.dependencies?.now?.() ?? new Date();
  const request = {
    ...input.request,
    audience: clean(input.request.audience),
    healthDigest: clean(input.request.healthDigest).toLowerCase(),
    quorumDigest: clean(input.request.quorumDigest).toLowerCase(),
    checkpointDigest: clean(input.request.checkpointDigest).toLowerCase(),
    operatorId: clean(input.request.operatorId),
    reason: clean(input.request.reason),
    approvalNonce: clean(input.request.approvalNonce),
    approvalSignature: clean(input.request.approvalSignature).toLowerCase(),
    minStableSeconds: Math.trunc(input.request.minStableSeconds),
    approvalTimestamp: Math.trunc(input.request.approvalTimestamp),
  };

  if (!(request.environment === "staging" || request.environment === "production")) {
    throw new Error("release_transparency_witness_recovery_environment_invalid");
  }
  if (request.audience.length < 8 || request.audience.length > 160) {
    throw new Error("release_transparency_witness_recovery_audience_invalid");
  }
  if (![request.healthDigest, request.quorumDigest, request.checkpointDigest].every(isSha)) {
    throw new Error("release_transparency_witness_recovery_digest_invalid");
  }
  if (request.minStableSeconds < 300 || request.minStableSeconds > 86_400) {
    throw new Error("release_transparency_witness_recovery_stability_invalid");
  }
  if (request.operatorId.length < 3 || request.operatorId.length > 160 || request.reason.length < 12 || request.reason.length > 500) {
    throw new Error("release_transparency_witness_recovery_operator_evidence_invalid");
  }
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(request.approvalNonce) || !isSha(request.approvalSignature)) {
    throw new Error("release_transparency_witness_recovery_approval_invalid");
  }
  const nowSeconds = Math.trunc(now.getTime() / 1000);
  if (Math.abs(nowSeconds - request.approvalTimestamp) > 300) {
    throw new Error("release_transparency_witness_recovery_approval_expired");
  }
  const secret = clean(env.VELMERE_RELEASE_WITNESS_HEALTH_RECOVERY_SECRET);
  if (!usableSecret(secret)) {
    throw new Error("release_transparency_witness_recovery_secret_missing_or_weak");
  }
  const { approvalSignature: _signature, ...unsigned } = request;
  const expected = signReleaseTransparencyWitnessHealthRecovery(unsigned, secret);
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(request.approvalSignature, "hex");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error("release_transparency_witness_recovery_signature_mismatch");
  }

  const recoveryDigest = sha(canonicalRecoveryPayload(unsigned));
  const { data } = await rpc({
    operation: "release_transparency_witness_health_recovery_apply",
    args: {
      p_idempotency_key: sha(`${recoveryDigest}:${request.approvalNonce}`),
      p_recovery_digest: recoveryDigest,
      p_environment: request.environment,
      p_audience_hash: sha(request.audience),
      p_health_digest: request.healthDigest,
      p_quorum_digest: request.quorumDigest,
      p_checkpoint_digest: request.checkpointDigest,
      p_min_stable_seconds: request.minStableSeconds,
      p_operator_hash: sha(request.operatorId),
      p_reason_hash: sha(request.reason),
      p_approval_digest: sha(request.approvalSignature),
    },
  });
  return {
    schemaVersion: "velmere.release-transparency-witness-health-recovery.v1" as const,
    ok: true,
    recoveryDigest,
    data,
    privacyBoundary:
      "Only digests, bounded stability evidence and hashed operator approval are persisted; witness signatures, public keys, deployment IDs and raw operator data are omitted from the response.",
  };
}

export async function verifyReleaseTransparencyWitnessHealthRecovery(input: {
  recoveryDigest: string;
  dependencies?: { rpc: RpcRunner };
}) {
  const recoveryDigest = clean(input.recoveryDigest).toLowerCase();
  if (!isSha(recoveryDigest)) throw new Error("release_transparency_witness_recovery_digest_invalid");
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const { data } = await rpc({
    operation: "release_transparency_witness_health_recovery_verify",
    args: { p_recovery_digest: recoveryDigest },
  });
  return {
    schemaVersion: "velmere.release-transparency-witness-health-recovery-verification.v1" as const,
    ok: true,
    recoveryDigest,
    data,
  };
}

export async function getReleaseTransparencyWitnessHealthRecoveryStatus(input: {
  environment?: "staging" | "production";
  dependencies?: { rpc: RpcRunner };
} = {}) {
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const { data } = await rpc({
    operation: "release_transparency_witness_health_recovery_status",
    args: { p_environment: input.environment ?? null },
  });
  return data;
}

export async function getPublicReleaseTransparencyWitnessHealthRecoveries(input: {
  environment?: "staging" | "production";
  limit?: number;
  dependencies?: { rpc: RpcRunner };
} = {}) {
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const limit = Math.max(1, Math.min(50, Number(input.limit ?? 10)));
  const { data } = await rpc({
    operation: "release_transparency_witness_health_recovery_public_feed",
    args: { p_environment: input.environment ?? null, p_limit: limit },
  });
  const rows = Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row))
    : [];
  const recoveries = rows.map((row) => ({
    environment: clean(row.environment),
    state: clean(row.state),
    recoveryDigest: clean(row.recovery_digest),
    previousHealthDigest: clean(row.previous_health_digest),
    quorumDigest: clean(row.quorum_digest),
    checkpointDigest: clean(row.checkpoint_digest),
    stableSeconds: Number(row.stable_seconds ?? 0),
    appliedAt: row.applied_at ?? null,
  }));
  return {
    schemaVersion: "velmere.public-release-transparency-witness-health-recoveries.v1" as const,
    ok: true,
    recoveries,
    feedDigest: sha(stable(recoveries)),
    privacyBoundary:
      "Public recovery feed contains hashes, aggregate stability duration and state only; no deployment IDs, signatures, public keys, operator identity or reason.",
  };
}
