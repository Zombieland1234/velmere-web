import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import { getDurablePayloadKeyringReadiness } from "@/lib/jobs/durable-computation-payload";

export const DURABLE_COMPUTATION_OPERATIONS_ID = "velmere-durable-computation-operations-v1" as const;

export type DurableComputationOperationalKind = "vlm_analysis" | "lens_pdf_render" | "audit_pdf_render";
export type DurableComputationOperationalSeverity = "none" | "warning" | "critical";

export const DURABLE_COMPUTATION_OPERATION_REGISTRY = {
  vlm_analysis: {
    workerCapable: true,
    executionMode: "worker_recovery",
    payloadPersistence: "sealed_payload",
    reason: "A privacy-reviewed AES-256-GCM payload enables bounded retry recovery when the production keyring is configured.",
  },
  lens_pdf_render: {
    workerCapable: true,
    executionMode: "worker_recovery",
    payloadPersistence: "sealed_payload",
    reason: "A privacy-reviewed AES-256-GCM payload contains the validated report input without account, entitlement, cookie or authorization data.",
  },
  audit_pdf_render: {
    workerCapable: true,
    executionMode: "worker_recovery",
    payloadPersistence: "sealed_payload",
    reason: "A bounded AES-256-GCM payload contains only the validated public audit render input and excludes account, entitlement, token, cookie and authorization data.",
  },
} as const satisfies Record<DurableComputationOperationalKind, {
  workerCapable: boolean;
  executionMode: "request_bound" | "worker_recovery";
  payloadPersistence: "hash_only" | "sealed_payload" | "reference";
  reason: string;
}>;

export type DurableComputationMetrics = {
  processing: number;
  retryWait: number;
  deadLetter: number;
  completedRetained: number;
  readyForRetry: number;
  expiredLeases: number;
  oldestReadyAgeSeconds: number;
  oldestLeaseAgeSeconds: number;
  byKind: Record<DurableComputationOperationalKind, {
    processing: number;
    retryWait: number;
    deadLetter: number;
    completedRetained: number;
  }>;
};

export type DurableComputationAlert = {
  code: "dead_letter_nonzero" | "retry_backlog" | "expired_lease" | "old_ready_job" | "old_processing_lease";
  severity: Exclude<DurableComputationOperationalSeverity, "none">;
  value: number;
  threshold: number;
};

export type DurableComputationMaintenanceSummary = {
  schemaVersion: "velmere.durable-computation-maintenance.v1";
  runId: string;
  leaseAcquired: boolean;
  cleanedCompletedCount: number;
  cleanedDeadLetterCount: number;
  alertCount: number;
  severity: DurableComputationOperationalSeverity;
  before: DurableComputationMetrics;
  after: DurableComputationMetrics;
  workerExecutableKinds: number;
  requestBoundKinds: number;
  privacyBoundary: string;
};

type RpcRow = Record<string, unknown>;

type Dependencies = {
  claimMaintenance: (args: { runId: string; leaseToken: string; leaseSeconds: number }) => Promise<boolean>;
  snapshot: () => Promise<DurableComputationMetrics>;
  cleanup: (args: {
    runId: string;
    leaseToken: string;
    completedRetentionDays: number;
    deadLetterRetentionDays: number;
    limit: number;
  }) => Promise<{ cleanedCompletedCount: number; cleanedDeadLetterCount: number }>;
  recordAlert: (args: { runId: string; leaseToken: string; alert: DurableComputationAlert }) => Promise<void>;
  finishMaintenance: (args: {
    runId: string;
    leaseToken: string;
    summary: Omit<DurableComputationMaintenanceSummary, "schemaVersion" | "privacyBoundary">;
  }) => Promise<void>;
  requeueDeadLetter: (args: {
    jobId: string;
    operatorHash: string;
    reasonHash: string;
  }) => Promise<"requeued" | "not_found" | "not_dead_letter" | "store_failed">;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function parseRpcRow(data: unknown): RpcRow | null {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object" ? first as RpcRow : null;
  }
  return data && typeof data === "object" ? data as RpcRow : null;
}

function emptyKindMetrics() {
  return { processing: 0, retryWait: 0, deadLetter: 0, completedRetained: 0 };
}

const METRIC_KEYS = Object.freeze([
  "processing",
  "retry_wait",
  "dead_letter",
  "completed_retained",
  "ready_for_retry",
  "expired_leases",
  "oldest_ready_age_seconds",
  "oldest_lease_age_seconds",
  "by_kind",
] as const);
const KIND_METRIC_KEYS = Object.freeze([
  "processing",
  "retry_wait",
  "dead_letter",
  "completed_retained",
] as const);
const NORMALIZED_METRIC_KEYS = Object.freeze([
  "processing",
  "retryWait",
  "deadLetter",
  "completedRetained",
  "readyForRetry",
  "expiredLeases",
  "oldestReadyAgeSeconds",
  "oldestLeaseAgeSeconds",
  "byKind",
] as const);
const NORMALIZED_KIND_KEYS = Object.freeze([
  "processing",
  "retryWait",
  "deadLetter",
  "completedRetained",
] as const);
const OPERATIONAL_KINDS = Object.freeze([
  "vlm_analysis",
  "lens_pdf_render",
  "audit_pdf_render",
] as const satisfies readonly DurableComputationOperationalKind[]);

function telemetryError(reason: string): never {
  throw new Error(`durable_computation_telemetry_schema_invalid:${reason}`);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], reason: string) {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...expected].sort();
  if (
    actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])
  ) telemetryError(reason);
}

function telemetryInteger(value: unknown, reason: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    telemetryError(reason);
  }
  return value;
}

function exactRpcTelemetryRow(data: unknown) {
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length !== 1) telemetryError("row_count");
  const candidate = rows[0];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    telemetryError("row_shape");
  }
  const row = candidate as RpcRow;
  exactKeys(row, METRIC_KEYS, "field_set");
  return row;
}

function assertMetricRelations(metrics: DurableComputationMetrics) {
  const sum = (field: keyof DurableComputationMetrics["byKind"][DurableComputationOperationalKind]) => (
    OPERATIONAL_KINDS.reduce((total, kind) => total + metrics.byKind[kind][field], 0)
  );
  if (sum("processing") !== metrics.processing) telemetryError("processing_kind_total");
  if (sum("retryWait") !== metrics.retryWait) telemetryError("retry_kind_total");
  if (sum("deadLetter") !== metrics.deadLetter) telemetryError("dead_letter_kind_total");
  if (sum("completedRetained") !== metrics.completedRetained) telemetryError("completed_kind_total");
  if (metrics.readyForRetry > metrics.retryWait) telemetryError("ready_retry_total");
  if (metrics.expiredLeases > metrics.processing) telemetryError("expired_processing_total");
  if (metrics.readyForRetry === 0 && metrics.oldestReadyAgeSeconds !== 0) telemetryError("ready_age_without_jobs");
  if (metrics.expiredLeases === 0 && metrics.oldestLeaseAgeSeconds !== 0) telemetryError("lease_age_without_jobs");
  return metrics;
}

export function validateDurableComputationMetricsTelemetry(
  metrics: DurableComputationMetrics,
): DurableComputationMetrics {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) telemetryError("normalized_shape");
  const row = metrics as unknown as Record<string, unknown>;
  exactKeys(row, NORMALIZED_METRIC_KEYS, "normalized_field_set");
  const byKindValue = row.byKind;
  if (!byKindValue || typeof byKindValue !== "object" || Array.isArray(byKindValue)) {
    telemetryError("normalized_by_kind_shape");
  }
  const rawByKind = byKindValue as Record<string, unknown>;
  exactKeys(rawByKind, OPERATIONAL_KINDS, "normalized_by_kind_set");
  const byKind = Object.fromEntries(OPERATIONAL_KINDS.map((kind) => {
    const value = rawByKind[kind];
    if (!value || typeof value !== "object" || Array.isArray(value)) telemetryError(`normalized_kind_shape:${kind}`);
    const kindRow = value as Record<string, unknown>;
    exactKeys(kindRow, NORMALIZED_KIND_KEYS, `normalized_kind_field_set:${kind}`);
    return [kind, {
      processing: telemetryInteger(kindRow.processing, `normalized_integer:${kind}:processing`),
      retryWait: telemetryInteger(kindRow.retryWait, `normalized_integer:${kind}:retry_wait`),
      deadLetter: telemetryInteger(kindRow.deadLetter, `normalized_integer:${kind}:dead_letter`),
      completedRetained: telemetryInteger(kindRow.completedRetained, `normalized_integer:${kind}:completed_retained`),
    }];
  })) as DurableComputationMetrics["byKind"];
  return assertMetricRelations({
    processing: telemetryInteger(row.processing, "normalized_integer:processing"),
    retryWait: telemetryInteger(row.retryWait, "normalized_integer:retry_wait"),
    deadLetter: telemetryInteger(row.deadLetter, "normalized_integer:dead_letter"),
    completedRetained: telemetryInteger(row.completedRetained, "normalized_integer:completed_retained"),
    readyForRetry: telemetryInteger(row.readyForRetry, "normalized_integer:ready_for_retry"),
    expiredLeases: telemetryInteger(row.expiredLeases, "normalized_integer:expired_leases"),
    oldestReadyAgeSeconds: telemetryInteger(row.oldestReadyAgeSeconds, "normalized_integer:oldest_ready_age_seconds"),
    oldestLeaseAgeSeconds: telemetryInteger(row.oldestLeaseAgeSeconds, "normalized_integer:oldest_lease_age_seconds"),
    byKind,
  });
}

export function decodeDurableComputationMetricsTelemetry(data: unknown): DurableComputationMetrics {
  const row = exactRpcTelemetryRow(data);
  const byKind = {
    vlm_analysis: emptyKindMetrics(),
    lens_pdf_render: emptyKindMetrics(),
    audit_pdf_render: emptyKindMetrics(),
  } satisfies DurableComputationMetrics["byKind"];
  const rawKinds = row.by_kind;
  if (!rawKinds || typeof rawKinds !== "object" || Array.isArray(rawKinds)) telemetryError("by_kind_shape");
  const rawKindRows = rawKinds as Record<string, unknown>;
  if (Object.keys(rawKindRows).some((kind) => !OPERATIONAL_KINDS.includes(kind as DurableComputationOperationalKind))) {
    telemetryError("by_kind_unknown");
  }
  for (const kind of OPERATIONAL_KINDS) {
    const candidate = rawKindRows[kind];
    if (candidate === undefined) continue;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) telemetryError(`kind_shape:${kind}`);
    const values = candidate as Record<string, unknown>;
    exactKeys(values, KIND_METRIC_KEYS, `kind_field_set:${kind}`);
    byKind[kind] = {
      processing: telemetryInteger(values.processing, `integer:${kind}:processing`),
      retryWait: telemetryInteger(values.retry_wait, `integer:${kind}:retry_wait`),
      deadLetter: telemetryInteger(values.dead_letter, `integer:${kind}:dead_letter`),
      completedRetained: telemetryInteger(values.completed_retained, `integer:${kind}:completed_retained`),
    };
  }
  return assertMetricRelations({
    processing: telemetryInteger(row.processing, "integer:processing"),
    retryWait: telemetryInteger(row.retry_wait, "integer:retry_wait"),
    deadLetter: telemetryInteger(row.dead_letter, "integer:dead_letter"),
    completedRetained: telemetryInteger(row.completed_retained, "integer:completed_retained"),
    readyForRetry: telemetryInteger(row.ready_for_retry, "integer:ready_for_retry"),
    expiredLeases: telemetryInteger(row.expired_leases, "integer:expired_leases"),
    oldestReadyAgeSeconds: telemetryInteger(row.oldest_ready_age_seconds, "integer:oldest_ready_age_seconds"),
    oldestLeaseAgeSeconds: telemetryInteger(row.oldest_lease_age_seconds, "integer:oldest_lease_age_seconds"),
    byKind,
  });
}

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

function severityRank(value: DurableComputationOperationalSeverity) {
  return value === "critical" ? 2 : value === "warning" ? 1 : 0;
}

function highestSeverity(alerts: DurableComputationAlert[]): DurableComputationOperationalSeverity {
  return alerts.reduce<DurableComputationOperationalSeverity>((current, alert) => (
    severityRank(alert.severity) > severityRank(current) ? alert.severity : current
  ), "none");
}

export function evaluateDurableComputationAlerts(metrics: DurableComputationMetrics, thresholds?: {
  retryBacklogWarning?: number;
  deadLetterCritical?: number;
  expiredLeaseWarning?: number;
  oldestReadyWarningSeconds?: number;
  oldestLeaseCriticalSeconds?: number;
}) {
  const retryBacklogWarning = clampInteger(thresholds?.retryBacklogWarning, 25, 1, 100_000);
  const deadLetterCritical = clampInteger(thresholds?.deadLetterCritical, 1, 1, 100_000);
  const expiredLeaseWarning = clampInteger(thresholds?.expiredLeaseWarning, 1, 1, 100_000);
  const oldestReadyWarningSeconds = clampInteger(thresholds?.oldestReadyWarningSeconds, 300, 30, 86_400);
  const oldestLeaseCriticalSeconds = clampInteger(thresholds?.oldestLeaseCriticalSeconds, 900, 60, 86_400);
  const alerts: DurableComputationAlert[] = [];
  if (metrics.deadLetter >= deadLetterCritical) alerts.push({ code: "dead_letter_nonzero", severity: "critical", value: metrics.deadLetter, threshold: deadLetterCritical });
  if (metrics.retryWait >= retryBacklogWarning) alerts.push({ code: "retry_backlog", severity: "warning", value: metrics.retryWait, threshold: retryBacklogWarning });
  if (metrics.expiredLeases >= expiredLeaseWarning) alerts.push({ code: "expired_lease", severity: "warning", value: metrics.expiredLeases, threshold: expiredLeaseWarning });
  if (metrics.oldestReadyAgeSeconds >= oldestReadyWarningSeconds) alerts.push({ code: "old_ready_job", severity: "warning", value: metrics.oldestReadyAgeSeconds, threshold: oldestReadyWarningSeconds });
  if (metrics.oldestLeaseAgeSeconds >= oldestLeaseCriticalSeconds) alerts.push({ code: "old_processing_lease", severity: "critical", value: metrics.oldestLeaseAgeSeconds, threshold: oldestLeaseCriticalSeconds });
  return alerts;
}

async function defaultClaimMaintenance(args: { runId: string; leaseToken: string; leaseSeconds: number }) {
  const { data } = await runRegisteredServiceRoleRpc({
    operation: "durable_computation_maintenance_claim",
    args: { p_run_id: args.runId, p_lease_token: args.leaseToken, p_lease_seconds: args.leaseSeconds },
  });
  return String(parseRpcRow(data)?.state ?? data) === "claimed";
}

async function defaultSnapshot() {
  const { data } = await runRegisteredServiceRoleRpc({ operation: "durable_computation_metrics" });
  return decodeDurableComputationMetricsTelemetry(data);
}

async function defaultCleanup(args: {
  runId: string;
  leaseToken: string;
  completedRetentionDays: number;
  deadLetterRetentionDays: number;
  limit: number;
}) {
  const { data } = await runRegisteredServiceRoleRpc({
    operation: "durable_computation_cleanup",
    args: {
      p_run_id: args.runId,
      p_lease_token: args.leaseToken,
      p_completed_retention_days: args.completedRetentionDays,
      p_dead_letter_retention_days: args.deadLetterRetentionDays,
      p_limit: args.limit,
    },
  });
  const row = parseRpcRow(data);
  if (!row) throw new Error("durable_computation_cleanup_telemetry_schema_invalid:row_shape");
  exactKeys(row, ["cleaned_completed_count", "cleaned_dead_letter_count"], "cleanup_field_set");
  return {
    cleanedCompletedCount: telemetryInteger(row.cleaned_completed_count, "cleanup_integer:completed"),
    cleanedDeadLetterCount: telemetryInteger(row.cleaned_dead_letter_count, "cleanup_integer:dead_letter"),
  };
}

async function defaultRecordAlert(args: { runId: string; leaseToken: string; alert: DurableComputationAlert }) {
  await runRegisteredServiceRoleRpc({
    operation: "durable_computation_alert_record",
    args: {
      p_run_id: args.runId,
      p_lease_token: args.leaseToken,
      p_code: args.alert.code,
      p_severity: args.alert.severity,
      p_value: args.alert.value,
      p_threshold: args.alert.threshold,
    },
  });
}

async function defaultFinishMaintenance(args: {
  runId: string;
  leaseToken: string;
  summary: Omit<DurableComputationMaintenanceSummary, "schemaVersion" | "privacyBoundary">;
}) {
  await runRegisteredServiceRoleRpc({
    operation: "durable_computation_maintenance_finish",
    args: {
      p_run_id: args.runId,
      p_lease_token: args.leaseToken,
      p_summary: args.summary,
    },
  });
}

async function defaultRequeueDeadLetter(args: { jobId: string; operatorHash: string; reasonHash: string }) {
  try {
    const { data } = await runRegisteredServiceRoleRpc({
      operation: "durable_computation_dead_letter_requeue",
      args: {
        p_job_id: args.jobId,
        p_operator_hash: args.operatorHash,
        p_reason_hash: args.reasonHash,
      },
    });
    const state = String(parseRpcRow(data)?.state ?? data);
    return state === "requeued" || state === "not_found" || state === "not_dead_letter" ? state : "store_failed";
  } catch {
    return "store_failed";
  }
}

const defaultDependencies: Dependencies = {
  claimMaintenance: defaultClaimMaintenance,
  snapshot: defaultSnapshot,
  cleanup: defaultCleanup,
  recordAlert: defaultRecordAlert,
  finishMaintenance: defaultFinishMaintenance,
  requeueDeadLetter: defaultRequeueDeadLetter,
};

export function buildDurableComputationOperationsReadiness() {
  const registry = Object.values(DURABLE_COMPUTATION_OPERATION_REGISTRY);
  const keyring = getDurablePayloadKeyringReadiness();
  const workerExecutable = hasSupabaseServiceRoleConfig() && keyring.configured && keyring.valid;
  return {
    schemaVersion: "velmere.durable-computation-operations-readiness.v2" as const,
    durableStoreConfigured: hasSupabaseServiceRoleConfig(),
    cronSecretConfigured: Boolean(process.env.MARKET_INTEGRITY_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim()),
    payloadKeyring: keyring,
    registeredKinds: registry.length,
    workerCapableKinds: registry.filter((entry) => entry.workerCapable).length,
    workerExecutableKinds: workerExecutable ? registry.filter((entry) => entry.workerCapable).length : 0,
    requestBoundKinds: registry.filter((entry) => !entry.workerCapable).length,
    payloadPolicy: "all_three_kinds_sealed_payload",
    executionTruth: workerExecutable
      ? "VLM, Lens PDF and Audit PDF retry recovery are executable with bounded worker admission."
      : "All three worker kinds remain fail-closed until Supabase service-role configuration and a valid AES-256-GCM keyring are configured.",
  };
}

export async function getDurableComputationOperationalSnapshot(dependencies: Pick<Dependencies, "snapshot"> = defaultDependencies) {
  if (!hasSupabaseServiceRoleConfig() && dependencies === defaultDependencies) {
    throw new Error("durable_computation_store_required");
  }
  const metrics = validateDurableComputationMetricsTelemetry(await dependencies.snapshot());
  const alerts = evaluateDurableComputationAlerts(metrics);
  return {
    schemaVersion: "velmere.durable-computation-operational-snapshot.v1" as const,
    metrics,
    alerts,
    severity: highestSeverity(alerts),
    readiness: buildDurableComputationOperationsReadiness(),
    privacyBoundary: "Aggregate counts only; no job IDs, account IDs, subject hashes, inputs, results, lease tokens or error details are returned.",
  };
}

export async function runDurableComputationMaintenance(input: {
  completedRetentionDays?: number;
  deadLetterRetentionDays?: number;
  cleanupLimit?: number;
  leaseSeconds?: number;
  thresholds?: Parameters<typeof evaluateDurableComputationAlerts>[1];
  dependencies?: Dependencies;
}) {
  const dependencies = input.dependencies ?? defaultDependencies;
  if (!hasSupabaseServiceRoleConfig() && dependencies === defaultDependencies) {
    throw new Error("durable_computation_store_required");
  }
  const runId = randomUUID();
  const leaseToken = randomBytes(24).toString("base64url");
  const leaseSeconds = clampInteger(input.leaseSeconds, 60, 15, 300);
  const leaseAcquired = await dependencies.claimMaintenance({ runId, leaseToken, leaseSeconds });
  const before = validateDurableComputationMetricsTelemetry(await dependencies.snapshot());
  if (!leaseAcquired) {
    return {
      schemaVersion: "velmere.durable-computation-maintenance.v1",
      runId,
      leaseAcquired: false,
      cleanedCompletedCount: 0,
      cleanedDeadLetterCount: 0,
      alertCount: 0,
      severity: "none",
      before,
      after: before,
      workerExecutableKinds: 0,
      requestBoundKinds: Object.keys(DURABLE_COMPUTATION_OPERATION_REGISTRY).length,
      privacyBoundary: "Aggregate counts only; no job or customer identifiers are returned.",
    } satisfies DurableComputationMaintenanceSummary;
  }
  const cleanup = await dependencies.cleanup({
    runId,
    leaseToken,
    completedRetentionDays: clampInteger(input.completedRetentionDays, 30, 1, 365),
    deadLetterRetentionDays: clampInteger(input.deadLetterRetentionDays, 90, 7, 730),
    limit: clampInteger(input.cleanupLimit, 500, 1, 5_000),
  });
  const after = validateDurableComputationMetricsTelemetry(await dependencies.snapshot());
  const alerts = evaluateDurableComputationAlerts(after, input.thresholds);
  for (const alert of alerts) await dependencies.recordAlert({ runId, leaseToken, alert });
  const registry = Object.values(DURABLE_COMPUTATION_OPERATION_REGISTRY);
  const core = {
    runId,
    leaseAcquired: true,
    cleanedCompletedCount: cleanup.cleanedCompletedCount,
    cleanedDeadLetterCount: cleanup.cleanedDeadLetterCount,
    alertCount: alerts.length,
    severity: highestSeverity(alerts),
    before,
    after,
    workerExecutableKinds: buildDurableComputationOperationsReadiness().workerExecutableKinds,
    requestBoundKinds: registry.filter((entry) => !entry.workerCapable).length,
  };
  await dependencies.finishMaintenance({ runId, leaseToken, summary: core });
  return {
    schemaVersion: "velmere.durable-computation-maintenance.v1",
    ...core,
    privacyBoundary: "Aggregate counts only; no job IDs, subject hashes, inputs, results, lease tokens or operator identifiers are returned.",
  } satisfies DurableComputationMaintenanceSummary;
}

async function mapBounded<T, R>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return output;
}

export async function requeueDurableComputationDeadLetters(input: {
  jobIds: string[];
  operatorId: string;
  reason: string;
  concurrency?: number;
  dependencies?: Pick<Dependencies, "requeueDeadLetter">;
}) {
  const dependencies = input.dependencies ?? defaultDependencies;
  if (!hasSupabaseServiceRoleConfig() && dependencies === defaultDependencies) {
    throw new Error("durable_computation_store_required");
  }
  const uniqueJobIds = [...new Set(input.jobIds.map((value) => value.trim()).filter((value) => /^dcj_[0-9a-f]{48}$/.test(value)))].slice(0, 50);
  if (uniqueJobIds.length === 0) throw new Error("durable_computation_requeue_jobs_required");
  const operatorId = input.operatorId.trim();
  const reason = input.reason.trim();
  if (operatorId.length < 3 || operatorId.length > 120) throw new Error("durable_computation_operator_invalid");
  if (reason.length < 8 || reason.length > 500) throw new Error("durable_computation_requeue_reason_invalid");
  const operatorHash = sha256(`velmere:durable-operator:${operatorId}`);
  const reasonHash = sha256(`velmere:durable-requeue-reason:${reason}`);
  const results = await mapBounded(uniqueJobIds, clampInteger(input.concurrency, 4, 1, 8), (jobId) => (
    dependencies.requeueDeadLetter({ jobId, operatorHash, reasonHash })
  ));
  const counts = { requeued: 0, notFound: 0, notDeadLetter: 0, storeFailed: 0 };
  for (const state of results) {
    if (state === "requeued") counts.requeued += 1;
    else if (state === "not_found") counts.notFound += 1;
    else if (state === "not_dead_letter") counts.notDeadLetter += 1;
    else counts.storeFailed += 1;
  }
  return {
    schemaVersion: "velmere.durable-computation-dead-letter-requeue.v1" as const,
    requestedCount: uniqueJobIds.length,
    ...counts,
    retryable: counts.storeFailed > 0,
    operatorHash,
    reasonHash,
    privacyBoundary: "Only aggregate outcomes and irreversible operator/reason hashes are returned; job IDs and customer data are omitted.",
  };
}
