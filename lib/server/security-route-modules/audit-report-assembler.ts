import { NextResponse } from "next/server";
import { buildPass2570AuditSourceQuorumReport } from "@/lib/security/audit-source-quorum-runtime";
import { buildPass2571AuditProviderIntelligenceReport } from "@/lib/security/audit-provider-intelligence";
import { buildPass2572AuditProviderRuntimeReport } from "@/lib/security/audit-provider-runtime-client";
import { buildPass2573AuditRuntimeConfidenceReport } from "@/lib/security/audit-runtime-confidence";
import { buildPass2574AuditClaimLedgerReport } from "@/lib/security/audit-claim-ledger";
import { buildPass2575AuditSourceFreshnessReport } from "@/lib/security/audit-source-freshness";
import { buildPass2576AuditPermissionParserReport } from "@/lib/security/audit-permission-parser";
import { buildPass2577AuditLiquidityHolderLockRiskReport } from "@/lib/security/audit-liquidity-holder-lock-risk";
import { buildPass2578AuditReportAssemblerReport, PASS2578_AUDIT_REPORT_ASSEMBLER_ID } from "@/lib/security/audit-report-assembler";
import { buildCanonicalEvidencePacket, projectCanonicalEvidencePacketForTier, verifyCanonicalEvidencePacketIntegrity } from "@/lib/market-integrity/canonical-evidence-packet";
import { appendProviderEvidencePacket } from "@/lib/market-integrity/provider-evidence-packet-ledger";
import { getAuditTierContract, type AuditTierId } from "@/lib/security/audit-tier-contract";
import { hasVlmPaidSurfaceServerEntitlement, verifyVlmPaidSurfaceTokenEntitlement } from "@/lib/commerce/vlm-paid-surface-guard";
import { buildPass4420AdvancedPaidContext } from "@/lib/security/audit-watch-server-helpers";
import { evaluateAuditPaidEvidenceReadiness } from "@/lib/security/audit-paid-evidence-readiness";
import { buildCustomerSafeAuditProviderRightsSummary } from "@/lib/security/audit-provider-rights-currentness";
import { buildPass4820AuditCustomerReportPipeline, PASS4820_AUDIT_CUSTOMER_REPORT_PIPELINE_ID } from "@/lib/security/audit-customer-report-pipeline";
import { reportRouteHeaders } from "@/lib/security/report-route-inventory";
import { buildAuditAdjudicatedAuthorityEvidence } from "@/lib/security/audit-adjudicated-authority-evidence";

import { withPass4824AuditProviderPublicGet } from "@/lib/security/audit-provider-public-get-control";

function clean(value: string | null, fallback = "", max = 180) {
  const text = String(value ?? fallback).replace(/[<>\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : fallback;
}

export async function GET(request: Request) {
  return withPass4824AuditProviderPublicGet(request, "/api/security/audit-report-assembler", () =>
    handlePass4824AuditProviderGet(request));
}

async function handlePass4824AuditProviderGet(request: Request) {
  const url = new URL(request.url);
  const locale = clean(url.searchParams.get("locale"), "en", 8);
  const selectedLocale = locale === "pl" || locale === "de" ? locale : "en";
  const chain = clean(url.searchParams.get("chain"), "ethereum", 40);
  const target = clean(url.searchParams.get("target"), "0x0000000000000000000000000000000000000000", 180);
  const projectName = clean(url.searchParams.get("projectName"), "", 90);
  const auditUrl = clean(url.searchParams.get("auditUrl"), "", 600);
  const docsUrl = clean(url.searchParams.get("docsUrl"), "", 600);
  const githubUrl = clean(url.searchParams.get("githubUrl"), "", 600);
  const website = clean(url.searchParams.get("website"), "", 600);
  const tierParam = clean(url.searchParams.get("tier"), "basic", 16);
  const tier: AuditTierId = tierParam === "advanced" || tierParam === "pro" ? tierParam : "basic";
  // R44P44: Advanced has no public or customer-deliverable product. Fail before providers, evidence, preview or entitlement lookup.
  if (tier === "advanced") {
    return NextResponse.json({
      ok: false,
      error: "audit_advanced_not_for_sale",
      tier,
      decision: "NOT_FOR_SALE",
      publicPrice: null,
      publicCheckoutAllowed: false,
      humanReviewIncluded: false,
      reportGenerated: false,
      previewGenerated: false,
      evidenceReleased: false,
      customerBoundary: "Advanced is not for sale. No human review, operator sign-off or customer entitlement is included.",
    }, {
      status: 409,
      headers: {
        ...reportRouteHeaders("/api/security/audit-report-assembler"),
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
        "x-velmere-audit-tier": tier,
        "x-velmere-access-decision": "NOT_FOR_SALE",
      },
    });
  }
  const tierContract = getAuditTierContract(tier);
  const isContract = /^0x[a-fA-F0-9]{40}$/.test(target);
  const targetInput = {
    locale: selectedLocale,
    chain,
    contractAddress: isContract ? target : undefined,
    projectName: projectName || (isContract ? undefined : target),
    auditUrl: auditUrl || undefined,
    docsUrl: docsUrl || undefined,
    githubUrl: githubUrl || undefined,
    website: website || undefined,
    reviewLevel: tierContract.reviewLevel,
  };

  let paymentVerified = !tierContract.entitlementRequired;
  let paidBinding: { accountBindingHash?: string | null; entitlementId?: string | null; paidEntitlementBinding?: string | null } = {};
  if (tierContract.entitlementRequired && tierContract.productId) {
    const paidAccess = await verifyVlmPaidSurfaceTokenEntitlement({
      policyId: "audit_review",
      request,
      productId: tierContract.productId,
      context: buildPass4420AdvancedPaidContext({
        locale: selectedLocale,
        depth: "pro",
        contractAddress: isContract ? target : undefined,
        projectName: isContract ? undefined : target,
      }),
    });
    if (!hasVlmPaidSurfaceServerEntitlement(paidAccess)) {
      return NextResponse.json({
        ok: false,
        error: "audit_pro_invitation_entitlement_required",
        tier,
        productId: tierContract.productId,
        decision: "INVITATION_ONLY_CONTROLLED_BETA",
        publicPrice: null,
        publicCheckoutAllowed: false,
        reason: paidAccess.ok ? "server_entitlement_record_required" : paidAccess.error,
      }, {
        status: 403,
        headers: {
          ...reportRouteHeaders("/api/security/audit-report-assembler"),
          "cache-control": "private, no-store, max-age=0",
          "x-content-type-options": "nosniff",
          "x-velmere-audit-tier": tier,
          "x-velmere-access-decision": "INVITATION_ONLY_CONTROLLED_BETA",
        },
      });
    }
    paymentVerified = true;
    paidBinding = {
      accountBindingHash: paidAccess.entitlement?.context.accountIdHash ?? null,
      entitlementId: paidAccess.entitlement?.id ?? null,
      paidEntitlementBinding: paidAccess.entitlement?.contextHash ?? null,
    };
  }

  const sourceQuorum = buildPass2570AuditSourceQuorumReport(targetInput);
  const providerIntelligence = buildPass2571AuditProviderIntelligenceReport({ ...targetInput, sourceQuorum });
  const authorityEvidencePromise = buildAuditAdjudicatedAuthorityEvidence({
    chain,
    contractAddress: isContract ? target : null,
    docsUrl: docsUrl || null,
    maintainerUrl: githubUrl || null,
  });
  const providerRuntime = await buildPass2572AuditProviderRuntimeReport({ ...targetInput, providerIntelligence });
  const authorityEvidence = await authorityEvidencePromise;
  const runtimeConfidence = buildPass2573AuditRuntimeConfidenceReport({ ...targetInput, sourceQuorum, providerRuntime });
  const claimLedger = buildPass2574AuditClaimLedgerReport({ ...targetInput, sourceQuorum, providerRuntime, runtimeConfidence, authorityEvidence });
  const sourceFreshness = buildPass2575AuditSourceFreshnessReport({ ...targetInput, providerRuntime, claimLedger });
  const permissionParser = buildPass2576AuditPermissionParserReport({ ...targetInput, providerRuntime, claimLedger, sourceFreshness });
  const liquidityHolderRisk = buildPass2577AuditLiquidityHolderLockRiskReport({ ...targetInput, providerRuntime, claimLedger, sourceFreshness, permissionParser });
  const reportAssembler = buildPass2578AuditReportAssemblerReport({
    ...targetInput,
    providerRuntime,
    runtimeConfidence,
    claimLedger,
    sourceFreshness,
    permissionParser,
    liquidityHolderRisk,
  });

  const canonicalEvidencePacket = buildCanonicalEvidencePacket({
    assetKey: target,
    tier,
    surface: "audit",
    locale: selectedLocale,
    generatedAt: reportAssembler.generatedAt,
    auditReport: reportAssembler,
  });
  if (!verifyCanonicalEvidencePacketIntegrity(canonicalEvidencePacket)) {
    return NextResponse.json({ ok: false, error: "canonical_evidence_integrity_failed" }, { status: 500, headers: { "cache-control": "no-store" } });
  }

  const evidenceReadinessInternal = evaluateAuditPaidEvidenceReadiness({
    lanes: providerRuntime.lanes,
    tier,
    tierContract,
    evidenceRows: reportAssembler.summary.totalEvidence,
    authorityEvidence,
  });
  const evidenceReadiness = {
    schemaVersion: "pass4829.audit-readiness-customer-projection.v1" as const,
    tier,
    technicalMet: evidenceReadinessInternal.technicalMet,
    commercialMet: evidenceReadinessInternal.commercialMet,
    technical: {
      strictReceipts: evidenceReadinessInternal.strictConfirmedLanes,
      successfulLiveExecutions: evidenceReadinessInternal.successfulLiveProviderLanes,
      independentProviderFamilies: evidenceReadinessInternal.independentProviderFamilies,
      independentUpstreamRoots: evidenceReadinessInternal.independentUpstreamRoots,
      evidenceRows: evidenceReadinessInternal.evidenceRows,
    },
    requirements: evidenceReadinessInternal.minimum,
    technicalBlockers: evidenceReadinessInternal.technicalBlockers,
    providerRightsCurrentness: buildCustomerSafeAuditProviderRightsSummary(evidenceReadinessInternal.rightsCurrentness),
  } as const;
  const evidenceLedger = await appendProviderEvidencePacket({
    domain: "canonical_evidence",
    assetKey: target,
    scope: `audit:${tier}`,
    packetId: canonicalEvidencePacket.packetId,
    payloadDigest: canonicalEvidencePacket.integrity.digest,
    observedAt: canonicalEvidencePacket.generatedAt,
    metadata: {
      tier,
      paymentVerified,
      evidenceReady: evidenceReadinessInternal.commercialMet,
      humanReviewRequired: tierContract.humanReviewRequired,
      riskScore: reportAssembler.finalVerdict.riskScore,
      reviewPriorityScore: reportAssembler.finalVerdict.reviewPriorityScore,
      authorityEvidenceState: authorityEvidence.state,
      authorityEvidenceDigest: authorityEvidence.evidenceDigest,
    },
  });
  if (!evidenceLedger.ok) {
    return NextResponse.json({ ok: false, error: "audit_evidence_ledger_failed" }, { status: 500, headers: { "cache-control": "no-store" } });
  }

  const customerPipeline = buildPass4820AuditCustomerReportPipeline({
    report: reportAssembler,
    providerRuntime,
    requestedTier: tier,
    paymentVerified,
    evidenceLedgerVerified: evidenceLedger.ok,
    ...paidBinding,
    manualReviewVerified: false,
    monitoringConfigured: false,
    authorityEvidence,
  });

  if (customerPipeline.releaseState === "blocked") {
    return NextResponse.json({
      ok: false,
      error: "audit_customer_report_not_delivery_ready",
      releaseState: "blocked",
      requestedTier: tier,
      deliveredTier: null,
      availability: customerPipeline.publicAvailability,
      blockedReasons: [
        customerPipeline.publicAvailability.reasonCode,
        ...customerPipeline.publicAvailability.limitationCodes,
      ],
      customerBoundary: "No audit projection, preview, evidence packet or PDF is released until the canonical customer delivery policy has an eligible visible tier.",
    }, {
      status: 422,
      headers: {
        ...reportRouteHeaders("/api/security/audit-report-assembler"),
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
        "x-velmere-audit-customer-delivery": "blocked",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    tier,
    deliveredTier: customerPipeline.deliveredTier,
    tierContract,
    paymentVerified,
    releaseState: customerPipeline.releaseState,
    evidenceReadiness,
    auditTierReadiness: customerPipeline.readiness,
    pass2578AuditReportAssembler: customerPipeline.projection.report,
    customerReport: customerPipeline.customerReport,
    customerReportPreviewLayout: customerPipeline.customerReportPreviewLayout,
    customerProjection: customerPipeline.projection,
    pipelineDigest: customerPipeline.pipelineDigest,
    finalVerdict: customerPipeline.projection.report.finalVerdict,
    evidencePacket: projectCanonicalEvidencePacketForTier(canonicalEvidencePacket, customerPipeline.deliveredTier),
    evidenceLedger,
    adjudicatedAuthorityEvidence: {
      state: authorityEvidence.state,
      category: authorityEvidence.category,
      evidenceDigest: authorityEvidence.evidenceDigest,
      authorityRoots: authorityEvidence.authorityRoots,
      documentedAlternateAddress: authorityEvidence.documentedAlternateAddress,
      blockers: authorityEvidence.blockers,
    },
    topFindings: customerPipeline.projection.report.topFindings,
    visualMergeContract: customerPipeline.projection.report.visualMergeContract,
    customerBoundary: "The API returns only the allowed tier projection. Advanced is not for sale; deeper automated evidence/retest actions remain gated and do not create human-review, operator-signoff, certification, entitlement or release proof.",
  }, {
    headers: {
      ...reportRouteHeaders("/api/security/audit-report-assembler"),
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "x-velmere-audit-report-assembler": PASS2578_AUDIT_REPORT_ASSEMBLER_ID,
      "x-velmere-audit-customer-pipeline": PASS4820_AUDIT_CUSTOMER_REPORT_PIPELINE_ID,
      "x-velmere-audit-pipeline-digest": customerPipeline.pipelineDigest,
      "x-velmere-audit-layout-digest": customerPipeline.customerReportPreviewLayout.layoutDigest,
      "x-velmere-canonical-evidence": canonicalEvidencePacket.integrity.digest,
      "x-velmere-audit-tier": tier,
      "x-velmere-audit-delivered-tier": customerPipeline.deliveredTier,
    },
  });
}
