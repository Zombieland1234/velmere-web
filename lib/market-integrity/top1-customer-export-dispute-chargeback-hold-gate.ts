import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2841CustomerExportAcknowledgementSignedReceiptGate } from "@/lib/market-integrity/top1-customer-export-ack-signed-receipt-gate";

export type Pass2842CustomerExportHoldState =
  | "ack_blocked"
  | "no_hold_required"
  | "hold_review_required"
  | "payment_dispute_active"
  | "chargeback_active"
  | "payment_withdrawal_active"
  | "policy_violation_hold"
  | "compliance_hold"
  | "customer_dispute_open"
  | "refund_credit_collision"
  | "payload_drift_blocked"
  | "hold_release_receipt_missing"
  | "operator_review_missing"
  | "customer_export_hold_clear";

export type Pass2842CustomerExportHoldReason =
  | "none"
  | "payment_dispute"
  | "chargeback"
  | "payment_withdrawal"
  | "policy_violation"
  | "compliance_review"
  | "customer_dispute"
  | "refund_credit_collision"
  | "payload_source_drift";

export type Pass2842CustomerExportDisputeChargebackHoldGate = {
  schemaVersion: "pass2842_customer_export_dispute_chargeback_hold_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  holdState: Pass2842CustomerExportHoldState;
  holdReadinessScore: number;
  holdEnvelope: {
    holdRequired: boolean;
    activeHoldReason: Pass2842CustomerExportHoldReason;
    disputeCaseId: string | null;
    chargebackCaseId: string | null;
    paymentWithdrawalReceiptId: string | null;
    policyHoldReceiptId: string | null;
    complianceReviewReceiptId: string | null;
    refundCreditReceiptId: string | null;
    supportTicketId: string | null;
    holdOpenedAt: string | null;
    holdExpiresAt: string | null;
    holdReleaseReceiptId: string | null;
    operatorReviewReceiptId: string | null;
    payloadHashBound: string | null;
    sourceReceiptRootBound: string | null;
  };
  holdPolicy: {
    canServeCustomerVisibleExport: boolean;
    canSendFinalEmailNotice: boolean;
    canExposeFinalApiHandoff: boolean;
    canAttachFinalSupportPacket: boolean;
    canClaimFinalCustomerExportDelivered: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  holdRiskSignals: {
    acknowledgementBlocked: boolean;
    paymentDisputeActive: boolean;
    chargebackActive: boolean;
    paymentWithdrawalPending: boolean;
    policyViolationHold: boolean;
    complianceHold: boolean;
    customerDisputeOpen: boolean;
    refundCreditCollision: boolean;
    payloadOrSourceRootDrift: boolean;
    missingHoldReleaseReceipt: boolean;
    missingOperatorReviewReceipt: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2842_CUSTOMER_EXPORT_DISPUTE_CHARGEBACK_HOLD_ACCEPTANCE_GATES = [
  "PASS2842: A signed customer acknowledgement is not final delivery when payment dispute, chargeback, withdrawal reversal, policy hold, compliance hold or customer dispute is active.",
  "PASS2842: Customer-visible export must freeze on active dispute/chargeback/withdrawal/policy/compliance holds until a hold-release receipt and operator review receipt are appended server-side.",
  "PASS2842: Refund/credit/remedy receipts cannot collide with final paid evidence delivery; collision requires support review and blocks email/API/support attachment release.",
  "PASS2842: Hold release must be bound to payloadHash, sourceReceiptRoot, support ticket, dispute/chargeback case IDs and previous PASS2841 signed acknowledgement receipt.",
  "PASS2842: Customer-facing copy must explain that holds protect evidence integrity and account safety, not that Velmere is making a market or legal judgement.",
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

function asStamp(value: string | null | undefined) {
  if (!value) return null;
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : null;
}

export function buildPass2842CustomerExportDisputeChargebackHoldGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportAcknowledgementSignedReceiptGate: Pass2841CustomerExportAcknowledgementSignedReceiptGate;
  generatedAt?: string;
  holdRequired?: boolean;
  activeHoldReason?: Pass2842CustomerExportHoldReason;
  disputeCaseId?: string | null;
  chargebackCaseId?: string | null;
  paymentWithdrawalReceiptId?: string | null;
  policyHoldReceiptId?: string | null;
  complianceReviewReceiptId?: string | null;
  refundCreditReceiptId?: string | null;
  supportTicketId?: string | null;
  holdOpenedAt?: string | null;
  holdExpiresAt?: string | null;
  holdReleaseReceiptId?: string | null;
  operatorReviewReceiptId?: string | null;
  payloadHashBound?: string | null;
  sourceReceiptRootBound?: string | null;
  paymentDisputeActive?: boolean;
  chargebackActive?: boolean;
  paymentWithdrawalPending?: boolean;
  policyViolationHold?: boolean;
  complianceHold?: boolean;
  customerDisputeOpen?: boolean;
  refundCreditCollision?: boolean;
  payloadOrSourceRootDrift?: boolean;
}): Pass2842CustomerExportDisputeChargebackHoldGate {
  const previousGate = args.customerExportAcknowledgementSignedReceiptGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const acknowledgementClear = Boolean(
    previousGate.acknowledgementPolicy.canServeCustomerVisibleExport &&
      !previousGate.acknowledgementRiskSignals.payloadOrSourceRootDrift &&
      !previousGate.acknowledgementRiskSignals.customerDisputed &&
      !previousGate.acknowledgementRiskSignals.acknowledgementRevoked,
  );
  const paymentDisputeActive = Boolean(args.paymentDisputeActive);
  const chargebackActive = Boolean(args.chargebackActive);
  const paymentWithdrawalPending = Boolean(args.paymentWithdrawalPending);
  const policyViolationHold = Boolean(args.policyViolationHold);
  const complianceHold = Boolean(args.complianceHold);
  const customerDisputeOpen = Boolean(args.customerDisputeOpen);
  const refundCreditCollision = Boolean(args.refundCreditCollision);
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift || previousGate.acknowledgementRiskSignals.payloadOrSourceRootDrift);
  const activeHold = paymentDisputeActive || chargebackActive || paymentWithdrawalPending || policyViolationHold || complianceHold || customerDisputeOpen || refundCreditCollision || payloadOrSourceRootDrift;
  const holdRequired = args.holdRequired ?? activeHold;
  const releaseReceiptReady = Boolean(args.holdReleaseReceiptId);
  const operatorReviewReady = Boolean(args.operatorReviewReceiptId);
  const holdReleaseReady = !holdRequired || (!activeHold && releaseReceiptReady && operatorReviewReady && !payloadOrSourceRootDrift);
  const nowStamp = asStamp(generatedAt) ?? Date.now();
  const holdExpiresStamp = asStamp(args.holdExpiresAt);
  const holdWindowExpired = Boolean(holdExpiresStamp && holdExpiresStamp <= nowStamp && activeHold);
  const activeHoldReason: Pass2842CustomerExportHoldReason = args.activeHoldReason ?? (
    payloadOrSourceRootDrift ? "payload_source_drift" :
    chargebackActive ? "chargeback" :
    paymentDisputeActive ? "payment_dispute" :
    paymentWithdrawalPending ? "payment_withdrawal" :
    policyViolationHold ? "policy_violation" :
    complianceHold ? "compliance_review" :
    customerDisputeOpen ? "customer_dispute" :
    refundCreditCollision ? "refund_credit_collision" :
    "none"
  );

  const holdState: Pass2842CustomerExportHoldState = !acknowledgementClear
    ? "ack_blocked"
    : payloadOrSourceRootDrift
      ? "payload_drift_blocked"
      : chargebackActive
        ? "chargeback_active"
        : paymentDisputeActive
          ? "payment_dispute_active"
          : paymentWithdrawalPending
            ? "payment_withdrawal_active"
            : policyViolationHold
              ? "policy_violation_hold"
              : complianceHold
                ? "compliance_hold"
                : customerDisputeOpen
                  ? "customer_dispute_open"
                  : refundCreditCollision
                    ? "refund_credit_collision"
                    : !holdRequired
                      ? "no_hold_required"
                      : !releaseReceiptReady
                        ? "hold_release_receipt_missing"
                        : !operatorReviewReady
                          ? "operator_review_missing"
                          : "customer_export_hold_clear";

  const holdReadinessScore = clamp(
    previousGate.acknowledgementReadinessScore +
      (acknowledgementClear ? 12 : -40) +
      (holdRequired ? -8 : 8) +
      (releaseReceiptReady ? 12 : holdRequired ? -18 : 0) +
      (operatorReviewReady ? 12 : holdRequired ? -18 : 0) -
      (paymentDisputeActive ? 22 : 0) -
      (chargebackActive ? 30 : 0) -
      (paymentWithdrawalPending ? 24 : 0) -
      (policyViolationHold ? 24 : 0) -
      (complianceHold ? 20 : 0) -
      (customerDisputeOpen ? 18 : 0) -
      (refundCreditCollision ? 18 : 0) -
      (payloadOrSourceRootDrift ? 34 : 0) -
      (holdWindowExpired ? 8 : 0),
  );

  const deliveryClear = acknowledgementClear && holdReleaseReady && !activeHold;
  const reason = !acknowledgementClear
    ? "PASS2841 signed acknowledgement is not clear; dispute/chargeback hold release cannot override a blocked acknowledgement."
    : payloadOrSourceRootDrift
      ? "Payload/source-root drift freezes customer export; replay, reseal and regenerate acknowledgement before hold release."
      : chargebackActive
        ? "Chargeback is active; freeze account download, email notice, API handoff and support attachment until finance/support append release receipts."
        : paymentDisputeActive
          ? "Payment dispute is active; freeze final customer-visible export until dispute is resolved and release receipt is stored."
          : paymentWithdrawalPending
            ? "Payment withdrawal/reversal is pending; freeze final delivery until payment state is reconciled server-side."
            : policyViolationHold
              ? "Policy hold is active; customer export must remain frozen pending operator review."
              : complianceHold
                ? "Compliance review hold is active; final customer export cannot be claimed yet."
                : customerDisputeOpen
                  ? "Customer dispute is open; keep final delivery frozen and route to support review."
                  : refundCreditCollision
                    ? "Refund/credit/remedy collision detected; final paid evidence delivery needs support/finance reconciliation."
                    : !holdRequired
                      ? "No dispute, chargeback, withdrawal, policy, compliance, customer dispute or refund collision hold is active."
                      : !releaseReceiptReady
                        ? "Hold release receipt is missing; do not resume customer-visible delivery."
                        : !operatorReviewReady
                          ? "Operator review receipt is missing; do not resume customer-visible delivery."
                          : "Hold is released with operator review and the signed acknowledgement remains stable; final customer export can be referenced for this channel.";

  return {
    schemaVersion: "pass2842_customer_export_dispute_chargeback_hold_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    holdState,
    holdReadinessScore,
    holdEnvelope: {
      holdRequired,
      activeHoldReason,
      disputeCaseId: redact(args.disputeCaseId),
      chargebackCaseId: redact(args.chargebackCaseId),
      paymentWithdrawalReceiptId: redact(args.paymentWithdrawalReceiptId),
      policyHoldReceiptId: redact(args.policyHoldReceiptId),
      complianceReviewReceiptId: redact(args.complianceReviewReceiptId),
      refundCreditReceiptId: redact(args.refundCreditReceiptId),
      supportTicketId: redact(args.supportTicketId),
      holdOpenedAt: args.holdOpenedAt ?? null,
      holdExpiresAt: args.holdExpiresAt ?? null,
      holdReleaseReceiptId: redact(args.holdReleaseReceiptId),
      operatorReviewReceiptId: redact(args.operatorReviewReceiptId),
      payloadHashBound: redact(args.payloadHashBound),
      sourceReceiptRootBound: redact(args.sourceReceiptRootBound),
    },
    holdPolicy: {
      canServeCustomerVisibleExport: deliveryClear,
      canSendFinalEmailNotice: deliveryClear && previousGate.acknowledgementPolicy.canSendFinalEmailNotice,
      canExposeFinalApiHandoff: deliveryClear && previousGate.acknowledgementPolicy.canExposeFinalApiHandoff,
      canAttachFinalSupportPacket: deliveryClear && previousGate.acknowledgementPolicy.canAttachFinalSupportPacket,
      canClaimFinalCustomerExportDelivered: deliveryClear,
      canClaimWorldClass100: false,
      reason,
    },
    holdRiskSignals: {
      acknowledgementBlocked: !acknowledgementClear,
      paymentDisputeActive,
      chargebackActive,
      paymentWithdrawalPending,
      policyViolationHold,
      complianceHold,
      customerDisputeOpen,
      refundCreditCollision,
      payloadOrSourceRootDrift,
      missingHoldReleaseReceipt: holdRequired && !releaseReceiptReady,
      missingOperatorReviewReceipt: holdRequired && !operatorReviewReady,
    },
    customerSafeCopy:
      "Customer export may be temporarily held when a payment dispute, chargeback, withdrawal reversal, policy review, compliance review or customer dispute is active. This protects evidence integrity and account safety; it is not financial advice, a guarantee or a market judgement.",
    operatorNextActions: [
      acknowledgementClear ? "PASS2841 acknowledgement is clear." : "Resolve PASS2841 acknowledgement before reviewing export holds.",
      activeHold ? "Keep account download, email notice, API handoff and support attachment frozen until the active hold clears." : "No active dispute/chargeback/withdrawal/policy/compliance hold is detected.",
      releaseReceiptReady || !holdRequired ? "Hold release receipt status is acceptable for this path." : "Append a hold-release receipt bound to payloadHash/sourceReceiptRoot/support ticket before resuming delivery.",
      operatorReviewReady || !holdRequired ? "Operator review receipt status is acceptable for this path." : "Append operator review receipt before resuming customer-visible export.",
      !refundCreditCollision ? "No refund/credit collision blocks final delivery." : "Reconcile refund/credit/remedy collision with finance/support before final delivery.",
      !payloadOrSourceRootDrift ? "Payload/source-root binding is stable." : "Replay, reseal and regenerate acknowledgement because payload/source-root drifted.",
    ],
  };
}
