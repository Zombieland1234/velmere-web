import type { TokenRiskResult } from "./risk-types";
import type { LiquidityOrderBookInput } from "./liquidity-intelligence";
import { buildTerminalSourceTrust } from "./terminal-source-trust";
import { buildTerminalEvidenceExport } from "./terminal-evidence-export";
import { buildTerminalInteractionStability } from "./terminal-interaction-stability";

export type TerminalReviewDeckState = "ready" | "review" | "degraded" | "blocked";
export type TerminalReviewDeckLaneId =
  | "operator_brief"
  | "source_truth"
  | "ai_review"
  | "evidence_gate"
  | "interaction_path"
  | "launch_blockers";

export type TerminalReviewDeckLane = {
  id: TerminalReviewDeckLaneId;
  label: string;
  state: TerminalReviewDeckState;
  score: number;
  signal: string;
  operatorAction: string;
};

export type TerminalReviewDeckAction = {
  id: string;
  priority: "P0" | "P1" | "P2" | "P3";
  label: string;
  command: string;
  body: string;
};

export type TerminalReviewDeckConsole = {
  version: "velmere_terminal_review_deck_v1_pass77";
  symbol: string;
  activeCommand: string;
  deckScore: number;
  state: TerminalReviewDeckState;
  headline: string;
  executiveBrief: string;
  visibleNow: string[];
  hiddenUntilRequested: string[];
  lanes: TerminalReviewDeckLane[];
  nextBestActions: TerminalReviewDeckAction[];
  compressionRules: string[];
  blockerSummary: string[];
  safeCopy: string[];
  legalNote: string;
  generatedAt: string;
};

export type TerminalReviewDeckInput = {
  candlesCount?: number;
  historyCount?: number;
  chartSource?: string;
  hasOrderBook?: boolean;
  orderbook?: LiquidityOrderBookInput | null;
  activeCommand?: string;
  terminalBootDeferred?: boolean;
  modalChunkSplit?: boolean;
  heavyPanelsDeferred?: boolean;
  sourceCooldownActive?: boolean;
  searchLocalFirst?: boolean;
  suggestionDismissOnOutsideClick?: boolean;
  tableWheelUnlocked?: boolean;
  shieldMapDetached?: boolean;
  focusedPanelRouting?: boolean;
  rateLimitMiddlewareReady?: boolean;
  exportInfrastructureReady?: boolean;
  persistentAuditLogReady?: boolean;
  walletSessionReady?: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function stateFor(score: number): TerminalReviewDeckState {
  if (score >= 80) return "ready";
  if (score >= 60) return "review";
  if (score >= 38) return "degraded";
  return "blocked";
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function commandRoute(command: string) {
  if (["deck", "risk", "review", "copilot"].includes(command)) return "operator brief";
  if (["sources", "data", "runtime", "stability", "usability"].includes(command)) return "source/runtime";
  if (["evidence", "export", "ops"].includes(command)) return "evidence/export";
  if (["launch", "production", "control", "workspace"].includes(command)) return "release control";
  if (["chart", "holders", "liquidity"].includes(command)) return "market layer";
  return "operator brief";
}

function actionPriority(state: TerminalReviewDeckState): TerminalReviewDeckAction["priority"] {
  if (state === "blocked") return "P0";
  if (state === "degraded") return "P1";
  if (state === "review") return "P2";
  return "P3";
}

export function buildTerminalReviewDeck(
  result: TokenRiskResult,
  input: TerminalReviewDeckInput = {},
): TerminalReviewDeckConsole {
  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const historyCount = input.historyCount ?? 0;
  const chartSource = input.chartSource ?? (result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics");
  const activeCommand = input.activeCommand ?? "deck";
  const hasOrderBook = Boolean(input.hasOrderBook ?? input.orderbook);
  const terminalBootDeferred = input.terminalBootDeferred ?? true;
  const modalChunkSplit = input.modalChunkSplit ?? true;
  const heavyPanelsDeferred = input.heavyPanelsDeferred ?? true;
  const focusedPanelRouting = input.focusedPanelRouting ?? true;

  const sourceTrust = buildTerminalSourceTrust(result, {
    candlesCount,
    chartSource,
    hasOrderBook,
    orderbook: input.orderbook ?? null,
    historyCount,
    activeCommand,
    searchResolverGuarded: input.searchLocalFirst ?? true,
    suggestionDismissOnOutsideClick: input.suggestionDismissOnOutsideClick ?? true,
    sourceCooldownActive: Boolean(input.sourceCooldownActive),
    terminalBootDeferred,
    modalChunkSplit,
    tableWheelUnlocked: input.tableWheelUnlocked ?? true,
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

  const interaction = buildTerminalInteractionStability(result, {
    candlesCount,
    historyCount,
    chartSource,
    hasOrderBook,
    activeCommand,
    terminalBootDeferred,
    modalChunkSplit,
    heavyPanelsDeferred,
    modalErrorBoundary: true,
    focusedPanelRouting,
    sourceCooldownActive: Boolean(input.sourceCooldownActive),
    searchLocalFirst: input.searchLocalFirst ?? true,
    suggestionDismissOnOutsideClick: input.suggestionDismissOnOutsideClick ?? true,
    shieldMapDetached: input.shieldMapDetached ?? true,
    tableWheelUnlocked: input.tableWheelUnlocked ?? true,
    stressScenarioHelpers: true,
    noRawJsonButtons: true,
  });

  const operatorBriefScore = clamp(
    30 +
      Math.round((result.confidence ?? 0.35) * 24) +
      (focusedPanelRouting ? 16 : 0) +
      (result.metaModel?.requiredReview ? 8 : 0) +
      Math.min(12, result.signals.length * 3),
  );
  const sourceScore = clamp(sourceTrust.trustScore);
  const aiScore = clamp(
    36 +
      Math.round((result.confidence ?? 0.35) * 24) +
      (historyCount ? Math.min(12, historyCount * 2) : 0) +
      (result.aiSummary ? 8 : 0) +
      (result.metaModel ? 8 : 0),
  );
  const evidenceScore = clamp(evidenceExport.exportReadinessScore);
  const interactionScore = clamp(interaction.stabilityScore);
  const launchScore = clamp(
    18 +
      (input.rateLimitMiddlewareReady ? 18 : 0) +
      (input.exportInfrastructureReady ? 20 : 0) +
      (input.persistentAuditLogReady ? 20 : 0) +
      (input.walletSessionReady ? 16 : 0) +
      (heavyPanelsDeferred ? 6 : 0),
  );

  const lanes: TerminalReviewDeckLane[] = [
    {
      id: "operator_brief",
      label: "Operator brief",
      state: stateFor(operatorBriefScore),
      score: operatorBriefScore,
      signal: `/${activeCommand} → ${commandRoute(activeCommand)} · risk ${result.score}/100`,
      operatorAction: "Start from the concise review deck, then drill into only the lane that is blocking confidence.",
    },
    {
      id: "source_truth",
      label: "Source truth",
      state: stateFor(sourceScore),
      score: sourceScore,
      signal: `${sourceTrust.trustScore}/100 · ${chartSource}`,
      operatorAction: "Keep live, partial, fallback and blocked source modes visible before any AI wording sounds confident.",
    },
    {
      id: "ai_review",
      label: "AI review",
      state: stateFor(aiScore),
      score: aiScore,
      signal: `${Math.round((result.confidence ?? 0.35) * 100)}% confidence · ${result.signals.length} signals`,
      operatorAction: "Use the AI bot for questions, missing-data checks and SOC commands; do not let it accuse or hype.",
    },
    {
      id: "evidence_gate",
      label: "Evidence gate",
      state: stateFor(evidenceScore),
      score: evidenceScore,
      signal: `${evidenceExport.state.replaceAll("_", " ")} · ${evidenceExport.exportReadinessScore}/100`,
      operatorAction: "Export only as a guarded draft until source ledger, missing-data appendix, audit storage and renderer are ready.",
    },
    {
      id: "interaction_path",
      label: "Interaction path",
      state: stateFor(interactionScore),
      score: interactionScore,
      signal: `${interaction.state} · ${interaction.stabilityScore}/100`,
      operatorAction: "Keep chart-first boot, one visible command panel, outside-click search dismiss and unlocked table scroll.",
    },
    {
      id: "launch_blockers",
      label: "Launch blockers",
      state: stateFor(launchScore),
      score: launchScore,
      signal: `rate limits ${input.rateLimitMiddlewareReady ? "ready" : "blocked"} · audit ${input.persistentAuditLogReady ? "ready" : "blocked"} · VLM ${input.walletSessionReady ? "ready" : "blocked"}`,
      operatorAction: "Keep public launch blocked until rate-limit middleware, audit storage, wallet/session access and export infrastructure exist.",
    },
  ];

  const deckScore = average(lanes.map((lane) => lane.score));
  const state = stateFor(deckScore);
  const blockerSummary = lanes
    .filter((lane) => lane.state === "blocked" || lane.state === "degraded")
    .map((lane) => `${lane.label}: ${lane.operatorAction}`);

  const nextBestActions: TerminalReviewDeckAction[] = lanes
    .filter((lane) => lane.state !== "ready")
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)
    .map((lane) => ({
      id: lane.id,
      priority: actionPriority(lane.state),
      label: lane.label,
      command:
        lane.id === "source_truth"
          ? "/sources"
          : lane.id === "evidence_gate"
            ? "/export"
            : lane.id === "interaction_path"
              ? "/stability"
              : lane.id === "launch_blockers"
                ? "/launch"
                : lane.id === "ai_review"
                  ? "/copilot"
                  : "/review",
      body: lane.operatorAction,
    }));

  if (!nextBestActions.length) {
    nextBestActions.push({
      id: "continue_review",
      priority: "P3",
      label: "Continue manual review",
      command: "/review",
      body: "No blocked deck lane is visible, but the terminal still treats outputs as review signals rather than proof.",
    });
  }

  return {
    version: "velmere_terminal_review_deck_v1_pass77",
    symbol: result.token.symbol,
    activeCommand,
    deckScore,
    state,
    headline:
      state === "ready"
        ? "Review deck is ready for operator beta workflow."
        : state === "review"
          ? "Review deck is usable, but blocked source/export/launch lanes must remain visible."
          : state === "degraded"
            ? "Review deck can support intake only; do not present this case as production-grade."
            : "Review deck is blocked until source, runtime or launch lanes are repaired.",
    executiveBrief: `PASS77 compresses the terminal into a first-screen review deck: one operator brief, visible source truth, AI review boundaries, evidence gate, interaction path and launch blockers for ${result.token.symbol}.`,
    visibleNow: [
      "Token identity, score, range, chart source and command palette",
      "Review deck summary with source/evidence/runtime blockers",
      "One active drill-down console selected by the operator",
    ],
    hiddenUntilRequested: [
      "Deep holder clusters, stress simulator and full replay timeline",
      "Ops/control/workspace/production consoles not selected by command",
      "Private scoring weights, internal prompts and proprietary thresholds",
    ],
    lanes,
    nextBestActions,
    compressionRules: [
      "Default terminal view opens on /deck so the user sees a concise decision surface before deep panels.",
      "Only one command console should own the main lane; inactive consoles stay behind the palette.",
      "Heavy modules load only after terminalBooted and only when their command is selected.",
      "Shield Map explains workflow and boundaries on its own page; the main tarcza stays compact.",
      "Premium visuals must not raise certainty when orderbook, holder API or export infrastructure is blocked.",
    ],
    blockerSummary,
    safeCopy: [
      "Anomaly signal, not accusation.",
      "Manual review required when sources are partial, fallback or blocked.",
      "Not financial advice. Algorithmic risk flag only.",
      "VLM remains a utility/access layer, not an investment product.",
    ],
    legalNote: "Not financial advice. Algorithmic risk flag only. This deck is an operator workflow summary, not legal proof and not an accusation.",
    generatedAt: new Date().toISOString(),
  };
}
