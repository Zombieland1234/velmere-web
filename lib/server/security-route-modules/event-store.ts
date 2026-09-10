import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { securityJson } from "@/lib/security/api-guard";
import { verifySecurityAdminToken } from "@/lib/security/security-admin-auth";
import { buildSecurityEventStoreSnapshot } from "@/lib/security/security-event-store-contract";
import { buildSecurityEventAppendReadiness } from "@/lib/security/security-event-append-adapter";
import { buildSecurityAdminAuditSnapshot } from "@/lib/security/security-admin-audit";

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "security-event-store",
    queryParam: "q",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  const admin = verifySecurityAdminToken(request, ["security:events"]);
  if (!admin.ok) return admin.response;

  return securityJson({
    ok: true,
    ...buildSecurityEventStoreSnapshot(),
    eventAppendAdapter: buildSecurityEventAppendReadiness(),
    appendAdapter: buildSecurityEventAppendReadiness(),
    securityAdminAudit: buildSecurityAdminAuditSnapshot(),
    securityAdminGate: admin.snapshot,
    operator: admin.operator,
    ...abuseShieldResponseMeta(shield),
  });
}
