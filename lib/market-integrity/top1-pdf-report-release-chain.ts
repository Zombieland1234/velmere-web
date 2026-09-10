import { buildPass2820PdfRenderCleanroomGate } from "@/lib/market-integrity/top1-pdf-render-cleanroom-gate";
import { buildPass2821CustomerDeliveryLedger } from "@/lib/market-integrity/top1-customer-delivery-ledger";
import { buildPass2822AccountVaultTokenConsumptionGate } from "@/lib/market-integrity/top1-account-vault-token-consumption-gate";
import { buildPass2823AdvancedHumanReviewGate } from "@/lib/market-integrity/top1-advanced-human-review-signoff-gate";
import { buildPass2824AdvancedReviewReplayAuditGate } from "@/lib/market-integrity/top1-advanced-review-replay-audit-gate";
import { buildPass2825CommunitySourceUpgradeModerationGate } from "@/lib/market-integrity/top1-community-source-upgrade-moderation-gate";
import { buildPass2826CustomerSafeNarrativeGate } from "@/lib/market-integrity/top1-customer-safe-narrative-gate";
import { buildPass2827LaunchReadinessEvidenceGate } from "@/lib/market-integrity/top1-launch-readiness-evidence-gate";
import { buildPass2828EvidenceArtifactHandoffGate } from "@/lib/market-integrity/top1-evidence-artifact-handoff-gate";
import { buildPass2829ReleaseProofCollectorGate } from "@/lib/market-integrity/top1-release-proof-collector-gate";
import { buildPass2830ReleasePacketSealGate } from "@/lib/market-integrity/top1-release-packet-seal-gate";
import { buildPass2831SealDriftMonitorGate } from "@/lib/market-integrity/top1-seal-drift-monitor-gate";
import { buildPass2832ProductionCanaryRollbackGate } from "@/lib/market-integrity/top1-production-canary-rollback-gate";
import type { Top1PdfPayloadDraftArgs } from "@/lib/market-integrity/top1-pdf-report-payload-types";
import type { Top1PdfReportCoreChain } from "@/lib/market-integrity/top1-pdf-report-core-chain";

export function buildTop1PdfReportReleaseChain(input: { args: Top1PdfPayloadDraftArgs } & Pick<Top1PdfReportCoreChain, "generatedAt" | "methodology" | "pdfRenderDecision" | "providerConflicts" | "receipts" | "reportAccessDecision" | "reportIntegrityVault" | "runtimeObservabilityLedger" | "visiblePages">) {
  const { args, generatedAt, methodology, pdfRenderDecision, providerConflicts, receipts, reportAccessDecision, reportIntegrityVault, runtimeObservabilityLedger, visiblePages } = input;
  const pdfRenderCleanroomGate = buildPass2820PdfRenderCleanroomGate({
    surface: "PDF",
    locale: args.locale,
    tier: args.tier,
    paidEvidenceAllowed: reportAccessDecision.paidEvidenceAllowed,
    sourceChartAccepted: pdfRenderDecision.acceptedForPdf,
    pages: visiblePages,
    fixtureLabelPresent: true,
  });
  const customerDeliveryLedger = buildPass2821CustomerDeliveryLedger({
    surface: "PDF",
    tier: args.tier,
    paidEvidenceAllowed: reportAccessDecision.paidEvidenceAllowed,
    accountBound: Boolean(args.accountId),
    serverReceiptPresent: Boolean(args.serverReceiptId),
    oneTimeReportTokenPresent: Boolean(args.reportToken),
    payloadHash: args.payloadHash ?? reportIntegrityVault.payloadHash,
    sourceReceiptRoot:
      args.sourceReceiptRoot ?? reportIntegrityVault.sourceReceiptMerkleRoot,
    pdfCleanroomStatus: pdfRenderCleanroomGate.status,
    runtimeState: runtimeObservabilityLedger.runtimeState,
    manualReviewReceiptPresent: Boolean(args.manualReviewReceiptId),
    expiresInMinutes: args.tier === "Basic" ? 15 : args.tier === "Pro" ? 10 : 5,
  });
  
  const accountVaultTokenConsumptionGate =
    buildPass2822AccountVaultTokenConsumptionGate({
      surface: "PDF",
      tier: args.tier,
      accountBound: Boolean(args.accountId),
      serverReceiptPresent: Boolean(args.serverReceiptId),
      reportToken: args.reportToken,
      reportTokenStatus: args.reportTokenStatus,
      payloadHash: args.payloadHash ?? reportIntegrityVault.payloadHash,
      deliveredPayloadHash: args.deliveredPayloadHash,
      sourceReceiptRoot:
        args.sourceReceiptRoot ?? reportIntegrityVault.sourceReceiptMerkleRoot,
      customerDeliveryStatus: customerDeliveryLedger.status,
      pdfCleanroomStatus: pdfRenderCleanroomGate.status,
      runtimeState: runtimeObservabilityLedger.runtimeState,
      issuedAt: generatedAt,
      expiresInMinutes:
        args.tier === "Basic" ? 15 : args.tier === "Pro" ? 10 : 5,
      resendRequested: args.resendRequested,
      replayCount: args.replayCount,
    });
  
  const advancedHumanReviewSignoffGate = buildPass2823AdvancedHumanReviewGate({
    surface: "PDF",
    tier: args.tier,
    paidEvidenceAllowed: reportAccessDecision.paidEvidenceAllowed,
    manualReviewReceiptId: args.manualReviewReceiptId,
    operatorId: args.operatorId,
    operatorSignature: args.operatorSignature,
    payloadHash: args.payloadHash ?? reportIntegrityVault.payloadHash,
    sourceReceiptRoot:
      args.sourceReceiptRoot ?? reportIntegrityVault.sourceReceiptMerkleRoot,
    reviewPayloadHash: args.reviewPayloadHash,
    reviewerNote: args.reviewerNote,
    generatedAt,
    reviewedAt: args.reviewedAt,
    reviewRejected: args.reviewRejected,
    runtimeState: runtimeObservabilityLedger.runtimeState,
    tokenState: accountVaultTokenConsumptionGate.tokenState,
    expiresInMinutes: args.tier === "Advanced" ? 1440 : 0,
  });
  
  const advancedReviewReplayAuditGate =
    buildPass2824AdvancedReviewReplayAuditGate({
      surface: "PDF",
      tier: args.tier,
      previousGate: advancedHumanReviewSignoffGate,
      paidEvidenceAllowed: reportAccessDecision.paidEvidenceAllowed,
      payloadHash: args.payloadHash ?? reportIntegrityVault.payloadHash,
      deliveredPayloadHash:
        args.deliveredPayloadHash ??
        args.payloadHash ??
        reportIntegrityVault.payloadHash,
      reviewPayloadHash: args.reviewPayloadHash,
      sourceReceiptRoot:
        args.sourceReceiptRoot ?? reportIntegrityVault.sourceReceiptMerkleRoot,
      deliveredSourceReceiptRoot:
        args.deliveredSourceReceiptRoot ??
        args.sourceReceiptRoot ??
        reportIntegrityVault.sourceReceiptMerkleRoot,
      reviewSourceReceiptRoot: args.reviewSourceReceiptRoot,
      operatorSignatureHash:
        advancedHumanReviewSignoffGate.operatorSignatureHash,
      operatorSignatureReplayHash: args.operatorSignatureReplayHash,
      reviewerNote: args.reviewerNote,
      signedReviewerNoteHash: args.signedReviewerNoteHash,
      replayReviewerNoteHash: args.replayReviewerNoteHash,
      replayAttemptCount: args.replayAttemptCount,
      tokenState: accountVaultTokenConsumptionGate.tokenState,
      runtimeState: runtimeObservabilityLedger.runtimeState,
    });
  
  const communitySourceUpgradeModerationGate =
    buildPass2825CommunitySourceUpgradeModerationGate({
      surface: "PDF",
      contentType: args.communityContentType ?? "pdf",
      title: args.communityTitle ?? args.name,
      body: args.communityBody ?? null,
      tags: args.communityTags ?? [args.symbol, args.family, args.tier],
      authorRole: args.communityAuthorRole ?? "operator",
      accountBound: Boolean(args.accountId),
      walletBound: false,
      firstPost: Boolean(args.communityFirstPost),
      postsInWindow: args.communityPostsInWindow ?? 0,
      moderationState: args.communitySourceUpgradeRequested
        ? "queued"
        : "approved",
      unsafeLinkBlocked: Boolean(args.communityUnsafeLinkBlocked),
      linkCount: args.communityLinkCount ?? 0,
      requestedSourceUpgrade: Boolean(args.communitySourceUpgradeRequested),
      sourceReceiptId: args.communitySourceReceiptId,
      moderatorId: args.communityModeratorId,
      payloadHash: args.payloadHash ?? reportIntegrityVault.payloadHash,
      sourceReceiptRoot:
        args.sourceReceiptRoot ?? reportIntegrityVault.sourceReceiptMerkleRoot,
    });
  
  const customerSafeNarrativeGate = buildPass2826CustomerSafeNarrativeGate({
    surface: "PDF",
    tier: args.tier,
    assetFamily: args.family,
    locale: args.locale,
    narrativeText:
      args.narrativeText ??
      `${args.name} risk is described as observed risk based on available evidence, missing evidence and confidence cap. This is not financial advice.`,
    riskScorePresent: true,
    confidenceScorePresent: true,
    sourceFamilyCount: args.sourceFamilyCount,
    missingEvidenceCount: args.missingEvidence.length,
    providerConflictCount: providerConflicts.length,
    topDriversCount:
      args.topDriversCount ??
      Math.min(
        5,
        Math.max(1, args.missingEvidence.length + providerConflicts.length + 1),
      ),
    mitigatorsCount: args.mitigatorsCount ?? Math.min(3, receipts.length),
    confidenceCapReason: methodology.confidenceCapReason,
    paidEvidenceAllowed: reportAccessDecision.paidEvidenceAllowed,
    advancedReviewAllowed:
      advancedHumanReviewSignoffGate.decision === "operator_signed" &&
      advancedReviewReplayAuditGate.releaseGate.status === "allow",
    sourceReceiptPresent: receipts.length > 0,
    methodologyLinked: true,
    missingEvidenceShown: true,
    tierBoundaryShown: true,
    notAdviceShown: true,
    localePure: pdfRenderCleanroomGate.releaseGate.status !== "block",
  });
  
  const launchReadinessEvidenceGate = buildPass2827LaunchReadinessEvidenceGate({
    surface: "PDF",
    tier: args.tier,
    buildPassed: args.buildPassed,
    typecheckPassed: args.typecheckPassed,
    i18nPassed: args.i18nPassed,
    verifierPassedCount: args.verifierPassedCount ?? 7,
    verifierTotalCount: args.verifierTotalCount ?? 9,
    liveProviderSmokePassed: args.liveProviderSmokePassed,
    screenshotQaPassed: args.screenshotQaPassed,
    mobileQaPassed: args.mobileQaPassed,
    securityQaPassed: args.securityQaPassed,
    pdfParityPassed:
      args.pdfParityPassed ??
      (pdfRenderCleanroomGate.releaseGate.status !== "block" &&
        Boolean(reportIntegrityVault.payloadHash) &&
        Boolean(reportIntegrityVault.sourceReceiptMerkleRoot)),
    runtimeState: runtimeObservabilityLedger.runtimeState,
    payloadHashPresent: Boolean(reportIntegrityVault.payloadHash),
    sourceReceiptRootPresent: Boolean(
      reportIntegrityVault.sourceReceiptMerkleRoot,
    ),
    paidEvidenceRedacted: pdfRenderCleanroomGate.releaseGate.status !== "block",
    p0OpenCount: 1,
    p1OpenCount: pdfRenderDecision.acceptedForPdf ? 1 : 2,
  });
  
  const evidenceArtifactHandoffGate = buildPass2828EvidenceArtifactHandoffGate({
    surface: "PDF",
    tier: args.tier,
    buildArtifactId: args.buildArtifactId,
    typecheckArtifactId: args.typecheckArtifactId,
    i18nArtifactId: args.i18nArtifactId,
    verifierArtifactId: args.verifierArtifactId ?? "pass2828-verifier-prepared",
    liveProviderSmokeArtifactId: args.liveProviderSmokeArtifactId,
    screenshotPackArtifactId: args.screenshotPackArtifactId,
    mobileScreenshotPackArtifactId: args.mobileScreenshotPackArtifactId,
    securityScanArtifactId: args.securityScanArtifactId,
    pdfParityPacketArtifactId: args.pdfParityPacketArtifactId,
    buildStatus: args.buildArtifactId ? "attached" : "missing",
    typecheckStatus: args.typecheckArtifactId ? "attached" : "missing",
    i18nStatus: args.i18nPassed === false ? "failed" : args.i18nArtifactId ? "attached" : "prepared",
    verifierStatus: args.verifierArtifactId ? "attached" : "prepared",
    liveProviderSmokeStatus: args.liveProviderSmokeArtifactId ? "attached" : "prepared",
    screenshotStatus: args.screenshotPackArtifactId ? "attached" : "prepared",
    mobileScreenshotStatus: args.mobileScreenshotPackArtifactId ? "attached" : "prepared",
    securityScanStatus: args.securityScanArtifactId ? "attached" : "prepared",
    pdfParityStatus: args.pdfParityPacketArtifactId ? "attached" : "prepared",
    payloadHash: reportIntegrityVault.payloadHash,
    sourceReceiptRoot: reportIntegrityVault.sourceReceiptMerkleRoot,
  });
  
  const releaseProofCollectorGate = buildPass2829ReleaseProofCollectorGate({
    surface: "PDF",
    tier: args.tier,
    handoffGate: evidenceArtifactHandoffGate,
    payloadHash: reportIntegrityVault.payloadHash,
    sourceReceiptRoot: reportIntegrityVault.sourceReceiptMerkleRoot,
    sealedPacketRequested: args.sealedReleasePacketRequested,
  });
  
  const releasePacketSealGate = buildPass2830ReleasePacketSealGate({
    surface: "PDF",
    tier: args.tier,
    collectorGate: releaseProofCollectorGate,
    payloadHash: reportIntegrityVault.payloadHash,
    sourceReceiptRoot: reportIntegrityVault.sourceReceiptMerkleRoot,
    generatedAt,
    requestedSeal: args.releasePacketSealRequested,
    revoked: args.releasePacketRevoked,
    codeRefChanged: args.releasePacketCodeRefChanged,
  });
  
  const sealDriftMonitorGate = buildPass2831SealDriftMonitorGate({
    surface: "PDF",
    tier: args.tier,
    releasePacketSealGate,
    generatedAt,
    lastReplayAt: args.sealMonitorLastReplayAt,
    latestHeartbeatAt: args.sealMonitorLatestHeartbeatAt,
    heartbeatCount: args.sealMonitorHeartbeatCount,
    failedHeartbeatCount: args.sealMonitorFailedHeartbeatCount,
    payloadHashChanged: args.sealMonitorPayloadHashChanged,
    sourceReceiptRootChanged: args.sealMonitorSourceReceiptRootChanged,
    codeRefChanged: args.releasePacketCodeRefChanged,
    providerRegistryChanged: args.sealMonitorProviderRegistryChanged,
    pdfRendererChanged: args.sealMonitorPdfRendererChanged,
    securityPolicyChanged: args.sealMonitorSecurityPolicyChanged,
    entitlementPolicyChanged: args.sealMonitorEntitlementPolicyChanged,
    chartRendererChanged: args.sealMonitorChartRendererChanged,
    mobileSurfaceChanged: args.sealMonitorMobileSurfaceChanged,
    liveProviderSmokeFresh: args.liveProviderSmokePassed,
    pdfParityFresh: args.pdfParityPassed,
    securityScanFresh: args.securityQaPassed,
    mobileQaFresh: args.mobileQaPassed,
  });
  
  const productionCanaryRollbackGate = buildPass2832ProductionCanaryRollbackGate({
    surface: "PDF",
    tier: args.tier,
    sealDriftMonitorGate,
    generatedAt,
    trafficPercent: args.canaryTrafficPercent,
    minimumObservationMinutes: args.canaryMinimumObservationMinutes,
    observedMinutes: args.canaryObservedMinutes,
    errorRatePercent: args.canaryErrorRatePercent,
    p95LatencyMs: args.canaryP95LatencyMs,
    providerFailureRatePercent: args.canaryProviderFailureRatePercent,
    pdfMismatchCount: args.canaryPdfMismatchCount,
    entitlementErrorCount: args.canaryEntitlementErrorCount,
    chartSkeletonSpike: args.canaryChartSkeletonSpike,
    customerDeliveryFailureCount: args.canaryCustomerDeliveryFailureCount,
    rollbackSwitchAvailable: args.canaryRollbackSwitchAvailable,
    rollbackExecuted: args.canaryRollbackExecuted,
  });
  return {
    pdfRenderCleanroomGate,
    customerDeliveryLedger,
    accountVaultTokenConsumptionGate,
    advancedHumanReviewSignoffGate,
    advancedReviewReplayAuditGate,
    communitySourceUpgradeModerationGate,
    customerSafeNarrativeGate,
    launchReadinessEvidenceGate,
    evidenceArtifactHandoffGate,
    releaseProofCollectorGate,
    releasePacketSealGate,
    sealDriftMonitorGate,
    productionCanaryRollbackGate,
  };
}

export type Top1PdfReportReleaseChain = ReturnType<typeof buildTop1PdfReportReleaseChain>;
