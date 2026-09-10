import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  runRegisteredServiceRoleRpc,
  type SupabaseRpcOperation,
} from "@/lib/db/supabase-rpc-operation-registry";

type EnvLike = Record<string, string | undefined>;
type RpcRunner = (input: {
  operation: SupabaseRpcOperation;
  args?: Record<string, unknown>;
}) => Promise<{ data: unknown }>;

type Dependencies = {
  rpc: RpcRunner;
  now: () => Date;
  nonce: () => string;
};

const defaultDependencies: Dependencies = {
  rpc: runRegisteredServiceRoleRpc,
  now: () => new Date(),
  nonce: () => randomBytes(24).toString("base64url"),
};

export type ProviderQualityAutoRollbackStatus = {
  schemaVersion: "velmere.provider-quality-auto-rollback-status.v1";
  state: "idle" | "required" | "applied" | "verified" | "blocked" | "store_failed";
  enabled: boolean;
  releaseHold: boolean;
  rollbackRequired: boolean;
  executionVerified: boolean;
  promotionReentryReady: boolean;
  incidentDigest: string | null;
  qualityDigest: string | null;
  executionDigest: string | null;
  blockers: string[];
  privacyBoundary: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function bool(value: unknown) {
  return value === true || value === "true";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isSha(value: string) {
  return /^[0-9a-f]{64}$/.test(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function usableSecret(value: string) {
  return value.length >= 32 && !/(example|placeholder|changeme|dummy|replace[-_ ]?me|never[-_ ]?production)/i.test(value);
}

function row(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    return data.find((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")) ?? null;
  }
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}

function canonicalAuthorization(input: {
  incidentDigest: string;
  qualityDigest: string;
  targetDeploymentId: string;
  deploymentFingerprint: string;
  exactCheckpoint: number;
  approvalTimestamp: number;
  approvalNonce: string;
}) {
  return JSON.stringify({
    incidentDigest: input.incidentDigest,
    qualityDigest: input.qualityDigest,
    targetDeploymentId: input.targetDeploymentId,
    deploymentFingerprint: input.deploymentFingerprint,
    exactCheckpoint: input.exactCheckpoint,
    approvalTimestamp: input.approvalTimestamp,
    approvalNonce: input.approvalNonce,
  });
}

export function signProviderQualityAutoRollbackAuthorization(input: {
  incidentDigest: string;
  qualityDigest: string;
  targetDeploymentId: string;
  deploymentFingerprint: string;
  exactCheckpoint: number;
  approvalTimestamp: number;
  approvalNonce: string;
}, secret: string) {
  if (!usableSecret(secret)) throw new Error("provider_auto_rollback_secret_missing_or_weak");
  return createHmac("sha256", secret).update(canonicalAuthorization(input)).digest("hex");
}

function normalizeStatus(value: Record<string, unknown> | null, enabled: boolean): ProviderQualityAutoRollbackStatus {
  if (!value) {
    return {
      schemaVersion: "velmere.provider-quality-auto-rollback-status.v1",
      state: "store_failed",
      enabled,
      releaseHold: true,
      rollbackRequired: false,
      executionVerified: false,
      promotionReentryReady: false,
      incidentDigest: null,
      qualityDigest: null,
      executionDigest: null,
      blockers: ["provider_auto_rollback_status_store_failed"],
      privacyBoundary: "Aggregate state and SHA-256 digests only. Deployment IDs, operator data, secrets and raw database rows are omitted.",
    };
  }
  const rawState = clean(value.state);
  const state = ["idle", "required", "applied", "verified", "blocked"].includes(rawState)
    ? rawState as ProviderQualityAutoRollbackStatus["state"]
    : "store_failed";
  const incidentDigest = clean(value.incident_digest).toLowerCase();
  const qualityDigest = clean(value.quality_digest).toLowerCase();
  const executionDigest = clean(value.execution_digest).toLowerCase();
  const releaseHold = bool(value.release_hold);
  const rollbackRequired = bool(value.rollback_required);
  const executionVerified = state === "verified" || bool(value.execution_verified);
  const incidentResolved = clean(value.incident_state) === "resolved";
  const promotionReentryReady = executionVerified && incidentResolved && !releaseHold && !rollbackRequired;
  const blockers = [
    ...(!enabled && rollbackRequired ? ["provider_auto_rollback_disabled"] : []),
    ...(state === "blocked" ? ["provider_auto_rollback_context_blocked"] : []),
    ...(state === "applied" && !executionVerified ? ["provider_auto_rollback_verification_pending"] : []),
    ...(state === "store_failed" ? ["provider_auto_rollback_status_store_failed"] : []),
  ];
  return {
    schemaVersion: "velmere.provider-quality-auto-rollback-status.v1",
    state,
    enabled,
    releaseHold,
    rollbackRequired,
    executionVerified,
    promotionReentryReady,
    incidentDigest: isSha(incidentDigest) ? incidentDigest : null,
    qualityDigest: isSha(qualityDigest) ? qualityDigest : null,
    executionDigest: isSha(executionDigest) ? executionDigest : null,
    blockers,
    privacyBoundary: "Aggregate state and SHA-256 digests only. Deployment IDs, operator data, secrets and raw database rows are omitted.",
  };
}

export async function getProviderQualityAutoRollbackStatus(input: {
  env?: EnvLike;
  dependencies?: Partial<Dependencies>;
} = {}): Promise<ProviderQualityAutoRollbackStatus> {
  const env = input.env ?? process.env;
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  const enabled = clean(env.VELMERE_PROVIDER_AUTO_ROLLBACK_ENABLED).toLowerCase() === "true";
  const { data } = await dependencies.rpc({ operation: "provider_quality_auto_rollback_status" });
  return normalizeStatus(row(data), enabled);
}

export async function runProviderQualityAutoRollback(input: {
  env?: EnvLike;
  dependencies?: Partial<Dependencies>;
} = {}) {
  const env = input.env ?? process.env;
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  const enabled = clean(env.VELMERE_PROVIDER_AUTO_ROLLBACK_ENABLED).toLowerCase() === "true";
  const secret = clean(env.VELMERE_PROVIDER_AUTO_ROLLBACK_SECRET);
  if (!enabled) {
    const status = await getProviderQualityAutoRollbackStatus({ env, dependencies });
    return { ...status, ok: !status.rollbackRequired, action: "disabled" as const };
  }
  if (!usableSecret(secret)) throw new Error("provider_auto_rollback_secret_missing_or_weak");

  const { data: contextData } = await dependencies.rpc({ operation: "provider_quality_auto_rollback_context" });
  const context = row(contextData);
  if (!context) throw new Error("provider_auto_rollback_context_empty");
  const contextState = clean(context.state);
  if (contextState === "not_required") {
    const status = await getProviderQualityAutoRollbackStatus({ env, dependencies });
    return { ...status, ok: true, action: "not_required" as const };
  }
  if (contextState !== "ready") throw new Error("provider_auto_rollback_context_blocked");

  const incidentDigest = clean(context.incident_digest).toLowerCase();
  const qualityDigest = clean(context.quality_digest).toLowerCase();
  const targetDeploymentId = clean(context.target_deployment_id).toLowerCase();
  const deploymentFingerprint = clean(context.deployment_fingerprint).toLowerCase();
  const exactCheckpoint = Number(context.exact_checkpoint);
  if (!isSha(incidentDigest) || !isSha(qualityDigest) || !isSha(deploymentFingerprint)) throw new Error("provider_auto_rollback_context_digest_invalid");
  if (!isUuid(targetDeploymentId)) throw new Error("provider_auto_rollback_target_invalid");
  if (!Number.isInteger(exactCheckpoint) || exactCheckpoint < 4725) throw new Error("provider_auto_rollback_checkpoint_invalid");

  const approvalTimestamp = Math.trunc(dependencies.now().getTime() / 1000);
  const approvalNonce = dependencies.nonce();
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(approvalNonce)) throw new Error("provider_auto_rollback_nonce_invalid");
  const unsigned = {
    incidentDigest,
    qualityDigest,
    targetDeploymentId,
    deploymentFingerprint,
    exactCheckpoint,
    approvalTimestamp,
    approvalNonce,
  };
  const signature = signProviderQualityAutoRollbackAuthorization(unsigned, secret);
  const expected = signProviderQualityAutoRollbackAuthorization(unsigned, secret);
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error("provider_auto_rollback_signature_internal_mismatch");
  }
  const authorizationDigest = sha256(canonicalAuthorization(unsigned));
  const signatureDigest = sha256(signature);
  const idempotencyKey = sha256(`provider-quality-auto-rollback|${incidentDigest}|${targetDeploymentId}`);

  const { data: executionData } = await dependencies.rpc({
    operation: "provider_quality_auto_rollback_execute",
    args: {
      p_idempotency_key: idempotencyKey,
      p_expected_incident_digest: incidentDigest,
      p_expected_quality_digest: qualityDigest,
      p_target_deployment_id: targetDeploymentId,
      p_authorization_digest: authorizationDigest,
      p_signature_digest: signatureDigest,
    },
  });
  const execution = row(executionData);
  const executionId = clean(execution?.execution_id).toLowerCase();
  const executionState = clean(execution?.state);
  if (!isUuid(executionId) || !["applied", "verified"].includes(executionState)) {
    throw new Error("provider_auto_rollback_execution_failed");
  }

  const { data: verificationData } = await dependencies.rpc({
    operation: "provider_quality_auto_rollback_verify",
    args: {
      p_execution_id: executionId,
      p_expected_incident_digest: incidentDigest,
      p_expected_quality_digest: qualityDigest,
    },
  });
  const verification = row(verificationData);
  const verificationState = clean(verification?.state);
  const verificationDigest = clean(verification?.verification_digest).toLowerCase();
  if (verificationState !== "verified" || !isSha(verificationDigest)) {
    throw new Error("provider_auto_rollback_verification_failed");
  }

  return {
    schemaVersion: "velmere.provider-quality-auto-rollback-result.v1" as const,
    ok: true,
    action: "executed" as const,
    state: "verified" as const,
    idempotent: bool(execution?.idempotent),
    executionIdHash: sha256(executionId),
    targetDeploymentIdHash: sha256(targetDeploymentId),
    incidentDigest,
    qualityDigest,
    authorizationDigest,
    verificationDigest,
    exactCheckpoint,
    promotionReentryReady: false,
    privacyBoundary: "Only SHA-256 digests, hashed identifiers and aggregate state are returned. Raw deployment IDs, signatures, nonces, secrets, operator identity and database rows are omitted.",
  };
}

export async function getProviderQualityRollbackRecoveryGate(input: {
  env?: EnvLike;
  dependencies?: Partial<Dependencies>;
} = {}) {
  const status = await getProviderQualityAutoRollbackStatus(input);
  const noRollbackHistory = status.state === "idle" && !status.rollbackRequired;
  return {
    schemaVersion: "velmere.provider-quality-rollback-recovery-gate.v1" as const,
    ready: noRollbackHistory || status.promotionReentryReady,
    status: status.state,
    executionVerified: status.executionVerified,
    promotionReentryReady: status.promotionReentryReady,
    incidentDigest: status.incidentDigest,
    executionDigest: status.executionDigest,
    blockers: noRollbackHistory ? [] : status.promotionReentryReady ? [] : [
      ...status.blockers,
      "provider_auto_rollback_recovery_not_complete",
    ],
    privacyBoundary: status.privacyBoundary,
  };
}
