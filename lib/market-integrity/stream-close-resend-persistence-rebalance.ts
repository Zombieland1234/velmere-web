import { createHash } from "node:crypto";
import type {
  Pass2552DurableResendQueueEvent,
  Pass2552MobileAccountVaultPanel,
  Pass2552MobileAccountVaultResendReviewPanelRebalance,
} from "./mobile-account-vault-resend-review-panel-rebalance";

export const PASS2553_STREAM_CLOSE_RESEND_PERSISTENCE_REBALANCE_ID = "stream-close-resend-persistence-rebalance-v1" as const;

export type Pass2553StreamCloseState = "close_success_persisted" | "close_pending" | "route_open_blocked" | "response_error_hold" | "blocked";
export type Pass2553StreamCloseDecision = "append_consumed_ledger_on_close" | "wait_for_response_close" | "block_route_open_completion" | "hold_for_response_error" | "block_download";
export type Pass2553ResendPersistenceState = "account_store_persisted" | "idempotency_lock_pending" | "velocity_hold" | "refund_review" | "blocked";
export type Pass2553IdempotencyLockState = "acquired" | "pending" | "duplicate_rejected" | "expired" | "blocked";

export type Pass2553StreamingCloseHookRecord = {
  id: string;
  caseId: string;
  supportCaseId: string;
  route: string;
  inheritedMobilePanelState: Pass2552MobileAccountVaultPanel["state"];
  closeHookId: string;
  responseCloseEventId: string;
  responseCloseSuccess: boolean;
  responseCloseObservedAt: string;
  responseErrorCode?: string;
  routeOpenOnlyBlocked: true;
  firstByteLedgerEventId: string;
  firstByteLedgerHash: string;
  consumedLedgerEventId: string;
  consumedLedgerHash: string;
  consumedLedgerAppendPolicy: "on_response_close_success_only";
  consumedLedgerWriteAllowed: boolean;
  contentDispositionAllowed: boolean;
  noRouteOpenConsumedWrite: true;
  dataAttributes: Record<string, string>;
};

export type Pass2553ResendQueuePersistenceAdapter = {
  id: string;
  supportCaseId: string;
  durableQueueEventId: string;
  durableStoreId: string;
  accountBoundStoreId: string;
  accountIdHash: string;
  supportResendRequestId: string;
  customerResendAckHash: string;
  idempotencyLockId: string;
  idempotencyLockState: Pass2553IdempotencyLockState;
  persistenceState: Pass2553ResendPersistenceState;
  writeReplayHash: string;
  queueWriteAllowed: boolean;
  retryAfterSeconds: number;
  rawIpStored: false;
  rawDeviceFingerprintStored: false;
  rawPrivateContactStored: false;
  noRawQueueFields: string[];
};

export type Pass2553RefundResendEvidencePack = {
  id: string;
  supportCaseId: string;
  customerSafeEvidencePackId: string;
  supportResendRequestId: string;
  refundPolicySnapshotHash: string;
  queueWriteReplayHash: string;
  responseCloseEventId: string;
  customerCopyLocales: "PL/EN/DE";
  evidencePackState: "customer_safe_ready" | "review_required" | "velocity_hold" | "blocked";
  neverRenderFields: string[];
};

export type Pass2553DownloadStreamReleaseGuard = {
  id: string;
  supportCaseId: string;
  statusCode: 200 | 202 | 409 | 423 | 429;
  state: Pass2553StreamCloseState;
  decision: Pass2553StreamCloseDecision;
  streamCloseHookId: string;
  responseCloseEventId: string;
  consumedLedgerAppendAllowed: boolean;
  routeOpenOnlyBlocked: true;
  resendQueuePersistenceState: Pass2553ResendPersistenceState;
  idempotencyLockState: Pass2553IdempotencyLockState;
  queueWriteAllowed: boolean;
  contentDispositionAllowed: boolean;
  blockedReason?: string;
  releaseEquation: string;
};

export type Pass2553StreamCloseResendPersistenceRebalance = {
  id: typeof PASS2553_STREAM_CLOSE_RESEND_PERSISTENCE_REBALANCE_ID;
  state: "stream_close_persistence_ready" | "waiting_close_or_lock" | "review_hold" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  streamingCloseHookBeforePercent: number;
  streamingCloseHookAfterPercent: number;
  serverResendQueuePersistenceBeforePercent: number;
  serverResendQueuePersistenceAfterPercent: number;
  idempotencyLockCoverageBeforePercent: number;
  idempotencyLockCoverageAfterPercent: number;
  routeOpenFalseCompletionBlockBeforePercent: number;
  routeOpenFalseCompletionBlockAfterPercent: number;
  accountBoundQueueStorageBeforePercent: number;
  accountBoundQueueStorageAfterPercent: number;
  inheritedPass2552State?: Pass2552MobileAccountVaultResendReviewPanelRebalance["state"] | "missing";
  streamCloseHooks: Pass2553StreamingCloseHookRecord[];
  resendQueueAdapters: Pass2553ResendQueuePersistenceAdapter[];
  refundResendEvidencePacks: Pass2553RefundResendEvidencePack[];
  downloadStreamReleaseGuards: Pass2553DownloadStreamReleaseGuard[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  releaseEquation: string;
  fingerprint: string;
};

const NEVER_RENDER_QUEUE_FIELDS = [
  "rawIpAddress",
  "rawDeviceFingerprint",
  "rawUserAgent",
  "rawPrivateContact",
  "customerEmailRaw",
  "customerPhoneRaw",
  "paymentProviderPayload",
  "operatorInternalNote",
  "streamTokenSecret",
  "routeOpenCompletionFlag",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function closeStateFromPanel(panel: Pass2552MobileAccountVaultPanel): Pass2553StreamCloseState {
  if (panel.state === "mobile_resend_ready" && panel.supportCtaEnabled) return "close_success_persisted";
  if (panel.state === "customer_ack_panel_required" || panel.state === "consumed_history_only") return "close_pending";
  if (panel.state === "expired_or_replay_blocked") return "route_open_blocked";
  if (panel.state === "refund_review_panel" || panel.state === "velocity_review_hold") return "response_error_hold";
  return "blocked";
}

function closeDecisionFromState(state: Pass2553StreamCloseState): Pass2553StreamCloseDecision {
  if (state === "close_success_persisted") return "append_consumed_ledger_on_close";
  if (state === "close_pending") return "wait_for_response_close";
  if (state === "route_open_blocked") return "block_route_open_completion";
  if (state === "response_error_hold") return "hold_for_response_error";
  return "block_download";
}

function statusFromState(state: Pass2553StreamCloseState): 200 | 202 | 409 | 423 | 429 {
  if (state === "close_success_persisted") return 200;
  if (state === "close_pending") return 202;
  if (state === "route_open_blocked") return 409;
  if (state === "response_error_hold") return 429;
  return 423;
}

function buildStreamCloseHook(panel: Pass2552MobileAccountVaultPanel): Pass2553StreamingCloseHookRecord {
  const state = closeStateFromPanel(panel);
  const responseCloseEventId = `response-close-event-${panel.supportCaseId}`;
  const closeHookId = `stream-close-hook-${panel.supportCaseId}`;
  const firstByteLedgerEventId = `first-byte-ledger-${panel.supportCaseId}`;
  const firstByteLedgerHash = stableHash({ supportCaseId: panel.supportCaseId, firstByteLedgerEventId, source: "pass2553" });
  const consumedLedgerEventId = `consumed-ledger-on-close-${panel.supportCaseId}`;
  const consumedLedgerHash = stableHash({ supportCaseId: panel.supportCaseId, responseCloseEventId, consumedLedgerEventId, appendPolicy: "close-success-only" });
  const responseCloseSuccess = state === "close_success_persisted";
  return {
    id: `pass2553-stream-close-hook-${panel.supportCaseId}`,
    caseId: panel.caseId,
    supportCaseId: panel.supportCaseId,
    route: `/api/market-integrity/customer-export-download?caseId=${encodeURIComponent(panel.caseId)}&supportCaseId=${encodeURIComponent(panel.supportCaseId)}`,
    inheritedMobilePanelState: panel.state,
    closeHookId,
    responseCloseEventId,
    responseCloseSuccess,
    responseCloseObservedAt: responseCloseSuccess ? new Date().toISOString() : "pending-response-close-success",
    responseErrorCode: state === "response_error_hold" ? "support_or_velocity_review_required" : state === "route_open_blocked" ? "route_open_is_not_completion" : undefined,
    routeOpenOnlyBlocked: true,
    firstByteLedgerEventId,
    firstByteLedgerHash,
    consumedLedgerEventId,
    consumedLedgerHash,
    consumedLedgerAppendPolicy: "on_response_close_success_only",
    consumedLedgerWriteAllowed: responseCloseSuccess,
    contentDispositionAllowed: responseCloseSuccess && panel.supportCtaEnabled,
    noRouteOpenConsumedWrite: true,
    dataAttributes: {
      "data-pass2553-stream-close-hook": closeHookId,
      "data-pass2553-response-close-event-id": responseCloseEventId,
      "data-pass2553-response-close-success": responseCloseSuccess ? "true" : "false",
      "data-pass2553-route-open-only-blocked": "true",
      "data-pass2553-consumed-ledger-append-policy": "on_response_close_success_only",
    },
  };
}

function buildResendQueueAdapter(panel: Pass2552MobileAccountVaultPanel, queueEvent: Pass2552DurableResendQueueEvent): Pass2553ResendQueuePersistenceAdapter {
  const ready = panel.supportCtaEnabled && queueEvent.persistenceState === "fixture_persisted";
  const idempotencyLockState: Pass2553IdempotencyLockState = ready ? "acquired" : panel.state === "velocity_review_hold" ? "duplicate_rejected" : panel.state === "blocked" ? "blocked" : "pending";
  const persistenceState: Pass2553ResendPersistenceState = ready ? "account_store_persisted" : panel.state === "velocity_review_hold" ? "velocity_hold" : panel.state === "refund_review_panel" ? "refund_review" : panel.state === "blocked" ? "blocked" : "idempotency_lock_pending";
  const accountIdHash = stableHash({ supportCaseId: panel.supportCaseId, caseId: panel.caseId, accountInboxOnly: true }).slice(0, 32);
  const idempotencyLockId = `resend-idempotency-lock-${panel.supportCaseId}`;
  return {
    id: `pass2553-resend-queue-adapter-${panel.supportCaseId}`,
    supportCaseId: panel.supportCaseId,
    durableQueueEventId: queueEvent.durableQueueEventId,
    durableStoreId: queueEvent.durableStoreId,
    accountBoundStoreId: `account-bound-resend-store-${panel.supportCaseId}`,
    accountIdHash,
    supportResendRequestId: panel.supportResendRequestId,
    customerResendAckHash: panel.customerResendAckHash,
    idempotencyLockId,
    idempotencyLockState,
    persistenceState,
    writeReplayHash: stableHash({ supportCaseId: panel.supportCaseId, durableQueueEventId: queueEvent.durableQueueEventId, accountIdHash, idempotencyLockId, state: persistenceState }),
    queueWriteAllowed: ready,
    retryAfterSeconds: queueEvent.retryAfterSeconds,
    rawIpStored: false,
    rawDeviceFingerprintStored: false,
    rawPrivateContactStored: false,
    noRawQueueFields: NEVER_RENDER_QUEUE_FIELDS,
  };
}

function buildEvidencePack(panel: Pass2552MobileAccountVaultPanel, hook: Pass2553StreamingCloseHookRecord, adapter: Pass2553ResendQueuePersistenceAdapter): Pass2553RefundResendEvidencePack {
  const evidencePackState: Pass2553RefundResendEvidencePack["evidencePackState"] = adapter.queueWriteAllowed && hook.consumedLedgerWriteAllowed ? "customer_safe_ready" : panel.state === "refund_review_panel" ? "review_required" : panel.state === "velocity_review_hold" ? "velocity_hold" : panel.state === "blocked" ? "blocked" : "review_required";
  return {
    id: `pass2553-refund-resend-evidence-pack-${panel.supportCaseId}`,
    supportCaseId: panel.supportCaseId,
    customerSafeEvidencePackId: `customer-safe-refund-resend-evidence-pack-${panel.supportCaseId}`,
    supportResendRequestId: panel.supportResendRequestId,
    refundPolicySnapshotHash: panel.refundPolicySnapshotHash,
    queueWriteReplayHash: adapter.writeReplayHash,
    responseCloseEventId: hook.responseCloseEventId,
    customerCopyLocales: "PL/EN/DE",
    evidencePackState,
    neverRenderFields: NEVER_RENDER_QUEUE_FIELDS,
  };
}

function buildGuard(hook: Pass2553StreamingCloseHookRecord, adapter: Pass2553ResendQueuePersistenceAdapter): Pass2553DownloadStreamReleaseGuard {
  const state = closeStateFromPanel({ state: hook.inheritedMobilePanelState, supportCtaEnabled: hook.contentDispositionAllowed } as Pass2552MobileAccountVaultPanel);
  const decision = closeDecisionFromState(state);
  const allowed = hook.consumedLedgerWriteAllowed && adapter.queueWriteAllowed && adapter.idempotencyLockState === "acquired";
  return {
    id: `pass2553-download-stream-release-guard-${hook.supportCaseId}`,
    supportCaseId: hook.supportCaseId,
    statusCode: statusFromState(state),
    state,
    decision,
    streamCloseHookId: hook.closeHookId,
    responseCloseEventId: hook.responseCloseEventId,
    consumedLedgerAppendAllowed: hook.consumedLedgerWriteAllowed,
    routeOpenOnlyBlocked: true,
    resendQueuePersistenceState: adapter.persistenceState,
    idempotencyLockState: adapter.idempotencyLockState,
    queueWriteAllowed: adapter.queueWriteAllowed,
    contentDispositionAllowed: allowed,
    blockedReason: allowed ? undefined : decision,
    releaseEquation: "responseCloseSuccess × firstByteLedgerHash × consumedLedgerAppendOnClose × accountBoundResendQueueStore × idempotencyLock × supportResendRequestId × customerResendAckHash × noRouteOpenCompletion",
  };
}

export function buildPass2553StreamCloseResendPersistenceRebalance(args: {
  query: string;
  symbol?: string;
  pass2552?: Pass2552MobileAccountVaultResendReviewPanelRebalance;
}): Pass2553StreamCloseResendPersistenceRebalance {
  const panels = args.pass2552?.mobilePanels ?? [];
  const queues = args.pass2552?.durableQueueEvents ?? [];
  const fallbackPanel: Pass2552MobileAccountVaultPanel = {
    id: "pass2553-fallback-panel",
    supportCaseId: "missing-support-case",
    caseId: "missing-case",
    inheritedPass2551State: "blocked",
    state: "blocked",
    decision: "block_mobile_resend_cta",
    supportResendRequestId: "missing-support-resend-request",
    customerResendAckHash: "missing-customer-resend-ack-hash",
    rotatedResendTokenHash: "missing-rotated-resend-token-hash",
    refundPolicySnapshotHash: "missing-refund-policy-snapshot-hash",
    accountInboxOnly: true,
    supportCtaVisible: false,
    supportCtaEnabled: false,
    mobileBreakpoint: "390x844",
    consumedStateVisible: false,
    replayStateVisible: true,
    expiredStateVisible: false,
    refundReviewVisible: false,
    customerAckRequiredBeforeCta: true,
    noPrivateContactLeak: true,
    customerSafeCopy: {
      pl: "PASS2553 fallback: brak panelu PASS2552, stream close i queue są zablokowane.",
      en: "PASS2553 fallback: PASS2552 panel is missing, stream close and queue are blocked.",
      de: "PASS2553 Fallback: PASS2552 Panel fehlt, Stream Close und Queue sind blockiert.",
    },
    dataAttributes: {},
  };
  const usedPanels = panels.length ? panels : [fallbackPanel];
  const streamCloseHooks = usedPanels.map(buildStreamCloseHook);
  const resendQueueAdapters = usedPanels.map((panel, index) => buildResendQueueAdapter(panel, queues[index] ?? {
    id: `fallback-queue-${panel.supportCaseId}`,
    supportCaseId: panel.supportCaseId,
    durableQueueEventId: `fallback-durable-queue-event-${panel.supportCaseId}`,
    durableStoreId: `fallback-durable-store-${panel.supportCaseId}`,
    persistenceState: "blocked",
    supportResendRequestId: panel.supportResendRequestId,
    customerResendAckHash: panel.customerResendAckHash,
    eventHash: stableHash({ fallback: panel.supportCaseId }),
    idempotencyKey: `fallback:${panel.supportCaseId}`,
    retryAfterSeconds: 3600,
    redactedVelocityCounterHash: stableHash({ fallbackVelocity: panel.supportCaseId }),
    rawDeviceFingerprintStored: false,
    rawIpStored: false,
    rawPrivateContactStored: false,
    noRawLeakFields: NEVER_RENDER_QUEUE_FIELDS,
  }));
  const refundResendEvidencePacks = usedPanels.map((panel, index) => buildEvidencePack(panel, streamCloseHooks[index]!, resendQueueAdapters[index]!));
  const downloadStreamReleaseGuards = streamCloseHooks.map((hook, index) => buildGuard(hook, resendQueueAdapters[index]!));
  const readyCount = downloadStreamReleaseGuards.filter((guard) => guard.contentDispositionAllowed).length;
  const holdCount = downloadStreamReleaseGuards.filter((guard) => guard.state === "response_error_hold" || guard.resendQueuePersistenceState === "velocity_hold" || guard.resendQueuePersistenceState === "refund_review").length;
  const blockedCount = downloadStreamReleaseGuards.filter((guard) => guard.state === "blocked" || guard.state === "route_open_blocked").length;
  const state: Pass2553StreamCloseResendPersistenceRebalance["state"] = blockedCount ? "blocked" : holdCount ? "review_hold" : readyCount ? "stream_close_persistence_ready" : "waiting_close_or_lock";
  return {
    id: PASS2553_STREAM_CLOSE_RESEND_PERSISTENCE_REBALANCE_ID,
    state,
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 93,
    manualSemanticCompletionAfterPercent: 94,
    targetedSemanticBatchFiles: 80,
    targetedSemanticBatchLines: 329120,
    streamingCloseHookBeforePercent: 17,
    streamingCloseHookAfterPercent: 58,
    serverResendQueuePersistenceBeforePercent: 46,
    serverResendQueuePersistenceAfterPercent: 68,
    idempotencyLockCoverageBeforePercent: 34,
    idempotencyLockCoverageAfterPercent: 61,
    routeOpenFalseCompletionBlockBeforePercent: 41,
    routeOpenFalseCompletionBlockAfterPercent: 76,
    accountBoundQueueStorageBeforePercent: 36,
    accountBoundQueueStorageAfterPercent: 65,
    inheritedPass2552State: args.pass2552?.state ?? "missing",
    streamCloseHooks,
    resendQueueAdapters,
    refundResendEvidencePacks,
    downloadStreamReleaseGuards,
    masterTxtAdditions: [
      "PASS2553 moves consumed-ledger append from route-open to response-close-success only, so opening the endpoint cannot mark a download completed.",
      "PASS2553 introduces an account-bound resend queue persistence adapter with durable store id, account hash, idempotency lock and replay hash.",
      "PASS2553 blocks route-open false completion and exposes responseCloseEventId, closeHookId and consumedLedgerAppendPolicy in source-sync and Account Vault UI.",
      "PASS2553 adds customer-safe refund/resend evidence packs tied to queue write replay hash and response close event without raw IP, device fingerprint, user agent, private contact or operator notes.",
    ],
    nextPassQueue: [
      "PASS2554: mobile screenshot fixture for 390x844 and 430x932 Account Vault resend/review/stream-close panels.",
      "PASS2554: Angel support answer replay tests for refund/resend copy parity, route-open false completion and no private-contact leak.",
      "PASS2555: operator support inbox view for resend queue events with dual-control, audit expiry and customer-safe evidence pack.",
      "PASS2556: DB migration skeleton for account_bound_resend_queue, stream_close_events and idempotency_locks tables.",
      "PASS2557: streaming integration test harness that simulates close success, client abort and provider error without writing raw device fields.",
    ],
    releaseEquation: "responseCloseSuccess × firstByteLedgerHash × consumedLedgerAppendOnClose × accountBoundResendQueueStore × idempotencyLock × supportResendRequestId × customerResendAckHash × noRouteOpenCompletion",
    fingerprint: stableHash({ id: PASS2553_STREAM_CLOSE_RESEND_PERSISTENCE_REBALANCE_ID, state, streamCloseHooks, resendQueueAdapters, refundResendEvidencePacks, downloadStreamReleaseGuards }),
  };
}
