import { randomUUID } from "node:crypto";
import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import {
  markDurableManualFulfilmentRequired,
  markDurableOrderRefundPending,
  markDurableProviderDraftCreated,
} from "@/lib/orders/durable-order-state";
import type {
  FulfilmentIncidentResolution,
  FulfilmentIncidentResolutionEvidence,
} from "@/lib/orders/fulfilment-incident-resolution";

export type FulfilmentOutboxItem = {
  eventId: string;
  caseId: string;
  orderDraftId: string | null;
  resolution: FulfilmentIncidentResolution;
  evidence: FulfilmentIncidentResolutionEvidence;
  attemptCount: number;
  leaseToken: string;
};

export type FulfilmentOutboxDeliveryReceipt = {
  schemaVersion: "velmere.fulfilment-outbox-delivery.v1";
  resolution: FulfilmentIncidentResolution;
  action:
    | "provider_draft_state_applied"
    | "manual_fulfilment_state_applied"
    | "refund_pending_state_applied"
    | "false_positive_noop";
  durable: true;
};

export type FulfilmentOutboxWorkerSummary = {
  schemaVersion: "velmere.fulfilment-outbox-worker.v1";
  runId: string;
  leaseAcquired: boolean;
  claimedCount: number;
  deliveredCount: number;
  retryableFailedCount: number;
  deadLetteredCount: number;
  skippedByDeadlineCount: number;
  severity: "none" | "warning" | "critical";
  durable: true;
};

type ClaimBatchResult = {
  leaseAcquired: boolean;
  items: FulfilmentOutboxItem[];
};

type FailureResult = { status: "retryable_failed" | "dead_letter" };

export type FulfilmentOutboxWorkerDependencies = {
  hasDurableStorage: () => boolean;
  claimBatch: (input: {
    runId: string;
    leaseToken: string;
    limit: number;
    staleAfterSeconds: number;
    retryThreshold: number;
  }) => Promise<ClaimBatchResult>;
  complete: (input: {
    eventId: string;
    leaseToken: string;
    receipt: FulfilmentOutboxDeliveryReceipt;
  }) => Promise<void>;
  release: (input: { eventId: string; leaseToken: string; reasonCode: string }) => Promise<void>;
  fail: (input: {
    eventId: string;
    leaseToken: string;
    errorCode: string;
    retryThreshold: number;
    retryAfterSeconds: number;
  }) => Promise<FailureResult>;
  finishRun: (input: {
    runId: string;
    leaseToken: string;
    summary: Omit<FulfilmentOutboxWorkerSummary, "schemaVersion" | "runId" | "durable">;
  }) => Promise<void>;
  deliver: (item: FulfilmentOutboxItem) => Promise<FulfilmentOutboxDeliveryReceipt>;
  now: () => number;
  randomId: () => string;
};

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function safeErrorCode(error: unknown) {
  return (error instanceof Error ? error.message : "fulfilment_outbox_delivery_failed")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "_")
    .slice(0, 120);
}

function normalizeClaimRows(data: unknown, leaseToken: string): ClaimBatchResult {
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const first = rows[0] as Record<string, unknown> | undefined;
  const leaseAcquired = first?.worker_lease_acquired === true;
  const items = rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .filter((row) => typeof row.event_id === "string")
    .map((row) => ({
      eventId: String(row.event_id).slice(0, 120),
      caseId: String(row.case_id ?? "").slice(0, 120),
      orderDraftId: typeof row.order_draft_id === "string" ? row.order_draft_id.slice(0, 160) : null,
      resolution: String(row.resolution) as FulfilmentIncidentResolution,
      evidence:
        row.redacted_payload && typeof row.redacted_payload === "object"
          ? row.redacted_payload as FulfilmentIncidentResolutionEvidence
          : {},
      attemptCount: boundedInteger(row.attempt_count, 0, 0, 1000),
      leaseToken,
    }));
  return { leaseAcquired, items };
}

async function defaultClaimBatch(input: {
  runId: string;
  leaseToken: string;
  limit: number;
  staleAfterSeconds: number;
  retryThreshold: number;
}) {
  let data: unknown;
  try {
    ({ data } = await runRegisteredServiceRoleRpc({
      operation: "fulfilment_outbox_worker_claim",
      args: {
        p_run_id: input.runId,
        p_lease_token: input.leaseToken,
        p_limit: input.limit,
        p_stale_after_seconds: input.staleAfterSeconds,
        p_retry_threshold: input.retryThreshold,
      },
    }));
  } catch {
    throw new Error("fulfilment_outbox_claim_failed");
  }
  return normalizeClaimRows(data, input.leaseToken);
}

async function defaultComplete(input: {
  eventId: string;
  leaseToken: string;
  receipt: FulfilmentOutboxDeliveryReceipt;
}) {
  let data: unknown;
  try {
    ({ data } = await runRegisteredServiceRoleRpc({
      operation: "fulfilment_outbox_event_complete",
      args: {
        p_event_id: input.eventId,
        p_lease_token: input.leaseToken,
        p_delivery_receipt: input.receipt,
      },
    }));
  } catch {
    throw new Error("fulfilment_outbox_complete_failed");
  }
  if (data !== "delivered") throw new Error("fulfilment_outbox_complete_failed");
}


async function defaultRelease(input: { eventId: string; leaseToken: string; reasonCode: string }) {
  let data: unknown;
  try {
    ({ data } = await runRegisteredServiceRoleRpc({
      operation: "fulfilment_outbox_event_release",
      args: {
        p_event_id: input.eventId,
        p_lease_token: input.leaseToken,
        p_reason_code: input.reasonCode,
      },
    }));
  } catch {
    throw new Error("fulfilment_outbox_release_failed");
  }
  if (data !== "released") throw new Error("fulfilment_outbox_release_failed");
}

async function defaultFail(input: {
  eventId: string;
  leaseToken: string;
  errorCode: string;
  retryThreshold: number;
  retryAfterSeconds: number;
}): Promise<FailureResult> {
  let data: unknown;
  try {
    ({ data } = await runRegisteredServiceRoleRpc({
      operation: "fulfilment_outbox_event_fail",
      args: {
        p_event_id: input.eventId,
        p_lease_token: input.leaseToken,
        p_error_code: input.errorCode,
        p_retry_threshold: input.retryThreshold,
        p_retry_after_seconds: input.retryAfterSeconds,
      },
    }));
  } catch {
    throw new Error("fulfilment_outbox_fail_write_failed");
  }
  const status = String(data);
  if (status !== "retryable_failed" && status !== "dead_letter") {
    throw new Error("fulfilment_outbox_fail_invalid_result");
  }
  return { status };
}

async function defaultFinishRun(input: {
  runId: string;
  leaseToken: string;
  summary: Omit<FulfilmentOutboxWorkerSummary, "schemaVersion" | "runId" | "durable">;
}) {
  try {
    await runRegisteredServiceRoleRpc({
      operation: "fulfilment_outbox_worker_finish",
      args: {
        p_run_id: input.runId,
        p_lease_token: input.leaseToken,
        p_summary: input.summary,
      },
    });
  } catch {
    throw new Error("fulfilment_outbox_run_receipt_failed");
  }
}

export async function deliverFulfilmentOutboxItem(
  item: FulfilmentOutboxItem,
): Promise<FulfilmentOutboxDeliveryReceipt> {
  if (item.resolution === "false_positive_closed") {
    return {
      schemaVersion: "velmere.fulfilment-outbox-delivery.v1",
      resolution: item.resolution,
      action: "false_positive_noop",
      durable: true,
    };
  }
  if (!item.orderDraftId) throw new Error("fulfilment_outbox_missing_order_draft_id");

  if (item.resolution === "provider_draft_confirmed") {
    if (!item.evidence.providerOrderId) throw new Error("fulfilment_outbox_missing_provider_evidence");
    const result = await markDurableProviderDraftCreated(
      item.orderDraftId,
      undefined,
      undefined,
      item.evidence.providerOrderId,
    );
    if (!result.durableWrite) throw new Error("fulfilment_outbox_order_write_not_durable");
    return {
      schemaVersion: "velmere.fulfilment-outbox-delivery.v1",
      resolution: item.resolution,
      action: "provider_draft_state_applied",
      durable: true,
    };
  }

  if (item.resolution === "manual_fulfilment_assigned") {
    const result = await markDurableManualFulfilmentRequired(item.orderDraftId);
    if (!result.durableWrite) throw new Error("fulfilment_outbox_order_write_not_durable");
    return {
      schemaVersion: "velmere.fulfilment-outbox-delivery.v1",
      resolution: item.resolution,
      action: "manual_fulfilment_state_applied",
      durable: true,
    };
  }

  if (!item.evidence.paymentActionReference) {
    throw new Error("fulfilment_outbox_missing_refund_evidence");
  }
  const result = await markDurableOrderRefundPending(
    item.orderDraftId,
    item.evidence.paymentActionReference,
  );
  if (!result.durableWrite) throw new Error("fulfilment_outbox_order_write_not_durable");
  return {
    schemaVersion: "velmere.fulfilment-outbox-delivery.v1",
    resolution: item.resolution,
    action: "refund_pending_state_applied",
    durable: true,
  };
}

export const fulfilmentOutboxWorkerDependencies: FulfilmentOutboxWorkerDependencies = {
  hasDurableStorage: hasSupabaseServiceRoleConfig,
  claimBatch: defaultClaimBatch,
  complete: defaultComplete,
  release: defaultRelease,
  fail: defaultFail,
  finishRun: defaultFinishRun,
  deliver: deliverFulfilmentOutboxItem,
  now: Date.now,
  randomId: randomUUID,
};

export async function runFulfilmentIncidentOutboxWorker(
  input: {
    limit?: number;
    deadlineMs?: number;
    staleAfterSeconds?: number;
    retryThreshold?: number;
    retryAfterSeconds?: number;
  } = {},
  dependencies: FulfilmentOutboxWorkerDependencies = fulfilmentOutboxWorkerDependencies,
): Promise<FulfilmentOutboxWorkerSummary> {
  if (!dependencies.hasDurableStorage()) {
    throw new Error("fulfilment_outbox_storage_unavailable");
  }
  const runId = `fulfilment_run_${dependencies.randomId().replace(/-/g, "").slice(0, 24)}`;
  const leaseToken = `fulfilment_lease_${dependencies.randomId().replace(/-/g, "").slice(0, 24)}`;
  const limit = boundedInteger(input.limit, 25, 1, 100);
  const deadlineMs = boundedInteger(input.deadlineMs, 8_000, 1_000, 20_000);
  const staleAfterSeconds = boundedInteger(input.staleAfterSeconds, 300, 60, 86_400);
  const retryThreshold = boundedInteger(input.retryThreshold, 5, 2, 20);
  const retryAfterSeconds = boundedInteger(input.retryAfterSeconds, 60, 5, 3_600);
  const startedAt = dependencies.now();
  const claimed = await dependencies.claimBatch({
    runId,
    leaseToken,
    limit,
    staleAfterSeconds,
    retryThreshold,
  });

  const counts = {
    leaseAcquired: claimed.leaseAcquired,
    claimedCount: claimed.items.length,
    deliveredCount: 0,
    retryableFailedCount: 0,
    deadLetteredCount: 0,
    skippedByDeadlineCount: 0,
    severity: "none" as "none" | "warning" | "critical",
  };

  if (claimed.leaseAcquired) {
    for (let index = 0; index < claimed.items.length; index += 1) {
      if (dependencies.now() - startedAt >= deadlineMs) {
        const remaining = claimed.items.slice(index);
        for (const pending of remaining) {
          await dependencies.release({
            eventId: pending.eventId,
            leaseToken: pending.leaseToken,
            reasonCode: "worker_deadline_released",
          });
        }
        counts.skippedByDeadlineCount = remaining.length;
        break;
      }
      const item = claimed.items[index];
      try {
        const receipt = await dependencies.deliver(item);
        await dependencies.complete({ eventId: item.eventId, leaseToken: item.leaseToken, receipt });
        counts.deliveredCount += 1;
      } catch (error) {
        const failure = await dependencies.fail({
          eventId: item.eventId,
          leaseToken: item.leaseToken,
          errorCode: safeErrorCode(error),
          retryThreshold,
          retryAfterSeconds,
        });
        if (failure.status === "dead_letter") counts.deadLetteredCount += 1;
        else counts.retryableFailedCount += 1;
      }
    }
  }

  counts.severity = counts.deadLetteredCount > 0
    ? "critical"
    : counts.retryableFailedCount > 0 || counts.skippedByDeadlineCount > 0
      ? "warning"
      : "none";

  await dependencies.finishRun({ runId, leaseToken, summary: counts });
  return {
    schemaVersion: "velmere.fulfilment-outbox-worker.v1",
    runId,
    ...counts,
    durable: true,
  };
}

export function buildFulfilmentOutboxWorkerReadiness() {
  const serviceRoleConfigured = hasSupabaseServiceRoleConfig();
  return {
    schemaVersion: "velmere.fulfilment-outbox-worker-readiness.v1" as const,
    serviceRoleConfigured,
    cronSecretConfigured: Boolean(
      process.env.MARKET_INTEGRITY_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim(),
    ),
    durableReady: serviceRoleConfigured,
    privacyBoundary:
      "Worker responses contain aggregate counts only. Event IDs, case IDs, order IDs, lease tokens, evidence and provider/customer payloads remain server-side.",
  };
}
