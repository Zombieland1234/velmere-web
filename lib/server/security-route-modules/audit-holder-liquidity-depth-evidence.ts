import { NextResponse } from "next/server";
import { buildPass2570AuditSourceQuorumReport } from "@/lib/security/audit-source-quorum-runtime";
import { buildPass2571AuditProviderIntelligenceReport } from "@/lib/security/audit-provider-intelligence";
import { buildPass2572AuditProviderRuntimeReport } from "@/lib/security/audit-provider-runtime-client";
import { buildPass2573AuditRuntimeConfidenceReport } from "@/lib/security/audit-runtime-confidence";
import { buildPass2574AuditClaimLedgerReport } from "@/lib/security/audit-claim-ledger";
import { buildPass2575AuditSourceFreshnessReport } from "@/lib/security/audit-source-freshness";
import { buildPass2576AuditPermissionParserReport } from "@/lib/security/audit-permission-parser";
import { buildPass2577AuditLiquidityHolderLockRiskReport } from "@/lib/security/audit-liquidity-holder-lock-risk";
import { buildPass2582RealProviderAdapterHardeningReport } from "@/lib/security/real-provider-adapter-hardening";
import { buildPass2583ContractSourceAbiExtractionReport } from "@/lib/security/contract-source-abi-extraction";
import { buildPass2584HolderLiquidityDepthEvidenceReport, PASS2584_HOLDER_LIQUIDITY_DEPTH_EVIDENCE_ID } from "@/lib/security/holder-liquidity-depth-evidence";
import { buildPass2622PublicPrivateRouteLockdownReport, sanitizePublicAuditEnvelope } from "@/lib/security/public-private-route-lockdown";

import { withPass4824AuditProviderPublicGet } from "@/lib/security/audit-provider-public-get-control";

function clean(value: string | null, fallback = "", max = 180) {
  const text = String(value ?? fallback).replace(/[<>`$\\\r\n]/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : fallback;
}

export async function GET(request: Request) {
  return withPass4824AuditProviderPublicGet(request, "/api/security/audit-holder-liquidity-depth-evidence", () =>
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
  const realProviderAdapterHardening = buildPass2582RealProviderAdapterHardeningReport({ ...base, providerIntelligence, providerRuntime });
  const contractSourceAbiExtraction = buildPass2583ContractSourceAbiExtractionReport({ ...base, providerRuntime, permissionParser, realProviderAdapterHardening });
  const holderLiquidityDepthEvidence = buildPass2584HolderLiquidityDepthEvidenceReport({
    ...base,
    providerRuntime,
    liquidityHolderRisk,
    realProviderAdapterHardening,
    contractSourceAbiExtraction,
  });

  const pass2622PublicPrivateRouteLockdown = buildPass2622PublicPrivateRouteLockdownReport(base);

  return NextResponse.json(sanitizePublicAuditEnvelope({
    ok: true,
    pass2584HolderLiquidityDepthEvidence: holderLiquidityDepthEvidence,
    pass2622PublicPrivateRouteLockdown,
    depthLanes: holderLiquidityDepthEvidence.depthLanes,
    publicRows: holderLiquidityDepthEvidence.publicRows,
    proPdfRows: holderLiquidityDepthEvidence.proPdfRows,
    privateBoundary: "operatorRows removed from public evidence route by PASS2622",
  }, "pass2584-public-evidence"), {
    headers: {
      "cache-control": "no-store",
      "x-velmere-holder-liquidity-depth-evidence": PASS2584_HOLDER_LIQUIDITY_DEPTH_EVIDENCE_ID,
      "x-velmere-liquidity-depth-boundary": "passive-evidence-no-investment-advice-no-price-promise",
      "x-velmere-pass2622-public-private-lockdown": pass2622PublicPrivateRouteLockdown.passId,
      "x-velmere-public-api-sanitized": "true",
    },
  });
}
