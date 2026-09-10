import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2861CustomerExportSupervisoryRetentionJobExpiryMonitorGate } from "@/lib/market-integrity/top1-customer-export-supervisory-retention-job-expiry-monitor-gate";

export type Pass2862CustomerExportSupervisoryRetentionPurgeTombstoneState =
  | "supervisory_retention_monitor_not_ready"
  | "supervisory_retention_expiry_not_verified"
  | "legal_hold_or_access_extension_active"
  | "supervisory_purge_authorization_missing"
  | "regulator_auditor_access_revocation_missing"
  | "archive_lock_release_receipt_missing"
  | "supervisory_retention_purge_worker_receipt_missing"
  | "supervisory_tombstone_manifest_missing"
  | "post_purge_reconciliation_hash_missing"
  | "retention_purge_attempted_during_legal_hold"
  | "supervisory_retention_purge_tombstone_ready";

export type Pass2862CustomerExportSupervisoryRetentionPurgeChannel = "secure_vault" | "legal" | "regulator" | "auditor" | "operator_console";

export type Pass2862CustomerExportSupervisoryAccessRevocationReceipt = {
  channel: Pass2862CustomerExportSupervisoryRetentionPurgeChannel;
  accessRevocationReceiptId: string;
  accessExpiryReceiptId: string;
  finalCloseCaseId: string;
  evidenceRetentionLockReceiptId: string;
  revokedAt: string;
  revocationEnforced: boolean;
};

export type Pass2862CustomerExportSupervisoryRetentionPurgeTombstoneGate = {
  schemaVersion: "pass2862_customer_export_supervisory_retention_purge_tombstone_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryRetentionPurgeTombstoneState: Pass2862CustomerExportSupervisoryRetentionPurgeTombstoneState;
  supervisoryRetentionPurgeTombstoneReadinessScore: number;
  supervisoryRetentionPurgeTombstoneEnvelope: {
    previousSupervisoryRetentionJobExpiryMonitorState: string;
    previousSupervisoryRetentionJobExpiryMonitorReadinessScore: number;
    previousCanRunSupervisoryRetentionMonitor: boolean;
    previousCanExpireRegulatorAuditorAccess: boolean;
    previousCanTemporarilyUnlockAndRelockEvidenceRetention: boolean;
    previousRetentionJobScheduleId: string | null;
    previousLegalHoldAwareExpiryMonitorId: string | null;
    previousEvidenceRetentionUnlockRelockReceiptId: string | null;
    retentionExpiredAt: string | null;
    retentionExpiryVerifiedReceiptId: string | null;
    legalHoldActive: boolean;
    accessExtensionActive: boolean;
    supervisoryPurgeAuthorizationReceiptId: string | null;
    accessRevocationReceipts: Pass2862CustomerExportSupervisoryAccessRevocationReceipt[];
    archiveLockReleaseReceiptId: string | null;
    supervisoryRetentionPurgeWorkerRunReceiptId: string | null;
    supervisoryTombstoneManifestHash: string | null;
    supervisoryTombstoneVerificationReceiptId: string | null;
    postPurgeReconciliationHash: string | null;
    purgeAttemptedDuringLegalHold: boolean;
  };
  supervisoryRetentionPurgeTombstonePolicy: {
    canExecuteSupervisoryRetentionPurge: boolean;
    canRevokeRegulatorAuditorAccess: boolean;
    canPublishSupervisoryRetentionTombstone: boolean;
    canPurgeDuringLegalHold: false;
    canClaimProductionSupervisoryRetentionPurge: false;
    reason: string;
  };
  supervisoryRetentionPurgeTombstoneRiskSignals: {
    previousSupervisoryRetentionMonitorNotReady: boolean;
    retentionExpiryNotVerified: boolean;
    legalHoldOrAccessExtensionActive: boolean;
    missingSupervisoryPurgeAuthorization: boolean;
    missingRegulatorAuditorAccessRevocation: boolean;
    missingArchiveLockReleaseReceipt: boolean;
    missingSupervisoryRetentionPurgeWorkerReceipt: boolean;
    missingSupervisoryTombstoneManifest: boolean;
    missingPostPurgeReconciliationHash: boolean;
    purgeAttemptedDuringLegalHold: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2862_CUSTOMER_EXPORT_SUPERVISORY_RETENTION_PURGE_TOMBSTONE_ACCEPTANCE_GATES = [
  "PASS2862: Supervisory retention monitoring is not the same as executed supervisory purge/tombstone close.",
  "PASS2862: Supervisory evidence purge requires retention expiry verification, legal-hold/access-extension checks and explicit purge authorization.",
  "PASS2862: Regulator/auditor access revocation must be receipted separately and bound to the evidence-retention lock and final close case.",
  "PASS2862: Archive-lock release, purge worker run, tombstone manifest, tombstone verification and post-purge reconciliation are mandatory before supervisory purge close.",
  "PASS2862: Purge attempted during legal hold freezes all supervisory purge claims. This is a deterministic contract/API boundary; production claims still require durable workers, immutable storage lifecycle receipts, legal workflow, alerting and monitored purge jobs.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2862CustomerExportSupervisoryRetentionPurgeTombstoneGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryRetentionJobExpiryMonitorGate: Pass2861CustomerExportSupervisoryRetentionJobExpiryMonitorGate;
  generatedAt?: string;
  retentionExpiredAt?: string | null;
  retentionExpiryVerifiedReceiptId?: string | null;
  legalHoldActive?: boolean;
  accessExtensionActive?: boolean;
  supervisoryPurgeAuthorizationReceiptId?: string | null;
  accessRevocationReceipts?: Pass2862CustomerExportSupervisoryAccessRevocationReceipt[];
  archiveLockReleaseReceiptId?: string | null;
  supervisoryRetentionPurgeWorkerRunReceiptId?: string | null;
  supervisoryTombstoneManifestHash?: string | null;
  supervisoryTombstoneVerificationReceiptId?: string | null;
  postPurgeReconciliationHash?: string | null;
  purgeAttemptedDuringLegalHold?: boolean;
}): Pass2862CustomerExportSupervisoryRetentionPurgeTombstoneGate {
  const previousGate = args.customerExportSupervisoryRetentionJobExpiryMonitorGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = previousGate.supervisoryRetentionJobExpiryMonitorState === "supervisory_retention_job_expiry_monitor_ready";
  const previousCanMonitor = previousGate.supervisoryRetentionJobExpiryMonitorPolicy.canRunSupervisoryRetentionMonitor;
  const previousCanExpireAccess = previousGate.supervisoryRetentionJobExpiryMonitorPolicy.canExpireRegulatorAuditorAccess;
  const previousCanUnlockRelock = previousGate.supervisoryRetentionJobExpiryMonitorPolicy.canTemporarilyUnlockAndRelockEvidenceRetention;
  const retentionExpiryVerified = Boolean(args.retentionExpiredAt && args.retentionExpiryVerifiedReceiptId);
  const legalHoldActive = Boolean(args.legalHoldActive);
  const accessExtensionActive = Boolean(args.accessExtensionActive);
  const purgeAuthorized = Boolean(args.supervisoryPurgeAuthorizationReceiptId);
  const accessRevocationReceipts = args.accessRevocationReceipts ?? [];
  const revocationReady = accessRevocationReceipts.length > 0 && accessRevocationReceipts.every((receipt) => Boolean(receipt.channel && receipt.accessRevocationReceiptId && receipt.accessExpiryReceiptId && receipt.finalCloseCaseId && receipt.evidenceRetentionLockReceiptId && receipt.revokedAt && receipt.revocationEnforced));
  const archiveLockReleaseReady = Boolean(args.archiveLockReleaseReceiptId);
  const purgeWorkerReady = Boolean(args.supervisoryRetentionPurgeWorkerRunReceiptId);
  const tombstoneReady = Boolean(args.supervisoryTombstoneManifestHash && args.supervisoryTombstoneVerificationReceiptId);
  const postPurgeReconciliationReady = Boolean(args.postPurgeReconciliationHash);
  const purgeAttemptedDuringLegalHold = Boolean(args.purgeAttemptedDuringLegalHold);
  const legalBlockActive = legalHoldActive || accessExtensionActive;

  const ready = Boolean(
    previousReady &&
      previousCanMonitor &&
      previousCanExpireAccess &&
      previousCanUnlockRelock &&
      retentionExpiryVerified &&
      !legalBlockActive &&
      purgeAuthorized &&
      revocationReady &&
      archiveLockReleaseReady &&
      purgeWorkerReady &&
      tombstoneReady &&
      postPurgeReconciliationReady &&
      !purgeAttemptedDuringLegalHold,
  );

  const supervisoryRetentionPurgeTombstoneState: Pass2862CustomerExportSupervisoryRetentionPurgeTombstoneState = !previousReady || !previousCanMonitor
    ? "supervisory_retention_monitor_not_ready"
    : !retentionExpiryVerified
      ? "supervisory_retention_expiry_not_verified"
      : legalBlockActive
        ? "legal_hold_or_access_extension_active"
        : !purgeAuthorized
          ? "supervisory_purge_authorization_missing"
          : !revocationReady || !previousCanExpireAccess
            ? "regulator_auditor_access_revocation_missing"
            : !archiveLockReleaseReady || !previousCanUnlockRelock
              ? "archive_lock_release_receipt_missing"
              : !purgeWorkerReady
                ? "supervisory_retention_purge_worker_receipt_missing"
                : !tombstoneReady
                  ? "supervisory_tombstone_manifest_missing"
                  : !postPurgeReconciliationReady
                    ? "post_purge_reconciliation_hash_missing"
                    : purgeAttemptedDuringLegalHold
                      ? "retention_purge_attempted_during_legal_hold"
                      : "supervisory_retention_purge_tombstone_ready";

  const supervisoryRetentionPurgeTombstoneReadinessScore = clamp(
    previousGate.supervisoryRetentionJobExpiryMonitorReadinessScore +
      (previousReady ? 7 : -50) +
      (previousCanMonitor ? 5 : -18) +
      (previousCanExpireAccess ? 5 : -14) +
      (previousCanUnlockRelock ? 5 : -14) +
      (retentionExpiryVerified ? 10 : -18) +
      (!legalBlockActive ? 10 : -45) +
      (purgeAuthorized ? 9 : -16) +
      (revocationReady ? 9 : -16) +
      (archiveLockReleaseReady ? 8 : -14) +
      (purgeWorkerReady ? 8 : -14) +
      (tombstoneReady ? 9 : -16) +
      (postPurgeReconciliationReady ? 8 : -14) +
      (!purgeAttemptedDuringLegalHold ? 7 : -50),
  );

  const reason = ready
    ? "Supervisory retention purge is ready in this deterministic boundary because retention expiry is verified, legal hold/access-extension checks are clear, access is revoked, archive lock release and purge worker are receipted, and tombstone/reconciliation proof is bound."
    : `Supervisory retention purge/tombstone boundary blocked at ${supervisoryRetentionPurgeTombstoneState}.`;

  return {
    schemaVersion: "pass2862_customer_export_supervisory_retention_purge_tombstone_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryRetentionPurgeTombstoneState,
    supervisoryRetentionPurgeTombstoneReadinessScore,
    supervisoryRetentionPurgeTombstoneEnvelope: {
      previousSupervisoryRetentionJobExpiryMonitorState: previousGate.supervisoryRetentionJobExpiryMonitorState,
      previousSupervisoryRetentionJobExpiryMonitorReadinessScore: previousGate.supervisoryRetentionJobExpiryMonitorReadinessScore,
      previousCanRunSupervisoryRetentionMonitor: previousCanMonitor,
      previousCanExpireRegulatorAuditorAccess: previousCanExpireAccess,
      previousCanTemporarilyUnlockAndRelockEvidenceRetention: previousCanUnlockRelock,
      previousRetentionJobScheduleId: previousGate.supervisoryRetentionJobExpiryMonitorEnvelope.retentionJobScheduleId,
      previousLegalHoldAwareExpiryMonitorId: previousGate.supervisoryRetentionJobExpiryMonitorEnvelope.legalHoldAwareExpiryMonitorId,
      previousEvidenceRetentionUnlockRelockReceiptId: previousGate.supervisoryRetentionJobExpiryMonitorEnvelope.evidenceRetentionUnlockRelockReceiptId,
      retentionExpiredAt: args.retentionExpiredAt ?? null,
      retentionExpiryVerifiedReceiptId: args.retentionExpiryVerifiedReceiptId ?? null,
      legalHoldActive,
      accessExtensionActive,
      supervisoryPurgeAuthorizationReceiptId: args.supervisoryPurgeAuthorizationReceiptId ?? null,
      accessRevocationReceipts,
      archiveLockReleaseReceiptId: args.archiveLockReleaseReceiptId ?? null,
      supervisoryRetentionPurgeWorkerRunReceiptId: args.supervisoryRetentionPurgeWorkerRunReceiptId ?? null,
      supervisoryTombstoneManifestHash: args.supervisoryTombstoneManifestHash ?? null,
      supervisoryTombstoneVerificationReceiptId: args.supervisoryTombstoneVerificationReceiptId ?? null,
      postPurgeReconciliationHash: args.postPurgeReconciliationHash ?? null,
      purgeAttemptedDuringLegalHold,
    },
    supervisoryRetentionPurgeTombstonePolicy: {
      canExecuteSupervisoryRetentionPurge: ready,
      canRevokeRegulatorAuditorAccess: ready,
      canPublishSupervisoryRetentionTombstone: ready,
      canPurgeDuringLegalHold: false,
      canClaimProductionSupervisoryRetentionPurge: false,
      reason,
    },
    supervisoryRetentionPurgeTombstoneRiskSignals: {
      previousSupervisoryRetentionMonitorNotReady: !previousReady || !previousCanMonitor,
      retentionExpiryNotVerified: !retentionExpiryVerified,
      legalHoldOrAccessExtensionActive: legalBlockActive,
      missingSupervisoryPurgeAuthorization: !purgeAuthorized,
      missingRegulatorAuditorAccessRevocation: !revocationReady || !previousCanExpireAccess,
      missingArchiveLockReleaseReceipt: !archiveLockReleaseReady || !previousCanUnlockRelock,
      missingSupervisoryRetentionPurgeWorkerReceipt: !purgeWorkerReady,
      missingSupervisoryTombstoneManifest: !tombstoneReady,
      missingPostPurgeReconciliationHash: !postPurgeReconciliationReady,
      purgeAttemptedDuringLegalHold,
    },
    customerSafeCopy: ready
      ? "Supervisory evidence retention purge is expiry-verified, legal-hold safe, access-revoked, tombstoned and post-purge reconciled before any purge-complete claim."
      : "Supervisory evidence retention purge is blocked until expiry verification, legal-hold/access-extension clearance, purge authorization, access revocation, archive-lock release, purge worker receipt, tombstone proof and reconciliation hash exist.",
    operatorNextActions: ready
      ? [
          "Persist real purge-worker lifecycle receipts before claiming production supervisory retention purge.",
          "Keep supervisory tombstones immutable and separate from customer export deletion tombstones.",
          "Alert on any legal hold, access extension or post-purge residual drift before closure.",
        ]
      : [
          "Verify retention expiry and legal-hold/access-extension status before purge authorization.",
          "Attach regulator/auditor access revocation receipts and archive-lock release receipt.",
          "Attach purge worker receipt, tombstone manifest/verification and post-purge reconciliation hash.",
        ],
  };
}
