import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2869CustomerExportSupervisoryTamperIncidentResolutionArchiveResumeGate } from "@/lib/market-integrity/top1-customer-export-supervisory-tamper-incident-resolution-archive-resume-gate";

export type Pass2870CustomerExportSupervisoryTamperResolutionReconciliationClosureAuditState =
  | "previous_tamper_resolution_not_ready"
  | "original_corrected_index_comparison_missing"
  | "archive_resume_refreeze_ledger_missing"
  | "final_notice_reconciliation_missing"
  | "closure_signoff_reconciliation_missing"
  | "post_resolution_residual_drift_scan_missing"
  | "closure_audit_timeline_missing"
  | "supervisory_tamper_resolution_reconciliation_closure_audit_ready";

export type Pass2870CustomerExportSupervisoryPostResolutionDriftSignal = {
  signalId: string;
  signalKind: "payload_hash_drift" | "source_root_drift" | "channel_rebind_drift" | "notice_mismatch" | "signoff_mismatch" | "archive_decision_mismatch";
  detectedAt: string;
  severity: "info" | "medium" | "high" | "critical";
  freezeRequired: boolean;
  remediationTicketId: string | null;
};

export type Pass2870CustomerExportSupervisoryTamperResolutionReconciliationClosureAuditGate = {
  schemaVersion: "pass2870_customer_export_supervisory_tamper_resolution_reconciliation_closure_audit_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryTamperResolutionReconciliationClosureAuditState: Pass2870CustomerExportSupervisoryTamperResolutionReconciliationClosureAuditState;
  supervisoryTamperResolutionReconciliationClosureAuditReadinessScore: number;
  supervisoryTamperResolutionReconciliationClosureAuditEnvelope: {
    previousTamperResolutionState: string;
    previousTamperResolutionReadinessScore: number;
    previousCanResumeSupervisoryArchiveClose: boolean;
    previousResolutionCaseId: string | null;
    previousCorrectedEvidenceIndexId: string | null;
    previousCorrectedEvidenceIndexVersion: string | null;
    previousCorrectedEvidenceIndexHash: string | null;
    previousArchiveResumeDecision: string | null;
    previousArchiveResumeDecisionReceiptId: string | null;
    previousArchiveResumeReceiptId: string | null;
    previousReFreezeReceiptId: string | null;
    previousIncidentClosureTimelineHash: string | null;
    originalFrozenIndexId: string | null;
    originalFrozenIndexVersion: string | null;
    originalFrozenIndexHash: string | null;
    correctedIndexComparisonReceiptId: string | null;
    correctedIndexLedgerBindingHash: string | null;
    archiveResumeRefreezeLedgerReceiptId: string | null;
    finalNoticeReconciliationReceiptId: string | null;
    closureSignoffReconciliationReceiptId: string | null;
    residualHashDriftScanReceiptId: string | null;
    residualChannelDriftScanReceiptId: string | null;
    postResolutionDriftSignals: Pass2870CustomerExportSupervisoryPostResolutionDriftSignal[];
    closureAuditPayloadHash: string | null;
    closureAuditTimelineHash: string | null;
  };
  supervisoryTamperResolutionReconciliationClosureAuditPolicy: {
    canCloseTamperResolution: boolean;
    canKeepSupervisoryArchiveCloseResumed: boolean;
    mustFreezeOnResidualDrift: boolean;
    mustPreserveOriginalFrozenIndexImmutable: true;
    canClaimProductionReconciliationWorker: false;
    reason: string;
  };
  supervisoryTamperResolutionReconciliationClosureAuditRiskSignals: {
    previousResolutionNotReady: boolean;
    comparisonMissing: boolean;
    correctedIndexLedgerBindingMissing: boolean;
    archiveDecisionLedgerMissing: boolean;
    noticeReconciliationMissing: boolean;
    closureSignoffReconciliationMissing: boolean;
    residualHashDriftScanMissing: boolean;
    residualChannelDriftScanMissing: boolean;
    residualDriftDetected: boolean;
    closureAuditPayloadHashMissing: boolean;
    closureAuditTimelineMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2870_CUSTOMER_EXPORT_SUPERVISORY_TAMPER_RESOLUTION_RECONCILIATION_CLOSURE_AUDIT_ACCEPTANCE_GATES = [
  "PASS2870: Tamper resolution/archive resume is not final closure until original frozen index and corrected index are reconciled.",
  "PASS2870: Archive resume/refreeze decisions must be reconciled against the ledger before supervisory archive close remains resumed.",
  "PASS2870: Final customer/regulator/auditor notices and legal/security/privacy signoffs require reconciliation receipts, not only prior delivery claims.",
  "PASS2870: Post-resolution residual hash or channel drift freezes closure and requires a remediation ticket before archive close can continue.",
  "PASS2870: Closure audit requires payload hash and timeline hash while preserving the original frozen evidence index as immutable history.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeDriftSignals(signals?: Pass2870CustomerExportSupervisoryPostResolutionDriftSignal[] | null) {
  return (signals ?? []).map((signal) => ({
    signalId: signal.signalId,
    signalKind: signal.signalKind,
    detectedAt: signal.detectedAt,
    severity: signal.severity,
    freezeRequired: Boolean(signal.freezeRequired),
    remediationTicketId: signal.remediationTicketId ?? null,
  })) satisfies Pass2870CustomerExportSupervisoryPostResolutionDriftSignal[];
}

export function buildPass2870CustomerExportSupervisoryTamperResolutionReconciliationClosureAuditGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryTamperIncidentResolutionArchiveResumeGate: Pass2869CustomerExportSupervisoryTamperIncidentResolutionArchiveResumeGate;
  generatedAt?: string;
  originalFrozenIndexId?: string | null;
  originalFrozenIndexVersion?: string | null;
  originalFrozenIndexHash?: string | null;
  correctedIndexComparisonReceiptId?: string | null;
  correctedIndexLedgerBindingHash?: string | null;
  archiveResumeRefreezeLedgerReceiptId?: string | null;
  finalNoticeReconciliationReceiptId?: string | null;
  closureSignoffReconciliationReceiptId?: string | null;
  residualHashDriftScanReceiptId?: string | null;
  residualChannelDriftScanReceiptId?: string | null;
  postResolutionDriftSignals?: Pass2870CustomerExportSupervisoryPostResolutionDriftSignal[] | null;
  closureAuditPayloadHash?: string | null;
  closureAuditTimelineHash?: string | null;
}): Pass2870CustomerExportSupervisoryTamperResolutionReconciliationClosureAuditGate {
  const previousGate = args.customerExportSupervisoryTamperIncidentResolutionArchiveResumeGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousEnvelope = previousGate.supervisoryTamperIncidentResolutionArchiveResumeEnvelope;
  const previousReady = Boolean(previousGate.supervisoryTamperIncidentResolutionArchiveResumePolicy.canResumeSupervisoryArchiveClose);
  const driftSignals = normalizeDriftSignals(args.postResolutionDriftSignals);
  const residualDriftDetected = driftSignals.some((signal) => signal.freezeRequired || signal.severity === "high" || signal.severity === "critical");

  const comparisonReady = Boolean(
    args.originalFrozenIndexId &&
      args.originalFrozenIndexVersion &&
      args.originalFrozenIndexHash &&
      args.correctedIndexComparisonReceiptId &&
      args.correctedIndexLedgerBindingHash,
  );
  const archiveDecisionReady = Boolean(args.archiveResumeRefreezeLedgerReceiptId);
  const noticeReady = Boolean(args.finalNoticeReconciliationReceiptId);
  const signoffReady = Boolean(args.closureSignoffReconciliationReceiptId);
  const residualScanReady = Boolean(args.residualHashDriftScanReceiptId && args.residualChannelDriftScanReceiptId && !residualDriftDetected);
  const timelineReady = Boolean(args.closureAuditPayloadHash && args.closureAuditTimelineHash);

  const ready = Boolean(previousReady && comparisonReady && archiveDecisionReady && noticeReady && signoffReady && residualScanReady && timelineReady);

  const state: Pass2870CustomerExportSupervisoryTamperResolutionReconciliationClosureAuditState = !previousReady
    ? "previous_tamper_resolution_not_ready"
    : !comparisonReady
      ? "original_corrected_index_comparison_missing"
      : !archiveDecisionReady
        ? "archive_resume_refreeze_ledger_missing"
        : !noticeReady
          ? "final_notice_reconciliation_missing"
          : !signoffReady
            ? "closure_signoff_reconciliation_missing"
            : !residualScanReady
              ? "post_resolution_residual_drift_scan_missing"
              : !timelineReady
                ? "closure_audit_timeline_missing"
                : "supervisory_tamper_resolution_reconciliation_closure_audit_ready";

  const readiness = clamp(
    previousGate.supervisoryTamperIncidentResolutionArchiveResumeReadinessScore +
      (previousReady ? 7 : -55) +
      (args.originalFrozenIndexId ? 5 : -10) +
      (args.originalFrozenIndexVersion ? 5 : -10) +
      (args.originalFrozenIndexHash ? 7 : -14) +
      (args.correctedIndexComparisonReceiptId ? 12 : -22) +
      (args.correctedIndexLedgerBindingHash ? 8 : -16) +
      (args.archiveResumeRefreezeLedgerReceiptId ? 12 : -24) +
      (args.finalNoticeReconciliationReceiptId ? 9 : -18) +
      (args.closureSignoffReconciliationReceiptId ? 9 : -18) +
      (args.residualHashDriftScanReceiptId ? 7 : -14) +
      (args.residualChannelDriftScanReceiptId ? 7 : -14) +
      (!residualDriftDetected ? 9 : -35) +
      (args.closureAuditPayloadHash ? 6 : -12) +
      (args.closureAuditTimelineHash ? 10 : -20),
  );

  return {
    schemaVersion: "pass2870_customer_export_supervisory_tamper_resolution_reconciliation_closure_audit_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryTamperResolutionReconciliationClosureAuditState: state,
    supervisoryTamperResolutionReconciliationClosureAuditReadinessScore: readiness,
    supervisoryTamperResolutionReconciliationClosureAuditEnvelope: {
      previousTamperResolutionState: previousGate.supervisoryTamperIncidentResolutionArchiveResumeState,
      previousTamperResolutionReadinessScore: previousGate.supervisoryTamperIncidentResolutionArchiveResumeReadinessScore,
      previousCanResumeSupervisoryArchiveClose: previousReady,
      previousResolutionCaseId: previousEnvelope.resolutionCaseId,
      previousCorrectedEvidenceIndexId: previousEnvelope.correctedEvidenceIndexId,
      previousCorrectedEvidenceIndexVersion: previousEnvelope.correctedEvidenceIndexVersion,
      previousCorrectedEvidenceIndexHash: previousEnvelope.correctedEvidenceIndexHash,
      previousArchiveResumeDecision: previousEnvelope.archiveResumeDecision,
      previousArchiveResumeDecisionReceiptId: previousEnvelope.archiveResumeDecisionReceiptId,
      previousArchiveResumeReceiptId: previousEnvelope.archiveResumeReceiptId,
      previousReFreezeReceiptId: previousEnvelope.reFreezeReceiptId,
      previousIncidentClosureTimelineHash: previousEnvelope.incidentClosureTimelineHash,
      originalFrozenIndexId: args.originalFrozenIndexId ?? null,
      originalFrozenIndexVersion: args.originalFrozenIndexVersion ?? null,
      originalFrozenIndexHash: args.originalFrozenIndexHash ?? null,
      correctedIndexComparisonReceiptId: args.correctedIndexComparisonReceiptId ?? null,
      correctedIndexLedgerBindingHash: args.correctedIndexLedgerBindingHash ?? null,
      archiveResumeRefreezeLedgerReceiptId: args.archiveResumeRefreezeLedgerReceiptId ?? null,
      finalNoticeReconciliationReceiptId: args.finalNoticeReconciliationReceiptId ?? null,
      closureSignoffReconciliationReceiptId: args.closureSignoffReconciliationReceiptId ?? null,
      residualHashDriftScanReceiptId: args.residualHashDriftScanReceiptId ?? null,
      residualChannelDriftScanReceiptId: args.residualChannelDriftScanReceiptId ?? null,
      postResolutionDriftSignals: driftSignals,
      closureAuditPayloadHash: args.closureAuditPayloadHash ?? null,
      closureAuditTimelineHash: args.closureAuditTimelineHash ?? null,
    },
    supervisoryTamperResolutionReconciliationClosureAuditPolicy: {
      canCloseTamperResolution: ready,
      canKeepSupervisoryArchiveCloseResumed: ready,
      mustFreezeOnResidualDrift: residualDriftDetected || !ready,
      mustPreserveOriginalFrozenIndexImmutable: true,
      canClaimProductionReconciliationWorker: false,
      reason: ready
        ? "PASS2870 ready: original frozen index, corrected index, archive decision, notices, signoffs and residual drift scans are reconciled into a closure-audit timeline."
        : "PASS2870 blocked: tamper resolution/archive resume requires reconciliation closure audit before supervisory archive close remains resumed.",
    },
    supervisoryTamperResolutionReconciliationClosureAuditRiskSignals: {
      previousResolutionNotReady: !previousReady,
      comparisonMissing: !comparisonReady,
      correctedIndexLedgerBindingMissing: !args.correctedIndexLedgerBindingHash,
      archiveDecisionLedgerMissing: !archiveDecisionReady,
      noticeReconciliationMissing: !noticeReady,
      closureSignoffReconciliationMissing: !signoffReady,
      residualHashDriftScanMissing: !args.residualHashDriftScanReceiptId,
      residualChannelDriftScanMissing: !args.residualChannelDriftScanReceiptId,
      residualDriftDetected,
      closureAuditPayloadHashMissing: !args.closureAuditPayloadHash,
      closureAuditTimelineMissing: !args.closureAuditTimelineHash,
    },
    customerSafeCopy: ready
      ? "Supervisory tamper resolution has a reconciliation closure audit. The original frozen evidence index remains immutable and the corrected/resumed archive state is receipt-bound."
      : "Supervisory tamper resolution is not final until original/corrected evidence indexes, archive decision, final notices, signoffs and residual drift scans are reconciled.",
    operatorNextActions: ready
      ? [
          "Attach PASS2870 closure audit timeline to release-readiness evidence.",
          "Keep mutation monitors active for post-close evidence-index drift.",
          "Do not mutate the original frozen index; use follow-up correction packets only.",
        ]
      : [
          "Reconcile original frozen index against corrected evidence-index hash and version.",
          "Reconcile archive resume/refreeze ledger receipt, final notices and closure signoffs.",
          "Run residual hash/channel drift scans and freeze closure if any drift remains.",
        ],
  };
}
