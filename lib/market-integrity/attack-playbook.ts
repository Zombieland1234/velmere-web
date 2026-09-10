import type { RiskAgentId, RiskLevel, RiskSignalId, TokenRiskResult } from "./risk-types";

export type ShieldAttackVectorId =
  | "velocity_abuse"
  | "exit_liquidity"
  | "spoofing_depth"
  | "holder_cluster"
  | "contract_control"
  | "data_blindspot";

export type ShieldAttackVector = {
  id: ShieldAttackVectorId;
  score: number;
  severity: RiskLevel;
  agent?: RiskAgentId;
  confidence: number;
  evidenceSignalIds: RiskSignalId[];
  metricHints: Array<{ label: string; value: number | string }>;
};

export type ShieldDefenseReadiness = {
  score: number;
  verdict: "weak" | "partial" | "strong";
  missingLayers: string[];
  activeLayers: string[];
};

export type ShieldAttackSurface = {
  version: "attack-surface-v1";
  generatedAt: string;
  topVector: ShieldAttackVector;
  vectors: ShieldAttackVector[];
  defenseReadiness: ShieldDefenseReadiness;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function agentScore(result: TokenRiskResult, id: RiskAgentId) {
  return result.agentAssessments?.find((agent) => agent.id === id)?.score ?? 0;
}

function signalPoints(result: TokenRiskResult, ids: RiskSignalId[]) {
  return result.signals
    .filter((signal) => ids.includes(signal.id))
    .reduce((sum, signal) => sum + signal.points, 0);
}

function signalIds(result: TokenRiskResult, ids: RiskSignalId[]) {
  return result.signals
    .filter((signal) => ids.includes(signal.id))
    .map((signal) => signal.id);
}

function severityFromScore(score: number): RiskLevel {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function confidenceFor(result: TokenRiskResult, agent?: RiskAgentId) {
  const base = result.confidence ?? 0.45;
  const agentConfidence = agent ? result.agentAssessments?.find((item) => item.id === agent)?.confidence : undefined;
  return Number(Math.max(0.05, Math.min(0.98, agentConfidence ?? base)).toFixed(2));
}

function metric(label: string, value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && !Number.isFinite(value)) return undefined;
  return { label, value };
}

export function buildAttackSurface(result: TokenRiskResult): ShieldAttackSurface {
  const velocityIds: RiskSignalId[] = [
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
  ];
  const liquidityIds: RiskSignalId[] = [
    "thin_liquidity",
    "very_thin_liquidity",
    "low_dex_liquidity",
    "market_volume_stress",
    "wash_trading_risk",
    "volume_spike",
    "orderbook_slippage_risk",
  ];
  const spoofingIds: RiskSignalId[] = [
    "orderbook_depth_collapse",
    "orderbook_slippage_risk",
    "orderbook_imbalance",
    "sell_pressure_imbalance",
  ];
  const holderIds: RiskSignalId[] = [
    "holder_concentration",
    "supply_overhang",
    "fdv_marketcap_gap",
    "rebrand_after_crash",
    "exchange_deposit_anomaly",
  ];
  const contractIds: RiskSignalId[] = [
    "contract_privileges",
    "honeypot_risk",
    "high_sell_tax",
    "mint_risk",
    "blacklist_risk",
  ];
  const dataIds: RiskSignalId[] = ["insufficient_data"];

  const m = result.metrics;
  const volumeLiquidityStress = finite(m.volumeToLiquidityRatio) ? Math.min(32, m.volumeToLiquidityRatio * 7) : 0;
  const slippageStress = finite(m.simulatedSlippage10k) ? Math.min(30, Math.abs(m.simulatedSlippage10k) * 1.8) : 0;
  const holderStress = finite(m.top10HolderPercent) ? Math.max(0, (m.top10HolderPercent - 35) * 0.75) : 0;
  const fdvStress = finite(m.fdvToMarketCapRatio) ? Math.max(0, Math.min(26, (m.fdvToMarketCapRatio - 2) * 5)) : 0;
  const contractTaxStress = finite(m.sellTaxPercentage) ? Math.max(0, Math.min(28, m.sellTaxPercentage * 1.4)) : 0;
  const confidenceGap = Math.max(0, 1 - (result.confidence ?? 0.45));

  const vectors: ShieldAttackVector[] = [
    {
      id: "velocity_abuse",
      agent: "velocity",
      score: clamp(agentScore(result, "velocity") + signalPoints(result, velocityIds) * 0.42),
      severity: "low",
      confidence: confidenceFor(result, "velocity"),
      evidenceSignalIds: signalIds(result, velocityIds),
      metricHints: [
        metric("1h", m.priceChange1h),
        metric("24h", m.priceChange24h),
        metric("7d", m.priceChange7d),
        metric("30d", m.priceChange30d),
      ].filter(Boolean) as Array<{ label: string; value: number | string }>,
    },
    {
      id: "exit_liquidity",
      agent: "liquidity",
      score: clamp(agentScore(result, "liquidity") + signalPoints(result, liquidityIds) * 0.28 + volumeLiquidityStress + slippageStress),
      severity: "low",
      confidence: confidenceFor(result, "liquidity"),
      evidenceSignalIds: signalIds(result, liquidityIds),
      metricHints: [
        metric("liquidity", m.liquidityUsd),
        metric("volume", m.volume24h),
        metric("vol/liquidity", m.volumeToLiquidityRatio),
        metric("slippage 10k", m.simulatedSlippage10k),
      ].filter(Boolean) as Array<{ label: string; value: number | string }>,
    },
    {
      id: "spoofing_depth",
      agent: "microstructure",
      score: clamp(agentScore(result, "microstructure") + signalPoints(result, spoofingIds) * 0.35 + slippageStress),
      severity: "low",
      confidence: confidenceFor(result, "microstructure"),
      evidenceSignalIds: signalIds(result, spoofingIds),
      metricHints: [
        metric("bid/ask", m.bidAskImbalancePercent),
        metric("slippage 10k", m.simulatedSlippage10k),
      ].filter(Boolean) as Array<{ label: string; value: number | string }>,
    },
    {
      id: "holder_cluster",
      agent: "holders",
      score: clamp(agentScore(result, "holders") + signalPoints(result, holderIds) * 0.32 + holderStress + fdvStress),
      severity: "low",
      confidence: confidenceFor(result, "holders"),
      evidenceSignalIds: signalIds(result, holderIds),
      metricHints: [
        metric("top 10", m.top10HolderPercent),
        metric("holders", m.holderCount),
        metric("FDV/MC", m.fdvToMarketCapRatio),
      ].filter(Boolean) as Array<{ label: string; value: number | string }>,
    },
    {
      id: "contract_control",
      agent: "contract",
      score: clamp(agentScore(result, "contract") + signalPoints(result, contractIds) * 0.38 + contractTaxStress),
      severity: "low",
      confidence: confidenceFor(result, "contract"),
      evidenceSignalIds: signalIds(result, contractIds),
      metricHints: [
        metric("sell tax", m.sellTaxPercentage),
        metric("buy tax", m.buyTaxPercentage),
        metric("chain", result.token.chainId),
      ].filter(Boolean) as Array<{ label: string; value: number | string }>,
    },
    {
      id: "data_blindspot",
      agent: "data",
      score: clamp(agentScore(result, "data") + signalPoints(result, dataIds) * 0.42 + confidenceGap * 72),
      severity: "low",
      confidence: confidenceFor(result, "data"),
      evidenceSignalIds: signalIds(result, dataIds),
      metricHints: [
        metric("confidence", `${Math.round((result.confidence ?? 0.45) * 100)}%`),
        metric("quality", result.dataQuality),
        metric("sources", result.dataSources.length),
      ].filter(Boolean) as Array<{ label: string; value: number | string }>,
    },
  ];
  for (const vector of vectors) {
    vector.severity = severityFromScore(vector.score);
  }

  const sorted = [...vectors].sort((a, b) => b.score - a.score);
  const activeLayers = vectors.filter((vector) => vector.confidence >= 0.55 || vector.evidenceSignalIds.length > 0).map((vector) => vector.id);
  const missingLayers = vectors.filter((vector) => vector.confidence < 0.45 && vector.evidenceSignalIds.length === 0).map((vector) => vector.id);
  const readinessScore = clamp(
    42 + activeLayers.length * 8 + Math.min(18, result.dataSources.length * 3) + Math.round((result.confidence ?? 0.45) * 18) - missingLayers.length * 7,
  );

  return {
    version: "attack-surface-v1",
    generatedAt: new Date().toISOString(),
    topVector: sorted[0] ?? vectors[0],
    vectors: sorted,
    defenseReadiness: {
      score: readinessScore,
      verdict: readinessScore >= 72 ? "strong" : readinessScore >= 48 ? "partial" : "weak",
      missingLayers,
      activeLayers,
    },
  };
}
