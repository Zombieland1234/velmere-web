import type { MarketIntegrityRow } from "./coingecko";
import type { MarketMemoryMeta } from "./market-memory";
import type { RiskAgentId, RiskLevel } from "./risk-types";

export type ShieldSentinelAlertType =
  | "critical_cluster"
  | "rising_risk"
  | "parabolic_pump"
  | "liquidity_stress"
  | "data_gap";

export type ShieldSentinelAlert = {
  id: string;
  type: ShieldSentinelAlertType;
  symbol: string;
  name: string;
  score: number;
  level: RiskLevel;
  confidence?: number;
  dominantAgent?: RiskAgentId;
  riskDelta?: number;
  priceDeltaPercent?: number;
  volumeDeltaPercent?: number;
  trend?: MarketMemoryMeta["trend"];
  timestamp?: string;
  headline: string;
  reason: string;
  action: string;
};

type MarketIntegrityRowWithMemory = MarketIntegrityRow & {
  memory?: MarketMemoryMeta;
};

function firstSignal(row: MarketIntegrityRow, ids: string[]) {
  return row.result.signals.find((signal) => ids.includes(signal.id));
}

function pushUnique(alerts: ShieldSentinelAlert[], alert: ShieldSentinelAlert) {
  if (alerts.some((item) => item.id === alert.id)) return;
  alerts.push(alert);
}

export function buildSentinelAlerts(rows: MarketIntegrityRowWithMemory[]): ShieldSentinelAlert[] {
  const alerts: ShieldSentinelAlert[] = [];
  const ranked = [...rows].sort((a, b) => b.result.score - a.result.score);

  for (const row of ranked.slice(0, 80)) {
    const result = row.result;
    const dominantAgent = result.metaModel?.dominantAgent;
    const base = {
      symbol: row.symbol,
      name: row.name,
      score: result.score,
      level: result.level,
      confidence: result.confidence,
      dominantAgent,
      riskDelta: row.memory?.riskDeltaLatest,
      priceDeltaPercent: row.memory?.priceDeltaLatestPercent,
      volumeDeltaPercent: row.memory?.volumeDeltaLatestPercent,
      trend: row.memory?.trend,
      timestamp: row.memory?.lastSeenAt ?? new Date().toISOString(),
    };

    if (result.score >= 85) {
      pushUnique(alerts, {
        ...base,
        id: `critical-${row.id}`,
        type: "critical_cluster",
        headline: `${row.symbol}: critical market-integrity cluster`,
        reason: result.metaModel?.summary ?? "Multiple agents produced a critical risk profile.",
        action: "Open evidence card, verify liquidity, contract, order book and supply distribution.",
      });
    }

    const delta = row.memory?.riskDeltaLatest ?? 0;
    if (delta >= 10 || row.memory?.trend === "rising_risk") {
      pushUnique(alerts, {
        ...base,
        id: `rising-${row.id}`,
        type: "rising_risk",
        headline: `${row.symbol}: risk velocity rising`,
        reason: `Risk delta changed by ${delta > 0 ? "+" : ""}${delta} points in the latest sweep window.`,
        action: "Compare the latest sweep with historical snapshots and watch for order-book stress.",
      });
    }

    const pumpSignal = firstSignal(row, ["parabolic_24h_gain", "parabolic_7d_gain", "parabolic_30d_gain", "multi_timeframe_pump", "new_ath_repricing"]);
    if (pumpSignal) {
      pushUnique(alerts, {
        ...base,
        id: `pump-${row.id}`,
        type: "parabolic_pump",
        headline: `${row.symbol}: parabolic pump signature`,
        reason: `Velocity agent detected ${pumpSignal.id.replaceAll("_", " ")} (+${pumpSignal.points}).`,
        action: "Check whether volume, liquidity and holder distribution justify the repricing.",
      });
    }

    const liquiditySignal = firstSignal(row, ["very_thin_liquidity", "thin_liquidity", "low_dex_liquidity", "wash_trading_risk", "market_volume_stress", "volume_spike"]);
    if (liquiditySignal && result.score >= 45) {
      pushUnique(alerts, {
        ...base,
        id: `liquidity-${row.id}`,
        type: "liquidity_stress",
        headline: `${row.symbol}: liquidity / volume stress`,
        reason: `Liquidity agent detected ${liquiditySignal.id.replaceAll("_", " ")} (+${liquiditySignal.points}).`,
        action: "Run slippage simulation and check whether market cap is backed by usable depth.",
      });
    }

    if ((result.confidence ?? 1) < 0.45 && result.score >= 35) {
      pushUnique(alerts, {
        ...base,
        id: `data-gap-${row.id}`,
        type: "data_gap",
        headline: `${row.symbol}: incomplete intelligence coverage`,
        reason: "Risk is elevated while one or more data layers are missing or partial.",
        action: "Treat missing holder/contract/order-book data as uncertainty, not safety.",
      });
    }
  }

  return alerts
    .sort((a, b) => {
      const typeWeight = (alert: ShieldSentinelAlert) =>
        alert.type === "critical_cluster" ? 40 : alert.type === "rising_risk" ? 30 : alert.type === "parabolic_pump" ? 20 : alert.type === "liquidity_stress" ? 15 : 5;
      return b.score + typeWeight(b) - (a.score + typeWeight(a));
    })
    .slice(0, 10);
}
