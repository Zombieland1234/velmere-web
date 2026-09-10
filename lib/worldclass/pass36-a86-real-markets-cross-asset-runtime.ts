import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadRealEvidenceContext, verifyPhysicalEvidenceFamilies } from "./pass36-real-evidence-physical-boundary.mjs";

export const A86_REVISION = "VELMERE_PASS36_A86R0_REAL_MARKETS_CROSS_ASSET_FULL_MATRIX_AND_DATA_RIGHTS_TRUTH_LEDGER" as const;
const POLICY_SCHEMA = "velmere.pass36.a86.real-markets-cross-asset-policy.v1" as const;
const RUNTIME_SCHEMA = "velmere.pass36.a86.real-markets-cross-asset-runtime.v1" as const;
const HEX64 = /^[a-f0-9]{64}$/u;
const TIERS = ["basic", "pro", "advanced"] as const;
const CHANNELS = ["api", "table", "detail_modal", "pdf"] as const;
const FIELD_IDS = [
  "instrument_identity",
  "quote",
  "history",
  "calendar_session",
  "corporate_actions",
  "currency_normalization",
  "correction_state",
  "provider_quorum",
  "cross_asset_context",
  "provenance",
] as const;
const ASSET_CLASSES = ["stock", "etf", "real_estate", "fx", "commodity", "index", "crypto"] as const;

type Tier = typeof TIERS[number];
type Channel = typeof CHANNELS[number];
type FieldId = typeof FIELD_IDS[number];
type AssetClass = typeof ASSET_CLASSES[number];
type FieldState = "AVAILABLE" | "NOT_APPLICABLE_VERIFIED" | "STALE" | "CONFLICTED" | "FAILED" | "UNAVAILABLE";

type A86Policy = {
  schemaVersion: string;
  revisionId: string;
  parentRevisionId: string;
  deterministicEpoch: string;
  inputs: Record<string, { path: string; sha256: string }>;
  fixture: { syntheticIndexRows: number; expectedCatalogRows: number };
  tierRequirements: Record<Tier, { minimumProviderFamilies: number; requiredFields: FieldId[]; maximumStaleFields: number; conflictsAllowed: boolean; minimumEvidenceFamilies: number; minimumMaterialFields: number }>;
  fieldIds: FieldId[];
  assetClasses: AssetClass[];
  channels: Channel[];
  mutationFamilies: string[];
  closedByA86: Array<{ gapId: string; severity: string; title: string; closure: string }>;
  realIntakeIndex: { path: string; sha256: string };
  descendantManifestPath: string;
  parentDescendantManifestPath: string;
  descendantManifestExclusions: string[];
  productionAssertions: Array<{ id: string; path: string; includes: string[]; excludes: string[] }>;
  truthBoundary: string;
};

type CatalogAsset = {
  canonicalAssetId: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency: string;
  semanticUnit: string;
  sourceMode: "STATIC_REFERENCE_CATALOG" | "SYNTHETIC_INDEX_FIXTURE";
};

type CatalogSourceRow = {
  id: unknown;
  symbol: unknown;
  name: unknown;
  assetClass: unknown;
};

type CatalogSourceDocument = {
  schemaVersion: unknown;
  dataMode: unknown;
  liveDataIncluded: unknown;
  commercialRightsVerified: unknown;
  rows: CatalogSourceRow[];
};

type A86RealIntakeRow = {
  instrumentId?: unknown;
  assetClass?: unknown;
  currentQuoteVerified?: boolean;
  historyVerified?: boolean;
  calendarVerified?: boolean;
  currencyNormalizationVerified?: boolean;
  providerRightsApproved?: boolean;
  productionBrowserVerified?: boolean;
  customerValueLabeled?: boolean;
  terminalState?: unknown;
  evidenceRefs?: unknown;
};

type A86RealIntakeIndex = {
  supportedInstrumentDenominator?: unknown;
  rows?: A86RealIntakeRow[];
};

type FieldRow = {
  fieldId: FieldId;
  state: FieldState;
  applicable: boolean;
  providerFamilies: string[];
  evidenceDigestSha256: string;
  semanticValue: string;
};

export type A86TierPacket = {
  packetId: string;
  canonicalAssetId: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  tier: Tier;
  currency: string;
  semanticUnit: string;
  fields: FieldRow[];
  providerFamilies: string[];
  evidenceFamilyCount: number;
  materialFieldCount: number;
  blockers: string[];
  analysisDecision: "FUNCTIONAL_READY_OFFLINE" | "UNAVAILABLE_NOT_FOR_SALE";
  deliveryDecision: "BASIC_LOCAL_INFORMATION_ONLY" | "BLOCKED_REQUIRES_SERVER_ENTITLEMENT" | "EVIDENCE_WITHHELD";
  httpStatus: 200 | 403 | 424;
  corporateActionMeaning: "APPLICABLE_EVIDENCE" | "VERIFIED_NOT_APPLICABLE";
  cryptoScope: "COMPARISON_ONLY" | "PRIMARY_REAL_MARKETS_SURFACE";
  factsDigestSha256: string;
  channelProjections: Array<{ channel: Channel; factsDigestSha256: string; addsFacts: false; liveProven: false; saleEnabled: false }>;
  currentProviderEvidenceVerified: false;
  providerRightsApproved: false;
  productionBrowserExecuted: false;
  customerValueProven: false;
  exactA80CandidateBound: false;
  paidGateEligible: false;
  liveProven: false;
  saleEnabled: false;
  packetDigestSha256: string;
};

export type A86Runtime = {
  schemaVersion: typeof RUNTIME_SCHEMA;
  revisionId: typeof A86_REVISION;
  parentRevisionId: string;
  generatedAt: string;
  catalog: {
    catalogRows: number;
    syntheticIndexRows: number;
    totalInstruments: number;
    classCounts: Record<AssetClass, number>;
    staticReferenceRows: number;
    liveDataRows: 0;
    rightsApprovedRows: 0;
  };
  denominators: {
    instruments: number;
    fieldRows: number;
    tierPackets: number;
    channelProjections: number;
    semanticMutations: number;
    mutationKilled: number;
  };
  readiness: Record<Tier, { functionalReadyOffline: number; evidenceWithheld: number; paidDelivered: 0; productionEligible: 0 }>;
  httpStatusCounts: Record<"200" | "403" | "424", number>;
  mutationFamilyStats: Record<string, { killed: number; survived: number }>;
  packets: A86TierPacket[];
  invariants: {
    duplicateInstrumentIds: number;
    duplicatePacketIds: number;
    missingAssetClasses: number;
    countCoherenceFailures: number;
    tierMonotonicityFailures: number;
    channelParityFailures: number;
    semanticUnitFailures: number;
    corporateActionApplicabilityFailures: number;
    cryptoScopeFailures: number;
    truthBoundaryFailures: number;
    mutationSurvivors: number;
  };
  realIntake: ReturnType<typeof evaluateA86RealIntake>;
  exactA80CandidateBound: false;
  currentProviderEvidenceVerified: false;
  providerRightsApproved: false;
  productionBrowserExecuted: false;
  customerValueProven: false;
  paidGateEligible: false;
  liveProven: false;
  saleEnabled: false;
  worldClassProven: false;
  truthBoundary: string;
  integrity: { algorithm: "sha256"; digest: string };
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value: unknown): string {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === "string" ? value : canonicalJson(value));
  return createHash("sha256").update(bytes).digest("hex");
}

function assertCondition(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

function fileSha256(filePath: string): string {
  return sha256(readFileSync(filePath));
}

function validatePolicy(root: string, policy: A86Policy): void {
  assertCondition(policy.schemaVersion === POLICY_SCHEMA, "a86_policy_schema_invalid");
  assertCondition(policy.revisionId === A86_REVISION, "a86_policy_revision_invalid");
  assertCondition(JSON.stringify(policy.fieldIds) === JSON.stringify(FIELD_IDS), "a86_policy_fields_invalid");
  assertCondition(JSON.stringify(policy.assetClasses) === JSON.stringify(ASSET_CLASSES), "a86_policy_asset_classes_invalid");
  assertCondition(JSON.stringify(policy.channels) === JSON.stringify(CHANNELS), "a86_policy_channels_invalid");
  assertCondition(policy.mutationFamilies.length === 18, "a86_policy_mutations_invalid");
  assertCondition(policy.closedByA86.length >= 24, "a86_policy_gap_ledger_incomplete");
  for (const [id, binding] of Object.entries(policy.inputs)) {
    assertCondition(HEX64.test(binding.sha256), `a86_input_hash_invalid:${id}`);
    assertCondition(fileSha256(path.join(root, binding.path)) === binding.sha256, `a86_input_hash_mismatch:${id}`);
  }
  assertCondition(fileSha256(path.join(root, policy.realIntakeIndex.path)) === policy.realIntakeIndex.sha256, "a86_real_intake_hash_mismatch");
}

function normalizeAssetClass(value: string): AssetClass {
  if (value === "stock" || value === "etf" || value === "real_estate" || value === "fx" || value === "commodity" || value === "crypto") return value;
  if (value === "index") return "index";
  throw new Error(`a86_catalog_asset_class_unsupported:${value}`);
}

function currencyFor(assetClass: AssetClass, index: number): string {
  if (assetClass === "fx") return index % 4 === 0 ? "EUR" : index % 4 === 1 ? "USD" : index % 4 === 2 ? "GBP" : "JPY";
  if (assetClass === "commodity") return "USD";
  if (assetClass === "crypto") return "USD";
  return index % 5 === 0 ? "EUR" : "USD";
}

function semanticUnitFor(assetClass: AssetClass, currency: string): string {
  if (assetClass === "fx") return `${currency}_PER_BASE_CURRENCY`;
  if (assetClass === "commodity") return `${currency}_PER_CONTRACT_UNIT`;
  if (assetClass === "index") return "INDEX_POINTS";
  if (assetClass === "crypto") return `${currency}_PER_TOKEN`;
  return `${currency}_PER_SHARE`;
}

function loadCatalog(root: string, policy: A86Policy): CatalogAsset[] {
  const catalog = JSON.parse(
    readFileSync(path.join(root, "data/real-markets-customer-catalog.json"), "utf8"),
  ) as CatalogSourceDocument;
  assertCondition(catalog.schemaVersion === "real_markets_customer_catalog_v4", "a86_catalog_schema_invalid");
  assertCondition(catalog.dataMode === "STATIC_REFERENCE_UNIVERSE" && catalog.liveDataIncluded === false && catalog.commercialRightsVerified === false, "a86_catalog_truth_invalid");
  assertCondition(catalog.rows.length >= policy.fixture.expectedCatalogRows, "a86_catalog_denominator_invalid");
  const rows: CatalogAsset[] = catalog.rows.map((row, index) => ({
    canonicalAssetId: `catalog:${row.id}`,
    symbol: String(row.symbol).trim().toUpperCase(),
    name: String(row.name),
    assetClass: normalizeAssetClass(String(row.assetClass)),
    currency: currencyFor(normalizeAssetClass(String(row.assetClass)), index),
    semanticUnit: semanticUnitFor(normalizeAssetClass(String(row.assetClass)), currencyFor(normalizeAssetClass(String(row.assetClass)), index)),
    sourceMode: "STATIC_REFERENCE_CATALOG",
  }));
  for (let index = 0; index < policy.fixture.syntheticIndexRows; index += 1) {
    const symbol = `IDX${String(index + 1).padStart(3, "0")}`;
    rows.push({ canonicalAssetId: `fixture:index:${symbol}`, symbol, name: `Synthetic Index Fixture ${index + 1}`, assetClass: "index", currency: "POINTS", semanticUnit: "INDEX_POINTS", sourceMode: "SYNTHETIC_INDEX_FIXTURE" });
  }
  return rows;
}

function allowedProviderFamilies(assetClass: AssetClass): string[] {
  const families: Record<AssetClass, string[]> = {
    stock: ["yahoo", "stooq", "sec"],
    etf: ["yahoo", "stooq", "exchange_reference"],
    real_estate: ["yahoo", "stooq", "sec"],
    fx: ["ecb", "bank_of_canada", "yahoo"],
    commodity: ["stooq", "yahoo", "exchange_reference"],
    index: ["stooq", "yahoo", "exchange_reference"],
    crypto: ["binance", "coinbase", "kraken"],
  };
  return families[assetClass];
}

function providerFamilies(assetClass: AssetClass, index: number): string[] {
  const available = index % 11 === 0 ? 1 : index % 5 === 0 ? 2 : 3;
  return allowedProviderFamilies(assetClass).slice(0, available);
}

function fieldState(asset: CatalogAsset, fieldId: FieldId, index: number, families: string[]): { state: FieldState; applicable: boolean; semanticValue: string } {
  if (fieldId === "instrument_identity") return { state: "AVAILABLE", applicable: true, semanticValue: `${asset.assetClass}:${asset.symbol}` };
  if (fieldId === "quote") {
    if (index % 43 === 0) return { state: "FAILED", applicable: true, semanticValue: "provider_failure" };
    if (index % 29 === 0) return { state: "CONFLICTED", applicable: true, semanticValue: "quote_conflict" };
    if (index % 17 === 0) return { state: "STALE", applicable: true, semanticValue: "quote_stale" };
    return { state: "AVAILABLE", applicable: true, semanticValue: `quote:${asset.currency}` };
  }
  if (fieldId === "history") {
    if (index % 47 === 0) return { state: "UNAVAILABLE", applicable: true, semanticValue: "history_missing" };
    if (index % 37 === 0) return { state: "CONFLICTED", applicable: true, semanticValue: "history_conflict" };
    if (index % 19 === 0) return { state: "STALE", applicable: true, semanticValue: "history_stale" };
    return { state: "AVAILABLE", applicable: true, semanticValue: "history_30d" };
  }
  if (fieldId === "calendar_session") {
    if (index % 53 === 0) return { state: "UNAVAILABLE", applicable: true, semanticValue: "session_unknown" };
    return { state: "AVAILABLE", applicable: true, semanticValue: asset.assetClass === "fx" || asset.assetClass === "crypto" ? "continuous_or_24x5" : "exchange_calendar_bound" };
  }
  if (fieldId === "corporate_actions") {
    const applicable = asset.assetClass === "stock" || asset.assetClass === "etf" || asset.assetClass === "real_estate";
    if (!applicable) return { state: "NOT_APPLICABLE_VERIFIED", applicable: false, semanticValue: "verified_not_applicable" };
    if (index % 31 === 0) return { state: "CONFLICTED", applicable: true, semanticValue: "action_conflict" };
    if (index % 23 === 0) return { state: "STALE", applicable: true, semanticValue: "action_stale" };
    return { state: "AVAILABLE", applicable: true, semanticValue: "actions_reconciled_or_none" };
  }
  if (fieldId === "currency_normalization") {
    if (index % 41 === 0) return { state: "UNAVAILABLE", applicable: true, semanticValue: "fx_conversion_missing" };
    return { state: "AVAILABLE", applicable: true, semanticValue: asset.semanticUnit };
  }
  if (fieldId === "correction_state") {
    if (index % 61 === 0) return { state: "CONFLICTED", applicable: true, semanticValue: "correction_pending" };
    return { state: "AVAILABLE", applicable: true, semanticValue: "correction_ledger_clear" };
  }
  if (fieldId === "provider_quorum") {
    return families.length >= 2
      ? { state: "AVAILABLE", applicable: true, semanticValue: `families:${families.length}` }
      : { state: "UNAVAILABLE", applicable: true, semanticValue: "single_family_only" };
  }
  if (fieldId === "cross_asset_context") {
    if (index % 59 === 0) return { state: "STALE", applicable: true, semanticValue: "context_stale" };
    return { state: "AVAILABLE", applicable: true, semanticValue: `context:${asset.assetClass}` };
  }
  return families.length >= 3
    ? { state: "AVAILABLE", applicable: true, semanticValue: "three_family_provenance" }
    : families.length === 2
      ? { state: "STALE", applicable: true, semanticValue: "two_family_provenance" }
      : { state: "UNAVAILABLE", applicable: true, semanticValue: "provenance_insufficient" };
}

function buildFields(asset: CatalogAsset, index: number, families: string[]): FieldRow[] {
  return FIELD_IDS.map((fieldId) => {
    const row = fieldState(asset, fieldId, index, families);
    const core = { fieldId, ...row, providerFamilies: families };
    return { ...core, evidenceDigestSha256: sha256(core) };
  });
}

function acceptableState(state: FieldState): boolean {
  return state === "AVAILABLE" || state === "NOT_APPLICABLE_VERIFIED";
}

function packetCore(packet: Omit<A86TierPacket, "packetDigestSha256">): Omit<A86TierPacket, "packetDigestSha256"> {
  return packet;
}

function buildPacket(asset: CatalogAsset, index: number, tier: Tier, fields: FieldRow[], families: string[], policy: A86Policy): A86TierPacket {
  const requirements = policy.tierRequirements[tier];
  const blockers: string[] = [];
  for (const fieldId of requirements.requiredFields) {
    const field = fields.find((row) => row.fieldId === fieldId);
    if (!field || !acceptableState(field.state)) blockers.push(`required_field_not_ready:${fieldId}`);
  }
  const staleCount = fields.filter((row) => row.state === "STALE").length;
  if (staleCount > requirements.maximumStaleFields) blockers.push("stale_field_budget_exceeded");
  if (!requirements.conflictsAllowed && fields.some((row) => row.state === "CONFLICTED")) blockers.push("unresolved_conflict");
  if (families.length < requirements.minimumProviderFamilies) blockers.push("provider_family_floor_not_met");
  const evidenceFamilyCount = new Set(["catalog_identity", ...fields.filter((row) => acceptableState(row.state)).map((row) => `field:${row.fieldId}`), ...families.map((family) => `provider:${family}`)]).size;
  const materialFieldCount = fields.filter((row) => acceptableState(row.state)).length + (tier === "pro" ? 8 : tier === "advanced" ? 16 : 0);
  if (evidenceFamilyCount < requirements.minimumEvidenceFamilies) blockers.push("evidence_family_floor_not_met");
  if (materialFieldCount < requirements.minimumMaterialFields) blockers.push("material_field_floor_not_met");
  const analysisDecision = blockers.length === 0 ? "FUNCTIONAL_READY_OFFLINE" : "UNAVAILABLE_NOT_FOR_SALE";
  const deliveryDecision = analysisDecision !== "FUNCTIONAL_READY_OFFLINE"
    ? "EVIDENCE_WITHHELD"
    : tier === "basic"
      ? "BASIC_LOCAL_INFORMATION_ONLY"
      : "BLOCKED_REQUIRES_SERVER_ENTITLEMENT";
  const httpStatus = deliveryDecision === "BASIC_LOCAL_INFORMATION_ONLY" ? 200 : deliveryDecision === "BLOCKED_REQUIRES_SERVER_ENTITLEMENT" ? 403 : 424;
  const facts = { canonicalAssetId: asset.canonicalAssetId, symbol: asset.symbol, name: asset.name, assetClass: asset.assetClass, currency: asset.currency, semanticUnit: asset.semanticUnit, fields: fields.map(({ evidenceDigestSha256, ...row }) => row), providerFamilies: families };
  const factsDigestSha256 = sha256(facts);
  const channelProjections = CHANNELS.map((channel) => ({ channel, factsDigestSha256, addsFacts: false as const, liveProven: false as const, saleEnabled: false as const }));
  const core = packetCore({
    packetId: `a86:${asset.canonicalAssetId}:${tier}`,
    canonicalAssetId: asset.canonicalAssetId,
    symbol: asset.symbol,
    name: asset.name,
    assetClass: asset.assetClass,
    tier,
    currency: asset.currency,
    semanticUnit: asset.semanticUnit,
    fields,
    providerFamilies: families,
    evidenceFamilyCount,
    materialFieldCount,
    blockers: [...new Set(blockers)].sort(),
    analysisDecision,
    deliveryDecision,
    httpStatus,
    corporateActionMeaning: ["stock", "etf", "real_estate"].includes(asset.assetClass) ? "APPLICABLE_EVIDENCE" : "VERIFIED_NOT_APPLICABLE",
    cryptoScope: asset.assetClass === "crypto" ? "COMPARISON_ONLY" : "PRIMARY_REAL_MARKETS_SURFACE",
    factsDigestSha256,
    channelProjections,
    currentProviderEvidenceVerified: false,
    providerRightsApproved: false,
    productionBrowserExecuted: false,
    customerValueProven: false,
    exactA80CandidateBound: false,
    paidGateEligible: false,
    liveProven: false,
    saleEnabled: false,
  });
  return { ...core, packetDigestSha256: sha256(core) };
}

function factsCoreFromPacket(packet: A86TierPacket) {
  return {
    canonicalAssetId: packet.canonicalAssetId,
    symbol: packet.symbol,
    name: packet.name,
    assetClass: packet.assetClass,
    currency: packet.currency,
    semanticUnit: packet.semanticUnit,
    fields: packet.fields.map(({ evidenceDigestSha256, ...row }) => row),
    providerFamilies: packet.providerFamilies,
  };
}

function expectedSemanticUnit(assetClass: AssetClass, currency: string): string {
  return semanticUnitFor(assetClass, currency);
}

export function verifyA86TierPacket(packet: A86TierPacket, policy: A86Policy): boolean {
  try {
    if (!TIERS.includes(packet.tier) || !ASSET_CLASSES.includes(packet.assetClass)) return false;
    if (packet.packetId !== `a86:${packet.canonicalAssetId}:${packet.tier}`) return false;
    const { packetDigestSha256, ...unsignedPacket } = packet;
    if (!HEX64.test(packetDigestSha256) || sha256(unsignedPacket) !== packetDigestSha256) return false;
    if (packet.fields.length !== FIELD_IDS.length || new Set(packet.fields.map((row) => row.fieldId)).size !== FIELD_IDS.length) return false;
    if (packet.fields.some((row) => row.evidenceDigestSha256 !== sha256({ fieldId: row.fieldId, state: row.state, applicable: row.applicable, semanticValue: row.semanticValue, providerFamilies: row.providerFamilies }))) return false;
    if (packet.semanticUnit !== expectedSemanticUnit(packet.assetClass, packet.currency)) return false;
    if (packet.factsDigestSha256 !== sha256(factsCoreFromPacket(packet))) return false;
    if (packet.providerFamilies.length < 1 || new Set(packet.providerFamilies).size !== packet.providerFamilies.length) return false;
    const allowedFamilies = new Set(allowedProviderFamilies(packet.assetClass));
    if (packet.providerFamilies.some((family) => !allowedFamilies.has(family))) return false;
    if (packet.fields.some((row) => JSON.stringify(row.providerFamilies) !== JSON.stringify(packet.providerFamilies))) return false;
    const expectedEvidenceFamilyCount = new Set([
      "catalog_identity",
      ...packet.fields.filter((row) => acceptableState(row.state)).map((row) => `field:${row.fieldId}`),
      ...packet.providerFamilies.map((family) => `provider:${family}`),
    ]).size;
    const expectedMaterialFieldCount = packet.fields.filter((row) => acceptableState(row.state)).length + (packet.tier === "pro" ? 8 : packet.tier === "advanced" ? 16 : 0);
    if (packet.evidenceFamilyCount !== expectedEvidenceFamilyCount || packet.materialFieldCount !== expectedMaterialFieldCount) return false;
    const quorum = packet.fields.find((row) => row.fieldId === "provider_quorum")!;
    const expectedQuorumState: FieldState = packet.providerFamilies.length >= 2 ? "AVAILABLE" : "UNAVAILABLE";
    const expectedQuorumValue = packet.providerFamilies.length >= 2 ? `families:${packet.providerFamilies.length}` : "single_family_only";
    if (quorum.state !== expectedQuorumState || quorum.semanticValue !== expectedQuorumValue || !quorum.applicable) return false;
    const requirements = policy.tierRequirements[packet.tier];
    const expectedBlockers: string[] = [];
    for (const fieldId of requirements.requiredFields) {
      const field = packet.fields.find((row) => row.fieldId === fieldId);
      if (!field || !acceptableState(field.state)) expectedBlockers.push(`required_field_not_ready:${fieldId}`);
    }
    if (packet.fields.filter((row) => row.state === "STALE").length > requirements.maximumStaleFields) expectedBlockers.push("stale_field_budget_exceeded");
    if (!requirements.conflictsAllowed && packet.fields.some((row) => row.state === "CONFLICTED")) expectedBlockers.push("unresolved_conflict");
    if (packet.providerFamilies.length < requirements.minimumProviderFamilies) expectedBlockers.push("provider_family_floor_not_met");
    if (packet.evidenceFamilyCount < requirements.minimumEvidenceFamilies) expectedBlockers.push("evidence_family_floor_not_met");
    if (packet.materialFieldCount < requirements.minimumMaterialFields) expectedBlockers.push("material_field_floor_not_met");
    if (JSON.stringify([...new Set(expectedBlockers)].sort()) !== JSON.stringify(packet.blockers)) return false;
    const ready = packet.blockers.length === 0;
    if ((packet.analysisDecision === "FUNCTIONAL_READY_OFFLINE") !== ready) return false;
    const expectedDelivery = !ready ? "EVIDENCE_WITHHELD" : packet.tier === "basic" ? "BASIC_LOCAL_INFORMATION_ONLY" : "BLOCKED_REQUIRES_SERVER_ENTITLEMENT";
    if (packet.deliveryDecision !== expectedDelivery) return false;
    if (packet.httpStatus !== (expectedDelivery === "BASIC_LOCAL_INFORMATION_ONLY" ? 200 : expectedDelivery === "BLOCKED_REQUIRES_SERVER_ENTITLEMENT" ? 403 : 424)) return false;
    if (packet.channelProjections.length !== CHANNELS.length || new Set(packet.channelProjections.map((row) => row.channel)).size !== CHANNELS.length) return false;
    if (packet.channelProjections.some((row) => row.factsDigestSha256 !== packet.factsDigestSha256 || row.addsFacts || row.liveProven || row.saleEnabled)) return false;
    if (packet.assetClass === "crypto" && packet.cryptoScope !== "COMPARISON_ONLY") return false;
    if (packet.assetClass !== "crypto" && packet.cryptoScope !== "PRIMARY_REAL_MARKETS_SURFACE") return false;
    const corporate = packet.fields.find((row) => row.fieldId === "corporate_actions")!;
    const applicable = ["stock", "etf", "real_estate"].includes(packet.assetClass);
    if (applicable && (packet.corporateActionMeaning !== "APPLICABLE_EVIDENCE" || !corporate.applicable || corporate.state === "NOT_APPLICABLE_VERIFIED")) return false;
    if (!applicable && (packet.corporateActionMeaning !== "VERIFIED_NOT_APPLICABLE" || corporate.applicable || corporate.state !== "NOT_APPLICABLE_VERIFIED" || corporate.semanticValue !== "verified_not_applicable")) return false;
    if (packet.currentProviderEvidenceVerified || packet.providerRightsApproved || packet.productionBrowserExecuted || packet.customerValueProven || packet.exactA80CandidateBound || packet.paidGateEligible || packet.liveProven || packet.saleEnabled) return false;
    return true;
  } catch {
    return false;
  }
}

function mutationKilled(packet: A86TierPacket, policy: A86Policy, family: string): boolean {
  const mutated = structuredClone(packet);
  if (family === "asset_class_substitution") mutated.assetClass = ["stock", "etf", "real_estate"].includes(mutated.assetClass) ? "index" : "stock";
  else if (family === "quote_state_promotion") { const row = mutated.fields.find((field) => field.fieldId === "quote")!; row.state = row.state === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE"; }
  else if (family === "history_state_promotion") mutated.fields = mutated.fields.filter((field) => field.fieldId !== "history");
  else if (family === "calendar_state_promotion") { const row = mutated.fields.find((field) => field.fieldId === "calendar_session")!; row.state = row.state === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE"; }
  else if (family === "corporate_action_silence") { const row = mutated.fields.find((field) => field.fieldId === "corporate_actions")!; if (row.applicable) { row.state = "NOT_APPLICABLE_VERIFIED"; row.applicable = false; } else { row.state = "AVAILABLE"; row.applicable = true; } }
  else if (family === "normalization_unit_substitution") mutated.semanticUnit = "FORGED_UNIT";
  else if (family === "correction_state_promotion") mutated.fields = mutated.fields.filter((field) => field.fieldId !== "correction_state");
  else if (family === "provider_quorum_promotion") {
    mutated.providerFamilies = mutated.providerFamilies.length >= 3 ? mutated.providerFamilies.slice(0, 1) : [...mutated.providerFamilies, "forged_provider"];
    for (const row of mutated.fields) row.providerFamilies = [...mutated.providerFamilies];
  }
  else if (family === "tier_substitution") mutated.tier = mutated.tier === "basic" ? "advanced" : "basic";
  else if (family === "decision_promotion") mutated.analysisDecision = mutated.analysisDecision === "FUNCTIONAL_READY_OFFLINE" ? "UNAVAILABLE_NOT_FOR_SALE" : "FUNCTIONAL_READY_OFFLINE";
  else if (family === "blocker_drop") mutated.blockers = mutated.blockers.length ? [] : ["forged_blocker"];
  else if (family === "http_status_substitution") mutated.httpStatus = mutated.httpStatus === 200 ? 403 : 200;
  else if (family === "channel_fact_addition") (mutated.channelProjections[0] as any).addsFacts = true;
  else if (family === "facts_digest_substitution") mutated.factsDigestSha256 = sha256("forged");
  else if (family === "rights_promotion") (mutated as any).providerRightsApproved = true;
  else if (family === "browser_promotion") (mutated as any).productionBrowserExecuted = true;
  else if (family === "live_sale_promotion") { (mutated as any).liveProven = true; (mutated as any).saleEnabled = true; }
  else if (family === "crypto_scope_substitution") mutated.cryptoScope = mutated.cryptoScope === "COMPARISON_ONLY" ? "PRIMARY_REAL_MARKETS_SURFACE" : "COMPARISON_ONLY";
  for (const field of mutated.fields) field.evidenceDigestSha256 = sha256({ fieldId: field.fieldId, state: field.state, applicable: field.applicable, semanticValue: field.semanticValue, providerFamilies: field.providerFamilies });
  if (family !== "facts_digest_substitution") mutated.factsDigestSha256 = sha256(factsCoreFromPacket(mutated));
  if (family !== "channel_fact_addition") for (const projection of mutated.channelProjections) projection.factsDigestSha256 = mutated.factsDigestSha256;
  const { packetDigestSha256: _old, ...core } = mutated;
  mutated.packetDigestSha256 = sha256(core);
  return !verifyA86TierPacket(mutated, policy);
}

export function evaluateA86RealIntake(index: A86RealIntakeIndex) {
  const requiredInstruments = 583;
  const supportedInstrumentDenominator = Number(index?.supportedInstrumentDenominator);
  const rows = Array.isArray(index?.rows)
    ? index.rows.filter((row): row is A86RealIntakeRow => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    : [];
  const categoryCounts = Object.fromEntries(ASSET_CLASSES.map((assetClass) => [assetClass, rows.filter((row) => row.assetClass === assetClass).length])) as Record<AssetClass, number>;
  const context = loadRealEvidenceContext(process.cwd());
  const requiredFamilies = [
    "exact_identity", "current_quote", "current_history", "calendar_session",
    "corporate_action_or_verified_not_applicable", "currency_normalization", "correction_state",
    "provider_quorum", "provider_rights", "production_browser", "customer_value_label",
  ];
  const verifiedRows = rows.filter((row) => {
    const instrumentId = String(row.instrumentId ?? "");
    return row.terminalState === "AVAILABLE"
      && row.currentQuoteVerified === true && row.historyVerified === true && row.calendarVerified === true
      && row.currencyNormalizationVerified === true && row.providerRightsApproved === true
      && row.productionBrowserVerified === true && row.customerValueLabeled === true
      && verifyPhysicalEvidenceFamilies(row, { context, expectedSubjectId: instrumentId, requiredFamilies, minimumIndependentOrganizations: 2 }).verified;
  });
  const uniqueInstrumentIds = new Set(rows.map((row) => String(row.instrumentId ?? "")));
  const verified = verifiedRows.length;
  const denominatorValid = supportedInstrumentDenominator === requiredInstruments;
  return {
    decision: denominatorValid && rows.length === requiredInstruments && uniqueInstrumentIds.size === requiredInstruments && !uniqueInstrumentIds.has("") && ASSET_CLASSES.every((assetClass) => categoryCounts[assetClass] > 0) && verified === requiredInstruments
      ? "VERIFIED_REAL_MARKETS_CROSS_ASSET_EVIDENCE"
      : "BLOCKED_REAL_MARKETS_CROSS_ASSET_EVIDENCE",
    requiredInstrumentDenominator: requiredInstruments,
    supportedInstrumentDenominator,
    denominatorValid,
    rows: rows.length,
    unavailableOrBlockedInstruments: Math.max(0, requiredInstruments - verified),
    categoryCounts,
    fullyVerified: verified,
    currentQuoteVerified: rows.filter((row) => row.currentQuoteVerified).length,
    rightsApproved: rows.filter((row) => row.providerRightsApproved).length,
    productionBrowserVerified: rows.filter((row) => row.productionBrowserVerified).length,
    customerValueLabeled: rows.filter((row) => row.customerValueLabeled).length,
  };
}

export async function runA86FixtureHarness(root: string, policy: A86Policy): Promise<A86Runtime> {
  validatePolicy(root, policy);
  const assets = loadCatalog(root, policy);
  const ids = assets.map((row) => row.canonicalAssetId);
  const packets: A86TierPacket[] = [];
  for (const [index, asset] of assets.entries()) {
    const families = providerFamilies(asset.assetClass, index);
    const fields = buildFields(asset, index, families);
    for (const tier of TIERS) packets.push(buildPacket(asset, index, tier, fields, families, policy));
  }
  let mutationKilledCount = 0;
  const mutationFamilyStats: Record<string, { killed: number; survived: number }> = Object.fromEntries(policy.mutationFamilies.map((family) => [family, { killed: 0, survived: 0 }]));
  for (const packet of packets) for (const family of policy.mutationFamilies) {
    if (mutationKilled(packet, policy, family)) { mutationKilledCount += 1; mutationFamilyStats[family].killed += 1; }
    else mutationFamilyStats[family].survived += 1;
  }
  const readiness = Object.fromEntries(TIERS.map((tier) => {
    const selected = packets.filter((packet) => packet.tier === tier);
    const ready = selected.filter((packet) => packet.analysisDecision === "FUNCTIONAL_READY_OFFLINE").length;
    return [tier, { functionalReadyOffline: ready, evidenceWithheld: selected.length - ready, paidDelivered: 0 as const, productionEligible: 0 as const }];
  })) as A86Runtime["readiness"];
  const classCounts = Object.fromEntries(ASSET_CLASSES.map((assetClass) => [assetClass, assets.filter((row) => row.assetClass === assetClass).length])) as Record<AssetClass, number>;
  const httpStatusCounts = { "200": packets.filter((row) => row.httpStatus === 200).length, "403": packets.filter((row) => row.httpStatus === 403).length, "424": packets.filter((row) => row.httpStatus === 424).length };
  let tierMonotonicityFailures = 0;
  for (const asset of assets) {
    const state = TIERS.map((tier) => packets.find((row) => row.canonicalAssetId === asset.canonicalAssetId && row.tier === tier)!.analysisDecision === "FUNCTIONAL_READY_OFFLINE" ? 1 : 0);
    if (state[1] > state[0] || state[2] > state[1]) tierMonotonicityFailures += 1;
  }
  const realIndex = JSON.parse(readFileSync(path.join(root, policy.realIntakeIndex.path), "utf8"));
  const realIntake = evaluateA86RealIntake(realIndex);
  const core = {
    schemaVersion: RUNTIME_SCHEMA,
    revisionId: A86_REVISION,
    parentRevisionId: policy.parentRevisionId,
    generatedAt: policy.deterministicEpoch,
    catalog: {
      catalogRows: policy.fixture.expectedCatalogRows,
      syntheticIndexRows: policy.fixture.syntheticIndexRows,
      totalInstruments: assets.length,
      classCounts,
      staticReferenceRows: policy.fixture.expectedCatalogRows,
      liveDataRows: 0 as const,
      rightsApprovedRows: 0 as const,
    },
    denominators: {
      instruments: assets.length,
      fieldRows: assets.length * FIELD_IDS.length,
      tierPackets: packets.length,
      channelProjections: packets.length * CHANNELS.length,
      semanticMutations: packets.length * policy.mutationFamilies.length,
      mutationKilled: mutationKilledCount,
    },
    readiness,
    httpStatusCounts,
    mutationFamilyStats,
    packets,
    invariants: {
      duplicateInstrumentIds: ids.length - new Set(ids).size,
      duplicatePacketIds: packets.length - new Set(packets.map((row) => row.packetId)).size,
      missingAssetClasses: ASSET_CLASSES.filter((assetClass) => classCounts[assetClass] === 0).length,
      countCoherenceFailures: assets.length !== Object.values(classCounts).reduce((sum, value) => sum + value, 0) ? 1 : 0,
      tierMonotonicityFailures,
      channelParityFailures: packets.filter((row) => row.channelProjections.some((projection) => projection.factsDigestSha256 !== row.factsDigestSha256 || projection.addsFacts)).length,
      semanticUnitFailures: packets.filter((row) => !row.semanticUnit || row.semanticUnit === "FORGED_UNIT").length,
      corporateActionApplicabilityFailures: packets.filter((row) => ["stock", "etf", "real_estate"].includes(row.assetClass) ? row.corporateActionMeaning !== "APPLICABLE_EVIDENCE" : row.corporateActionMeaning !== "VERIFIED_NOT_APPLICABLE").length,
      cryptoScopeFailures: packets.filter((row) => row.assetClass === "crypto" ? row.cryptoScope !== "COMPARISON_ONLY" : row.cryptoScope !== "PRIMARY_REAL_MARKETS_SURFACE").length,
      truthBoundaryFailures: packets.filter((row) => row.currentProviderEvidenceVerified || row.providerRightsApproved || row.productionBrowserExecuted || row.customerValueProven || row.exactA80CandidateBound || row.paidGateEligible || row.liveProven || row.saleEnabled).length,
      mutationSurvivors: packets.length * policy.mutationFamilies.length - mutationKilledCount,
    },
    realIntake,
    exactA80CandidateBound: false as const,
    currentProviderEvidenceVerified: false as const,
    providerRightsApproved: false as const,
    productionBrowserExecuted: false as const,
    customerValueProven: false as const,
    paidGateEligible: false as const,
    liveProven: false as const,
    saleEnabled: false as const,
    worldClassProven: false as const,
    truthBoundary: policy.truthBoundary,
  };
  const runtime = { ...core, integrity: { algorithm: "sha256" as const, digest: sha256(core) } };
  if (!verifyA86Runtime(runtime, policy, runtime.integrity.digest)) throw new Error("a86_runtime_self_verification_failed");
  return runtime;
}

export function verifyA86Runtime(runtime: A86Runtime, policy: A86Policy, expectedDigest: string): boolean {
  try {
    const { integrity, ...core } = runtime;
    if (runtime.schemaVersion !== RUNTIME_SCHEMA || runtime.revisionId !== A86_REVISION || integrity.algorithm !== "sha256" || integrity.digest !== expectedDigest || sha256(core) !== integrity.digest) return false;
    if (runtime.denominators.instruments !== runtime.catalog.totalInstruments || runtime.denominators.tierPackets !== runtime.denominators.instruments * TIERS.length || runtime.denominators.fieldRows !== runtime.denominators.instruments * FIELD_IDS.length || runtime.denominators.channelProjections !== runtime.denominators.tierPackets * CHANNELS.length) return false;
    if (runtime.denominators.semanticMutations !== runtime.denominators.tierPackets * policy.mutationFamilies.length || runtime.denominators.mutationKilled !== runtime.denominators.semanticMutations) return false;
    if (Object.values(runtime.invariants).some((value) => value !== 0)) return false;
    if (Object.values(runtime.mutationFamilyStats).some((row) => row.survived !== 0)) return false;
    if (!runtime.packets.every((packet) => verifyA86TierPacket(packet, policy))) return false;
    if (runtime.realIntake.decision !== "BLOCKED_REAL_MARKETS_CROSS_ASSET_EVIDENCE" || runtime.realIntake.fullyVerified !== 0) return false;
    if (runtime.exactA80CandidateBound || runtime.currentProviderEvidenceVerified || runtime.providerRightsApproved || runtime.productionBrowserExecuted || runtime.customerValueProven || runtime.paidGateEligible || runtime.liveProven || runtime.saleEnabled || runtime.worldClassProven) return false;
    return true;
  } catch {
    return false;
  }
}
