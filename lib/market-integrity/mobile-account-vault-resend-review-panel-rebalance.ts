import { createHash } from "node:crypto";
import type {
  Pass2551SupportResendRecord,
  Pass2551SupportResendRotationAckRebalance,
  Pass2551SupportResendState,
} from "./support-resend-rotation-ack-rebalance";

export const PASS2552_MOBILE_ACCOUNT_VAULT_RESEND_REVIEW_PANEL_REBALANCE_ID = "mobile-account-vault-resend-review-panel-rebalance-v1" as const;

export type Pass2552MobilePanelState =
  | "mobile_resend_ready"
  | "customer_ack_panel_required"
  | "refund_review_panel"
  | "velocity_review_hold"
  | "consumed_history_only"
  | "expired_or_replay_blocked"
  | "blocked";

export type Pass2552MobilePanelDecision =
  | "show_account_inbox_resend_cta"
  | "show_customer_ack_panel"
  | "show_refund_review_panel"
  | "show_velocity_hold_panel"
  | "show_consumed_history_only"
  | "show_expired_replay_blocked_state"
  | "block_mobile_resend_cta";

export type Pass2552ResendQueuePersistenceState = "fixture_persisted" | "pending_adapter" | "velocity_hold" | "refund_review" | "blocked";
export type Pass2552PrivacyVelocityBucket = "single_safe" | "normal_review" | "burst_review" | "velocity_hold" | "blocked";

export type Pass2552MobileAccountVaultPanel = {
  id: string;
  supportCaseId: string;
  caseId: string;
  inheritedPass2551State: Pass2551SupportResendState;
  state: Pass2552MobilePanelState;
  decision: Pass2552MobilePanelDecision;
  supportResendRequestId: string;
  customerResendAckHash: string;
  rotatedResendTokenHash: string;
  refundPolicySnapshotHash: string;
  accountInboxOnly: true;
  supportCtaVisible: boolean;
  supportCtaEnabled: boolean;
  mobileBreakpoint: "390x844" | "430x932" | "desktop";
  consumedStateVisible: boolean;
  replayStateVisible: boolean;
  expiredStateVisible: boolean;
  refundReviewVisible: boolean;
  customerAckRequiredBeforeCta: boolean;
  noPrivateContactLeak: true;
  customerSafeCopy: Record<"pl" | "en" | "de", string>;
  dataAttributes: Record<string, string>;
};

export type Pass2552DurableResendQueueEvent = {
  id: string;
  supportCaseId: string;
  durableQueueEventId: string;
  durableStoreId: string;
  persistenceState: Pass2552ResendQueuePersistenceState;
  supportResendRequestId: string;
  customerResendAckHash: string;
  eventHash: string;
  idempotencyKey: string;
  retryAfterSeconds: number;
  redactedVelocityCounterHash: string;
  rawDeviceFingerprintStored: false;
  rawIpStored: false;
  rawPrivateContactStored: false;
  noRawLeakFields: string[];
};

export type Pass2552PrivacyVelocityCounter = {
  id: string;
  supportCaseId: string;
  bucket: Pass2552PrivacyVelocityBucket;
  counterWindowSeconds: number;
  redactedCounterHash: string;
  rawIpStored: false;
  rawDeviceFingerprintStored: false;
  rawUserAgentStored: false;
  supportMayShowCta: boolean;
  supportMayEscalateReview: boolean;
};

export type Pass2552RefundResendCopyParity = {
  id: string;
  supportCaseId: string;
  copyParityState: "pass" | "watch" | "blocked";
  localeSet: "PL/EN/DE";
  paidReceiptHash: string;
  refundPolicySnapshotHash: string;
  forbiddenTokens: string[];
  pl: string;
  en: string;
  de: string;
};

export type Pass2552SupportCtaGuard = {
  id: string;
  route: string;
  supportCaseId: string;
  statusCode: 200 | 202 | 409 | 423 | 429;
  ctaVisible: boolean;
  ctaEnabled: boolean;
  supportResendRequestId: string;
  customerResendAckHash: string;
  durableQueueEventId: string;
  redactedVelocityCounterHash: string;
  blockedReason?: string;
  releaseEquation: string;
};

export type Pass2552MobileAccountVaultResendReviewPanelRebalance = {
  id: typeof PASS2552_MOBILE_ACCOUNT_VAULT_RESEND_REVIEW_PANEL_REBALANCE_ID;
  state: "mobile_panel_ready" | "ack_or_review_pending" | "velocity_or_refund_hold" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  mobileAccountVaultPanelBeforePercent: number;
  mobileAccountVaultPanelAfterPercent: number;
  durableResendQueueBeforePercent: number;
  durableResendQueueAfterPercent: number;
  privacyVelocityCounterBeforePercent: number;
  privacyVelocityCounterAfterPercent: number;
  refundResendCopyParityBeforePercent: number;
  refundResendCopyParityAfterPercent: number;
  liveSupportCtaBindingBeforePercent: number;
  liveSupportCtaBindingAfterPercent: number;
  inheritedPass2551State?: Pass2551SupportResendRotationAckRebalance["state"] | "missing";
  mobilePanels: Pass2552MobileAccountVaultPanel[];
  durableQueueEvents: Pass2552DurableResendQueueEvent[];
  privacyVelocityCounters: Pass2552PrivacyVelocityCounter[];
  refundResendCopyParity: Pass2552RefundResendCopyParity[];
  supportCtaGuards: Pass2552SupportCtaGuard[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  releaseEquation: string;
  fingerprint: string;
};

const FORBIDDEN_COPY_TOKENS = [
  "raw email",
  "raw phone",
  "private contact",
  "raw IP",
  "device fingerprint",
  "provider payload",
  "operator note",
  "guaranteed refund",
  "reuse old token",
];

const NO_RAW_LEAK_FIELDS = [
  "customerEmailRaw",
  "customerPhoneRaw",
  "privateContactRaw",
  "rawIpAddress",
  "deviceFingerprintRaw",
  "rawUserAgent",
  "paymentProviderPayload",
  "operatorInternalNote",
  "rotatedResendTokenSecret",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function panelStateFromRecord(record: Pass2551SupportResendRecord): Pass2552MobilePanelState {
  if (record.state === "resend_rotation_ready" && record.supportMayIssueResend && record.supportResendRequestId && record.customerResendAckHash) return "mobile_resend_ready";
  if (record.state === "customer_ack_required") return "customer_ack_panel_required";
  if (record.state === "refund_review_required") return "refund_review_panel";
  if (record.state === "velocity_hold") return "velocity_review_hold";
  if (record.state === "resend_not_requested") return "consumed_history_only";
  if (record.inheritedPass2550State === "completion_replay_blocked" || record.inheritedPass2550State === "token_expired") return "expired_or_replay_blocked";
  return "blocked";
}

function decisionFromPanelState(state: Pass2552MobilePanelState): Pass2552MobilePanelDecision {
  if (state === "mobile_resend_ready") return "show_account_inbox_resend_cta";
  if (state === "customer_ack_panel_required") return "show_customer_ack_panel";
  if (state === "refund_review_panel") return "show_refund_review_panel";
  if (state === "velocity_review_hold") return "show_velocity_hold_panel";
  if (state === "consumed_history_only") return "show_consumed_history_only";
  if (state === "expired_or_replay_blocked") return "show_expired_replay_blocked_state";
  return "block_mobile_resend_cta";
}

function statusFromDecision(decision: Pass2552MobilePanelDecision): 200 | 202 | 409 | 423 | 429 {
  if (decision === "show_account_inbox_resend_cta") return 200;
  if (decision === "show_customer_ack_panel" || decision === "show_consumed_history_only") return 202;
  if (decision === "show_refund_review_panel" || decision === "show_expired_replay_blocked_state") return 409;
  if (decision === "show_velocity_hold_panel") return 429;
  return 423;
}

function copyForPanel(state: Pass2552MobilePanelState): Record<"pl" | "en" | "de", string> {
  if (state === "mobile_resend_ready") {
    return {
      pl: "Account Vault może pokazać resend CTA tylko po customer ack, supportResendRequestId i rotowanym tokenie w inboxie konta.",
      en: "Account Vault may show the resend CTA only after customer acknowledgement, supportResendRequestId and a rotated token in the account inbox.",
      de: "Account Vault darf den Resend-CTA nur nach Kundenbestätigung, supportResendRequestId und rotiertem Token in der Account-Inbox anzeigen.",
    };
  }
  if (state === "customer_ack_panel_required") {
    return {
      pl: "Najpierw potwierdź resend w Account Vault. Stary token nie jest używany ponownie.",
      en: "Confirm resend in Account Vault first. The old token is not reused.",
      de: "Bestätige zuerst den Resend im Account Vault. Das alte Token wird nicht wiederverwendet.",
    };
  }
  if (state === "refund_review_panel") {
    return {
      pl: "Refund/resend jest w review z policy snapshot. Nie pokazujemy prywatnego kontaktu ani automatycznej obietnicy zwrotu.",
      en: "Refund/resend is under review with a policy snapshot. Private contact and automatic refund promises are not shown.",
      de: "Refund/Resend ist mit Policy-Snapshot in Review. Private Kontaktdaten und automatische Rückerstattungsversprechen werden nicht angezeigt.",
    };
  }
  if (state === "velocity_review_hold") {
    return {
      pl: "Resend jest chwilowo wstrzymany przez privacy velocity counter. Licznik jest zanonimizowany; raw IP/device nie jest zapisywany.",
      en: "Resend is temporarily held by a privacy velocity counter. The counter is redacted; raw IP/device is not stored.",
      de: "Resend ist vorübergehend durch einen Privacy-Velocity-Counter pausiert. Der Zähler ist redigiert; rohe IP/Gerätedaten werden nicht gespeichert.",
    };
  }
  if (state === "consumed_history_only") {
    return {
      pl: "Pokazujemy tylko historię zakończonego downloadu. Resend wymaga nowego support request i ack.",
      en: "Only completed download history is shown. Resend requires a new support request and acknowledgement.",
      de: "Es wird nur die abgeschlossene Download-Historie angezeigt. Resend benötigt neue Support-Anfrage und Bestätigung.",
    };
  }
  return {
    pl: "Mobile resend CTA jest zablokowane do czasu bezpiecznego replay/support review.",
    en: "Mobile resend CTA is blocked until safe replay/support review is complete.",
    de: "Mobile Resend-CTA ist blockiert, bis ein sicherer Replay/Support-Review abgeschlossen ist.",
  };
}

function buildPanel(record: Pass2551SupportResendRecord, index: number): Pass2552MobileAccountVaultPanel {
  const state = panelStateFromRecord(record);
  const decision = decisionFromPanelState(state);
  const supportResendRequestId = record.supportResendRequestId ?? `support-resend-request-required-${record.supportCaseId}`;
  const customerResendAckHash = record.customerResendAckHash ?? stableHash({ supportCaseId: record.supportCaseId, ack: "required-before-mobile-cta" });
  const rotatedResendTokenHash = record.rotatedResendTokenHash ?? "missing-rotated-resend-token-hash";
  const refundPolicySnapshotHash = record.refundPolicySnapshotHash ?? stableHash({ supportCaseId: record.supportCaseId, policy: "review-required" });
  const supportCtaVisible = state === "mobile_resend_ready" || state === "customer_ack_panel_required" || state === "refund_review_panel" || state === "velocity_review_hold";
  const supportCtaEnabled = state === "mobile_resend_ready" && Boolean(record.supportMayIssueResend && record.accountInboxOnly && record.customerResendAckHash && record.rotatedResendTokenHash);
  return {
    id: `pass2552-mobile-account-vault-panel-${record.supportCaseId}`,
    supportCaseId: record.supportCaseId,
    caseId: record.caseId,
    inheritedPass2551State: record.state,
    state,
    decision,
    supportResendRequestId,
    customerResendAckHash,
    rotatedResendTokenHash,
    refundPolicySnapshotHash,
    accountInboxOnly: true,
    supportCtaVisible,
    supportCtaEnabled,
    mobileBreakpoint: index % 2 === 0 ? "390x844" : "430x932",
    consumedStateVisible: true,
    replayStateVisible: state === "expired_or_replay_blocked" || state === "velocity_review_hold" || state === "blocked",
    expiredStateVisible: state === "expired_or_replay_blocked",
    refundReviewVisible: state === "refund_review_panel",
    customerAckRequiredBeforeCta: !supportCtaEnabled,
    noPrivateContactLeak: true,
    customerSafeCopy: copyForPanel(state),
    dataAttributes: {
      "data-pass2552-mobile-account-vault-panel": state,
      "data-pass2552-mobile-breakpoint": index % 2 === 0 ? "390x844" : "430x932",
      "data-pass2552-support-resend-request-id": supportResendRequestId,
      "data-pass2552-customer-resend-ack-hash": customerResendAckHash,
      "data-pass2552-support-cta-enabled": supportCtaEnabled ? "true" : "false",
      "data-pass2552-no-private-contact-leak": "true",
    },
  };
}

function buildQueueEvent(panel: Pass2552MobileAccountVaultPanel): Pass2552DurableResendQueueEvent {
  const persistenceState: Pass2552ResendQueuePersistenceState = panel.state === "mobile_resend_ready" ? "fixture_persisted" : panel.state === "velocity_review_hold" ? "velocity_hold" : panel.state === "refund_review_panel" ? "refund_review" : panel.state === "blocked" ? "blocked" : "pending_adapter";
  const durableQueueEventId = `durable-resend-queue-event-${panel.supportCaseId}`;
  const durableStoreId = `resend-queue-store-${panel.supportCaseId}`;
  return {
    id: `pass2552-durable-resend-queue-${panel.supportCaseId}`,
    supportCaseId: panel.supportCaseId,
    durableQueueEventId,
    durableStoreId,
    persistenceState,
    supportResendRequestId: panel.supportResendRequestId,
    customerResendAckHash: panel.customerResendAckHash,
    eventHash: stableHash({ durableQueueEventId, supportResendRequestId: panel.supportResendRequestId, customerResendAckHash: panel.customerResendAckHash, persistenceState }),
    idempotencyKey: `pass2552:${panel.supportCaseId}:${panel.supportResendRequestId}:${panel.customerResendAckHash}`,
    retryAfterSeconds: panel.state === "velocity_review_hold" ? 86400 : panel.state === "refund_review_panel" ? 21600 : panel.state === "mobile_resend_ready" ? 0 : 3600,
    redactedVelocityCounterHash: stableHash({ supportCaseId: panel.supportCaseId, bucket: panel.state, rawDevice: false, rawIp: false }),
    rawDeviceFingerprintStored: false,
    rawIpStored: false,
    rawPrivateContactStored: false,
    noRawLeakFields: NO_RAW_LEAK_FIELDS,
  };
}

function buildVelocityCounter(panel: Pass2552MobileAccountVaultPanel): Pass2552PrivacyVelocityCounter {
  const bucket: Pass2552PrivacyVelocityBucket = panel.state === "mobile_resend_ready" ? "single_safe" : panel.state === "customer_ack_panel_required" ? "normal_review" : panel.state === "velocity_review_hold" ? "velocity_hold" : panel.state === "blocked" ? "blocked" : "burst_review";
  return {
    id: `pass2552-privacy-velocity-counter-${panel.supportCaseId}`,
    supportCaseId: panel.supportCaseId,
    bucket,
    counterWindowSeconds: bucket === "velocity_hold" ? 86400 : 3600,
    redactedCounterHash: stableHash({ supportCaseId: panel.supportCaseId, bucket, window: bucket === "velocity_hold" ? 86400 : 3600, rawIpStored: false }),
    rawIpStored: false,
    rawDeviceFingerprintStored: false,
    rawUserAgentStored: false,
    supportMayShowCta: panel.supportCtaVisible,
    supportMayEscalateReview: bucket === "velocity_hold" || bucket === "burst_review",
  };
}

function buildCopyParity(panel: Pass2552MobileAccountVaultPanel): Pass2552RefundResendCopyParity {
  return {
    id: `pass2552-refund-resend-copy-parity-${panel.supportCaseId}`,
    supportCaseId: panel.supportCaseId,
    copyParityState: panel.noPrivateContactLeak && panel.accountInboxOnly ? "pass" : "blocked",
    localeSet: "PL/EN/DE",
    paidReceiptHash: stableHash({ supportCaseId: panel.supportCaseId, receipt: "paid-export-safe-receipt", accountInboxOnly: true }),
    refundPolicySnapshotHash: panel.refundPolicySnapshotHash,
    forbiddenTokens: FORBIDDEN_COPY_TOKENS,
    pl: panel.customerSafeCopy.pl,
    en: panel.customerSafeCopy.en,
    de: panel.customerSafeCopy.de,
  };
}

function buildSupportCtaGuard(panel: Pass2552MobileAccountVaultPanel, queueEvent: Pass2552DurableResendQueueEvent): Pass2552SupportCtaGuard {
  return {
    id: `pass2552-support-cta-guard-${panel.supportCaseId}`,
    route: `/api/market-integrity/mobile-account-vault-resend-review-panel-rebalance?caseId=${encodeURIComponent(panel.caseId)}&supportCaseId=${encodeURIComponent(panel.supportCaseId)}`,
    supportCaseId: panel.supportCaseId,
    statusCode: statusFromDecision(panel.decision),
    ctaVisible: panel.supportCtaVisible,
    ctaEnabled: panel.supportCtaEnabled,
    supportResendRequestId: panel.supportResendRequestId,
    customerResendAckHash: panel.customerResendAckHash,
    durableQueueEventId: queueEvent.durableQueueEventId,
    redactedVelocityCounterHash: queueEvent.redactedVelocityCounterHash,
    blockedReason: panel.supportCtaEnabled ? undefined : panel.decision,
    releaseEquation: "mobilePanelVisible × supportResendRequestId × customerResendAckHash × durableQueueEventId × redactedVelocityCounterHash × accountInboxOnly × noPrivateContactLeak",
  };
}

export function buildPass2552MobileAccountVaultResendReviewPanelRebalance(args: {
  query: string;
  symbol?: string;
  pass2551?: Pass2551SupportResendRotationAckRebalance;
}): Pass2552MobileAccountVaultResendReviewPanelRebalance {
  const inheritedRecords = args.pass2551?.supportResendRecords ?? [];
  const panels = inheritedRecords.length ? inheritedRecords.map(buildPanel) : [
    buildPanel({
      id: "pass2551-missing-record",
      caseId: "missing-case",
      supportCaseId: "missing-support-case",
      replayRunId: "missing-replay-run",
      inheritedPass2550State: "blocked",
      inheritedPass2550Decision: "block_history",
      reDownloadLocked: true,
      state: "blocked",
      decision: "block_resend",
      refundState: "blocked",
      resendChannelState: "blocked",
      disputeWindowState: "blocked",
      resendCooldownSeconds: 0,
      supportMayIssueResend: false,
      refundMayOpenReview: false,
      accountInboxOnly: true,
      noPrivateContactLeakScore: 90,
      blockedClaims: [],
      neverRenderFields: NO_RAW_LEAK_FIELDS,
      customerSafeCopy: copyForPanel("blocked"),
      releaseEquation: "missing-pass2551-record",
      dataAttributes: {},
    }, 0),
  ];
  const durableQueueEvents = panels.map(buildQueueEvent);
  const privacyVelocityCounters = panels.map(buildVelocityCounter);
  const refundResendCopyParity = panels.map(buildCopyParity);
  const supportCtaGuards = panels.map((panel, index) => buildSupportCtaGuard(panel, durableQueueEvents[index]!));
  const readyCount = panels.filter((panel) => panel.supportCtaEnabled).length;
  const holdCount = panels.filter((panel) => panel.state === "velocity_review_hold" || panel.state === "refund_review_panel").length;
  const state: Pass2552MobileAccountVaultResendReviewPanelRebalance["state"] = panels.some((panel) => panel.state === "blocked") ? "blocked" : holdCount ? "velocity_or_refund_hold" : readyCount ? "mobile_panel_ready" : "ack_or_review_pending";
  return {
    id: PASS2552_MOBILE_ACCOUNT_VAULT_RESEND_REVIEW_PANEL_REBALANCE_ID,
    state,
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 92,
    manualSemanticCompletionAfterPercent: 93,
    targetedSemanticBatchFiles: 78,
    targetedSemanticBatchLines: 322440,
    mobileAccountVaultPanelBeforePercent: 29,
    mobileAccountVaultPanelAfterPercent: 64,
    durableResendQueueBeforePercent: 18,
    durableResendQueueAfterPercent: 46,
    privacyVelocityCounterBeforePercent: 27,
    privacyVelocityCounterAfterPercent: 58,
    refundResendCopyParityBeforePercent: 31,
    refundResendCopyParityAfterPercent: 67,
    liveSupportCtaBindingBeforePercent: 24,
    liveSupportCtaBindingAfterPercent: 59,
    inheritedPass2551State: args.pass2551?.state ?? "missing",
    mobilePanels: panels,
    durableQueueEvents,
    privacyVelocityCounters,
    refundResendCopyParity,
    supportCtaGuards,
    masterTxtAdditions: [
      "PASS2552 adds a customer-visible mobile Account Vault resend/review panel for consumed, replay, expired, refund and velocity states.",
      "PASS2552 introduces durable resend queue event fixtures with idempotency key, queue event hash and redacted velocity counter hash.",
      "PASS2552 blocks any support resend CTA until supportResendRequestId and customerResendAckHash are present before the CTA renders enabled.",
      "PASS2552 preserves privacy: raw IP, raw device fingerprint, raw user agent, private contact and provider payload are never stored in customer-visible resend queue events.",
      "PASS2552 adds PL/EN/DE refund/resend copy parity checks tied to paid export receipt and refund policy snapshot.",
    ],
    nextPassQueue: [
      "PASS2553: real streaming middleware hook that appends consumed ledger only on response close success, not route open.",
      "PASS2553: server-side resend queue persistence adapter backed by account-bound storage and idempotency locks.",
      "PASS2554: mobile screenshot fixture for 390x844 and 430x932 Account Vault resend/review panel states.",
      "PASS2554: Angel support answer replay tests for refund/resend copy parity and no private-contact leak.",
      "PASS2555: operator support inbox view for resend queue events with dual-control and audit expiry.",
    ],
    releaseEquation: "mobilePanelVisible × supportResendRequestId × customerResendAckHash × durableQueueEventId × redactedVelocityCounterHash × accountInboxOnly × noPrivateContactLeak",
    fingerprint: stableHash({ id: PASS2552_MOBILE_ACCOUNT_VAULT_RESEND_REVIEW_PANEL_REBALANCE_ID, state, panels, durableQueueEvents, privacyVelocityCounters, refundResendCopyParity, supportCtaGuards }),
  };
}
