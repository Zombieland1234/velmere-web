import { NextResponse } from "next/server";
import { buildPass2570AuditSourceQuorumReport } from "@/lib/security/audit-source-quorum-runtime";
import { buildPass2571AuditProviderIntelligenceReport } from "@/lib/security/audit-provider-intelligence";
import { buildPass2572AuditProviderRuntimeReport } from "@/lib/security/audit-provider-runtime-client";
import { buildPass2573AuditRuntimeConfidenceReport } from "@/lib/security/audit-runtime-confidence";
import { buildPass2574AuditClaimLedgerReport } from "@/lib/security/audit-claim-ledger";
import { buildPass2575AuditSourceFreshnessReport } from "@/lib/security/audit-source-freshness";
import { buildPass2576AuditPermissionParserReport } from "@/lib/security/audit-permission-parser";
import { buildPass2577AuditLiquidityHolderLockRiskReport } from "@/lib/security/audit-liquidity-holder-lock-risk";
import { buildPass2578AuditReportAssemblerReport } from "@/lib/security/audit-report-assembler";
import { buildPass2579AdvancedManualReviewQueueReport } from "@/lib/security/advanced-manual-review-queue";
import { buildPass2580CustomerSafeDeliveryDecisionReport, PASS2580_CUSTOMER_SAFE_DELIVERY_DECISION_ID } from "@/lib/security/customer-safe-delivery-decision";

import { withPass4824AuditProviderPublicGet } from "@/lib/security/audit-provider-public-get-control";

function clean(value: string | null, fallback = "", max = 180) {
  const text = String(value ?? fallback).replace(/[<>\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : fallback;
}

export async function GET(request: Request) {
  return withPass4824AuditProviderPublicGet(request, "/api/security/audit-customer-safe-delivery-decision", () =>
    handlePass4824AuditProviderGet(request));
}

async function handlePass4824AuditProviderGet(request: Request) {
  const url = new URL(request.url);
  const locale = clean(url.searchParams.get("locale"), "en", 8);
  const chain = clean(url.searchParams.get("chain"), "ethereum", 40);
  const target = clean(url.searchParams.get("target"), "0x0000000000000000000000000000000000000000", 180);
  const isContract = /^0x[a-fA-F0-9]{40}$/.test(target);

  const base = {
    locale,
    chain,
    contractAddress: isContract ? target : undefined,
    projectName: isContract ? undefined : target,
    reviewLevel: "advanced_review" as const,
  };

  const sourceQuorum = buildPass2570AuditSourceQuorumReport(base);
  const providerIntelligence = buildPass2571AuditProviderIntelligenceReport({ ...base, sourceQuorum });
  const providerRuntime = await buildPass2572AuditProviderRuntimeReport({ ...base, providerIntelligence });
  const runtimeConfidence = buildPass2573AuditRuntimeConfidenceReport({ ...base, sourceQuorum, providerRuntime });
  const claimLedger = buildPass2574AuditClaimLedgerReport({ ...base, sourceQuorum, providerRuntime, runtimeConfidence });
  const sourceFreshness = buildPass2575AuditSourceFreshnessReport({ ...base, providerRuntime, claimLedger });
  const permissionParser = buildPass2576AuditPermissionParserReport({ ...base, providerRuntime, claimLedger, sourceFreshness });
  const liquidityHolderRisk = buildPass2577AuditLiquidityHolderLockRiskReport({ ...base, providerRuntime, claimLedger, sourceFreshness, permissionParser });
  const reportAssembler = buildPass2578AuditReportAssemblerReport({ ...base, providerRuntime, runtimeConfidence, claimLedger, sourceFreshness, permissionParser, liquidityHolderRisk });
  const advancedManualReviewQueue = buildPass2579AdvancedManualReviewQueueReport({ ...base, reportAssembler });
  const customerSafeDeliveryDecision = buildPass2580CustomerSafeDeliveryDecisionReport({ ...base, reportAssembler, advancedManualReviewQueue });

  return NextResponse.json({
    ok: true,
    pass2580CustomerSafeDeliveryDecision: customerSafeDeliveryDecision,
    summary: customerSafeDeliveryDecision.summary,
    customerSafeRows: customerSafeDeliveryDecision.customerSafeRows,
    visualMergeContract: customerSafeDeliveryDecision.visualMergeContract,
  }, {
    headers: {
      "cache-control": "no-store",
      "x-velmere-pass2580-customer-safe-delivery": PASS2580_CUSTOMER_SAFE_DELIVERY_DECISION_ID,
      "x-velmere-delivery-boundary": "payment-scope-evidence-redaction-version-gated",
    },
  });
}
