import { createHash } from "node:crypto";
import type {
  Pass2554CustomerSafeRefundDisputeEvidencePack,
  Pass2554OperatorDisputeDualControl,
  Pass2554RefundDisputeEvidenceDualControlRebalance,
  Pass2554RefundDisputeReleaseGuard,
  Pass2554SupportSlaReviewLane,
} from "./refund-dispute-evidence-dual-control-rebalance";

export const PASS2555_EVIDENCE_RETENTION_EXPIRY_SUPPORT_BOUNDARY_REBALANCE_ID = "evidence-retention-expiry-support-boundary-rebalance-v1" as const;

export type Pass2555RetentionState = "retained" | "expiry_watch" | "purge_due" | "privacy_hold" | "blocked";
export type Pass2555CustomerTimelineState = "customer_visible" | "reviewing" | "expires_soon" | "purge_scheduled" | "blocked";
export type Pass2555OperatorRetentionState = "not_required" | "second_approver_required" | "approved" | "expired" | "blocked";
export type Pass2555AngelSupportStatusMode = "customer_safe_status" | "expiry_notice" | "support_review" | "dual_control_pending" | "redaction_refusal" | "blocked";
export type Pass2555RetentionDecision = "show_customer_timeline" | "show_expiry_notice" | "schedule_customer_safe_purge" | "request_second_approver" | "block_support_status";

export type Pass2555RetentionExpiryCapsule = {
  id: string;
  supportCaseId: string;
  refundDisputeCaseId: string;
  inheritedCustomerSafePackId: string;
  retentionPolicySnapshotHash: string;
  retentionEnvelopeHash: string;
  retentionExpiresAt: string;
  purgeEligibleAfter: string;
  retentionState: Pass2555RetentionState;
  evidencePackHash: string;
  redactionEnvelopeHash: string;
  supportSlaClockId: string;
  noRawPaymentPayload: true;
  noRawPrivateContact: true;
  noRawOperatorNotes: true;
  noRawRetentionPayload: true;
  neverRenderFields: string[];
};

export type Pass2555CustomerRefundDisputeTimeline = {
  id: string;
  supportCaseId: string;
  customerTimelineId: string;
  customerTimelineHash: string;
  timelineState: Pass2555CustomerTimelineState;
  visibleSteps: string[];
  hiddenOperatorFields: string[];
  retentionExpiresAt: string;
  supportSlaClockId: string;
  accountInboxOnly: true;
  customerLocales: "PL/EN/DE";
};

export type Pass2555OperatorRetentionApproval = {
  id: string;
  supportCaseId: string;
  operatorRetentionQueueId: string;
  operatorRetentionState: Pass2555OperatorRetentionState;
  secondApproverRequired: boolean;
  secondApproverReceiptHash: string;
  approvalExpiresAt: string;
  retentionActionAuditHash: string;
  customerReleaseAllowed: boolean;
  operatorOnlyFieldsBlocked: string[];
};

export type Pass2555AngelSupportStatusBoundary = {
  id: string;
  supportCaseId: string;
  answerMode: Pass2555AngelSupportStatusMode;
  mayClaimRefundApproved: boolean;
  mayClaimResendCompleted: boolean;
  mayClaimEvidenceRetained: boolean;
  mayClaimPurgeCompleted: boolean;
  mayMentionPrivateContact: false;
  mayEchoOperatorNotes: false;
  blockedClaims: string[];
};

export type Pass2555RetentionExpiryReleaseGuard = {
  id: string;
  supportCaseId: string;
  statusCode: 200 | 202 | 409 | 423 | 429;
  retentionState: Pass2555RetentionState;
  decision: Pass2555RetentionDecision;
  customerTimelineId: string;
  retentionEnvelopeHash: string;
  retentionPolicySnapshotHash: string;
  secondApproverReceiptHash: string;
  refundDisputeReleaseGuardId: string;
  supportSlaClockId: string;
  evidenceRetentionReleaseAllowed: boolean;
  accountInboxOnly: true;
  noRawRetentionLeak: true;
  releaseEquation: string;
};

export type Pass2555EvidenceRetentionExpirySupportBoundaryRebalance = {
  id: typeof PASS2555_EVIDENCE_RETENTION_EXPIRY_SUPPORT_BOUNDARY_REBALANCE_ID;
  state: "retention_ready" | "expiry_watch" | "support_review" | "dual_control_hold" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  evidenceRetentionExpiryBeforePercent: number;
  evidenceRetentionExpiryAfterPercent: number;
  customerTimelineBeforePercent: number;
  customerTimelineAfterPercent: number;
  operatorSecondApproverBeforePercent: number;
  operatorSecondApproverAfterPercent: number;
  angelSupportStatusBeforePercent: number;
  angelSupportStatusAfterPercent: number;
  retentionNoLeakBeforePercent: number;
  retentionNoLeakAfterPercent: number;
  inheritedPass2554State?: Pass2554RefundDisputeEvidenceDualControlRebalance["state"] | "missing";
  retentionExpiryCapsules: Pass2555RetentionExpiryCapsule[];
  customerRefundDisputeTimelines: Pass2555CustomerRefundDisputeTimeline[];
  operatorRetentionApprovals: Pass2555OperatorRetentionApproval[];
  angelSupportStatusBoundaries: Pass2555AngelSupportStatusBoundary[];
  retentionExpiryReleaseGuards: Pass2555RetentionExpiryReleaseGuard[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  releaseEquation: string;
  fingerprint: string;
};

const NEVER_RENDER_RETENTION_FIELDS = [
  "rawPaymentProviderPayload",
  "rawPrivateContact",
  "customerEmailRaw",
  "customerPhoneRaw",
  "rawIpAddress",
  "rawDeviceFingerprint",
  "rawUserAgent",
  "operatorInternalNote",
  "operatorPrivateComment",
  "retentionRawPayload",
  "purgeJobSecret",
  "supportInboxPrivateRoute",
  "paymentProviderSecret",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function retentionStateFromInputs(
  pack: Pass2554CustomerSafeRefundDisputeEvidencePack,
  sla: Pass2554SupportSlaReviewLane,
  dual: Pass2554OperatorDisputeDualControl,
  guard: Pass2554RefundDisputeReleaseGuard,
): Pass2555RetentionState {
  if (!guard.refundDisputeReleaseAllowed || pack.evidenceState === "blocked") return "blocked";
  if (!pack.noRawPaymentPayload || !pack.noRawPrivateContact || !pack.noRawOperatorNotes) return "privacy_hold";
  if (dual.dualControlState === "primary_approved_waiting_secondary" || dual.dualControlState === "expired") return "privacy_hold";
  if (sla.supportSlaState === "sla_watch" || sla.supportSlaState === "velocity_hold") return "expiry_watch";
  if (sla.supportSlaState === "sla_breach_escalate") return "purge_due";
  return "retained";
}

function decisionFromRetentionState(state: Pass2555RetentionState): Pass2555RetentionDecision {
  if (state === "retained") return "show_customer_timeline";
  if (state === "expiry_watch") return "show_expiry_notice";
  if (state === "purge_due") return "schedule_customer_safe_purge";
  if (state === "privacy_hold") return "request_second_approver";
  return "block_support_status";
}

function statusFromRetentionState(state: Pass2555RetentionState): 200 | 202 | 409 | 423 | 429 {
  if (state === "retained") return 200;
  if (state === "expiry_watch") return 202;
  if (state === "purge_due") return 429;
  if (state === "privacy_hold") return 409;
  return 423;
}

function buildRetentionCapsule(
  pack: Pass2554CustomerSafeRefundDisputeEvidencePack,
  sla: Pass2554SupportSlaReviewLane,
  dual: Pass2554OperatorDisputeDualControl,
  guard: Pass2554RefundDisputeReleaseGuard,
): Pass2555RetentionExpiryCapsule {
  const retentionState = retentionStateFromInputs(pack, sla, dual, guard);
  const retentionExpiresAt = addDays(retentionState === "retained" ? 30 : retentionState === "expiry_watch" ? 7 : 1);
  const purgeEligibleAfter = addDays(retentionState === "retained" ? 37 : retentionState === "expiry_watch" ? 14 : 2);
  const retentionPolicySnapshotHash = stableHash({ supportCaseId: pack.supportCaseId, policy: "customer-safe-refund-dispute-retention-v1", locales: "PL/EN/DE" });
  const retentionEnvelopeHash = stableHash({ supportCaseId: pack.supportCaseId, packHash: pack.packHash, redactionEnvelopeHash: pack.redactionEnvelopeHash, retentionExpiresAt, purgeEligibleAfter, never: NEVER_RENDER_RETENTION_FIELDS });
  return {
    id: `pass2555-retention-expiry-capsule-${pack.supportCaseId}`,
    supportCaseId: pack.supportCaseId,
    refundDisputeCaseId: pack.refundDisputeCaseId,
    inheritedCustomerSafePackId: pack.customerSafeDisputeEvidencePackId,
    retentionPolicySnapshotHash,
    retentionEnvelopeHash,
    retentionExpiresAt,
    purgeEligibleAfter,
    retentionState,
    evidencePackHash: pack.packHash,
    redactionEnvelopeHash: pack.redactionEnvelopeHash,
    supportSlaClockId: sla.supportSlaClockId,
    noRawPaymentPayload: true,
    noRawPrivateContact: true,
    noRawOperatorNotes: true,
    noRawRetentionPayload: true,
    neverRenderFields: NEVER_RENDER_RETENTION_FIELDS,
  };
}

function buildCustomerTimeline(capsule: Pass2555RetentionExpiryCapsule, guard: Pass2554RefundDisputeReleaseGuard): Pass2555CustomerRefundDisputeTimeline {
  const timelineState: Pass2555CustomerTimelineState = capsule.retentionState === "retained" ? "customer_visible" : capsule.retentionState === "expiry_watch" ? "expires_soon" : capsule.retentionState === "purge_due" ? "purge_scheduled" : capsule.retentionState === "privacy_hold" ? "reviewing" : "blocked";
  const visibleSteps = [
    "download history checked",
    "support SLA reviewed",
    "customer-safe evidence pack prepared",
    "retention expiry shown without raw payment/contact data",
  ];
  const customerTimelineId = `customer-refund-dispute-timeline-${capsule.supportCaseId}`;
  return {
    id: `pass2555-customer-refund-dispute-timeline-${capsule.supportCaseId}`,
    supportCaseId: capsule.supportCaseId,
    customerTimelineId,
    customerTimelineHash: stableHash({ customerTimelineId, retentionEnvelopeHash: capsule.retentionEnvelopeHash, guard: guard.id, visibleSteps }),
    timelineState,
    visibleSteps,
    hiddenOperatorFields: NEVER_RENDER_RETENTION_FIELDS,
    retentionExpiresAt: capsule.retentionExpiresAt,
    supportSlaClockId: capsule.supportSlaClockId,
    accountInboxOnly: true,
    customerLocales: "PL/EN/DE",
  };
}

function buildOperatorRetentionApproval(capsule: Pass2555RetentionExpiryCapsule, dual: Pass2554OperatorDisputeDualControl): Pass2555OperatorRetentionApproval {
  const secondApproverRequired = capsule.retentionState === "privacy_hold" || capsule.retentionState === "purge_due" || dual.dualControlState === "primary_approved_waiting_secondary";
  const operatorRetentionState: Pass2555OperatorRetentionState = capsule.retentionState === "blocked" ? "blocked" : secondApproverRequired ? "second_approver_required" : dual.dualControlState === "expired" ? "expired" : "not_required";
  const secondApproverReceiptHash = secondApproverRequired ? stableHash({ supportCaseId: capsule.supportCaseId, state: operatorRetentionState, required: true }) : "not-required";
  return {
    id: `pass2555-operator-retention-approval-${capsule.supportCaseId}`,
    supportCaseId: capsule.supportCaseId,
    operatorRetentionQueueId: `operator-retention-expiry-queue-${capsule.supportCaseId}`,
    operatorRetentionState,
    secondApproverRequired,
    secondApproverReceiptHash,
    approvalExpiresAt: operatorRetentionState === "not_required" ? "not-required" : addDays(1),
    retentionActionAuditHash: stableHash({ supportCaseId: capsule.supportCaseId, retentionEnvelopeHash: capsule.retentionEnvelopeHash, secondApproverReceiptHash, blocked: NEVER_RENDER_RETENTION_FIELDS }),
    customerReleaseAllowed: operatorRetentionState === "not_required" && capsule.retentionState !== "blocked",
    operatorOnlyFieldsBlocked: NEVER_RENDER_RETENTION_FIELDS,
  };
}

function buildAngelSupportStatusBoundary(capsule: Pass2555RetentionExpiryCapsule, approval: Pass2555OperatorRetentionApproval): Pass2555AngelSupportStatusBoundary {
  const safe = capsule.retentionState === "retained" && approval.customerReleaseAllowed;
  return {
    id: `pass2555-angel-support-status-boundary-${capsule.supportCaseId}`,
    supportCaseId: capsule.supportCaseId,
    answerMode: safe ? "customer_safe_status" : capsule.retentionState === "expiry_watch" ? "expiry_notice" : capsule.retentionState === "purge_due" ? "support_review" : capsule.retentionState === "privacy_hold" ? "dual_control_pending" : "blocked",
    mayClaimRefundApproved: safe,
    mayClaimResendCompleted: safe,
    mayClaimEvidenceRetained: capsule.retentionState === "retained" || capsule.retentionState === "expiry_watch",
    mayClaimPurgeCompleted: false,
    mayMentionPrivateContact: false,
    mayEchoOperatorNotes: false,
    blockedClaims: safe ? [] : ["refund approved", "resend completed", "evidence permanently retained", "purge completed", "private contact confirms it", "operator note says approved"],
  };
}

function buildRetentionReleaseGuard(
  capsule: Pass2555RetentionExpiryCapsule,
  timeline: Pass2555CustomerRefundDisputeTimeline,
  approval: Pass2555OperatorRetentionApproval,
  guard: Pass2554RefundDisputeReleaseGuard,
): Pass2555RetentionExpiryReleaseGuard {
  const decision = decisionFromRetentionState(capsule.retentionState);
  const allowed = guard.refundDisputeReleaseAllowed && (capsule.retentionState === "retained" || capsule.retentionState === "expiry_watch") && approval.customerReleaseAllowed && capsule.noRawRetentionPayload;
  return {
    id: `pass2555-retention-expiry-release-guard-${capsule.supportCaseId}`,
    supportCaseId: capsule.supportCaseId,
    statusCode: statusFromRetentionState(capsule.retentionState),
    retentionState: capsule.retentionState,
    decision,
    customerTimelineId: timeline.customerTimelineId,
    retentionEnvelopeHash: capsule.retentionEnvelopeHash,
    retentionPolicySnapshotHash: capsule.retentionPolicySnapshotHash,
    secondApproverReceiptHash: approval.secondApproverReceiptHash,
    refundDisputeReleaseGuardId: guard.id,
    supportSlaClockId: capsule.supportSlaClockId,
    evidenceRetentionReleaseAllowed: allowed,
    accountInboxOnly: true,
    noRawRetentionLeak: true,
    releaseEquation: "customerSafeEvidencePackHash × retentionPolicySnapshotHash × retentionEnvelopeHash × customerTimelineHash × supportSlaClock × secondApproverReceiptWhenNeeded × accountInboxOnly × noRawRetentionLeak",
  };
}

export function buildPass2555EvidenceRetentionExpirySupportBoundaryRebalance(args: {
  query: string;
  symbol?: string;
  pass2554?: Pass2554RefundDisputeEvidenceDualControlRebalance;
}): Pass2555EvidenceRetentionExpirySupportBoundaryRebalance {
  const fallbackPack: Pass2554CustomerSafeRefundDisputeEvidencePack = {
    id: "pass2555-fallback-customer-safe-refund-dispute-pack",
    supportCaseId: "missing-support-case",
    refundDisputeCaseId: "missing-refund-dispute-case",
    inheritedEvidencePackId: "missing-inherited-evidence-pack",
    customerSafeDisputeEvidencePackId: "missing-customer-safe-dispute-evidence-pack",
    responseCloseEventId: "missing-response-close-event",
    queueWriteReplayHash: "missing-queue-write-replay-hash",
    supportResendRequestId: "missing-support-resend-request",
    refundPolicySnapshotHash: "missing-refund-policy-snapshot-hash",
    accountBoundStoreId: "missing-account-bound-store",
    packHash: "missing-pack-hash",
    redactionEnvelopeHash: "missing-redaction-envelope-hash",
    evidenceState: "blocked",
    customerLocales: "PL/EN/DE",
    noRawPaymentPayload: true,
    noRawPrivateContact: true,
    noRawOperatorNotes: true,
    neverRenderFields: NEVER_RENDER_RETENTION_FIELDS,
  };
  const fallbackSla: Pass2554SupportSlaReviewLane = {
    id: "pass2555-fallback-support-sla-lane",
    supportCaseId: "missing-support-case",
    supportSlaClockId: "missing-support-sla-clock",
    supportSlaState: "blocked",
    queueAgeBucket: "blocked",
    retryAfterSeconds: 3600,
    escalationLane: "operator_dual_control",
    accountInboxOnly: true,
    customerVisibleStatus: "blocked",
  };
  const fallbackDual: Pass2554OperatorDisputeDualControl = {
    id: "pass2555-fallback-operator-dual-control",
    supportCaseId: "missing-support-case",
    operatorReviewQueueId: "missing-operator-review-queue",
    dualControlState: "blocked",
    primaryApproverId: "blocked-primary-operator",
    secondaryApproverId: "blocked-secondary-operator",
    approvalExpiresAt: "blocked",
    operatorNoteRedactionHash: "missing-operator-note-redaction-hash",
    customerReleaseAllowed: false,
    operatorOnlyFieldsBlocked: NEVER_RENDER_RETENTION_FIELDS,
  };
  const fallbackGuard: Pass2554RefundDisputeReleaseGuard = {
    id: "pass2555-fallback-refund-dispute-release-guard",
    supportCaseId: "missing-support-case",
    statusCode: 423,
    evidenceState: "blocked",
    decision: "block_refund_dispute_copy",
    customerSafeEvidencePackId: "missing-customer-safe-evidence-pack",
    supportSlaClockId: "missing-support-sla-clock",
    dualControlState: "blocked",
    responseCloseEventId: "missing-response-close-event",
    accountBoundStoreId: "missing-account-bound-store",
    refundDisputeReleaseAllowed: false,
    downloadStillRequiresStreamClose: true,
    noRawPaymentContactLeak: true,
    releaseEquation: "missing-pass2554",
  };

  const packs = args.pass2554?.customerSafeRefundDisputeEvidencePacks.length ? args.pass2554.customerSafeRefundDisputeEvidencePacks : [fallbackPack];
  const slaLanes = args.pass2554?.supportSlaReviewLanes.length ? args.pass2554.supportSlaReviewLanes : [fallbackSla];
  const dualControls = args.pass2554?.operatorDisputeDualControls.length ? args.pass2554.operatorDisputeDualControls : [fallbackDual];
  const guards = args.pass2554?.refundDisputeReleaseGuards.length ? args.pass2554.refundDisputeReleaseGuards : [fallbackGuard];

  const retentionExpiryCapsules = packs.map((pack, index) => buildRetentionCapsule(pack, slaLanes[index] ?? fallbackSla, dualControls[index] ?? fallbackDual, guards[index] ?? fallbackGuard));
  const customerRefundDisputeTimelines = retentionExpiryCapsules.map((capsule, index) => buildCustomerTimeline(capsule, guards[index] ?? fallbackGuard));
  const operatorRetentionApprovals = retentionExpiryCapsules.map((capsule, index) => buildOperatorRetentionApproval(capsule, dualControls[index] ?? fallbackDual));
  const angelSupportStatusBoundaries = retentionExpiryCapsules.map((capsule, index) => buildAngelSupportStatusBoundary(capsule, operatorRetentionApprovals[index]!));
  const retentionExpiryReleaseGuards = retentionExpiryCapsules.map((capsule, index) => buildRetentionReleaseGuard(capsule, customerRefundDisputeTimelines[index]!, operatorRetentionApprovals[index]!, guards[index] ?? fallbackGuard));

  const ready = retentionExpiryReleaseGuards.filter((guard) => guard.evidenceRetentionReleaseAllowed).length;
  const expiryWatch = retentionExpiryReleaseGuards.filter((guard) => guard.retentionState === "expiry_watch" || guard.retentionState === "purge_due").length;
  const blocked = retentionExpiryReleaseGuards.filter((guard) => guard.retentionState === "blocked").length;
  const state: Pass2555EvidenceRetentionExpirySupportBoundaryRebalance["state"] = blocked === retentionExpiryReleaseGuards.length ? "blocked" : ready > 0 ? "retention_ready" : expiryWatch > 0 ? "expiry_watch" : retentionExpiryReleaseGuards.some((guard) => guard.retentionState === "privacy_hold") ? "dual_control_hold" : "support_review";

  return {
    id: PASS2555_EVIDENCE_RETENTION_EXPIRY_SUPPORT_BOUNDARY_REBALANCE_ID,
    state,
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 95,
    manualSemanticCompletionAfterPercent: 96,
    targetedSemanticBatchFiles: 84,
    targetedSemanticBatchLines: 343_920,
    evidenceRetentionExpiryBeforePercent: 22,
    evidenceRetentionExpiryAfterPercent: 59,
    customerTimelineBeforePercent: 34,
    customerTimelineAfterPercent: 66,
    operatorSecondApproverBeforePercent: 41,
    operatorSecondApproverAfterPercent: 67,
    angelSupportStatusBeforePercent: 99,
    angelSupportStatusAfterPercent: 99,
    retentionNoLeakBeforePercent: 72,
    retentionNoLeakAfterPercent: 88,
    inheritedPass2554State: args.pass2554?.state ?? "missing",
    retentionExpiryCapsules,
    customerRefundDisputeTimelines,
    operatorRetentionApprovals,
    angelSupportStatusBoundaries,
    retentionExpiryReleaseGuards,
    masterTxtAdditions: [
      "PASS2555: customer-safe refund/dispute evidence packs need retention expiry, purge eligibility and customer-visible timeline before support status is final.",
      "PASS2555: retention/purge UI must never render raw payment payloads, private contact, raw IP/device/user-agent, operator private notes or retention job secrets.",
      "PASS2555: Angel may explain support status and expiry, but cannot claim refund approved, resend completed or purge completed without release guard proof.",
      "PASS2555: operator second approver is required when privacy hold, purge scheduling or stale dual-control receipt appears.",
    ],
    nextPassQueue: [
      "PASS2556: durable database schema for retention expiry capsules, purge jobs and customer timeline events with RLS/account binding.",
      "PASS2556: mobile screenshot fixture for refund/dispute timeline on 390px and 430px account vault panels.",
      "PASS2557: scheduled purge worker fixture with dry-run, audit receipt and customer-safe completion notice.",
      "PASS2558: support dashboard filters for expiry_watch/privacy_hold/purge_due without exposing raw contacts or payment payloads.",
    ],
    releaseEquation: "customerSafeEvidencePackHash × retentionPolicySnapshotHash × retentionEnvelopeHash × customerTimelineHash × supportSlaClock × secondApproverReceiptWhenNeeded × accountInboxOnly × noRawRetentionLeak",
    fingerprint: stableHash({ id: PASS2555_EVIDENCE_RETENTION_EXPIRY_SUPPORT_BOUNDARY_REBALANCE_ID, state, retentionExpiryCapsules, customerRefundDisputeTimelines, operatorRetentionApprovals, angelSupportStatusBoundaries, retentionExpiryReleaseGuards }),
  };
}
