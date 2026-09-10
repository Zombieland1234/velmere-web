import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2833IncidentDisclosureResponseGate } from "@/lib/market-integrity/top1-incident-disclosure-response-gate";

export type Pass2834CustomerRemedyState =
  | "no_remedy_required"
  | "remedy_review_required"
  | "paid_delivery_frozen"
  | "refund_credit_eligible"
  | "refund_credit_queued"
  | "refund_credit_issued"
  | "remedy_resolved";

export type Pass2834CustomerRemedyRefundCreditGate = {
  schemaVersion: "pass2834_customer_remedy_refund_credit_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  remedyState: Pass2834CustomerRemedyState;
  remedyScore: number;
  customerImpactSignals: {
    incidentRequiresRemedyReview: boolean;
    paidOrderAffected: boolean;
    paidDeliveryFrozen: boolean;
    deliveryFailed: boolean;
    duplicateChargeSuspected: boolean;
    refundRequested: boolean;
    customerImpactCount: number;
  };
  supportEvidencePacket: {
    supportTicketId: string | null;
    paymentReceiptIdRedacted: string | null;
    affectedAccountRefRedacted: boolean;
    customerNoticeSent: boolean;
    redactedEvidencePacketReady: boolean;
    postmortemCompleted: boolean;
  };
  remedyPolicy: {
    refundEligible: boolean;
    creditEligible: boolean;
    refundApproved: boolean;
    creditIssued: boolean;
    manualFinanceReviewRequired: boolean;
    canReopenPaidDelivery: boolean;
    canKeepLaunchReadyCopy: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  operatorNextActions: string[];
};

export const PASS2834_CUSTOMER_REMEDY_REFUND_CREDIT_ACCEPTANCE_GATES = [
  "PASS2834: Customer remedy is separate from incident disclosure; notice/postmortem does not automatically prove refund, credit or paid-delivery reopening.",
  "PASS2834: Refund/credit decisions require redacted support packet, payment receipt reference, customer-impact scope and manual finance review when paid evidence or delivery failed.",
  "PASS2834: Paid delivery stays frozen when incident disclosure says paid evidence is affected, when delivery failed, or when refund/credit review is open.",
  "PASS2834: Support packets must never expose raw account IDs, private PDF payloads, operator notes, source secrets or full payment identifiers.",
  "PASS2834: Launch-ready and world-class 100% claims remain false until remedy queue, support packet, refund/credit boundary and postmortem replay are resolved after incident impact.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function int(value: number | undefined, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function redactId(value: string | null | undefined) {
  if (!value) return null;
  const clean = value.replace(/[^a-zA-Z0-9_-]/g, "");
  if (clean.length <= 8) return `${clean.slice(0, 2)}…redacted`;
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

export function buildPass2834CustomerRemedyRefundCreditGate(args: {
  surface: string;
  tier?: VelmereTier;
  incidentDisclosureResponseGate: Pass2833IncidentDisclosureResponseGate;
  generatedAt?: string;
  paidOrderAffected?: boolean;
  deliveryFailed?: boolean;
  duplicateChargeSuspected?: boolean;
  refundRequested?: boolean;
  refundApproved?: boolean;
  creditIssued?: boolean;
  supportTicketId?: string | null;
  paymentReceiptId?: string | null;
  affectedAccountRefRedacted?: boolean;
  redactedEvidencePacketReady?: boolean;
  manualFinanceReviewComplete?: boolean;
}): Pass2834CustomerRemedyRefundCreditGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const incident = args.incidentDisclosureResponseGate;
  const customerImpactCount = int(incident.incidentSignals.customerImpactCount);
  const paidOrderAffected = Boolean(args.paidOrderAffected || incident.incidentSignals.paidEvidenceAffected || incident.postmortemBoundary.canReopenPaidDelivery === false);
  const deliveryFailed = Boolean(args.deliveryFailed || (incident.incidentSignals.paidEvidenceAffected && incident.postmortemBoundary.canReopenPaidDelivery === false));
  const duplicateChargeSuspected = Boolean(args.duplicateChargeSuspected);
  const refundRequested = Boolean(args.refundRequested);
  const refundApproved = Boolean(args.refundApproved);
  const creditIssued = Boolean(args.creditIssued);
  const customerNoticeSent = incident.customerCommunication.customerNoticeSent;
  const postmortemCompleted = incident.disclosureState === "resolved_with_postmortem" || incident.postmortemBoundary.canResumeCanary;
  const redactedEvidencePacketReady = Boolean(args.redactedEvidencePacketReady && args.affectedAccountRefRedacted !== false && args.supportTicketId);
  const incidentRequiresRemedyReview = Boolean(
    incident.incidentSignals.incidentDetected ||
      paidOrderAffected ||
      deliveryFailed ||
      duplicateChargeSuspected ||
      refundRequested ||
      customerImpactCount > 0,
  );
  const manualFinanceReviewRequired = Boolean(paidOrderAffected || deliveryFailed || duplicateChargeSuspected || refundRequested || customerImpactCount > 0);
  const financeReviewCleared = !manualFinanceReviewRequired || Boolean(args.manualFinanceReviewComplete || refundApproved || creditIssued);
  const refundEligible = Boolean((paidOrderAffected || deliveryFailed || duplicateChargeSuspected || refundRequested) && redactedEvidencePacketReady && customerNoticeSent);
  const creditEligible = Boolean((customerImpactCount > 0 || deliveryFailed || paidOrderAffected) && redactedEvidencePacketReady && customerNoticeSent);
  const paidDeliveryFrozen = Boolean(incident.postmortemBoundary.canReopenPaidDelivery === false || (incidentRequiresRemedyReview && !financeReviewCleared));
  const remedyResolved = !incidentRequiresRemedyReview || (financeReviewCleared && redactedEvidencePacketReady && customerNoticeSent && postmortemCompleted && (refundApproved || creditIssued || (!refundEligible && !creditEligible)));

  const remedyState: Pass2834CustomerRemedyState = !incidentRequiresRemedyReview
    ? "no_remedy_required"
    : remedyResolved
      ? "remedy_resolved"
      : refundApproved || creditIssued
        ? "refund_credit_issued"
        : refundEligible || creditEligible
          ? "refund_credit_eligible"
          : paidDeliveryFrozen
            ? "paid_delivery_frozen"
            : redactedEvidencePacketReady
              ? "refund_credit_queued"
              : "remedy_review_required";

  const remedyScore = clamp(
    incident.disclosureScore +
      (!incidentRequiresRemedyReview ? 16 : -20) +
      (redactedEvidencePacketReady ? 16 : incidentRequiresRemedyReview ? -14 : 0) +
      (customerNoticeSent ? 10 : incidentRequiresRemedyReview ? -8 : 0) +
      (postmortemCompleted ? 8 : incidentRequiresRemedyReview ? -6 : 0) +
      (financeReviewCleared ? 12 : -12) +
      (refundApproved ? 8 : 0) +
      (creditIssued ? 6 : 0) -
      (paidOrderAffected ? 10 : 0) -
      (deliveryFailed ? 12 : 0) -
      (duplicateChargeSuspected ? 18 : 0) -
      customerImpactCount * 2,
  );

  const canReopenPaidDelivery = Boolean(!paidDeliveryFrozen && remedyResolved && incident.postmortemBoundary.canReopenPaidDelivery);
  const canKeepLaunchReadyCopy = Boolean(canReopenPaidDelivery && incident.postmortemBoundary.canKeepLaunchReadyCopy && postmortemCompleted);

  return {
    schemaVersion: "pass2834_customer_remedy_refund_credit_gate_v1",
    surface: args.surface,
    tier: args.tier ?? incident.tier,
    releasePacketId: incident.releasePacketId,
    sealId: incident.sealId,
    generatedAt,
    remedyState,
    remedyScore,
    customerImpactSignals: {
      incidentRequiresRemedyReview,
      paidOrderAffected,
      paidDeliveryFrozen,
      deliveryFailed,
      duplicateChargeSuspected,
      refundRequested,
      customerImpactCount,
    },
    supportEvidencePacket: {
      supportTicketId: redactId(args.supportTicketId),
      paymentReceiptIdRedacted: redactId(args.paymentReceiptId),
      affectedAccountRefRedacted: args.affectedAccountRefRedacted !== false,
      customerNoticeSent,
      redactedEvidencePacketReady,
      postmortemCompleted,
    },
    remedyPolicy: {
      refundEligible,
      creditEligible,
      refundApproved,
      creditIssued,
      manualFinanceReviewRequired,
      canReopenPaidDelivery,
      canKeepLaunchReadyCopy,
      canClaimWorldClass100: false,
      reason: !incidentRequiresRemedyReview
        ? "No customer-impact remedy is required, but launch proof still depends on sealed/canary/incident gates."
        : duplicateChargeSuspected
          ? "Duplicate-charge suspicion requires manual finance review and redacted support evidence before refund/credit or paid delivery can resume."
          : paidOrderAffected || deliveryFailed
            ? "Paid order or delivery impact freezes paid delivery until customer notice, redacted evidence packet, finance review and postmortem replay clear."
            : customerImpactCount > 0
              ? "Customer impact requires support packet and remedy review before launch-ready copy or paid delivery can resume."
              : "Remedy review is open; support evidence, customer notice and finance review must clear before reopening paid delivery.",
    },
    operatorNextActions: [
      "Create a redacted support packet tied to releasePacketId/sealId and payment receipt reference before any refund/credit decision.",
      "Freeze paid delivery while remedy review, duplicate-charge suspicion, failed delivery or paid evidence impact remains open.",
      "Keep full account IDs, raw PDF payloads, source secrets, operator notes and full payment identifiers out of customer/support packets.",
      "After remedy resolution, replay incident disclosure, reseal release proof and restart canary before launch-ready copy is restored.",
    ],
  };
}
