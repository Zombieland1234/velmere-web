import { createHash } from "node:crypto";
import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import type { VelmereAdminRole } from "@/lib/admin/session-roles";

export type AdminAuditAction =
  | "product_publish"
  | "product_brain_edit"
  | "fulfilment_retry"
  | "queue_replay"
  | "queue_discard"
  | "order_state_change"
  | "provider_sandbox"
  | "incident_case_update"
  | "incident_case_resolve"
  | "incident_outbox_recovery"
  | "fulfilment_provider_status_sync"
  | "account_supabase_subject_bind"
  | "export"
  | "session_login";

export type AdminAuditLogResult = {
  schemaVersion: "velmere.admin-audit-log-result.v1";
  persisted: boolean;
  durableWrite: boolean;
  mode: "supabase" | "memory_blocked_for_production";
  receiptId: string;
  action: AdminAuditAction;
  targetType: string;
  targetId?: string;
  productionBoundary: string;
  providerError?: string;
};

const memory: AdminAuditLogResult[] = [];

function receipt(input: unknown) {
  return `admin_audit_${createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 22)}`;
}

function redacted(value: Record<string, unknown> = {}) {
  const blocked = new Set(["email", "phone", "address", "secret", "token", "rawProviderPayload", "customerDetails"]);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !blocked.has(key)));
}

export async function appendAdminAuditLog(input: {
  actorId?: string;
  actorRole?: VelmereAdminRole | "unknown";
  action: AdminAuditAction;
  targetType: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  requestId?: string;
}) {
  const receiptId = receipt({ ...input, at: new Date().toISOString() });
  const base = {
    actor_id: input.actorId ?? "operator:unknown",
    actor_role: input.actorRole ?? "unknown",
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    redacted_payload: redacted(input.payload),
    request_id: input.requestId ?? null,
    receipt_id: receiptId,
  };
  if (!hasSupabaseServiceRoleConfig()) {
    const result: AdminAuditLogResult = { schemaVersion: "velmere.admin-audit-log-result.v1", persisted: false, durableWrite: false, mode: "memory_blocked_for_production", receiptId, action: input.action, targetType: input.targetType, targetId: input.targetId, productionBoundary: "BLOCKED: Supabase service-role ENV missing; audit log memory is not production truth." };
    memory.unshift(result); memory.length = Math.min(memory.length, 100);
    return result;
  }
  try {
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) throw new Error("Supabase client unavailable.");
    const { error } = await supabase.from("velmere_audit_logs").insert(base);
    if (error) throw error;
    return { schemaVersion: "velmere.admin-audit-log-result.v1", persisted: true, durableWrite: true, mode: "supabase", receiptId, action: input.action, targetType: input.targetType, targetId: input.targetId, productionBoundary: "Durable server-side audit log written with redacted payload." } satisfies AdminAuditLogResult;
  } catch (error) {
    return { schemaVersion: "velmere.admin-audit-log-result.v1", persisted: false, durableWrite: false, mode: "memory_blocked_for_production", receiptId, action: input.action, targetType: input.targetType, targetId: input.targetId, productionBoundary: "BLOCKED: audit write failed; do not claim production audit until DB succeeds.", providerError: error instanceof Error ? error.message : "audit_write_failed" } satisfies AdminAuditLogResult;
  }
}
