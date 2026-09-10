import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import type { AuditIntakeCaseRecord } from "@/lib/security/audit-intake-case-vault";
import { settleBasicAuditWorkerLease } from "@/lib/security/audit-review-orchestration";
import {
  assertP88AuditExactPdfBytes,
  decodeP88StoredAuditExactPdfBytes,
  encodeP88AuditExactPdfBase64,
} from "@/lib/security/audit-report-exact-pdf-artifact";
import {
  validateProAuditPdfSnapshot,
  type ProAuditPdfSnapshot,
} from "@/lib/security/pro-audit-pdf/render-pro-audit-pdf";

export const AUDIT_BASIC_EXACT_REPORT_SCHEMA = "velmere.audit-basic-exact-immutable-pdf-artifact.v1" as const;

export type AuditBasicReportRecord = {
  schemaVersion: typeof AUDIT_BASIC_EXACT_REPORT_SCHEMA;
  reportId: string;
  caseRef: string;
  requestId: string;
  accountIdHash: string;
  targetHash: string;
  reportVersionHash: string;
  snapshotDigest: string;
  sourceReceiptRoot: string;
  pdfDigest: string;
  pdfByteLength: number;
  renderContractId: string;
  snapshot: ProAuditPdfSnapshot;
  pdfBytes: Uint8Array;
  createdAt: string;
  recordDigest: string;
  storageMode: "durable" | "memory";
};

export type CompleteBasicAuditReportResult =
  | { ok: true; idempotent: boolean; record: AuditBasicReportRecord; attemptCount: number }
  | { ok: false; error: string; retryable: boolean; staleLease?: boolean };

const memoryByCase = new Map<string, AuditBasicReportRecord>();
const memoryByReport = new Map<string, AuditBasicReportRecord>();

const BASIC_SELECT = [
  "schema_version", "report_id", "case_ref", "request_id", "account_id_hash", "target_hash",
  "report_version_hash", "snapshot_digest", "source_receipt_root", "pdf_digest", "pdf_byte_length",
  "render_contract_id", "snapshot_json", "pdf_bytes", "created_at", "record_digest",
].join(",");

const BASIC_COMPLETION_RPC_ERRORS = new Set([
  "audit_basic_exact_pdf_invalid_request",
  "audit_basic_exact_pdf_base64_noncanonical",
  "audit_basic_exact_pdf_bytes_invalid",
  "audit_basic_exact_pdf_record_digest_invalid",
  "audit_basic_account_binding_mismatch",
  "audit_basic_report_immutable_conflict",
  "case_not_eligible",
  "lease_mismatch",
  "review_orchestration_unavailable",
]);

export function normalizeAuditBasicStoreFailure(kind: "read" | "complete", _error: unknown) {
  return kind === "read" ? "audit_basic_report_read_failed" : "audit_basic_exact_pdf_atomic_completion_failed";
}

export function normalizeAuditBasicCompletionRpcError(value: unknown) {
  const code = clean(value, 180);
  return BASIC_COMPLETION_RPC_ERRORS.has(code) ? code : "audit_basic_exact_pdf_atomic_completion_rejected";
}

function productionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function durableConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanReportId(value: unknown) {
  const normalized = clean(value, 120);
  return /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,119}$/.test(normalized) ? normalized : "";
}

function cleanCaseRef(value: unknown) {
  const normalized = clean(value, 24).toUpperCase();
  return /^AUD-[A-Z0-9]{8,16}$/.test(normalized) ? normalized : "";
}

function digest(value: unknown) {
  const normalized = clean(value, 80).toLowerCase();
  return /^sha256:[a-f0-9]{64}$/.test(normalized) ? normalized : "";
}

function reportVersionHash(args: {
  reportId: string;
  caseRef: string;
  requestId: string;
  accountIdHash: string;
  targetHash: string;
  snapshotDigest: string;
  sourceReceiptRoot: string;
  pdfDigest: string;
}) {
  return sha256Digest(canonicalJson({
    schemaVersion: "velmere.audit-basic-report-version.v1",
    ...args,
  }));
}

function recordBindingText(record: Omit<AuditBasicReportRecord, "pdfBytes" | "snapshot" | "recordDigest" | "storageMode">) {
  return [
    record.schemaVersion,
    record.reportId,
    record.caseRef,
    record.requestId,
    record.accountIdHash,
    record.targetHash,
    record.reportVersionHash,
    record.snapshotDigest,
    record.sourceReceiptRoot,
    record.pdfDigest,
    String(record.pdfByteLength),
    record.renderContractId,
    record.createdAt,
  ].join("\n");
}

function recordsEqual(left: AuditBasicReportRecord, right: AuditBasicReportRecord) {
  return left.recordDigest === right.recordDigest
    && left.pdfDigest === right.pdfDigest
    && left.pdfByteLength === right.pdfByteLength
    && Buffer.from(left.pdfBytes).equals(Buffer.from(right.pdfBytes))
    && canonicalJson(left.snapshot) === canonicalJson(right.snapshot);
}

export function buildAuditBasicReportRecord(args: {
  reportId: string;
  record: AuditIntakeCaseRecord;
  snapshot: ProAuditPdfSnapshot;
  pdfBytes: Uint8Array;
  storageMode: "durable" | "memory";
}): AuditBasicReportRecord {
  const reportId = cleanReportId(args.reportId);
  const caseRef = cleanCaseRef(args.record.caseRef);
  const requestId = clean(args.record.requestId, 96);
  const accountIdHash = args.record.accountId ? hashVelmereAccountBinding(args.record.accountId) : "";
  const targetHash = digest(args.record.target.targetHash);
  const snapshot = validateProAuditPdfSnapshot(args.snapshot);
  if (!reportId || !caseRef || !requestId || !/^[a-f0-9]{64}$/.test(accountIdHash) || !targetHash
    || args.record.tier !== "basic" || args.record.status !== "queued_basic_prescreen"
    || args.record.target.kind !== "contract" || args.record.target.chainId !== "56" || args.record.target.chainName !== "BSC"
    || args.record.entitlementRequired || args.record.entitlementVerified || args.record.entitlementId
    || snapshot.tier !== "basic" || snapshot.requestId !== requestId
    || snapshot.target !== args.record.target.canonicalTarget
    || snapshot.auditExecutionRelease?.expectedTier !== "basic"
    || snapshot.auditExecutionRelease.caseRef !== caseRef
    || snapshot.customerEligibility?.commercialUseReady !== true) {
    throw new Error("audit_basic_report_binding_invalid");
  }
  const exact = assertP88AuditExactPdfBytes({ snapshot, pdfBytes: args.pdfBytes });
  const snapshotDigest = digest(snapshot.digest);
  const sourceReceiptRoot = digest(snapshot.sourceReceiptRoot);
  if (!snapshotDigest || !sourceReceiptRoot) throw new Error("audit_basic_report_evidence_digest_invalid");
  const versionHash = reportVersionHash({
    reportId,
    caseRef,
    requestId,
    accountIdHash,
    targetHash,
    snapshotDigest,
    sourceReceiptRoot,
    pdfDigest: exact.pdfDigest,
  });
  const unsigned = {
    schemaVersion: AUDIT_BASIC_EXACT_REPORT_SCHEMA,
    reportId,
    caseRef,
    requestId,
    accountIdHash,
    targetHash,
    reportVersionHash: versionHash,
    snapshotDigest,
    sourceReceiptRoot,
    pdfDigest: exact.pdfDigest,
    pdfByteLength: exact.pdfByteLength,
    renderContractId: exact.renderContractId,
    createdAt: snapshot.generatedAt,
  } as const;
  return {
    ...unsigned,
    snapshot,
    pdfBytes: exact.bytes,
    recordDigest: sha256Digest(recordBindingText(unsigned)),
    storageMode: args.storageMode,
  };
}

function rowToRecord(row: Record<string, unknown>): AuditBasicReportRecord {
  const snapshot = validateProAuditPdfSnapshot(row.snapshot_json);
  const pdfBytes = decodeP88StoredAuditExactPdfBytes(row.pdf_bytes);
  const record: AuditBasicReportRecord = {
    schemaVersion: row.schema_version === AUDIT_BASIC_EXACT_REPORT_SCHEMA ? AUDIT_BASIC_EXACT_REPORT_SCHEMA : AUDIT_BASIC_EXACT_REPORT_SCHEMA,
    reportId: cleanReportId(row.report_id),
    caseRef: cleanCaseRef(row.case_ref),
    requestId: clean(row.request_id, 96),
    accountIdHash: clean(row.account_id_hash, 64).toLowerCase(),
    targetHash: digest(row.target_hash),
    reportVersionHash: digest(row.report_version_hash),
    snapshotDigest: digest(row.snapshot_digest),
    sourceReceiptRoot: digest(row.source_receipt_root),
    pdfDigest: digest(row.pdf_digest),
    pdfByteLength: Number(row.pdf_byte_length),
    renderContractId: clean(row.render_contract_id, 120),
    snapshot,
    pdfBytes,
    createdAt: new Date(String(row.created_at)).toISOString(),
    recordDigest: digest(row.record_digest),
    storageMode: "durable",
  };
  const expectedUnsigned = {
    schemaVersion: record.schemaVersion,
    reportId: record.reportId,
    caseRef: record.caseRef,
    requestId: record.requestId,
    accountIdHash: record.accountIdHash,
    targetHash: record.targetHash,
    reportVersionHash: record.reportVersionHash,
    snapshotDigest: record.snapshotDigest,
    sourceReceiptRoot: record.sourceReceiptRoot,
    pdfDigest: record.pdfDigest,
    pdfByteLength: record.pdfByteLength,
    renderContractId: record.renderContractId,
    createdAt: record.createdAt,
  };
  if (row.schema_version !== AUDIT_BASIC_EXACT_REPORT_SCHEMA
    || !record.reportId || !record.caseRef || !record.requestId || !/^[a-f0-9]{64}$/.test(record.accountIdHash)
    || !record.targetHash || !record.reportVersionHash || !record.snapshotDigest || !record.sourceReceiptRoot || !record.pdfDigest
    || record.snapshot.tier !== "basic" || record.snapshot.digest !== record.snapshotDigest
    || record.snapshot.sourceReceiptRoot !== record.sourceReceiptRoot
    || sha256Digest(recordBindingText(expectedUnsigned)) !== record.recordDigest) {
    throw new Error("audit_basic_report_row_invalid");
  }
  assertP88AuditExactPdfBytes({
    snapshot: record.snapshot,
    pdfBytes,
    expectedDigest: record.pdfDigest,
    expectedByteLength: record.pdfByteLength,
    expectedRenderContractId: record.renderContractId,
  });
  return record;
}

export async function completeBasicAuditWorkerLeaseWithExactPdf(args: {
  reportId: string;
  record: AuditIntakeCaseRecord;
  snapshot: ProAuditPdfSnapshot;
  pdfBytes: Uint8Array;
  workerPrincipal: string;
  leaseToken: string;
  reasonCode: string;
}): Promise<CompleteBasicAuditReportResult> {
  let built: AuditBasicReportRecord;
  try {
    built = buildAuditBasicReportRecord({
      reportId: args.reportId,
      record: args.record,
      snapshot: args.snapshot,
      pdfBytes: args.pdfBytes,
      storageMode: args.record.durable ? "durable" : "memory",
    });
  } catch {
    return { ok: false, error: "audit_basic_report_invalid", retryable: false };
  }

  if (args.record.durable) {
    if (!durableConfigured()) return { ok: false, error: "audit_basic_exact_pdf_durable_store_required", retryable: true };
    try {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "audit_basic_worker_complete_with_exact_pdf",
        args: {
          p_case_ref: built.caseRef,
          p_worker_principal: args.workerPrincipal,
          p_lease_token: args.leaseToken,
          p_reason_code: args.reasonCode,
          p_report_id: built.reportId,
          p_request_id: built.requestId,
          p_account_id_hash: built.accountIdHash,
          p_target_hash: built.targetHash,
          p_report_version_hash: built.reportVersionHash,
          p_snapshot_digest: built.snapshotDigest,
          p_source_receipt_root: built.sourceReceiptRoot,
          p_pdf_digest: built.pdfDigest,
          p_pdf_byte_length: built.pdfByteLength,
          p_render_contract_id: built.renderContractId,
          p_record_digest: built.recordDigest,
          p_pdf_base64: encodeP88AuditExactPdfBase64(built.pdfBytes),
          p_snapshot_json: built.snapshot,
          p_created_at: built.createdAt,
        },
      });
      const rpc = (data ?? {}) as { ok?: boolean; idempotent?: boolean; error?: string; staleLease?: boolean; attemptCount?: number; reportId?: string; recordDigest?: string };
      if (!rpc.ok) {
        const error = normalizeAuditBasicCompletionRpcError(rpc.error);
        return { ok: false, error, retryable: error === "review_orchestration_unavailable", staleLease: rpc.staleLease === true };
      }
      if (rpc.reportId !== built.reportId || rpc.recordDigest !== built.recordDigest) {
        return { ok: false, error: "audit_basic_exact_pdf_atomic_receipt_mismatch", retryable: true };
      }
      return { ok: true, idempotent: rpc.idempotent === true, record: built, attemptCount: Number(rpc.attemptCount ?? 0) };
    } catch (error) {
      return { ok: false, error: normalizeAuditBasicStoreFailure("complete", error), retryable: true };
    }
  }

  if (productionLike()) return { ok: false, error: "audit_basic_exact_pdf_durable_store_required", retryable: true };
  const existing = memoryByCase.get(built.caseRef) ?? memoryByReport.get(built.reportId);
  if (existing && !recordsEqual(existing, built)) return { ok: false, error: "audit_basic_report_immutable_conflict", retryable: false };
  if (!existing) {
    memoryByCase.set(built.caseRef, built);
    memoryByReport.set(built.reportId, built);
  }
  const settled = await settleBasicAuditWorkerLease({
    record: args.record,
    workerPrincipal: args.workerPrincipal,
    leaseToken: args.leaseToken,
    outcome: "complete",
    reasonCode: args.reasonCode,
  });
  if (!settled.ok) {
    if (!existing) {
      memoryByCase.delete(built.caseRef);
      memoryByReport.delete(built.reportId);
    }
    return { ok: false, error: settled.error ?? "audit_basic_worker_settle_failed", retryable: false, staleLease: settled.staleLease };
  }
  return { ok: true, idempotent: Boolean(existing), record: existing ?? built, attemptCount: settled.attemptCount ?? 0 };
}

export async function readAuditBasicReportForOwner(args: {
  caseRef: string;
  accountId: string;
  reportId?: string | null;
}) {
  const caseRef = cleanCaseRef(args.caseRef);
  const reportId = args.reportId ? cleanReportId(args.reportId) : "";
  const accountIdHash = hashVelmereAccountBinding(args.accountId);
  if (!caseRef || !/^[a-f0-9]{64}$/.test(accountIdHash) || (args.reportId && !reportId)) {
    return { ok: false as const, error: "audit_basic_report_read_binding_invalid", retryable: false };
  }
  if (durableConfigured()) {
    try {
      const supabase = getSupabaseServiceRoleClient();
      if (!supabase) throw new Error("audit_basic_report_service_role_unavailable");
      let query = supabase.from("velmere_audit_basic_report_artifacts").select(BASIC_SELECT).eq("case_ref", caseRef);
      if (reportId) query = query.eq("report_id", reportId);
      const { data, error } = await query.maybeSingle();
      if (error) {
        return { ok: false as const, error: normalizeAuditBasicStoreFailure("read", error), retryable: true };
      }
      if (!data) return { ok: false as const, error: "audit_basic_report_not_ready", retryable: false };
      const record = rowToRecord(data as unknown as Record<string, unknown>);
      if (record.accountIdHash !== accountIdHash) return { ok: false as const, error: "audit_basic_report_owner_mismatch", retryable: false };
      return { ok: true as const, record };
    } catch (error) {
      return { ok: false as const, error: normalizeAuditBasicStoreFailure("read", error), retryable: true };
    }
  }
  if (productionLike()) return { ok: false as const, error: "audit_basic_report_durable_store_required", retryable: true };
  const record = reportId ? memoryByReport.get(reportId) : memoryByCase.get(caseRef);
  if (!record) return { ok: false as const, error: "audit_basic_report_not_ready", retryable: false };
  if (record.caseRef !== caseRef || record.accountIdHash !== accountIdHash) return { ok: false as const, error: "audit_basic_report_owner_mismatch", retryable: false };
  try {
    return { ok: true as const, record: rowToRecord({
      schema_version: record.schemaVersion,
      report_id: record.reportId,
      case_ref: record.caseRef,
      request_id: record.requestId,
      account_id_hash: record.accountIdHash,
      target_hash: record.targetHash,
      report_version_hash: record.reportVersionHash,
      snapshot_digest: record.snapshotDigest,
      source_receipt_root: record.sourceReceiptRoot,
      pdf_digest: record.pdfDigest,
      pdf_byte_length: record.pdfByteLength,
      render_contract_id: record.renderContractId,
      snapshot_json: record.snapshot,
      pdf_bytes: record.pdfBytes,
      created_at: record.createdAt,
      record_digest: record.recordDigest,
    }) };
  } catch {
    return { ok: false as const, error: "audit_basic_report_integrity_failed", retryable: false };
  }
}

export function getMemoryAuditBasicReport(caseRef: string) {
  return memoryByCase.get(cleanCaseRef(caseRef)) ?? null;
}
