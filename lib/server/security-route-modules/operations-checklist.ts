import { applyApiAbuseShield, publicAbuseShieldResponseMeta } from "@/lib/security/api-abuse-shield";
import { securityJson } from "@/lib/security/api-guard";
import { buildPublicSecurityStatus } from "@/lib/security/public-security-status";

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "security-operations-checklist",
    queryParam: "q",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  return securityJson({
    ok: true,
    route: "security_operations_public_status",
    ...buildPublicSecurityStatus(),
    ...publicAbuseShieldResponseMeta(),
  });
}
