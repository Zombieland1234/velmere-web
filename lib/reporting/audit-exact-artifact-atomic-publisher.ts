import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase";
import { canonicalJson } from "@/lib/security/canonical-json";
import {
  buildAuditAccountMessageRecord,
  buildAuditAccountMessageSupabaseRow,
  parseAuditAccountMessageSupabaseRow,
  type AuditAccountMessageRecord,
  type StoreAuditAccountMessageInput,
} from "@/lib/account/audit-account-messages";
import {
  bindAuditAccountCustomerSnapshotToExactArtifact,
  hasExactAuditAccountArtifactBinding,
  verifyAuditAccountCustomerSnapshot,
  type AuditAccountCustomerSnapshot,
} from "@/lib/security/audit-account-customer-snapshot";
import {
  isPass4824ExactPdfAccountCustomerArtifactSnapshot,
  verifyPass4822AccountCustomerArtifactOwner,
  type AccountCustomerArtifactSnapshot,
} from "@/lib/reporting/account-customer-artifact-snapshot";
import {
  buildPass4824AccountCustomerArtifactPdfBlob,
  type AccountCustomerArtifactPdfBlob,
} from "@/lib/reporting/account-customer-artifact-pdf-blob";
import { parsePass4824AccountCustomerArtifactPdfBundleRpcResponse } from "@/lib/reporting/account-customer-artifact-store";

export const P83_AUDIT_EXACT_ARTIFACT_ATOMIC_PUBLICATION_ID =
  "p83-audit-exact-artifact-atomic-publication-v1" as const;
export const P83_AUDIT_EXACT_ARTIFACT_ATOMIC_PUBLICATION_RPC =
  "velmere_publish_audit_exact_artifact_v1" as const;
export const P83_AUDIT_EXACT_ARTIFACT_ATOMIC_PUBLICATION_RPC_SCHEMA =
  "p83-audit-exact-artifact-atomic-publication-rpc-v1" as const;
export const P83_AUDIT_EXACT_ARTIFACT_DURABLE_STORAGE_REQUIRED =
  "VELMERE_P83_AUDIT_EXACT_ARTIFACT_DURABLE_STORAGE_REQUIRED" as const;

export type P83AuditExactArtifactAtomicPublication = {
  schemaVersion: typeof P83_AUDIT_EXACT_ARTIFACT_ATOMIC_PUBLICATION_ID;
  source: "supabase";
  atomicDatabaseTransaction: true;
  createdArtifact: boolean;
  createdMessage: boolean;
  snapshot: AccountCustomerArtifactSnapshot;
  blob: AccountCustomerArtifactPdfBlob;
  auditSnapshot: AuditAccountCustomerSnapshot & {
    exactAccountArtifact: NonNullable<AuditAccountCustomerSnapshot["exactAccountArtifact"]>;
  };
  message: AuditAccountMessageRecord;
};

function blobMetadata(blob: AccountCustomerArtifactPdfBlob) {
  return {
    schemaVersion: blob.schemaVersion,
    blobId: blob.blobId,
    snapshotId: blob.snapshotId,
    accountIdHash: blob.accountIdHash,
    surface: blob.surface,
    reportId: blob.reportId,
    artifactDigest: blob.artifactDigest,
    pdfDigest: blob.pdfDigest,
    pdfByteLength: blob.pdfByteLength,
    mimeType: blob.mimeType,
    createdAt: blob.createdAt,
    recordDigest: blob.recordDigest,
  } as const;
}

function normalizeMessageInstant(value: string | undefined) {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("audit_exact_artifact_atomic_publish_message_timestamp_invalid");
  }
  return parsed.toISOString();
}

function atomicMessageProjection(record: AuditAccountMessageRecord) {
  return {
    id: record.id,
    title: record.title,
    body: record.body,
    status: record.status,
    packageLabel: record.packageLabel,
    requestId: record.requestId,
    createdAt: normalizeMessageInstant(record.createdAt),
    eta: record.eta,
    accountRoute: record.accountRoute,
    nextSteps: record.nextSteps,
    accountId: record.accountId,
    contactEmail: record.contactEmail,
    locale: record.locale,
    reviewLevel: record.reviewLevel,
    projectName: record.projectName,
    contractAddress: record.contractAddress,
    publicReportRoute: record.publicReportRoute,
    adminRoute: record.adminRoute,
    exportRoute: record.exportRoute,
    pdfRoute: record.pdfRoute,
    deliveryChannel: record.deliveryChannel,
    deliveryStatus: record.deliveryStatus,
    operatorStatus: record.operatorStatus,
    operatorNote: record.operatorNote,
    customerSafeReport: record.customerSafeReport,
    canonicalCustomerSnapshot: record.canonicalCustomerSnapshot,
    actionLog: record.actionLog,
    source: record.source,
    updatedAt: normalizeMessageInstant(record.updatedAt),
    deliveredAt: normalizeMessageInstant(record.deliveredAt),
    auditQueueId: record.auditQueueId,
    auditCaseRef: record.auditCaseRef,
    paymentEvidenceRefs: record.paymentEvidenceRefs,
  } as const;
}

function assertReturnedMessage(args: {
  returned: AuditAccountMessageRecord;
  expected: AuditAccountMessageRecord;
  accountId: string;
  auditSnapshot: AuditAccountCustomerSnapshot;
}) {
  const returned = args.returned;
  const expected = args.expected;
  if (returned.source !== "supabase"
    || returned.accountId !== args.accountId
    || !returned.canonicalCustomerSnapshot
    || canonicalJson(returned.canonicalCustomerSnapshot) !== canonicalJson(args.auditSnapshot)
    || !hasExactAuditAccountArtifactBinding(returned.canonicalCustomerSnapshot)
    || returned.canonicalCustomerSnapshot.exactAccountArtifact.snapshotId
      !== args.auditSnapshot.exactAccountArtifact?.snapshotId
    || canonicalJson(atomicMessageProjection(returned))
      !== canonicalJson(atomicMessageProjection(expected))) {
    throw new Error("audit_exact_artifact_atomic_publish_message_response_invalid");
  }
}

/**
 * Publishes one exact Audit snapshot, its already-rendered PDF bytes and the
 * account-message link through a single service-role PostgreSQL function.
 * There is deliberately no memory or two-write fallback: without the migration
 * and durable service-role storage the customer delivery fails closed.
 */
export async function publishP83AuditExactArtifactAtomically(args: {
  accountId: string;
  messageInput: StoreAuditAccountMessageInput;
  auditSnapshot: AuditAccountCustomerSnapshot;
  accountArtifactSnapshot: AccountCustomerArtifactSnapshot;
  pdfBytes: Uint8Array;
  client?: SupabaseClient | null;
}): Promise<P83AuditExactArtifactAtomicPublication> {
  if (!args.accountId || args.accountId.length > 120 || args.accountId.startsWith("preview:")) {
    throw new Error("audit_exact_artifact_atomic_publish_real_owner_required");
  }
  if (!verifyAuditAccountCustomerSnapshot(args.auditSnapshot)
    || args.auditSnapshot.exactAccountArtifact !== undefined) {
    throw new Error("audit_exact_artifact_atomic_publish_base_snapshot_invalid");
  }
  if (!isPass4824ExactPdfAccountCustomerArtifactSnapshot(args.accountArtifactSnapshot)
    || args.accountArtifactSnapshot.surface !== "audit"
    || args.accountArtifactSnapshot.payloadKind !== "audit_customer_report_v1") {
    throw new Error("audit_exact_artifact_atomic_publish_account_snapshot_invalid");
  }
  if (!verifyPass4822AccountCustomerArtifactOwner(args.accountArtifactSnapshot, args.accountId)) {
    throw new Error("audit_exact_artifact_atomic_publish_owner_mismatch");
  }

  const proposedBlob = buildPass4824AccountCustomerArtifactPdfBlob({
    accountId: args.accountId,
    snapshot: args.accountArtifactSnapshot,
    pdfBytes: args.pdfBytes,
  });
  const boundAuditSnapshot = bindAuditAccountCustomerSnapshotToExactArtifact({
    snapshot: args.auditSnapshot,
    accountArtifactSnapshot: args.accountArtifactSnapshot,
    pdfBlob: proposedBlob,
    accountId: args.accountId,
  });
  if (!hasExactAuditAccountArtifactBinding(boundAuditSnapshot)) {
    throw new Error("audit_exact_artifact_atomic_publish_binding_invalid");
  }

  const expectedMessage = buildAuditAccountMessageRecord({
    ...args.messageInput,
    accountId: args.accountId,
    canonicalCustomerSnapshot: boundAuditSnapshot,
  }, "supabase");
  if (expectedMessage.accountId !== args.accountId) {
    throw new Error("audit_exact_artifact_atomic_publish_message_owner_mismatch");
  }

  const supabase = args.client === undefined ? getSupabaseServiceRoleClient() : args.client;
  if (!supabase) throw new Error(P83_AUDIT_EXACT_ARTIFACT_DURABLE_STORAGE_REQUIRED);

  const { data, error } = await supabase.rpc(P83_AUDIT_EXACT_ARTIFACT_ATOMIC_PUBLICATION_RPC, {
    p_account_id: args.accountId,
    p_snapshot: args.accountArtifactSnapshot,
    p_payload_canonical: canonicalJson(args.accountArtifactSnapshot.payload),
    p_blob: blobMetadata(proposedBlob),
    p_pdf_base64: Buffer.from(proposedBlob.pdfBytes).toString("base64"),
    p_audit_snapshot: boundAuditSnapshot,
    p_message: buildAuditAccountMessageSupabaseRow(expectedMessage),
  });
  if (error) throw new Error(`audit_exact_artifact_atomic_publish_failed:${error.message}`);

  const payload = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!payload
    || payload.schemaVersion !== P83_AUDIT_EXACT_ARTIFACT_ATOMIC_PUBLICATION_RPC_SCHEMA
    || typeof payload.createdMessage !== "boolean"
    || !payload.bundle
    || !payload.message) {
    throw new Error("audit_exact_artifact_atomic_publish_failed:invalid_rpc_response");
  }
  const bundle = parsePass4824AccountCustomerArtifactPdfBundleRpcResponse({
    payload: payload.bundle,
    accountId: args.accountId,
    expectedSnapshot: args.accountArtifactSnapshot,
    proposedBlob,
  });
  const message = parseAuditAccountMessageSupabaseRow(payload.message as Record<string, unknown>);
  assertReturnedMessage({
    returned: message,
    expected: expectedMessage,
    accountId: args.accountId,
    auditSnapshot: boundAuditSnapshot,
  });

  return {
    schemaVersion: P83_AUDIT_EXACT_ARTIFACT_ATOMIC_PUBLICATION_ID,
    source: "supabase",
    atomicDatabaseTransaction: true,
    createdArtifact: bundle.created,
    createdMessage: payload.createdMessage,
    snapshot: bundle.snapshot,
    blob: bundle.blob,
    auditSnapshot: boundAuditSnapshot,
    message,
  };
}
