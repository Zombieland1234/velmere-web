import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2842CustomerExportDisputeChargebackHoldGate } from "@/lib/market-integrity/top1-customer-export-dispute-chargeback-hold-gate";

export type Pass2843CustomerExportReinstatementState =
  | "hold_blocked"
  | "release_not_required"
  | "release_requested"
  | "release_decision_missing"
  | "operator_countersignature_missing"
  | "finance_compliance_close_missing"
  | "cooling_window_active"
  | "channel_reinstatement_missing"
  | "customer_notice_missing"
  | "payload_drift_blocked"
  | "duplicate_reinstatement_blocked"
  | "reinstatement_ready";

export type Pass2843CustomerExportOperatorReleaseDecision =
  | "none"
  | "reinstate_account_download"
  | "reinstate_email_notice"
  | "reinstate_api_handoff"
  | "reinstate_support_attachment"
  | "reinstate_all_channels"
  | "deny_reinstatement";

export type Pass2843CustomerExportOperatorReleaseReinstatementGate = {
  schemaVersion: "pass2843_customer_export_operator_release_reinstatement_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  reinstatementState: Pass2843CustomerExportReinstatementState;
  reinstatementReadinessScore: number;
  reinstatementEnvelope: {
    releaseRequested: boolean;
    releaseDecision: Pass2843CustomerExportOperatorReleaseDecision;
    operatorReleaseReceiptId: string | null;
    seniorOperatorCountersignatureId: string | null;
    financeCloseReceiptId: string | null;
    complianceCloseReceiptId: string | null;
    supportResolutionReceiptId: string | null;
    customerReinstatementNoticeReceiptId: string | null;
    reissuedExportLinkId: string | null;
    channelReinstatementReceiptId: string | null;
    reinstatementDedupKey: string | null;
    coolingWindowEndsAt: string | null;
    payloadHashBound: string | null;
    sourceReceiptRootBound: string | null;
    previousHoldReleaseReceiptId: string | null;
    previousOperatorReviewReceiptId: string | null;
  };
  reinstatementPolicy: {
    canServeCustomerVisibleExport: boolean;
    canSendFinalEmailNotice: boolean;
    canExposeFinalApiHandoff: boolean;
    canAttachFinalSupportPacket: boolean;
    canClaimReinstatedDelivery: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  reinstatementRiskSignals: {
    previousHoldBlocked: boolean;
    releaseRequestedButMissingDecision: boolean;
    deniedByOperator: boolean;
    missingOperatorReleaseReceipt: boolean;
    missingSeniorCountersignature: boolean;
    missingFinanceOrComplianceClose: boolean;
    coolingWindowActive: boolean;
    missingCustomerNotice: boolean;
    missingReissuedExportLink: boolean;
    missingChannelReinstatementReceipt: boolean;
    duplicateReinstatementAttempt: boolean;
    payloadOrSourceRootDrift: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2843_CUSTOMER_EXPORT_OPERATOR_RELEASE_REINSTATEMENT_ACCEPTANCE_GATES = [
  "PASS2843: A cleared dispute/chargeback hold is not enough to resume customer export; reinstatement requires an operator-release receipt and senior countersignature bound to the same payloadHash/sourceReceiptRoot.",
  "PASS2843: Finance close, compliance close and support-resolution receipts must be attached before account download, email notice, API handoff or support attachment is re-enabled after a hold.",
  "PASS2843: Reinstated export must use a new channel reinstatement receipt, reissued export link ID and dedup key; old frozen links cannot silently become active again.",
  "PASS2843: Customer-safe reinstatement notice is mandatory and must explain that delivery was resumed after evidence-integrity review, not because Velmere gives legal/market/financial guarantees.",
  "PASS2843: Payload/source-root drift, duplicate reinstatement attempt, active cooling window or operator denial freezes reinstated delivery even when PASS2842 hold release exists.",
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

export function buildPass2843CustomerExportOperatorReleaseReinstatementGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportDisputeChargebackHoldGate: Pass2842CustomerExportDisputeChargebackHoldGate;
  generatedAt?: string;
  releaseRequested?: boolean;
  releaseDecision?: Pass2843CustomerExportOperatorReleaseDecision;
  operatorReleaseReceiptId?: string | null;
  seniorOperatorCountersignatureId?: string | null;
  financeCloseReceiptId?: string | null;
  complianceCloseReceiptId?: string | null;
  supportResolutionReceiptId?: string | null;
  customerReinstatementNoticeReceiptId?: string | null;
  reissuedExportLinkId?: string | null;
  channelReinstatementReceiptId?: string | null;
  reinstatementDedupKey?: string | null;
  coolingWindowEndsAt?: string | null;
  payloadHashBound?: string | null;
  sourceReceiptRootBound?: string | null;
  previousHoldReleaseReceiptId?: string | null;
  previousOperatorReviewReceiptId?: string | null;
  duplicateReinstatementAttempt?: boolean;
  payloadOrSourceRootDrift?: boolean;
}): Pass2843CustomerExportOperatorReleaseReinstatementGate {
  const previousGate = args.customerExportDisputeChargebackHoldGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const releaseDecision = args.releaseDecision ?? "none";
  const releaseRequested = Boolean(args.releaseRequested || releaseDecision !== "none");
  const previousHoldClear = Boolean(
    previousGate.holdPolicy.canServeCustomerVisibleExport &&
      !previousGate.holdRiskSignals.paymentDisputeActive &&
      !previousGate.holdRiskSignals.chargebackActive &&
      !previousGate.holdRiskSignals.paymentWithdrawalPending &&
      !previousGate.holdRiskSignals.policyViolationHold &&
      !previousGate.holdRiskSignals.complianceHold &&
      !previousGate.holdRiskSignals.customerDisputeOpen &&
      !previousGate.holdRiskSignals.refundCreditCollision &&
      !previousGate.holdRiskSignals.payloadOrSourceRootDrift,
  );
  const operatorReceiptReady = Boolean(args.operatorReleaseReceiptId);
  const seniorCountersignatureReady = Boolean(args.seniorOperatorCountersignatureId);
  const financeCloseReady = Boolean(args.financeCloseReceiptId);
  const complianceCloseReady = Boolean(args.complianceCloseReceiptId);
  const supportResolutionReady = Boolean(args.supportResolutionReceiptId);
  const customerNoticeReady = Boolean(args.customerReinstatementNoticeReceiptId);
  const reissuedExportLinkReady = Boolean(args.reissuedExportLinkId);
  const channelReinstatementReady = Boolean(args.channelReinstatementReceiptId);
  const dedupReady = Boolean(args.reinstatementDedupKey);
  const duplicateReinstatementAttempt = Boolean(args.duplicateReinstatementAttempt);
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift || previousGate.holdRiskSignals.payloadOrSourceRootDrift);
  const nowStamp = asStamp(generatedAt) ?? Date.now();
  const coolingEndsStamp = asStamp(args.coolingWindowEndsAt);
  const coolingWindowActive = Boolean(coolingEndsStamp && coolingEndsStamp > nowStamp);
  const deniedByOperator = releaseDecision === "deny_reinstatement";
  const decisionReady = releaseDecision !== "none" && !deniedByOperator;
  const financeComplianceSupportReady = financeCloseReady && complianceCloseReady && supportResolutionReady;

  const releaseClear = Boolean(
    previousHoldClear &&
      (!releaseRequested || (
        decisionReady &&
        operatorReceiptReady &&
        seniorCountersignatureReady &&
        financeComplianceSupportReady &&
        customerNoticeReady &&
        reissuedExportLinkReady &&
        channelReinstatementReady &&
        dedupReady &&
        !coolingWindowActive &&
        !duplicateReinstatementAttempt &&
        !payloadOrSourceRootDrift
      )),
  );

  const reinstatementState: Pass2843CustomerExportReinstatementState = !previousHoldClear
    ? "hold_blocked"
    : payloadOrSourceRootDrift
      ? "payload_drift_blocked"
      : duplicateReinstatementAttempt
        ? "duplicate_reinstatement_blocked"
        : !releaseRequested
          ? "release_not_required"
          : deniedByOperator
            ? "release_decision_missing"
            : !decisionReady || !operatorReceiptReady
              ? "release_decision_missing"
              : !seniorCountersignatureReady
                ? "operator_countersignature_missing"
                : !financeComplianceSupportReady
                  ? "finance_compliance_close_missing"
                  : coolingWindowActive
                    ? "cooling_window_active"
                    : !customerNoticeReady
                      ? "customer_notice_missing"
                      : !reissuedExportLinkReady || !channelReinstatementReady || !dedupReady
                        ? "channel_reinstatement_missing"
                        : "reinstatement_ready";

  const reinstatementReadinessScore = clamp(
    previousGate.holdReadinessScore +
      (previousHoldClear ? 10 : -40) +
      (releaseRequested ? -4 : 6) +
      (decisionReady ? 10 : releaseRequested ? -14 : 0) +
      (operatorReceiptReady ? 12 : releaseRequested ? -18 : 0) +
      (seniorCountersignatureReady ? 10 : releaseRequested ? -16 : 0) +
      (financeCloseReady ? 8 : releaseRequested ? -10 : 0) +
      (complianceCloseReady ? 8 : releaseRequested ? -10 : 0) +
      (supportResolutionReady ? 8 : releaseRequested ? -10 : 0) +
      (customerNoticeReady ? 8 : releaseRequested ? -10 : 0) +
      (reissuedExportLinkReady ? 8 : releaseRequested ? -10 : 0) +
      (channelReinstatementReady ? 8 : releaseRequested ? -10 : 0) +
      (dedupReady ? 6 : releaseRequested ? -8 : 0) -
      (coolingWindowActive ? 18 : 0) -
      (duplicateReinstatementAttempt ? 28 : 0) -
      (payloadOrSourceRootDrift ? 34 : 0) -
      (deniedByOperator ? 40 : 0),
  );

  const reason = !previousHoldClear
    ? "PASS2842 hold state is not clear; operator release cannot reinstate customer export while dispute/chargeback/withdrawal/policy/compliance state is still blocked."
    : payloadOrSourceRootDrift
      ? "Payload/source-root drift blocks reinstatement; regenerate, reseal and replay acknowledgement/hold release before issuing a new export link."
      : duplicateReinstatementAttempt
        ? "Duplicate reinstatement attempt detected; dedup key must be unique and append-only before resuming customer-visible delivery."
        : !releaseRequested
          ? "No operator reinstatement is required because PASS2842 reports no active hold and delivery remains clear."
          : deniedByOperator
            ? "Operator denied reinstatement; customer-visible export remains frozen."
            : !decisionReady || !operatorReceiptReady
              ? "Operator-release decision receipt is missing; do not re-enable customer export."
              : !seniorCountersignatureReady
                ? "Senior operator countersignature is missing; do not re-enable frozen paid evidence."
                : !financeComplianceSupportReady
                  ? "Finance close, compliance close and support-resolution receipts must all clear before reinstatement."
                  : coolingWindowActive
                    ? "Cooling window is still active; wait before reissuing customer export link."
                    : !customerNoticeReady
                      ? "Customer reinstatement notice is missing; customer-safe notice is required before renewed delivery."
                      : !reissuedExportLinkReady || !channelReinstatementReady || !dedupReady
                        ? "Reissued export link, channel reinstatement receipt and dedup key are required; old frozen links cannot silently reactivate."
                        : "Operator release, senior countersignature, finance/compliance/support close, customer notice and reissued link are all bound; reinstated delivery can proceed for this payload/channel.";

  return {
    schemaVersion: "pass2843_customer_export_operator_release_reinstatement_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    reinstatementState,
    reinstatementReadinessScore,
    reinstatementEnvelope: {
      releaseRequested,
      releaseDecision,
      operatorReleaseReceiptId: redact(args.operatorReleaseReceiptId),
      seniorOperatorCountersignatureId: redact(args.seniorOperatorCountersignatureId),
      financeCloseReceiptId: redact(args.financeCloseReceiptId),
      complianceCloseReceiptId: redact(args.complianceCloseReceiptId),
      supportResolutionReceiptId: redact(args.supportResolutionReceiptId),
      customerReinstatementNoticeReceiptId: redact(args.customerReinstatementNoticeReceiptId),
      reissuedExportLinkId: redact(args.reissuedExportLinkId),
      channelReinstatementReceiptId: redact(args.channelReinstatementReceiptId),
      reinstatementDedupKey: redact(args.reinstatementDedupKey),
      coolingWindowEndsAt: args.coolingWindowEndsAt ?? null,
      payloadHashBound: redact(args.payloadHashBound),
      sourceReceiptRootBound: redact(args.sourceReceiptRootBound),
      previousHoldReleaseReceiptId: redact(args.previousHoldReleaseReceiptId ?? previousGate.holdEnvelope.holdReleaseReceiptId),
      previousOperatorReviewReceiptId: redact(args.previousOperatorReviewReceiptId ?? previousGate.holdEnvelope.operatorReviewReceiptId),
    },
    reinstatementPolicy: {
      canServeCustomerVisibleExport: releaseClear,
      canSendFinalEmailNotice: releaseClear && previousGate.holdPolicy.canSendFinalEmailNotice,
      canExposeFinalApiHandoff: releaseClear && previousGate.holdPolicy.canExposeFinalApiHandoff,
      canAttachFinalSupportPacket: releaseClear && previousGate.holdPolicy.canAttachFinalSupportPacket,
      canClaimReinstatedDelivery: releaseClear && releaseRequested,
      canClaimWorldClass100: false,
      reason,
    },
    reinstatementRiskSignals: {
      previousHoldBlocked: !previousHoldClear,
      releaseRequestedButMissingDecision: releaseRequested && (!decisionReady || !operatorReceiptReady),
      deniedByOperator,
      missingOperatorReleaseReceipt: releaseRequested && !operatorReceiptReady,
      missingSeniorCountersignature: releaseRequested && !seniorCountersignatureReady,
      missingFinanceOrComplianceClose: releaseRequested && !financeComplianceSupportReady,
      coolingWindowActive,
      missingCustomerNotice: releaseRequested && !customerNoticeReady,
      missingReissuedExportLink: releaseRequested && !reissuedExportLinkReady,
      missingChannelReinstatementReceipt: releaseRequested && (!channelReinstatementReady || !dedupReady),
      duplicateReinstatementAttempt,
      payloadOrSourceRootDrift,
    },
    customerSafeCopy:
      "Customer export can be reinstated only after the hold is cleared, reviewed and reissued with a new channel-bound receipt. This is an evidence-delivery control, not financial advice, a legal judgement or a market guarantee.",
    operatorNextActions: [
      previousHoldClear ? "PASS2842 hold state is clear." : "Resolve PASS2842 hold blockers before operator release.",
      releaseRequested ? "Operator reinstatement path is requested." : "No reinstatement path is required for this clean no-hold state.",
      operatorReceiptReady ? "Operator-release receipt is present." : "Append operator-release decision receipt before reinstatement.",
      seniorCountersignatureReady ? "Senior countersignature is present." : "Add senior operator countersignature for frozen paid evidence reinstatement.",
      financeComplianceSupportReady ? "Finance, compliance and support close receipts are present." : "Attach finance close, compliance close and support-resolution receipts.",
      customerNoticeReady ? "Customer reinstatement notice receipt is present." : "Send and store customer-safe reinstatement notice receipt.",
      reissuedExportLinkReady && channelReinstatementReady && dedupReady ? "Reissued export link, channel receipt and dedup key are present." : "Reissue export link through the requested channel with a fresh reinstatement receipt and dedup key.",
      !payloadOrSourceRootDrift ? "Payload/source-root binding is stable." : "Replay/reseal before reinstatement because payload/source-root drifted.",
    ],
  };
}
