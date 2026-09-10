import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2880CustomerExportSupervisoryEmergencyRefreezeResolutionResealGate } from "@/lib/market-integrity/top1-customer-export-supervisory-emergency-refreeze-resolution-reseal-gate";

export type Pass2881CustomerExportSupervisoryPostResealProbationRelapseSignal =
  | "resealed_channel_hash_drift"
  | "resealed_export_delivery_drift"
  | "resealed_archive_binding_drift"
  | "resealed_notice_mismatch"
  | "resealed_audit_timeline_gap"
  | "late_customer_dispute_after_reseal"
  | "none";

export type Pass2881CustomerExportSupervisoryPostResealProbationDecision =
  | "restore_trust_after_probation"
  | "emergency_refreeze_on_relapse"
  | "extend_probation"
  | "reopen_supervisory_investigation";

export type Pass2881CustomerExportSupervisoryPostResealProbationRelapseSentinelState =
  | "previous_reseal_resolution_not_ready"
  | "previous_reseal_not_granted"
  | "probation_case_missing"
  | "probation_window_missing"
  | "heartbeat_missing"
  | "relapse_scan_missing"
  | "relapse_review_missing"
  | "decision_missing"
  | "trust_restore_receipt_missing"
  | "emergency_refreeze_receipt_missing"
  | "extended_probation_receipt_missing"
  | "reopened_investigation_ticket_missing"
  | "notice_receipts_missing"
  | "signoff_receipts_missing"
  | "payload_or_timeline_hash_missing"
  | "supervisory_post_reseal_probation_relapse_sentinel_ready";

export type Pass2881CustomerExportSupervisoryPostResealProbationRelapseSentinelGate = {
  schemaVersion: "pass2881_customer_export_supervisory_post_reseal_probation_relapse_sentinel_gate_v1";
  surface: string;
  tier: VelmereTier;
  probationCaseId: string;
  releasePacketId: string;
  generatedAt: string;
  supervisoryPostResealProbationRelapseSentinelState: Pass2881CustomerExportSupervisoryPostResealProbationRelapseSentinelState;
  supervisoryPostResealProbationRelapseSentinelReadinessScore: number;
  supervisoryPostResealProbationRelapseSentinelEnvelope: {
    previousEmergencyRefreezeResolutionState: string;
    previousEmergencyRefreezeResolutionReadinessScore: number;
    previousResolutionDecision: string | null;
    previousCanResealChannelsAfterEmergencyRefreeze: boolean;
    previousChannelResealHash: string | null;
    previousResolutionPayloadHash: string | null;
    previousResolutionTimelineHash: string | null;
    postResealProbationCaseId: string | null;
    postResealProbationOwnerId: string | null;
    postResealProbationSlaReceiptId: string | null;
    probationWindowStartedAt: string | null;
    probationWindowEndsAt: string | null;
    resealedChannelBaselineHash: string | null;
    probationHeartbeatReceiptId: string | null;
    probationHeartbeatScheduleHash: string | null;
    relapseScanReceiptId: string | null;
    relapseScanHash: string | null;
    reviewedRelapseSignals: Pass2881CustomerExportSupervisoryPostResealProbationRelapseSignal[];
    relapseBudgetRemaining: number;
    probationDecision: Pass2881CustomerExportSupervisoryPostResealProbationDecision | null;
    trustRestoreReceiptId: string | null;
    trustRestoreHash: string | null;
    emergencyRefreezeReceiptId: string | null;
    extendedProbationReceiptId: string | null;
    reopenedSupervisoryInvestigationTicketId: string | null;
    customerProbationNoticeReceiptId: string | null;
    regulatorProbationNoticeReceiptId: string | null;
    auditorProbationNoticeReceiptId: string | null;
    internalProbationNoticeReceiptId: string | null;
    legalSignoffReceiptId: string | null;
    securitySignoffReceiptId: string | null;
    privacySignoffReceiptId: string | null;
    postResealProbationPayloadHash: string | null;
    postResealProbationTimelineHash: string | null;
  };
  supervisoryPostResealProbationRelapseSentinelPolicy: {
    canRestoreFinalTrustAfterProbation: boolean;
    mustEmergencyRefreezeOnRelapse: boolean;
    mustExtendPostResealProbation: boolean;
    mustReopenSupervisoryInvestigation: boolean;
    canClaimProductionPostResealSentinelWorker: false;
    reason: string;
  };
  supervisoryPostResealProbationRelapseSentinelRiskSignals: {
    previousResolutionNotReady: boolean;
    previousResealNotGranted: boolean;
    probationCaseMissing: boolean;
    probationWindowMissing: boolean;
    heartbeatMissing: boolean;
    relapseScanMissing: boolean;
    relapseReviewMissing: boolean;
    decisionMissing: boolean;
    trustRestoreReceiptMissing: boolean;
    emergencyRefreezeReceiptMissing: boolean;
    extendedProbationReceiptMissing: boolean;
    reopenedInvestigationTicketMissing: boolean;
    noticeReceiptsMissing: boolean;
    signoffReceiptsMissing: boolean;
    payloadHashMissing: boolean;
    timelineHashMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2881_CUSTOMER_EXPORT_SUPERVISORY_POST_RESEAL_PROBATION_RELAPSE_SENTINEL_ACCEPTANCE_GATES = [
  "PASS2881: PASS2880 supervised re-seal is not full trust restoration; post-reseal probation is mandatory.",
  "PASS2881: Probation requires owner/SLA, observation window, heartbeat receipt, relapse scan and reviewed relapse signals.",
  "PASS2881: Trust restore, emergency re-freeze, extended probation or reopened investigation decisions require matching receipts/tickets.",
  "PASS2881: Customer/regulator/auditor/internal notices plus legal/security/privacy signoff are required before post-reseal probation can close.",
  "PASS2881: This is deterministic contract evidence only; production still requires real sentinels, DB writes, job workers and alert delivery.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2881CustomerExportSupervisoryPostResealProbationRelapseSentinelGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryEmergencyRefreezeResolutionResealGate: Pass2880CustomerExportSupervisoryEmergencyRefreezeResolutionResealGate;
  generatedAt?: string;
  postResealProbationCaseId?: string | null;
  postResealProbationOwnerId?: string | null;
  postResealProbationSlaReceiptId?: string | null;
  probationWindowStartedAt?: string | null;
  probationWindowEndsAt?: string | null;
  resealedChannelBaselineHash?: string | null;
  probationHeartbeatReceiptId?: string | null;
  probationHeartbeatScheduleHash?: string | null;
  relapseScanReceiptId?: string | null;
  relapseScanHash?: string | null;
  reviewedRelapseSignals?: Pass2881CustomerExportSupervisoryPostResealProbationRelapseSignal[] | null;
  relapseBudgetRemaining?: number | null;
  probationDecision?: Pass2881CustomerExportSupervisoryPostResealProbationDecision | null;
  trustRestoreReceiptId?: string | null;
  trustRestoreHash?: string | null;
  emergencyRefreezeReceiptId?: string | null;
  extendedProbationReceiptId?: string | null;
  reopenedSupervisoryInvestigationTicketId?: string | null;
  customerProbationNoticeReceiptId?: string | null;
  regulatorProbationNoticeReceiptId?: string | null;
  auditorProbationNoticeReceiptId?: string | null;
  internalProbationNoticeReceiptId?: string | null;
  legalSignoffReceiptId?: string | null;
  securitySignoffReceiptId?: string | null;
  privacySignoffReceiptId?: string | null;
  postResealProbationPayloadHash?: string | null;
  postResealProbationTimelineHash?: string | null;
}): Pass2881CustomerExportSupervisoryPostResealProbationRelapseSentinelGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousGate = args.customerExportSupervisoryEmergencyRefreezeResolutionResealGate;
  const previousEnvelope = previousGate.supervisoryEmergencyRefreezeResolutionResealEnvelope;
  const previousPolicy = previousGate.supervisoryEmergencyRefreezeResolutionResealPolicy;
  const previousReady = previousGate.supervisoryEmergencyRefreezeResolutionResealState === "supervisory_emergency_refreeze_resolution_reseal_ready";
  const previousResealGranted = previousPolicy.canResealChannelsAfterEmergencyRefreeze === true && previousEnvelope.resolutionDecision === "reseal_after_corrected_baseline";
  const relapseSignals = args.reviewedRelapseSignals ?? ["none"];
  const relapseBudgetRemaining = args.relapseBudgetRemaining ?? 0;

  const probationCaseReady = Boolean(args.postResealProbationCaseId && args.postResealProbationOwnerId && args.postResealProbationSlaReceiptId);
  const probationWindowReady = Boolean(args.probationWindowStartedAt && args.probationWindowEndsAt && args.resealedChannelBaselineHash);
  const heartbeatReady = Boolean(args.probationHeartbeatReceiptId && args.probationHeartbeatScheduleHash);
  const relapseScanReady = Boolean(args.relapseScanReceiptId && args.relapseScanHash);
  const relapseReviewReady = relapseSignals.length > 0;
  const decisionReady = Boolean(args.probationDecision);
  const trustRestoreReady = args.probationDecision === "restore_trust_after_probation" ? Boolean(args.trustRestoreReceiptId && args.trustRestoreHash && relapseBudgetRemaining >= 0) : true;
  const emergencyRefreezeReady = args.probationDecision === "emergency_refreeze_on_relapse" ? Boolean(args.emergencyRefreezeReceiptId) : true;
  const extendedReady = args.probationDecision === "extend_probation" ? Boolean(args.extendedProbationReceiptId) : true;
  const reopenedReady = args.probationDecision === "reopen_supervisory_investigation" ? Boolean(args.reopenedSupervisoryInvestigationTicketId) : true;
  const noticesReady = Boolean(args.customerProbationNoticeReceiptId && args.regulatorProbationNoticeReceiptId && args.auditorProbationNoticeReceiptId && args.internalProbationNoticeReceiptId);
  const signoffsReady = Boolean(args.legalSignoffReceiptId && args.securitySignoffReceiptId && args.privacySignoffReceiptId);
  const hashesReady = Boolean(args.postResealProbationPayloadHash && args.postResealProbationTimelineHash);

  const state: Pass2881CustomerExportSupervisoryPostResealProbationRelapseSentinelState = !previousReady
    ? "previous_reseal_resolution_not_ready"
    : !previousResealGranted
      ? "previous_reseal_not_granted"
      : !probationCaseReady
        ? "probation_case_missing"
        : !probationWindowReady
          ? "probation_window_missing"
          : !heartbeatReady
            ? "heartbeat_missing"
            : !relapseScanReady
              ? "relapse_scan_missing"
              : !relapseReviewReady
                ? "relapse_review_missing"
                : !decisionReady
                  ? "decision_missing"
                  : !trustRestoreReady
                    ? "trust_restore_receipt_missing"
                    : !emergencyRefreezeReady
                      ? "emergency_refreeze_receipt_missing"
                      : !extendedReady
                        ? "extended_probation_receipt_missing"
                        : !reopenedReady
                          ? "reopened_investigation_ticket_missing"
                          : !noticesReady
                            ? "notice_receipts_missing"
                            : !signoffsReady
                              ? "signoff_receipts_missing"
                              : !hashesReady
                                ? "payload_or_timeline_hash_missing"
                                : "supervisory_post_reseal_probation_relapse_sentinel_ready";

  const canRestore = state === "supervisory_post_reseal_probation_relapse_sentinel_ready" && args.probationDecision === "restore_trust_after_probation";
  const mustRefreeze = args.probationDecision === "emergency_refreeze_on_relapse";
  const mustExtend = args.probationDecision === "extend_probation";
  const mustReopen = args.probationDecision === "reopen_supervisory_investigation";

  const readiness = clamp(
    50 +
      (previousReady ? 8 : -18) +
      (previousResealGranted ? 8 : -18) +
      (probationCaseReady ? 5 : -5) +
      (probationWindowReady ? 5 : -5) +
      (heartbeatReady ? 5 : -5) +
      (relapseScanReady ? 5 : -5) +
      (relapseReviewReady ? 4 : -4) +
      (decisionReady ? 5 : -6) +
      (trustRestoreReady && emergencyRefreezeReady && extendedReady && reopenedReady ? 8 : -8) +
      (noticesReady ? 5 : -5) +
      (signoffsReady ? 5 : -5) +
      (hashesReady ? 10 : -10)
  );

  return {
    schemaVersion: "pass2881_customer_export_supervisory_post_reseal_probation_relapse_sentinel_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Advanced",
    probationCaseId: args.postResealProbationCaseId ?? "pass2881-probation-case-pending",
    releasePacketId: previousGate.releasePacketId,
    generatedAt,
    supervisoryPostResealProbationRelapseSentinelState: state,
    supervisoryPostResealProbationRelapseSentinelReadinessScore: readiness,
    supervisoryPostResealProbationRelapseSentinelEnvelope: {
      previousEmergencyRefreezeResolutionState: previousGate.supervisoryEmergencyRefreezeResolutionResealState,
      previousEmergencyRefreezeResolutionReadinessScore: previousGate.supervisoryEmergencyRefreezeResolutionResealReadinessScore,
      previousResolutionDecision: previousEnvelope.resolutionDecision,
      previousCanResealChannelsAfterEmergencyRefreeze: previousPolicy.canResealChannelsAfterEmergencyRefreeze,
      previousChannelResealHash: previousEnvelope.channelResealHash,
      previousResolutionPayloadHash: previousEnvelope.emergencyRefreezeResolutionPayloadHash,
      previousResolutionTimelineHash: previousEnvelope.emergencyRefreezeResolutionTimelineHash,
      postResealProbationCaseId: args.postResealProbationCaseId ?? null,
      postResealProbationOwnerId: args.postResealProbationOwnerId ?? null,
      postResealProbationSlaReceiptId: args.postResealProbationSlaReceiptId ?? null,
      probationWindowStartedAt: args.probationWindowStartedAt ?? null,
      probationWindowEndsAt: args.probationWindowEndsAt ?? null,
      resealedChannelBaselineHash: args.resealedChannelBaselineHash ?? null,
      probationHeartbeatReceiptId: args.probationHeartbeatReceiptId ?? null,
      probationHeartbeatScheduleHash: args.probationHeartbeatScheduleHash ?? null,
      relapseScanReceiptId: args.relapseScanReceiptId ?? null,
      relapseScanHash: args.relapseScanHash ?? null,
      reviewedRelapseSignals: relapseSignals,
      relapseBudgetRemaining,
      probationDecision: args.probationDecision ?? null,
      trustRestoreReceiptId: args.trustRestoreReceiptId ?? null,
      trustRestoreHash: args.trustRestoreHash ?? null,
      emergencyRefreezeReceiptId: args.emergencyRefreezeReceiptId ?? null,
      extendedProbationReceiptId: args.extendedProbationReceiptId ?? null,
      reopenedSupervisoryInvestigationTicketId: args.reopenedSupervisoryInvestigationTicketId ?? null,
      customerProbationNoticeReceiptId: args.customerProbationNoticeReceiptId ?? null,
      regulatorProbationNoticeReceiptId: args.regulatorProbationNoticeReceiptId ?? null,
      auditorProbationNoticeReceiptId: args.auditorProbationNoticeReceiptId ?? null,
      internalProbationNoticeReceiptId: args.internalProbationNoticeReceiptId ?? null,
      legalSignoffReceiptId: args.legalSignoffReceiptId ?? null,
      securitySignoffReceiptId: args.securitySignoffReceiptId ?? null,
      privacySignoffReceiptId: args.privacySignoffReceiptId ?? null,
      postResealProbationPayloadHash: args.postResealProbationPayloadHash ?? null,
      postResealProbationTimelineHash: args.postResealProbationTimelineHash ?? null,
    },
    supervisoryPostResealProbationRelapseSentinelPolicy: {
      canRestoreFinalTrustAfterProbation: canRestore,
      mustEmergencyRefreezeOnRelapse: mustRefreeze,
      mustExtendPostResealProbation: mustExtend,
      mustReopenSupervisoryInvestigation: mustReopen,
      canClaimProductionPostResealSentinelWorker: false,
      reason: canRestore
        ? "Post-reseal probation finished with monitored heartbeats, relapse scan and trust-restore proof."
        : mustRefreeze
          ? "Relapse detected during post-reseal probation; emergency re-freeze is required."
          : mustExtend
            ? "Post-reseal probation must be extended before trust can be restored."
            : mustReopen
              ? "Relapse requires reopened supervisory investigation."
              : `PASS2881 blocked: ${state}`,
    },
    supervisoryPostResealProbationRelapseSentinelRiskSignals: {
      previousResolutionNotReady: !previousReady,
      previousResealNotGranted: !previousResealGranted,
      probationCaseMissing: !probationCaseReady,
      probationWindowMissing: !probationWindowReady,
      heartbeatMissing: !heartbeatReady,
      relapseScanMissing: !relapseScanReady,
      relapseReviewMissing: !relapseReviewReady,
      decisionMissing: !decisionReady,
      trustRestoreReceiptMissing: !trustRestoreReady,
      emergencyRefreezeReceiptMissing: !emergencyRefreezeReady,
      extendedProbationReceiptMissing: !extendedReady,
      reopenedInvestigationTicketMissing: !reopenedReady,
      noticeReceiptsMissing: !noticesReady,
      signoffReceiptsMissing: !signoffsReady,
      payloadHashMissing: !args.postResealProbationPayloadHash,
      timelineHashMissing: !args.postResealProbationTimelineHash,
    },
    customerSafeCopy: "PASS2881 treats supervised re-seal as probation, not final trust restoration. A resealed channel must prove heartbeat, relapse scan, notices, signoffs and either trust restore or automatic relapse action.",
    operatorNextActions: canRestore
      ? ["Attach trust-restore proof to the customer export release dashboard.", "Keep long-term sealed-channel surveillance active after probation."]
      : ["Keep channels under post-reseal probation controls.", "Do not manually restore final trust without PASS2881 receipts.", "Escalate relapse signals to emergency re-freeze or reopened investigation."],
  };
}
