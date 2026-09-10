import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2875CustomerExportSupervisoryPostRebaselineStabilityEnforcementGate } from "@/lib/market-integrity/top1-customer-export-supervisory-post-rebaseline-stability-enforcement-gate";

export type Pass2876CustomerExportSupervisoryReleaseEligibilityDecision =
  | "release_archive_export_channels"
  | "extend_stability_watch"
  | "downgrade_to_permanent_freeze"
  | "reopen_supervisory_investigation";

export type Pass2876CustomerExportSupervisoryStabilityEvidenceRollupState =
  | "previous_stability_enforcement_not_ready"
  | "evidence_rollup_missing"
  | "operator_dashboard_missing"
  | "slo_burndown_missing"
  | "release_eligibility_decision_missing"
  | "release_receipts_missing"
  | "extended_watch_receipt_missing"
  | "permanent_freeze_receipt_missing"
  | "reopened_investigation_ticket_missing"
  | "notice_receipts_missing"
  | "signoff_receipts_missing"
  | "payload_or_timeline_hash_missing"
  | "supervisory_stability_evidence_rollup_release_eligibility_ready";

export type Pass2876CustomerExportSupervisoryStabilityEvidenceRollupReleaseEligibilityGate = {
  schemaVersion: "pass2876_customer_export_supervisory_stability_evidence_rollup_release_eligibility_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryStabilityEvidenceRollupReleaseEligibilityState: Pass2876CustomerExportSupervisoryStabilityEvidenceRollupState;
  supervisoryStabilityEvidenceRollupReleaseEligibilityReadinessScore: number;
  supervisoryStabilityEvidenceRollupReleaseEligibilityEnvelope: {
    previousStabilityEnforcementState: string;
    previousStabilityEnforcementReadinessScore: number;
    previousCanKeepHardenedRebaselineActive: boolean;
    previousStabilityEnforcementPayloadHash: string | null;
    previousStabilityEnforcementTimelineHash: string | null;
    stabilityEvidenceRollupId: string | null;
    stabilityEvidenceRollupVersion: string | null;
    stabilityEvidenceRollupHash: string | null;
    operatorDashboardCardId: string | null;
    operatorDashboardSnapshotHash: string | null;
    driftBudgetBurndownHash: string | null;
    stabilitySloBreachCardId: string | null;
    finalStabilityWindowHours: number | null;
    zeroRegressionAttestationReceiptId: string | null;
    releaseEligibilityAssessmentReceiptId: string | null;
    releaseEligibilityDecision: Pass2876CustomerExportSupervisoryReleaseEligibilityDecision | null;
    archiveChannelReleaseReceiptId: string | null;
    exportChannelReleaseReceiptId: string | null;
    deliveryChannelReleaseReceiptId: string | null;
    extendedWatchReceiptId: string | null;
    permanentFreezeReceiptId: string | null;
    reopenedSupervisoryInvestigationTicketId: string | null;
    customerNoticeReceiptId: string | null;
    regulatorNoticeReceiptId: string | null;
    auditorNoticeReceiptId: string | null;
    legalSignoffReceiptId: string | null;
    securitySignoffReceiptId: string | null;
    privacySignoffReceiptId: string | null;
    releaseEligibilityPayloadHash: string | null;
    releaseEligibilityTimelineHash: string | null;
  };
  supervisoryStabilityEvidenceRollupReleaseEligibilityPolicy: {
    canReleaseArchiveExportChannels: boolean;
    mustExtendStabilityWatch: boolean;
    mustKeepPermanentFreeze: boolean;
    mustReopenSupervisoryInvestigation: boolean;
    canClaimProductionOperatorDashboardWorker: false;
    reason: string;
  };
  supervisoryStabilityEvidenceRollupReleaseEligibilityRiskSignals: {
    previousStabilityEnforcementNotReady: boolean;
    evidenceRollupMissing: boolean;
    operatorDashboardMissing: boolean;
    sloBurndownMissing: boolean;
    releaseEligibilityDecisionMissing: boolean;
    releaseReceiptsMissing: boolean;
    extendedWatchReceiptMissing: boolean;
    permanentFreezeReceiptMissing: boolean;
    reopenedInvestigationTicketMissing: boolean;
    noticeReceiptsMissing: boolean;
    signoffReceiptsMissing: boolean;
    payloadHashMissing: boolean;
    timelineHashMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2876_CUSTOMER_EXPORT_SUPERVISORY_STABILITY_EVIDENCE_ROLLUP_RELEASE_ELIGIBILITY_ACCEPTANCE_GATES = [
  "PASS2876: PASS2875 stability enforcement is not the same as release eligibility; an evidence rollup and operator dashboard snapshot are required.",
  "PASS2876: Release eligibility requires drift-budget burndown, zero-regression attestation and a release assessment receipt.",
  "PASS2876: Archive/export/delivery channels cannot reopen without explicit channel release receipts and legal/security/privacy signoff.",
  "PASS2876: Extend-watch, permanent-freeze and reopened-investigation outcomes require separate receipts or tickets.",
  "PASS2876: This is deterministic contract evidence only; production still requires durable dashboard jobs, storage, alerting and migrations.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2876CustomerExportSupervisoryStabilityEvidenceRollupReleaseEligibilityGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryPostRebaselineStabilityEnforcementGate: Pass2875CustomerExportSupervisoryPostRebaselineStabilityEnforcementGate;
  generatedAt?: string;
  stabilityEvidenceRollupId?: string | null;
  stabilityEvidenceRollupVersion?: string | null;
  stabilityEvidenceRollupHash?: string | null;
  operatorDashboardCardId?: string | null;
  operatorDashboardSnapshotHash?: string | null;
  driftBudgetBurndownHash?: string | null;
  stabilitySloBreachCardId?: string | null;
  finalStabilityWindowHours?: number | null;
  zeroRegressionAttestationReceiptId?: string | null;
  releaseEligibilityAssessmentReceiptId?: string | null;
  releaseEligibilityDecision?: Pass2876CustomerExportSupervisoryReleaseEligibilityDecision | null;
  archiveChannelReleaseReceiptId?: string | null;
  exportChannelReleaseReceiptId?: string | null;
  deliveryChannelReleaseReceiptId?: string | null;
  extendedWatchReceiptId?: string | null;
  permanentFreezeReceiptId?: string | null;
  reopenedSupervisoryInvestigationTicketId?: string | null;
  customerNoticeReceiptId?: string | null;
  regulatorNoticeReceiptId?: string | null;
  auditorNoticeReceiptId?: string | null;
  legalSignoffReceiptId?: string | null;
  securitySignoffReceiptId?: string | null;
  privacySignoffReceiptId?: string | null;
  releaseEligibilityPayloadHash?: string | null;
  releaseEligibilityTimelineHash?: string | null;
}): Pass2876CustomerExportSupervisoryStabilityEvidenceRollupReleaseEligibilityGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousGate = args.customerExportSupervisoryPostRebaselineStabilityEnforcementGate;
  const previousEnvelope = previousGate.supervisoryPostRebaselineStabilityEnforcementEnvelope;
  const previousReady = Boolean(previousGate.supervisoryPostRebaselineStabilityEnforcementPolicy.canKeepHardenedRebaselineActive);
  const evidenceRollupReady = Boolean(args.stabilityEvidenceRollupId && args.stabilityEvidenceRollupVersion && args.stabilityEvidenceRollupHash);
  const dashboardReady = Boolean(args.operatorDashboardCardId && args.operatorDashboardSnapshotHash);
  const sloReady = Boolean(args.driftBudgetBurndownHash && args.finalStabilityWindowHours && args.finalStabilityWindowHours > 0 && args.zeroRegressionAttestationReceiptId && args.releaseEligibilityAssessmentReceiptId);
  const decisionReady = Boolean(args.releaseEligibilityDecision);
  const releaseDecision = args.releaseEligibilityDecision === "release_archive_export_channels";
  const extendWatchDecision = args.releaseEligibilityDecision === "extend_stability_watch";
  const permanentFreezeDecision = args.releaseEligibilityDecision === "downgrade_to_permanent_freeze";
  const reopenDecision = args.releaseEligibilityDecision === "reopen_supervisory_investigation";
  const releaseReceiptsReady = releaseDecision ? Boolean(args.archiveChannelReleaseReceiptId && args.exportChannelReleaseReceiptId && args.deliveryChannelReleaseReceiptId) : true;
  const extendedWatchReady = extendWatchDecision ? Boolean(args.extendedWatchReceiptId) : true;
  const permanentFreezeReady = permanentFreezeDecision ? Boolean(args.permanentFreezeReceiptId) : true;
  const reopenReady = reopenDecision ? Boolean(args.reopenedSupervisoryInvestigationTicketId) : true;
  const noticeReady = Boolean(args.customerNoticeReceiptId && args.regulatorNoticeReceiptId && args.auditorNoticeReceiptId);
  const signoffReady = Boolean(args.legalSignoffReceiptId && args.securitySignoffReceiptId && args.privacySignoffReceiptId);
  const timelineReady = Boolean(args.releaseEligibilityPayloadHash && args.releaseEligibilityTimelineHash);

  const canRelease = Boolean(previousReady && evidenceRollupReady && dashboardReady && sloReady && releaseDecision && releaseReceiptsReady && noticeReady && signoffReady && timelineReady);
  const canExtendWatch = Boolean(previousReady && evidenceRollupReady && dashboardReady && sloReady && extendWatchDecision && extendedWatchReady && noticeReady && signoffReady && timelineReady);
  const canPermanentFreeze = Boolean(previousReady && evidenceRollupReady && dashboardReady && permanentFreezeDecision && permanentFreezeReady && noticeReady && signoffReady && timelineReady);
  const canReopen = Boolean(previousReady && evidenceRollupReady && dashboardReady && reopenDecision && reopenReady && noticeReady && signoffReady && timelineReady);

  const state: Pass2876CustomerExportSupervisoryStabilityEvidenceRollupState = !previousReady
    ? "previous_stability_enforcement_not_ready"
    : !evidenceRollupReady
      ? "evidence_rollup_missing"
      : !dashboardReady
        ? "operator_dashboard_missing"
        : !sloReady
          ? "slo_burndown_missing"
          : !decisionReady
            ? "release_eligibility_decision_missing"
            : !releaseReceiptsReady
              ? "release_receipts_missing"
              : !extendedWatchReady
                ? "extended_watch_receipt_missing"
                : !permanentFreezeReady
                  ? "permanent_freeze_receipt_missing"
                  : !reopenReady
                    ? "reopened_investigation_ticket_missing"
                    : !noticeReady
                      ? "notice_receipts_missing"
                      : !signoffReady
                        ? "signoff_receipts_missing"
                        : !timelineReady
                          ? "payload_or_timeline_hash_missing"
                          : "supervisory_stability_evidence_rollup_release_eligibility_ready";

  const readiness = clamp(
    previousGate.supervisoryPostRebaselineStabilityEnforcementReadinessScore +
      (previousReady ? 9 : -60) +
      (evidenceRollupReady ? 11 : -24) +
      (dashboardReady ? 10 : -22) +
      (sloReady ? 12 : -24) +
      (decisionReady ? 8 : -18) +
      (releaseReceiptsReady ? 7 : -18) +
      (extendedWatchReady ? 4 : -12) +
      (permanentFreezeReady ? 4 : -12) +
      (reopenReady ? 4 : -12) +
      (noticeReady ? 9 : -18) +
      (signoffReady ? 10 : -20) +
      (timelineReady ? 8 : -18)
  );

  return {
    schemaVersion: "pass2876_customer_export_supervisory_stability_evidence_rollup_release_eligibility_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Advanced",
    releasePacketId: "pass2876-customer-export-supervisory-stability-evidence-rollup-release-eligibility",
    sealId: `pass2876-stability-evidence-rollup-release-eligibility-${generatedAt}`,
    generatedAt,
    supervisoryStabilityEvidenceRollupReleaseEligibilityState: state,
    supervisoryStabilityEvidenceRollupReleaseEligibilityReadinessScore: readiness,
    supervisoryStabilityEvidenceRollupReleaseEligibilityEnvelope: {
      previousStabilityEnforcementState: previousGate.supervisoryPostRebaselineStabilityEnforcementState,
      previousStabilityEnforcementReadinessScore: previousGate.supervisoryPostRebaselineStabilityEnforcementReadinessScore,
      previousCanKeepHardenedRebaselineActive: previousReady,
      previousStabilityEnforcementPayloadHash: previousEnvelope.stabilityEnforcementPayloadHash,
      previousStabilityEnforcementTimelineHash: previousEnvelope.stabilityEnforcementTimelineHash,
      stabilityEvidenceRollupId: args.stabilityEvidenceRollupId ?? null,
      stabilityEvidenceRollupVersion: args.stabilityEvidenceRollupVersion ?? null,
      stabilityEvidenceRollupHash: args.stabilityEvidenceRollupHash ?? null,
      operatorDashboardCardId: args.operatorDashboardCardId ?? null,
      operatorDashboardSnapshotHash: args.operatorDashboardSnapshotHash ?? null,
      driftBudgetBurndownHash: args.driftBudgetBurndownHash ?? null,
      stabilitySloBreachCardId: args.stabilitySloBreachCardId ?? null,
      finalStabilityWindowHours: args.finalStabilityWindowHours ?? null,
      zeroRegressionAttestationReceiptId: args.zeroRegressionAttestationReceiptId ?? null,
      releaseEligibilityAssessmentReceiptId: args.releaseEligibilityAssessmentReceiptId ?? null,
      releaseEligibilityDecision: args.releaseEligibilityDecision ?? null,
      archiveChannelReleaseReceiptId: args.archiveChannelReleaseReceiptId ?? null,
      exportChannelReleaseReceiptId: args.exportChannelReleaseReceiptId ?? null,
      deliveryChannelReleaseReceiptId: args.deliveryChannelReleaseReceiptId ?? null,
      extendedWatchReceiptId: args.extendedWatchReceiptId ?? null,
      permanentFreezeReceiptId: args.permanentFreezeReceiptId ?? null,
      reopenedSupervisoryInvestigationTicketId: args.reopenedSupervisoryInvestigationTicketId ?? null,
      customerNoticeReceiptId: args.customerNoticeReceiptId ?? null,
      regulatorNoticeReceiptId: args.regulatorNoticeReceiptId ?? null,
      auditorNoticeReceiptId: args.auditorNoticeReceiptId ?? null,
      legalSignoffReceiptId: args.legalSignoffReceiptId ?? null,
      securitySignoffReceiptId: args.securitySignoffReceiptId ?? null,
      privacySignoffReceiptId: args.privacySignoffReceiptId ?? null,
      releaseEligibilityPayloadHash: args.releaseEligibilityPayloadHash ?? null,
      releaseEligibilityTimelineHash: args.releaseEligibilityTimelineHash ?? null,
    },
    supervisoryStabilityEvidenceRollupReleaseEligibilityPolicy: {
      canReleaseArchiveExportChannels: canRelease,
      mustExtendStabilityWatch: extendWatchDecision || canExtendWatch,
      mustKeepPermanentFreeze: permanentFreezeDecision || canPermanentFreeze,
      mustReopenSupervisoryInvestigation: reopenDecision || canReopen,
      canClaimProductionOperatorDashboardWorker: false,
      reason: canRelease
        ? "PASS2876 allows archive/export/delivery channel release only after evidence rollup, operator dashboard snapshot, SLO burndown, zero-regression attestation, notices, signoffs and release receipts."
        : canExtendWatch
          ? "PASS2876 keeps channels constrained and extends the stability watch with required receipts."
          : canPermanentFreeze
            ? "PASS2876 downgrades unresolved stability concerns to permanent freeze with required receipts."
            : canReopen
              ? "PASS2876 reopens supervisory investigation because stability evidence is not release-eligible."
              : "PASS2876 blocks release eligibility until evidence rollup, dashboard summary, SLO burndown, explicit decision, notices, signoffs and hashes exist.",
    },
    supervisoryStabilityEvidenceRollupReleaseEligibilityRiskSignals: {
      previousStabilityEnforcementNotReady: !previousReady,
      evidenceRollupMissing: !evidenceRollupReady,
      operatorDashboardMissing: !dashboardReady,
      sloBurndownMissing: !sloReady,
      releaseEligibilityDecisionMissing: !decisionReady,
      releaseReceiptsMissing: !releaseReceiptsReady,
      extendedWatchReceiptMissing: !extendedWatchReady,
      permanentFreezeReceiptMissing: !permanentFreezeReady,
      reopenedInvestigationTicketMissing: !reopenReady,
      noticeReceiptsMissing: !noticeReady,
      signoffReceiptsMissing: !signoffReady,
      payloadHashMissing: !args.releaseEligibilityPayloadHash,
      timelineHashMissing: !args.releaseEligibilityTimelineHash,
    },
    customerSafeCopy: "PASS2876 turns post-rebaseline stability into a release-eligibility packet. Velmère cannot reopen archive/export/delivery channels unless the stability evidence rollup, operator dashboard snapshot, notices, signoffs and release receipts are all bound to the same timeline hash.",
    operatorNextActions: canRelease
      ? ["Preserve PASS2876 release eligibility packet with the final evidence index and keep dashboard monitoring enabled after channel release."]
      : ["Attach stability evidence rollup, dashboard snapshot and SLO burndown before release.", "Do not reopen archive/export/delivery channels until PASS2876 release receipts and signoffs are present."],
  };
}
