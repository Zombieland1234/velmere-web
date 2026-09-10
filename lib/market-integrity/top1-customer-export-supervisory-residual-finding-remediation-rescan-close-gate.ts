import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2863CustomerExportSupervisoryPostPurgeResidualEvidenceScanGate } from "@/lib/market-integrity/top1-customer-export-supervisory-post-purge-residual-evidence-scan-gate";

export type Pass2864CustomerExportSupervisoryResidualFindingRemediationRescanCloseState =
  | "supervisory_post_purge_residual_scan_not_ready"
  | "no_residual_carry_forward_receipt_missing"
  | "residual_finding_ticket_missing"
  | "remediation_owner_or_sla_missing"
  | "remediation_fix_receipt_missing"
  | "corrected_rescan_run_missing"
  | "corrected_rescan_manifest_missing"
  | "corrected_rescan_still_has_residuals"
  | "corrected_no_residual_attestation_missing"
  | "regulator_auditor_notice_decision_missing"
  | "regulator_auditor_notice_receipt_missing"
  | "remediation_close_signoff_missing"
  | "supervisory_residual_remediation_timeline_missing"
  | "supervisory_residual_finding_remediation_rescan_close_ready";

export type Pass2864CustomerExportSupervisoryCorrectedRescanChannel =
  | "regulator_access_index"
  | "auditor_access_index"
  | "support_attachment_cache"
  | "legal_case_cache"
  | "operator_console_cache"
  | "secure_vault_index";

export type Pass2864CustomerExportSupervisoryCorrectedRescanReceipt = {
  channel: Pass2864CustomerExportSupervisoryCorrectedRescanChannel;
  correctedResidualScanReceiptId: string | null;
  correctedCachePurgeReceiptId: string | null;
  correctedTombstoneVerificationReceiptId: string | null;
  correctedResidualItemCount: number;
  rescannedAt: string | null;
};

export type Pass2864CustomerExportSupervisoryResidualFindingRemediationRescanCloseGate = {
  schemaVersion: "pass2864_customer_export_supervisory_residual_finding_remediation_rescan_close_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryResidualFindingRemediationRescanCloseState: Pass2864CustomerExportSupervisoryResidualFindingRemediationRescanCloseState;
  supervisoryResidualFindingRemediationRescanCloseReadinessScore: number;
  supervisoryResidualFindingRemediationRescanCloseEnvelope: {
    previousSupervisoryPostPurgeResidualEvidenceScanState: string;
    previousSupervisoryPostPurgeResidualEvidenceScanReadinessScore: number;
    previousCanMarkSupervisoryPurgePrivacyClosed: boolean;
    previousResidualEvidenceDetected: boolean;
    previousResidualFindingRemediationTicketId: string | null;
    previousFinalNoResidualAttestationReceiptId: string | null;
    previousSupervisoryPostPurgeResidualTimelineHash: string | null;
    noResidualCarryForwardReceiptId: string | null;
    residualFindingTicketId: string | null;
    residualFindingSeverity: "none" | "low" | "medium" | "high" | "critical";
    remediationOwnerId: string | null;
    remediationSlaPolicyId: string | null;
    remediationDueAt: string | null;
    remediationFixReceiptId: string | null;
    correctedRescanRunId: string | null;
    correctedRescanManifestHash: string | null;
    correctedNoResidualAttestationReceiptId: string | null;
    regulatorAuditorNoticeDecision: "not_required" | "notify_regulator" | "notify_auditor" | "notify_both" | null;
    regulatorAuditorNoticeReceiptId: string | null;
    remediationCloseSignoffReceiptId: string | null;
    supervisoryResidualRemediationTimelineHash: string | null;
    correctedChannelRescanReceipts: Pass2864CustomerExportSupervisoryCorrectedRescanReceipt[];
  };
  supervisoryResidualFindingRemediationRescanClosePolicy: {
    canCloseResidualFindingRemediation: boolean;
    canLiftSupervisoryPrivacyFreeze: boolean;
    canReuseOriginalNoResidualAttestation: false;
    canClaimProductionResidualRemediation: false;
    reason: string;
  };
  supervisoryResidualFindingRemediationRescanCloseRiskSignals: {
    previousResidualScanNotReady: boolean;
    missingNoResidualCarryForwardReceipt: boolean;
    residualFindingTicketMissing: boolean;
    remediationOwnerOrSlaMissing: boolean;
    remediationFixReceiptMissing: boolean;
    correctedRescanRunMissing: boolean;
    correctedRescanManifestMissing: boolean;
    correctedRescanStillHasResiduals: boolean;
    correctedNoResidualAttestationMissing: boolean;
    regulatorAuditorNoticeDecisionMissing: boolean;
    regulatorAuditorNoticeReceiptMissing: boolean;
    remediationCloseSignoffMissing: boolean;
    missingSupervisoryResidualRemediationTimeline: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2864_CUSTOMER_EXPORT_SUPERVISORY_RESIDUAL_FINDING_REMEDIATION_RESCAN_CLOSE_ACCEPTANCE_GATES = [
  "PASS2864: Supervisory post-purge residual scan is not the same as residual finding remediation close.",
  "PASS2864: Any residual finding requires a ticket lifecycle, owner, SLA policy, fix receipt, corrected re-scan run, corrected manifest and corrected zero-residual channel receipts.",
  "PASS2864: Regulator/auditor notice decisions must be explicit; notify-required decisions require their own channel receipt before close.",
  "PASS2864: A corrected no-residual attestation and remediation close signoff are mandatory before supervisory privacy freeze can be lifted.",
  "PASS2864: This is a deterministic contract/API/schema boundary; production claims still require live remediation workflow, durable scanners, alerting, operator UI and monitored legal/privacy approvals.",
] as const;

const REQUIRED_CHANNELS: Pass2864CustomerExportSupervisoryCorrectedRescanChannel[] = [
  "regulator_access_index",
  "auditor_access_index",
  "support_attachment_cache",
  "legal_case_cache",
  "operator_console_cache",
  "secure_vault_index",
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeCorrectedReceipts(receipts?: Pass2864CustomerExportSupervisoryCorrectedRescanReceipt[] | null) {
  return REQUIRED_CHANNELS.map((channel) => {
    const found = receipts?.find((receipt) => receipt.channel === channel);
    return {
      channel,
      correctedResidualScanReceiptId: found?.correctedResidualScanReceiptId ?? null,
      correctedCachePurgeReceiptId: found?.correctedCachePurgeReceiptId ?? null,
      correctedTombstoneVerificationReceiptId: found?.correctedTombstoneVerificationReceiptId ?? null,
      correctedResidualItemCount: Math.max(0, Number(found?.correctedResidualItemCount ?? 0)),
      rescannedAt: found?.rescannedAt ?? null,
    } satisfies Pass2864CustomerExportSupervisoryCorrectedRescanReceipt;
  });
}

export function buildPass2864CustomerExportSupervisoryResidualFindingRemediationRescanCloseGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryPostPurgeResidualEvidenceScanGate: Pass2863CustomerExportSupervisoryPostPurgeResidualEvidenceScanGate;
  generatedAt?: string;
  noResidualCarryForwardReceiptId?: string | null;
  residualFindingTicketId?: string | null;
  residualFindingSeverity?: "none" | "low" | "medium" | "high" | "critical";
  remediationOwnerId?: string | null;
  remediationSlaPolicyId?: string | null;
  remediationDueAt?: string | null;
  remediationFixReceiptId?: string | null;
  correctedRescanRunId?: string | null;
  correctedRescanManifestHash?: string | null;
  correctedChannelRescanReceipts?: Pass2864CustomerExportSupervisoryCorrectedRescanReceipt[] | null;
  correctedNoResidualAttestationReceiptId?: string | null;
  regulatorAuditorNoticeDecision?: "not_required" | "notify_regulator" | "notify_auditor" | "notify_both" | null;
  regulatorAuditorNoticeReceiptId?: string | null;
  remediationCloseSignoffReceiptId?: string | null;
  supervisoryResidualRemediationTimelineHash?: string | null;
}): Pass2864CustomerExportSupervisoryResidualFindingRemediationRescanCloseGate {
  const previousGate = args.customerExportSupervisoryPostPurgeResidualEvidenceScanGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousPolicyReady = Boolean(previousGate.supervisoryPostPurgeResidualEvidenceScanPolicy.canMarkSupervisoryPurgePrivacyClosed);
  const previousResidualEvidenceDetected = Boolean(previousGate.supervisoryPostPurgeResidualEvidenceScanEnvelope.residualEvidenceDetected);
  const previousSupportsRemediation = previousPolicyReady || previousGate.supervisoryPostPurgeResidualEvidenceScanState === "residual_evidence_detected";
  const remediationRequired = previousResidualEvidenceDetected || Boolean(args.residualFindingTicketId);
  const noResidualCarryForwardReady = !remediationRequired && previousPolicyReady && Boolean(args.noResidualCarryForwardReceiptId);
  const ticketReady = !remediationRequired || Boolean(args.residualFindingTicketId || previousGate.supervisoryPostPurgeResidualEvidenceScanEnvelope.residualFindingRemediationTicketId);
  const ownerSlaReady = !remediationRequired || Boolean(args.remediationOwnerId && args.remediationSlaPolicyId && args.remediationDueAt);
  const fixReady = !remediationRequired || Boolean(args.remediationFixReceiptId);
  const correctedChannelRescanReceipts = normalizeCorrectedReceipts(args.correctedChannelRescanReceipts);
  const correctedChannelsZero = !remediationRequired || correctedChannelRescanReceipts.every((receipt) =>
    Boolean(
      receipt.correctedResidualScanReceiptId &&
        receipt.correctedCachePurgeReceiptId &&
        receipt.correctedTombstoneVerificationReceiptId &&
        receipt.rescannedAt &&
        receipt.correctedResidualItemCount === 0,
    ),
  );
  const noticeDecision = args.regulatorAuditorNoticeDecision ?? null;
  const noticeDecisionReady = !remediationRequired || Boolean(noticeDecision);
  const noticeReceiptReady = !remediationRequired || noticeDecision === "not_required" || Boolean(args.regulatorAuditorNoticeReceiptId);
  const correctedRescanReady = !remediationRequired || Boolean(args.correctedRescanRunId && args.correctedRescanManifestHash && correctedChannelsZero);
  const ready = Boolean(
    previousSupportsRemediation &&
      (noResidualCarryForwardReady ||
        (remediationRequired &&
          ticketReady &&
          ownerSlaReady &&
          fixReady &&
          correctedRescanReady &&
          args.correctedNoResidualAttestationReceiptId &&
          noticeDecisionReady &&
          noticeReceiptReady &&
          args.remediationCloseSignoffReceiptId &&
          args.supervisoryResidualRemediationTimelineHash)),
  );

  const state: Pass2864CustomerExportSupervisoryResidualFindingRemediationRescanCloseState = !previousSupportsRemediation
    ? "supervisory_post_purge_residual_scan_not_ready"
    : !remediationRequired && !args.noResidualCarryForwardReceiptId
      ? "no_residual_carry_forward_receipt_missing"
      : remediationRequired && !ticketReady
        ? "residual_finding_ticket_missing"
        : remediationRequired && !ownerSlaReady
          ? "remediation_owner_or_sla_missing"
          : remediationRequired && !fixReady
            ? "remediation_fix_receipt_missing"
            : remediationRequired && !args.correctedRescanRunId
              ? "corrected_rescan_run_missing"
              : remediationRequired && !args.correctedRescanManifestHash
                ? "corrected_rescan_manifest_missing"
                : remediationRequired && !correctedChannelsZero
                  ? "corrected_rescan_still_has_residuals"
                  : remediationRequired && !args.correctedNoResidualAttestationReceiptId
                    ? "corrected_no_residual_attestation_missing"
                    : remediationRequired && !noticeDecisionReady
                      ? "regulator_auditor_notice_decision_missing"
                      : remediationRequired && !noticeReceiptReady
                        ? "regulator_auditor_notice_receipt_missing"
                        : remediationRequired && !args.remediationCloseSignoffReceiptId
                          ? "remediation_close_signoff_missing"
                          : remediationRequired && !args.supervisoryResidualRemediationTimelineHash
                            ? "supervisory_residual_remediation_timeline_missing"
                            : "supervisory_residual_finding_remediation_rescan_close_ready";

  const readiness = clamp(
    previousGate.supervisoryPostPurgeResidualEvidenceScanReadinessScore +
      (previousSupportsRemediation ? 8 : -45) +
      (noResidualCarryForwardReady ? 24 : 0) +
      (remediationRequired ? 4 : 0) +
      (ticketReady ? 8 : -18) +
      (ownerSlaReady ? 10 : -18) +
      (fixReady ? 12 : -18) +
      (args.correctedRescanRunId ? 10 : remediationRequired ? -15 : 0) +
      (args.correctedRescanManifestHash ? 8 : remediationRequired ? -13 : 0) +
      (correctedChannelsZero ? 14 : remediationRequired ? -24 : 0) +
      (args.correctedNoResidualAttestationReceiptId ? 11 : remediationRequired ? -15 : 0) +
      (noticeDecisionReady ? 6 : remediationRequired ? -10 : 0) +
      (noticeReceiptReady ? 6 : remediationRequired ? -10 : 0) +
      (args.remediationCloseSignoffReceiptId ? 9 : remediationRequired ? -12 : 0) +
      (args.supervisoryResidualRemediationTimelineHash ? 10 : remediationRequired ? -13 : 0),
  );

  const reason = ready
    ? remediationRequired
      ? "Supervisory residual finding remediation is ready: ticket, owner/SLA, fix, corrected re-scan, corrected no-residual attestation, notice decision and close timeline are bound."
      : "Supervisory residual finding remediation is ready by no-residual carry-forward: previous scan was clean and the carry-forward receipt is bound."
    : `Supervisory residual finding remediation is blocked at ${state}.`;

  const operatorNextActions = [
    !previousSupportsRemediation ? "Complete PASS2863 post-purge residual scan or carry a residual finding state before remediation close." : null,
    !remediationRequired && !args.noResidualCarryForwardReceiptId ? "Attach no-residual carry-forward receipt when no residual finding exists." : null,
    remediationRequired && !ticketReady ? "Create or bind residual finding remediation ticket." : null,
    remediationRequired && !ownerSlaReady ? "Assign remediation owner, SLA policy and due date." : null,
    remediationRequired && !fixReady ? "Attach remediation fix receipt." : null,
    remediationRequired && !args.correctedRescanRunId ? "Run corrected supervisory residual re-scan after remediation fix." : null,
    remediationRequired && !args.correctedRescanManifestHash ? "Attach corrected residual re-scan manifest hash." : null,
    remediationRequired && !correctedChannelsZero ? "Collect zero-residual corrected channel receipts for regulator/auditor/support/legal/operator/secure-vault surfaces." : null,
    remediationRequired && !args.correctedNoResidualAttestationReceiptId ? "Attach corrected no-residual attestation receipt." : null,
    remediationRequired && !noticeDecisionReady ? "Record regulator/auditor notice decision." : null,
    remediationRequired && !noticeReceiptReady ? "Attach regulator/auditor notice receipt for required notice decision." : null,
    remediationRequired && !args.remediationCloseSignoffReceiptId ? "Collect remediation close signoff." : null,
    remediationRequired && !args.supervisoryResidualRemediationTimelineHash ? "Hash supervisory residual remediation timeline." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2864_customer_export_supervisory_residual_finding_remediation_rescan_close_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryResidualFindingRemediationRescanCloseState: state,
    supervisoryResidualFindingRemediationRescanCloseReadinessScore: readiness,
    supervisoryResidualFindingRemediationRescanCloseEnvelope: {
      previousSupervisoryPostPurgeResidualEvidenceScanState: previousGate.supervisoryPostPurgeResidualEvidenceScanState,
      previousSupervisoryPostPurgeResidualEvidenceScanReadinessScore: previousGate.supervisoryPostPurgeResidualEvidenceScanReadinessScore,
      previousCanMarkSupervisoryPurgePrivacyClosed: previousPolicyReady,
      previousResidualEvidenceDetected,
      previousResidualFindingRemediationTicketId: previousGate.supervisoryPostPurgeResidualEvidenceScanEnvelope.residualFindingRemediationTicketId,
      previousFinalNoResidualAttestationReceiptId: previousGate.supervisoryPostPurgeResidualEvidenceScanEnvelope.finalNoResidualAttestationReceiptId,
      previousSupervisoryPostPurgeResidualTimelineHash: previousGate.supervisoryPostPurgeResidualEvidenceScanEnvelope.supervisoryPostPurgeResidualTimelineHash,
      noResidualCarryForwardReceiptId: args.noResidualCarryForwardReceiptId ?? null,
      residualFindingTicketId: args.residualFindingTicketId ?? previousGate.supervisoryPostPurgeResidualEvidenceScanEnvelope.residualFindingRemediationTicketId ?? null,
      residualFindingSeverity: args.residualFindingSeverity ?? (remediationRequired ? "medium" : "none"),
      remediationOwnerId: args.remediationOwnerId ?? null,
      remediationSlaPolicyId: args.remediationSlaPolicyId ?? null,
      remediationDueAt: args.remediationDueAt ?? null,
      remediationFixReceiptId: args.remediationFixReceiptId ?? null,
      correctedRescanRunId: args.correctedRescanRunId ?? null,
      correctedRescanManifestHash: args.correctedRescanManifestHash ?? null,
      correctedNoResidualAttestationReceiptId: args.correctedNoResidualAttestationReceiptId ?? null,
      regulatorAuditorNoticeDecision: noticeDecision,
      regulatorAuditorNoticeReceiptId: args.regulatorAuditorNoticeReceiptId ?? null,
      remediationCloseSignoffReceiptId: args.remediationCloseSignoffReceiptId ?? null,
      supervisoryResidualRemediationTimelineHash: args.supervisoryResidualRemediationTimelineHash ?? null,
      correctedChannelRescanReceipts,
    },
    supervisoryResidualFindingRemediationRescanClosePolicy: {
      canCloseResidualFindingRemediation: ready,
      canLiftSupervisoryPrivacyFreeze: ready,
      canReuseOriginalNoResidualAttestation: false,
      canClaimProductionResidualRemediation: false,
      reason,
    },
    supervisoryResidualFindingRemediationRescanCloseRiskSignals: {
      previousResidualScanNotReady: !previousSupportsRemediation,
      missingNoResidualCarryForwardReceipt: !remediationRequired && !args.noResidualCarryForwardReceiptId,
      residualFindingTicketMissing: remediationRequired && !ticketReady,
      remediationOwnerOrSlaMissing: remediationRequired && !ownerSlaReady,
      remediationFixReceiptMissing: remediationRequired && !fixReady,
      correctedRescanRunMissing: remediationRequired && !args.correctedRescanRunId,
      correctedRescanManifestMissing: remediationRequired && !args.correctedRescanManifestHash,
      correctedRescanStillHasResiduals: remediationRequired && !correctedChannelsZero,
      correctedNoResidualAttestationMissing: remediationRequired && !args.correctedNoResidualAttestationReceiptId,
      regulatorAuditorNoticeDecisionMissing: remediationRequired && !noticeDecisionReady,
      regulatorAuditorNoticeReceiptMissing: remediationRequired && !noticeReceiptReady,
      remediationCloseSignoffMissing: remediationRequired && !args.remediationCloseSignoffReceiptId,
      missingSupervisoryResidualRemediationTimeline: remediationRequired && !args.supervisoryResidualRemediationTimelineHash,
    },
    customerSafeCopy: ready
      ? "Supervisory residual finding remediation is closed with ticket/SLA, fix receipt, corrected re-scan, corrected no-residual attestation and notice decision binding."
      : "Supervisory residual findings keep supervisory privacy close frozen until ticket ownership, SLA, fix, corrected re-scan, corrected no-residual attestation, notice decision and close signoff exist.",
    operatorNextActions,
  };
}
