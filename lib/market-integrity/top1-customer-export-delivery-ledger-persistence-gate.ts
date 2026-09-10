import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2839CustomerExportExpiryRecallGate } from "@/lib/market-integrity/top1-customer-export-expiry-recall-gate";

export type Pass2840CustomerExportPersistenceState =
  | "not_persistable"
  | "schema_pending"
  | "persistence_ready"
  | "link_storage_missing"
  | "recall_timeline_gap"
  | "resend_idempotency_not_persisted"
  | "retry_counter_not_atomic"
  | "retention_job_missing"
  | "channel_event_missing"
  | "payload_drift_blocked";

export type Pass2840CustomerExportLedgerChannel =
  | "account_vault"
  | "email_notice"
  | "api_handoff"
  | "support_attachment";

export type Pass2840CustomerExportDeliveryLedgerPersistenceGate = {
  schemaVersion: "pass2840_customer_export_delivery_ledger_persistence_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  persistenceState: Pass2840CustomerExportPersistenceState;
  persistenceReadinessScore: number;
  durableExportPacketRow: {
    exportLedgerRowId: string | null;
    exportPacketId: string | null;
    activeLinkId: string | null;
    payloadHash: string | null;
    sourceReceiptRoot: string | null;
    supportSlaTicketId: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    status: "pending" | "active" | "expired" | "recalled" | "retention_closed" | "blocked";
    rowSchemaVersion: "customer_export_delivery_ledger_v1";
  };
  storageAdapterContract: {
    adapterName: "customer_export_delivery_ledger_adapter_v1";
    linkStorageAdapterReady: boolean;
    recallTimelineStoreReady: boolean;
    resendIdempotencyStoreReady: boolean;
    retryBudgetCounterAtomic: boolean;
    supportAttachmentRetentionJobReady: boolean;
    channelEventStoreReady: boolean;
    accountVaultEventId: string | null;
    emailNoticeEventId: string | null;
    apiHandoffEventId: string | null;
    supportAttachmentEventId: string | null;
  };
  persistencePolicy: {
    canPersistExportPacket: boolean;
    canServeFromAccountVault: boolean;
    canSendTransactionalEmail: boolean;
    canExposeApiHandoff: boolean;
    canAttachToSupport: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  persistenceRiskSignals: {
    previousExpiryRecallBlocked: boolean;
    missingLedgerRow: boolean;
    missingLinkStorage: boolean;
    missingRecallTimeline: boolean;
    missingResendIdempotencyStore: boolean;
    retryCounterNotAtomic: boolean;
    missingRetentionJob: boolean;
    missingRequiredChannelEvent: boolean;
    payloadOrSourceRootDrift: boolean;
    recalledWithoutTimeline: boolean;
    expiredWithoutRetentionClose: boolean;
  };
  operatorNextActions: string[];
};

export const PASS2840_CUSTOMER_EXPORT_DELIVERY_LEDGER_PERSISTENCE_ACCEPTANCE_GATES = [
  "PASS2840: Customer export delivery must have a durable ledger row; active links, retries, recall and channel events cannot live only in transient payload JSON.",
  "PASS2840: Account-vault download, email notice, API handoff and support attachment each require their own persisted channel event ID tied to the same exportPacketId/payloadHash/sourceReceiptRoot.",
  "PASS2840: Recall/reissue must append timeline events; a recalled packet cannot be reactivated by overwriting status or deleting history.",
  "PASS2840: Resend idempotency and retry-budget counters must be stored atomically so customer support cannot duplicate paid evidence delivery.",
  "PASS2840: Support attachment retention requires a scheduled retention job contract; missing retention jobs block support attachment and launch-ready/customer-safe export claims.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function redact(value: string | null | undefined) {
  if (!value) return null;
  const clean = String(value).replace(/[^a-zA-Z0-9_-]/g, "");
  if (clean.length <= 10) return `${clean.slice(0, 3)}…redacted`;
  return `${clean.slice(0, 5)}…${clean.slice(-5)}`;
}

function channelEventReady(channel: Pass2840CustomerExportLedgerChannel, args: {
  accountVaultEventId?: string | null;
  emailNoticeEventId?: string | null;
  apiHandoffEventId?: string | null;
  supportAttachmentEventId?: string | null;
}) {
  if (channel === "account_vault") return Boolean(args.accountVaultEventId);
  if (channel === "email_notice") return Boolean(args.emailNoticeEventId);
  if (channel === "api_handoff") return Boolean(args.apiHandoffEventId);
  return Boolean(args.supportAttachmentEventId);
}

export function buildPass2840CustomerExportDeliveryLedgerPersistenceGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportExpiryRecallGate: Pass2839CustomerExportExpiryRecallGate;
  generatedAt?: string;
  exportLedgerRowId?: string | null;
  payloadHash?: string | null;
  sourceReceiptRoot?: string | null;
  supportSlaTicketId?: string | null;
  status?: "pending" | "active" | "expired" | "recalled" | "retention_closed" | "blocked";
  requestedChannel?: Pass2840CustomerExportLedgerChannel;
  linkStorageAdapterReady?: boolean;
  recallTimelineStoreReady?: boolean;
  resendIdempotencyStoreReady?: boolean;
  retryBudgetCounterAtomic?: boolean;
  supportAttachmentRetentionJobReady?: boolean;
  channelEventStoreReady?: boolean;
  accountVaultEventId?: string | null;
  emailNoticeEventId?: string | null;
  apiHandoffEventId?: string | null;
  supportAttachmentEventId?: string | null;
  payloadOrSourceRootDrift?: boolean;
}): Pass2840CustomerExportDeliveryLedgerPersistenceGate {
  const expiryGate = args.customerExportExpiryRecallGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const requestedChannel = args.requestedChannel ?? "account_vault";
  const previousExpiryRecallClear = Boolean(expiryGate.recallPolicy.canServeActiveLink && !expiryGate.recallRiskSignals.payloadOrSourceRootDrift);
  const ledgerRowReady = Boolean(args.exportLedgerRowId);
  const linkStorageAdapterReady = args.linkStorageAdapterReady !== false && Boolean(expiryGate.expiryEnvelope.activeLinkId);
  const recallTimelineStoreReady = args.recallTimelineStoreReady !== false;
  const resendIdempotencyStoreReady = args.resendIdempotencyStoreReady !== false;
  const retryBudgetCounterAtomic = args.retryBudgetCounterAtomic !== false;
  const supportAttachmentRetentionJobReady = args.supportAttachmentRetentionJobReady !== false;
  const channelEventStoreReady = args.channelEventStoreReady !== false;
  const requiredChannelEventReady = channelEventStoreReady && channelEventReady(requestedChannel, args);
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift || expiryGate.recallRiskSignals.payloadOrSourceRootDrift);
  const recallState = expiryGate.recallState;
  const recalledWithoutTimeline = (recallState === "recalled" || recallState === "recall_required") && !recallTimelineStoreReady;
  const expiredWithoutRetentionClose = (recallState === "expired" || recallState === "retention_window_closed") && !supportAttachmentRetentionJobReady;

  const persistenceClear = Boolean(
    previousExpiryRecallClear &&
      ledgerRowReady &&
      linkStorageAdapterReady &&
      recallTimelineStoreReady &&
      resendIdempotencyStoreReady &&
      retryBudgetCounterAtomic &&
      supportAttachmentRetentionJobReady &&
      channelEventStoreReady &&
      requiredChannelEventReady &&
      !payloadOrSourceRootDrift &&
      !recalledWithoutTimeline &&
      !expiredWithoutRetentionClose,
  );

  const persistenceState: Pass2840CustomerExportPersistenceState = !previousExpiryRecallClear
    ? "not_persistable"
    : payloadOrSourceRootDrift
      ? "payload_drift_blocked"
      : !ledgerRowReady
        ? "schema_pending"
        : !linkStorageAdapterReady
          ? "link_storage_missing"
          : recalledWithoutTimeline
            ? "recall_timeline_gap"
            : !resendIdempotencyStoreReady
              ? "resend_idempotency_not_persisted"
              : !retryBudgetCounterAtomic
                ? "retry_counter_not_atomic"
                : !supportAttachmentRetentionJobReady || expiredWithoutRetentionClose
                  ? "retention_job_missing"
                  : !requiredChannelEventReady
                    ? "channel_event_missing"
                    : "persistence_ready";

  const persistenceReadinessScore = clamp(
    expiryGate.recallReadinessScore +
      (previousExpiryRecallClear ? 10 : -34) +
      (ledgerRowReady ? 18 : -26) +
      (linkStorageAdapterReady ? 12 : -18) +
      (recallTimelineStoreReady ? 12 : -20) +
      (resendIdempotencyStoreReady ? 10 : -18) +
      (retryBudgetCounterAtomic ? 10 : -20) +
      (supportAttachmentRetentionJobReady ? 12 : -22) +
      (channelEventStoreReady ? 8 : -14) +
      (requiredChannelEventReady ? 12 : -18) -
      (payloadOrSourceRootDrift ? 30 : 0) -
      (recalledWithoutTimeline ? 18 : 0) -
      (expiredWithoutRetentionClose ? 16 : 0),
  );

  const reason = !previousExpiryRecallClear
    ? "PASS2839 expiry/recall gate is not clear; persistence cannot make an unsafe or expired export deliverable."
    : payloadOrSourceRootDrift
      ? "Payload/source-root drift blocks persistence; create a new ledger row only after replay and reseal."
      : !ledgerRowReady
        ? "Durable export packet ledger row is missing; export state still lives only in transient payload context."
        : !linkStorageAdapterReady
          ? "Expiring link storage adapter is missing; activeLinkId cannot be served from durable account/download state."
          : recalledWithoutTimeline
            ? "Recall/reissue timeline store is missing; recalled exports require append-only history before any reissue."
            : !resendIdempotencyStoreReady
              ? "Resend idempotency store is missing; email/API retry could duplicate paid evidence delivery."
              : !retryBudgetCounterAtomic
                ? "Retry budget counter is not atomic; support retries could race and exceed the allowed budget."
                : !supportAttachmentRetentionJobReady
                  ? "Support attachment retention job contract is missing; support attachment handoff remains blocked."
                  : !requiredChannelEventReady
                    ? "Requested export channel is missing its own persisted channel event ID."
                    : "Customer export delivery is ledger-backed, idempotent, retry-budgeted, recall-timeline aware and retention-job guarded.";

  return {
    schemaVersion: "pass2840_customer_export_delivery_ledger_persistence_gate_v1",
    surface: args.surface,
    tier: args.tier ?? expiryGate.tier,
    releasePacketId: expiryGate.releasePacketId,
    sealId: expiryGate.sealId,
    generatedAt,
    persistenceState,
    persistenceReadinessScore,
    durableExportPacketRow: {
      exportLedgerRowId: redact(args.exportLedgerRowId),
      exportPacketId: expiryGate.expiryEnvelope.exportPacketId,
      activeLinkId: expiryGate.expiryEnvelope.activeLinkId,
      payloadHash: redact(args.payloadHash),
      sourceReceiptRoot: redact(args.sourceReceiptRoot),
      supportSlaTicketId: redact(args.supportSlaTicketId),
      issuedAt: expiryGate.expiryEnvelope.issuedAt,
      expiresAt: expiryGate.expiryEnvelope.expiresAt,
      status: args.status ?? (persistenceClear ? "active" : recallState === "recalled" ? "recalled" : recallState === "expired" ? "expired" : "blocked"),
      rowSchemaVersion: "customer_export_delivery_ledger_v1",
    },
    storageAdapterContract: {
      adapterName: "customer_export_delivery_ledger_adapter_v1",
      linkStorageAdapterReady,
      recallTimelineStoreReady,
      resendIdempotencyStoreReady,
      retryBudgetCounterAtomic,
      supportAttachmentRetentionJobReady,
      channelEventStoreReady,
      accountVaultEventId: redact(args.accountVaultEventId),
      emailNoticeEventId: redact(args.emailNoticeEventId),
      apiHandoffEventId: redact(args.apiHandoffEventId),
      supportAttachmentEventId: redact(args.supportAttachmentEventId),
    },
    persistencePolicy: {
      canPersistExportPacket: persistenceClear,
      canServeFromAccountVault: persistenceClear && requestedChannel === "account_vault",
      canSendTransactionalEmail: persistenceClear && requestedChannel === "email_notice",
      canExposeApiHandoff: persistenceClear && requestedChannel === "api_handoff",
      canAttachToSupport: persistenceClear && requestedChannel === "support_attachment",
      canClaimWorldClass100: false,
      reason,
    },
    persistenceRiskSignals: {
      previousExpiryRecallBlocked: !previousExpiryRecallClear,
      missingLedgerRow: !ledgerRowReady,
      missingLinkStorage: !linkStorageAdapterReady,
      missingRecallTimeline: !recallTimelineStoreReady,
      missingResendIdempotencyStore: !resendIdempotencyStoreReady,
      retryCounterNotAtomic: !retryBudgetCounterAtomic,
      missingRetentionJob: !supportAttachmentRetentionJobReady,
      missingRequiredChannelEvent: !requiredChannelEventReady,
      payloadOrSourceRootDrift,
      recalledWithoutTimeline,
      expiredWithoutRetentionClose,
    },
    operatorNextActions: [
      previousExpiryRecallClear ? "PASS2839 expiry/recall gate is clear; persist the active link and retry state." : "Do not persist a customer-visible export until PASS2839 expiry/recall gate clears.",
      ledgerRowReady ? "Durable export ledger row is present; verify payload/source/support binding." : "Create customer_export_delivery_ledger row with payloadHash, sourceReceiptRoot, activeLinkId and status.",
      linkStorageAdapterReady ? "Expiring link storage adapter is ready." : "Add expiring link storage adapter and enforce expiresAt server-side.",
      recallTimelineStoreReady ? "Recall/reissue timeline store is ready." : "Add append-only recall/reissue timeline events before reactivation.",
      resendIdempotencyStoreReady ? "Resend idempotency storage is ready." : "Persist resend idempotency key before email/API resend.",
      retryBudgetCounterAtomic ? "Retry budget counter is atomic." : "Move retry budget increments into an atomic storage transaction.",
      supportAttachmentRetentionJobReady ? "Support attachment retention job contract is ready." : "Create retention job contract for support attachments and closing timeline events.",
      requiredChannelEventReady ? "Requested channel has its own event ID." : "Persist account-vault/email/API/support channel event ID before customer-safe delivery claim.",
    ],
  };
}
