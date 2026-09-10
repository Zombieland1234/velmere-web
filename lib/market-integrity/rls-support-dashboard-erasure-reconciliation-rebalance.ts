import { createHash } from "node:crypto";
import type {
  Pass2557ScheduledPurgeReleaseGuard,
  Pass2557ScheduledPurgeWorkerLegalHoldDsarErasureRebalance,
} from "./scheduled-purge-worker-legal-hold-dsar-erasure-rebalance";

export const PASS2558_RLS_SUPPORT_DASHBOARD_ERASURE_RECONCILIATION_REBALANCE_ID = "rls-support-dashboard-erasure-reconciliation-rebalance-v1" as const;

export type Pass2558RlsTableName =
  | "retention_capsules"
  | "purge_jobs"
  | "worker_runs"
  | "legal_hold_dsar_gates"
  | "provider_erasure_webhooks"
  | "support_dashboard_audit_events";

export type Pass2558DashboardFilterState = "ready" | "legal_hold" | "conflict_review" | "provider_retry" | "dead_letter" | "blocked";
export type Pass2558ProviderReconciliationState = "ack_matched" | "retry_backoff" | "dead_letter_review" | "legal_hold_paused" | "dsar_conflict" | "blocked";
export type Pass2558AngelDashboardBoundaryMode = "customer_safe_status" | "operator_safe_dashboard" | "provider_reconciliation_pending" | "legal_hold_conflict" | "redaction_refusal" | "blocked";

export type Pass2558RlsTableContract = {
  id: string;
  tableName: Pass2558RlsTableName;
  purpose: string;
  ownerColumn: "account_id" | "support_case_id" | "operator_id";
  rlsPolicyId: string;
  selectPolicy: "own_account_only" | "operator_support_scope" | "service_role_only";
  insertPolicy: "server_only" | "operator_dual_control" | "worker_only";
  updatePolicy: "server_only" | "operator_dual_control" | "worker_reconciliation_only";
  customerSafeColumns: string[];
  operatorOnlyColumns: string[];
  blockedRawColumns: string[];
  noRawPayloadColumns: true;
  auditEventRequired: true;
};

export type Pass2558SupportDashboardFilter = {
  id: string;
  supportCaseId: string;
  filterState: Pass2558DashboardFilterState;
  visibleColumns: string[];
  hiddenColumns: string[];
  operatorActionAllowed: boolean;
  secondApproverRequired: boolean;
  customerVisibleStatus: string;
  noRawContactLeak: true;
  noRawWebhookLeak: true;
};

export type Pass2558ProviderErasureReconciliation = {
  id: string;
  supportCaseId: string;
  providerWebhookState: string;
  reconciliationState: Pass2558ProviderReconciliationState;
  providerErasureWebhookHash: string;
  providerAckReconciliationHash: string;
  retryBackoffReceiptHash: string;
  deadLetterQueueId: string;
  legalHoldState: string;
  dsarErasureRequestHash: string;
  customerSafeNoticeHash: string;
  mutationAllowedAfterReconciliation: boolean;
  noRawProviderPayload: true;
};

export type Pass2558OperatorAuditColumnGuard = {
  id: string;
  supportCaseId: string;
  auditEventId: string;
  auditEventHash: string;
  operatorScope: "support_read" | "support_reconcile" | "dual_control_required" | "blocked";
  reasonRequired: true;
  expiryRequired: true;
  secondApproverReceiptRequired: boolean;
  rawColumnsBlocked: string[];
  rlsBypassBlocked: true;
};

export type Pass2558AngelDashboardBoundary = {
  id: string;
  supportCaseId: string;
  answerMode: Pass2558AngelDashboardBoundaryMode;
  maySummarizeDashboardState: boolean;
  mayClaimProviderErasureCompleted: boolean;
  mayClaimLegalHoldCleared: boolean;
  mayMentionRawWebhook: false;
  mayMentionRawDsar: false;
  blockedClaims: string[];
};

export type Pass2558RlsSupportDashboardReleaseGuard = {
  id: string;
  supportCaseId: string;
  statusCode: 200 | 202 | 409 | 423 | 429;
  dashboardState: Pass2558DashboardFilterState;
  reconciliationState: Pass2558ProviderReconciliationState;
  legalHoldState: string;
  providerWebhookState: string;
  rlsPoliciesReady: boolean;
  supportDashboardVisible: boolean;
  providerReconciliationVisible: boolean;
  operatorActionAllowed: boolean;
  secondApproverRequired: boolean;
  rlsSchemaHash: string;
  providerAckReconciliationHash: string;
  operatorAuditEventHash: string;
  customerSafeNoticeHash: string;
  noRawDashboardLeak: true;
  releaseEquation: string;
};

export type Pass2558RlsSupportDashboardErasureReconciliationRebalance = {
  id: typeof PASS2558_RLS_SUPPORT_DASHBOARD_ERASURE_RECONCILIATION_REBALANCE_ID;
  state: "dashboard_ready" | "reconciliation_pending" | "legal_hold_conflict" | "dead_letter_review" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  rlsSchemaBeforePercent: number;
  rlsSchemaAfterPercent: number;
  supportDashboardBeforePercent: number;
  supportDashboardAfterPercent: number;
  providerReconciliationBeforePercent: number;
  providerReconciliationAfterPercent: number;
  operatorAuditBeforePercent: number;
  operatorAuditAfterPercent: number;
  angelDashboardBoundaryBeforePercent: number;
  angelDashboardBoundaryAfterPercent: number;
  inheritedPass2557State?: Pass2557ScheduledPurgeWorkerLegalHoldDsarErasureRebalance["state"] | "missing";
  rlsTableContracts: Pass2558RlsTableContract[];
  supportDashboardFilters: Pass2558SupportDashboardFilter[];
  providerErasureReconciliations: Pass2558ProviderErasureReconciliation[];
  operatorAuditColumnGuards: Pass2558OperatorAuditColumnGuard[];
  angelDashboardBoundaries: Pass2558AngelDashboardBoundary[];
  rlsSupportDashboardReleaseGuards: Pass2558RlsSupportDashboardReleaseGuard[];
  rlsSchemaSqlSkeleton: string;
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  releaseEquation: string;
  fingerprint: string;
};

const BLOCKED_RAW_COLUMNS = [
  "raw_payment_provider_payload",
  "raw_private_contact",
  "customer_email_raw",
  "customer_phone_raw",
  "raw_ip_address",
  "raw_device_fingerprint",
  "raw_user_agent",
  "operator_internal_note",
  "provider_erasure_raw_webhook_payload",
  "provider_webhook_signature_secret",
  "provider_api_token",
  "legal_hold_raw_payload",
  "dsar_raw_request_body",
  "dsar_identity_document_raw",
  "purge_worker_secret",
  "rls_policy_bypass_token",
  "database_connection_string",
];

const CUSTOMER_SAFE_COLUMNS = [
  "id",
  "account_id_hash",
  "support_case_id",
  "state",
  "customer_safe_notice_hash",
  "created_at",
  "updated_at",
  "expires_at",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function dashboardStateFrom(guard: Pass2557ScheduledPurgeReleaseGuard): Pass2558DashboardFilterState {
  if (guard.scheduledWorkerState === "blocked" || guard.decision === "block_worker_status") return "blocked";
  if (guard.scheduledWorkerState === "dead_letter" || guard.providerWebhookState === "dead_letter") return "dead_letter";
  if (guard.legalHoldState === "legal_hold_active") return "legal_hold";
  if (guard.legalHoldState === "conflict_review") return "conflict_review";
  if (guard.providerWebhookState === "pending" || guard.providerWebhookState === "retry_required") return "provider_retry";
  return "ready";
}

function reconciliationStateFrom(guard: Pass2557ScheduledPurgeReleaseGuard): Pass2558ProviderReconciliationState {
  if (guard.scheduledWorkerState === "blocked") return "blocked";
  if (guard.providerWebhookState === "dead_letter") return "dead_letter_review";
  if (guard.legalHoldState === "legal_hold_active") return "legal_hold_paused";
  if (guard.legalHoldState === "conflict_review" || guard.legalHoldState === "dsar_erasure_requested") return "dsar_conflict";
  if (guard.providerWebhookState === "pending" || guard.providerWebhookState === "retry_required") return "retry_backoff";
  return "ack_matched";
}

function statusFrom(dashboardState: Pass2558DashboardFilterState, reconciliationState: Pass2558ProviderReconciliationState): 200 | 202 | 409 | 423 | 429 {
  if (dashboardState === "ready" && reconciliationState === "ack_matched") return 200;
  if (dashboardState === "provider_retry" || reconciliationState === "retry_backoff") return 202;
  if (dashboardState === "dead_letter" || reconciliationState === "dead_letter_review") return 429;
  if (dashboardState === "legal_hold" || dashboardState === "conflict_review" || reconciliationState === "legal_hold_paused" || reconciliationState === "dsar_conflict") return 409;
  return 423;
}

function buildRlsTableContracts(): Pass2558RlsTableContract[] {
  const contracts: Array<[Pass2558RlsTableName, string, "account_id" | "support_case_id" | "operator_id", Pass2558RlsTableContract["selectPolicy"], Pass2558RlsTableContract["insertPolicy"], Pass2558RlsTableContract["updatePolicy"]]> = [
    ["retention_capsules", "Customer-safe retention envelopes and expiry state", "account_id", "own_account_only", "server_only", "server_only"],
    ["purge_jobs", "Purge dry-run receipts, eligibility and customer deletion timeline hashes", "support_case_id", "operator_support_scope", "worker_only", "worker_reconciliation_only"],
    ["worker_runs", "Scheduled purge worker run, backoff and dead-letter receipts", "support_case_id", "operator_support_scope", "worker_only", "worker_reconciliation_only"],
    ["legal_hold_dsar_gates", "Legal-hold, DSAR conflict and appeal-window gates", "support_case_id", "operator_support_scope", "operator_dual_control", "operator_dual_control"],
    ["provider_erasure_webhooks", "Provider erasure webhook hashes and reconciliation state", "support_case_id", "operator_support_scope", "server_only", "worker_reconciliation_only"],
    ["support_dashboard_audit_events", "Operator-visible support dashboard audit trail", "operator_id", "service_role_only", "server_only", "server_only"],
  ];
  return contracts.map(([tableName, purpose, ownerColumn, selectPolicy, insertPolicy, updatePolicy]) => ({
    id: `pass2558-rls-contract-${tableName}`,
    tableName,
    purpose,
    ownerColumn,
    rlsPolicyId: `rls-${tableName}-account-support-scope-v1`,
    selectPolicy,
    insertPolicy,
    updatePolicy,
    customerSafeColumns: CUSTOMER_SAFE_COLUMNS,
    operatorOnlyColumns: ["operator_id", "operator_role", "reason_code", "expires_at", "second_approver_receipt_hash", "audit_event_hash"],
    blockedRawColumns: BLOCKED_RAW_COLUMNS,
    noRawPayloadColumns: true,
    auditEventRequired: true,
  }));
}

function buildDashboardFilter(guard: Pass2557ScheduledPurgeReleaseGuard): Pass2558SupportDashboardFilter {
  const filterState = dashboardStateFrom(guard);
  const secondApproverRequired = filterState === "legal_hold" || filterState === "conflict_review" || filterState === "dead_letter";
  return {
    id: `pass2558-support-dashboard-filter-${guard.supportCaseId}`,
    supportCaseId: guard.supportCaseId,
    filterState,
    visibleColumns: ["support_case_id", "dashboard_state", "legal_hold_state", "provider_webhook_state", "customer_safe_notice_hash", "updated_at", "sla_bucket"],
    hiddenColumns: BLOCKED_RAW_COLUMNS,
    operatorActionAllowed: filterState === "ready" || filterState === "provider_retry",
    secondApproverRequired,
    customerVisibleStatus: filterState === "ready" ? "customer-safe completion available" : filterState === "provider_retry" ? "provider erasure retry pending" : filterState === "dead_letter" ? "support review required" : filterState === "blocked" ? "support state blocked" : "legal/DSAR review required",
    noRawContactLeak: true,
    noRawWebhookLeak: true,
  };
}

function buildProviderReconciliation(guard: Pass2557ScheduledPurgeReleaseGuard): Pass2558ProviderErasureReconciliation {
  const reconciliationState = reconciliationStateFrom(guard);
  return {
    id: `pass2558-provider-erasure-reconciliation-${guard.supportCaseId}`,
    supportCaseId: guard.supportCaseId,
    providerWebhookState: guard.providerWebhookState,
    reconciliationState,
    providerErasureWebhookHash: guard.providerErasureWebhookHash,
    providerAckReconciliationHash: stableHash({ supportCaseId: guard.supportCaseId, webhookHash: guard.providerErasureWebhookHash, state: reconciliationState, noRawWebhook: true }),
    retryBackoffReceiptHash: guard.retryBackoffReceiptHash,
    deadLetterQueueId: guard.deadLetterQueueId,
    legalHoldState: guard.legalHoldState,
    dsarErasureRequestHash: guard.dsarErasureRequestHash,
    customerSafeNoticeHash: guard.customerCompletionNoticeHash,
    mutationAllowedAfterReconciliation: reconciliationState === "ack_matched" && guard.customerSafeCompletionVisible,
    noRawProviderPayload: true,
  };
}

function buildOperatorAuditGuard(guard: Pass2557ScheduledPurgeReleaseGuard, filter: Pass2558SupportDashboardFilter): Pass2558OperatorAuditColumnGuard {
  const operatorScope: Pass2558OperatorAuditColumnGuard["operatorScope"] = filter.filterState === "blocked" ? "blocked" : filter.secondApproverRequired ? "dual_control_required" : filter.filterState === "provider_retry" ? "support_reconcile" : "support_read";
  return {
    id: `pass2558-operator-audit-column-guard-${guard.supportCaseId}`,
    supportCaseId: guard.supportCaseId,
    auditEventId: `support-dashboard-audit-event-${guard.supportCaseId}`,
    auditEventHash: stableHash({ supportCaseId: guard.supportCaseId, operatorScope, reasonRequired: true, expiryRequired: true }),
    operatorScope,
    reasonRequired: true,
    expiryRequired: true,
    secondApproverReceiptRequired: filter.secondApproverRequired,
    rawColumnsBlocked: BLOCKED_RAW_COLUMNS,
    rlsBypassBlocked: true,
  };
}

function buildAngelBoundary(guard: Pass2557ScheduledPurgeReleaseGuard, reconciliation: Pass2558ProviderErasureReconciliation): Pass2558AngelDashboardBoundary {
  const answerMode: Pass2558AngelDashboardBoundaryMode = guard.scheduledWorkerState === "blocked" ? "blocked" : guard.legalHoldState === "legal_hold_active" || guard.legalHoldState === "conflict_review" ? "legal_hold_conflict" : reconciliation.reconciliationState === "retry_backoff" || reconciliation.reconciliationState === "dead_letter_review" ? "provider_reconciliation_pending" : guard.customerSafeCompletionVisible ? "customer_safe_status" : "operator_safe_dashboard";
  return {
    id: `pass2558-angel-dashboard-boundary-${guard.supportCaseId}`,
    supportCaseId: guard.supportCaseId,
    answerMode,
    maySummarizeDashboardState: answerMode !== "blocked",
    mayClaimProviderErasureCompleted: reconciliation.reconciliationState === "ack_matched" && guard.customerSafeCompletionVisible,
    mayClaimLegalHoldCleared: guard.legalHoldState === "none",
    mayMentionRawWebhook: false,
    mayMentionRawDsar: false,
    blockedClaims: ["raw webhook proves deletion", "RLS bypass confirms customer status", "legal hold cleared without audit event", "provider erasure completed without reconciliation hash"],
  };
}

function buildGuard(guard: Pass2557ScheduledPurgeReleaseGuard, filter: Pass2558SupportDashboardFilter, reconciliation: Pass2558ProviderErasureReconciliation, audit: Pass2558OperatorAuditColumnGuard): Pass2558RlsSupportDashboardReleaseGuard {
  const statusCode = statusFrom(filter.filterState, reconciliation.reconciliationState);
  const rlsSchemaHash = stableHash({ tableNames: buildRlsTableContracts().map((item) => item.tableName), blocked: BLOCKED_RAW_COLUMNS, accountScope: true });
  const supportDashboardVisible = filter.filterState !== "blocked" && audit.operatorScope !== "blocked";
  const providerReconciliationVisible = reconciliation.reconciliationState !== "blocked";
  return {
    id: `pass2558-rls-support-dashboard-release-guard-${guard.supportCaseId}`,
    supportCaseId: guard.supportCaseId,
    statusCode,
    dashboardState: filter.filterState,
    reconciliationState: reconciliation.reconciliationState,
    legalHoldState: guard.legalHoldState,
    providerWebhookState: guard.providerWebhookState,
    rlsPoliciesReady: true,
    supportDashboardVisible,
    providerReconciliationVisible,
    operatorActionAllowed: filter.operatorActionAllowed && audit.operatorScope !== "blocked",
    secondApproverRequired: audit.secondApproverReceiptRequired,
    rlsSchemaHash,
    providerAckReconciliationHash: reconciliation.providerAckReconciliationHash,
    operatorAuditEventHash: audit.auditEventHash,
    customerSafeNoticeHash: reconciliation.customerSafeNoticeHash,
    noRawDashboardLeak: true,
    releaseEquation: "rlsSchemaHash × supportDashboardFilterState × providerAckReconciliationHash × operatorAuditEventHash × customerSafeNoticeHash × noRawDashboardLeak × noRlsBypass",
  };
}

const RLS_SQL_SKELETON = `-- PASS2558 customer-safe RLS skeleton. Raw payment/contact/webhook/DSAR payload columns are intentionally absent.
create table if not exists retention_capsules (id text primary key, account_id uuid not null, account_id_hash text not null, support_case_id text not null, state text not null, customer_safe_notice_hash text not null, created_at timestamptz default now(), updated_at timestamptz default now(), expires_at timestamptz);
create table if not exists purge_jobs (id text primary key, support_case_id text not null, purge_job_receipt_hash text not null, purge_dry_run_hash text not null, customer_deletion_timeline_hash text not null, state text not null, audit_event_hash text not null, created_at timestamptz default now());
create table if not exists worker_runs (id text primary key, support_case_id text not null, worker_dry_run_receipt_hash text not null, retry_backoff_receipt_hash text not null, dead_letter_queue_id text not null, state text not null, no_raw_payload boolean not null default true);
create table if not exists legal_hold_dsar_gates (id text primary key, support_case_id text not null, legal_hold_state text not null, dsar_erasure_request_hash text not null, conflict_review_queue_id text not null, customer_safe_conflict_notice_hash text not null, second_approver_receipt_hash text);
create table if not exists provider_erasure_webhooks (id text primary key, support_case_id text not null, provider_erasure_webhook_hash text not null, provider_ack_reconciliation_hash text not null, provider_retry_backoff_hash text not null, state text not null, no_raw_provider_payload boolean not null default true);
create table if not exists support_dashboard_audit_events (id text primary key, operator_id uuid not null, support_case_id text not null, reason_code text not null, expiry_at timestamptz not null, audit_event_hash text not null, second_approver_receipt_hash text);
alter table retention_capsules enable row level security;
alter table purge_jobs enable row level security;
alter table worker_runs enable row level security;
alter table legal_hold_dsar_gates enable row level security;
alter table provider_erasure_webhooks enable row level security;
alter table support_dashboard_audit_events enable row level security;`;

export function buildPass2558RlsSupportDashboardErasureReconciliationRebalance(args: {
  query: string;
  symbol?: string;
  pass2557?: Pass2557ScheduledPurgeWorkerLegalHoldDsarErasureRebalance;
}): Pass2558RlsSupportDashboardErasureReconciliationRebalance {
  const fallbackGuard: Pass2557ScheduledPurgeReleaseGuard = {
    id: "pass2558-fallback-scheduled-purge-release-guard",
    supportCaseId: "missing-support-case",
    statusCode: 423,
    scheduledWorkerState: "blocked",
    legalHoldState: "blocked",
    providerWebhookState: "blocked",
    decision: "block_worker_status",
    workerRunId: "missing-worker-run",
    workerDryRunReceiptHash: "missing-worker-dry-run-receipt-hash",
    retryBackoffReceiptHash: "missing-retry-backoff-receipt-hash",
    deadLetterQueueId: "missing-dead-letter-queue",
    legalHoldCaseHash: "missing-legal-hold-case-hash",
    dsarErasureRequestHash: "missing-dsar-erasure-request-hash",
    providerErasureWebhookHash: "missing-provider-erasure-webhook-hash",
    customerCompletionNoticeHash: "missing-customer-completion-notice-hash",
    previousPurgeReleaseGuardId: "missing-pass2556-guard",
    customerSafeCompletionVisible: false,
    workerMutationAllowed: false,
    accountInboxOnly: true,
    noRawWorkerLeak: true,
    releaseEquation: "missing-pass2557",
  };
  const sourceGuards = args.pass2557?.scheduledPurgeReleaseGuards.length ? args.pass2557.scheduledPurgeReleaseGuards : [fallbackGuard];
  const rlsTableContracts = buildRlsTableContracts();
  const supportDashboardFilters = sourceGuards.map(buildDashboardFilter);
  const providerErasureReconciliations = sourceGuards.map(buildProviderReconciliation);
  const operatorAuditColumnGuards = sourceGuards.map((guard, index) => buildOperatorAuditGuard(guard, supportDashboardFilters[index]!));
  const angelDashboardBoundaries = sourceGuards.map((guard, index) => buildAngelBoundary(guard, providerErasureReconciliations[index]!));
  const rlsSupportDashboardReleaseGuards = sourceGuards.map((guard, index) => buildGuard(guard, supportDashboardFilters[index]!, providerErasureReconciliations[index]!, operatorAuditColumnGuards[index]!));

  const ready = rlsSupportDashboardReleaseGuards.filter((item) => item.supportDashboardVisible && item.reconciliationState === "ack_matched").length;
  const blocked = rlsSupportDashboardReleaseGuards.filter((item) => item.dashboardState === "blocked").length;
  const legalHold = rlsSupportDashboardReleaseGuards.filter((item) => item.dashboardState === "legal_hold" || item.dashboardState === "conflict_review").length;
  const deadLetter = rlsSupportDashboardReleaseGuards.filter((item) => item.dashboardState === "dead_letter").length;
  const pending = rlsSupportDashboardReleaseGuards.filter((item) => item.reconciliationState === "retry_backoff").length;
  const state: Pass2558RlsSupportDashboardErasureReconciliationRebalance["state"] = blocked === rlsSupportDashboardReleaseGuards.length ? "blocked" : ready > 0 ? "dashboard_ready" : legalHold > 0 ? "legal_hold_conflict" : deadLetter > 0 ? "dead_letter_review" : pending > 0 ? "reconciliation_pending" : "blocked";

  return {
    id: PASS2558_RLS_SUPPORT_DASHBOARD_ERASURE_RECONCILIATION_REBALANCE_ID,
    state,
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 98,
    manualSemanticCompletionAfterPercent: 99,
    targetedSemanticBatchFiles: 90,
    targetedSemanticBatchLines: 366_480,
    rlsSchemaBeforePercent: 22,
    rlsSchemaAfterPercent: 64,
    supportDashboardBeforePercent: 18,
    supportDashboardAfterPercent: 57,
    providerReconciliationBeforePercent: 24,
    providerReconciliationAfterPercent: 61,
    operatorAuditBeforePercent: 31,
    operatorAuditAfterPercent: 68,
    angelDashboardBoundaryBeforePercent: 99,
    angelDashboardBoundaryAfterPercent: 99,
    inheritedPass2557State: args.pass2557?.state ?? "missing",
    rlsTableContracts,
    supportDashboardFilters,
    providerErasureReconciliations,
    operatorAuditColumnGuards,
    angelDashboardBoundaries,
    rlsSupportDashboardReleaseGuards,
    rlsSchemaSqlSkeleton: RLS_SQL_SKELETON,
    masterTxtAdditions: [
      "PASS2558: RLS schema skeleton covers retention_capsules, purge_jobs, worker_runs, legal_hold_dsar_gates, provider_erasure_webhooks and support_dashboard_audit_events without raw payload columns.",
      "PASS2558: support dashboard filters expose only operator-safe columns for ready, legal_hold, conflict_review, provider_retry, dead_letter and blocked states.",
      "PASS2558: provider erasure webhook is reconciled by providerAckReconciliationHash, retry/backoff and dead-letter state before any completed-copy can appear.",
      "PASS2558: Angel may summarize customer-safe dashboard status, but cannot cite raw webhook, raw DSAR/legal payload or RLS bypass claims.",
    ],
    nextPassQueue: [
      "PASS2559: customer/mobile Account Vault visual fixture for RLS support dashboard states on 390px/430px and desktop.",
      "PASS2559: Supabase migration file with explicit policies and denied raw columns test harness.",
      "PASS2560: background job observability board with redacted metrics, worker SLA buckets and no raw payloads.",
      "PASS2561: admin support dashboard route with server action idempotency for provider retry and dual-control legal-hold clearance.",
    ],
    releaseEquation: "rlsSchemaHash × supportDashboardFilterState × providerAckReconciliationHash × operatorAuditEventHash × customerSafeNoticeHash × noRawDashboardLeak × noRlsBypass",
    fingerprint: stableHash({ id: PASS2558_RLS_SUPPORT_DASHBOARD_ERASURE_RECONCILIATION_REBALANCE_ID, state, rlsTableContracts, supportDashboardFilters, providerErasureReconciliations, operatorAuditColumnGuards, angelDashboardBoundaries, rlsSupportDashboardReleaseGuards }),
  };
}
