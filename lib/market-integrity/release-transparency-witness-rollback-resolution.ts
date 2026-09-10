import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  runRegisteredServiceRoleRpc,
  type SupabaseRpcOperation,
} from "@/lib/db/supabase-rpc-operation-registry";

export type WitnessRollbackResolutionEligibilityInput = {
  healthState: string;
  releaseSuspended: boolean;
  rollbackRequired: boolean;
  rollbackVerified: boolean;
  activeDeploymentCount: number;
  quorumState: string;
  organizationCount: number;
  signatureThreshold: number;
  quorumExpiresAtMs?: number | null;
  stableStartedAtMs?: number | null;
  minStableSeconds?: number;
  nowMs?: number;
  blockerCodes?: string[];
};

export type WitnessRollbackResolutionEligibility = {
  schemaVersion: "velmere.release-transparency-witness-rollback-resolution-eligibility.v1";
  state: "eligible" | "pending" | "blocked" | "already_resolved";
  eligible: boolean;
  stableSeconds: number;
  requiredStableSeconds: number;
  blockers: string[];
  eligibilityDigest: string;
};

export type ReleaseTransparencyWitnessRollbackResolutionRequest = {
  environment: "staging" | "production";
  audience: string;
  healthDigest: string;
  quorumDigest: string;
  checkpointDigest: string;
  rollbackLedgerDigest: string;
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

export function evaluateReleaseTransparencyWitnessRollbackResolution(
  input: WitnessRollbackResolutionEligibilityInput,
): WitnessRollbackResolutionEligibility {
  const requiredStableSeconds = Math.max(
    300,
    Math.min(86_400, Math.trunc(input.minStableSeconds ?? 900)),
  );
  const nowMs = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();
  const stableStartedAtMs = Number(input.stableStartedAtMs ?? 0);
  const stableSeconds = stableStartedAtMs > 0
    ? Math.max(0, Math.floor((nowMs - stableStartedAtMs) / 1000))
    : 0;
  const blockers = [...new Set((input.blockerCodes ?? []).map(clean).filter(Boolean))];

  let state: WitnessRollbackResolutionEligibility["state"];
  if (input.healthState === "rollback_resolved" && !input.rollbackRequired) {
    state = "already_resolved";
  } else {
    if (input.healthState !== "rollback_required") blockers.push("witness_rollback_resolution_health_not_required");
    if (!input.releaseSuspended) blockers.push("witness_rollback_resolution_release_not_suspended");
    if (!input.rollbackRequired) blockers.push("witness_rollback_resolution_flag_missing");
    if (!input.rollbackVerified) blockers.push("witness_rollback_resolution_rollback_not_verified");
    if (Math.max(0, Math.trunc(input.activeDeploymentCount || 0)) !== 0) blockers.push("witness_rollback_resolution_active_deployment_present");
    if (input.quorumState !== "verified") blockers.push("witness_rollback_resolution_quorum_not_verified");
    if (Math.max(0, Math.trunc(input.organizationCount || 0)) < Math.max(2, Math.trunc(input.signatureThreshold || 0))) {
      blockers.push("witness_rollback_resolution_organization_threshold_not_met");
    }
    if (!Number.isFinite(input.quorumExpiresAtMs) || Number(input.quorumExpiresAtMs) <= nowMs) {
      blockers.push("witness_rollback_resolution_quorum_expired");
    }
    if (stableSeconds < requiredStableSeconds) blockers.push("witness_rollback_resolution_stability_window_incomplete");
    state = blockers.length === 0 ? "eligible" : stableSeconds < requiredStableSeconds ? "pending" : "blocked";
  }

  const uniqueBlockers = [...new Set(blockers)].sort();
  const payload = {
    state,
    healthState: clean(input.healthState),
    releaseSuspended: Boolean(input.releaseSuspended),
    rollbackRequired: Boolean(input.rollbackRequired),
    rollbackVerified: Boolean(input.rollbackVerified),
    activeDeploymentCount: Math.max(0, Math.trunc(input.activeDeploymentCount || 0)),
    quorumState: clean(input.quorumState),
    organizationCount: Math.max(0, Math.trunc(input.organizationCount || 0)),
    signatureThreshold: Math.max(2, Math.trunc(input.signatureThreshold || 0)),
    stableSeconds,
    requiredStableSeconds,
    blockers: uniqueBlockers,
  };
  return {
    schemaVersion: "velmere.release-transparency-witness-rollback-resolution-eligibility.v1",
    state,
    eligible: state === "eligible",
    stableSeconds,
    requiredStableSeconds,
    blockers: uniqueBlockers,
    eligibilityDigest: sha(stable(payload)),
  };
}

function canonicalResolutionPayload(
  input: Omit<ReleaseTransparencyWitnessRollbackResolutionRequest, "approvalSignature">,
) {
  return stable({
    environment: input.environment,
    audienceHash: sha(clean(input.audience)),
    healthDigest: clean(input.healthDigest).toLowerCase(),
    quorumDigest: clean(input.quorumDigest).toLowerCase(),
    checkpointDigest: clean(input.checkpointDigest).toLowerCase(),
    rollbackLedgerDigest: clean(input.rollbackLedgerDigest).toLowerCase(),
    minStableSeconds: Math.trunc(input.minStableSeconds),
    operatorHash: sha(clean(input.operatorId)),
    reasonHash: sha(clean(input.reason)),
    approvalTimestamp: Math.trunc(input.approvalTimestamp),
    approvalNonce: clean(input.approvalNonce),
  });
}

export function signReleaseTransparencyWitnessRollbackResolution(
  input: Omit<ReleaseTransparencyWitnessRollbackResolutionRequest, "approvalSignature">,
  secret: string,
) {
  if (!usableSecret(secret)) throw new Error("release_transparency_witness_rollback_resolution_secret_missing_or_weak");
  return createHmac("sha256", secret).update(canonicalResolutionPayload(input)).digest("hex");
}

function normalizeRequest(request: ReleaseTransparencyWitnessRollbackResolutionRequest) {
  return {
    ...request,
    audience: clean(request.audience),
    healthDigest: clean(request.healthDigest).toLowerCase(),
    quorumDigest: clean(request.quorumDigest).toLowerCase(),
    checkpointDigest: clean(request.checkpointDigest).toLowerCase(),
    rollbackLedgerDigest: clean(request.rollbackLedgerDigest).toLowerCase(),
    operatorId: clean(request.operatorId),
    reason: clean(request.reason),
    approvalNonce: clean(request.approvalNonce),
    approvalSignature: clean(request.approvalSignature).toLowerCase(),
    minStableSeconds: Math.trunc(request.minStableSeconds),
    approvalTimestamp: Math.trunc(request.approvalTimestamp),
  };
}

export async function recordReleaseTransparencyWitnessRollbackResolution(input: {
  request: ReleaseTransparencyWitnessRollbackResolutionRequest;
  env?: Record<string, string | undefined>;
  dependencies?: { rpc: RpcRunner; now: () => Date };
}) {
  const env = input.env ?? process.env;
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const now = input.dependencies?.now?.() ?? new Date();
  const request = normalizeRequest(input.request);

  if (!(request.environment === "staging" || request.environment === "production")) throw new Error("release_transparency_witness_rollback_resolution_environment_invalid");
  if (request.audience.length < 8 || request.audience.length > 160) throw new Error("release_transparency_witness_rollback_resolution_audience_invalid");
  if (![request.healthDigest, request.quorumDigest, request.checkpointDigest, request.rollbackLedgerDigest].every(isSha)) {
    throw new Error("release_transparency_witness_rollback_resolution_digest_invalid");
  }
  if (request.minStableSeconds < 300 || request.minStableSeconds > 86_400) throw new Error("release_transparency_witness_rollback_resolution_stability_invalid");
  if (request.operatorId.length < 3 || request.operatorId.length > 160 || request.reason.length < 12 || request.reason.length > 500) {
    throw new Error("release_transparency_witness_rollback_resolution_operator_evidence_invalid");
  }
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(request.approvalNonce) || !isSha(request.approvalSignature)) {
    throw new Error("release_transparency_witness_rollback_resolution_approval_invalid");
  }
  const nowSeconds = Math.trunc(now.getTime() / 1000);
  if (Math.abs(nowSeconds - request.approvalTimestamp) > 300) throw new Error("release_transparency_witness_rollback_resolution_approval_expired");
  const secret = clean(env.VELMERE_RELEASE_WITNESS_ROLLBACK_RESOLUTION_SECRET);
  if (!usableSecret(secret)) throw new Error("release_transparency_witness_rollback_resolution_secret_missing_or_weak");
  const { approvalSignature: _signature, ...unsigned } = request;
  const expected = signReleaseTransparencyWitnessRollbackResolution(unsigned, secret);
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(request.approvalSignature, "hex");
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("release_transparency_witness_rollback_resolution_signature_mismatch");

  const resolutionDigest = sha(canonicalResolutionPayload(unsigned));
  const { data } = await rpc({
    operation: "release_transparency_witness_rollback_resolution_record",
    args: {
      p_idempotency_key: sha(`${resolutionDigest}:${request.approvalNonce}`),
      p_resolution_digest: resolutionDigest,
      p_environment: request.environment,
      p_audience_hash: sha(request.audience),
      p_health_digest: request.healthDigest,
      p_quorum_digest: request.quorumDigest,
      p_checkpoint_digest: request.checkpointDigest,
      p_rollback_ledger_digest: request.rollbackLedgerDigest,
      p_min_stable_seconds: request.minStableSeconds,
      p_operator_hash: sha(request.operatorId),
      p_reason_hash: sha(request.reason),
      p_approval_digest: sha(request.approvalSignature),
    },
  });
  return {
    schemaVersion: "velmere.release-transparency-witness-rollback-resolution.v1" as const,
    ok: true,
    resolutionDigest,
    data,
    privacyBoundary: "Only release-chain digests, bounded stability evidence and hashed operator approval are persisted; deployment IDs, witness signatures, keys and raw operator data are omitted from the response.",
  };
}

export async function verifyReleaseTransparencyWitnessRollbackResolution(input: {
  resolutionDigest: string;
  dependencies?: { rpc: RpcRunner };
}) {
  const resolutionDigest = clean(input.resolutionDigest).toLowerCase();
  if (!isSha(resolutionDigest)) throw new Error("release_transparency_witness_rollback_resolution_digest_invalid");
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const { data } = await rpc({
    operation: "release_transparency_witness_rollback_resolution_verify",
    args: { p_resolution_digest: resolutionDigest },
  });
  return {
    schemaVersion: "velmere.release-transparency-witness-rollback-resolution-verification.v1" as const,
    ok: true,
    resolutionDigest,
    data,
  };
}

export async function getReleaseTransparencyWitnessRollbackResolutionStatus(input: {
  environment?: "staging" | "production";
  dependencies?: { rpc: RpcRunner };
} = {}) {
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const { data } = await rpc({
    operation: "release_transparency_witness_rollback_resolution_status",
    args: { p_environment: input.environment ?? null },
  });
  return data;
}

export async function getPublicReleaseTransparencyWitnessRollbackResolutions(input: {
  environment?: "staging" | "production";
  limit?: number;
  dependencies?: { rpc: RpcRunner };
} = {}) {
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const limit = Math.max(1, Math.min(50, Number(input.limit ?? 10)));
  const { data } = await rpc({
    operation: "release_transparency_witness_rollback_resolution_public_feed",
    args: { p_environment: input.environment ?? null, p_limit: limit },
  });
  const rows = Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row))
    : [];
  const resolutions = rows.map((row) => ({
    environment: clean(row.environment),
    state: clean(row.state),
    resolutionDigest: clean(row.resolution_digest),
    healthDigest: clean(row.health_digest),
    quorumDigest: clean(row.quorum_digest),
    checkpointDigest: clean(row.checkpoint_digest),
    rollbackLedgerDigest: clean(row.rollback_ledger_digest),
    stableSeconds: Number(row.stable_seconds ?? 0),
    verifiedAt: row.verified_at ?? null,
  }));
  return {
    schemaVersion: "velmere.public-release-transparency-witness-rollback-resolutions.v1" as const,
    ok: true,
    resolutions,
    feedDigest: sha(stable(resolutions)),
    privacyBoundary: "Public rollback-resolution feed contains hashes, aggregate stability duration and state only; no deployment IDs, witness signatures, public keys, operator identity or reason.",
  };
}
