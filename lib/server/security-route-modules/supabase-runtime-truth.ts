import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength, securityJson } from "@/lib/security/api-guard";
import {
  verifySecurityAdminMutationAssertionAfterToken,
  verifySecurityAdminToken,
} from "@/lib/security/security-admin-auth";
import { buildPass2179SupabaseRuntimeReadiness, runPass2179SupabaseRuntimeTruthProof } from "@/lib/security/supabase-runtime-truth";
import { rejectUnexpectedRequestBody } from "@/lib/security/payment-webhook-guard";

const PASS2179_AUDIT_BOUNDARY =
  "supabase-runtime-truth: admin-only server proof endpoint; writes a redacted mutation receipt and verifies Supabase read-back when service-role env is configured";

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "supabase-runtime-truth",
    queryParam: "q",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  const admin = verifySecurityAdminToken(request, ["security:events"]);
  if (!admin.ok) return admin.response;

  return securityJson({
    ok: true,
    auditBoundary: PASS2179_AUDIT_BOUNDARY,
    readiness: buildPass2179SupabaseRuntimeReadiness(),
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

  const localRateLimit = await applyApiRateLimit(request, {
    keyPrefix: "supabase-runtime-truth-write",
    limit: 8,
    windowMs: 60_000,
  });
  if (!localRateLimit.ok) return localRateLimit.response;

  const bodyGuard = await rejectUnexpectedRequestBody(request);
  if (bodyGuard) return bodyGuard;

  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "supabase-runtime-truth-write",
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

  const proof = await runPass2179SupabaseRuntimeTruthProof({
    request,
    actorId: admin.operator.id,
    actorMode: "admin",
  });

  return securityJson(
    {
      ok: proof.status === "PASS",
      auditBoundary: PASS2179_AUDIT_BOUNDARY,
      proof,
      securityAdminGate: adminToken.snapshot,
      operator: admin.operator,
      ...abuseShieldResponseMeta(shield),
    },
    { status: proof.status === "FAIL" ? 500 : proof.status === "BLOCKED_ENV" ? 424 : 200 },
  );
}
