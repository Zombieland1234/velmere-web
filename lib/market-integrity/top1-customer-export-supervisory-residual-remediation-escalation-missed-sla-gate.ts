import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2864CustomerExportSupervisoryResidualFindingRemediationRescanCloseGate } from "@/lib/market-integrity/top1-customer-export-supervisory-residual-finding-remediation-rescan-close-gate";

export type Pass2865CustomerExportSupervisoryResidualRemediationEscalationMissedSlaState =
  | "supervisory_residual_remediation_close_not_ready"
  | "missed_sla_monitor_receipt_missing"
  | "remediation_sla_not_breached"
  | "missed_sla_detection_receipt_missing"
  | "supervisor_escalation_receipt_missing"
  | "unresolved_residual_freeze_extension_missing"
  | "customer_regulator_auditor_notice_escalation_decision_missing"
  | "customer_regulator_auditor_notice_escalation_receipt_missing"
  | "operator_override_review_missing"
  | "operator_override_controls_incomplete"
  | "escalation_timeline_hash_missing"
  | "supervisory_residual_remediation_escalation_missed_sla_ready";

export type Pass2865CustomerExportSupervisoryResidualEscalationNoticeTarget =
  | "customer"
  | "regulator"
  | "auditor"
  | "internal_privacy_supervisor";

export type Pass2865CustomerExportSupervisoryResidualEscalationNoticeReceipt = {
  target: Pass2865CustomerExportSupervisoryResidualEscalationNoticeTarget;
  decision: "not_required" | "notify" | "suppress_with_reason";
  noticeReceiptId: string | null;
  suppressionReason: string | null;
  decidedAt: string | null;
};

export type Pass2865CustomerExportSupervisoryResidualRemediationEscalationMissedSlaGate = {
  schemaVersion: "pass2865_customer_export_supervisory_residual_remediation_escalation_missed_sla_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryResidualRemediationEscalationMissedSlaState: Pass2865CustomerExportSupervisoryResidualRemediationEscalationMissedSlaState;
  supervisoryResidualRemediationEscalationMissedSlaReadinessScore: number;
  supervisoryResidualRemediationEscalationMissedSlaEnvelope: {
    previousSupervisoryResidualFindingRemediationRescanCloseState: string;
    previousSupervisoryResidualFindingRemediationRescanCloseReadinessScore: number;
    previousCanCloseResidualFindingRemediation: boolean;
    previousCanLiftSupervisoryPrivacyFreeze: boolean;
    previousResidualFindingTicketId: string | null;
    previousRemediationOwnerId: string | null;
    previousRemediationSlaPolicyId: string | null;
    previousRemediationDueAt: string | null;
    previousRemediationCloseSignoffReceiptId: string | null;
    missedSlaMonitorReceiptId: string | null;
    remediationSlaBreached: boolean;
    remediationCurrentAgeHours: number;
    missedSlaDetectionReceiptId: string | null;
    supervisorEscalationReceiptId: string | null;
    escalationSupervisorPseudonym: string | null;
    unresolvedResidualFreezeExtensionReceiptId: string | null;
    freezeExtendedUntil: string | null;
    customerRegulatorAuditorNoticeEscalationDecisionReceiptId: string | null;
    noticeEscalationReceipts: Pass2865CustomerExportSupervisoryResidualEscalationNoticeReceipt[];
    operatorOverrideRequested: boolean;
    operatorOverrideReviewReceiptId: string | null;
    operatorOverrideApproved: boolean;
    operatorOverrideControlsReceiptId: string | null;
    operatorOverrideReasonHash: string | null;
    escalationTimelineHash: string | null;
  };
  supervisoryResidualRemediationEscalationMissedSlaPolicy: {
    canCloseMissedSlaEscalation: boolean;
    canLiftResidualFreezeAfterMissedSla: boolean;
    canUseOperatorOverride: boolean;
    canClaimProductionMissedSlaEscalation: false;
    reason: string;
  };
  supervisoryResidualRemediationEscalationMissedSlaRiskSignals: {
    previousRemediationCloseNotReady: boolean;
    missingMissedSlaMonitorReceipt: boolean;
    remediationSlaNotBreached: boolean;
    missedSlaDetectionMissing: boolean;
    supervisorEscalationMissing: boolean;
    freezeExtensionMissing: boolean;
    noticeEscalationDecisionMissing: boolean;
    noticeEscalationReceiptMissing: boolean;
    operatorOverrideReviewMissing: boolean;
    operatorOverrideControlsIncomplete: boolean;
    escalationTimelineMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2865_CUSTOMER_EXPORT_SUPERVISORY_RESIDUAL_REMEDIATION_ESCALATION_MISSED_SLA_ACCEPTANCE_GATES = [
  "PASS2865: Supervisory residual remediation close is not the same as missed-SLA escalation close.",
  "PASS2865: Residual remediation SLA breach requires missed-SLA detection, supervisor escalation, unresolved residual freeze extension and escalation timeline hash before privacy freeze can be evaluated again.",
  "PASS2865: Customer, regulator and auditor notice escalation decisions must be explicit; notify decisions require their own channel receipts and suppression requires a reason.",
  "PASS2865: Operator override is never silent; it requires review receipt, controls receipt, reason hash and still cannot claim production escalation without durable workflow proof.",
  "PASS2865: This is a deterministic contract/API/schema boundary; production claims still require monitored SLA jobs, durable tickets, alerting, operator UI, legal/privacy approvals and live channel dispatch proof.",
] as const;

const REQUIRED_NOTICE_TARGETS: Pass2865CustomerExportSupervisoryResidualEscalationNoticeTarget[] = [
  "customer",
  "regulator",
  "auditor",
  "internal_privacy_supervisor",
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeNoticeEscalationReceipts(
  receipts?: Pass2865CustomerExportSupervisoryResidualEscalationNoticeReceipt[] | null,
) {
  return REQUIRED_NOTICE_TARGETS.map((target) => {
    const found = receipts?.find((receipt) => receipt.target === target);
    return {
      target,
      decision: found?.decision ?? "not_required",
      noticeReceiptId: found?.noticeReceiptId ?? null,
      suppressionReason: found?.suppressionReason ?? null,
      decidedAt: found?.decidedAt ?? null,
    } satisfies Pass2865CustomerExportSupervisoryResidualEscalationNoticeReceipt;
  });
}

export function buildPass2865CustomerExportSupervisoryResidualRemediationEscalationMissedSlaGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryResidualFindingRemediationRescanCloseGate: Pass2864CustomerExportSupervisoryResidualFindingRemediationRescanCloseGate;
  generatedAt?: string;
  missedSlaMonitorReceiptId?: string | null;
  remediationSlaBreached?: boolean;
  remediationCurrentAgeHours?: number;
  missedSlaDetectionReceiptId?: string | null;
  supervisorEscalationReceiptId?: string | null;
  escalationSupervisorPseudonym?: string | null;
  unresolvedResidualFreezeExtensionReceiptId?: string | null;
  freezeExtendedUntil?: string | null;
  customerRegulatorAuditorNoticeEscalationDecisionReceiptId?: string | null;
  noticeEscalationReceipts?: Pass2865CustomerExportSupervisoryResidualEscalationNoticeReceipt[] | null;
  operatorOverrideRequested?: boolean;
  operatorOverrideReviewReceiptId?: string | null;
  operatorOverrideApproved?: boolean;
  operatorOverrideControlsReceiptId?: string | null;
  operatorOverrideReasonHash?: string | null;
  escalationTimelineHash?: string | null;
}): Pass2865CustomerExportSupervisoryResidualRemediationEscalationMissedSlaGate {
  const previousGate = args.customerExportSupervisoryResidualFindingRemediationRescanCloseGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(previousGate.supervisoryResidualFindingRemediationRescanClosePolicy.canCloseResidualFindingRemediation);
  const previousFreezeLiftable = Boolean(previousGate.supervisoryResidualFindingRemediationRescanClosePolicy.canLiftSupervisoryPrivacyFreeze);
  const remediationSlaBreached = Boolean(args.remediationSlaBreached);
  const currentAge = Math.max(0, Number(args.remediationCurrentAgeHours ?? 0));
  const noticeEscalationReceipts = normalizeNoticeEscalationReceipts(args.noticeEscalationReceipts);
  const noticeDecisionReady = Boolean(args.customerRegulatorAuditorNoticeEscalationDecisionReceiptId);
  const noticeReceiptsReady = noticeEscalationReceipts.every((receipt) => {
    if (receipt.decision === "notify") return Boolean(receipt.noticeReceiptId && receipt.decidedAt);
    if (receipt.decision === "suppress_with_reason") return Boolean(receipt.suppressionReason && receipt.decidedAt);
    return Boolean(receipt.decidedAt || receipt.decision === "not_required");
  });
  const overrideRequested = Boolean(args.operatorOverrideRequested);
  const overrideReady = !overrideRequested || Boolean(
    args.operatorOverrideReviewReceiptId &&
      args.operatorOverrideControlsReceiptId &&
      args.operatorOverrideReasonHash,
  );

  const ready = Boolean(
    previousReady &&
      args.missedSlaMonitorReceiptId &&
      remediationSlaBreached &&
      args.missedSlaDetectionReceiptId &&
      args.supervisorEscalationReceiptId &&
      args.escalationSupervisorPseudonym &&
      args.unresolvedResidualFreezeExtensionReceiptId &&
      args.freezeExtendedUntil &&
      noticeDecisionReady &&
      noticeReceiptsReady &&
      overrideReady &&
      args.escalationTimelineHash,
  );

  const state: Pass2865CustomerExportSupervisoryResidualRemediationEscalationMissedSlaState = !previousReady
    ? "supervisory_residual_remediation_close_not_ready"
    : !args.missedSlaMonitorReceiptId
      ? "missed_sla_monitor_receipt_missing"
      : !remediationSlaBreached
        ? "remediation_sla_not_breached"
        : !args.missedSlaDetectionReceiptId
          ? "missed_sla_detection_receipt_missing"
          : !(args.supervisorEscalationReceiptId && args.escalationSupervisorPseudonym)
            ? "supervisor_escalation_receipt_missing"
            : !(args.unresolvedResidualFreezeExtensionReceiptId && args.freezeExtendedUntil)
              ? "unresolved_residual_freeze_extension_missing"
              : !noticeDecisionReady
                ? "customer_regulator_auditor_notice_escalation_decision_missing"
                : !noticeReceiptsReady
                  ? "customer_regulator_auditor_notice_escalation_receipt_missing"
                  : overrideRequested && !args.operatorOverrideReviewReceiptId
                    ? "operator_override_review_missing"
                    : overrideRequested && !(args.operatorOverrideControlsReceiptId && args.operatorOverrideReasonHash)
                      ? "operator_override_controls_incomplete"
                      : !args.escalationTimelineHash
                        ? "escalation_timeline_hash_missing"
                        : "supervisory_residual_remediation_escalation_missed_sla_ready";

  const readiness = clamp(
    previousGate.supervisoryResidualFindingRemediationRescanCloseReadinessScore +
      (previousReady ? 8 : -45) +
      (args.missedSlaMonitorReceiptId ? 10 : -15) +
      (remediationSlaBreached ? 8 : -8) +
      (args.missedSlaDetectionReceiptId ? 10 : -15) +
      (args.supervisorEscalationReceiptId ? 12 : -18) +
      (args.escalationSupervisorPseudonym ? 5 : -8) +
      (args.unresolvedResidualFreezeExtensionReceiptId ? 12 : -18) +
      (args.freezeExtendedUntil ? 5 : -8) +
      (noticeDecisionReady ? 8 : -14) +
      (noticeReceiptsReady ? 10 : -16) +
      (overrideReady ? 6 : -20) +
      (args.escalationTimelineHash ? 10 : -14),
  );

  const reason = ready
    ? "Supervisory residual missed-SLA escalation is ready: breach detection, supervisor escalation, freeze extension, notice decisions, override controls and timeline hash are bound."
    : `Supervisory residual missed-SLA escalation is blocked at ${state}.`;

  const operatorNextActions = [
    !previousReady ? "Complete PASS2864 residual finding remediation/re-scan close before missed-SLA escalation can be evaluated." : null,
    !args.missedSlaMonitorReceiptId ? "Attach missed-SLA monitor receipt for residual remediation queue." : null,
    !remediationSlaBreached ? "Record SLA breach only when residual remediation is actually overdue; otherwise keep monitoring." : null,
    remediationSlaBreached && !args.missedSlaDetectionReceiptId ? "Attach missed-SLA detection receipt." : null,
    remediationSlaBreached && !(args.supervisorEscalationReceiptId && args.escalationSupervisorPseudonym) ? "Escalate to a privacy supervisor and record escalation receipt." : null,
    remediationSlaBreached && !(args.unresolvedResidualFreezeExtensionReceiptId && args.freezeExtendedUntil) ? "Extend unresolved-residual export freeze window with receipt and expiry." : null,
    remediationSlaBreached && !noticeDecisionReady ? "Record customer/regulator/auditor notice escalation decision receipt." : null,
    remediationSlaBreached && !noticeReceiptsReady ? "Collect notice receipts or suppression reasons for all escalation targets." : null,
    overrideRequested && !args.operatorOverrideReviewReceiptId ? "Attach operator override review receipt before override can be considered." : null,
    overrideRequested && !(args.operatorOverrideControlsReceiptId && args.operatorOverrideReasonHash) ? "Bind override controls receipt and reason hash." : null,
    remediationSlaBreached && !args.escalationTimelineHash ? "Hash missed-SLA escalation timeline." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2865_customer_export_supervisory_residual_remediation_escalation_missed_sla_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryResidualRemediationEscalationMissedSlaState: state,
    supervisoryResidualRemediationEscalationMissedSlaReadinessScore: readiness,
    supervisoryResidualRemediationEscalationMissedSlaEnvelope: {
      previousSupervisoryResidualFindingRemediationRescanCloseState: previousGate.supervisoryResidualFindingRemediationRescanCloseState,
      previousSupervisoryResidualFindingRemediationRescanCloseReadinessScore: previousGate.supervisoryResidualFindingRemediationRescanCloseReadinessScore,
      previousCanCloseResidualFindingRemediation: previousReady,
      previousCanLiftSupervisoryPrivacyFreeze: previousFreezeLiftable,
      previousResidualFindingTicketId: previousGate.supervisoryResidualFindingRemediationRescanCloseEnvelope.residualFindingTicketId,
      previousRemediationOwnerId: previousGate.supervisoryResidualFindingRemediationRescanCloseEnvelope.remediationOwnerId,
      previousRemediationSlaPolicyId: previousGate.supervisoryResidualFindingRemediationRescanCloseEnvelope.remediationSlaPolicyId,
      previousRemediationDueAt: previousGate.supervisoryResidualFindingRemediationRescanCloseEnvelope.remediationDueAt,
      previousRemediationCloseSignoffReceiptId: previousGate.supervisoryResidualFindingRemediationRescanCloseEnvelope.remediationCloseSignoffReceiptId,
      missedSlaMonitorReceiptId: args.missedSlaMonitorReceiptId ?? null,
      remediationSlaBreached,
      remediationCurrentAgeHours: currentAge,
      missedSlaDetectionReceiptId: args.missedSlaDetectionReceiptId ?? null,
      supervisorEscalationReceiptId: args.supervisorEscalationReceiptId ?? null,
      escalationSupervisorPseudonym: args.escalationSupervisorPseudonym ?? null,
      unresolvedResidualFreezeExtensionReceiptId: args.unresolvedResidualFreezeExtensionReceiptId ?? null,
      freezeExtendedUntil: args.freezeExtendedUntil ?? null,
      customerRegulatorAuditorNoticeEscalationDecisionReceiptId: args.customerRegulatorAuditorNoticeEscalationDecisionReceiptId ?? null,
      noticeEscalationReceipts,
      operatorOverrideRequested: overrideRequested,
      operatorOverrideReviewReceiptId: args.operatorOverrideReviewReceiptId ?? null,
      operatorOverrideApproved: Boolean(args.operatorOverrideApproved && overrideReady),
      operatorOverrideControlsReceiptId: args.operatorOverrideControlsReceiptId ?? null,
      operatorOverrideReasonHash: args.operatorOverrideReasonHash ?? null,
      escalationTimelineHash: args.escalationTimelineHash ?? null,
    },
    supervisoryResidualRemediationEscalationMissedSlaPolicy: {
      canCloseMissedSlaEscalation: ready,
      canLiftResidualFreezeAfterMissedSla: ready && !overrideRequested,
      canUseOperatorOverride: overrideReady && overrideRequested,
      canClaimProductionMissedSlaEscalation: false,
      reason,
    },
    supervisoryResidualRemediationEscalationMissedSlaRiskSignals: {
      previousRemediationCloseNotReady: !previousReady,
      missingMissedSlaMonitorReceipt: !args.missedSlaMonitorReceiptId,
      remediationSlaNotBreached: !remediationSlaBreached,
      missedSlaDetectionMissing: remediationSlaBreached && !args.missedSlaDetectionReceiptId,
      supervisorEscalationMissing: remediationSlaBreached && !(args.supervisorEscalationReceiptId && args.escalationSupervisorPseudonym),
      freezeExtensionMissing: remediationSlaBreached && !(args.unresolvedResidualFreezeExtensionReceiptId && args.freezeExtendedUntil),
      noticeEscalationDecisionMissing: remediationSlaBreached && !noticeDecisionReady,
      noticeEscalationReceiptMissing: remediationSlaBreached && !noticeReceiptsReady,
      operatorOverrideReviewMissing: overrideRequested && !args.operatorOverrideReviewReceiptId,
      operatorOverrideControlsIncomplete: overrideRequested && !(args.operatorOverrideControlsReceiptId && args.operatorOverrideReasonHash),
      escalationTimelineMissing: remediationSlaBreached && !args.escalationTimelineHash,
    },
    customerSafeCopy: ready
      ? "Supervisory residual missed-SLA escalation is closed with breach detection, supervisor escalation, freeze extension, notice decisions, optional override controls and a timeline hash."
      : "Supervisory residual remediation remains frozen when SLA is missed until supervisor escalation, freeze extension, notice escalation, override controls and timeline receipts exist.",
    operatorNextActions,
  };
}
