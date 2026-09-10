import { createHmac, createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { validatePass4682PaidAccessTemporalClaims } from "@/lib/commerce/paid-access-boundary";
import {
  normalizePaidContext,
  type VlmPaidAccessContext,
  type VlmPaidProductId,
} from "@/lib/commerce/vlm-paid-access";

export const PASS4682_PAID_ACCESS_TOKEN_TEMPORAL_BOUNDARY_ID = "pass4682-paid-access-token-temporal-boundary-v1" as const;

export type VlmPaidAccessTokenPayload = {
  version: "vlm-paid-access-v1";
  productId: VlmPaidProductId;
  contextHash: string;
  sessionId: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
};

export function isVlmLocalPaidAccessDemoEnabled() {
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  return !productionLike && process.env.VELMERE_LOCAL_PAID_ACCESS_DEMO === "true";
}

function getSecret() {
  const configured = process.env.VELMERE_PAID_ACCESS_SECRET || process.env.VELMERE_VLM_RECEIPT_SECRET || "";
  if (configured.length >= 32) return configured;
  // Local-only: lets the full checkout -> success -> server-token -> Advanced route loop be tested
  // before the business/Stripe live verification is finished. Production never falls back here.
  if (isVlmLocalPaidAccessDemoEnabled()) return "velmere-local-paid-access-demo-secret-never-production-2258";
  return "";
}

function resolvePaidAccessTokenTtlMs() {
  const raw = Number(process.env.VELMERE_PAID_ACCESS_TTL_MS);
  if (Number.isFinite(raw) && raw >= 1000 * 60 * 10 && raw <= 1000 * 60 * 60 * 24 * 365) return raw;
  return 1000 * 60 * 60 * 24 * 30;
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function parseBase64url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function hashVlmPaidAccessContext(context: Partial<VlmPaidAccessContext>): string {
  const normalized = normalizePaidContext(context, context.locale);
  return createHash("sha256")
    .update(JSON.stringify({
      surface: normalized.surface,
      locale: normalized.locale,
      assetId: normalized.assetId || "",
      symbol: normalized.symbol || "",
      depth: normalized.depth || "",
      requestId: normalized.requestId || "",
      auditCaseRef: normalized.auditCaseRef || "",
      accountIdHash: normalized.accountIdHash || "",
    }))
    .digest("hex");
}

export function createVlmPaidAccessToken(args: {
  productId: VlmPaidProductId;
  context: Partial<VlmPaidAccessContext>;
  sessionId: string;
  ttlMs?: number;
  now?: Date;
}) {
  const secret = getSecret();
  if (secret.length < 32) {
    return { ok: false as const, error: "missing_paid_access_secret" };
  }
  const now = args.now ?? new Date();
  const payload: VlmPaidAccessTokenPayload = {
    version: "vlm-paid-access-v1",
    productId: args.productId,
    contextHash: hashVlmPaidAccessContext(args.context),
    sessionId: args.sessionId.slice(0, 96),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + (args.ttlMs ?? resolvePaidAccessTokenTtlMs())).toISOString(),
    nonce: randomBytes(12).toString("hex"),
  };
  const encoded = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return { ok: true as const, token: `${encoded}.${signature}`, payload };
}

const MAX_PAID_ACCESS_TOKEN_LENGTH = 16 * 1024;
const MAX_PAID_ACCESS_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 365;
const MAX_PAID_ACCESS_FUTURE_SKEW_MS = 30_000;

export function verifyVlmPaidAccessToken(args: {
  token: string | null | undefined;
  productId: VlmPaidProductId;
  context: Partial<VlmPaidAccessContext>;
  now?: Date;
}) {
  const secret = getSecret();
  const rawToken = typeof args.token === "string" ? args.token.trim() : "";
  if (!rawToken || secret.length < 32) {
    return { ok: false as const, error: "missing_token_or_secret" };
  }
  if (rawToken.length > MAX_PAID_ACCESS_TOKEN_LENGTH) return { ok: false as const, error: "token_too_large" };
  const [encoded, signature, ...extra] = rawToken.split(".");
  if (!encoded || !signature || extra.length) return { ok: false as const, error: "malformed_token" };
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return { ok: false as const, error: "invalid_signature" };
  }
  let payload: VlmPaidAccessTokenPayload;
  try {
    payload = JSON.parse(parseBase64url(encoded)) as VlmPaidAccessTokenPayload;
  } catch {
    return { ok: false as const, error: "invalid_payload" };
  }
  if (payload.version !== "vlm-paid-access-v1") return { ok: false as const, error: "invalid_version" };
  if (payload.productId !== args.productId) return { ok: false as const, error: "product_mismatch" };
  if (payload.contextHash !== hashVlmPaidAccessContext(args.context)) return { ok: false as const, error: "context_mismatch" };
  if (!payload.sessionId || payload.sessionId.length > 96 || !payload.nonce || payload.nonce.length < 16 || payload.nonce.length > 96) {
    return { ok: false as const, error: "invalid_claims" };
  }
  const temporal = validatePass4682PaidAccessTemporalClaims({
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    nowMs: (args.now ?? new Date()).getTime(),
    maxTtlMs: MAX_PAID_ACCESS_TOKEN_TTL_MS,
    futureSkewMs: MAX_PAID_ACCESS_FUTURE_SKEW_MS,
  });
  if (!temporal.ok) return temporal;
  return { ok: true as const, payload, boundary: PASS4682_PAID_ACCESS_TOKEN_TEMPORAL_BOUNDARY_ID };
}
