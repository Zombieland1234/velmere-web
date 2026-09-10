import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { AuditAccountMessageRecord } from "@/lib/account/audit-account-messages";
import type { Pass2376FinalDeliveryGateSnapshot } from "@/lib/security/final-delivery-gate";

export const PASS2377_DELIVERY_RECEIPT_LEDGER_ID = "pass2377-final-delivery-immutable-receipt-ledger" as const;

export type Pass2377DeliveryReceiptSource = "supabase" | "memory";
export type Pass2377DeliveryReceiptStatus = "delivered" | "blocked" | "manual_review";

export type Pass2377DeliveryReceiptRecord = {
  receiptId: string;
  passId: typeof PASS2377_DELIVERY_RECEIPT_LEDGER_ID;
  status: Pass2377DeliveryReceiptStatus;
  locale: "pl" | "en" | "de";
  deliveredAt: string;
  createdAt: string;
  operatorId: string;
  messageId?: string;
  requestId?: string;
  auditQueueId?: string;
  accountMessageId?: string;
  accountId?: string;
  reportId?: string;
  customerSafeReportStatus?: string;
  gateSnapshot: {
    passId: string;
    canDeliver: boolean;
    endpointPingFresh: boolean;
    routeHealthAllowed: boolean;
    zeroBlockedWarnings: boolean;
    zeroStaleWarnings: boolean;
    blockedWarningCount: number;
    staleWarningCount: number;
    lastEndpointPingAt?: string;
    lastEndpointPingAgeMinutes?: number;
    focusKey: string;
  };
  customerSafeLinks: {
    accountRoute: string;
    customerReportRoute?: string;
    safePdfPacketRoute?: string;
    adminReplayBoardRoute?: string;
  };
  checksum: string;
  safeBoundary: string;
  source: Pass2377DeliveryReceiptSource;
};

export type Pass2377DeliveryReceiptLedgerSnapshot = {
  ok: boolean;
  passId: typeof PASS2377_DELIVERY_RECEIPT_LEDGER_ID;
  generatedAt: string;
  source: Pass2377DeliveryReceiptSource;
  durableStorageReady: boolean;
  receiptCount: number;
  latestReceipt?: Pass2377DeliveryReceiptRecord;
  canShowToCustomer: boolean;
  immutableReceiptRequired: boolean;
  deliveryReceiptReady: boolean;
  status: "not_delivered" | "receipt_ready" | "missing_receipt";
  recommendedAction: string;
  safeBoundary: string;
};

const TABLE_NAME = "velmere_audit_delivery_receipts";
const memoryStore = new Map<string, Pass2377DeliveryReceiptRecord>();
const MAX_MEMORY_RECORDS = 160;

function nowIso() {
  return new Date().toISOString();
}

function stableHash(value: string) {
  return sha256Token(value, 24);
}

function normalizeLocale(value: unknown): "pl" | "en" | "de" {
  return value === "pl" || value === "de" || value === "en" ? value : "en";
}

function cleanToken(value: unknown, max = 180): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[<>{}[\]`$\\]/g, " ")
    .replace(/\b(?:sk_live|pk_live|sk_test|pk_test|whsec|Bearer)\b[^\s]*/gi, "[redacted]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card-like]")
    .replace(/\b\d{6}\b/g, "[redacted-code]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return cleaned || undefined;
}

function safeRoute(route: unknown, fallback: string) {
  const value = cleanToken(route, 360);
  if (!value) return fallback;
  if (/^(javascript|data):/i.test(value)) return fallback;
  return value;
}

function receiptKey(input: {
  messageId?: string;
  requestId?: string;
  accountId?: string;
  deliveredAt: string;
  operatorId: string;
}) {
  return stableHash(`${input.messageId ?? "message"}:${input.requestId ?? "request"}:${input.accountId ?? "account"}:${input.deliveredAt}:${input.operatorId}`).slice(0, 18);
}

function checksumFor(record: Omit<Pass2377DeliveryReceiptRecord, "checksum" | "source">) {
  return `vlmrcpt_${stableHash(JSON.stringify({
    receiptId: record.receiptId,
    deliveredAt: record.deliveredAt,
    operatorId: record.operatorId,
    messageId: record.messageId,
    requestId: record.requestId,
    auditQueueId: record.auditQueueId,
    accountMessageId: record.accountMessageId,
    accountId: record.accountId,
    gateSnapshot: record.gateSnapshot,
    links: record.customerSafeLinks,
  })).slice(0, 18)}`;
}

function buildSafeBoundary() {
  return "PASS2377 delivery receipt ledger stores only immutable receipt id, redacted request/account refs, final-delivery gate snapshot, operator id, deliveredAt and customer-safe links. It never stores raw Stripe payloads, webhook bodies, BLIK codes, card data, secrets, seed phrases, exploit instructions, Certified Safe claims or investment advice.";
}

function buildReceipt(input: {
  message: AuditAccountMessageRecord;
  operatorId: string;
  finalDeliveryGate: Pass2376FinalDeliveryGateSnapshot;
  adminReplayBoardRoute?: string;
}): Omit<Pass2377DeliveryReceiptRecord, "checksum" | "source"> {
  const deliveredAt = cleanToken(input.message.deliveredAt, 90) ?? nowIso();
  const operatorId = cleanToken(input.operatorId, 120) ?? "security-admin";
  const locale = normalizeLocale(input.message.locale);
  const safeId = encodeURIComponent(input.message.id || input.message.requestId || "sample");
  const messageId = cleanToken(input.message.id, 160);
  const requestId = cleanToken(input.message.requestId, 160);
  const accountId = cleanToken(input.message.accountId, 160);
  const auditQueueId = cleanToken(input.message.auditQueueId, 160);
  const receiptId = `vlm_delivery_${receiptKey({ messageId, requestId, accountId, deliveredAt, operatorId })}`;
  const accountRoute = `/${locale}/account?tab=messages`;
  const customerReportRoute = safeRoute(input.message.customerSafeReport?.publicReportRoute ?? input.message.publicReportRoute, `/${locale}/security/audits/customer-report/${safeId}`);
  const safePdfPacketRoute = safeRoute(input.message.customerSafeReport?.pdfRoute ?? input.message.pdfRoute ?? input.message.exportRoute, `/api/security/audit-watch/customer-safe-report?id=${safeId}&locale=${locale}&format=pdf-safe`);
  const adminReplayBoardRoute = safeRoute(input.adminReplayBoardRoute, `/${locale}/admin/security${auditQueueId ? `?auditQueueId=${encodeURIComponent(auditQueueId)}` : ""}#pass2367-live-payment-evidence-rows`);

  return {
    receiptId,
    passId: PASS2377_DELIVERY_RECEIPT_LEDGER_ID,
    status: input.finalDeliveryGate.canDeliver || input.message.operatorStatus === "delivered" ? "delivered" : "blocked",
    locale,
    deliveredAt,
    createdAt: nowIso(),
    operatorId,
    messageId,
    requestId,
    auditQueueId,
    accountMessageId: messageId,
    accountId,
    reportId: cleanToken(input.message.customerSafeReport?.reportId, 160) ?? messageId,
    customerSafeReportStatus: cleanToken(input.message.customerSafeReport?.status, 80) ?? cleanToken(input.message.operatorStatus, 80),
    gateSnapshot: {
      passId: input.finalDeliveryGate.passId,
      canDeliver: Boolean(input.finalDeliveryGate.canDeliver),
      endpointPingFresh: Boolean(input.finalDeliveryGate.endpointPingFresh),
      routeHealthAllowed: Boolean(input.finalDeliveryGate.routeHealthAllowed),
      zeroBlockedWarnings: Boolean(input.finalDeliveryGate.zeroBlockedWarnings),
      zeroStaleWarnings: Boolean(input.finalDeliveryGate.zeroStaleWarnings),
      blockedWarningCount: Number(input.finalDeliveryGate.blockedWarningCount ?? 0),
      staleWarningCount: Number(input.finalDeliveryGate.staleWarningCount ?? 0),
      lastEndpointPingAt: cleanToken(input.finalDeliveryGate.lastEndpointPingAt, 90),
      lastEndpointPingAgeMinutes: input.finalDeliveryGate.lastEndpointPingAgeMinutes,
      focusKey: cleanToken(input.finalDeliveryGate.focusKey, 120) ?? "route_unknown",
    },
    customerSafeLinks: {
      accountRoute,
      customerReportRoute,
      safePdfPacketRoute,
      adminReplayBoardRoute,
    },
    safeBoundary: buildSafeBoundary(),
  };
}

function rowFromRecord(record: Pass2377DeliveryReceiptRecord) {
  return {
    id: record.receiptId,
    receipt_id: record.receiptId,
    status: record.status,
    locale: record.locale,
    delivered_at: record.deliveredAt,
    operator_id: record.operatorId,
    message_id: record.messageId,
    request_id: record.requestId,
    audit_queue_id: record.auditQueueId,
    account_message_id: record.accountMessageId,
    account_id: record.accountId,
    report_id: record.reportId,
    customer_safe_report_status: record.customerSafeReportStatus,
    gate_snapshot: record.gateSnapshot,
    customer_safe_links: record.customerSafeLinks,
    checksum: record.checksum,
    safe_boundary: record.safeBoundary,
    record: { ...record, source: undefined },
    created_at: record.createdAt,
  };
}

function recordFromRow(row: Record<string, unknown>, source: Pass2377DeliveryReceiptSource): Pass2377DeliveryReceiptRecord {
  const raw = (row.record ?? {}) as Partial<Pass2377DeliveryReceiptRecord>;
  return {
    receiptId: cleanToken(row.receipt_id ?? row.id ?? raw.receiptId, 160) ?? `vlm_delivery_${Date.now()}`,
    passId: PASS2377_DELIVERY_RECEIPT_LEDGER_ID,
    status: row.status === "delivered" || row.status === "blocked" || row.status === "manual_review" ? row.status : raw.status ?? "blocked",
    locale: normalizeLocale(row.locale ?? raw.locale),
    deliveredAt: cleanToken(row.delivered_at ?? raw.deliveredAt, 90) ?? nowIso(),
    createdAt: cleanToken(row.created_at ?? raw.createdAt, 90) ?? nowIso(),
    operatorId: cleanToken(row.operator_id ?? raw.operatorId, 120) ?? "security-admin",
    messageId: cleanToken(row.message_id ?? raw.messageId, 160),
    requestId: cleanToken(row.request_id ?? raw.requestId, 160),
    auditQueueId: cleanToken(row.audit_queue_id ?? raw.auditQueueId, 160),
    accountMessageId: cleanToken(row.account_message_id ?? raw.accountMessageId, 160),
    accountId: cleanToken(row.account_id ?? raw.accountId, 160),
    reportId: cleanToken(row.report_id ?? raw.reportId, 160),
    customerSafeReportStatus: cleanToken(row.customer_safe_report_status ?? raw.customerSafeReportStatus, 80),
    gateSnapshot: ((row.gate_snapshot ?? raw.gateSnapshot ?? {}) as Pass2377DeliveryReceiptRecord["gateSnapshot"]),
    customerSafeLinks: ((row.customer_safe_links ?? raw.customerSafeLinks ?? {}) as Pass2377DeliveryReceiptRecord["customerSafeLinks"]),
    checksum: cleanToken(row.checksum ?? raw.checksum, 80) ?? "vlmrcpt_missing",
    safeBoundary: cleanToken(row.safe_boundary ?? raw.safeBoundary, 700) ?? buildSafeBoundary(),
    source,
  };
}

function remember(record: Pass2377DeliveryReceiptRecord) {
  memoryStore.set(record.receiptId, record);
  const sorted = Array.from(memoryStore.values()).sort((a, b) => Date.parse(b.deliveredAt) - Date.parse(a.deliveredAt));
  for (const stale of sorted.slice(MAX_MEMORY_RECORDS)) memoryStore.delete(stale.receiptId);
}

function memoryMatches(record: Pass2377DeliveryReceiptRecord, input: Pass2377DeliveryReceiptFilter) {
  if (input.receiptId && record.receiptId !== input.receiptId) return false;
  if (input.messageId && record.messageId !== input.messageId && record.accountMessageId !== input.messageId) return false;
  if (input.requestId && record.requestId !== input.requestId) return false;
  if (input.auditQueueId && record.auditQueueId !== input.auditQueueId) return false;
  if (input.accountId && record.accountId !== input.accountId) return false;
  return true;
}

export type Pass2377DeliveryReceiptFilter = {
  receiptId?: string;
  messageId?: string;
  requestId?: string;
  auditQueueId?: string;
  accountId?: string;
  limit?: number;
};

export async function createPass2377DeliveryReceipt(input: {
  message: AuditAccountMessageRecord;
  operatorId: string;
  finalDeliveryGate: Pass2376FinalDeliveryGateSnapshot;
  adminReplayBoardRoute?: string;
}): Promise<{ record: Pass2377DeliveryReceiptRecord; source: Pass2377DeliveryReceiptSource; durableWrite: boolean }> {
  const base = buildReceipt(input);
  const record: Pass2377DeliveryReceiptRecord = {
    ...base,
    checksum: checksumFor(base),
    source: "memory",
  };
  const supabase = getSupabaseServiceRoleClient();
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(rowFromRecord({ ...record, source: "supabase" }), { onConflict: "receipt_id" })
      .select("*")
      .maybeSingle();
    if (!error && data) return { record: recordFromRow(data, "supabase"), source: "supabase", durableWrite: true };
  }
  remember(record);
  return { record, source: "memory", durableWrite: false };
}

export async function listPass2377DeliveryReceipts(input: Pass2377DeliveryReceiptFilter = {}): Promise<{ source: Pass2377DeliveryReceiptSource; records: Pass2377DeliveryReceiptRecord[] }> {
  const limit = Math.max(1, Math.min(Number(input.limit ?? 8), 24));
  const receiptId = cleanToken(input.receiptId, 160);
  const messageId = cleanToken(input.messageId, 160);
  const requestId = cleanToken(input.requestId, 160);
  const auditQueueId = cleanToken(input.auditQueueId, 160);
  const accountId = cleanToken(input.accountId, 160);
  const supabase = getSupabaseServiceRoleClient();
  if (supabase) {
    let query = supabase.from(TABLE_NAME).select("*").order("delivered_at", { ascending: false }).limit(limit);
    if (receiptId) query = query.eq("receipt_id", receiptId);
    if (messageId) query = query.or(`message_id.eq.${messageId},account_message_id.eq.${messageId}`);
    if (requestId) query = query.eq("request_id", requestId);
    if (auditQueueId) query = query.eq("audit_queue_id", auditQueueId);
    if (accountId) query = query.eq("account_id", accountId);
    const { data, error } = await query;
    if (!error && Array.isArray(data)) return { source: "supabase", records: data.map((row) => recordFromRow(row, "supabase")) };
  }
  const records = Array.from(memoryStore.values())
    .filter((record) => memoryMatches(record, { receiptId, messageId, requestId, auditQueueId, accountId }))
    .sort((a, b) => Date.parse(b.deliveredAt) - Date.parse(a.deliveredAt))
    .slice(0, limit);
  return { source: "memory", records };
}

export async function buildPass2377DeliveryReceiptLedger(input: {
  message?: AuditAccountMessageRecord | null;
  finalDeliveryGate?: Pass2376FinalDeliveryGateSnapshot;
  limit?: number;
}): Promise<Pass2377DeliveryReceiptLedgerSnapshot> {
  const message = input.message ?? null;
  const result = await listPass2377DeliveryReceipts({
    messageId: message?.id,
    requestId: message?.requestId,
    auditQueueId: message?.auditQueueId,
    accountId: message?.accountId,
    limit: input.limit ?? 6,
  });
  const latestReceipt = result.records[0];
  const delivered = message?.operatorStatus === "delivered" || message?.customerSafeReport?.status === "delivered";
  const deliveryReceiptReady = Boolean(latestReceipt?.receiptId && latestReceipt.status === "delivered" && latestReceipt.checksum);
  const status = delivered ? (deliveryReceiptReady ? "receipt_ready" : "missing_receipt") : "not_delivered";
  return {
    ok: !delivered || deliveryReceiptReady,
    passId: PASS2377_DELIVERY_RECEIPT_LEDGER_ID,
    generatedAt: nowIso(),
    source: result.source,
    durableStorageReady: hasSupabaseServiceRoleConfig(),
    receiptCount: result.records.length,
    latestReceipt,
    canShowToCustomer: deliveryReceiptReady,
    immutableReceiptRequired: delivered,
    deliveryReceiptReady,
    status,
    recommendedAction: status === "receipt_ready"
      ? "Delivery receipt exists; customer-safe account card may show deliveredAt, receipt id and safe report/PDF links."
      : status === "missing_receipt"
        ? "Do not call this final until the immutable delivery receipt is written after the final delivery gate."
        : "No final delivery yet; receipt will be generated only after deliver_customer_safe_report passes the gate.",
    safeBoundary: buildSafeBoundary(),
  };
}

export async function attachPass2377DeliveryReceiptSummaries<T extends { id?: string; requestId?: string; auditQueueId?: string; accountId?: string }>(messages: T[]): Promise<Array<T & { deliveryReceipt?: Pass2377DeliveryReceiptRecord }>> {
  return Promise.all(messages.map(async (message) => {
    const result = await listPass2377DeliveryReceipts({
      messageId: message.id,
      requestId: message.requestId,
      auditQueueId: message.auditQueueId,
      accountId: message.accountId,
      limit: 1,
    });
    return { ...message, deliveryReceipt: result.records[0] };
  }));
}
