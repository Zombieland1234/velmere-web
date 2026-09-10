import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { ReportAccessDecision } from "@/lib/market-integrity/top1-entitlement-report-access";
import type { ReportCommercialDecision, ReportCoverageScore } from "@/lib/market-integrity/worldclass-report-commercial-policy";
import type { CustomerReportTierValueGate } from "@/lib/market-integrity/customer-report-tier-value";
import type { AdvancedDeliveryMode } from "@/lib/market-integrity/top1-entitlement-report-access";

export type CustomerReportDeliveryPolicy = {
  schemaVersion: "velmere.customer-report-delivery-policy.v1";
  requestedTier: VelmereTier;
  visibleTier: VelmereTier | null;
  status: "ready_basic" | "ready_paid" | "redacted_to_basic" | "unavailable";
  paidEvidenceAllowed: boolean;
  sourceReceiptLimit: number;
  visiblePageTierCeiling: VelmereTier | null;
  monitoringAllowed: boolean;
  manualReviewAppendixAllowed: boolean;
  blockedReasons: string[];
  customerSafeRule: string;
};

const SOURCE_LIMITS: Record<VelmereTier, number> = {
  Basic: 3,
  Pro: 7,
  Advanced: Number.MAX_SAFE_INTEGER,
};

export function tierRank(tier: VelmereTier): number {
  return tier === "Basic" ? 0 : tier === "Pro" ? 1 : 2;
}

export function isTierVisible(requiredTier: VelmereTier, visibleTier: VelmereTier | null): boolean {
  return visibleTier !== null && tierRank(requiredTier) <= tierRank(visibleTier);
}

export function buildCustomerReportDeliveryPolicy(args: {
  requestedTier: VelmereTier;
  coverage: ReportCoverageScore;
  commercialDecision: ReportCommercialDecision;
  reportAccessDecision: ReportAccessDecision;
  tierValueGate: CustomerReportTierValueGate;
  advancedDeliveryMode?: AdvancedDeliveryMode;
}): CustomerReportDeliveryPolicy {
  const advancedDeliveryMode = args.advancedDeliveryMode ?? "manual_review";
  if (args.requestedTier === "Basic") {
    const available = args.commercialDecision.deliverableTier === "Basic" && args.coverage.overall >= 30 && args.tierValueGate.readiness.Basic;
    return {
      schemaVersion: "velmere.customer-report-delivery-policy.v1",
      requestedTier: args.requestedTier,
      visibleTier: available ? "Basic" : null,
      status: available ? "ready_basic" : "unavailable",
      paidEvidenceAllowed: false,
      sourceReceiptLimit: available ? SOURCE_LIMITS.Basic : 0,
      visiblePageTierCeiling: available ? "Basic" : null,
      monitoringAllowed: false,
      manualReviewAppendixAllowed: false,
      blockedReasons: available ? [] : [...args.commercialDecision.blockedReasons, ...args.tierValueGate.blockers.Basic.map((reason) => `Value: ${reason}`)],
      customerSafeRule: available
        ? "Render public Basic screening only; paid receipt bundles and reviewed appendices remain hidden."
        : "Do not render a risk verdict. Explain that evidence coverage is insufficient.",
    };
  }

  const commercialReady =
    args.commercialDecision.status === "ready" &&
    args.commercialDecision.paidDeliveryAllowed &&
    args.commercialDecision.deliverableTier === args.requestedTier;
  const entitlementReady = args.reportAccessDecision.paidEvidenceAllowed;
  const valueReady = args.tierValueGate.readiness[args.requestedTier];
  const paidEvidenceAllowed = commercialReady && entitlementReady && valueReady;

  if (paidEvidenceAllowed) {
    return {
      schemaVersion: "velmere.customer-report-delivery-policy.v1",
      requestedTier: args.requestedTier,
      visibleTier: args.requestedTier,
      status: "ready_paid",
      paidEvidenceAllowed: true,
      sourceReceiptLimit: SOURCE_LIMITS[args.requestedTier],
      visiblePageTierCeiling: args.requestedTier,
      monitoringAllowed: args.requestedTier === "Advanced",
      manualReviewAppendixAllowed: args.requestedTier === "Advanced" && advancedDeliveryMode === "manual_review",
      blockedReasons: [],
      customerSafeRule: args.requestedTier === "Advanced" && advancedDeliveryMode === "automated"
        ? "Render only the exact requested automated Advanced dossier, bound to verified entitlement, payload hash, automated evidence and value gates. Optional human QA adds no release authority."
        : "Render only the requested paid tier, bound to verified entitlement, payload hash and quality gates.",
    };
  }

  const basicAvailable = args.coverage.overall >= 30 && args.commercialDecision.deliverableTier !== null && args.tierValueGate.readiness.Basic;
  const blockedReasons = [
    ...args.commercialDecision.blockedReasons,
    ...args.reportAccessDecision.blockedReasons.map((reason) => `Entitlement: ${reason}`),
    ...args.tierValueGate.blockers[args.requestedTier].map((reason) => `Value: ${reason}`),
  ];

  return {
    schemaVersion: "velmere.customer-report-delivery-policy.v1",
    requestedTier: args.requestedTier,
    visibleTier: basicAvailable ? "Basic" : null,
    status: basicAvailable ? "redacted_to_basic" : "unavailable",
    paidEvidenceAllowed: false,
    sourceReceiptLimit: basicAvailable ? SOURCE_LIMITS.Basic : 0,
    visiblePageTierCeiling: basicAvailable ? "Basic" : null,
    monitoringAllowed: false,
    manualReviewAppendixAllowed: false,
    blockedReasons,
    customerSafeRule: basicAvailable
      ? "Fail closed to Basic: redact Pro/Advanced receipts, pages, monitoring and reviewed appendices until both commercial and entitlement gates pass."
      : "Do not render the report because neither paid delivery nor a reliable Basic screening is supportable.",
  };
}

// PASS4791_LIVE_EVIDENCE_TIER_POLICY: canonical fail-closed tier value gate.
export {
  assertLiveEvidencePacketIntegrity,
  canonicalLiveEvidenceDigest,
  evaluateLiveEvidenceTierPolicy,
} from "./live-evidence-tier-policy";
export type {
  LiveEvidenceLane,
  LiveEvidencePacket,
  LiveEvidenceProduct,
  LiveEvidenceSourceReceipt,
  LiveEvidenceStatus,
  LiveEvidenceTier,
  LiveEvidenceTierDecision,
} from "./live-evidence-tier-policy";
