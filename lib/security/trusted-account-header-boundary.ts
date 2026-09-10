import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { reservePass4395DurableIdempotencyKey } from "@/lib/security/durable-idempotency-store";
import { hasForbiddenAsciiControlCharacter } from "@/lib/security/ascii-control-characters";

export const PASS36_A89_TRUSTED_ACCOUNT_HEADER_BOUNDARY_ID = "velmere.pass36.a89.trusted-account-header-boundary.v2" as const;
const CLOCK_SKEW_SECONDS = 30;
const NONCE_WINDOW_MS = 2 * 60_000;
const MAX_TRUSTED_BODY_BYTES = 4 * 1024 * 1024;
const BASE64URL_32 = /^[A-Za-z0-9_-]{32}$/u;
const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const ACCOUNT_ID = /^[a-z][a-z0-9_-]{1,31}:[A-Za-z0-9._-]{1,96}$/u;
const UNICODE_SPOOFING = /\p{Default_Ignorable_Code_Point}/u;
const SAFE_TEXT = {
  test(value: string) {
    const codePointLength = Array.from(value).length;
    return codePointLength >= 1
      && codePointLength <= 120
      && !hasForbiddenAsciiControlCharacter(value)
      && !UNICODE_SPOOFING.test(value);
  },
};

export type TrustedHeaderResolvedAccount = {
  accountId: string;
  displayName: string;
  handle: string;
  email?: string;
  provider: "email" | "google_preview" | "server";
  sessionSource: "header";
};

export type TrustedAccountHeaderDependencies = {
  now: () => number;
  consumeNonce: (key: string) => Promise<boolean>;
};

export const trustedAccountHeaderDependencies: TrustedAccountHeaderDependencies = {
  now: Date.now,
  consumeNonce: async (key) => {
    const keyHash = createHash("sha256").update(`trusted-account-nonce-v2\0${key}`).digest("hex");
    const decision = await reservePass4395DurableIdempotencyKey({
      keyHash: `trusted-account-nonce:${keyHash}`,
      valueHash: keyHash,
      ttlSeconds: Math.ceil(NONCE_WINDOW_MS / 1_000),
      receipt: {
        schemaVersion: "velmere.trusted-account-single-use-nonce.v2",
        purpose: "trusted_account_header_replay_prevention",
      },
    });
    return decision.ok;
  },
};

function secrets(env: NodeJS.ProcessEnv) {
  const current = env.VELMERE_TRUSTED_ACCOUNT_HEADER_HMAC_SECRET_CURRENT?.trim() ?? "";
  const previous = env.VELMERE_TRUSTED_ACCOUNT_HEADER_HMAC_SECRET_PREVIOUS?.trim() ?? "";
  return [current, previous].filter((value) => Buffer.byteLength(value, "utf8") >= 32);
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function singleHeader(request: Request, name: string) {
  const value = request.headers.get(name)?.trim() ?? "";
  return value && !value.includes(",") && SAFE_TEXT.test(value) ? value : null;
}

function sha256(value: string | Buffer | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedContentType(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/gu, " ");
}

function canonicalQuery(url: URL) {
  return [...url.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyOrder = leftKey.localeCompare(rightKey);
      return keyOrder || leftValue.localeCompare(rightValue);
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function canonical(input: {
  version: string;
  method: string;
  pathname: string;
  canonicalQuery: string;
  contentType: string;
  bodySha256: string;
  timestamp: string;
  nonce: string;
  accountId: string;
  email: string;
  displayName: string;
  handle: string;
  provider: string;
}) {
  return [
    PASS36_A89_TRUSTED_ACCOUNT_HEADER_BOUNDARY_ID,
    input.version,
    input.method.toUpperCase(),
    input.pathname,
    input.canonicalQuery,
    input.contentType,
    input.bodySha256,
    input.timestamp,
    input.nonce,
    input.accountId,
    input.email,
    input.displayName,
    input.handle,
    input.provider,
  ].join("\n");
}

export function signTrustedAccountHeaders(input: {
  requestUrl: string;
  method: string;
  timestamp: number;
  nonce: string;
  accountId: string;
  email?: string;
  displayName?: string;
  handle?: string;
  provider?: "email" | "google_preview" | "server";
  contentType?: string;
  body?: string | Buffer | Uint8Array;
  secret: string;
}) {
  const url = new URL(input.requestUrl);
  const fields = {
    version: "v2",
    method: input.method,
    pathname: url.pathname,
    canonicalQuery: canonicalQuery(url),
    contentType: normalizedContentType(input.contentType),
    bodySha256: sha256(input.body ?? Buffer.alloc(0)),
    timestamp: String(input.timestamp),
    nonce: input.nonce,
    accountId: input.accountId,
    email: input.email ?? "",
    displayName: input.displayName ?? "",
    handle: input.handle ?? "",
    provider: input.provider ?? "server",
  };
  const signature = createHmac("sha256", input.secret).update(canonical(fields), "utf8").digest("base64url");
  return {
    "x-velmere-account-id": fields.accountId,
    "x-velmere-account-email": fields.email,
    "x-velmere-account-name": fields.displayName,
    "x-velmere-account-handle": fields.handle,
    "x-velmere-account-provider": fields.provider,
    "x-velmere-account-auth-version": fields.version,
    "x-velmere-account-content-type": fields.contentType,
    "x-velmere-account-body-sha256": fields.bodySha256,
    "x-velmere-account-auth-timestamp": fields.timestamp,
    "x-velmere-account-auth-nonce": fields.nonce,
    "x-velmere-account-auth": signature,
  } as const;
}

export async function resolveTrustedAccountHeader(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
  dependencies: TrustedAccountHeaderDependencies = trustedAccountHeaderDependencies,
): Promise<TrustedHeaderResolvedAccount | null> {
  const signature = singleHeader(request, "x-velmere-account-auth");
  const accountId = singleHeader(request, "x-velmere-account-id");
  const timestamp = singleHeader(request, "x-velmere-account-auth-timestamp");
  const nonce = singleHeader(request, "x-velmere-account-auth-nonce");
  const version = singleHeader(request, "x-velmere-account-auth-version");
  const signedContentType = request.headers.get("x-velmere-account-content-type")?.trim().toLowerCase() ?? "";
  const signedBodySha256 = singleHeader(request, "x-velmere-account-body-sha256");
  const candidate = signature || accountId || timestamp || nonce || version || signedBodySha256;
  if (!candidate) return null;
  if (
    !signature
    || !accountId
    || !timestamp
    || !nonce
    || version !== "v2"
    || !signedBodySha256
    || !BASE64URL_43.test(signature)
    || !BASE64URL_32.test(nonce)
    || !SHA256.test(signedBodySha256)
    || !ACCOUNT_ID.test(accountId)
  ) return null;
  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor(dependencies.now() / 1000);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > CLOCK_SKEW_SECONDS) return null;
  const email = singleHeader(request, "x-velmere-account-email") ?? "";
  const displayName = singleHeader(request, "x-velmere-account-name") ?? "Velmère Service Account";
  const handleRaw = singleHeader(request, "x-velmere-account-handle") ?? "@velmere.service";
  const providerRaw = singleHeader(request, "x-velmere-account-provider") ?? "server";
  const provider = providerRaw === "email" || providerRaw === "google_preview" ? providerRaw : providerRaw === "server" ? "server" : null;
  const normalizedEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) && email.length <= 180 ? email.toLowerCase() : undefined;
  if (!provider || (email && !normalizedEmail)) return null;
  const actualContentType = normalizedContentType(request.headers.get("content-type"));
  if (signedContentType !== actualContentType) return null;
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (
    !Number.isFinite(declaredLength)
    || declaredLength < 0
    || declaredLength > MAX_TRUSTED_BODY_BYTES
  ) return null;
  let bodyBytes: Buffer;
  try {
    bodyBytes = Buffer.from(await request.clone().arrayBuffer());
  } catch {
    return null;
  }
  if (bodyBytes.byteLength > MAX_TRUSTED_BODY_BYTES || sha256(bodyBytes) !== signedBodySha256) return null;
  const requestUrl = new URL(request.url);
  const payload = canonical({
    version,
    method: request.method,
    pathname: requestUrl.pathname,
    canonicalQuery: canonicalQuery(requestUrl),
    contentType: actualContentType,
    bodySha256: signedBodySha256,
    timestamp,
    nonce,
    accountId,
    email,
    displayName,
    handle: handleRaw,
    provider,
  });
  const valid = secrets(env).some((secret) => safeEqual(signature, createHmac("sha256", secret).update(payload, "utf8").digest("base64url")));
  if (!valid) return null;
  const consumed = await dependencies.consumeNonce(`${accountId}:${nonce}`);
  if (!consumed) return null;
  const handle = `@${handleRaw.replace(/^@/u, "").replace(/[^A-Za-z0-9._-]/gu, ".").replace(/\.+/gu, ".").slice(0, 32) || "velmere.service"}`;
  return {
    accountId,
    displayName: displayName.slice(0, 80),
    handle,
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    provider,
    sessionSource: "header",
  };
}

export function inspectTrustedAccountHeaderReadiness(env: NodeJS.ProcessEnv = process.env) {
  const configuredSecrets = secrets(env);
  return {
    schemaVersion: PASS36_A89_TRUSTED_ACCOUNT_HEADER_BOUNDARY_ID,
    configured: configuredSecrets.length > 0,
    currentConfigured: Buffer.byteLength(env.VELMERE_TRUSTED_ACCOUNT_HEADER_HMAC_SECRET_CURRENT?.trim() ?? "", "utf8") >= 32,
    previousConfigured: Buffer.byteLength(env.VELMERE_TRUSTED_ACCOUNT_HEADER_HMAC_SECRET_PREVIOUS?.trim() ?? "", "utf8") >= 32,
    legacyStaticBearerConfigured: Buffer.byteLength(env.VELMERE_TRUSTED_ACCOUNT_HEADER_SECRET?.trim() ?? "", "utf8") >= 32,
    legacyStaticBearerAccepted: false,
    requestBinding: ["version", "method", "pathname", "canonicalQuery", "contentType", "bodySha256", "timestamp", "nonce", "accountId", "email", "displayName", "handle", "provider"],
    maxClockSkewSeconds: CLOCK_SKEW_SECONDS,
    durableNonceConsumptionRequiredInProduction: true,
    bodyBudgetBytes: MAX_TRUSTED_BODY_BYTES,
    nonceStorage: "atomic durable idempotency reservation with TTL; no fixed-window replay boundary",
    boundary: "Trusted account headers use a versioned request-bound HMAC-SHA-256 over method, path, canonical query, content type and exact body digest plus a short timestamp and atomic one-time durable nonce. The historical static bearer header is never accepted.",
  } as const;
}
