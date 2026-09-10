import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2849CustomerExportRemediationTicketCloseGate } from "@/lib/market-integrity/top1-customer-export-remediation-ticket-close-gate";

export type Pass2850CustomerExportFinalArchiveBundleState =
  | "remediation_close_not_ready"
  | "archive_bundle_missing"
  | "archive_manifest_missing"
  | "immutable_storage_receipt_missing"
  | "retention_policy_snapshot_missing"
  | "payload_source_binding_missing"
  | "channel_receipt_bundle_missing"
  | "customer_access_index_missing"
  | "operator_archive_signoff_missing"
  | "archive_timeline_missing"
  | "archive_integrity_drift_blocked"
  | "final_archive_bundle_ready";

export type Pass2850CustomerExportArchiveChannel = "account_vault" | "email" | "api" | "support";

export type Pass2850CustomerExportArchiveChannelReceipt = {
  channel: Pass2850CustomerExportArchiveChannel;
  channelReceiptBundleId: string | null;
  lastCommitReceiptId: string | null;
  customerVisibleReferenceId: string | null;
  archivedAt: string | null;
};

export type Pass2850CustomerExportFinalArchiveBundleGate = {
  schemaVersion: "pass2850_customer_export_final_archive_bundle_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  finalArchiveBundleState: Pass2850CustomerExportFinalArchiveBundleState;
  finalArchiveBundleReadinessScore: number;
  archiveEnvelope: {
    previousRemediationCloseState: string;
    previousRemediationCloseReadinessScore: number;
    previousCanLiftCustomerExportFreeze: boolean;
    archiveBundleId: string | null;
    archiveManifestHash: string | null;
    immutableStorageReceiptId: string | null;
    retentionPolicySnapshotId: string | null;
    finalPayloadHash: string | null;
    finalSourceReceiptRoot: string | null;
    expectedPayloadHash: string | null;
    expectedSourceReceiptRoot: string | null;
    customerAccessIndexId: string | null;
    operatorArchiveSignoffReceiptId: string | null;
    archiveClosedAt: string | null;
    archiveAuditTimelineHash: string | null;
    archiveIntegrityDriftDetected: boolean;
    channelReceipts: Pass2850CustomerExportArchiveChannelReceipt[];
  };
  archivePolicy: {
    canCloseCustomerExportArchive: boolean;
    canServeFinalEvidenceBundle: boolean;
    canClaimFinalArchiveComplete: boolean;
    canClaimProductionArchiveWorkflow: false;
    reason: string;
  };
  archiveRiskSignals: {
    remediationCloseNotReady: boolean;
    archiveBundleMissing: boolean;
    archiveManifestMissing: boolean;
    immutableStorageReceiptMissing: boolean;
    retentionPolicySnapshotMissing: boolean;
    payloadOrSourceBindingMissing: boolean;
    channelReceiptBundleMissing: boolean;
    customerAccessIndexMissing: boolean;
    operatorArchiveSignoffMissing: boolean;
    archiveTimelineMissing: boolean;
    archiveIntegrityDriftDetected: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2850_CUSTOMER_EXPORT_FINAL_ARCHIVE_BUNDLE_ACCEPTANCE_GATES = [
  "PASS2850: A remediation-closed export cannot be treated as finally auditable until an archive bundle ID, manifest hash, immutable storage receipt and retention-policy snapshot are attached.",
  "PASS2850: Final archive bundles must bind the corrected payloadHash and sourceReceiptRoot from remediation close; payload/source-root drift blocks customer-visible final evidence access.",
  "PASS2850: Account vault, email, API and support each need their own archived channel receipt bundle before final archive close can be claimed.",
  "PASS2850: Customer access index, operator archive signoff and archive audit timeline hash are required before serving a final evidence bundle back to the customer.",
  "PASS2850: Final archive readiness is a deterministic contract only; it does not claim a deployed production archive workflow without live storage, DB, worker, operator UI and retention job evidence.",
] as const;

const REQUIRED_CHANNELS: Pass2850CustomerExportArchiveChannel[] = ["account_vault", "email", "api", "support"];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeChannelReceipts(receipts?: Pass2850CustomerExportArchiveChannelReceipt[] | null) {
  return REQUIRED_CHANNELS.map((channel) => {
    const found = receipts?.find((receipt) => receipt.channel === channel);
    return {
      channel,
      channelReceiptBundleId: found?.channelReceiptBundleId ?? null,
      lastCommitReceiptId: found?.lastCommitReceiptId ?? null,
      customerVisibleReferenceId: found?.customerVisibleReferenceId ?? null,
      archivedAt: found?.archivedAt ?? null,
    } satisfies Pass2850CustomerExportArchiveChannelReceipt;
  });
}

export function buildPass2850CustomerExportFinalArchiveBundleGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportRemediationTicketCloseGate: Pass2849CustomerExportRemediationTicketCloseGate;
  generatedAt?: string;
  archiveBundleId?: string | null;
  archiveManifestHash?: string | null;
  immutableStorageReceiptId?: string | null;
  retentionPolicySnapshotId?: string | null;
  finalPayloadHash?: string | null;
  finalSourceReceiptRoot?: string | null;
  customerAccessIndexId?: string | null;
  operatorArchiveSignoffReceiptId?: string | null;
  archiveClosedAt?: string | null;
  archiveAuditTimelineHash?: string | null;
  archiveIntegrityDriftDetected?: boolean;
  channelReceipts?: Pass2850CustomerExportArchiveChannelReceipt[] | null;
}): Pass2850CustomerExportFinalArchiveBundleGate {
  const previousGate = args.customerExportRemediationTicketCloseGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(
    previousGate.remediationTicketCloseState === "remediation_ticket_close_ready" &&
      previousGate.remediationPolicy.canLiftCustomerExportFreeze,
  );
  const expectedPayloadHash = previousGate.remediationEnvelope.correctedPayloadHash ?? previousGate.remediationEnvelope.expectedPayloadHash;
  const expectedSourceReceiptRoot = previousGate.remediationEnvelope.correctedSourceReceiptRoot ?? previousGate.remediationEnvelope.expectedSourceReceiptRoot;
  const payloadMatches = Boolean(args.finalPayloadHash && expectedPayloadHash && args.finalPayloadHash === expectedPayloadHash);
  const sourceRootMatches = Boolean(args.finalSourceReceiptRoot && expectedSourceReceiptRoot && args.finalSourceReceiptRoot === expectedSourceReceiptRoot);
  const channelReceipts = normalizeChannelReceipts(args.channelReceipts);
  const channelReceiptBundleReady = channelReceipts.every(
    (receipt) => Boolean(receipt.channelReceiptBundleId && receipt.lastCommitReceiptId && receipt.customerVisibleReferenceId && receipt.archivedAt),
  );
  const archiveIntegrityDriftDetected = Boolean(args.archiveIntegrityDriftDetected) || !payloadMatches || !sourceRootMatches;

  const ready = Boolean(
    previousReady &&
      args.archiveBundleId &&
      args.archiveManifestHash &&
      args.immutableStorageReceiptId &&
      args.retentionPolicySnapshotId &&
      payloadMatches &&
      sourceRootMatches &&
      channelReceiptBundleReady &&
      args.customerAccessIndexId &&
      args.operatorArchiveSignoffReceiptId &&
      args.archiveClosedAt &&
      args.archiveAuditTimelineHash &&
      !archiveIntegrityDriftDetected,
  );

  const finalArchiveBundleState: Pass2850CustomerExportFinalArchiveBundleState = !previousReady
    ? "remediation_close_not_ready"
    : !args.archiveBundleId
      ? "archive_bundle_missing"
      : !args.archiveManifestHash
        ? "archive_manifest_missing"
        : !args.immutableStorageReceiptId
          ? "immutable_storage_receipt_missing"
          : !args.retentionPolicySnapshotId
            ? "retention_policy_snapshot_missing"
            : !payloadMatches || !sourceRootMatches
              ? "payload_source_binding_missing"
              : !channelReceiptBundleReady
                ? "channel_receipt_bundle_missing"
                : !args.customerAccessIndexId
                  ? "customer_access_index_missing"
                  : !args.operatorArchiveSignoffReceiptId
                    ? "operator_archive_signoff_missing"
                    : !args.archiveClosedAt || !args.archiveAuditTimelineHash
                      ? "archive_timeline_missing"
                      : archiveIntegrityDriftDetected
                        ? "archive_integrity_drift_blocked"
                        : "final_archive_bundle_ready";

  const finalArchiveBundleReadinessScore = clamp(
    previousGate.remediationTicketCloseReadinessScore +
      (previousReady ? 8 : -34) +
      (args.archiveBundleId ? 8 : -12) +
      (args.archiveManifestHash ? 8 : -12) +
      (args.immutableStorageReceiptId ? 8 : -12) +
      (args.retentionPolicySnapshotId ? 7 : -10) +
      (payloadMatches ? 8 : -16) +
      (sourceRootMatches ? 8 : -16) +
      (channelReceiptBundleReady ? 10 : -16) +
      (args.customerAccessIndexId ? 7 : -10) +
      (args.operatorArchiveSignoffReceiptId ? 8 : -12) +
      (args.archiveClosedAt ? 5 : -8) +
      (args.archiveAuditTimelineHash ? 8 : -12) -
      (archiveIntegrityDriftDetected ? 42 : 0),
  );

  const reason = ready
    ? "Customer export final archive bundle is ready: archive manifest, immutable storage, retention snapshot, channel receipt bundles, customer index, operator QA approval and timeline hash are bound to corrected payload/source roots."
    : "Customer export final archive bundle remains prepared-only until remediation close, archive manifest, immutable storage, retention snapshot, payload/source binding, all channel receipt bundles, customer access index, operator QA approval and archive timeline clear.";

  const operatorNextActions = [
    !previousReady ? "Close PASS2849 remediation and freeze-lift proof before final archive work begins." : null,
    !args.archiveBundleId ? "Create a final customer export archive bundle ID." : null,
    !args.archiveManifestHash ? "Generate an archive manifest hash containing redaction, delivery, replay, reconciliation and remediation receipts." : null,
    !args.immutableStorageReceiptId ? "Attach immutable storage receipt for the final evidence bundle." : null,
    !args.retentionPolicySnapshotId ? "Snapshot retention/legal-hold policy for the archived bundle." : null,
    !payloadMatches || !sourceRootMatches ? "Bind final archive payloadHash and sourceReceiptRoot to corrected remediation values." : null,
    !channelReceiptBundleReady ? "Archive per-channel receipt bundles for account vault, email, API and support." : null,
    !args.customerAccessIndexId ? "Create customer access index so the final evidence bundle can be located safely without exposing raw IDs." : null,
    !args.operatorArchiveSignoffReceiptId ? "Attach operator archive signoff receipt." : null,
    !args.archiveClosedAt || !args.archiveAuditTimelineHash ? "Attach archive closed timestamp and archive audit timeline hash." : null,
    archiveIntegrityDriftDetected ? "Keep final archive blocked until archive integrity drift is remediated." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2850_customer_export_final_archive_bundle_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Advanced",
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    finalArchiveBundleState,
    finalArchiveBundleReadinessScore,
    archiveEnvelope: {
      previousRemediationCloseState: previousGate.remediationTicketCloseState,
      previousRemediationCloseReadinessScore: previousGate.remediationTicketCloseReadinessScore,
      previousCanLiftCustomerExportFreeze: previousGate.remediationPolicy.canLiftCustomerExportFreeze,
      archiveBundleId: args.archiveBundleId ?? null,
      archiveManifestHash: args.archiveManifestHash ?? null,
      immutableStorageReceiptId: args.immutableStorageReceiptId ?? null,
      retentionPolicySnapshotId: args.retentionPolicySnapshotId ?? null,
      finalPayloadHash: args.finalPayloadHash ?? null,
      finalSourceReceiptRoot: args.finalSourceReceiptRoot ?? null,
      expectedPayloadHash,
      expectedSourceReceiptRoot,
      customerAccessIndexId: args.customerAccessIndexId ?? null,
      operatorArchiveSignoffReceiptId: args.operatorArchiveSignoffReceiptId ?? null,
      archiveClosedAt: args.archiveClosedAt ?? null,
      archiveAuditTimelineHash: args.archiveAuditTimelineHash ?? null,
      archiveIntegrityDriftDetected,
      channelReceipts,
    },
    archivePolicy: {
      canCloseCustomerExportArchive: ready,
      canServeFinalEvidenceBundle: ready,
      canClaimFinalArchiveComplete: ready,
      canClaimProductionArchiveWorkflow: false,
      reason,
    },
    archiveRiskSignals: {
      remediationCloseNotReady: !previousReady,
      archiveBundleMissing: !args.archiveBundleId,
      archiveManifestMissing: !args.archiveManifestHash,
      immutableStorageReceiptMissing: !args.immutableStorageReceiptId,
      retentionPolicySnapshotMissing: !args.retentionPolicySnapshotId,
      payloadOrSourceBindingMissing: !payloadMatches || !sourceRootMatches,
      channelReceiptBundleMissing: !channelReceiptBundleReady,
      customerAccessIndexMissing: !args.customerAccessIndexId,
      operatorArchiveSignoffMissing: !args.operatorArchiveSignoffReceiptId,
      archiveTimelineMissing: !args.archiveClosedAt || !args.archiveAuditTimelineHash,
      archiveIntegrityDriftDetected,
    },
    customerSafeCopy:
      "Final customer export archive requires an immutable evidence bundle, manifest, retention snapshot, channel receipt bundles and customer access index. Until those receipts match the corrected payload/source roots, Velmère must not call the export finally closed.",
    operatorNextActions,
  };
}
