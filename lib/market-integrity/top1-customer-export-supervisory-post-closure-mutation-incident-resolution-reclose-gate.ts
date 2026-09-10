import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2871CustomerExportSupervisoryPostClosureMutationWatchAutoFreezeGate } from "@/lib/market-integrity/top1-customer-export-supervisory-post-closure-mutation-watch-auto-freeze-gate";

export type Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionDecision =
  | "re_close_after_reseal"
  | "permanent_freeze"
  | "reopen_investigation";

export type Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionRecloseState =
  | "previous_post_closure_watch_not_ready"
  | "mutation_incident_resolution_case_missing"
  | "root_cause_or_impact_scope_missing"
  | "corrected_index_verification_missing"
  | "resolution_decision_missing"
  | "reclose_or_freeze_receipt_missing"
  | "notice_resolution_missing"
  | "signoff_missing"
  | "resolution_timeline_missing"
  | "supervisory_post_closure_mutation_incident_resolution_reclose_ready";

export type Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionRecloseGate = {
  schemaVersion: "pass2872_customer_export_supervisory_post_closure_mutation_incident_resolution_reclose_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryPostClosureMutationIncidentResolutionRecloseState: Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionRecloseState;
  supervisoryPostClosureMutationIncidentResolutionRecloseReadinessScore: number;
  supervisoryPostClosureMutationIncidentResolutionRecloseEnvelope: {
    previousPostClosureWatchState: string;
    previousPostClosureWatchReadinessScore: number;
    previousCanKeepFinalClosureClosed: boolean;
    previousAutoFreezeRequired: boolean;
    previousMutationIncidentTicketId: string | null;
    previousPostClosureWatchPayloadHash: string | null;
    previousPostClosureWatchTimelineHash: string | null;
    resolutionCaseId: string | null;
    resolutionOwnerPseudonym: string | null;
    rootCauseHash: string | null;
    impactScopeHash: string | null;
    correctedEvidenceIndexId: string | null;
    correctedEvidenceIndexVersion: string | null;
    correctedEvidenceIndexHash: string | null;
    correctedIndexVerificationReceiptId: string | null;
    resolutionDecision: Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionDecision | null;
    recloseReceiptId: string | null;
    permanentFreezeReceiptId: string | null;
    reopenedInvestigationTicketId: string | null;
    customerNoticeResolutionReceiptId: string | null;
    regulatorNoticeResolutionReceiptId: string | null;
    auditorNoticeResolutionReceiptId: string | null;
    legalSignoffReceiptId: string | null;
    securitySignoffReceiptId: string | null;
    privacySignoffReceiptId: string | null;
    correctedPostClosureWatchTimelineHash: string | null;
    resolutionPayloadHash: string | null;
    resolutionTimelineHash: string | null;
  };
  supervisoryPostClosureMutationIncidentResolutionReclosePolicy: {
    canRecloseFinalClosure: boolean;
    mustRemainFrozen: boolean;
    mustReopenInvestigation: boolean;
    canClaimProductionRecloseWorker: false;
    reason: string;
  };
  supervisoryPostClosureMutationIncidentResolutionRecloseRiskSignals: {
    previousPostClosureWatchNotReady: boolean;
    resolutionCaseMissing: boolean;
    rootCauseMissing: boolean;
    impactScopeMissing: boolean;
    correctedIndexVerificationMissing: boolean;
    resolutionDecisionMissing: boolean;
    recloseReceiptMissing: boolean;
    permanentFreezeReceiptMissing: boolean;
    reopenedInvestigationTicketMissing: boolean;
    noticeResolutionMissing: boolean;
    signoffMissing: boolean;
    correctedWatchTimelineMissing: boolean;
    payloadHashMissing: boolean;
    timelineHashMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2872_CUSTOMER_EXPORT_SUPERVISORY_POST_CLOSURE_MUTATION_INCIDENT_RESOLUTION_RECLOSE_ACCEPTANCE_GATES = [
  "PASS2872: PASS2871 auto-freeze/mutation incident is not resolved until a resolution case, owner, root cause and impact scope are attached.",
  "PASS2872: Re-close requires corrected evidence-index verification, corrected post-closure watch timeline and new payload/timeline hashes.",
  "PASS2872: Permanent-freeze or reopened-investigation decisions must carry their own receipts; they cannot reuse PASS2871 auto-freeze receipts.",
  "PASS2872: Customer/regulator/auditor notice resolutions and legal/security/privacy signoffs are separate from the original mutation signal review.",
  "PASS2872: Final closure can only be re-closed when the resolution decision is re_close_after_reseal and all receipts/signoffs are present.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionRecloseGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryPostClosureMutationWatchAutoFreezeGate: Pass2871CustomerExportSupervisoryPostClosureMutationWatchAutoFreezeGate;
  generatedAt?: string;
  resolutionCaseId?: string | null;
  resolutionOwnerPseudonym?: string | null;
  rootCauseHash?: string | null;
  impactScopeHash?: string | null;
  correctedEvidenceIndexId?: string | null;
  correctedEvidenceIndexVersion?: string | null;
  correctedEvidenceIndexHash?: string | null;
  correctedIndexVerificationReceiptId?: string | null;
  resolutionDecision?: Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionDecision | null;
  recloseReceiptId?: string | null;
  permanentFreezeReceiptId?: string | null;
  reopenedInvestigationTicketId?: string | null;
  customerNoticeResolutionReceiptId?: string | null;
  regulatorNoticeResolutionReceiptId?: string | null;
  auditorNoticeResolutionReceiptId?: string | null;
  legalSignoffReceiptId?: string | null;
  securitySignoffReceiptId?: string | null;
  privacySignoffReceiptId?: string | null;
  correctedPostClosureWatchTimelineHash?: string | null;
  resolutionPayloadHash?: string | null;
  resolutionTimelineHash?: string | null;
}): Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionRecloseGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousGate = args.customerExportSupervisoryPostClosureMutationWatchAutoFreezeGate;
  const previousEnvelope = previousGate.supervisoryPostClosureMutationWatchAutoFreezeEnvelope;
  const previousReady = Boolean(previousGate.supervisoryPostClosureMutationWatchAutoFreezePolicy.canKeepFinalClosureClosed);
  const previousAutoFreezeRequired = Boolean(previousGate.supervisoryPostClosureMutationWatchAutoFreezePolicy.mustAutoFreezeOnMutationSignal);
  const resolutionDecision = args.resolutionDecision ?? null;
  const resolutionCaseReady = Boolean(args.resolutionCaseId && args.resolutionOwnerPseudonym);
  const rootCauseReady = Boolean(args.rootCauseHash && args.impactScopeHash);
  const correctedIndexReady = Boolean(
    args.correctedEvidenceIndexId &&
      args.correctedEvidenceIndexVersion &&
      args.correctedEvidenceIndexHash &&
      args.correctedIndexVerificationReceiptId,
  );
  const decisionReady = Boolean(resolutionDecision);
  const recloseReady = resolutionDecision === "re_close_after_reseal" ? Boolean(args.recloseReceiptId) : true;
  const permanentFreezeReady = resolutionDecision === "permanent_freeze" ? Boolean(args.permanentFreezeReceiptId) : true;
  const reopenedInvestigationReady = resolutionDecision === "reopen_investigation" ? Boolean(args.reopenedInvestigationTicketId) : true;
  const noticeReady = Boolean(args.customerNoticeResolutionReceiptId && args.regulatorNoticeResolutionReceiptId && args.auditorNoticeResolutionReceiptId);
  const signoffReady = Boolean(args.legalSignoffReceiptId && args.securitySignoffReceiptId && args.privacySignoffReceiptId);
  const timelineReady = Boolean(args.correctedPostClosureWatchTimelineHash && args.resolutionPayloadHash && args.resolutionTimelineHash);
  const ready = Boolean(
    previousReady &&
      resolutionCaseReady &&
      rootCauseReady &&
      correctedIndexReady &&
      decisionReady &&
      recloseReady &&
      permanentFreezeReady &&
      reopenedInvestigationReady &&
      noticeReady &&
      signoffReady &&
      timelineReady,
  );

  const state: Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionRecloseState = !previousReady
    ? "previous_post_closure_watch_not_ready"
    : !resolutionCaseReady
      ? "mutation_incident_resolution_case_missing"
      : !rootCauseReady
        ? "root_cause_or_impact_scope_missing"
        : !correctedIndexReady
          ? "corrected_index_verification_missing"
          : !decisionReady
            ? "resolution_decision_missing"
            : !(recloseReady && permanentFreezeReady && reopenedInvestigationReady)
              ? "reclose_or_freeze_receipt_missing"
              : !noticeReady
                ? "notice_resolution_missing"
                : !signoffReady
                  ? "signoff_missing"
                  : !timelineReady
                    ? "resolution_timeline_missing"
                    : "supervisory_post_closure_mutation_incident_resolution_reclose_ready";

  const readiness = clamp(
    previousGate.supervisoryPostClosureMutationWatchAutoFreezeReadinessScore +
      (previousReady ? 8 : -55) +
      (resolutionCaseReady ? 12 : -26) +
      (rootCauseReady ? 13 : -28) +
      (correctedIndexReady ? 17 : -34) +
      (decisionReady ? 10 : -20) +
      (recloseReady ? 8 : -22) +
      (permanentFreezeReady ? 7 : -18) +
      (reopenedInvestigationReady ? 7 : -18) +
      (noticeReady ? 10 : -20) +
      (signoffReady ? 12 : -24) +
      (args.correctedPostClosureWatchTimelineHash ? 7 : -14) +
      (args.resolutionPayloadHash ? 6 : -12) +
      (args.resolutionTimelineHash ? 10 : -20),
  );

  const canRecloseFinalClosure = Boolean(ready && resolutionDecision === "re_close_after_reseal");
  const mustRemainFrozen = Boolean(!ready || resolutionDecision === "permanent_freeze");
  const mustReopenInvestigation = Boolean(resolutionDecision === "reopen_investigation");

  return {
    schemaVersion: "pass2872_customer_export_supervisory_post_closure_mutation_incident_resolution_reclose_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Advanced",
    releasePacketId: `pass2872-post-closure-mutation-resolution-${args.surface.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    sealId: `pass2872-reclose-${previousGate.sealId}`,
    generatedAt,
    supervisoryPostClosureMutationIncidentResolutionRecloseState: state,
    supervisoryPostClosureMutationIncidentResolutionRecloseReadinessScore: readiness,
    supervisoryPostClosureMutationIncidentResolutionRecloseEnvelope: {
      previousPostClosureWatchState: previousGate.supervisoryPostClosureMutationWatchAutoFreezeState,
      previousPostClosureWatchReadinessScore: previousGate.supervisoryPostClosureMutationWatchAutoFreezeReadinessScore,
      previousCanKeepFinalClosureClosed: previousReady,
      previousAutoFreezeRequired,
      previousMutationIncidentTicketId: previousEnvelope.mutationIncidentTicketId,
      previousPostClosureWatchPayloadHash: previousEnvelope.postClosureWatchPayloadHash,
      previousPostClosureWatchTimelineHash: previousEnvelope.postClosureWatchTimelineHash,
      resolutionCaseId: args.resolutionCaseId ?? null,
      resolutionOwnerPseudonym: args.resolutionOwnerPseudonym ?? null,
      rootCauseHash: args.rootCauseHash ?? null,
      impactScopeHash: args.impactScopeHash ?? null,
      correctedEvidenceIndexId: args.correctedEvidenceIndexId ?? null,
      correctedEvidenceIndexVersion: args.correctedEvidenceIndexVersion ?? null,
      correctedEvidenceIndexHash: args.correctedEvidenceIndexHash ?? null,
      correctedIndexVerificationReceiptId: args.correctedIndexVerificationReceiptId ?? null,
      resolutionDecision,
      recloseReceiptId: args.recloseReceiptId ?? null,
      permanentFreezeReceiptId: args.permanentFreezeReceiptId ?? null,
      reopenedInvestigationTicketId: args.reopenedInvestigationTicketId ?? null,
      customerNoticeResolutionReceiptId: args.customerNoticeResolutionReceiptId ?? null,
      regulatorNoticeResolutionReceiptId: args.regulatorNoticeResolutionReceiptId ?? null,
      auditorNoticeResolutionReceiptId: args.auditorNoticeResolutionReceiptId ?? null,
      legalSignoffReceiptId: args.legalSignoffReceiptId ?? null,
      securitySignoffReceiptId: args.securitySignoffReceiptId ?? null,
      privacySignoffReceiptId: args.privacySignoffReceiptId ?? null,
      correctedPostClosureWatchTimelineHash: args.correctedPostClosureWatchTimelineHash ?? null,
      resolutionPayloadHash: args.resolutionPayloadHash ?? null,
      resolutionTimelineHash: args.resolutionTimelineHash ?? null,
    },
    supervisoryPostClosureMutationIncidentResolutionReclosePolicy: {
      canRecloseFinalClosure,
      mustRemainFrozen,
      mustReopenInvestigation,
      canClaimProductionRecloseWorker: false,
      reason: canRecloseFinalClosure
        ? "PASS2872 allows final closure to be re-closed only after corrected index verification, new notices/signoffs and corrected post-closure watch timeline are sealed."
        : mustReopenInvestigation
          ? "PASS2872 keeps the chain open because the resolution decision reopened investigation and requires a fresh incident track."
          : "PASS2872 keeps archive/export freeze active until mutation incident resolution, corrected evidence index, notices, signoffs and timeline hashes are complete.",
    },
    supervisoryPostClosureMutationIncidentResolutionRecloseRiskSignals: {
      previousPostClosureWatchNotReady: !previousReady,
      resolutionCaseMissing: !resolutionCaseReady,
      rootCauseMissing: !args.rootCauseHash,
      impactScopeMissing: !args.impactScopeHash,
      correctedIndexVerificationMissing: !correctedIndexReady,
      resolutionDecisionMissing: !decisionReady,
      recloseReceiptMissing: resolutionDecision === "re_close_after_reseal" && !args.recloseReceiptId,
      permanentFreezeReceiptMissing: resolutionDecision === "permanent_freeze" && !args.permanentFreezeReceiptId,
      reopenedInvestigationTicketMissing: resolutionDecision === "reopen_investigation" && !args.reopenedInvestigationTicketId,
      noticeResolutionMissing: !noticeReady,
      signoffMissing: !signoffReady,
      correctedWatchTimelineMissing: !args.correctedPostClosureWatchTimelineHash,
      payloadHashMissing: !args.resolutionPayloadHash,
      timelineHashMissing: !args.resolutionTimelineHash,
    },
    customerSafeCopy:
      "Velmere treats a post-closure mutation incident as unresolved until root cause, corrected evidence index, notice resolution and legal/security/privacy signoff prove whether final closure can be re-closed or must remain frozen.",
    operatorNextActions: canRecloseFinalClosure
      ? [
          "Attach the corrected post-closure watch timeline to the final archive close board.",
          "Keep mutation watch enabled after re-close and preserve the old frozen index as evidence.",
          "Do not reuse PASS2871 auto-freeze receipts for future mutation incidents.",
        ]
      : [
          "Keep archive close and customer export channels frozen until PASS2872 receipts are complete.",
          "Collect root cause, corrected index verification, notice-resolution receipts and legal/security/privacy signoff.",
          "Choose re-close, permanent freeze or reopened investigation explicitly before release-readiness can treat the closure as settled.",
        ],
  };
}
