import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type {
  Pass2879CustomerExportSupervisoryPostSealDriftSentinelEmergencyRefreezeGate,
  Pass2879CustomerExportSupervisoryPostSealDriftSignal,
} from "@/lib/market-integrity/top1-customer-export-supervisory-post-seal-drift-sentinel-emergency-refreeze-gate";

export type Pass2880CustomerExportSupervisoryEmergencyRefreezeResolutionDecision =
  | "reseal_after_corrected_baseline"
  | "permanent_freeze"
  | "reopen_supervisory_investigation"
  | "extend_emergency_refreeze";

export type Pass2880CustomerExportSupervisoryEmergencyRefreezeResolutionState =
  | "previous_post_seal_sentinel_not_ready"
  | "previous_emergency_context_missing"
  | "resolution_case_missing"
  | "root_cause_missing"
  | "impact_scope_missing"
  | "corrected_baseline_missing"
  | "reseal_eligibility_missing"
  | "decision_missing"
  | "reseal_receipt_missing"
  | "permanent_freeze_receipt_missing"
  | "reopened_investigation_ticket_missing"
  | "extended_refreeze_receipt_missing"
  | "notice_receipts_missing"
  | "signoff_receipts_missing"
  | "payload_or_timeline_hash_missing"
  | "supervisory_emergency_refreeze_resolution_reseal_ready";

export type Pass2880CustomerExportSupervisoryEmergencyRefreezeResolutionResealGate = {
  schemaVersion: "pass2880_customer_export_supervisory_emergency_refreeze_resolution_reseal_gate_v1";
  surface: string;
  tier: VelmereTier;
  resolutionCaseId: string;
  releasePacketId: string;
  generatedAt: string;
  supervisoryEmergencyRefreezeResolutionResealState: Pass2880CustomerExportSupervisoryEmergencyRefreezeResolutionState;
  supervisoryEmergencyRefreezeResolutionResealReadinessScore: number;
  supervisoryEmergencyRefreezeResolutionResealEnvelope: {
    previousPostSealSentinelState: string;
    previousSentinelReadinessScore: number;
    previousSentinelDecision: string | null;
    previousMustEmergencyRefreeze: boolean;
    previousMustReopenSupervisoryReview: boolean;
    previousMustExtendObservation: boolean;
    previousPostSealSentinelPayloadHash: string | null;
    previousPostSealSentinelTimelineHash: string | null;
    emergencyRefreezeResolutionCaseId: string | null;
    emergencyRefreezeResolutionOwnerId: string | null;
    emergencyRefreezeResolutionSlaReceiptId: string | null;
    rootCauseReceiptId: string | null;
    rootCauseSummary: string | null;
    impactScopeReceiptId: string | null;
    impactedSignals: Pass2879CustomerExportSupervisoryPostSealDriftSignal[];
    correctedChannelBaselineHash: string | null;
    correctedBaselineVerificationReceiptId: string | null;
    resealEligibilityReceiptId: string | null;
    resealEligibilityWindowStartedAt: string | null;
    resealEligibilityWindowEndsAt: string | null;
    resolutionDecision: Pass2880CustomerExportSupervisoryEmergencyRefreezeResolutionDecision | null;
    channelResealReceiptId: string | null;
    channelResealHash: string | null;
    permanentFreezeReceiptId: string | null;
    reopenedSupervisoryInvestigationTicketId: string | null;
    extendedEmergencyRefreezeReceiptId: string | null;
    customerResolutionNoticeReceiptId: string | null;
    regulatorResolutionNoticeReceiptId: string | null;
    auditorResolutionNoticeReceiptId: string | null;
    internalResolutionNoticeReceiptId: string | null;
    legalSignoffReceiptId: string | null;
    securitySignoffReceiptId: string | null;
    privacySignoffReceiptId: string | null;
    emergencyRefreezeResolutionPayloadHash: string | null;
    emergencyRefreezeResolutionTimelineHash: string | null;
  };
  supervisoryEmergencyRefreezeResolutionResealPolicy: {
    canResealChannelsAfterEmergencyRefreeze: boolean;
    mustKeepChannelsPermanentlyFrozen: boolean;
    mustReopenSupervisoryInvestigation: boolean;
    mustExtendEmergencyRefreeze: boolean;
    canClaimProductionResealWorker: false;
    reason: string;
  };
  supervisoryEmergencyRefreezeResolutionResealRiskSignals: {
    previousPostSealSentinelNotReady: boolean;
    previousEmergencyContextMissing: boolean;
    resolutionCaseMissing: boolean;
    rootCauseMissing: boolean;
    impactScopeMissing: boolean;
    correctedBaselineMissing: boolean;
    resealEligibilityMissing: boolean;
    decisionMissing: boolean;
    resealReceiptMissing: boolean;
    permanentFreezeReceiptMissing: boolean;
    reopenedInvestigationTicketMissing: boolean;
    extendedRefreezeReceiptMissing: boolean;
    noticeReceiptsMissing: boolean;
    signoffReceiptsMissing: boolean;
    payloadHashMissing: boolean;
    timelineHashMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2880_CUSTOMER_EXPORT_SUPERVISORY_EMERGENCY_REFREEZE_RESOLUTION_RESEAL_ACCEPTANCE_GATES = [
  "PASS2880: PASS2879 emergency re-freeze or sentinel reopen is not resolution; re-seal needs a separate resolution case.",
  "PASS2880: Emergency re-freeze resolution requires owner/SLA, root cause, impact scope and corrected channel baseline verification.",
  "PASS2880: Re-seal, permanent freeze, reopened supervisory investigation or extended refreeze decisions require matching receipts/tickets.",
  "PASS2880: Customer/regulator/auditor/internal resolution notices plus legal/security/privacy signoff are required before any post-refreeze state is final.",
  "PASS2880: This is deterministic contract evidence only; production still requires real channel locks, incident workflow, DB writes and alert delivery.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2880CustomerExportSupervisoryEmergencyRefreezeResolutionResealGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryPostSealDriftSentinelEmergencyRefreezeGate: Pass2879CustomerExportSupervisoryPostSealDriftSentinelEmergencyRefreezeGate;
  generatedAt?: string;
  emergencyRefreezeResolutionCaseId?: string | null;
  emergencyRefreezeResolutionOwnerId?: string | null;
  emergencyRefreezeResolutionSlaReceiptId?: string | null;
  rootCauseReceiptId?: string | null;
  rootCauseSummary?: string | null;
  impactScopeReceiptId?: string | null;
  impactedSignals?: Pass2879CustomerExportSupervisoryPostSealDriftSignal[] | null;
  correctedChannelBaselineHash?: string | null;
  correctedBaselineVerificationReceiptId?: string | null;
  resealEligibilityReceiptId?: string | null;
  resealEligibilityWindowStartedAt?: string | null;
  resealEligibilityWindowEndsAt?: string | null;
  resolutionDecision?: Pass2880CustomerExportSupervisoryEmergencyRefreezeResolutionDecision | null;
  channelResealReceiptId?: string | null;
  channelResealHash?: string | null;
  permanentFreezeReceiptId?: string | null;
  reopenedSupervisoryInvestigationTicketId?: string | null;
  extendedEmergencyRefreezeReceiptId?: string | null;
  customerResolutionNoticeReceiptId?: string | null;
  regulatorResolutionNoticeReceiptId?: string | null;
  auditorResolutionNoticeReceiptId?: string | null;
  internalResolutionNoticeReceiptId?: string | null;
  legalSignoffReceiptId?: string | null;
  securitySignoffReceiptId?: string | null;
  privacySignoffReceiptId?: string | null;
  emergencyRefreezeResolutionPayloadHash?: string | null;
  emergencyRefreezeResolutionTimelineHash?: string | null;
}): Pass2880CustomerExportSupervisoryEmergencyRefreezeResolutionResealGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousGate = args.customerExportSupervisoryPostSealDriftSentinelEmergencyRefreezeGate;
  const previousEnvelope = previousGate.supervisoryPostSealDriftSentinelEmergencyRefreezeEnvelope;
  const previousPolicy = previousGate.supervisoryPostSealDriftSentinelEmergencyRefreezePolicy;
  const previousReady = previousGate.supervisoryPostSealDriftSentinelEmergencyRefreezeState === "supervisory_post_seal_drift_sentinel_emergency_refreeze_ready";
  const previousEmergencyContext = Boolean(previousPolicy.mustEmergencyRefreezeArchiveExportDeliveryChannels || previousPolicy.mustReopenSupervisoryReview || previousPolicy.mustExtendSentinelObservation);
  const impactedSignals = args.impactedSignals ?? previousEnvelope.reviewedDriftSignals ?? [];

  const resolutionCaseReady = Boolean(args.emergencyRefreezeResolutionCaseId && args.emergencyRefreezeResolutionOwnerId && args.emergencyRefreezeResolutionSlaReceiptId);
  const rootCauseReady = Boolean(args.rootCauseReceiptId && args.rootCauseSummary);
  const impactScopeReady = Boolean(args.impactScopeReceiptId && impactedSignals.length > 0);
  const correctedBaselineReady = Boolean(args.correctedChannelBaselineHash && args.correctedBaselineVerificationReceiptId);
  const resealEligibilityReady = Boolean(args.resealEligibilityReceiptId && args.resealEligibilityWindowStartedAt && args.resealEligibilityWindowEndsAt);
  const decisionReady = Boolean(args.resolutionDecision);
  const resealReady = args.resolutionDecision === "reseal_after_corrected_baseline" ? Boolean(args.channelResealReceiptId && args.channelResealHash) : true;
  const permanentFreezeReady = args.resolutionDecision === "permanent_freeze" ? Boolean(args.permanentFreezeReceiptId) : true;
  const reopenedReady = args.resolutionDecision === "reopen_supervisory_investigation" ? Boolean(args.reopenedSupervisoryInvestigationTicketId) : true;
  const extendedReady = args.resolutionDecision === "extend_emergency_refreeze" ? Boolean(args.extendedEmergencyRefreezeReceiptId) : true;
  const noticesReady = Boolean(args.customerResolutionNoticeReceiptId && args.regulatorResolutionNoticeReceiptId && args.auditorResolutionNoticeReceiptId && args.internalResolutionNoticeReceiptId);
  const signoffsReady = Boolean(args.legalSignoffReceiptId && args.securitySignoffReceiptId && args.privacySignoffReceiptId);
  const hashesReady = Boolean(args.emergencyRefreezeResolutionPayloadHash && args.emergencyRefreezeResolutionTimelineHash);

  const state: Pass2880CustomerExportSupervisoryEmergencyRefreezeResolutionState = !previousReady
    ? "previous_post_seal_sentinel_not_ready"
    : !previousEmergencyContext
      ? "previous_emergency_context_missing"
      : !resolutionCaseReady
        ? "resolution_case_missing"
        : !rootCauseReady
          ? "root_cause_missing"
          : !impactScopeReady
            ? "impact_scope_missing"
            : !correctedBaselineReady
              ? "corrected_baseline_missing"
              : !resealEligibilityReady
                ? "reseal_eligibility_missing"
                : !decisionReady
                  ? "decision_missing"
                  : !resealReady
                    ? "reseal_receipt_missing"
                    : !permanentFreezeReady
                      ? "permanent_freeze_receipt_missing"
                      : !reopenedReady
                        ? "reopened_investigation_ticket_missing"
                        : !extendedReady
                          ? "extended_refreeze_receipt_missing"
                          : !noticesReady
                            ? "notice_receipts_missing"
                            : !signoffsReady
                              ? "signoff_receipts_missing"
                              : !hashesReady
                                ? "payload_or_timeline_hash_missing"
                                : "supervisory_emergency_refreeze_resolution_reseal_ready";

  const canReseal = Boolean(state === "supervisory_emergency_refreeze_resolution_reseal_ready" && args.resolutionDecision === "reseal_after_corrected_baseline");
  const mustKeepFrozen = Boolean(state === "supervisory_emergency_refreeze_resolution_reseal_ready" && args.resolutionDecision === "permanent_freeze");
  const mustReopen = Boolean(state === "supervisory_emergency_refreeze_resolution_reseal_ready" && args.resolutionDecision === "reopen_supervisory_investigation");
  const mustExtend = Boolean(state === "supervisory_emergency_refreeze_resolution_reseal_ready" && args.resolutionDecision === "extend_emergency_refreeze");

  const readiness = clamp(
    previousGate.supervisoryPostSealDriftSentinelEmergencyRefreezeReadinessScore +
      (previousReady ? 8 : -60) +
      (previousEmergencyContext ? 8 : -30) +
      (resolutionCaseReady ? 10 : -10) +
      (rootCauseReady ? 10 : -10) +
      (impactScopeReady ? 8 : -8) +
      (correctedBaselineReady ? 10 : -10) +
      (resealEligibilityReady ? 8 : -8) +
      (decisionReady ? 8 : -8) +
      (resealReady && permanentFreezeReady && reopenedReady && extendedReady ? 8 : -8) +
      (noticesReady ? 6 : -6) +
      (signoffsReady ? 6 : -6) +
      (hashesReady ? 10 : -10)
  );

  return {
    schemaVersion: "pass2880_customer_export_supervisory_emergency_refreeze_resolution_reseal_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Advanced",
    resolutionCaseId: args.emergencyRefreezeResolutionCaseId ?? "pass2880-resolution-case-pending",
    releasePacketId: previousGate.releasePacketId,
    generatedAt,
    supervisoryEmergencyRefreezeResolutionResealState: state,
    supervisoryEmergencyRefreezeResolutionResealReadinessScore: readiness,
    supervisoryEmergencyRefreezeResolutionResealEnvelope: {
      previousPostSealSentinelState: previousGate.supervisoryPostSealDriftSentinelEmergencyRefreezeState,
      previousSentinelReadinessScore: previousGate.supervisoryPostSealDriftSentinelEmergencyRefreezeReadinessScore,
      previousSentinelDecision: previousEnvelope.sentinelDecision,
      previousMustEmergencyRefreeze: previousPolicy.mustEmergencyRefreezeArchiveExportDeliveryChannels,
      previousMustReopenSupervisoryReview: previousPolicy.mustReopenSupervisoryReview,
      previousMustExtendObservation: previousPolicy.mustExtendSentinelObservation,
      previousPostSealSentinelPayloadHash: previousEnvelope.postSealSentinelPayloadHash,
      previousPostSealSentinelTimelineHash: previousEnvelope.postSealSentinelTimelineHash,
      emergencyRefreezeResolutionCaseId: args.emergencyRefreezeResolutionCaseId ?? null,
      emergencyRefreezeResolutionOwnerId: args.emergencyRefreezeResolutionOwnerId ?? null,
      emergencyRefreezeResolutionSlaReceiptId: args.emergencyRefreezeResolutionSlaReceiptId ?? null,
      rootCauseReceiptId: args.rootCauseReceiptId ?? null,
      rootCauseSummary: args.rootCauseSummary ?? null,
      impactScopeReceiptId: args.impactScopeReceiptId ?? null,
      impactedSignals,
      correctedChannelBaselineHash: args.correctedChannelBaselineHash ?? null,
      correctedBaselineVerificationReceiptId: args.correctedBaselineVerificationReceiptId ?? null,
      resealEligibilityReceiptId: args.resealEligibilityReceiptId ?? null,
      resealEligibilityWindowStartedAt: args.resealEligibilityWindowStartedAt ?? null,
      resealEligibilityWindowEndsAt: args.resealEligibilityWindowEndsAt ?? null,
      resolutionDecision: args.resolutionDecision ?? null,
      channelResealReceiptId: args.channelResealReceiptId ?? null,
      channelResealHash: args.channelResealHash ?? null,
      permanentFreezeReceiptId: args.permanentFreezeReceiptId ?? null,
      reopenedSupervisoryInvestigationTicketId: args.reopenedSupervisoryInvestigationTicketId ?? null,
      extendedEmergencyRefreezeReceiptId: args.extendedEmergencyRefreezeReceiptId ?? null,
      customerResolutionNoticeReceiptId: args.customerResolutionNoticeReceiptId ?? null,
      regulatorResolutionNoticeReceiptId: args.regulatorResolutionNoticeReceiptId ?? null,
      auditorResolutionNoticeReceiptId: args.auditorResolutionNoticeReceiptId ?? null,
      internalResolutionNoticeReceiptId: args.internalResolutionNoticeReceiptId ?? null,
      legalSignoffReceiptId: args.legalSignoffReceiptId ?? null,
      securitySignoffReceiptId: args.securitySignoffReceiptId ?? null,
      privacySignoffReceiptId: args.privacySignoffReceiptId ?? null,
      emergencyRefreezeResolutionPayloadHash: args.emergencyRefreezeResolutionPayloadHash ?? null,
      emergencyRefreezeResolutionTimelineHash: args.emergencyRefreezeResolutionTimelineHash ?? null,
    },
    supervisoryEmergencyRefreezeResolutionResealPolicy: {
      canResealChannelsAfterEmergencyRefreeze: canReseal,
      mustKeepChannelsPermanentlyFrozen: mustKeepFrozen,
      mustReopenSupervisoryInvestigation: mustReopen,
      mustExtendEmergencyRefreeze: mustExtend,
      canClaimProductionResealWorker: false,
      reason: canReseal
        ? "Emergency re-freeze incident is resolved and corrected baseline can be supervised-resealed."
        : mustKeepFrozen
          ? "Resolution requires permanent freeze; channels cannot be resealed open."
          : mustReopen
            ? "Resolution escalates to reopened supervisory investigation."
            : mustExtend
              ? "Emergency refreeze must stay active for a longer window."
              : `PASS2880 blocked: ${state}`,
    },
    supervisoryEmergencyRefreezeResolutionResealRiskSignals: {
      previousPostSealSentinelNotReady: !previousReady,
      previousEmergencyContextMissing: !previousEmergencyContext,
      resolutionCaseMissing: !resolutionCaseReady,
      rootCauseMissing: !rootCauseReady,
      impactScopeMissing: !impactScopeReady,
      correctedBaselineMissing: !correctedBaselineReady,
      resealEligibilityMissing: !resealEligibilityReady,
      decisionMissing: !decisionReady,
      resealReceiptMissing: !resealReady,
      permanentFreezeReceiptMissing: !permanentFreezeReady,
      reopenedInvestigationTicketMissing: !reopenedReady,
      extendedRefreezeReceiptMissing: !extendedReady,
      noticeReceiptsMissing: !noticesReady,
      signoffReceiptsMissing: !signoffsReady,
      payloadHashMissing: !args.emergencyRefreezeResolutionPayloadHash,
      timelineHashMissing: !args.emergencyRefreezeResolutionTimelineHash,
    },
    customerSafeCopy: "PASS2880 separates emergency re-freeze detection from resolution. A late anomaly after sealed-open channels needs root cause, impact scope, corrected baseline, explicit reseal/permanent-freeze/reopen/extend decision, notices and signoffs before channels can be trusted again.",
    operatorNextActions: canReseal
      ? ["Attach supervised reseal to release dashboard.", "Keep post-reseal sentinel active for next pass."]
      : ["Keep archive/export/delivery channels frozen.", "Collect missing PASS2880 resolution receipts before any reseal.", "Do not manually reopen delivery links outside supervisor-approved decision."],
  };
}
