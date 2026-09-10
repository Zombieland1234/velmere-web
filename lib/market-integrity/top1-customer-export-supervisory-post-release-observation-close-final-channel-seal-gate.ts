import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2877CustomerExportSupervisoryPostReleaseChannelMonitorRollbackGate } from "@/lib/market-integrity/top1-customer-export-supervisory-post-release-channel-monitor-rollback-gate";

export type Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealDecision =
  | "seal_channels_open"
  | "rollback_to_freeze"
  | "extend_observation"
  | "reopen_release_review";

export type Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealState =
  | "previous_post_release_monitor_not_ready"
  | "observation_close_receipt_missing"
  | "heartbeat_rollup_missing"
  | "drift_probe_rollup_missing"
  | "final_channel_seal_missing"
  | "rollback_plan_retention_lock_missing"
  | "final_dashboard_snapshot_missing"
  | "decision_missing"
  | "rollback_receipt_missing"
  | "extended_observation_receipt_missing"
  | "reopened_review_ticket_missing"
  | "final_notice_receipts_missing"
  | "signoff_receipts_missing"
  | "payload_or_timeline_hash_missing"
  | "supervisory_post_release_observation_close_final_channel_seal_ready";

export type Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealGate = {
  schemaVersion: "pass2878_customer_export_supervisory_post_release_observation_close_final_channel_seal_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryPostReleaseObservationCloseFinalChannelSealState: Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealState;
  supervisoryPostReleaseObservationCloseFinalChannelSealReadinessScore: number;
  supervisoryPostReleaseObservationCloseFinalChannelSealEnvelope: {
    previousPostReleaseChannelState: string;
    previousPostReleaseChannelReadinessScore: number;
    previousCanKeepArchiveExportDeliveryChannelsOpen: boolean;
    previousPostReleaseChannelPayloadHash: string | null;
    previousPostReleaseChannelTimelineHash: string | null;
    observationCloseReceiptId: string | null;
    observationWindowClosedAt: string | null;
    heartbeatRollupReceiptId: string | null;
    heartbeatRollupHash: string | null;
    driftProbeRollupReceiptId: string | null;
    driftProbeRollupHash: string | null;
    finalChannelSealReceiptId: string | null;
    finalChannelSealHash: string | null;
    rollbackPlanRetentionLockReceiptId: string | null;
    rollbackPlanRetentionHash: string | null;
    finalReleaseDashboardSnapshotId: string | null;
    finalReleaseDashboardSnapshotHash: string | null;
    observationCloseDecision: Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealDecision | null;
    rollbackToFreezeReceiptId: string | null;
    extendedObservationReceiptId: string | null;
    reopenedReleaseReviewTicketId: string | null;
    customerFinalObservationNoticeReceiptId: string | null;
    regulatorFinalObservationNoticeReceiptId: string | null;
    auditorFinalObservationNoticeReceiptId: string | null;
    legalSignoffReceiptId: string | null;
    securitySignoffReceiptId: string | null;
    privacySignoffReceiptId: string | null;
    finalChannelSealPayloadHash: string | null;
    finalChannelSealTimelineHash: string | null;
  };
  supervisoryPostReleaseObservationCloseFinalChannelSealPolicy: {
    canSealArchiveExportDeliveryChannelsOpen: boolean;
    mustRollbackToFreeze: boolean;
    mustExtendObservation: boolean;
    mustReopenReleaseReview: boolean;
    canClaimProductionFinalChannelSealWorker: false;
    reason: string;
  };
  supervisoryPostReleaseObservationCloseFinalChannelSealRiskSignals: {
    previousPostReleaseMonitorNotReady: boolean;
    observationCloseReceiptMissing: boolean;
    heartbeatRollupMissing: boolean;
    driftProbeRollupMissing: boolean;
    finalChannelSealMissing: boolean;
    rollbackPlanRetentionLockMissing: boolean;
    finalDashboardSnapshotMissing: boolean;
    decisionMissing: boolean;
    rollbackReceiptMissing: boolean;
    extendedObservationReceiptMissing: boolean;
    reopenedReviewTicketMissing: boolean;
    finalNoticeReceiptsMissing: boolean;
    signoffReceiptsMissing: boolean;
    payloadHashMissing: boolean;
    timelineHashMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2878_CUSTOMER_EXPORT_SUPERVISORY_POST_RELEASE_OBSERVATION_CLOSE_FINAL_CHANNEL_SEAL_ACCEPTANCE_GATES = [
  "PASS2878: PASS2877 post-release monitor is not final channel sealing; the observation window must be explicitly closed with evidence.",
  "PASS2878: Final channel seal requires heartbeat rollup, drift-probe rollup, final dashboard snapshot and rollback-plan retention lock.",
  "PASS2878: Observation close must choose seal-open, rollback-to-freeze, extend-observation or reopen-release-review with matching receipts/tickets.",
  "PASS2878: Customer/regulator/auditor final observation notices and legal/security/privacy signoff are required before final channel seal.",
  "PASS2878: This is deterministic contract evidence only; production still requires durable observation-close workers, live dashboards and real notice delivery.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryPostReleaseChannelMonitorRollbackGate: Pass2877CustomerExportSupervisoryPostReleaseChannelMonitorRollbackGate;
  generatedAt?: string;
  observationCloseReceiptId?: string | null;
  observationWindowClosedAt?: string | null;
  heartbeatRollupReceiptId?: string | null;
  heartbeatRollupHash?: string | null;
  driftProbeRollupReceiptId?: string | null;
  driftProbeRollupHash?: string | null;
  finalChannelSealReceiptId?: string | null;
  finalChannelSealHash?: string | null;
  rollbackPlanRetentionLockReceiptId?: string | null;
  rollbackPlanRetentionHash?: string | null;
  finalReleaseDashboardSnapshotId?: string | null;
  finalReleaseDashboardSnapshotHash?: string | null;
  observationCloseDecision?: Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealDecision | null;
  rollbackToFreezeReceiptId?: string | null;
  extendedObservationReceiptId?: string | null;
  reopenedReleaseReviewTicketId?: string | null;
  customerFinalObservationNoticeReceiptId?: string | null;
  regulatorFinalObservationNoticeReceiptId?: string | null;
  auditorFinalObservationNoticeReceiptId?: string | null;
  legalSignoffReceiptId?: string | null;
  securitySignoffReceiptId?: string | null;
  privacySignoffReceiptId?: string | null;
  finalChannelSealPayloadHash?: string | null;
  finalChannelSealTimelineHash?: string | null;
}): Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousGate = args.customerExportSupervisoryPostReleaseChannelMonitorRollbackGate;
  const previousEnvelope = previousGate.supervisoryPostReleaseChannelMonitorRollbackEnvelope;
  const previousReady = Boolean(previousGate.supervisoryPostReleaseChannelMonitorRollbackPolicy.canKeepArchiveExportDeliveryChannelsOpen);

  const observationCloseReady = Boolean(args.observationCloseReceiptId && args.observationWindowClosedAt);
  const heartbeatRollupReady = Boolean(args.heartbeatRollupReceiptId && args.heartbeatRollupHash);
  const driftProbeRollupReady = Boolean(args.driftProbeRollupReceiptId && args.driftProbeRollupHash);
  const finalSealReady = Boolean(args.finalChannelSealReceiptId && args.finalChannelSealHash);
  const rollbackRetentionReady = Boolean(args.rollbackPlanRetentionLockReceiptId && args.rollbackPlanRetentionHash);
  const dashboardSnapshotReady = Boolean(args.finalReleaseDashboardSnapshotId && args.finalReleaseDashboardSnapshotHash);
  const decisionReady = Boolean(args.observationCloseDecision);
  const sealOpenDecision = args.observationCloseDecision === "seal_channels_open";
  const rollbackDecision = args.observationCloseDecision === "rollback_to_freeze";
  const extendDecision = args.observationCloseDecision === "extend_observation";
  const reopenDecision = args.observationCloseDecision === "reopen_release_review";
  const rollbackReady = rollbackDecision ? Boolean(args.rollbackToFreezeReceiptId) : true;
  const extendReady = extendDecision ? Boolean(args.extendedObservationReceiptId) : true;
  const reopenReady = reopenDecision ? Boolean(args.reopenedReleaseReviewTicketId) : true;
  const noticesReady = Boolean(args.customerFinalObservationNoticeReceiptId && args.regulatorFinalObservationNoticeReceiptId && args.auditorFinalObservationNoticeReceiptId);
  const signoffsReady = Boolean(args.legalSignoffReceiptId && args.securitySignoffReceiptId && args.privacySignoffReceiptId);
  const hashesReady = Boolean(args.finalChannelSealPayloadHash && args.finalChannelSealTimelineHash);

  const canSealOpen = Boolean(previousReady && observationCloseReady && heartbeatRollupReady && driftProbeRollupReady && finalSealReady && rollbackRetentionReady && dashboardSnapshotReady && sealOpenDecision && noticesReady && signoffsReady && hashesReady);
  const canRollback = Boolean(previousReady && observationCloseReady && heartbeatRollupReady && driftProbeRollupReady && rollbackDecision && rollbackReady && noticesReady && signoffsReady && hashesReady);
  const canExtend = Boolean(previousReady && observationCloseReady && heartbeatRollupReady && driftProbeRollupReady && extendDecision && extendReady && noticesReady && signoffsReady && hashesReady);
  const canReopen = Boolean(previousReady && observationCloseReady && heartbeatRollupReady && driftProbeRollupReady && reopenDecision && reopenReady && noticesReady && signoffsReady && hashesReady);

  const state: Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealState = !previousReady
    ? "previous_post_release_monitor_not_ready"
    : !observationCloseReady
      ? "observation_close_receipt_missing"
      : !heartbeatRollupReady
        ? "heartbeat_rollup_missing"
        : !driftProbeRollupReady
          ? "drift_probe_rollup_missing"
          : !finalSealReady
            ? "final_channel_seal_missing"
            : !rollbackRetentionReady
              ? "rollback_plan_retention_lock_missing"
              : !dashboardSnapshotReady
                ? "final_dashboard_snapshot_missing"
                : !decisionReady
                  ? "decision_missing"
                  : !rollbackReady
                    ? "rollback_receipt_missing"
                    : !extendReady
                      ? "extended_observation_receipt_missing"
                      : !reopenReady
                        ? "reopened_review_ticket_missing"
                        : !noticesReady
                          ? "final_notice_receipts_missing"
                          : !signoffsReady
                            ? "signoff_receipts_missing"
                            : !hashesReady
                              ? "payload_or_timeline_hash_missing"
                              : "supervisory_post_release_observation_close_final_channel_seal_ready";

  const readiness = clamp(
    previousGate.supervisoryPostReleaseChannelMonitorRollbackReadinessScore +
      (previousReady ? 8 : -55) +
      (observationCloseReady ? 10 : -22) +
      (heartbeatRollupReady ? 10 : -20) +
      (driftProbeRollupReady ? 10 : -20) +
      (finalSealReady ? 12 : -24) +
      (rollbackRetentionReady ? 8 : -16) +
      (dashboardSnapshotReady ? 8 : -16) +
      (decisionReady ? 7 : -16) +
      (rollbackReady ? 4 : -12) +
      (extendReady ? 4 : -12) +
      (reopenReady ? 4 : -12) +
      (noticesReady ? 8 : -18) +
      (signoffsReady ? 8 : -18) +
      (hashesReady ? 8 : -18)
  );

  return {
    schemaVersion: "pass2878_customer_export_supervisory_post_release_observation_close_final_channel_seal_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Advanced",
    releasePacketId: "pass2878-customer-export-supervisory-post-release-observation-close-final-channel-seal",
    sealId: `pass2878-post-release-observation-close-final-channel-seal-${generatedAt}`,
    generatedAt,
    supervisoryPostReleaseObservationCloseFinalChannelSealState: state,
    supervisoryPostReleaseObservationCloseFinalChannelSealReadinessScore: readiness,
    supervisoryPostReleaseObservationCloseFinalChannelSealEnvelope: {
      previousPostReleaseChannelState: previousGate.supervisoryPostReleaseChannelMonitorRollbackState,
      previousPostReleaseChannelReadinessScore: previousGate.supervisoryPostReleaseChannelMonitorRollbackReadinessScore,
      previousCanKeepArchiveExportDeliveryChannelsOpen: previousReady,
      previousPostReleaseChannelPayloadHash: previousEnvelope.postReleaseChannelPayloadHash,
      previousPostReleaseChannelTimelineHash: previousEnvelope.postReleaseChannelTimelineHash,
      observationCloseReceiptId: args.observationCloseReceiptId ?? null,
      observationWindowClosedAt: args.observationWindowClosedAt ?? null,
      heartbeatRollupReceiptId: args.heartbeatRollupReceiptId ?? null,
      heartbeatRollupHash: args.heartbeatRollupHash ?? null,
      driftProbeRollupReceiptId: args.driftProbeRollupReceiptId ?? null,
      driftProbeRollupHash: args.driftProbeRollupHash ?? null,
      finalChannelSealReceiptId: args.finalChannelSealReceiptId ?? null,
      finalChannelSealHash: args.finalChannelSealHash ?? null,
      rollbackPlanRetentionLockReceiptId: args.rollbackPlanRetentionLockReceiptId ?? null,
      rollbackPlanRetentionHash: args.rollbackPlanRetentionHash ?? null,
      finalReleaseDashboardSnapshotId: args.finalReleaseDashboardSnapshotId ?? null,
      finalReleaseDashboardSnapshotHash: args.finalReleaseDashboardSnapshotHash ?? null,
      observationCloseDecision: args.observationCloseDecision ?? null,
      rollbackToFreezeReceiptId: args.rollbackToFreezeReceiptId ?? null,
      extendedObservationReceiptId: args.extendedObservationReceiptId ?? null,
      reopenedReleaseReviewTicketId: args.reopenedReleaseReviewTicketId ?? null,
      customerFinalObservationNoticeReceiptId: args.customerFinalObservationNoticeReceiptId ?? null,
      regulatorFinalObservationNoticeReceiptId: args.regulatorFinalObservationNoticeReceiptId ?? null,
      auditorFinalObservationNoticeReceiptId: args.auditorFinalObservationNoticeReceiptId ?? null,
      legalSignoffReceiptId: args.legalSignoffReceiptId ?? null,
      securitySignoffReceiptId: args.securitySignoffReceiptId ?? null,
      privacySignoffReceiptId: args.privacySignoffReceiptId ?? null,
      finalChannelSealPayloadHash: args.finalChannelSealPayloadHash ?? null,
      finalChannelSealTimelineHash: args.finalChannelSealTimelineHash ?? null,
    },
    supervisoryPostReleaseObservationCloseFinalChannelSealPolicy: {
      canSealArchiveExportDeliveryChannelsOpen: canSealOpen,
      mustRollbackToFreeze: canRollback,
      mustExtendObservation: canExtend,
      mustReopenReleaseReview: canReopen,
      canClaimProductionFinalChannelSealWorker: false,
      reason: canSealOpen
        ? "Post-release observation window is closed, heartbeat/probe rollups are clean and archive/export/delivery channels are sealed open with final evidence."
        : canRollback
          ? "Observation close selected rollback-to-freeze with matching receipt; channel seal remains blocked."
          : canExtend
            ? "Observation close selected extended observation; channel final seal remains pending."
            : canReopen
              ? "Observation close reopened release review; channel final seal remains blocked."
              : "Final channel seal is blocked until observation close, rollups, seal proof, notices, signoffs and hashes are complete.",
    },
    supervisoryPostReleaseObservationCloseFinalChannelSealRiskSignals: {
      previousPostReleaseMonitorNotReady: !previousReady,
      observationCloseReceiptMissing: !observationCloseReady,
      heartbeatRollupMissing: !heartbeatRollupReady,
      driftProbeRollupMissing: !driftProbeRollupReady,
      finalChannelSealMissing: !finalSealReady,
      rollbackPlanRetentionLockMissing: !rollbackRetentionReady,
      finalDashboardSnapshotMissing: !dashboardSnapshotReady,
      decisionMissing: !decisionReady,
      rollbackReceiptMissing: !rollbackReady,
      extendedObservationReceiptMissing: !extendReady,
      reopenedReviewTicketMissing: !reopenReady,
      finalNoticeReceiptsMissing: !noticesReady,
      signoffReceiptsMissing: !signoffsReady,
      payloadHashMissing: !args.finalChannelSealPayloadHash,
      timelineHashMissing: !args.finalChannelSealTimelineHash,
    },
    customerSafeCopy:
      "Velmere separates post-release monitoring from final channel sealing. Archive/export/delivery channels are not treated as finally safe until observation is closed, heartbeat and drift probes are rolled up, final notices are issued and legal/security/privacy signoff is recorded.",
    operatorNextActions: canSealOpen
      ? ["Retain final channel seal package", "Keep lightweight post-seal drift monitoring active", "Prepare production worker evidence before launch claims"]
      : ["Close observation window with receipt", "Attach heartbeat and drift-probe rollups", "Record final seal/rollback/extend/reopen decision", "Collect final notices and signoffs"],
  };
}
