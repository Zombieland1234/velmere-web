import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "./ascii-control-characters";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { canonicalJson } from "@/lib/security/canonical-json";
import { reservePass4395DurableIdempotencyKey } from "@/lib/security/durable-idempotency-store";

export const PASS4803_SECURITY_OPERATOR_ASSERTION_ID = "pass6-security-operator-assertion-v2" as const;

export type SecurityOperatorRole = "security_admin" | "primary_reviewer" | "independent_approver";
export type SecurityOperatorMfa = "totp" | "webauthn";

export type SecurityOperatorAssertionPayload = {
  schemaVersion: typeof PASS4803_SECURITY_OPERATOR_ASSERTION_ID;
  operatorId: string;
  role: SecurityOperatorRole;
  scopes: string[];
  mfa: SecurityOperatorMfa;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  request: {
    method: string;
    path: string;
    bodySha256: string;
  };
};

export type SecurityOperatorAssertionVerdict =
  | {
      ok: true;
      operator: {
        id: string;
        pseudonym: string;
        role: SecurityOperatorRole;
        scopes: string[];
        mfa: SecurityOperatorMfa;
        assertionFingerprint: string;
      };
      payload: SecurityOperatorAssertionPayload;
    }
  | { ok: false; error: string; missing: boolean };

const MAX_ASSERTION_BYTES = 8_192;
const MAX_LIFETIME_MS = 10 * 60_000;
const CLOCK_SKEW_MS = 60_000;
const SAFE_NONCE = /^[A-Za-z0-9_-]{16,160}$/;
const ALLOWED_ROLES = new Set<SecurityOperatorRole>(["security_admin", "primary_reviewer", "independent_approver"]);
const ALLOWED_MFA = new Set<SecurityOperatorMfa>(["totp", "webauthn"]);

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function securityOperatorRequestBodyDigest(value: unknown) {
  return `sha256:${sha256(canonicalJson(value))}`;
}

function clean(value: unknown, max: number) {
  return typeof value === "string"
    ? value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function base64urlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64urlDecode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > MAX_ASSERTION_BYTES * 2) throw new Error("operator_assertion_encoding_invalid");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength === 0 || decoded.byteLength > MAX_ASSERTION_BYTES) throw new Error("operator_assertion_size_invalid");
  return decoded.toString("utf8");
}

function signatureFor(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload, "utf8").digest("hex");
}

function safeHexEqual(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function parsePayload(encoded: string): SecurityOperatorAssertionPayload {
  const parsed = JSON.parse(base64urlDecode(encoded)) as Partial<SecurityOperatorAssertionPayload>;
  const operatorId = clean(parsed.operatorId, 220);
  const role = parsed.role;
  const mfa = parsed.mfa;
  const scopes = Array.isArray(parsed.scopes)
    ? Array.from(new Set(parsed.scopes.map((value) => clean(value, 80)).filter(Boolean))).sort()
    : [];
  const issuedAt = clean(parsed.issuedAt, 64);
  const expiresAt = clean(parsed.expiresAt, 64);
  const nonce = clean(parsed.nonce, 160);
  const method = clean(parsed.request?.method, 16).toUpperCase();
  const path = clean(parsed.request?.path, 500);
  const bodySha256 = clean(parsed.request?.bodySha256, 80).toLowerCase();
  if (parsed.schemaVersion !== PASS4803_SECURITY_OPERATOR_ASSERTION_ID) throw new Error("operator_assertion_schema_invalid");
  if (!operatorId || !ALLOWED_ROLES.has(role as SecurityOperatorRole) || !ALLOWED_MFA.has(mfa as SecurityOperatorMfa)) throw new Error("operator_assertion_identity_invalid");
  if (!issuedAt || !expiresAt || !SAFE_NONCE.test(nonce) || !method || !path.startsWith("/")
    || !/^sha256:[a-f0-9]{64}$/.test(bodySha256)) throw new Error("operator_assertion_claims_invalid");
  return {
    schemaVersion: PASS4803_SECURITY_OPERATOR_ASSERTION_ID,
    operatorId,
    role: role as SecurityOperatorRole,
    scopes,
    mfa: mfa as SecurityOperatorMfa,
    issuedAt,
    expiresAt,
    nonce,
    request: { method, path, bodySha256 },
  };
}

export function issueSecurityOperatorAssertion(args: {
  secret: string;
  operatorId: string;
  role: SecurityOperatorRole;
  scopes: string[];
  mfa: SecurityOperatorMfa;
  request: { method: string; path: string; body?: unknown; bodySha256?: string };
  nonce: string;
  issuedAt?: string | Date;
  expiresInSeconds?: number;
}) {
  const secret = args.secret.trim();
  if (secret.length < 32) throw new Error("operator_assertion_secret_too_short");
  const issued = args.issuedAt instanceof Date ? args.issuedAt : new Date(args.issuedAt ?? new Date());
  if (!Number.isFinite(issued.getTime())) throw new Error("operator_assertion_issued_at_invalid");
  const lifetimeSeconds = Math.max(30, Math.min(600, Math.floor(args.expiresInSeconds ?? 300)));
  const suppliedBodyDigest = args.request.bodySha256?.trim().toLowerCase();
  const bodySha256 = suppliedBodyDigest ?? securityOperatorRequestBodyDigest(args.request.body);
  if (!/^sha256:[a-f0-9]{64}$/.test(bodySha256)) throw new Error("operator_assertion_body_digest_invalid");
  const payload: SecurityOperatorAssertionPayload = {
    schemaVersion: PASS4803_SECURITY_OPERATOR_ASSERTION_ID,
    operatorId: clean(args.operatorId, 220),
    role: args.role,
    scopes: Array.from(new Set(args.scopes.map((scope) => clean(scope, 80)).filter(Boolean))).sort(),
    mfa: args.mfa,
    issuedAt: issued.toISOString(),
    expiresAt: new Date(issued.getTime() + lifetimeSeconds * 1_000).toISOString(),
    nonce: clean(args.nonce, 160),
    request: {
      method: clean(args.request.method, 16).toUpperCase(),
      path: clean(args.request.path, 500),
      bodySha256,
    },
  };
  if (!payload.operatorId || !SAFE_NONCE.test(payload.nonce) || !payload.request.path.startsWith("/")) throw new Error("operator_assertion_claims_invalid");
  const encoded = base64urlEncode(canonicalJson(payload));
  return { assertion: encoded, signature: signatureFor(encoded, secret), payload };
}

export function verifySecurityOperatorAssertion(args: {
  request: Request;
  secret?: string;
  requiredRole: SecurityOperatorRole;
  requiredScopes: string[];
  requirePhishingResistantMfa?: boolean;
  requestBody?: unknown;
  requestBodySha256?: string;
  now?: string | Date;
}): SecurityOperatorAssertionVerdict {
  const encoded = args.request.headers.get("x-velmere-security-operator-assertion")?.trim() ?? "";
  const suppliedSignature = args.request.headers.get("x-velmere-security-operator-signature")?.trim().toLowerCase() ?? "";
  if (!encoded && !suppliedSignature) return { ok: false, error: "operator_assertion_missing", missing: true };
  if (!encoded || !suppliedSignature) return { ok: false, error: "operator_assertion_incomplete", missing: false };
  const secret = (args.secret ?? process.env.VELMERE_SECURITY_OPERATOR_ASSERTION_SECRET ?? "").trim();
  if (secret.length < 32) return { ok: false, error: "operator_assertion_secret_not_configured", missing: false };
  try {
    const expected = signatureFor(encoded, secret);
    if (!safeHexEqual(expected, suppliedSignature)) return { ok: false, error: "operator_assertion_signature_invalid", missing: false };
    const payload = parsePayload(encoded);
    const requestUrl = new URL(args.request.url);
    if (payload.request.method !== args.request.method.toUpperCase() || payload.request.path !== requestUrl.pathname) {
      return { ok: false, error: "operator_assertion_request_binding_mismatch", missing: false };
    }
    const requestBodySha256 = args.requestBodySha256?.trim().toLowerCase()
      ?? (typeof args.requestBody === "undefined" ? "" : securityOperatorRequestBodyDigest(args.requestBody));
    if (!/^sha256:[a-f0-9]{64}$/.test(requestBodySha256)) {
      return { ok: false, error: "operator_assertion_body_digest_required", missing: false };
    }
    if (payload.request.bodySha256 !== requestBodySha256) {
      return { ok: false, error: "operator_assertion_body_binding_mismatch", missing: false };
    }
    if (payload.role !== args.requiredRole) return { ok: false, error: "operator_assertion_role_mismatch", missing: false };
    if (!args.requiredScopes.every((scope) => payload.scopes.includes(scope))) return { ok: false, error: "operator_assertion_scope_missing", missing: false };
    if (args.requirePhishingResistantMfa && payload.mfa !== "webauthn") return { ok: false, error: "operator_assertion_phishing_resistant_mfa_required", missing: false };
    const now = args.now instanceof Date ? args.now : new Date(args.now ?? new Date());
    const issued = new Date(payload.issuedAt);
    const expires = new Date(payload.expiresAt);
    if (![now, issued, expires].every((date) => Number.isFinite(date.getTime()))) return { ok: false, error: "operator_assertion_time_invalid", missing: false };
    const lifetime = expires.getTime() - issued.getTime();
    if (lifetime < 30_000 || lifetime > MAX_LIFETIME_MS) return { ok: false, error: "operator_assertion_lifetime_invalid", missing: false };
    if (issued.getTime() > now.getTime() + CLOCK_SKEW_MS) return { ok: false, error: "operator_assertion_not_yet_valid", missing: false };
    if (expires.getTime() <= now.getTime()) return { ok: false, error: "operator_assertion_expired", missing: false };
    const fingerprint = sha256(`${encoded}:${suppliedSignature}`);
    return {
      ok: true,
      payload,
      operator: {
        id: payload.operatorId,
        pseudonym: `operator-${sha256(payload.operatorId).slice(0, 16)}`,
        role: payload.role,
        scopes: payload.scopes,
        mfa: payload.mfa,
        assertionFingerprint: fingerprint,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "operator_assertion_invalid", missing: false };
  }
}

export type SecurityOperatorAssertionConsumeVerdict =
  | (Extract<SecurityOperatorAssertionVerdict, { ok: true }> & {
      replayProtection: {
        storageMode: "upstash_rest_durable" | "supabase_durable" | "memory_runtime_only";
        durable: boolean;
        nonceKeyHash: string;
      };
    })
  | Extract<SecurityOperatorAssertionVerdict, { ok: false }>;

/**
 * Verifies the signed method/path/body binding and atomically reserves the
 * nonce before the caller performs any mutation. Production fails closed when
 * neither durable idempotency adapter is available.
 */
export async function verifyAndConsumeSecurityOperatorAssertion(args: Parameters<typeof verifySecurityOperatorAssertion>[0]): Promise<SecurityOperatorAssertionConsumeVerdict> {
  const verified = verifySecurityOperatorAssertion(args);
  if (!verified.ok) return verified;
  const now = args.now instanceof Date ? args.now : new Date(args.now ?? new Date());
  const expires = new Date(verified.payload.expiresAt);
  const ttlSeconds = Math.max(60, Math.min(600, Math.ceil((expires.getTime() - now.getTime()) / 1_000) + 60));
  const nonceKeyHash = `sha256:${sha256(`operator-assertion-nonce|${verified.payload.operatorId}|${verified.payload.nonce}`)}`;
  const valueHash = `sha256:${sha256(`${verified.operator.assertionFingerprint}|${verified.payload.request.bodySha256}`)}`;
  const reserved = await reservePass4395DurableIdempotencyKey({
    keyHash: nonceKeyHash,
    valueHash,
    ttlSeconds,
    receipt: {
      type: "security_operator_assertion_nonce",
      assertionFingerprint: verified.operator.assertionFingerprint,
      operatorPseudonym: verified.operator.pseudonym,
      method: verified.payload.request.method,
      path: verified.payload.request.path,
      bodySha256: verified.payload.request.bodySha256,
      expiresAt: verified.payload.expiresAt,
    },
  });
  if (reserved.duplicate) return { ok: false, error: "operator_assertion_nonce_replayed", missing: false };
  if (!reserved.ok) return { ok: false, error: "operator_assertion_nonce_store_unavailable", missing: false };
  return {
    ...verified,
    replayProtection: {
      storageMode: reserved.storageMode as "upstash_rest_durable" | "supabase_durable" | "memory_runtime_only",
      durable: reserved.durable,
      nonceKeyHash,
    },
  };
}
