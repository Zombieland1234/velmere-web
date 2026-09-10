import { createHash } from "node:crypto";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";

export const PASS4615_AUDIT_CUSTOMER_HISTORY_ID = "pass4615-audit-customer-safe-append-only-history" as const;
export const PASS4615_AUDIT_CUSTOMER_HISTORY_BOUNDARY =
  "The account portal receives only a customer-safe, append-only projection of case lifecycle events. The projection excludes the canonical target, account identifiers, checkout identifiers, entitlement identifiers, provider event identifiers, operator identity and private review notes." as const;

export type AuditCustomerHistoryEventType =
  | "case_created"
  | "checkout_bound"
  | "payment_verified"
  | "queued_for_review"
  | "payment_blocked"
  | "access_revoked"
  | "analysis_started"
  | "analysis_completed"
  | "status_changed"
  | "migration_snapshot"
  | "reviewer_assigned"
  | "automation_claimed"
  | "review_requeued"
  | "review_dead_lettered"
  | "automation_completed";

export type AuditCustomerHistoryReason =
  | "checkout_expired"
  | "payment_failed"
  | "refund"
  | "chargeback"
  | "human_review_assignment"
  | "optional_internal_qa_assignment"
  | "pro_worker_lease"
  | "advanced_worker_lease"
  | "automation_retry"
  | "retry_exhausted"
  | null;
export type AuditCustomerQueueLane = "basic_prescreen" | "payment_verification" | "pro_review" | "advanced_automation" | "advanced_human_review" | "blocked";
export type AuditCustomerPaymentState = "not_required" | "awaiting" | "pending" | "verified" | "failed" | "expired" | "refunded" | "chargeback";

export type AuditCustomerHistoryEvent = {
  sequence: number;
  type: AuditCustomerHistoryEventType;
  previousStatus: string | null;
  status: string;
  queueLane: AuditCustomerQueueLane;
  paymentState: AuditCustomerPaymentState;
  analysisStarted: boolean;
  reason: AuditCustomerHistoryReason;
  occurredAt: string;
  receiptHash: string;
  previousReceiptHash: string | null;
  origin: "native" | "migration_snapshot" | "memory_runtime_only";
};

export type AuditCustomerHistoryPayload = {
  passId: typeof PASS4615_AUDIT_CUSTOMER_HISTORY_ID;
  available: boolean;
  appendOnly: true;
  complete: boolean;
  truncated: boolean;
  totalEvents: number;
  mode: "supabase_durable" | "memory_runtime_only" | "unavailable";
  events: AuditCustomerHistoryEvent[];
  boundary: typeof PASS4615_AUDIT_CUSTOMER_HISTORY_BOUNDARY;
  error?: "history_unavailable";
};

type HistoryRecord = {
  caseRef: string;
  tier: "basic" | "pro" | "advanced";
  status: string;
  entitlementRequired: boolean;
  entitlementVerified: boolean;
  analysisStarted: boolean;
  blockedReason?: AuditCustomerHistoryReason;
  createdAt: string;
  updatedAt: string;
};

const memoryHistory = new Map<string, AuditCustomerHistoryEvent[]>();
const MAX_MEMORY_EVENTS_PER_CASE = 48;

function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function cleanCaseRef(value: string) {
  const clean = value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  return /^AUD-[A-Z0-9]{8,16}$/.test(clean) ? clean : "";
}

function cleanStatus(value: unknown) {
  return String(value ?? "unknown").replace(/[^a-z0-9_-]/gi, "").slice(0, 48) || "unknown";
}

function cleanEventType(value: unknown): AuditCustomerHistoryEventType | null {
  return value === "case_created" || value === "checkout_bound" || value === "payment_verified" || value === "queued_for_review" || value === "payment_blocked" || value === "access_revoked" || value === "analysis_started" || value === "analysis_completed" || value === "status_changed" || value === "migration_snapshot" || value === "reviewer_assigned" || value === "automation_claimed" || value === "review_requeued" || value === "review_dead_lettered" || value === "automation_completed" ? value : null;
}

function cleanReason(value: unknown): AuditCustomerHistoryReason {
  return value === "checkout_expired" || value === "payment_failed" || value === "refund" || value === "chargeback" || value === "human_review_assignment" || value === "optional_internal_qa_assignment" || value === "pro_worker_lease" || value === "advanced_worker_lease" || value === "automation_retry" || value === "retry_exhausted" ? value : null;
}

export function deriveAuditCustomerQueueLane(record: Pick<HistoryRecord, "tier" | "status">): AuditCustomerQueueLane {
  if (record.status === "queued_basic_prescreen") return "basic_prescreen";
  if (record.status === "queued_paid_review") return record.tier === "advanced" ? "advanced_automation" : "pro_review";
  if (record.status === "checkout_pending" || record.status === "awaiting_entitlement") return "payment_verification";
  return "blocked";
}

export function deriveAuditCustomerPaymentState(record: Pick<HistoryRecord, "status" | "entitlementRequired" | "entitlementVerified" | "blockedReason">): AuditCustomerPaymentState {
  if (record.status === "access_revoked") return record.blockedReason === "chargeback" ? "chargeback" : "refunded";
  if (record.status === "payment_blocked") return record.blockedReason === "checkout_expired" ? "expired" : "failed";
  if (record.entitlementVerified) return "verified";
  if (record.status === "checkout_pending") return "pending";
  return record.entitlementRequired ? "awaiting" : "not_required";
}

export function appendMemoryAuditCaseHistoryEvent(
  record: HistoryRecord,
  type: AuditCustomerHistoryEventType,
  options: { previousStatus?: string | null; occurredAt?: string; reason?: AuditCustomerHistoryReason } = {},
) {
  const caseRef = cleanCaseRef(record.caseRef);
  if (!caseRef) return null;
  const previous = memoryHistory.get(caseRef) ?? [];
  const prior = previous.at(-1) ?? null;
  const sequence = (prior?.sequence ?? 0) + 1;
  const occurredAt = options.occurredAt ?? record.updatedAt ?? new Date().toISOString();
  const reason = options.reason ?? cleanReason(record.blockedReason);
  const payload = [
    caseRef,
    sequence,
    type,
    options.previousStatus ?? null,
    record.status,
    deriveAuditCustomerQueueLane(record),
    deriveAuditCustomerPaymentState(record),
    record.analysisStarted,
    reason,
    occurredAt,
    prior?.receiptHash ?? "root",
  ].join("|");
  const event: AuditCustomerHistoryEvent = {
    sequence,
    type,
    previousStatus: options.previousStatus ? cleanStatus(options.previousStatus) : null,
    status: cleanStatus(record.status),
    queueLane: deriveAuditCustomerQueueLane(record),
    paymentState: deriveAuditCustomerPaymentState(record),
    analysisStarted: record.analysisStarted,
    reason,
    occurredAt,
    receiptHash: sha256(payload),
    previousReceiptHash: prior?.receiptHash ?? null,
    origin: "memory_runtime_only",
  };
  memoryHistory.set(caseRef, [...previous, event].slice(-MAX_MEMORY_EVENTS_PER_CASE));
  return event;
}

function rowToEvent(row: Record<string, unknown>): AuditCustomerHistoryEvent | null {
  const type = cleanEventType(row.event_type);
  if (!type) return null;
  const queueLane = row.queue_lane === "basic_prescreen" || row.queue_lane === "pro_review" || row.queue_lane === "advanced_automation" || row.queue_lane === "advanced_human_review" || row.queue_lane === "payment_verification" ? row.queue_lane : "blocked";
  const paymentState = row.payment_state === "not_required" || row.payment_state === "awaiting" || row.payment_state === "pending" || row.payment_state === "verified" || row.payment_state === "failed" || row.payment_state === "expired" || row.payment_state === "refunded" || row.payment_state === "chargeback" ? row.payment_state : "awaiting";
  const occurredAt = String(row.occurred_at ?? "");
  const sequence = Number(row.case_sequence ?? 0);
  const receiptHash = String(row.event_hash ?? "");
  if (!Number.isInteger(sequence) || sequence <= 0 || !occurredAt || !receiptHash.startsWith("sha256:")) return null;
  return {
    sequence,
    type,
    previousStatus: row.previous_status ? cleanStatus(row.previous_status) : null,
    status: cleanStatus(row.next_status),
    queueLane,
    paymentState,
    analysisStarted: Boolean(row.analysis_started),
    reason: cleanReason(row.reason_code),
    occurredAt,
    receiptHash,
    previousReceiptHash: row.previous_event_hash ? String(row.previous_event_hash) : null,
    origin: type === "migration_snapshot" ? "migration_snapshot" : "native",
  };
}

export function verifyAuditCustomerHistoryChain(events: AuditCustomerHistoryEvent[]) {
  if (!events.length) return { ok: true, brokenAt: null as number | null };
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (index > 0 && event.previousReceiptHash !== events[index - 1].receiptHash) return { ok: false, brokenAt: event.sequence };
    if (index === 0 && event.sequence === 1 && event.previousReceiptHash !== null) return { ok: false, brokenAt: event.sequence };
  }
  return { ok: true, brokenAt: null as number | null };
}

export async function getAuditCaseCustomerHistory(args: {
  caseRef: string;
  accountId: string;
  durable: boolean;
  limit?: number;
}): Promise<AuditCustomerHistoryPayload> {
  const caseRef = cleanCaseRef(args.caseRef);
  const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 40)));
  const base = {
    passId: PASS4615_AUDIT_CUSTOMER_HISTORY_ID,
    appendOnly: true as const,
    boundary: PASS4615_AUDIT_CUSTOMER_HISTORY_BOUNDARY,
  };
  if (!caseRef) return { ...base, available: false, complete: false, truncated: false, totalEvents: 0, mode: "unavailable", events: [], error: "history_unavailable" };

  if (args.durable) {
    try {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "audit_customer_history_get",
        args: {
          p_case_ref: caseRef,
          p_account_id: args.accountId,
          p_limit: limit,
        },
      });
      const rpc = (data ?? {}) as { ok?: boolean; complete?: boolean; truncated?: boolean; totalEvents?: number; events?: Record<string, unknown>[] };
      if (!rpc.ok || !Array.isArray(rpc.events)) throw new Error("audit_customer_history_unavailable");
      const events = rpc.events.map(rowToEvent).filter((event): event is AuditCustomerHistoryEvent => Boolean(event));
      const chain = verifyAuditCustomerHistoryChain(events);
      if (!chain.ok) throw new Error(`audit_customer_history_chain_broken:${chain.brokenAt}`);
      return {
        ...base,
        available: true,
        complete: rpc.complete === true,
        truncated: rpc.truncated === true,
        totalEvents: Math.max(events.length, Number(rpc.totalEvents ?? events.length)),
        mode: "supabase_durable",
        events,
      };
    } catch {
      return { ...base, available: false, complete: false, truncated: false, totalEvents: 0, mode: "unavailable", events: [], error: "history_unavailable" };
    }
  }

  const events = [...(memoryHistory.get(caseRef) ?? [])].slice(-limit);
  const totalEvents = memoryHistory.get(caseRef)?.length ?? 0;
  return {
    ...base,
    available: true,
    complete: events[0]?.type === "case_created" && !events[0]?.previousReceiptHash,
    truncated: totalEvents > events.length,
    totalEvents,
    mode: "memory_runtime_only",
    events,
  };
}

export function getMemoryAuditCaseHistory(caseRef: string) {
  return [...(memoryHistory.get(cleanCaseRef(caseRef)) ?? [])];
}

export function forgetMemoryAuditCaseHistory(caseRef: string) {
  const normalized = cleanCaseRef(caseRef);
  return normalized ? memoryHistory.delete(normalized) : false;
}
