import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_DIGEST,
  buildPass6CatalogCoverageReceipt,
  getPass6RealMarketsAssetFieldRules,
  type Pass6FieldRequirement,
  type Pass6RealMarketsAssetClass,
} from "@/lib/reporting/real-markets-asset-field-registry";
import {
  getPass4824VisibleFieldDefinitions,
  type Pass4824DataTier,
} from "@/lib/reporting/canonical-field-registry";
import {
  REAL_MARKETS_CUSTOMER_CATALOG_COUNTS,
  REAL_MARKETS_CUSTOMER_CATALOG_ROWS,
  REAL_MARKETS_CUSTOMER_CATALOG_SHA256,
} from "@/lib/market-integrity/real-markets-customer-catalog";
import type {
  VlmCustomerDataState,
  VlmFieldRightsState,
} from "@/lib/product/vlm-tiered-table-customer-contract";

export const REAL_MARKETS_CURRENT_FIELD_AUTHORITY_ID =
  "velmere.current-execution.real-markets-current-field-authority.v1" as const;

export const REAL_MARKETS_CURRENT_ASSET_CLASSES = Object.freeze([
  "equity",
  "fx",
  "etf",
  "commodity",
  "real_estate",
  "crypto",
] as const satisfies readonly Pass6RealMarketsAssetClass[]);

export const REAL_MARKETS_CURRENT_TIERS = Object.freeze([
  "basic",
  "pro",
  "advanced",
] as const satisfies readonly Pass4824DataTier[]);

export type RealMarketsCurrentProductId =
  | "real-markets-basic"
  | "real-markets-pro"
  | "real-markets-advanced";

export type RealMarketsCurrentFieldRule = Readonly<{
  assetClass: Pass6RealMarketsAssetClass;
  tier: Pass4824DataTier;
  fieldId: string;
  requirement: Pass6FieldRequirement;
  fallback: "blocked" | "abstain" | "not_applicable";
  canonicalSemantic: string;
  unit: string;
  currencyPolicy: "required_iso_4217" | "forbidden";
  maxAgeSeconds: number;
  minimumIndependentQuorum: number;
  definitionSource: "pass4824_canonical" | "pass6_identity_extension";
}>;

export type RealMarketsCurrentFieldAuthoritySnapshot = Readonly<{
  schemaVersion: typeof REAL_MARKETS_CURRENT_FIELD_AUTHORITY_ID;
  catalogAssetDenominator: number;
  catalogUniqueSymbolDenominator: number;
  catalogSha256: string;
  supportedAssetClasses: readonly Pass6RealMarketsAssetClass[];
  tiers: readonly Pass4824DataTier[];
  ruleRows: readonly RealMarketsCurrentFieldRule[];
  ruleRowCount: number;
  criticalRuleRowCount: number;
  optionalRuleRowCount: number;
  notApplicableRuleRowCount: number;
  pass6RegistryDigest: string;
  currentExecutionBaseline: readonly Readonly<{
    tier: Pass4824DataTier;
    criticalFieldCellDenominator: number;
    availableCriticalFieldCellNumerator: number;
    completenessBps: number;
    providerRequiredAssetCount: number;
    providerRequiredPaidBlockedCount: number;
    openBlockers: readonly string[];
  }>[];
  authorityDigest: string;
  customerFinalCredit: false;
  truthBoundary: string;
}>;

export type RealMarketsCurrentFieldObservation = Readonly<{
  fieldId: string;
  state: VlmCustomerDataState;
  rightsState: VlmFieldRightsState;
  conditionalRightsSatisfied?: boolean;
}>;

export type RealMarketsCurrentFieldSetDecision = Readonly<{
  schemaVersion: "velmere.current-execution.real-markets-current-field-set-decision.v1";
  productId: RealMarketsCurrentProductId;
  assetClass: Pass6RealMarketsAssetClass;
  tier: Pass4824DataTier;
  state: "READY" | "PARTIAL" | "WITHHELD";
  criticalFieldDenominator: number;
  readyCriticalFieldNumerator: number;
  optionalFieldDenominator: number;
  readyOptionalFieldNumerator: number;
  missingObservationFieldIds: readonly string[];
  unknownObservationFieldIds: readonly string[];
  duplicateObservationFieldIds: readonly string[];
  blockedCriticalFieldIds: readonly string[];
  degradedOptionalFieldIds: readonly string[];
  notApplicableFieldIds: readonly string[];
  paidDeliveryEligible: boolean;
  customerFinalCredit: false;
  decisionDigest: string;
}>;

const PRODUCT_TIER: Readonly<Record<RealMarketsCurrentProductId, Pass4824DataTier>> = Object.freeze({
  "real-markets-basic": "basic",
  "real-markets-pro": "pro",
  "real-markets-advanced": "advanced",
});

const RIGHTS_ALLOWING_CUSTOMER_OUTPUT = new Set<VlmFieldRightsState>([
  "GREEN_EXACT",
  "GREEN_CONDITIONAL",
]);

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizeCatalogAssetClass(value: string): Pass6RealMarketsAssetClass {
  if (value === "stock") return "equity";
  if (value === "exchange_token") return "crypto";
  if (REAL_MARKETS_CURRENT_ASSET_CLASSES.includes(value as Pass6RealMarketsAssetClass)) {
    return value as Pass6RealMarketsAssetClass;
  }
  throw new Error(`real_markets_current_catalog_asset_class_unsupported:${value}`);
}

function canonicalSemanticByField(tier: Pass4824DataTier): ReadonlyMap<string, string> {
  return new Map(
    getPass4824VisibleFieldDefinitions("real_markets", tier)
      .map((definition) => [definition.fieldId, definition.semantic] as const),
  );
}

function buildRuleRows(): RealMarketsCurrentFieldRule[] {
  const rows: RealMarketsCurrentFieldRule[] = [];
  for (const assetClass of REAL_MARKETS_CURRENT_ASSET_CLASSES) {
    for (const tier of REAL_MARKETS_CURRENT_TIERS) {
      const canonicalSemantics = canonicalSemanticByField(tier);
      for (const rule of getPass6RealMarketsAssetFieldRules(assetClass, tier)) {
        const canonicalSemantic = rule.definitionSource === "pass4824_canonical"
          ? canonicalSemantics.get(rule.fieldId)
          : rule.fieldId === "identity.venue"
            ? "Exact venue identity required for market-scope truth."
            : "Exact instrument-contract identity required where the asset class uses a contract or pair definition.";
        if (!canonicalSemantic) {
          throw new Error(`real_markets_current_canonical_semantic_missing:${assetClass}:${tier}:${rule.fieldId}`);
        }
        rows.push(Object.freeze({
          assetClass,
          tier,
          fieldId: rule.fieldId,
          requirement: rule.requirement,
          fallback: rule.fallback,
          canonicalSemantic,
          unit: rule.unit,
          currencyPolicy: rule.currencyPolicy,
          maxAgeSeconds: rule.maxAgeSeconds,
          minimumIndependentQuorum: rule.minimumIndependentQuorum,
          definitionSource: rule.definitionSource,
        }));
      }
    }
  }
  return rows.sort((left, right) =>
    left.assetClass.localeCompare(right.assetClass)
    || REAL_MARKETS_CURRENT_TIERS.indexOf(left.tier) - REAL_MARKETS_CURRENT_TIERS.indexOf(right.tier)
    || left.fieldId.localeCompare(right.fieldId));
}

export function buildRealMarketsCurrentFieldAuthoritySnapshot(): RealMarketsCurrentFieldAuthoritySnapshot {
  if (REAL_MARKETS_CUSTOMER_CATALOG_ROWS.length !== REAL_MARKETS_CUSTOMER_CATALOG_COUNTS.total) {
    throw new Error("real_markets_current_catalog_denominator_mismatch");
  }
  if (
    REAL_MARKETS_CUSTOMER_CATALOG_COUNTS.total !== 555
    || REAL_MARKETS_CUSTOMER_CATALOG_COUNTS.uniqueSymbols !== 555
  ) {
    throw new Error("real_markets_current_catalog_denominator_mismatch_expected_555");
  }
  const unsupported = sortedUnique(
    REAL_MARKETS_CUSTOMER_CATALOG_ROWS
      .map((row) => row.assetClass)
      .filter((value) => {
        try {
          normalizeCatalogAssetClass(value);
          return false;
        } catch {
          return true;
        }
      }),
  );
  if (unsupported.length > 0) {
    throw new Error(`real_markets_current_catalog_unsupported_classes:${unsupported.join(",")}`);
  }

  const ruleRows = buildRuleRows();
  const rowKeys = ruleRows.map((row) => `${row.assetClass}:${row.tier}:${row.fieldId}`);
  if (new Set(rowKeys).size !== rowKeys.length) {
    throw new Error("real_markets_current_field_authority_duplicate_rule");
  }

  const currentExecutionBaseline = REAL_MARKETS_CURRENT_TIERS.map((tier) => {
    const coverage = buildPass6CatalogCoverageReceipt({
      tier,
      generatedAt: "2026-08-22T20:00:00.000Z",
    });
    return Object.freeze({
      tier,
      criticalFieldCellDenominator: coverage.criticalFieldCellDenominator,
      availableCriticalFieldCellNumerator: coverage.availableCriticalFieldCellNumerator,
      completenessBps: coverage.completenessBps,
      providerRequiredAssetCount: coverage.providerRequiredAssetCount,
      providerRequiredPaidBlockedCount: coverage.providerRequiredPaidBlockedCount,
      openBlockers: Object.freeze([...coverage.openBlockers]),
    });
  });

  const unsigned = {
    schemaVersion: REAL_MARKETS_CURRENT_FIELD_AUTHORITY_ID,
    catalogAssetDenominator: REAL_MARKETS_CUSTOMER_CATALOG_COUNTS.total,
    catalogUniqueSymbolDenominator: REAL_MARKETS_CUSTOMER_CATALOG_COUNTS.uniqueSymbols,
    catalogSha256: REAL_MARKETS_CUSTOMER_CATALOG_SHA256,
    supportedAssetClasses: REAL_MARKETS_CURRENT_ASSET_CLASSES,
    tiers: REAL_MARKETS_CURRENT_TIERS,
    ruleRows,
    ruleRowCount: ruleRows.length,
    criticalRuleRowCount: ruleRows.filter((row) => row.requirement === "critical").length,
    optionalRuleRowCount: ruleRows.filter((row) => row.requirement === "optional").length,
    notApplicableRuleRowCount: ruleRows.filter((row) => row.requirement === "not_applicable").length,
    pass6RegistryDigest: PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_DIGEST,
    currentExecutionBaseline,
    customerFinalCredit: false as const,
    truthBoundary: "This snapshot extracts current mandatory-field requiredness from the canonical Pass4824/Pass6 source contracts. It does not prove provider rights, current values, staging delivery, paid value or Customer FINAL.",
  };
  return Object.freeze({
    ...unsigned,
    authorityDigest: sha256Digest(canonicalJson(unsigned)),
  });
}

function fieldRightsAllowed(observation: RealMarketsCurrentFieldObservation): boolean {
  if (!RIGHTS_ALLOWING_CUSTOMER_OUTPUT.has(observation.rightsState)) return false;
  return observation.rightsState !== "GREEN_CONDITIONAL" || observation.conditionalRightsSatisfied === true;
}

function observationReady(observation: RealMarketsCurrentFieldObservation): boolean {
  return observation.state === "READY" && fieldRightsAllowed(observation);
}

export function evaluateRealMarketsCurrentFieldSet(input: Readonly<{
  productId: RealMarketsCurrentProductId;
  assetClass: Pass6RealMarketsAssetClass;
  observations: readonly RealMarketsCurrentFieldObservation[];
}>): RealMarketsCurrentFieldSetDecision {
  const tier = PRODUCT_TIER[input.productId];
  const rules = getPass6RealMarketsAssetFieldRules(input.assetClass, tier);
  const rulesById = new Map(rules.map((rule) => [rule.fieldId, rule]));
  const observationsById = new Map<string, RealMarketsCurrentFieldObservation>();
  const duplicateObservationFieldIds: string[] = [];
  const unknownObservationFieldIds: string[] = [];
  for (const observation of input.observations) {
    if (!rulesById.has(observation.fieldId)) unknownObservationFieldIds.push(observation.fieldId);
    if (observationsById.has(observation.fieldId)) duplicateObservationFieldIds.push(observation.fieldId);
    else observationsById.set(observation.fieldId, observation);
  }

  const missingObservationFieldIds: string[] = [];
  const blockedCriticalFieldIds: string[] = [];
  const degradedOptionalFieldIds: string[] = [];
  const notApplicableFieldIds: string[] = [];
  let readyCriticalFieldNumerator = 0;
  let readyOptionalFieldNumerator = 0;

  for (const rule of rules) {
    const observation = observationsById.get(rule.fieldId);
    if (rule.requirement === "not_applicable") {
      notApplicableFieldIds.push(rule.fieldId);
      continue;
    }
    if (!observation) {
      missingObservationFieldIds.push(rule.fieldId);
      if (rule.requirement === "critical") blockedCriticalFieldIds.push(rule.fieldId);
      else degradedOptionalFieldIds.push(rule.fieldId);
      continue;
    }
    if (observationReady(observation)) {
      if (rule.requirement === "critical") readyCriticalFieldNumerator += 1;
      else readyOptionalFieldNumerator += 1;
    } else if (rule.requirement === "critical") {
      blockedCriticalFieldIds.push(rule.fieldId);
    } else {
      degradedOptionalFieldIds.push(rule.fieldId);
    }
  }

  const criticalFieldDenominator = rules.filter((rule) => rule.requirement === "critical").length;
  const optionalFieldDenominator = rules.filter((rule) => rule.requirement === "optional").length;
  const hardFailure = blockedCriticalFieldIds.length > 0
    || unknownObservationFieldIds.length > 0
    || duplicateObservationFieldIds.length > 0;
  const state: RealMarketsCurrentFieldSetDecision["state"] = hardFailure
    ? "WITHHELD"
    : degradedOptionalFieldIds.length > 0
      ? "PARTIAL"
      : "READY";
  const paidDeliveryEligible = tier !== "basic"
    && state === "READY"
    && readyCriticalFieldNumerator === criticalFieldDenominator
    && readyOptionalFieldNumerator === optionalFieldDenominator;

  const unsigned = {
    schemaVersion: "velmere.current-execution.real-markets-current-field-set-decision.v1" as const,
    productId: input.productId,
    assetClass: input.assetClass,
    tier,
    state,
    criticalFieldDenominator,
    readyCriticalFieldNumerator,
    optionalFieldDenominator,
    readyOptionalFieldNumerator,
    missingObservationFieldIds: sortedUnique(missingObservationFieldIds),
    unknownObservationFieldIds: sortedUnique(unknownObservationFieldIds),
    duplicateObservationFieldIds: sortedUnique(duplicateObservationFieldIds),
    blockedCriticalFieldIds: sortedUnique(blockedCriticalFieldIds),
    degradedOptionalFieldIds: sortedUnique(degradedOptionalFieldIds),
    notApplicableFieldIds: sortedUnique(notApplicableFieldIds),
    paidDeliveryEligible,
    customerFinalCredit: false as const,
  };
  return Object.freeze({
    ...unsigned,
    decisionDigest: sha256Digest(canonicalJson(unsigned)),
  });
}
