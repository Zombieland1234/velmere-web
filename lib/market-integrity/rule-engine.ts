import type { MarketIntegrityRow } from "./coingecko";
import type { MarketMemoryMeta } from "./market-memory";
import type { RiskAgentId, RiskLevel, TokenRiskResult } from "./risk-types";

export type ShieldRuleSeverity = "info" | "watch" | "warning" | "critical";
export type ShieldRuleAction =
  | "monitor"
  | "open_case"
  | "review_liquidity"
  | "review_contract"
  | "review_data"
  | "cool_down";

export type ShieldRuleHit = {
  id: string;
  ruleId: string;
  symbol: string;
  name: string;
  score: number;
  level: RiskLevel;
  severity: ShieldRuleSeverity;
  action: ShieldRuleAction;
  priority: number;
  headline: string;
  reason: string;
  nextStep: string;
  values: Record<string, number | string | boolean | null | undefined>;
  timestamp: string;
};

export type ShieldRulesSummary = {
  version: string;
  totalHits: number;
  critical: number;
  warning: number;
  watch: number;
  watchlistHits: number;
  risingFast: number;
  generatedAt: string;
  watchlist: string[];
};

export type ShieldRulesResult = {
  summary: ShieldRulesSummary;
  hits: ShieldRuleHit[];
};

type RowWithMemory = MarketIntegrityRow & { memory?: MarketMemoryMeta };

const DEFAULT_WATCHLIST = ["BTC", "ETH", "SOL", "OM", "PEPE", "DOGE", "VLM"];

function cleanSymbol(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9:_-]/g, "").slice(0, 32);
}

export function parseShieldWatchlist(input?: string | null): string[] {
  const raw = String(input ?? process.env.VELMERE_SHIELD_WATCHLIST ?? DEFAULT_WATCHLIST.join(","));
  const values = raw
    .split(/[\s,;|]+/)
    .map(cleanSymbol)
    .filter(Boolean);
  return Array.from(new Set(values)).slice(0, 50);
}

function hasSignal(result: TokenRiskResult, ids: string[]) {
  return result.signals.some((signal) => ids.includes(signal.id));
}

function scoreAgent(result: TokenRiskResult, id: RiskAgentId) {
  return result.agentAssessments?.find((agent) => agent.id === id)?.score ?? 0;
}

function ruleHit(row: RowWithMemory, data: Omit<ShieldRuleHit, "id" | "symbol" | "name" | "score" | "level" | "timestamp">): ShieldRuleHit {
  const timestamp = row.memory?.lastSeenAt ?? row.result.generatedAt ?? new Date().toISOString();
  return {
    ...data,
    id: `${data.ruleId}:${row.symbol}:${timestamp}`.toLowerCase().replace(/[^a-z0-9:_-]/g, "-"),
    symbol: row.symbol,
    name: row.name,
    score: row.result.score,
    level: row.result.level,
    timestamp,
  };
}

function severityWeight(severity: ShieldRuleSeverity) {
  if (severity === "critical") return 400;
  if (severity === "warning") return 260;
  if (severity === "watch") return 120;
  return 20;
}

export function buildShieldRuleHits(rows: RowWithMemory[], watchlistInput?: string | null): ShieldRulesResult {
  const watchlist = parseShieldWatchlist(watchlistInput);
  const watch = new Set(watchlist);
  const hits: ShieldRuleHit[] = [];

  for (const row of rows) {
    const result = row.result;
    const riskDelta = row.memory?.riskDeltaLatest ?? 0;
    const priceDelta = row.memory?.priceDeltaLatestPercent ?? row.priceChange24h ?? 0;
    const volumeDelta = row.memory?.volumeDeltaLatestPercent ?? 0;
    const confidence = result.confidence ?? 1;
    const liquidityScore = scoreAgent(result, "liquidity");
    const velocityScore = scoreAgent(result, "velocity");
    const dataScore = scoreAgent(result, "data");
    const contractScore = scoreAgent(result, "contract");
    const watched = watch.has(row.symbol) || Boolean(row.id && watch.has(row.id.toUpperCase()));

    if (riskDelta >= 12 || row.memory?.trend === "rising_risk") {
      hits.push(ruleHit(row, {
        ruleId: "risk_rising_fast",
        severity: riskDelta >= 20 || result.score >= 85 ? "critical" : "warning",
        action: "open_case",
        priority: 95 + Math.max(0, riskDelta) + result.score / 10,
        headline: `${row.symbol}: risk rising fast`,
        reason: `Risk score moved by ${riskDelta >= 0 ? "+" : ""}${riskDelta} in the latest sweep window.`,
        nextStep: "Open the case file, compare latest evidence with prior snapshots and keep the automated scan active.",
        values: { riskDelta, trend: row.memory?.trend, observations: row.memory?.observations },
      }));
    }

    if (result.score >= 85 || result.level === "critical") {
      hits.push(ruleHit(row, {
        ruleId: "critical_cluster_escalation",
        severity: "critical",
        action: "open_case",
        priority: 115 + result.score,
        headline: `${row.symbol}: critical market-integrity cluster`,
        reason: result.metaModel?.summary ?? "Multiple independent layers produced a critical score.",
        nextStep: "Export the evidence report, verify liquidity, contract permissions, holder concentration and exchange depth.",
        values: { score: result.score, confidence, dominantAgent: result.metaModel?.dominantAgent },
      }));
    }

    if (hasSignal(result, ["parabolic_24h_gain", "parabolic_7d_gain", "parabolic_30d_gain", "multi_timeframe_pump", "new_ath_repricing"]) && liquidityScore >= 18) {
      hits.push(ruleHit(row, {
        ruleId: "pump_with_exit_liquidity_gap",
        severity: result.score >= 65 ? "warning" : "watch",
        action: "review_liquidity",
        priority: 75 + velocityScore + liquidityScore,
        headline: `${row.symbol}: pump + liquidity gap`,
        reason: "Velocity is elevated while liquidity/depth evidence is not strong enough to treat the move as clean.",
        nextStep: "Run order-book depth view, compare volume with usable liquidity and check whether candles show distribution after the move.",
        values: { velocityScore, liquidityScore, priceDelta },
      }));
    }

    if (Math.abs(volumeDelta) >= 80 || (row.volume24h && row.marketCap && row.volume24h / row.marketCap > 0.65)) {
      const volumeToMarketCap = row.volume24h && row.marketCap ? row.volume24h / row.marketCap : undefined;
      hits.push(ruleHit(row, {
        ruleId: "volume_marketcap_stress",
        severity: result.score >= 65 || Math.abs(volumeDelta) >= 150 ? "warning" : "watch",
        action: "review_liquidity",
        priority: 55 + Math.min(100, Math.abs(volumeDelta)) / 2 + result.score / 2,
        headline: `${row.symbol}: abnormal volume stress`,
        reason: "Volume shifted aggressively relative to recent sweep memory or market capitalization.",
        nextStep: "Check if volume is distributed across real venues or concentrated in a thin market/pair.",
        values: { volumeDelta, volumeToMarketCap: volumeToMarketCap ? Number(volumeToMarketCap.toFixed(4)) : undefined },
      }));
    }

    if (confidence < 0.48 && result.score >= 35) {
      hits.push(ruleHit(row, {
        ruleId: "data_blindspot_guardrail",
        severity: result.score >= 65 ? "warning" : "watch",
        action: "review_data",
        priority: 50 + dataScore + result.score / 2,
        headline: `${row.symbol}: risk with partial data`,
        reason: "The score is elevated, but confidence is limited because one or more intelligence layers are missing.",
        nextStep: "Do not interpret missing holder, contract or order-book data as safety. Treat it as uncertainty.",
        values: { confidence: Number(confidence.toFixed(2)), dataScore, sources: result.dataSources.join(" | ") },
      }));
    }

    if (contractScore >= 22 || hasSignal(result, ["contract_privileges", "honeypot_risk", "high_sell_tax", "mint_risk", "blacklist_risk"])) {
      hits.push(ruleHit(row, {
        ruleId: "contract_control_escalation",
        severity: contractScore >= 45 ? "critical" : "warning",
        action: "review_contract",
        priority: 70 + contractScore + result.score / 4,
        headline: `${row.symbol}: contract-control review`,
        reason: "Contract agent found permissions or tax logic that can change execution risk.",
        nextStep: "Review owner rights, mint/pause/blacklist/tax settings and whether privileges can be renounced or upgraded.",
        values: { contractScore, sellTax: result.metrics.sellTaxPercentage, buyTax: result.metrics.buyTaxPercentage },
      }));
    }

    if (watched && (result.score >= 35 || Math.abs(priceDelta) >= 6 || Math.abs(volumeDelta) >= 35)) {
      hits.push(ruleHit(row, {
        ruleId: "watchlist_guard",
        severity: result.score >= 65 ? "warning" : "watch",
        action: result.score >= 65 ? "open_case" : "monitor",
        priority: 45 + result.score + Math.abs(priceDelta) / 2,
        headline: `${row.symbol}: watchlist movement`,
        reason: "Asset is on the Shield watchlist and crossed a movement or risk threshold.",
        nextStep: "Keep it pinned in the dashboard and compare the next sweep before making any conclusion.",
        values: { watched: true, score: result.score, priceDelta, volumeDelta },
      }));
    }

    if ((row.memory?.riskDeltaLatest ?? 0) <= -10 && result.score < 65) {
      hits.push(ruleHit(row, {
        ruleId: "case_cooling_candidate",
        severity: "info",
        action: "cool_down",
        priority: 20 + Math.abs(riskDelta),
        headline: `${row.symbol}: case cooling candidate`,
        reason: "Risk moved down enough to mark the case as cooling if the next sweep confirms it.",
        nextStep: "Keep one more observation before lowering manual-review priority.",
        values: { riskDelta, score: result.score },
      }));
    }
  }

  const sorted = hits
    .sort((a, b) => severityWeight(b.severity) + b.priority - (severityWeight(a.severity) + a.priority))
    .slice(0, 30);

  const summary: ShieldRulesSummary = {
    version: "shield-rules-v1.0",
    totalHits: sorted.length,
    critical: sorted.filter((hit) => hit.severity === "critical").length,
    warning: sorted.filter((hit) => hit.severity === "warning").length,
    watch: sorted.filter((hit) => hit.severity === "watch").length,
    watchlistHits: sorted.filter((hit) => hit.ruleId === "watchlist_guard").length,
    risingFast: sorted.filter((hit) => hit.ruleId === "risk_rising_fast").length,
    generatedAt: new Date().toISOString(),
    watchlist,
  };

  return { summary, hits: sorted };
}

export function buildSingleAssetRuleHits(result: TokenRiskResult, watchlistInput?: string | null): ShieldRulesResult {
  const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
  const row: RowWithMemory = {
    id,
    rank: result.token.rank,
    symbol: result.token.symbol,
    name: result.token.name,
    image: result.token.image,
    price: result.metrics.currentPrice,
    priceChange1h: result.metrics.priceChange1h,
    priceChange24h: result.metrics.priceChange24h,
    priceChange7d: result.metrics.priceChange7d,
    priceChange14d: result.metrics.priceChange14d,
    priceChange30d: result.metrics.priceChange30d,
    marketCap: result.metrics.marketCap,
    fdv: result.metrics.fdv,
    volume24h: result.metrics.volume24h,
    ath: result.metrics.athPrice,
    sparkline7d: result.chart?.sevenDay ?? [],
    result,
  };
  return buildShieldRuleHits([row], watchlistInput);
}
