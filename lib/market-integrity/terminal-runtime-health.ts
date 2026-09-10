import type { TokenRiskResult } from "./risk-types";
import type { LiquidityOrderBookInput } from "./liquidity-intelligence";
import { buildTerminalPerformanceGuard } from "./terminal-performance-guard";
import { buildTerminalUsabilityGuard } from "./terminal-usability-guard";
import { buildTerminalSourceTrust } from "./terminal-source-trust";
import { buildTerminalEvidenceExport } from "./terminal-evidence-export";

export type TerminalRuntimeHealthState = "stable" | "watch" | "degraded" | "blocked";
export type TerminalRuntimeLaneId =
  | "modal_runtime"
  | "chart_runtime"
  | "orderbook_runtime"
  | "history_runtime"
  | "source_runtime"
  | "evidence_runtime"
  | "shield_map_runtime"
  | "legal_runtime";

export type TerminalRuntimeHealthLane = {
  id: TerminalRuntimeLaneId;
  label: string;
  state: TerminalRuntimeHealthState;
  score: number;
  detail: string;
  operatorAction: string;
};

export type TerminalRuntimeRegressionGuard = {
  id: string;
  label: string;
  locked: boolean;
  detail: string;
};

export type TerminalRuntimeHealthConsole = {
  version: "velmere_terminal_runtime_health_v1_pass74";
  symbol: string;
  runtimeScore: number;
  state: TerminalRuntimeHealthState;
  headline: string;
  lanes: TerminalRuntimeHealthLane[];
  regressionGuards: TerminalRuntimeRegressionGuard[];
  operatorRunbook: string[];
  blockedUntil: string[];
  legalNote: string;
  generatedAt: string;
};

export type TerminalRuntimeHealthInput = {
  candlesCount?: number;
  chartSource?: string;
  hasOrderBook?: boolean;
  orderbook?: LiquidityOrderBookInput | null;
  historyCount?: number;
  activeCommand?: string;
  chartError?: boolean;
  orderbookError?: boolean;
  modalErrorBoundary?: boolean;
  terminalBootDeferred?: boolean;
  modalChunkSplit?: boolean;
  heavyPanelsDeferred?: boolean;
  shieldMapDetached?: boolean;
  tableWheelUnlocked?: boolean;
  suggestionDismissOnOutsideClick?: boolean;
  sourceCooldownActive?: boolean;
  rateLimitMiddlewareReady?: boolean;
  exportInfrastructureReady?: boolean;
  persistentAuditLogReady?: boolean;
  walletSessionReady?: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function laneState(score: number): TerminalRuntimeHealthState {
  if (score >= 78) return "stable";
  if (score >= 58) return "watch";
  if (score >= 34) return "degraded";
  return "blocked";
}

function stateWeight(state: TerminalRuntimeHealthState) {
  if (state === "stable") return 100;
  if (state === "watch") return 68;
  if (state === "degraded") return 38;
  return 12;
}

export function buildTerminalRuntimeHealth(
  result: TokenRiskResult,
  input: TerminalRuntimeHealthInput = {},
): TerminalRuntimeHealthConsole {
  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const historyCount = input.historyCount ?? 0;
  const chartSource = input.chartSource ?? "unknown chart source";
  const hasOrderBook = Boolean(input.hasOrderBook ?? input.orderbook);
  const modalBoundaryReady = input.modalErrorBoundary ?? true;
  const terminalBootDeferred = input.terminalBootDeferred ?? true;
  const modalChunkSplit = input.modalChunkSplit ?? true;
  const heavyPanelsDeferred = input.heavyPanelsDeferred ?? true;
  const shieldMapDetached = input.shieldMapDetached ?? true;
  const tableWheelUnlocked = input.tableWheelUnlocked ?? true;
  const suggestionDismissOnOutsideClick = input.suggestionDismissOnOutsideClick ?? true;

  const performance = buildTerminalPerformanceGuard(result, {
    terminalBootDeferred,
    modalChunkSplit,
    orderBookDeferred: true,
    historyDeferred: true,
    heavyPanelsDeferred,
    shieldMapDetached,
    tableWheelUnlocked,
  });
  const usability = buildTerminalUsabilityGuard(result, {
    historyCount,
    candlesCount,
    chartSource,
    hasOrderBook,
    activeCommand: input.activeCommand ?? "runtime",
    sessionMode: "operator_session",
    searchHasIconSubmit: true,
    searchHasEmptyPlaceholder: true,
    shieldMapDetached,
    modalErrorBoundary: modalBoundaryReady,
    sortToggleEnabled: true,
    mobileBottomSheet: true,
  });
  const sourceTrust = buildTerminalSourceTrust(result, {
    candlesCount,
    chartSource,
    hasOrderBook,
    orderbook: input.orderbook ?? null,
    historyCount,
    activeCommand: input.activeCommand ?? "runtime",
    searchResolverGuarded: true,
    suggestionDismissOnOutsideClick,
    sourceCooldownActive: Boolean(input.sourceCooldownActive),
    terminalBootDeferred,
    modalChunkSplit,
    tableWheelUnlocked,
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
    activeCommand: input.activeCommand ?? "runtime",
    sessionMode: "operator_session",
    walletSessionReady: Boolean(input.walletSessionReady),
    exportInfrastructureReady: Boolean(input.exportInfrastructureReady),
    rateLimitMiddlewareReady: Boolean(input.rateLimitMiddlewareReady),
    persistentAuditLogReady: Boolean(input.persistentAuditLogReady),
  });

  const modalScore = clamp(
    22 +
      (modalBoundaryReady ? 22 : 0) +
      (modalChunkSplit ? 18 : 0) +
      (terminalBootDeferred ? 18 : 0) +
      (heavyPanelsDeferred ? 10 : 0) +
      Math.min(10, Math.round(performance.score / 10)),
  );
  const chartScore = clamp(
    18 +
      Math.min(42, candlesCount) +
      (chartSource.toLowerCase().includes("binance") ? 20 : 8) -
      (input.chartError ? 16 : 0),
  );
  const orderbookScore = clamp(
    hasOrderBook ? 76 - (input.orderbookError ? 18 : 0) : 38,
  );
  const historyScore = clamp(24 + Math.min(50, historyCount * 3));
  const sourceScore = clamp(
    sourceTrust.trustScore - (input.sourceCooldownActive ? 10 : 0),
  );
  const evidenceScore = clamp(evidenceExport.exportReadinessScore);
  const mapScore = clamp(
    26 +
      (shieldMapDetached ? 28 : 0) +
      (tableWheelUnlocked ? 14 : 0) +
      (suggestionDismissOnOutsideClick ? 12 : 0) +
      Math.min(20, Math.round(usability.usabilityScore / 5)),
  );
  const legalScore = clamp(
    62 +
      (result.dataQuality === "live" ? 10 : result.dataQuality === "partial" ? 4 : 0) +
      (result.confidence !== undefined ? 8 : 0) +
      (evidenceExport.legalNote.includes("Not financial advice") ? 12 : 0),
  );

  const lanes: TerminalRuntimeHealthLane[] = [
    {
      id: "modal_runtime",
      label: "Modal runtime",
      state: laneState(modalScore),
      score: modalScore,
      detail: `${modalScore}/100 · chunk split ${modalChunkSplit ? "on" : "off"} · safe boundary ${modalBoundaryReady ? "on" : "off"}`,
      operatorAction: "Keep TokenRiskModal behind the error boundary and boot skeleton before loading heavy AI/SOC panels.",
    },
    {
      id: "chart_runtime",
      label: "Chart runtime",
      state: laneState(chartScore),
      score: chartScore,
      detail: `${candlesCount} candles · ${chartSource}`,
      operatorAction: "If candles fall back to sparkline data, keep confidence low and show source mode next to OHLCV.",
    },
    {
      id: "orderbook_runtime",
      label: "Orderbook runtime",
      state: laneState(orderbookScore),
      score: orderbookScore,
      detail: hasOrderBook ? "order book response available" : "no live depth feed yet",
      operatorAction: "Do not make depth or exit-liquidity claims until live multi-exchange depth is connected.",
    },
    {
      id: "history_runtime",
      label: "Replay/history runtime",
      state: laneState(historyScore),
      score: historyScore,
      detail: `${historyCount} persistent snapshots available`,
      operatorAction: "Use replay as trend context only; a sparse history must stay in review mode.",
    },
    {
      id: "source_runtime",
      label: "Source trust runtime",
      state: laneState(sourceScore),
      score: sourceScore,
      detail: `${sourceTrust.trustScore}/100 source trust · cooldown ${input.sourceCooldownActive ? "active" : "clear"}`,
      operatorAction: "Keep local-first search, cooldown visibility and server-side rate limits before public launch.",
    },
    {
      id: "evidence_runtime",
      label: "Evidence export runtime",
      state: laneState(evidenceScore),
      score: evidenceScore,
      detail: `${evidenceExport.exportReadinessScore}/100 · ${evidenceExport.state.replaceAll("_", " ")}`,
      operatorAction: "Export stays a manifest until audit storage, redactions and renderer are production-ready.",
    },
    {
      id: "shield_map_runtime",
      label: "Shield Map runtime",
      state: laneState(mapScore),
      score: mapScore,
      detail: `detached page ${shieldMapDetached ? "yes" : "no"} · table wheel ${tableWheelUnlocked ? "unlocked" : "blocked"}`,
      operatorAction: "Shield Map should explain lanes, boundaries and commands; the small shield button remains only a quick lens.",
    },
    {
      id: "legal_runtime",
      label: "Legal / RegTech runtime",
      state: laneState(legalScore),
      score: legalScore,
      detail: `${result.dataQuality} data · confidence ${Math.round((result.confidence ?? 0.35) * 100)}%`,
      operatorAction: "Maintain anomaly/review/uncertainty wording. No scam/fraud claims, no proof language and no investment copy.",
    },
  ];

  const runtimeScore = Math.round(
    lanes.reduce((sum, lane) => sum + stateWeight(lane.state), 0) / lanes.length,
  );
  const state = laneState(runtimeScore);
  const blockedUntil = lanes
    .filter((lane) => lane.state === "blocked" || lane.state === "degraded")
    .map((lane) => `${lane.label}: ${lane.operatorAction}`);

  return {
    version: "velmere_terminal_runtime_health_v1_pass74",
    symbol: result.token.symbol,
    runtimeScore,
    state,
    headline:
      state === "stable"
        ? "Terminal runtime is stable enough for operator review mode."
        : state === "watch"
          ? "Terminal runtime is usable, but source/evidence lanes still need operator caution."
          : state === "degraded"
            ? "Terminal runtime is degraded; keep the case in intake and source audit."
            : "Terminal runtime is blocked until missing production lanes are fixed.",
    lanes,
    regressionGuards: [
      {
        id: "stress-contract",
        label: "Stress bundle contract",
        locked: true,
        detail: "Stress simulator must be read through getStressScenarioList/getWorstStressScenario, never spread as an iterable array.",
      },
      {
        id: "modal-safe-mode",
        label: "Modal safe boundary",
        locked: modalBoundaryReady,
        detail: "Runtime errors must show a controlled safe-mode card, not crash the main market table.",
      },
      {
        id: "shield-map-detached",
        label: "Shield Map detached page",
        locked: shieldMapDetached,
        detail: "The Shield Map opens as a full page; the header shield stays a compact quick lens.",
      },
      {
        id: "search-local-first",
        label: "Search local-first path",
        locked: suggestionDismissOnOutsideClick,
        detail: "Suggestions close on outside click and one-letter scans do not hit external analyze endpoints.",
      },
      {
        id: "rate-limit-honesty",
        label: "Rate-limit honesty",
        locked: true,
        detail: "429 and cooldown states are visible. Table clicks stay local-first while external sources cool down.",
      },
    ],
    operatorRunbook: [
      "Open terminal: first paint must show header, chart and command palette before heavy panels.",
      "Check Runtime Health lanes before trusting AI/SOC output.",
      "If chart/orderbook/history lanes are degraded, route to Source trust and Evidence export only as draft.",
      "Use Shield Map for product explanation; keep proprietary scoring weights private.",
      "Keep all public copy in anomaly/review/uncertainty language. Not financial advice. Algorithmic risk flag only.",
    ],
    blockedUntil,
    legalNote: "Not financial advice. Algorithmic risk flag only. Runtime health is a product QA signal, not proof of token behavior.",
    generatedAt: new Date().toISOString(),
  };
}
