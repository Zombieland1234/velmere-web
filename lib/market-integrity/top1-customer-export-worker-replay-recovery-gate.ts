import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2846CustomerExportTransactionalOutboxHealthGate } from "@/lib/market-integrity/top1-customer-export-transactional-outbox-health-gate";

export type Pass2847CustomerExportWorkerReplayRecoveryState =
  | "outbox_health_blocked"
  | "dead_letter_recovery_receipt_missing"
  | "poison_operator_review_missing"
  | "replay_idempotency_missing"
  | "channel_replay_matrix_missing"
  | "stuck_lease_unlock_missing"
  | "worker_lag_slo_missing"
  | "recovery_timeline_missing"
  | "payload_drift_blocked"
  | "worker_replay_recovery_ready";

export type Pass2847CustomerExportReplayChannel = "account_vault" | "email" | "api" | "support";

export type Pass2847CustomerExportReplayAttempt = {
  replayAttemptId: string;
  originalOutboxEventId: string;
  channel: Pass2847CustomerExportReplayChannel;
  replayIdempotencyKey: string;
  replayCommitReceiptId: string;
  payloadHash: string;
  sourceReceiptRoot: string;
  recoveredAt: string;
  recoveredByOperatorIdHash: string;
};

export type Pass2847CustomerExportWorkerReplayRecoveryGate = {
  schemaVersion: "pass2847_customer_export_worker_replay_recovery_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  workerReplayRecoveryState: Pass2847CustomerExportWorkerReplayRecoveryState;
  workerReplayRecoveryReadinessScore: number;
  replayRecoveryEnvelope: {
    previousTransactionalOutboxState: string;
    previousTransactionalOutboxReadinessScore: number;
    deadLetterRecoveryReceiptId: string | null;
    poisonMessageOperatorReviewReceiptId: string | null;
    replayFromOutboxIdempotencyKey: string | null;
    accountVaultReplayCommitReceiptId: string | null;
    emailReplayCommitReceiptId: string | null;
    apiReplayCommitReceiptId: string | null;
    supportReplayCommitReceiptId: string | null;
    stuckLeaseUnlockPolicyId: string | null;
    stuckLeaseUnlockReceiptId: string | null;
    workerLagSloPolicyId: string | null;
    maxWorkerLagSeconds: number | null;
    recoveryAuditTimelineHash: string | null;
    payloadHashBound: string | null;
    sourceReceiptRootBound: string | null;
  };
  replayRecoveryPolicy: {
    canReplayDeadLetteredExport: boolean;
    canUnlockStuckWorkerLease: boolean;
    canCommitReplayPerChannel: boolean;
    canClaimProductionReplayConsole: false;
    reason: string;
  };
  replayRecoveryRiskSignals: {
    previousOutboxNotReady: boolean;
    missingDeadLetterRecoveryReceipt: boolean;
    missingPoisonOperatorReview: boolean;
    missingReplayIdempotencyKey: boolean;
    missingChannelReplayMatrix: boolean;
    missingStuckLeaseUnlockPolicy: boolean;
    missingWorkerLagSlo: boolean;
    missingRecoveryAuditTimeline: boolean;
    payloadOrSourceRootDrift: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2847_CUSTOMER_EXPORT_WORKER_REPLAY_RECOVERY_ACCEPTANCE_GATES = [
  "PASS2847: Dead-lettered customer export jobs cannot be replayed until a dead-letter recovery receipt and poison-message operator review receipt are appended.",
  "PASS2847: Replay from outbox requires a replay idempotency key and separate replay commit receipts for account vault, email, API and support channels.",
  "PASS2847: Stuck worker leases must be unlocked only through a policy-bound unlock receipt with worker-lag SLO thresholds, not by silent retry.",
  "PASS2847: Recovery/replay remains frozen when payloadHash/sourceReceiptRoot drift is detected or the recovery audit timeline hash is missing.",
  "PASS2847: Worker replay recovery readiness proves deterministic dead-letter/replay contracts only; it does not claim a live operator console or production worker execution without runtime evidence.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2847CustomerExportWorkerReplayRecoveryGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportTransactionalOutboxHealthGate: Pass2846CustomerExportTransactionalOutboxHealthGate;
  generatedAt?: string;
  deadLetterRecoveryReceiptId?: string | null;
  poisonMessageOperatorReviewReceiptId?: string | null;
  replayFromOutboxIdempotencyKey?: string | null;
  accountVaultReplayCommitReceiptId?: string | null;
  emailReplayCommitReceiptId?: string | null;
  apiReplayCommitReceiptId?: string | null;
  supportReplayCommitReceiptId?: string | null;
  stuckLeaseUnlockPolicyId?: string | null;
  stuckLeaseUnlockReceiptId?: string | null;
  workerLagSloPolicyId?: string | null;
  maxWorkerLagSeconds?: number | null;
  recoveryAuditTimelineHash?: string | null;
  payloadHashBound?: string | null;
  sourceReceiptRootBound?: string | null;
  payloadOrSourceRootDrift?: boolean;
}): Pass2847CustomerExportWorkerReplayRecoveryGate {
  const previousGate = args.customerExportTransactionalOutboxHealthGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(
    previousGate.transactionalOutboxState === "transactional_outbox_ready" &&
      previousGate.outboxPolicy.canCommitChannelDelivery &&
      previousGate.outboxPolicy.canRecoverDeadLetters,
  );
  const channelReplayMatrixReady = Boolean(
    args.accountVaultReplayCommitReceiptId &&
      args.emailReplayCommitReceiptId &&
      args.apiReplayCommitReceiptId &&
      args.supportReplayCommitReceiptId,
  );
  const stuckLeaseReady = Boolean(args.stuckLeaseUnlockPolicyId && args.stuckLeaseUnlockReceiptId);
  const workerLagSloReady = Boolean(args.workerLagSloPolicyId && typeof args.maxWorkerLagSeconds === "number");
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift);

  const ready = Boolean(
    previousReady &&
      args.deadLetterRecoveryReceiptId &&
      args.poisonMessageOperatorReviewReceiptId &&
      args.replayFromOutboxIdempotencyKey &&
      channelReplayMatrixReady &&
      stuckLeaseReady &&
      workerLagSloReady &&
      args.recoveryAuditTimelineHash &&
      !payloadOrSourceRootDrift,
  );

  const workerReplayRecoveryState: Pass2847CustomerExportWorkerReplayRecoveryState = !previousReady
    ? "outbox_health_blocked"
    : payloadOrSourceRootDrift
      ? "payload_drift_blocked"
      : !args.deadLetterRecoveryReceiptId
        ? "dead_letter_recovery_receipt_missing"
        : !args.poisonMessageOperatorReviewReceiptId
          ? "poison_operator_review_missing"
          : !args.replayFromOutboxIdempotencyKey
            ? "replay_idempotency_missing"
            : !channelReplayMatrixReady
              ? "channel_replay_matrix_missing"
              : !stuckLeaseReady
                ? "stuck_lease_unlock_missing"
                : !workerLagSloReady
                  ? "worker_lag_slo_missing"
                  : !args.recoveryAuditTimelineHash
                    ? "recovery_timeline_missing"
                    : "worker_replay_recovery_ready";

  const workerReplayRecoveryReadinessScore = clamp(
    previousGate.transactionalOutboxReadinessScore +
      (previousReady ? 7 : -30) +
      (args.deadLetterRecoveryReceiptId ? 10 : -12) +
      (args.poisonMessageOperatorReviewReceiptId ? 9 : -11) +
      (args.replayFromOutboxIdempotencyKey ? 9 : -10) +
      (channelReplayMatrixReady ? 13 : -15) +
      (stuckLeaseReady ? 9 : -11) +
      (workerLagSloReady ? 7 : -9) +
      (args.recoveryAuditTimelineHash ? 8 : -10) -
      (payloadOrSourceRootDrift ? 50 : 0),
  );

  const reason = ready
    ? "Customer export worker replay recovery contracts are ready: dead-letter recovery, poison-message review, replay idempotency, per-channel replay commits, stuck-lease unlock, worker-lag SLO and recovery audit timeline are payload-bound."
    : "Customer export worker replay recovery remains prepared-only until dead-letter recovery, poison review, replay idempotency, channel replay matrix, stuck-lease unlock, worker-lag SLO and recovery timeline contracts are present and payload-bound.";

  const operatorNextActions = [
    !previousReady ? "Finish PASS2846 transactional outbox health before replaying dead-letter customer export jobs." : null,
    !args.deadLetterRecoveryReceiptId ? "Append dead-letter recovery receipt before replaying failed export delivery." : null,
    !args.poisonMessageOperatorReviewReceiptId ? "Attach poison-message operator review receipt before any recovery replay." : null,
    !args.replayFromOutboxIdempotencyKey ? "Create replay-from-outbox idempotency key to prevent duplicate customer delivery." : null,
    !channelReplayMatrixReady ? "Attach account-vault/email/API/support replay commit receipts." : null,
    !stuckLeaseReady ? "Attach stuck worker lease unlock policy and unlock receipt." : null,
    !workerLagSloReady ? "Define worker lag SLO policy and threshold before claiming replay health." : null,
    !args.recoveryAuditTimelineHash ? "Hash the recovery audit timeline before customer-visible replay claim." : null,
    payloadOrSourceRootDrift ? "Freeze replay recovery until payloadHash/sourceReceiptRoot drift is replayed and resealed." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2847_customer_export_worker_replay_recovery_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    workerReplayRecoveryState,
    workerReplayRecoveryReadinessScore,
    replayRecoveryEnvelope: {
      previousTransactionalOutboxState: previousGate.transactionalOutboxState,
      previousTransactionalOutboxReadinessScore: previousGate.transactionalOutboxReadinessScore,
      deadLetterRecoveryReceiptId: args.deadLetterRecoveryReceiptId ?? null,
      poisonMessageOperatorReviewReceiptId: args.poisonMessageOperatorReviewReceiptId ?? null,
      replayFromOutboxIdempotencyKey: args.replayFromOutboxIdempotencyKey ?? null,
      accountVaultReplayCommitReceiptId: args.accountVaultReplayCommitReceiptId ?? null,
      emailReplayCommitReceiptId: args.emailReplayCommitReceiptId ?? null,
      apiReplayCommitReceiptId: args.apiReplayCommitReceiptId ?? null,
      supportReplayCommitReceiptId: args.supportReplayCommitReceiptId ?? null,
      stuckLeaseUnlockPolicyId: args.stuckLeaseUnlockPolicyId ?? null,
      stuckLeaseUnlockReceiptId: args.stuckLeaseUnlockReceiptId ?? null,
      workerLagSloPolicyId: args.workerLagSloPolicyId ?? null,
      maxWorkerLagSeconds: args.maxWorkerLagSeconds ?? null,
      recoveryAuditTimelineHash: args.recoveryAuditTimelineHash ?? null,
      payloadHashBound: args.payloadHashBound ?? previousGate.outboxEnvelope.payloadHashBound,
      sourceReceiptRootBound: args.sourceReceiptRootBound ?? previousGate.outboxEnvelope.sourceReceiptRootBound,
    },
    replayRecoveryPolicy: {
      canReplayDeadLetteredExport: ready,
      canUnlockStuckWorkerLease: ready,
      canCommitReplayPerChannel: ready,
      canClaimProductionReplayConsole: false,
      reason,
    },
    replayRecoveryRiskSignals: {
      previousOutboxNotReady: !previousReady,
      missingDeadLetterRecoveryReceipt: !args.deadLetterRecoveryReceiptId,
      missingPoisonOperatorReview: !args.poisonMessageOperatorReviewReceiptId,
      missingReplayIdempotencyKey: !args.replayFromOutboxIdempotencyKey,
      missingChannelReplayMatrix: !channelReplayMatrixReady,
      missingStuckLeaseUnlockPolicy: !stuckLeaseReady,
      missingWorkerLagSlo: !workerLagSloReady,
      missingRecoveryAuditTimeline: !args.recoveryAuditTimelineHash,
      payloadOrSourceRootDrift,
    },
    customerSafeCopy: ready
      ? "Customer export worker replay recovery contracts are ready for deterministic tests. Production replay still requires deployed workers, live DB migrations and operator-console evidence."
      : "Customer export worker replay recovery is prepared-only until dead-letter, poison-review, replay-idempotency, channel replay, stuck-lease, lag-SLO and timeline receipts are attached.",
    operatorNextActions,
  };
}
