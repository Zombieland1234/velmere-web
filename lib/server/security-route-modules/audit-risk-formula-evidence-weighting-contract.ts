import { NextResponse } from "next/server";
import { sanitizePublicAuditEnvelope } from "@/lib/security/public-private-route-lockdown";
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
import { buildPass2584HolderLiquidityDepthEvidenceReport } from "@/lib/security/holder-liquidity-depth-evidence";
import { buildPass2585PremiumProPdfTemplateContractReport } from "@/lib/security/premium-pro-pdf-template-contract";
import { buildPass2586AdvancedOperatorConsoleMergeReport } from "@/lib/security/advanced-operator-console-merge";
import { buildPass2589SourceFreshnessRecheckOrchestratorReport } from "@/lib/security/source-freshness-recheck-orchestrator";
import { buildPass2590RiskFormulaEvidenceWeightingContractReport, PASS2590_RISK_FORMULA_EVIDENCE_WEIGHTING_CONTRACT_ID } from "@/lib/security/risk-formula-evidence-weighting-contract";

import { withPass4824AuditProviderPublicGet } from "@/lib/security/audit-provider-public-get-control";

function clean(value: string | null, fallback = "", max = 180) {
  const text = String(value ?? fallback).replace(/[<>\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : fallback;
}

export async function GET(request: Request) {
  return withPass4824AuditProviderPublicGet(request, "/api/security/audit-risk-formula-evidence-weighting-contract", () =>
    handlePass4824AuditProviderGet(request));
}

async function handlePass4824AuditProviderGet(request: Request) {
  const url = new URL(request.url);
  const locale = clean(url.searchParams.get("locale"), "en", 8);
  const chain = clean(url.searchParams.get("chain"), "ethereum", 40);
  const target = clean(url.searchParams.get("target"), "Velmere sample token", 180);
  const isContract = /^0x[a-fA-F0-9]{40}$/.test(target);
  const base = {
    locale,
    chain,
    contractAddress: isContract ? target : undefined,
    projectName: isContract ? undefined : target,
    reviewLevel: "advanced_review",
  } as const;

  const providerRuntime = await buildPass2572AuditProviderRuntimeReport(base);
  const runtimeConfidence = buildPass2573AuditRuntimeConfidenceReport({ ...base, providerRuntime });
  const claimLedger = buildPass2574AuditClaimLedgerReport({ ...base, providerRuntime, runtimeConfidence });
  const sourceFreshness = buildPass2575AuditSourceFreshnessReport({ ...base, providerRuntime, claimLedger });
  const permissionParser = buildPass2576AuditPermissionParserReport({ ...base, providerRuntime, claimLedger, sourceFreshness });
  const liquidityHolderRisk = buildPass2577AuditLiquidityHolderLockRiskReport({ ...base, providerRuntime, claimLedger, sourceFreshness, permissionParser });
  const reportAssembler = buildPass2578AuditReportAssemblerReport({ ...base, providerRuntime, runtimeConfidence, claimLedger, sourceFreshness, permissionParser, liquidityHolderRisk });
  const advancedManualReviewQueue = buildPass2579AdvancedManualReviewQueueReport({ ...base, reportAssembler });
  const customerSafeDeliveryDecision = buildPass2580CustomerSafeDeliveryDecisionReport({ ...base, reportAssembler, advancedManualReviewQueue });
  const versionedRecheckReceipt = buildPass2581AuditVersionedRecheckReceiptReport({ ...base, reportAssembler, customerSafeDeliveryDecision });
  const holderLiquidityDepthEvidence = buildPass2584HolderLiquidityDepthEvidenceReport({ ...base, providerRuntime, liquidityHolderRisk });
  const premiumProPdfTemplateContract = buildPass2585PremiumProPdfTemplateContractReport({ ...base, reportAssembler, customerSafeDeliveryDecision, versionedRecheckReceipt, holderLiquidityDepthEvidence });
  const advancedOperatorConsoleMerge = buildPass2586AdvancedOperatorConsoleMergeReport({ ...base, advancedManualReviewQueue, customerSafeDeliveryDecision, versionedRecheckReceipt, premiumProPdfTemplateContract });
  const sourceFreshnessRecheckOrchestrator = buildPass2589SourceFreshnessRecheckOrchestratorReport({ ...base, sourceFreshness, versionedRecheckReceipt });
  const report = buildPass2590RiskFormulaEvidenceWeightingContractReport({
    ...base,
    runtimeConfidence,
    sourceFreshness,
    permissionParser,
    liquidityHolderRisk,
    holderLiquidityDepthEvidence,
    advancedOperatorConsoleMerge,
    sourceFreshnessRecheckOrchestrator,
  });

  return NextResponse.json(sanitizePublicAuditEnvelope({ ok: true, report }, "audit-risk-formula-evidence-weighting-contract-public"), {
    headers: {
      "x-velmere-public-api-sanitized": "true",
      "cache-control": "no-store",
      "x-velmere-risk-formula-evidence-weighting-contract": PASS2590_RISK_FORMULA_EVIDENCE_WEIGHTING_CONTRACT_ID,
      "x-velmere-no-random-risk-score": "true",
      "x-velmere-score-version": report.formulaContract.version,
    },
  });
}
