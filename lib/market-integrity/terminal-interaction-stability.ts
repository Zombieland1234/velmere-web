import type { TokenRiskResult } from "./risk-types";

export type TerminalInteractionStabilityState = "ready" | "watch" | "degraded" | "blocked";
export type TerminalInteractionLaneId =
  | "click_intake"
  | "modal_boot"
  | "active_panel"
  | "source_cooldown"
  | "shield_map_route"
  | "scroll_surface"
  | "regression_locks";

export type TerminalInteractionLane = {
  id: TerminalInteractionLaneId;
  label: string;
  state: TerminalInteractionStabilityState;
  score: number;
  signal: string;
  operatorAction: string;
};

export type TerminalInteractionFlowStep = {
  id: string;
  label: string;
  expected: string;
  blockedIf: string;
};

export type TerminalInteractionStabilityConsole = {
  version: "velmere_terminal_interaction_stability_v1_pass76";
  symbol: string;
  stabilityScore: number;
  state: TerminalInteractionStabilityState;
  headline: string;
  lanes: TerminalInteractionLane[];
  clickFlow: TerminalInteractionFlowStep[];
  lagBudget: string[];
  regressionLocks: string[];
  safeCopy: string[];
  legalNote: string;
  generatedAt: string;
};

export type TerminalInteractionStabilityInput = {
  activeCommand?: string;
  candlesCount?: number;
  historyCount?: number;
  chartSource?: string;
  hasOrderBook?: boolean;
  terminalBootDeferred?: boolean;
  modalChunkSplit?: boolean;
  heavyPanelsDeferred?: boolean;
  modalErrorBoundary?: boolean;
  focusedPanelRouting?: boolean;
  sourceCooldownActive?: boolean;
  searchLocalFirst?: boolean;
  suggestionDismissOnOutsideClick?: boolean;
  shieldMapDetached?: boolean;
  tableWheelUnlocked?: boolean;
  stressScenarioHelpers?: boolean;
  noRawJsonButtons?: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function stateFor(score: number): TerminalInteractionStabilityState {
  if (score >= 80) return "ready";
  if (score >= 60) return "watch";
  if (score >= 36) return "degraded";
  return "blocked";
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function buildTerminalInteractionStability(
  result: TokenRiskResult,
  input: TerminalInteractionStabilityInput = {},
): TerminalInteractionStabilityConsole {
  const activeCommand = input.activeCommand ?? "risk";
  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const historyCount = input.historyCount ?? 0;
  const chartSource = input.chartSource ?? (result.chart?.sevenDay?.length ? "result.chart.sevenDay" : "market metrics");
  const hasOrderBook = Boolean(input.hasOrderBook);
  const terminalBootDeferred = input.terminalBootDeferred ?? true;
  const modalChunkSplit = input.modalChunkSplit ?? true;
  const heavyPanelsDeferred = input.heavyPanelsDeferred ?? true;
  const modalErrorBoundary = input.modalErrorBoundary ?? true;
  const focusedPanelRouting = input.focusedPanelRouting ?? true;
  const searchLocalFirst = input.searchLocalFirst ?? true;
  const suggestionDismissOnOutsideClick = input.suggestionDismissOnOutsideClick ?? true;
  const shieldMapDetached = input.shieldMapDetached ?? true;
  const tableWheelUnlocked = input.tableWheelUnlocked ?? true;
  const stressScenarioHelpers = input.stressScenarioHelpers ?? true;
  const noRawJsonButtons = input.noRawJsonButtons ?? true;
  const sourceCooldownActive = Boolean(input.sourceCooldownActive);

  const clickIntakeScore = clamp(
    24 +
      (searchLocalFirst ? 18 : 0) +
      (suggestionDismissOnOutsideClick ? 14 : 0) +
      (noRawJsonButtons ? 18 : 0) +
      (sourceCooldownActive ? 4 : 12) +
      Math.min(14, Math.round((result.confidence ?? 0.35) * 18)),
  );
  const modalBootScore = clamp(
    18 +
      (modalErrorBoundary ? 18 : 0) +
      (terminalBootDeferred ? 18 : 0) +
      (modalChunkSplit ? 16 : 0) +
      (heavyPanelsDeferred ? 16 : 0) +
      Math.min(14, candlesCount),
  );
  const activePanelScore = clamp(
    22 +
      (focusedPanelRouting ? 34 : 0) +
      (activeCommand ? 12 : 0) +
      (heavyPanelsDeferred ? 10 : 0) +
      (historyCount ? Math.min(10, historyCount * 2) : 2),
  );
  const sourceCooldownScore = clamp(
    42 +
      (sourceCooldownActive ? 12 : 22) +
      (chartSource.toLowerCase().includes("fallback") ? 4 : 14) +
      (hasOrderBook ? 12 : 0),
  );
  const shieldMapScore = clamp(28 + (shieldMapDetached ? 34 : 0) + (noRawJsonButtons ? 18 : 0) + (tableWheelUnlocked ? 12 : 0));
  const scrollSurfaceScore = clamp(22 + (tableWheelUnlocked ? 46 : 0) + (suggestionDismissOnOutsideClick ? 18 : 0) + (modalErrorBoundary ? 10 : 0));
  const regressionScore = clamp(20 + (stressScenarioHelpers ? 34 : 0) + (modalErrorBoundary ? 18 : 0) + (noRawJsonButtons ? 14 : 0) + (focusedPanelRouting ? 10 : 0));

  const lanes: TerminalInteractionLane[] = [
    {
      id: "click_intake",
      label: "Click intake",
      state: stateFor(clickIntakeScore),
      score: clickIntakeScore,
      signal: `local-first search ${searchLocalFirst ? "on" : "off"} · active /${activeCommand}`,
      operatorAction: "Resolve row/suggestion locally before external analyze calls; one-letter scans stay blocked.",
    },
    {
      id: "modal_boot",
      label: "Modal boot path",
      state: stateFor(modalBootScore),
      score: modalBootScore,
      signal: `boot ${terminalBootDeferred ? "deferred" : "eager"} · chunk ${modalChunkSplit ? "split" : "inline"} · candles ${candlesCount}`,
      operatorAction: "Paint chart, header and command palette first; defer SOC, evidence, holders and replay until stable.",
    },
    {
      id: "active_panel",
      label: "One-panel routing",
      state: stateFor(activePanelScore),
      score: activePanelScore,
      signal: `focused routing ${focusedPanelRouting ? "enabled" : "missing"} · history ${historyCount}`,
      operatorAction: "Only the selected command owns the main lane; secondary modules stay behind boot or tabs.",
    },
    {
      id: "source_cooldown",
      label: "Source cooldown",
      state: stateFor(sourceCooldownScore),
      score: sourceCooldownScore,
      signal: `${sourceCooldownActive ? "cooldown active" : "cooldown clear"} · ${chartSource}`,
      operatorAction: "If a provider rate-limits the search, keep local table interactions working and show source honesty.",
    },
    {
      id: "shield_map_route",
      label: "Shield Map route",
      state: stateFor(shieldMapScore),
      score: shieldMapScore,
      signal: shieldMapDetached ? "dedicated page" : "inline panel risk",
      operatorAction: "Shield Map should open as its own product page with public explanation and hidden private scoring core.",
    },
    {
      id: "scroll_surface",
      label: "Scroll surface",
      state: stateFor(scrollSurfaceScore),
      score: scrollSurfaceScore,
      signal: tableWheelUnlocked ? "table wheel unlocked" : "table may trap scroll",
      operatorAction: "Horizontal table overflow must not steal vertical page scroll when the pointer is over rows.",
    },
    {
      id: "regression_locks",
      label: "Regression locks",
      state: stateFor(regressionScore),
      score: regressionScore,
      signal: `stress helpers ${stressScenarioHelpers ? "on" : "missing"} · raw JSON ${noRawJsonButtons ? "blocked" : "risk"}`,
      operatorAction: "Keep guards for stress scenario shape, missing icons, raw API buttons and modal safe boundary.",
    },
  ];

  const stabilityScore = average(lanes.map((lane) => lane.score));
  const state = stateFor(stabilityScore);

  const clickFlow: TerminalInteractionFlowStep[] = [
    {
      id: "row_click",
      label: "Row click",
      expected: "Open terminal shell immediately with token identity, logo, score and chart skeleton.",
      blockedIf: "React error, missing icon import, stress shape mismatch or heavy panels render before first paint.",
    },
    {
      id: "chart_first",
      label: "Chart first",
      expected: "Candles and command palette appear before orderbook, replay, holder and evidence panels.",
      blockedIf: "The modal tries to render every console under the chart on first open.",
    },
    {
      id: "command_focus",
      label: "Command focus",
      expected: "Selecting a command swaps one main panel instead of stacking all modules.",
      blockedIf: "The active command is ignored or panels keep rendering as a long wall.",
    },
    {
      id: "safe_exit",
      label: "Safe exit",
      expected: "Close, Escape and backdrop actions return to the clean market page without freezing scroll.",
      blockedIf: "Body scroll remains locked, dropdown stays open, or safe mode hides the real error.",
    },
  ];

  return {
    version: "velmere_terminal_interaction_stability_v1_pass76",
    symbol: result.token.symbol,
    stabilityScore,
    state,
    headline:
      state === "ready"
        ? "Terminal interactions are stable enough for operator beta review."
        : state === "watch"
          ? "Terminal interactions are usable, but source and boot lanes still need review before public launch."
          : state === "degraded"
            ? "Terminal can be used for intake, but must not be presented as production-grade."
            : "Terminal interaction path is blocked until crash, scroll or source routing lanes are fixed.",
    lanes,
    clickFlow,
    lagBudget: [
      "Header, avatar, risk score, chart skeleton and command palette should paint first.",
      "Orderbook, history, replay, holder clusters and export consoles should wait until terminalBooted.",
      "Shield Map belongs on a dedicated route, not as a heavy inline panel under the search.",
      "Local table clicks must work even when external search/analyze providers are cooling down.",
    ],
    regressionLocks: [
      "No [...stress] spreading; use stress scenario helpers only.",
      "No raw /api JSON buttons in customer-facing UI.",
      "No text scan button and no search placeholder on the clean main page.",
      "No table wheel trap; vertical scrolling must continue over market rows.",
      "No token accusation, ROI, yield or legal-proof wording.",
    ],
    safeCopy: [
      "Anomaly signal, not accusation.",
      "Manual review required when sources are partial, fallback or blocked.",
      "Not financial advice. Algorithmic risk flag only.",
    ],
    legalNote: "Not financial advice. Algorithmic risk flag only. UI stability does not prove market integrity or legal wrongdoing.",
    generatedAt: new Date().toISOString(),
  };
}
