import { NextResponse } from "next/server";
import {
  buildAuditRegistryApiPayload,
  buildAuditRegistryDashboard,
  PASS1894_AUDIT_PUBLIC_REGISTRY_ID,
  type AuditRegistrySort,
} from "@/lib/security/audit-public-registry";

export const dynamic = "force-dynamic";

function normalizeSort(value: string | null): AuditRegistrySort {
  return value === "freshness" || value === "admin" || value === "severity" ? value : "confidence";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") ?? "en";
  const query = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "all";
  const sort = normalizeSort(url.searchParams.get("sort"));
  const registry = buildAuditRegistryDashboard(locale, query, status, sort);

  return NextResponse.json({
    ok: true,
    surface: "velmere-security-audit-watch-registry",
    registry,
    apiPayload: buildAuditRegistryApiPayload(locale),
  }, {
    headers: {
      "x-velmere-audit-public-registry": PASS1894_AUDIT_PUBLIC_REGISTRY_ID,
      "x-velmere-audit-boundary": "no-certified-safe-no-no-risk-no-public-exploit-instructions",
    },
  });
}
