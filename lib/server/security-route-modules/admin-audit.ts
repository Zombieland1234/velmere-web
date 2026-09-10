import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { securityJson } from "@/lib/security/api-guard";
import { verifySecurityAdminToken } from "@/lib/security/security-admin-auth";
import { buildSecurityAdminAuditSnapshot, listSecurityAdminAuditEvents } from "@/lib/security/security-admin-audit";

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "security-admin-audit",
    queryParam: "q",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  const admin = verifySecurityAdminToken(request, ["security:events"]);
  if (!admin.ok) return admin.response;

  return securityJson({
    ok: true,
    ...buildSecurityAdminAuditSnapshot(),
    filtered: {
      limit: 60,
      events: listSecurityAdminAuditEvents(60),
    },
    securityAdminGate: admin.snapshot,
    operator: admin.operator,
    ...abuseShieldResponseMeta(shield),
  });
}
