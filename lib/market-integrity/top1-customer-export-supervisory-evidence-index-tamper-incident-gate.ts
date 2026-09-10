import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2867CustomerExportSupervisoryFinalEvidenceIndexFreezeGate } from "@/lib/market-integrity/top1-customer-export-supervisory-final-evidence-index-freeze-gate";

export type Pass2868CustomerExportSupervisoryEvidenceIndexTamperSeverity =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type Pass2868CustomerExportSupervisoryEvidenceIndexTamperNoticeTarget =
  | "customer"
  | "regulator"
  | "auditor"
  | "legal"
  | "security"
  | "privacy_supervisor";

export type Pass2868CustomerExportSupervisoryEvidenceIndexTamperNoticeDecision = {
  target: Pass2868CustomerExportSupervisoryEvidenceIndexTamperNoticeTarget;
  decision: "notify" | "suppress" | "defer";
  noticeReceiptId: string | null;
  suppressionOrDeferralReasonHash: string | null;
  decidedAt: string | null;
};

export type Pass2868CustomerExportSupervisoryEvidenceIndexTamperIncidentState =
  | "previous_final_index_not_frozen"
  | "tamper_signal_missing"
  | "tamper_incident_case_missing"
  | "tamper_severity_missing"
  | "tamper_freeze_missing"
  | "owner_sla_missing"
  | "legal_security_review_missing"
  | "notice_decision_missing"
  | "index_binding_missing"
  | "incident_timeline_hash_missing"
  | "supervisory_evidence_index_tamper_incident_ready";

export type Pass2868CustomerExportSupervisoryEvidenceIndexTamperIncidentGate = {
  schemaVersion: "pass2868_customer_export_supervisory_evidence_index_tamper_incident_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryEvidenceIndexTamperIncidentState: Pass2868CustomerExportSupervisoryEvidenceIndexTamperIncidentState;
  supervisoryEvidenceIndexTamperIncidentReadinessScore: number;
  supervisoryEvidenceIndexTamperIncidentEnvelope: {
    previousFinalIndexFreezeState: string;
    previousFinalIndexFreezeReadinessScore: number;
    previousCanClaimPostResolutionIndexImmutable: boolean;
    previousFinalEvidenceIndexId: string | null;
    previousFinalEvidenceIndexVersion: string | null;
    previousFinalEvidenceIndexHash: string | null;
    previousFinalEvidenceIndexFreezeReceiptId: string | null;
    previousFinalEvidenceIndexTimelineHash: string | null;
    tamperSignalReceiptId: string | null;
    tamperSignalKind: "write_attempt" | "delete_attempt" | "reindex_attempt" | "hash_drift" | "channel_rebind" | "unknown";
    tamperIncidentCaseId: string | null;
    tamperSeverity: Pass2868CustomerExportSupervisoryEvidenceIndexTamperSeverity;
    evidenceIndexFreezeExtensionReceiptId: string | null;
    supervisoryArchiveCloseFreezeReceiptId: string | null;
    incidentOwnerPseudonym: string | null;
    incidentSlaDueAt: string | null;
    legalReviewReceiptId: string | null;
    securityReviewReceiptId: string | null;
    privacySupervisorReviewReceiptId: string | null;
    customerRegulatorAuditorNoticeDecisions: Pass2868CustomerExportSupervisoryEvidenceIndexTamperNoticeDecision[];
    finalEvidenceIndexVersionBindingHash: string | null;
    tamperIncidentPayloadHash: string | null;
    tamperIncidentTimelineHash: string | null;
  };
  supervisoryEvidenceIndexTamperIncidentPolicy: {
    canCreateTamperIncident: boolean;
    mustFreezeFinalEvidenceIndex: boolean;
    mustFreezeSupervisoryArchiveClose: boolean;
    canResumeSupervisoryArchiveClose: boolean;
    canClaimProductionTamperMonitoring: false;
    reason: string;
  };
  supervisoryEvidenceIndexTamperIncidentRiskSignals: {
    previousIndexNotFrozen: boolean;
    tamperSignalMissing: boolean;
    incidentCaseMissing: boolean;
    severityMissing: boolean;
    freezeExtensionMissing: boolean;
    archiveCloseFreezeMissing: boolean;
    ownerMissing: boolean;
    slaMissing: boolean;
    legalReviewMissing: boolean;
    securityReviewMissing: boolean;
    privacySupervisorReviewMissing: boolean;
    noticeDecisionMissing: boolean;
    noticeReceiptMissingForNotify: boolean;
    indexVersionBindingMissing: boolean;
    incidentPayloadHashMissing: boolean;
    incidentTimelineMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2868_CUSTOMER_EXPORT_SUPERVISORY_EVIDENCE_INDEX_TAMPER_INCIDENT_ACCEPTANCE_GATES = [
  "PASS2868: Final evidence-index freeze is not the same as tamper/mutation incident handling.",
  "PASS2868: Any post-freeze mutation, delete, reindex, hash drift or channel-rebind signal must create a tamper incident case and freeze supervisory archive close.",
  "PASS2868: Tamper incident response must bind the signal to the final evidence index ID/version/hash and final freeze receipt.",
  "PASS2868: Severity, owner, SLA, legal/security/privacy review and notice decisions are required before the tamper incident can be treated as controlled.",
  "PASS2868: Customer/regulator/auditor notice decisions require receipts or suppression/deferral reason hashes; missing notice evidence keeps the archive close frozen.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeNoticeDecisions(
  decisions?: Pass2868CustomerExportSupervisoryEvidenceIndexTamperNoticeDecision[] | null,
) {
  return (decisions ?? []).map((decision) => ({
    target: decision.target,
    decision: decision.decision,
    noticeReceiptId: decision.noticeReceiptId ?? null,
    suppressionOrDeferralReasonHash: decision.suppressionOrDeferralReasonHash ?? null,
    decidedAt: decision.decidedAt ?? null,
  })) satisfies Pass2868CustomerExportSupervisoryEvidenceIndexTamperNoticeDecision[];
}

export function buildPass2868CustomerExportSupervisoryEvidenceIndexTamperIncidentGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryFinalEvidenceIndexFreezeGate: Pass2867CustomerExportSupervisoryFinalEvidenceIndexFreezeGate;
  generatedAt?: string;
  tamperSignalReceiptId?: string | null;
  tamperSignalKind?: "write_attempt" | "delete_attempt" | "reindex_attempt" | "hash_drift" | "channel_rebind" | "unknown";
  tamperIncidentCaseId?: string | null;
  tamperSeverity?: Pass2868CustomerExportSupervisoryEvidenceIndexTamperSeverity | null;
  evidenceIndexFreezeExtensionReceiptId?: string | null;
  supervisoryArchiveCloseFreezeReceiptId?: string | null;
  incidentOwnerPseudonym?: string | null;
  incidentSlaDueAt?: string | null;
  legalReviewReceiptId?: string | null;
  securityReviewReceiptId?: string | null;
  privacySupervisorReviewReceiptId?: string | null;
  customerRegulatorAuditorNoticeDecisions?: Pass2868CustomerExportSupervisoryEvidenceIndexTamperNoticeDecision[] | null;
  finalEvidenceIndexVersionBindingHash?: string | null;
  tamperIncidentPayloadHash?: string | null;
  tamperIncidentTimelineHash?: string | null;
}): Pass2868CustomerExportSupervisoryEvidenceIndexTamperIncidentGate {
  const previousGate = args.customerExportSupervisoryFinalEvidenceIndexFreezeGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousEnvelope = previousGate.supervisoryFinalEvidenceIndexFreezeEnvelope;
  const previousReady = Boolean(previousGate.supervisoryFinalEvidenceIndexFreezePolicy.canClaimPostResolutionIndexImmutable);
  const noticeDecisions = normalizeNoticeDecisions(args.customerRegulatorAuditorNoticeDecisions);
  const notifyDecisions = noticeDecisions.filter((decision) => decision.decision === "notify");
  const noticeReceiptMissingForNotify = notifyDecisions.some((decision) => !decision.noticeReceiptId || !decision.decidedAt);
  const noticeDecisionMissing = noticeDecisions.length === 0 || noticeDecisions.some((decision) =>
    !decision.decidedAt || (decision.decision !== "notify" && !decision.suppressionOrDeferralReasonHash),
  );
  const severity = args.tamperSeverity ?? "none";

  const ready = Boolean(
    previousReady &&
      args.tamperSignalReceiptId &&
      args.tamperIncidentCaseId &&
      severity !== "none" &&
      args.evidenceIndexFreezeExtensionReceiptId &&
      args.supervisoryArchiveCloseFreezeReceiptId &&
      args.incidentOwnerPseudonym &&
      args.incidentSlaDueAt &&
      args.legalReviewReceiptId &&
      args.securityReviewReceiptId &&
      args.privacySupervisorReviewReceiptId &&
      !noticeDecisionMissing &&
      !noticeReceiptMissingForNotify &&
      args.finalEvidenceIndexVersionBindingHash &&
      args.tamperIncidentPayloadHash &&
      args.tamperIncidentTimelineHash,
  );

  const state: Pass2868CustomerExportSupervisoryEvidenceIndexTamperIncidentState = !previousReady
    ? "previous_final_index_not_frozen"
    : !args.tamperSignalReceiptId
      ? "tamper_signal_missing"
      : !args.tamperIncidentCaseId
        ? "tamper_incident_case_missing"
        : severity === "none"
          ? "tamper_severity_missing"
          : !(args.evidenceIndexFreezeExtensionReceiptId && args.supervisoryArchiveCloseFreezeReceiptId)
            ? "tamper_freeze_missing"
            : !(args.incidentOwnerPseudonym && args.incidentSlaDueAt)
              ? "owner_sla_missing"
              : !(args.legalReviewReceiptId && args.securityReviewReceiptId && args.privacySupervisorReviewReceiptId)
                ? "legal_security_review_missing"
                : noticeDecisionMissing || noticeReceiptMissingForNotify
                  ? "notice_decision_missing"
                  : !args.finalEvidenceIndexVersionBindingHash
                    ? "index_binding_missing"
                    : !(args.tamperIncidentPayloadHash && args.tamperIncidentTimelineHash)
                      ? "incident_timeline_hash_missing"
                      : "supervisory_evidence_index_tamper_incident_ready";

  const readiness = clamp(
    previousGate.supervisoryFinalEvidenceIndexFreezeReadinessScore +
      (previousReady ? 8 : -45) +
      (args.tamperSignalReceiptId ? 10 : -20) +
      (args.tamperIncidentCaseId ? 10 : -20) +
      (severity !== "none" ? 8 : -14) +
      (args.evidenceIndexFreezeExtensionReceiptId ? 9 : -16) +
      (args.supervisoryArchiveCloseFreezeReceiptId ? 9 : -16) +
      (args.incidentOwnerPseudonym ? 6 : -10) +
      (args.incidentSlaDueAt ? 6 : -10) +
      (args.legalReviewReceiptId ? 7 : -12) +
      (args.securityReviewReceiptId ? 7 : -12) +
      (args.privacySupervisorReviewReceiptId ? 7 : -12) +
      (!noticeDecisionMissing ? 8 : -15) +
      (!noticeReceiptMissingForNotify ? 6 : -14) +
      (args.finalEvidenceIndexVersionBindingHash ? 8 : -16) +
      (args.tamperIncidentPayloadHash ? 6 : -12) +
      (args.tamperIncidentTimelineHash ? 10 : -18),
  );

  return {
    schemaVersion: "pass2868_customer_export_supervisory_evidence_index_tamper_incident_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryEvidenceIndexTamperIncidentState: state,
    supervisoryEvidenceIndexTamperIncidentReadinessScore: readiness,
    supervisoryEvidenceIndexTamperIncidentEnvelope: {
      previousFinalIndexFreezeState: previousGate.supervisoryFinalEvidenceIndexFreezeState,
      previousFinalIndexFreezeReadinessScore: previousGate.supervisoryFinalEvidenceIndexFreezeReadinessScore,
      previousCanClaimPostResolutionIndexImmutable: previousReady,
      previousFinalEvidenceIndexId: previousEnvelope.finalEvidenceIndexId,
      previousFinalEvidenceIndexVersion: previousEnvelope.finalEvidenceIndexVersion,
      previousFinalEvidenceIndexHash: previousEnvelope.finalEvidenceIndexHash,
      previousFinalEvidenceIndexFreezeReceiptId: previousEnvelope.finalEvidenceIndexFreezeReceiptId,
      previousFinalEvidenceIndexTimelineHash: previousEnvelope.finalEvidenceIndexFreezeTimelineHash,
      tamperSignalReceiptId: args.tamperSignalReceiptId ?? null,
      tamperSignalKind: args.tamperSignalKind ?? "unknown",
      tamperIncidentCaseId: args.tamperIncidentCaseId ?? null,
      tamperSeverity: severity,
      evidenceIndexFreezeExtensionReceiptId: args.evidenceIndexFreezeExtensionReceiptId ?? null,
      supervisoryArchiveCloseFreezeReceiptId: args.supervisoryArchiveCloseFreezeReceiptId ?? null,
      incidentOwnerPseudonym: args.incidentOwnerPseudonym ?? null,
      incidentSlaDueAt: args.incidentSlaDueAt ?? null,
      legalReviewReceiptId: args.legalReviewReceiptId ?? null,
      securityReviewReceiptId: args.securityReviewReceiptId ?? null,
      privacySupervisorReviewReceiptId: args.privacySupervisorReviewReceiptId ?? null,
      customerRegulatorAuditorNoticeDecisions: noticeDecisions,
      finalEvidenceIndexVersionBindingHash: args.finalEvidenceIndexVersionBindingHash ?? null,
      tamperIncidentPayloadHash: args.tamperIncidentPayloadHash ?? null,
      tamperIncidentTimelineHash: args.tamperIncidentTimelineHash ?? null,
    },
    supervisoryEvidenceIndexTamperIncidentPolicy: {
      canCreateTamperIncident: Boolean(args.tamperSignalReceiptId && args.tamperIncidentCaseId),
      mustFreezeFinalEvidenceIndex: true,
      mustFreezeSupervisoryArchiveClose: true,
      canResumeSupervisoryArchiveClose: ready,
      canClaimProductionTamperMonitoring: false,
      reason: ready
        ? "PASS2868 tamper incident is classified, case-bound, index-version-bound, reviewed and notice-decisioned; production monitoring is still not claimed."
        : "PASS2868 keeps supervisory archive close frozen until tamper signal, incident case, severity, freeze extension, owner/SLA, legal/security/privacy review, notice decisions and timeline hash exist.",
    },
    supervisoryEvidenceIndexTamperIncidentRiskSignals: {
      previousIndexNotFrozen: !previousReady,
      tamperSignalMissing: !args.tamperSignalReceiptId,
      incidentCaseMissing: !args.tamperIncidentCaseId,
      severityMissing: severity === "none",
      freezeExtensionMissing: !args.evidenceIndexFreezeExtensionReceiptId,
      archiveCloseFreezeMissing: !args.supervisoryArchiveCloseFreezeReceiptId,
      ownerMissing: !args.incidentOwnerPseudonym,
      slaMissing: !args.incidentSlaDueAt,
      legalReviewMissing: !args.legalReviewReceiptId,
      securityReviewMissing: !args.securityReviewReceiptId,
      privacySupervisorReviewMissing: !args.privacySupervisorReviewReceiptId,
      noticeDecisionMissing,
      noticeReceiptMissingForNotify,
      indexVersionBindingMissing: !args.finalEvidenceIndexVersionBindingHash,
      incidentPayloadHashMissing: !args.tamperIncidentPayloadHash,
      incidentTimelineMissing: !args.tamperIncidentTimelineHash,
    },
    customerSafeCopy: "Final supervisory evidence-index freeze is not enough by itself. If a post-freeze mutation/tamper signal appears, Velmère freezes supervisory archive close, opens an incident case, binds the case to the frozen index version/hash and records review/notice decisions before anything can resume.",
    operatorNextActions: ready
      ? [
          "Keep the tamper incident attached to the final evidence-index version/hash.",
          "Do not mutate the original archive; use follow-up packets and signed timelines only.",
          "Replace fixture receipts with DB-backed incident, SIEM and notice receipts before production claims.",
        ]
      : [
          "Attach tamper signal and tamper incident case receipts.",
          "Freeze final evidence index and supervisory archive close while the tamper incident is open.",
          "Add owner/SLA plus legal, security and privacy supervisor reviews.",
          "Record customer/regulator/auditor notice decisions with receipts or suppression/deferral reason hashes.",
        ],
  };
}
