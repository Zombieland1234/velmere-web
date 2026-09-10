import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2857CustomerExportPrivacyCaseSupervisorSlaGate } from "@/lib/market-integrity/top1-customer-export-privacy-case-supervisor-sla-gate";

export type Pass2858CustomerExportSupervisoryEvidenceIndexState =
  | "privacy_case_supervisor_sla_not_ready"
  | "supervisory_case_id_missing"
  | "lawful_basis_receipt_missing"
  | "minimum_disclosure_manifest_missing"
  | "supervisory_redaction_manifest_missing"
  | "legal_privilege_review_missing"
  | "supervisory_packet_id_missing"
  | "evidence_index_hash_missing"
  | "supervisory_channel_receipt_missing"
  | "customer_notice_decision_missing"
  | "raw_sensitive_material_leak_detected"
  | "supervisory_audit_timeline_hash_missing"
  | "supervisory_evidence_index_ready";

export type Pass2858CustomerExportSupervisoryRequestType =
  | "internal_audit"
  | "external_auditor"
  | "regulator_request"
  | "legal_hold_review"
  | "supervisor_review";

export type Pass2858CustomerExportSupervisoryChannel = "secure_vault" | "legal" | "regulator" | "auditor" | "operator_console";

export type Pass2858CustomerExportSupervisoryChannelReceipt = {
  channel: Pass2858CustomerExportSupervisoryChannel;
  channelReceiptId: string;
  packetId: string;
  redactionManifestHash: string;
  deliveredAt: string;
  accessExpiresAt: string | null;
  acknowledgedByRecipient: boolean;
};

export type Pass2858CustomerExportSupervisoryEvidenceIndexGate = {
  schemaVersion: "pass2858_customer_export_supervisory_evidence_index_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryEvidenceIndexState: Pass2858CustomerExportSupervisoryEvidenceIndexState;
  supervisoryEvidenceIndexReadinessScore: number;
  supervisoryEvidenceIndexEnvelope: {
    previousPrivacyCaseSupervisorSlaState: string;
    previousPrivacyCaseSupervisorSlaReadinessScore: number;
    previousCanClaimSupervisorControlledPrivacyClose: boolean;
    previousCanUnfreezeExportChannelsAfterPrivacyClose: boolean;
    supervisoryRequestType: Pass2858CustomerExportSupervisoryRequestType;
    supervisoryCaseId: string | null;
    lawfulBasisReceiptId: string | null;
    minimumDisclosureManifestHash: string | null;
    supervisoryRedactionManifestHash: string | null;
    legalPrivilegeReviewReceiptId: string | null;
    supervisoryEvidencePacketId: string | null;
    supervisoryEvidenceIndexHash: string | null;
    supervisoryChannelReceipts: Pass2858CustomerExportSupervisoryChannelReceipt[];
    customerNoticeDecisionReceiptId: string | null;
    customerNoticeSuppressedReason: string | null;
    exportFreezeReceiptId: string | null;
    rawOperatorNotesIncluded: boolean;
    rawAccountIdsIncluded: boolean;
    rawPaymentIdsIncluded: boolean;
    rawSupportMessagesIncluded: boolean;
    supervisoryAuditTimelineHash: string | null;
  };
  supervisoryEvidenceIndexPolicy: {
    canReleaseSupervisoryEvidencePacket: boolean;
    canReuseCustomerExportPacketForSupervisor: false;
    canClaimProductionSupervisoryDisclosureWorkflow: false;
    reason: string;
  };
  supervisoryEvidenceIndexRiskSignals: {
    previousPrivacyCaseSupervisorSlaNotReady: boolean;
    missingSupervisoryCaseId: boolean;
    missingLawfulBasisReceipt: boolean;
    missingMinimumDisclosureManifest: boolean;
    missingSupervisoryRedactionManifest: boolean;
    missingLegalPrivilegeReview: boolean;
    missingSupervisoryPacketId: boolean;
    missingEvidenceIndexHash: boolean;
    missingSupervisoryChannelReceipt: boolean;
    missingCustomerNoticeDecision: boolean;
    rawSensitiveMaterialLeakDetected: boolean;
    missingSupervisoryAuditTimelineHash: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2858_CUSTOMER_EXPORT_SUPERVISORY_EVIDENCE_INDEX_ACCEPTANCE_GATES = [
  "PASS2858: Supervisor/SLA privacy close is not the same as supervisory/regulator evidence export.",
  "PASS2858: Supervisory packets require a separate case ID, lawful-basis receipt, minimum-disclosure manifest, supervisory redaction manifest and legal-privilege review before release.",
  "PASS2858: Customer export packets cannot be reused as regulator/auditor packets; each supervisory channel needs its own receipt, acknowledgement and access-expiry boundary.",
  "PASS2858: Raw operator notes, raw account IDs, raw payment IDs and raw support messages must be excluded or the supervisory packet is blocked and export freeze remains active.",
  "PASS2858: This is a deterministic contract/API boundary. Production claims require real case-management rows, legal/privacy review, secure disclosure channels, recipient acknowledgements and durable audit trails.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function hasAnyRawSensitiveMaterial(args: {
  rawOperatorNotesIncluded?: boolean;
  rawAccountIdsIncluded?: boolean;
  rawPaymentIdsIncluded?: boolean;
  rawSupportMessagesIncluded?: boolean;
}) {
  return Boolean(args.rawOperatorNotesIncluded || args.rawAccountIdsIncluded || args.rawPaymentIdsIncluded || args.rawSupportMessagesIncluded);
}

export function buildPass2858CustomerExportSupervisoryEvidenceIndexGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportPrivacyCaseSupervisorSlaGate: Pass2857CustomerExportPrivacyCaseSupervisorSlaGate;
  generatedAt?: string;
  supervisoryRequestType?: Pass2858CustomerExportSupervisoryRequestType;
  supervisoryCaseId?: string | null;
  lawfulBasisReceiptId?: string | null;
  minimumDisclosureManifestHash?: string | null;
  supervisoryRedactionManifestHash?: string | null;
  legalPrivilegeReviewReceiptId?: string | null;
  supervisoryEvidencePacketId?: string | null;
  supervisoryEvidenceIndexHash?: string | null;
  supervisoryChannelReceipts?: Pass2858CustomerExportSupervisoryChannelReceipt[];
  customerNoticeDecisionReceiptId?: string | null;
  customerNoticeSuppressedReason?: string | null;
  exportFreezeReceiptId?: string | null;
  rawOperatorNotesIncluded?: boolean;
  rawAccountIdsIncluded?: boolean;
  rawPaymentIdsIncluded?: boolean;
  rawSupportMessagesIncluded?: boolean;
  supervisoryAuditTimelineHash?: string | null;
}): Pass2858CustomerExportSupervisoryEvidenceIndexGate {
  const previousGate = args.customerExportPrivacyCaseSupervisorSlaGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = previousGate.privacyCaseSupervisorSlaState === "privacy_case_supervisor_sla_escalation_ready";
  const supervisoryRequestType = args.supervisoryRequestType ?? "internal_audit";
  const channelReceipts = args.supervisoryChannelReceipts ?? [];
  const rawSensitiveMaterialLeakDetected = hasAnyRawSensitiveMaterial(args);
  const supervisoryCaseReady = Boolean(args.supervisoryCaseId);
  const lawfulBasisReady = Boolean(args.lawfulBasisReceiptId);
  const minimumDisclosureReady = Boolean(args.minimumDisclosureManifestHash);
  const redactionReady = Boolean(args.supervisoryRedactionManifestHash);
  const legalPrivilegeReady = Boolean(args.legalPrivilegeReviewReceiptId);
  const packetReady = Boolean(args.supervisoryEvidencePacketId);
  const indexReady = Boolean(args.supervisoryEvidenceIndexHash);
  const channelReady = channelReceipts.length > 0 && channelReceipts.every((receipt) => Boolean(receipt.channelReceiptId && receipt.packetId && receipt.redactionManifestHash && receipt.deliveredAt && receipt.acknowledgedByRecipient));
  const noticeDecisionReady = Boolean(args.customerNoticeDecisionReceiptId || args.customerNoticeSuppressedReason);
  const timelineReady = Boolean(args.supervisoryAuditTimelineHash);

  const ready = Boolean(
    previousReady &&
      supervisoryCaseReady &&
      lawfulBasisReady &&
      minimumDisclosureReady &&
      redactionReady &&
      legalPrivilegeReady &&
      packetReady &&
      indexReady &&
      channelReady &&
      noticeDecisionReady &&
      !rawSensitiveMaterialLeakDetected &&
      timelineReady,
  );

  const supervisoryEvidenceIndexState: Pass2858CustomerExportSupervisoryEvidenceIndexState = !previousReady
    ? "privacy_case_supervisor_sla_not_ready"
    : !supervisoryCaseReady
      ? "supervisory_case_id_missing"
      : !lawfulBasisReady
        ? "lawful_basis_receipt_missing"
        : !minimumDisclosureReady
          ? "minimum_disclosure_manifest_missing"
          : !redactionReady
            ? "supervisory_redaction_manifest_missing"
            : !legalPrivilegeReady
              ? "legal_privilege_review_missing"
              : !packetReady
                ? "supervisory_packet_id_missing"
                : !indexReady
                  ? "evidence_index_hash_missing"
                  : !channelReady
                    ? "supervisory_channel_receipt_missing"
                    : !noticeDecisionReady
                      ? "customer_notice_decision_missing"
                      : rawSensitiveMaterialLeakDetected
                        ? "raw_sensitive_material_leak_detected"
                        : !timelineReady
                          ? "supervisory_audit_timeline_hash_missing"
                          : "supervisory_evidence_index_ready";

  const supervisoryEvidenceIndexReadinessScore = clamp(
    previousGate.privacyCaseSupervisorSlaReadinessScore +
      (previousReady ? 7 : -50) +
      (supervisoryCaseReady ? 9 : -15) +
      (lawfulBasisReady ? 11 : -18) +
      (minimumDisclosureReady ? 10 : -16) +
      (redactionReady ? 10 : -18) +
      (legalPrivilegeReady ? 9 : -14) +
      (packetReady ? 9 : -14) +
      (indexReady ? 9 : -14) +
      (channelReady ? 9 : -16) +
      (noticeDecisionReady ? 7 : -12) +
      (!rawSensitiveMaterialLeakDetected ? 8 : -40) +
      (timelineReady ? 8 : -14),
  );

  const reason = ready
    ? "Supervisory evidence packet is case-bound, lawful-basis receipted, minimized, redacted, legal-privilege reviewed, channel-receipted and timeline-hashed for this deterministic boundary."
    : `Supervisory evidence index boundary blocked at ${supervisoryEvidenceIndexState}.`;

  return {
    schemaVersion: "pass2858_customer_export_supervisory_evidence_index_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryEvidenceIndexState,
    supervisoryEvidenceIndexReadinessScore,
    supervisoryEvidenceIndexEnvelope: {
      previousPrivacyCaseSupervisorSlaState: previousGate.privacyCaseSupervisorSlaState,
      previousPrivacyCaseSupervisorSlaReadinessScore: previousGate.privacyCaseSupervisorSlaReadinessScore,
      previousCanClaimSupervisorControlledPrivacyClose: previousGate.privacyCaseSupervisorSlaPolicy.canClaimSupervisorControlledPrivacyClose,
      previousCanUnfreezeExportChannelsAfterPrivacyClose: previousGate.privacyCaseSupervisorSlaPolicy.canUnfreezeExportChannelsAfterPrivacyClose,
      supervisoryRequestType,
      supervisoryCaseId: args.supervisoryCaseId ?? null,
      lawfulBasisReceiptId: args.lawfulBasisReceiptId ?? null,
      minimumDisclosureManifestHash: args.minimumDisclosureManifestHash ?? null,
      supervisoryRedactionManifestHash: args.supervisoryRedactionManifestHash ?? null,
      legalPrivilegeReviewReceiptId: args.legalPrivilegeReviewReceiptId ?? null,
      supervisoryEvidencePacketId: args.supervisoryEvidencePacketId ?? null,
      supervisoryEvidenceIndexHash: args.supervisoryEvidenceIndexHash ?? null,
      supervisoryChannelReceipts: channelReceipts,
      customerNoticeDecisionReceiptId: args.customerNoticeDecisionReceiptId ?? null,
      customerNoticeSuppressedReason: args.customerNoticeSuppressedReason ?? null,
      exportFreezeReceiptId: args.exportFreezeReceiptId ?? null,
      rawOperatorNotesIncluded: Boolean(args.rawOperatorNotesIncluded),
      rawAccountIdsIncluded: Boolean(args.rawAccountIdsIncluded),
      rawPaymentIdsIncluded: Boolean(args.rawPaymentIdsIncluded),
      rawSupportMessagesIncluded: Boolean(args.rawSupportMessagesIncluded),
      supervisoryAuditTimelineHash: args.supervisoryAuditTimelineHash ?? null,
    },
    supervisoryEvidenceIndexPolicy: {
      canReleaseSupervisoryEvidencePacket: ready,
      canReuseCustomerExportPacketForSupervisor: false,
      canClaimProductionSupervisoryDisclosureWorkflow: false,
      reason,
    },
    supervisoryEvidenceIndexRiskSignals: {
      previousPrivacyCaseSupervisorSlaNotReady: !previousReady,
      missingSupervisoryCaseId: !supervisoryCaseReady,
      missingLawfulBasisReceipt: !lawfulBasisReady,
      missingMinimumDisclosureManifest: !minimumDisclosureReady,
      missingSupervisoryRedactionManifest: !redactionReady,
      missingLegalPrivilegeReview: !legalPrivilegeReady,
      missingSupervisoryPacketId: !packetReady,
      missingEvidenceIndexHash: !indexReady,
      missingSupervisoryChannelReceipt: !channelReady,
      missingCustomerNoticeDecision: !noticeDecisionReady,
      rawSensitiveMaterialLeakDetected,
      missingSupervisoryAuditTimelineHash: !timelineReady,
    },
    customerSafeCopy: ready
      ? "A supervisory/audit evidence packet can be prepared as a separate minimized packet. It is not the same as your customer export and does not include raw internal notes or private tokens."
      : "Supervisory evidence export is blocked until the lawful-basis, redaction, minimum-disclosure, channel receipt and timeline proof are complete.",
    operatorNextActions: ready
      ? [
          "Attach real case-management row and recipient acknowledgement before claiming production supervisory disclosure.",
          "Keep customer export packet and supervisory evidence packet separate in storage, access logs and receipts.",
          "Run legal/privacy review before any regulator/auditor disclosure leaves the operator console.",
        ]
      : [
          "Add lawful-basis receipt, minimum-disclosure manifest and supervisory redaction manifest.",
          "Run legal-privilege review and strip raw operator notes, account IDs, payment IDs and full support messages.",
          "Bind the packet to a supervisory case ID, channel receipt, customer notice decision and audit timeline hash.",
        ],
  };
}
