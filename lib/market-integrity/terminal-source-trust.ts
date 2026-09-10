import type { TokenRiskResult } from "./risk-types";
import { buildHolderIntelligence } from "./holder-intelligence";
import type { LiquidityOrderBookInput } from "./liquidity-intelligence";
import { buildTerminalPerformanceGuard } from "./terminal-performance-guard";
import { buildTerminalUsabilityGuard } from "./terminal-usability-guard";

export type SourceTrustStatus = "live" | "partial" | "fallback" | "blocked";
export type SourceTrustLane =
  | "search"
  | "market"
  | "candles"
  | "orderbook"
  | "holders"
  | "contract"
  | "history"
  | "evidence"
  | "access";

export type SourceTrustAdapter = {
  id: string;
  lane: SourceTrustLane;
  label: string;
  status: SourceTrustStatus;
  confidence: number;
  freshness: string;
  currentSource: string;
  missing: string;
  operatorAction: string;
  publicCopy: string;
};

export type TerminalSourceTrustInput = {
  candlesCount?: number;
  chartSource?: string;
  hasOrderBook?: boolean;
  orderbook?: LiquidityOrderBookInput | null;
  historyCount?: number;
  activeCommand?: string;
  searchResolverGuarded?: boolean;
  suggestionDismissOnOutsideClick?: boolean;
  sourceCooldownActive?: boolean;
  terminalBootDeferred?: boolean;
  modalChunkSplit?: boolean;
  tableWheelUnlocked?: boolean;
  walletSessionReady?: boolean;
  exportInfrastructureReady?: boolean;
  rateLimitMiddlewareReady?: boolean;
};

export type TerminalSourceTrust = {
  version: "velmere_terminal_source_trust_v1_pass72";
  symbol: string;
  trustScore: number;
  mode: "source_limited" | "operator_review" | "release_candidate";
  activeCommand: string;
  adapters: SourceTrustAdapter[];
  sourceLedger: Array<{ id: string; label: string; value: string; tone: "good" | "watch" | "blocked" }>;
  cooldownPolicy: Array<{ id: string; label: string; body: string; status: "ready" | "watch" | "blocked" }>;
  operatorChecklist: string[];
  publicExplanation: string[];
  blockedUntil: string[];
  legalNote: string;
  generatedAt: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function statusScore(status: SourceTrustStatus) {
  if (status === "live") return 92;
  if (status === "partial") return 68;
  if (status === "fallback") return 42;
  return 16;
}

function laneTone(status: SourceTrustStatus): "good" | "watch" | "blocked" {
  if (status === "live") return "good";
  if (status === "partial" || status === "fallback") return "watch";
  return "blocked";
}

function makeAdapter(adapter: Omit<SourceTrustAdapter, "confidence"> & { confidence?: number }): SourceTrustAdapter {
  return {
    ...adapter,
    confidence: Math.round(clamp(adapter.confidence ?? statusScore(adapter.status))),
  };
}

function modeFromScore(score: number, blocked: number): TerminalSourceTrust["mode"] {
  if (score >= 82 && blocked === 0) return "release_candidate";
  if (score >= 52) return "operator_review";
  return "source_limited";
}

export function buildTerminalSourceTrust(
  result: TokenRiskResult,
  input: TerminalSourceTrustInput = {},
): TerminalSourceTrust {
  const holder = buildHolderIntelligence(result);
  const usability = buildTerminalUsabilityGuard(result, {
    candlesCount: input.candlesCount ?? result.chart?.sevenDay?.length ?? 0,
    chartSource: input.chartSource,
    hasOrderBook: input.hasOrderBook,
    orderbook: input.orderbook,
    historyCount: input.historyCount ?? 0,
    activeCommand: input.activeCommand ?? "sources",
    searchHasIconSubmit: true,
    searchHasEmptyPlaceholder: true,
    shieldMapDetached: true,
    modalErrorBoundary: true,
    sortToggleEnabled: true,
    mobileBottomSheet: true,
  });
  const performance = buildTerminalPerformanceGuard(result, {
    terminalBootDeferred: Boolean(input.terminalBootDeferred),
    modalChunkSplit: Boolean(input.modalChunkSplit),
    orderBookDeferred: true,
    historyDeferred: true,
    heavyPanelsDeferred: true,
    shieldMapDetached: true,
    tableWheelUnlocked: Boolean(input.tableWheelUnlocked),
  });

  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const hasOrderBook = Boolean(input.hasOrderBook || input.orderbook);
  const historyCount = input.historyCount ?? 0;
  const searchGuarded = Boolean(input.searchResolverGuarded);
  const cooldownActive = Boolean(input.sourceCooldownActive);

  const adapters: SourceTrustAdapter[] = [
    makeAdapter({
      id: "search-resolver",
      lane: "search",
      label: "Search resolver",
      status: cooldownActive ? "partial" : searchGuarded ? "live" : "fallback",
      confidence: searchGuarded ? (cooldownActive ? 62 : 86) : 44,
      freshness: cooldownActive ? "cooldown active" : "client guarded",
      currentSource: "local table → suggestions → search endpoint → guarded analyze fallback",
      missing: searchGuarded ? "production cache and edge throttle" : "resolver guard is not confirmed",
      operatorAction: cooldownActive
        ? "Keep scan button local-first until external API recovers; do not spam analyze endpoint."
        : "Test BTC/ETH/SOL and one unknown ticker before accepting search quality.",
      publicCopy: "Search may use live market sources; rate limits are shown as temporary source constraints.",
    }),
    makeAdapter({
      id: "market-sweep",
      lane: "market",
      label: "Market sweep",
      status: result.dataQuality === "live" ? "live" : result.dataQuality === "partial" ? "partial" : "fallback",
      confidence: result.dataQuality === "live" ? 84 : result.dataQuality === "partial" ? 62 : 38,
      freshness: result.generatedAt ? "server generated" : "unknown timestamp",
      currentSource: result.dataSources?.length ? result.dataSources.join(" + ") : "market metrics fallback",
      missing: result.dataQuality === "live" ? "cross-provider reconciliation" : "confirmed live source freshness",
      operatorAction: "Keep source label next to score and never use premium UI as proof of data certainty.",
      publicCopy: "Market rows are screening inputs, not legal findings or investment recommendations.",
    }),
    makeAdapter({
      id: "candles-klines",
      lane: "candles",
      label: "Candles / OHLCV",
      status: candlesCount >= 160 ? "live" : candlesCount >= 60 ? "partial" : candlesCount > 0 ? "fallback" : "blocked",
      confidence: candlesCount >= 160 ? 86 : candlesCount >= 60 ? 68 : candlesCount > 0 ? 42 : 18,
      freshness: `${candlesCount} bars · ${input.chartSource ?? "unknown source"}`,
      currentSource: input.chartSource ?? "chart fallback",
      missing: candlesCount >= 160 ? "multi-venue candle reconciliation" : "terminal-grade candle density for all ranges",
      operatorAction: "Compare 1m, 15m, 1h, 4h, 1d and 7d before escalating a chart anomaly.",
      publicCopy: "Candles describe historic movement only; they do not predict price.",
    }),
    makeAdapter({
      id: "orderbook-depth",
      lane: "orderbook",
      label: "Orderbook / depth",
      status: hasOrderBook ? "partial" : "blocked",
      confidence: hasOrderBook ? 66 : 22,
      freshness: hasOrderBook ? "depth proxy available" : "not connected",
      currentSource: hasOrderBook ? input.orderbook?.source ?? "orderbook proxy" : "missing live depth",
      missing: hasOrderBook ? "multi-exchange depth aggregation" : "live depth, spread, slippage and imbalance feed",
      operatorAction: "Do not mark exit liquidity as safe until depth and sell-impact are visible.",
      publicCopy: "Missing orderbook data increases uncertainty; it is not evidence of safety or danger.",
    }),
    makeAdapter({
      id: "holder-clusters",
      lane: "holders",
      label: "Holder clusters",
      status: holder.dataCompleteness >= 74 ? "partial" : holder.dataCompleteness >= 35 ? "fallback" : "blocked",
      confidence: holder.dataCompleteness,
      freshness: `${holder.dataCompleteness}% complete`,
      currentSource: holder.sourcePlan.map((item) => `${item.source}:${item.status}`).join(" · "),
      missing: holder.missingData.length ? holder.missingData.join(" · ") : "CEX wallet exclusion and chain labels",
      operatorAction: "Separate whales, CEX/custody, team, DEX/LP, retail and unknown before any strong holder narrative.",
      publicCopy: "Unknown holder buckets remain uncertainty, not a clean bill of health.",
    }),
    makeAdapter({
      id: "contract-controls",
      lane: "contract",
      label: "Contract controls",
      status: result.token.tokenAddress ? "partial" : "blocked",
      confidence: result.token.tokenAddress ? 58 : 18,
      freshness: result.token.tokenAddress ? "contract address present" : "contract missing",
      currentSource: result.token.tokenAddress ? `${result.token.chainId ?? "unknown chain"}:${result.token.tokenAddress}` : "no contract address",
      missing: "GoPlus/chain explorer verification, owner privileges, tax and pause/blacklist checks",
      operatorAction: "Keep contract claims in review mode until source-labeled controls are attached.",
      publicCopy: "Contract checks are automated flags and require manual review.",
    }),
    makeAdapter({
      id: "risk-ledger-history",
      lane: "history",
      label: "Risk replay ledger",
      status: historyCount >= 12 ? "live" : historyCount >= 2 ? "partial" : "fallback",
      confidence: historyCount >= 12 ? 82 : historyCount >= 2 ? 58 : 34,
      freshness: `${historyCount} snapshots`,
      currentSource: "persistent risk ledger",
      missing: historyCount >= 12 ? "longer trend window" : "more observations before trend claims",
      operatorAction: "Use replay as direction of review, not as a verdict or prediction.",
      publicCopy: "Replay explains how the risk score changed; it does not forecast markets.",
    }),
    makeAdapter({
      id: "evidence-export",
      lane: "evidence",
      label: "Evidence export",
      status: input.exportInfrastructureReady ? "partial" : "blocked",
      confidence: input.exportInfrastructureReady ? 62 : 24,
      freshness: input.exportInfrastructureReady ? "draft manifest available" : "UI draft only",
      currentSource: "evidence workflow + source ledger",
      missing: "PDF/JSON export service, immutable case id, source appendix and legal review",
      operatorAction: "Block external export until source ledger and missing-data appendix are attached.",
      publicCopy: "Evidence reports are review aids, not legal determinations.",
    }),
    makeAdapter({
      id: "vlm-session",
      lane: "access",
      label: "VLM utility session",
      status: input.walletSessionReady ? "partial" : "blocked",
      confidence: input.walletSessionReady ? 60 : 20,
      freshness: input.walletSessionReady ? "session proof available" : "not enforced",
      currentSource: "utility/access layer",
      missing: "wallet signature, member limits, legal acceptance state and server-side enforcement",
      operatorAction: "Keep VLM language as access utility only; never ROI, yield or passive income.",
      publicCopy: "VLM is an access layer, not an investment product.",
    }),
  ];

  const blockedCount = adapters.filter((item) => item.status === "blocked").length;
  const trustScore = Math.round(clamp(
    adapters.reduce((sum, item) => sum + item.confidence, 0) / adapters.length - (cooldownActive ? 5 : 0),
  ));
  const mode = modeFromScore(trustScore, blockedCount);

  const sourceLedger = adapters.map((item) => ({
    id: item.id,
    label: item.label,
    value: `${item.status} · ${item.confidence}/100`,
    tone: laneTone(item.status),
  }));

  const blockedUntil = adapters
    .filter((item) => item.status === "blocked")
    .slice(0, 5)
    .map((item) => `${item.label}: ${item.missing}`);

  return {
    version: "velmere_terminal_source_trust_v1_pass72",
    symbol: result.token.symbol,
    trustScore,
    mode,
    activeCommand: input.activeCommand ?? "sources",
    adapters,
    sourceLedger,
    cooldownPolicy: [
      {
        id: "client-cooldown",
        label: "Client scan cooldown",
        body: "If external API returns 429, the UI switches to local-first mode and tells the operator to use table rows or wait.",
        status: cooldownActive ? "watch" : "ready",
      },
      {
        id: "server-rate-limit",
        label: "Server rate-limit middleware",
        body: "Production still needs a server-side throttle and cache for search/analyze/report endpoints.",
        status: input.rateLimitMiddlewareReady ? "ready" : "blocked",
      },
      {
        id: "copy-guard",
        label: "Rate-limit copy guard",
        body: "429 is presented as temporary source pressure, never as token risk or failed analysis.",
        status: "ready",
      },
    ],
    operatorChecklist: [
      `Open ${result.token.symbol} only after search resolves local/suggestion sources first.`,
      "Check source ledger before trusting score, confidence or Shield Map status.",
      "If orderbook or holders are blocked, keep anomaly in manual review.",
      `Use performance score ${performance.score}/100 and usability score ${usability.usabilityScore}/100 as UX gates before shipping the next pass.`,
      "Do not export evidence until missing-data appendix and legal note are present.",
    ],
    publicExplanation: [
      "Shield separates live, partial, fallback and blocked sources so the UI does not pretend to know more than it does.",
      "A premium visual state is not a stronger conclusion; source labels and uncertainty remain visible.",
      "The private scoring core stays hidden, but the user can see which public data layers feed the review workflow.",
    ],
    blockedUntil,
    legalNote:
      "Not financial advice. Algorithmic risk flag only. Source Trust shows data readiness and uncertainty; it is not legal proof or an accusation.",
    generatedAt: new Date().toISOString(),
  };
}
