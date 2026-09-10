import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";
import { buildHolderIntelligence } from "@/lib/market-integrity/holder-intelligence";
import { buildLiquidityIntelligence } from "@/lib/market-integrity/liquidity-intelligence";
import { buildStressScenarios } from "@/lib/market-integrity/stress-simulator";

export type OperatorCopilotContext = {
  candlesCount: number;
  chartSource: string;
  hasOrderBook: boolean;
  orderbookRiskPoints?: number;
  historyCount: number;
  activeCommand: string;
  terminalBootDeferred: boolean;
  shieldMapDetached: boolean;
  sourceHonestyVisible: boolean;
  chatHistoryCount?: number;
};

export type OperatorCopilotPrompt = {
  id: string;
  label: string;
  prompt: string;
  when: string;
  guardrail: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function qualityPenalty(result: TokenRiskResult, context: OperatorCopilotContext) {
  let penalty = 0;
  if (result.dataQuality !== "live") penalty += 12;
  if (!context.hasOrderBook) penalty += 14;
  if (context.candlesCount < 80) penalty += 10;
  if (context.historyCount < 2) penalty += 8;
  if (!context.sourceHonestyVisible) penalty += 12;
  return penalty;
}

export function buildTerminalOperatorCopilot(
  result: TokenRiskResult,
  context: OperatorCopilotContext,
) {
  const holder = buildHolderIntelligence(result);
  const liquidity = buildLiquidityIntelligence(result);
  const stress = buildStressScenarios(result);
  const worstStress = stress.worstScenario ?? stress.scenarios[0];
  const dataPenalty = qualityPenalty(result, context);
  const confidenceScore = clamp(
    Math.round(
      76 -
        dataPenalty +
        (context.terminalBootDeferred ? 5 : -5) +
        (context.shieldMapDetached ? 4 : -4) -
        Math.max(0, result.score - 70) * 0.12,
    ),
  );
  const operatingMode = confidenceScore >= 76 ? "operator_ready" : confidenceScore >= 55 ? "review_mode" : "source_limited";
  const uncertaintyPercent = clamp(100 - confidenceScore);

  const missingData = [
    !context.hasOrderBook
      ? "Live order-book depth / slippage feed is missing; do not infer exit safety from price chart alone."
      : undefined,
    context.candlesCount < 80
      ? "Candle density is below terminal target; cross-check with Binance klines or fallback source label."
      : undefined,
    context.historyCount < 2
      ? "Risk replay has too few snapshots; treat trend direction as preliminary."
      : undefined,
    holder.dataCompleteness < 72
      ? "Holder clusters are incomplete; unknown bucket remains uncertainty, not evidence of safety."
      : undefined,
    liquidity.sourceMode !== "live_orderbook"
      ? "Liquidity intelligence is not fully live; keep depth and sell-impact wording cautious."
      : undefined,
  ].filter(Boolean) as string[];

  const immediateActions = [
    {
      id: "read-dominant-layer",
      label: "Read dominant layer",
      body: `Start with ${result.metaModel?.dominantAgent ?? result.agentAssessments?.[0]?.label ?? "the strongest risk lens"}; score ${result.score}/100 is an anomaly-review signal, not an accusation.`,
      status: result.score >= 65 ? "watch" : "ready",
    },
    {
      id: "verify-sources",
      label: "Verify sources",
      body: `Source mode is ${result.dataQuality}; chart source is ${context.chartSource}; order book ${context.hasOrderBook ? "connected" : "missing"}.`,
      status: missingData.length ? "watch" : "ready",
    },
    {
      id: "stress-before-export",
      label: "Stress before export",
      body: worstStress ? `Highest stress scenario: ${worstStress.label} (${worstStress.score}/100).` : "No dominant stress scenario yet; keep stress section as pending.",
      status: worstStress && worstStress.score >= 62 ? "watch" : "ready",
    },
    {
      id: "legal-language",
      label: "Legal language",
      body: "Use anomaly, requires manual review, uncertainty and algorithmic flag wording. Never use scam/fraud verdicts.",
      status: "ready",
    },
  ];

  const prompts: OperatorCopilotPrompt[] = [
    {
      id: "soc-summary",
      label: "SOC summary",
      prompt: `Summarize ${result.token.symbol} in 5 bullets: dominant anomaly layer, missing data, liquidity/holder caveats, next verification step, and legal-safe disclaimer.`,
      when: "Use before opening or updating a case file.",
      guardrail: "No hype, no FUD, no proof language.",
    },
    {
      id: "missing-data",
      label: "Missing data audit",
      prompt: `List missing sources for ${result.token.symbol} and explain how each one changes confidence. Keep unknowns as uncertainty, not safety.`,
      when: "Use when chart, holders, order book or replay is partial.",
      guardrail: "Do not lower risk because data is absent.",
    },
    {
      id: "holder-question",
      label: "Holder question",
      prompt: `Explain holder concentration for ${result.token.symbol}: whales, CEX/custody, team/treasury, DEX/LP, retail and unknown clusters. Include data completeness.`,
      when: "Use after holder panel or before evidence export.",
      guardrail: "Custody labels are not whale proof unless source-labeled.",
    },
    {
      id: "liquidity-question",
      label: "Liquidity question",
      prompt: `Compare order-book depth, stress simulator and liquidity danger zones for ${result.token.symbol}. What must be verified before any strong statement?`,
      when: "Use when user asks why a token can look stable but still require review.",
      guardrail: "No price prediction or investment advice.",
    },
  ];

  return {
    version: "velmere_terminal_operator_copilot_v1_pass70",
    operatingMode,
    confidenceScore,
    uncertaintyPercent,
    activeCommand: context.activeCommand,
    headline:
      operatingMode === "operator_ready"
        ? "Copilot can guide the case, while still keeping review language."
        : operatingMode === "review_mode"
          ? "Copilot keeps the operator in review mode until sources are stronger."
          : "Copilot is source-limited; do not escalate beyond anomaly review.",
    immediateActions,
    missingData,
    prompts,
    uiContract: [
      "Chart and command palette must paint before heavy panels.",
      "Every confidence number must sit near a source or uncertainty label.",
      "Shield Map explains workflow boundaries without exposing private scoring weights.",
      "VLM remains access/utility only, never ROI or passive-income positioning.",
    ],
    legalNote:
      "Not financial advice. Algorithmic risk flag only. Signals indicate anomalies requiring review, not legal proof or accusation.",
  };
}
