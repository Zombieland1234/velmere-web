import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2881CustomerExportSupervisoryPostResealProbationRelapseSentinelGate } from "@/lib/market-integrity/top1-customer-export-supervisory-post-reseal-probation-relapse-sentinel-gate";

export type Pass2882CustomerExportSupervisoryFinalTrustRestoreHandoverSignal =
  | "final_trust_scope_drift"
  | "surveillance_owner_gap"
  | "handover_ledger_gap"
  | "late_relapse_after_trust_restore"
  | "retention_or_notice_binding_gap"
  | "none";

export type Pass2882CustomerExportSupervisoryFinalTrustRestoreHandoverDecision =
  | "promote_to_long_term_surveillance"
  | "return_to_post_reseal_probation"
  | "emergency_refreeze"
  | "reopen_supervisory_investigation";

export type Pass2882CustomerExportSupervisoryFinalTrustRestoreLongTermSurveillanceHandoverState =
  | "previous_probation_not_ready"
  | "previous_trust_restore_not_granted"
  | "final_trust_restore_case_missing"
  | "final_trust_ledger_missing"
  | "channel_custody_handover_missing"
  | "long_term_surveillance_handover_missing"
  | "handover_signal_review_missing"
  | "handover_decision_missing"
  | "return_to_probation_receipt_missing"
  | "emergency_refreeze_receipt_missing"
  | "reopened_investigation_ticket_missing"
  | "notice_receipts_missing"
  | "signoff_receipts_missing"
  | "payload_or_timeline_hash_missing"
  | "supervisory_final_trust_restore_long_term_surveillance_handover_ready";

export type Pass2882CustomerExportSupervisoryFinalTrustRestoreLongTermSurveillanceHandoverGate = {
  schemaVersion: "pass2882_customer_export_supervisory_final_trust_restore_long_term_surveillance_handover_gate_v1";
  surface: string;
  tier: VelmereTier;
  finalTrustRestoreCaseId: string;
  releasePacketId: string;
  generatedAt: string;
  supervisoryFinalTrustRestoreLongTermSurveillanceHandoverState: Pass2882CustomerExportSupervisoryFinalTrustRestoreLongTermSurveillanceHandoverState;
  supervisoryFinalTrustRestoreLongTermSurveillanceHandoverReadinessScore: number;
  supervisoryFinalTrustRestoreLongTermSurveillanceHandoverEnvelope: {
    previousPostResealProbationState: string;
    previousPostResealProbationReadinessScore: number;
    previousProbationDecision: string | null;
    previousCanRestoreFinalTrustAfterProbation: boolean;
    previousTrustRestoreHash: string | null;
    previousProbationPayloadHash: string | null;
    previousProbationTimelineHash: string | null;
    finalTrustRestoreCaseId: string | null;
    finalTrustRestoreOwnerId: string | null;
    finalTrustRestoreSlaReceiptId: string | null;
    finalTrustLedgerReceiptId: string | null;
    finalTrustLedgerHash: string | null;
    archiveChannelCustodyReceiptId: string | null;
    exportChannelCustodyReceiptId: string | null;
    deliveryChannelCustodyReceiptId: string | null;
    longTermSurveillanceOwnerId: string | null;
    longTermSurveillanceScheduleHash: string | null;
    longTermSurveillanceHeartbeatReceiptId: string | null;
    postRestoreDriftProbeReceiptId: string | null;
    reviewedHandoverSignals: Pass2882CustomerExportSupervisoryFinalTrustRestoreHandoverSignal[];
    handoverDecision: Pass2882CustomerExportSupervisoryFinalTrustRestoreHandoverDecision | null;
    returnToProbationReceiptId: string | null;
    emergencyRefreezeReceiptId: string | null;
    reopenedSupervisoryInvestigationTicketId: string | null;
    customerFinalTrustNoticeReceiptId: string | null;
    regulatorFinalTrustNoticeReceiptId: string | null;
    auditorFinalTrustNoticeReceiptId: string | null;
    internalFinalTrustNoticeReceiptId: string | null;
    legalSignoffReceiptId: string | null;
    securitySignoffReceiptId: string | null;
    privacySignoffReceiptId: string | null;
    finalTrustRestorePayloadHash: string | null;
    finalTrustRestoreTimelineHash: string | null;
  };
  supervisoryFinalTrustRestoreLongTermSurveillanceHandoverPolicy: {
    canHandoverToLongTermSurveillance: boolean;
    mustReturnToPostResealProbation: boolean;
    mustEmergencyRefreeze: boolean;
    mustReopenSupervisoryInvestigation: boolean;
    canClaimProductionLongTermSurveillanceWorker: false;
    reason: string;
  };
  supervisoryFinalTrustRestoreLongTermSurveillanceHandoverRiskSignals: {
    previousProbationNotReady: boolean;
    previousTrustRestoreNotGranted: boolean;
    finalTrustRestoreCaseMissing: boolean;
    finalTrustLedgerMissing: boolean;
    channelCustodyHandoverMissing: boolean;
    longTermSurveillanceHandoverMissing: boolean;
    handoverSignalReviewMissing: boolean;
    handoverDecisionMissing: boolean;
    returnToProbationReceiptMissing: boolean;
    emergencyRefreezeReceiptMissing: boolean;
    reopenedInvestigationTicketMissing: boolean;
    noticeReceiptsMissing: boolean;
    signoffReceiptsMissing: boolean;
    payloadHashMissing: boolean;
    timelineHashMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2882_CUSTOMER_EXPORT_SUPERVISORY_FINAL_TRUST_RESTORE_LONG_TERM_SURVEILLANCE_HANDOVER_ACCEPTANCE_GATES = [
  "PASS2882: PASS2881 trust restore after probation is not operational handover; final trust restore requires a durable handover ledger.",
  "PASS2882: Archive/export/delivery channel custody transfer receipts are required before long-term surveillance handover.",
  "PASS2882: Long-term surveillance owner, heartbeat schedule, post-restore probe and reviewed handover signals are mandatory.",
  "PASS2882: Return-to-probation, emergency re-freeze or reopened investigation decisions require matching receipts/tickets.",
  "PASS2882: This is deterministic contract evidence only; production still needs real DB writes, queue workers, SIEM alerts and immutable retention storage.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2882CustomerExportSupervisoryFinalTrustRestoreLongTermSurveillanceHandoverGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryPostResealProbationRelapseSentinelGate: Pass2881CustomerExportSupervisoryPostResealProbationRelapseSentinelGate;
  generatedAt?: string;
  finalTrustRestoreCaseId?: string | null;
  finalTrustRestoreOwnerId?: string | null;
  finalTrustRestoreSlaReceiptId?: string | null;
  finalTrustLedgerReceiptId?: string | null;
  finalTrustLedgerHash?: string | null;
  archiveChannelCustodyReceiptId?: string | null;
  exportChannelCustodyReceiptId?: string | null;
  deliveryChannelCustodyReceiptId?: string | null;
  longTermSurveillanceOwnerId?: string | null;
  longTermSurveillanceScheduleHash?: string | null;
  longTermSurveillanceHeartbeatReceiptId?: string | null;
  postRestoreDriftProbeReceiptId?: string | null;
  reviewedHandoverSignals?: Pass2882CustomerExportSupervisoryFinalTrustRestoreHandoverSignal[] | null;
  handoverDecision?: Pass2882CustomerExportSupervisoryFinalTrustRestoreHandoverDecision | null;
  returnToProbationReceiptId?: string | null;
  emergencyRefreezeReceiptId?: string | null;
  reopenedSupervisoryInvestigationTicketId?: string | null;
  customerFinalTrustNoticeReceiptId?: string | null;
  regulatorFinalTrustNoticeReceiptId?: string | null;
  auditorFinalTrustNoticeReceiptId?: string | null;
  internalFinalTrustNoticeReceiptId?: string | null;
  legalSignoffReceiptId?: string | null;
  securitySignoffReceiptId?: string | null;
  privacySignoffReceiptId?: string | null;
  finalTrustRestorePayloadHash?: string | null;
  finalTrustRestoreTimelineHash?: string | null;
}): Pass2882CustomerExportSupervisoryFinalTrustRestoreLongTermSurveillanceHandoverGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousGate = args.customerExportSupervisoryPostResealProbationRelapseSentinelGate;
  const previousEnvelope = previousGate.supervisoryPostResealProbationRelapseSentinelEnvelope;
  const previousPolicy = previousGate.supervisoryPostResealProbationRelapseSentinelPolicy;
  const previousReady = previousGate.supervisoryPostResealProbationRelapseSentinelState === "supervisory_post_reseal_probation_relapse_sentinel_ready";
  const previousTrustRestored = previousPolicy.canRestoreFinalTrustAfterProbation === true && previousEnvelope.probationDecision === "restore_trust_after_probation";
  const signals = args.reviewedHandoverSignals ?? ["none"];

  const finalTrustCaseReady = Boolean(args.finalTrustRestoreCaseId && args.finalTrustRestoreOwnerId && args.finalTrustRestoreSlaReceiptId);
  const finalTrustLedgerReady = Boolean(args.finalTrustLedgerReceiptId && args.finalTrustLedgerHash);
  const custodyReady = Boolean(args.archiveChannelCustodyReceiptId && args.exportChannelCustodyReceiptId && args.deliveryChannelCustodyReceiptId);
  const surveillanceReady = Boolean(args.longTermSurveillanceOwnerId && args.longTermSurveillanceScheduleHash && args.longTermSurveillanceHeartbeatReceiptId && args.postRestoreDriftProbeReceiptId);
  const signalReviewReady = signals.length > 0;
  const decisionReady = Boolean(args.handoverDecision);
  const returnToProbationReady = args.handoverDecision === "return_to_post_reseal_probation" ? Boolean(args.returnToProbationReceiptId) : true;
  const emergencyRefreezeReady = args.handoverDecision === "emergency_refreeze" ? Boolean(args.emergencyRefreezeReceiptId) : true;
  const reopenedReady = args.handoverDecision === "reopen_supervisory_investigation" ? Boolean(args.reopenedSupervisoryInvestigationTicketId) : true;
  const noticesReady = Boolean(args.customerFinalTrustNoticeReceiptId && args.regulatorFinalTrustNoticeReceiptId && args.auditorFinalTrustNoticeReceiptId && args.internalFinalTrustNoticeReceiptId);
  const signoffsReady = Boolean(args.legalSignoffReceiptId && args.securitySignoffReceiptId && args.privacySignoffReceiptId);
  const hashesReady = Boolean(args.finalTrustRestorePayloadHash && args.finalTrustRestoreTimelineHash);

  const state: Pass2882CustomerExportSupervisoryFinalTrustRestoreLongTermSurveillanceHandoverState = !previousReady
    ? "previous_probation_not_ready"
    : !previousTrustRestored
      ? "previous_trust_restore_not_granted"
      : !finalTrustCaseReady
        ? "final_trust_restore_case_missing"
        : !finalTrustLedgerReady
          ? "final_trust_ledger_missing"
          : !custodyReady
            ? "channel_custody_handover_missing"
            : !surveillanceReady
              ? "long_term_surveillance_handover_missing"
              : !signalReviewReady
                ? "handover_signal_review_missing"
                : !decisionReady
                  ? "handover_decision_missing"
                  : !returnToProbationReady
                    ? "return_to_probation_receipt_missing"
                    : !emergencyRefreezeReady
                      ? "emergency_refreeze_receipt_missing"
                      : !reopenedReady
                        ? "reopened_investigation_ticket_missing"
                        : !noticesReady
                          ? "notice_receipts_missing"
                          : !signoffsReady
                            ? "signoff_receipts_missing"
                            : !hashesReady
                              ? "payload_or_timeline_hash_missing"
                              : "supervisory_final_trust_restore_long_term_surveillance_handover_ready";

  const canHandover = state === "supervisory_final_trust_restore_long_term_surveillance_handover_ready" && args.handoverDecision === "promote_to_long_term_surveillance";
  const mustReturnToProbation = args.handoverDecision === "return_to_post_reseal_probation";
  const mustEmergencyRefreeze = args.handoverDecision === "emergency_refreeze";
  const mustReopen = args.handoverDecision === "reopen_supervisory_investigation";

  const readiness = clamp(
    50 +
      (previousReady ? 8 : -18) +
      (previousTrustRestored ? 8 : -18) +
      (finalTrustCaseReady ? 6 : -6) +
      (finalTrustLedgerReady ? 8 : -8) +
      (custodyReady ? 7 : -7) +
      (surveillanceReady ? 8 : -8) +
      (signalReviewReady ? 4 : -4) +
      (decisionReady ? 6 : -6) +
      (returnToProbationReady && emergencyRefreezeReady && reopenedReady ? 6 : -6) +
      (noticesReady ? 5 : -5) +
      (signoffsReady ? 5 : -5) +
      (hashesReady ? 9 : -9)
  );

  return {
    schemaVersion: "pass2882_customer_export_supervisory_final_trust_restore_long_term_surveillance_handover_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Advanced",
    finalTrustRestoreCaseId: args.finalTrustRestoreCaseId ?? "pass2882-final-trust-restore-case-pending",
    releasePacketId: previousGate.releasePacketId,
    generatedAt,
    supervisoryFinalTrustRestoreLongTermSurveillanceHandoverState: state,
    supervisoryFinalTrustRestoreLongTermSurveillanceHandoverReadinessScore: readiness,
    supervisoryFinalTrustRestoreLongTermSurveillanceHandoverEnvelope: {
      previousPostResealProbationState: previousGate.supervisoryPostResealProbationRelapseSentinelState,
      previousPostResealProbationReadinessScore: previousGate.supervisoryPostResealProbationRelapseSentinelReadinessScore,
      previousProbationDecision: previousEnvelope.probationDecision,
      previousCanRestoreFinalTrustAfterProbation: previousPolicy.canRestoreFinalTrustAfterProbation,
      previousTrustRestoreHash: previousEnvelope.trustRestoreHash,
      previousProbationPayloadHash: previousEnvelope.postResealProbationPayloadHash,
      previousProbationTimelineHash: previousEnvelope.postResealProbationTimelineHash,
      finalTrustRestoreCaseId: args.finalTrustRestoreCaseId ?? null,
      finalTrustRestoreOwnerId: args.finalTrustRestoreOwnerId ?? null,
      finalTrustRestoreSlaReceiptId: args.finalTrustRestoreSlaReceiptId ?? null,
      finalTrustLedgerReceiptId: args.finalTrustLedgerReceiptId ?? null,
      finalTrustLedgerHash: args.finalTrustLedgerHash ?? null,
      archiveChannelCustodyReceiptId: args.archiveChannelCustodyReceiptId ?? null,
      exportChannelCustodyReceiptId: args.exportChannelCustodyReceiptId ?? null,
      deliveryChannelCustodyReceiptId: args.deliveryChannelCustodyReceiptId ?? null,
      longTermSurveillanceOwnerId: args.longTermSurveillanceOwnerId ?? null,
      longTermSurveillanceScheduleHash: args.longTermSurveillanceScheduleHash ?? null,
      longTermSurveillanceHeartbeatReceiptId: args.longTermSurveillanceHeartbeatReceiptId ?? null,
      postRestoreDriftProbeReceiptId: args.postRestoreDriftProbeReceiptId ?? null,
      reviewedHandoverSignals: signals,
      handoverDecision: args.handoverDecision ?? null,
      returnToProbationReceiptId: args.returnToProbationReceiptId ?? null,
      emergencyRefreezeReceiptId: args.emergencyRefreezeReceiptId ?? null,
      reopenedSupervisoryInvestigationTicketId: args.reopenedSupervisoryInvestigationTicketId ?? null,
      customerFinalTrustNoticeReceiptId: args.customerFinalTrustNoticeReceiptId ?? null,
      regulatorFinalTrustNoticeReceiptId: args.regulatorFinalTrustNoticeReceiptId ?? null,
      auditorFinalTrustNoticeReceiptId: args.auditorFinalTrustNoticeReceiptId ?? null,
      internalFinalTrustNoticeReceiptId: args.internalFinalTrustNoticeReceiptId ?? null,
      legalSignoffReceiptId: args.legalSignoffReceiptId ?? null,
      securitySignoffReceiptId: args.securitySignoffReceiptId ?? null,
      privacySignoffReceiptId: args.privacySignoffReceiptId ?? null,
      finalTrustRestorePayloadHash: args.finalTrustRestorePayloadHash ?? null,
      finalTrustRestoreTimelineHash: args.finalTrustRestoreTimelineHash ?? null,
    },
    supervisoryFinalTrustRestoreLongTermSurveillanceHandoverPolicy: {
      canHandoverToLongTermSurveillance: canHandover,
      mustReturnToPostResealProbation: mustReturnToProbation,
      mustEmergencyRefreeze,
      mustReopenSupervisoryInvestigation: mustReopen,
      canClaimProductionLongTermSurveillanceWorker: false,
      reason: canHandover
        ? "Final trust restore was handed over to long-term surveillance with custody receipts and durable ledger proof."
        : mustReturnToProbation
          ? "Final trust restore handover found gaps; return to post-reseal probation is required."
          : mustEmergencyRefreeze
            ? "Post-restore handover detected relapse risk; emergency re-freeze is required."
            : mustReopen
              ? "Post-restore handover requires reopened supervisory investigation."
              : `PASS2882 blocked: ${state}`,
    },
    supervisoryFinalTrustRestoreLongTermSurveillanceHandoverRiskSignals: {
      previousProbationNotReady: !previousReady,
      previousTrustRestoreNotGranted: !previousTrustRestored,
      finalTrustRestoreCaseMissing: !finalTrustCaseReady,
      finalTrustLedgerMissing: !finalTrustLedgerReady,
      channelCustodyHandoverMissing: !custodyReady,
      longTermSurveillanceHandoverMissing: !surveillanceReady,
      handoverSignalReviewMissing: !signalReviewReady,
      handoverDecisionMissing: !decisionReady,
      returnToProbationReceiptMissing: !returnToProbationReady,
      emergencyRefreezeReceiptMissing: !emergencyRefreezeReady,
      reopenedInvestigationTicketMissing: !reopenedReady,
      noticeReceiptsMissing: !noticesReady,
      signoffReceiptsMissing: !signoffsReady,
      payloadHashMissing: !args.finalTrustRestorePayloadHash,
      timelineHashMissing: !args.finalTrustRestoreTimelineHash,
    },
    customerSafeCopy: "PASS2882 treats trust restore as an operational handover, not a silent green light. Final trust restore requires a durable ledger, custody transfer, long-term surveillance owner and rollback/refreeze decisions.",
    operatorNextActions: canHandover
      ? ["Attach final trust restore handover proof to the release dashboard.", "Keep the long-term surveillance heartbeat active after customer export trust is restored."]
      : ["Do not close PASS2881 trust restore as operationally safe without PASS2882 handover proof.", "Keep post-reseal probation or emergency controls active until custody, notices, signoffs and handover timeline hashes exist."],
  };
}
