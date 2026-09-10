import { createHash } from "node:crypto";
import { createClient, type AuthSession, type AuthUser } from "@supabase/supabase-js";
import { readSupabaseAccessTokenCookie } from "@/lib/auth/supabase-auth-cookies";
import {
  matchesAuthSessionFamilySubject,
  readAuthSessionFamily,
  verifyAuthSessionFamily,
} from "@/lib/auth/auth-session-family";
import { consumePasswordRecoveryGrant } from "@/lib/auth/password-recovery-grant";
import { validateSupabaseAuthCallbackContract } from "@/lib/security/auth-callback-contract";
import { assertBrowserRedirectUrl, resolveCanonicalSiteOrigin } from "@/lib/security/navigation-redirect-boundary";
import {
  buildSupabaseAuthFlowCookie,
  createSupabaseAuthFlowState,
  matchesSupabaseAuthFlowExpectedIdentity,
  readSupabaseAuthFlowState,
  type SupabaseAuthFlowState,
  type SupabaseAuthFlowIntent,
} from "@/lib/auth/supabase-auth-flow-state";
import {
  SupabaseAuthSessionError,
  finalizeVerifiedSupabaseSession,
  type SupabaseAuthSessionDependencies,
  supabaseAuthSessionDependencies,
} from "@/lib/auth/supabase-auth-session";
import { reservePass4395DurableIdempotencyKey } from "@/lib/security/durable-idempotency-store";

export type SupabaseAuthFlowErrorCode =
  | "auth_config_unavailable" | "canonical_origin_unavailable" | "oauth_start_rejected"
  | "signup_start_rejected" | "recovery_start_rejected" | "email_change_start_rejected" | "flow_state_invalid" | "callback_contract_invalid" | "callback_rejected"
  | "flow_identity_mismatch" | "flow_replay_rejected" | "flow_nonce_unavailable"
  | "oauth_cancelled" | "password_update_rejected" | "access_token_missing" | "access_token_rejected" | "session_family_unavailable"
  | "recovery_grant_invalid" | "session_family_inactive";

export class SupabaseAuthFlowError extends Error {
  readonly code: SupabaseAuthFlowErrorCode;
  readonly httpStatus: 400 | 401 | 409 | 503;
  readonly retryable: boolean;
  constructor(code: SupabaseAuthFlowErrorCode) {
    super(`supabase_auth_flow:${code}`);
    this.name = "SupabaseAuthFlowError";
    this.code = code;
    this.httpStatus = code === "access_token_missing" || code === "access_token_rejected" || code === "recovery_grant_invalid" || code === "session_family_inactive"
      ? 401
      : code === "flow_replay_rejected"
        ? 409
        : code === "flow_state_invalid" || code === "callback_contract_invalid" || code === "callback_rejected" || code === "oauth_cancelled" || code === "flow_identity_mismatch"
          ? 400
          : 503;
    this.retryable = this.httpStatus === 503;
  }
}

type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
type FlowAuthClient = {
  auth: {
    signUp(input: { email: string; password: string; options: { data?: Record<string, unknown>; emailRedirectTo: string } }): Promise<{ data: { user: AuthUser | null; session: AuthSession | null }; error: { code?: string } | null }>;
    signInWithOAuth(input: { provider: "google"; options: { redirectTo: string; skipBrowserRedirect: true; scopes?: string } }): Promise<{ data: { url: string | null }; error: { code?: string } | null }>;
    resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<{ data: Record<string, never>; error: { code?: string } | null }>;
    exchangeCodeForSession(code: string): Promise<{ data: { user: AuthUser | null; session: AuthSession | null }; error: { code?: string } | null }>;
    verifyOtp(input: { token_hash: string; type: "signup" | "recovery" | "email_change" | "invite" }): Promise<{ data: { user: AuthUser | null; session: AuthSession | null }; error: { code?: string } | null }>;
    getUser(accessToken: string): Promise<{ data: { user: AuthUser | null }; error: { code?: string } | null }>;
    updateUser(input: { password?: string; email?: string; options?: { emailRedirectTo?: string } }): Promise<{ data: { user: AuthUser | null }; error: { code?: string } | null }>;
    signOut(input?: { scope?: "global" | "local" | "others" }): Promise<{ error: { code?: string } | null }>;
  };
};

export type EmailConfirmationStateConsumption = "consumed" | "replayed" | "unavailable";

export type SupabaseAuthFlowDependencies = {
  createFlowClient: (storage: StorageLike, accessToken?: string) => FlowAuthClient | null;
  finalizeSession: typeof finalizeVerifiedSupabaseSession;
  sessionDependencies: SupabaseAuthSessionDependencies;
  verifyFamily?: typeof verifyAuthSessionFamily;
  consumeEmailConfirmationState?: (state: SupabaseAuthFlowState) => Promise<EmailConfirmationStateConsumption>;
};

function createMemoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { if (key.length <= 240 && value.length <= 4096) values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    } satisfies StorageLike,
    snapshot: () => Object.fromEntries(Array.from(values.entries()).slice(0, 6)),
  };
}

function defaultCreateFlowClient(storage: StorageLike, accessToken?: string): FlowAuthClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, flowType: "pkce", storage },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  }) as unknown as FlowAuthClient;
}

export async function consumeSupabaseEmailConfirmationState(
  state: SupabaseAuthFlowState,
): Promise<EmailConfirmationStateConsumption> {
  if (state.intent !== "email_confirmation" || !state.expectedIdentityFingerprint) return "unavailable";
  const keyHash = `auth-flow:${createHash("sha256").update(`email_confirmation:${state.nonce}`).digest("hex")}`;
  const valueHash = `auth-flow-value:${createHash("sha256").update([
    state.expectedIdentityFingerprint,
    state.issuedAt,
    state.expiresAt,
    state.locale,
    state.returnPath,
  ].join(":"), "utf8").digest("hex")}`;
  const result = await reservePass4395DurableIdempotencyKey({
    keyHash,
    valueHash,
    receipt: {
      schemaVersion: "velmere.email-confirmation-callback-consume.v1",
      intent: state.intent,
      issuedAt: state.issuedAt,
      expiresAt: state.expiresAt,
    },
    ttlSeconds: Math.max(60, state.expiresAt - Math.floor(Date.now() / 1000)),
  });
  if (result.durable && result.ok && result.disposition === "STARTED") return "consumed";
  if (result.durable && result.disposition !== "DURABLE_UNAVAILABLE") return "replayed";
  return "unavailable";
}

export const supabaseAuthFlowDependencies: SupabaseAuthFlowDependencies = {
  createFlowClient: defaultCreateFlowClient,
  finalizeSession: finalizeVerifiedSupabaseSession,
  sessionDependencies: supabaseAuthSessionDependencies,
  verifyFamily: verifyAuthSessionFamily,
  consumeEmailConfirmationState: consumeSupabaseEmailConfirmationState,
};

function canonicalOrigin(request: Request) {
  try {
    return resolveCanonicalSiteOrigin({
      requestUrl: request.url,
      configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    });
  } catch { throw new SupabaseAuthFlowError("canonical_origin_unavailable"); }
}

function requireClient(dependencies: SupabaseAuthFlowDependencies, storage: StorageLike, accessToken?: string) {
  const client = dependencies.createFlowClient(storage, accessToken);
  if (!client) throw new SupabaseAuthFlowError("auth_config_unavailable");
  return client;
}

function callbackUrl(request: Request, state: { nonce: string; intent: SupabaseAuthFlowIntent; locale: string }) {
  const url = new URL("/api/auth/callback", canonicalOrigin(request));
  url.searchParams.set("state", state.nonce);
  url.searchParams.set("intent", state.intent);
  url.searchParams.set("locale", state.locale);
  return url.toString();
}

export async function beginSupabaseEmailPasswordSignup(
  request: Request,
  input: { email: string; password: string; displayName?: string; handle?: string; locale?: string },
  dependencies: SupabaseAuthFlowDependencies = supabaseAuthFlowDependencies,
) {
  const memory = createMemoryStorage();
  const locale = input.locale === "pl" || input.locale === "de" ? input.locale : "en";
  const draft = createSupabaseAuthFlowState({
    intent: "email_confirmation",
    locale,
    returnPath: `/${locale}/account`,
    expectedEmail: input.email,
  });
  const client = requireClient(dependencies, memory.storage);
  const result = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { display_name: input.displayName?.slice(0, 80) },
      emailRedirectTo: callbackUrl(request, draft),
    },
  });
  if (result.error || !result.data.user) throw new SupabaseAuthFlowError("signup_start_rejected");

  if (result.data.session) {
    try {
      const finalized = await dependencies.finalizeSession(
        result.data.user,
        result.data.session,
        input.displayName,
        input.handle,
        dependencies.sessionDependencies,
      );
      return { status: "authenticated" as const, ...finalized };
    } catch (error) {
      if (!(error instanceof SupabaseAuthSessionError) || error.code !== "email_confirmation_required") throw error;
    }
  }

  const storage = memory.snapshot();
  if (Object.keys(storage).length === 0) throw new SupabaseAuthFlowError("signup_start_rejected");
  const state = { ...draft, storage };
  return {
    status: "confirmation_required" as const,
    requested: true as const,
    flowCookie: buildSupabaseAuthFlowCookie(state),
    state,
  };
}

export async function beginSupabaseGoogleOAuth(
  request: Request,
  input: { locale?: string; returnPath?: string },
  dependencies: SupabaseAuthFlowDependencies = supabaseAuthFlowDependencies,
) {
  const memory = createMemoryStorage();
  const draft = createSupabaseAuthFlowState({ intent: "google_oauth", locale: input.locale, returnPath: input.returnPath });
  const client = requireClient(dependencies, memory.storage);
  const result = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(request, draft), skipBrowserRedirect: true, scopes: "openid email profile" },
  });
  if (result.error || !result.data.url) throw new SupabaseAuthFlowError("oauth_start_rejected");
  let redirectUrl: string;
  try {
    redirectUrl = assertBrowserRedirectUrl(result.data.url, {
      profile: "supabase_oauth",
      browserOrigin: canonicalOrigin(request),
      supabaseOrigin: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
  } catch { throw new SupabaseAuthFlowError("oauth_start_rejected"); }
  try {
    const probe = await fetch(redirectUrl, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(3000) });
    if (probe.status === 400) {
      const probeBody = await probe.json().catch(() => null);
      if (probeBody?.msg?.includes("Unsupported provider") || probeBody?.error_code === "validation_failed") {
        throw new SupabaseAuthFlowError("auth_config_unavailable");
      }
    }
  } catch (probeError) {
    if (probeError instanceof SupabaseAuthFlowError) throw probeError;
  }
  const state = { ...draft, storage: memory.snapshot() };
  return { redirectUrl, flowCookie: buildSupabaseAuthFlowCookie(state), state };
}

export async function beginSupabasePasswordRecovery(
  request: Request,
  input: { email: string; locale?: string },
  dependencies: SupabaseAuthFlowDependencies = supabaseAuthFlowDependencies,
) {
  const memory = createMemoryStorage();
  const draft = createSupabaseAuthFlowState({ intent: "password_recovery", locale: input.locale, returnPath: `/${input.locale === "pl" || input.locale === "de" ? input.locale : "en"}/login?recovery=1` });
  const client = requireClient(dependencies, memory.storage);
  const result = await client.auth.resetPasswordForEmail(input.email, { redirectTo: callbackUrl(request, draft) });
  if (result.error) throw new SupabaseAuthFlowError("recovery_start_rejected");
  const state = { ...draft, storage: memory.snapshot() };
  return { requested: true as const, flowCookie: buildSupabaseAuthFlowCookie(state), state };
}


export async function beginSupabaseEmailChange(
  request: Request,
  input: { email: string; locale?: string },
  dependencies: SupabaseAuthFlowDependencies = supabaseAuthFlowDependencies,
) {
  const accessToken = readSupabaseAccessTokenCookie(request);
  if (!accessToken) throw new SupabaseAuthFlowError("access_token_missing");
  const memory = createMemoryStorage();
  const locale = input.locale === "pl" || input.locale === "de" ? input.locale : "en";
  const draft = createSupabaseAuthFlowState({ intent: "email_change", locale, returnPath: `/${locale}/account` });
  const client = requireClient(dependencies, memory.storage, accessToken);
  const result = await client.auth.updateUser({ email: input.email, options: { emailRedirectTo: callbackUrl(request, draft) } });
  if (result.error || !result.data.user) throw new SupabaseAuthFlowError("email_change_start_rejected");
  const state = { ...draft, storage: memory.snapshot() };
  return { requested: true as const, flowCookie: buildSupabaseAuthFlowCookie(state), state };
}

export async function completeSupabaseAuthCallback(
  request: Request,
  dependencies: SupabaseAuthFlowDependencies = supabaseAuthFlowDependencies,
) {
  const state = readSupabaseAuthFlowState(request);
  if (!state) throw new SupabaseAuthFlowError("flow_state_invalid");
  const contract = validateSupabaseAuthCallbackContract(request, state);
  if (!contract.ok) throw new SupabaseAuthFlowError("callback_contract_invalid");
  if (contract.mode === "error") {
    if (contract.providerError === "access_denied") throw new SupabaseAuthFlowError("oauth_cancelled");
    throw new SupabaseAuthFlowError("callback_rejected");
  }
  const memory = createMemoryStorage(state.storage);
  const client = requireClient(dependencies, memory.storage);
  const result = contract.mode === "code"
    ? await client.auth.exchangeCodeForSession(contract.code!)
    : await client.auth.verifyOtp({ token_hash: contract.tokenHash!, type: contract.otpType! });
  if (!result || result.error || !result.data.user || !result.data.session) throw new SupabaseAuthFlowError("callback_rejected");
  if (state.intent === "email_confirmation") {
    if (!matchesSupabaseAuthFlowExpectedIdentity(state, result.data.user.email)) {
      throw new SupabaseAuthFlowError("flow_identity_mismatch");
    }
    const consume = dependencies.consumeEmailConfirmationState;
    if (!consume) throw new SupabaseAuthFlowError("flow_nonce_unavailable");
    let consumed: EmailConfirmationStateConsumption;
    try {
      consumed = await consume(state);
    } catch {
      throw new SupabaseAuthFlowError("flow_nonce_unavailable");
    }
    if (consumed === "unavailable") throw new SupabaseAuthFlowError("flow_nonce_unavailable");
    if (consumed !== "consumed") throw new SupabaseAuthFlowError("flow_replay_rejected");
  }
  try {
    const finalized = await dependencies.finalizeSession(result.data.user, result.data.session, undefined, undefined, dependencies.sessionDependencies);
    return { ...finalized, intent: state.intent, returnPath: state.returnPath };
  } catch (error) {
    if (error instanceof SupabaseAuthSessionError) throw error;
    throw new SupabaseAuthFlowError("callback_rejected");
  }
}

export async function updateSupabaseRecoveredPassword(
  request: Request,
  password: string,
  dependencies: SupabaseAuthFlowDependencies = supabaseAuthFlowDependencies,
) {
  const accessToken = readSupabaseAccessTokenCookie(request);
  if (!accessToken) throw new SupabaseAuthFlowError("access_token_missing");
  const memory = createMemoryStorage();
  const client = requireClient(dependencies, memory.storage, accessToken);
  const identity = await client.auth.getUser(accessToken);
  if (identity.error || !identity.data.user) throw new SupabaseAuthFlowError("access_token_rejected");
  const family = readAuthSessionFamily(request);
  if (!family || !matchesAuthSessionFamilySubject(identity.data.user.id, family.subjectFingerprint)) {
    throw new SupabaseAuthFlowError("session_family_unavailable");
  }
  if (!dependencies.verifyFamily) throw new SupabaseAuthFlowError("session_family_unavailable");
  try {
    const verified = await dependencies.verifyFamily(family);
    if (
      verified.status !== "active"
      || verified.familyId !== family.familyId
      || verified.subjectFingerprint !== family.subjectFingerprint
      || verified.generation !== family.generation
      || verified.expiresAt !== family.expiresAt
    ) throw new SupabaseAuthFlowError("session_family_inactive");
  } catch (error) {
    if (error instanceof SupabaseAuthFlowError) throw error;
    throw new SupabaseAuthFlowError("session_family_unavailable");
  }
  if (!await consumePasswordRecoveryGrant(request, { subjectId: identity.data.user.id, familyId: family.familyId })) {
    throw new SupabaseAuthFlowError("recovery_grant_invalid");
  }
  if (!dependencies.sessionDependencies.revokeSubject) throw new SupabaseAuthFlowError("session_family_unavailable");
  try {
    const revoked = await dependencies.sessionDependencies.revokeSubject(identity.data.user.id, "password_change");
    if (revoked.status !== "revoked") throw new Error("subject_family_missing");
  } catch {
    throw new SupabaseAuthFlowError("session_family_unavailable");
  }
  const result = await client.auth.updateUser({ password });
  if (result.error || !result.data.user || result.data.user.id !== identity.data.user.id) throw new SupabaseAuthFlowError("password_update_rejected");
  const signOut = await client.auth.signOut({ scope: "global" });
  if (signOut.error) throw new SupabaseAuthFlowError("session_family_unavailable");
  return { updated: true as const, userId: result.data.user.id };
}
