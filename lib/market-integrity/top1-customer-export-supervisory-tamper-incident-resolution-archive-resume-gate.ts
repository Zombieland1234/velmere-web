import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2868CustomerExportSupervisoryEvidenceIndexTamperIncidentGate } from "@/lib/market-integrity/top1-customer-export-supervisory-evidence-index-tamper-incident-gate";

export type Pass2869CustomerExportSupervisoryTamperResolutionDecision =
  | "pending"
  | "re_seal_and_resume"
  | "re_freeze"
  | "close_no_change"
  | "reject_resume";

export type Pass2869CustomerExportSupervisoryTamperIncidentResolutionArchiveResumeState =
  | "previous_tamper_incident_not_ready"
  | "resolution_case_missing"
  | "root_cause_missing"
  | "impact_scope_missing"
  | "corrected_index_verification_missing"
  | "archive_resume_decision_missing"
  | "notice_resolution_missing"
  | "closure_signoff_missing"
  | "incident_closure_timeline_missing"
  | "supervisory_tamper_incident_resolution_archive_resume_ready";

export type Pass2869CustomerExportSupervisoryTamperFinalNoticeReceipt = {
  target: "customer" | "regulator" | "auditor" | "legal" | "security" | "privacy_supervisor";
  noticeReceiptId: string | null;
  deliveredAt: string | null;
  suppressionReasonHash: string | null;
};

export type Pass2869CustomerExportSupervisoryTamperIncidentResolutionArchiveResumeGate = {
  schemaVersion: "pass2869_customer_export_supervisory_tamper_incident_resolution_archive_resume_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryTamperIncidentResolutionArchiveResumeState: Pass2869CustomerExportSupervisoryTamperIncidentResolutionArchiveResumeState;
  supervisoryTamperIncidentResolutionArchiveResumeReadinessScore: number;
  supervisoryTamperIncidentResolutionArchiveResumeEnvelope: {
    previousTamperIncidentState: string;
    previousTamperIncidentReadinessScore: number;
    previousCanResumeSupervisoryArchiveClose: boolean;
    previousTamperIncidentCaseId: string | null;
    previousTamperIncidentTimelineHash: string | null;
    previousFinalEvidenceIndexVersionBindingHash: string | null;
    resolutionCaseId: string | null;
    rootCauseHash: string | null;
    impactScopeHash: string | null;
    correctedEvidenceIndexId: string | null;
    correctedEvidenceIndexVersion: string | null;
    correctedEvidenceIndexHash: string | null;
    correctedIndexVerificationReceiptId: string | null;
    archiveResumeDecisionReceiptId: string | null;
    archiveResumeDecision: Pass2869CustomerExportSupervisoryTamperResolutionDecision;
    reFreezeReceiptId: string | null;
    archiveResumeReceiptId: string | null;
    finalNoticeReceipts: Pass2869CustomerExportSupervisoryTamperFinalNoticeReceipt[];
    legalClosureSignoffReceiptId: string | null;
    securityClosureSignoffReceiptId: string | null;
    privacyClosureSignoffReceiptId: string | null;
    resolutionPayloadHash: string | null;
    incidentClosureTimelineHash: string | null;
  };
  supervisoryTamperIncidentResolutionArchiveResumePolicy: {
    canResolveTamperIncident: boolean;
    canResumeSupervisoryArchiveClose: boolean;
    mustKeepEvidenceIndexFrozen: boolean;
    mustCreateFollowupPacketInsteadOfMutatingOriginalArchive: true;
    canClaimProductionTamperResolution: false;
    reason: string;
  };
  supervisoryTamperIncidentResolutionArchiveResumeRiskSignals: {
    previousTamperIncidentNotReady: boolean;
    resolutionCaseMissing: boolean;
    rootCauseMissing: boolean;
    impactScopeMissing: boolean;
    correctedIndexVerificationMissing: boolean;
    decisionMissing: boolean;
    reFreezeReceiptMissingWhenRefrozen: boolean;
    archiveResumeReceiptMissingWhenResumed: boolean;
    noticeReceiptMissing: boolean;
    closureSignoffMissing: boolean;
    resolutionPayloadHashMissing: boolean;
    incidentClosureTimelineMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2869_CUSTOMER_EXPORT_SUPERVISORY_TAMPER_INCIDENT_RESOLUTION_ARCHIVE_RESUME_ACCEPTANCE_GATES = [
  "PASS2869: Tamper incident case creation is not the same as tamper incident resolution or archive resume.",
  "PASS2869: Root cause, impact scope and corrected evidence-index verification are required before any archive-resume decision.",
  "PASS2869: Archive resume and re-freeze are mutually receipt-bound decisions; neither can happen silently after a tamper incident.",
  "PASS2869: Customer/regulator/auditor final notice receipts or suppression hashes are required before closure.",
  "PASS2869: Original supervisory archive remains immutable; resolution must use follow-up packets, corrected hashes and incident closure timeline hash.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeFinalNoticeReceipts(
  receipts?: Pass2869CustomerExportSupervisoryTamperFinalNoticeReceipt[] | null,
) {
  return (receipts ?? []).map((receipt) => ({
    target: receipt.target,
    noticeReceiptId: receipt.noticeReceiptId ?? null,
    deliveredAt: receipt.deliveredAt ?? null,
    suppressionReasonHash: receipt.suppressionReasonHash ?? null,
  })) satisfies Pass2869CustomerExportSupervisoryTamperFinalNoticeReceipt[];
}

export function buildPass2869CustomerExportSupervisoryTamperIncidentResolutionArchiveResumeGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryEvidenceIndexTamperIncidentGate: Pass2868CustomerExportSupervisoryEvidenceIndexTamperIncidentGate;
  generatedAt?: string;
  resolutionCaseId?: string | null;
  rootCauseHash?: string | null;
  impactScopeHash?: string | null;
  correctedEvidenceIndexId?: string | null;
  correctedEvidenceIndexVersion?: string | null;
  correctedEvidenceIndexHash?: string | null;
  correctedIndexVerificationReceiptId?: string | null;
  archiveResumeDecisionReceiptId?: string | null;
  archiveResumeDecision?: Pass2869CustomerExportSupervisoryTamperResolutionDecision | null;
  reFreezeReceiptId?: string | null;
  archiveResumeReceiptId?: string | null;
  finalNoticeReceipts?: Pass2869CustomerExportSupervisoryTamperFinalNoticeReceipt[] | null;
  legalClosureSignoffReceiptId?: string | null;
  securityClosureSignoffReceiptId?: string | null;
  privacyClosureSignoffReceiptId?: string | null;
  resolutionPayloadHash?: string | null;
  incidentClosureTimelineHash?: string | null;
}): Pass2869CustomerExportSupervisoryTamperIncidentResolutionArchiveResumeGate {
  const previousGate = args.customerExportSupervisoryEvidenceIndexTamperIncidentGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousEnvelope = previousGate.supervisoryEvidenceIndexTamperIncidentEnvelope;
  const previousReady = Boolean(previousGate.supervisoryEvidenceIndexTamperIncidentPolicy.canResumeSupervisoryArchiveClose);
  const decision = args.archiveResumeDecision ?? "pending";
  const notices = normalizeFinalNoticeReceipts(args.finalNoticeReceipts);
  const noticeReceiptMissing = notices.length === 0 || notices.some((receipt) => !receipt.deliveredAt || (!receipt.noticeReceiptId && !receipt.suppressionReasonHash));
  const closureSignoffMissing = !(args.legalClosureSignoffReceiptId && args.securityClosureSignoffReceiptId && args.privacyClosureSignoffReceiptId);
  const correctedIndexReady = Boolean(args.correctedEvidenceIndexId && args.correctedEvidenceIndexVersion && args.correctedEvidenceIndexHash && args.correctedIndexVerificationReceiptId);
  const decisionReceipted = Boolean(args.archiveResumeDecisionReceiptId && decision !== "pending");
  const archiveResumeReceiptMissingWhenResumed = decision === "re_seal_and_resume" && !args.archiveResumeReceiptId;
  const reFreezeReceiptMissingWhenRefrozen = (decision === "re_freeze" || decision === "reject_resume") && !args.reFreezeReceiptId;

  const ready = Boolean(
    previousReady &&
      args.resolutionCaseId &&
      args.rootCauseHash &&
      args.impactScopeHash &&
      correctedIndexReady &&
      decisionReceipted &&
      !archiveResumeReceiptMissingWhenResumed &&
      !reFreezeReceiptMissingWhenRefrozen &&
      !noticeReceiptMissing &&
      !closureSignoffMissing &&
      args.resolutionPayloadHash &&
      args.incidentClosureTimelineHash,
  );

  const state: Pass2869CustomerExportSupervisoryTamperIncidentResolutionArchiveResumeState = !previousReady
    ? "previous_tamper_incident_not_ready"
    : !args.resolutionCaseId
      ? "resolution_case_missing"
      : !args.rootCauseHash
        ? "root_cause_missing"
        : !args.impactScopeHash
          ? "impact_scope_missing"
          : !correctedIndexReady
            ? "corrected_index_verification_missing"
            : !decisionReceipted || archiveResumeReceiptMissingWhenResumed || reFreezeReceiptMissingWhenRefrozen
              ? "archive_resume_decision_missing"
              : noticeReceiptMissing
                ? "notice_resolution_missing"
                : closureSignoffMissing
                  ? "closure_signoff_missing"
                  : !(args.resolutionPayloadHash && args.incidentClosureTimelineHash)
                    ? "incident_closure_timeline_missing"
                    : "supervisory_tamper_incident_resolution_archive_resume_ready";

  const readiness = clamp(
    previousGate.supervisoryEvidenceIndexTamperIncidentReadinessScore +
      (previousReady ? 8 : -55) +
      (args.resolutionCaseId ? 9 : -18) +
      (args.rootCauseHash ? 8 : -16) +
      (args.impactScopeHash ? 8 : -16) +
      (args.correctedEvidenceIndexId ? 6 : -10) +
      (args.correctedEvidenceIndexVersion ? 6 : -10) +
      (args.correctedEvidenceIndexHash ? 6 : -10) +
      (args.correctedIndexVerificationReceiptId ? 10 : -18) +
      (decisionReceipted ? 10 : -20) +
      (!archiveResumeReceiptMissingWhenResumed ? 5 : -15) +
      (!reFreezeReceiptMissingWhenRefrozen ? 5 : -15) +
      (!noticeReceiptMissing ? 8 : -16) +
      (!closureSignoffMissing ? 9 : -18) +
      (args.resolutionPayloadHash ? 6 : -12) +
      (args.incidentClosureTimelineHash ? 10 : -20),
  );

  return {
    schemaVersion: "pass2869_customer_export_supervisory_tamper_incident_resolution_archive_resume_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryTamperIncidentResolutionArchiveResumeState: state,
    supervisoryTamperIncidentResolutionArchiveResumeReadinessScore: readiness,
    supervisoryTamperIncidentResolutionArchiveResumeEnvelope: {
      previousTamperIncidentState: previousGate.supervisoryEvidenceIndexTamperIncidentState,
      previousTamperIncidentReadinessScore: previousGate.supervisoryEvidenceIndexTamperIncidentReadinessScore,
      previousCanResumeSupervisoryArchiveClose: previousReady,
      previousTamperIncidentCaseId: previousEnvelope.tamperIncidentCaseId,
      previousTamperIncidentTimelineHash: previousEnvelope.tamperIncidentTimelineHash,
      previousFinalEvidenceIndexVersionBindingHash: previousEnvelope.finalEvidenceIndexVersionBindingHash,
      resolutionCaseId: args.resolutionCaseId ?? null,
      rootCauseHash: args.rootCauseHash ?? null,
      impactScopeHash: args.impactScopeHash ?? null,
      correctedEvidenceIndexId: args.correctedEvidenceIndexId ?? null,
      correctedEvidenceIndexVersion: args.correctedEvidenceIndexVersion ?? null,
      correctedEvidenceIndexHash: args.correctedEvidenceIndexHash ?? null,
      correctedIndexVerificationReceiptId: args.correctedIndexVerificationReceiptId ?? null,
      archiveResumeDecisionReceiptId: args.archiveResumeDecisionReceiptId ?? null,
      archiveResumeDecision: decision,
      reFreezeReceiptId: args.reFreezeReceiptId ?? null,
      archiveResumeReceiptId: args.archiveResumeReceiptId ?? null,
      finalNoticeReceipts: notices,
      legalClosureSignoffReceiptId: args.legalClosureSignoffReceiptId ?? null,
      securityClosureSignoffReceiptId: args.securityClosureSignoffReceiptId ?? null,
      privacyClosureSignoffReceiptId: args.privacyClosureSignoffReceiptId ?? null,
      resolutionPayloadHash: args.resolutionPayloadHash ?? null,
      incidentClosureTimelineHash: args.incidentClosureTimelineHash ?? null,
    },
    supervisoryTamperIncidentResolutionArchiveResumePolicy: {
      canResolveTamperIncident: ready,
      canResumeSupervisoryArchiveClose: ready && decision === "re_seal_and_resume",
      mustKeepEvidenceIndexFrozen: !ready || decision !== "re_seal_and_resume",
      mustCreateFollowupPacketInsteadOfMutatingOriginalArchive: true,
      canClaimProductionTamperResolution: false,
      reason: ready
        ? "PASS2869 tamper incident is root-caused, impact-scoped, corrected-index verified, notice-closed and signed off. Production tamper remediation is still not claimed without live SIEM/DB/storage workflows."
        : "PASS2869 keeps the supervisory archive close frozen until tamper resolution case, root cause, impact scope, corrected index verification, decision receipts, notices, signoffs and closure timeline hash exist.",
    },
    supervisoryTamperIncidentResolutionArchiveResumeRiskSignals: {
      previousTamperIncidentNotReady: !previousReady,
      resolutionCaseMissing: !args.resolutionCaseId,
      rootCauseMissing: !args.rootCauseHash,
      impactScopeMissing: !args.impactScopeHash,
      correctedIndexVerificationMissing: !correctedIndexReady,
      decisionMissing: !decisionReceipted,
      reFreezeReceiptMissingWhenRefrozen,
      archiveResumeReceiptMissingWhenResumed,
      noticeReceiptMissing,
      closureSignoffMissing,
      resolutionPayloadHashMissing: !args.resolutionPayloadHash,
      incidentClosureTimelineMissing: !args.incidentClosureTimelineHash,
    },
    customerSafeCopy: "Tamper incident creation is not the same as resolution. Velmère must preserve the original supervisory archive, record root cause and impact scope, verify a corrected index, issue final notices and sign off closure before archive resume is allowed.",
    operatorNextActions: ready
      ? [
          "Bind the tamper resolution case to the original frozen evidence-index version and archive hash.",
          "Do not mutate the original supervisory archive; attach corrected follow-up packets and closure timeline hash.",
          "Replace fixture receipts with live SIEM, DB, storage, notice and operator-review receipts before production claims.",
        ]
      : [
          "Attach a tamper resolution case, root-cause hash and impact-scope hash.",
          "Verify corrected evidence index ID/version/hash and choose archive resume or re-freeze with receipts.",
          "Attach customer/regulator/auditor final notice receipts or suppression hashes plus legal/security/privacy closure signoff.",
        ],
  };
}
