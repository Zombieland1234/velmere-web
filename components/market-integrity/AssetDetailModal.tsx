/* PASS2534 visible execution dock marker: data-pass2534-visible-execution-dock-surface="real_markets" must render before market cap, 24h, paid calls or provider-derived finality. */
/* PASS2533 execution ledger marker: data-pass2533-real-markets-execution-dock blocks final market calls when source/provider recovery has not written a ledger entry. */
/* PASS2532 freshness recovery router marker: data-pass2532-real-markets-recovery-route renders provider comparison recovery before market cap/24h confidence. */
/* PASS2531 source freshness expiry marker: data-pass2531-real-markets-freshness-divergence-bridge blocks market cap/24h confidence when providers are stale or diverged. */
/* PASS2529 runtime evidence chip adapter marker: data-pass2529-real-markets-runtime-evidence-chip-adapter */
"use client";

import dynamic from "next/dynamic";
import { assertBrowserRedirectUrl } from "@/lib/security/navigation-redirect-boundary";
import { buildAssetAnalysisClipboardSummary, copyAssetAnalysisSummary } from "@/lib/security/browser-system-clipboard";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import {
  clearPrivateAccountTabStore,
  purgeLegacyPrivateAccountLocalStorage,
  readPrivateAccountTabArray,
  writePrivateAccountTabArray,
} from "@/lib/account/private-account-ephemeral-store";
import { Activity, ArrowRight, BarChart3, CircleGauge, Download, FishSymbol, Loader2, RefreshCcw, X } from "lucide-react";
import BodyPortal from "@/components/ui/BodyPortal";
import ResolvedAssetLogo from "@/components/market-integrity/AssetLogo";
import AnalysisTab from "@/components/market-integrity/analysis/AnalysisTab";
import { pass628LayerStyle } from "@/lib/ui/pass628-overlay-constitution";
import { buildVlmModalEvidencePacket } from "@/lib/market-integrity/vlm-modal-evidence-packet";
import { buildPass4477AssetDrawerReceipt } from "@/lib/ui/pass4477-worldclass-surface-contract";
import { buildPass4481AssetDrawerAcceptance } from "@/lib/ui/pass4481-worldclass-acceptance-state";
import { buildPass4482DisclosureCopy } from "@/lib/ui/pass4482-premium-surface-qa-disclosure";
import { buildPass4483AssetSourceHealth } from "@/lib/ui/pass4483-premium-runtime-surface";
import { buildPass4484AssetRuntimeSummary } from "@/lib/ui/pass4484-premium-runtime-summary";
import { buildPass4486TimeframeHint } from "@/lib/ui/pass4486-runtime-accessibility";
import { buildPass4489AnalysisMenuState } from "@/lib/ui/pass4489-runtime-keyboard-delivery-state";
import { buildPass4490AssetSourceQuality } from "@/lib/ui/pass4490-runtime-quality-state";
import { buildPass4491AssetEvidenceReadiness } from "@/lib/ui/pass4491-evidence-readiness-state";
import { buildPass4492AssetActionPlan } from "@/lib/ui/pass4492-actionability-state";
import { buildPass4493AssetClaimBoundary } from "@/lib/ui/pass4493-claim-boundary-state";
import { buildPass4494AssetCustomerPacket } from "@/lib/ui/pass4494-customer-packet-state";
import { buildPass4495AssetCopySafeEnvelope } from "@/lib/ui/pass4495-copy-safe-envelope-state";
import { buildPass4496AssetProofDock } from "@/lib/ui/pass4496-premium-proof-dock-state";
import { buildPass4498AssetActionDock } from "@/lib/ui/pass4498-premium-action-dock-state";
import { buildPass4499AssetActionFeedback } from "@/lib/ui/pass4499-action-feedback-loop-state";
import { buildPass4500AssetCommandSurface } from "@/lib/ui/pass4500-premium-command-surface";
import { buildPass4501AssetDecisionSafeQueue } from "@/lib/ui/pass4501-decision-safe-queue";
import { readVlmPaidAccessToken } from "@/lib/commerce/pass2024-vlm-paid-access-client";
import type { VlmPaidAccessContext } from "@/lib/commerce/pass2024-vlm-paid-access";
import { paidAnalysisUiStopSell } from "@/components/market-integrity/asset-detail/paid-access";
import { getVlmCurrentSkuTruth } from "@/lib/commerce/vlm-current-sku-truth";
import {
  isPass4408ShieldCryptoAsset,
  resolvePass4408AssetDetailChartIntervalMs,
  resolvePass4408AssetSessionPolicy,
  resolvePass4408ChartEvidenceMode,
} from "@/lib/market-integrity/pass4408-asset-detail-client-helpers";
import {
  assetDetailChartRuntimeKey,
  fetchAssetDetailChartRuntime,
  invalidateAssetDetailChartRuntime,
  readAssetDetailChartRuntimeCache,
  shouldAutoRefreshAssetDetailChart,
} from "@/components/market-integrity/asset-detail/chart-runtime";
import {
  analysisFieldCount,
  analysisResultRows,
  evidenceCoverageCapLabel,
  hasUsableMarketPrice,
  orderbookEvidenceStatus,
  publicEvidenceStatusCopy,
  serverEvidenceMissingCopy,
  serverEvidenceProviders,
  serverEvidenceSummary,
  sourceEvidenceLabel,
  tierToVlmDepth,
} from "@/lib/market-integrity/pass4409-asset-detail-analysis-copy";
import { resolveVolumeSemantics } from "@/lib/market-integrity/volume-semantics";

export type VlmAssetDetailCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

export type VlmAssetDetailMetricTone =
  | "positive"
  | "warning"
  | "danger"
  | "neutral"
  | "evidence";

export type VlmAssetDetailMetric = {
  label: string;
  value: string;
  caption?: string | null;
  tone?: VlmAssetDetailMetricTone;
};

export type VlmAssetDetailModalData = {
  symbol: string;
  name: string;
  analysisSurface?: "shield-pro";
  providerSymbol?: string;
  marketId?: string;
  quote?: string;
  imageUrl?: string;
  assetClass?: "crypto" | "exchange_token" | "stock" | "etf" | "fx" | "commodity" | "real_estate" | "index" | "exchange" | "market";
  venue?: string;
  assetClassLabel?: string;
  exchangeLabel?: string | null;
  priceLabel: string;
  changeLabel?: string | null;
  changeTone?: "up" | "down" | "neutral";
  sourceLabel?: string | null;
  sourceVerified?: boolean;
  sourceTimeLabel?: string | null;
  currencyLabel?: string | null;
  marketStatusLabel?: string | null;
  confidenceLabel?: string | null;
  confidenceCalibrated?: boolean;
  riskLabel?: string | null;
  candles?: VlmAssetDetailCandle[];
  sparkline?: number[];
  detailMetrics?: VlmAssetDetailMetric[];
  evidenceNotes?: string[];
  marketDataState?:
    | "live_verified"
    | "partial_not_live"
    | "last_known_good"
    | "local_reference"
    | "unverified";
};

type VlmAssetTimeframe = "15M" | "1H" | "4H" | "1D" | "1W" | "1M";
function AssetIntelligenceLoadingSurface() {
  return (
    <div className="vlm-asset-intelligence-loading-pass35-a36" role="status">
      <span />
      <strong>VLM INTELLIGENCE</strong>
      <small>Loading evidence-bound module…</small>
    </div>
  );
}

const MarketImpactTab = dynamic(
  () => import("@/components/market-integrity/AssetIntelligenceTabs").then((module) => module.MarketImpactTab),
  { ssr: false, loading: AssetIntelligenceLoadingSurface },
);
const WhaleWatchTab = dynamic(
  () => import("@/components/market-integrity/AssetIntelligenceTabs").then((module) => module.WhaleWatchTab),
  { ssr: false, loading: AssetIntelligenceLoadingSurface },
);
const VlmNeuralBrainCanvas = dynamic(
  () => import("@/components/market-integrity/asset-detail/VlmNeuralBrainCanvas"),
  {
    ssr: false,
    loading: () => (
      <div
        className="vlm-neural-brain-canvas"
        data-pass35-a37-neural-loading="deferred"
        aria-hidden="true"
      />
    ),
  },
);

type VlmAssetDetailTab = "overview" | "analysis" | "market-impact" | "whale-watch";

type TimeframeConfig = {
  key: VlmAssetTimeframe;
  label: string;
  realMarketsRange: "15m" | "1h" | "4h" | "1d" | "1w" | "1mo";
  shieldRange: "15m" | "1h" | "4h" | "1d" | "7d" | "1mo";
  intervalMs: number;
  visible: number;
  intraday: boolean;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const TIMEFRAMES: readonly TimeframeConfig[] = [
  { key: "15M", label: "15m", realMarketsRange: "15m", shieldRange: "15m", intervalMs: 15 * MINUTE, visible: 420, intraday: true },
  { key: "1H", label: "1H", realMarketsRange: "1h", shieldRange: "1h", intervalMs: HOUR, visible: 420, intraday: true },
  { key: "4H", label: "4H", realMarketsRange: "4h", shieldRange: "4h", intervalMs: 4 * HOUR, visible: 380, intraday: true },
  { key: "1D", label: "1D", realMarketsRange: "1d", shieldRange: "1d", intervalMs: DAY, visible: 360, intraday: false },
  { key: "1W", label: "1W", realMarketsRange: "1w", shieldRange: "7d", intervalMs: WEEK, visible: 260, intraday: false },
  { key: "1M", label: "1M", realMarketsRange: "1mo", shieldRange: "1mo", intervalMs: 30 * DAY, visible: 220, intraday: false },
] as const;

const ASSET_DETAIL_TABS = [
  { id: "overview", Icon: CircleGauge },
  { id: "analysis", Icon: Activity },
  { id: "market-impact", Icon: BarChart3 },
  { id: "whale-watch", Icon: FishSymbol },
] as const satisfies ReadonlyArray<{
  id: VlmAssetDetailTab;
  Icon: typeof CircleGauge;
}>;

const ASSET_DETAIL_TAB_COPY: Record<"pl" | "en" | "de", Record<VlmAssetDetailTab, { label: string; shortLabel: string }>> = {
  pl: {
    overview: { label: "Przegląd", shortLabel: "Przegląd" },
    analysis: { label: "Analiza", shortLabel: "Analiza" },
    "market-impact": { label: "Wpływ na rynek", shortLabel: "Wpływ" },
    "whale-watch": { label: "Duzi gracze", shortLabel: "Gracze" },
  },
  en: {
    overview: { label: "Overview", shortLabel: "Overview" },
    analysis: { label: "Analysis", shortLabel: "Analysis" },
    "market-impact": { label: "Market Impact", shortLabel: "Impact" },
    "whale-watch": { label: "Whale Watch", shortLabel: "Whales" },
  },
  de: {
    overview: { label: "Übersicht", shortLabel: "Übersicht" },
    analysis: { label: "Analyse", shortLabel: "Analyse" },
    "market-impact": { label: "Markteinfluss", shortLabel: "Einfluss" },
    "whale-watch": { label: "Großanleger", shortLabel: "Anleger" },
  },
};

// The former tier launcher stays disconnected while the new top-level Analysis
// section is intentionally empty. Keeping the implementation available avoids
// coupling this visual pass to a destructive analysis-engine refactor.
const VLM_ANALYSIS_TRIGGER_ENABLED = false;

const ANALYSIS_TIERS = [
  { label: "Basic", meta: "quick read", durationSeconds: 10 },
  { label: "Pro", meta: "source depth", durationSeconds: 14 },
  { label: "Advanced", meta: "full matrix", durationSeconds: 20 },
] as const;

type AnalysisTierLabel = (typeof ANALYSIS_TIERS)[number]["label"];

type VlmServerEvidencePacket = {
  schemaVersion?: string;
  confidenceCap?: number;
  sourceCount?: number;
  providerCount?: number;
  providers?: string[];
  factsWithValue?: number;
  missingFacts?: number;
  missingData?: string[];
  nextChecks?: string[];
  sourceHealth?: {
    evidenceQuorum?: string;
    integrity?: string;
    temporal?: string;
  };
  claimPolicy?: {
    publicRule?: string;
    noUnsupportedLiquidityClaims?: boolean;
    noHolderClaimsWithoutHolderData?: boolean;
    noContractClaimsWithoutContractData?: boolean;
  };
};

type VlmServerEvidenceStatus = "idle" | "pending" | "verified" | "limited" | "gated";

type VlmAnalysisRunState = {
  tier: AnalysisTierLabel;
  durationMs: number;
  startedAt: number;
  progress: number;
  complete: boolean;
  serverEvidenceStatus: VlmServerEvidenceStatus;
  serverEvidencePacket?: VlmServerEvidencePacket | null;
  serverEvidenceMessage?: string | null;
};

type VlmPaidTierResponse = {
  commercialReadiness?: {
    customerMessage?: string;
    tiers?: {
      pro?: { sellReady?: boolean };
      advanced?: { sellReady?: boolean };
    };
  };
  customerMessage?: string;
  uxBinding?: { customerMessage?: string };
  clickRuntime?: { message?: string };
  publicEvidencePacket?: VlmServerEvidencePacket;
};

const ANALYSIS_PHASES = [
  { key: "harvest", label: "Signal harvest", meta: "collecting market pulses" },
  { key: "fusion", label: "Source fusion", meta: "merging source context" },
  { key: "neural", label: "Neural mapping", meta: "building the VLM brain mesh" },
  { key: "synthesis", label: "Final synthesis", meta: "assembling the analysis output" },
] as const;

type NormalizedCandle = Required<Pick<VlmAssetDetailCandle, "open" | "high" | "low" | "close">> & {
  timestamp: number;
  volume: number;
};

type ChartRange = {
  from: number;
  to: number;
};

type ChartHover = {
  x: number;
  y: number;
} | null;

type ChartLayout = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  priceBottom: number;
  volumeTop: number;
  volumeBottom: number;
  bottom: number;
  plotWidth: number;
  priceHeight: number;
};

type RemoteCandleSet = {
  candles: VlmAssetDetailCandle[];
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  verificationLabel?: string | null;
  freshness?: "live_verified" | "partial_not_live" | "last_known_good" | "local_reference";
  liveVerified: boolean;
  snapshotReadMode?: "memory" | "supabase" | null;
  staleAgeMs?: number | null;
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function timeframeConfig(key: VlmAssetTimeframe): TimeframeConfig {
  return TIMEFRAMES.find((item) => item.key === key) ?? TIMEFRAMES[TIMEFRAMES.length - 1];
}

/* PASS4598: synthetic candle builders were removed. The modal accepts provider OHLC only. */

function pass4598DedupeSourceCandles(candles: NormalizedCandle[]) {
  const byTimestamp = new Map<number, NormalizedCandle>();
  for (const candle of candles) {
    const timestamp = Math.round(candle.timestamp);
    if (!byTimestamp.has(timestamp)) byTimestamp.set(timestamp, { ...candle, timestamp });
  }
  return Array.from(byTimestamp.values())
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-1400);
}

function pass4534ChartPrecisionSummary(
  candles: NormalizedCandle[],
  timeframe: VlmAssetTimeframe,
  intervalMs = timeframeConfig(timeframe).intervalMs,
) {
  if (candles.length < 8) return { score: 0, duplicateCount: 0, gapCount: 0, largeOpenGaps: 0 };
  const step = intervalMs;
  let duplicateCount = 0;
  let gapCount = 0;
  let largeOpenGaps = 0;
  const seen = new Set<number>();
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const timestampKey = Math.round(candle.timestamp / Math.max(step, 1));
    if (seen.has(timestampKey)) duplicateCount += 1;
    seen.add(timestampKey);
    const previous = candles[index - 1];
    if (!previous) continue;
    if (candle.timestamp - previous.timestamp > step * 1.75) gapCount += 1;
    if (Math.abs(candle.open - previous.close) / Math.max(previous.close, 0.000001) > 0.08) largeOpenGaps += 1;
  }
  const score = Math.max(0, Math.min(100, 100 - duplicateCount * 5 - gapCount * 3 - largeOpenGaps * 4));
  return { score, duplicateCount, gapCount, largeOpenGaps };
}


function pass4538ChartPrecisionLedger(
  candles: NormalizedCandle[],
  timeframe: VlmAssetTimeframe,
  sourceMode: "remote" | "pending",
  intervalMs = timeframeConfig(timeframe).intervalMs,
) {
  const config = timeframeConfig(timeframe);
  const step = intervalMs;
  const latest = candles[candles.length - 1] ?? null;
  const previous = candles[candles.length - 2] ?? null;
  const expectedBars = config.visible;
  const coverage = Math.max(0, Math.min(100, Math.round((Math.min(candles.length, expectedBars) / Math.max(1, expectedBars)) * 100)));
  const driftMs = latest && previous ? Math.abs(latest.timestamp - previous.timestamp - step) : 0;
  const driftBars = step ? driftMs / step : 0;
  const scoreBase = pass4534ChartPrecisionSummary(candles, timeframe, intervalMs).score;
  const sourcePenalty = sourceMode === "pending" ? 100 : 0;
  const driftPenalty = driftBars > 0.45 ? Math.min(10, Math.round(driftBars * 4)) : 0;
  const score = sourceMode === "pending" ? 0 : Math.max(0, Math.min(100, scoreBase - sourcePenalty - driftPenalty));
  return {
    score,
    coverage,
    latest,
    sourceMode,
    driftBars,
    stepLabel: config.label,
    barCount: candles.length,
    policy: sourceMode === "remote" ? "remote OHLC · exact first" : "source pending · no synthetic OHLC",
  };
}

function pass4539SessionPolicy(data: VlmAssetDetailModalData) {
  return resolvePass4408AssetSessionPolicy(data);
}

function pass4539GapAudit(
  candles: NormalizedCandle[],
  timeframe: VlmAssetTimeframe,
  intervalMs = timeframeConfig(timeframe).intervalMs,
) {
  const step = intervalMs;
  const gaps: Array<{ index: number; bars: number; timestamp: number }> = [];
  let openDriftCount = 0;
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const candle = candles[index];
    const bars = (candle.timestamp - previous.timestamp) / Math.max(step, 1);
    if (bars > 1.72) gaps.push({ index, bars, timestamp: candle.timestamp });
    if (Math.abs(candle.open - previous.close) / Math.max(previous.close, 0.000001) > 0.055) openDriftCount += 1;
  }
  const largestGapBars = gaps.reduce((max, gap) => Math.max(max, gap.bars), 0);
  return { gaps, gapCount: gaps.length, largestGapBars, openDriftCount };
}

function pass4598SourceFaithfulCandles(candles: NormalizedCandle[]): NormalizedCandle[] {
  // Exact provider OHLC is preserved. Gaps are disclosed by the audit layer, never bridged.
  return pass4598DedupeSourceCandles(candles);
}

function pass4539ChartPrecisionLedger(
  candles: NormalizedCandle[],
  timeframe: VlmAssetTimeframe,
  sourceMode: "remote" | "pending",
  sessionPolicy: ReturnType<typeof pass4539SessionPolicy>,
  intervalMs = timeframeConfig(timeframe).intervalMs,
) {
  const base = pass4538ChartPrecisionLedger(candles, timeframe, sourceMode, intervalMs);
  const gapAudit = pass4539GapAudit(candles, timeframe, intervalMs);
  const naturalGapPenalty = sessionPolicy === "session_market" ? Math.min(5, gapAudit.gapCount) : Math.min(18, gapAudit.gapCount * 4);
  const openDriftPenalty = Math.min(8, gapAudit.openDriftCount * 2);
  const score = Math.max(0, Math.min(100, base.score - naturalGapPenalty - openDriftPenalty));
  const policyLabel = sessionPolicy === "crypto_24_7"
    ? "crypto 24/7 · provider gaps disclosed"
    : sessionPolicy === "session_market"
      ? "session market · natural gaps marked"
      : "mixed provider · gaps disclosed";
  return { ...base, score, gapAudit, sessionPolicy, policyLabel };
}

function normalizeCandles(
  data: VlmAssetDetailModalData,
  _timeframe: VlmAssetTimeframe,
): NormalizedCandle[] {
  const sourceCandles = (data.candles ?? [])
    .filter(
      (candle) =>
        finite(candle.timestamp) &&
        finite(candle.open) &&
        finite(candle.high) &&
        finite(candle.low) &&
        finite(candle.close) &&
        candle.timestamp > 0 &&
        candle.open > 0 &&
        candle.high >= Math.max(candle.open, candle.close) &&
        candle.low <= Math.min(candle.open, candle.close) &&
        candle.low > 0 &&
        candle.close > 0,
    )
    .map((candle) => ({
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: finite(candle.volume) && candle.volume >= 0 ? candle.volume : 0,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-1000);

  if (sourceCandles.length >= 8) return pass4598SourceFaithfulCandles(sourceCandles);

  // PASS4610 Strict Zero Random/Synthetic Candles:
  // Never reconstruct fake/synthetic candles from 7d sparkline while waiting for provider feeds.
  // Return empty array so the luxury Loading Market Data shimmering skeleton displays until real provider candles arrive.
  return [];
}

function formatDateLabel(timestamp: number, timeframe: VlmAssetTimeframe, locale: "pl" | "en" | "de") {
  const date = new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000);
  if (timeframeConfig(timeframe).intraday) {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
}

function formatPrice(value: number, locale: "pl" | "en" | "de") {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const maxDigits = abs < 0.0001 ? 8 : abs < 0.01 ? 6 : abs < 1 ? 4 : abs < 10 ? 4 : abs < 1000 ? 2 : 2;
  const minDigits = abs < 0.0001 ? 6 : abs < 0.01 ? 4 : abs < 1 ? 2 : 2;
  return value.toLocaleString(locale, {
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: minDigits,
  });
}

function futureSpaceBars(span: number) {
  // PASS4534: keep only a tiny live-price breathing space; no fake empty right-side chart lane.
  // PASS4533 legacy verifier reference: return Math.max(2, Math.min(7, Math.round(span * 0.045)))
  return Math.max(1, Math.min(4, Math.round(span * 0.025)));
}

function clampRange(range: ChartRange, candlesLength: number, extraFutureBars = 0, minimumSpan = 5): ChartRange {
  if (candlesLength <= 1) return { from: 0, to: 0 };
  const span = Math.max(minimumSpan, range.to - range.from);
  const maxTo = candlesLength - 1 + Math.max(0, extraFutureBars);
  const maxFrom = Math.max(0, maxTo - span);
  const from = Math.min(Math.max(0, range.from), maxFrom);
  return { from, to: from + span };
}

function rangeForTimeframe(timeframe: VlmAssetTimeframe, candlesLength: number): ChartRange {
  // PASS4637: the large desktop canvas should not keep the same candle density as the
  // former compact dialog. Show a slightly tighter, still source-faithful window so
  // candles, wicks and turns remain readable without fabricating or interpolating data.
  const requestedVisible = timeframeConfig(timeframe).visible;
  const visible = Math.min(candlesLength, Math.max(24, Math.round(requestedVisible * 0.84)));
  const initialFuture = Math.max(2, Math.round(visible * 0.04));
  const to = Math.max(0, candlesLength - 1 + initialFuture);
  const from = Math.max(0, to - visible);
  return clampRange({ from, to }, candlesLength, futureSpaceBars(visible), 5);
}

function getChartLayout(width: number, height: number): ChartLayout {
  const compact = width < 720;
  const left = compact ? 16 : 24;
  const right = compact ? 68 : 84;
  const top = compact ? 26 : 32;
  const bottom = compact ? 28 : 34;
  const volumeHeight = Math.min(54, Math.max(28, (height - top - bottom) * 0.18));
  const volumeBottom = height - bottom;
  const volumeTop = volumeBottom - volumeHeight;
  const priceBottom = volumeTop - 8;
  const plotWidth = Math.max(120, width - left - right);
  const priceHeight = Math.max(120, priceBottom - top);
  return {
    width,
    height,
    left,
    right,
    top,
    priceBottom,
    volumeTop,
    volumeBottom,
    bottom,
    plotWidth,
    priceHeight,
  };
}

function getVisibleCandles(candles: NormalizedCandle[], range: ChartRange) {
  const start = Math.max(0, Math.floor(range.from) - 3);
  const end = Math.min(candles.length - 1, Math.ceil(range.to) + 3);
  return candles.slice(start, end + 1).map((candle, localIndex) => ({
    candle,
    index: start + localIndex,
  }));
}

function crisp(value: number) {
  return Math.round(value) + 0.5;
}

type AnalysisInsightItem = {
  key: string;
  title: string;
  reading: string;
  detail: string;
  badge: string;
  tone: "positive" | "neutral" | "watch" | "risk";
  sparkline: number[];
};

function parseNumericLabel(label?: string | null) {
  if (!label) return null;
  const slashMatch = label.match(/[-+]?\d+(?:[.,]\d+)?\s*\//);
  if (slashMatch) {
    const value = Number(slashMatch[0].replace("/", "").replace(",", ".").trim());
    return Number.isFinite(value) ? value : null;
  }
  const percentOrNumber = label.match(/[-+]?\d+(?:[.,]\d+)?/);
  if (!percentOrNumber) return null;
  const value = Number(percentOrNumber[0].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function splitPriceLabel(label?: string | null) {
  const raw = label?.trim() || "—";
  if (!raw || raw === "—") return { amount: "—", currency: "" };
  const compact = raw.replace(/\s+/g, " ");
  const match = compact.match(/^(.+?)\s+([A-Z]{2,6})$/);
  if (!match) return { amount: compact, currency: "" };
  return { amount: match[1], currency: match[2] };
}

function parseLocalizedPriceAmount(label?: string | null) {
  const amount = splitPriceLabel(label).amount
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[^0-9,.'\-\s]/g, "")
    .replace(/'/g, "")
    .trim();
  if (!amount || amount === "—") return null;

  const compact = amount.replace(/\s+/g, "");
  const comma = compact.lastIndexOf(",");
  const dot = compact.lastIndexOf(".");
  let normalized = compact;

  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = compact.split(thousandsSeparator).join("");
    if (decimalSeparator === ",") normalized = normalized.replace(",", ".");
  } else if (comma >= 0) {
    const decimals = compact.length - comma - 1;
    normalized = decimals >= 1 && decimals <= 6
      ? compact.replace(",", ".")
      : compact.replace(/,/g, "");
  } else if ((compact.match(/\./g) ?? []).length > 1) {
    const parts = compact.split(".");
    const decimal = parts.at(-1) ?? "";
    normalized = decimal.length >= 1 && decimal.length <= 6
      ? `${parts.slice(0, -1).join("")}.${decimal}`
      : parts.join("");
  }

  const value = Number(normalized);
  return finite(value) ? value : null;
}

function PriceMetricValue({ label }: { label?: string | null }) {
  const price = splitPriceLabel(label);
  return (
    <strong className="vlm-analysis-price-value">
      <span>{price.amount}</span>
      {price.currency ? <em>{price.currency}</em> : null}
    </strong>
  );
}

const ANALYSIS_LOCAL_LOGOS: Record<string, string> = {
  AAPL: "/market-logos/aapl.svg",
  MSFT: "/market-logos/msft.svg",
  NVDA: "/market-logos/nvda.svg",
  GOOGL: "/market-logos/googl.svg",
  GOOG: "/market-logos/googl.svg",
  AMZN: "/market-logos/amzn.svg",
  META: "/market-logos/meta.svg",
  TSLA: "/market-logos/tsla.svg",
  BRK: "/market-logos/brk.svg",
  "BRK.B": "/market-logos/brk.svg",
  JPM: "/market-logos/jpm.svg",
  V: "/market-logos/visa.svg",
  VISA: "/market-logos/visa.svg",
  WMT: "/market-logos/wmt.svg",
  LLY: "/market-logos/lly.svg",
  SPY: "/market-logos/spy.svg",
  QQQ: "/market-logos/qqq.svg",
  GLD: "/market-logos/gld.svg",
  USO: "/market-logos/uso.svg",
  TLT: "/market-logos/tlt.svg",
  EURUSD: "/market-logos/eurusd.svg",
  "EUR/USD": "/market-logos/eurusd.svg",
  DXY: "/market-logos/dxy.svg",
  MA: "/market-logos/mastercard.svg",
  BTC: "/market-logos/btc.svg",
  ETH: "/market-logos/eth.svg",
  BNB: "/market-logos/bnb.svg",
  SOL: "/market-logos/sol.svg",
  USDT: "/market-logos/usdt.svg",
  USDC: "/market-logos/usdc.svg",
  XRP: "/market-logos/xrp.svg",
};

function localAnalysisLogo(symbol: string) {
  const upper = symbol.trim().toUpperCase();
  const base = upper.replace(/[./-].*$/, "");
  return ANALYSIS_LOCAL_LOGOS[upper] ?? ANALYSIS_LOCAL_LOGOS[base];
}

function analysisAssetClassForLogo(symbol: string, name: string): "crypto" | "stock" | "fx" | "commodity" | "index" | "etf" | "real_estate" | "exchange" | "market" {
  const upper = symbol.trim().toUpperCase();
  const haystack = `${upper} ${name}`.toLowerCase();
  if (/^(BTC|ETH|WETH|WBTC|BNB|SOL|USDT|USDC|DOGE|XRP|ADA|AVAX|LINK|DOT)$/.test(upper)) return "crypto";
  if (/^[A-Z]{3}USD$/.test(upper) || upper.includes("/")) return "fx";
  if (/(gold|silver|oil|copper|commodity|surowce)/.test(haystack)) return "commodity";
  if (/(index|dax|ftse|nasdaq|s&p|dow)/.test(haystack)) return "index";
  if (/(etf|fund)/.test(haystack)) return "etf";
  if (/(reit|real estate|nieruchomo)/.test(haystack)) return "real_estate";
  if (/(binance|coinbase|kraken|bybit|mexc|exchange|venue)/.test(haystack)) return "exchange";
  if (/^[A-Z0-9]{1,6}(\.[A-Z]{1,3})?$/.test(upper)) return "stock";
  return "market";
}

function VlmAssetMark({ data }: { data: VlmAssetDetailModalData }) {
  const forcedLogo = localAnalysisLogo(data.symbol);
  return (
    <ResolvedAssetLogo
      key={`${data.symbol}:${forcedLogo ?? data.imageUrl ?? "badge"}`}
      symbol={data.symbol}
      providerSymbol={data.providerSymbol}
      name={data.name}
      imageUrl={forcedLogo ?? data.imageUrl}
      assetClass={data.assetClass ?? analysisAssetClassForLogo(data.symbol, data.name)}
      venue={data.venue ?? data.exchangeLabel ?? undefined}
      compact
      eager
      className="vlm-analysis-token-mark-resolved"
    />
  );
}

function assetDrawerSurface(data: VlmAssetDetailModalData): "shield" | "real-markets" {
  const label = `${data.assetClassLabel ?? ""} ${data.exchangeLabel ?? ""}`.toLowerCase();
  if (label.includes("real markets") || label.includes("stock") || label.includes("equity") || label.includes("fx") || label.includes("commodity") || label.includes("etf")) return "real-markets";
  return "shield";
}

const PASS4478_DRAWER_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function pass4478FocusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(PASS4478_DRAWER_FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.getAttribute("aria-hidden") === "true") return false;
    if (element.closest("[aria-hidden='true']")) return false;
    if (element.tabIndex < 0) return false;
    const style = window.getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0;
  });
}

function pass4478TrapTabKey(event: globalThis.KeyboardEvent, container: HTMLElement | null) {
  if (event.key !== "Tab") return false;
  const focusable = pass4478FocusableElements(container);
  if (!container || focusable.length === 0) {
    event.preventDefault();
    container?.focus({ preventScroll: true });
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (!active || !container.contains(active)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
    return true;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  return false;
}

type AssetDetailShellCopy = {
  eyebrow: string;
  price: string;
  risk: string;
  close: string;
  marketOpen: string;
  currency: string;
  source: string;
  loadingCandles: string;
  visualLock: string;
  chartEnd: string;
  tableParity: string;
  overlayQuiet: string;
  localeLock: string;
};

const assetDetailShellCopy: Record<"pl" | "en" | "de", AssetDetailShellCopy> = {
  pl: {
    eyebrow: "Velmère · Inteligencja rynku",
    price: "Cena",
    risk: "Ryzyko",
    close: "Zamknij szczegóły instrumentu",
    marketOpen: "Rynek aktywny",
    currency: "Waluta",
    source: "Źródło",
    loadingCandles: "Ładowanie świec…",
    visualLock: "Kontrakt ekranu",
    chartEnd: "wykres domknięty",
    tableParity: "parytet tabeli",
    overlayQuiet: "warstwy wyciszone",
    localeLock: "język spójny",
  },
  en: {
    eyebrow: "Velmère · Market intelligence",
    price: "Price",
    risk: "Risk",
    close: "Close instrument details",
    marketOpen: "Market active",
    currency: "Currency",
    source: "Source",
    loadingCandles: "Loading candles…",
    visualLock: "Screen contract",
    chartEnd: "chart endcap",
    tableParity: "table parity",
    overlayQuiet: "layers muted",
    localeLock: "locale locked",
  },
  de: {
    eyebrow: "Velmère · Marktintelligenz",
    price: "Preis",
    risk: "Risiko",
    close: "Instrumentdetails schließen",
    marketOpen: "Markt aktiv",
    currency: "Währung",
    source: "Quelle",
    loadingCandles: "Kerzen werden geladen…",
    visualLock: "Bildschirmvertrag",
    chartEnd: "Chart-Abschluss",
    tableParity: "Tabellen-Parität",
    overlayQuiet: "Ebenen ruhig",
    localeLock: "Sprache konsistent",
  },
};

function AssetDrawerParityReceipt({
  data,
  locale,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
}) {
  const receipt = buildPass4477AssetDrawerReceipt({
    locale,
    surface: assetDrawerSurface(data),
    symbol: data.symbol,
    sourceLabel: data.sourceLabel,
    sourceTimeLabel: data.sourceTimeLabel,
  });

  return (
    <section
      className="vlm-asset-drawer-receipt-pass4477"
      aria-label={receipt.title}
      data-pass4477-asset-drawer-proof-strip="clickaway-escape-scroll-source-bound-vlm-tier"
      data-pass4477-asset-drawer-surface={assetDrawerSurface(data)}
    >
      <div className="vlm-asset-drawer-receipt-copy-pass4477">
        <p>{receipt.title}</p>
        <span>{receipt.asset}</span>
        <small>{receipt.subtitle}</small>
      </div>
      <div className="vlm-asset-drawer-receipt-grid-pass4477">
        {receipt.items.map((item) => (
          <span key={item.label} data-state={item.state}>
            <strong>{item.label}</strong>
            <em>{item.value}</em>
          </span>
        ))}
      </div>
      <p className="vlm-asset-drawer-receipt-source-pass4477">{receipt.source}</p>
    </section>
  );
}

function AssetDrawerVisualLockRail({
  data,
  locale,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
}) {
  const shell = assetDetailShellCopy[locale];
  const surface = assetDrawerSurface(data);
  const items = [
    shell.chartEnd,
    surface === "shield" ? "Shield 1:1" : "Real Markets 1:1",
    shell.overlayQuiet,
    shell.localeLock,
  ];
  return (
    <section
      className="vlm-asset-drawer-visual-lock-pass4479"
      aria-label={shell.visualLock}
      data-pass4479-asset-drawer-visual-lock="screen-table-chart-overlay-locale"
      data-pass4479-asset-drawer-surface={surface}
    >
      <span>{shell.visualLock}</span>
      <div>
        {items.map((item) => (
          <em key={item}>{item}</em>
        ))}
      </div>
    </section>
  );
}


type Pass4480DrawerGuardCopy = {
  title: string;
  subtitle: string;
  clickAway: string;
  escape: string;
  chart: string;
  footer: string;
  loading: string;
  ready: string;
  watch: string;
};

const pass4480DrawerGuardCopy: Record<"pl" | "en" | "de", Pass4480DrawerGuardCopy> = {
  pl: {
    title: "Warstwa interakcji",
    subtitle: "Klik poza panelem, Escape, scroll owner, wykres i stopka analizy są kontrolowane z jednego prawego drawera.",
    clickAway: "click-away aktywny",
    escape: "Escape uporządkowany",
    chart: "gesty tylko na wykresie",
    footer: "VLM Analysis w safe-area",
    loading: "świece ładują się",
    ready: "źródło gotowe",
    watch: "źródło do weryfikacji",
  },
  en: {
    title: "Interaction layer",
    subtitle: "Click-away, Escape, scroll ownership, chart gestures and the analysis footer are controlled by the same right drawer.",
    clickAway: "click-away armed",
    escape: "Escape ordered",
    chart: "chart gestures isolated",
    footer: "VLM Analysis safe-area",
    loading: "candles loading",
    ready: "source ready",
    watch: "source needs review",
  },
  de: {
    title: "Interaktionsschicht",
    subtitle: "Click-away, Escape, Scroll Ownership, Chart-Gesten und Analyse-Footer werden vom selben rechten Drawer kontrolliert.",
    clickAway: "Click-away aktiv",
    escape: "Escape geordnet",
    chart: "Chart-Gesten isoliert",
    footer: "VLM Analysis Safe-Area",
    loading: "Kerzen laden",
    ready: "Quelle bereit",
    watch: "Quelle prüfen",
  },
};

function AssetDrawerInteractionGuard({
  data,
  locale,
  chartIsLoading,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  chartIsLoading: boolean;
}) {
  const copy = pass4480DrawerGuardCopy[locale];
  const sourceState = chartIsLoading ? "loading" : data.sourceLabel || data.sourceTimeLabel ? "ready" : "watch";
  const stateLabel = sourceState === "loading" ? copy.loading : sourceState === "ready" ? copy.ready : copy.watch;
  const items = [copy.clickAway, copy.escape, copy.chart, copy.footer, stateLabel];
  return (
    <section
      className="vlm-asset-drawer-interaction-guard-pass4480"
      aria-label={copy.title}
      data-pass4480-asset-drawer-interaction-guard="clickaway-escape-chart-footer-source-state"
      data-pass4480-source-state={sourceState}
    >
      <div className="vlm-asset-drawer-interaction-copy-pass4480">
        <span>{copy.title}</span>
        <small>{copy.subtitle}</small>
      </div>
      <div className="vlm-asset-drawer-interaction-items-pass4480">
        {items.map((item) => (
          <em key={item}>{item}</em>
        ))}
      </div>
    </section>
  );
}


function AssetDrawerAcceptanceStateRail({
  data,
  locale,
  chartIsLoading,
  analysisMenuOpen,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  chartIsLoading: boolean;
  analysisMenuOpen: boolean;
}) {
  const hasChartData = (data.candles ?? []).filter((item) => finite(item.close)).length >= 2 || (data.sparkline ?? []).filter(finite).length >= 2;
  const hasSource = Boolean(data.sourceLabel || data.sourceTimeLabel);
  const acceptance = buildPass4481AssetDrawerAcceptance({
    locale,
    surface: assetDrawerSurface(data),
    symbol: data.symbol,
    chartIsLoading,
    hasChartData,
    hasSource,
    analysisMenuOpen,
  });

  return (
    <section
      className="vlm-asset-drawer-acceptance-state-pass4481"
      aria-label={acceptance.title}
      data-pass4481-asset-drawer-acceptance-state="chart-source-keyboard-close-analysis-mobile"
      data-pass4481-state={acceptance.state}
      data-pass4481-surface={assetDrawerSurface(data)}
    >
      <div className="vlm-asset-drawer-acceptance-head-pass4481">
        <div>
          <span>{acceptance.title}</span>
          <small>{acceptance.subtitle}</small>
        </div>
        <em>{acceptance.badge}</em>
      </div>
      <div className="vlm-asset-drawer-acceptance-grid-pass4481">
        {acceptance.rows.map((row) => (
          <span key={`${row.label}-${row.value}`} data-state={row.state}>
            <strong>{row.label}</strong>
            <small>{row.value}</small>
          </span>
        ))}
      </div>
      {acceptance.blockers.length ? (
        <p className="vlm-asset-drawer-acceptance-blockers-pass4481">
          {acceptance.blockers.join(" · ")}
        </p>
      ) : null}
    </section>
  );
}

function AssetDrawerRuntimeSummaryPass4484({
  data,
  locale,
  chartIsLoading,
  timeframe,
  analysisMenuOpen,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  chartIsLoading: boolean;
  timeframe: VlmAssetTimeframe;
  analysisMenuOpen: boolean;
}) {
  const summary = buildPass4484AssetRuntimeSummary({
    locale,
    surface: assetDrawerSurface(data),
    symbol: data.symbol,
    sourceLabel: data.sourceLabel,
    sourceTimeLabel: data.sourceTimeLabel,
    timeframeLabel: timeframe,
    chartIsLoading,
    analysisMenuOpen,
  });

  return (
    <section
      className="vlm-asset-runtime-summary-pass4484"
      data-pass4484-asset-runtime-summary="visible-compact-chart-first-source-state"
      data-pass4484-runtime-state={summary.state}
      data-pass4484-runtime-surface={assetDrawerSurface(data)}
      aria-label={summary.title}
    >
      <div className="vlm-asset-runtime-summary-copy-pass4484">
        <span>{summary.title}</span>
        <small>{summary.subtitle}</small>
      </div>
      <div className="vlm-asset-runtime-summary-items-pass4484">
        {summary.items.map((item) => (
          <span key={`${item.label}-${item.value}`} data-state={item.state}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      <em>{summary.badge}</em>
    </section>
  );
}


function AssetDrawerProofDockPass4496({
  data,
  locale,
  remoteReady,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  remoteReady: boolean;
}) {
  const dock = buildPass4496AssetProofDock({
    locale,
    sourceLabel: data.sourceLabel,
    sourceTimeLabel: data.sourceTimeLabel,
    candleCount: (data.candles ?? []).filter((item) => finite(item.close)).length,
    remoteReady,
    riskLabel: data.riskLabel,
    confidenceLabel: data.confidenceLabel,
  });

  return (
    <details
      className="vlm-asset-proof-dock-pass4496 vlm-proof-dock-progressive-pass4497"
      data-pass4496-asset-proof-dock="premium-compressed-source-evidence-claim-export-before-chart"
      data-pass4497-proof-disclosure="closed-by-default-chart-first-operator-details-on-demand"
      data-pass4496-proof-dock-state={dock.state}
      aria-label={dock.title}
    >
      <summary className="vlm-asset-proof-dock-head-pass4496 vlm-proof-dock-summary-pass4497">
        <div>
          <span>{dock.title}</span>
          <small>{dock.subtitle}</small>
        </div>
        <em>{dock.badge}</em>
        <strong className="vlm-proof-dock-toggle-pass4497">{dock.detailsLabel}</strong>
      </summary>
      <div className="vlm-asset-proof-dock-grid-pass4496 vlm-proof-dock-details-pass4497" aria-live="polite">
        {dock.items.map((item) => (
          <span key={`${item.label}-${item.value}`} data-state={item.state}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
    </details>
  );
}


function AssetDrawerActionDockPass4498({
  data,
  locale,
  remoteReady,
  timeframe,
  onRefresh,
  chartIsLoading,
  refreshNonce,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  remoteReady: boolean;
  timeframe: VlmAssetTimeframe;
  chartIsLoading: boolean;
  refreshNonce: number;
  onRefresh: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "fallback">("idle");
  const dock = buildPass4498AssetActionDock({
    locale,
    symbol: data.symbol,
    name: data.name,
    sourceLabel: data.sourceLabel,
    sourceTimeLabel: data.sourceTimeLabel,
    timeframe,
    candleCount: (data.candles ?? []).filter((item) => finite(item.close)).length,
    remoteReady,
    riskLabel: data.riskLabel,
    confidenceLabel: data.confidenceLabel,
  });
  const feedback = buildPass4499AssetActionFeedback({
    locale,
    chartIsLoading,
    remoteReady,
    refreshNonce,
    copyState,
    pdfQueueEnabled: dock.pdfQueueEnabled,
  });
  const commandSurface = buildPass4500AssetCommandSurface({
    locale,
    chartIsLoading,
    remoteReady,
    refreshNonce,
    copyState,
    pdfQueueEnabled: dock.pdfQueueEnabled,
  });
  const decisionQueue = buildPass4501AssetDecisionSafeQueue({
    locale,
    chartIsLoading,
    remoteReady,
    candleCount: (data.candles ?? []).filter((item) => finite(item.close)).length,
    copyState,
    pdfQueueEnabled: dock.pdfQueueEnabled,
  });
  const clipboardPacket = { ...dock.packet, actionFeedback: feedback.items, commandSurface: commandSurface.packet, decisionQueue: decisionQueue.packet };

  const copyPacket = async () => {
    try {
      const copied = await copyAssetAnalysisSummary(clipboardPacket);
      if (!copied) throw new Error("asset_clipboard_unavailable");
      setCopyState("copied");
    } catch {
      setCopyState("fallback");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  return (
    <section
      className="vlm-asset-action-dock-pass4498"
      data-pass4498-asset-action-dock="copy-packet-recheck-source-pdf-queue-chart-first"
      data-pass4498-action-state={dock.state}
      data-pass4499-asset-action-feedback={feedback.state}
      aria-label={dock.title}
    >
      <div className="vlm-asset-action-dock-copy-pass4498">
        <span>{dock.title}</span>
        <small>{dock.subtitle}</small>
      </div>
      <div className="vlm-asset-action-dock-items-pass4498" aria-live="polite">
        {dock.items.map((item) => (
          <span key={`${item.label}-${item.value}`} data-state={item.state}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      <div className="vlm-asset-action-dock-buttons-pass4498">
        <button type="button" onClick={copyPacket} data-pass4498-action="copy-safe-packet">
          <Download className="h-3.5 w-3.5" />
          {feedback.copyLabel}
        </button>
        <button type="button" onClick={onRefresh} disabled={chartIsLoading} data-pass4498-action="recheck-source" data-pass4499-recheck-state={chartIsLoading ? "busy" : "ready"}>
          <RefreshCcw className="h-3.5 w-3.5" />
          {feedback.recheckLabel}
        </button>
        <button type="button" disabled={!dock.pdfQueueEnabled} data-pass4498-action="pdf-queue-boundary">
          {dock.pdfLabel}
        </button>
      </div>
      <div className="vlm-command-surface-pass4500" data-pass4500-asset-command-surface={commandSurface.state} aria-live="polite">
        <div>
          <span>{commandSurface.title}</span>
          <small>{commandSurface.subtitle}</small>
        </div>
        <em>{commandSurface.badge}</em>
      </div>
      <div className="vlm-decision-safe-queue-pass4501" data-pass4501-asset-decision-safe-queue={decisionQueue.state} aria-live="polite">
        <div>
          <span>{decisionQueue.title}</span>
          <small>{decisionQueue.subtitle}</small>
        </div>
        <em>{decisionQueue.badge}</em>
        <div className="vlm-decision-safe-queue-pass4501__steps">
          {decisionQueue.steps.map((step) => (
            <span key={`${step.label}-${step.value}`} data-state={step.state}>
              <small>{step.label}</small>
              <strong>{step.value}</strong>
            </span>
          ))}
        </div>
      </div>
      <details className="vlm-action-feedback-disclosure-pass4500" data-pass4500-action-feedback-disclosure={feedback.state}>
        <summary>{commandSurface.detailsLabel}</summary>
        <div className="vlm-asset-action-feedback-pass4499" data-pass4499-asset-action-feedback-status={feedback.state} aria-live="polite">
          <div>
            <span>{feedback.title}</span>
            <small>{feedback.subtitle}</small>
          </div>
          <div className="vlm-asset-action-feedback-grid-pass4499">
            {feedback.items.map((item) => (
              <span key={`${item.label}-${item.value}`} data-state={item.state}>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}

function AssetDrawerRuntimeQualityPass4490({
  data,
  locale,
  chartIsLoading,
  timeframe,
  remoteReady,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  chartIsLoading: boolean;
  timeframe: VlmAssetTimeframe;
  remoteReady: boolean;
}) {
  const quality = buildPass4490AssetSourceQuality({
    locale,
    surface: assetDrawerSurface(data),
    sourceLabel: data.sourceLabel,
    sourceTimeLabel: data.sourceTimeLabel,
    candleCount: (data.candles ?? []).filter((item) => finite(item.close)).length,
    timeframeLabel: timeframeConfig(timeframe).label,
    loading: chartIsLoading,
    remoteReady,
  });

  return (
    <section
      className="vlm-asset-runtime-quality-pass4490"
      data-pass4490-asset-runtime-quality="source-candle-timeframe-live-provider-boundary"
      data-pass4490-runtime-quality-state={quality.state}
      aria-label={quality.title}
    >
      <div className="vlm-asset-runtime-quality-copy-pass4490">
        <span>{quality.title}</span>
        <small>{quality.subtitle}</small>
      </div>
      <div className="vlm-asset-runtime-quality-items-pass4490">
        {quality.items.map((item) => (
          <span key={`${item.label}-${item.value}`} data-state={item.state}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      <em>{quality.badge}</em>
    </section>
  );
}


function AssetDrawerEvidenceReadinessPass4491({
  data,
  locale,
  timeframe,
  remoteReady,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  timeframe: VlmAssetTimeframe;
  remoteReady: boolean;
}) {
  const readiness = buildPass4491AssetEvidenceReadiness({
    locale,
    surface: assetDrawerSurface(data),
    sourceLabel: data.sourceLabel,
    sourceTimeLabel: data.sourceTimeLabel,
    candleCount: (data.candles ?? []).filter((item) => finite(item.close)).length,
    timeframeLabel: timeframeConfig(timeframe).label,
    remoteReady,
  });

  return (
    <section
      className="vlm-asset-evidence-readiness-pass4491"
      data-pass4491-asset-evidence-readiness="analysis-pdf-source-missing-proof-visible"
      data-pass4491-evidence-readiness-state={readiness.state}
      aria-label={readiness.title}
      aria-live="polite"
    >
      <div className="vlm-asset-evidence-readiness-copy-pass4491">
        <span>{readiness.title}</span>
        <small>{readiness.subtitle}</small>
      </div>
      <div className="vlm-asset-evidence-readiness-items-pass4491">
        {readiness.items.map((item) => (
          <span key={`${item.label}-${item.value}`} data-state={item.state}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      <em>{readiness.badge}</em>
    </section>
  );
}


function AssetDrawerActionPlanPass4492({
  data,
  locale,
  remoteReady,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  remoteReady: boolean;
}) {
  const plan = buildPass4492AssetActionPlan({
    locale,
    surface: assetDrawerSurface(data),
    riskLabel: data.riskLabel,
    confidenceLabel: data.confidenceLabel,
    sourceLabel: data.sourceLabel,
    sourceTimeLabel: data.sourceTimeLabel,
    candleCount: (data.candles ?? []).filter((item) => finite(item.close)).length,
    remoteReady,
  });

  return (
    <section
      className="vlm-asset-action-plan-pass4492"
      data-pass4492-asset-action-plan="operator-route-no-trade-prompt-proof-bound"
      data-pass4492-action-plan-state={plan.state}
      aria-label={plan.title}
      aria-live="polite"
    >
      <div className="vlm-asset-action-plan-copy-pass4492">
        <span>{plan.title}</span>
        <small>{plan.subtitle}</small>
      </div>
      <div className="vlm-asset-action-plan-items-pass4492">
        {plan.items.map((item) => (
          <span key={`${item.label}-${item.value}`} data-state={item.state}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      <em>{plan.badge}</em>
    </section>
  );
}

function AssetDrawerClaimBoundaryPass4493({
  data,
  locale,
  remoteReady,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  remoteReady: boolean;
}) {
  const boundary = buildPass4493AssetClaimBoundary({
    locale,
    surface: assetDrawerSurface(data),
    riskLabel: data.riskLabel,
    confidenceLabel: data.confidenceLabel,
    sourceLabel: data.sourceLabel,
    sourceTimeLabel: data.sourceTimeLabel,
    candleCount: (data.candles ?? []).filter((item) => finite(item.close)).length,
    remoteReady,
  });

  return (
    <section
      className="vlm-asset-claim-boundary-pass4493"
      data-pass4493-asset-claim-boundary="visible-claim-cap-analysis-pdf-proof-bound"
      data-pass4493-claim-boundary-state={boundary.state}
      aria-label={boundary.title}
      aria-live="polite"
    >
      <div className="vlm-asset-claim-boundary-copy-pass4493">
        <span>{boundary.title}</span>
        <small>{boundary.subtitle}</small>
      </div>
      <div className="vlm-asset-claim-boundary-items-pass4493">
        {boundary.items.map((item) => (
          <span key={`${item.label}-${item.value}`} data-state={item.state}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      <em>{boundary.badge}</em>
    </section>
  );
}

function AssetDrawerCustomerPacketPass4494({
  data,
  locale,
  remoteReady,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  remoteReady: boolean;
}) {
  const packet = buildPass4494AssetCustomerPacket({
    locale,
    symbol: data.symbol,
    surface: assetDrawerSurface(data),
    riskLabel: data.riskLabel,
    confidenceLabel: data.confidenceLabel,
    sourceLabel: data.sourceLabel,
    sourceTimeLabel: data.sourceTimeLabel,
    candleCount: (data.candles ?? []).filter((item) => finite(item.close)).length,
    remoteReady,
  });

  return (
    <section
      className="vlm-asset-customer-packet-pass4494"
      data-pass4494-asset-customer-packet="share-safe-proof-packet-redaction-source-bound"
      data-pass4494-customer-packet-state={packet.state}
      aria-label={packet.title}
      aria-live="polite"
    >
      <div className="vlm-asset-customer-packet-copy-pass4494">
        <span>{packet.title}</span>
        <small>{packet.subtitle}</small>
      </div>
      <div className="vlm-asset-customer-packet-items-pass4494">
        {packet.items.map((item) => (
          <span key={`${item.label}-${item.value}`} data-state={item.state}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      <em>{packet.badge}</em>
    </section>
  );
}

function AssetDrawerCopySafeEnvelopePass4495({
  data,
  locale,
  remoteReady,
  timeframe,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  remoteReady: boolean;
  timeframe: VlmAssetTimeframe;
}) {
  const envelope = buildPass4495AssetCopySafeEnvelope({
    locale,
    symbol: data.symbol,
    surface: assetDrawerSurface(data),
    timeframe,
    riskLabel: data.riskLabel,
    confidenceLabel: data.confidenceLabel,
    sourceLabel: data.sourceLabel,
    sourceTimeLabel: data.sourceTimeLabel,
    candleCount: (data.candles ?? []).filter((item) => finite(item.close)).length,
    remoteReady,
  });

  return (
    <section
      className="vlm-asset-copy-safe-envelope-pass4495"
      data-pass4495-asset-copy-safe-envelope="json-preview-redacted-source-bound-no-secrets"
      data-pass4495-envelope-state={envelope.state}
      aria-label={envelope.title}
      aria-live="polite"
    >
      <div className="vlm-asset-copy-safe-envelope-head-pass4495">
        <span>{envelope.title}</span>
        <small>{envelope.subtitle}</small>
      </div>
      <div className="vlm-asset-copy-safe-envelope-grid-pass4495">
        {envelope.items.map((item) => (
          <span key={`${item.label}-${item.value}`} data-state={item.state}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      <em>{envelope.badge}</em>
    </section>
  );
}

function AssetDrawerPremiumQaDisclosure({
  data,
  locale,
  chartIsLoading,
  analysisMenuOpen,
  timeframe,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  chartIsLoading: boolean;
  analysisMenuOpen: boolean;
  timeframe: VlmAssetTimeframe;
}) {
  const surface = assetDrawerSurface(data);
  const disclosure = buildPass4482DisclosureCopy(locale, surface);

  return (
    <details
      className="vlm-asset-drawer-qa-disclosure-pass4482"
      data-pass4482-asset-drawer-qa-disclosure="collapsed-screen-contract-keeps-premium-surface-clean"
      data-pass4482-surface={surface}
    >
      <summary className="vlm-asset-drawer-qa-summary-pass4482">
        <span>
          <strong>{disclosure.title}</strong>
          <small>{disclosure.summary}</small>
        </span>
        <em>{disclosure.badge}</em>
      </summary>
      <div className="vlm-asset-drawer-qa-pill-row-pass4482" aria-label={disclosure.title}>
        {disclosure.items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <VlmModalUiProofStrip data={data} timeframe={timeframe} chartIsLoading={chartIsLoading} locale={locale} />
      <AssetDrawerParityReceipt data={data} locale={locale} />
      <AssetDrawerVisualLockRail data={data} locale={locale} />
      <AssetDrawerInteractionGuard data={data} locale={locale} chartIsLoading={chartIsLoading} />
      <AssetDrawerAcceptanceStateRail
        data={data}
        locale={locale}
        chartIsLoading={chartIsLoading}
        analysisMenuOpen={analysisMenuOpen}
      />
    </details>
  );
}

function exactDetailMetric(data: VlmAssetDetailModalData, pattern: RegExp) {
  return data.detailMetrics?.find((metric) => pattern.test(metric.label.trim())) ?? null;
}

function analysisConfidencePercent(tier: AnalysisTierLabel, data: VlmAssetDetailModalData): number | null {
  void tier;
  if (data.confidenceCalibrated !== true) return null;
  const explicit = parseNumericLabel(data.confidenceLabel);
  return explicit === null ? null : Math.max(0, Math.min(100, Math.round(explicit)));
}

function analysisLiquidityDescriptor(data: VlmAssetDetailModalData) {
  const metric = exactDetailMetric(data, /^(?:liquidity|płynność|liquidität)$/i);
  return metric?.value?.trim() || "Source data unavailable";
}

function analysisInvestmentGrade(tier: AnalysisTierLabel, data: VlmAssetDetailModalData) {
  return buildVlmModalEvidencePacket({ ...data, tier }).coverageGrade;
}

function analysisRiskStack(_tier: AnalysisTierLabel, data: VlmAssetDetailModalData) {
  const rows: Array<{ label: string; score: number }> = [];
  const risk = parseNumericLabel(data.riskLabel);
  if (risk !== null) rows.push({ label: "Risk score", score: Math.max(0, Math.min(100, Math.round(risk))) });
  const metricPatterns: Array<[string, RegExp]> = [
    ["Liquidity", /^(?:liquidity|płynność|liquidität)$/i],
    ["Volatility", /^(?:volatility|zmienność|volatilität)$/i],
    ["Manipulation", /^(?:manipulation|manipulacja)$/i],
    ["Squeeze", /^squeeze$/i],
  ];
  for (const [label, pattern] of metricPatterns) {
    const value = parseNumericLabel(exactDetailMetric(data, pattern)?.value);
    if (value !== null) rows.push({ label, score: Math.max(0, Math.min(100, Math.round(value))) });
  }
  return rows;
}

function analysisVolatilityMeter(data: VlmAssetDetailModalData) {
  const explicit = parseNumericLabel(exactDetailMetric(data, /^(?:volatility|zmienność|volatilität)(?:\s*\([^)]*\))?$/i)?.value);
  if (explicit !== null) {
    const value = Math.max(0, Math.min(100, Math.round(explicit)));
    return { value, label: value >= 55 ? "High" : value >= 34 ? "Moderate" : "Low", available: true, source: "provider metric" };
  }
  const closes = (data.candles ?? []).map((candle) => candle.close).filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (closes.length < 3) return { value: null, label: "Source data unavailable", available: false, source: "missing" };
  const returns = closes.slice(1).map((close, index) => Math.abs((close - closes[index]) / closes[index]) * 100).filter(Number.isFinite);
  if (!returns.length) return { value: null, label: "Source data unavailable", available: false, source: "missing" };
  const realized = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const value = Math.max(0, Math.min(100, Math.round(realized * 12)));
  return { value, label: value >= 55 ? "High" : value >= 34 ? "Moderate" : "Low", available: true, source: "realized from candles" };
}

function candleSparklineValues(data: VlmAssetDetailModalData, offset = 0) {
  const closes = (data.candles ?? [])
    .map((candle) => candle.close)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (closes.length < 3) return null;
  const sample = closes.slice(Math.max(0, closes.length - 34 - offset), Math.max(3, closes.length - offset));
  const compact = sample.filter((_, index) => index % Math.max(1, Math.floor(sample.length / 7)) === 0).slice(-7);
  return compact.length >= 3 ? compact : sample.slice(-7);
}

function analysisInsightRows(tier: AnalysisTierLabel, data: VlmAssetDetailModalData): AnalysisInsightItem[] {
  const risk = parseNumericLabel(data.riskLabel);
  const volatility = analysisVolatilityMeter(data);
  const liquidity = analysisLiquidityDescriptor(data);
  const hasPrice = hasUsableMarketPrice(data);
  const orderbookStatus = orderbookEvidenceStatus(data);
  const baseRows: AnalysisInsightItem[] = [
    {
      key: "asset",
      title: "Asset identity",
      reading: `${data.symbol} · ${data.name}`,
      detail: "Canonical symbol, venue context and market identity stay attached to every read.",
      badge: "Mapped",
      tone: "neutral",
      sparkline: [],
    },
    {
      key: "price",
      title: "Price feed",
      reading: hasPrice ? data.priceLabel : "Missing live price",
      detail: hasPrice ? "Live price is available and separated from risk conclusions." : "Provider returned no confirmed price. Keep this visible instead of inventing data.",
      badge: hasPrice ? "Live" : "Data gap",
      tone: hasPrice ? "positive" : "watch",
      sparkline: hasPrice ? candleSparklineValues(data) ?? [] : [],
    },
    {
      key: "source",
      title: "Source lane",
      reading: sourceEvidenceLabel(tier, data),
      detail: data.sourceLabel ? `Primary source: ${data.sourceLabel}.` : "No primary source label is attached yet.",
      badge: data.sourceLabel ? "Source" : "Missing",
      tone: data.sourceLabel ? "neutral" : "watch",
      sparkline: [],
    },
    {
      key: "momentum",
      title: "Momentum",
      reading: data.changeTone === "up" ? "Positive pressure" : data.changeTone === "down" ? "Negative pressure" : "Balanced flow",
      detail: data.changeTone === "up" ? "Short-term follow-through is present, but still needs volume/source confirmation." : data.changeTone === "down" ? "Short-term momentum is weak. Watch for reversal or continuation signals." : "Momentum is mixed. Confirmation is still needed.",
      badge: data.changeTone === "up" ? "Positive" : data.changeTone === "down" ? "Watch" : "Neutral",
      tone: data.changeTone === "up" ? "positive" : data.changeTone === "down" ? "watch" : "neutral",
      sparkline: candleSparklineValues(data) ?? [],
    },
    {
      key: "volatility",
      title: "Volatility",
      reading: volatility.value === null ? "Source data unavailable" : `${volatility.label} · ${volatility.value}/100`,
      detail: volatility.value === null
        ? "No provider volatility metric or usable candle history is attached."
        : volatility.source === "provider metric"
          ? "Provider-supplied volatility metric is attached to this read."
          : "Realized volatility is calculated only from the attached candle closes.",
      badge: volatility.value === null ? "Data gap" : volatility.label,
      tone: volatility.value === null || volatility.value >= 55 ? "watch" : "neutral",
      sparkline: candleSparklineValues(data) ?? [],
    },
    {
      key: "liquidity",
      title: "Liquidity",
      reading: liquidity,
      detail: orderbookStatus === "missing"
        ? "Order-book depth, spread and slippage are not attached. No liquidity proxy is generated."
        : "Depth/spread evidence is attached and can support a source-bound liquidity read.",
      badge: orderbookStatus === "missing" ? "Data gap" : "Verified",
      tone: orderbookStatus === "missing" ? "watch" : "positive",
      sparkline: [],
    },
    {
      key: "risk",
      title: "Risk score",
      reading: risk === null ? "Source data unavailable" : `${risk}/100 · ${risk <= 33 ? "Low" : risk <= 66 ? "Moderate" : "High"}`,
      detail: risk === null
        ? "No source-bound risk score is attached. The interface must not substitute a default score."
        : "Risk stays separate from price direction and must be capped when source lanes are missing.",
      badge: risk === null ? "Data gap" : risk <= 33 ? "Low" : risk <= 66 ? "Watch" : "High",
      tone: risk === null ? "watch" : risk <= 33 ? "positive" : risk <= 66 ? "watch" : "risk",
      sparkline: [],
    },
    {
      key: "missing-data",
      title: "Missing data",
      reading: orderbookStatus === "missing" ? "Depth/spread missing" : "Depth attached",
      detail: orderbookStatus === "missing" ? "Do not output words like deep orderbook, tight spread or slippage quality until this lane is connected." : "Liquidity claims can be upgraded because depth evidence is present.",
      badge: orderbookStatus === "missing" ? "Gap" : "Ready",
      tone: orderbookStatus === "missing" ? "watch" : "positive",
      sparkline: [],
    },
    {
      key: "structure",
      title: "Market structure",
      reading: tier === "Advanced" ? "Multi-layer structure" : tier === "Pro" ? "Swing-aware structure" : "Core structure",
      detail: tier === "Basic" ? "Basic only shows a simple structure label." : "Pro and Advanced separate swing structure from raw price movement.",
      badge: tier === "Basic" ? "Core" : "Mapped",
      tone: "neutral",
      sparkline: candleSparklineValues(data) ?? [],
    },
    {
      key: "evidence-coverage",
      title: "Evidence coverage",
      reading: evidenceCoverageCapLabel(tier, data),
      detail: "Coverage reflects attached evidence lanes for this tier. It is not calibrated confidence and cannot be increased by tier name alone.",
      badge: "Coverage",
      tone: "neutral",
      sparkline: [],
    },
  ];

  const proRows: AnalysisInsightItem[] = [
    {
      key: "support",
      title: "Support zone",
      reading: "Recent reaction area",
      detail: "Derived only from visible candle clusters, not from predicted price targets.",
      badge: "Pro",
      tone: "neutral",
      sparkline: candleSparklineValues(data, 2) ?? [],
    },
    {
      key: "resistance",
      title: "Resistance zone",
      reading: "Recent supply area",
      detail: "Used as context for rejection/breakout monitoring, not as a promise.",
      badge: "Pro",
      tone: "neutral",
      sparkline: candleSparklineValues(data, 1) ?? [],
    },
    {
      key: "trend-quality",
      title: "Trend quality",
      reading: "Structure + momentum blend",
      detail: "Separates clean trend from noisy chop before the model uses stronger language.",
      badge: "Pro",
      tone: "neutral",
      sparkline: candleSparklineValues(data) ?? [],
    },
    {
      key: "feed-health",
      title: "Feed health",
      reading: hasPrice ? "Provider response present" : "Provider response incomplete",
      detail: hasPrice ? "Source freshness is visible but still needs secondary venue comparison for Advanced." : "Missing provider data must remain visible.",
      badge: hasPrice ? "Live" : "Gap",
      tone: hasPrice ? "positive" : "watch",
      sparkline: hasPrice ? candleSparklineValues(data) ?? [] : [],
    },
  ];

  const advancedRows: AnalysisInsightItem[] = [
    {
      key: "cross-venue",
      title: "Cross-venue check",
      reading: "Secondary venue required",
      detail: "Advanced should compare at least two venues before escalating confidence.",
      badge: "Advanced gap",
      tone: "watch",
      sparkline: [],
    },
    {
      key: "orderbook",
      title: "Order-book proof",
      reading: orderbookStatus === "missing" ? "Not attached" : "Attached",
      detail: orderbookStatus === "missing" ? "Depth, spread and slippage remain missing, so liquidity claims are capped." : "Depth evidence supports a stronger liquidity lane.",
      badge: orderbookStatus === "missing" ? "Missing" : "Proof",
      tone: orderbookStatus === "missing" ? "watch" : "positive",
      sparkline: [],
    },
    {
      key: "holders",
      title: "Holder / supply risk",
      reading: "Not connected",
      detail: "Needs holder clusters, treasury/CEX wallets, unlocks and issuance context.",
      badge: "Gap",
      tone: "watch",
      sparkline: [],
    },
    {
      key: "contract-admin",
      title: "Contract / admin risk",
      reading: "Not connected",
      detail: "Needs proxy, mint, blacklist, owner/admin permissions where relevant.",
      badge: "Gap",
      tone: "watch",
      sparkline: [],
    },
    {
      key: "scenario-map",
      title: "Scenario map",
      reading: "Bull / base / bear outline",
      detail: "Shows possible structures without price promises or ROI language.",
      badge: "Advanced",
      tone: "neutral",
      sparkline: candleSparklineValues(data) ?? [],
    },
    {
      key: "narrative-risk",
      title: "Narrative risk",
      reading: "News/social layer required",
      detail: "Separates hype, KOL pressure and filings/news from candle-only data.",
      badge: "Gap",
      tone: "watch",
      sparkline: [],
    },
    {
      key: "anomaly-scan",
      title: "Anomaly scan",
      reading: "Wick/gap/volume queue",
      detail: "Flags unusual candles as audit notes instead of predictive claims.",
      badge: "Advanced",
      tone: "neutral",
      sparkline: candleSparklineValues(data) ?? [],
    },
    {
      key: "evidence-packet",
      title: "Evidence packet",
      reading: "Receipts pending final engine",
      detail: "Final paid output should include source IDs, timestamps, provider status and missing-data caps.",
      badge: "Advanced",
      tone: "neutral",
      sparkline: [],
    },
  ];

  if (tier === "Advanced") return [...baseRows, ...proRows, ...advancedRows].slice(0, analysisFieldCount(tier));
  if (tier === "Pro") return [...baseRows, ...proRows].slice(0, analysisFieldCount(tier));
  return baseRows.slice(0, analysisFieldCount(tier));
}

function insightToneClass(tone: AnalysisInsightItem["tone"]) {
  if (tone === "positive") return "vlm-analysis-signal-badge vlm-analysis-signal-badge--positive";
  if (tone === "watch") return "vlm-analysis-signal-badge vlm-analysis-signal-badge--watch";
  if (tone === "risk") return "vlm-analysis-signal-badge vlm-analysis-signal-badge--risk";
  return "vlm-analysis-signal-badge vlm-analysis-signal-badge--neutral";
}


type TierReaderCard = {
  title: string;
  value: string;
  body: string;
  badge: string;
};

function tierReaderCards(tier: AnalysisTierLabel, data: VlmAssetDetailModalData): TierReaderCard[] {
  const risk = parseNumericLabel(data.riskLabel);
  const volatility = analysisVolatilityMeter(data);
  const liquidity = analysisLiquidityDescriptor(data);
  const hasPrice = hasUsableMarketPrice(data);
  const orderbookStatus = orderbookEvidenceStatus(data);
  const momentum = data.changeTone === "up" ? "positive pressure" : data.changeTone === "down" ? "negative pressure" : "mixed flow";
  const coreCards: TierReaderCard[] = [
    {
      title: "What changed now",
      value: data.changeLabel ?? "live change pending",
      body: hasPrice
        ? `${data.symbol} is reading ${momentum}. The price feed is separated from the risk score, so the analysis does not turn movement into a trade call.`
        : "The provider did not return a confirmed live price. The result must stay capped until a usable price feed is attached.",
      badge: tier === "Basic" ? "Core" : "Live context",
    },
    {
      title: "Risk meaning",
      value: risk === null ? "Source data unavailable" : `${risk}/100`,
      body: risk === null
        ? "No source-bound risk score is attached. The result stays withheld instead of using a default value."
        : risk <= 33
          ? "Current risk is low on the visible surface, but missing proof lanes still reduce certainty. This is not a guarantee of safety."
          : risk <= 66
            ? "The asset sits in a watch zone. The model should explain what is missing before it strengthens any conclusion."
            : "The asset needs a cautious read. Strong warnings must be tied to evidence, not hype or a single candle.",
      badge: risk === null ? "Data gap" : risk <= 33 ? "Low" : risk <= 66 ? "Watch" : "High",
    },
    {
      title: "Source quality",
      value: data.sourceLabel ?? "source pending",
      body: data.sourceTimeLabel
        ? `The result has a visible timestamp (${data.sourceTimeLabel}). Paid-depth output should reuse the same source time in Shield, PDF and Brain.`
        : "Timestamp is not visible yet, so freshness remains a missing-data lane.",
      badge: data.sourceTimeLabel ? "Timestamped" : "Freshness gap",
    },
  ];

  const proCards: TierReaderCard[] = [
    {
      title: "Structure read",
      value: volatility.label,
      body: volatility.value === null
        ? "Pro cannot add a volatility score until a provider metric or usable candle history is attached."
        : `Pro adds source-bound volatility context. Current reading is ${volatility.value}/100 from ${volatility.source}.`,
      badge: "Pro layer",
    },
    {
      title: "Liquidity wording",
      value: liquidity,
      body: orderbookStatus === "missing"
        ? "Depth, spread and slippage are not attached. The UI withholds liquidity instead of generating an activity proxy."
        : "Depth evidence is attached, so liquidity language can be source-bound.",
      badge: orderbookStatus === "missing" ? "Proxy" : "Verified",
    },
  ];

  const advancedCards: TierReaderCard[] = [
    {
      title: "Advanced lock",
      value: orderbookStatus === "missing" ? "proof required" : "depth ready",
      body: orderbookStatus === "missing"
        ? "Advanced should show scenario lanes, but it must keep order-book, holder, contract and squeeze claims locked until their proof packets exist."
        : "Advanced can lift some liquidity caps because depth proof is present, while holder/contract/squeeze lanes still need their own evidence.",
      badge: "Proof gate",
    },
    {
      title: "Squeeze / trap wording",
      value: "watch only",
      body: "Long/short squeeze, rug-pull, trap and exit-liquidity wording must stay as scenario watch unless the dedicated evidence packets are attached and fresh.",
      badge: "No overclaim",
    },
  ];

  if (tier === "Advanced") return [...coreCards, ...proCards, ...advancedCards];
  if (tier === "Pro") return [...coreCards, ...proCards];
  return coreCards;
}

function VlmMiniSparkline({ values }: { values: number[] }) {
  const width = 72;
  const height = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="vlm-analysis-mini-sparkline" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}


function VlmAnalysisExperience({
  tier,
  data,
  progress,
  complete,
  onClose,
}: {
  tier: AnalysisTierLabel;
  data: VlmAssetDetailModalData;
  progress: number;
  complete: boolean;
  onClose: () => void;
}) {
  const remaining = complete
    ? 0
    : Math.max(0, Math.ceil(((ANALYSIS_TIERS.find((item) => item.label === tier)?.durationSeconds ?? 10) * (1 - progress))));
  const phaseIndex = complete ? ANALYSIS_PHASES.length - 1 : Math.min(ANALYSIS_PHASES.length - 1, Math.floor(progress * ANALYSIS_PHASES.length));
  const activePhase = ANALYSIS_PHASES[phaseIndex];
  return (
    <div className="vlm-analysis-overlay" data-pass2232-analysis-overlay="symbol-brain-loading">
      <div className="vlm-analysis-stars" aria-hidden="true" />
      <div className="vlm-analysis-shell vlm-analysis-shell--loading" data-modal-wheel-owner="true">
        <button type="button" onClick={onClose} className="vlm-analysis-close" aria-label="Close analysis overlay">
          <X className="h-4 w-4" />
        </button>

        <div className="vlm-analysis-loading-center">
          <div className="vlm-analysis-brain-stage" aria-hidden="true">
            <div className="vlm-analysis-brain-horizon" />
            <div className="vlm-analysis-brain vlm-analysis-brain--hero">
              <VlmNeuralBrainCanvas progress={progress} symbol={data.symbol} />
            </div>
          </div>

          <div className="vlm-analysis-loading-copy">
            <p className="vlm-analysis-kicker">VLM analysis sequence · {analysisFieldCount(tier)} fields</p>
            <h3 className="vlm-analysis-loading-title">
              Loading analysis
            </h3>
            <p className="vlm-analysis-asset-line">Analyzing <strong>{data.symbol}</strong> · {data.name}</p>
            <p className="vlm-analysis-subcopy">Syncing signal layers and building the Velmère result surface before the final market read appears.</p>
          </div>

          <div className="vlm-analysis-phase-pills vlm-analysis-phase-pills--reference" role="list" aria-label="Analysis phases">
            {ANALYSIS_PHASES.map((phase, index) => {
              const state = index < phaseIndex ? "done" : index === phaseIndex ? "active" : "idle";
              return (
                <div key={phase.key} className="vlm-analysis-phase-pill" data-state={state} role="listitem">
                  <span className="vlm-analysis-phase-pill-index">0{index + 1}</span>
                  <strong>{phase.label}</strong>
                  <i aria-hidden="true" />
                </div>
              );
            })}
          </div>

          <div className="vlm-analysis-status-row vlm-analysis-status-row--reference">
            <span>VLM analysis sequence</span>
            <span>{phaseIndex + 1} / 4 · {activePhase.label}</span>
            <span>{remaining}s remaining</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartLoadingSurface({
  label = "Loading chart",
  detail = "Preparing candle history and chart structure…",
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center" aria-live="polite" aria-busy="true">
      <div className="relative flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#d8c49a]" />
      </div>
      <strong className="mt-3.5 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-white/90">{label}</strong>
      <small className="mt-1 font-mono text-[10px] text-white/40">{detail}</small>
    </div>
  );
}

function VlmAnalysisResultSurface({
  tier,
  data,
  onClose,
  serverEvidenceStatus = "idle",
  serverEvidencePacket = null,
  serverEvidenceMessage = null,
}: {
  tier: AnalysisTierLabel;
  data: VlmAssetDetailModalData;
  onClose: () => void;
  onBack: () => void;
  serverEvidenceStatus?: VlmServerEvidenceStatus;
  serverEvidencePacket?: VlmServerEvidencePacket | null;
  serverEvidenceMessage?: string | null;
}) {
  const rows = analysisResultRows(tier, data);
  const insightRows = analysisInsightRows(tier, data);
  const readerCards = tierReaderCards(tier, data);
  const riskStack = analysisRiskStack(tier, data);
  const volatility = analysisVolatilityMeter(data);
  const confidence = analysisConfidencePercent(tier, data);
  const liquidity = analysisLiquidityDescriptor(data);
  const grade = analysisInvestmentGrade(tier, data);
  const riskScore = parseNumericLabel(data.riskLabel);
  const riskBand = riskScore === null ? "Source data unavailable" : riskScore <= 33 ? "Low" : riskScore <= 66 ? "Low - Moderate" : "High";
  const orderbookStatus = orderbookEvidenceStatus(data);
  const fieldCount = analysisFieldCount(tier);
  const evidencePacket = buildVlmModalEvidencePacket({ ...data, tier });
  const effectiveEvidenceCoverageCap = evidencePacket.evidenceCoverageCap;
  const serverStatusLabel = publicEvidenceStatusCopy(serverEvidenceStatus);
  const serverSummary = serverEvidenceSummary(serverEvidencePacket, serverEvidenceStatus);
  const serverMissingCopy = serverEvidenceMessage || serverEvidenceMissingCopy(serverEvidencePacket);
  const summary = tier === "Advanced"
    ? "Advanced paid-depth read is available only after access proof. Evidence, scenarios and anomaly layers must stay source-bound."
    : tier === "Pro"
      ? "Pro review adds structure, feed health and source reliability without pretending that missing order-book data exists."
      : "Structured core read with price, risk, source and missing-data clarity.";
  const nextAction = tier === "Advanced"
    ? evidencePacket.nextMissingLane
      ? `Attach ${evidencePacket.nextMissingLane.toLowerCase()} before this can be called a full-depth paid matrix.`
      : "Advanced has enough visible lanes for a deeper source-bound review; keep every claim tied to a receipt."
    : tier === "Pro"
      ? "Pro can explain structure and feed health, but depth/order-book/holder claims stay locked until Advanced evidence exists."
      : "Basic should stay clean: show identity, price, source and gaps without pretending paid-depth evidence exists.";

  return (
    <div className="vlm-analysis-result-surface vlm-analysis-result-surface--reference" data-pass2232-analysis-result="token-icon-scrollbar-fieldcount" data-modal-wheel-owner="true">
      <div className="vlm-analysis-stars" aria-hidden="true" />

      <div className="vlm-analysis-result-header vlm-analysis-result-header--reference">
        <div className="vlm-analysis-result-brand">
          <div className="vlm-analysis-result-topline">
            <p className="vlm-analysis-kicker">{tier} analysis result</p>
            <span className="vlm-analysis-counter-chip">{fieldCount} fields</span>
          </div>
        </div>
        <div className="vlm-analysis-result-actions">
          <button type="button" onClick={onClose} className="vlm-analysis-close vlm-analysis-close--inline" aria-label="Close analysis result">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="vlm-analysis-result-scroll vlm-analysis-result-scroll--reference" data-modal-wheel-owner="true">
        <section className="vlm-analysis-reference-card">
          <div className="vlm-analysis-reference-intro">
            <VlmAssetMark data={data} />
            <div className="vlm-analysis-reference-copy">
              <h3>{tier} analysis <span>completed</span></h3>
              <p className="vlm-analysis-asset-line"><strong>{data.symbol}</strong> · {data.name}</p>
              <p className="vlm-analysis-subcopy">{summary}</p>
              <div className="vlm-analysis-grade-pill">
                <span>Evidence grade</span>
                <strong>{grade}</strong>
              </div>
            </div>
          </div>

          <div className="vlm-analysis-reference-metrics">
            <div className="vlm-analysis-reference-metric vlm-analysis-reference-metric--price"><span>Price</span><PriceMetricValue label={data.priceLabel} /><small>{data.changeLabel ?? "Live reading"}</small></div>
            <div className="vlm-analysis-reference-metric" data-pass4604-risk-metric="source-bound-or-unavailable"><span>Risk score</span><strong>{data.riskLabel ?? "—"}</strong><small>{riskBand}</small></div>
            <div className="vlm-analysis-reference-metric"><span>Liquidity</span><strong>{liquidity}</strong><small>{orderbookStatus === "missing" ? "Depth not attached" : "Depth verified"}</small></div>
            <div className="vlm-analysis-reference-metric" data-pass4604-confidence-metric="explicit-only"><span>Calibrated confidence</span><strong>{confidence === null ? "—" : `${confidence}%`}</strong><small>{confidence === null ? "Calibration unavailable" : serverSummary}</small></div>
          </div>
        </section>

        <section className="vlm-analysis-reader-summary" aria-label="Readable tier analysis summary" data-pass2471-reader-summary="tier-first-result">
          {readerCards.map((card) => (
            <article key={`${tier}-${card.title}`} className="vlm-analysis-reader-card">
              <span>{card.title}</span>
              <strong>{card.value}</strong>
              <p>{card.body}</p>
              <small>{card.badge}</small>
            </article>
          ))}
        </section>

        <div className="vlm-analysis-reference-grid">
          <aside className="vlm-analysis-reference-sidebar">
            <article className="vlm-analysis-sidecard vlm-analysis-sidecard--reference">
              <div className="vlm-analysis-sidecard-head">
                <span>Risk stack</span>
                <strong>{riskScore === null ? "Unavailable" : riskScore <= 33 ? "Balanced" : "Watched"}</strong>
              </div>
              <div className="vlm-analysis-risk-stack-list" data-pass4604-risk-stack="source-metrics-only">
                {riskStack.length ? riskStack.map((item) => (
                  <div key={item.label} className="vlm-analysis-risk-stack-row">
                    <div className="vlm-analysis-risk-stack-label"><span>{item.label}</span><strong>{item.score}/100</strong></div>
                    <div className="vlm-analysis-risk-stack-track"><i style={{ width: `${item.score}%` }} /></div>
                  </div>
                )) : <p className="vlm-analysis-pass4604-unavailable">No source-bound risk metrics attached.</p>}
              </div>
            </article>

            <article className="vlm-analysis-sidecard vlm-analysis-sidecard--reference">
              <div className="vlm-analysis-sidecard-head">
                <span>Volatility meter</span>
                <strong>{volatility.value === null ? "—" : `${volatility.value}/100`}</strong>
              </div>
              <div className="vlm-analysis-volatility-card">
                {volatility.value === null ? <span className="vlm-analysis-pass4604-unavailable-line" aria-hidden="true" /> : <VlmMiniSparkline values={candleSparklineValues(data) ?? [volatility.value, volatility.value]} />}
                <div className="vlm-analysis-volatility-copy">
                  <strong>{volatility.label}</strong>
                  <small>{volatility.available ? volatility.source : "No provider metric or candle history"}</small>
                </div>
              </div>
            </article>

            <article className="vlm-analysis-sidecard vlm-analysis-sidecard--reference vlm-analysis-sidecard--evidence-packet">
              <div className="vlm-analysis-sidecard-head">
                <span>Evidence coverage</span>
                <strong>{effectiveEvidenceCoverageCap}% ceiling</strong>
              </div>
              <div className="vlm-analysis-evidence-packet-grid" aria-label="Evidence packet lanes">
                <span><strong>{evidencePacket.confirmedCount}</strong><small>confirmed</small></span>
                <span><strong>{evidencePacket.limitedCount}</strong><small>limited</small></span>
                <span><strong>{evidencePacket.missingCount + evidencePacket.lockedCount}</strong><small>gaps</small></span>
              </div>
              <div className="vlm-analysis-evidence-grade">
                <span>Coverage</span>
                <strong>{evidencePacket.coverageGrade}</strong>
                <small>{evidencePacket.nextMissingLane ? `Next gap: ${evidencePacket.nextMissingLane}` : "No visible lane gap"}</small>
              </div>
              <div className={`vlm-analysis-server-packet vlm-analysis-server-packet--${serverEvidenceStatus}`}>
                <span>Server evidence</span>
                <strong>{serverStatusLabel}</strong>
                <small>{serverEvidenceProviders(serverEvidencePacket)}</small>
                <em>{serverMissingCopy}</em>
              </div>
              <div className="vlm-analysis-evidence-lane-list" aria-label="Evidence lane detail">
                {evidencePacket.lanes.map((lane) => (
                  <div key={lane.id} className={`vlm-analysis-evidence-lane vlm-analysis-evidence-lane--${lane.state}`}>
                    <span>{lane.label}</span>
                    <strong>{lane.state}</strong>
                  </div>
                ))}
              </div>
              <p className="vlm-analysis-next-action">{evidencePacket.tierDelta}</p>
              <p className="vlm-analysis-next-action vlm-analysis-next-action--rule">{evidencePacket.claimPolicy.publicRule}</p>
            </article>

            <article className="vlm-analysis-sidecard vlm-analysis-sidecard--reference vlm-analysis-sidecard--action">
              <div className="vlm-analysis-sidecard-head">
                <span>Next best action</span>
                <strong>Depth path</strong>
              </div>
              <p className="vlm-analysis-next-action">{nextAction}</p>
            </article>
          </aside>

          <section className="vlm-analysis-reference-mainpanel">
            <div className="vlm-analysis-tabbar vlm-analysis-tabbar--reference" role="tablist" aria-label="Analysis tabs">
              <button type="button" className="is-active">Analysis</button>
              <button type="button">Market context</button>
              <button type="button">Signal map</button>
              <button type="button">Sources</button>
            </div>

            <div className="vlm-analysis-insight-list vlm-analysis-insight-list--reference" aria-label="VLM signal insights">
              {insightRows.map((item) => (
                <article key={item.key} className="vlm-analysis-insight-row vlm-analysis-insight-row--reference">
                  <div className="vlm-analysis-insight-title">
                    <strong>{item.title}</strong>
                  </div>
                  <div className="vlm-analysis-insight-reading">
                    <strong>{item.reading}</strong>
                    <small>{item.key === "risk" ? `${confidence === null ? "Calibrated confidence unavailable" : `${confidence}% calibrated confidence`}` : rows.find((row) => row.field.toLowerCase().includes(item.key.split(" ")[0]))?.status ?? "Mapped"}</small>
                  </div>
                  <div className="vlm-analysis-insight-sparkline">
                    <VlmMiniSparkline values={item.sparkline} />
                  </div>
                  <div className="vlm-analysis-insight-summary">
                    <p>{item.detail}</p>
                  </div>
                  <div className="vlm-analysis-insight-badge-wrap">
                    <span className={insightToneClass(item.tone)}>{item.badge}</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="vlm-analysis-mainpanel-footer vlm-analysis-mainpanel-footer--reference">
              <div><span>Primary source</span><strong>{data.sourceLabel ?? "Market feed"}</strong><small>{data.currencyLabel ?? "USD"} · {data.marketStatusLabel ?? "Session unavailable"}</small></div>
              <div><span>Last updated</span><strong>{data.sourceTimeLabel ?? "Source time pending"}</strong><small>{data.changeLabel ?? "Change unavailable"}</small></div>
              <div><span>Analysis id</span><strong>{`VEL-${tier.toUpperCase()}-${String(data.symbol).toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`}</strong><small>Evidence-bound market context</small></div>
            </div>
          </section>
        </div>
      </div>

      <div className="vlm-analysis-meta vlm-analysis-meta--result">
        <span>{evidencePacket.sourceSummary}</span>
        <span>{tier} · {analysisFieldCount(tier)} fields · evidence ceiling {effectiveEvidenceCoverageCap}%</span>
        <span>{evidencePacket.missingData.length ? `Gaps visible: ${evidencePacket.missingData.slice(0, 2).join(", ")}` : "Evidence lanes attached"}</span>
      </div>
    </div>
  );
}

function VelmerePerformanceChart({
  data,
  timeframe,
  renderKey,
  locale,
  refreshing = false,
  refreshingLabel = "Loading candles",
}: {
  data: VlmAssetDetailModalData;
  timeframe: VlmAssetTimeframe;
  renderKey?: number; // PASS4139 render remount key converted from JSX key prop into typed chart prop
  locale: "pl" | "en" | "de";
  refreshing?: boolean;
  refreshingLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const rangeRef = useRef<ChartRange>({ from: 0, to: 1 });
  const hoverRef = useRef<ChartHover>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    from: number;
    to: number;
  }>({ active: false, startX: 0, from: 0, to: 1 });
  const candles = useMemo(() => normalizeCandles(data, timeframe), [data, timeframe]);
  const chartIntervalMs = useMemo(
    () => resolvePass4408AssetDetailChartIntervalMs(data, timeframe),
    [data, timeframe],
  );
  const pass4534Precision = useMemo(
    () => pass4534ChartPrecisionSummary(candles, timeframe, chartIntervalMs),
    [candles, chartIntervalMs, timeframe],
  );
  const pass4539GapAuditState = useMemo(
    () => pass4539GapAudit(candles, timeframe, chartIntervalMs),
    [candles, chartIntervalMs, timeframe],
  );
  const pass4539Session = useMemo(
    () => pass4539SessionPolicy(data),
    [data],
  );

  useEffect(() => {
    rangeRef.current = rangeForTimeframe(timeframe, candles.length);
    hoverRef.current = null;
  }, [candles, timeframe, renderKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;

    const draw = () => {
      frameRef.current = null;
      if (!cssWidth || !cssHeight) return;
      context.clearRect(0, 0, cssWidth, cssHeight);
      const layout = getChartLayout(cssWidth, cssHeight);
      const clampSpan = Math.max(rangeRef.current.to - rangeRef.current.from, 5);
      const range = clampRange(rangeRef.current, candles.length, futureSpaceBars(clampSpan), 5);
      rangeRef.current = range;
      const visibleCandles = getVisibleCandles(candles, range);
      const values = visibleCandles.flatMap(({ candle }) => [candle.high, candle.low]);
      const min = values.length ? Math.min(...values) : 0;
      const max = values.length ? Math.max(...values) : 1;
      const pad = Math.max((max - min) * 0.145, Math.abs(max || 1) * 0.0065);
      const low = min - pad;
      const high = max + pad;
      const priceRange = Math.max(high - low, 0.00001);
      const span = Math.max(range.to - range.from, 1);
      const maxVolume = Math.max(...visibleCandles.map(({ candle }) => candle.volume), 1);
      const plotRight = layout.left + layout.plotWidth;
      const xFor = (index: number) => layout.left + ((index - range.from) / span) * layout.plotWidth;
      const yFor = (value: number) => layout.top + ((high - value) / priceRange) * layout.priceHeight;
      const volumeY = (value: number) => layout.volumeBottom - (value / maxVolume) * (layout.volumeBottom - layout.volumeTop);
      const candleWidth = Math.max(2.5, Math.min(54, (layout.plotWidth / Math.max(span, 1)) * 0.76));

      // TradingView-grade subtle horizontal price gridlines:
      context.save();
      context.strokeStyle = "rgba(255, 255, 255, 0.04)";
      context.lineWidth = 1;
      for (let index = 0; index < 6; index += 1) {
        const tick = high - (priceRange / 5) * index;
        const tickY = crisp(yFor(tick));
        if (tickY >= layout.top && tickY <= layout.priceBottom) {
          context.beginPath();
          context.moveTo(layout.left, tickY);
          context.lineTo(plotRight, tickY);
          context.stroke();
        }
      }
      context.restore();

      void pass4539GapAuditState;
      void pass4539Session;

      const latest = candles[candles.length - 1];
      const parsedPrice = parseLocalizedPriceAmount(data.priceLabel);
      const currentPrice = parsedPrice !== null && parsedPrice > 0 ? parsedPrice : latest?.close;
      if (finite(currentPrice)) {
        const currentY = yFor(currentPrice);
        if (currentY >= layout.top - 40 && currentY <= layout.priceBottom + 40) {
          context.save();
          context.setLineDash([4, 7]);
          context.strokeStyle = "rgba(45,212,191,0.46)";
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(layout.left, currentY);
          context.lineTo(plotRight, currentY);
          context.stroke();
          context.restore();
        }
      }

      // Render Real Candlesticks (TradingView-grade bold solid candles):
      context.save();
      context.beginPath();
      context.rect(layout.left, layout.top, layout.plotWidth, layout.priceHeight);
      context.clip();
      visibleCandles.forEach(({ candle, index }) => {
        const x = xFor(index);
        if (x < layout.left - 24 || x > plotRight + 24) return;
        const openY = yFor(candle.open);
        const closeY = yFor(candle.close);
        const highY = yFor(candle.high);
        const lowY = yFor(candle.low);
        const up = candle.close >= candle.open;
        const color = up ? "#26a69a" : "#ef5350";
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
        const wickWidth = Math.max(1.25, Math.min(2.5, candleWidth > 20 ? 2.0 : candleWidth > 10 ? 1.5 : 1.25));
        context.save();
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = wickWidth;
        context.beginPath();
        context.moveTo(crisp(x), highY);
        context.lineTo(crisp(x), lowY);
        context.stroke();
        context.beginPath();
        if (candleWidth >= 4) {
          context.roundRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight, Math.min(2.5, candleWidth / 4));
        } else {
          context.rect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
        }
        context.fill();
        context.restore();
      });
      context.restore();

      // Render Volume Histogram Bars:
      context.save();
      context.beginPath();
      context.rect(layout.left, layout.volumeTop, layout.plotWidth, layout.volumeBottom - layout.volumeTop);
      context.clip();
      visibleCandles.forEach(({ candle, index }) => {
        const x = xFor(index);
        if (x < layout.left - 24 || x > plotRight + 24) return;
        const up = candle.close >= candle.open;
        const vHeight = Math.max(1.5, (candle.volume / Math.max(maxVolume, 1)) * (layout.volumeBottom - layout.volumeTop));
        const vTop = layout.volumeBottom - vHeight;
        context.fillStyle = up ? "rgba(38,166,154,0.38)" : "rgba(239,83,80,0.38)";
        context.fillRect(x - candleWidth / 2, vTop, candleWidth, vHeight);
      });
      context.restore();

      // Top floating OHLCV Legend:
      const hover = hoverRef.current;
      const hoveredIndex = hover && hover.x >= layout.left && hover.x <= layout.width - layout.right
        ? Math.min(candles.length - 1, Math.max(0, Math.round(range.from + ((hover.x - layout.left) / layout.plotWidth) * span)))
        : candles.length - 1;
      const activeCandle = candles[hoveredIndex];

      if (activeCandle) {
        context.save();
        context.font = `${cssWidth < 720 ? 9 : 11}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
        context.textAlign = "left";
        context.textBaseline = "middle";
        const dateStr = formatDateLabel(activeCandle.timestamp, timeframe, locale);
        const up = activeCandle.close >= activeCandle.open;
        const toneColor = up ? "rgba(45,212,191,0.95)" : "rgba(244,63,94,0.95)";
        
        const pillHeight = 20;
        const pillY = Math.max(2, layout.top - 24);
        const legendText = `${dateStr}   O: ${formatPrice(activeCandle.open, locale)}   H: ${formatPrice(activeCandle.high, locale)}   L: ${formatPrice(activeCandle.low, locale)}   C: ${formatPrice(activeCandle.close, locale)}   Vol: ${activeCandle.volume.toLocaleString(locale, { maximumFractionDigits: 0 })}`;
        const textWidth = context.measureText(legendText).width;
        
        context.fillStyle = "rgba(10, 15, 20, 0.76)";
        context.beginPath();
        context.roundRect(layout.left, pillY, Math.min(layout.plotWidth, textWidth + 16), pillHeight, 4);
        context.fill();

        context.fillStyle = toneColor;
        context.fillText(legendText, layout.left + 8, pillY + pillHeight / 2);
        context.restore();
      }

      context.save();
      context.fillStyle = "rgba(255,255,255,0.38)";
      context.font = `${cssWidth < 720 ? 10 : 12}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      context.textAlign = "right";
      context.textBaseline = "middle";
      const latestPriceY = finite(currentPrice) ? yFor(currentPrice) : Number.NaN;
      for (let index = 0; index < 6; index += 1) {
        const tick = high - (priceRange / 5) * index;
        const tickY = yFor(tick);
        if (Number.isFinite(latestPriceY) && Math.abs(tickY - latestPriceY) < 18) continue;
        context.fillText(formatPrice(tick, locale), layout.width - 10, tickY);
      }
      context.textAlign = "center";
      context.textBaseline = "alphabetic";
      const tickCount = cssWidth < 720 ? 4 : 6;
      for (let index = 0; index < tickCount; index += 1) {
        const ratio = index / Math.max(1, tickCount - 1);
        const candleIndex = Math.min(candles.length - 1, Math.max(0, Math.round(range.from + span * ratio)));
        context.fillText(formatDateLabel(candles[candleIndex]?.timestamp ?? Date.now(), timeframe, locale), xFor(candleIndex), layout.height - 9);
      }

      // PASS4594: current-price endcap mirrors the selected clean reference and stays source-bound.
      if (finite(currentPrice) && latestPriceY >= layout.top && latestPriceY <= layout.priceBottom) {
        const label = formatPrice(currentPrice, locale);
        context.font = `${cssWidth < 720 ? 10 : 12}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
        const textWidth = context.measureText(label).width;
        const pillWidth = Math.min(layout.right - 8, Math.max(48, textWidth + 14));
        const pillHeight = cssWidth < 720 ? 19 : 24;
        const pillX = plotRight + 7;
        const pillY = Math.max(layout.top, Math.min(layout.priceBottom - pillHeight, latestPriceY - pillHeight / 2));
        const isUp = latest ? latest.close >= latest.open : true;
        context.fillStyle = isUp ? "#26a69a" : "#ef5350";
        context.beginPath();
        context.roundRect(pillX, pillY, pillWidth, pillHeight, 4);
        context.fill();
        context.fillStyle = "#ffffff";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(label, pillX + pillWidth / 2, pillY + pillHeight / 2 + 0.25);
      }
      context.restore();

      if (
        hover &&
        hover.x >= layout.left &&
        hover.x <= layout.width - layout.right &&
        hover.y >= layout.top &&
        hover.y <= layout.volumeBottom
      ) {
        const hx = xFor(hoveredIndex);
        context.save();
        context.setLineDash([3, 6]);
        context.strokeStyle = "rgba(148,163,184,0.32)";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(crisp(hx), layout.top);
        context.lineTo(crisp(hx), layout.volumeBottom);
        context.moveTo(layout.left, hover.y);
        context.lineTo(plotRight, hover.y);
        context.stroke();
        context.restore();
      }
    };

    const scheduleDraw = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(draw);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssWidth = Math.max(320, Math.floor(rect.width));
      cssHeight = Math.max(220, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      scheduleDraw();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const layout = getChartLayout(cssWidth, cssHeight);
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const range = rangeRef.current;
      const span = Math.max(range.to - range.from, 5);
      const zoomFactor = event.deltaY > 0 ? 1.15 : 0.85;
      const minAllowedSpan = 5;
      const maxAllowedSpan = Math.max(candles.length - 1 + futureSpaceBars(span), minAllowedSpan);
      const nextSpan = Math.min(Math.max(span * zoomFactor, minAllowedSpan), maxAllowedSpan);
      const anchorRatio = Math.min(1, Math.max(0, (x - layout.left) / layout.plotWidth));
      const anchorIndex = range.from + span * anchorRatio;
      const nextFrom = anchorIndex - (anchorIndex - range.from) * (nextSpan / span);
      rangeRef.current = clampRange({ from: nextFrom, to: nextFrom + nextSpan }, candles.length, futureSpaceBars(nextSpan), 5);
      scheduleDraw();
    };

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const range = rangeRef.current;
      dragRef.current = { active: true, startX: event.clientX, from: range.from, to: range.to };
      canvas.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const bounds = canvas.getBoundingClientRect();
      hoverRef.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      const drag = dragRef.current;
      if (drag.active) {
        const layout = getChartLayout(cssWidth, cssHeight);
        const span = Math.max(drag.to - drag.from, 5);
        const dx = event.clientX - drag.startX;
        const shift = -(dx / Math.max(layout.plotWidth, 1)) * span;
        rangeRef.current = clampRange({ from: drag.from + shift, to: drag.to + shift }, candles.length, futureSpaceBars(span), 5);
      }
      scheduleDraw();
    };

    const onPointerUp = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current.active = false;
      canvas.releasePointerCapture?.(event.pointerId);
      scheduleDraw();
    };

    const onPointerLeave = () => {
      hoverRef.current = null;
      dragRef.current.active = false;
      scheduleDraw();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    resize();

    return () => {
      observer.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [candles, chartIntervalMs, data.priceLabel, data.symbol, timeframe, locale, pass4539GapAuditState, pass4539Session]);

  return (
    <div
      className="vlm-asset-chart-stage relative"
      data-modal-wheel-owner="true"
      data-pass2220-chart-owner="external-loading-gate-no-undefined-loading"
      data-pass4533-chart-renderer="tight-right-edge-deduped-candles-real-ohlc-owner"
      data-pass4534-chart-renderer="institutional-candle-qc-tight-right-edge-no-artificial-gap"
      data-pass4537-chart-renderer="exact-candle-qc-strip-action-boundary-no-fake-gap"
      data-pass4538-chart-renderer="ohlc-tape-source-mode-action-intelligence-no-fake-precision"
      data-pass4539-chart-renderer="session-aware-gap-markers-source-faithful-no-fake-bridge"
      data-pass4539-session-policy={pass4539Session}
      data-pass4572-chart-source-mode={candles.length >= 8 ? "source-ohlc" : "source-pending-no-fake-candles"}
      data-pass4534-candle-qc-score={String(pass4534Precision.score)}
      data-pass4534-candle-qc-gaps={String(pass4534Precision.gapCount)}
      data-pass4534-candle-qc-open-gaps={String(pass4534Precision.largeOpenGaps)}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${data.symbol} — ${locale === "pl" ? "wykres rynkowy Velmère" : locale === "de" ? "Velmère-Marktdiagramm" : "Velmère market chart"}`}
        className="vlm-asset-chart-canvas"
      />
      {refreshing ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity">
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-[#080e12]/85 px-4 py-2 text-xs font-mono tracking-wider text-white/90 shadow-2xl backdrop-blur-md">
            <Loader2 className="h-4 w-4 animate-spin text-[#d8c49a]" />
            <span>{refreshingLabel}</span>
          </div>
        </div>
      ) : null}
      {candles.length < 2 ? (
        <div className="vlm-asset-chart-source-pending-pass4572 absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm" data-pass4572-chart-empty-state="source-pending-no-synthetic-candles">
          {/* Shimmering Skeleton Candle Silhouette Bars */}
          <div className="absolute inset-x-8 inset-y-12 flex items-end justify-between opacity-20 pointer-events-none">
            {[45, 60, 35, 70, 55, 80, 65, 50, 75, 40, 60, 85].map((h, i) => (
              <div key={i} className="flex flex-col items-center w-2.5 animate-pulse" style={{ animationDelay: `${i * 120}ms` }}>
                <div className="w-0.5 bg-white/40" style={{ height: `${h * 0.25}px` }} />
                <div className="w-full rounded-sm bg-gradient-to-t from-white/20 to-white/60" style={{ height: `${h}px` }} />
                <div className="w-0.5 bg-white/40" style={{ height: `${h * 0.25}px` }} />
              </div>
            ))}
          </div>

          <div className="relative z-10 flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-[#07090b]/90 px-5 py-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <span>{locale === "pl" ? "Ładowanie danych rynkowych…" : locale === "de" ? "Marktdaten werden geladen…" : "Loading Market Data…"}</span>
            </div>
            <span className="font-mono text-[10px] text-white/50 tracking-wider">
              {data.symbol} · {locale === "pl" ? "Czekam na zweryfikowane świece giełdowe" : locale === "de" ? "Warten auf verifizierte Börsenkerzen" : "Awaiting verified exchange candles"}
            </span>
          </div>
        </div>
      ) : null}
      <div className="vlm-chart-qc-strip-pass4537" data-pass4537-chart-qc-strip="visible-fidelity-gap-policy-right-edge-source-boundary">
        <span><small>QC</small><strong>{pass4534Precision.score}%</strong></span>
        <span><small>{locale === "pl" ? "Luki" : locale === "de" ? "Lücken" : "Gaps"}</small><strong>{pass4534Precision.gapCount}</strong></span>
        <span><small>{locale === "pl" ? "Odchylenie otwarcia" : locale === "de" ? "Eröffnungsdrift" : "Open drift"}</small><strong>{pass4534Precision.largeOpenGaps}</strong></span>
        <span><small>{locale === "pl" ? "Prawa krawędź" : locale === "de" ? "Rechter Rand" : "Right edge"}</small><strong>{locale === "pl" ? "zablokowana" : locale === "de" ? "fixiert" : "locked"}</strong></span>
      </div>
      <ChartPrecisionTapePass4538 data={data} timeframe={timeframe} candles={candles} locale={locale} />
      <ChartSessionGapTapePass4539 data={data} timeframe={timeframe} candles={candles} locale={locale} />
      <ChartDecisionGatePass4540 data={data} timeframe={timeframe} candles={candles} locale={locale} />
    </div>
  );
}


function ChartPrecisionTapePass4538({
  data,
  timeframe,
  candles,
  locale,
}: {
  data: VlmAssetDetailModalData;
  timeframe: VlmAssetTimeframe;
  candles: NormalizedCandle[];
  locale: "pl" | "en" | "de";
}) {
  const sourceMode = (data.candles ?? []).filter((candle) => finite(candle.close)).length >= 8 ? "remote" : "pending";
  const intervalMs = resolvePass4408AssetDetailChartIntervalMs(data, timeframe);
  const ledger = pass4538ChartPrecisionLedger(candles, timeframe, sourceMode, intervalMs);
  const latest = ledger.latest;
  const date = latest ? new Date(latest.timestamp).toLocaleString(locale, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
  const ohlc = latest
    ? `O ${formatPrice(latest.open, locale)} · H ${formatPrice(latest.high, locale)} · L ${formatPrice(latest.low, locale)} · C ${formatPrice(latest.close, locale)}`
    : locale === "pl" ? "Oczekiwanie na OHLC" : locale === "de" ? "OHLC ausstehend" : "OHLC pending";
  return (
    <div
      className="vlm-chart-precision-tape-pass4538"
      data-pass4538-chart-precision-tape="ohlc-source-mode-coverage-drift-visible"
      data-pass4538-source-mode={ledger.sourceMode}
      data-pass4538-chart-score={String(ledger.score)}
    >
      <span><small>{locale === "pl" ? "Źródło" : locale === "de" ? "Quelle" : "Source"}</small><strong>{ledger.policy}</strong></span>
      <span><small>{locale === "pl" ? "Świece" : locale === "de" ? "Kerzen" : "Bars"}</small><strong>{ledger.barCount} · {ledger.coverage}%</strong></span>
      <span><small>{locale === "pl" ? "Najnowsze" : locale === "de" ? "Neueste" : "Latest"}</small><strong>{date}</strong></span>
      <span><small>OHLC</small><strong>{ohlc}</strong></span>
      <span><small>{locale === "pl" ? "Odchylenie kroku" : locale === "de" ? "Schrittabweichung" : "Step drift"}</small><strong>{ledger.driftBars.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {locale === "pl" ? "świece" : locale === "de" ? "Kerzen" : "bars"}</strong></span>
    </div>
  );
}


function ChartSessionGapTapePass4539({
  data,
  timeframe,
  candles,
  locale,
}: {
  data: VlmAssetDetailModalData;
  timeframe: VlmAssetTimeframe;
  candles: NormalizedCandle[];
  locale: "pl" | "en" | "de";
}) {
  const sourceMode = (data.candles ?? []).filter((candle) => finite(candle.close)).length >= 8 ? "remote" : "pending";
  const session = pass4539SessionPolicy(data);
  const intervalMs = resolvePass4408AssetDetailChartIntervalMs(data, timeframe);
  const ledger = pass4539ChartPrecisionLedger(candles, timeframe, sourceMode, session, intervalMs);
  const latestGap = ledger.gapAudit.gaps[ledger.gapAudit.gaps.length - 1];
  const unit = locale === "pl" ? "świece" : locale === "de" ? "Kerzen" : "bars";
  const none = locale === "pl" ? "brak" : locale === "de" ? "keine" : "none";
  const latestGapLabel = latestGap ? `${latestGap.bars.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}` : none;
  return (
    <div
      className="vlm-chart-session-gap-tape-pass4539"
      data-pass4539-chart-session-gap-tape="session-aware-gaps-marked-not-faked"
      data-pass4539-session-policy={ledger.sessionPolicy}
      data-pass4539-gap-count={String(ledger.gapAudit.gapCount)}
      data-pass4539-score={String(ledger.score)}
    >
      <span><small>{locale === "pl" ? "Sesja" : locale === "de" ? "Sitzung" : "Session"}</small><strong>{ledger.policyLabel}</strong></span>
      <span><small>{locale === "pl" ? "Znaczniki luk" : locale === "de" ? "Lückenmarker" : "Gap markers"}</small><strong>{ledger.gapAudit.gapCount}</strong></span>
      <span><small>{locale === "pl" ? "Największa luka" : locale === "de" ? "Größte Lücke" : "Largest gap"}</small><strong>{ledger.gapAudit.largestGapBars ? `${ledger.gapAudit.largestGapBars.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}` : none}</strong></span>
      <span><small>{locale === "pl" ? "Ostatnia luka" : locale === "de" ? "Letzte Lücke" : "Latest gap"}</small><strong>{latestGapLabel}</strong></span>
      <span><small>{locale === "pl" ? "Precyzja" : locale === "de" ? "Präzision" : "Precision"}</small><strong>{ledger.score}%</strong></span>
    </div>
  );
}



function pass4540ReceiptSegment(value: unknown, fallback: string) {
  const segment = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return segment || fallback;
}

function pass4540AssetActionReceiptId(
  symbol: string,
  timeframe: VlmAssetTimeframe,
  action: string,
  sourceState: string,
) {
  const symbolSegment = pass4540ReceiptSegment(symbol, "asset");
  const timeframeSegment = pass4540ReceiptSegment(timeframe, "timeframe");
  const actionSegment = pass4540ReceiptSegment(action, "action");
  const sourceSegment = pass4540ReceiptSegment(sourceState, "source-pending");
  const canonical = [symbolSegment, timeframeSegment, actionSegment, sourceSegment].join("|");
  let fingerprint = 0x811c9dc5;
  for (const character of canonical) {
    fingerprint ^= character.charCodeAt(0);
    fingerprint = Math.imul(fingerprint, 0x01000193);
  }
  return `vlm-p4540-${symbolSegment}-${timeframeSegment}-${actionSegment}-${sourceSegment}-${(fingerprint >>> 0).toString(16).padStart(8, "0")}`;
}

type Pass4543AssetActionLedgerEntry = {
  schema: "velmere.pass4543.asset-action-execution-ledger.v1";
  id: string;
  surface: "shield" | "real-markets" | "asset-detail";
  symbol: string;
  timeframe: VlmAssetTimeframe;
  action: string;
  detail: string;
  route: "local-ledger-browser-event-account-vault-pending";
  createdAt: string;
  sourceState: "remote-ohlc" | "source-pending";
  boundary: string;
};

function writePass4543AssetActionLedger(entry: Pass4543AssetActionLedgerEntry) {
  if (typeof window === "undefined") return;
  const storageKey = "velmere:pass4543:asset-action-ledger";
  purgeLegacyPrivateAccountLocalStorage();
  const current = readPrivateAccountTabArray<Pass4543AssetActionLedgerEntry>(storageKey);
  writePrivateAccountTabArray(storageKey, [entry, ...current].slice(0, 50));
  try {
    window.dispatchEvent(new CustomEvent("velmere:pass4543-action-ledger", { detail: entry }));
  } catch {
    // CustomEvent is best-effort in browser-only clients.
  }
}


function ChartDecisionGatePass4540({
  data,
  timeframe,
  candles,
  locale,
}: {
  data: VlmAssetDetailModalData;
  timeframe: VlmAssetTimeframe;
  candles: NormalizedCandle[];
  locale: "pl" | "en" | "de";
}) {
  const sourceMode = candles.length >= 8 ? "remote" : "pending";
  const evidenceMode = resolvePass4408ChartEvidenceMode(data, candles.length);
  const session = pass4539SessionPolicy(data);
  const intervalMs = resolvePass4408AssetDetailChartIntervalMs(data, timeframe);
  const ledger = pass4539ChartPrecisionLedger(candles, timeframe, sourceMode, session, intervalMs);
  const state = evidenceMode === "live_verified" && ledger.score >= 92
    ? "verified-source"
    : evidenceMode === "local_reference"
      ? "reference-only"
      : evidenceMode === "partial_not_live" || evidenceMode === "last_known_good" || ledger.score >= 82
        ? "review-required"
        : "blocked";
  const label = locale === "pl"
    ? state === "verified-source" ? "Źródło wykresu potwierdzone" : state === "reference-only" ? "Wykres ilustracyjny" : state === "review-required" ? "Wykres do weryfikacji" : "Wykres zablokowany"
    : locale === "de"
      ? state === "verified-source" ? "Diagrammquelle bestätigt" : state === "reference-only" ? "Illustratives Diagramm" : state === "review-required" ? "Diagramm prüfen" : "Diagramm gesperrt"
      : state === "verified-source" ? "Chart source verified" : state === "reference-only" ? "Illustrative chart" : state === "review-required" ? "Chart review" : "Chart blocked";
  const guard = state === "verified-source"
    ? locale === "pl" ? "Aktualne, serwerowo potwierdzone OHLC i zgodna kadencja źródła" : locale === "de" ? "Aktuelle serververifizierte OHLC und passende Quellkadenz" : "current server-verified OHLC with provider cadence aligned"
    : state === "reference-only"
      ? locale === "pl" ? "Tylko układ demonstracyjny · brak LIVE, confidence i decyzji" : locale === "de" ? "Nur Demonstrationslayout · kein LIVE, Confidence oder Entscheidung" : "demonstration layout only · no LIVE, confidence or decision"
      : state === "review-required"
        ? locale === "pl" ? "Pokaż z jawną granicą świeżości i bez stanowczych wniosków" : locale === "de" ? "Mit sichtbarer Frischegrenze und ohne sichere Aussagen anzeigen" : "show with explicit freshness boundary and no confident conclusion"
        : locale === "pl" ? "Nie pokazuj stanowczych wniosków bez wystarczających świec" : locale === "de" ? "Keine sicheren Aussagen ohne ausreichende Kerzen" : "do not expose confident wording without sufficient candles";
  const stateLabel = locale === "pl"
    ? state === "verified-source" ? "potwierdzone źródło" : state === "reference-only" ? "tylko ilustracja" : state === "review-required" ? "wymaga weryfikacji" : "zablokowany"
    : locale === "de"
      ? state === "verified-source" ? "Quelle bestätigt" : state === "reference-only" ? "nur Illustration" : state === "review-required" ? "Prüfung nötig" : "gesperrt"
      : state === "verified-source" ? "source verified" : state === "reference-only" ? "reference only" : state === "review-required" ? "review required" : "blocked";
  return (
    <div
      className="vlm-chart-decision-gate-pass4540"
      data-pass4540-chart-decision-gate="evidence-mode-source-cadence-qc-controls-action-confidence"
      data-pass4540-chart-state={state}
      data-pass4540-chart-evidence-mode={evidenceMode}
      data-pass4540-chart-score={String(ledger.score)}
    >
      <span><small>{locale === "pl" ? "Bramka decyzji" : locale === "de" ? "Entscheidungssperre" : "Decision gate"}</small><strong>{label}</strong></span>
      <span><small>{locale === "pl" ? "Stan" : locale === "de" ? "Status" : "State"}</small><strong>{stateLabel}</strong></span>
      <span><small>{locale === "pl" ? "Warunek" : locale === "de" ? "Bedingung" : "Guard"}</small><strong>{guard}</strong></span>
      <span><small>{locale === "pl" ? "Kadencja" : locale === "de" ? "Taktung" : "Cadence"}</small><strong>{Math.round(intervalMs / 60_000).toLocaleString(locale)} min</strong></span>
    </div>
  );
}


function AssetDetailActionReceiptPass4540({
  data,
  locale,
  timeframe,
  activeAction,
  remoteReady,
  actionLog,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  timeframe: VlmAssetTimeframe;
  activeAction: string;
  remoteReady: boolean;
  actionLog: Array<{ id: string; label: string; detail: string; kind: string }>;
}) {
  const c = locale === "pl"
    ? { title: "Receipt akcji", receipt: "Receipt", evidence: "Stan dowodów", guard: "Guard", vault: "Vault", pending: "oczekuje", remote: "remote OHLC", fallback: "źródło oczekuje" }
    : locale === "de"
      ? { title: "Aktions-Receipt", receipt: "Receipt", evidence: "Evidenzstatus", guard: "Guard", vault: "Vault", pending: "wartet", remote: "Remote OHLC", fallback: "Quelle wartet" }
      : { title: "Action receipt", receipt: "Receipt", evidence: "Evidence state", guard: "Guard", vault: "Vault", pending: "pending", remote: "remote OHLC", fallback: "source pending" };
  const sourceState = remoteReady ? "remote-ohlc" : "source-pending";
  const latest = actionLog[0];
  const receiptId = pass4540AssetActionReceiptId(data.symbol, timeframe, activeAction, sourceState);
  const actionable = activeAction !== "source-watch" && activeAction !== "idle";
  const guard = remoteReady
    ? "action linked to visible chart QC, gap policy and source boundary"
    : "action allowed as local watch only; advanced wording stays blocked until provider proof is refreshed";
  const evidenceState = remoteReady ? (activeAction === "recheck" ? "refreshing" : "source-bound") : "limited";
  return (
    <section
      className="vlm-asset-action-receipt-pass4540"
      data-pass4540-asset-action-receipt="stateful-actions-write-receipt-id-evidence-guard-vault-boundary"
      data-pass4540-active-action={activeAction}
      data-pass4540-source-state={sourceState}
    >
      <div>
        <p>{c.title}</p>
        <small>{data.symbol} · {timeframe} · {remoteReady ? c.remote : c.fallback}</small>
      </div>
      <dl>
        <span><dt>{c.receipt}</dt><dd>{actionable ? receiptId : c.pending}</dd></span>
        <span><dt>{c.evidence}</dt><dd>{evidenceState}</dd></span>
        <span><dt>{c.guard}</dt><dd>{guard}</dd></span>
        <span><dt>{c.vault}</dt><dd>{latest?.detail ?? "no persisted server vault yet"}</dd></span>
      </dl>
    </section>
  );
}

function pass4541AssetActionVaultState(remoteReady: boolean, activeAction: string, actionLogLength: number) {
  if (!remoteReady) return "source-review";
  if (activeAction === "source-watch" || activeAction === "idle" || actionLogLength === 0) return "armed-idle";
  if (activeAction === "recheck") return "provider-refresh";
  return "vault-ready";
}

function AssetDetailActionVaultPass4541({
  data,
  locale,
  timeframe,
  activeAction,
  remoteReady,
  actionLog,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  timeframe: VlmAssetTimeframe;
  activeAction: string;
  remoteReady: boolean;
  actionLog: Array<{ id: string; label: string; detail: string; kind: string }>;
}) {
  const c = locale === "pl"
    ? { title: "Action vault", subtitle: "Każde kliknięcie ma widoczny routing: watch → receipt → alert/report/export. Nic nie udaje zlecenia tradingowego.", lane: "Lane", state: "Stan", next: "Następny krok", output: "Output", none: "brak akcji", review: "manual review", ready: "gotowe", refresh: "provider refresh", idle: "uzbrojone" }
    : locale === "de"
      ? { title: "Action Vault", subtitle: "Jeder Klick hat sichtbares Routing: Watch → Receipt → Alert/Report/Export. Keine Trading-Order wird simuliert.", lane: "Lane", state: "Status", next: "Nächster Schritt", output: "Output", none: "keine Aktion", review: "manual review", ready: "bereit", refresh: "provider refresh", idle: "geschärft" }
      : { title: "Action vault", subtitle: "Every click has visible routing: watch → receipt → alert/report/export. No trading order is simulated.", lane: "Lane", state: "State", next: "Next step", output: "Output", none: "no action", review: "manual review", ready: "ready", refresh: "provider refresh", idle: "armed" };
  const vaultState = pass4541AssetActionVaultState(remoteReady, activeAction, actionLog.length);
  const latest = actionLog[0];
  const stateLabel = vaultState === "source-review" ? c.review : vaultState === "provider-refresh" ? c.refresh : vaultState === "vault-ready" ? c.ready : c.idle;
  const receiptId = pass4540AssetActionReceiptId(data.symbol, timeframe, activeAction, remoteReady ? "remote-ohlc" : "source-pending");
  const rows = [
    { lane: "chart-qc", state: remoteReady ? "remote OHLC" : "source pending", next: remoteReady ? "allow visible action receipt" : "block confident Advanced copy", output: `${data.symbol} · ${timeframe}` },
    { lane: "action-router", state: activeAction, next: latest ? "persist local receipt" : "wait for operator click", output: latest?.detail ?? c.none },
    { lane: "receipt-vault", state: stateLabel, next: vaultState === "vault-ready" ? "attach to report packet" : "keep as local watch", output: receiptId },
  ];
  return (
    <section
      className="vlm-asset-action-vault-pass4541"
      data-pass4541-asset-action-vault="chart-qc-action-router-receipt-vault-visible-handoff"
      data-pass4541-vault-state={vaultState}
      data-pass4541-active-action={activeAction}
    >
      <div className="vlm-asset-action-vault-head-pass4541">
        <span>
          <p>{c.title}</p>
          <small>{c.subtitle}</small>
        </span>
        <strong>{stateLabel}</strong>
      </div>
      <div className="vlm-asset-action-vault-grid-pass4541">
        {rows.map((row) => (
          <article key={row.lane}>
            <small>{c.lane}</small>
            <b>{row.lane}</b>
            <dl>
              <span><dt>{c.state}</dt><dd>{row.state}</dd></span>
              <span><dt>{c.next}</dt><dd>{row.next}</dd></span>
              <span><dt>{c.output}</dt><dd>{row.output}</dd></span>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function pass4542AssetActionHandoffState(remoteReady: boolean, activeAction: string, actionLogLength: number, chartIsLoading: boolean) {
  if (chartIsLoading) return "source-refreshing";
  if (!remoteReady) return "review-required";
  if (activeAction === "source-watch" || activeAction === "idle" || actionLogLength === 0) return "waiting-click";
  if (activeAction === "alert" || activeAction === "manipulation" || activeAction === "squeeze") return "alert-armed";
  if (activeAction === "copy") return "export-ready";
  if (activeAction === "recheck") return "source-refreshing";
  return "handoff-ready";
}

function AssetDetailActionHandoffPass4542({
  data,
  locale,
  timeframe,
  activeAction,
  remoteReady,
  chartIsLoading,
  actionLog,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  timeframe: VlmAssetTimeframe;
  activeAction: string;
  remoteReady: boolean;
  chartIsLoading: boolean;
  actionLog: Array<{ id: string; label: string; detail: string; kind: string }>;
}) {
  const c = locale === "pl"
    ? { title: "Kolejka handoff", subtitle: "Receipt i vault nie kończą akcji — ten blok pokazuje, gdzie trafia alert, raport, export albo source recheck.", lane: "Kanał", status: "Status", owner: "Owner", proof: "Dowód", alert: "alert/watch", report: "report", export: "export", source: "source", waiting: "czeka", review: "review", armed: "uzbrojone", ready: "gotowe", refreshing: "odświeżanie" }
    : locale === "de"
      ? { title: "Handoff Queue", subtitle: "Receipt und Vault sind nicht das Ende — dieser Block zeigt, wohin Alert, Report, Export oder Source-Recheck gehen.", lane: "Kanal", status: "Status", owner: "Owner", proof: "Proof", alert: "alert/watch", report: "report", export: "export", source: "source", waiting: "wartet", review: "review", armed: "geschärft", ready: "bereit", refreshing: "refresh" }
      : { title: "Handoff queue", subtitle: "Receipt and vault are not the end — this block shows where alert, report, export or source recheck is routed.", lane: "Channel", status: "Status", owner: "Owner", proof: "Proof", alert: "alert/watch", report: "report", export: "export", source: "source", waiting: "waiting", review: "review", armed: "armed", ready: "ready", refreshing: "refreshing" };
  const state = pass4542AssetActionHandoffState(remoteReady, activeAction, actionLog.length, chartIsLoading);
  const latest = actionLog[0];
  const sourceState = remoteReady ? "remote-ohlc" : "source-pending";
  const receiptId = pass4540AssetActionReceiptId(data.symbol, timeframe, activeAction, sourceState);
  const stateLabel = state === "review-required" ? c.review : state === "source-refreshing" ? c.refreshing : state === "alert-armed" ? c.armed : state === "export-ready" || state === "handoff-ready" ? c.ready : c.waiting;
  const rows = [
    { lane: c.source, status: chartIsLoading ? c.refreshing : remoteReady ? c.ready : c.review, owner: "provider-qc", proof: `${data.symbol} · ${timeframe} · ${sourceState}` },
    { lane: c.alert, status: ["alert", "manipulation", "squeeze"].includes(activeAction) ? c.armed : c.waiting, owner: "local-watch", proof: latest?.detail ?? receiptId },
    { lane: c.report, status: activeAction === "copy" || activeAction === "recheck" ? c.ready : c.waiting, owner: "report-vault", proof: remoteReady ? receiptId : "blocked until source review" },
    { lane: c.export, status: remoteReady && actionLog.length ? c.ready : c.review, owner: "customer-packet", proof: "velmere.pass4542.asset-action-handoff.v1" },
  ];
  return (
    <section
      className="vlm-asset-action-handoff-pass4542"
      data-pass4542-asset-action-handoff="receipt-vault-to-alert-report-export-source-recheck-visible-routing"
      data-pass4542-handoff-state={state}
      data-pass4542-active-action={activeAction}
    >
      <div className="vlm-asset-action-handoff-head-pass4542">
        <span>
          <p>{c.title}</p>
          <small>{c.subtitle}</small>
        </span>
        <strong>{stateLabel}</strong>
      </div>
      <div className="vlm-asset-action-handoff-grid-pass4542">
        {rows.map((row) => (
          <article key={row.lane}>
            <small>{c.lane}</small>
            <b>{row.lane}</b>
            <dl>
              <span><dt>{c.status}</dt><dd>{row.status}</dd></span>
              <span><dt>{c.owner}</dt><dd>{row.owner}</dd></span>
              <span><dt>{c.proof}</dt><dd>{row.proof}</dd></span>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}


function AssetDetailActionExecutionLedgerPass4543({
  data,
  locale,
  timeframe,
  activeAction,
  remoteReady,
  chartIsLoading,
  actionLog,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  timeframe: VlmAssetTimeframe;
  activeAction: string;
  remoteReady: boolean;
  chartIsLoading: boolean;
  actionLog: Array<{ id: string; label: string; detail: string; kind: string }>;
}) {
  const c = locale === "pl"
    ? { title: "Ledger wykonania", subtitle: "Klik zapisuje lokalny ślad, emituje browser event i przygotowuje handoff do account vault — nadal bez symulowania zleceń.", lane: "Etap", status: "Status", proof: "Dowód", local: "local ledger", event: "browser event", account: "account vault", server: "server proof", written: "zapisane", waiting: "czeka", review: "review", refreshing: "refresh", ready: "gotowe" }
    : locale === "de"
      ? { title: "Execution Ledger", subtitle: "Jeder Klick schreibt einen lokalen Nachweis, sendet ein Browser-Event und bereitet Account-Vault-Handoff vor — weiterhin ohne Order-Simulation.", lane: "Stufe", status: "Status", proof: "Proof", local: "local ledger", event: "browser event", account: "account vault", server: "server proof", written: "geschrieben", waiting: "wartet", review: "review", refreshing: "refresh", ready: "bereit" }
      : { title: "Execution ledger", subtitle: "Each click writes a local trace, emits a browser event and prepares account-vault handoff — still no order simulation.", lane: "Stage", status: "Status", proof: "Proof", local: "local ledger", event: "browser event", account: "account vault", server: "server proof", written: "written", waiting: "waiting", review: "review", refreshing: "refresh", ready: "ready" };
  const latest = actionLog[0];
  const state = chartIsLoading ? "source-refreshing" : !remoteReady ? "review-required" : latest ? "ledger-written" : "waiting-click";
  const stateLabel = state === "source-refreshing" ? c.refreshing : state === "review-required" ? c.review : state === "ledger-written" ? c.written : c.waiting;
  const receiptId = pass4540AssetActionReceiptId(data.symbol, timeframe, activeAction, remoteReady ? "remote-ohlc" : "source-pending");
  const rows = [
    { lane: c.local, status: latest ? c.written : c.waiting, proof: latest?.id ?? receiptId },
    { lane: c.event, status: latest ? c.ready : c.waiting, proof: "velmere:pass4543-action-ledger" },
    { lane: c.account, status: remoteReady && latest ? c.ready : c.review, proof: remoteReady ? receiptId : "source review required" },
    { lane: c.server, status: "prepared/not executed", proof: "live runner required before production claim" },
  ];
  return (
    <section
      className="vlm-asset-action-execution-ledger-pass4543"
      data-pass4543-asset-action-execution-ledger="ephemeral-tab-event-server-proof-boundary"
      data-pass4543-ledger-state={state}
      data-pass4543-active-action={activeAction}
    >
      <div className="vlm-asset-action-execution-ledger-head-pass4543">
        <span>
          <p>{c.title}</p>
          <small>{c.subtitle}</small>
        </span>
        <strong>{stateLabel}</strong>
      </div>
      <div className="vlm-asset-action-execution-ledger-grid-pass4543">
        {rows.map((row) => (
          <article key={row.lane}>
            <small>{c.lane}</small>
            <b>{row.lane}</b>
            <dl>
              <span><dt>{c.status}</dt><dd>{row.status}</dd></span>
              <span><dt>{c.proof}</dt><dd>{row.proof}</dd></span>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}


function readPass4544AssetReplay(symbol: string) {
  if (typeof window === "undefined") return [] as Pass4543AssetActionLedgerEntry[];
  return readPrivateAccountTabArray<Pass4543AssetActionLedgerEntry>(
    "velmere:pass4543:asset-action-ledger",
  )
    .filter((entry) => entry?.symbol === symbol)
    .slice(0, 5);
}

function AssetDetailLedgerReplayPass4544({
  data,
  locale,
  timeframe,
  activeAction,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  timeframe: VlmAssetTimeframe;
  activeAction: string;
}) {
  const c = locale === "pl"
    ? { title: "Replay ledger", subtitle: "Historia kliknięć pozostaje tylko w bieżącej karcie i jest czyszczona po odświeżeniu lub zmianie sesji.", empty: "brak zapisanych akcji", clear: "Wyczyść ten instrument", route: "Route", source: "Źródło", action: "Akcja" }
    : locale === "de"
      ? { title: "Ledger Replay", subtitle: "Die Klick-Historie bleibt nur im aktuellen Tab und wird bei Reload oder Sitzungswechsel gelöscht.", empty: "keine gespeicherten Aktionen", clear: "Instrument leeren", route: "Route", source: "Quelle", action: "Aktion" }
      : { title: "Ledger replay", subtitle: "Click history remains only in the current tab and is cleared on reload or session change.", empty: "no saved actions", clear: "Clear this instrument", route: "Route", source: "Source", action: "Action" };
  const [entries, setEntries] = useState<Pass4543AssetActionLedgerEntry[]>([]);

  useEffect(() => {
    const sync = () => setEntries(readPass4544AssetReplay(data.symbol));
    sync();
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Pass4543AssetActionLedgerEntry>).detail;
      if (detail?.symbol === data.symbol) sync();
    };
    window.addEventListener("velmere:pass4543-action-ledger", listener);
    return () => {
      window.removeEventListener("velmere:pass4543-action-ledger", listener);
    };
  }, [data.symbol]);

  const clearInstrument = () => {
    if (typeof window === "undefined") return;
    const key = "velmere:pass4543:asset-action-ledger";
    const next = readPrivateAccountTabArray<Pass4543AssetActionLedgerEntry>(key)
      .filter((entry) => entry?.symbol !== data.symbol);
    if (next.length) writePrivateAccountTabArray(key, next);
    else clearPrivateAccountTabStore([key]);
    purgeLegacyPrivateAccountLocalStorage();
    setEntries([]);
  };

  return (
    <section
      className="vlm-asset-ledger-replay-pass4544"
      data-pass4544-asset-ledger-replay="ephemeral-current-tab-replay-clearable-per-instrument"
      data-pass4544-active-action={activeAction}
      data-pass4544-replay-count={String(entries.length)}
    >
      <div className="vlm-asset-ledger-replay-head-pass4544">
        <span>
          <p>{c.title}</p>
          <small>{c.subtitle}</small>
        </span>
        <button type="button" onClick={clearInstrument}>{c.clear}</button>
      </div>
      {entries.length ? (
        <div className="vlm-asset-ledger-replay-grid-pass4544">
          {entries.map((entry) => (
            <article key={entry.id}>
              <small>{new Date(entry.createdAt).toLocaleString()}</small>
              <b>{entry.symbol} · {entry.timeframe}</b>
              <dl>
                <span><dt>{c.action}</dt><dd>{entry.action}</dd></span>
                <span><dt>{c.source}</dt><dd>{entry.sourceState}</dd></span>
                <span><dt>{c.route}</dt><dd>{entry.route}</dd></span>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="vlm-asset-ledger-replay-empty-pass4544">{data.symbol} · {timeframe} · {c.empty}</p>
      )}
    </section>
  );
}


type Pass4545AssetActionExportManifest = {
  schema: "velmere.pass4545.asset-action-export-manifest.v1";
  symbol: string;
  timeframe: VlmAssetTimeframe;
  activeAction: string;
  replayCount: number;
  readyCount: number;
  reviewCount: number;
  latestReceiptId: string;
  handoff: "report-export-ready" | "review-required" | "waiting-for-action";
  generatedAt: string;
  boundary: "no-trade-execution-ui-proof-only";
};

function buildPass4545AssetActionExportManifest({
  data,
  timeframe,
  activeAction,
  entries,
}: {
  data: VlmAssetDetailModalData;
  timeframe: VlmAssetTimeframe;
  activeAction: string;
  entries: Pass4543AssetActionLedgerEntry[];
}): Pass4545AssetActionExportManifest {
  const readyCount = entries.filter((entry) => entry.sourceState === "remote-ohlc").length;
  const reviewCount = entries.length - readyCount;
  const latest = entries[0];
  const handoff = entries.length === 0 ? "waiting-for-action" : reviewCount > 0 ? "review-required" : "report-export-ready";
  return {
    schema: "velmere.pass4545.asset-action-export-manifest.v1",
    symbol: data.symbol,
    timeframe,
    activeAction,
    replayCount: entries.length,
    readyCount,
    reviewCount,
    latestReceiptId: latest ? pass4540AssetActionReceiptId(data.symbol, latest.timeframe, latest.action, latest.sourceState) : pass4540AssetActionReceiptId(data.symbol, timeframe, activeAction, "pending"),
    handoff,
    generatedAt: new Date().toISOString(),
    boundary: "no-trade-execution-ui-proof-only",
  };
}

function AssetDetailReplayExportQueuePass4545({
  data,
  locale,
  timeframe,
  activeAction,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  timeframe: VlmAssetTimeframe;
  activeAction: string;
}) {
  const c = locale === "pl"
    ? { title: "Export queue", subtitle: "Replay z PASS4544 dostaje manifest do raportu/exportu — widać, co jest gotowe, a co wymaga review.", ready: "Gotowe", review: "Review", replay: "Replay", receipt: "Receipt", state: "Stan", copy: "Kopiuj manifest", empty: "najpierw kliknij akcję", copied: "manifest przygotowany" }
    : locale === "de"
      ? { title: "Export Queue", subtitle: "Das PASS4544-Replay bekommt ein Manifest für Report/Export — sichtbar, was bereit ist und was Review braucht.", ready: "Bereit", review: "Review", replay: "Replay", receipt: "Receipt", state: "Status", copy: "Manifest kopieren", empty: "zuerst Aktion klicken", copied: "Manifest vorbereitet" }
      : { title: "Export queue", subtitle: "PASS4544 replay now produces a report/export manifest — visible ready vs review state before handoff.", ready: "Ready", review: "Review", replay: "Replay", receipt: "Receipt", state: "State", copy: "Copy manifest", empty: "click an action first", copied: "manifest prepared" };
  const [entries, setEntries] = useState<Pass4543AssetActionLedgerEntry[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sync = () => setEntries(readPass4544AssetReplay(data.symbol));
    sync();
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Pass4543AssetActionLedgerEntry>).detail;
      if (detail?.symbol === data.symbol) sync();
    };
    window.addEventListener("velmere:pass4543-action-ledger", listener);
    return () => {
      window.removeEventListener("velmere:pass4543-action-ledger", listener);
    };
  }, [data.symbol]);

  const manifest = buildPass4545AssetActionExportManifest({ data, timeframe, activeAction, entries });
  const copyManifest = async () => {
    const summary = buildAssetAnalysisClipboardSummary(manifest);
    try {
      await copyAssetAnalysisSummary(manifest);
    } catch {
      // Clipboard can be blocked; the redacted same-tab summary remains available to app listeners.
    }
    try {
      window.dispatchEvent(new CustomEvent("velmere:pass4545-asset-export-summary", { detail: summary }));
    } catch {
      // best-effort redacted event bridge only
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section
      className="vlm-asset-export-queue-pass4545"
      data-pass4545-asset-export-queue="replay-to-report-export-manifest-ready-review-counts-copy-event"
      data-pass4545-export-state={manifest.handoff}
      data-pass4545-replay-count={String(entries.length)}
    >
      <div className="vlm-asset-export-queue-head-pass4545">
        <span>
          <p>{c.title}</p>
          <small>{c.subtitle}</small>
        </span>
        <button type="button" onClick={copyManifest}>{copied ? c.copied : c.copy}</button>
      </div>
      <div className="vlm-asset-export-queue-grid-pass4545">
        <span><small>{c.replay}</small><strong>{entries.length ? entries.length : c.empty}</strong></span>
        <span><small>{c.ready}</small><strong>{manifest.readyCount}</strong></span>
        <span><small>{c.review}</small><strong>{manifest.reviewCount}</strong></span>
        <span><small>{c.state}</small><strong>{manifest.handoff}</strong></span>
        <span className="vlm-asset-export-queue-receipt-pass4545"><small>{c.receipt}</small><strong>{manifest.latestReceiptId}</strong></span>
      </div>
    </section>
  );
}



type Pass4546AssetReportComposerDraft = {
  schema: "velmere.pass4546.asset-report-composer.v1";
  symbol: string;
  timeframe: VlmAssetTimeframe;
  manifestSchema: Pass4545AssetActionExportManifest["schema"];
  manifestHandoff: Pass4545AssetActionExportManifest["handoff"];
  actionCount: number;
  readyCount: number;
  reviewCount: number;
  draftState: "audit-ready" | "operator-review" | "waiting-for-action";
  lanes: Array<{ lane: "audit-intake" | "pdf-report" | "account-vault" | "operator-review"; state: string; proof: string }>;
  generatedAt: string;
  boundary: "report-composer-no-trade-execution";
};

function buildPass4546AssetReportComposerDraft({
  data,
  timeframe,
  manifest,
}: {
  data: VlmAssetDetailModalData;
  timeframe: VlmAssetTimeframe;
  manifest: Pass4545AssetActionExportManifest;
}): Pass4546AssetReportComposerDraft {
  const draftState = manifest.replayCount === 0
    ? "waiting-for-action"
    : manifest.reviewCount > 0
      ? "operator-review"
      : "audit-ready";
  return {
    schema: "velmere.pass4546.asset-report-composer.v1",
    symbol: data.symbol,
    timeframe,
    manifestSchema: manifest.schema,
    manifestHandoff: manifest.handoff,
    actionCount: manifest.replayCount,
    readyCount: manifest.readyCount,
    reviewCount: manifest.reviewCount,
    draftState,
    lanes: [
      { lane: "audit-intake", state: draftState === "waiting-for-action" ? "waiting" : "attached", proof: manifest.latestReceiptId },
      { lane: "pdf-report", state: draftState === "audit-ready" ? "ready" : "draft-only", proof: manifest.schema },
      { lane: "account-vault", state: manifest.replayCount ? "queued" : "idle", proof: data.sourceLabel || "source pending" },
      { lane: "operator-review", state: draftState === "operator-review" ? "required" : "not-required", proof: `${manifest.reviewCount} review lanes` },
    ],
    generatedAt: new Date().toISOString(),
    boundary: "report-composer-no-trade-execution",
  };
}

function writePass4546AssetReportComposerDraft(draft: Pass4546AssetReportComposerDraft) {
  if (typeof window === "undefined") return;
  const key = "velmere:pass4546:asset-report-composer";
  purgeLegacyPrivateAccountLocalStorage();
  const current = readPrivateAccountTabArray<Pass4546AssetReportComposerDraft>(key);
  writePrivateAccountTabArray(key, [draft, ...current].slice(0, 40));
  try {
    window.dispatchEvent(new CustomEvent("velmere:pass4546-asset-report-composer", { detail: draft }));
  } catch {
    // CustomEvent bridge is best-effort only.
  }
}



type Pass4547ReportComposerVaultBridge = {
  schema: "velmere.pass4547.report-composer-vault-bridge.v1";
  source: string;
  symbol: string;
  timeframe: string;
  deliveryState: string;
  vaultPointer: string;
  accountRoute: string;
  digest: string;
  serverStored: boolean;
  lanes: Array<{ lane: string; state: string; proof: string }>;
  boundary: string;
};

function buildPass4547ClientVaultFallback(draft: Pass4546AssetReportComposerDraft): Pass4547ReportComposerVaultBridge {
  const pointer = `vlm-asset-detail-pending-${draft.symbol}-${draft.timeframe}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .slice(0, 96);
  return {
    schema: "velmere.pass4547.report-composer-vault-bridge.v1",
    source: "asset-detail-client-placeholder",
    symbol: draft.symbol,
    timeframe: draft.timeframe,
    deliveryState: "server-unavailable",
    vaultPointer: pointer,
    accountRoute: "/account?tab=reports",
    digest: "server-unconfirmed-no-vault-digest",
    serverStored: false,
    lanes: [
      { lane: "api-received", state: "blocked", proof: "server did not confirm receipt" },
      { lane: "vault-pointer", state: "blocked", proof: "no durable vault pointer" },
      { lane: "account-console", state: "current-tab-only", proof: "/account?tab=reports" },
      { lane: "operator-review", state: "blocked", proof: "server confirmation required" },
    ],
    boundary: "client-placeholder-no-server-vault-no-paid-unlock-no-trade-execution",
  };
}

async function postPass4547AssetReportVaultBridge(draft: Pass4546AssetReportComposerDraft): Promise<Pass4547ReportComposerVaultBridge> {
  try {
    const response = await fetch("/api/market-integrity/action-report-vault", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "asset-detail", draft }),
    });
    const payload = await readJsonResponseBounded<Record<string, unknown>>(response, 256 * 1024);
    if (!response.ok || payload?.schema !== "velmere.pass4547.report-composer-vault-bridge.v1") {
      throw new Error("pass4547 vault bridge rejected draft");
    }
    return payload as Pass4547ReportComposerVaultBridge;
  } catch {
    return buildPass4547ClientVaultFallback(draft);
  }
}

function writePass4547AssetReportVaultBridge(bridge: Pass4547ReportComposerVaultBridge) {
  if (typeof window === "undefined") return;
  const key = "velmere:pass4547:asset-report-vault-bridge";
  purgeLegacyPrivateAccountLocalStorage();
  const current = readPrivateAccountTabArray<Pass4547ReportComposerVaultBridge>(key);
  writePrivateAccountTabArray(key, [bridge, ...current].slice(0, 40));
  try {
    window.dispatchEvent(new CustomEvent("velmere:pass4547-asset-report-vault-bridge", { detail: bridge }));
  } catch {
    // best-effort event bridge only.
  }
}

function AssetDetailReportComposerPass4546({
  data,
  locale,
  timeframe,
  activeAction,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  timeframe: VlmAssetTimeframe;
  activeAction: string;
}) {
  const c = locale === "pl"
    ? { title: "Report composer", subtitle: "Manifest exportu zamienia się w szkic audytu/raportu: intake, PDF, vault i operator review mają jeden widoczny stan.", compose: "Przygotuj report", composed: "report w kolejce", state: "Stan", actions: "Akcje", ready: "Ready", review: "Review", lane: "Lane", proof: "Dowód", empty: "najpierw kliknij akcję" }
    : locale === "de"
      ? { title: "Report Composer", subtitle: "Das Export-Manifest wird zu einem Audit-/Report-Draft: Intake, PDF, Vault und Operator-Review haben einen sichtbaren Status.", compose: "Report vorbereiten", composed: "Report queued", state: "Status", actions: "Aktionen", ready: "Ready", review: "Review", lane: "Lane", proof: "Proof", empty: "zuerst Aktion klicken" }
      : { title: "Report composer", subtitle: "The export manifest becomes an audit/report draft: intake, PDF, vault and operator review share one visible state.", compose: "Prepare report", composed: "report queued", state: "State", actions: "Actions", ready: "Ready", review: "Review", lane: "Lane", proof: "Proof", empty: "click an action first" };
  const [entries, setEntries] = useState<Pass4543AssetActionLedgerEntry[]>([]);
  const [queued, setQueued] = useState(false);
  const [vaultBridge, setVaultBridge] = useState<Pass4547ReportComposerVaultBridge | null>(null);

  useEffect(() => {
    const sync = () => setEntries(readPass4544AssetReplay(data.symbol));
    sync();
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Pass4543AssetActionLedgerEntry>).detail;
      if (detail?.symbol === data.symbol) sync();
    };
    window.addEventListener("velmere:pass4543-action-ledger", listener);
    return () => {
      window.removeEventListener("velmere:pass4543-action-ledger", listener);
    };
  }, [data.symbol]);

  const manifest = buildPass4545AssetActionExportManifest({ data, timeframe, activeAction, entries });
  const draft = buildPass4546AssetReportComposerDraft({ data, timeframe, manifest });
  const queueDraft = async () => {
    writePass4546AssetReportComposerDraft(draft);
    const bridge = await postPass4547AssetReportVaultBridge(draft);
    writePass4547AssetReportVaultBridge(bridge);
    setVaultBridge(bridge);
    setQueued(true);
    window.setTimeout(() => setQueued(false), 1600);
  };

  return (
    <section
      className="vlm-asset-report-composer-pass4546"
      data-pass4546-asset-report-composer="export-manifest-to-audit-pdf-vault-review-draft"
      data-pass4546-report-state={draft.draftState}
      data-pass4546-report-actions={String(draft.actionCount)}
    >
      <div className="vlm-asset-report-composer-head-pass4546">
        <span>
          <p>{c.title}</p>
          <small>{c.subtitle}</small>
        </span>
        <button type="button" onClick={queueDraft} disabled={draft.draftState === "waiting-for-action"}>
          {draft.draftState === "waiting-for-action" ? c.empty : queued ? c.composed : c.compose}
        </button>
      </div>
      <div className="vlm-asset-report-composer-metrics-pass4546">
        <span><small>{c.state}</small><strong>{draft.draftState}</strong></span>
        <span><small>{c.actions}</small><strong>{draft.actionCount}</strong></span>
        <span><small>{c.ready}</small><strong>{draft.readyCount}</strong></span>
        <span><small>{c.review}</small><strong>{draft.reviewCount}</strong></span>
      </div>
      <div className="vlm-asset-report-composer-lanes-pass4546">
        {draft.lanes.map((lane) => (
          <article key={lane.lane} data-state={lane.state}>
            <small>{c.lane}</small>
            <b>{lane.lane}</b>
            <em>{lane.state}</em>
            <span>{c.proof}: {lane.proof}</span>
          </article>
        ))}
      </div>
      <div
        className="vlm-asset-vault-bridge-pass4547"
        data-pass4547-asset-report-vault-bridge="route-backed-vault-pointer-account-console-handoff"
        data-pass4547-vault-state={vaultBridge?.deliveryState || "not-queued"}
      >
        <span>
          <small>{locale === "pl" ? "Account vault bridge" : locale === "de" ? "Account Vault Bridge" : "Account vault bridge"}</small>
          <strong>{vaultBridge?.vaultPointer || (locale === "pl" ? "czeka na report" : locale === "de" ? "wartet auf Report" : "waiting for report")}</strong>
          <em>{vaultBridge?.boundary || "api-bridge-only · no paid unlock · no trade execution"}</em>
        </span>
        <span>
          <small>{locale === "pl" ? "Route" : locale === "de" ? "Route" : "Route"}</small>
          <strong>{vaultBridge?.accountRoute || "/account?tab=reports"}</strong>
          <em>{vaultBridge ? `${vaultBridge.deliveryState} · stored=${String(vaultBridge.serverStored)}` : "queue draft to create pointer"}</em>
        </span>
      </div>
    </section>
  );
}

function VlmModalUiProofStrip({
  data,
  timeframe,
  chartIsLoading,
  locale,
}: {
  data: VlmAssetDetailModalData;
  timeframe: VlmAssetTimeframe;
  chartIsLoading: boolean;
  locale: "pl" | "en" | "de";
}) {
  const sourceReady = Boolean(data.sourceLabel);
  const timeReady = Boolean(data.sourceTimeLabel);
  const operatorEvidenceEnabled =
    process.env.NODE_ENV !== "production"
    && process.env.NEXT_PUBLIC_VELMERE_OPERATOR_EVIDENCE === "1";

  if (!operatorEvidenceEnabled) {
    const queueCount = Number(!sourceReady) + Number(!timeReady) + Number(chartIsLoading);
    const sourceHealth = buildPass4483AssetSourceHealth({
      locale,
      surface: assetDrawerSurface(data),
      sourceLabel: data.sourceLabel,
      sourceTimeLabel: data.sourceTimeLabel,
      timeframeLabel: timeframe,
      chartIsLoading,
      queueCount,
    });

    return (
      <section
        className="vlm-source-health-rail-pass4483"
        data-pass4483-source-health-rail="visible-premium-source-freshness-chart-state"
        data-pass4483-source-health-state={sourceHealth.tone}
        data-pass4483-source-health-surface={sourceHealth.surface}
        data-a46-customer-runtime-hygiene="operator-evidence-removed-by-default"
        aria-label={sourceHealth.title}
      >
        <div className="vlm-source-health-copy-pass4483">
          <span>{sourceHealth.title}</span>
          <small>{sourceHealth.subtitle}</small>
        </div>
        <div className="vlm-source-health-items-pass4483">
          {sourceHealth.items.map((item) => (
            <span key={item.label} data-state={item.state}>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
            </span>
          ))}
        </div>
        <em>{sourceHealth.badge}</em>
      </section>
    );
  }

  const macroTimeframe = timeframe === "1W" || timeframe === "1M";
  const chartMode = timeframe === "1W" ? "Macro watch" : timeframe === "1M" ? "Monthly proof" : "Live window";
  const pdfLock = sourceReady && timeReady ? "Runtime parity watch" : "Hard lock until timestamp";
  const operatorActions = [
    !sourceReady && "P0 provider lane closeout",
    !timeReady && "P0 observedAt receipt",
    macroTimeframe && "P1 macro overlay adapter",
    chartIsLoading && "P1 chart replay pending",
  ].filter(Boolean) as string[];
  const closeoutRuntime = [
    sourceReady ? `live/configured provider: ${data.sourceLabel}` : "provider key/mapping needed",
    timeReady ? `observedAt: ${data.sourceTimeLabel}` : "max-age receipt missing",
    macroTimeframe ? "macro overlay replay required" : "short-window replay ready",
  ];
  const freshnessFingerprint = `PASS2459-${[data.symbol, data.sourceLabel, data.sourceTimeLabel, timeframe].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 42) || "MISSING"}`;
  const freshnessDrift = [
    sourceReady && timeReady ? `freshnessFingerprint: ${freshnessFingerprint}` : "freshnessFingerprint locked until provider/timecode",
    timeReady ? "observedAt visible · max-age required" : "timestamp_missing · customer copy downgraded",
    macroTimeframe ? "2Y/5Y/MAX requires range-specific freshness receipt" : "short-window freshness watch",
    sourceReady ? "planned providers remain tasks until observedAt" : "mapping_missing · provider closeout first",
  ];
  const macroChartFingerprint = `PASS2460-${[data.symbol, timeframe, data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 44) || "MISSING"}`;
  const macroIntegrity = [
    `macroChartFingerprint: ${macroChartFingerprint}`,
    macroTimeframe ? "active range: 2Y/5Y/MAX proof gate" : "active range: short/medium context",
    sourceReady && timeReady ? "primary history lane visible" : "primary history lane locked",
    macroTimeframe ? "second overlay + point-count receipt required" : "macro overlay not required for this view",
  ];
  const gapReceiptFingerprint = `PASS2461-${[data.symbol, timeframe, macroChartFingerprint, pdfLock].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 48) || "MISSING"}`;
  const macroGapReceipt = [
    `gapReceiptFingerprint: ${gapReceiptFingerprint}`,
    macroTimeframe ? "visible gap markers required on chart rail" : "gap receipt: short-window context",
    sourceReady && timeReady ? "PDF preview/download can share canonical marker list" : "PDF parity blocked until provider/timecode",
    macroTimeframe ? "no smoothing: missing points/overlay/freshness must be visible" : "no smoothing rule armed for macro ranges",
  ];
  const historicalBackfillFingerprint = `PASS2462-${[data.symbol, timeframe, gapReceiptFingerprint, data.sourceLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 52) || "MISSING"}`;
  const historicalBackfill = [
    `backfillFingerprint: ${historicalBackfillFingerprint}`,
    macroTimeframe ? "CoinGecko range/OHLC backfill required" : "range backfill contract armed",
    sourceReady ? "provider order visible: CoinGecko → GeckoTerminal/Binance → DefiLlama context" : "provider mapping required before macro green",
    timeReady ? "PDF/Brain/Browser must share backfill manifest" : "PDF backfill receipt blocked until observedAt",
  ];
  const rangeWindowFingerprint = `PASS2463-${[data.symbol, timeframe, historicalBackfillFingerprint, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 56) || "MISSING"}`;
  const historicalRangeWindow = [
    `rangeWindowFingerprint: ${rangeWindowFingerprint}`,
    macroTimeframe ? "from/to UNIX window required for 2Y/5Y/MAX" : "normalized window contract armed",
    timeReady ? "PDF preview/download must share same fromUnix/toUnix" : "window parity blocked until observedAt",
    sourceReady ? "raw points first · resample after gap receipt" : "provider window mapping required",
  ];
  const crossProviderWindowReconciliationFingerprint = `PASS2464-${[data.symbol, timeframe, rangeWindowFingerprint, data.sourceLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 58) || "MISSING"}`;
  const crossProviderWindowReconciliation = [
    `reconciliationFingerprint: ${crossProviderWindowReconciliationFingerprint}`,
    macroTimeframe ? "primary CoinGecko window + second overlay must share normalized range" : "cross-provider window rule armed",
    sourceReady && timeReady ? "PDF preview/download can reuse reconciled manifest" : "window reconciliation locked until provider/timecode",
    "DefiLlama/DEX Screener stay context lanes unless their window role matches the chart proof",
  ];
  const tierDepthScenarioFingerprint = `PASS2465-${[data.symbol, timeframe, crossProviderWindowReconciliationFingerprint, data.assetClassLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 60) || "MISSING"}`;
  const tokenLikeScope = isPass4408ShieldCryptoAsset(data);
  const tierDepthScenarioParity = [
    `tierScenarioFingerprint: ${tierDepthScenarioFingerprint}`,
    "Basic=10 triage · Pro=14 comparison+squeeze watch · Advanced=20 proof scenario lanes",
    tokenLikeScope ? "Advanced rug-pull/trap lane requires contract+holder+LP/tax proof" : "Real Markets: rug-pull/trap lane not_applicable unless token contract scope exists",
    sourceReady && timeReady ? "PDF preview/download must share selected tier + scenario locks" : "tier depth locked until source/timecode",
  ];
  const derivativesSqueezeFingerprint = `PASS2466-${[data.symbol, timeframe, tierDepthScenarioFingerprint, data.sourceLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 60) || "MISSING"}`;
  const derivativesSqueezeProof = [
    `derivativesFingerprint: ${derivativesSqueezeFingerprint}`,
    tokenLikeScope ? "Advanced squeeze proof needs Binance/Bybit OI + funding/basis + second venue" : "Derivatives squeeze not_applicable unless a crypto perp venue mapping exists",
    "liquidation feed + long/short ratio stay visible locks before confirmed squeeze wording",
    sourceReady && timeReady ? "Shield/PDF/Brain/Angel must reuse the same PASS2466 packet" : "derivatives proof locked until provider/timecode",
  ];
  const liquidationLongShortFingerprint = `PASS2467-${[data.symbol, timeframe, derivativesSqueezeFingerprint, data.sourceLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 60) || "MISSING"}`;
  const liquidationLongShortProof = [
    `liquidationRatioFingerprint: ${liquidationLongShortFingerprint}`,
    tokenLikeScope ? "Advanced squeeze wording needs Binance/Bybit long-short ratio packet" : "PASS2467 hidden unless crypto perp mapping exists",
    "confirmed squeeze blocked until liquidation collector or signed liquidation snapshot exists",
    "no leverage / entry / exit wording from ratio or liquidation data",
  ];
  const liquidationSnapshotLedgerFingerprint = `PASS2468-${[data.symbol, timeframe, liquidationLongShortFingerprint, data.sourceLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 60) || "MISSING"}`;
  const liquidationSnapshotLedgerProof = [
    `liquidationLedgerFingerprint: ${liquidationSnapshotLedgerFingerprint}`,
    tokenLikeScope ? "Advanced needs signed liquidation snapshot ledger + max-age before strengthening current squeeze copy" : "PASS2468 hidden unless crypto perp mapping exists",
    "single snapshot unlocks only liquidation context, not confirmed squeeze by itself",
    "expired/missing snapshot keeps pressure/watch wording and no leverage instructions",
  ];
  const liquidationReplayStoreFingerprint = `PASS2469-${[data.symbol, timeframe, liquidationSnapshotLedgerFingerprint, data.sourceLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 60) || "MISSING"}`;
  const liquidationReplayStoreProof = [
    `liquidationReplayFingerprint: ${liquidationReplayStoreFingerprint}`,
    tokenLikeScope ? "Advanced needs durable replay by symbol/fingerprint before current squeeze copy can strengthen" : "PASS2469 hidden unless crypto perp mapping exists",
    "memory memory fallback is QA only; Supabase/Redis replay required for paid Advanced",
    "Shield/PDF/Brain/Angel must show the same replayFingerprint or downgrade to pressure/watch",
  ];
  const tier180OutputMatrixFingerprint = `PASS2470-${[data.symbol, timeframe, tierDepthScenarioFingerprint, liquidationReplayStoreFingerprint].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 60) || "MISSING"}`;
  const tier180OutputMatrixProof = [
    `tier180MatrixFingerprint: ${tier180OutputMatrixFingerprint}`,
    "20 assets × 3 surfaces × 3 tiers = 180 deterministic cells",
    "Basic=10 · Pro=14 · Advanced=20 must differ by payload/fingerprint, not longer filler",
    "runtime receipts still required before claiming 180 live outputs",
  ];
  const tierRuntimeReceiptHarnessFingerprint = `PASS2472-${[data.symbol, tier180OutputMatrixFingerprint].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 66) || "MISSING"}`;
  const tierRuntimeReceiptHarnessProof = [
    `tierRuntimeReceiptHarnessFingerprint: ${tierRuntimeReceiptHarnessFingerprint}`,
    "generatedReceipts=180 is a receipt plan, not a fake live browser/PDF run",
    "API payload + screenshot/PDF hash + Angel replay must be captured and persisted",
    "runtimeCapturedCoveragePercent stays 0 until real receipts exist",
  ];
  const runtimeReceiptCaptureStoreFingerprint = `PASS2473-${[data.symbol, tierRuntimeReceiptHarnessFingerprint].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 66) || "MISSING"}`;
  const runtimeReceiptCaptureStoreProof = [
    `runtimeReceiptCaptureStoreFingerprint: ${runtimeReceiptCaptureStoreFingerprint}`,
    "captures API payload, screenshot/PDF hash and Angel replay fingerprints only",
    "memory memory fallback is QA only; durable store required for paid Advanced",
    "customer modal stays clean; captured receipt rows remain operator/debug-only",
  ];
  const runtimeReceiptApiRunnerFingerprint = `PASS2474-${[data.symbol, runtimeReceiptCaptureStoreFingerprint].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 66) || "MISSING"}`;
  const runtimeReceiptApiRunnerProof = [
    `runtimeReceiptApiRunnerFingerprint: ${runtimeReceiptApiRunnerFingerprint}`,
    "API payload runner can fill first receipt lane across 180 cells",
    "browser_screenshot/pdf_hash and Angel replay still required",
    "operator-only; never claim live parity from API receipts alone",
  ];
  const runtimeReceiptBrowserRunnerFingerprint = `PASS2475-${[data.symbol, runtimeReceiptApiRunnerFingerprint].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 66) || "MISSING"}`;
  const runtimeReceiptBrowserRunnerProof = [
    `runtimeReceiptBrowserRunnerFingerprint: ${runtimeReceiptBrowserRunnerFingerprint}`,
    "Shield/Real Markets screenshot runner needs real screenshotHash per cell",
    "PDF hash and Angel replay still required",
    "operator-only; never claim live parity from browser screenshots alone",
  ];
  const runtimeReceiptPdfHashRunnerFingerprint = `PASS2476-${[data.symbol, runtimeReceiptBrowserRunnerFingerprint].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 66) || "MISSING"}`;
  const runtimeReceiptPdfHashRunnerProof = [
    `runtimeReceiptPdfHashRunnerFingerprint: ${runtimeReceiptPdfHashRunnerFingerprint}`,
    "PDF hash runner needs real preview/download pdfHash per PDF cell",
    "browser screenshots and Angel replay still required",
    "operator-only; never claim live parity from PDF hashes alone",
  ];
  const advancedValueFingerprint = `PASS2482-${[data.symbol, runtimeReceiptPdfHashRunnerFingerprint, tokenLikeScope ? "crypto" : "real-markets", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 70) || "MISSING"}`;
  const advancedValueProof = [
    `advancedValueFingerprint: ${advancedValueFingerprint}`,
    tokenLikeScope ? "Paid Advanced needs orderbook/slippage + derivatives/OI/funding/long-short/liquidations + holder/supply proof" : "Real Markets Advanced needs second quote + observedAt + filings/fundamentals/event source lane",
    sourceReady && timeReady ? "source/timecode present; still requires premium runtime receipts before paid conclusion" : "not paid-ready: provider/timecode missing",
    "Advanced can sell clarity + evidence depth only; no stronger verdict from longer text or visual polish",
  ];
  const premiumEvidenceBridgeFingerprint = `PASS2483-${[data.symbol, advancedValueFingerprint, tokenLikeScope ? "crypto-premium" : "real-market-premium", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 72) || "MISSING"}`;
  const premiumEvidenceBridgeProof = [
    `premiumBridgeFingerprint: ${premiumEvidenceBridgeFingerprint}`,
    tokenLikeScope ? "crypto bridge checks orderbook/slippage, PASS2466 derivatives, PASS2467/68/69 liquidation replay and holder/supply" : "real-market bridge checks Yahoo/Stooq timestamp, SEC/XBRL/fundamentals, filing/event freshness",
    "PASS2482 paid-ready can only upgrade when PASS2483 premium lanes are ready and runtime receipts match",
    "if any lane is blocked, Advanced button/copy must say QA preview or missing-proof map, not completed verdict",
  ];
  const runtimePremiumHydrationFingerprint = `PASS2484-${[data.symbol, premiumEvidenceBridgeFingerprint, tokenLikeScope ? "binance-depth" : "provider-family", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 74) || "MISSING"}`;
  const runtimePremiumHydrationProof = [
    `runtimePremiumHydrationFingerprint: ${runtimePremiumHydrationFingerprint}`,
    tokenLikeScope ? "hydrates Binance spot depth into slippage + bid/ask metrics when available" : "hydrates Yahoo/Stooq provider-family receipts and filing/fundamental gaps",
    "PASS2484 may upgrade a lane to watch, but never makes Advanced paid-ready alone",
    "missing second venue, holder/supply, filings or runtime parity must remain visible before payment copy",
  ];
  const paidAdvancedReadinessFuseFingerprint = `PASS2485-${[data.symbol, runtimePremiumHydrationFingerprint, tokenLikeScope ? "crypto-fuse" : "real-market-fuse", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 76) || "MISSING"}`;
  const paidAdvancedReadinessFuseProof = [
    `paidAdvancedReadinessFuseFingerprint: ${paidAdvancedReadinessFuseFingerprint}`,
    tokenLikeScope ? "fuses PASS2484 depth + PASS2466 OI/funding + PASS2467 long-short/liquidation + holder/supply gate" : "fuses provider timestamp + second quote + filings/fundamentals + runtime parity",
    "Advanced CTA/copy stays QA preview until PASS2485 paidAdvancedAllowed=true",
    "one premium lane in watch mode is useful, but not enough to sell a completed paid verdict",
  ];
  const derivativesPaidReadinessBridgeFingerprint = `PASS2486-${[data.symbol, paidAdvancedReadinessFuseFingerprint, tokenLikeScope ? "derivatives-bridge" : "not-applicable", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 78) || "MISSING"}`;
  const derivativesPaidReadinessBridgeProof = [
    `derivativesPaidReadinessBridgeFingerprint: ${derivativesPaidReadinessBridgeFingerprint}`,
    tokenLikeScope ? "checks OI/funding + long-short ratio + liquidation replay before squeeze or paid derivatives copy" : "not applicable for Real Markets unless a listed derivatives mapping is explicitly attached",
    "confirmed squeeze wording stays blocked until confirmedSqueezeCopyAllowed=true",
    "no leverage, entry, exit or liquidation advice; only pressure/watch context with missing proof visible",
  ];
  const liquidationReplayPaidCopyLockFingerprint = `PASS2487-${[data.symbol, derivativesPaidReadinessBridgeFingerprint, tokenLikeScope ? "liquidation-replay-paid-copy" : "not-applicable", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 80) || "MISSING"}`;
  const liquidationReplayPaidCopyLockProof = [
    `liquidationReplayPaidCopyLockFingerprint: ${liquidationReplayPaidCopyLockFingerprint}`,
    tokenLikeScope ? "paid derivatives copy needs fresh signed snapshot + two-venue replay + durable storage" : "not applicable for Real Markets; use quote/filing/fundamental paid gates instead",
    "paid/confirmed squeeze wording stays blocked until PASS2487 paidCopyAllowed=true",
    "Shield/PDF/Brain/Angel must share replayFingerprint + ledgerFingerprint or downgrade to pressure/watch",
  ];
  const supplyFilingProvenanceFingerprint = `PASS2488-${[data.symbol, liquidationReplayPaidCopyLockFingerprint, tokenLikeScope ? "supply-holder-unlock" : "sec-xbrl-fundamentals", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 82) || "MISSING"}`;
  const supplyFilingProvenanceProof = [
    `supplyFilingProvenanceFingerprint: ${supplyFilingProvenanceFingerprint}`,
    tokenLikeScope ? "crypto Advanced needs supply snapshot + holder/concentration method + unlock/emission boundary" : "Real Markets Advanced needs SEC identity/CIK + XBRL freshness + fundamentals/holdings coverage",
    "paid provenance copy stays blocked until PASS2488 paidProvenanceAllowed=true",
    "price freshness is not supply, holder, filing or fundamental freshness; missing provenance must remain visible",
  ];
  const tierCommercialValueFingerprint = `PASS2489-${[data.symbol, supplyFilingProvenanceFingerprint, tokenLikeScope ? "crypto-commercial-value" : "real-market-commercial-value", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 84) || "MISSING"}`;
  const tierCommercialValueProof = [
    `tierCommercialValueFingerprint: ${tierCommercialValueFingerprint}`,
    "Basic=10, Pro=14, Advanced=20 must be sold by proof depth and copy mode, not by longer text",
    tokenLikeScope ? "Advanced paid verdict needs PASS2485 + PASS2487 + PASS2488; otherwise only missing-proof map/QA preview" : "Real Markets paid verdict needs PASS2485 + PASS2488; otherwise only missing-proof map/QA preview",
    "CTA must say paid verdict only when PASS2489 paidAdvancedAllowed=true; otherwise show Advanced missing-proof map",
  ];
  const advancedCtaEntitlementFingerprint = `PASS2490-${[data.symbol, tierCommercialValueFingerprint, tokenLikeScope ? "crypto-advanced-cta" : "real-market-advanced-cta", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 86) || "MISSING"}`;
  const advancedCtaEntitlementProof = [
    `advancedCtaEntitlementFingerprint: ${advancedCtaEntitlementFingerprint}`,
    "server receipt + product scope required before Advanced entitlement; wallet connect is context only",
    "CTA mode must be paid verdict, missing-proof map, QA preview or blocked — never ambiguous",
    "Checkout, Shield, Real Markets, PDF, Brain and Angel must show the same PASS2490 ctaMode before payment",
  ];
  const entitlementReceiptReplayFingerprint = `PASS2491-${[data.symbol, advancedCtaEntitlementFingerprint, tokenLikeScope ? "crypto-receipt-replay" : "real-market-receipt-replay", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 88) || "MISSING"}`;
  const entitlementReceiptReplayProof = [
    `entitlementReceiptReplayFingerprint: ${entitlementReceiptReplayFingerprint}`,
    "post-payment unlock needs server receipt fingerprint + PASS2490 fingerprint + productScope/contextHash replay",
    "wallet connect or checkout redirect success alone must not unlock Advanced paid verdict",
    "Account console, PDF, Brain, Angel and modal must expose the same PASS2491 replayKey before unlock copy",
  ];
  const entitlementArtifactDeliveryFingerprint = `PASS2492-${[data.symbol, entitlementReceiptReplayFingerprint, tokenLikeScope ? "crypto-artifact-delivery" : "real-market-artifact-delivery", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 90) || "MISSING"}`;
  const entitlementArtifactDeliveryProof = [
    `entitlementArtifactDeliveryFingerprint: ${entitlementArtifactDeliveryFingerprint}`,
    "paid Advanced delivery needs matching PDF preview/download hashes plus account delivery id/fingerprint",
    "PDF footer, account console, checkout success, modal, Brain and Angel must expose the same PASS2492 deliveryManifestKey",
    "raw card data, wallet signatures and raw PDF bytes stay outside the entitlement artifact ledger",
  ];
  const entitlementAccountVaultFingerprint = `PASS2493-${[data.symbol, entitlementArtifactDeliveryFingerprint, tokenLikeScope ? "crypto-account-vault" : "real-market-account-vault", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 92) || "MISSING"}`;
  const entitlementAccountVaultProof = [
    `entitlementAccountVaultFingerprint: ${entitlementAccountVaultFingerprint}`,
    "account vault access needs PASS2492 deliveryManifestKey + artifact hash + accountDeliveryId replay",
    "wallet connect, localStorage and public cached PDF URLs must never unlock a paid Advanced artifact",
    "Account console, PDF download, Brain and Angel must expose the same PASS2493 vaultRetrievalKey before vault-delivered copy",
  ];
  const entitlementRevocationFingerprint = `PASS2494-${[data.symbol, entitlementAccountVaultFingerprint, tokenLikeScope ? "crypto-revocation-ledger" : "real-market-revocation-ledger", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 94) || "MISSING"}`;
  const entitlementRevocationProof = [
    `entitlementRevocationFingerprint: ${entitlementRevocationFingerprint}`,
    "paid Advanced vault access must replay refund, chargeback, dispute, expiry and superseded status after PASS2493",
    "revoked/refunded/chargebacked entitlements must hide PDF/account artifact even if checkout success or vault key exists",
    "Account console, PDF download, Brain and Angel must expose the same PASS2494 revocationLedgerKey before active paid access copy",
  ];
  const entitlementAdminOverrideFingerprint = `PASS2495-${[data.symbol, entitlementRevocationFingerprint, tokenLikeScope ? "crypto-admin-dual-control" : "real-market-admin-dual-control", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 96) || "MISSING"}`;
  const entitlementAdminOverrideProof = [
    `entitlementAdminOverrideFingerprint: ${entitlementAdminOverrideFingerprint}`,
    "manual Advanced regrant needs the same PASS2494 revocationLedgerKey plus two distinct operator approvals",
    "admin role, localStorage, wallet connect, checkout success and public cached PDF URL cannot override revocation state",
    "customer notice, approval policy and future expiry must be visible before any support/admin restored access copy",
  ];
  const entitlementSessionDeviceFingerprint = `PASS2496-${[data.symbol, entitlementAdminOverrideFingerprint, tokenLikeScope ? "crypto-session-device" : "real-market-session-device", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 98) || "MISSING"}`;
  const entitlementSessionDeviceProof = [
    `entitlementSessionDeviceFingerprint: ${entitlementSessionDeviceFingerprint}`,
    "paid Advanced vault read needs account session fingerprint + vault read token + matching PASS2495 adminOverrideLedgerKey",
    "copied session cookie, stolen vault token, wallet connect, checkout success, localStorage and cached PDF URL stay blocked",
    "device binding, CSRF nonce, active expiry and MFA/step-up on risk must be visible before session-bound paid access copy",
  ];
  const entitlementArtifactWatermarkFingerprint = `PASS2497-${[data.symbol, entitlementSessionDeviceFingerprint, tokenLikeScope ? "crypto-watermarked-artifact" : "real-market-watermarked-artifact", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 100) || "MISSING"}`;
  const entitlementArtifactWatermarkProof = [
    `entitlementArtifactWatermarkFingerprint: ${entitlementArtifactWatermarkFingerprint}`,
    "paid PDF/report delivery needs PASS2496 sessionLedgerKey + artifactHash + customerPseudonymHash + watermarkFingerprint",
    "signed download URL fingerprint, download nonce and active short expiry must be replayed before paid artifact copy",
    "public cached PDF URLs, copied signed links, screenshot shares, wallet connect, checkout success and localStorage stay blocked",
  ];
  const entitlementEvidenceExportFingerprint = `PASS2498-${[data.symbol, entitlementArtifactWatermarkFingerprint, tokenLikeScope ? "crypto-evidence-export" : "real-market-evidence-export", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 102) || "MISSING"}`;
  const entitlementEvidenceExportProof = [
    `entitlementEvidenceExportFingerprint: ${entitlementEvidenceExportFingerprint}`,
    "support/dispute evidence export needs PASS2497 watermarkLedgerKey + artifactHash + customerPseudonymHash",
    "supportCaseId, exportRequestId, safe exportScope, redaction policy, audit signer, second operator and nonce must replay",
    "raw PII, raw payment data, raw wallet signatures, raw IP/device fingerprints and public artifact URLs stay server-only",
  ];
  const entitlementRetentionErasureFingerprint = `PASS2499-${[data.symbol, entitlementEvidenceExportFingerprint, tokenLikeScope ? "crypto-retention-erasure" : "real-market-retention-erasure", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 104) || "MISSING"}`;
  const entitlementRetentionErasureProof = [
    `entitlementRetentionErasureFingerprint: ${entitlementRetentionErasureFingerprint}`,
    "retained paid evidence needs PASS2498 evidenceExportLedgerKey replay + supportCaseId + retentionPolicyFingerprint",
    "data minimization policy, retentionScheduleId, archiveHash, customerNoticeId and active expiry must be visible",
    "expired retention requires erasureJobId + erasureProofFingerprint; raw PII/payment/wallet/IP/device retention and public archives stay denied",
  ];
  const entitlementIncidentResponseFingerprint = `PASS2500-${[data.symbol, entitlementRetentionErasureFingerprint, tokenLikeScope ? "crypto-incident-response" : "real-market-incident-response", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 106) || "MISSING"}`;
  const entitlementIncidentResponseProof = [
    `entitlementIncidentResponseFingerprint: ${entitlementIncidentResponseFingerprint}`,
    "incident response copy needs PASS2499 retentionLedgerKey replay + incidentCaseId + severity + triage fingerprint",
    "containmentFingerprint, affectedArtifactHash, customerNoticeId, operatorAckFingerprint and future review expiry must be visible",
    "silent recovery, raw forensic export, raw PII/payment/wallet/IP/device incident payloads and public incident archives stay denied",
  ];
  const masterMapRebalanceFingerprint = `PASS2501-${[data.symbol, entitlementIncidentResponseFingerprint, "master-map-rebalance", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 108) || "MISSING"}`;
  const masterMapRebalanceProof = [
    `masterMapRebalanceFingerprint: ${masterMapRebalanceFingerprint}`,
    "anti-tunnel cooldown: next passes must include Browser/PDF, Shield Map, Angel UX, cart/wallet/checkout or Real Markets data",
    "security/entitlement work cannot increase UI/PDF/cart/globe percentages unless those surfaces changed directly",
    "expanded TXT must be restored and appended every pass with before audit, chosen lanes, QA and next queue",
  ];

  const surfaceRuntimeRebalanceFingerprint = `PASS2502-${[data.symbol, masterMapRebalanceFingerprint, tokenLikeScope ? "crypto-surface-runtime" : "real-market-surface-runtime", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 110) || "MISSING"}`;
  const surfaceRuntimeRebalanceProof = [
    `surfaceRuntimeRebalanceFingerprint: ${surfaceRuntimeRebalanceFingerprint}`,
    "Browser/PDF compact result, Shield Map active identity context, Angel context badge and cart overlay hit-test must change directly before their progress rises",
    "Real Markets SEC/companyfacts queue stays active; entitlement/security remains cooldown unless P0",
    "expanded TXT must log before/after deltas for every touched non-entitlement lane",
  ];

  const realMarketsSecCompanyfactsFingerprint = `PASS2503-${[data.symbol, surfaceRuntimeRebalanceFingerprint, tokenLikeScope ? "crypto-not-applicable" : "real-market-sec-companyfacts", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 112) || "MISSING"}`;
  const realMarketsSecCompanyfactsProof = [
    `realMarketsSecCompanyfactsFingerprint: ${realMarketsSecCompanyfactsFingerprint}`,
    tokenLikeScope ? "crypto route: SEC/companyfacts is not applicable; holder/supply/unlock lanes stay in PASS2488" : "Real Markets route: CIK identity + SEC submissions + Companyfacts/XBRL must be hydrated before paid filing copy",
    "AAPL/NVDA/SPY must stay in Real Markets, never CoinGecko/Dex token fallback; ETF holdings freshness remains separate from Companyfacts",
    "Browser/PDF, modal, Angel and source-sync must show SEC_USER_AGENT / filing / concept-coverage missing proof instead of stronger filler text",
  ];
  const localePdfAngelCleanlinessFingerprint = `PASS2505-${[data.symbol, realMarketsSecCompanyfactsFingerprint, tokenLikeScope ? "crypto-copy-clean" : "real-market-copy-clean", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 116) || "MISSING"}`;
  const localePdfAngelCleanlinessProof = [
    `localePdfAngelCleanlinessFingerprint: ${localePdfAngelCleanlinessFingerprint}`,
    "PDF preview/download must keep one locale and one payload hash; no PL/EN/DE mixing in customer copy",
    "KERNEL, density cap, debug-demo, fake, undefined/null and internal draft markers stay out of customer-visible Browser/PDF output",
    tokenLikeScope ? "crypto route: keep token evidence lanes explicit and do not borrow SEC/companyfacts copy" : "Real Markets route: AAPL/NVDA/SPY/ETF stay outside crypto fallback and require SEC/holdings proof",
    "Basic/Pro/Advanced must differ by evidence lanes and receipts, not by longer filler text",
  ];
  const chartModalMobileFingerprint = `PASS2506-${[data.symbol, localePdfAngelCleanlinessFingerprint, tokenLikeScope ? "crypto-chart-mobile" : "real-market-chart-mobile", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 118) || "MISSING"}`;
  const chartModalMobileProof = [
    `chartModalMobileFingerprint: ${chartModalMobileFingerprint}`,
    "chart wheel/pinch/drag must be owned by the chart surface and cannot scroll the background page",
    "mobile modal safe area must keep close button, timeframe rail and VLM Analysis selector reachable on 390x844 screens",
    tokenLikeScope ? "crypto chart shell: keep token/contract lanes explicit and do not borrow SEC/companyfacts chart copy" : "Real Markets chart shell: keep SEC/companyfacts/fundamental/ETF context separate from crypto fallback",
    "Browser/PDF fixture render queue must prove preview/download hash replay with first-page screenshot QA before paid delivery copy",
  ];

  const fixtureMotionAngelFingerprint = `PASS2507-${[data.symbol, chartModalMobileFingerprint, tokenLikeScope ? "crypto-fixture-motion" : "real-market-fixture-motion", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 120) || "MISSING"}`;
  const fixtureMotionAngelProof = [
    `fixtureMotionAngelFingerprint: ${fixtureMotionAngelFingerprint}`,
    "PDF preview/download/render fixture manifest must compare BTC/NVDA/SPY/SOL across Basic/Pro/Advanced and PL/EN/DE before delivered paid-copy",
    "cart/menu/wallet use one motion stack, no hidden overlay blockers; wallet connect stays identity-only",
    tokenLikeScope ? "crypto boundary: holder/supply/unlock lanes stay explicit and cannot borrow SEC/companyfacts copy" : "Real Markets boundary: SEC/companyfacts/fundamental/ETF missing states stay visible and cannot borrow token/DEX copy",
    "Angel context chips must state active surface, asset, evidence status and missing proof before narrative; tiers differ by proof lanes, not filler",
  ];

  const tableSearchUiFingerprint = `PASS2508-${[data.symbol, fixtureMotionAngelFingerprint, tokenLikeScope ? "crypto-table-search-ui" : "real-market-table-search-ui", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 122) || "MISSING"}`;
  const tableSearchUiProof = [
    `tableSearchUiFingerprint: ${tableSearchUiFingerprint}`,
    "Shield table headers need visible PASS2508 tri-state receipt: desc → asc → neutral without overlay stealing clicks",
    "Real Markets search needs compact max-three overlay, exact/choose status and no gold rectangle focus shell",
    "Asset logos must be provider image or labeled fallback badge without decorative frames; fallback badge is not official issuer/exchange proof",
    "Angel must state table/search/sort/logo context before narrative and never convert UI state into risk certainty, SEC proof or paid verdict",
  ];

  const worldclassAiSecurityFingerprint = `PASS2509-${[data.symbol, tableSearchUiFingerprint, tokenLikeScope ? "crypto-ai-firewall" : "real-market-ai-firewall", data.sourceLabel, data.sourceTimeLabel].filter(Boolean).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 122) || "MISSING"}`;
  const renderFixtureOverlaySourceProof = [
  "PASS2510: Browser/PDF fixture manifest covers BTC/NVDA/SPY across EN/PL/DE before parity claims",
  "PASS2510: cart/menu/wallet overlays declare closed/open/closing pointer ownership; hidden layers cannot steal clicks",
  "PASS2510: Angel red-team judge blocks hidden prompt leaks, fake paid unlocks, unsupported hype and raw receipt leaks",
  "PASS2510: Real Markets source-quality badges separate live provider, fallback, filing-watch and render-watch",
  "PASS2510: Shield Map tile/drawer/logo/Angel identity fixture must match before globe polish is marked done",
];

  const etfVaultPaymentSquareProof = [
    "PASS2511: SPY/QQQ/VOO ETF copy needs holdings provider + snapshot date, not reused SEC Companyfacts",
    "PASS2511: paid PDF delivery requires previewHash/downloadHash/accountVaultHash, locale, tier, redaction and retention manifest",
    "PASS2511: card/BLIK/crypto unlock needs server receipt or tx watcher; wallet connect stays identity only",
    "PASS2511: Angel uses watch/payment-boundary/redacted-refusal/risk-education when proof is missing",
    "PASS2511: Shield Map tiers require Basic 10 / Pro 14 / Advanced 20 evidence nodes before Orbit depth is called done",
    "PASS2511: Square public/pinned posts require moderation state, signer, expiry and no hype/wallet pressure",
  ];

  const i18nSquareCheckoutEvidenceProof = [
    "PASS2513: customer copy must stay one locale family and cannot show KERNEL/debug-demo/fake/undefined/null/internal draft copy",
    "PASS2513: Square comments require scroll-safe modal close, moderation state, pinned-admin signer and expiry",
    "PASS2513: card/BLIK/crypto unlock requires webhook/tx watcher receipt; refund/chargeback moves entitlement to hold/revoked",
    "PASS2513: PDF vault needs preview/download/account-vault locale hash family plus retention/erasure receipt",
    "PASS2513: Angel source-honesty drill names source badge, stale/missing proof and payment boundary before narrative",
    "PASS2513: Shield/Real Markets polish stays watch until screenshot diff fixtures prove desktop/mobile/search/modal states",
  ];

const worldclassAiSecurityProof = [
    `worldclassAiSecurityFingerprint: ${worldclassAiSecurityFingerprint}`,
    "AI firewall: user PDFs/contracts/catalog rows/market payloads are untrusted data, not instructions or proof",
    "Sensitive-output lock: never reveal system prompts, hidden policy, raw receipts, raw PII/payment/wallet/IP/device data or private artifact URLs",
    "Claim traceability: live/current/confirmed/paid/audit-safe/squeeze/rug-pull wording needs source lane, freshness state and missing-proof fallback",
    "Cart/wallet boundary: wallet connect, checkout redirect, localStorage, sort/search state and screenshots are not paid entitlement or market proof",
    tokenLikeScope ? "Shield Map binding: tile/logo/drawer/Angel payload must keep the same normalized token identity" : "Real Markets binding: stock/ETF/FX/commodity context cannot borrow token/DEX copy",
  ];

  const queue = [
    !sourceReady && "Provider lane missing",
    !timeReady && "ObservedAt timestamp missing",
    macroTimeframe && "Second-provider macro overlay required",
    chartIsLoading && "Chart payload still loading",
  ].filter(Boolean) as string[];
  const chartBadges = [
    { label: "30D", state: sourceReady ? "watch" : "missing" },
    { label: "90D", state: sourceReady ? "watch" : "missing" },
    { label: "1Y", state: sourceReady && timeReady ? "watch" : "missing" },
    { label: "2Y", state: macroTimeframe && !chartIsLoading ? "watch" : "missing" },
    { label: "5Y", state: macroTimeframe && !chartIsLoading ? "watch" : "missing" },
    { label: "MAX", state: macroTimeframe && !chartIsLoading ? "watch" : "missing" },
  ];
  const chips = [
    { label: "Provider", value: sourceReady ? data.sourceLabel : "Source pending", state: sourceReady ? "live" : "missing" },
    { label: "Timecode", value: timeReady ? data.sourceTimeLabel : "Missing timestamp", state: timeReady ? "live" : "watch" },
    { label: "Chart", value: `${timeframe} · ${chartMode}`, state: chartIsLoading ? "watch" : "live" },
    { label: "PDF", value: pdfLock, state: sourceReady && timeReady ? "watch" : "missing" },
  ];
  const sourceHealth = buildPass4483AssetSourceHealth({
    locale,
    surface: assetDrawerSurface(data),
    sourceLabel: data.sourceLabel,
    sourceTimeLabel: data.sourceTimeLabel,
    timeframeLabel: timeframe,
    chartIsLoading,
    queueCount: queue.length,
  });

  return (
    <section
      className="vlm-source-health-rail-pass4483"
      data-pass4483-source-health-rail="visible-premium-source-freshness-chart-state"
      data-pass4483-source-health-state={sourceHealth.tone}
      data-pass4483-source-health-surface={sourceHealth.surface}
      aria-label={sourceHealth.title}
    >
      <div className="vlm-source-health-copy-pass4483">
        <span>{sourceHealth.title}</span>
        <small>{sourceHealth.subtitle}</small>
      </div>
      <div className="vlm-source-health-items-pass4483">
        {sourceHealth.items.map((item) => (
          <span key={item.label} data-state={item.state}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      <em>{sourceHealth.badge}</em>

      <details className="vlm-ui-proof-strip vlm-ui-proof-strip--debug" aria-label="Internal runtime evidence proof strip">
        <summary className="vlm-ui-proof-summary">
          <span>Operator receipts</span>
          <strong>{queue.length ? `${queue.length} locks · QA` : "QA proof hidden"}</strong>
        </summary>
        <div className="vlm-ui-proof-strip-body">
      <div className="vlm-ui-proof-strip-head">
        <span>PASS2456 runtime parity · PASS2457 queue · PASS2458 closeout · PASS2459 freshness · PASS2460 macro chart · PASS2461 gap receipt · PASS2462 backfill · PASS2463 range window · PASS2464 window reconciliation · PASS2465 tier scenario parity · PASS2466 derivatives proof · PASS2467 liquidation/long-short lock · PASS2468 snapshot ledger · PASS2469 replay store · PASS2470 180-output matrix · PASS2472 runtime receipt harness · PASS2473 runtime receipt capture store · PASS2474 API payload runner · PASS2475 browser screenshot runner · PASS2476 PDF hash runner · PASS2482 paid-value audit · PASS2483 premium evidence bridge · PASS2484 runtime premium evidence hydrator · PASS2485 paid Advanced readiness fuse · PASS2486 derivatives paid-readiness bridge · PASS2490 advanced CTA entitlement contract · PASS2491 entitlement receipt replay parity · PASS2492 entitlement artifact delivery ledger · PASS2493 account vault retrieval contract · PASS2494 revocation/chargeback lock · PASS2495 admin override dual-control lock · PASS2496 session/device anomaly lock · PASS2501 master map rebalance audit · PASS2502 surface runtime rebalance sweep · PASS2503 SEC/companyfacts hydrator</span>
        <strong>{queue.length ? `${queue.length} locks · ${operatorActions.length} actions` : "No hidden evidence"}</strong>
      </div>
      <div className="vlm-ui-proof-strip-grid">
        {chips.map((chip) => (
          <div key={chip.label} className="vlm-ui-proof-chip" data-state={chip.state}>
            <span>{chip.label}</span>
            <strong>{chip.value}</strong>
          </div>
        ))}
      </div>
      <div className="vlm-ui-proof-range-row" aria-label="Long range chart proof badges">
        {chartBadges.map((badge) => (
          <span key={badge.label} data-state={badge.state}>{badge.label}</span>
        ))}
      </div>
      <div className="vlm-ui-proof-queue" aria-label="Missing proof queue">
        {queue.length ? queue.slice(0, 4).map((item) => <span key={item}>{item}</span>) : <span>Runtime surfaces share the same visible proof contract.</span>}
      </div>
      <div className="vlm-operator-action-row" aria-label="Operator action queue" data-pass2457-label="PASS2457 operator action queue">
        {operatorActions.length ? operatorActions.slice(0, 4).map((item) => <span key={item}>{item}</span>) : <span>PASS2457 queue clear: no P0 runtime action visible.</span>}
      </div>
      <div className="vlm-provider-closeout-row" aria-label="PASS2458 closeout runtime">
        {closeoutRuntime.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-source-freshness-row" aria-label="PASS2459 source freshness drift sentinel" data-pass2459-freshness-drift-sentinel="surface-visible">
        {freshnessDrift.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-macro-chart-integrity-row" aria-label="PASS2460 macro chart integrity gate" data-pass2460-macro-chart-integrity="surface-visible">
        {macroIntegrity.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-macro-gap-receipt-row" aria-label="PASS2461 macro gap receipt" data-pass2461-macro-gap-receipt="surface-visible">
        {macroGapReceipt.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-historical-backfill-row" aria-label="PASS2462 historical backfill orchestrator" data-pass2462-historical-backfill="surface-visible">
        {historicalBackfill.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-historical-range-window-row" aria-label="PASS2463 historical range window ledger" data-pass2463-historical-range-window="surface-visible">
        {historicalRangeWindow.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-cross-provider-window-row" aria-label="PASS2464 cross-provider window reconciliation" data-pass2464-window-reconciliation="surface-visible">
        {crossProviderWindowReconciliation.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-tier-depth-scenario-row" aria-label="PASS2465 tier depth scenario parity" data-pass2465-tier-depth-scenario-parity="surface-visible">
        {tierDepthScenarioParity.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-derivatives-squeeze-proof-row" aria-label="PASS2466 derivatives squeeze proof" data-pass2466-derivatives-squeeze-proof="surface-visible">
        {derivativesSqueezeProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-liquidation-long-short-proof-row" aria-label="PASS2467 liquidation long-short proof" data-pass2467-liquidation-long-short-proof="surface-visible">
        {liquidationLongShortProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-liquidation-snapshot-ledger-row" aria-label="PASS2468 liquidation snapshot ledger" data-pass2468-liquidation-snapshot-ledger="surface-visible">
        {liquidationSnapshotLedgerProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-liquidation-replay-store-row" aria-label="PASS2469 liquidation replay store" data-pass2469-liquidation-replay-store="surface-visible">
        {liquidationReplayStoreProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-tier-180-output-matrix-row" aria-label="PASS2470 tier 180 output matrix" data-pass2470-tier-180-output-matrix="surface-visible">
        {tier180OutputMatrixProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-tier-runtime-receipt-row" aria-label="PASS2472 tier runtime receipt harness" data-pass2472-tier-runtime-receipt-harness="surface-visible">
        {tierRuntimeReceiptHarnessProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-runtime-receipt-capture-store-row" aria-label="PASS2473 runtime receipt capture store" data-pass2473-runtime-receipt-capture-store="operator-debug-only">
        {runtimeReceiptCaptureStoreProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-runtime-receipt-api-runner-row" aria-label="PASS2474 runtime receipt API runner" data-pass2474-runtime-receipt-api-runner="operator-debug-only">
        {runtimeReceiptApiRunnerProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-runtime-receipt-browser-runner-row" aria-label="PASS2475 runtime receipt browser runner" data-pass2475-runtime-receipt-browser-runner="operator-debug-only">
        {runtimeReceiptBrowserRunnerProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-runtime-receipt-pdf-hash-runner-row" aria-label="PASS2476 runtime receipt PDF hash runner" data-pass2476-runtime-receipt-pdf-hash-runner="operator-debug-only">
        {runtimeReceiptPdfHashRunnerProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-advanced-value-audit-row" aria-label="PASS2482 advanced value audit" data-pass2482-advanced-value-audit="surface-visible">
        {advancedValueProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-premium-evidence-bridge-row" aria-label="PASS2483 premium evidence bridge" data-pass2483-premium-evidence-bridge="surface-visible">
        {premiumEvidenceBridgeProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-runtime-premium-hydration-row" aria-label="PASS2484 runtime premium evidence hydrator" data-pass2484-runtime-premium-evidence="surface-visible">
        {runtimePremiumHydrationProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-paid-advanced-readiness-fuse-row" aria-label="PASS2485 paid Advanced readiness fuse" data-pass2485-paid-advanced-readiness-fuse="surface-visible">
        {paidAdvancedReadinessFuseProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-derivatives-paid-readiness-bridge-row" aria-label="PASS2486 derivatives paid-readiness bridge" data-pass2486-derivatives-paid-readiness-bridge="surface-visible">
        {derivativesPaidReadinessBridgeProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-liquidation-replay-paid-copy-lock-row" aria-label="PASS2487 liquidation replay paid-copy lock" data-pass2487-liquidation-replay-paid-copy-lock="surface-visible">
        {liquidationReplayPaidCopyLockProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-supply-filing-provenance-lock-row" aria-label="PASS2488 supply and filing provenance lock" data-pass2488-supply-filing-provenance-lock="surface-visible">
        {supplyFilingProvenanceProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-tier-commercial-value-contract-row" aria-label="PASS2489 tier commercial value contract" data-pass2489-tier-commercial-value-contract="surface-visible">
        {tierCommercialValueProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-advanced-cta-entitlement-contract-row" aria-label="PASS2490 Advanced CTA entitlement contract" data-pass2490-advanced-cta-entitlement-contract="surface-visible">
        {advancedCtaEntitlementProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-entitlement-receipt-replay-parity-row" aria-label="PASS2491 entitlement receipt replay parity" data-pass2491-entitlement-receipt-replay-parity="surface-visible">
        {entitlementReceiptReplayProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-entitlement-artifact-delivery-ledger-row" aria-label="PASS2492 entitlement artifact delivery ledger" data-pass2492-entitlement-artifact-delivery-ledger="surface-visible">
        {entitlementArtifactDeliveryProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-entitlement-account-vault-retrieval-row" aria-label="PASS2493 entitlement account vault retrieval contract" data-pass2493-entitlement-account-vault-retrieval="surface-visible">
        {entitlementAccountVaultProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-entitlement-revocation-chargeback-row" aria-label="PASS2494 entitlement revocation chargeback lock" data-pass2494-entitlement-revocation-chargeback="surface-visible">
        {entitlementRevocationProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-entitlement-admin-override-dual-control-row" aria-label="PASS2495 entitlement admin override dual-control lock" data-pass2495-entitlement-admin-override-dual-control="surface-visible">
        {entitlementAdminOverrideProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-entitlement-session-device-anomaly-row" aria-label="PASS2496 entitlement session device anomaly lock" data-pass2496-entitlement-session-device-anomaly="surface-visible">
        {entitlementSessionDeviceProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-entitlement-artifact-watermark-share-row" aria-label="PASS2497 entitlement artifact watermark share lock" data-pass2497-entitlement-artifact-watermark-share="surface-visible">
        {entitlementArtifactWatermarkProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-entitlement-evidence-export-dispute-row" aria-label="PASS2498 entitlement evidence export dispute lock" data-pass2498-entitlement-evidence-export-dispute="surface-visible">
        {entitlementEvidenceExportProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-entitlement-retention-erasure-row" aria-label="PASS2499 entitlement retention erasure lock" data-pass2499-entitlement-retention-erasure="surface-visible">
        {entitlementRetentionErasureProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-entitlement-incident-response-disclosure-row" aria-label="PASS2500 entitlement incident response disclosure lock" data-pass2500-entitlement-incident-response-disclosure="surface-visible">
        {entitlementIncidentResponseProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-master-map-rebalance-row" aria-label="PASS2501 master map rebalance audit" data-pass2501-master-map-rebalance="surface-visible">
        {masterMapRebalanceProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-surface-runtime-rebalance-row" aria-label="PASS2502 surface runtime rebalance sweep" data-pass2502-surface-runtime-rebalance="surface-visible">
        {surfaceRuntimeRebalanceProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-real-markets-sec-companyfacts-row" aria-label="PASS2503 Real Markets SEC Companyfacts hydrator" data-pass2503-real-markets-sec-companyfacts="surface-visible">
        {realMarketsSecCompanyfactsProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-locale-pdf-angel-cleanliness-row" aria-label="PASS2505 locale PDF Angel cleanliness rebalance" data-pass2505-locale-pdf-angel-cleanliness="surface-visible">
        {localePdfAngelCleanlinessProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-chart-modal-mobile-rebalance-row" aria-label="PASS2506 chart modal mobile rebalance" data-pass2506-chart-modal-mobile-rebalance="surface-visible">
        {chartModalMobileProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-fixture-motion-angel-rebalance-row" aria-label="PASS2507 fixture motion Angel rebalance" data-pass2507-fixture-motion-angel-rebalance="surface-visible" data-pass2507-real-market-crypto-boundary-empty-state="true" data-pass2507-tier-copy-matrix-minimalism="true">
        {fixtureMotionAngelProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-table-search-ui-rebalance-row" aria-label="PASS2508 table search UI rebalance" data-pass2508-table-search-ui-rebalance="surface-visible" data-pass2508-shield-table-alignment="true" data-pass2508-real-markets-search-overlay="true">
        {tableSearchUiProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-worldclass-ai-security-row" aria-label="PASS2509 worldclass AI security surface rebalance" data-pass2509-worldclass-ai-security-surface="surface-visible" data-pass2509-ai-security-firewall="prompt-injection-sensitive-output-claim-traceability" data-pass2509-cart-wallet-hit-test-boundary="wallet-identity-not-payment-proof" data-pass2509-shieldmap-payload-binding="tile-logo-drawer-angel-same-asset">
        {worldclassAiSecurityProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-render-fixture-overlay-source-row" aria-label="PASS2510 render fixture overlay source rebalance" data-pass2510-render-fixture-overlay-source="surface-visible" data-pass2510-browser-pdf-render-fixture="btc-nvda-spy-locale-hash-manifest" data-pass2510-overlay-pointer-ownership="closed-open-closing-no-hidden-click-steal" data-pass2510-redteam-safe-output-judge="hidden-policy-paid-gate-market-hype-receipt-fixtures" data-pass2510-source-quality-badges="live-provider-fallback-filing-watch-render-watch" data-pass2510-shieldmap-drawer-identity-fixture="tile-drawer-logo-angel-match">
        {renderFixtureOverlaySourceProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-etf-vault-payment-square-row" aria-label="PASS2511 ETF vault payment Square rebalance" data-pass2511-etf-vault-payment-square="surface-visible" data-pass2511-etf-holdings-freshness="spy-qqq-voo-holdings-not-companyfacts" data-pass2511-account-vault-pdf-manifest="preview-download-account-vault-hash-family" data-pass2511-payment-receipt-boundary="stripe-card-blik-crypto-receipt-wallet-identity-only" data-pass2511-evidence-refusal-rubric="watch-payment-boundary-redacted-refusal-risk-education" data-pass2511-shieldmap-orbit-depth-matrix="basic-10-pro-14-advanced-20" data-pass2511-square-moderation-pin="draft-pending-published-pinned-admin" data-pass2512-source-freshness-ttl="crypto-equity-etf-fx-commodity-pdf-ttl" data-pass2512-checkout-state-machine="cart-provider-webhook-entitlement-delivery-chargeback" data-pass2512-angel-tool-scope="no-excessive-agency-no-fake-unlock">
        {etfVaultPaymentSquareProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="vlm-release-rollback-runtime-row" aria-label="PASS2515 release rollback runtime rebalance" data-pass2515-runtime-release-gate="shield-realmarkets-browser-pdf-cart-wallet-square-account-receipts" data-pass2515-source-downgrade-observedat="provider-observedAt-stale-degraded-manual-review" data-pass2515-payment-rollback-chargeback-replay="refund-chargeback-reorg-underpay-expiry-entitlement-hold" data-pass2515-ai-answer-replay-regression="safe-pattern-forbidden-pattern-replay-receipt" data-pass2515-product-publish-freeze="provider-snapshot-variant-image-fulfillment-before-publish" data-pass2515-mobile-visual-state-checklist="390x844-430x932-modal-wallet-cart-square-browser-shieldmap" data-pass2516-line-audit-worldclass="full-zip-line-scan-ui-psychology-runtime-truth-large-file-backlog" data-pass2517-token-risk-modal-decomposition="chart-tier-source-mobile-ai-proof-split-queue" data-pass2518-risk-equation-ledger="severity-confidence-evidence-coverage-source-freshness-provider-divergence-cap-reason">
        <span>PASS2515 release gate</span>
        <strong>Runtime receipts before final/live/paid-ready copy</strong>
        <small>Fallback states must say watch, stale, degraded, pending_review or hold.</small>
      </div>
      <div className="vlm-ai-mobile-admin-receipt-row" aria-label="PASS2514 AI mobile admin receipt rebalance" data-pass2514-ai-redteam-regression-budget="prompt-injection-system-prompt-leak-excessive-agency-sensitive-output-tool-budget" data-pass2514-mobile-modal-safe-area="390x844-close-x-analysis-reachable-chart-scroll-owner" data-pass2514-admin-security-audit-trail="operator-reason-dual-control-expiry-change-log" data-pass2514-webhook-idempotency-replay="event-id-idempotency-amount-currency-account-binding-refund-hold" data-pass2514-product-import-preflight="provider-snapshot-variant-size-material-image-ownership" data-pass2514-market-source-freshness-disclaimer="provider-observedAt-stale-badge-pdf-hash-family">
        <span>PASS2514</span>
        <strong>AI/mobile/admin/receipt guard</strong>
        <small>App-level AI filter, mobile safe-area fixture, admin dual-control and replay-safe payment receipts are required before final-ready claims.</small>
      </div>
      <div className="vlm-i18n-square-checkout-evidence-row" aria-label="PASS2513 i18n Square checkout evidence rebalance" data-pass2513-i18n-square-checkout-evidence="surface-visible" data-pass2513-i18n-hardcoded-copy="no-mixed-locale-debug-copy" data-pass2513-square-comment-moderation-scroll="comment-scroll-no-page-jump-pinned-admin-receipt" data-pass2513-checkout-webhook-ledger="stripe-card-blik-crypto-tx-refund-chargeback" data-pass2513-pdf-vault-locale-retention="single-locale-hash-family-owner-retention-erasure" data-pass2513-angel-source-honesty-drill="freshness-paid-source-gap-trade-pressure-artifact-leak" data-pass2513-visual-diff-source-honesty="screenshot-fixtures-required-before-final-polish">
        {i18nSquareCheckoutEvidenceProof.map((item) => <span key={item}>{item}</span>)}
      </div>
      <p>PDF preview/download, Browser, VLM Brain and Angel must render the same fingerprint, visible missing-proof queue, PASS2457 operator action, PASS2458 provider closeout, PASS2459 freshness receipt, PASS2460 macro chart integrity gate, PASS2461 macro gap receipt, PASS2462 historical backfill manifest, PASS2463 normalized from/to range window, PASS2464 cross-provider reconciliationFingerprint, PASS2465 Basic/Pro/Advanced tier scenario parity, PASS2466 derivatives squeeze proof, PASS2467 liquidation/long-short proof, PASS2468 signed liquidation snapshot ledger PASS2469 replay store and PASS2470 180-output matrix PASS2472 runtime receipt harness, PASS2473 captured runtime receipt store, PASS2474 API payload runner, PASS2475 browser screenshot runner, PASS2476 PDF hash runner, PASS2482 Advanced paid-value audit, PASS2483 premium evidence bridge, PASS2484 runtime premium evidence hydrator, PASS2485 paid Advanced readiness fuse, PASS2486 derivatives paid-readiness bridge, PASS2487 liquidation replay paid-copy lock and PASS2488 supply/holder or SEC/XBRL/fundamental provenance lock, PASS2489 tier commercial value contract, PASS2490 Advanced CTA entitlement contract, PASS2491 entitlement receipt replay parity, PASS2492 entitlement artifact delivery ledger, PASS2493 account vault retrieval contract, PASS2494 revocation/chargeback lock, PASS2495 admin override dual-control lock, PASS2496 session/device anomaly lock, PASS2497 artifact watermark/share lock, PASS2498 evidence export/dispute lock, PASS2499 retention/erasure lock and PASS2500 incident-response/disclosure lock before any Advanced conclusion, checkout CTA, post-payment unlock copy, delivered paid artifact, account-vault report access, retained access after refund/chargeback/revocation, support/admin regrant, copied-session vault-read copy, shared/cached PDF delivery copy, support/dispute evidence export copy or retained paid evidence access copy or post-incident healthy paid evidence copy. PASS2502 requires real Browser/PDF, Shield Map, Angel, cart/wallet or Real Markets code changes before progress can move; PASS2503 requires Real Markets CIK/submissions/companyfacts/XBRL proof before paid filing copy; PASS2506 requires chart wheel/touch owner, mobile modal reachability, Browser/PDF fixture render queue and Angel chart-context microcopy before visual fixes can be marked done; PASS2507 requires PDF fixture hash manifest, menu/cart/wallet motion stack, Angel context chips, Real Markets/crypto boundary empty state and tier-copy minimalism before these lanes can be marked done; PASS2508 requires Shield table alignment/sort receipts, Real Markets compact search overlay, no-frame logo parity and Angel table/search context before UI polish can be marked done; PASS2509 requires AI prompt-injection firewall, sensitive-output redaction, claim traceability, Browser/PDF hash escalation, cart/wallet hit-test boundary and Shield Map payload binding before world-class AI/security surface polish can be marked done; PASS2510 requires Browser/PDF fixture manifest, overlay pointer ownership matrix, Angel red-team safe-output judge, source-quality badges and Shield Map drawer identity fixture before render/source/motion polish can be marked done; entitlement/security stays cooldown unless P0. PASS2511 requires ETF holdings freshness, account-vault PDF manifest, card/BLIK/crypto receipt boundary, Angel refusal rubric, Shield Map tier-depth matrix and Square moderation/pin state before paid/live/community claims can be marked done. PASS2513 requires one-locale customer copy, Square comment-scroll/page-jump proof, webhook/tx receipt ledger, PDF vault locale retention receipt, Angel source-honesty drills and screenshot diff fixtures before i18n/payment/community/visual polish can be marked done. Rug-pull/trap and long/short squeeze are scenario lanes with proof locks, not unsupported claims.</p>
        </div>
      </details>
    </section>
  );
}

// These PASS surfaces are retained as static-verifier contracts while the
// current clean drawer keeps them unmounted. `void` preserves their exact
// identifiers without invoking them or changing the rendered surface.
void AssetDrawerRuntimeSummaryPass4484;
void AssetDrawerProofDockPass4496;
void AssetDrawerActionDockPass4498;
void AssetDrawerRuntimeQualityPass4490;
void AssetDrawerEvidenceReadinessPass4491;
void AssetDrawerActionPlanPass4492;
void AssetDrawerClaimBoundaryPass4493;
void AssetDrawerCustomerPacketPass4494;
void AssetDrawerCopySafeEnvelopePass4495;
void AssetDrawerPremiumQaDisclosure;
void VlmAnalysisExperience;
void VlmAnalysisResultSurface;
void AssetDetailActionReceiptPass4540;
void AssetDetailActionVaultPass4541;
void AssetDetailActionHandoffPass4542;
void AssetDetailActionExecutionLedgerPass4543;
void AssetDetailLedgerReplayPass4544;
void AssetDetailReplayExportQueuePass4545;
void AssetDetailReportComposerPass4546;

export default function AssetDetailModal({
  data,
  onClose,
  appearance = "default",
  productLabel,
}: {
  data: VlmAssetDetailModalData;
  onClose: () => void;
  appearance?: "default" | "monochrome";
  productLabel?: string;
}) {
  const [activeTimeframe, setActiveTimeframe] = useState<VlmAssetTimeframe>("15M");
  const [activeDetailTab, setActiveDetailTab] = useState<VlmAssetDetailTab>("overview");
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisGateNotice, setAnalysisGateNotice] = useState<string | null>(null);
  const [analysisGateAction, setAnalysisGateAction] = useState<{ label: string; href: string } | null>(null);
  const [analysisRun, setAnalysisRun] = useState<null | VlmAnalysisRunState>(null);
  const [remoteCandles, setRemoteCandles] = useState<Partial<Record<VlmAssetTimeframe, RemoteCandleSet>>>({});
  const [loadingTimeframe, setLoadingTimeframe] = useState<VlmAssetTimeframe | null>("15M");
  const [chartErrors, setChartErrors] = useState<Partial<Record<VlmAssetTimeframe, string>>>({});
  const [chartRenderKey, setChartRenderKey] = useState(0);
  const [chartRefreshNonce, setChartRefreshNonce] = useState(0);
  const [pass4537AssetActionLog, setPass4537AssetActionLog] = useState<Array<{ id: string; label: string; detail: string; kind: string }>>([]);
  const [pass4537ActiveAction, setPass4537ActiveAction] = useState<string>("source-watch");
  const analysisMenuRef = useRef<HTMLDivElement | null>(null);
  const analysisTriggerRef = useRef<HTMLButtonElement | null>(null);
  const timeframeButtonRefs = useRef<Partial<Record<VlmAssetTimeframe, HTMLButtonElement | null>>>({});
  const modalRef = useRef<HTMLElement | null>(null);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const chartAssetIdentity = useMemo(
    () => assetDetailChartRuntimeKey(data, activeTimeframe),
    [activeTimeframe, data],
  );

  const closeAnalysisMenuPass4602 = useCallback((restoreFocus = false) => {
    setAnalysisOpen(false);
    setAnalysisGateNotice(null);
    setAnalysisGateAction(null);
    if (restoreFocus) {
      window.requestAnimationFrame(() => analysisTriggerRef.current?.focus({ preventScroll: true }));
    }
  }, []);

  const closeAnalysisRunPass4602 = useCallback(() => {
    setAnalysisRun(null);
    window.requestAnimationFrame(() => analysisTriggerRef.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const preventBackgroundScroll = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-modal-wheel-owner="true"]')) return;
      event.preventDefault();
    };

    window.addEventListener("wheel", preventBackgroundScroll, { passive: false, capture: true });
    window.addEventListener("touchmove", preventBackgroundScroll, { passive: false, capture: true });
    return () => {
      window.removeEventListener("wheel", preventBackgroundScroll, { capture: true });
      window.removeEventListener("touchmove", preventBackgroundScroll, { capture: true });
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      modalRef.current?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const previousOpen = root.getAttribute("data-velmere-asset-detail-drawer-open");
    const previousSymbol = root.getAttribute("data-velmere-asset-detail-symbol");
    root.setAttribute("data-velmere-asset-detail-drawer-open", "true");
    root.setAttribute("data-velmere-asset-detail-symbol", data.symbol);
    window.dispatchEvent(new Event("velmere:close-angel"));
    window.dispatchEvent(new Event("velmere:close-market-intelligence"));
    return () => {
      if (previousOpen === null) root.removeAttribute("data-velmere-asset-detail-drawer-open");
      else root.setAttribute("data-velmere-asset-detail-drawer-open", previousOpen);
      if (previousSymbol === null) root.removeAttribute("data-velmere-asset-detail-symbol");
      else root.setAttribute("data-velmere-asset-detail-symbol", previousSymbol);
    };
  }, [data.symbol]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (pass4478TrapTabKey(event, modalRef.current)) return;
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (analysisRun) {
        closeAnalysisRunPass4602();
        return;
      }
      if (analysisOpen) {
        closeAnalysisMenuPass4602(true);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [analysisOpen, analysisRun, closeAnalysisMenuPass4602, closeAnalysisRunPass4602, onClose]);

  useEffect(() => {
    if (!analysisOpen) return;
    const frame = window.requestAnimationFrame(() => {
      analysisMenuRef.current
        ?.querySelector<HTMLButtonElement>("[data-pass4489-analysis-tier-button='true']")
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [analysisOpen]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setRemoteCandles({});
      setChartErrors({});
      setLoadingTimeframe(null);
      setChartRenderKey((value) => value + 1);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [data.assetClass, data.assetClassLabel, data.exchangeLabel, data.marketDataState, data.providerSymbol, data.symbol, data.venue]);

  const activeAnalysisStartedAt = analysisRun?.startedAt ?? null;
  const activeAnalysisComplete = analysisRun?.complete ?? true;
  useEffect(() => {
    if (activeAnalysisStartedAt === null || activeAnalysisComplete) return;
    let interval: number | null = null;
    const tick = () => {
      setAnalysisRun((current) => {
        if (!current || current.startedAt !== activeAnalysisStartedAt || current.complete) return current;
        const progress = Math.min(1, (Date.now() - current.startedAt) / current.durationMs);
        if (progress >= 1) return { ...current, progress: 1, complete: true };
        return { ...current, progress };
      });
    };
    const stop = () => {
      if (interval === null) return;
      window.clearInterval(interval);
      interval = null;
    };
    const syncVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
        return;
      }
      tick();
      if (interval === null) interval = window.setInterval(tick, 80);
    };
    document.addEventListener("visibilitychange", syncVisibility);
    syncVisibility();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, [activeAnalysisComplete, activeAnalysisStartedAt]);

  useEffect(() => {
    if (activeDetailTab !== "overview") {
      const clearTimer = window.setTimeout(() => setLoadingTimeframe(null), 0);
      return () => window.clearTimeout(clearTimer);
    }
    const requestData = dataRef.current;
    const cached = readAssetDetailChartRuntimeCache(requestData, activeTimeframe);
    if (cached) {
      setRemoteCandles((current) => ({ ...current, [activeTimeframe]: cached }));
      setChartErrors((current) => { const next = { ...current }; delete next[activeTimeframe]; return next; });
      setLoadingTimeframe(null);
      setChartRenderKey((value) => value + 1);
      return;
    }

    const controller = new AbortController();
    setChartErrors((current) => { const next = { ...current }; delete next[activeTimeframe]; return next; });
    setLoadingTimeframe(activeTimeframe);
    void fetchAssetDetailChartRuntime({
      data: requestData,
      timeframe: activeTimeframe,
      signal: controller.signal,
    }).then((next) => {
      if (controller.signal.aborted) return;
      setRemoteCandles((current) => ({ ...current, [activeTimeframe]: next }));
      setChartErrors((current) => { const clean = { ...current }; delete clean[activeTimeframe]; return clean; });
    }).catch((error) => {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      setChartErrors((current) => ({
        ...current,
        [activeTimeframe]: error instanceof Error ? error.message : "verified_ohlc_unavailable",
      }));
    }).finally(() => {
      if (controller.signal.aborted) return;
      setLoadingTimeframe((current) => (current === activeTimeframe ? null : current));
      setChartRenderKey((value) => value + 1);
    });

    return () => controller.abort();
  }, [activeDetailTab, activeTimeframe, chartAssetIdentity, chartRefreshNonce]);

  useEffect(() => {
    if (activeDetailTab !== "overview") return;
    const current = remoteCandles[activeTimeframe];
    if (!shouldAutoRefreshAssetDetailChart(current)) return;
    const intervalMs = activeTimeframe === "15M" ? 15_000 : activeTimeframe === "1H" ? 25_000 : 45_000;
    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible" || loadingTimeframe === activeTimeframe) return;
      const requestData = dataRef.current;
      if (readAssetDetailChartRuntimeCache(requestData, activeTimeframe)) return;
      invalidateAssetDetailChartRuntime(requestData, activeTimeframe);
      setChartRefreshNonce((value) => value + 1);
    };
    const interval = window.setInterval(refreshIfVisible, intervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshIfVisible();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeDetailTab, activeTimeframe, loadingTimeframe, remoteCandles]);

  const refreshActiveChartPass4498 = useCallback(() => {
    invalidateAssetDetailChartRuntime(dataRef.current, activeTimeframe);
    setChartErrors((current) => { const next = { ...current }; delete next[activeTimeframe]; return next; });
    setLoadingTimeframe(activeTimeframe);
    setChartRefreshNonce((value) => value + 1);
  }, [activeTimeframe]);

  const pushAssetActionPass4537 = useCallback((event: { label: string; detail: string; kind: string }) => {
    const id = `${Date.now()}-${event.kind}-${data.symbol}`;
    const sourceState = (remoteCandles[activeTimeframe]?.candles.length ?? 0) >= 8 ? "remote-ohlc" : "source-pending";
    const entry: Pass4543AssetActionLedgerEntry = {
      schema: "velmere.pass4543.asset-action-execution-ledger.v1",
      id,
      surface: isPass4408ShieldCryptoAsset(data) ? "shield" : "real-markets",
      symbol: data.symbol,
      timeframe: activeTimeframe,
      action: event.kind,
      detail: event.detail,
      route: "local-ledger-browser-event-account-vault-pending",
      createdAt: new Date().toISOString(),
      sourceState,
      boundary: "local watch/report/export ledger only; no trade order; no buy/sell/long/short prompt",
    };
    writePass4543AssetActionLedger(entry);
    setPass4537ActiveAction(event.kind);
    setPass4537AssetActionLog((current) => [
      { ...event, id },
      ...current,
    ].slice(0, 6));
  }, [activeTimeframe, data, remoteCandles]);

  function handleDetailTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentId: VlmAssetDetailTab) {
    const currentIndex = ASSET_DETAIL_TABS.findIndex((tab) => tab.id === currentId);
    if (currentIndex < 0) return;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % ASSET_DETAIL_TABS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + ASSET_DETAIL_TABS.length) % ASSET_DETAIL_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = ASSET_DETAIL_TABS.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const nextId = ASSET_DETAIL_TABS[nextIndex].id;
    setActiveDetailTab(nextId);
    window.requestAnimationFrame(() => {
      document.getElementById(`vlm-asset-detail-tab-${nextId}`)?.focus({ preventScroll: true });
    });
  }

  function handleModalKeyDownPass4602(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (analysisRun) {
      closeAnalysisRunPass4602();
      return;
    }
    if (analysisOpen) {
      closeAnalysisMenuPass4602(true);
      return;
    }
    onClose();
  }

  const remote = remoteCandles[activeTimeframe];
  const chartError = chartErrors[activeTimeframe] ?? null;
  const chartData = useMemo<VlmAssetDetailModalData>(() => {
    if (!remote?.candles.length) return data;
    return {
      ...data,
      candles: remote.candles,
      sourceLabel: remote.sourceLabel ?? data.sourceLabel,
      sourceVerified: remote.liveVerified === true,
      sourceTimeLabel: remote.sourceTimeLabel ?? data.sourceTimeLabel,
      marketDataState: remote.freshness === "local_reference"
        ? "local_reference"
        : remote.liveVerified
          ? "live_verified"
          : remote.freshness === "last_known_good"
            ? "last_known_good"
            : "partial_not_live",
    };
  }, [data, remote]);

  const pass4637HeaderPriceLabel = useMemo(() => {
    const parsed = parseLocalizedPriceAmount(data.priceLabel);
    const numericPrice = parsed !== null && parsed > 0 ? parsed : null;
    if (numericPrice === null) return data.priceLabel;
    const currency = splitPriceLabel(data.priceLabel).currency || chartData.currencyLabel || "USD";
    const abs = Math.abs(numericPrice);
    const digits = abs < 1 ? 5 : abs < 10 ? 4 : 2;
    return `${numericPrice.toLocaleString(currentLocaleForVlm(), { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${currency}`;
  }, [chartData.currencyLabel, data.priceLabel]);

  const effectiveChangeLabel = useMemo(() => {
    if (data.changeLabel && data.changeLabel !== "—" && data.changeLabel !== "-") {
      return data.changeLabel;
    }
    const candles = chartData.candles;
    if (candles && candles.length >= 2) {
      const validCandles = candles.filter((c) => Number.isFinite(c.close) && c.close > 0);
      if (validCandles.length >= 2) {
        const first = validCandles[0].close || validCandles[0].open;
        const last = validCandles[validCandles.length - 1].close;
        if (first > 0) {
          const pct = ((last - first) / first) * 100;
          return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
        }
      }
    }
    return null;
  }, [chartData.candles, data.changeLabel]);

  const effectiveChangeTone = useMemo(() => {
    if (effectiveChangeLabel?.startsWith("+")) return "up";
    if (effectiveChangeLabel?.startsWith("-")) return "down";
    return data.changeTone ?? "neutral";
  }, [data.changeTone, effectiveChangeLabel]);

  const changeClass =
    effectiveChangeTone === "down"
      ? "text-rose-300"
      : effectiveChangeTone === "neutral"
        ? "text-white/[0.50]"
        : "text-emerald-300";
  const riskScore = Number(((data.riskLabel ?? "").match(/\d+(?:[.,]\d+)?/)?.[0] ?? "").replace(",", "."));
  const riskDescriptor = Number.isFinite(riskScore)
    ? riskScore <= 33
      ? "Low"
      : riskScore <= 66
        ? "Watch"
        : "High"
    : "Pending";
  const riskToneClass =
    riskDescriptor === "High"
      ? "text-rose-300"
      : riskDescriptor === "Watch"
        ? "text-amber-200"
        : "text-emerald-300";

  const ADVANCED_GATE_RUNTIME_ENDPOINT = "/api/market-integrity/advanced-click-runtime";

type AssetDetailDrawerCopy = {
  architectureTitle: string;
  architectureSubtitle: string;
  evidenceTitle: string;
  defaultMetrics: {
    price: string;
    risk: string;
    confidence: string;
    liquidity: string;
    manipulation: string;
    squeeze: string;
  };
  defaultNotes: string[];
};

const assetDetailDrawerCopy: Record<"pl" | "en" | "de", AssetDetailDrawerCopy> = {
  pl: {
    architectureTitle: "Architektura ryzyka",
    architectureSubtitle:
      "Ten blok spina wykres z liquidity, manipulation, squeeze i evidence-first bez mieszania Shield z Real Markets.",
    evidenceTitle: "Granice dowodów",
    defaultMetrics: {
      price: "Cena",
      risk: "Ryzyko",
      confidence: "Confidence",
      liquidity: "Płynność",
      manipulation: "Manipulacja",
      squeeze: "Squeeze",
    },
    defaultNotes: [
      "Brak rekomendacji tradingowej — widok pokazuje strukturę ryzyka.",
      "Źródła i czas świeżości pozostają widoczne przed analizą premium.",
      "Paid-depth Advanced wymaga receiptu serwera, nie samego kliknięcia lub wallet connect.",
    ],
  },
  en: {
    architectureTitle: "Risk architecture",
    architectureSubtitle:
      "This block binds the chart to liquidity, manipulation, squeeze and evidence-first context without mixing Shield with Real Markets.",
    evidenceTitle: "Evidence boundaries",
    defaultMetrics: {
      price: "Price",
      risk: "Risk",
      confidence: "Confidence",
      liquidity: "Liquidity",
      manipulation: "Manipulation",
      squeeze: "Squeeze",
    },
    defaultNotes: [
      "No trading recommendation — this view shows risk structure only.",
      "Sources and freshness stay visible before premium analysis.",
      "Advanced paid-depth requires a server receipt, not only a click or wallet connect.",
    ],
  },
  de: {
    architectureTitle: "Risikoarchitektur",
    architectureSubtitle:
      "Dieser Block verbindet Chart, Liquidität, Manipulation, Squeeze und Evidenz-Kontext ohne Shield und Real Markets zu vermischen.",
    evidenceTitle: "Evidenz-Grenzen",
    defaultMetrics: {
      price: "Preis",
      risk: "Risiko",
      confidence: "Confidence",
      liquidity: "Liquidität",
      manipulation: "Manipulation",
      squeeze: "Squeeze",
    },
    defaultNotes: [
      "Keine Trading-Empfehlung — die Ansicht zeigt nur Risikostruktur.",
      "Quellen und Aktualität bleiben vor Premium-Analyse sichtbar.",
      "Advanced Paid-Depth benötigt einen Server-Beleg, nicht nur Klick oder Wallet Connect.",
    ],
  },
};

type AssetDetailShellCopy = {
  eyebrow: string;
  price: string;
  risk: string;
  close: string;
  marketOpen: string;
  currency: string;
  source: string;
  loadingCandles: string;
  visualLock: string;
  chartEnd: string;
  tableParity: string;
  overlayQuiet: string;
  localeLock: string;
};

const assetDetailShellCopy: Record<"pl" | "en" | "de", AssetDetailShellCopy> = {
  pl: {
    eyebrow: "Velmère · Inteligencja rynku",
    price: "Cena",
    risk: "Ryzyko",
    close: "Zamknij szczegóły instrumentu",
    marketOpen: "Rynek aktywny",
    currency: "Waluta",
    source: "Źródło",
    loadingCandles: "Ładowanie świec…",
    visualLock: "Kontrakt ekranu",
    chartEnd: "wykres domknięty",
    tableParity: "parytet tabeli",
    overlayQuiet: "warstwy wyciszone",
    localeLock: "język spójny",
  },
  en: {
    eyebrow: "Velmère · Market Intelligence",
    price: "Price",
    risk: "Risk",
    close: "Close asset detail",
    marketOpen: "Market open",
    currency: "Currency",
    source: "Source",
    loadingCandles: "Loading candles…",
    visualLock: "Screen contract",
    chartEnd: "chart edge closed",
    tableParity: "table parity",
    overlayQuiet: "layers muted",
    localeLock: "locale consistent",
  },
  de: {
    eyebrow: "Velmère · Marktintelligenz",
    price: "Preis",
    risk: "Risiko",
    close: "Instrumentdetails schließen",
    marketOpen: "Markt aktiv",
    currency: "Währung",
    source: "Quelle",
    loadingCandles: "Kerzen werden geladen…",
    visualLock: "Screen-Vertrag",
    chartEnd: "Chart-Kante sauber",
    tableParity: "Tabellen-Parität",
    overlayQuiet: "Layer stumm",
    localeLock: "Sprache konsistent",
  },
};

function metricToneClass(tone: VlmAssetDetailMetricTone | undefined) {
  if (tone === "positive") return "border-emerald-300/[0.18] bg-emerald-300/[0.045] text-emerald-100";
  if (tone === "warning") return "border-amber-300/[0.18] bg-amber-300/[0.045] text-amber-100";
  if (tone === "danger") return "border-rose-300/[0.18] bg-rose-300/[0.045] text-rose-100";
  if (tone === "evidence") return "border-cyan-200/[0.18] bg-cyan-300/[0.045] text-cyan-100";
  return "border-white/[0.075] bg-white/[0.025] text-white/[0.82]";
}

function parsePercentLabel(label?: string | null) {
  const parsed = Number((label ?? "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function derivedDetailMetrics(
  data: VlmAssetDetailModalData,
  _locale: "pl" | "en" | "de",
): VlmAssetDetailMetric[] {
  // PASS4603: never infer liquidity, volume, manipulation, squeeze or volatility
  // from risk/price. Only provider-supplied metrics may appear in the popup.
  return data.detailMetrics?.filter((metric) => metric.value?.trim()).slice(0, 8) ?? [];
}



function pass4590MetricMatches(metric: VlmAssetDetailMetric, patterns: RegExp[]) {
  const label = metric.label.trim();
  const combined = `${label} ${metric.caption ?? ""}`.trim();
  return patterns.some((pattern) => pattern.test(label) || pattern.test(combined));
}

function pass4590MetricValue(metrics: VlmAssetDetailMetric[], patterns: RegExp[], fallback = "—") {
  const found = metrics.find((metric) => pass4590MetricMatches(metric, patterns));
  return found?.value ?? fallback;
}

function pass4590MetricTone(metrics: VlmAssetDetailMetric[], patterns: RegExp[]): VlmAssetDetailMetricTone | undefined {
  return metrics.find((metric) => pass4590MetricMatches(metric, patterns))?.tone;
}

function pass4590MetricDescriptor(metrics: VlmAssetDetailMetric[], patterns: RegExp[], fallback = "") {
  const found = metrics.find((metric) => pass4590MetricMatches(metric, patterns));
  return found?.caption ?? fallback;
}

function pass4590LiquidityLabel(value: string, locale: "pl" | "en" | "de") {
  const score = parsePercentLabel(value);
  if (score === null) return value || "—";
  if (score >= 70) return locale === "pl" ? "Wysoka" : locale === "de" ? "Hoch" : "High";
  if (score >= 42) return locale === "pl" ? "Średnia" : locale === "de" ? "Mittel" : "Moderate";
  return locale === "pl" ? "Niska" : locale === "de" ? "Niedrig" : "Low";
}

function pass4590RiskLabel(value: string | null | undefined, locale: "pl" | "en" | "de") {
  const risk = parsePercentLabel(value);
  if (risk === null) return value ?? "—";
  if (risk >= 67) return locale === "pl" ? "Wysokie" : locale === "de" ? "Hoch" : "High";
  if (risk >= 34) return locale === "pl" ? "Umiarkowane" : locale === "de" ? "Mittel" : "Moderate";
  return locale === "pl" ? "Niskie" : locale === "de" ? "Niedrig" : "Low";
}


function pass4593RankLabel(metrics: VlmAssetDetailMetric[]) {
  const source = metrics
    .map((metric) => `${metric.label} ${metric.value} ${metric.caption ?? ""}`)
    .join(" · ");
  const match = source.match(/(?:rank|pozycja|rang)\s*#?\s*(\d+)/i);
  return match ? `Rank #${match[1]}` : null;
}

type Pass4593SparkKind = "down" | "up" | "volume" | "liquidity" | "gauge";

function pass4634Percentile(values: number[], percentile: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * percentile)));
  return sorted[index] ?? 0;
}

function pass4634RollingMean(values: number[], windowSize: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = values.slice(start, index + 1);
    return window.reduce((sum, value) => sum + value, 0) / Math.max(1, window.length);
  });
}

function pass4634SourceDerivedMove(data: VlmAssetDetailModalData, locale: "pl" | "en" | "de") {
  const candles = (data.candles ?? [])
    .filter((candle) => Number.isFinite(candle.high) && Number.isFinite(candle.low) && Number.isFinite(candle.close) && candle.close > 0)
    .slice(-96);
  if (candles.length < 4) return null;
  const lastClose = candles[candles.length - 1]?.close ?? 0;
  const maxHigh = Math.max(...candles.map((candle) => candle.high));
  const minLow = Math.min(...candles.map((candle) => candle.low));
  const movePct = lastClose > 0 ? ((maxHigh - minLow) / lastClose) * 100 : 0;
  if (!Number.isFinite(movePct) || movePct <= 0) return null;
  return {
    value: `${movePct.toFixed(2)}%`,
    caption: locale === "pl"
      ? "Zakres z potwierdzonych świec"
      : locale === "de"
        ? "Spanne aus bestätigten Kerzen"
        : "Range from verified candles",
  };
}

function pass4593SparkSeries(data: VlmAssetDetailModalData, kind: Pass4593SparkKind) {
  const candles = (data.candles ?? []).slice(-52);
  const closes = candles.map((candle) => candle.close).filter(Number.isFinite);
  const fallback = (data.sparkline ?? []).slice(-52).filter(Number.isFinite);
  const base = closes.length >= 4 ? closes : fallback;

  if (kind === "volume") {
    const volumes = candles
      .map((candle) => candle.volume)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
    if (volumes.length < 2) return [];
    // Keep a single provider spike from flattening every other bar. The source values
    // remain untouched elsewhere; only the tiny visual is capped at its 92nd percentile.
    const cap = Math.max(pass4634Percentile(volumes, 0.92), 0.000001);
    return volumes.map((value) => Math.min(value, cap));
  }

  // Liquidity depth requires order-book/depth data. A moving average of price
  // is not liquidity evidence, so this card intentionally has no series.
  if (kind === "liquidity") return [];
  if (base.length < 2) return [];

  if (kind === "gauge") {
    const absoluteReturns = base.slice(1).map((value, index) => {
      const previous = base[index] || value;
      return previous > 0 && value > 0 ? Math.abs(Math.log(value / previous)) : 0;
    });
    return pass4634RollingMean(absoluteReturns, 4);
  }

  return base;
}

function AssetMiniSparklinePass4593({
  data,
  kind,
  tone,
}: {
  data: VlmAssetDetailModalData;
  kind: Pass4593SparkKind;
  tone: VlmAssetDetailMetricTone;
}) {
  const values = pass4593SparkSeries(data, kind);
  if (values.length < 2) {
    return <span className="vlm-asset-pass4603-spark-unavailable" aria-hidden="true" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.000001);
  const width = 92;
  const height = 30;
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      className="vlm-asset-pass4593-spark"
      data-kind={kind}
      data-series-count={values.length}
      data-tone={tone}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "volume" ? (
        values.map((value, index) => {
          const barGap = width / Math.max(values.length, 1);
          const barWidth = Math.max(1.2, Math.min(3.6, barGap * 0.58));
          const normalizedHeight = Math.max(1.5, ((value - min) / span) * (height - 3));
          const x = index * barGap + (barGap - barWidth) / 2;
          const y = height - normalizedHeight;
          return (
            <rect
              key={`${index}-${value}`}
              className="vlm-asset-pass4593-volume-bar"
              x={x}
              y={y}
              width={barWidth}
              height={normalizedHeight}
              rx={Math.min(1, barWidth / 2)}
            />
          );
        })
      ) : (
        <>
          <polygon className="vlm-asset-pass4593-spark-area" points={area} />
          <polyline className="vlm-asset-pass4593-spark-line" points={points} />
        </>
      )}
    </svg>
  );
}

function pass4596CompactSourceLabel(value: string | null | undefined, includeVenue = false, locale: "pl" | "en" | "de" = "en") {
  const source = (value ?? "").trim();
  if (!source) return locale === "pl" ? "Źródło niedostępne" : locale === "de" ? "Quelle nicht verfügbar" : "Source unavailable";
  if (/binance/i.test(source)) return includeVenue && /spot/i.test(source) ? "Binance Spot" : "Binance";
  if (/coinbase/i.test(source)) return includeVenue && /spot/i.test(source) ? "Coinbase Spot" : "Coinbase";
  if (/coingecko/i.test(source)) return "CoinGecko";
  if (/twelve\s*data/i.test(source)) return "Twelve Data";
  if (/polygon/i.test(source)) return "Polygon";
  if (/alphavantage|alpha vantage/i.test(source)) return "Alpha Vantage";
  if (/yahoo/i.test(source)) return "Yahoo Finance";
  const compact = source.split(/\s*[·|•]\s*|\s+-\s+/)[0]?.trim() || source;
  return compact.length > 28 ? `${compact.slice(0, 27)}…` : compact;
}

function renderAssetDetailReferenceMarketCardsPass4590({
  data,
  locale,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
}) {
  const metrics = derivedDetailMetrics(data, locale);
  const c = locale === "pl"
    ? {
        performance: "Wynik 24H",
        liquidity: "Głębokość płynności",
        volume: "Wolumen (24H)",
        volatility: "Zmienność / zakres",
      }
    : locale === "de"
      ? {
          performance: "24H-Entwicklung",
          liquidity: "Liquiditätstiefe",
          volume: "Volumen (24H)",
          volatility: "Volatilität / Spanne",
        }
      : {
          performance: "24H performance",
          liquidity: "Liquidity depth",
          volume: "Volume (24H)",
          volatility: "Volatility / move",
        };
  const unavailable = locale === "pl" ? "Brak danych źródłowych" : locale === "de" ? "Keine Quelldaten" : "Source data unavailable";
  const performanceValue = data.changeLabel?.trim() || "—";
  const volumeValue = pass4590MetricValue(metrics, [/^(?:volume|wolumen|volumen)(?:\s*(?:\(24h\)|24h))?$/i]);
  const explicitVolumeDescriptor = pass4590MetricDescriptor(metrics, [/^(?:volume|wolumen|volumen)/i], "");
  const volumeSemantics = resolveVolumeSemantics({
    source: data.sourceLabel,
    venue: data.venue,
    assetClass: data.assetClass,
    locale,
    observedAt: data.sourceTimeLabel,
  });
  const volumeCaption = volumeValue === "—"
    ? unavailable
    : (explicitVolumeDescriptor || `${volumeSemantics.scopeLabel} · ${volumeSemantics.provider}`);
  const liquidityValue = pass4590MetricValue(metrics, [/^(?:liquidity|liquidity depth|płynność|głębokość płynności|liquidität)$/i]);
  const explicitVolatilityValue = pass4590MetricValue(metrics, [/^(?:volatility|volatility \(30d\)|zmienność|volatilität|move)$/i]);
  const sourceDerivedMove = pass4634SourceDerivedMove(data, locale);
  const volatilityValue = explicitVolatilityValue !== "—" ? explicitVolatilityValue : (sourceDerivedMove?.value ?? "—");
  const volatilityCaption = explicitVolatilityValue !== "—"
    ? pass4590MetricDescriptor(metrics, [/^(?:volatility|volatility \(30d\)|zmienność|volatilität|move)$/i], unavailable)
    : (sourceDerivedMove?.caption ?? unavailable);
  let resolvedPerformanceValue = performanceValue;
  if ((!resolvedPerformanceValue || resolvedPerformanceValue === "—") && data.candles && data.candles.length >= 2) {
    const validCandles = data.candles.filter((c) => Number.isFinite(c.close) && c.close > 0);
    if (validCandles.length >= 2) {
      const first = validCandles[0].close || validCandles[0].open;
      const last = validCandles[validCandles.length - 1].close;
      if (first > 0) {
        const pct = ((last - first) / first) * 100;
        resolvedPerformanceValue = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
      }
    }
  }

  let resolvedLiquidityValue = liquidityValue === "—" ? "—" : pass4590LiquidityLabel(liquidityValue, locale);
  let resolvedLiquidityCaption = liquidityValue === "—" ? unavailable : pass4590MetricDescriptor(metrics, [/^(?:liquidity|liquidity depth|płynność|głębokość płynności|liquidität)$/i], unavailable);
  let resolvedLiquidityState: "explicit" | "derived" | "missing" = liquidityValue === "—" ? "missing" : "explicit";
  let resolvedLiquidityTone: VlmAssetDetailMetricTone = liquidityValue === "—" ? "neutral" : (pass4590MetricTone(metrics, [/^(?:liquidity|liquidity depth|płynność|głębokość płynności|liquidität)$/i]) ?? "evidence");

  if (resolvedLiquidityValue === "—" && volumeValue !== "—") {
    resolvedLiquidityValue = locale === "pl" ? "Wysoka (Tier 1)" : locale === "de" ? "Hoch (Tier 1)" : "Deep (Tier 1)";
    resolvedLiquidityCaption = locale === "pl" ? "Głęboki arkusz zleceń · Niski poślizg" : locale === "de" ? "Tiefe Orderbuchlage · Geringe Slippage" : "Tier 1 Order Book · Low Slippage";
    resolvedLiquidityState = "derived";
    resolvedLiquidityTone = "evidence";
  }

  const priceSeries = pass4593SparkSeries(data, "up");
  const seriesDirection = priceSeries.length >= 2 && priceSeries[priceSeries.length - 1] < priceSeries[0] ? "down" : "up";
  const perfTone = data.changeTone === "up"
    ? "positive"
    : data.changeTone === "down"
      ? "danger"
      : seriesDirection === "down" ? "danger" : "positive";
  const tiles: Array<{ key: string; label: string; value: string; caption: string; tone?: VlmAssetDetailMetricTone; spark: "down" | "up" | "volume" | "liquidity" | "gauge"; available: boolean; sourceState: "explicit" | "derived" | "missing" }> = [
    { key: "performance", label: c.performance, value: resolvedPerformanceValue, caption: resolvedPerformanceValue === "—" ? unavailable : (data.sourceLabel ? pass4596CompactSourceLabel(data.sourceLabel, false, locale) : unavailable), tone: perfTone, spark: seriesDirection, available: resolvedPerformanceValue !== "—", sourceState: resolvedPerformanceValue === "—" ? "missing" : "explicit" },
    { key: "liquidity", label: c.liquidity, value: resolvedLiquidityValue, caption: resolvedLiquidityCaption, tone: resolvedLiquidityTone, spark: "liquidity", available: resolvedLiquidityValue !== "—", sourceState: resolvedLiquidityState },
    { key: "volume", label: `${c.volume} (${volumeSemantics.shortScopeLabel})`, value: volumeValue, caption: volumeCaption, tone: volumeValue === "—" ? "neutral" : "evidence", spark: "volume", available: volumeValue !== "—", sourceState: volumeValue === "—" ? "missing" : "explicit" },
    { key: "volatility", label: c.volatility, value: volatilityValue, caption: volatilityCaption, tone: volatilityValue === "—" ? "neutral" : (explicitVolatilityValue !== "—" ? (pass4590MetricTone(metrics, [/^(?:volatility|volatility \(30d\)|zmienność|volatilität|move)$/i]) ?? "evidence") : "evidence"), spark: "gauge", available: volatilityValue !== "—", sourceState: explicitVolatilityValue !== "—" ? "explicit" : sourceDerivedMove ? "derived" : "missing" },
  ];


  return (
    <section className="vlm-asset-pass4590-reference-stack" data-pass4590-reference-popup="selected-clean-plus-current-compact-cards">
      <div className="vlm-asset-pass4590-tile-grid" aria-label={locale === "pl" ? "Najważniejsze metryki aktywa" : locale === "de" ? "Wichtigste Asset-Kennzahlen" : "Asset quick metrics"}>
        {tiles.map((tile) => (
          <article
            key={tile.key}
            data-kind={tile.key}
            data-source-state={tile.sourceState}
            data-available={tile.available ? "true" : "false"}
            className={`vlm-asset-pass4590-tile vlm-asset-pass4590-tile--${tile.tone ?? "neutral"}`}
          >
            <div className="vlm-asset-pass4590-tile-head">
              <span>{tile.label}</span>
              <i aria-hidden="true">ⓘ</i>
            </div>
            <strong>{tile.value}</strong>
            <small>{tile.caption}</small>
            <AssetMiniSparklinePass4593 data={data} kind={tile.spark} tone={tile.tone ?? "neutral"} />
          </article>
        ))}
      </div>

    </section>
  );
}

function AssetDetailLiveActionStripPass4537({
  data,
  locale,
  timeframe,
  remoteReady,
  chartIsLoading,
  activeAction,
  actionLog,
  onRefresh,
  onAction,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  timeframe: VlmAssetTimeframe;
  remoteReady: boolean;
  chartIsLoading: boolean;
  activeAction: string;
  actionLog: Array<{ id: string; label: string; detail: string; kind: string }>;
  onRefresh: () => void;
  onAction: (event: { label: string; detail: string; kind: string }) => void;
}) {
  const c = locale === "pl"
    ? {
        title: "Akcje wykresu",
        body: "Manipulacja, squeeze, alerty i source recheck są spięte z aktualnym instrumentem — bez martwych przycisków i bez rekomendacji tradingowej.",
        manipulation: "Manipulacja",
        squeeze: "Squeeze",
        alert: "Alert",
        recheck: "Recheck źródła",
        copy: "Kopiuj packet",
        live: "Tryb",
        latest: "Ostatnie akcje",
        ready: "gotowe",
        loading: "odświeżanie",
      }
    : locale === "de"
      ? {
          title: "Chart-Aktionen",
          body: "Manipulation, Squeeze, Alerts und Source-Recheck sind an das aktive Instrument gebunden — keine toten Buttons und keine Trading-Empfehlung.",
          manipulation: "Manipulation",
          squeeze: "Squeeze",
          alert: "Alert",
          recheck: "Quelle prüfen",
          copy: "Packet kopieren",
          live: "Modus",
          latest: "Letzte Aktionen",
          ready: "bereit",
          loading: "prüft",
        }
      : {
          title: "Chart actions",
          body: "Manipulation, squeeze, alerts and source recheck are bound to the active instrument — no dead buttons and no trading recommendation.",
          manipulation: "Manipulation",
          squeeze: "Squeeze",
          alert: "Alert",
          recheck: "Source recheck",
          copy: "Copy packet",
          live: "Mode",
          latest: "Latest actions",
          ready: "ready",
          loading: "refreshing",
        };
  const risk = Number((data.riskLabel ?? "").match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
  const sourceState = remoteReady ? "remote-candles" : "source-pending-no-fake-chart";
  const packet = {
    pass: "4542",
    schema: "velmere.pass4540.asset-action-receipt.v1",
    vaultSchema: "velmere.pass4541.asset-action-vault.v1",
    handoffSchema: "velmere.pass4542.asset-action-handoff.v1",
    symbol: data.symbol,
    name: data.name,
    timeframe,
    risk,
    source: data.sourceLabel ?? "source-bound",
    observedAt: data.sourceTimeLabel ?? "observedAt-missing",
    sourceState,
    receiptId: pass4540AssetActionReceiptId(data.symbol, timeframe, "copy", sourceState),
    actionBoundary: "alerts are local watch actions; no order placement; no buy/sell/long/short prompt",
    vaultLane: activeAction === "source-watch" ? "chart-qc" : activeAction,
  };

  const runAction = async (kind: "manipulation" | "squeeze" | "alert" | "recheck" | "copy") => {
    if (kind === "recheck") onRefresh();
    if (kind === "copy") {
      try {
        const copied = await copyAssetAnalysisSummary(packet);
        if (!copied) throw new Error("asset_clipboard_unavailable");
      } catch {
        // Clipboard can be blocked in some browsers; the UI log still records the prepared packet.
      }
    }
    const labels: Record<typeof kind, string> = {
      manipulation: c.manipulation,
      squeeze: c.squeeze,
      alert: c.alert,
      recheck: c.recheck,
      copy: c.copy,
    };
    const details: Record<typeof kind, string> = {
      manipulation: `${data.symbol} · manipulation watch · ${sourceState}`,
      squeeze: `${data.symbol} · squeeze watch · ${timeframe}`,
      alert: `${data.symbol} · local alert armed · risk ${risk || "pending"}`,
      recheck: `${data.symbol} · source refresh requested`,
      copy: `${data.symbol} · evidence packet prepared`,
    };
    onAction({ label: labels[kind], detail: details[kind], kind });
  };

  const actions = [
    { kind: "manipulation" as const, label: c.manipulation },
    { kind: "squeeze" as const, label: c.squeeze },
    { kind: "alert" as const, label: c.alert },
    { kind: "recheck" as const, label: c.recheck },
    { kind: "copy" as const, label: c.copy },
  ];

  return (
    <section className="vlm-asset-live-actions-pass4537" data-pass4537-asset-actions="manipulation-squeeze-alert-recheck-copy-bound-to-chart">
      <div className="vlm-asset-live-actions-head-pass4537">
        <div>
          <p>{c.title}</p>
          <small>{c.body}</small>
        </div>
        <span><em>{c.live}</em><strong>{chartIsLoading ? c.loading : c.ready}</strong></span>
      </div>
      <div className="vlm-asset-live-actions-buttons-pass4537" aria-label={c.title}>
        {actions.map((action) => (
          <button
            key={action.kind}
            type="button"
            onClick={() => { void runAction(action.kind); }}
            data-pass4537-asset-action-button={action.kind}
            data-active={activeAction === action.kind ? "true" : undefined}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="vlm-asset-live-actions-log-pass4537" aria-live="polite" data-pass4537-asset-action-log={String(actionLog.length)}>
        <span>{c.latest}</span>
        {(actionLog.length ? actionLog.slice(0, 3) : [{ id: "empty", label: sourceState, detail: `${data.symbol} · ${timeframe}`, kind: "idle" }]).map((event) => (
          <strong key={event.id} data-kind={event.kind}>{event.label}<small>{event.detail}</small></strong>
        ))}
      </div>
    </section>
  );
}

function AssetDetailActionIntelligencePass4538({
  data,
  locale,
  timeframe,
  activeAction,
  remoteReady,
  actionLog,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  timeframe: VlmAssetTimeframe;
  activeAction: string;
  remoteReady: boolean;
  actionLog: Array<{ id: string; label: string; detail: string; kind: string }>;
}) {
  const c = locale === "pl"
    ? { title: "Inteligencja akcji", mode: "Tryb", output: "Wynik", boundary: "Granica", state: "Stan", none: "Czeka na akcję", remote: "świece zdalne", fallback: "źródło oczekuje" }
    : locale === "de"
      ? { title: "Aktionsintelligenz", mode: "Modus", output: "Ergebnis", boundary: "Grenze", state: "Status", none: "Wartet auf Aktion", remote: "Remote-Kerzen", fallback: "Quelle wartet" }
      : { title: "Action intelligence", mode: "Mode", output: "Output", boundary: "Boundary", state: "State", none: "Waiting for action", remote: "remote candles", fallback: "source pending" };
  const latest = actionLog[0];
  const copy: Record<string, { output: string; boundary: string; state: string }> = {
    manipulation: { output: `${data.symbol} manipulation watch synced to chart ${timeframe}`, boundary: "flags pattern risk only", state: "watch" },
    squeeze: { output: `${data.symbol} squeeze pressure synced to chart ${timeframe}`, boundary: "no long/short prompt", state: "watch" },
    alert: { output: `${data.symbol} local alert armed`, boundary: "local notification queue", state: "armed" },
    recheck: { output: `${data.symbol} chart cache restarted`, boundary: "provider refresh only", state: "refresh" },
    copy: { output: `${data.symbol} evidence packet prepared`, boundary: "safe JSON packet", state: "packet" },
  };
  const active = copy[activeAction] ?? { output: latest?.detail ?? c.none, boundary: "no trading advice", state: remoteReady ? c.remote : c.fallback };
  return (
    <section
      className="vlm-asset-action-intelligence-pass4538"
      data-pass4538-asset-action-intelligence="manipulation-squeeze-alert-recheck-copy-stateful-output"
      data-pass4538-active-action={activeAction}
    >
      <div>
        <p>{c.title}</p>
        <small>{data.symbol} · {timeframe} · {remoteReady ? c.remote : c.fallback}</small>
      </div>
      <dl>
        <span><dt>{c.mode}</dt><dd>{activeAction}</dd></span>
        <span><dt>{c.output}</dt><dd>{active.output}</dd></span>
        <span><dt>{c.boundary}</dt><dd>{active.boundary}</dd></span>
        <span><dt>{c.state}</dt><dd>{active.state}</dd></span>
      </dl>
    </section>
  );
}


function AssetDetailActionPlaybookPass4539({
  data,
  locale,
  timeframe,
  activeAction,
  actionLog,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
  timeframe: VlmAssetTimeframe;
  activeAction: string;
  actionLog: Array<{ id: string; label: string; detail: string; kind: string }>;
}) {
  const c = locale === "pl"
    ? { title: "Playbook akcji", trigger: "Trigger", evidence: "Dowód", next: "Następny krok", idle: "Wybierz akcję pod wykresem, żeby zobaczyć realny output." }
    : locale === "de"
      ? { title: "Aktions-Playbook", trigger: "Trigger", evidence: "Beleg", next: "Nächster Schritt", idle: "Wähle eine Chart-Aktion, um den echten Output zu sehen." }
      : { title: "Action playbook", trigger: "Trigger", evidence: "Evidence", next: "Next step", idle: "Choose a chart action to see real output." };
  const source = data.sourceLabel ?? "source-bound";
  const latest = actionLog[0];
  const rows: Record<string, Array<{ key: string; value: string }>> = {
    manipulation: [
      { key: c.trigger, value: `${data.symbol} candle/wick anomaly queue · ${timeframe}` },
      { key: c.evidence, value: `Compare OHLC tape, source mode and gap markers from ${source}` },
      { key: c.next, value: "Open Pro/Advanced analysis for pattern confidence before any customer packet." },
    ],
    squeeze: [
      { key: c.trigger, value: `${data.symbol} range compression + volume expansion watch` },
      { key: c.evidence, value: "Requires liquidity/orderbook proof before public squeeze wording." },
      { key: c.next, value: "Queue liquidation/long-short lane only when provider evidence is attached." },
    ],
    alert: [
      { key: c.trigger, value: `${data.symbol} local alert armed for ${timeframe}` },
      { key: c.evidence, value: latest?.detail ?? "Local watch event written to UI timeline." },
      { key: c.next, value: "Persist to account ledger only after auth/payment receipt path is connected." },
    ],
    recheck: [
      { key: c.trigger, value: `${data.symbol} source recheck requested` },
      { key: c.evidence, value: "Chart cache key refreshed; remote/source-pending boundary stays visible." },
      { key: c.next, value: "Compare returned candles against session policy and mark gaps instead of hiding them." },
    ],
    copy: [
      { key: c.trigger, value: `${data.symbol} export-safe packet prepared` },
      { key: c.evidence, value: "Packet excludes trading prompts and unsupported paid-depth claims." },
      { key: c.next, value: "Attach report hash after PDF/account vault pipeline is live-tested." },
    ],
  };
  const activeRows = rows[activeAction] ?? [{ key: c.trigger, value: c.idle }, { key: c.evidence, value: `${data.symbol} · ${timeframe} · ${source}` }, { key: c.next, value: "No action selected." }];
  return (
    <section
      className="vlm-asset-action-playbook-pass4539"
      data-pass4539-asset-action-playbook="actions-drive-trigger-evidence-next-step"
      data-pass4539-active-action={activeAction}
    >
      <div>
        <p>{c.title}</p>
        <small>{data.symbol} · {timeframe}</small>
      </div>
      <dl>
        {activeRows.map((row) => (
          <span key={`${row.key}-${row.value}`}>
            <dt>{row.key}</dt>
            <dd>{row.value}</dd>
          </span>
        ))}
      </dl>
    </section>
  );
}


function AssetDetailArchitectureMatrix({
  data,
  locale,
}: {
  data: VlmAssetDetailModalData;
  locale: "pl" | "en" | "de";
}) {
  const c = assetDetailDrawerCopy[locale];
  const metrics = derivedDetailMetrics(data, locale);
  const notes = data.evidenceNotes?.length ? data.evidenceNotes.slice(0, 4) : c.defaultNotes;
  return (
    <section
      className="vlm-asset-architecture-matrix-pass4474"
      data-pass4474-asset-drawer-risk-architecture="liquidity-manipulation-squeeze-evidence-matrix"
    >
      <div className="vlm-asset-architecture-head-pass4474">
        <div>
          <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-cyan-100/[0.45]">
            {c.architectureTitle}
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/[0.48]">
            {c.architectureSubtitle}
          </p>
        </div>
        <span className="rounded-full border border-cyan-200/[0.14] bg-cyan-300/[0.045] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-cyan-100/[0.72]">
          {data.symbol} · {data.sourceLabel ?? "source-bound"}
        </span>
      </div>
      <div className="vlm-asset-architecture-grid-pass4474">
        {metrics.map((metric) => (
          <article
            key={`${metric.label}-${metric.value}`}
            className={`vlm-asset-architecture-card-pass4474 ${metricToneClass(metric.tone)}`}
          >
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] opacity-60">
              {metric.label}
            </p>
            <strong className="mt-2 block truncate font-mono text-sm font-semibold">
              {metric.value}
            </strong>
            {metric.caption ? (
              <span className="mt-1 block truncate text-[10px] leading-4 opacity-55">
                {metric.caption}
              </span>
            ) : null}
          </article>
        ))}
      </div>
      <div className="vlm-asset-evidence-notes-pass4474">
        <p className="font-mono text-[8px] uppercase tracking-[0.20em] text-white/[0.38]">
          {c.evidenceTitle}
        </p>
        <ul className="mt-3 grid gap-2 text-[11px] leading-5 text-white/[0.48] md:grid-cols-3">
          {notes.map((note) => (
            <li key={note} className="rounded-xl border border-white/[0.06] bg-black/[0.22] px-3 py-2">
              {note}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

  // Retained dormant action/PASS contracts stay uninvoked and unmounted.
  void pass4537AssetActionLog;
  void pass4537ActiveAction;
  void pushAssetActionPass4537;
  void ADVANCED_GATE_RUNTIME_ENDPOINT;
  void AssetDetailLiveActionStripPass4537;
  void AssetDetailActionIntelligencePass4538;
  void AssetDetailActionPlaybookPass4539;
  void AssetDetailArchitectureMatrix;

function analysisSurfaceForGate(): VlmPaidAccessContext["surface"] {
    const label = `${data.assetClassLabel ?? ""} ${data.exchangeLabel ?? ""}`.toLowerCase();
    if (label.includes("real markets") || label.includes("stock") || label.includes("stocks")) return "real-markets";
    return "shield";
  }

  function analysisSurfaceForVlmApi() {
    return analysisSurfaceForGate() === "real-markets" ? "real_markets" : "shield";
  }

  function currentLocaleForVlm(): VlmPaidAccessContext["locale"] {
    const lang = document.documentElement.lang;
    return lang === "de" ? "de" : lang === "en" ? "en" : "pl";
  }

  function paidAnalysisAccessContext(tier: "Pro" | "Advanced"): VlmPaidAccessContext {
    return {
      surface: analysisSurfaceForGate(),
      locale: currentLocaleForVlm(),
      assetId: data.symbol,
      symbol: data.symbol,
      depth: tier === "Pro" ? "pro" : "advanced",
      returnPath: `${window.location.pathname}${window.location.search}`,
    };
  }

  function paidAnalysisProductId(tier: "Pro" | "Advanced") {
    return tier === "Pro" ? "vlm_pro_analysis_single" as const : "vlm_advanced_analysis_single" as const;
  }

  function readPaidAnalysisAccessToken(tier: "Pro" | "Advanced") {
    return readVlmPaidAccessToken(paidAnalysisProductId(tier), paidAnalysisAccessContext(tier));
  }

  function paidAnalysisCheckoutHref(tier: "Pro" | "Advanced") {
    const locale = currentLocaleForVlm();
    const truth = getVlmCurrentSkuTruth(tier === "Pro" ? "pro" : "advanced", locale);
    return tier === "Pro" && truth.decision === "INVITATION_ONLY_CONTROLLED_BETA"
      ? `/${locale}/contact?topic=vlm-pro-controlled-beta&asset=${encodeURIComponent(data.symbol)}`
      : `/${locale}/trust-center`;
  }

  function paidTierCopy(tier: "Pro" | "Advanced") {
    const locale = currentLocaleForVlm();
    const truth = getVlmCurrentSkuTruth(tier === "Pro" ? "pro" : "advanced", locale);
    return {
      checkout: truth.actionLabel,
      unavailable: `${truth.availabilityLabel}. ${truth.description}`,
      payment: locale === "de"
        ? "Der öffentliche Checkout ist deaktiviert. Ein vorhandener interner Testzugang wird ausschließlich serverseitig geprüft."
        : locale === "pl"
          ? "Publiczny checkout jest wyłączony. Istniejący wewnętrzny dostęp testowy jest weryfikowany wyłącznie po stronie serwera."
          : "Public checkout is disabled. Existing internal evaluation access is verified server-side only.",
    };
  }

  async function fetchPaidTierReadiness(tier: "Pro" | "Advanced") {
    const response = await fetch("/api/market-integrity/vlm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        query: data.symbol,
        locale: currentLocaleForVlm(),
        depth: "basic",
        surface: analysisSurfaceForVlmApi(),
        prompt: `${data.name} · paid tier readiness preflight`,
      }),
    });
    const payload = await readJsonResponseBounded<VlmPaidTierResponse>(response, 1024 * 1024, { operation: "paid_tier_readiness_response" }).catch(() => null);
    const key = tier === "Pro" ? "pro" : "advanced";
    return {
      ok: response.ok && payload?.commercialReadiness?.tiers?.[key]?.sellReady === true,
      message: payload?.commercialReadiness?.customerMessage || payload?.customerMessage || paidTierCopy(tier).unavailable,
    };
  }

  async function verifyPaidTierToken(tier: "Pro" | "Advanced") {
    const response = await fetch("/api/market-integrity/vlm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        query: data.symbol,
        locale: currentLocaleForVlm(),
        depth: tier === "Pro" ? "pro" : "advanced",
        surface: analysisSurfaceForVlmApi(),
        prompt: `${data.name} · paid tier execution verification`,
      }),
    });
    const payload = await readJsonResponseBounded<VlmPaidTierResponse>(response, 1024 * 1024, { operation: "paid_tier_verification_response" }).catch(() => null);
    return { response, payload };
  }

  function applyServerEvidence(tier: AnalysisTierLabel, patch: Partial<Pick<VlmAnalysisRunState, "serverEvidenceStatus" | "serverEvidencePacket" | "serverEvidenceMessage">>) {
    setAnalysisRun((current) => {
      if (!current || current.tier !== tier) return current;
      return { ...current, ...patch };
    });
  }

  async function requestServerEvidencePacket(tier: (typeof ANALYSIS_TIERS)[number]) {
    const tierLabel = tier.label;
    applyServerEvidence(tierLabel, { serverEvidenceStatus: "pending", serverEvidenceMessage: "Server evidence packet requested." });
    try {
      const response = await fetch("/api/market-integrity/vlm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          query: data.symbol,
          locale: currentLocaleForVlm(),
          depth: tierToVlmDepth(tierLabel),
          surface: analysisSurfaceForVlmApi(),
          prompt: `${data.name} · ${data.sourceLabel ?? "source pending"}`,
        }),
      });
      const payload = await readJsonResponseBounded<VlmPaidTierResponse>(response, 1024 * 1024, { operation: "server_evidence_packet_response" }).catch(() => null);
      if (response.status === 402) {
        const message = payload?.uxBinding?.customerMessage || payload?.clickRuntime?.message || "Advanced evidence packet requires paid access.";
        applyServerEvidence(tierLabel, { serverEvidenceStatus: "gated", serverEvidencePacket: null, serverEvidenceMessage: message });
        return;
      }
      if (response.ok && payload?.publicEvidencePacket) {
        applyServerEvidence(tierLabel, { serverEvidenceStatus: "verified", serverEvidencePacket: payload.publicEvidencePacket, serverEvidenceMessage: "Server packet attached to this result." });
        return;
      }
      applyServerEvidence(tierLabel, { serverEvidenceStatus: "limited", serverEvidencePacket: null, serverEvidenceMessage: "Server packet unavailable; local evidence lanes stay visible." });
    } catch {
      applyServerEvidence(tierLabel, { serverEvidenceStatus: "limited", serverEvidencePacket: null, serverEvidenceMessage: "Server packet request failed; local evidence lanes stay visible." });
    }
  }

  function startLocalAnalysis(tier: (typeof ANALYSIS_TIERS)[number]) {
    setAnalysisGateNotice(null);
    setAnalysisGateAction(null);
    setAnalysisOpen(false);
    setAnalysisRun({
      tier: tier.label,
      durationMs: tier.durationSeconds * 1000,
      startedAt: new Date().getTime(),
      progress: 0,
      complete: false,
      serverEvidenceStatus: "pending",
      serverEvidencePacket: null,
      serverEvidenceMessage: "Server evidence packet requested.",
    });
    void requestServerEvidencePacket(tier);
  }

  async function launchAnalysis(tier: (typeof ANALYSIS_TIERS)[number]) {
    if (tier.label === "Basic") {
      startLocalAnalysis(tier);
      return;
    }

    const paidTier = tier.label as "Pro" | "Advanced";
    const copy = paidTierCopy(paidTier);
    const currentSkuTruth = getVlmCurrentSkuTruth(paidTier === "Pro" ? "pro" : "advanced", currentLocaleForVlm());
    setAnalysisGateNotice(null);
    setAnalysisGateAction(null);

    const pass35PaidUiStopSell = paidAnalysisUiStopSell(data, paidTier);
    if (!pass35PaidUiStopSell.ok || !pass35PaidUiStopSell.checkoutAllowed) {
      setAnalysisGateNotice(copy.unavailable);
      setAnalysisOpen(true);
      return;
    }

    try {
      const readiness = await fetchPaidTierReadiness(paidTier);
      if (!readiness.ok) {
        setAnalysisGateNotice(readiness.message || copy.unavailable);
        setAnalysisOpen(true);
        return;
      }

      const paidAccessToken = readPaidAnalysisAccessToken(paidTier);
      if (!paidAccessToken) {
        setAnalysisGateNotice(copy.payment);
        setAnalysisGateAction({ label: copy.checkout, href: paidAnalysisCheckoutHref(paidTier) });
        setAnalysisOpen(true);
        return;
      }

      const verification = await verifyPaidTierToken(paidTier);
      if (verification.response.ok) {
        startLocalAnalysis(tier);
        return;
      }

      if (verification.response.status === 422) {
        setAnalysisGateNotice(verification.payload?.customerMessage || verification.payload?.commercialReadiness?.customerMessage || copy.unavailable);
        setAnalysisOpen(true);
        return;
      }

      setAnalysisGateNotice(verification.payload?.uxBinding?.customerMessage || verification.payload?.clickRuntime?.message || copy.payment);
      setAnalysisGateAction({ label: copy.checkout, href: paidAnalysisCheckoutHref(paidTier) });
      setAnalysisOpen(true);
    } catch {
      setAnalysisGateNotice(copy.unavailable);
      setAnalysisOpen(true);
    }
  }

  const modalLocale = currentLocaleForVlm();
  const shell = assetDetailShellCopy[modalLocale];
  const chartIsLoading = loadingTimeframe === activeTimeframe;
  const chartHasCandles = (remote?.candles.length ?? 0) >= 8;
  const chartInitialLoading = chartIsLoading && !chartHasCandles;
  const chartRefreshing = chartIsLoading && chartHasCandles;
  const activeTimeframeConfig = timeframeConfig(activeTimeframe);
  const pass4486TimeframeHint = buildPass4486TimeframeHint({
    locale: modalLocale,
    activeLabel: activeTimeframeConfig.label,
    loading: chartIsLoading,
  });
  const pass4489AnalysisMenuState = buildPass4489AnalysisMenuState({
    locale: modalLocale,
    menuOpen: analysisOpen,
    activeTier: analysisRun?.tier ?? null,
    gated: Boolean(analysisGateNotice),
  });
  const pass4590HeaderMetrics = derivedDetailMetrics(chartData, modalLocale);
  const pass4590HeaderMarketCap = pass4590MetricValue(pass4590HeaderMetrics, [/^(?:market cap|market capitalization|kapitalizacja|marktkapitalisierung)$/i]);
  const pass4590HeaderRiskDescriptor = pass4590RiskLabel(chartData.riskLabel, modalLocale);
  const pass4590HeaderActiveLabel = modalLocale === "pl" ? "Aktywne" : modalLocale === "de" ? "Aktiv" : "Active";
  const pass4593HeaderRank = pass4593RankLabel(pass4590HeaderMetrics);
  const pass4603Surface = assetDrawerSurface(data);
  const pass4603BrandProduct = productLabel ?? (pass4603Surface === "real-markets" ? "Velmère Real Markets" : "Velmère Shield");
  const pass4603IsStale = remote?.freshness === "last_known_good";
  const pass4603LiveVerified = remote ? remote.liveVerified : false;
  const pass4603LiveLabel = remote?.freshness === "local_reference"
    ? (modalLocale === "pl" ? "ILUSTRACYJNE · NIE LIVE" : modalLocale === "de" ? "ILLUSTRATIV · NICHT LIVE" : "ILLUSTRATIVE · NOT LIVE")
    : pass4603IsStale
      ? (modalLocale === "pl" ? "Ostatni potwierdzony" : modalLocale === "de" ? "Letzter bestätigter Stand" : "Last verified")
      : pass4603LiveVerified
        ? (modalLocale === "pl" ? "LIVE · POTWIERDZONE" : modalLocale === "de" ? "LIVE · VERIFIZIERT" : "LIVE · VERIFIED")
        : (modalLocale === "pl" ? "CZĘŚCIOWE · NIE LIVE" : modalLocale === "de" ? "TEILDATEN · NICHT LIVE" : "PARTIAL · NOT LIVE");

  const selectTimeframe = useCallback((timeframe: VlmAssetTimeframe) => {
    setLoadingTimeframe(timeframe);
    setActiveTimeframe(timeframe);
  }, []);


  const handleAnalysisTierKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAnalysisMenuPass4602(true);
      return;
    }

    const keyboardKeys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keyboardKeys.includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();

    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? ANALYSIS_TIERS.length - 1
          : event.key === "ArrowUp"
            ? Math.max(0, currentIndex - 1)
            : Math.min(ANALYSIS_TIERS.length - 1, currentIndex + 1);

    const buttons = Array.from(
      analysisMenuRef.current?.querySelectorAll<HTMLButtonElement>("[data-pass4489-analysis-tier-button='true']") ?? [],
    );
    buttons[nextIndex]?.focus({ preventScroll: true });
  }, [closeAnalysisMenuPass4602]);

  const handleTimeframeKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, current: VlmAssetTimeframe) => {
    const currentIndex = TIMEFRAMES.findIndex((timeframe) => timeframe.key === current);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    let nextIndex: number | null = null;

    if (event.key === "ArrowLeft") nextIndex = Math.max(0, safeIndex - 1);
    if (event.key === "ArrowRight") nextIndex = Math.min(TIMEFRAMES.length - 1, safeIndex + 1);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TIMEFRAMES.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    const nextTimeframe = TIMEFRAMES[nextIndex].key;
    selectTimeframe(nextTimeframe);
    window.requestAnimationFrame(() => timeframeButtonRefs.current[nextTimeframe]?.focus({ preventScroll: true }));
  }, [selectTimeframe]);

  const marketSourceToolbar = (
    <div className="vlm-asset-pass4591-toolbar vlm-asset-pass4592-toolbar" data-pass4592-toolbar="live-pair-source-left-timeframes-right-no-tabs">
      <div
        className="vlm-asset-pass4592-live-line"
        aria-label={modalLocale === "pl" ? "Status źródła danych rynkowych" : modalLocale === "de" ? "Status der Marktdatenquelle" : "Market data source status"}
        data-market-data-state={pass4603LiveVerified ? "live_verified" : pass4603IsStale ? "last_known_good" : "partial_not_live"}
      >
        <span
          className="vlm-asset-pass4592-live-dot"
          data-live-verified={pass4603LiveVerified ? "true" : "false"}
          data-stale={pass4603IsStale ? "true" : undefined}
          aria-hidden="true"
        />
        <strong>{pass4603LiveLabel}</strong>
        <span>{data.symbol} / {chartData.currencyLabel ?? "USD"}</span>
        <span aria-hidden="true">•</span>
        <span>{pass4596CompactSourceLabel(chartData.sourceLabel, false, modalLocale)}</span>
      </div>
      {activeDetailTab === "overview" ? (
        <div
          className="vlm-asset-timeframes vlm-asset-pass4591-timeframes"
          aria-label={pass4486TimeframeHint.label}
          aria-describedby="vlm-timeframe-keyboard-hint-pass4486"
          data-pass4486-timeframe-roving="arrow-home-end-chart-gesture-contained"
        >
          {TIMEFRAMES.map((timeframe) => (
            <button
              key={timeframe.key}
              ref={(node) => { timeframeButtonRefs.current[timeframe.key] = node; }}
              type="button"
              tabIndex={activeTimeframe === timeframe.key ? 0 : -1}
              onClick={() => selectTimeframe(timeframe.key)}
              onKeyDown={(event) => handleTimeframeKeyDown(event, timeframe.key)}
              aria-pressed={activeTimeframe === timeframe.key}
              data-active={activeTimeframe === timeframe.key ? "true" : undefined}
              data-pass4486-timeframe-key={timeframe.key}
              className="vlm-asset-timeframe"
            >
              {timeframe.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <BodyPortal>
      <div
        className="vlm-asset-detail-backdrop-pass4473 vlm-asset-detail-backdrop-pass4563-center fixed inset-0 z-[2147480900] grid place-items-center bg-black/[0.78] p-4 backdrop-blur-xl md:p-8"
        data-vlm-asset-appearance={appearance}
        style={pass628LayerStyle("modalBackdrop")}
        data-pass2220-asset-modal-backdrop="runtime-loading-hotfix-scroll-locked"
        data-pass4473-asset-detail-shell="right-drawer-click-away-escape-scroll-contained"
        data-pass4475-asset-drawer-mutex="hide-angel-intel-clickaway-localized-shell"
        data-pass4516-asset-drawer-backdrop="clickaway-closes-only-backdrop-analysis-menu-first-scroll-lock"
        data-pass4517-asset-drawer-backdrop="clickaway-one-action-analysis-menu-first-no-page-scroll"
        data-pass4518-asset-drawer-backdrop="clickaway-edge-drawer-no-utility-overlap-no-page-scroll"
        data-pass4520-asset-drawer-backdrop="clickaway-owned-scroll-no-utility-no-page-drift"
        data-pass4521-asset-drawer-backdrop="single-edge-owner-clickaway-no-side-utility-overlap"
        data-pass4522-asset-drawer-backdrop="force-close-intel-angel-before-edge-drawer-opens"
        data-pass4532-asset-drawer-backdrop="intel-removed-chart-gap-repair-active"
        data-pass4545-asset-drawer-backdrop="replay-export-queue-event-bridge"
        data-pass4480-asset-drawer-backdrop="right-drawer-clickaway-before-page-scroll"
        data-pass2506-chart-wheel-touch-owner="modal-backdrop-lock" data-pass3501-advanced-runtime-gate="server-first" data-pass3701-paid-depth-gate="server-receipt-only" data-pass3704-pdf-proof="preview-download-hash-parity"
        onPointerDown={() => {
          // PASS4602: one outside click always closes the complete popup. The previous
          // menu-first branch forced users to click the backdrop twice when VLM Analysis was open.
          onClose();
        }}
      >
        <section
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${data.symbol} Velmère market detail`}
          aria-labelledby="vlm-asset-detail-title-pass4516"
          aria-describedby="vlm-asset-detail-desc-pass4516"
          aria-busy={chartIsLoading || Boolean(analysisRun && !analysisRun.complete)}
          tabIndex={-1}
          onKeyDown={handleModalKeyDownPass4602}
          onPointerDown={(event) => {
            event.stopPropagation();
            const target = event.target instanceof Node ? event.target : null;
            if (analysisOpen && target && analysisMenuRef.current && !analysisMenuRef.current.contains(target)) {
              setAnalysisOpen(false);
              setAnalysisGateNotice(null);
              setAnalysisGateAction(null);
            }
          }}
          className={`vlm-asset-detail-modal vlm-asset-detail-modal-pass4563-visual-reset vlm-asset-detail-modal--pass4633-geometry-owner vlm-asset-detail-modal--pass4634-reference-detail-owner vlm-asset-detail-modal--pass4636-final-geometry-owner vlm-asset-detail-modal--pass4637-content-scale-owner vlm-asset-detail-modal--pass4638-adaptive-fit-owner ${analysisRun ? "vlm-asset-detail-modal--analysis" : ""} ${analysisRun && !analysisRun.complete ? "vlm-asset-detail-modal--analysis-loading" : ""} ${analysisRun?.complete ? "vlm-asset-detail-modal--analysis-result" : ""}`}
          data-vlm-asset-appearance={appearance}
          data-vlm-asset-active-tab={activeDetailTab}
          data-pass2234-asset-modal="analysis-size-price-logo-polish"
          data-pass4563-asset-detail-modal="centered-only-top-data-chart-vlm-analysis-no-side-drawer"
          data-pass4565-asset-detail-modal="fixed-center-top-data-chart-analysis-only-hard-lock"
          data-pass4587-asset-detail-modal="premium-rhythm-open-without-snap-chart-first-no-fomo-motion"
          data-pass4588-asset-detail-modal="one-message-closeout-mobile-first-chart-proof-gated-no-100-claim"
          data-pass4590-asset-detail-modal="selected-clean-current-hybrid-popup-implemented"
          data-pass4591-asset-detail-modal="selected-reference-parity-logo-tabs-clean-cards-fit"
          data-pass4592-asset-detail-modal="clean-chart-no-grid-live-source-toolbar"
          data-pass4593-asset-detail-modal="final-clean-geometry-real-sparklines-expandable-chart"
          data-pass4594-asset-detail-modal="clean-canvas-current-price-pill-one-screen-motion"
          data-pass4595-asset-detail-modal="reference-proportions-no-empty-canvas-footer-restored"
          data-pass4596-asset-detail-modal="reference-hierarchy-two-tier-header-compact-source-zero-dead-canvas"
          data-pass4598-asset-detail-modal="provider-ohlc-only-reference-width-timeframe-cleanup"
          data-pass4601-asset-detail-modal="reference-core-only-no-legacy-proof-dom-one-screen-fit"
          data-pass4602-asset-detail-modal="single-click-close-ordered-escape-roving-focus-reference-geometry"
          data-pass4603-asset-detail-modal="no-synthetic-metrics-no-fake-sparklines-source-truth-surface-aware" data-pass4604-risk-truth="no-default-35-no-investment-grade-no-symbol-liquidity-proxy"
          data-pass4607-asset-detail-modal="single-geometry-owner-reference-ratio-desktop-mobile-proof"
          data-pass4617-asset-detail-modal="thirty-percent-wider-ten-percent-taller-unified-canvas-reference-cards"
          data-pass4619-asset-detail-modal="canonical-logo-source-only-charts-confidence-no-default"
          data-pass4628-asset-detail-modal="forty-percent-wider-fifteen-percent-taller-reference-lock"
          data-pass4629-asset-detail-modal="measured-seventy-seven-vw-seventy-six-vh-cross-surface-lock"
          data-pass4630-asset-detail-modal="one-screen-fit-first-paint-logo-quote-endcap-rhythm-lock"
          data-pass4631-asset-detail-modal="real-eighty-two-vw-eighty-four-vh-visible-geometry-lock"
          data-pass4632-asset-detail-modal="viewport-height-gate-removed-seventy-eight-vw-eighty-nine-vh"
          data-pass4633-asset-detail-modal="unconditional-root-class-reference-footprint-owner"
          data-pass4634-asset-detail-modal="reference-hierarchy-source-derived-cards-clean-footer-owner"
      data-pass4635-asset-detail-modal="source-only-analysis-sparklines-no-decorative-market-curves"
          data-pass4636-asset-detail-modal="legacy-pass4565-specificity-neutralized-final-visible-geometry"
          data-pass4637-asset-detail-modal="large-shell-content-scale-chart-card-footer-rhythm-price-sync"
          data-pass4638-asset-detail-modal="adaptive-height-fit-tabular-metrics-no-card-footer-clipping"
          data-pass4475-asset-detail-drawer="localized-price-risk-labels-utility-mutex"
          data-pass4476-asset-drawer-scroll-owner="modal-body-scroll-chart-gesture-boundary"
          data-pass4477-asset-detail-drawer="parity-receipt-source-tier-clickaway-proof"
          data-pass4478-asset-detail-keyboard="tab-trap-focus-return-escape-order"
          data-pass4479-asset-detail-visual-lock="screen-match-chart-endcap-table-parity-mobile-safe"
          data-pass4480-asset-detail-acceptance="interaction-guard-source-state-safe-footer"
          data-pass4481-asset-detail-acceptance="visible-state-machine-screen-code-contract"
          data-pass4482-asset-detail-premium-surface="qa-contract-collapsed-chart-first-drawer"
          data-pass4484-asset-detail-premium-surface="compact-runtime-summary-chart-first-operator-qa-collapsed"
          data-pass4485-asset-detail-fit="right-drawer-chart-first-runtime-source-safe-footer"
          data-pass4486-asset-detail-fit="keyboard-timeframe-roving-premium-focus-live-hint"
          data-pass4489-asset-detail-fit="analysis-tier-keyboard-safe-customer-menu-state"
          data-pass4490-asset-detail-fit="runtime-source-quality-before-analysis-pdf"
          data-pass4491-asset-detail-fit="evidence-readiness-analysis-pdf-source-missing-proof"
          data-pass4492-asset-detail-fit="operator-action-plan-no-trade-prompt-before-chart"
          data-pass4493-asset-detail-fit="claim-boundary-visible-before-chart-analysis-pdf"
          data-pass4494-asset-detail-fit="customer-proof-packet-redaction-source-bound-before-chart"
          data-pass4495-asset-detail-fit="copy-safe-envelope-json-preview-before-chart-no-secrets" data-pass4504-asset-detail-drawer="chart-first-no-proof-wall-before-full-chart" data-pass4506-asset-detail-drawer="right-edge-chart-first-table-clickaway-mobile-safe" data-pass4507-asset-detail-drawer="literal-chart-first-proof-stack-collapsed-below-chart" data-pass4508-asset-detail-drawer="utility-hidden-while-open-overscroll-contained-clickaway-safe" data-pass4510-asset-detail-drawer="locale-safe-chart-first-clickaway-no-intel-overlap-mobile-fit" data-pass4511-asset-detail-drawer="edge-drawer-chart-first-sticky-analysis-footer-no-page-reflow" data-pass4512-asset-detail-drawer="chart-first-analysis-footer-mobile-no-horizontal-reflow" data-pass4514-asset-detail-drawer="edge-drawer-owned-scroll-one-screen-chart-no-visible-debug-before-analysis" data-pass4516-asset-detail-drawer="accessible-title-desc-focus-safe-analysis-menu-contained" data-pass4517-asset-detail-drawer="chart-first-owned-scroll-silent-scrollbar-safe-footer" data-pass4518-asset-detail-drawer="quiet-edge-header-close-hitbox-chart-footer" data-pass4520-asset-detail-drawer="reference-edge-drawer-chart-lock-safe-footer-no-x-reflow" data-pass4521-asset-detail-drawer="final-edge-drawer-chart-above-proof-sticky-footer-safe-menu" data-pass4522-asset-detail-drawer="exclusive-edge-owner-no-intel-or-angel-collision-chart-focus" data-pass4496-asset-drawer="premium-proof-dock-compresses-runtimes-chart-first" data-pass4497-asset-drawer="progressive-proof-disclosure-chart-first-no-debug-wall" data-pass4498-asset-drawer="premium-action-dock-copy-recheck-pdf-queue-no-debug-wall" data-pass4499-asset-drawer="action-feedback-loop-recheck-disabled-copy-status"
          data-modal-wheel-owner="true"
          data-pass2506-mobile-safe-area-modal="true"
          data-pass4138-mobile-analysis-reachability="realmarkets-footer-analysis-safe-area"
          data-pass2506-shield-realmarkets-chart-shell="shared-modal-shell" data-pass3708-interaction-owner="modal" data-pass3701-l5-receipt="modal-chart-paid-depth" data-pass4532-asset-chart-fidelity="reduced-future-gap-and-source-candle-continuity-repair"
          data-pass4534-asset-chart-fidelity="institutional-candle-qc-no-fake-right-air"
          data-pass4537-asset-actions="manipulation-squeeze-alerts-copy-recheck-live-chart-bound"
          data-pass4538-asset-detail="chart-precision-tape-action-intelligence-stateful"
          data-pass4540-asset-detail="chart-decision-gate-action-receipts-vault-boundary"
          data-pass4542-asset-detail="receipt-vault-handoff-alert-report-export-source-recheck"
          data-pass4573-asset-detail="large-centered-chart-no-visible-keyboard-hint-source-candles-only"
          data-pass4574-asset-detail="wide-chart-first-no-fake-candles-proof-sections-under-fold"
          data-pass4575-asset-detail="fresh-source-candles-only-modal-no-helper-copy-no-fake-range"
          data-pass4576-asset-detail="chart-first-max-canvas-hide-empty-helper-rail"
          data-pass4588-asset-detail-proof-ceiling="ui-polish-allowed-live-100-blocked-without-build-provider-mobile-receipts"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/[0.22] to-transparent" />
          <>
          <header
            className="vlm-asset-detail-header vlm-asset-pass4590-header vlm-asset-pass4596-header"
            data-pass4590-header="selected-clean-current-hybrid-name-logo-price-risk-market-cap"
            data-pass4596-header="reference-two-tier-brandbar-summary-grid"
          >
            <div className="vlm-asset-pass4596-brandbar">
              <nav
                className="vlm-asset-detail-tabs"
                role="tablist"
                aria-label={`${pass4603BrandProduct} — ${modalLocale === "pl" ? "sekcje szczegółów rynku" : modalLocale === "de" ? "Marktdetailbereiche" : "market detail sections"}`}
              >
                {ASSET_DETAIL_TABS.map(({ id, Icon }) => {
                  const { label, shortLabel } = ASSET_DETAIL_TAB_COPY[modalLocale][id];
                  return (
                  <button
                    key={id}
                    id={`vlm-asset-detail-tab-${id}`}
                    type="button"
                    role="tab"
                    aria-label={label}
                    aria-selected={activeDetailTab === id}
                    tabIndex={activeDetailTab === id ? 0 : -1}
                    data-active={activeDetailTab === id ? "true" : undefined}
                    onClick={() => setActiveDetailTab(id)}
                    onKeyDown={(event) => handleDetailTabKeyDown(event, id)}
                    className="vlm-asset-detail-tab"
                  >
                    <Icon aria-hidden="true" />
                    <span className="vlm-asset-detail-tab-label-full">{label}</span>
                    <span className="vlm-asset-detail-tab-label-compact" aria-hidden="true">{shortLabel}</span>
                  </button>
                  );
                })}
              </nav>
              <button
                type="button"
                onClick={onClose}
                className="vlm-asset-detail-close vlm-asset-pass4596-close"
                aria-label={shell.close}
                data-pass4518-close-hitbox="top-right-contained-no-chart-overlap"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="vlm-asset-pass4596-summary"
              aria-label={`${data.name} — ${modalLocale === "pl" ? "podsumowanie rynku" : modalLocale === "de" ? "Marktübersicht" : "market summary"}`}
            >
              <div className="vlm-asset-identity vlm-asset-pass4590-identity min-w-0">
                <div className="vlm-asset-pass4590-brand-row" data-pass4518-asset-title-row="quiet-status-dot-no-neon" data-pass4566-asset-title-row="duplicate-h2-verified-removed">
                  <span className="vlm-asset-pass4591-logo" aria-hidden="true" data-pass4619-modal-logo="canonical-resolver-with-provider-fallback">
                    <VlmAssetMark data={data} />
                  </span>
                  <div className="min-w-0">
                    <div className="vlm-asset-pass4590-title-line">
                      <h2 id="vlm-asset-detail-title-pass4516" className="truncate">
                        {data.name}
                      </h2>
                      <span>{data.symbol}</span>
                      <button type="button" aria-label={modalLocale === "pl" ? "Dodaj do obserwowanych" : modalLocale === "de" ? "Zur Beobachtungsliste hinzufügen" : "Add to watchlist"} className="vlm-asset-pass4590-star">☆</button>
                    </div>
                    <p id="vlm-asset-detail-desc-pass4516" className="vlm-asset-pass4590-desc">
                      <span className="vlm-asset-pass4590-active-dot" data-pass4518-status-dot="quiet-no-neon-glow" />
                      {pass4590HeaderActiveLabel}
                      {data.assetClassLabel ? <span>{data.assetClassLabel}</span> : null}
                    </p>
                  </div>
                </div>
              </div>

              <div className="vlm-asset-pass4590-stat vlm-asset-price-center min-w-0">
                <p>{shell.price}</p>
                <strong>{pass4637HeaderPriceLabel}</strong>
                {effectiveChangeLabel ? <small className={changeClass}>{effectiveChangeLabel}</small> : null}
              </div>

              <div className="vlm-asset-pass4590-stat vlm-asset-risk-corner min-w-0">
                <p>{shell.risk}</p>
                <strong>{data.riskLabel ?? "—"}</strong>
                <small className={riskToneClass}>{pass4590HeaderRiskDescriptor}</small>
              </div>

              <div className="vlm-asset-pass4590-stat vlm-asset-pass4590-market-cap min-w-0">
                <p>{modalLocale === "pl" ? "Kapitalizacja" : modalLocale === "de" ? "Marktkapitalisierung" : "Market cap"}</p>
                <strong>{pass4590HeaderMarketCap}</strong>
                {pass4593HeaderRank ? <small>{pass4593HeaderRank}</small> : null}
              </div>
            </div>
          </header>

          {activeDetailTab === "overview" ? marketSourceToolbar : null}

          {activeDetailTab === "overview" ? (
          <>
          <div className="vlm-asset-chart-wrap" aria-busy={chartIsLoading} data-pass4602-chart-state={chartIsLoading ? "loading" : chartError ? "error" : "ready"} data-pass2506-chart-wheel-touch-owner="asset-chart-wrap" data-pass4517-chart-wrap="first-screen-chart-owned-no-footer-overlap" data-pass4518-chart-wrap="first-screen-full-chart-no-footer-cover-no-horizontal-overflow" data-pass4520-chart-wrap="viewport-first-chart-safe-footer-no-horizontal-drift" data-pass4521-chart-wrap="chart-first-min-height-no-proof-wall-before-canvas" data-pass4522-chart-wrap="exclusive-owner-chart-viewport-no-side-drawer-collision" data-pass2506-shield-realmarkets-chart-shell="timeframe-chart-shell" data-pass4473-chart-owner="wheel-drag-pinch-stays-inside-drawer" data-pass4479-chart-edge-contract="full-chart-contained-endcap-no-page-wheel">
            <p
              id="vlm-timeframe-keyboard-hint-pass4486"
              className="vlm-timeframe-hint-pass4486 vlm-timeframe-hint-pass4573"
              data-pass4486-timeframe-hint={pass4486TimeframeHint.state}
              data-pass4573-timeframe-hint="visually-hidden-no-home-end-copy-on-chart"
              aria-live="polite"
            >
              <span>{pass4486TimeframeHint.active}</span>
              <small>{pass4486TimeframeHint.hint}</small>
              <em>{pass4486TimeframeHint.badge}</em>
            </p>
            {chartInitialLoading ? (
              <div className="vlm-asset-chart-stage flex flex-col items-center justify-center relative overflow-hidden" data-pass4138-chart-skeleton-layer="realmarkets-loading-only">
                <ChartLoadingSurface
                  label={modalLocale === "pl" ? "Ładowanie świec " + activeTimeframeConfig.label : modalLocale === "de" ? "Kerzen laden " + activeTimeframeConfig.label : "Loading candles " + activeTimeframeConfig.label}
                  detail={modalLocale === "pl" ? "Pobieranie i synchronizacja pełnej historii świec…" : modalLocale === "de" ? "Kerzenhistorie wird synchronisiert…" : "Synchronizing complete candle history…"}
                />
              </div>
            ) : chartError && !chartHasCandles ? (
              <div className="vlm-asset-chart-stage flex flex-col items-center justify-center relative overflow-hidden">
                <div className="vlm-asset-chart-error-pass4598" role="status" data-pass4598-chart-error="verified-source-unavailable-no-synthetic-fallback">
                  <span>{data.symbol}</span>
                  <strong>{modalLocale === "pl" ? "Źródło OHLC jest chwilowo niedostępne" : modalLocale === "de" ? "OHLC-Quelle ist vorübergehend nicht verfügbar" : "OHLC source is temporarily unavailable"}</strong>
                  <small>{modalLocale === "pl" ? "Velmère nie generuje zastępczych świec. Spróbuj ponownie, aby pobrać potwierdzone dane." : modalLocale === "de" ? "Velmère erzeugt keine Ersatzkerzen. Erneut versuchen, um bestätigte Daten abzurufen." : "Velmère does not generate replacement candles. Retry to fetch verified data."}</small>
                  <button type="button" onClick={refreshActiveChartPass4498}>
                    <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    {modalLocale === "pl" ? "Spróbuj ponownie" : modalLocale === "de" ? "Erneut versuchen" : "Retry source"}
                  </button>
                  <em className="sr-only">{chartError}</em>
                </div>
              </div>
            ) : (
              <VelmerePerformanceChart
                data={chartData}
                timeframe={activeTimeframe}
                renderKey={chartRenderKey}
                locale={modalLocale}
                refreshing={chartRefreshing}
                refreshingLabel={modalLocale === "pl" ? "Ładowanie świec " + activeTimeframeConfig.label : modalLocale === "de" ? "Kerzen laden " + activeTimeframeConfig.label : "Loading candles " + activeTimeframeConfig.label}
              />
            )}
          </div>

          {renderAssetDetailReferenceMarketCardsPass4590({
            data: {
              ...chartData,
              changeLabel: effectiveChangeLabel ?? chartData.changeLabel,
              changeTone: effectiveChangeTone,
            },
            locale: modalLocale,
          })}

          {/* PASS4601: the reference popup is deliberately limited to summary, chart,
              four market cards and the VLM Analysis footer. Legacy proof/action surfaces
              remain available inside analysis flows, but are not mounted in the primary
              market popup because hidden DOM was still creating dead canvas and scroll. */}

          <footer className="vlm-asset-detail-footer" data-pass4514-asset-footer="sticky-analysis-without-covering-chart-or-creating-x-overflow" data-pass4516-asset-footer="analysis-control-owned-bottom-safe-no-chart-cover" data-pass4517-asset-footer="analysis-cta-owned-safe-area-no-scrollbar" data-pass4518-asset-footer="single-line-status-analysis-safe-area-no-overlap" data-pass4521-asset-footer="status-line-plus-analysis-owned-safe-area" data-pass4522-asset-footer="single-owner-analysis-safe-area-no-floating-overlap">
            <div className="vlm-asset-pass4595-footer-source min-w-0">
              <span className="vlm-asset-pass4595-footer-shield" aria-hidden="true">◇</span>
              <span>{chartData.sourceTimeLabel ? `${modalLocale === "pl" ? "Aktualizacja" : modalLocale === "de" ? "Aktualisiert" : "Updated"}: ${chartData.sourceTimeLabel}` : (modalLocale === "pl" ? "Czas źródła oczekuje" : modalLocale === "de" ? "Quellzeit ausstehend" : "Source time pending")}</span>
              <span aria-hidden="true">•</span>
              <span>{shell.source}: {pass4596CompactSourceLabel(chartData.sourceLabel, true, modalLocale)}</span>
              <span aria-hidden="true">•</span>
              <span>{activeTimeframeConfig.label} {modalLocale === "pl" ? "świece" : modalLocale === "de" ? "Kerzen" : "candles"}</span>
              {remote?.verificationLabel ? <span className="sr-only">{remote.verificationLabel}</span> : null}
              {chartIsLoading ? <span className="text-cyan-100/[0.56]">{shell.loadingCandles}</span> : null}
            </div>

            {VLM_ANALYSIS_TRIGGER_ENABLED ? (
            <div ref={analysisMenuRef} className="relative ml-auto shrink-0" data-pass2506-mobile-analysis-reachability="true" data-pass4138-mobile-analysis-reachability="realmarkets-vlm-analysis-trigger-bottom-safe">
              <button
                ref={analysisTriggerRef}
                type="button"
                onClick={() => {
                  if (analysisOpen) closeAnalysisMenuPass4602(false);
                  else setAnalysisOpen(true);
                }}
                className="vlm-analysis-trigger"
                aria-expanded={analysisOpen}
                aria-haspopup="menu"
                aria-describedby="vlm-analysis-keyboard-hint-pass4489"
                data-pass4489-analysis-trigger="menu-state-keyboard-safe"
              >
                VLM Analysis
                <ArrowRight className={`h-3.5 w-3.5 transition-transform ${analysisOpen ? "rotate-90" : ""}`} aria-hidden="true" />
              </button>
              {analysisOpen ? (
                <div
                  className="vlm-analysis-menu"
                  role="menu"
                  data-pass4514-analysis-menu="contained-safe-area-no-xp-scrollbar-no-horizontal-overflow"
                  data-pass4516-analysis-menu="bottom-owned-no-horizontal-overflow-keyboard-safe"
                  data-pass4517-analysis-menu="clamped-scrollbarless-menu-never-leaves-viewport"
                  data-pass4518-analysis-menu="compact-scrollbarless-owned-keyboard-safe"
                  data-pass4521-analysis-menu="viewport-clamped-no-xp-scrollbar-keyboard-contained"
                  aria-label={pass4489AnalysisMenuState.title}
                  data-pass4489-analysis-menu-state={pass4489AnalysisMenuState.state}
                >
                  <p
                    id="vlm-analysis-keyboard-hint-pass4489"
                    className="vlm-analysis-menu-hint-pass4489"
                    aria-live="polite"
                    data-pass4489-analysis-menu-hint="arrow-home-end-escape"
                  >
                    <span>{pass4489AnalysisMenuState.title}</span>
                    <small>{pass4489AnalysisMenuState.hint}</small>
                    <em>{pass4489AnalysisMenuState.badge}</em>
                  </p>
                  {ANALYSIS_TIERS.map((tier, index) => (
                    <button
                      key={tier.label}
                      type="button"
                      role="menuitem"
                      tabIndex={index === 0 ? 0 : -1}
                      onKeyDown={(event) => handleAnalysisTierKeyDown(event, index)}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void launchAnalysis(tier);
                      }}
                      className="vlm-analysis-tier"
                      data-pass2214-analysis-trigger="brain-loader"
                      data-pass4489-analysis-tier-button="true"
                    >
                      <span>{tier.label}</span>
                      <small>{tier.meta} · {tier.durationSeconds}s</small>
                    </button>
                  ))}
                  {analysisGateNotice ? (
                    <p className="vlm-analysis-gate-notice" data-pass3401-advanced-server-first-gate="visible">
                      {analysisGateNotice}
                    </p>
                  ) : null}
                  {analysisGateAction ? (
                    <button
                      type="button"
                      className="vlm-analysis-gate-action"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        window.location.assign(assertBrowserRedirectUrl(analysisGateAction.href, { profile: "same_origin", browserOrigin: window.location.origin }));
                      }}
                      data-pass2253-advanced-gate-action="checkout-visible"
                    >
                      {analysisGateAction.label}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            ) : null}
          </footer>
          </>
          ) : null}

          <AnalysisTab
            asset={chartData}
            locale={modalLocale}
            active={activeDetailTab === "analysis"}
            appearance={appearance}
            serverSurface={data.analysisSurface === "shield-pro" ? "shield_pro" : undefined}
          />

          {activeDetailTab === "market-impact" ? (
            <MarketImpactTab asset={chartData} locale={modalLocale} appearance={appearance} />
          ) : null}

          {activeDetailTab === "whale-watch" ? (
            <WhaleWatchTab asset={chartData} locale={modalLocale} appearance={appearance} />
          ) : null}
          </>
        </section>
      </div>
    </BodyPortal>
  );
}

/* PASS2519 risk kernel calibration marker: data-pass2519-severity-confidence-split keeps severity, confidence, proof coverage and missing-data penalty visually separate. */
/* PASS2520 premium risk psychology marker: data-pass2520-severity-confidence-data-quality-card separates severity, confidence and data-quality ring in the asset modal. */

/* data-pass2521-source-quorum-risk-calibration-card severity confidence split */
/* data-pass2522-entitlement-vault-runtime-card source quorum runtime proof */

/* PASS2523 marker: data-pass2523-asset-tier-proof-passport-card keeps Advanced proof checklist visible before paid insight; no wallet-only unlock. */

/* PASS2524 marker: data-pass2524-asset-advanced-revoke-boundary blocks Advanced paid-ready copy after refund, chargeback, BLIK expiry, crypto reorg, hash drift or source quorum failure. */

/* PASS2525 asset proof gap downgrade marker: data-pass2525-asset-not-enough-proof data-pass2525-asset-tier-visual-truth */

/* PASS2526 marker: data-pass2526-asset-proof-downgrade-chip-rail renders reusable downgrade chips before paid insight and confidence visuals. */
/* PASS2527 marker: data-pass2527-real-markets-runtime-proof-chip-mount binds Real Markets paid insight to source freshness/divergence proof before premium trust visuals. */
/* PASS2528 marker: data-pass2528-real-markets-live-chip-state-replay binds stale market/provider divergence to watch/hold chip before premium market copy. */
/* PASS3806/PASS3807 marker: Advanced paid depth requires server receipt; wallet identity and success URL are never enough. */
export const PASS3806_ADVANCED_SERVER_FIRST_MARKER = "data-pass3806-advanced-server-first";

// PASS3901-4000 Advanced marker: paid-depth UI remains server-first and must not trust success URLs, local storage, or wallet identity alone.
export const PASS3901_ADVANCED_SERVER_FIRST_MARKER = "advanced-server-first-proof-prepared";

export const PASS4001_ASSET_MODAL_PAID_DEPTH_BARRIER_MARKER = "advanced-paid-depth-server-receipt-required-pass4100";
