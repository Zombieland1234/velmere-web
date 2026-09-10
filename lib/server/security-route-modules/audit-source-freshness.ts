import { NextResponse } from "next/server";
import { buildPass2570AuditSourceQuorumReport } from "@/lib/security/audit-source-quorum-runtime";
import { buildPass2571AuditProviderIntelligenceReport } from "@/lib/security/audit-provider-intelligence";
import { buildPass2572AuditProviderRuntimeReport } from "@/lib/security/audit-provider-runtime-client";
import { buildPass2573AuditRuntimeConfidenceReport } from "@/lib/security/audit-runtime-confidence";
import { buildPass2574AuditClaimLedgerReport } from "@/lib/security/audit-claim-ledger";
import { buildPass2575AuditSourceFreshnessReport, PASS2575_AUDIT_SOURCE_FRESHNESS_ID } from "@/lib/security/audit-source-freshness";

import { withPass4824AuditProviderPublicGet } from "@/lib/security/audit-provider-public-get-control";

function clean(value: string | null, fallback = "", max = 180) {
  const text = String(value ?? fallback).replace(/[<>\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : fallback;
}

export async function GET(request: Request) {
  return withPass4824AuditProviderPublicGet(request, "/api/security/audit-source-freshness", () =>
    handlePass4824AuditProviderGet(request));
}

async function handlePass4824AuditProviderGet(request: Request) {
  const url = new URL(request.url);
  const locale = clean(url.searchParams.get("locale"), "en", 8);
  const chain = clean(url.searchParams.get("chain"), "ethereum", 40);
  const target = clean(url.searchParams.get("target"), "0x0000000000000000000000000000000000000000", 180);
  const isContract = /^0x[a-fA-F0-9]{40}$/.test(target);

  const sourceQuorum = buildPass2570AuditSourceQuorumReport({
    locale,
    chain,
    contractAddress: isContract ? target : undefined,
    projectName: isContract ? undefined : target,
    reviewLevel: "basic_review",
  });
  const providerIntelligence = buildPass2571AuditProviderIntelligenceReport({
    locale,
    chain,
    contractAddress: isContract ? target : undefined,
    projectName: isContract ? undefined : target,
    reviewLevel: "basic_review",
    sourceQuorum,
  });
  const providerRuntime = await buildPass2572AuditProviderRuntimeReport({
    locale,
    chain,
    contractAddress: isContract ? target : undefined,
    projectName: isContract ? undefined : target,
    reviewLevel: "basic_review",
    providerIntelligence,
  });
  const runtimeConfidence = buildPass2573AuditRuntimeConfidenceReport({
    locale,
    chain,
    contractAddress: isContract ? target : undefined,
    projectName: isContract ? undefined : target,
    reviewLevel: "basic_review",
    sourceQuorum,
    providerRuntime,
  });
  const claimLedger = buildPass2574AuditClaimLedgerReport({
    locale,
    chain,
    contractAddress: isContract ? target : undefined,
    projectName: isContract ? undefined : target,
    reviewLevel: "basic_review",
    sourceQuorum,
    providerRuntime,
    runtimeConfidence,
  });
  const sourceFreshness = buildPass2575AuditSourceFreshnessReport({
    locale,
    chain,
    contractAddress: isContract ? target : undefined,
    projectName: isContract ? undefined : target,
    reviewLevel: "basic_review",
    providerRuntime,
    claimLedger,
  });

  return NextResponse.json({
    ok: true,
    pass2575AuditSourceFreshness: sourceFreshness,
    summary: sourceFreshness.summary,
    customerRows: sourceFreshness.customerRows,
    proPdfRows: sourceFreshness.proPdfRows,
  }, {
    headers: {
      "cache-control": "no-store",
      "x-velmere-pass2575-source-freshness": PASS2575_AUDIT_SOURCE_FRESHNESS_ID,
    },
  });
}
