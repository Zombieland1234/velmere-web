import type { TokenRiskResult, RiskLevel } from "./risk-types";
import { buildAiRiskBotBrief } from "./ai-risk-bot";
import { buildHolderIntelligence } from "./holder-intelligence";
import { buildStressScenarios, getWorstStressScenario } from "./stress-simulator";
import { buildRiskReplay } from "./risk-replay";
import { buildChartRegime } from "./chart-regime";

type HistoryLike = Array<{ score?: number; timestamp?: string; price?: number; volume24h?: number }>;

export type SocSeverity = "clear" | "watch" | "warning" | "critical";

export type SocCommand = {
  id: string;
  label: string;
  priority: number;
  severity: SocSeverity;
  reason: string;
  action: string;
  layer: "velocity" | "liquidity" | "holders" | "contract" | "chart" | "data" | "evidence";
};

export type SocReadinessCheck = {
  id: string;
  label: string;
  status: "pass" | "watch" | "fail";
  value: string;
  fix: string;
};

export type SocTerminalBrief = {
  version: "soc_orchestrator_v1";
  status: SocSeverity;
  headline: string;
  confidence: number;
  commandQueue: SocCommand[];
  readiness: SocReadinessCheck[];
  analystNarrative: string;
  nextBestAction: string;
  disclaimer: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function pct(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return "source required";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
}

function money(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return "source required";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function severityFromScore(score: number): SocSeverity {
  if (score >= 82) return "critical";
  if (score >= 62) return "warning";
  if (score >= 35) return "watch";
  return "clear";
}

function levelToSeverity(level: RiskLevel): SocSeverity {
  if (level === "critical") return "critical";
  if (level === "high") return "warning";
  if (level === "medium") return "watch";
  return "clear";
}

function pushCommand(queue: SocCommand[], command: SocCommand) {
  queue.push(command);
}

export function buildSocTerminalBrief(result: TokenRiskResult, history: HistoryLike = []): SocTerminalBrief {
  const bot = buildAiRiskBotBrief(result, history);
  const holders = buildHolderIntelligence(result);
  const stress = buildStressScenarios(result);
  const replay = buildRiskReplay(result, history);
  const chart = buildChartRegime(result, {
    bars: result.chart?.sevenDay?.length ?? 0,
    source: result.chart?.sevenDay?.length ? "sparkline" : "metric fallback",
  });
  const worstStress = getWorstStressScenario(stress);
  const worstStressScore = worstStress?.score ?? 0;
  const historyDelta = history.length >= 2
    ? Math.round((history.at(-1)?.score ?? result.score) - (history[0]?.score ?? result.score))
    : 0;
  const liquidity = result.metrics.liquidityUsd;
  const marketCap = result.metrics.marketCap;
  const liquidityCoverage = liquidity && marketCap ? (liquidity / marketCap) * 100 : undefined;
  const confidence = clamp(Math.round((result.confidence ?? 0.46) * 100) - (result.dataQuality === "partial" ? 6 : result.dataQuality === "demo" ? 14 : 0), 18, 96);
  const queue: SocCommand[] = [];

  pushCommand(queue, {
    id: "risk-score-review",
    label: "Review fused risk score",
    priority: result.score >= 65 ? 96 : result.score >= 35 ? 68 : 34,
    severity: levelToSeverity(result.level),
    reason: `Current fused risk is ${result.score}/100 with ${confidence}% confidence.`,
    action: "Read AI bot narrative first, then verify the highest scoring layer before opening a case.",
    layer: "evidence",
  });

  if (Math.abs(result.metrics.priceChange24h ?? 0) >= 6 || Math.abs(result.metrics.priceChange7d ?? 0) >= 15 || chart.score >= 55) {
    pushCommand(queue, {
      id: "chart-regime-review",
      label: "Inspect candle regime",
      priority: 84,
      severity: chart.score >= 65 ? "warning" : "watch",
      reason: `Chart regime=${chart.regime}, 24h=${pct(result.metrics.priceChange24h)}, 7d=${pct(result.metrics.priceChange7d)}.`,
      action: "Compare candle move with VWAP, POC, volume profile and order-book depth.",
      layer: "chart",
    });
  }

  if ((liquidityCoverage ?? 100) < 3 || (result.metrics.simulatedSlippage10k ?? 0) > 2.5 || worstStressScore >= 62) {
    pushCommand(queue, {
      id: "exit-depth-review",
      label: "Verify exit liquidity",
      priority: 90,
      severity: worstStressScore >= 75 ? "critical" : "warning",
      reason: `Liquidity coverage=${liquidityCoverage === undefined ? "source required" : pct(liquidityCoverage)}, worst stress=${worstStress?.score ?? "source required"}/100.`,
      action: "Open depth/heatmap, check bid support, simulate sell pressure and mark unsupported pairs as uncertainty.",
      layer: "liquidity",
    });
  }

  if (holders.holderRiskScore >= 45 || result.metrics.top10HolderPercent === undefined) {
    pushCommand(queue, {
      id: "holder-cluster-review",
      label: "Audit holder clusters",
      priority: holders.holderRiskScore >= 70 ? 88 : 66,
      severity: holders.holderRiskScore >= 70 ? "warning" : "watch",
      reason: `Holder brain=${holders.holderRiskScore}/100, data completeness=${holders.dataCompleteness}%.`,
      action: "Separate whales, CEX, team and unclassified wallets. Missing chain data must not be treated as safety.",
      layer: "holders",
    });
  }

  if (historyDelta >= 12 || replay.accelerationScore >= 55) {
    pushCommand(queue, {
      id: "replay-acceleration",
      label: "Replay acceleration check",
      priority: 80,
      severity: replay.accelerationScore >= 70 ? "warning" : "watch",
      reason: `Replay phase=${replay.dominantPhase}, acceleration=${replay.accelerationScore}/100, risk delta=${historyDelta}.`,
      action: "Use replay timeline before final verdict. Rising risk should create a watch case, not an accusation.",
      layer: "velocity",
    });
  }

  if (result.dataQuality !== "live" || confidence < 58) {
    pushCommand(queue, {
      id: "data-quality-guard",
      label: "Keep uncertainty visible",
      priority: 76,
      severity: confidence < 45 ? "warning" : "watch",
      reason: `Data quality=${result.dataQuality}, confidence=${confidence}%.`,
      action: "Show missing data, use fallback labels and avoid definitive language until sources are attached.",
      layer: "data",
    });
  }

  const commandQueue = queue
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);

  const readiness: SocReadinessCheck[] = [
    {
      id: "icon-presence",
      label: "Token identity",
      status: result.token.image ? "pass" : "watch",
      value: result.token.image ? "logo available" : "fallback initials",
      fix: "Keep CoinGecko/DexScreener icon proxy and never hide fallback initials.",
    },
    {
      id: "chart-density",
      label: "Candle density",
      status: chart.density === "terminal" ? "pass" : chart.density === "usable" ? "watch" : "fail",
      value: chart.density,
      fix: "Use Binance klines when supported; otherwise label chart as fallback.",
    },
    {
      id: "holder-source",
      label: "Holder source",
      status: holders.dataCompleteness >= 70 ? "pass" : holders.dataCompleteness >= 35 ? "watch" : "fail",
      value: `${holders.dataCompleteness}% complete`,
      fix: "Attach real chain holder API and CEX wallet exclusion before strong holder claims.",
    },
    {
      id: "liquidity-context",
      label: "Liquidity context",
      status: liquidityCoverage === undefined ? "watch" : liquidityCoverage >= 8 ? "pass" : liquidityCoverage >= 3 ? "watch" : "fail",
      value: liquidityCoverage === undefined ? "source required" : pct(liquidityCoverage),
      fix: "Compare visible liquidity with market cap and stress simulator.",
    },
    {
      id: "legal-tone",
      label: "Language guard",
      status: "pass",
      value: "non-accusatory",
      fix: "Use anomaly/review language; never promise profit or call fraud without proof.",
    },
  ];

  const failingReadiness = readiness.filter((item) => item.status === "fail").length;
  const status = severityFromScore(Math.max(result.score, worstStress?.score ?? 0, chart.score, holders.holderRiskScore + failingReadiness * 8));
  const nextBestAction = commandQueue[0]?.action ?? "Monitor and wait for stronger evidence before opening a case.";

  return {
    version: "soc_orchestrator_v1",
    status,
    headline: status === "critical"
      ? "SOC queue requires immediate analyst review."
      : status === "warning"
        ? "SOC queue found layers requiring review."
        : status === "watch"
          ? "SOC queue is watching weak or incomplete layers."
          : "SOC queue is clear under current data.",
    confidence,
    commandQueue,
    readiness,
    analystNarrative: `${result.token.symbol}: ${bot.narrative} SOC view: chart=${chart.regime}, holder=${holders.holderRiskScore}/100, replay=${replay.dominantPhase}, liquidity=${money(liquidity)}. This is an anomaly triage workflow, not a trading signal.`,
    nextBestAction,
    disclaimer: "Velmère Shield is an automated market-integrity triage tool. It is not financial advice, legal proof, or an accusation.",
  };
}
