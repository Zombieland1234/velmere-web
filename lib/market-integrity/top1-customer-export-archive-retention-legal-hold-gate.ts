import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2850CustomerExportFinalArchiveBundleGate } from "@/lib/market-integrity/top1-customer-export-final-archive-bundle-gate";

export type Pass2851CustomerExportArchiveRetentionLegalHoldState =
  | "final_archive_not_ready"
  | "retention_policy_missing"
  | "retention_class_missing"
  | "legal_hold_status_missing"
  | "legal_hold_active_blocked"
  | "deletion_eligibility_missing"
  | "retention_timer_missing"
  | "archive_tombstone_missing"
  | "access_revocation_missing"
  | "channel_purge_receipts_missing"
  | "customer_access_index_update_missing"
  | "operator_retention_signoff_missing"
  | "retention_deletion_timeline_missing"
  | "archive_retention_legal_hold_ready";

export type Pass2851CustomerExportRetentionClass = "standard_report" | "advanced_review" | "support_attachment" | "legal_hold";
export type Pass2851CustomerExportRetentionChannel = "account_vault" | "email" | "api" | "support";

export type Pass2851CustomerExportChannelPurgeReceipt = {
  channel: Pass2851CustomerExportRetentionChannel;
  purgeReceiptId: string | null;
  archivedBundleReferenceId: string | null;
  revokedAccessReferenceId: string | null;
  purgedAt: string | null;
};

export type Pass2851CustomerExportArchiveRetentionLegalHoldGate = {
  schemaVersion: "pass2851_customer_export_archive_retention_legal_hold_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  archiveRetentionLegalHoldState: Pass2851CustomerExportArchiveRetentionLegalHoldState;
  archiveRetentionLegalHoldReadinessScore: number;
  retentionEnvelope: {
    previousFinalArchiveState: string;
    previousFinalArchiveReadinessScore: number;
    previousCanCloseCustomerExportArchive: boolean;
    archiveBundleId: string | null;
    archiveManifestHash: string | null;
    retentionPolicyId: string | null;
    retentionClass: Pass2851CustomerExportRetentionClass | null;
    legalHoldStatusReceiptId: string | null;
    legalHoldActive: boolean;
    customerDeletionRequestId: string | null;
    deletionEligibilityReceiptId: string | null;
    retentionTimerReceiptId: string | null;
    scheduledPurgeAt: string | null;
    archiveTombstoneId: string | null;
    archiveAccessRevocationReceiptId: string | null;
    customerAccessIndexUpdateReceiptId: string | null;
    operatorRetentionSignoffReceiptId: string | null;
    retentionDeletionTimelineHash: string | null;
    channelPurgeReceipts: Pass2851CustomerExportChannelPurgeReceipt[];
  };
  retentionPolicy: {
    canRetainFinalArchive: boolean;
    canDeleteOrPurgeCustomerExportArchive: boolean;
    canServeCustomerArchiveAfterRetentionDecision: boolean;
    canClaimProductionRetentionWorkflow: false;
    reason: string;
  };
  retentionRiskSignals: {
    finalArchiveNotReady: boolean;
    missingRetentionPolicy: boolean;
    missingRetentionClass: boolean;
    missingLegalHoldStatus: boolean;
    legalHoldActive: boolean;
    missingDeletionEligibility: boolean;
    missingRetentionTimer: boolean;
    missingArchiveTombstone: boolean;
    missingAccessRevocation: boolean;
    missingChannelPurgeReceipts: boolean;
    missingCustomerAccessIndexUpdate: boolean;
    missingOperatorRetentionSignoff: boolean;
    missingRetentionDeletionTimeline: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2851_CUSTOMER_EXPORT_ARCHIVE_RETENTION_LEGAL_HOLD_ACCEPTANCE_GATES = [
  "PASS2851: A final archive bundle is not the end of custody; archive retention, deletion eligibility and legal-hold status require a separate proof state.",
  "PASS2851: Customer export archives cannot be purged while a legal hold, dispute, finance review, support case or policy hold is active.",
  "PASS2851: Deletion/purge requires retention policy ID, retention class, legal-hold status receipt, deletion-eligibility receipt, retention timer and archive tombstone before access is revoked.",
  "PASS2851: Account vault, email, API and support each need their own purge receipt and archived-bundle reference before customer access indexes are updated.",
  "PASS2851: This is a deterministic contract only; production retention/deletion claims still require live storage lifecycle rules, DB rows, worker evidence, operator UI and customer-notice logs.",
] as const;

const REQUIRED_CHANNELS: Pass2851CustomerExportRetentionChannel[] = ["account_vault", "email", "api", "support"];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeChannelPurgeReceipts(receipts?: Pass2851CustomerExportChannelPurgeReceipt[] | null) {
  return REQUIRED_CHANNELS.map((channel) => {
    const found = receipts?.find((receipt) => receipt.channel === channel);
    return {
      channel,
      purgeReceiptId: found?.purgeReceiptId ?? null,
      archivedBundleReferenceId: found?.archivedBundleReferenceId ?? null,
      revokedAccessReferenceId: found?.revokedAccessReferenceId ?? null,
      purgedAt: found?.purgedAt ?? null,
    } satisfies Pass2851CustomerExportChannelPurgeReceipt;
  });
}

export function buildPass2851CustomerExportArchiveRetentionLegalHoldGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportFinalArchiveBundleGate: Pass2850CustomerExportFinalArchiveBundleGate;
  generatedAt?: string;
  retentionPolicyId?: string | null;
  retentionClass?: Pass2851CustomerExportRetentionClass | null;
  legalHoldStatusReceiptId?: string | null;
  legalHoldActive?: boolean;
  customerDeletionRequestId?: string | null;
  deletionEligibilityReceiptId?: string | null;
  retentionTimerReceiptId?: string | null;
  scheduledPurgeAt?: string | null;
  archiveTombstoneId?: string | null;
  archiveAccessRevocationReceiptId?: string | null;
  customerAccessIndexUpdateReceiptId?: string | null;
  operatorRetentionSignoffReceiptId?: string | null;
  retentionDeletionTimelineHash?: string | null;
  channelPurgeReceipts?: Pass2851CustomerExportChannelPurgeReceipt[] | null;
}): Pass2851CustomerExportArchiveRetentionLegalHoldGate {
  const previousGate = args.customerExportFinalArchiveBundleGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(
    previousGate.finalArchiveBundleState === "final_archive_bundle_ready" &&
      previousGate.archivePolicy.canCloseCustomerExportArchive &&
      previousGate.archivePolicy.canServeFinalEvidenceBundle,
  );
  const legalHoldActive = Boolean(args.legalHoldActive);
  const channelPurgeReceipts = normalizeChannelPurgeReceipts(args.channelPurgeReceipts);
  const channelPurgeReady = channelPurgeReceipts.every((receipt) =>
    Boolean(receipt.purgeReceiptId && receipt.archivedBundleReferenceId && receipt.revokedAccessReferenceId && receipt.purgedAt),
  );

  const ready = Boolean(
    previousReady &&
      args.retentionPolicyId &&
      args.retentionClass &&
      args.legalHoldStatusReceiptId &&
      !legalHoldActive &&
      args.deletionEligibilityReceiptId &&
      args.retentionTimerReceiptId &&
      args.scheduledPurgeAt &&
      args.archiveTombstoneId &&
      args.archiveAccessRevocationReceiptId &&
      channelPurgeReady &&
      args.customerAccessIndexUpdateReceiptId &&
      args.operatorRetentionSignoffReceiptId &&
      args.retentionDeletionTimelineHash,
  );

  const archiveRetentionLegalHoldState: Pass2851CustomerExportArchiveRetentionLegalHoldState = !previousReady
    ? "final_archive_not_ready"
    : !args.retentionPolicyId
      ? "retention_policy_missing"
      : !args.retentionClass
        ? "retention_class_missing"
        : !args.legalHoldStatusReceiptId
          ? "legal_hold_status_missing"
          : legalHoldActive
            ? "legal_hold_active_blocked"
            : !args.deletionEligibilityReceiptId
              ? "deletion_eligibility_missing"
              : !args.retentionTimerReceiptId || !args.scheduledPurgeAt
                ? "retention_timer_missing"
                : !args.archiveTombstoneId
                  ? "archive_tombstone_missing"
                  : !args.archiveAccessRevocationReceiptId
                    ? "access_revocation_missing"
                    : !channelPurgeReady
                      ? "channel_purge_receipts_missing"
                      : !args.customerAccessIndexUpdateReceiptId
                        ? "customer_access_index_update_missing"
                        : !args.operatorRetentionSignoffReceiptId
                          ? "operator_retention_signoff_missing"
                          : !args.retentionDeletionTimelineHash
                            ? "retention_deletion_timeline_missing"
                            : "archive_retention_legal_hold_ready";

  const archiveRetentionLegalHoldReadinessScore = clamp(
    previousGate.finalArchiveBundleReadinessScore +
      (previousReady ? 8 : -36) +
      (args.retentionPolicyId ? 8 : -12) +
      (args.retentionClass ? 6 : -9) +
      (args.legalHoldStatusReceiptId ? 8 : -14) -
      (legalHoldActive ? 46 : 0) +
      (args.deletionEligibilityReceiptId ? 8 : -12) +
      (args.retentionTimerReceiptId ? 7 : -10) +
      (args.scheduledPurgeAt ? 5 : -8) +
      (args.archiveTombstoneId ? 8 : -12) +
      (args.archiveAccessRevocationReceiptId ? 8 : -12) +
      (channelPurgeReady ? 10 : -16) +
      (args.customerAccessIndexUpdateReceiptId ? 7 : -10) +
      (args.operatorRetentionSignoffReceiptId ? 8 : -12) +
      (args.retentionDeletionTimelineHash ? 9 : -14),
  );

  const reason = ready
    ? "Customer export archive retention/legal-hold gate is ready: final archive is closed, legal hold is clear, deletion eligibility, retention timer, tombstone, access revocation, channel purge receipts, customer index update and operator QA approval are timeline-bound."
    : "Customer export archive retention/legal-hold gate remains prepared-only until final archive readiness, retention policy, legal-hold status, deletion eligibility, purge timer, tombstone, access revocation, channel purge receipts, customer index update and operator QA approval clear.";

  const operatorNextActions = [
    !previousReady ? "Close PASS2850 final archive bundle before retention/deletion workflow is evaluated." : null,
    !args.retentionPolicyId ? "Attach a retention policy ID for this customer export archive." : null,
    !args.retentionClass ? "Classify the archive retention class: standard report, advanced review, support attachment or legal hold." : null,
    !args.legalHoldStatusReceiptId ? "Record a legal-hold status receipt before purge/deletion decisions." : null,
    legalHoldActive ? "Keep archive deletion/purge blocked until legal-hold release and operator review receipts exist." : null,
    !args.deletionEligibilityReceiptId ? "Attach a deletion-eligibility receipt that checks dispute, finance, support, policy and legal-hold state." : null,
    !args.retentionTimerReceiptId || !args.scheduledPurgeAt ? "Create retention timer and scheduled purge timestamp." : null,
    !args.archiveTombstoneId ? "Create archive tombstone ID before purging storage references." : null,
    !args.archiveAccessRevocationReceiptId ? "Revoke customer access and persist an access-revocation receipt." : null,
    !channelPurgeReady ? "Write purge receipts for account vault, email, API and support channels." : null,
    !args.customerAccessIndexUpdateReceiptId ? "Update customer access index so deleted/purged archive does not appear as downloadable." : null,
    !args.operatorRetentionSignoffReceiptId ? "Collect operator retention/deletion signoff receipt." : null,
    !args.retentionDeletionTimelineHash ? "Hash the retention/deletion audit timeline for replayable evidence." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2851_customer_export_archive_retention_legal_hold_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    archiveRetentionLegalHoldState,
    archiveRetentionLegalHoldReadinessScore,
    retentionEnvelope: {
      previousFinalArchiveState: previousGate.finalArchiveBundleState,
      previousFinalArchiveReadinessScore: previousGate.finalArchiveBundleReadinessScore,
      previousCanCloseCustomerExportArchive: previousGate.archivePolicy.canCloseCustomerExportArchive,
      archiveBundleId: previousGate.archiveEnvelope.archiveBundleId,
      archiveManifestHash: previousGate.archiveEnvelope.archiveManifestHash,
      retentionPolicyId: args.retentionPolicyId ?? null,
      retentionClass: args.retentionClass ?? null,
      legalHoldStatusReceiptId: args.legalHoldStatusReceiptId ?? null,
      legalHoldActive,
      customerDeletionRequestId: args.customerDeletionRequestId ?? null,
      deletionEligibilityReceiptId: args.deletionEligibilityReceiptId ?? null,
      retentionTimerReceiptId: args.retentionTimerReceiptId ?? null,
      scheduledPurgeAt: args.scheduledPurgeAt ?? null,
      archiveTombstoneId: args.archiveTombstoneId ?? null,
      archiveAccessRevocationReceiptId: args.archiveAccessRevocationReceiptId ?? null,
      customerAccessIndexUpdateReceiptId: args.customerAccessIndexUpdateReceiptId ?? null,
      operatorRetentionSignoffReceiptId: args.operatorRetentionSignoffReceiptId ?? null,
      retentionDeletionTimelineHash: args.retentionDeletionTimelineHash ?? null,
      channelPurgeReceipts,
    },
    retentionPolicy: {
      canRetainFinalArchive: previousReady && Boolean(args.retentionPolicyId && args.retentionClass && args.legalHoldStatusReceiptId),
      canDeleteOrPurgeCustomerExportArchive: ready,
      canServeCustomerArchiveAfterRetentionDecision: previousReady && !legalHoldActive && Boolean(args.retentionPolicyId && args.legalHoldStatusReceiptId),
      canClaimProductionRetentionWorkflow: false,
      reason,
    },
    retentionRiskSignals: {
      finalArchiveNotReady: !previousReady,
      missingRetentionPolicy: !args.retentionPolicyId,
      missingRetentionClass: !args.retentionClass,
      missingLegalHoldStatus: !args.legalHoldStatusReceiptId,
      legalHoldActive,
      missingDeletionEligibility: !args.deletionEligibilityReceiptId,
      missingRetentionTimer: !args.retentionTimerReceiptId || !args.scheduledPurgeAt,
      missingArchiveTombstone: !args.archiveTombstoneId,
      missingAccessRevocation: !args.archiveAccessRevocationReceiptId,
      missingChannelPurgeReceipts: !channelPurgeReady,
      missingCustomerAccessIndexUpdate: !args.customerAccessIndexUpdateReceiptId,
      missingOperatorRetentionSignoff: !args.operatorRetentionSignoffReceiptId,
      missingRetentionDeletionTimeline: !args.retentionDeletionTimelineHash,
    },
    customerSafeCopy: ready
      ? "Your export archive has a retention/deletion evidence trail. Legal-hold status, deletion eligibility, purge receipts and access-index updates are recorded before archive access changes."
      : "Your export archive cannot be deleted, purged or claimed retention-complete until legal-hold, deletion eligibility, purge receipts and operator QA approval are recorded.",
    operatorNextActions,
  };
}
