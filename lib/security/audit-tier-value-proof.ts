import { summarizePass4644ProviderReceipts, type Pass4644ProviderEvidenceReceipt } from "../market-integrity/provider-evidence-receipt";
import type { Pass4645ProviderEvidenceLedger } from "../market-integrity/provider-evidence-ledger";
import { buildPass4650ProviderQualitySnapshot, buildPass4650ReplayManifest, verifyPass4650ReplayManifest } from "../market-integrity/provider-quality-replay";
import type { Pass4656AuditBenchmarkReleaseProof } from "./audit-benchmark-attestation";
import { getAuditTierContract, PASS4796_AUDIT_TIER_CONTRACT_ID } from "./audit-tier-contract";
import type { CommercialCohortGate } from "../worldclass/commercial-cohort-policy";
import type { evaluateAuditPaidEvidenceReadiness } from "./audit-paid-evidence-readiness";

type AuditPaidEvidenceReadinessResult = ReturnType<typeof evaluateAuditPaidEvidenceReadiness>;

export type Pass4643AuditTier = "basic" | "pro" | "advanced";
export type Pass4643AuditLane = {
  id: string;
  state: string;
  tier: string[];
  evidence?: string[];
  missing?: string[];
};

export type Pass4643AuditTierValueInput = {
  lanes?: Pass4643AuditLane[] | null;
  providerConfirmed?: number | null;
  providerPartial?: number | null;
  sourceAbiReady?: boolean | null;
  permissionParserReady?: boolean | null;
  liquidityHolderRiskReady?: boolean | null;
  pdfParityReady?: boolean | null;
  durableReceiptReady?: boolean | null;
  verifiedPaymentReceipt?: boolean | null;
  automatedFinalDeliveryReady?: boolean | null;
  /** Legacy compatibility signal only; never participates in current delivery eligibility. */
  operatorFinalSignReady?: boolean | null;
  conflictFree?: boolean | null;
  providerEvidenceReceipts?: Pass4644ProviderEvidenceReceipt[] | null;
  providerEvidenceLedger?: Pass4645ProviderEvidenceLedger | null;
  requestedIdentity?: string | null;
  auditBenchmarkProof?: Pass4656AuditBenchmarkReleaseProof | null;
  commercialCohortGates?: {
    pro?: CommercialCohortGate | null;
    advanced?: CommercialCohortGate | null;
  } | null;
  paidEvidenceReadiness?: {
    basic?: AuditPaidEvidenceReadinessResult | null;
    pro?: AuditPaidEvidenceReadinessResult | null;
    advanced?: AuditPaidEvidenceReadinessResult | null;
  } | null;
};

function laneLive(lane: Pass4643AuditLane) {
  return lane.state === "confirmed" || lane.state === "partial";
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function compactBlockers(values: Array<string | null | undefined>) {
  return unique(values.filter((value): value is string => Boolean(value)));
}

export function buildPass4643AuditTierValueProof(input: Pass4643AuditTierValueInput) {
  const lanes = input.lanes ?? [];
  const receiptProof = summarizePass4644ProviderReceipts(input.providerEvidenceReceipts);
  const providerQuality = buildPass4650ProviderQualitySnapshot({
    receipts: input.providerEvidenceReceipts,
    requestedIdentity: input.requestedIdentity ?? input.providerEvidenceReceipts?.[0]?.identity.requested ?? "unknown",
    assetClass: "crypto",
    evidenceProfile: "contract_audit",
    now: new Date(),
  });
  const replayManifest = buildPass4650ReplayManifest({ quality: providerQuality, ledger: input.providerEvidenceLedger ?? null });
  const replayProof = input.providerEvidenceLedger
    ? verifyPass4650ReplayManifest({
        manifest: replayManifest,
        quality: providerQuality,
        ledger: input.providerEvidenceLedger,
        signingSecret: process.env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET?.trim() || null,
      })
    : null;

  const verifiedReceiptCount = providerQuality.independentReceiptCount;
  const verifiedFamilyCount = providerQuality.independentProviderFamilyCount;
  const confirmed = Math.max(0, Number(input.providerConfirmed ?? lanes.filter((lane) => lane.state === "confirmed").length));
  const partial = Math.max(0, Number(input.providerPartial ?? lanes.filter((lane) => lane.state === "partial").length));
  const live = confirmed + partial;
  const liveByTier = (tier: Pass4643AuditTier) => lanes.filter((lane) => lane.tier.includes(tier) && laneLive(lane));
  const evidenceRows = (tier: Pass4643AuditTier) => unique(liveByTier(tier).flatMap((lane) => lane.evidence ?? []).filter(Boolean));
  const basicEvidence = evidenceRows("basic");
  const proEvidence = evidenceRows("pro");
  const advancedEvidence = evidenceRows("advanced");
  const basicContract = getAuditTierContract("basic");
  const proContract = getAuditTierContract("pro");
  const advancedContract = getAuditTierContract("advanced");
  const auditBenchmarkProof = input.auditBenchmarkProof ?? null;
  const auditBenchmarkReady = auditBenchmarkProof?.verified === true;
  const proCommercialCohortGate = input.commercialCohortGates?.pro ?? null;
  const advancedCommercialCohortGate = input.commercialCohortGates?.advanced ?? null;
  const basicPaidEvidenceReadiness = input.paidEvidenceReadiness?.basic ?? null;
  const proPaidEvidenceReadiness = input.paidEvidenceReadiness?.pro ?? null;
  const advancedPaidEvidenceReadiness = input.paidEvidenceReadiness?.advanced ?? null;
  const canonicalReadinessBlockers = (tier: Pass4643AuditTier, readiness: AuditPaidEvidenceReadinessResult | null) => readiness
    ? readiness.commercialBlockers.map((blocker) => `canonical_${tier}_readiness:${blocker}`)
    : [`canonical_${tier}_readiness:missing`];

  const basicEvidenceBlockers = compactBlockers([
    ...canonicalReadinessBlockers("basic", basicPaidEvidenceReadiness),
    verifiedReceiptCount < basicContract.minimumEvidence.verifiedProviderReceipts
      ? `verified_provider_receipts:${verifiedReceiptCount}/${basicContract.minimumEvidence.verifiedProviderReceipts}`
      : null,
    !providerQuality.commerciallyUsable
      ? `provider_quality:${providerQuality.blockers.join("|") || providerQuality.qualityScore}`
      : null,
    confirmed < 1 ? `confirmed_providers:${confirmed}/1` : null,
    live < basicContract.minimumEvidence.liveLanes
      ? `live_lanes:${live}/${basicContract.minimumEvidence.liveLanes}`
      : null,
    basicEvidence.length < basicContract.minimumEvidence.evidenceRows
      ? `basic_evidence_rows:${basicEvidence.length}/${basicContract.minimumEvidence.evidenceRows}`
      : null,
  ]);

  const proValueDelta = proEvidence.length >= basicEvidence.length + 3 && liveByTier("pro").length > liveByTier("basic").length;
  const proEvidenceBlockers = compactBlockers([
    ...canonicalReadinessBlockers("pro", proPaidEvidenceReadiness),
    verifiedReceiptCount < proContract.minimumEvidence.verifiedProviderReceipts
      ? `verified_provider_receipts:${verifiedReceiptCount}/${proContract.minimumEvidence.verifiedProviderReceipts}`
      : null,
    verifiedFamilyCount < proContract.minimumEvidence.independentProviderFamilies
      ? `verified_provider_families:${verifiedFamilyCount}/${proContract.minimumEvidence.independentProviderFamilies}`
      : null,
    replayProof?.valid === true ? null : "provider_receipt_replay_not_verified",
    confirmed < 4 ? `confirmed_providers:${confirmed}/4` : null,
    live < proContract.minimumEvidence.liveLanes
      ? `live_lanes:${live}/${proContract.minimumEvidence.liveLanes}`
      : null,
    input.sourceAbiReady === true ? null : "source_abi_not_ready",
    input.permissionParserReady === true ? null : "permission_parser_not_ready",
    input.liquidityHolderRiskReady === true ? null : "liquidity_holder_risk_not_ready",
    input.pdfParityReady === true ? null : "pdf_parity_not_ready",
    proEvidence.length < proContract.minimumEvidence.evidenceRows
      ? `pro_evidence_rows:${proEvidence.length}/${proContract.minimumEvidence.evidenceRows}`
      : null,
    proValueDelta ? null : "pro_evidence_delta_not_proven",
    auditBenchmarkReady ? null : `audit_benchmark_not_verified:${auditBenchmarkProof?.blockers.join("|") || "missing"}`,
    proCommercialCohortGate?.ready === true
      ? null
      : `commercial_cohort_pro_not_ready:${proCommercialCohortGate?.blockers.join("|") || "missing"}`,
  ]);
  const proDeliveryBlockers = compactBlockers([
    ...proEvidenceBlockers,
    input.durableReceiptReady === true ? null : "durable_receipt_not_ready",
    input.verifiedPaymentReceipt === true ? null : "verified_payment_receipt_missing",
  ]);

  const advancedValueDelta = advancedEvidence.length >= proEvidence.length + 4 && liveByTier("advanced").length >= liveByTier("pro").length;
  const advancedEvidenceBlockers = compactBlockers([
    ...proEvidenceBlockers,
    ...canonicalReadinessBlockers("advanced", advancedPaidEvidenceReadiness),
    verifiedReceiptCount < advancedContract.minimumEvidence.verifiedProviderReceipts
      ? `verified_provider_receipts:${verifiedReceiptCount}/${advancedContract.minimumEvidence.verifiedProviderReceipts}`
      : null,
    verifiedFamilyCount < advancedContract.minimumEvidence.independentProviderFamilies
      ? `verified_provider_families:${verifiedFamilyCount}/${advancedContract.minimumEvidence.independentProviderFamilies}`
      : null,
    providerQuality.tierResilience.advanced.survivesAnySingleFamilyOutage
      ? null
      : `single_family_outage_not_resilient:${providerQuality.tierResilience.advanced.failingFamilies.join("|")}`,
    confirmed < 5 ? `confirmed_providers:${confirmed}/5` : null,
    live < advancedContract.minimumEvidence.liveLanes
      ? `live_lanes:${live}/${advancedContract.minimumEvidence.liveLanes}`
      : null,
    input.conflictFree === true ? null : "provider_conflicts_unresolved",
    advancedEvidence.length < advancedContract.minimumEvidence.evidenceRows
      ? `advanced_evidence_rows:${advancedEvidence.length}/${advancedContract.minimumEvidence.evidenceRows}`
      : null,
    advancedValueDelta ? null : "advanced_evidence_delta_not_proven",
    auditBenchmarkReady ? null : `audit_benchmark_not_verified:${auditBenchmarkProof?.blockers.join("|") || "missing"}`,
    advancedCommercialCohortGate?.ready === true
      ? null
      : `commercial_cohort_advanced_not_ready:${advancedCommercialCohortGate?.blockers.join("|") || "missing"}`,
  ]);
  const advancedDeliveryBlockers = compactBlockers([
    ...advancedEvidenceBlockers,
    input.durableReceiptReady === true ? null : "durable_receipt_not_ready",
    input.verifiedPaymentReceipt === true ? null : "verified_payment_receipt_missing",
    input.automatedFinalDeliveryReady === true ? null : "automated_final_delivery_not_ready",
  ]);

  return {
    schemaVersion: "pass4796_audit_tier_value_proof_v3",
    tierContractVersion: PASS4796_AUDIT_TIER_CONTRACT_ID,
    providerCoverage: { confirmed, partial, live, totalLanes: lanes.length },
    receiptProof,
    providerQuality,
    replayProof,
    auditBenchmarkProof,
    commercialCohortGates: {
      pro: proCommercialCohortGate,
      advanced: advancedCommercialCohortGate,
    },
    paidEvidenceReadiness: {
      basic: basicPaidEvidenceReadiness,
      pro: proPaidEvidenceReadiness,
      advanced: advancedPaidEvidenceReadiness,
    },
    providerRightsCurrentnessRequiredForCustomerDelivery: true,
    commercialCohortRequiredForPaidTiers: true,
    auditBenchmarkRequiredForPaidTiers: true,
    receiptProofRequired: true,
    evidenceDepth: {
      basic: basicEvidence.length,
      pro: proEvidence.length,
      advanced: advancedEvidence.length,
    },
    liveLaneDepth: {
      basic: liveByTier("basic").length,
      pro: liveByTier("pro").length,
      advanced: liveByTier("advanced").length,
    },
    tiers: {
      basic: {
        preCheckoutReady: basicEvidenceBlockers.length === 0,
        deliveryReady: basicEvidenceBlockers.length === 0,
        sellReady: basicEvidenceBlockers.length === 0,
        valueDeltaProven: true,
        valuePromise: "Free contract prescreen with confirmed identity/source presence and explicit missing-proof warnings.",
        blockers: basicEvidenceBlockers,
        deliveryBlockers: basicEvidenceBlockers,
      },
      pro: {
        preCheckoutReady: proEvidenceBlockers.length === 0,
        deliveryReady: proDeliveryBlockers.length === 0,
        sellReady: proEvidenceBlockers.length === 0,
        valueDeltaProven: proValueDelta,
        valuePromise: "Source/ABI, permission map, liquidity-holder risk and evidence-bound PDF with at least three additional evidence rows over Basic.",
        blockers: proEvidenceBlockers,
        deliveryBlockers: proDeliveryBlockers,
      },
      advanced: {
        preCheckoutReady: advancedEvidenceBlockers.length === 0,
        deliveryReady: advancedDeliveryBlockers.length === 0,
        sellReady: advancedEvidenceBlockers.length === 0,
        valueDeltaProven: advancedValueDelta,
        valuePromise: "Everything in Pro plus durable receipts, conflict arbitration, deterministic customer-safe delivery gates and at least four additional evidence rows over Pro.",
        blockers: advancedEvidenceBlockers,
        deliveryBlockers: advancedDeliveryBlockers,
      },
    },
    paymentDoesNotCreateEvidence: true,
    walletConnectIsNotPaymentProof: true,
    riskScoreInvariantAcrossTiers: true,
    operatorFinalSignIgnoredForEligibility: true,
  } as const;
}
