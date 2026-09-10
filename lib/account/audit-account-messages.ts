import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VlmAuditAccountMessage, VlmAuditMessageStatus } from "@/lib/security/vlm-audit-product";
import { migratePass4820AuditCustomerSafeReport, PASS4820_AUDIT_CUSTOMER_SAFE_REPORT_SCHEMA } from "@/lib/security/audit-customer-safe-report-migration";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import {
  hasExactAuditAccountArtifactBinding,
  verifyAuditAccountCustomerSnapshot,
  type AuditAccountCustomerSnapshot,
} from "@/lib/security/audit-account-customer-snapshot";
import { normalizeLegacyAuditQueueState } from "@/lib/commerce/vlm-current-sku-truth";

export const PASS2360_AUDIT_ACCOUNT_DELIVERY_ID = "pass2360-audit-account-message-delivery-spine" as const;
export const PASS2361_AUDIT_OPERATOR_ACTIONS_ID = "pass2361-audit-operator-actions-customer-safe-delivery" as const;
export const PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID = "customer-safe-report-route-auto-sync" as const;

const TABLE_NAME = "velmere_audit_account_messages";
const P84_AUDIT_CUSTOMER_ARTIFACT_LINK_TABLE = "velmere_audit_customer_artifact_links";
const P84_AUDIT_CUSTOMER_ARTIFACT_LINK_SELECT = [
  "schema_version",
  "snapshot_id",
  "message_id",
  "account_id",
  "account_id_hash",
  "audit_snapshot_digest",
  "artifact_snapshot_digest",
  "artifact_digest",
  "pdf_blob_id",
  "pdf_digest",
  "linked_at",
  "created_at",
].join(",");
const memoryStore = new Map<string, AuditAccountMessageRecord>();

export const PASS2624_ACCOUNT_DELIVERY_PRODUCTION_LOCK_ERROR = "VELMERE_AUDIT_DELIVERY_PRODUCTION_SUPABASE_REQUIRED" as const;
export const PASS4821_ACCOUNT_OWNER_REQUIRED_ERROR = "VELMERE_AUDIT_ACCOUNT_OWNER_REQUIRED" as const;

export function isAuditAccountDeliveryProductionStorageStrict() {
  return process.env.NODE_ENV === "production";
}

export function assertAuditAccountDeliveryDurableStorage(source?: string | null) {
  if (!isAuditAccountDeliveryProductionStorageStrict()) return;
  if (source === "supabase" || hasSupabaseServiceRoleConfig()) return;
  throw new Error(PASS2624_ACCOUNT_DELIVERY_PRODUCTION_LOCK_ERROR);
}


export type AuditAccountMessageSource = "supabase" | "memory";
export type AuditAccountDeliveryStatus =
  | "queued"
  | "delivered_to_account"
  | "analysis_queue"
  | "ready_for_download"
  // Legacy values are accepted only at persistence boundaries and normalized before customer output.
  | "waiting_payment"
  | "human_review_queue";
export type AuditOperatorStatus =
  | "intake"
  | "analysis_queue"
  | "automated_analysis"
  // Legacy value retained for database compatibility; normalizers never emit it.
  | "human_review"
  | "needs_evidence"
  | "pdf_attached"
  | "customer_safe_ready"
  | "delivered"
  | "blocked_redaction";
export type AuditOperatorActionType =
  | "mark_analysis"
  // Legacy action accepted on old admin clients and normalized to mark_analysis.
  | "mark_human_review"
  | "request_evidence"
  | "attach_pdf"
  | "mark_ready"
  | "deliver_customer_safe_report"
  | "block_redaction";

export type AuditAccountOperatorAction = {
  id: string;
  action: AuditOperatorActionType;
  at: string;
  operatorId: string;
  note?: string;
  nextStatus: AuditOperatorStatus;
  customerSafe: boolean;
  pdfRoute?: string;
};

export type AuditCustomerSafeReport = {
  schemaVersion: typeof PASS4820_AUDIT_CUSTOMER_SAFE_REPORT_SCHEMA;
  migratedFrom: "legacy-pass2361" | "pass4820-native";
  passId: typeof PASS2361_AUDIT_OPERATOR_ACTIONS_ID;
  reportId: string;
  requestId: string;
  title: string;
  summary: string;
  status: "draft" | "ready" | "delivered";
  pdfRoute?: string;
  publicReportRoute?: string;
  sections: string[];
  forbidden: string[];
  deliveredAt?: string;
  operatorNote?: string;
};

export const P84_AUDIT_CUSTOMER_ARTIFACT_LINK_SCHEMA =
  "p84-audit-customer-artifact-link-v1" as const;

export type P84AuditCustomerArtifactLinkRecord = {
  schemaVersion: typeof P84_AUDIT_CUSTOMER_ARTIFACT_LINK_SCHEMA;
  snapshotId: string;
  messageId: string;
  accountId: string;
  accountIdHash: string;
  auditSnapshotDigest: string;
  artifactSnapshotDigest: string;
  artifactDigest: string;
  pdfBlobId: string;
  pdfDigest: string;
  linkedAt: string;
  createdAt: string;
};

export type AuditAccountMessageRecord = VlmAuditAccountMessage & {
  accountId: string;
  contactEmail?: string;
  locale: "pl" | "en" | "de";
  reviewLevel?: string;
  projectName?: string;
  contractAddress?: string;
  publicReportRoute?: string;
  adminRoute?: string;
  exportRoute?: string;
  pdfRoute?: string;
  deliveryChannel: "account" | "account_and_email_pending";
  deliveryStatus: AuditAccountDeliveryStatus;
  operatorStatus: AuditOperatorStatus;
  operatorNote?: string;
  customerSafeReport?: AuditCustomerSafeReport;
  canonicalCustomerSnapshot?: AuditAccountCustomerSnapshot;
  actionLog: AuditAccountOperatorAction[];
  source: AuditAccountMessageSource;
  updatedAt: string;
  deliveredAt?: string;
  auditQueueId?: string;
  auditCaseRef?: string;
  paymentEvidenceRefs?: string[];
};

export type StoreAuditAccountMessageInput = {
  message: VlmAuditAccountMessage;
  accountId?: string;
  contactEmail?: string;
  locale?: string;
  reviewLevel?: string;
  projectName?: string;
  contractAddress?: string;
  publicReportRoute?: string;
  adminRoute?: string;
  exportRoute?: string;
  auditQueueId?: string;
  auditCaseRef?: string;
  paymentEvidenceRefs?: string[];
  canonicalCustomerSnapshot?: AuditAccountCustomerSnapshot;
};

export type ListAuditAccountMessagesInput = {
  accountId?: string;
  contactEmail?: string;
  locale?: string;
  limit?: number;
};

export type ListAuditAccountMessagesDependencies = {
  getSupabaseServiceRoleClient: typeof getSupabaseServiceRoleClient;
};

const defaultListAuditAccountMessagesDependencies:
  ListAuditAccountMessagesDependencies = {
    getSupabaseServiceRoleClient,
  };

export type UpdateAuditAccountMessageInput = {
  messageId?: string;
  requestId?: string;
  action: AuditOperatorActionType;
  locale?: string;
  operatorId?: string;
  operatorNote?: string;
  pdfRoute?: string;
  publicReportRoute?: string;
  exportRoute?: string;
  auditQueueId?: string;
  paymentEvidenceRefs?: string[];
};

function resolveLocale(locale?: string): "pl" | "en" | "de" {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function cleanText(value: unknown, max = 240): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/[<>]/g, "").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function cleanEmail(value: unknown): string | undefined {
  const text = cleanText(value, 160)?.toLowerCase();
  if (!text || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return undefined;
  return text;
}

function normalizeP84LinkInstant(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`audit_customer_artifact_link_${field}_invalid`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`audit_customer_artifact_link_${field}_invalid`);
  return parsed.toISOString();
}

function hasExactObjectKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function parseP84AuditCustomerArtifactLinkRow(
  row: unknown,
  expected?: { accountId?: string; snapshotId?: string },
): P84AuditCustomerArtifactLinkRecord {
  const rowKeys = P84_AUDIT_CUSTOMER_ARTIFACT_LINK_SELECT.split(",");
  if (!hasExactObjectKeys(row, rowKeys)) throw new Error("audit_customer_artifact_link_row_shape_invalid");

  const schemaVersion = row.schema_version;
  const snapshotId = row.snapshot_id;
  const messageId = row.message_id;
  const accountId = row.account_id;
  const accountIdHash = row.account_id_hash;
  const auditSnapshotDigest = row.audit_snapshot_digest;
  const artifactSnapshotDigest = row.artifact_snapshot_digest;
  const artifactDigest = row.artifact_digest;
  const pdfBlobId = row.pdf_blob_id;
  const pdfDigest = row.pdf_digest;
  const linkedAt = normalizeP84LinkInstant(row.linked_at, "linked_at");
  const createdAt = normalizeP84LinkInstant(row.created_at, "created_at");
  const digestPattern = /^sha256:[a-f0-9]{64}$/u;

  if (schemaVersion !== P84_AUDIT_CUSTOMER_ARTIFACT_LINK_SCHEMA
    || typeof snapshotId !== "string"
    || !/^artifact-audit-[a-f0-9]{16}-[a-f0-9]{64}$/u.test(snapshotId)
    || typeof messageId !== "string"
    || messageId.length < 1
    || messageId.length > 160
    || typeof accountId !== "string"
    || accountId.length < 1
    || accountId.length > 120
    || accountId.startsWith("preview:")
    || typeof accountIdHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(accountIdHash)
    || accountIdHash !== hashVelmereAccountBinding(accountId)
    || typeof auditSnapshotDigest !== "string"
    || !digestPattern.test(auditSnapshotDigest)
    || typeof artifactSnapshotDigest !== "string"
    || !digestPattern.test(artifactSnapshotDigest)
    || typeof artifactDigest !== "string"
    || !digestPattern.test(artifactDigest)
    || typeof pdfBlobId !== "string"
    || !/^pdf-[a-f0-9]{16}-[a-f0-9]{64}$/u.test(pdfBlobId)
    || typeof pdfDigest !== "string"
    || !digestPattern.test(pdfDigest)
    || linkedAt !== createdAt
    || (expected?.accountId !== undefined && accountId !== expected.accountId)
    || (expected?.snapshotId !== undefined && snapshotId !== expected.snapshotId)) {
    throw new Error("audit_customer_artifact_link_row_integrity_invalid");
  }

  return {
    schemaVersion,
    snapshotId,
    messageId,
    accountId,
    accountIdHash,
    auditSnapshotDigest,
    artifactSnapshotDigest,
    artifactDigest,
    pdfBlobId,
    pdfDigest,
    linkedAt,
    createdAt,
  };
}

function accountIdFor(input?: { accountId?: string; contactEmail?: string }) {
  const explicit = cleanText(input?.accountId, 120);
  if (explicit) return explicit;
  const email = cleanEmail(input?.contactEmail);
  if (email) return `email:${email}`;
  return "preview:local-member-preview";
}

function normalizeDeliveryStatus(value: unknown): AuditAccountDeliveryStatus {
  const status = String(value ?? "delivered_to_account");
  if (status === "ready_for_download") return "ready_for_download";
  if (status === "queued" || status === "delivered_to_account") return status;
  if (status === "analysis_queue" || status === "waiting_payment" || status === "human_review_queue") return "analysis_queue";
  return "delivered_to_account";
}

function normalizeOperatorStatus(value: unknown): AuditOperatorStatus {
  const normalized = normalizeLegacyAuditQueueState(value);
  if (normalized === "analysis_queue" || normalized === "automated_analysis" || normalized === "needs_evidence" || normalized === "pdf_attached" || normalized === "customer_safe_ready" || normalized === "delivered" || normalized === "blocked_redaction" || normalized === "intake") return normalized;
  return "intake";
}

function deliveryStatusFor(message: VlmAuditAccountMessage): AuditAccountDeliveryStatus {
  if (message.status === "payment_pending" || message.status === "human_review" || message.status === "analysis_queue") return "analysis_queue";
  if (message.status === "ready") return "ready_for_download";
  return "delivered_to_account";
}

function operatorStatusFor(message: VlmAuditAccountMessage): AuditOperatorStatus {
  if (message.status === "payment_pending" || message.status === "analysis_queue") return "analysis_queue";
  if (message.status === "human_review") return "automated_analysis";
  if (message.status === "ready") return "customer_safe_ready";
  if (message.status === "needs_evidence") return "needs_evidence";
  return "intake";
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalizeActionLog(value: unknown): AuditAccountOperatorAction[] {
  if (!Array.isArray(value)) return [];
  const actions: AuditAccountOperatorAction[] = [];
  for (const entry of value) {
    const raw = entry as Partial<AuditAccountOperatorAction>;
    const rawAction = String(raw.action ?? "") as AuditOperatorActionType;
    if (!["mark_analysis", "mark_human_review", "request_evidence", "attach_pdf", "mark_ready", "deliver_customer_safe_report", "block_redaction"].includes(rawAction)) continue;
    const action: AuditOperatorActionType = rawAction === "mark_human_review" ? "mark_analysis" : rawAction;
    actions.push({
      id: String(raw.id ?? `action-${Date.now()}`),
      action,
      at: String(raw.at ?? new Date().toISOString()),
      operatorId: String(raw.operatorId ?? "security-admin"),
      note: cleanText(raw.note, 600),
      nextStatus: normalizeOperatorStatus(raw.nextStatus),
      customerSafe: Boolean(raw.customerSafe),
      pdfRoute: cleanText(raw.pdfRoute, 300),
    });
  }
  return actions;
}

function normalizeCustomerSafeReport(value: unknown): AuditCustomerSafeReport | undefined {
  const migrated = migratePass4820AuditCustomerSafeReport(value, {
    reportId: "VLM-AUDIT",
    requestId: "request",
    title: "Velmère customer-safe audit report",
    summary: "Customer-safe, internally quality-controlled summary without exploit instructions, human-review claims or safety guarantees.",
  });
  if (!migrated) return undefined;
  return {
    ...migrated,
    passId: PASS2361_AUDIT_OPERATOR_ACTIONS_ID,
  };
}

function normalizeCanonicalCustomerSnapshot(value: unknown, accountId: string): AuditAccountCustomerSnapshot | undefined {
  if (!verifyAuditAccountCustomerSnapshot(value)) return undefined;
  const snapshot = value as AuditAccountCustomerSnapshot;
  return snapshot.accountIdHash === hashVelmereAccountBinding(accountId) ? snapshot : undefined;
}

export function buildAuditAccountMessageRecord(
  input: StoreAuditAccountMessageInput,
  source: AuditAccountMessageSource = "memory",
): AuditAccountMessageRecord {
  const now = new Date().toISOString();
  const contactEmail = cleanEmail(input.contactEmail);
  const locale = resolveLocale(input.locale);
  const accountId = accountIdFor({ accountId: input.accountId, contactEmail });
  const canonicalCustomerSnapshot = normalizeCanonicalCustomerSnapshot(input.canonicalCustomerSnapshot, accountId);
  if (input.canonicalCustomerSnapshot && !canonicalCustomerSnapshot) throw new Error("audit_account_customer_snapshot_invalid_or_owner_mismatch");
  return {
    ...input.message,
    accountId,
    contactEmail,
    locale,
    reviewLevel: cleanText(input.reviewLevel, 80),
    projectName: cleanText(input.projectName, 120),
    contractAddress: cleanText(input.contractAddress, 120),
    publicReportRoute: cleanText(input.publicReportRoute, 260),
    adminRoute: cleanText(input.adminRoute, 260),
    exportRoute: cleanText(input.exportRoute, 260),
    pdfRoute: cleanText(input.exportRoute, 260),
    auditQueueId: cleanText(input.auditQueueId, 160),
    auditCaseRef: cleanText(input.auditCaseRef, 160)?.toUpperCase(),
    paymentEvidenceRefs: Array.isArray(input.paymentEvidenceRefs) ? input.paymentEvidenceRefs.map((item) => cleanText(item, 160)).filter((item): item is string => Boolean(item)).slice(0, 20) : [],
    deliveryChannel: contactEmail ? "account_and_email_pending" : "account",
    deliveryStatus: deliveryStatusFor(input.message),
    operatorStatus: operatorStatusFor(input.message),
    operatorNote: undefined,
    customerSafeReport: undefined,
    canonicalCustomerSnapshot,
    actionLog: [],
    source,
    updatedAt: now,
  };
}

export function parseAuditAccountMessageSupabaseRow(row: Record<string, unknown>): AuditAccountMessageRecord {
  const rawMessage = (row.message ?? {}) as Partial<AuditAccountMessageRecord>;
  const createdAt = String(row.created_at ?? rawMessage.createdAt ?? new Date().toISOString());
  const fallbackStatus = (row.message_status ?? rawMessage.status ?? "queued") as VlmAuditMessageStatus;
  const deliveryStatus = normalizeDeliveryStatus(row.delivery_status ?? rawMessage.deliveryStatus);
  const operatorStatus = normalizeOperatorStatus(row.operator_status ?? rawMessage.operatorStatus);
  const actionLog = normalizeActionLog(row.action_log ?? rawMessage.actionLog);
  const customerSafeReport = normalizeCustomerSafeReport(row.customer_safe_report ?? rawMessage.customerSafeReport);
  const accountId = String(row.account_id ?? rawMessage.accountId ?? "preview:local-member-preview");
  const rawCanonicalCustomerSnapshot = row.canonical_customer_snapshot ?? rawMessage.canonicalCustomerSnapshot;
  const canonicalCustomerSnapshot = normalizeCanonicalCustomerSnapshot(rawCanonicalCustomerSnapshot, accountId);
  const storedSnapshotDigest = cleanText(row.canonical_customer_snapshot_digest, 80);
  if (rawCanonicalCustomerSnapshot && !canonicalCustomerSnapshot) throw new Error("audit_account_customer_snapshot_integrity_failed");
  if (canonicalCustomerSnapshot && storedSnapshotDigest && canonicalCustomerSnapshot.snapshotDigest !== storedSnapshotDigest) throw new Error("audit_account_customer_snapshot_digest_mismatch");

  return {
    id: String(row.message_id ?? rawMessage.id ?? row.id),
    title: String(rawMessage.title ?? row.title ?? "Velmère Audit"),
    body: String(rawMessage.body ?? row.body ?? "Audit message"),
    status: fallbackStatus,
    packageLabel: String(rawMessage.packageLabel ?? row.package_label ?? "Velmère Audit"),
    requestId: String(rawMessage.requestId ?? row.request_id ?? row.id),
    createdAt,
    eta: String(rawMessage.eta ?? row.eta ?? "within 24h"),
    accountRoute: String(rawMessage.accountRoute ?? row.account_route ?? "/en/account?tab=messages"),
    nextSteps: Array.isArray(rawMessage.nextSteps) ? rawMessage.nextSteps.map(String) : [],
    accountId,
    contactEmail: cleanEmail(row.contact_email ?? rawMessage.contactEmail),
    locale: resolveLocale(cleanText(row.locale ?? rawMessage.locale, 12)),
    reviewLevel: cleanText(row.review_level ?? rawMessage.reviewLevel, 80),
    projectName: cleanText(row.project_name ?? rawMessage.projectName, 120),
    contractAddress: cleanText(row.contract_address ?? rawMessage.contractAddress, 120),
    publicReportRoute: cleanText(row.public_report_route ?? rawMessage.publicReportRoute, 260),
    adminRoute: cleanText(row.admin_route ?? rawMessage.adminRoute, 260),
    exportRoute: cleanText(row.export_route ?? rawMessage.exportRoute, 260),
    pdfRoute: cleanText(row.pdf_route ?? rawMessage.pdfRoute ?? row.export_route ?? rawMessage.exportRoute, 260),
    auditQueueId: cleanText(row.audit_queue_id ?? rawMessage.auditQueueId, 160),
    auditCaseRef: cleanText(rawMessage.auditCaseRef, 160)?.toUpperCase(),
    paymentEvidenceRefs: arrayOfStrings(row.payment_evidence_refs ?? rawMessage.paymentEvidenceRefs).slice(0, 20),
    deliveryChannel: row.delivery_channel === "account_and_email_pending" || rawMessage.deliveryChannel === "account_and_email_pending" ? "account_and_email_pending" : "account",
    deliveryStatus,
    operatorStatus,
    operatorNote: cleanText(row.operator_note ?? rawMessage.operatorNote, 600),
    customerSafeReport,
    canonicalCustomerSnapshot,
    actionLog,
    source: "supabase",
    updatedAt: String(row.updated_at ?? rawMessage.updatedAt ?? createdAt),
    deliveredAt: cleanText(row.delivered_at ?? rawMessage.deliveredAt, 80),
  };
}

export function buildAuditAccountMessageSupabaseRow(record: AuditAccountMessageRecord) {
  const { canonicalCustomerSnapshot: _canonicalSnapshot, ...messageWithoutCanonicalSnapshot } = record;
  return {
    id: record.id,
    message_id: record.id,
    request_id: record.requestId,
    account_id: record.accountId,
    contact_email: record.contactEmail ?? null,
    locale: record.locale,
    review_level: record.reviewLevel ?? null,
    project_name: record.projectName ?? null,
    contract_address: record.contractAddress ?? null,
    package_label: record.packageLabel,
    message_status: record.status,
    delivery_channel: record.deliveryChannel,
    delivery_status: record.deliveryStatus,
    operator_status: record.operatorStatus,
    operator_note: record.operatorNote ?? null,
    pdf_route: record.pdfRoute ?? null,
    public_report_route: record.publicReportRoute ?? null,
    admin_route: record.adminRoute ?? null,
    export_route: record.exportRoute ?? null,
    audit_queue_id: record.auditQueueId ?? null,
    payment_evidence_refs: record.paymentEvidenceRefs ?? [],
    customer_safe_report: record.customerSafeReport ?? null,
    canonical_customer_snapshot: record.canonicalCustomerSnapshot ?? null,
    canonical_customer_snapshot_digest: record.canonicalCustomerSnapshot?.snapshotDigest ?? null,
    action_log: record.actionLog,
    delivered_at: record.deliveredAt ?? null,
    message: messageWithoutCanonicalSnapshot,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export async function storeAuditAccountMessage(input: StoreAuditAccountMessageInput): Promise<{ record: AuditAccountMessageRecord; source: AuditAccountMessageSource }> {
  const supabase = getSupabaseServiceRoleClient();
  let candidate = buildAuditAccountMessageRecord(input, "memory");
  if (isAuditAccountDeliveryProductionStorageStrict() && candidate.accountId.startsWith("preview:")) {
    throw new Error(PASS4821_ACCOUNT_OWNER_REQUIRED_ERROR);
  }

  if (supabase) {
    const { data: existingData, error: existingError } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("id", candidate.id)
      .maybeSingle();
    if (existingError) {
      if (existingError.code === "PGRST205" && !isAuditAccountDeliveryProductionStorageStrict()) {
        const existingMemory = memoryStore.get(candidate.id);
        if (existingMemory && existingMemory.accountId !== candidate.accountId) {
          throw new Error("audit_account_message_owner_immutable_conflict");
        }
        if (existingMemory?.canonicalCustomerSnapshot && candidate.canonicalCustomerSnapshot && existingMemory.canonicalCustomerSnapshot.snapshotDigest !== candidate.canonicalCustomerSnapshot.snapshotDigest) {
          throw new Error("audit_account_customer_snapshot_immutable_conflict");
        }
        if (existingMemory?.canonicalCustomerSnapshot && !candidate.canonicalCustomerSnapshot) {
          candidate = { ...candidate, canonicalCustomerSnapshot: existingMemory.canonicalCustomerSnapshot };
        }
        memoryStore.set(candidate.id, candidate);
        return { record: candidate, source: "memory" };
      }
      throw new Error(`audit_account_message_existing_read_failed:${existingError.message}`);
    }
    if (existingData) {
      const existing = parseAuditAccountMessageSupabaseRow(existingData as Record<string, unknown>);
      if (existing.accountId !== candidate.accountId) {
        throw new Error("audit_account_message_owner_immutable_conflict");
      }
      if (existing.canonicalCustomerSnapshot && candidate.canonicalCustomerSnapshot && existing.canonicalCustomerSnapshot.snapshotDigest !== candidate.canonicalCustomerSnapshot.snapshotDigest) {
        throw new Error("audit_account_customer_snapshot_immutable_conflict");
      }
      if (existing.canonicalCustomerSnapshot && !candidate.canonicalCustomerSnapshot) {
        candidate = { ...candidate, canonicalCustomerSnapshot: existing.canonicalCustomerSnapshot };
      }
    }

    const supabaseRecord = { ...candidate, source: "supabase" as const };
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(buildAuditAccountMessageSupabaseRow(supabaseRecord), { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (!error && data) return { record: parseAuditAccountMessageSupabaseRow(data), source: "supabase" };
    if (error) throw new Error(`audit_account_message_durable_write_failed:${error.message}`);
    throw new Error("audit_account_message_durable_write_failed:no_row_returned");
  }

  const existingMemory = memoryStore.get(candidate.id);
  if (existingMemory && existingMemory.accountId !== candidate.accountId) {
    throw new Error("audit_account_message_owner_immutable_conflict");
  }
  if (existingMemory?.canonicalCustomerSnapshot && candidate.canonicalCustomerSnapshot && existingMemory.canonicalCustomerSnapshot.snapshotDigest !== candidate.canonicalCustomerSnapshot.snapshotDigest) {
    throw new Error("audit_account_customer_snapshot_immutable_conflict");
  }
  if (existingMemory?.canonicalCustomerSnapshot && !candidate.canonicalCustomerSnapshot) {
    candidate = { ...candidate, canonicalCustomerSnapshot: existingMemory.canonicalCustomerSnapshot };
  }
  assertAuditAccountDeliveryDurableStorage(null);
  memoryStore.set(candidate.id, candidate);
  return { record: candidate, source: "memory" };
}

export async function listAuditAccountMessages(
  input: ListAuditAccountMessagesInput = {},
  dependencies: ListAuditAccountMessagesDependencies =
    defaultListAuditAccountMessagesDependencies,
): Promise<{ messages: AuditAccountMessageRecord[]; source: AuditAccountMessageSource; accountId: string }> {
  const limit = Math.max(1, Math.min(Number(input.limit ?? 24), 50));
  const contactEmail = cleanEmail(input.contactEmail);
  const explicitAccountId = cleanText(input.accountId, 120);
  if (contactEmail && !explicitAccountId) {
    throw new Error("audit_account_message_account_id_required_for_email_scope");
  }
  const supabase = dependencies.getSupabaseServiceRoleClient();
  const accountId = accountIdFor({ accountId: input.accountId, contactEmail });
  const locale = resolveLocale(input.locale);

  if (supabase) {
    let query = supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("locale", locale)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (explicitAccountId) {
      query = query.eq("account_id", accountId);
      if (contactEmail) {
        query = query.eq("contact_email", contactEmail);
      }
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === "PGRST205" && !isAuditAccountDeliveryProductionStorageStrict()) {
        const messages = Array.from(memoryStore.values())
          .filter((message) => message.locale === locale)
          .filter((message) => {
            if (explicitAccountId) {
              return message.accountId === accountId
                && (!contactEmail || message.contactEmail === contactEmail);
            }
            return true;
          })
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
          .slice(0, limit);

        return { messages, source: "memory", accountId };
      }
      throw new Error(`audit_account_message_durable_list_failed:${error.message}`);
    }
    if (Array.isArray(data)) {
      const messages = data.map(parseAuditAccountMessageSupabaseRow);
      if (
        explicitAccountId
        && messages.some((message) => (
          message.accountId !== accountId
          || (contactEmail && message.contactEmail !== contactEmail)
        ))
      ) {
        throw new Error("audit_account_message_tenant_scope_violation");
      }
      return { messages, source: "supabase", accountId };
    }
    throw new Error("audit_account_message_durable_list_failed:no_rows_returned");
  }

  assertAuditAccountDeliveryDurableStorage(null);

  const messages = Array.from(memoryStore.values())
    .filter((message) => message.locale === locale)
    .filter((message) => {
      if (explicitAccountId) {
        return message.accountId === accountId
          && (!contactEmail || message.contactEmail === contactEmail);
      }
      return true;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);

  return { messages, source: "memory", accountId };
}

async function findSupabaseRecord(identifier: string, locale: "pl" | "en" | "de", accountId?: string) {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return null;
  const columns = ["id", "message_id", "request_id"] as const;
  for (const column of columns) {
    let query = supabase
      .from(TABLE_NAME)
      .select("*")
      .eq(column, identifier)
      .eq("locale", locale);
    if (accountId) query = query.eq("account_id", accountId);
    const { data, error } = await query.maybeSingle();
    if (error) {
      if (error.code === "PGRST205" && !isAuditAccountDeliveryProductionStorageStrict()) {
        return findMemoryRecord(identifier, locale, accountId);
      }
      throw new Error(`audit_account_message_durable_lookup_failed:${column}:${error.message}`);
    }
    if (data) return parseAuditAccountMessageSupabaseRow(data);
  }
  return null;
}

function findMemoryRecord(identifier: string, locale: "pl" | "en" | "de", accountId?: string) {
  return Array.from(memoryStore.values()).find((message) => (
    message.locale === locale
    && (!accountId || message.accountId === accountId)
    && (message.id === identifier || message.requestId === identifier)
  )) ?? null;
}

function buildCustomerSafeReport(record: AuditAccountMessageRecord, input: UpdateAuditAccountMessageInput, now: string, status: "ready" | "delivered"): AuditCustomerSafeReport {
  const snapshot = record.canonicalCustomerSnapshot;
  if (!snapshot || !verifyAuditAccountCustomerSnapshot(snapshot)) throw new Error("canonical_customer_snapshot_required_before_ready");
  if (!hasExactAuditAccountArtifactBinding(snapshot)) throw new Error("exact_account_pdf_artifact_required_before_ready");
  const safeId = encodeURIComponent(record.id || snapshot.reportId);
  const locale = resolveLocale(record.locale);
  const pdfRoute = `/api/security/audit-watch/customer-safe-report?id=${safeId}&locale=${locale}&format=pdf-safe`;
  const publicReportRoute = `/${locale}/security/audits/customer-report/${safeId}`;
  return {
    schemaVersion: PASS4820_AUDIT_CUSTOMER_SAFE_REPORT_SCHEMA,
    migratedFrom: "pass4820-native",
    passId: PASS2361_AUDIT_OPERATOR_ACTIONS_ID,
    reportId: snapshot.reportId,
    requestId: snapshot.requestId,
    title: snapshot.layoutInput.title,
    summary: snapshot.layoutInput.summary,
    status,
    pdfRoute,
    publicReportRoute,
    sections: snapshot.layoutInput.sections,
    forbidden: snapshot.layoutInput.forbidden,
    deliveredAt: status === "delivered" ? now : undefined,
    operatorNote: cleanText(input.operatorNote, 600),
  };
}

function withUniqueNextStep(nextSteps: string[], step: string) {
  const trimmed = step.trim();
  return [trimmed, ...nextSteps.filter((item) => item.trim() !== trimmed)].slice(0, 8);
}

function applyOperatorAction(record: AuditAccountMessageRecord, input: UpdateAuditAccountMessageInput): AuditAccountMessageRecord {
  const now = new Date().toISOString();
  const note = cleanText(input.operatorNote, 600);
  const pdfRoute = cleanText(input.pdfRoute, 300) ?? record.pdfRoute ?? record.exportRoute;
  const publicReportRoute = cleanText(input.publicReportRoute, 300) ?? record.publicReportRoute;
  const exportRoute = cleanText(input.exportRoute, 300) ?? record.exportRoute;
  let nextStatus: AuditOperatorStatus = record.operatorStatus;
  let messageStatus: VlmAuditMessageStatus = record.status;
  let deliveryStatus: AuditAccountDeliveryStatus = record.deliveryStatus;
  let nextSteps = [...record.nextSteps];
  let customerSafeReport = record.customerSafeReport;
  let deliveredAt = record.deliveredAt;

  if (input.action === "mark_analysis" || input.action === "mark_human_review") {
    nextStatus = "automated_analysis";
    messageStatus = "analysis_queue";
    deliveryStatus = "analysis_queue";
    nextSteps = withUniqueNextStep(nextSteps, "Velmère automated analysis and internal quality-control processing started. No human-review claim is made; customer-safe output remains blocked until evidence and redaction checks pass.");
  }

  if (input.action === "request_evidence") {
    nextStatus = "needs_evidence";
    messageStatus = "needs_evidence";
    deliveryStatus = "analysis_queue";
    nextSteps = withUniqueNextStep(nextSteps, "More evidence is required before this report can be marked ready.");
  }

  if (input.action === "attach_pdf") {
    nextStatus = "pdf_attached";
    messageStatus = "analysis_queue";
    deliveryStatus = "analysis_queue";
    nextSteps = withUniqueNextStep(nextSteps, "Lens/PDF route attached. Final delivery is decided by the deterministic immutable-snapshot, redaction and route-health gate; mark_ready is optional internal annotation only.");
  }

  if (input.action === "mark_ready") {
    if (!record.canonicalCustomerSnapshot || !hasExactAuditAccountArtifactBinding(record.canonicalCustomerSnapshot)) {
      throw new Error("exact_account_pdf_artifact_required_before_ready");
    }
    nextStatus = "customer_safe_ready";
    messageStatus = "ready";
    deliveryStatus = "ready_for_download";
    customerSafeReport = buildCustomerSafeReport({ ...record, pdfRoute, publicReportRoute, exportRoute }, input, now, "ready");
    nextSteps = withUniqueNextStep(nextSteps, "Internal customer-safe-ready annotation recorded. It does not unlock or block delivery; the deterministic final-delivery gate remains authoritative.");
  }

  if (input.action === "deliver_customer_safe_report") {
    if (!record.canonicalCustomerSnapshot || !hasExactAuditAccountArtifactBinding(record.canonicalCustomerSnapshot)) {
      throw new Error("exact_account_pdf_artifact_required_before_delivery");
    }
    nextStatus = "delivered";
    messageStatus = "ready";
    deliveryStatus = "ready_for_download";
    deliveredAt = now;
    customerSafeReport = buildCustomerSafeReport({ ...record, pdfRoute, publicReportRoute, exportRoute }, input, now, "delivered");
    nextSteps = withUniqueNextStep(nextSteps, "Customer-safe report delivered to the account. No unsafe or exploit-level detail is included.");
  }

  if (input.action === "block_redaction") {
    nextStatus = "blocked_redaction";
    messageStatus = "analysis_queue";
    deliveryStatus = "analysis_queue";
    nextSteps = withUniqueNextStep(nextSteps, "Public/customer delivery blocked until sensitive details are redacted.");
  }

  const actionLog: AuditAccountOperatorAction[] = [
    {
      id: `${PASS2361_AUDIT_OPERATOR_ACTIONS_ID}-${now}-${record.id}`,
      action: input.action === "mark_human_review" ? "mark_analysis" : input.action,
      at: now,
      operatorId: cleanText(input.operatorId, 120) ?? "security-admin",
      note,
      nextStatus,
      customerSafe: nextStatus === "customer_safe_ready" || nextStatus === "delivered",
      pdfRoute: customerSafeReport?.pdfRoute ?? pdfRoute,
    },
    ...record.actionLog,
  ].slice(0, 24);

  return {
    ...record,
    status: messageStatus,
    deliveryStatus,
    operatorStatus: nextStatus,
    operatorNote: note ?? record.operatorNote,
    nextSteps,
    pdfRoute: customerSafeReport?.pdfRoute ?? pdfRoute,
    publicReportRoute: customerSafeReport?.publicReportRoute ?? publicReportRoute,
    exportRoute,
    customerSafeReport,
    actionLog,
    deliveredAt,
    source: record.source,
    updatedAt: now,
  };
}

export async function updateAuditAccountMessage(input: UpdateAuditAccountMessageInput): Promise<{ record: AuditAccountMessageRecord; source: AuditAccountMessageSource } | null> {
  const identifier = cleanText(input.messageId, 160) ?? cleanText(input.requestId, 160);
  if (!identifier) return null;
  const locale = resolveLocale(input.locale);
  const supabaseRecord = await findSupabaseRecord(identifier, locale);
  const current = supabaseRecord ?? findMemoryRecord(identifier, locale);
  if (!current) return null;
  const updated = applyOperatorAction(current, input);
  const supabase = getSupabaseServiceRoleClient();

  if (supabase) {
    const supabasePayload = { ...updated, source: "supabase" as const };
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(buildAuditAccountMessageSupabaseRow(supabasePayload), { onConflict: "id" })
      .select("*")
      .maybeSingle();
    if (!error && data) return { record: parseAuditAccountMessageSupabaseRow(data), source: "supabase" };
    if (error) throw new Error(`audit_account_message_durable_update_failed:${error.message}`);
    throw new Error("audit_account_message_durable_update_failed:no_row_returned");
  }

  const memoryRecord = { ...updated, source: "memory" as const };
  assertAuditAccountDeliveryDurableStorage(null);
  memoryStore.set(memoryRecord.id, memoryRecord);
  return { record: memoryRecord, source: "memory" };
}


/**
 * Customer routes may expose an immutable Audit artifact only after the exact
 * account-owned snapshot id is linked from one valid Audit account message.
 * This keeps a successful PDF-bundle write followed by a failed message write
 * fail-closed: the orphaned bundle remains internal and cannot appear in the
 * account artifact list or direct customer download route.
 */
export async function hasAuditAccountMessageExactArtifactLink(input: {
  accountId: string;
  snapshotId: string;
  client?: SupabaseClient | null;
}): Promise<boolean> {
  const accountId = cleanText(input.accountId, 120);
  const snapshotId = cleanText(input.snapshotId, 180);
  if (!accountId || !snapshotId || !/^artifact-audit-[a-f0-9]{16}-[a-f0-9]{64}$/iu.test(snapshotId)) {
    return false;
  }

  const supabase = input.client === undefined ? getSupabaseServiceRoleClient() : input.client;
  if (supabase) {
    const { data, error } = await supabase
      .from(P84_AUDIT_CUSTOMER_ARTIFACT_LINK_TABLE)
      .select(P84_AUDIT_CUSTOMER_ARTIFACT_LINK_SELECT)
      .eq("account_id", accountId)
      .eq("snapshot_id", snapshotId)
      .limit(2);
    if (error) throw new Error(`audit_account_artifact_link_lookup_failed:${error.message}`);
    const rows = Array.isArray(data) ? data : [];
    if (rows.length > 1) throw new Error("audit_account_artifact_link_ambiguous");
    if (rows.length === 0) return false;
    parseP84AuditCustomerArtifactLinkRow(rows[0], { accountId, snapshotId });
    return true;
  }

  assertAuditAccountDeliveryDurableStorage(null);
  const matches = Array.from(memoryStore.values()).filter((record) => (
    record.accountId === accountId
    && Boolean(record.canonicalCustomerSnapshot)
    && hasExactAuditAccountArtifactBinding(record.canonicalCustomerSnapshot)
    && record.canonicalCustomerSnapshot.exactAccountArtifact.snapshotId === snapshotId
  ));
  if (matches.length > 1) throw new Error("audit_account_artifact_link_ambiguous");
  return matches.length === 1;
}

export async function getAuditAccountMessageByIdentifier(input: { id?: string; requestId?: string; locale?: string; accountId?: string }): Promise<{ record: AuditAccountMessageRecord; source: AuditAccountMessageSource } | null> {
  const identifier = cleanText(input.id, 160) ?? cleanText(input.requestId, 160);
  if (!identifier) return null;
  const locale = resolveLocale(input.locale);
  const accountId = cleanText(input.accountId, 120);
  const supabaseRecord = await findSupabaseRecord(identifier, locale, accountId);
  if (supabaseRecord) return { record: supabaseRecord, source: "supabase" };
  assertAuditAccountDeliveryDurableStorage(null);
  const memoryRecord = findMemoryRecord(identifier, locale, accountId);
  if (memoryRecord) return { record: memoryRecord, source: "memory" };
  return null;
}

export function buildAuditDeliveryReadiness(messages: AuditAccountMessageRecord[]) {
  const queued = messages.filter((item) => item.deliveryStatus === "delivered_to_account" || item.deliveryStatus === "analysis_queue" || item.deliveryStatus === "human_review_queue").length;
  const waitingPayment = messages.filter((item) => item.deliveryStatus === "waiting_payment").length;
  const ready = messages.filter((item) => item.deliveryStatus === "ready_for_download" && Boolean(item.canonicalCustomerSnapshot && verifyAuditAccountCustomerSnapshot(item.canonicalCustomerSnapshot))).length;
  const operatorReady = messages.filter((item) => (item.operatorStatus === "customer_safe_ready" || item.operatorStatus === "delivered") && Boolean(item.canonicalCustomerSnapshot && verifyAuditAccountCustomerSnapshot(item.canonicalCustomerSnapshot))).length;
  return {
    passId: PASS2360_AUDIT_ACCOUNT_DELIVERY_ID,
    total: messages.length,
    queued,
    waitingPayment,
    ready,
    operatorReady,
    lanes: [
      "Basic Audit writes an account message immediately after intake.",
      "Advanced Audit remains unavailable and cannot enter public delivery.",
      "Security-admin actions can attach a PDF route, request evidence, optionally annotate customer-safe readiness and request delivery; only the deterministic final-delivery gate can authorize delivery.",
      "Supabase is fail-closed whenever configured; memory storage is allowed only when durable storage is not configured and production strict mode is disabled.",
      "PASS2366 can link payment evidence rows back to auditQueueId/accountMessageId for replay evidence; no human sign-off is a customer-delivery prerequisite.",
      "Email delivery is marked pending; no fake email send is claimed.",
    ],
  };
}

export function buildAuditOperatorActionReadiness(messages: AuditAccountMessageRecord[]) {
  const byStatus = messages.reduce<Record<AuditOperatorStatus, number>>((acc, item) => {
    acc[item.operatorStatus] = (acc[item.operatorStatus] ?? 0) + 1;
    return acc;
  }, {
    intake: 0,
    analysis_queue: 0,
    automated_analysis: 0,
    human_review: 0,
    needs_evidence: 0,
    pdf_attached: 0,
    customer_safe_ready: 0,
    delivered: 0,
    blocked_redaction: 0,
  });
  return {
    passId: PASS2361_AUDIT_OPERATOR_ACTIONS_ID,
    total: messages.length,
    byStatus,
    actions: [
      "mark_analysis",
      "request_evidence",
      "attach_pdf",
      "mark_ready",
      "deliver_customer_safe_report",
      "block_redaction",
    ] satisfies AuditOperatorActionType[],
    safetyBoundary: "Customer-safe delivery can include scope, risk, missing evidence and next steps, but never exploit instructions, seed phrases, Certified Safe claims or investment advice.",
  };
}
