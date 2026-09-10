import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  runRegisteredServiceRoleRpc,
  type SupabaseRpcOperation,
} from "@/lib/db/supabase-rpc-operation-registry";
import {
  getProviderObservationPromotionQuality,
  type ProviderObservationPromotionQuality,
} from "@/lib/market-integrity/provider-observation-quarantine";

type RpcRunner = (input: {
  operation: SupabaseRpcOperation;
  args?: Record<string, unknown>;
}) => Promise<{ data: unknown }>;

type Dependencies = {
  rpc: RpcRunner;
  now: () => Date;
  providerQuality: typeof getProviderObservationPromotionQuality;
};

const defaultDependencies: Dependencies = {
  rpc: runRegisteredServiceRoleRpc,
  now: () => new Date(),
  providerQuality: getProviderObservationPromotionQuality,
};

type EnvLike = Record<string, string | undefined>;
export type ProviderQualityIncidentAction = "acknowledge" | "start_recovery" | "resolve";
export type ProviderQualityIncidentSeverity = "none" | "warning" | "critical";

export type ProviderQualityIncidentPolicy = {
  warningAfterSeconds: number;
  criticalAfterSeconds: number;
  rollbackAfterSeconds: number;
  recoveryStableSeconds: number;
  maxIncidentAgeSeconds: number;
};

export type ProviderQualityIncidentSummary = {
  state: "healthy" | "open" | "acknowledged" | "recovery_pending" | "resolved" | "store_failed";
  severity: ProviderQualityIncidentSeverity;
  releaseHold: boolean;
  rollbackRequired: boolean;
  rollbackTriggerRecorded: boolean;
  activeDeploymentPresent: boolean;
  incidentAgeSeconds: number;
  qualityStableAgeSeconds: number;
  openedIncidents: number;
  resolvedIncidents: number;
  qualityDigest: string;
  incidentDigest: string;
  blockers: string[];
  warnings: string[];
  privacyBoundary: string;
};

export type ProviderQualityIncidentApprovalRequest = {
  action: ProviderQualityIncidentAction;
  operatorId: string;
  reason: string;
  approvalTimestamp: number;
  approvalNonce: string;
  approvalSignature: string;
  expectedIncidentDigest: string;
  expectedQualityDigest: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function bool(value: unknown) {
  return value === true || value === "true";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function digest(value: unknown) {
  return sha256(JSON.stringify(value));
}

function row(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    return data.find((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")) ?? null;
  }
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}

function clamp(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

function usableSecret(value: string) {
  return value.length >= 32 && !/(example|placeholder|changeme|dummy|replace[-_ ]?me|never[-_ ]?production)/i.test(value);
}

function isSha(value: string) {
  return /^[0-9a-f]{64}$/.test(value);
}

function severityForQuality(quality: ProviderObservationPromotionQuality): ProviderQualityIncidentSeverity {
  const criticalCodes = new Set([
    "provider_anomaly_budget_exceeded",
    "provider_retention_violation",
    "provider_quarantine_not_empty",
    "provider_revalidation_pending",
    "provider_stale_asset_budget_exceeded",
  ]);
  if (quality.blockers.some((code) => criticalCodes.has(code))) return "critical";
  if (!quality.ready || quality.warnings.length > 0) return "warning";
  return "none";
}

function normalizePolicy(input: Partial<ProviderQualityIncidentPolicy> = {}): ProviderQualityIncidentPolicy {
  const warningAfterSeconds = clamp(input.warningAfterSeconds, 300, 60, 86_400);
  const criticalAfterSeconds = Math.max(
    warningAfterSeconds,
    clamp(input.criticalAfterSeconds, 900, 120, 172_800),
  );
  const rollbackAfterSeconds = Math.max(
    criticalAfterSeconds,
    clamp(input.rollbackAfterSeconds, 1_800, 300, 604_800),
  );
  const recoveryStableSeconds = clamp(input.recoveryStableSeconds, 900, 120, 86_400);
  const maxIncidentAgeSeconds = Math.max(
    rollbackAfterSeconds,
    clamp(input.maxIncidentAgeSeconds, 86_400, 3_600, 2_592_000),
  );
  return {
    warningAfterSeconds,
    criticalAfterSeconds,
    rollbackAfterSeconds,
    recoveryStableSeconds,
    maxIncidentAgeSeconds,
  };
}

function normalizeState(value: unknown): ProviderQualityIncidentSummary["state"] {
  const state = clean(value);
  return ["healthy", "open", "acknowledged", "recovery_pending", "resolved"].includes(state)
    ? state as ProviderQualityIncidentSummary["state"]
    : "store_failed";
}

function canonicalApprovalPayload(input: Omit<ProviderQualityIncidentApprovalRequest, "approvalSignature">) {
  return JSON.stringify({
    action: input.action,
    operatorHash: sha256(input.operatorId),
    reasonHash: sha256(input.reason),
    approvalTimestamp: input.approvalTimestamp,
    approvalNonce: input.approvalNonce,
    expectedIncidentDigest: input.expectedIncidentDigest,
    expectedQualityDigest: input.expectedQualityDigest,
  });
}

export function signProviderQualityIncidentApproval(
  input: Omit<ProviderQualityIncidentApprovalRequest, "approvalSignature">,
  secret: string,
) {
  if (!usableSecret(secret)) throw new Error("provider_incident_secret_missing_or_weak");
  return createHmac("sha256", secret).update(canonicalApprovalPayload(input)).digest("hex");
}

function normalizeApproval(input: ProviderQualityIncidentApprovalRequest): ProviderQualityIncidentApprovalRequest {
  const action = ["acknowledge", "start_recovery", "resolve"].includes(input.action)
    ? input.action
    : null;
  if (!action) throw new Error("provider_incident_action_invalid");
  const normalized = {
    ...input,
    action,
    operatorId: clean(input.operatorId),
    reason: clean(input.reason),
    approvalNonce: clean(input.approvalNonce),
    approvalSignature: clean(input.approvalSignature).toLowerCase(),
    expectedIncidentDigest: clean(input.expectedIncidentDigest).toLowerCase(),
    expectedQualityDigest: clean(input.expectedQualityDigest).toLowerCase(),
  } satisfies ProviderQualityIncidentApprovalRequest;
  if (normalized.operatorId.length < 3 || normalized.operatorId.length > 160) throw new Error("provider_incident_operator_invalid");
  if (normalized.reason.length < 12 || normalized.reason.length > 500) throw new Error("provider_incident_reason_invalid");
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(normalized.approvalNonce)) throw new Error("provider_incident_nonce_invalid");
  if (!isSha(normalized.approvalSignature)) throw new Error("provider_incident_signature_invalid");
  if (!isSha(normalized.expectedIncidentDigest) || !isSha(normalized.expectedQualityDigest)) throw new Error("provider_incident_digest_invalid");
  return normalized;
}

function verifyApproval(request: ProviderQualityIncidentApprovalRequest, env: EnvLike, now: Date) {
  const secret = clean(env.VELMERE_PROVIDER_INCIDENT_SECRET);
  if (!usableSecret(secret)) throw new Error("provider_incident_secret_missing_or_weak");
  const nowSeconds = Math.trunc(now.getTime() / 1000);
  if (!Number.isInteger(request.approvalTimestamp) || Math.abs(nowSeconds - request.approvalTimestamp) > 300) {
    throw new Error("provider_incident_approval_expired_or_future");
  }
  const { approvalSignature: _signature, ...unsigned } = request;
  const expected = signProviderQualityIncidentApproval(unsigned, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(request.approvalSignature, "hex");
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new Error("provider_incident_signature_mismatch");
  }
}

function buildSummary(input: {
  value: Record<string, unknown>;
  quality: ProviderObservationPromotionQuality;
  policy: ProviderQualityIncidentPolicy;
  alertState?: string;
}): ProviderQualityIncidentSummary {
  const state = normalizeState(input.value.state);
  const severityRaw = clean(input.value.severity);
  const severity: ProviderQualityIncidentSeverity = severityRaw === "critical"
    ? "critical"
    : severityRaw === "warning"
      ? "warning"
      : "none";
  const releaseHold = bool(input.value.release_hold);
  const rollbackRequired = bool(input.value.rollback_required);
  const incidentAgeSeconds = count(input.value.incident_age_seconds);
  const qualityStableAgeSeconds = count(input.value.quality_stable_age_seconds);
  const activeDeploymentPresent = bool(input.value.active_deployment_present);
  const openedIncidents = count(input.value.opened_incidents);
  const resolvedIncidents = count(input.value.resolved_incidents);
  const blockers = [
    ...(releaseHold ? ["provider_quality_release_hold"] : []),
    ...(rollbackRequired ? ["provider_quality_rollback_required"] : []),
    ...(incidentAgeSeconds > input.policy.maxIncidentAgeSeconds ? ["provider_quality_incident_sla_breached"] : []),
    ...(state === "store_failed" ? ["provider_quality_incident_store_failed"] : []),
  ];
  const warnings = [
    ...(state === "acknowledged" ? ["provider_quality_incident_acknowledged_not_resolved"] : []),
    ...(state === "recovery_pending" ? ["provider_quality_recovery_observation_pending"] : []),
    ...(input.alertState && !["recorded", "deduplicated", "not_required"].includes(input.alertState)
      ? ["provider_quality_rollback_alert_store_failed"]
      : []),
  ];
  const incidentDigest = clean(input.value.incident_digest).toLowerCase();
  return {
    state,
    severity,
    releaseHold,
    rollbackRequired,
    rollbackTriggerRecorded: ["recorded", "deduplicated"].includes(input.alertState ?? ""),
    activeDeploymentPresent,
    incidentAgeSeconds,
    qualityStableAgeSeconds,
    openedIncidents,
    resolvedIncidents,
    qualityDigest: input.quality.qualityDigest,
    incidentDigest: isSha(incidentDigest)
      ? incidentDigest
      : digest({ state, severity, releaseHold, rollbackRequired, incidentAgeSeconds, qualityDigest: input.quality.qualityDigest }),
    blockers,
    warnings,
    privacyBoundary: "Aggregate incident state, durations, policy outcomes and SHA-256 digests only. Asset identifiers, deployment IDs, operator identity, reasons, prices, provider payloads and alert IDs are never returned.",
  };
}

export async function runProviderQualityIncidentCycle(input: {
  policy?: Partial<ProviderQualityIncidentPolicy>;
  dependencies?: Partial<Dependencies>;
} = {}): Promise<ProviderQualityIncidentSummary> {
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  const policy = normalizePolicy(input.policy);
  const quality = await dependencies.providerQuality();
  const requestedSeverity = severityForQuality(quality);
  const { data } = await dependencies.rpc({
    operation: "provider_quality_incident_reconcile",
    args: {
      p_quality_digest: quality.qualityDigest,
      p_quality_ready: quality.ready,
      p_requested_severity: requestedSeverity,
      p_warning_after_seconds: policy.warningAfterSeconds,
      p_critical_after_seconds: policy.criticalAfterSeconds,
      p_rollback_after_seconds: policy.rollbackAfterSeconds,
      p_recovery_stable_seconds: policy.recoveryStableSeconds,
    },
  });
  const value = row(data);
  if (!value) throw new Error("provider_quality_incident_reconcile_empty");
  let alertState = "not_required";
  if (bool(value.rollback_required)) {
    const alert = await dependencies.rpc({
      operation: "provider_observation_alert_record",
      args: {
        p_code: "provider_quality_auto_rollback_required",
        p_severity: "critical",
        p_value: count(value.incident_age_seconds),
        p_threshold: policy.rollbackAfterSeconds,
      },
    });
    alertState = clean(row(alert.data)?.state) || "store_failed";
  }
  return buildSummary({ value, quality, policy, alertState });
}

export async function getProviderQualityIncidentGate(input: {
  expectedQualityDigest?: string;
  dependencies?: Partial<Dependencies>;
} = {}) {
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  const quality = await dependencies.providerQuality();
  if (input.expectedQualityDigest && input.expectedQualityDigest !== quality.qualityDigest) {
    throw new Error("provider_incident_quality_digest_mismatch");
  }
  const { data } = await dependencies.rpc({ operation: "provider_quality_incident_snapshot" });
  const value = row(data);
  if (!value) throw new Error("provider_quality_incident_snapshot_empty");
  const policy = normalizePolicy();
  const summary = buildSummary({ value, quality, policy, alertState: "not_required" });
  return {
    schemaVersion: "velmere.provider-quality-promotion-incident-gate.v1" as const,
    ready: quality.ready && !summary.releaseHold && !summary.rollbackRequired && ["healthy", "resolved"].includes(summary.state),
    qualityReady: quality.ready,
    qualityStableAgeSeconds: summary.qualityStableAgeSeconds,
    qualityDigest: quality.qualityDigest,
    incidentDigest: summary.incidentDigest,
    state: summary.state,
    releaseHold: summary.releaseHold,
    rollbackRequired: summary.rollbackRequired,
    blockers: [...quality.blockers, ...summary.blockers],
    warnings: [...quality.warnings, ...summary.warnings],
    privacyBoundary: summary.privacyBoundary,
  };
}

export async function applyProviderQualityIncidentAction(input: {
  request: ProviderQualityIncidentApprovalRequest;
  env?: EnvLike;
  dependencies?: Partial<Dependencies>;
}) {
  const env = input.env ?? process.env;
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  const request = normalizeApproval(input.request);
  verifyApproval(request, env, dependencies.now());
  const gate = await getProviderQualityIncidentGate({ dependencies });
  if (request.expectedIncidentDigest !== gate.incidentDigest) throw new Error("provider_incident_digest_mismatch");
  if (request.expectedQualityDigest !== gate.qualityDigest) throw new Error("provider_incident_quality_digest_mismatch");
  if (request.action === "resolve" && (!gate.qualityReady || gate.state !== "recovery_pending" || gate.qualityStableAgeSeconds < 900)) {
    throw new Error("provider_incident_resolution_not_ready");
  }
  const approvalDigest = digest(canonicalApprovalPayload({
    action: request.action,
    operatorId: request.operatorId,
    reason: request.reason,
    approvalTimestamp: request.approvalTimestamp,
    approvalNonce: request.approvalNonce,
    expectedIncidentDigest: request.expectedIncidentDigest,
    expectedQualityDigest: request.expectedQualityDigest,
  }));
  const { data } = await dependencies.rpc({
    operation: "provider_quality_incident_action",
    args: {
      p_action: request.action,
      p_expected_incident_digest: request.expectedIncidentDigest,
      p_expected_quality_digest: request.expectedQualityDigest,
      p_operator_hash: sha256(request.operatorId),
      p_reason_hash: sha256(request.reason),
      p_approval_digest: approvalDigest,
      p_quality_ready: gate.ready,
    },
  });
  const value = row(data);
  if (!value) throw new Error("provider_quality_incident_action_empty");
  const state = normalizeState(value.state);
  return {
    schemaVersion: "velmere.provider-quality-incident-action.v1" as const,
    ok: state !== "store_failed",
    action: request.action,
    state,
    releaseHold: bool(value.release_hold),
    rollbackRequired: bool(value.rollback_required),
    approvalDigest,
    incidentDigest: clean(value.incident_digest).toLowerCase(),
    privacyBoundary: "Only aggregate state and request digests are returned. Operator identity, reason, signature, asset identifiers, deployment IDs and database row IDs are omitted.",
  };
}
