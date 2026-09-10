import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  runRegisteredServiceRoleRpc,
  type SupabaseRpcOperation,
} from "@/lib/db/supabase-rpc-operation-registry";

export type ReleaseTransparencyWitnessHealthState =
  | "healthy"
  | "suspended"
  | "rollback_required"
  | "no_active_deployment";

export type ReleaseTransparencyWitnessHealthInput = {
  activeDeployment: boolean;
  deploymentIdHash?: string | null;
  quorumDigest?: string | null;
  quorumState?: string | null;
  checkpointDigest?: string | null;
  witnessOrganizations: Array<{
    organizationHash: string;
    publicKeyFingerprint: string;
    validUntil?: number | null;
  }>;
  signatureThreshold: number;
  revokedFingerprints: string[];
  splitViewDetected?: boolean;
  degradedSince?: number | null;
  maxDegradedSeconds?: number;
  now?: number;
};

export type ReleaseTransparencyWitnessHealthEvaluation = {
  schemaVersion: "velmere.release-transparency-witness-health-evaluation.v1";
  state: ReleaseTransparencyWitnessHealthState;
  releaseSuspended: boolean;
  rollbackRequired: boolean;
  validOrganizationCount: number;
  signatureThreshold: number;
  revokedWitnessCount: number;
  expiredWitnessCount: number;
  blockers: string[];
  healthDigest: string;
  privacyBoundary: string;
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


export type ReleaseTransparencyWitnessPolicyRequest = {
  environment: "staging" | "production";
  audience: string;
  revokedWitnessFingerprints: string[];
  maxDegradedSeconds: number;
  operatorId: string;
  reason: string;
  approvalTimestamp: number;
  approvalNonce: string;
  approvalSignature: string;
};

const usableSecret = (value: string) =>
  value.length >= 32 &&
  !/(example|placeholder|changeme|dummy|replace[-_ ]?me|never[-_ ]?production)/i.test(value);

function canonicalPolicyPayload(
  input: Omit<ReleaseTransparencyWitnessPolicyRequest, "approvalSignature">,
) {
  return stable({
    environment: input.environment,
    audienceHash: sha(clean(input.audience)),
    revokedWitnessFingerprints: [...new Set(input.revokedWitnessFingerprints.map((value) => clean(value).toLowerCase()))].sort(),
    maxDegradedSeconds: Math.trunc(input.maxDegradedSeconds),
    operatorHash: sha(clean(input.operatorId)),
    reasonHash: sha(clean(input.reason)),
    approvalTimestamp: input.approvalTimestamp,
    approvalNonce: clean(input.approvalNonce),
  });
}

export function signReleaseTransparencyWitnessPolicy(
  input: Omit<ReleaseTransparencyWitnessPolicyRequest, "approvalSignature">,
  secret: string,
) {
  if (!usableSecret(secret)) throw new Error("release_transparency_witness_health_secret_missing_or_weak");
  return createHmac("sha256", secret).update(canonicalPolicyPayload(input)).digest("hex");
}

export async function applyReleaseTransparencyWitnessPolicy(input: {
  request: ReleaseTransparencyWitnessPolicyRequest;
  env?: Record<string, string | undefined>;
  dependencies?: { rpc: RpcRunner; now: () => Date };
}) {
  const env = input.env ?? process.env;
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const now = input.dependencies?.now?.() ?? new Date();
  const request = {
    ...input.request,
    audience: clean(input.request.audience),
    operatorId: clean(input.request.operatorId),
    reason: clean(input.request.reason),
    approvalNonce: clean(input.request.approvalNonce),
    approvalSignature: clean(input.request.approvalSignature).toLowerCase(),
    revokedWitnessFingerprints: [...new Set((input.request.revokedWitnessFingerprints ?? []).map((value) => clean(value).toLowerCase()))].sort(),
    maxDegradedSeconds: Math.trunc(input.request.maxDegradedSeconds),
  };
  if (!(request.environment === "staging" || request.environment === "production")) throw new Error("release_transparency_witness_policy_environment_invalid");
  if (request.audience.length < 8 || request.audience.length > 160) throw new Error("release_transparency_witness_policy_audience_invalid");
  if (request.revokedWitnessFingerprints.length > 64 || !request.revokedWitnessFingerprints.every(isSha)) throw new Error("release_transparency_witness_policy_revocations_invalid");
  if (request.maxDegradedSeconds < 60 || request.maxDegradedSeconds > 86_400) throw new Error("release_transparency_witness_policy_sla_invalid");
  if (request.operatorId.length < 3 || request.operatorId.length > 160 || request.reason.length < 12 || request.reason.length > 500) throw new Error("release_transparency_witness_policy_operator_evidence_invalid");
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(request.approvalNonce) || !isSha(request.approvalSignature)) throw new Error("release_transparency_witness_policy_approval_invalid");
  const nowSeconds = Math.trunc(now.getTime() / 1000);
  if (!Number.isInteger(request.approvalTimestamp) || Math.abs(nowSeconds - request.approvalTimestamp) > 300) throw new Error("release_transparency_witness_policy_approval_expired");
  const secret = clean(env.VELMERE_RELEASE_WITNESS_HEALTH_SECRET);
  if (!usableSecret(secret)) throw new Error("release_transparency_witness_health_secret_missing_or_weak");
  const { approvalSignature: _approvalSignature, ...unsigned } = request;
  const expected = signReleaseTransparencyWitnessPolicy(unsigned, secret);
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(request.approvalSignature, "hex");
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("release_transparency_witness_policy_signature_mismatch");
  const policyDigest = sha(canonicalPolicyPayload(unsigned));
  const { data } = await rpc({
    operation: "release_transparency_witness_health_policy_apply",
    args: {
      p_idempotency_key: sha(`${policyDigest}:${request.approvalNonce}`),
      p_policy_digest: policyDigest,
      p_environment: request.environment,
      p_audience_hash: sha(request.audience),
      p_revoked_witness_fingerprints: request.revokedWitnessFingerprints,
      p_max_degraded_seconds: request.maxDegradedSeconds,
      p_operator_hash: sha(request.operatorId),
      p_reason_hash: sha(request.reason),
      p_approval_digest: sha(request.approvalSignature),
    },
  });
  return {
    schemaVersion: "velmere.release-transparency-witness-health-policy.v1" as const,
    ok: true,
    policyDigest,
    data,
    privacyBoundary: "Only policy hashes and revoked witness fingerprints are persisted; operator identity, reason and approval signature are hashed.",
  };
}

export function evaluateReleaseTransparencyWitnessHealth(
  input: ReleaseTransparencyWitnessHealthInput,
): ReleaseTransparencyWitnessHealthEvaluation {
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  const maxDegradedSeconds = Math.max(
    60,
    Math.min(86_400, Number(input.maxDegradedSeconds ?? 900)),
  );
  const threshold = Math.max(2, Math.trunc(input.signatureThreshold || 0));
  const revoked = new Set(
    (input.revokedFingerprints ?? [])
      .map((value) => clean(value).toLowerCase())
      .filter(isSha),
  );

  if (!input.activeDeployment) {
    const payload = {
      state: "no_active_deployment" as const,
      validOrganizationCount: 0,
      signatureThreshold: threshold,
      blockers: [] as string[],
    };
    return {
      schemaVersion: "velmere.release-transparency-witness-health-evaluation.v1",
      ...payload,
      releaseSuspended: false,
      rollbackRequired: false,
      revokedWitnessCount: 0,
      expiredWitnessCount: 0,
      healthDigest: sha(stable(payload)),
      privacyBoundary:
        "Only aggregate witness health, hashes and blocker codes are returned; deployment IDs, signatures and public keys are omitted.",
    };
  }

  const blockers: string[] = [];
  const organizationSet = new Set<string>();
  let revokedWitnessCount = 0;
  let expiredWitnessCount = 0;

  for (const witness of input.witnessOrganizations ?? []) {
    const fingerprint = clean(witness.publicKeyFingerprint).toLowerCase();
    const organizationHash = clean(witness.organizationHash).toLowerCase();
    const revokedNow = isSha(fingerprint) && revoked.has(fingerprint);
    const expiredNow =
      witness.validUntil != null &&
      Number.isFinite(witness.validUntil) &&
      Number(witness.validUntil) <= now;
    if (revokedNow) revokedWitnessCount += 1;
    if (expiredNow) expiredWitnessCount += 1;
    if (!revokedNow && !expiredNow && isSha(organizationHash)) {
      organizationSet.add(organizationHash);
    }
  }

  if (!isSha(clean(input.quorumDigest).toLowerCase()))
    blockers.push("witness_quorum_digest_missing");
  if (clean(input.quorumState) !== "consumed")
    blockers.push("witness_quorum_not_consumed");
  if (!isSha(clean(input.checkpointDigest).toLowerCase()))
    blockers.push("witness_checkpoint_digest_missing");
  if (input.splitViewDetected) blockers.push("witness_split_view_detected");
  if (revokedWitnessCount > 0) blockers.push("witness_key_revoked");
  if (expiredWitnessCount > 0) blockers.push("witness_key_expired");
  if (organizationSet.size < threshold)
    blockers.push("witness_organization_threshold_lost");

  const degradedSeconds = input.degradedSince
    ? Math.max(0, Math.floor((now - Number(input.degradedSince)) / 1000))
    : 0;
  const rollbackRequired =
    blockers.includes("witness_split_view_detected") ||
    (blockers.length > 0 && degradedSeconds >= maxDegradedSeconds);
  const state: ReleaseTransparencyWitnessHealthState = rollbackRequired
    ? "rollback_required"
    : blockers.length > 0
      ? "suspended"
      : "healthy";
  const payload = {
    state,
    quorumDigest: isSha(clean(input.quorumDigest).toLowerCase())
      ? clean(input.quorumDigest).toLowerCase()
      : null,
    checkpointDigest: isSha(clean(input.checkpointDigest).toLowerCase())
      ? clean(input.checkpointDigest).toLowerCase()
      : null,
    validOrganizationCount: organizationSet.size,
    signatureThreshold: threshold,
    revokedWitnessCount,
    expiredWitnessCount,
    blockers: [...new Set(blockers)].sort(),
    rollbackRequired,
  };
  return {
    schemaVersion: "velmere.release-transparency-witness-health-evaluation.v1",
    state,
    releaseSuspended: state !== "healthy",
    rollbackRequired,
    validOrganizationCount: organizationSet.size,
    signatureThreshold: threshold,
    revokedWitnessCount,
    expiredWitnessCount,
    blockers: payload.blockers,
    healthDigest: sha(stable(payload)),
    privacyBoundary:
      "Only aggregate witness health, hashes and blocker codes are returned; deployment IDs, signatures and public keys are omitted.",
  };
}

export async function reconcileReleaseTransparencyWitnessHealth(input: {
  environment?: "staging" | "production";
  audience?: string;
  maxDegradedSeconds?: number;
  dependencies?: { rpc: RpcRunner };
} = {}) {
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const environment = input.environment ??
    ((process.env.VELMERE_DEPLOYMENT_ENVIRONMENT ?? process.env.VERCEL_ENV ?? "staging") as
      | "staging"
      | "production");
  const audience = clean(
    input.audience ?? process.env.VELMERE_RELEASE_BUNDLE_AUDIENCE,
  );
  if (!(["staging", "production"] as const).includes(environment)) {
    throw new Error("release_transparency_witness_health_environment_invalid");
  }
  if (audience.length < 8 || audience.length > 160) {
    throw new Error("release_transparency_witness_health_audience_invalid");
  }
  const maxDegradedSeconds = Math.max(
    60,
    Math.min(86_400, Number(input.maxDegradedSeconds ?? 900)),
  );
  const { data } = await rpc({
    operation: "release_transparency_witness_health_reconcile",
    args: {
      p_environment: environment,
      p_audience_hash: sha(audience),
      p_max_degraded_seconds: maxDegradedSeconds,
    },
  });
  const row = Array.isArray(data) ? data[0] : data;
  const value = (row ?? {}) as Record<string, unknown>;
  return {
    schemaVersion: "velmere.release-transparency-witness-health-reconcile.v1" as const,
    ok: ["healthy", "no_active_deployment"].includes(clean(value.state)),
    state: clean(value.state) || "unavailable",
    releaseSuspended: Boolean(value.release_suspended),
    rollbackRequired: Boolean(value.rollback_required),
    validOrganizationCount: Number(value.valid_organization_count ?? 0),
    signatureThreshold: Number(value.signature_threshold ?? 0),
    healthDigest: isSha(clean(value.health_digest))
      ? clean(value.health_digest)
      : null,
    blockers: Array.isArray(value.blockers)
      ? value.blockers.map(clean).filter(Boolean)
      : [],
    privacyBoundary:
      "Aggregate deployment witness health only; deployment IDs, witness signatures, public keys, operator data and raw ledger rows are omitted.",
  };
}

export async function verifyReleaseTransparencyWitnessHealth(input: {
  healthDigest: string;
  dependencies?: { rpc: RpcRunner };
}) {
  const healthDigest = clean(input.healthDigest).toLowerCase();
  if (!isSha(healthDigest))
    throw new Error("release_transparency_witness_health_digest_invalid");
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const { data } = await rpc({
    operation: "release_transparency_witness_health_verify",
    args: { p_health_digest: healthDigest },
  });
  return {
    schemaVersion: "velmere.release-transparency-witness-health-verification.v1" as const,
    ok: true,
    healthDigest,
    data,
    privacyBoundary: "Verification returns hashes and aggregate state only.",
  };
}

export async function getReleaseTransparencyWitnessHealthStatus(input: {
  environment?: "staging" | "production";
  dependencies?: { rpc: RpcRunner };
} = {}) {
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const { data } = await rpc({
    operation: "release_transparency_witness_health_status",
    args: { p_environment: input.environment ?? null },
  });
  return data;
}

export async function getPublicReleaseTransparencyWitnessHealth(input: {
  environment?: "staging" | "production";
  limit?: number;
  dependencies?: { rpc: RpcRunner };
} = {}) {
  const rpc = input.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
  const limit = Math.max(1, Math.min(50, Number(input.limit ?? 10)));
  const { data } = await rpc({
    operation: "release_transparency_witness_health_public_feed",
    args: { p_environment: input.environment ?? null, p_limit: limit },
  });
  const rows = Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row))
    : [];
  const health = rows.map((row) => ({
    environment: clean(row.environment),
    state: clean(row.state),
    releaseSuspended: Boolean(row.release_suspended),
    rollbackRequired: Boolean(row.rollback_required),
    healthDigest: clean(row.health_digest),
    quorumDigest: clean(row.quorum_digest),
    checkpointDigest: clean(row.checkpoint_digest),
    validOrganizationCount: Number(row.valid_organization_count ?? 0),
    signatureThreshold: Number(row.signature_threshold ?? 0),
    observedAt: row.last_observed_at ?? null,
  }));
  return {
    schemaVersion: "velmere.public-release-transparency-witness-health.v1" as const,
    ok: true,
    health,
    feedDigest: sha(stable(health)),
    privacyBoundary:
      "Public feed contains hashes, counts and suspension state only; no deployment IDs, signatures, public keys or operator data.",
  };
}
