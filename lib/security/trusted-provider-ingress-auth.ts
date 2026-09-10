import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  reservePass4395DurableIdempotencyKey,
  type Pass4395DurableIdempotencyReserveResult,
} from "@/lib/security/durable-idempotency-store";

export const TRUSTED_PROVIDER_INGRESS_AUTH_VERSION =
  "velmere-trusted-provider-ingress-hmac-v1" as const;

export const TRUSTED_PROVIDER_INGRESS_HEADERS = {
  issuedAt: "x-velmere-provider-issued-at",
  nonce: "x-velmere-provider-nonce",
  signature: "x-velmere-provider-signature",
} as const;

const MAX_PAST_AGE_MS = 90_000;
const MAX_FUTURE_SKEW_MS = 15_000;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;

type ReserveNonce = typeof reservePass4395DurableIdempotencyKey;

export type TrustedProviderIngressAuthorization =
  | {
      authorized: true;
      bodySha256: string;
      nonceHash: string;
      issuedAt: string;
      replayProtection: Pick<
        Pass4395DurableIdempotencyReserveResult,
        "storageMode" | "durable" | "failClosed"
      >;
    }
  | {
      authorized: false;
      error:
        | "ingress_secret_missing_or_weak"
        | "ingress_method_invalid"
        | "ingress_timestamp_missing_or_invalid"
        | "ingress_timestamp_not_yet_valid"
        | "ingress_timestamp_expired"
        | "ingress_nonce_invalid"
        | "ingress_signature_invalid"
        | "ingress_nonce_replayed"
        | "ingress_nonce_store_unavailable";
      status: 400 | 401 | 409 | 503;
      retryable: boolean;
    };

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalSignatureInput(args: {
  method: string;
  pathname: string;
  issuedAt: string;
  nonce: string;
  bodySha256: string;
}) {
  return [
    TRUSTED_PROVIDER_INGRESS_AUTH_VERSION,
    args.method.toUpperCase(),
    args.pathname,
    args.issuedAt,
    args.nonce,
    `sha256:${args.bodySha256}`,
  ].join("\n");
}

export function createTrustedProviderIngressSignature(args: {
  secret: string;
  method: string;
  pathname: string;
  issuedAt: string;
  nonce: string;
  rawBody: string;
}) {
  const bodySha256 = sha256(args.rawBody);
  const signature = createHmac("sha256", args.secret)
    .update(canonicalSignatureInput({ ...args, bodySha256 }), "utf8")
    .digest("hex");
  return { signature, bodySha256 };
}

function signaturesMatch(provided: string, expected: string) {
  if (!SIGNATURE_PATTERN.test(provided) || !SIGNATURE_PATTERN.test(expected)) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(provided, "hex"),
    Buffer.from(expected, "hex"),
  );
}

export async function authorizeTrustedProviderIngress(args: {
  request: Request;
  rawBody: string;
  secret?: string;
  now?: Date;
  reserveNonce?: ReserveNonce;
}): Promise<TrustedProviderIngressAuthorization> {
  const secret = (
    args.secret ?? process.env.VELMERE_MARKET_INTELLIGENCE_INGEST_SECRET ?? ""
  ).trim();
  if (secret.length < 32) {
    return {
      authorized: false,
      error: "ingress_secret_missing_or_weak",
      status: 503,
      retryable: true,
    };
  }
  if (args.request.method.toUpperCase() !== "POST") {
    return {
      authorized: false,
      error: "ingress_method_invalid",
      status: 400,
      retryable: false,
    };
  }

  const issuedAt =
    args.request.headers.get(TRUSTED_PROVIDER_INGRESS_HEADERS.issuedAt)?.trim() ??
    "";
  const issuedAtMs = Date.parse(issuedAt);
  if (
    !issuedAt ||
    !Number.isFinite(issuedAtMs) ||
    new Date(issuedAtMs).toISOString() !== issuedAt
  ) {
    return {
      authorized: false,
      error: "ingress_timestamp_missing_or_invalid",
      status: 401,
      retryable: false,
    };
  }
  const nowMs = (args.now ?? new Date()).getTime();
  if (issuedAtMs > nowMs + MAX_FUTURE_SKEW_MS) {
    return {
      authorized: false,
      error: "ingress_timestamp_not_yet_valid",
      status: 401,
      retryable: false,
    };
  }
  if (nowMs - issuedAtMs > MAX_PAST_AGE_MS) {
    return {
      authorized: false,
      error: "ingress_timestamp_expired",
      status: 401,
      retryable: false,
    };
  }

  const nonce =
    args.request.headers.get(TRUSTED_PROVIDER_INGRESS_HEADERS.nonce)?.trim() ??
    "";
  if (!NONCE_PATTERN.test(nonce)) {
    return {
      authorized: false,
      error: "ingress_nonce_invalid",
      status: 401,
      retryable: false,
    };
  }
  const providedSignature = (
    args.request.headers.get(TRUSTED_PROVIDER_INGRESS_HEADERS.signature) ?? ""
  )
    .trim()
    .toLowerCase()
    .replace(/^sha256=/, "");
  const pathname = new URL(args.request.url).pathname;
  const signed = createTrustedProviderIngressSignature({
    secret,
    method: args.request.method,
    pathname,
    issuedAt,
    nonce,
    rawBody: args.rawBody,
  });
  if (!signaturesMatch(providedSignature, signed.signature)) {
    return {
      authorized: false,
      error: "ingress_signature_invalid",
      status: 401,
      retryable: false,
    };
  }

  const nonceHash = `sha256:${sha256(
    `${TRUSTED_PROVIDER_INGRESS_AUTH_VERSION}:${pathname}:${nonce}`,
  )}`;
  const reserve = args.reserveNonce ?? reservePass4395DurableIdempotencyKey;
  const reservation = await reserve({
    keyHash: nonceHash,
    valueHash: `sha256:${signed.bodySha256}`,
    ttlSeconds: 5 * 60,
    receipt: {
      source: TRUSTED_PROVIDER_INGRESS_AUTH_VERSION,
      path: pathname,
      issuedAt,
      bodySha256: `sha256:${signed.bodySha256}`,
    },
  });
  if (!reservation.ok) {
    return reservation.duplicate
      ? {
          authorized: false,
          error: "ingress_nonce_replayed",
          status: 409,
          retryable: false,
        }
      : {
          authorized: false,
          error: "ingress_nonce_store_unavailable",
          status: 503,
          retryable: true,
        };
  }

  return {
    authorized: true,
    bodySha256: `sha256:${signed.bodySha256}`,
    nonceHash,
    issuedAt,
    replayProtection: {
      storageMode: reservation.storageMode,
      durable: reservation.durable,
      failClosed: reservation.failClosed,
    },
  };
}
