import { NextResponse } from "next/server";
import {
  PASS2624_SUPABASE_RLS_ACCOUNT_DELIVERY_PRODUCTION_LOCK_ID,
  validatePass2624AccountDeliveryProductionLockRequest,
} from "@/lib/security/supabase-rls-account-delivery-production-lock";
import { sanitizePublicAuditEnvelope } from "@/lib/security/public-private-route-lockdown";

export function GET(request: Request) {
  const url = new URL(request.url);
  const report = validatePass2624AccountDeliveryProductionLockRequest(request, url, {
    locale: url.searchParams.get("locale") ?? "en",
  });

  return NextResponse.json(sanitizePublicAuditEnvelope({
    ok: report.summary.canUseAccountDelivery,
    pass2624SupabaseRlsAccountDeliveryProductionLock: report,
    customerResponse: report.customerResponse,
  }, "pass2624-account-delivery-production-lock"), {
    status: report.httpStatus,
    headers: {
      "cache-control": "no-store",
      "x-velmere-pass2624-account-delivery-production-lock": PASS2624_SUPABASE_RLS_ACCOUNT_DELIVERY_PRODUCTION_LOCK_ID,
      "x-velmere-account-delivery-durable-storage-required": String(report.summary.durableStorageRequired),
      "x-velmere-memory-fallback-blocked-in-production": String(report.summary.memoryFallbackBlockedInProduction),
      "x-velmere-rls-owner-scope-required": String(report.summary.rlsOwnerScopeRequired),
      "x-velmere-account-owner-matches": String(report.summary.accountOwnerMatches),
      "x-velmere-can-use-account-delivery": String(report.summary.canUseAccountDelivery),
    },
  });
}
