import { NextResponse } from "next/server";
import { beginSupabaseEmailChange, SupabaseAuthFlowError } from "@/lib/auth/supabase-auth-flow";
import { scheduleAuthSecurityEvent } from "@/lib/auth/auth-security-observability";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength } from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { isProductionLikeEnvironment, validateExactObjectKeys } from "@/lib/security/exact-request-boundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Payload = { email?: string; locale?: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
function headers() { return { "cache-control": "no-store", "x-content-type-options": "nosniff" }; }

export async function POST(request: Request) {
  const size = rejectLargeContentLength(request, 8 * 1024); if (size) return size;
  const origin = assertSameOriginRequest(request, { allowMissingOrigin: !isProductionLikeEnvironment() }); if (origin) return origin;
  const rate = await applyApiRateLimit(request, { keyPrefix: "pass4719-email-change", limit: 4, windowMs: 15 * 60_000 }); if (!rate.ok) return rate.response;
  const body = await readBoundedJsonBody<Payload>(request, 8 * 1024, { maxDepth: 2 }); if (!body.ok) return body.response;
  const exactBody = validateExactObjectKeys(body.value, ["email", "locale"]); if (!exactBody.ok) return exactBody.response;
  const email = body.value.email?.trim().toLowerCase() ?? "";
  if (!EMAIL.test(email) || email.length > 180) return NextResponse.json({ ok: false, error: "INVALID_EMAIL_CHANGE_INPUT" }, { status: 400, headers: headers() });
  try {
    const result = await beginSupabaseEmailChange(request, { email, locale: body.value.locale });
    scheduleAuthSecurityEvent("email_change_requested");
    const response = NextResponse.json({ ok: true, requested: true, message: "Confirm the new email address to complete the change." }, { status: 202, headers: headers() });
    response.headers.append("Set-Cookie", result.flowCookie);
    return response;
  } catch (error) {
    scheduleAuthSecurityEvent("email_change_rejected");
    const known = error instanceof SupabaseAuthFlowError ? error : new SupabaseAuthFlowError("email_change_start_rejected");
    return NextResponse.json({ ok: false, error: "EMAIL_CHANGE_UNAVAILABLE", code: known.code, retryable: known.retryable }, { status: known.httpStatus, headers: headers() });
  }
}
