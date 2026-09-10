import { buildPass2230AdvancedPaidSmoke, PASS2230_ADVANCED_PAID_SMOKE_ID } from "@/lib/commerce/advanced-paid-smoke";
import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength, securityJson } from "@/lib/security/api-guard";
import {
  verifySecurityAdminMutationAssertionAfterToken,
  verifySecurityAdminToken,
} from "@/lib/security/security-admin-auth";
import { rejectUnexpectedRequestBody } from "@/lib/security/payment-webhook-guard";

const PASS2230_AUDIT_BOUNDARY =
  "pass2230-advanced-entitlement-smoke: admin-only paid Advanced smoke matrix; no secrets or raw Stripe payloads are exposed" as const;

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "pass2230-advanced-entitlement-smoke",
    queryParam: "q",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  const admin = verifySecurityAdminToken(request, ["security:events"]);
  if (!admin.ok) return admin.response;

  const smoke = buildPass2230AdvancedPaidSmoke();
  return securityJson(
    {
      ok: smoke.status !== "FAIL",
      auditBoundary: PASS2230_AUDIT_BOUNDARY,
      pass2230: PASS2230_ADVANCED_PAID_SMOKE_ID,
      smoke,
      securityAdminGate: admin.snapshot,
      operator: admin.operator,
      ...abuseShieldResponseMeta(shield),
    },
    { status: smoke.status === "FAIL" ? 424 : 200 },
  );
}

export async function POST(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 8 * 1024);
  if (sizeGuard) return sizeGuard;

  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: true });
  if (originGuard) return originGuard;

  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: "pass2230-advanced-entitlement-smoke-write",
    limit: 8,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const bodyGuard = await rejectUnexpectedRequestBody(request);
  if (bodyGuard) return bodyGuard;

  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "pass2230-advanced-entitlement-smoke-write",
    queryParam: "q",
    allowEmptyQuery: true,
    allowedMethods: ["POST"],
  });
  if (!shield.ok) return shield.response;

  const adminToken = verifySecurityAdminToken(request, ["security:events"], undefined, {
    deferBodyBoundMutationAssertion: true,
  });
  if (!adminToken.ok) return adminToken.response;
  const admin = await verifySecurityAdminMutationAssertionAfterToken({
    request,
    requiredScopes: ["security:events"],
    operatorRequirement: { role: "security_admin", requirePhishingResistantMfa: true },
    requestBody: {},
  });
  if (!admin.ok) return admin.response;

  const smoke = buildPass2230AdvancedPaidSmoke();
  return securityJson(
    {
      ok: smoke.status !== "FAIL",
      auditBoundary: PASS2230_AUDIT_BOUNDARY,
      pass2230: PASS2230_ADVANCED_PAID_SMOKE_ID,
      smoke,
      securityAdminGate: adminToken.snapshot,
      operator: admin.operator,
      ...abuseShieldResponseMeta(shield),
    },
    { status: smoke.status === "FAIL" ? 424 : 200 },
  );
}
