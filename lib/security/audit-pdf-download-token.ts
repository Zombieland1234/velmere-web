import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";

export const PASS4657_AUDIT_PDF_DOWNLOAD_TOKEN_ID = "audit-pdf-download-token-v1" as const;
export const PASS4658_AUDIT_PDF_TOKEN_LIFECYCLE_ID = "pass4658-audit-pdf-token-reservation-finalization-v1" as const;

export type AuditPdfTokenPayload = {
  v: 1;
  purpose: "audit_pro_pdf_download";
  kid: string;
  accountIdHash: string;
  entitlementIdHash: string;
  reportId: string;
  reportVersionHash: string;
  nonce: string;
  iat: number;
  exp: number;
};

type SigningKey = { kid: string; secret: string };
type MemoryLifecycle = {
  state: "reserved" | "consumed" | "retryable_failed";
  reservationId: string | null;
  reservationExpiresAtMs: number | null;
  attempts: number;
  lastFailureCode: string | null;
};

const memoryLifecycle = new Map<string, MemoryLifecycle>();
const MAX_TTL_SECONDS = 15 * 60;
const MAX_RESERVATION_SECONDS = 5 * 60;
const DEFAULT_RESERVATION_SECONDS = 90;
const DOMAIN = "velmere:audit_pro_pdf_download:v1:";

function productionLike(env: Record<string, string | undefined>) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

function cleanId(value: string, max: number) {
  return value.trim().replace(/[^a-zA-Z0-9:._-]+/g, "-").slice(0, max);
}

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function keys(env: Record<string, string | undefined>): SigningKey[] {
  const current = String(env.VELMERE_AUDIT_PDF_TOKEN_SECRET_CURRENT ?? "").trim();
  const previous = String(env.VELMERE_AUDIT_PDF_TOKEN_SECRET_PREVIOUS ?? "").trim();
  const result: SigningKey[] = [];
  if (current.length >= 32) result.push({ kid: cleanId(env.VELMERE_AUDIT_PDF_TOKEN_KEY_ID ?? "current", 48), secret: current });
  if (previous.length >= 32) result.push({ kid: cleanId(env.VELMERE_AUDIT_PDF_TOKEN_PREVIOUS_KEY_ID ?? "previous", 48), secret: previous });
  return result;
}

function sign(secret: string, encoded: string) {
  return createHmac("sha256", secret).update(`${DOMAIN}${encoded}`).digest();
}

function encode(payload: AuditPdfTokenPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function tokenHash(token: string) {
  return hash(`${DOMAIN}${token}`);
}

function normalizeReservationSeconds(value: number | undefined) {
  return Math.max(15, Math.min(MAX_RESERVATION_SECONDS, Math.floor(value ?? DEFAULT_RESERVATION_SECONDS)));
}

function parseRpcRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object" ? first as Record<string, unknown> : null;
  }
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}

export function buildPass4657AuditPdfReportVersionHash(args: {
  reportId: string;
  auditCaseRef?: string | null;
  requestId?: string | null;
  target?: string | null;
  chain?: string | null;
  locale?: string | null;
  schemaVersion?: string | null;
}) {
  const canonical = {
    purpose: "audit_pro_pdf_report_version_v1",
    reportId: cleanId(args.reportId, 120),
    auditCaseRef: cleanId(args.auditCaseRef ?? "", 160),
    requestId: cleanId(args.requestId ?? "", 120),
    target: cleanId(args.target ?? "", 220),
    chain: cleanId(args.chain ?? "", 48),
    locale: cleanId(args.locale ?? "en", 8),
    schemaVersion: cleanId(args.schemaVersion ?? "pass4657-pro-pdf-runtime-v1", 80),
  };
  return hash(`${DOMAIN}report-version:${JSON.stringify(canonical)}`);
}

export function issuePass4657AuditPdfDownloadToken(args: {
  accountId: string;
  entitlementId: string;
  reportId: string;
  reportVersionHash: string;
  nonce: string;
  env?: Record<string, string | undefined>;
  nowMs?: number;
  ttlSeconds?: number;
}) {
  const env = args.env ?? process.env;
  const key = keys(env)[0];
  if (!key) return { ok: false as const, error: "audit_pdf_token_secret_missing_or_short" as const };
  const reportId = cleanId(args.reportId, 120);
  const reportVersionHash = cleanId(args.reportVersionHash, 160);
  const nonce = cleanId(args.nonce ?? randomBytes(24).toString("base64url"), 96);
  if (!reportId || reportVersionHash.length < 24 || nonce.length < 16 || !args.accountId.trim() || !args.entitlementId.trim()) {
    return { ok: false as const, error: "audit_pdf_token_claims_invalid" as const };
  }
  const now = Math.floor((args.nowMs ?? Date.now()) / 1000);
  const ttl = Math.max(60, Math.min(MAX_TTL_SECONDS, Math.floor(args.ttlSeconds ?? 5 * 60)));
  const payload: AuditPdfTokenPayload = {
    v: 1,
    purpose: "audit_pro_pdf_download",
    kid: key.kid,
    accountIdHash: hashVelmereAccountBinding(args.accountId),
    entitlementIdHash: hash(args.entitlementId.trim()),
    reportId,
    reportVersionHash,
    nonce,
    iat: now,
    exp: now + ttl,
  };
  const encoded = encode(payload);
  const signature = sign(key.secret, encoded).toString("base64url");
  const token = `vlm_pdf_${encoded}.${signature}`;
  return {
    ok: true as const,
    token,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    keyId: key.kid,
    tokenHash: tokenHash(token),
  };
}

export function verifyPass4657AuditPdfDownloadToken(args: {
  token: string | null | undefined;
  accountId: string;
  entitlementId: string;
  expectedReportId?: string | null;
  expectedReportVersionHash?: string | null;
  env?: Record<string, string | undefined>;
  nowMs?: number;
}) {
  const env = args.env ?? process.env;
  const availableKeys = keys(env);
  if (!availableKeys.length) return { ok: false as const, error: "audit_pdf_token_secret_missing_or_short" as const };
  const token = String(args.token ?? "").trim();
  if (!token.startsWith("vlm_pdf_") || token.length > 16 * 1024) return { ok: false as const, error: "audit_pdf_token_invalid" as const };
  const body = token.slice("vlm_pdf_".length);
  const [encoded, suppliedSignature, ...extra] = body.split(".");
  if (!encoded || !suppliedSignature || extra.length) return { ok: false as const, error: "audit_pdf_token_invalid" as const };
  let payload: AuditPdfTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AuditPdfTokenPayload;
  } catch {
    return { ok: false as const, error: "audit_pdf_token_invalid" as const };
  }
  if (payload.v !== 1 || payload.purpose !== "audit_pro_pdf_download") return { ok: false as const, error: "audit_pdf_token_purpose_mismatch" as const };
  const candidate = availableKeys.find((key) => key.kid === payload.kid);
  if (!candidate) return { ok: false as const, error: "audit_pdf_token_key_unknown" as const };
  let supplied: Buffer;
  try {
    supplied = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return { ok: false as const, error: "audit_pdf_token_invalid" as const };
  }
  const expected = sign(candidate.secret, encoded);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return { ok: false as const, error: "audit_pdf_token_signature_invalid" as const };
  const now = Math.floor((args.nowMs ?? Date.now()) / 1000);
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= payload.iat || payload.exp - payload.iat > MAX_TTL_SECONDS) {
    return { ok: false as const, error: "audit_pdf_token_invalid" as const };
  }
  if (payload.exp <= now || payload.iat > now + 30) return { ok: false as const, error: "audit_pdf_token_expired" as const };
  if (payload.accountIdHash !== hashVelmereAccountBinding(args.accountId)) return { ok: false as const, error: "audit_pdf_token_account_mismatch" as const };
  if (payload.entitlementIdHash !== hash(args.entitlementId.trim())) return { ok: false as const, error: "audit_pdf_token_entitlement_mismatch" as const };
  if (args.expectedReportId && payload.reportId !== cleanId(args.expectedReportId, 120)) return { ok: false as const, error: "audit_pdf_token_report_mismatch" as const };
  if (args.expectedReportVersionHash && payload.reportVersionHash !== cleanId(args.expectedReportVersionHash, 160)) return { ok: false as const, error: "audit_pdf_token_version_mismatch" as const };
  return { ok: true as const, payload, keyId: payload.kid, tokenHash: tokenHash(token), expiresAt: new Date(payload.exp * 1000).toISOString() };
}

export async function reservePass4658AuditPdfDownloadToken(args: {
  tokenHash: string;
  payload: AuditPdfTokenPayload;
  accountId: string;
  entitlementId: string;
  env?: Record<string, string | undefined>;
  nowMs?: number;
  reservationSeconds?: number;
}) {
  const env = args.env ?? process.env;
  const production = productionLike(env);
  const nowMs = args.nowMs ?? Date.now();
  const reservationId = randomBytes(24).toString("base64url");
  const reservationExpiresAtMs = nowMs + normalizeReservationSeconds(args.reservationSeconds) * 1000;
  if (args.payload.exp * 1000 <= nowMs) return { ok: false as const, error: "audit_pdf_token_expired" as const };

  if (hasSupabaseServiceRoleConfig()) {
    let data: unknown;
    try {
      ({ data } = await runRegisteredServiceRoleRpc({
        operation: "audit_pdf_token_claim",
        args: {
          p_token_hash: args.tokenHash,
          p_nonce_hash: hash(args.payload.nonce),
          p_account_id_hash: hashVelmereAccountBinding(args.accountId),
          p_entitlement_id_hash: hash(args.entitlementId.trim()),
          p_report_id: args.payload.reportId,
          p_report_version_hash: args.payload.reportVersionHash,
          p_token_expires_at: new Date(args.payload.exp * 1000).toISOString(),
          p_reservation_id: reservationId,
          p_reservation_expires_at: new Date(reservationExpiresAtMs).toISOString(),
        },
      }));
    } catch {
      return { ok: false as const, error: "audit_pdf_consumption_store_failed" as const };
    }
    const row = parseRpcRow(data);
    if (!row || row.ok !== true) {
      const result = String(row?.result ?? "store_rejected");
      if (result === "consumed" || result === "replayed_nonce") return { ok: false as const, error: "audit_pdf_token_replayed" as const };
      if (result === "reserved") return { ok: false as const, error: "audit_pdf_token_in_progress" as const };
      if (result === "expired") return { ok: false as const, error: "audit_pdf_token_expired" as const };
      return { ok: false as const, error: "audit_pdf_consumption_store_failed" as const };
    }
    return {
      ok: true as const,
      mode: "durable" as const,
      reservationId,
      reservationExpiresAt: new Date(reservationExpiresAtMs).toISOString(),
      attemptCount: Number(row.attempt_count ?? 1),
      result: String(row.result ?? "claimed"),
    };
  }

  if (production) return { ok: false as const, error: "audit_pdf_consumption_store_required" as const };
  const existing = memoryLifecycle.get(args.tokenHash);
  if (existing?.state === "consumed") return { ok: false as const, error: "audit_pdf_token_replayed" as const };
  if (existing?.state === "reserved" && Number(existing.reservationExpiresAtMs ?? 0) > nowMs) {
    return { ok: false as const, error: "audit_pdf_token_in_progress" as const };
  }
  const attempts = (existing?.attempts ?? 0) + 1;
  memoryLifecycle.set(args.tokenHash, {
    state: "reserved",
    reservationId,
    reservationExpiresAtMs,
    attempts,
    lastFailureCode: existing?.lastFailureCode ?? null,
  });
  return {
    ok: true as const,
    mode: "memory_non_production" as const,
    reservationId,
    reservationExpiresAt: new Date(reservationExpiresAtMs).toISOString(),
    attemptCount: attempts,
    result: existing ? "reclaimed" : "claimed",
  };
}

export async function finalizePass4658AuditPdfDownloadToken(args: {
  tokenHash: string;
  reservationId: string;
  env?: Record<string, string | undefined>;
  nowMs?: number;
}) {
  const env = args.env ?? process.env;
  const production = productionLike(env);
  const nowIso = new Date(args.nowMs ?? Date.now()).toISOString();
  if (hasSupabaseServiceRoleConfig()) {
    let data: unknown;
    try {
      ({ data } = await runRegisteredServiceRoleRpc({
        operation: "audit_pdf_token_finalize",
        args: {
          p_token_hash: args.tokenHash,
          p_reservation_id: args.reservationId,
          p_consumed_at: nowIso,
        },
      }));
    } catch {
      return { ok: false as const, error: "audit_pdf_consumption_store_failed" as const };
    }
    const row = parseRpcRow(data);
    if (!row || row.ok !== true) {
      const result = String(row?.result ?? "store_rejected");
      if (result === "consumed") return { ok: false as const, error: "audit_pdf_token_replayed" as const };
      if (result === "reservation_mismatch") return { ok: false as const, error: "audit_pdf_token_reservation_mismatch" as const };
      return { ok: false as const, error: "audit_pdf_consumption_store_failed" as const };
    }
    return { ok: true as const, mode: "durable" as const, consumedAt: nowIso };
  }
  if (production) return { ok: false as const, error: "audit_pdf_consumption_store_required" as const };
  const existing = memoryLifecycle.get(args.tokenHash);
  if (!existing) return { ok: false as const, error: "audit_pdf_token_reservation_missing" as const };
  if (existing.state === "consumed") return { ok: false as const, error: "audit_pdf_token_replayed" as const };
  if (existing.state !== "reserved" || existing.reservationId !== args.reservationId) {
    return { ok: false as const, error: "audit_pdf_token_reservation_mismatch" as const };
  }
  memoryLifecycle.set(args.tokenHash, {
    ...existing,
    state: "consumed",
    reservationId: null,
    reservationExpiresAtMs: null,
  });
  return { ok: true as const, mode: "memory_non_production" as const, consumedAt: nowIso };
}

export async function failPass4658AuditPdfDownloadReservation(args: {
  tokenHash: string;
  reservationId: string;
  failureCode: string;
  env?: Record<string, string | undefined>;
  nowMs?: number;
}) {
  const env = args.env ?? process.env;
  const production = productionLike(env);
  const failureCode = cleanId(args.failureCode || "pdf_generation_failed", 96);
  const failedAt = new Date(args.nowMs ?? Date.now()).toISOString();
  if (hasSupabaseServiceRoleConfig()) {
    let data: unknown;
    try {
      ({ data } = await runRegisteredServiceRoleRpc({
        operation: "audit_pdf_token_reservation_fail",
        args: {
          p_token_hash: args.tokenHash,
          p_reservation_id: args.reservationId,
          p_failure_code: failureCode,
          p_failed_at: failedAt,
        },
      }));
    } catch {
      return { ok: false as const, error: "audit_pdf_consumption_store_failed" as const };
    }
    const row = parseRpcRow(data);
    if (!row || row.ok !== true) return { ok: false as const, error: "audit_pdf_token_reservation_mismatch" as const };
    return { ok: true as const, mode: "durable" as const };
  }
  if (production) return { ok: false as const, error: "audit_pdf_consumption_store_required" as const };
  const existing = memoryLifecycle.get(args.tokenHash);
  if (!existing || existing.state !== "reserved" || existing.reservationId !== args.reservationId) {
    return { ok: false as const, error: "audit_pdf_token_reservation_mismatch" as const };
  }
  memoryLifecycle.set(args.tokenHash, {
    ...existing,
    state: "retryable_failed",
    reservationId: null,
    reservationExpiresAtMs: null,
    lastFailureCode: failureCode,
  });
  return { ok: true as const, mode: "memory_non_production" as const };
}

export async function consumePass4657AuditPdfDownloadToken(args: {
  tokenHash: string;
  payload: AuditPdfTokenPayload;
  accountId: string;
  entitlementId: string;
  env?: Record<string, string | undefined>;
  nowMs?: number;
}) {
  const reserved = await reservePass4658AuditPdfDownloadToken(args);
  if (!reserved.ok) return reserved;
  return finalizePass4658AuditPdfDownloadToken({
    tokenHash: args.tokenHash,
    reservationId: reserved.reservationId,
    env: args.env,
    nowMs: args.nowMs,
  });
}

export function resetPass4657AuditPdfMemoryConsumptionForTests() {
  memoryLifecycle.clear();
}
