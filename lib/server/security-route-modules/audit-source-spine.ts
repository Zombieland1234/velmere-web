import { NextResponse } from "next/server";
import { buildPass2569AuditSourceSpine, PASS2569_AUDIT_SOURCE_SPINE_ID } from "@/lib/security/audit-source-spine";

function cleanLocale(value: string | null) {
  const locale = String(value ?? "en").trim().toLowerCase();
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = cleanLocale(url.searchParams.get("locale"));
  const spine = buildPass2569AuditSourceSpine(locale);

  return NextResponse.json(
    {
      ok: true,
      surface: "velmere-audit-source-spine",
      spine,
      rule: "Basic is a free limited prescreen; Pro is invitation-only automated beta; Advanced is NOT_FOR_SALE and includes no human review or operator sign-off.",
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-velmere-audit-source-spine": PASS2569_AUDIT_SOURCE_SPINE_ID,
        "x-velmere-no-seed-phrase": "true",
        "x-velmere-no-exploit-instructions": "true",
      },
    },
  );
}
