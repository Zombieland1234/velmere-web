import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import { canonicalJson } from "@/lib/security/canonical-json";
import {
  isPass4824ExactPdfAccountCustomerArtifactSnapshot,
  verifyPass4822AccountCustomerArtifactOwner,
  verifyPass4822AccountCustomerArtifactSnapshot,
  type AccountCustomerArtifactSnapshot,
} from "@/lib/reporting/account-customer-artifact-snapshot";
import {
  assertPass4824PdfBlobMatchesSnapshot,
  buildPass4824AccountCustomerArtifactPdfBlob,
  verifyPass4824AccountCustomerArtifactPdfBlob,
  verifyPass4824AccountCustomerArtifactPdfBlobMetadata,
  type AccountCustomerArtifactPdfBlob,
  type AccountCustomerArtifactPdfBlobMetadata,
} from "@/lib/reporting/account-customer-artifact-pdf-blob";

export const PASS4822_ACCOUNT_CUSTOMER_ARTIFACT_STORE_ID = "pass4822-account-customer-artifact-store-v1" as const;
export const PASS4822_ACCOUNT_ARTIFACT_DURABLE_STORAGE_REQUIRED = "VELMERE_ACCOUNT_ARTIFACT_DURABLE_STORAGE_REQUIRED" as const;

const TABLE_NAME = "velmere_customer_artifact_snapshots";
const ROW_SELECT =
  "snapshot_id,account_id,account_id_hash,surface,payload_kind,report_id,artifact_digest,snapshot_digest,pdf_storage,snapshot,generated_at";
const memoryStore = new Map<string, AccountCustomerArtifactSnapshot>();
const PDF_TABLE_NAME = "velmere_customer_artifact_pdf_blobs";
export const PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_BUNDLE_RPC_NAME = "velmere_store_customer_artifact_pdf_bundle_v1" as const;
const PDF_ROW_SELECT =
  "schema_version,blob_id,snapshot_id,account_id,account_id_hash,surface,report_id,artifact_digest,pdf_digest,pdf_byte_length,mime_type,pdf_bytes,created_at,record_digest";
const PDF_METADATA_ROW_SELECT =
  "schema_version,blob_id,snapshot_id,account_id,account_id_hash,surface,report_id,artifact_digest,pdf_digest,pdf_byte_length,mime_type,created_at,record_digest";
const pdfMemoryStore = new Map<string, AccountCustomerArtifactPdfBlob>();

function productionStrict() {
  return process.env.NODE_ENV === "production";
}

function assertDurableStorage() {
  if (productionStrict() && !hasSupabaseServiceRoleConfig()) throw new Error(PASS4822_ACCOUNT_ARTIFACT_DURABLE_STORAGE_REQUIRED);
}

function cloneSnapshot(snapshot: AccountCustomerArtifactSnapshot) {
  return structuredClone(snapshot);
}

function snapshotPdfStorage(snapshot: AccountCustomerArtifactSnapshot) {
  return isPass4824ExactPdfAccountCustomerArtifactSnapshot(snapshot)
    ? "exact_immutable_blob"
    : "legacy_deterministic_rerender";
}

export function parsePass4822AccountCustomerArtifactSnapshotRow(row: Record<string, unknown>, expectedAccountId?: string) {
  const value = row.snapshot;
  if (!verifyPass4822AccountCustomerArtifactSnapshot(value)) throw new Error("account_customer_artifact_row_invalid");
  if (String(row.snapshot_id ?? "") !== value.snapshotId) throw new Error("account_customer_artifact_row_snapshot_id_mismatch");
  if (expectedAccountId !== undefined && String(row.account_id ?? "") !== expectedAccountId) {
    throw new Error("account_customer_artifact_owner_immutable_conflict");
  }
  if (String(row.account_id_hash ?? "") !== value.accountIdHash) throw new Error("account_customer_artifact_row_account_hash_mismatch");
  if (String(row.surface ?? "") !== value.surface) throw new Error("account_customer_artifact_row_surface_mismatch");
  if (String(row.payload_kind ?? "") !== value.payloadKind) throw new Error("account_customer_artifact_row_payload_kind_mismatch");
  if (String(row.report_id ?? "") !== value.reportId) throw new Error("account_customer_artifact_row_report_id_mismatch");
  if (String(row.artifact_digest ?? "") !== value.canonicalArtifact.artifactDigest) throw new Error("account_customer_artifact_row_artifact_digest_mismatch");
  if (String(row.snapshot_digest ?? "") !== value.snapshotDigest) throw new Error("account_customer_artifact_row_snapshot_digest_mismatch");
  if (String(row.pdf_storage ?? "") !== snapshotPdfStorage(value)) {
    throw new Error("account_customer_artifact_row_pdf_storage_mismatch");
  }
  let generatedAt: string;
  try {
    generatedAt = new Date(String(row.generated_at ?? "")).toISOString();
  } catch {
    throw new Error("account_customer_artifact_row_generated_at_mismatch");
  }
  if (generatedAt !== value.generatedAt) throw new Error("account_customer_artifact_row_generated_at_mismatch");
  return cloneSnapshot(value);
}

function toRow(snapshot: AccountCustomerArtifactSnapshot, accountId: string) {
  return {
    snapshot_id: snapshot.snapshotId,
    account_id: accountId,
    account_id_hash: snapshot.accountIdHash,
    surface: snapshot.surface,
    payload_kind: snapshot.payloadKind,
    report_id: snapshot.reportId,
    artifact_digest: snapshot.canonicalArtifact.artifactDigest,
    snapshot_digest: snapshot.snapshotDigest,
    pdf_storage: snapshotPdfStorage(snapshot),
    snapshot: cloneSnapshot(snapshot),
    generated_at: snapshot.generatedAt,
  };
}

function uniqueViolation(error: { code?: string | null } | null) {
  return error?.code === "23505";
}

async function readExistingSnapshotRow(supabase: SupabaseClient, snapshotId: string) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(ROW_SELECT)
    .eq("snapshot_id", snapshotId)
    .maybeSingle();
  if (error) throw new Error("account_customer_artifact_existing_read_failed:" + error.message);
  return data ? (data as Record<string, unknown>) : null;
}

function verifyImmutableExistingSnapshot(args: {
  row: Record<string, unknown>;
  accountId: string;
  snapshot: AccountCustomerArtifactSnapshot;
}) {
  const existing = parsePass4822AccountCustomerArtifactSnapshotRow(args.row, args.accountId);
  if (!verifyPass4822AccountCustomerArtifactOwner(existing, args.accountId)) {
    throw new Error("account_customer_artifact_owner_immutable_conflict");
  }
  if (
    existing.snapshotDigest !== args.snapshot.snapshotDigest ||
    existing.canonicalArtifact.artifactDigest !== args.snapshot.canonicalArtifact.artifactDigest
  ) {
    throw new Error("account_customer_artifact_immutable_conflict");
  }
  return existing;
}

function decodeStoredPdfBytes(value: unknown) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (typeof value !== "string") throw new Error("account_customer_artifact_pdf_bytes_invalid");
  if (value.startsWith("\\x") && /^[a-f0-9]+$/i.test(value.slice(2)) && value.length % 2 === 0) {
    return new Uint8Array(Buffer.from(value.slice(2), "hex"));
  }
  try { return new Uint8Array(Buffer.from(value, "base64")); }
  catch { throw new Error("account_customer_artifact_pdf_bytes_invalid"); }
}

function fromPdfMetadataValue(value: unknown, expectedAccountId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("account_customer_artifact_pdf_row_invalid");
  }
  const row = value as Record<string, unknown>;
  if (row.account_id !== undefined && String(row.account_id) !== expectedAccountId) {
    throw new Error("account_customer_artifact_pdf_owner_immutable_conflict");
  }
  const blob: AccountCustomerArtifactPdfBlobMetadata = {
    schemaVersion: row.schemaVersion ?? row.schema_version,
    blobId: row.blobId ?? row.blob_id,
    snapshotId: row.snapshotId ?? row.snapshot_id,
    accountIdHash: row.accountIdHash ?? row.account_id_hash,
    surface: row.surface,
    reportId: row.reportId ?? row.report_id,
    artifactDigest: row.artifactDigest ?? row.artifact_digest,
    pdfDigest: row.pdfDigest ?? row.pdf_digest,
    pdfByteLength: Number(row.pdfByteLength ?? row.pdf_byte_length),
    mimeType: row.mimeType ?? row.mime_type,
    createdAt: new Date(String(row.createdAt ?? row.created_at ?? "")).toISOString(),
    recordDigest: String(row.recordDigest ?? row.record_digest ?? ""),
  } as AccountCustomerArtifactPdfBlobMetadata;
  if (!verifyPass4824AccountCustomerArtifactPdfBlobMetadata(blob)) {
    throw new Error("account_customer_artifact_pdf_row_invalid");
  }
  if (blob.accountIdHash !== hashVelmereAccountBinding(expectedAccountId)) {
    throw new Error("account_customer_artifact_pdf_owner_immutable_conflict");
  }
  return blob;
}

function fromPdfValue(value: unknown, expectedAccountId: string) {
  const metadata = fromPdfMetadataValue(value, expectedAccountId);
  const row = value as Record<string, unknown>;
  const blob = {
    ...metadata,
    pdfBytes: decodeStoredPdfBytes(row.pdfBase64 ?? row.pdf_base64 ?? row.pdf_bytes),
  };
  if (!verifyPass4824AccountCustomerArtifactPdfBlob(blob)) {
    throw new Error("account_customer_artifact_pdf_row_invalid");
  }
  return blob;
}

function immutablePdfMatch(args: {
  existing: AccountCustomerArtifactPdfBlob;
  proposed: AccountCustomerArtifactPdfBlob;
  snapshot: AccountCustomerArtifactSnapshot;
  accountId: string;
}) {
  assertPass4824PdfBlobMatchesSnapshot({ blob: args.existing, snapshot: args.snapshot, accountId: args.accountId });
  if (args.existing.blobId !== args.proposed.blobId
    || args.existing.recordDigest !== args.proposed.recordDigest
    || args.existing.pdfDigest !== args.proposed.pdfDigest
    || args.existing.pdfByteLength !== args.proposed.pdfByteLength) {
    throw new Error("account_customer_artifact_pdf_immutable_conflict");
  }
  return args.existing;
}

function clonePdfBlob(blob: AccountCustomerArtifactPdfBlob) {
  return { ...blob, pdfBytes: new Uint8Array(blob.pdfBytes) };
}

function clonePdfMetadata(blob: AccountCustomerArtifactPdfBlobMetadata) {
  return { ...blob };
}

export function parsePass4824AccountCustomerArtifactPdfBundleRpcResponse(args: {
  payload: unknown;
  accountId: string;
  expectedSnapshot: AccountCustomerArtifactSnapshot;
  proposedBlob: AccountCustomerArtifactPdfBlob;
}) {
  const payload = (Array.isArray(args.payload) ? args.payload[0] : args.payload) as Record<string, unknown> | null;
  if (!payload
    || payload.schemaVersion !== "pass4824-account-customer-artifact-pdf-bundle-rpc-v1"
    || !verifyPass4822AccountCustomerArtifactSnapshot(payload.snapshot)) {
    throw new Error("account_customer_artifact_pdf_atomic_write_failed:invalid_rpc_response");
  }
  const storedSnapshot = payload.snapshot;
  const storedBlob = fromPdfValue(payload.blob, args.accountId);
  verifyImmutableExistingSnapshot({
    row: toRow(storedSnapshot, args.accountId),
    accountId: args.accountId,
    snapshot: args.expectedSnapshot,
  });
  immutablePdfMatch({
    existing: storedBlob,
    proposed: args.proposedBlob,
    snapshot: storedSnapshot,
    accountId: args.accountId,
  });
  return {
    snapshot: cloneSnapshot(storedSnapshot),
    blob: clonePdfBlob(storedBlob),
    created: payload.created === true,
  };
}

export async function storePass4822AccountCustomerArtifactSnapshot(args: {
  accountId: string;
  snapshot: AccountCustomerArtifactSnapshot;
  client?: SupabaseClient | null;
}) {
  if (!verifyPass4822AccountCustomerArtifactSnapshot(args.snapshot)) throw new Error("account_customer_artifact_snapshot_invalid");
  if (!verifyPass4822AccountCustomerArtifactOwner(args.snapshot, args.accountId)) throw new Error("account_customer_artifact_owner_mismatch");
  if (isPass4824ExactPdfAccountCustomerArtifactSnapshot(args.snapshot)) {
    throw new Error("account_customer_artifact_exact_pdf_requires_atomic_bundle");
  }
  const supabase = args.client === undefined ? getSupabaseServiceRoleClient() : args.client;
  if (supabase) {
    const existingRow = await readExistingSnapshotRow(supabase, args.snapshot.snapshotId);
    if (existingRow) {
      const existing = verifyImmutableExistingSnapshot({
        row: existingRow,
        accountId: args.accountId,
        snapshot: args.snapshot,
      });
      return { snapshot: cloneSnapshot(existing), source: "supabase" as const, created: false };
    }
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(toRow(args.snapshot, args.accountId))
      .select(ROW_SELECT)
      .maybeSingle();
    if (error) {
      if (!uniqueViolation(error)) {
        throw new Error("account_customer_artifact_durable_write_failed:" + error.message);
      }
      const racedRow = await readExistingSnapshotRow(supabase, args.snapshot.snapshotId);
      if (!racedRow) throw new Error("account_customer_artifact_durable_conflict_without_row");
      const existing = verifyImmutableExistingSnapshot({
        row: racedRow,
        accountId: args.accountId,
        snapshot: args.snapshot,
      });
      return { snapshot: existing, source: "supabase" as const, created: false };
    }
    if (!data) throw new Error("account_customer_artifact_durable_write_failed:no_row_returned");
    return {
      snapshot: parsePass4822AccountCustomerArtifactSnapshotRow(data as Record<string, unknown>, args.accountId),
      source: "supabase" as const,
      created: true,
    };
  }
  assertDurableStorage();
  const existing = memoryStore.get(args.snapshot.snapshotId);
  if (existing) {
    if (!verifyPass4822AccountCustomerArtifactOwner(existing, args.accountId)) throw new Error("account_customer_artifact_owner_immutable_conflict");
    if (existing.snapshotDigest !== args.snapshot.snapshotDigest) throw new Error("account_customer_artifact_immutable_conflict");
    return { snapshot: cloneSnapshot(existing), source: "memory" as const, created: false };
  }
  const stored = cloneSnapshot(args.snapshot);
  memoryStore.set(stored.snapshotId, stored);
  return { snapshot: cloneSnapshot(stored), source: "memory" as const, created: true };
}

/**
 * Stores the immutable snapshot and its exact, already-rendered PDF bytes in one
 * database transaction. A missing RPC/migration is an error; this function never
 * degrades to two independent durable writes.
 */
export async function storePass4824AccountCustomerArtifactPdfBundle(args: {
  accountId: string;
  snapshot: AccountCustomerArtifactSnapshot;
  pdfBytes: Uint8Array;
  client?: SupabaseClient | null;
  userAccessToken?: string;
}) {
  if (!isPass4824ExactPdfAccountCustomerArtifactSnapshot(args.snapshot)) {
    throw new Error("account_customer_artifact_pdf_exact_marker_required");
  }
  const proposed = buildPass4824AccountCustomerArtifactPdfBlob(args);
  const supabase = args.client === undefined ? getSupabaseServiceRoleClient() : args.client;
  if (supabase) {
    const { data, error } = await supabase.rpc(PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_BUNDLE_RPC_NAME, {
      p_account_id: args.accountId,
      p_snapshot: args.snapshot,
      p_payload_canonical: canonicalJson(args.snapshot.payload),
      p_blob: {
        schemaVersion: proposed.schemaVersion,
        blobId: proposed.blobId,
        snapshotId: proposed.snapshotId,
        accountIdHash: proposed.accountIdHash,
        surface: proposed.surface,
        reportId: proposed.reportId,
        artifactDigest: proposed.artifactDigest,
        pdfDigest: proposed.pdfDigest,
        pdfByteLength: proposed.pdfByteLength,
        mimeType: proposed.mimeType,
        createdAt: proposed.createdAt,
        recordDigest: proposed.recordDigest,
      },
      p_pdf_base64: Buffer.from(proposed.pdfBytes).toString("base64"),
    });
    if (error) {
      throw new Error(`account_customer_artifact_pdf_atomic_write_failed:${error.message}`);
    }
    const verified = parsePass4824AccountCustomerArtifactPdfBundleRpcResponse({
      payload: data,
      accountId: args.accountId,
      expectedSnapshot: args.snapshot,
      proposedBlob: proposed,
    });
    return { ...verified, source: "supabase" as const };
  }

  const bridgeUrl = String(process.env.VELMERE_ACCOUNT_ARTIFACT_WRITE_BRIDGE_URL ?? "").trim();
  const serverCapability = String(process.env.VELMERE_BROWSER_SERVER_CAPABILITY ?? "").trim();
  const userAccessToken = String(args.userAccessToken ?? "").trim();
  if (bridgeUrl && serverCapability && userAccessToken) {
    const target = new URL(bridgeUrl);
    if (target.protocol !== "https:" || !target.hostname.endsWith(".supabase.co")) {
      throw new Error("account_customer_artifact_bridge_origin_invalid");
    }
    const body = JSON.stringify({
      schemaVersion: "velmere.r7.browser-artifact-write-bridge-request.v1",
      accountId: args.accountId,
      snapshot: args.snapshot,
      payloadCanonical: canonicalJson(args.snapshot.payload),
      blob: {
        schemaVersion: proposed.schemaVersion,
        blobId: proposed.blobId,
        snapshotId: proposed.snapshotId,
        accountIdHash: proposed.accountIdHash,
        surface: proposed.surface,
        reportId: proposed.reportId,
        artifactDigest: proposed.artifactDigest,
        pdfDigest: proposed.pdfDigest,
        pdfByteLength: proposed.pdfByteLength,
        mimeType: proposed.mimeType,
        createdAt: proposed.createdAt,
        recordDigest: proposed.recordDigest,
      },
      pdfBase64: Buffer.from(proposed.pdfBytes).toString("base64"),
    });
    const response = await fetch(target, {
      method: "POST",
      headers: {
        authorization: "Bearer " + userAccessToken,
        "x-velmere-browser-server-capability": serverCapability,
        "content-type": "application/json",
        accept: "application/json",
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const responseText = await response.text();
    let envelope;
    try { envelope = JSON.parse(responseText); } catch { throw new Error("account_customer_artifact_bridge_invalid_json"); }
    if (!response.ok || envelope?.ok !== true || envelope?.schemaVersion !== "velmere.r7.browser-artifact-write-bridge-response.v1") {
      throw new Error("account_customer_artifact_bridge_failed:" + response.status + ":" + String(envelope?.error ?? "unknown"));
    }
    const verified = parsePass4824AccountCustomerArtifactPdfBundleRpcResponse({
      payload: envelope.data,
      accountId: args.accountId,
      expectedSnapshot: args.snapshot,
      proposedBlob: proposed,
    });
    return { ...verified, source: "supabase" as const, transport: "authenticated_edge_bridge" as const };
  }

  assertDurableStorage();
  const existingSnapshot = memoryStore.get(args.snapshot.snapshotId);
  const existingBlob = pdfMemoryStore.get(args.snapshot.snapshotId);
  if (existingSnapshot && !existingBlob && !isPass4824ExactPdfAccountCustomerArtifactSnapshot(existingSnapshot)) {
    throw new Error("account_customer_artifact_pdf_legacy_snapshot_conflict");
  }
  if (Boolean(existingSnapshot) !== Boolean(existingBlob)) {
    throw new Error("account_customer_artifact_pdf_partial_state_conflict");
  }
  if (existingSnapshot && existingBlob) {
    if (!verifyPass4822AccountCustomerArtifactOwner(existingSnapshot, args.accountId)) {
      throw new Error("account_customer_artifact_owner_immutable_conflict");
    }
    if (existingSnapshot.snapshotDigest !== args.snapshot.snapshotDigest
      || existingSnapshot.canonicalArtifact.artifactDigest !== args.snapshot.canonicalArtifact.artifactDigest) {
      throw new Error("account_customer_artifact_immutable_conflict");
    }
    const matched = immutablePdfMatch({ existing: existingBlob, proposed, snapshot: existingSnapshot, accountId: args.accountId });
    return {
      snapshot: cloneSnapshot(existingSnapshot),
      blob: clonePdfBlob(matched),
      source: "memory" as const,
      created: false,
    };
  }

  // No await occurs between the paired checks and paired writes. In-memory calls
  // therefore commit both records as one event-loop critical section.
  const storedSnapshot = cloneSnapshot(args.snapshot);
  memoryStore.set(storedSnapshot.snapshotId, storedSnapshot);
  pdfMemoryStore.set(args.snapshot.snapshotId, clonePdfBlob(proposed));
  return {
    snapshot: cloneSnapshot(storedSnapshot),
    blob: clonePdfBlob(proposed),
    source: "memory" as const,
    created: true,
  };
}

export async function getPass4824AccountCustomerArtifactPdfBlob(args: {
  accountId: string;
  snapshotId: string;
  client?: SupabaseClient | null;
}) {
  const snapshotId = String(args.snapshotId ?? "").trim().slice(0, 180);
  if (!snapshotId) return null;
  const supabase = args.client === undefined ? getSupabaseServiceRoleClient() : args.client;
  if (supabase) {
    const { data, error } = await supabase
      .from(PDF_TABLE_NAME)
      .select(PDF_ROW_SELECT)
      .eq("snapshot_id", snapshotId)
      .eq("account_id", args.accountId)
      .maybeSingle();
    if (error) throw new Error(`account_customer_artifact_pdf_lookup_failed:${error.message}`);
    if (!data) return null;
    return { blob: fromPdfValue(data, args.accountId), source: "supabase" as const };
  }
  assertDurableStorage();
  const snapshot = memoryStore.get(snapshotId);
  const blob = pdfMemoryStore.get(snapshotId);
  if (!snapshot && !blob) return null;
  if (!snapshot) throw new Error("account_customer_artifact_pdf_partial_state_conflict");
  if (!blob) {
    if (isPass4824ExactPdfAccountCustomerArtifactSnapshot(snapshot)) {
      throw new Error("account_customer_artifact_pdf_partial_state_conflict");
    }
    return null;
  }
  if (!isPass4824ExactPdfAccountCustomerArtifactSnapshot(snapshot)) {
    throw new Error("account_customer_artifact_pdf_legacy_blob_conflict");
  }
  assertPass4824PdfBlobMatchesSnapshot({ blob, snapshot, accountId: args.accountId });
  return { blob: clonePdfBlob(blob), source: "memory" as const };
}

export async function getPass4824AccountCustomerArtifactPdfMetadata(args: {
  accountId: string;
  snapshotId: string;
  client?: SupabaseClient | null;
}) {
  const snapshotId = String(args.snapshotId ?? "").trim().slice(0, 180);
  if (!snapshotId) return null;
  const supabase = args.client === undefined ? getSupabaseServiceRoleClient() : args.client;
  if (supabase) {
    const { data, error } = await supabase
      .from(PDF_TABLE_NAME)
      .select(PDF_METADATA_ROW_SELECT)
      .eq("snapshot_id", snapshotId)
      .eq("account_id", args.accountId)
      .maybeSingle();
    if (error) throw new Error(`account_customer_artifact_pdf_metadata_lookup_failed:${error.message}`);
    if (!data) return null;
    return { blob: fromPdfMetadataValue(data, args.accountId), source: "supabase" as const };
  }
  assertDurableStorage();
  const snapshot = memoryStore.get(snapshotId);
  const blob = pdfMemoryStore.get(snapshotId);
  if (!snapshot && !blob) return null;
  if (!snapshot) throw new Error("account_customer_artifact_pdf_partial_state_conflict");
  if (!blob) {
    if (isPass4824ExactPdfAccountCustomerArtifactSnapshot(snapshot)) {
      throw new Error("account_customer_artifact_pdf_partial_state_conflict");
    }
    return null;
  }
  if (!isPass4824ExactPdfAccountCustomerArtifactSnapshot(snapshot)) {
    throw new Error("account_customer_artifact_pdf_legacy_blob_conflict");
  }
  assertPass4824PdfBlobMatchesSnapshot({ blob, snapshot, accountId: args.accountId });
  const metadata = fromPdfMetadataValue(blob, args.accountId);
  return { blob: clonePdfMetadata(metadata), source: "memory" as const };
}

export async function getPass4822AccountCustomerArtifactSnapshot(args: { accountId: string; snapshotId: string; client?: SupabaseClient | null }) {
  const snapshotId = String(args.snapshotId ?? "").trim().slice(0, 180);
  if (!snapshotId) return null;
  const supabase = args.client === undefined ? getSupabaseServiceRoleClient() : args.client;
  if (supabase) {
    const { data, error } = await supabase.from(TABLE_NAME).select(ROW_SELECT).eq("snapshot_id", snapshotId).eq("account_id", args.accountId).maybeSingle();
    if (error) throw new Error(`account_customer_artifact_durable_lookup_failed:${error.message}`);
    if (!data) return null;
    const snapshot = parsePass4822AccountCustomerArtifactSnapshotRow(data as Record<string, unknown>, args.accountId);
    if (!verifyPass4822AccountCustomerArtifactOwner(snapshot, args.accountId)) throw new Error("account_customer_artifact_owner_mismatch");
    return { snapshot: cloneSnapshot(snapshot), source: "supabase" as const };
  }
  assertDurableStorage();
  const snapshot = memoryStore.get(snapshotId);
  if (!snapshot || !verifyPass4822AccountCustomerArtifactOwner(snapshot, args.accountId)) return null;
  return { snapshot: cloneSnapshot(snapshot), source: "memory" as const };
}

export async function listPass4822AccountCustomerArtifactSnapshots(args: { accountId: string; limit?: number; client?: SupabaseClient | null }) {
  const limit = Math.max(1, Math.min(50, Number(args.limit ?? 24)));
  const supabase = args.client === undefined ? getSupabaseServiceRoleClient() : args.client;
  if (supabase) {
    const { data, error } = await supabase.from(TABLE_NAME).select(ROW_SELECT).eq("account_id", args.accountId).order("generated_at", { ascending: false }).limit(limit);
    if (error) throw new Error(`account_customer_artifact_durable_list_failed:${error.message}`);
    const snapshots = Array.isArray(data)
      ? data.map((row) => {
          const snapshot = parsePass4822AccountCustomerArtifactSnapshotRow(row as Record<string, unknown>, args.accountId);
          if (!verifyPass4822AccountCustomerArtifactOwner(snapshot, args.accountId)) {
            throw new Error("account_customer_artifact_owner_mismatch");
          }
          return snapshot;
        })
      : [];
    return { snapshots, source: "supabase" as const };
  }
  assertDurableStorage();
  const snapshots = Array.from(memoryStore.values())
    .filter((snapshot) => verifyPass4822AccountCustomerArtifactOwner(snapshot, args.accountId))
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))
    .slice(0, limit)
    .map(cloneSnapshot);
  return { snapshots, source: "memory" as const };
}
