import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type Stripe from "stripe";
import { validatePass4682PaidAccessTemporalClaims } from "@/lib/commerce/paid-access-boundary";
import {
  normalizePaidContext,
  type VlmPaidAccessContext,
  type VlmPaidProductId,
} from "@/lib/commerce/vlm-paid-access";
import { hashVlmPaidAccessContext, isVlmLocalPaidAccessDemoEnabled } from "@/lib/commerce/vlm-paid-access-server";
import { decodeStrictSignedCookieJson } from "@/lib/security/cookie-session-boundary";

export const VLM_CHECKOUT_VERIFICATION_BINDING_ID =
  "velmere.vlm-checkout-verification-binding.v1" as const;

const BINDING_TTL_MS = 2 * 60 * 60 * 1_000;
const BINDING_FUTURE_SKEW_MS = 30_000;
const MAX_BINDING_TOKEN_LENGTH = 4_096;
const SAFE_SESSION_ID = /^(?:cs_(?:test_|live_)?[A-Za-z0-9_-]{4,176}|vlm_demo_[A-Za-z0-9:_-]{4,176})$/u;
const SAFE_PRODUCT_CELL_ID = /^[A-Za-z0-9._:-]{4,180}$/u;
const SHA256_HEX = /^[a-f0-9]{64}$/u;
const BASE64URL_SIGNATURE = /^[A-Za-z0-9_-]{43}$/u;

export type VlmCheckoutVerificationBindingPayload = {
  schemaVersion: typeof VLM_CHECKOUT_VERIFICATION_BINDING_ID;
  sessionId: string;
  productId: VlmPaidProductId;
  productCellId: string;
  productCellBindingSha256: string;
  accountIdHash: string;
  contextHash: string;
  surface: VlmPaidAccessContext["surface"];
  locale: VlmPaidAccessContext["locale"];
  depth: VlmPaidAccessContext["depth"] | null;
  auditCaseRef: string | null;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
};

const EXACT_PAYLOAD_KEYS = [
  "accountIdHash",
  "auditCaseRef",
  "contextHash",
  "depth",
  "expiresAt",
  "issuedAt",
  "locale",
  "nonce",
  "productCellBindingSha256",
  "productCellId",
  "productId",
  "schemaVersion",
  "sessionId",
  "surface",
] as const;

function bindingSecret() {
  const configured = (
    process.env.VELMERE_PAID_ACCESS_SECRET ||
    process.env.VELMERE_VLM_RECEIPT_SECRET ||
    ""
  ).trim();
  if (configured.length >= 32) return configured;
  return isVlmLocalPaidAccessDemoEnabled()
    ? "velmere-local-vlm-checkout-binding-never-production-4807"
    : "";
}

function signatureFor(encoded: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${VLM_CHECKOUT_VERIFICATION_BINDING_ID}:${encoded}`, "utf8")
    .digest("base64url");
}

function safeSignatureEqual(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function exactPayloadKeys(value: Record<string, unknown>) {
  const actual = Object.keys(value).sort();
  return actual.length === EXACT_PAYLOAD_KEYS.length
    && actual.every((key, index) => key === EXACT_PAYLOAD_KEYS[index]);
}

function normalizedBindingContext(
  context: Partial<VlmPaidAccessContext>,
  accountIdHash: string,
) {
  return normalizePaidContext(
    {
      ...context,
      accountIdHash,
    },
    context.locale,
  );
}

function payloadClaimsValid(payload: VlmCheckoutVerificationBindingPayload) {
  return payload.schemaVersion === VLM_CHECKOUT_VERIFICATION_BINDING_ID
    && SAFE_SESSION_ID.test(payload.sessionId)
    && SAFE_PRODUCT_CELL_ID.test(payload.productCellId)
    && SHA256_HEX.test(payload.productCellBindingSha256)
    && SHA256_HEX.test(payload.accountIdHash)
    && SHA256_HEX.test(payload.contextHash)
    && (payload.surface === "shield"
      || payload.surface === "shield-pro"
      || payload.surface === "real-markets"
      || payload.surface === "browser"
      || payload.surface === "audit"
      || payload.surface === "unknown")
    && (payload.locale === "pl" || payload.locale === "en" || payload.locale === "de")
    && (payload.depth === null
      || payload.depth === "basic"
      || payload.depth === "pro"
      || payload.depth === "advanced")
    && (payload.auditCaseRef === null
      || (/^AUD-[A-Z0-9]{8,16}$/u.test(payload.auditCaseRef)))
    && /^[a-f0-9]{32}$/u.test(payload.nonce);
}

export function createVlmCheckoutVerificationBinding(args: {
  sessionId: string;
  productId: VlmPaidProductId;
  productCellId: string;
  productCellBindingSha256: string;
  accountIdHash: string;
  context: Partial<VlmPaidAccessContext>;
  now?: Date;
}) {
  const secret = bindingSecret();
  if (secret.length < 32) {
    return { ok: false as const, error: "checkout_verification_binding_secret_missing" };
  }
  const context = normalizedBindingContext(args.context, args.accountIdHash);
  const now = args.now ?? new Date();
  const payload: VlmCheckoutVerificationBindingPayload = {
    schemaVersion: VLM_CHECKOUT_VERIFICATION_BINDING_ID,
    sessionId: args.sessionId,
    productId: args.productId,
    productCellId: args.productCellId,
    productCellBindingSha256: args.productCellBindingSha256,
    accountIdHash: args.accountIdHash,
    contextHash: hashVlmPaidAccessContext(context),
    surface: context.surface,
    locale: context.locale,
    depth: context.depth ?? null,
    auditCaseRef: context.auditCaseRef ?? null,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + BINDING_TTL_MS).toISOString(),
    nonce: randomBytes(16).toString("hex"),
  };
  if (!payloadClaimsValid(payload)) {
    return { ok: false as const, error: "checkout_verification_binding_claims_invalid" };
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const token = `${encoded}.${signatureFor(encoded, secret)}`;
  if (token.length > MAX_BINDING_TOKEN_LENGTH) {
    return { ok: false as const, error: "checkout_verification_binding_too_large" };
  }
  return { ok: true as const, token, payload };
}

export function verifyVlmCheckoutVerificationBinding(args: {
  token: unknown;
  sessionId: string;
  productId: VlmPaidProductId;
  productCellId: string;
  accountIdHash: string;
  context: Partial<VlmPaidAccessContext>;
  now?: Date;
}) {
  const token = typeof args.token === "string" ? args.token.trim() : "";
  const secret = bindingSecret();
  if (!token || token.length > MAX_BINDING_TOKEN_LENGTH || secret.length < 32) {
    return { ok: false as const, error: "checkout_verification_binding_missing" };
  }
  const [encoded, signature, ...extra] = token.split(".");
  if (
    !encoded ||
    !signature ||
    extra.length > 0 ||
    !BASE64URL_SIGNATURE.test(signature) ||
    !safeSignatureEqual(signatureFor(encoded, secret), signature)
  ) {
    return { ok: false as const, error: "checkout_verification_binding_invalid" };
  }

  let payload: VlmCheckoutVerificationBindingPayload;
  try {
    payload = decodeStrictSignedCookieJson<VlmCheckoutVerificationBindingPayload>({
      encodedPayload: encoded,
      maxDecodedBytes: 3_072,
      maxDepth: 3,
      maxNodes: 32,
    });
  } catch {
    return { ok: false as const, error: "checkout_verification_binding_invalid" };
  }
  if (
    !exactPayloadKeys(payload as unknown as Record<string, unknown>)
    || !payloadClaimsValid(payload)
  ) {
    return { ok: false as const, error: "checkout_verification_binding_invalid" };
  }
  const temporal = validatePass4682PaidAccessTemporalClaims({
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    nowMs: (args.now ?? new Date()).getTime(),
    maxTtlMs: BINDING_TTL_MS,
    futureSkewMs: BINDING_FUTURE_SKEW_MS,
  });
  if (!temporal.ok) {
    return { ok: false as const, error: `checkout_verification_binding_${temporal.error}` };
  }

  const context = normalizedBindingContext(args.context, args.accountIdHash);
  const expectedContextHash = hashVlmPaidAccessContext(context);
  if (
    payload.sessionId !== args.sessionId
    || payload.productId !== args.productId
    || payload.productCellId !== args.productCellId
    || payload.accountIdHash !== args.accountIdHash
    || payload.contextHash !== expectedContextHash
    || payload.surface !== context.surface
    || payload.locale !== context.locale
    || payload.depth !== (context.depth ?? null)
    || payload.auditCaseRef !== (context.auditCaseRef ?? null)
  ) {
    return { ok: false as const, error: "checkout_verification_binding_mismatch" };
  }
  return {
    ok: true as const,
    payload,
    context,
    boundary: VLM_CHECKOUT_VERIFICATION_BINDING_ID,
  };
}

export function verifyVlmCheckoutSessionMetadataBinding(args: {
  session: Stripe.Checkout.Session;
  binding: VlmCheckoutVerificationBindingPayload;
}) {
  const metadata = args.session.metadata;
  const valid = args.session.id === args.binding.sessionId
    && metadata?.kind === "vlm_paid_access"
    && metadata?.productId === args.binding.productId
    && metadata?.productCellId === args.binding.productCellId
    && metadata?.productCellBindingSha256 === args.binding.productCellBindingSha256
    && metadata?.accountIdHash === args.binding.accountIdHash
    && metadata?.contextHash === args.binding.contextHash
    && metadata?.surface === args.binding.surface
    && metadata?.locale === args.binding.locale
    && (metadata?.depth || null) === args.binding.depth
    && (metadata?.auditCaseRef || null) === args.binding.auditCaseRef;
  return valid
    ? { ok: true as const }
    : { ok: false as const, error: "checkout_session_metadata_binding_mismatch" };
}
