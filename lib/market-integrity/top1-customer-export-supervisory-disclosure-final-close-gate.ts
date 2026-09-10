import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2859CustomerExportSupervisoryDisclosureResponseCorrectionGate } from "@/lib/market-integrity/top1-customer-export-supervisory-disclosure-response-correction-gate";

export type Pass2860CustomerExportSupervisoryDisclosureFinalCloseState =
  | "supervisory_response_correction_not_ready"
  | "supervisory_final_close_case_id_missing"
  | "final_response_closure_receipt_missing"
  | "evidence_retention_lock_receipt_missing"
  | "retention_policy_snapshot_missing"
  | "response_correction_version_index_missing"
  | "final_channel_ack_receipt_missing"
  | "customer_notice_final_decision_missing"
  | "immutable_supervisory_timeline_hash_missing"
  | "archive_mutation_attempted_after_close"
  | "supervisory_disclosure_final_close_ready";

export type Pass2860CustomerExportSupervisoryFinalCloseChannel = "secure_vault" | "legal" | "regulator" | "auditor" | "operator_console";

export type Pass2860CustomerExportSupervisoryFinalChannelAckReceipt = {
  channel: Pass2860CustomerExportSupervisoryFinalCloseChannel;
  channelAckReceiptId: string;
  finalPacketId: string;
  evidenceRetentionLockReceiptId: string;
  acknowledgedAt: string;
  acknowledgedByRecipient: boolean;
};

export type Pass2860CustomerExportSupervisoryDisclosureFinalCloseGate = {
  schemaVersion: "pass2860_customer_export_supervisory_disclosure_final_close_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryDisclosureFinalCloseState: Pass2860CustomerExportSupervisoryDisclosureFinalCloseState;
  supervisoryDisclosureFinalCloseReadinessScore: number;
  supervisoryDisclosureFinalCloseEnvelope: {
    previousSupervisoryDisclosureResponseCorrectionState: string;
    previousSupervisoryDisclosureResponseCorrectionReadinessScore: number;
    previousCanReleaseSupervisoryDisclosureResponsePacket: boolean;
    supervisoryFinalCloseCaseId: string | null;
    finalResponseClosureReceiptId: string | null;
    evidenceRetentionLockReceiptId: string | null;
    retentionPolicySnapshotHash: string | null;
    responseCorrectionVersionIndexHash: string | null;
    finalChannelAckReceipts: Pass2860CustomerExportSupervisoryFinalChannelAckReceipt[];
    customerNoticeFinalDecisionReceiptId: string | null;
    customerNoticeSuppressedReason: string | null;
    exportFreezeReceiptId: string | null;
    immutableSupervisoryTimelineHash: string | null;
    archiveMutationAttemptedAfterClose: boolean;
  };
  supervisoryDisclosureFinalClosePolicy: {
    canCloseSupervisoryDisclosureCase: boolean;
    canUnlockSupervisoryEvidenceRetentionLock: boolean;
    canMutateClosedSupervisoryArchive: false;
    canClaimProductionSupervisoryFinalCloseWorkflow: false;
    reason: string;
  };
  supervisoryDisclosureFinalCloseRiskSignals: {
    previousSupervisoryResponseCorrectionNotReady: boolean;
    missingSupervisoryFinalCloseCaseId: boolean;
    missingFinalResponseClosureReceipt: boolean;
    missingEvidenceRetentionLockReceipt: boolean;
    missingRetentionPolicySnapshot: boolean;
    missingResponseCorrectionVersionIndex: boolean;
    missingFinalChannelAckReceipt: boolean;
    missingCustomerNoticeFinalDecision: boolean;
    missingImmutableSupervisoryTimelineHash: boolean;
    archiveMutationAttemptedAfterClose: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2860_CUSTOMER_EXPORT_SUPERVISORY_DISCLOSURE_FINAL_CLOSE_ACCEPTANCE_GATES = [
  "PASS2860: Supervisory response/correction release is not the same as final supervisory case close.",
  "PASS2860: Final close requires a supervisory close case ID, final response closure receipt, evidence-retention lock receipt, retention policy snapshot and response/correction version index.",
  "PASS2860: Final channel acknowledgements must be separate from initial disclosure/response receipts and must bind the final packet to the evidence-retention lock.",
  "PASS2860: Closed supervisory archives cannot be mutated; corrections after close require a new response/correction case, not in-place archive edits.",
  "PASS2860: This remains a deterministic contract/API boundary. Production claims require durable supervisory case rows, legal-retention locks, immutable archive storage, recipient acknowledgement storage and monitored retention jobs.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2860CustomerExportSupervisoryDisclosureFinalCloseGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryDisclosureResponseCorrectionGate: Pass2859CustomerExportSupervisoryDisclosureResponseCorrectionGate;
  generatedAt?: string;
  supervisoryFinalCloseCaseId?: string | null;
  finalResponseClosureReceiptId?: string | null;
  evidenceRetentionLockReceiptId?: string | null;
  retentionPolicySnapshotHash?: string | null;
  responseCorrectionVersionIndexHash?: string | null;
  finalChannelAckReceipts?: Pass2860CustomerExportSupervisoryFinalChannelAckReceipt[];
  customerNoticeFinalDecisionReceiptId?: string | null;
  customerNoticeSuppressedReason?: string | null;
  exportFreezeReceiptId?: string | null;
  immutableSupervisoryTimelineHash?: string | null;
  archiveMutationAttemptedAfterClose?: boolean;
}): Pass2860CustomerExportSupervisoryDisclosureFinalCloseGate {
  const previousGate = args.customerExportSupervisoryDisclosureResponseCorrectionGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = previousGate.supervisoryDisclosureResponseCorrectionState === "supervisory_disclosure_response_correction_ready";
  const finalChannelAckReceipts = args.finalChannelAckReceipts ?? [];
  const closeCaseReady = Boolean(args.supervisoryFinalCloseCaseId);
  const closureReceiptReady = Boolean(args.finalResponseClosureReceiptId);
  const retentionLockReady = Boolean(args.evidenceRetentionLockReceiptId);
  const retentionSnapshotReady = Boolean(args.retentionPolicySnapshotHash);
  const versionIndexReady = Boolean(args.responseCorrectionVersionIndexHash);
  const finalChannelAckReady = finalChannelAckReceipts.length > 0 && finalChannelAckReceipts.every((receipt) => Boolean(receipt.channelAckReceiptId && receipt.finalPacketId && receipt.evidenceRetentionLockReceiptId && receipt.acknowledgedAt && receipt.acknowledgedByRecipient));
  const finalNoticeReady = Boolean(args.customerNoticeFinalDecisionReceiptId || args.customerNoticeSuppressedReason);
  const timelineReady = Boolean(args.immutableSupervisoryTimelineHash);
  const archiveMutationAttemptedAfterClose = Boolean(args.archiveMutationAttemptedAfterClose);

  const ready = Boolean(
    previousReady &&
      closeCaseReady &&
      closureReceiptReady &&
      retentionLockReady &&
      retentionSnapshotReady &&
      versionIndexReady &&
      finalChannelAckReady &&
      finalNoticeReady &&
      timelineReady &&
      !archiveMutationAttemptedAfterClose,
  );

  const supervisoryDisclosureFinalCloseState: Pass2860CustomerExportSupervisoryDisclosureFinalCloseState = !previousReady
    ? "supervisory_response_correction_not_ready"
    : !closeCaseReady
      ? "supervisory_final_close_case_id_missing"
      : !closureReceiptReady
        ? "final_response_closure_receipt_missing"
        : !retentionLockReady
          ? "evidence_retention_lock_receipt_missing"
          : !retentionSnapshotReady
            ? "retention_policy_snapshot_missing"
            : !versionIndexReady
              ? "response_correction_version_index_missing"
              : !finalChannelAckReady
                ? "final_channel_ack_receipt_missing"
                : !finalNoticeReady
                  ? "customer_notice_final_decision_missing"
                  : !timelineReady
                    ? "immutable_supervisory_timeline_hash_missing"
                    : archiveMutationAttemptedAfterClose
                      ? "archive_mutation_attempted_after_close"
                      : "supervisory_disclosure_final_close_ready";

  const supervisoryDisclosureFinalCloseReadinessScore = clamp(
    previousGate.supervisoryDisclosureResponseCorrectionReadinessScore +
      (previousReady ? 8 : -50) +
      (closeCaseReady ? 9 : -16) +
      (closureReceiptReady ? 9 : -16) +
      (retentionLockReady ? 10 : -18) +
      (retentionSnapshotReady ? 8 : -14) +
      (versionIndexReady ? 9 : -16) +
      (finalChannelAckReady ? 9 : -16) +
      (finalNoticeReady ? 7 : -12) +
      (timelineReady ? 8 : -14) +
      (!archiveMutationAttemptedAfterClose ? 10 : -45),
  );

  const reason = ready
    ? "Supervisory disclosure can be closed in this deterministic boundary because the response/correction case is final-closure receipted, retention-locked, version-indexed, final-channel acknowledged and immutable-timeline bound."
    : `Supervisory disclosure final close boundary blocked at ${supervisoryDisclosureFinalCloseState}.`;

  return {
    schemaVersion: "pass2860_customer_export_supervisory_disclosure_final_close_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryDisclosureFinalCloseState,
    supervisoryDisclosureFinalCloseReadinessScore,
    supervisoryDisclosureFinalCloseEnvelope: {
      previousSupervisoryDisclosureResponseCorrectionState: previousGate.supervisoryDisclosureResponseCorrectionState,
      previousSupervisoryDisclosureResponseCorrectionReadinessScore: previousGate.supervisoryDisclosureResponseCorrectionReadinessScore,
      previousCanReleaseSupervisoryDisclosureResponsePacket: previousGate.supervisoryDisclosureResponseCorrectionPolicy.canReleaseSupervisoryDisclosureResponsePacket,
      supervisoryFinalCloseCaseId: args.supervisoryFinalCloseCaseId ?? null,
      finalResponseClosureReceiptId: args.finalResponseClosureReceiptId ?? null,
      evidenceRetentionLockReceiptId: args.evidenceRetentionLockReceiptId ?? null,
      retentionPolicySnapshotHash: args.retentionPolicySnapshotHash ?? null,
      responseCorrectionVersionIndexHash: args.responseCorrectionVersionIndexHash ?? null,
      finalChannelAckReceipts,
      customerNoticeFinalDecisionReceiptId: args.customerNoticeFinalDecisionReceiptId ?? null,
      customerNoticeSuppressedReason: args.customerNoticeSuppressedReason ?? null,
      exportFreezeReceiptId: args.exportFreezeReceiptId ?? null,
      immutableSupervisoryTimelineHash: args.immutableSupervisoryTimelineHash ?? null,
      archiveMutationAttemptedAfterClose,
    },
    supervisoryDisclosureFinalClosePolicy: {
      canCloseSupervisoryDisclosureCase: ready,
      canUnlockSupervisoryEvidenceRetentionLock: ready,
      canMutateClosedSupervisoryArchive: false,
      canClaimProductionSupervisoryFinalCloseWorkflow: false,
      reason,
    },
    supervisoryDisclosureFinalCloseRiskSignals: {
      previousSupervisoryResponseCorrectionNotReady: !previousReady,
      missingSupervisoryFinalCloseCaseId: !closeCaseReady,
      missingFinalResponseClosureReceipt: !closureReceiptReady,
      missingEvidenceRetentionLockReceipt: !retentionLockReady,
      missingRetentionPolicySnapshot: !retentionSnapshotReady,
      missingResponseCorrectionVersionIndex: !versionIndexReady,
      missingFinalChannelAckReceipt: !finalChannelAckReady,
      missingCustomerNoticeFinalDecision: !finalNoticeReady,
      missingImmutableSupervisoryTimelineHash: !timelineReady,
      archiveMutationAttemptedAfterClose,
    },
    customerSafeCopy: ready
      ? "A regulator/auditor disclosure response can be closed with a retention lock and final acknowledgement. Any later correction must open a new case, not mutate the closed archive."
      : "Supervisory disclosure final close is blocked until final closure, retention lock, version index, final channel acknowledgement, customer notice decision and immutable timeline proof are complete.",
    operatorNextActions: ready
      ? [
          "Persist the final close row and evidence-retention lock before claiming production supervisory close.",
          "Keep the closed archive immutable; route later questions through a new response/correction case.",
          "Monitor legal-retention jobs and recipient acknowledgements against the final case ID.",
        ]
      : [
          "Create the supervisory final close case and attach final response closure receipt.",
          "Attach evidence-retention lock, retention policy snapshot and response/correction version index.",
          "Collect final channel acknowledgement, customer notice decision and immutable supervisory timeline hash before close.",
        ],
  };
}
