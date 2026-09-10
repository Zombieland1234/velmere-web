import { NextResponse } from "next/server";
import { beginSupabasePasswordRecovery, SupabaseAuthFlowError, updateSupabaseRecoveredPassword } from "@/lib/auth/supabase-auth-flow";
import { buildClearedVelmereAccountCookie } from "@/lib/auth/account-session";
import { buildClearedAuthSessionFamilyCookieHeaders } from "@/lib/auth/auth-session-family";
import { buildClearedPasswordRecoveryGrantCookie } from "@/lib/auth/password-recovery-grant";
import { appendSetCookieHeaders, buildClearedSupabaseAuthCookieHeaders } from "@/lib/auth/supabase-auth-cookies";
import { scheduleAuthSecurityEvent } from "@/lib/auth/auth-security-observability";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength } from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { isProductionLikeEnvironment, validateExactObjectKeys } from "@/lib/security/exact-request-boundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestPayload = { email?: string; locale?: string };
type UpdatePayload = { password?: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function headers() { return { "cache-control": "no-store", "x-content-type-options": "nosniff" }; }
function originGuard(request: Request) { return assertSameOriginRequest(request, { allowMissingOrigin: !isProductionLikeEnvironment() }); }

export async function POST(request: Request) {
  const size = rejectLargeContentLength(request, 8 * 1024); if (size) return size;
  const origin = originGuard(request); if (origin) return origin;
  const rate = await applyApiRateLimit(request, { keyPrefix: "pass4718-password-recovery-request", limit: 5, windowMs: 15 * 60_000 }); if (!rate.ok) return rate.response;
  const body = await readBoundedJsonBody<RequestPayload>(request, 8 * 1024, { maxDepth: 3 }); if (!body.ok) return body.response;
  const exactBody = validateExactObjectKeys(body.value, ["email", "locale"]); if (!exactBody.ok) return exactBody.response;
  const email = body.value.email?.trim().toLowerCase() ?? "";
  if (!EMAIL.test(email) || email.length > 180) return NextResponse.json({ ok: false, error: "INVALID_RECOVERY_INPUT" }, { status: 400, headers: headers() });
  try {
    const result = await beginSupabasePasswordRecovery(request, { email, locale: body.value.locale });
    scheduleAuthSecurityEvent("recovery_requested");
    const response = NextResponse.json({ ok: true, requested: true, message: "If the account exists, a recovery email has been requested." }, { status: 202, headers: headers() });
    response.headers.append("Set-Cookie", result.flowCookie);
    return response;
  } catch {
    scheduleAuthSecurityEvent("recovery_rejected");
    return NextResponse.json({ ok: true, requested: true, message: "If the account exists, a recovery email has been requested." }, { status: 202, headers: headers() });
  }
}

export async function PUT(request: Request) {
  const size = rejectLargeContentLength(request, 8 * 1024); if (size) return size;
  const origin = originGuard(request); if (origin) return origin;
  const rate = await applyApiRateLimit(request, { keyPrefix: "pass4718-password-recovery-update", limit: 5, windowMs: 15 * 60_000 }); if (!rate.ok) return rate.response;
  const body = await readBoundedJsonBody<UpdatePayload>(request, 8 * 1024, { maxDepth: 2 }); if (!body.ok) return body.response;
  const exactBody = validateExactObjectKeys(body.value, ["password"]); if (!exactBody.ok) return exactBody.response;
  const password = body.value.password ?? "";
  if (password.length < 10 || password.length > 128) return NextResponse.json({ ok: false, error: "INVALID_NEW_PASSWORD" }, { status: 400, headers: headers() });
  try {
    await updateSupabaseRecoveredPassword(request, password);
    scheduleAuthSecurityEvent("recovery_completed");
    const response = NextResponse.json({ ok: true, updated: true }, { headers: headers() });
    response.headers.append("Set-Cookie", buildClearedVelmereAccountCookie());
    response.headers.append("Set-Cookie", buildClearedPasswordRecoveryGrantCookie());
    appendSetCookieHeaders(response.headers, buildClearedSupabaseAuthCookieHeaders());
    appendSetCookieHeaders(response.headers, buildClearedAuthSessionFamilyCookieHeaders());
    return response;
  } catch (error) {
    scheduleAuthSecurityEvent("recovery_rejected");
    const known = error instanceof SupabaseAuthFlowError ? error : new SupabaseAuthFlowError("password_update_rejected");
    const response = NextResponse.json({ ok: false, error: "PASSWORD_UPDATE_UNAVAILABLE", code: known.code, retryable: known.retryable }, { status: known.httpStatus, headers: headers() });
    response.headers.append("Set-Cookie", buildClearedPasswordRecoveryGrantCookie());
    return response;
  }
}
