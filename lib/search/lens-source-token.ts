import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";
import type { LensReportLocale } from "@/lib/search/lens-report";
import {
  isR7BrowserEcbBoundResult,
  inspectR7BrowserEcbDeliveryBinding,
  normalizeR7BrowserEcbDeliveryBinding,
  type R7BrowserEcbDeliveryBinding,
} from "@/lib/search/browser-ecb-delivery-authority";

export const PASS4822_LENS_SOURCE_TOKEN_ID = "pass4822-lens-source-result-token-v1" as const;

const PURPOSE = "lens_source_result" as const;
const SIGNATURE_DOMAIN = "velmere:lens-source-result:v1:";
const DEFAULT_TTL_SECONDS = 10 * 60;
const MAX_TTL_SECONDS = 30 * 60;
const MAX_TOKEN_BYTES = 96 * 1024;

type SigningKey = { kid: string; secret: string };

type LensSourceTokenEnvelope = {
  v: 1;
  purpose: typeof PURPOSE;
  kid: string;
  iat: number;
  exp: number;
  locale: LensReportLocale;
  resultDigest: string;
  result: VelmereSearchResult;
  deliveryBinding?: R7BrowserEcbDeliveryBinding;
};

function cleanKeyId(value: string | undefined, fallback: string) {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 48) || fallback;
}

function domainSeparatedFallback(secret: string) {
  return createHmac("sha256", secret).update("velmere:lens-source-result:v1:key").digest("hex");
}

function currentSigningKey(env: Record<string, string | undefined>): SigningKey | null {
  const current = String(env.VELMERE_LENS_SOURCE_TOKEN_SECRET_CURRENT ?? env.VELMERE_LENS_SOURCE_TOKEN_SECRET ?? "").trim();
  if (current.length >= 32) {
    return {
      kid: cleanKeyId(env.VELMERE_LENS_SOURCE_TOKEN_KEY_ID, "current"),
      secret: current,
    };
  }
  if (env.NODE_ENV !== "production") {
    const fallback = String(
      env.VELMERE_LENS_RENDER_TOKEN_SECRET_CURRENT
      ?? env.VELMERE_LENS_RENDER_TOKEN_SECRET
      ?? env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET
      ?? env.NEXTAUTH_SECRET
      ?? "",
    ).trim();
    if (fallback.length >= 32) {
      return {
        kid: "development-fallback",
        secret: domainSeparatedFallback(fallback),
      };
    }
  }
  return null;
}

function verificationKeys(env: Record<string, string | undefined>): SigningKey[] {
  const keys: SigningKey[] = [];
  const current = currentSigningKey(env);
  if (current) keys.push(current);
  const previous = String(env.VELMERE_LENS_SOURCE_TOKEN_SECRET_PREVIOUS ?? "").trim();
  if (previous.length >= 32) {
    keys.push({
      kid: cleanKeyId(env.VELMERE_LENS_SOURCE_TOKEN_PREVIOUS_KEY_ID, "previous"),
      secret: previous,
    });
  }
  return keys;
}

function validLocale(value: unknown): value is LensReportLocale {
  return value === "pl" || value === "en" || value === "de";
}

function validResult(value: unknown): value is VelmereSearchResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Partial<VelmereSearchResult>;
  if (!String(result.id ?? "").trim() || !String(result.title ?? "").trim()) return false;
  if (!String(result.category ?? "").trim() || !String(result.sourceMode ?? "").trim()) return false;
  if (!Array.isArray(result.sources) || !Array.isArray(result.missingData) || !Array.isArray(result.chips)) return false;
  if (typeof result.summary !== "string" || typeof result.whyItMatters !== "string" || typeof result.nextOperatorStep !== "string") return false;
  if (!Number.isFinite(Number(result.sourceConfidence))) return false;
  return true;
}

function strippedResult(result: VelmereSearchResult): VelmereSearchResult {
  const { lensSourceToken: _token, lensSourceTokenExpiresAt: _expires, ...rest } = result;
  return rest;
}

function sign(secret: string, encoded: string) {
  return createHmac("sha256", secret).update(`${SIGNATURE_DOMAIN}${encoded}`).digest();
}

export function issuePass4822LensSourceToken(args: {
  result: VelmereSearchResult;
  locale: LensReportLocale;
  env?: Record<string, string | undefined>;
  nowMs?: number;
  ttlSeconds?: number;
  deliveryBinding?: R7BrowserEcbDeliveryBinding;
}) {
  const current = currentSigningKey(args.env ?? process.env);
  if (!current) return { ok: false as const, error: "lens_source_token_secret_missing_or_short" as const };
  if (!validLocale(args.locale) || !validResult(args.result)) return { ok: false as const, error: "lens_source_token_result_invalid" as const };
  const result = strippedResult(args.result);
  const deliveryBinding = args.deliveryBinding === undefined
    ? null
    : normalizeR7BrowserEcbDeliveryBinding(args.deliveryBinding);
  if (args.deliveryBinding !== undefined && !deliveryBinding) {
    return { ok: false as const, error: "lens_source_token_delivery_binding_invalid" as const };
  }
  if (deliveryBinding && !isR7BrowserEcbBoundResult(result, deliveryBinding)) {
    return { ok: false as const, error: "lens_source_token_delivery_result_mismatch" as const };
  }
  if (!deliveryBinding && isR7BrowserEcbBoundResult(result)) {
    return { ok: false as const, error: "lens_source_token_delivery_binding_required" as const };
  }
  const nowMs = args.nowMs ?? Date.now();
  if (deliveryBinding && !inspectR7BrowserEcbDeliveryBinding({ binding: deliveryBinding, nowMs, result }).ready) {
    return { ok: false as const, error: "lens_source_token_delivery_binding_not_current" as const };
  }
  const now = Math.floor(nowMs / 1000);
  const ttl = Math.max(60, Math.min(MAX_TTL_SECONDS, Math.floor(args.ttlSeconds ?? DEFAULT_TTL_SECONDS)));
  const requestedExp = now + ttl;
  const exp = deliveryBinding
    ? Math.min(requestedExp, Math.floor(Date.parse(deliveryBinding.deliveryExpiresAt) / 1000))
    : requestedExp;
  if (deliveryBinding) {
    const originalDeadline = Math.floor(Date.parse(deliveryBinding.deliveryExpiresAt) / 1000);
    if (exp > originalDeadline || exp <= now || exp - now > MAX_TTL_SECONDS) {
      return { ok: false as const, error: "lens_source_token_original_deadline_mismatch" as const };
    }
  }
  const envelope: LensSourceTokenEnvelope = {
    v: 1,
    purpose: PURPOSE,
    kid: current.kid,
    iat: now,
    exp,
    locale: args.locale,
    resultDigest: sha256Digest(canonicalJson(result)),
    result,
    ...(deliveryBinding ? { deliveryBinding } : {}),
  };
  const encoded = Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
  const signature = sign(current.secret, encoded).toString("base64url");
  const token = `${encoded}.${signature}`;
  if (Buffer.byteLength(token, "utf8") > MAX_TOKEN_BYTES) return { ok: false as const, error: "lens_source_token_too_large" as const };
  return {
    ok: true as const,
    token,
    keyId: current.kid,
    resultDigest: envelope.resultDigest,
    expiresAt: new Date(envelope.exp * 1000).toISOString(),
  };
}

export function verifyPass4822LensSourceToken(args: {
  token: string;
  expectedLocale?: LensReportLocale;
  env?: Record<string, string | undefined>;
  nowMs?: number;
}) {
  const keys = verificationKeys(args.env ?? process.env);
  if (!keys.length) return { ok: false as const, error: "lens_source_token_secret_missing_or_short" as const };
  if (!args.token || Buffer.byteLength(args.token, "utf8") > MAX_TOKEN_BYTES) return { ok: false as const, error: "invalid_lens_source_token" as const };
  const [encoded, suppliedText, ...extra] = args.token.split(".");
  if (!encoded || !suppliedText || extra.length) return { ok: false as const, error: "invalid_lens_source_token" as const };
  let envelope: LensSourceTokenEnvelope;
  try {
    envelope = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as LensSourceTokenEnvelope;
  } catch {
    return { ok: false as const, error: "invalid_lens_source_token" as const };
  }
  if (envelope.v !== 1 || envelope.purpose !== PURPOSE || !validLocale(envelope.locale) || !validResult(envelope.result)) {
    return { ok: false as const, error: "invalid_lens_source_token" as const };
  }
  const deliveryBinding = envelope.deliveryBinding === undefined
    ? null
    : normalizeR7BrowserEcbDeliveryBinding(envelope.deliveryBinding);
  if (envelope.deliveryBinding !== undefined && !deliveryBinding) {
    return { ok: false as const, error: "lens_source_token_delivery_binding_invalid" as const };
  }
  const candidates = keys.filter((key) => key.kid === envelope.kid);
  if (!candidates.length) return { ok: false as const, error: "lens_source_token_key_unknown" as const };
  let supplied: Buffer;
  try { supplied = Buffer.from(suppliedText, "base64url"); } catch { return { ok: false as const, error: "invalid_lens_source_token" as const }; }
  const signatureValid = candidates.some((key) => {
    const expected = sign(key.secret, encoded);
    return expected.byteLength === supplied.byteLength && timingSafeEqual(expected, supplied);
  });
  if (!signatureValid) return { ok: false as const, error: "lens_source_token_signature_invalid" as const };
  const nowMs = args.nowMs ?? Date.now();
  const now = Math.floor(nowMs / 1000);
  if (!Number.isInteger(envelope.iat) || !Number.isInteger(envelope.exp) || envelope.exp <= envelope.iat || envelope.exp - envelope.iat > MAX_TTL_SECONDS || envelope.iat > now + 30) {
    return { ok: false as const, error: "invalid_lens_source_token" as const };
  }
  if (envelope.exp <= now) return { ok: false as const, error: "lens_source_token_expired" as const };
  if (args.expectedLocale && envelope.locale !== args.expectedLocale) return { ok: false as const, error: "lens_source_token_locale_mismatch" as const };
  const result = strippedResult(envelope.result);
  const digest = sha256Digest(canonicalJson(result));
  if (digest !== envelope.resultDigest) return { ok: false as const, error: "lens_source_token_result_digest_mismatch" as const };
  if (deliveryBinding && !isR7BrowserEcbBoundResult(result, deliveryBinding)) {
    return { ok: false as const, error: "lens_source_token_delivery_result_mismatch" as const };
  }
  if (!deliveryBinding && isR7BrowserEcbBoundResult(result)) {
    return { ok: false as const, error: "lens_source_token_delivery_binding_required" as const };
  }
  if (deliveryBinding) {
    const inspected = inspectR7BrowserEcbDeliveryBinding({ binding: deliveryBinding, nowMs, result });
    if (!inspected.ready) return { ok: false as const, error: "lens_source_token_delivery_binding_not_current" as const };
    if (envelope.exp > Math.floor(Date.parse(deliveryBinding.deliveryExpiresAt) / 1000)) {
      return { ok: false as const, error: "lens_source_token_original_deadline_mismatch" as const };
    }
  }
  return {
    ok: true as const,
    result,
    locale: envelope.locale,
    resultDigest: envelope.resultDigest,
    keyId: envelope.kid,
    expiresAt: new Date(envelope.exp * 1000).toISOString(),
    deliveryBinding,
  };
}
