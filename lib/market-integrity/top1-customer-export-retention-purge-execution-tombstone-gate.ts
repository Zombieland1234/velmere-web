import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2851CustomerExportArchiveRetentionLegalHoldGate } from "@/lib/market-integrity/top1-customer-export-archive-retention-legal-hold-gate";

export type Pass2852CustomerExportRetentionPurgeExecutionTombstoneState =
  | "retention_legal_hold_not_ready"
  | "purge_worker_run_missing"
  | "legal_hold_release_receipt_missing"
  | "storage_lifecycle_execution_missing"
  | "channel_purge_execution_missing"
  | "tombstone_manifest_missing"
  | "tombstone_verification_missing"
  | "customer_index_purge_marker_missing"
  | "immutable_audit_receipt_missing"
  | "post_purge_reconciliation_missing"
  | "post_purge_drift_blocked"
  | "operator_purge_signoff_missing"
  | "purge_completion_timestamp_missing"
  | "retention_purge_execution_tombstone_ready";

export type Pass2852CustomerExportPurgeChannel = "account_vault" | "email" | "api" | "support";

export type Pass2852CustomerExportChannelPurgeExecutionReceipt = {
  channel: Pass2852CustomerExportPurgeChannel;
  purgeJobId: string | null;
  storageDeleteReceiptId: string | null;
  tombstoneVerifyReceiptId: string | null;
  customerAccessRevokedAt: string | null;
};

export type Pass2852CustomerExportRetentionPurgeExecutionTombstoneGate = {
  schemaVersion: "pass2852_customer_export_retention_purge_execution_tombstone_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  purgeExecutionTombstoneState: Pass2852CustomerExportRetentionPurgeExecutionTombstoneState;
  purgeExecutionTombstoneReadinessScore: number;
  purgeEnvelope: {
    previousRetentionState: string;
    previousRetentionReadinessScore: number;
    previousCanDeleteOrPurgeCustomerExportArchive: boolean;
    archiveBundleId: string | null;
    archiveTombstoneId: string | null;
    retentionPolicyId: string | null;
    scheduledPurgeAt: string | null;
    purgeWorkerRunId: string | null;
    legalHoldReleaseReceiptId: string | null;
    storageLifecycleExecutionReceiptId: string | null;
    tombstoneManifestHash: string | null;
    verifiedArchiveTombstoneId: string | null;
    customerIndexPurgeMarkerId: string | null;
    immutablePurgeAuditReceiptId: string | null;
    postPurgeReconciliationReceiptId: string | null;
    operatorPurgeSignoffReceiptId: string | null;
    purgeCompletedAt: string | null;
    postPurgeDriftDetected: boolean;
    channelPurgeExecutionReceipts: Pass2852CustomerExportChannelPurgeExecutionReceipt[];
  };
  purgePolicy: {
    canExecuteCustomerExportArchivePurge: boolean;
    canMarkArchiveAsTombstoned: boolean;
    canServeCustomerArchiveAfterPurge: boolean;
    canClaimProductionPurgeWorkflow: false;
    reason: string;
  };
  purgeRiskSignals: {
    retentionLegalHoldNotReady: boolean;
    missingPurgeWorkerRun: boolean;
    missingLegalHoldReleaseReceipt: boolean;
    missingStorageLifecycleExecution: boolean;
    missingChannelPurgeExecution: boolean;
    missingTombstoneManifest: boolean;
    missingTombstoneVerification: boolean;
    missingCustomerIndexPurgeMarker: boolean;
    missingImmutableAuditReceipt: boolean;
    missingPostPurgeReconciliation: boolean;
    postPurgeDriftDetected: boolean;
    missingOperatorPurgeSignoff: boolean;
    missingPurgeCompletionTimestamp: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2852_CUSTOMER_EXPORT_RETENTION_PURGE_EXECUTION_TOMBSTONE_ACCEPTANCE_GATES = [
  "PASS2852: Retention/legal-hold approval is not the same as executed purge; deletion requires a separate worker execution and tombstone verification proof state.",
  "PASS2852: Customer export archives cannot be purged until legal-hold release, storage lifecycle execution, per-channel delete receipts and customer index purge markers are recorded.",
  "PASS2852: Tombstones require manifest hash, verified archive tombstone ID, immutable purge audit receipt and post-purge reconciliation before archive access is considered closed.",
  "PASS2852: Account vault, email, API and support purge executions each need purge job ID, storage delete receipt, tombstone verification receipt and access-revoked timestamp.",
  "PASS2852: This is a deterministic contract only; production purge claims still require live DB rows, storage lifecycle rules, worker evidence, operator UI, legal-hold release logs and customer notice evidence.",
] as const;

const REQUIRED_CHANNELS: Pass2852CustomerExportPurgeChannel[] = ["account_vault", "email", "api", "support"];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeChannelPurgeExecutionReceipts(receipts?: Pass2852CustomerExportChannelPurgeExecutionReceipt[] | null) {
  return REQUIRED_CHANNELS.map((channel) => {
    const found = receipts?.find((receipt) => receipt.channel === channel);
    return {
      channel,
      purgeJobId: found?.purgeJobId ?? null,
      storageDeleteReceiptId: found?.storageDeleteReceiptId ?? null,
      tombstoneVerifyReceiptId: found?.tombstoneVerifyReceiptId ?? null,
      customerAccessRevokedAt: found?.customerAccessRevokedAt ?? null,
    } satisfies Pass2852CustomerExportChannelPurgeExecutionReceipt;
  });
}

export function buildPass2852CustomerExportRetentionPurgeExecutionTombstoneGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportArchiveRetentionLegalHoldGate: Pass2851CustomerExportArchiveRetentionLegalHoldGate;
  generatedAt?: string;
  purgeWorkerRunId?: string | null;
  legalHoldReleaseReceiptId?: string | null;
  storageLifecycleExecutionReceiptId?: string | null;
  tombstoneManifestHash?: string | null;
  verifiedArchiveTombstoneId?: string | null;
  customerIndexPurgeMarkerId?: string | null;
  immutablePurgeAuditReceiptId?: string | null;
  postPurgeReconciliationReceiptId?: string | null;
  operatorPurgeSignoffReceiptId?: string | null;
  purgeCompletedAt?: string | null;
  postPurgeDriftDetected?: boolean;
  channelPurgeExecutionReceipts?: Pass2852CustomerExportChannelPurgeExecutionReceipt[] | null;
}): Pass2852CustomerExportRetentionPurgeExecutionTombstoneGate {
  const previousGate = args.customerExportArchiveRetentionLegalHoldGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(
    previousGate.archiveRetentionLegalHoldState === "archive_retention_legal_hold_ready" &&
      previousGate.retentionPolicy.canDeleteOrPurgeCustomerExportArchive,
  );
  const postPurgeDriftDetected = Boolean(args.postPurgeDriftDetected);
  const channelPurgeExecutionReceipts = normalizeChannelPurgeExecutionReceipts(args.channelPurgeExecutionReceipts);
  const channelPurgeExecutionReady = channelPurgeExecutionReceipts.every((receipt) =>
    Boolean(receipt.purgeJobId && receipt.storageDeleteReceiptId && receipt.tombstoneVerifyReceiptId && receipt.customerAccessRevokedAt),
  );

  const ready = Boolean(
    previousReady &&
      args.purgeWorkerRunId &&
      args.legalHoldReleaseReceiptId &&
      args.storageLifecycleExecutionReceiptId &&
      channelPurgeExecutionReady &&
      args.tombstoneManifestHash &&
      args.verifiedArchiveTombstoneId &&
      args.customerIndexPurgeMarkerId &&
      args.immutablePurgeAuditReceiptId &&
      args.postPurgeReconciliationReceiptId &&
      !postPurgeDriftDetected &&
      args.operatorPurgeSignoffReceiptId &&
      args.purgeCompletedAt,
  );

  const purgeExecutionTombstoneState: Pass2852CustomerExportRetentionPurgeExecutionTombstoneState = !previousReady
    ? "retention_legal_hold_not_ready"
    : !args.purgeWorkerRunId
      ? "purge_worker_run_missing"
      : !args.legalHoldReleaseReceiptId
        ? "legal_hold_release_receipt_missing"
        : !args.storageLifecycleExecutionReceiptId
          ? "storage_lifecycle_execution_missing"
          : !channelPurgeExecutionReady
            ? "channel_purge_execution_missing"
            : !args.tombstoneManifestHash
              ? "tombstone_manifest_missing"
              : !args.verifiedArchiveTombstoneId
                ? "tombstone_verification_missing"
                : !args.customerIndexPurgeMarkerId
                  ? "customer_index_purge_marker_missing"
                  : !args.immutablePurgeAuditReceiptId
                    ? "immutable_audit_receipt_missing"
                    : !args.postPurgeReconciliationReceiptId
                      ? "post_purge_reconciliation_missing"
                      : postPurgeDriftDetected
                        ? "post_purge_drift_blocked"
                        : !args.operatorPurgeSignoffReceiptId
                          ? "operator_purge_signoff_missing"
                          : !args.purgeCompletedAt
                            ? "purge_completion_timestamp_missing"
                            : "retention_purge_execution_tombstone_ready";

  const purgeExecutionTombstoneReadinessScore = clamp(
    previousGate.archiveRetentionLegalHoldReadinessScore +
      (previousReady ? 8 : -40) +
      (args.purgeWorkerRunId ? 8 : -12) +
      (args.legalHoldReleaseReceiptId ? 8 : -14) +
      (args.storageLifecycleExecutionReceiptId ? 9 : -14) +
      (channelPurgeExecutionReady ? 13 : -18) +
      (args.tombstoneManifestHash ? 8 : -12) +
      (args.verifiedArchiveTombstoneId ? 10 : -14) +
      (args.customerIndexPurgeMarkerId ? 8 : -12) +
      (args.immutablePurgeAuditReceiptId ? 9 : -14) +
      (args.postPurgeReconciliationReceiptId ? 9 : -14) -
      (postPurgeDriftDetected ? 44 : 0) +
      (args.operatorPurgeSignoffReceiptId ? 8 : -12) +
      (args.purgeCompletedAt ? 6 : -10),
  );

  const reason = ready
    ? "Customer export archive purge execution/tombstone gate is ready: retention/legal-hold clearance, purge worker run, storage lifecycle execution, per-channel delete receipts, tombstone verification, customer index marker, post-purge reconciliation and operator QA approval are bound."
    : "Customer export archive purge execution/tombstone gate remains prepared-only until retention/legal-hold readiness, legal-hold release, purge worker execution, per-channel delete receipts, tombstone verification, customer index purge marker, immutable audit receipt, reconciliation and operator QA approval clear.";

  const operatorNextActions = [
    !previousReady ? "Complete PASS2851 retention/legal-hold deletion eligibility before executing purge." : null,
    !args.purgeWorkerRunId ? "Run or attach the purge worker execution ID." : null,
    !args.legalHoldReleaseReceiptId ? "Attach legal-hold release/clearance receipt before deletion proceeds." : null,
    !args.storageLifecycleExecutionReceiptId ? "Record storage lifecycle execution receipt for archive object deletion." : null,
    !channelPurgeExecutionReady ? "Write purge execution receipts for account vault, email, API and support channels." : null,
    !args.tombstoneManifestHash ? "Hash the tombstone manifest that replaces deleted archive references." : null,
    !args.verifiedArchiveTombstoneId ? "Verify archive tombstone ID after purge worker completion." : null,
    !args.customerIndexPurgeMarkerId ? "Mark the customer access index as purged/tombstoned." : null,
    !args.immutablePurgeAuditReceiptId ? "Persist immutable purge audit receipt." : null,
    !args.postPurgeReconciliationReceiptId ? "Run post-purge reconciliation across ledger, storage, outbox and customer index." : null,
    postPurgeDriftDetected ? "Keep purge close blocked until post-purge drift is remediated and replayed." : null,
    !args.operatorPurgeSignoffReceiptId ? "Collect operator purge signoff receipt." : null,
    !args.purgeCompletedAt ? "Record purge completion timestamp." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2852_customer_export_retention_purge_execution_tombstone_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    purgeExecutionTombstoneState,
    purgeExecutionTombstoneReadinessScore,
    purgeEnvelope: {
      previousRetentionState: previousGate.archiveRetentionLegalHoldState,
      previousRetentionReadinessScore: previousGate.archiveRetentionLegalHoldReadinessScore,
      previousCanDeleteOrPurgeCustomerExportArchive: previousGate.retentionPolicy.canDeleteOrPurgeCustomerExportArchive,
      archiveBundleId: previousGate.retentionEnvelope.archiveBundleId,
      archiveTombstoneId: previousGate.retentionEnvelope.archiveTombstoneId,
      retentionPolicyId: previousGate.retentionEnvelope.retentionPolicyId,
      scheduledPurgeAt: previousGate.retentionEnvelope.scheduledPurgeAt,
      purgeWorkerRunId: args.purgeWorkerRunId ?? null,
      legalHoldReleaseReceiptId: args.legalHoldReleaseReceiptId ?? null,
      storageLifecycleExecutionReceiptId: args.storageLifecycleExecutionReceiptId ?? null,
      tombstoneManifestHash: args.tombstoneManifestHash ?? null,
      verifiedArchiveTombstoneId: args.verifiedArchiveTombstoneId ?? null,
      customerIndexPurgeMarkerId: args.customerIndexPurgeMarkerId ?? null,
      immutablePurgeAuditReceiptId: args.immutablePurgeAuditReceiptId ?? null,
      postPurgeReconciliationReceiptId: args.postPurgeReconciliationReceiptId ?? null,
      operatorPurgeSignoffReceiptId: args.operatorPurgeSignoffReceiptId ?? null,
      purgeCompletedAt: args.purgeCompletedAt ?? null,
      postPurgeDriftDetected,
      channelPurgeExecutionReceipts,
    },
    purgePolicy: {
      canExecuteCustomerExportArchivePurge: previousReady && Boolean(args.purgeWorkerRunId && args.legalHoldReleaseReceiptId && args.storageLifecycleExecutionReceiptId),
      canMarkArchiveAsTombstoned: ready,
      canServeCustomerArchiveAfterPurge: false,
      canClaimProductionPurgeWorkflow: false,
      reason,
    },
    purgeRiskSignals: {
      retentionLegalHoldNotReady: !previousReady,
      missingPurgeWorkerRun: !args.purgeWorkerRunId,
      missingLegalHoldReleaseReceipt: !args.legalHoldReleaseReceiptId,
      missingStorageLifecycleExecution: !args.storageLifecycleExecutionReceiptId,
      missingChannelPurgeExecution: !channelPurgeExecutionReady,
      missingTombstoneManifest: !args.tombstoneManifestHash,
      missingTombstoneVerification: !args.verifiedArchiveTombstoneId,
      missingCustomerIndexPurgeMarker: !args.customerIndexPurgeMarkerId,
      missingImmutableAuditReceipt: !args.immutablePurgeAuditReceiptId,
      missingPostPurgeReconciliation: !args.postPurgeReconciliationReceiptId,
      postPurgeDriftDetected,
      missingOperatorPurgeSignoff: !args.operatorPurgeSignoffReceiptId,
      missingPurgeCompletionTimestamp: !args.purgeCompletedAt,
    },
    customerSafeCopy: ready
      ? "Your export archive purge has a tombstone verification trail. Storage deletion, channel purge receipts, customer index marker, reconciliation and operator QA approval are recorded before archive access is closed."
      : "Your export archive cannot be marked purged or tombstoned until legal-hold release, storage deletion, channel purge execution, tombstone verification, reconciliation and operator QA approval are recorded.",
    operatorNextActions,
  };
}
