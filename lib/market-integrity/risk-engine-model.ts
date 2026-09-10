import type {
  RiskAgentAssessment,
  RiskAgentId,
  RiskAgentScore,
  RiskLevel,
  RiskMetaModel,
  RiskSignalId,
  TokenRiskInput,
  TokenRiskResult,
  TokenRiskSignal,
} from "./risk-types";
import type { AssetProfile } from "./risk-engine-profile";
import {
  clamp,
  finiteNumber,
  hasFiniteNumber,
  isLargeNativeCrypto,
  isRealMarketLike,
  levelFromScore,
  rounded,
  sourceMode,
  uniqueDataSources,
} from "./risk-engine-profile";

type CoreRiskAgentId = Exclude<RiskAgentId, "data">;

type RiskGroup = {
  id: CoreRiskAgentId;
  label: string;
  weight: number;
  ids: RiskSignalId[];
};

type RiskMetaModelWithFinalVerdict = RiskMetaModel & {
  finalVerdict: string;
};

const VELOCITY_SIGNAL_IDS: RiskSignalId[] = [
  "rapid_intraday_move",
  "parabolic_24h_gain",
  "parabolic_7d_gain",
  "parabolic_30d_gain",
  "multi_timeframe_pump",
  "new_ath_repricing",
  "extreme_drawdown",
  "major_drawdown",
  "severe_24h_drop",
  "high_24h_drop",
  "provider_health_degradation",
  "source_divergence",
  "stale_market_data",
];

const LIQUIDITY_SIGNAL_IDS: RiskSignalId[] = [
  "thin_liquidity",
  "very_thin_liquidity",
  "low_dex_liquidity",
  "market_volume_stress",
  "wash_trading_risk",
  "volume_spike",
];

const MICROSTRUCTURE_SIGNAL_IDS: RiskSignalId[] = [
  "orderbook_depth_collapse",
  "orderbook_slippage_risk",
  "orderbook_imbalance",
  "sell_pressure_imbalance",
];

const HOLDER_SIGNAL_IDS: RiskSignalId[] = [
  "holder_concentration",
  "supply_overhang",
  "fdv_marketcap_gap",
  "rebrand_after_crash",
  "exchange_deposit_anomaly",
];

const CONTRACT_SIGNAL_IDS: RiskSignalId[] = [
  "contract_privileges",
  "honeypot_risk",
  "high_sell_tax",
  "mint_risk",
  "blacklist_risk",
];

const CORE_RISK_GROUPS: RiskGroup[] = [
  {
    id: "velocity",
    label: "Velocity / pump",
    weight: 0.2,
    ids: VELOCITY_SIGNAL_IDS,
  },
  {
    id: "liquidity",
    label: "Liquidity / volume",
    weight: 0.26,
    ids: LIQUIDITY_SIGNAL_IDS,
  },
  {
    id: "microstructure",
    label: "Order book / microstructure",
    weight: 0.18,
    ids: MICROSTRUCTURE_SIGNAL_IDS,
  },
  {
    id: "holders",
    label: "Holders / supply",
    weight: 0.2,
    ids: HOLDER_SIGNAL_IDS,
  },
  {
    id: "contract",
    label: "Contract / permissions",
    weight: 0.16,
    ids: CONTRACT_SIGNAL_IDS,
  },
];

function signalScore(signals: TokenRiskSignal[], ids: RiskSignalId[]) {
  const points = signals
    .filter((signal) => ids.includes(signal.id))
    .map((signal) => signal.points)
    .sort((a, b) => b - a);
  const diminishingWeights = [1, 0.62, 0.38, 0.22, 0.12];
  return Math.min(
    100,
    rounded(
      points.reduce(
        (sum, point, index) =>
          sum + point * (diminishingWeights[index] ?? 0.08),
        0,
      ),
      2,
    ),
  );
}

function signalCount(signals: TokenRiskSignal[], ids: RiskSignalId[]) {
  return signals.filter((signal) => ids.includes(signal.id)).length;
}

function hasSignal(signals: TokenRiskSignal[], id: RiskSignalId) {
  return signals.some((signal) => signal.id === id);
}

function hasAnySignal(signals: TokenRiskSignal[], ids: RiskSignalId[]) {
  return ids.some((id) => hasSignal(signals, id));
}

export function buildScoreBreakdown(
  signals: TokenRiskSignal[],
  confidence: number,
): RiskAgentScore[] {
  const rows: RiskAgentScore[] = CORE_RISK_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    score: signalScore(signals, group.ids),
    weight: group.weight,
    confidence,
    evidenceCount: signalCount(signals, group.ids),
  }));
  rows.push({
    id: "data",
    label: "Data uncertainty / review pressure",
    score: rounded((1 - confidence) * 100, 2),
    weight: 0,
    confidence,
    evidenceCount: signalCount(signals, ["insufficient_data"]),
  });
  return rows;
}


function normalizedAbsolutePressure(value: unknown, scale: number) {
  const number = finiteNumber(value);
  if (number === undefined || scale <= 0) return undefined;
  return clamp(Math.abs(number) / scale, 0, 1);
}

function computeContinuousEvidencePressure(input: TokenRiskInput, confidence: number) {
  const components: Array<{ value: number; weight: number }> = [];
  const add = (value: number | undefined, weight: number) => {
    if (value !== undefined && Number.isFinite(value)) components.push({ value: clamp(value, 0, 1), weight });
  };

  add(normalizedAbsolutePressure(input.priceChange1h, 8), 0.7);
  add(normalizedAbsolutePressure(input.priceChange6h, 18), 0.8);
  add(normalizedAbsolutePressure(input.priceChange24h, 35), 1);
  add(normalizedAbsolutePressure(input.priceChange7d, 80), 0.8);
  add(normalizedAbsolutePressure(input.priceChange30d, 160), 0.55);

  const marketCap = finiteNumber(input.marketCap);
  const liquidity = finiteNumber(input.liquidityUsd);
  if (marketCap !== undefined && marketCap > 0 && liquidity !== undefined && liquidity >= 0) {
    add(1 - clamp((liquidity / marketCap) / 0.1, 0, 1), 1.1);
  }
  const fdv = finiteNumber(input.fdv);
  if (marketCap !== undefined && marketCap > 0 && fdv !== undefined && fdv >= marketCap) {
    add(clamp((fdv / marketCap - 1) / 9, 0, 1), 0.8);
  }
  const volume = finiteNumber(input.volume24h);
  if (marketCap !== undefined && marketCap > 0 && volume !== undefined && volume >= 0) {
    const turnover = volume / marketCap;
    add(turnover > 1 ? clamp((turnover - 1) / 4, 0, 1) : clamp((0.005 - turnover) / 0.005, 0, 1), 0.55);
  }

  add(normalizedAbsolutePressure(input.top10HolderPercent, 100), 1);
  add(normalizedAbsolutePressure(input.sellTaxPercentage, 30), 1);
  add(normalizedAbsolutePressure(input.buyTaxPercentage, 30), 0.65);
  add(normalizedAbsolutePressure(input.simulatedSlippage10k, 12), 0.9);
  add(normalizedAbsolutePressure(input.orderBookDepthDropPercent, 100), 0.8);
  add(normalizedAbsolutePressure(input.bidAskImbalancePercent, 100), 0.65);
  add(clamp(1 - confidence, 0, 1), 0.35);

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  if (totalWeight <= 0) return 0;
  return components.reduce((sum, component) => sum + component.value * component.weight, 0) / totalWeight;
}

function applyEvidenceBoundFraction(score: number, input: TokenRiskInput, confidence: number) {
  const bounded = clamp(score);
  if (bounded >= 100) return 100;
  const pressure = computeContinuousEvidencePressure(input, confidence);
  if (pressure <= 0) return rounded(bounded, 2);
  const integerBucket = Math.floor(bounded);
  const originalFraction = bounded - integerBucket;
  const evidenceFraction = Math.min(0.99, pressure * 0.99);
  // Recalibrate only inside the current integer bucket. The score remains evidence-derived,
  // but cannot cross the next whole-number boundary or change a hard severity threshold.
  const blendedFraction = originalFraction * 0.2 + evidenceFraction * 0.8;
  return rounded(clamp(integerBucket + Math.max(0.01, Math.min(0.99, blendedFraction))), 2);
}

export function computeFusedRiskScore(
  signals: TokenRiskSignal[],
  scoreBreakdown: RiskAgentScore[],
  confidence: number,
  profile: AssetProfile,
  input: TokenRiskInput,
) {
  const coreRows = scoreBreakdown.filter((row) => row.id !== "data");
  const dataRow = scoreBreakdown.find((row) => row.id === "data");
  const weightedScore = coreRows.reduce(
    (sum, row) => sum + row.score * row.weight,
    0,
  );
  const elevatedGroupCount = coreRows.filter((row) => row.score >= 35).length;
  const highGroupCount = coreRows.filter((row) => row.score >= 60).length;
  const corroboratedGroupCount = coreRows.filter((row) => row.score >= 40).length;
  const criticalSignalCount = signals.filter(
    (signal) => signal.severity === "critical",
  ).length;
  const confidenceMultiplier = 0.82 + confidence * 0.18;
  let score =
    weightedScore * confidenceMultiplier +
    (elevatedGroupCount >= 3 ? 6 : elevatedGroupCount === 2 ? 3 : 0) +
    (highGroupCount >= 3 ? 8 : highGroupCount === 2 ? 5 : 0);

  const hasThinExitDepth = hasAnySignal(signals, [
    "very_thin_liquidity",
    "thin_liquidity",
    "low_dex_liquidity",
  ]);
  const hasParabolicRepricing = hasAnySignal(signals, [
    "multi_timeframe_pump",
    "parabolic_24h_gain",
    "parabolic_7d_gain",
    "parabolic_30d_gain",
    "new_ath_repricing",
  ]);
  const hasDrawdownStress = hasAnySignal(signals, [
    "extreme_drawdown",
    "major_drawdown",
    "severe_24h_drop",
    "high_24h_drop",
  ]);
  const hasSupplyOverhang = hasAnySignal(signals, [
    "supply_overhang",
    "fdv_marketcap_gap",
  ]);
  const dataUncertaintyScore = dataRow?.score ?? 0;
  const insufficientDataSignal = signals.find(
    (signal) => signal.id === "insufficient_data",
  );
  const anomalySignals = signals.filter((signal) => signal.id !== "insufficient_data");
  const sourceCount = uniqueDataSources(input).length;
  const coreAssetWithPrice = (isLargeNativeCrypto(input) || isRealMarketLike(input)) && hasFiniteNumber(input.currentPrice);
  const missingCoreCount =
    finiteNumber(insufficientDataSignal?.metrics?.missingCoreCount) ?? 0;

  if (insufficientDataSignal) {
    const reviewPressureFloor = Math.min(
      34,
      10 + missingCoreCount * 4 + dataUncertaintyScore * 0.12,
    );
    score = Math.max(score, reviewPressureFloor);
  }

  if (hasSignal(signals, "honeypot_risk")) score = Math.max(score, 92);
  if (
    signals.some(
      (signal) =>
        signal.id === "high_sell_tax" && signal.severity === "critical",
    )
  )
    score = Math.max(score, 80);
  if (
    hasSignal(signals, "high_sell_tax") &&
    hasSignal(signals, "blacklist_risk")
  )
    score = Math.max(score, 84);
  if (hasSignal(signals, "mint_risk")) score = Math.max(score, 45);
  if (hasSignal(signals, "blacklist_risk")) score = Math.max(score, 42);

  if (
    hasSignal(signals, "blacklist_risk") &&
    hasSignal(signals, "mint_risk")
  )
    score = Math.max(score, 76);
  if (
    hasSignal(signals, "contract_privileges") &&
    hasSignal(signals, "mint_risk") &&
    hasSignal(signals, "high_sell_tax")
  )
    score = Math.max(score, 82);
  if (
    hasSignal(signals, "contract_privileges") &&
    hasSignal(signals, "blacklist_risk") &&
    hasSignal(signals, "mint_risk")
  )
    score = Math.max(score, 86);
  if (
    hasSignal(signals, "orderbook_slippage_risk") &&
    hasThinExitDepth
  )
    score = Math.max(score, 68);
  if (
    signals.some(
      (signal) =>
        signal.id === "orderbook_slippage_risk" &&
        signal.severity === "critical",
    )
  )
    score = Math.max(score, 58);
  if (
    signals.some(
      (signal) =>
        signal.id === "orderbook_depth_collapse" &&
        signal.severity === "critical",
    )
  )
    score = Math.max(score, 56);
  if (
    hasSignal(signals, "multi_timeframe_pump") &&
    (hasThinExitDepth || hasSignal(signals, "market_volume_stress"))
  )
    score = Math.max(score, 70);
  if (
    hasSignal(signals, "multi_timeframe_pump") &&
    hasSignal(signals, "volume_spike")
  )
    score = Math.max(score, 68);
  if (hasParabolicRepricing && hasThinExitDepth && hasSupplyOverhang)
    score = Math.max(score, 84);
  if (
    hasParabolicRepricing &&
    hasThinExitDepth &&
    hasSignal(signals, "volume_spike")
  )
    score = Math.max(score, profile.mode === "meme" ? 78 : 72);
  if (
    hasParabolicRepricing &&
    hasSignal(signals, "very_thin_liquidity") &&
    hasSignal(signals, "wash_trading_risk")
  )
    score = Math.max(score, profile.mode === "meme" ? 84 : 78);
  if (
    hasSignal(signals, "multi_timeframe_pump") &&
    hasSignal(signals, "volume_spike") &&
    hasThinExitDepth &&
    (hasSignal(signals, "holder_concentration") ||
      hasSignal(signals, "insufficient_data"))
  )
    score = Math.max(score, 82);
  if (
    profile.mode === "meme" &&
    hasParabolicRepricing &&
    (hasSignal(signals, "holder_concentration") ||
      hasSignal(signals, "insufficient_data"))
  )
    score = Math.max(score, 66);
  if (
    profile.mode === "unknown" &&
    hasParabolicRepricing &&
    hasSignal(signals, "insufficient_data")
  )
    score = Math.max(score, 58);
  if (
    hasSignal(signals, "supply_overhang") &&
    hasSignal(signals, "fdv_marketcap_gap")
  )
    score = Math.max(score, 65);
  if (
    hasSignal(signals, "fdv_marketcap_gap") &&
    signals.some(
      (signal) =>
        signal.id === "supply_overhang" && signal.severity === "critical",
    )
  )
    score = Math.max(score, 72);
  if (
    hasSignal(signals, "supply_overhang") &&
    hasSignal(signals, "fdv_marketcap_gap") &&
    hasSignal(signals, "multi_timeframe_pump")
  )
    score = Math.max(score, 78);
  const staleExitDepthSignal = signals.find(
    (signal) =>
      signal.id === "market_volume_stress" &&
      (signal.metrics?.thinExitDepthReview === "required" ||
        signal.metrics?.redemptionDepthReview === "required"),
  );
  if (staleExitDepthSignal?.severity === "high") score = Math.max(score, 42);
  if (hasDrawdownStress && hasThinExitDepth)
    score = Math.max(score, hasSignal(signals, "extreme_drawdown") ? 68 : 58);
  if (
    hasDrawdownStress &&
    (hasSignal(signals, "orderbook_depth_collapse") ||
      hasSignal(signals, "market_volume_stress"))
  )
    score = Math.max(score, 64);
  if (corroboratedGroupCount >= 4 && criticalSignalCount >= 3)
    score = Math.max(score, 85);
  else if (corroboratedGroupCount >= 3 && criticalSignalCount >= 2)
    score = Math.max(score, 75);
  if (
    hasSignal(signals, "insufficient_data") &&
    confidence < 0.25 &&
    dataUncertaintyScore >= 65
  )
    score = Math.max(score, profile.mode === "unknown" ? 48 : 42);
  else if (
    hasSignal(signals, "insufficient_data") &&
    confidence < 0.4 &&
    dataUncertaintyScore >= 50
  )
    score = Math.max(score, profile.mode === "unknown" ? 42 : 35);

  // PASS2278: a blue-chip native crypto or real-market row must not sit at a fake-looking static 35/100
  // only because persistent history or a secondary source lane is missing. Missing proof stays visible,
  // but the risk score remains a review-priority score rather than a live danger claim.
  if (coreAssetWithPrice && anomalySignals.length === 0) {
    score = Math.min(score, sourceCount >= 2 ? 28 : 34);
  }

  const stablecoinDepegSignal = signals.find(
    (signal) =>
      signal.id === "rapid_intraday_move" &&
      signal.metrics?.stablecoinDepegReview === "required",
  );
  const pegDeviationPercent = finiteNumber(
    stablecoinDepegSignal?.metrics?.pegDeviationPercent,
  );
  if (pegDeviationPercent !== undefined) {
    score = Math.max(
      score,
      pegDeviationPercent >= 20 ? 80 : pegDeviationPercent >= 10 ? 65 : 42,
    );
  }

  return applyEvidenceBoundFraction(score, input, confidence);
}

function statusFromAgentScore(score: number): RiskLevel {
  return levelFromScore(clamp(score));
}

function verdictFromAgentScore(
  score: number,
  confidence: number,
): RiskAgentAssessment["verdict"] {
  if (confidence < 0.35) return "insufficient_data";
  if (score >= 85) return "critical";
  if (score >= 65) return "warning";
  if (score >= 35) return "watch";
  return "clear";
}

export function buildAgentAssessments(
  signals: TokenRiskSignal[],
  input: TokenRiskInput,
  dataQuality: TokenRiskResult["dataQuality"],
  globalConfidence: number,
  profile: AssetProfile,
): RiskAgentAssessment[] {
  const sources = uniqueDataSources(input);
  const sourceDescription = `${sourceMode(input, dataQuality)}; ${profile.mode} profile`;
  const profileNextAction =
    profile.mode === "stablecoin"
      ? "Verify reserve proof, redemption status, liquidity venues and exchange depth."
      : profile.mode === "rwa"
        ? "Verify issuer, redemption terms, custody proof and source ledger."
        : profile.mode === "meme"
          ? "Attach social/KOL source ledger, holder labels and liquidity-zone review."
          : profile.mode === "unknown"
            ? "Classify the asset from primary sources before interpreting market movement."
            : "Attach source ledger and verify the highest-scoring lane.";
  const countObserved = (values: unknown[]) =>
    values.filter((value) => value !== undefined && value !== null).length;
  const agentConfidence = (observed: number, required: number, evidence: number) =>
    rounded(
      clamp(
        0.14 +
          (observed / Math.max(1, required)) * 0.44 +
          Math.min(0.16, evidence * 0.035) +
          globalConfidence * 0.24,
        0.12,
        0.98,
      ),
      2,
    );
  const idsFor = (ids: RiskSignalId[]) =>
    signals.filter((signal) => ids.includes(signal.id)).map((signal) => signal.id);

  const definitions: Array<{
    id: RiskAgentId;
    label: string;
    ids: RiskSignalId[];
    observed: number;
    required: number;
    score: number;
    reasoning: string;
    nextAction: string;
    extraEvidence?: number;
  }> = [
    {
      id: "velocity",
      label: "Velocity / pump agent",
      ids: VELOCITY_SIGNAL_IDS,
      observed: countObserved([
        input.priceChange1h,
        input.priceChange6h,
        input.priceChange24h,
        input.priceChange7d,
        input.priceChange14d,
        input.priceChange30d,
        input.athPrice,
        input.currentPrice,
      ]),
      required: 8,
      score: signalScore(signals, VELOCITY_SIGNAL_IDS),
      reasoning: `Checks repricing, drawdown and multi-timeframe momentum against ${profile.reviewFocus}. Source mode: ${sourceDescription}.`,
      nextAction: `Compare repricing with exit depth and source ledger before interpreting momentum. ${profileNextAction}`,
    },
    {
      id: "liquidity",
      label: "Liquidity / exit agent",
      ids: LIQUIDITY_SIGNAL_IDS,
      observed: countObserved([
        input.liquidityUsd,
        input.marketCap,
        input.fdv,
        input.volume24h,
        input.averageVolume7d,
      ]),
      required: 5,
      score: signalScore(signals, LIQUIDITY_SIGNAL_IDS),
      reasoning: `Checks thin exit depth and turnover quality against visible liquidity. Source mode: ${sourceDescription}.`,
      nextAction: `Inspect exit depth across DEX pool, CEX orderbook and slippage snapshot. ${profileNextAction}`,
    },
    {
      id: "microstructure",
      label: "Orderbook / microstructure agent",
      ids: MICROSTRUCTURE_SIGNAL_IDS,
      observed: countObserved([
        input.simulatedSlippage10k,
        input.bidAskImbalancePercent,
        input.orderBookDepthDropPercent,
        input.buys24h,
        input.sells24h,
      ]),
      required: 5,
      score: signalScore(signals, MICROSTRUCTURE_SIGNAL_IDS),
      reasoning: `Checks slippage, imbalance and orderbook depth collapse without treating proxies as proof. Source mode: ${sourceDescription}.`,
      nextAction: "Rerun after a live orderbook snapshot and inspect exit depth.",
    },
    {
      id: "holders",
      label: "Holder / insider agent",
      ids: HOLDER_SIGNAL_IDS,
      observed: countObserved([
        input.top10HolderPercent,
        input.holderCount,
        input.circulatingSupply,
        input.totalSupply,
        input.maxSupply,
        input.fdv,
        input.marketCap,
      ]),
      required: 7,
      score: signalScore(signals, HOLDER_SIGNAL_IDS),
      reasoning: `Checks float, unlock overhang and concentration proxies without assuming wallet ownership. Source mode: ${sourceDescription}.`,
      nextAction: "Verify unlock schedule, supply source and CEX/team/LP/unknown wallet labels.",
    },
    {
      id: "contract",
      label: "Contract / permissions agent",
      ids: CONTRACT_SIGNAL_IDS,
      observed: countObserved([
        input.tokenAddress,
        input.buyTaxPercentage,
        input.sellTaxPercentage,
        input.suspiciousContractPrivileges,
        input.isHoneypot,
        input.canMintNewTokens,
        input.canPauseTrading,
        input.canBlacklist,
      ]),
      required: 8,
      score: signalScore(signals, CONTRACT_SIGNAL_IDS),
      reasoning: `Checks reported mint, pause, blacklist, honeypot and tax fields. Source mode: ${sourceDescription}.`,
      nextAction: "Review contract admin controls against explorer, verified bytecode and audit source.",
    },
    {
      id: "data",
      label: "Data quality agent",
      ids: ["insufficient_data"],
      observed: countObserved([
        input.currentPrice,
        input.marketCap,
        input.fdv,
        input.volume24h,
        input.liquidityUsd,
        input.circulatingSupply,
        input.top10HolderPercent,
        input.tokenAddress,
      ]),
      required: 8,
      score: Math.max(
        signalScore(signals, ["insufficient_data"]),
        Math.round((1 - globalConfidence) * 100),
        sources.length === 0
          ? 48
          : sources.length === 1
            ? 28
            : sources.length === 2
              ? 14
              : 6,
      ),
      reasoning: `Treats missing fields and missing evidence ledger as uncertainty, not evidence of misconduct. Source mode: ${sourceDescription}.`,
      nextAction: `Attach OSINT source ledger, verify KOL/social disclosures and rerun before escalation. ${profileNextAction}`,
      extraEvidence: sources.length,
    },
  ];

  return definitions.map((definition) => {
    const evidenceSignalIds = idsFor(definition.ids);
    const evidenceCount = evidenceSignalIds.length + (definition.extraEvidence ?? 0);
    const confidence = agentConfidence(
      definition.observed,
      definition.required,
      evidenceCount,
    );
    return {
      id: definition.id,
      label: definition.label,
      score: rounded(clamp(definition.score), 2),
      weight:
        CORE_RISK_GROUPS.find((group) => group.id === definition.id)?.weight ?? 0,
      confidence,
      evidenceCount,
      status: statusFromAgentScore(definition.score),
      verdict: verdictFromAgentScore(definition.score, confidence),
      evidenceSignalIds,
      reasoning: definition.reasoning,
      nextAction: definition.nextAction,
    };
  });
}

export function buildMetaModel(
  symbol: string,
  score: number,
  level: RiskLevel,
  confidence: number,
  agents: RiskAgentAssessment[],
  signals: TokenRiskSignal[],
  limitations: string[],
  profile: AssetProfile,
): RiskMetaModelWithFinalVerdict {
  const dominantRiskAgent = agents
    .filter((agent) => agent.id !== "data")
    .slice()
    .sort((a, b) => b.score * b.weight - a.score * a.weight)[0];
  const dataAgent = agents.find((agent) => agent.id === "data");
  const dominant =
    confidence < 0.4 &&
    dataAgent !== undefined &&
    dataAgent.score >= (dominantRiskAgent?.score ?? 0)
      ? dataAgent
      : dominantRiskAgent;
  const riskAgents = agents.filter((agent) => agent.id !== "data");
  const highAgents = riskAgents.filter((agent) => agent.score >= 65).length;
  const clearAgents = riskAgents.filter(
    (agent) => agent.score < 20 && agent.confidence >= 0.55,
  ).length;
  const dataConflict =
    (dataAgent?.score ?? 0) >= 65 && highAgents === 0 && clearAgents >= 3;
  const conflictLevel: RiskMetaModel["conflictLevel"] =
    dataConflict
      ? "medium"
      : highAgents >= 2 && clearAgents >= 2
      ? "high"
      : highAgents >= 1 && clearAgents >= 2
        ? "medium"
        : highAgents >= 1
          ? "low"
          : "none";
  const verdict: RiskMetaModel["verdict"] =
    level === "critical"
      ? "critical"
      : signals.some(
            (signal) =>
              signal.id === "insufficient_data" &&
              (finiteNumber(signal.metrics?.missingCoreCount) ?? 0) >= 3,
          ) || confidence < 0.35
        ? "insufficient_data"
        : level === "high"
          ? "warning"
          : level === "medium"
            ? "watch"
            : "clear";
  const confidenceState =
    confidence < 0.35
      ? "confidence too low; prescreen only"
      : confidence < 0.6
        ? "confidence limited by missing sources"
        : "confidence supported by attached fields";
  const reviewState =
    verdict === "clear" ? "monitor unresolved limitations" : "manual review required";
  const operatorAction = dominant?.nextAction ?? "Attach source ledger and rerun.";
  const finalVerdict =
    verdict === "critical"
      ? "Critical review: hard-floor signal or multiple corroborated lanes require manual escalation."
      : verdict === "warning"
        ? "Review required: corroborated anomaly lanes need source-ledger confirmation."
        : verdict === "watch"
          ? "Watch: limited anomaly pattern; rerun after missing evidence is resolved."
          : verdict === "insufficient_data"
            ? "Prescreen only: evidence is too incomplete for a stronger conclusion."
            : "Monitor: no high-severity anomaly in attached fields; unresolved limitations remain.";
  const profileNote =
    profile.mode === "stablecoin"
      ? ` Stablecoin interpretation requires ${profile.reviewFocus}.`
      : profile.mode === "rwa"
        ? ` RWA interpretation requires ${profile.reviewFocus}.`
        : profile.mode === "meme"
          ? ` Meme-profile interpretation requires ${profile.reviewFocus}.`
          : profile.mode === "unknown"
            ? ` Unknown asset profile requires ${profile.reviewFocus}.`
            : "";
  const dominantText = dominant
    ? ` Dominant lane: ${dominant.label} (${dominant.score}/100).`
    : "";
  const blockedBy = limitations
    .filter(
      (limitation) =>
        !limitation.startsWith("This output") &&
        limitation !== "manual review required before escalation",
    )
    .slice(0, 4)
    .join(", ");
  const limitationText = blockedBy ? ` Blocked by: ${blockedBy}.` : "";

  return {
    version: "velmere-shield-deterministic-fusion-v8",
    verdict,
    finalVerdict,
    dominantAgent: dominant?.id,
    dataFusionScore: score,
    conflictLevel,
    requiredReview:
      verdict !== "clear" || signals.length > 0 || limitations.length > 1,
    summary:
      verdict === "critical"
        ? `${symbol}: critical market-integrity risk; ${reviewState}.${dominantText}${limitationText} Confidence state: ${confidenceState}.${profileNote}`
        : verdict === "warning"
          ? `${symbol}: anomaly pattern requires review before relying on visible market depth.${dominantText}${limitationText} Confidence state: ${confidenceState}.${profileNote}`
          : verdict === "watch"
            ? `${symbol}: detected anomalies require review; current evidence does not support a stronger claim.${dominantText}${limitationText} Confidence state: ${confidenceState}.${profileNote}`
            : verdict === "insufficient_data"
              ? `${symbol}: confidence too low. Treat score as prescreen only.${dominantText}${limitationText} Missing data is not evidence of misconduct.${profileNote}`
              : `${symbol}: no high-severity anomaly in attached fields. ${reviewState}.${dominantText}${limitationText}${profileNote}`,
    escalation:
      score >= 85
        ? `Escalate: manual forensic review, orderbook depth, holder labels and contract admin review. Next action: ${operatorAction}`
        : score >= 65
          ? `Review: verify thin exit depth, unlock overhang and source ledger. Next action: ${operatorAction}`
          : score >= 35
            ? `Watch: rerun on the next snapshot and resolve missing sources. Next action: ${operatorAction}`
            : `Monitor: keep automated scan active and resolve missing evidence before stronger conclusions. Next action: ${operatorAction}`,
    limitations,
  };
}
