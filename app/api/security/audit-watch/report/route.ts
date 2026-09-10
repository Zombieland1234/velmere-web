import { NextResponse } from "next/server";
import { reportRouteHeaders } from "@/lib/security/report-route-inventory";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: false,
    error: "legacy_audit_report_route_retired",
    successor: "/api/security/audit-report-assembler",
    customerReportSuccessor: "/api/security/audit-watch/customer-safe-report",
    message: "The static Audit queue/status payload was retired because it was not bound to the immutable account snapshot or the actual provider evidence used for the report.",
  }, {
    status: 410,
    headers: {
      ...reportRouteHeaders("/api/security/audit-watch/report"),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-velmere-legacy-static-report": "retired",
    },
  });
}
