import { NextResponse } from "next/server";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength } from "@/lib/security/api-guard";
import {
  PASS2363_ACCOUNT_AUTH_SPINE_ID,
  accountPublicPayload,
  buildClearedVelmereAccountCookie,
  buildVelmereAccountCookie,
  buildVelmereAccountSession,
  getVelmereAccountSessionReadiness,
  googleAuthRuntimeStatus,
  resolveRequestAccount,
} from "@/lib/auth/account-session";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { validateExactObjectKeys } from "@/lib/security/exact-request-boundary";
import {
  SupabaseAuthSessionError,
  establishSupabasePasswordSession,
  inspectSupabaseCookieSession,
  refreshSupabaseCookieSession,
  revokeSupabaseCookieSession,
} from "@/lib/auth/supabase-auth-session";
import {
  beginSupabaseEmailPasswordSignup,
  SupabaseAuthFlowError,
} from "@/lib/auth/supabase-auth-flow";
import {
  appendSetCookieHeaders,
  buildClearedSupabaseAuthCookieHeaders,
  readSupabaseRefreshTokenCookie,
} from "@/lib/auth/supabase-auth-cookies";
import { scheduleAuthSecurityEvent } from "@/lib/auth/auth-security-observability";
import {
  buildAuthSessionFamilyTransitionCookieHeaders,
  buildClearedAuthSessionFamilyCookieHeaders,
} from "@/lib/auth/auth-session-family";
import {
  CustomerOwnedWriteBoundaryError,
  resolveCustomerOwnedWriteBoundary,
} from "@/lib/db/customer-owned-write-boundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionPayload = {
  email?: string;
  password?: string;
  mode?: "signin" | "create";
  displayName?: string;
  provider?: "email" | "google" | "google_preview" | "preview";
  accountId?: string;
  handle?: string;
  locale?: string;
};

function productionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function baseHeaders() {
  return new Headers({
    "Cache-Control": "no-store",
    "Vary": "Cookie, Authorization",
    "x-content-type-options": "nosniff",
    "x-velmere-pass2363-auth-spine": PASS2363_ACCOUNT_AUTH_SPINE_ID,
    "x-velmere-auth-session": "http-only-cookie-v1",
  });
}

function authErrorResponse(error: SupabaseAuthSessionError) {
  return NextResponse.json({
    ok: false,
    error: "SUPABASE_AUTH_SESSION_UNAVAILABLE",
    code: error.code,
    retryable: error.retryable,
    confirmationRequired: error.code === "email_confirmation_required",
  }, { status: error.httpStatus, headers: baseHeaders() });
}

function appendClearedAuthCookies(headers: Headers) {
  headers.append("Set-Cookie", buildClearedVelmereAccountCookie());
  appendSetCookieHeaders(headers, buildClearedSupabaseAuthCookieHeaders());
  appendSetCookieHeaders(headers, buildClearedAuthSessionFamilyCookieHeaders());
}

function validateEmailPassword(payload: SessionPayload) {
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) return null;
  if (password.length < 8 || password.length > 128) return null;
  return { email, password };
}

export async function GET(request: Request) {
  const account = await resolveRequestAccount(request);
  let supabaseAuthenticated = false;
  let bindingState: "ready" | "missing" | "invalid" | "mismatch" = "missing";

  try {
    await inspectSupabaseCookieSession(request);
    supabaseAuthenticated = true;
    if (account) {
      await resolveCustomerOwnedWriteBoundary({ request, accountId: account.accountId });
      bindingState = "ready";
    }
  } catch (error) {
    if (error instanceof CustomerOwnedWriteBoundaryError) {
      bindingState = error.code === "account_mismatch" || error.code === "account_unbound" ? "mismatch" : "invalid";
    } else if (error instanceof SupabaseAuthSessionError) {
      bindingState = error.code === "access_token_missing" ? "missing" : "invalid";
    }
  }

  const previewAuthenticated = Boolean(account) && !productionLike() && (account?.provider === "preview" || account?.provider === "google_preview");
  const authenticated = previewAuthenticated || Boolean(account && supabaseAuthenticated && bindingState === "ready");
  return NextResponse.json({
    ok: true,
    passId: PASS2363_ACCOUNT_AUTH_SPINE_ID,
    authenticated,
    accountAuthenticated: Boolean(account),
    supabaseAuthenticated,
    bindingState,
    refreshRequired: !supabaseAuthenticated && Boolean(readSupabaseRefreshTokenCookie(request)),
    session: authenticated && account ? accountPublicPayload(account) : null,
    google: googleAuthRuntimeStatus(),
    authMode: previewAuthenticated ? "preview" : authenticated ? "supabase_http_only" : "none",
  }, { headers: baseHeaders() });
}

export async function POST(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 64 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: !productionLike() });
  if (originGuard) return originGuard;
  const limited = await applyApiRateLimit(request, { keyPrefix: "pass4717-auth-session", limit: 12, windowMs: 60_000 });
  if (!limited.ok) return limited.response;

  const parsedBody = await readBoundedJsonBody<SessionPayload>(request, 64 * 1024, { maxDepth: 6 });
  if (!parsedBody.ok) return parsedBody.response;
  const exactBody = validateExactObjectKeys(parsedBody.value, ["email", "password", "mode", "displayName", "provider", "accountId", "handle", "locale"]);
  if (!exactBody.ok) return exactBody.response;
  const payload = parsedBody.value;

  if (payload.provider === "email" || payload.password) {
    const credentials = validateEmailPassword(payload);
    if (!credentials) {
      return NextResponse.json({ ok: false, error: "INVALID_AUTH_INPUT" }, { status: 400, headers: baseHeaders() });
    }
    const sessionReadiness = getVelmereAccountSessionReadiness();
    if (!sessionReadiness.ready) {
      return NextResponse.json({ ok: false, error: "ACCOUNT_SESSION_SIGNING_NOT_READY" }, { status: 503, headers: baseHeaders() });
    }
    try {
      let result;
      if (payload.mode === "create") {
        const signup = await beginSupabaseEmailPasswordSignup(request, {
            email: credentials.email,
            password: credentials.password,
            displayName: payload.displayName,
            handle: payload.handle,
            locale: payload.locale,
          });
        if (signup.status === "confirmation_required") {
          scheduleAuthSecurityEvent("signup_pending");
          const headers = baseHeaders();
          appendClearedAuthCookies(headers);
          headers.append("Set-Cookie", signup.flowCookie);
          return NextResponse.json({
            ok: false,
            error: "SUPABASE_AUTH_SESSION_UNAVAILABLE",
            code: "email_confirmation_required",
            retryable: false,
            confirmationRequired: true,
          }, { status: 202, headers });
        }
        result = signup;
      } else {
        result = await establishSupabasePasswordSession({
            mode: "signin",
            email: credentials.email,
            password: credentials.password,
            displayName: payload.displayName,
            handle: payload.handle,
          });
      }
      scheduleAuthSecurityEvent(payload.mode === "create" ? "signup_success" : "signin_success");
      const headers = baseHeaders();
      headers.append("Set-Cookie", buildVelmereAccountCookie(result.account));
      appendSetCookieHeaders(headers, result.cookieHeaders);
      if (result.familyCookie) appendSetCookieHeaders(headers, buildAuthSessionFamilyTransitionCookieHeaders(result.familyCookie));
      return NextResponse.json({
        ok: true,
        passId: PASS2363_ACCOUNT_AUTH_SPINE_ID,
        authenticated: true,
        session: accountPublicPayload(result.account),
        bindingState: result.bindingStatus,
        authMode: "supabase_http_only",
        sessionExpiresIn: result.sessionExpiresIn,
      }, { status: payload.mode === "create" ? 201 : 200, headers });
    } catch (error) {
      if (error instanceof SupabaseAuthSessionError) {
        scheduleAuthSecurityEvent(error.code === "email_confirmation_required" ? "signup_pending" : error.code === "identity_binding_conflict" ? "binding_conflict" : "signin_rejected");
        return authErrorResponse(error);
      }
      if (error instanceof SupabaseAuthFlowError) {
        scheduleAuthSecurityEvent("signin_rejected");
        return NextResponse.json({
          ok: false,
          error: "SUPABASE_AUTH_SESSION_UNAVAILABLE",
          code: error.code,
          retryable: error.retryable,
          confirmationRequired: false,
        }, { status: error.httpStatus, headers: baseHeaders() });
      }
      return NextResponse.json({ ok: false, error: "SUPABASE_AUTH_SESSION_UNAVAILABLE", retryable: true }, { status: 503, headers: baseHeaders() });
    }
  }

  if (productionLike()) {
    return NextResponse.json({
      ok: false,
      error: "PRODUCTION_AUTH_PROVIDER_REQUIRED",
      passId: PASS2363_ACCOUNT_AUTH_SPINE_ID,
      boundary: "Production account sessions require verified Supabase Auth identity.",
    }, { status: 503, headers: baseHeaders() });
  }

  if (payload.provider === "google") {
    const status = googleAuthRuntimeStatus();
    if (status.mode !== "ready_for_real_oauth") {
      return NextResponse.json({ ok: false, error: "GOOGLE_OAUTH_NOT_CONFIGURED", google: status }, { status: 501, headers: baseHeaders() });
    }
  }

  const sessionReadiness = getVelmereAccountSessionReadiness();
  if (!sessionReadiness.ready) {
    return NextResponse.json({ ok: false, error: "ACCOUNT_SESSION_SIGNING_NOT_READY" }, { status: 503, headers: baseHeaders() });
  }
  const provider = payload.provider === "google" ? "google_preview" : payload.provider;
  const session = buildVelmereAccountSession({
    email: payload.email,
    displayName: payload.displayName,
    handle: payload.handle,
    provider,
  });
  const headers = baseHeaders();
  headers.append("Set-Cookie", buildVelmereAccountCookie(session));
  return NextResponse.json({
    ok: true,
    passId: PASS2363_ACCOUNT_AUTH_SPINE_ID,
    authenticated: true,
    session: accountPublicPayload(session),
    authMode: "preview",
  }, { headers });
}

export async function PUT(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 4 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: !productionLike() });
  if (originGuard) return originGuard;
  const limited = await applyApiRateLimit(request, { keyPrefix: "pass4717-auth-refresh", limit: 12, windowMs: 60_000 });
  if (!limited.ok) return limited.response;
  try {
    const result = await refreshSupabaseCookieSession(request);
    scheduleAuthSecurityEvent("refresh_success");
    const headers = baseHeaders();
    headers.append("Set-Cookie", buildVelmereAccountCookie(result.account));
    appendSetCookieHeaders(headers, result.cookieHeaders);
    if (result.familyCookie) appendSetCookieHeaders(headers, buildAuthSessionFamilyTransitionCookieHeaders(result.familyCookie));
    return NextResponse.json({
      ok: true,
      authenticated: true,
      session: accountPublicPayload(result.account),
      bindingState: result.bindingStatus,
      authMode: "supabase_http_only",
      sessionExpiresIn: result.sessionExpiresIn,
    }, { headers });
  } catch (error) {
    scheduleAuthSecurityEvent(error instanceof SupabaseAuthSessionError && error.code === "session_family_reuse" ? "refresh_reuse_detected" : "refresh_rejected");
    if (error instanceof SupabaseAuthSessionError) {
      const response = authErrorResponse(error);
      if (error.code === "refresh_token_missing" || error.code === "refresh_rejected" || error.code === "session_family_reuse") {
        appendClearedAuthCookies(response.headers);
      }
      return response;
    }
    return NextResponse.json({ ok: false, error: "SUPABASE_AUTH_REFRESH_UNAVAILABLE", retryable: true }, { status: 503, headers: baseHeaders() });
  }
}

export async function DELETE(request: Request) {
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: !productionLike() });
  if (originGuard) return originGuard;
  let provider;
  try {
    provider = await revokeSupabaseCookieSession(request);
  } catch (error) {
    const known = error instanceof SupabaseAuthSessionError ? error : new SupabaseAuthSessionError("session_family_unavailable");
    return authErrorResponse(known);
  }
  scheduleAuthSecurityEvent("logout_global");
  const headers = baseHeaders();
  appendClearedAuthCookies(headers);
  return NextResponse.json({
    ok: true,
    passId: PASS2363_ACCOUNT_AUTH_SPINE_ID,
    cleared: true,
    providerRevoked: provider.providerRevoked,
    providerState: provider.reason,
  }, { headers });
}
