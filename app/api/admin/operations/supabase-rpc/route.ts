import { NextResponse } from "next/server";
import { verifyAdminSessionRequest } from "@/lib/admin/session-roles";
import { applyApiRateLimit } from "@/lib/security/api-guard";
import { getSupabaseQueryCapabilitySummary } from "@/lib/db/supabase-query-capability-registry";
import { getSupabaseRpcGovernorSnapshot } from "@/lib/db/supabase-rpc-runtime-governor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "admin-supabase-rpc-operations",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;

  const admin = verifyAdminSessionRequest(request, "audit:read");
  if (!admin.ok) return admin.response;

  return NextResponse.json({
    schemaVersion: "velmere.admin-supabase-operations.v1",
    rpc: getSupabaseRpcGovernorSnapshot(),
    queryCapabilities: getSupabaseQueryCapabilitySummary(),
    boundary: "Anonymous family-level counters only. No operation arguments, customer identifiers, provider identifiers, tokens or raw errors.",
  }, {
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
