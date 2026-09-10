/**
 * Velmère Proprietary Quantitative & Security Algorithms
 *
 * Implements the 8 foundational Velmère mathematical models:
 * 1. Velmère Provider Consensus Score (VPCS)
 * 2. Velmère Liquidity Stress Index (VLSI)
 * 3. Velmère Governance Power Index (VGPI)
 * 4. Velmère Oracle Fragility Score (VOFS)
 * 5. Velmère Exit Risk (VER)
 * 6. Velmère Data Confidence Score (VDCS)
 * 7. Velmère Systemic Correlation Score (VSCS)
 * 8. Velmère Liquidity Drawdown Shock (VLDS)
 *
 * All formulas are mathematically bounded in [0, 100], strictly normalized,
 * deterministic, and accompanied by cryptographic provenance and uncertainty metrics.
 */

import { canonicalJson } from "../security/canonical-json";
import { sha256Hex } from "../security/cryptographic-digest";

export const VELMERE_ALGORITHMS_VERSION = "2026.09-vlm.prop.v2" as const;

// ============================================================================
// 1. VELMÈRE PROVIDER CONSENSUS SCORE (VPCS)
// ============================================================================

export interface ProviderObservationInput {
  providerId: string;
  priceUsd: number;
  weight?: number; // default: 1.0
  observedAtMs: number;
}

export interface ProviderConsensusResult {
  score: number; // 0 - 100
  weightedMedianPrice: number;
  weightedMadPct: number; // percentage (e.g. 0.05 for 0.05%)
  maxLatencySkewMs: number;
  sampleCount: number;
  agreementGrade: "INSTITUTIONAL_CONSENSUS" | "STRONG" | "DIVERGENT" | "ANOMALOUS_SPLIT";
  evidenceDigest: string;
}

/**
 * Calculates the Velmère Provider Consensus Score (VPCS).
 * Penalizes price dispersion and timestamp skew across independent market providers.
 */
export function calculateVelmereProviderConsensus(
  observations: ProviderObservationInput[],
  maxAllowedSkewMs = 60_000,
): ProviderConsensusResult {
  if (!observations || observations.length === 0) {
    return {
      score: 0,
      weightedMedianPrice: 0,
      weightedMadPct: 100,
      maxLatencySkewMs: 0,
      sampleCount: 0,
      agreementGrade: "ANOMALOUS_SPLIT",
      evidenceDigest: sha256Hex("vpcs:empty"),
    };
  }

  const validObs = observations.filter(
    (o) => typeof o.priceUsd === "number" && Number.isFinite(o.priceUsd) && o.priceUsd > 0,
  );

  if (validObs.length === 0) {
    return {
      score: 0,
      weightedMedianPrice: 0,
      weightedMadPct: 100,
      maxLatencySkewMs: 0,
      sampleCount: 0,
      agreementGrade: "ANOMALOUS_SPLIT",
      evidenceDigest: sha256Hex("vpcs:no_valid_prices"),
    };
  }

  if (validObs.length === 1) {
    return {
      score: 50, // Single source cannot establish multi-source consensus
      weightedMedianPrice: validObs[0].priceUsd,
      weightedMadPct: 0,
      maxLatencySkewMs: 0,
      sampleCount: 1,
      agreementGrade: "STRONG",
      evidenceDigest: sha256Hex(canonicalJson(validObs)),
    };
  }

  // Sort by price for weighted median
  const sorted = [...validObs].sort((a, b) => a.priceUsd - b.priceUsd);
  let totalWeight = sorted.reduce((sum, o) => {
    const w = typeof o.weight === "number" && Number.isFinite(o.weight) && o.weight > 0 ? o.weight : 0;
    return sum + w;
  }, 0);
  const useUniformWeight = totalWeight <= 0;
  if (useUniformWeight) {
    totalWeight = sorted.length;
  }

  // Compute weighted median
  let cumWeight = 0;
  let medianPrice = sorted[0].priceUsd;
  for (const item of sorted) {
    const itemWeight = useUniformWeight
      ? 1.0
      : (typeof item.weight === "number" && Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 0);
    cumWeight += itemWeight;
    if (cumWeight >= totalWeight / 2) {
      medianPrice = item.priceUsd;
      break;
    }
  }

  // Compute Weighted Mean Absolute Deviation (WMAD) relative to median
  let weightedMadSum = 0;
  for (const item of sorted) {
    const itemWeight = useUniformWeight
      ? 1.0
      : (typeof item.weight === "number" && Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 0);
    const w = itemWeight / totalWeight;
    weightedMadSum += w * (Math.abs(item.priceUsd - medianPrice) / (medianPrice > 0 ? medianPrice : 1));
  }
  const weightedMadPct = weightedMadSum * 100;

  // Compute Latency Skew
  const timestamps = sorted.map((o) => o.observedAtMs);
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const latencySkewMs = Math.max(0, maxTs - minTs);
  const latencyPenalty = Math.min(1, latencySkewMs / maxAllowedSkewMs);

  const sampleFactor = sorted.length >= 4
    ? 1.0
    : sorted.length === 3
      ? 0.95
      : 0.85;
  const dispersionDecay = Math.exp(-50 * weightedMadSum - 0.5 * latencyPenalty);
  const rawScore = 100 * dispersionDecay * sampleFactor;
  const score = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

  let agreementGrade: ProviderConsensusResult["agreementGrade"] = "ANOMALOUS_SPLIT";
  if (score >= 90 && weightedMadPct < 0.25) agreementGrade = "INSTITUTIONAL_CONSENSUS";
  else if (score >= 70 && weightedMadPct < 1.0) agreementGrade = "STRONG";
  else if (score >= 40) agreementGrade = "DIVERGENT";

  return {
    score,
    weightedMedianPrice: Math.round(medianPrice * 10_000) / 10_000,
    weightedMadPct: Math.round(weightedMadPct * 1000) / 1000,
    maxLatencySkewMs: latencySkewMs,
    sampleCount: sorted.length,
    agreementGrade,
    evidenceDigest: sha256Hex(canonicalJson({ sorted, score, medianPrice, weightedMadPct })),
  };
}

// ============================================================================
// 2. VELMÈRE LIQUIDITY STRESS INDEX (VLSI)
// ============================================================================

export interface OrderBookSideInput {
  price: number;
  quantity: number;
}

export interface LiquidityStressResult {
  score: number; // 0 - 100 (100 = deep institutional resilience, 0 = severe illiquidity)
  slippage10kPct: number;
  slippage50kPct: number;
  slippage250kPct: number;
  slippage1mPct: number;
  bidAskImbalancePct: number;
  resilienceTier: "INSTITUTIONAL_DEEP" | "MODERATE" | "FRAGILE_THIN" | "CRITICAL_ILLIQUID";
  evidenceDigest: string;
}

function simulateBookSlippage(levels: OrderBookSideInput[], notionalUsd: number, midPrice: number): number {
  if (
    !levels ||
    levels.length === 0 ||
    !Number.isFinite(midPrice) ||
    midPrice <= 0 ||
    !Number.isFinite(notionalUsd) ||
    notionalUsd <= 0
  ) {
    return 100;
  }

  let remainingUsd = notionalUsd;
  let totalBaseAcquired = 0;
  let totalSpentUsd = 0;

  for (const lvl of levels) {
    if (!Number.isFinite(lvl.price) || !Number.isFinite(lvl.quantity) || lvl.price <= 0 || lvl.quantity <= 0) continue;
    const lvlValue = lvl.price * lvl.quantity;
    const takeValue = Math.min(remainingUsd, lvlValue);
    const takeBase = takeValue / lvl.price;

    totalSpentUsd += takeValue;
    totalBaseAcquired += takeBase;
    remainingUsd -= takeValue;

    if (remainingUsd <= 0) break;
  }

  if (remainingUsd > 0) {
    const deficitRatio = remainingUsd / notionalUsd;
    return Math.min(100, 25 + 75 * deficitRatio);
  }

  if (totalBaseAcquired <= 0) return 100;
  const effectiveExecutionPrice = totalSpentUsd / totalBaseAcquired;
  const slippagePct = (Math.abs(effectiveExecutionPrice - midPrice) / midPrice) * 100;
  return Number.isFinite(slippagePct) ? Math.max(0, slippagePct) : 100;
}

/**
 * Calculates the Velmère Liquidity Stress Index (VLSI).
 * Evaluates market resilience across 4 standardized stress capital brackets: $10k, $50k, $250k, $1M.
 */
export function calculateVelmereLiquidityStress(
  bids: OrderBookSideInput[],
  asks: OrderBookSideInput[],
  midPrice?: number,
): LiquidityStressResult {
  const validBids = (bids || []).filter(
    (b) => Number.isFinite(b.price) && Number.isFinite(b.quantity) && b.price > 0 && b.quantity > 0,
  );
  const validAsks = (asks || []).filter(
    (a) => Number.isFinite(a.price) && Number.isFinite(a.quantity) && a.price > 0 && a.quantity > 0,
  );
  const bestBid = validBids.length > 0 ? Math.max(...validBids.map((b) => b.price)) : 0;
  const bestAsk = validAsks.length > 0 ? Math.min(...validAsks.map((a) => a.price)) : 0;
  const candidateMid = typeof midPrice === "number" && Number.isFinite(midPrice) && midPrice > 0 ? midPrice : undefined;
  const effectiveMid = candidateMid ?? (bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : bestBid || bestAsk);

  if (effectiveMid <= 0 || (bids.length === 0 && asks.length === 0)) {
    return {
      score: 0,
      slippage10kPct: 100,
      slippage50kPct: 100,
      slippage250kPct: 100,
      slippage1mPct: 100,
      bidAskImbalancePct: 100,
      resilienceTier: "CRITICAL_ILLIQUID",
      evidenceDigest: sha256Hex("vlsi:empty"),
    };
  }

  const slip10k = simulateBookSlippage(bids, 10_000, effectiveMid);
  const slip50k = simulateBookSlippage(bids, 50_000, effectiveMid);
  const slip250k = simulateBookSlippage(bids, 250_000, effectiveMid);
  const slip1m = simulateBookSlippage(bids, 1_000_000, effectiveMid);

  const totalBidDepthUsd = bids.reduce((acc, b) => acc + (b.price * b.quantity), 0);
  const totalAskDepthUsd = asks.reduce((acc, a) => acc + (a.price * a.quantity), 0);
  const totalDepth = totalBidDepthUsd + totalAskDepthUsd;
  const imbalancePct = totalDepth > 0
    ? (Math.abs(totalBidDepthUsd - totalAskDepthUsd) / totalDepth) * 100
    : 100;

  const p10k = Math.min(1, slip10k / 0.5);
  const p50k = Math.min(1, slip50k / 1.5);
  const p250k = Math.min(1, slip250k / 5.0);
  const p1m = Math.min(1, slip1m / 12.0);

  const weightedPenalty = 0.15 * p10k + 0.25 * p50k + 0.30 * p250k + 0.30 * p1m;
  const baseResilience = 100 * (1 - weightedPenalty);
  const asymmetryDeduction = 0.25 * (imbalancePct / 100);
  const rawScore = baseResilience * (1 - asymmetryDeduction);
  const score = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

  let resilienceTier: LiquidityStressResult["resilienceTier"] = "CRITICAL_ILLIQUID";
  if (score >= 85) resilienceTier = "INSTITUTIONAL_DEEP";
  else if (score >= 60) resilienceTier = "MODERATE";
  else if (score >= 30) resilienceTier = "FRAGILE_THIN";

  return {
    score,
    slippage10kPct: Math.round(slip10k * 100) / 100,
    slippage50kPct: Math.round(slip50k * 100) / 100,
    slippage250kPct: Math.round(slip250k * 100) / 100,
    slippage1mPct: Math.round(slip1m * 100) / 100,
    bidAskImbalancePct: Math.round(imbalancePct * 10) / 10,
    resilienceTier,
    evidenceDigest: sha256Hex(canonicalJson({ score, slip10k, slip50k, slip250k, slip1m, imbalancePct })),
  };
}

// ============================================================================
// 3. VELMÈRE GOVERNANCE POWER INDEX (VGPI)
// ============================================================================

export type OwnerGovernanceType =
  | "zero_address_renounced"
  | "timelocked_multisig"
  | "dao_onchain_voting"
  | "standard_multisig"
  | "eoa_unilateral";

export type ProxyArchitectureType =
  | "immutable_no_proxy"
  | "timelocked_beacon_uups"
  | "transparent_proxy_with_timelock"
  | "unrestricted_custom_proxy";

export interface GovernancePrivilegesInput {
  ownerType: OwnerGovernanceType;
  proxyType: ProxyArchitectureType;
  canMint: boolean;
  canPause: boolean;
  canBlacklist: boolean;
  canChangeFee: boolean;
  canWithdrawLiquidity: boolean;
  multisigThreshold?: { required: number; total: number };
  timelockDelayHours?: number;
}

export interface GovernancePowerResult {
  score: number; // 0 - 100 (100 = completely decentralized & immutable, 0 = dictatorial unilateral control)
  centralizationRiskPct: number;
  timelockProtectionHours: number;
  privilegeSeverityCount: number;
  powerRating: "DECENTRALIZED_DEFENSIBLE" | "GOVERNED_PRUDENT" | "ELEVATED_CONTROL" | "UNILATERAL_EXPLOIT_RISK";
  evidenceDigest: string;
}

/**
 * Calculates the Velmère Governance Power Index (VGPI).
 * Formally evaluates privilege risk, proxy vectors, and multi-sig/timelock thresholds.
 */
export function calculateVelmereGovernancePower(input: GovernancePrivilegesInput): GovernancePowerResult {
  const ownerRiskMap: Record<OwnerGovernanceType, number> = {
    zero_address_renounced: 0.0,
    timelocked_multisig: 0.15,
    dao_onchain_voting: 0.25,
    standard_multisig: 0.45,
    eoa_unilateral: 1.0,
  };

  const proxyRiskMap: Record<ProxyArchitectureType, number> = {
    immutable_no_proxy: 0.0,
    timelocked_beacon_uups: 0.25,
    transparent_proxy_with_timelock: 0.45,
    unrestricted_custom_proxy: 0.90,
  };

  const ownerRisk = ownerRiskMap[input.ownerType] ?? 0.8;
  const proxyRisk = proxyRiskMap[input.proxyType] ?? 0.5;

  const privileges = [
    { active: input.canWithdrawLiquidity, weight: 1.0 },
    { active: input.canMint, weight: 0.8 },
    { active: input.canBlacklist, weight: 0.6 },
    { active: input.canPause, weight: 0.5 },
    { active: input.canChangeFee, weight: 0.3 },
  ];

  const activePrivilegeCount = privileges.filter((p) => p.active).length;
  const totalPrivilegeRisk = privileges.reduce((acc, p) => acc + (p.active ? p.weight : 0), 0) / 3.2;

  const timelockHours = Number.isFinite(input.timelockDelayHours) ? Math.max(0, input.timelockDelayHours ?? 0) : 0;
  const timelockMitigation = timelockHours >= 48 ? 0.25 : timelockHours >= 24 ? 0.15 : 0;

  let multisigBonus = 0;
  if (
    input.multisigThreshold &&
    Number.isFinite(input.multisigThreshold.total) &&
    input.multisigThreshold.total > 1
  ) {
    const req = Number.isFinite(input.multisigThreshold.required) ? input.multisigThreshold.required : 1;
    const ratio = Math.max(0, Math.min(1.0, req / input.multisigThreshold.total));
    if (ratio >= 0.6 && req >= 3) multisigBonus = 0.15;
    else if (ratio >= 0.5) multisigBonus = 0.08;
  }

  const combinedRisk = Math.max(
    0,
    Math.min(1.0, 0.35 * ownerRisk + 0.30 * proxyRisk + 0.35 * totalPrivilegeRisk - timelockMitigation - multisigBonus),
  );

  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - combinedRisk) * 10) / 10));
  const centralizationRiskPct = Math.round(combinedRisk * 1000) / 10;

  let powerRating: GovernancePowerResult["powerRating"] = "UNILATERAL_EXPLOIT_RISK";
  if (score >= 85) powerRating = "DECENTRALIZED_DEFENSIBLE";
  else if (score >= 60) powerRating = "GOVERNED_PRUDENT";
  else if (score >= 35) powerRating = "ELEVATED_CONTROL";

  return {
    score,
    centralizationRiskPct,
    timelockProtectionHours: timelockHours,
    privilegeSeverityCount: activePrivilegeCount,
    powerRating,
    evidenceDigest: sha256Hex(canonicalJson({ input, score, combinedRisk })),
  };
}

// ============================================================================
// 4. VELMÈRE ORACLE FRAGILITY SCORE (VOFS)
// ============================================================================

export type OracleSourceMechanism =
  | "decentralized_aggregator_twap"
  | "dex_twap_30m_plus"
  | "dex_twap_short_5m"
  | "dex_spot_reserves_direct";

export interface OracleConfigInput {
  mechanism: OracleSourceMechanism;
  independentFeedsCount: number;
  heartbeatSeconds: number;
  poolTvlUsd: number;
  capitalCostToManipulate2PctUsd: number;
}

export interface OracleFragilityResult {
  score: number; // 0 - 100 (0 = highly resilient, 100 = critical flash-loan vulnerable)
  manipulationCostRatio: number;
  latencyHeartbeatPenalty: number;
  exploitabilityTier: "ROBUST_DEFENSIBLE" | "MODERATE_EXPOSURE" | "ELEVATED_VULNERABILITY" | "IMMEDIATE_FLASH_LOAN_RISK";
  evidenceDigest: string;
}

/**
 * Calculates the Velmère Oracle Fragility Score (VOFS).
 * Formulates the economic capital cost required to distort the price feed by 2%.
 */
export function calculateVelmereOracleFragility(input: OracleConfigInput): OracleFragilityResult {
  const mechanismRisk: Record<OracleSourceMechanism, number> = {
    decentralized_aggregator_twap: 0.05,
    dex_twap_30m_plus: 0.25,
    dex_twap_short_5m: 0.60,
    dex_spot_reserves_direct: 0.95,
  };

  const mechRisk = mechanismRisk[input.mechanism] ?? 0.5;

  const diversityRisk = !Number.isFinite(input.independentFeedsCount) || input.independentFeedsCount <= 1
    ? 1.0
    : input.independentFeedsCount === 2
      ? 0.45
      : 0.10;

  const validHeartbeat = Number.isFinite(input.heartbeatSeconds) ? Math.max(0, input.heartbeatSeconds) : 86400;
  const heartbeatRisk = Math.min(1.0, Math.max(0, (validHeartbeat - 60) / 3600));

  const capitalCost = Number.isFinite(input.capitalCostToManipulate2PctUsd)
    ? Math.max(0, input.capitalCostToManipulate2PctUsd)
    : 0;
  const economicManipulationRisk = capitalCost >= 10_000_000
    ? 0.02
    : capitalCost >= 2_000_000
      ? 0.15
      : capitalCost >= 500_000
        ? 0.45
        : capitalCost >= 100_000
          ? 0.75
          : 0.98;

  const rawFragility = 0.35 * mechRisk + 0.25 * diversityRisk + 0.15 * heartbeatRisk + 0.25 * economicManipulationRisk;
  const score = Math.max(0, Math.min(100, Math.round(100 * rawFragility * 10) / 10));

  let exploitabilityTier: OracleFragilityResult["exploitabilityTier"] = "IMMEDIATE_FLASH_LOAN_RISK";
  if (score <= 20) exploitabilityTier = "ROBUST_DEFENSIBLE";
  else if (score <= 45) exploitabilityTier = "MODERATE_EXPOSURE";
  else if (score <= 70) exploitabilityTier = "ELEVATED_VULNERABILITY";

  return {
    score,
    manipulationCostRatio: Math.round(economicManipulationRisk * 100) / 100,
    latencyHeartbeatPenalty: Math.round(heartbeatRisk * 100) / 100,
    exploitabilityTier,
    evidenceDigest: sha256Hex(canonicalJson({ input, score, rawFragility })),
  };
}

// ============================================================================
// 5. VELMÈRE EXIT RISK (VER)
// ============================================================================

export interface AssetExitInput {
  isHoneypot: boolean;
  buyTaxPct: number;
  sellTaxPct: number;
  tradingCooldown: boolean;
  canBlacklistUser: boolean;
  percentLiquidityLocked: number; // 0 - 100
  top10HoldersPercentExcludingPools: number; // 0 - 100
  maxTransferPercentSupply?: number;
}

export interface ExitRiskResult {
  score: number; // 0 - 100 (0 = completely unhindered exit, 100 = complete lockup / honeypot)
  taxBurdenPct: number;
  concentrationRiskPct: number;
  liquidityLockedPct: number;
  exitTier: "UNRESTRICTED_LIQUID" | "ACCEPTABLE_FRICTION" | "HEAVY_FRICTION" | "HONEYPOT_LOCKUP";
  evidenceDigest: string;
}

/**
 * Calculates the Velmère Exit Risk (VER).
 * Formulates the probability and frictional cost of liquidating positions into base reserves.
 */
export function calculateVelmereExitRisk(input: AssetExitInput): ExitRiskResult {
  if (input.isHoneypot) {
    return {
      score: 100,
      taxBurdenPct: 100,
      concentrationRiskPct: 100,
      liquidityLockedPct: 0,
      exitTier: "HONEYPOT_LOCKUP",
      evidenceDigest: sha256Hex("ver:honeypot"),
    };
  }

  const buyTax = Number.isFinite(input.buyTaxPct) ? Math.max(0, input.buyTaxPct) : 0;
  const sellTax = Number.isFinite(input.sellTaxPct) ? Math.max(0, input.sellTaxPct) : 0;
  const taxSum = buyTax + sellTax;
  const taxRisk = Math.min(1.0, taxSum / 30);

  let restrictionRisk = 0;
  if (input.canBlacklistUser) restrictionRisk += 0.40;
  if (input.tradingCooldown) restrictionRisk += 0.20;
  if (
    typeof input.maxTransferPercentSupply === "number" &&
    Number.isFinite(input.maxTransferPercentSupply) &&
    input.maxTransferPercentSupply < 1.0
  ) {
    restrictionRisk += 0.25;
  }

  const lockedFraction = Number.isFinite(input.percentLiquidityLocked)
    ? Math.max(0, Math.min(100, input.percentLiquidityLocked)) / 100
    : 0;
  const liquidityUnlockedRisk = 1.0 - lockedFraction;

  const top10Concentration = Number.isFinite(input.top10HoldersPercentExcludingPools)
    ? Math.max(0, Math.min(100, input.top10HoldersPercentExcludingPools)) / 100
    : 0.5;

  const rawExitRisk = 0.35 * taxRisk + 0.25 * restrictionRisk + 0.20 * liquidityUnlockedRisk + 0.20 * top10Concentration;
  const score = Math.max(0, Math.min(100, Math.round(100 * rawExitRisk * 10) / 10));

  let exitTier: ExitRiskResult["exitTier"] = "HONEYPOT_LOCKUP";
  if (score <= 15) exitTier = "UNRESTRICTED_LIQUID";
  else if (score <= 40) exitTier = "ACCEPTABLE_FRICTION";
  else if (score <= 70) exitTier = "HEAVY_FRICTION";

  return {
    score,
    taxBurdenPct: Math.round(taxSum * 10) / 10,
    concentrationRiskPct: Math.round(top10Concentration * 1000) / 10,
    liquidityLockedPct: Math.round(lockedFraction * 1000) / 10,
    exitTier,
    evidenceDigest: sha256Hex(canonicalJson({ input, score, rawExitRisk })),
  };
}

// ============================================================================
// 6. VELMÈRE DATA CONFIDENCE SCORE (VDCS)
// ============================================================================

export interface DataQualityTelemetryInput {
  providerConsensusScore: number; // VPCS (0 - 100)
  ageMs: number;
  signedReceiptsCount: number;
  totalDataPoints: number;
  deterministicReplayVerified: boolean;
  circuitBreakerTripped?: boolean;
}

export interface DataConfidenceResult {
  score: number; // 0 - 100 (100 = impeccable institutional attestation, 0 = untrusted/stale)
  freshnessMultiplier: number; // [0, 1]
  provenanceMultiplier: number; // [0, 1]
  confidenceGrade: "INSTITUTIONAL_DEFENSIBLE" | "HIGH_ASSURANCE" | "PROVISIONAL" | "UNTRUSTED_FAIL_CLOSED";
  evidenceDigest: string;
}

/**
 * Calculates the Velmère Data Confidence Score (VDCS).
 * Multi-dimensional meta-metric combining provider consensus, freshness decay, cryptographic provenance, and replayability.
 */
export function calculateVelmereDataConfidence(input: DataQualityTelemetryInput): DataConfidenceResult {
  if (input.circuitBreakerTripped) {
    return {
      score: 0,
      freshnessMultiplier: 0,
      provenanceMultiplier: 0,
      confidenceGrade: "UNTRUSTED_FAIL_CLOSED",
      evidenceDigest: sha256Hex("vdcs:circuit_breaker_tripped"),
    };
  }

  const consensus = Number.isFinite(input.providerConsensusScore) ? input.providerConsensusScore : 0;
  const normConsensus = Math.max(0, Math.min(100, consensus)) / 100;
  const validAgeMs = Number.isFinite(input.ageMs) ? Math.max(0, input.ageMs) : 3_600_000;
  const freshnessMultiplier = Math.exp(-validAgeMs / 180_000);
  const totalPoints = Number.isFinite(input.totalDataPoints) ? input.totalDataPoints : 0;
  const signedCount = Number.isFinite(input.signedReceiptsCount) ? input.signedReceiptsCount : 0;
  const provenanceMultiplier = totalPoints > 0
    ? Math.min(1.0, Math.max(0, signedCount / totalPoints))
    : 0.5;
  const replayMultiplier = input.deterministicReplayVerified ? 1.0 : 0.4;

  const rawConfidence = 100 * (
    0.35 * normConsensus +
    0.25 * freshnessMultiplier +
    0.20 * provenanceMultiplier +
    0.20 * replayMultiplier
  );

  const score = Math.max(0, Math.min(100, Math.round(rawConfidence * 10) / 10));

  let confidenceGrade: DataConfidenceResult["confidenceGrade"] = "UNTRUSTED_FAIL_CLOSED";
  if (score >= 88) confidenceGrade = "INSTITUTIONAL_DEFENSIBLE";
  else if (score >= 70) confidenceGrade = "HIGH_ASSURANCE";
  else if (score >= 45) confidenceGrade = "PROVISIONAL";

  return {
    score,
    freshnessMultiplier: Math.round(freshnessMultiplier * 1000) / 1000,
    provenanceMultiplier: Math.round(provenanceMultiplier * 1000) / 1000,
    confidenceGrade,
    evidenceDigest: sha256Hex(canonicalJson({ input, score, rawConfidence })),
  };
}

// ============================================================================
// 7. VELMÈRE SYSTEMIC CORRELATION SCORE (VSCS)
// ============================================================================

export interface SystemicCorrelationInput {
  assetReturns: number[];
  benchmarkReturns: number[];
  marketStressIndex?: number; // 0 - 1.0 (default 0.2)
}

export interface SystemicCorrelationResult {
  score: number; // 0 - 100 (100 = strong idiosyncratic resilience / low contagion, 0 = pure systemic beta contagion)
  pearsonCorrelation: number; // [-1.0, 1.0]
  betaFactor: number;
  contagionIndex: number; // [0, 1.0]
  correlationTier: "DECOUPLED_RESILIENT" | "MODERATE_INDEPENDENCE" | "HIGH_BETA_VULNERABILITY" | "PURE_SYSTEMIC_CONTAGION";
  evidenceDigest: string;
}

/**
 * Calculates the Velmère Systemic Correlation Score (VSCS).
 * Evaluates asset co-movement and beta contagion relative to macro benchmark anchors during stress regimes.
 */
export function calculateVelmereSystemicCorrelation(input: SystemicCorrelationInput): SystemicCorrelationResult {
  const assetRet = (input.assetReturns || []).filter((r) => Number.isFinite(r));
  const benchRet = (input.benchmarkReturns || []).filter((r) => Number.isFinite(r));
  const n = Math.min(assetRet.length, benchRet.length);

  if (n < 3) {
    return {
      score: 50,
      pearsonCorrelation: 0,
      betaFactor: 1.0,
      contagionIndex: 0.5,
      correlationTier: "MODERATE_INDEPENDENCE",
      evidenceDigest: sha256Hex("vscs:insufficient_samples"),
    };
  }

  const aSlice = assetRet.slice(0, n);
  const bSlice = benchRet.slice(0, n);

  const meanA = aSlice.reduce((sum, v) => sum + v, 0) / n;
  const meanB = bSlice.reduce((sum, v) => sum + v, 0) / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < n; i++) {
    const da = aSlice[i] - meanA;
    const db = bSlice[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  const pearsonCorrelation = denom > 0 ? Math.max(-1.0, Math.min(1.0, cov / denom)) : 0;
  const betaFactor = varB > 0 ? Math.max(0, cov / varB) : 1.0;

  const stress = Number.isFinite(input.marketStressIndex)
    ? Math.max(0, Math.min(1.0, input.marketStressIndex ?? 0.2))
    : 0.2;

  const positiveCorr = Math.max(0, pearsonCorrelation);
  const contagionIndex = Math.min(1.0, positiveCorr * (1 + 0.5 * stress));

  const rawScore = 100 * (1 - contagionIndex);
  const score = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

  let correlationTier: SystemicCorrelationResult["correlationTier"] = "PURE_SYSTEMIC_CONTAGION";
  if (score >= 80) correlationTier = "DECOUPLED_RESILIENT";
  else if (score >= 55) correlationTier = "MODERATE_INDEPENDENCE";
  else if (score >= 30) correlationTier = "HIGH_BETA_VULNERABILITY";

  return {
    score,
    pearsonCorrelation: Math.round(pearsonCorrelation * 1000) / 1000,
    betaFactor: Math.round(betaFactor * 1000) / 1000,
    contagionIndex: Math.round(contagionIndex * 1000) / 1000,
    correlationTier,
    evidenceDigest: sha256Hex(canonicalJson({ score, pearsonCorrelation, betaFactor, contagionIndex, n })),
  };
}

// ============================================================================
// 8. VELMÈRE LIQUIDITY DRAWDOWN SHOCK (VLDS)
// ============================================================================

export interface LiquidityDrawdownShockInput {
  bids: OrderBookSideInput[];
  cascadeOrderCount?: number; // default 5
  orderSizeUsd?: number; // default 50_000
  replenishmentRatePct?: number; // default 10 (10% depth recovers between ticks)
}

export interface LiquidityDrawdownShockResult {
  score: number; // 0 - 100 (100 = unshakeable depth, 0 = catastrophic flash crash under cascade)
  cumulativeDrawdownPct: number;
  exhaustionStep: number | null; // which step emptied the book (null if survived)
  averageExecutionSlippagePct: number;
  shockTier: "CASCADE_RESISTANT" | "MODERATE_ABSORPTION" | "HIGH_DRAWDOWN_RISK" | "FLASH_CRASH_COLLAPSE";
  evidenceDigest: string;
}

/**
 * Calculates the Velmère Liquidity Drawdown Shock (VLDS).
 * Simulates sequential sell cascades without external liquidity injection to measure market collapse threshold.
 */
export function calculateVelmereLiquidityDrawdownShock(input: LiquidityDrawdownShockInput): LiquidityDrawdownShockResult {
  const rawBids = (input.bids || []).filter(
    (b) => Number.isFinite(b.price) && Number.isFinite(b.quantity) && b.price > 0 && b.quantity > 0,
  );

  if (rawBids.length === 0) {
    return {
      score: 0,
      cumulativeDrawdownPct: 100,
      exhaustionStep: 0,
      averageExecutionSlippagePct: 100,
      shockTier: "FLASH_CRASH_COLLAPSE",
      evidenceDigest: sha256Hex("vlds:empty_book"),
    };
  }

  const cascadeCount = Number.isFinite(input.cascadeOrderCount) ? Math.max(1, Math.min(20, input.cascadeOrderCount ?? 5)) : 5;
  const orderSizeUsd = Number.isFinite(input.orderSizeUsd) ? Math.max(100, input.orderSizeUsd ?? 50_000) : 50_000;
  const replenishmentRate = Number.isFinite(input.replenishmentRatePct)
    ? Math.max(0, Math.min(0.5, (input.replenishmentRatePct ?? 10) / 100))
    : 0.1;

  const simulatedBook = rawBids
    .map((b) => ({ price: b.price, quantity: b.quantity }))
    .sort((a, b) => b.price - a.price);

  const initialTopPrice = simulatedBook[0].price;
  let exhaustionStep: number | null = null;
  const stepSlippages: number[] = [];

  for (let step = 0; step < cascadeCount; step++) {
    let remainingUsd = orderSizeUsd;
    let spentUsd = 0;
    let acquiredBase = 0;

    for (let i = 0; i < simulatedBook.length; i++) {
      const lvl = simulatedBook[i];
      if (lvl.quantity <= 0) continue;
      const lvlUsd = lvl.price * lvl.quantity;
      const takeUsd = Math.min(remainingUsd, lvlUsd);
      const takeBase = takeUsd / lvl.price;

      lvl.quantity -= takeBase;
      spentUsd += takeUsd;
      acquiredBase += takeBase;
      remainingUsd -= takeUsd;

      if (remainingUsd <= 0) break;
    }

    if (remainingUsd > 0) {
      exhaustionStep = step + 1;
      stepSlippages.push(100);
      break;
    }

    const stepExecPrice = acquiredBase > 0 ? spentUsd / acquiredBase : initialTopPrice;
    const stepSlip = Math.max(0, (initialTopPrice - stepExecPrice) / initialTopPrice) * 100;
    stepSlippages.push(stepSlip);

    for (const lvl of simulatedBook) {
      if (lvl.quantity > 0) {
        lvl.quantity *= (1 + replenishmentRate);
      }
    }
  }

  const remainingActiveLevels = simulatedBook.filter((b) => b.quantity > 0);
  const finalTopPrice = remainingActiveLevels.length > 0 ? remainingActiveLevels[0].price : 0;
  const cumulativeDrawdownPct = initialTopPrice > 0
    ? Math.min(100, Math.max(0, ((initialTopPrice - finalTopPrice) / initialTopPrice) * 100))
    : 100;

  const avgSlippage = stepSlippages.length > 0
    ? stepSlippages.reduce((a, b) => a + b, 0) / stepSlippages.length
    : 100;

  const rawScore = 100 * Math.exp(-cumulativeDrawdownPct / 15) * (exhaustionStep ? 0.3 : 1.0);
  const score = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

  let shockTier: LiquidityDrawdownShockResult["shockTier"] = "FLASH_CRASH_COLLAPSE";
  if (score >= 80 && !exhaustionStep) shockTier = "CASCADE_RESISTANT";
  else if (score >= 50 && !exhaustionStep) shockTier = "MODERATE_ABSORPTION";
  else if (score >= 25) shockTier = "HIGH_DRAWDOWN_RISK";

  return {
    score,
    cumulativeDrawdownPct: Math.round(cumulativeDrawdownPct * 100) / 100,
    exhaustionStep,
    averageExecutionSlippagePct: Math.round(avgSlippage * 100) / 100,
    shockTier,
    evidenceDigest: sha256Hex(canonicalJson({ score, cumulativeDrawdownPct, exhaustionStep, avgSlippage, cascadeCount })),
  };
}
