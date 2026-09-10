import type { TokenRiskResult } from "./risk-types";
import { buildEvidenceWorkflow, type EvidenceWorkflowInput } from "./evidence-workflow";
import { buildHolderIntelligence } from "./holder-intelligence";
import { buildLiquidityIntelligence, type LiquidityOrderBookInput } from "./liquidity-intelligence";
import { buildProductOpsAudit } from "./product-ops-audit";
import type { TerminalReadinessInput } from "./terminal-readiness";
import { buildVlmShieldAccess } from "./vlm-access-layer";

export type TerminalControlPlaneStatus = "ready" | "watch" | "blocked";
export type TerminalControlPlaneLane = "data" | "analysis" | "evidence" | "access" | "legal" | "ops";

export type TerminalControlPlaneContract = {
  id: string;
  label: string;
  lane: TerminalControlPlaneLane;
  status: TerminalControlPlaneStatus;
  readiness: number;
  currentState: string;
  productionNeed: string;
  fallbackRule: string;
  operatorCommand: string;
};

export type TerminalControlPlaneAction = {
  id: string;
  label: string;
  lane: TerminalControlPlaneLane;
  priority: "p0" | "p1" | "p2" | "p3";
  status: TerminalControlPlaneStatus;
  why: string;
  acceptanceCriteria: string[];
  safeCopy: string;
};

export type TerminalControlPlaneBrief = {
  version: "velmere_terminal_control_plane_v1_pass62";
  symbol: string;
  controlScore: number;
  mode: "demo_control" | "operator_control" | "production_track";
  headline: string;
  contracts: TerminalControlPlaneContract[];
  actionQueue: TerminalControlPlaneAction[];
  releaseRails: Array<{ id: string; label: string; status: TerminalControlPlaneStatus; detail: string }>;
  uxPsychologyChecks: string[];
  dataTruth: string;
  legalGuardrails: string[];
  generatedAt: string;
};

export type TerminalControlPlaneInput = EvidenceWorkflowInput & TerminalReadinessInput & {
  orderbook?: LiquidityOrderBookInput | null;
  activeCommand?: string;
  sessionMode?: "public_preview" | "operator_session" | "member_session";
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function statusFromScore(score: number): TerminalControlPlaneStatus {
  if (score >= 74) return "ready";
  if (score >= 42) return "watch";
  return "blocked";
}

function priorityFromStatus(status: TerminalControlPlaneStatus, index: number): "p0" | "p1" | "p2" | "p3" {
  if (status === "blocked") return index <= 2 ? "p0" : "p1";
  if (status === "watch") return index <= 3 ? "p1" : "p2";
  return "p3";
}

function sourceMode(result: TokenRiskResult) {
  if (result.dataQuality === "live") return "live source mode";
  if (result.dataQuality === "partial") return "partial source mode";
  return "demo/fallback source mode";
}

function contract(
  id: string,
  label: string,
  lane: TerminalControlPlaneLane,
  readiness: number,
  currentState: string,
  productionNeed: string,
  fallbackRule: string,
  operatorCommand: string,
): TerminalControlPlaneContract {
  const score = Math.round(clamp(readiness));
  return {
    id,
    label,
    lane,
    status: statusFromScore(score),
    readiness: score,
    currentState,
    productionNeed,
    fallbackRule,
    operatorCommand,
  };
}

export function buildTerminalControlPlane(
  result: TokenRiskResult,
  input: TerminalControlPlaneInput = {},
): TerminalControlPlaneBrief {
  const holder = buildHolderIntelligence(result);
  const liquidity = buildLiquidityIntelligence(result, input.orderbook);
  const evidence = buildEvidenceWorkflow(result, input);
  const access = buildVlmShieldAccess(result);
  const opsAudit = buildProductOpsAudit(result, input);

  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const historyCount = input.historyCount ?? 0;
  const liveScore = result.dataQuality === "live" ? 82 : result.dataQuality === "partial" ? 56 : 28;
  const candleScore = clamp((candlesCount / 180) * 72 + (input.chartSource?.toLowerCase().includes("binance") ? 16 : 0));
  const holderScore = clamp(holder.dataCompleteness * 0.72 + (holder.dataUncertaintyPercent < 35 ? 12 : holder.dataUncertaintyPercent < 60 ? 4 : -8));
  const liquidityScore = clamp(100 - liquidity.liquidityScore - (liquidity.uncertaintyPercent > 55 ? 12 : 0));
  const evidenceScore = clamp(evidence.evidenceGrade + (historyCount >= 12 ? 8 : 0) - (evidence.missingData.length > 4 ? 10 : 0));
  const accessScore = clamp(access.launchChecklist.filter((item) => item.status === "ready").length * 13 + access.pass60PolicySpine.filter((item) => item.status !== "blocked").length * 8 + 18);
  const opsScore = clamp(opsAudit.opsScore + (input.activeCommand ? 3 : 0));

  const contracts: TerminalControlPlaneContract[] = [
    contract(
      "source-truth",
      "Source truth ledger",
      "data",
      liveScore,
      `${sourceMode(result)} · ${result.dataSources.length} source(s)`,
      "Every visual must carry live/partial/fallback state, freshness timestamp and source owner.",
      "If freshness is unknown, display manual-review mode and keep uncertainty visible.",
      "/source.truth verify freshness owners",
    ),
    contract(
      "candles-terminal",
      "Candles / VWAP / volume contract",
      "data",
      candleScore,
      `${candlesCount} bar(s) · ${input.chartSource ?? "fallback chart source"}`,
      "Dense klines for 1m/15m/1h/4h/1d/7d with price scale, OHLCV tooltip, VWAP and volume profile.",
      "Use sparkline fallback only with visible label; never present it as exchange-grade candles.",
      "/chart.contract compare intervals",
    ),
    contract(
      "holder-labels",
      "Holder labels and cluster contract",
      "analysis",
      holderScore,
      `${holder.dataCompleteness}% complete · ${holder.dataUncertaintyPercent}% uncertainty`,
      "Real on-chain holder API, CEX/custody registry, team/treasury labels, DEX/LP labels and unknown bucket rules.",
      "Unknown wallets stay unknown; missing labels cannot be interpreted as safety.",
      "/holders.contract request labels clusters",
    ),
    contract(
      "liquidity-depth",
      "Liquidity depth and execution contract",
      "analysis",
      liquidityScore,
      `${liquidity.sourceMode} · ${liquidity.uncertaintyPercent}% uncertainty`,
      "Multi-exchange orderbook snapshots, DEX pool depth, slippage ladders, LP add/remove events and stale-book detection.",
      "If live depth is missing, show market-metrics mode and block strong execution conclusions.",
      "/liquidity.contract depth slippage lp-events",
    ),
    contract(
      "evidence-export",
      "Evidence export contract",
      "evidence",
      evidenceScore,
      `${evidence.evidenceGrade}/100 grade · ${evidence.status.replaceAll("_", " ")}`,
      "Export JSON/PDF with timestamps, source ledger, missing data, command path, legal note and manual-review state.",
      "Draft exports can exist, but public/legal handoff requires missing data section.",
      "/case.export contract legal-note",
    ),
    contract(
      "vlm-access",
      "VLM utility access contract",
      "access",
      accessScore,
      `${access.recommendedTier} · utility/access only`,
      "Wallet/session proof, member limits, usage metering, audit logs, ToS, privacy and utility-token disclaimer.",
      "Show access preview only; never imply token value, ROI, yield or passive income.",
      "/vlm.contract wallet session limits",
    ),
    contract(
      "operator-ops",
      "Operator workflow contract",
      "ops",
      opsScore,
      `${opsAudit.mode.replaceAll("_", " ")} · ${opsAudit.opsScore}/100 ops score`,
      "Command execution history, case timeline, export gate, action owners, abuse controls and launch blockers.",
      "Operator preview may guide actions, but production needs persistent logs and rate limits.",
      "/ops.contract action-queue audit-log",
    ),
  ];

  const actionQueue = contracts
    .map<TerminalControlPlaneAction>((item, index) => ({
      id: `pass62-${item.id}`,
      label: item.status === "ready" ? `Keep ${item.label.toLowerCase()} stable` : `Harden ${item.label.toLowerCase()}`,
      lane: item.lane,
      priority: priorityFromStatus(item.status, index),
      status: item.status,
      why: item.status === "ready"
        ? `${item.label} is usable for analyst preview, but still needs regression checks.`
        : `${item.label} is the next blocker for a trustworthy production terminal.` ,
      acceptanceCriteria: [
        item.productionNeed,
        item.fallbackRule,
        `UI exposes operator command ${item.operatorCommand} without hype or accusation language.`,
      ],
      safeCopy: "Not financial advice. Algorithmic risk flag only. Requires manual review when source quality is incomplete.",
    }))
    .sort((a, b) => {
      const order = { p0: 0, p1: 1, p2: 2, p3: 3 };
      return order[a.priority] - order[b.priority];
    });

  const controlScore = Math.round(clamp(
    contracts.reduce((sum, item) => sum + item.readiness, 0) / Math.max(1, contracts.length),
  ));
  const mode = controlScore >= 78 ? "production_track" : controlScore >= 48 ? "operator_control" : "demo_control";

  return {
    version: "velmere_terminal_control_plane_v1_pass62",
    symbol: result.token.symbol,
    controlScore,
    mode,
    headline: `PASS62 control plane: ${result.token.symbol} is in ${mode.replaceAll("_", " ")} at ${controlScore}/100. This is product/control readiness, not investment quality.`,
    contracts,
    actionQueue: actionQueue.slice(0, 9),
    releaseRails: [
      { id: "copy-rail", label: "RegTech wording rail", status: "ready", detail: "Use anomaly, review priority, uncertainty and algorithmic flag language only." },
      { id: "data-rail", label: "Source honesty rail", status: statusFromScore((liveScore + candleScore) / 2), detail: "Live/partial/fallback must be visible near chart, holders, liquidity and exports." },
      { id: "export-rail", label: "Evidence handoff rail", status: statusFromScore(evidenceScore), detail: "Exports must include source ledger, missing data and legal note." },
      { id: "access-rail", label: "VLM utility rail", status: statusFromScore(accessScore), detail: "Access/membership language only; wallet/session proof before real gating." },
      { id: "abuse-rail", label: "Abuse and rate-limit rail", status: historyCount >= 12 ? "watch" : "blocked", detail: "Production endpoints need rate limits, command logs and acceptable-use controls." },
    ],
    uxPsychologyChecks: [
      "Premium dark UI must slow the operator down at high uncertainty, not push fast decisions.",
      "Gold highlights should mark workflow focus, not guaranteed opportunity or token quality.",
      "Large scores must be paired with source quality, missing data and manual-review copy.",
      "Unknown holder and liquidity buckets must stay visually separate from low-risk buckets.",
      "Main page stays clean; deep controls live inside the terminal modal.",
    ],
    dataTruth: `Current scan uses ${sourceMode(result)}. ${liquidity.sourceTruth} Holder uncertainty is ${holder.dataUncertaintyPercent}%.`,
    legalGuardrails: [
      "Not financial advice. Algorithmic risk flag only.",
      "Terminal output is not legal proof and must not accuse a token, team or wallet.",
      "VLM remains utility/access only: no ROI, yield, dividend, price appreciation or passive income copy.",
      "Manual review is required before public claims, enforcement, moderation or external escalation.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
