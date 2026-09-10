import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  getPass4824VisibleFieldDefinitions,
  validatePass4824CanonicalFieldPacket,
  type Pass4824CanonicalFieldPacket,
  type Pass4824DataTier,
  type Pass4824FieldDefinition,
  type Pass4824FieldObservation,
} from "@/lib/reporting/canonical-field-registry";
import {
  REAL_MARKETS_CUSTOMER_CATALOG_COUNTS,
  REAL_MARKETS_CUSTOMER_CATALOG_ROWS,
  REAL_MARKETS_CUSTOMER_CATALOG_SHA256,
  REAL_MARKETS_CUSTOMER_CATALOG_SOURCE_SHA256,
  type RealMarketsCustomerCatalogRow,
} from "@/lib/market-integrity/real-markets-customer-catalog";

export const PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_ID = "pass6-real-markets-asset-field-registry-v1" as const;
export const PASS6_REAL_MARKETS_FIELD_ATTESTATION_ID = "pass6-real-markets-field-evidence-attestation-v1" as const;
export const PASS6_REAL_MARKETS_COMPLETENESS_RECEIPT_ID = "pass6-real-markets-asset-field-completeness-v1" as const;
export const PASS6_REAL_MARKETS_CATALOG_COVERAGE_RECEIPT_ID = "pass6-real-markets-catalog-coverage-v1" as const;

export type Pass6RealMarketsAssetClass = "equity" | "fx" | "etf" | "commodity" | "real_estate" | "crypto";
export type Pass6FieldRequirement = "critical" | "optional" | "not_applicable";
export type Pass6FieldFallback = "blocked" | "abstain" | "not_applicable";
export type Pass6IdentityDimensionState = "exact" | "missing" | "ambiguous" | "not_applicable";
export type Pass6FieldState = "available" | "missing" | "blocked" | "abstained" | "not_applicable";

export type Pass6DivergenceTolerance = {
  method: "relative_bps" | "absolute_bps";
  maximumBps: number;
} | null;

export type Pass6AssetFieldRule = {
  schemaVersion: typeof PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_ID;
  assetClass: Pass6RealMarketsAssetClass;
  tier: Pass4824DataTier;
  fieldId: string;
  definitionSource: "pass4824_canonical" | "pass6_identity_extension";
  canonicalDefinitionDigest: string | null;
  requirement: Pass6FieldRequirement;
  unit: string;
  currencyPolicy: Pass4824FieldDefinition["currencyPolicy"];
  maxAgeSeconds: number;
  minimumIndependentQuorum: number;
  divergenceTolerance: Pass6DivergenceTolerance;
  fallback: Pass6FieldFallback;
};

export type Pass6IdentityDimension = {
  state: Pass6IdentityDimensionState;
  value: string | null;
};

export type Pass6RealMarketsIdentityResolution = {
  venue: Pass6IdentityDimension;
  instrumentContract: Pass6IdentityDimension;
};

/**
 * One already-verified, content-bound source contribution to a canonical field.
 * `bindingDigest` binds the source to the exact observation evidence digest (or
 * to the extension value digest for venue / instrument contract). Different
 * API keys or adapters backed by the same upstreamRoot still count only once.
 */
export type Pass6FieldEvidenceAttestation = {
  schemaVersion: typeof PASS6_REAL_MARKETS_FIELD_ATTESTATION_ID;
  fieldId: string;
  evidenceRef: string;
  sourceId: string;
  sourceFamily: string;
  upstreamRoot: string;
  commercialEligible: boolean;
  contentBound: boolean;
  identityMatch: "exact" | "ambiguous" | "mismatch";
  observedAt: string;
  receivedAt: string;
  bindingDigest: string;
  contentDigest: string;
  currency: string | null;
  numericValue: number | null;
  attestationDigest: string;
};

export type Pass6FieldEvidenceAttestationInput = Omit<Pass6FieldEvidenceAttestation, "schemaVersion" | "attestationDigest">;

export type Pass6AssetFieldValidationInput = {
  packet: Pass4824CanonicalFieldPacket;
  assetClass: Pass6RealMarketsAssetClass | RealMarketsCustomerCatalogRow["assetClass"];
  tier: Pass4824DataTier;
  identityResolution: Pass6RealMarketsIdentityResolution;
  evidence: Pass6FieldEvidenceAttestation[];
  evaluatedAt: string;
};

export type Pass6AssetFieldStatus = {
  fieldId: string;
  requirement: Pass6FieldRequirement;
  state: Pass6FieldState;
  fallback: Pass6FieldFallback;
  unit: string;
  currencyPolicy: Pass4824FieldDefinition["currencyPolicy"];
  maxAgeSeconds: number;
  minimumIndependentQuorum: number;
  independentUpstreamCount: number;
  upstreamRoots: string[];
  divergenceBps: number | null;
  divergenceTolerance: Pass6DivergenceTolerance;
  blockers: string[];
};

export type Pass6AssetFieldCompletenessReceipt = {
  schemaVersion: typeof PASS6_REAL_MARKETS_COMPLETENESS_RECEIPT_ID;
  registryDigest: string;
  packetDigest: string;
  canonicalValidationStatus: "passed" | "failed";
  canonicalValidationErrors: string[];
  assetClass: Pass6RealMarketsAssetClass;
  tier: Pass4824DataTier;
  evaluatedAt: string;
  identityState: "exact" | "blocked";
  fieldRows: Pass6AssetFieldStatus[];
  criticalFieldDenominator: number;
  availableCriticalFieldNumerator: number;
  completenessBps: number;
  missingCriticalFields: string[];
  blockedCriticalFields: string[];
  optionalAbstentions: string[];
  notApplicableFields: string[];
  blockers: string[];
  paidDeliveryEligible: boolean;
  receiptDigest: string;
};

type Pass6CatalogCoverageRow = {
  catalogId: string;
  symbol: string;
  assetClass: Pass6RealMarketsAssetClass;
  adapterState: string;
  state: "explicit_missing_provider_required" | "unverified_provider_state" | "validated" | "blocked";
  criticalFieldDenominator: number;
  availableCriticalFieldNumerator: number;
  missingCriticalFields: string[];
  notApplicableFields: string[];
  providerAvailabilityClaimed: boolean;
  paidDeliveryEligible: boolean;
  blockers: string[];
};

export type Pass6CatalogCoverageReceipt = {
  schemaVersion: typeof PASS6_REAL_MARKETS_CATALOG_COVERAGE_RECEIPT_ID;
  generatedAt: string;
  tier: Pass4824DataTier;
  catalogSourceSha256: string;
  catalogSha256: string;
  catalogAssetDenominator: number;
  catalogUniqueSymbolDenominator: number;
  assetClassCounts: Record<Pass6RealMarketsAssetClass, number>;
  adapterStateCounts: Record<string, number>;
  providerRequiredAssetCount: number;
  providerRequiredExplicitMissingCount: number;
  providerRequiredPaidBlockedCount: number;
  providerAvailabilityClaimedCount: number;
  paidDeliveryEligibleAssetCount: number;
  criticalFieldCellDenominator: number;
  availableCriticalFieldCellNumerator: number;
  completenessBps: number;
  rows: Pass6CatalogCoverageRow[];
  openBlockers: string[];
  registryDigest: string;
  receiptDigest: string;
};

const ASSET_CLASSES: readonly Pass6RealMarketsAssetClass[] = ["equity", "fx", "etf", "commodity", "real_estate", "crypto"];
const TIERS: readonly Pass4824DataTier[] = ["basic", "pro", "advanced"];
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;
const EXTENSION_FIELDS = ["identity.venue", "identity.instrument_contract"] as const;

export function buildPass6FieldEvidenceAttestation(input: Pass6FieldEvidenceAttestationInput): Pass6FieldEvidenceAttestation {
  const unsigned = { schemaVersion: PASS6_REAL_MARKETS_FIELD_ATTESTATION_ID, ...input };
  return { ...unsigned, attestationDigest: sha256Digest(canonicalJson(unsigned)) };
}

export function verifyPass6FieldEvidenceAttestation(attestation: Pass6FieldEvidenceAttestation) {
  const { attestationDigest, ...unsigned } = attestation;
  return attestation.schemaVersion === PASS6_REAL_MARKETS_FIELD_ATTESTATION_ID
    && SHA256.test(attestationDigest)
    && sha256Digest(canonicalJson(unsigned)) === attestationDigest;
}

function normalizedAssetClass(value: Pass6AssetFieldValidationInput["assetClass"]): Pass6RealMarketsAssetClass {
  if (value === "stock") return "equity";
  if (value === "exchange_token") return "crypto";
  if (ASSET_CLASSES.includes(value as Pass6RealMarketsAssetClass)) return value as Pass6RealMarketsAssetClass;
  throw new Error(`pass6_real_markets_asset_class_unsupported:${String(value)}`);
}

function deduplicatedCanonicalDefinitions(tier: Pass4824DataTier): Pass4824FieldDefinition[] {
  const definitions = getPass4824VisibleFieldDefinitions("real_markets", tier);
  const byId = new Map<string, Pass4824FieldDefinition>();
  for (const definition of definitions) {
    const previous = byId.get(definition.fieldId);
    if (previous && canonicalJson(previous) !== canonicalJson(definition)) {
      throw new Error(`pass6_conflicting_canonical_definition:${definition.fieldId}`);
    }
    byId.set(definition.fieldId, definition);
  }
  return Array.from(byId.values()).sort((left, right) => left.fieldId.localeCompare(right.fieldId));
}

function fieldRequirement(assetClass: Pass6RealMarketsAssetClass, fieldId: string): Pass6FieldRequirement {
  if (fieldId === "identity.instrument_contract") {
    if (assetClass === "commodity" || assetClass === "fx") return "critical";
    if (assetClass === "crypto") return "optional";
    return "not_applicable";
  }
  if (fieldId === "identity.venue") return "critical";
  if (fieldId === "market.volume_24h" && assetClass === "fx") return "not_applicable";
  if (fieldId === "market.liquidity_usd" && assetClass === "fx") return "optional";
  if (fieldId === "fundamentals.quality_score" && !["equity", "etf", "real_estate"].includes(assetClass)) return "not_applicable";
  if (fieldId === "macro.regime" && assetClass === "crypto") return "optional";
  return "critical";
}

function minimumQuorum(tier: Pass4824DataTier, fieldId: string, requirement: Pass6FieldRequirement) {
  if (requirement === "not_applicable") return 0;
  if (fieldId.startsWith("evidence.") || fieldId === "identity.venue" || fieldId === "identity.instrument_contract") {
    return tier === "advanced" ? 2 : 1;
  }
  if (fieldId.startsWith("identity.")) return tier === "basic" ? 1 : 2;
  if (fieldId === "fundamentals.quality_score" || fieldId === "macro.regime") return 2;
  return tier === "basic" ? 1 : tier === "pro" ? 2 : 3;
}

const PRICE_TOLERANCE: Record<Pass6RealMarketsAssetClass, [number, number, number]> = {
  equity: [50, 25, 15],
  fx: [20, 10, 5],
  etf: [50, 30, 20],
  commodity: [75, 50, 30],
  real_estate: [75, 50, 30],
  crypto: [100, 50, 25],
};

function divergenceTolerance(assetClass: Pass6RealMarketsAssetClass, tier: Pass4824DataTier, fieldId: string): Pass6DivergenceTolerance {
  const tierIndex = tier === "basic" ? 0 : tier === "pro" ? 1 : 2;
  if (["market.price", "market.liquidity_usd", "market.orderbook_depth_usd", "market.impact_10k_bps"].includes(fieldId)) {
    return { method: "relative_bps", maximumBps: PRICE_TOLERANCE[assetClass][tierIndex] };
  }
  if (fieldId === "market.volume_24h") {
    const base = assetClass === "crypto" ? 1_500 : assetClass === "commodity" ? 2_000 : 1_000;
    return { method: "relative_bps", maximumBps: Math.max(250, base - tierIndex * 250) };
  }
  if (["market.change_24h", "market.change_1h"].includes(fieldId)) {
    return { method: "absolute_bps", maximumBps: PRICE_TOLERANCE[assetClass][tierIndex] };
  }
  return null;
}

function extensionRule(assetClass: Pass6RealMarketsAssetClass, tier: Pass4824DataTier, fieldId: typeof EXTENSION_FIELDS[number]): Pass6AssetFieldRule {
  const requirement = fieldRequirement(assetClass, fieldId);
  return {
    schemaVersion: PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_ID,
    assetClass,
    tier,
    fieldId,
    definitionSource: "pass6_identity_extension",
    canonicalDefinitionDigest: null,
    requirement,
    unit: fieldId === "identity.venue" ? "venue_id" : "instrument_contract_id",
    currencyPolicy: "forbidden",
    maxAgeSeconds: fieldId === "identity.venue" ? 86_400 : 31_536_000,
    minimumIndependentQuorum: minimumQuorum(tier, fieldId, requirement),
    divergenceTolerance: null,
    fallback: requirement === "critical" ? "blocked" : requirement === "optional" ? "abstain" : "not_applicable",
  };
}

export function getPass6RealMarketsAssetFieldRules(assetClassInput: Pass6AssetFieldValidationInput["assetClass"], tier: Pass4824DataTier) {
  const assetClass = normalizedAssetClass(assetClassInput);
  const canonicalRules = deduplicatedCanonicalDefinitions(tier).map((definition): Pass6AssetFieldRule => {
    const requirement = fieldRequirement(assetClass, definition.fieldId);
    return {
      schemaVersion: PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_ID,
      assetClass,
      tier,
      fieldId: definition.fieldId,
      definitionSource: "pass4824_canonical",
      canonicalDefinitionDigest: sha256Digest(canonicalJson(definition)),
      requirement,
      unit: definition.unit,
      currencyPolicy: definition.currencyPolicy,
      maxAgeSeconds: definition.maxAgeSeconds,
      minimumIndependentQuorum: minimumQuorum(tier, definition.fieldId, requirement),
      divergenceTolerance: divergenceTolerance(assetClass, tier, definition.fieldId),
      fallback: requirement === "critical" ? "blocked" : requirement === "optional" ? "abstain" : "not_applicable",
    };
  });
  return [...canonicalRules, ...EXTENSION_FIELDS.map((fieldId) => extensionRule(assetClass, tier, fieldId))]
    .sort((left, right) => left.fieldId.localeCompare(right.fieldId));
}

export const PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY: readonly Pass6AssetFieldRule[] = Object.freeze(
  ASSET_CLASSES.flatMap((assetClass) => TIERS.flatMap((tier) => getPass6RealMarketsAssetFieldRules(assetClass, tier)))
    .map((rule) => Object.freeze({
      ...rule,
      divergenceTolerance: rule.divergenceTolerance ? Object.freeze({ ...rule.divergenceTolerance }) : null,
    })),
);

export const PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_DIGEST = sha256Digest(canonicalJson(PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY));

export function inspectPass6RealMarketsAssetFieldRegistry() {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const rule of PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY) {
    const key = `${rule.assetClass}:${rule.tier}:${rule.fieldId}`;
    if (keys.has(key)) errors.push(`duplicate_rule:${key}`);
    keys.add(key);
    if (rule.schemaVersion !== PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_ID) errors.push(`schema_invalid:${key}`);
    if (!rule.fieldId.trim() || !rule.unit.trim()) errors.push(`rule_incomplete:${key}`);
    if (!Number.isSafeInteger(rule.maxAgeSeconds) || rule.maxAgeSeconds <= 0) errors.push(`ttl_invalid:${key}`);
    if (!Number.isSafeInteger(rule.minimumIndependentQuorum) || rule.minimumIndependentQuorum < 0) errors.push(`quorum_invalid:${key}`);
    if ((rule.requirement === "critical" && rule.fallback !== "blocked")
      || (rule.requirement === "optional" && rule.fallback !== "abstain")
      || (rule.requirement === "not_applicable" && (rule.fallback !== "not_applicable" || rule.minimumIndependentQuorum !== 0))) {
      errors.push(`fallback_requirement_mismatch:${key}`);
    }
    if (rule.divergenceTolerance && (!Number.isFinite(rule.divergenceTolerance.maximumBps) || rule.divergenceTolerance.maximumBps < 0)) {
      errors.push(`divergence_tolerance_invalid:${key}`);
    }
    if (rule.definitionSource === "pass4824_canonical") {
      const definition = deduplicatedCanonicalDefinitions(rule.tier).find((item) => item.fieldId === rule.fieldId);
      if (!definition || rule.canonicalDefinitionDigest !== sha256Digest(canonicalJson(definition))) errors.push(`canonical_definition_binding_invalid:${key}`);
      if (definition && (rule.unit !== definition.unit || rule.currencyPolicy !== definition.currencyPolicy || rule.maxAgeSeconds !== definition.maxAgeSeconds)) {
        errors.push(`canonical_semantics_duplicated_or_drifted:${key}`);
      }
    } else if (!EXTENSION_FIELDS.includes(rule.fieldId as typeof EXTENSION_FIELDS[number]) || rule.canonicalDefinitionDigest !== null) {
      errors.push(`identity_extension_invalid:${key}`);
    }
  }
  for (const assetClass of ASSET_CLASSES) {
    for (const tier of TIERS) {
      const expected = getPass6RealMarketsAssetFieldRules(assetClass, tier).length;
      const observed = PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY.filter((rule) => rule.assetClass === assetClass && rule.tier === tier).length;
      if (observed !== expected) errors.push(`matrix_count_mismatch:${assetClass}:${tier}:${observed}/${expected}`);
    }
  }
  return {
    schemaVersion: PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_ID,
    status: errors.length === 0 ? "passed" as const : "failed" as const,
    ruleCount: PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY.length,
    uniqueRuleCount: keys.size,
    assetClassCount: ASSET_CLASSES.length,
    tierCount: TIERS.length,
    registryDigest: PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_DIGEST,
    errors: sortedUnique(errors),
  };
}

function extensionValue(input: Pass6AssetFieldValidationInput, fieldId: string) {
  return fieldId === "identity.venue" ? input.identityResolution.venue : input.identityResolution.instrumentContract;
}

function divergenceBps(values: number[], method: NonNullable<Pass6DivergenceTolerance>["method"]): number {
  if (values.length < 2) return 0;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (method === "absolute_bps") return Math.round(Math.abs(maximum - minimum) * 100 * 100) / 100;
  const midpoint = (Math.abs(maximum) + Math.abs(minimum)) / 2;
  if (midpoint === 0) return 0;
  return Math.round((Math.abs(maximum - minimum) / midpoint) * 10_000 * 100) / 100;
}

function sortedUnique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function usableAttestations(args: {
  input: Pass6AssetFieldValidationInput;
  rule: Pass6AssetFieldRule;
  observation: Pass4824FieldObservation | null;
  extension: Pass6IdentityDimension | null;
  evaluatedAtMs: number;
}) {
  const expectedBinding = args.observation?.evidenceDigest
    ?? (args.extension?.state === "exact" ? sha256Digest(canonicalJson(args.extension.value)) : null);
  const observationRefs = new Set(args.observation?.evidenceRefs ?? []);
  const blockers: string[] = [];
  const byRoot = new Map<string, Pass6FieldEvidenceAttestation>();
  for (const evidence of args.input.evidence.filter((item) => item.fieldId === args.rule.fieldId)) {
    const root = evidence.upstreamRoot.trim().toLowerCase();
    const observedAtMs = Date.parse(evidence.observedAt);
    const receivedAtMs = Date.parse(evidence.receivedAt);
    const evidenceBlockers = [
      !verifyPass6FieldEvidenceAttestation(evidence) ? "source_attestation_integrity_invalid" : null,
      !evidence.evidenceRef.trim() ? "evidence_ref_required" : null,
      !evidence.sourceId.trim() || !evidence.sourceFamily.trim() || !root ? "source_identity_required" : null,
      !evidence.commercialEligible ? "source_not_commercially_eligible" : null,
      !evidence.contentBound ? "source_not_content_bound" : null,
      evidence.identityMatch !== "exact" ? `source_identity_${evidence.identityMatch}` : null,
      !Number.isFinite(observedAtMs) || !Number.isFinite(receivedAtMs) ? "source_timestamp_invalid" : null,
      Number.isFinite(observedAtMs) && Number.isFinite(receivedAtMs) && receivedAtMs < observedAtMs ? "source_received_before_observed" : null,
      Number.isFinite(observedAtMs) && observedAtMs > args.evaluatedAtMs + 1_000 ? "source_timestamp_future" : null,
      Number.isFinite(observedAtMs) && args.evaluatedAtMs - observedAtMs > args.rule.maxAgeSeconds * 1_000 ? "source_stale" : null,
      expectedBinding !== evidence.bindingDigest ? "source_binding_digest_mismatch" : null,
      !SHA256.test(evidence.contentDigest) ? "source_content_digest_invalid" : null,
      args.observation && !observationRefs.has(evidence.evidenceRef) ? "source_ref_not_in_observation" : null,
      args.rule.currencyPolicy === "required_iso_4217" && !ISO_CURRENCY.test(evidence.currency ?? "") ? "source_currency_required" : null,
      args.rule.currencyPolicy === "required_iso_4217" && args.observation?.currency !== evidence.currency ? "source_currency_mismatch" : null,
      args.rule.currencyPolicy === "forbidden" && evidence.currency !== null ? "source_currency_forbidden" : null,
    ].filter((value): value is string => Boolean(value));
    if (evidenceBlockers.length > 0) {
      blockers.push(...evidenceBlockers);
      continue;
    }
    const previous = byRoot.get(root);
    if (previous && previous.numericValue !== evidence.numericValue) blockers.push("same_upstream_conflicting_values");
    if (!previous) byRoot.set(root, evidence);
  }
  return { evidence: Array.from(byRoot.values()), blockers: sortedUnique(blockers) };
}

function baseFieldState(requirement: Pass6FieldRequirement): Pass6FieldState {
  return requirement === "critical" ? "blocked" : requirement === "optional" ? "abstained" : "not_applicable";
}

export function buildPass6AssetFieldCompletenessReceipt(input: Pass6AssetFieldValidationInput): Pass6AssetFieldCompletenessReceipt {
  const assetClass = normalizedAssetClass(input.assetClass);
  if (input.packet.module !== "real_markets") throw new Error("pass6_real_markets_packet_module_required");
  if (input.packet.tier !== input.tier) throw new Error("pass6_real_markets_packet_tier_mismatch");
  const evaluatedAtMs = Date.parse(input.evaluatedAt);
  if (!Number.isFinite(evaluatedAtMs)) throw new Error("pass6_real_markets_evaluated_at_invalid");
  const packetClass = normalizedAssetClass(input.packet.identity.assetClass as Pass6AssetFieldValidationInput["assetClass"]);
  const rules = getPass6RealMarketsAssetFieldRules(assetClass, input.tier);
  const baseReceipt = validatePass4824CanonicalFieldPacket(input.packet);
  const packetClassMismatch = packetClass !== assetClass;
  const observations = new Map(input.packet.observations.map((observation) => [observation.fieldId, observation]));
  const identityBlockers = [
    packetClassMismatch ? "packet_asset_class_mismatch" : null,
    input.identityResolution.venue.state === "ambiguous" ? "identity_venue_ambiguous" : null,
    input.identityResolution.instrumentContract.state === "ambiguous" ? "identity_instrument_contract_ambiguous" : null,
  ].filter((value): value is string => Boolean(value));

  const fieldRows = rules.map((rule): Pass6AssetFieldStatus => {
    const blockers: string[] = [];
    const observation = rule.definitionSource === "pass4824_canonical" ? observations.get(rule.fieldId) ?? null : null;
    const extension = rule.definitionSource === "pass6_identity_extension" ? extensionValue(input, rule.fieldId) : null;
    if (rule.requirement === "not_applicable") {
      if (extension?.state === "ambiguous") blockers.push("identity_dimension_ambiguous");
      if (observation && observation.value !== null && observation.availability === "available") blockers.push("not_applicable_field_has_value");
      return {
        fieldId: rule.fieldId,
        requirement: rule.requirement,
        state: blockers.length > 0 ? "blocked" : "not_applicable",
        fallback: rule.fallback,
        unit: rule.unit,
        currencyPolicy: rule.currencyPolicy,
        maxAgeSeconds: rule.maxAgeSeconds,
        minimumIndependentQuorum: 0,
        independentUpstreamCount: 0,
        upstreamRoots: [],
        divergenceBps: null,
        divergenceTolerance: rule.divergenceTolerance,
        blockers: sortedUnique(blockers),
      };
    }
    if (rule.definitionSource === "pass6_identity_extension") {
      if (!extension || extension.state !== "exact" || !extension.value?.trim()) {
        blockers.push(extension?.state === "ambiguous" ? "identity_dimension_ambiguous" : "identity_dimension_missing");
      }
    } else if (!observation) {
      blockers.push("observation_missing");
    } else {
      if (observation.availability !== "available" || observation.value === null) blockers.push("observation_explicit_missing");
      if (observation.provenance.mode === "offline_fixture") blockers.push("offline_fixture_not_commercial");
      const observedAtMs = Date.parse(observation.provenance.observedAt);
      const validUntilMs = Date.parse(observation.validUntil);
      if (!Number.isFinite(observedAtMs) || !Number.isFinite(validUntilMs)) blockers.push("observation_timestamp_invalid");
      else {
        if (observedAtMs > evaluatedAtMs + 1_000) blockers.push("observation_timestamp_future");
        if (evaluatedAtMs - observedAtMs > rule.maxAgeSeconds * 1_000 || validUntilMs < evaluatedAtMs) blockers.push("observation_stale");
      }
      if (rule.currencyPolicy === "required_iso_4217" && !ISO_CURRENCY.test(observation.currency ?? "")) blockers.push("observation_currency_required");
      if (rule.currencyPolicy === "forbidden" && observation.currency !== null) blockers.push("observation_currency_forbidden");
    }
    const usable = usableAttestations({ input, rule, observation, extension, evaluatedAtMs });
    blockers.push(...usable.blockers);
    const roots = sortedUnique(usable.evidence.map((item) => item.upstreamRoot.trim().toLowerCase()));
    if (roots.length < rule.minimumIndependentQuorum) blockers.push(`independent_quorum_shortfall:${roots.length}/${rule.minimumIndependentQuorum}`);
    let measuredDivergence: number | null = null;
    if (rule.divergenceTolerance && roots.length >= rule.minimumIndependentQuorum) {
      const numericValues = usable.evidence.map((item) => item.numericValue);
      if (numericValues.some((value) => value === null || !Number.isFinite(value))) {
        blockers.push("source_numeric_value_required_for_divergence");
      } else {
        measuredDivergence = divergenceBps(numericValues as number[], rule.divergenceTolerance.method);
        if (measuredDivergence > rule.divergenceTolerance.maximumBps) blockers.push(`source_divergence_exceeded:${measuredDivergence}/${rule.divergenceTolerance.maximumBps}`);
      }
    }
    const rowBlockers = sortedUnique(blockers);
    return {
      fieldId: rule.fieldId,
      requirement: rule.requirement,
      state: rowBlockers.length === 0 ? "available" : baseFieldState(rule.requirement),
      fallback: rule.fallback,
      unit: rule.unit,
      currencyPolicy: rule.currencyPolicy,
      maxAgeSeconds: rule.maxAgeSeconds,
      minimumIndependentQuorum: rule.minimumIndependentQuorum,
      independentUpstreamCount: roots.length,
      upstreamRoots: roots,
      divergenceBps: measuredDivergence,
      divergenceTolerance: rule.divergenceTolerance,
      blockers: rowBlockers,
    };
  });

  const criticalRows = fieldRows.filter((row) => row.requirement === "critical");
  const availableCriticalRows = criticalRows.filter((row) => row.state === "available");
  const canonicalValidationErrors = sortedUnique(baseReceipt.errors);
  const semanticContradictionRows = fieldRows.filter((row) => row.requirement === "not_applicable" && row.blockers.length > 0);
  const blockers = sortedUnique([
    ...identityBlockers,
    ...canonicalValidationErrors.map((error) => `canonical:${error}`),
    ...criticalRows.flatMap((row) => row.blockers.map((blocker) => `${row.fieldId}:${blocker}`)),
    ...semanticContradictionRows.flatMap((row) => row.blockers.map((blocker) => `${row.fieldId}:${blocker}`)),
  ]);
  const completenessBps = criticalRows.length === 0 ? 0 : Math.floor((availableCriticalRows.length * 10_000) / criticalRows.length);
  const unsigned: Omit<Pass6AssetFieldCompletenessReceipt, "receiptDigest"> = {
    schemaVersion: PASS6_REAL_MARKETS_COMPLETENESS_RECEIPT_ID,
    registryDigest: PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_DIGEST,
    packetDigest: baseReceipt.packetDigest,
    canonicalValidationStatus: baseReceipt.status,
    canonicalValidationErrors,
    assetClass,
    tier: input.tier,
    evaluatedAt: new Date(evaluatedAtMs).toISOString(),
    identityState: identityBlockers.length === 0 ? "exact" : "blocked",
    fieldRows,
    criticalFieldDenominator: criticalRows.length,
    availableCriticalFieldNumerator: availableCriticalRows.length,
    completenessBps,
    missingCriticalFields: criticalRows.filter((row) => row.blockers.some((blocker) => blocker.includes("missing"))).map((row) => row.fieldId).sort(),
    blockedCriticalFields: criticalRows.filter((row) => row.state !== "available").map((row) => row.fieldId).sort(),
    optionalAbstentions: fieldRows.filter((row) => row.requirement === "optional" && row.state === "abstained").map((row) => row.fieldId).sort(),
    notApplicableFields: fieldRows.filter((row) => row.state === "not_applicable").map((row) => row.fieldId).sort(),
    blockers,
    paidDeliveryEligible: input.tier !== "basic"
      && baseReceipt.status === "passed"
      && identityBlockers.length === 0
      && blockers.length === 0
      && completenessBps === 10_000,
  };
  return { ...unsigned, receiptDigest: sha256Digest(canonicalJson(unsigned)) };
}

function countBy<T extends string>(values: readonly T[]): Record<T, number> {
  return values.reduce((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {} as Record<T, number>);
}

export function buildPass6CatalogCoverageReceipt(input: {
  tier: Pass4824DataTier;
  generatedAt: string;
  observationsByCatalogId?: Readonly<Record<string, Pass6AssetFieldValidationInput>>;
}): Pass6CatalogCoverageReceipt {
  const generatedAtMs = Date.parse(input.generatedAt);
  if (!Number.isFinite(generatedAtMs)) throw new Error("pass6_catalog_coverage_generated_at_invalid");
  if (REAL_MARKETS_CUSTOMER_CATALOG_ROWS.length !== 555 || REAL_MARKETS_CUSTOMER_CATALOG_COUNTS.total !== 555) {
    throw new Error("pass6_catalog_denominator_not_555");
  }
  const rows = REAL_MARKETS_CUSTOMER_CATALOG_ROWS.map((catalogRow): Pass6CatalogCoverageRow => {
    const assetClass = normalizedAssetClass(catalogRow.assetClass);
    const rules = getPass6RealMarketsAssetFieldRules(assetClass, input.tier);
    const criticalRules = rules.filter((rule) => rule.requirement === "critical");
    const notApplicableFields = rules.filter((rule) => rule.requirement === "not_applicable").map((rule) => rule.fieldId).sort();
    if (catalogRow.adapterState === "provider_required") {
      return {
        catalogId: catalogRow.id,
        symbol: catalogRow.symbol,
        assetClass,
        adapterState: catalogRow.adapterState,
        state: "explicit_missing_provider_required",
        criticalFieldDenominator: criticalRules.length,
        availableCriticalFieldNumerator: 0,
        missingCriticalFields: criticalRules.map((rule) => rule.fieldId).sort(),
        notApplicableFields,
        providerAvailabilityClaimed: false,
        paidDeliveryEligible: false,
        blockers: ["catalog_adapter_state_provider_required", ...(input.tier === "basic" ? [] : ["paid_tier_blocked_provider_required"])],
      };
    }
    const runtimeInput = input.observationsByCatalogId?.[catalogRow.id];
    if (!runtimeInput) {
      return {
        catalogId: catalogRow.id,
        symbol: catalogRow.symbol,
        assetClass,
        adapterState: catalogRow.adapterState,
        state: "unverified_provider_state",
        criticalFieldDenominator: criticalRules.length,
        availableCriticalFieldNumerator: 0,
        missingCriticalFields: criticalRules.map((rule) => rule.fieldId).sort(),
        notApplicableFields,
        providerAvailabilityClaimed: false,
        paidDeliveryEligible: false,
        blockers: ["runtime_observation_not_supplied", ...(input.tier === "basic" ? [] : ["paid_tier_blocked_unverified_runtime"])],
      };
    }
    const identityErrors = [
      runtimeInput.packet.identity.symbol.trim().toUpperCase() !== catalogRow.symbol.trim().toUpperCase() ? "catalog_symbol_mismatch" : null,
      normalizedAssetClass(runtimeInput.assetClass) !== assetClass ? "catalog_asset_class_mismatch" : null,
      runtimeInput.tier !== input.tier ? "catalog_tier_mismatch" : null,
    ].filter((value): value is string => Boolean(value));
    const validation = buildPass6AssetFieldCompletenessReceipt(runtimeInput);
    const blocked = identityErrors.length > 0 || !validation.paidDeliveryEligible;
    return {
      catalogId: catalogRow.id,
      symbol: catalogRow.symbol,
      assetClass,
      adapterState: catalogRow.adapterState,
      state: blocked ? "blocked" : "validated",
      criticalFieldDenominator: validation.criticalFieldDenominator,
      availableCriticalFieldNumerator: validation.availableCriticalFieldNumerator,
      missingCriticalFields: validation.blockedCriticalFields,
      notApplicableFields: validation.notApplicableFields,
      providerAvailabilityClaimed: !blocked,
      paidDeliveryEligible: !blocked,
      blockers: sortedUnique([...identityErrors, ...validation.blockers]),
    };
  });
  const criticalFieldCellDenominator = rows.reduce((sum, row) => sum + row.criticalFieldDenominator, 0);
  const availableCriticalFieldCellNumerator = rows.reduce((sum, row) => sum + row.availableCriticalFieldNumerator, 0);
  const providerRequiredRows = rows.filter((row) => row.adapterState === "provider_required");
  const unsigned: Omit<Pass6CatalogCoverageReceipt, "receiptDigest"> = {
    schemaVersion: PASS6_REAL_MARKETS_CATALOG_COVERAGE_RECEIPT_ID,
    generatedAt: new Date(generatedAtMs).toISOString(),
    tier: input.tier,
    catalogSourceSha256: REAL_MARKETS_CUSTOMER_CATALOG_SOURCE_SHA256,
    catalogSha256: REAL_MARKETS_CUSTOMER_CATALOG_SHA256,
    catalogAssetDenominator: rows.length,
    catalogUniqueSymbolDenominator: new Set(rows.map((row) => row.symbol.trim().toUpperCase())).size,
    assetClassCounts: countBy(rows.map((row) => row.assetClass)),
    adapterStateCounts: countBy(rows.map((row) => row.adapterState)),
    providerRequiredAssetCount: providerRequiredRows.length,
    providerRequiredExplicitMissingCount: providerRequiredRows.filter((row) => row.state === "explicit_missing_provider_required").length,
    providerRequiredPaidBlockedCount: providerRequiredRows.filter((row) => !row.paidDeliveryEligible && input.tier !== "basic").length,
    providerAvailabilityClaimedCount: rows.filter((row) => row.providerAvailabilityClaimed).length,
    paidDeliveryEligibleAssetCount: rows.filter((row) => row.paidDeliveryEligible).length,
    criticalFieldCellDenominator,
    availableCriticalFieldCellNumerator,
    completenessBps: criticalFieldCellDenominator === 0 ? 0 : Math.floor((availableCriticalFieldCellNumerator * 10_000) / criticalFieldCellDenominator),
    rows,
    openBlockers: sortedUnique(rows.flatMap((row) => row.blockers)),
    registryDigest: PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_DIGEST,
  };
  return { ...unsigned, receiptDigest: sha256Digest(canonicalJson(unsigned)) };
}

export function verifyPass6AssetFieldCompletenessReceipt(receipt: Pass6AssetFieldCompletenessReceipt) {
  const { receiptDigest, ...unsigned } = receipt;
  if (!SHA256.test(receiptDigest)
    || receipt.registryDigest !== PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_DIGEST
    || sha256Digest(canonicalJson(unsigned)) !== receiptDigest) return false;
  let rules: Pass6AssetFieldRule[];
  try {
    rules = getPass6RealMarketsAssetFieldRules(receipt.assetClass, receipt.tier);
  } catch {
    return false;
  }
  const rulesById = new Map(rules.map((rule) => [rule.fieldId, rule]));
  if (receipt.fieldRows.length !== rules.length || new Set(receipt.fieldRows.map((row) => row.fieldId)).size !== rules.length) return false;
  for (const row of receipt.fieldRows) {
    const rule = rulesById.get(row.fieldId);
    if (!rule
      || row.requirement !== rule.requirement
      || row.fallback !== rule.fallback
      || row.unit !== rule.unit
      || row.currencyPolicy !== rule.currencyPolicy
      || row.maxAgeSeconds !== rule.maxAgeSeconds
      || row.minimumIndependentQuorum !== rule.minimumIndependentQuorum
      || canonicalJson(row.divergenceTolerance) !== canonicalJson(rule.divergenceTolerance)
      || row.independentUpstreamCount !== new Set(row.upstreamRoots).size) return false;
  }
  const criticalRows = receipt.fieldRows.filter((row) => row.requirement === "critical");
  const availableRows = criticalRows.filter((row) => row.state === "available");
  const expectedBps = criticalRows.length === 0 ? 0 : Math.floor((availableRows.length * 10_000) / criticalRows.length);
  const expectedMissing = criticalRows.filter((row) => row.blockers.some((blocker) => blocker.includes("missing"))).map((row) => row.fieldId).sort();
  const expectedBlocked = criticalRows.filter((row) => row.state !== "available").map((row) => row.fieldId).sort();
  const expectedAbstentions = receipt.fieldRows.filter((row) => row.requirement === "optional" && row.state === "abstained").map((row) => row.fieldId).sort();
  const expectedNotApplicable = receipt.fieldRows.filter((row) => row.state === "not_applicable").map((row) => row.fieldId).sort();
  const expectedPaid = receipt.tier !== "basic"
    && receipt.canonicalValidationStatus === "passed"
    && receipt.canonicalValidationErrors.length === 0
    && receipt.identityState === "exact"
    && receipt.blockers.length === 0
    && expectedBps === 10_000;
  return receipt.criticalFieldDenominator === criticalRows.length
    && receipt.availableCriticalFieldNumerator === availableRows.length
    && receipt.completenessBps === expectedBps
    && canonicalJson(receipt.missingCriticalFields) === canonicalJson(expectedMissing)
    && canonicalJson(receipt.blockedCriticalFields) === canonicalJson(expectedBlocked)
    && canonicalJson(receipt.optionalAbstentions) === canonicalJson(expectedAbstentions)
    && canonicalJson(receipt.notApplicableFields) === canonicalJson(expectedNotApplicable)
    && receipt.paidDeliveryEligible === expectedPaid;
}

export function verifyPass6CatalogCoverageReceipt(receipt: Pass6CatalogCoverageReceipt) {
  const { receiptDigest, ...unsigned } = receipt;
  if (!SHA256.test(receiptDigest)
    || receipt.catalogSourceSha256 !== REAL_MARKETS_CUSTOMER_CATALOG_SOURCE_SHA256
    || receipt.catalogSha256 !== REAL_MARKETS_CUSTOMER_CATALOG_SHA256
    || receipt.registryDigest !== PASS6_REAL_MARKETS_ASSET_FIELD_REGISTRY_DIGEST
    || sha256Digest(canonicalJson(unsigned)) !== receiptDigest
    || receipt.rows.length !== REAL_MARKETS_CUSTOMER_CATALOG_ROWS.length
    || receipt.catalogAssetDenominator !== 555
    || receipt.catalogUniqueSymbolDenominator !== 555) return false;
  const catalogById = new Map(REAL_MARKETS_CUSTOMER_CATALOG_ROWS.map((row) => [row.id, row]));
  if (new Set(receipt.rows.map((row) => row.catalogId)).size !== 555) return false;
  for (const row of receipt.rows) {
    const catalogRow = catalogById.get(row.catalogId);
    if (!catalogRow
      || row.symbol !== catalogRow.symbol
      || row.assetClass !== normalizedAssetClass(catalogRow.assetClass)
      || row.adapterState !== catalogRow.adapterState
      || row.availableCriticalFieldNumerator < 0
      || row.availableCriticalFieldNumerator > row.criticalFieldDenominator) return false;
    if (catalogRow.adapterState === "provider_required"
      && (row.state !== "explicit_missing_provider_required" || row.providerAvailabilityClaimed || row.paidDeliveryEligible)) return false;
  }
  const providerRequiredRows = receipt.rows.filter((row) => row.adapterState === "provider_required");
  const expectedDenominator = receipt.rows.reduce((sum, row) => sum + row.criticalFieldDenominator, 0);
  const expectedNumerator = receipt.rows.reduce((sum, row) => sum + row.availableCriticalFieldNumerator, 0);
  const expectedBps = expectedDenominator === 0 ? 0 : Math.floor((expectedNumerator * 10_000) / expectedDenominator);
  return receipt.providerRequiredAssetCount === providerRequiredRows.length
    && receipt.providerRequiredExplicitMissingCount === providerRequiredRows.filter((row) => row.state === "explicit_missing_provider_required").length
    && receipt.providerRequiredPaidBlockedCount === providerRequiredRows.filter((row) => !row.paidDeliveryEligible && receipt.tier !== "basic").length
    && receipt.providerAvailabilityClaimedCount === receipt.rows.filter((row) => row.providerAvailabilityClaimed).length
    && receipt.paidDeliveryEligibleAssetCount === receipt.rows.filter((row) => row.paidDeliveryEligible).length
    && receipt.criticalFieldCellDenominator === expectedDenominator
    && receipt.availableCriticalFieldCellNumerator === expectedNumerator
    && receipt.completenessBps === expectedBps
    && canonicalJson(receipt.assetClassCounts) === canonicalJson(countBy(receipt.rows.map((row) => row.assetClass)))
    && canonicalJson(receipt.adapterStateCounts) === canonicalJson(countBy(receipt.rows.map((row) => row.adapterState)));
}
