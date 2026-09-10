import { NextResponse } from "next/server";
import { verifyAdminSessionRequest } from "@/lib/admin/session-roles";
import { applyApiRateLimit } from "@/lib/security/api-guard";
import { getAuthSecuritySnapshot } from "@/lib/auth/auth-security-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rate = await applyApiRateLimit(request, { keyPrefix: "admin-auth-security-operations", limit: 30, windowMs: 60_000 });
  if (!rate.ok) return rate.response;
  const admin = verifyAdminSessionRequest(request, "audit:read");
  if (!admin.ok) return admin.response;
  return NextResponse.json({ ...getAuthSecuritySnapshot(), readiness: { alertSinkConfigured: Boolean(process.env.VELMERE_ALERT_WEBHOOK_URL?.trim()), alertSinkAllowlistConfigured: Boolean(process.env.VELMERE_ALERT_WEBHOOK_ALLOWED_HOSTS?.trim()), sessionFamilySecretConfigured: Boolean((process.env.VELMERE_AUTH_SESSION_FAMILY_SECRET_CURRENT || process.env.VELMERE_AUTH_SESSION_FAMILY_SECRET || process.env.VELMERE_ACCOUNT_SESSION_SECRET_CURRENT || process.env.VELMERE_ACCOUNT_SESSION_SECRET)?.trim()) } }, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
