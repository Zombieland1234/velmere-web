import type {
  VelmereReportAssetFamily,
} from "@/lib/market-integrity/report-asset-family";
import type {
  Pass2835AccountVaultRemedyReopenAuditGate,
} from "@/lib/market-integrity/top1-account-vault-remedy-reopen-audit-gate";
import type {
  Pass2822AccountVaultTokenConsumptionGate,
} from "@/lib/market-integrity/top1-account-vault-token-consumption-gate";
import type {
  Pass2823OperatorReviewGate,
} from "@/lib/market-integrity/top1-advanced-human-review-signoff-gate";
import type {
  Pass2824AdvancedReviewReplayAuditGate,
} from "@/lib/market-integrity/top1-advanced-review-replay-audit-gate";
import type {
  Pass2825CommunitySourceUpgradeModerationGate,
} from "@/lib/market-integrity/top1-community-source-upgrade-moderation-gate";
import type {
  Pass2821CustomerDeliveryLedger,
} from "@/lib/market-integrity/top1-customer-delivery-ledger";
import type {
  Pass2841CustomerAckChannel,
  Pass2841CustomerExportAcknowledgementSignedReceiptGate,
} from "@/lib/market-integrity/top1-customer-export-ack-signed-receipt-gate";
import type {
  Pass2851CustomerExportArchiveRetentionLegalHoldGate,
  Pass2851CustomerExportChannelPurgeReceipt,
  Pass2851CustomerExportRetentionClass,
} from "@/lib/market-integrity/top1-customer-export-archive-retention-legal-hold-gate";
import type {
  Pass2840CustomerExportDeliveryLedgerPersistenceGate,
  Pass2840CustomerExportLedgerChannel,
} from "@/lib/market-integrity/top1-customer-export-delivery-ledger-persistence-gate";
import type {
  Pass2842CustomerExportDisputeChargebackHoldGate,
  Pass2842CustomerExportHoldReason,
} from "@/lib/market-integrity/top1-customer-export-dispute-chargeback-hold-gate";
import type {
  Pass2856CustomerExportDsrAppealResolutionChannelReceipt,
  Pass2856CustomerExportDsrAppealResolutionClosureGate,
  Pass2856CustomerExportDsrAppealResolutionDecision,
} from "@/lib/market-integrity/top1-customer-export-dsr-appeal-resolution-closure-gate";
import type {
  Pass2855CustomerExportDsrChannelDeliveryReceipt,
  Pass2855CustomerExportDsrDeliveryAppealReopenGate,
} from "@/lib/market-integrity/top1-customer-export-dsr-delivery-appeal-reopen-gate";
import type {
  Pass2839CustomerExportExpiryRecallGate,
} from "@/lib/market-integrity/top1-customer-export-expiry-recall-gate";
import type {
  Pass2850CustomerExportArchiveChannelReceipt,
  Pass2850CustomerExportFinalArchiveBundleGate,
} from "@/lib/market-integrity/top1-customer-export-final-archive-bundle-gate";
import type {
  Pass2843CustomerExportOperatorReleaseDecision,
  Pass2843CustomerExportOperatorReleaseReinstatementGate,
} from "@/lib/market-integrity/top1-customer-export-operator-release-reinstatement-gate";
import type {
  Pass2853CustomerExportPostPurgePrivacyAttestationGate,
  Pass2853CustomerExportResidualScanReceipt,
} from "@/lib/market-integrity/top1-customer-export-post-purge-privacy-attestation-gate";
import type {
  Pass2844CustomerExportNotificationChannel,
  Pass2844CustomerExportPostReinstatementAuditNotificationGate,
} from "@/lib/market-integrity/top1-customer-export-post-reinstatement-audit-notification-gate";
import type {
  Pass2857CustomerExportPrivacyCaseStatus,
  Pass2857CustomerExportPrivacyCaseSupervisorSlaGate,
} from "@/lib/market-integrity/top1-customer-export-privacy-case-supervisor-sla-gate";
import type {
  Pass2854CustomerExportPrivacyIncidentDsrEscalationGate,
  Pass2854CustomerExportResidualIncidentClassification,
} from "@/lib/market-integrity/top1-customer-export-privacy-incident-dsr-escalation-gate";
import type {
  Pass2848CustomerExportChannelSnapshot,
  Pass2848CustomerExportReconciliationDriftMonitorGate,
} from "@/lib/market-integrity/top1-customer-export-reconciliation-drift-monitor-gate";
import type {
  Pass2838CustomerExportChannel,
  Pass2838CustomerExportRedactionPacketGate,
} from "@/lib/market-integrity/top1-customer-export-redaction-packet-gate";
import type {
  Pass2849CustomerExportRemediationRootCause,
  Pass2849CustomerExportRemediationTicketCloseGate,
} from "@/lib/market-integrity/top1-customer-export-remediation-ticket-close-gate";
import type {
  Pass2852CustomerExportChannelPurgeExecutionReceipt,
  Pass2852CustomerExportRetentionPurgeExecutionTombstoneGate,
} from "@/lib/market-integrity/top1-customer-export-retention-purge-execution-tombstone-gate";
import type {
  Pass2845CustomerExportRuntimeAdapterStubGate,
  Pass2845CustomerExportRuntimeEventKind,
} from "@/lib/market-integrity/top1-customer-export-runtime-adapter-stub-gate";
import type {
  Pass2860CustomerExportSupervisoryDisclosureFinalCloseGate,
  Pass2860CustomerExportSupervisoryFinalChannelAckReceipt,
} from "@/lib/market-integrity/top1-customer-export-supervisory-disclosure-final-close-gate";
import type {
  Pass2859CustomerExportSupervisoryDisclosureResponseCorrectionGate,
  Pass2859CustomerExportSupervisoryResponseChannelReceipt,
  Pass2859CustomerExportSupervisoryResponseType,
} from "@/lib/market-integrity/top1-customer-export-supervisory-disclosure-response-correction-gate";
import type {
  Pass2858CustomerExportSupervisoryChannelReceipt,
  Pass2858CustomerExportSupervisoryEvidenceIndexGate,
  Pass2858CustomerExportSupervisoryRequestType,
} from "@/lib/market-integrity/top1-customer-export-supervisory-evidence-index-gate";
import type {
  Pass2868CustomerExportSupervisoryEvidenceIndexTamperIncidentGate,
  Pass2868CustomerExportSupervisoryEvidenceIndexTamperNoticeDecision,
  Pass2868CustomerExportSupervisoryEvidenceIndexTamperSeverity,
} from "@/lib/market-integrity/top1-customer-export-supervisory-evidence-index-tamper-incident-gate";
import type {
  Pass2867CustomerExportSupervisoryEvidenceIndexMutationAttempt,
  Pass2867CustomerExportSupervisoryFinalEvidenceIndexFreezeGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-final-evidence-index-freeze-gate";
import type {
  Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionDecision,
  Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionRecloseGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-post-closure-mutation-incident-resolution-reclose-gate";
import type {
  Pass2871CustomerExportSupervisoryPostClosureMutationSignal,
  Pass2871CustomerExportSupervisoryPostClosureMutationWatchAutoFreezeGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-post-closure-mutation-watch-auto-freeze-gate";
import type {
  Pass2863CustomerExportSupervisoryPostPurgeResidualEvidenceScanGate,
  Pass2863CustomerExportSupervisoryResidualScanReceipt,
} from "@/lib/market-integrity/top1-customer-export-supervisory-post-purge-residual-evidence-scan-gate";
import type {
  Pass2875CustomerExportSupervisoryPostRebaselineRegressionSignal,
  Pass2875CustomerExportSupervisoryPostRebaselineStabilityDecision,
  Pass2875CustomerExportSupervisoryPostRebaselineStabilityEnforcementGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-post-rebaseline-stability-enforcement-gate";
import type {
  Pass2873CustomerExportSupervisoryPostRecloseRegressionSignal,
  Pass2873CustomerExportSupervisoryPostRecloseRegressionSloGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-post-reclose-regression-slo-gate";
import type {
  Pass2877CustomerExportSupervisoryPostReleaseChannelDecision,
  Pass2877CustomerExportSupervisoryPostReleaseChannelMonitorRollbackGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-post-release-channel-monitor-rollback-gate";
import type {
  Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealDecision,
  Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-post-release-observation-close-final-channel-seal-gate";
import type {
  Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionDecision,
  Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionRebaselineGate,
  Pass2874CustomerExportSupervisoryRecurrenceFamily,
} from "@/lib/market-integrity/top1-customer-export-supervisory-recurrence-escalation-resolution-rebaseline-gate";
import type {
  Pass2866CustomerExportSupervisoryResidualEscalationResolutionFreezeLiftGate,
  Pass2866CustomerExportSupervisoryResolutionNoticeReceipt,
} from "@/lib/market-integrity/top1-customer-export-supervisory-residual-escalation-resolution-freeze-lift-gate";
import type {
  Pass2864CustomerExportSupervisoryCorrectedRescanReceipt,
  Pass2864CustomerExportSupervisoryResidualFindingRemediationRescanCloseGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-residual-finding-remediation-rescan-close-gate";
import type {
  Pass2865CustomerExportSupervisoryResidualEscalationNoticeReceipt,
  Pass2865CustomerExportSupervisoryResidualRemediationEscalationMissedSlaGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-residual-remediation-escalation-missed-sla-gate";
import type {
  Pass2861CustomerExportSupervisoryAccessExpiryReceipt,
  Pass2861CustomerExportSupervisoryRetentionJobExpiryMonitorGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-retention-job-expiry-monitor-gate";
import type {
  Pass2862CustomerExportSupervisoryAccessRevocationReceipt,
  Pass2862CustomerExportSupervisoryRetentionPurgeTombstoneGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-retention-purge-tombstone-gate";
import type {
  Pass2876CustomerExportSupervisoryReleaseEligibilityDecision,
  Pass2876CustomerExportSupervisoryStabilityEvidenceRollupReleaseEligibilityGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-stability-evidence-rollup-release-eligibility-gate";
import type {
  Pass2869CustomerExportSupervisoryTamperFinalNoticeReceipt,
  Pass2869CustomerExportSupervisoryTamperIncidentResolutionArchiveResumeGate,
  Pass2869CustomerExportSupervisoryTamperResolutionDecision,
} from "@/lib/market-integrity/top1-customer-export-supervisory-tamper-incident-resolution-archive-resume-gate";
import type {
  Pass2870CustomerExportSupervisoryPostResolutionDriftSignal,
  Pass2870CustomerExportSupervisoryTamperResolutionReconciliationClosureAuditGate,
} from "@/lib/market-integrity/top1-customer-export-supervisory-tamper-resolution-reconciliation-closure-audit-gate";
import type {
  Pass2846CustomerExportTransactionalOutboxHealthGate,
} from "@/lib/market-integrity/top1-customer-export-transactional-outbox-health-gate";
import type {
  Pass2847CustomerExportWorkerReplayRecoveryGate,
} from "@/lib/market-integrity/top1-customer-export-worker-replay-recovery-gate";
import type {
  Pass2834CustomerRemedyRefundCreditGate,
} from "@/lib/market-integrity/top1-customer-remedy-refund-credit-gate";
import type {
  Pass2826CustomerSafeNarrativeGate,
} from "@/lib/market-integrity/top1-customer-safe-narrative-gate";
import type {
  PaymentEntitlementBoundary,
  ReportAccessDecision,
  buildReportTokenPolicy,
} from "@/lib/market-integrity/top1-entitlement-report-access";
import type {
  Pass2828EvidenceArtifactHandoffGate,
} from "@/lib/market-integrity/top1-evidence-artifact-handoff-gate";
import type {
  Pass2818IconProvenanceGate,
} from "@/lib/market-integrity/top1-icon-provenance-gate";
import type {
  Pass2833IncidentDisclosureResponseGate,
} from "@/lib/market-integrity/top1-incident-disclosure-response-gate";
import type {
  Pass2827LaunchReadinessEvidenceGate,
} from "@/lib/market-integrity/top1-launch-readiness-evidence-gate";
import type {
  Pass2817MarketMicrostructureGate,
} from "@/lib/market-integrity/top1-market-microstructure-gate";
import type {
  Pass2819MobileAccessibilityOverlayGate,
} from "@/lib/market-integrity/top1-mobile-accessibility-overlay-gate";
import type {
  Pass2820PdfRenderCleanroomGate,
} from "@/lib/market-integrity/top1-pdf-render-cleanroom-gate";
import type {
  Pass2832ProductionCanaryRollbackGate,
} from "@/lib/market-integrity/top1-production-canary-rollback-gate";
import type {
  Pass2830ReleasePacketSealGate,
} from "@/lib/market-integrity/top1-release-packet-seal-gate";
import type {
  Pass2829ReleaseProofCollectorGate,
} from "@/lib/market-integrity/top1-release-proof-collector-gate";
import type {
  Pass2836RemedyReopenReplayLockGate,
} from "@/lib/market-integrity/top1-remedy-reopen-replay-lock-gate";
import type {
  Pass2815ReportIntegrityVault,
} from "@/lib/market-integrity/top1-report-integrity-vault";
import type {
  ChartLifecycleReceipt,
  PdfChartRenderDecision,
  SourceReceipt,
  VelmereTier,
} from "@/lib/market-integrity/top1-risk-foundation";
import type {
  Pass2816ProviderRunLedger,
} from "@/lib/market-integrity/top1-runtime-observability-ledger";
import type {
  Pass2831SealDriftMonitorGate,
} from "@/lib/market-integrity/top1-seal-drift-monitor-gate";
import type {
  Pass2814SourcePoisoningFirewall,
} from "@/lib/market-integrity/top1-source-poisoning-ssrf-firewall";
import type {
  Pass2837SupportSlaRemedyProofGate,
} from "@/lib/market-integrity/top1-support-sla-remedy-proof-gate";
import type {
  TierDifferentiationGate,
  TierEvidenceProfile,
  buildChartTierPdfGuard,
} from "@/lib/market-integrity/top1-tier-differentiation";
import type {
  VlmBrainClaimFirewall,
  VlmBrainSourcePlan,
} from "@/lib/market-integrity/top1-vlm-brain-source-router";

export type VelmerePdfReportPayloadV2 = {
  schemaVersion: "velmere-pdf-payload-v2";
  reportId: string;
  locale: "pl" | "en" | "de";
  tier: VelmereTier;
  generatedAt: string;
  methodologyVersion: "top1-risk-methodology-v1";
  sourceRegistryVersion: "source-registry-v1";
  target: {
    symbol: string;
    name: string;
    family: VelmereReportAssetFamily;
    chain?: string;
  };
  summary: {
    riskScore: number;
    riskLabel: string;
    confidenceScore: number;
    confidenceLabel: string;
    gradeLabel: string;
    sourceQuorum: "met" | "partial" | "failed";
    confidenceCapReason: string;
  };
  receipts: SourceReceipt[];
  missingEvidence: string[];
  providerConflicts: string[];
  chartManifest: {
    chartMode: "live_ohlcv" | "fixture" | "fallback" | "unavailable";
    timeframe: string;
    sourceLabel: string;
    lastUpdated: string;
    evidenceFingerprint: string;
    uiPdfParityRequired: boolean;
    lifecycleReceipt: ChartLifecycleReceipt;
    pdfRenderDecision: PdfChartRenderDecision;
    rendererInstruction: string;
  };
  tierBoundary: {
    visibleDepth: string;
    lockedDepth: string;
  };
  tierEvidenceProfile: TierEvidenceProfile;
  tierDifferentiationGate: TierDifferentiationGate;
  chartTierPdfGuard: ReturnType<typeof buildChartTierPdfGuard>;
  paymentEntitlementBoundary: PaymentEntitlementBoundary;
  reportAccessDecision: ReportAccessDecision;
  reportTokenPolicy: ReturnType<typeof buildReportTokenPolicy>;
  vlmBrainSourcePlan: VlmBrainSourcePlan;
  vlmBrainClaimFirewall: VlmBrainClaimFirewall;
  sourcePoisoningFirewall: Pass2814SourcePoisoningFirewall;
  reportIntegrityVault: Pass2815ReportIntegrityVault;
  runtimeObservabilityLedger: Pass2816ProviderRunLedger;
  marketMicrostructureGate: Pass2817MarketMicrostructureGate;
  iconProvenanceGate: Pass2818IconProvenanceGate;
  mobileAccessibilityOverlayGate: Pass2819MobileAccessibilityOverlayGate;
  pdfRenderCleanroomGate: Pass2820PdfRenderCleanroomGate;
  customerDeliveryLedger: Pass2821CustomerDeliveryLedger;
  accountVaultTokenConsumptionGate: Pass2822AccountVaultTokenConsumptionGate;
  advancedHumanReviewSignoffGate: Pass2823OperatorReviewGate;
  advancedReviewReplayAuditGate: Pass2824AdvancedReviewReplayAuditGate;
  communitySourceUpgradeModerationGate: Pass2825CommunitySourceUpgradeModerationGate;
  customerSafeNarrativeGate: Pass2826CustomerSafeNarrativeGate;
  launchReadinessEvidenceGate: Pass2827LaunchReadinessEvidenceGate;
  evidenceArtifactHandoffGate: Pass2828EvidenceArtifactHandoffGate;
  releaseProofCollectorGate: Pass2829ReleaseProofCollectorGate;
  releasePacketSealGate: Pass2830ReleasePacketSealGate;
  sealDriftMonitorGate: Pass2831SealDriftMonitorGate;
  productionCanaryRollbackGate: Pass2832ProductionCanaryRollbackGate;
  incidentDisclosureResponseGate: Pass2833IncidentDisclosureResponseGate;
  customerRemedyRefundCreditGate: Pass2834CustomerRemedyRefundCreditGate;
  accountVaultRemedyReopenAuditGate: Pass2835AccountVaultRemedyReopenAuditGate;
  remedyReopenReplayLockGate: Pass2836RemedyReopenReplayLockGate;
  supportSlaRemedyProofGate: Pass2837SupportSlaRemedyProofGate;
  customerExportRedactionPacketGate: Pass2838CustomerExportRedactionPacketGate;
  customerExportExpiryRecallGate: Pass2839CustomerExportExpiryRecallGate;
  customerExportDeliveryLedgerPersistenceGate: Pass2840CustomerExportDeliveryLedgerPersistenceGate;
  customerExportAcknowledgementSignedReceiptGate: Pass2841CustomerExportAcknowledgementSignedReceiptGate;
  customerExportDisputeChargebackHoldGate: Pass2842CustomerExportDisputeChargebackHoldGate;
  customerExportOperatorReleaseReinstatementGate: Pass2843CustomerExportOperatorReleaseReinstatementGate;
  customerExportPostReinstatementAuditNotificationGate: Pass2844CustomerExportPostReinstatementAuditNotificationGate;
  customerExportRuntimeAdapterStubGate: Pass2845CustomerExportRuntimeAdapterStubGate;
  customerExportTransactionalOutboxHealthGate: Pass2846CustomerExportTransactionalOutboxHealthGate;
  customerExportWorkerReplayRecoveryGate: Pass2847CustomerExportWorkerReplayRecoveryGate;
  customerExportReconciliationDriftMonitorGate: Pass2848CustomerExportReconciliationDriftMonitorGate;
  customerExportRemediationTicketCloseGate: Pass2849CustomerExportRemediationTicketCloseGate;
  customerExportFinalArchiveBundleGate: Pass2850CustomerExportFinalArchiveBundleGate;
  customerExportArchiveRetentionLegalHoldGate: Pass2851CustomerExportArchiveRetentionLegalHoldGate;
  customerExportRetentionPurgeExecutionTombstoneGate: Pass2852CustomerExportRetentionPurgeExecutionTombstoneGate;
  customerExportPostPurgePrivacyAttestationGate: Pass2853CustomerExportPostPurgePrivacyAttestationGate;
  customerExportPrivacyIncidentDsrEscalationGate: Pass2854CustomerExportPrivacyIncidentDsrEscalationGate;
  customerExportDsrDeliveryAppealReopenGate: Pass2855CustomerExportDsrDeliveryAppealReopenGate;
  customerExportDsrAppealResolutionClosureGate: Pass2856CustomerExportDsrAppealResolutionClosureGate;
  customerExportPrivacyCaseSupervisorSlaGate: Pass2857CustomerExportPrivacyCaseSupervisorSlaGate;
  customerExportSupervisoryEvidenceIndexGate: Pass2858CustomerExportSupervisoryEvidenceIndexGate;
  customerExportSupervisoryDisclosureResponseCorrectionGate: Pass2859CustomerExportSupervisoryDisclosureResponseCorrectionGate;
  customerExportSupervisoryDisclosureFinalCloseGate: Pass2860CustomerExportSupervisoryDisclosureFinalCloseGate;
  customerExportSupervisoryRetentionJobExpiryMonitorGate: Pass2861CustomerExportSupervisoryRetentionJobExpiryMonitorGate;
  customerExportSupervisoryRetentionPurgeTombstoneGate: Pass2862CustomerExportSupervisoryRetentionPurgeTombstoneGate;
  customerExportSupervisoryPostPurgeResidualEvidenceScanGate: Pass2863CustomerExportSupervisoryPostPurgeResidualEvidenceScanGate;
  customerExportSupervisoryResidualFindingRemediationRescanCloseGate: Pass2864CustomerExportSupervisoryResidualFindingRemediationRescanCloseGate;
  customerExportSupervisoryResidualRemediationEscalationMissedSlaGate: Pass2865CustomerExportSupervisoryResidualRemediationEscalationMissedSlaGate;
  customerExportSupervisoryResidualEscalationResolutionFreezeLiftGate: Pass2866CustomerExportSupervisoryResidualEscalationResolutionFreezeLiftGate;
  customerExportSupervisoryFinalEvidenceIndexFreezeGate: Pass2867CustomerExportSupervisoryFinalEvidenceIndexFreezeGate;
  customerExportSupervisoryEvidenceIndexTamperIncidentGate: Pass2868CustomerExportSupervisoryEvidenceIndexTamperIncidentGate;
  customerExportSupervisoryTamperIncidentResolutionArchiveResumeGate: Pass2869CustomerExportSupervisoryTamperIncidentResolutionArchiveResumeGate;
  customerExportSupervisoryTamperResolutionReconciliationClosureAuditGate: Pass2870CustomerExportSupervisoryTamperResolutionReconciliationClosureAuditGate;
  customerExportSupervisoryPostClosureMutationWatchAutoFreezeGate: Pass2871CustomerExportSupervisoryPostClosureMutationWatchAutoFreezeGate;
  customerExportSupervisoryPostClosureMutationIncidentResolutionRecloseGate: Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionRecloseGate;
  customerExportSupervisoryPostRecloseRegressionSloGate: Pass2873CustomerExportSupervisoryPostRecloseRegressionSloGate;
  customerExportSupervisoryRecurrenceEscalationResolutionRebaselineGate: Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionRebaselineGate;
  customerExportSupervisoryPostRebaselineStabilityEnforcementGate: Pass2875CustomerExportSupervisoryPostRebaselineStabilityEnforcementGate;
  customerExportSupervisoryStabilityEvidenceRollupReleaseEligibilityGate: Pass2876CustomerExportSupervisoryStabilityEvidenceRollupReleaseEligibilityGate;
  customerExportSupervisoryPostReleaseChannelMonitorRollbackGate: Pass2877CustomerExportSupervisoryPostReleaseChannelMonitorRollbackGate;
  customerExportSupervisoryPostReleaseObservationCloseFinalChannelSealGate: Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealGate;
  pages: Array<{
    page: number;
    title: string;
    requiredForTier: VelmereTier;
    status: "prepared" | "requires_live_receipts" | "requires_human_review";
  }>;
  customerSafeDisclaimers: string[];
};

export type Top1PdfPayloadDraftArgs = {
  locale: "pl" | "en" | "de";
  tier: VelmereTier;
  symbol: string;
  name: string;
  family: VelmereReportAssetFamily;
  riskScore: number;
  sourceFamilyCount: number;
  missingEvidence: string[];
  providerConflicts?: string[];
  chartMode?: VelmerePdfReportPayloadV2["chartManifest"]["chartMode"];
  chartLifecycleReceipt?: ChartLifecycleReceipt;
  sourceIds?: string[];
  accountId?: string | null;
  serverReceiptId?: string | null;
  reportToken?: string | null;
  reportTokenStatus?: "issued" | "consumed" | "expired" | "revoked" | null;
  payloadHash?: string | null;
  deliveredPayloadHash?: string | null;
  manualReviewReceiptId?: string | null;
  accessVerification?: {
    accountBound: boolean;
    serverReceiptVerified: boolean;
    reportTokenVerified: boolean;
    payloadHashBound: boolean;
    manualReviewVerified?: boolean;
    source: "server_entitlement" | "trusted_internal" | "diagnostic_only";
  };
  sourceReceiptRoot?: string | null;
  resendRequested?: boolean;
  replayCount?: number;
  projectUrl?: string | null;
  operatorId?: string | null;
  operatorSignature?: string | null;
  reviewerNote?: string | null;
  reviewPayloadHash?: string | null;
  reviewedAt?: string | null;
  reviewRejected?: boolean;
  replayAttemptCount?: number;
  deliveredSourceReceiptRoot?: string | null;
  reviewSourceReceiptRoot?: string | null;
  operatorSignatureReplayHash?: string | null;
  signedReviewerNoteHash?: string | null;
  replayReviewerNoteHash?: string | null;
  communityContentType?:
    | "community_post"
    | "research_note"
    | "project_reply"
    | "risk_observation"
    | "audit_discussion"
    | "source_request"
    | "pdf"
    | "api";
  communityBody?: string | null;
  communityTitle?: string | null;
  communityTags?: string[];
  communityAuthorRole?:
    | "anonymous"
    | "member"
    | "verified_project"
    | "moderator"
    | "admin"
    | "operator";
  communitySourceUpgradeRequested?: boolean;
  communitySourceReceiptId?: string | null;
  communityModeratorId?: string | null;
  communityLinkCount?: number;
  communityPostsInWindow?: number;
  communityFirstPost?: boolean;
  communityUnsafeLinkBlocked?: boolean;
  narrativeText?: string | null;
  topDriversCount?: number;
  mitigatorsCount?: number;
  buildPassed?: boolean;
  typecheckPassed?: boolean;
  i18nPassed?: boolean;
  verifierPassedCount?: number;
  verifierTotalCount?: number;
  liveProviderSmokePassed?: boolean;
  screenshotQaPassed?: boolean;
  mobileQaPassed?: boolean;
  securityQaPassed?: boolean;
  pdfParityPassed?: boolean;
  buildArtifactId?: string | null;
  typecheckArtifactId?: string | null;
  i18nArtifactId?: string | null;
  verifierArtifactId?: string | null;
  liveProviderSmokeArtifactId?: string | null;
  screenshotPackArtifactId?: string | null;
  mobileScreenshotPackArtifactId?: string | null;
  securityScanArtifactId?: string | null;
  pdfParityPacketArtifactId?: string | null;
  sealedReleasePacketRequested?: boolean;
  releasePacketSealRequested?: boolean;
  releasePacketRevoked?: boolean;
  releasePacketCodeRefChanged?: boolean;
  sealMonitorLastReplayAt?: string | null;
  sealMonitorLatestHeartbeatAt?: string | null;
  sealMonitorHeartbeatCount?: number;
  sealMonitorFailedHeartbeatCount?: number;
  sealMonitorPayloadHashChanged?: boolean;
  sealMonitorSourceReceiptRootChanged?: boolean;
  sealMonitorProviderRegistryChanged?: boolean;
  sealMonitorPdfRendererChanged?: boolean;
  sealMonitorSecurityPolicyChanged?: boolean;
  sealMonitorEntitlementPolicyChanged?: boolean;
  sealMonitorChartRendererChanged?: boolean;
  sealMonitorMobileSurfaceChanged?: boolean;
  canaryTrafficPercent?: number;
  canaryMinimumObservationMinutes?: number;
  canaryObservedMinutes?: number;
  canaryErrorRatePercent?: number;
  canaryP95LatencyMs?: number;
  canaryProviderFailureRatePercent?: number;
  canaryPdfMismatchCount?: number;
  canaryEntitlementErrorCount?: number;
  canaryChartSkeletonSpike?: boolean;
  canaryCustomerDeliveryFailureCount?: number;
  canaryRollbackSwitchAvailable?: boolean;
  canaryRollbackExecuted?: boolean;
  incidentDetected?: boolean;
  incidentDataLeakSuspected?: boolean;
  incidentPaidEvidenceAffected?: boolean;
  incidentCustomerImpactCount?: number;
  incidentP0SecurityEventCount?: number;
  incidentProviderOutageMinutes?: number;
  incidentPublicStatusPageUpdated?: boolean;
  incidentCustomerNoticeDrafted?: boolean;
  incidentCustomerNoticeSent?: boolean;
  incidentSupportQueueReady?: boolean;
  incidentAffectedAccountsRedacted?: boolean;
  incidentPostmortemDueHours?: number;
  incidentPostmortemCompleted?: boolean;
  remedyPaidOrderAffected?: boolean;
  remedyDeliveryFailed?: boolean;
  remedyDuplicateChargeSuspected?: boolean;
  remedyRefundRequested?: boolean;
  remedyRefundApproved?: boolean;
  remedyCreditIssued?: boolean;
  remedySupportTicketId?: string | null;
  remedyPaymentReceiptId?: string | null;
  remedyAffectedAccountRefRedacted?: boolean;
  remedyRedactedEvidencePacketReady?: boolean;
  remedyManualFinanceReviewComplete?: boolean;
  accountVaultAuditTrailId?: string | null;
  deliveryLedgerEntryId?: string | null;
  consumedTokenReceiptId?: string | null;
  remedyDecisionId?: string | null;
  reopenReceiptId?: string | null;
  replaySealId?: string | null;
  accountVaultAllIdsRedacted?: boolean;
  accountVaultPayloadHashBound?: boolean;
  accountVaultSourceReceiptRootBound?: boolean;
  accountVaultRefundCreditDecisionBound?: boolean;
  accountVaultStaleRemedyDecision?: boolean;
  accountVaultReusedConsumedToken?: boolean;
  accountVaultTimelineGap?: boolean;
  accountVaultPayloadOrSourceRootDrift?: boolean;
  accountVaultRevokedAfterReopen?: boolean;
  accountVaultWatchWindowHours?: number;
  replayLockId?: string | null;
  newReportTokenHash?: string | null;
  oldTokenRevocationReceiptId?: string | null;
  deliveryDedupKey?: string | null;
  accountVaultTimelineHash?: string | null;
  replayLockAllIdsRedacted?: boolean;
  replayLockPayloadHashBound?: boolean;
  replayLockSourceReceiptRootBound?: boolean;
  replayLockEntitlementPolicyBound?: boolean;
  replayLockAccountVaultReopenReceiptBound?: boolean;
  duplicateDeliveryAttempt?: boolean;
  oldTokenPresented?: boolean;
  reopenReceiptReplayMismatch?: boolean;
  tokenRotationMissing?: boolean;
  replayLockWatchWindowExpired?: boolean;
  replayLockPayloadOrSourceRootDrift?: boolean;
  replayLockRevoked?: boolean;

  supportTicketId?: string | null;
  remedySlaPolicyId?: string | null;
  supportOwnerPseudonym?: string | null;
  customerNoticeReceiptId?: string | null;
  supportPacketHash?: string | null;
  financeRemedyReceiptId?: string | null;
  deliveryReopenApprovedAt?: string | null;
  supportSlaDueHours?: number;
  supportActualFirstResponseHours?: number | null;
  supportCurrentAgeHours?: number;
  supportPacketRedacted?: boolean;
  supportRefundCreditReceiptBound?: boolean;
  supportCustomerReplyUnresolved?: boolean;
  supportEscalated?: boolean;
  supportPayloadHashBound?: boolean;
  supportSourceReceiptRootBound?: boolean;
  supportPayloadOrSourceRootDrift?: boolean;
  customerExportRequested?: boolean;
  customerExportPacketId?: string | null;
  customerExportChannel?: Pass2838CustomerExportChannel;
  customerDownloadId?: string | null;
  customerEmailNoticeId?: string | null;
  customerApiHandoffId?: string | null;
  customerSupportCaseCloseReceiptId?: string | null;
  customerRedactionManifestHash?: string | null;
  customerMinimizationPolicyId?: string | null;
  customerAckReceiptId?: string | null;
  customerExportAllIdsRedacted?: boolean;
  customerExportRawTokensRemoved?: boolean;
  customerExportRawPaymentIdsRemoved?: boolean;
  customerExportPrivateNotesRemoved?: boolean;
  customerExportSupportMessagesSummarized?: boolean;
  customerExportPayloadHashBound?: boolean;
  customerExportSourceReceiptRootBound?: boolean;
  customerExportPayloadOrSourceRootDrift?: boolean;
  customerExportRevoked?: boolean;
  customerExportAckRequired?: boolean;
  customerExportActiveLinkId?: string | null;
  customerExportIssuedAt?: string | null;
  customerExportExpiresAt?: string | null;
  customerExportExpiryWindowMinutes?: number;
  customerExportRecallRequested?: boolean;
  customerExportRecallReceiptId?: string | null;
  customerExportResendRequested?: boolean;
  customerExportResendIdempotencyKey?: string | null;
  customerExportRetryBudgetLimit?: number;
  customerExportRetryBudgetUsed?: number;
  customerExportSupportAttachmentRetentionHours?: number;
  customerExportSupportAttachmentCreatedAt?: string | null;
  customerExportAuditTimelineHash?: string | null;
  customerExportExpiryPayloadOrSourceRootDrift?: boolean;
  customerExportLedgerRowId?: string | null;
  customerExportLedgerPayloadHash?: string | null;
  customerExportLedgerSourceReceiptRoot?: string | null;
  customerExportLedgerSupportSlaTicketId?: string | null;
  customerExportLedgerStatus?: "pending" | "active" | "expired" | "recalled" | "retention_closed" | "blocked";
  customerExportLedgerRequestedChannel?: Pass2840CustomerExportLedgerChannel;
  customerExportLinkStorageAdapterReady?: boolean;
  customerExportRecallTimelineStoreReady?: boolean;
  customerExportResendIdempotencyStoreReady?: boolean;
  customerExportRetryBudgetCounterAtomic?: boolean;
  customerExportSupportAttachmentRetentionJobReady?: boolean;
  customerExportChannelEventStoreReady?: boolean;
  customerExportAccountVaultEventId?: string | null;
  customerExportEmailNoticeEventId?: string | null;
  customerExportApiHandoffEventId?: string | null;
  customerExportSupportAttachmentEventId?: string | null;
  customerExportLedgerPayloadOrSourceRootDrift?: boolean;
  customerExportAckSignedRequired?: boolean;
  customerExportAckLedgerRowId?: string | null;
  customerExportAckReceiptId?: string | null;
  customerExportSignedReceiptId?: string | null;
  customerExportAckPresentedExportPacketId?: string | null;
  customerExportAckPresentedPayloadHash?: string | null;
  customerExportAckPresentedSourceReceiptRoot?: string | null;
  customerExportAcknowledgedAt?: string | null;
  customerExportAckExpiresAt?: string | null;
  customerExportAckChannel?: Pass2841CustomerAckChannel;
  customerExportAckCustomerAccountIdHash?: string | null;
  customerExportAckSignatureHash?: string | null;
  customerExportAckSignatureVerified?: boolean;
  customerExportAckSignerNonceHash?: string | null;
  customerExportAckOperatorCountersignatureId?: string | null;
  customerExportAckNotificationOpenReceiptId?: string | null;
  customerExportAckIpHash?: string | null;
  customerExportAckUserAgentHash?: string | null;
  customerExportAckChannelMismatch?: boolean;
  customerExportAckPacketHashOrSourceRootMismatch?: boolean;
  customerExportAckPayloadOrSourceRootDrift?: boolean;
  customerExportAckCustomerDisputed?: boolean;
  customerExportAckRevoked?: boolean;
  customerExportHoldRequired?: boolean;
  customerExportActiveHoldReason?: Pass2842CustomerExportHoldReason;
  customerExportDisputeCaseId?: string | null;
  customerExportChargebackCaseId?: string | null;
  customerExportPaymentWithdrawalReceiptId?: string | null;
  customerExportPolicyHoldReceiptId?: string | null;
  customerExportComplianceReviewReceiptId?: string | null;
  customerExportRefundCreditReceiptId?: string | null;
  customerExportHoldSupportTicketId?: string | null;
  customerExportHoldOpenedAt?: string | null;
  customerExportHoldExpiresAt?: string | null;
  customerExportHoldReleaseReceiptId?: string | null;
  customerExportHoldOperatorReviewReceiptId?: string | null;
  customerExportHoldPayloadHashBound?: string | null;
  customerExportHoldSourceReceiptRootBound?: string | null;
  customerExportPaymentDisputeActive?: boolean;
  customerExportChargebackActive?: boolean;
  customerExportPaymentWithdrawalPending?: boolean;
  customerExportPolicyViolationHold?: boolean;
  customerExportComplianceHold?: boolean;
  customerExportCustomerDisputeOpen?: boolean;
  customerExportRefundCreditCollision?: boolean;
  customerExportHoldPayloadOrSourceRootDrift?: boolean;
  customerExportReleaseRequested?: boolean;
  customerExportReleaseDecision?: Pass2843CustomerExportOperatorReleaseDecision;
  customerExportOperatorReleaseReceiptId?: string | null;
  customerExportSeniorOperatorCountersignatureId?: string | null;
  customerExportFinanceCloseReceiptId?: string | null;
  customerExportComplianceCloseReceiptId?: string | null;
  customerExportSupportResolutionReceiptId?: string | null;
  customerExportReinstatementNoticeReceiptId?: string | null;
  customerExportReissuedLinkId?: string | null;
  customerExportChannelReinstatementReceiptId?: string | null;
  customerExportReinstatementDedupKey?: string | null;
  customerExportCoolingWindowEndsAt?: string | null;
  customerExportReinstatementPayloadHashBound?: string | null;
  customerExportReinstatementSourceReceiptRootBound?: string | null;
  customerExportPreviousHoldReleaseReceiptId?: string | null;
  customerExportPreviousOperatorReviewReceiptId?: string | null;
  customerExportDuplicateReinstatementAttempt?: boolean;
  customerExportReinstatementPayloadOrSourceRootDrift?: boolean;
  customerExportPostReinstatedAuditId?: string | null;
  customerExportPostReleaseAuditReceiptId?: string | null;
  customerExportNotificationDispatchReceiptId?: string | null;
  customerExportNotificationOpenReceiptId?: string | null;
  customerExportNotificationContentHash?: string | null;
  customerExportNotificationChannel?: Pass2844CustomerExportNotificationChannel;
  customerExportNotificationChannelBindingReceiptId?: string | null;
  customerExportNotificationCustomerAccountHash?: string | null;
  customerExportNotificationPayloadHashBound?: string | null;
  customerExportNotificationSourceReceiptRootBound?: string | null;
  customerExportNotificationDeliveryAuditTimelineHash?: string | null;
  customerExportNotificationReissuedExportLinkId?: string | null;
  customerExportNotificationPreviousOperatorReleaseReceiptId?: string | null;
  customerExportNotificationPreviousChannelReinstatementReceiptId?: string | null;
  customerExportNotificationIncidentNoConflictReceiptId?: string | null;
  customerExportNotificationRetentionSnapshotId?: string | null;
  customerExportNotificationPayloadOrSourceRootDrift?: boolean;
  customerExportNotificationContentMismatch?: boolean;
  customerExportRuntimeStorageAdapterInterfaceId?: string | null;
  customerExportRuntimeMemoryDevAdapterId?: string | null;
  customerExportRuntimeDbAdapterContractId?: string | null;
  customerExportRuntimeEventWriterContractId?: string | null;
  customerExportRuntimeAtomicRetryIncrementFnId?: string | null;
  customerExportRuntimeSignedAcknowledgementVerifierId?: string | null;
  customerExportRuntimeDisputeHoldReleaseWriterId?: string | null;
  customerExportRuntimeOperatorReleaseReinstatementWriterId?: string | null;
  customerExportRuntimePostReinstatementNotificationWriterId?: string | null;
  customerExportRuntimeRetentionJobDryRunVerifierId?: string | null;
  customerExportRuntimeAccountVaultEventWriterId?: string | null;
  customerExportRuntimeEmailEventWriterId?: string | null;
  customerExportRuntimeApiHandoffEventWriterId?: string | null;
  customerExportRuntimeSupportAttachmentEventWriterId?: string | null;
  customerExportRuntimeAppendOnlyEventKinds?: Pass2845CustomerExportRuntimeEventKind[];
  customerExportRuntimePreviousPostNotificationReceiptId?: string | null;
  customerExportRuntimePayloadHashBound?: string | null;
  customerExportRuntimeSourceReceiptRootBound?: string | null;
  customerExportRuntimePayloadOrSourceRootDrift?: boolean;
  customerExportOutboxTableId?: string | null;
  customerExportOutboxPendingQueueId?: string | null;
  customerExportOutboxWorkerLeaseLockId?: string | null;
  customerExportOutboxDeadLetterQueueId?: string | null;
  customerExportOutboxWorkerHeartbeatReceiptId?: string | null;
  customerExportOutboxHealthProbeReceiptId?: string | null;
  customerExportOutboxPoisonMessagePolicyId?: string | null;
  customerExportOutboxAccountVaultCommitReceiptId?: string | null;
  customerExportOutboxEmailCommitReceiptId?: string | null;
  customerExportOutboxApiCommitReceiptId?: string | null;
  customerExportOutboxSupportCommitReceiptId?: string | null;
  customerExportOutboxRetryBackoffPolicyId?: string | null;
  customerExportOutboxMaxAttemptPolicyId?: string | null;
  customerExportOutboxPayloadHashBound?: string | null;
  customerExportOutboxSourceReceiptRootBound?: string | null;
  customerExportOutboxPayloadOrSourceRootDrift?: boolean;
  customerExportRecoveryDeadLetterReceiptId?: string | null;
  customerExportRecoveryPoisonOperatorReviewReceiptId?: string | null;
  customerExportRecoveryReplayIdempotencyKey?: string | null;
  customerExportRecoveryAccountVaultReplayCommitReceiptId?: string | null;
  customerExportRecoveryEmailReplayCommitReceiptId?: string | null;
  customerExportRecoveryApiReplayCommitReceiptId?: string | null;
  customerExportRecoverySupportReplayCommitReceiptId?: string | null;
  customerExportRecoveryStuckLeaseUnlockPolicyId?: string | null;
  customerExportRecoveryStuckLeaseUnlockReceiptId?: string | null;
  customerExportRecoveryWorkerLagSloPolicyId?: string | null;
  customerExportRecoveryMaxWorkerLagSeconds?: number | null;
  customerExportRecoveryAuditTimelineHash?: string | null;
  customerExportRecoveryPayloadHashBound?: string | null;
  customerExportRecoverySourceReceiptRootBound?: string | null;
  customerExportRecoveryPayloadOrSourceRootDrift?: boolean;
  customerExportReconciliationRunId?: string | null;
  customerExportReconciliationLedgerSnapshotId?: string | null;
  customerExportReconciliationOutboxSnapshotId?: string | null;
  customerExportReconciliationStorageSnapshotId?: string | null;
  customerExportReconciliationCustomerReceiptSnapshotId?: string | null;
  customerExportReconciliationChannelCommitSnapshotId?: string | null;
  customerExportReconciliationExpectedPayloadHash?: string | null;
  customerExportReconciliationExpectedSourceReceiptRoot?: string | null;
  customerExportReconciliationObservedPayloadHash?: string | null;
  customerExportReconciliationObservedSourceReceiptRoot?: string | null;
  customerExportReconciliationDriftMismatchCount?: number;
  customerExportReconciliationLastReconciledAt?: string | null;
  customerExportReconciliationNextReconcileDueAt?: string | null;
  customerExportReconciliationDriftRemediationTicketId?: string | null;
  customerExportReconciliationAuditTimelineHash?: string | null;
  customerExportReconciliationChannelSnapshots?: Pass2848CustomerExportChannelSnapshot[];
  customerExportReconciliationDriftDetected?: boolean;
  customerExportRemediationTicketId?: string | null;
  customerExportRemediationRootCause?: Pass2849CustomerExportRemediationRootCause | null;
  customerExportRemediationOperatorReceiptId?: string | null;
  customerExportRemediationReplayAndResealReceiptId?: string | null;
  customerExportRemediationCorrectedPayloadHash?: string | null;
  customerExportRemediationCorrectedSourceReceiptRoot?: string | null;
  customerExportRemediationCustomerImpactAssessmentId?: string | null;
  customerExportRemediationFreezeLiftDecisionReceiptId?: string | null;
  customerExportRemediationCustomerNoticeReceiptId?: string | null;
  customerExportRemediationClosedAt?: string | null;
  customerExportRemediationAuditTimelineHash?: string | null;
  customerExportRemediationNoResidualDriftReceiptId?: string | null;
  customerExportRemediationNoDriftCloseAssertionId?: string | null;
  customerExportRemediationResidualDriftDetected?: boolean;
  customerExportFinalArchiveBundleId?: string | null;
  customerExportFinalArchiveManifestHash?: string | null;
  customerExportFinalArchiveImmutableStorageReceiptId?: string | null;
  customerExportFinalArchiveRetentionPolicySnapshotId?: string | null;
  customerExportFinalArchivePayloadHash?: string | null;
  customerExportFinalArchiveSourceReceiptRoot?: string | null;
  customerExportFinalArchiveCustomerAccessIndexId?: string | null;
  customerExportFinalArchiveOperatorSignoffReceiptId?: string | null;
  customerExportFinalArchiveClosedAt?: string | null;
  customerExportFinalArchiveAuditTimelineHash?: string | null;
  customerExportFinalArchiveIntegrityDriftDetected?: boolean;
  customerExportFinalArchiveChannelReceipts?: Pass2850CustomerExportArchiveChannelReceipt[] | null;
  customerExportArchiveRetentionPolicyId?: string | null;
  customerExportArchiveRetentionClass?: Pass2851CustomerExportRetentionClass | null;
  customerExportArchiveLegalHoldStatusReceiptId?: string | null;
  customerExportArchiveLegalHoldActive?: boolean;
  customerExportArchiveCustomerDeletionRequestId?: string | null;
  customerExportArchiveDeletionEligibilityReceiptId?: string | null;
  customerExportArchiveRetentionTimerReceiptId?: string | null;
  customerExportArchiveScheduledPurgeAt?: string | null;
  customerExportArchiveTombstoneId?: string | null;
  customerExportArchiveAccessRevocationReceiptId?: string | null;
  customerExportArchiveCustomerAccessIndexUpdateReceiptId?: string | null;
  customerExportArchiveOperatorRetentionSignoffReceiptId?: string | null;
  customerExportArchiveRetentionDeletionTimelineHash?: string | null;
  customerExportArchiveChannelPurgeReceipts?: Pass2851CustomerExportChannelPurgeReceipt[] | null;
  customerExportPurgeWorkerRunId?: string | null;
  customerExportPurgeLegalHoldReleaseReceiptId?: string | null;
  customerExportPurgeStorageLifecycleExecutionReceiptId?: string | null;
  customerExportPurgeTombstoneManifestHash?: string | null;
  customerExportPurgeVerifiedArchiveTombstoneId?: string | null;
  customerExportPurgeCustomerIndexPurgeMarkerId?: string | null;
  customerExportPurgeImmutableAuditReceiptId?: string | null;
  customerExportPurgePostPurgeReconciliationReceiptId?: string | null;
  customerExportPurgeOperatorSignoffReceiptId?: string | null;
  customerExportPurgeCompletedAt?: string | null;
  customerExportPurgePostPurgeDriftDetected?: boolean;
  customerExportPurgeChannelExecutionReceipts?: Pass2852CustomerExportChannelPurgeExecutionReceipt[] | null;
  customerExportPostPurgeResidualScannerRunId?: string | null;
  customerExportPostPurgeResidualScanManifestHash?: string | null;
  customerExportPostPurgeSearchIndexPurgeReceiptId?: string | null;
  customerExportPostPurgeCdnCachePurgeReceiptId?: string | null;
  customerExportPostPurgeResidualDataDetected?: boolean;
  customerExportPostPurgeResidualDataRemediationTicketId?: string | null;
  customerExportPostPurgePrivacyAttestationReceiptId?: string | null;
  customerExportPostPurgePrivacyOfficerSignoffReceiptId?: string | null;
  customerExportPostPurgeCustomerFinalPrivacyNoticeReceiptId?: string | null;
  customerExportPostPurgePrivacyReconciliationHash?: string | null;
  customerExportPostPurgeChannelResidualScanReceipts?: Pass2853CustomerExportResidualScanReceipt[] | null;
  customerExportPrivacyIncidentResidualDetected?: boolean;
  customerExportPrivacyIncidentClassification?: Pass2854CustomerExportResidualIncidentClassification | null;
  customerExportPrivacyIncidentReviewReceiptId?: string | null;
  customerExportPrivacyIncidentDeliveryFreezeReceiptId?: string | null;
  customerExportPrivacyIncidentCustomerImpactScopeId?: string | null;
  customerExportPrivacySecurityEscalationReceiptId?: string | null;
  customerExportPrivacyLegalRegulatorReviewBoundaryReceiptId?: string | null;
  customerExportPrivacyCustomerNoticeEscalationPathReceiptId?: string | null;
  customerExportDataSubjectAccessAuditPacketId?: string | null;
  customerExportDataSubjectAccessRedactionManifestHash?: string | null;
  customerExportDataSubjectAccessRawSecretLeakDetected?: boolean;
  customerExportPrivacyIncidentOperatorSignoffReceiptId?: string | null;
  customerExportPrivacyIncidentDsrTimelineHash?: string | null;
  customerExportDsrDeliveryReceiptId?: string | null;
  customerExportDsrCustomerAcknowledgementReceiptId?: string | null;
  customerExportDsrAppealWindowReceiptId?: string | null;
  customerExportDsrCustomerAppealRequested?: boolean;
  customerExportDsrAppealReviewReceiptId?: string | null;
  customerExportDsrAppealReopenDecisionReceiptId?: string | null;
  customerExportDsrAppealReopenFreezeReceiptId?: string | null;
  customerExportDsrReopenedAuditPacketId?: string | null;
  customerExportDsrReopenedRedactionManifestHash?: string | null;
  customerExportDsrDuplicateDeliveryGuardReceiptId?: string | null;
  customerExportDsrDeliveryChannelReceipts?: Pass2855CustomerExportDsrChannelDeliveryReceipt[] | null;
  customerExportDsrPrivacyCaseTimelineHash?: string | null;
  customerExportDsrAppealCaseIntakeReceiptId?: string | null;
  customerExportDsrAppealResolutionDecision?: Pass2856CustomerExportDsrAppealResolutionDecision | null;
  customerExportDsrAppealResolutionDecisionReceiptId?: string | null;
  customerExportDsrCorrectedAuditPacketId?: string | null;
  customerExportDsrCorrectedRedactionManifestHash?: string | null;
  customerExportDsrCorrectedPacketSupersedesPacketId?: string | null;
  customerExportDsrCorrectedChannelReceipts?: Pass2856CustomerExportDsrAppealResolutionChannelReceipt[] | null;
  customerExportDsrCustomerFinalResponseReceiptId?: string | null;
  customerExportDsrFinalPrivacyClosureReceiptId?: string | null;
  customerExportDsrNoResidualPrivacyObligationReceiptId?: string | null;
  customerExportDsrPrivacyCaseAuditTimelineHash?: string | null;
  customerExportPrivacyCaseStatus?: Pass2857CustomerExportPrivacyCaseStatus | null;
  customerExportPrivacyCaseSupervisorPseudonym?: string | null;
  customerExportPrivacyCaseSupervisorAssignmentReceiptId?: string | null;
  customerExportPrivacyCaseSlaPolicyId?: string | null;
  customerExportPrivacyCaseAppealResolutionDueAt?: string | null;
  customerExportPrivacyCaseAppealResolutionClosedAt?: string | null;
  customerExportPrivacyCaseCurrentAgeHours?: number;
  customerExportPrivacyCaseLegalSignoffLate?: boolean;
  customerExportPrivacyCaseSlaBreachDetected?: boolean;
  customerExportPrivacyCaseLateSignoffEscalationReceiptId?: string | null;
  customerExportPrivacyCaseDuplicateAppealCount?: number;
  customerExportPrivacyCaseDuplicateAppealThrottleReceiptId?: string | null;
  customerExportPrivacyCaseAbuseGuardReceiptId?: string | null;
  customerExportPrivacyCaseCommunicationCadenceReceiptId?: string | null;
  customerExportPrivacyCaseUnresolvedExportFreezeReceiptId?: string | null;
  customerExportPrivacyCaseSupervisorAuditTimelineHash?: string | null;
  customerExportSupervisoryRequestType?: Pass2858CustomerExportSupervisoryRequestType | null;
  customerExportSupervisoryCaseId?: string | null;
  customerExportSupervisoryLawfulBasisReceiptId?: string | null;
  customerExportSupervisoryMinimumDisclosureManifestHash?: string | null;
  customerExportSupervisoryRedactionManifestHash?: string | null;
  customerExportSupervisoryLegalPrivilegeReviewReceiptId?: string | null;
  customerExportSupervisoryEvidencePacketId?: string | null;
  customerExportSupervisoryEvidenceIndexHash?: string | null;
  customerExportSupervisoryChannelReceipts?: Pass2858CustomerExportSupervisoryChannelReceipt[] | null;
  customerExportSupervisoryCustomerNoticeDecisionReceiptId?: string | null;
  customerExportSupervisoryCustomerNoticeSuppressedReason?: string | null;
  customerExportSupervisoryExportFreezeReceiptId?: string | null;
  customerExportSupervisoryRawOperatorNotesIncluded?: boolean;
  customerExportSupervisoryRawAccountIdsIncluded?: boolean;
  customerExportSupervisoryRawPaymentIdsIncluded?: boolean;
  customerExportSupervisoryRawSupportMessagesIncluded?: boolean;
  customerExportSupervisoryAuditTimelineHash?: string | null;
  customerExportSupervisoryResponseType?: Pass2859CustomerExportSupervisoryResponseType | null;
  customerExportSupervisoryDisclosureResponseCaseId?: string | null;
  customerExportSupervisoryRequestIntakeReceiptId?: string | null;
  customerExportSupervisoryResponseDraftReceiptId?: string | null;
  customerExportSupervisorySupplementalEvidenceManifestHash?: string | null;
  customerExportSupervisoryCorrectionReviewReceiptId?: string | null;
  customerExportSupervisoryCorrectedPacketId?: string | null;
  customerExportSupervisoryCorrectedRedactionManifestHash?: string | null;
  customerExportSupervisoryOriginalArchiveBindingHash?: string | null;
  customerExportSupervisoryOriginalArchiveMutationAttempted?: boolean;
  customerExportSupervisoryResponseChannelReceipts?: Pass2859CustomerExportSupervisoryResponseChannelReceipt[] | null;
  customerExportSupervisoryResponseCustomerNoticeReassessmentReceiptId?: string | null;
  customerExportSupervisoryResponseCustomerNoticeSuppressedReason?: string | null;
  customerExportSupervisoryResponseExportFreezeReceiptId?: string | null;
  customerExportSupervisoryResponseAuditTimelineHash?: string | null;
  customerExportSupervisoryFinalCloseCaseId?: string | null;
  customerExportSupervisoryFinalResponseClosureReceiptId?: string | null;
  customerExportSupervisoryEvidenceRetentionLockReceiptId?: string | null;
  customerExportSupervisoryRetentionPolicySnapshotHash?: string | null;
  customerExportSupervisoryResponseCorrectionVersionIndexHash?: string | null;
  customerExportSupervisoryFinalChannelAckReceipts?: Pass2860CustomerExportSupervisoryFinalChannelAckReceipt[] | null;
  customerExportSupervisoryFinalCustomerNoticeDecisionReceiptId?: string | null;
  customerExportSupervisoryFinalCustomerNoticeSuppressedReason?: string | null;
  customerExportSupervisoryFinalExportFreezeReceiptId?: string | null;
  customerExportSupervisoryImmutableTimelineHash?: string | null;
  customerExportSupervisoryArchiveMutationAttemptedAfterClose?: boolean;
  customerExportSupervisoryRetentionJobScheduleId?: string | null;
  customerExportSupervisoryLegalHoldAwareExpiryMonitorId?: string | null;
  customerExportSupervisoryFinalCloseArchiveLockVerificationReceiptId?: string | null;
  customerExportSupervisoryOverdueRetentionAlertReceiptId?: string | null;
  customerExportSupervisoryRegulatorAuditorAccessExpiryProofId?: string | null;
  customerExportSupervisoryEvidenceRetentionUnlockRelockReceiptId?: string | null;
  customerExportSupervisoryAccessExpiryReceipts?: Pass2861CustomerExportSupervisoryAccessExpiryReceipt[] | null;
  customerExportSupervisoryRetentionMonitorTimelineHash?: string | null;
  customerExportSupervisoryRetentionLockManuallyBypassed?: boolean;
  customerExportSupervisoryRetentionExpiredAt?: string | null;
  customerExportSupervisoryRetentionExpiryVerifiedReceiptId?: string | null;
  customerExportSupervisoryRetentionLegalHoldActive?: boolean;
  customerExportSupervisoryRetentionAccessExtensionActive?: boolean;
  customerExportSupervisoryPurgeAuthorizationReceiptId?: string | null;
  customerExportSupervisoryAccessRevocationReceipts?: Pass2862CustomerExportSupervisoryAccessRevocationReceipt[] | null;
  customerExportSupervisoryArchiveLockReleaseReceiptId?: string | null;
  customerExportSupervisoryRetentionPurgeWorkerRunReceiptId?: string | null;
  customerExportSupervisoryTombstoneManifestHash?: string | null;
  customerExportSupervisoryTombstoneVerificationReceiptId?: string | null;
  customerExportSupervisoryPostPurgeReconciliationHash?: string | null;
  customerExportSupervisoryPurgeAttemptedDuringLegalHold?: boolean;
  customerExportSupervisoryPostPurgeLegalHoldRecheckReceiptId?: string | null;
  customerExportSupervisoryPostPurgeLegalHoldActive?: boolean;
  customerExportSupervisoryPostPurgeAccessExtensionActive?: boolean;
  customerExportSupervisoryPostPurgeResidualScannerRunId?: string | null;
  customerExportSupervisoryPostPurgeResidualScanManifestHash?: string | null;
  customerExportSupervisoryAccessIndexPurgeVerificationReceiptId?: string | null;
  customerExportSupervisorySupportLegalOperatorCachePurgeBatchReceiptId?: string | null;
  customerExportSupervisoryResidualEvidenceDetected?: boolean;
  customerExportSupervisoryResidualFindingRemediationTicketId?: string | null;
  customerExportSupervisoryFinalNoResidualAttestationReceiptId?: string | null;
  customerExportSupervisoryPrivacyLegalSignoffReceiptId?: string | null;
  customerExportSupervisoryPostPurgeResidualTimelineHash?: string | null;
  customerExportSupervisoryPostPurgeResidualChannelReceipts?: Pass2863CustomerExportSupervisoryResidualScanReceipt[] | null;
  customerExportSupervisoryNoResidualCarryForwardReceiptId?: string | null;
  customerExportSupervisoryResidualFindingTicketId?: string | null;
  customerExportSupervisoryResidualFindingSeverity?: "none" | "low" | "medium" | "high" | "critical";
  customerExportSupervisoryResidualRemediationOwnerId?: string | null;
  customerExportSupervisoryResidualRemediationSlaPolicyId?: string | null;
  customerExportSupervisoryResidualRemediationDueAt?: string | null;
  customerExportSupervisoryResidualRemediationFixReceiptId?: string | null;
  customerExportSupervisoryCorrectedRescanRunId?: string | null;
  customerExportSupervisoryCorrectedRescanManifestHash?: string | null;
  customerExportSupervisoryCorrectedChannelRescanReceipts?: Pass2864CustomerExportSupervisoryCorrectedRescanReceipt[] | null;
  customerExportSupervisoryCorrectedNoResidualAttestationReceiptId?: string | null;
  customerExportSupervisoryRegulatorAuditorNoticeDecision?: "not_required" | "notify_regulator" | "notify_auditor" | "notify_both" | null;
  customerExportSupervisoryRegulatorAuditorNoticeReceiptId?: string | null;
  customerExportSupervisoryResidualRemediationCloseSignoffReceiptId?: string | null;
  customerExportSupervisoryResidualRemediationTimelineHash?: string | null;
  customerExportSupervisoryMissedSlaMonitorReceiptId?: string | null;
  customerExportSupervisoryResidualRemediationSlaBreached?: boolean;
  customerExportSupervisoryResidualRemediationCurrentAgeHours?: number;
  customerExportSupervisoryMissedSlaDetectionReceiptId?: string | null;
  customerExportSupervisoryResidualSupervisorEscalationReceiptId?: string | null;
  customerExportSupervisoryResidualEscalationSupervisorPseudonym?: string | null;
  customerExportSupervisoryUnresolvedResidualFreezeExtensionReceiptId?: string | null;
  customerExportSupervisoryResidualFreezeExtendedUntil?: string | null;
  customerExportSupervisoryNoticeEscalationDecisionReceiptId?: string | null;
  customerExportSupervisoryNoticeEscalationReceipts?: Pass2865CustomerExportSupervisoryResidualEscalationNoticeReceipt[] | null;
  customerExportSupervisoryOperatorOverrideRequested?: boolean;
  customerExportSupervisoryOperatorOverrideReviewReceiptId?: string | null;
  customerExportSupervisoryOperatorOverrideApproved?: boolean;
  customerExportSupervisoryOperatorOverrideControlsReceiptId?: string | null;
  customerExportSupervisoryOperatorOverrideReasonHash?: string | null;
  customerExportSupervisoryMissedSlaEscalationTimelineHash?: string | null;
  customerExportSupervisoryEscalationResolutionCaseId?: string | null;
  customerExportSupervisoryResolutionDecisionReceiptId?: string | null;
  customerExportSupervisoryResolutionDecision?: "continue_freeze" | "lift_freeze" | "partial_lift" | "reject_lift" | null;
  customerExportSupervisoryRemediationCatchupProofReceiptId?: string | null;
  customerExportSupervisoryFreshResidualRescanRunId?: string | null;
  customerExportSupervisoryFreshResidualRescanManifestHash?: string | null;
  customerExportSupervisoryResidualStillDetectedAfterEscalation?: boolean;
  customerExportSupervisoryResolutionCorrectedNoResidualAttestationReceiptId?: string | null;
  customerExportSupervisoryFreezeLiftDecisionReceiptId?: string | null;
  customerExportSupervisoryFreezeLiftReceiptId?: string | null;
  customerExportSupervisoryFreezeLiftEffectiveAt?: string | null;
  customerExportSupervisoryResolutionNoticeReceipts?: Pass2866CustomerExportSupervisoryResolutionNoticeReceipt[] | null;
  customerExportSupervisoryResolutionOverrideUsed?: boolean;
  customerExportSupervisoryResolutionOverrideCounterSignReceiptId?: string | null;
  customerExportSupervisoryResolutionOverrideReasonHash?: string | null;
  customerExportSupervisoryEscalationResolutionTimelineHash?: string | null;
  customerExportSupervisoryFinalEvidenceIndexId?: string | null;
  customerExportSupervisoryFinalEvidenceIndexVersion?: string | null;
  customerExportSupervisoryFinalEvidenceIndexHash?: string | null;
  customerExportSupervisoryImmutableArchiveBindingHash?: string | null;
  customerExportSupervisoryFreezeLiftReceiptBindingHash?: string | null;
  customerExportSupervisoryResolutionTimelineBindingHash?: string | null;
  customerExportSupervisoryFinalEvidenceIndexFreezeReceiptId?: string | null;
  customerExportSupervisoryMutationAttemptMonitorReceiptId?: string | null;
  customerExportSupervisoryEvidenceIndexMutationAttempts?: Pass2867CustomerExportSupervisoryEvidenceIndexMutationAttempt[] | null;
  customerExportSupervisoryFinalEvidenceIndexOperatorAuditSignoffReceiptId?: string | null;
  customerExportSupervisoryFinalEvidenceIndexLegalAuditSignoffReceiptId?: string | null;
  customerExportSupervisoryEvidenceIndexFrozenAt?: string | null;
  customerExportSupervisoryFinalEvidenceIndexFreezeTimelineHash?: string | null;
  customerExportSupervisoryTamperSignalReceiptId?: string | null;
  customerExportSupervisoryTamperSignalKind?: "write_attempt" | "delete_attempt" | "reindex_attempt" | "hash_drift" | "channel_rebind" | "unknown";
  customerExportSupervisoryTamperIncidentCaseId?: string | null;
  customerExportSupervisoryTamperSeverity?: Pass2868CustomerExportSupervisoryEvidenceIndexTamperSeverity | null;
  customerExportSupervisoryEvidenceIndexFreezeExtensionReceiptId?: string | null;
  customerExportSupervisoryArchiveCloseFreezeReceiptId?: string | null;
  customerExportSupervisoryTamperIncidentOwnerPseudonym?: string | null;
  customerExportSupervisoryTamperIncidentSlaDueAt?: string | null;
  customerExportSupervisoryTamperLegalReviewReceiptId?: string | null;
  customerExportSupervisoryTamperSecurityReviewReceiptId?: string | null;
  customerExportSupervisoryTamperPrivacySupervisorReviewReceiptId?: string | null;
  customerExportSupervisoryTamperNoticeDecisions?: Pass2868CustomerExportSupervisoryEvidenceIndexTamperNoticeDecision[] | null;
  customerExportSupervisoryTamperFinalEvidenceIndexVersionBindingHash?: string | null;
  customerExportSupervisoryTamperIncidentPayloadHash?: string | null;
  customerExportSupervisoryTamperIncidentTimelineHash?: string | null;
  customerExportSupervisoryTamperResolutionCaseId?: string | null;
  customerExportSupervisoryTamperRootCauseHash?: string | null;
  customerExportSupervisoryTamperImpactScopeHash?: string | null;
  customerExportSupervisoryCorrectedEvidenceIndexId?: string | null;
  customerExportSupervisoryCorrectedEvidenceIndexVersion?: string | null;
  customerExportSupervisoryCorrectedEvidenceIndexHash?: string | null;
  customerExportSupervisoryCorrectedIndexVerificationReceiptId?: string | null;
  customerExportSupervisoryArchiveResumeDecisionReceiptId?: string | null;
  customerExportSupervisoryArchiveResumeDecision?: Pass2869CustomerExportSupervisoryTamperResolutionDecision | null;
  customerExportSupervisoryReFreezeReceiptId?: string | null;
  customerExportSupervisoryArchiveResumeReceiptId?: string | null;
  customerExportSupervisoryTamperFinalNoticeReceipts?: Pass2869CustomerExportSupervisoryTamperFinalNoticeReceipt[] | null;
  customerExportSupervisoryTamperLegalClosureSignoffReceiptId?: string | null;
  customerExportSupervisoryTamperSecurityClosureSignoffReceiptId?: string | null;
  customerExportSupervisoryTamperPrivacyClosureSignoffReceiptId?: string | null;
  customerExportSupervisoryTamperResolutionPayloadHash?: string | null;
  customerExportSupervisoryTamperIncidentClosureTimelineHash?: string | null;
  customerExportSupervisoryOriginalFrozenIndexId?: string | null;
  customerExportSupervisoryOriginalFrozenIndexVersion?: string | null;
  customerExportSupervisoryOriginalFrozenIndexHash?: string | null;
  customerExportSupervisoryCorrectedIndexComparisonReceiptId?: string | null;
  customerExportSupervisoryCorrectedIndexLedgerBindingHash?: string | null;
  customerExportSupervisoryArchiveResumeRefreezeLedgerReceiptId?: string | null;
  customerExportSupervisoryFinalNoticeReconciliationReceiptId?: string | null;
  customerExportSupervisoryClosureSignoffReconciliationReceiptId?: string | null;
  customerExportSupervisoryResidualHashDriftScanReceiptId?: string | null;
  customerExportSupervisoryResidualChannelDriftScanReceiptId?: string | null;
  customerExportSupervisoryPostResolutionDriftSignals?: Pass2870CustomerExportSupervisoryPostResolutionDriftSignal[] | null;
  customerExportSupervisoryClosureAuditPayloadHash?: string | null;
  customerExportSupervisoryClosureAuditTimelineHash?: string | null;
  customerExportSupervisoryFinalClosureAuditIndexId?: string | null;
  customerExportSupervisoryFinalClosureAuditIndexHash?: string | null;
  customerExportSupervisoryPostClosureWatchReceiptId?: string | null;
  customerExportSupervisoryPostClosureWatchWindowHours?: number;
  customerExportSupervisoryPostClosureMutationSignalReviewReceiptId?: string | null;
  customerExportSupervisoryPostClosureMutationSignals?: Pass2871CustomerExportSupervisoryPostClosureMutationSignal[] | null;
  customerExportSupervisoryPostClosureAutoFreezeReceiptId?: string | null;
  customerExportSupervisoryPostClosureArchiveCloseFreezeReceiptId?: string | null;
  customerExportSupervisoryPostClosureExportChannelFreezeReceiptId?: string | null;
  customerExportSupervisoryPostClosureMutationIncidentTicketId?: string | null;
  customerExportSupervisoryPostClosureMutationIncidentOwnerPseudonym?: string | null;
  customerExportSupervisoryPostClosureMutationIncidentSlaDueAt?: string | null;
  customerExportSupervisoryPostClosureCustomerNoticeDecisionReceiptId?: string | null;
  customerExportSupervisoryPostClosureRegulatorNoticeDecisionReceiptId?: string | null;
  customerExportSupervisoryPostClosureAuditorNoticeDecisionReceiptId?: string | null;
  customerExportSupervisoryPostClosureWatchPayloadHash?: string | null;
  customerExportSupervisoryPostClosureWatchTimelineHash?: string | null;
  customerExportSupervisoryPostClosureMutationResolutionCaseId?: string | null;
  customerExportSupervisoryPostClosureMutationResolutionOwnerPseudonym?: string | null;
  customerExportSupervisoryPostClosureMutationRootCauseHash?: string | null;
  customerExportSupervisoryPostClosureMutationImpactScopeHash?: string | null;
  customerExportSupervisoryPostClosureMutationCorrectedEvidenceIndexId?: string | null;
  customerExportSupervisoryPostClosureMutationCorrectedEvidenceIndexVersion?: string | null;
  customerExportSupervisoryPostClosureMutationCorrectedEvidenceIndexHash?: string | null;
  customerExportSupervisoryPostClosureMutationCorrectedIndexVerificationReceiptId?: string | null;
  customerExportSupervisoryPostClosureMutationResolutionDecision?: Pass2872CustomerExportSupervisoryPostClosureMutationIncidentResolutionDecision | null;
  customerExportSupervisoryPostClosureMutationRecloseReceiptId?: string | null;
  customerExportSupervisoryPostClosureMutationPermanentFreezeReceiptId?: string | null;
  customerExportSupervisoryPostClosureMutationReopenedInvestigationTicketId?: string | null;
  customerExportSupervisoryPostClosureMutationCustomerNoticeResolutionReceiptId?: string | null;
  customerExportSupervisoryPostClosureMutationRegulatorNoticeResolutionReceiptId?: string | null;
  customerExportSupervisoryPostClosureMutationAuditorNoticeResolutionReceiptId?: string | null;
  customerExportSupervisoryPostClosureMutationLegalSignoffReceiptId?: string | null;
  customerExportSupervisoryPostClosureMutationSecuritySignoffReceiptId?: string | null;
  customerExportSupervisoryPostClosureMutationPrivacySignoffReceiptId?: string | null;
  customerExportSupervisoryPostClosureMutationCorrectedWatchTimelineHash?: string | null;
  customerExportSupervisoryPostClosureMutationResolutionPayloadHash?: string | null;
  customerExportSupervisoryPostClosureMutationResolutionTimelineHash?: string | null;
  customerExportSupervisoryPostRecloseWatchReceiptId?: string | null;
  customerExportSupervisoryPostRecloseWatchWindowHours?: number;
  customerExportSupervisoryPostRecloseCorrectedIndexResealReceiptId?: string | null;
  customerExportSupervisoryPostRecloseRegressionSloPolicyId?: string | null;
  customerExportSupervisoryPostRecloseRegressionSloMaxRepeatIncidents?: number;
  customerExportSupervisoryPostRecloseRegressionSignalReviewReceiptId?: string | null;
  customerExportSupervisoryPostRecloseRegressionSignals?: Pass2873CustomerExportSupervisoryPostRecloseRegressionSignal[] | null;
  customerExportSupervisoryPostRecloseRepeatedIncidentEscalationTicketId?: string | null;
  customerExportSupervisoryPostRecloseRecurrenceFreezeReceiptId?: string | null;
  customerExportSupervisoryPostRecloseArchiveCloseFreezeReceiptId?: string | null;
  customerExportSupervisoryPostRecloseExportChannelFreezeReceiptId?: string | null;
  customerExportSupervisoryPostRecloseCustomerNoticeEscalationReceiptId?: string | null;
  customerExportSupervisoryPostRecloseRegulatorNoticeEscalationReceiptId?: string | null;
  customerExportSupervisoryPostRecloseAuditorNoticeEscalationReceiptId?: string | null;
  customerExportSupervisoryPostRecloseLegalSignoffReceiptId?: string | null;
  customerExportSupervisoryPostRecloseSecuritySignoffReceiptId?: string | null;
  customerExportSupervisoryPostReclosePrivacySignoffReceiptId?: string | null;
  customerExportSupervisoryPostRecloseRegressionPayloadHash?: string | null;
  customerExportSupervisoryPostRecloseRegressionTimelineHash?: string | null;
  customerExportSupervisoryRecurrenceCaseId?: string | null;
  customerExportSupervisoryRecurrenceOwnerPseudonym?: string | null;
  customerExportSupervisoryRecurrenceFamily?: Pass2874CustomerExportSupervisoryRecurrenceFamily | null;
  customerExportSupervisoryRecurrenceRootCauseHash?: string | null;
  customerExportSupervisoryRecurrenceImpactScopeHash?: string | null;
  customerExportSupervisoryRecurrenceResolutionDecision?: Pass2874CustomerExportSupervisoryRecurrenceEscalationResolutionDecision | null;
  customerExportSupervisoryRecurrenceHardenedRebaselineIndexId?: string | null;
  customerExportSupervisoryRecurrenceHardenedRebaselineIndexVersion?: string | null;
  customerExportSupervisoryRecurrenceHardenedRebaselineIndexHash?: string | null;
  customerExportSupervisoryRecurrenceHardenedRebaselineVerificationReceiptId?: string | null;
  customerExportSupervisoryRecurrencePreventionControlsHash?: string | null;
  customerExportSupervisoryRecurrenceWatcherPolicyUpdateReceiptId?: string | null;
  customerExportSupervisoryRecurrencePermanentFreezeReceiptId?: string | null;
  customerExportSupervisoryRecurrenceReopenedInvestigationTicketId?: string | null;
  customerExportSupervisoryRecurrenceCustomerNoticeResolutionReceiptId?: string | null;
  customerExportSupervisoryRecurrenceRegulatorNoticeResolutionReceiptId?: string | null;
  customerExportSupervisoryRecurrenceAuditorNoticeResolutionReceiptId?: string | null;
  customerExportSupervisoryRecurrenceLegalSignoffReceiptId?: string | null;
  customerExportSupervisoryRecurrenceSecuritySignoffReceiptId?: string | null;
  customerExportSupervisoryRecurrencePrivacySignoffReceiptId?: string | null;
  customerExportSupervisoryRecurrenceResolutionPayloadHash?: string | null;
  customerExportSupervisoryRecurrenceResolutionTimelineHash?: string | null;
  customerExportSupervisoryPostRebaselineWatchReceiptId?: string | null;
  customerExportSupervisoryPostRebaselineStabilityWindowHours?: number;
  customerExportSupervisoryPostRebaselineStabilityWatchPolicyId?: string | null;
  customerExportSupervisoryPostRebaselineMonitorHeartbeatReceiptId?: string | null;
  customerExportSupervisoryPostRebaselineProbeReceiptId?: string | null;
  customerExportSupervisoryPostRebaselineRegressionBudgetMaxIncidents?: number;
  customerExportSupervisoryPostRebaselineObservedRegressionSignals?: Pass2875CustomerExportSupervisoryPostRebaselineRegressionSignal[] | null;
  customerExportSupervisoryPostRebaselineEnforcementDecision?: Pass2875CustomerExportSupervisoryPostRebaselineStabilityDecision | null;
  customerExportSupervisoryPostRebaselinePermanentFreezeDowngradeReceiptId?: string | null;
  customerExportSupervisoryPostRebaselineReopenedInvestigationTicketId?: string | null;
  customerExportSupervisoryPostRebaselineWatcherEscalationReceiptId?: string | null;
  customerExportSupervisoryPostRebaselineCustomerNoticeReceiptId?: string | null;
  customerExportSupervisoryPostRebaselineRegulatorNoticeReceiptId?: string | null;
  customerExportSupervisoryPostRebaselineAuditorNoticeReceiptId?: string | null;
  customerExportSupervisoryPostRebaselineLegalSignoffReceiptId?: string | null;
  customerExportSupervisoryPostRebaselineSecuritySignoffReceiptId?: string | null;
  customerExportSupervisoryPostRebaselinePrivacySignoffReceiptId?: string | null;
  customerExportSupervisoryPostRebaselineStabilityEnforcementPayloadHash?: string | null;
  customerExportSupervisoryPostRebaselineStabilityEnforcementTimelineHash?: string | null;
  customerExportSupervisoryStabilityEvidenceRollupId?: string | null;
  customerExportSupervisoryStabilityEvidenceRollupVersion?: string | null;
  customerExportSupervisoryStabilityEvidenceRollupHash?: string | null;
  customerExportSupervisoryOperatorDashboardCardId?: string | null;
  customerExportSupervisoryOperatorDashboardSnapshotHash?: string | null;
  customerExportSupervisoryDriftBudgetBurndownHash?: string | null;
  customerExportSupervisoryStabilitySloBreachCardId?: string | null;
  customerExportSupervisoryFinalStabilityWindowHours?: number;
  customerExportSupervisoryZeroRegressionAttestationReceiptId?: string | null;
  customerExportSupervisoryReleaseEligibilityAssessmentReceiptId?: string | null;
  customerExportSupervisoryReleaseEligibilityDecision?: Pass2876CustomerExportSupervisoryReleaseEligibilityDecision | null;
  customerExportSupervisoryArchiveChannelReleaseReceiptId?: string | null;
  customerExportSupervisoryExportChannelReleaseReceiptId?: string | null;
  customerExportSupervisoryDeliveryChannelReleaseReceiptId?: string | null;
  customerExportSupervisoryExtendedWatchReceiptId?: string | null;
  customerExportSupervisoryPermanentFreezeReceiptId?: string | null;
  customerExportSupervisoryReopenedInvestigationTicketId?: string | null;
  customerExportSupervisoryReleaseCustomerNoticeReceiptId?: string | null;
  customerExportSupervisoryReleaseRegulatorNoticeReceiptId?: string | null;
  customerExportSupervisoryReleaseAuditorNoticeReceiptId?: string | null;
  customerExportSupervisoryReleaseLegalSignoffReceiptId?: string | null;
  customerExportSupervisoryReleaseSecuritySignoffReceiptId?: string | null;
  customerExportSupervisoryReleasePrivacySignoffReceiptId?: string | null;
  customerExportSupervisoryReleaseEligibilityPayloadHash?: string | null;
  customerExportSupervisoryReleaseEligibilityTimelineHash?: string | null;
  customerExportSupervisoryPostReleaseChannelDecision?: Pass2877CustomerExportSupervisoryPostReleaseChannelDecision | null;
  customerExportSupervisoryReleaseExecutionReceiptId?: string | null;
  customerExportSupervisoryReleaseExecutionRunbookHash?: string | null;
  customerExportSupervisoryArchiveChannelUnlockReceiptId?: string | null;
  customerExportSupervisoryExportChannelUnlockReceiptId?: string | null;
  customerExportSupervisoryDeliveryChannelUnlockReceiptId?: string | null;
  customerExportSupervisoryPostReleaseMonitorReceiptId?: string | null;
  customerExportSupervisoryChannelHeartbeatReceiptId?: string | null;
  customerExportSupervisoryReleaseObservationWindowHours?: number | null;
  customerExportSupervisoryRollbackPlanId?: string | null;
  customerExportSupervisoryRollbackPlanHash?: string | null;
  customerExportSupervisoryLateDriftProbeReceiptId?: string | null;
  customerExportSupervisoryLateDriftProbeHash?: string | null;
  customerExportSupervisoryReleaseDashboardCardId?: string | null;
  customerExportSupervisoryRollbackToFreezeReceiptId?: string | null;
  customerExportSupervisoryExtendedObservationReceiptId?: string | null;
  customerExportSupervisoryReopenedReleaseReviewTicketId?: string | null;
  customerExportSupervisoryCustomerCorrectionNoticeReceiptId?: string | null;
  customerExportSupervisoryRegulatorCorrectionNoticeReceiptId?: string | null;
  customerExportSupervisoryAuditorCorrectionNoticeReceiptId?: string | null;
  customerExportSupervisoryPostReleaseLegalSignoffReceiptId?: string | null;
  customerExportSupervisoryPostReleaseSecuritySignoffReceiptId?: string | null;
  customerExportSupervisoryPostReleasePrivacySignoffReceiptId?: string | null;
  customerExportSupervisoryPostReleaseChannelPayloadHash?: string | null;
  customerExportSupervisoryPostReleaseChannelTimelineHash?: string | null;
  customerExportSupervisoryObservationCloseReceiptId?: string | null;
  customerExportSupervisoryObservationWindowClosedAt?: string | null;
  customerExportSupervisoryHeartbeatRollupReceiptId?: string | null;
  customerExportSupervisoryHeartbeatRollupHash?: string | null;
  customerExportSupervisoryDriftProbeRollupReceiptId?: string | null;
  customerExportSupervisoryDriftProbeRollupHash?: string | null;
  customerExportSupervisoryFinalChannelSealReceiptId?: string | null;
  customerExportSupervisoryFinalChannelSealHash?: string | null;
  customerExportSupervisoryRollbackPlanRetentionLockReceiptId?: string | null;
  customerExportSupervisoryRollbackPlanRetentionHash?: string | null;
  customerExportSupervisoryFinalReleaseDashboardSnapshotId?: string | null;
  customerExportSupervisoryFinalReleaseDashboardSnapshotHash?: string | null;
  customerExportSupervisoryObservationCloseDecision?: Pass2878CustomerExportSupervisoryPostReleaseObservationCloseFinalChannelSealDecision | null;
  customerExportSupervisoryFinalObservationCustomerNoticeReceiptId?: string | null;
  customerExportSupervisoryFinalObservationRegulatorNoticeReceiptId?: string | null;
  customerExportSupervisoryFinalObservationAuditorNoticeReceiptId?: string | null;
  customerExportSupervisoryFinalChannelSealPayloadHash?: string | null;
  customerExportSupervisoryFinalChannelSealTimelineHash?: string | null;
  generatedAt?: string;
};
