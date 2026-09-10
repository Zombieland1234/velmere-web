import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";

type Dependencies = { rpc: typeof runRegisteredServiceRoleRpc };
const defaultDependencies: Dependencies = { rpc: runRegisteredServiceRoleRpc };

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function firstRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return data.find((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")) ?? null;
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}

export async function reconcileDurableComputationAlertOutbox(input: {
  retryAgeWarningSeconds?: number;
  dependencies?: Dependencies;
} = {}) {
  const dependencies = input.dependencies ?? defaultDependencies;
  const retryAgeWarningSeconds = Math.max(60, Math.min(86_400, Math.trunc(Number(input.retryAgeWarningSeconds ?? 900))));
  const { data } = await dependencies.rpc({ operation: "durable_computation_alert_reconcile", args: {} });
  const row = firstRow(data);
  if (!row) throw new Error("alert_reconciliation_empty");
  const metrics = {
    pending: count(row.pending_count),
    processing: count(row.processing_count),
    retryWait: count(row.retry_wait_count),
    delivered: count(row.delivered_count),
    deadLetter: count(row.dead_letter_count),
    expiredProcessing: count(row.expired_processing_count),
    oldestRetryAgeSeconds: count(row.oldest_retry_age_seconds),
    distinctDestinationHashes: count(row.distinct_destination_hashes),
    deliveredWithoutDestinationHash: count(row.delivered_without_destination_hash),
  };
  const blockers = [
    ...(metrics.expiredProcessing > 0 ? ["expired_alert_delivery_leases"] : []),
    ...(metrics.deliveredWithoutDestinationHash > 0 ? ["delivered_alert_missing_destination_hash"] : []),
    ...(metrics.distinctDestinationHashes > 1 ? ["multiple_alert_destinations_observed"] : []),
    ...(metrics.oldestRetryAgeSeconds >= retryAgeWarningSeconds ? ["alert_retry_backlog_old"] : []),
  ];
  return {
    schemaVersion: "velmere.durable-computation-alert-reconciliation.v1" as const,
    ok: blockers.length === 0,
    severity: blockers.some((code) => code.includes("expired") || code.includes("missing")) ? "critical" : blockers.length ? "warning" : "none",
    metrics,
    blockers,
    retryAgeWarningSeconds,
    privacyBoundary: "Aggregate alert delivery counts only. Alert IDs, destinations, payloads, response bodies and lease tokens are never returned.",
  };
}
