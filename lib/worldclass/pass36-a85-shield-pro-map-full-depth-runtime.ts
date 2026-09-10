import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadRealEvidenceContext, verifyPhysicalEvidenceFamilies } from "./pass36-real-evidence-physical-boundary.mjs";
import {
  A84_REVISION,
  runA84FixtureHarness,
  verifyA84Runtime,
  type A84TierPacket,
} from "./pass36-a84-shield-full-catalog-tier-matrix-runtime.ts";
import {
  fetchShieldProFullCatalog,
  SHIELD_PRO_MARKET_PAGE_SIZE,
} from "../market-integrity/shield-pro-full-catalog-client.ts";
import {
  parseShieldMapQuery,
  shieldMapTierState,
  verifyShieldMapResolvedIdentity,
} from "../market-integrity/shield-map-query-boundary.ts";
import { createPass4644ProviderEvidenceReceipt } from "../market-integrity/provider-evidence-receipt.ts";
import type { TokenRiskResult } from "../market-integrity/risk-types.ts";

export const A85_REVISION = "VELMERE_PASS36_A85R0_SHIELD_PRO_AND_SHIELD_MAP_FULL_DEPTH_IDENTITY_ENTITLEMENT_MATRIX" as const;
const POLICY_SCHEMA = "velmere.pass36.a85.shield-pro-map-full-depth-policy.v1" as const;
const RUNTIME_SCHEMA = "velmere.pass36.a85.shield-pro-map-full-depth-runtime.v1" as const;
const TIERS = ["basic", "pro", "advanced"] as const;
const TIMEFRAMES = ["15m", "1h", "4h", "1d", "7d", "1mo"] as const;
const LANE_IDS = ["supply", "unlock", "liquidity", "insider", "social", "contract"] as const;
const HEX64 = /^[a-f0-9]{64}$/u;

type Tier = typeof TIERS[number];
type BindingState = "EXACT_MULTI_SOURCE" | "SINGLE_SOURCE" | "CONFLICT" | "MISSING";
type LabelState = "SIGNED_CURRENT" | "SIGNED_STALE" | "CONFLICT" | "MISSING";
type DepthState = "AVAILABLE" | "STALE" | "CONFLICTED" | "UNAVAILABLE";

type A85Policy = {
  schemaVersion: string;
  revisionId: string;
  parentRevisionId: string;
  deterministicEpoch: string;
  inputs: Record<string, { path: string; sha256: string }>;
  realIntakeIndex: { path: string; sha256: string };
  descendantManifestPath: string;
  parentDescendantManifestPath: string;
  descendantManifestExclusions: string[];
  mutationFamilies: string[];
  closedByA85: Array<{ gapId: string; severity: string; title: string; closure: string }>;
  truthBoundary: string;
};

export type A85Packet = {
  packetId: string;
  canonicalAssetId: string;
  symbol: string;
  tier: Tier;
  marketIdentity: {
    marketId: string;
    symbol: string;
    quote: "USD";
    exact: true;
  };
  terminal: {
    pageCoverageComplete: true;
    requestedPageSize: 250;
    timeframes: typeof TIMEFRAMES;
    a84Decision: A84TierPacket["decision"];
    depthState: DepthState;
    depthEvidenceDigestSha256: string;
    functionalDecision: "FUNCTIONAL_READY_OFFLINE" | "UNAVAILABLE_NOT_FOR_SALE";
  };
  map: {
    bindingState: BindingState;
    chainId: string | null;
    tokenAddress: string | null;
    labelState: LabelState;
    bindingEvidenceDigestSha256: string;
    labelEvidenceDigestSha256: string;
    laneIds: typeof LANE_IDS;
    functionalDecision: "FUNCTIONAL_READY_OFFLINE" | "UNAVAILABLE_NOT_FOR_SALE";
    deepDivePresentationOnly: true;
    vlmDepth: "basic";
  };
  entitlement: {
    realServerEntitlementVerified: false;
    syntheticEntitlementPathTested: boolean;
    deliveryDecision: "DELIVER_BASIC" | "BLOCKED_REQUIRES_SERVER_ENTITLEMENT";
  };
  blockers: string[];
  paidGateEligible: false;
  currentPublicNetworkExecuted: false;
  productionBrowserExecuted: false;
  customerValueProven: false;
  liveProven: false;
  saleEnabled: false;
  packetDigestSha256: string;
};

export type A85Runtime = {
  schemaVersion: typeof RUNTIME_SCHEMA;
  revisionId: typeof A85_REVISION;
  parentRevisionId: typeof A84_REVISION;
  generatedAt: string;
  parentA84RuntimeDigestSha256: string;
  denominators: {
    activeAssets: number;
    tierPackets: number;
    surfaceProjections: number;
    terminalTimeframeRows: number;
    investigatorLaneRows: number;
    semanticMutations: number;
    mutationKilled: number;
  };
  pagination: {
    rows: number;
    pagesFetched: number;
    pageSizes: number[];
    complete: boolean;
    repeatedPageRejected: boolean;
    laterFailureExplicitPartial: boolean;
  };
  bindingCounts: Record<BindingState, number>;
  labelCounts: Record<LabelState, number>;
  depthCounts: Record<DepthState, number>;
  readiness: Record<Tier, {
    shieldProFunctionalReadyOffline: number;
    shieldMapFunctionalReadyOffline: number;
    paidDelivered: 0;
  }>;
  identityBoundary: {
    scenarios: number;
    passed: number;
    failed: number;
  };
  packets: A85Packet[];
  invariants: {
    duplicatePacketIds: number;
    missingAssets: number;
    identityParityFailures: number;
    timeframeCoverageFailures: number;
    pageCoverageFailures: number;
    mapLaneCoverageFailures: number;
    symbolOnlyBindingPromotions: number;
    paidEntitlementBypasses: number;
    basicPaidDepthLeaks: number;
    tierMonotonicityFailures: number;
    mutationSurvivors: number;
    truthBoundaryFailures: number;
  };
  realFullDepthCasesVerified: 0;
  rightsApprovedAssets: 0;
  productionBrowserAssets: 0;
  realEntitlementsVerified: 0;
  customerValueLabeledAssets: 0;
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

function fileSha256(filePath: string) {
  return sha256(fs.readFileSync(filePath));
}

function validatePolicy(root: string, policy: A85Policy) {
  assertCondition(policy.schemaVersion === POLICY_SCHEMA, "a85_policy_schema_invalid");
  assertCondition(policy.revisionId === A85_REVISION, "a85_policy_revision_invalid");
  assertCondition(policy.parentRevisionId === A84_REVISION, "a85_policy_parent_invalid");
  assertCondition(policy.mutationFamilies.length === 16, "a85_policy_mutation_count_invalid");
  assertCondition(policy.closedByA85.length >= 24, "a85_policy_gap_denominator_incomplete");
  for (const [key, binding] of Object.entries(policy.inputs)) {
    assertCondition(HEX64.test(binding.sha256), `a85_input_hash_invalid:${key}`);
    assertCondition(fileSha256(path.join(root, binding.path)) === binding.sha256, `a85_input_hash_mismatch:${key}`);
  }
  assertCondition(fileSha256(path.join(root, policy.realIntakeIndex.path)) === policy.realIntakeIndex.sha256, "a85_real_intake_hash_mismatch");
}

function bindingFor(index: number) {
  if (index < 200) return { state: "EXACT_MULTI_SOURCE" as const, chainId: index % 2 === 0 ? "ethereum" : "base", address: `0x${(index + 1).toString(16).padStart(40, "0")}` };
  if (index < 258) return { state: "SINGLE_SOURCE" as const, chainId: "ethereum", address: `0x${(index + 1).toString(16).padStart(40, "0")}` };
  if (index < 288) return { state: "CONFLICT" as const, chainId: null, address: null };
  return { state: "MISSING" as const, chainId: null, address: null };
}

function labelFor(index: number): LabelState {
  if (index < 150) return "SIGNED_CURRENT";
  if (index < 190) return "SIGNED_STALE";
  if (index < 220) return "CONFLICT";
  return "MISSING";
}

function depthFor(index: number): DepthState {
  const code = index % 20;
  if (code < 14) return "AVAILABLE";
  if (code < 16) return "STALE";
  if (code < 18) return "CONFLICTED";
  return "UNAVAILABLE";
}

function sealPacket(packet: Omit<A85Packet, "packetDigestSha256">): A85Packet {
  return { ...packet, packetDigestSha256: sha256(packet) };
}

function expectedPacketBlockers(packet: A85Packet) {
  return Array.from(new Set([
    ...(packet.terminal.a84Decision === "FUNCTIONAL_READY_OFFLINE" ? [] : ["a84_parent_unavailable"]),
    ...(packet.tier !== "basic" && packet.terminal.depthState !== "AVAILABLE" ? [`depth_${packet.terminal.depthState.toLowerCase()}`] : []),
    ...(packet.tier !== "basic" && packet.map.bindingState !== "EXACT_MULTI_SOURCE" ? [`binding_${packet.map.bindingState.toLowerCase()}`] : []),
    ...(packet.tier === "advanced" && packet.map.labelState !== "SIGNED_CURRENT" ? [`labels_${packet.map.labelState.toLowerCase()}`] : []),
    ...(packet.tier !== "basic" ? ["real_server_entitlement_not_verified"] : []),
  ])).sort();
}

function verifyPacket(packet: A85Packet) {
  const { packetDigestSha256, ...core } = packet;
  if (packetDigestSha256 !== sha256(core)) return false;
  if (packet.packetId !== `a85:${packet.canonicalAssetId}:${packet.tier}`) return false;
  if (packet.marketIdentity.marketId !== packet.canonicalAssetId || packet.marketIdentity.symbol !== packet.symbol || packet.marketIdentity.quote !== "USD" || packet.marketIdentity.exact !== true) return false;
  if (packet.terminal.pageCoverageComplete !== true || packet.terminal.requestedPageSize !== 250 || JSON.stringify(packet.terminal.timeframes) !== JSON.stringify(TIMEFRAMES)) return false;
  if (packet.terminal.depthEvidenceDigestSha256 !== sha256({ canonicalAssetId: packet.canonicalAssetId, depthState: packet.terminal.depthState, evidenceFamily: "injected_order_book_depth" })) return false;
  if (JSON.stringify(packet.map.laneIds) !== JSON.stringify(LANE_IDS) || packet.map.deepDivePresentationOnly !== true || packet.map.vlmDepth !== "basic") return false;
  if (packet.map.bindingEvidenceDigestSha256 !== sha256({ canonicalAssetId: packet.canonicalAssetId, bindingState: packet.map.bindingState, chainId: packet.map.chainId, tokenAddress: packet.map.tokenAddress, evidenceFamilies: ["catalog_identity", "explorer_binding"] })) return false;
  if (packet.map.labelEvidenceDigestSha256 !== sha256({ canonicalAssetId: packet.canonicalAssetId, labelState: packet.map.labelState, registryRevision: "a85_fixture_signed_label_registry_v1" })) return false;
  if (packet.map.bindingState === "EXACT_MULTI_SOURCE" && (!packet.map.chainId || !/^0x[a-f0-9]{40}$/u.test(packet.map.tokenAddress ?? ""))) return false;
  if (packet.map.bindingState !== "EXACT_MULTI_SOURCE" && packet.map.functionalDecision === "FUNCTIONAL_READY_OFFLINE" && packet.tier !== "basic") return false;
  if (packet.tier === "basic" && packet.entitlement.deliveryDecision !== "DELIVER_BASIC") return false;
  if (packet.tier !== "basic" && packet.entitlement.deliveryDecision !== "BLOCKED_REQUIRES_SERVER_ENTITLEMENT") return false;
  if (packet.entitlement.realServerEntitlementVerified !== false) return false;
  if (packet.tier === "advanced" && packet.map.functionalDecision === "FUNCTIONAL_READY_OFFLINE" && packet.map.labelState !== "SIGNED_CURRENT") return false;
  const expectedTerminalReady = packet.terminal.a84Decision === "FUNCTIONAL_READY_OFFLINE" && (packet.tier === "basic" || packet.terminal.depthState === "AVAILABLE");
  if ((packet.terminal.functionalDecision === "FUNCTIONAL_READY_OFFLINE") !== expectedTerminalReady) return false;
  const expectedMapReady = packet.tier === "basic"
    ? packet.terminal.a84Decision === "FUNCTIONAL_READY_OFFLINE"
    : expectedTerminalReady && packet.map.bindingState === "EXACT_MULTI_SOURCE" && (packet.tier === "pro" || packet.map.labelState === "SIGNED_CURRENT");
  if ((packet.map.functionalDecision === "FUNCTIONAL_READY_OFFLINE") !== expectedMapReady) return false;
  if (JSON.stringify(packet.blockers) !== JSON.stringify(expectedPacketBlockers(packet))) return false;
  if (packet.paidGateEligible || packet.currentPublicNetworkExecuted || packet.productionBrowserExecuted || packet.customerValueProven || packet.liveProven || packet.saleEnabled) return false;
  return true;
}

function mutatePacket(packet: A85Packet, family: string): A85Packet {
  const clone = structuredClone(packet) as A85Packet;
  if (family === "market_id_substitution") clone.marketIdentity.marketId = `${clone.marketIdentity.marketId}-other`;
  else if (family === "symbol_substitution") clone.marketIdentity.symbol = `${clone.symbol}X`;
  else if (family === "quote_substitution") (clone.marketIdentity as { quote: string }).quote = "USDT";
  else if (family === "timeframe_drop") (clone.terminal as unknown as { timeframes: string[] }).timeframes = [...TIMEFRAMES.slice(0, -1)];
  else if (family === "page_coverage_promotion") clone.terminal.pageCoverageComplete = false as true;
  else if (family === "depth_state_promotion") clone.terminal.depthState = clone.terminal.depthState === "AVAILABLE" ? "STALE" : "AVAILABLE";
  else if (family === "binding_state_promotion") clone.map.bindingState = clone.map.bindingState === "EXACT_MULTI_SOURCE" ? "MISSING" : "EXACT_MULTI_SOURCE";
  else if (family === "address_substitution") clone.map.tokenAddress = "0x000000000000000000000000000000000000dead";
  else if (family === "label_state_promotion") clone.map.labelState = clone.map.labelState === "SIGNED_CURRENT" ? "MISSING" : "SIGNED_CURRENT";
  else if (family === "lane_drop") (clone.map as unknown as { laneIds: string[] }).laneIds = [...LANE_IDS.slice(0, -1)];
  else if (family === "entitlement_promotion") clone.entitlement.realServerEntitlementVerified = true as false;
  else if (family === "paid_delivery_promotion") clone.entitlement.deliveryDecision = clone.tier === "basic" ? "BLOCKED_REQUIRES_SERVER_ENTITLEMENT" : "DELIVER_BASIC";
  else if (family === "tier_substitution") clone.tier = clone.tier === "basic" ? "pro" : "basic";
  else if (family === "blocked_to_ready") {
    clone.terminal.functionalDecision = clone.terminal.functionalDecision === "FUNCTIONAL_READY_OFFLINE" ? "UNAVAILABLE_NOT_FOR_SALE" : "FUNCTIONAL_READY_OFFLINE";
    clone.map.functionalDecision = clone.map.functionalDecision === "FUNCTIONAL_READY_OFFLINE" ? "UNAVAILABLE_NOT_FOR_SALE" : "FUNCTIONAL_READY_OFFLINE";
    clone.blockers = [];
  }
  else if (family === "deep_dive_paid_depth") clone.map.vlmDepth = "advanced" as "basic";
  else if (family === "live_sale_promotion") { clone.paidGateEligible = true as false; clone.liveProven = true as false; clone.saleEnabled = true as false; }
  const { packetDigestSha256: _old, ...core } = clone;
  return sealPacket(core);
}

function buildPackets(a84Packets: A84TierPacket[]) {
  const byAsset = new Map<string, A84TierPacket[]>();
  for (const packet of a84Packets) {
    const rows = byAsset.get(packet.canonicalAssetId) ?? [];
    rows.push(packet);
    byAsset.set(packet.canonicalAssetId, rows);
  }
  const assetIds = Array.from(byAsset.keys()).sort((a, b) => a.localeCompare(b, "en"));
  const packets: A85Packet[] = [];
  assetIds.forEach((assetId, index) => {
    const rows = byAsset.get(assetId)!;
    const binding = bindingFor(index);
    const labelState = labelFor(index);
    const depthState = depthFor(index);
    for (const tier of TIERS) {
      const parent = rows.find((row) => row.tier === tier)!;
      const terminalReady = parent.decision === "FUNCTIONAL_READY_OFFLINE"
        && (tier === "basic" || depthState === "AVAILABLE");
      const mapReady = tier === "basic"
        ? parent.decision === "FUNCTIONAL_READY_OFFLINE"
        : terminalReady
          && binding.state === "EXACT_MULTI_SOURCE"
          && (tier === "pro" || labelState === "SIGNED_CURRENT");
      const blockers = [
        ...(parent.decision === "FUNCTIONAL_READY_OFFLINE" ? [] : ["a84_parent_unavailable"]),
        ...(tier !== "basic" && depthState !== "AVAILABLE" ? [`depth_${depthState.toLowerCase()}`] : []),
        ...(tier !== "basic" && binding.state !== "EXACT_MULTI_SOURCE" ? [`binding_${binding.state.toLowerCase()}`] : []),
        ...(tier === "advanced" && labelState !== "SIGNED_CURRENT" ? [`labels_${labelState.toLowerCase()}`] : []),
        ...(tier !== "basic" ? ["real_server_entitlement_not_verified"] : []),
      ];
      const core: Omit<A85Packet, "packetDigestSha256"> = {
        packetId: `a85:${assetId}:${tier}`,
        canonicalAssetId: assetId,
        symbol: parent.symbol,
        tier,
        marketIdentity: { marketId: assetId, symbol: parent.symbol, quote: "USD", exact: true },
        terminal: {
          pageCoverageComplete: true,
          requestedPageSize: 250,
          timeframes: TIMEFRAMES,
          a84Decision: parent.decision,
          depthState,
          depthEvidenceDigestSha256: sha256({ canonicalAssetId: assetId, depthState, evidenceFamily: "injected_order_book_depth" }),
          functionalDecision: terminalReady ? "FUNCTIONAL_READY_OFFLINE" : "UNAVAILABLE_NOT_FOR_SALE",
        },
        map: {
          bindingState: binding.state,
          chainId: binding.chainId,
          tokenAddress: binding.address,
          labelState,
          bindingEvidenceDigestSha256: sha256({ canonicalAssetId: assetId, bindingState: binding.state, chainId: binding.chainId, tokenAddress: binding.address, evidenceFamilies: ["catalog_identity", "explorer_binding"] }),
          labelEvidenceDigestSha256: sha256({ canonicalAssetId: assetId, labelState, registryRevision: "a85_fixture_signed_label_registry_v1" }),
          laneIds: LANE_IDS,
          functionalDecision: mapReady ? "FUNCTIONAL_READY_OFFLINE" : "UNAVAILABLE_NOT_FOR_SALE",
          deepDivePresentationOnly: true,
          vlmDepth: "basic",
        },
        entitlement: {
          realServerEntitlementVerified: false,
          syntheticEntitlementPathTested: tier !== "basic" && terminalReady,
          deliveryDecision: tier === "basic" ? "DELIVER_BASIC" : "BLOCKED_REQUIRES_SERVER_ENTITLEMENT",
        },
        blockers: Array.from(new Set(blockers)).sort(),
        paidGateEligible: false,
        currentPublicNetworkExecuted: false,
        productionBrowserExecuted: false,
        customerValueProven: false,
        liveProven: false,
        saleEnabled: false,
      };
      packets.push(sealPacket(core));
    }
  });
  return packets;
}

async function runPaginationChecks() {
  const rows = Array.from({ length: 318 }, (_, index) => ({ id: `asset-${index + 1}` }));
  const requests: string[] = [];
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    const page = Number(new URL(url, "https://velmere.local").searchParams.get("page"));
    const pageRows = page === 1 ? rows.slice(0, 250) : page === 2 ? rows.slice(250) : [];
    return new Response(JSON.stringify({ mode: "live", source: "fixture", rows: pageRows }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const complete = await fetchShieldProFullCatalog({ fetchImpl: fetchImpl as typeof fetch });
  const repeated = await fetchShieldProFullCatalog({ fetchImpl: (async () => new Response(JSON.stringify({ mode: "live", source: "fixture", rows: rows.slice(0, 250) }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch });
  let failureCall = 0;
  const laterFailure = await fetchShieldProFullCatalog({ fetchImpl: (async () => {
    failureCall += 1;
    if (failureCall === 1) return new Response(JSON.stringify({ mode: "live", source: "fixture", rows: rows.slice(0, 250) }), { status: 200, headers: { "content-type": "application/json" } });
    throw new Error("fixture_later_page_failure");
  }) as typeof fetch });
  return {
    rows: complete.rows.length,
    pagesFetched: complete.pagesFetched,
    pageSizes: [250, 68],
    complete: complete.complete && requests.length === 2 && requests.every((url) => url.includes("tier=basic") && url.includes(`perPage=${SHIELD_PRO_MARKET_PAGE_SIZE}`)),
    repeatedPageRejected: repeated.blocker === "repeated_or_non_advancing_page" && repeated.complete === false,
    laterFailureExplicitPartial: laterFailure.rows.length === 250 && laterFailure.mode === "partial" && laterFailure.blocker === "later_page_request_failed",
  };
}

function fakeResult(requested: string, args: { symbol: string; marketId?: string; address?: string; chainId?: string; matched: boolean; tamper?: boolean }): TokenRiskResult {
  const receipt = createPass4644ProviderEvidenceReceipt({
    providerId: args.address ? "dexscreener" : "coingecko",
    providerFamily: args.address ? "dex_market" : "market_data",
    surface: "crypto",
    verification: "normalized_response",
    requestedIdentity: requested,
    resolvedSymbol: args.symbol,
    resolvedMarketId: args.marketId,
    resolvedAddress: args.address,
    resolvedChainId: args.chainId,
    identityMatched: args.matched,
    capabilities: ["identity"],
    timestampProvenance: "provider",
    observedAt: "2026-07-27T12:00:00.000Z",
    receivedAt: "2026-07-27T12:00:01.000Z",
    ttlMs: 60_000,
    httpStatus: 200,
    latencyMs: 5,
    normalizedPayload: args.address
      ? { tokenAddress: args.address, chainId: args.chainId, symbol: args.symbol, priceUsd: 1 }
      : { id: args.marketId, symbol: args.symbol, price: 1 },
  });
  if (args.tamper) receipt.identity.matched = true;
  return {
    token: { symbol: args.symbol, name: args.symbol, marketId: args.marketId, tokenAddress: args.address, chainId: args.chainId },
    metrics: { currentPrice: 1 },
    result: undefined,
    signals: [],
    score: 0,
    confidence: 0,
    dataQuality: "partial",
    dataSources: [],
    limitations: [],
    providerEvidenceReceipts: [receipt],
  } as unknown as TokenRiskResult;
}

function runIdentityBoundaryChecks() {
  const scenarios: boolean[] = [];
  // Keep this historical fixture deterministic and inside its signed receipt TTL.
  // Production verification still defaults to the real current clock.
  const fixtureNow = "2026-07-27T12:00:30.000Z";
  const parsedBitcoin = parseShieldMapQuery(new URL("https://velmere.local/api/market-integrity/investigator?query=bitcoin&locale=en"));
  scenarios.push(parsedBitcoin.ok && verifyShieldMapResolvedIdentity(parsedBitcoin.value, fakeResult("bitcoin", { symbol: "BTC", marketId: "bitcoin", matched: true }), { now: fixtureNow }).ok);
  const parsedBtc = parseShieldMapQuery(new URL("https://velmere.local/api/market-integrity/investigator?query=BTC&locale=pl"));
  scenarios.push(parsedBtc.ok && verifyShieldMapResolvedIdentity(parsedBtc.value, fakeResult("BTC", { symbol: "BTC", marketId: "bitcoin", matched: true }), { now: fixtureNow }).ok);
  const address = "0x00000000000000000000000000000000000000aa";
  const parsedAddress = parseShieldMapQuery(new URL(`https://velmere.local/api/market-integrity/investigator?query=${address}&locale=de`));
  scenarios.push(parsedAddress.ok && verifyShieldMapResolvedIdentity(parsedAddress.value, fakeResult(address, { symbol: "TOK", address, chainId: "ethereum", matched: true }), { now: fixtureNow }).ok);
  scenarios.push(parsedAddress.ok && !verifyShieldMapResolvedIdentity(parsedAddress.value, fakeResult(address, { symbol: "TOK", address, matched: true }), { now: fixtureNow }).ok);
  const typo = parseShieldMapQuery(new URL("https://velmere.local/api/market-integrity/investigator?query=bitcoinn&locale=en"));
  scenarios.push(typo.ok && !verifyShieldMapResolvedIdentity(typo.value, fakeResult("bitcoinn", { symbol: "BTC", marketId: "bitcoin", matched: false }), { now: fixtureNow }).ok);
  scenarios.push(parsedBitcoin.ok && !verifyShieldMapResolvedIdentity(parsedBitcoin.value, fakeResult("bitcoin", { symbol: "BTC", marketId: "bitcoin", matched: false, tamper: true }), { now: fixtureNow }).ok);
  scenarios.push(!parseShieldMapQuery(new URL("https://velmere.local/api/market-integrity/investigator?query=BTC&query=ETH")).ok);
  scenarios.push(!parseShieldMapQuery(new URL("https://velmere.local/api/market-integrity/investigator?query=BTC&debug=1")).ok);
  scenarios.push(!parseShieldMapQuery(new URL("https://velmere.local/api/market-integrity/investigator?query=BTC&locale=fr")).ok);
  scenarios.push(shieldMapTierState().vlmDepth === "basic" && shieldMapTierState().deepDivePresentationOnly === true);
  return { scenarios: scenarios.length, passed: scenarios.filter(Boolean).length, failed: scenarios.filter((value) => !value).length };
}

export async function runA85FixtureHarness(root: string, policy: A85Policy): Promise<A85Runtime> {
  validatePolicy(root, policy);
  const a84Policy = JSON.parse(fs.readFileSync(path.join(root, "config/pass36/a84-shield-full-catalog-tier-matrix-policy.json"), "utf8"));
  const a84 = await runA84FixtureHarness(root, a84Policy);
  assertCondition(verifyA84Runtime(a84, a84Policy, a84.integrity.digest), "a85_parent_a84_runtime_invalid");
  const pagination = await runPaginationChecks();
  const identityBoundary = runIdentityBoundaryChecks();
  const packets = buildPackets(a84.packets);
  const mutationFamilies = policy.mutationFamilies;
  let mutationKilled = 0;
  for (const packet of packets) {
    assertCondition(verifyPacket(packet), `a85_packet_invalid:${packet.packetId}`);
    for (const family of mutationFamilies) {
      if (!verifyPacket(mutatePacket(packet, family))) mutationKilled += 1;
    }
  }
  const bindingCounts = { EXACT_MULTI_SOURCE: 0, SINGLE_SOURCE: 0, CONFLICT: 0, MISSING: 0 } satisfies Record<BindingState, number>;
  const labelCounts = { SIGNED_CURRENT: 0, SIGNED_STALE: 0, CONFLICT: 0, MISSING: 0 } satisfies Record<LabelState, number>;
  const depthCounts = { AVAILABLE: 0, STALE: 0, CONFLICTED: 0, UNAVAILABLE: 0 } satisfies Record<DepthState, number>;
  const basicPackets = packets.filter((packet) => packet.tier === "basic");
  for (const packet of basicPackets) {
    bindingCounts[packet.map.bindingState] += 1;
    labelCounts[packet.map.labelState] += 1;
    depthCounts[packet.terminal.depthState] += 1;
  }
  const readiness = Object.fromEntries(TIERS.map((tier) => {
    const tierRows = packets.filter((packet) => packet.tier === tier);
    return [tier, {
      shieldProFunctionalReadyOffline: tierRows.filter((packet) => packet.terminal.functionalDecision === "FUNCTIONAL_READY_OFFLINE").length,
      shieldMapFunctionalReadyOffline: tierRows.filter((packet) => packet.map.functionalDecision === "FUNCTIONAL_READY_OFFLINE").length,
      paidDelivered: 0 as const,
    }];
  })) as A85Runtime["readiness"];
  const packetIds = new Set(packets.map((packet) => packet.packetId));
  const assetIds = new Set(packets.map((packet) => packet.canonicalAssetId));
  const invariants: A85Runtime["invariants"] = {
    duplicatePacketIds: packets.length - packetIds.size,
    missingAssets: 318 - assetIds.size,
    identityParityFailures: packets.filter((packet) => packet.marketIdentity.marketId !== packet.canonicalAssetId || packet.marketIdentity.symbol !== packet.symbol).length,
    timeframeCoverageFailures: packets.filter((packet) => packet.terminal.timeframes.length !== TIMEFRAMES.length).length,
    pageCoverageFailures: pagination.rows !== 318 || !pagination.complete ? 1 : 0,
    mapLaneCoverageFailures: packets.filter((packet) => packet.map.laneIds.length !== LANE_IDS.length).length,
    symbolOnlyBindingPromotions: packets.filter((packet) => packet.tier !== "basic" && packet.map.functionalDecision === "FUNCTIONAL_READY_OFFLINE" && packet.map.bindingState !== "EXACT_MULTI_SOURCE").length,
    paidEntitlementBypasses: packets.filter((packet) => packet.tier !== "basic" && packet.entitlement.deliveryDecision !== "BLOCKED_REQUIRES_SERVER_ENTITLEMENT").length,
    basicPaidDepthLeaks: packets.filter((packet) => packet.tier === "basic" && (packet.map.vlmDepth !== "basic" || packet.map.deepDivePresentationOnly !== true)).length,
    tierMonotonicityFailures: Math.max(0, readiness.advanced.shieldMapFunctionalReadyOffline - readiness.pro.shieldMapFunctionalReadyOffline) + Math.max(0, readiness.pro.shieldMapFunctionalReadyOffline - readiness.basic.shieldMapFunctionalReadyOffline),
    mutationSurvivors: packets.length * mutationFamilies.length - mutationKilled,
    truthBoundaryFailures: packets.filter((packet) => packet.paidGateEligible || packet.liveProven || packet.saleEnabled || packet.productionBrowserExecuted || packet.currentPublicNetworkExecuted || packet.customerValueProven).length,
  };
  const core: Omit<A85Runtime, "integrity"> = {
    schemaVersion: RUNTIME_SCHEMA,
    revisionId: A85_REVISION,
    parentRevisionId: A84_REVISION,
    generatedAt: policy.deterministicEpoch,
    parentA84RuntimeDigestSha256: a84.integrity.digest,
    denominators: {
      activeAssets: 318,
      tierPackets: packets.length,
      surfaceProjections: packets.length * 2,
      terminalTimeframeRows: packets.length * TIMEFRAMES.length,
      investigatorLaneRows: packets.length * LANE_IDS.length,
      semanticMutations: packets.length * mutationFamilies.length,
      mutationKilled,
    },
    pagination,
    bindingCounts,
    labelCounts,
    depthCounts,
    readiness,
    identityBoundary,
    packets,
    invariants,
    realFullDepthCasesVerified: 0,
    rightsApprovedAssets: 0,
    productionBrowserAssets: 0,
    realEntitlementsVerified: 0,
    customerValueLabeledAssets: 0,
    exactA80CandidateBound: false,
    paidGateEligible: false,
    liveProven: false,
    saleEnabled: false,
    worldClassProven: false,
    truthBoundary: policy.truthBoundary,
  };
  return { ...core, integrity: { algorithm: "sha256", digest: sha256(core) } };
}

export function verifyA85Runtime(runtime: A85Runtime, policy: A85Policy, expectedDigest?: string) {
  if (runtime.schemaVersion !== RUNTIME_SCHEMA || runtime.revisionId !== A85_REVISION || runtime.parentRevisionId !== A84_REVISION) return false;
  const { integrity, ...core } = runtime;
  if (integrity.algorithm !== "sha256" || integrity.digest !== sha256(core) || (expectedDigest && integrity.digest !== expectedDigest)) return false;
  if (runtime.denominators.activeAssets !== 318 || runtime.denominators.tierPackets !== 954 || runtime.denominators.surfaceProjections !== 1908) return false;
  if (runtime.denominators.semanticMutations !== 954 * policy.mutationFamilies.length || runtime.denominators.mutationKilled !== runtime.denominators.semanticMutations) return false;
  if (!runtime.pagination.complete || runtime.pagination.rows !== 318 || runtime.pagination.pagesFetched !== 2 || !runtime.pagination.repeatedPageRejected || !runtime.pagination.laterFailureExplicitPartial) return false;
  if (runtime.identityBoundary.failed !== 0 || runtime.identityBoundary.passed !== runtime.identityBoundary.scenarios) return false;
  if (Object.values(runtime.invariants).some((value) => value !== 0)) return false;
  if (runtime.packets.some((packet) => !verifyPacket(packet))) return false;
  if (runtime.realFullDepthCasesVerified !== 0 || runtime.rightsApprovedAssets !== 0 || runtime.productionBrowserAssets !== 0 || runtime.realEntitlementsVerified !== 0 || runtime.customerValueLabeledAssets !== 0) return false;
  if (runtime.exactA80CandidateBound || runtime.paidGateEligible || runtime.liveProven || runtime.saleEnabled || runtime.worldClassProven) return false;
  return true;
}

export function evaluateA85RealIntake(index: Record<string, unknown>) {
  const required = 318;
  const activeAssetDenominator = Number(index.activeAssetDenominator ?? 0);
  const bundles = Array.isArray(index.evidenceBundles)
    ? index.evidenceBundles.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    : [];
  const context = loadRealEvidenceContext(process.cwd());
  const requiredFamilies = [
    "full_catalog_page", "exact_market_identity", "exact_chain_address_binding", "signed_current_label",
    "order_book_depth", "production_browser", "server_entitlement", "provider_rights",
    "customer_value_label", "tier_output_basic", "tier_output_pro", "tier_output_advanced",
  ];
  const verifiedBundles = bundles.filter((row) => {
    const assetId = String(row.assetId ?? row.canonicalAssetId ?? "");
    return verifyPhysicalEvidenceFamilies(row, { context, expectedSubjectId: assetId, requiredFamilies, minimumIndependentOrganizations: 2 }).verified;
  });
  const verifiedAssetIds = new Set(verifiedBundles.map((row) => String(row.assetId ?? row.canonicalAssetId)));
  const uniqueRows = verifiedAssetIds.size === verifiedBundles.length;
  const fullCatalogPagesVerified = new Set(verifiedBundles.map((row) => String(row.fullCatalogPageId ?? "")).filter(Boolean)).size;
  const exactMarketIdentityAssets = verifiedAssetIds.size;
  const exactChainAddressBindings = verifiedAssetIds.size;
  const signedCurrentLabelAssets = verifiedAssetIds.size;
  const orderBookDepthAssets = verifiedAssetIds.size;
  const productionBrowserAssets = verifiedAssetIds.size;
  const serverEntitlementAssets = verifiedAssetIds.size;
  const rightsApprovedAssets = verifiedAssetIds.size;
  const customerValueLabeledAssets = verifiedAssetIds.size;
  const verified = activeAssetDenominator === required
    && bundles.length === required
    && uniqueRows
    && exactMarketIdentityAssets === required
    && exactChainAddressBindings === required
    && signedCurrentLabelAssets === required
    && orderBookDepthAssets === required
    && productionBrowserAssets === required
    && serverEntitlementAssets === required
    && rightsApprovedAssets === required
    && customerValueLabeledAssets === required
    && fullCatalogPagesVerified > 0;
  return {
    decision: verified ? "VERIFIED_REAL_SHIELD_PRO_MAP_FULL_DEPTH" : "BLOCKED_REAL_SHIELD_PRO_MAP_EVIDENCE",
    requiredAssets: required,
    activeAssetDenominator,
    denominatorValid: activeAssetDenominator === required,
    evidenceCompleteAssets: verified ? required : 0,
    unavailableOrBlockedAssets: verified ? 0 : required,
    fullCatalogPagesVerified,
    exactMarketIdentityAssets,
    exactChainAddressBindings,
    signedCurrentLabelAssets,
    orderBookDepthAssets,
    productionBrowserAssets,
    serverEntitlementAssets,
    rightsApprovedAssets,
    customerValueLabeledAssets,
    paidGateEligible: false,
    liveProven: false,
    saleEnabled: false,
  };
}
