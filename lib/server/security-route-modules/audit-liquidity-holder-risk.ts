import { NextResponse } from "next/server";
import { buildPass2570AuditSourceQuorumReport } from "@/lib/security/audit-source-quorum-runtime";
import { buildPass2571AuditProviderIntelligenceReport } from "@/lib/security/audit-provider-intelligence";
import { buildPass2572AuditProviderRuntimeReport } from "@/lib/security/audit-provider-runtime-client";
import { buildPass2573AuditRuntimeConfidenceReport } from "@/lib/security/audit-runtime-confidence";
import { buildPass2574AuditClaimLedgerReport } from "@/lib/security/audit-claim-ledger";
import { buildPass2575AuditSourceFreshnessReport } from "@/lib/security/audit-source-freshness";
import { buildPass2576AuditPermissionParserReport } from "@/lib/security/audit-permission-parser";
import { buildPass2577AuditLiquidityHolderLockRiskReport, PASS2577_AUDIT_LIQUIDITY_HOLDER_LOCK_RISK_ID } from "@/lib/security/audit-liquidity-holder-lock-risk";

import { withPass4824AuditProviderPublicGet } from "@/lib/security/audit-provider-public-get-control";

function clean(value: string | null, fallback = "", max = 180) {
  const text = String(value ?? fallback).replace(/[<>\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : fallback;
}

export async function GET(request: Request) {
  return withPass4824AuditProviderPublicGet(request, "/api/security/audit-liquidity-holder-risk", () =>
    handlePass4824AuditProviderGet(request));
}

async function handlePass4824AuditProviderGet(request: Request) {
  const url = new URL(request.url);
  const locale = clean(url.searchParams.get("locale"), "en", 8);
  const chain = clean(url.searchParams.get("chain"), "ethereum", 40);
  const target = clean(url.searchParams.get("target"), "0x0000000000000000000000000000000000000000", 180);
  const isContract = /^0x[a-fA-F0-9]{40}$/.test(target);

  const sourceQuorum = buildPass2570AuditSourceQuorumReport({ locale, chain, contractAddress: isContract ? target : undefined, projectName: isContract ? undefined : target, reviewLevel: "basic_review" });
  const providerIntelligence = buildPass2571AuditProviderIntelligenceReport({ locale, chain, contractAddress: isContract ? target : undefined, projectName: isContract ? undefined : target, reviewLevel: "basic_review", sourceQuorum });
  const providerRuntime = await buildPass2572AuditProviderRuntimeReport({ locale, chain, contractAddress: isContract ? target : undefined, projectName: isContract ? undefined : target, reviewLevel: "basic_review", providerIntelligence });
  const runtimeConfidence = buildPass2573AuditRuntimeConfidenceReport({ locale, chain, contractAddress: isContract ? target : undefined, projectName: isContract ? undefined : target, reviewLevel: "basic_review", sourceQuorum, providerRuntime });
  const claimLedger = buildPass2574AuditClaimLedgerReport({ locale, chain, contractAddress: isContract ? target : undefined, projectName: isContract ? undefined : target, reviewLevel: "basic_review", sourceQuorum, providerRuntime, runtimeConfidence });
  const sourceFreshness = buildPass2575AuditSourceFreshnessReport({ locale, chain, contractAddress: isContract ? target : undefined, projectName: isContract ? undefined : target, reviewLevel: "basic_review", providerRuntime, claimLedger });
  const permissionParser = buildPass2576AuditPermissionParserReport({ locale, chain, contractAddress: isContract ? target : undefined, projectName: isContract ? undefined : target, reviewLevel: "basic_review", providerRuntime, claimLedger, sourceFreshness });
  const liquidityHolderRisk = buildPass2577AuditLiquidityHolderLockRiskReport({ locale, chain, contractAddress: isContract ? target : undefined, projectName: isContract ? undefined : target, reviewLevel: "basic_review", providerRuntime, claimLedger, sourceFreshness, permissionParser });

  return NextResponse.json({
    ok: true,
    pass2577AuditLiquidityHolderLockRisk: liquidityHolderRisk,
    summary: liquidityHolderRisk.summary,
    basicRows: liquidityHolderRisk.basicRows,
    proPdfRows: liquidityHolderRisk.proPdfRows,
  }, {
    headers: {
      "cache-control": "no-store",
      "x-velmere-pass2577-liquidity-holder-lock-risk": PASS2577_AUDIT_LIQUIDITY_HOLDER_LOCK_RISK_ID,
    },
  });
}
