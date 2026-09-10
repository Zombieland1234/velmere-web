import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  clearPublicProviderCatalogRuntimeForTests,
  fetchPublicProviderCatalogRuntime,
  verifyPublicProviderCatalogRuntime,
} from "../market-integrity/pass35-public-provider-catalog-runtime.mjs";
import { loadRealEvidenceContext, verifyPhysicalEvidenceFamilies } from "./pass36-real-evidence-physical-boundary.mjs";

export const A84_REVISION = "VELMERE_PASS36_A84R0_SHIELD_FULL_CATALOG_TIER_MATRIX_AND_PROVIDER_TRUTH_LEDGER" as const;
const POLICY_SCHEMA = "velmere.pass36.a84.shield-full-catalog-tier-matrix-policy.v1" as const;
const RUNTIME_SCHEMA = "velmere.pass36.a84.shield-full-catalog-tier-matrix-runtime.v1" as const;
const HEX64 = /^[a-f0-9]{64}$/u;
const TIERS = ["basic", "pro", "advanced"] as const;
const POPUP_SECTIONS = ["overview", "analysis", "market_impact", "whale_watch"] as const;
const PROVIDERS = ["binance", "mexc", "coinbase", "kraken"] as const;

type Tier = typeof TIERS[number];
type TerminalState = "AVAILABLE" | "STALE" | "CONFLICTED" | "FAILED" | "RATE_LIMITED" | "UNAVAILABLE";

type A84CatalogInstrument = {
  providerInstrumentId: string;
};

type A84CatalogSnapshot = {
  providerId: string;
  providerFamily: string;
  instruments: A84CatalogInstrument[];
};

type A84CatalogAsset = {
  canonicalAssetId: string;
  symbol: string;
  listingIds: string[];
  providerFamilies: string[];
};

type A84Catalog = {
  executionMode: string;
  providerCount: number;
  successfulProviderCount: number;
  activeListingCount: number;
  activeAssetCount: number;
  snapshots: A84CatalogSnapshot[];
  denominator: {
    assets: A84CatalogAsset[];
    excludedListingCount: number;
  };
};

type A84CatalogListing = A84CatalogInstrument & {
  providerId: string;
  providerFamily: string;
};

type A84RealIntakeIndex = {
  schemaVersion?: unknown;
  revisionId?: unknown;
  providerCatalogBundles?: unknown;
  fieldSnapshotBundles?: unknown;
  rightsRecords?: unknown;
  browserEvidence?: unknown;
  customerValueLabels?: unknown;
  realTierOutputs?: unknown;
  activeAssetDenominator?: unknown;
};

type A84Policy = {
  schemaVersion: string;
  revisionId: string;
  parentRevisionId: string;
  deterministicEpoch: string;
  inputs: Record<string, { path: string; sha256: string }>;
  fieldIds: string[];
  providerFamilies: string[];
  popupSections: string[];
  tierRequirements: Record<Tier, {
    minimumProviderFamilies: number;
    requiredFields: string[];
    maximumStaleFields: number;
    unresolvedConflictAllowed: boolean;
    minimumEvidenceFamilies: number;
    minimumMaterialFields: number;
  }>;
  fixtureCatalog: {
    generatedAssetRoots: number;
    quoteSymbols: string[];
    providerSlices: Record<string, number>;
  };
  realIntakeIndex: { path: string; sha256: string };
  mutationFamilies: string[];
  closedByA84: Array<{ gapId: string; severity: string; title: string; closure: string }>;
  descendantManifestPath: string;
  parentDescendantManifestPath: string;
  descendantManifestExclusions: string[];
  truthBoundary: string;
};

type ObservationRow = {
  observationId: string;
  canonicalAssetId: string;
  symbol: string;
  providerId: string;
  providerFamily: string;
  listingId: string;
  fieldId: string;
  state: TerminalState;
  observedAt: string | null;
  maximumAgeSeconds: number;
  valueDigestSha256: string | null;
  errorCode: string | null;
  sourceMode: "INJECTED_FIXTURE";
  terminal: true;
  rowDigestSha256: string;
};

type FieldResolution = {
  fieldId: string;
  state: TerminalState;
  providerFamilies: string[];
  freshProviderFamilies: string[];
  staleProviderFamilies: string[];
  conflictedProviderFamilies: string[];
  unavailableProviderFamilies: string[];
  consensusDigestSha256: string | null;
};

export type A84TierPacket = {
  packetId: string;
  canonicalAssetId: string;
  symbol: string;
  tier: Tier;
  decision: "FUNCTIONAL_READY_OFFLINE" | "UNAVAILABLE_NOT_FOR_SALE";
  requiredProviderFamilies: number;
  observedProviderFamilies: number;
  evidenceFamilyCount: number;
  materialFieldCount: number;
  fields: FieldResolution[];
  blockers: string[];
  popupSections: Array<{
    sectionId: typeof POPUP_SECTIONS[number];
    state: "BOUNDED_OFFLINE" | "UNAVAILABLE";
    sourceFieldIds: string[];
    addsFacts: false;
    liveProven: false;
    saleEnabled: false;
  }>;
  providerRightsApproved: false;
  currentPublicNetworkExecuted: false;
  productionBrowserExecuted: false;
  customerValueProven: false;
  paidGateEligible: false;
  liveProven: false;
  saleEnabled: false;
  packetDigestSha256: string;
};

export type A84Runtime = {
  schemaVersion: typeof RUNTIME_SCHEMA;
  revisionId: typeof A84_REVISION;
  parentRevisionId: string;
  generatedAt: string;
  catalog: {
    executionMode: string;
    providers: number;
    successfulProviders: number;
    activeListings: number;
    activeAssets: number;
    excludedListings: number;
    catalogIntegritySha256: string;
  };
  denominators: {
    activeAssets: number;
    activeListings: number;
    fieldIds: number;
    observationTargets: number;
    observationRows: number;
    tierPackets: number;
    popupRows: number;
    semanticMutations: number;
    mutationKilled: number;
  };
  stateCounts: Record<TerminalState, number>;
  readiness: Record<Tier, { functionalReadyOffline: number; unavailable: number; productionEligible: 0 }>;
  providerFamilyCoverage: Record<string, number>;
  observations: ObservationRow[];
  packets: A84TierPacket[];
  invariants: {
    missingTerminalRows: number;
    duplicateObservationIds: number;
    duplicatePacketIds: number;
    missingAssets: number;
    tierMonotonicityFailures: number;
    blockedPromotionFailures: number;
    popupParityFailures: number;
    truthBoundaryFailures: number;
    mutationSurvivors: number;
  };
  realFullCatalogSnapshotsVerified: 0;
  rightsApprovedAssets: 0;
  currentPublicNetworkExecuted: false;
  productionBrowserExecuted: false;
  customerValueProven: false;
  exactA80CandidateBound: false;
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

function assertCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function fileSha256(filePath: string): string {
  return sha256(readFileSync(filePath));
}

function validatePolicy(root: string, policy: A84Policy): void {
  assertCondition(policy.schemaVersion === POLICY_SCHEMA, "a84_policy_schema_invalid");
  assertCondition(policy.revisionId === A84_REVISION, "a84_policy_revision_invalid");
  assertCondition(JSON.stringify(policy.providerFamilies) === JSON.stringify(PROVIDERS), "a84_policy_provider_families_invalid");
  assertCondition(JSON.stringify(policy.popupSections) === JSON.stringify(POPUP_SECTIONS), "a84_policy_popup_sections_invalid");
  assertCondition(policy.fieldIds.length === 7 && new Set(policy.fieldIds).size === 7, "a84_policy_fields_invalid");
  assertCondition(policy.mutationFamilies.length === 12, "a84_policy_mutation_family_count_invalid");
  assertCondition(policy.closedByA84.length >= 16, "a84_policy_closed_gaps_incomplete");
  for (const [key, binding] of Object.entries(policy.inputs)) {
    assertCondition(HEX64.test(binding.sha256), `a84_policy_input_hash_invalid:${key}`);
    assertCondition(fileSha256(path.join(root, binding.path)) === binding.sha256, `a84_policy_input_hash_mismatch:${key}`);
  }
  assertCondition(fileSha256(path.join(root, policy.realIntakeIndex.path)) === policy.realIntakeIndex.sha256, "a84_real_intake_hash_mismatch");
  for (const tier of TIERS) {
    const requirement = policy.tierRequirements[tier];
    assertCondition(requirement.minimumProviderFamilies >= 1, `a84_tier_provider_floor_invalid:${tier}`);
    assertCondition(requirement.requiredFields.every((fieldId) => policy.fieldIds.includes(fieldId)), `a84_tier_field_invalid:${tier}`);
  }
}

function fixturePayloads(policy: A84Policy) {
  const count = policy.fixtureCatalog.generatedAssetRoots;
  const assets = Array.from({ length: count }, (_, index) => `A${String(index + 1).padStart(4, "0")}`);
  return {
    binance: { symbols: assets.map((base, index) => ({ symbol: `${base}USDT`, baseAsset: base, quoteAsset: "USDT", status: index % 37 === 0 ? "BREAK" : "TRADING", isSpotTradingAllowed: true, permissions: ["SPOT"] })) },
    mexc: { symbols: assets.slice(policy.fixtureCatalog.providerSlices.mexc).map((base, index) => ({ symbol: `${base}USDT`, baseAsset: base, quoteAsset: "USDT", status: index % 41 === 0 ? "2" : "1", isSpotTradingAllowed: true, quoteOrderQtyMarketAllowed: true })) },
    coinbase: assets.slice(policy.fixtureCatalog.providerSlices.coinbase).map((base, index) => ({ id: `${base}-USD`, base_currency: base, quote_currency: "USD", status: "online", trading_disabled: index % 43 === 0, cancel_only: false })),
    kraken: { error: [], result: Object.fromEntries(assets.slice(policy.fixtureCatalog.providerSlices.kraken).map((base, index) => [`X${base}ZUSD`, { altname: `${base}USD`, wsname: `${base}/USD`, base: `X${base}`, quote: "ZUSD", status: index % 47 === 0 ? "maintenance" : "online" }])) },
  };
}

async function buildCatalog(policy: A84Policy): Promise<A84Catalog> {
  const payloads = fixturePayloads(policy);
  const fetchImpl = async (input: unknown) => {
    const hostname = new URL(String(input)).hostname;
    if (hostname === "api.binance.com") return new Response(JSON.stringify(payloads.binance), { status: 200, headers: { "content-type": "application/json" } });
    if (hostname === "api.mexc.com") return new Response(JSON.stringify(payloads.mexc), { status: 200, headers: { "content-type": "application/json" } });
    if (hostname === "api.exchange.coinbase.com") return new Response(JSON.stringify(payloads.coinbase), { status: 200, headers: { "content-type": "application/json" } });
    if (hostname === "api.kraken.com") return new Response(JSON.stringify(payloads.kraken), { status: 200, headers: { "content-type": "application/json" } });
    return new Response("{}", { status: 404 });
  };
  clearPublicProviderCatalogRuntimeForTests();
  const catalog = await fetchPublicProviderCatalogRuntime({
    fetchImpl,
    now: new Date(policy.deterministicEpoch),
    bypassCache: true,
    policy: { retryBaseDelayMs: 0, retryMaxDelayMs: 0, quotaLimit: 20 },
  });
  assertCondition(verifyPublicProviderCatalogRuntime(catalog), "a84_catalog_integrity_invalid");
  assertCondition(catalog.executionMode === "INJECTED_FIXTURE", "a84_catalog_execution_mode_invalid");
  return catalog;
}

function fieldMaximumAge(fieldId: string): number {
  if (fieldId === "spot_quote") return 30;
  if (fieldId === "market_cap" || fieldId === "volume_24h") return 120;
  if (fieldId === "kline_1h") return 180;
  if (fieldId === "kline_24h") return 600;
  if (fieldId === "kline_7d") return 1800;
  return 3600;
}

function observationState(assetOrdinal: number, providerOrdinal: number, fieldOrdinal: number): TerminalState {
  const code = (assetOrdinal * 17 + providerOrdinal * 11 + fieldOrdinal * 7) % 101;
  if (assetOrdinal % 53 === 0 && fieldOrdinal <= 2) return "CONFLICTED";
  if (assetOrdinal % 47 === 0 && fieldOrdinal >= 3) return "STALE";
  if (code < 3) return "FAILED";
  if (code < 6) return "RATE_LIMITED";
  if (code < 10) return "STALE";
  if (code < 12) return "CONFLICTED";
  return "AVAILABLE";
}

function buildObservationRows(catalog: A84Catalog, policy: A84Policy): ObservationRow[] {
  const generatedAt = Date.parse(policy.deterministicEpoch);
  const rows: ObservationRow[] = [];
  const listingById = new Map<string, A84CatalogListing>();
  for (const snapshot of catalog.snapshots) {
    for (const instrument of snapshot.instruments) listingById.set(`${snapshot.providerId}:${instrument.providerInstrumentId}`, { ...instrument, providerId: snapshot.providerId, providerFamily: snapshot.providerFamily });
  }
  const assets = [...catalog.denominator.assets].sort((a, b) => a.canonicalAssetId.localeCompare(b.canonicalAssetId, "en"));
  assets.forEach((asset, assetIndex) => {
    asset.listingIds.forEach((listingId: string) => {
      const listing = listingById.get(listingId);
      assertCondition(listing, `a84_listing_missing:${listingId}`);
      const providerOrdinal = PROVIDERS.indexOf(listing.providerId as typeof PROVIDERS[number]);
      policy.fieldIds.forEach((fieldId, fieldIndex) => {
        const state = observationState(assetIndex + 1, providerOrdinal + 1, fieldIndex + 1);
        const maximumAgeSeconds = fieldMaximumAge(fieldId);
        const ageSeconds = state === "STALE" ? maximumAgeSeconds + 60 : 5 + ((assetIndex + providerOrdinal + fieldIndex) % 12);
        const observedAt = ["AVAILABLE", "STALE", "CONFLICTED"].includes(state) ? new Date(generatedAt - ageSeconds * 1000).toISOString() : null;
        const valueDigestSha256 = ["AVAILABLE", "STALE", "CONFLICTED"].includes(state)
          ? sha256(`${asset.canonicalAssetId}:${listing.providerId}:${fieldId}:${state === "CONFLICTED" ? `conflict-${providerOrdinal}` : "canonical"}`)
          : null;
        const errorCode = state === "FAILED" ? "upstream_error" : state === "RATE_LIMITED" ? "quota_exhausted" : state === "UNAVAILABLE" ? "field_unavailable" : null;
        const core = {
          observationId: `a84:${asset.canonicalAssetId}:${listing.providerId}:${listing.providerInstrumentId}:${fieldId}`,
          canonicalAssetId: asset.canonicalAssetId,
          symbol: asset.symbol,
          providerId: listing.providerId,
          providerFamily: listing.providerFamily,
          listingId,
          fieldId,
          state,
          observedAt,
          maximumAgeSeconds,
          valueDigestSha256,
          errorCode,
          sourceMode: "INJECTED_FIXTURE" as const,
          terminal: true as const,
        };
        rows.push({ ...core, rowDigestSha256: sha256(core) });
      });
    });
  });
  return rows.sort((a, b) => a.observationId.localeCompare(b.observationId, "en"));
}

function resolveField(assetId: string, fieldId: string, rows: ObservationRow[]): FieldResolution {
  const selected = rows.filter((row) => row.canonicalAssetId === assetId && row.fieldId === fieldId);
  const available = selected.filter((row) => row.state === "AVAILABLE");
  const stale = selected.filter((row) => row.state === "STALE");
  const conflicted = selected.filter((row) => row.state === "CONFLICTED");
  const unavailable = selected.filter((row) => ["FAILED", "RATE_LIMITED", "UNAVAILABLE"].includes(row.state));
  let state: TerminalState = "UNAVAILABLE";
  if (conflicted.length > 0) state = "CONFLICTED";
  else if (available.length > 0) state = "AVAILABLE";
  else if (stale.length > 0) state = "STALE";
  else if (selected.some((row) => row.state === "RATE_LIMITED")) state = "RATE_LIMITED";
  else if (selected.some((row) => row.state === "FAILED")) state = "FAILED";
  const digests = available.map((row) => row.valueDigestSha256).filter((value): value is string => Boolean(value));
  const consensusDigestSha256 = digests.length ? sha256([...digests].sort().join("\n")) : null;
  return {
    fieldId,
    state,
    providerFamilies: [...new Set(selected.map((row) => row.providerFamily))].sort(),
    freshProviderFamilies: [...new Set(available.map((row) => row.providerFamily))].sort(),
    staleProviderFamilies: [...new Set(stale.map((row) => row.providerFamily))].sort(),
    conflictedProviderFamilies: [...new Set(conflicted.map((row) => row.providerFamily))].sort(),
    unavailableProviderFamilies: [...new Set(unavailable.map((row) => row.providerFamily))].sort(),
    consensusDigestSha256,
  };
}

function packetCore(packet: Omit<A84TierPacket, "packetDigestSha256">): Omit<A84TierPacket, "packetDigestSha256"> {
  return packet;
}

export function verifyA84TierPacket(packet: A84TierPacket, policy: A84Policy): boolean {
  try {
    const { packetDigestSha256, ...core } = packet;
    if (packetDigestSha256 !== sha256(core)) return false;
    if (!TIERS.includes(packet.tier)) return false;
    if (!/^crypto:A\d{4}$/u.test(packet.canonicalAssetId)) return false;
    if (packet.packetId !== `a84:${packet.canonicalAssetId}:${packet.tier}`) return false;
    if (packet.providerRightsApproved !== false || packet.currentPublicNetworkExecuted !== false || packet.productionBrowserExecuted !== false || packet.customerValueProven !== false || packet.paidGateEligible !== false || packet.liveProven !== false || packet.saleEnabled !== false) return false;
    const requirement = policy.tierRequirements[packet.tier];
    const fieldMap = new Map(packet.fields.map((field) => [field.fieldId, field]));
    if (fieldMap.size !== policy.fieldIds.length || policy.fieldIds.some((fieldId) => !fieldMap.has(fieldId))) return false;
    for (const field of packet.fields) {
      const allFamilies = new Set(field.providerFamilies);
      if ([...field.freshProviderFamilies, ...field.staleProviderFamilies, ...field.conflictedProviderFamilies, ...field.unavailableProviderFamilies].some((family) => !allFamilies.has(family))) return false;
      if (field.state === "AVAILABLE" && (field.freshProviderFamilies.length === 0 || field.conflictedProviderFamilies.length > 0)) return false;
      if (field.state === "CONFLICTED" && field.conflictedProviderFamilies.length === 0) return false;
      if (field.state === "STALE" && (field.freshProviderFamilies.length > 0 || field.staleProviderFamilies.length === 0)) return false;
      if (["FAILED", "RATE_LIMITED", "UNAVAILABLE"].includes(field.state) && (field.freshProviderFamilies.length > 0 || field.staleProviderFamilies.length > 0 || field.conflictedProviderFamilies.length > 0)) return false;
      if ((field.freshProviderFamilies.length > 0) !== Boolean(field.consensusDigestSha256)) return false;
      if (field.consensusDigestSha256 && !HEX64.test(field.consensusDigestSha256)) return false;
    }
    const uniqueFreshFamilies = new Set(packet.fields.flatMap((field) => field.freshProviderFamilies));
    if (packet.observedProviderFamilies !== uniqueFreshFamilies.size) return false;
    const expectedMaterialFields = packet.fields.filter((field) => field.state === "AVAILABLE").length + (packet.tier === "pro" ? 8 : packet.tier === "advanced" ? 16 : 0);
    if (packet.materialFieldCount !== expectedMaterialFields) return false;
    const expectedEvidence = new Set<string>(["catalog_identity", "execution_ledger"]);
    for (const field of packet.fields) if (field.state === "AVAILABLE") expectedEvidence.add(`field:${field.fieldId}`);
    if (uniqueFreshFamilies.size >= 2) expectedEvidence.add("cross_provider_comparison");
    if (packet.fields.some((field) => field.state === "CONFLICTED")) expectedEvidence.add("conflict_receipt");
    if (packet.evidenceFamilyCount !== expectedEvidence.size) return false;
    const ready = requirement.requiredFields.every((fieldId) => fieldMap.get(fieldId)?.state === "AVAILABLE")
      && packet.observedProviderFamilies >= requirement.minimumProviderFamilies
      && packet.evidenceFamilyCount >= requirement.minimumEvidenceFamilies
      && packet.materialFieldCount >= requirement.minimumMaterialFields
      && packet.fields.filter((field) => field.state === "STALE").length <= requirement.maximumStaleFields
      && (requirement.unresolvedConflictAllowed || packet.fields.every((field) => field.state !== "CONFLICTED"));
    if ((packet.decision === "FUNCTIONAL_READY_OFFLINE") !== ready) return false;
    if (packet.decision === "FUNCTIONAL_READY_OFFLINE" && packet.blockers.length !== 0) return false;
    if (packet.decision === "UNAVAILABLE_NOT_FOR_SALE" && packet.blockers.length === 0) return false;
    if (packet.popupSections.length !== 4 || new Set(packet.popupSections.map((row) => row.sectionId)).size !== 4) return false;
    if (packet.popupSections.some((row) => row.addsFacts !== false || row.liveProven !== false || row.saleEnabled !== false)) return false;
    if (packet.tier === "basic" && packet.popupSections.some((row) => ["market_impact", "whale_watch"].includes(row.sectionId) && row.state !== "UNAVAILABLE")) return false;
    return true;
  } catch {
    return false;
  }
}

function buildTierPacket(asset: A84CatalogAsset, tier: Tier, observations: ObservationRow[], policy: A84Policy): A84TierPacket {
  const fields = policy.fieldIds.map((fieldId) => resolveField(asset.canonicalAssetId, fieldId, observations));
  const requirement = policy.tierRequirements[tier];
  const freshFamilies = new Set(fields.flatMap((field) => field.freshProviderFamilies));
  const evidenceFamilies = new Set<string>(["catalog_identity", "execution_ledger"]);
  for (const field of fields) if (field.state === "AVAILABLE") evidenceFamilies.add(`field:${field.fieldId}`);
  if (freshFamilies.size >= 2) evidenceFamilies.add("cross_provider_comparison");
  if (fields.some((field) => field.state === "CONFLICTED")) evidenceFamilies.add("conflict_receipt");
  const materialFieldCount = fields.filter((field) => field.state === "AVAILABLE").length + (tier === "pro" ? 8 : tier === "advanced" ? 16 : 0);
  const blockers: string[] = [];
  for (const fieldId of requirement.requiredFields) if (fields.find((field) => field.fieldId === fieldId)?.state !== "AVAILABLE") blockers.push(`required_field_not_fresh:${fieldId}`);
  if (freshFamilies.size < requirement.minimumProviderFamilies) blockers.push("provider_family_floor_not_met");
  if (!requirement.unresolvedConflictAllowed && fields.some((field) => field.state === "CONFLICTED")) blockers.push("unresolved_provider_conflict");
  if (fields.filter((field) => field.state === "STALE").length > requirement.maximumStaleFields) blockers.push("stale_field_budget_exceeded");
  if (evidenceFamilies.size < requirement.minimumEvidenceFamilies) blockers.push("evidence_family_floor_not_met");
  if (materialFieldCount < requirement.minimumMaterialFields) blockers.push("material_field_floor_not_met");
  const decision = blockers.length === 0 ? "FUNCTIONAL_READY_OFFLINE" : "UNAVAILABLE_NOT_FOR_SALE";
  const popupSections = POPUP_SECTIONS.map((sectionId) => {
    const sourceFieldIds = sectionId === "overview"
      ? ["spot_quote", "market_cap", "volume_24h"]
      : sectionId === "analysis"
        ? ["kline_1h", "kline_24h", "kline_7d", "kline_30d"]
        : sectionId === "market_impact"
          ? ["spot_quote", "volume_24h"]
          : ["market_cap", "volume_24h"];
    const tierAllowsSection = tier !== "basic" || !["market_impact", "whale_watch"].includes(sectionId);
    const fieldsAvailable = sourceFieldIds.every((fieldId) => fields.find((field) => field.fieldId === fieldId)?.state === "AVAILABLE");
    return { sectionId, state: tierAllowsSection && fieldsAvailable ? "BOUNDED_OFFLINE" as const : "UNAVAILABLE" as const, sourceFieldIds, addsFacts: false as const, liveProven: false as const, saleEnabled: false as const };
  });
  const core = packetCore({
    packetId: `a84:${asset.canonicalAssetId}:${tier}`,
    canonicalAssetId: asset.canonicalAssetId,
    symbol: asset.symbol,
    tier,
    decision,
    requiredProviderFamilies: requirement.minimumProviderFamilies,
    observedProviderFamilies: freshFamilies.size,
    evidenceFamilyCount: evidenceFamilies.size,
    materialFieldCount,
    fields,
    blockers: [...new Set(blockers)].sort(),
    popupSections,
    providerRightsApproved: false,
    currentPublicNetworkExecuted: false,
    productionBrowserExecuted: false,
    customerValueProven: false,
    paidGateEligible: false,
    liveProven: false,
    saleEnabled: false,
  });
  return { ...core, packetDigestSha256: sha256(core) };
}

function mutationKilled(packet: A84TierPacket, policy: A84Policy, family: string, variant: number): boolean {
  const mutated = structuredClone(packet);
  if (family === "field_state_promotion") mutated.fields[0].state = mutated.fields[0].state === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";
  else if (family === "freshness_timestamp_rewrite") mutated.fields[0].staleProviderFamilies = ["forged_provider"];
  else if (family === "provider_family_duplication") mutated.observedProviderFamilies += 1;
  else if (family === "required_field_drop") mutated.fields.pop();
  else if (family === "tier_label_substitution") mutated.tier = mutated.tier === "basic" ? "advanced" : "basic";
  else if (family === "decision_promotion") { mutated.decision = mutated.decision === "FUNCTIONAL_READY_OFFLINE" ? "UNAVAILABLE_NOT_FOR_SALE" : "FUNCTIONAL_READY_OFFLINE"; mutated.blockers = []; }
  else if (family === "popup_fact_addition") (mutated.popupSections[0] as any).addsFacts = true;
  else if (family === "popup_section_promotion") mutated.popupSections[0].sectionId = mutated.popupSections[1].sectionId;
  else if (family === "sale_flag_promotion") (mutated as any).saleEnabled = true;
  else if (family === "live_flag_promotion") (mutated as any).liveProven = true;
  else if (family === "rights_flag_promotion") (mutated as any).providerRightsApproved = true;
  else if (family === "packet_identity_substitution") mutated.canonicalAssetId = `crypto:Z${String(variant).padStart(4, "0")}`;
  const { packetDigestSha256: _old, ...core } = mutated;
  mutated.packetDigestSha256 = sha256(core);
  return !verifyA84TierPacket(mutated, policy);
}

export async function runA84FixtureHarness(root: string, policy: A84Policy): Promise<A84Runtime> {
  validatePolicy(root, policy);
  const catalog = await buildCatalog(policy);
  const observations = buildObservationRows(catalog, policy);
  const assets = [...catalog.denominator.assets].sort((a, b) => a.canonicalAssetId.localeCompare(b.canonicalAssetId, "en"));
  const packets = assets.flatMap((asset) => TIERS.map((tier) => buildTierPacket(asset, tier, observations, policy)));
  let mutationKilledCount = 0;
  for (const packet of packets) {
    policy.mutationFamilies.forEach((family, familyIndex) => {
      for (let variant = 0; variant < 1; variant += 1) if (mutationKilled(packet, policy, family, familyIndex)) mutationKilledCount += 1;
    });
  }
  const stateCounts = Object.fromEntries((["AVAILABLE", "STALE", "CONFLICTED", "FAILED", "RATE_LIMITED", "UNAVAILABLE"] as TerminalState[]).map((state) => [state, observations.filter((row) => row.state === state).length])) as Record<TerminalState, number>;
  const readiness = Object.fromEntries(TIERS.map((tier) => {
    const selected = packets.filter((packet) => packet.tier === tier);
    const functionalReadyOffline = selected.filter((packet) => packet.decision === "FUNCTIONAL_READY_OFFLINE").length;
    return [tier, { functionalReadyOffline, unavailable: selected.length - functionalReadyOffline, productionEligible: 0 as const }];
  })) as Record<Tier, { functionalReadyOffline: number; unavailable: number; productionEligible: 0 }>;
  const providerFamilyCoverage = Object.fromEntries(PROVIDERS.map((provider) => [provider, catalog.denominator.assets.filter((asset) => asset.providerFamilies.includes(provider)).length]));
  const observationIds = observations.map((row) => row.observationId);
  const packetIds = packets.map((row) => row.packetId);
  let tierMonotonicityFailures = 0;
  let blockedPromotionFailures = 0;
  let popupParityFailures = 0;
  let truthBoundaryFailures = 0;
  for (const asset of assets) {
    const selected = TIERS.map((tier) => packets.find((packet) => packet.canonicalAssetId === asset.canonicalAssetId && packet.tier === tier)!);
    const readinessRank = selected.map((packet) => packet.decision === "FUNCTIONAL_READY_OFFLINE" ? 1 : 0);
    if (readinessRank[1] > readinessRank[0] || readinessRank[2] > readinessRank[1]) tierMonotonicityFailures += 1;
    if (selected.some((packet) => packet.decision === "FUNCTIONAL_READY_OFFLINE" && packet.blockers.length > 0)) blockedPromotionFailures += 1;
    if (selected.some((packet) => packet.popupSections.length !== 4)) popupParityFailures += 1;
    if (selected.some((packet) => packet.saleEnabled || packet.liveProven || packet.paidGateEligible || packet.providerRightsApproved || packet.currentPublicNetworkExecuted)) truthBoundaryFailures += 1;
  }
  const core = {
    schemaVersion: RUNTIME_SCHEMA,
    revisionId: A84_REVISION,
    parentRevisionId: policy.parentRevisionId,
    generatedAt: policy.deterministicEpoch,
    catalog: {
      executionMode: catalog.executionMode,
      providers: catalog.providerCount,
      successfulProviders: catalog.successfulProviderCount,
      activeListings: catalog.activeListingCount,
      activeAssets: catalog.activeAssetCount,
      excludedListings: catalog.denominator.excludedListingCount,
      catalogIntegritySha256: sha256({ snapshots: catalog.snapshots, denominator: catalog.denominator }),
    },
    denominators: {
      activeAssets: assets.length,
      activeListings: catalog.activeListingCount,
      fieldIds: policy.fieldIds.length,
      observationTargets: catalog.activeListingCount * policy.fieldIds.length,
      observationRows: observations.length,
      tierPackets: packets.length,
      popupRows: packets.length * POPUP_SECTIONS.length,
      semanticMutations: packets.length * policy.mutationFamilies.length,
      mutationKilled: mutationKilledCount,
    },
    stateCounts,
    readiness,
    providerFamilyCoverage,
    observations,
    packets,
    invariants: {
      missingTerminalRows: catalog.activeListingCount * policy.fieldIds.length - observations.length,
      duplicateObservationIds: observationIds.length - new Set(observationIds).size,
      duplicatePacketIds: packetIds.length - new Set(packetIds).size,
      missingAssets: assets.length - new Set(packets.map((packet) => packet.canonicalAssetId)).size,
      tierMonotonicityFailures,
      blockedPromotionFailures,
      popupParityFailures,
      truthBoundaryFailures,
      mutationSurvivors: packets.length * policy.mutationFamilies.length - mutationKilledCount,
    },
    realFullCatalogSnapshotsVerified: 0 as const,
    rightsApprovedAssets: 0 as const,
    currentPublicNetworkExecuted: false as const,
    productionBrowserExecuted: false as const,
    customerValueProven: false as const,
    exactA80CandidateBound: false as const,
    paidGateEligible: false as const,
    liveProven: false as const,
    saleEnabled: false as const,
    worldClassProven: false as const,
    truthBoundary: policy.truthBoundary,
  };
  return { ...core, integrity: { algorithm: "sha256", digest: sha256(core) } };
}

export function verifyA84Runtime(runtime: A84Runtime, policy: A84Policy, expectedDigest?: string): boolean {
  try {
    const { integrity, ...core } = runtime;
    if (integrity.algorithm !== "sha256" || integrity.digest !== sha256(core)) return false;
    if (expectedDigest && integrity.digest !== expectedDigest) return false;
    if (runtime.schemaVersion !== RUNTIME_SCHEMA || runtime.revisionId !== A84_REVISION) return false;
    if (runtime.denominators.activeAssets !== 318 || runtime.denominators.activeListings !== 1013) return false;
    if (runtime.denominators.observationTargets !== runtime.denominators.observationRows) return false;
    if (runtime.denominators.observationRows !== runtime.denominators.activeListings * runtime.denominators.fieldIds) return false;
    if (runtime.denominators.tierPackets !== runtime.denominators.activeAssets * 3) return false;
    if (runtime.denominators.popupRows !== runtime.denominators.tierPackets * 4) return false;
    if (runtime.denominators.semanticMutations !== runtime.denominators.mutationKilled) return false;
    if (Object.values(runtime.invariants).some((value) => value !== 0)) return false;
    if (runtime.observations.some((row) => {
      const { rowDigestSha256, ...rowCore } = row;
      return rowDigestSha256 !== sha256(rowCore) || row.terminal !== true;
    })) return false;
    if (runtime.packets.some((packet) => !verifyA84TierPacket(packet, policy))) return false;
    if (runtime.realFullCatalogSnapshotsVerified !== 0 || runtime.rightsApprovedAssets !== 0 || runtime.currentPublicNetworkExecuted !== false || runtime.productionBrowserExecuted !== false || runtime.customerValueProven !== false || runtime.exactA80CandidateBound !== false || runtime.paidGateEligible !== false || runtime.liveProven !== false || runtime.saleEnabled !== false || runtime.worldClassProven !== false) return false;
    return true;
  } catch {
    return false;
  }
}

export function evaluateA84RealIntake(index: A84RealIntakeIndex, policy: A84Policy) {
  assertCondition(index.schemaVersion === "velmere.pass36.a84.shield-real-full-catalog-intake.v1", "a84_real_intake_schema_invalid");
  assertCondition(index.revisionId === A84_REVISION, "a84_real_intake_revision_invalid");
  const records = (value: unknown): Array<Record<string, unknown>> => Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    : [];
  const providerCatalogBundles = records(index.providerCatalogBundles);
  const fieldSnapshotBundles = records(index.fieldSnapshotBundles);
  const rightsRecords = records(index.rightsRecords);
  const browserEvidence = records(index.browserEvidence);
  const customerValueLabels = records(index.customerValueLabels);
  const realTierOutputs = records(index.realTierOutputs);
  const requiredAssets = 318;
  const activeAssets = typeof index.activeAssetDenominator === "number" && Number.isInteger(index.activeAssetDenominator)
    ? index.activeAssetDenominator
    : -1;
  const requiredProviders = policy.providerFamilies.length;
  const requiredFieldFamilies = policy.fieldIds.length;
  const requiredSnapshots = requiredAssets * requiredFieldFamilies;
  const context = loadRealEvidenceContext(process.cwd());
  const terminalStates = new Set(["AVAILABLE", "STALE", "CONFLICTED", "FAILED", "RATE_LIMITED", "UNAVAILABLE", "BLOCKED"]);
  const verifiedProviderFamilies = new Set(providerCatalogBundles.filter((row) => {
    const providerFamily = String(row.providerFamily ?? "");
    return policy.providerFamilies.includes(providerFamily) && verifyPhysicalEvidenceFamilies(row, { context, expectedSubjectId: `provider:${providerFamily}`, requiredFamilies: ["provider_catalog"], minimumIndependentOrganizations: 1 }).verified;
  }).map((row) => String(row.providerFamily)));
  const verifiedFieldPairs = new Set(fieldSnapshotBundles.filter((row) => {
    const assetId = String(row.assetId ?? row.canonicalAssetId ?? "");
    const fieldId = String(row.fieldId ?? "");
    return policy.fieldIds.includes(fieldId) && terminalStates.has(String(row.state ?? "")) && verifyPhysicalEvidenceFamilies(row, { context, expectedSubjectId: `${assetId}:${fieldId}`, requiredFamilies: [`field_snapshot_${fieldId}`], minimumIndependentOrganizations: 1 }).verified;
  }).map((row) => `${String(row.assetId ?? row.canonicalAssetId)}:${String(row.fieldId)}`));
  const verifiedAssetSet = (rows: Array<Record<string, unknown>>, family: string) => new Set(rows.filter((row) => {
    const assetId = String(row.assetId ?? row.canonicalAssetId ?? "");
    return verifyPhysicalEvidenceFamilies(row, { context, expectedSubjectId: assetId, requiredFamilies: [family], minimumIndependentOrganizations: 1 }).verified;
  }).map((row) => String(row.assetId ?? row.canonicalAssetId)));
  const rightsAssets = verifiedAssetSet(rightsRecords, "provider_rights");
  const browserAssets = verifiedAssetSet(browserEvidence, "production_browser");
  const customerAssets = verifiedAssetSet(customerValueLabels, "customer_value_label");
  const tierPairs = new Set(realTierOutputs.filter((row) => {
    const assetId = String(row.assetId ?? row.canonicalAssetId ?? "");
    const tier = String(row.tier ?? "");
    return TIERS.includes(tier as Tier) && verifyPhysicalEvidenceFamilies(row, { context, expectedSubjectId: `${assetId}:${tier}`, requiredFamilies: [`tier_output_${tier}`], minimumIndependentOrganizations: 1 }).verified;
  }).map((row) => `${String(row.assetId ?? row.canonicalAssetId)}:${String(row.tier)}`));
  const allAssetIds = new Set([...rightsAssets, ...browserAssets, ...customerAssets]);
  const evidenceCompleteAssets = [...allAssetIds].filter((assetId) => rightsAssets.has(assetId) && browserAssets.has(assetId) && customerAssets.has(assetId)
    && policy.fieldIds.every((fieldId) => verifiedFieldPairs.has(`${assetId}:${fieldId}`))
    && TIERS.every((tier) => tierPairs.has(`${assetId}:${tier}`))).length;
  const unavailableOrBlockedAssets = requiredAssets - evidenceCompleteAssets;
  const decision = verifiedProviderFamilies.size === requiredProviders
    && activeAssets === requiredAssets
    && verifiedFieldPairs.size === requiredSnapshots
    && rightsAssets.size === requiredAssets
    && browserAssets.size === requiredAssets
    && customerAssets.size === requiredAssets
    && tierPairs.size === requiredAssets * TIERS.length
    && evidenceCompleteAssets === requiredAssets
    ? "READY_FOR_INDEPENDENT_A84_REVIEW"
    : "BLOCKED_CURRENT_FULL_CATALOG_EVIDENCE";
  return {
    requiredProviders,
    requiredFieldFamilies,
    requiredAssetDenominator: requiredAssets,
    activeAssetDenominator: activeAssets,
    denominatorValid: activeAssets === requiredAssets,
    providerCatalogBundles: verifiedProviderFamilies.size,
    fieldSnapshotBundles: verifiedFieldPairs.size,
    requiredFieldSnapshotBundles: requiredSnapshots,
    rightsApprovedAssets: rightsAssets.size,
    productionBrowserAssets: browserAssets.size,
    customerValueLabeledAssets: customerAssets.size,
    realTierOutputs: tierPairs.size,
    evidenceCompleteAssets,
    unavailableOrBlockedAssets,
    decision,
    paidGateEligible: false,
    liveProven: false,
    saleEnabled: false,
  };
}
