import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2845CustomerExportRuntimeAdapterStubGate } from "@/lib/market-integrity/top1-customer-export-runtime-adapter-stub-gate";

export type Pass2846CustomerExportTransactionalOutboxHealthState =
  | "runtime_adapter_blocked"
  | "outbox_table_missing"
  | "pending_queue_missing"
  | "lease_lock_missing"
  | "dead_letter_queue_missing"
  | "worker_heartbeat_missing"
  | "health_probe_missing"
  | "channel_commit_missing"
  | "poison_message_policy_missing"
  | "payload_drift_blocked"
  | "transactional_outbox_ready";

export type Pass2846CustomerExportOutboxChannel = "account_vault" | "email" | "api" | "support";

export type Pass2846CustomerExportOutboxDeliveryStatus =
  | "pending"
  | "leased"
  | "committed"
  | "retry_scheduled"
  | "dead_lettered"
  | "poison_blocked";

export type Pass2846CustomerExportTransactionalOutboxEvent = {
  outboxEventId: string;
  packetId: string;
  channel: Pass2846CustomerExportOutboxChannel;
  status: Pass2846CustomerExportOutboxDeliveryStatus;
  idempotencyKey: string;
  payloadHash: string;
  sourceReceiptRoot: string;
  leaseId?: string | null;
  attemptCount: number;
  createdAt: string;
  availableAt: string;
  committedAt?: string | null;
};

export type Pass2846CustomerExportTransactionalOutboxHealthGate = {
  schemaVersion: "pass2846_customer_export_transactional_outbox_health_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  transactionalOutboxState: Pass2846CustomerExportTransactionalOutboxHealthState;
  transactionalOutboxReadinessScore: number;
  outboxEnvelope: {
    outboxTableId: string | null;
    pendingQueueId: string | null;
    workerLeaseLockId: string | null;
    deadLetterQueueId: string | null;
    workerHeartbeatReceiptId: string | null;
    healthProbeReceiptId: string | null;
    poisonMessagePolicyId: string | null;
    previousRuntimeAdapterState: string;
    previousRuntimeAdapterReadinessScore: number;
    accountVaultCommitReceiptId: string | null;
    emailCommitReceiptId: string | null;
    apiCommitReceiptId: string | null;
    supportCommitReceiptId: string | null;
    retryBackoffPolicyId: string | null;
    maxAttemptPolicyId: string | null;
    payloadHashBound: string | null;
    sourceReceiptRootBound: string | null;
  };
  outboxPolicy: {
    canEnqueueCustomerExportDelivery: boolean;
    canLeaseOutboxJobs: boolean;
    canCommitChannelDelivery: boolean;
    canRecoverDeadLetters: boolean;
    canClaimProductionOutboxWorker: false;
    reason: string;
  };
  outboxRiskSignals: {
    previousRuntimeAdapterNotReady: boolean;
    missingOutboxTable: boolean;
    missingPendingQueue: boolean;
    missingLeaseLock: boolean;
    missingDeadLetterQueue: boolean;
    missingWorkerHeartbeat: boolean;
    missingHealthProbe: boolean;
    missingChannelCommitReceipts: boolean;
    missingPoisonMessagePolicy: boolean;
    payloadOrSourceRootDrift: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2846_CUSTOMER_EXPORT_TRANSACTIONAL_OUTBOX_HEALTH_ACCEPTANCE_GATES = [
  "PASS2846: Runtime adapter contracts are not enough; customer export delivery requires a transactional outbox with pending queue, lease lock, dead-letter queue, heartbeat and health probe receipts.",
  "PASS2846: Account vault, email, API and support delivery commits must each carry a channel commit receipt bound to payloadHash/sourceReceiptRoot and idempotency key.",
  "PASS2846: Worker retries must use retry backoff and max-attempt policy before any resend/download/API/support handoff is claimed durable.",
  "PASS2846: Poison messages and dead letters must freeze customer-visible delivery until an operator replay/recovery receipt is appended.",
  "PASS2846: Transactional outbox readiness does not claim live worker execution; it proves queue/lease/commit/health/dead-letter contracts until production workers and integration evidence are attached.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2846CustomerExportTransactionalOutboxHealthGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportRuntimeAdapterStubGate: Pass2845CustomerExportRuntimeAdapterStubGate;
  generatedAt?: string;
  outboxTableId?: string | null;
  pendingQueueId?: string | null;
  workerLeaseLockId?: string | null;
  deadLetterQueueId?: string | null;
  workerHeartbeatReceiptId?: string | null;
  healthProbeReceiptId?: string | null;
  poisonMessagePolicyId?: string | null;
  accountVaultCommitReceiptId?: string | null;
  emailCommitReceiptId?: string | null;
  apiCommitReceiptId?: string | null;
  supportCommitReceiptId?: string | null;
  retryBackoffPolicyId?: string | null;
  maxAttemptPolicyId?: string | null;
  payloadHashBound?: string | null;
  sourceReceiptRootBound?: string | null;
  payloadOrSourceRootDrift?: boolean;
}): Pass2846CustomerExportTransactionalOutboxHealthGate {
  const previousGate = args.customerExportRuntimeAdapterStubGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(
    previousGate.runtimePolicy.canPersistCustomerExportEvents && previousGate.runtimeAdapterState === "runtime_adapter_ready",
  );
  const channelCommitReady = Boolean(
    args.accountVaultCommitReceiptId && args.emailCommitReceiptId && args.apiCommitReceiptId && args.supportCommitReceiptId,
  );
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift);

  const ready = Boolean(
    previousReady &&
      args.outboxTableId &&
      args.pendingQueueId &&
      args.workerLeaseLockId &&
      args.deadLetterQueueId &&
      args.workerHeartbeatReceiptId &&
      args.healthProbeReceiptId &&
      args.poisonMessagePolicyId &&
      channelCommitReady &&
      args.retryBackoffPolicyId &&
      args.maxAttemptPolicyId &&
      !payloadOrSourceRootDrift,
  );

  const transactionalOutboxState: Pass2846CustomerExportTransactionalOutboxHealthState = !previousReady
    ? "runtime_adapter_blocked"
    : payloadOrSourceRootDrift
      ? "payload_drift_blocked"
      : !args.outboxTableId
        ? "outbox_table_missing"
        : !args.pendingQueueId
          ? "pending_queue_missing"
          : !args.workerLeaseLockId
            ? "lease_lock_missing"
            : !args.deadLetterQueueId
              ? "dead_letter_queue_missing"
              : !args.workerHeartbeatReceiptId
                ? "worker_heartbeat_missing"
                : !args.healthProbeReceiptId
                  ? "health_probe_missing"
                  : !channelCommitReady
                    ? "channel_commit_missing"
                    : !args.poisonMessagePolicyId
                      ? "poison_message_policy_missing"
                      : "transactional_outbox_ready";

  const transactionalOutboxReadinessScore = clamp(
    previousGate.runtimeAdapterReadinessScore +
      (previousReady ? 7 : -30) +
      (args.outboxTableId ? 9 : -12) +
      (args.pendingQueueId ? 8 : -10) +
      (args.workerLeaseLockId ? 8 : -10) +
      (args.deadLetterQueueId ? 7 : -10) +
      (args.workerHeartbeatReceiptId ? 7 : -9) +
      (args.healthProbeReceiptId ? 7 : -9) +
      (channelCommitReady ? 12 : -14) +
      (args.poisonMessagePolicyId ? 7 : -8) +
      (args.retryBackoffPolicyId ? 5 : -6) +
      (args.maxAttemptPolicyId ? 5 : -6) -
      (payloadOrSourceRootDrift ? 50 : 0),
  );

  const reason = ready
    ? "Customer export transactional outbox contracts are ready: table, pending queue, worker lease, dead-letter queue, health probes, channel commit receipts, retry policy and poison-message freeze are payload-bound."
    : "Customer export transactional outbox remains prepared-only until queue, lease, dead-letter, health, commit receipt and retry/poison-message contracts are present and payload-bound.";

  const operatorNextActions = [
    !previousReady ? "Finish PASS2845 runtime adapter contracts before enqueueing customer export outbox jobs." : null,
    !args.outboxTableId ? "Create durable customer export transactional outbox table contract." : null,
    !args.pendingQueueId ? "Attach pending queue marker for account/email/API/support delivery jobs." : null,
    !args.workerLeaseLockId ? "Add worker lease lock contract to prevent duplicate delivery workers." : null,
    !args.deadLetterQueueId ? "Attach dead-letter queue for failed/poisoned customer export jobs." : null,
    !args.workerHeartbeatReceiptId ? "Add worker heartbeat receipt for runtime health visibility." : null,
    !args.healthProbeReceiptId ? "Add outbox health probe receipt before customer-safe delivery claim." : null,
    !channelCommitReady ? "Attach account-vault/email/API/support channel commit receipts." : null,
    !args.poisonMessagePolicyId ? "Define poison-message policy that freezes customer-visible delivery on unrecoverable jobs." : null,
    !args.retryBackoffPolicyId ? "Define retry backoff policy for transient export failures." : null,
    !args.maxAttemptPolicyId ? "Define max-attempt policy before moving jobs to dead-letter queue." : null,
    payloadOrSourceRootDrift ? "Freeze outbox drain until payloadHash/sourceReceiptRoot drift is replayed and resealed." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2846_customer_export_transactional_outbox_health_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    transactionalOutboxState,
    transactionalOutboxReadinessScore,
    outboxEnvelope: {
      outboxTableId: args.outboxTableId ?? null,
      pendingQueueId: args.pendingQueueId ?? null,
      workerLeaseLockId: args.workerLeaseLockId ?? null,
      deadLetterQueueId: args.deadLetterQueueId ?? null,
      workerHeartbeatReceiptId: args.workerHeartbeatReceiptId ?? null,
      healthProbeReceiptId: args.healthProbeReceiptId ?? null,
      poisonMessagePolicyId: args.poisonMessagePolicyId ?? null,
      previousRuntimeAdapterState: previousGate.runtimeAdapterState,
      previousRuntimeAdapterReadinessScore: previousGate.runtimeAdapterReadinessScore,
      accountVaultCommitReceiptId: args.accountVaultCommitReceiptId ?? null,
      emailCommitReceiptId: args.emailCommitReceiptId ?? null,
      apiCommitReceiptId: args.apiCommitReceiptId ?? null,
      supportCommitReceiptId: args.supportCommitReceiptId ?? null,
      retryBackoffPolicyId: args.retryBackoffPolicyId ?? null,
      maxAttemptPolicyId: args.maxAttemptPolicyId ?? null,
      payloadHashBound: args.payloadHashBound ?? previousGate.adapterEnvelope.payloadHashBound,
      sourceReceiptRootBound: args.sourceReceiptRootBound ?? previousGate.adapterEnvelope.sourceReceiptRootBound,
    },
    outboxPolicy: {
      canEnqueueCustomerExportDelivery: ready,
      canLeaseOutboxJobs: ready,
      canCommitChannelDelivery: ready,
      canRecoverDeadLetters: ready,
      canClaimProductionOutboxWorker: false,
      reason,
    },
    outboxRiskSignals: {
      previousRuntimeAdapterNotReady: !previousReady,
      missingOutboxTable: !args.outboxTableId,
      missingPendingQueue: !args.pendingQueueId,
      missingLeaseLock: !args.workerLeaseLockId,
      missingDeadLetterQueue: !args.deadLetterQueueId,
      missingWorkerHeartbeat: !args.workerHeartbeatReceiptId,
      missingHealthProbe: !args.healthProbeReceiptId,
      missingChannelCommitReceipts: !channelCommitReady,
      missingPoisonMessagePolicy: !args.poisonMessagePolicyId,
      payloadOrSourceRootDrift,
    },
    customerSafeCopy: ready
      ? "Customer export transactional outbox contracts are ready for deterministic tests. Production delivery still requires real worker deployment, database migration and channel integration evidence."
      : "Customer export transactional outbox is prepared-only until queue, lease, health, dead-letter, commit-receipt and retry contracts are attached.",
    operatorNextActions,
  };
}
