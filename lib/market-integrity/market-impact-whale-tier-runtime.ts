import { canonicalJson } from "../security/canonical-json";
import { sha256Hex } from "../security/cryptographic-digest";
import type { MarketImpactExecution, MarketImpactResult } from "./market-impact-types";
import type { WhaleFlowWindow, WhaleWatchResult } from "./whale-watch-types";

export type MarketIntelligenceTier = "basic" | "pro" | "advanced";

const ORDER: MarketIntelligenceTier[] = ["basic", "pro", "advanced"];

function round(value: number | null | undefined, digits = 4): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function executionView(row: MarketImpactExecution) {
  return {
    side: row.side,
    requestedNotionalUsd: row.requestedNotionalUsd,
    fillRatio: round(row.fillRatio, 6),
    unfilledNotionalUsd: round(row.unfilledNotionalUsd, 2),
    vwap: round(row.vwap, 8),
    impactBps: round(row.impactBps, 4),
    worstPrice: round(row.worstPrice, 8),
    feeUsd: round(row.feeUsd, 4),
    venueContributions: row.venueContributions,
  };
}

function representativeExecutions(result: MarketImpactResult, tier: MarketIntelligenceTier) {
  const notionals = Array.from(new Set(result.executions.map((row) => row.requestedNotionalUsd))).sort((a, b) => a - b);
  const selected = tier === "basic"
    ? notionals.filter((value, index) => index === 0 || index === notionals.length - 1).slice(0, 2)
    : tier === "pro"
      ? notionals.filter((_, index) => index === 0 || index === Math.floor((notionals.length - 1) / 2) || index === notionals.length - 1)
      : notionals;
  return result.executions.filter((row) => selected.includes(row.requestedNotionalUsd)).map(executionView);
}

function worstExecution(result: MarketImpactResult, side: "buy" | "sell") {
  return result.executions
    .filter((row) => row.side === side)
    .sort((a, b) => (Math.abs(b.impactBps ?? 0) - Math.abs(a.impactBps ?? 0)) || b.requestedNotionalUsd - a.requestedNotionalUsd)[0] ?? null;
}

export interface MarketImpactTierPacket {
  schemaVersion: "velmere.market-impact-tier-packet.v1";
  surface: "market_impact";
  tier: MarketIntelligenceTier;
  assetKey: string;
  generatedAt: string;
  sourceResultDigest: string;
  evidenceStatus: MarketImpactResult["evidenceStatus"];
  analysisEligible: boolean;
  paidDeliveryEligible: false;
  sellEnabled: false;
  summary: {
    referenceMidPrice: number | null;
    venueCount: number;
    providerFamilyCount: number;
    crossVenueMidDivergenceBps: number | null;
    bestSpreadBps: number | null;
    visibleBidDepthUsd: number | null;
    visibleAskDepthUsd: number | null;
  };
  executions: ReturnType<typeof executionView>[];
  venueEvidence: MarketImpactResult["venues"] | null;
  depthBands: MarketImpactResult["depthBands"] | null;
  scenarios: MarketImpactResult["scenarios"] | null;
  advancedStress: {
    worstBuy: ReturnType<typeof executionView> | null;
    worstSell: ReturnType<typeof executionView> | null;
    failedScenarioCount: number;
    deepestVenueOutageImpactBps: number | null;
    spreadAndDepthShockImpactBps: number | null;
  } | null;
  monitoringTriggers: string[];
  missingEvidence: string[];
  limitations: string[];
  packetDigest: string;
}

export function buildMarketImpactTierPacket(result: MarketImpactResult, tier: MarketIntelligenceTier): MarketImpactTierPacket {
  if (!ORDER.includes(tier)) throw new Error("market_impact_tier_invalid");
  const representativeDepth = result.depthBands.find((row) => row.bandBps === 100) ?? result.depthBands.at(-1) ?? null;
  const bestSpread = result.venues.length > 0 ? Math.min(...result.venues.map((row) => row.spreadBps)) : null;
  const minimumProviders = tier === "basic" ? 1 : tier === "pro" ? 2 : 3;
  const minimumVenues = tier === "basic" ? 1 : tier === "pro" ? 2 : 3;
  const tierBlockers = [...result.blockers];
  if (result.providerFamilies.length < minimumProviders) tierBlockers.push(`tier_provider_family_floor_not_met:${minimumProviders}`);
  if (result.venues.length < minimumVenues) tierBlockers.push(`tier_venue_floor_not_met:${minimumVenues}`);
  if (tier === "advanced" && !result.advancedReady) tierBlockers.push("advanced_market_impact_result_not_ready");
  const analysisEligible = result.referenceMidPrice !== null && tierBlockers.length === 0;
  const deepest = result.scenarios.find((row) => row.id === "deepest_venue_outage") ?? null;
  const combined = result.scenarios.find((row) => row.id === "spread_x3_depth_minus_50") ?? null;
  const worstBuy = worstExecution(result, "buy");
  const worstSell = worstExecution(result, "sell");
  const core = {
    schemaVersion: "velmere.market-impact-tier-packet.v1" as const,
    surface: "market_impact" as const,
    tier,
    assetKey: result.assetKey,
    generatedAt: result.generatedAt,
    sourceResultDigest: result.evidenceDigest,
    evidenceStatus: result.evidenceStatus,
    analysisEligible,
    paidDeliveryEligible: false as const,
    sellEnabled: false as const,
    summary: {
      referenceMidPrice: result.referenceMidPrice,
      venueCount: result.venues.length,
      providerFamilyCount: result.providerFamilies.length,
      crossVenueMidDivergenceBps: result.crossVenueMidDivergenceBps,
      bestSpreadBps: round(bestSpread, 4),
      visibleBidDepthUsd: round(representativeDepth?.bidDepthUsd, 2),
      visibleAskDepthUsd: round(representativeDepth?.askDepthUsd, 2),
    },
    executions: representativeExecutions(result, tier),
    venueEvidence: tier === "basic" ? null : result.venues,
    depthBands: tier === "basic" ? null : result.depthBands,
    scenarios: tier === "advanced" ? result.scenarios : tier === "pro" ? result.scenarios.filter((row) => ["visible_depth_minus_50", "deepest_venue_outage"].includes(row.id)) : null,
    advancedStress: tier === "advanced" ? {
      worstBuy: worstBuy ? executionView(worstBuy) : null,
      worstSell: worstSell ? executionView(worstSell) : null,
      failedScenarioCount: result.scenarios.filter((row) => row.largestBuy.fillRatio < 0.95 || row.largestSell.fillRatio < 0.95).length,
      deepestVenueOutageImpactBps: round(deepest?.largestSell.impactBps, 4),
      spreadAndDepthShockImpactBps: round(combined?.largestSell.impactBps, 4),
    } : null,
    monitoringTriggers: tier === "advanced" ? [
      "cross_venue_divergence_above_policy",
      "spread_above_policy",
      "depth_loss_above_50_percent",
      "largest_order_fill_below_95_percent",
      "deepest_venue_unavailable",
      "stable_quote_deviation_above_policy",
    ] : [],
    missingEvidence: Array.from(new Set(tierBlockers)).sort(),
    limitations: [
      "visible order-book depth is not guaranteed executable liquidity",
      "simulations exclude latency, queue position and hidden liquidity",
      "market impact is informational analysis, not execution advice",
      ...(tier === "basic" ? ["Basic excludes venue-level ladders and stress matrix"] : []),
      ...(tier === "pro" ? ["Pro excludes full monitoring handoff and full stress matrix"] : []),
    ],
  };
  return { ...core, packetDigest: sha256Hex(canonicalJson(core)) };
}

export function verifyMarketImpactTierPacket(packet: MarketImpactTierPacket): boolean {
  const { packetDigest, ...core } = packet;
  return /^[a-f0-9]{64}$/.test(packetDigest) && packetDigest === sha256Hex(canonicalJson(core)) && packet.paidDeliveryEligible === false && packet.sellEnabled === false;
}

function flow(result: WhaleWatchResult, window: WhaleFlowWindow["window"]): WhaleFlowWindow | null {
  return result.flowWindows.find((row) => row.window === window) ?? null;
}

export interface WhaleWatchTierPacket {
  schemaVersion: "velmere.whale-watch-tier-packet.v1";
  surface: "whale_watch";
  tier: MarketIntelligenceTier;
  assetKey: string;
  generatedAt: string;
  sourceResultDigest: string;
  evidenceStatus: WhaleWatchResult["evidenceStatus"];
  analysisEligible: boolean;
  paidDeliveryEligible: false;
  sellEnabled: false;
  coverage: {
    holderCount: number;
    transferCount: number;
    providerFamilyCount: number;
    holderCoveragePercent: number;
    verifiedLabelCoveragePercent: number | null;
    clusterCoveragePercent: number | null;
  };
  concentration: {
    raw: WhaleWatchResult["rawConcentration"];
    adjusted: WhaleWatchResult["adjustedConcentration"] | null;
  };
  flowWindows: WhaleFlowWindow[];
  alerts: WhaleWatchResult["alerts"];
  holderExitStress: WhaleWatchResult["holderExitStress"] | null;
  evidenceTrace: {
    sourceObservationTimes: WhaleWatchResult["sourceObservationTimes"];
    walletLabelRegistryDigest: string;
    verifiedWalletLabelArtifactCount: number;
  } | null;
  monitoringTriggers: string[];
  missingEvidence: string[];
  limitations: string[];
  packetDigest: string;
}

export function buildWhaleWatchTierPacket(result: WhaleWatchResult, tier: MarketIntelligenceTier): WhaleWatchTierPacket {
  if (!ORDER.includes(tier)) throw new Error("whale_watch_tier_invalid");
  const minimumProviders = tier === "basic" ? 1 : tier === "pro" ? 2 : 3;
  const blockers = [...result.blockers];
  if (result.providerFamilies.length < minimumProviders) blockers.push(`tier_provider_family_floor_not_met:${minimumProviders}`);
  if (tier !== "basic" && result.verifiedLabelCoveragePercent < 30) blockers.push("verified_label_coverage_below_pro_floor");
  if (tier === "advanced" && result.clusterCoveragePercent < 20) blockers.push("verified_cluster_coverage_below_advanced_floor");
  if (tier === "advanced" && result.holderExitStress.length === 0) blockers.push("holder_exit_stress_required");
  if (tier === "advanced" && !result.advancedReady) blockers.push("advanced_whale_watch_result_not_ready");
  const analysisEligible = result.holderCount > 0 && blockers.length === 0;
  const selectedFlows = tier === "basic"
    ? [flow(result, "24h")].filter((row): row is WhaleFlowWindow => row !== null)
    : tier === "pro"
      ? [flow(result, "24h"), flow(result, "7d"), flow(result, "30d")].filter((row): row is WhaleFlowWindow => row !== null)
      : result.flowWindows;
  const core = {
    schemaVersion: "velmere.whale-watch-tier-packet.v1" as const,
    surface: "whale_watch" as const,
    tier,
    assetKey: result.assetKey,
    generatedAt: result.generatedAt,
    sourceResultDigest: result.evidenceDigest,
    evidenceStatus: result.evidenceStatus,
    analysisEligible,
    paidDeliveryEligible: false as const,
    sellEnabled: false as const,
    coverage: {
      holderCount: result.holderCount,
      transferCount: result.transferCount,
      providerFamilyCount: result.providerFamilies.length,
      holderCoveragePercent: result.holderCoveragePercent,
      verifiedLabelCoveragePercent: tier === "basic" ? null : result.verifiedLabelCoveragePercent,
      clusterCoveragePercent: tier === "advanced" ? result.clusterCoveragePercent : null,
    },
    concentration: {
      raw: result.rawConcentration,
      adjusted: tier === "basic" ? null : result.adjustedConcentration,
    },
    flowWindows: selectedFlows,
    alerts: tier === "basic" ? result.alerts.slice(0, 3) : result.alerts,
    holderExitStress: tier === "advanced" ? result.holderExitStress : null,
    evidenceTrace: tier === "advanced" ? {
      sourceObservationTimes: result.sourceObservationTimes,
      walletLabelRegistryDigest: result.walletLabelRegistryDigest,
      verifiedWalletLabelArtifactCount: result.verifiedWalletLabelArtifactCount,
    } : null,
    monitoringTriggers: tier === "advanced" ? [
      "exchange_net_inflow_spike",
      "treasury_to_exchange_transfer",
      "large_holder_exit_stress_failure",
      "liquidity_removed_spike",
      "mint_burn_anomaly",
      "wallet_label_or_cluster_conflict",
      "holder_coverage_drop",
    ] : [],
    missingEvidence: Array.from(new Set(blockers)).sort(),
    limitations: [
      "public wallet activity does not prove beneficial ownership or intent",
      "unverified labels are treated as unknown",
      "flow windows may be incomplete when provider history is partial",
      "whale analysis is informational and not a prediction of price direction",
      ...(tier === "basic" ? ["Basic excludes verified entity flows, clustering and exit stress"] : []),
      ...(tier === "pro" ? ["Pro excludes holder exit-stress execution and full evidence trace"] : []),
    ],
  };
  return { ...core, packetDigest: sha256Hex(canonicalJson(core)) };
}

export function verifyWhaleWatchTierPacket(packet: WhaleWatchTierPacket): boolean {
  const { packetDigest, ...core } = packet;
  return /^[a-f0-9]{64}$/.test(packetDigest) && packetDigest === sha256Hex(canonicalJson(core)) && packet.paidDeliveryEligible === false && packet.sellEnabled === false;
}
