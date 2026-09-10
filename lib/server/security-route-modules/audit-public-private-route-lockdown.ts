import { C0_OR_TEMPLATE_META_PATTERN } from "../../security/ascii-control-characters";

import { NextResponse } from "next/server";
import {
  buildPass2622PublicPrivateRouteLockdownReport,
  PASS2622_PUBLIC_PRIVATE_ROUTE_LOCKDOWN_ID,
  sanitizePublicAuditEnvelope,
} from "@/lib/security/public-private-route-lockdown";

function clean(value: string | null, fallback = "", max = 180) {
  const text = String(value ?? fallback).replace(C0_OR_TEMPLATE_META_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const report = buildPass2622PublicPrivateRouteLockdownReport({
    locale: clean(url.searchParams.get("locale"), "en", 8),
    chain: clean(url.searchParams.get("chain"), "ethereum", 40),
    projectName: clean(url.searchParams.get("projectName"), "Velmère audit", 140),
    contractAddress: clean(url.searchParams.get("contractAddress"), "", 96) || undefined,
    reviewLevel: "advanced_review",
  });

  return NextResponse.json(sanitizePublicAuditEnvelope({
    ok: true,
    passId: PASS2622_PUBLIC_PRIVATE_ROUTE_LOCKDOWN_ID,
    report,
    publicRows: report.customerRows,
    proPdfRows: report.proPdfRows,
    privateBoundary: "operatorRows stay behind verifySecurityAdminToken and are stripped from this public route",
  }, "pass2622-public-route"), {
    headers: {
      "cache-control": "no-store",
      "x-velmere-pass2622-public-private-lockdown": PASS2622_PUBLIC_PRIVATE_ROUTE_LOCKDOWN_ID,
      "x-velmere-public-api-sanitized": String(report.summary.publicApiSanitized),
      "x-velmere-operator-routes-require-admin": String(report.summary.operatorRoutesRequireAdmin),
      "x-velmere-no-public-operatorrows": "true",
    },
  });
}
