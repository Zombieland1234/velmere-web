import { NextResponse } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { buildPass2812PaidTierSecuritySuite, buildReportAccessDecision } from "@/lib/market-integrity/top1-entitlement-report-access";
import { buildPass2813VlmBrainClaimFirewall, buildPass2813VlmBrainSourcePlan } from "@/lib/market-integrity/top1-vlm-brain-source-router";
import { buildPass2814SourcePoisoningFirewall } from "@/lib/market-integrity/top1-source-poisoning-ssrf-firewall";
import { VELMERE_SOURCE_REGISTRY_V1, buildSourceReceipt, type VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { VelmereReportAssetFamily } from "@/lib/market-integrity/customer-report-payload";
import { buildPass2815ReportIntegrityVault } from "@/lib/market-integrity/top1-report-integrity-vault";
import { buildPass2816RuntimeObservabilityLedger } from "@/lib/market-integrity/top1-runtime-observability-ledger";

function tierFromRequest(value: string | null): VelmereTier {
  const normalized = (value ?? "Basic").toLowerCase();
  if (normalized === "advanced") return "Advanced";
  if (normalized === "pro") return "Pro";
  return "Basic";
}

function familyFromRequest(value: string | null): VelmereReportAssetFamily {
  const normalized = (value ?? "unknown").toLowerCase();
  const families: readonly VelmereReportAssetFamily[] = [
    "native_crypto", "erc20", "stablecoin", "defi_protocol", "exchange_health",
    "equity", "etf", "fx", "commodity", "real_estate", "unknown",
  ];
  return families.includes(normalized as VelmereReportAssetFamily)
    ? (normalized as VelmereReportAssetFamily)
    : "unknown";
}

function boundedCount(value: string | null, fallback: number, max: number): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(parsed)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const account = await resolveRequestAccount(request);
  const tier = tierFromRequest(url.searchParams.get("tier"));
  const family = familyFromRequest(url.searchParams.get("family"));
  const generatedAt = new Date().toISOString();
  const sourceFamilyCount = boundedCount(url.searchParams.get("sourceFamilyCount"), 1, 32);
  const missingEvidenceCount = boundedCount(url.searchParams.get("missingEvidenceCount"), 0, 128);
  const providerConflictCount = boundedCount(url.searchParams.get("providerConflictCount"), 0, 128);
  const chartSourceBound = url.searchParams.get("chartSourceBound") === "1";

  const accessContext = {
    tier,
    accountId: account?.accountId ?? null,
    serverReceiptId: null,
    reportToken: null,
    payloadHash: null,
    manualReviewReceiptId: null,
    verification: {
      accountBound: Boolean(account),
      serverReceiptVerified: false,
      reportTokenVerified: false,
      payloadHashBound: false,
      manualReviewVerified: false,
      source: "diagnostic_only" as const,
    },
  };
  const decision = buildReportAccessDecision(accessContext);
  const brainPlan = buildPass2813VlmBrainSourcePlan({
    assetFamily: family,
    tier,
    sourceFamilyCount,
    missingEvidenceCount,
    providerConflictCount,
    chartSourceBound,
    paidEvidenceAllowed: decision.paidEvidenceAllowed,
    manualReviewPresent: false,
  });
  const sourcePoisoningFirewall = buildPass2814SourcePoisoningFirewall({
    surface: "PDF",
    sourceFamily: "velmere_internal",
    targetUrl: url.searchParams.get("sourceUrl") ?? url.searchParams.get("projectUrl"),
    assetFamily: family,
    tier,
    query: url.searchParams.get("query"),
    projectUrl: url.searchParams.get("projectUrl") ?? url.searchParams.get("sourceUrl"),
  });
  const sourceLimit = tier === "Basic" ? 3 : tier === "Pro" ? 7 : VELMERE_SOURCE_REGISTRY_V1.length;
  const sourceReceipts = VELMERE_SOURCE_REGISTRY_V1
    .slice(0, sourceLimit)
    .map((entry, index) => buildSourceReceipt(entry, generatedAt, index * 18));
  const reportIntegrityVault = buildPass2815ReportIntegrityVault({
    reportId: `VLM-ACCESS-${(url.searchParams.get("query") ?? "diagnostic").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 24) || "DIAGNOSTIC"}`,
    tier,
    payloadHash: accessContext.payloadHash,
    generatedAt,
    sourceReceipts,
    reportAccessDecision: decision,
    sourcePoisoningFirewall,
  });
  const runtimeObservability = buildPass2816RuntimeObservabilityLedger({
    surface: "Report Access",
    tier,
    requestedUnits: 1,
    sourceBoundUnits: decision.paidEvidenceAllowed ? 1 : 0,
    skeletonOrMissingUnits: decision.paidEvidenceAllowed ? 0 : 1,
    containedFailures: decision.paidEvidenceAllowed ? 0 : 1,
    hardFailures: reportIntegrityVault.releaseGate.status === "block" || sourcePoisoningFirewall.releaseGate.status === "block" ? 1 : 0,
    serverUnitBudget: 1,
    softTimeoutMs: 1200,
    retryAfterMs: 30000,
    maxConcurrentBatches: 1,
    batchMode: "report",
    generatedAt,
  });

  return NextResponse.json(
    {
      ok: true,
      schemaVersion: "velmere_report_access_diagnostic_v2",
      decision,
      suite: buildPass2812PaidTierSecuritySuite(accessContext),
      brainPlan,
      claimFirewall: buildPass2813VlmBrainClaimFirewall(brainPlan),
      sourcePoisoningFirewall,
      reportIntegrityVault,
      runtimeObservability,
      diagnosticInput: {
        tier,
        family,
        sourceFamilyCount,
        missingEvidenceCount,
        providerConflictCount,
        chartSourceBound,
      },
      runtimeProofBoundary: {
        status: "customer_diagnostic_only",
        archivedProofPlane: "scripts/contracts/report-access-legacy-proof-plane-pass4693.ts.txt",
        rule: "Release, delivery, customer-export and supervisory proof is evaluated offline and is not computed by this public diagnostic route.",
      },
      customerSafeCopy: "This endpoint explains whether paid evidence can render and how VLM Brain routes the source plan. It does not create payment proof and wallet connection is never entitlement.",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
