import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadRealEvidenceContext, verifyPhysicalEvidenceFamilies } from "./pass36-real-evidence-physical-boundary.mjs";
import { runA84FixtureHarness } from "./pass36-a84-shield-full-catalog-tier-matrix-runtime.ts";
import { buildMarketImpactAnalysis, verifyMarketImpactResultIntegrity } from "../market-integrity/market-impact-engine.ts";
import { buildMarketImpactTierPacket, buildWhaleWatchTierPacket, verifyMarketImpactTierPacket, verifyWhaleWatchTierPacket } from "../market-integrity/market-impact-whale-tier-runtime.ts";
import type { MarketImpactVenueSnapshot } from "../market-integrity/market-impact-types.ts";
import { buildWhaleWatchAnalysis, verifyWhaleWatchResultIntegrity } from "../market-integrity/whale-watch-engine.ts";
import type { HolderCategory, WhaleCapabilityReceipt, WhaleHolderSnapshot, WhaleTransferEvent } from "../market-integrity/whale-watch-types.ts";
import { createWalletLabelRegistryArtifact, type WalletLabelRegistryArtifact } from "../market-integrity/wallet-label-registry.ts";

export const A87_REVISION = "VELMERE_PASS36_A87R0_MARKET_IMPACT_WHALE_WATCH_COMMON_DENOMINATOR_AND_REAL_EVIDENCE_TRUTH_LEDGER" as const;
const POLICY_SCHEMA = "velmere.pass36.a87.market-impact-whale-watch-policy.v1" as const;
const RUNTIME_SCHEMA = "velmere.pass36.a87.market-impact-whale-watch-runtime.v1" as const;
const HEX64 = /^[a-f0-9]{64}$/u;
const TIERS = ["basic", "pro", "advanced"] as const;
const SURFACES = ["market_impact", "whale_watch"] as const;
const CHANNELS = ["api", "ui", "popup", "pdf"] as const;
const PROVIDERS = ["binance", "mexc", "coinbase", "kraken"] as const;

type Tier = typeof TIERS[number];
type Surface = typeof SURFACES[number];
type Channel = typeof CHANNELS[number];

type A87Policy = {
  schemaVersion: string;
  revisionId: string;
  parentRevisionId: string;
  deterministicEpoch: string;
  inputs: Record<string, { path: string; sha256: string }>;
  realIntakeIndex: { path: string; sha256: string };
  tierRequirements: {
    market_impact: Record<Tier, { minimumVenues: number; minimumProviderFamilies: number; minimumScenarios: number; minimumReplayPairs: number }>;
    whale_watch: Record<Tier, { minimumProviderFamilies: number; minimumHolderCoveragePercent: number; minimumLabelCoveragePercent: number; minimumClusterCoveragePercent: number; requireTransfers: boolean; requireExitStress: boolean }>;
  };
  mutationFamilies: string[];
  closedByA87: Array<{ gapId: string; severity: string; title: string; closure: string }>;
  productionAssertions: Array<{ id: string; path: string; includes: string[]; excludes: string[] }>;
  descendantManifestPath: string;
  parentDescendantManifestPath: string;
  descendantManifestExclusions: string[];
  truthBoundary: string;
};

type Projection = {
  channel: Channel;
  sourcePacketId: string;
  sourcePacketDigestSha256: string;
  addsFacts: false;
  liveProven: false;
  saleEnabled: false;
  projectionDigestSha256: string;
};

type MutableProjection = Omit<Projection, "addsFacts" | "liveProven" | "saleEnabled"> & {
  addsFacts: boolean;
  liveProven: boolean;
  saleEnabled: boolean;
};

type MarketEvidence = {
  referenceMidPrice: number | null;
  venueCount: number;
  providerFamilyCount: number;
  excludedVenueCount: number;
  executionCount: number;
  depthBandCount: number;
  scenarioCount: number;
  replayPairCount: number;
  realizedSlippageComparisonCount: 0;
  largestOrderFillRatio: number;
  crossVenueMidDivergenceBps: number | null;
  venueSetDigestSha256: string;
  executionGridDigestSha256: string;
  scenarioSetDigestSha256: string;
  replayDigestSha256: string;
};

type WhaleEvidence = {
  bindingState: "EXACT" | "CONFLICT" | "MISSING";
  bindingDigestSha256: string;
  holderCount: number;
  transferCount: number;
  providerFamilyCount: number;
  holderCoveragePercent: number;
  verifiedLabelCoveragePercent: number;
  clusterCoveragePercent: number;
  flowWindowCount: number;
  alertCount: number;
  exitStressCount: number;
  marketImpactLinked: boolean;
  holderSetDigestSha256: string;
  transferSetDigestSha256: string;
  labelRegistryDigestSha256: string;
  flowDigestSha256: string;
  exitStressDigestSha256: string;
};

export type A87Packet = {
  schemaVersion: "velmere.pass36.a87.surface-tier-packet.v1";
  packetId: string;
  canonicalAssetId: string;
  symbol: string;
  surface: Surface;
  tier: Tier;
  sourceResultDigestSha256: string;
  sourceTierPacketDigestSha256: string;
  evidence: MarketEvidence | WhaleEvidence;
  evidenceBindingDigestSha256: string;
  analysisDecision: "FUNCTIONAL_READY_OFFLINE" | "UNAVAILABLE_NOT_FOR_SALE";
  deliveryDecision: "FREE_INFORMATIONAL_ONLY" | "BLOCKED_REQUIRES_SERVER_ENTITLEMENT" | "EVIDENCE_WITHHELD";
  httpStatus: 200 | 403 | 424;
  blockers: string[];
  projections: Projection[];
  exactA80CandidateBound: false;
  currentPublicNetworkExecuted: false;
  providerRightsApproved: false;
  realizedExecutionValidated: false;
  continuousMonitoringExecuted: false;
  customerValueProven: false;
  paidGateEligible: false;
  liveProven: false;
  saleEnabled: false;
  packetDigestSha256: string;
};

type MutableA87Packet = Omit<A87Packet, "projections" | "paidGateEligible" | "liveProven" | "saleEnabled"> & {
  projections: MutableProjection[];
  paidGateEligible: boolean;
  liveProven: boolean;
  saleEnabled: boolean;
};

type A87RealIntakeRow = {
  canonicalAssetId?: unknown;
  rightsApproved?: boolean;
  currentMultiVenueBooks?: boolean;
  realizedSlippageComparison?: boolean;
  exactChainAddressBinding?: boolean;
  currentHolderTransferLabelEvidence?: boolean;
  continuousRevalidationWindow?: boolean;
  terminalState?: unknown;
  evidenceRefs?: unknown;
};

type A87RealIntakeIndex = {
  rows?: A87RealIntakeRow[];
};

export type A87Runtime = {
  schemaVersion: typeof RUNTIME_SCHEMA;
  revisionId: typeof A87_REVISION;
  parentRevisionId: string;
  generatedAt: string;
  denominators: {
    activeAssets: number;
    surfaces: number;
    tierPackets: number;
    channelProjections: number;
    marketImpactVenueSnapshots: number;
    marketImpactReplayPairs: number;
    whaleHolderRows: number;
    whaleTransferRows: number;
    walletLabelArtifacts: number;
    semanticMutations: number;
    mutationKilled: number;
  };
  readiness: Record<Surface, Record<Tier, { functionalReadyOffline: number; unavailable: number; productionEligible: 0 }>>;
  packets: A87Packet[];
  mutationFamilyStats: Record<string, { killed: number; survived: number }>;
  invariants: {
    duplicatePacketIds: number;
    missingAssets: number;
    tierMonotonicityFailures: number;
    packetSemanticFailures: number;
    projectionParityFailures: number;
    truthBoundaryFailures: number;
    mutationSurvivors: number;
  };
  realIntake: ReturnType<typeof evaluateA87RealIntake>;
  exactA80CandidateBound: false;
  currentProviderEvidenceVerified: false;
  providerRightsApproved: false;
  productionBrowserExecuted: false;
  realizedExecutionValidated: false;
  continuousMonitoringExecuted: false;
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

function validatePolicy(root: string, policy: A87Policy): void {
  assertCondition(policy.schemaVersion === POLICY_SCHEMA, "a87_policy_schema_invalid");
  assertCondition(policy.revisionId === A87_REVISION, "a87_policy_revision_invalid");
  assertCondition(policy.mutationFamilies.length === 18 && new Set(policy.mutationFamilies).size === 18, "a87_policy_mutations_invalid");
  assertCondition(policy.closedByA87.length >= 20, "a87_policy_gap_ledger_incomplete");
  for (const [id, binding] of Object.entries(policy.inputs)) {
    assertCondition(HEX64.test(binding.sha256), `a87_input_hash_invalid:${id}`);
    assertCondition(fileSha256(path.join(root, binding.path)) === binding.sha256, `a87_input_hash_mismatch:${id}`);
  }
  assertCondition(fileSha256(path.join(root, policy.realIntakeIndex.path)) === policy.realIntakeIndex.sha256, "a87_real_intake_hash_mismatch");
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function venueSnapshot(symbol: string, providerFamily: string, mid: number, ordinal: number, now: string, depthMultiplier = 1): MarketImpactVenueSnapshot {
  const bids = [];
  const asks = [];
  for (let level = 1; level <= 24; level += 1) {
    const distance = level * 0.00035;
    const baseQuantity = (35 + level * 3 + ordinal % 13) * depthMultiplier;
    bids.push({ price: round(mid * (1 - distance), 8), baseQuantity: round(baseQuantity, 8) });
    asks.push({ price: round(mid * (1 + distance), 8), baseQuantity: round(baseQuantity * 0.97, 8) });
  }
  const quoteCurrency = providerFamily === "binance" || providerFamily === "mexc" ? "USDT" as const : "USD" as const;
  return {
    venueId: `${providerFamily}:${symbol.toLowerCase()}usd`,
    providerFamily,
    assetKey: symbol,
    quoteCurrency,
    observedAt: now,
    status: "verified_fixture",
    feeBps: 10,
    quoteToUsd: quoteCurrency === "USD" ? undefined : {
      usdRate: 1,
      observedAt: now,
      status: "verified_fixture",
      providerFamily: "stable_quote_fixture",
      sourceDigest: sha256(`${symbol}:${providerFamily}:quote-rate`),
    },
    bids,
    asks,
    sourceDigest: sha256({ symbol, providerFamily, bids, asks, now }),
  };
}

function marketVenueCount(index: number): number {
  if (index < 180) return 4;
  if (index < 250) return 3;
  if (index < 290) return 2;
  if (index < 308) return 1;
  return 0;
}

function buildMarketEvidence(symbol: string, index: number, now: Date) {
  const count = marketVenueCount(index);
  const baseMid = 10 + index * 0.71;
  const snapshots = PROVIDERS.slice(0, count).map((provider, providerIndex) => venueSnapshot(symbol, provider, baseMid * (1 + providerIndex * 0.0004), index + providerIndex, now.toISOString()));
  if (count > 0 && index % 23 === 0) {
    snapshots.push({ ...venueSnapshot(symbol, "outlier_fixture", baseMid * 1.25, index, now.toISOString()), venueId: `outlier:${symbol.toLowerCase()}` });
  }
  const result = buildMarketImpactAnalysis({ assetKey: symbol, snapshots, now, policy: { allowFixture: true, minimumVenueCount: 1, minimumProviderFamilies: 1 } });
  assertCondition(verifyMarketImpactResultIntegrity(result), `a87_market_result_integrity_invalid:${symbol}`);
  const replaySnapshots = snapshots.filter((row) => row.providerFamily !== "outlier_fixture").map((row) => ({
    ...row,
    bids: row.bids.map((level) => ({ ...level, baseQuantity: round(level.baseQuantity * 0.82, 8) })),
    asks: row.asks.map((level) => ({ ...level, baseQuantity: round(level.baseQuantity * 0.82, 8) })),
    sourceDigest: sha256({ original: row.sourceDigest, replay: 2 }),
  }));
  const replay = replaySnapshots.length > 0
    ? buildMarketImpactAnalysis({ assetKey: symbol, snapshots: replaySnapshots, now, policy: { allowFixture: true, minimumVenueCount: 1, minimumProviderFamilies: 1 } })
    : null;
  if (replay) assertCondition(verifyMarketImpactResultIntegrity(replay), `a87_market_replay_integrity_invalid:${symbol}`);
  const largest = result.executions.filter((row) => row.requestedNotionalUsd === 100_000);
  const evidence: MarketEvidence = {
    referenceMidPrice: result.referenceMidPrice,
    venueCount: result.venues.length,
    providerFamilyCount: result.providerFamilies.length,
    excludedVenueCount: result.excludedVenues.length,
    executionCount: result.executions.length,
    depthBandCount: result.depthBands.length,
    scenarioCount: result.scenarios.length,
    replayPairCount: replay && replay.referenceMidPrice !== null ? 1 : 0,
    realizedSlippageComparisonCount: 0,
    largestOrderFillRatio: largest.length ? Math.min(...largest.map((row) => row.fillRatio)) : 0,
    crossVenueMidDivergenceBps: result.crossVenueMidDivergenceBps,
    venueSetDigestSha256: sha256(result.venues),
    executionGridDigestSha256: sha256(result.executions),
    scenarioSetDigestSha256: sha256(result.scenarios),
    replayDigestSha256: sha256(replay ? { evidenceDigest: replay.evidenceDigest, executions: replay.executions } : []),
  };
  return { snapshots, result, replay, evidence };
}

const LABEL_SECRET = "A87-wallet-registry-key-4f28d9135d5b4c67a949";
const REDACTION_SECRET = "A87-whale-redaction-key-70a2be2d0a434b3bbdd2";
const LABEL_CATEGORIES: HolderCategory[] = ["private_whale", "private_whale", "treasury", "treasury", "team", "team", "exchange", "liquidity_pool"];

function bindingState(index: number): WhaleEvidence["bindingState"] {
  if (index < 230) return "EXACT";
  if (index < 250) return "CONFLICT";
  return "MISSING";
}

function whaleProviderCount(index: number): number {
  if (index < 90) return 3;
  if (index < 150) return 2;
  if (index < 230) return 1;
  return 0;
}

function buildWhaleEvidence(args: { canonicalAssetId: string; symbol: string; index: number; now: Date; marketSnapshots: MarketImpactVenueSnapshot[]; marketAdvancedLocalReady: boolean }) {
  const state = bindingState(args.index);
  const providerCount = whaleProviderCount(args.index);
  const totalSupply = 1_000_000 + args.index * 10_000;
  const priceUsd = 1 + args.index * 0.17;
  const holderRows = state === "EXACT" ? 20 : 0;
  const transferRows = args.index < 200 && state === "EXACT" ? 36 : 0;
  const labeledRows = args.index < 150 && state === "EXACT" ? 8 : 0;
  const clusteredRows = args.index < 90 && state === "EXACT" ? 6 : 0;
  const holders: WhaleHolderSnapshot[] = [];
  const artifacts: WalletLabelRegistryArtifact[] = [];
  let allocated = 0;
  for (let holderIndex = 0; holderIndex < holderRows; holderIndex += 1) {
    const holderId = `0x${String(args.index * 1000 + holderIndex + 1).padStart(40, "0")}`;
    const balance = Math.floor(totalSupply * (holderIndex < 10 ? (0.055 - holderIndex * 0.003) : 0.012));
    allocated += balance;
    const labelVerified = holderIndex < labeledRows;
    const category = labelVerified ? LABEL_CATEGORIES[holderIndex % LABEL_CATEGORIES.length] : "unknown";
    const clusterId = holderIndex < clusteredRows ? `cluster-${args.index}-${Math.floor(holderIndex / 2)}` : undefined;
    const holderProviderFamily = labelVerified ? "arkham_public" : "etherscan";
    const sourceDigest = sha256(`${args.symbol}:holder:${holderIndex}:${holderProviderFamily}`);
    holders.push({
      holderId,
      balance,
      sharePercent: round((balance / totalSupply) * 100, 4),
      category,
      labelVerified,
      clusterId,
      observedAt: args.now.toISOString(),
      providerFamily: holderProviderFamily,
      status: "verified_fixture",
      sourceDigest,
    });
    if (labelVerified) {
      artifacts.push(createWalletLabelRegistryArtifact({
        secret: LABEL_SECRET,
        payload: {
          assetKey: args.symbol,
          holderId,
          category,
          clusterId,
          providerFamily: holderProviderFamily,
          sourceDigest,
          confidencePercent: 92,
          issuedAt: new Date(args.now.getTime() - 60_000).toISOString(),
          expiresAt: new Date(args.now.getTime() + 7 * 24 * 60 * 60_000).toISOString(),
          nonce: `a87-${args.index}-${holderIndex}-nonce-value`,
        },
      }));
    }
  }
  const transfers: WhaleTransferEvent[] = [];
  for (let transferIndex = 0; transferIndex < transferRows; transferIndex += 1) {
    const from = holders[transferIndex % Math.max(1, holders.length)];
    const to = holders[(transferIndex + 3) % Math.max(1, holders.length)];
    const kind = transferIndex % 17 === 0 ? "liquidity_remove" : transferIndex % 13 === 0 ? "bridge" : transferIndex % 11 === 0 ? "mint" : "transfer";
    transfers.push({
      eventId: `${args.symbol}:${transferIndex}`,
      observedAt: new Date(args.now.getTime() - (transferIndex % 20) * 60 * 60_000).toISOString(),
      amountBase: 500 + transferIndex * 13,
      fromHolderId: from?.holderId,
      toHolderId: to?.holderId,
      kind,
      providerFamily: "alchemy",
      status: "verified_fixture",
      sourceDigest: sha256(`${args.symbol}:transfer:${transferIndex}`),
    });
  }
  const receipts: WhaleCapabilityReceipt[] = [];
  if (providerCount >= 1 && holders.length) receipts.push({ capability: "holder_distribution", providerFamily: "etherscan", observedAt: args.now.toISOString(), status: "verified_fixture", recordCount: holders.length, coverageComplete: true, sourceDigest: sha256(`${args.symbol}:holders-receipt`) });
  if (providerCount >= 2 && transfers.length) receipts.push({ capability: "transfer_history", providerFamily: "alchemy", observedAt: args.now.toISOString(), status: "verified_fixture", recordCount: transfers.length, coverageComplete: true, sourceDigest: sha256(`${args.symbol}:transfers-receipt`) });
  if (providerCount >= 3 && artifacts.length) receipts.push({ capability: "wallet_labels", providerFamily: "arkham_public", observedAt: args.now.toISOString(), status: "verified_fixture", recordCount: artifacts.length, coverageComplete: true, sourceDigest: sha256(`${args.symbol}:labels-receipt`) });
  const result = buildWhaleWatchAnalysis({
    assetKey: args.symbol,
    totalSupply,
    priceUsd,
    holders,
    transfers,
    capabilityReceipts: receipts,
    marketImpactSnapshots: args.marketSnapshots,
    redactionSecret: REDACTION_SECRET,
    walletLabelArtifacts: artifacts,
    walletLabelVerificationSecret: LABEL_SECRET,
    now: args.now,
    policy: { allowFixture: true, minimumProviderFamilies: 1, minimumHolderCoveragePercent: 20, minimumVerifiedLabelCoveragePercent: 0, minimumClusterCoveragePercent: 0 },
  });
  assertCondition(verifyWhaleWatchResultIntegrity(result), `a87_whale_result_integrity_invalid:${args.symbol}`);
  const evidence: WhaleEvidence = {
    bindingState: state,
    bindingDigestSha256: sha256({ canonicalAssetId: args.canonicalAssetId, state, chainId: state === "EXACT" ? 1 : null, address: state === "EXACT" ? `0x${String(args.index + 1).padStart(40, "0")}` : null }),
    holderCount: result.holderCount,
    transferCount: result.transferCount,
    providerFamilyCount: result.providerFamilies.length,
    holderCoveragePercent: result.holderCoveragePercent,
    verifiedLabelCoveragePercent: result.verifiedLabelCoveragePercent,
    clusterCoveragePercent: result.clusterCoveragePercent,
    flowWindowCount: result.flowWindows.length,
    alertCount: result.alerts.length,
    exitStressCount: result.holderExitStress.length,
    marketImpactLinked: args.marketAdvancedLocalReady && result.holderExitStress.length > 0,
    holderSetDigestSha256: sha256(holders),
    transferSetDigestSha256: sha256(transfers),
    labelRegistryDigestSha256: result.walletLabelRegistryDigest,
    flowDigestSha256: sha256(result.flowWindows),
    exitStressDigestSha256: sha256(result.holderExitStress),
  };
  return { result, holders, transfers, artifacts, receipts, evidence, allocated };
}

function marketReady(evidence: MarketEvidence, tier: Tier, policy: A87Policy): boolean {
  const requirement = policy.tierRequirements.market_impact[tier];
  return evidence.referenceMidPrice !== null &&
    evidence.venueCount >= requirement.minimumVenues &&
    evidence.providerFamilyCount >= requirement.minimumProviderFamilies &&
    evidence.scenarioCount >= requirement.minimumScenarios &&
    evidence.replayPairCount >= requirement.minimumReplayPairs &&
    evidence.executionCount >= (tier === "advanced" ? 12 : tier === "pro" ? 8 : 2) &&
    (tier !== "advanced" || evidence.largestOrderFillRatio >= 0.95);
}

function whaleReady(evidence: WhaleEvidence, tier: Tier, policy: A87Policy): boolean {
  const requirement = policy.tierRequirements.whale_watch[tier];
  return evidence.bindingState === "EXACT" && evidence.holderCount > 0 &&
    evidence.providerFamilyCount >= requirement.minimumProviderFamilies &&
    evidence.holderCoveragePercent >= requirement.minimumHolderCoveragePercent &&
    evidence.verifiedLabelCoveragePercent >= requirement.minimumLabelCoveragePercent &&
    evidence.clusterCoveragePercent >= requirement.minimumClusterCoveragePercent &&
    (!requirement.requireTransfers || evidence.transferCount > 0) &&
    (!requirement.requireExitStress || (evidence.exitStressCount > 0 && evidence.marketImpactLinked)) &&
    evidence.flowWindowCount === 3;
}

function packetId(canonicalAssetId: string, surface: Surface, tier: Tier): string {
  return `a87:${surface}:${tier}:${sha256(canonicalAssetId).slice(0, 24)}`;
}

function buildProjection(packetIdValue: string, packetDigest: string, channel: Channel): Projection {
  const core = { channel, sourcePacketId: packetIdValue, sourcePacketDigestSha256: packetDigest, addsFacts: false as const, liveProven: false as const, saleEnabled: false as const };
  return { ...core, projectionDigestSha256: sha256(core) };
}

function buildA87Packet(args: { canonicalAssetId: string; symbol: string; surface: Surface; tier: Tier; sourceResultDigest: string; sourceTierPacketDigest: string; evidence: MarketEvidence | WhaleEvidence; policy: A87Policy }): A87Packet {
  const functionalReady = args.surface === "market_impact"
    ? marketReady(args.evidence as MarketEvidence, args.tier, args.policy)
    : whaleReady(args.evidence as WhaleEvidence, args.tier, args.policy);
  const analysisDecision = functionalReady ? "FUNCTIONAL_READY_OFFLINE" as const : "UNAVAILABLE_NOT_FOR_SALE" as const;
  const deliveryDecision = !functionalReady
    ? "EVIDENCE_WITHHELD" as const
    : args.tier === "basic"
      ? "FREE_INFORMATIONAL_ONLY" as const
      : "BLOCKED_REQUIRES_SERVER_ENTITLEMENT" as const;
  const httpStatus = !functionalReady ? 424 as const : args.tier === "basic" ? 200 as const : 403 as const;
  const blockers: string[] = [];
  if (!functionalReady) blockers.push("tier_evidence_floor_not_met");
  blockers.push("fixture_evidence_no_production_credit", "provider_rights_not_approved", "realized_execution_not_validated", "continuous_monitoring_not_executed");
  const id = packetId(args.canonicalAssetId, args.surface, args.tier);
  const provisional = {
    schemaVersion: "velmere.pass36.a87.surface-tier-packet.v1" as const,
    packetId: id,
    canonicalAssetId: args.canonicalAssetId,
    symbol: args.symbol,
    surface: args.surface,
    tier: args.tier,
    sourceResultDigestSha256: args.sourceResultDigest,
    sourceTierPacketDigestSha256: args.sourceTierPacketDigest,
    evidence: args.evidence,
    evidenceBindingDigestSha256: sha256({
      canonicalAssetId: args.canonicalAssetId,
      surface: args.surface,
      tier: args.tier,
      sourceResultDigestSha256: args.sourceResultDigest,
      sourceTierPacketDigestSha256: args.sourceTierPacketDigest,
      evidence: args.evidence,
    }),
    analysisDecision,
    deliveryDecision,
    httpStatus,
    blockers: Array.from(new Set(blockers)).sort(),
    exactA80CandidateBound: false as const,
    currentPublicNetworkExecuted: false as const,
    providerRightsApproved: false as const,
    realizedExecutionValidated: false as const,
    continuousMonitoringExecuted: false as const,
    customerValueProven: false as const,
    paidGateEligible: false as const,
    liveProven: false as const,
    saleEnabled: false as const,
  };
  const sourceDigest = sha256(provisional);
  const projections = CHANNELS.map((channel) => buildProjection(id, sourceDigest, channel));
  const core = { ...provisional, projections };
  return { ...core, packetDigestSha256: sha256(core) };
}

export function verifyA87Packet(packet: MutableA87Packet, policy: A87Policy): boolean {
  try {
    const { packetDigestSha256, ...core } = packet;
    if (!HEX64.test(packetDigestSha256) || sha256(core) !== packetDigestSha256) return false;
    if (packet.schemaVersion !== "velmere.pass36.a87.surface-tier-packet.v1") return false;
    if (!SURFACES.includes(packet.surface) || !TIERS.includes(packet.tier)) return false;
    if (packet.packetId !== packetId(packet.canonicalAssetId, packet.surface, packet.tier)) return false;
    if (![packet.sourceResultDigestSha256, packet.sourceTierPacketDigestSha256, packet.evidenceBindingDigestSha256].every((value) => HEX64.test(value))) return false;
    if (packet.evidenceBindingDigestSha256 !== sha256({
      canonicalAssetId: packet.canonicalAssetId,
      surface: packet.surface,
      tier: packet.tier,
      sourceResultDigestSha256: packet.sourceResultDigestSha256,
      sourceTierPacketDigestSha256: packet.sourceTierPacketDigestSha256,
      evidence: packet.evidence,
    })) return false;
    const expectedReady = packet.surface === "market_impact"
      ? marketReady(packet.evidence as MarketEvidence, packet.tier, policy)
      : whaleReady(packet.evidence as WhaleEvidence, packet.tier, policy);
    if ((packet.analysisDecision === "FUNCTIONAL_READY_OFFLINE") !== expectedReady) return false;
    const expectedDelivery = !expectedReady ? "EVIDENCE_WITHHELD" : packet.tier === "basic" ? "FREE_INFORMATIONAL_ONLY" : "BLOCKED_REQUIRES_SERVER_ENTITLEMENT";
    const expectedHttp = !expectedReady ? 424 : packet.tier === "basic" ? 200 : 403;
    if (packet.deliveryDecision !== expectedDelivery || packet.httpStatus !== expectedHttp) return false;
    if (packet.projections.length !== CHANNELS.length || new Set(packet.projections.map((row) => row.channel)).size !== CHANNELS.length) return false;
    const { projections: _projections, ...provisional } = core;
    const expectedSourceDigest = sha256(provisional);
    for (const projection of packet.projections) {
      const { projectionDigestSha256, ...projectionCore } = projection;
      if (!CHANNELS.includes(projection.channel) || projection.sourcePacketId !== packet.packetId || projection.sourcePacketDigestSha256 !== expectedSourceDigest || projection.addsFacts !== false || projection.liveProven !== false || projection.saleEnabled !== false || sha256(projectionCore) !== projectionDigestSha256) return false;
    }
    if (packet.exactA80CandidateBound || packet.currentPublicNetworkExecuted || packet.providerRightsApproved || packet.realizedExecutionValidated || packet.continuousMonitoringExecuted || packet.customerValueProven || packet.paidGateEligible || packet.liveProven || packet.saleEnabled) return false;
    if (!packet.blockers.includes("fixture_evidence_no_production_credit") || !packet.blockers.includes("provider_rights_not_approved")) return false;
    const values = Object.values(packet.evidence as Record<string, unknown>);
    const digestValues = Object.entries(packet.evidence as Record<string, unknown>).filter(([key]) => key.endsWith("DigestSha256")).map(([, value]) => value);
    if (digestValues.some((value) => typeof value !== "string" || !HEX64.test(value))) return false;
    return values.length > 0;
  } catch {
    return false;
  }
}

function reseal(packet: MutableA87Packet, rebuildProjections = true): MutableA87Packet {
  const {
    packetDigestSha256: _packetDigestSha256,
    projections: existingProjections,
    ...provisional
  } = packet;
  const sourceDigest = sha256(provisional);
  const projections = rebuildProjections
    ? CHANNELS.map((channel) => buildProjection(packet.packetId, sourceDigest, channel))
    : existingProjections;
  const core = { ...provisional, projections };
  return { ...core, packetDigestSha256: sha256(core) };
}

function mutatePacket(packet: A87Packet, family: string): MutableA87Packet {
  const clone: MutableA87Packet = structuredClone(packet);
  if (family === "tier_swap") clone.tier = packet.tier === "basic" ? "pro" : "basic";
  else if (family === "surface_swap") clone.surface = packet.surface === "market_impact" ? "whale_watch" : "market_impact";
  else if (family === "asset_identity_swap") clone.canonicalAssetId = `${packet.canonicalAssetId}:tampered`;
  else if (family === "source_result_digest_swap") clone.sourceResultDigestSha256 = "0".repeat(64);
  else if (family === "source_tier_digest_swap") clone.sourceTierPacketDigestSha256 = "1".repeat(64);
  else if (family === "analysis_decision_promotion") clone.analysisDecision = packet.analysisDecision === "FUNCTIONAL_READY_OFFLINE" ? "UNAVAILABLE_NOT_FOR_SALE" : "FUNCTIONAL_READY_OFFLINE";
  else if (family === "delivery_decision_promotion") clone.deliveryDecision = packet.deliveryDecision === "EVIDENCE_WITHHELD" ? "FREE_INFORMATIONAL_ONLY" : "EVIDENCE_WITHHELD";
  else if (family === "http_status_promotion") clone.httpStatus = packet.httpStatus === 424 ? 200 : 424;
  else if (family === "blocker_removal") clone.blockers = clone.blockers.filter((row: string) => row !== "provider_rights_not_approved");
  else if (family === "evidence_count_inflation") {
    if ("venueCount" in clone.evidence) clone.evidence.venueCount += 3;
    else clone.evidence.holderCount += 100;
  }
  else if (family === "provider_quorum_inflation") clone.evidence.providerFamilyCount += 2;
  else if (family === "binding_or_replay_promotion") {
    if ("replayPairCount" in clone.evidence) clone.evidence.replayPairCount += 1;
    else clone.evidence.bindingState = clone.evidence.bindingState === "EXACT" ? "MISSING" : "EXACT";
  }
  else if (family === "evidence_digest_swap") {
    const key = Object.keys(clone.evidence).find((row) => row.endsWith("DigestSha256"));
    assertCondition(key, "a87_mutation_digest_field_missing");
    Object.assign(clone.evidence, { [key]: "2".repeat(64) });
  }
  else if (family === "projection_adds_fact") clone.projections[0].addsFacts = true;
  else if (family === "projection_source_swap") clone.projections[0].sourcePacketId = `${packet.packetId}:other`;
  else if (family === "paid_gate_enable") clone.paidGateEligible = true;
  else if (family === "live_enable") clone.liveProven = true;
  else if (family === "sale_enable") clone.saleEnabled = true;
  return reseal(clone, family !== "projection_adds_fact" && family !== "projection_source_swap");
}

function checkTierMonotonicity(packets: A87Packet[]): number {
  let failures = 0;
  for (const surface of SURFACES) {
    const byAsset = new Map<string, A87Packet[]>();
    for (const packet of packets.filter((row) => row.surface === surface)) {
      const rows = byAsset.get(packet.canonicalAssetId) ?? [];
      rows.push(packet);
      byAsset.set(packet.canonicalAssetId, rows);
    }
    for (const rows of byAsset.values()) {
      const ready = Object.fromEntries(rows.map((row) => [row.tier, row.analysisDecision === "FUNCTIONAL_READY_OFFLINE"])) as Record<Tier, boolean>;
      if ((ready.pro && !ready.basic) || (ready.advanced && !ready.pro)) failures += 1;
    }
  }
  return failures;
}

export async function runA87FixtureHarness(root: string, policy: A87Policy): Promise<A87Runtime> {
  validatePolicy(root, policy);
  const a84Policy = JSON.parse(readFileSync(path.join(root, "config/pass36/a84-shield-full-catalog-tier-matrix-policy.json"), "utf8"));
  const a84 = await runA84FixtureHarness(root, a84Policy);
  const assets = a84.packets.filter((row) => row.tier === "basic").map((row) => ({ canonicalAssetId: row.canonicalAssetId, symbol: row.symbol }));
  assertCondition(assets.length === 318 && new Set(assets.map((row) => row.canonicalAssetId)).size === 318, "a87_asset_denominator_invalid");
  const now = new Date(policy.deterministicEpoch);
  const packets: A87Packet[] = [];
  let marketImpactVenueSnapshots = 0;
  let marketImpactReplayPairs = 0;
  let whaleHolderRows = 0;
  let whaleTransferRows = 0;
  let walletLabelArtifacts = 0;
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    const market = buildMarketEvidence(asset.symbol, index, now);
    marketImpactVenueSnapshots += market.snapshots.length;
    marketImpactReplayPairs += market.evidence.replayPairCount;
    const marketTierPackets = Object.fromEntries(TIERS.map((tier) => {
      const packet = buildMarketImpactTierPacket(market.result, tier);
      assertCondition(verifyMarketImpactTierPacket(packet), `a87_market_tier_packet_invalid:${asset.symbol}:${tier}`);
      return [tier, packet];
    })) as Record<Tier, ReturnType<typeof buildMarketImpactTierPacket>>;
    const marketAdvancedLocalReady = marketReady(market.evidence, "advanced", policy);
    const whale = buildWhaleEvidence({ ...asset, index, now, marketSnapshots: market.snapshots.filter((row) => row.providerFamily !== "outlier_fixture"), marketAdvancedLocalReady });
    whaleHolderRows += whale.holders.length;
    whaleTransferRows += whale.transfers.length;
    walletLabelArtifacts += whale.artifacts.length;
    const whaleTierPackets = Object.fromEntries(TIERS.map((tier) => {
      const packet = buildWhaleWatchTierPacket(whale.result, tier);
      assertCondition(verifyWhaleWatchTierPacket(packet), `a87_whale_tier_packet_invalid:${asset.symbol}:${tier}`);
      return [tier, packet];
    })) as Record<Tier, ReturnType<typeof buildWhaleWatchTierPacket>>;
    for (const tier of TIERS) {
      packets.push(buildA87Packet({ canonicalAssetId: asset.canonicalAssetId, symbol: asset.symbol, surface: "market_impact", tier, sourceResultDigest: market.result.evidenceDigest, sourceTierPacketDigest: marketTierPackets[tier].packetDigest, evidence: market.evidence, policy }));
      packets.push(buildA87Packet({ canonicalAssetId: asset.canonicalAssetId, symbol: asset.symbol, surface: "whale_watch", tier, sourceResultDigest: whale.result.evidenceDigest, sourceTierPacketDigest: whaleTierPackets[tier].packetDigest, evidence: whale.evidence, policy }));
    }
  }
  const readiness = Object.fromEntries(SURFACES.map((surface) => [surface, Object.fromEntries(TIERS.map((tier) => {
    const ready = packets.filter((row) => row.surface === surface && row.tier === tier && row.analysisDecision === "FUNCTIONAL_READY_OFFLINE").length;
    return [tier, { functionalReadyOffline: ready, unavailable: assets.length - ready, productionEligible: 0 as const }];
  }))])) as A87Runtime["readiness"];
  const mutationFamilyStats: Record<string, { killed: number; survived: number }> = Object.fromEntries(policy.mutationFamilies.map((family) => [family, { killed: 0, survived: 0 }]));
  for (const packet of packets) {
    assertCondition(verifyA87Packet(packet, policy), `a87_packet_invalid:${packet.packetId}`);
    for (const family of policy.mutationFamilies) {
      const mutant = mutatePacket(packet, family);
      if (verifyA87Packet(mutant, policy)) mutationFamilyStats[family].survived += 1;
      else mutationFamilyStats[family].killed += 1;
    }
  }
  const mutationKilled = Object.values(mutationFamilyStats).reduce((sum, row) => sum + row.killed, 0);
  const semanticMutations = packets.length * policy.mutationFamilies.length;
  const invariants = {
    duplicatePacketIds: packets.length - new Set(packets.map((row) => row.packetId)).size,
    missingAssets: assets.filter((asset) => !SURFACES.every((surface) => TIERS.every((tier) => packets.some((row) => row.canonicalAssetId === asset.canonicalAssetId && row.surface === surface && row.tier === tier)))).length,
    tierMonotonicityFailures: checkTierMonotonicity(packets),
    packetSemanticFailures: packets.filter((packet) => !verifyA87Packet(packet, policy)).length,
    projectionParityFailures: packets.filter((packet) => packet.projections.some((projection) => projection.addsFacts || projection.sourcePacketId !== packet.packetId)).length,
    truthBoundaryFailures: packets.filter((packet) => packet.currentPublicNetworkExecuted || packet.providerRightsApproved || packet.realizedExecutionValidated || packet.continuousMonitoringExecuted || packet.paidGateEligible || packet.liveProven || packet.saleEnabled).length,
    mutationSurvivors: Object.values(mutationFamilyStats).reduce((sum, row) => sum + row.survived, 0),
  };
  const realIntake = evaluateA87RealIntake(JSON.parse(readFileSync(path.join(root, policy.realIntakeIndex.path), "utf8")));
  const core = {
    schemaVersion: RUNTIME_SCHEMA,
    revisionId: A87_REVISION,
    parentRevisionId: policy.parentRevisionId,
    generatedAt: policy.deterministicEpoch,
    denominators: {
      activeAssets: assets.length,
      surfaces: SURFACES.length,
      tierPackets: packets.length,
      channelProjections: packets.length * CHANNELS.length,
      marketImpactVenueSnapshots,
      marketImpactReplayPairs,
      whaleHolderRows,
      whaleTransferRows,
      walletLabelArtifacts,
      semanticMutations,
      mutationKilled,
    },
    readiness,
    packets,
    mutationFamilyStats,
    invariants,
    realIntake,
    exactA80CandidateBound: false as const,
    currentProviderEvidenceVerified: false as const,
    providerRightsApproved: false as const,
    productionBrowserExecuted: false as const,
    realizedExecutionValidated: false as const,
    continuousMonitoringExecuted: false as const,
    customerValueProven: false as const,
    paidGateEligible: false as const,
    liveProven: false as const,
    saleEnabled: false as const,
    worldClassProven: false as const,
    truthBoundary: policy.truthBoundary,
  };
  return { ...core, integrity: { algorithm: "sha256", digest: sha256(core) } };
}

export function verifyA87Runtime(runtime: A87Runtime, policy: A87Policy, expectedDigest?: string): boolean {
  try {
    const { integrity, ...core } = runtime;
    if (runtime.schemaVersion !== RUNTIME_SCHEMA || runtime.revisionId !== A87_REVISION || runtime.parentRevisionId !== policy.parentRevisionId) return false;
    if (!HEX64.test(integrity.digest) || integrity.digest !== sha256(core) || (expectedDigest && integrity.digest !== expectedDigest)) return false;
    if (runtime.denominators.activeAssets !== 318 || runtime.denominators.surfaces !== 2 || runtime.denominators.tierPackets !== 1908 || runtime.denominators.channelProjections !== 7632) return false;
    if (runtime.denominators.semanticMutations !== 34344 || runtime.denominators.mutationKilled !== 34344) return false;
    if (runtime.packets.length !== 1908 || new Set(runtime.packets.map((row) => row.packetId)).size !== 1908) return false;
    if (runtime.packets.some((packet) => !verifyA87Packet(packet, policy))) return false;
    if (Object.values(runtime.invariants).some((value) => value !== 0)) return false;
    if (Object.values(runtime.mutationFamilyStats).some((row) => row.survived !== 0)) return false;
    if (runtime.realIntake.decision !== "BLOCKED_REAL_MARKET_IMPACT_WHALE_EVIDENCE") return false;
    if (runtime.exactA80CandidateBound || runtime.currentProviderEvidenceVerified || runtime.providerRightsApproved || runtime.productionBrowserExecuted || runtime.realizedExecutionValidated || runtime.continuousMonitoringExecuted || runtime.customerValueProven || runtime.paidGateEligible || runtime.liveProven || runtime.saleEnabled || runtime.worldClassProven) return false;
    return true;
  } catch {
    return false;
  }
}

export function evaluateA87RealIntake(index: A87RealIntakeIndex | null | undefined) {
  const rows = Array.isArray(index?.rows)
    ? index.rows.filter((row): row is A87RealIntakeRow => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    : [];
  const context = loadRealEvidenceContext(process.cwd());
  const requiredFamilies = [
    "market_impact_packet", "whale_watch_packet", "current_multi_venue_order_books",
    "realized_fill_slippage_comparison", "exact_chain_address_binding", "holder_snapshot",
    "transfer_history", "independent_wallet_labels", "continuous_revalidation_window",
    "provider_rights", "production_browser", "customer_value_label",
  ];
  let fullyVerified = 0;
  let rightsApproved = 0;
  let currentBooks = 0;
  let realizedSlippage = 0;
  let exactBindings = 0;
  let currentHolderTransferLabels = 0;
  let monitoringWindows = 0;
  for (const row of rows) {
    const assetId = String(row?.canonicalAssetId ?? "");
    const physical = row?.terminalState === "AVAILABLE" && verifyPhysicalEvidenceFamilies(row, { context, expectedSubjectId: assetId, requiredFamilies, minimumIndependentOrganizations: 2 }).verified;
    const right = physical && row?.rightsApproved === true;
    const books = physical && row?.currentMultiVenueBooks === true;
    const slippage = physical && row?.realizedSlippageComparison === true;
    const binding = physical && row?.exactChainAddressBinding === true;
    const whale = physical && row?.currentHolderTransferLabelEvidence === true;
    const monitoring = physical && row?.continuousRevalidationWindow === true;
    if (right) rightsApproved += 1;
    if (books) currentBooks += 1;
    if (slippage) realizedSlippage += 1;
    if (binding) exactBindings += 1;
    if (whale) currentHolderTransferLabels += 1;
    if (monitoring) monitoringWindows += 1;
    if (right && books && slippage && binding && whale && monitoring) fullyVerified += 1;
  }
  const uniqueAssetIds = new Set(rows.map((row) => String(row?.canonicalAssetId ?? "")));
  return {
    decision: rows.length === 318 && uniqueAssetIds.size === 318 && !uniqueAssetIds.has("") && fullyVerified === 318 ? "VERIFIED_REAL_MARKET_IMPACT_WHALE_EVIDENCE" : "BLOCKED_REAL_MARKET_IMPACT_WHALE_EVIDENCE",
    rows: rows.length,
    fullyVerified,
    rightsApproved,
    currentBooks,
    realizedSlippage,
    exactBindings,
    currentHolderTransferLabels,
    monitoringWindows,
    paidGateEligible: false,
    liveProven: false,
    saleEnabled: false,
  } as const;
}
