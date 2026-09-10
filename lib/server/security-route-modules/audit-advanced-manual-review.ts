import { NextResponse } from "next/server";
import { hashVelmereAccountBinding, resolveRequestAccount } from "@/lib/auth/account-session";
import { verifyVlmPaidSurfaceEntitlementById } from "@/lib/commerce/vlm-paid-surface-guard";
import { getAuditCaseForOwningAccount } from "@/lib/security/audit-intake-case-vault";
import { getAuditReviewCustomerProjection } from "@/lib/security/audit-review-orchestration";
import { readAuditReportSnapshotForDelivery } from "@/lib/security/audit-report-snapshot-store";

function cleanCaseRef(value: string | null) {
  const clean = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 48);
  return /^AUD-[A-Z0-9]{8,24}$/.test(clean) ? clean : "";
}

export async function GET(request: Request) {
  const account = await resolveRequestAccount(request);
  if (!account) return NextResponse.json({ ok: false, error: "account_session_required" }, { status: 401, headers: { "cache-control": "no-store" } });

  const url = new URL(request.url);
  const auditCaseRef = cleanCaseRef(url.searchParams.get("auditCaseRef"));
  if (!auditCaseRef) return NextResponse.json({ ok: false, error: "audit_case_ref_required" }, { status: 400, headers: { "cache-control": "no-store" } });

  const auditCase = await getAuditCaseForOwningAccount({ caseRef: auditCaseRef, accountId: account.accountId });
  if (!auditCase.ok || !auditCase.record) return NextResponse.json({ ok: false, error: "audit_case_not_found_or_not_owned" }, { status: 404, headers: { "cache-control": "no-store" } });
  const record = auditCase.record;
  if (record.tier !== "advanced") return NextResponse.json({ ok: false, error: "advanced_audit_case_required" }, { status: 409, headers: { "cache-control": "no-store" } });
  if (!record.entitlementId || !record.entitlementVerified) return NextResponse.json({ ok: false, error: "durable_paid_entitlement_required" }, { status: 402, headers: { "cache-control": "no-store" } });

  const entitlement = await verifyVlmPaidSurfaceEntitlementById({
    policyId: "audit_pdf_download",
    entitlementId: record.entitlementId,
    allowedProductIds: ["vlm_advanced_audit_human_review"],
    accountIdHash: hashVelmereAccountBinding(account.accountId),
    auditCaseRef: record.caseRef,
  });
  if (!entitlement.ok) return NextResponse.json({ ok: false, error: "paid_entitlement_not_verified" }, { status: 402, headers: { "cache-control": "no-store" } });

  const review = await getAuditReviewCustomerProjection(record);
  if (!review.available) return NextResponse.json({ ok: false, error: "review_orchestration_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  if (review.processingMode !== "advanced_automation") return NextResponse.json({ ok: false, error: "audit_automation_processing_mode_mismatch" }, { status: 409, headers: { "cache-control": "no-store" } });

  const snapshot = await readAuditReportSnapshotForDelivery({
    caseRef: record.caseRef,
    accountId: account.accountId,
    entitlementId: record.entitlementId,
    tier: "advanced",
  });
  const evidenceReady = snapshot.ok ? snapshot.record.snapshot.evidenceReadiness.advancedReady : false;
  const deliverable = review.state === "completed" && snapshot.ok && evidenceReady;

  return NextResponse.json({
    ok: true,
    auditCaseRef: record.caseRef,
    requestId: record.requestId,
    processingMode: review.processingMode,
    automationState: review.state,
    release: {
      state: deliverable ? "ready" : review.state === "completed" ? "artifact_pending" : "automation_pending",
      deliverable,
      snapshotAvailable: snapshot.ok,
      evidenceReady,
      reportId: snapshot.ok ? snapshot.record.reportId : null,
      reportVersionHash: snapshot.ok ? snapshot.record.reportVersionHash : null,
      snapshotDigest: snapshot.ok ? snapshot.record.snapshotDigest : null,
      sourceReceiptRoot: snapshot.ok ? snapshot.record.sourceReceiptRoot : null,
      pdfDigest: snapshot.ok ? snapshot.record.pdfDigest : null,
    },
    customerBoundary: "Legacy route alias retained for compatibility. Current Advanced customer status is automation-only; optional internal QA, reviewer assignment, SLA metadata and manual sign-off are not customer release gates or customer-visible features.",
  }, { headers: { "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff" } });
}
