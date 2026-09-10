import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength, securityJson } from "@/lib/security/api-guard";
import {
  verifySecurityAdminMutationAssertionAfterToken,
  verifySecurityAdminToken,
} from "@/lib/security/security-admin-auth";
import { rejectUnexpectedRequestBody } from "@/lib/security/payment-webhook-guard";
import { buildPass2180AdvancedEntitlementReadiness, assertPass2180StripeClientReadiness } from "@/lib/commerce/stripe-advanced-entitlement-proof";
import { getVlmPaidEntitlementRuntimeMode, PASS2223_ADVANCED_ENTITLEMENT_HARDENING_ID } from "@/lib/commerce/vlm-entitlement-ledger";

const PASS2180_AUDIT_BOUNDARY =
  "stripe-advanced-entitlement-proof: admin-only proof endpoint; verifies paid Advanced readiness and production fail-closed entitlement rules without exposing secrets";

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "pass2180-advanced-entitlement-proof",
    queryParam: "q",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  const admin = verifySecurityAdminToken(request, ["security:events"]);
  if (!admin.ok) return admin.response;

  const readiness = buildPass2180AdvancedEntitlementReadiness();
  const stripeClient = assertPass2180StripeClientReadiness();
  return securityJson({
    ok: readiness.status === "PASS",
    auditBoundary: PASS2180_AUDIT_BOUNDARY,
    readiness,
    stripeClient,
    pass2223: PASS2223_ADVANCED_ENTITLEMENT_HARDENING_ID,
    runtimeMode: getVlmPaidEntitlementRuntimeMode(),
    failClosed: getVlmPaidEntitlementRuntimeMode().durableRequired,
    securityAdminGate: admin.snapshot,
    operator: admin.operator,
    ...abuseShieldResponseMeta(shield),
  }, { status: readiness.status === "PASS" ? 200 : 424 });
}

export async function POST(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 8 * 1024);
  if (sizeGuard) return sizeGuard;

  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: true });
  if (originGuard) return originGuard;

  const localRateLimit = await applyApiRateLimit(request, {
    keyPrefix: "pass2180-advanced-entitlement-proof-write",
    limit: 8,
    windowMs: 60_000,
  });
  if (!localRateLimit.ok) return localRateLimit.response;

  const bodyGuard = await rejectUnexpectedRequestBody(request);
  if (bodyGuard) return bodyGuard;

  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "pass2180-advanced-entitlement-proof-write",
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

  const readiness = buildPass2180AdvancedEntitlementReadiness();
  const stripeClient = assertPass2180StripeClientReadiness();
  return securityJson({
    ok: readiness.status === "PASS" && stripeClient.ok,
    auditBoundary: PASS2180_AUDIT_BOUNDARY,
    proof: readiness,
    stripeClient,
    pass2223: PASS2223_ADVANCED_ENTITLEMENT_HARDENING_ID,
    runtimeMode: getVlmPaidEntitlementRuntimeMode(),
    failClosed: getVlmPaidEntitlementRuntimeMode().durableRequired,
    securityAdminGate: adminToken.snapshot,
    operator: admin.operator,
    ...abuseShieldResponseMeta(shield),
  }, { status: readiness.status === "PASS" && stripeClient.ok ? 200 : 424 });
}
