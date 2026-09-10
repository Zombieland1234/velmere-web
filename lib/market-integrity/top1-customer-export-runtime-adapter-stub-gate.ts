import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2844CustomerExportPostReinstatementAuditNotificationGate } from "@/lib/market-integrity/top1-customer-export-post-reinstatement-audit-notification-gate";

export type Pass2845CustomerExportRuntimeAdapterState =
  | "post_notification_blocked"
  | "storage_adapter_missing"
  | "dev_adapter_missing"
  | "db_adapter_contract_missing"
  | "event_writer_missing"
  | "retry_increment_missing"
  | "ack_verifier_missing"
  | "hold_release_writer_missing"
  | "operator_reinstatement_writer_missing"
  | "notification_writer_missing"
  | "retention_dry_run_missing"
  | "channel_writer_missing"
  | "payload_drift_blocked"
  | "runtime_adapter_ready";

export type Pass2845CustomerExportRuntimeEventKind =
  | "export_issued"
  | "download_attempted"
  | "email_notice_sent"
  | "api_handoff_sent"
  | "support_attachment_created"
  | "recall_requested"
  | "recall_completed"
  | "reissue_requested"
  | "retry_incremented"
  | "acknowledgement_verified"
  | "hold_opened"
  | "hold_released"
  | "operator_reinstated"
  | "post_reinstatement_notification_written"
  | "retention_dry_run";

export type Pass2845CustomerExportRuntimeAdapterKind = "memory_dev" | "database_contract" | "storage_contract" | "event_writer_contract";

export type Pass2845CustomerExportRuntimeEvent = {
  eventId: string;
  eventKind: Pass2845CustomerExportRuntimeEventKind;
  packetId: string;
  channel: "account_vault" | "email" | "api" | "support" | "multi_channel";
  payloadHash: string;
  sourceReceiptRoot: string;
  idempotencyKey: string;
  createdAt: string;
};

export type Pass2845CustomerExportRuntimeAdapterPort = {
  adapterKind: Pass2845CustomerExportRuntimeAdapterKind;
  appendEvent(event: Pass2845CustomerExportRuntimeEvent): Promise<Pass2845CustomerExportRuntimeEvent>;
  incrementRetry(packetId: string, idempotencyKey: string): Promise<{ packetId: string; retryCount: number; idempotencyKey: string }>;
  verifySignedAcknowledgement(args: { signedReceiptId: string; payloadHash: string; sourceReceiptRoot: string }): Promise<{ verified: boolean; verifierReceiptId: string }>;
  writeHoldRelease(args: { holdReleaseReceiptId: string; operatorReviewReceiptId: string; payloadHash: string; sourceReceiptRoot: string }): Promise<{ written: boolean; eventId: string }>;
  writeOperatorReinstatement(args: { operatorReleaseReceiptId: string; reissuedLinkId: string; payloadHash: string; sourceReceiptRoot: string }): Promise<{ written: boolean; eventId: string }>;
  writePostReinstatementNotification(args: { notificationDispatchReceiptId: string; notificationContentHash: string; payloadHash: string; sourceReceiptRoot: string }): Promise<{ written: boolean; eventId: string }>;
  runRetentionDryRun(args: { retentionSnapshotId: string; packetId: string }): Promise<{ dryRunPassed: boolean; retentionJobReceiptId: string }>;
};

export type Pass2845CustomerExportRuntimeAdapterStubGate = {
  schemaVersion: "pass2845_customer_export_runtime_adapter_stub_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  runtimeAdapterState: Pass2845CustomerExportRuntimeAdapterState;
  runtimeAdapterReadinessScore: number;
  adapterEnvelope: {
    storageAdapterInterfaceId: string | null;
    memoryDevAdapterId: string | null;
    dbAdapterContractId: string | null;
    eventWriterContractId: string | null;
    atomicRetryIncrementFnId: string | null;
    signedAcknowledgementVerifierId: string | null;
    disputeHoldReleaseWriterId: string | null;
    operatorReleaseReinstatementWriterId: string | null;
    postReinstatementNotificationWriterId: string | null;
    retentionJobDryRunVerifierId: string | null;
    accountVaultEventWriterId: string | null;
    emailEventWriterId: string | null;
    apiHandoffEventWriterId: string | null;
    supportAttachmentEventWriterId: string | null;
    appendOnlyEventKinds: Pass2845CustomerExportRuntimeEventKind[];
    previousPostNotificationReceiptId: string | null;
    payloadHashBound: string | null;
    sourceReceiptRootBound: string | null;
  };
  runtimePolicy: {
    canPersistCustomerExportEvents: boolean;
    canIncrementRetryBudget: boolean;
    canVerifySignedAcknowledgement: boolean;
    canWriteHoldRelease: boolean;
    canWriteOperatorReinstatement: boolean;
    canWritePostReinstatementNotification: boolean;
    canRunRetentionDryRun: boolean;
    canClaimProductionRuntimeAdapter: false;
    reason: string;
  };
  runtimeRiskSignals: {
    previousPostNotificationNotReady: boolean;
    missingStorageAdapterInterface: boolean;
    missingMemoryDevAdapter: boolean;
    missingDbAdapterContract: boolean;
    missingEventWriterContract: boolean;
    missingAtomicRetryIncrementFn: boolean;
    missingSignedAcknowledgementVerifier: boolean;
    missingDisputeHoldReleaseWriter: boolean;
    missingOperatorReleaseReinstatementWriter: boolean;
    missingPostReinstatementNotificationWriter: boolean;
    missingRetentionJobDryRunVerifier: boolean;
    missingChannelEventWriters: boolean;
    payloadOrSourceRootDrift: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2845_CUSTOMER_EXPORT_RUNTIME_ADAPTER_STUB_ACCEPTANCE_GATES = [
  "PASS2845: Post-reinstatement notification proof is not a runtime implementation; customer export events require a server-side adapter port with storage, retry, acknowledgement, hold, reinstatement, notification and retention writer contracts.",
  "PASS2845: A local in-memory adapter may be used only for deterministic tests; production claims require a DB/storage adapter contract without client secrets or browser-side persistence.",
  "PASS2845: Retry increments must be atomic and idempotency-keyed before resend/download/API/support handoff can be persisted as customer-safe evidence.",
  "PASS2845: Recall, reissue, acknowledgement, hold-release, operator-reinstatement and post-notification events must be append-only and bound to payloadHash/sourceReceiptRoot.",
  "PASS2845: Runtime adapter readiness does not claim live DB/email/API delivery; it only proves interfaces and dry-run contracts exist until production credentials, migrations and integration tests are attached.",
] as const;

const REQUIRED_RUNTIME_EVENT_KINDS: Pass2845CustomerExportRuntimeEventKind[] = [
  "export_issued",
  "download_attempted",
  "email_notice_sent",
  "api_handoff_sent",
  "support_attachment_created",
  "recall_requested",
  "recall_completed",
  "reissue_requested",
  "retry_incremented",
  "acknowledgement_verified",
  "hold_opened",
  "hold_released",
  "operator_reinstated",
  "post_reinstatement_notification_written",
  "retention_dry_run",
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2845MemoryCustomerExportRuntimeAdapter(): Pass2845CustomerExportRuntimeAdapterPort & {
  readonly events: Pass2845CustomerExportRuntimeEvent[];
} {
  const events: Pass2845CustomerExportRuntimeEvent[] = [];
  const retryCounts = new Map<string, number>();

  return {
    adapterKind: "memory_dev",
    events,
    async appendEvent(event) {
      events.push(Object.freeze({ ...event }));
      return event;
    },
    async incrementRetry(packetId, idempotencyKey) {
      const key = `${packetId}:${idempotencyKey}`;
      const next = (retryCounts.get(key) ?? 0) + 1;
      retryCounts.set(key, next);
      return { packetId, retryCount: next, idempotencyKey };
    },
    async verifySignedAcknowledgement(args) {
      return {
        verified: Boolean(args.signedReceiptId && args.payloadHash && args.sourceReceiptRoot),
        verifierReceiptId: `memory_ack_verifier_${args.signedReceiptId || "missing"}`,
      };
    },
    async writeHoldRelease(args) {
      return { written: Boolean(args.holdReleaseReceiptId && args.operatorReviewReceiptId && args.payloadHash && args.sourceReceiptRoot), eventId: `memory_hold_release_${args.holdReleaseReceiptId || "missing"}` };
    },
    async writeOperatorReinstatement(args) {
      return { written: Boolean(args.operatorReleaseReceiptId && args.reissuedLinkId && args.payloadHash && args.sourceReceiptRoot), eventId: `memory_operator_reinstatement_${args.operatorReleaseReceiptId || "missing"}` };
    },
    async writePostReinstatementNotification(args) {
      return { written: Boolean(args.notificationDispatchReceiptId && args.notificationContentHash && args.payloadHash && args.sourceReceiptRoot), eventId: `memory_post_notification_${args.notificationDispatchReceiptId || "missing"}` };
    },
    async runRetentionDryRun(args) {
      return { dryRunPassed: Boolean(args.retentionSnapshotId && args.packetId), retentionJobReceiptId: `memory_retention_dry_run_${args.retentionSnapshotId || "missing"}` };
    },
  };
}

export function buildPass2845CustomerExportRuntimeAdapterStubGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportPostReinstatementAuditNotificationGate: Pass2844CustomerExportPostReinstatementAuditNotificationGate;
  generatedAt?: string;
  storageAdapterInterfaceId?: string | null;
  memoryDevAdapterId?: string | null;
  dbAdapterContractId?: string | null;
  eventWriterContractId?: string | null;
  atomicRetryIncrementFnId?: string | null;
  signedAcknowledgementVerifierId?: string | null;
  disputeHoldReleaseWriterId?: string | null;
  operatorReleaseReinstatementWriterId?: string | null;
  postReinstatementNotificationWriterId?: string | null;
  retentionJobDryRunVerifierId?: string | null;
  accountVaultEventWriterId?: string | null;
  emailEventWriterId?: string | null;
  apiHandoffEventWriterId?: string | null;
  supportAttachmentEventWriterId?: string | null;
  appendOnlyEventKinds?: Pass2845CustomerExportRuntimeEventKind[];
  previousPostNotificationReceiptId?: string | null;
  payloadHashBound?: string | null;
  sourceReceiptRootBound?: string | null;
  payloadOrSourceRootDrift?: boolean;
}): Pass2845CustomerExportRuntimeAdapterStubGate {
  const previousGate = args.customerExportPostReinstatementAuditNotificationGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(
    previousGate.postReinstatementPolicy.canServeCustomerVisibleExport && previousGate.postReinstatementState === "post_reinstatement_ready",
  );
  const appendOnlyEventKinds = args.appendOnlyEventKinds ?? REQUIRED_RUNTIME_EVENT_KINDS;
  const hasAllEventKinds = REQUIRED_RUNTIME_EVENT_KINDS.every((kind) => appendOnlyEventKinds.includes(kind));
  const channelWritersReady = Boolean(
    args.accountVaultEventWriterId && args.emailEventWriterId && args.apiHandoffEventWriterId && args.supportAttachmentEventWriterId,
  );
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift);

  const ready = Boolean(
    previousReady &&
      args.storageAdapterInterfaceId &&
      args.memoryDevAdapterId &&
      args.dbAdapterContractId &&
      args.eventWriterContractId &&
      args.atomicRetryIncrementFnId &&
      args.signedAcknowledgementVerifierId &&
      args.disputeHoldReleaseWriterId &&
      args.operatorReleaseReinstatementWriterId &&
      args.postReinstatementNotificationWriterId &&
      args.retentionJobDryRunVerifierId &&
      channelWritersReady &&
      hasAllEventKinds &&
      !payloadOrSourceRootDrift,
  );

  const runtimeAdapterState: Pass2845CustomerExportRuntimeAdapterState = !previousReady
    ? "post_notification_blocked"
    : payloadOrSourceRootDrift
      ? "payload_drift_blocked"
      : !args.storageAdapterInterfaceId
        ? "storage_adapter_missing"
        : !args.memoryDevAdapterId
          ? "dev_adapter_missing"
          : !args.dbAdapterContractId
            ? "db_adapter_contract_missing"
            : !args.eventWriterContractId || !hasAllEventKinds
              ? "event_writer_missing"
              : !args.atomicRetryIncrementFnId
                ? "retry_increment_missing"
                : !args.signedAcknowledgementVerifierId
                  ? "ack_verifier_missing"
                  : !args.disputeHoldReleaseWriterId
                    ? "hold_release_writer_missing"
                    : !args.operatorReleaseReinstatementWriterId
                      ? "operator_reinstatement_writer_missing"
                      : !args.postReinstatementNotificationWriterId
                        ? "notification_writer_missing"
                        : !args.retentionJobDryRunVerifierId
                          ? "retention_dry_run_missing"
                          : !channelWritersReady
                            ? "channel_writer_missing"
                            : "runtime_adapter_ready";

  const runtimeAdapterReadinessScore = clamp(
    previousGate.postReinstatementReadinessScore +
      (previousReady ? 8 : -32) +
      (args.storageAdapterInterfaceId ? 8 : -12) +
      (args.memoryDevAdapterId ? 6 : -8) +
      (args.dbAdapterContractId ? 8 : -12) +
      (args.eventWriterContractId && hasAllEventKinds ? 10 : -14) +
      (args.atomicRetryIncrementFnId ? 8 : -12) +
      (args.signedAcknowledgementVerifierId ? 8 : -10) +
      (args.disputeHoldReleaseWriterId ? 7 : -10) +
      (args.operatorReleaseReinstatementWriterId ? 7 : -10) +
      (args.postReinstatementNotificationWriterId ? 7 : -10) +
      (args.retentionJobDryRunVerifierId ? 6 : -8) +
      (channelWritersReady ? 10 : -14) -
      (payloadOrSourceRootDrift ? 48 : 0),
  );

  const reason = ready
    ? "Customer export runtime adapter boundary is ready for local deterministic tests: adapter ports, event writers, idempotent retry, signed acknowledgement verification, hold/reinstatement/notification writers and retention dry-run contracts are present."
    : "Customer export runtime adapter remains prepared-only until storage, DB contract, append-only event writers, idempotent retry, acknowledgement/hold/reinstatement/notification writers and retention dry-run contracts are all present and payload-bound.";

  const operatorNextActions = [
    !previousReady ? "Finish PASS2844 post-reinstatement notification proof before runtime persistence writes." : null,
    !args.storageAdapterInterfaceId ? "Define server-side customer export storage adapter interface." : null,
    !args.memoryDevAdapterId ? "Attach deterministic memory/dev adapter for local verifier tests only." : null,
    !args.dbAdapterContractId ? "Attach DB adapter contract placeholder without secrets or live credentials." : null,
    !args.eventWriterContractId || !hasAllEventKinds ? "Register append-only event writer contract for recall/reissue/ack/hold/reinstatement/post-notification events." : null,
    !args.atomicRetryIncrementFnId ? "Add atomic retry increment function signature with idempotency key." : null,
    !args.signedAcknowledgementVerifierId ? "Add signed acknowledgement verifier interface." : null,
    !args.disputeHoldReleaseWriterId ? "Add dispute/chargeback hold-release writer interface." : null,
    !args.operatorReleaseReinstatementWriterId ? "Add operator release/reinstatement writer interface." : null,
    !args.postReinstatementNotificationWriterId ? "Add post-reinstatement notification writer interface." : null,
    !args.retentionJobDryRunVerifierId ? "Add retention job dry-run verifier interface." : null,
    !channelWritersReady ? "Attach account-vault/email/API/support channel event writer contracts." : null,
    payloadOrSourceRootDrift ? "Freeze runtime adapter writes until payloadHash/sourceReceiptRoot drift is replayed and resealed." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2845_customer_export_runtime_adapter_stub_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    runtimeAdapterState,
    runtimeAdapterReadinessScore,
    adapterEnvelope: {
      storageAdapterInterfaceId: args.storageAdapterInterfaceId ?? null,
      memoryDevAdapterId: args.memoryDevAdapterId ?? null,
      dbAdapterContractId: args.dbAdapterContractId ?? null,
      eventWriterContractId: args.eventWriterContractId ?? null,
      atomicRetryIncrementFnId: args.atomicRetryIncrementFnId ?? null,
      signedAcknowledgementVerifierId: args.signedAcknowledgementVerifierId ?? null,
      disputeHoldReleaseWriterId: args.disputeHoldReleaseWriterId ?? null,
      operatorReleaseReinstatementWriterId: args.operatorReleaseReinstatementWriterId ?? null,
      postReinstatementNotificationWriterId: args.postReinstatementNotificationWriterId ?? null,
      retentionJobDryRunVerifierId: args.retentionJobDryRunVerifierId ?? null,
      accountVaultEventWriterId: args.accountVaultEventWriterId ?? null,
      emailEventWriterId: args.emailEventWriterId ?? null,
      apiHandoffEventWriterId: args.apiHandoffEventWriterId ?? null,
      supportAttachmentEventWriterId: args.supportAttachmentEventWriterId ?? null,
      appendOnlyEventKinds,
      previousPostNotificationReceiptId: args.previousPostNotificationReceiptId ?? previousGate.notificationAuditEnvelope.customerNotificationDispatchReceiptId,
      payloadHashBound: args.payloadHashBound ?? previousGate.notificationAuditEnvelope.payloadHashBound,
      sourceReceiptRootBound: args.sourceReceiptRootBound ?? previousGate.notificationAuditEnvelope.sourceReceiptRootBound,
    },
    runtimePolicy: {
      canPersistCustomerExportEvents: ready,
      canIncrementRetryBudget: ready,
      canVerifySignedAcknowledgement: ready,
      canWriteHoldRelease: ready,
      canWriteOperatorReinstatement: ready,
      canWritePostReinstatementNotification: ready,
      canRunRetentionDryRun: ready,
      canClaimProductionRuntimeAdapter: false,
      reason,
    },
    runtimeRiskSignals: {
      previousPostNotificationNotReady: !previousReady,
      missingStorageAdapterInterface: !args.storageAdapterInterfaceId,
      missingMemoryDevAdapter: !args.memoryDevAdapterId,
      missingDbAdapterContract: !args.dbAdapterContractId,
      missingEventWriterContract: !args.eventWriterContractId || !hasAllEventKinds,
      missingAtomicRetryIncrementFn: !args.atomicRetryIncrementFnId,
      missingSignedAcknowledgementVerifier: !args.signedAcknowledgementVerifierId,
      missingDisputeHoldReleaseWriter: !args.disputeHoldReleaseWriterId,
      missingOperatorReleaseReinstatementWriter: !args.operatorReleaseReinstatementWriterId,
      missingPostReinstatementNotificationWriter: !args.postReinstatementNotificationWriterId,
      missingRetentionJobDryRunVerifier: !args.retentionJobDryRunVerifierId,
      missingChannelEventWriters: !channelWritersReady,
      payloadOrSourceRootDrift,
    },
    customerSafeCopy: ready
      ? "Customer export runtime adapter interfaces are ready for local deterministic tests. Production delivery still requires real DB/storage/email/API credentials, migrations and integration evidence."
      : "Customer export runtime adapter is prepared-only until server-side storage, event writers, idempotent retry, signed acknowledgement, hold/reinstatement/notification and retention dry-run contracts are attached.",
    operatorNextActions,
  };
}
