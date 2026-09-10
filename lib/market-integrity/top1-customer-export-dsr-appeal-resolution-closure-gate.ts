import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2855CustomerExportDsrDeliveryAppealReopenGate } from "@/lib/market-integrity/top1-customer-export-dsr-delivery-appeal-reopen-gate";

export type Pass2856CustomerExportDsrAppealResolutionClosureState =
  | "dsr_delivery_appeal_reopen_not_ready"
  | "appeal_case_intake_receipt_missing"
  | "appeal_resolution_decision_receipt_missing"
  | "corrected_packet_id_missing"
  | "corrected_packet_redaction_manifest_missing"
  | "corrected_packet_channel_delivery_missing"
  | "customer_final_response_receipt_missing"
  | "final_privacy_closure_receipt_missing"
  | "no_residual_privacy_obligation_receipt_missing"
  | "privacy_case_audit_timeline_hash_missing"
  | "dsr_appeal_resolution_closure_ready";

export type Pass2856CustomerExportDsrAppealResolutionDecision =
  | "no_appeal"
  | "accepted_corrected_packet"
  | "partially_accepted_corrected_packet"
  | "rejected_original_packet_valid"
  | "customer_withdrawn";

export type Pass2856CustomerExportDsrAppealResolutionChannelReceipt = {
  channel: "account_vault" | "email" | "api" | "support" | "customer_portal";
  resolutionDeliveryReceiptId: string;
  payloadHash: string;
  redactionManifestHash: string;
  deliveredAt: string;
  customerAcknowledged: boolean;
  correctedPacket: boolean;
};

export type Pass2856CustomerExportDsrAppealResolutionClosureGate = {
  schemaVersion: "pass2856_customer_export_dsr_appeal_resolution_closure_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  dsrAppealResolutionClosureState: Pass2856CustomerExportDsrAppealResolutionClosureState;
  dsrAppealResolutionClosureReadinessScore: number;
  dsrAppealResolutionClosureEnvelope: {
    previousDsrDeliveryAppealReopenState: string;
    previousDsrDeliveryAppealReopenReadinessScore: number;
    previousCanCloseCustomerDsrDelivery: boolean;
    previousCanReopenCustomerDsrCase: boolean;
    previousCanUnfreezeCustomerExportAfterAppeal: boolean;
    customerAppealRequested: boolean;
    appealResolutionDecision: Pass2856CustomerExportDsrAppealResolutionDecision;
    appealCaseIntakeReceiptId: string | null;
    appealResolutionDecisionReceiptId: string | null;
    correctedDataSubjectAccessAuditPacketId: string | null;
    correctedDataSubjectAccessRedactionManifestHash: string | null;
    correctedPacketSupersedesPacketId: string | null;
    correctedPacketChannelReceipts: Pass2856CustomerExportDsrAppealResolutionChannelReceipt[];
    customerFinalResponseReceiptId: string | null;
    finalPrivacyClosureReceiptId: string | null;
    noResidualPrivacyObligationReceiptId: string | null;
    privacyCaseAuditTimelineHash: string | null;
  };
  dsrAppealResolutionClosurePolicy: {
    canCloseCustomerDsrAppeal: boolean;
    canClaimFinalPrivacyCaseClosure: boolean;
    canUnfreezeCustomerExportAfterDsrAppealResolution: boolean;
    canClaimProductionDsrAppealResolutionWorkflow: false;
    reason: string;
  };
  dsrAppealResolutionClosureRiskSignals: {
    dsrDeliveryAppealReopenNotReady: boolean;
    missingAppealCaseIntakeReceipt: boolean;
    missingAppealResolutionDecisionReceipt: boolean;
    missingCorrectedPacketId: boolean;
    missingCorrectedPacketRedactionManifest: boolean;
    missingCorrectedPacketChannelDelivery: boolean;
    missingCustomerFinalResponseReceipt: boolean;
    missingFinalPrivacyClosureReceipt: boolean;
    missingNoResidualPrivacyObligationReceipt: boolean;
    missingPrivacyCaseAuditTimelineHash: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2856_CUSTOMER_EXPORT_DSR_APPEAL_RESOLUTION_CLOSURE_ACCEPTANCE_GATES = [
  "PASS2856: DSAR delivery / appeal reopen is not the same as final privacy case closure.",
  "PASS2856: A customer appeal requires a case-intake receipt, resolution decision receipt, final customer response and closure receipt before the privacy case can be called closed.",
  "PASS2856: If the appeal accepts or partially accepts corrections, the old DSAR packet must be superseded by a corrected packet ID, corrected redaction manifest and per-channel corrected delivery receipts.",
  "PASS2856: Final closure requires a no-residual-privacy-obligation receipt and privacy-case audit timeline hash; absence of those freezes final customer-facing close copy.",
  "PASS2856: This remains a deterministic contract/API boundary. Production claims require real DB rows, customer portal actions, legal/privacy signoff, notification delivery logs and support-case closure artifacts.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function decisionRequiresCorrectedPacket(decision: Pass2856CustomerExportDsrAppealResolutionDecision) {
  return decision === "accepted_corrected_packet" || decision === "partially_accepted_corrected_packet";
}

export function buildPass2856CustomerExportDsrAppealResolutionClosureGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportDsrDeliveryAppealReopenGate: Pass2855CustomerExportDsrDeliveryAppealReopenGate;
  generatedAt?: string;
  appealCaseIntakeReceiptId?: string | null;
  appealResolutionDecision?: Pass2856CustomerExportDsrAppealResolutionDecision | null;
  appealResolutionDecisionReceiptId?: string | null;
  correctedDataSubjectAccessAuditPacketId?: string | null;
  correctedDataSubjectAccessRedactionManifestHash?: string | null;
  correctedPacketSupersedesPacketId?: string | null;
  correctedPacketChannelReceipts?: Pass2856CustomerExportDsrAppealResolutionChannelReceipt[] | null;
  customerFinalResponseReceiptId?: string | null;
  finalPrivacyClosureReceiptId?: string | null;
  noResidualPrivacyObligationReceiptId?: string | null;
  privacyCaseAuditTimelineHash?: string | null;
}): Pass2856CustomerExportDsrAppealResolutionClosureGate {
  const previousGate = args.customerExportDsrDeliveryAppealReopenGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(previousGate.dsrDeliveryAppealReopenState === "dsr_delivery_appeal_reopen_ready");
  const customerAppealRequested = Boolean(previousGate.dsrDeliveryAppealEnvelope.customerAppealRequested);
  const appealResolutionDecision = args.appealResolutionDecision ?? (customerAppealRequested ? "accepted_corrected_packet" : "no_appeal");
  const correctedPacketRequired = decisionRequiresCorrectedPacket(appealResolutionDecision);
  const correctedReceipts = args.correctedPacketChannelReceipts ?? [];
  const correctedChannelReady = !correctedPacketRequired
    ? true
    : correctedReceipts.length >= 1 && correctedReceipts.every((receipt) =>
        Boolean(
          receipt.resolutionDeliveryReceiptId &&
            receipt.payloadHash &&
            receipt.redactionManifestHash &&
            receipt.deliveredAt &&
            receipt.customerAcknowledged &&
            receipt.correctedPacket,
        ),
      );
  const appealIntakeReady = !customerAppealRequested || Boolean(args.appealCaseIntakeReceiptId);
  const appealDecisionReady = !customerAppealRequested || Boolean(args.appealResolutionDecisionReceiptId);
  const correctedPacketReady = !correctedPacketRequired || Boolean(args.correctedDataSubjectAccessAuditPacketId);
  const correctedManifestReady = !correctedPacketRequired || Boolean(args.correctedDataSubjectAccessRedactionManifestHash);
  const ready = Boolean(
    previousReady &&
      appealIntakeReady &&
      appealDecisionReady &&
      correctedPacketReady &&
      correctedManifestReady &&
      correctedChannelReady &&
      args.customerFinalResponseReceiptId &&
      args.finalPrivacyClosureReceiptId &&
      args.noResidualPrivacyObligationReceiptId &&
      args.privacyCaseAuditTimelineHash,
  );

  const dsrAppealResolutionClosureState: Pass2856CustomerExportDsrAppealResolutionClosureState = !previousReady
    ? "dsr_delivery_appeal_reopen_not_ready"
    : !appealIntakeReady
      ? "appeal_case_intake_receipt_missing"
      : !appealDecisionReady
        ? "appeal_resolution_decision_receipt_missing"
        : !correctedPacketReady
          ? "corrected_packet_id_missing"
          : !correctedManifestReady
            ? "corrected_packet_redaction_manifest_missing"
            : !correctedChannelReady
              ? "corrected_packet_channel_delivery_missing"
              : !args.customerFinalResponseReceiptId
                ? "customer_final_response_receipt_missing"
                : !args.finalPrivacyClosureReceiptId
                  ? "final_privacy_closure_receipt_missing"
                  : !args.noResidualPrivacyObligationReceiptId
                    ? "no_residual_privacy_obligation_receipt_missing"
                    : !args.privacyCaseAuditTimelineHash
                      ? "privacy_case_audit_timeline_hash_missing"
                      : "dsr_appeal_resolution_closure_ready";

  const dsrAppealResolutionClosureReadinessScore = clamp(
    previousGate.dsrDeliveryAppealReopenReadinessScore +
      (previousReady ? 8 : -50) +
      (appealIntakeReady ? 8 : -14) +
      (appealDecisionReady ? 10 : -16) +
      (correctedPacketReady ? 8 : -16) +
      (correctedManifestReady ? 8 : -16) +
      (correctedChannelReady ? 10 : -18) +
      (args.customerFinalResponseReceiptId ? 10 : -16) +
      (args.finalPrivacyClosureReceiptId ? 10 : -18) +
      (args.noResidualPrivacyObligationReceiptId ? 10 : -16) +
      (args.privacyCaseAuditTimelineHash ? 8 : -16),
  );

  const reason = ready
    ? customerAppealRequested
      ? "Customer DSAR appeal has an intake receipt, decision receipt, corrected/superseded packet boundary where required, final response, no-residual obligation receipt and audit timeline hash for this deterministic closure boundary."
      : "Customer DSAR delivery has final response, privacy closure, no-residual obligation receipt and audit timeline hash for this deterministic closure boundary."
    : `Customer DSAR appeal resolution / final privacy closure remains blocked by state: ${dsrAppealResolutionClosureState}.`;

  return {
    schemaVersion: "pass2856_customer_export_dsr_appeal_resolution_closure_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    dsrAppealResolutionClosureState,
    dsrAppealResolutionClosureReadinessScore,
    dsrAppealResolutionClosureEnvelope: {
      previousDsrDeliveryAppealReopenState: previousGate.dsrDeliveryAppealReopenState,
      previousDsrDeliveryAppealReopenReadinessScore: previousGate.dsrDeliveryAppealReopenReadinessScore,
      previousCanCloseCustomerDsrDelivery: previousGate.dsrDeliveryAppealPolicy.canCloseCustomerDsrDelivery,
      previousCanReopenCustomerDsrCase: previousGate.dsrDeliveryAppealPolicy.canReopenCustomerDsrCase,
      previousCanUnfreezeCustomerExportAfterAppeal: previousGate.dsrDeliveryAppealPolicy.canUnfreezeCustomerExportAfterAppeal,
      customerAppealRequested,
      appealResolutionDecision,
      appealCaseIntakeReceiptId: args.appealCaseIntakeReceiptId ?? null,
      appealResolutionDecisionReceiptId: args.appealResolutionDecisionReceiptId ?? null,
      correctedDataSubjectAccessAuditPacketId: args.correctedDataSubjectAccessAuditPacketId ?? null,
      correctedDataSubjectAccessRedactionManifestHash: args.correctedDataSubjectAccessRedactionManifestHash ?? null,
      correctedPacketSupersedesPacketId: args.correctedPacketSupersedesPacketId ?? null,
      correctedPacketChannelReceipts: correctedReceipts,
      customerFinalResponseReceiptId: args.customerFinalResponseReceiptId ?? null,
      finalPrivacyClosureReceiptId: args.finalPrivacyClosureReceiptId ?? null,
      noResidualPrivacyObligationReceiptId: args.noResidualPrivacyObligationReceiptId ?? null,
      privacyCaseAuditTimelineHash: args.privacyCaseAuditTimelineHash ?? null,
    },
    dsrAppealResolutionClosurePolicy: {
      canCloseCustomerDsrAppeal: ready && customerAppealRequested,
      canClaimFinalPrivacyCaseClosure: ready,
      canUnfreezeCustomerExportAfterDsrAppealResolution: ready && previousGate.dsrDeliveryAppealPolicy.canUnfreezeCustomerExportAfterAppeal,
      canClaimProductionDsrAppealResolutionWorkflow: false,
      reason,
    },
    dsrAppealResolutionClosureRiskSignals: {
      dsrDeliveryAppealReopenNotReady: !previousReady,
      missingAppealCaseIntakeReceipt: !appealIntakeReady,
      missingAppealResolutionDecisionReceipt: !appealDecisionReady,
      missingCorrectedPacketId: !correctedPacketReady,
      missingCorrectedPacketRedactionManifest: !correctedManifestReady,
      missingCorrectedPacketChannelDelivery: !correctedChannelReady,
      missingCustomerFinalResponseReceipt: !args.customerFinalResponseReceiptId,
      missingFinalPrivacyClosureReceipt: !args.finalPrivacyClosureReceiptId,
      missingNoResidualPrivacyObligationReceipt: !args.noResidualPrivacyObligationReceiptId,
      missingPrivacyCaseAuditTimelineHash: !args.privacyCaseAuditTimelineHash,
    },
    customerSafeCopy:
      "Velmère separates DSAR delivery/appeal reopen from final privacy case closure. Appeals require a decision receipt, corrected packet when needed, final customer response, no-residual obligation proof and privacy-case timeline hash before closure copy.",
    operatorNextActions: ready
      ? [
          "Attach final privacy closure, no-residual obligation receipt and privacy-case timeline hash to the customer privacy case.",
          "Do not claim production DSAR appeal-resolution automation until real portal actions, DB rows, notification logs and privacy/legal signoff are attached.",
        ]
      : [
          "Attach appeal intake and appeal-resolution decision receipts when a customer appeal exists.",
          "If the appeal accepts corrections, supersede the stale DSAR packet with a corrected packet ID, redaction manifest and per-channel corrected delivery receipts.",
          "Attach final customer response, privacy closure receipt, no-residual obligation receipt and privacy-case timeline hash before closure.",
        ],
  };
}
