import type { TokenRiskResult } from "./risk-types";
import { buildEvidenceWorkflow, type EvidenceWorkflowInput } from "./evidence-workflow";
import { buildTerminalControlPlane } from "./terminal-control-plane";
import { buildProductionHardening } from "./production-hardening";
import { buildHolderIntelligence } from "./holder-intelligence";
import { buildLiquidityIntelligence, type LiquidityOrderBookInput } from "./liquidity-intelligence";

export type TerminalUsabilityStatus = "ready" | "watch" | "blocked";
export type TerminalUsabilityLane =
  | "search"
  | "sort"
  | "modal"
  | "commands"
  | "sources"
  | "mobile"
  | "legal";

export type TerminalUsabilityCheck = {
  id: string;
  lane: TerminalUsabilityLane;
  label: string;
  status: TerminalUsabilityStatus;
  score: number;
  operatorRead: string;
  acceptance: string;
  repairCommand: string;
};

export type TerminalUsabilityMicrocopy = {
  id: string;
  placement: "search" | "table" | "modal" | "shield_map" | "export";
  rule: string;
  safeText: string;
  forbiddenText: string;
};

export type TerminalUsabilityKeyboardContract = {
  id: string;
  shortcut: string;
  action: string;
  safetyReason: string;
  status: TerminalUsabilityStatus;
};

export type TerminalUsabilitySortContract = {
  id: string;
  column: string;
  firstClick: "descending" | "ascending";
  secondClick: "descending" | "ascending";
  missingValues: "bottom";
  status: TerminalUsabilityStatus;
};

export type TerminalUsabilityGuard = {
  version: "velmere_terminal_usability_guard_v1_pass66";
  symbol: string;
  usabilityScore: number;
  mode: "safe_preview" | "operator_beta" | "production_candidate";
  headline: string;
  checks: TerminalUsabilityCheck[];
  sortContract: TerminalUsabilitySortContract[];
  keyboardContract: TerminalUsabilityKeyboardContract[];
  microcopy: TerminalUsabilityMicrocopy[];
  sourceHonesty: Array<{ id: string; label: string; state: TerminalUsabilityStatus; body: string }>;
  kernelPanicPrevention: Array<{ id: string; guard: string; currentState: string; acceptance: string }>;
  nextOperatorSteps: string[];
  legalNote: string;
  generatedAt: string;
};

export type TerminalUsabilityGuardInput = EvidenceWorkflowInput & {
  orderbook?: LiquidityOrderBookInput | null;
  hasOrderBook?: boolean;
  activeCommand?: string;
  sessionMode?: "public_preview" | "operator_session" | "member_session";
  chatEnabled?: boolean;
  accessLayerVisible?: boolean;
  searchHasIconSubmit?: boolean;
  searchHasEmptyPlaceholder?: boolean;
  shieldMapDetached?: boolean;
  modalErrorBoundary?: boolean;
  sortToggleEnabled?: boolean;
  mobileBottomSheet?: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function statusFromScore(score: number): TerminalUsabilityStatus {
  if (score >= 76) return "ready";
  if (score >= 48) return "watch";
  return "blocked";
}

function modeFromScore(score: number): TerminalUsabilityGuard["mode"] {
  if (score >= 84) return "production_candidate";
  if (score >= 56) return "operator_beta";
  return "safe_preview";
}

function scoreBool(value: boolean, ready = 82, blocked = 22) {
  return value ? ready : blocked;
}

function repairCommand(status: TerminalUsabilityStatus, ready: string, watch: string, blocked: string) {
  if (status === "ready") return ready;
  if (status === "watch") return watch;
  return blocked;
}

export function buildTerminalUsabilityGuard(
  result: TokenRiskResult,
  input: TerminalUsabilityGuardInput = {},
): TerminalUsabilityGuard {
  const holder = buildHolderIntelligence(result);
  const liquidity = buildLiquidityIntelligence(result, input.orderbook);
  const evidence = buildEvidenceWorkflow(result, input);
  const control = buildTerminalControlPlane(result, input);
  const hardening = buildProductionHardening(result, input);

  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const hasOrderBook = Boolean(input.hasOrderBook || input.orderbook);
  const historyCount = input.historyCount ?? 0;
  const command = input.activeCommand ?? "risk";
  const sourceIsStrong = result.dataQuality === "live" || result.dataQuality === "partial";
  const sourceUncertaintyPenalty = result.dataQuality === "demo" ? 18 : result.dataQuality === "partial" ? 8 : 0;
  const missingDataPenalty = Math.min(20, evidence.missingData.length * 4);

  const searchScore = clamp(
    34 +
      scoreBool(Boolean(input.searchHasIconSubmit), 18, 0) +
      scoreBool(Boolean(input.searchHasEmptyPlaceholder), 14, 0) +
      (input.shieldMapDetached ? 12 : 0) +
      (sourceIsStrong ? 8 : 0),
  );
  const sortScore = clamp(42 + (input.sortToggleEnabled ? 36 : 0) + (candlesCount >= 80 ? 8 : 0));
  const modalScore = clamp(38 + (input.modalErrorBoundary ? 32 : 0) + (candlesCount >= 2 ? 10 : 0) + (hasOrderBook ? 5 : 0) - sourceUncertaintyPenalty * 0.35);
  const commandScore = clamp(44 + Math.min(24, control.actionQueue.length * 4) + (command ? 8 : 0) + (evidence.analystCommands.length >= 4 ? 8 : 0));
  const sourceScore = clamp(28 + (sourceIsStrong ? 32 : 10) + (holder.dataCompleteness >= 55 ? 10 : 0) + (liquidity.sourceMode !== "fallback_uncertain" ? 10 : 0) + Math.min(10, historyCount));
  const mobileScore = clamp(40 + (input.mobileBottomSheet ? 30 : 0) + (candlesCount >= 2 ? 9 : 0));
  const legalScore = clamp(58 + evidence.legalGuardrails.length * 4 + hardening.safeCopyRules.length * 3 - (result.score >= 85 ? 4 : 0));

  const checks: TerminalUsabilityCheck[] = [
    {
      id: "search-resolver-clean-main",
      lane: "search",
      label: "Clean search resolver",
      status: statusFromScore(searchScore),
      score: Math.round(searchScore),
      operatorRead: "Main page remains minimal: empty input, icon submit, suggestions and Shield Map are the only helper surfaces.",
      acceptance: "Typing SOL/BTC/ETH must resolve through local rows or search suggestions before falling back to analyze API.",
      repairCommand: repairCommand(statusFromScore(searchScore), "/ux.search verify resolver", "/ux.search test ticker aliases", "/ux.search block raw analyze fallback"),
    },
    {
      id: "two-way-table-sort",
      lane: "sort",
      label: "Two-way table sort",
      status: statusFromScore(sortScore),
      score: Math.round(sortScore),
      operatorRead: "Every numeric table header must toggle high-to-low and low-to-high; missing values stay at the bottom.",
      acceptance: "Second click on price, market cap, volume, 24h, 7d or risk reverses the direction and updates screen-reader copy.",
      repairCommand: repairCommand(statusFromScore(sortScore), "/ux.sort verify aria", "/ux.sort test all columns", "/ux.sort repair toggle state"),
    },
    {
      id: "modal-kernel-panic-containment",
      lane: "modal",
      label: "Modal kernel-panic containment",
      status: statusFromScore(modalScore),
      score: Math.round(modalScore),
      operatorRead: "Token terminal render errors must be contained by safe mode and never crash the full page.",
      acceptance: "Clicking a token opens the terminal or a controlled safe-mode message, never a browser-level kernel panic.",
      repairCommand: repairCommand(statusFromScore(modalScore), "/ux.modal verify safe mode", "/ux.modal trace sparse assets", "/ux.modal block unguarded render"),
    },
    {
      id: "command-palette-not-raw-json",
      lane: "commands",
      label: "Command palette instead of raw JSON",
      status: statusFromScore(commandScore),
      score: Math.round(commandScore),
      operatorRead: "AI Bot, Orchestrator, VLM and Shield Map controls should switch in-panel workflows, not open API endpoint text.",
      acceptance: "Buttons route to terminal panels with next actions, source quality and guardrails visible in the UI.",
      repairCommand: repairCommand(statusFromScore(commandScore), "/ux.commands verify panels", "/ux.commands map missing buttons", "/ux.commands remove raw links"),
    },
    {
      id: "source-honesty-visible",
      lane: "sources",
      label: "Source honesty visible",
      status: statusFromScore(sourceScore),
      score: Math.round(sourceScore),
      operatorRead: "Fallback, partial and live data states must stay visible to prevent premium UI from implying false certainty.",
      acceptance: "Evidence workflow and source ledger show missing holder/orderbook/candle data before export or strong review language.",
      repairCommand: repairCommand(statusFromScore(sourceScore), "/ux.sources approve ledger", "/ux.sources add missing-data chips", "/ux.sources block export"),
    },
    {
      id: "mobile-terminal-readability",
      lane: "mobile",
      label: "Mobile terminal readability",
      status: statusFromScore(mobileScore),
      score: Math.round(mobileScore),
      operatorRead: "Mobile modal behaves like a bottom-sheet/fullscreen terminal with locked page scroll and readable command history.",
      acceptance: "No header overlap, no tiny tap targets and chart controls remain horizontally scrollable on small screens.",
      repairCommand: repairCommand(statusFromScore(mobileScore), "/ux.mobile verify sheet", "/ux.mobile compress header", "/ux.mobile block overlap"),
    },
    {
      id: "legal-safe-language",
      lane: "legal",
      label: "Legal-safe language",
      status: statusFromScore(legalScore),
      score: Math.round(legalScore),
      operatorRead: "Shield must say anomaly, requires review and uncertainty. VLM remains utility/access only.",
      acceptance: "No accusation, no proof claims, no investment promises, no ROI/yield/passive-income copy.",
      repairCommand: repairCommand(statusFromScore(legalScore), "/ux.legal approve copy", "/ux.legal tighten risk wording", "/ux.legal block unsafe copy"),
    },
  ];

  const usabilityScore = Math.round(
    clamp(
      checks.reduce((sum, check) => sum + check.score, 0) / checks.length - missingDataPenalty * 0.18,
    ),
  );

  const sortContract: TerminalUsabilitySortContract[] = [
    { id: "sort-price", column: "price", firstClick: "descending", secondClick: "ascending", missingValues: "bottom", status: "ready" },
    { id: "sort-market-cap", column: "market cap", firstClick: "descending", secondClick: "ascending", missingValues: "bottom", status: "ready" },
    { id: "sort-volume", column: "volume", firstClick: "descending", secondClick: "ascending", missingValues: "bottom", status: "ready" },
    { id: "sort-risk", column: "risk", firstClick: "descending", secondClick: "ascending", missingValues: "bottom", status: "ready" },
    { id: "sort-rank", column: "rank", firstClick: "ascending", secondClick: "descending", missingValues: "bottom", status: "ready" },
  ];

  const keyboardContract: TerminalUsabilityKeyboardContract[] = [
    { id: "enter-search", shortcut: "Enter", action: "submit current search through resolver", safetyReason: "Prevents users from depending on hidden text buttons.", status: input.searchHasIconSubmit ? "ready" : "watch" },
    { id: "escape-modal", shortcut: "Escape", action: "close terminal or suggestions", safetyReason: "Gives users a panic-free exit when modal/data fails.", status: input.modalErrorBoundary ? "ready" : "watch" },
    { id: "tab-focus", shortcut: "Tab", action: "visible focus through search, Shield Map, shield icon, table and terminal commands", safetyReason: "Premium UI remains usable without mouse-only hidden controls.", status: "watch" },
  ];

  const microcopy: TerminalUsabilityMicrocopy[] = [
    { id: "search-empty", placement: "search", rule: "No placeholder clutter", safeText: "Empty premium input with accessible label.", forbiddenText: "Large instructional placeholder or text scan button." },
    { id: "table-risk", placement: "table", rule: "Risk is a flag", safeText: "Algorithmic risk flag only.", forbiddenText: "Scam, fraud, safe, guaranteed." },
    { id: "modal-source", placement: "modal", rule: "Data state visible", safeText: "Fallback source / partial source / live source.", forbiddenText: "Hidden source weakness." },
    { id: "shield-map-private", placement: "shield_map", rule: "Explain layers without leaking formula", safeText: "Private scoring core; public layer map only.", forbiddenText: "Exact weights, thresholds or exploitable heuristics." },
    { id: "export-review", placement: "export", rule: "Evidence is not proof", safeText: "Requires manual review. Not financial advice.", forbiddenText: "Legal proof or investment recommendation." },
  ];

  return {
    version: "velmere_terminal_usability_guard_v1_pass66",
    symbol: result.token.symbol,
    usabilityScore,
    mode: modeFromScore(usabilityScore),
    headline:
      usabilityScore >= 76
        ? `${result.token.symbol} terminal UX is stable enough for operator review.`
        : `${result.token.symbol} terminal UX still needs guarded operator mode before public scale.`,
    checks,
    sortContract,
    keyboardContract,
    microcopy,
    sourceHonesty: [
      {
        id: "chart-source",
        label: "Chart source",
        state: candlesCount >= 80 ? "ready" : candlesCount >= 2 ? "watch" : "blocked",
        body: `${candlesCount} candle/point inputs. Sparse candles must stay marked as fallback context.`,
      },
      {
        id: "holder-source",
        label: "Holder source",
        state: holder.dataCompleteness >= 70 ? "ready" : holder.dataCompleteness >= 42 ? "watch" : "blocked",
        body: `Holder completeness ${holder.dataCompleteness}%. Unknown buckets increase uncertainty, not safety.`,
      },
      {
        id: "liquidity-source",
        label: "Liquidity source",
        state: hasOrderBook ? "ready" : liquidity.sourceMode === "fallback_uncertain" ? "blocked" : "watch",
        body: hasOrderBook ? "Orderbook/depth is attached to the review." : "Orderbook/depth missing; keep liquidity confidence capped.",
      },
    ],
    kernelPanicPrevention: [
      {
        id: "modal-boundary",
        guard: "Client error boundary around TokenRiskModal",
        currentState: input.modalErrorBoundary ? "Enabled" : "Missing",
        acceptance: "A bad token payload renders safe mode instead of breaking the whole market page.",
      },
      {
        id: "resolver-first",
        guard: "Search resolver before analyze fallback",
        currentState: input.searchHasIconSubmit ? "Icon submit with resolver contract" : "Needs resolver review",
        acceptance: "Ticker aliases like SOL and ETH should resolve to market IDs when suggestions are available.",
      },
      {
        id: "no-raw-api-ui",
        guard: "In-panel command routing",
        currentState: "AI/Orchestrator/VLM/Shield Map actions are panel workflows, not raw endpoint links.",
        acceptance: "No user-facing button opens /api JSON as the primary UX.",
      },
    ],
    nextOperatorSteps: [
      "Test SOL, BTC, ETH, OM and one unknown address through search, suggestion click and Enter key.",
      "Click every sortable header twice and verify direction copy plus missing-value behavior.",
      "Open three tokens with different dataQuality states and confirm safe-mode/error boundary never crashes the page.",
      "Keep Shield Map educational but do not expose private weights, thresholds or exploitable scoring internals.",
      "Before public launch, wire persistent audit logs, rate limits, wallet/session gating and export infrastructure.",
    ],
    legalNote: "Not financial advice. Algorithmic risk flag only. Requires manual review; no accusation or legal proof is implied.",
    generatedAt: new Date().toISOString(),
  };
}
