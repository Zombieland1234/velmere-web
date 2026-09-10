import type { TokenRiskResult } from "./risk-types";
import { buildHolderIntelligence } from "./holder-intelligence";

export type TerminalReadinessStatus = "ready" | "watch" | "blocked";

export type TerminalReadinessGate = {
  id: string;
  label: string;
  status: TerminalReadinessStatus;
  score: number;
  evidence: string;
  nextStep: string;
};

export type TerminalReadinessBrief = {
  version: "velmere_terminal_readiness_v4_pass62_control_plane";
  symbol: string;
  overallReadiness: number;
  productTruth: string;
  gates: TerminalReadinessGate[];
  terminalMode: "demo_terminal" | "analyst_preview" | "production_candidate";
  missingProductionBlocks: string[];
  nextSprintStack: Array<{ id: string; label: string; why: string; owner: "frontend" | "backend" | "data" | "legal" | "product" }>;
  legalGuardrails: string[];
  uxPsychologyRules: string[];
  pass60ProductionSpine: Array<{ id: string; label: string; status: TerminalReadinessStatus; why: string }>;
  pass61OpsSpine: Array<{ id: string; label: string; status: TerminalReadinessStatus; why: string }>;
  pass62ControlPlaneSpine: Array<{ id: string; label: string; status: TerminalReadinessStatus; why: string }>;
  generatedAt: string;
};

export type TerminalReadinessInput = {
  candlesCount?: number;
  chartSource?: string;
  hasOrderBook?: boolean;
  orderBookRisk?: number;
  historyCount?: number;
  chatEnabled?: boolean;
  accessLayerVisible?: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function statusFromScore(score: number): TerminalReadinessStatus {
  if (score >= 72) return "ready";
  if (score >= 42) return "watch";
  return "blocked";
}

export function buildTerminalReadiness(
  result: TokenRiskResult,
  input: TerminalReadinessInput = {},
): TerminalReadinessBrief {
  const holder = buildHolderIntelligence(result);
  const confidence = Math.round((result.confidence ?? 0.35) * 100);
  const liveDataBonus = result.dataQuality === "live" ? 18 : result.dataQuality === "partial" ? 9 : 0;
  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const chartScore = clamp((candlesCount / 160) * 68 + liveDataBonus + (input.chartSource?.toLowerCase().includes("binance") ? 12 : 0));
  const holderScore = clamp(holder.dataCompleteness * 0.74 + (holder.uncertainty === "low" ? 16 : holder.uncertainty === "medium" ? 7 : 0));
  const liquidityScore = input.hasOrderBook ? clamp(76 - Math.max(0, input.orderBookRisk ?? 0) * 0.22) : clamp((result.metrics.liquidityUsd ? 42 : 18) + liveDataBonus);
  const evidenceScore = clamp(confidence * 0.52 + (input.historyCount ? 18 : 0) + (result.signals.length ? 14 : 0) + (input.hasOrderBook ? 8 : 0));
  const aiScore = clamp(62 + (input.chatEnabled ? 18 : 0) + (result.aiSummary ? 8 : 0) - (holder.dataUncertaintyPercent > 55 ? 12 : 0));
  const vlmScore = input.accessLayerVisible ? 74 : 46;
  const legalScore = 88;
  const sourceAuditScore = clamp((result.dataQuality === "live" ? 76 : result.dataQuality === "partial" ? 54 : 28) + (input.historyCount ? 10 : 0) + (input.hasOrderBook ? 8 : 0));

  const gates: TerminalReadinessGate[] = [
    {
      id: "chart-terminal",
      label: "Chart terminal",
      status: statusFromScore(chartScore),
      score: Math.round(chartScore),
      evidence: `${candlesCount} bars · ${input.chartSource ?? "fallback source"}`,
      nextStep: chartScore >= 72 ? "Keep multi-range candles dense and stable." : "Connect more real klines for 1m/15m/4h/1d/7d and preserve VWAP/volume profile.",
    },
    {
      id: "holder-intelligence",
      label: "Holder intelligence",
      status: statusFromScore(holderScore),
      score: Math.round(holderScore),
      evidence: `${holder.dataCompleteness}% complete · ${holder.dataUncertaintyPercent}% uncertainty`,
      nextStep: holderScore >= 72 ? "Keep unknown wallets visible and enrich labels." : "Connect holder API, wallet labels, CEX/custody registry and LP events.",
    },
    {
      id: "liquidity-depth",
      label: "Liquidity depth",
      status: statusFromScore(liquidityScore),
      score: Math.round(liquidityScore),
      evidence: input.hasOrderBook ? `order book risk ${input.orderBookRisk ?? 0}/100` : "order book missing or fallback-only",
      nextStep: input.hasOrderBook ? "Compare stress simulator with bid/ask heatmap." : "Add live multi-exchange depth and DEX pool impact before strong exit-risk claims.",
    },
    {
      id: "evidence-workflow",
      label: "Evidence workflow",
      status: statusFromScore(evidenceScore),
      score: Math.round(evidenceScore),
      evidence: `${result.signals.length} signals · ${input.historyCount ?? 0} history rows · confidence ${confidence}%`,
      nextStep: "Evidence must list source quality, missing data and manual-review commands before external handoff.",
    },
    {
      id: "ai-soc",
      label: "AI SOC workflow",
      status: statusFromScore(aiScore),
      score: Math.round(aiScore),
      evidence: input.chatEnabled ? "chat panel and command queue visible" : "bot brief only",
      nextStep: "Turn bot commands into executable terminal actions and keep answers short, source-aware and non-hype.",
    },
    {
      id: "vlm-access",
      label: "VLM access layer",
      status: statusFromScore(vlmScore),
      score: Math.round(vlmScore),
      evidence: input.accessLayerVisible ? "utility/access panel visible" : "access logic not visible",
      nextStep: "Connect wallet/session gating, member limits and legal policy before production token utility.",
    },
    {
      id: "source-audit",
      label: "Source audit spine",
      status: statusFromScore(sourceAuditScore),
      score: Math.round(sourceAuditScore),
      evidence: `${result.dataQuality} data · ${result.dataSources.length} source(s) · ${input.historyCount ?? 0} replay rows`,
      nextStep: "Show live/partial/fallback mode beside every strong visual before exporting evidence.",
    },
    {
      id: "legal-regtech",
      label: "Legal / RegTech wording",
      status: statusFromScore(legalScore),
      score: legalScore,
      evidence: "anomaly/review language enforced",
      nextStep: "Keep every high severity label as review priority, not accusation or investment advice.",
    },
  ];

  const weighted =
    chartScore * 0.18 +
    holderScore * 0.17 +
    liquidityScore * 0.17 +
    evidenceScore * 0.15 +
    aiScore * 0.14 +
    vlmScore * 0.09 +
    legalScore * 0.08 +
    sourceAuditScore * 0.02;
  const overallReadiness = Math.round(clamp(weighted));
  const terminalMode = overallReadiness >= 76 ? "production_candidate" : overallReadiness >= 48 ? "analyst_preview" : "demo_terminal";

  const missingProductionBlocks = [
    candlesCount < 120 ? "real dense klines for every interval" : null,
    !input.hasOrderBook ? "live multi-exchange order book and DEX depth" : null,
    holder.dataCompleteness < 70 ? "real on-chain holder graph, wallet labels and LP events" : null,
    (input.historyCount ?? 0) < 12 ? "persistent history with enough replay snapshots" : null,
    result.dataQuality !== "live" ? "stable live data source contract and freshness metadata" : null,
    "wallet/session gating for VLM access",
    "rate limits, audit logs and abuse policy for API endpoints",
    "ToS, privacy, data-source policy and utility-token disclaimer",
  ].filter((item): item is string => Boolean(item));

  return {
    version: "velmere_terminal_readiness_v4_pass62_control_plane",
    symbol: result.token.symbol,
    overallReadiness,
    productTruth: `Velmere Shield is currently a ${terminalMode.replaceAll("_", " ")} for ${result.token.symbol}. ${overallReadiness}% is terminal-readiness for this scan context, not the whole company vision.`,
    gates,
    terminalMode,
    missingProductionBlocks,
    nextSprintStack: [
      { id: "data-live", label: "Live data spine", why: "Without source freshness and labels the UI can look premium but still be uncertain.", owner: "data" },
      { id: "command-actions", label: "Executable SOC commands", why: "The bot should not just explain; it should open evidence, replay, holders and liquidity checks from one palette.", owner: "frontend" },
      { id: "holder-api", label: "Holder-flow API", why: "Whales/CEX/team/unknown must be separated before stronger holder conclusions.", owner: "backend" },
      { id: "vlm-gating", label: "VLM utility gating", why: "Access logic must be product utility with no ROI/yield language.", owner: "product" },
      { id: "legal-pack", label: "RegTech policy pack", why: "Public launch needs Terms, privacy, acceptable use, data-source rules and disclaimers.", owner: "legal" },
    ],
    legalGuardrails: [
      "Not financial advice. Algorithmic risk flag only.",
      "High severity means review priority, not fraud proof or an accusation.",
      "VLM is an access/utility layer only; no ROI, yield, dividend or passive income copy.",
      "Missing data increases uncertainty and must never be hidden as safety.",
    ],
    uxPsychologyRules: [
      "Main page stays clean; deep explanation lives in the modal or shield inspector.",
      "Show uncertainty beside every powerful visual so premium design does not create false confidence.",
      "Use compact command blocks, tabular numbers and visible next steps instead of long hype copy.",
      "Green should mean lower detected risk under current data, not guaranteed safety.",
    ],
    pass60ProductionSpine: [
      { id: "source-ledger", label: "Source ledger visible", status: statusFromScore(sourceAuditScore), why: "Premium UI must separate live, partial and fallback data." },
      { id: "evidence-workflow", label: "Evidence workflow visible", status: statusFromScore(evidenceScore), why: "Reports need missing data, legal notes and review commands before export." },
      { id: "liquidity-intelligence", label: "Liquidity intelligence visible", status: statusFromScore(liquidityScore), why: "Orderbook depth, slippage and pool gaps should be one readable workflow." },
      { id: "vlm-policy", label: "VLM policy gating", status: statusFromScore(vlmScore), why: "Token copy remains utility/access only without ROI language." },
    ],
    pass61OpsSpine: [
      { id: "ops-audit", label: "Product ops audit", status: statusFromScore((sourceAuditScore + evidenceScore) / 2), why: "Operator sessions need source cockpit, timeline, export gates and launch blockers." },
      { id: "audit-history", label: "Audit history", status: statusFromScore(((input.historyCount ?? 0) / 12) * 100), why: "A terminal without replayable timestamps is visually strong but operationally weak." },
      { id: "abuse-controls", label: "Abuse controls", status: "watch", why: "Public endpoints still need rate limits, auth/session logging and acceptable-use policy." },
      { id: "export-governance", label: "Export governance", status: statusFromScore(evidenceScore), why: "Evidence JSON must carry missing data, legal notes and manual-review state." },
    ],
    pass62ControlPlaneSpine: [
      { id: "data-contracts", label: "Data contracts", status: statusFromScore((chartScore + sourceAuditScore) / 2), why: "Each visual needs a source owner, freshness state, fallback rule and production acceptance criteria." },
      { id: "operator-actions", label: "Operator action queue", status: statusFromScore((aiScore + evidenceScore) / 2), why: "Build-to-100 work must be visible as ranked P0/P1/P2 actions, not loose ideas." },
      { id: "release-rails", label: "Release rails", status: statusFromScore((legalScore + vlmScore) / 2), why: "RegTech wording, VLM utility copy, source honesty and export governance are launch rails." },
      { id: "ux-psychology", label: "UX psychology controls", status: "ready", why: "Premium styling should increase trust through clarity, not overconfidence or hype." },
    ],
    generatedAt: new Date().toISOString(),
  };
}
