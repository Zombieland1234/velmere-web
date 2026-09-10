import { ASCII_CONTROL_OR_ANGLE_PATTERN } from "../../security/ascii-control-characters";

import { NextResponse } from "next/server";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength } from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import {
  verifySecurityAdminMutationAssertionAfterToken,
  verifySecurityAdminToken,
  verifySecurityApproverToken,
} from "@/lib/security/security-admin-auth";
import { readVlmPaidEntitlementForOperations } from "@/lib/commerce/vlm-entitlement-ledger";
import { isVlmPaidEntitlementPrivileged } from "@/lib/commerce/vlm-entitlement-lifecycle";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  approveAdvancedAuditReleaseEnvelope,
  buildAdvancedAuditReleaseEnvelope,
  isAdvancedAuditReleaseEnvelope,
  PASS4801_ADVANCED_AUDIT_RELEASE_ENVELOPE_ID,
  revokeAdvancedAuditReleaseEnvelope,
  verifyAdvancedAuditReleaseEnvelope,
} from "@/lib/security/advanced-audit-release-envelope";
import { recordAdvancedAuditReleaseTransition } from "@/lib/security/advanced-audit-release-store";
import { getAuditCaseForOwningAccount } from "@/lib/security/audit-intake-case-vault";
import { readAuditReportSnapshotForDelivery } from "@/lib/security/audit-report-snapshot-store";
import { getAuditReviewCustomerProjection } from "@/lib/security/audit-review-orchestration";
import { publicApiError } from "@/lib/security/api-error-envelope";

type RevokeReason = "refund" | "chargeback" | "manual_revoke" | "evidence_recalled";

type ApprovePayload = Partial<{
  envelope: unknown;
  entitlementRef: string;
  accountRef: string;
  approvalSignature: string;
  approvalReceiptId: string;
  approvalPayloadHash: string;
  approvedAt: string;
}>;

type RevokePayload = Partial<{
  envelope: unknown;
  reason: RevokeReason;
}>;

type ReleasePayload = Partial<{
  caseRef: string;
  reportId: string;
  target: string;
  accountRef: string;
  entitlementRef: string;
  entitlementState: "active" | "expired" | "refunded" | "chargeback" | "revoked";
  paymentVerified: boolean;
  scopeConsentVerified: boolean;
  evidenceReadinessMet: boolean;
  redactionPassed: boolean;
  evidencePacketId: string;
  payloadHash: string;
  sourceReceiptRoot: string;
  pdfDigest: string;
  expiresInMinutes: number;
}>;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(ASCII_CONTROL_OR_ANGLE_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function advancedEntitlementState(status: string): "active" | "expired" | "refunded" | "chargeback" | "revoked" {
  if (status === "paid" || status === "active") return "active";
  if (status === "expired") return "expired";
  if (status === "refunded") return "refunded";
  return "revoked";
}

async function resolveAdvancedEntitlement(entitlementRef: string, accountRef: string) {
  const lookup = await readVlmPaidEntitlementForOperations(entitlementRef);
  if (!lookup.ok) return lookup;
  if (lookup.entitlement.productId !== "vlm_advanced_audit_human_review") {
    return { ok: false as const, error: "advanced_entitlement_product_mismatch", retryable: false };
  }
  const expectedAccountHash = lookup.entitlement.context.accountIdHash;
  const suppliedAccountHash = hashVelmereAccountBinding(accountRef);
  if (!expectedAccountHash || !suppliedAccountHash || expectedAccountHash !== suppliedAccountHash) {
    return { ok: false as const, error: "advanced_entitlement_account_mismatch", retryable: false };
  }
  return lookup;
}

export async function POST(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 64 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: true });
  if (originGuard) return originGuard;
  const rate = await applyApiRateLimit(request, { keyPrefix: "pass4801-advanced-audit-release", limit: 20, windowMs: 60_000 });
  if (!rate.ok) return rate.response;

  const adminToken = verifySecurityAdminToken(request, ["security:events", "security:export"], undefined, { deferBodyBoundMutationAssertion: true });
  if (!adminToken.ok) return adminToken.response;
  const parsed = await readBoundedJsonBody<ReleasePayload>(request, 64 * 1024, { maxDepth: 10 });
  if (!parsed.ok) return parsed.response;
  const admin = await verifySecurityAdminMutationAssertionAfterToken({
    request,
    requiredScopes: ["security:events", "security:export"],
    operatorRequirement: { role: "security_admin", requirePhishingResistantMfa: true },
    requestBody: parsed.value,
  });
  if (!admin.ok) return admin.response;

  const secret = process.env.VELMERE_ADVANCED_RELEASE_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    return NextResponse.json({ ok: false, error: "advanced_release_secret_not_configured" }, { status: 503, headers: { "cache-control": "no-store" } });
  }

  try {
    const value = parsed.value;
    const entitlementRef = clean(value.entitlementRef, 180);
    const accountRef = clean(value.accountRef, 180);
    const entitlementLookup = await resolveAdvancedEntitlement(entitlementRef, accountRef);
    if (!entitlementLookup.ok) {
      return NextResponse.json(
        { ok: false, error: entitlementLookup.error },
        { status: entitlementLookup.retryable ? 503 : entitlementLookup.error === "entitlement_not_found" ? 404 : 409, headers: { "cache-control": "no-store" } },
      );
    }
    const entitlementActive = isVlmPaidEntitlementPrivileged(entitlementLookup.entitlement);
    const caseRef = clean(value.caseRef, 48).toUpperCase();
    const auditCase = await getAuditCaseForOwningAccount({ caseRef, accountId: accountRef });
    if (!auditCase.ok || !auditCase.record) {
      return NextResponse.json({ ok: false, error: "advanced_audit_case_not_found_or_not_owned" }, { status: 404, headers: { "cache-control": "no-store" } });
    }
    const record = auditCase.record;
    if (record.tier !== "advanced" || record.entitlementId !== entitlementRef || !record.entitlementVerified || record.status !== "queued_paid_review") {
      return NextResponse.json({ ok: false, error: "advanced_audit_case_entitlement_binding_invalid" }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const suppliedTarget = clean(value.target, 600);
    if (suppliedTarget && suppliedTarget !== record.target.canonicalTarget) {
      return NextResponse.json({ ok: false, error: "advanced_audit_case_target_mismatch" }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const requestedReportId = clean(value.reportId, 120).replace(/[^a-zA-Z0-9:._-]+/g, "-");

    // V17/P76 release authority: Advanced delivery may consume only a snapshot
    // already committed by the atomically completed advanced_automation worker.
    // This route must never build, rerun providers or persist a replacement snapshot.
    const review = await getAuditReviewCustomerProjection(record);
    if (!review.available) {
      return NextResponse.json({ ok: false, error: review.error ?? "advanced_automation_state_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    if (review.processingMode !== "advanced_automation" || review.state !== "completed" || review.automationLeaseActive || !review.sla.completedAt) {
      return NextResponse.json({
        ok: false,
        error: "advanced_automation_not_completed",
        processingMode: review.processingMode,
        state: review.state,
        automationLeaseActive: review.automationLeaseActive,
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const existingSnapshot = await readAuditReportSnapshotForDelivery({
      caseRef: record.caseRef,
      accountId: accountRef,
      entitlementId: entitlementRef,
      tier: "advanced",
    });
    if (!existingSnapshot.ok) {
      return NextResponse.json(
        { ok: false, error: existingSnapshot.error, retryable: existingSnapshot.retryable },
        { status: existingSnapshot.retryable ? 503 : 409, headers: { "cache-control": "no-store" } },
      );
    }
    if (requestedReportId && existingSnapshot.record.reportId !== requestedReportId) {
      return NextResponse.json({ ok: false, error: "advanced_release_report_id_mismatch" }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const reportRecord = existingSnapshot.record;
    if (!reportRecord.snapshot.evidenceReadiness.advancedReady) {
      return NextResponse.json({
        ok: false,
        error: "advanced_paid_evidence_not_ready",
        reasons: reportRecord.snapshot.evidenceReadiness.reasons,
        evidenceRoots: reportRecord.snapshot.evidenceRoots,
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const suppliedBindings = [
      ["evidencePacketId", clean(value.evidencePacketId, 220), reportRecord.snapshot.canonicalEvidencePacketId],
      ["payloadHash", clean(value.payloadHash, 80), reportRecord.snapshotDigest],
      ["sourceReceiptRoot", clean(value.sourceReceiptRoot, 80), reportRecord.sourceReceiptRoot],
      ["pdfDigest", clean(value.pdfDigest, 80), reportRecord.pdfDigest],
    ] as const;
    const staleBinding = suppliedBindings.find(([, supplied, expected]) => supplied && supplied !== expected);
    if (staleBinding) {
      return NextResponse.json({ ok: false, error: "advanced_release_snapshot_binding_mismatch", field: staleBinding[0] }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const envelope = buildAdvancedAuditReleaseEnvelope({
      secret,
      keyId: process.env.VELMERE_ADVANCED_RELEASE_KEY_ID?.trim() || "advanced-release-v2",
      caseRef: record.caseRef,
      target: record.target.canonicalTarget,
      accountRef,
      entitlementRef,
      entitlementState: advancedEntitlementState(entitlementLookup.entitlement.status),
      paymentVerified: entitlementActive && entitlementLookup.entitlement.paymentStatus === "paid",
      scopeConsentVerified: value.scopeConsentVerified === true,
      evidenceReadinessMet: value.evidenceReadinessMet === true && reportRecord.snapshot.evidenceReadiness.advancedReady,
      redactionPassed: value.redactionPassed === true,
      evidencePacketId: reportRecord.snapshot.canonicalEvidencePacketId,
      payloadHash: reportRecord.snapshotDigest,
      sourceReceiptRoot: reportRecord.sourceReceiptRoot,
      pdfDigest: reportRecord.pdfDigest,
      automationCompleted: review.state === "completed",
      automationLeaseActive: review.automationLeaseActive,
      immutableSnapshotBound: reportRecord.tier === "advanced" && reportRecord.caseRef === record.caseRef && reportRecord.entitlementId === entitlementRef,
      automationCompletedAt: review.sla.completedAt,
      expiresInMinutes: Number(value.expiresInMinutes ?? 24 * 60),
    });
    const verification = verifyAdvancedAuditReleaseEnvelope({ envelope, secret });
    const storage = await recordAdvancedAuditReleaseTransition({
      transition: "issued",
      envelope,
      entitlementRef,
      eventId: `advanced-release:${envelope.releaseId}:issued:${envelope.signature?.value ?? "unsigned"}`,
    });
    if (!storage.ok) {
      return NextResponse.json(
        { ok: false, error: storage.error, retryable: storage.retryable },
        { status: storage.retryable ? 503 : 409, headers: { "cache-control": "no-store" } },
      );
    }
    return NextResponse.json({
      ok: verification.deliverable && storage.ok && storage.state === "ready",
      passId: PASS4801_ADVANCED_AUDIT_RELEASE_ENVELOPE_ID,
      envelope,
      verification,
      storage,
      reportBinding: {
        reportId: reportRecord.reportId,
        reportVersionHash: reportRecord.reportVersionHash,
        snapshotDigest: reportRecord.snapshotDigest,
        sourceReceiptRoot: reportRecord.sourceReceiptRoot,
        pdfDigest: reportRecord.pdfDigest,
        pdfByteLength: reportRecord.pdfByteLength,
        renderContractId: reportRecord.renderContractId,
        exactPdfStorage: "render_once_immutable_blob",
        strictQuorumMet: reportRecord.snapshot.providerTruth.strictQuorumMet,
        paidEvidenceReady: reportRecord.snapshot.evidenceReadiness.advancedReady,
        independentUpstreamRoots: reportRecord.snapshot.providerTruth.independentUpstreamRoots,
        evidenceRoots: reportRecord.snapshot.evidenceRoots,
        layoutDigest: reportRecord.snapshot.layout.layoutDigest,
        storageMode: reportRecord.storageMode,
      },
      boundary: "Advanced issuance is automation-bound: release requires completed advanced_automation, no active lease and an already-existing immutable account/entitlement-bound snapshot. Admin authentication protects this internal mutation endpoint but creates no human-review product or release credit.",
    }, {
      status: verification.deliverable && storage.state === "ready" ? 200 : 409,
      headers: {
        "cache-control": "no-store",
        "x-velmere-pass4801-advanced-release": PASS4801_ADVANCED_AUDIT_RELEASE_ENVELOPE_ID,
      },
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/admin/security/advanced-audit-release",
      code: "advanced_release_failed",
      status: 400,
    });
  }
}

export async function PUT(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 96 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: true });
  if (originGuard) return originGuard;
  const rate = await applyApiRateLimit(request, { keyPrefix: "pass4802-advanced-audit-approve", limit: 20, windowMs: 60_000 });
  if (!rate.ok) return rate.response;

  const approverToken = verifySecurityApproverToken(request);
  if (!approverToken.ok) return approverToken.response;
  const parsed = await readBoundedJsonBody<ApprovePayload>(request, 96 * 1024, { maxDepth: 14 });
  if (!parsed.ok) return parsed.response;
  const approver = await verifySecurityAdminMutationAssertionAfterToken({
    request,
    requiredScopes: ["security:events", "security:export"],
    operatorRequirement: { role: "independent_approver", requirePhishingResistantMfa: true },
    requestBody: parsed.value,
  });
  if (!approver.ok) return approver.response;

  const secret = process.env.VELMERE_ADVANCED_RELEASE_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    return NextResponse.json({ ok: false, error: "advanced_release_secret_not_configured" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!isAdvancedAuditReleaseEnvelope(parsed.value.envelope)) {
    return NextResponse.json({ ok: false, error: "advanced_release_envelope_invalid" }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  try {
    const entitlementRef = clean(parsed.value.entitlementRef, 180);
    const accountRef = clean(parsed.value.accountRef, 180);
    if (sha256Digest(entitlementRef.toLowerCase()) !== parsed.value.envelope.entitlementRefHash
      || sha256Digest(accountRef.toLowerCase()) !== parsed.value.envelope.accountRefHash) {
      return NextResponse.json({ ok: false, error: "advanced_release_identity_binding_mismatch" }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const entitlementLookup = await resolveAdvancedEntitlement(entitlementRef, accountRef);
    if (!entitlementLookup.ok) {
      return NextResponse.json(
        { ok: false, error: entitlementLookup.error },
        { status: entitlementLookup.retryable ? 503 : entitlementLookup.error === "entitlement_not_found" ? 404 : 409, headers: { "cache-control": "no-store" } },
      );
    }
    if (!isVlmPaidEntitlementPrivileged(entitlementLookup.entitlement)) {
      return NextResponse.json({ ok: false, error: "advanced_entitlement_inactive" }, { status: 409, headers: { "cache-control": "no-store" } });
    }

    // PASS4806 approval-time binding: the second reviewer must approve the
    // current immutable report truth, not merely a structurally valid or old
    // signed envelope supplied by the caller. This re-read verifies the exact
    // stored PDF bytes, digest and length before any ready transition is recorded.
    const reportSnapshot = await readAuditReportSnapshotForDelivery({
      caseRef: parsed.value.envelope.caseRef,
      accountId: accountRef,
      entitlementId: entitlementRef,
      tier: "advanced",
    });
    if (!reportSnapshot.ok) {
      return NextResponse.json(
        { ok: false, error: reportSnapshot.error, retryable: reportSnapshot.retryable },
        { status: reportSnapshot.retryable ? 503 : 409, headers: { "cache-control": "no-store" } },
      );
    }
    const report = reportSnapshot.record;
    if (!report.snapshot.evidenceReadiness.advancedReady) {
      return NextResponse.json(
        { ok: false, error: "advanced_paid_evidence_not_ready", reasons: report.snapshot.evidenceReadiness.reasons },
        { status: 409, headers: { "cache-control": "no-store" } },
      );
    }
    if (report.snapshotDigest !== parsed.value.envelope.payloadHash
      || report.sourceReceiptRoot !== parsed.value.envelope.sourceReceiptRoot
      || report.pdfDigest !== parsed.value.envelope.pdfDigest
      || report.snapshot.canonicalEvidencePacketId !== parsed.value.envelope.evidencePacketId
      || report.caseRef !== parsed.value.envelope.caseRef
      || report.tier !== "advanced") {
      return NextResponse.json(
        { ok: false, error: "advanced_release_snapshot_binding_mismatch" },
        { status: 409, headers: { "cache-control": "no-store" } },
      );
    }

    const envelope = approveAdvancedAuditReleaseEnvelope({
      envelope: parsed.value.envelope,
      secret,
      approverId: approver.operator.id,
      approverSignature: clean(parsed.value.approvalSignature, 220),
      approvalReceiptId: clean(parsed.value.approvalReceiptId, 160),
      approvalPayloadHash: clean(parsed.value.approvalPayloadHash, 80) || null,
      approvedAt: clean(parsed.value.approvedAt, 64) || undefined,
      keyId: process.env.VELMERE_ADVANCED_RELEASE_KEY_ID?.trim() || parsed.value.envelope.signature?.keyId || "advanced-release-v2",
    });
    const verification = verifyAdvancedAuditReleaseEnvelope({ envelope, secret });
    const storage = await recordAdvancedAuditReleaseTransition({
      transition: "approved",
      envelope,
      eventId: `advanced-release:${envelope.releaseId}:approved:${clean(parsed.value.approvalReceiptId, 160)}`,
    });
    if (!storage.ok) {
      return NextResponse.json(
        { ok: false, error: storage.error, retryable: storage.retryable },
        { status: storage.retryable ? 503 : 409, headers: { "cache-control": "no-store" } },
      );
    }
    return NextResponse.json({
      ok: verification.deliverable && storage.state === "ready",
      passId: PASS4801_ADVANCED_AUDIT_RELEASE_ENVELOPE_ID,
      envelope,
      verification,
      storage,
      boundary: "Optional internal QA annotation may be attached only to an already deliverable automated envelope. It cannot clear blockers, create ready state or become a customer entitlement/release prerequisite.",
    }, {
      status: verification.deliverable && storage.state === "ready" ? 200 : 409,
      headers: {
        "cache-control": "no-store",
        "x-velmere-pass4802-optional-qa": "non-gating",
      },
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/admin/security/advanced-audit-release",
      code: "advanced_release_approval_failed",
      status: 400,
    });
  }
}

export async function PATCH(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 96 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: true });
  if (originGuard) return originGuard;
  const rate = await applyApiRateLimit(request, { keyPrefix: "pass4801-advanced-audit-revoke", limit: 20, windowMs: 60_000 });
  if (!rate.ok) return rate.response;

  const adminToken = verifySecurityAdminToken(request, ["security:events", "security:export"], undefined, { deferBodyBoundMutationAssertion: true });
  if (!adminToken.ok) return adminToken.response;
  const parsed = await readBoundedJsonBody<RevokePayload>(request, 96 * 1024, { maxDepth: 14 });
  if (!parsed.ok) return parsed.response;
  const admin = await verifySecurityAdminMutationAssertionAfterToken({
    request,
    requiredScopes: ["security:events", "security:export"],
    operatorRequirement: { role: "security_admin", requirePhishingResistantMfa: true },
    requestBody: parsed.value,
  });
  if (!admin.ok) return admin.response;

  const secret = process.env.VELMERE_ADVANCED_RELEASE_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    return NextResponse.json({ ok: false, error: "advanced_release_secret_not_configured" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const reason = parsed.value.reason;
  if (reason !== "refund" && reason !== "chargeback" && reason !== "manual_revoke" && reason !== "evidence_recalled") {
    return NextResponse.json({ ok: false, error: "advanced_release_revoke_reason_invalid" }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  if (!isAdvancedAuditReleaseEnvelope(parsed.value.envelope)) {
    return NextResponse.json({ ok: false, error: "advanced_release_envelope_invalid" }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const currentVerification = verifyAdvancedAuditReleaseEnvelope({ envelope: parsed.value.envelope, secret });
  if (!currentVerification.integrityValid) {
    return NextResponse.json({ ok: false, error: "advanced_release_integrity_invalid", verification: currentVerification }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  const envelope = revokeAdvancedAuditReleaseEnvelope({
    envelope: parsed.value.envelope,
    secret,
    reason,
    keyId: process.env.VELMERE_ADVANCED_RELEASE_KEY_ID?.trim() || parsed.value.envelope.signature?.keyId || "advanced-release-v2",
  });
  const verification = verifyAdvancedAuditReleaseEnvelope({ envelope, secret });
  const storage = await recordAdvancedAuditReleaseTransition({
    transition: "revoked",
    envelope,
    eventId: `advanced-release:${envelope.releaseId}:revoked:${reason}`,
  });
  if (!storage.ok) {
    return NextResponse.json(
      { ok: false, error: storage.error, retryable: storage.retryable },
      { status: storage.retryable ? 503 : 409, headers: { "cache-control": "no-store" } },
    );
  }
  return NextResponse.json({
    ok: verification.integrityValid && envelope.state === "revoked" && storage.state === "revoked",
    passId: PASS4801_ADVANCED_AUDIT_RELEASE_ENVELOPE_ID,
    envelope,
    verification,
    storage,
    boundary: "Refund, chargeback, manual revoke or evidence recall durably invalidates Advanced delivery and active artifact tokens while preserving a newly signed revocation envelope.",
  }, {
    status: verification.integrityValid && envelope.state === "revoked" && storage.state === "revoked" ? 200 : 409,
    headers: {
      "cache-control": "no-store",
      "x-velmere-pass4801-advanced-release": PASS4801_ADVANCED_AUDIT_RELEASE_ENVELOPE_ID,
    },
  });
}
