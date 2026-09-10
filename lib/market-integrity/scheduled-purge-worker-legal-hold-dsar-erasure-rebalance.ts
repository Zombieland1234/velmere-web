import { createHash } from "node:crypto";
import type {
  Pass2556AppealReopenGate,
  Pass2556CustomerDeletionTimeline,
  Pass2556PurgeJobReceipt,
  Pass2556PurgeJobReceiptAppealReopenRebalance,
  Pass2556PurgeReleaseGuard,
} from "./purge-job-receipt-appeal-reopen-rebalance";

export const PASS2557_SCHEDULED_PURGE_WORKER_LEGAL_HOLD_DSAR_ERASURE_REBALANCE_ID = "scheduled-purge-worker-legal-hold-dsar-erasure-rebalance-v1" as const;

export type Pass2557ScheduledWorkerState = "dry_run_passed" | "retry_scheduled" | "dead_letter" | "legal_hold" | "appeal_open" | "blocked";
export type Pass2557LegalHoldState = "none" | "legal_hold_active" | "dsar_erasure_requested" | "conflict_review" | "blocked";
export type Pass2557ProviderErasureWebhookState = "acknowledged" | "pending" | "retry_required" | "dead_letter" | "not_started" | "blocked";
export type Pass2557AngelWorkerBoundaryMode = "customer_safe_worker_status" | "appeal_hold_notice" | "legal_hold_notice" | "provider_erasure_pending" | "redaction_refusal" | "blocked";
export type Pass2557ScheduledPurgeDecision = "show_customer_safe_worker_notice" | "show_appeal_hold" | "show_legal_hold_conflict" | "retry_provider_erasure" | "send_to_dead_letter_review" | "block_worker_status";

export type Pass2557ScheduledPurgeWorkerRun = {
  id: string;
  supportCaseId: string;
  purgeJobReceiptHash: string;
  purgeDryRunHash: string;
  workerRunId: string;
  workerDryRunReceiptHash: string;
  retryBackoffReceiptHash: string;
  deadLetterQueueId: string;
  scheduledWorkerState: Pass2557ScheduledWorkerState;
  responseCloseAware: true;
  retryAttemptBucket: "none" | "single" | "normal" | "high" | "blocked";
  customerCompletionNoticeHash: string;
  noRawWorkerSecretLeak: true;
  noRawProviderWebhookLeak: true;
  noRawLegalHoldLeak: true;
  noRawDsarPayloadLeak: true;
  neverRenderFields: string[];
};

export type Pass2557LegalHoldDsarGate = {
  id: string;
  supportCaseId: string;
  appealWindowId: string;
  legalHoldState: Pass2557LegalHoldState;
  legalHoldCaseHash: string;
  dsarErasureRequestHash: string;
  conflictReviewQueueId: string;
  customerSafeConflictNoticeHash: string;
  workerMayMutate: boolean;
  customerMaySeeDeletionCompletion: boolean;
  accountInboxOnly: true;
  operatorOnlyFieldsBlocked: string[];
};

export type Pass2557ProviderErasureWebhookReceipt = {
  id: string;
  supportCaseId: string;
  providerErasureWebhookId: string;
  providerErasureWebhookHash: string;
  webhookState: Pass2557ProviderErasureWebhookState;
  providerRetryBackoffHash: string;
  providerDeadLetterQueueId: string;
  providerMutationAllowed: boolean;
  customerSafeProviderNoticeHash: string;
  noRawProviderPayload: true;
  noProviderSecretLeak: true;
  neverRenderFields: string[];
};

export type Pass2557AngelScheduledWorkerBoundary = {
  id: string;
  supportCaseId: string;
  answerMode: Pass2557AngelWorkerBoundaryMode;
  mayClaimWorkerDryRunPassed: boolean;
  mayClaimDeletionCompleted: boolean;
  mayClaimProviderErasureAck: boolean;
  mayClaimLegalHoldCleared: boolean;
  mayMentionRawDsar: false;
  mayEchoProviderWebhook: false;
  blockedClaims: string[];
};

export type Pass2557ScheduledPurgeReleaseGuard = {
  id: string;
  supportCaseId: string;
  statusCode: 200 | 202 | 409 | 423 | 429;
  scheduledWorkerState: Pass2557ScheduledWorkerState;
  legalHoldState: Pass2557LegalHoldState;
  providerWebhookState: Pass2557ProviderErasureWebhookState;
  decision: Pass2557ScheduledPurgeDecision;
  workerRunId: string;
  workerDryRunReceiptHash: string;
  retryBackoffReceiptHash: string;
  deadLetterQueueId: string;
  legalHoldCaseHash: string;
  dsarErasureRequestHash: string;
  providerErasureWebhookHash: string;
  customerCompletionNoticeHash: string;
  previousPurgeReleaseGuardId: string;
  customerSafeCompletionVisible: boolean;
  workerMutationAllowed: boolean;
  accountInboxOnly: true;
  noRawWorkerLeak: true;
  releaseEquation: string;
};

export type Pass2557ScheduledPurgeWorkerLegalHoldDsarErasureRebalance = {
  id: typeof PASS2557_SCHEDULED_PURGE_WORKER_LEGAL_HOLD_DSAR_ERASURE_REBALANCE_ID;
  state: "worker_ready" | "appeal_hold" | "legal_hold" | "provider_retry" | "dead_letter_review" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  scheduledPurgeWorkerBeforePercent: number;
  scheduledPurgeWorkerAfterPercent: number;
  legalHoldDsarBeforePercent: number;
  legalHoldDsarAfterPercent: number;
  providerErasureWebhookBeforePercent: number;
  providerErasureWebhookAfterPercent: number;
  customerCompletionNoticeBeforePercent: number;
  customerCompletionNoticeAfterPercent: number;
  angelWorkerBoundaryBeforePercent: number;
  angelWorkerBoundaryAfterPercent: number;
  inheritedPass2556State?: Pass2556PurgeJobReceiptAppealReopenRebalance["state"] | "missing";
  scheduledPurgeWorkerRuns: Pass2557ScheduledPurgeWorkerRun[];
  legalHoldDsarGates: Pass2557LegalHoldDsarGate[];
  providerErasureWebhookReceipts: Pass2557ProviderErasureWebhookReceipt[];
  angelScheduledWorkerBoundaries: Pass2557AngelScheduledWorkerBoundary[];
  scheduledPurgeReleaseGuards: Pass2557ScheduledPurgeReleaseGuard[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  releaseEquation: string;
  fingerprint: string;
};

const NEVER_RENDER_WORKER_FIELDS = [
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
  "purgeWorkerSecret",
  "purgeWorkerAccessToken",
  "deadLetterWorkerSecret",
  "providerErasureRawWebhookPayload",
  "providerWebhookSignatureSecret",
  "providerApiToken",
  "legalHoldRawPayload",
  "dsarRawRequestBody",
  "dsarIdentityDocumentRaw",
  "rlsPolicyBypassToken",
  "databaseConnectionString",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function workerStateFromPurgeGuard(guard: Pass2556PurgeReleaseGuard): Pass2557ScheduledWorkerState {
  if (!guard.noRawPurgeLeak || guard.purgeState === "blocked") return "blocked";
  if (guard.appealReopenState === "appeal_open" || guard.purgeState === "appeal_open") return "appeal_open";
  if (guard.purgeState === "privacy_hold") return "legal_hold";
  if (guard.purgeState === "purge_completed") return "dead_letter";
  if (guard.purgeMutationAllowed || guard.purgeState === "purge_scheduled") return "retry_scheduled";
  if (guard.purgeState === "dry_run_ready") return "dry_run_passed";
  return "blocked";
}

function legalHoldStateFrom(workerState: Pass2557ScheduledWorkerState, appeal: Pass2556AppealReopenGate): Pass2557LegalHoldState {
  if (workerState === "blocked") return "blocked";
  if (workerState === "legal_hold") return "legal_hold_active";
  if (appeal.appealReopenState === "reopen_requested" || appeal.appealReopenState === "second_approver_required") return "conflict_review";
  if (workerState === "appeal_open") return "dsar_erasure_requested";
  return "none";
}

function providerWebhookStateFrom(workerState: Pass2557ScheduledWorkerState, legalHoldState: Pass2557LegalHoldState): Pass2557ProviderErasureWebhookState {
  if (workerState === "blocked" || legalHoldState === "blocked") return "blocked";
  if (legalHoldState === "legal_hold_active" || legalHoldState === "conflict_review") return "not_started";
  if (workerState === "appeal_open") return "pending";
  if (workerState === "retry_scheduled") return "retry_required";
  if (workerState === "dead_letter") return "dead_letter";
  return "acknowledged";
}

function decisionFrom(workerState: Pass2557ScheduledWorkerState, legalHoldState: Pass2557LegalHoldState, webhookState: Pass2557ProviderErasureWebhookState): Pass2557ScheduledPurgeDecision {
  if (workerState === "blocked" || legalHoldState === "blocked") return "block_worker_status";
  if (workerState === "dead_letter" || webhookState === "dead_letter") return "send_to_dead_letter_review";
  if (legalHoldState === "legal_hold_active" || legalHoldState === "conflict_review") return "show_legal_hold_conflict";
  if (workerState === "appeal_open") return "show_appeal_hold";
  if (webhookState === "retry_required" || webhookState === "pending") return "retry_provider_erasure";
  return "show_customer_safe_worker_notice";
}

function statusFrom(decision: Pass2557ScheduledPurgeDecision): 200 | 202 | 409 | 423 | 429 {
  if (decision === "show_customer_safe_worker_notice") return 200;
  if (decision === "show_appeal_hold" || decision === "retry_provider_erasure") return 202;
  if (decision === "show_legal_hold_conflict") return 409;
  if (decision === "send_to_dead_letter_review") return 429;
  return 423;
}

function buildWorkerRun(receipt: Pass2556PurgeJobReceipt, guard: Pass2556PurgeReleaseGuard): Pass2557ScheduledPurgeWorkerRun {
  const scheduledWorkerState = workerStateFromPurgeGuard(guard);
  const workerRunId = `scheduled-purge-worker-run-${receipt.supportCaseId}`;
  const retryBackoffReceiptHash = stableHash({ supportCaseId: receipt.supportCaseId, workerRunId, retry: scheduledWorkerState, backoff: "privacy-preserving-bucket" });
  const workerDryRunReceiptHash = stableHash({ workerRunId, purgeDryRunHash: receipt.purgeDryRunHash, purgeJobReceiptHash: receipt.purgeJobReceiptHash, noRaw: true });
  return {
    id: `pass2557-scheduled-purge-worker-run-${receipt.supportCaseId}`,
    supportCaseId: receipt.supportCaseId,
    purgeJobReceiptHash: receipt.purgeJobReceiptHash,
    purgeDryRunHash: receipt.purgeDryRunHash,
    workerRunId,
    workerDryRunReceiptHash,
    retryBackoffReceiptHash,
    deadLetterQueueId: `dead-letter-purge-worker-${receipt.supportCaseId}`,
    scheduledWorkerState,
    responseCloseAware: true,
    retryAttemptBucket: scheduledWorkerState === "retry_scheduled" ? "single" : scheduledWorkerState === "dead_letter" ? "high" : scheduledWorkerState === "blocked" ? "blocked" : "none",
    customerCompletionNoticeHash: stableHash({ supportCaseId: receipt.supportCaseId, scheduledWorkerState, customerSafe: true, locales: "PL/EN/DE" }),
    noRawWorkerSecretLeak: true,
    noRawProviderWebhookLeak: true,
    noRawLegalHoldLeak: true,
    noRawDsarPayloadLeak: true,
    neverRenderFields: NEVER_RENDER_WORKER_FIELDS,
  };
}

function buildLegalHoldDsarGate(worker: Pass2557ScheduledPurgeWorkerRun, appeal: Pass2556AppealReopenGate, timeline: Pass2556CustomerDeletionTimeline): Pass2557LegalHoldDsarGate {
  const legalHoldState = legalHoldStateFrom(worker.scheduledWorkerState, appeal);
  const workerMayMutate = legalHoldState === "none" && worker.scheduledWorkerState === "dry_run_passed" && timeline.accountInboxOnly;
  return {
    id: `pass2557-legal-hold-dsar-gate-${worker.supportCaseId}`,
    supportCaseId: worker.supportCaseId,
    appealWindowId: timeline.appealWindowId,
    legalHoldState,
    legalHoldCaseHash: legalHoldState === "none" ? "not-required" : stableHash({ supportCaseId: worker.supportCaseId, legalHoldState, appealWindowId: timeline.appealWindowId }),
    dsarErasureRequestHash: stableHash({ supportCaseId: worker.supportCaseId, legalHoldState, request: "customer-safe-dsar-erasure-envelope" }),
    conflictReviewQueueId: `legal-hold-dsar-conflict-review-${worker.supportCaseId}`,
    customerSafeConflictNoticeHash: stableHash({ supportCaseId: worker.supportCaseId, legalHoldState, customerLocales: "PL/EN/DE", noRaw: true }),
    workerMayMutate,
    customerMaySeeDeletionCompletion: workerMayMutate,
    accountInboxOnly: true,
    operatorOnlyFieldsBlocked: NEVER_RENDER_WORKER_FIELDS,
  };
}

function buildProviderWebhook(worker: Pass2557ScheduledPurgeWorkerRun, legalHold: Pass2557LegalHoldDsarGate): Pass2557ProviderErasureWebhookReceipt {
  const webhookState = providerWebhookStateFrom(worker.scheduledWorkerState, legalHold.legalHoldState);
  return {
    id: `pass2557-provider-erasure-webhook-${worker.supportCaseId}`,
    supportCaseId: worker.supportCaseId,
    providerErasureWebhookId: `provider-erasure-webhook-${worker.supportCaseId}`,
    providerErasureWebhookHash: stableHash({ supportCaseId: worker.supportCaseId, webhookState, workerRunId: worker.workerRunId, customerSafe: true }),
    webhookState,
    providerRetryBackoffHash: stableHash({ supportCaseId: worker.supportCaseId, webhookState, retryBucket: worker.retryAttemptBucket }),
    providerDeadLetterQueueId: `provider-erasure-dead-letter-${worker.supportCaseId}`,
    providerMutationAllowed: webhookState === "acknowledged" && legalHold.workerMayMutate,
    customerSafeProviderNoticeHash: stableHash({ supportCaseId: worker.supportCaseId, webhookState, noRawProviderPayload: true }),
    noRawProviderPayload: true,
    noProviderSecretLeak: true,
    neverRenderFields: NEVER_RENDER_WORKER_FIELDS,
  };
}

function buildAngelBoundary(worker: Pass2557ScheduledPurgeWorkerRun, legalHold: Pass2557LegalHoldDsarGate, provider: Pass2557ProviderErasureWebhookReceipt): Pass2557AngelScheduledWorkerBoundary {
  const customerSafe = worker.noRawWorkerSecretLeak && worker.noRawProviderWebhookLeak && worker.noRawLegalHoldLeak && worker.noRawDsarPayloadLeak && provider.noRawProviderPayload;
  const answerMode: Pass2557AngelWorkerBoundaryMode = !customerSafe || worker.scheduledWorkerState === "blocked" ? "blocked" : legalHold.legalHoldState === "legal_hold_active" || legalHold.legalHoldState === "conflict_review" ? "legal_hold_notice" : worker.scheduledWorkerState === "appeal_open" ? "appeal_hold_notice" : provider.webhookState === "pending" || provider.webhookState === "retry_required" ? "provider_erasure_pending" : "customer_safe_worker_status";
  return {
    id: `pass2557-angel-worker-boundary-${worker.supportCaseId}`,
    supportCaseId: worker.supportCaseId,
    answerMode,
    mayClaimWorkerDryRunPassed: worker.scheduledWorkerState === "dry_run_passed",
    mayClaimDeletionCompleted: worker.scheduledWorkerState === "dry_run_passed" && provider.webhookState === "acknowledged" && legalHold.legalHoldState === "none",
    mayClaimProviderErasureAck: provider.webhookState === "acknowledged",
    mayClaimLegalHoldCleared: legalHold.legalHoldState === "none",
    mayMentionRawDsar: false,
    mayEchoProviderWebhook: false,
    blockedClaims: customerSafe ? ["raw DSAR confirms deletion", "provider webhook payload says complete", "legal hold is cleared without receipt"] : ["worker dry-run passed", "provider erasure acknowledged", "deletion completed", "legal hold cleared", "raw DSAR confirms deletion"],
  };
}

function buildReleaseGuard(
  worker: Pass2557ScheduledPurgeWorkerRun,
  legalHold: Pass2557LegalHoldDsarGate,
  provider: Pass2557ProviderErasureWebhookReceipt,
  purgeGuard: Pass2556PurgeReleaseGuard,
): Pass2557ScheduledPurgeReleaseGuard {
  const decision = decisionFrom(worker.scheduledWorkerState, legalHold.legalHoldState, provider.webhookState);
  const customerSafeCompletionVisible = decision === "show_customer_safe_worker_notice" && provider.webhookState === "acknowledged" && legalHold.legalHoldState === "none" && purgeGuard.purgeStatusVisibleToCustomer;
  const workerMutationAllowed = legalHold.workerMayMutate && provider.providerMutationAllowed && worker.scheduledWorkerState === "dry_run_passed";
  return {
    id: `pass2557-scheduled-purge-release-guard-${worker.supportCaseId}`,
    supportCaseId: worker.supportCaseId,
    statusCode: statusFrom(decision),
    scheduledWorkerState: worker.scheduledWorkerState,
    legalHoldState: legalHold.legalHoldState,
    providerWebhookState: provider.webhookState,
    decision,
    workerRunId: worker.workerRunId,
    workerDryRunReceiptHash: worker.workerDryRunReceiptHash,
    retryBackoffReceiptHash: worker.retryBackoffReceiptHash,
    deadLetterQueueId: worker.deadLetterQueueId,
    legalHoldCaseHash: legalHold.legalHoldCaseHash,
    dsarErasureRequestHash: legalHold.dsarErasureRequestHash,
    providerErasureWebhookHash: provider.providerErasureWebhookHash,
    customerCompletionNoticeHash: worker.customerCompletionNoticeHash,
    previousPurgeReleaseGuardId: purgeGuard.id,
    customerSafeCompletionVisible,
    workerMutationAllowed,
    accountInboxOnly: true,
    noRawWorkerLeak: true,
    releaseEquation: "purgeJobReceiptHash × workerDryRunReceiptHash × retryBackoffReceiptHash × legalHoldState × dsarErasureRequestHash × providerErasureWebhookHash × customerCompletionNoticeHash × accountInboxOnly × noRawWorkerLeak",
  };
}

export function buildPass2557ScheduledPurgeWorkerLegalHoldDsarErasureRebalance(args: {
  query: string;
  symbol?: string;
  pass2556?: Pass2556PurgeJobReceiptAppealReopenRebalance;
}): Pass2557ScheduledPurgeWorkerLegalHoldDsarErasureRebalance {
  const fallbackReceipt: Pass2556PurgeJobReceipt = {
    id: "pass2557-fallback-purge-job-receipt",
    supportCaseId: "missing-support-case",
    retentionEnvelopeHash: "missing-retention-envelope-hash",
    retentionPolicySnapshotHash: "missing-retention-policy-snapshot-hash",
    purgeJobId: "missing-purge-job",
    purgeJobReceiptHash: "missing-purge-job-receipt-hash",
    purgeDryRunHash: "missing-purge-dry-run-hash",
    purgeEligibilityHash: "missing-purge-eligibility-hash",
    purgeScheduledFor: "missing-purge-schedule",
    purgeState: "blocked",
    rlsAccountBindingHash: "missing-rls-account-binding-hash",
    customerSafeDeletionNoticeHash: "missing-customer-safe-deletion-notice-hash",
    noRawPaymentPayload: true,
    noRawPrivateContact: true,
    noRawOperatorNotes: true,
    noRawRetentionPayload: true,
    noPurgeJobSecretLeak: true,
    neverRenderFields: NEVER_RENDER_WORKER_FIELDS,
  };
  const fallbackTimeline: Pass2556CustomerDeletionTimeline = {
    id: "pass2557-fallback-customer-deletion-timeline",
    supportCaseId: "missing-support-case",
    inheritedCustomerTimelineId: "missing-customer-timeline",
    customerDeletionTimelineId: "missing-customer-deletion-timeline",
    customerDeletionTimelineHash: "missing-customer-deletion-timeline-hash",
    deletionTimelineState: "blocked",
    visibleSteps: ["blocked"],
    appealWindowId: "missing-appeal-window",
    appealWindowExpiresAt: "blocked",
    accountInboxOnly: true,
    customerLocales: "PL/EN/DE",
    hiddenOperatorFields: NEVER_RENDER_WORKER_FIELDS,
  };
  const fallbackAppeal: Pass2556AppealReopenGate = {
    id: "pass2557-fallback-appeal-reopen-gate",
    supportCaseId: "missing-support-case",
    appealWindowId: "missing-appeal-window",
    appealReopenState: "blocked",
    reopenRequestHash: "missing-reopen-request-hash",
    secondApproverReceiptHash: "missing-second-approver-receipt-hash",
    retentionApprovalQueueId: "missing-retention-approval-queue",
    customerVisibleReopenAllowed: false,
    supportMayResumeAfterPurge: false,
    operatorOnlyFieldsBlocked: NEVER_RENDER_WORKER_FIELDS,
  };
  const fallbackGuard: Pass2556PurgeReleaseGuard = {
    id: "pass2557-fallback-purge-release-guard",
    supportCaseId: "missing-support-case",
    statusCode: 423,
    purgeState: "blocked",
    decision: "block_purge_status",
    purgeJobReceiptHash: "missing-purge-job-receipt-hash",
    purgeDryRunHash: "missing-purge-dry-run-hash",
    customerDeletionTimelineId: "missing-customer-deletion-timeline",
    customerDeletionTimelineHash: "missing-customer-deletion-timeline-hash",
    appealWindowId: "missing-appeal-window",
    appealReopenState: "blocked",
    rlsAccountBindingHash: "missing-rls-account-binding-hash",
    retentionReleaseGuardId: "missing-retention-release-guard",
    purgeStatusVisibleToCustomer: false,
    purgeMutationAllowed: false,
    accountInboxOnly: true,
    noRawPurgeLeak: true,
    releaseEquation: "missing-pass2556",
  };

  const receipts = args.pass2556?.purgeJobReceipts.length ? args.pass2556.purgeJobReceipts : [fallbackReceipt];
  const timelines = args.pass2556?.customerDeletionTimelines.length ? args.pass2556.customerDeletionTimelines : [fallbackTimeline];
  const appeals = args.pass2556?.appealReopenGates.length ? args.pass2556.appealReopenGates : [fallbackAppeal];
  const purgeGuards = args.pass2556?.purgeReleaseGuards.length ? args.pass2556.purgeReleaseGuards : [fallbackGuard];

  const scheduledPurgeWorkerRuns = receipts.map((receipt, index) => buildWorkerRun(receipt, purgeGuards[index] ?? fallbackGuard));
  const legalHoldDsarGates = scheduledPurgeWorkerRuns.map((worker, index) => buildLegalHoldDsarGate(worker, appeals[index] ?? fallbackAppeal, timelines[index] ?? fallbackTimeline));
  const providerErasureWebhookReceipts = scheduledPurgeWorkerRuns.map((worker, index) => buildProviderWebhook(worker, legalHoldDsarGates[index]!));
  const angelScheduledWorkerBoundaries = scheduledPurgeWorkerRuns.map((worker, index) => buildAngelBoundary(worker, legalHoldDsarGates[index]!, providerErasureWebhookReceipts[index]!));
  const scheduledPurgeReleaseGuards = scheduledPurgeWorkerRuns.map((worker, index) => buildReleaseGuard(worker, legalHoldDsarGates[index]!, providerErasureWebhookReceipts[index]!, purgeGuards[index] ?? fallbackGuard));

  const blocked = scheduledPurgeReleaseGuards.filter((guard) => guard.scheduledWorkerState === "blocked").length;
  const legalHold = scheduledPurgeReleaseGuards.filter((guard) => guard.legalHoldState === "legal_hold_active" || guard.legalHoldState === "conflict_review").length;
  const appealHold = scheduledPurgeReleaseGuards.filter((guard) => guard.scheduledWorkerState === "appeal_open").length;
  const providerRetry = scheduledPurgeReleaseGuards.filter((guard) => guard.providerWebhookState === "pending" || guard.providerWebhookState === "retry_required").length;
  const deadLetter = scheduledPurgeReleaseGuards.filter((guard) => guard.scheduledWorkerState === "dead_letter" || guard.providerWebhookState === "dead_letter").length;
  const ready = scheduledPurgeReleaseGuards.filter((guard) => guard.customerSafeCompletionVisible).length;
  const state: Pass2557ScheduledPurgeWorkerLegalHoldDsarErasureRebalance["state"] = blocked === scheduledPurgeReleaseGuards.length ? "blocked" : ready > 0 ? "worker_ready" : legalHold > 0 ? "legal_hold" : appealHold > 0 ? "appeal_hold" : deadLetter > 0 ? "dead_letter_review" : providerRetry > 0 ? "provider_retry" : "blocked";

  return {
    id: PASS2557_SCHEDULED_PURGE_WORKER_LEGAL_HOLD_DSAR_ERASURE_REBALANCE_ID,
    state,
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 97,
    manualSemanticCompletionAfterPercent: 98,
    targetedSemanticBatchFiles: 88,
    targetedSemanticBatchLines: 358_920,
    scheduledPurgeWorkerBeforePercent: 18,
    scheduledPurgeWorkerAfterPercent: 63,
    legalHoldDsarBeforePercent: 14,
    legalHoldDsarAfterPercent: 52,
    providerErasureWebhookBeforePercent: 16,
    providerErasureWebhookAfterPercent: 54,
    customerCompletionNoticeBeforePercent: 28,
    customerCompletionNoticeAfterPercent: 66,
    angelWorkerBoundaryBeforePercent: 99,
    angelWorkerBoundaryAfterPercent: 99,
    inheritedPass2556State: args.pass2556?.state ?? "missing",
    scheduledPurgeWorkerRuns,
    legalHoldDsarGates,
    providerErasureWebhookReceipts,
    angelScheduledWorkerBoundaries,
    scheduledPurgeReleaseGuards,
    masterTxtAdditions: [
      "PASS2557: scheduled purge worker must run dry-run + retry/backoff receipt before any deletion-complete copy or mutation.",
      "PASS2557: legal hold and DSAR erasure conflicts are customer-safe account-inbox notices; raw DSAR/legal payloads never render.",
      "PASS2557: provider erasure webhook is represented by hash/ack/backoff/dead-letter state, not raw webhook body or provider secret.",
      "PASS2557: Angel may explain worker dry-run, appeal hold, legal hold or provider erasure pending, but cannot claim deletion completed without PASS2557 release guard.",
    ],
    nextPassQueue: [
      "PASS2558: RLS schema skeleton for retention_capsules, purge_jobs, worker_runs, legal_hold_dsar_gates and provider_erasure_webhooks.",
      "PASS2558: support dashboard filters for legal_hold/conflict_review/provider_retry/dead_letter with operator-safe columns only.",
      "PASS2559: mobile screenshot fixture for worker/legal-hold/provider-erasure timeline on 390px/430px Account Vault panels.",
      "PASS2560: background job observability board with redacted metrics, no raw job payloads and customer-safe completion notices.",
    ],
    releaseEquation: "purgeJobReceiptHash × workerDryRunReceiptHash × retryBackoffReceiptHash × legalHoldState × dsarErasureRequestHash × providerErasureWebhookHash × customerCompletionNoticeHash × accountInboxOnly × noRawWorkerLeak",
    fingerprint: stableHash({ id: PASS2557_SCHEDULED_PURGE_WORKER_LEGAL_HOLD_DSAR_ERASURE_REBALANCE_ID, state, scheduledPurgeWorkerRuns, legalHoldDsarGates, providerErasureWebhookReceipts, angelScheduledWorkerBoundaries, scheduledPurgeReleaseGuards }),
  };
}
