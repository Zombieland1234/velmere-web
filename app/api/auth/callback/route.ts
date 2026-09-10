import { NextResponse } from "next/server";
import { buildVelmereAccountCookie } from "@/lib/auth/account-session";
import { appendSetCookieHeaders, buildClearedSupabaseAuthCookieHeaders } from "@/lib/auth/supabase-auth-cookies";
import { buildClearedSupabaseAuthFlowCookie } from "@/lib/auth/supabase-auth-flow-state";
import { issuePasswordRecoveryGrantCookie } from "@/lib/auth/password-recovery-grant";
import { completeSupabaseAuthCallback, SupabaseAuthFlowError } from "@/lib/auth/supabase-auth-flow";
import { SupabaseAuthSessionError } from "@/lib/auth/supabase-auth-session";
import { buildCanonicalSameOriginUrl } from "@/lib/security/navigation-redirect-boundary";
import { scheduleAuthSecurityEvent } from "@/lib/auth/auth-security-observability";
import {
  buildAuthSessionFamilyTransitionCookieHeaders,
  buildClearedAuthSessionFamilyCookieHeaders,
} from "@/lib/auth/auth-session-family";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeLocale(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale");
  return locale === "pl" || locale === "de" ? locale : "en";
}

export async function GET(request: Request) {
  try {
    const result = await completeSupabaseAuthCallback(request);
    scheduleAuthSecurityEvent(result.intent === "google_oauth" ? "oauth_completed" : result.intent === "password_recovery" ? "recovery_requested" : result.intent === "email_change" ? "email_change_completed" : "signup_success");
    const resultLocale = /^\/(en|pl|de)(?:\/|$)/u.exec(result.returnPath)?.[1] ?? "en";
    const response = NextResponse.redirect(buildCanonicalSameOriginUrl({
      path: result.returnPath,
      requestUrl: request.url,
      configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      locale: resultLocale,
      profile: "auth_return",
      fallback: `/${resultLocale}/account`,
    }), 303);
    response.headers.set("cache-control", "no-store");
    response.headers.append("Set-Cookie", buildVelmereAccountCookie(result.account));
    appendSetCookieHeaders(response.headers, result.cookieHeaders);
    if (result.familyCookie) appendSetCookieHeaders(response.headers, buildAuthSessionFamilyTransitionCookieHeaders(result.familyCookie));
    if (result.intent === "password_recovery" && result.account.sessionFamily) {
      response.headers.append("Set-Cookie", await issuePasswordRecoveryGrantCookie({
        subjectId: result.user.id,
        familyId: result.account.sessionFamily.familyId,
      }));
    }
    response.headers.append("Set-Cookie", buildClearedSupabaseAuthFlowCookie());
    return response;
  } catch (error) {
    scheduleAuthSecurityEvent(error instanceof SupabaseAuthFlowError && error.code === "flow_state_invalid" ? "flow_state_rejected" : error instanceof SupabaseAuthFlowError && error.code === "oauth_cancelled" ? "oauth_cancelled" : "oauth_rejected");
    const locale = safeLocale(request);
    const code = error instanceof SupabaseAuthFlowError || error instanceof SupabaseAuthSessionError ? error.code : "callback_rejected";
    let target: URL;
    try {
      target = buildCanonicalSameOriginUrl({
        path: `/${locale}/login?auth_error=${encodeURIComponent(code)}`,
        requestUrl: request.url,
        configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        locale,
        profile: "locale_navigation",
        fallback: `/${locale}/login`,
      });
    } catch {
      return NextResponse.json({ ok: false, error: "AUTH_CALLBACK_ORIGIN_UNAVAILABLE" }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    const response = NextResponse.redirect(target, 303);
    response.headers.set("cache-control", "no-store");
    response.headers.append("Set-Cookie", buildClearedSupabaseAuthFlowCookie());
    appendSetCookieHeaders(response.headers, buildClearedSupabaseAuthCookieHeaders());
    appendSetCookieHeaders(response.headers, buildClearedAuthSessionFamilyCookieHeaders());
    return response;
  }
}
