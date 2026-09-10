import { randomUUID } from "node:crypto";
import {
  hasSupabaseServiceRoleConfig,
} from "@/lib/db/supabase";
import {
  classifyStripeWebhookWorkerRun,
  normalizeStripeWebhookWorkerAggregate,
} from "./stripe-webhook-reconciliation-policy";
import { emitStripeWebhookWorkerAlert } from "@/lib/observability/stripe-webhook-alert-sink";
import { runBoundedServiceRoleRpc } from "@/lib/db/bounded-supabase-rpc";

export type StripeWebhookReconciliationSummary = {
  schemaVersion: "velmere.stripe-webhook-reconciliation.v2";
  runId: string;
  leaseAcquired: boolean;
  scannedCount: number;
  staleReleasedCount: number;
  retryReadyCount: number;
  deadLetteredCount: number;
  completedWithoutEventCount: number;
  oldestProcessingAgeSeconds: number | null;
  errorBuckets: {
    provider: number;
    storage: number;
    entitlement: number;
    order: number;
    other: number;
  };
  telemetryValid: boolean;
  telemetryReasonCodes: string[];
  severity: "none" | "warning" | "critical";
  reasonCodes: string[];
  alertDelivery: "not_required" | "not_configured" | "delivered" | "failed";
  durable: true;
};

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export function buildStripeWebhookReconciliationReadiness() {
  const serviceRoleConfigured = hasSupabaseServiceRoleConfig();
  return {
    schemaVersion: "velmere.stripe-webhook-reconciliation-readiness.v2" as const,
    serviceRoleConfigured,
    durableReady: serviceRoleConfigured,
    cronSecretConfigured: Boolean(
      process.env.MARKET_INTEGRITY_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim(),
    ),
    alertSinkConfigured: Boolean(process.env.VELMERE_ALERT_WEBHOOK_URL?.trim()),
    publicIdentifiersExposed: false,
    productionBoundary:
      "Worker is cron/admin authenticated, service-role-only, globally leased, bounded by batch/deadline and returns aggregate counts only. No Stripe event IDs, effect keys, lease tokens, payloads, customer data or provider bodies leave the worker.",
  };
}

export async function reconcileStripeWebhookEffects(input: {
  staleAfterSeconds?: number;
  retryThreshold?: number;
  limit?: number;
  deadlineMs?: number;
  emitAlert?: boolean;
} = {}): Promise<StripeWebhookReconciliationSummary> {
  if (!hasSupabaseServiceRoleConfig()) {
    throw new Error("stripe_webhook_reconciliation_storage_unavailable");
  }

  const staleAfterSeconds = boundedInteger(input.staleAfterSeconds, 300, 60, 86_400);
  const retryThreshold = boundedInteger(input.retryThreshold, 5, 2, 50);
  const limit = boundedInteger(input.limit, 100, 1, 500);
  const deadlineMs = boundedInteger(input.deadlineMs, 8_000, 1_000, 20_000);
  const runId = randomUUID();

  const { data } = await runBoundedServiceRoleRpc({
    operation: "stripe_reconciliation_run",
    rpcName: "velmere_run_stripe_webhook_reconciliation_worker",
    args: {
      p_stale_after_seconds: staleAfterSeconds,
      p_retry_threshold: retryThreshold,
      p_limit: limit,
      p_run_id: runId,
    },
    deadlineMs,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("stripe_webhook_reconciliation_empty_result");
  const telemetry = typeof row === "object" && row !== null
    ? row as Record<string, unknown>
    : {};

  const normalized = normalizeStripeWebhookWorkerAggregate({
    leaseAcquired: telemetry.lease_acquired,
    scannedCount: telemetry.scanned_count,
    staleReleasedCount: telemetry.stale_released_count,
    retryReadyCount: telemetry.retry_ready_count,
    deadLetteredCount: telemetry.dead_lettered_count,
    completedWithoutEventCount: telemetry.completed_without_event_count,
    oldestProcessingAgeSeconds: telemetry.oldest_processing_age_seconds,
    errorBuckets: telemetry.error_buckets,
  });
  const policy = classifyStripeWebhookWorkerRun(normalized);
  const alert = await emitStripeWebhookWorkerAlert({
    required: input.emitAlert !== false && policy.alertRequired,
    payload: {
      schemaVersion: "velmere.stripe-webhook-worker-alert.v1",
      severity: policy.severity,
      reasonCodes: policy.reasonCodes.slice(0, 8),
      counts: {
        staleReleased: normalized.staleReleasedCount,
        retryReady: normalized.retryReadyCount,
        deadLettered: normalized.deadLetteredCount,
        completedWithoutEvent: normalized.completedWithoutEventCount,
      },
    },
  });

  return {
    schemaVersion: "velmere.stripe-webhook-reconciliation.v2",
    runId,
    ...normalized,
    severity: policy.severity,
    reasonCodes: policy.reasonCodes,
    alertDelivery: alert.state,
    durable: true,
  };
}


const SAFE_EFFECT_KEY = /^[a-z0-9][a-z0-9:_-]{0,119}$/;
const SAFE_REASON_CODE = /^[a-z0-9][a-z0-9:_-]{0,79}$/;
const SAFE_REQUEST_ID = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$/;

function boundedIdentity(value: string, label: string, max: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`stripe_webhook_requeue_invalid_${label}`);
  return normalized;
}

export async function requeueStripeWebhookDeadLetter(input: {
  eventId: string;
  effectKey: string;
  requestId: string;
  reasonCode: string;
}): Promise<{ status: "requeued" | "already_requeued" | "not_found"; durable: true }> {
  if (!hasSupabaseServiceRoleConfig()) throw new Error("stripe_webhook_requeue_storage_unavailable");
  const eventId = boundedIdentity(input.eventId, "event_id", 180);
  const effectKey = boundedIdentity(input.effectKey.toLowerCase(), "effect_key", 120);
  const requestId = boundedIdentity(input.requestId, "request_id", 120);
  const reasonCode = boundedIdentity(input.reasonCode.toLowerCase(), "reason_code", 80);
  if (!SAFE_EFFECT_KEY.test(effectKey)) throw new Error("stripe_webhook_requeue_invalid_effect_key");
  if (!SAFE_REQUEST_ID.test(requestId)) throw new Error("stripe_webhook_requeue_invalid_request_id");
  if (!SAFE_REASON_CODE.test(reasonCode)) throw new Error("stripe_webhook_requeue_invalid_reason_code");
  const { data } = await runBoundedServiceRoleRpc({
    operation: "stripe_dead_letter_requeue",
    rpcName: "velmere_requeue_stripe_webhook_dead_letter",
    args: {
      p_event_id: eventId,
      p_effect_key: effectKey,
      p_request_id: requestId,
      p_reason_code: reasonCode,
    },
  });
  const status = String(data ?? "not_found");
  if (status !== "requeued" && status !== "already_requeued" && status !== "not_found") {
    throw new Error("stripe_webhook_requeue_invalid_result");
  }
  return { status, durable: true };
}
