import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import {
  buildPaymentRuntimeEvidenceSnapshot,
  listPaymentRuntimeEvidence,
  type PaymentRuntimeEvidenceArea,
  type PaymentRuntimeEvidenceRecord,
  type PaymentRuntimeEvidenceStatus,
} from "@/lib/security/payment-runtime-evidence";

export const PASS2366_DURABLE_PAYMENT_EVIDENCE_ID = "durable-payment-evidence-store" as const;

const TABLE_NAME = "velmere_payment_runtime_evidence";
const durableMemoryStore = new Map<string, PaymentRuntimeEvidenceRecord>();

export type PaymentRuntimeEvidenceSource = "supabase" | "memory";

export type PaymentRuntimeEvidenceFilter = {
  status?: PaymentRuntimeEvidenceStatus | "all";
  area?: PaymentRuntimeEvidenceArea | "all";
  scenarioId?: string;
  auditQueueId?: string;
  accountMessageId?: string;
  accountId?: string;
  q?: string;
  limit?: number;
};

export type DurablePaymentRuntimeEvidenceResult = {
  record: PaymentRuntimeEvidenceRecord;
  source: PaymentRuntimeEvidenceSource;
  durableWrite: boolean;
  linkedAuditQueue: boolean;
  linkedAccountMessage: boolean;
  error?: string;
};

const allowedStatuses = new Set<PaymentRuntimeEvidenceStatus>(["pass", "fail", "manual", "blocked"]);
const allowedAreas = new Set<PaymentRuntimeEvidenceArea>([
  "checkout",
  "stripe_webhook",
  "idempotency",
  "order_persistence",
  "fulfilment",
  "refund_support",
  "vlm_service",
  "release_gate",
]);

function cleanText(value: unknown, fallback = "", max = 220) {
  if (typeof value !== "string") return fallback;
  return value
    .replace(/[<>{}[\]`$\\]/g, " ")
    .replace(/\b(?:sk_live|pk_live|whsec|Bearer)\b[^\s]*/gi, "[redacted]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card-like]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max) || fallback;
}

function cleanOptional(value: unknown, max = 180) {
  const text = cleanText(value, "", max);
  return text || undefined;
}

function normalizeLimit(limit?: number) {
  return Math.max(1, Math.min(Number(limit ?? 50), 100));
}

function rowFromRecord(record: PaymentRuntimeEvidenceRecord) {
  return {
    id: record.id,
    area: record.area,
    status: record.status,
    label: record.label,
    summary: record.summary,
    evidence_ref: record.evidenceRef,
    operator_id: record.operator,
    scenario_id: record.scenarioId ?? null,
    audit_queue_id: record.auditQueueId ?? null,
    account_message_id: record.accountMessageId ?? null,
    account_id: record.accountId ?? null,
    stripe_event_id: record.stripeEventId ?? null,
    stripe_session_id: record.stripeSessionId ?? null,
    entitlement_id: record.entitlementId ?? null,
    safe_notes: record.safeNotes ?? null,
    record: record,
    created_at: record.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function recordFromRow(row: Record<string, unknown>): PaymentRuntimeEvidenceRecord {
  const raw = (row.record ?? {}) as Partial<PaymentRuntimeEvidenceRecord>;
  const status = allowedStatuses.has(row.status as PaymentRuntimeEvidenceStatus)
    ? (row.status as PaymentRuntimeEvidenceStatus)
    : allowedStatuses.has(raw.status as PaymentRuntimeEvidenceStatus)
      ? (raw.status as PaymentRuntimeEvidenceStatus)
      : "manual";
  const area = allowedAreas.has(row.area as PaymentRuntimeEvidenceArea)
    ? (row.area as PaymentRuntimeEvidenceArea)
    : allowedAreas.has(raw.area as PaymentRuntimeEvidenceArea)
      ? (raw.area as PaymentRuntimeEvidenceArea)
      : "release_gate";

  return {
    id: cleanText(row.id ?? raw.id, `payev_${Date.now()}`, 120),
    area,
    status,
    label: cleanText(row.label ?? raw.label, "Payment runtime evidence", 220),
    summary: cleanText(row.summary ?? raw.summary, "Operator evidence captured without raw payment payloads.", 420),
    evidenceRef: cleanText(row.evidence_ref ?? raw.evidenceRef, "manual-reference", 180),
    operator: cleanText(row.operator_id ?? raw.operator, "security-admin", 120),
    createdAt: cleanText(row.created_at ?? raw.createdAt, new Date().toISOString(), 80),
    safeNotes: cleanOptional(row.safe_notes ?? raw.safeNotes, 420),
    scenarioId: cleanOptional(row.scenario_id ?? raw.scenarioId, 140),
    auditQueueId: cleanOptional(row.audit_queue_id ?? raw.auditQueueId, 140),
    accountMessageId: cleanOptional(row.account_message_id ?? raw.accountMessageId, 140),
    accountId: cleanOptional(row.account_id ?? raw.accountId, 140),
    stripeEventId: cleanOptional(row.stripe_event_id ?? raw.stripeEventId, 140),
    stripeSessionId: cleanOptional(row.stripe_session_id ?? raw.stripeSessionId, 140),
    entitlementId: cleanOptional(row.entitlement_id ?? raw.entitlementId, 140),
  };
}

function matchesFilter(record: PaymentRuntimeEvidenceRecord, filter: PaymentRuntimeEvidenceFilter) {
  if (filter.status && filter.status !== "all" && record.status !== filter.status) return false;
  if (filter.area && filter.area !== "all" && record.area !== filter.area) return false;
  if (filter.scenarioId && record.scenarioId !== filter.scenarioId) return false;
  if (filter.auditQueueId && record.auditQueueId !== filter.auditQueueId) return false;
  if (filter.accountMessageId && record.accountMessageId !== filter.accountMessageId) return false;
  if (filter.accountId && record.accountId !== filter.accountId) return false;
  if (filter.q) {
    const haystack = [
      record.id,
      record.label,
      record.summary,
      record.evidenceRef,
      record.scenarioId,
      record.auditQueueId,
      record.accountMessageId,
      record.accountId,
      record.stripeEventId,
      record.stripeSessionId,
      record.entitlementId,
    ].filter(Boolean).join(" ").toLowerCase();
    if (!haystack.includes(filter.q.toLowerCase())) return false;
  }
  return true;
}

export async function storePaymentRuntimeEvidenceDurable(record: PaymentRuntimeEvidenceRecord): Promise<DurablePaymentRuntimeEvidenceResult> {
  const supabase = getSupabaseServiceRoleClient();
  const linkedAuditQueue = Boolean(record.auditQueueId);
  const linkedAccountMessage = Boolean(record.accountMessageId || record.accountId);

  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(rowFromRecord(record), { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (!error && data) {
      return {
        record: recordFromRow(data),
        source: "supabase",
        durableWrite: true,
        linkedAuditQueue,
        linkedAccountMessage,
      };
    }

    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
      throw new Error("payment_runtime_evidence_write_failed");
    }
    durableMemoryStore.set(record.id, record);
    return {
      record,
      source: "memory",
      durableWrite: false,
      linkedAuditQueue,
      linkedAccountMessage,
      error: cleanText(error?.message, "Supabase evidence write failed; memory fallback used.", 240),
    };
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("payment_runtime_evidence_storage_unavailable");
  }
  durableMemoryStore.set(record.id, record);
  return { record, source: "memory", durableWrite: false, linkedAuditQueue, linkedAccountMessage };
}

export async function listDurablePaymentRuntimeEvidence(filter: PaymentRuntimeEvidenceFilter = {}) {
  const supabase = getSupabaseServiceRoleClient();
  const limit = normalizeLimit(filter.limit);

  if (supabase) {
    let query = supabase
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filter.status && filter.status !== "all") query = query.eq("status", filter.status);
    if (filter.area && filter.area !== "all") query = query.eq("area", filter.area);
    if (filter.scenarioId) query = query.eq("scenario_id", filter.scenarioId);
    if (filter.auditQueueId) query = query.eq("audit_queue_id", filter.auditQueueId);
    if (filter.accountMessageId) query = query.eq("account_message_id", filter.accountMessageId);
    if (filter.accountId) query = query.eq("account_id", filter.accountId);

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      const rows = data.map(recordFromRow).filter((record) => matchesFilter(record, filter));
      return { source: "supabase" as const, records: rows, error: undefined };
    }
  }

  const records = Array.from(durableMemoryStore.values()).concat(
    listPaymentRuntimeEvidence(limit),
  )
    .filter((record, index, all) => all.findIndex((item) => item.id === record.id) === index)
    .filter((record) => matchesFilter(record, filter))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);

  return { source: "memory" as const, records, error: undefined };
}

export function parsePaymentEvidenceFilterFromUrl(url: URL): PaymentRuntimeEvidenceFilter {
  const status = url.searchParams.get("status") as PaymentRuntimeEvidenceStatus | "all" | null;
  const area = url.searchParams.get("area") as PaymentRuntimeEvidenceArea | "all" | null;
  return {
    status: status && (status === "all" || allowedStatuses.has(status as PaymentRuntimeEvidenceStatus)) ? status : undefined,
    area: area && (area === "all" || allowedAreas.has(area as PaymentRuntimeEvidenceArea)) ? area : undefined,
    scenarioId: cleanOptional(url.searchParams.get("scenarioId"), 120),
    auditQueueId: cleanOptional(url.searchParams.get("auditQueueId"), 120),
    accountMessageId: cleanOptional(url.searchParams.get("accountMessageId"), 120),
    accountId: cleanOptional(url.searchParams.get("accountId"), 120),
    q: cleanOptional(url.searchParams.get("q"), 120),
    limit: Number(url.searchParams.get("limit") || 50),
  };
}

export async function buildPass2366PaymentEvidenceSnapshot(filter: PaymentRuntimeEvidenceFilter = {}) {
  const base = buildPaymentRuntimeEvidenceSnapshot();
  const durable = await listDurablePaymentRuntimeEvidence(filter);
  const linkedAuditQueueCount = durable.records.filter((record) => record.auditQueueId).length;
  const linkedAccountMessageCount = durable.records.filter((record) => record.accountMessageId || record.accountId).length;
  const statusCounts = durable.records.reduce<Record<PaymentRuntimeEvidenceStatus, number>>((acc, record) => {
    acc[record.status] = (acc[record.status] ?? 0) + 1;
    return acc;
  }, { pass: 0, fail: 0, manual: 0, blocked: 0 });

  return {
    ...base,
    schemaVersion: "velmere-payment-runtime-evidence-v2-pass2366",
    passId: PASS2366_DURABLE_PAYMENT_EVIDENCE_ID,
    durableSource: durable.source,
    durableStorageReady: hasSupabaseServiceRoleConfig(),
    durableRecordCount: durable.records.length,
    linkedAuditQueueCount,
    linkedAccountMessageCount,
    statusCounts,
    filters: filter,
    recent: durable.records,
    storageWritePerformed: durable.records.length > 0,
    durableBoundary:
      "PASS2366 stores redacted payment evidence rows that can be filtered by status, scenario, auditQueueId, accountMessageId and accountId. It never stores raw Stripe payloads, raw headers, card data, BLIK codes, secrets, raw IPs or unredacted customer PII.",
  };
}
