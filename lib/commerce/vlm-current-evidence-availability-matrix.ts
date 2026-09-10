import { evaluateVlmCommercialReadiness, type VlmCommercialProductFamily } from "@/lib/commerce/vlm-commercial-readiness";
import {
  buildCurrentP36CommercialEvidence,
  currentP36CommercialEvidenceSnapshot,
} from "@/lib/commerce/vlm-current-commercial-evidence";
import {
  buildCurrentVlmTierEligibility,
  buildPublicVlmTierEligibility,
  selectHighestEligibleTier,
  type PublicVlmTierEligibility,
  type VlmEligibilityProduct,
  type VlmTierEligibilityReceipt,
} from "@/lib/commerce/vlm-evidence-availability";
import type { VlmCurrentSkuLocale, VlmCurrentSkuTier } from "@/lib/commerce/vlm-current-sku-truth";
import {
  VLM_CANONICAL_CUSTOMER_PRODUCTS,
  VLM_CONTEXT_TRANSITIONS,
  VLM_INTERNAL_EXECUTION_PROFILES,
  VLM_V16_TOPOLOGY_DENOMINATORS,
  type VlmCanonicalProductFamily,
  type VlmInternalExecutionContext,
} from "@/lib/product/vlm-canonical-product-topology";

export const VLM_CURRENT_EVIDENCE_AVAILABILITY_MATRIX_SCHEMA = "velmere.current-evidence-availability-matrix.p66.v1" as const;

type ProductDefinition = Readonly<{
  product: VlmEligibilityProduct;
  policyAdapterFamily: VlmCommercialProductFamily;
  canonicalFamily: VlmCanonicalProductFamily;
  standaloneProduct: boolean;
}>;

const TIERED_PRODUCTS: readonly ProductDefinition[] = [
  { product: "audit", policyAdapterFamily: "audit", canonicalFamily: "audit", standaloneProduct: false },
  { product: "browser", policyAdapterFamily: "browser", canonicalFamily: "browser", standaloneProduct: false },
  { product: "shield", policyAdapterFamily: "shield", canonicalFamily: "shield", standaloneProduct: false },
  { product: "shield-pro", policyAdapterFamily: "shield-pro", canonicalFamily: "shield-pro", standaloneProduct: false },
  { product: "real-markets", policyAdapterFamily: "real-markets", canonicalFamily: "real-markets", standaloneProduct: false },
] as const;

const STANDALONE_PRODUCTS: readonly ProductDefinition[] = [
  { product: "shield-map", policyAdapterFamily: "shield-map", canonicalFamily: "shield-map", standaloneProduct: true },
  { product: "market-impact", policyAdapterFamily: "market-impact", canonicalFamily: "market-impact", standaloneProduct: true },
  { product: "whale-watch", policyAdapterFamily: "whale-watch", canonicalFamily: "whale-watch", standaloneProduct: true },
  { product: "angel", policyAdapterFamily: "angel", canonicalFamily: "angel", standaloneProduct: true },
  { product: "risk", policyAdapterFamily: "risk", canonicalFamily: "risk-indicator", standaloneProduct: true },
] as const;

const PRODUCTS = [...TIERED_PRODUCTS, ...STANDALONE_PRODUCTS] as const;

const TIER_CONTEXTS: readonly {
  context: Extract<VlmInternalExecutionContext, "BASIC_CONTEXT" | "PRO_CONTEXT" | "ADVANCED_CONTEXT">;
  tier: VlmCurrentSkuTier;
}[] = [
  { context: "BASIC_CONTEXT", tier: "basic" },
  { context: "PRO_CONTEXT", tier: "pro" },
  { context: "ADVANCED_CONTEXT", tier: "advanced" },
] as const;

export type CurrentEvidenceAvailabilityProfile = Readonly<{
  profileId: string;
  product: VlmEligibilityProduct;
  policyAdapterFamily: VlmCommercialProductFamily;
  canonicalFamily: VlmCanonicalProductFamily;
  context: VlmInternalExecutionContext;
  customerTier: VlmCurrentSkuTier | null;
  policyAdapterTier: VlmCurrentSkuTier;
  customerFacingSku: boolean;
  customerFacingRowId: string | null;
  standaloneProduct: boolean;
  deltaRequiredByCatalog: boolean;
  truthInvariantAcrossContexts: true;
  safetyInvariantAcrossContexts: true;
  expectedDeltaDimensions: readonly string[];
  saleEligibilityApplies: boolean;
  valueApplicability:
    | "INDEPENDENTLY_USEFUL_BASELINE"
    | "DELTA_REQUIRED_BY_CATALOG"
    | "STANDALONE_PRODUCT_BASELINE";
  receipt: VlmTierEligibilityReceipt;
  publicProjection: PublicVlmTierEligibility;
}>;

export type CurrentCustomerFacingAvailabilityRow = Readonly<{
  rowId: string;
  canonicalFamily: VlmCanonicalProductFamily;
  customerTier: VlmCurrentSkuTier | null;
  customerFacingType: "EXPLICITLY_TIERED_PRODUCT_FAMILY" | "STANDALONE_PRODUCT_FAMILY";
  evaluationContext: VlmInternalExecutionContext;
  evaluationProfileId: string;
  saleEligibilityApplies: true;
  receipt: VlmTierEligibilityReceipt;
  publicProjection: PublicVlmTierEligibility;
}>;

function canonicalTierRowId(canonicalFamily: VlmCanonicalProductFamily, tier: VlmCurrentSkuTier) {
  return VLM_CANONICAL_CUSTOMER_PRODUCTS.find(
    (row) => row.family === canonicalFamily && row.tier === tier,
  )?.productId ?? null;
}

function valueApplicability(standaloneProduct: boolean, context: VlmInternalExecutionContext) {
  if (standaloneProduct) return "STANDALONE_PRODUCT_BASELINE" as const;
  if (context === "BASIC_CONTEXT") return "INDEPENDENTLY_USEFUL_BASELINE" as const;
  return "DELTA_REQUIRED_BY_CATALOG" as const;
}

function evaluateProfile(args: {
  definition: ProductDefinition;
  context: VlmInternalExecutionContext;
  customerTier: VlmCurrentSkuTier | null;
  policyAdapterTier: VlmCurrentSkuTier;
  locale: VlmCurrentSkuLocale;
  evaluatedAt: string;
}): CurrentEvidenceAvailabilityProfile {
  const { definition, context, customerTier, policyAdapterTier, locale, evaluatedAt } = args;
  const topologyProfile = VLM_INTERNAL_EXECUTION_PROFILES.find(
    (profile) => profile.family === definition.canonicalFamily && profile.context === context,
  );
  if (!topologyProfile) {
    throw new Error(`missing_p66_topology_profile:${definition.canonicalFamily}:${context}`);
  }
  const commercial = evaluateVlmCommercialReadiness({
    family: definition.policyAdapterFamily,
    tier: policyAdapterTier,
    locale,
    evidence: buildCurrentP36CommercialEvidence(definition.policyAdapterFamily),
  });
  const profileId = `${definition.canonicalFamily}@${context}`;
  const receipt = buildCurrentVlmTierEligibility({
    commercial,
    product: definition.product,
    subjectId: `current-execution-profile:${profileId}`,
    evaluatedAt,
  });
  const customerFacingRowId = definition.standaloneProduct
    ? VLM_CANONICAL_CUSTOMER_PRODUCTS.find((row) => row.family === definition.canonicalFamily && row.tier === null)?.productId ?? null
    : customerTier
      ? canonicalTierRowId(definition.canonicalFamily, customerTier)
      : null;
  return {
    profileId,
    product: definition.product,
    policyAdapterFamily: definition.policyAdapterFamily,
    canonicalFamily: definition.canonicalFamily,
    context,
    customerTier,
    policyAdapterTier,
    customerFacingSku: true,
    customerFacingRowId,
    standaloneProduct: definition.standaloneProduct,
    deltaRequiredByCatalog: !definition.standaloneProduct && context !== "BASIC_CONTEXT",
    truthInvariantAcrossContexts: true,
    safetyInvariantAcrossContexts: true,
    expectedDeltaDimensions: topologyProfile.expectedDeltaDimensions,
    saleEligibilityApplies: true,
    valueApplicability: valueApplicability(definition.standaloneProduct, context),
    receipt,
    publicProjection: buildPublicVlmTierEligibility(receipt, locale),
  };
}

export function buildCurrentEvidenceAvailabilityMatrix(args: {
  locale?: VlmCurrentSkuLocale;
  evaluatedAt?: string;
} = {}) {
  const locale = args.locale ?? "en";
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();

  const tierProfiles = TIERED_PRODUCTS.flatMap((definition) =>
    TIER_CONTEXTS.map(({ context, tier }) => evaluateProfile({
      definition,
      context,
      customerTier: tier,
      policyAdapterTier: tier,
      locale,
      evaluatedAt,
    })),
  );
  const standaloneProfiles = STANDALONE_PRODUCTS.map((definition) => evaluateProfile({
    definition,
    context: "STANDALONE_CONTEXT",
    customerTier: null,
    // The existing eligibility engine requires a tier-shaped policy input. "basic" is used only as
    // an internal conservative baseline policy adapter; it is not exposed as a standalone customer tier/SKU.
    policyAdapterTier: "basic",
    locale,
    evaluatedAt,
  }));
  const profiles: CurrentEvidenceAvailabilityProfile[] = [...tierProfiles, ...standaloneProfiles];

  const profilesById = new Map(profiles.map((profile) => [profile.profileId, profile]));
  const customerFacingRows: CurrentCustomerFacingAvailabilityRow[] = VLM_CANONICAL_CUSTOMER_PRODUCTS.map((row) => {
    const context: VlmInternalExecutionContext = row.tier === "pro"
      ? "PRO_CONTEXT"
      : row.tier === "advanced"
        ? "ADVANCED_CONTEXT"
        : row.tier === "basic"
          ? "BASIC_CONTEXT"
          : "STANDALONE_CONTEXT";
    const profileId = `${row.family}@${context}`;
    const profile = profilesById.get(profileId);
    if (!profile) throw new Error(`missing_customer_facing_evaluation_profile:${row.productId}:${profileId}`);
    return {
      rowId: row.productId,
      canonicalFamily: row.family,
      customerTier: row.tier,
      customerFacingType: row.productClass === "TIERED_PRODUCT"
        ? "EXPLICITLY_TIERED_PRODUCT_FAMILY"
        : "STANDALONE_PRODUCT_FAMILY",
      evaluationContext: context,
      evaluationProfileId: profileId,
      saleEligibilityApplies: true,
      receipt: profile.receipt,
      publicProjection: profile.publicProjection,
    };
  });

  const deltaRequiredTransitions = VLM_CONTEXT_TRANSITIONS.filter((transition) => transition.deltaRequiredByCatalog);

  return {
    schemaVersion: VLM_CURRENT_EVIDENCE_AVAILABILITY_MATRIX_SCHEMA,
    evaluatedAt,
    locale,
    topology: {
      customerFacingRows: VLM_V16_TOPOLOGY_DENOMINATORS.customerFacingRows,
      productFamilies: VLM_V16_TOPOLOGY_DENOMINATORS.productFamilies,
      internalExecutionProfiles: VLM_V16_TOPOLOGY_DENOMINATORS.internalExecutionProfiles,
      tieredExecutionProfiles: VLM_V16_TOPOLOGY_DENOMINATORS.tieredExecutionProfiles,
      standaloneExecutionProfiles: VLM_V16_TOPOLOGY_DENOMINATORS.standaloneExecutionProfiles,
      contextTransitions: VLM_V16_TOPOLOGY_DENOMINATORS.contextTransitions,
      deltaRequiredTransitions: VLM_V16_TOPOLOGY_DENOMINATORS.deltaRequiredTransitions,
      legacy33ProductCompletionDenominatorRetired: VLM_V16_TOPOLOGY_DENOMINATORS.legacy33ProductCompletionDenominatorRetired,
      pdfSeparateProductFamily: VLM_V16_TOPOLOGY_DENOMINATORS.pdfSeparateProductFamily,
    },
    denominator: profiles.length,
    products: PRODUCTS.length,
    tieredProducts: TIERED_PRODUCTS.length,
    standaloneProducts: STANDALONE_PRODUCTS.length,
    executionCoverageDenominator: profiles.length,
    customerFacingSaleEligibilityDenominator: customerFacingRows.length,
    deltaTransitionDenominator: VLM_CONTEXT_TRANSITIONS.length,
    evidenceAuthority: currentP36CommercialEvidenceSnapshot(),
    profiles,
    customerFacingRows,
    transitions: VLM_CONTEXT_TRANSITIONS,
    productSummaries: PRODUCTS.map(({ product, canonicalFamily, standaloneProduct }) => {
      const receipts = profiles.filter((profile) => profile.product === product).map((profile) => profile.receipt);
      return {
        product,
        canonicalFamily,
        standaloneProduct,
        customerTierModel: standaloneProduct ? "NO_CUSTOMER_TIERS" as const : "BASIC_PRO_ADVANCED" as const,
        highestAnalysisEligiblePolicyAdapter: selectHighestEligibleTier(receipts),
        saleEligiblePolicyAdapters: receipts.filter((receipt) => receipt.saleEligible).map((receipt) => receipt.tier),
        historicalEligiblePolicyAdapters: receipts.filter((receipt) => receipt.historicalEligible).map((receipt) => receipt.tier),
      };
    }),
    saleEligibleCustomerFacingRowCount: customerFacingRows.filter((row) => row.receipt.saleEligible).length,
    analysisEligibleCustomerFacingRowCount: customerFacingRows.filter((row) => row.receipt.analysisEligible).length,
    saleEligibleInternalProfileCount: profiles.filter((profile) => profile.receipt.saleEligible).length,
    analysisEligibleInternalProfileCount: profiles.filter((profile) => profile.receipt.analysisEligible).length,
    saleEligibleProfileCount: profiles.filter((profile) => profile.receipt.saleEligible).length,
    analysisEligibleProfileCount: profiles.filter((profile) => profile.receipt.analysisEligible).length,
    deltaRequiredTransitionCount: deltaRequiredTransitions.length,
    notApplicableNoPaidDeltaClaimTransitionCount: 0,
    truthBoundary: "P66 owner-corrected topology contains 20 real customer-facing rows across 10 product families: five real Basic/Pro/Advanced families and five standalone no-tier products. PDF is an artifact, not a product family. The historical 33-context model is retired as a product-completion denominator. Standalone products use one STANDALONE_CONTEXT; the internal eligibility engine may reuse its conservative basic policy adapter without creating a Basic customer SKU. This matrix grants no provider-rights, final customer, paid-value, sale, LIVE or WORLD_CLASS credit.",
  } as const;
}
