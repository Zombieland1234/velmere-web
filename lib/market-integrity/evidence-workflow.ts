import type { TokenRiskResult } from "./risk-types";
import { buildHolderIntelligence } from "./holder-intelligence";
import { buildLiquidityIntelligence, type LiquidityOrderBookInput } from "./liquidity-intelligence";

export type EvidenceWorkflowStatus = "intake" | "review_ready" | "blocked_for_data";
export type EvidenceWorkflowStepStatus = "ready" | "watch" | "blocked";

export type EvidenceWorkflowStep = {
  id: string;
  label: string;
  status: EvidenceWorkflowStepStatus;
  evidence: string;
  nextAction: string;
};

export type EvidenceWorkflowBrief = {
  version: "velmere_evidence_workflow_v3_pass62_control_plane";
  caseId: string;
  symbol: string;
  status: EvidenceWorkflowStatus;
  evidenceGrade: number;
  summary: string;
  sourceLedger: Array<{ id: string; label: string; quality: EvidenceWorkflowStepStatus; detail: string }>;
  steps: EvidenceWorkflowStep[];
  missingData: string[];
  analystCommands: string[];
  exportChecklist: string[];
  caseTimeline: Array<{ id: string; label: string; status: EvidenceWorkflowStepStatus; detail: string }>;
  operatorHandoff: Array<{ label: string; command: string; guardrail: string }>;
  legalGuardrails: string[];
  generatedAt: string;
};

export type EvidenceWorkflowInput = {
  historyCount?: number;
  candlesCount?: number;
  chartSource?: string;
  orderbook?: LiquidityOrderBookInput | null;
  activeCommand?: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function statusFromScore(score: number): EvidenceWorkflowStepStatus {
  if (score >= 72) return "ready";
  if (score >= 42) return "watch";
  return "blocked";
}

function caseIdFor(result: TokenRiskResult) {
  const raw = `${result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol}-${result.generatedAt}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return `VLM-SHIELD-${result.token.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "")}-${hash.toString(16).toUpperCase().padStart(8, "0")}`;
}

export function buildEvidenceWorkflow(
  result: TokenRiskResult,
  input: EvidenceWorkflowInput = {},
): EvidenceWorkflowBrief {
  const holder = buildHolderIntelligence(result);
  const liquidity = buildLiquidityIntelligence(result, input.orderbook);
  const confidencePercent = Math.round((result.confidence ?? 0.35) * 100);
  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const historyCount = input.historyCount ?? 0;
  const chartSource = input.chartSource ?? "unknown chart source";

  const sourceLedger = [
    {
      id: "market-data",
      label: "Market data",
      quality: result.dataQuality === "live" ? "ready" as const : result.dataQuality === "partial" ? "watch" as const : "blocked" as const,
      detail: `${result.dataQuality} · ${result.dataSources.length} source(s)`,
    },
    {
      id: "candles",
      label: "Candles",
      quality: statusFromScore((candlesCount / 160) * 100),
      detail: `${candlesCount} bars · ${chartSource}`,
    },
    {
      id: "holders",
      label: "Holder graph",
      quality: statusFromScore(holder.dataCompleteness),
      detail: `${holder.dataCompleteness}% complete · ${holder.dataUncertaintyPercent}% uncertainty`,
    },
    {
      id: "liquidity",
      label: "Liquidity depth",
      quality: statusFromScore(100 - liquidity.uncertaintyPercent),
      detail: `${liquidity.sourceMode.replaceAll("_", " ")} · uncertainty ${liquidity.uncertaintyPercent}%`,
    },
    {
      id: "history",
      label: "Replay history",
      quality: statusFromScore((historyCount / 18) * 100),
      detail: `${historyCount} snapshot(s)`,
    },
  ];

  const dataScore = sourceLedger.reduce((sum, item) => {
    if (item.quality === "ready") return sum + 20;
    if (item.quality === "watch") return sum + 11;
    return sum + 3;
  }, 0);
  const evidenceGrade = Math.round(clamp(dataScore * 0.72 + confidencePercent * 0.28 + Math.min(12, result.signals.length * 1.5)));
  const status: EvidenceWorkflowStatus = evidenceGrade >= 72
    ? "review_ready"
    : evidenceGrade >= 42
      ? "intake"
      : "blocked_for_data";

  const steps: EvidenceWorkflowStep[] = [
    {
      id: "triage",
      label: "Triage signal",
      status: statusFromScore(result.score),
      evidence: `${result.score}/100 · ${result.signals.length} risk signal(s) · confidence ${confidencePercent}%`,
      nextAction: "Summarize dominant anomaly without accusation or price advice.",
    },
    {
      id: "source-quality",
      label: "Source quality check",
      status: sourceLedger.some((item) => item.quality === "blocked") ? "watch" : "ready",
      evidence: sourceLedger.map((item) => `${item.label}: ${item.detail}`).join(" | "),
      nextAction: "Mark every missing source as uncertainty before exporting the case file.",
    },
    {
      id: "holder-review",
      label: "Holder review",
      status: statusFromScore(holder.dataCompleteness),
      evidence: `${holder.dataCompleteness}% complete · ${holder.clusterMap.length} cluster bucket(s)`,
      nextAction: "Separate CEX/custody/team/unknown before escalating holder concentration.",
    },
    {
      id: "liquidity-review",
      label: "Liquidity review",
      status: statusFromScore(100 - liquidity.liquidityScore),
      evidence: `${liquidity.reviewPriority} · score ${liquidity.liquidityScore}/100 · ${liquidity.sourceMode}`,
      nextAction: "Compare heatmap, slippage and pool events; do not infer intent from thin depth.",
    },
    {
      id: "export-readiness",
      label: "Evidence export readiness",
      status: statusFromScore(evidenceGrade),
      evidence: `${evidenceGrade}/100 evidence grade · active command ${input.activeCommand ?? "risk"}`,
      nextAction: status === "review_ready" ? "Export evidence JSON with legal note." : "Keep case in intake until missing data is resolved.",
    },
  ];

  const missingData = [
    result.dataQuality !== "live" ? "live market data with source freshness metadata" : null,
    candlesCount < 120 ? "dense candles for selected terminal interval" : null,
    historyCount < 12 ? "persistent replay snapshots" : null,
    holder.dataCompleteness < 70 ? "on-chain holder API and wallet labels" : null,
    ...liquidity.missingData,
  ].filter((item): item is string => Boolean(item));

  return {
    version: "velmere_evidence_workflow_v3_pass62_control_plane",
    caseId: caseIdFor(result),
    symbol: result.token.symbol,
    status,
    evidenceGrade,
    summary: `Evidence workflow for ${result.token.symbol} is ${status.replaceAll("_", " ")} with grade ${evidenceGrade}/100. This is an analyst-review state, not proof and not financial advice.`,
    sourceLedger,
    steps,
    missingData: Array.from(new Set(missingData)).slice(0, 10),
    analystCommands: [
      "/case.open evidence",
      "/source.audit candles orderbook holders",
      "/holder.review clusters unknown cex team",
      "/liquidity.review slippage depth spread",
      "/case.export json legal-note",
    ],
    exportChecklist: [
      "Risk score and confidence included",
      "Source quality and missing data included",
      "Holder uncertainty included",
      "Liquidity source mode included",
      "Case timeline and active command included",
      "Legal note included: Not financial advice. Algorithmic risk flag only.",
    ],
    caseTimeline: [
      { id: "intake", label: "Intake", status: "ready", detail: `${result.token.symbol} scan generated at ${result.generatedAt}` },
      { id: "sources", label: "Source audit", status: sourceLedger.some((item) => item.quality === "blocked") ? "watch" : "ready", detail: `${sourceLedger.length} source lane(s) checked before export.` },
      { id: "operator-command", label: "Operator command", status: "watch", detail: `Active command path: ${input.activeCommand ?? "risk"}` },
      { id: "export-gate", label: "Export gate", status: statusFromScore(evidenceGrade), detail: status === "review_ready" ? "Draft export allowed with legal note." : "Keep in intake until missing data is listed." },
    ],
    operatorHandoff: [
      { label: "Open source audit", command: "/source.audit", guardrail: "Show live/partial/fallback state before any visual conclusion." },
      { label: "Attach case timeline", command: "/case.timeline", guardrail: "Timeline is review context, not legal proof." },
      { label: "Draft export", command: "/case.export", guardrail: "Include uncertainty and missing data in the export body." },
      { label: "Escalate manual review", command: "/review.manual", guardrail: "No accusation or investment advice language." },
    ],
    legalGuardrails: [
      "Evidence report is algorithmic triage only, not legal proof.",
      "Use anomaly/review language; avoid scam/fraud/proven manipulation wording.",
      "No buy/sell/hold, ROI, yield or passive income language.",
      "Manual review is required before external enforcement, moderation or public claims.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
