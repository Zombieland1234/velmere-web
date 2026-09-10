import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2852CustomerExportRetentionPurgeExecutionTombstoneGate } from "@/lib/market-integrity/top1-customer-export-retention-purge-execution-tombstone-gate";

export type Pass2853CustomerExportPostPurgePrivacyAttestationState =
  | "purge_tombstone_not_ready"
  | "residual_scanner_run_missing"
  | "residual_scan_manifest_missing"
  | "channel_residual_scan_missing"
  | "search_index_purge_receipt_missing"
  | "cdn_cache_purge_receipt_missing"
  | "residual_data_detected"
  | "residual_remediation_ticket_missing"
  | "privacy_attestation_receipt_missing"
  | "privacy_officer_signoff_missing"
  | "customer_final_privacy_notice_missing"
  | "post_purge_privacy_reconciliation_missing"
  | "post_purge_privacy_attestation_ready";

export type Pass2853CustomerExportResidualScanChannel = "account_vault" | "email" | "api" | "support";

export type Pass2853CustomerExportResidualScanReceipt = {
  channel: Pass2853CustomerExportResidualScanChannel;
  residualScanReceiptId: string | null;
  purgeVerificationReceiptId: string | null;
  residualItemCount: number;
  scannedAt: string | null;
};

export type Pass2853CustomerExportPostPurgePrivacyAttestationGate = {
  schemaVersion: "pass2853_customer_export_post_purge_privacy_attestation_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  postPurgePrivacyAttestationState: Pass2853CustomerExportPostPurgePrivacyAttestationState;
  postPurgePrivacyAttestationReadinessScore: number;
  privacyEnvelope: {
    previousPurgeState: string;
    previousPurgeReadinessScore: number;
    previousCanMarkArchiveAsTombstoned: boolean;
    previousCanServeCustomerArchiveAfterPurge: boolean;
    purgeCompletedAt: string | null;
    verifiedArchiveTombstoneId: string | null;
    tombstoneManifestHash: string | null;
    residualScannerRunId: string | null;
    residualScanManifestHash: string | null;
    searchIndexPurgeReceiptId: string | null;
    cdnCachePurgeReceiptId: string | null;
    residualDataDetected: boolean;
    residualDataRemediationTicketId: string | null;
    privacyAttestationReceiptId: string | null;
    privacyOfficerSignoffReceiptId: string | null;
    customerFinalPrivacyNoticeReceiptId: string | null;
    postPurgePrivacyReconciliationHash: string | null;
    channelResidualScanReceipts: Pass2853CustomerExportResidualScanReceipt[];
  };
  privacyPolicy: {
    canMarkCustomerExportPrivacyClosed: boolean;
    canServeCustomerDataAfterPurge: false;
    canClaimProductionPrivacyPurgeWorkflow: false;
    reason: string;
  };
  privacyRiskSignals: {
    purgeTombstoneNotReady: boolean;
    missingResidualScannerRun: boolean;
    missingResidualScanManifest: boolean;
    missingChannelResidualScan: boolean;
    missingSearchIndexPurgeReceipt: boolean;
    missingCdnCachePurgeReceipt: boolean;
    residualDataDetected: boolean;
    missingResidualRemediationTicket: boolean;
    missingPrivacyAttestationReceipt: boolean;
    missingPrivacyOfficerSignoff: boolean;
    missingCustomerFinalPrivacyNotice: boolean;
    missingPostPurgePrivacyReconciliation: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2853_CUSTOMER_EXPORT_POST_PURGE_PRIVACY_ATTESTATION_ACCEPTANCE_GATES = [
  "PASS2853: Purge/tombstone completion is not the same as privacy close; post-purge residual scanning must run across account vault, email, API and support surfaces.",
  "PASS2853: Search indexes and CDN/cache layers require separate purge receipts before customer export data can be considered privacy-closed.",
  "PASS2853: Any residual data detection freezes privacy-close until remediation ticket, rescanning and post-purge privacy reconciliation are recorded.",
  "PASS2853: Privacy close requires residual scan manifest hash, privacy attestation receipt, privacy-officer/operator QA approval and final customer privacy notice receipt.",
  "PASS2853: This is a deterministic contract only; production claims still require live scanners, DB rows, cache/index purge evidence, storage proofs, privacy officer UI and customer-notice delivery logs.",
] as const;

const REQUIRED_CHANNELS: Pass2853CustomerExportResidualScanChannel[] = ["account_vault", "email", "api", "support"];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeResidualScanReceipts(receipts?: Pass2853CustomerExportResidualScanReceipt[] | null) {
  return REQUIRED_CHANNELS.map((channel) => {
    const found = receipts?.find((receipt) => receipt.channel === channel);
    return {
      channel,
      residualScanReceiptId: found?.residualScanReceiptId ?? null,
      purgeVerificationReceiptId: found?.purgeVerificationReceiptId ?? null,
      residualItemCount: Math.max(0, Number(found?.residualItemCount ?? 0)),
      scannedAt: found?.scannedAt ?? null,
    } satisfies Pass2853CustomerExportResidualScanReceipt;
  });
}

export function buildPass2853CustomerExportPostPurgePrivacyAttestationGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportRetentionPurgeExecutionTombstoneGate: Pass2852CustomerExportRetentionPurgeExecutionTombstoneGate;
  generatedAt?: string;
  residualScannerRunId?: string | null;
  residualScanManifestHash?: string | null;
  searchIndexPurgeReceiptId?: string | null;
  cdnCachePurgeReceiptId?: string | null;
  residualDataDetected?: boolean;
  residualDataRemediationTicketId?: string | null;
  privacyAttestationReceiptId?: string | null;
  privacyOfficerSignoffReceiptId?: string | null;
  customerFinalPrivacyNoticeReceiptId?: string | null;
  postPurgePrivacyReconciliationHash?: string | null;
  channelResidualScanReceipts?: Pass2853CustomerExportResidualScanReceipt[] | null;
}): Pass2853CustomerExportPostPurgePrivacyAttestationGate {
  const previousGate = args.customerExportRetentionPurgeExecutionTombstoneGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(
    previousGate.purgeExecutionTombstoneState === "retention_purge_execution_tombstone_ready" &&
      previousGate.purgePolicy.canMarkArchiveAsTombstoned &&
      previousGate.purgePolicy.canServeCustomerArchiveAfterPurge === false,
  );
  const residualDataDetected = Boolean(args.residualDataDetected);
  const channelResidualScanReceipts = normalizeResidualScanReceipts(args.channelResidualScanReceipts);
  const channelResidualScansReady = channelResidualScanReceipts.every((receipt) =>
    Boolean(receipt.residualScanReceiptId && receipt.purgeVerificationReceiptId && receipt.scannedAt && receipt.residualItemCount === 0),
  );
  const residualRemediationSatisfied = !residualDataDetected || Boolean(args.residualDataRemediationTicketId);

  const ready = Boolean(
    previousReady &&
      args.residualScannerRunId &&
      args.residualScanManifestHash &&
      channelResidualScansReady &&
      args.searchIndexPurgeReceiptId &&
      args.cdnCachePurgeReceiptId &&
      !residualDataDetected &&
      residualRemediationSatisfied &&
      args.privacyAttestationReceiptId &&
      args.privacyOfficerSignoffReceiptId &&
      args.customerFinalPrivacyNoticeReceiptId &&
      args.postPurgePrivacyReconciliationHash,
  );

  const postPurgePrivacyAttestationState: Pass2853CustomerExportPostPurgePrivacyAttestationState = !previousReady
    ? "purge_tombstone_not_ready"
    : !args.residualScannerRunId
      ? "residual_scanner_run_missing"
      : !args.residualScanManifestHash
        ? "residual_scan_manifest_missing"
        : !channelResidualScansReady
          ? "channel_residual_scan_missing"
          : !args.searchIndexPurgeReceiptId
            ? "search_index_purge_receipt_missing"
            : !args.cdnCachePurgeReceiptId
              ? "cdn_cache_purge_receipt_missing"
              : residualDataDetected
                ? "residual_data_detected"
                : !residualRemediationSatisfied
                  ? "residual_remediation_ticket_missing"
                  : !args.privacyAttestationReceiptId
                    ? "privacy_attestation_receipt_missing"
                    : !args.privacyOfficerSignoffReceiptId
                      ? "privacy_officer_signoff_missing"
                      : !args.customerFinalPrivacyNoticeReceiptId
                        ? "customer_final_privacy_notice_missing"
                        : !args.postPurgePrivacyReconciliationHash
                          ? "post_purge_privacy_reconciliation_missing"
                          : "post_purge_privacy_attestation_ready";

  const postPurgePrivacyAttestationReadinessScore = clamp(
    previousGate.purgeExecutionTombstoneReadinessScore +
      (previousReady ? 8 : -42) +
      (args.residualScannerRunId ? 10 : -16) +
      (args.residualScanManifestHash ? 9 : -14) +
      (channelResidualScansReady ? 16 : -22) +
      (args.searchIndexPurgeReceiptId ? 9 : -14) +
      (args.cdnCachePurgeReceiptId ? 9 : -14) -
      (residualDataDetected ? 48 : 0) +
      (residualRemediationSatisfied ? 4 : -18) +
      (args.privacyAttestationReceiptId ? 10 : -15) +
      (args.privacyOfficerSignoffReceiptId ? 9 : -14) +
      (args.customerFinalPrivacyNoticeReceiptId ? 8 : -12) +
      (args.postPurgePrivacyReconciliationHash ? 10 : -15),
  );

  const reason = ready
    ? "Customer export post-purge privacy attestation gate is ready: purge/tombstone completion is followed by residual scanning, index/cache purge proofs, privacy attestation, customer notice and post-purge privacy reconciliation."
    : "Customer export post-purge privacy attestation gate is not ready: purge/tombstone completion still needs residual scan, index/cache purge proof, privacy attestation, customer notice and reconciliation before privacy-close claims.";

  const operatorNextActions = [
    !previousReady ? "Complete PASS2852 purge/tombstone gate before privacy-close attestation." : null,
    !args.residualScannerRunId ? "Run post-purge residual-data scanner across customer export surfaces." : null,
    !args.residualScanManifestHash ? "Attach residual scan manifest hash." : null,
    !channelResidualScansReady ? "Collect zero-residual scan receipts for account vault, email, API and support." : null,
    !args.searchIndexPurgeReceiptId ? "Attach search-index purge receipt." : null,
    !args.cdnCachePurgeReceiptId ? "Attach CDN/cache purge receipt." : null,
    residualDataDetected ? "Keep privacy close frozen and remediate residual data before rescanning." : null,
    residualDataDetected && !args.residualDataRemediationTicketId ? "Create residual-data remediation ticket." : null,
    !args.privacyAttestationReceiptId ? "Append privacy attestation receipt." : null,
    !args.privacyOfficerSignoffReceiptId ? "Collect privacy officer/operator QA approval." : null,
    !args.customerFinalPrivacyNoticeReceiptId ? "Send and receipt customer final privacy notice." : null,
    !args.postPurgePrivacyReconciliationHash ? "Record post-purge privacy reconciliation hash." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2853_customer_export_post_purge_privacy_attestation_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    postPurgePrivacyAttestationState,
    postPurgePrivacyAttestationReadinessScore,
    privacyEnvelope: {
      previousPurgeState: previousGate.purgeExecutionTombstoneState,
      previousPurgeReadinessScore: previousGate.purgeExecutionTombstoneReadinessScore,
      previousCanMarkArchiveAsTombstoned: previousGate.purgePolicy.canMarkArchiveAsTombstoned,
      previousCanServeCustomerArchiveAfterPurge: previousGate.purgePolicy.canServeCustomerArchiveAfterPurge,
      purgeCompletedAt: previousGate.purgeEnvelope.purgeCompletedAt,
      verifiedArchiveTombstoneId: previousGate.purgeEnvelope.verifiedArchiveTombstoneId,
      tombstoneManifestHash: previousGate.purgeEnvelope.tombstoneManifestHash,
      residualScannerRunId: args.residualScannerRunId ?? null,
      residualScanManifestHash: args.residualScanManifestHash ?? null,
      searchIndexPurgeReceiptId: args.searchIndexPurgeReceiptId ?? null,
      cdnCachePurgeReceiptId: args.cdnCachePurgeReceiptId ?? null,
      residualDataDetected,
      residualDataRemediationTicketId: args.residualDataRemediationTicketId ?? null,
      privacyAttestationReceiptId: args.privacyAttestationReceiptId ?? null,
      privacyOfficerSignoffReceiptId: args.privacyOfficerSignoffReceiptId ?? null,
      customerFinalPrivacyNoticeReceiptId: args.customerFinalPrivacyNoticeReceiptId ?? null,
      postPurgePrivacyReconciliationHash: args.postPurgePrivacyReconciliationHash ?? null,
      channelResidualScanReceipts,
    },
    privacyPolicy: {
      canMarkCustomerExportPrivacyClosed: ready,
      canServeCustomerDataAfterPurge: false,
      canClaimProductionPrivacyPurgeWorkflow: false,
      reason,
    },
    privacyRiskSignals: {
      purgeTombstoneNotReady: !previousReady,
      missingResidualScannerRun: !args.residualScannerRunId,
      missingResidualScanManifest: !args.residualScanManifestHash,
      missingChannelResidualScan: !channelResidualScansReady,
      missingSearchIndexPurgeReceipt: !args.searchIndexPurgeReceiptId,
      missingCdnCachePurgeReceipt: !args.cdnCachePurgeReceiptId,
      residualDataDetected,
      missingResidualRemediationTicket: residualDataDetected && !args.residualDataRemediationTicketId,
      missingPrivacyAttestationReceipt: !args.privacyAttestationReceiptId,
      missingPrivacyOfficerSignoff: !args.privacyOfficerSignoffReceiptId,
      missingCustomerFinalPrivacyNotice: !args.customerFinalPrivacyNoticeReceiptId,
      missingPostPurgePrivacyReconciliation: !args.postPurgePrivacyReconciliationHash,
    },
    customerSafeCopy: ready
      ? "Your export archive purge has a post-purge privacy attestation: residual scans, index/cache purge evidence, privacy signoff and final privacy notice are bound."
      : "Your export purge is not privacy-closed yet. Velmère still needs residual scans, index/cache purge proof, privacy attestation and final customer notice before claiming the archive data is closed.",
    operatorNextActions,
  };
}
