import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";

export type TerminalPerformanceGuardContext = {
  terminalBootDeferred: boolean;
  modalChunkSplit: boolean;
  orderBookDeferred: boolean;
  historyDeferred: boolean;
  heavyPanelsDeferred: boolean;
  shieldMapDetached: boolean;
  tableWheelUnlocked: boolean;
};

export function buildTerminalPerformanceGuard(
  result: TokenRiskResult,
  context: TerminalPerformanceGuardContext,
) {
  const missing = [
    !context.modalChunkSplit ? "Split TokenRiskModal into a client-only dynamic chunk" : undefined,
    !context.terminalBootDeferred ? "Defer heavy terminal panels until after first paint" : undefined,
    !context.orderBookDeferred ? "Defer order-book fetch behind chart boot" : undefined,
    !context.historyDeferred ? "Defer replay/history fetch behind chart boot" : undefined,
    !context.heavyPanelsDeferred ? "Keep AI/SOC/evidence panels behind terminal boot guard" : undefined,
    !context.shieldMapDetached ? "Keep Shield Map on a dedicated page, not under search" : undefined,
    !context.tableWheelUnlocked ? "Allow vertical wheel scroll over the market table" : undefined,
  ].filter(Boolean) as string[];

  const score = Math.max(0, 100 - missing.length * 14 - (result.score >= 85 ? 4 : 0));
  const status = score >= 86 ? "ready" : score >= 68 ? "watch" : "needs_work";

  return {
    version: "velmere-terminal-performance-guard-v1-pass69",
    status,
    score,
    objective:
      "Keep the first token click responsive: chart and command palette render first; heavy AI, SOC, holder, evidence and export panels hydrate after the modal is visible.",
    appliedControls: [
      "TokenRiskModal dynamic import chunk",
      "First-paint terminal boot skeleton",
      "Order-book fetch deferred after chart boot",
      "History/replay fetch deferred after chart boot",
      "Heavy AI/SOC/evidence panels deferred behind terminalBooted",
      "Shield Map detached to a dedicated page",
      "Vertical wheel over table forwarded to the page scroller",
    ],
    missing,
    operatorChecks: [
      "Click BTC, ETH, SOL and one high-risk row; modal should open without safe mode.",
      "Change chart range after modal opens; heavy panels must not block the first paint.",
      "Open Shield Map from the button next to the search; it must route to a full page.",
      "Wheel-scroll while cursor is over the market table; page must move vertically.",
    ],
    legalNote:
      "Performance guard does not change risk conclusions. It only controls UI hydration order and source-honesty presentation. Not financial advice. Algorithmic risk flag only.",
  };
}
