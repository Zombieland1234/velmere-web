import { createHash } from "node:crypto";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import {
  findMemoryVlmPaidEntitlementById,
  updateMemoryVlmPaidEntitlementStatus,
  type VlmPaidEntitlementRecord,
  type VlmPaidEntitlementStatus,
} from "@/lib/commerce/vlm-entitlement-ledger";

export const VLM_PAID_ENTITLEMENT_LIFECYCLE_ID = "vlm-paid-entitlement-lifecycle-v1" as const;

export type VlmPaidEntitlementLifecycleEvent =
  | "expire"
  | "refund"
  | "chargeback"
  | "manual_revoke"
  | "restore";

export type VlmPaidEntitlementLifecycleResult =
  | {
      ok: true;
      idempotent: boolean;
      event: VlmPaidEntitlementLifecycleEvent;
      previousStatus: VlmPaidEntitlementStatus;
      nextStatus: VlmPaidEntitlementStatus;
      entitlementIdHash: string;
      eventIdHash: string;
      ledgerMode: "durable" | "memory";
    }
  | {
      ok: false;
      error: string;
      retryable: boolean;
      ledgerMode?: "durable" | "memory";
    };

type LifecycleRpc = typeof runRegisteredServiceRoleRpc;

const ALLOWED_EVENT = new Set<VlmPaidEntitlementLifecycleEvent>([
  "expire",
  "refund",
  "chargeback",
  "manual_revoke",
  "restore",
]);

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function nextStatusFor(
  current: VlmPaidEntitlementStatus,
  event: VlmPaidEntitlementLifecycleEvent,
): VlmPaidEntitlementStatus | null {
  if (event === "expire") {
    return current === "paid" || current === "active" ? "expired" : current === "expired" ? "expired" : null;
  }
  if (event === "refund") {
    return current === "paid" || current === "active" || current === "expired" ? "refunded" : current === "refunded" ? "refunded" : null;
  }
  if (event === "chargeback" || event === "manual_revoke") {
    return current === "paid" || current === "active" || current === "expired" || current === "refunded"
      ? "revoked"
      : current === "revoked" ? "revoked" : null;
  }
  if (event === "restore") {
    return current === "expired" ? "active" : current === "active" ? "active" : null;
  }
  return null;
}

export function evaluateVlmPaidEntitlementLifecycleTransition(args: {
  currentStatus: VlmPaidEntitlementStatus;
  event: VlmPaidEntitlementLifecycleEvent;
}) {
  if (!ALLOWED_EVENT.has(args.event)) return { ok: false as const, error: "invalid_lifecycle_event" };
  const nextStatus = nextStatusFor(args.currentStatus, args.event);
  if (!nextStatus) return { ok: false as const, error: "invalid_entitlement_state_transition" };
  return {
    ok: true as const,
    previousStatus: args.currentStatus,
    nextStatus,
    idempotent: nextStatus === args.currentStatus,
  };
}

function parseDurableRow(data: unknown): VlmPaidEntitlementLifecycleResult {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return { ok: false, error: "invalid_lifecycle_rpc_result", retryable: true, ledgerMode: "durable" };
  const value = row as Record<string, unknown>;
  if (value.ok === false) {
    return {
      ok: false,
      error: safeText(value.error, 120) || "entitlement_lifecycle_rejected",
      retryable: Boolean(value.retryable),
      ledgerMode: "durable",
    };
  }
  const event = safeText(value.event_type, 32) as VlmPaidEntitlementLifecycleEvent;
  const previousStatus = safeText(value.previous_status, 32) as VlmPaidEntitlementStatus;
  const nextStatus = safeText(value.next_status, 32) as VlmPaidEntitlementStatus;
  const entitlementIdHash = safeText(value.entitlement_id_hash, 64);
  const eventIdHash = safeText(value.event_id_hash, 64);
  if (!ALLOWED_EVENT.has(event) || !previousStatus || !nextStatus || !/^[a-f0-9]{64}$/.test(entitlementIdHash) || !/^[a-f0-9]{64}$/.test(eventIdHash)) {
    return { ok: false, error: "invalid_lifecycle_rpc_result", retryable: true, ledgerMode: "durable" };
  }
  return {
    ok: true,
    idempotent: Boolean(value.idempotent),
    event,
    previousStatus,
    nextStatus,
    entitlementIdHash,
    eventIdHash,
    ledgerMode: "durable",
  };
}

export async function applyVlmPaidEntitlementLifecycleEvent(args: {
  entitlementId: string;
  eventId: string;
  event: VlmPaidEntitlementLifecycleEvent;
  sourceEventId?: string | null;
  operatorId?: string | null;
  reason?: string | null;
  now?: Date;
  dependencies?: { rpc?: LifecycleRpc };
}): Promise<VlmPaidEntitlementLifecycleResult> {
  const entitlementId = safeText(args.entitlementId, 180);
  const eventId = safeText(args.eventId, 180);
  const sourceEventId = safeText(args.sourceEventId, 220);
  const operatorId = safeText(args.operatorId, 220);
  const reason = safeText(args.reason, 500);
  if (!entitlementId || !eventId || !ALLOWED_EVENT.has(args.event)) {
    return { ok: false, error: "invalid_entitlement_lifecycle_request", retryable: false };
  }

  if (hasSupabaseServiceRoleConfig()) {
    const rpc = args.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
    try {
      const result = await rpc({
        operation: "vlm_paid_entitlement_lifecycle_apply",
        args: {
          p_entitlement_id: entitlementId,
          p_event_id_hash: sha256(eventId),
          p_event_type: args.event,
          p_source_event_hash: sourceEventId ? sha256(sourceEventId) : null,
          p_operator_hash: operatorId ? sha256(operatorId) : null,
          p_reason_hash: reason ? sha256(reason) : null,
          p_event_at: (args.now ?? new Date()).toISOString(),
        },
      });
      return parseDurableRow(result.data);
    } catch {
      return { ok: false, error: "entitlement_lifecycle_store_failed", retryable: true, ledgerMode: "durable" };
    }
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return { ok: false, error: "durable_entitlement_lifecycle_required", retryable: true, ledgerMode: "durable" };
  }

  const current = findMemoryVlmPaidEntitlementById(entitlementId);
  if (!current) return { ok: false, error: "entitlement_not_found", retryable: false, ledgerMode: "memory" };
  const transition = evaluateVlmPaidEntitlementLifecycleTransition({ currentStatus: current.status, event: args.event });
  if (!transition.ok) return { ok: false, error: transition.error, retryable: false, ledgerMode: "memory" };
  if (!transition.idempotent) updateMemoryVlmPaidEntitlementStatus({ entitlementId, status: transition.nextStatus, now: args.now });
  return {
    ok: true,
    idempotent: transition.idempotent,
    event: args.event,
    previousStatus: transition.previousStatus,
    nextStatus: transition.nextStatus,
    entitlementIdHash: sha256(entitlementId),
    eventIdHash: sha256(eventId),
    ledgerMode: "memory",
  };
}

export function isVlmPaidEntitlementPrivileged(record: Pick<VlmPaidEntitlementRecord, "status" | "expiresAt">, now = new Date()) {
  return (record.status === "paid" || record.status === "active") && Date.parse(record.expiresAt) > now.getTime();
}
