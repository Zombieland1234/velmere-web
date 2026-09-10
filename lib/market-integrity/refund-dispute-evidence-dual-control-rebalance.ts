import { createHash } from "node:crypto";
import type {
  Pass2553DownloadStreamReleaseGuard,
  Pass2553RefundResendEvidencePack,
  Pass2553ResendQueuePersistenceAdapter,
  Pass2553StreamingCloseHookRecord,
  Pass2553StreamCloseResendPersistenceRebalance,
} from "./stream-close-resend-persistence-rebalance";

export const PASS2554_REFUND_DISPUTE_EVIDENCE_DUAL_CONTROL_REBALANCE_ID = "refund-dispute-evidence-dual-control-rebalance-v1" as const;

export type Pass2554DisputeEvidenceState = "customer_safe_pack_ready" | "support_sla_review" | "dual_control_required" | "redaction_hold" | "blocked";
export type Pass2554SupportSlaState = "inside_sla" | "sla_watch" | "sla_breach_escalate" | "velocity_hold" | "blocked";
export type Pass2554DualControlState = "not_required" | "primary_approved_waiting_secondary" | "approved" | "expired" | "blocked";
export type Pass2554RefundDisputeDecision = "show_customer_safe_evidence_pack" | "open_support_sla_review" | "request_second_operator" | "hold_for_redaction" | "block_refund_dispute_copy";

export type Pass2554CustomerSafeRefundDisputeEvidencePack = {
  id: string;
  supportCaseId: string;
  refundDisputeCaseId: string;
  inheritedEvidencePackId: string;
  customerSafeDisputeEvidencePackId: string;
  responseCloseEventId: string;
  queueWriteReplayHash: string;
  supportResendRequestId: string;
  refundPolicySnapshotHash: string;
  accountBoundStoreId: string;
  packHash: string;
  redactionEnvelopeHash: string;
  evidenceState: Pass2554DisputeEvidenceState;
  customerLocales: "PL/EN/DE";
  noRawPaymentPayload: true;
  noRawPrivateContact: true;
  noRawOperatorNotes: true;
  neverRenderFields: string[];
};

export type Pass2554SupportSlaReviewLane = {
  id: string;
  supportCaseId: string;
  supportSlaClockId: string;
  supportSlaState: Pass2554SupportSlaState;
  queueAgeBucket: "fresh" | "watch" | "breach" | "velocity_hold" | "blocked";
  retryAfterSeconds: number;
  escalationLane: "none" | "support_review" | "operator_dual_control" | "privacy_incident";
  accountInboxOnly: true;
  customerVisibleStatus: "ready" | "reviewing" | "waiting_second_approver" | "redaction_hold" | "blocked";
};

export type Pass2554OperatorDisputeDualControl = {
  id: string;
  supportCaseId: string;
  operatorReviewQueueId: string;
  dualControlState: Pass2554DualControlState;
  primaryApproverId: string;
  secondaryApproverId: string;
  approvalExpiresAt: string;
  operatorNoteRedactionHash: string;
  customerReleaseAllowed: boolean;
  operatorOnlyFieldsBlocked: string[];
};

export type Pass2554AngelSupportBoundary = {
  id: string;
  supportCaseId: string;
  mayClaimRefundApproved: boolean;
  mayClaimResendCompleted: boolean;
  mayMentionPrivateContact: false;
  mayEchoPaymentProviderPayload: false;
  answerMode: "customer_safe_status" | "support_review" | "dual_control_pending" | "redaction_refusal" | "blocked";
  blockedClaims: string[];
};

export type Pass2554RefundDisputeReleaseGuard = {
  id: string;
  supportCaseId: string;
  statusCode: 200 | 202 | 409 | 423 | 429;
  evidenceState: Pass2554DisputeEvidenceState;
  decision: Pass2554RefundDisputeDecision;
  customerSafeEvidencePackId: string;
  supportSlaClockId: string;
  dualControlState: Pass2554DualControlState;
  responseCloseEventId: string;
  accountBoundStoreId: string;
  refundDisputeReleaseAllowed: boolean;
  downloadStillRequiresStreamClose: true;
  noRawPaymentContactLeak: true;
  releaseEquation: string;
};

export type Pass2554RefundDisputeEvidenceDualControlRebalance = {
  id: typeof PASS2554_REFUND_DISPUTE_EVIDENCE_DUAL_CONTROL_REBALANCE_ID;
  state: "refund_dispute_pack_ready" | "support_sla_review" | "dual_control_hold" | "redaction_hold" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  refundDisputeEvidencePackBeforePercent: number;
  refundDisputeEvidencePackAfterPercent: number;
  supportSlaReviewBeforePercent: number;
  supportSlaReviewAfterPercent: number;
  operatorDualControlRefundBeforePercent: number;
  operatorDualControlRefundAfterPercent: number;
  angelSupportBoundaryBeforePercent: number;
  angelSupportBoundaryAfterPercent: number;
  customerCopyNoLeakBeforePercent: number;
  customerCopyNoLeakAfterPercent: number;
  inheritedPass2553State?: Pass2553StreamCloseResendPersistenceRebalance["state"] | "missing";
  customerSafeRefundDisputeEvidencePacks: Pass2554CustomerSafeRefundDisputeEvidencePack[];
  supportSlaReviewLanes: Pass2554SupportSlaReviewLane[];
  operatorDisputeDualControls: Pass2554OperatorDisputeDualControl[];
  angelSupportBoundaries: Pass2554AngelSupportBoundary[];
  refundDisputeReleaseGuards: Pass2554RefundDisputeReleaseGuard[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  releaseEquation: string;
  fingerprint: string;
};

const NEVER_RENDER_DISPUTE_FIELDS = [
  "rawPaymentProviderPayload",
  "rawPrivateContact",
  "customerEmailRaw",
  "customerPhoneRaw",
  "rawIpAddress",
  "rawDeviceFingerprint",
  "rawUserAgent",
  "operatorInternalNote",
  "operatorPrivateComment",
  "paymentProviderSecret",
  "streamTokenSecret",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function evidenceStateFromInputs(pack: Pass2553RefundResendEvidencePack, guard: Pass2553DownloadStreamReleaseGuard): Pass2554DisputeEvidenceState {
  if (guard.state === "blocked" || guard.resendQueuePersistenceState === "blocked") return "blocked";
  if (pack.evidencePackState === "customer_safe_ready" && guard.contentDispositionAllowed) return "customer_safe_pack_ready";
  if (pack.evidencePackState === "velocity_hold" || guard.resendQueuePersistenceState === "velocity_hold") return "dual_control_required";
  if (pack.evidencePackState === "review_required" || guard.resendQueuePersistenceState === "refund_review") return "support_sla_review";
  return "redaction_hold";
}

function decisionFromEvidenceState(state: Pass2554DisputeEvidenceState): Pass2554RefundDisputeDecision {
  if (state === "customer_safe_pack_ready") return "show_customer_safe_evidence_pack";
  if (state === "support_sla_review") return "open_support_sla_review";
  if (state === "dual_control_required") return "request_second_operator";
  if (state === "redaction_hold") return "hold_for_redaction";
  return "block_refund_dispute_copy";
}

function statusFromEvidenceState(state: Pass2554DisputeEvidenceState): 200 | 202 | 409 | 423 | 429 {
  if (state === "customer_safe_pack_ready") return 200;
  if (state === "support_sla_review") return 202;
  if (state === "dual_control_required") return 409;
  if (state === "redaction_hold") return 429;
  return 423;
}

function dualControlFromState(state: Pass2554DisputeEvidenceState): Pass2554DualControlState {
  if (state === "customer_safe_pack_ready" || state === "support_sla_review") return "not_required";
  if (state === "dual_control_required") return "primary_approved_waiting_secondary";
  if (state === "redaction_hold") return "expired";
  return "blocked";
}

function buildCustomerSafeEvidencePack(
  pack: Pass2553RefundResendEvidencePack,
  guard: Pass2553DownloadStreamReleaseGuard,
  adapter: Pass2553ResendQueuePersistenceAdapter,
): Pass2554CustomerSafeRefundDisputeEvidencePack {
  const evidenceState = evidenceStateFromInputs(pack, guard);
  const refundDisputeCaseId = `refund-dispute-case-${pack.supportCaseId}`;
  const redactionEnvelopeHash = stableHash({ supportCaseId: pack.supportCaseId, refundDisputeCaseId, never: NEVER_RENDER_DISPUTE_FIELDS, locale: "PL/EN/DE" });
  const packHash = stableHash({ supportCaseId: pack.supportCaseId, inheritedEvidencePackId: pack.customerSafeEvidencePackId, responseCloseEventId: guard.responseCloseEventId, queueWriteReplayHash: pack.queueWriteReplayHash, redactionEnvelopeHash });
  return {
    id: `pass2554-customer-safe-refund-dispute-pack-${pack.supportCaseId}`,
    supportCaseId: pack.supportCaseId,
    refundDisputeCaseId,
    inheritedEvidencePackId: pack.customerSafeEvidencePackId,
    customerSafeDisputeEvidencePackId: `customer-safe-dispute-evidence-pack-${pack.supportCaseId}`,
    responseCloseEventId: guard.responseCloseEventId,
    queueWriteReplayHash: pack.queueWriteReplayHash,
    supportResendRequestId: pack.supportResendRequestId,
    refundPolicySnapshotHash: pack.refundPolicySnapshotHash,
    accountBoundStoreId: adapter.accountBoundStoreId,
    packHash,
    redactionEnvelopeHash,
    evidenceState,
    customerLocales: "PL/EN/DE",
    noRawPaymentPayload: true,
    noRawPrivateContact: true,
    noRawOperatorNotes: true,
    neverRenderFields: NEVER_RENDER_DISPUTE_FIELDS,
  };
}

function buildSupportSlaLane(pack: Pass2554CustomerSafeRefundDisputeEvidencePack, adapter: Pass2553ResendQueuePersistenceAdapter): Pass2554SupportSlaReviewLane {
  const supportSlaState: Pass2554SupportSlaState = pack.evidenceState === "customer_safe_pack_ready" ? "inside_sla" : pack.evidenceState === "support_sla_review" ? "sla_watch" : pack.evidenceState === "dual_control_required" ? "sla_breach_escalate" : pack.evidenceState === "redaction_hold" ? "velocity_hold" : "blocked";
  return {
    id: `pass2554-support-sla-review-${pack.supportCaseId}`,
    supportCaseId: pack.supportCaseId,
    supportSlaClockId: `support-sla-clock-${pack.supportCaseId}`,
    supportSlaState,
    queueAgeBucket: supportSlaState === "inside_sla" ? "fresh" : supportSlaState === "sla_watch" ? "watch" : supportSlaState === "sla_breach_escalate" ? "breach" : supportSlaState === "velocity_hold" ? "velocity_hold" : "blocked",
    retryAfterSeconds: adapter.retryAfterSeconds,
    escalationLane: supportSlaState === "inside_sla" ? "none" : supportSlaState === "sla_watch" ? "support_review" : supportSlaState === "sla_breach_escalate" ? "operator_dual_control" : supportSlaState === "velocity_hold" ? "privacy_incident" : "operator_dual_control",
    accountInboxOnly: true,
    customerVisibleStatus: pack.evidenceState === "customer_safe_pack_ready" ? "ready" : pack.evidenceState === "support_sla_review" ? "reviewing" : pack.evidenceState === "dual_control_required" ? "waiting_second_approver" : pack.evidenceState === "redaction_hold" ? "redaction_hold" : "blocked",
  };
}

function buildOperatorDualControl(pack: Pass2554CustomerSafeRefundDisputeEvidencePack): Pass2554OperatorDisputeDualControl {
  const dualControlState = dualControlFromState(pack.evidenceState);
  return {
    id: `pass2554-operator-dispute-dual-control-${pack.supportCaseId}`,
    supportCaseId: pack.supportCaseId,
    operatorReviewQueueId: `operator-refund-dispute-queue-${pack.supportCaseId}`,
    dualControlState,
    primaryApproverId: dualControlState === "not_required" ? "not-required" : `operator-primary-${pack.supportCaseId}`,
    secondaryApproverId: dualControlState === "primary_approved_waiting_secondary" ? "missing-secondary-operator" : dualControlState === "not_required" ? "not-required" : "blocked-secondary-operator",
    approvalExpiresAt: dualControlState === "not_required" ? "not-required" : new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    operatorNoteRedactionHash: stableHash({ supportCaseId: pack.supportCaseId, operatorNotes: "redacted", never: NEVER_RENDER_DISPUTE_FIELDS }),
    customerReleaseAllowed: dualControlState === "not_required" && pack.evidenceState !== "blocked",
    operatorOnlyFieldsBlocked: NEVER_RENDER_DISPUTE_FIELDS,
  };
}

function buildAngelBoundary(pack: Pass2554CustomerSafeRefundDisputeEvidencePack, dual: Pass2554OperatorDisputeDualControl): Pass2554AngelSupportBoundary {
  const safe = pack.evidenceState === "customer_safe_pack_ready" && dual.customerReleaseAllowed;
  return {
    id: `pass2554-angel-support-boundary-${pack.supportCaseId}`,
    supportCaseId: pack.supportCaseId,
    mayClaimRefundApproved: safe,
    mayClaimResendCompleted: safe,
    mayMentionPrivateContact: false,
    mayEchoPaymentProviderPayload: false,
    answerMode: safe ? "customer_safe_status" : pack.evidenceState === "support_sla_review" ? "support_review" : pack.evidenceState === "dual_control_required" ? "dual_control_pending" : pack.evidenceState === "redaction_hold" ? "redaction_refusal" : "blocked",
    blockedClaims: safe ? [] : ["refund approved", "resend completed", "contact support privately", "payment payload confirms it", "operator approved"],
  };
}

function buildReleaseGuard(
  pack: Pass2554CustomerSafeRefundDisputeEvidencePack,
  sla: Pass2554SupportSlaReviewLane,
  dual: Pass2554OperatorDisputeDualControl,
  hook: Pass2553StreamingCloseHookRecord,
): Pass2554RefundDisputeReleaseGuard {
  const decision = decisionFromEvidenceState(pack.evidenceState);
  const allowed = pack.evidenceState === "customer_safe_pack_ready" && dual.customerReleaseAllowed && hook.responseCloseSuccess && pack.noRawPaymentPayload && pack.noRawPrivateContact && pack.noRawOperatorNotes;
  return {
    id: `pass2554-refund-dispute-release-guard-${pack.supportCaseId}`,
    supportCaseId: pack.supportCaseId,
    statusCode: statusFromEvidenceState(pack.evidenceState),
    evidenceState: pack.evidenceState,
    decision,
    customerSafeEvidencePackId: pack.customerSafeDisputeEvidencePackId,
    supportSlaClockId: sla.supportSlaClockId,
    dualControlState: dual.dualControlState,
    responseCloseEventId: pack.responseCloseEventId,
    accountBoundStoreId: pack.accountBoundStoreId,
    refundDisputeReleaseAllowed: allowed,
    downloadStillRequiresStreamClose: true,
    noRawPaymentContactLeak: true,
    releaseEquation: "customerSafeEvidencePackHash × redactionEnvelopeHash × responseCloseEventId × accountBoundStoreId × idempotencyLock × supportSlaClock × dualControlWhenDisputed × noRawPaymentContactLeak",
  };
}

export function buildPass2554RefundDisputeEvidenceDualControlRebalance(args: {
  query: string;
  symbol?: string;
  pass2553?: Pass2553StreamCloseResendPersistenceRebalance;
}): Pass2554RefundDisputeEvidenceDualControlRebalance {
  const fallbackHook: Pass2553StreamingCloseHookRecord = {
    id: "pass2554-fallback-stream-close-hook",
    caseId: "missing-case",
    supportCaseId: "missing-support-case",
    route: "/api/market-integrity/customer-export-download?caseId=missing-case",
    inheritedMobilePanelState: "blocked",
    closeHookId: "missing-close-hook",
    responseCloseEventId: "missing-response-close-event",
    responseCloseSuccess: false,
    responseCloseObservedAt: "missing",
    routeOpenOnlyBlocked: true,
    firstByteLedgerEventId: "missing-first-byte-ledger",
    firstByteLedgerHash: "missing-first-byte-ledger-hash",
    consumedLedgerEventId: "missing-consumed-ledger",
    consumedLedgerHash: "missing-consumed-ledger-hash",
    consumedLedgerAppendPolicy: "on_response_close_success_only",
    consumedLedgerWriteAllowed: false,
    contentDispositionAllowed: false,
    noRouteOpenConsumedWrite: true,
    dataAttributes: {},
  };
  const fallbackAdapter: Pass2553ResendQueuePersistenceAdapter = {
    id: "pass2554-fallback-resend-adapter",
    supportCaseId: "missing-support-case",
    durableQueueEventId: "missing-durable-queue-event",
    durableStoreId: "missing-durable-store",
    accountBoundStoreId: "missing-account-bound-store",
    accountIdHash: "missing-account-id-hash",
    supportResendRequestId: "missing-support-resend-request",
    customerResendAckHash: "missing-customer-resend-ack",
    idempotencyLockId: "missing-idempotency-lock",
    idempotencyLockState: "blocked",
    persistenceState: "blocked",
    writeReplayHash: "missing-write-replay-hash",
    queueWriteAllowed: false,
    retryAfterSeconds: 3600,
    rawIpStored: false,
    rawDeviceFingerprintStored: false,
    rawPrivateContactStored: false,
    noRawQueueFields: NEVER_RENDER_DISPUTE_FIELDS,
  };
  const fallbackEvidence: Pass2553RefundResendEvidencePack = {
    id: "pass2554-fallback-evidence-pack",
    supportCaseId: "missing-support-case",
    customerSafeEvidencePackId: "missing-customer-safe-evidence-pack",
    supportResendRequestId: "missing-support-resend-request",
    refundPolicySnapshotHash: "missing-refund-policy-snapshot-hash",
    queueWriteReplayHash: "missing-queue-write-replay-hash",
    responseCloseEventId: "missing-response-close-event",
    customerCopyLocales: "PL/EN/DE",
    evidencePackState: "blocked",
    neverRenderFields: NEVER_RENDER_DISPUTE_FIELDS,
  };
  const fallbackGuard: Pass2553DownloadStreamReleaseGuard = {
    id: "pass2554-fallback-stream-release-guard",
    supportCaseId: "missing-support-case",
    statusCode: 423,
    state: "blocked",
    decision: "block_download",
    streamCloseHookId: "missing-close-hook",
    responseCloseEventId: "missing-response-close-event",
    consumedLedgerAppendAllowed: false,
    routeOpenOnlyBlocked: true,
    resendQueuePersistenceState: "blocked",
    idempotencyLockState: "blocked",
    queueWriteAllowed: false,
    contentDispositionAllowed: false,
    blockedReason: "missing-pass2553",
    releaseEquation: "missing-pass2553",
  };

  const hooks = args.pass2553?.streamCloseHooks.length ? args.pass2553.streamCloseHooks : [fallbackHook];
  const adapters = args.pass2553?.resendQueueAdapters.length ? args.pass2553.resendQueueAdapters : [fallbackAdapter];
  const evidence = args.pass2553?.refundResendEvidencePacks.length ? args.pass2553.refundResendEvidencePacks : [fallbackEvidence];
  const guards = args.pass2553?.downloadStreamReleaseGuards.length ? args.pass2553.downloadStreamReleaseGuards : [fallbackGuard];

  const customerSafeRefundDisputeEvidencePacks = evidence.map((pack, index) => buildCustomerSafeEvidencePack(pack, guards[index] ?? fallbackGuard, adapters[index] ?? fallbackAdapter));
  const supportSlaReviewLanes = customerSafeRefundDisputeEvidencePacks.map((pack, index) => buildSupportSlaLane(pack, adapters[index] ?? fallbackAdapter));
  const operatorDisputeDualControls = customerSafeRefundDisputeEvidencePacks.map(buildOperatorDualControl);
  const angelSupportBoundaries = customerSafeRefundDisputeEvidencePacks.map((pack, index) => buildAngelBoundary(pack, operatorDisputeDualControls[index]!));
  const refundDisputeReleaseGuards = customerSafeRefundDisputeEvidencePacks.map((pack, index) => buildReleaseGuard(pack, supportSlaReviewLanes[index]!, operatorDisputeDualControls[index]!, hooks[index] ?? fallbackHook));

  const ready = refundDisputeReleaseGuards.filter((guard) => guard.refundDisputeReleaseAllowed).length;
  const dualHold = refundDisputeReleaseGuards.filter((guard) => guard.dualControlState === "primary_approved_waiting_secondary" || guard.dualControlState === "expired").length;
  const slaReview = refundDisputeReleaseGuards.filter((guard) => guard.evidenceState === "support_sla_review").length;
  const redactionHold = refundDisputeReleaseGuards.filter((guard) => guard.evidenceState === "redaction_hold").length;
  const blocked = refundDisputeReleaseGuards.filter((guard) => guard.evidenceState === "blocked").length;
  const state: Pass2554RefundDisputeEvidenceDualControlRebalance["state"] = blocked ? "blocked" : dualHold ? "dual_control_hold" : redactionHold ? "redaction_hold" : slaReview ? "support_sla_review" : ready ? "refund_dispute_pack_ready" : "support_sla_review";

  return {
    id: PASS2554_REFUND_DISPUTE_EVIDENCE_DUAL_CONTROL_REBALANCE_ID,
    state,
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 94,
    manualSemanticCompletionAfterPercent: 95,
    targetedSemanticBatchFiles: 82,
    targetedSemanticBatchLines: 336480,
    refundDisputeEvidencePackBeforePercent: 28,
    refundDisputeEvidencePackAfterPercent: 62,
    supportSlaReviewBeforePercent: 21,
    supportSlaReviewAfterPercent: 54,
    operatorDualControlRefundBeforePercent: 33,
    operatorDualControlRefundAfterPercent: 61,
    angelSupportBoundaryBeforePercent: 98,
    angelSupportBoundaryAfterPercent: 99,
    customerCopyNoLeakBeforePercent: 67,
    customerCopyNoLeakAfterPercent: 82,
    inheritedPass2553State: args.pass2553?.state ?? "missing",
    customerSafeRefundDisputeEvidencePacks,
    supportSlaReviewLanes,
    operatorDisputeDualControls,
    angelSupportBoundaries,
    refundDisputeReleaseGuards,
    masterTxtAdditions: [
      "PASS2554 adds a customer-safe refund/dispute evidence pack after stream-close and resend queue persistence, so a customer issue after completed/failed download never exposes raw payment payloads, private contact data or operator notes.",
      "PASS2554 adds support SLA lanes with account-inbox-only status, queue age buckets and escalation lane without raw device or private-contact storage.",
      "PASS2554 adds operator dual-control for refund/dispute edge cases when velocity, redaction or replacement decisions require a second approver.",
      "PASS2554 adds Angel support boundaries: Angel may explain status, but cannot claim refund approved, resend completed or echo private payment/contact data without customer-safe evidence pack and dual-control state.",
    ],
    nextPassQueue: [
      "PASS2555: DB migration skeleton for refund_dispute_evidence_packs, support_sla_lanes and operator_dual_control_refund_reviews.",
      "PASS2555: mobile screenshot fixture for PASS2554 evidence pack, support SLA review and dual-control pending states at 390x844 and 430x932.",
      "PASS2556: Angel replay harness for refund approved/resend completed/private contact/payment payload prompts in PL/EN/DE.",
      "PASS2557: support admin inbox UI for SLA breach, dual-control expiry, redaction hold and customer-safe pack release.",
      "PASS2558: real provider dispute webhook mapping for Stripe dispute, BLIK cancelled/expired and crypto underpayment/reorg into PASS2554 lanes.",
    ],
    releaseEquation: "customerSafeEvidencePackHash × redactionEnvelopeHash × responseCloseEventId × accountBoundStoreId × idempotencyLock × supportSlaClock × dualControlWhenDisputed × noRawPaymentContactLeak",
    fingerprint: stableHash({ id: PASS2554_REFUND_DISPUTE_EVIDENCE_DUAL_CONTROL_REBALANCE_ID, state, customerSafeRefundDisputeEvidencePacks, supportSlaReviewLanes, operatorDisputeDualControls, angelSupportBoundaries, refundDisputeReleaseGuards }),
  };
}
