import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { verifyAdminSessionRequest } from "@/lib/admin/session-roles";
import { appendAdminAuditLog } from "@/lib/admin/audit-log";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
} from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { bindVelmereAccountToSupabaseSubject } from "@/lib/account/supabase-subject-binding";
import { hasApiErrorCodePrefix, publicApiError } from "@/lib/security/api-error-envelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function operatorFingerprint(actorId: string) {
  return `operator_${createHash("sha256").update(actorId).digest("hex").slice(0, 20)}`;
}

export async function POST(request: Request) {
  const size = rejectLargeContentLength(request, 8 * 1024);
  if (size) return size;
  const origin = assertSameOriginRequest(request, { allowMissingOrigin: false });
  if (origin) return origin;
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "supabase-subject-binding",
    limit: 8,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;
  const admin = verifyAdminSessionRequest(request, "identity:bind");
  if (!admin.ok) return admin.response;
  const body = await readBoundedJsonBody<{
    accountId?: string;
    supabaseSubject?: string;
    requestId?: string;
  }>(request, 8 * 1024, { maxDepth: 2 });
  if (!body.ok) return body.response;
  try {
    const result = await bindVelmereAccountToSupabaseSubject({
      accountId: body.value.accountId ?? "",
      supabaseSubject: body.value.supabaseSubject ?? "",
      requestId: body.value.requestId ?? "",
      operatorFingerprint: operatorFingerprint(admin.session.actorId),
    });
    const audit = await appendAdminAuditLog({
      actorId: admin.session.actorId,
      actorRole: admin.session.role,
      action: "account_supabase_subject_bind",
      targetType: "account_identity_binding",
      targetId: "redacted_account",
      payload: { status: result.status, durable: result.durable },
    });
    return NextResponse.json({ result, audit }, {
      status: result.status === "conflict" ? 409 : result.status === "not_found" ? 404 : 200,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  } catch (error) {
    const invalid = hasApiErrorCodePrefix(error, ["supabase_subject_binding_invalid_"]);
    return publicApiError(error, {
      route: "/api/admin/accounts/supabase-subject-binding",
      code: invalid ? "supabase_subject_binding_invalid_request" : "supabase_subject_binding_unavailable",
      status: invalid ? 400 : 503,
    });
  }
}
