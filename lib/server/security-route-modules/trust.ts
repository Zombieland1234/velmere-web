import { applyApiAbuseShield, publicAbuseShieldResponseMeta } from "@/lib/security/api-abuse-shield";
import { sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";
import { buildSecurityTrustSnapshot } from "@/lib/security/security-trust-copy";
import { buildPublicSecurityStatus } from "@/lib/security/public-security-status";

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "security-trust",
    queryParam: "locale",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  const url = new URL(request.url);
  const locale = sanitizeBoundedParam(url.searchParams.get("locale"), { maxLength: 8, fallback: "en" });

  return securityJson({
    ok: true,
    ...buildSecurityTrustSnapshot(locale),
    releaseStatus: buildPublicSecurityStatus(),
    ...publicAbuseShieldResponseMeta(),
  });
}
