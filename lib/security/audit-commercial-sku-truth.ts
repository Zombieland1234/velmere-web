import type { AuditTierId } from "./audit-tier-contract";
import { getVlmCurrentSkuTruth } from "@/lib/commerce/vlm-current-sku-truth";

export const PASS36_A102R44P16_AUDIT_COMMERCIAL_SKU_TRUTH_ID = "pass36-a102r44p16-audit-commercial-sku-truth-v2" as const;
// Historical export retained for compatibility. It points at the current contract.
export const PASS36_A102R44P2_AUDIT_COMMERCIAL_SKU_TRUTH_ID = PASS36_A102R44P16_AUDIT_COMMERCIAL_SKU_TRUTH_ID;

export type AuditCommercialDecision =
  | "PILOT_ONLY_FREE_LIMITED_PRESCREEN"
  | "INVITATION_ONLY_CONTROLLED_BETA"
  | "NOT_FOR_SALE"
  | "BLOCKED_HUMAN_REVIEW_CLAIM"
  | "BLOCKED_CERTIFICATION_CLAIM"
  | "BLOCKED_PERSONALISED_ADVICE";

export type AuditCommercialSkuTruth = {
  tier: AuditTierId;
  productClass: "automated_informational_prescreen" | "automated_informational_analysis";
  decision: AuditCommercialDecision;
  publicCheckoutAllowed: false;
  publicPrice: null;
  issuedBy: "Velmère Security";
  generatedBy: "Velmère Security Engine";
  automated: true;
  humanReviewed: false;
  independentlyCertified: false;
  personalisedAdvice: false;
  documentIntegritySeal: true;
  findingConfidence: "NOT_CALIBRATED";
  manualQualityControlRequired: boolean;
  minimumMaterialAdditionsOverPreviousTier: number;
  allowedClaims: string[];
  forbiddenClaims: string[];
};

const COMMON_FORBIDDEN = [
  "do not claim human reviewed",
  "do not claim manually QA-checked as an included customer service",
  "independently certified",
  "guaranteed safe",
  "investment recommendation",
  "public checkout available",
  "public price available",
];

function buildCommercialTruth(tier: AuditTierId): AuditCommercialSkuTruth {
  const current = getVlmCurrentSkuTruth(tier, "en");
  const productClass = tier === "basic"
    ? "automated_informational_prescreen" as const
    : "automated_informational_analysis" as const;
  const minimumMaterialAdditionsOverPreviousTier = tier === "basic" ? 0 : tier === "pro" ? 4 : 5;
  const allowedClaims = tier === "basic"
    ? ["free prescreen queue intake", "case reference and status", "no completed analysis output claimed"]
    : tier === "pro"
      ? ["extended automated informational analysis", "multi-family evidence trace", "invitation-only controlled beta", "document integrity verified by Velmère"]
      : ["internal automated advanced informational analysis", "contradiction and abstention register", "expanded evidence scenarios", "not for sale", "document integrity verified by Velmère"];
  return {
    tier,
    productClass,
    decision: current.decision,
    publicCheckoutAllowed: false,
    publicPrice: null,
    issuedBy: "Velmère Security",
    generatedBy: "Velmère Security Engine",
    automated: true,
    humanReviewed: false,
    independentlyCertified: false,
    personalisedAdvice: false,
    documentIntegritySeal: true,
    findingConfidence: "NOT_CALIBRATED",
    manualQualityControlRequired: current.manualQualityControlRequired,
    minimumMaterialAdditionsOverPreviousTier,
    allowedClaims,
    forbiddenClaims: [...COMMON_FORBIDDEN, ...(tier === "advanced" ? ["qualified electronic seal", "available for sale"] : [])],
  };
}

export const CURRENT_AUDIT_COMMERCIAL_SKU_TRUTH: Record<AuditTierId, AuditCommercialSkuTruth> = {
  basic: buildCommercialTruth("basic"),
  pro: buildCommercialTruth("pro"),
  advanced: buildCommercialTruth("advanced"),
};

export const HUMAN_REVIEWED_AUDIT_LANE_TRUTH = {
  id: "legacy_human_reviewed_audit_lane",
  publicState: "analysis_quality_control_unavailable",
  decision: "NOT_FOR_SALE" as const,
  available: false,
  reason: "No qualified independent reviewer workflow, conflict declaration, capacity proof and final sign-off are bound to any current customer SKU.",
  forbiddenAsAutomatedSkuClaim: true,
  customerVisible: false,
} as const;

export function auditCommercialTruth(tier: AuditTierId): AuditCommercialSkuTruth {
  return CURRENT_AUDIT_COMMERCIAL_SKU_TRUTH[tier];
}

export function auditCommercialCopyIsSafe(value: string): boolean {
  const normalized = String(value).toLowerCase();
  return !/(?:human[- ]reviewed|operator sign[- ]?off|independently certified|certified safe|guaranteed safe|approved investment|investment recommendation|personalised investment advice|personalized investment advice|qualified electronic seal|public checkout|€\s*(?:79|149)[,.]99)/u.test(normalized);
}
