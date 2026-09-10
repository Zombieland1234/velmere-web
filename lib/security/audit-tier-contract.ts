import type { AuditReviewLevel } from "./audit-review-flow";
import { getVlmCurrentSkuTruth } from "@/lib/commerce/vlm-current-sku-truth";

/** Frozen historical contract retained for PASS4796 replay. */
export const PASS4796_AUDIT_TIER_CONTRACT_ID = "pass4796-audit-tier-truth-v1" as const;
/** Current customer-facing automated informational contract. */
export const PASS36_A102R44P2_AUDIT_TIER_CONTRACT_ID = "pass36-a102r44p2-automated-informational-audit-tier-truth-v1" as const;

export type AuditTierId = "basic" | "pro" | "advanced";
export type AuditTierReleaseState = "ready" | "blocked" | "payment_required" | "manual_review_required";
export type AuditTierPackageId = "basic_audit" | "pro_audit" | "advanced_audit" | "advanced_human_review";
export type AuditTierCommercialMode =
  | "free_automated_informational_prescreen"
  | "paid_automated_informational_analysis"
  | "paid_human_reviewed_service";

export type AuditTierContract = {
  id: AuditTierId;
  reviewLevel: Extract<AuditReviewLevel, "basic_review" | "pro_review" | "advanced_review">;
  packageId: AuditTierPackageId;
  productId: null | "vlm_pro_audit_review" | "vlm_advanced_audit_human_review";
  price: { currency: "EUR"; amountCents: number; label: string } | null;
  customerDecision?: "PILOT_ONLY_FREE_LIMITED_PRESCREEN" | "INVITATION_ONLY_CONTROLLED_BETA" | "NOT_FOR_SALE";
  publicCheckoutAllowed?: boolean;
  entitlementRequired: boolean;
  humanReviewRequired: boolean;
  humanReviewClaimAllowed: boolean;
  commercialMode: AuditTierCommercialMode;
  billingIdentifierClass: "none" | "current" | "legacy_compatibility_only";
  deliveryVisibility: "public_summary" | "account_private" | "private_human_review";
  minimumEvidence: {
    verifiedProviderReceipts: number;
    independentProviderFamilies: number;
    liveLanes: number;
    evidenceRows: number;
  };
  includes: string[];
  excludes: string[];
};

/**
 * Frozen PASS4796 plane. Do not use this object for current customer copy.
 * It remains exported because historical replay tests bind its exact human-review semantics.
 */
export const AUDIT_TIER_CONTRACTS: Record<AuditTierId, AuditTierContract> = {
  basic: {
    id: "basic",
    reviewLevel: "basic_review",
    packageId: "basic_audit",
    productId: null,
    price: { currency: "EUR", amountCents: 0, label: "Free" },
    entitlementRequired: false,
    humanReviewRequired: false,
    humanReviewClaimAllowed: false,
    commercialMode: "free_automated_informational_prescreen",
    billingIdentifierClass: "none",
    deliveryVisibility: "public_summary",
    minimumEvidence: { verifiedProviderReceipts: 1, independentProviderFamilies: 1, liveLanes: 2, evidenceRows: 2 },
    includes: [
      "contract identity and chain context",
      "public audit-claim verification",
      "severity and confidence boundary",
      "visible missing-evidence list",
      "compact account delivery",
    ],
    excludes: ["full permission map", "holder and liquidity depth", "provider-conflict arbitration", "manual analyst sign-off"],
  },
  pro: {
    id: "pro",
    reviewLevel: "pro_review",
    packageId: "pro_audit",
    productId: "vlm_pro_audit_review",
    price: { currency: "EUR", amountCents: 7_999, label: "€79.99" },
    entitlementRequired: true,
    humanReviewRequired: false,
    humanReviewClaimAllowed: false,
    commercialMode: "paid_automated_informational_analysis",
    billingIdentifierClass: "current",
    deliveryVisibility: "account_private",
    minimumEvidence: { verifiedProviderReceipts: 4, independentProviderFamilies: 3, liveLanes: 5, evidenceRows: 6 },
    includes: [
      "everything in Basic",
      "source and ABI extraction",
      "permission and control map",
      "holder, liquidity and lock evidence",
      "freshness and provider-conflict analysis",
      "extended evidence-bound PDF",
    ],
    excludes: ["manual analyst verification", "operator final sign-off", "private disclosure decision"],
  },
  advanced: {
    id: "advanced",
    reviewLevel: "advanced_review",
    packageId: "advanced_human_review",
    productId: "vlm_advanced_audit_human_review",
    price: { currency: "EUR", amountCents: 14_999, label: "€149.99" },
    entitlementRequired: true,
    humanReviewRequired: true,
    humanReviewClaimAllowed: true,
    commercialMode: "paid_human_reviewed_service",
    billingIdentifierClass: "current",
    deliveryVisibility: "private_human_review",
    minimumEvidence: { verifiedProviderReceipts: 5, independentProviderFamilies: 4, liveLanes: 6, evidenceRows: 10 },
    includes: [
      "everything in Pro",
      "durable provider receipts",
      "single-provider-family outage resilience",
      "manual analyst review",
      "conflict arbitration and private findings",
      "operator final sign-off and signed delivery",
    ],
    excludes: ["unauthorized active testing", "guaranteed-safe or certified-safe claim"],
  },
};

/**
 * Current product truth. Advanced is an extended automated informational analysis.
 * The legacy billing product id is retained only as a compatibility identifier while
 * checkout remains stop-sold; it must never be presented as proof of manual QA.
 */
export const CURRENT_AUDIT_TIER_CONTRACTS: Record<AuditTierId, AuditTierContract> = {
  basic: {
    ...AUDIT_TIER_CONTRACTS.basic,
    price: null,
    customerDecision: getVlmCurrentSkuTruth("basic", "en").decision,
    publicCheckoutAllowed: false,
    includes: [
      "contract identity and chain context",
      "bounded automated risk prescreen",
      "severity and confidence boundary",
      "visible missing-evidence list",
      "customer-safe informational summary",
    ],
    excludes: [
      "full permission and liquidity depth",
      "independent certification",
      "human analyst review",
      "personalised investment advice",
    ],
  },
  pro: {
    ...AUDIT_TIER_CONTRACTS.pro,
    price: null,
    billingIdentifierClass: "legacy_compatibility_only",
    customerDecision: getVlmCurrentSkuTruth("pro", "en").decision,
    publicCheckoutAllowed: false,
    includes: [
      "everything in Basic",
      "source and ABI evidence map",
      "permission and control analysis",
      "holder, liquidity and lock evidence",
      "freshness and provider-conflict register",
      "extended evidence-bound PDF with document integrity reference",
    ],
    excludes: [
      "human analyst review",
      "independent certification",
      "guaranteed-safe claim",
      "personalised investment advice",
    ],
  },
  advanced: {
    id: "advanced",
    reviewLevel: "advanced_review",
    packageId: "advanced_audit",
    // LEGACY BILLING ALIAS ONLY: current paid checkout remains fail-closed.
    // This identifier cannot create a human-review requirement, claim or release gate.
    productId: "vlm_advanced_audit_human_review",
    price: null,
    entitlementRequired: true,
    customerDecision: getVlmCurrentSkuTruth("advanced", "en").decision,
    publicCheckoutAllowed: false,
    humanReviewRequired: false,
    humanReviewClaimAllowed: false,
    commercialMode: "paid_automated_informational_analysis",
    billingIdentifierClass: "legacy_compatibility_only",
    deliveryVisibility: "account_private",
    minimumEvidence: { verifiedProviderReceipts: 5, independentProviderFamilies: 4, liveLanes: 6, evidenceRows: 10 },
    includes: [
      "everything in Pro",
      "eight-family evidence profile: four official families, three deterministic derived families and local deployed-bytecode reproduction",
      "cross-tool consensus and single-tool disagreement register",
      "compiler artifact diff for ABI/function and bytecode profiles",
      "raw tool-output risk-to-control delta across paired benchmarks (not remediation effectiveness)",
      "complete neutral-source blind-review bundle readiness without a human-review claim",
      "prioritised remediation and retest map",
      "local source-to-deployed-bytecode reproduction evidence without external-deployment credit",
      "Velmère Security issuer and document-integrity seal",
    ],
    excludes: [
      "manually QA-checked audit claim",
      "independent certification",
      "qualified electronic seal claim",
      "guaranteed-safe claim",
      "personalised investment advice",
    ],
  },
};

export function auditTierFromReviewLevel(level: AuditReviewLevel | undefined): AuditTierId {
  if (level === "advanced_review") return "advanced";
  if (level === "pro_review") return "pro";
  return "basic";
}

export function auditReviewLevelFromTier(tier: AuditTierId): AuditTierContract["reviewLevel"] {
  return CURRENT_AUDIT_TIER_CONTRACTS[tier].reviewLevel;
}

export function getAuditTierContract(tier: AuditTierId): AuditTierContract {
  return CURRENT_AUDIT_TIER_CONTRACTS[tier];
}

export function getLegacyAuditTierContract(tier: AuditTierId): AuditTierContract {
  return AUDIT_TIER_CONTRACTS[tier];
}

export function buildAuditTierCustomerMatrix(args: {
  requestedTier: AuditTierId;
  paymentVerified: boolean;
  paymentVerifiedForTier?: Partial<Record<AuditTierId, boolean>>;
  preCheckoutReady: Record<AuditTierId, boolean>;
  deliveryReady: Record<AuditTierId, boolean>;
  blockers: Record<AuditTierId, string[]>;
}) {
  const tiers = (Object.keys(CURRENT_AUDIT_TIER_CONTRACTS) as AuditTierId[]).map((tier) => {
    const contract = CURRENT_AUDIT_TIER_CONTRACTS[tier];
    const paymentVerifiedForTier = args.paymentVerifiedForTier?.[tier]
      ?? (tier === args.requestedTier ? args.paymentVerified : false);
    const stopSold = contract.customerDecision === "NOT_FOR_SALE";
    const paymentMissing = contract.entitlementRequired && !paymentVerifiedForTier;
    const manualMissing = contract.humanReviewRequired && args.preCheckoutReady[tier] && !args.deliveryReady[tier];
    const releaseState: AuditTierReleaseState = stopSold
      ? "blocked"
      : paymentMissing
        ? "payment_required"
        : args.deliveryReady[tier]
          ? "ready"
          : manualMissing
            ? "manual_review_required"
            : "blocked";
    const tierBlockers = Array.from(new Set([
      ...args.blockers[tier],
      ...(paymentMissing ? ["verified_payment_required"] : []),
      ...(stopSold ? ["not_for_sale"] : []),
    ]));
    return {
      tier,
      reviewLevel: contract.reviewLevel,
      packageId: contract.packageId,
      productId: contract.productId,
      price: contract.price,
      entitlementRequired: contract.entitlementRequired,
      humanReviewRequired: contract.humanReviewRequired,
      humanReviewClaimAllowed: contract.humanReviewClaimAllowed,
      commercialMode: contract.commercialMode,
      billingIdentifierClass: contract.billingIdentifierClass,
      deliveryVisibility: contract.deliveryVisibility,
      preCheckoutReady: args.preCheckoutReady[tier],
      deliveryReady: args.deliveryReady[tier],
      releaseState,
      blockers: tierBlockers,
      includes: contract.includes,
      excludes: contract.excludes,
    };
  });

  return {
    schemaVersion: PASS36_A102R44P2_AUDIT_TIER_CONTRACT_ID,
    legacyContractVersion: PASS4796_AUDIT_TIER_CONTRACT_ID,
    requestedTier: args.requestedTier,
    tiers,
    scoreInvariant: "Payment and tier depth never change the underlying risk score; they change evidence depth, scenarios and customer-safe delivery only.",
    issuerBoundary: "Automated reports may be issued by Velmère Security, but the issuer mark is not independent certification or a human-review claim.",
    safetyBoundary: "No custody, no private keys, no seed phrase, no unauthorized active testing, no personalised investment advice and no guaranteed-safe claim.",
  } as const;
}
