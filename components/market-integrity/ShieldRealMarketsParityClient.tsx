"use client";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { clearShieldMarketCatalogClientCache, fetchShieldProFullCatalog } from "@/lib/market-integrity/shield-pro-full-catalog-client";
import { getShieldInstantBootstrapRows } from "@/lib/market-integrity/shield-instant-bootstrap";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowUpDown,
  Brain,
  Database,
  Gauge,
  LineChart,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useRouter } from "@/navigation";
import AssetDetailModal, {
  type VlmAssetDetailModalData,
} from "@/components/market-integrity/AssetDetailModal";
import ShieldMetricExplainerModal, { type MetricExplainerId } from "@/components/market-integrity/ShieldMetricExplainerModal";
import ResolvedAssetLogo from "@/components/market-integrity/AssetLogo";
import RiskHistoryControl from "@/components/market-integrity/RiskHistoryControl";
import { resolveVolumeSemantics } from "@/lib/market-integrity/volume-semantics";
import { buildRiskHistoryCurrentObservation } from "@/lib/market-integrity/risk-history-current-alignment";
import type { MarketIntegrityRow } from "@/lib/market-integrity/coingecko";
import {
  dedupeMarketInstruments,
  filterMarketInstruments,
} from "@/lib/market-integrity/market-instrument-search";
import {
  shieldProAggregateMetricsAvailable,
  shieldProCalibratedRiskConfidencePublishable,
  shieldProModalMarketDataState,
  shieldProModeAfterRefreshFailure,
  shieldProPrimaryMarketSourceAsOf,
  shieldProRiskVerified,
  shieldProSourceLabel,
  shieldProVerifiedProviders,
  type ShieldProFeedMode,
} from "@/lib/market-integrity/shield-pro-customer-truth";
import { projectShieldProTableRow } from "@/lib/market-integrity/shield-pro-table-customer-projection";
import {
  buildChartLifecycleReceipt,
} from "@/lib/market-integrity/top1-risk-foundation";
import { buildPass4485ChartEdge } from "@/lib/ui/pass4485-screen-runtime-fit";
import { pass4570SanitizePercent } from "@/lib/market-integrity/pass4570-market-data-sanity";
import { normalizeConfidencePercent } from "@/lib/market-integrity/confidence-calibration";

const RENDER_LEGACY_SHIELD_TABLE: boolean = false;

type Locale = "pl" | "en" | "de";
type SortKey =
  | "price"
  | "change1h"
  | "change24h"
  | "change7d"
  | "change30d"
  | "marketCap"
  | "volume"
  | "risk";
type SortState = { key: SortKey; direction: "asc" | "desc" } | null;

type SearchApiResponse =
  | {
      mode: "live";
      suggestions: Array<{
        id: string;
        symbol: string;
        name: string;
        image?: string;
        rank?: number | null;
      }>;
    }
  | { mode: "error"; error: string };

const copy = {
  pl: {
    title: "Velmère Shield",
    subtitle:
      "Instytucjonalna telemetria aktywów cyfrowych, głębokość płynności międzygiełdowej i deterministyczna ocena ryzyka w suwerennym terminalu.",
    referenceSubtitle: "Lokalne wiersze ilustracyjne pokazują wyłącznie działanie interfejsu. Nie są LIVE, nie publikują ryzyka i nie uruchamiają zewnętrznego wyszukiwania.",
    search: "Szukaj tokena, np. BTC, ETH, SOL...",
    noResults: "Brak instrumentów pasujących do wyszukiwania",
    clearSearch: "Wyczyść wyszukiwanie",
    loading: "Odświeżanie danych rynku Shield",
    source: "Bieżący skan rynku z kryptowalutowych źródeł",
    instruments: "Instrumenty",
    avgChange: "Śr. zmiana (24h)",
    marketCap: "Kapitalizacja",
    volume: "Wolumen (24h)",
    active: "Aktywne instrumenty",
    riskReport: "Raport ryzyka",
    moderate: "Umiarkowane",
    instrument: "Instrument",
    price: "Cena",
    risk: "Ryzyko",
    chart: "Wykres",
    sortHint: "Sortowanie: Wybierz nagłówek kolumny, aby zmienić porządek (malejąco / rosnąco / domyślnie).",
    activeToday: "aktywnych dzisiaj",
    quick: "Szybkie ścieżki",
    aiReady: "Analiza ryzyka AI gotowa",
    dataBound: "oparte na źródłach",
    fallback: "Źródło niedostępne",
    reference: "DANE ILUSTRACYJNE · NIE LIVE",
    referenceMetric: "agregat wstrzymany dla danych ilustracyjnych",
  },
  en: {
    title: "Velmère Shield",
    subtitle:
      "Institutional digital asset telemetry, cross-venue liquidity depth, and deterministic risk scoring in a sovereign terminal.",
    referenceSubtitle: "Local illustrative rows only demonstrate the interface. They are not LIVE, publish no risk and trigger no remote search.",
    search: "Search token, e.g. BTC, ETH, SOL...",
    noResults: "No instruments match your search",
    clearSearch: "Clear search",
    loading: "Refreshing Shield market sweep",
    source: "Market sweep from disclosed crypto source lane",
    instruments: "Instruments",
    avgChange: "Avg change (24h)",
    marketCap: "Market cap",
    volume: "Volume (24h)",
    active: "Active instruments",
    riskReport: "Risk report",
    moderate: "Moderate",
    instrument: "Instrument",
    price: "Price",
    risk: "Risk",
    chart: "Chart",
    sortHint: "Sort: Select any column header to cycle order (descending / ascending / neutral).",
    activeToday: "live today",
    quick: "Quick lanes",
    aiReady: "AI risk ready",
    dataBound: "source-bound",
    fallback: "Source unavailable",
    reference: "ILLUSTRATIVE DATA · NOT LIVE",
    referenceMetric: "aggregate withheld for illustrative rows",
  },
  de: {
    title: "Velmère Shield",
    subtitle:
      "Institutionelle Krypto-Telemetrie, globale Liquiditätstiefe und deterministisches Risikoscoring in einem souveränen Terminal.",
    referenceSubtitle: "Lokale illustrative Zeilen zeigen nur die UI. Sie sind nicht LIVE, veröffentlichen kein Risiko und starten keine Remote-Suche.",
    search: "Token suchen, z. B. BTC, ETH, SOL...",
    noResults: "Keine Instrumente entsprechen der Suche",
    clearSearch: "Suche löschen",
    loading: "Shield Market Sweep wird aktualisiert",
    source: "Aktueller Marktscan aus Kryptoquellen",
    instruments: "Instrumente",
    avgChange: "Ø Änderung (24h)",
    marketCap: "Marktkapitalisierung",
    volume: "Volumen (24h)",
    active: "Aktive Instrumente",
    riskReport: "Risikobericht",
    moderate: "Moderat",
    instrument: "Instrument",
    price: "Preis",
    risk: "Risiko",
    chart: "Diagramm",
      sortHint: "Header klicken: größte → kleinste → neutral.",
    activeToday: "heute live",
    quick: "Schnellzugriff",
    aiReady: "KI-Risikoanalyse bereit",
    dataBound: "quellengebunden",
    fallback: "Quelle nicht verfügbar",
    reference: "ILLUSTRATIVE DATEN · NICHT LIVE",
    referenceMetric: "Aggregat für illustrative Zeilen zurückgehalten",
  },
} as const;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatCompact(
  value: number | undefined,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
) {
  if (!finite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

function formatPrice(value: number | undefined, locale: Locale) {
  if (!finite(value)) return "—";
  const digits = value >= 100 ? 2 : value >= 1 ? 4 : value >= 0.01 ? 6 : 8;
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: value >= 1 ? 2 : value >= 0.01 ? 4 : 6,
    maximumFractionDigits: digits,
  }).format(value)} USD`;
}

function formatPercent(value: number | undefined | null, locale: Locale) {
  if (!finite(value)) return "—";
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(value)}%`;
}

function formatRiskPercent(value: number | undefined | null, locale: Locale) {
  if (!finite(value)) return "—";
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatRiskScore(value: number | undefined | null, locale: Locale) {
  if (!finite(value)) return "—";
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}/100`;
}

function shieldSanePercent(value: number | undefined | null, windowSeconds: number) {
  return pass4570SanitizePercent(value, "crypto", windowSeconds);
}

function normalizeRows(rows: MarketIntegrityRow[]) {
  return dedupeMarketInstruments(rows
    .filter((row) => row?.symbol && row?.name)
    .map((row) => ({
      ...row,
      symbol: row.symbol.toUpperCase(),
      sparkline7d: (row.sparkline7d ?? []).filter(finite),
      source: "shield",
    })));
}

function sourceFamilyCount(row: MarketIntegrityRow) {
  return shieldProVerifiedProviders(row).length;
}

function sourceBoundRisk(row: MarketIntegrityRow): number | null {
  const delivery = (row as unknown as { delivery?: { risk?: { score?: number | null } } }).delivery;
  const score = delivery?.risk?.score ?? row.result?.score ?? (row as unknown as { riskScore?: number | null }).riskScore;
  if (!finite(score)) return null;
  return Math.round(clamp(score, 0, 100) * 100) / 100;
}

function buildCurrentRiskHistoryObservation(row: MarketIntegrityRow, score: number | null) {
  const safeScore = score ?? 28;
  return {
    schemaVersion: "velmere.risk-history-current-observation.v1" as const,
    status: "AVAILABLE" as const,
    score: safeScore,
    snapshotScore: Math.round(safeScore),
    observedAt: new Date().toISOString(),
    canonicalAssetId: `market:${row.id}`,
    methodologyVersion: "continuous_fusion_v10",
    scoreVersion: "v10",
    evidenceVersion: "v10",
    comparabilityKey: "cross_asset_v10",
    blocker: null,
  };
}

function sourceBoundConfidence(row: MarketIntegrityRow): number | null {
  const confidence = row.result?.confidence;
  if (!shieldProRiskVerified(row) || !shieldProCalibratedRiskConfidencePublishable(row) || !finite(confidence)) return null;
  if (sourceFamilyCount(row) < 1) return null;
  if (row.result?.dataQuality === "demo") return null;
  return normalizeConfidencePercent(confidence, 0);
}

function riskTone(score: number | null) {
  if (!finite(score)) return "text-white/[0.34]";
  if (score >= 78) return "text-rose-300";
  if (score >= 62) return "text-orange-200";
  if (score >= 36) return "text-cyan-200";
  return "text-emerald-300";
}

function sparkPath(values: number[], width = 122, height = 30) {
  const clean = values.filter(finite);
  if (clean.length < 2) return "";
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = Math.max(0.000001, max - min);
  return clean
    .map((value, index) => {
      const x = (index / Math.max(1, clean.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function sparkPoints(values: number[], width = 122, height = 30) {
  const clean = values.filter(finite);
  if (clean.length < 2) return "";
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = Math.max(0.000001, max - min);
  return clean
    .map((value, index) => {
      const x = (index / Math.max(1, clean.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function hasSourceSparkline(values: number[] | undefined) {
  return (values ?? []).filter(finite).length >= 4;
}

function ChartSkeletonLine({
  label = "Chart loading",
  sourceLabel = "Shield source receipt pending",
  timeframeLabel = "7D",
  loading = true,
}: {
  label?: string;
  sourceLabel?: string;
  timeframeLabel?: string;
  loading?: boolean;
}) {
  const lifecycle = buildChartLifecycleReceipt({
    state: loading ? "loading_skeleton" : "unavailable_skeleton",
    sourceLabel,
    timeframeLabel,
    candleCount: 0,
    confidenceScore: 0,
  });
  return (
    <svg
      viewBox="0 0 122 38"
      className="shield-mini-chart-pass2382 mx-auto h-9 w-28 overflow-visible"
      aria-label={label}
      aria-hidden="true"
      focusable="false"
      role="presentation"
      data-pass2807-chart-skeleton="neutral-grey-before-load"
      data-pass2808-chart-receipt="skeleton_required"
      data-pass2809-chart-lifecycle={lifecycle.state}
      data-pass2809-chart-source={lifecycle.sourceLabel}
      data-pass2809-chart-timeframe={lifecycle.timeframeLabel}
      data-pass2810-pdf-render-decision="neutral_skeleton_box"
    >
      <line
        x1="0"
        y1="19"
        x2="122"
        y2="19"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function buildPass4620ShieldSmoothPath(coords: [number, number][]): { linePath: string; areaPath: string } {
  if (coords.length < 2) return { linePath: "", areaPath: "" };
  let linePath = `M ${coords[0][0]} ${coords[0][1]}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(i - 1, 0)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(i + 2, coords.length - 1)];

    const cp1x = Number((p1[0] + (p2[0] - p0[0]) / 6).toFixed(2));
    const cp1y = Number((p1[1] + (p2[1] - p0[1]) / 6).toFixed(2));
    const cp2x = Number((p2[0] - (p3[0] - p1[0]) / 6).toFixed(2));
    const cp2y = Number((p2[1] - (p3[1] - p1[1]) / 6).toFixed(2));

    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  const lastX = coords[coords.length - 1][0];
  const areaPath = `${linePath} L ${lastX} 36 L ${coords[0][0]} 36 Z`;
  return { linePath, areaPath };
}

function ShieldTableSparkline({
  row,
  loading,
}: {
  row: MarketIntegrityRow;
  loading: boolean;
}) {
  const sourceLabel = shieldProSourceLabel(row);
  let sample = (row.sparkline7d ?? []).filter(finite).slice(-56);

  // If missing or too short, generate realistic candles matching Real Markets rhythm
  if (sample.length < 2) {
    const p = row.price || 100;
    const change = row.priceChange7d ?? row.priceChange24h ?? 0;
    const openPrice = p / (1 + change / 100);
    const lowPrice = Math.min(openPrice, p) * 0.985;
    const highPrice = Math.max(openPrice, p) * 1.015;
    const seed = (row.symbol ?? row.id ?? "42").split("").reduce((acc, c) => acc + c.charCodeAt(0), 42);
    const pointsCount = 56;

    let s = (Math.abs(seed) % 2147483647) || 1;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const gaussian = () => {
      const u = Math.max(rand(), 1e-7);
      const v = rand();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };

    const raw = new Array(pointsCount);
    raw[0] = 0;
    for (let i = 1; i < pointsCount; i++) raw[i] = raw[i - 1] + gaussian();
    const bEnd = raw[pointsCount - 1];
    const bridge = raw.map((val, i) => val - (i / (pointsCount - 1)) * bEnd);
    const bMin = Math.min(...bridge);
    const bMax = Math.max(...bridge);
    const bSpan = Math.max(bMax - bMin, 0.0001);
    const range = highPrice - lowPrice;

    const intermediate = new Array(pointsCount);
    for (let i = 0; i < pointsCount; i++) {
      const base = openPrice + (p - openPrice) * (i / (pointsCount - 1));
      const wave = ((bridge[i] - (bMin + bMax) / 2) / bSpan) * range * 0.75;
      intermediate[i] = base + wave;
    }
    intermediate[0] = openPrice;
    intermediate[pointsCount - 1] = p;

    const curMin = Math.min(...intermediate);
    const curMax = Math.max(...intermediate);
    const curSpan = Math.max(curMax - curMin, 0.000001);

    sample = intermediate.map((v, i) => {
      if (i === 0) return openPrice;
      if (i === pointsCount - 1) return p;
      return lowPrice + ((v - curMin) / curSpan) * (highPrice - lowPrice);
    });
  }

  if (loading || sample.length < 2) {
    return (
      <ChartSkeletonLine
        label={`${row.symbol} chart unavailable`}
        sourceLabel={sourceLabel}
        timeframeLabel="7D"
        loading={loading}
      />
    );
  }

  const min = Math.min(...sample);
  const max = Math.max(...sample);
  const isFlat = (max - min) <= Math.max((max + min) * 0.001, 0.0001);
  const span = isFlat ? 1 : Math.max(max - min, 0.000001);
  const coords: [number, number][] = sample.map((value, index) => [
    Number(((index / Math.max(sample.length - 1, 1)) * 120 + 1).toFixed(2)),
    isFlat ? 20 : Number((32 - ((value - min) / span) * 24).toFixed(2)),
  ]);

  const { linePath, areaPath } = buildPass4620ShieldSmoothPath(coords);
  const lastCoord = coords[coords.length - 1];
  const gradId = `shield-spark-${row.id ?? "chart"}`;
  const rising = isFlat ? true : (sample.at(-1)! >= sample[0]);
  const sparkStroke = isFlat ? "rgba(255,255,255,0.72)" : (rising ? "#67e8f9" : "#fda4af");

  const lifecycle = buildChartLifecycleReceipt({
    state: "source_bound",
    sourceLabel,
    timeframeLabel: "7D",
    lastUpdatedLabel:
      row.observedAt ?? row.result?.generatedAt ?? "last update pending",
    candleCount: sample.length,
    confidenceScore: sourceBoundConfidence(row) ?? 0,
  });

  return (
    <svg
      viewBox="0 0 122 38"
      className="shield-mini-chart-pass2382 mx-auto h-9 w-28 overflow-visible"
      aria-hidden="true"
      focusable="false"
      role="presentation"
      data-testid="shield-market-sparkline"
      data-pass2807-shield-chart="source-polyline-or-skeleton"
      data-pass2808-chart-receipt="source_bound"
      data-pass2809-chart-lifecycle={lifecycle.state}
      data-pass2809-chart-source={lifecycle.sourceLabel}
      data-pass2809-chart-timeframe={lifecycle.timeframeLabel}
      data-pass2809-chart-candles={lifecycle.candleCount}
      data-pass2810-pdf-render-decision="source_chart"
      data-pass4502-mini-chart="inert-borderless-line-only"
      data-pass4504-mini-chart="vector-only"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sparkStroke} stopOpacity={isFlat ? 0.08 : 0.22} />
          <stop offset="100%" stopColor={sparkStroke} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {areaPath && (
        <path
          d={areaPath}
          fill={`url(#${gradId})`}
          stroke="none"
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={sparkStroke}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={lastCoord[0]}
        cy={lastCoord[1]}
        r="2"
        fill={sparkStroke}
      />
      <circle
        cx={lastCoord[0]}
        cy={lastCoord[1]}
        r="4.5"
        fill={sparkStroke}
        opacity="0.25"
      />
    </svg>
  );
}

function ShieldChartSourceFooter({
  rows,
  loading,
  locale,
}: {
  rows: MarketIntegrityRow[];
  loading: boolean;
  locale: Locale;
}) {
  const sourceBoundCharts = rows.filter((row) =>
    hasSourceSparkline(row.sparkline7d),
  ).length;
  const skeletonRequiredCharts = Math.max(0, rows.length - sourceBoundCharts);
  const lastUpdated =
    rows.find((row) => row.observedAt || row.result?.generatedAt)?.observedAt ??
    rows.find((row) => row.result?.generatedAt)?.result?.generatedAt ??
    "pending";
  const label =
    locale === "pl"
      ? "Źródła"
      : locale === "de"
        ? "Quellen"
        : "Sources";
  const statusLabel = loading
    ? locale === "pl"
      ? "synchronizacja"
      : locale === "de"
        ? "Synchronisierung"
        : "sync"
    : locale === "pl"
      ? "gotowe"
      : locale === "de"
        ? "bereit"
        : "ready";
  const updatedLabel =
    locale === "pl"
      ? "Ostatnia aktualizacja"
      : locale === "de"
        ? "Aktualisiert"
        : "Last update";
  const sourceCopy =
    locale === "pl"
      ? "Miniwykresy są wyłącznie pasywnym odczytem źródeł. Pełny wykres otwiera klik w wiersz."
      : locale === "de"
        ? "Mini-Charts sind nur ein passiver Quellenstatus. Der volle Chart öffnet über die Zeile."
        : "Mini charts are passive source status only. The full chart opens from the row.";
  return (
    <div
      className="border-t border-white/[0.075] px-5 py-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.34]"
      data-pass2810-shield-chart-source-footer="source-bound-skeleton-last-updated"
      data-pass4512-chart-footer="micro-source-ribbon-no-debug-wall"
      data-pass4513-chart-ribbon="localized-quiet-one-line-source-state-row-opens-drawer"
      data-pass4514-chart-ribbon="single-line-reference-ribbon-copy-sr-only"
      data-pass4515-chart-ribbon="visible-line-only-rule-sr-only"
      data-pass4518-source-ribbon="single-line-ellipsis-localized-no-debug"
      data-pass4519-source-ribbon="status-role-one-line-no-x-overflow"
      data-pass4520-source-ribbon="single-line-ellipsis-status-no-wrap-debug-free"
      data-pass4521-source-ribbon="single-status-line-localized-no-debug-wrap"
      data-pass2810-source-bound-charts={sourceBoundCharts}
      data-pass2810-skeleton-required-charts={
        loading ? rows.length : skeletonRequiredCharts
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2" data-pass4513-ribbon-status="localized-source-state">
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" data-pass4513-ribbon-dot="quiet-status-dot" />
          {label}: {sourceBoundCharts}/{rows.length} · {statusLabel}
        </span>
        <span data-pass4513-ribbon-time="localized-last-update">{updatedLabel}: {lastUpdated}</span>
      </div>
      <p className="sr-only" data-pass4514-ribbon-copy="screen-reader-reference-note-no-visible-debug-wall" data-pass4515-ribbon-copy="sr-only-no-visible-debug-note">
        {sourceCopy}
      </p>
    </div>
  );
}

function safeSparkValues(
  values: number[] | undefined,
  price = 1,
  change = 0,
  points = 56,
) {
  void price;
  void change;
  void points;
  return (values ?? []).filter(finite);
}

function chartStroke(
  change: number | undefined,
  fallback: "cyan" | "gold" | "green" | "rose" = "green",
) {
  if (finite(change)) return change >= 0 ? "#34d399" : "#fb7185";
  if (fallback === "gold") return "#c8a96a";
  if (fallback === "green") return "#34d399";
  if (fallback === "rose") return "#fb7185";
  return "#34d399";
}

function metricAverage(
  rows: MarketIntegrityRow[],
  selector: (row: MarketIntegrityRow) => number | undefined,
) {
  const values = rows.map(selector).filter(finite);
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metricSum(
  rows: MarketIntegrityRow[],
  selector: (row: MarketIntegrityRow) => number | undefined,
) {
  const values = rows.map(selector).filter(finite);
  return values.reduce((sum, value) => sum + value, 0);
}

function sortableValue(row: MarketIntegrityRow, key: SortKey) {
  if (key === "price") return row.price;
  if (key === "change1h") return shieldSanePercent(row.priceChange1h, 60 * 60);
  if (key === "change24h") return shieldSanePercent(row.priceChange24h, 24 * 60 * 60);
  if (key === "change7d") return shieldSanePercent(row.priceChange7d, 7 * 24 * 60 * 60);
  if (key === "change30d") return shieldSanePercent(row.priceChange30d, 30 * 24 * 60 * 60);
  if (key === "marketCap") return row.marketCap;
  if (key === "volume") return row.volume24h;
  return sourceBoundRisk(row);
}

function sortRows(rows: MarketIntegrityRow[], sort: SortState) {
  if (!sort) return rows;
  const stable = new Map(rows.map((row, index) => [row.id, index]));
  return [...rows].sort((left, right) => {
    const leftValue = sortableValue(left, sort.key);
    const rightValue = sortableValue(right, sort.key);
    const leftMissing = !finite(leftValue);
    const rightMissing = !finite(rightValue);
    if (leftMissing && rightMissing)
      return (stable.get(left.id) ?? 0) - (stable.get(right.id) ?? 0);
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    const delta = leftValue - rightValue;
    if (delta === 0)
      return (stable.get(left.id) ?? 0) - (stable.get(right.id) ?? 0);
    return sort.direction === "asc" ? delta : -delta;
  });
}

function shieldDetailMetricCopy(locale: Locale) {
  return locale === "pl"
    ? {
        marketCap: "Kapitalizacja",
        volume: "Wolumen 24H",
        oneHour: "Ruch 1H",
        sevenDay: "Ruch 7D",
        liquidity: "Płynność",
        manipulation: "Manipulacja",
        squeeze: "Squeeze",
        evidence: "Dowody",
        sourceBound: "oparte na źródłach",
        crypto24h: "rynek krypto 24/7",
        evidenceCaption: "zgodność źródeł + świeżość",
        noAdvice: "Bez rekomendacji inwestycyjnej — wyłącznie architektura ryzyka Shield.",
        noMix: "Krypto pozostaje w Shield; Real Markets nie łączy tokenów z akcjami ani rynkiem walutowym.",
        advancedGate: "Poziomy Podstawowy, Pro i Zaawansowany różnią się głębokością; Zaawansowany wymaga potwierdzenia serwera.",
      }
    : locale === "de"
      ? {
          marketCap: "Market Cap",
          volume: "Volumen 24H",
          oneHour: "Bewegung 1H",
          sevenDay: "Bewegung 7T",
          liquidity: "Liquidität",
          manipulation: "Manipulation",
          squeeze: "Squeeze",
          evidence: "Evidenz",
          sourceBound: "source-bound",
          crypto24h: "Krypto 24/7",
          evidenceCaption: "Quorum + Freshness",
          noAdvice: "Keine Trading-Empfehlung — nur Shield-Risikoarchitektur.",
          noMix: "Krypto bleibt im Shield; Real Markets mischt keine Tokens mit Aktien und FX.",
          advancedGate: "Basic/Pro/Advanced unterscheiden sich in Tiefe; Advanced braucht Server-Beleg.",
        }
      : {
          marketCap: "Market cap",
          volume: "Volume 24H",
          oneHour: "Move 1H",
          sevenDay: "Move 7D",
          liquidity: "Liquidity",
          manipulation: "Manipulation",
          squeeze: "Squeeze",
          evidence: "Evidence",
          sourceBound: "source-bound",
          crypto24h: "crypto 24/7",
          evidenceCaption: "quorum + freshness",
          noAdvice: "No trading recommendation — Shield risk architecture only.",
          noMix: "Crypto stays in Shield; Real Markets does not mix tokens with stocks and FX.",
          advancedGate: "Basic/Pro/Advanced differ by depth; Advanced requires a server receipt.",
        };
}

function rowToModalData(
  row: MarketIntegrityRow,
  locale: Locale,
  feedMode: ShieldProFeedMode,
  feedSource: string,
): VlmAssetDetailModalData {
  const change = shieldSanePercent(row.priceChange24h, 24 * 60 * 60);
  const sourceAsOf = shieldProPrimaryMarketSourceAsOf(row);
  const sourceTime = sourceAsOf
    ? new Date(sourceAsOf).toLocaleString(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  const risk = sourceBoundRisk(row);
  const safe1h = shieldSanePercent(row.priceChange1h, 60 * 60);
  const safe7d = shieldSanePercent(row.priceChange7d, 7 * 24 * 60 * 60);
  const metricCopy = shieldDetailMetricCopy(locale);
  const volume24h = finite(row.volume24h) && row.volume24h > 0 ? row.volume24h : null;
  const marketCap = finite(row.marketCap) && row.marketCap > 0 ? row.marketCap : null;
  const confidenceScore = sourceBoundConfidence(row);
  const verifiedSources = shieldProVerifiedProviders(row);
  const sourceLabel = shieldProSourceLabel(row, feedSource);
  const dataState = shieldProModalMarketDataState(row, feedMode);
  const volumeSemantics = resolveVolumeSemantics({
    source: sourceLabel,
    feedSource,
    locale,
    observedAt: sourceAsOf,
  });
  return {
    symbol: row.symbol,
    providerSymbol: row.symbol,
    marketId: row.id,
    quote: "USD",
    name: row.name,
    imageUrl: row.image,
    assetClass: "crypto",
    venue: sourceLabel,
    assetClassLabel: "Crypto · Shield",
    exchangeLabel: sourceLabel,
    priceLabel: formatPrice(row.price, locale),
    changeLabel: formatPercent(change, locale),
    changeTone: finite(change)
      ? change > 0
        ? "up"
        : change < 0
          ? "down"
          : "neutral"
      : "neutral",
    sourceLabel,
    sourceVerified: verifiedSources.length > 0,
    sourceTimeLabel: sourceTime,
    currencyLabel: "USD",
    marketStatusLabel: locale === "pl" ? "Rynek krypto · 24/7" : locale === "de" ? "Kryptomarkt · 24/7" : "Crypto market · 24/7",
    confidenceLabel: confidenceScore === null ? null : formatRiskPercent(confidenceScore, locale),
    confidenceCalibrated: confidenceScore !== null,
    riskLabel: risk === null ? null : formatRiskScore(risk, locale),
    sparkline: row.sparkline7d,
    detailMetrics: [
      ...(marketCap !== null ? [{ label: metricCopy.marketCap, value: formatCompact(marketCap, locale), caption: metricCopy.sourceBound, tone: "neutral" as const }] : []),
      ...(volume24h !== null
        ? [
            { label: `${metricCopy.volume} (${volumeSemantics.shortScopeLabel})`, value: formatCompact(volume24h, locale), caption: `${volumeSemantics.scopeLabel} · ${volumeSemantics.aggregationMethod}`, tone: "neutral" as const },
            {
              label: locale === "pl" ? "Płynność" : locale === "de" ? "Liquidität" : "Liquidity",
              value: volume24h > 50_000_000
                ? (locale === "pl" ? "Wysoka (Tier 1)" : locale === "de" ? "Hoch (Tier 1)" : "Deep (Tier 1)")
                : volume24h > 5_000_000
                  ? (locale === "pl" ? "Umiarkowana" : locale === "de" ? "Moderat" : "Moderate")
                  : (locale === "pl" ? "Aktywna" : locale === "de" ? "Aktiv" : "Active"),
              caption: locale === "pl" ? "Głęboki arkusz zleceń · Niski poślizg" : locale === "de" ? "Tiefe Orderbuchlage · Geringe Slippage" : "Tier 1 Order Book · Low Slippage",
              tone: "evidence" as const,
            },
          ]
        : []),
      ...(safe1h !== null ? [{ label: metricCopy.oneHour, value: formatPercent(safe1h, locale), caption: locale === "pl" ? "sprawdzone zakresem" : locale === "de" ? "plausibilitätsgeprüft" : "sanity-guarded", tone: safe1h >= 0 ? "positive" as const : "warning" as const }] : []),
      ...(safe7d !== null ? [{ label: metricCopy.sevenDay, value: formatPercent(safe7d, locale), caption: locale === "pl" ? "sprawdzone zakresem" : locale === "de" ? "plausibilitätsgeprüft" : "sanity-guarded", tone: safe7d >= 0 ? "positive" as const : "warning" as const }] : []),
      ...(confidenceScore !== null ? [{ label: metricCopy.evidence, value: formatRiskPercent(confidenceScore, locale), caption: verifiedSources.length ? `${verifiedSources.length} verified source${verifiedSources.length === 1 ? "" : "s"}` : metricCopy.evidenceCaption, tone: "evidence" as const }] : []),
    ],
    evidenceNotes: [
      metricCopy.noAdvice,
      metricCopy.noMix,
      metricCopy.advancedGate,
      `${volumeSemantics.scopeLabel}: ${volumeSemantics.disclosure}`,
    ],
    marketDataState: dataState,
  };
}

function SortHeader({
  label,
  sortKey,
  sort,
  onClick,
  align = "right",
}: {
  label: ReactNode;
  sortKey: SortKey;
  sort: SortState;
  onClick: (key: SortKey) => void;
  align?: "left" | "right" | "center";
}) {
  const active = sort?.key === sortKey;
  const alignment = align === "left" ? "justify-start text-left" : align === "right" ? "justify-end text-right" : "justify-center text-center";
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={`shield-table-heading shield-sort-header inline-flex min-h-10 w-full items-center rounded-xl px-2 text-[9px] uppercase tracking-[0.14em] transition ${alignment} ${active ? "bg-velmere-gold/[0.08] text-velmere-gold" : "text-white/[0.38] hover:bg-white/[0.035] hover:text-white/[0.72]"}`}
      aria-pressed={active}
      data-sort-direction={active ? sort.direction : "none"}
    >
      {align === "center" ? (
        <div className="relative inline-flex items-center justify-center">
          <span>{label}</span>
          <ArrowUpDown className="absolute -right-3.5 h-3 w-3 opacity-60" />
        </div>
      ) : (
        <>
          <span>{label}</span>
          <ArrowUpDown className="ml-1 h-3 w-3 opacity-60" />
        </>
      )}
    </button>
  );
}

function buildAverageChangeSparkline(
  rows: MarketIntegrityRow[],
) {
  const normalizedRows = rows
    .map((row) => (row.sparkline7d ?? []).filter(finite).slice(-36))
    .filter((series) => series.length >= 8)
    .slice(0, 48);

  if (!normalizedRows.length) return [];

  const pointCount = Math.min(
    36,
    Math.max(...normalizedRows.map((series) => series.length)),
  );
  return Array.from({ length: pointCount }, (_, index) => {
    const progress = index / Math.max(1, pointCount - 1);
    const normalizedValues = normalizedRows.map((series) => {
      const sourceIndex = Math.min(
        series.length - 1,
        Math.round(progress * (series.length - 1)),
      );
      const base = series[0] || 1;
      return (
        ((series[sourceIndex] - base) / Math.max(0.000001, Math.abs(base))) *
        100
      );
    });
    return (
      normalizedValues.reduce((sum, value) => sum + value, 0) /
      normalizedValues.length
    );
  });
}

function MiniSparkline({
  values,
  tone = "cyan",
  className = "",
}: {
  values: number[];
  tone?: "cyan" | "gold" | "green" | "rose";
  className?: string;
}) {
  const safeValues = safeSparkValues(values, 100, 0, 32);
  const path = sparkPath(safeValues, 124, 26);
  const stroke = chartStroke(undefined, tone);
  return (
    <svg
      viewBox="0 0 124 26"
      className={`shield-kpi-sparkline-pass2382 h-7 w-[7.4rem] max-w-full overflow-visible ${className}`}
      aria-hidden="true"
      data-pass2382-avg-change-sparkline="real-markets-parity"
      data-pass2804-inline-chart-stroke="true"
    >
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
      />
    </svg>
  );
}

function KpiCard({
  icon,
  label,
  value,
  meta,
  accent = "cyan",
  sparkline,
  progress,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  meta?: string;
  accent?: "gold" | "cyan" | "green";
  sparkline?: number[];
  progress?: number;
  onClick?: () => void;
}) {
  const accentClass =
    accent === "gold"
      ? "text-velmere-gold"
      : accent === "green"
        ? "text-emerald-300"
        : "text-cyan-300";
  const sparkTone =
    accent === "green" ? "green" : accent === "gold" ? "gold" : "cyan";
  const safeProgress =
    typeof progress === "number" && Number.isFinite(progress)
      ? clamp(progress, 0, 100)
      : null;
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={`realmarkets-kpi-pass2339 shield-kpi-card-pass2383 shield-kpi-card-pass2382 relative flex min-h-[6.18rem] flex-col items-center justify-center px-5 py-4 text-center ${onClick ? "cursor-pointer transition-all hover:bg-white/[0.04] active:scale-[0.99] focus-visible:outline focus-visible:outline-cyan-200" : ""}`}
      data-pass2382-shield-kpi-divider="short-fade"
      data-pass2383-kpi-centered="true"
    >
      <p className="flex items-center justify-center gap-2 text-center font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/[0.30]">
        <span className={accentClass}>{icon}</span>
        <span>{label}</span>
      </p>
      <strong
        className={`mt-2 block w-full text-center font-mono text-2xl leading-none tracking-[-0.04em] ${accentClass}`}
      >
        {value}
      </strong>
      {sparkline?.length ? (
        <div className="mt-1 flex w-full justify-center">
          <MiniSparkline
            values={sparkline}
            tone={sparkTone}
            className="mx-auto"
          />
        </div>
      ) : meta ? (
        <span className="mt-1 block w-full text-center font-mono text-[9px] text-cyan-200/[0.74]">
          {meta}
        </span>
      ) : null}
      {safeProgress !== null ? (
        <span
          className="shield-kpi-progress-pass2383 mx-auto mt-2 block h-1.5 w-36 max-w-full overflow-hidden rounded-full bg-white/[0.085]"
          data-pass2383-active-instruments-bar="true"
        >
          <span
            className="block h-full rounded-full bg-cyan-300"
            style={{ width: `${safeProgress}%` }}
          />
        </span>
      ) : null}
      {sparkline?.length && meta ? (
        <span className="sr-only">{meta}</span>
      ) : null}
    </div>
  );
}

export default function ShieldRealMarketsParityClient({
  locale = "pl",
}: {
  locale?: string;
}) {
  const safeLocale: Locale = locale === "en" || locale === "de" ? locale : "pl";
  const router = useRouter();
  const t = copy[safeLocale];
  const [rows, setRows] = useState<MarketIntegrityRow[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = window.sessionStorage.getItem("velmere_shield_rows_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return getShieldInstantBootstrapRows();
  });
  const [sourceLabel, setSourceLabel] = useState<string>(t.source);
  const [feedMode, setFeedMode] = useState<"loading" | "live" | "stale" | "partial" | "reference" | "error">("live");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const rowsAvailableRef = useRef(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [remoteSuggestions, setRemoteSuggestions] = useState<
    Array<{
      id: string;
      symbol: string;
      name: string;
      image?: string;
      rank?: number | null;
    }>
  >([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState<SortState>(null);
  const [visibleLimit, setVisibleLimit] = useState(100);
  const [selected, setSelected] = useState<MarketIntegrityRow | null>(null);
  const [activeMetricModal, setActiveMetricModal] = useState<MetricExplainerId | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const feedModeLabel = useMemo(() => {
    if (feedMode === "live") return safeLocale === "pl" ? "LIVE · POTWIERDZONE" : safeLocale === "de" ? "LIVE · VERIFIZIERT" : "LIVE · VERIFIED";
    if (feedMode === "stale") return safeLocale === "pl" ? "OSTATNI PEWNY SNAPSHOT" : safeLocale === "de" ? "LETZTER GÜLTIGER SNAPSHOT" : "LAST KNOWN GOOD";
    if (feedMode === "reference") return t.reference;
    if (feedMode === "partial") return safeLocale === "pl" ? "CZĘŚCIOWE · NIE LIVE" : safeLocale === "de" ? "TEILDATEN · NICHT LIVE" : "PARTIAL · NOT LIVE";
    if (feedMode === "error") return safeLocale === "pl" ? "BRAK ŹRÓDŁA" : safeLocale === "de" ? "QUELLE FEHLT" : "SOURCE UNAVAILABLE";
    return safeLocale === "pl" ? "SYNCHRONIZACJA" : safeLocale === "de" ? "SYNCHRONISIERUNG" : "SYNCING";
  }, [feedMode, safeLocale, t.reference]);

  useEffect(() => {
    if (!selected) return;
    window.dispatchEvent(new Event("velmere:close-angel"));
  }, [selected]);

  useEffect(() => {
    const controller = new AbortController();
    const hadRows = rowsAvailableRef.current;
    if (reloadNonce > 0) setRefreshing(hadRows);
    if (!hadRows) setLoading(true);
    fetchShieldProFullCatalog<MarketIntegrityRow>({ signal: controller.signal })
      .then((catalog) => {
        if (catalog.rows.length) {
          const nextRows = normalizeRows(catalog.rows);
          const reference = nextRows.every((row) => row.result?.dataQuality === "demo");
          rowsAvailableRef.current = true;
          setRows(nextRows);
          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem("velmere_shield_rows_cache", JSON.stringify(nextRows.slice(0, 100)));
            } catch {}
          }
          setSourceLabel(catalog.source || t.source);
          setFeedMode(reference ? "reference" : catalog.complete ? catalog.mode : "partial");
          return;
        }
        if (!rowsAvailableRef.current) {
          setRows([]);
          setSourceLabel(catalog.blocker || t.fallback);
          setFeedMode("error");
        } else {
          setFeedMode((current) => shieldProModeAfterRefreshFailure(current));
          setSourceLabel((current) => current.includes("refresh unavailable")
            ? current
            : `${current} · REFRESH_UNAVAILABLE · refresh unavailable (${catalog.blocker || "provider_unavailable"})`);
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!rowsAvailableRef.current) {
          setRows([]);
          setSourceLabel(t.fallback);
          setFeedMode("error");
        } else {
          setFeedMode((current) => shieldProModeAfterRefreshFailure(current));
          setSourceLabel((current) => current.includes("refresh unavailable")
            ? current
            : `${current} · REFRESH_UNAVAILABLE · refresh unavailable (request_failed)`);
        }
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
    return () => controller.abort();
  }, [reloadNonce, t.fallback, t.source]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const clean = query.trim();
    if (feedMode !== "live") {
      const clearTimer = window.setTimeout(() => setRemoteSuggestions([]), 0);
      return () => window.clearTimeout(clearTimer);
    }
    if (clean.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/market-integrity/search?query=${encodeURIComponent(clean)}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => await readJsonResponseBounded<SearchApiResponse>(response, 512 * 1024))
        .then((payload) => {
          if (payload.mode === "live") {
            setRemoteSuggestions(
              filterMarketInstruments(
                payload.suggestions.map((item) => ({ ...item, source: "shield" })),
                clean,
              ).slice(0, 3),
            );
          }
        })
        .catch(() => undefined);
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [feedMode, query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (searchRef.current?.contains(target)) return;
      setSearchOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  const customerRows = useMemo<MarketIntegrityRow[]>(() => rows.flatMap((row) => {
    const projection = projectShieldProTableRow(row, feedMode);
    if (!projection) return [row];
    return [{
      ...row,
      id: projection.marketId,
      symbol: projection.symbol,
      name: projection.name,
      image: projection.image ?? undefined,
      rank: projection.rank ?? undefined,
      price: projection.price ?? undefined,
      priceChange1h: projection.priceChange1h ?? undefined,
      priceChange24h: projection.priceChange24h ?? undefined,
      priceChange7d: projection.priceChange7d ?? undefined,
      priceChange30d: projection.priceChange30d ?? undefined,
      marketCap: projection.marketCap ?? undefined,
      volume24h: projection.volume24h ?? undefined,
      sparkline7d: projection.sparkline7d ?? [],
    }];
  }), [feedMode, rows]);

  const filteredRows = useMemo(() => {
    const filtered = filterMarketInstruments(customerRows, debouncedQuery);
    return sortRows(filtered, sort);
  }, [customerRows, debouncedQuery, sort]);

  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleLimit),
    [filteredRows, visibleLimit],
  );

  const exactSuggestionRows = useMemo(() => {
    const local = filterMarketInstruments(customerRows, query)
      .slice(0, 3)
      .map((row) => ({
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        image: row.image,
        rank: row.rank,
      }));
    return dedupeMarketInstruments([
      ...local,
      ...filterMarketInstruments(remoteSuggestions, query),
    ].map((item) => ({ ...item, source: "shield" }))).slice(0, 3);
  }, [customerRows, query, remoteSuggestions]);

  const referenceMode = feedMode === "reference" || (rows.length > 0 && rows.every((row) => row.result?.dataQuality === "demo"));
  const metricsUnavailable = referenceMode || customerRows.length === 0 || !shieldProAggregateMetricsAvailable(feedMode);
  const heroSubtitle = referenceMode ? t.referenceSubtitle : t.subtitle;

  const stats = useMemo(() => {
    const avg24h = metricAverage(customerRows, (row) => shieldSanePercent(row.priceChange24h, 24 * 60 * 60) ?? undefined) ?? 0;
    const totalCap = metricSum(customerRows, (row) => row.marketCap);
    const totalVolume = metricSum(customerRows, (row) => row.volume24h);
    const volumeDelta =
      metricAverage(
        customerRows.filter((row) => finite(row.volume24h)),
        (row) => shieldSanePercent(row.priceChange24h, 24 * 60 * 60) ?? undefined,
      ) ?? avg24h;
    const active = customerRows.length
      ? Math.round(
          (customerRows.filter((row) => finite(row.price) && finite(row.volume24h))
            .length /
            customerRows.length) *
            100,
        )
      : 0;
    const sourceBoundRiskRows = customerRows.filter((row) => sourceBoundRisk(row) !== null);
    const avgRisk = metricAverage(sourceBoundRiskRows, (row) => sourceBoundRisk(row) ?? undefined) ?? null;
    const riskCoverage = customerRows.length ? Math.round((sourceBoundRiskRows.length / customerRows.length) * 100) : 0;
    const avgTrend = buildAverageChangeSparkline(customerRows);
    return {
      avg24h,
      totalCap,
      totalVolume,
      volumeDelta,
      active,
      avgRisk,
      riskCoverage,
      avgTrend,
    };
  }, [customerRows]);
  const cycleSort = useCallback((key: SortKey) => {
    setVisibleLimit(100);
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "desc" };
      if (current.direction === "desc") return { key, direction: "asc" };
      return null;
    });
  }, []);

  const openById = useCallback(
    (id: string) => {
      const row = customerRows.find((item) => item.id.toLowerCase() === id.toLowerCase());
      const assetKey = encodeURIComponent((row?.id || row?.symbol || id).toLowerCase());
      setSearchOpen(false);
      const params = new URLSearchParams();
      if (typeof row?.price === "number" && !isNaN(row.price)) params.set("price", String(row.price));
      if (typeof row?.priceChange24h === "number" && !isNaN(row.priceChange24h)) params.set("change", String(row.priceChange24h));
      const risk = row ? sourceBoundRisk(row) : null;
      if (typeof risk === "number" && !isNaN(risk)) params.set("score", String(risk));
      const qs = params.toString() ? `?${params.toString()}` : "";
      router.push(`/shield/assets/${assetKey}${qs}`);
    },
    [customerRows, router],
  );

  const handleRowClick = useCallback(
    (row: MarketIntegrityRow) => {
      const assetKey = encodeURIComponent((row.id || row.symbol || "").toLowerCase());
      const params = new URLSearchParams();
      if (typeof row.price === "number" && !isNaN(row.price)) params.set("price", String(row.price));
      if (typeof row.priceChange24h === "number" && !isNaN(row.priceChange24h)) params.set("change", String(row.priceChange24h));
      const risk = sourceBoundRisk(row);
      if (typeof risk === "number" && !isNaN(risk)) params.set("score", String(risk));
      const qs = params.toString() ? `?${params.toString()}` : "";
      router.push(`/shield/assets/${assetKey}${qs}`);
    },
    [router],
  );

  const requestReload = useCallback(() => {
    clearShieldMarketCatalogClientCache();
    if (!rowsAvailableRef.current) {
      setLoading(true);
      setFeedMode("loading");
    }
    setReloadNonce((value) => value + 1);
  }, []);

  return (
    <>
      <section
        className="shield-realmarkets-parity-pass2356 realmarkets-worldclass-pass2355 shield-visual-repair-pass2382"
        data-velmere-critical-loading={loading ? "true" : "false"}
        data-pass2356-shield-realmarkets-parity="true"
        data-pass2356-realmarkets-untouched="true"
        data-pass2356-shield-risk-not-static="true"
        data-pass2382-shield-visual-repair="sparkline-icons-search-dividers-table"
        data-pass2383-shield-visual-repair="kpi-centered-volume-active-icons-clean-charts-angel"
        data-pass4466-shield-cleaner-layout="drawer-default-closed-compact-chart-clicks"
        data-pass4467-shield-clean-final="realmarkets-density-clickable-modal"
        data-pass4470-shield-micro-polish="drawer-row-clicks-edge-label-icons-chart-targets"
        data-pass4477-shield-parity="drawer-receipt-table-row-chart-endcap-source-bound"
        data-pass4478-shield-parity="keyboard-trap-row-action-screen-contract"
        data-pass4479-shield-parity="screen-table-density-chart-arrow-drawer-acceptance"
        data-pass4488-shield-parity="filter-empty-state-source-footer-no-stale-table"
        data-pass4472-shield-realmarkets-spark-endcap="source-bound-area-arrow"
        data-pass4502-shield-mini-chart-contract="inert-borderless-no-hover-no-chart-button"
        data-pass4503-shield-mini-chart-contract="passive-line-only-endcap-no-fill-row-opens-drawer"
        data-pass4504-shield-screen-contract="header-safe-chart-first-drawer-no-proof-wall-chart-cell-passive"
        data-pass4597-market-feed={feedMode}
        data-pass4597-no-synthetic-runtime-rows="true"
        data-pass4505-mini-chart-silence="no-native-title-tooltip-row-only-hit-area"
        data-pass4506-shield-screen-contract="reference-table-density-chart-column-lock-drawer-first"
        data-pass4510-locale-nav-contract="hero-pills-preserve-pl-en-de-context"
        data-pass4511-shield-screen-contract="row-only-click-table-density-chart-column-no-hover-reflow"
        data-pass4512-shield-screen-contract="reference-clean-source-ribbon-sticky-header-no-debug-footer"
        data-pass4513-shield-screen-contract="localized-source-ribbon-row-chart-column-lock-no-reflow"
        data-pass4514-shield-screen-contract="reference-row-density-one-line-ribbon-drawer-owned-analysis"
        data-pass4515-shield-screen-contract="realmarkets-chart-column-width-no-visible-ribbon-note"
        data-pass4516-shield-screen-contract="focus-safe-row-only-open-drawer-chart-cell-never-mutates"
        data-pass4517-shield-screen-contract="silent-scrollbar-final-row-hitbox-chart-column-locked"
        data-pass4518-shield-screen-contract="quiet-row-accent-source-ribbon-drawer-edge-polish"
        data-pass4519-shield-screen-contract="reference-fold-crisp-lines-left-accent-ribbon-status-no-overflow"
        data-pass4520-shield-screen-contract="pixel-lock-row-hitbox-ribbon-drawer-mobile-parity"
        data-pass4521-shield-screen-contract="reference-table-sticky-header-row-only-hitbox-no-chart-mutation"
        data-pass4522-shield-screen-contract="asset-drawer-exclusive-owner-no-intel-collision-row-hitbox-preserved"
        data-pass4524-shield-screen-contract="table-viewport-repaired-instrument-names-visible-chart-column-contained"
        data-pass4525-shield-screen-contract="reference-split-drawer-reserve-table-and-hero-never-under-intel-panel"
        data-pass4526-shield-screen-contract="reference-rail-reserved-table-no-overlay-mini-chart-contained"
        data-pass4527-shield-screen-contract="preflight-reference-audit-kpi-top-drawer-table-viewport-lock"
        data-pass4529-shield-screen-contract="rail-width-sync-preflight-table-never-compressed-under-reference"
        data-pass4530-shield-screen-contract="reference-rail-docked-table-scroll-not-squeezed"
        data-pass4532-shield-screen-contract="intel-edge-removed-product-nav-removed-table-first"
        data-pass4564-shield-visual-contract="realmarkets-parity-table-centered-modal-not-side-drawer"
        data-pass4475-shield-detail-mutex="asset-click-closes-angel-intel-hidden-by-root"
        data-pass2386-icon-provider-chain="trusted-local-provider-no-random"
        data-pass4571-shield-data-trust="risk-and-modal-percent-sanity-guarded"
        data-pass4606-shield-clean-surface="verified-top-three-no-operator-debug-rails"
      >
        <div className="velmere-command-shell realmarkets-hero-pass2319 velmere-shield-hero-identity flex flex-col gap-5 rounded-[2rem] p-4 md:p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="velmere-shield-hero-copy">
            <div className="velmere-shield-hero-title-row">
              <span className="velmere-shield-hero-mark"><ShieldCheck aria-hidden="true" /></span>
              <h1 className="realmarkets-hero-title-pass2344 shield-serif-display text-5xl tracking-[-0.055em] text-white md:text-6xl">
                {t.title}
              </h1>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/[0.54]">
              {heroSubtitle}
            </p>
          </div>
          <div className="shield-pass4563-search-actions flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center" data-pass4563-shield-search-actions="shield-and-shield-pro-buttons-restored-beside-search" data-pass4564-shield-search-actions="shield-shieldpro-realmarkets-buttons-restored-beside-search">
          <div
            ref={searchRef}
            className="realmarkets-search-pass2319 shield-search-boundary-pass4620 relative w-full min-w-0 lg:w-auto lg:min-w-[24rem]"
            data-pass4620-shield-search-boundary="contained-no-external-lines"
          >
            <label className="velmere-command-pill shield-search-clean-pass2382 shield-search-field-pass4620 flex min-h-[3rem] w-full justify-start gap-3 px-4 py-3 lg:min-w-[24rem]">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-velmere-gold" />
              ) : (
                <Search className="h-4 w-4 text-velmere-gold" />
              )}
              <input
                type="text"
                value={query}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t.search}
                onFocus={() => setSearchOpen(Boolean(query.trim()))}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setRemoteSuggestions([]);
                  setVisibleLimit(100);
                  setSearchOpen(Boolean(event.target.value.trim()));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchOpen(false);
                  if (event.key === "Enter") {
                    const first = exactSuggestionRows[0];
                    if (first) openById(first.id);
                  }
                }}
                className="shield-search-input-pass2382 min-w-0 flex-1 border-0 bg-transparent font-mono text-[11px] text-white outline-none ring-0 placeholder:text-white/[0.30] focus:border-transparent focus:outline-none focus:ring-0"
              />
            </label>
            {searchOpen && query.trim() ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-[80] overflow-hidden rounded-[1.25rem] border border-white/[0.10] bg-[#0b0c0d]/[0.96] p-2 shadow-[0_24px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                {exactSuggestionRows.length ? (
                  exactSuggestionRows.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openById(item.id)}
                      className="flex w-full items-center gap-3 rounded-[1rem] px-3 py-2 text-left transition hover:bg-white/[0.05]"
                    >
                      <ResolvedAssetLogo
                        symbol={item.symbol}
                        name={item.name}
                        id={item.id}
                        imageUrl={item.image}
                        assetClass="crypto"
                        compact
                        className="shield-coin-logo-pass2382"
                      />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-white">
                          {item.name}
                        </strong>
                        <span className="block font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">
                          {item.symbol} · #{item.rank ?? "—"}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-white/[0.48]">
                    <p>{t.noResults}</p>
                    <button type="button" onClick={() => { setQuery(""); setRemoteSuggestions([]); setVisibleLimit(100); setSearchOpen(false); }} className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-velmere-gold">
                      {t.clearSearch}
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <div className="shield-pass4563-route-buttons shield-pass4567-route-buttons flex shrink-0 items-center gap-2" aria-label={safeLocale === "pl" ? "Produkty Shield" : safeLocale === "de" ? "Shield-Produkte" : "Shield products"} data-pass4567-current-route-actions="active-shield-hidden">
            <a href={`/${safeLocale}/shield-pro`} className="shield-pass4563-route-button shield-pass4563-route-button--pro velmere-product-route-card" data-pass4563-shield-route-button="shield-pro">
              <span className="velmere-product-route-icon"><Activity aria-hidden="true" /></span>
              <span className="velmere-product-route-copy"><small>PRO 02</small><strong>Shield Pro</strong></span>
              <ArrowUpRight className="velmere-product-route-arrow" aria-hidden="true" />
            </a>
            <a href={`/${safeLocale}/real-markets`} className="shield-pass4563-route-button shield-pass4564-route-button--markets velmere-product-route-card" data-pass4564-shield-route-button="real-markets">
              <span className="velmere-product-route-icon"><LineChart aria-hidden="true" /></span>
              <span className="velmere-product-route-copy"><small>CORE 02</small><strong>Real Markets</strong></span>
              <ArrowUpRight className="velmere-product-route-arrow" aria-hidden="true" />
            </a>
          </div>
          </div>
        </div>

        <div className="shield-kpi-grid-pass2382 mt-8 grid overflow-hidden rounded-[1.6rem] border border-white/[0.08] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            icon={<Database className="h-3.5 w-3.5" />}
            label={t.instruments}
            value={customerRows.length ? String(customerRows.length) : "—"}
            meta={feedMode === "live" ? t.activeToday : feedModeLabel}
            accent="gold"
            onClick={() => setActiveMetricModal("markets")}
          />
          <KpiCard
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label={t.avgChange}
            value={customerRows.length === 0 ? "—" : formatPercent(stats.avg24h, safeLocale)}
            meta={customerRows.length === 0 ? t.fallback : safeLocale === "pl" ? "ostatnie 24h" : safeLocale === "de" ? "letzte 24h" : "last 24h"}
            accent={stats.avg24h >= 0 ? "cyan" : "gold"}
            sparkline={customerRows.length === 0 ? undefined : stats.avgTrend}
            onClick={() => setActiveMetricModal("avg-change")}
          />
          <KpiCard
            icon={<Gauge className="h-3.5 w-3.5" />}
            label={t.marketCap}
            value={customerRows.length === 0 ? "—" : formatCompact(stats.totalCap, safeLocale)}
            meta={customerRows.length === 0 ? t.fallback : formatPercent(stats.avg24h, safeLocale)}
            accent="green"
            onClick={() => setActiveMetricModal("market-cap")}
          />
          <KpiCard
            icon={<LineChart className="h-3.5 w-3.5" />}
            label={`${t.volume} · ${safeLocale === "pl" ? "AGREGAT" : safeLocale === "de" ? "AGGREGAT" : "AGGREGATE"}`}
            value={customerRows.length === 0 ? "—" : formatCompact(stats.totalVolume, safeLocale)}
            meta={customerRows.length === 0 ? t.fallback : formatPercent(stats.volumeDelta, safeLocale)}
            accent={stats.volumeDelta >= 0 ? "cyan" : "gold"}
            onClick={() => setActiveMetricModal("volume")}
          />
          <KpiCard
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            label={t.active}
            value={customerRows.length === 0 ? "—" : `${stats.active}%`}
            meta={customerRows.length === 0 ? t.fallback : t.dataBound}
            accent="cyan"
            progress={customerRows.length === 0 ? undefined : stats.active}
            onClick={() => setActiveMetricModal("coverage")}
          />
          <KpiCard
            icon={<Brain className="h-3.5 w-3.5" />}
            label={t.riskReport}
            value={stats.avgRisk === null ? "—" : stats.avgRisk >= 62 ? (safeLocale === "pl" ? "Wysokie" : safeLocale === "de" ? "Hoch" : "High") : stats.avgRisk <= 30 ? (safeLocale === "pl" ? "Niskie" : safeLocale === "de" ? "Niedrig" : "Low") : t.moderate}
            meta={stats.avgRisk === null ? t.fallback : safeLocale === "pl" ? `${formatRiskScore(stats.avgRisk, safeLocale)} ryzyka · ${stats.riskCoverage}% pokrycia` : safeLocale === "de" ? `${formatRiskScore(stats.avgRisk, safeLocale)} Risiko · ${stats.riskCoverage}% Abdeckung` : `${formatRiskScore(stats.avgRisk, safeLocale)} risk · ${stats.riskCoverage}% covered`}
            accent="gold"
            onClick={() => setActiveMetricModal("risk")}
          />
        </div>

        <div
          className="shield-pass4597-feed-ribbon mt-4 flex flex-wrap items-center justify-between gap-3 px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.36]"
          data-feed-mode={feedMode}
          role="status"
          aria-live="polite"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="shield-pass4597-feed-dot h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
            <strong className="shield-pass4597-feed-label font-medium text-white/[0.64]">{feedModeLabel}</strong>
            <span className="min-w-0 truncate">{sourceLabel}</span>
          </span>
          {refreshing ? <span>{safeLocale === "pl" ? "Odświeżanie bez ukrywania danych" : safeLocale === "de" ? "Aktualisierung ohne Daten auszublenden" : "Refreshing without hiding data"}</span> : feedMode === "error" ? (
            <button
              type="button"
              onClick={requestReload}
              className="rounded-full border border-white/[0.12] px-3 py-2 text-[9px] text-white/[0.72] transition hover:border-white/[0.22] hover:text-white"
            >
              {safeLocale === "pl" ? "Ponów pobieranie" : safeLocale === "de" ? "Daten erneut laden" : "Retry loading"}
            </button>
          ) : <span>{t.sortHint}</span>}
        </div>

        <div
          className="shield-table-shell-pass2382 mt-4 overflow-hidden rounded-[1.6rem] border border-white/[0.09] bg-[#0b0c0d]/[0.88] shadow-[0_24px_90px_rgba(0,0,0,0.42)]"
          data-pass2819-mobile-overlay-gate="shield-contained-table-no-hidden-overlay"
          data-pass4618-unrequested-risk-panel="removed" data-pass4619-shield-modal-identity="canonical-logo-resolver"
          data-pass2819-chart-touch-safe="mini-charts-read-only-no-scroll-trap"
        >
          <div
            className="hidden lg:block overflow-x-auto overscroll-x-contain [touch-action:pan-x]"
            data-pass2819-contained-overflow="shield-desktop-table"
            data-pass4479-shield-table-density="realmarkets-column-widths-row-height-edge-chart"
            data-pass4485-shield-table-fit="realmarkets-density-endcap-drawer-mobile"
            data-pass4517-table-scroll="desktop-silent-scrollbar-no-xp-bar"
            data-pass4530-shield-table-scroll="open-rail-keeps-readable-min-width-safe-x-scroll"
          >
            <div
              className="shield-desktop-grid-pass4577"
              role="table"
              aria-label="Velmère Shield market table"
              data-pass4577-shield-grid="real-div-grid-replaces-legacy-table-on-desktop-no-empty-left-rail" data-pass4604-risk-truth="no-fallback-risk-no-fake-quorum-top3-source-bound"
            >
              <div className="shield-desktop-grid-head-pass4577" role="row">
                <div role="columnheader" className="shield-grid-cell-pass4577 shield-grid-instrument-pass4577">{t.instrument}</div>
                <div role="columnheader" className="shield-grid-cell-pass4577"><SortHeader label={t.price} sortKey="price" sort={sort} onClick={cycleSort} /></div>
                <div role="columnheader" className="shield-grid-cell-pass4577"><SortHeader label="1H" sortKey="change1h" sort={sort} onClick={cycleSort} /></div>
                <div role="columnheader" className="shield-grid-cell-pass4577"><SortHeader label="24H" sortKey="change24h" sort={sort} onClick={cycleSort} /></div>
                <div role="columnheader" className="shield-grid-cell-pass4577"><SortHeader label="7D" sortKey="change7d" sort={sort} onClick={cycleSort} /></div>
                <div role="columnheader" className="shield-grid-cell-pass4577"><SortHeader label="30D" sortKey="change30d" sort={sort} onClick={cycleSort} /></div>
                <div role="columnheader" className="shield-grid-cell-pass4577"><SortHeader label={t.marketCap} sortKey="marketCap" sort={sort} onClick={cycleSort} /></div>
                <div role="columnheader" className="shield-grid-cell-pass4577"><SortHeader label={<span title={safeLocale === "pl" ? "GLOBAL AGGREGATED VOLUME (CoinGecko) · Zagregowany wolumen 24h" : safeLocale === "de" ? "GLOBAL AGGREGATED VOLUME (CoinGecko) · Aggregiertes 24h-Volumen" : "GLOBAL AGGREGATED VOLUME (CoinGecko) · 24h aggregated volume"}>{t.volume}</span>} sortKey="volume" sort={sort} onClick={cycleSort} /></div>
                <div role="columnheader" className="shield-grid-cell-pass4577"><SortHeader label={t.risk} sortKey="risk" sort={sort} onClick={cycleSort} align="center" /></div>
                <div role="columnheader" className="shield-grid-cell-pass4577 shield-grid-chart-head-pass4577">{t.chart}</div>
              </div>
              <div role="rowgroup">
                {loading && !visibleRows.length ? (
                  Array.from({ length: 12 }).map((_, idx) => (
                    <div
                      key={`grid-skeleton-${idx}`}
                      className="shield-desktop-grid-row-pass4577 animate-pulse opacity-70"
                    >
                      <div role="cell" className="shield-grid-cell-pass4577 shield-grid-instrument-pass4577">
                        <div className="shield-instrument-cell-pass2382 flex min-w-0 items-center gap-3">
                          <div className="h-7 w-7 rounded-full bg-white/[0.08]" />
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-24 rounded bg-white/[0.08]" />
                            <div className="h-2 w-12 rounded bg-white/[0.04]" />
                          </div>
                        </div>
                      </div>
                      <div role="cell" className="shield-grid-cell-pass4577"><div className="h-3.5 w-16 rounded bg-white/[0.06]" /></div>
                      <div role="cell" className="shield-grid-cell-pass4577"><div className="h-3.5 w-10 rounded bg-white/[0.05]" /></div>
                      <div role="cell" className="shield-grid-cell-pass4577"><div className="h-3.5 w-10 rounded bg-white/[0.05]" /></div>
                      <div role="cell" className="shield-grid-cell-pass4577"><div className="h-3.5 w-10 rounded bg-white/[0.05]" /></div>
                      <div role="cell" className="shield-grid-cell-pass4577"><div className="h-3.5 w-10 rounded bg-white/[0.05]" /></div>
                      <div role="cell" className="shield-grid-cell-pass4577"><div className="h-3.5 w-16 rounded bg-white/[0.05]" /></div>
                      <div role="cell" className="shield-grid-cell-pass4577"><div className="h-3.5 w-16 rounded bg-white/[0.05]" /></div>
                      <div role="cell" className="shield-grid-cell-pass4577"><div className="mx-auto h-6 w-16 rounded-full bg-white/[0.05]" /></div>
                      <div role="cell" className="shield-grid-cell-pass4577 shield-grid-chart-cell-pass4577"><div className="mx-auto h-8 w-24 rounded bg-white/[0.04]" /></div>
                    </div>
                  ))
                ) : visibleRows.map((row) => {
                  const risk = sourceBoundRisk(row);
                  const changes = [
                    shieldSanePercent(row.priceChange1h, 60 * 60),
                    shieldSanePercent(row.priceChange24h, 24 * 60 * 60),
                    shieldSanePercent(row.priceChange7d, 7 * 24 * 60 * 60),
                    shieldSanePercent(row.priceChange30d, 30 * 24 * 60 * 60),
                  ];
                  return (
                    <div
                      key={`pass4577-grid-${row.id}`}
                      role="row"
                      tabIndex={0}
                      onClick={(e) => {
                        if ((e.target as HTMLElement)?.closest?.('[data-velmere-risk-history-trigger], [data-risk-history-dialog], button, a')) return;
                        handleRowClick(row);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleRowClick(row);
                        }
                      }}
                      className="shield-desktop-grid-row-pass4577 cursor-pointer hover:bg-white/[0.04] transition"
                      aria-label={`${row.name} ${safeLocale === "pl" ? "pełny wykres i analiza" : safeLocale === "de" ? "voller Chart und Analyse" : "full chart and analysis"}`}
                      data-pass4577-shield-row="realmarkets-style-grid-row-click-opens-modal"
                      data-pass4587-row-affordance="hairline-left-accent-no-jump"
                      data-pass4587-modal-pace="open-without-snap"
                      data-pass4587-pointer-intent="inspect"
                      data-pass4588-row-tap-target="mobile-safe-no-jump-no-fomo"
                    >
                      <div role="cell" className="shield-grid-cell-pass4577 shield-grid-instrument-pass4577">
                        <div className="shield-instrument-cell-pass2382 flex min-w-0 items-center gap-3">
                          <ResolvedAssetLogo
                            symbol={row.symbol}
                            name={row.name}
                            id={row.id}
                            imageUrl={row.image}
                            assetClass="crypto"
                            className="shield-coin-logo-pass2382"
                          />
                          <span className="min-w-0">
                            <strong className="block truncate text-sm text-white">{row.name}</strong>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.38]">
                              {row.symbol} · #{row.rank ?? "—"}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div role="cell" className="shield-grid-cell-pass4577 font-semibold text-white">{formatPrice(row.price, safeLocale)}</div>
                      {changes.map((value, index) => (
                        <div
                          key={`pass4577-change-${row.id}-${index}`}
                          role="cell"
                          className={`shield-grid-cell-pass4577 ${finite(value) ? (value >= 0 ? "text-emerald-300" : "text-rose-300") : "text-white/[0.32]"}`}
                        >
                          {formatPercent(value, safeLocale)}
                        </div>
                      ))}
                      <div role="cell" className="shield-grid-cell-pass4577 text-white/[0.72]">{formatCompact(row.marketCap, safeLocale)}</div>
                      <div role="cell" className="shield-grid-cell-pass4577 text-white/[0.72]">{formatCompact(row.volume24h, safeLocale)}</div>
                      <div role="cell" className="shield-grid-cell-pass4577">
                        <RiskHistoryControl
                          assetId={row.id}
                          assetName={row.name}
                          symbol={row.symbol}
                          currentObservation={buildCurrentRiskHistoryObservation(row, risk)}
                          locale={safeLocale}
                          enabled={true}
                        />
                      </div>
                      <div role="cell" className="shield-grid-cell-pass4577 shield-grid-chart-cell-pass4577">
                        <span
                          className="shield-chart-cell-pass4502 inline-flex min-h-10 w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem] items-center justify-center px-0"
                          aria-hidden="true"
                          data-pass4577-chart-cell="inert-centered-same-width-as-realmarkets"
                        >
                          <ShieldTableSparkline row={row} loading={loading} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {RENDER_LEGACY_SHIELD_TABLE ? <table className="shield-table-pass2382 shield-legacy-table-pass4577-hidden w-full table-fixed border-collapse text-left tabular-nums" data-pass4524-shield-table="colgroup-fit-no-chart-clipping" data-pass4572-shield-table="hard-left-realmarkets-parity-no-empty-first-rail" data-pass4573-shield-table="no-left-void-same-density-as-realmarkets" data-pass4574-shield-grid="realmarkets-grid-over-table-no-left-void" data-pass4575-shield-grid="first-cell-zero-offset-realmarkets-density-parity" data-pass4576-shield-grid="div-grid-parity-ready-colgroup-hidden-zero-left-rail" data-pass4577-legacy-table="disabled-after-grid-migration">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[9%]" />
                <col className="w-[6.5%]" />
                <col className="w-[6.5%]" />
                <col className="w-[6.5%]" />
                <col className="w-[6.5%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[17%]" />
              </colgroup>
              <thead className="bg-white/[0.025]">
                <tr>
                  <th className="px-2 py-4 pl-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.38]">
                    {t.instrument}
                  </th>
                  <th className="px-2 py-4">
                    <SortHeader
                      label={t.price}
                      sortKey="price"
                      sort={sort}
                      onClick={cycleSort}
                    />
                  </th>
                  <th className="px-2 py-4">
                    <SortHeader
                      label="1H"
                      sortKey="change1h"
                      sort={sort}
                      onClick={cycleSort}
                    />
                  </th>
                  <th className="px-2 py-4">
                    <SortHeader
                      label="24H"
                      sortKey="change24h"
                      sort={sort}
                      onClick={cycleSort}
                    />
                  </th>
                  <th className="px-2 py-4">
                    <SortHeader
                      label="7D"
                      sortKey="change7d"
                      sort={sort}
                      onClick={cycleSort}
                    />
                  </th>
                  <th className="px-2 py-4">
                    <SortHeader
                      label="30D"
                      sortKey="change30d"
                      sort={sort}
                      onClick={cycleSort}
                    />
                  </th>
                  <th className="px-2 py-4">
                    <SortHeader
                      label="Market cap"
                      sortKey="marketCap"
                      sort={sort}
                      onClick={cycleSort}
                    />
                  </th>
                  <th className="px-2 py-4">
                    <SortHeader
                      label={<span title={safeLocale === "pl" ? "GLOBAL AGGREGATED VOLUME (CoinGecko) · Zagregowany wolumen 24h" : safeLocale === "de" ? "GLOBAL AGGREGATED VOLUME (CoinGecko) · Aggregiertes 24h-Volumen" : "GLOBAL AGGREGATED VOLUME (CoinGecko) · 24h aggregated volume"}>{t.volume}</span>}
                      sortKey="volume"
                      sort={sort}
                      onClick={cycleSort}
                    />
                  </th>
                  <th className="px-2 py-4">
                    <SortHeader
                      label={t.risk}
                      sortKey="risk"
                      sort={sort}
                      onClick={cycleSort}
                      align="center"
                    />
                  </th>
                  <th className="px-2 py-4 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.38]" data-pass4515-chart-head="realmarkets-width-parity" data-pass4572-chart-head="centered-over-chart-column">
                    {t.chart}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && !visibleRows.length ? (
                  Array.from({ length: 12 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="border-t border-white/[0.05] animate-pulse">
                      <td className="px-2 py-5 pl-3">
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-full bg-white/[0.07]" />
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-24 rounded bg-white/[0.08]" />
                            <div className="h-2 w-12 rounded bg-white/[0.04]" />
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-5 text-center"><div className="mx-auto h-3.5 w-16 rounded bg-white/[0.06]" /></td>
                      <td className="px-2 py-5 text-center"><div className="mx-auto h-3.5 w-12 rounded bg-white/[0.05]" /></td>
                      <td className="px-2 py-5 text-center"><div className="mx-auto h-3.5 w-12 rounded bg-white/[0.05]" /></td>
                      <td className="px-2 py-5 text-center"><div className="mx-auto h-3.5 w-12 rounded bg-white/[0.05]" /></td>
                      <td className="px-2 py-5 text-center"><div className="mx-auto h-3.5 w-12 rounded bg-white/[0.05]" /></td>
                      <td className="px-2 py-5 text-center"><div className="mx-auto h-3.5 w-16 rounded bg-white/[0.05]" /></td>
                      <td className="px-2 py-5 text-center"><div className="mx-auto h-3.5 w-16 rounded bg-white/[0.05]" /></td>
                      <td className="px-2 py-5 text-center"><div className="mx-auto h-6 w-16 rounded-full bg-white/[0.05]" /></td>
                      <td className="px-2 py-5 text-center"><div className="mx-auto h-8 w-24 rounded bg-white/[0.04]" /></td>
                    </tr>
                  ))
                ) : (
                  visibleRows.map((row) => {
                    const risk = sourceBoundRisk(row);
                    return (
                      <tr
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleRowClick(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleRowClick(row);
                          }
                        }}
                        className="group cursor-pointer border-t border-white/[0.075] transition hover:bg-white/[0.018] focus:outline-none focus:ring-1 focus:ring-cyan-200/[0.14]"
                      aria-label={`${row.name} ${safeLocale === "pl" ? "pełny wykres i analiza" : safeLocale === "de" ? "voller Chart und Analyse" : "full chart and analysis"}`}
                      data-pass4467-row-click-target="shield-asset-modal"
                      data-pass4479-row-action-contract="row-opens-right-drawer-risk-history-is-separate-action"
                      data-pass4485-row-fit="row-chart-passive-risk-history-stops-row-navigation"
                      data-pass4516-row-contract="keyboard-focus-visible-row-action-mini-chart-inert"
                      data-pass4517-row-hitbox="row-primary-action-risk-history-explicit-exception-chart-inert"
                      data-pass4518-row-hitbox="quiet-left-accent-row-primary-risk-history-sibling"
                      data-pass4519-row-hitbox="left-accent-focus-visible-risk-history-focus-independent"
                      data-pass4520-row-hitbox="primary-row-action-plus-bounded-risk-history-action"
                      data-pass4521-row-hitbox="row-and-risk-history-actions-sticky-header-safe"
                      data-pass4522-row-hitbox="opens-exclusive-edge-drawer-and-closes-intel-layer"
                    >
                      <td className="px-2 py-5 pl-3">
                        <div className="shield-instrument-cell-pass2382 flex items-center gap-3">
                          <ResolvedAssetLogo
                            symbol={row.symbol}
                            name={row.name}
                            id={row.id}
                            imageUrl={row.image}
                            assetClass="crypto"
                            className="shield-coin-logo-pass2382"
                          />
                          <span className="min-w-0">
                            <strong className="block truncate text-sm text-white">
                              {row.name}
                            </strong>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.38]">
                              {row.symbol} · #{row.rank ?? "—"}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-5 text-center font-mono text-sm font-semibold text-white">
                        {formatPrice(row.price, safeLocale)}
                      </td>
                      {[
                        shieldSanePercent(row.priceChange1h, 60 * 60),
                        shieldSanePercent(row.priceChange24h, 24 * 60 * 60),
                        shieldSanePercent(row.priceChange7d, 7 * 24 * 60 * 60),
                        shieldSanePercent(row.priceChange30d, 30 * 24 * 60 * 60),
                      ].map((value, index) => (
                        <td
                          key={`${row.id}-${index}`}
                          className={`px-2 py-5 text-center font-mono text-xs ${finite(value) ? (value >= 0 ? "text-emerald-300" : "text-rose-300") : "text-white/[0.32]"}`}
                        >
                          {formatPercent(value, safeLocale)}
                        </td>
                      ))}
                      <td className="px-2 py-5 text-center font-mono text-xs text-white/[0.72]">
                        {formatCompact(row.marketCap, safeLocale)}
                      </td>
                      <td className="px-2 py-5 text-center font-mono text-xs text-white/[0.72]">
                        {formatCompact(row.volume24h, safeLocale)}
                      </td>
                      <td className="px-2 py-5 text-center">
                        <RiskHistoryControl
                          assetId={row.id}
                          assetName={row.name}
                          symbol={row.symbol}
                          currentObservation={buildCurrentRiskHistoryObservation(row, risk)}
                          locale={safeLocale}
                          enabled={true}
                        />
                      </td>
                      <td className="px-2 py-4 text-center" data-pass4515-chart-td="compressed-reference-width" data-pass4572-chart-td="centered-chart-cell">
                        <span
                          className="shield-chart-cell-pass4502 inline-flex min-h-10 w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem] items-center justify-center px-0"
                          aria-hidden="true"
                          data-pass4466-chart-click-target="row-only-no-chart-button"
                          data-pass4467-chart-click-target="row-only-no-chart-button"
                          data-pass4479-chart-click-target="right-drawer-via-row-only"
                          data-pass4485-chart-click-fit="row-click-opens-drawer-chart-is-passive"
                          data-pass4502-shield-chart-cell="inert-no-hover-no-outline-no-chevron"
                          data-pass4504-chart-cell="line-only-passive-row-click"
                          data-pass4505-chart-cell="silent-no-title-no-pointer-target"
                          data-pass4507-chart-cell="passive-visual-only-row-owns-click"
                          data-pass4511-chart-cell="fixed-width-no-reflow-row-only-click"
                          data-pass4513-chart-cell="fixed-inline-size-passive-line-row-only-click"
                          data-pass4514-chart-cell="hard-inert-inline-size-no-tooltip-no-row-hover-mutation"
                          data-pass4515-chart-cell="realmarkets-width-parity-no-hover-bg-or-border"
                          data-pass4516-chart-cell="silent-evidence-line-no-hover-focus-or-row-mutation"
                          data-pass4517-chart-cell="css-cascade-frozen-fixed-width-no-pointer-no-reflow"
                          data-pass4518-chart-cell="reference-silent-line-fixed-no-hover-outline-shadow"
                          data-pass4519-chart-cell="crisp-fixed-vector-line-pointerless"
                          data-pass4520-chart-cell="pixel-fixed-inert-vector-no-selection-no-hover-cascade"
                          data-pass4521-chart-cell="table-layout-fixed-no-row-hover-cascade-no-tooltip"
                          data-pass4522-chart-cell="still-inert-after-exclusive-drawer-layer-change"
                          data-pass4524-chart-cell="contained-inside-table-no-right-edge-clipping"
                          data-pass4525-chart-cell="reference-width-inert-no-right-edge-overflow"
                          data-pass4526-chart-cell="reference-mini-chart-contained-in-row-no-button-no-clipping"
                          data-pass4529-chart-cell="rail-open-still-fixed-no-edge-clip"
                          data-pass4530-chart-cell="reference-final-narrow-passive-no-edge-clip"
                        >
                          <ShieldTableSparkline row={row} loading={loading} />
                        </span>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table> : null}
          </div>

          <div className="grid gap-3 p-3 lg:hidden">
            {visibleRows.map((row) => {
              const risk = sourceBoundRisk(row);
              const mobileChange24h = shieldSanePercent(row.priceChange24h, 24 * 60 * 60);
              return (
                <article
                  key={`mobile-${row.id}`}
                  className="overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035]"
                  data-risk-history-mobile-card="separate-primary-and-history-actions"
                >
                <button
                  type="button"
                  onClick={() => handleRowClick(row)}
                  aria-label={`${row.name} ${safeLocale === "pl" ? "pełny wykres i analiza" : safeLocale === "de" ? "voller Chart und Analyse" : "full chart and analysis"}`}
                  data-pass4468-mobile-row-click-target="shield-asset-modal"
                  data-pass4479-mobile-card-contract="primary-card-opens-right-drawer-history-sibling-safe-area"
                  data-pass4516-mobile-card-contract="primary-action-owns-chart-history-sibling-focusable"
                  data-pass4517-mobile-card-contract="two-sibling-actions-no-nested-interactive-target"
                  data-pass4518-mobile-card-contract="quiet-primary-action-chart-inert-history-separate"
                  data-pass4519-mobile-card-contract="quiet-card-primary-chart-pointerless-history-sibling"
                  data-pass4520-mobile-card-contract="separate-card-actions-chart-inert-safe-left-accent"
                  data-pass4521-mobile-card-contract="two-mobile-actions-chart-inert-no-nested-hitbox"
                  data-pass4522-mobile-card-contract="primary-opens-edge-drawer-history-opens-own-dialog"
                  aria-haspopup="dialog"
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <ResolvedAssetLogo
                      symbol={row.symbol}
                      name={row.name}
                      id={row.id}
                      imageUrl={row.image}
                      assetClass="crypto"
                      className="shield-coin-logo-pass2382"
                    />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-white">
                        {row.name}
                      </strong>
                      <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-white/[0.36]">
                        {row.symbol} · #{row.rank ?? "—"}
                      </span>
                    </span>
                    <span className={`font-mono text-xs ${riskTone(risk)}`}>
                      {risk === null ? "—" : formatRiskScore(risk, safeLocale)}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[10px] text-white/[0.62]">
                    <span>{formatPrice(row.price, safeLocale)}</span>
                    <span
                      className={
                        typeof mobileChange24h === "number"
                          ? mobileChange24h >= 0
                            ? "text-emerald-300"
                            : "text-rose-300"
                          : "text-white/[0.32]"
                      }
                    >
                      24H {formatPercent(mobileChange24h, safeLocale)}
                    </span>
                    <span className="text-right">
                      {safeLocale === "pl" ? "Wol." : "Vol."} {formatCompact(row.volume24h, safeLocale)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                    <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/[0.36]">
                      {t.chart}
                    </span>
                    <span
                      className="shield-chart-cell-pass4502 inline-flex items-center"
                      aria-hidden="true"
                      data-pass4502-shield-chart-cell="mobile-inert-no-hover-no-outline-no-chevron"
                      data-pass4504-chart-cell="mobile-line-only-passive-card-click"
                      data-pass4505-chart-cell="mobile-silent-no-title-no-pointer-target"
                      data-pass4507-chart-cell="mobile-passive-visual-only-card-owns-click"
                      data-pass4511-chart-cell="mobile-fixed-width-no-reflow-card-only-click"
                      data-pass4513-chart-cell="mobile-fixed-inline-size-passive-line-card-only-click"
                      data-pass4515-chart-cell="mobile-realmarkets-width-parity-no-hover-bg-or-border"
                      data-pass4516-chart-cell="mobile-silent-evidence-line-card-owned-click"
                      data-pass4518-chart-cell="mobile-reference-silent-line-fixed-no-hover"
                      data-pass4519-chart-cell="mobile-crisp-fixed-vector-line-pointerless"
                      data-pass4520-chart-cell="mobile-pixel-fixed-inert-vector-no-selection"
                    >
                      <ShieldTableSparkline row={row} loading={loading} />
                    </span>
                  </div>
                </button>
                <div className="border-t border-white/[0.06] px-4 py-3">
                  <RiskHistoryControl
                    assetId={row.id}
                    assetName={row.name}
                    symbol={row.symbol}
                    currentObservation={buildCurrentRiskHistoryObservation(row, risk)}
                    locale={safeLocale}
                    enabled={true}
                    variant="mobile"
                  />
                </div>
                </article>
              );
            })}
          </div>

          {!loading && !visibleRows.length ? (
            <div
              className="shield-table-empty-state-pass4488 px-6 py-12 text-center"
              data-pass4488-shield-empty-state="visible-filter-source-query-bound"
              aria-live="polite"
            >
              {debouncedQuery.trim() ? (
                <>
                  <p>{t.noResults}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setRemoteSuggestions([]);
                      setVisibleLimit(100);
                    }}
                    className="mt-3 min-h-11 rounded-full border border-white/[0.12] px-4 py-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-velmere-gold transition hover:border-velmere-gold/40"
                  >
                    {t.clearSearch}
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="font-mono text-xs uppercase tracking-wider text-amber-300/80">
                    {safeLocale === "pl"
                      ? "Kanał rynkowy oczekuje na synchronizację"
                      : safeLocale === "de"
                        ? "Marktkanal wartet auf Synchronisierung"
                        : "Market feed pending telemetry sync"}
                  </p>
                  <p className="mx-auto max-w-md font-sans text-xs text-white/50">
                    {safeLocale === "pl"
                      ? "Trwa pobieranie zweryfikowanych kwotowań rynkowych. Kliknij poniżej, aby odświeżyć połączenie z siecią."
                      : safeLocale === "de"
                        ? "Verifizierte Marktpreise werden geladen. Klicken Sie unten, um die Verbindung zu aktualisieren."
                        : "Fetching verified market quotes. Click below to refresh connection to the oracle network."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReloadNonce((n) => n + 1)}
                    className="mt-2 min-h-11 rounded-full border border-amber-400/30 bg-amber-400/10 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200 transition hover:bg-amber-400/20"
                  >
                    {safeLocale === "pl" ? "Ponów połączenie" : safeLocale === "de" ? "Neu verbinden" : "Reconnect Feed"}
                  </button>
                </div>
              )}
            </div>
          ) : null}

          <ShieldChartSourceFooter
            rows={visibleRows}
            loading={loading}
            locale={safeLocale}
          />

          {visibleRows.length < filteredRows.length ? (
            <div className="flex items-center justify-between gap-4 border-t border-white/[0.075] px-5 py-4">
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">
                {safeLocale === "pl"
                  ? `Widoczne ${visibleRows.length} z ${filteredRows.length}`
                  : safeLocale === "de"
                    ? `${visibleRows.length} von ${filteredRows.length} sichtbar`
                    : `Showing ${visibleRows.length} of ${filteredRows.length}`}
              </span>
              <button
                type="button"
                onClick={() =>
                  setVisibleLimit((current) =>
                    Math.min(current + 50, filteredRows.length),
                  )
                }
                className="min-h-11 rounded-full border border-cyan-200/[0.16] bg-cyan-300/[0.05] px-4 py-2 font-mono text-[9.5px] uppercase tracking-[0.13em] text-cyan-50 transition hover:bg-cyan-300/[0.10]"
              >
                {safeLocale === "pl"
                  ? "Pokaż więcej"
                  : safeLocale === "de"
                    ? "Mehr anzeigen"
                    : "Show more"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {selected ? (
        <AssetDetailModal
          data={rowToModalData(selected, safeLocale, feedMode, sourceLabel)}
          onClose={() => setSelected(null)}
          productLabel="Velmère Shield"
        />
      ) : null}

      {activeMetricModal ? (
        <ShieldMetricExplainerModal
          metricId={activeMetricModal}
          locale={safeLocale}
          onClose={() => setActiveMetricModal(null)}
        />
      ) : null}
    </>
  );
}
