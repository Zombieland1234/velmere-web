import type { SupabaseClient } from "@supabase/supabase-js";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import { runBoundedSupabaseRpc } from "@/lib/db/bounded-supabase-rpc";
import { buildSafeDownloadDisposition, type DownloadDisposition } from "@/lib/security/download-response-boundary";
import { sha256Digest, sha256Hex } from "@/lib/security/cryptographic-digest";
import { parseStrictJsonText } from "@/lib/security/strict-json-boundary";

export const ACCOUNT_DATA_EXPORT_RECORD_SCHEMA = "velmere.account-data-export-record.v1" as const;
export const ACCOUNT_DATA_EXPORT_PAYLOAD_SCHEMA = "velmere.account-data-export-payload.v1" as const;
export const PUBLIC_ACCOUNT_DATA_EXPORT_SCHEMA = "velmere.public-account-data-export.v1" as const;
export const ACCOUNT_DATA_EXPORT_MAX_BYTES = 8 * 1024 * 1024;
export const ACCOUNT_DATA_EXPORT_READ_DEADLINE_MS = 15_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCOUNT_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{5,119}$/;
const HEX_64 = /^[a-f0-9]{64}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9:._-]{15,119}$/;

export type AccountDataExportRecord = Readonly<{
  schemaVersion: typeof ACCOUNT_DATA_EXPORT_RECORD_SCHEMA;
  exportId: string;
  accountId: string;
  accountIdHash: string;
  idempotencyKeyHash: string;
  payloadSchemaVersion: typeof ACCOUNT_DATA_EXPORT_PAYLOAD_SCHEMA;
  payloadText: string;
  payloadSha256: string;
  byteLength: number;
  generatedAt: string;
  expiresAt: string;
  createdAt: string;
}>;

export type AccountDataExportDelivery = Readonly<{
  schemaVersion: "velmere.account-data-export-delivery.v1";
  bytes: Uint8Array<ArrayBuffer>;
  payloadSha256: string;
  byteLength: number;
  headers: Readonly<Record<string, string>>;
}>;

type ExportPayloadEnvelope = {
  schemaVersion?: unknown;
  exportId?: unknown;
  generatedAt?: unknown;
  availableUntil?: unknown;
  classification?: unknown;
  scope?: { legalDsrCompleteness?: unknown };
  account?: { accountId?: unknown };
};

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringField(row: Record<string, unknown>, snake: string, camel: string) {
  const value = row[snake] ?? row[camel];
  return typeof value === "string" ? value : "";
}

function numberField(row: Record<string, unknown>, snake: string, camel: string) {
  const value = row[snake] ?? row[camel];
  const numeric = typeof value === "number" ? value : Number(value);
  return numeric;
}

function exactIso(value: string, code: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(code);
  return new Date(timestamp).toISOString();
}

function unwrapRpcRecord(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length !== 1) throw new Error("account_data_export_record_invalid");
    return objectRecord(value[0]);
  }
  return objectRecord(value);
}

export function isAccountDataExportId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function hashAccountDataExportIdempotencyKey(accountId: string, key: string) {
  const normalizedAccount = accountId.trim();
  const normalizedKey = key.trim();
  if (!ACCOUNT_ID.test(normalizedAccount) || normalizedAccount.startsWith("preview:")) {
    throw new Error("account_data_export_account_invalid");
  }
  if (!IDEMPOTENCY_KEY.test(normalizedKey)) {
    throw new Error("account_data_export_idempotency_key_invalid");
  }
  return sha256Hex(`velmere-account-data-export-idempotency-v1:${normalizedAccount}:${normalizedKey}`);
}

export function parseAccountDataExportRecord(value: unknown): AccountDataExportRecord {
  const row = unwrapRpcRecord(value);
  if (!row) throw new Error("account_data_export_record_invalid");

  const schemaVersion = stringField(row, "schema_version", "schemaVersion");
  const exportId = stringField(row, "export_id", "exportId");
  const accountId = stringField(row, "account_id", "accountId");
  const accountIdHash = stringField(row, "account_id_hash", "accountIdHash");
  const idempotencyKeyHash = stringField(row, "idempotency_key_hash", "idempotencyKeyHash");
  const payloadSchemaVersion = stringField(row, "payload_schema_version", "payloadSchemaVersion");
  const payloadText = stringField(row, "payload_text", "payloadText");
  const payloadSha256 = stringField(row, "payload_sha256", "payloadSha256");
  const byteLength = numberField(row, "payload_byte_length", "byteLength");
  const generatedAt = exactIso(stringField(row, "generated_at", "generatedAt"), "account_data_export_generated_at_invalid");
  const expiresAt = exactIso(stringField(row, "expires_at", "expiresAt"), "account_data_export_expires_at_invalid");
  const createdAt = exactIso(stringField(row, "created_at", "createdAt"), "account_data_export_created_at_invalid");

  if (schemaVersion !== ACCOUNT_DATA_EXPORT_RECORD_SCHEMA
      || !isAccountDataExportId(exportId)
      || !ACCOUNT_ID.test(accountId)
      || accountId.startsWith("preview:")
      || !HEX_64.test(accountIdHash)
      || accountIdHash !== hashVelmereAccountBinding(accountId)
      || !HEX_64.test(idempotencyKeyHash)
      || payloadSchemaVersion !== ACCOUNT_DATA_EXPORT_PAYLOAD_SCHEMA
      || !SHA256.test(payloadSha256)
      || !Number.isSafeInteger(byteLength)
      || byteLength < 2
      || byteLength > ACCOUNT_DATA_EXPORT_MAX_BYTES
      || new TextEncoder().encode(payloadText).byteLength !== byteLength
      || sha256Digest(payloadText) !== payloadSha256) {
    throw new Error("account_data_export_record_integrity_invalid");
  }
  if (Date.parse(generatedAt) >= Date.parse(expiresAt)
      || Date.parse(createdAt) > Date.parse(generatedAt) + 5 * 60_000
      || Date.parse(expiresAt) - Date.parse(generatedAt) > 24 * 60 * 60_000 + 1_000) {
    throw new Error("account_data_export_record_time_invalid");
  }

  const payload = parseStrictJsonText<ExportPayloadEnvelope>(payloadText, {
    maxBytes: ACCOUNT_DATA_EXPORT_MAX_BYTES,
    maxDepth: 40,
    maxNodes: 250_000,
    requireObject: true,
    rejectDuplicateKeys: true,
    rejectDangerousKeys: true,
  });
  if (payload.schemaVersion !== ACCOUNT_DATA_EXPORT_PAYLOAD_SCHEMA
      || payload.exportId !== exportId
      || payload.classification !== "CUSTOMER_PRIVATE"
      || payload.account?.accountId !== accountId
      || payload.scope?.legalDsrCompleteness !== false
      || typeof payload.generatedAt !== "string"
      || typeof payload.availableUntil !== "string"
      || Math.abs(Date.parse(payload.generatedAt) - Date.parse(generatedAt)) > 1_000
      || Math.abs(Date.parse(payload.availableUntil) - Date.parse(expiresAt)) > 1_000) {
    throw new Error("account_data_export_payload_binding_invalid");
  }

  return {
    schemaVersion: ACCOUNT_DATA_EXPORT_RECORD_SCHEMA,
    exportId,
    accountId,
    accountIdHash,
    idempotencyKeyHash,
    payloadSchemaVersion: ACCOUNT_DATA_EXPORT_PAYLOAD_SCHEMA,
    payloadText,
    payloadSha256,
    byteLength,
    generatedAt,
    expiresAt,
    createdAt,
  };
}

export function assertAccountDataExportOwner(record: AccountDataExportRecord, accountId: string) {
  const normalized = accountId.trim();
  if (record.accountId !== normalized
      || record.accountIdHash !== hashVelmereAccountBinding(normalized)) {
    throw new Error("account_data_export_owner_mismatch");
  }
}

export async function requestAccountDataExport(input: {
  request: Request;
  client: SupabaseClient;
  exportId: string;
  accountId: string;
  idempotencyKeyHash: string;
}) {
  if (!isAccountDataExportId(input.exportId) || !HEX_64.test(input.idempotencyKeyHash)) {
    throw new Error("account_data_export_request_invalid");
  }
  const { data } = await runBoundedSupabaseRpc({
    operation: "account_data_export_create",
    rpcName: "velmere_create_account_data_export_v1",
    args: {
      p_export_id: input.exportId,
      p_idempotency_key_hash: input.idempotencyKeyHash,
    },
    capability: "user_rls",
    request: input.request,
    clientOverride: input.client,
    deadlineMs: 15_000,
  });
  const record = parseAccountDataExportRecord(data);
  assertAccountDataExportOwner(record, input.accountId);
  return record;
}

export async function readAccountDataExport(input: {
  client: SupabaseClient;
  exportId: string;
  accountId: string;
}): Promise<AccountDataExportRecord | null> {
  if (!isAccountDataExportId(input.exportId)) throw new Error("account_data_export_id_invalid");
  const query = input.client
    .from("velmere_account_data_exports")
    .select("schema_version,export_id,account_id,account_id_hash,idempotency_key_hash,payload_schema_version,payload_text,payload_sha256,payload_byte_length,generated_at,expires_at,created_at")
    .eq("export_id", input.exportId)
    .abortSignal(AbortSignal.timeout(ACCOUNT_DATA_EXPORT_READ_DEADLINE_MS))
    .maybeSingle();
  const { data, error } = await query;
  if (error) throw new Error("account_data_export_read_unavailable");
  if (!data) return null;
  const record = parseAccountDataExportRecord(data);
  assertAccountDataExportOwner(record, input.accountId);
  return record;
}

export function buildPublicAccountDataExportMetadata(record: AccountDataExportRecord) {
  return {
    schemaVersion: PUBLIC_ACCOUNT_DATA_EXPORT_SCHEMA,
    exportId: record.exportId,
    status: "available" as const,
    format: "json" as const,
    classification: "CUSTOMER_PRIVATE" as const,
    payloadSha256: record.payloadSha256,
    byteLength: record.byteLength,
    generatedAt: record.generatedAt,
    availableUntil: record.expiresAt,
    previewRoute: `/api/account/data-export?id=${encodeURIComponent(record.exportId)}&disposition=preview`,
    downloadRoute: `/api/account/data-export?id=${encodeURIComponent(record.exportId)}&disposition=download`,
    legalDsrCompleteness: false,
  };
}

export function buildAccountDataExportDelivery(
  record: AccountDataExportRecord,
  disposition: DownloadDisposition,
): AccountDataExportDelivery {
  const verified = parseAccountDataExportRecord(record);
  const bytes: Uint8Array<ArrayBuffer> = new TextEncoder().encode(verified.payloadText);
  const download = buildSafeDownloadDisposition({
    disposition,
    filenameStem: `Velmere-account-data-${verified.exportId}`,
    mediaKind: "json",
    fallbackStem: "Velmere-account-data",
  });
  return {
    schemaVersion: "velmere.account-data-export-delivery.v1",
    bytes,
    payloadSha256: verified.payloadSha256,
    byteLength: verified.byteLength,
    headers: {
      "content-type": download.contentType,
      "content-length": String(verified.byteLength),
      "content-disposition": download.contentDisposition,
      "cache-control": "private, no-store, max-age=0",
      pragma: "no-cache",
      vary: "Cookie, Authorization",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-velmere-account-export-sha256": verified.payloadSha256,
      "x-velmere-preview-download-parity": "byte-identical",
      "x-velmere-document-contract": "velmere.account-data-export-delivery.v1",
    },
  };
}
