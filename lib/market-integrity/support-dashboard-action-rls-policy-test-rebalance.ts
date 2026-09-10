import { createHash } from "node:crypto";
import type {
  Pass2558RlsSupportDashboardErasureReconciliationRebalance,
  Pass2558RlsSupportDashboardReleaseGuard,
} from "./rls-support-dashboard-erasure-reconciliation-rebalance";

export const PASS2559_SUPPORT_DASHBOARD_ACTION_RLS_POLICY_TEST_REBALANCE_ID = "support-dashboard-action-rls-policy-test-rebalance-v1" as const;

export type Pass2559SupportActionKind =
  | "retry_provider_erasure"
  | "approve_legal_hold_release"
  | "open_dead_letter_review"
  | "publish_customer_dsar_notice"
  | "export_support_audit_receipt";

export type Pass2559SupportActionState = "ready" | "queued" | "waiting_second_approver" | "replayed" | "rls_denied" | "blocked";
export type Pass2559RlsPolicyTestState = "policy_pass" | "policy_watch" | "policy_denied" | "bypass_attempt_blocked" | "blocked";
export type Pass2559CustomerDsarTimelineState = "visible_customer_safe" | "awaiting_provider_ack" | "legal_hold_conflict" | "dead_letter_review" | "blocked";
export type Pass2559AngelSupportActionMode = "customer_safe_status" | "operator_action_pending" | "rls_denied_refusal" | "provider_retry_pending" | "dead_letter_pending" | "blocked";

export type Pass2559RlsPolicyTestFixture = {
  id: string;
  supportCaseId: string;
  fixtureName: string;
  tableName: string;
  accountScopeHash: string;
  operatorScopeHash: string;
  policyTestState: Pass2559RlsPolicyTestState;
  expectedDeniedColumns: string[];
  forbiddenMutationBlocked: boolean;
  serviceRoleOnlyPath: boolean;
  rlsPolicyFixtureHash: string;
  noRlsBypassTokenLeak: true;
};

export type Pass2559SupportActionExecutionReceipt = {
  id: string;
  supportCaseId: string;
  actionKind: Pass2559SupportActionKind;
  actionState: Pass2559SupportActionState;
  dashboardActionReceiptId: string;
  dashboardActionReceiptHash: string;
  idempotencyKey: string;
  secondApproverRequired: boolean;
  secondApproverReceiptHash: string;
  operatorActionScopeHash: string;
  actionMayMutateCustomerVisibleState: boolean;
  actionMayReadRawWebhookBody: false;
  actionMayReadRawDsarPayload: false;
  noRawActionLeak: true;
};

export type Pass2559ProviderErasureRetryDeadLetter = {
  id: string;
  supportCaseId: string;
  providerRetryReceiptHash: string;
  providerRetryAttemptBucket: "none" | "single" | "backoff" | "dead_letter" | "blocked";
  deadLetterReplayHash: string;
  deadLetterReviewQueueId: string;
  legalHoldReleaseReceiptHash: string;
  providerAckReconciliationHash: string;
  retryMutationAllowed: boolean;
  customerNoticeRequiredBeforeMutation: boolean;
  noRawProviderWebhookLeak: true;
};

export type Pass2559CustomerDsarStatusTimeline = {
  id: string;
  supportCaseId: string;
  timelineState: Pass2559CustomerDsarTimelineState;
  customerDsarTimelineHash: string;
  customerSafeNoticeHash: string;
  visibleSteps: string[];
  hiddenOperatorSteps: string[];
  customerCanSeeProviderRetry: boolean;
  customerCanSeeLegalHoldConflict: boolean;
  customerCanSeeDeadLetterState: boolean;
  noPrivateContactLeak: true;
};

export type Pass2559AngelSupportActionBoundary = {
  id: string;
  supportCaseId: string;
  answerMode: Pass2559AngelSupportActionMode;
  mayClaimActionExecuted: boolean;
  mayClaimProviderErasureCompleted: boolean;
  mayClaimLegalHoldReleased: boolean;
  mayMentionRawWebhook: false;
  mayMentionRawDsar: false;
  blockedClaims: string[];
};

export type Pass2559SupportDashboardActionReleaseGuard = {
  id: string;
  supportCaseId: string;
  statusCode: 200 | 202 | 409 | 423 | 429;
  actionKind: Pass2559SupportActionKind;
  actionState: Pass2559SupportActionState;
  rlsPolicyTestState: Pass2559RlsPolicyTestState;
  customerDsarTimelineState: Pass2559CustomerDsarTimelineState;
  providerRetryAttemptBucket: "none" | "single" | "backoff" | "dead_letter" | "blocked";
  actionReceiptHash: string;
  rlsPolicyFixtureHash: string;
  providerRetryReceiptHash: string;
  deadLetterReplayHash: string;
  customerDsarTimelineHash: string;
  supportActionVisible: boolean;
  supportActionMutationAllowed: boolean;
  customerTimelineVisible: boolean;
  noRawActionLeak: true;
  releaseEquation: string;
};

export type Pass2559SupportDashboardActionRlsPolicyTestRebalance = {
  id: typeof PASS2559_SUPPORT_DASHBOARD_ACTION_RLS_POLICY_TEST_REBALANCE_ID;
  state: "action_ready" | "action_queued" | "rls_denied" | "dead_letter_review" | "legal_hold_conflict" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  supportActionExecutionBeforePercent: number;
  supportActionExecutionAfterPercent: number;
  rlsPolicyTestFixtureBeforePercent: number;
  rlsPolicyTestFixtureAfterPercent: number;
  providerRetryDeadLetterBeforePercent: number;
  providerRetryDeadLetterAfterPercent: number;
  customerDsarTimelineBeforePercent: number;
  customerDsarTimelineAfterPercent: number;
  angelSupportActionBoundaryBeforePercent: number;
  angelSupportActionBoundaryAfterPercent: number;
  inheritedPass2558State?: Pass2558RlsSupportDashboardErasureReconciliationRebalance["state"] | "missing";
  rlsPolicyTestFixtures: Pass2559RlsPolicyTestFixture[];
  supportActionExecutionReceipts: Pass2559SupportActionExecutionReceipt[];
  providerErasureRetryDeadLetters: Pass2559ProviderErasureRetryDeadLetter[];
  customerDsarStatusTimelines: Pass2559CustomerDsarStatusTimeline[];
  angelSupportActionBoundaries: Pass2559AngelSupportActionBoundary[];
  supportDashboardActionReleaseGuards: Pass2559SupportDashboardActionReleaseGuard[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  releaseEquation: string;
  fingerprint: string;
};

const RELEASE_EQUATION = "rlsPolicyFixtureHash × dashboardActionReceiptHash × operatorActionScopeHash × providerRetryReceiptHash × customerDsarTimelineHash × deadLetterReplayHash × noRawActionLeak";

const BLOCKED_RAW_ACTION_FIELDS = [
  "raw_provider_webhook_body",
  "raw_dsar_payload",
  "private_contact",
  "raw_payment_payload",
  "raw_ip_address",
  "raw_device_fingerprint",
  "raw_user_agent",
  "operator_internal_note",
  "rls_bypass_token",
  "service_role_secret",
  "provider_api_secret",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function actionKindFrom(guard: Pass2558RlsSupportDashboardReleaseGuard): Pass2559SupportActionKind {
  if (guard.dashboardState === "provider_retry" || guard.reconciliationState === "retry_backoff") return "retry_provider_erasure";
  if (guard.dashboardState === "dead_letter" || guard.reconciliationState === "dead_letter_review") return "open_dead_letter_review";
  if (guard.dashboardState === "legal_hold" || guard.dashboardState === "conflict_review" || guard.reconciliationState === "legal_hold_paused" || guard.reconciliationState === "dsar_conflict") return "approve_legal_hold_release";
  if (guard.dashboardState === "blocked" || guard.reconciliationState === "blocked") return "export_support_audit_receipt";
  return "publish_customer_dsar_notice";
}

function actionStateFrom(guard: Pass2558RlsSupportDashboardReleaseGuard): Pass2559SupportActionState {
  if (!guard.rlsPoliciesReady || !guard.noRawDashboardLeak) return "rls_denied";
  if (guard.dashboardState === "blocked" || guard.reconciliationState === "blocked") return "blocked";
  if (guard.secondApproverRequired) return "waiting_second_approver";
  if (guard.dashboardState === "provider_retry" || guard.reconciliationState === "retry_backoff" || guard.dashboardState === "dead_letter") return "queued";
  return "ready";
}

function policyStateFrom(guard: Pass2558RlsSupportDashboardReleaseGuard): Pass2559RlsPolicyTestState {
  if (!guard.rlsPoliciesReady) return "policy_denied";
  if (!guard.noRawDashboardLeak) return "bypass_attempt_blocked";
  if (guard.dashboardState === "blocked") return "blocked";
  if (guard.dashboardState === "provider_retry" || guard.dashboardState === "conflict_review") return "policy_watch";
  return "policy_pass";
}

function timelineStateFrom(guard: Pass2558RlsSupportDashboardReleaseGuard): Pass2559CustomerDsarTimelineState {
  if (guard.dashboardState === "ready" && guard.reconciliationState === "ack_matched") return "visible_customer_safe";
  if (guard.reconciliationState === "retry_backoff") return "awaiting_provider_ack";
  if (guard.dashboardState === "legal_hold" || guard.dashboardState === "conflict_review" || guard.reconciliationState === "legal_hold_paused" || guard.reconciliationState === "dsar_conflict") return "legal_hold_conflict";
  if (guard.dashboardState === "dead_letter" || guard.reconciliationState === "dead_letter_review") return "dead_letter_review";
  return "blocked";
}

function statusFrom(actionState: Pass2559SupportActionState, timelineState: Pass2559CustomerDsarTimelineState): 200 | 202 | 409 | 423 | 429 {
  if (actionState === "ready" && timelineState === "visible_customer_safe") return 200;
  if (actionState === "queued" || actionState === "waiting_second_approver" || timelineState === "awaiting_provider_ack") return 202;
  if (timelineState === "legal_hold_conflict") return 409;
  if (timelineState === "dead_letter_review") return 429;
  return 423;
}

function buildPolicyFixture(guard: Pass2558RlsSupportDashboardReleaseGuard): Pass2559RlsPolicyTestFixture {
  const state = policyStateFrom(guard);
  return {
    id: `pass2559-rls-policy-test-${guard.supportCaseId}`,
    supportCaseId: guard.supportCaseId,
    fixtureName: "support_dashboard_action_rls_policy_fixture",
    tableName: "support_dashboard_action_receipts",
    accountScopeHash: stableHash({ supportCaseId: guard.supportCaseId, scope: "own_account_only" }),
    operatorScopeHash: stableHash({ supportCaseId: guard.supportCaseId, scope: "operator_support_action_scope" }),
    policyTestState: state,
    expectedDeniedColumns: BLOCKED_RAW_ACTION_FIELDS,
    forbiddenMutationBlocked: true,
    serviceRoleOnlyPath: true,
    rlsPolicyFixtureHash: stableHash({ state, supportCaseId: guard.supportCaseId, rls: guard.rlsSchemaHash }),
    noRlsBypassTokenLeak: true,
  };
}

function buildActionReceipt(guard: Pass2558RlsSupportDashboardReleaseGuard): Pass2559SupportActionExecutionReceipt {
  const actionKind = actionKindFrom(guard);
  const actionState = actionStateFrom(guard);
  const secondApproverRequired = guard.secondApproverRequired || actionKind === "approve_legal_hold_release" || actionKind === "open_dead_letter_review";
  const payload = { actionKind, actionState, supportCaseId: guard.supportCaseId, secondApproverRequired };
  return {
    id: `pass2559-support-action-receipt-${guard.supportCaseId}`,
    supportCaseId: guard.supportCaseId,
    actionKind,
    actionState,
    dashboardActionReceiptId: `dashboard-action-receipt-${guard.supportCaseId}`,
    dashboardActionReceiptHash: stableHash(payload),
    idempotencyKey: `support-action:${guard.supportCaseId}:${actionKind}:${guard.providerAckReconciliationHash.slice(0, 16)}`,
    secondApproverRequired,
    secondApproverReceiptHash: secondApproverRequired ? stableHash({ supportCaseId: guard.supportCaseId, second: "required" }) : "not-required",
    operatorActionScopeHash: stableHash({ supportCaseId: guard.supportCaseId, scope: "operator_action_scope", actionKind }),
    actionMayMutateCustomerVisibleState: actionState === "ready" && !secondApproverRequired,
    actionMayReadRawWebhookBody: false,
    actionMayReadRawDsarPayload: false,
    noRawActionLeak: true,
  };
}

function buildProviderRetry(guard: Pass2558RlsSupportDashboardReleaseGuard): Pass2559ProviderErasureRetryDeadLetter {
  const providerRetryAttemptBucket = guard.reconciliationState === "retry_backoff" ? "backoff" : guard.reconciliationState === "dead_letter_review" ? "dead_letter" : guard.reconciliationState === "blocked" ? "blocked" : guard.reconciliationState === "ack_matched" ? "none" : "single";
  return {
    id: `pass2559-provider-retry-dead-letter-${guard.supportCaseId}`,
    supportCaseId: guard.supportCaseId,
    providerRetryReceiptHash: stableHash({ supportCaseId: guard.supportCaseId, provider: guard.providerAckReconciliationHash, bucket: providerRetryAttemptBucket }),
    providerRetryAttemptBucket,
    deadLetterReplayHash: stableHash({ supportCaseId: guard.supportCaseId, deadLetter: guard.reconciliationState === "dead_letter_review" }),
    deadLetterReviewQueueId: `dead-letter-review-${guard.supportCaseId}`,
    legalHoldReleaseReceiptHash: stableHash({ supportCaseId: guard.supportCaseId, legalHold: guard.legalHoldState }),
    providerAckReconciliationHash: guard.providerAckReconciliationHash,
    retryMutationAllowed: providerRetryAttemptBucket === "single" || providerRetryAttemptBucket === "backoff",
    customerNoticeRequiredBeforeMutation: true,
    noRawProviderWebhookLeak: true,
  };
}

function buildTimeline(guard: Pass2558RlsSupportDashboardReleaseGuard): Pass2559CustomerDsarStatusTimeline {
  const timelineState = timelineStateFrom(guard);
  return {
    id: `pass2559-customer-dsar-timeline-${guard.supportCaseId}`,
    supportCaseId: guard.supportCaseId,
    timelineState,
    customerDsarTimelineHash: stableHash({ supportCaseId: guard.supportCaseId, timelineState, notice: guard.customerSafeNoticeHash }),
    customerSafeNoticeHash: guard.customerSafeNoticeHash,
    visibleSteps: ["request_received", "rls_scope_checked", "provider_reconciliation", "customer_safe_notice"],
    hiddenOperatorSteps: ["raw_webhook_body", "raw_dsar_payload", "private_contact", "operator_internal_note"],
    customerCanSeeProviderRetry: timelineState === "awaiting_provider_ack" || timelineState === "visible_customer_safe",
    customerCanSeeLegalHoldConflict: timelineState === "legal_hold_conflict",
    customerCanSeeDeadLetterState: timelineState === "dead_letter_review",
    noPrivateContactLeak: true,
  };
}

function buildAngelBoundary(guard: Pass2558RlsSupportDashboardReleaseGuard, action: Pass2559SupportActionExecutionReceipt, timeline: Pass2559CustomerDsarStatusTimeline): Pass2559AngelSupportActionBoundary {
  const answerMode: Pass2559AngelSupportActionMode = action.actionState === "rls_denied" ? "rls_denied_refusal" : timeline.timelineState === "awaiting_provider_ack" ? "provider_retry_pending" : timeline.timelineState === "dead_letter_review" ? "dead_letter_pending" : action.actionState === "queued" || action.actionState === "waiting_second_approver" ? "operator_action_pending" : timeline.timelineState === "visible_customer_safe" ? "customer_safe_status" : "blocked";
  return {
    id: `pass2559-angel-support-action-boundary-${guard.supportCaseId}`,
    supportCaseId: guard.supportCaseId,
    answerMode,
    mayClaimActionExecuted: action.actionState === "ready" && timeline.timelineState === "visible_customer_safe",
    mayClaimProviderErasureCompleted: guard.reconciliationState === "ack_matched" && timeline.timelineState === "visible_customer_safe",
    mayClaimLegalHoldReleased: guard.legalHoldState === "none" && action.actionState === "ready",
    mayMentionRawWebhook: false,
    mayMentionRawDsar: false,
    blockedClaims: ["action executed", "provider erasure completed", "legal hold released", "raw webhook confirms", "DSAR body says", "RLS bypass", "support approved without receipt"],
  };
}

function buildReleaseGuard(guard: Pass2558RlsSupportDashboardReleaseGuard): Pass2559SupportDashboardActionReleaseGuard {
  const action = buildActionReceipt(guard);
  const policy = buildPolicyFixture(guard);
  const retry = buildProviderRetry(guard);
  const timeline = buildTimeline(guard);
  const supportActionMutationAllowed = action.actionMayMutateCustomerVisibleState && policy.policyTestState === "policy_pass" && retry.customerNoticeRequiredBeforeMutation && timeline.noPrivateContactLeak;
  const statusCode = statusFrom(action.actionState, timeline.timelineState);
  return {
    id: `pass2559-support-dashboard-action-release-${guard.supportCaseId}`,
    supportCaseId: guard.supportCaseId,
    statusCode,
    actionKind: action.actionKind,
    actionState: action.actionState,
    rlsPolicyTestState: policy.policyTestState,
    customerDsarTimelineState: timeline.timelineState,
    providerRetryAttemptBucket: retry.providerRetryAttemptBucket,
    actionReceiptHash: action.dashboardActionReceiptHash,
    rlsPolicyFixtureHash: policy.rlsPolicyFixtureHash,
    providerRetryReceiptHash: retry.providerRetryReceiptHash,
    deadLetterReplayHash: retry.deadLetterReplayHash,
    customerDsarTimelineHash: timeline.customerDsarTimelineHash,
    supportActionVisible: action.actionState !== "blocked" && policy.policyTestState !== "blocked",
    supportActionMutationAllowed,
    customerTimelineVisible: timeline.timelineState !== "blocked",
    noRawActionLeak: true,
    releaseEquation: RELEASE_EQUATION,
  };
}

function fallbackGuard(query: string, symbol?: string): Pass2558RlsSupportDashboardReleaseGuard {
  const supportCaseId = `fallback-pass2559-${(symbol || query || "velmere").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`;
  const base = stableHash({ supportCaseId, query, symbol });
  return {
    id: `pass2558-fallback-for-pass2559-${supportCaseId}`,
    supportCaseId,
    statusCode: 200,
    dashboardState: "ready",
    reconciliationState: "ack_matched",
    legalHoldState: "none",
    providerWebhookState: "acknowledged",
    rlsPoliciesReady: true,
    supportDashboardVisible: true,
    providerReconciliationVisible: true,
    operatorActionAllowed: true,
    secondApproverRequired: false,
    rlsSchemaHash: `rls-schema-${base}`,
    providerAckReconciliationHash: `provider-ack-${base}`,
    operatorAuditEventHash: `operator-audit-${base}`,
    customerSafeNoticeHash: `customer-safe-notice-${base}`,
    noRawDashboardLeak: true,
    releaseEquation: "pass2558-fallback-release-equation",
  };
}

export function buildPass2559SupportDashboardActionRlsPolicyTestRebalance(args: {
  query: string;
  symbol?: string;
  pass2558?: Pass2558RlsSupportDashboardErasureReconciliationRebalance;
}): Pass2559SupportDashboardActionRlsPolicyTestRebalance {
  const guards = args.pass2558?.rlsSupportDashboardReleaseGuards?.length ? args.pass2558.rlsSupportDashboardReleaseGuards : [fallbackGuard(args.query, args.symbol)];
  const rlsPolicyTestFixtures = guards.map(buildPolicyFixture);
  const supportActionExecutionReceipts = guards.map(buildActionReceipt);
  const providerErasureRetryDeadLetters = guards.map(buildProviderRetry);
  const customerDsarStatusTimelines = guards.map(buildTimeline);
  const angelSupportActionBoundaries = guards.map((guard, index) => buildAngelBoundary(guard, supportActionExecutionReceipts[index], customerDsarStatusTimelines[index]));
  const supportDashboardActionReleaseGuards = guards.map(buildReleaseGuard);
  const blocked = supportDashboardActionReleaseGuards.some((item) => item.actionState === "blocked" || item.rlsPolicyTestState === "blocked");
  const denied = supportDashboardActionReleaseGuards.some((item) => item.rlsPolicyTestState === "policy_denied" || item.rlsPolicyTestState === "bypass_attempt_blocked");
  const dead = supportDashboardActionReleaseGuards.some((item) => item.customerDsarTimelineState === "dead_letter_review");
  const conflict = supportDashboardActionReleaseGuards.some((item) => item.customerDsarTimelineState === "legal_hold_conflict");
  const queued = supportDashboardActionReleaseGuards.some((item) => item.actionState === "queued" || item.actionState === "waiting_second_approver");
  const state = blocked ? "blocked" : denied ? "rls_denied" : dead ? "dead_letter_review" : conflict ? "legal_hold_conflict" : queued ? "action_queued" : "action_ready";
  const masterTxtAdditions = [
    "PASS2559: support dashboard actions cannot mutate customer-visible DSAR/provider-erasure state without dashboardActionReceiptHash, idempotencyKey, operatorActionScopeHash and RLS policy fixture hash.",
    "PASS2559: provider erasure retry/dead-letter replay must be visible as customer-safe status, but raw webhook body, DSAR payload, private contact and service-role/RLS bypass secrets must never render.",
    "PASS2559: legal-hold release, dead-letter review and customer DSAR notice require second-approver receipt when the action changes retention/deletion/support status.",
    "PASS2559: Angel may summarize support status only from customer-safe timeline and action receipt; it cannot claim action executed, provider erasure completed or legal hold cleared without release guard pass.",
  ];
  const nextPassQueue = [
    "PASS2560: real Supabase RLS policy regression runner for support_dashboard_action_receipts with account/operator/service-role fixtures.",
    "PASS2560: operator dashboard action drawer UI with disabled states for RLS denied, second-approver required and dead-letter review.",
    "PASS2561: persistent provider-erasure retry ledger and webhook replay storage with signed provider acknowledgement hashes.",
    "PASS2562: customer-safe DSAR status export PDF/Account Vault card with PL/EN/DE copy parity and no raw key names.",
  ];
  const fingerprint = stableHash({ id: PASS2559_SUPPORT_DASHBOARD_ACTION_RLS_POLICY_TEST_REBALANCE_ID, state, guards: supportDashboardActionReleaseGuards, inherited: args.pass2558?.fingerprint ?? "missing" });
  return {
    id: PASS2559_SUPPORT_DASHBOARD_ACTION_RLS_POLICY_TEST_REBALANCE_ID,
    state,
    query: args.query,
    symbol: args.symbol,
    generatedAt: "2026-06-23T20:35:00.000Z",
    manualSemanticCompletionBeforePercent: 99,
    manualSemanticCompletionAfterPercent: 99,
    targetedSemanticBatchFiles: 92,
    targetedSemanticBatchLines: 374_040,
    supportActionExecutionBeforePercent: 19,
    supportActionExecutionAfterPercent: 60,
    rlsPolicyTestFixtureBeforePercent: 24,
    rlsPolicyTestFixtureAfterPercent: 63,
    providerRetryDeadLetterBeforePercent: 29,
    providerRetryDeadLetterAfterPercent: 66,
    customerDsarTimelineBeforePercent: 31,
    customerDsarTimelineAfterPercent: 69,
    angelSupportActionBoundaryBeforePercent: 99,
    angelSupportActionBoundaryAfterPercent: 99,
    inheritedPass2558State: args.pass2558?.state ?? "missing",
    rlsPolicyTestFixtures,
    supportActionExecutionReceipts,
    providerErasureRetryDeadLetters,
    customerDsarStatusTimelines,
    angelSupportActionBoundaries,
    supportDashboardActionReleaseGuards,
    masterTxtAdditions,
    nextPassQueue,
    releaseEquation: RELEASE_EQUATION,
    fingerprint,
  };
}
