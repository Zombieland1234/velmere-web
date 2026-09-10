import { NextResponse } from "next/server";
import { sanitizePublicAuditEnvelope } from "@/lib/security/public-private-route-lockdown";
import { buildPass2572AuditProviderRuntimeReport } from "@/lib/security/audit-provider-runtime-client";
import { buildPass2574AuditClaimLedgerReport } from "@/lib/security/audit-claim-ledger";
import { buildPass2575AuditSourceFreshnessReport } from "@/lib/security/audit-source-freshness";
import { buildPass2578AuditReportAssemblerReport } from "@/lib/security/audit-report-assembler";
import { buildPass2580CustomerSafeDeliveryDecisionReport } from "@/lib/security/customer-safe-delivery-decision";
import { buildPass2581AuditVersionedRecheckReceiptReport } from "@/lib/security/audit-versioned-recheck-receipt";
import { buildPass2588AuditCaseVaultPrivateDeliveryLedgerReport } from "@/lib/security/audit-case-vault-private-delivery-ledger";
import { buildPass2589SourceFreshnessRecheckOrchestratorReport, PASS2589_SOURCE_FRESHNESS_RECHECK_ORCHESTRATOR_ID } from "@/lib/security/source-freshness-recheck-orchestrator";

import { withPass4824AuditProviderPublicGet } from "@/lib/security/audit-provider-public-get-control";

function clean(value: string | null, fallback = "", max = 180) {
  const text = String(value ?? fallback).replace(/[<>\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : fallback;
}

export async function GET(request: Request) {
  return withPass4824AuditProviderPublicGet(request, "/api/security/audit-source-freshness-recheck-orchestrator", () =>
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
  const claimLedger = buildPass2574AuditClaimLedgerReport({ ...base, providerRuntime });
  const sourceFreshness = buildPass2575AuditSourceFreshnessReport({ ...base, providerRuntime, claimLedger });
  const reportAssembler = buildPass2578AuditReportAssemblerReport({ ...base, providerRuntime, claimLedger, sourceFreshness });
  const customerSafeDeliveryDecision = buildPass2580CustomerSafeDeliveryDecisionReport({ ...base, reportAssembler });
  const versionedRecheckReceipt = buildPass2581AuditVersionedRecheckReceiptReport({ ...base, reportAssembler, customerSafeDeliveryDecision });
  const auditCaseVaultPrivateDeliveryLedger = buildPass2588AuditCaseVaultPrivateDeliveryLedgerReport({ ...base, versionedRecheckReceipt });
  const report = buildPass2589SourceFreshnessRecheckOrchestratorReport({
    ...base,
    sourceFreshness,
    versionedRecheckReceipt,
    auditCaseVaultPrivateDeliveryLedger,
  });

  return NextResponse.json(sanitizePublicAuditEnvelope({ ok: true, report }, "audit-source-freshness-recheck-orchestrator-public"), {
    headers: {
      "x-velmere-public-api-sanitized": "true",
      "cache-control": "no-store",
      "x-velmere-source-freshness-recheck-orchestrator": PASS2589_SOURCE_FRESHNESS_RECHECK_ORCHESTRATOR_ID,
      "x-velmere-no-silent-report-mutation": "true",
    },
  });
}
