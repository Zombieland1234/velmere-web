import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { buildSecurityCookie, decodeStrictSignedCookieJson, readUniqueSecurityCookie } from "@/lib/security/cookie-session-boundary";

export const VELMERE_SUPABASE_FLOW_COOKIE = "velmere_supabase_flow" as const;
const FLOW_TTL_SECONDS = 10 * 60;
const MAX_COOKIE_BYTES = 12 * 1024;

export type SupabaseAuthFlowIntent = "google_oauth" | "password_recovery" | "email_confirmation" | "email_change";
export type SupabaseAuthFlowState = {
  schemaVersion: "velmere.supabase-auth-flow.v1";
  nonce: string;
  intent: SupabaseAuthFlowIntent;
  locale: "en" | "pl" | "de";
  returnPath: string;
  expectedIdentityFingerprint?: string;
  storage: Record<string, string>;
  issuedAt: number;
  expiresAt: number;
};

function productionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function flowSecrets() {
  const current = process.env.VELMERE_AUTH_FLOW_SECRET_CURRENT?.trim()
    || process.env.VELMERE_AUTH_FLOW_SECRET?.trim()
    || process.env.VELMERE_ACCOUNT_SESSION_SECRET_CURRENT?.trim()
    || process.env.VELMERE_ACCOUNT_SESSION_SECRET?.trim()
    || (!productionLike() ? "velmere-local-auth-flow-secret-not-for-production-2026" : "");
  const previous = process.env.VELMERE_AUTH_FLOW_SECRET_PREVIOUS?.trim() || "";
  return [current, previous].filter((value) => value.length >= 32);
}

function sign(body: string, secret: string) {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizeExpectedEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) && email.length <= 180 ? email : null;
}

function expectedIdentityFingerprint(email: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`velmere:email-confirmation-identity:v1:${email}`, "utf8")
    .digest("hex");
}

export function createSupabaseAuthFlowState(input: {
  intent: SupabaseAuthFlowIntent;
  locale?: string;
  returnPath?: string;
  storage?: Record<string, string>;
  expectedEmail?: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const locale = input.locale === "pl" || input.locale === "de" ? input.locale : "en";
  const allowedReturn = new Set([`/${locale}/account`, `/${locale}/login`, `/${locale}/login?recovery=1`]);
  const returnPath = allowedReturn.has(input.returnPath ?? "") ? input.returnPath! : input.intent === "password_recovery" ? `/${locale}/login?recovery=1` : `/${locale}/account`;
  let identityFingerprint: string | undefined;
  if (input.intent === "email_confirmation") {
    const email = normalizeExpectedEmail(input.expectedEmail);
    const secret = flowSecrets()[0];
    if (!email) throw new Error("auth_flow_expected_identity_invalid");
    if (!secret) throw new Error("auth_flow_secret_unavailable");
    identityFingerprint = expectedIdentityFingerprint(email, secret);
  }
  return {
    schemaVersion: "velmere.supabase-auth-flow.v1",
    nonce: randomBytes(24).toString("base64url"),
    intent: input.intent,
    locale,
    returnPath,
    ...(identityFingerprint ? { expectedIdentityFingerprint: identityFingerprint } : {}),
    storage: Object.fromEntries(Object.entries(input.storage ?? {}).filter(([key, value]) => key.length <= 240 && value.length <= 4096).slice(0, 6)),
    issuedAt: now,
    expiresAt: now + FLOW_TTL_SECONDS,
  } satisfies SupabaseAuthFlowState;
}

export function matchesSupabaseAuthFlowExpectedIdentity(state: SupabaseAuthFlowState, email: string | undefined) {
  if (state.intent !== "email_confirmation" || !/^[a-f0-9]{64}$/u.test(state.expectedIdentityFingerprint ?? "")) return false;
  const normalized = normalizeExpectedEmail(email);
  if (!normalized) return false;
  return flowSecrets().some((secret) => safeEqual(
    expectedIdentityFingerprint(normalized, secret),
    state.expectedIdentityFingerprint!,
  ));
}

export function buildSupabaseAuthFlowCookie(state: SupabaseAuthFlowState) {
  const secret = flowSecrets()[0];
  if (!secret) throw new Error("auth_flow_secret_unavailable");
  const body = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  const value = `${body}.${sign(body, secret)}`;
  if (Buffer.byteLength(value, "utf8") > MAX_COOKIE_BYTES) throw new Error("auth_flow_cookie_too_large");
  return buildSecurityCookie({ profile: "auth_flow", value, maxAge: FLOW_TTL_SECONDS });
}

export function buildClearedSupabaseAuthFlowCookie() {
  return buildSecurityCookie({ profile: "auth_flow", value: "", maxAge: 0, clear: true });
}

export function readSupabaseAuthFlowState(request: Request) {
  const value = readUniqueSecurityCookie(request, "auth_flow");
  if (!value || value.length > MAX_COOKIE_BYTES) return null;
  const [body, signature] = value.split(".");
  if (!body || !/^[A-Za-z0-9_-]{43}$/u.test(signature) || !flowSecrets().some((secret) => safeEqual(sign(body, secret), signature))) return null;
  try {
    const parsed = decodeStrictSignedCookieJson<Partial<SupabaseAuthFlowState>>({
      encodedPayload: body,
      maxDecodedBytes: 10 * 1024,
      maxDepth: 6,
      maxNodes: 64,
    });
    const now = Math.floor(Date.now() / 1000);
    if (parsed.schemaVersion !== "velmere.supabase-auth-flow.v1" || typeof parsed.nonce !== "string" || !/^[A-Za-z0-9_-]{32}$/u.test(parsed.nonce)) return null;
    if (typeof parsed.issuedAt !== "number" || typeof parsed.expiresAt !== "number") return null;
    if (!Number.isInteger(parsed.issuedAt) || parsed.issuedAt > now || parsed.issuedAt < now - FLOW_TTL_SECONDS) return null;
    if (!Number.isInteger(parsed.expiresAt) || parsed.expiresAt <= now || parsed.expiresAt - parsed.issuedAt !== FLOW_TTL_SECONDS) return null;
    if (parsed.intent !== "google_oauth" && parsed.intent !== "password_recovery" && parsed.intent !== "email_confirmation" && parsed.intent !== "email_change") return null;
    if (parsed.locale !== "en" && parsed.locale !== "pl" && parsed.locale !== "de") return null;
    const allowedReturn = new Set([`/${parsed.locale}/account`, `/${parsed.locale}/login`, `/${parsed.locale}/login?recovery=1`]);
    if (typeof parsed.returnPath !== "string" || !allowedReturn.has(parsed.returnPath)) return null;
    if (parsed.intent === "email_confirmation") {
      if (typeof parsed.expectedIdentityFingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(parsed.expectedIdentityFingerprint)) return null;
    } else if (parsed.expectedIdentityFingerprint !== undefined) return null;
    if (!parsed.storage || typeof parsed.storage !== "object" || Array.isArray(parsed.storage)) return null;
    const entries = Object.entries(parsed.storage);
    if (entries.length > 6 || entries.some(([key, value]) => key.length > 240 || typeof value !== "string" || value.length > 4096)) return null;
    return parsed as SupabaseAuthFlowState;
  } catch { return null; }
}
