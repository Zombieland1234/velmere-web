import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2858CustomerExportSupervisoryEvidenceIndexGate } from "@/lib/market-integrity/top1-customer-export-supervisory-evidence-index-gate";

export type Pass2859CustomerExportSupervisoryDisclosureResponseCorrectionState =
  | "supervisory_evidence_index_not_ready"
  | "disclosure_response_case_id_missing"
  | "supervisory_request_intake_receipt_missing"
  | "response_draft_receipt_missing"
  | "supplemental_evidence_manifest_missing"
  | "correction_review_receipt_missing"
  | "corrected_supervisory_packet_missing"
  | "corrected_redaction_manifest_missing"
  | "original_archive_binding_missing"
  | "original_archive_mutation_attempted"
  | "response_channel_receipt_missing"
  | "customer_notice_reassessment_missing"
  | "response_audit_timeline_hash_missing"
  | "supervisory_disclosure_response_correction_ready";

export type Pass2859CustomerExportSupervisoryResponseType =
  | "clarification_response"
  | "supplemental_evidence"
  | "correction_notice"
  | "withdrawal_notice"
  | "closure_response";

export type Pass2859CustomerExportSupervisoryResponseChannel = "secure_vault" | "legal" | "regulator" | "auditor" | "operator_console";

export type Pass2859CustomerExportSupervisoryResponseChannelReceipt = {
  channel: Pass2859CustomerExportSupervisoryResponseChannel;
  channelReceiptId: string;
  responsePacketId: string;
  correctedRedactionManifestHash: string;
  deliveredAt: string;
  acknowledgedByRecipient: boolean;
};

export type Pass2859CustomerExportSupervisoryDisclosureResponseCorrectionGate = {
  schemaVersion: "pass2859_customer_export_supervisory_disclosure_response_correction_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryDisclosureResponseCorrectionState: Pass2859CustomerExportSupervisoryDisclosureResponseCorrectionState;
  supervisoryDisclosureResponseCorrectionReadinessScore: number;
  supervisoryDisclosureResponseCorrectionEnvelope: {
    previousSupervisoryEvidenceIndexState: string;
    previousSupervisoryEvidenceIndexReadinessScore: number;
    previousCanReleaseSupervisoryEvidencePacket: boolean;
    responseType: Pass2859CustomerExportSupervisoryResponseType;
    disclosureResponseCaseId: string | null;
    supervisoryRequestIntakeReceiptId: string | null;
    responseDraftReceiptId: string | null;
    supplementalEvidenceManifestHash: string | null;
    correctionReviewReceiptId: string | null;
    correctedSupervisoryPacketId: string | null;
    correctedRedactionManifestHash: string | null;
    originalArchiveBindingHash: string | null;
    originalArchiveMutationAttempted: boolean;
    responseChannelReceipts: Pass2859CustomerExportSupervisoryResponseChannelReceipt[];
    customerNoticeReassessmentReceiptId: string | null;
    customerNoticeSuppressedReason: string | null;
    exportFreezeReceiptId: string | null;
    responseAuditTimelineHash: string | null;
  };
  supervisoryDisclosureResponseCorrectionPolicy: {
    canReleaseSupervisoryDisclosureResponsePacket: boolean;
    canMutateOriginalSupervisoryArchive: false;
    canClaimProductionSupervisoryResponseCorrectionWorkflow: false;
    reason: string;
  };
  supervisoryDisclosureResponseCorrectionRiskSignals: {
    previousSupervisoryEvidenceIndexNotReady: boolean;
    missingDisclosureResponseCaseId: boolean;
    missingSupervisoryRequestIntakeReceipt: boolean;
    missingResponseDraftReceipt: boolean;
    missingSupplementalEvidenceManifest: boolean;
    missingCorrectionReviewReceipt: boolean;
    missingCorrectedSupervisoryPacket: boolean;
    missingCorrectedRedactionManifest: boolean;
    missingOriginalArchiveBinding: boolean;
    originalArchiveMutationAttempted: boolean;
    missingResponseChannelReceipt: boolean;
    missingCustomerNoticeReassessment: boolean;
    missingResponseAuditTimelineHash: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2859_CUSTOMER_EXPORT_SUPERVISORY_DISCLOSURE_RESPONSE_CORRECTION_ACCEPTANCE_GATES = [
  "PASS2859: Supervisory evidence index disclosure is not the same as response/correction handling.",
  "PASS2859: Regulator/auditor questions, supplemental evidence, correction notices and withdrawal notices require a separate response case, intake receipt, response draft receipt and correction review receipt.",
  "PASS2859: Corrected supervisory packets must be new packets with corrected redaction manifests; the original archive bundle must be bound and preserved rather than mutated in place.",
  "PASS2859: Every supervisory response channel requires its own receipt and acknowledgement, plus a customer notice reassessment or a documented suppression reason.",
  "PASS2859: This remains a deterministic contract/API boundary. Production claims require real case-management rows, legal/privacy review queues, immutable archive storage, secure response channels and durable response timeline receipts.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2859CustomerExportSupervisoryDisclosureResponseCorrectionGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryEvidenceIndexGate: Pass2858CustomerExportSupervisoryEvidenceIndexGate;
  generatedAt?: string;
  responseType?: Pass2859CustomerExportSupervisoryResponseType;
  disclosureResponseCaseId?: string | null;
  supervisoryRequestIntakeReceiptId?: string | null;
  responseDraftReceiptId?: string | null;
  supplementalEvidenceManifestHash?: string | null;
  correctionReviewReceiptId?: string | null;
  correctedSupervisoryPacketId?: string | null;
  correctedRedactionManifestHash?: string | null;
  originalArchiveBindingHash?: string | null;
  originalArchiveMutationAttempted?: boolean;
  responseChannelReceipts?: Pass2859CustomerExportSupervisoryResponseChannelReceipt[];
  customerNoticeReassessmentReceiptId?: string | null;
  customerNoticeSuppressedReason?: string | null;
  exportFreezeReceiptId?: string | null;
  responseAuditTimelineHash?: string | null;
}): Pass2859CustomerExportSupervisoryDisclosureResponseCorrectionGate {
  const previousGate = args.customerExportSupervisoryEvidenceIndexGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = previousGate.supervisoryEvidenceIndexState === "supervisory_evidence_index_ready";
  const responseType = args.responseType ?? "clarification_response";
  const responseChannelReceipts = args.responseChannelReceipts ?? [];
  const responseCaseReady = Boolean(args.disclosureResponseCaseId);
  const intakeReady = Boolean(args.supervisoryRequestIntakeReceiptId);
  const draftReady = Boolean(args.responseDraftReceiptId);
  const supplementalReady = Boolean(args.supplementalEvidenceManifestHash);
  const correctionReviewReady = Boolean(args.correctionReviewReceiptId);
  const correctedPacketReady = Boolean(args.correctedSupervisoryPacketId);
  const correctedRedactionReady = Boolean(args.correctedRedactionManifestHash);
  const originalArchiveBindingReady = Boolean(args.originalArchiveBindingHash);
  const originalArchiveMutationAttempted = Boolean(args.originalArchiveMutationAttempted);
  const responseChannelReady = responseChannelReceipts.length > 0 && responseChannelReceipts.every((receipt) => Boolean(receipt.channelReceiptId && receipt.responsePacketId && receipt.correctedRedactionManifestHash && receipt.deliveredAt && receipt.acknowledgedByRecipient));
  const noticeReassessmentReady = Boolean(args.customerNoticeReassessmentReceiptId || args.customerNoticeSuppressedReason);
  const timelineReady = Boolean(args.responseAuditTimelineHash);

  const ready = Boolean(
    previousReady &&
      responseCaseReady &&
      intakeReady &&
      draftReady &&
      supplementalReady &&
      correctionReviewReady &&
      correctedPacketReady &&
      correctedRedactionReady &&
      originalArchiveBindingReady &&
      !originalArchiveMutationAttempted &&
      responseChannelReady &&
      noticeReassessmentReady &&
      timelineReady,
  );

  const supervisoryDisclosureResponseCorrectionState: Pass2859CustomerExportSupervisoryDisclosureResponseCorrectionState = !previousReady
    ? "supervisory_evidence_index_not_ready"
    : !responseCaseReady
      ? "disclosure_response_case_id_missing"
      : !intakeReady
        ? "supervisory_request_intake_receipt_missing"
        : !draftReady
          ? "response_draft_receipt_missing"
          : !supplementalReady
            ? "supplemental_evidence_manifest_missing"
            : !correctionReviewReady
              ? "correction_review_receipt_missing"
              : !correctedPacketReady
                ? "corrected_supervisory_packet_missing"
                : !correctedRedactionReady
                  ? "corrected_redaction_manifest_missing"
                  : !originalArchiveBindingReady
                    ? "original_archive_binding_missing"
                    : originalArchiveMutationAttempted
                      ? "original_archive_mutation_attempted"
                      : !responseChannelReady
                        ? "response_channel_receipt_missing"
                        : !noticeReassessmentReady
                          ? "customer_notice_reassessment_missing"
                          : !timelineReady
                            ? "response_audit_timeline_hash_missing"
                            : "supervisory_disclosure_response_correction_ready";

  const supervisoryDisclosureResponseCorrectionReadinessScore = clamp(
    previousGate.supervisoryEvidenceIndexReadinessScore +
      (previousReady ? 7 : -50) +
      (responseCaseReady ? 8 : -15) +
      (intakeReady ? 9 : -16) +
      (draftReady ? 7 : -12) +
      (supplementalReady ? 9 : -16) +
      (correctionReviewReady ? 9 : -16) +
      (correctedPacketReady ? 9 : -16) +
      (correctedRedactionReady ? 9 : -16) +
      (originalArchiveBindingReady ? 8 : -16) +
      (!originalArchiveMutationAttempted ? 10 : -45) +
      (responseChannelReady ? 9 : -16) +
      (noticeReassessmentReady ? 7 : -12) +
      (timelineReady ? 8 : -14),
  );

  const reason = ready
    ? "Supervisory disclosure response is case-bound, intake-receipted, correction-reviewed, issued as a new redacted packet, channel-receipted and bound to the immutable original archive for this deterministic boundary."
    : `Supervisory disclosure response/correction boundary blocked at ${supervisoryDisclosureResponseCorrectionState}.`;

  return {
    schemaVersion: "pass2859_customer_export_supervisory_disclosure_response_correction_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryDisclosureResponseCorrectionState,
    supervisoryDisclosureResponseCorrectionReadinessScore,
    supervisoryDisclosureResponseCorrectionEnvelope: {
      previousSupervisoryEvidenceIndexState: previousGate.supervisoryEvidenceIndexState,
      previousSupervisoryEvidenceIndexReadinessScore: previousGate.supervisoryEvidenceIndexReadinessScore,
      previousCanReleaseSupervisoryEvidencePacket: previousGate.supervisoryEvidenceIndexPolicy.canReleaseSupervisoryEvidencePacket,
      responseType,
      disclosureResponseCaseId: args.disclosureResponseCaseId ?? null,
      supervisoryRequestIntakeReceiptId: args.supervisoryRequestIntakeReceiptId ?? null,
      responseDraftReceiptId: args.responseDraftReceiptId ?? null,
      supplementalEvidenceManifestHash: args.supplementalEvidenceManifestHash ?? null,
      correctionReviewReceiptId: args.correctionReviewReceiptId ?? null,
      correctedSupervisoryPacketId: args.correctedSupervisoryPacketId ?? null,
      correctedRedactionManifestHash: args.correctedRedactionManifestHash ?? null,
      originalArchiveBindingHash: args.originalArchiveBindingHash ?? null,
      originalArchiveMutationAttempted,
      responseChannelReceipts,
      customerNoticeReassessmentReceiptId: args.customerNoticeReassessmentReceiptId ?? null,
      customerNoticeSuppressedReason: args.customerNoticeSuppressedReason ?? null,
      exportFreezeReceiptId: args.exportFreezeReceiptId ?? null,
      responseAuditTimelineHash: args.responseAuditTimelineHash ?? null,
    },
    supervisoryDisclosureResponseCorrectionPolicy: {
      canReleaseSupervisoryDisclosureResponsePacket: ready,
      canMutateOriginalSupervisoryArchive: false,
      canClaimProductionSupervisoryResponseCorrectionWorkflow: false,
      reason,
    },
    supervisoryDisclosureResponseCorrectionRiskSignals: {
      previousSupervisoryEvidenceIndexNotReady: !previousReady,
      missingDisclosureResponseCaseId: !responseCaseReady,
      missingSupervisoryRequestIntakeReceipt: !intakeReady,
      missingResponseDraftReceipt: !draftReady,
      missingSupplementalEvidenceManifest: !supplementalReady,
      missingCorrectionReviewReceipt: !correctionReviewReady,
      missingCorrectedSupervisoryPacket: !correctedPacketReady,
      missingCorrectedRedactionManifest: !correctedRedactionReady,
      missingOriginalArchiveBinding: !originalArchiveBindingReady,
      originalArchiveMutationAttempted,
      missingResponseChannelReceipt: !responseChannelReady,
      missingCustomerNoticeReassessment: !noticeReassessmentReady,
      missingResponseAuditTimelineHash: !timelineReady,
    },
    customerSafeCopy: ready
      ? "A regulator/auditor response can be sent as a separate corrected or supplemental packet. The original archive remains immutable and customer notice was reassessed."
      : "Supervisory disclosure response is blocked until intake, correction review, new redacted packet, original archive binding, channel receipt and customer notice reassessment are complete.",
    operatorNextActions: ready
      ? [
          "Persist the real response case row and channel acknowledgement before claiming production response delivery.",
          "Keep the original supervisory archive immutable and store any correction as a new superseding packet.",
          "Re-run customer-notice assessment whenever a regulator/auditor response changes disclosure scope.",
        ]
      : [
          "Create a disclosure response case with request intake and response draft receipts.",
          "Attach supplemental evidence manifest, correction review receipt and corrected redaction manifest.",
          "Bind the corrected packet to the original archive without mutating it, then add channel receipt, customer notice reassessment and response timeline hash.",
        ],
  };
}
