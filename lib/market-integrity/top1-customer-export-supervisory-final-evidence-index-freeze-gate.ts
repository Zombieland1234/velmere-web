import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2866CustomerExportSupervisoryResidualEscalationResolutionFreezeLiftGate } from "@/lib/market-integrity/top1-customer-export-supervisory-residual-escalation-resolution-freeze-lift-gate";

export type Pass2867CustomerExportSupervisoryFinalEvidenceIndexFreezeState =
  | "freeze_lift_not_ready"
  | "final_evidence_index_missing"
  | "final_evidence_index_version_missing"
  | "final_evidence_index_hash_missing"
  | "freeze_receipt_missing"
  | "freeze_lift_binding_missing"
  | "mutation_monitor_missing"
  | "post_resolution_mutation_detected"
  | "operator_legal_signoff_missing"
  | "timeline_hash_missing"
  | "supervisory_final_evidence_index_freeze_ready";

export type Pass2867CustomerExportSupervisoryEvidenceIndexMutationAction =
  | "blocked_write"
  | "blocked_delete"
  | "blocked_reindex"
  | "blocked_channel_rebind"
  | "blocked_payload_replace";

export type Pass2867CustomerExportSupervisoryEvidenceIndexMutationAttempt = {
  attemptedAction: Pass2867CustomerExportSupervisoryEvidenceIndexMutationAction;
  attemptedByPseudonym: string | null;
  attemptedAt: string | null;
  mutationAttemptReceiptId: string | null;
  blocked: boolean;
  reasonHash: string | null;
};

export type Pass2867CustomerExportSupervisoryFinalEvidenceIndexFreezeGate = {
  schemaVersion: "pass2867_customer_export_supervisory_final_evidence_index_freeze_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryFinalEvidenceIndexFreezeState: Pass2867CustomerExportSupervisoryFinalEvidenceIndexFreezeState;
  supervisoryFinalEvidenceIndexFreezeReadinessScore: number;
  supervisoryFinalEvidenceIndexFreezeEnvelope: {
    previousFreezeLiftState: string;
    previousFreezeLiftReadinessScore: number;
    previousCanCloseEscalationResolution: boolean;
    previousCanLiftResidualFreeze: boolean;
    previousFreezeLiftReceiptId: string | null;
    previousFreezeLiftDecisionReceiptId: string | null;
    previousResolutionTimelineHash: string | null;
    finalEvidenceIndexId: string | null;
    finalEvidenceIndexVersion: string | null;
    finalEvidenceIndexHash: string | null;
    immutableArchiveBindingHash: string | null;
    freezeLiftReceiptBindingHash: string | null;
    resolutionTimelineBindingHash: string | null;
    finalEvidenceIndexFreezeReceiptId: string | null;
    mutationAttemptMonitorReceiptId: string | null;
    mutationAttempts: Pass2867CustomerExportSupervisoryEvidenceIndexMutationAttempt[];
    operatorAuditSignoffReceiptId: string | null;
    legalAuditSignoffReceiptId: string | null;
    evidenceIndexFrozenAt: string | null;
    finalEvidenceIndexFreezeTimelineHash: string | null;
  };
  supervisoryFinalEvidenceIndexFreezePolicy: {
    canFreezeFinalEvidenceIndex: boolean;
    canClaimPostResolutionIndexImmutable: boolean;
    canResumeSupervisoryArchiveClose: boolean;
    canClaimProductionFinalIndexFreeze: false;
    reason: string;
  };
  supervisoryFinalEvidenceIndexFreezeRiskSignals: {
    previousFreezeLiftNotReady: boolean;
    finalEvidenceIndexMissing: boolean;
    finalEvidenceIndexVersionMissing: boolean;
    finalEvidenceIndexHashMissing: boolean;
    immutableArchiveBindingMissing: boolean;
    freezeLiftBindingMissing: boolean;
    resolutionTimelineBindingMissing: boolean;
    freezeReceiptMissing: boolean;
    mutationMonitorMissing: boolean;
    postResolutionMutationDetected: boolean;
    unblockedMutationAttemptDetected: boolean;
    operatorSignoffMissing: boolean;
    legalSignoffMissing: boolean;
    timelineMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2867_CUSTOMER_EXPORT_SUPERVISORY_FINAL_EVIDENCE_INDEX_FREEZE_ACCEPTANCE_GATES = [
  "PASS2867: Escalation resolution and freeze-lift receipts are not the same as final evidence-index freeze.",
  "PASS2867: The final supervisory evidence index must have an index ID, immutable version, index hash, archive binding hash and freeze receipt before post-resolution close.",
  "PASS2867: Freeze-lift receipt and resolution timeline must be bound to the final evidence-index version; old lift receipts cannot be reused against a changed index.",
  "PASS2867: Any post-resolution mutation attempt must be detected, receipted and blocked; unblocked mutation freezes supervisory archive close.",
  "PASS2867: Operator and legal audit signoff plus timeline hash are required before claiming the resolved residual escalation evidence index is immutable.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeMutationAttempts(
  attempts?: Pass2867CustomerExportSupervisoryEvidenceIndexMutationAttempt[] | null,
) {
  return (attempts ?? []).map((attempt) => ({
    attemptedAction: attempt.attemptedAction,
    attemptedByPseudonym: attempt.attemptedByPseudonym ?? null,
    attemptedAt: attempt.attemptedAt ?? null,
    mutationAttemptReceiptId: attempt.mutationAttemptReceiptId ?? null,
    blocked: Boolean(attempt.blocked),
    reasonHash: attempt.reasonHash ?? null,
  })) satisfies Pass2867CustomerExportSupervisoryEvidenceIndexMutationAttempt[];
}

export function buildPass2867CustomerExportSupervisoryFinalEvidenceIndexFreezeGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryResidualEscalationResolutionFreezeLiftGate: Pass2866CustomerExportSupervisoryResidualEscalationResolutionFreezeLiftGate;
  generatedAt?: string;
  finalEvidenceIndexId?: string | null;
  finalEvidenceIndexVersion?: string | null;
  finalEvidenceIndexHash?: string | null;
  immutableArchiveBindingHash?: string | null;
  freezeLiftReceiptBindingHash?: string | null;
  resolutionTimelineBindingHash?: string | null;
  finalEvidenceIndexFreezeReceiptId?: string | null;
  mutationAttemptMonitorReceiptId?: string | null;
  mutationAttempts?: Pass2867CustomerExportSupervisoryEvidenceIndexMutationAttempt[] | null;
  operatorAuditSignoffReceiptId?: string | null;
  legalAuditSignoffReceiptId?: string | null;
  evidenceIndexFrozenAt?: string | null;
  finalEvidenceIndexFreezeTimelineHash?: string | null;
}): Pass2867CustomerExportSupervisoryFinalEvidenceIndexFreezeGate {
  const previousGate = args.customerExportSupervisoryResidualEscalationResolutionFreezeLiftGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousCanClose = Boolean(previousGate.supervisoryResidualEscalationResolutionFreezeLiftPolicy.canCloseEscalationResolution);
  const previousCanLift = Boolean(previousGate.supervisoryResidualEscalationResolutionFreezeLiftPolicy.canLiftResidualFreeze);
  const previousFreezeLiftReceiptId = previousGate.supervisoryResidualEscalationResolutionFreezeLiftEnvelope.freezeLiftReceiptId ?? null;
  const previousFreezeLiftDecisionReceiptId = previousGate.supervisoryResidualEscalationResolutionFreezeLiftEnvelope.freezeLiftDecisionReceiptId ?? null;
  const previousResolutionTimelineHash = previousGate.supervisoryResidualEscalationResolutionFreezeLiftEnvelope.resolutionTimelineHash ?? null;
  const mutationAttempts = normalizeMutationAttempts(args.mutationAttempts);
  const postResolutionMutationDetected = mutationAttempts.length > 0;
  const unblockedMutationAttemptDetected = mutationAttempts.some((attempt) => !attempt.blocked || !attempt.mutationAttemptReceiptId || !attempt.reasonHash);

  const ready = Boolean(
    previousCanClose &&
      previousCanLift &&
      args.finalEvidenceIndexId &&
      args.finalEvidenceIndexVersion &&
      args.finalEvidenceIndexHash &&
      args.immutableArchiveBindingHash &&
      args.freezeLiftReceiptBindingHash &&
      args.resolutionTimelineBindingHash &&
      args.finalEvidenceIndexFreezeReceiptId &&
      args.mutationAttemptMonitorReceiptId &&
      !unblockedMutationAttemptDetected &&
      args.operatorAuditSignoffReceiptId &&
      args.legalAuditSignoffReceiptId &&
      args.evidenceIndexFrozenAt &&
      args.finalEvidenceIndexFreezeTimelineHash,
  );

  const state: Pass2867CustomerExportSupervisoryFinalEvidenceIndexFreezeState = !previousCanClose || !previousCanLift
    ? "freeze_lift_not_ready"
    : !args.finalEvidenceIndexId
      ? "final_evidence_index_missing"
      : !args.finalEvidenceIndexVersion
        ? "final_evidence_index_version_missing"
        : !args.finalEvidenceIndexHash
          ? "final_evidence_index_hash_missing"
          : !args.finalEvidenceIndexFreezeReceiptId
            ? "freeze_receipt_missing"
            : !(args.freezeLiftReceiptBindingHash && args.resolutionTimelineBindingHash && args.immutableArchiveBindingHash)
              ? "freeze_lift_binding_missing"
              : !args.mutationAttemptMonitorReceiptId
                ? "mutation_monitor_missing"
                : unblockedMutationAttemptDetected
                  ? "post_resolution_mutation_detected"
                  : !(args.operatorAuditSignoffReceiptId && args.legalAuditSignoffReceiptId)
                    ? "operator_legal_signoff_missing"
                    : !(args.evidenceIndexFrozenAt && args.finalEvidenceIndexFreezeTimelineHash)
                      ? "timeline_hash_missing"
                      : "supervisory_final_evidence_index_freeze_ready";

  const readiness = clamp(
    previousGate.supervisoryResidualEscalationResolutionFreezeLiftReadinessScore +
      (previousCanClose ? 8 : -45) +
      (previousCanLift ? 8 : -35) +
      (args.finalEvidenceIndexId ? 9 : -16) +
      (args.finalEvidenceIndexVersion ? 8 : -14) +
      (args.finalEvidenceIndexHash ? 8 : -14) +
      (args.immutableArchiveBindingHash ? 8 : -14) +
      (args.freezeLiftReceiptBindingHash ? 8 : -14) +
      (args.resolutionTimelineBindingHash ? 8 : -14) +
      (args.finalEvidenceIndexFreezeReceiptId ? 10 : -18) +
      (args.mutationAttemptMonitorReceiptId ? 8 : -15) +
      (unblockedMutationAttemptDetected ? -35 : postResolutionMutationDetected ? 4 : 8) +
      (args.operatorAuditSignoffReceiptId ? 8 : -14) +
      (args.legalAuditSignoffReceiptId ? 8 : -14) +
      (args.evidenceIndexFrozenAt ? 5 : -8) +
      (args.finalEvidenceIndexFreezeTimelineHash ? 10 : -18),
  );

  const reason = ready
    ? "Final supervisory evidence index is frozen, versioned, bound to freeze-lift proof and mutation-monitored before archive close."
    : "Final supervisory evidence index is not immutable yet; keep supervisory archive close blocked until index version, binding, mutation monitor, signoffs and timeline hash are attached.";

  return {
    schemaVersion: "pass2867_customer_export_supervisory_final_evidence_index_freeze_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryFinalEvidenceIndexFreezeState: state,
    supervisoryFinalEvidenceIndexFreezeReadinessScore: readiness,
    supervisoryFinalEvidenceIndexFreezeEnvelope: {
      previousFreezeLiftState: previousGate.supervisoryResidualEscalationResolutionFreezeLiftState,
      previousFreezeLiftReadinessScore: previousGate.supervisoryResidualEscalationResolutionFreezeLiftReadinessScore,
      previousCanCloseEscalationResolution: previousCanClose,
      previousCanLiftResidualFreeze: previousCanLift,
      previousFreezeLiftReceiptId,
      previousFreezeLiftDecisionReceiptId,
      previousResolutionTimelineHash,
      finalEvidenceIndexId: args.finalEvidenceIndexId ?? null,
      finalEvidenceIndexVersion: args.finalEvidenceIndexVersion ?? null,
      finalEvidenceIndexHash: args.finalEvidenceIndexHash ?? null,
      immutableArchiveBindingHash: args.immutableArchiveBindingHash ?? null,
      freezeLiftReceiptBindingHash: args.freezeLiftReceiptBindingHash ?? null,
      resolutionTimelineBindingHash: args.resolutionTimelineBindingHash ?? null,
      finalEvidenceIndexFreezeReceiptId: args.finalEvidenceIndexFreezeReceiptId ?? null,
      mutationAttemptMonitorReceiptId: args.mutationAttemptMonitorReceiptId ?? null,
      mutationAttempts,
      operatorAuditSignoffReceiptId: args.operatorAuditSignoffReceiptId ?? null,
      legalAuditSignoffReceiptId: args.legalAuditSignoffReceiptId ?? null,
      evidenceIndexFrozenAt: args.evidenceIndexFrozenAt ?? null,
      finalEvidenceIndexFreezeTimelineHash: args.finalEvidenceIndexFreezeTimelineHash ?? null,
    },
    supervisoryFinalEvidenceIndexFreezePolicy: {
      canFreezeFinalEvidenceIndex: ready,
      canClaimPostResolutionIndexImmutable: ready,
      canResumeSupervisoryArchiveClose: ready,
      canClaimProductionFinalIndexFreeze: false,
      reason,
    },
    supervisoryFinalEvidenceIndexFreezeRiskSignals: {
      previousFreezeLiftNotReady: !previousCanClose || !previousCanLift,
      finalEvidenceIndexMissing: !args.finalEvidenceIndexId,
      finalEvidenceIndexVersionMissing: !args.finalEvidenceIndexVersion,
      finalEvidenceIndexHashMissing: !args.finalEvidenceIndexHash,
      immutableArchiveBindingMissing: !args.immutableArchiveBindingHash,
      freezeLiftBindingMissing: !args.freezeLiftReceiptBindingHash,
      resolutionTimelineBindingMissing: !args.resolutionTimelineBindingHash,
      freezeReceiptMissing: !args.finalEvidenceIndexFreezeReceiptId,
      mutationMonitorMissing: !args.mutationAttemptMonitorReceiptId,
      postResolutionMutationDetected,
      unblockedMutationAttemptDetected,
      operatorSignoffMissing: !args.operatorAuditSignoffReceiptId,
      legalSignoffMissing: !args.legalAuditSignoffReceiptId,
      timelineMissing: !(args.evidenceIndexFrozenAt && args.finalEvidenceIndexFreezeTimelineHash),
    },
    customerSafeCopy: ready
      ? "The supervisory residual escalation evidence index is frozen as a versioned, mutation-monitored archive index. This is an audit-control state, not a new customer report."
      : "The supervisory residual escalation evidence index is still mutable or missing proof, so final archive close must remain blocked.",
    operatorNextActions: ready
      ? ["Keep mutation-monitor alerts enabled and store final index freeze receipt with the supervisory archive evidence bundle."]
      : [
          "Attach final evidence index ID/version/hash and immutable archive binding.",
          "Bind freeze-lift receipt and resolution timeline to the final evidence-index version.",
          "Enable mutation-attempt monitor and block unreceipted post-resolution writes.",
          "Attach operator/legal audit signoff and final evidence index freeze timeline hash.",
        ],
  };
}
