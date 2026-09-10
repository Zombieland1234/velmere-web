import type { TokenRiskResult } from "./risk-types";
import type { LiquidityOrderBookInput } from "./liquidity-intelligence";
import { buildTerminalRuntimeHealth } from "./terminal-runtime-health";
import { buildTerminalSourceTrust } from "./terminal-source-trust";
import { buildTerminalEvidenceExport } from "./terminal-evidence-export";

export type TerminalOperatorFocusState = "ready" | "review" | "degraded" | "blocked";
export type TerminalOperatorFocusLaneId =
  | "first_paint"
  | "command_routing"
  | "source_confidence"
  | "ai_review"
  | "evidence_path"
  | "launch_blockers";

export type TerminalOperatorFocusLane = {
  id: TerminalOperatorFocusLaneId;
  label: string;
  state: TerminalOperatorFocusState;
  score: number;
  detail: string;
  operatorAction: string;
};

export type TerminalOperatorFocusStep = {
  id: string;
  label: string;
  command: string;
  body: string;
  blockedBy?: string;
};

export type TerminalOperatorFocusConsole = {
  version: "velmere_terminal_operator_focus_v1_pass75";
  symbol: string;
  activeCommand: string;
  focusScore: number;
  state: TerminalOperatorFocusState;
  headline: string;
  lanes: TerminalOperatorFocusLane[];
  playbook: TerminalOperatorFocusStep[];
  visiblePanelPolicy: string[];
  antiLagRules: string[];
  blockedUntil: string[];
  legalNote: string;
  generatedAt: string;
};

export type TerminalOperatorFocusInput = {
  candlesCount?: number;
  chartSource?: string;
  hasOrderBook?: boolean;
  orderbook?: LiquidityOrderBookInput | null;
  historyCount?: number;
  activeCommand?: string;
  terminalBootDeferred?: boolean;
  modalChunkSplit?: boolean;
  heavyPanelsDeferred?: boolean;
  modalErrorBoundary?: boolean;
  sourceCooldownActive?: boolean;
  rateLimitMiddlewareReady?: boolean;
  exportInfrastructureReady?: boolean;
  persistentAuditLogReady?: boolean;
  walletSessionReady?: boolean;
  focusedPanelRouting?: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function laneState(score: number): TerminalOperatorFocusState {
  if (score >= 78) return "ready";
  if (score >= 58) return "review";
  if (score >= 34) return "degraded";
  return "blocked";
}

function stateWeight(state: TerminalOperatorFocusState) {
  if (state === "ready") return 100;
  if (state === "review") return 68;
  if (state === "degraded") return 38;
  return 12;
}

function commandGroup(command: string) {
  if (["risk", "copilot", "review"].includes(command)) return "ai_review";
  if (["data", "sources", "runtime", "usability"].includes(command)) return "source_runtime";
  if (["evidence", "export", "ops"].includes(command)) return "evidence_ops";
  if (["launch", "production", "control", "workspace"].includes(command)) return "release_control";
  if (["holders", "liquidity", "chart"].includes(command)) return "market_layers";
  return "ai_review";
}

export function buildTerminalOperatorFocus(
  result: TokenRiskResult,
  input: TerminalOperatorFocusInput = {},
): TerminalOperatorFocusConsole {
  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const historyCount = input.historyCount ?? 0;
  const chartSource = input.chartSource ?? "unknown chart source";
  const activeCommand = input.activeCommand ?? "risk";
  const hasOrderBook = Boolean(input.hasOrderBook ?? input.orderbook);
  const terminalBootDeferred = input.terminalBootDeferred ?? true;
  const modalChunkSplit = input.modalChunkSplit ?? true;
  const heavyPanelsDeferred = input.heavyPanelsDeferred ?? true;
  const modalErrorBoundary = input.modalErrorBoundary ?? true;
  const focusedPanelRouting = input.focusedPanelRouting ?? true;

  const runtimeHealth = buildTerminalRuntimeHealth(result, {
    candlesCount,
    chartSource,
    hasOrderBook,
    orderbook: input.orderbook ?? null,
    historyCount,
    activeCommand,
    modalErrorBoundary,
    terminalBootDeferred,
    modalChunkSplit,
    heavyPanelsDeferred,
    shieldMapDetached: true,
    tableWheelUnlocked: true,
    suggestionDismissOnOutsideClick: true,
    sourceCooldownActive: Boolean(input.sourceCooldownActive),
    rateLimitMiddlewareReady: Boolean(input.rateLimitMiddlewareReady),
    exportInfrastructureReady: Boolean(input.exportInfrastructureReady),
    persistentAuditLogReady: Boolean(input.persistentAuditLogReady),
    walletSessionReady: Boolean(input.walletSessionReady),
  });
  const sourceTrust = buildTerminalSourceTrust(result, {
    candlesCount,
    chartSource,
    hasOrderBook,
    orderbook: input.orderbook ?? null,
    historyCount,
    activeCommand,
    searchResolverGuarded: true,
    suggestionDismissOnOutsideClick: true,
    sourceCooldownActive: Boolean(input.sourceCooldownActive),
    terminalBootDeferred,
    modalChunkSplit,
    tableWheelUnlocked: true,
    walletSessionReady: Boolean(input.walletSessionReady),
    exportInfrastructureReady: Boolean(input.exportInfrastructureReady),
    rateLimitMiddlewareReady: Boolean(input.rateLimitMiddlewareReady),
  });
  const evidenceExport = buildTerminalEvidenceExport(result, {
    candlesCount,
    chartSource,
    orderbook: input.orderbook ?? null,
    hasOrderBook,
    historyCount,
    activeCommand,
    sessionMode: "operator_session",
    walletSessionReady: Boolean(input.walletSessionReady),
    exportInfrastructureReady: Boolean(input.exportInfrastructureReady),
    rateLimitMiddlewareReady: Boolean(input.rateLimitMiddlewareReady),
    persistentAuditLogReady: Boolean(input.persistentAuditLogReady),
  });

  const firstPaintScore = clamp(
    20 +
      (terminalBootDeferred ? 20 : 0) +
      (modalChunkSplit ? 18 : 0) +
      (heavyPanelsDeferred ? 15 : 0) +
      (modalErrorBoundary ? 17 : 0) +
      Math.min(10, candlesCount),
  );
  const routingScore = clamp(
    28 +
      (focusedPanelRouting ? 34 : 0) +
      (activeCommand ? 12 : 0) +
      (commandGroup(activeCommand) ? 10 : 0) +
      (heavyPanelsDeferred ? 8 : 0),
  );
  const sourceScore = clamp(sourceTrust.trustScore - (input.sourceCooldownActive ? 10 : 0));
  const aiScore = clamp(
    34 +
      Math.round((result.confidence ?? 0.38) * 26) +
      (result.metaModel?.requiredReview ? 8 : 0) +
      (historyCount ? Math.min(12, historyCount * 2) : 0),
  );
  const evidenceScore = clamp(evidenceExport.exportReadinessScore);
  const launchScore = clamp(
    18 +
      (input.rateLimitMiddlewareReady ? 18 : 0) +
      (input.exportInfrastructureReady ? 20 : 0) +
      (input.persistentAuditLogReady ? 20 : 0) +
      (input.walletSessionReady ? 16 : 0) +
      Math.min(8, Math.round(runtimeHealth.runtimeScore / 14)),
  );

  const lanes: TerminalOperatorFocusLane[] = [
    {
      id: "first_paint",
      label: "First paint / lag guard",
      state: laneState(firstPaintScore),
      score: firstPaintScore,
      detail: `boot ${terminalBootDeferred ? "deferred" : "eager"} · chunk ${modalChunkSplit ? "split" : "inline"} · heavy panels ${heavyPanelsDeferred ? "deferred" : "eager"}`,
      operatorAction: "Show chart and command palette first; load heavy panels only after the terminal is usable.",
    },
    {
      id: "command_routing",
      label: "Focused command routing",
      state: laneState(routingScore),
      score: routingScore,
      detail: `/${activeCommand} → ${commandGroup(activeCommand).replaceAll("_", " ")}`,
      operatorAction: "Render only the active command panel in the main lane so the modal feels like an OS, not a wall of cards.",
    },
    {
      id: "source_confidence",
      label: "Source confidence",
      state: laneState(sourceScore),
      score: sourceScore,
      detail: `${sourceTrust.trustScore}/100 source trust · ${chartSource}`,
      operatorAction: "Live, partial, fallback and blocked sources must stay visible before any evidence or AI summary is trusted.",
    },
    {
      id: "ai_review",
      label: "AI review workflow",
      state: laneState(aiScore),
      score: aiScore,
      detail: `${Math.round((result.confidence ?? 0.38) * 100)}% model confidence · score ${result.score}/100`,
      operatorAction: "AI should produce review prompts, missing-data checks and calm SOC next steps, never hype or accusations.",
    },
    {
      id: "evidence_path",
      label: "Evidence path",
      state: laneState(evidenceScore),
      score: evidenceScore,
      detail: `${evidenceExport.state.replaceAll("_", " ")} · ${evidenceExport.exportReadinessScore}/100 readiness`,
      operatorAction: "Keep export as draft/intake until source ledger, missing-data appendix, audit storage and renderer are ready.",
    },
    {
      id: "launch_blockers",
      label: "Launch blockers",
      state: laneState(launchScore),
      score: launchScore,
      detail: `rate limits ${input.rateLimitMiddlewareReady ? "ready" : "blocked"} · audit ${input.persistentAuditLogReady ? "ready" : "blocked"} · VLM ${input.walletSessionReady ? "ready" : "blocked"}`,
      operatorAction: "Do not present the terminal as production-ready until rate limits, audit storage, wallet/session and export infrastructure are connected.",
    },
  ];

  const focusScore = Math.round(
    lanes.reduce((sum, lane) => sum + stateWeight(lane.state), 0) / lanes.length,
  );
  const state = laneState(focusScore);
  const blockedUntil = lanes
    .filter((lane) => lane.state === "blocked" || lane.state === "degraded")
    .map((lane) => `${lane.label}: ${lane.operatorAction}`);

  return {
    version: "velmere_terminal_operator_focus_v1_pass75",
    symbol: result.token.symbol,
    activeCommand,
    focusScore,
    state,
    headline:
      state === "ready"
        ? "Operator focus is clean enough for fast review mode."
        : state === "review"
          ? "Operator focus is usable, but blocked lanes still need visible uncertainty."
          : state === "degraded"
            ? "Operator focus is degraded; keep the case in source/evidence review."
            : "Operator focus is blocked until runtime and launch contracts are fixed.",
    lanes,
    playbook: [
      {
        id: "start-chart",
        label: "Start with chart + source state",
        command: "/chart",
        body: "Confirm candle density, chart source and whether volume/orderbook agrees with the move.",
      },
      {
        id: "review-ai",
        label: "Ask AI for a calm SOC read",
        command: "/review",
        body: "Summarize anomalies, uncertainty and missing data without calling the token a scam or promising outcomes.",
      },
      {
        id: "audit-sources",
        label: "Audit blocked data lanes",
        command: "/sources",
        body: "Check whether holders, depth, replay and contract controls are live, partial, fallback or blocked.",
      },
      {
        id: "draft-evidence",
        label: "Draft evidence only when safe",
        command: "/export",
        body: "Attach source ledger, missing-data appendix, command path and legal note before any case export.",
        blockedBy: input.exportInfrastructureReady ? undefined : "PDF/JSON renderer and persistent audit log are not wired yet.",
      },
    ],
    visiblePanelPolicy: [
      "One active command panel is rendered in the main lane; inactive consoles stay available in the command palette but do not clutter first paint.",
      "Heavy AI/SOC/evidence/holder/VLM panels remain deferred until terminalBooted is true.",
      "Header shortcuts change the active command instead of opening raw API JSON endpoints.",
      "Safe-mode boundary catches render errors without crashing the market table.",
    ],
    antiLagRules: [
      "Do not fetch orderbook/history before the chart and command palette are painted.",
      "Do not render every console at once after the chart; route by active command.",
      "Keep table wheel scroll unlocked and Shield Map as a separate page.",
      "Use local-first search and 429 cooldown instead of hammering external APIs.",
    ],
    blockedUntil,
    legalNote: "Not financial advice. Algorithmic risk flag only. Operator focus is a product workflow signal, not legal proof or an accusation.",
    generatedAt: new Date().toISOString(),
  };
}
