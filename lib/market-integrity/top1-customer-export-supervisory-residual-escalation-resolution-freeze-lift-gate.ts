import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2865CustomerExportSupervisoryResidualRemediationEscalationMissedSlaGate } from "@/lib/market-integrity/top1-customer-export-supervisory-residual-remediation-escalation-missed-sla-gate";

export type Pass2866CustomerExportSupervisoryResidualEscalationResolutionFreezeLiftState =
  | "missed_sla_escalation_not_ready"
  | "escalation_resolution_case_missing"
  | "supervisor_resolution_decision_missing"
  | "remediation_catchup_proof_missing"
  | "fresh_residual_rescan_missing"
  | "corrected_no_residual_attestation_missing"
  | "freeze_lift_decision_missing"
  | "freeze_lift_receipt_missing"
  | "notice_resolution_receipts_missing"
  | "override_countersign_missing"
  | "resolution_timeline_hash_missing"
  | "supervisory_residual_escalation_resolution_freeze_lift_ready";

export type Pass2866CustomerExportSupervisoryResolutionNoticeTarget =
  | "customer"
  | "regulator"
  | "auditor"
  | "internal_privacy_supervisor";

export type Pass2866CustomerExportSupervisoryResolutionNoticeReceipt = {
  target: Pass2866CustomerExportSupervisoryResolutionNoticeTarget;
  decision: "not_required" | "notify" | "suppress_with_reason";
  noticeReceiptId: string | null;
  suppressionReason: string | null;
  decidedAt: string | null;
};

export type Pass2866CustomerExportSupervisoryResidualEscalationResolutionFreezeLiftGate = {
  schemaVersion: "pass2866_customer_export_supervisory_residual_escalation_resolution_freeze_lift_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryResidualEscalationResolutionFreezeLiftState: Pass2866CustomerExportSupervisoryResidualEscalationResolutionFreezeLiftState;
  supervisoryResidualEscalationResolutionFreezeLiftReadinessScore: number;
  supervisoryResidualEscalationResolutionFreezeLiftEnvelope: {
    previousMissedSlaEscalationState: string;
    previousMissedSlaEscalationReadinessScore: number;
    previousCanCloseMissedSlaEscalation: boolean;
    previousCanLiftResidualFreezeAfterMissedSla: boolean;
    previousFreezeExtendedUntil: string | null;
    previousSupervisorEscalationReceiptId: string | null;
    escalationResolutionCaseId: string | null;
    supervisorResolutionDecisionReceiptId: string | null;
    supervisorResolutionDecision: "continue_freeze" | "lift_freeze" | "partial_lift" | "reject_lift" | null;
    remediationCatchupProofReceiptId: string | null;
    freshResidualRescanRunId: string | null;
    freshResidualRescanManifestHash: string | null;
    residualStillDetected: boolean;
    correctedNoResidualAttestationReceiptId: string | null;
    freezeLiftDecisionReceiptId: string | null;
    freezeLiftReceiptId: string | null;
    freezeLiftEffectiveAt: string | null;
    resolutionNoticeReceipts: Pass2866CustomerExportSupervisoryResolutionNoticeReceipt[];
    overrideUsed: boolean;
    overrideCounterSignReceiptId: string | null;
    overrideReasonHash: string | null;
    resolutionTimelineHash: string | null;
  };
  supervisoryResidualEscalationResolutionFreezeLiftPolicy: {
    canCloseEscalationResolution: boolean;
    canLiftResidualFreeze: boolean;
    canResumeSupervisoryPrivacyClose: boolean;
    canClaimProductionEscalationResolution: false;
    reason: string;
  };
  supervisoryResidualEscalationResolutionFreezeLiftRiskSignals: {
    previousEscalationNotReady: boolean;
    resolutionCaseMissing: boolean;
    supervisorResolutionDecisionMissing: boolean;
    remediationCatchupMissing: boolean;
    freshRescanMissing: boolean;
    correctedNoResidualAttestationMissing: boolean;
    freezeLiftDecisionMissing: boolean;
    freezeLiftReceiptMissing: boolean;
    noticeResolutionReceiptsMissing: boolean;
    overrideCounterSignMissing: boolean;
    residualStillDetected: boolean;
    resolutionTimelineMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2866_CUSTOMER_EXPORT_SUPERVISORY_RESIDUAL_ESCALATION_RESOLUTION_FREEZE_LIFT_ACCEPTANCE_GATES = [
  "PASS2866: Missed-SLA escalation is not the same as escalation resolution or freeze lift.",
  "PASS2866: Residual privacy/export freeze cannot be lifted after missed-SLA escalation without a resolution case, supervisor decision, remediation catch-up proof, fresh re-scan and corrected no-residual attestation.",
  "PASS2866: Freeze-lift decisions require a separate freeze-lift decision receipt and freeze-lift receipt; old freeze-extension receipts cannot be reused as release proof.",
  "PASS2866: Customer/regulator/auditor/internal resolution notice decisions must be explicit and receipted or suppressed with a reason.",
  "PASS2866: Override after missed-SLA requires counter-signature and reason hash; production claims still require durable workflow, alerting, operator UI and live notice-channel evidence.",
] as const;

const REQUIRED_NOTICE_TARGETS: Pass2866CustomerExportSupervisoryResolutionNoticeTarget[] = [
  "customer",
  "regulator",
  "auditor",
  "internal_privacy_supervisor",
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeResolutionNoticeReceipts(
  receipts?: Pass2866CustomerExportSupervisoryResolutionNoticeReceipt[] | null,
) {
  return REQUIRED_NOTICE_TARGETS.map((target) => {
    const found = receipts?.find((receipt) => receipt.target === target);
    return {
      target,
      decision: found?.decision ?? "not_required",
      noticeReceiptId: found?.noticeReceiptId ?? null,
      suppressionReason: found?.suppressionReason ?? null,
      decidedAt: found?.decidedAt ?? null,
    } satisfies Pass2866CustomerExportSupervisoryResolutionNoticeReceipt;
  });
}

export function buildPass2866CustomerExportSupervisoryResidualEscalationResolutionFreezeLiftGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryResidualRemediationEscalationMissedSlaGate: Pass2865CustomerExportSupervisoryResidualRemediationEscalationMissedSlaGate;
  generatedAt?: string;
  escalationResolutionCaseId?: string | null;
  supervisorResolutionDecisionReceiptId?: string | null;
  supervisorResolutionDecision?: "continue_freeze" | "lift_freeze" | "partial_lift" | "reject_lift" | null;
  remediationCatchupProofReceiptId?: string | null;
  freshResidualRescanRunId?: string | null;
  freshResidualRescanManifestHash?: string | null;
  residualStillDetected?: boolean;
  correctedNoResidualAttestationReceiptId?: string | null;
  freezeLiftDecisionReceiptId?: string | null;
  freezeLiftReceiptId?: string | null;
  freezeLiftEffectiveAt?: string | null;
  resolutionNoticeReceipts?: Pass2866CustomerExportSupervisoryResolutionNoticeReceipt[] | null;
  overrideUsed?: boolean;
  overrideCounterSignReceiptId?: string | null;
  overrideReasonHash?: string | null;
  resolutionTimelineHash?: string | null;
}): Pass2866CustomerExportSupervisoryResidualEscalationResolutionFreezeLiftGate {
  const previousGate = args.customerExportSupervisoryResidualRemediationEscalationMissedSlaGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousCanClose = Boolean(previousGate.supervisoryResidualRemediationEscalationMissedSlaPolicy.canCloseMissedSlaEscalation);
  const previousCanLift = Boolean(previousGate.supervisoryResidualRemediationEscalationMissedSlaPolicy.canLiftResidualFreezeAfterMissedSla);
  const residualStillDetected = Boolean(args.residualStillDetected);
  const resolutionNoticeReceipts = normalizeResolutionNoticeReceipts(args.resolutionNoticeReceipts);
  const noticeReceiptsReady = resolutionNoticeReceipts.every((receipt) => {
    if (receipt.decision === "notify") return Boolean(receipt.noticeReceiptId && receipt.decidedAt);
    if (receipt.decision === "suppress_with_reason") return Boolean(receipt.suppressionReason && receipt.decidedAt);
    return Boolean(receipt.decidedAt || receipt.decision === "not_required");
  });
  const overrideUsed = Boolean(args.overrideUsed);
  const overrideReady = !overrideUsed || Boolean(args.overrideCounterSignReceiptId && args.overrideReasonHash);
  const supervisorDecisionAllowsLift = args.supervisorResolutionDecision === "lift_freeze" || args.supervisorResolutionDecision === "partial_lift";

  const ready = Boolean(
    previousCanClose &&
      args.escalationResolutionCaseId &&
      args.supervisorResolutionDecisionReceiptId &&
      args.supervisorResolutionDecision &&
      args.remediationCatchupProofReceiptId &&
      args.freshResidualRescanRunId &&
      args.freshResidualRescanManifestHash &&
      !residualStillDetected &&
      args.correctedNoResidualAttestationReceiptId &&
      args.freezeLiftDecisionReceiptId &&
      args.freezeLiftReceiptId &&
      args.freezeLiftEffectiveAt &&
      noticeReceiptsReady &&
      overrideReady &&
      args.resolutionTimelineHash,
  );

  const state: Pass2866CustomerExportSupervisoryResidualEscalationResolutionFreezeLiftState = !previousCanClose
    ? "missed_sla_escalation_not_ready"
    : !args.escalationResolutionCaseId
      ? "escalation_resolution_case_missing"
      : !(args.supervisorResolutionDecisionReceiptId && args.supervisorResolutionDecision)
        ? "supervisor_resolution_decision_missing"
        : !args.remediationCatchupProofReceiptId
          ? "remediation_catchup_proof_missing"
          : !(args.freshResidualRescanRunId && args.freshResidualRescanManifestHash)
            ? "fresh_residual_rescan_missing"
            : residualStillDetected || !args.correctedNoResidualAttestationReceiptId
              ? "corrected_no_residual_attestation_missing"
              : !args.freezeLiftDecisionReceiptId
                ? "freeze_lift_decision_missing"
                : !(args.freezeLiftReceiptId && args.freezeLiftEffectiveAt)
                  ? "freeze_lift_receipt_missing"
                  : !noticeReceiptsReady
                    ? "notice_resolution_receipts_missing"
                    : overrideUsed && !(args.overrideCounterSignReceiptId && args.overrideReasonHash)
                      ? "override_countersign_missing"
                      : !args.resolutionTimelineHash
                        ? "resolution_timeline_hash_missing"
                        : "supervisory_residual_escalation_resolution_freeze_lift_ready";

  const readiness = clamp(
    previousGate.supervisoryResidualRemediationEscalationMissedSlaReadinessScore +
      (previousCanClose ? 8 : -45) +
      (args.escalationResolutionCaseId ? 9 : -15) +
      (args.supervisorResolutionDecisionReceiptId ? 10 : -16) +
      (supervisorDecisionAllowsLift ? 8 : -6) +
      (args.remediationCatchupProofReceiptId ? 10 : -16) +
      (args.freshResidualRescanRunId ? 8 : -14) +
      (args.freshResidualRescanManifestHash ? 8 : -14) +
      (residualStillDetected ? -30 : 10) +
      (args.correctedNoResidualAttestationReceiptId ? 12 : -18) +
      (args.freezeLiftDecisionReceiptId ? 10 : -16) +
      (args.freezeLiftReceiptId ? 10 : -16) +
      (noticeReceiptsReady ? 8 : -14) +
      (overrideReady ? 6 : -16) +
      (args.resolutionTimelineHash ? 10 : -18),
  );

  const canLiftResidualFreeze = Boolean(ready && supervisorDecisionAllowsLift && !residualStillDetected);

  const riskSignals = {
    previousEscalationNotReady: !previousCanClose,
    resolutionCaseMissing: !args.escalationResolutionCaseId,
    supervisorResolutionDecisionMissing: !(args.supervisorResolutionDecisionReceiptId && args.supervisorResolutionDecision),
    remediationCatchupMissing: !args.remediationCatchupProofReceiptId,
    freshRescanMissing: !(args.freshResidualRescanRunId && args.freshResidualRescanManifestHash),
    correctedNoResidualAttestationMissing: residualStillDetected || !args.correctedNoResidualAttestationReceiptId,
    freezeLiftDecisionMissing: !args.freezeLiftDecisionReceiptId,
    freezeLiftReceiptMissing: !(args.freezeLiftReceiptId && args.freezeLiftEffectiveAt),
    noticeResolutionReceiptsMissing: !noticeReceiptsReady,
    overrideCounterSignMissing: overrideUsed && !(args.overrideCounterSignReceiptId && args.overrideReasonHash),
    residualStillDetected,
    resolutionTimelineMissing: !args.resolutionTimelineHash,
  };

  const operatorNextActions = [
    riskSignals.previousEscalationNotReady ? "Close PASS2865 missed-SLA escalation before resolving freeze lift." : null,
    riskSignals.resolutionCaseMissing ? "Open escalation resolution case bound to the missed-SLA escalation receipt." : null,
    riskSignals.supervisorResolutionDecisionMissing ? "Attach supervisor resolution decision and decision receipt." : null,
    riskSignals.remediationCatchupMissing ? "Attach remediation catch-up proof after the missed SLA." : null,
    riskSignals.freshRescanMissing ? "Run a fresh residual re-scan and attach manifest hash." : null,
    riskSignals.correctedNoResidualAttestationMissing ? "Do not lift freeze until corrected no-residual attestation exists and scan shows no residual evidence." : null,
    riskSignals.freezeLiftDecisionMissing || riskSignals.freezeLiftReceiptMissing ? "Attach freeze-lift decision and freeze-lift receipt before resuming channels." : null,
    riskSignals.noticeResolutionReceiptsMissing ? "Complete customer/regulator/auditor/internal resolution notices or suppression reasons." : null,
    riskSignals.overrideCounterSignMissing ? "Attach override counter-signature and reason hash." : null,
    riskSignals.resolutionTimelineMissing ? "Seal escalation resolution timeline hash." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2866_customer_export_supervisory_residual_escalation_resolution_freeze_lift_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryResidualEscalationResolutionFreezeLiftState: state,
    supervisoryResidualEscalationResolutionFreezeLiftReadinessScore: readiness,
    supervisoryResidualEscalationResolutionFreezeLiftEnvelope: {
      previousMissedSlaEscalationState: previousGate.supervisoryResidualRemediationEscalationMissedSlaState,
      previousMissedSlaEscalationReadinessScore: previousGate.supervisoryResidualRemediationEscalationMissedSlaReadinessScore,
      previousCanCloseMissedSlaEscalation: previousCanClose,
      previousCanLiftResidualFreezeAfterMissedSla: previousCanLift,
      previousFreezeExtendedUntil: previousGate.supervisoryResidualRemediationEscalationMissedSlaEnvelope.freezeExtendedUntil,
      previousSupervisorEscalationReceiptId: previousGate.supervisoryResidualRemediationEscalationMissedSlaEnvelope.supervisorEscalationReceiptId,
      escalationResolutionCaseId: args.escalationResolutionCaseId ?? null,
      supervisorResolutionDecisionReceiptId: args.supervisorResolutionDecisionReceiptId ?? null,
      supervisorResolutionDecision: args.supervisorResolutionDecision ?? null,
      remediationCatchupProofReceiptId: args.remediationCatchupProofReceiptId ?? null,
      freshResidualRescanRunId: args.freshResidualRescanRunId ?? null,
      freshResidualRescanManifestHash: args.freshResidualRescanManifestHash ?? null,
      residualStillDetected,
      correctedNoResidualAttestationReceiptId: args.correctedNoResidualAttestationReceiptId ?? null,
      freezeLiftDecisionReceiptId: args.freezeLiftDecisionReceiptId ?? null,
      freezeLiftReceiptId: args.freezeLiftReceiptId ?? null,
      freezeLiftEffectiveAt: args.freezeLiftEffectiveAt ?? null,
      resolutionNoticeReceipts,
      overrideUsed,
      overrideCounterSignReceiptId: args.overrideCounterSignReceiptId ?? null,
      overrideReasonHash: args.overrideReasonHash ?? null,
      resolutionTimelineHash: args.resolutionTimelineHash ?? null,
    },
    supervisoryResidualEscalationResolutionFreezeLiftPolicy: {
      canCloseEscalationResolution: ready,
      canLiftResidualFreeze,
      canResumeSupervisoryPrivacyClose: canLiftResidualFreeze,
      canClaimProductionEscalationResolution: false,
      reason: ready
        ? "PASS2866 escalation resolution is contract-ready: missed-SLA escalation is resolved with supervisor decision, catch-up proof, fresh no-residual scan, freeze-lift receipts, notices and timeline hash. Production still needs durable workflow and live channel proof."
        : "PASS2866 escalation resolution is not ready; residual privacy/export freeze remains active until all resolution, re-scan, notice and freeze-lift receipts are attached.",
    },
    supervisoryResidualEscalationResolutionFreezeLiftRiskSignals: riskSignals,
    customerSafeCopy: canLiftResidualFreeze
      ? "The missed-SLA escalation can be resolved in this contract state only after supervisor decision, fresh no-residual evidence and channel-bound notice receipts. This is not a live production delivery claim."
      : "The missed-SLA escalation remains frozen. Velmère will not claim the residual privacy/export freeze is lifted until resolution, re-scan, no-residual attestation and notice receipts are complete.",
    operatorNextActions,
  };
}
