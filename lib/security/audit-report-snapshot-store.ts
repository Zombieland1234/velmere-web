import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "./ascii-control-characters";

import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import {
  validateProAuditPdfSnapshot,
  type ProAuditPdfSnapshot,
} from "@/lib/security/pro-audit-pdf/render-pro-audit-pdf";
import { PASS4808_PDF_RENDER_CONTRACT_ID } from "@/lib/security/pro-audit-pdf/customer-safe-renderer";
import {
  assertP88AuditExactPdfBytes,
  buildP88AuditExactPdfArtifact,
  decodeP88StoredAuditExactPdfBytes,
  encodeP88AuditExactPdfBase64,
  P88_AUDIT_EXACT_PDF_ARTIFACT_ID,
} from "@/lib/security/audit-report-exact-pdf-artifact";

export const PASS4807_AUDIT_REPORT_SNAPSHOT_STORE_ID = "pass4807-content-bound-audit-report-snapshot-store-v1" as const;
export const P88_AUDIT_REPORT_EXACT_PDF_STORE_ID = "p88-audit-report-exact-pdf-store-v1" as const;

type PaidTier = "pro" | "advanced";

export type AuditReportSnapshotRecord = {
  schemaVersion: typeof PASS4807_AUDIT_REPORT_SNAPSHOT_STORE_ID;
  exactPdfSchemaVersion: typeof P88_AUDIT_EXACT_PDF_ARTIFACT_ID;
  reportId: string;
  caseRef: string;
  requestId: string;
  accountIdHash: string;
  entitlementId: string;
  tier: PaidTier;
  targetHash: string;
  reportVersionHash: string;
  snapshotDigest: string;
  sourceReceiptRoot: string;
  pdfDigest: string;
  pdfByteLength: number;
  renderContractId: typeof PASS4808_PDF_RENDER_CONTRACT_ID;
  pdfRecordDigest: string;
  pdfBytes: Uint8Array;
  snapshot: ProAuditPdfSnapshot;
  createdAt: string;
  storageMode: "durable" | "memory";
};

export type PersistAuditReportSnapshotResult =
  | { ok: true; record: AuditReportSnapshotRecord; idempotent: boolean }
  | { ok: false; error: string; retryable: boolean; storageMode: "durable" | "memory" };

export type ReadAuditReportSnapshotResult =
  | { ok: true; record: AuditReportSnapshotRecord }
  | { ok: false; error: string; retryable: boolean; storageMode: "durable" | "memory" };

const SNAPSHOT_ROW_SELECT =
  "report_id,case_ref,request_id,account_id_hash,entitlement_id,tier,target_hash,report_version_hash,snapshot_digest,source_receipt_root,pdf_digest,snapshot_json,created_at";
const EXACT_PDF_ROW_SELECT =
  "schema_version,report_id,case_ref,request_id,account_id_hash,entitlement_id,tier,target_hash,report_version_hash,snapshot_digest,source_receipt_root,pdf_digest,pdf_byte_length,render_contract_id,pdf_bytes,created_at,record_digest";

const memoryByCaseTier = new Map<string, AuditReportSnapshotRecord>();
const memoryByReport = new Map<string, AuditReportSnapshotRecord>();

function productionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function clean(value: unknown, max: number) {
  return typeof value === "string"
    ? value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, "").trim().slice(0, max)
    : "";
}

function cleanReportId(value: unknown) {
  return clean(value, 120).replace(/[^a-zA-Z0-9:._-]+/g, "-");
}

function cleanCaseRef(value: unknown) {
  return clean(value, 48).toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

function cleanSha256(value: unknown) {
  const text = clean(value, 80).toLowerCase();
  return /^sha256:[a-f0-9]{64}$/.test(text) ? text : "";
}

function cleanHex64(value: unknown) {
  const text = clean(value, 64).toLowerCase();
  return /^[a-f0-9]{64}$/.test(text) ? text : "";
}

function canonicalIso(value: unknown) {
  try { return new Date(String(value ?? "")).toISOString(); }
  catch { return ""; }
}

function caseTierKey(caseRef: string, tier: PaidTier) {
  return `${caseRef}:${tier}`;
}

function buildReportVersionHash(args: {
  reportId: string;
  caseRef: string;
  requestId: string;
  tier: PaidTier;
  targetHash: string;
  snapshot: ProAuditPdfSnapshot;
  pdfDigest: string;
}) {
  return sha256Digest(canonicalJson({
    schemaVersion: PASS4807_AUDIT_REPORT_SNAPSHOT_STORE_ID,
    reportId: args.reportId,
    caseRef: args.caseRef,
    requestId: args.requestId,
    tier: args.tier,
    targetHash: args.targetHash,
    target: args.snapshot.target,
    chain: args.snapshot.chain,
    locale: args.snapshot.locale,
    modelVersion: args.snapshot.modelVersion,
    snapshotDigest: args.snapshot.digest,
    sourceReceiptRoot: args.snapshot.sourceReceiptRoot,
    pdfDigest: args.pdfDigest,
  }));
}

function buildRecord(args: {
  reportId: unknown;
  caseRef: unknown;
  requestId: unknown;
  accountIdHash: unknown;
  entitlementId: unknown;
  tier: PaidTier;
  targetHash: unknown;
  snapshot: ProAuditPdfSnapshot;
  pdfBytes: Uint8Array;
  storageMode: "durable" | "memory";
  expectedReportVersionHash?: unknown;
  expectedPdfDigest?: unknown;
  expectedPdfByteLength?: unknown;
  expectedRenderContractId?: unknown;
  expectedRecordDigest?: unknown;
  expectedCreatedAt?: unknown;
}) {
  const snapshot = validateProAuditPdfSnapshot(args.snapshot);
  const reportId = cleanReportId(args.reportId);
  const caseRef = cleanCaseRef(args.caseRef);
  const requestId = clean(args.requestId, 96);
  const accountIdHash = cleanHex64(args.accountIdHash);
  const entitlementId = clean(args.entitlementId, 180);
  const targetHash = cleanSha256(args.targetHash);
  const createdAt = canonicalIso(args.expectedCreatedAt ?? snapshot.generatedAt);
  if (!reportId || !caseRef || !requestId || !accountIdHash || !entitlementId || !targetHash || !createdAt
    || snapshot.requestId !== requestId || snapshot.tier !== args.tier || snapshot.generatedAt !== createdAt) {
    throw new Error("audit_report_exact_pdf_binding_invalid");
  }
  const exact = assertP88AuditExactPdfBytes({
    snapshot,
    pdfBytes: args.pdfBytes,
    ...(args.expectedPdfDigest === undefined ? {} : { expectedDigest: cleanSha256(args.expectedPdfDigest) }),
    ...(args.expectedPdfByteLength === undefined ? {} : { expectedByteLength: Number(args.expectedPdfByteLength) }),
    ...(args.expectedRenderContractId === undefined ? {} : { expectedRenderContractId: clean(args.expectedRenderContractId, 120) }),
  });
  const reportVersionHash = buildReportVersionHash({ reportId, caseRef, requestId, tier: args.tier, targetHash, snapshot, pdfDigest: exact.pdfDigest });
  if (args.expectedReportVersionHash !== undefined && cleanSha256(args.expectedReportVersionHash) !== reportVersionHash) {
    throw new Error("audit_report_snapshot_version_integrity_failed");
  }
  const artifact = buildP88AuditExactPdfArtifact({
    reportId,
    caseRef,
    requestId,
    accountIdHash,
    entitlementId,
    tier: args.tier,
    targetHash,
    reportVersionHash,
    snapshotDigest: snapshot.digest,
    sourceReceiptRoot: snapshot.sourceReceiptRoot,
    createdAt,
    snapshot,
    pdfBytes: exact.bytes,
  });
  if (args.expectedRecordDigest !== undefined && cleanSha256(args.expectedRecordDigest) !== artifact.recordDigest) {
    throw new Error("audit_report_exact_pdf_record_digest_mismatch");
  }
  return {
    schemaVersion: PASS4807_AUDIT_REPORT_SNAPSHOT_STORE_ID,
    exactPdfSchemaVersion: P88_AUDIT_EXACT_PDF_ARTIFACT_ID,
    reportId,
    caseRef,
    requestId,
    accountIdHash,
    entitlementId,
    tier: args.tier,
    targetHash,
    reportVersionHash,
    snapshotDigest: snapshot.digest,
    sourceReceiptRoot: snapshot.sourceReceiptRoot,
    pdfDigest: artifact.pdfDigest,
    pdfByteLength: artifact.pdfByteLength,
    renderContractId: artifact.renderContractId,
    pdfRecordDigest: artifact.recordDigest,
    pdfBytes: new Uint8Array(artifact.pdfBytes),
    snapshot,
    createdAt,
    storageMode: args.storageMode,
  } satisfies AuditReportSnapshotRecord;
}

function recordFromRows(
  snapshotRow: Record<string, unknown>,
  blobRow: Record<string, unknown>,
  storageMode: "durable" | "memory",
) {
  const snapshot = validateProAuditPdfSnapshot(snapshotRow.snapshot_json);
  const tier = snapshotRow.tier === "advanced" ? "advanced" : snapshotRow.tier === "pro" ? "pro" : null;
  if (!tier) throw new Error("audit_report_snapshot_row_invalid");
  if (clean(snapshotRow.snapshot_digest, 80) !== snapshot.digest
    || clean(snapshotRow.source_receipt_root, 80) !== snapshot.sourceReceiptRoot
    || clean(snapshotRow.pdf_digest, 80) !== snapshot.renderContract?.pdfDigest) {
    throw new Error("audit_report_snapshot_row_digest_mismatch");
  }
  if (blobRow.schema_version !== P88_AUDIT_EXACT_PDF_ARTIFACT_ID) {
    throw new Error("audit_report_exact_pdf_blob_schema_invalid");
  }
  const pairs: Array<[unknown, unknown, string]> = [
    [blobRow.report_id, snapshotRow.report_id, "report_id"],
    [blobRow.case_ref, snapshotRow.case_ref, "case_ref"],
    [blobRow.request_id, snapshotRow.request_id, "request_id"],
    [blobRow.account_id_hash, snapshotRow.account_id_hash, "account_id_hash"],
    [blobRow.entitlement_id, snapshotRow.entitlement_id, "entitlement_id"],
    [blobRow.tier, snapshotRow.tier, "tier"],
    [blobRow.target_hash, snapshotRow.target_hash, "target_hash"],
    [blobRow.report_version_hash, snapshotRow.report_version_hash, "report_version_hash"],
    [blobRow.snapshot_digest, snapshotRow.snapshot_digest, "snapshot_digest"],
    [blobRow.source_receipt_root, snapshotRow.source_receipt_root, "source_receipt_root"],
    [blobRow.pdf_digest, snapshotRow.pdf_digest, "pdf_digest"],
  ];
  for (const [left, right, field] of pairs) {
    if (String(left ?? "") !== String(right ?? "")) throw new Error(`audit_report_exact_pdf_cross_binding_mismatch:${field}`);
  }
  const createdAt = canonicalIso(snapshotRow.created_at);
  if (!createdAt || canonicalIso(blobRow.created_at) !== createdAt) {
    throw new Error("audit_report_exact_pdf_cross_binding_mismatch:created_at");
  }
  return buildRecord({
    reportId: snapshotRow.report_id,
    caseRef: snapshotRow.case_ref,
    requestId: snapshotRow.request_id,
    accountIdHash: snapshotRow.account_id_hash,
    entitlementId: snapshotRow.entitlement_id,
    tier,
    targetHash: snapshotRow.target_hash,
    snapshot,
    pdfBytes: decodeP88StoredAuditExactPdfBytes(blobRow.pdfBase64 ?? blobRow.pdf_base64 ?? blobRow.pdf_bytes),
    storageMode,
    expectedReportVersionHash: snapshotRow.report_version_hash,
    expectedPdfDigest: blobRow.pdf_digest,
    expectedPdfByteLength: blobRow.pdf_byte_length,
    expectedRenderContractId: blobRow.render_contract_id,
    expectedRecordDigest: blobRow.record_digest,
    expectedCreatedAt: createdAt,
  });
}

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function rowsEqual(left: AuditReportSnapshotRecord, right: AuditReportSnapshotRecord) {
  return left.reportId === right.reportId
    && left.caseRef === right.caseRef
    && left.requestId === right.requestId
    && left.accountIdHash === right.accountIdHash
    && left.entitlementId === right.entitlementId
    && left.tier === right.tier
    && left.targetHash === right.targetHash
    && left.reportVersionHash === right.reportVersionHash
    && left.snapshotDigest === right.snapshotDigest
    && left.sourceReceiptRoot === right.sourceReceiptRoot
    && left.pdfDigest === right.pdfDigest
    && left.pdfByteLength === right.pdfByteLength
    && left.renderContractId === right.renderContractId
    && left.pdfRecordDigest === right.pdfRecordDigest
    && bytesEqual(left.pdfBytes, right.pdfBytes);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function persistAuditReportSnapshot(args: {
  reportId: string;
  caseRef: string;
  requestId: string;
  accountId: string;
  entitlementId: string;
  tier: PaidTier;
  targetHash: string;
  snapshot: ProAuditPdfSnapshot;
  pdfBytes: Uint8Array;
}): Promise<PersistAuditReportSnapshotResult> {
  if (hasSupabaseServiceRoleConfig()) {
    return { ok: false, error: "audit_report_exact_pdf_atomic_completion_required", retryable: false, storageMode: "durable" };
  }
  if (productionLike()) {
    return { ok: false, error: "audit_report_snapshot_durable_store_required", retryable: true, storageMode: "memory" };
  }
  try {
    const record = buildRecord({
      reportId: args.reportId,
      caseRef: args.caseRef,
      requestId: args.requestId,
      accountIdHash: hashVelmereAccountBinding(args.accountId),
      entitlementId: args.entitlementId,
      tier: args.tier,
      targetHash: args.targetHash,
      snapshot: args.snapshot,
      pdfBytes: args.pdfBytes,
      storageMode: "memory",
    });
    const key = caseTierKey(record.caseRef, record.tier);
    const existing = memoryByCaseTier.get(key);
    if (existing) {
      if (!rowsEqual(existing, record)) return { ok: false, error: "audit_report_snapshot_immutable_conflict", retryable: false, storageMode: "memory" };
      return { ok: true, record: existing, idempotent: true };
    }
    memoryByCaseTier.set(key, record);
    memoryByReport.set(record.reportId, record);
    return { ok: true, record, idempotent: false };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "audit_report_snapshot_invalid"), retryable: false, storageMode: "memory" };
  }
}

export type CompleteProAuditWorkerSnapshotResult =
  | { ok: true; record: AuditReportSnapshotRecord; idempotent: boolean; reviewState: "completed"; attemptCount: number }
  | { ok: false; error: string; retryable: boolean; staleLease?: boolean };
export type CompleteAdvancedAuditWorkerSnapshotResult = CompleteProAuditWorkerSnapshotResult;

type CompleteWorkerArgs = {
  reportId: string;
  caseRef: string;
  requestId: string;
  accountId: string;
  entitlementId: string;
  targetHash: string;
  snapshot: ProAuditPdfSnapshot;
  pdfBytes: Uint8Array;
  workerPrincipal: string;
  leaseToken: string;
  reasonCode?: string;
};

async function completePaidWorkerLeaseWithExactPdf(tier: PaidTier, args: CompleteWorkerArgs): Promise<CompleteProAuditWorkerSnapshotResult> {
  if (!hasSupabaseServiceRoleConfig()) {
    return { ok: false, error: `${tier}_exact_pdf_atomic_durable_store_required`, retryable: true };
  }
  const workerPrincipal = clean(args.workerPrincipal, 180);
  const leaseToken = clean(args.leaseToken, 180);
  const reasonCode = clean(args.reasonCode ?? "worker_result", 80).replace(/[^a-zA-Z0-9:._-]+/g, "_");
  if (!workerPrincipal || leaseToken.length < 24) {
    return { ok: false, error: `${tier}_exact_pdf_atomic_binding_invalid`, retryable: false };
  }
  let record: AuditReportSnapshotRecord;
  try {
    record = buildRecord({
      reportId: args.reportId,
      caseRef: args.caseRef,
      requestId: args.requestId,
      accountIdHash: hashVelmereAccountBinding(args.accountId),
      entitlementId: args.entitlementId,
      tier,
      targetHash: args.targetHash,
      snapshot: args.snapshot,
      pdfBytes: args.pdfBytes,
      storageMode: "durable",
    });
  } catch (error) {
    return { ok: false, error: errorMessage(error, "audit_report_exact_pdf_invalid"), retryable: false };
  }
  try {
    const { data } = await runRegisteredServiceRoleRpc({
      operation: tier === "advanced"
        ? "audit_advanced_worker_complete_with_exact_pdf_v2"
        : "audit_pro_worker_complete_with_exact_pdf_v2",
      args: {
        p_case_ref: record.caseRef,
        p_worker_principal: workerPrincipal,
        p_lease_token: leaseToken,
        p_reason_code: reasonCode,
        p_report_id: record.reportId,
        p_request_id: record.requestId,
        p_account_id_hash: record.accountIdHash,
        p_entitlement_id: record.entitlementId,
        p_target_hash: record.targetHash,
        p_report_version_hash: record.reportVersionHash,
        p_snapshot_digest: record.snapshotDigest,
        p_source_receipt_root: record.sourceReceiptRoot,
        p_pdf_digest: record.pdfDigest,
        p_pdf_byte_length: record.pdfByteLength,
        p_render_contract_id: record.renderContractId,
        p_pdf_record_digest: record.pdfRecordDigest,
        p_pdf_base64: encodeP88AuditExactPdfBase64(record.pdfBytes),
        p_snapshot_json: record.snapshot,
        p_created_at: record.createdAt,
      },
    });
    const row = (data ?? {}) as Record<string, unknown>;
    if (row.ok !== true) {
      const error = clean(row.error, 180) || `${tier}_exact_pdf_atomic_completion_rejected`;
      return {
        ok: false,
        error,
        staleLease: row.staleLease === true,
        retryable: error === "review_orchestration_unavailable" || error.endsWith("_unavailable"),
      };
    }
    if (clean(row.reportId, 120) !== record.reportId
      || cleanSha256(row.reportVersionHash) !== record.reportVersionHash
      || cleanSha256(row.snapshotDigest) !== record.snapshotDigest
      || cleanSha256(row.sourceReceiptRoot) !== record.sourceReceiptRoot
      || cleanSha256(row.pdfDigest) !== record.pdfDigest
      || Number(row.pdfByteLength) !== record.pdfByteLength
      || clean(row.renderContractId, 120) !== record.renderContractId
      || cleanSha256(row.pdfRecordDigest) !== record.pdfRecordDigest) {
      return { ok: false, error: `${tier}_exact_pdf_atomic_receipt_mismatch`, retryable: true };
    }
    return {
      ok: true,
      record,
      idempotent: row.idempotent === true,
      reviewState: "completed",
      attemptCount: Math.max(0, Math.floor(Number(row.attemptCount ?? 0))),
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error, `${tier}_exact_pdf_atomic_completion_failed`), retryable: true };
  }
}

export async function completeProAuditWorkerLeaseWithSnapshot(args: CompleteWorkerArgs) {
  return completePaidWorkerLeaseWithExactPdf("pro", args);
}

export async function completeAdvancedAuditWorkerLeaseWithSnapshot(args: CompleteWorkerArgs) {
  return completePaidWorkerLeaseWithExactPdf("advanced", args);
}

function readIntegrityFailure(message: string) {
  return /(?:exact_pdf|snapshot_row|cross_binding|integrity|immutable|version)/.test(message);
}

export async function readAuditReportSnapshotForDelivery(args: {
  caseRef: string;
  accountId: string;
  entitlementId: string;
  tier: PaidTier;
  reportId?: string | null;
}): Promise<ReadAuditReportSnapshotResult> {
  const caseRef = cleanCaseRef(args.caseRef);
  const reportId = cleanReportId(args.reportId);
  const accountIdHash = hashVelmereAccountBinding(args.accountId);
  const entitlementId = clean(args.entitlementId, 180);
  if (!caseRef || !accountIdHash || !entitlementId) {
    return { ok: false, error: "audit_report_snapshot_read_binding_invalid", retryable: false, storageMode: hasSupabaseServiceRoleConfig() ? "durable" : "memory" };
  }

  if (hasSupabaseServiceRoleConfig()) {
    try {
      const supabase = getSupabaseServiceRoleClient();
      if (!supabase) throw new Error("audit_report_snapshot_service_role_unavailable");
      let query = supabase.from("velmere_audit_report_snapshots").select(SNAPSHOT_ROW_SELECT)
        .eq("case_ref", caseRef).eq("tier", args.tier);
      if (reportId) query = query.eq("report_id", reportId);
      const { data: snapshotData, error: snapshotError } = await query.maybeSingle();
      if (snapshotError) throw new Error(snapshotError.message);
      if (!snapshotData) return { ok: false, error: "audit_report_snapshot_not_ready", retryable: false, storageMode: "durable" };
      const actualReportId = cleanReportId((snapshotData as Record<string, unknown>).report_id);
      const { data: blobData, error: blobError } = await supabase
        .from("velmere_audit_report_pdf_blobs")
        .select(EXACT_PDF_ROW_SELECT)
        .eq("report_id", actualReportId)
        .maybeSingle();
      if (blobError) throw new Error(blobError.message);
      if (!blobData) return { ok: false, error: "audit_report_exact_pdf_bytes_withheld", retryable: false, storageMode: "durable" };
      const record = recordFromRows(snapshotData as Record<string, unknown>, blobData as Record<string, unknown>, "durable");
      if (record.accountIdHash !== accountIdHash || record.entitlementId !== entitlementId) {
        return { ok: false, error: "audit_report_snapshot_owner_mismatch", retryable: false, storageMode: "durable" };
      }
      return { ok: true, record };
    } catch (error) {
      const message = errorMessage(error, "audit_report_snapshot_read_failed");
      return { ok: false, error: message, retryable: !readIntegrityFailure(message), storageMode: "durable" };
    }
  }

  if (productionLike()) return { ok: false, error: "audit_report_snapshot_durable_store_required", retryable: true, storageMode: "memory" };
  const record = reportId ? memoryByReport.get(reportId) : memoryByCaseTier.get(caseTierKey(caseRef, args.tier));
  if (!record || record.caseRef !== caseRef || record.tier !== args.tier) {
    return { ok: false, error: "audit_report_snapshot_not_ready", retryable: false, storageMode: "memory" };
  }
  if (record.accountIdHash !== accountIdHash || record.entitlementId !== entitlementId) {
    return { ok: false, error: "audit_report_snapshot_owner_mismatch", retryable: false, storageMode: "memory" };
  }
  try {
    const verified = buildRecord({
      reportId: record.reportId,
      caseRef: record.caseRef,
      requestId: record.requestId,
      accountIdHash: record.accountIdHash,
      entitlementId: record.entitlementId,
      tier: record.tier,
      targetHash: record.targetHash,
      snapshot: record.snapshot,
      pdfBytes: record.pdfBytes,
      storageMode: "memory",
      expectedReportVersionHash: record.reportVersionHash,
      expectedPdfDigest: record.pdfDigest,
      expectedPdfByteLength: record.pdfByteLength,
      expectedRenderContractId: record.renderContractId,
      expectedRecordDigest: record.pdfRecordDigest,
      expectedCreatedAt: record.createdAt,
    });
    return { ok: true, record: verified };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "audit_report_snapshot_integrity_failed"), retryable: false, storageMode: "memory" };
  }
}

export function resetAuditReportSnapshotMemoryForTests() {
  memoryByCaseTier.clear();
  memoryByReport.clear();
}
