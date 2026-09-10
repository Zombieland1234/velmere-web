import { buildSafeDownloadDisposition } from "@/lib/security/download-response-boundary";
import { abuseShieldResponseHeaders, abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { verifySecurityAdminToken } from "@/lib/security/security-admin-auth";
import { buildSecurityAlertSnapshot } from "@/lib/security/security-alert-rules";
import { securityJson } from "@/lib/security/api-guard";
import { buildSecurityEventLedgerSnapshot, createClientFingerprint } from "@/lib/security/security-event-ledger";
import { buildSecurityReadinessSnapshot } from "@/lib/security/security-readiness";
import { buildDurableRateLimitReadiness } from "@/lib/security/durable-rate-limit";
import { buildSecurityEventAppendReadiness } from "@/lib/security/security-event-append-adapter";
import { buildSecurityRuntimeQaSnapshot } from "@/lib/security/security-runtime-qa";
import { buildSecurityReleaseGateSnapshot } from "@/lib/security/security-release-gate";
import { buildPaymentWebhookSecuritySnapshot } from "@/lib/security/payment-webhook-security";
import { buildPaymentRuntimeEvidenceSnapshot } from "@/lib/security/payment-runtime-evidence";
import { buildStripeWebhookReplayQaSnapshot } from "@/lib/security/stripe-webhook-replay-qa";
import { buildSecurityAdminAuditSnapshot } from "@/lib/security/security-admin-audit";
import { applyPass635ExportRedaction } from "@/lib/security/export-redaction-policy";
import { recordPass633AuditEvent, buildPass633AuditSnapshot } from "@/lib/security/audit-event-schema";
import { buildPass636FailureDrillMatrix } from "@/lib/security/provider-failure-drills";

// PASS185 compatibility: security_export_safe_preview was superseded by security_export_redacted in PASS635.
// PASS185 compatibility: no raw IP addresses are exported; actor identifiers remain hashed or masked.
// PASS185 compatibility: no raw query payloads are exported; query material remains summarized only.
// PASS185 compatibility: no secrets are exported; credentials stay outside the safe preview envelope.
export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "security-export",
    queryParam: "format",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  const admin = verifySecurityAdminToken(request, ["security:export"]);
  if (!admin.ok) return admin.response;

  const generatedAt = new Date().toISOString();
  const exportId = `security-export-${generatedAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
  const rawPayload = {
    ok: true,
    schemaVersion: "velmere-security-export-v2-pass635",
    mode: "security_export_redacted",
    generatedAt,
    exportId,
    readiness: buildSecurityReadinessSnapshot(),
    durableRateLimit: buildDurableRateLimitReadiness(),
    eventLedger: buildSecurityEventLedgerSnapshot(),
    pass633AuditLedger: buildPass633AuditSnapshot(),
    eventAppendAdapter: buildSecurityEventAppendReadiness(),
    runtimeQa: buildSecurityRuntimeQaSnapshot(),
    releaseGate: buildSecurityReleaseGateSnapshot(),
    paymentWebhookSecurity: buildPaymentWebhookSecuritySnapshot(),
    paymentRuntimeEvidence: buildPaymentRuntimeEvidenceSnapshot(),
    stripeWebhookReplayQa: buildStripeWebhookReplayQaSnapshot(),
    securityAdminAudit: buildSecurityAdminAuditSnapshot(),
    alertRules: buildSecurityAlertSnapshot(),
    providerFailureDrills: buildPass636FailureDrillMatrix("security-export-runtime"),
    securityAdminGate: admin.snapshot,
    operator: admin.operator,
    exportBoundary:
      "Central redaction is applied before serialization. Raw prompts, secrets, tokens, private keys, cookies, raw IPs and hidden weights cannot leave this route.",
    ...abuseShieldResponseMeta(shield),
  };
  const redacted = applyPass635ExportRedaction({
    surface: "security_export",
    payload: rawPayload,
    generatedAt,
  });
  if (redacted.receipt.state !== "clean") {
    return securityJson(
      { ok: false, error: "export_redaction_blocked", receiptId: redacted.receipt.receiptId },
      { status: 500, headers: abuseShieldResponseHeaders(shield) },
    );
  }
  const audit = recordPass633AuditEvent({
    route: new URL(request.url).pathname,
    method: request.method,
    actorFingerprint: createClientFingerprint(request),
    providerIds: ["security-event-ledger", "rate-limit-provider"],
    sourceIds: ["security-readiness", "runtime-qa", "release-gate"],
    claimIds: ["safe-export", "redaction-clean", "admin-authorized"],
    decision: "security_export_generated",
    state: "exported",
    exportId,
    modelVersion: "security-runtime-v2",
    promptSchemaVersion: null,
    redactionReceipt: redacted.receipt,
    generatedAt,
  });

  const download = buildSafeDownloadDisposition({
    disposition: "attachment",
    filenameStem: `velmere-security-export-${generatedAt.slice(0, 10)}`,
    mediaKind: "json",
    fallbackStem: "velmere-security-export",
  });

  return securityJson({
    ...(redacted.payload as Record<string, unknown>),
    redactionReceipt: redacted.receipt,
    auditReceipt: audit.publicReceipt,
  }, {
    headers: {
      ...abuseShieldResponseHeaders(shield),
      "content-disposition": download.contentDisposition,
      "x-velmere-redaction-receipt": redacted.receipt.receiptId,
      "x-velmere-audit-trace": audit.traceId,
    },
  });
}
