import { NextResponse } from "next/server";
import { sanitizePublicAuditEnvelope } from "@/lib/security/public-private-route-lockdown";
import { normalizeAuditReviewSubmission, type AuditReviewSubmission } from "@/lib/security/audit-review-flow";
import { buildPass2572AuditProviderRuntimeReport } from "@/lib/security/audit-provider-runtime-client";
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
import { buildPass2592ProviderConflictArbitrationMatrixReport, PASS2592_PROVIDER_CONFLICT_ARBITRATION_MATRIX_ID } from "@/lib/security/provider-conflict-arbitration-matrix";
import { guardPass4281AuditPostRequest, readPass4281AuditJson, withPass4281AuditPostBudget } from "@/lib/security/api-security-post-wrapper";

import { withPass4824AuditProviderPublicGet } from "@/lib/security/audit-provider-public-get-control";

async function readSubmission(request: Request): Promise<
  | { readonly ok: true; readonly value: AuditReviewSubmission }
  | { readonly ok: false; readonly response: Response }
> {
  if (request.method === "GET") {
    const url = new URL(request.url);
    return {
      ok: true,
      value: normalizeAuditReviewSubmission({
        projectName: url.searchParams.get("projectName") || "Velmère provider conflict sample",
        contractAddress: url.searchParams.get("contractAddress") || undefined,
        chain: url.searchParams.get("chain") || "ethereum",
        reviewLevel: (url.searchParams.get("reviewLevel") as AuditReviewSubmission["reviewLevel"]) || "advanced_review",
        locale: url.searchParams.get("locale") || "en",
      }),
    };
  }
  const parsed = await readPass4281AuditJson<Partial<AuditReviewSubmission>>(request, {
    routeId: "audit-provider-conflict-arbitration-matrix",
  });
  if (!parsed.ok) return parsed;
  return { ok: true, value: normalizeAuditReviewSubmission(parsed.value) };
}

export async function GET(request: Request) {
  return withPass4824AuditProviderPublicGet(request, "/api/security/audit-provider-conflict-arbitration-matrix", () =>
    handlePass4824AuditProviderGet(request));
}

async function handlePass4824AuditProviderGet(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const pass4281Guard = await guardPass4281AuditPostRequest(request, {
    routeId: "audit-provider-conflict-arbitration-matrix",
    maxBytes: 32_768,
    limit: 20,
    windowMs: 60_000,
  });
  if (pass4281Guard) return pass4281Guard;

  return withPass4281AuditPostBudget(request, async () => {
  const submission = await readSubmission(request);
  if (!submission.ok) return submission.response;
  const base = submission.value;
  const providerRuntime = await buildPass2572AuditProviderRuntimeReport(base); // PASS4146_PROVIDER_RUNTIME_PROMISE_BOUNDARY
  const runtimeConfidence = buildPass2573AuditRuntimeConfidenceReport({ ...base, providerRuntime });
  const claimLedger = buildPass2574AuditClaimLedgerReport({ ...base, providerRuntime, runtimeConfidence });
  const sourceFreshness = buildPass2575AuditSourceFreshnessReport({ ...base, providerRuntime, claimLedger });
  const permissionParser = buildPass2576AuditPermissionParserReport({ ...base, providerRuntime, claimLedger, sourceFreshness });
  const liquidityHolderRisk = buildPass2577AuditLiquidityHolderLockRiskReport({ ...base, providerRuntime, claimLedger, sourceFreshness, permissionParser });
  const reportAssembler = buildPass2578AuditReportAssemblerReport({ ...base, providerRuntime, runtimeConfidence, claimLedger, sourceFreshness, permissionParser, liquidityHolderRisk });
  const advancedManualReviewQueue = buildPass2579AdvancedManualReviewQueueReport({ ...base, reportAssembler });
  const customerSafeDeliveryDecision = buildPass2580CustomerSafeDeliveryDecisionReport({ ...base, reportAssembler, advancedManualReviewQueue });
  const versionedRecheckReceipt = buildPass2581AuditVersionedRecheckReceiptReport({ ...base, reportAssembler, customerSafeDeliveryDecision });
  const realProviderAdapterHardening = buildPass2582RealProviderAdapterHardeningReport({ ...base, providerRuntime, versionedRecheckReceipt });
  const contractSourceAbiExtraction = buildPass2583ContractSourceAbiExtractionReport({ ...base, providerRuntime, permissionParser, realProviderAdapterHardening });
  const holderLiquidityDepthEvidence = buildPass2584HolderLiquidityDepthEvidenceReport({ ...base, providerRuntime, liquidityHolderRisk, realProviderAdapterHardening, contractSourceAbiExtraction });
  const premiumProPdfTemplateContract = buildPass2585PremiumProPdfTemplateContractReport({ ...base, reportAssembler, customerSafeDeliveryDecision, versionedRecheckReceipt, realProviderAdapterHardening, contractSourceAbiExtraction, holderLiquidityDepthEvidence });
  const advancedOperatorConsoleMerge = buildPass2586AdvancedOperatorConsoleMergeReport({ ...base, advancedManualReviewQueue, customerSafeDeliveryDecision, versionedRecheckReceipt, premiumProPdfTemplateContract });
  const serverPaymentAccountDeliveryGate = buildPass2587ServerPaymentAccountDeliveryGateReport({ ...base, paidAccessReceipt: null, accountMessage: null, versionedRecheckReceipt, advancedOperatorConsoleMerge });
  const auditCaseVaultPrivateDeliveryLedger = buildPass2588AuditCaseVaultPrivateDeliveryLedgerReport({ ...base, accountMessage: null, versionedRecheckReceipt, premiumProPdfTemplateContract, advancedOperatorConsoleMerge, serverPaymentAccountDeliveryGate });
  const sourceFreshnessRecheckOrchestrator = buildPass2589SourceFreshnessRecheckOrchestratorReport({ ...base, sourceFreshness, versionedRecheckReceipt, auditCaseVaultPrivateDeliveryLedger });
  const riskFormulaEvidenceWeightingContract = buildPass2590RiskFormulaEvidenceWeightingContractReport({ ...base, runtimeConfidence, sourceFreshness, permissionParser, liquidityHolderRisk, holderLiquidityDepthEvidence, advancedOperatorConsoleMerge, sourceFreshnessRecheckOrchestrator });
  const riskCalibrationGoldenFixtureHarness = buildPass2591RiskCalibrationGoldenFixtureHarnessReport({ ...base, runtimeConfidence, contractSourceAbiExtraction, holderLiquidityDepthEvidence, advancedOperatorConsoleMerge, serverPaymentAccountDeliveryGate, sourceFreshnessRecheckOrchestrator, riskFormulaEvidenceWeightingContract });
  const report = buildPass2592ProviderConflictArbitrationMatrixReport({
    ...base,
    providerRuntime,
    claimLedger,
    realProviderAdapterHardening,
    sourceFreshnessRecheckOrchestrator,
    riskFormulaEvidenceWeightingContract,
    riskCalibrationGoldenFixtureHarness,
  });

  return NextResponse.json(sanitizePublicAuditEnvelope({ ok: true, report }, "audit-provider-conflict-arbitration-matrix-public"), {
    headers: {
      "x-velmere-public-api-sanitized": "true",
      "cache-control": "no-store",
      "x-velmere-pass4146-provider-runtime-await-boundary": "true",
      "x-velmere-provider-conflict-arbitration-matrix": PASS2592_PROVIDER_CONFLICT_ARBITRATION_MATRIX_ID,
      "x-velmere-provider-conflicts": String(report.summary.providerDivergence + report.summary.freshnessConflict),
      "x-velmere-arbitration-readiness": String(report.summary.arbitrationReadiness),
    },
  });
  });
}
