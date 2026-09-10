import { NextResponse } from "next/server";
import {
  buildAuditBusinessFlow,
  buildAuditLeadCapturePacket,
  PASS1694_AUDIT_BUSINESS_FLOW_ID,
} from "@/lib/security/audit-business-flow";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") ?? "en";
  const id = url.searchParams.get("id") ?? "sample";
  const flow = buildAuditBusinessFlow(locale, id);
  return NextResponse.json({
    ok: true,
    surface: "velmere-audit-watch-business-flow",
    flow,
    leadPacket: buildAuditLeadCapturePacket(id, locale),
    pricingRoute: `/${flow.locale}/security/audits/pricing`,
    boundary: [
      "review/pre-audit only",
      "no regulatory certification",
      "no guarantee of safety",
      "no custody",
      "no seed phrases",
      "no investment advice",
      "active testing requires authorization",
    ],
  }, {
    headers: {
      "x-velmere-audit-business-flow": PASS1694_AUDIT_BUSINESS_FLOW_ID,
      "x-velmere-audit-no-certified-safe": "true",
      "x-velmere-audit-no-seed-custody": "true",
    },
  });
}
