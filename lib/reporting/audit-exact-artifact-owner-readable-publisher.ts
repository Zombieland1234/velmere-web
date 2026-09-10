import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase";
import { canonicalJson } from "@/lib/security/canonical-json";
import {
  buildAuditAccountMessageRecord,
  buildAuditAccountMessageSupabaseRow,
  parseAuditAccountMessageSupabaseRow,
  parseP84AuditCustomerArtifactLinkRow,
  type AuditAccountMessageRecord,
  type P84AuditCustomerArtifactLinkRecord,
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

export const P84_AUDIT_EXACT_ARTIFACT_OWNER_READABLE_PUBLICATION_ID =
  "p84-audit-exact-artifact-owner-readable-publication-v2" as const;
export const P84_AUDIT_EXACT_ARTIFACT_OWNER_READABLE_PUBLICATION_RPC =
  "velmere_publish_audit_exact_artifact_v2" as const;
export const P84_AUDIT_EXACT_ARTIFACT_OWNER_READABLE_PUBLICATION_RPC_SCHEMA =
  "p84-audit-exact-artifact-owner-readable-publication-rpc-v2" as const;
export const P84_AUDIT_EXACT_ARTIFACT_DURABLE_STORAGE_REQUIRED =
  "VELMERE_P84_AUDIT_EXACT_ARTIFACT_DURABLE_STORAGE_REQUIRED" as const;

const P84_RPC_KEYS = [
  "schemaVersion",
  "createdArtifact",
  "createdMessage",
  "createdLink",
  "snapshot",
  "blob",
  "message",
  "link",
] as const;

export type P84AuditExactArtifactOwnerReadablePublication = {
  schemaVersion: typeof P84_AUDIT_EXACT_ARTIFACT_OWNER_READABLE_PUBLICATION_ID;
  source: "supabase";
  atomicDatabaseTransaction: true;
  ownerReadableLinkCommitted: true;
  createdArtifact: boolean;
  createdMessage: boolean;
  createdLink: boolean;
  snapshot: AccountCustomerArtifactSnapshot;
  blob: AccountCustomerArtifactPdfBlob;
  auditSnapshot: AuditAccountCustomerSnapshot & {
    exactAccountArtifact: NonNullable<AuditAccountCustomerSnapshot["exactAccountArtifact"]>;
  };
  message: AuditAccountMessageRecord;
  link: P84AuditCustomerArtifactLinkRecord;
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

function normalizeInstant(value: string | undefined, errorCode: string) {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(errorCode);
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
    createdAt: normalizeInstant(record.createdAt, "audit_exact_artifact_owner_readable_message_timestamp_invalid"),
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
    updatedAt: normalizeInstant(record.updatedAt, "audit_exact_artifact_owner_readable_message_timestamp_invalid"),
    deliveredAt: normalizeInstant(record.deliveredAt, "audit_exact_artifact_owner_readable_message_timestamp_invalid"),
    auditQueueId: record.auditQueueId,
    auditCaseRef: record.auditCaseRef,
    paymentEvidenceRefs: record.paymentEvidenceRefs,
  } as const;
}

function assertExactObjectKeys(value: Record<string, unknown>, expected: readonly string[], errorCode: string) {
  const actual = Object.keys(value).sort();
  const closed = [...expected].sort();
  if (actual.length !== closed.length || actual.some((key, index) => key !== closed[index])) {
    throw new Error(errorCode);
  }
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
    throw new Error("audit_exact_artifact_owner_readable_message_response_invalid");
  }
}

function assertReturnedLink(args: {
  link: P84AuditCustomerArtifactLinkRecord;
  accountId: string;
  snapshot: AccountCustomerArtifactSnapshot;
  blob: AccountCustomerArtifactPdfBlob;
  auditSnapshot: AuditAccountCustomerSnapshot;
  message: AuditAccountMessageRecord;
}) {
  const exact = args.auditSnapshot.exactAccountArtifact;
  const messageUpdatedAt = normalizeInstant(
    args.message.updatedAt,
    "audit_exact_artifact_owner_readable_message_timestamp_invalid",
  );
  if (!exact
    || args.link.accountId !== args.accountId
    || args.link.snapshotId !== args.snapshot.snapshotId
    || args.link.messageId !== args.message.id
    || args.link.auditSnapshotDigest !== args.auditSnapshot.snapshotDigest
    || args.link.artifactSnapshotDigest !== args.snapshot.snapshotDigest
    || args.link.artifactDigest !== args.snapshot.canonicalArtifact.artifactDigest
    || args.link.pdfBlobId !== args.blob.blobId
    || args.link.pdfDigest !== args.blob.pdfDigest
    || args.link.snapshotId !== exact.snapshotId
    || args.link.pdfBlobId !== exact.pdfBlobId
    || args.link.artifactDigest !== exact.artifactDigest
    || args.link.pdfDigest !== exact.pdfDigest
    || args.link.linkedAt !== messageUpdatedAt
    || args.link.createdAt !== messageUpdatedAt) {
    throw new Error("audit_exact_artifact_owner_readable_link_response_invalid");
  }
}

/**
 * Publishes the exact Audit snapshot, immutable PDF, complete internal account
 * message and the minimal owner-readable link through one service-role RPC.
 * The P84 link is the only customer-readable publication indicator; the full
 * message ledger remains operator-only. There is no memory or multi-write
 * fallback, so a missing migration or any cross-binding mismatch fails closed.
 */
export async function publishP84AuditExactArtifactOwnerReadable(args: {
  accountId: string;
  messageInput: StoreAuditAccountMessageInput;
  auditSnapshot: AuditAccountCustomerSnapshot;
  accountArtifactSnapshot: AccountCustomerArtifactSnapshot;
  pdfBytes: Uint8Array;
  client?: SupabaseClient | null;
}): Promise<P84AuditExactArtifactOwnerReadablePublication> {
  if (!args.accountId || args.accountId.length > 120 || args.accountId.startsWith("preview:")) {
    throw new Error("audit_exact_artifact_owner_readable_real_owner_required");
  }
  if (!verifyAuditAccountCustomerSnapshot(args.auditSnapshot)
    || args.auditSnapshot.exactAccountArtifact !== undefined) {
    throw new Error("audit_exact_artifact_owner_readable_base_snapshot_invalid");
  }
  if (!isPass4824ExactPdfAccountCustomerArtifactSnapshot(args.accountArtifactSnapshot)
    || args.accountArtifactSnapshot.surface !== "audit"
    || args.accountArtifactSnapshot.payloadKind !== "audit_customer_report_v1") {
    throw new Error("audit_exact_artifact_owner_readable_account_snapshot_invalid");
  }
  if (!verifyPass4822AccountCustomerArtifactOwner(args.accountArtifactSnapshot, args.accountId)) {
    throw new Error("audit_exact_artifact_owner_readable_owner_mismatch");
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
    throw new Error("audit_exact_artifact_owner_readable_binding_invalid");
  }

  const expectedMessage = buildAuditAccountMessageRecord({
    ...args.messageInput,
    accountId: args.accountId,
    canonicalCustomerSnapshot: boundAuditSnapshot,
  }, "supabase");
  if (expectedMessage.accountId !== args.accountId) {
    throw new Error("audit_exact_artifact_owner_readable_message_owner_mismatch");
  }

  const supabase = args.client === undefined ? getSupabaseServiceRoleClient() : args.client;
  if (!supabase) throw new Error(P84_AUDIT_EXACT_ARTIFACT_DURABLE_STORAGE_REQUIRED);

  const { data, error } = await supabase.rpc(P84_AUDIT_EXACT_ARTIFACT_OWNER_READABLE_PUBLICATION_RPC, {
    p_account_id: args.accountId,
    p_snapshot: args.accountArtifactSnapshot,
    p_payload_canonical: canonicalJson(args.accountArtifactSnapshot.payload),
    p_blob: blobMetadata(proposedBlob),
    p_pdf_base64: Buffer.from(proposedBlob.pdfBytes).toString("base64"),
    p_audit_snapshot: boundAuditSnapshot,
    p_message: buildAuditAccountMessageSupabaseRow(expectedMessage),
  });
  if (error) throw new Error(`audit_exact_artifact_owner_readable_publish_failed:${error.message}`);

  const payload = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!payload) throw new Error("audit_exact_artifact_owner_readable_publish_failed:invalid_rpc_response");
  assertExactObjectKeys(
    payload,
    P84_RPC_KEYS,
    "audit_exact_artifact_owner_readable_publish_failed:invalid_rpc_response_shape",
  );
  if (payload.schemaVersion !== P84_AUDIT_EXACT_ARTIFACT_OWNER_READABLE_PUBLICATION_RPC_SCHEMA
    || typeof payload.createdArtifact !== "boolean"
    || typeof payload.createdMessage !== "boolean"
    || typeof payload.createdLink !== "boolean"
    || typeof payload.snapshot !== "object"
    || payload.snapshot === null
    || typeof payload.blob !== "object"
    || payload.blob === null
    || typeof payload.message !== "object"
    || payload.message === null
    || typeof payload.link !== "object"
    || payload.link === null) {
    throw new Error("audit_exact_artifact_owner_readable_publish_failed:invalid_rpc_response");
  }

  const bundle = parsePass4824AccountCustomerArtifactPdfBundleRpcResponse({
    payload: {
      schemaVersion: "pass4824-account-customer-artifact-pdf-bundle-rpc-v1",
      created: payload.createdArtifact,
      snapshot: payload.snapshot,
      blob: payload.blob,
    },
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
  const link = parseP84AuditCustomerArtifactLinkRow(payload.link as Record<string, unknown>, {
    accountId: args.accountId,
    snapshotId: bundle.snapshot.snapshotId,
  });
  assertReturnedLink({
    link,
    accountId: args.accountId,
    snapshot: bundle.snapshot,
    blob: bundle.blob,
    auditSnapshot: boundAuditSnapshot,
    message,
  });

  return {
    schemaVersion: P84_AUDIT_EXACT_ARTIFACT_OWNER_READABLE_PUBLICATION_ID,
    source: "supabase",
    atomicDatabaseTransaction: true,
    ownerReadableLinkCommitted: true,
    createdArtifact: payload.createdArtifact,
    createdMessage: payload.createdMessage,
    createdLink: payload.createdLink,
    snapshot: bundle.snapshot,
    blob: bundle.blob,
    auditSnapshot: boundAuditSnapshot,
    message,
    link,
  };
}
