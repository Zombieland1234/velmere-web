import { randomUUID } from "node:crypto";
import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runBoundedServiceRoleRpc } from "@/lib/db/bounded-supabase-rpc";
import { markDurableManualFulfilmentRequired } from "@/lib/orders/durable-order-state";
import {
  syncFulfilmentProviderOrderState,
  type FulfilmentProviderSyncResult,
} from "@/lib/orders/fulfilment-provider-status-sync";

export type FulfilmentProviderSyncQueueItem = {
  syncId: string;
  orderDraftId: string;
  externalId: string;
  expectedProviderOrderId?: string;
  previousStatus?: string;
  pendingSince?: string;
  staleAfterHours: number;
  refundExpected: boolean;
  attemptCount: number;
  leaseToken: string;
};

export type FulfilmentProviderSyncWorkerSummary = {
  schemaVersion: "velmere.fulfilment-provider-sync-worker.v1";
  runId: string;
  durable: true;
  leaseAcquired: boolean;
  claimedCount: number;
  completedCount: number;
  rescheduledCount: number;
  retryableFailedCount: number;
  deadLetteredCount: number;
  releasedByDeadlineCount: number;
  severity: "none" | "warning" | "critical";
  privacyBoundary: "aggregate_counts_only";
};

type FailureResult = { status: "retryable_failed" | "dead_letter" };

type ClaimResult = { leaseAcquired: boolean; items: FulfilmentProviderSyncQueueItem[] };

export type FulfilmentProviderSyncWorkerDependencies = {
  hasDurableStorage: () => boolean;
  claimBatch: (input: {
    runId: string;
    leaseToken: string;
    limit: number;
    workerLeaseSeconds: number;
    staleAfterSeconds: number;
    retryThreshold: number;
  }) => Promise<ClaimResult>;
  reschedule: (input: {
    syncId: string;
    leaseToken: string;
    result: FulfilmentProviderSyncResult;
    delaySeconds: number;
  }) => Promise<void>;
  complete: (input: {
    syncId: string;
    leaseToken: string;
    result: FulfilmentProviderSyncResult;
  }) => Promise<void>;
  fail: (input: {
    syncId: string;
    leaseToken: string;
    errorCode: string;
    retryThreshold: number;
    retryAfterSeconds: number;
  }) => Promise<FailureResult>;
  deadLetter: (input: { syncId: string; leaseToken: string; errorCode: string }) => Promise<void>;
  release: (input: { syncId: string; leaseToken: string; reasonCode: string }) => Promise<void>;
  finishRun: (input: {
    runId: string;
    leaseToken: string;
    summary: Omit<FulfilmentProviderSyncWorkerSummary, "schemaVersion" | "runId" | "durable" | "privacyBoundary">;
  }) => Promise<void>;
  sync: typeof syncFulfilmentProviderOrderState;
  markManualReview: (orderDraftId: string) => Promise<{ durableWrite: boolean }>;
  now: () => number;
  randomId: () => string;
};

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function safeCode(error: unknown) {
  return (error instanceof Error ? error.message : "fulfilment_provider_sync_worker_failed")
    .replace(/[^a-zA-Z0-9:_-]/g, "_")
    .slice(0, 120);
}

function normalizeClaimRows(data: unknown, leaseToken: string): ClaimResult {
  const rows = Array.isArray(data) ? data : [];
  const leaseAcquired = rows.some((row) => Boolean(row && typeof row === "object" && (row as Record<string, unknown>).lease_acquired === true));
  const items = rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .filter((row) => typeof row.sync_id === "string" && typeof row.order_draft_id === "string")
    .map((row) => ({
      syncId: String(row.sync_id).slice(0, 120),
      orderDraftId: String(row.order_draft_id).slice(0, 160),
      externalId: String(row.external_id ?? row.order_draft_id).slice(0, 160),
      expectedProviderOrderId: typeof row.expected_provider_order_id === "string" ? row.expected_provider_order_id.slice(0, 40) : undefined,
      previousStatus: typeof row.previous_status === "string" ? row.previous_status.slice(0, 40) : undefined,
      pendingSince: typeof row.pending_since === "string" ? row.pending_since : undefined,
      staleAfterHours: boundedInteger(row.stale_after_hours, 48, 1, 336),
      refundExpected: row.refund_expected === true,
      attemptCount: boundedInteger(row.attempt_count, 0, 0, 1000),
      leaseToken,
    }));
  return { leaseAcquired, items };
}

async function defaultClaimBatch(input: {
  runId: string;
  leaseToken: string;
  limit: number;
  workerLeaseSeconds: number;
  staleAfterSeconds: number;
  retryThreshold: number;
}) {
  const { data } = await runBoundedServiceRoleRpc({
    operation: "fulfilment_sync_claim",
    rpcName: "velmere_claim_fulfilment_provider_sync_worker",
    args: {
      p_run_id: input.runId,
      p_lease_token: input.leaseToken,
      p_limit: input.limit,
      p_worker_lease_seconds: input.workerLeaseSeconds,
      p_stale_after_seconds: input.staleAfterSeconds,
      p_retry_threshold: input.retryThreshold,
    },
    deadlineMs: 5_000,
  });
  return normalizeClaimRows(data, input.leaseToken);
}

async function defaultReschedule(input: {
  syncId: string;
  leaseToken: string;
  result: FulfilmentProviderSyncResult;
  delaySeconds: number;
}) {
  const { data } = await runBoundedServiceRoleRpc({
    operation: "fulfilment_sync_reschedule",
    rpcName: "velmere_reschedule_fulfilment_provider_sync",
    args: {
      p_sync_id: input.syncId,
      p_lease_token: input.leaseToken,
      p_provider_status: input.result.providerStatus,
      p_result_state: input.result.state,
      p_action: input.result.action,
      p_delay_seconds: input.delaySeconds,
    },
  });
  if (data !== "rescheduled") throw new Error("fulfilment_provider_sync_worker_reschedule_failed");
}

async function defaultComplete(input: {
  syncId: string;
  leaseToken: string;
  result: FulfilmentProviderSyncResult;
}) {
  const { data } = await runBoundedServiceRoleRpc({
    operation: "fulfilment_sync_complete",
    rpcName: "velmere_complete_fulfilment_provider_sync",
    args: {
      p_sync_id: input.syncId,
      p_lease_token: input.leaseToken,
      p_provider_status: input.result.providerStatus,
      p_result_state: input.result.state,
      p_action: input.result.action,
    },
  });
  if (data !== "completed") throw new Error("fulfilment_provider_sync_worker_complete_failed");
}

async function defaultFail(input: {
  syncId: string;
  leaseToken: string;
  errorCode: string;
  retryThreshold: number;
  retryAfterSeconds: number;
}): Promise<FailureResult> {
  const { data } = await runBoundedServiceRoleRpc({
    operation: "fulfilment_sync_fail",
    rpcName: "velmere_fail_fulfilment_provider_sync",
    args: {
      p_sync_id: input.syncId,
      p_lease_token: input.leaseToken,
      p_error_code: input.errorCode,
      p_retry_threshold: input.retryThreshold,
      p_retry_after_seconds: input.retryAfterSeconds,
    },
  });
  if (data !== "retryable_failed" && data !== "dead_letter") {
    throw new Error("fulfilment_provider_sync_worker_fail_write_failed");
  }
  return { status: data };
}

async function defaultDeadLetter(input: { syncId: string; leaseToken: string; errorCode: string }) {
  const { data } = await runBoundedServiceRoleRpc({
    operation: "fulfilment_sync_dead_letter",
    rpcName: "velmere_dead_letter_fulfilment_provider_sync",
    args: {
      p_sync_id: input.syncId,
      p_lease_token: input.leaseToken,
      p_error_code: input.errorCode,
    },
  });
  if (data !== "dead_letter") throw new Error("fulfilment_provider_sync_worker_dead_letter_failed");
}

async function defaultRelease(input: { syncId: string; leaseToken: string; reasonCode: string }) {
  const { data } = await runBoundedServiceRoleRpc({
    operation: "fulfilment_sync_release",
    rpcName: "velmere_release_fulfilment_provider_sync",
    args: {
      p_sync_id: input.syncId,
      p_lease_token: input.leaseToken,
      p_reason_code: input.reasonCode,
    },
  });
  if (data !== "released") throw new Error("fulfilment_provider_sync_worker_release_failed");
}

async function defaultFinishRun(input: {
  runId: string;
  leaseToken: string;
  summary: Omit<FulfilmentProviderSyncWorkerSummary, "schemaVersion" | "runId" | "durable" | "privacyBoundary">;
}) {
  const { data } = await runBoundedServiceRoleRpc({
    operation: "fulfilment_sync_finish_run",
    rpcName: "velmere_finish_fulfilment_provider_sync_worker",
    args: {
      p_run_id: input.runId,
      p_lease_token: input.leaseToken,
      p_summary: input.summary,
    },
  });
  if (data !== "finished") throw new Error("fulfilment_provider_sync_worker_run_receipt_failed");
}

function delayForStatus(status: FulfilmentProviderSyncResult["providerStatus"]) {
  if (status === "draft" || status === "pending") return 15 * 60;
  if (status === "onhold") return 60 * 60;
  if (status === "inprocess" || status === "partial") return 30 * 60;
  return 15 * 60;
}

export const fulfilmentProviderSyncWorkerDependencies: FulfilmentProviderSyncWorkerDependencies = {
  hasDurableStorage: hasSupabaseServiceRoleConfig,
  claimBatch: defaultClaimBatch,
  reschedule: defaultReschedule,
  complete: defaultComplete,
  fail: defaultFail,
  deadLetter: defaultDeadLetter,
  release: defaultRelease,
  finishRun: defaultFinishRun,
  sync: syncFulfilmentProviderOrderState,
  markManualReview: (orderDraftId) => markDurableManualFulfilmentRequired(orderDraftId),
  now: Date.now,
  randomId: randomUUID,
};

export async function runFulfilmentProviderSyncWorker(
  input: {
    limit?: number;
    deadlineMs?: number;
    workerLeaseSeconds?: number;
    staleAfterSeconds?: number;
    retryThreshold?: number;
    retryAfterSeconds?: number;
  } = {},
  dependencies: FulfilmentProviderSyncWorkerDependencies = fulfilmentProviderSyncWorkerDependencies,
): Promise<FulfilmentProviderSyncWorkerSummary> {
  if (!dependencies.hasDurableStorage()) {
    throw new Error("fulfilment_provider_sync_worker_storage_unavailable");
  }
  const runId = `fulfilment_sync_run_${dependencies.randomId().replace(/-/g, "").slice(0, 24)}`;
  const leaseToken = `fulfilment_sync_lease_${dependencies.randomId().replace(/-/g, "").slice(0, 24)}`;
  const limit = boundedInteger(input.limit, 25, 1, 100);
  const deadlineMs = boundedInteger(input.deadlineMs, 10_000, 1_000, 20_000);
  const workerLeaseSeconds = boundedInteger(input.workerLeaseSeconds, 60, 30, 300);
  const staleAfterSeconds = boundedInteger(input.staleAfterSeconds, 300, 60, 86_400);
  const retryThreshold = boundedInteger(input.retryThreshold, 6, 2, 20);
  const retryAfterSeconds = boundedInteger(input.retryAfterSeconds, 300, 5, 86_400);
  const startedAt = dependencies.now();
  const claimed = await dependencies.claimBatch({
    runId,
    leaseToken,
    limit,
    workerLeaseSeconds,
    staleAfterSeconds,
    retryThreshold,
  });
  const counts = {
    leaseAcquired: claimed.leaseAcquired,
    claimedCount: claimed.items.length,
    completedCount: 0,
    rescheduledCount: 0,
    retryableFailedCount: 0,
    deadLetteredCount: 0,
    releasedByDeadlineCount: 0,
    severity: "none" as "none" | "warning" | "critical",
  };

  if (claimed.leaseAcquired) {
    for (let index = 0; index < claimed.items.length; index += 1) {
      const item = claimed.items[index];
      if (dependencies.now() - startedAt >= deadlineMs) {
        for (const remaining of claimed.items.slice(index)) {
          await dependencies.release({
            syncId: remaining.syncId,
            leaseToken: remaining.leaseToken,
            reasonCode: "worker_deadline_released",
          });
          counts.releasedByDeadlineCount += 1;
        }
        counts.severity = counts.severity === "critical" ? "critical" : "warning";
        break;
      }
      try {
        const result = await dependencies.sync({
          orderDraftId: item.orderDraftId,
          externalId: item.externalId,
          expectedProviderOrderId: item.expectedProviderOrderId,
          previousStatus: item.previousStatus,
          pendingSince: item.pendingSince,
          staleAfterHours: item.staleAfterHours,
          refundExpected: item.refundExpected,
        });

        if (result.state === "conflict") {
          const escalated = await dependencies.markManualReview(item.orderDraftId);
          if (!escalated.durableWrite) throw new Error("fulfilment_provider_sync_conflict_escalation_not_durable");
          await dependencies.deadLetter({
            syncId: item.syncId,
            leaseToken: item.leaseToken,
            errorCode: "provider_order_identity_conflict",
          });
          counts.deadLetteredCount += 1;
          counts.severity = "critical";
          continue;
        }

        if (result.state === "not_found") {
          const failed = await dependencies.fail({
            syncId: item.syncId,
            leaseToken: item.leaseToken,
            errorCode: "provider_order_not_found",
            retryThreshold,
            retryAfterSeconds,
          });
          if (failed.status === "dead_letter") {
            counts.deadLetteredCount += 1;
            counts.severity = "critical";
          } else {
            counts.retryableFailedCount += 1;
            if (counts.severity === "none") counts.severity = "warning";
          }
          continue;
        }

        if (result.state === "escalated" || result.action === "order_fulfilled" || result.action === "refund_recorded") {
          await dependencies.complete({ syncId: item.syncId, leaseToken: item.leaseToken, result });
          counts.completedCount += 1;
          if (result.state === "escalated" && counts.severity === "none") counts.severity = "warning";
          continue;
        }

        await dependencies.reschedule({
          syncId: item.syncId,
          leaseToken: item.leaseToken,
          result,
          delaySeconds: delayForStatus(result.providerStatus),
        });
        counts.rescheduledCount += 1;
      } catch (error) {
        const failed = await dependencies.fail({
          syncId: item.syncId,
          leaseToken: item.leaseToken,
          errorCode: safeCode(error),
          retryThreshold,
          retryAfterSeconds,
        });
        if (failed.status === "dead_letter") {
          counts.deadLetteredCount += 1;
          counts.severity = "critical";
        } else {
          counts.retryableFailedCount += 1;
          if (counts.severity === "none") counts.severity = "warning";
        }
      }
    }
  }

  await dependencies.finishRun({ runId, leaseToken, summary: counts });
  return {
    schemaVersion: "velmere.fulfilment-provider-sync-worker.v1",
    runId,
    durable: true,
    ...counts,
    privacyBoundary: "aggregate_counts_only",
  };
}
