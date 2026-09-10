import { getVlmCurrentSkuTruth } from "@/lib/commerce/vlm-current-sku-truth";
import { NextResponse } from "next/server";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { buildAuditWatchAssessment, type AuditWatchSubmission } from "@/lib/security/audit-watch";
import {  buildAuditVerificationPreview, normalizeAuditReviewSubmission } from "@/lib/security/audit-review-flow";
import { buildAuditReportQueueRecord } from "@/lib/security/audit-report-queue";
import { buildAuditReportExportPayload } from "@/lib/security/audit-pdf-shield-export";
import { buildVlmAuditAccountMessage } from "@/lib/security/vlm-audit-product";
import { hasVlmPaidSurfaceServerEntitlement, verifyVlmPaidSurfaceTokenEntitlement } from "@/lib/commerce/vlm-paid-surface-guard";
import { buildAuditAccountMessageRecord } from "@/lib/account/audit-account-messages";
import { hashVelmereAccountBinding, resolveRequestAccount } from "@/lib/auth/account-session";
import { createAuditIntakeCase, normalizeAuditTarget } from "@/lib/security/audit-intake-case-vault";
import { buildPass4420AdvancedPaidContext, buildPass4420PaidAuditAccountMessage, normalizePass4420AuditLocale } from "@/lib/security/audit-watch-server-helpers";
import {  buildPass4421PaymentRequiredEnvelope, buildPass4421PaymentRequiredHeaders } from "@/lib/security/audit-watch-response-boundary-helpers";
import { buildPass4422AuditAccountDeliveryInput } from "@/lib/security/audit-watch-account-delivery-helpers";
import { buildPass4643AuditTierValueProof } from "@/lib/security/audit-tier-value-proof";
import { buildAuditTierCustomerMatrix, getAuditTierContract } from "@/lib/security/audit-tier-contract";
import { resolvePass4656AuditBenchmarkReleaseProofFromEnv } from "@/lib/security/audit-benchmark-attestation";
import { resolveCommercialCohortGateFromEnv } from "@/lib/server/commercial-cohort-runtime";
import { buildPass4651CommercialDeliveryDecision } from "@/lib/market-integrity/commercial-delivery-state";
import { buildPass4645ProviderEvidenceLedger, persistPass4645ProviderEvidenceLedger } from "@/lib/market-integrity/provider-evidence-ledger";
import { createPass4644ProviderEvidenceReceipt } from "@/lib/market-integrity/provider-evidence-receipt";
import { buildPass2570AuditSourceQuorumReport } from "@/lib/security/audit-source-quorum-runtime";
import { buildPass2571AuditProviderIntelligenceReport } from "@/lib/security/audit-provider-intelligence";
import { buildPass2572AuditProviderRuntimeReport, readPass2572AuditProviderPrivateStaticEvidence } from "@/lib/security/audit-provider-runtime-client";
import { buildPass2573AuditRuntimeConfidenceReport } from "@/lib/security/audit-runtime-confidence";
import { buildPass2574AuditClaimLedgerReport } from "@/lib/security/audit-claim-ledger";
import { buildPass2575AuditSourceFreshnessReport } from "@/lib/security/audit-source-freshness";
import { buildPass2576AuditPermissionParserReport } from "@/lib/security/audit-permission-parser";
import { buildPass2577AuditLiquidityHolderLockRiskReport } from "@/lib/security/audit-liquidity-holder-lock-risk";
import { buildPass2578AuditReportAssemblerReport } from "@/lib/security/audit-report-assembler";
import { buildPass2579AdvancedManualReviewQueueReport } from "@/lib/security/advanced-manual-review-queue";
import { buildPass2580CustomerSafeDeliveryDecisionReport } from "@/lib/security/customer-safe-delivery-decision";
import { buildPass2581AuditVersionedRecheckReceiptReport } from "@/lib/security/audit-versioned-recheck-receipt";
import { buildPass2582RealProviderAdapterHardeningReport } from "@/lib/security/real-provider-adapter-hardening";
import { buildPass2583ContractSourceAbiExtractionReport } from "@/lib/security/contract-source-abi-extraction";
import { buildPass2584HolderLiquidityDepthEvidenceReport } from "@/lib/security/holder-liquidity-depth-evidence";
import { buildPass2585PremiumProPdfTemplateContractReport } from "@/lib/security/premium-pro-pdf-template-contract";
import { buildPass2586AdvancedOperatorConsoleMergeReport } from "@/lib/security/advanced-operator-console-merge";
import { buildPass2587ServerPaymentAccountDeliveryGateReport } from "@/lib/security/server-payment-account-delivery-gate";
import { buildPass2588AuditCaseVaultPrivateDeliveryLedgerReport } from "@/lib/security/audit-case-vault-private-delivery-ledger";
import { buildPass2589SourceFreshnessRecheckOrchestratorReport } from "@/lib/security/source-freshness-recheck-orchestrator";
import { buildPass2590RiskFormulaEvidenceWeightingContractReport } from "@/lib/security/risk-formula-evidence-weighting-contract";
import { buildPass2591RiskCalibrationGoldenFixtureHarnessReport } from "@/lib/security/risk-calibration-golden-fixture-harness";
import { buildPass2592ProviderConflictArbitrationMatrixReport } from "@/lib/security/provider-conflict-arbitration-matrix";
import { buildPass2593EvidenceNarrativeClaimLedgerExplainabilityReport } from "@/lib/security/evidence-narrative-claim-ledger-explainability";
import { buildPass2594AuditEvidenceQaReleaseGateMatrixReport } from "@/lib/security/audit-evidence-qa-release-gate-matrix";
import { sanitizePublicAuditEnvelope } from "@/lib/security/public-private-route-lockdown";
import { wantsFullAuditProof, type Pass4640AuditWatchPayload, resolveAuditWatchPaidDepth, resolveAuditWatchReviewLevel } from "@/lib/security/audit-watch-access-policy";
import { buildPass4820AuditCustomerReportPipeline } from "@/lib/security/audit-customer-report-pipeline";
import { evaluateAuditPaidEvidenceReadiness } from "@/lib/security/audit-paid-evidence-readiness";
import { buildCustomerSafeAuditProviderRightsSummary } from "@/lib/security/audit-provider-rights-currentness";
import { buildAuditAccountCustomerSnapshot } from "@/lib/security/audit-account-customer-snapshot";
import { renderCustomerSafeAuditPdf } from "@/lib/security/customer-safe-audit-layout";
import { buildPass4822AccountCustomerArtifactSnapshot } from "@/lib/reporting/account-customer-artifact-snapshot";
import {
  P84_AUDIT_EXACT_ARTIFACT_DURABLE_STORAGE_REQUIRED,
  publishP84AuditExactArtifactOwnerReadable,
} from "@/lib/reporting/audit-exact-artifact-owner-readable-publisher";
import { buildAuditAdjudicatedAuthorityEvidence } from "@/lib/security/audit-adjudicated-authority-evidence";
import { parseVerifiedSoliditySourceBundle } from "@/lib/security/verified-solidity-source-bundle";
import { detectP78Erc2771MulticallContext } from "@/lib/security/erc2771-multicall-context-detector";
import { buildP79HistoricalDeploymentContextAdjudication } from "@/lib/security/audit-deployment-context-adjudicator";
import { collectP82CurrentDeploymentReadonlyQuorumFromEnvironment } from "@/lib/security/audit-current-deployment-readonly-quorum-v2";

export async function handleAuditWatchPost(request: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(request, 256 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(request, {
    allowMissingOrigin: process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production",
  });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(request, {
    keyPrefix: "pass2177-security-audit-watch",
    limit: 24,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const parsedBody = await readBoundedJsonBody<Pass4640AuditWatchPayload>(request, 256 * 1024, { maxDepth: 16 });
  if (!parsedBody.ok) return parsedBody.response;
  const payload = parsedBody.value;

  if (wantsFullAuditProof(request)) {
    return NextResponse.json({
      ok: false,
      error: "full_audit_proof_runtime_archived",
      message: "The historical full proof bundle is an offline verification artifact and is no longer served from the customer runtime.",
      customerCompactAvailable: true,
    }, {
      status: 410,
      headers: {
        "cache-control": "no-store",
        "x-velmere-audit-response-mode": "full-proof-archived",
      },
    });
  }

  const locale = normalizePass4420AuditLocale(payload.locale);
  const normalized = normalizeAuditReviewSubmission(payload);
  const account = await resolveRequestAccount(request);
  const earlyReadinessTier = payload.readinessOnly
    && (payload.readinessTier === "pro" || payload.readinessTier === "advanced")
    ? payload.readinessTier
    : null;
  if (earlyReadinessTier) {
    const recognizedTarget = normalizeAuditTarget(
      normalized.contractAddress || normalized.auditUrl || normalized.githubUrl || normalized.website || normalized.projectName || "",
    );
    if (!recognizedTarget) {
      return NextResponse.json({ ok: false, error: "valid_target_required", queued: false, analysisStarted: false }, { status: 422 });
    }
    if (recognizedTarget.kind !== "contract") {
      return NextResponse.json({
        ok: false,
        error: "audit_execution_target_withheld",
        executionState: "WITHHELD",
        recognizedTargetKind: recognizedTarget.kind,
        queued: false,
        analysisStarted: false,
      }, { status: 422 });
    }
    const normalizedChain = String(normalized.chain ?? "").trim().toLowerCase();
    if (normalizedChain !== "bsc" && normalizedChain !== "56") {
      return NextResponse.json({
        ok: false,
        error: normalizedChain ? "audit_execution_chain_withheld" : "audit_execution_chain_required",
        executionState: "WITHHELD",
        requiredChain: { chainId: "56", chainName: "BSC" },
        queued: false,
        analysisStarted: false,
      }, { status: 422 });
    }
  }
  if (!payload.readinessOnly && !account) {
    return NextResponse.json({
      ok: false,
      error: "account_session_required_for_audit_report",
      message: "Sign in before generating an account-bound Audit report. Basic remains free, but every saved report must have an explicit owner.",
    }, {
      status: 401,
      headers: {
        "cache-control": "no-store",
        "x-velmere-audit-account-owner": "required",
      },
    });
  }
  const auditReviewLevel = resolveAuditWatchReviewLevel(normalized.reviewLevel);
  const customerProjectName = normalized.projectName ?? "Untitled audit review";
  const customerContractAddress = normalized.contractAddress ?? "not-provided";
  let pass2362PaidAccessReceipt: Extract<
    Awaited<ReturnType<typeof verifyVlmPaidSurfaceTokenEntitlement>>,
    { ok: true }
  > | null = null;
  const paidAuditDepth = resolveAuditWatchPaidDepth(normalized.reviewLevel);
  if (paidAuditDepth) {
    const paidAuditCaseRef = typeof payload.auditCaseRef === "string"
      ? payload.auditCaseRef.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32)
      : "";
    const paidAuditRequestId = typeof payload.requestId === "string"
      ? payload.requestId.trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 96)
      : "";
    if (!account || !/^AUD-[A-Z0-9-]{6,28}$/.test(paidAuditCaseRef) || !paidAuditRequestId) {
      return NextResponse.json({
        ok: false,
        error: "paid_audit_case_context_required",
        required: ["account_session", "auditCaseRef", "requestId"],
      }, { status: account ? 400 : 401, headers: { "cache-control": "no-store" } });
    }
    const currentTierTruth = getVlmCurrentSkuTruth(paidAuditDepth, locale);
    if (paidAuditDepth === "advanced") {
      return NextResponse.json(
        buildPass4421PaymentRequiredEnvelope({
          product: currentTierTruth,
          context: { locale, depth: paidAuditDepth, requestId: paidAuditRequestId, auditCaseRef: paidAuditCaseRef },
          reason: "product_not_for_sale",
          ledgerMode: "stop_sold",
        }),
        { status: 409, headers: { ...buildPass4421PaymentRequiredHeaders(), "x-velmere-audit-tier": paidAuditDepth } },
      );
    }
    const paidProductId = "vlm_pro_audit_review";
    const paidContext = buildPass4420AdvancedPaidContext({
      locale,
      depth: paidAuditDepth,
      requestId: paidAuditRequestId,
      auditCaseRef: paidAuditCaseRef,
      accountIdHash: hashVelmereAccountBinding(account.accountId),
    });
    const paidAccess = await verifyVlmPaidSurfaceTokenEntitlement({
      policyId: "audit_review",
      request,
      productId: paidProductId,
      context: paidContext,
    });
    if (!hasVlmPaidSurfaceServerEntitlement(paidAccess)) {
      return NextResponse.json(
        buildPass4421PaymentRequiredEnvelope({
          product: currentTierTruth,
          context: paidContext,
          reason: paidAccess.ok ? "invitation_or_existing_entitlement_required" : paidAccess.error,
          ledgerMode: paidAccess.ledgerMode,
        }),
        { status: 403, headers: { ...buildPass4421PaymentRequiredHeaders(), "x-velmere-audit-tier": paidAuditDepth } },
      );
    }
    pass2362PaidAccessReceipt = paidAccess;
  }
  const pass4639NormalizedPaidReceipt = pass2362PaidAccessReceipt?.ok
    ? {
        ok: true,
        entitlement: pass2362PaidAccessReceipt.entitlement.productId,
        paymentStatus: pass2362PaidAccessReceipt.entitlement.paymentStatus ?? pass2362PaidAccessReceipt.entitlement.status ?? "verified",
        receiptHash: pass2362PaidAccessReceipt.entitlement.contextHash,
      }
    : null;
  const legacySubmission: AuditWatchSubmission = {
    contractAddress: customerContractAddress,
    auditUrl: normalized.auditUrl,
    website: normalized.website,
    chain: normalized.chain,
  };
  const assessment = buildAuditWatchAssessment(legacySubmission);
  const preview = buildAuditVerificationPreview(normalized);
  const queueRecord = buildAuditReportQueueRecord(normalized, locale);
  const exportPayload = buildAuditReportExportPayload(queueRecord.slug, locale);
  const rawAccountMessage = buildVlmAuditAccountMessage({ locale, submission: normalized, preview });
  const accountMessage = pass2362PaidAccessReceipt?.ok
    ? buildPass4420PaidAuditAccountMessage(rawAccountMessage, {
        locale,
        auditQueueId: pass2362PaidAccessReceipt.entitlement?.auditQueueId,
        ledgerMode: pass2362PaidAccessReceipt.ledgerMode,
      })
    : rawAccountMessage;
  // PASS4806: build a pure preview record for readiness calculation. Do not
  // create a durable customer/account message until provider evidence and the
  // paid-tier release gate have passed. This prevents ghost delivery records
  // when the request later fails with premium_audit_not_ready.
  const accountDeliveryInput = buildPass4422AuditAccountDeliveryInput({
    message: accountMessage,
    accountId: account?.accountId,
    accountEmail: account?.email,
    contactEmail: normalized.contactEmail,
    locale,
    reviewLevel: auditReviewLevel,
    projectName: customerProjectName,
    contractAddress: customerContractAddress,
    publicReportRoute: queueRecord.publicRoute,
    adminRoute: queueRecord.adminRoute,
    exportRoute: exportPayload.exportRoute,
    auditQueueId: pass2362PaidAccessReceipt?.entitlement?.auditQueueId,
    auditCaseRef: pass2362PaidAccessReceipt?.entitlement?.context.auditCaseRef,
  });
  const accountMessageReadinessPreview = buildAuditAccountMessageRecord(accountDeliveryInput, "memory");
  const pass2570AuditSourceQuorum = buildPass2570AuditSourceQuorumReport({ ...normalized, locale });
  const authorityEvidencePromise = buildAuditAdjudicatedAuthorityEvidence({
    chain: normalized.chain,
    contractAddress: normalized.contractAddress,
    docsUrl: normalized.docsUrl,
    maintainerUrl: normalized.githubUrl,
  });
  // P82 v2: server-configured, successful-subset-diverse, pinned-address read-only exact-block RPC quorum only. Endpoints are never
  // accepted from the customer payload and the resulting private receipt is not returned.
  const pass82CurrentDeploymentQuorumPromise = collectP82CurrentDeploymentReadonlyQuorumFromEnvironment({
    chain: normalized.chain,
    contractAddress: normalized.contractAddress,
  });
  const pass2571AuditProviderIntelligence = buildPass2571AuditProviderIntelligenceReport({
    ...normalized,
    locale,
    sourceQuorum: pass2570AuditSourceQuorum,
  });
  const pass2572AuditProviderRuntime = await buildPass2572AuditProviderRuntimeReport({
    ...normalized,
    locale,
    providerIntelligence: pass2571AuditProviderIntelligence,
  });
  const [authorityEvidence, pass82CurrentDeploymentQuorum] = await Promise.all([
    authorityEvidencePromise,
    pass82CurrentDeploymentQuorumPromise,
  ]);
  // P78: keep raw verified source/ABI private while still letting the real customer
  // path classify source-level context-integrity risk before the claim ledger.
  const pass78PrivateStaticEvidence = readPass2572AuditProviderPrivateStaticEvidence(pass2572AuditProviderRuntime);
  const pass78VerifiedSourceBundle = parseVerifiedSoliditySourceBundle(pass78PrivateStaticEvidence?.sourceText);
  const pass78SourceContextIntegrity = pass78VerifiedSourceBundle.valid
    ? detectP78Erc2771MulticallContext(pass78VerifiedSourceBundle.files)
    : null;
  const pass79HistoricalDeploymentContext = buildP79HistoricalDeploymentContextAdjudication({
    chain: normalized.chain,
    contractAddress: normalized.contractAddress,
    sourceContextIntegrity: pass78SourceContextIntegrity,
  });
  const pass2573AuditRuntimeConfidence = buildPass2573AuditRuntimeConfidenceReport({
    ...normalized,
    locale,
    sourceQuorum: pass2570AuditSourceQuorum,
    providerRuntime: pass2572AuditProviderRuntime,
  });
  const pass2574AuditClaimLedger = buildPass2574AuditClaimLedgerReport({
    ...normalized,
    locale,
    sourceQuorum: pass2570AuditSourceQuorum,
    providerRuntime: pass2572AuditProviderRuntime,
    runtimeConfidence: pass2573AuditRuntimeConfidence,
    authorityEvidence,
    sourceContextIntegrity: pass78SourceContextIntegrity,
    deploymentContextEvidence: pass79HistoricalDeploymentContext,
    currentDeploymentQuorumEvidence: pass82CurrentDeploymentQuorum,
  });
  const pass2575AuditSourceFreshness = buildPass2575AuditSourceFreshnessReport({
    ...normalized,
    locale,
    providerRuntime: pass2572AuditProviderRuntime,
    claimLedger: pass2574AuditClaimLedger,
  });
  const pass2576AuditPermissionParser = buildPass2576AuditPermissionParserReport({
    ...normalized,
    locale,
    providerRuntime: pass2572AuditProviderRuntime,
    claimLedger: pass2574AuditClaimLedger,
    sourceFreshness: pass2575AuditSourceFreshness,
  });
  const pass2577AuditLiquidityHolderLockRisk = buildPass2577AuditLiquidityHolderLockRiskReport({
    ...normalized,
    locale,
    providerRuntime: pass2572AuditProviderRuntime,
    claimLedger: pass2574AuditClaimLedger,
    sourceFreshness: pass2575AuditSourceFreshness,
    permissionParser: pass2576AuditPermissionParser,
  });
  const pass2578AuditReportAssembler = buildPass2578AuditReportAssemblerReport({
    ...normalized,
    locale,
    providerRuntime: pass2572AuditProviderRuntime,
    runtimeConfidence: pass2573AuditRuntimeConfidence,
    claimLedger: pass2574AuditClaimLedger,
    sourceFreshness: pass2575AuditSourceFreshness,
    permissionParser: pass2576AuditPermissionParser,
    liquidityHolderRisk: pass2577AuditLiquidityHolderLockRisk,
  });
  const pass2579AdvancedManualReviewQueue = buildPass2579AdvancedManualReviewQueueReport({
    ...normalized,
    locale,
    reportAssembler: pass2578AuditReportAssembler,
  });
  const pass2580CustomerSafeDeliveryDecision = buildPass2580CustomerSafeDeliveryDecisionReport({
    ...normalized,
    locale,
    reportAssembler: pass2578AuditReportAssembler,
    advancedManualReviewQueue: pass2579AdvancedManualReviewQueue,
  });
  const pass2581AuditVersionedRecheckReceipt = buildPass2581AuditVersionedRecheckReceiptReport({
    ...normalized,
    locale,
    reportAssembler: pass2578AuditReportAssembler,
    customerSafeDeliveryDecision: pass2580CustomerSafeDeliveryDecision,
  });
  const pass2582RealProviderAdapterHardening = buildPass2582RealProviderAdapterHardeningReport({
    ...normalized,
    locale,
    providerIntelligence: pass2571AuditProviderIntelligence,
    providerRuntime: pass2572AuditProviderRuntime,
    versionedRecheckReceipt: pass2581AuditVersionedRecheckReceipt,
  });
  const pass2583ContractSourceAbiExtraction = buildPass2583ContractSourceAbiExtractionReport({
    ...normalized,
    locale,
    providerRuntime: pass2572AuditProviderRuntime,
    permissionParser: pass2576AuditPermissionParser,
    realProviderAdapterHardening: pass2582RealProviderAdapterHardening,
  });
  const pass2584HolderLiquidityDepthEvidence = buildPass2584HolderLiquidityDepthEvidenceReport({
    ...normalized,
    locale,
    providerRuntime: pass2572AuditProviderRuntime,
    liquidityHolderRisk: pass2577AuditLiquidityHolderLockRisk,
    realProviderAdapterHardening: pass2582RealProviderAdapterHardening,
    contractSourceAbiExtraction: pass2583ContractSourceAbiExtraction,
  });
  const pass2585PremiumProPdfTemplateContract = buildPass2585PremiumProPdfTemplateContractReport({
    ...normalized,
    locale,
    reportAssembler: pass2578AuditReportAssembler,
    customerSafeDeliveryDecision: pass2580CustomerSafeDeliveryDecision,
    versionedRecheckReceipt: pass2581AuditVersionedRecheckReceipt,
    realProviderAdapterHardening: pass2582RealProviderAdapterHardening,
    contractSourceAbiExtraction: pass2583ContractSourceAbiExtraction,
    holderLiquidityDepthEvidence: pass2584HolderLiquidityDepthEvidence,
  });
  const pass2586AdvancedOperatorConsoleMerge = buildPass2586AdvancedOperatorConsoleMergeReport({
    ...normalized,
    locale,
    paymentVerified: Boolean(pass2362PaidAccessReceipt?.ok),
    advancedManualReviewQueue: pass2579AdvancedManualReviewQueue,
    customerSafeDeliveryDecision: pass2580CustomerSafeDeliveryDecision,
    versionedRecheckReceipt: pass2581AuditVersionedRecheckReceipt,
    premiumProPdfTemplateContract: pass2585PremiumProPdfTemplateContract,
  });
  const pass2587ServerPaymentAccountDeliveryGate = buildPass2587ServerPaymentAccountDeliveryGateReport({
    ...normalized,
    locale,
    paidAccessReceipt: pass2362PaidAccessReceipt,
    accountMessage: accountMessageReadinessPreview,
    versionedRecheckReceipt: pass2581AuditVersionedRecheckReceipt,
    advancedOperatorConsoleMerge: pass2586AdvancedOperatorConsoleMerge,
  });
  const pass2588AuditCaseVaultPrivateDeliveryLedger = buildPass2588AuditCaseVaultPrivateDeliveryLedgerReport({
    ...normalized,
    locale,
    accountMessage: accountMessageReadinessPreview,
    versionedRecheckReceipt: pass2581AuditVersionedRecheckReceipt,
    premiumProPdfTemplateContract: pass2585PremiumProPdfTemplateContract,
    advancedOperatorConsoleMerge: pass2586AdvancedOperatorConsoleMerge,
    serverPaymentAccountDeliveryGate: pass2587ServerPaymentAccountDeliveryGate,
  });
  const pass2589SourceFreshnessRecheckOrchestrator = buildPass2589SourceFreshnessRecheckOrchestratorReport({
    ...normalized,
    locale,
    sourceFreshness: pass2575AuditSourceFreshness,
    versionedRecheckReceipt: pass2581AuditVersionedRecheckReceipt,
    auditCaseVaultPrivateDeliveryLedger: pass2588AuditCaseVaultPrivateDeliveryLedger,
  });
  const pass2590RiskFormulaEvidenceWeightingContract = buildPass2590RiskFormulaEvidenceWeightingContractReport({
    ...normalized,
    locale,
    runtimeConfidence: pass2573AuditRuntimeConfidence,
    sourceFreshness: pass2575AuditSourceFreshness,
    permissionParser: pass2576AuditPermissionParser,
    liquidityHolderRisk: pass2577AuditLiquidityHolderLockRisk,
    holderLiquidityDepthEvidence: pass2584HolderLiquidityDepthEvidence,
    advancedOperatorConsoleMerge: pass2586AdvancedOperatorConsoleMerge,
    sourceFreshnessRecheckOrchestrator: pass2589SourceFreshnessRecheckOrchestrator,
  });
  const pass2591RiskCalibrationGoldenFixtureHarness = buildPass2591RiskCalibrationGoldenFixtureHarnessReport({
    ...normalized,
    locale,
    runtimeConfidence: pass2573AuditRuntimeConfidence,
    contractSourceAbiExtraction: pass2583ContractSourceAbiExtraction,
    holderLiquidityDepthEvidence: pass2584HolderLiquidityDepthEvidence,
    advancedOperatorConsoleMerge: pass2586AdvancedOperatorConsoleMerge,
    serverPaymentAccountDeliveryGate: pass2587ServerPaymentAccountDeliveryGate,
    sourceFreshnessRecheckOrchestrator: pass2589SourceFreshnessRecheckOrchestrator,
    riskFormulaEvidenceWeightingContract: pass2590RiskFormulaEvidenceWeightingContract,
  });
  const pass2592ProviderConflictArbitrationMatrix = buildPass2592ProviderConflictArbitrationMatrixReport({
    ...normalized,
    locale,
    providerRuntime: pass2572AuditProviderRuntime,
    claimLedger: pass2574AuditClaimLedger,
    realProviderAdapterHardening: pass2582RealProviderAdapterHardening,
    sourceFreshnessRecheckOrchestrator: pass2589SourceFreshnessRecheckOrchestrator,
    riskFormulaEvidenceWeightingContract: pass2590RiskFormulaEvidenceWeightingContract,
    riskCalibrationGoldenFixtureHarness: pass2591RiskCalibrationGoldenFixtureHarness,
  });
  const pass2593EvidenceNarrativeClaimLedgerExplainability = buildPass2593EvidenceNarrativeClaimLedgerExplainabilityReport({
    ...normalized,
    locale,
    claimLedger: pass2574AuditClaimLedger,
    providerConflictArbitrationMatrix: pass2592ProviderConflictArbitrationMatrix,
    riskFormulaEvidenceWeightingContract: pass2590RiskFormulaEvidenceWeightingContract,
    sourceFreshnessRecheckOrchestrator: pass2589SourceFreshnessRecheckOrchestrator,
  });
  const pass2594AuditEvidenceQaReleaseGateMatrix = buildPass2594AuditEvidenceQaReleaseGateMatrixReport({
    ...normalized,
    locale,
    premiumProPdfTemplateContract: pass2585PremiumProPdfTemplateContract,
    advancedOperatorConsoleMerge: pass2586AdvancedOperatorConsoleMerge,
    serverPaymentAccountDeliveryGate: pass2587ServerPaymentAccountDeliveryGate,
    sourceFreshnessRecheckOrchestrator: pass2589SourceFreshnessRecheckOrchestrator,
    riskFormulaEvidenceWeightingContract: pass2590RiskFormulaEvidenceWeightingContract,
    riskCalibrationGoldenFixtureHarness: pass2591RiskCalibrationGoldenFixtureHarness,
    providerConflictArbitrationMatrix: pass2592ProviderConflictArbitrationMatrix,
    evidenceNarrativeClaimLedgerExplainability: pass2593EvidenceNarrativeClaimLedgerExplainability,
  });
  const pass4644CapabilitiesByFamily: Record<string, string[]> = {
    dex_market: ["identity", "chain_context", "liquidity", "pair_presence"],
    contract_risk: ["identity", "honeypot", "tax", "permission"],
    contract_simulation: ["identity", "scenario", "simulation"],
  };
  const pass4644AuditProviderReceipts = pass2572AuditProviderRuntime.lanes
    .filter((lane) =>
      lane.state === "confirmed"
      && lane.identity?.verification === "exact_response"
      && lane.identity.matched === true
      && Boolean(lane.providerFamily)
      && Boolean(pass4644CapabilitiesByFamily[lane.providerFamily ?? ""]),
    )
    .map((lane) => createPass4644ProviderEvidenceReceipt({
      providerId: lane.id,
      providerFamily: lane.providerFamily ?? "rejected_unknown_family",
      surface: "contract_audit",
      verification: "normalized_response",
      state: "confirmed",
      requestedIdentity: customerContractAddress,
      resolvedAddress: lane.identity?.resolvedAddress,
      resolvedChainId: lane.identity?.resolvedChainId,
      identityMatched: lane.identity?.matched === true,
      capabilities: pass4644CapabilitiesByFamily[lane.providerFamily ?? ""] ?? [],
      timestampProvenance: "transport_received",
      observedAt: lane.receipt?.observedAt ?? pass2572AuditProviderRuntime.generatedAt,
      receivedAt: new Date(),
      ttlMs: 10 * 60_000,
      httpStatus: 200,
      latencyMs: lane.latencyMs ?? 0,
      normalizedPayload: {
        laneId: lane.id,
        provider: lane.provider,
        providerFamily: lane.providerFamily,
        state: lane.state,
        identity: lane.identity,
        evidence: lane.evidence,
        chainId: pass2572AuditProviderRuntime.target.chainId,
      },
    }));

  const pass4645AuditProviderEvidenceLedger = buildPass4645ProviderEvidenceLedger({
    receipts: pass4644AuditProviderReceipts,
    requestedIdentity: customerContractAddress,
    surface: "contract_audit",
    depth: paidAuditDepth ?? "basic",
    generatedAt: new Date(),
    signingSecret: process.env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET?.trim() || null,
  });
  const pass4645AuditProviderEvidencePersistence = await persistPass4645ProviderEvidenceLedger(pass4645AuditProviderEvidenceLedger).catch((error) => ({
    schemaVersion: "pass4645_provider_evidence_persistence_v1" as const,
    durable: false,
    mode: "not_configured" as const,
    ledgerId: pass4645AuditProviderEvidenceLedger.ledgerId,
    headHash: pass4645AuditProviderEvidenceLedger.headHash,
    recordCount: pass4645AuditProviderEvidenceLedger.entries.length,
    readBackVerified: false,
    persistedAt: null,
    locator: null,
    blockers: [`audit_provider_receipt_persistence_error:${error instanceof Error ? error.name : "unknown"}`],
  }));

  const pass4656AuditBenchmarkReleaseProof = resolvePass4656AuditBenchmarkReleaseProofFromEnv();
  const pass4809AuditCommercialCohortGates = {
    pro: resolveCommercialCohortGateFromEnv({ product: "audit", tier: "pro" }),
    advanced: resolveCommercialCohortGateFromEnv({ product: "audit", tier: "advanced" }),
  } as const;
  // P90: technical provider success never creates customer-display, paid-tier,
  // PDF-export or retention rights. Evaluate the same current provider lanes
  // against the field-level rights/currentness registry before checkout, paid
  // delivery or any customer artifact can proceed.
  const pass4826AuditPaidEvidenceReadiness = {
    basic: evaluateAuditPaidEvidenceReadiness({
      lanes: pass2572AuditProviderRuntime.lanes,
      tier: "basic",
      tierContract: getAuditTierContract("basic"),
      evidenceRows: pass2578AuditReportAssembler.summary.totalEvidence,
      authorityEvidence,
      evaluatedAt: pass2578AuditReportAssembler.generatedAt,
    }),
    pro: evaluateAuditPaidEvidenceReadiness({
      lanes: pass2572AuditProviderRuntime.lanes,
      tier: "pro",
      tierContract: getAuditTierContract("pro"),
      evidenceRows: pass2578AuditReportAssembler.summary.totalEvidence,
      authorityEvidence: null,
      evaluatedAt: pass2578AuditReportAssembler.generatedAt,
    }),
    advanced: evaluateAuditPaidEvidenceReadiness({
      lanes: pass2572AuditProviderRuntime.lanes,
      tier: "advanced",
      tierContract: getAuditTierContract("advanced"),
      evidenceRows: pass2578AuditReportAssembler.summary.totalEvidence,
      authorityEvidence: null,
      evaluatedAt: pass2578AuditReportAssembler.generatedAt,
    }),
  } as const;
  const pass4826CustomerSafeRightsSummary = {
    basic: buildCustomerSafeAuditProviderRightsSummary(pass4826AuditPaidEvidenceReadiness.basic.rightsCurrentness),
    pro: buildCustomerSafeAuditProviderRightsSummary(pass4826AuditPaidEvidenceReadiness.pro.rightsCurrentness),
    advanced: buildCustomerSafeAuditProviderRightsSummary(pass4826AuditPaidEvidenceReadiness.advanced.rightsCurrentness),
  } as const;

  const pass4643AuditTierValueProof = buildPass4643AuditTierValueProof({
    lanes: pass2572AuditProviderRuntime.lanes,
    requestedIdentity: customerContractAddress,
    providerEvidenceReceipts: pass4644AuditProviderReceipts,
    providerEvidenceLedger: pass4645AuditProviderEvidenceLedger,
    providerConfirmed: pass2572AuditProviderRuntime.summary.confirmed,
    providerPartial: pass2572AuditProviderRuntime.summary.partial,
    sourceAbiReady: pass2583ContractSourceAbiExtraction.summary.canFeedPermissionParser,
    permissionParserReady: pass2576AuditPermissionParser.summary.blocked === 0 && pass2576AuditPermissionParser.summary.unknown <= 2,
    liquidityHolderRiskReady: pass2584HolderLiquidityDepthEvidence.summary.canFeedReportAssembler,
    pdfParityReady: pass2594AuditEvidenceQaReleaseGateMatrix.summary.canRenderProPdf,
    durableReceiptReady: pass4645AuditProviderEvidencePersistence.durable && pass4645AuditProviderEvidencePersistence.readBackVerified,
    verifiedPaymentReceipt: Boolean(pass4639NormalizedPaidReceipt?.ok),
    automatedFinalDeliveryReady: pass2587ServerPaymentAccountDeliveryGate.summary.canDeliverAdvancedPrivately,
    conflictFree: pass2592ProviderConflictArbitrationMatrix.summary.blockingConflicts === 0 && pass2592ProviderConflictArbitrationMatrix.summary.providerDivergence === 0,
    auditBenchmarkProof: pass4656AuditBenchmarkReleaseProof,
    commercialCohortGates: pass4809AuditCommercialCohortGates,
    paidEvidenceReadiness: pass4826AuditPaidEvidenceReadiness,
  });

  const qaProPreCheckoutReady = !pass2594AuditEvidenceQaReleaseGateMatrix.gates.some(
    (gate) => gate.id !== "qa-payment-private-delivery-boundary" && gate.blocksProPdfRelease,
  );
  const qaAdvancedPreCheckoutReady = !pass2594AuditEvidenceQaReleaseGateMatrix.gates.some(
    (gate) =>
      gate.id !== "qa-payment-private-delivery-boundary" &&
      gate.id !== "qa-advanced-deterministic-delivery" &&
      gate.blocksAdvancedFinalSign,
  );
  const tierPreCheckoutReady = {
    basic: pass2594AuditEvidenceQaReleaseGateMatrix.summary.canReleaseBasicPublic && pass4643AuditTierValueProof.tiers.basic.preCheckoutReady,
    pro: qaProPreCheckoutReady && pass4643AuditTierValueProof.tiers.pro.preCheckoutReady,
    advanced: qaAdvancedPreCheckoutReady && pass4643AuditTierValueProof.tiers.advanced.preCheckoutReady,
  } as const;
  const tierDeliveryReady = {
    basic: tierPreCheckoutReady.basic && pass4643AuditTierValueProof.tiers.basic.deliveryReady,
    pro: pass2594AuditEvidenceQaReleaseGateMatrix.summary.canRenderProPdf && pass4643AuditTierValueProof.tiers.pro.deliveryReady,
    advanced: pass2594AuditEvidenceQaReleaseGateMatrix.summary.canReleaseAdvancedDeterministically && pass4643AuditTierValueProof.tiers.advanced.deliveryReady,
  } as const;
  const auditTierMatrix = buildAuditTierCustomerMatrix({
    requestedTier: paidAuditDepth ?? "basic",
    paymentVerified: Boolean(pass4639NormalizedPaidReceipt?.ok),
    preCheckoutReady: tierPreCheckoutReady,
    deliveryReady: tierDeliveryReady,
    blockers: {
      basic: pass4643AuditTierValueProof.tiers.basic.blockers,
      pro: pass4643AuditTierValueProof.tiers.pro.deliveryBlockers,
      advanced: pass4643AuditTierValueProof.tiers.advanced.deliveryBlockers,
    },
  });

  const auditCommercialReadiness = {
    schemaVersion: "pass4796_audit_commercial_readiness_v3",
    requestedDepth: paidAuditDepth ?? "basic",
    providerCoverage: pass2572AuditProviderRuntime.summary.liveProviderCoverage,
    providerConfirmed: pass2572AuditProviderRuntime.summary.confirmed,
    providerPartial: pass2572AuditProviderRuntime.summary.partial,
    providerTimedOut: pass2572AuditProviderRuntime.summary.timedOut,
    basicSellReady: tierPreCheckoutReady.basic,
    proSellReady: tierPreCheckoutReady.pro,
    advancedSellReady: tierPreCheckoutReady.advanced,
    proPreCheckoutReady: tierPreCheckoutReady.pro,
    advancedPreCheckoutReady: tierPreCheckoutReady.advanced,
    proDeliveryReady: tierDeliveryReady.pro,
    advancedDeliveryReady: tierDeliveryReady.advanced,
    releaseReadiness: pass2594AuditEvidenceQaReleaseGateMatrix.summary.releaseReadiness,
    topBlocker: (paidAuditDepth === "pro"
      ? pass4643AuditTierValueProof.tiers.pro.deliveryBlockers[0]
      : pass4643AuditTierValueProof.tiers.basic.deliveryBlockers[0])
      ?? pass2594AuditEvidenceQaReleaseGateMatrix.summary.topReleaseBlocker,
    providerRightsCurrentness: pass4826CustomerSafeRightsSummary,
    // Advanced is rejected fail-closed above as NOT_FOR_SALE, so only Pro or Basic can reach this decision.
    checkoutAllowed: paidAuditDepth === "pro"
      ? tierDeliveryReady.pro
      : tierDeliveryReady.basic,
    tierValueProof: pass4643AuditTierValueProof,
    tierMatrix: auditTierMatrix,
    auditBenchmarkProof: pass4656AuditBenchmarkReleaseProof,
    commercialCohortGates: pass4809AuditCommercialCohortGates,
    commercialDelivery: buildPass4651CommercialDeliveryDecision({
      tier: paidAuditDepth ?? "basic",
      surface: "contract_audit",
      entitlementVerified: Boolean(pass4639NormalizedPaidReceipt?.ok),
      preCheckoutReady: paidAuditDepth === "pro"
        ? tierPreCheckoutReady.pro
        : tierPreCheckoutReady.basic,
      analysisSellReady: paidAuditDepth === "pro"
        ? tierPreCheckoutReady.pro
        : tierPreCheckoutReady.basic,
      durableEvidenceReady: paidAuditDepth === null || (pass4645AuditProviderEvidencePersistence.durable && pass4645AuditProviderEvidencePersistence.readBackVerified),
      outputReady: paidAuditDepth === "pro"
        ? tierDeliveryReady.pro
        : tierDeliveryReady.basic,
      providerDegraded: pass2572AuditProviderRuntime.summary.timedOut > 0,
      // No Advanced request can reach this branch; no human/operator sign-off is promised for Basic or Pro.
      operatorSignReady: true,
    }),
    providerEvidenceLedger: pass4645AuditProviderEvidenceLedger,
    providerEvidencePersistence: pass4645AuditProviderEvidencePersistence,
  } as const;

  const requestedRightsSummary = paidAuditDepth === "pro"
    ? pass4826CustomerSafeRightsSummary.pro
    : pass4826CustomerSafeRightsSummary.basic;
  const customerDataRightsReady = requestedRightsSummary.commercialUseReady;
  const auditCustomerResult = {
    schemaVersion: "pass4640_audit_customer_result_v2",
    dataStatus: !customerDataRightsReady
      ? "rights_currentness_blocked"
      : auditCommercialReadiness.providerConfirmed > 0
        ? "source_confirmed"
        : auditCommercialReadiness.providerPartial > 0
          ? "partial_data"
          : "insufficient_data",
    riskScore: customerDataRightsReady && auditCommercialReadiness.providerConfirmed > 0
      ? pass2590RiskFormulaEvidenceWeightingContract.summary.finalRiskScore
      : null,
    confidence: customerDataRightsReady && auditCommercialReadiness.providerConfirmed > 0
      ? pass2590RiskFormulaEvidenceWeightingContract.summary.formulaConfidence
      : 0,
    providerCoverage: customerDataRightsReady ? auditCommercialReadiness.providerCoverage : 0,
    releaseReadiness: customerDataRightsReady ? auditCommercialReadiness.releaseReadiness : 0,
    topBlocker: customerDataRightsReady ? auditCommercialReadiness.topBlocker : "provider_rights_currentness_not_ready",
    providerRightsCurrentness: requestedRightsSummary,
  } as const;

  const requestedReadinessTier = payload.readinessOnly &&
    (payload.readinessTier === "pro" || payload.readinessTier === "advanced")
    ? payload.readinessTier
    : null;
  const requestedTierEvidenceReady = requestedReadinessTier === "pro"
    ? auditCommercialReadiness.proPreCheckoutReady
    : requestedReadinessTier === "advanced"
      ? auditCommercialReadiness.advancedPreCheckoutReady
      : false;
  let auditCheckoutCase: {
    ok: boolean;
    caseRef?: string;
    durable?: boolean;
    storageMode?: string;
    blocker?: string;
  } | null = null;

  if (requestedReadinessTier) {
    if (!requestedTierEvidenceReady) {
      auditCheckoutCase = { ok: false, blocker: "evidence_not_ready" };
    } else if (!account) {
      auditCheckoutCase = { ok: false, blocker: "account_required" };
    } else {
      const target = normalizeAuditTarget(
        normalized.contractAddress ||
          normalized.auditUrl ||
          normalized.githubUrl ||
          normalized.website ||
          normalized.projectName ||
          "",
        { chainId: "56", chainName: "BSC" },
      );
      if (!target) {
        auditCheckoutCase = { ok: false, blocker: "valid_target_required" };
      } else {
        const created = await createAuditIntakeCase({
          requestId: `${preview.requestId}-${requestedReadinessTier}`,
          target,
          sourceCandidates: {
            auditUrl: normalized.auditUrl,
            docsUrl: normalized.docsUrl,
            githubUrl: normalized.githubUrl,
            website: normalized.website,
          },
          tier: requestedReadinessTier,
          locale,
          accountId: account.accountId,
          accountEmail: account.email,
        });
        auditCheckoutCase = created.ok && created.record
          ? {
              ok: true,
              caseRef: created.record.caseRef,
              durable: created.durable,
              storageMode: created.storageMode,
            }
          : {
              ok: false,
              durable: created.durable,
              storageMode: created.storageMode,
              blocker: created.error || "audit_case_creation_failed",
            };
      }
    }
  }

  if (paidAuditDepth && !auditCommercialReadiness.checkoutAllowed) {
    const customerMessage = locale === "de"
      ? "Diese kostenpflichtige Audit-Stufe ist noch nicht lieferbereit. Die Zahlung wurde erkannt, aber der Bericht bleibt gesperrt, bis Evidenz sowie Nutzungsrechte und Aktualität vollständig verifiziert sind."
      : locale === "pl"
        ? "Ten płatny poziom audytu nie jest jeszcze gotowy do dostarczenia. Płatność została rozpoznana, ale raport pozostaje zablokowany, dopóki dowody oraz prawa użycia i aktualność nie zostaną w pełni zweryfikowane."
        : "This paid audit tier is not delivery-ready yet. Payment was recognized, but the report remains blocked until evidence, usage rights and currentness are fully verified.";
    return NextResponse.json({
      ok: false,
      error: "premium_audit_not_ready",
      basicFallbackAvailable: pass4826CustomerSafeRightsSummary.basic.commercialUseReady,
      requestedTier: paidAuditDepth,
      releaseState: "blocked",
      customerResult: auditCustomerResult,
      providerRightsCurrentness: requestedRightsSummary,
      auditCheckoutCase: auditCheckoutCase?.ok === true
        ? { ok: true, durable: auditCheckoutCase.durable === true }
        : { ok: false, blocker: "checkout_not_created" },
      customerMessage,
    }, {
      status: 422,
      headers: {
        "cache-control": "no-store",
        "x-velmere-audit-commercial-readiness": "blocked",
        "x-velmere-audit-provider-rights": customerDataRightsReady ? "verified" : "blocked",
        "x-velmere-audit-basic-fallback": pass4826CustomerSafeRightsSummary.basic.commercialUseReady ? "true" : "false",
      },
    });
  }


  const canonicalCustomerPipeline = buildPass4820AuditCustomerReportPipeline({
    report: pass2578AuditReportAssembler,
    providerRuntime: pass2572AuditProviderRuntime,
    requestedTier: paidAuditDepth ?? "basic",
    paymentVerified: Boolean(pass2362PaidAccessReceipt?.ok),
    evidenceLedgerVerified: pass4645AuditProviderEvidencePersistence.durable && pass4645AuditProviderEvidencePersistence.readBackVerified,
    accountBindingHash: hashVelmereAccountBinding(accountMessageReadinessPreview.accountId),
    entitlementId: pass2362PaidAccessReceipt?.entitlement?.id ?? null,
    paidTokenNonce: null,
    manualReviewVerified: false,
    monitoringConfigured: false,
    authorityEvidence,
  });
  if (canonicalCustomerPipeline.releaseState === "blocked") {
    return NextResponse.json({
      ok: false,
      error: "audit_customer_report_not_delivery_ready",
      releaseState: "blocked",
      requestedTier: paidAuditDepth ?? "basic",
      deliveredTier: null,
      availability: canonicalCustomerPipeline.publicAvailability,
      blockedReasons: [
        canonicalCustomerPipeline.publicAvailability.reasonCode,
        ...canonicalCustomerPipeline.publicAvailability.limitationCodes,
      ],
      customerMessage: locale === "de"
        ? "Der Bericht bleibt gesperrt, bis Evidenz, Nutzungsrechte und Aktualität die kanonischen Lieferungsregeln erfüllen."
        : locale === "pl"
          ? "Raport pozostaje zablokowany, dopóki dowody, prawa użycia i aktualność nie spełnią kanonicznych reguł dostarczenia."
          : "The report remains locked until evidence, usage rights and currentness satisfy the canonical delivery policy.",
    }, {
      status: 422,
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
        "x-velmere-audit-customer-delivery": "blocked",
        "x-velmere-audit-provider-rights": canonicalCustomerPipeline.publicAvailability.commercialUseReady ? "verified" : "blocked",
      },
    });
  }
  const unboundCanonicalCustomerSnapshot = buildAuditAccountCustomerSnapshot({
    pipeline: canonicalCustomerPipeline,
    accountIdHash: hashVelmereAccountBinding(accountMessageReadinessPreview.accountId),
    requestId: accountMessage.requestId,
    projectName: customerProjectName,
    targetLabel: customerContractAddress,
  });
  const renderedCanonicalAuditPdf = renderCustomerSafeAuditPdf(unboundCanonicalCustomerSnapshot.layoutInput);
  const exactAuditArtifactSnapshot = buildPass4822AccountCustomerArtifactSnapshot({
    accountId: accountMessageReadinessPreview.accountId,
    surface: "audit",
    payloadKind: "audit_customer_report_v1",
    reportId: unboundCanonicalCustomerSnapshot.reportId,
    requestedTier: unboundCanonicalCustomerSnapshot.requestedTier,
    deliveredTier: unboundCanonicalCustomerSnapshot.deliveredTier,
    locale: unboundCanonicalCustomerSnapshot.locale,
    title: unboundCanonicalCustomerSnapshot.layoutInput.title,
    subject: unboundCanonicalCustomerSnapshot.targetLabel,
    generatedAt: unboundCanonicalCustomerSnapshot.generatedAt,
    payload: canonicalCustomerPipeline.customerReport,
    canonicalArtifact: unboundCanonicalCustomerSnapshot.canonicalArtifact,
    pdfStorage: "exact_immutable_blob",
  });
  const finalAccountDeliveryInput = auditCheckoutCase?.ok && auditCheckoutCase.caseRef && !accountDeliveryInput.auditCaseRef
    ? { ...accountDeliveryInput, auditCaseRef: auditCheckoutCase.caseRef }
    : accountDeliveryInput;
  let atomicPublication: Awaited<ReturnType<typeof publishP84AuditExactArtifactOwnerReadable>>;
  try {
    atomicPublication = await publishP84AuditExactArtifactOwnerReadable({
      accountId: accountMessageReadinessPreview.accountId,
      messageInput: finalAccountDeliveryInput,
      auditSnapshot: unboundCanonicalCustomerSnapshot,
      accountArtifactSnapshot: exactAuditArtifactSnapshot,
      pdfBytes: renderedCanonicalAuditPdf.bytes,
    });
  } catch (error) {
    const durableStorageRequired = error instanceof Error
      && error.message === P84_AUDIT_EXACT_ARTIFACT_DURABLE_STORAGE_REQUIRED;
    return NextResponse.json({
      ok: false,
      error: durableStorageRequired
        ? "audit_exact_artifact_atomic_storage_required"
        : "audit_exact_artifact_atomic_publication_unavailable",
      message: durableStorageRequired
        ? "Audit delivery is unavailable because the atomic durable snapshot, PDF, internal message and owner-readable link publisher is not configured. Nothing was committed."
        : "Audit delivery is unavailable because the immutable PDF, internal message and owner-readable delivery link could not be committed in one database transaction. Nothing was published.",
      retryable: true,
    }, {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "retry-after": "30",
        "x-velmere-audit-exact-artifact-publication": durableStorageRequired ? "durable-required" : "atomic-failed",
      },
    });
  }
  const canonicalCustomerSnapshot = atomicPublication.auditSnapshot;
  const storedAccountMessage = {
    record: atomicPublication.message,
    source: atomicPublication.source,
  } as const;
  const storedExactAuditArtifact = {
    snapshot: atomicPublication.snapshot,
    blob: atomicPublication.blob,
    source: atomicPublication.source,
    created: atomicPublication.createdArtifact,
  } as const;

  return NextResponse.json(sanitizePublicAuditEnvelope({
    ok: true,
    surface: "velmere-security-audit-watch-customer",
    responseMode: "customer_compact",
    normalized,
    assessment,
    commercialReadiness: auditCommercialReadiness,
    customerResult: auditCustomerResult,
    pass4643AuditTierValueProof,
    auditTierMatrix,
    preview,
    publicReportRoute: queueRecord.publicRoute,
    exportRoute: exportPayload.exportRoute,
    accountMessage: storedAccountMessage.record,
    canonicalCustomerSnapshot: {
      snapshotId: canonicalCustomerSnapshot.snapshotId,
      snapshotDigest: canonicalCustomerSnapshot.snapshotDigest,
      pipelineDigest: canonicalCustomerSnapshot.pipelineDigest,
      layoutDigest: canonicalCustomerSnapshot.canonicalLayout.layoutDigest,
      requestedTier: canonicalCustomerSnapshot.requestedTier,
      deliveredTier: canonicalCustomerSnapshot.deliveredTier,
      exactAccountArtifactId: canonicalCustomerSnapshot.exactAccountArtifact?.snapshotId ?? null,
      exactPdfDigest: canonicalCustomerSnapshot.exactAccountArtifact?.pdfDigest ?? null,
    },
    accountCustomerArtifact: {
      artifactId: storedExactAuditArtifact.snapshot.snapshotId,
      route: `/api/account/customer-artifact?id=${encodeURIComponent(storedExactAuditArtifact.snapshot.snapshotId)}`,
      previewRoute: `/api/account/customer-artifact?id=${encodeURIComponent(storedExactAuditArtifact.snapshot.snapshotId)}&format=pdf&disposition=preview`,
      downloadRoute: `/api/account/customer-artifact?id=${encodeURIComponent(storedExactAuditArtifact.snapshot.snapshotId)}&format=pdf&disposition=download`,
      source: storedExactAuditArtifact.source,
    },
    pass2362PaymentReceipt: pass4639NormalizedPaidReceipt,
    auditCheckoutCase,
  }), {
    headers: {
      "cache-control": "no-store",
      "x-velmere-audit-response-mode": "customer-compact",
      "x-velmere-audit-full-proof-runtime": "archived-offline",
    },
  });
}
