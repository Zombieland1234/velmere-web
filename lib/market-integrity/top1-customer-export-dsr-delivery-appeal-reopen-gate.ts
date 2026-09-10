import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2854CustomerExportPrivacyIncidentDsrEscalationGate } from "@/lib/market-integrity/top1-customer-export-privacy-incident-dsr-escalation-gate";

export type Pass2855CustomerExportDsrDeliveryAppealReopenState =
  | "privacy_incident_dsr_not_ready"
  | "dsr_delivery_receipt_missing"
  | "customer_acknowledgement_receipt_missing"
  | "appeal_window_receipt_missing"
  | "appeal_review_receipt_missing"
  | "appeal_reopen_decision_missing"
  | "appeal_reopen_freeze_receipt_missing"
  | "reopened_packet_id_missing"
  | "reopened_packet_redaction_manifest_missing"
  | "duplicate_delivery_guard_missing"
  | "channel_delivery_evidence_missing"
  | "customer_privacy_case_timeline_hash_missing"
  | "dsr_delivery_appeal_reopen_ready";

export type Pass2855CustomerExportDsrChannelDeliveryReceipt = {
  channel: "account_vault" | "email" | "api" | "support" | "customer_portal";
  deliveryReceiptId: string;
  payloadHash: string;
  redactionManifestHash: string;
  deliveredAt: string;
  acknowledged: boolean;
  reopenedAfterAppeal: boolean;
};

export type Pass2855CustomerExportDsrDeliveryAppealReopenGate = {
  schemaVersion: "pass2855_customer_export_dsr_delivery_appeal_reopen_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  dsrDeliveryAppealReopenState: Pass2855CustomerExportDsrDeliveryAppealReopenState;
  dsrDeliveryAppealReopenReadinessScore: number;
  dsrDeliveryAppealEnvelope: {
    previousPrivacyIncidentDsrState: string;
    previousPrivacyIncidentDsrReadinessScore: number;
    previousCanServeCustomerDsrAuditPacket: boolean;
    previousCanUnfreezeCustomerExportDelivery: boolean;
    dsrDeliveryReceiptId: string | null;
    customerAcknowledgementReceiptId: string | null;
    appealWindowReceiptId: string | null;
    customerAppealRequested: boolean;
    appealReviewReceiptId: string | null;
    appealReopenDecisionReceiptId: string | null;
    appealReopenFreezeReceiptId: string | null;
    reopenedDataSubjectAccessAuditPacketId: string | null;
    reopenedDataSubjectAccessRedactionManifestHash: string | null;
    duplicateDsrDeliveryGuardReceiptId: string | null;
    channelDsrDeliveryReceipts: Pass2855CustomerExportDsrChannelDeliveryReceipt[];
    customerPrivacyCaseTimelineHash: string | null;
  };
  dsrDeliveryAppealPolicy: {
    canCloseCustomerDsrDelivery: boolean;
    canReopenCustomerDsrCase: boolean;
    canUnfreezeCustomerExportAfterAppeal: boolean;
    canClaimProductionDsrAppealWorkflow: false;
    reason: string;
  };
  dsrDeliveryAppealRiskSignals: {
    privacyIncidentDsrNotReady: boolean;
    missingDsrDeliveryReceipt: boolean;
    missingCustomerAcknowledgementReceipt: boolean;
    missingAppealWindowReceipt: boolean;
    missingAppealReviewReceipt: boolean;
    missingAppealReopenDecision: boolean;
    missingAppealReopenFreezeReceipt: boolean;
    missingReopenedPacket: boolean;
    missingReopenedRedactionManifest: boolean;
    missingDuplicateDeliveryGuard: boolean;
    missingChannelDeliveryEvidence: boolean;
    missingCustomerPrivacyCaseTimelineHash: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2855_CUSTOMER_EXPORT_DSR_DELIVERY_APPEAL_REOPEN_ACCEPTANCE_GATES = [
  "PASS2855: Privacy incident / DSAR escalation readiness is not the same as customer DSAR delivery close.",
  "PASS2855: A minimized DSAR/export-of-export packet requires its own delivery receipt, customer acknowledgement, appeal window receipt and per-channel delivery evidence before customer-facing closure claims.",
  "PASS2855: A customer appeal or reopen request must freeze reuse of the old DSAR packet until appeal review, reopen decision, reopen freeze receipt, reissued packet ID and redaction manifest are recorded.",
  "PASS2855: Duplicate DSAR delivery must be guarded by an idempotency/dedup receipt; account vault, email, API, support and customer portal channels cannot reuse each other as proof.",
  "PASS2855: This remains a deterministic contract and static API boundary; production claims require real DB rows, notification delivery logs, customer portal UI, appeal workflow and privacy/legal signoff.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2855CustomerExportDsrDeliveryAppealReopenGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportPrivacyIncidentDsrEscalationGate: Pass2854CustomerExportPrivacyIncidentDsrEscalationGate;
  generatedAt?: string;
  dsrDeliveryReceiptId?: string | null;
  customerAcknowledgementReceiptId?: string | null;
  appealWindowReceiptId?: string | null;
  customerAppealRequested?: boolean;
  appealReviewReceiptId?: string | null;
  appealReopenDecisionReceiptId?: string | null;
  appealReopenFreezeReceiptId?: string | null;
  reopenedDataSubjectAccessAuditPacketId?: string | null;
  reopenedDataSubjectAccessRedactionManifestHash?: string | null;
  duplicateDsrDeliveryGuardReceiptId?: string | null;
  channelDsrDeliveryReceipts?: Pass2855CustomerExportDsrChannelDeliveryReceipt[] | null;
  customerPrivacyCaseTimelineHash?: string | null;
}): Pass2855CustomerExportDsrDeliveryAppealReopenGate {
  const previousGate = args.customerExportPrivacyIncidentDsrEscalationGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(
    previousGate.privacyIncidentDsrEscalationState === "privacy_incident_dsr_escalation_ready" &&
      previousGate.incidentDsrPolicy.canServeCustomerDsrAuditPacket &&
      previousGate.incidentDsrEnvelope.dataSubjectAccessRawSecretLeakDetected === false,
  );
  const customerAppealRequested = Boolean(args.customerAppealRequested);
  const channelReceipts = args.channelDsrDeliveryReceipts ?? [];
  const channelDeliveryReady = channelReceipts.length >= 1 && channelReceipts.every((receipt) =>
    Boolean(
      receipt.deliveryReceiptId &&
        receipt.payloadHash &&
        receipt.redactionManifestHash &&
        receipt.deliveredAt &&
        receipt.acknowledged,
    ),
  );
  const appealReady = customerAppealRequested
    ? Boolean(
        args.appealReviewReceiptId &&
          args.appealReopenDecisionReceiptId &&
          args.appealReopenFreezeReceiptId &&
          args.reopenedDataSubjectAccessAuditPacketId &&
          args.reopenedDataSubjectAccessRedactionManifestHash,
      )
    : true;
  const ready = Boolean(
    previousReady &&
      args.dsrDeliveryReceiptId &&
      args.customerAcknowledgementReceiptId &&
      args.appealWindowReceiptId &&
      appealReady &&
      args.duplicateDsrDeliveryGuardReceiptId &&
      channelDeliveryReady &&
      args.customerPrivacyCaseTimelineHash,
  );

  const dsrDeliveryAppealReopenState: Pass2855CustomerExportDsrDeliveryAppealReopenState = !previousReady
    ? "privacy_incident_dsr_not_ready"
    : !args.dsrDeliveryReceiptId
      ? "dsr_delivery_receipt_missing"
      : !args.customerAcknowledgementReceiptId
        ? "customer_acknowledgement_receipt_missing"
        : !args.appealWindowReceiptId
          ? "appeal_window_receipt_missing"
          : customerAppealRequested && !args.appealReviewReceiptId
            ? "appeal_review_receipt_missing"
            : customerAppealRequested && !args.appealReopenDecisionReceiptId
              ? "appeal_reopen_decision_missing"
              : customerAppealRequested && !args.appealReopenFreezeReceiptId
                ? "appeal_reopen_freeze_receipt_missing"
                : customerAppealRequested && !args.reopenedDataSubjectAccessAuditPacketId
                  ? "reopened_packet_id_missing"
                  : customerAppealRequested && !args.reopenedDataSubjectAccessRedactionManifestHash
                    ? "reopened_packet_redaction_manifest_missing"
                    : !args.duplicateDsrDeliveryGuardReceiptId
                      ? "duplicate_delivery_guard_missing"
                      : !channelDeliveryReady
                        ? "channel_delivery_evidence_missing"
                        : !args.customerPrivacyCaseTimelineHash
                          ? "customer_privacy_case_timeline_hash_missing"
                          : "dsr_delivery_appeal_reopen_ready";

  const dsrDeliveryAppealReopenReadinessScore = clamp(
    previousGate.privacyIncidentDsrEscalationReadinessScore +
      (previousReady ? 8 : -46) +
      (args.dsrDeliveryReceiptId ? 12 : -18) +
      (args.customerAcknowledgementReceiptId ? 11 : -17) +
      (args.appealWindowReceiptId ? 9 : -14) +
      (customerAppealRequested ? -12 : 5) +
      (appealReady ? 13 : -24) +
      (args.duplicateDsrDeliveryGuardReceiptId ? 10 : -16) +
      (channelDeliveryReady ? 12 : -18) +
      (args.customerPrivacyCaseTimelineHash ? 10 : -16),
  );

  const reason = ready
    ? customerAppealRequested
      ? "Customer DSAR delivery is packet-bound, acknowledged, appeal-reviewed, reissued/redacted, deduped and channel-receipted for this deterministic boundary."
      : "Customer DSAR delivery is packet-bound, acknowledged, appeal-windowed, deduped and channel-receipted for this deterministic boundary."
    : `Customer DSAR delivery / appeal-reopen remains blocked by state: ${dsrDeliveryAppealReopenState}.`;

  return {
    schemaVersion: "pass2855_customer_export_dsr_delivery_appeal_reopen_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    dsrDeliveryAppealReopenState,
    dsrDeliveryAppealReopenReadinessScore,
    dsrDeliveryAppealEnvelope: {
      previousPrivacyIncidentDsrState: previousGate.privacyIncidentDsrEscalationState,
      previousPrivacyIncidentDsrReadinessScore: previousGate.privacyIncidentDsrEscalationReadinessScore,
      previousCanServeCustomerDsrAuditPacket: previousGate.incidentDsrPolicy.canServeCustomerDsrAuditPacket,
      previousCanUnfreezeCustomerExportDelivery: previousGate.incidentDsrPolicy.canUnfreezeCustomerExportDelivery,
      dsrDeliveryReceiptId: args.dsrDeliveryReceiptId ?? null,
      customerAcknowledgementReceiptId: args.customerAcknowledgementReceiptId ?? null,
      appealWindowReceiptId: args.appealWindowReceiptId ?? null,
      customerAppealRequested,
      appealReviewReceiptId: args.appealReviewReceiptId ?? null,
      appealReopenDecisionReceiptId: args.appealReopenDecisionReceiptId ?? null,
      appealReopenFreezeReceiptId: args.appealReopenFreezeReceiptId ?? null,
      reopenedDataSubjectAccessAuditPacketId: args.reopenedDataSubjectAccessAuditPacketId ?? null,
      reopenedDataSubjectAccessRedactionManifestHash: args.reopenedDataSubjectAccessRedactionManifestHash ?? null,
      duplicateDsrDeliveryGuardReceiptId: args.duplicateDsrDeliveryGuardReceiptId ?? null,
      channelDsrDeliveryReceipts: channelReceipts,
      customerPrivacyCaseTimelineHash: args.customerPrivacyCaseTimelineHash ?? null,
    },
    dsrDeliveryAppealPolicy: {
      canCloseCustomerDsrDelivery: ready && !customerAppealRequested,
      canReopenCustomerDsrCase: ready && customerAppealRequested,
      canUnfreezeCustomerExportAfterAppeal: ready && customerAppealRequested && previousGate.incidentDsrPolicy.canUnfreezeCustomerExportDelivery,
      canClaimProductionDsrAppealWorkflow: false,
      reason,
    },
    dsrDeliveryAppealRiskSignals: {
      privacyIncidentDsrNotReady: !previousReady,
      missingDsrDeliveryReceipt: !args.dsrDeliveryReceiptId,
      missingCustomerAcknowledgementReceipt: !args.customerAcknowledgementReceiptId,
      missingAppealWindowReceipt: !args.appealWindowReceiptId,
      missingAppealReviewReceipt: customerAppealRequested && !args.appealReviewReceiptId,
      missingAppealReopenDecision: customerAppealRequested && !args.appealReopenDecisionReceiptId,
      missingAppealReopenFreezeReceipt: customerAppealRequested && !args.appealReopenFreezeReceiptId,
      missingReopenedPacket: customerAppealRequested && !args.reopenedDataSubjectAccessAuditPacketId,
      missingReopenedRedactionManifest: customerAppealRequested && !args.reopenedDataSubjectAccessRedactionManifestHash,
      missingDuplicateDeliveryGuard: !args.duplicateDsrDeliveryGuardReceiptId,
      missingChannelDeliveryEvidence: !channelDeliveryReady,
      missingCustomerPrivacyCaseTimelineHash: !args.customerPrivacyCaseTimelineHash,
    },
    customerSafeCopy:
      "Velmère separates privacy/DSAR escalation from final customer DSAR delivery. The customer-safe packet must be delivered through receipted channels, acknowledged, appeal-windowed and deduped; appeal/reopen cannot reuse stale packets.",
    operatorNextActions: ready
      ? [
          "Keep DSAR delivery receipts, appeal-window receipt and customer acknowledgement attached to the privacy case timeline.",
          "Do not claim production DSAR appeal automation until a real customer portal, notification logs, DB rows and privacy/legal signoff are attached.",
        ]
      : [
          "Attach DSAR delivery receipt, customer acknowledgement, appeal window receipt and channel delivery receipts.",
          "If appeal/reopen is requested, freeze stale packet reuse and attach appeal review, reopen decision, reissued packet and redaction manifest.",
          "Attach duplicate-delivery guard and customer privacy case timeline hash before customer-facing closure.",
        ],
  };
}
