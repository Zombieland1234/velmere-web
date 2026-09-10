import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2856CustomerExportDsrAppealResolutionClosureGate } from "@/lib/market-integrity/top1-customer-export-dsr-appeal-resolution-closure-gate";

export type Pass2857CustomerExportPrivacyCaseSupervisorSlaState =
  | "dsr_appeal_resolution_closure_not_ready"
  | "privacy_case_supervisor_assignment_missing"
  | "privacy_case_sla_policy_missing"
  | "appeal_resolution_sla_clock_missing"
  | "late_signoff_escalation_receipt_missing"
  | "duplicate_appeal_abuse_guard_missing"
  | "customer_communication_cadence_receipt_missing"
  | "unresolved_case_export_freeze_receipt_missing"
  | "supervisor_audit_timeline_hash_missing"
  | "privacy_case_supervisor_sla_escalation_ready";

export type Pass2857CustomerExportPrivacyCaseStatus =
  | "closed"
  | "open"
  | "pending_customer"
  | "pending_legal_privacy"
  | "sla_breached"
  | "escalated";

export type Pass2857CustomerExportPrivacyCaseSupervisorSlaGate = {
  schemaVersion: "pass2857_customer_export_privacy_case_supervisor_sla_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  privacyCaseSupervisorSlaState: Pass2857CustomerExportPrivacyCaseSupervisorSlaState;
  privacyCaseSupervisorSlaReadinessScore: number;
  privacyCaseSupervisorSlaEnvelope: {
    previousDsrAppealResolutionClosureState: string;
    previousDsrAppealResolutionClosureReadinessScore: number;
    previousCanClaimFinalPrivacyCaseClosure: boolean;
    previousCanUnfreezeCustomerExportAfterDsrAppealResolution: boolean;
    privacyCaseStatus: Pass2857CustomerExportPrivacyCaseStatus;
    supervisorPseudonym: string | null;
    supervisorAssignmentReceiptId: string | null;
    privacyCaseSlaPolicyId: string | null;
    appealResolutionDueAt: string | null;
    appealResolutionClosedAt: string | null;
    privacyCaseCurrentAgeHours: number;
    legalPrivacySignoffLate: boolean;
    slaBreachDetected: boolean;
    lateSignoffEscalationReceiptId: string | null;
    duplicateAppealCount: number;
    duplicateAppealThrottleReceiptId: string | null;
    abuseGuardReceiptId: string | null;
    customerCommunicationCadenceReceiptId: string | null;
    unresolvedCaseExportFreezeReceiptId: string | null;
    supervisorAuditTimelineHash: string | null;
  };
  privacyCaseSupervisorSlaPolicy: {
    canClaimSupervisorControlledPrivacyClose: boolean;
    canUnfreezeExportChannelsAfterPrivacyClose: boolean;
    canClaimProductionPrivacyCaseSupervisorWorkflow: false;
    reason: string;
  };
  privacyCaseSupervisorSlaRiskSignals: {
    previousDsrAppealResolutionClosureNotReady: boolean;
    missingSupervisorAssignment: boolean;
    missingSlaPolicy: boolean;
    missingSlaClock: boolean;
    missingLateSignoffEscalation: boolean;
    missingDuplicateAppealAbuseGuard: boolean;
    missingCustomerCommunicationCadence: boolean;
    missingUnresolvedCaseExportFreeze: boolean;
    missingSupervisorAuditTimelineHash: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2857_CUSTOMER_EXPORT_PRIVACY_CASE_SUPERVISOR_SLA_ACCEPTANCE_GATES = [
  "PASS2857: Final privacy closure is not the same as supervisor-controlled privacy-case close.",
  "PASS2857: Every DSAR/privacy-case closure needs a supervisor assignment receipt, SLA policy and appeal-resolution SLA clock before the close can be called governed.",
  "PASS2857: Late legal/privacy signoff or SLA breach must create an escalation receipt; missing escalation freezes customer-facing close and export-channel unfreeze.",
  "PASS2857: Duplicate appeals require throttle and abuse-guard receipts; unresolved cases require an export freeze receipt and customer communication cadence receipt.",
  "PASS2857: This remains a deterministic contract/API boundary. Production claims require real case management rows, notification cadence logs, privacy/legal signoff, supervisor audit trail and customer portal/support artifacts.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function isUnresolved(status: Pass2857CustomerExportPrivacyCaseStatus) {
  return status !== "closed";
}

export function buildPass2857CustomerExportPrivacyCaseSupervisorSlaGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportDsrAppealResolutionClosureGate: Pass2856CustomerExportDsrAppealResolutionClosureGate;
  generatedAt?: string;
  privacyCaseStatus?: Pass2857CustomerExportPrivacyCaseStatus;
  supervisorPseudonym?: string | null;
  supervisorAssignmentReceiptId?: string | null;
  privacyCaseSlaPolicyId?: string | null;
  appealResolutionDueAt?: string | null;
  appealResolutionClosedAt?: string | null;
  privacyCaseCurrentAgeHours?: number;
  legalPrivacySignoffLate?: boolean;
  slaBreachDetected?: boolean;
  lateSignoffEscalationReceiptId?: string | null;
  duplicateAppealCount?: number;
  duplicateAppealThrottleReceiptId?: string | null;
  abuseGuardReceiptId?: string | null;
  customerCommunicationCadenceReceiptId?: string | null;
  unresolvedCaseExportFreezeReceiptId?: string | null;
  supervisorAuditTimelineHash?: string | null;
}): Pass2857CustomerExportPrivacyCaseSupervisorSlaGate {
  const previousGate = args.customerExportDsrAppealResolutionClosureGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = previousGate.dsrAppealResolutionClosureState === "dsr_appeal_resolution_closure_ready";
  const privacyCaseStatus = args.privacyCaseStatus ?? "closed";
  const duplicateAppealCount = Math.max(0, args.duplicateAppealCount ?? 0);
  const legalPrivacySignoffLate = Boolean(args.legalPrivacySignoffLate);
  const slaBreachDetected = Boolean(args.slaBreachDetected || privacyCaseStatus === "sla_breached");
  const unresolved = isUnresolved(privacyCaseStatus);
  const supervisorReady = Boolean(args.supervisorPseudonym && args.supervisorAssignmentReceiptId);
  const slaPolicyReady = Boolean(args.privacyCaseSlaPolicyId);
  const slaClockReady = Boolean(args.appealResolutionDueAt && (unresolved || args.appealResolutionClosedAt));
  const lateEscalationReady = !(legalPrivacySignoffLate || slaBreachDetected) || Boolean(args.lateSignoffEscalationReceiptId);
  const duplicateGuardRequired = duplicateAppealCount > 0;
  const duplicateGuardReady = !duplicateGuardRequired || Boolean(args.duplicateAppealThrottleReceiptId && args.abuseGuardReceiptId);
  const cadenceReady = Boolean(args.customerCommunicationCadenceReceiptId);
  const unresolvedFreezeReady = !unresolved || Boolean(args.unresolvedCaseExportFreezeReceiptId);
  const timelineReady = Boolean(args.supervisorAuditTimelineHash);

  const ready = Boolean(
    previousReady &&
      supervisorReady &&
      slaPolicyReady &&
      slaClockReady &&
      lateEscalationReady &&
      duplicateGuardReady &&
      cadenceReady &&
      unresolvedFreezeReady &&
      timelineReady,
  );

  const privacyCaseSupervisorSlaState: Pass2857CustomerExportPrivacyCaseSupervisorSlaState = !previousReady
    ? "dsr_appeal_resolution_closure_not_ready"
    : !supervisorReady
      ? "privacy_case_supervisor_assignment_missing"
      : !slaPolicyReady
        ? "privacy_case_sla_policy_missing"
        : !slaClockReady
          ? "appeal_resolution_sla_clock_missing"
          : !lateEscalationReady
            ? "late_signoff_escalation_receipt_missing"
            : !duplicateGuardReady
              ? "duplicate_appeal_abuse_guard_missing"
              : !cadenceReady
                ? "customer_communication_cadence_receipt_missing"
                : !unresolvedFreezeReady
                  ? "unresolved_case_export_freeze_receipt_missing"
                  : !timelineReady
                    ? "supervisor_audit_timeline_hash_missing"
                    : "privacy_case_supervisor_sla_escalation_ready";

  const privacyCaseSupervisorSlaReadinessScore = clamp(
    previousGate.dsrAppealResolutionClosureReadinessScore +
      (previousReady ? 8 : -50) +
      (supervisorReady ? 12 : -18) +
      (slaPolicyReady ? 10 : -16) +
      (slaClockReady ? 10 : -16) +
      (lateEscalationReady ? 8 : -18) +
      (duplicateGuardReady ? 8 : -14) +
      (cadenceReady ? 8 : -14) +
      (unresolvedFreezeReady ? 8 : -18) +
      (timelineReady ? 8 : -16),
  );

  const reason = ready
    ? unresolved
      ? "Privacy case is supervisor-assigned, SLA-clocked, cadence-receipted and export-frozen while unresolved for this deterministic supervisory boundary."
      : "Final privacy closure is supervisor-assigned, SLA-clocked, customer-communication cadenced and timeline-hashed for this deterministic supervisory boundary."
    : `Privacy case supervisor/SLA boundary blocked at ${privacyCaseSupervisorSlaState}.`;

  return {
    schemaVersion: "pass2857_customer_export_privacy_case_supervisor_sla_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    privacyCaseSupervisorSlaState,
    privacyCaseSupervisorSlaReadinessScore,
    privacyCaseSupervisorSlaEnvelope: {
      previousDsrAppealResolutionClosureState: previousGate.dsrAppealResolutionClosureState,
      previousDsrAppealResolutionClosureReadinessScore: previousGate.dsrAppealResolutionClosureReadinessScore,
      previousCanClaimFinalPrivacyCaseClosure: previousGate.dsrAppealResolutionClosurePolicy.canClaimFinalPrivacyCaseClosure,
      previousCanUnfreezeCustomerExportAfterDsrAppealResolution: previousGate.dsrAppealResolutionClosurePolicy.canUnfreezeCustomerExportAfterDsrAppealResolution,
      privacyCaseStatus,
      supervisorPseudonym: args.supervisorPseudonym ?? null,
      supervisorAssignmentReceiptId: args.supervisorAssignmentReceiptId ?? null,
      privacyCaseSlaPolicyId: args.privacyCaseSlaPolicyId ?? null,
      appealResolutionDueAt: args.appealResolutionDueAt ?? null,
      appealResolutionClosedAt: args.appealResolutionClosedAt ?? null,
      privacyCaseCurrentAgeHours: Math.max(0, args.privacyCaseCurrentAgeHours ?? 0),
      legalPrivacySignoffLate,
      slaBreachDetected,
      lateSignoffEscalationReceiptId: args.lateSignoffEscalationReceiptId ?? null,
      duplicateAppealCount,
      duplicateAppealThrottleReceiptId: args.duplicateAppealThrottleReceiptId ?? null,
      abuseGuardReceiptId: args.abuseGuardReceiptId ?? null,
      customerCommunicationCadenceReceiptId: args.customerCommunicationCadenceReceiptId ?? null,
      unresolvedCaseExportFreezeReceiptId: args.unresolvedCaseExportFreezeReceiptId ?? null,
      supervisorAuditTimelineHash: args.supervisorAuditTimelineHash ?? null,
    },
    privacyCaseSupervisorSlaPolicy: {
      canClaimSupervisorControlledPrivacyClose: ready && !unresolved && !slaBreachDetected && !legalPrivacySignoffLate,
      canUnfreezeExportChannelsAfterPrivacyClose: ready && !unresolved && !slaBreachDetected && !legalPrivacySignoffLate,
      canClaimProductionPrivacyCaseSupervisorWorkflow: false,
      reason,
    },
    privacyCaseSupervisorSlaRiskSignals: {
      previousDsrAppealResolutionClosureNotReady: !previousReady,
      missingSupervisorAssignment: !supervisorReady,
      missingSlaPolicy: !slaPolicyReady,
      missingSlaClock: !slaClockReady,
      missingLateSignoffEscalation: !lateEscalationReady,
      missingDuplicateAppealAbuseGuard: !duplicateGuardReady,
      missingCustomerCommunicationCadence: !cadenceReady,
      missingUnresolvedCaseExportFreeze: !unresolvedFreezeReady,
      missingSupervisorAuditTimelineHash: !timelineReady,
    },
    customerSafeCopy: ready
      ? "Velmère can show that the privacy case has a supervisor, SLA clock, communication cadence and audit timeline. This is still not a production legal/privacy workflow until real case records and notifications exist."
      : "Velmère cannot call the privacy case supervisor-controlled or unfreeze export channels until supervisor, SLA, escalation, duplicate-appeal, cadence, freeze and timeline receipts are complete.",
    operatorNextActions: ready
      ? ["Replace deterministic supervisor/SLA fixture with durable privacy-case management rows and notification logs.", "Attach real privacy/legal signoff and customer portal/support artifacts before any production claim."]
      : ["Assign privacy-case supervisor and bind receipt.", "Attach SLA policy, due/closed timestamps and customer communication cadence receipt.", "Add escalation receipt for late signoff/SLA breach and freeze receipt for unresolved cases.", "Bind duplicate appeal throttle/abuse guard and supervisor audit timeline hash."],
  };
}
