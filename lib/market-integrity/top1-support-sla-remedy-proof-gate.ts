import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2836RemedyReopenReplayLockGate } from "@/lib/market-integrity/top1-remedy-reopen-replay-lock-gate";

export type Pass2837SupportSlaRemedyProofState =
  | "not_required"
  | "support_sla_missing"
  | "support_packet_pending"
  | "sla_breached_paid_delivery_frozen"
  | "remedy_proof_ready"
  | "reopen_allowed_under_sla_watch"
  | "remedy_closed";

export type Pass2837SupportSlaRemedyProofGate = {
  schemaVersion: "pass2837_support_sla_remedy_proof_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supportSlaState: Pass2837SupportSlaRemedyProofState;
  supportSlaScore: number;
  supportRemedyEnvelope: {
    supportTicketId: string | null;
    remedySlaPolicyId: string | null;
    supportOwnerPseudonym: string | null;
    customerNoticeReceiptId: string | null;
    supportPacketHash: string | null;
    financeRemedyReceiptId: string | null;
    deliveryReopenApprovedAt: string | null;
    supportPacketRedacted: boolean;
    refundCreditReceiptBound: boolean;
    replayLockBound: boolean;
    payloadHashBound: boolean;
    sourceReceiptRootBound: boolean;
  };
  slaClock: {
    slaDueHours: number;
    actualFirstResponseHours: number | null;
    currentAgeHours: number;
    firstResponseWithinSla: boolean;
    remedyWithinSla: boolean;
    customerReplyUnresolved: boolean;
    escalationRequired: boolean;
  };
  paidDeliveryPolicy: {
    canResumePaidDelivery: boolean;
    canSendCustomerDownloadLink: boolean;
    canRenderPaidEvidence: boolean;
    canCloseSupportCase: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  remedyRiskSignals: {
    missingSupportTicket: boolean;
    missingSupportPacket: boolean;
    missingFinanceRemedyReceipt: boolean;
    missingCustomerNoticeReceipt: boolean;
    slaBreached: boolean;
    unresolvedCustomerReply: boolean;
    unredactedSupportPacket: boolean;
    replayLockNotClear: boolean;
    payloadOrSourceRootDrift: boolean;
  };
  operatorNextActions: string[];
};

export const PASS2837_SUPPORT_SLA_REMEDY_PROOF_ACCEPTANCE_GATES = [
  "PASS2837: Remedy/reopen cannot close or resume paid delivery unless a support SLA packet is attached to the same replay-lock/payload/source-root chain.",
  "PASS2837: Customer support proof must include a redacted support ticket, SLA policy, support packet hash, customer notice receipt and finance remedy receipt when paid delivery was impacted.",
  "PASS2837: SLA breach, unresolved customer reply or unredacted support packet freezes paid evidence and customer download links even when replay-lock is otherwise clear.",
  "PASS2837: Support remedy proof must not expose raw account IDs, raw payment IDs, raw report tokens, private operator notes or full customer messages on customer-facing surfaces.",
  "PASS2837: Closing a support case is not the same as reopening paid delivery; resume requires replay-lock clear, payloadHash/sourceReceiptRoot binding and customer remedy proof continuity.",
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

export function buildPass2837SupportSlaRemedyProofGate(args: {
  surface: string;
  tier?: VelmereTier;
  remedyReopenReplayLockGate: Pass2836RemedyReopenReplayLockGate;
  generatedAt?: string;
  supportTicketId?: string | null;
  remedySlaPolicyId?: string | null;
  supportOwnerPseudonym?: string | null;
  customerNoticeReceiptId?: string | null;
  supportPacketHash?: string | null;
  financeRemedyReceiptId?: string | null;
  deliveryReopenApprovedAt?: string | null;
  slaDueHours?: number;
  actualFirstResponseHours?: number | null;
  currentAgeHours?: number;
  supportPacketRedacted?: boolean;
  refundCreditReceiptBound?: boolean;
  customerReplyUnresolved?: boolean;
  supportEscalated?: boolean;
  payloadHashBound?: boolean;
  sourceReceiptRootBound?: boolean;
  payloadOrSourceRootDrift?: boolean;
}): Pass2837SupportSlaRemedyProofGate {
  const replay = args.remedyReopenReplayLockGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const supportTicketReady = Boolean(args.supportTicketId);
  const slaPolicyReady = Boolean(args.remedySlaPolicyId);
  const supportPacketReady = Boolean(args.supportPacketHash);
  const financeReceiptReady = Boolean(args.financeRemedyReceiptId);
  const noticeReady = Boolean(args.customerNoticeReceiptId);
  const supportPacketRedacted = args.supportPacketRedacted !== false;
  const refundCreditReceiptBound = args.refundCreditReceiptBound !== false;
  const replayLockBound = replay.duplicateDeliveryFirewall.canResumeAccountVaultDelivery && replay.duplicateDeliveryFirewall.canRenderPaidEvidence;
  const payloadHashBound = args.payloadHashBound !== false && replay.replayLockEnvelope.payloadHashBound;
  const sourceReceiptRootBound = args.sourceReceiptRootBound !== false && replay.replayLockEnvelope.sourceReceiptRootBound;
  const slaDueHours = Math.max(1, Number(args.slaDueHours ?? 24));
  const currentAgeHours = Math.max(0, Number(args.currentAgeHours ?? 0));
  const actualFirstResponseHours = args.actualFirstResponseHours === undefined ? null : args.actualFirstResponseHours;
  const firstResponseWithinSla = actualFirstResponseHours !== null && actualFirstResponseHours <= slaDueHours;
  const remedyWithinSla = currentAgeHours <= slaDueHours * 2;
  const unresolvedCustomerReply = Boolean(args.customerReplyUnresolved);
  const slaBreached = (actualFirstResponseHours !== null && actualFirstResponseHours > slaDueHours) || currentAgeHours > slaDueHours * 2;
  const escalationRequired = Boolean(args.supportEscalated || slaBreached || unresolvedCustomerReply);
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift || replay.replayRiskSignals.payloadOrSourceRootDrift || !payloadHashBound || !sourceReceiptRootBound);
  const supportClear = Boolean(
    supportTicketReady &&
      slaPolicyReady &&
      supportPacketReady &&
      financeReceiptReady &&
      noticeReady &&
      supportPacketRedacted &&
      refundCreditReceiptBound &&
      replayLockBound &&
      payloadHashBound &&
      sourceReceiptRootBound &&
      !slaBreached &&
      !unresolvedCustomerReply &&
      !payloadOrSourceRootDrift,
  );

  const supportSlaState: Pass2837SupportSlaRemedyProofState = replay.replayLockState === "not_required"
    ? "not_required"
    : supportClear && args.deliveryReopenApprovedAt
      ? "remedy_closed"
      : supportClear
        ? "reopen_allowed_under_sla_watch"
        : slaBreached
          ? "sla_breached_paid_delivery_frozen"
          : supportTicketReady && supportPacketReady && financeReceiptReady && noticeReady
            ? "remedy_proof_ready"
            : supportTicketReady || supportPacketReady
              ? "support_packet_pending"
              : "support_sla_missing";

  const supportSlaScore = clamp(
    replay.replayLockScore +
      (supportTicketReady ? 10 : -16) +
      (slaPolicyReady ? 8 : -12) +
      (supportPacketReady ? 12 : -18) +
      (financeReceiptReady ? 10 : -16) +
      (noticeReady ? 8 : -12) +
      (supportPacketRedacted ? 8 : -24) +
      (refundCreditReceiptBound ? 8 : -16) +
      (replayLockBound ? 10 : -18) +
      (payloadHashBound ? 6 : -14) +
      (sourceReceiptRootBound ? 6 : -14) +
      (firstResponseWithinSla ? 6 : actualFirstResponseHours === null ? -4 : -14) +
      (remedyWithinSla ? 4 : -12) -
      (slaBreached ? 26 : 0) -
      (unresolvedCustomerReply ? 18 : 0) -
      (payloadOrSourceRootDrift ? 24 : 0),
  );

  const canResumePaidDelivery = supportClear;
  const canSendCustomerDownloadLink = supportClear;
  const canRenderPaidEvidence = supportClear;
  const canCloseSupportCase = supportClear && Boolean(args.deliveryReopenApprovedAt);

  return {
    schemaVersion: "pass2837_support_sla_remedy_proof_gate_v1",
    surface: args.surface,
    tier: args.tier ?? replay.tier,
    releasePacketId: replay.releasePacketId,
    sealId: replay.sealId,
    generatedAt,
    supportSlaState,
    supportSlaScore,
    supportRemedyEnvelope: {
      supportTicketId: redact(args.supportTicketId),
      remedySlaPolicyId: redact(args.remedySlaPolicyId),
      supportOwnerPseudonym: redact(args.supportOwnerPseudonym),
      customerNoticeReceiptId: redact(args.customerNoticeReceiptId),
      supportPacketHash: redact(args.supportPacketHash),
      financeRemedyReceiptId: redact(args.financeRemedyReceiptId),
      deliveryReopenApprovedAt: args.deliveryReopenApprovedAt ?? null,
      supportPacketRedacted,
      refundCreditReceiptBound,
      replayLockBound,
      payloadHashBound,
      sourceReceiptRootBound,
    },
    slaClock: {
      slaDueHours,
      actualFirstResponseHours,
      currentAgeHours,
      firstResponseWithinSla,
      remedyWithinSla,
      customerReplyUnresolved: unresolvedCustomerReply,
      escalationRequired,
    },
    paidDeliveryPolicy: {
      canResumePaidDelivery,
      canSendCustomerDownloadLink,
      canRenderPaidEvidence,
      canCloseSupportCase,
      canClaimWorldClass100: false,
      reason: !replayLockBound
        ? "Replay-lock is not clear; support SLA proof cannot reopen paid delivery by itself."
        : payloadOrSourceRootDrift
          ? "Payload/source-root drift invalidates the support remedy chain; replay, reseal and reopen with a new customer packet."
          : !supportTicketReady || !slaPolicyReady
            ? "Support ticket and SLA policy are required before remedy proof can be customer-visible."
            : !supportPacketReady || !financeReceiptReady || !noticeReady
              ? "Support packet, finance remedy receipt and customer notice receipt must all be attached before reopening paid delivery."
              : !supportPacketRedacted
                ? "Support packet is not redacted; paid evidence and customer download links remain frozen."
                : slaBreached
                  ? "SLA was breached; escalate and attach operator decision before closing or reopening delivery."
                  : unresolvedCustomerReply
                    ? "Customer reply remains unresolved; paid delivery cannot be closed or reopened yet."
                    : supportClear
                      ? "Support SLA/remedy proof is attached, redacted and bound to replay-lock/payload/source-root; paid delivery can reopen under watch."
                      : "Support remedy proof is prepared but incomplete; keep paid delivery frozen.",
    },
    remedyRiskSignals: {
      missingSupportTicket: !supportTicketReady,
      missingSupportPacket: !supportPacketReady,
      missingFinanceRemedyReceipt: !financeReceiptReady,
      missingCustomerNoticeReceipt: !noticeReady,
      slaBreached,
      unresolvedCustomerReply,
      unredactedSupportPacket: !supportPacketRedacted,
      replayLockNotClear: !replayLockBound,
      payloadOrSourceRootDrift,
    },
    operatorNextActions: [
      supportTicketReady ? "Support ticket is attached; keep only redacted IDs on customer surfaces." : "Create or attach redacted support ticket before remedy close.",
      supportPacketReady ? "Support packet hash attached; verify it excludes raw tokens, payment IDs and private notes." : "Build redacted support evidence packet for customer-impact remedy.",
      financeReceiptReady ? "Finance remedy receipt is present; bind it to refund/credit decision." : "Attach finance receipt before reopening paid delivery.",
      noticeReady ? "Customer notice receipt is present; keep notice copy evidence-bound." : "Attach customer notice receipt before remedy resolution.",
      replayLockBound ? "Replay-lock is clear; support SLA proof becomes the remaining paid-delivery boundary." : "Do not reopen: replay-lock still blocks old-token/duplicate delivery risk.",
      slaBreached ? "Escalate SLA breach and freeze paid delivery until operator decision is recorded." : "SLA clock is inside configured boundary; continue watch until closure.",
    ],
  };
}
