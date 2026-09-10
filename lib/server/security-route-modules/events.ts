import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { verifySecurityAdminToken } from "@/lib/security/security-admin-auth";
import { securityJson, sanitizeBoundedParam } from "@/lib/security/api-guard";
import { buildSecurityEventLedgerSnapshot, listSecurityEvents, type SecurityEventSeverity } from "@/lib/security/security-event-ledger";

const allowedSeverity = new Set<SecurityEventSeverity | "all">(["all", "info", "review", "elevated", "blocked"]);

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "security-events",
    queryParam: "severity",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  const admin = verifySecurityAdminToken(request, ["security:events"]);
  if (!admin.ok) return admin.response;

  const url = new URL(request.url);
  const rawSeverity = sanitizeBoundedParam(url.searchParams.get("severity"), { maxLength: 16, fallback: "all" }) as SecurityEventSeverity | "all";
  const severity = allowedSeverity.has(rawSeverity) ? rawSeverity : "all";
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? 40) || 40, 100));

  return securityJson({
    ok: true,
    ...buildSecurityEventLedgerSnapshot(),
    filtered: {
      severity,
      limit,
      events: listSecurityEvents({ severity, limit }),
    },
    securityAdminGate: admin.snapshot,
    operator: admin.operator,
    ...abuseShieldResponseMeta(shield),
  });
}
