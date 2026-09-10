import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2862CustomerExportSupervisoryRetentionPurgeTombstoneGate } from "@/lib/market-integrity/top1-customer-export-supervisory-retention-purge-tombstone-gate";

export type Pass2863CustomerExportSupervisoryPostPurgeResidualEvidenceScanState =
  | "supervisory_purge_tombstone_not_ready"
  | "legal_hold_recheck_failed"
  | "residual_scanner_run_missing"
  | "residual_scan_manifest_missing"
  | "access_index_purge_verification_missing"
  | "channel_cache_purge_receipt_missing"
  | "residual_evidence_detected"
  | "residual_remediation_ticket_missing"
  | "final_no_residual_attestation_missing"
  | "privacy_legal_signoff_missing"
  | "supervisory_post_purge_timeline_missing"
  | "supervisory_post_purge_residual_evidence_scan_ready";

export type Pass2863CustomerExportSupervisoryResidualScanChannel =
  | "regulator_access_index"
  | "auditor_access_index"
  | "support_attachment_cache"
  | "legal_case_cache"
  | "operator_console_cache"
  | "secure_vault_index";

export type Pass2863CustomerExportSupervisoryResidualScanReceipt = {
  channel: Pass2863CustomerExportSupervisoryResidualScanChannel;
  residualScanReceiptId: string | null;
  cachePurgeReceiptId: string | null;
  tombstoneVerificationReceiptId: string | null;
  residualItemCount: number;
  scannedAt: string | null;
};

export type Pass2863CustomerExportSupervisoryPostPurgeResidualEvidenceScanGate = {
  schemaVersion: "pass2863_customer_export_supervisory_post_purge_residual_evidence_scan_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  supervisoryPostPurgeResidualEvidenceScanState: Pass2863CustomerExportSupervisoryPostPurgeResidualEvidenceScanState;
  supervisoryPostPurgeResidualEvidenceScanReadinessScore: number;
  supervisoryPostPurgeResidualEvidenceScanEnvelope: {
    previousSupervisoryRetentionPurgeTombstoneState: string;
    previousSupervisoryRetentionPurgeTombstoneReadinessScore: number;
    previousCanExecuteSupervisoryRetentionPurge: boolean;
    previousCanPublishSupervisoryRetentionTombstone: boolean;
    previousSupervisoryTombstoneManifestHash: string | null;
    previousSupervisoryTombstoneVerificationReceiptId: string | null;
    previousPostPurgeReconciliationHash: string | null;
    legalHoldRecheckReceiptId: string | null;
    postPurgeLegalHoldActive: boolean;
    postPurgeAccessExtensionActive: boolean;
    residualScannerRunId: string | null;
    residualScanManifestHash: string | null;
    regulatorAuditorAccessIndexPurgeVerificationReceiptId: string | null;
    supportLegalOperatorCachePurgeBatchReceiptId: string | null;
    residualEvidenceDetected: boolean;
    residualFindingRemediationTicketId: string | null;
    finalNoResidualAttestationReceiptId: string | null;
    privacyLegalSignoffReceiptId: string | null;
    supervisoryPostPurgeResidualTimelineHash: string | null;
    channelResidualScanReceipts: Pass2863CustomerExportSupervisoryResidualScanReceipt[];
  };
  supervisoryPostPurgeResidualEvidenceScanPolicy: {
    canMarkSupervisoryPurgePrivacyClosed: boolean;
    canReuseCustomerPostPurgePrivacyAttestation: false;
    canServeRegulatorAuditorEvidenceAfterPurge: false;
    canClaimProductionSupervisoryResidualScan: false;
    reason: string;
  };
  supervisoryPostPurgeResidualEvidenceScanRiskSignals: {
    previousSupervisoryPurgeTombstoneNotReady: boolean;
    legalHoldRecheckFailed: boolean;
    missingResidualScannerRun: boolean;
    missingResidualScanManifest: boolean;
    missingAccessIndexPurgeVerification: boolean;
    missingChannelCachePurgeReceipt: boolean;
    residualEvidenceDetected: boolean;
    missingResidualRemediationTicket: boolean;
    missingFinalNoResidualAttestation: boolean;
    missingPrivacyLegalSignoff: boolean;
    missingSupervisoryPostPurgeTimeline: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2863_CUSTOMER_EXPORT_SUPERVISORY_POST_PURGE_RESIDUAL_EVIDENCE_SCAN_ACCEPTANCE_GATES = [
  "PASS2863: Supervisory retention purge/tombstone completion is not the same as no-residual supervisory privacy close.",
  "PASS2863: Post-purge residual scanning must re-check legal hold/access extension and must scan regulator index, auditor index, support/legal/operator caches and secure-vault index.",
  "PASS2863: Regulator/auditor access-index purge verification and support/legal/operator cache purge batch receipt are mandatory before no-residual attestation.",
  "PASS2863: Any residual regulator/auditor evidence finding freezes supervisory privacy-close until a remediation ticket, rescan and timeline hash exist.",
  "PASS2863: This is a deterministic contract/API/schema boundary; production claims still require live residual scanners, durable cache/index purge receipts, legal-hold workflow, alerting and monitored operator UI.",
] as const;

const REQUIRED_CHANNELS: Pass2863CustomerExportSupervisoryResidualScanChannel[] = [
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

function normalizeResidualScanReceipts(receipts?: Pass2863CustomerExportSupervisoryResidualScanReceipt[] | null) {
  return REQUIRED_CHANNELS.map((channel) => {
    const found = receipts?.find((receipt) => receipt.channel === channel);
    return {
      channel,
      residualScanReceiptId: found?.residualScanReceiptId ?? null,
      cachePurgeReceiptId: found?.cachePurgeReceiptId ?? null,
      tombstoneVerificationReceiptId: found?.tombstoneVerificationReceiptId ?? null,
      residualItemCount: Math.max(0, Number(found?.residualItemCount ?? 0)),
      scannedAt: found?.scannedAt ?? null,
    } satisfies Pass2863CustomerExportSupervisoryResidualScanReceipt;
  });
}

export function buildPass2863CustomerExportSupervisoryPostPurgeResidualEvidenceScanGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportSupervisoryRetentionPurgeTombstoneGate: Pass2862CustomerExportSupervisoryRetentionPurgeTombstoneGate;
  generatedAt?: string;
  legalHoldRecheckReceiptId?: string | null;
  postPurgeLegalHoldActive?: boolean;
  postPurgeAccessExtensionActive?: boolean;
  residualScannerRunId?: string | null;
  residualScanManifestHash?: string | null;
  regulatorAuditorAccessIndexPurgeVerificationReceiptId?: string | null;
  supportLegalOperatorCachePurgeBatchReceiptId?: string | null;
  residualEvidenceDetected?: boolean;
  residualFindingRemediationTicketId?: string | null;
  finalNoResidualAttestationReceiptId?: string | null;
  privacyLegalSignoffReceiptId?: string | null;
  supervisoryPostPurgeResidualTimelineHash?: string | null;
  channelResidualScanReceipts?: Pass2863CustomerExportSupervisoryResidualScanReceipt[] | null;
}): Pass2863CustomerExportSupervisoryPostPurgeResidualEvidenceScanGate {
  const previousGate = args.customerExportSupervisoryRetentionPurgeTombstoneGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(
    previousGate.supervisoryRetentionPurgeTombstoneState === "supervisory_retention_purge_tombstone_ready" &&
      previousGate.supervisoryRetentionPurgeTombstonePolicy.canExecuteSupervisoryRetentionPurge &&
      previousGate.supervisoryRetentionPurgeTombstonePolicy.canPublishSupervisoryRetentionTombstone,
  );
  const legalHoldRechecked = Boolean(args.legalHoldRecheckReceiptId && !args.postPurgeLegalHoldActive && !args.postPurgeAccessExtensionActive);
  const residualEvidenceDetected = Boolean(args.residualEvidenceDetected);
  const residualRemediationSatisfied = !residualEvidenceDetected || Boolean(args.residualFindingRemediationTicketId);
  const channelResidualScanReceipts = normalizeResidualScanReceipts(args.channelResidualScanReceipts);
  const channelCachePurgeReady = channelResidualScanReceipts.every((receipt) =>
    Boolean(
      receipt.residualScanReceiptId &&
        receipt.cachePurgeReceiptId &&
        receipt.tombstoneVerificationReceiptId &&
        receipt.scannedAt &&
        receipt.residualItemCount === 0,
    ),
  );

  const ready = Boolean(
    previousReady &&
      legalHoldRechecked &&
      args.residualScannerRunId &&
      args.residualScanManifestHash &&
      args.regulatorAuditorAccessIndexPurgeVerificationReceiptId &&
      args.supportLegalOperatorCachePurgeBatchReceiptId &&
      channelCachePurgeReady &&
      !residualEvidenceDetected &&
      residualRemediationSatisfied &&
      args.finalNoResidualAttestationReceiptId &&
      args.privacyLegalSignoffReceiptId &&
      args.supervisoryPostPurgeResidualTimelineHash,
  );

  const supervisoryPostPurgeResidualEvidenceScanState: Pass2863CustomerExportSupervisoryPostPurgeResidualEvidenceScanState = !previousReady
    ? "supervisory_purge_tombstone_not_ready"
    : !legalHoldRechecked
      ? "legal_hold_recheck_failed"
      : !args.residualScannerRunId
        ? "residual_scanner_run_missing"
        : !args.residualScanManifestHash
          ? "residual_scan_manifest_missing"
          : !args.regulatorAuditorAccessIndexPurgeVerificationReceiptId
            ? "access_index_purge_verification_missing"
            : !args.supportLegalOperatorCachePurgeBatchReceiptId || !channelCachePurgeReady
              ? "channel_cache_purge_receipt_missing"
              : residualEvidenceDetected
                ? "residual_evidence_detected"
                : !residualRemediationSatisfied
                  ? "residual_remediation_ticket_missing"
                  : !args.finalNoResidualAttestationReceiptId
                    ? "final_no_residual_attestation_missing"
                    : !args.privacyLegalSignoffReceiptId
                      ? "privacy_legal_signoff_missing"
                      : !args.supervisoryPostPurgeResidualTimelineHash
                        ? "supervisory_post_purge_timeline_missing"
                        : "supervisory_post_purge_residual_evidence_scan_ready";

  const supervisoryPostPurgeResidualEvidenceScanReadinessScore = clamp(
    previousGate.supervisoryRetentionPurgeTombstoneReadinessScore +
      (previousReady ? 7 : -46) +
      (legalHoldRechecked ? 10 : -28) +
      (args.residualScannerRunId ? 10 : -16) +
      (args.residualScanManifestHash ? 9 : -14) +
      (args.regulatorAuditorAccessIndexPurgeVerificationReceiptId ? 10 : -16) +
      (args.supportLegalOperatorCachePurgeBatchReceiptId ? 8 : -14) +
      (channelCachePurgeReady ? 16 : -22) -
      (residualEvidenceDetected ? 50 : 0) +
      (residualRemediationSatisfied ? 4 : -18) +
      (args.finalNoResidualAttestationReceiptId ? 11 : -15) +
      (args.privacyLegalSignoffReceiptId ? 9 : -14) +
      (args.supervisoryPostPurgeResidualTimelineHash ? 10 : -15),
  );

  const reason = ready
    ? "Supervisory post-purge residual evidence scan is ready: tombstone proof is followed by legal-hold recheck, access-index/cache purge verification, zero-residual scans, no-residual attestation and timeline hash."
    : `Supervisory post-purge residual evidence scan is blocked at ${supervisoryPostPurgeResidualEvidenceScanState}.`;

  const operatorNextActions = [
    !previousReady ? "Complete PASS2862 supervisory purge/tombstone gate before residual scanning." : null,
    !legalHoldRechecked ? "Re-check legal hold/access extension after purge and attach receipt." : null,
    !args.residualScannerRunId ? "Run supervisory post-purge residual evidence scanner." : null,
    !args.residualScanManifestHash ? "Attach supervisory residual scan manifest hash." : null,
    !args.regulatorAuditorAccessIndexPurgeVerificationReceiptId ? "Attach regulator/auditor access-index purge verification receipt." : null,
    !args.supportLegalOperatorCachePurgeBatchReceiptId ? "Attach support/legal/operator cache purge batch receipt." : null,
    !channelCachePurgeReady ? "Collect zero-residual scan and cache purge receipts for regulator index, auditor index, support, legal, operator console and secure vault." : null,
    residualEvidenceDetected ? "Keep supervisory privacy close frozen and open residual finding remediation." : null,
    residualEvidenceDetected && !args.residualFindingRemediationTicketId ? "Create residual finding remediation ticket." : null,
    !args.finalNoResidualAttestationReceiptId ? "Attach final no-residual attestation receipt." : null,
    !args.privacyLegalSignoffReceiptId ? "Collect privacy/legal signoff." : null,
    !args.supervisoryPostPurgeResidualTimelineHash ? "Record supervisory post-purge residual timeline hash." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2863_customer_export_supervisory_post_purge_residual_evidence_scan_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    supervisoryPostPurgeResidualEvidenceScanState,
    supervisoryPostPurgeResidualEvidenceScanReadinessScore,
    supervisoryPostPurgeResidualEvidenceScanEnvelope: {
      previousSupervisoryRetentionPurgeTombstoneState: previousGate.supervisoryRetentionPurgeTombstoneState,
      previousSupervisoryRetentionPurgeTombstoneReadinessScore: previousGate.supervisoryRetentionPurgeTombstoneReadinessScore,
      previousCanExecuteSupervisoryRetentionPurge: previousGate.supervisoryRetentionPurgeTombstonePolicy.canExecuteSupervisoryRetentionPurge,
      previousCanPublishSupervisoryRetentionTombstone: previousGate.supervisoryRetentionPurgeTombstonePolicy.canPublishSupervisoryRetentionTombstone,
      previousSupervisoryTombstoneManifestHash: previousGate.supervisoryRetentionPurgeTombstoneEnvelope.supervisoryTombstoneManifestHash,
      previousSupervisoryTombstoneVerificationReceiptId: previousGate.supervisoryRetentionPurgeTombstoneEnvelope.supervisoryTombstoneVerificationReceiptId,
      previousPostPurgeReconciliationHash: previousGate.supervisoryRetentionPurgeTombstoneEnvelope.postPurgeReconciliationHash,
      legalHoldRecheckReceiptId: args.legalHoldRecheckReceiptId ?? null,
      postPurgeLegalHoldActive: Boolean(args.postPurgeLegalHoldActive),
      postPurgeAccessExtensionActive: Boolean(args.postPurgeAccessExtensionActive),
      residualScannerRunId: args.residualScannerRunId ?? null,
      residualScanManifestHash: args.residualScanManifestHash ?? null,
      regulatorAuditorAccessIndexPurgeVerificationReceiptId: args.regulatorAuditorAccessIndexPurgeVerificationReceiptId ?? null,
      supportLegalOperatorCachePurgeBatchReceiptId: args.supportLegalOperatorCachePurgeBatchReceiptId ?? null,
      residualEvidenceDetected,
      residualFindingRemediationTicketId: args.residualFindingRemediationTicketId ?? null,
      finalNoResidualAttestationReceiptId: args.finalNoResidualAttestationReceiptId ?? null,
      privacyLegalSignoffReceiptId: args.privacyLegalSignoffReceiptId ?? null,
      supervisoryPostPurgeResidualTimelineHash: args.supervisoryPostPurgeResidualTimelineHash ?? null,
      channelResidualScanReceipts,
    },
    supervisoryPostPurgeResidualEvidenceScanPolicy: {
      canMarkSupervisoryPurgePrivacyClosed: ready,
      canReuseCustomerPostPurgePrivacyAttestation: false,
      canServeRegulatorAuditorEvidenceAfterPurge: false,
      canClaimProductionSupervisoryResidualScan: false,
      reason,
    },
    supervisoryPostPurgeResidualEvidenceScanRiskSignals: {
      previousSupervisoryPurgeTombstoneNotReady: !previousReady,
      legalHoldRecheckFailed: !legalHoldRechecked,
      missingResidualScannerRun: !args.residualScannerRunId,
      missingResidualScanManifest: !args.residualScanManifestHash,
      missingAccessIndexPurgeVerification: !args.regulatorAuditorAccessIndexPurgeVerificationReceiptId,
      missingChannelCachePurgeReceipt: !args.supportLegalOperatorCachePurgeBatchReceiptId || !channelCachePurgeReady,
      residualEvidenceDetected,
      missingResidualRemediationTicket: residualEvidenceDetected && !args.residualFindingRemediationTicketId,
      missingFinalNoResidualAttestation: !args.finalNoResidualAttestationReceiptId,
      missingPrivacyLegalSignoff: !args.privacyLegalSignoffReceiptId,
      missingSupervisoryPostPurgeTimeline: !args.supervisoryPostPurgeResidualTimelineHash,
    },
    customerSafeCopy: ready
      ? "Supervisory evidence purge has a post-purge no-residual attestation: legal-hold recheck, access-index/cache purge receipts, zero-residual scans and legal signoff are bound."
      : "Supervisory evidence purge is not privacy-closed until post-purge residual scans, legal-hold recheck, access-index/cache purge receipts, no-residual attestation and legal signoff exist.",
    operatorNextActions,
  };
}
