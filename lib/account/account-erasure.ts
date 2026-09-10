import type { SupabaseClient } from "@supabase/supabase-js";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import { runBoundedSupabaseRpc } from "@/lib/db/bounded-supabase-rpc";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import { sha256Digest, sha256Hex } from "@/lib/security/cryptographic-digest";

export const ACCOUNT_ERASURE_RECORD_SCHEMA = "velmere.account-erasure-request-record.v1" as const;
export const PUBLIC_ACCOUNT_ERASURE_SCHEMA = "velmere.public-account-erasure-request.v1" as const;
export const ACCOUNT_ERASURE_READ_DEADLINE_MS = 5_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCOUNT_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{5,119}$/;
const HEX_64 = /^[a-f0-9]{64}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9:._-]{15,119}$/;

export type AccountErasureState = "SESSION_REVOCATION_PENDING" | "POLICY_BLOCKED" | "CANCELLED";
export type AccountErasureRecord = Readonly<{
  schemaVersion: typeof ACCOUNT_ERASURE_RECORD_SCHEMA;
  requestId: string;
  accountId: string;
  accountIdHash: string;
  idempotencyKeyHash: string;
  exportId: string;
  exportPayloadSha256: string;
  exportGeneratedAt: string;
  exportExpiresAt: string;
  state: AccountErasureState;
  sessionRevocationState: "PENDING" | "CONFIRMED";
  sessionRevocationReceiptSha256: string | null;
  executionPolicyState: "OWNER_LEGAL_POLICY_REQUIRED";
  requestedAt: string;
  sessionRevocationConfirmedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
}>;

export type AccountErasureSessionRevocation = Readonly<{
  providerRevoked: boolean;
  localRevoked: boolean;
  reason: string;
}>;

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function unwrap(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length !== 1) throw new Error("account_erasure_record_invalid");
    return objectRecord(value[0]);
  }
  return objectRecord(value);
}

function stringField(row: Record<string, unknown>, snake: string, camel: string) {
  const value = row[snake] ?? row[camel];
  return typeof value === "string" ? value : "";
}

function nullableStringField(row: Record<string, unknown>, snake: string, camel: string) {
  const value = row[snake] ?? row[camel];
  return value === null || value === undefined ? null : typeof value === "string" ? value : "";
}

function iso(value: string, code: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return new Date(parsed).toISOString();
}

function nullableIso(value: string | null, code: string) {
  return value === null ? null : iso(value, code);
}

export function isAccountErasureRequestId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function hashAccountErasureIdempotencyKey(accountId: string, key: string) {
  const normalizedAccount = accountId.trim();
  const normalizedKey = key.trim();
  if (!ACCOUNT_ID.test(normalizedAccount) || normalizedAccount.startsWith("preview:")) {
    throw new Error("account_erasure_account_invalid");
  }
  if (!IDEMPOTENCY_KEY.test(normalizedKey)) {
    throw new Error("account_erasure_idempotency_key_invalid");
  }
  return sha256Hex(`velmere-account-erasure-idempotency-v1:${normalizedAccount}:${normalizedKey}`);
}

export function parseAccountErasureRecord(value: unknown): AccountErasureRecord {
  const row = unwrap(value);
  if (!row) throw new Error("account_erasure_record_invalid");
  const schemaVersion = stringField(row, "schema_version", "schemaVersion");
  const requestId = stringField(row, "request_id", "requestId");
  const accountId = stringField(row, "account_id", "accountId");
  const accountIdHash = stringField(row, "account_id_hash", "accountIdHash");
  const idempotencyKeyHash = stringField(row, "idempotency_key_hash", "idempotencyKeyHash");
  const exportId = stringField(row, "export_id", "exportId");
  const exportPayloadSha256 = stringField(row, "export_payload_sha256", "exportPayloadSha256");
  const exportGeneratedAt = iso(stringField(row, "export_generated_at", "exportGeneratedAt"), "account_erasure_export_time_invalid");
  const exportExpiresAt = iso(stringField(row, "export_expires_at", "exportExpiresAt"), "account_erasure_export_expiry_invalid");
  const state = stringField(row, "state", "state") as AccountErasureState;
  const sessionRevocationState = stringField(row, "session_revocation_state", "sessionRevocationState") as AccountErasureRecord["sessionRevocationState"];
  const sessionRevocationReceiptSha256 = nullableStringField(row, "session_revocation_receipt_sha256", "sessionRevocationReceiptSha256");
  const executionPolicyState = stringField(row, "execution_policy_state", "executionPolicyState");
  const requestedAt = iso(stringField(row, "requested_at", "requestedAt"), "account_erasure_requested_at_invalid");
  const sessionRevocationConfirmedAt = nullableIso(
    nullableStringField(row, "session_revocation_confirmed_at", "sessionRevocationConfirmedAt"),
    "account_erasure_revocation_time_invalid",
  );
  const cancelledAt = nullableIso(nullableStringField(row, "cancelled_at", "cancelledAt"), "account_erasure_cancelled_at_invalid");
  const updatedAt = iso(stringField(row, "updated_at", "updatedAt"), "account_erasure_updated_at_invalid");

  if (schemaVersion !== ACCOUNT_ERASURE_RECORD_SCHEMA
      || !isAccountErasureRequestId(requestId)
      || !ACCOUNT_ID.test(accountId)
      || accountId.startsWith("preview:")
      || !HEX_64.test(accountIdHash)
      || accountIdHash !== hashVelmereAccountBinding(accountId)
      || !HEX_64.test(idempotencyKeyHash)
      || !UUID.test(exportId)
      || !SHA256.test(exportPayloadSha256)
      || Date.parse(exportGeneratedAt) >= Date.parse(exportExpiresAt)
      || !["SESSION_REVOCATION_PENDING", "POLICY_BLOCKED", "CANCELLED"].includes(state)
      || !["PENDING", "CONFIRMED"].includes(sessionRevocationState)
      || executionPolicyState !== "OWNER_LEGAL_POLICY_REQUIRED"
      || Date.parse(requestedAt) > Date.parse(updatedAt)) {
    throw new Error("account_erasure_record_integrity_invalid");
  }
  if (sessionRevocationState === "PENDING") {
    if (sessionRevocationReceiptSha256 !== null || sessionRevocationConfirmedAt !== null
        || (state !== "SESSION_REVOCATION_PENDING" && state !== "CANCELLED")) {
      throw new Error("account_erasure_revocation_binding_invalid");
    }
  } else if (!sessionRevocationReceiptSha256 || !SHA256.test(sessionRevocationReceiptSha256)
      || !sessionRevocationConfirmedAt || (state !== "POLICY_BLOCKED" && state !== "CANCELLED")) {
    throw new Error("account_erasure_revocation_binding_invalid");
  }
  if ((state === "CANCELLED") !== Boolean(cancelledAt)) {
    throw new Error("account_erasure_cancellation_binding_invalid");
  }

  return {
    schemaVersion: ACCOUNT_ERASURE_RECORD_SCHEMA,
    requestId,
    accountId,
    accountIdHash,
    idempotencyKeyHash,
    exportId,
    exportPayloadSha256,
    exportGeneratedAt,
    exportExpiresAt,
    state,
    sessionRevocationState,
    sessionRevocationReceiptSha256,
    executionPolicyState: "OWNER_LEGAL_POLICY_REQUIRED",
    requestedAt,
    sessionRevocationConfirmedAt,
    cancelledAt,
    updatedAt,
  };
}

export function assertAccountErasureOwner(record: AccountErasureRecord, accountId: string) {
  const normalized = accountId.trim();
  if (record.accountId !== normalized || record.accountIdHash !== hashVelmereAccountBinding(normalized)) {
    throw new Error("account_erasure_owner_mismatch");
  }
}

export function accountErasureExecutionBlockers(record: AccountErasureRecord) {
  if (record.state === "CANCELLED") return ["REQUEST_CANCELLED"] as const;
  if (record.sessionRevocationState !== "CONFIRMED") {
    return ["SESSION_REVOCATION_REQUIRED", "OWNER_LEGAL_POLICY_REQUIRED"] as const;
  }
  return [
    "OWNER_LEGAL_SIGNED_POLICY_REQUIRED",
    "DELETION_RETENTION_LEGAL_HOLD_TOPOLOGY_NOT_APPROVED",
    "ERASURE_EXECUTOR_NOT_IMPLEMENTED",
  ] as const;
}

export function buildPublicAccountErasureMetadata(record: AccountErasureRecord) {
  const blockers = accountErasureExecutionBlockers(record);
  return {
    schemaVersion: PUBLIC_ACCOUNT_ERASURE_SCHEMA,
    requestId: record.requestId,
    status: record.state,
    requestedAt: record.requestedAt,
    cancelledAt: record.cancelledAt,
    export: {
      exportId: record.exportId,
      payloadSha256: record.exportPayloadSha256,
      generatedAt: record.exportGeneratedAt,
    },
    sessionRevocation: record.sessionRevocationState,
    executionEligible: false as const,
    executionBlocker: blockers[0],
    dataDeleted: false as const,
    legalDeletionClaimed: false as const,
  };
}

export function buildAccountErasureRevocationReceipt(
  record: AccountErasureRecord,
  revocation: AccountErasureSessionRevocation,
) {
  if (!revocation.providerRevoked || !revocation.localRevoked || revocation.reason !== "revoked") {
    throw new Error("account_erasure_session_revocation_incomplete");
  }
  return sha256Digest(JSON.stringify({
    schemaVersion: "velmere.account-erasure-session-revocation-receipt.v1",
    requestId: record.requestId,
    accountIdHash: record.accountIdHash,
    providerRevoked: true,
    localRevoked: true,
    reason: "revoked",
  }));
}

export async function requestAccountErasure(input: {
  request: Request;
  client: SupabaseClient;
  requestId: string;
  accountId: string;
  idempotencyKeyHash: string;
}) {
  if (!isAccountErasureRequestId(input.requestId) || !HEX_64.test(input.idempotencyKeyHash)) {
    throw new Error("account_erasure_request_invalid");
  }
  const { data } = await runBoundedSupabaseRpc({
    operation: "account_erasure_request",
    rpcName: "velmere_request_account_erasure_v1",
    args: { p_request_id: input.requestId, p_idempotency_key_hash: input.idempotencyKeyHash },
    capability: "user_rls",
    request: input.request,
    clientOverride: input.client,
    deadlineMs: 8_000,
  });
  const record = parseAccountErasureRecord(data);
  assertAccountErasureOwner(record, input.accountId);
  return record;
}

export async function cancelAccountErasure(input: {
  request: Request;
  client: SupabaseClient;
  requestId: string;
  accountId: string;
}) {
  if (!isAccountErasureRequestId(input.requestId)) throw new Error("account_erasure_request_invalid");
  const { data } = await runBoundedSupabaseRpc({
    operation: "account_erasure_cancel",
    rpcName: "velmere_cancel_account_erasure_v1",
    args: { p_request_id: input.requestId },
    capability: "user_rls",
    request: input.request,
    clientOverride: input.client,
    deadlineMs: 5_000,
  });
  const record = parseAccountErasureRecord(data);
  assertAccountErasureOwner(record, input.accountId);
  return record;
}

export async function confirmAccountErasureSessionRevocation(input: {
  record: AccountErasureRecord;
  receiptSha256: string;
}) {
  if (!SHA256.test(input.receiptSha256)) throw new Error("account_erasure_revocation_receipt_invalid");
  const { data } = await runRegisteredServiceRoleRpc({
    operation: "account_erasure_session_revocation_confirm",
    args: {
      p_request_id: input.record.requestId,
      p_account_id_hash: input.record.accountIdHash,
      p_revocation_receipt_sha256: input.receiptSha256,
    },
  });
  const confirmed = parseAccountErasureRecord(data);
  assertAccountErasureOwner(confirmed, input.record.accountId);
  return confirmed;
}

export async function readLatestAccountErasure(input: {
  client: SupabaseClient;
  accountId: string;
  requestId?: string;
}): Promise<AccountErasureRecord | null> {
  if (input.requestId !== undefined && !isAccountErasureRequestId(input.requestId)) {
    throw new Error("account_erasure_request_invalid");
  }
  let query = input.client
    .from("velmere_account_erasure_requests")
    .select("schema_version,request_id,account_id,account_id_hash,idempotency_key_hash,export_id,export_payload_sha256,export_generated_at,export_expires_at,state,session_revocation_state,session_revocation_receipt_sha256,execution_policy_state,requested_at,session_revocation_confirmed_at,cancelled_at,updated_at")
    .order("requested_at", { ascending: false })
    .limit(1);
  if (input.requestId) query = query.eq("request_id", input.requestId);
  const { data, error } = await query
    .abortSignal(AbortSignal.timeout(ACCOUNT_ERASURE_READ_DEADLINE_MS))
    .maybeSingle();
  if (error) throw new Error("account_erasure_read_unavailable");
  if (!data) return null;
  const record = parseAccountErasureRecord(data);
  assertAccountErasureOwner(record, input.accountId);
  return record;
}
