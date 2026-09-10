import { createHash, randomUUID } from "node:crypto";
import { createClient, type AuthSession, type AuthUser } from "@supabase/supabase-js";
import { bindVelmereAccountToSupabaseSubject } from "@/lib/account/supabase-subject-binding";
import {
  bindVelmereAccountSessionToFamily,
  buildVelmereAccountSession,
  type VelmereAccountSessionPayload,
} from "@/lib/auth/account-session";
import {
  buildSupabaseAuthCookieHeaders,
  readSupabaseAccessTokenCookie,
  readSupabaseRefreshTokenCookie,
} from "@/lib/auth/supabase-auth-cookies";
import {
  AuthSessionFamilyError,
  hasAuthSessionFamilyCookie,
  issueAuthSessionFamily,
  matchesAuthSessionFamilySubject,
  readAuthSessionFamily,
  revokeAllAuthSessionFamilies,
  rotateAuthSessionFamily,
  revokeAuthSessionFamily,
  revokeAuthSessionSubject,
} from "@/lib/auth/auth-session-family";

export type SupabaseAuthSessionErrorCode =
  | "auth_config_unavailable"
  | "invalid_credentials"
  | "signup_rejected"
  | "email_confirmation_required"
  | "refresh_token_missing"
  | "refresh_rejected"
  | "access_token_missing"
  | "access_token_rejected"
  | "identity_binding_conflict"
  | "identity_binding_unavailable"
  | "session_family_reuse"
  | "session_family_unavailable";

export class SupabaseAuthSessionError extends Error {
  readonly code: SupabaseAuthSessionErrorCode;
  readonly httpStatus: 202 | 401 | 409 | 503;
  readonly retryable: boolean;

  constructor(code: SupabaseAuthSessionErrorCode) {
    super(`supabase_auth_session:${code}`);
    this.name = "SupabaseAuthSessionError";
    this.code = code;
    this.httpStatus = code === "email_confirmation_required"
      ? 202
      : code === "invalid_credentials" || code === "refresh_token_missing" || code === "refresh_rejected" || code === "access_token_missing" || code === "access_token_rejected" || code === "session_family_reuse"
        ? 401
        : code === "identity_binding_conflict"
          ? 409
          : 503;
    this.retryable = this.httpStatus === 503;
  }
}

type AuthResult<T> = Promise<{ data: T; error: { status?: number; code?: string } | null }>;

type AuthClientLike = {
  auth: {
    signInWithPassword(input: { email: string; password: string }): AuthResult<{ user: AuthUser | null; session: AuthSession | null }>;
    signUp(input: { email: string; password: string; options?: { data?: Record<string, unknown> } }): AuthResult<{ user: AuthUser | null; session: AuthSession | null }>;
    refreshSession(input: { refresh_token: string }): AuthResult<{ user: AuthUser | null; session: AuthSession | null }>;
    getUser(accessToken: string): AuthResult<{ user: AuthUser | null }>;
    setSession(input: { access_token: string; refresh_token: string }): AuthResult<{ user: AuthUser | null; session: AuthSession | null }>;
    signOut(input?: { scope?: "global" | "local" | "others" }): Promise<{ error: { status?: number; code?: string } | null }>;
  };
};

export type SupabaseAuthSessionDependencies = {
  createAuthClient: () => AuthClientLike | null;
  bindSubject: typeof bindVelmereAccountToSupabaseSubject;
  requestId: () => string;
  issueFamily?: typeof issueAuthSessionFamily;
  rotateFamily?: typeof rotateAuthSessionFamily;
  revokeFamily?: typeof revokeAuthSessionFamily;
  revokeAllFamilies?: typeof revokeAllAuthSessionFamilies;
  revokeSubject?: typeof revokeAuthSessionSubject;
};

function defaultCreateAuthClient(): AuthClientLike | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) as unknown as AuthClientLike;
}

export const supabaseAuthSessionDependencies: SupabaseAuthSessionDependencies = {
  createAuthClient: defaultCreateAuthClient,
  bindSubject: bindVelmereAccountToSupabaseSubject,
  requestId: () => `auth_bind_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
  issueFamily: issueAuthSessionFamily,
  rotateFamily: rotateAuthSessionFamily,
  revokeFamily: revokeAuthSessionFamily,
  revokeAllFamilies: revokeAllAuthSessionFamilies,
  revokeSubject: revokeAuthSessionSubject,
};

function operatorFingerprint(subject: string) {
  return `operator_${createHash("sha256").update(`auth-self-bind:${subject}`).digest("hex").slice(0, 20)}`;
}

function normalizeVerifiedEmail(user: AuthUser) {
  const email = user.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined;
  const confirmedAt = typeof user.email_confirmed_at === "string" ? user.email_confirmed_at.trim() : "";
  const confirmedMs = confirmedAt ? Date.parse(confirmedAt) : Number.NaN;
  if (!Number.isFinite(confirmedMs) || confirmedMs > Date.now() + 5 * 60_000) return undefined;
  return email;
}

function requireVerifiedEmail(user: AuthUser) {
  const email = normalizeVerifiedEmail(user);
  if (!email) throw new SupabaseAuthSessionError("email_confirmation_required");
  return email;
}

function authSessionPayload(user: AuthUser, displayName?: string, handle?: string) {
  const email = normalizeVerifiedEmail(user);
  const fallbackName = typeof user.user_metadata?.display_name === "string"
    ? user.user_metadata.display_name
    : typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : displayName;
  const isGoogle = user.app_metadata?.provider === "google"
    || (Array.isArray(user.app_metadata?.providers) && (user.app_metadata.providers as unknown[]).includes("google"));
  return buildVelmereAccountSession({
    accountId: `supabase:${user.id}`,
    email,
    displayName: fallbackName,
    handle,
    provider: isGoogle ? "google" : "email",
  });
}

async function bindVerifiedIdentity(
  user: AuthUser,
  account: VelmereAccountSessionPayload,
  dependencies: SupabaseAuthSessionDependencies,
) {
  try {
    const result = await dependencies.bindSubject({
      accountId: account.accountId,
      supabaseSubject: user.id,
      requestId: dependencies.requestId(),
      operatorFingerprint: operatorFingerprint(user.id),
    });
    if (result.status === "conflict") throw new SupabaseAuthSessionError("identity_binding_conflict");
    if (result.status === "not_found") throw new SupabaseAuthSessionError("identity_binding_unavailable");
    return result.status;
  } catch (error) {
    if (error instanceof SupabaseAuthSessionError) throw error;
    throw new SupabaseAuthSessionError("identity_binding_unavailable");
  }
}


export async function finalizeVerifiedSupabaseSession(
  user: AuthUser,
  session: AuthSession,
  displayName?: string,
  handle?: string,
  dependencies: SupabaseAuthSessionDependencies = supabaseAuthSessionDependencies,
  options: { issueSessionFamily?: boolean } = {},
) {
  if (!session.access_token || !session.refresh_token) throw new SupabaseAuthSessionError("access_token_rejected");
  requireVerifiedEmail(user);
  let account = authSessionPayload(user, displayName, handle);
  const bindingStatus = await bindVerifiedIdentity(user, account, dependencies);
  let familyCookie: string | null = null;
  if (options.issueSessionFamily !== false) {
    if (!dependencies.issueFamily) throw new SupabaseAuthSessionError("session_family_unavailable");
    try {
      const family = await dependencies.issueFamily(user.id);
      account = bindVelmereAccountSessionToFamily(account, family.state, user.id);
      familyCookie = family.cookie;
    }
    catch { throw new SupabaseAuthSessionError("session_family_unavailable"); }
  }
  return {
    schemaVersion: "velmere.supabase-auth-session.v1" as const,
    account,
    user: { id: user.id, email: normalizeVerifiedEmail(user) },
    bindingStatus,
    cookieHeaders: buildSupabaseAuthCookieHeaders(session),
    familyCookie,
    sessionExpiresIn: Math.max(60, Math.min(session.expires_in ?? 3600, 3600)),
  };
}

function requireClient(dependencies: SupabaseAuthSessionDependencies) {
  const client = dependencies.createAuthClient();
  if (!client) throw new SupabaseAuthSessionError("auth_config_unavailable");
  return client;
}

function requireSession(data: { user: AuthUser | null; session: AuthSession | null }, code: SupabaseAuthSessionErrorCode) {
  if (!data.user || !data.session?.access_token || !data.session.refresh_token) {
    throw new SupabaseAuthSessionError(code);
  }
  return { user: data.user, session: data.session };
}

export async function establishSupabasePasswordSession(
  input: { mode: "signin" | "create"; email: string; password: string; displayName?: string; handle?: string },
  dependencies: SupabaseAuthSessionDependencies = supabaseAuthSessionDependencies,
) {
  const client = requireClient(dependencies);
  const result = input.mode === "create"
    ? await client.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { display_name: input.displayName?.slice(0, 80) } },
      })
    : await client.auth.signInWithPassword({ email: input.email, password: input.password });

  if (result.error) {
    throw new SupabaseAuthSessionError(input.mode === "create" ? "signup_rejected" : "invalid_credentials");
  }
  if (input.mode === "create" && result.data.user && !result.data.session) {
    throw new SupabaseAuthSessionError("email_confirmation_required");
  }
  const { user, session } = requireSession(result.data, input.mode === "create" ? "signup_rejected" : "invalid_credentials");
  return finalizeVerifiedSupabaseSession(user, session, input.displayName, input.handle, dependencies);
}

export async function refreshSupabaseCookieSession(
  request: Request,
  dependencies: SupabaseAuthSessionDependencies = supabaseAuthSessionDependencies,
) {
  const refreshToken = readSupabaseRefreshTokenCookie(request);
  if (!refreshToken) throw new SupabaseAuthSessionError("refresh_token_missing");
  const existingFamily = hasAuthSessionFamilyCookie(request)
    ? readAuthSessionFamily(request)
    : null;
  if (!existingFamily) throw new SupabaseAuthSessionError("session_family_reuse");
  const rotateFamily = dependencies.rotateFamily;
  if (!rotateFamily) throw new SupabaseAuthSessionError("session_family_unavailable");
  const client = requireClient(dependencies);
  const result = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (result.error) throw new SupabaseAuthSessionError("refresh_rejected");
  const { user, session } = requireSession(result.data, "refresh_rejected");
  requireVerifiedEmail(user);
  if (!matchesAuthSessionFamilySubject(user.id, existingFamily.subjectFingerprint)) {
    await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }).catch(() => ({ data: { user: null, session: null }, error: null }));
    await client.auth.signOut({ scope: "global" }).catch(() => ({ error: null }));
    throw new SupabaseAuthSessionError("session_family_reuse");
  }
  let family: Awaited<ReturnType<typeof rotateFamily>>;
  try {
    family = await rotateFamily(request);
  } catch (error) {
    if (error instanceof AuthSessionFamilyError && (error.code === "family_reuse_detected" || error.code === "family_cookie_invalid" || error.code === "family_revoked")) {
      await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }).catch(() => ({ data: { user: null, session: null }, error: null }));
      await client.auth.signOut({ scope: "global" }).catch(() => ({ error: null }));
      throw new SupabaseAuthSessionError("session_family_reuse");
    }
    throw new SupabaseAuthSessionError("session_family_unavailable");
  }
  const finalized = await finalizeVerifiedSupabaseSession(user, session, undefined, undefined, dependencies, { issueSessionFamily: false });
  const account = bindVelmereAccountSessionToFamily(finalized.account, family.state, user.id);
  return { ...finalized, account, familyCookie: family.cookie, sessionFamilyState: family.status };
}

export async function inspectSupabaseCookieSession(
  request: Request,
  dependencies: SupabaseAuthSessionDependencies = supabaseAuthSessionDependencies,
) {
  const accessToken = readSupabaseAccessTokenCookie(request);
  if (!accessToken) throw new SupabaseAuthSessionError("access_token_missing");
  const client = requireClient(dependencies);
  const result = await client.auth.getUser(accessToken);
  if (result.error || !result.data.user) throw new SupabaseAuthSessionError("access_token_rejected");
  const email = requireVerifiedEmail(result.data.user);
  return {
    schemaVersion: "velmere.supabase-auth-inspection.v1" as const,
    user: result.data.user,
    email,
  };
}

export async function revokeSupabaseCookieSession(
  request: Request,
  dependencies: SupabaseAuthSessionDependencies = supabaseAuthSessionDependencies,
) {
  const accessToken = readSupabaseAccessTokenCookie(request);
  const refreshToken = readSupabaseRefreshTokenCookie(request);
  if (!accessToken || !refreshToken) {
    const local = dependencies.revokeAllFamilies
      ? await dependencies.revokeAllFamilies(request, "global_logout")
      : { status: "missing" as const, revokedCount: 0 };
    return { providerRevoked: false, localRevoked: local.status === "revoked", reason: "cookies_missing" as const };
  }
  const client = dependencies.createAuthClient();
  if (!client) {
    const local = dependencies.revokeAllFamilies
      ? await dependencies.revokeAllFamilies(request, "global_logout")
      : { status: "missing" as const, revokedCount: 0 };
    return { providerRevoked: false, localRevoked: local.status === "revoked", reason: "config_missing" as const };
  }
  const setResult = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (setResult.error) {
    const local = dependencies.revokeAllFamilies
      ? await dependencies.revokeAllFamilies(request, "global_logout")
      : { status: "missing" as const, revokedCount: 0 };
    return { providerRevoked: false, localRevoked: local.status === "revoked", reason: "session_rejected" as const };
  }
  const subject = setResult.data.user?.id;
  if (!subject || !dependencies.revokeSubject) throw new SupabaseAuthSessionError("session_family_unavailable");
  const requestFamily = readAuthSessionFamily(request);
  if (requestFamily && !matchesAuthSessionFamilySubject(subject, requestFamily.subjectFingerprint)) {
    throw new SupabaseAuthSessionError("session_family_reuse");
  }
  const local = await dependencies.revokeSubject(subject, "global_logout");
  const signOut = await client.auth.signOut({ scope: "global" });
  return signOut.error
    ? { providerRevoked: false, localRevoked: local.status === "revoked", reason: "provider_rejected" as const }
    : { providerRevoked: true, localRevoked: local.status === "revoked", reason: "revoked" as const };
}
