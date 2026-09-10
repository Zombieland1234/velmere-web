import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2837SupportSlaRemedyProofGate } from "@/lib/market-integrity/top1-support-sla-remedy-proof-gate";

export type Pass2838CustomerExportRedactionPacketState =
  | "not_requested"
  | "export_blocked_support_unresolved"
  | "export_packet_pending"
  | "redaction_failed"
  | "export_ready"
  | "delivered_under_watch"
  | "export_revoked";

export type Pass2838CustomerExportChannel =
  | "account_download"
  | "email_notice"
  | "api_handoff"
  | "support_attachment";

export type Pass2838CustomerExportRedactionPacketGate = {
  schemaVersion: "pass2838_customer_export_redaction_packet_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  exportState: Pass2838CustomerExportRedactionPacketState;
  exportReadinessScore: number;
  exportEnvelope: {
    exportPacketId: string | null;
    exportChannel: Pass2838CustomerExportChannel;
    customerDownloadId: string | null;
    emailNoticeId: string | null;
    apiHandoffId: string | null;
    supportCaseCloseReceiptId: string | null;
    redactionManifestHash: string | null;
    minimizationPolicyId: string | null;
    customerAckReceiptId: string | null;
    supportSlaBound: boolean;
    payloadHashBound: boolean;
    sourceReceiptRootBound: boolean;
    allIdsRedacted: boolean;
    rawTokensRemoved: boolean;
    rawPaymentIdsRemoved: boolean;
    privateNotesRemoved: boolean;
    supportMessagesSummarized: boolean;
  };
  exportPolicy: {
    canExportCustomerPacket: boolean;
    canAttachToAccountVault: boolean;
    canSendEmailNotice: boolean;
    canExposeSupportSummary: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  exportRiskSignals: {
    missingExportPacket: boolean;
    missingRedactionManifest: boolean;
    missingMinimizationPolicy: boolean;
    missingCustomerAck: boolean;
    supportSlaNotClear: boolean;
    payloadOrSourceRootDrift: boolean;
    rawTokenExposureRisk: boolean;
    rawPaymentExposureRisk: boolean;
    privateNoteExposureRisk: boolean;
    supportMessageOverexposureRisk: boolean;
    exportChannelReceiptMissing: boolean;
    exportRevoked: boolean;
  };
  operatorNextActions: string[];
};

export const PASS2838_CUSTOMER_EXPORT_REDACTION_PACKET_ACCEPTANCE_GATES = [
  "PASS2838: Customer export/download/email/API handoff is a separate proof state; support close and paid-delivery reopen do not automatically allow customer-visible export packets.",
  "PASS2838: Export packets require a redaction manifest, minimization policy, customer-facing packet ID and payloadHash/sourceReceiptRoot/support-SLA binding before delivery.",
  "PASS2838: Raw report tokens, raw payment IDs, raw account IDs, private operator notes and full support messages must be removed or summarized before any customer-visible packet is delivered.",
  "PASS2838: Each export channel must carry its own receipt: account download, email notice, API handoff or support attachment cannot reuse each other as proof.",
  "PASS2838: Revoked export packets, payload/source-root drift or unresolved support-SLA status freeze account vault attachment, email notices and paid evidence export.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function redact(value: string | null | undefined) {
  if (!value) return null;
  const clean = String(value).replace(/[^a-zA-Z0-9_-]/g, "");
  if (clean.length <= 10) return `${clean.slice(0, 3)}…redacted`;
  return `${clean.slice(0, 5)}…${clean.slice(-5)}`;
}

function channelReceiptPresent(channel: Pass2838CustomerExportChannel, args: {
  customerDownloadId?: string | null;
  emailNoticeId?: string | null;
  apiHandoffId?: string | null;
  supportCaseCloseReceiptId?: string | null;
}) {
  if (channel === "account_download") return Boolean(args.customerDownloadId);
  if (channel === "email_notice") return Boolean(args.emailNoticeId);
  if (channel === "api_handoff") return Boolean(args.apiHandoffId);
  return Boolean(args.supportCaseCloseReceiptId);
}

export function buildPass2838CustomerExportRedactionPacketGate(args: {
  surface: string;
  tier?: VelmereTier;
  supportSlaRemedyProofGate: Pass2837SupportSlaRemedyProofGate;
  generatedAt?: string;
  exportRequested?: boolean;
  exportPacketId?: string | null;
  exportChannel?: Pass2838CustomerExportChannel;
  customerDownloadId?: string | null;
  emailNoticeId?: string | null;
  apiHandoffId?: string | null;
  supportCaseCloseReceiptId?: string | null;
  redactionManifestHash?: string | null;
  minimizationPolicyId?: string | null;
  customerAckReceiptId?: string | null;
  allIdsRedacted?: boolean;
  rawTokensRemoved?: boolean;
  rawPaymentIdsRemoved?: boolean;
  privateNotesRemoved?: boolean;
  supportMessagesSummarized?: boolean;
  payloadHashBound?: boolean;
  sourceReceiptRootBound?: boolean;
  payloadOrSourceRootDrift?: boolean;
  exportRevoked?: boolean;
  customerAckRequired?: boolean;
}): Pass2838CustomerExportRedactionPacketGate {
  const support = args.supportSlaRemedyProofGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const exportRequested = Boolean(args.exportRequested || args.exportPacketId || args.customerDownloadId || args.emailNoticeId || args.apiHandoffId || args.supportCaseCloseReceiptId);
  const exportChannel = args.exportChannel ?? "account_download";
  const exportPacketReady = Boolean(args.exportPacketId);
  const redactionManifestReady = Boolean(args.redactionManifestHash);
  const minimizationPolicyReady = Boolean(args.minimizationPolicyId);
  const customerAckRequired = args.customerAckRequired !== false && support.paidDeliveryPolicy.canResumePaidDelivery;
  const customerAckReady = !customerAckRequired || Boolean(args.customerAckReceiptId);
  const allIdsRedacted = args.allIdsRedacted !== false;
  const rawTokensRemoved = args.rawTokensRemoved !== false;
  const rawPaymentIdsRemoved = args.rawPaymentIdsRemoved !== false;
  const privateNotesRemoved = args.privateNotesRemoved !== false;
  const supportMessagesSummarized = args.supportMessagesSummarized !== false;
  const supportSlaBound = support.paidDeliveryPolicy.canResumePaidDelivery && support.supportRemedyEnvelope.supportPacketRedacted;
  const payloadHashBound = args.payloadHashBound !== false && support.supportRemedyEnvelope.payloadHashBound;
  const sourceReceiptRootBound = args.sourceReceiptRootBound !== false && support.supportRemedyEnvelope.sourceReceiptRootBound;
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift || support.remedyRiskSignals.payloadOrSourceRootDrift || !payloadHashBound || !sourceReceiptRootBound);
  const exportRevoked = Boolean(args.exportRevoked);
  const channelReceiptReady = channelReceiptPresent(exportChannel, args);
  const redactionClear = allIdsRedacted && rawTokensRemoved && rawPaymentIdsRemoved && privateNotesRemoved && supportMessagesSummarized;
  const exportClear = Boolean(
    exportRequested &&
      exportPacketReady &&
      redactionManifestReady &&
      minimizationPolicyReady &&
      customerAckReady &&
      supportSlaBound &&
      payloadHashBound &&
      sourceReceiptRootBound &&
      !payloadOrSourceRootDrift &&
      !exportRevoked &&
      channelReceiptReady &&
      redactionClear,
  );

  const exportState: Pass2838CustomerExportRedactionPacketState = !exportRequested
    ? "not_requested"
    : exportRevoked
      ? "export_revoked"
      : !supportSlaBound
        ? "export_blocked_support_unresolved"
        : !redactionClear
          ? "redaction_failed"
          : exportClear && (args.customerDownloadId || args.emailNoticeId || args.apiHandoffId || args.supportCaseCloseReceiptId)
            ? "delivered_under_watch"
            : exportClear
              ? "export_ready"
              : "export_packet_pending";

  const exportReadinessScore = clamp(
    support.supportSlaScore +
      (exportRequested ? 5 : -4) +
      (exportPacketReady ? 14 : -18) +
      (redactionManifestReady ? 14 : -18) +
      (minimizationPolicyReady ? 10 : -14) +
      (customerAckReady ? 6 : -10) +
      (supportSlaBound ? 12 : -24) +
      (payloadHashBound ? 8 : -16) +
      (sourceReceiptRootBound ? 8 : -16) +
      (channelReceiptReady ? 8 : -12) +
      (allIdsRedacted ? 8 : -20) +
      (rawTokensRemoved ? 10 : -28) +
      (rawPaymentIdsRemoved ? 10 : -28) +
      (privateNotesRemoved ? 10 : -30) +
      (supportMessagesSummarized ? 6 : -14) -
      (payloadOrSourceRootDrift ? 28 : 0) -
      (exportRevoked ? 40 : 0),
  );

  const reason = !exportRequested
    ? "No customer export was requested; packet remains dormant and cannot be used as proof."
    : exportRevoked
      ? "Export packet was revoked; account vault, email/API handoff and support attachment are frozen."
      : !supportSlaBound
        ? "Support SLA/remedy proof is not clear; customer export cannot outrun support closure and replay-lock binding."
        : payloadOrSourceRootDrift
          ? "Payload/source-root drift invalidates the export packet; replay, reseal and regenerate the redacted packet."
          : !exportPacketReady || !redactionManifestReady || !minimizationPolicyReady
            ? "Export packet, redaction manifest and minimization policy must all be attached before customer delivery."
            : !redactionClear
              ? "Redaction policy failed; remove raw tokens, payment IDs, account IDs, private notes and full support messages."
              : !channelReceiptReady
                ? "The selected export channel is missing its own delivery receipt."
                : !customerAckReady
                  ? "Customer acknowledgment receipt is required before customer-visible export delivery."
                  : "Customer export packet is redacted, minimized and bound to support-SLA/payload/source-root; delivery can proceed under watch.";

  return {
    schemaVersion: "pass2838_customer_export_redaction_packet_gate_v1",
    surface: args.surface,
    tier: args.tier ?? support.tier,
    releasePacketId: support.releasePacketId,
    sealId: support.sealId,
    generatedAt,
    exportState,
    exportReadinessScore,
    exportEnvelope: {
      exportPacketId: redact(args.exportPacketId),
      exportChannel,
      customerDownloadId: redact(args.customerDownloadId),
      emailNoticeId: redact(args.emailNoticeId),
      apiHandoffId: redact(args.apiHandoffId),
      supportCaseCloseReceiptId: redact(args.supportCaseCloseReceiptId),
      redactionManifestHash: redact(args.redactionManifestHash),
      minimizationPolicyId: redact(args.minimizationPolicyId),
      customerAckReceiptId: redact(args.customerAckReceiptId),
      supportSlaBound,
      payloadHashBound,
      sourceReceiptRootBound,
      allIdsRedacted,
      rawTokensRemoved,
      rawPaymentIdsRemoved,
      privateNotesRemoved,
      supportMessagesSummarized,
    },
    exportPolicy: {
      canExportCustomerPacket: exportClear,
      canAttachToAccountVault: exportClear && exportChannel === "account_download",
      canSendEmailNotice: exportClear && exportChannel === "email_notice",
      canExposeSupportSummary: exportClear && supportMessagesSummarized,
      canClaimWorldClass100: false,
      reason,
    },
    exportRiskSignals: {
      missingExportPacket: !exportPacketReady,
      missingRedactionManifest: !redactionManifestReady,
      missingMinimizationPolicy: !minimizationPolicyReady,
      missingCustomerAck: !customerAckReady,
      supportSlaNotClear: !supportSlaBound,
      payloadOrSourceRootDrift,
      rawTokenExposureRisk: !rawTokensRemoved,
      rawPaymentExposureRisk: !rawPaymentIdsRemoved,
      privateNoteExposureRisk: !privateNotesRemoved,
      supportMessageOverexposureRisk: !supportMessagesSummarized,
      exportChannelReceiptMissing: !channelReceiptReady,
      exportRevoked,
    },
    operatorNextActions: [
      exportPacketReady ? "Export packet is present; keep it customer-minimized and payload-bound." : "Create a customer-safe export packet before download/email/API handoff.",
      redactionManifestReady ? "Redaction manifest is attached; verify raw IDs, tokens and private notes are absent." : "Attach redaction manifest before delivery.",
      minimizationPolicyReady ? "Minimization policy is attached; keep only fields needed for customer understanding." : "Attach data-minimization policy for the export packet.",
      supportSlaBound ? "Support SLA/remedy proof is clear; export can continue only with channel receipt and redaction manifest." : "Do not export: support SLA/remedy proof is not clear yet.",
      channelReceiptReady ? "Selected export channel has a delivery receipt." : "Attach a receipt for the selected export channel before customer delivery.",
      payloadOrSourceRootDrift ? "Replay/reseal required before export because payload/source root drift was detected." : "Payload/source-root binding is stable for this export check.",
    ],
  };
}
