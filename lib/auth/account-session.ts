import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { inspectAuthSecretSeparation } from "@/lib/security/auth-secret-separation";
import { inspectTrustedAccountHeaderReadiness, resolveTrustedAccountHeader } from "@/lib/security/trusted-account-header-boundary";
import { buildSecurityCookie, decodeStrictSignedCookieJson, readUniqueSecurityCookie } from "@/lib/security/cookie-session-boundary";
import {
  matchesAuthSessionFamilySubject,
  readAuthSessionFamily,
  verifyAuthSessionFamily,
  type AuthSessionFamilyState,
  type AuthSessionFamilyVerification,
} from "@/lib/auth/auth-session-family";

export const PASS2363_ACCOUNT_AUTH_SPINE_ID = "pass2363-supabase-auth-google-account-spine" as const;
export const VELMERE_ACCOUNT_COOKIE = "velmere_account_session" as const;

export type VelmereAuthProvider = "email" | "google" | "google_preview" | "preview" | "server";
export type VelmereResolvedAccount = {
  accountId: string;
  displayName: string;
  handle: string;
  email?: string;
  provider: VelmereAuthProvider;
  sessionSource: "cookie" | "header" | "preview" | "server";
};

export type VelmereAccountSessionPayload = {
  accountId: string;
  displayName: string;
  handle: string;
  email?: string;
  provider: VelmereAuthProvider;
  createdAt: string;
  expiresAt: string;
  passId: typeof PASS2363_ACCOUNT_AUTH_SPINE_ID;
  sessionFamily?: AuthSessionFamilyState;
};

export type ResolveRequestAccountDependencies = {
  verifyFamily: (state: AuthSessionFamilyState) => Promise<AuthSessionFamilyVerification>;
};

export const resolveRequestAccountDependencies: ResolveRequestAccountDependencies = {
  verifyFamily: verifyAuthSessionFamily,
};

const LOCAL_SESSION_SECRET = "velmere-local-preview-account-session-secret-not-for-production";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isProductionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function sanitizeText(value: unknown, max = 120) {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/[<>\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : undefined;
}

export function normalizeVelmereEmail(value: unknown) {
  const email = sanitizeText(value, 180)?.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined;
  return email;
}

function safeHandle(value: unknown, fallback = "velmere.member") {
  const clean = sanitizeText(value, 64)?.replace(/^@/, "").replace(/[^a-zA-Z0-9._-]/g, ".").replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
  return clean ? `@${clean.slice(0, 32)}` : `@${fallback}`;
}

function displayNameFromEmail(email?: string) {
  if (!email) return "Velmère Member";
  const local = email.split("@")[0] ?? "member";
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .slice(0, 48) || "Velmère Member";
}

export function hashVelmereAccountBinding(accountId: string) {
  const clean = sanitizeText(accountId, 120);
  if (!clean) return "";
  return createHash("sha256").update(`velmere-account-binding-v1:${clean}`, "utf8").digest("hex");
}

export function buildVelmereAccountId(input: { email?: string; provider?: VelmereAuthProvider; seed?: string }) {
  const provider = input.provider ?? (input.email ? "email" : "preview");
  const stable = input.email ?? input.seed ?? "local-member-preview";
  const digest = createHash("sha256").update(`${provider}:${stable}`).digest("hex").slice(0, 18);
  return `${provider}:${digest}`;
}

function accountSessionSecrets() {
  const current = process.env.VELMERE_ACCOUNT_SESSION_SECRET_CURRENT?.trim()
    || process.env.VELMERE_ACCOUNT_SESSION_SECRET?.trim()
    || (!isProductionLike() ? LOCAL_SESSION_SECRET : "");
  const previous = process.env.VELMERE_ACCOUNT_SESSION_SECRET_PREVIOUS?.trim() || "";
  return { current, previous };
}

export function getVelmereAccountSessionReadiness() {
  const { current, previous } = accountSessionSecrets();
  const productionLike = isProductionLike();
  const currentStrong = Buffer.byteLength(current, "utf8") >= 32;
  const trustedHeader = inspectTrustedAccountHeaderReadiness();
  const separation = inspectAuthSecretSeparation();
  return {
    schemaVersion: "velmere-account-session-readiness-v3",
    productionLike,
    ready: currentStrong,
    oauthReady: currentStrong && separation.oauthReady,
    recoveryReady: currentStrong && separation.recoveryReady,
    fullAuthProductionReady: currentStrong && separation.fullProductionReady,
    signedCookies: true,
    expiryEnforced: true,
    keyRotationAvailable: Boolean(previous),
    trustedAccountHeadersEnabled: trustedHeader.configured,
    trustedAccountHeaderRequestBound: true,
    trustedAccountHeaderLegacyBearerAccepted: false,
    previewSessionIssuanceAllowed: !productionLike,
    secretSeparation: separation,
    missing: [
      ...(!currentStrong ? ["VELMERE_ACCOUNT_SESSION_SECRET_CURRENT must contain at least 32 bytes"] : []),
      ...(productionLike && !separation.oauthReady ? ["Purpose-separated account/session-family/auth-flow secrets are required for production OAuth"] : []),
      ...(productionLike && !separation.recoveryReady ? ["A dedicated password-recovery grant secret and durable single-use ledger are required"] : []),
    ],
  } as const;
}

function hmac(value: string, secret: string) {
  return createHmac("sha256", secret).update(value, "utf8").digest("base64url");
}

function safeEqualString(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function encodeSession(payload: VelmereAccountSessionPayload) {
  const { current } = accountSessionSecrets();
  if (current.length < 32) throw new Error("account_session_secret_not_configured");
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `v2.${encodedPayload}.${hmac(`v2.${encodedPayload}`, current)}`;
}

function normalizeDecodedSession(parsed: Partial<VelmereAccountSessionPayload>): VelmereAccountSessionPayload | null {
  if (parsed.passId !== PASS2363_ACCOUNT_AUTH_SPINE_ID || !parsed.accountId || !parsed.displayName || !parsed.handle) return null;
  const createdAt = sanitizeText(parsed.createdAt, 80);
  const expiresAt = sanitizeText(parsed.expiresAt, 80);
  const createdMs = createdAt ? Date.parse(createdAt) : Number.NaN;
  const expiresMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const now = Date.now();
  if (!Number.isFinite(createdMs) || !Number.isFinite(expiresMs)) return null;
  if (createdMs > now + 5 * 60_000 || expiresMs <= now || createdMs >= expiresMs || expiresMs - createdMs > (SESSION_TTL_SECONDS + 300) * 1000) return null;
  const provider = parsed.provider === "email" || parsed.provider === "google" || parsed.provider === "google_preview" || parsed.provider === "preview" || parsed.provider === "server" ? parsed.provider : null;
  if (!provider) return null;
  const accountId = sanitizeText(parsed.accountId, 120);
  const displayName = sanitizeText(parsed.displayName, 80);
  if (!accountId || !displayName) return null;
  let sessionFamily: AuthSessionFamilyState | undefined;
  if (parsed.sessionFamily !== undefined) {
    const family = parsed.sessionFamily as Partial<AuthSessionFamilyState>;
    if (
      family.schemaVersion !== "velmere.auth-session-family.v1"
      || typeof family.familyId !== "string"
      || !UUID.test(family.familyId)
      || !Number.isInteger(family.generation)
      || Number(family.generation) < 1
      || typeof family.subjectFingerprint !== "string"
      || !/^[a-f0-9]{32}$/.test(family.subjectFingerprint)
      || !Number.isInteger(family.expiresAt)
      || Number(family.expiresAt) * 1000 !== expiresMs
    ) return null;
    sessionFamily = {
      schemaVersion: "velmere.auth-session-family.v1",
      familyId: family.familyId,
      generation: Number(family.generation),
      subjectFingerprint: family.subjectFingerprint,
      expiresAt: Number(family.expiresAt),
    };
  }
  return {
    accountId,
    displayName,
    handle: safeHandle(parsed.handle),
    email: normalizeVelmereEmail(parsed.email),
    provider,
    createdAt: new Date(createdMs).toISOString(),
    expiresAt: new Date(expiresMs).toISOString(),
    passId: PASS2363_ACCOUNT_AUTH_SPINE_ID,
    ...(sessionFamily ? { sessionFamily } : {}),
  };
}

export function decodeSession(raw?: string | null): VelmereAccountSessionPayload | null {
  if (!raw || raw.length > 4096) return null;
  const [version, encodedPayload, signature, ...extra] = raw.split(".");
  if (version !== "v2" || !encodedPayload || !/^[A-Za-z0-9_-]{43}$/u.test(signature) || extra.length) return null;
  const { current, previous } = accountSessionSecrets();
  const signedValue = `${version}.${encodedPayload}`;
  const validCurrent = current.length >= 32 && safeEqualString(signature, hmac(signedValue, current));
  const validPrevious = previous.length >= 32 && safeEqualString(signature, hmac(signedValue, previous));
  if (!validCurrent && !validPrevious) return null;
  try {
    const parsed = decodeStrictSignedCookieJson<Partial<VelmereAccountSessionPayload>>({
      encodedPayload,
      maxDecodedBytes: 3072,
      maxDepth: 6,
      maxNodes: 64,
    });
    return normalizeDecodedSession(parsed);
  } catch {
    return null;
  }
}

export function buildVelmereAccountSession(input: { email?: unknown; displayName?: unknown; provider?: unknown; accountId?: unknown; handle?: unknown }): VelmereAccountSessionPayload {
  const provider: VelmereAuthProvider = input.provider === "google" ? "google" : input.provider === "google_preview" ? "google_preview" : input.provider === "email" ? "email" : "preview";
  const email = normalizeVelmereEmail(input.email);
  const explicitAccount = sanitizeText(input.accountId, 120);
  const displayName = sanitizeText(input.displayName, 80) ?? displayNameFromEmail(email) ?? "Velmère Preview Member";
  const handle = safeHandle(input.handle ?? email?.split("@")[0] ?? displayName, "velmere.member");
  const createdAt = new Date();
  return {
    accountId: explicitAccount ?? buildVelmereAccountId({ email, provider, seed: displayName }),
    displayName,
    handle,
    email,
    provider,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + SESSION_TTL_SECONDS * 1000).toISOString(),
    passId: PASS2363_ACCOUNT_AUTH_SPINE_ID,
  };
}

export function bindVelmereAccountSessionToFamily(
  account: VelmereAccountSessionPayload,
  state: AuthSessionFamilyState,
  subject: string,
): VelmereAccountSessionPayload {
  if (account.accountId !== `supabase:${subject}` || !matchesAuthSessionFamilySubject(subject, state.subjectFingerprint)) {
    throw new Error("account_session_family_subject_mismatch");
  }
  const familyExpiresAt = new Date(state.expiresAt * 1000);
  if (!Number.isInteger(state.expiresAt) || familyExpiresAt.getTime() <= Date.now()) {
    throw new Error("account_session_family_expired");
  }
  return {
    ...account,
    expiresAt: familyExpiresAt.toISOString(),
    sessionFamily: { ...state },
  };
}

export function buildVelmereAccountCookie(payload: VelmereAccountSessionPayload, options?: { clear?: boolean }) {
  if (options?.clear) return buildClearedVelmereAccountCookie();
  return buildSecurityCookie({
    profile: "account_session",
    value: encodeSession(payload),
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function buildClearedVelmereAccountCookie() {
  return buildSecurityCookie({ profile: "account_session", value: "", maxAge: 0, clear: true });
}

function resolvedCookieAccount(cookieSession: VelmereAccountSessionPayload): VelmereResolvedAccount {
  return {
    accountId: cookieSession.accountId,
    displayName: cookieSession.displayName,
    handle: cookieSession.handle,
    email: cookieSession.email,
    provider: cookieSession.provider,
    sessionSource: "cookie",
  };
}

function exactFamilyState(left: AuthSessionFamilyState, right: AuthSessionFamilyState) {
  return left.schemaVersion === right.schemaVersion
    && left.familyId === right.familyId
    && left.subjectFingerprint === right.subjectFingerprint
    && left.generation === right.generation
    && left.expiresAt === right.expiresAt;
}

export async function resolveRequestAccount(
  request: Request,
  dependencies: ResolveRequestAccountDependencies = resolveRequestAccountDependencies,
): Promise<VelmereResolvedAccount | null> {
  const trustedHeader = await resolveTrustedAccountHeader(request);
  if (trustedHeader) return trustedHeader;

  const cookieSession = decodeSession(readUniqueSecurityCookie(request, "account_session"));
  if (cookieSession) {
    if (!cookieSession.sessionFamily) {
      if (!isProductionLike() && (cookieSession.provider === "preview" || cookieSession.provider === "google_preview")) {
        return resolvedCookieAccount(cookieSession);
      }
      return null;
    }
    const subject = cookieSession.accountId.startsWith("supabase:") ? cookieSession.accountId.slice("supabase:".length) : "";
    if (!UUID.test(subject) || !matchesAuthSessionFamilySubject(subject, cookieSession.sessionFamily.subjectFingerprint)) return null;
    const requestFamily = readAuthSessionFamily(request);
    if (!requestFamily || !exactFamilyState(cookieSession.sessionFamily, requestFamily)) return null;
    try {
      const verified = await dependencies.verifyFamily(requestFamily);
      if (
        verified.status !== "active"
        || verified.familyId !== requestFamily.familyId
        || verified.subjectFingerprint !== requestFamily.subjectFingerprint
        || verified.generation !== requestFamily.generation
        || verified.expiresAt !== requestFamily.expiresAt
      ) return null;
      return resolvedCookieAccount(cookieSession);
    } catch {
      return null;
    }
  }


  return null;
}

export function accountPublicPayload(account: VelmereResolvedAccount | VelmereAccountSessionPayload) {
  return {
    accountId: account.accountId,
    displayName: account.displayName,
    handle: account.handle,
    email: account.email,
    provider: account.provider,
    passId: PASS2363_ACCOUNT_AUTH_SPINE_ID,
  };
}

export function googleAuthRuntimeStatus() {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasGoogle = Boolean((process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) || hasSupabase);
  const sessionReadiness = getVelmereAccountSessionReadiness();
  return {
    supabaseConfigured: hasSupabase,
    googleOAuthConfigured: hasGoogle,
    signedSessionConfigured: sessionReadiness.ready,
    mode: hasSupabase ? ("ready_for_real_oauth" as const) : ("preview_skeleton" as const),
    boundary: "Velmere verified Google OAuth bridge.",
  } as const;
}
