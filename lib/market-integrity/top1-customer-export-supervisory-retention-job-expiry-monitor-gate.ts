import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2860CustomerExportSupervisoryDisclosureFinalCloseGate } from "@/lib/market-integrity/top1-customer-export-supervisory-disclosure-final-close-gate";

export type Pass2861CustomerExportSupervisoryRetentionJobExpiryMonitorState =
  | "supervisory_final_close_not_ready"
  | "retention_job_schedule_missing"
  | "legal_hold_expiry_monitor_missing"
  | "archive_lock_verification_missing"
  | "overdue_retention_alert_missing"
  | "regulator_auditor_access_expiry_proof_missing"
  | "retention_unlock_relock_receipt_missing"
  | "retention_monitor_timeline_hash_missing"
  | "retention_lock_bypass_attempted"
  | "supervisory_retention_job_expiry_monitor_ready";

export type Pass2861CustomerExportSupervisoryRetentionMonitorChannel = "secure_vault" | "legal" | "regulator" | "auditor" | "operator_console";

export type Pass2861CustomerExportSupervisoryAccessExpiryReceipt = {
  channel: Pass2861CustomerExportSupervisoryRetentionMonitorChannel;
  accessExpiryReceiptId: string;
  finalCloseCaseId: string;
  evidenceRetentionLockReceiptId: string;
  accessExpiresAt: string;
  expiryEnforced: boolean;
};

export type Pass2861CustomerExportSupervisoryRetentionJobExpiryMonitorGate = {
  schemaVersion: "pass2861_customer_export_supervisory_retention_job_expiry_monitor_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryRetentionJobExpiryMonitorState: Pass2861CustomerExportSupervisoryRetentionJobExpiryMonitorState;
  supervisoryRetentionJobExpiryMonitorReadinessScore: number;
  supervisoryRetentionJobExpiryMonitorEnvelope: {
    previousSupervisoryDisclosureFinalCloseState: string;
    previousSupervisoryDisclosureFinalCloseReadinessScore: number;
    previousCanCloseSupervisoryDisclosureCase: boolean;
    previousCanUnlockSupervisoryEvidenceRetentionLock: boolean;
    supervisoryFinalCloseCaseId: string | null;
    evidenceRetentionLockReceiptId: string | null;
    retentionJobScheduleId: string | null;
    legalHoldAwareExpiryMonitorId: string | null;
    finalCloseArchiveLockVerificationReceiptId: string | null;
    overdueRetentionAlertReceiptId: string | null;
    regulatorAuditorAccessExpiryProofId: string | null;
    evidenceRetentionUnlockRelockReceiptId: string | null;
    accessExpiryReceipts: Pass2861CustomerExportSupervisoryAccessExpiryReceipt[];
    retentionMonitorTimelineHash: string | null;
    retentionLockManuallyBypassed: boolean;
  };
  supervisoryRetentionJobExpiryMonitorPolicy: {
    canRunSupervisoryRetentionMonitor: boolean;
    canExpireRegulatorAuditorAccess: boolean;
    canTemporarilyUnlockAndRelockEvidenceRetention: boolean;
    canBypassRetentionLock: false;
    canClaimProductionSupervisoryRetentionJob: false;
    reason: string;
  };
  supervisoryRetentionJobExpiryMonitorRiskSignals: {
    previousSupervisoryFinalCloseNotReady: boolean;
    missingRetentionJobSchedule: boolean;
    missingLegalHoldAwareExpiryMonitor: boolean;
    missingArchiveLockVerification: boolean;
    missingOverdueRetentionAlert: boolean;
    missingRegulatorAuditorAccessExpiryProof: boolean;
    missingRetentionUnlockRelockReceipt: boolean;
    missingRetentionMonitorTimelineHash: boolean;
    retentionLockManuallyBypassed: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2861_CUSTOMER_EXPORT_SUPERVISORY_RETENTION_JOB_EXPIRY_MONITOR_ACCEPTANCE_GATES = [
  "PASS2861: Supervisory final close and evidence-retention lock are not the same as a monitored retention job.",
  "PASS2861: Retention monitoring requires a scheduled job, legal-hold-aware expiry monitor, final-close archive lock verification and overdue retention alert receipt.",
  "PASS2861: Regulator/auditor access expiry must be proven separately from customer access and must bind to the evidence-retention lock.",
  "PASS2861: Temporary evidence-retention unlock must carry an unlock/relock receipt; manual lock bypass freezes supervisory export claims.",
  "PASS2861: This remains a deterministic contract/API boundary. Production claims require durable scheduler rows, legal-hold checks, access-expiry storage, alerting, immutable archive locks and monitored retention workers.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2861CustomerExportSupervisoryRetentionJobExpiryMonitorGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryDisclosureFinalCloseGate: Pass2860CustomerExportSupervisoryDisclosureFinalCloseGate;
  generatedAt?: string;
  retentionJobScheduleId?: string | null;
  legalHoldAwareExpiryMonitorId?: string | null;
  finalCloseArchiveLockVerificationReceiptId?: string | null;
  overdueRetentionAlertReceiptId?: string | null;
  regulatorAuditorAccessExpiryProofId?: string | null;
  evidenceRetentionUnlockRelockReceiptId?: string | null;
  accessExpiryReceipts?: Pass2861CustomerExportSupervisoryAccessExpiryReceipt[];
  retentionMonitorTimelineHash?: string | null;
  retentionLockManuallyBypassed?: boolean;
}): Pass2861CustomerExportSupervisoryRetentionJobExpiryMonitorGate {
  const previousGate = args.customerExportSupervisoryDisclosureFinalCloseGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = previousGate.supervisoryDisclosureFinalCloseState === "supervisory_disclosure_final_close_ready";
  const previousCloseAllowed = previousGate.supervisoryDisclosureFinalClosePolicy.canCloseSupervisoryDisclosureCase;
  const previousUnlockAllowed = previousGate.supervisoryDisclosureFinalClosePolicy.canUnlockSupervisoryEvidenceRetentionLock;
  const retentionJobReady = Boolean(args.retentionJobScheduleId);
  const legalHoldMonitorReady = Boolean(args.legalHoldAwareExpiryMonitorId);
  const archiveLockVerificationReady = Boolean(args.finalCloseArchiveLockVerificationReceiptId);
  const overdueAlertReady = Boolean(args.overdueRetentionAlertReceiptId);
  const accessExpiryProofReady = Boolean(args.regulatorAuditorAccessExpiryProofId);
  const unlockRelockReady = Boolean(args.evidenceRetentionUnlockRelockReceiptId);
  const timelineReady = Boolean(args.retentionMonitorTimelineHash);
  const accessExpiryReceipts = args.accessExpiryReceipts ?? [];
  const perChannelAccessExpiryReady = accessExpiryReceipts.length > 0 && accessExpiryReceipts.every((receipt) => Boolean(receipt.channel && receipt.accessExpiryReceiptId && receipt.finalCloseCaseId && receipt.evidenceRetentionLockReceiptId && receipt.accessExpiresAt && receipt.expiryEnforced));
  const retentionLockManuallyBypassed = Boolean(args.retentionLockManuallyBypassed);

  const ready = Boolean(
    previousReady &&
      previousCloseAllowed &&
      retentionJobReady &&
      legalHoldMonitorReady &&
      archiveLockVerificationReady &&
      overdueAlertReady &&
      accessExpiryProofReady &&
      unlockRelockReady &&
      timelineReady &&
      perChannelAccessExpiryReady &&
      !retentionLockManuallyBypassed,
  );

  const supervisoryRetentionJobExpiryMonitorState: Pass2861CustomerExportSupervisoryRetentionJobExpiryMonitorState = !previousReady || !previousCloseAllowed
    ? "supervisory_final_close_not_ready"
    : !retentionJobReady
      ? "retention_job_schedule_missing"
      : !legalHoldMonitorReady
        ? "legal_hold_expiry_monitor_missing"
        : !archiveLockVerificationReady
          ? "archive_lock_verification_missing"
          : !overdueAlertReady
            ? "overdue_retention_alert_missing"
            : !accessExpiryProofReady || !perChannelAccessExpiryReady
              ? "regulator_auditor_access_expiry_proof_missing"
              : !unlockRelockReady || !previousUnlockAllowed
                ? "retention_unlock_relock_receipt_missing"
                : !timelineReady
                  ? "retention_monitor_timeline_hash_missing"
                  : retentionLockManuallyBypassed
                    ? "retention_lock_bypass_attempted"
                    : "supervisory_retention_job_expiry_monitor_ready";

  const supervisoryRetentionJobExpiryMonitorReadinessScore = clamp(
    previousGate.supervisoryDisclosureFinalCloseReadinessScore +
      (previousReady ? 7 : -50) +
      (previousCloseAllowed ? 6 : -18) +
      (retentionJobReady ? 9 : -16) +
      (legalHoldMonitorReady ? 9 : -16) +
      (archiveLockVerificationReady ? 9 : -16) +
      (overdueAlertReady ? 7 : -12) +
      (accessExpiryProofReady ? 8 : -14) +
      (perChannelAccessExpiryReady ? 8 : -14) +
      (unlockRelockReady && previousUnlockAllowed ? 8 : -16) +
      (timelineReady ? 8 : -14) +
      (!retentionLockManuallyBypassed ? 9 : -45),
  );

  const reason = ready
    ? "Supervisory retention monitoring is ready in this deterministic boundary because final close is retention-locked, monitored by a legal-hold-aware job, access expiry is receipted and any unlock requires relock proof."
    : `Supervisory retention job / expiry monitor boundary blocked at ${supervisoryRetentionJobExpiryMonitorState}.`;

  return {
    schemaVersion: "pass2861_customer_export_supervisory_retention_job_expiry_monitor_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryRetentionJobExpiryMonitorState,
    supervisoryRetentionJobExpiryMonitorReadinessScore,
    supervisoryRetentionJobExpiryMonitorEnvelope: {
      previousSupervisoryDisclosureFinalCloseState: previousGate.supervisoryDisclosureFinalCloseState,
      previousSupervisoryDisclosureFinalCloseReadinessScore: previousGate.supervisoryDisclosureFinalCloseReadinessScore,
      previousCanCloseSupervisoryDisclosureCase: previousCloseAllowed,
      previousCanUnlockSupervisoryEvidenceRetentionLock: previousUnlockAllowed,
      supervisoryFinalCloseCaseId: previousGate.supervisoryDisclosureFinalCloseEnvelope.supervisoryFinalCloseCaseId,
      evidenceRetentionLockReceiptId: previousGate.supervisoryDisclosureFinalCloseEnvelope.evidenceRetentionLockReceiptId,
      retentionJobScheduleId: args.retentionJobScheduleId ?? null,
      legalHoldAwareExpiryMonitorId: args.legalHoldAwareExpiryMonitorId ?? null,
      finalCloseArchiveLockVerificationReceiptId: args.finalCloseArchiveLockVerificationReceiptId ?? null,
      overdueRetentionAlertReceiptId: args.overdueRetentionAlertReceiptId ?? null,
      regulatorAuditorAccessExpiryProofId: args.regulatorAuditorAccessExpiryProofId ?? null,
      evidenceRetentionUnlockRelockReceiptId: args.evidenceRetentionUnlockRelockReceiptId ?? null,
      accessExpiryReceipts,
      retentionMonitorTimelineHash: args.retentionMonitorTimelineHash ?? null,
      retentionLockManuallyBypassed,
    },
    supervisoryRetentionJobExpiryMonitorPolicy: {
      canRunSupervisoryRetentionMonitor: ready,
      canExpireRegulatorAuditorAccess: ready,
      canTemporarilyUnlockAndRelockEvidenceRetention: ready,
      canBypassRetentionLock: false,
      canClaimProductionSupervisoryRetentionJob: false,
      reason,
    },
    supervisoryRetentionJobExpiryMonitorRiskSignals: {
      previousSupervisoryFinalCloseNotReady: !previousReady || !previousCloseAllowed,
      missingRetentionJobSchedule: !retentionJobReady,
      missingLegalHoldAwareExpiryMonitor: !legalHoldMonitorReady,
      missingArchiveLockVerification: !archiveLockVerificationReady,
      missingOverdueRetentionAlert: !overdueAlertReady,
      missingRegulatorAuditorAccessExpiryProof: !accessExpiryProofReady || !perChannelAccessExpiryReady,
      missingRetentionUnlockRelockReceipt: !unlockRelockReady || !previousUnlockAllowed,
      missingRetentionMonitorTimelineHash: !timelineReady,
      retentionLockManuallyBypassed,
    },
    customerSafeCopy: ready
      ? "Supervisory evidence retention is monitored by a legal-hold-aware job, recipient access can expire safely, and any retention unlock must be re-locked with a receipt."
      : "Supervisory evidence retention monitoring is blocked until the retention job, legal-hold expiry monitor, archive-lock verification, access-expiry proof, unlock/relock receipt and timeline hash exist.",
    operatorNextActions: ready
      ? [
          "Persist scheduler and retention-monitor results before claiming production retention automation.",
          "Keep regulator/auditor access expiry receipts separate from customer export receipts.",
          "Alert on legal hold, overdue retention, manual bypass and relock failures.",
        ]
      : [
          "Create retention job schedule and legal-hold-aware expiry monitor.",
          "Attach final-close archive lock verification and overdue retention alert receipt.",
          "Attach regulator/auditor access-expiry receipts, unlock/relock receipt and immutable retention monitor timeline hash.",
        ],
  };
}
