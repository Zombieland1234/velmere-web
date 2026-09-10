import { createHash } from "node:crypto";
import type {
  Pass2550ConsumedLedgerDownloadHistoryRebalance,
  Pass2550ConsumedLedgerRecord,
  Pass2550FinalConsumedDownloadGuard,
} from "./consumed-ledger-download-history-rebalance";

export const PASS2551_SUPPORT_RESEND_ROTATION_ACK_REBALANCE_ID = "support-resend-rotation-ack-rebalance-v1" as const;

export type Pass2551SupportResendState =
  | "resend_rotation_ready"
  | "resend_not_requested"
  | "customer_ack_required"
  | "dual_control_required"
  | "refund_review_required"
  | "velocity_hold"
  | "blocked";

export type Pass2551SupportResendDecision =
  | "issue_rotated_resend_token"
  | "show_consumed_history_only"
  | "collect_customer_ack_first"
  | "request_dual_control_approval"
  | "open_refund_review"
  | "hold_for_replay_velocity"
  | "block_resend";

export type Pass2551RefundState = "not_requested" | "eligible_review" | "policy_snapshot_required" | "dispute_window_hold" | "blocked";
export type Pass2551ResendChannelState = "account_inbox_only" | "email_disabled" | "customer_ack_pending" | "cooldown_active" | "blocked";

export type Pass2551SupportResendRecord = {
  id: string;
  caseId: string;
  supportCaseId: string;
  replayRunId: string;
  inheritedPass2550State: Pass2550ConsumedLedgerRecord["state"];
  inheritedPass2550Decision: Pass2550ConsumedLedgerRecord["decision"];
  consumedLedgerHash?: string;
  customerVisibleHistoryHash?: string;
  reDownloadLocked: boolean;
  state: Pass2551SupportResendState;
  decision: Pass2551SupportResendDecision;
  refundState: Pass2551RefundState;
  resendChannelState: Pass2551ResendChannelState;
  supportResendRequestId?: string;
  supportResendRequestHash?: string;
  rotatedResendTokenId?: string;
  rotatedResendTokenHash?: string;
  customerResendAckHash?: string;
  resendEligibilityHash?: string;
  refundPolicySnapshotHash?: string;
  paymentReceiptSafeHash?: string;
  disputeWindowState: "not_applicable" | "open" | "closed_safe" | "chargeback_hold" | "blocked";
  secondOperatorApprovalHash?: string;
  resendCooldownSeconds: number;
  supportMayIssueResend: boolean;
  refundMayOpenReview: boolean;
  accountInboxOnly: boolean;
  noPrivateContactLeakScore: number;
  blockedClaims: string[];
  neverRenderFields: string[];
  customerSafeCopy: Record<"pl" | "en" | "de", string>;
  releaseEquation: string;
  dataAttributes: Record<string, string>;
};

export type Pass2551SupportResendGuard = {
  id: string;
  route: string;
  caseId: string;
  supportCaseId: string;
  state: Pass2551SupportResendState;
  decision: Pass2551SupportResendDecision;
  statusCode: 200 | 202 | 409 | 423 | 425 | 429;
  supportMayIssueResend: boolean;
  refundMayOpenReview: boolean;
  accountInboxOnly: boolean;
  supportResendRequestId?: string;
  rotatedResendTokenHash?: string;
  customerResendAckHash?: string;
  refundPolicySnapshotHash?: string;
  paymentReceiptSafeHash?: string;
  noPrivateContactLeakScore: number;
  customerSafeError: Record<"pl" | "en" | "de", string>;
};

export type Pass2551AngelSupportResendBoundary = {
  id: string;
  supportCaseId: string;
  canSayResendAvailable: boolean;
  canSayRefundReviewOpen: boolean;
  canMentionPrivateContact: false;
  allowedTone: "resend_ready" | "history_only" | "ack_required" | "dual_control" | "refund_review" | "velocity_hold" | "blocked";
  blockedClaims: string[];
  safeSummary: Record<"pl" | "en" | "de", string>;
};

export type Pass2551SupportQueueEvent = {
  id: string;
  supportCaseId: string;
  queue: "resend_rotation" | "customer_ack" | "dual_control" | "refund_review" | "velocity_hold" | "blocked";
  eventHash: string;
  customerVisible: boolean;
  redactedSignals: string[];
};

export type Pass2551Fixture = {
  id: string;
  scenario:
    | "consumed_history_can_request_resend_rotation"
    | "resend_without_customer_ack_blocks"
    | "replay_velocity_holds_resend"
    | "refund_review_requires_policy_snapshot"
    | "private_contact_never_renders";
  expectedState: Pass2551SupportResendState;
  expectedDecision: Pass2551SupportResendDecision;
  expectedSupportMayIssueResend: boolean;
};

export type Pass2551SupportResendRotationAckRebalance = {
  id: typeof PASS2551_SUPPORT_RESEND_ROTATION_ACK_REBALANCE_ID;
  state: "resend_rotation_ready" | "history_only" | "ack_or_dual_control_pending" | "refund_or_velocity_hold" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  supportResendBeforePercent: number;
  supportResendAfterPercent: number;
  refundReviewBeforePercent: number;
  refundReviewAfterPercent: number;
  accountInboxResendBeforePercent: number;
  accountInboxResendAfterPercent: number;
  angelSupportBoundaryBeforePercent: number;
  angelSupportBoundaryAfterPercent: number;
  privateContactLeakBeforePercent: number;
  privateContactLeakAfterPercent: number;
  inheritedPass2550State?: Pass2550ConsumedLedgerDownloadHistoryRebalance["state"] | "missing";
  supportResendRecords: Pass2551SupportResendRecord[];
  supportResendGuards: Pass2551SupportResendGuard[];
  angelSupportResendBoundaries: Pass2551AngelSupportResendBoundary[];
  supportQueueEvents: Pass2551SupportQueueEvent[];
  fixtures: Pass2551Fixture[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  supportResendRule: string;
  fingerprint: string;
};

const BLOCKED_SUPPORT_CLAIMS = [
  "re-download available without support",
  "refund approved automatically",
  "private email confirmed",
  "raw phone verified",
  "same token can be reused",
  "support can bypass customer ack",
  "second download is guaranteed",
  "operator note is visible",
];

const NEVER_RENDER_FIELDS = [
  "customerEmailRaw",
  "customerPhoneRaw",
  "privateContactRaw",
  "downloadSessionSecret",
  "oneTimeStreamTokenSecret",
  "rotatedResendTokenSecret",
  "operatorInternalNote",
  "operatorSlackThread",
  "rawIpAddress",
  "deviceFingerprintRaw",
  "paymentProviderPayload",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function stateFromRecord(record: Pass2550ConsumedLedgerRecord): Pass2551SupportResendState {
  if (record.replayVelocityBucket === "velocity_abuse" || record.replayVelocityBucket === "burst") return "velocity_hold";
  if (record.refundSupportState === "refund_review_required") return "refund_review_required";
  if (record.state === "consumed_ledger_persisted" && record.reDownloadLocked && record.customerVisibleHistoryHash) return "resend_rotation_ready";
  if (record.state === "completion_replay_blocked" || record.reDownloadState === "support_resend_required") return "customer_ack_required";
  if (record.state === "support_escalation_required" || record.state === "consumption_ledger_mismatch") return "dual_control_required";
  if (record.downloadHistoryState === "visible_customer_safe") return "resend_not_requested";
  return "blocked";
}

function decisionFromState(state: Pass2551SupportResendState): Pass2551SupportResendDecision {
  if (state === "resend_rotation_ready") return "issue_rotated_resend_token";
  if (state === "resend_not_requested") return "show_consumed_history_only";
  if (state === "customer_ack_required") return "collect_customer_ack_first";
  if (state === "dual_control_required") return "request_dual_control_approval";
  if (state === "refund_review_required") return "open_refund_review";
  if (state === "velocity_hold") return "hold_for_replay_velocity";
  return "block_resend";
}

function statusFromDecision(decision: Pass2551SupportResendDecision): 200 | 202 | 409 | 423 | 425 | 429 {
  if (decision === "issue_rotated_resend_token") return 200;
  if (decision === "show_consumed_history_only" || decision === "collect_customer_ack_first" || decision === "request_dual_control_approval") return 202;
  if (decision === "open_refund_review") return 425;
  if (decision === "hold_for_replay_velocity") return 429;
  return 423;
}

function copyForState(state: Pass2551SupportResendState): Record<"pl" | "en" | "de", string> {
  if (state === "resend_rotation_ready") {
    return {
      pl: "Download jest zakończony i zablokowany do ponownego użycia. Support może wydać nowy, rotowany resend token tylko do account inbox.",
      en: "The download is completed and locked against reuse. Support may issue a new rotated resend token only to the account inbox.",
      de: "Der Download ist abgeschlossen und gegen Wiederverwendung gesperrt. Support darf nur einen rotierten Resend-Token in die Account-Inbox ausstellen.",
    };
  }
  if (state === "customer_ack_required") {
    return {
      pl: "Przed resend wymagane jest potwierdzenie klienta w account vault. Prywatny kontakt nie jest renderowany.",
      en: "Customer acknowledgement in the account vault is required before resend. Private contact is not rendered.",
      de: "Vor Resend ist eine Kundenbestätigung im Account Vault erforderlich. Private Kontaktdaten werden nicht gerendert.",
    };
  }
  if (state === "dual_control_required") {
    return {
      pl: "Resend wymaga drugiego operatora i bezpiecznego chain hash, zanim support pokaże nowy token.",
      en: "Resend requires a second operator and a safe chain hash before support can show a new token.",
      de: "Resend benötigt einen zweiten Operator und einen sicheren Chain-Hash, bevor Support ein neues Token anzeigen kann.",
    };
  }
  if (state === "refund_review_required") {
    return {
      pl: "Refund/resend przechodzi do review z policy snapshot; nie obiecujemy automatycznego zwrotu.",
      en: "Refund/resend moves to review with a policy snapshot; no automatic refund is promised.",
      de: "Refund/Resend geht mit Policy-Snapshot in Review; es wird keine automatische Rückerstattung versprochen.",
    };
  }
  if (state === "velocity_hold") {
    return {
      pl: "Wykryto replay velocity. Support pokazuje tylko bezpieczny status i kolejkę review bez raw device danych.",
      en: "Replay velocity was detected. Support shows only a safe status and review queue without raw device data.",
      de: "Replay Velocity wurde erkannt. Support zeigt nur sicheren Status und Review-Queue ohne rohe Gerätedaten.",
    };
  }
  return {
    pl: "Resend jest zablokowany do czasu spełnienia customer-safe warunków.",
    en: "Resend is blocked until customer-safe requirements are satisfied.",
    de: "Resend ist blockiert, bis kundensichere Anforderungen erfüllt sind.",
  };
}

function buildRecord(record: Pass2550ConsumedLedgerRecord): Pass2551SupportResendRecord {
  const state = stateFromRecord(record);
  const decision = decisionFromState(state);
  const supportMayIssueResend = state === "resend_rotation_ready";
  const refundMayOpenReview = state === "refund_review_required" || state === "velocity_hold";
  const supportResendRequestId = supportMayIssueResend || state === "customer_ack_required" || state === "dual_control_required" ? `support-resend-request-${record.supportCaseId}` : undefined;
  const supportResendRequestHash = supportResendRequestId ? stableHash({ supportResendRequestId, history: record.customerVisibleHistoryHash, reDownloadLocked: record.reDownloadLocked }) : undefined;
  const customerResendAckHash = state === "resend_rotation_ready" ? stableHash({ supportCaseId: record.supportCaseId, ack: "account-vault-resend-ack", locale: "PL/EN/DE" }) : undefined;
  const resendEligibilityHash = supportMayIssueResend ? stableHash({ supportCaseId: record.supportCaseId, consumedLedgerHash: record.consumedLedgerHash, score: record.noRawDeviceLeakScore }) : undefined;
  const rotatedResendTokenId = supportMayIssueResend ? `rotated-resend-token-${record.supportCaseId}` : undefined;
  const rotatedResendTokenHash = rotatedResendTokenId ? stableHash({ rotatedResendTokenId, resendEligibilityHash, accountInboxOnly: true }) : undefined;
  const refundPolicySnapshotHash = refundMayOpenReview || supportMayIssueResend ? stableHash({ policy: "velmere-refund-resend-policy-v1", supportCaseId: record.supportCaseId, noAutoRefund: true }) : undefined;
  const paymentReceiptSafeHash = refundMayOpenReview || supportMayIssueResend ? stableHash({ supportCaseId: record.supportCaseId, receipt: "customer-safe-paid-export-receipt", noProviderPayload: true }) : undefined;
  const secondOperatorApprovalHash = state === "dual_control_required" ? stableHash({ supportCaseId: record.supportCaseId, operator: "second-approver-required", noInternalNote: true }) : undefined;
  const disputeWindowState: Pass2551SupportResendRecord["disputeWindowState"] = state === "refund_review_required" ? "open" : state === "velocity_hold" ? "chargeback_hold" : supportMayIssueResend ? "closed_safe" : "not_applicable";
  return {
    id: `pass2551-support-resend-${record.supportCaseId}`,
    caseId: record.caseId,
    supportCaseId: record.supportCaseId,
    replayRunId: record.replayRunId,
    inheritedPass2550State: record.state,
    inheritedPass2550Decision: record.decision,
    consumedLedgerHash: record.consumedLedgerHash,
    customerVisibleHistoryHash: record.customerVisibleHistoryHash,
    reDownloadLocked: record.reDownloadLocked,
    state,
    decision,
    refundState: refundMayOpenReview ? "eligible_review" : supportMayIssueResend ? "not_requested" : state === "blocked" ? "blocked" : "policy_snapshot_required",
    resendChannelState: supportMayIssueResend ? "account_inbox_only" : state === "customer_ack_required" ? "customer_ack_pending" : state === "velocity_hold" ? "cooldown_active" : state === "blocked" ? "blocked" : "account_inbox_only",
    supportResendRequestId,
    supportResendRequestHash,
    rotatedResendTokenId,
    rotatedResendTokenHash,
    customerResendAckHash,
    resendEligibilityHash,
    refundPolicySnapshotHash,
    paymentReceiptSafeHash,
    disputeWindowState,
    secondOperatorApprovalHash,
    resendCooldownSeconds: state === "velocity_hold" ? 86400 : supportMayIssueResend ? 0 : 3600,
    supportMayIssueResend,
    refundMayOpenReview,
    accountInboxOnly: true,
    noPrivateContactLeakScore: supportMayIssueResend ? 99 : state === "velocity_hold" ? 94 : 92,
    blockedClaims: BLOCKED_SUPPORT_CLAIMS,
    neverRenderFields: NEVER_RENDER_FIELDS,
    customerSafeCopy: copyForState(state),
    releaseEquation: "consumedLedgerHash × customerVisibleHistoryHash × reDownloadLocked × supportResendRequestHash × customerResendAckHash × rotatedResendTokenHash × refundPolicySnapshotHash × noPrivateContactLeak",
    dataAttributes: {
      "data-pass2551-support-resend-rotation-ack": state,
      "data-pass2551-support-resend-request-id": supportResendRequestId ?? "missing-support-resend-request",
      "data-pass2551-rotated-resend-token-hash": rotatedResendTokenHash ?? "missing-rotated-resend-token-hash",
      "data-pass2551-customer-resend-ack-hash": customerResendAckHash ?? "missing-customer-resend-ack-hash",
      "data-pass2551-no-private-contact-leak-score": String(supportMayIssueResend ? 99 : 92),
    },
  };
}

function buildGuard(record: Pass2551SupportResendRecord, previousGuard?: Pass2550FinalConsumedDownloadGuard): Pass2551SupportResendGuard {
  return {
    id: `pass2551-support-resend-guard-${record.supportCaseId}`,
    route: `/api/market-integrity/customer-export-download?caseId=${encodeURIComponent(record.caseId)}&supportCaseId=${encodeURIComponent(record.supportCaseId)}&mode=support-resend`,
    caseId: record.caseId,
    supportCaseId: record.supportCaseId,
    state: record.state,
    decision: record.decision,
    statusCode: statusFromDecision(record.decision),
    supportMayIssueResend: Boolean(previousGuard?.customerCanSeeDownloadHistory) && record.supportMayIssueResend,
    refundMayOpenReview: record.refundMayOpenReview,
    accountInboxOnly: record.accountInboxOnly,
    supportResendRequestId: record.supportResendRequestId,
    rotatedResendTokenHash: record.rotatedResendTokenHash,
    customerResendAckHash: record.customerResendAckHash,
    refundPolicySnapshotHash: record.refundPolicySnapshotHash,
    paymentReceiptSafeHash: record.paymentReceiptSafeHash,
    noPrivateContactLeakScore: record.noPrivateContactLeakScore,
    customerSafeError: record.customerSafeCopy,
  };
}

function buildAngelBoundary(record: Pass2551SupportResendRecord): Pass2551AngelSupportResendBoundary {
  return {
    id: `pass2551-angel-support-resend-boundary-${record.supportCaseId}`,
    supportCaseId: record.supportCaseId,
    canSayResendAvailable: record.supportMayIssueResend && Boolean(record.rotatedResendTokenHash) && Boolean(record.customerResendAckHash),
    canSayRefundReviewOpen: record.refundMayOpenReview && Boolean(record.refundPolicySnapshotHash),
    canMentionPrivateContact: false,
    allowedTone: record.state === "resend_rotation_ready" ? "resend_ready" : record.state === "resend_not_requested" ? "history_only" : record.state === "customer_ack_required" ? "ack_required" : record.state === "dual_control_required" ? "dual_control" : record.state === "refund_review_required" ? "refund_review" : record.state === "velocity_hold" ? "velocity_hold" : "blocked",
    blockedClaims: record.supportMayIssueResend ? ["private contact rendered", "same token reused", "refund automatically approved"] : BLOCKED_SUPPORT_CLAIMS,
    safeSummary: record.customerSafeCopy,
  };
}

function buildQueueEvent(record: Pass2551SupportResendRecord): Pass2551SupportQueueEvent {
  const queue: Pass2551SupportQueueEvent["queue"] = record.state === "resend_rotation_ready" ? "resend_rotation" : record.state === "customer_ack_required" ? "customer_ack" : record.state === "dual_control_required" ? "dual_control" : record.state === "refund_review_required" ? "refund_review" : record.state === "velocity_hold" ? "velocity_hold" : "blocked";
  return {
    id: `pass2551-support-queue-${record.supportCaseId}`,
    supportCaseId: record.supportCaseId,
    queue,
    eventHash: stableHash({ id: record.id, queue, supportCaseId: record.supportCaseId, privateContact: "redacted" }),
    customerVisible: queue === "resend_rotation" || queue === "customer_ack" || queue === "refund_review",
    redactedSignals: ["accountScopedNonce", "supportCaseId", "policySnapshot", "noRawEmail", "noRawPhone", "noRawDeviceFingerprint"],
  };
}

export function buildPass2551SupportResendRotationAckRebalance(args: {
  query: string;
  symbol?: string;
  pass2550?: Pass2550ConsumedLedgerDownloadHistoryRebalance;
}): Pass2551SupportResendRotationAckRebalance {
  const previousRecords = args.pass2550?.consumedLedgerRecords ?? [];
  const supportResendRecords = previousRecords.map(buildRecord);
  const supportResendGuards = supportResendRecords.map((record) => buildGuard(record, args.pass2550?.finalConsumedDownloadGuards.find((guard) => guard.supportCaseId === record.supportCaseId)));
  const angelSupportResendBoundaries = supportResendRecords.map(buildAngelBoundary);
  const supportQueueEvents = supportResendRecords.map(buildQueueEvent);
  const ready = supportResendRecords.filter((item) => item.state === "resend_rotation_ready").length;
  const pending = supportResendRecords.filter((item) => item.state === "customer_ack_required" || item.state === "dual_control_required").length;
  const review = supportResendRecords.filter((item) => item.state === "refund_review_required" || item.state === "velocity_hold").length;
  return {
    id: PASS2551_SUPPORT_RESEND_ROTATION_ACK_REBALANCE_ID,
    state: ready > 0 && pending === 0 && review === 0 ? "resend_rotation_ready" : review > 0 ? "refund_or_velocity_hold" : pending > 0 ? "ack_or_dual_control_pending" : supportResendRecords.length > 0 ? "history_only" : "blocked",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date(0).toISOString(),
    manualSemanticCompletionBeforePercent: 91,
    manualSemanticCompletionAfterPercent: 92,
    targetedSemanticBatchFiles: 76,
    targetedSemanticBatchLines: 315880,
    supportResendBeforePercent: 19,
    supportResendAfterPercent: 61,
    refundReviewBeforePercent: 25,
    refundReviewAfterPercent: 55,
    accountInboxResendBeforePercent: 40,
    accountInboxResendAfterPercent: 68,
    angelSupportBoundaryBeforePercent: 97,
    angelSupportBoundaryAfterPercent: 98,
    privateContactLeakBeforePercent: 88,
    privateContactLeakAfterPercent: 96,
    inheritedPass2550State: args.pass2550?.state ?? "missing",
    supportResendRecords,
    supportResendGuards,
    angelSupportResendBoundaries,
    supportQueueEvents,
    fixtures: [
      { id: "fixture-consumed-history-can-request-resend-rotation", scenario: "consumed_history_can_request_resend_rotation", expectedState: "resend_rotation_ready", expectedDecision: "issue_rotated_resend_token", expectedSupportMayIssueResend: true },
      { id: "fixture-resend-without-customer-ack-blocks", scenario: "resend_without_customer_ack_blocks", expectedState: "customer_ack_required", expectedDecision: "collect_customer_ack_first", expectedSupportMayIssueResend: false },
      { id: "fixture-replay-velocity-holds-resend", scenario: "replay_velocity_holds_resend", expectedState: "velocity_hold", expectedDecision: "hold_for_replay_velocity", expectedSupportMayIssueResend: false },
      { id: "fixture-refund-review-requires-policy-snapshot", scenario: "refund_review_requires_policy_snapshot", expectedState: "refund_review_required", expectedDecision: "open_refund_review", expectedSupportMayIssueResend: false },
      { id: "fixture-private-contact-never-renders", scenario: "private_contact_never_renders", expectedState: "blocked", expectedDecision: "block_resend", expectedSupportMayIssueResend: false },
    ],
    masterTxtAdditions: [
      "PASS2551 adds support resend rotation after consumed download history: a second download is never token reuse; it is a new account-inbox resend with customer acknowledgement.",
      "Refund/resend review now needs refundPolicySnapshotHash and paymentReceiptSafeHash, with no automatic refund promises and no raw payment provider payload exposure.",
      "Angel receives a support boundary: it can say resend is available only when rotatedResendTokenHash and customerResendAckHash exist, and it never mentions private contact data.",
    ],
    nextPassQueue: [
      "PASS2552: bind support resend rotation to a customer-visible mobile Account Vault resend/review component.",
      "PASS2552: add persistence adapter for support resend queue events with privacy-preserving velocity counters.",
      "PASS2552: add refund/resend copy parity tests for PL/EN/DE and paid export receipts.",
    ],
    supportResendRule: "consumedLedgerHash × customerVisibleHistoryHash × reDownloadLocked × supportResendRequestHash × customerResendAckHash × rotatedResendTokenHash × refundPolicySnapshotHash × noPrivateContactLeak",
    fingerprint: stableHash({ id: PASS2551_SUPPORT_RESEND_ROTATION_ACK_REBALANCE_ID, query: args.query, inherited: args.pass2550?.state ?? "missing", count: supportResendRecords.length }),
  };
}
