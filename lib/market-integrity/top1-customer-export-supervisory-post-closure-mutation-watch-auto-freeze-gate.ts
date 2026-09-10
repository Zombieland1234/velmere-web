import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2870CustomerExportSupervisoryTamperResolutionReconciliationClosureAuditGate } from "@/lib/market-integrity/top1-customer-export-supervisory-tamper-resolution-reconciliation-closure-audit-gate";

export type Pass2871CustomerExportSupervisoryPostClosureMutationWatchAutoFreezeState =
  | "previous_closure_audit_not_ready"
  | "post_closure_watch_missing"
  | "mutation_signal_review_missing"
  | "auto_freeze_receipt_missing"
  | "mutation_incident_ticket_missing"
  | "notice_decision_missing"
  | "post_closure_watch_timeline_missing"
  | "supervisory_post_closure_mutation_watch_auto_freeze_ready";

export type Pass2871CustomerExportSupervisoryPostClosureMutationSignal = {
  signalId: string;
  signalKind: "write_attempt" | "delete_attempt" | "reindex_attempt" | "hash_drift" | "archive_rebind" | "channel_rebind" | "late_evidence_drift";
  detectedAt: string;
  severity: "info" | "medium" | "high" | "critical";
  affectedSurface: "archive" | "evidence_index" | "customer_notice" | "regulator_notice" | "auditor_notice" | "support_attachment" | "api_handoff";
  autoFreezeRequired: boolean;
  mutationIncidentTicketId: string | null;
};

export type Pass2871CustomerExportSupervisoryPostClosureMutationWatchAutoFreezeGate = {
  schemaVersion: "pass2871_customer_export_supervisory_post_closure_mutation_watch_auto_freeze_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryPostClosureMutationWatchAutoFreezeState: Pass2871CustomerExportSupervisoryPostClosureMutationWatchAutoFreezeState;
  supervisoryPostClosureMutationWatchAutoFreezeReadinessScore: number;
  supervisoryPostClosureMutationWatchAutoFreezeEnvelope: {
    previousClosureAuditState: string;
    previousClosureAuditReadinessScore: number;
    previousCanCloseTamperResolution: boolean;
    previousClosureAuditPayloadHash: string | null;
    previousClosureAuditTimelineHash: string | null;
    finalClosureAuditIndexId: string | null;
    finalClosureAuditIndexHash: string | null;
    postClosureWatchReceiptId: string | null;
    postClosureWatchWindowHours: number;
    mutationSignalReviewReceiptId: string | null;
    mutationSignals: Pass2871CustomerExportSupervisoryPostClosureMutationSignal[];
    autoFreezeReceiptId: string | null;
    archiveCloseFreezeReceiptId: string | null;
    exportChannelFreezeReceiptId: string | null;
    mutationIncidentTicketId: string | null;
    mutationIncidentOwnerPseudonym: string | null;
    mutationIncidentSlaDueAt: string | null;
    customerNoticeDecisionReceiptId: string | null;
    regulatorNoticeDecisionReceiptId: string | null;
    auditorNoticeDecisionReceiptId: string | null;
    postClosureWatchPayloadHash: string | null;
    postClosureWatchTimelineHash: string | null;
  };
  supervisoryPostClosureMutationWatchAutoFreezePolicy: {
    canKeepFinalClosureClosed: boolean;
    mustAutoFreezeOnMutationSignal: boolean;
    mustOpenMutationIncidentTicket: boolean;
    mustPreserveFinalClosureAuditImmutable: true;
    canClaimProductionMutationWatcher: false;
    reason: string;
  };
  supervisoryPostClosureMutationWatchAutoFreezeRiskSignals: {
    previousClosureAuditNotReady: boolean;
    postClosureWatchMissing: boolean;
    finalClosureAuditIndexBindingMissing: boolean;
    mutationSignalDetected: boolean;
    mutationSignalReviewMissing: boolean;
    autoFreezeReceiptMissing: boolean;
    archiveCloseFreezeMissing: boolean;
    exportChannelFreezeMissing: boolean;
    mutationIncidentTicketMissing: boolean;
    noticeDecisionMissing: boolean;
    payloadHashMissing: boolean;
    timelineHashMissing: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2871_CUSTOMER_EXPORT_SUPERVISORY_POST_CLOSURE_MUTATION_WATCH_AUTO_FREEZE_ACCEPTANCE_GATES = [
  "PASS2871: Final tamper-resolution closure is not permanently safe until a post-closure mutation watch is attached.",
  "PASS2871: Any post-closure write/delete/reindex/hash-drift/channel-rebind/late-evidence drift signal must auto-freeze archive close and export channels.",
  "PASS2871: Mutation signals require a reviewed signal receipt, mutation incident ticket, owner/SLA and immutable final-closure-audit binding.",
  "PASS2871: Customer/regulator/auditor notice decisions require separate receipts and cannot reuse old PASS2868/PASS2869 notice receipts.",
  "PASS2871: Post-closure mutation watch requires payload hash and timeline hash before final closure can stay closed.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeMutationSignals(signals?: Pass2871CustomerExportSupervisoryPostClosureMutationSignal[] | null) {
  return (signals ?? []).map((signal) => ({
    signalId: signal.signalId,
    signalKind: signal.signalKind,
    detectedAt: signal.detectedAt,
    severity: signal.severity,
    affectedSurface: signal.affectedSurface,
    autoFreezeRequired: Boolean(signal.autoFreezeRequired),
    mutationIncidentTicketId: signal.mutationIncidentTicketId ?? null,
  })) satisfies Pass2871CustomerExportSupervisoryPostClosureMutationSignal[];
}

export function buildPass2871CustomerExportSupervisoryPostClosureMutationWatchAutoFreezeGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryTamperResolutionReconciliationClosureAuditGate: Pass2870CustomerExportSupervisoryTamperResolutionReconciliationClosureAuditGate;
  generatedAt?: string;
  finalClosureAuditIndexId?: string | null;
  finalClosureAuditIndexHash?: string | null;
  postClosureWatchReceiptId?: string | null;
  postClosureWatchWindowHours?: number;
  mutationSignalReviewReceiptId?: string | null;
  mutationSignals?: Pass2871CustomerExportSupervisoryPostClosureMutationSignal[] | null;
  autoFreezeReceiptId?: string | null;
  archiveCloseFreezeReceiptId?: string | null;
  exportChannelFreezeReceiptId?: string | null;
  mutationIncidentTicketId?: string | null;
  mutationIncidentOwnerPseudonym?: string | null;
  mutationIncidentSlaDueAt?: string | null;
  customerNoticeDecisionReceiptId?: string | null;
  regulatorNoticeDecisionReceiptId?: string | null;
  auditorNoticeDecisionReceiptId?: string | null;
  postClosureWatchPayloadHash?: string | null;
  postClosureWatchTimelineHash?: string | null;
}): Pass2871CustomerExportSupervisoryPostClosureMutationWatchAutoFreezeGate {
  const previousGate = args.customerExportSupervisoryTamperResolutionReconciliationClosureAuditGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousEnvelope = previousGate.supervisoryTamperResolutionReconciliationClosureAuditEnvelope;
  const previousReady = Boolean(previousGate.supervisoryTamperResolutionReconciliationClosureAuditPolicy.canCloseTamperResolution);
  const mutationSignals = normalizeMutationSignals(args.mutationSignals);
  const mutationSignalDetected = mutationSignals.some((signal) => signal.autoFreezeRequired || signal.severity === "high" || signal.severity === "critical");
  const indexBindingReady = Boolean(args.finalClosureAuditIndexId && args.finalClosureAuditIndexHash && previousEnvelope.closureAuditPayloadHash && previousEnvelope.closureAuditTimelineHash);
  const watchReady = Boolean(args.postClosureWatchReceiptId && (args.postClosureWatchWindowHours ?? 0) > 0);
  const reviewReady = Boolean(args.mutationSignalReviewReceiptId);
  const freezeReady = mutationSignalDetected
    ? Boolean(args.autoFreezeReceiptId && args.archiveCloseFreezeReceiptId && args.exportChannelFreezeReceiptId)
    : true;
  const ticketReady = mutationSignalDetected
    ? Boolean(args.mutationIncidentTicketId && args.mutationIncidentOwnerPseudonym && args.mutationIncidentSlaDueAt)
    : true;
  const noticeReady = Boolean(args.customerNoticeDecisionReceiptId && args.regulatorNoticeDecisionReceiptId && args.auditorNoticeDecisionReceiptId);
  const timelineReady = Boolean(args.postClosureWatchPayloadHash && args.postClosureWatchTimelineHash);
  const ready = Boolean(previousReady && indexBindingReady && watchReady && reviewReady && freezeReady && ticketReady && noticeReady && timelineReady);

  const state: Pass2871CustomerExportSupervisoryPostClosureMutationWatchAutoFreezeState = !previousReady
    ? "previous_closure_audit_not_ready"
    : !watchReady || !indexBindingReady
      ? "post_closure_watch_missing"
      : !reviewReady
        ? "mutation_signal_review_missing"
        : !freezeReady
          ? "auto_freeze_receipt_missing"
          : !ticketReady
            ? "mutation_incident_ticket_missing"
            : !noticeReady
              ? "notice_decision_missing"
              : !timelineReady
                ? "post_closure_watch_timeline_missing"
                : "supervisory_post_closure_mutation_watch_auto_freeze_ready";

  const readiness = clamp(
    previousGate.supervisoryTamperResolutionReconciliationClosureAuditReadinessScore +
      (previousReady ? 8 : -55) +
      (indexBindingReady ? 13 : -24) +
      (watchReady ? 14 : -26) +
      (reviewReady ? 11 : -20) +
      (mutationSignalDetected ? -18 : 8) +
      (freezeReady ? 12 : -35) +
      (ticketReady ? 10 : -28) +
      (noticeReady ? 10 : -20) +
      (args.postClosureWatchPayloadHash ? 6 : -12) +
      (args.postClosureWatchTimelineHash ? 12 : -24),
  );

  const canKeepFinalClosureClosed = Boolean(ready && (!mutationSignalDetected || (freezeReady && ticketReady)));
  return {
    schemaVersion: "pass2871_customer_export_supervisory_post_closure_mutation_watch_auto_freeze_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Advanced",
    releasePacketId: `pass2871-post-closure-mutation-watch-${args.surface.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    sealId: `pass2871-auto-freeze-${previousGate.sealId}`,
    generatedAt,
    supervisoryPostClosureMutationWatchAutoFreezeState: state,
    supervisoryPostClosureMutationWatchAutoFreezeReadinessScore: readiness,
    supervisoryPostClosureMutationWatchAutoFreezeEnvelope: {
      previousClosureAuditState: previousGate.supervisoryTamperResolutionReconciliationClosureAuditState,
      previousClosureAuditReadinessScore: previousGate.supervisoryTamperResolutionReconciliationClosureAuditReadinessScore,
      previousCanCloseTamperResolution: previousReady,
      previousClosureAuditPayloadHash: previousEnvelope.closureAuditPayloadHash,
      previousClosureAuditTimelineHash: previousEnvelope.closureAuditTimelineHash,
      finalClosureAuditIndexId: args.finalClosureAuditIndexId ?? null,
      finalClosureAuditIndexHash: args.finalClosureAuditIndexHash ?? null,
      postClosureWatchReceiptId: args.postClosureWatchReceiptId ?? null,
      postClosureWatchWindowHours: args.postClosureWatchWindowHours ?? 0,
      mutationSignalReviewReceiptId: args.mutationSignalReviewReceiptId ?? null,
      mutationSignals,
      autoFreezeReceiptId: args.autoFreezeReceiptId ?? null,
      archiveCloseFreezeReceiptId: args.archiveCloseFreezeReceiptId ?? null,
      exportChannelFreezeReceiptId: args.exportChannelFreezeReceiptId ?? null,
      mutationIncidentTicketId: args.mutationIncidentTicketId ?? null,
      mutationIncidentOwnerPseudonym: args.mutationIncidentOwnerPseudonym ?? null,
      mutationIncidentSlaDueAt: args.mutationIncidentSlaDueAt ?? null,
      customerNoticeDecisionReceiptId: args.customerNoticeDecisionReceiptId ?? null,
      regulatorNoticeDecisionReceiptId: args.regulatorNoticeDecisionReceiptId ?? null,
      auditorNoticeDecisionReceiptId: args.auditorNoticeDecisionReceiptId ?? null,
      postClosureWatchPayloadHash: args.postClosureWatchPayloadHash ?? null,
      postClosureWatchTimelineHash: args.postClosureWatchTimelineHash ?? null,
    },
    supervisoryPostClosureMutationWatchAutoFreezePolicy: {
      canKeepFinalClosureClosed,
      mustAutoFreezeOnMutationSignal: mutationSignalDetected,
      mustOpenMutationIncidentTicket: mutationSignalDetected,
      mustPreserveFinalClosureAuditImmutable: true,
      canClaimProductionMutationWatcher: false,
      reason: canKeepFinalClosureClosed
        ? "PASS2871 post-closure watch is attached; any mutation signal is reviewed, frozen and ticketed with notice decisions before closure remains closed."
        : "PASS2871 blocks final closure because post-closure mutation watch, auto-freeze, incident ticket, notice decisions or timeline hash is missing.",
    },
    supervisoryPostClosureMutationWatchAutoFreezeRiskSignals: {
      previousClosureAuditNotReady: !previousReady,
      postClosureWatchMissing: !watchReady,
      finalClosureAuditIndexBindingMissing: !indexBindingReady,
      mutationSignalDetected,
      mutationSignalReviewMissing: !reviewReady,
      autoFreezeReceiptMissing: !freezeReady,
      archiveCloseFreezeMissing: mutationSignalDetected && !args.archiveCloseFreezeReceiptId,
      exportChannelFreezeMissing: mutationSignalDetected && !args.exportChannelFreezeReceiptId,
      mutationIncidentTicketMissing: !ticketReady,
      noticeDecisionMissing: !noticeReady,
      payloadHashMissing: !args.postClosureWatchPayloadHash,
      timelineHashMissing: !args.postClosureWatchTimelineHash,
    },
    customerSafeCopy: "Final supervisory closure is monitored after close; any late mutation/drift signal freezes archive/export channels and opens a reviewed incident before the closure can remain valid.",
    operatorNextActions: canKeepFinalClosureClosed
      ? ["Keep post-closure watch active", "Archive PASS2871 timeline hash with PASS2870 closure audit", "Escalate any new mutation signal into a freeze ticket"]
      : ["Attach post-closure mutation watch receipt", "Review mutation signals", "Auto-freeze affected archive/export channels", "Open mutation incident ticket with owner/SLA", "Attach notice decisions and timeline hash"],
  };
}
