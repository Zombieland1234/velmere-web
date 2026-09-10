export const PASS36_R44P35_PRODUCT_TOPOLOGY_ID = "pass36-a102r44p35-canonical-product-topology" as const;
export const VELMERE_V16_PRODUCT_TOPOLOGY_ID = "velmere.v16.owner-corrected-product-topology.p66.v1" as const;

export type VlmCanonicalReportTier = "basic" | "pro" | "advanced";
export type VlmInternalExecutionContext = "BASIC_CONTEXT" | "PRO_CONTEXT" | "ADVANCED_CONTEXT" | "STANDALONE_CONTEXT";
export type VlmCanonicalProductClass = "TIERED_PRODUCT" | "STANDALONE_PRODUCT";
export type VlmCanonicalCustomerFacingType = "EXPLICITLY_TIERED_PRODUCT_FAMILY" | "STANDALONE_PRODUCT_FAMILY";
export type VlmCanonicalProductFamily =
  | "audit"
  | "browser"
  | "shield"
  | "shield-pro"
  | "shield-map"
  | "real-markets"
  | "market-impact"
  | "whale-watch"
  | "angel"
  | "risk-indicator";
export type VlmCanonicalProductId =
  | "audit-basic" | "audit-pro" | "audit-advanced"
  | "browser-basic" | "browser-pro" | "browser-advanced"
  | "shield-basic" | "shield-pro" | "shield-advanced"
  | "shield-pro-basic" | "shield-pro-pro" | "shield-pro-advanced"
  | "real-markets-basic" | "real-markets-pro" | "real-markets-advanced"
  | "shield-map" | "market-impact" | "whale-watch" | "angel" | "risk-indicator";

export type VlmCanonicalCustomerProduct = Readonly<{
  productId: VlmCanonicalProductId;
  displayName: string;
  family: VlmCanonicalProductFamily;
  productClass: VlmCanonicalProductClass;
  tier: VlmCanonicalReportTier | null;
  commercialRole: string;
  artifactOutputs?: readonly string[];
}>;

export type VlmCanonicalFamilyDefinition = Readonly<{
  family: VlmCanonicalProductFamily;
  displayName: string;
  customerFacingType: VlmCanonicalCustomerFacingType;
  standaloneProduct: boolean;
  customerFacingProductIds: readonly VlmCanonicalProductId[];
  deltaRequiredByCatalog: boolean;
  truthInvariantAcrossContexts: true;
  safetyInvariantAcrossContexts: true;
}>;

export type VlmInternalExecutionProfile = Readonly<{
  profileId: string;
  family: VlmCanonicalProductFamily;
  context: VlmInternalExecutionContext;
  contextTier: VlmCanonicalReportTier | null;
  profilePurpose: "CUSTOMER_TIER_EXECUTION" | "STANDALONE_PRODUCT_EXECUTION";
  customerFacingSku: boolean;
  standaloneProduct: boolean;
  deltaRequiredByCatalog: boolean;
  truthInvariantAcrossContexts: true;
  safetyInvariantAcrossContexts: true;
  expectedDeltaDimensions: readonly string[];
  saleEligibilityApplies: boolean;
}>;

export type VlmContextTransition = Readonly<{
  transitionId: string;
  family: VlmCanonicalProductFamily;
  fromContext: "BASIC_CONTEXT" | "PRO_CONTEXT";
  toContext: "PRO_CONTEXT" | "ADVANCED_CONTEXT";
  customerFacingSku: true;
  standaloneProduct: false;
  deltaRequiredByCatalog: true;
  truthInvariantAcrossContexts: true;
  safetyInvariantAcrossContexts: true;
  expectedDeltaDimensions: readonly string[];
  saleEligibilityApplies: true;
  defaultValueResult: "REQUIRES_CURRENT_MATCHED_INPUT_VALUE_EVIDENCE";
}>;

export const VLM_CANONICAL_CUSTOMER_PRODUCTS = Object.freeze([
  { productId: "audit-basic", displayName: "Audit Basic", family: "audit", productClass: "TIERED_PRODUCT", tier: "basic", commercialRole: "FREE_CORE", artifactOutputs: ["AUDIT_REPORT_PDF"] },
  { productId: "audit-pro", displayName: "Audit Pro", family: "audit", productClass: "TIERED_PRODUCT", tier: "pro", commercialRole: "CONTROLLED_BETA_CANDIDATE", artifactOutputs: ["AUDIT_REPORT_PDF"] },
  { productId: "audit-advanced", displayName: "Audit Advanced", family: "audit", productClass: "TIERED_PRODUCT", tier: "advanced", commercialRole: "NOT_FOR_SALE", artifactOutputs: ["AUDIT_REPORT_PDF"] },

  { productId: "browser-basic", displayName: "Browser Basic", family: "browser", productClass: "TIERED_PRODUCT", tier: "basic", commercialRole: "FREE_CORE", artifactOutputs: ["BROWSER_REPORT_PDF"] },
  { productId: "browser-pro", displayName: "Browser Pro", family: "browser", productClass: "TIERED_PRODUCT", tier: "pro", commercialRole: "NOT_FOR_SALE", artifactOutputs: ["BROWSER_REPORT_PDF"] },
  { productId: "browser-advanced", displayName: "Browser Advanced", family: "browser", productClass: "TIERED_PRODUCT", tier: "advanced", commercialRole: "NOT_FOR_SALE", artifactOutputs: ["BROWSER_REPORT_PDF"] },

  { productId: "shield-basic", displayName: "Shield Basic", family: "shield", productClass: "TIERED_PRODUCT", tier: "basic", commercialRole: "FREE_CORE_ACTION_REQUIRED" },
  { productId: "shield-pro", displayName: "Shield Pro", family: "shield", productClass: "TIERED_PRODUCT", tier: "pro", commercialRole: "NOT_FOR_SALE" },
  { productId: "shield-advanced", displayName: "Shield Advanced", family: "shield", productClass: "TIERED_PRODUCT", tier: "advanced", commercialRole: "NOT_FOR_SALE" },

  { productId: "shield-pro-basic", displayName: "Shield Pro Basic", family: "shield-pro", productClass: "TIERED_PRODUCT", tier: "basic", commercialRole: "FREE_OR_ENTITLED_BASELINE_ACTION_REQUIRED" },
  { productId: "shield-pro-pro", displayName: "Shield Pro Pro", family: "shield-pro", productClass: "TIERED_PRODUCT", tier: "pro", commercialRole: "NOT_FOR_SALE" },
  { productId: "shield-pro-advanced", displayName: "Shield Pro Advanced", family: "shield-pro", productClass: "TIERED_PRODUCT", tier: "advanced", commercialRole: "NOT_FOR_SALE" },

  { productId: "real-markets-basic", displayName: "Real Markets Basic", family: "real-markets", productClass: "TIERED_PRODUCT", tier: "basic", commercialRole: "FREE_REFERENCE_ACTION_REQUIRED" },
  { productId: "real-markets-pro", displayName: "Real Markets Pro", family: "real-markets", productClass: "TIERED_PRODUCT", tier: "pro", commercialRole: "NOT_FOR_SALE" },
  { productId: "real-markets-advanced", displayName: "Real Markets Advanced", family: "real-markets", productClass: "TIERED_PRODUCT", tier: "advanced", commercialRole: "NOT_FOR_SALE" },

  { productId: "shield-map", displayName: "Shield Map", family: "shield-map", productClass: "STANDALONE_PRODUCT", tier: null, commercialRole: "FREE_REFERENCE_ACTION_REQUIRED" },
  { productId: "market-impact", displayName: "Market Impact", family: "market-impact", productClass: "STANDALONE_PRODUCT", tier: null, commercialRole: "FREE_MODULE_ACTION_REQUIRED" },
  { productId: "whale-watch", displayName: "Whale Watch", family: "whale-watch", productClass: "STANDALONE_PRODUCT", tier: null, commercialRole: "FREE_MODULE_ACTION_REQUIRED" },
  { productId: "angel", displayName: "Angel", family: "angel", productClass: "STANDALONE_PRODUCT", tier: null, commercialRole: "FREE_INFORMATIONAL_ACTION_REQUIRED" },
  { productId: "risk-indicator", displayName: "Risk Indicator", family: "risk-indicator", productClass: "STANDALONE_PRODUCT", tier: null, commercialRole: "FREE_DESCRIPTIVE_ACTION_REQUIRED" },
] as const satisfies readonly VlmCanonicalCustomerProduct[]);

export const VLM_CANONICAL_TIERED_FAMILIES = [
  "audit", "browser", "shield", "shield-pro", "real-markets",
] as const satisfies readonly VlmCanonicalProductFamily[];

export const VLM_CANONICAL_STANDALONE_PRODUCTS = [
  "shield-map", "market-impact", "whale-watch", "angel", "risk-indicator",
] as const satisfies readonly VlmCanonicalProductId[];

export const VLM_CANONICAL_PRODUCT_FAMILIES = Object.freeze([
  { family: "audit", displayName: "Audit", customerFacingType: "EXPLICITLY_TIERED_PRODUCT_FAMILY", standaloneProduct: false, customerFacingProductIds: ["audit-basic", "audit-pro", "audit-advanced"], deltaRequiredByCatalog: true, truthInvariantAcrossContexts: true, safetyInvariantAcrossContexts: true },
  { family: "browser", displayName: "Browser", customerFacingType: "EXPLICITLY_TIERED_PRODUCT_FAMILY", standaloneProduct: false, customerFacingProductIds: ["browser-basic", "browser-pro", "browser-advanced"], deltaRequiredByCatalog: true, truthInvariantAcrossContexts: true, safetyInvariantAcrossContexts: true },
  { family: "shield", displayName: "Shield", customerFacingType: "EXPLICITLY_TIERED_PRODUCT_FAMILY", standaloneProduct: false, customerFacingProductIds: ["shield-basic", "shield-pro", "shield-advanced"], deltaRequiredByCatalog: true, truthInvariantAcrossContexts: true, safetyInvariantAcrossContexts: true },
  { family: "shield-pro", displayName: "Shield Pro", customerFacingType: "EXPLICITLY_TIERED_PRODUCT_FAMILY", standaloneProduct: false, customerFacingProductIds: ["shield-pro-basic", "shield-pro-pro", "shield-pro-advanced"], deltaRequiredByCatalog: true, truthInvariantAcrossContexts: true, safetyInvariantAcrossContexts: true },
  { family: "real-markets", displayName: "Real Markets", customerFacingType: "EXPLICITLY_TIERED_PRODUCT_FAMILY", standaloneProduct: false, customerFacingProductIds: ["real-markets-basic", "real-markets-pro", "real-markets-advanced"], deltaRequiredByCatalog: true, truthInvariantAcrossContexts: true, safetyInvariantAcrossContexts: true },
  { family: "shield-map", displayName: "Shield Map", customerFacingType: "STANDALONE_PRODUCT_FAMILY", standaloneProduct: true, customerFacingProductIds: ["shield-map"], deltaRequiredByCatalog: false, truthInvariantAcrossContexts: true, safetyInvariantAcrossContexts: true },
  { family: "market-impact", displayName: "Market Impact", customerFacingType: "STANDALONE_PRODUCT_FAMILY", standaloneProduct: true, customerFacingProductIds: ["market-impact"], deltaRequiredByCatalog: false, truthInvariantAcrossContexts: true, safetyInvariantAcrossContexts: true },
  { family: "whale-watch", displayName: "Whale Watch", customerFacingType: "STANDALONE_PRODUCT_FAMILY", standaloneProduct: true, customerFacingProductIds: ["whale-watch"], deltaRequiredByCatalog: false, truthInvariantAcrossContexts: true, safetyInvariantAcrossContexts: true },
  { family: "angel", displayName: "Angel", customerFacingType: "STANDALONE_PRODUCT_FAMILY", standaloneProduct: true, customerFacingProductIds: ["angel"], deltaRequiredByCatalog: false, truthInvariantAcrossContexts: true, safetyInvariantAcrossContexts: true },
  { family: "risk-indicator", displayName: "Risk Indicator", customerFacingType: "STANDALONE_PRODUCT_FAMILY", standaloneProduct: true, customerFacingProductIds: ["risk-indicator"], deltaRequiredByCatalog: false, truthInvariantAcrossContexts: true, safetyInvariantAcrossContexts: true },
] as const satisfies readonly VlmCanonicalFamilyDefinition[]);

export const VLM_INTERNAL_EXECUTION_CONTEXTS = [
  "BASIC_CONTEXT", "PRO_CONTEXT", "ADVANCED_CONTEXT", "STANDALONE_CONTEXT",
] as const satisfies readonly VlmInternalExecutionContext[];

const CONTEXT_TO_TIER: Readonly<Partial<Record<VlmInternalExecutionContext, VlmCanonicalReportTier>>> = Object.freeze({
  BASIC_CONTEXT: "basic",
  PRO_CONTEXT: "pro",
  ADVANCED_CONTEXT: "advanced",
});

const TIERED_EXPECTED_DIMENSIONS: Readonly<Record<(typeof VLM_CANONICAL_TIERED_FAMILIES)[number], Readonly<Record<"pro" | "advanced", readonly string[]>>>> = Object.freeze({
  audit: {
    pro: ["UNIQUE_DECISION_RELEVANT_EVIDENCE", "EXPLOITABILITY_AND_PRECONDITIONS", "REMEDIATION_VALIDATION", "RISK_AND_EFFORT_PRIORITIZATION"],
    advanced: ["ATTACK_PATH_AND_CROSS_CONTROL_SYNTHESIS", "BUSINESS_AND_TECHNICAL_IMPACT", "RESIDUAL_RISK_AND_CONFIDENCE", "TEAM_HANDOFF_AND_RETEST_PLAN"],
  },
  browser: {
    pro: ["DEEPER_EXTRACTION_AND_CROSS_CHECK", "PROVENANCE_NAVIGATION", "NEW_SAFE_ACTIONS", "FASTER_REVIEW_WORKFLOW"],
    advanced: ["INTERACTIVE_DECISION_WORKSPACE", "CONFLICT_ADJUDICATION", "ADVANCED_EXPORT_AND_HANDOFF", "STORED_ARTIFACT_PARITY"],
  },
  shield: {
    pro: ["EXPANDED_RISK_FACTORS", "SOURCE_PROVENANCE", "FRESHNESS_AND_CONFLICTS", "ACTIONABLE_RISK_EXPLANATION"],
    advanced: ["MULTI_SOURCE_RISK_SYNTHESIS", "HISTORICAL_RISK_CHANGE", "GOVERNANCE_AND_EXPORT", "CROSS_PRODUCT_EVIDENCE_HANDOFF"],
  },
  "shield-pro": {
    pro: ["TERMINAL_DEPTH_AND_DIAGNOSTICS", "PROVENANCE_AND_FRESHNESS", "ADVANCED_SIGNAL_EXPLANATION", "SAFE_OPERATOR_ACTIONS"],
    advanced: ["MULTI_SIGNAL_CORRELATION", "HISTORICAL_TERMINAL_CONTEXT", "GOVERNANCE_EXPORT", "TEAM_HANDOFF_AND_REPLAY"],
  },
  "real-markets": {
    pro: ["MULTI_SOURCE_MARKET_COMPARISON", "FRESHNESS_AND_STALENESS", "HISTORY_WHERE_RIGHTS_ALLOW", "PROVENANCE_AND_CONFLICTS"],
    advanced: ["CROSS_ASSET_WORKSPACE", "HISTORICAL_AND_SCENARIO_CONTEXT", "GOVERNED_EXPORT", "TEAM_DECISION_HANDOFF"],
  },
});

function tierForContext(context: VlmInternalExecutionContext): VlmCanonicalReportTier | null {
  return CONTEXT_TO_TIER[context] ?? null;
}

function expectedProfileDeltaDimensions(
  family: VlmCanonicalProductFamily,
  context: VlmInternalExecutionContext,
  standaloneProduct: boolean,
): readonly string[] {
  if (standaloneProduct) return ["INDEPENDENT_STANDALONE_FUNCTION_BASELINE"];
  if (context === "BASIC_CONTEXT") return ["INDEPENDENTLY_USEFUL_BASELINE"];
  if (context === "STANDALONE_CONTEXT") return [];
  const tier = tierForContext(context) as "pro" | "advanced";
  return TIERED_EXPECTED_DIMENSIONS[family as (typeof VLM_CANONICAL_TIERED_FAMILIES)[number]][tier];
}

export const VLM_INTERNAL_EXECUTION_PROFILES = Object.freeze(
  VLM_CANONICAL_PRODUCT_FAMILIES.flatMap((definition): VlmInternalExecutionProfile[] => {
    const contexts: readonly VlmInternalExecutionContext[] = definition.standaloneProduct
      ? ["STANDALONE_CONTEXT"]
      : ["BASIC_CONTEXT", "PRO_CONTEXT", "ADVANCED_CONTEXT"];
    return contexts.map((context): VlmInternalExecutionProfile => ({
      profileId: `${definition.family}@${context}`,
      family: definition.family,
      context,
      contextTier: tierForContext(context),
      profilePurpose: definition.standaloneProduct ? "STANDALONE_PRODUCT_EXECUTION" : "CUSTOMER_TIER_EXECUTION",
      customerFacingSku: true,
      standaloneProduct: definition.standaloneProduct,
      deltaRequiredByCatalog: !definition.standaloneProduct && context !== "BASIC_CONTEXT",
      truthInvariantAcrossContexts: true,
      safetyInvariantAcrossContexts: true,
      expectedDeltaDimensions: expectedProfileDeltaDimensions(definition.family, context, definition.standaloneProduct),
      saleEligibilityApplies: true,
    }));
  }),
);

function buildContextTransition(
  definition: Extract<(typeof VLM_CANONICAL_PRODUCT_FAMILIES)[number], { standaloneProduct: false }>,
  fromContext: "BASIC_CONTEXT" | "PRO_CONTEXT",
  toContext: "PRO_CONTEXT" | "ADVANCED_CONTEXT",
): VlmContextTransition {
  return {
    transitionId: `${definition.family}:${fromContext}->${toContext}`,
    family: definition.family,
    fromContext,
    toContext,
    customerFacingSku: true,
    standaloneProduct: false,
    deltaRequiredByCatalog: true,
    truthInvariantAcrossContexts: true,
    safetyInvariantAcrossContexts: true,
    expectedDeltaDimensions: expectedProfileDeltaDimensions(definition.family, toContext, false),
    saleEligibilityApplies: true,
    defaultValueResult: "REQUIRES_CURRENT_MATCHED_INPUT_VALUE_EVIDENCE",
  };
}

const TIERED_FAMILY_DEFINITIONS = VLM_CANONICAL_PRODUCT_FAMILIES.filter(
  (definition): definition is Extract<(typeof VLM_CANONICAL_PRODUCT_FAMILIES)[number], { standaloneProduct: false }> => !definition.standaloneProduct,
);

export const VLM_CONTEXT_TRANSITIONS = Object.freeze(
  TIERED_FAMILY_DEFINITIONS.flatMap((definition) => [
    buildContextTransition(definition, "BASIC_CONTEXT", "PRO_CONTEXT"),
    buildContextTransition(definition, "PRO_CONTEXT", "ADVANCED_CONTEXT"),
  ]),
);

export const VLM_V16_TOPOLOGY_DENOMINATORS = Object.freeze({
  customerFacingRows: 20,
  productFamilies: 10,
  explicitlyTieredRows: 15,
  standaloneRows: 5,
  internalExecutionProfiles: 20,
  tieredExecutionProfiles: 15,
  standaloneExecutionProfiles: 5,
  contextTransitions: 10,
  deltaRequiredTransitions: 10,
  notApplicableNoPaidDeltaClaimTransitions: 0,
  legacyInternalTestContextArtifacts: 33,
  legacy33ProductCompletionDenominatorRetired: true,
  pdfSeparateProductFamily: false,
});

export const VLM_REPORT_INTEGRATION_DEPTH = Object.freeze({
  audit: {
    basic: "customer audit baseline plus Basic audit PDF artifact",
    pro: "materially deeper audit evidence plus Pro audit PDF artifact",
    advanced: "deepest audit synthesis plus Advanced audit PDF artifact",
  },
  browser: {
    basic: "baseline Browser analysis and Browser PDF where applicable",
    pro: "deeper Browser extraction, provenance and workflow",
    advanced: "advanced Browser decision workspace, export and artifact parity",
  },
  shield: {
    basic: "baseline Shield risk facts and limitations",
    pro: "expanded Shield evidence, provenance and conflicts",
    advanced: "historical and governed Shield decision workflow",
  },
  "shield-pro": {
    basic: "baseline Shield Pro terminal evidence",
    pro: "expanded terminal diagnostics and provenance",
    advanced: "multi-signal history, replay and team workflow",
  },
  "real-markets": {
    basic: "reference and derived market status with freshness",
    pro: "expanded source comparison and history where legally available",
    advanced: "workspace, export and governance with the same factual truth standard",
  },
}) as Readonly<Record<(typeof VLM_CANONICAL_TIERED_FAMILIES)[number], Readonly<Record<VlmCanonicalReportTier, string>>>>;

export const VLM_STANDALONE_INTEGRATION_RULES = Object.freeze({
  "shield-map": "One standalone Shield Map product. Test graph truth, provenance, currentness, fallback, security and customer value without Basic/Pro/Advanced SKUs.",
  "market-impact": "One free standalone Market Impact function. Test model/domain correctness, order-book/depth inputs, freshness, fallback, risk, security, edge cases and customer value.",
  "whale-watch": "One free standalone Whale Watch function. Test chain data truth, source rights, currentness/finality, fallback, security, edge cases and customer value.",
  angel: "One coherent Angel AI assistant. Test answer correctness, unsupported claims, reasoning consistency, prompt injection, contradictory/missing data fail-closed behavior, PL/EN/DE, long context, cross-product integration, security and regressions.",
  "risk-indicator": "One standalone Risk Indicator. Payment or internal execution context must never change the factual risk value for the same evidence state.",
} as const) satisfies Readonly<Record<(typeof VLM_CANONICAL_STANDALONE_PRODUCTS)[number], string>>;

export const VLM_PRODUCT_TAXONOMY_RULES = Object.freeze({
  revisionId: "P66_OWNER_CORRECTED_PRODUCT_TOPOLOGY_AUDIT_PDF_ARTIFACT_MODEL",
  predecessorRevisionId: "P39_V16_AUTHORITY_TOPOLOGY_AND_EXACT_NODE24_LINUX_RECONCILIATION",
  schemaVersion: VELMERE_V16_PRODUCT_TOPOLOGY_ID,
  customerProductRows: 20,
  productFamilies: 10,
  tieredProductRows: 15,
  standaloneProductRows: 5,
  internalExecutionProfiles: 20,
  contextTransitions: 10,
  requiredPaidDeltaTransitions: 10,
  noPaidDeltaClaimTransitions: 0,
  pdfIsSeparateProductFamily: false,
  auditPdfIsCustomerArtifactForEachAuditTier: true,
  browserPdfRemainsBrowserArtifactWhereImplemented: true,
  standaloneProductsNeverBecomeThreeCustomerFacingSkus: true,
  standaloneProductsUseStandaloneExecutionContext: true,
  invariantTruthIsPositiveConsistencyRequirement: true,
  shieldAndShieldProAreSeparateTieredProductFamilies: true,
  riskValueCannotChangeBecauseCustomerPaidMore: true,
  angelHasNoCustomerTier: true,
  whaleWatchHasNoCustomerTier: true,
  marketImpactHasNoCustomerTier: true,
  saleEligibilityDenominatorUsesCustomerFacingRowsOnly: true,
  legacyThirtyThreeSaleSkuModel: "FORBIDDEN_RETIRED_MEASUREMENT_MODEL",
  legacyThirtyThreeContextArtifacts: "HISTORICAL_INTERNAL_TEST_ARTIFACTS_ONLY_NOT_PRODUCT_COMPLETION",
  legacyThirtyRowModel: "HISTORICAL_COMPATIBILITY_ONLY",
});

export function isVlmStandaloneProductId(value: string): value is (typeof VLM_CANONICAL_STANDALONE_PRODUCTS)[number] {
  return (VLM_CANONICAL_STANDALONE_PRODUCTS as readonly string[]).includes(value);
}

export function getVlmCanonicalCustomerProduct(productId: VlmCanonicalProductId) {
  return VLM_CANONICAL_CUSTOMER_PRODUCTS.find((product) => product.productId === productId) ?? null;
}

export function getVlmCanonicalFamily(family: VlmCanonicalProductFamily) {
  return VLM_CANONICAL_PRODUCT_FAMILIES.find((definition) => definition.family === family) ?? null;
}

export function getVlmInternalExecutionProfile(family: VlmCanonicalProductFamily, context: VlmInternalExecutionContext) {
  return VLM_INTERNAL_EXECUTION_PROFILES.find((profile) => profile.family === family && profile.context === context) ?? null;
}

export function getVlmContextTransition(family: VlmCanonicalProductFamily, toContext: "PRO_CONTEXT" | "ADVANCED_CONTEXT") {
  return VLM_CONTEXT_TRANSITIONS.find((transition) => transition.family === family && transition.toContext === toContext) ?? null;
}

export function getVlmTieredReportIntegrationDepth(
  family: (typeof VLM_CANONICAL_TIERED_FAMILIES)[number],
  tier: VlmCanonicalReportTier,
) {
  return VLM_REPORT_INTEGRATION_DEPTH[family][tier];
}

export function getVlmStandaloneIntegrationRule(productId: (typeof VLM_CANONICAL_STANDALONE_PRODUCTS)[number]) {
  return VLM_STANDALONE_INTEGRATION_RULES[productId];
}
