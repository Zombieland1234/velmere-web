import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionRebaselineGate } from "@/lib/market-integrity/top1-customer-export-supervisory-recurrence-escalation-resolution-rebaseline-gate";

export type Pass2875CustomerExportSupervisoryPostRebaselineStabilityDecision =
  | "keep_hardened_rebaseline"
  | "downgrade_to_permanent_freeze"
  | "reopen_supervisory_investigation";

export type Pass2875CustomerExportSupervisoryPostRebaselineRegressionSignal =
  | "hash_drift_after_rebaseline"
  | "source_root_drift_after_rebaseline"
  | "channel_rebind_after_rebaseline"
  | "late_evidence_after_rebaseline"
  | "watcher_policy_gap"
  | "operator_override_after_rebaseline";

export type Pass2875CustomerExportSupervisoryPostRebaselineStabilityState =
  | "previous_rebaseline_not_ready"
  | "stability_window_missing"
  | "watch_policy_missing"
  | "heartbeat_or_probe_missing"
  | "regression_budget_missing"
  | "post_rebaseline_regression_detected"
  | "enforcement_decision_missing"
  | "downgrade_receipt_missing"
  | "reopened_investigation_ticket_missing"
  | "stability_signoff_missing"
  | "stability_timeline_missing"
  | "supervisory_post_rebaseline_stability_enforcement_ready";

export type Pass2875CustomerExportSupervisoryPostRebaselineStabilityEnforcementGate = {
  schemaVersion: "pass2875_customer_export_supervisory_post_rebaseline_stability_enforcement_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryPostRebaselineStabilityEnforcementState: Pass2875CustomerExportSupervisoryPostRebaselineStabilityState;
  supervisoryPostRebaselineStabilityEnforcementReadinessScore: number;
  supervisoryPostRebaselineStabilityEnforcementEnvelope: {
    previousRecurrenceResolutionState: string;
    previousRecurrenceResolutionReadinessScore: number;
    previousCanResumeReclosedFinalClosureAfterRebaseline: boolean;
    previousHardenedRebaselineIndexId: string | null;
    previousHardenedRebaselineIndexVersion: string | null;
    previousHardenedRebaselineIndexHash: string | null;
    previousWatcherPolicyUpdateReceiptId: string | null;
    previousRecurrenceResolutionPayloadHash: string | null;
    previousRecurrenceResolutionTimelineHash: string | null;
    postRebaselineWatchReceiptId: string | null;
    postRebaselineStabilityWindowHours: number | null;
    stabilityWatchPolicyId: string | null;
    monitorHeartbeatReceiptId: string | null;
    rebaselineProbeReceiptId: string | null;
    regressionBudgetMaxIncidents: number | null;
    observedRegressionSignals: Pass2875CustomerExportSupervisoryPostRebaselineRegressionSignal[];
    enforcementDecision: Pass2875CustomerExportSupervisoryPostRebaselineStabilityDecision | null;
    permanentFreezeDowngradeReceiptId: string | null;
    reopenedSupervisoryInvestigationTicketId: string | null;
    watcherEscalationReceiptId: string | null;
    customerNoticeReceiptId: string | null;
    regulatorNoticeReceiptId: string | null;
    auditorNoticeReceiptId: string | null;
    legalSignoffReceiptId: string | null;
    securitySignoffReceiptId: string | null;
    privacySignoffReceiptId: string | null;
    stabilityEnforcementPayloadHash: string | null;
    stabilityEnforcementTimelineHash: string | null;
  };
  supervisoryPostRebaselineStabilityEnforcementPolicy: {
    canKeepHardenedRebaselineActive: boolean;
    mustDowngradeToPermanentFreeze: boolean;
    mustReopenSupervisoryInvestigation: boolean;
    canClaimProductionPostRebaselineWorker: false;
    reason: string;
  };
  supervisoryPostRebaselineStabilityEnforcementRiskSignals: {
    previousRebaselineNotReady: boolean;
    stabilityWindowMissing: boolean;
    watchPolicyMissing: boolean;
    heartbeatOrProbeMissing: boolean;
    regressionBudgetMissing: boolean;
    postRebaselineRegressionDetected: boolean;
    enforcementDecisionMissing: boolean;
    downgradeReceiptMissing: boolean;
    reopenedInvestigationTicketMissing: boolean;
    noticeReceiptMissing: boolean;
    signoffMissing: boolean;
    payloadHashMissing: boolean;
    timelineHashMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2875_CUSTOMER_EXPORT_SUPERVISORY_POST_REBASELINE_STABILITY_ENFORCEMENT_ACCEPTANCE_GATES = [
  "PASS2875: PASS2874 hardened rebaseline is not stable until a post-rebaseline watch receipt, window, policy and probe receipts are attached.",
  "PASS2875: Any post-rebaseline regression signal must force an explicit enforcement decision before final closure can remain active.",
  "PASS2875: Keeping hardened rebaseline active requires a zero-regression budget outcome, notices, signoffs, payload hash and stability timeline hash.",
  "PASS2875: Downgrade to permanent freeze requires a downgrade receipt and keeps archive/export channels frozen.",
  "PASS2875: Reopened supervisory investigation requires a new investigation ticket and prevents production stability claims.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2875CustomerExportSupervisoryPostRebaselineStabilityEnforcementGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryRecurrenceEscalationResolutionRebaselineGate: Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionRebaselineGate;
  generatedAt?: string;
  postRebaselineWatchReceiptId?: string | null;
  postRebaselineStabilityWindowHours?: number | null;
  stabilityWatchPolicyId?: string | null;
  monitorHeartbeatReceiptId?: string | null;
  rebaselineProbeReceiptId?: string | null;
  regressionBudgetMaxIncidents?: number | null;
  observedRegressionSignals?: Pass2875CustomerExportSupervisoryPostRebaselineRegressionSignal[];
  enforcementDecision?: Pass2875CustomerExportSupervisoryPostRebaselineStabilityDecision | null;
  permanentFreezeDowngradeReceiptId?: string | null;
  reopenedSupervisoryInvestigationTicketId?: string | null;
  watcherEscalationReceiptId?: string | null;
  customerNoticeReceiptId?: string | null;
  regulatorNoticeReceiptId?: string | null;
  auditorNoticeReceiptId?: string | null;
  legalSignoffReceiptId?: string | null;
  securitySignoffReceiptId?: string | null;
  privacySignoffReceiptId?: string | null;
  stabilityEnforcementPayloadHash?: string | null;
  stabilityEnforcementTimelineHash?: string | null;
}): Pass2875CustomerExportSupervisoryPostRebaselineStabilityEnforcementGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousGate = args.customerExportSupervisoryRecurrenceEscalationResolutionRebaselineGate;
  const previousEnvelope = previousGate.supervisoryRecurrenceEscalationResolutionRebaselineEnvelope;
  const previousReady = Boolean(previousGate.supervisoryRecurrenceEscalationResolutionRebaselinePolicy.canResumeReclosedFinalClosureAfterRebaseline);
  const windowReady = Boolean(args.postRebaselineWatchReceiptId && args.postRebaselineStabilityWindowHours && args.postRebaselineStabilityWindowHours > 0);
  const policyReady = Boolean(args.stabilityWatchPolicyId);
  const heartbeatReady = Boolean(args.monitorHeartbeatReceiptId && args.rebaselineProbeReceiptId);
  const budgetReady = typeof args.regressionBudgetMaxIncidents === "number" && args.regressionBudgetMaxIncidents >= 0;
  const observedSignals = args.observedRegressionSignals ?? [];
  const regressionDetected = observedSignals.length > 0;
  const decisionReady = Boolean(args.enforcementDecision);
  const keepActiveDecision = args.enforcementDecision === "keep_hardened_rebaseline";
  const downgradeDecision = args.enforcementDecision === "downgrade_to_permanent_freeze";
  const reopenDecision = args.enforcementDecision === "reopen_supervisory_investigation";
  const downgradeReady = downgradeDecision ? Boolean(args.permanentFreezeDowngradeReceiptId) : true;
  const reopenReady = reopenDecision ? Boolean(args.reopenedSupervisoryInvestigationTicketId) : true;
  const escalationReady = regressionDetected ? Boolean(args.watcherEscalationReceiptId) : true;
  const noticeReady = Boolean(args.customerNoticeReceiptId && args.regulatorNoticeReceiptId && args.auditorNoticeReceiptId);
  const signoffReady = Boolean(args.legalSignoffReceiptId && args.securitySignoffReceiptId && args.privacySignoffReceiptId);
  const timelineReady = Boolean(args.stabilityEnforcementPayloadHash && args.stabilityEnforcementTimelineHash);
  const zeroRegressionWithinBudget = Boolean(!regressionDetected && (args.regressionBudgetMaxIncidents ?? 0) === 0);
  const canKeepActive = Boolean(
    previousReady &&
      windowReady &&
      policyReady &&
      heartbeatReady &&
      budgetReady &&
      keepActiveDecision &&
      zeroRegressionWithinBudget &&
      escalationReady &&
      noticeReady &&
      signoffReady &&
      timelineReady
  );
  const canResolveFreeze = Boolean(
    previousReady && windowReady && policyReady && heartbeatReady && budgetReady && downgradeDecision && downgradeReady && escalationReady && noticeReady && signoffReady && timelineReady
  );
  const canReopen = Boolean(
    previousReady && windowReady && policyReady && heartbeatReady && budgetReady && reopenDecision && reopenReady && escalationReady && noticeReady && signoffReady && timelineReady
  );

  const state: Pass2875CustomerExportSupervisoryPostRebaselineStabilityState = !previousReady
    ? "previous_rebaseline_not_ready"
    : !windowReady
      ? "stability_window_missing"
      : !policyReady
        ? "watch_policy_missing"
        : !heartbeatReady
          ? "heartbeat_or_probe_missing"
          : !budgetReady
            ? "regression_budget_missing"
            : regressionDetected && !args.watcherEscalationReceiptId
              ? "post_rebaseline_regression_detected"
              : !decisionReady
                ? "enforcement_decision_missing"
                : !downgradeReady
                  ? "downgrade_receipt_missing"
                  : !reopenReady
                    ? "reopened_investigation_ticket_missing"
                    : !noticeReady || !signoffReady
                      ? "stability_signoff_missing"
                      : !timelineReady
                        ? "stability_timeline_missing"
                        : "supervisory_post_rebaseline_stability_enforcement_ready";

  const readiness = clamp(
    previousGate.supervisoryRecurrenceEscalationResolutionRebaselineReadinessScore +
      (previousReady ? 9 : -55) +
      (windowReady ? 10 : -22) +
      (policyReady ? 10 : -20) +
      (heartbeatReady ? 10 : -20) +
      (budgetReady ? 8 : -18) +
      (!regressionDetected ? 12 : -26) +
      (decisionReady ? 8 : -18) +
      (downgradeReady ? 5 : -16) +
      (reopenReady ? 5 : -16) +
      (escalationReady ? 6 : -18) +
      (noticeReady ? 8 : -18) +
      (signoffReady ? 10 : -20) +
      (timelineReady ? 9 : -20)
  );

  return {
    schemaVersion: "pass2875_customer_export_supervisory_post_rebaseline_stability_enforcement_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Advanced",
    releasePacketId: "pass2875-customer-export-supervisory-post-rebaseline-stability-enforcement",
    sealId: `pass2875-post-rebaseline-stability-${generatedAt}`,
    generatedAt,
    supervisoryPostRebaselineStabilityEnforcementState: state,
    supervisoryPostRebaselineStabilityEnforcementReadinessScore: readiness,
    supervisoryPostRebaselineStabilityEnforcementEnvelope: {
      previousRecurrenceResolutionState: previousGate.supervisoryRecurrenceEscalationResolutionRebaselineState,
      previousRecurrenceResolutionReadinessScore: previousGate.supervisoryRecurrenceEscalationResolutionRebaselineReadinessScore,
      previousCanResumeReclosedFinalClosureAfterRebaseline: previousReady,
      previousHardenedRebaselineIndexId: previousEnvelope.hardenedRebaselineIndexId,
      previousHardenedRebaselineIndexVersion: previousEnvelope.hardenedRebaselineIndexVersion,
      previousHardenedRebaselineIndexHash: previousEnvelope.hardenedRebaselineIndexHash,
      previousWatcherPolicyUpdateReceiptId: previousEnvelope.watcherPolicyUpdateReceiptId,
      previousRecurrenceResolutionPayloadHash: previousEnvelope.recurrenceResolutionPayloadHash,
      previousRecurrenceResolutionTimelineHash: previousEnvelope.recurrenceResolutionTimelineHash,
      postRebaselineWatchReceiptId: args.postRebaselineWatchReceiptId ?? null,
      postRebaselineStabilityWindowHours: args.postRebaselineStabilityWindowHours ?? null,
      stabilityWatchPolicyId: args.stabilityWatchPolicyId ?? null,
      monitorHeartbeatReceiptId: args.monitorHeartbeatReceiptId ?? null,
      rebaselineProbeReceiptId: args.rebaselineProbeReceiptId ?? null,
      regressionBudgetMaxIncidents: args.regressionBudgetMaxIncidents ?? null,
      observedRegressionSignals: observedSignals,
      enforcementDecision: args.enforcementDecision ?? null,
      permanentFreezeDowngradeReceiptId: args.permanentFreezeDowngradeReceiptId ?? null,
      reopenedSupervisoryInvestigationTicketId: args.reopenedSupervisoryInvestigationTicketId ?? null,
      watcherEscalationReceiptId: args.watcherEscalationReceiptId ?? null,
      customerNoticeReceiptId: args.customerNoticeReceiptId ?? null,
      regulatorNoticeReceiptId: args.regulatorNoticeReceiptId ?? null,
      auditorNoticeReceiptId: args.auditorNoticeReceiptId ?? null,
      legalSignoffReceiptId: args.legalSignoffReceiptId ?? null,
      securitySignoffReceiptId: args.securitySignoffReceiptId ?? null,
      privacySignoffReceiptId: args.privacySignoffReceiptId ?? null,
      stabilityEnforcementPayloadHash: args.stabilityEnforcementPayloadHash ?? null,
      stabilityEnforcementTimelineHash: args.stabilityEnforcementTimelineHash ?? null,
    },
    supervisoryPostRebaselineStabilityEnforcementPolicy: {
      canKeepHardenedRebaselineActive: canKeepActive,
      mustDowngradeToPermanentFreeze: downgradeDecision || (regressionDetected && !reopenDecision),
      mustReopenSupervisoryInvestigation: reopenDecision,
      canClaimProductionPostRebaselineWorker: false,
      reason: canKeepActive
        ? "PASS2875 keeps hardened rebaseline active only after a clean stability window, zero-regression budget, notices, signoffs and timeline proof."
        : canResolveFreeze
          ? "PASS2875 resolves post-rebaseline regression by downgrading to permanent freeze with required receipts."
          : canReopen
            ? "PASS2875 resolves post-rebaseline instability by reopening supervisory investigation with required ticket and notices."
            : "PASS2875 blocks stability claims until post-rebaseline watch, probes, regression budget, enforcement decision, notices, signoffs and hashes exist.",
    },
    supervisoryPostRebaselineStabilityEnforcementRiskSignals: {
      previousRebaselineNotReady: !previousReady,
      stabilityWindowMissing: !windowReady,
      watchPolicyMissing: !policyReady,
      heartbeatOrProbeMissing: !heartbeatReady,
      regressionBudgetMissing: !budgetReady,
      postRebaselineRegressionDetected: regressionDetected,
      enforcementDecisionMissing: !decisionReady,
      downgradeReceiptMissing: !downgradeReady,
      reopenedInvestigationTicketMissing: !reopenReady,
      noticeReceiptMissing: !noticeReady,
      signoffMissing: !signoffReady,
      payloadHashMissing: !args.stabilityEnforcementPayloadHash,
      timelineHashMissing: !args.stabilityEnforcementTimelineHash,
    },
    customerSafeCopy: "PASS2875 makes hardened rebaseline a monitored state, not a final trust claim. If the rebaseline drifts again, Velmère must downgrade to permanent freeze or reopen supervisory investigation with receipts and notices.",
    operatorNextActions: canKeepActive
      ? ["Keep PASS2875 stability SLO watch active and preserve post-rebaseline stability receipts with the final evidence index."]
      : ["Attach post-rebaseline watch/probe receipts, regression budget and enforcement decision.", "Do not claim a stable hardened rebaseline until PASS2875 notices, signoffs and timeline hash pass."],
  };
}
