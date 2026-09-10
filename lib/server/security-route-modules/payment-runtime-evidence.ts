import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { securityJson } from "@/lib/security/api-guard";
import {
  verifySecurityAdminMutationAssertionAfterToken,
  verifySecurityAdminToken,
} from "@/lib/security/security-admin-auth";
import { recordPaymentRuntimeEvidence } from "@/lib/security/payment-runtime-evidence";
import { buildPass2366PaymentEvidenceSnapshot, parsePaymentEvidenceFilterFromUrl, storePaymentRuntimeEvidenceDurable } from "@/lib/security/durable-payment-evidence-store";
import { appendPass2178MutationReceipt } from "@/lib/security/mutation-receipt-vault";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

const PASS2177_AUDIT_LEDGER_BOUNDARY = "pass2177-audit-ledger-boundary: admin/security route is authenticated, redacted and queued for durable audit receipts where mutation occurs";

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "payment-runtime-evidence",
    queryParam: "q",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  const admin = verifySecurityAdminToken(request, ["security:events"]);
  if (!admin.ok) return admin.response;

  const filter = parsePaymentEvidenceFilterFromUrl(new URL(request.url));
  const snapshot = await buildPass2366PaymentEvidenceSnapshot(filter);

  return securityJson({
    ok: true,
    auditBoundary: PASS2177_AUDIT_LEDGER_BOUNDARY,
    ...snapshot,
    securityAdminGate: admin.snapshot,
    operator: admin.operator,
    ...abuseShieldResponseMeta(shield),
  });
}

export async function POST(request: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(request, 12_000);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(request, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(request, {
    keyPrefix: "pass2177-security-payment-runtime-evidence",
    limit: 20,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "payment-runtime-evidence-write",
    queryParam: "q",
    allowEmptyQuery: true,
    allowedMethods: ["POST"],
  });
  if (!shield.ok) return shield.response;

  const adminToken = verifySecurityAdminToken(request, ["security:events"], undefined, {
    deferBodyBoundMutationAssertion: true,
  });
  if (!adminToken.ok) return adminToken.response;

  const parsedBody = await readBoundedJsonBody<Record<string, unknown>>(request, 12_000, {
    maxDepth: 12,
    requireObject: true,
    rejectDuplicateKeys: true,
    rejectDangerousKeys: true,
  });
  if (!parsedBody.ok) return parsedBody.response;
  const payload = parsedBody.value;
  const admin = await verifySecurityAdminMutationAssertionAfterToken({
    request,
    requiredScopes: ["security:events"],
    operatorRequirement: { role: "security_admin", requirePhishingResistantMfa: true },
    requestBody: payload,
  });
  if (!admin.ok) return admin.response;
  const record = recordPaymentRuntimeEvidence({
    ...(payload && typeof payload === "object" ? payload : {}),
    operator: admin.operator.id,
  });
  const durable = await storePaymentRuntimeEvidenceDurable(record);
  const mutationReceipt = await appendPass2178MutationReceipt({
    request,
    action: "payment_runtime_evidence_record",
    targetType: "payment_runtime_evidence",
    targetId: record.id ?? "payment-runtime-evidence",
    actorId: admin.operator.id,
    actorMode: "admin",
    payload: { area: record.area, status: record.status, operator: admin.operator.id, payloadType: typeof payload, auditQueueId: record.auditQueueId, accountMessageId: record.accountMessageId, durableWrite: durable.durableWrite },
    safeSummary: "Security admin payment runtime evidence wrote a redacted PASS2178 mutation receipt.",
  });

  return securityJson({
    ok: true,
    record,
    mutationReceipt,
    durable,
    snapshot: await buildPass2366PaymentEvidenceSnapshot(),
    securityAdminGate: adminToken.snapshot,
    operator: admin.operator,
    ...abuseShieldResponseMeta(shield),
  });
}
