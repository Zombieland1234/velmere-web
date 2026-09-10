import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionRecloseGate } from "@/lib/market-integrity/top1-customer-export-supervisory-post-closure-mutation-incident-resolution-reclose-gate";

export type Pass2873CustomerExportSupervisoryPostRecloseRegressionSignalKind =
  | "no_regression"
  | "repeat_hash_drift"
  | "repeat_channel_rebind"
  | "repeat_reindex"
  | "late_evidence_drift"
  | "watcher_gap";

export type Pass2873CustomerExportSupervisoryPostRecloseRegressionSeverity = "none" | "low" | "medium" | "high" | "critical";

export type Pass2873CustomerExportSupervisoryPostRecloseRegressionSignal = {
  signalId: string;
  signalKind: Pass2873CustomerExportSupervisoryPostRecloseRegressionSignalKind;
  detectedAt: string;
  severity: Pass2873CustomerExportSupervisoryPostRecloseRegressionSeverity;
  affectedSurface: "corrected_evidence_index" | "archive_close" | "export_channel" | "notice_timeline" | "watcher_runtime";
  repeatedIncident: boolean;
  autoFreezeRequired: boolean;
};

export type Pass2873CustomerExportSupervisoryPostRecloseRegressionSloState =
  | "previous_reclose_not_ready"
  | "post_reclose_watch_missing"
  | "corrected_index_reseal_binding_missing"
  | "regression_slo_missing"
  | "regression_signal_review_missing"
  | "repeated_incident_escalation_missing"
  | "recurrence_freeze_receipt_missing"
  | "notice_escalation_missing"
  | "signoff_missing"
  | "post_reclose_timeline_missing"
  | "supervisory_post_reclose_regression_slo_ready";

export type Pass2873CustomerExportSupervisoryPostRecloseRegressionSloGate = {
  schemaVersion: "pass2873_customer_export_supervisory_post_reclose_regression_slo_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryPostRecloseRegressionSloState: Pass2873CustomerExportSupervisoryPostRecloseRegressionSloState;
  supervisoryPostRecloseRegressionSloReadinessScore: number;
  supervisoryPostRecloseRegressionSloEnvelope: {
    previousRecloseState: string;
    previousRecloseReadinessScore: number;
    previousCanRecloseFinalClosure: boolean;
    previousResolutionDecision: string | null;
    previousCorrectedEvidenceIndexId: string | null;
    previousCorrectedEvidenceIndexVersion: string | null;
    previousCorrectedEvidenceIndexHash: string | null;
    previousRecloseReceiptId: string | null;
    previousResolutionPayloadHash: string | null;
    previousResolutionTimelineHash: string | null;
    postRecloseWatchReceiptId: string | null;
    postRecloseWatchWindowHours: number;
    correctedIndexResealReceiptId: string | null;
    regressionSloPolicyId: string | null;
    regressionSloMaxRepeatIncidents: number;
    regressionSignalReviewReceiptId: string | null;
    regressionSignals: Pass2873CustomerExportSupervisoryPostRecloseRegressionSignal[];
    repeatedIncidentEscalationTicketId: string | null;
    recurrenceFreezeReceiptId: string | null;
    archiveCloseFreezeReceiptId: string | null;
    exportChannelFreezeReceiptId: string | null;
    customerNoticeEscalationReceiptId: string | null;
    regulatorNoticeEscalationReceiptId: string | null;
    auditorNoticeEscalationReceiptId: string | null;
    legalSignoffReceiptId: string | null;
    securitySignoffReceiptId: string | null;
    privacySignoffReceiptId: string | null;
    postRecloseRegressionPayloadHash: string | null;
    postRecloseRegressionTimelineHash: string | null;
  };
  supervisoryPostRecloseRegressionSloPolicy: {
    canKeepReclosedFinalClosure: boolean;
    mustAutoFreezeOnRepeatedIncident: boolean;
    mustEscalateRepeatedIncident: boolean;
    canClaimProductionRegressionWorker: false;
    reason: string;
  };
  supervisoryPostRecloseRegressionSloRiskSignals: {
    previousRecloseNotReady: boolean;
    postRecloseWatchMissing: boolean;
    correctedIndexResealBindingMissing: boolean;
    regressionSloMissing: boolean;
    regressionSignalsDetected: boolean;
    repeatedIncidentDetected: boolean;
    regressionSignalReviewMissing: boolean;
    repeatedIncidentEscalationMissing: boolean;
    recurrenceFreezeReceiptMissing: boolean;
    noticeEscalationMissing: boolean;
    signoffMissing: boolean;
    payloadHashMissing: boolean;
    timelineHashMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2873_CUSTOMER_EXPORT_SUPERVISORY_POST_RECLOSE_REGRESSION_SLO_ACCEPTANCE_GATES = [
  "PASS2873: PASS2872 re-close is not final unless a post-reclose regression watch is attached to the corrected evidence index and reclose receipt.",
  "PASS2873: Repeated hash drift, reindex, channel rebind or late evidence drift after re-close must trigger auto-freeze and a repeated-incident escalation ticket.",
  "PASS2873: Regression SLO policy, regression signal review and corrected-index reseal receipt are separate from PASS2872 resolution receipts.",
  "PASS2873: Customer/regulator/auditor notice escalation decisions and legal/security/privacy signoffs are required when repeated regression is detected.",
  "PASS2873: Re-closed final closure can remain closed only when watch, SLO, review, notices, signoffs and post-reclose timeline hashes are complete.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2873CustomerExportSupervisoryPostRecloseRegressionSloGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryPostClosureMutationIncidentResolutionRecloseGate: Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionRecloseGate;
  generatedAt?: string;
  postRecloseWatchReceiptId?: string | null;
  postRecloseWatchWindowHours?: number;
  correctedIndexResealReceiptId?: string | null;
  regressionSloPolicyId?: string | null;
  regressionSloMaxRepeatIncidents?: number;
  regressionSignalReviewReceiptId?: string | null;
  regressionSignals?: Pass2873CustomerExportSupervisoryPostRecloseRegressionSignal[] | null;
  repeatedIncidentEscalationTicketId?: string | null;
  recurrenceFreezeReceiptId?: string | null;
  archiveCloseFreezeReceiptId?: string | null;
  exportChannelFreezeReceiptId?: string | null;
  customerNoticeEscalationReceiptId?: string | null;
  regulatorNoticeEscalationReceiptId?: string | null;
  auditorNoticeEscalationReceiptId?: string | null;
  legalSignoffReceiptId?: string | null;
  securitySignoffReceiptId?: string | null;
  privacySignoffReceiptId?: string | null;
  postRecloseRegressionPayloadHash?: string | null;
  postRecloseRegressionTimelineHash?: string | null;
}): Pass2873CustomerExportSupervisoryPostRecloseRegressionSloGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousGate = args.customerExportSupervisoryPostClosureMutationIncidentResolutionRecloseGate;
  const previousEnvelope = previousGate.supervisoryPostClosureMutationIncidentResolutionRecloseEnvelope;
  const previousReady = Boolean(previousGate.supervisoryPostClosureMutationIncidentResolutionReclosePolicy.canRecloseFinalClosure);
  const regressionSignals = args.regressionSignals ?? [];
  const repeatedIncidentDetected = regressionSignals.some((signal) => signal.repeatedIncident || signal.autoFreezeRequired);
  const watchReady = Boolean(args.postRecloseWatchReceiptId && (args.postRecloseWatchWindowHours ?? 0) > 0);
  const resealReady = Boolean(args.correctedIndexResealReceiptId && previousEnvelope.correctedEvidenceIndexId && previousEnvelope.correctedEvidenceIndexHash);
  const sloReady = Boolean(args.regressionSloPolicyId && (args.regressionSloMaxRepeatIncidents ?? 0) >= 0);
  const reviewReady = Boolean(args.regressionSignalReviewReceiptId);
  const escalationReady = repeatedIncidentDetected ? Boolean(args.repeatedIncidentEscalationTicketId) : true;
  const freezeReady = repeatedIncidentDetected
    ? Boolean(args.recurrenceFreezeReceiptId && args.archiveCloseFreezeReceiptId && args.exportChannelFreezeReceiptId)
    : true;
  const noticeReady = repeatedIncidentDetected
    ? Boolean(args.customerNoticeEscalationReceiptId && args.regulatorNoticeEscalationReceiptId && args.auditorNoticeEscalationReceiptId)
    : true;
  const signoffReady = Boolean(args.legalSignoffReceiptId && args.securitySignoffReceiptId && args.privacySignoffReceiptId);
  const timelineReady = Boolean(args.postRecloseRegressionPayloadHash && args.postRecloseRegressionTimelineHash);
  const ready = Boolean(previousReady && watchReady && resealReady && sloReady && reviewReady && escalationReady && freezeReady && noticeReady && signoffReady && timelineReady);

  const state: Pass2873CustomerExportSupervisoryPostRecloseRegressionSloState = !previousReady
    ? "previous_reclose_not_ready"
    : !watchReady
      ? "post_reclose_watch_missing"
      : !resealReady
        ? "corrected_index_reseal_binding_missing"
        : !sloReady
          ? "regression_slo_missing"
          : !reviewReady
            ? "regression_signal_review_missing"
            : !escalationReady
              ? "repeated_incident_escalation_missing"
              : !freezeReady
                ? "recurrence_freeze_receipt_missing"
                : !noticeReady
                  ? "notice_escalation_missing"
                  : !signoffReady
                    ? "signoff_missing"
                    : !timelineReady
                      ? "post_reclose_timeline_missing"
                      : "supervisory_post_reclose_regression_slo_ready";

  const readiness = clamp(
    previousGate.supervisoryPostClosureMutationIncidentResolutionRecloseReadinessScore +
      (previousReady ? 8 : -55) +
      (watchReady ? 14 : -28) +
      (resealReady ? 14 : -28) +
      (sloReady ? 12 : -24) +
      (reviewReady ? 10 : -20) +
      (repeatedIncidentDetected ? -12 : 8) +
      (escalationReady ? 9 : -22) +
      (freezeReady ? 9 : -22) +
      (noticeReady ? 8 : -18) +
      (signoffReady ? 11 : -22) +
      (args.postRecloseRegressionPayloadHash ? 6 : -12) +
      (args.postRecloseRegressionTimelineHash ? 10 : -20),
  );

  const canKeepReclosedFinalClosure = Boolean(ready && !repeatedIncidentDetected);
  const mustAutoFreezeOnRepeatedIncident = Boolean(repeatedIncidentDetected && freezeReady);
  const mustEscalateRepeatedIncident = Boolean(repeatedIncidentDetected && escalationReady);

  return {
    schemaVersion: "pass2873_customer_export_supervisory_post_reclose_regression_slo_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: `pass2873-post-reclose-regression-slo:${previousGate.releasePacketId}`,
    sealId: `pass2873:${previousGate.sealId}`,
    generatedAt,
    supervisoryPostRecloseRegressionSloState: state,
    supervisoryPostRecloseRegressionSloReadinessScore: readiness,
    supervisoryPostRecloseRegressionSloEnvelope: {
      previousRecloseState: previousGate.supervisoryPostClosureMutationIncidentResolutionRecloseState,
      previousRecloseReadinessScore: previousGate.supervisoryPostClosureMutationIncidentResolutionRecloseReadinessScore,
      previousCanRecloseFinalClosure: previousReady,
      previousResolutionDecision: previousEnvelope.resolutionDecision,
      previousCorrectedEvidenceIndexId: previousEnvelope.correctedEvidenceIndexId,
      previousCorrectedEvidenceIndexVersion: previousEnvelope.correctedEvidenceIndexVersion,
      previousCorrectedEvidenceIndexHash: previousEnvelope.correctedEvidenceIndexHash,
      previousRecloseReceiptId: previousEnvelope.recloseReceiptId,
      previousResolutionPayloadHash: previousEnvelope.resolutionPayloadHash,
      previousResolutionTimelineHash: previousEnvelope.resolutionTimelineHash,
      postRecloseWatchReceiptId: args.postRecloseWatchReceiptId ?? null,
      postRecloseWatchWindowHours: args.postRecloseWatchWindowHours ?? 720,
      correctedIndexResealReceiptId: args.correctedIndexResealReceiptId ?? null,
      regressionSloPolicyId: args.regressionSloPolicyId ?? null,
      regressionSloMaxRepeatIncidents: args.regressionSloMaxRepeatIncidents ?? 0,
      regressionSignalReviewReceiptId: args.regressionSignalReviewReceiptId ?? null,
      regressionSignals,
      repeatedIncidentEscalationTicketId: args.repeatedIncidentEscalationTicketId ?? null,
      recurrenceFreezeReceiptId: args.recurrenceFreezeReceiptId ?? null,
      archiveCloseFreezeReceiptId: args.archiveCloseFreezeReceiptId ?? null,
      exportChannelFreezeReceiptId: args.exportChannelFreezeReceiptId ?? null,
      customerNoticeEscalationReceiptId: args.customerNoticeEscalationReceiptId ?? null,
      regulatorNoticeEscalationReceiptId: args.regulatorNoticeEscalationReceiptId ?? null,
      auditorNoticeEscalationReceiptId: args.auditorNoticeEscalationReceiptId ?? null,
      legalSignoffReceiptId: args.legalSignoffReceiptId ?? null,
      securitySignoffReceiptId: args.securitySignoffReceiptId ?? null,
      privacySignoffReceiptId: args.privacySignoffReceiptId ?? null,
      postRecloseRegressionPayloadHash: args.postRecloseRegressionPayloadHash ?? null,
      postRecloseRegressionTimelineHash: args.postRecloseRegressionTimelineHash ?? null,
    },
    supervisoryPostRecloseRegressionSloPolicy: {
      canKeepReclosedFinalClosure,
      mustAutoFreezeOnRepeatedIncident,
      mustEscalateRepeatedIncident,
      canClaimProductionRegressionWorker: false,
      reason: canKeepReclosedFinalClosure
        ? "PASS2873 allows the re-closed final closure to remain closed only while the corrected evidence index is resealed, watched and free of repeated regression signals."
        : repeatedIncidentDetected
          ? "PASS2873 keeps the archive/export chain frozen and escalated because a repeated post-reclose regression signal was detected."
          : "PASS2873 keeps the re-closed archive/export chain blocked until post-reclose watch, regression SLO, review, signoffs and timeline hashes are complete.",
    },
    supervisoryPostRecloseRegressionSloRiskSignals: {
      previousRecloseNotReady: !previousReady,
      postRecloseWatchMissing: !watchReady,
      correctedIndexResealBindingMissing: !resealReady,
      regressionSloMissing: !sloReady,
      regressionSignalsDetected: regressionSignals.length > 0,
      repeatedIncidentDetected,
      regressionSignalReviewMissing: !reviewReady,
      repeatedIncidentEscalationMissing: repeatedIncidentDetected && !args.repeatedIncidentEscalationTicketId,
      recurrenceFreezeReceiptMissing: repeatedIncidentDetected && !freezeReady,
      noticeEscalationMissing: repeatedIncidentDetected && !noticeReady,
      signoffMissing: !signoffReady,
      payloadHashMissing: !args.postRecloseRegressionPayloadHash,
      timelineHashMissing: !args.postRecloseRegressionTimelineHash,
    },
    customerSafeCopy:
      "Velmere treats a re-closed mutation incident as watched, not permanently settled: repeated drift after corrected-index reseal freezes the export chain and requires escalation before the closure can stay closed.",
    operatorNextActions: canKeepReclosedFinalClosure
      ? [
          "Keep the post-reclose regression SLO watch attached to release-readiness and the final archive board.",
          "Retain the corrected index reseal receipt and post-reclose watch timeline with the final evidence index.",
          "Open PASS2874 if any late regression signal appears after the re-close watch window.",
        ]
      : [
          "Keep the re-closed archive/export chain blocked until PASS2873 watch, SLO, review, signoffs and hashes are complete.",
          "Auto-freeze and escalate repeated drift/reindex/channel-rebind signals instead of silently reusing PASS2872 re-close receipts.",
          "Attach customer/regulator/auditor notice escalation decisions when repeated regression is detected.",
        ],
  };
}
