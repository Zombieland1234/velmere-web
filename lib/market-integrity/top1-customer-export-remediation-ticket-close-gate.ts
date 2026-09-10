import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2848CustomerExportReconciliationDriftMonitorGate } from "@/lib/market-integrity/top1-customer-export-reconciliation-drift-monitor-gate";

export type Pass2849CustomerExportRemediationTicketCloseState =
  | "reconciliation_not_ready"
  | "no_drift_close_assertion_missing"
  | "drift_ticket_missing"
  | "root_cause_missing"
  | "operator_remediation_receipt_missing"
  | "replay_reseal_receipt_missing"
  | "corrected_payload_binding_missing"
  | "customer_impact_assessment_missing"
  | "freeze_lift_decision_missing"
  | "customer_remediation_notice_missing"
  | "remediation_timeline_missing"
  | "residual_drift_blocked"
  | "remediation_ticket_close_ready";

export type Pass2849CustomerExportRemediationRootCause =
  | "payload_hash_drift"
  | "source_receipt_root_drift"
  | "channel_commit_mismatch"
  | "stale_storage_object"
  | "outbox_replay_duplicate"
  | "customer_receipt_mismatch"
  | "no_drift_observed"
  | "unknown";

export type Pass2849CustomerExportRemediationTicketCloseGate = {
  schemaVersion: "pass2849_customer_export_remediation_ticket_close_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  remediationTicketCloseState: Pass2849CustomerExportRemediationTicketCloseState;
  remediationTicketCloseReadinessScore: number;
  remediationEnvelope: {
    previousReconciliationState: string;
    previousReconciliationReadinessScore: number;
    previousDriftDetected: boolean;
    previousDriftRemediationTicketId: string | null;
    remediationTicketId: string | null;
    remediationRootCause: Pass2849CustomerExportRemediationRootCause;
    operatorRemediationReceiptId: string | null;
    replayAndResealReceiptId: string | null;
    correctedPayloadHash: string | null;
    correctedSourceReceiptRoot: string | null;
    expectedPayloadHash: string | null;
    expectedSourceReceiptRoot: string | null;
    customerImpactAssessmentId: string | null;
    freezeLiftDecisionReceiptId: string | null;
    customerRemediationNoticeReceiptId: string | null;
    remediationClosedAt: string | null;
    remediationAuditTimelineHash: string | null;
    noResidualDriftReceiptId: string | null;
  };
  remediationPolicy: {
    canCloseRemediationTicket: boolean;
    canLiftCustomerExportFreeze: boolean;
    canResumeCustomerVisibleChannels: boolean;
    canClaimProductionRemediationWorkflow: false;
    reason: string;
  };
  remediationRiskSignals: {
    reconciliationNotReady: boolean;
    driftNeedsTicket: boolean;
    missingRootCause: boolean;
    missingOperatorRemediationReceipt: boolean;
    missingReplayAndResealReceipt: boolean;
    correctedPayloadOrSourceBindingMissing: boolean;
    missingCustomerImpactAssessment: boolean;
    missingFreezeLiftDecision: boolean;
    missingCustomerNotice: boolean;
    missingRemediationTimeline: boolean;
    residualDriftDetected: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2849_CUSTOMER_EXPORT_REMEDIATION_TICKET_CLOSE_ACCEPTANCE_GATES = [
  "PASS2849: A drift remediation ticket cannot close until root cause, operator remediation receipt, replay/reseal receipt, corrected payload/source-root binding and customer impact assessment are attached.",
  "PASS2849: Customer export freeze cannot be lifted by reconciliation alone; freeze lift requires a signed decision receipt, customer remediation notice and no-residual-drift receipt.",
  "PASS2849: Reconciliation drift alerts are not customer-safe close proof; every drift path must end in a remediation audit timeline hash or remain blocked.",
  "PASS2849: No-drift reconciliation still requires an explicit no-drift close assertion before customer-visible channels can be described as closed safely.",
  "PASS2849: Remediation close readiness is a deterministic contract only; it does not claim a deployed production remediation workflow without live DB, worker and operator UI evidence.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2849CustomerExportRemediationTicketCloseGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportReconciliationDriftMonitorGate: Pass2848CustomerExportReconciliationDriftMonitorGate;
  generatedAt?: string;
  remediationTicketId?: string | null;
  remediationRootCause?: Pass2849CustomerExportRemediationRootCause | null;
  operatorRemediationReceiptId?: string | null;
  replayAndResealReceiptId?: string | null;
  correctedPayloadHash?: string | null;
  correctedSourceReceiptRoot?: string | null;
  customerImpactAssessmentId?: string | null;
  freezeLiftDecisionReceiptId?: string | null;
  customerRemediationNoticeReceiptId?: string | null;
  remediationClosedAt?: string | null;
  remediationAuditTimelineHash?: string | null;
  noResidualDriftReceiptId?: string | null;
  noDriftCloseAssertionId?: string | null;
  residualDriftDetected?: boolean;
}): Pass2849CustomerExportRemediationTicketCloseGate {
  const previousGate = args.customerExportReconciliationDriftMonitorGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(
    previousGate.reconciliationDriftMonitorState === "reconciliation_drift_monitor_ready" &&
      previousGate.reconciliationPolicy.canKeepDeliveryChannelsOpen,
  );
  const previousDriftDetected = Boolean(previousGate.reconciliationRiskSignals.driftDetected);
  const rootCause = args.remediationRootCause ?? (previousDriftDetected ? "unknown" : "no_drift_observed");
  const expectedPayloadHash = previousGate.reconciliationEnvelope.expectedPayloadHash;
  const expectedSourceReceiptRoot = previousGate.reconciliationEnvelope.expectedSourceReceiptRoot;
  const correctedPayloadMatches = Boolean(args.correctedPayloadHash && expectedPayloadHash && args.correctedPayloadHash === expectedPayloadHash);
  const correctedSourceRootMatches = Boolean(args.correctedSourceReceiptRoot && expectedSourceReceiptRoot && args.correctedSourceReceiptRoot === expectedSourceReceiptRoot);
  const correctedBindingReady = !previousDriftDetected || (correctedPayloadMatches && correctedSourceRootMatches);
  const residualDriftDetected = Boolean(args.residualDriftDetected);
  const noDriftAssertionReady = previousDriftDetected || Boolean(args.noDriftCloseAssertionId || args.noResidualDriftReceiptId);

  const ready = Boolean(
    previousReady &&
      noDriftAssertionReady &&
      (!previousDriftDetected || args.remediationTicketId || previousGate.reconciliationEnvelope.driftRemediationTicketId) &&
      rootCause !== "unknown" &&
      args.operatorRemediationReceiptId &&
      args.replayAndResealReceiptId &&
      correctedBindingReady &&
      args.customerImpactAssessmentId &&
      args.freezeLiftDecisionReceiptId &&
      args.customerRemediationNoticeReceiptId &&
      args.remediationClosedAt &&
      args.remediationAuditTimelineHash &&
      args.noResidualDriftReceiptId &&
      !residualDriftDetected,
  );

  const remediationTicketCloseState: Pass2849CustomerExportRemediationTicketCloseState = !previousReady
    ? "reconciliation_not_ready"
    : !previousDriftDetected && !noDriftAssertionReady
      ? "no_drift_close_assertion_missing"
      : previousDriftDetected && !args.remediationTicketId && !previousGate.reconciliationEnvelope.driftRemediationTicketId
        ? "drift_ticket_missing"
        : rootCause === "unknown"
          ? "root_cause_missing"
          : !args.operatorRemediationReceiptId
            ? "operator_remediation_receipt_missing"
            : !args.replayAndResealReceiptId
              ? "replay_reseal_receipt_missing"
              : !correctedBindingReady
                ? "corrected_payload_binding_missing"
                : !args.customerImpactAssessmentId
                  ? "customer_impact_assessment_missing"
                  : !args.freezeLiftDecisionReceiptId
                    ? "freeze_lift_decision_missing"
                    : !args.customerRemediationNoticeReceiptId
                      ? "customer_remediation_notice_missing"
                      : !args.remediationAuditTimelineHash || !args.remediationClosedAt
                        ? "remediation_timeline_missing"
                        : residualDriftDetected || !args.noResidualDriftReceiptId
                          ? "residual_drift_blocked"
                          : "remediation_ticket_close_ready";

  const remediationTicketCloseReadinessScore = clamp(
    previousGate.reconciliationDriftReadinessScore +
      (previousReady ? 6 : -28) +
      (noDriftAssertionReady ? 6 : -10) +
      (args.remediationTicketId || previousGate.reconciliationEnvelope.driftRemediationTicketId ? 7 : previousDriftDetected ? -12 : 4) +
      (rootCause !== "unknown" ? 7 : -12) +
      (args.operatorRemediationReceiptId ? 8 : -10) +
      (args.replayAndResealReceiptId ? 8 : -10) +
      (correctedBindingReady ? 8 : -14) +
      (args.customerImpactAssessmentId ? 7 : -9) +
      (args.freezeLiftDecisionReceiptId ? 7 : -9) +
      (args.customerRemediationNoticeReceiptId ? 6 : -8) +
      (args.remediationClosedAt ? 5 : -7) +
      (args.remediationAuditTimelineHash ? 8 : -10) +
      (args.noResidualDriftReceiptId ? 8 : -12) -
      (residualDriftDetected ? 45 : 0),
  );

  const reason = ready
    ? "Customer export remediation ticket close contracts are ready: root cause, operator remediation, replay/reseal, corrected payload/source roots, customer impact, freeze-lift decision, notice and no-residual-drift receipt are timeline-bound."
    : "Customer export remediation ticket close remains prepared-only until drift/no-drift close, operator remediation, corrected payload/source-root binding, customer impact, freeze-lift decision, notice and no-residual-drift timeline all clear.";

  const operatorNextActions = [
    !previousReady ? "Run PASS2848 reconciliation to a ready state before closing remediation." : null,
    previousDriftDetected && !args.remediationTicketId && !previousGate.reconciliationEnvelope.driftRemediationTicketId ? "Open or bind the drift remediation ticket before any close decision." : null,
    rootCause === "unknown" ? "Record a non-unknown drift root cause." : null,
    !args.operatorRemediationReceiptId ? "Attach operator remediation receipt." : null,
    !args.replayAndResealReceiptId ? "Attach replay/reseal receipt after remediation." : null,
    !correctedBindingReady ? "Bind corrected payloadHash and sourceReceiptRoot to the expected reconciliation roots." : null,
    !args.customerImpactAssessmentId ? "Attach customer impact assessment before lifting freeze." : null,
    !args.freezeLiftDecisionReceiptId ? "Append freeze-lift decision receipt." : null,
    !args.customerRemediationNoticeReceiptId ? "Append customer remediation notice receipt." : null,
    !args.remediationAuditTimelineHash || !args.remediationClosedAt ? "Hash the remediation close timeline and close timestamp." : null,
    residualDriftDetected || !args.noResidualDriftReceiptId ? "Keep customer-visible export channels frozen until no-residual-drift receipt is present." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2849_customer_export_remediation_ticket_close_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    remediationTicketCloseState,
    remediationTicketCloseReadinessScore,
    remediationEnvelope: {
      previousReconciliationState: previousGate.reconciliationDriftMonitorState,
      previousReconciliationReadinessScore: previousGate.reconciliationDriftReadinessScore,
      previousDriftDetected,
      previousDriftRemediationTicketId: previousGate.reconciliationEnvelope.driftRemediationTicketId,
      remediationTicketId: args.remediationTicketId ?? previousGate.reconciliationEnvelope.driftRemediationTicketId ?? null,
      remediationRootCause: rootCause,
      operatorRemediationReceiptId: args.operatorRemediationReceiptId ?? null,
      replayAndResealReceiptId: args.replayAndResealReceiptId ?? null,
      correctedPayloadHash: args.correctedPayloadHash ?? null,
      correctedSourceReceiptRoot: args.correctedSourceReceiptRoot ?? null,
      expectedPayloadHash,
      expectedSourceReceiptRoot,
      customerImpactAssessmentId: args.customerImpactAssessmentId ?? null,
      freezeLiftDecisionReceiptId: args.freezeLiftDecisionReceiptId ?? null,
      customerRemediationNoticeReceiptId: args.customerRemediationNoticeReceiptId ?? null,
      remediationClosedAt: args.remediationClosedAt ?? null,
      remediationAuditTimelineHash: args.remediationAuditTimelineHash ?? null,
      noResidualDriftReceiptId: args.noResidualDriftReceiptId ?? args.noDriftCloseAssertionId ?? null,
    },
    remediationPolicy: {
      canCloseRemediationTicket: ready,
      canLiftCustomerExportFreeze: ready,
      canResumeCustomerVisibleChannels: ready,
      canClaimProductionRemediationWorkflow: false,
      reason,
    },
    remediationRiskSignals: {
      reconciliationNotReady: !previousReady,
      driftNeedsTicket: previousDriftDetected && !args.remediationTicketId && !previousGate.reconciliationEnvelope.driftRemediationTicketId,
      missingRootCause: rootCause === "unknown",
      missingOperatorRemediationReceipt: !args.operatorRemediationReceiptId,
      missingReplayAndResealReceipt: !args.replayAndResealReceiptId,
      correctedPayloadOrSourceBindingMissing: !correctedBindingReady,
      missingCustomerImpactAssessment: !args.customerImpactAssessmentId,
      missingFreezeLiftDecision: !args.freezeLiftDecisionReceiptId,
      missingCustomerNotice: !args.customerRemediationNoticeReceiptId,
      missingRemediationTimeline: !args.remediationAuditTimelineHash || !args.remediationClosedAt,
      residualDriftDetected: residualDriftDetected || !args.noResidualDriftReceiptId,
    },
    customerSafeCopy: ready
      ? "Customer export remediation close contracts are ready for deterministic tests. Production close still needs live DB migrations, operator UI actions, deployed workers and customer notification evidence."
      : "Customer export remediation remains prepared-only; customer-visible channels stay frozen until remediation, replay/reseal, impact review, freeze-lift, notice and no-residual-drift receipts are timeline-bound.",
    operatorNextActions,
  };
}
