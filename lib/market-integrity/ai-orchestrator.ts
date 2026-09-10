import type { TokenRiskResult } from "./risk-types";
import { buildAiRiskBotBrief } from "./ai-risk-bot";
import { buildRiskBrain } from "./risk-brain";
import { buildHolderIntelligence } from "./holder-intelligence";
import { buildStressScenarios } from "./stress-simulator";
import { buildRiskReplay } from "./risk-replay";

type HistoryLike = Array<{ score?: number; timestamp?: string; price?: number; volume24h?: number }>;

type OrchestratorPriority = "observe" | "review" | "escalate" | "block_confidence";

type OrchestratorAction = {
  id: string;
  priority: OrchestratorPriority;
  label: string;
  reason: string;
  owner: "ai_bot" | "liquidity" | "holders" | "chart" | "data" | "analyst";
  score: number;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function finite(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function priorityFromScore(score: number): OrchestratorPriority {
  if (score >= 82) return "escalate";
  if (score >= 62) return "review";
  if (score >= 38) return "observe";
  return "observe";
}

function pct(value?: number) {
  if (value === undefined || Number.isNaN(value)) return "unknown";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
}

export function buildAiRiskOrchestrator(result: TokenRiskResult, history: HistoryLike = []) {
  const bot = buildAiRiskBotBrief(result, history);
  const brain = buildRiskBrain(result, history);
  const holders = buildHolderIntelligence(result);
  const stress = buildStressScenarios(result);
  const replay = buildRiskReplay(result, history);

  const scoreDelta = history.length >= 2
    ? Math.round((history.at(-1)?.score ?? result.score) - (history[0]?.score ?? result.score))
    : 0;
  const liquidity = finite(result.metrics.liquidityUsd);
  const marketCap = finite(result.metrics.marketCap);
  const liquidityCoverage = liquidity && marketCap ? (liquidity / marketCap) * 100 : undefined;
  const holderMissing = result.metrics.top10HolderPercent === undefined || result.metrics.holderCount === undefined;
  const klineHint = Math.abs(result.metrics.priceChange1h ?? 0) > 4
    ? "1h candle movement is high; keep the terminal in candle-first mode."
    : "1h candle movement is not dominant; compare with 24h and 7d before narrative.";

  const actionCandidates: OrchestratorAction[] = [
    {
      id: "candle_multi_tf",
      priority: priorityFromScore(Math.abs(result.metrics.priceChange24h ?? 0) * 3.2),
      label: "Multi-timeframe candle review",
      reason: `Compare 1h=${pct(result.metrics.priceChange1h)}, 24h=${pct(result.metrics.priceChange24h)}, 7d=${pct(result.metrics.priceChange7d)}. ${klineHint}`,
      owner: "chart",
      score: Math.round(clamp(Math.abs(result.metrics.priceChange24h ?? 0) * 3.2 + Math.abs(result.metrics.priceChange1h ?? 0) * 5.5)),
    },
    {
      id: "exit_liquidity_gate",
      priority: liquidityCoverage === undefined ? "block_confidence" : priorityFromScore(liquidityCoverage < 0.5 ? 90 : liquidityCoverage < 2 ? 72 : 34),
      label: "Exit liquidity confidence gate",
      reason: liquidityCoverage === undefined
        ? "Liquidity coverage is missing; Shield must keep uncertainty visible and avoid strong safety wording."
        : `Visible liquidity covers ~${liquidityCoverage.toFixed(2)}% of market cap; compare with sell shocks and order book heatmap.`,
      owner: "liquidity",
      score: liquidityCoverage === undefined ? 76 : Math.round(clamp(liquidityCoverage < 0.5 ? 90 : liquidityCoverage < 2 ? 72 : liquidityCoverage < 5 ? 46 : 22)),
    },
    {
      id: "holder_cluster_gate",
      priority: holderMissing ? "block_confidence" : priorityFromScore(holders.holderRiskScore),
      label: "Holder cluster confidence gate",
      reason: holderMissing
        ? "Holder data is incomplete; keep proxy/unknown state visible and do not mark the asset as clean."
        : `Holder brain score is ${holders.holderRiskScore}/100; validate top wallets, CEX wallets and related clusters.`,
      owner: "holders",
      score: holderMissing ? 74 : holders.holderRiskScore,
    },
    {
      id: "risk_replay_delta",
      priority: priorityFromScore(Math.abs(scoreDelta) * 6 + replay.accelerationScore * 0.55),
      label: "Risk replay delta review",
      reason: `Stored risk delta is ${scoreDelta > 0 ? "+" : ""}${scoreDelta}; replay acceleration is ${replay.accelerationScore}/100.`,
      owner: "ai_bot",
      score: Math.round(clamp(Math.abs(scoreDelta) * 6 + replay.accelerationScore * 0.55)),
    },
    {
      id: "data_overlap_guard",
      priority: result.dataQuality === "live" ? "observe" : "block_confidence",
      label: "Data + UI overlap guard",
      reason: "Any missing source must render as uncertainty, not as empty space; every card must wrap text and keep logos visible.",
      owner: "data",
      score: result.dataQuality === "live" ? 28 : 70,
    },
  ];
  actionCandidates.sort((a, b) => b.score - a.score);

  const topStress = [...stress.scenarios].sort((a, b) => b.score - a.score)[0];
  const overall = Math.round(clamp(
    result.score * 0.28 +
    brain.brainScore * 0.24 +
    holders.holderRiskScore * 0.18 +
    (stress.worstScenario?.score ?? 0) * 0.18 +
    replay.accelerationScore * 0.12,
  ));

  const operatingMode = overall >= 82
    ? "critical_soc_queue"
    : overall >= 62
      ? "forensic_review"
      : overall >= 38
        ? "watchlist_monitor"
        : "quiet_monitoring";

  return {
    version: "VELMERE_AI_ORCHESTRATOR_V1",
    symbol: result.token.symbol,
    operatingMode,
    overall,
    confidence: Math.min(bot.confidence, brain.confidence),
    dominantLayer: brain.strongestLayer?.label ?? bot.dominantLayer,
    headline: `${result.token.symbol} operating mode: ${operatingMode.replace(/_/g, " ")}. Dominant layer: ${brain.strongestLayer?.label ?? bot.dominantLayer}.`,
    nextBestActions: actionCandidates.slice(0, 5),
    uiSafetyChecklist: [
      "Logo/avatar must stay visible in table and modal header.",
      "Long token names and AI text must wrap or truncate without overlapping adjacent controls.",
      "Candles should use dense kline ranges; sparse ranges must fall back to generated OHLC, not empty space.",
      "Unknown holder data must show uncertainty state, never fake certainty.",
      "Mobile modal must keep chart controls scrollable and avoid horizontal layout collisions.",
    ],
    confidenceGates: {
      candles: actionCandidates.find((item) => item.id === "candle_multi_tf"),
      liquidity: actionCandidates.find((item) => item.id === "exit_liquidity_gate"),
      holders: actionCandidates.find((item) => item.id === "holder_cluster_gate"),
      data: actionCandidates.find((item) => item.id === "data_overlap_guard"),
    },
    topStressScenario: topStress ? {
      id: topStress.id,
      label: topStress.label,
      score: topStress.score,
      severity: topStress.severity,
      nextStep: topStress.nextStep,
    } : undefined,
    narrative: [
      bot.narrative,
      `AI orchestrator fused score is ${overall}/100, with ${operatingMode.replace(/_/g, " ")} mode.`,
      topStress ? `Highest stress scenario: ${topStress.label} (${topStress.score}/100).` : "No stress scenario is dominant yet.",
      holderMissing ? "Holder analysis remains a confidence gate until real holder/cluster sources are connected." : "Holder layer is available and should be compared against liquidity.",
    ].join(" "),
    legalNote: "Signal orchestration only. Not proof, not accusation, not investment advice.",
    generatedAt: new Date().toISOString(),
  };
}
