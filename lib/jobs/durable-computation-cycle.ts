import { randomUUID } from "node:crypto";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import {
  getDurableComputationOperationalSnapshot,
  runDurableComputationMaintenance,
  type DurableComputationMetrics,
  type DurableComputationOperationalSeverity,
} from "@/lib/jobs/durable-computation-operations";
import {
  buildDurableComputationWorkerReadiness,
  runDurableComputationWorkerDrain,
} from "@/lib/jobs/durable-computation-worker";
import {
  buildDurableComputationDeploymentContract,
  getDurableComputationRuntimePolicy,
} from "@/lib/jobs/durable-computation-deployment";

export const DURABLE_COMPUTATION_CYCLE_ID = "velmere-durable-computation-cycle-v1" as const;

type WorkerDrainSummary = Awaited<ReturnType<typeof runDurableComputationWorkerDrain>>;
type MaintenanceSummary = Awaited<ReturnType<typeof runDurableComputationMaintenance>>;
type SnapshotSummary = Awaited<ReturnType<typeof getDurableComputationOperationalSnapshot>>;

type CycleDependencies = {
  snapshot: () => Promise<SnapshotSummary>;
  drain: typeof runDurableComputationWorkerDrain;
  maintenance: typeof runDurableComputationMaintenance;
  recordCycle: (summary: DurableComputationCycleSummary) => Promise<boolean>;
};

export type DurableComputationCycleSummary = {
  schemaVersion: "velmere.durable-computation-cycle.v1";
  cycleId: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  severity: DurableComputationOperationalSeverity;
  drainSkipped: boolean;
  drainSkipReason: "none" | "worker_not_configured" | "lease_circuit_open";
  drain: WorkerDrainSummary | null;
  maintenance: MaintenanceSummary;
  metricsBefore: DurableComputationMetrics;
  deploymentFingerprint: string;
  receiptPersisted: boolean;
  privacyBoundary: string;
};

function shouldOpenLeaseCircuit(metrics: DurableComputationMetrics, policy: ReturnType<typeof getDurableComputationRuntimePolicy>) {
  return metrics.expiredLeases >= policy.circuitExpiredLeaseCount
    || metrics.oldestLeaseAgeSeconds >= policy.circuitOldestLeaseAgeSeconds;
}

function aggregateSeverity(snapshot: SnapshotSummary, maintenance: MaintenanceSummary): DurableComputationOperationalSeverity {
  if (snapshot.severity === "critical" || maintenance.severity === "critical") return "critical";
  if (snapshot.severity === "warning" || maintenance.severity === "warning") return "warning";
  return "none";
}

async function defaultRecordCycle(summary: DurableComputationCycleSummary) {
  const drain = summary.drain;
  const { data } = await runRegisteredServiceRoleRpc({
    operation: "durable_computation_cycle_receipt_record",
    args: {
      p_cycle_id: summary.cycleId,
      p_started_at: summary.startedAt,
      p_finished_at: summary.finishedAt,
      p_ok: summary.ok,
      p_severity: summary.severity,
      p_drain_skipped: summary.drainSkipped,
      p_skip_reason: summary.drainSkipReason,
      p_claimed: drain?.claimed ?? 0,
      p_completed: drain?.completed ?? 0,
      p_retry_wait: drain?.retryWait ?? 0,
      p_dead_letter: drain?.deadLetter ?? 0,
      p_conflicts: drain?.conflicts ?? 0,
      p_lost_ownership: (drain?.lostBeforeExecution ?? 0) + (drain?.lostDuringExecution ?? 0),
      p_store_failed: drain?.storeFailed ?? 0,
      p_budget_rejected: drain?.budgetRejected ?? 0,
      p_cleaned_completed: summary.maintenance.cleanedCompletedCount,
      p_cleaned_dead_letter: summary.maintenance.cleanedDeadLetterCount,
      p_deployment_fingerprint: summary.deploymentFingerprint,
    },
  });
  const row = Array.isArray(data) ? data[0] : data;
  return Boolean(row && typeof row === "object" && String((row as Record<string, unknown>).state ?? "") === "recorded");
}

const defaultDependencies: CycleDependencies = {
  snapshot: getDurableComputationOperationalSnapshot,
  drain: runDurableComputationWorkerDrain,
  maintenance: runDurableComputationMaintenance,
  recordCycle: defaultRecordCycle,
};

export async function runDurableComputationOperationsCycle(input: {
  env?: Record<string, string | undefined>;
  workerId?: string;
  dependencies?: CycleDependencies;
}) {
  const env = input.env ?? process.env;
  const dependencies = input.dependencies ?? defaultDependencies;
  const startedAt = new Date().toISOString();
  const cycleId = randomUUID();
  const policy = getDurableComputationRuntimePolicy(env);
  const deployment = buildDurableComputationDeploymentContract(env);
  const workerReadiness = buildDurableComputationWorkerReadiness(env);
  const snapshot = await dependencies.snapshot();
  const leaseCircuitOpen = shouldOpenLeaseCircuit(snapshot.metrics, policy);
  let drain: WorkerDrainSummary | null = null;
  let drainSkipReason: DurableComputationCycleSummary["drainSkipReason"] = "none";

  if (!workerReadiness.executable) {
    drainSkipReason = "worker_not_configured";
  } else if (leaseCircuitOpen) {
    drainSkipReason = "lease_circuit_open";
  } else {
    drain = await dependencies.drain({
      env,
      workerId: input.workerId,
      limit: policy.limit,
      concurrency: policy.concurrency,
      leaseSeconds: policy.leaseSeconds,
      heartbeatIntervalMs: policy.heartbeatIntervalMs,
      perSubjectLimit: policy.perSubjectLimit,
      globalCostLimit: policy.globalCostLimit,
      perSubjectCostLimit: policy.perSubjectCostLimit,
      maxClaimedPayloadBytes: policy.maxClaimedPayloadBytes,
    });
  }

  const maintenance = await dependencies.maintenance({
    completedRetentionDays: policy.completedRetentionDays,
    deadLetterRetentionDays: policy.deadLetterRetentionDays,
    cleanupLimit: policy.cleanupLimit,
    leaseSeconds: policy.maintenanceLeaseSeconds,
  });
  const severity = aggregateSeverity(snapshot, maintenance);
  const drainFailed = Boolean(drain && (drain.storeFailed > 0 || drain.releaseFailures > 0 || drain.heartbeatFailures >= policy.circuitHeartbeatFailureCount));
  const ok = !drainFailed && maintenance.leaseAcquired && drainSkipReason !== "lease_circuit_open";
  const base: DurableComputationCycleSummary = {
    schemaVersion: "velmere.durable-computation-cycle.v1",
    cycleId,
    startedAt,
    finishedAt: new Date().toISOString(),
    ok,
    severity,
    drainSkipped: drainSkipReason !== "none",
    drainSkipReason,
    drain,
    maintenance,
    metricsBefore: snapshot.metrics,
    deploymentFingerprint: deployment.deploymentFingerprint,
    receiptPersisted: false,
    privacyBoundary: "Aggregate worker, maintenance and deployment-policy facts only. No job IDs, account IDs, subject hashes, inputs, prompts, PDF contents, tokens, lease secrets or error bodies are returned.",
  };
  let receiptPersisted: boolean;
  try {
    receiptPersisted = await dependencies.recordCycle(base);
  } catch {
    receiptPersisted = false;
  }
  return { ...base, receiptPersisted } satisfies DurableComputationCycleSummary;
}
