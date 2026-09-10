import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";

export const PASS4824_CANONICAL_FIELD_REGISTRY_ID = "pass4824-canonical-field-registry-v1" as const;
export const PASS4824_CANONICAL_FIELD_PACKET_ID = "pass4824-canonical-field-packet-v1" as const;
export const PASS4824_CANONICAL_FIELD_RECEIPT_ID = "pass4824-canonical-field-validation-receipt-v1" as const;
export const PASS4824_FIELD_DEFINITION_ID = "pass4824-field-definition-v1" as const;
export const PASS4824_FIELD_OBSERVATION_ID = "pass4824-field-observation-v1" as const;

export type Pass4824DataModule = "shield" | "real_markets" | "audit" | "lens";
export type Pass4824DataTier = "basic" | "pro" | "advanced";
export type Pass4824FieldValueKind = "string" | "number" | "integer" | "timestamp" | "string_array" | "record";
export type Pass4824FieldMode =
  | "provider_observation"
  | "derived_from_observations"
  | "durable_snapshot"
  | "manual_review"
  | "offline_fixture"
  | "explicit_missing";
export type Pass4824FreshnessClass = "request_time" | "intraday" | "daily" | "event_bound" | "immutable";
export type Pass4824Availability = "available" | "explicit_missing" | "not_applicable" | "blocked";

export type Pass4824CanonicalIdentity = {
  canonicalId: string;
  symbol: string;
  assetClass: string;
  chainId: string | null;
  contractAddress: string | null;
};

export type Pass4824FieldDefinition = {
  schemaVersion: typeof PASS4824_FIELD_DEFINITION_ID;
  fieldId: string;
  modules: readonly Pass4824DataModule[];
  minimumTier: Pass4824DataTier;
  valueKind: Pass4824FieldValueKind;
  unit: string;
  nullPolicy: "forbid" | "explicit_missing";
  zeroPolicy: "valid" | "forbidden" | "not_numeric";
  freshnessClass: Pass4824FreshnessClass;
  maxAgeSeconds: number;
  numericRange: { min: number; max: number } | null;
  scale: "linear" | "categorical" | "timestamp" | "structured";
  currencyPolicy: "required_iso_4217" | "forbidden";
  normalizationRule: string;
  availabilityStates: readonly Pass4824Availability[];
  confidenceMethodPolicy: string;
  qualityMethodPolicy: string;
  evidenceRefPolicy: "one_or_more_content_refs";
  lineagePolicy: "source_ids_and_formula_when_derived";
  algorithmVersion: "pass4824-canonical-normalizer-v1";
  digestImpactPolicy: "all_field_semantics_and_lineage_included";
  owner: "velmere-data-contract";
  contractVersion: "pass4824.1";
  compatibilityPolicy: "additive_minor_breaking_major";
  allowedModes: readonly Pass4824FieldMode[];
  semantic: string;
};

export type Pass4824FieldProvenance = {
  mode: Pass4824FieldMode;
  sourceId: string;
  sourceFamily: string;
  adapterId: string;
  fixtureId: string | null;
  requestedIdentity: string;
  resolvedIdentity: string;
  identityMatch: "exact" | "mismatch";
  observedAt: string;
  receivedAt: string;
  derivationDigest: string | null;
};

export type Pass4824FieldObservation = {
  schemaVersion: typeof PASS4824_FIELD_OBSERVATION_ID;
  fieldId: string;
  availability: Pass4824Availability;
  rawValue: unknown;
  value: unknown;
  unit: string;
  scale: Pass4824FieldDefinition["scale"];
  currency: string | null;
  normalizationRule: string;
  missingReason: string | null;
  provenance: Pass4824FieldProvenance;
  fetchedAt: string;
  validUntil: string;
  confidence: { score: number; method: string };
  quality: { score: number; method: string };
  evidenceRefs: string[];
  lineage: {
    sourceObservationIds: string[];
    formula: string | null;
    algorithmVersion: string;
  };
  digestImpact: "included";
  contract: {
    owner: "velmere-data-contract";
    version: "pass4824.1";
    compatibilityPolicy: "additive_minor_breaking_major";
  };
  evidenceDigest: string;
};

export type Pass4824FieldObservationInput = Pick<
  Pass4824FieldObservation,
  "fieldId" | "value" | "unit" | "missingReason" | "provenance"
> & {
  rawValue?: unknown;
  currency?: string | null;
  confidence?: Pass4824FieldObservation["confidence"];
  quality?: Pass4824FieldObservation["quality"];
  evidenceRefs?: string[];
  lineage?: Partial<Pass4824FieldObservation["lineage"]>;
};

export type Pass4824CanonicalFieldPacket = {
  schemaVersion: typeof PASS4824_CANONICAL_FIELD_PACKET_ID;
  caseId: string;
  module: Pass4824DataModule;
  tier: Pass4824DataTier;
  identity: Pass4824CanonicalIdentity;
  generatedAt: string;
  observations: Pass4824FieldObservation[];
};

export type Pass4824FieldValidationReceipt = {
  schemaVersion: typeof PASS4824_CANONICAL_FIELD_RECEIPT_ID;
  caseId: string;
  module: Pass4824DataModule;
  tier: Pass4824DataTier;
  status: "passed" | "failed";
  packetDigest: string;
  identityDigest: string;
  registryDigest: string;
  expectedFieldCount: number;
  observedFieldCount: number;
  checkedEvidenceDigestCount: number;
  checkedContractMetadataCount: number;
  oldestObservationAgeSeconds: number | null;
  modeCounts: Record<Pass4824FieldMode, number>;
  nullFields: string[];
  zeroFields: string[];
  missingReasonFields: string[];
  tierLeakageFields: string[];
  duplicateFields: string[];
  errors: string[];
};

const ALL_MODULES: readonly Pass4824DataModule[] = ["shield", "real_markets", "audit", "lens"];
const MARKET_MODULES: readonly Pass4824DataModule[] = ["shield", "real_markets"];
const ALL_MODES: readonly Pass4824FieldMode[] = [
  "provider_observation",
  "derived_from_observations",
  "durable_snapshot",
  "manual_review",
  "offline_fixture",
  "explicit_missing",
];

function field(
  fieldId: string,
  modules: readonly Pass4824DataModule[],
  minimumTier: Pass4824DataTier,
  valueKind: Pass4824FieldValueKind,
  unit: string,
  semantic: string,
  options: Partial<Pick<Pass4824FieldDefinition, "nullPolicy" | "zeroPolicy" | "freshnessClass" | "maxAgeSeconds" | "numericRange" | "allowedModes">> = {},
): Pass4824FieldDefinition {
  return {
    schemaVersion: PASS4824_FIELD_DEFINITION_ID,
    fieldId,
    modules,
    minimumTier,
    valueKind,
    unit,
    nullPolicy: options.nullPolicy ?? "forbid",
    zeroPolicy: options.zeroPolicy ?? (valueKind === "number" || valueKind === "integer" ? "valid" : "not_numeric"),
    freshnessClass: options.freshnessClass ?? "intraday",
    maxAgeSeconds: options.maxAgeSeconds ?? 3_600,
    numericRange: options.numericRange ?? null,
    scale: valueKind === "number" || valueKind === "integer" ? "linear" : valueKind === "timestamp" ? "timestamp" : valueKind === "record" || valueKind === "string_array" ? "structured" : "categorical",
    currencyPolicy: unit === "quote_currency" || unit === "usd" ? "required_iso_4217" : "forbidden",
    normalizationRule: valueKind === "string" ? "unicode_nfkc_trim_collapse_whitespace" : valueKind === "number" ? "finite_number_preserve_zero" : valueKind === "integer" ? "safe_integer_preserve_zero" : valueKind === "timestamp" ? "iso8601_utc" : valueKind === "string_array" ? "trim_dedupe_preserve_order" : "canonical_json_sorted_keys",
    availabilityStates: options.nullPolicy === "explicit_missing" ? ["available", "explicit_missing", "blocked"] : ["available", "blocked"],
    confidenceMethodPolicy: "named_method_with_score_0_100",
    qualityMethodPolicy: "named_method_with_score_0_100",
    evidenceRefPolicy: "one_or_more_content_refs",
    lineagePolicy: "source_ids_and_formula_when_derived",
    algorithmVersion: "pass4824-canonical-normalizer-v1",
    digestImpactPolicy: "all_field_semantics_and_lineage_included",
    owner: "velmere-data-contract",
    contractVersion: "pass4824.1",
    compatibilityPolicy: "additive_minor_breaking_major",
    allowedModes: options.allowedModes ?? ALL_MODES,
    semantic,
  };
}

/**
 * One registry owns field names, units, tier visibility and missing-value rules.
 * Repeated semantic fields are shared across modules instead of being copied into
 * Shield, Real Markets, Audit and Lens-specific registries.
 */
export const PASS4824_CANONICAL_FIELD_REGISTRY: readonly Pass4824FieldDefinition[] = Object.freeze([
  field("identity.canonical_id", ALL_MODULES, "basic", "string", "canonical_id", "Exact, namespace-qualified subject identifier.", { freshnessClass: "immutable", maxAgeSeconds: 31_536_000 }),
  field("identity.symbol", ALL_MODULES, "basic", "string", "symbol", "Customer-visible symbol bound to the exact canonical identity.", { freshnessClass: "immutable", maxAgeSeconds: 31_536_000 }),
  field("identity.asset_class", ALL_MODULES, "basic", "string", "asset_class", "Normalized asset or target class.", { freshnessClass: "immutable", maxAgeSeconds: 31_536_000 }),
  field("risk.score", ALL_MODULES, "basic", "number", "score_0_100", "Evidence-bound risk score; null means explicitly unavailable.", { nullPolicy: "explicit_missing", numericRange: { min: 0, max: 100 } }),
  field("risk.confidence", ALL_MODULES, "basic", "number", "percent_0_100", "Confidence capped by available evidence.", { zeroPolicy: "valid", numericRange: { min: 0, max: 100 } }),
  field("evidence.missing", ALL_MODULES, "basic", "string_array", "reason_list", "Visible list of evidence gaps; an empty array means no gap was found in this packet."),
  field("evidence.gap_count", ALL_MODULES, "basic", "integer", "count", "Exact count of visible missing-evidence rows; zero is data, not missing.", { zeroPolicy: "valid", numericRange: { min: 0, max: 10_000 } }),
  field("evidence.primary_gap", ALL_MODULES, "basic", "string", "reason", "Highest-priority gap or an explicit null with a reason.", { nullPolicy: "explicit_missing" }),

  field("market.price", MARKET_MODULES, "basic", "number", "quote_currency", "Observed market price in the packet quote currency.", { nullPolicy: "explicit_missing", zeroPolicy: "forbidden", freshnessClass: "request_time", maxAgeSeconds: 300, numericRange: { min: 0, max: Number.MAX_SAFE_INTEGER } }),
  field("market.change_24h", MARKET_MODULES, "basic", "number", "percent", "Twenty-four-hour change; exactly zero is valid and absent provider evidence is explicit.", { nullPolicy: "explicit_missing", zeroPolicy: "valid", freshnessClass: "request_time", maxAgeSeconds: 300, numericRange: { min: -100, max: 1_000_000 } }),
  field("identity.chain_id", ["audit"], "basic", "string", "chain_id", "Exact chain namespace for the audited target.", { freshnessClass: "immutable", maxAgeSeconds: 31_536_000 }),
  field("identity.contract_address", ["audit"], "basic", "string", "address", "Normalized exact contract address.", { freshnessClass: "immutable", maxAgeSeconds: 31_536_000 }),
  field("lens.query", ["lens"], "basic", "string", "query", "Normalized search question bound to this Lens result.", { freshnessClass: "event_bound", maxAgeSeconds: 86_400 }),
  field("lens.summary", ["lens"], "basic", "string", "text", "Source-bounded short result summary.", { freshnessClass: "event_bound", maxAgeSeconds: 86_400 }),

  field("market.volume_24h", MARKET_MODULES, "pro", "number", "quote_currency", "Observed twenty-four-hour volume; never inferred from a missing response.", { nullPolicy: "explicit_missing", zeroPolicy: "valid", freshnessClass: "request_time", maxAgeSeconds: 300, numericRange: { min: 0, max: Number.MAX_SAFE_INTEGER } }),
  field("market.change_1h", MARKET_MODULES, "pro", "number", "percent", "One-hour change from the same identity and quote basis; absence remains explicit.", { nullPolicy: "explicit_missing", zeroPolicy: "valid", freshnessClass: "request_time", maxAgeSeconds: 300, numericRange: { min: -100, max: 1_000_000 } }),
  field("source.second_source_divergence_bps", MARKET_MODULES, "pro", "number", "basis_points", "Comparable second-source divergence; null when sources are not comparable.", { nullPolicy: "explicit_missing", zeroPolicy: "valid", freshnessClass: "request_time", maxAgeSeconds: 300, numericRange: { min: 0, max: 1_000_000 } }),
  field("market.liquidity_usd", MARKET_MODULES, "pro", "number", "usd", "Executable or pool liquidity evidence; null is explicit, never silently converted to zero.", { nullPolicy: "explicit_missing", zeroPolicy: "valid", freshnessClass: "request_time", maxAgeSeconds: 300, numericRange: { min: 0, max: Number.MAX_SAFE_INTEGER } }),
  field("audit.permission_summary", ["audit"], "pro", "record", "structured_record", "Customer-safe permission and upgradeability summary."),
  field("audit.liquidity_evidence", ["audit"], "pro", "record", "structured_record", "Liquidity evidence with explicit source and limitation."),
  field("audit.holder_evidence", ["audit"], "pro", "record", "structured_record", "Holder-distribution evidence without unsupported identity claims."),
  field("source.independent_quorum", ["audit", "lens"], "pro", "integer", "independent_source_count", "Count of independent content-bound upstream roots.", { zeroPolicy: "valid", numericRange: { min: 0, max: 1_000 } }),
  field("lens.source_comparison", ["lens"], "pro", "record", "structured_record", "Comparable source values, timestamps and divergence state."),
  field("lens.claim_atoms", ["lens"], "pro", "string_array", "claim_id_list", "Atomic customer claims that can each be traced to evidence."),
  field("lens.freshness_summary", ["lens"], "pro", "record", "structured_record", "Per-source age and freshness classification."),

  field("market.impact_10k_bps", MARKET_MODULES, "advanced", "number", "basis_points", "Scenario impact for a fixed notional; null when depth evidence is missing.", { nullPolicy: "explicit_missing", zeroPolicy: "valid", freshnessClass: "request_time", maxAgeSeconds: 300, numericRange: { min: 0, max: 1_000_000 } }),
  field("market.orderbook_depth_usd", MARKET_MODULES, "advanced", "number", "usd", "Source-bound executable depth, not reported volume.", { nullPolicy: "explicit_missing", zeroPolicy: "valid", freshnessClass: "request_time", maxAgeSeconds: 300, numericRange: { min: 0, max: Number.MAX_SAFE_INTEGER } }),
  field("scenario.stress_loss_percent", MARKET_MODULES, "advanced", "number", "percent", "Deterministic stress result with a named scenario and evidence window; never invented when the scenario cannot execute.", { nullPolicy: "explicit_missing", zeroPolicy: "valid", numericRange: { min: 0, max: 100 } }),
  field("evidence.claim_ledger", ALL_MODULES, "advanced", "record", "structured_record", "Claim-to-source ledger with explicit blocked claims."),
  field("holder.concentration_percent", ["shield"], "advanced", "number", "percent", "Holder concentration only when address and supply scope are known.", { nullPolicy: "explicit_missing", zeroPolicy: "valid", numericRange: { min: 0, max: 100 } }),
  field("contract.permission_risk", ["shield"], "advanced", "record", "structured_record", "Contract permission evidence and unresolved controls."),
  field("fundamentals.quality_score", ["real_markets"], "advanced", "number", "score_0_100", "Quality score bound to issuer/fund filing periods.", { nullPolicy: "explicit_missing", zeroPolicy: "valid", freshnessClass: "daily", maxAgeSeconds: 86_400, numericRange: { min: 0, max: 100 } }),
  field("macro.regime", ["real_markets"], "advanced", "string", "regime", "Named macro regime with a bounded observation window; missing macro evidence remains explicit.", { nullPolicy: "explicit_missing", freshnessClass: "daily", maxAgeSeconds: 86_400 }),
  field("audit.manual_review_state", ["audit"], "advanced", "string", "review_state", "Verified human-review state; payment alone cannot set this field.", { allowedModes: ["manual_review", "offline_fixture", "explicit_missing"] }),
  field("audit.monitoring_state", ["audit"], "advanced", "string", "monitoring_state", "Post-delivery monitoring configuration and current state."),
  field("audit.revalidation_plan", ["audit"], "advanced", "string_array", "action_list", "Versioned revalidation actions after material changes."),
  field("audit.finding_evidence_graph", ["audit"], "advanced", "record", "structured_record", "Finding-to-receipt graph with contradictory evidence retained."),
  field("audit.false_positive_review", ["audit"], "advanced", "record", "structured_record", "False-positive disposition with reviewer evidence."),
  field("lens.orderbook_context", ["lens"], "advanced", "record", "structured_record", "Order-book context or a visible evidence lock."),
  field("lens.holder_context", ["lens"], "advanced", "record", "structured_record", "Holder context or a visible evidence lock."),
  field("lens.unlock_context", ["lens"], "advanced", "record", "structured_record", "Unlock context or a visible evidence lock."),
  field("lens.contract_context", ["lens"], "advanced", "record", "structured_record", "Contract context or a visible evidence lock."),
  field("lens.scenario_analysis", ["lens"], "advanced", "record", "structured_record", "Named scenarios with assumptions, limits and source bindings."),
]);

const TIER_RANK: Record<Pass4824DataTier, number> = { basic: 0, pro: 1, advanced: 2 };

function emptyModeCounts(): Record<Pass4824FieldMode, number> {
  return {
    provider_observation: 0,
    derived_from_observations: 0,
    durable_snapshot: 0,
    manual_review: 0,
    offline_fixture: 0,
    explicit_missing: 0,
  };
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
}

function cleanIdentityPart(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function packetIdentityFieldValue(identity: Pass4824CanonicalIdentity, fieldId: string): string | null | undefined {
  if (fieldId === "identity.canonical_id") return identity.canonicalId;
  if (fieldId === "identity.symbol") return identity.symbol;
  if (fieldId === "identity.asset_class") return identity.assetClass;
  if (fieldId === "identity.chain_id") return identity.chainId;
  if (fieldId === "identity.contract_address") return identity.contractAddress;
  return undefined;
}

function hasExactKeys(value: unknown, expected: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function observationSeed(observation: Omit<Pass4824FieldObservation, "evidenceDigest">) {
  return {
    schemaVersion: observation.schemaVersion,
    fieldId: observation.fieldId,
    availability: observation.availability,
    rawValue: observation.rawValue,
    value: observation.value,
    unit: observation.unit,
    scale: observation.scale,
    currency: observation.currency,
    normalizationRule: observation.normalizationRule,
    missingReason: observation.missingReason,
    provenance: observation.provenance,
    fetchedAt: observation.fetchedAt,
    validUntil: observation.validUntil,
    confidence: observation.confidence,
    quality: observation.quality,
    evidenceRefs: observation.evidenceRefs,
    lineage: observation.lineage,
    digestImpact: observation.digestImpact,
    contract: observation.contract,
  };
}

export function buildPass4824FieldObservation(
  input: Pass4824FieldObservationInput,
): Pass4824FieldObservation {
  const definition = PASS4824_CANONICAL_FIELD_REGISTRY.find((item) => item.fieldId === input.fieldId);
  if (!definition) throw new Error(`pass4824_field_definition_missing:${input.fieldId}`);
  const observedAtMs = Date.parse(input.provenance.observedAt);
  const validUntil = Number.isFinite(observedAtMs)
    ? new Date(observedAtMs + definition.maxAgeSeconds * 1_000).toISOString()
    : input.provenance.observedAt;
  const availability: Pass4824Availability = input.value === null ? "explicit_missing" : "available";
  const observation: Omit<Pass4824FieldObservation, "evidenceDigest"> = {
    schemaVersion: PASS4824_FIELD_OBSERVATION_ID,
    fieldId: input.fieldId,
    availability,
    rawValue: typeof input.rawValue === "undefined" ? input.value : input.rawValue,
    value: input.value,
    unit: input.unit,
    scale: definition.scale,
    currency: typeof input.currency === "undefined" ? definition.currencyPolicy === "required_iso_4217" ? "USD" : null : input.currency,
    normalizationRule: definition.normalizationRule,
    missingReason: input.missingReason,
    provenance: input.provenance,
    fetchedAt: input.provenance.receivedAt,
    validUntil,
    confidence: input.confidence ?? { score: input.provenance.mode === "offline_fixture" ? 0 : 80, method: input.provenance.mode === "offline_fixture" ? "offline_fixture_not_provider_confidence" : "adapter_declared_confidence" },
    quality: input.quality ?? { score: input.provenance.mode === "offline_fixture" ? 0 : 80, method: input.provenance.mode === "offline_fixture" ? "offline_fixture_not_provider_quality" : "adapter_contract_quality" },
    evidenceRefs: input.evidenceRefs ?? [input.provenance.fixtureId ?? input.provenance.sourceId],
    lineage: {
      sourceObservationIds: input.lineage?.sourceObservationIds ?? [input.provenance.sourceId],
      formula: typeof input.lineage?.formula === "undefined"
        ? input.provenance.mode === "derived_from_observations" ? "adapter_declared_formula" : null
        : input.lineage.formula,
      algorithmVersion: input.lineage?.algorithmVersion ?? definition.algorithmVersion,
    },
    digestImpact: "included",
    contract: { owner: definition.owner, version: definition.contractVersion, compatibilityPolicy: definition.compatibilityPolicy },
  };
  return { ...observation, evidenceDigest: sha256Digest(canonicalJson(observationSeed(observation))) };
}

export function getPass4824VisibleFieldDefinitions(module: Pass4824DataModule, tier: Pass4824DataTier) {
  return PASS4824_CANONICAL_FIELD_REGISTRY
    .filter((definition) => definition.modules.includes(module) && TIER_RANK[definition.minimumTier] <= TIER_RANK[tier])
    .sort((left, right) => left.fieldId.localeCompare(right.fieldId));
}

function valueMatchesKind(value: unknown, kind: Pass4824FieldValueKind) {
  if (kind === "string") return typeof value === "string" && value.trim().length > 0;
  if (kind === "number") return typeof value === "number" && Number.isFinite(value);
  if (kind === "integer") return Number.isSafeInteger(value);
  if (kind === "timestamp") return typeof value === "string" && Number.isFinite(Date.parse(value));
  if (kind === "string_array") return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validatePass4824CanonicalFieldPacket(packet: Pass4824CanonicalFieldPacket): Pass4824FieldValidationReceipt {
  const errors: string[] = [];
  const tierLeakageFields: string[] = [];
  const duplicateFields: string[] = [];
  const nullFields: string[] = [];
  const zeroFields: string[] = [];
  const missingReasonFields: string[] = [];
  const modeCounts = emptyModeCounts();
  const generatedAtMs = Date.parse(packet.generatedAt);
  const identity = packet.identity;
  const expected = getPass4824VisibleFieldDefinitions(packet.module, packet.tier);
  const expectedById = new Map(expected.map((definition) => [definition.fieldId, definition]));
  const allForModule = new Map(
    PASS4824_CANONICAL_FIELD_REGISTRY
      .filter((definition) => definition.modules.includes(packet.module))
      .map((definition) => [definition.fieldId, definition]),
  );
  const seen = new Set<string>();
  let checkedEvidenceDigestCount = 0;
  let checkedContractMetadataCount = 0;
  let oldestObservationAgeSeconds: number | null = null;

  if (packet.schemaVersion !== PASS4824_CANONICAL_FIELD_PACKET_ID) errors.push("packet_schema_invalid");
  if (!hasExactKeys(packet, ["schemaVersion", "caseId", "module", "tier", "identity", "generatedAt", "observations"])) errors.push("packet_shape_invalid");
  if (!packet.caseId.trim()) errors.push("case_id_required");
  if (!Number.isFinite(generatedAtMs)) errors.push("generated_at_invalid");
  if (!hasExactKeys(identity, ["canonicalId", "symbol", "assetClass", "chainId", "contractAddress"])) errors.push("identity_shape_invalid");
  if (!identity.canonicalId.trim() || !identity.symbol.trim() || !identity.assetClass.trim()) errors.push("canonical_identity_incomplete");
  if (packet.module === "audit" && (!identity.chainId || !identity.contractAddress)) errors.push("audit_chain_address_required");
  if (packet.module === "audit" && identity.contractAddress && !/^0x[a-f0-9]{40}$/i.test(identity.contractAddress)) errors.push("audit_contract_address_invalid");

  for (const observation of packet.observations) {
    if (!hasExactKeys(observation, ["schemaVersion", "fieldId", "availability", "rawValue", "value", "unit", "scale", "currency", "normalizationRule", "missingReason", "provenance", "fetchedAt", "validUntil", "confidence", "quality", "evidenceRefs", "lineage", "digestImpact", "contract", "evidenceDigest"])) errors.push(`observation_shape_invalid:${observation.fieldId}`);
    if (!hasExactKeys(observation.provenance, ["mode", "sourceId", "sourceFamily", "adapterId", "fixtureId", "requestedIdentity", "resolvedIdentity", "identityMatch", "observedAt", "receivedAt", "derivationDigest"])) errors.push(`provenance_shape_invalid:${observation.fieldId}`);
    if (seen.has(observation.fieldId)) duplicateFields.push(observation.fieldId);
    seen.add(observation.fieldId);
    const definition = expectedById.get(observation.fieldId);
    if (!definition) {
      if (allForModule.has(observation.fieldId)) tierLeakageFields.push(observation.fieldId);
      else errors.push(`unknown_field:${observation.fieldId}`);
      continue;
    }
    const observationErrorCountBefore = errors.length;
    if (observation.schemaVersion !== PASS4824_FIELD_OBSERVATION_ID) errors.push(`observation_schema_invalid:${observation.fieldId}`);
    modeCounts[observation.provenance.mode] += 1;
    if (observation.value === null) nullFields.push(observation.fieldId);
    if (observation.value === 0) zeroFields.push(observation.fieldId);
    if (observation.missingReason) missingReasonFields.push(observation.fieldId);
    if (observation.unit !== definition.unit) errors.push(`unit_mismatch:${observation.fieldId}`);
    if (observation.scale !== definition.scale) errors.push(`scale_mismatch:${observation.fieldId}`);
    if (observation.normalizationRule !== definition.normalizationRule) errors.push(`normalization_rule_mismatch:${observation.fieldId}`);
    if (definition.currencyPolicy === "required_iso_4217" && !/^[A-Z]{3}$/.test(observation.currency ?? "")) errors.push(`currency_required:${observation.fieldId}`);
    if (definition.currencyPolicy === "forbidden" && observation.currency !== null) errors.push(`currency_forbidden:${observation.fieldId}`);
    if (!definition.availabilityStates.includes(observation.availability)) errors.push(`availability_forbidden:${observation.fieldId}`);
    if (!definition.allowedModes.includes(observation.provenance.mode)) errors.push(`mode_forbidden:${observation.fieldId}`);
    if (observation.value === null) {
      if (observation.availability !== "explicit_missing") errors.push(`availability_missing_mismatch:${observation.fieldId}`);
      if (definition.nullPolicy !== "explicit_missing") errors.push(`null_forbidden:${observation.fieldId}`);
      if (observation.provenance.mode !== "explicit_missing") errors.push(`null_mode_not_explicit_missing:${observation.fieldId}`);
      if (!observation.missingReason?.trim()) errors.push(`missing_reason_required:${observation.fieldId}`);
    } else {
      if (observation.availability !== "available") errors.push(`availability_value_mismatch:${observation.fieldId}`);
      if (!valueMatchesKind(observation.value, definition.valueKind)) errors.push(`value_kind_mismatch:${observation.fieldId}`);
      if (observation.missingReason !== null) errors.push(`unexpected_missing_reason:${observation.fieldId}`);
    }
    if (observation.provenance.mode === "offline_fixture" && canonicalJson(observation.rawValue) !== canonicalJson(observation.value)) {
      errors.push(`fixture_raw_normalized_mismatch:${observation.fieldId}`);
    }
    if (!hasExactKeys(observation.confidence, ["score", "method"]) || !Number.isFinite(observation.confidence.score)
      || observation.confidence.score < 0 || observation.confidence.score > 100 || !observation.confidence.method.trim()) {
      errors.push(`confidence_contract_invalid:${observation.fieldId}`);
    }
    if (!hasExactKeys(observation.quality, ["score", "method"]) || !Number.isFinite(observation.quality.score)
      || observation.quality.score < 0 || observation.quality.score > 100 || !observation.quality.method.trim()) {
      errors.push(`quality_contract_invalid:${observation.fieldId}`);
    }
    if (!Array.isArray(observation.evidenceRefs) || observation.evidenceRefs.length === 0
      || observation.evidenceRefs.some((reference) => typeof reference !== "string" || !reference.trim())) {
      errors.push(`evidence_refs_invalid:${observation.fieldId}`);
    }
    if (!hasExactKeys(observation.lineage, ["sourceObservationIds", "formula", "algorithmVersion"])
      || observation.lineage.sourceObservationIds.length === 0
      || observation.lineage.sourceObservationIds.some((sourceId) => !sourceId.trim())
      || observation.lineage.algorithmVersion !== definition.algorithmVersion) {
      errors.push(`lineage_contract_invalid:${observation.fieldId}`);
    }
    if (observation.provenance.mode === "derived_from_observations" && !observation.lineage.formula?.trim()) {
      errors.push(`derived_formula_required:${observation.fieldId}`);
    }
    if (observation.digestImpact !== "included") errors.push(`digest_impact_invalid:${observation.fieldId}`);
    if (!hasExactKeys(observation.contract, ["owner", "version", "compatibilityPolicy"])
      || observation.contract.owner !== definition.owner
      || observation.contract.version !== definition.contractVersion
      || observation.contract.compatibilityPolicy !== definition.compatibilityPolicy) {
      errors.push(`field_contract_mismatch:${observation.fieldId}`);
    }
    if (observation.value === 0 && definition.zeroPolicy === "forbidden") errors.push(`zero_forbidden:${observation.fieldId}`);
    if (typeof observation.value === "number" && definition.numericRange
      && (observation.value < definition.numericRange.min || observation.value > definition.numericRange.max)) {
      errors.push(`numeric_range_violation:${observation.fieldId}`);
    }
    if (observation.provenance.identityMatch !== "exact") errors.push(`identity_not_exact:${observation.fieldId}`);
    if (cleanIdentityPart(observation.provenance.requestedIdentity) !== cleanIdentityPart(identity.canonicalId)
      || cleanIdentityPart(observation.provenance.resolvedIdentity) !== cleanIdentityPart(identity.canonicalId)) {
      errors.push(`identity_binding_mismatch:${observation.fieldId}`);
    }
    const packetIdentityValue = packetIdentityFieldValue(identity, observation.fieldId);
    if (packetIdentityValue !== undefined) {
      if (cleanIdentityPart(observation.value) !== cleanIdentityPart(packetIdentityValue)) {
        errors.push(`identity_observation_value_mismatch:${observation.fieldId}`);
      }
      if (cleanIdentityPart(observation.rawValue) !== cleanIdentityPart(packetIdentityValue)) {
        errors.push(`identity_observation_raw_value_mismatch:${observation.fieldId}`);
      }
    }
    if (!observation.provenance.sourceId.trim() || !observation.provenance.sourceFamily.trim() || !observation.provenance.adapterId.trim()) {
      errors.push(`provenance_incomplete:${observation.fieldId}`);
    }
    if (observation.provenance.mode === "offline_fixture") {
      if (!observation.provenance.fixtureId?.startsWith("pass4824:")) errors.push(`fixture_id_missing:${observation.fieldId}`);
      if (observation.provenance.sourceFamily !== "offline_fixture") errors.push(`fixture_source_family_invalid:${observation.fieldId}`);
    }
    if (observation.provenance.mode !== "offline_fixture" && observation.provenance.fixtureId && !observation.provenance.fixtureId.startsWith("pass4824:")) {
      errors.push(`fixture_id_invalid:${observation.fieldId}`);
    }
    const observedAtMs = Date.parse(observation.provenance.observedAt);
    const receivedAtMs = Date.parse(observation.provenance.receivedAt);
    const fetchedAtMs = Date.parse(observation.fetchedAt);
    const validUntilMs = Date.parse(observation.validUntil);
    if (!Number.isFinite(observedAtMs) || !Number.isFinite(receivedAtMs) || !Number.isFinite(fetchedAtMs) || !Number.isFinite(validUntilMs)) {
      errors.push(`provenance_timestamp_invalid:${observation.fieldId}`);
    } else if (Number.isFinite(generatedAtMs)) {
      if (receivedAtMs < observedAtMs) errors.push(`received_before_observed:${observation.fieldId}`);
      if (fetchedAtMs !== receivedAtMs) errors.push(`fetched_received_mismatch:${observation.fieldId}`);
      if (receivedAtMs > generatedAtMs + 1_000) errors.push(`received_after_packet:${observation.fieldId}`);
      const ageSeconds = Math.max(0, Math.round((generatedAtMs - observedAtMs) / 1_000));
      oldestObservationAgeSeconds = Math.max(oldestObservationAgeSeconds ?? 0, ageSeconds);
      if (observedAtMs > generatedAtMs + 1_000) errors.push(`observation_from_future:${observation.fieldId}`);
      if (ageSeconds > definition.maxAgeSeconds) errors.push(`observation_stale:${observation.fieldId}`);
      const expectedValidUntilMs = observedAtMs + definition.maxAgeSeconds * 1_000;
      if (validUntilMs !== expectedValidUntilMs) errors.push(`valid_until_mismatch:${observation.fieldId}`);
      if (validUntilMs < generatedAtMs) errors.push(`observation_expired:${observation.fieldId}`);
    }
    const expectedDigest = sha256Digest(canonicalJson(observationSeed(observation)));
    if (!validDigest(observation.evidenceDigest) || expectedDigest !== observation.evidenceDigest) {
      errors.push(`evidence_digest_mismatch:${observation.fieldId}`);
    } else {
      checkedEvidenceDigestCount += 1;
    }
    if (errors.length === observationErrorCountBefore) checkedContractMetadataCount += 1;
  }

  for (const definition of expected) {
    if (!seen.has(definition.fieldId)) errors.push(`required_field_missing:${definition.fieldId}`);
  }
  for (const fieldId of duplicateFields) errors.push(`duplicate_field:${fieldId}`);
  for (const fieldId of tierLeakageFields) errors.push(`tier_leakage:${fieldId}`);
  const packetDigest = sha256Digest(canonicalJson(packet));
  return {
    schemaVersion: PASS4824_CANONICAL_FIELD_RECEIPT_ID,
    caseId: packet.caseId,
    module: packet.module,
    tier: packet.tier,
    status: errors.length === 0 ? "passed" : "failed",
    packetDigest,
    identityDigest: sha256Digest(canonicalJson(identity)),
    registryDigest: sha256Digest(canonicalJson(PASS4824_CANONICAL_FIELD_REGISTRY)),
    expectedFieldCount: expected.length,
    observedFieldCount: packet.observations.length,
    checkedEvidenceDigestCount,
    checkedContractMetadataCount,
    oldestObservationAgeSeconds,
    modeCounts,
    nullFields: Array.from(new Set(nullFields)).sort(),
    zeroFields: Array.from(new Set(zeroFields)).sort(),
    missingReasonFields: Array.from(new Set(missingReasonFields)).sort(),
    tierLeakageFields: Array.from(new Set(tierLeakageFields)).sort(),
    duplicateFields: Array.from(new Set(duplicateFields)).sort(),
    errors: Array.from(new Set(errors)).sort(),
  };
}

export type Pass4824PayloadFieldPacketInspection = {
  state: "absent_legacy_payload" | "verified" | "rejected";
  packetDigest: string | null;
  receipt: Pass4824FieldValidationReceipt | null;
  errors: string[];
};

function normalizedTier(value: string | null | undefined): Pass4824DataTier | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "basic" || normalized === "pro" || normalized === "advanced" ? normalized : null;
}

/** Production-facing compatibility adapter. Legacy payloads remain readable, while
 * every payload that carries PASS4824 data is rejected unless the complete field
 * contract, module and tier validate. */
export function inspectPass4824PayloadFieldPacket(
  payload: unknown,
  expected: { module: Pass4824DataModule; tier: string | null | undefined; requirePresent?: boolean },
): Pass4824PayloadFieldPacketInspection {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { state: "rejected", packetDigest: null, receipt: null, errors: ["payload_object_required"] };
  }
  const carrier = (payload as Record<string, unknown>).pass4824CanonicalFieldPacket;
  if (typeof carrier === "undefined") {
    if (expected.requirePresent) {
      return { state: "rejected", packetDigest: null, receipt: null, errors: ["field_packet_required_for_new_runtime_payload"] };
    }
    return { state: "absent_legacy_payload", packetDigest: null, receipt: null, errors: [] };
  }
  if (!carrier || typeof carrier !== "object" || Array.isArray(carrier)) {
    return { state: "rejected", packetDigest: null, receipt: null, errors: ["field_packet_object_required"] };
  }
  const candidate = carrier as Partial<Pass4824CanonicalFieldPacket>;
  if (!candidate.identity || typeof candidate.identity !== "object" || !Array.isArray(candidate.observations)) {
    return { state: "rejected", packetDigest: null, receipt: null, errors: ["field_packet_structure_invalid"] };
  }
  let receipt: Pass4824FieldValidationReceipt;
  try {
    receipt = validatePass4824CanonicalFieldPacket(candidate as Pass4824CanonicalFieldPacket);
  } catch {
    return { state: "rejected", packetDigest: null, receipt: null, errors: ["field_packet_validation_exception"] };
  }
  const errors = [...receipt.errors];
  if (candidate.module !== expected.module) errors.push(`field_packet_module_mismatch:${String(candidate.module)}:${expected.module}`);
  const tier = normalizedTier(expected.tier);
  if (!tier) errors.push(`field_packet_expected_tier_invalid:${String(expected.tier)}`);
  else if (candidate.tier !== tier) errors.push(`field_packet_tier_mismatch:${String(candidate.tier)}:${tier}`);
  return {
    state: errors.length === 0 ? "verified" : "rejected",
    packetDigest: receipt.packetDigest,
    receipt,
    errors: Array.from(new Set(errors)).sort(),
  };
}

export function assertPass4824PayloadFieldPacket(
  payload: unknown,
  expected: { module: Pass4824DataModule; tier: string | null | undefined; requirePresent?: boolean },
) {
  const inspection = inspectPass4824PayloadFieldPacket(payload, expected);
  if (inspection.state === "rejected") throw new Error(`pass4824_payload_field_packet_rejected:${inspection.errors.join("|")}`);
  return inspection;
}

export function inspectPass4824CanonicalFieldRegistry() {
  const errors: string[] = [];
  const pairKeys = new Set<string>();
  for (const definition of PASS4824_CANONICAL_FIELD_REGISTRY) {
    if (definition.schemaVersion !== PASS4824_FIELD_DEFINITION_ID) errors.push(`definition_schema_invalid:${definition.fieldId}`);
    if (!definition.fieldId.trim() || !definition.semantic.trim() || !definition.unit.trim()) errors.push(`definition_incomplete:${definition.fieldId}`);
    if (!Number.isSafeInteger(definition.maxAgeSeconds) || definition.maxAgeSeconds <= 0) errors.push(`max_age_invalid:${definition.fieldId}`);
    if (definition.numericRange && (!Number.isFinite(definition.numericRange.min) || !Number.isFinite(definition.numericRange.max) || definition.numericRange.min > definition.numericRange.max)) {
      errors.push(`numeric_range_invalid:${definition.fieldId}`);
    }
    if (!definition.normalizationRule.trim() || !definition.confidenceMethodPolicy.trim() || !definition.qualityMethodPolicy.trim()
      || definition.evidenceRefPolicy !== "one_or_more_content_refs" || definition.lineagePolicy !== "source_ids_and_formula_when_derived"
      || definition.algorithmVersion !== "pass4824-canonical-normalizer-v1"
      || definition.digestImpactPolicy !== "all_field_semantics_and_lineage_included"
      || definition.owner !== "velmere-data-contract" || definition.contractVersion !== "pass4824.1"
      || definition.compatibilityPolicy !== "additive_minor_breaking_major") {
      errors.push(`definition_contract_invalid:${definition.fieldId}`);
    }
    for (const dataModule of definition.modules) {
      const pair = `${dataModule}:${definition.fieldId}`;
      if (pairKeys.has(pair)) errors.push(`duplicate_module_field:${pair}`);
      pairKeys.add(pair);
    }
  }
  const tierFieldCounts = Object.fromEntries(ALL_MODULES.map((dataModule) => [
    dataModule,
    Object.fromEntries((["basic", "pro", "advanced"] as const).map((tier) => [tier, getPass4824VisibleFieldDefinitions(dataModule, tier).length])),
  ])) as Record<Pass4824DataModule, Record<Pass4824DataTier, number>>;
  for (const dataModule of ALL_MODULES) {
    if (tierFieldCounts[dataModule].basic !== 10) errors.push(`tier_field_count:${dataModule}:basic:${tierFieldCounts[dataModule].basic}`);
    if (tierFieldCounts[dataModule].pro !== 14) errors.push(`tier_field_count:${dataModule}:pro:${tierFieldCounts[dataModule].pro}`);
    if (tierFieldCounts[dataModule].advanced !== 20) errors.push(`tier_field_count:${dataModule}:advanced:${tierFieldCounts[dataModule].advanced}`);
  }
  return {
    schemaVersion: PASS4824_CANONICAL_FIELD_REGISTRY_ID,
    status: errors.length === 0 ? "passed" as const : "failed" as const,
    definitionCount: PASS4824_CANONICAL_FIELD_REGISTRY.length,
    moduleFieldPairCount: pairKeys.size,
    tierFieldCounts,
    registryDigest: sha256Digest(canonicalJson(PASS4824_CANONICAL_FIELD_REGISTRY)),
    errors,
  };
}
