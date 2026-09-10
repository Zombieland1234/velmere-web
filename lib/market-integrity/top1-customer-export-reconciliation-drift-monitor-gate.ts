import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2847CustomerExportWorkerReplayRecoveryGate } from "@/lib/market-integrity/top1-customer-export-worker-replay-recovery-gate";

export type Pass2848CustomerExportReconciliationDriftMonitorState =
  | "worker_replay_recovery_blocked"
  | "reconciliation_run_missing"
  | "ledger_snapshot_missing"
  | "outbox_snapshot_missing"
  | "storage_snapshot_missing"
  | "customer_receipt_snapshot_missing"
  | "channel_commit_snapshot_missing"
  | "drift_detected_blocked"
  | "remediation_ticket_missing"
  | "reconciliation_timeline_missing"
  | "reconciliation_drift_monitor_ready";

export type Pass2848CustomerExportReconciliationChannel = "account_vault" | "email" | "api" | "support";

export type Pass2848CustomerExportChannelSnapshot = {
  channel: Pass2848CustomerExportReconciliationChannel;
  ledgerEventId: string;
  outboxEventId: string;
  storageObjectId: string;
  customerReceiptId: string;
  commitReceiptId: string;
  payloadHash: string;
  sourceReceiptRoot: string;
};

export type Pass2848CustomerExportReconciliationDriftMonitorGate = {
  schemaVersion: "pass2848_customer_export_reconciliation_drift_monitor_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  reconciliationDriftMonitorState: Pass2848CustomerExportReconciliationDriftMonitorState;
  reconciliationDriftReadinessScore: number;
  reconciliationEnvelope: {
    previousWorkerReplayRecoveryState: string;
    previousWorkerReplayRecoveryReadinessScore: number;
    reconciliationRunId: string | null;
    ledgerSnapshotId: string | null;
    outboxSnapshotId: string | null;
    storageSnapshotId: string | null;
    customerReceiptSnapshotId: string | null;
    channelCommitSnapshotId: string | null;
    expectedPayloadHash: string | null;
    expectedSourceReceiptRoot: string | null;
    observedPayloadHash: string | null;
    observedSourceReceiptRoot: string | null;
    driftMismatchCount: number;
    lastReconciledAt: string | null;
    nextReconcileDueAt: string | null;
    driftRemediationTicketId: string | null;
    reconciliationAuditTimelineHash: string | null;
    channelSnapshots: Pass2848CustomerExportChannelSnapshot[];
  };
  reconciliationPolicy: {
    canMarkExportReconciled: boolean;
    canKeepDeliveryChannelsOpen: boolean;
    canCloseDriftIncident: boolean;
    canClaimProductionReconciliationWorker: false;
    reason: string;
  };
  reconciliationRiskSignals: {
    previousWorkerReplayRecoveryNotReady: boolean;
    missingReconciliationRun: boolean;
    missingLedgerSnapshot: boolean;
    missingOutboxSnapshot: boolean;
    missingStorageSnapshot: boolean;
    missingCustomerReceiptSnapshot: boolean;
    missingChannelCommitSnapshot: boolean;
    driftDetected: boolean;
    missingRemediationTicketForDrift: boolean;
    missingReconciliationTimeline: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2848_CUSTOMER_EXPORT_RECONCILIATION_DRIFT_MONITOR_ACCEPTANCE_GATES = [
  "PASS2848: Customer export delivery must be reconciled across delivery ledger, transactional outbox, storage object, customer receipt and channel commit snapshots before channels stay open.",
  "PASS2848: Reconciliation compares expected and observed payloadHash/sourceReceiptRoot; drift or mismatch count freezes delivery until a remediation ticket and audit timeline are appended.",
  "PASS2848: Account vault, email, API and support attachment reconciliation snapshots cannot reuse the same channel proof; every channel needs its own ledger/outbox/storage/receipt/commit binding.",
  "PASS2848: Worker replay recovery does not prove post-delivery consistency; reconciliation must run after replay/recovery and before customer-safe close claims.",
  "PASS2848: Reconciliation readiness proves deterministic drift-monitor contracts only; it does not claim a deployed production reconciliation worker without runtime evidence.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

const PASS2848_REQUIRED_RECONCILIATION_CHANNELS: readonly Pass2848CustomerExportReconciliationChannel[] = ["account_vault", "email", "api", "support"] as const;

function snapshotsComplete(channelSnapshots: Pass2848CustomerExportChannelSnapshot[]) {
  const channels = new Set<Pass2848CustomerExportReconciliationChannel>(channelSnapshots.map((snapshot) => snapshot.channel));
  return PASS2848_REQUIRED_RECONCILIATION_CHANNELS.every((channel) => channels.has(channel));
}

export function buildPass2848CustomerExportReconciliationDriftMonitorGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportWorkerReplayRecoveryGate: Pass2847CustomerExportWorkerReplayRecoveryGate;
  generatedAt?: string;
  reconciliationRunId?: string | null;
  ledgerSnapshotId?: string | null;
  outboxSnapshotId?: string | null;
  storageSnapshotId?: string | null;
  customerReceiptSnapshotId?: string | null;
  channelCommitSnapshotId?: string | null;
  expectedPayloadHash?: string | null;
  expectedSourceReceiptRoot?: string | null;
  observedPayloadHash?: string | null;
  observedSourceReceiptRoot?: string | null;
  driftMismatchCount?: number;
  lastReconciledAt?: string | null;
  nextReconcileDueAt?: string | null;
  driftRemediationTicketId?: string | null;
  reconciliationAuditTimelineHash?: string | null;
  channelSnapshots?: Pass2848CustomerExportChannelSnapshot[];
  driftDetected?: boolean;
}): Pass2848CustomerExportReconciliationDriftMonitorGate {
  const previousGate = args.customerExportWorkerReplayRecoveryGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(
    previousGate.workerReplayRecoveryState === "worker_replay_recovery_ready" &&
      previousGate.replayRecoveryPolicy.canCommitReplayPerChannel,
  );
  const channelSnapshots = args.channelSnapshots ?? [];
  const channelSnapshotsReady = snapshotsComplete(channelSnapshots);
  const mismatchCount = Math.max(0, args.driftMismatchCount ?? 0);
  const hashDrift = Boolean(
    args.driftDetected ||
      mismatchCount > 0 ||
      (args.expectedPayloadHash && args.observedPayloadHash && args.expectedPayloadHash !== args.observedPayloadHash) ||
      (args.expectedSourceReceiptRoot && args.observedSourceReceiptRoot && args.expectedSourceReceiptRoot !== args.observedSourceReceiptRoot),
  );
  const remediationReadyForDrift = !hashDrift || Boolean(args.driftRemediationTicketId);

  const ready = Boolean(
    previousReady &&
      args.reconciliationRunId &&
      args.ledgerSnapshotId &&
      args.outboxSnapshotId &&
      args.storageSnapshotId &&
      args.customerReceiptSnapshotId &&
      args.channelCommitSnapshotId &&
      channelSnapshotsReady &&
      !hashDrift &&
      remediationReadyForDrift &&
      args.reconciliationAuditTimelineHash,
  );

  const reconciliationDriftMonitorState: Pass2848CustomerExportReconciliationDriftMonitorState = !previousReady
    ? "worker_replay_recovery_blocked"
    : !args.reconciliationRunId
      ? "reconciliation_run_missing"
      : !args.ledgerSnapshotId
        ? "ledger_snapshot_missing"
        : !args.outboxSnapshotId
          ? "outbox_snapshot_missing"
          : !args.storageSnapshotId
            ? "storage_snapshot_missing"
            : !args.customerReceiptSnapshotId
              ? "customer_receipt_snapshot_missing"
              : !args.channelCommitSnapshotId || !channelSnapshotsReady
                ? "channel_commit_snapshot_missing"
                : hashDrift
                  ? remediationReadyForDrift
                    ? "drift_detected_blocked"
                    : "remediation_ticket_missing"
                  : !args.reconciliationAuditTimelineHash
                    ? "reconciliation_timeline_missing"
                    : "reconciliation_drift_monitor_ready";

  const reconciliationDriftReadinessScore = clamp(
    previousGate.workerReplayRecoveryReadinessScore +
      (previousReady ? 7 : -30) +
      (args.reconciliationRunId ? 8 : -12) +
      (args.ledgerSnapshotId ? 8 : -10) +
      (args.outboxSnapshotId ? 8 : -10) +
      (args.storageSnapshotId ? 8 : -10) +
      (args.customerReceiptSnapshotId ? 8 : -10) +
      (args.channelCommitSnapshotId ? 6 : -8) +
      (channelSnapshotsReady ? 12 : -14) +
      (args.reconciliationAuditTimelineHash ? 8 : -10) -
      (hashDrift ? 45 : 0) +
      (hashDrift && args.driftRemediationTicketId ? 7 : 0),
  );

  const reason = ready
    ? "Customer export reconciliation drift monitor contracts are ready: ledger, outbox, storage, customer receipt and per-channel commit snapshots match expected payload/source roots and are timeline-bound."
    : "Customer export reconciliation drift monitor remains prepared-only until ledger, outbox, storage, customer receipt, channel snapshots and audit timeline are present with no payload/source-root drift.";

  const operatorNextActions = [
    !previousReady ? "Finish PASS2847 worker replay recovery before post-delivery reconciliation." : null,
    !args.reconciliationRunId ? "Create a reconciliation run ID for this export packet and channel set." : null,
    !args.ledgerSnapshotId ? "Snapshot the customer export delivery ledger row before close." : null,
    !args.outboxSnapshotId ? "Snapshot transactional outbox state and worker result before close." : null,
    !args.storageSnapshotId ? "Snapshot account/email/API/support storage objects before close." : null,
    !args.customerReceiptSnapshotId ? "Snapshot signed acknowledgement and customer receipt state before close." : null,
    !args.channelCommitSnapshotId || !channelSnapshotsReady ? "Attach account-vault/email/API/support channel snapshot matrix." : null,
    hashDrift && !args.driftRemediationTicketId ? "Open a drift remediation ticket before any channel remains customer-visible." : null,
    hashDrift ? "Freeze customer-visible export channels until payload/source-root drift is replayed, resealed and reconciled." : null,
    !args.reconciliationAuditTimelineHash ? "Hash reconciliation audit timeline before customer-safe close claim." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2848_customer_export_reconciliation_drift_monitor_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    reconciliationDriftMonitorState,
    reconciliationDriftReadinessScore,
    reconciliationEnvelope: {
      previousWorkerReplayRecoveryState: previousGate.workerReplayRecoveryState,
      previousWorkerReplayRecoveryReadinessScore: previousGate.workerReplayRecoveryReadinessScore,
      reconciliationRunId: args.reconciliationRunId ?? null,
      ledgerSnapshotId: args.ledgerSnapshotId ?? null,
      outboxSnapshotId: args.outboxSnapshotId ?? null,
      storageSnapshotId: args.storageSnapshotId ?? null,
      customerReceiptSnapshotId: args.customerReceiptSnapshotId ?? null,
      channelCommitSnapshotId: args.channelCommitSnapshotId ?? null,
      expectedPayloadHash: args.expectedPayloadHash ?? previousGate.replayRecoveryEnvelope.payloadHashBound,
      expectedSourceReceiptRoot: args.expectedSourceReceiptRoot ?? previousGate.replayRecoveryEnvelope.sourceReceiptRootBound,
      observedPayloadHash: args.observedPayloadHash ?? null,
      observedSourceReceiptRoot: args.observedSourceReceiptRoot ?? null,
      driftMismatchCount: mismatchCount,
      lastReconciledAt: args.lastReconciledAt ?? null,
      nextReconcileDueAt: args.nextReconcileDueAt ?? null,
      driftRemediationTicketId: args.driftRemediationTicketId ?? null,
      reconciliationAuditTimelineHash: args.reconciliationAuditTimelineHash ?? null,
      channelSnapshots,
    },
    reconciliationPolicy: {
      canMarkExportReconciled: ready,
      canKeepDeliveryChannelsOpen: ready,
      canCloseDriftIncident: ready,
      canClaimProductionReconciliationWorker: false,
      reason,
    },
    reconciliationRiskSignals: {
      previousWorkerReplayRecoveryNotReady: !previousReady,
      missingReconciliationRun: !args.reconciliationRunId,
      missingLedgerSnapshot: !args.ledgerSnapshotId,
      missingOutboxSnapshot: !args.outboxSnapshotId,
      missingStorageSnapshot: !args.storageSnapshotId,
      missingCustomerReceiptSnapshot: !args.customerReceiptSnapshotId,
      missingChannelCommitSnapshot: !args.channelCommitSnapshotId || !channelSnapshotsReady,
      driftDetected: hashDrift,
      missingRemediationTicketForDrift: hashDrift && !args.driftRemediationTicketId,
      missingReconciliationTimeline: !args.reconciliationAuditTimelineHash,
    },
    customerSafeCopy: ready
      ? "Customer export reconciliation drift monitor contracts are ready for deterministic tests. Production reconciliation still requires deployed workers, live DB migrations and runtime monitoring evidence."
      : "Customer export reconciliation is prepared-only until ledger, outbox, storage, customer receipt and all channel snapshots reconcile without payload/source-root drift.",
    operatorNextActions,
  };
}
