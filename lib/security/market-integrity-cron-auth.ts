import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { canonicalJson } from "@/lib/security/canonical-json";
import { reservePass4395DurableIdempotencyKey } from "@/lib/security/durable-idempotency-store";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export type MarketIntegrityCronAuthResult = {
  authorized: boolean;
  reason: "authorized" | "missing_secret" | "weak_secret" | "missing_bearer" | "invalid_bearer" | "development_without_secret";
  scope: string;
  keyId: "current" | "previous" | "legacy" | null;
};

export function marketIntegrityWorkerScopeForPath(pathname: string) {
  return pathname
    .replace(/^\/api\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .slice(0, 120) || "UNKNOWN";
}

function workerScope(request: Request) {
  return marketIntegrityWorkerScopeForPath(new URL(request.url).pathname);
}

/**
 * Read-only worker endpoints retain authorization-header authentication compatibility.
 * Mutating POST endpoints must use the body-bound, replay-protected envelope
 * implemented below. An x-vercel-cron header is never authentication.
 */
export function authorizeMarketIntegrityCron(request: Request): MarketIntegrityCronAuthResult {
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const scope = workerScope(request);
  const current = process.env[`VELMERE_WORKER_${scope}_SECRET_CURRENT`]?.trim() ?? "";
  const previous = process.env[`VELMERE_WORKER_${scope}_SECRET_PREVIOUS`]?.trim() ?? "";
  const legacyAllowed = !productionLike || process.env.VELMERE_ALLOW_LEGACY_GLOBAL_CRON_SECRET === "true";
  const legacy = legacyAllowed
    ? process.env.MARKET_INTEGRITY_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim() || ""
    : "";
  const candidates = [
    current ? { secret: current, keyId: "current" as const } : null,
    previous ? { secret: previous, keyId: "previous" as const } : null,
    legacy ? { secret: legacy, keyId: "legacy" as const } : null,
  ].filter((value): value is { secret: string; keyId: "current" | "previous" | "legacy" } => Boolean(value));

  if (candidates.length === 0) {
    return productionLike
      ? { authorized: false, reason: "missing_secret", scope, keyId: null }
      : { authorized: true, reason: "development_without_secret", scope, keyId: null };
  }
  if (productionLike && candidates.some((candidate) => candidate.secret.length < 32)) {
    return { authorized: false, reason: "weak_secret", scope, keyId: null };
  }

  const authorization = request.headers.get("authorization")?.trim() || "";
  if (!authorization.startsWith("Bearer ")) return { authorized: false, reason: "missing_bearer", scope, keyId: null };
  const provided = authorization.slice("Bearer ".length).trim();
  const matched = candidates.find((candidate) => safeEqual(provided, candidate.secret));
  return matched
    ? { authorized: true, reason: "authorized", scope, keyId: matched.keyId }
    : { authorized: false, reason: "invalid_bearer", scope, keyId: null };
}

/**
 * Vercel scheduled functions send CRON_SECRET as an Authorization bearer.
 * This narrow adapter is for a route explicitly present in vercel.json; it
 * never trusts x-vercel-cron and never grants development-without-secret.
 */
export function authorizeVercelCron(request: Request): MarketIntegrityCronAuthResult {
  const scope = workerScope(request);
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) return { authorized: false, reason: "missing_secret", scope, keyId: null };
  if (secret.length < 32) return { authorized: false, reason: "weak_secret", scope, keyId: null };
  const authorization = request.headers.get("authorization")?.trim() || "";
  if (!authorization.startsWith("Bearer ")) {
    return { authorized: false, reason: "missing_bearer", scope, keyId: null };
  }
  const provided = authorization.slice("Bearer ".length).trim();
  return safeEqual(provided, secret)
    ? { authorized: true, reason: "authorized", scope, keyId: "legacy" }
    : { authorized: false, reason: "invalid_bearer", scope, keyId: null };
}

export const MARKET_INTEGRITY_WORKER_MUTATION_ENVELOPE_ID =
  "velmere-market-integrity-worker-mutation-envelope-v1" as const;

export type MarketIntegrityWorkerKeyId = "current" | "previous";

export type MarketIntegrityWorkerMutationEnvelope = {
  schemaVersion: typeof MARKET_INTEGRITY_WORKER_MUTATION_ENVELOPE_ID;
  keyId: MarketIntegrityWorkerKeyId;
  scope: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  request: {
    method: string;
    path: string;
    bodySha256: string;
  };
};

export type MarketIntegrityWorkerMutationError =
  | "worker_envelope_missing"
  | "worker_envelope_incomplete"
  | "worker_envelope_encoding_invalid"
  | "worker_envelope_size_invalid"
  | "worker_envelope_payload_invalid"
  | "worker_envelope_key_not_configured"
  | "worker_envelope_weak_secret"
  | "worker_envelope_signature_invalid"
  | "worker_envelope_request_binding_mismatch"
  | "worker_envelope_body_binding_mismatch"
  | "worker_envelope_scope_mismatch"
  | "worker_envelope_time_invalid"
  | "worker_envelope_lifetime_invalid"
  | "worker_envelope_not_yet_valid"
  | "worker_envelope_expired"
  | "worker_envelope_nonce_replayed"
  | "worker_envelope_nonce_store_unavailable";

export type MarketIntegrityWorkerMutationVerification =
  | {
      authorized: true;
      envelope: MarketIntegrityWorkerMutationEnvelope;
      fingerprint: string;
      keyId: MarketIntegrityWorkerKeyId;
      scope: string;
    }
  | { authorized: false; error: MarketIntegrityWorkerMutationError; scope: string };

export type MarketIntegrityWorkerMutationAuthorization =
  | (Extract<MarketIntegrityWorkerMutationVerification, { authorized: true }> & {
      replayProtection: {
        storageMode: "upstash_rest_durable" | "supabase_durable" | "memory_runtime_only";
        durable: boolean;
        nonceKeyHash: string;
      };
    })
  | Extract<MarketIntegrityWorkerMutationVerification, { authorized: false }>;

const WORKER_ENVELOPE_MAX_DECODED_BYTES = 4_096;
const WORKER_ENVELOPE_MIN_LIFETIME_MS = 30_000;
const WORKER_ENVELOPE_MAX_LIFETIME_MS = 5 * 60_000;
const WORKER_ENVELOPE_CLOCK_SKEW_MS = 30_000;
const SAFE_WORKER_SCOPE = /^[A-Z0-9_]{1,120}$/;
const SAFE_WORKER_NONCE = /^[A-Za-z0-9_-]{16,160}$/;
const SAFE_WORKER_PATH = /^\/[A-Za-z0-9/_-]{1,499}$/;
const ISO_WORKER_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function marketIntegrityWorkerBodyDigest(rawBody: string | Uint8Array) {
  return `sha256:${sha256(rawBody)}`;
}

function workerEnvelopeSignature(encoded: string, secret: string) {
  return createHmac("sha256", secret).update(encoded, "utf8").digest("hex");
}

function safeHexEqual(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function encodeWorkerEnvelope(payload: MarketIntegrityWorkerMutationEnvelope) {
  return Buffer.from(canonicalJson(payload), "utf8").toString("base64url");
}

function parseWorkerEnvelope(encoded: string): MarketIntegrityWorkerMutationEnvelope {
  if (!encoded || encoded.length > WORKER_ENVELOPE_MAX_DECODED_BYTES * 2 || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new Error("worker_envelope_encoding_invalid");
  }
  const decoded = Buffer.from(encoded, "base64url");
  if (decoded.byteLength === 0 || decoded.byteLength > WORKER_ENVELOPE_MAX_DECODED_BYTES) {
    throw new Error("worker_envelope_size_invalid");
  }
  const parsed = JSON.parse(decoded.toString("utf8")) as Partial<MarketIntegrityWorkerMutationEnvelope>;
  const keyId = parsed.keyId;
  const scope = typeof parsed.scope === "string" ? parsed.scope : "";
  const issuedAt = typeof parsed.issuedAt === "string" ? parsed.issuedAt : "";
  const expiresAt = typeof parsed.expiresAt === "string" ? parsed.expiresAt : "";
  const nonce = typeof parsed.nonce === "string" ? parsed.nonce : "";
  const method = typeof parsed.request?.method === "string" ? parsed.request.method.toUpperCase() : "";
  const path = typeof parsed.request?.path === "string" ? parsed.request.path : "";
  const bodySha256 = typeof parsed.request?.bodySha256 === "string" ? parsed.request.bodySha256.toLowerCase() : "";
  if (
    parsed.schemaVersion !== MARKET_INTEGRITY_WORKER_MUTATION_ENVELOPE_ID
    || (keyId !== "current" && keyId !== "previous")
    || !SAFE_WORKER_SCOPE.test(scope)
    || !ISO_WORKER_TIMESTAMP.test(issuedAt)
    || !ISO_WORKER_TIMESTAMP.test(expiresAt)
    || !SAFE_WORKER_NONCE.test(nonce)
    || method !== "POST"
    || !SAFE_WORKER_PATH.test(path)
    || !/^sha256:[a-f0-9]{64}$/.test(bodySha256)
  ) {
    throw new Error("worker_envelope_payload_invalid");
  }
  const envelope: MarketIntegrityWorkerMutationEnvelope = {
    schemaVersion: MARKET_INTEGRITY_WORKER_MUTATION_ENVELOPE_ID,
    keyId,
    scope,
    issuedAt,
    expiresAt,
    nonce,
    request: { method, path, bodySha256 },
  };
  if (encodeWorkerEnvelope(envelope) !== encoded) throw new Error("worker_envelope_payload_invalid");
  return envelope;
}

function workerSecret(scope: string, keyId: MarketIntegrityWorkerKeyId) {
  return process.env[`VELMERE_WORKER_${scope}_SECRET_${keyId.toUpperCase()}`]?.trim() ?? "";
}

export function issueMarketIntegrityWorkerMutationEnvelope(args: {
  secret: string;
  keyId: MarketIntegrityWorkerKeyId;
  path: string;
  rawBody: string | Uint8Array;
  nonce: string;
  scope?: string;
  issuedAt?: string | Date;
  expiresInSeconds?: number;
}) {
  const secret = args.secret.trim();
  if (secret.length < 32) throw new Error("worker_envelope_weak_secret");
  const issued = args.issuedAt instanceof Date ? args.issuedAt : new Date(args.issuedAt ?? new Date());
  if (!Number.isFinite(issued.getTime())) throw new Error("worker_envelope_time_invalid");
  const expiresInSeconds = args.expiresInSeconds ?? 120;
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 30 || expiresInSeconds > 300) {
    throw new Error("worker_envelope_lifetime_invalid");
  }
  const scope = args.scope ?? marketIntegrityWorkerScopeForPath(args.path);
  const payload: MarketIntegrityWorkerMutationEnvelope = {
    schemaVersion: MARKET_INTEGRITY_WORKER_MUTATION_ENVELOPE_ID,
    keyId: args.keyId,
    scope,
    issuedAt: issued.toISOString(),
    expiresAt: new Date(issued.getTime() + expiresInSeconds * 1_000).toISOString(),
    nonce: args.nonce,
    request: {
      method: "POST",
      path: args.path,
      bodySha256: marketIntegrityWorkerBodyDigest(args.rawBody),
    },
  };
  if (!SAFE_WORKER_SCOPE.test(payload.scope) || !SAFE_WORKER_NONCE.test(payload.nonce) || !SAFE_WORKER_PATH.test(payload.request.path)) {
    throw new Error("worker_envelope_payload_invalid");
  }
  const envelope = encodeWorkerEnvelope(payload);
  const signature = workerEnvelopeSignature(envelope, secret);
  return {
    envelope,
    signature,
    payload,
    headers: {
      "x-velmere-worker-envelope": envelope,
      "x-velmere-worker-signature": signature,
    } as const,
  };
}

export function verifyMarketIntegrityWorkerMutationEnvelope(args: {
  request: Request;
  rawBody: string | Uint8Array;
  now?: string | Date;
}): MarketIntegrityWorkerMutationVerification {
  const scope = workerScope(args.request);
  const encoded = args.request.headers.get("x-velmere-worker-envelope")?.trim() ?? "";
  const suppliedSignature = args.request.headers.get("x-velmere-worker-signature")?.trim().toLowerCase() ?? "";
  if (!encoded && !suppliedSignature) return { authorized: false, error: "worker_envelope_missing", scope };
  if (!encoded || !suppliedSignature) return { authorized: false, error: "worker_envelope_incomplete", scope };
  try {
    const envelope = parseWorkerEnvelope(encoded);
    const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    const current = workerSecret(scope, "current");
    const previous = workerSecret(scope, "previous");
    if (productionLike && [current, previous].some((secret) => secret.length > 0 && secret.length < 32)) {
      return { authorized: false, error: "worker_envelope_weak_secret", scope };
    }
    const secret = envelope.keyId === "current" ? current : previous;
    if (!secret) return { authorized: false, error: "worker_envelope_key_not_configured", scope };
    if (secret.length < 32) return { authorized: false, error: "worker_envelope_weak_secret", scope };
    if (!safeHexEqual(workerEnvelopeSignature(encoded, secret), suppliedSignature)) {
      return { authorized: false, error: "worker_envelope_signature_invalid", scope };
    }
    const requestUrl = new URL(args.request.url);
    if (envelope.scope !== scope) return { authorized: false, error: "worker_envelope_scope_mismatch", scope };
    if (
      envelope.request.method !== args.request.method.toUpperCase()
      || envelope.request.path !== requestUrl.pathname
      || requestUrl.search.length > 0
    ) {
      return { authorized: false, error: "worker_envelope_request_binding_mismatch", scope };
    }
    if (envelope.request.bodySha256 !== marketIntegrityWorkerBodyDigest(args.rawBody)) {
      return { authorized: false, error: "worker_envelope_body_binding_mismatch", scope };
    }
    const now = args.now instanceof Date ? args.now : new Date(args.now ?? new Date());
    const issued = new Date(envelope.issuedAt);
    const expires = new Date(envelope.expiresAt);
    if (![now, issued, expires].every((date) => Number.isFinite(date.getTime()))) {
      return { authorized: false, error: "worker_envelope_time_invalid", scope };
    }
    const lifetimeMs = expires.getTime() - issued.getTime();
    if (lifetimeMs < WORKER_ENVELOPE_MIN_LIFETIME_MS || lifetimeMs > WORKER_ENVELOPE_MAX_LIFETIME_MS) {
      return { authorized: false, error: "worker_envelope_lifetime_invalid", scope };
    }
    if (issued.getTime() > now.getTime() + WORKER_ENVELOPE_CLOCK_SKEW_MS) {
      return { authorized: false, error: "worker_envelope_not_yet_valid", scope };
    }
    if (expires.getTime() <= now.getTime()) return { authorized: false, error: "worker_envelope_expired", scope };
    return {
      authorized: true,
      envelope,
      fingerprint: `sha256:${sha256(`${encoded}:${suppliedSignature}`)}`,
      keyId: envelope.keyId,
      scope,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "worker_envelope_payload_invalid";
    const allowed: ReadonlySet<string> = new Set([
      "worker_envelope_encoding_invalid",
      "worker_envelope_size_invalid",
      "worker_envelope_payload_invalid",
    ]);
    return {
      authorized: false,
      error: (allowed.has(message) ? message : "worker_envelope_payload_invalid") as MarketIntegrityWorkerMutationError,
      scope,
    };
  }
}

/**
 * Verifies method/path/scope/body/time/key rotation, then atomically reserves
 * the nonce before any mutation. PASS4395 makes production fail closed unless
 * an Upstash or Supabase durable adapter is configured.
 */
export async function authorizeMarketIntegrityWorkerMutation(args: {
  request: Request;
  rawBody: string | Uint8Array;
  now?: string | Date;
}): Promise<MarketIntegrityWorkerMutationAuthorization> {
  const verified = verifyMarketIntegrityWorkerMutationEnvelope(args);
  if (!verified.authorized) return verified;
  const now = args.now instanceof Date ? args.now : new Date(args.now ?? new Date());
  const expires = new Date(verified.envelope.expiresAt);
  const ttlSeconds = Math.max(60, Math.min(360, Math.ceil((expires.getTime() - now.getTime()) / 1_000) + 60));
  const nonceKeyHash = `sha256:${sha256(`worker-mutation-nonce|${verified.scope}|${verified.envelope.nonce}`)}`;
  const valueHash = `sha256:${sha256(`${verified.fingerprint}|${verified.envelope.request.bodySha256}`)}`;
  const reserved = await reservePass4395DurableIdempotencyKey({
    keyHash: nonceKeyHash,
    valueHash,
    ttlSeconds,
    receipt: {
      type: "market_integrity_worker_mutation_nonce",
      fingerprint: verified.fingerprint,
      scope: verified.scope,
      keyId: verified.keyId,
      method: verified.envelope.request.method,
      path: verified.envelope.request.path,
      bodySha256: verified.envelope.request.bodySha256,
      issuedAt: verified.envelope.issuedAt,
      expiresAt: verified.envelope.expiresAt,
    },
  });
  if (reserved.duplicate) return { authorized: false, error: "worker_envelope_nonce_replayed", scope: verified.scope };
  if (!reserved.ok) return { authorized: false, error: "worker_envelope_nonce_store_unavailable", scope: verified.scope };
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (productionLike && !reserved.durable) {
    return { authorized: false, error: "worker_envelope_nonce_store_unavailable", scope: verified.scope };
  }
  return {
    ...verified,
    replayProtection: {
      storageMode: reserved.storageMode as "upstash_rest_durable" | "supabase_durable" | "memory_runtime_only",
      durable: reserved.durable,
      nonceKeyHash,
    },
  };
}

export function marketIntegrityWorkerMutationErrorStatus(error: MarketIntegrityWorkerMutationError) {
  if (error === "worker_envelope_nonce_replayed") return 409;
  if (error === "worker_envelope_nonce_store_unavailable") return 503;
  return 401;
}
