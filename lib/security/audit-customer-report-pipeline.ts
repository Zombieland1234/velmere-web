import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "./ascii-control-characters";

import { normalizeProviderFamily } from "@/lib/ai/evidence-normalization";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  isPass4644CommerciallyFreshReceipt,
  type Pass4644ProviderEvidenceReceipt,
} from "@/lib/market-integrity/provider-evidence-receipt";
import { buildCustomerReportPayload, type CustomerReportDecisionSection } from "@/lib/market-integrity/customer-report-payload";
import { buildCustomerReportLayoutModel } from "@/lib/market-integrity/customer-report-layout-model";
import { requireRiskScore } from "@/lib/market-integrity/risk-score-availability";
import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2578AuditReportAssemblerReport, Pass2578ReportSection } from "@/lib/security/audit-report-assembler";
import type { Pass2572AuditProviderRuntimeReport, Pass2572RuntimeLane } from "@/lib/security/audit-provider-runtime-client";
import { evaluateAuditPaidEvidenceReadiness, isStrictAuditEvidenceLane } from "@/lib/security/audit-paid-evidence-readiness";
import {
  buildCustomerSafeAuditProviderRightsSummary,
  buildPublicAuditProviderAvailability,
  type AuditProviderPublicAvailability,
  type AuditProviderRightsRegistry,
} from "@/lib/security/audit-provider-rights-currentness";
import { getAuditTierContract, type AuditTierId } from "@/lib/security/audit-tier-contract";
import { projectAuditReportForCustomer, projectBlockedAuditReportForCustomer } from "@/lib/security/audit-report-customer-projection";
import { getVlmCurrentSkuTruth } from "@/lib/commerce/vlm-current-sku-truth";
import { verifyAuditAdjudicatedAuthorityEvidence, type AuditAdjudicatedAuthorityEvidence } from "@/lib/security/audit-adjudicated-authority-evidence";

export const P89_PASS4820_AUDIT_CUSTOMER_REPORT_PIPELINE_ID = "pass4820-audit-customer-report-pipeline-v1" as const;
export const PASS4820_AUDIT_CUSTOMER_REPORT_PIPELINE_ID = "pass4829-audit-customer-report-pipeline-v2" as const;

function tierLabel(tier: AuditTierId): VelmereTier {
  return tier === "advanced" ? "Advanced" : tier === "pro" ? "Pro" : "Basic";
}

function clean(value: unknown, max = 900) {
  return typeof value === "string"
    ? value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function auditState(section: Pass2578ReportSection): CustomerReportDecisionSection["state"] {
  if (section.state === "ready") return "ready";
  if (section.state === "partial" || section.state === "manual_review") return "watch";
  if (section.state === "blocked") return "blocked";
  return "missing";
}

function decisionSection(section: Pass2578ReportSection): CustomerReportDecisionSection {
  const minimumTier: VelmereTier = section.tier === "pro" ? "Pro" : section.tier === "advanced" ? "Advanced" : "Basic";
  const evidence = [
    section.evidenceCount > 0 ? `${section.evidenceCount} evidence rows` : "",
    ...section.sourceFamilies.map((family) => `source:${family}`),
    section.missingCount > 0 ? `${section.missingCount} missing evidence rows` : "",
  ].filter(Boolean);
  return {
    id: `audit-${section.id}`,
    title: section.title,
    minimumTier,
    state: auditState(section),
    summary: minimumTier === "Basic" ? section.customerSummary : section.proPdfSummary,
    evidence,
    actions: [section.advancedAction, section.state !== "ready" ? "Keep unresolved evidence visible in the customer report." : "Revalidate evidence before expiry."],
  };
}

function advancedDecisionSection(args: { report: Pass2578AuditReportAssemblerReport; qualityControlVerified: boolean; monitoringConfigured: boolean }): CustomerReportDecisionSection {
  const advancedTruth = getVlmCurrentSkuTruth("advanced", "en");
  return {
    id: "audit-advanced-availability-boundary",
    title: "Advanced availability and quality-control boundary",
    minimumTier: "Advanced",
    state: "blocked",
    summary: "Advanced is not for sale. Internal quality-control evidence may be retained for evaluation, but it does not unlock public delivery, human-review claims, operator sign-off or certification.",
    evidence: [
      `availability:${advancedTruth.decision}`,
      args.qualityControlVerified ? "internal quality-control receipt present" : "internal quality-control receipt missing",
      args.monitoringConfigured ? "internal monitoring/recheck configured" : "internal monitoring/recheck not configured",
      `${args.report.advancedQueue.length} automated analysis actions identified`,
    ],
    actions: [
      "Keep Advanced customer delivery blocked.",
      "Use Basic or an invitation-only Pro beta after the required evidence and internal quality-control checks pass.",
    ],
  };
}

function normalizedTarget(report: Pass2578AuditReportAssemblerReport) {
  return report.target.contractAddress ?? report.target.projectName ?? "unknown-audit-target";
}

function receiptFromLane(lane: Pass2572RuntimeLane, target: string, generatedAt: string): Pass4644ProviderEvidenceReceipt {
  const receipt = lane.receipt;
  const strict = isStrictAuditEvidenceLane(lane);
  const receivedAt = Number.isFinite(Date.parse(generatedAt)) ? generatedAt : new Date().toISOString();
  const transportObservedAt = receipt?.observedAt && Number.isFinite(Date.parse(receipt.observedAt)) ? receipt.observedAt : "";
  const sourceObservedAt = receipt?.sourceObservedAt && Number.isFinite(Date.parse(receipt.sourceObservedAt)) ? receipt.sourceObservedAt : "";
  const sourceProvenance = receipt?.sourceTimestampProvenance ?? "missing";
  // PASS4644 currently permits commercial freshness only for a timestamp emitted
  // by the provider. Retrieval/transport capture remains useful chronology but is
  // never relabelled as provider time. Chain-block and retrieval-snapshot evidence
  // stay fail-closed here until a separately versioned receipt contract supports it.
  const timestampProvenance = !receipt
    ? "missing" as const
    : sourceProvenance === "provider" && sourceObservedAt
      ? "provider" as const
      : sourceProvenance === "invalid" || (receipt.sourceObservedAt && !sourceObservedAt)
        ? "invalid" as const
        : "transport_received" as const;
  const observedAt = timestampProvenance === "provider" ? sourceObservedAt : transportObservedAt;
  const observedAtMs = Date.parse(observedAt);
  const receivedAtMs = Date.parse(receivedAt);
  const ttlMs = 15 * 60_000;
  const expiresAt = new Date((Number.isFinite(observedAtMs) ? observedAtMs : receivedAtMs) + ttlMs).toISOString();
  const futureObserved = Number.isFinite(observedAtMs) && observedAtMs > receivedAtMs + 120_000;
  const freshnessMs = Number.isFinite(observedAtMs) && Number.isFinite(receivedAtMs)
    ? Math.max(0, receivedAtMs - observedAtMs)
    : null;
  const fresh = timestampProvenance === "provider"
    && freshnessMs != null
    && !futureObserved
    && receivedAtMs <= Date.parse(expiresAt);
  const providerId = clean(lane.provider, 100) || clean(lane.label, 100) || "unknown-provider";
  const providerFamily = clean(lane.lineage?.upstreamRoot, 100) || clean(lane.providerFamily, 100) || providerId;
  const payloadHash = /^[a-f0-9]{64}$/i.test(String(receipt?.bodyDigest ?? ""))
    ? String(receipt?.bodyDigest).toLowerCase()
    : sha256Digest(canonicalJson({ lane: lane.id, state: lane.state, observedAt })).replace(/^sha256:/, "");
  const resolvedAddress = lane.identity?.resolvedAddress?.toLowerCase();
  const resolvedChainId = lane.identity?.resolvedChainId?.toLowerCase();
  const rejectionReasons = [
    !strict ? `strict_audit_lane_required:${lane.state}` : null,
    lane.identity?.verification !== "exact_response" ? "exact_response_identity_required" : null,
    lane.identity?.matched !== true ? "audit_target_identity_mismatch" : null,
    lane.lineage?.independenceEligible !== true ? "upstream_not_independence_eligible" : null,
    !receipt ? "content_bound_response_receipt_missing" : null,
    !receipt ? "provider_timestamp_missing" : null,
    receipt && timestampProvenance === "invalid" ? "provider_timestamp_invalid" : null,
    receipt && timestampProvenance === "transport_received" ? `provider_timestamp_not_source_bound:${sourceProvenance}` : null,
    futureObserved ? "provider_timestamp_from_future" : null,
  ].filter((value): value is string => Boolean(value));
  return {
    schemaVersion: "pass4644_provider_evidence_receipt_v1",
    receiptId: `audit_${sha256Digest(canonicalJson({ lane: lane.id, providerId, providerFamily, payloadHash, observedAt })).replace(/^sha256:/, "").slice(0, 24)}`,
    providerId,
    providerFamily,
    surface: "contract_audit",
    verification: receipt ? "raw_response" : "health_only",
    state: strict ? "confirmed" : lane.state === "partial" ? "partial" : "rejected",
    identity: {
      requested: target.toLowerCase().slice(0, 180),
      resolvedAddress,
      resolvedChainId,
      matched: lane.identity?.matched === true,
    },
    capabilities: Array.from(new Set([lane.providerFamily ?? "audit", ...lane.evidence.map((item) => clean(item, 80)).filter(Boolean)])).slice(0, 12),
    timestampProvenance,
    observedAt,
    receivedAt,
    expiresAt,
    freshnessMs,
    fresh,
    httpStatus: receipt?.statusCode ?? (strict ? 200 : 0),
    latencyMs: Math.max(0, Math.round(lane.latencyMs ?? 0)),
    payloadBytes: Math.max(0, Math.round(receipt?.bodyBytes ?? 0)),
    payloadHash,
    commercialEvidenceEligible: strict && fresh && rejectionReasons.length === 0,
    rejectionReasons,
  };
}

function coverage(args: {
  report: Pass2578AuditReportAssemblerReport;
  providerRuntime: Pass2572AuditProviderRuntimeReport;
  strictCount: number;
  strictUpstreamCount: number;
}) {
  const totalLanes = Math.max(1, args.providerRuntime.lanes.length);
  const providerCoverage = Math.round((args.strictCount / totalLanes) * 100);
  const freshnessSection = args.report.sections.find((section) => section.id === "freshness-ledger");
  const permissionSection = args.report.sections.find((section) => section.id === "permission-parser");
  const liquiditySection = args.report.sections.find((section) => section.id === "liquidity-holder-lock-risk");
  return {
    data: Math.max(0, Math.min(100, args.report.finalVerdict.readinessScore)),
    provider: Math.max(0, Math.min(100, providerCoverage + Math.min(20, args.strictUpstreamCount * 5))),
    historical: freshnessSection?.state === "ready" ? 92 : freshnessSection?.state === "partial" ? 68 : 30,
    evidence: Math.max(0, Math.min(100, args.report.finalVerdict.sourceConfidence)),
    onchain: Math.max(0, Math.min(100, 50 + (permissionSection?.evidenceCount ?? 0) * 5 - (permissionSection?.missingCount ?? 0) * 7)),
    security: Math.max(0, Math.min(100, 55 + (liquiditySection?.evidenceCount ?? 0) * 4 - args.report.summary.totalMissing * 3)),
  };
}

const MANUAL_REVIEW_RECEIPT_PATTERN = /^(?:manual|vlm)_receipt_[a-z0-9_-]{16,96}$/i;

function normalizeVerifiedManualReviewReceiptId(value: string | null | undefined) {
  const receiptId = String(value ?? "").trim();
  return MANUAL_REVIEW_RECEIPT_PATTERN.test(receiptId) ? receiptId : null;
}

function secureAccessBindings(args: {
  requestedTier: AuditTierId;
  paymentVerified: boolean;
  accountBindingHash?: string | null;
  entitlementId?: string | null;
  paidEntitlementBinding?: string | null;
  paidTokenNonce?: string | null;
  payloadDigest: string;
  manualReviewReceiptId?: string | null;
  manualReviewVerified: boolean;
}) {
  if (args.requestedTier === "basic" || !args.paymentVerified) return {};
  const seed = sha256Digest(canonicalJson({
    account: args.accountBindingHash ?? "",
    entitlement: args.entitlementId ?? "",
    entitlementBinding: args.paidEntitlementBinding ?? args.paidTokenNonce ?? "",
    payload: args.payloadDigest,
  })).replace(/^sha256:/, "");
  const accountHex = /^[a-f0-9]{18,64}$/i.test(String(args.accountBindingHash ?? ""))
    ? String(args.accountBindingHash).slice(0, 64)
    : seed.slice(0, 40);
  const manualReviewReceiptId = args.manualReviewVerified
    ? normalizeVerifiedManualReviewReceiptId(args.manualReviewReceiptId)
    : null;
  return {
    accountId: `server:${accountHex}`,
    serverReceiptId: `vlm_receipt_${seed.slice(0, 32)}`,
    reportToken: `vlm_rpt_${seed.slice(8, 48)}`,
    payloadHash: args.payloadDigest,
    manualReviewReceiptId,
    accessVerification: {
      accountBound: true,
      serverReceiptVerified: true,
      reportTokenVerified: true,
      payloadHashBound: true,
      manualReviewVerified: args.manualReviewVerified && Boolean(manualReviewReceiptId),
      source: "server_entitlement" as const,
    },
  };
}


function buildBlockedCustomerReport(args: {
  report: Pass2578AuditReportAssemblerReport;
  requestedTier: AuditTierId;
  availability: AuditProviderPublicAvailability;
}) {
  const locale = args.report.locale === "pl" || args.report.locale === "de" ? args.report.locale : "en";
  const reportIdDigest = sha256Digest(canonicalJson({
    generatedAt: args.report.generatedAt,
    target: args.report.target,
  })).replace(/^sha256:/, "");
  const unsigned = {
    schemaVersion: "velmere.p90.audit-customer-report-blocked.v1" as const,
    reportId: `VLM-AUDIT-${reportIdDigest.slice(0, 32)}-WITHHELD`,
    locale,
    tier: tierLabel(args.requestedTier),
    generatedAt: args.report.generatedAt,
    target: {
      symbol: args.report.target.contractAddress?.slice(0, 12) ?? "AUDIT",
      name: args.report.target.projectName ?? args.report.target.contractAddress ?? "Smart contract audit",
      family: args.report.target.contractAddress ? "erc20" as const : "defi_protocol" as const,
      chainId: args.report.target.chain ?? null,
      contractAddress: args.report.target.contractAddress ?? null,
    },
    summary: {
      riskScore: null,
      riskLabel: "WITHHELD",
      confidenceScore: 0,
      confidenceLabel: "0.00%",
      gradeLabel: "WITHHELD",
      sourceQuorum: 0,
      confidenceCapReason: "provider_evidence_rights_or_currentness_unverified",
    },
    pages: [] as const,
    decisionSections: [] as const,
    receipts: [] as const,
    missingEvidence: [
      "provider_derived_evidence_withheld",
      ...args.availability.limitationCodes.map((code) => `availability:${code}`),
    ],
    providerConflicts: [] as const,
    deliveryPolicy: {
      status: "blocked" as const,
      requestedTier: tierLabel(args.requestedTier),
      visibleTier: null,
      blockedReasons: [args.availability.reasonCode, ...args.availability.limitationCodes],
    },
    publicAvailability: args.availability,
    rule: "No score, finding, provider identity, provider URL, response detail, quorum topology or field-level evidence crosses the customer boundary while rights/currentness is withheld.",
  };
  return { ...unsigned, customerReportDigest: sha256Digest(canonicalJson(unsigned)) };
}

function buildBlockedPipelineResult(args: {
  report: Pass2578AuditReportAssemblerReport;
  requestedTier: AuditTierId;
  readiness: Record<AuditTierId, AuditProviderPublicAvailability>;
  selectedAvailability: AuditProviderPublicAvailability;
}) {
  const projection = projectBlockedAuditReportForCustomer({
    report: args.report,
    requestedTier: args.requestedTier,
    reasonDigest: args.selectedAvailability.availabilityDigest,
  });
  const customerReport = buildBlockedCustomerReport({
    report: args.report,
    requestedTier: args.requestedTier,
    availability: args.selectedAvailability,
  });
  const unsigned = {
    schemaVersion: PASS4820_AUDIT_CUSTOMER_REPORT_PIPELINE_ID,
    requestedTier: args.requestedTier,
    deliveredTier: null,
    releaseState: "blocked" as const,
    publicAvailability: args.selectedAvailability,
    readiness: args.readiness,
    projection,
    customerReport,
    customerReportPreviewLayout: null,
    sourceTruth: {
      providerRightsRegistryDigest: args.selectedAvailability.registryDigest,
      providerAvailabilityDigest: args.selectedAvailability.availabilityDigest,
      providerRightsCommercialUseReady: false,
    },
    rule: "Blocked Audit delivery returns only a generic rights/currentness availability state. Technical provider topology and provider-derived audit facts remain internal.",
  } as const;
  return { ...unsigned, pipelineDigest: sha256Digest(canonicalJson(unsigned)) };
}

export function buildPass4820AuditCustomerReportPipeline(args: {
  report: Pass2578AuditReportAssemblerReport;
  providerRuntime: Pass2572AuditProviderRuntimeReport;
  requestedTier: AuditTierId;
  paymentVerified: boolean;
  evidenceLedgerVerified: boolean;
  accountBindingHash?: string | null;
  entitlementId?: string | null;
  paidEntitlementBinding?: string | null;
  paidTokenNonce?: string | null;
  manualReviewReceiptId?: string | null;
  manualReviewVerified?: boolean;
  monitoringConfigured?: boolean;
  authorityEvidence?: AuditAdjudicatedAuthorityEvidence | null;
  /** Internal/test override. Production defaults to the canonical fail-closed registry. */
  rightsRegistry?: AuditProviderRightsRegistry;
}) {
  // A boolean from an upstream adapter is not customer-facing quality-control authority.
  // The legacy receipt can support internal evaluation only; it never unlocks Advanced,
  // human-review copy, operator sign-off, certification or public sale.
  const manualReviewReceiptId = normalizeVerifiedManualReviewReceiptId(args.manualReviewReceiptId);
  const manualReviewVerified = args.manualReviewVerified === true && Boolean(manualReviewReceiptId);
  const monitoringConfigured = manualReviewVerified && args.monitoringConfigured === true;
  const authorityEvidence = verifyAuditAdjudicatedAuthorityEvidence(args.authorityEvidence) ? args.authorityEvidence ?? null : null;
  const readinessInternal = {
    basic: evaluateAuditPaidEvidenceReadiness({ lanes: args.providerRuntime.lanes, tier: "basic", tierContract: getAuditTierContract("basic"), evidenceRows: args.report.summary.totalEvidence, authorityEvidence, evaluatedAt: args.report.generatedAt, rightsRegistry: args.rightsRegistry }),
    pro: evaluateAuditPaidEvidenceReadiness({ lanes: args.providerRuntime.lanes, tier: "pro", tierContract: getAuditTierContract("pro"), evidenceRows: args.report.summary.totalEvidence, authorityEvidence: null, evaluatedAt: args.report.generatedAt, rightsRegistry: args.rightsRegistry }),
    advanced: evaluateAuditPaidEvidenceReadiness({ lanes: args.providerRuntime.lanes, tier: "advanced", tierContract: getAuditTierContract("advanced"), evidenceRows: args.report.summary.totalEvidence, authorityEvidence: null, evaluatedAt: args.report.generatedAt, rightsRegistry: args.rightsRegistry }),
  };
  const rightsSummary = {
    basic: buildCustomerSafeAuditProviderRightsSummary(readinessInternal.basic.rightsCurrentness),
    pro: buildCustomerSafeAuditProviderRightsSummary(readinessInternal.pro.rightsCurrentness),
    advanced: buildCustomerSafeAuditProviderRightsSummary(readinessInternal.advanced.rightsCurrentness),
  } as const;
  const publicReadiness = {
    basic: buildPublicAuditProviderAvailability(rightsSummary.basic),
    pro: buildPublicAuditProviderAvailability(rightsSummary.pro),
    advanced: buildPublicAuditProviderAvailability(rightsSummary.advanced),
  } as const;
  const invitationOrLegacyEntitlementVerified = args.paymentVerified;
  const evidenceEligibleTier: AuditTierId = args.requestedTier === "advanced"
    ? readinessInternal.pro.commercialMet && invitationOrLegacyEntitlementVerified ? "pro" : "basic"
    : args.requestedTier === "pro"
      ? readinessInternal.pro.commercialMet && invitationOrLegacyEntitlementVerified ? "pro" : "basic"
      : "basic";
  const selectedRights = rightsSummary[evidenceEligibleTier];
  const selectedPublicAvailability = publicReadiness[evidenceEligibleTier];
  if (!readinessInternal.basic.commercialMet) {
    return buildBlockedPipelineResult({
      report: args.report,
      requestedTier: args.requestedTier,
      readiness: publicReadiness,
      selectedAvailability: selectedPublicAvailability,
    });
  }
  const reportRiskScore = requireRiskScore(
    args.report.finalVerdict.riskScore,
    "audit_customer_report",
  );
  const selectedRightsProviderIds = new Set(readinessInternal[evidenceEligibleTier].rightsCurrentness.rightsCurrentProviderIds);
  const customerEligibleLanes = args.providerRuntime.lanes.filter((lane) => selectedRightsProviderIds.has(lane.lineage.providerId.trim().toLowerCase()));
  const target = normalizedTarget(args.report);
  const strictLanes = customerEligibleLanes.filter(isStrictAuditEvidenceLane);
  const providerReceipts = customerEligibleLanes.map((lane) => receiptFromLane(lane, target, args.report.generatedAt));
  const strictUpstreams = Array.from(new Set(strictLanes
    .map((lane) => normalizeProviderFamily(lane.lineage.upstreamRoot || lane.providerFamily || lane.provider))
    .filter((family) => family && family !== "missing" && family !== "Velmère internal")
    .map((family) => family.toLocaleLowerCase("en-US"))));
  const payloadDigest = sha256Digest(canonicalJson({ report: args.report, readiness: readinessInternal, requestedTier: args.requestedTier, evidenceEligibleTier, authorityEvidenceDigest: authorityEvidence?.evidenceDigest ?? null }));
  const decisionSections = [
    ...args.report.sections.map(decisionSection),
    advancedDecisionSection({ report: args.report, qualityControlVerified: manualReviewVerified, monitoringConfigured }),
  ];
  const missingEvidence = Array.from(new Set([
    ...args.report.sections.filter((section) => section.missingCount > 0 || section.state === "blocked" || section.state === "missing").map((section) => `${section.title}: ${section.missingCount || section.state}`),
    ...args.providerRuntime.lanes.flatMap((lane) => lane.missing.map((item) => `${lane.label}: ${item}`)),
    !args.evidenceLedgerVerified ? "canonical evidence ledger append not verified" : null,
    args.requestedTier === "advanced" ? "Advanced is not for sale; only Basic or invitation-only Pro fallback may be delivered." : null,
    ...(authorityEvidence?.blockers ?? []).map((item) => `authority evidence: ${item}`),
    ...selectedRights.limitationCodes.map((code) => `provider rights/currentness: ${code}`),
  ].filter((value): value is string => Boolean(value))));
  const requestedForPayload: VelmereTier = tierLabel(evidenceEligibleTier);
  const accessBindings = secureAccessBindings({
    requestedTier: evidenceEligibleTier,
    paymentVerified: evidenceEligibleTier !== "basic" && invitationOrLegacyEntitlementVerified,
    accountBindingHash: args.accountBindingHash,
    entitlementId: args.entitlementId,
    paidEntitlementBinding: args.paidEntitlementBinding,
    paidTokenNonce: args.paidTokenNonce,
    payloadDigest,
    manualReviewReceiptId: null,
    manualReviewVerified: false,
  });
  const payload = buildCustomerReportPayload({
    locale: args.report.locale === "pl" || args.report.locale === "de" ? args.report.locale : "en",
    tier: requestedForPayload,
    symbol: args.report.target.contractAddress?.slice(0, 12) ?? args.report.target.projectName ?? "AUDIT",
    name: args.report.target.projectName ?? args.report.target.contractAddress ?? "Smart contract audit",
    family: args.report.target.contractAddress ? "erc20" : "defi_protocol",
    reportSurface: "security",
    riskScore: reportRiskScore,
    sourceFamilyCount: strictUpstreams.length,
    missingEvidence,
    providerConflicts: customerEligibleLanes.filter((lane) => lane.state === "partial" || lane.state === "error").map((lane) => `${lane.label}:${lane.state}`),
    chartMode: "unavailable",
    providerEvidenceReceipts: providerReceipts,
    observedSourceLabels: customerEligibleLanes.map((lane) => lane.provider),
    generatedAt: args.report.generatedAt,
    coverageInput: coverage({ report: args.report, providerRuntime: args.providerRuntime, strictCount: strictLanes.length, strictUpstreamCount: strictUpstreams.length }),
    missingCriticalEvidence: args.report.summary.blocked + args.report.summary.missing,
    stressTestExecuted: false,
    evidenceLedgerPresent: args.evidenceLedgerVerified,
    executedTests: [
      strictLanes.length > 0 ? "source_binding" : "",
      strictUpstreams.length >= 2 ? "source_quorum" : "",
      args.evidenceLedgerVerified ? "evidence_ledger" : "",
      manualReviewVerified ? "internal_quality_control" : "",
    ].filter(Boolean),
    unexecutedTests: [
      strictUpstreams.length < 2 ? "source_quorum" : "",
      !args.evidenceLedgerVerified ? "evidence_ledger" : "",
      args.requestedTier === "advanced" ? "advanced_not_for_sale" : "",
    ].filter(Boolean),
    providerTimestamps: strictLanes.map((lane) => lane.receipt?.observedAt ?? args.report.generatedAt),
    chainId: args.providerRuntime.target.chainId,
    contractAddress: args.providerRuntime.target.contractAddress ?? args.report.target.contractAddress ?? null,
    dataWindow: "audit provider receipts and source freshness window",
    decisionSections,
    runtimeCanonicalValues: {
      "audit.provider_rights_currentness": {
        value: selectedRights,
        confidence: selectedRights.commercialUseReady ? 100 : 0,
      },
      "audit.permission_summary": {
        value: (() => {
          const section = args.report.sections.find((item) => item.id === "permission-parser");
          return section ? {
            state: section.state,
            evidenceCount: section.evidenceCount,
            missingCount: section.missingCount,
            sourceFamilies: section.sourceFamilies,
            limitation: "customer_safe_section_projection",
          } : { state: "unavailable", limitation: "permission_section_not_generated" };
        })(),
        confidence: args.report.finalVerdict.sourceConfidence,
      },
      "audit.liquidity_evidence": {
        value: (() => {
          const section = args.report.sections.find((item) => item.id === "liquidity-holder-lock-risk");
          return section ? {
            state: section.state,
            evidenceCount: section.evidenceCount,
            missingCount: section.missingCount,
            sourceFamilies: section.sourceFamilies,
            limitation: "section_level_evidence_not_execution_liquidity",
          } : { state: "unavailable", limitation: "liquidity_section_not_generated" };
        })(),
        confidence: args.report.finalVerdict.sourceConfidence,
      },
      "audit.holder_evidence": {
        value: (() => {
          const section = args.report.sections.find((item) => item.id === "liquidity-holder-lock-risk");
          return section ? {
            state: section.state,
            evidenceCount: section.evidenceCount,
            missingCount: section.missingCount,
            sourceFamilies: section.sourceFamilies,
            limitation: "holder_identity_and_cex_exclusions_remain_source_bounded",
          } : { state: "unavailable", limitation: "holder_section_not_generated" };
        })(),
        confidence: args.report.finalVerdict.sourceConfidence,
      },
      "evidence.claim_ledger": {
        value: args.evidenceLedgerVerified ? {
          state: "verified",
          claims: decisionSections.map((section) => ({
            id: section.id,
            state: section.state,
            evidenceCount: section.evidence.length,
          })),
          unresolved: missingEvidence,
        } : { state: "unavailable", limitation: "canonical_evidence_ledger_not_verified" },
        confidence: args.evidenceLedgerVerified ? args.report.finalVerdict.sourceConfidence : 0,
      },
      "audit.quality_control_state": manualReviewVerified ? {
        value: "internal_receipt_verified",
        // The receipt is a persisted internal QA snapshot, not a human-review field mode.
        mode: "durable_snapshot",
        evidenceRefs: manualReviewReceiptId ? [manualReviewReceiptId] : [],
        limitation: "does_not_unlock_advanced_or_create_a_human_review_claim",
        confidence: 100,
      } : {
        value: "not_verified",
        mode: "explicit_missing",
        limitation: "advanced_remains_not_for_sale",
        confidence: 0,
      },
      "audit.monitoring_state": {
        value: monitoringConfigured ? "configured" : "not_configured",
        confidence: monitoringConfigured ? 100 : 0,
      },
      "audit.revalidation_plan": {
        value: args.report.advancedQueue.length > 0
          ? args.report.advancedQueue
          : ["revalidate_after_material_change"],
        confidence: args.report.finalVerdict.sourceConfidence,
      },
      "audit.finding_evidence_graph": {
        value: {
          state: args.evidenceLedgerVerified ? "verified" : "unverified",
          findings: args.report.topFindings.map((finding) => ({
            id: finding.id,
            severity: finding.severity,
            sourceFamily: finding.sourceFamily,
          })),
          strictUpstreamRoots: strictUpstreams,
        },
        confidence: args.evidenceLedgerVerified ? args.report.finalVerdict.sourceConfidence : 0,
      },
      "audit.false_positive_quality_control": {
        value: manualReviewVerified ? {
          state: "internal_quality_control_recorded",
          receiptId: manualReviewReceiptId,
          limitation: "not_independent_adjudication_and_not_included_human_review",
        } : {
          state: "unavailable",
          limitation: "independent_quality_review_not_performed",
        },
        confidence: manualReviewVerified ? 100 : 0,
      },
    },
    ...accessBindings,
  });
  const layout = buildCustomerReportLayoutModel(payload);
  // The commercial renderer is the final authority for what can actually be
  // shown or exported. Keep the API projection on that same tier; readiness
  // alone must never expose a paid projection while the PDF policy is locked.
  const deliveredTier: AuditTierId = payload.deliveryPolicy.visibleTier === "Advanced"
    ? "advanced"
    : payload.deliveryPolicy.visibleTier === "Pro"
      ? "pro"
      : "basic";
  const deliveryUnavailable = payload.deliveryPolicy.visibleTier === null;
  if (deliveryUnavailable) {
    return buildBlockedPipelineResult({
      report: args.report,
      requestedTier: args.requestedTier,
      readiness: publicReadiness,
      selectedAvailability: selectedPublicAvailability,
    });
  }
  const projection = projectAuditReportForCustomer({
    report: args.report,
    requestedTier: args.requestedTier,
    deliveredTier,
    manualReviewVerified: false,
  });
  const readiness = {
    basic: {
      schemaVersion: PASS4820_AUDIT_CUSTOMER_REPORT_PIPELINE_ID,
      tier: "basic" as const,
      technicalMet: readinessInternal.basic.technicalMet,
      commercialMet: readinessInternal.basic.commercialMet,
      technical: {
        strictReceipts: readinessInternal.basic.strictConfirmedLanes,
        successfulLiveExecutions: readinessInternal.basic.successfulLiveProviderLanes,
        independentProviderFamilies: readinessInternal.basic.independentProviderFamilies,
        independentUpstreamRoots: readinessInternal.basic.independentUpstreamRoots,
        evidenceRows: readinessInternal.basic.evidenceRows,
      },
      requirements: readinessInternal.basic.minimum,
      technicalBlockers: readinessInternal.basic.technicalBlockers,
      providerRightsCurrentness: rightsSummary.basic,
    },
    pro: {
      schemaVersion: PASS4820_AUDIT_CUSTOMER_REPORT_PIPELINE_ID,
      tier: "pro" as const,
      technicalMet: readinessInternal.pro.technicalMet,
      commercialMet: readinessInternal.pro.commercialMet,
      technical: {
        strictReceipts: readinessInternal.pro.strictConfirmedLanes,
        successfulLiveExecutions: readinessInternal.pro.successfulLiveProviderLanes,
        independentProviderFamilies: readinessInternal.pro.independentProviderFamilies,
        independentUpstreamRoots: readinessInternal.pro.independentUpstreamRoots,
        evidenceRows: readinessInternal.pro.evidenceRows,
      },
      requirements: readinessInternal.pro.minimum,
      technicalBlockers: readinessInternal.pro.technicalBlockers,
      providerRightsCurrentness: rightsSummary.pro,
    },
    advanced: {
      schemaVersion: PASS4820_AUDIT_CUSTOMER_REPORT_PIPELINE_ID,
      tier: "advanced" as const,
      technicalMet: readinessInternal.advanced.technicalMet,
      commercialMet: readinessInternal.advanced.commercialMet,
      technical: {
        strictReceipts: readinessInternal.advanced.strictConfirmedLanes,
        successfulLiveExecutions: readinessInternal.advanced.successfulLiveProviderLanes,
        independentProviderFamilies: readinessInternal.advanced.independentProviderFamilies,
        independentUpstreamRoots: readinessInternal.advanced.independentUpstreamRoots,
        evidenceRows: readinessInternal.advanced.evidenceRows,
      },
      requirements: readinessInternal.advanced.minimum,
      technicalBlockers: readinessInternal.advanced.technicalBlockers,
      providerRightsCurrentness: rightsSummary.advanced,
    },
  } as const;
  const unsigned = {
    schemaVersion: PASS4820_AUDIT_CUSTOMER_REPORT_PIPELINE_ID,
    requestedTier: args.requestedTier,
    deliveredTier,
    publicAvailability: selectedPublicAvailability,
    releaseState: args.requestedTier === "advanced" && deliveredTier === "pro"
        ? "advanced_not_for_sale_pro_fallback"
        : deliveredTier === args.requestedTier
          ? "ready"
          : "redacted_to_basic",
    readiness,
    projection,
    customerReport: payload,
    customerReportPreviewLayout: layout,
    sourceTruth: {
      strictLaneCount: strictLanes.length,
      strictUpstreamRoots: strictUpstreams,
      providerReceiptCount: providerReceipts.length,
      adjudicatedAuthorityReceiptCount: authorityEvidence?.state === "confirmed" ? authorityEvidence.receipts.length : 0,
      adjudicatedAuthorityEvidenceDigest: authorityEvidence?.evidenceDigest ?? null,
      contentBoundProviderReceiptCount: providerReceipts.filter((receipt) => (
        isPass4644CommerciallyFreshReceipt(receipt, Date.parse(args.report.generatedAt))
      )).length,
      providerRightsCurrentnessDigest: selectedRights.summaryDigest,
      providerRightsRegistryDigest: selectedRights.registryDigest,
      providerRightsCommercialUseReady: selectedRights.commercialUseReady,
      rightsCurrentProviderCount: selectedRights.rightsCurrentProviders,
      rightsCurrentFieldCount: selectedRights.rightsCurrentFields,
      blockedFieldCount: selectedRights.blockedFields,
    },
    rule: "Audit Basic/Pro/Advanced, customer preview and PDF consume the same evidence-bound report contract and the same current field-level rights decision. Technical provider success cannot authorize customer display, paid delivery, PDF export or retention; Basic and paid artifacts fail closed when rights/currentness is not verified.",
  } as const;
  return { ...unsigned, pipelineDigest: sha256Digest(canonicalJson(unsigned)) };
}
