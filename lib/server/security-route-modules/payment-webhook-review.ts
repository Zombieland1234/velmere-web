import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { securityJson } from "@/lib/security/api-guard";
import { verifySecurityAdminToken } from "@/lib/security/security-admin-auth";
import { buildPaymentWebhookSecuritySnapshot } from "@/lib/security/payment-webhook-security";

const PASS2177_AUDIT_LEDGER_BOUNDARY = "pass2177-audit-ledger-boundary: admin/security route is authenticated, redacted and queued for durable audit receipts where mutation occurs";

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "payment-webhook-review",
    queryParam: "q",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  const admin = verifySecurityAdminToken(request, ["security:events"]);
  if (!admin.ok) return admin.response;

  return securityJson({
    ok: true,
    auditBoundary: PASS2177_AUDIT_LEDGER_BOUNDARY,
    ...buildPaymentWebhookSecuritySnapshot(),
    securityAdminGate: admin.snapshot,
    operator: admin.operator,
    ...abuseShieldResponseMeta(shield),
  });
}
