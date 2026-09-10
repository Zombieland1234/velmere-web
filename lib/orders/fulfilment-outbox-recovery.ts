import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runBoundedServiceRoleRpc, type SupabaseRpcClient } from "@/lib/db/bounded-supabase-rpc";

export type FulfilmentOutboxRecoveryAction = "requeue" | "discard";
export type FulfilmentOutboxRecoveryStatus =
  | "requeued"
  | "discarded"
  | "already_applied"
  | "not_found"
  | "conflict";

export type FulfilmentOutboxRecoveryResult = {
  schemaVersion: "velmere.fulfilment-outbox-recovery.v1";
  status: FulfilmentOutboxRecoveryStatus;
  action: FulfilmentOutboxRecoveryAction;
  durable: true;
};

export type FulfilmentOutboxDeadLetterSummary = {
  schemaVersion: "velmere.fulfilment-outbox-dead-letter-summary.v1";
  deadLetterCount: number;
  overdueCount: number;
  oldestAgeSeconds: number;
  hasCriticalBacklog: boolean;
  durable: true;
};


export type FulfilmentOutboxRecoveryDependencies = {
  hasDurableStorage: () => boolean;
  getClient?: () => SupabaseRpcClient | null;
};

export const fulfilmentOutboxRecoveryDependencies: FulfilmentOutboxRecoveryDependencies = {
  hasDurableStorage: hasSupabaseServiceRoleConfig,
};

const SAFE_EVENT_ID = /^fulfilment_outbox_[a-f0-9]{24}$/;
const SAFE_REQUEST_ID = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$/;
const SAFE_REASON = /^[a-z0-9][a-z0-9:_-]{2,79}$/;
const SAFE_REFERENCE = /^[a-zA-Z0-9][a-zA-Z0-9:._/-]{3,159}$/;
const SAFE_OPERATOR = /^operator_[a-f0-9]{20}$/;

function bounded(value: string, pattern: RegExp, code: string) {
  const normalized = value.trim();
  if (!pattern.test(normalized)) throw new Error(code);
  return normalized;
}

export async function recoverFulfilmentOutboxDeadLetter(
  input: {
    eventId: string;
    action: FulfilmentOutboxRecoveryAction;
    requestId: string;
    reasonCode: string;
    evidenceReference: string;
    operatorFingerprint: string;
  },
  dependencies: FulfilmentOutboxRecoveryDependencies = fulfilmentOutboxRecoveryDependencies,
): Promise<FulfilmentOutboxRecoveryResult> {
  if (!dependencies.hasDurableStorage()) {
    throw new Error("fulfilment_outbox_recovery_storage_unavailable");
  }
  if (input.action !== "requeue" && input.action !== "discard") {
    throw new Error("fulfilment_outbox_recovery_invalid_action");
  }
  const eventId = bounded(input.eventId, SAFE_EVENT_ID, "fulfilment_outbox_recovery_invalid_event_id");
  const requestId = bounded(input.requestId, SAFE_REQUEST_ID, "fulfilment_outbox_recovery_invalid_request_id");
  const reasonCode = bounded(
    input.reasonCode.toLowerCase(),
    SAFE_REASON,
    "fulfilment_outbox_recovery_invalid_reason_code",
  );
  const evidenceReference = bounded(
    input.evidenceReference,
    SAFE_REFERENCE,
    "fulfilment_outbox_recovery_invalid_evidence_reference",
  );
  const operatorFingerprint = bounded(
    input.operatorFingerprint,
    SAFE_OPERATOR,
    "fulfilment_outbox_recovery_invalid_operator",
  );
  const { data } = await runBoundedServiceRoleRpc({
    operation: "fulfilment_outbox_recover",
    rpcName: "velmere_recover_fulfilment_outbox_dead_letter",
    args: {
      p_event_id: eventId,
      p_action: input.action,
      p_request_id: requestId,
      p_reason_code: reasonCode,
      p_evidence_reference: evidenceReference,
      p_operator_fingerprint: operatorFingerprint,
    },
    clientOverride: dependencies.getClient?.(),
  });
  const status = String(data ?? "not_found") as FulfilmentOutboxRecoveryStatus;
  if (!["requeued", "discarded", "already_applied", "not_found", "conflict"].includes(status)) {
    throw new Error("fulfilment_outbox_recovery_invalid_result");
  }
  return {
    schemaVersion: "velmere.fulfilment-outbox-recovery.v1",
    status,
    action: input.action,
    durable: true,
  };
}

export async function readFulfilmentOutboxDeadLetterSummary(
  dependencies: FulfilmentOutboxRecoveryDependencies = fulfilmentOutboxRecoveryDependencies,
): Promise<FulfilmentOutboxDeadLetterSummary> {
  if (!dependencies.hasDurableStorage()) {
    throw new Error("fulfilment_outbox_recovery_storage_unavailable");
  }
  const { data } = await runBoundedServiceRoleRpc({
    operation: "fulfilment_outbox_summary",
    rpcName: "velmere_fulfilment_outbox_dead_letter_summary",
    clientOverride: dependencies.getClient?.(),
  });
  const row = Array.isArray(data) ? data[0] : data;
  const source = row && typeof row === "object" ? row as Record<string, unknown> : {};
  const deadLetterCount = Math.max(0, Math.trunc(Number(source.dead_letter_count ?? 0)));
  const overdueCount = Math.max(0, Math.trunc(Number(source.overdue_count ?? 0)));
  const oldestAgeSeconds = Math.max(0, Math.trunc(Number(source.oldest_age_seconds ?? 0)));
  return {
    schemaVersion: "velmere.fulfilment-outbox-dead-letter-summary.v1",
    deadLetterCount,
    overdueCount,
    oldestAgeSeconds,
    hasCriticalBacklog: deadLetterCount > 0 && (overdueCount > 0 || oldestAgeSeconds >= 3600),
    durable: true,
  };
}
