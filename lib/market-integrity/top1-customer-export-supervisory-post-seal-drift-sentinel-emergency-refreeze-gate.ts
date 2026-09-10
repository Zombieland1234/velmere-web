import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealGate } from "@/lib/market-integrity/top1-customer-export-supervisory-post-release-observation-close-final-channel-seal-gate";

export type Pass2879CustomerExportSupervisoryPostSealDriftSignal =
  | "sealed_channel_hash_drift"
  | "delivery_channel_rebind"
  | "archive_write_after_seal"
  | "export_link_reactivation"
  | "late_evidence_after_final_seal"
  | "rollback_plan_retention_drift"
  | "notice_receipt_mismatch";

export type Pass2879CustomerExportSupervisoryPostSealDriftSentinelDecision =
  | "remain_sealed_open"
  | "emergency_refreeze"
  | "reopen_supervisory_review"
  | "extend_sentinel_observation";

export type Pass2879CustomerExportSupervisoryPostSealDriftSentinelEmergencyRefreezeState =
  | "previous_final_channel_seal_not_ready"
  | "sentinel_receipt_missing"
  | "sealed_channel_baseline_missing"
  | "heartbeat_schedule_missing"
  | "drift_scan_missing"
  | "drift_signal_review_missing"
  | "decision_missing"
  | "emergency_refreeze_receipt_missing"
  | "reopen_ticket_missing"
  | "extended_observation_receipt_missing"
  | "notice_or_incident_receipt_missing"
  | "signoff_receipts_missing"
  | "payload_or_timeline_hash_missing"
  | "supervisory_post_seal_drift_sentinel_emergency_refreeze_ready";

export type Pass2879CustomerExportSupervisoryPostSealDriftSentinelEmergencyRefreezeGate = {
  schemaVersion: "pass2879_customer_export_supervisory_post_seal_drift_sentinel_emergency_refreeze_gate_v1";
  surface: string;
  tier: VelmereTier;
  sentinelId: string;
  releasePacketId: string;
  generatedAt: string;
  supervisoryPostSealDriftSentinelEmergencyRefreezeState: Pass2879CustomerExportSupervisoryPostSealDriftSentinelEmergencyRefreezeState;
  supervisoryPostSealDriftSentinelEmergencyRefreezeReadinessScore: number;
  supervisoryPostSealDriftSentinelEmergencyRefreezeEnvelope: {
    previousFinalChannelSealState: string;
    previousFinalChannelSealReadinessScore: number;
    previousCanSealArchiveExportDeliveryChannelsOpen: boolean;
    previousFinalChannelSealPayloadHash: string | null;
    previousFinalChannelSealTimelineHash: string | null;
    sentinelReceiptId: string | null;
    sentinelWindowStartedAt: string | null;
    sentinelWindowEndsAt: string | null;
    sealedChannelBaselineHash: string | null;
    sealedChannelHeartbeatScheduleReceiptId: string | null;
    driftScanReceiptId: string | null;
    driftScanHash: string | null;
    reviewedDriftSignals: Pass2879CustomerExportSupervisoryPostSealDriftSignal[];
    driftBudgetRemaining: number;
    sentinelDecision: Pass2879CustomerExportSupervisoryPostSealDriftSentinelDecision | null;
    emergencyRefreezeReceiptId: string | null;
    reopenedSupervisoryReviewTicketId: string | null;
    extendedSentinelObservationReceiptId: string | null;
    customerAnomalyNoticeReceiptId: string | null;
    regulatorAnomalyNoticeReceiptId: string | null;
    auditorAnomalyNoticeReceiptId: string | null;
    internalIncidentReceiptId: string | null;
    legalSignoffReceiptId: string | null;
    securitySignoffReceiptId: string | null;
    privacySignoffReceiptId: string | null;
    postSealSentinelPayloadHash: string | null;
    postSealSentinelTimelineHash: string | null;
  };
  supervisoryPostSealDriftSentinelEmergencyRefreezePolicy: {
    canKeepChannelsSealedOpen: boolean;
    mustEmergencyRefreezeArchiveExportDeliveryChannels: boolean;
    mustReopenSupervisoryReview: boolean;
    mustExtendSentinelObservation: boolean;
    canClaimProductionPostSealSentinelWorker: false;
    reason: string;
  };
  supervisoryPostSealDriftSentinelEmergencyRefreezeRiskSignals: {
    previousFinalChannelSealNotReady: boolean;
    sentinelReceiptMissing: boolean;
    sealedChannelBaselineMissing: boolean;
    heartbeatScheduleMissing: boolean;
    driftScanMissing: boolean;
    driftSignalReviewMissing: boolean;
    decisionMissing: boolean;
    emergencyRefreezeReceiptMissing: boolean;
    reopenTicketMissing: boolean;
    extendedObservationReceiptMissing: boolean;
    noticeOrIncidentReceiptMissing: boolean;
    signoffReceiptsMissing: boolean;
    payloadHashMissing: boolean;
    timelineHashMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2879_CUSTOMER_EXPORT_SUPERVISORY_POST_SEAL_DRIFT_SENTINEL_EMERGENCY_REFREEZE_ACCEPTANCE_GATES = [
  "PASS2879: PASS2878 final channel seal is not permanent immunity; sealed-open channels need post-seal drift sentinel evidence.",
  "PASS2879: Sentinel requires a sealed-channel baseline hash, heartbeat schedule, drift scan and reviewed drift signals.",
  "PASS2879: Emergency refreeze, supervisory reopen or extended observation decisions require matching receipts/tickets.",
  "PASS2879: Customer/regulator/auditor anomaly notices, internal incident receipt and legal/security/privacy signoff are required before channels remain sealed-open after sentinel review.",
  "PASS2879: This is deterministic contract evidence only; production still requires live sentinel workers, alerting, incident routing and real channel lock enforcement.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2879CustomerExportSupervisoryPostSealDriftSentinelEmergencyRefreezeGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryPostReleaseObservationCloseFinalChannelSealGate: Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealGate;
  generatedAt?: string;
  sentinelReceiptId?: string | null;
  sentinelWindowStartedAt?: string | null;
  sentinelWindowEndsAt?: string | null;
  sealedChannelBaselineHash?: string | null;
  sealedChannelHeartbeatScheduleReceiptId?: string | null;
  driftScanReceiptId?: string | null;
  driftScanHash?: string | null;
  reviewedDriftSignals?: Pass2879CustomerExportSupervisoryPostSealDriftSignal[] | null;
  driftBudgetRemaining?: number | null;
  sentinelDecision?: Pass2879CustomerExportSupervisoryPostSealDriftSentinelDecision | null;
  emergencyRefreezeReceiptId?: string | null;
  reopenedSupervisoryReviewTicketId?: string | null;
  extendedSentinelObservationReceiptId?: string | null;
  customerAnomalyNoticeReceiptId?: string | null;
  regulatorAnomalyNoticeReceiptId?: string | null;
  auditorAnomalyNoticeReceiptId?: string | null;
  internalIncidentReceiptId?: string | null;
  legalSignoffReceiptId?: string | null;
  securitySignoffReceiptId?: string | null;
  privacySignoffReceiptId?: string | null;
  postSealSentinelPayloadHash?: string | null;
  postSealSentinelTimelineHash?: string | null;
}): Pass2879CustomerExportSupervisoryPostSealDriftSentinelEmergencyRefreezeGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousGate = args.customerExportSupervisoryPostReleaseObservationCloseFinalChannelSealGate;
  const previousEnvelope = previousGate.supervisoryPostReleaseObservationCloseFinalChannelSealEnvelope;
  const previousReady = Boolean(previousGate.supervisoryPostReleaseObservationCloseFinalChannelSealPolicy.canSealArchiveExportDeliveryChannelsOpen);
  const reviewedDriftSignals = args.reviewedDriftSignals ?? [];
  const driftBudgetRemaining = typeof args.driftBudgetRemaining === "number" ? args.driftBudgetRemaining : -1;

  const sentinelReady = Boolean(args.sentinelReceiptId && args.sentinelWindowStartedAt && args.sentinelWindowEndsAt);
  const baselineReady = Boolean(args.sealedChannelBaselineHash);
  const heartbeatReady = Boolean(args.sealedChannelHeartbeatScheduleReceiptId);
  const scanReady = Boolean(args.driftScanReceiptId && args.driftScanHash);
  const reviewReady = Array.isArray(reviewedDriftSignals) && driftBudgetRemaining >= 0;
  const decisionReady = Boolean(args.sentinelDecision);
  const refreezeDecision = args.sentinelDecision === "emergency_refreeze";
  const reopenDecision = args.sentinelDecision === "reopen_supervisory_review";
  const extendDecision = args.sentinelDecision === "extend_sentinel_observation";
  const remainOpenDecision = args.sentinelDecision === "remain_sealed_open";
  const emergencyRefreezeReady = refreezeDecision ? Boolean(args.emergencyRefreezeReceiptId) : true;
  const reopenReady = reopenDecision ? Boolean(args.reopenedSupervisoryReviewTicketId) : true;
  const extendReady = extendDecision ? Boolean(args.extendedSentinelObservationReceiptId) : true;
  const noticesReady = Boolean(args.customerAnomalyNoticeReceiptId && args.regulatorAnomalyNoticeReceiptId && args.auditorAnomalyNoticeReceiptId && args.internalIncidentReceiptId);
  const signoffsReady = Boolean(args.legalSignoffReceiptId && args.securitySignoffReceiptId && args.privacySignoffReceiptId);
  const hashesReady = Boolean(args.postSealSentinelPayloadHash && args.postSealSentinelTimelineHash);
  const noDrift = reviewedDriftSignals.length === 0 && driftBudgetRemaining >= 0;

  const canKeepChannelsSealedOpen = Boolean(previousReady && sentinelReady && baselineReady && heartbeatReady && scanReady && reviewReady && remainOpenDecision && noDrift && noticesReady && signoffsReady && hashesReady);
  const mustEmergencyRefreeze = Boolean(previousReady && sentinelReady && baselineReady && heartbeatReady && scanReady && reviewReady && refreezeDecision && emergencyRefreezeReady && noticesReady && signoffsReady && hashesReady);
  const mustReopen = Boolean(previousReady && sentinelReady && baselineReady && heartbeatReady && scanReady && reviewReady && reopenDecision && reopenReady && noticesReady && signoffsReady && hashesReady);
  const mustExtend = Boolean(previousReady && sentinelReady && baselineReady && heartbeatReady && scanReady && reviewReady && extendDecision && extendReady && noticesReady && signoffsReady && hashesReady);

  const state: Pass2879CustomerExportSupervisoryPostSealDriftSentinelEmergencyRefreezeState = !previousReady
    ? "previous_final_channel_seal_not_ready"
    : !sentinelReady
      ? "sentinel_receipt_missing"
      : !baselineReady
        ? "sealed_channel_baseline_missing"
        : !heartbeatReady
          ? "heartbeat_schedule_missing"
          : !scanReady
            ? "drift_scan_missing"
            : !reviewReady
              ? "drift_signal_review_missing"
              : !decisionReady
                ? "decision_missing"
                : !emergencyRefreezeReady
                  ? "emergency_refreeze_receipt_missing"
                  : !reopenReady
                    ? "reopen_ticket_missing"
                    : !extendReady
                      ? "extended_observation_receipt_missing"
                      : !noticesReady
                        ? "notice_or_incident_receipt_missing"
                        : !signoffsReady
                          ? "signoff_receipts_missing"
                          : !hashesReady
                            ? "payload_or_timeline_hash_missing"
                            : "supervisory_post_seal_drift_sentinel_emergency_refreeze_ready";

  const readiness = clamp(
    previousGate.supervisoryPostReleaseObservationCloseFinalChannelSealReadinessScore +
      (previousReady ? 8 : -60) +
      (sentinelReady ? 10 : -22) +
      (baselineReady ? 10 : -20) +
      (heartbeatReady ? 8 : -18) +
      (scanReady ? 10 : -22) +
      (reviewReady ? 9 : -18) +
      (decisionReady ? 8 : -18) +
      (emergencyRefreezeReady ? 5 : -16) +
      (reopenReady ? 5 : -16) +
      (extendReady ? 5 : -12) +
      (noticesReady ? 8 : -16) +
      (signoffsReady ? 8 : -16) +
      (hashesReady ? 8 : -18)
  );

  const reason = canKeepChannelsSealedOpen
    ? "Post-seal sentinel found no drift and channels can remain sealed-open under monitoring."
    : mustEmergencyRefreeze
      ? "Post-seal sentinel requires emergency re-freeze of archive/export/delivery channels."
      : mustReopen
        ? "Post-seal sentinel requires reopened supervisory review."
        : mustExtend
          ? "Post-seal sentinel requires extended observation before channels remain sealed-open."
          : `Post-seal sentinel is blocked at ${state}.`;

  return {
    schemaVersion: "pass2879_customer_export_supervisory_post_seal_drift_sentinel_emergency_refreeze_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Advanced",
    sentinelId: args.sentinelReceiptId ?? `pass2879_sentinel_${generatedAt}`,
    releasePacketId: previousEnvelope.finalChannelSealReceiptId ?? "previous_final_channel_seal_missing",
    generatedAt,
    supervisoryPostSealDriftSentinelEmergencyRefreezeState: state,
    supervisoryPostSealDriftSentinelEmergencyRefreezeReadinessScore: readiness,
    supervisoryPostSealDriftSentinelEmergencyRefreezeEnvelope: {
      previousFinalChannelSealState: previousGate.supervisoryPostReleaseObservationCloseFinalChannelSealState,
      previousFinalChannelSealReadinessScore: previousGate.supervisoryPostReleaseObservationCloseFinalChannelSealReadinessScore,
      previousCanSealArchiveExportDeliveryChannelsOpen: previousReady,
      previousFinalChannelSealPayloadHash: previousEnvelope.finalChannelSealPayloadHash,
      previousFinalChannelSealTimelineHash: previousEnvelope.finalChannelSealTimelineHash,
      sentinelReceiptId: args.sentinelReceiptId ?? null,
      sentinelWindowStartedAt: args.sentinelWindowStartedAt ?? null,
      sentinelWindowEndsAt: args.sentinelWindowEndsAt ?? null,
      sealedChannelBaselineHash: args.sealedChannelBaselineHash ?? null,
      sealedChannelHeartbeatScheduleReceiptId: args.sealedChannelHeartbeatScheduleReceiptId ?? null,
      driftScanReceiptId: args.driftScanReceiptId ?? null,
      driftScanHash: args.driftScanHash ?? null,
      reviewedDriftSignals,
      driftBudgetRemaining,
      sentinelDecision: args.sentinelDecision ?? null,
      emergencyRefreezeReceiptId: args.emergencyRefreezeReceiptId ?? null,
      reopenedSupervisoryReviewTicketId: args.reopenedSupervisoryReviewTicketId ?? null,
      extendedSentinelObservationReceiptId: args.extendedSentinelObservationReceiptId ?? null,
      customerAnomalyNoticeReceiptId: args.customerAnomalyNoticeReceiptId ?? null,
      regulatorAnomalyNoticeReceiptId: args.regulatorAnomalyNoticeReceiptId ?? null,
      auditorAnomalyNoticeReceiptId: args.auditorAnomalyNoticeReceiptId ?? null,
      internalIncidentReceiptId: args.internalIncidentReceiptId ?? null,
      legalSignoffReceiptId: args.legalSignoffReceiptId ?? null,
      securitySignoffReceiptId: args.securitySignoffReceiptId ?? null,
      privacySignoffReceiptId: args.privacySignoffReceiptId ?? null,
      postSealSentinelPayloadHash: args.postSealSentinelPayloadHash ?? null,
      postSealSentinelTimelineHash: args.postSealSentinelTimelineHash ?? null,
    },
    supervisoryPostSealDriftSentinelEmergencyRefreezePolicy: {
      canKeepChannelsSealedOpen,
      mustEmergencyRefreezeArchiveExportDeliveryChannels: mustEmergencyRefreeze,
      mustReopenSupervisoryReview: mustReopen,
      mustExtendSentinelObservation: mustExtend,
      canClaimProductionPostSealSentinelWorker: false,
      reason,
    },
    supervisoryPostSealDriftSentinelEmergencyRefreezeRiskSignals: {
      previousFinalChannelSealNotReady: !previousReady,
      sentinelReceiptMissing: !sentinelReady,
      sealedChannelBaselineMissing: !baselineReady,
      heartbeatScheduleMissing: !heartbeatReady,
      driftScanMissing: !scanReady,
      driftSignalReviewMissing: !reviewReady,
      decisionMissing: !decisionReady,
      emergencyRefreezeReceiptMissing: !emergencyRefreezeReady,
      reopenTicketMissing: !reopenReady,
      extendedObservationReceiptMissing: !extendReady,
      noticeOrIncidentReceiptMissing: !noticesReady,
      signoffReceiptsMissing: !signoffsReady,
      payloadHashMissing: !args.postSealSentinelPayloadHash,
      timelineHashMissing: !args.postSealSentinelTimelineHash,
    },
    customerSafeCopy: canKeepChannelsSealedOpen
      ? "Final channel seal remains under long-term sentinel surveillance with no reviewed drift signals."
      : "Final channel seal is not treated as permanent; post-seal drift or missing sentinel evidence can trigger emergency refreeze or reopened supervisory review.",
    operatorNextActions: canKeepChannelsSealedOpen
      ? ["Keep sentinel heartbeat active", "Retain anomaly notice receipts", "Prepare emergency refreeze drill evidence"]
      : ["Attach missing sentinel evidence", "Record emergency refreeze/reopen/extend decision receipts", "Keep archive/export/delivery channels under supervisory control"],
  };
}
