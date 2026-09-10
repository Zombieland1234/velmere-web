import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";
import { buildHolderIntelligence } from "@/lib/market-integrity/holder-intelligence";
import { buildLiquidityIntelligence } from "@/lib/market-integrity/liquidity-intelligence";
import { buildProductionHardening } from "@/lib/market-integrity/production-hardening";
import { buildTerminalPerformanceGuard } from "@/lib/market-integrity/terminal-performance-guard";
import { buildTerminalUsabilityGuard } from "@/lib/market-integrity/terminal-usability-guard";

export type TerminalLaunchBridgeContext = {
  candlesCount: number;
  chartSource: string;
  hasOrderBook: boolean;
  historyCount: number;
  activeCommand: string;
  sessionMode: "public_preview" | "member_utility" | "operator_session";
  terminalBootDeferred: boolean;
  modalChunkSplit: boolean;
  shieldMapDetached: boolean;
  tableWheelUnlocked: boolean;
  searchResolverGuarded: boolean;
  suggestionDismissOnOutsideClick: boolean;
  sourceHonestyVisible: boolean;
  exportInfrastructureReady?: boolean;
  walletSessionReady?: boolean;
  rateLimitMiddlewareReady?: boolean;
  persistentAuditReady?: boolean;
};

export type LaunchBridgeContract = {
  id: string;
  label: string;
  state: "ready" | "partial" | "blocked";
  reason: string;
  next: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function stateScore(state: LaunchBridgeContract["state"]) {
  if (state === "ready") return 1;
  if (state === "partial") return 0.55;
  return 0.14;
}

export function buildTerminalLaunchBridge(
  result: TokenRiskResult,
  context: TerminalLaunchBridgeContext,
) {
  const normalizedSessionMode = context.sessionMode === "member_utility" ? "member_session" : context.sessionMode;
  const holders = buildHolderIntelligence(result);
  const liquidity = buildLiquidityIntelligence(result);
  const production = buildProductionHardening(result, {
    historyCount: context.historyCount,
    candlesCount: context.candlesCount,
    chartSource: context.chartSource,
    hasOrderBook: context.hasOrderBook,
    chatEnabled: true,
    accessLayerVisible: true,
    activeCommand: context.activeCommand,
    sessionMode: normalizedSessionMode,
  });
  const usability = buildTerminalUsabilityGuard(result, {
    historyCount: context.historyCount,
    candlesCount: context.candlesCount,
    chartSource: context.chartSource,
    hasOrderBook: context.hasOrderBook,
    chatEnabled: true,
    accessLayerVisible: true,
    activeCommand: context.activeCommand,
    sessionMode: normalizedSessionMode,
    searchHasIconSubmit: context.searchResolverGuarded,
    searchHasEmptyPlaceholder: true,
    shieldMapDetached: context.shieldMapDetached,
    modalErrorBoundary: true,
    sortToggleEnabled: true,
    mobileBottomSheet: true,
  });
  const performance = buildTerminalPerformanceGuard(result, {
    terminalBootDeferred: context.terminalBootDeferred,
    modalChunkSplit: context.modalChunkSplit,
    orderBookDeferred: true,
    historyDeferred: true,
    heavyPanelsDeferred: true,
    shieldMapDetached: context.shieldMapDetached,
    tableWheelUnlocked: context.tableWheelUnlocked,
  });

  const contracts: LaunchBridgeContract[] = [
    {
      id: "search-intake",
      label: "Search intake",
      state: context.searchResolverGuarded && context.suggestionDismissOnOutsideClick ? "ready" : "partial",
      reason: "Search must resolve local rows first, avoid one-letter scans, dismiss suggestions on outside click and never route users to raw JSON.",
      next: "Keep resolver order as local table → suggestions → search API → analyze fallback.",
    },
    {
      id: "modal-runtime",
      label: "Terminal runtime",
      state: context.terminalBootDeferred && context.modalChunkSplit ? "ready" : "partial",
      reason: "Terminal needs first-paint chart and command palette before heavy SOC/evidence panels to avoid perceived kernel panic.",
      next: "Keep dynamic modal chunk, boot skeleton and delayed orderbook/history fetches.",
    },
    {
      id: "source-ledger",
      label: "Source truth ledger",
      state: context.sourceHonestyVisible && context.candlesCount >= 80 ? "ready" : "partial",
      reason: `Chart source=${context.chartSource}; candles=${context.candlesCount}. Fallback data must remain visible near every confidence label.`,
      next: "Attach source labels to candles, holder clusters, liquidity depth and export manifests.",
    },
    {
      id: "holders-live-api",
      label: "Holder live API",
      state: holders.dataCompleteness >= 72 ? "partial" : "blocked",
      reason: `Holder completeness is ${holders.dataCompleteness}%. Unknown wallets stay uncertainty, not safety.`,
      next: "Connect chain holder API, CEX/custody exclusions, team/treasury labels and freshness timestamps.",
    },
    {
      id: "liquidity-depth",
      label: "Liquidity depth",
      state: context.hasOrderBook && liquidity.sourceMode === "live_orderbook" ? "ready" : "blocked",
      reason: `Liquidity mode=${liquidity.sourceMode}. Exit depth cannot be inferred from price movement alone.`,
      next: "Wire live multi-exchange orderbook, DEX pool depth, spread and slippage snapshots.",
    },
    {
      id: "audit-storage",
      label: "Persistent audit log",
      state: context.persistentAuditReady ? "ready" : "blocked",
      reason: "Operator commands, AI prompts, evidence exports and source snapshots need immutable storage before launch claims.",
      next: "Create audit-log persistence with scan id, operator id, timestamps, command path and source hash.",
    },
    {
      id: "rate-limit",
      label: "Rate-limit middleware",
      state: context.rateLimitMiddlewareReady ? "ready" : "blocked",
      reason: "The UI handles 429 gracefully, but public launch still needs server-side throttles and abuse controls.",
      next: "Add middleware-level limits for scan, AI prompt, orderbook and report export endpoints.",
    },
    {
      id: "vlm-session",
      label: "VLM access session",
      state: context.walletSessionReady ? "ready" : "blocked",
      reason: "VLM must remain utility/access only; access checks need wallet/session proof without ROI language.",
      next: "Connect signed session, membership tier, usage limits and legal acceptance state.",
    },
    {
      id: "evidence-export",
      label: "Evidence export infrastructure",
      state: context.exportInfrastructureReady ? "ready" : "blocked",
      reason: "Evidence report UI exists, but production export needs file generation, case id, source ledger and legal appendix.",
      next: "Build PDF/JSON export service with missing-data appendix and non-accusatory language guard.",
    },
  ];

  const blockerCount = contracts.filter((item) => item.state === "blocked").length;
  const readinessScore = clamp(
    Math.round((contracts.reduce((sum, item) => sum + stateScore(item.state), 0) / contracts.length) * 100),
  );
  const launchMode =
    readinessScore >= 82 && blockerCount === 0
      ? "operator_beta_ready"
      : readinessScore >= 58
        ? "controlled_beta"
        : "internal_build";

  const p0Blockers = contracts
    .filter((item) => item.state === "blocked")
    .slice(0, 5)
    .map((item) => `${item.label}: ${item.next}`);

  return {
    version: "velmere_terminal_launch_bridge_v1_pass71",
    launchMode,
    readinessScore,
    blockerCount,
    activeCommand: context.activeCommand,
    sessionMode: normalizedSessionMode,
    contracts,
    p0Blockers,
    integrationRoadmap: [
      {
        phase: "P0 · stop crashes",
        body: "Keep modal safe mode, stress scenario normalization, search resolver guard, table scroll unlock and raw-JSON routing checks.",
      },
      {
        phase: "P1 · real data spine",
        body: "Wire live holder labels, orderbook/depth, DEX pool events, replay snapshots and source freshness into one source ledger.",
      },
      {
        phase: "P2 · access and audit",
        body: "Add VLM utility session, rate-limit middleware, persistent audit logs and export manifest before public launch.",
      },
      {
        phase: "P3 · premium operating layer",
        body: "Turn Shield Map and Operator Copilot into the guided workflow for analysts, with safe copy and evidence handoff.",
      },
    ],
    acceptanceGates: [
      `Usability score ${usability.usabilityScore}/100 must stay visible when data is partial.`,
      `Performance score ${performance.score}/100 must not regress when opening ${result.token.symbol}.`,
      `Production hardening mode remains ${production.mode.replaceAll("_", " ")} until audit/rate/export gates are wired.`,
      "Every public claim must use anomaly/review/uncertainty wording and include Not financial advice. Algorithmic risk flag only.",
    ],
    operatorScript: [
      `Open ${result.token.symbol} terminal and read active command /${context.activeCommand}.`,
      "Check source ledger before trusting confidence or score labels.",
      "Resolve liquidity and holder blockers before evidence export.",
      "If sources are partial, keep the case in manual review and never imply legal proof.",
    ],
    legalNote:
      "Not financial advice. Algorithmic risk flag only. Launch bridge is an internal readiness map, not an investment claim or legal determination.",
  };
}
