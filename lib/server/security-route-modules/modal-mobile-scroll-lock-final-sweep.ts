import { buildPass2205ModalMobileScrollLockFinalSweepSummary } from "@/lib/worldclass/modal-mobile-scroll-lock-final-sweep";
import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength, securityJson } from "@/lib/security/api-guard";
import {
  verifySecurityAdminMutationAssertionAfterToken,
  verifySecurityAdminToken,
} from "@/lib/security/security-admin-auth";
import { rejectUnexpectedRequestBody } from "@/lib/security/payment-webhook-guard";

const PASS2205_AUDIT_BOUNDARY =
  "modal-mobile-scroll-lock-final-sweep: admin/security endpoint for modal mobile and scroll-lock visual proof state, no secrets, no PII, no raw provider or checkout payloads";

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "modal-mobile-scroll-lock-final-sweep",
    queryParam: "q",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  const admin = verifySecurityAdminToken(request, ["security:events"]);
  if (!admin.ok) return admin.response;

  return securityJson({
    ok: true,
    auditBoundary: PASS2205_AUDIT_BOUNDARY,
    report: buildPass2205ModalMobileScrollLockFinalSweepSummary(),
    securityAdminGate: admin.snapshot,
    operator: admin.operator,
    ...abuseShieldResponseMeta(shield),
  });
}

export async function POST(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 16 * 1024);
  if (sizeGuard) return sizeGuard;

  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: true });
  if (originGuard) return originGuard;

  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: "modal-mobile-scroll-lock-final-sweep-write",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const bodyGuard = await rejectUnexpectedRequestBody(request);
  if (bodyGuard) return bodyGuard;

  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "modal-mobile-scroll-lock-final-sweep-write",
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

  return securityJson({
    ok: true,
    auditBoundary: PASS2205_AUDIT_BOUNDARY,
    report: buildPass2205ModalMobileScrollLockFinalSweepSummary(),
    securityAdminGate: adminToken.snapshot,
    operator: admin.operator,
    ...abuseShieldResponseMeta(shield),
  });
}
