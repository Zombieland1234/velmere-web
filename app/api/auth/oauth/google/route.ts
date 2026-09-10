import { NextResponse } from "next/server";
import { beginSupabaseGoogleOAuth, SupabaseAuthFlowError } from "@/lib/auth/supabase-auth-flow";
import { scheduleAuthSecurityEvent } from "@/lib/auth/auth-security-observability";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength } from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { isProductionLikeEnvironment, validateExactObjectKeys } from "@/lib/security/exact-request-boundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = { locale?: string; returnPath?: string };

function headers() { return { "cache-control": "no-store", "x-content-type-options": "nosniff" }; }

export async function POST(request: Request) {
  const size = rejectLargeContentLength(request, 8 * 1024); if (size) return size;
  const origin = assertSameOriginRequest(request, { allowMissingOrigin: !isProductionLikeEnvironment() }); if (origin) return origin;
  const rate = await applyApiRateLimit(request, { keyPrefix: "pass4718-google-oauth-start", limit: 8, windowMs: 60_000 }); if (!rate.ok) return rate.response;
  const body = await readBoundedJsonBody<Payload>(request, 8 * 1024, { maxDepth: 3 }); if (!body.ok) return body.response;
  const exactBody = validateExactObjectKeys(body.value, ["locale", "returnPath"]); if (!exactBody.ok) return exactBody.response;
  try {
    const result = await beginSupabaseGoogleOAuth(request, body.value);
    scheduleAuthSecurityEvent("oauth_started");
    const response = NextResponse.json({ ok: true, redirectUrl: result.redirectUrl }, { headers: headers() });
    response.headers.append("Set-Cookie", result.flowCookie);
    return response;
  } catch (error) {
    scheduleAuthSecurityEvent("oauth_rejected");
    const known = error instanceof SupabaseAuthFlowError ? error : new SupabaseAuthFlowError("oauth_start_rejected");
    return NextResponse.json({ ok: false, error: "OAUTH_START_UNAVAILABLE", code: known.code, retryable: known.retryable }, { status: known.httpStatus, headers: headers() });
  }
}
