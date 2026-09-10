import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2876CustomerExportSupervisoryStabilityEvidenceRollupReleaseEligibilityGate } from "@/lib/market-integrity/top1-customer-export-supervisory-stability-evidence-rollup-release-eligibility-gate";

export type Pass2877CustomerExportSupervisoryPostReleaseChannelDecision =
  | "channels_remain_open_under_monitor"
  | "rollback_to_freeze"
  | "extend_release_observation"
  | "reopen_release_review";

export type Pass2877CustomerExportSupervisoryPostReleaseChannelMonitorRollbackState =
  | "previous_release_eligibility_not_ready"
  | "release_execution_receipt_missing"
  | "channel_unlock_receipts_missing"
  | "post_release_monitor_missing"
  | "rollback_plan_missing"
  | "release_observation_window_missing"
  | "late_drift_probe_missing"
  | "decision_missing"
  | "rollback_receipt_missing"
  | "extended_observation_receipt_missing"
  | "reopened_review_ticket_missing"
  | "notice_receipts_missing"
  | "signoff_receipts_missing"
  | "payload_or_timeline_hash_missing"
  | "supervisory_post_release_channel_monitor_rollback_ready";

export type Pass2877CustomerExportSupervisoryPostReleaseChannelMonitorRollbackGate = {
  schemaVersion: "pass2877_customer_export_supervisory_post_release_channel_monitor_rollback_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryPostReleaseChannelMonitorRollbackState: Pass2877CustomerExportSupervisoryPostReleaseChannelMonitorRollbackState;
  supervisoryPostReleaseChannelMonitorRollbackReadinessScore: number;
  supervisoryPostReleaseChannelMonitorRollbackEnvelope: {
    previousReleaseEligibilityState: string;
    previousReleaseEligibilityReadinessScore: number;
    previousCanReleaseArchiveExportChannels: boolean;
    previousReleaseEligibilityPayloadHash: string | null;
    previousReleaseEligibilityTimelineHash: string | null;
    releaseExecutionReceiptId: string | null;
    releaseExecutionRunbookHash: string | null;
    archiveChannelUnlockReceiptId: string | null;
    exportChannelUnlockReceiptId: string | null;
    deliveryChannelUnlockReceiptId: string | null;
    postReleaseMonitorReceiptId: string | null;
    channelHeartbeatReceiptId: string | null;
    releaseObservationWindowHours: number | null;
    rollbackPlanId: string | null;
    rollbackPlanHash: string | null;
    lateDriftProbeReceiptId: string | null;
    lateDriftProbeHash: string | null;
    releaseDashboardCardId: string | null;
    postReleaseChannelDecision: Pass2877CustomerExportSupervisoryPostReleaseChannelDecision | null;
    rollbackToFreezeReceiptId: string | null;
    extendedObservationReceiptId: string | null;
    reopenedReleaseReviewTicketId: string | null;
    customerCorrectionNoticeReceiptId: string | null;
    regulatorCorrectionNoticeReceiptId: string | null;
    auditorCorrectionNoticeReceiptId: string | null;
    legalSignoffReceiptId: string | null;
    securitySignoffReceiptId: string | null;
    privacySignoffReceiptId: string | null;
    postReleaseChannelPayloadHash: string | null;
    postReleaseChannelTimelineHash: string | null;
  };
  supervisoryPostReleaseChannelMonitorRollbackPolicy: {
    canKeepArchiveExportDeliveryChannelsOpen: boolean;
    mustRollbackToFreeze: boolean;
    mustExtendReleaseObservation: boolean;
    mustReopenReleaseReview: boolean;
    canClaimProductionChannelUnlockWorker: false;
    reason: string;
  };
  supervisoryPostReleaseChannelMonitorRollbackRiskSignals: {
    previousReleaseEligibilityNotReady: boolean;
    releaseExecutionReceiptMissing: boolean;
    channelUnlockReceiptsMissing: boolean;
    postReleaseMonitorMissing: boolean;
    rollbackPlanMissing: boolean;
    releaseObservationWindowMissing: boolean;
    lateDriftProbeMissing: boolean;
    decisionMissing: boolean;
    rollbackReceiptMissing: boolean;
    extendedObservationReceiptMissing: boolean;
    reopenedReviewTicketMissing: boolean;
    noticeReceiptsMissing: boolean;
    signoffReceiptsMissing: boolean;
    payloadHashMissing: boolean;
    timelineHashMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2877_CUSTOMER_EXPORT_SUPERVISORY_POST_RELEASE_CHANNEL_MONITOR_ROLLBACK_ACCEPTANCE_GATES = [
  "PASS2877: PASS2876 release eligibility is not release execution; channel unlock requires execution receipts and per-channel unlock receipts.",
  "PASS2877: Post-release archive/export/delivery channels require heartbeat monitoring, a release observation window and late-drift probes.",
  "PASS2877: Late drift after release must trigger rollback-to-freeze, extended observation or reopened release review with separate receipts/tickets.",
  "PASS2877: Customer/regulator/auditor correction notices and legal/security/privacy signoff are required before channels can remain open.",
  "PASS2877: This is deterministic contract evidence only; production still requires durable unlock workers, alert jobs, dashboard UI and real notification delivery.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2877CustomerExportSupervisoryPostReleaseChannelMonitorRollbackGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryStabilityEvidenceRollupReleaseEligibilityGate: Pass2876CustomerExportSupervisoryStabilityEvidenceRollupReleaseEligibilityGate;
  generatedAt?: string;
  releaseExecutionReceiptId?: string | null;
  releaseExecutionRunbookHash?: string | null;
  archiveChannelUnlockReceiptId?: string | null;
  exportChannelUnlockReceiptId?: string | null;
  deliveryChannelUnlockReceiptId?: string | null;
  postReleaseMonitorReceiptId?: string | null;
  channelHeartbeatReceiptId?: string | null;
  releaseObservationWindowHours?: number | null;
  rollbackPlanId?: string | null;
  rollbackPlanHash?: string | null;
  lateDriftProbeReceiptId?: string | null;
  lateDriftProbeHash?: string | null;
  releaseDashboardCardId?: string | null;
  postReleaseChannelDecision?: Pass2877CustomerExportSupervisoryPostReleaseChannelDecision | null;
  rollbackToFreezeReceiptId?: string | null;
  extendedObservationReceiptId?: string | null;
  reopenedReleaseReviewTicketId?: string | null;
  customerCorrectionNoticeReceiptId?: string | null;
  regulatorCorrectionNoticeReceiptId?: string | null;
  auditorCorrectionNoticeReceiptId?: string | null;
  legalSignoffReceiptId?: string | null;
  securitySignoffReceiptId?: string | null;
  privacySignoffReceiptId?: string | null;
  postReleaseChannelPayloadHash?: string | null;
  postReleaseChannelTimelineHash?: string | null;
}): Pass2877CustomerExportSupervisoryPostReleaseChannelMonitorRollbackGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousGate = args.customerExportSupervisoryStabilityEvidenceRollupReleaseEligibilityGate;
  const previousEnvelope = previousGate.supervisoryStabilityEvidenceRollupReleaseEligibilityEnvelope;
  const previousReady = Boolean(previousGate.supervisoryStabilityEvidenceRollupReleaseEligibilityPolicy.canReleaseArchiveExportChannels);

  const executionReady = Boolean(args.releaseExecutionReceiptId && args.releaseExecutionRunbookHash);
  const channelUnlockReady = Boolean(args.archiveChannelUnlockReceiptId && args.exportChannelUnlockReceiptId && args.deliveryChannelUnlockReceiptId);
  const monitorReady = Boolean(args.postReleaseMonitorReceiptId && args.channelHeartbeatReceiptId && args.releaseDashboardCardId);
  const rollbackPlanReady = Boolean(args.rollbackPlanId && args.rollbackPlanHash);
  const observationReady = Boolean(args.releaseObservationWindowHours && args.releaseObservationWindowHours > 0);
  const lateDriftProbeReady = Boolean(args.lateDriftProbeReceiptId && args.lateDriftProbeHash);
  const decisionReady = Boolean(args.postReleaseChannelDecision);
  const openDecision = args.postReleaseChannelDecision === "channels_remain_open_under_monitor";
  const rollbackDecision = args.postReleaseChannelDecision === "rollback_to_freeze";
  const extendDecision = args.postReleaseChannelDecision === "extend_release_observation";
  const reopenDecision = args.postReleaseChannelDecision === "reopen_release_review";
  const rollbackReady = rollbackDecision ? Boolean(args.rollbackToFreezeReceiptId) : true;
  const extendReady = extendDecision ? Boolean(args.extendedObservationReceiptId) : true;
  const reopenReady = reopenDecision ? Boolean(args.reopenedReleaseReviewTicketId) : true;
  const noticesReady = Boolean(args.customerCorrectionNoticeReceiptId && args.regulatorCorrectionNoticeReceiptId && args.auditorCorrectionNoticeReceiptId);
  const signoffsReady = Boolean(args.legalSignoffReceiptId && args.securitySignoffReceiptId && args.privacySignoffReceiptId);
  const hashesReady = Boolean(args.postReleaseChannelPayloadHash && args.postReleaseChannelTimelineHash);

  const canKeepOpen = Boolean(previousReady && executionReady && channelUnlockReady && monitorReady && rollbackPlanReady && observationReady && lateDriftProbeReady && openDecision && noticesReady && signoffsReady && hashesReady);
  const canRollback = Boolean(previousReady && executionReady && channelUnlockReady && monitorReady && rollbackPlanReady && rollbackDecision && rollbackReady && noticesReady && signoffsReady && hashesReady);
  const canExtend = Boolean(previousReady && executionReady && channelUnlockReady && monitorReady && rollbackPlanReady && observationReady && extendDecision && extendReady && noticesReady && signoffsReady && hashesReady);
  const canReopen = Boolean(previousReady && executionReady && channelUnlockReady && monitorReady && rollbackPlanReady && reopenDecision && reopenReady && noticesReady && signoffsReady && hashesReady);

  const state: Pass2877CustomerExportSupervisoryPostReleaseChannelMonitorRollbackState = !previousReady
    ? "previous_release_eligibility_not_ready"
    : !executionReady
      ? "release_execution_receipt_missing"
      : !channelUnlockReady
        ? "channel_unlock_receipts_missing"
        : !monitorReady
          ? "post_release_monitor_missing"
          : !rollbackPlanReady
            ? "rollback_plan_missing"
            : !observationReady
              ? "release_observation_window_missing"
              : !lateDriftProbeReady
                ? "late_drift_probe_missing"
                : !decisionReady
                  ? "decision_missing"
                  : !rollbackReady
                    ? "rollback_receipt_missing"
                    : !extendReady
                      ? "extended_observation_receipt_missing"
                      : !reopenReady
                        ? "reopened_review_ticket_missing"
                        : !noticesReady
                          ? "notice_receipts_missing"
                          : !signoffsReady
                            ? "signoff_receipts_missing"
                            : !hashesReady
                              ? "payload_or_timeline_hash_missing"
                              : "supervisory_post_release_channel_monitor_rollback_ready";

  const readiness = clamp(
    previousGate.supervisoryStabilityEvidenceRollupReleaseEligibilityReadinessScore +
      (previousReady ? 8 : -55) +
      (executionReady ? 10 : -20) +
      (channelUnlockReady ? 11 : -24) +
      (monitorReady ? 12 : -24) +
      (rollbackPlanReady ? 9 : -18) +
      (observationReady ? 7 : -14) +
      (lateDriftProbeReady ? 8 : -16) +
      (decisionReady ? 7 : -16) +
      (rollbackReady ? 4 : -12) +
      (extendReady ? 4 : -12) +
      (reopenReady ? 4 : -12) +
      (noticesReady ? 8 : -18) +
      (signoffsReady ? 8 : -18) +
      (hashesReady ? 8 : -18)
  );

  return {
    schemaVersion: "pass2877_customer_export_supervisory_post_release_channel_monitor_rollback_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Advanced",
    releasePacketId: "pass2877-customer-export-supervisory-post-release-channel-monitor-rollback",
    sealId: `pass2877-post-release-channel-monitor-rollback-${generatedAt}`,
    generatedAt,
    supervisoryPostReleaseChannelMonitorRollbackState: state,
    supervisoryPostReleaseChannelMonitorRollbackReadinessScore: readiness,
    supervisoryPostReleaseChannelMonitorRollbackEnvelope: {
      previousReleaseEligibilityState: previousGate.supervisoryStabilityEvidenceRollupReleaseEligibilityState,
      previousReleaseEligibilityReadinessScore: previousGate.supervisoryStabilityEvidenceRollupReleaseEligibilityReadinessScore,
      previousCanReleaseArchiveExportChannels: previousReady,
      previousReleaseEligibilityPayloadHash: previousEnvelope.releaseEligibilityPayloadHash,
      previousReleaseEligibilityTimelineHash: previousEnvelope.releaseEligibilityTimelineHash,
      releaseExecutionReceiptId: args.releaseExecutionReceiptId ?? null,
      releaseExecutionRunbookHash: args.releaseExecutionRunbookHash ?? null,
      archiveChannelUnlockReceiptId: args.archiveChannelUnlockReceiptId ?? null,
      exportChannelUnlockReceiptId: args.exportChannelUnlockReceiptId ?? null,
      deliveryChannelUnlockReceiptId: args.deliveryChannelUnlockReceiptId ?? null,
      postReleaseMonitorReceiptId: args.postReleaseMonitorReceiptId ?? null,
      channelHeartbeatReceiptId: args.channelHeartbeatReceiptId ?? null,
      releaseObservationWindowHours: args.releaseObservationWindowHours ?? null,
      rollbackPlanId: args.rollbackPlanId ?? null,
      rollbackPlanHash: args.rollbackPlanHash ?? null,
      lateDriftProbeReceiptId: args.lateDriftProbeReceiptId ?? null,
      lateDriftProbeHash: args.lateDriftProbeHash ?? null,
      releaseDashboardCardId: args.releaseDashboardCardId ?? null,
      postReleaseChannelDecision: args.postReleaseChannelDecision ?? null,
      rollbackToFreezeReceiptId: args.rollbackToFreezeReceiptId ?? null,
      extendedObservationReceiptId: args.extendedObservationReceiptId ?? null,
      reopenedReleaseReviewTicketId: args.reopenedReleaseReviewTicketId ?? null,
      customerCorrectionNoticeReceiptId: args.customerCorrectionNoticeReceiptId ?? null,
      regulatorCorrectionNoticeReceiptId: args.regulatorCorrectionNoticeReceiptId ?? null,
      auditorCorrectionNoticeReceiptId: args.auditorCorrectionNoticeReceiptId ?? null,
      legalSignoffReceiptId: args.legalSignoffReceiptId ?? null,
      securitySignoffReceiptId: args.securitySignoffReceiptId ?? null,
      privacySignoffReceiptId: args.privacySignoffReceiptId ?? null,
      postReleaseChannelPayloadHash: args.postReleaseChannelPayloadHash ?? null,
      postReleaseChannelTimelineHash: args.postReleaseChannelTimelineHash ?? null,
    },
    supervisoryPostReleaseChannelMonitorRollbackPolicy: {
      canKeepArchiveExportDeliveryChannelsOpen: canKeepOpen,
      mustRollbackToFreeze: rollbackDecision || canRollback,
      mustExtendReleaseObservation: extendDecision || canExtend,
      mustReopenReleaseReview: reopenDecision || canReopen,
      canClaimProductionChannelUnlockWorker: false,
      reason: canKeepOpen
        ? "PASS2877 keeps archive/export/delivery channels open only after controlled execution, per-channel unlock receipts, post-release heartbeat, rollback plan, late-drift probe, notices, signoffs and hashes."
        : canRollback
          ? "PASS2877 detected/accepted rollback-to-freeze and keeps channels frozen with rollback proof."
          : canExtend
            ? "PASS2877 extends the release observation window because post-release evidence is not yet final."
            : canReopen
              ? "PASS2877 reopens release review because post-release monitor evidence cannot support open channels."
              : "PASS2877 blocks channel-open claims until release execution, unlock receipts, monitor heartbeat, rollback plan, late-drift probe, notices, signoffs and hashes exist.",
    },
    supervisoryPostReleaseChannelMonitorRollbackRiskSignals: {
      previousReleaseEligibilityNotReady: !previousReady,
      releaseExecutionReceiptMissing: !executionReady,
      channelUnlockReceiptsMissing: !channelUnlockReady,
      postReleaseMonitorMissing: !monitorReady,
      rollbackPlanMissing: !rollbackPlanReady,
      releaseObservationWindowMissing: !observationReady,
      lateDriftProbeMissing: !lateDriftProbeReady,
      decisionMissing: !decisionReady,
      rollbackReceiptMissing: !rollbackReady,
      extendedObservationReceiptMissing: !extendReady,
      reopenedReviewTicketMissing: !reopenReady,
      noticeReceiptsMissing: !noticesReady,
      signoffReceiptsMissing: !signoffsReady,
      payloadHashMissing: !args.postReleaseChannelPayloadHash,
      timelineHashMissing: !args.postReleaseChannelTimelineHash,
    },
    customerSafeCopy: canKeepOpen
      ? "Release channels remain open under post-release heartbeat and late-drift monitoring; rollback proof is already attached if drift returns."
      : "Release channel status remains constrained until post-release execution, monitoring, rollback and notice evidence are complete.",
    operatorNextActions: canKeepOpen
      ? ["Keep channel heartbeat active.", "Run late-drift probes through the observation window.", "Escalate any drift into rollback-to-freeze or release review reopen."]
      : ["Attach release execution and unlock receipts.", "Bind rollback plan and post-release monitor heartbeat.", "Complete correction notices, signoffs and payload/timeline hashes before channel-open claims."],
  };
}
