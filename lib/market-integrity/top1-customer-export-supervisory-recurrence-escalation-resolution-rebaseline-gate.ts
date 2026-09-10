import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2873CustomerExportSupervisoryPostRecloseRegressionSloGate } from "@/lib/market-integrity/top1-customer-export-supervisory-post-reclose-regression-slo-gate";

export type Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionDecision =
  | "hardened_rebaseline"
  | "permanent_freeze"
  | "reopen_supervisory_investigation";

export type Pass2874CustomerExportSupervisoryRecurrenceFamily =
  | "repeat_hash_drift"
  | "repeat_channel_rebind"
  | "repeat_reindex"
  | "repeat_late_evidence_drift"
  | "watcher_gap_recurrence"
  | "mixed_recurrence";

export type Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionState =
  | "previous_regression_slo_not_ready"
  | "recurrence_case_missing"
  | "root_cause_or_impact_scope_missing"
  | "resolution_decision_missing"
  | "hardened_rebaseline_missing"
  | "permanent_freeze_receipt_missing"
  | "reopened_investigation_ticket_missing"
  | "prevention_controls_missing"
  | "notice_resolution_missing"
  | "signoff_missing"
  | "rebaseline_timeline_missing"
  | "supervisory_recurrence_escalation_resolution_rebaseline_ready";

export type Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionRebaselineGate = {
  schemaVersion: "pass2874_customer_export_supervisory_recurrence_escalation_resolution_rebaseline_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryRecurrenceEscalationResolutionRebaselineState: Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionState;
  supervisoryRecurrenceEscalationResolutionRebaselineReadinessScore: number;
  supervisoryRecurrenceEscalationResolutionRebaselineEnvelope: {
    previousRegressionSloState: string;
    previousRegressionSloReadinessScore: number;
    previousCanKeepReclosedFinalClosure: boolean;
    previousPostRecloseRegressionPayloadHash: string | null;
    previousPostRecloseRegressionTimelineHash: string | null;
    recurrenceCaseId: string | null;
    recurrenceOwnerPseudonym: string | null;
    recurrenceFamily: Pass2874CustomerExportSupervisoryRecurrenceFamily | null;
    rootCauseHash: string | null;
    impactScopeHash: string | null;
    resolutionDecision: Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionDecision | null;
    hardenedRebaselineIndexId: string | null;
    hardenedRebaselineIndexVersion: string | null;
    hardenedRebaselineIndexHash: string | null;
    hardenedRebaselineVerificationReceiptId: string | null;
    recurrencePreventionControlsHash: string | null;
    watcherPolicyUpdateReceiptId: string | null;
    permanentFreezeReceiptId: string | null;
    reopenedSupervisoryInvestigationTicketId: string | null;
    customerNoticeResolutionReceiptId: string | null;
    regulatorNoticeResolutionReceiptId: string | null;
    auditorNoticeResolutionReceiptId: string | null;
    legalSignoffReceiptId: string | null;
    securitySignoffReceiptId: string | null;
    privacySignoffReceiptId: string | null;
    recurrenceResolutionPayloadHash: string | null;
    recurrenceResolutionTimelineHash: string | null;
  };
  supervisoryRecurrenceEscalationResolutionRebaselinePolicy: {
    canResumeReclosedFinalClosureAfterRebaseline: boolean;
    mustKeepArchiveFrozen: boolean;
    mustOpenSupervisoryInvestigation: boolean;
    canClaimProductionRecurrenceResolutionWorker: false;
    reason: string;
  };
  supervisoryRecurrenceEscalationResolutionRebaselineRiskSignals: {
    previousRegressionSloNotReady: boolean;
    recurrenceCaseMissing: boolean;
    rootCauseOrImpactMissing: boolean;
    resolutionDecisionMissing: boolean;
    hardenedRebaselineMissing: boolean;
    permanentFreezeReceiptMissing: boolean;
    reopenedInvestigationTicketMissing: boolean;
    preventionControlsMissing: boolean;
    noticeResolutionMissing: boolean;
    signoffMissing: boolean;
    payloadHashMissing: boolean;
    timelineHashMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2874_CUSTOMER_EXPORT_SUPERVISORY_RECURRENCE_ESCALATION_RESOLUTION_REBASELINE_ACCEPTANCE_GATES = [
  "PASS2874: PASS2873 repeated-regression escalation is not resolved until a recurrence case, owner, root cause and impact scope are attached.",
  "PASS2874: A repeated post-reclose regression requires an explicit decision: hardened rebaseline, permanent freeze or reopened supervisory investigation.",
  "PASS2874: Hardened rebaseline requires a new index id/version/hash, verification receipt, prevention-controls hash and watcher policy update receipt before final closure can resume.",
  "PASS2874: Permanent freeze and reopened investigation outcomes need their own receipts/tickets and must keep archive/export channels frozen.",
  "PASS2874: Customer/regulator/auditor notice resolutions, legal/security/privacy signoffs and timeline hashes are required before recurrence escalation can close.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2874CustomerExportSupervisoryRecurrenceEscalationResolutionRebaselineGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryPostRecloseRegressionSloGate: Pass2873CustomerExportSupervisoryPostRecloseRegressionSloGate;
  generatedAt?: string;
  recurrenceCaseId?: string | null;
  recurrenceOwnerPseudonym?: string | null;
  recurrenceFamily?: Pass2874CustomerExportSupervisoryRecurrenceFamily | null;
  rootCauseHash?: string | null;
  impactScopeHash?: string | null;
  resolutionDecision?: Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionDecision | null;
  hardenedRebaselineIndexId?: string | null;
  hardenedRebaselineIndexVersion?: string | null;
  hardenedRebaselineIndexHash?: string | null;
  hardenedRebaselineVerificationReceiptId?: string | null;
  recurrencePreventionControlsHash?: string | null;
  watcherPolicyUpdateReceiptId?: string | null;
  permanentFreezeReceiptId?: string | null;
  reopenedSupervisoryInvestigationTicketId?: string | null;
  customerNoticeResolutionReceiptId?: string | null;
  regulatorNoticeResolutionReceiptId?: string | null;
  auditorNoticeResolutionReceiptId?: string | null;
  legalSignoffReceiptId?: string | null;
  securitySignoffReceiptId?: string | null;
  privacySignoffReceiptId?: string | null;
  recurrenceResolutionPayloadHash?: string | null;
  recurrenceResolutionTimelineHash?: string | null;
}): Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionRebaselineGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousGate = args.customerExportSupervisoryPostRecloseRegressionSloGate;
  const previousEnvelope = previousGate.supervisoryPostRecloseRegressionSloEnvelope;
  const previousReady = Boolean(previousGate.supervisoryPostRecloseRegressionSloPolicy.canKeepReclosedFinalClosure);
  const recurrenceCaseReady = Boolean(args.recurrenceCaseId && args.recurrenceOwnerPseudonym && args.recurrenceFamily);
  const causeReady = Boolean(args.rootCauseHash && args.impactScopeHash);
  const decisionReady = Boolean(args.resolutionDecision);
  const hardenedRebaselineReady = args.resolutionDecision === "hardened_rebaseline"
    ? Boolean(args.hardenedRebaselineIndexId && args.hardenedRebaselineIndexVersion && args.hardenedRebaselineIndexHash && args.hardenedRebaselineVerificationReceiptId)
    : true;
  const permanentFreezeReady = args.resolutionDecision === "permanent_freeze" ? Boolean(args.permanentFreezeReceiptId) : true;
  const reopenReady = args.resolutionDecision === "reopen_supervisory_investigation" ? Boolean(args.reopenedSupervisoryInvestigationTicketId) : true;
  const preventionReady = args.resolutionDecision === "hardened_rebaseline"
    ? Boolean(args.recurrencePreventionControlsHash && args.watcherPolicyUpdateReceiptId)
    : true;
  const noticeReady = Boolean(args.customerNoticeResolutionReceiptId && args.regulatorNoticeResolutionReceiptId && args.auditorNoticeResolutionReceiptId);
  const signoffReady = Boolean(args.legalSignoffReceiptId && args.securitySignoffReceiptId && args.privacySignoffReceiptId);
  const timelineReady = Boolean(args.recurrenceResolutionPayloadHash && args.recurrenceResolutionTimelineHash);
  const canResolve = Boolean(previousReady && recurrenceCaseReady && causeReady && decisionReady && hardenedRebaselineReady && permanentFreezeReady && reopenReady && preventionReady && noticeReady && signoffReady && timelineReady);
  const canResume = Boolean(canResolve && args.resolutionDecision === "hardened_rebaseline");

  const state: Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionState = !previousReady
    ? "previous_regression_slo_not_ready"
    : !recurrenceCaseReady
      ? "recurrence_case_missing"
      : !causeReady
        ? "root_cause_or_impact_scope_missing"
        : !decisionReady
          ? "resolution_decision_missing"
          : !hardenedRebaselineReady
            ? "hardened_rebaseline_missing"
            : !permanentFreezeReady
              ? "permanent_freeze_receipt_missing"
              : !reopenReady
                ? "reopened_investigation_ticket_missing"
                : !preventionReady
                  ? "prevention_controls_missing"
                  : !noticeReady
                    ? "notice_resolution_missing"
                    : !signoffReady
                      ? "signoff_missing"
                      : !timelineReady
                        ? "rebaseline_timeline_missing"
                        : "supervisory_recurrence_escalation_resolution_rebaseline_ready";

  const readiness = clamp(
    previousGate.supervisoryPostRecloseRegressionSloReadinessScore +
      (previousReady ? 8 : -55) +
      (recurrenceCaseReady ? 12 : -24) +
      (causeReady ? 12 : -24) +
      (decisionReady ? 10 : -20) +
      (hardenedRebaselineReady ? 12 : -24) +
      (permanentFreezeReady ? 6 : -16) +
      (reopenReady ? 6 : -16) +
      (preventionReady ? 10 : -22) +
      (noticeReady ? 9 : -18) +
      (signoffReady ? 11 : -22) +
      (timelineReady ? 10 : -20)
  );

  const mustOpenSupervisoryInvestigation = args.resolutionDecision === "reopen_supervisory_investigation";
  const mustKeepArchiveFrozen = !canResolve || args.resolutionDecision === "permanent_freeze" || mustOpenSupervisoryInvestigation;

  return {
    schemaVersion: "pass2874_customer_export_supervisory_recurrence_escalation_resolution_rebaseline_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Advanced",
    releasePacketId: "pass2874-customer-export-supervisory-recurrence-escalation-resolution-rebaseline",
    sealId: `pass2874-recurrence-resolution-${generatedAt}`,
    generatedAt,
    supervisoryRecurrenceEscalationResolutionRebaselineState: state,
    supervisoryRecurrenceEscalationResolutionRebaselineReadinessScore: readiness,
    supervisoryRecurrenceEscalationResolutionRebaselineEnvelope: {
      previousRegressionSloState: previousGate.supervisoryPostRecloseRegressionSloState,
      previousRegressionSloReadinessScore: previousGate.supervisoryPostRecloseRegressionSloReadinessScore,
      previousCanKeepReclosedFinalClosure: previousReady,
      previousPostRecloseRegressionPayloadHash: previousEnvelope.postRecloseRegressionPayloadHash,
      previousPostRecloseRegressionTimelineHash: previousEnvelope.postRecloseRegressionTimelineHash,
      recurrenceCaseId: args.recurrenceCaseId ?? null,
      recurrenceOwnerPseudonym: args.recurrenceOwnerPseudonym ?? null,
      recurrenceFamily: args.recurrenceFamily ?? null,
      rootCauseHash: args.rootCauseHash ?? null,
      impactScopeHash: args.impactScopeHash ?? null,
      resolutionDecision: args.resolutionDecision ?? null,
      hardenedRebaselineIndexId: args.hardenedRebaselineIndexId ?? null,
      hardenedRebaselineIndexVersion: args.hardenedRebaselineIndexVersion ?? null,
      hardenedRebaselineIndexHash: args.hardenedRebaselineIndexHash ?? null,
      hardenedRebaselineVerificationReceiptId: args.hardenedRebaselineVerificationReceiptId ?? null,
      recurrencePreventionControlsHash: args.recurrencePreventionControlsHash ?? null,
      watcherPolicyUpdateReceiptId: args.watcherPolicyUpdateReceiptId ?? null,
      permanentFreezeReceiptId: args.permanentFreezeReceiptId ?? null,
      reopenedSupervisoryInvestigationTicketId: args.reopenedSupervisoryInvestigationTicketId ?? null,
      customerNoticeResolutionReceiptId: args.customerNoticeResolutionReceiptId ?? null,
      regulatorNoticeResolutionReceiptId: args.regulatorNoticeResolutionReceiptId ?? null,
      auditorNoticeResolutionReceiptId: args.auditorNoticeResolutionReceiptId ?? null,
      legalSignoffReceiptId: args.legalSignoffReceiptId ?? null,
      securitySignoffReceiptId: args.securitySignoffReceiptId ?? null,
      privacySignoffReceiptId: args.privacySignoffReceiptId ?? null,
      recurrenceResolutionPayloadHash: args.recurrenceResolutionPayloadHash ?? null,
      recurrenceResolutionTimelineHash: args.recurrenceResolutionTimelineHash ?? null,
    },
    supervisoryRecurrenceEscalationResolutionRebaselinePolicy: {
      canResumeReclosedFinalClosureAfterRebaseline: canResume,
      mustKeepArchiveFrozen,
      mustOpenSupervisoryInvestigation,
      canClaimProductionRecurrenceResolutionWorker: false,
      reason: canResume
        ? "PASS2874 recurrence escalation resolved through hardened rebaseline, prevention controls, notices, signoffs and timeline hash."
        : mustOpenSupervisoryInvestigation
          ? "PASS2874 keeps the archive frozen because recurrence requires a reopened supervisory investigation."
          : args.resolutionDecision === "permanent_freeze"
            ? "PASS2874 keeps the archive permanently frozen by explicit recurrence resolution decision."
            : "PASS2874 blocks recurrence resolution until case, decision, rebaseline/freeze/reopen receipts, notices, signoffs and hashes exist.",
    },
    supervisoryRecurrenceEscalationResolutionRebaselineRiskSignals: {
      previousRegressionSloNotReady: !previousReady,
      recurrenceCaseMissing: !recurrenceCaseReady,
      rootCauseOrImpactMissing: !causeReady,
      resolutionDecisionMissing: !decisionReady,
      hardenedRebaselineMissing: !hardenedRebaselineReady,
      permanentFreezeReceiptMissing: !permanentFreezeReady,
      reopenedInvestigationTicketMissing: !reopenReady,
      preventionControlsMissing: !preventionReady,
      noticeResolutionMissing: !noticeReady,
      signoffMissing: !signoffReady,
      payloadHashMissing: !args.recurrenceResolutionPayloadHash,
      timelineHashMissing: !args.recurrenceResolutionTimelineHash,
    },
    customerSafeCopy: "PASS2874 prevents repeated post-reclose regressions from being treated as routine alerts. A recurrence must be resolved through hardened rebaseline, permanent freeze or reopened supervisory investigation with notices, signoffs and immutable timeline proof.",
    operatorNextActions: canResume
      ? ["Keep post-rebaseline mutation/regression watch active and preserve recurrence-resolution evidence in the supervisory archive."]
      : ["Attach recurrence case, root cause, impact scope and explicit decision.", "Do not resume final archive close until PASS2874 receipts, notices, signoffs and timeline hash pass."],
  };
}
