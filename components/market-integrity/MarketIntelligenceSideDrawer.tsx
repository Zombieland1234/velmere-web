"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import ResolvedAssetLogo from "@/components/market-integrity/AssetLogo";

const subscribeToClientAvailability = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export type MarketIntelligenceDrawerTone =
  "positive" | "negative" | "risk" | "evidence" | "neutral";

export type MarketIntelligenceDrawerAssetClass =
  | "crypto"
  | "stock"
  | "etf"
  | "fx"
  | "commodity"
  | "index"
  | "real_estate"
  | "exchange";

export type MarketIntelligenceDrawerItem = {
  id: string;
  symbol: string;
  name: string;
  family?: string;
  assetClass?: MarketIntelligenceDrawerAssetClass;
  imageUrl?: string;
  providerSymbol?: string;
  venue?: string;
  changeLabel: string;
  changeValue?: number | null;
  riskLabel: string;
  riskValue?: number | null;
  evidenceLabel?: string;
  description?: string;
  sparkline?: number[];
  tone?: MarketIntelligenceDrawerTone;
};

export type MarketIntelligenceDrawerSummary = {
  label: string;
  value: string;
  caption: string;
};

type Locale = "pl" | "en" | "de";
type DrawerTab = "movers" | "risk" | "evidence";

type DrawerCopy = {
  title: string;
  empty: string;
  drawerLabel: string;
  subtitle: Record<"shield" | "real-markets", string>;
  tabs: Record<DrawerTab, string>;
  gainers: string;
  losers: string;
  risk: string;
  evidence: string;
  viewAll: string;
  updated: string;
  manage: string;
  open: string;
  close: string;
  instrumentColumn: string;
  riskColumn: string;
  changeColumn: string;
  evidenceColumn: string;
  trendColumn: string;
  marketMoves: string;
  timeframe24: string;
  watchlist: string;
  highRisk: string;
  sources: string;
  activeAlerts: string;
  riskQueue: string;
  sourceLanes: string;
  signalLabels: Record<MarketIntelligenceDrawerTone, string>;
};

const copy: Record<Locale, DrawerCopy> = {
  pl: {
    title: "Inteligencja rynku",
    empty: "Brak aktywnych wierszy analityki.",
    drawerLabel: "Boczny panel inteligencji rynku Velmère",
    subtitle: {
      shield: "Pompy, dumpy, ryzyko i braki dowodów dla Shield.",
      "real-markets": "Ruchy, ryzyko i dowody dla rynków cross-asset.",
    },
    tabs: { movers: "Ruchy", risk: "Ryzyko", evidence: "Dowody" },
    gainers: "Najmocniejsze wzrosty (24H)",
    losers: "Najmocniejsze spadki (24H)",
    risk: "Kolejka wysokiego ryzyka",
    evidence: "Ostrzeżenia dowodowe",
    viewAll: "Pokaż",
    updated: "Zaktualizowano teraz",
    manage: "Alerty",
    open: "Otwórz panel intelligence",
    close: "Zamknij panel intelligence",
    instrumentColumn: "Instrument",
    riskColumn: "Ryzyko",
    changeColumn: "Zmiana",
    evidenceColumn: "Dowód",
    trendColumn: "Trend",
    marketMoves: "Ruchy rynku",
    timeframe24: "24H",
    watchlist: "Obserwowane",
    highRisk: "Wysokie ryzyko",
    sources: "Źródła",
    activeAlerts: "aktywne alerty",
    riskQueue: "z kolejki ryzyka",
    sourceLanes: "ścieżki źródeł",
    signalLabels: {
      positive: "Wzrost",
      negative: "Spadek",
      risk: "Ryzyko",
      evidence: "Dowód",
      neutral: "Sygnał",
    },
  },
  en: {
    title: "Market intelligence",
    empty: "No live intelligence rows yet.",
    drawerLabel: "Velmère market intelligence side drawer",
    subtitle: {
      shield: "Pumps, dumps, risk and evidence gaps for Shield.",
      "real-markets": "Movers, risk and evidence for cross-asset markets.",
    },
    tabs: { movers: "Movers", risk: "Risk", evidence: "Evidence" },
    gainers: "Top gainers (24H)",
    losers: "Top losers (24H)",
    risk: "High risk queue",
    evidence: "Evidence warnings",
    viewAll: "View all",
    updated: "Updated just now",
    manage: "Manage alerts",
    open: "Open intelligence drawer",
    close: "Close intelligence drawer",
    instrumentColumn: "Instrument",
    riskColumn: "Risk",
    changeColumn: "Change",
    evidenceColumn: "Evidence",
    trendColumn: "Trend",
    marketMoves: "Market moves",
    timeframe24: "24H",
    watchlist: "Watchlist",
    highRisk: "High risk",
    sources: "Sources",
    activeAlerts: "active alerts",
    riskQueue: "risk queue",
    sourceLanes: "source lanes",
    signalLabels: {
      positive: "Gain",
      negative: "Drop",
      risk: "Risk",
      evidence: "Proof",
      neutral: "Signal",
    },
  },
  de: {
    title: "Marktintelligenz",
    empty: "Noch keine Live-Intelligence-Zeilen.",
    drawerLabel: "Velmère Marktintelligenz-Seitenpanel",
    subtitle: {
      shield: "Pumps, Dumps, Risiko und Evidenzlücken für Shield.",
      "real-markets": "Bewegungen, Risiko und Evidenz für Cross-Asset-Märkte.",
    },
    tabs: { movers: "Bewegungen", risk: "Risiko", evidence: "Evidenz" },
    gainers: "Stärkste Gewinner (24H)",
    losers: "Stärkste Verlierer (24H)",
    risk: "Hohe-Risiko-Warteschlange",
    evidence: "Evidenz-Warnungen",
    viewAll: "Alle anzeigen",
    updated: "Gerade aktualisiert",
    manage: "Alerts verwalten",
    open: "Intelligence-Panel öffnen",
    close: "Intelligence-Panel schließen",
    instrumentColumn: "Instrument",
    riskColumn: "Risiko",
    changeColumn: "Änderung",
    evidenceColumn: "Evidenz",
    trendColumn: "Trend",
    marketMoves: "Marktbewegungen",
    timeframe24: "24H",
    watchlist: "Watchlist",
    highRisk: "Hohes Risiko",
    sources: "Quellen",
    activeAlerts: "aktive Alerts",
    riskQueue: "Risiko-Warteschlange",
    sourceLanes: "Quellenpfade",
    signalLabels: {
      positive: "Gewinn",
      negative: "Rückgang",
      risk: "Risiko",
      evidence: "Nachweis",
      neutral: "Signal",
    },
  },
};

function safeLocale(locale: string): Locale {
  return locale === "en" || locale === "de" ? locale : "pl";
}

function toneClass(tone: MarketIntelligenceDrawerTone | undefined) {
  if (tone === "positive") return "text-emerald-300";
  if (tone === "negative") return "text-rose-300";
  if (tone === "risk") return "text-velmere-gold";
  if (tone === "evidence") return "text-cyan-200";
  return "text-white/[0.68]";
}

function dotClass(value?: number | null, tone?: MarketIntelligenceDrawerTone) {
  if (tone === "negative") return "bg-rose-300";
  if (tone === "positive") return "bg-emerald-300";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 70) return "bg-rose-300";
    if (value >= 42) return "bg-velmere-gold";
    return "bg-emerald-300";
  }
  if (tone === "evidence") return "bg-cyan-300";
  return "bg-white/[0.32]";
}

function signalLabelFor(
  tone: MarketIntelligenceDrawerTone | undefined,
  t: DrawerCopy,
) {
  return t.signalLabels[tone ?? "neutral"] ?? t.signalLabels.neutral;
}

function compactName(name: string) {
  return name.length > 21 ? `${name.slice(0, 18)}…` : name;
}

function normalizeSparklineValues(values: number[] | undefined) {
  return (values ?? [])
    .filter((value) => Number.isFinite(value))
    .slice(-24);
}

function sparklinePointData(values: number[] | undefined) {
  const clean = normalizeSparklineValues(values);
  if (clean.length < 2) {
    return {
      path: "M0 11 L42 11",
      end: { x: 42, y: 11 },
    };
  }
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = Math.max(0.000001, max - min);
  const points = clean.map((value, index) => {
    const x = (index / Math.max(1, clean.length - 1)) * 42;
    const y = 20 - ((value - min) / span) * 18 + 1;
    return { x, y };
  });
  return {
    path: points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" "),
    end: points[points.length - 1] ?? { x: 42, y: 11 },
  };
}

function MiniDrawerSparkline({ item }: { item: MarketIntelligenceDrawerItem }) {
  const { path, end } = sparklinePointData(item.sparkline);
  return (
    <svg
      className={`h-5 w-11 overflow-visible ${toneClass(item.tone)}`}
      viewBox="0 0 42 22"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-pass4472-intel-drawer-sparkline="arrow-endcap"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        opacity="0.92"
      />
      <path
        d={`M${Math.max(0, end.x - 4.5).toFixed(2)} ${(end.y - 2.7).toFixed(2)} L${end.x.toFixed(2)} ${end.y.toFixed(2)} L${Math.max(0, end.x - 4.5).toFixed(2)} ${(end.y + 2.7).toFixed(2)}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.25"
        opacity="0.84"
      />
    </svg>
  );
}

function drawerAssetClass(
  item: MarketIntelligenceDrawerItem,
): MarketIntelligenceDrawerAssetClass {
  return (
    item.assetClass ??
    (item.family?.toLowerCase().includes("crypto") ? "crypto" : "stock")
  );
}

function SectionList({
  title,
  icon,
  items,
  metricLabel,
  t,
  onSelectItem,
}: {
  title: string;
  icon: "up" | "down" | "risk" | "evidence";
  items: MarketIntelligenceDrawerItem[];
  metricLabel: string;
  t: DrawerCopy;
  onSelectItem?: (item: MarketIntelligenceDrawerItem) => void;
}) {
  const Icon =
    icon === "up"
      ? TrendingUp
      : icon === "down"
        ? TrendingDown
        : icon === "risk"
          ? ShieldAlert
          : Eye;
  return (
    <section
      className="rounded-[1.25rem] border border-white/[0.075] bg-white/[0.022] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
      data-pass4465-drawer-section={icon}
      data-pass4470-drawer-section-polish="signal-chip-clickable-logos-sparklines"
      data-pass4529-intel-section="reference-rail-compact-section-container-fit"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-white/[0.86]">
          <Icon
            className={`h-3.5 w-3.5 ${icon === "down" ? "text-rose-300" : icon === "risk" ? "text-velmere-gold" : "text-emerald-300"}`}
          />
          {title}
        </h3>
        <button
          type="button"
          className="rounded-full border border-white/[0.08] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.56] transition hover:border-cyan-200/[0.22] hover:text-white"
        >
          {t.viewAll}
        </button>
      </div>
      <div className="grid grid-cols-[1.15rem_minmax(0,1fr)_4.45rem_3.1rem_3.15rem] gap-2 border-b border-white/[0.07] pb-2 font-mono text-[7px] uppercase tracking-[0.13em] text-white/[0.30]">
        <span>#</span>
        <span>{t.instrumentColumn}</span>
        <span className="text-right">{metricLabel}</span>
        <span className="text-right">{t.riskColumn}</span>
        <span className="text-right">{t.trendColumn}</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {!items.length ? (
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-4 text-xs text-white/[0.42]">
            {t.empty}
          </p>
        ) : null}
        {items.map((item, index) => (
          <button
            key={`${item.id}-${index}`}
            type="button"
            onClick={() => onSelectItem?.(item)}
            className="group grid w-full grid-cols-[1.15rem_minmax(0,1fr)_4.45rem_3.1rem_3.15rem] items-center gap-2 rounded-xl px-1.5 py-2 text-left transition hover:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-200/[0.28]"
            data-pass4465-drawer-row="icon-chart-description"
            data-pass4470-drawer-click-target="open-asset-modal-from-intelligence-row"
            data-pass4529-intel-row="compact-two-column-row-no-overflow"
            aria-label={`${compactName(item.name)} ${signalLabelFor(item.tone, t)} ${item.changeLabel}`}
          >
            <span className="font-mono text-[10px] text-white/[0.58]">
              {index + 1}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <ResolvedAssetLogo
                symbol={item.symbol}
                name={item.name}
                id={item.id}
                providerSymbol={item.providerSymbol}
                imageUrl={item.imageUrl}
                assetClass={drawerAssetClass(item)}
                venue={item.venue}
                compact
                className="relative grid h-6 w-6 shrink-0 place-items-center overflow-visible rounded-none border-0 bg-transparent shadow-none font-mono text-[8px] font-semibold text-velmere-gold [&>img]:absolute [&>img]:inset-0 [&>img]:z-10 [&>img]:h-full [&>img]:w-full [&>img]:object-contain [&>img]:opacity-0 [&>img.is-loaded]:opacity-100 [&>span]:relative [&>span]:z-0"
              />
              <span className="min-w-0">
                <strong className="block truncate text-xs text-white/[0.90]">
                  {compactName(item.name)}
                </strong>
                <small className="block truncate font-mono text-[7px] uppercase tracking-[0.11em] text-white/[0.34]">
                  {item.symbol}
                  {item.family ? ` · ${item.family}` : ""}
                </small>
                <span
                  className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em] ${item.tone === "negative" ? "border-rose-300/[0.18] bg-rose-300/[0.06] text-rose-200" : item.tone === "risk" ? "border-velmere-gold/[0.20] bg-velmere-gold/[0.06] text-velmere-gold" : item.tone === "evidence" ? "border-cyan-200/[0.18] bg-cyan-300/[0.055] text-cyan-100" : "border-emerald-300/[0.18] bg-emerald-300/[0.055] text-emerald-200"}`}
                  data-pass4470-drawer-signal-chip={item.tone ?? "neutral"}
                >
                  {signalLabelFor(item.tone, t)}
                </span>
                {item.description ? (
                  <small className="mt-0.5 block truncate text-[9px] leading-3 text-white/[0.42]">
                    {item.description}
                  </small>
                ) : null}
              </span>
            </span>
            <span
              className={`text-right font-mono text-[10px] font-semibold ${toneClass(item.tone)}`}
            >
              {item.changeLabel}
            </span>
            <span className="flex items-center justify-end gap-1.5 font-mono text-[10px] text-white/[0.66]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${dotClass(item.riskValue, item.tone)}`}
              />
              {item.riskLabel}
            </span>
            <span className="flex justify-end">
              <MiniDrawerSparkline item={item} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function MarketIntelligenceSideDrawer({
  locale,
  mode,
  gainers,
  losers,
  riskItems,
  evidenceItems,
  summary,
  defaultOpen,
  onSelectItem,
}: {
  locale: string;
  mode: "shield" | "real-markets";
  gainers: MarketIntelligenceDrawerItem[];
  losers: MarketIntelligenceDrawerItem[];
  riskItems: MarketIntelligenceDrawerItem[];
  evidenceItems: MarketIntelligenceDrawerItem[];
  summary: MarketIntelligenceDrawerSummary[];
  defaultOpen?: boolean;
  onSelectItem?: (item: MarketIntelligenceDrawerItem) => void;
}) {
  const safe = safeLocale(locale);
  const t = copy[safe];
  const mounted = useSyncExternalStore(
    subscribeToClientAvailability,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [tab, setTab] = useState<DrawerTab>("movers");
  const currentList = useMemo(
    () => (tab === "risk" ? riskItems : evidenceItems),
    [evidenceItems, riskItems, tab],
  );
  const isMovers = tab === "movers";
  const footerMetrics = useMemo(
    () => [
      { label: t.watchlist, value: "9", caption: t.activeAlerts },
      { label: t.highRisk, value: String(riskItems.length || 0), caption: t.riskQueue },
      { label: t.sources, value: String(Math.max(1, evidenceItems.length ? 1 : 0)), caption: t.sourceLanes },
    ],
    [evidenceItems.length, riskItems.length, t.activeAlerts, t.highRisk, t.riskQueue, t.sourceLanes, t.sources, t.watchlist],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    const closeForExclusiveDrawer = () => setOpen(false);
    window.addEventListener("velmere:close-market-intelligence", closeForExclusiveDrawer);
    return () => window.removeEventListener("velmere:close-market-intelligence", closeForExclusiveDrawer);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (open) {
      root.setAttribute("data-velmere-intelligence-drawer-open", "true");
      root.setAttribute("data-velmere-intelligence-drawer-mode", mode);
    } else if (
      root.getAttribute("data-velmere-intelligence-drawer-mode") === mode
    ) {
      root.setAttribute("data-velmere-intelligence-drawer-open", "false");
    }
    return () => {
      if (root.getAttribute("data-velmere-intelligence-drawer-mode") === mode) {
        root.removeAttribute("data-velmere-intelligence-drawer-open");
        root.removeAttribute("data-velmere-intelligence-drawer-mode");
      }
    };
  }, [mode, mounted, open]);

  const edgeHandle = !open ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="velmere-intel-edge-handle-pass4469 velmere-intel-edge-handle-pass4470 velmere-intel-edge-handle-pass4531 fixed right-0 top-1/2 z-[190] flex h-28 w-11 -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-l-[1.1rem] border border-r-0 border-white/[0.16] bg-[#111315]/[0.98] text-white/[0.78] shadow-[0_22px_70px_rgba(0,0,0,0.52)] ring-1 ring-cyan-200/[0.06] transition duration-300 hover:w-12 hover:border-cyan-200/[0.30] hover:bg-[#141719] hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/[0.38] motion-reduce:transition-none"
      aria-label={t.open}
      aria-expanded="false"
      data-pass4469-edge-handle-visible="closed-external-fixed-right-edge"
      data-pass4470-edge-handle-label="visible-intel-trigger"
      data-pass4469-edge-handle-mode={mode}
      data-pass4522-intel-edge-handle="hidden-and-state-closed-when-asset-drawer-owns-edge"
      data-pass4525-intel-edge-handle="does-not-cover-table-chart-column"
      data-pass4526-intel-edge-handle="reference-rail-closed-handle-never-steals-table-column"
      data-pass4529-intel-edge-handle="flush-reference-trigger-outside-table-hitbox"
      data-pass4530-intel-edge-handle="closed-tab-sits-outside-table-hitbox-reference"
      data-pass4531-intel-edge-handle="right-edge-tab-target-reference-opens-market-rail"
    >
      <Sparkles className="h-3.5 w-3.5 text-velmere-gold" aria-hidden="true" />
      <span className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/[0.62] [writing-mode:vertical-rl]">
        Market
      </span>
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">{t.open}</span>
    </button>
  ) : null;

  const clickAway = open ? (
    <button
      type="button"
      aria-label={t.close}
      className="velmere-intel-clickaway-pass4526 fixed inset-0 z-[170] cursor-default bg-transparent"
      onClick={() => setOpen(false)}
      data-pass4471-intel-drawer-click-away="close-on-outside-click"
      data-pass4522-intel-clickaway="closed-by-asset-drawer-exclusive-owner-event"
      data-pass4526-intel-clickaway="transparent-close-layer-below-docked-rail"
      data-pass4527-intel-clickaway="transparent-reference-hit-area-does-not-darken-table"
      data-pass4529-intel-clickaway="width-synced-to-current-reference-rail"
      data-pass4530-intel-clickaway="transparent-left-field-no-dark-overlay-no-table-shift"
      tabIndex={-1}
    />
  ) : null;

  const drawer = (
    <aside
      className={`velmere-intel-drawer-pass4466 velmere-intel-drawer-pass4467 velmere-intel-drawer-pass4470 fixed bottom-3 right-0 top-[5.6rem] z-[180] w-[min(25.5rem,calc(100vw-3.25rem))] transform-gpu transition-[transform,opacity,filter] duration-[820ms] ease-[cubic-bezier(.22,1,.36,1)] will-change-transform motion-reduce:duration-0 ${open ? "translate-x-0 opacity-100 blur-0" : "translate-x-[calc(100%+0.125rem)] opacity-100"}`}
      data-pass4464-intelligence-drawer={mode}
      data-pass4465-wallet-like-slide="right-edge-transform-drawer"
      data-pass4466-drawer-portal="body-fixed-right-edge-default-closed"
      data-pass4466-closed-compat-marker="translate-x-full"
      data-pass4467-clean-side-drawer="right-edge-minimal-esc-no-xp-scrollbar"
      data-pass4469-hidden-panel-handle="external-edge-handle-visible-when-closed"
      data-pass4464-drawer-state={open ? "open" : "closed"}
      data-pass4469-drawer-state={open ? "open" : "closed"}
      data-pass4470-drawer-polish="row-clicks-signal-chips-edge-label"
      data-pass4522-intel-drawer="listens-for-exclusive-asset-drawer-close-event"
      data-pass4525-intel-drawer="reference-split-edge-panel-main-content-reserves-width"
      data-pass4526-intel-drawer="docked-reference-rail-no-table-overlay-no-angel-collision"
      data-pass4527-intel-drawer="reference-top-kpi-stack-movers-below-clean-close"
      data-pass4528-intel-drawer="reference-two-column-movers-bottom-stats-rail"
      data-pass4529-intel-drawer="rail-width-synced-container-query-table-reserve"
      data-pass4530-intel-drawer="reference-docked-rail-fixed-width-table-has-safe-scroll"
      aria-label={t.drawerLabel}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="absolute left-[-2.25rem] top-[42%] z-10 grid h-20 w-9 -translate-y-1/2 place-items-center rounded-l-2xl border border-r-0 border-white/[0.10] bg-[#111315]/[0.96] text-white/[0.72] shadow-[0_18px_60px_rgba(0,0,0,0.45)] transition duration-300 hover:border-cyan-200/[0.22] hover:text-cyan-100"
        aria-label={open ? t.close : t.open}
        aria-expanded={open}
      >
        {open ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
      <div className="h-full overflow-hidden rounded-l-[1.55rem] border border-r-0 border-white/[0.10] bg-[#0b0c0d]/[0.985] shadow-[0_30px_110px_rgba(0,0,0,0.62)] ring-1 ring-cyan-200/[0.035] backdrop-blur-xl">
        <div className="flex h-full flex-col p-3.5">
          <div className="border-b border-white/[0.08] pb-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-velmere-gold/[0.78]">
                  <Sparkles className="h-3.5 w-3.5" /> {t.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-white/[0.46]">
                  {t.subtitle[mode]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.08] text-white/[0.52] transition hover:border-velmere-gold/[0.28] hover:text-white"
                aria-label={t.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {(Object.keys(t.tabs) as DrawerTab[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={`rounded-full px-3 py-2 font-mono text-[9px] uppercase tracking-[0.13em] transition ${tab === item ? "border border-white/[0.12] bg-white/[0.055] text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.24)]" : "text-white/[0.48] hover:bg-white/[0.035] hover:text-white/[0.76]"}`}
                >
                  {t.tabs[item]}
                </button>
              ))}
            </div>
          </div>

          <div
            className="velmere-intel-summary-pass4527 velmere-intel-summary-pass4528 mt-3 rounded-[1.05rem] border border-white/[0.075] bg-white/[0.024] p-3"
            data-pass4527-intel-summary="reference-top-kpis-four-cells-before-market-movers"
            data-pass4528-intel-summary="reference-four-cell-kpis-no-duplication"
            data-pass4529-intel-summary="four-kpi-cells-fixed-height-no-wrap"
            data-pass4530-intel-summary="compact-kpi-strip-reference-no-wrap"
          >
            <div className="grid grid-cols-2 divide-x-0 divide-y divide-white/[0.065] text-left sm:divide-y-0 sm:divide-x">
              {summary.slice(0, 4).map((item) => (
                <div key={item.label} className="px-2 py-2 first:pl-0 last:pr-0">
                  <p className="font-mono text-[7px] uppercase tracking-[0.13em] text-white/[0.36]">
                    {item.label}
                  </p>
                  <strong className="mt-1.5 block font-mono text-[15px] leading-none text-white">
                    {item.value}
                  </strong>
                  <span className="mt-1.5 block truncate text-[9px] text-white/[0.44]">
                    {item.caption}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="velmere-intel-drawer-scroll mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" data-pass4527-intel-scroll="summary-top-list-below-no-xp-scrollbar"
            data-pass4529-intel-scroll="fit-footer-visible-contained-rail-scroll"
            data-pass4530-intel-scroll="rail-inner-scroll-only-footer-stays-visible">
            {isMovers ? (
              <div className="space-y-3" data-pass4528-intel-movers-reference="heading-plus-two-column-market-moves">
                <div className="velmere-intel-market-heading-pass4528 flex items-center justify-between rounded-[1.05rem] border border-white/[0.065] bg-white/[0.018] px-3 py-2.5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white/[0.88]">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                    {t.marketMoves}
                  </p>
                  <span className="rounded-full border border-white/[0.10] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.56]">
                    {t.timeframe24}
                  </span>
                </div>
                <div className="velmere-intel-movers-stack-pass4527 velmere-intel-movers-grid-pass4528 grid grid-cols-1 gap-3 2xl:grid-cols-2" data-pass4527-intel-movers-stack="gainers-losers-below-reference-kpis" data-pass4528-intel-movers-grid="two-column-gainers-losers-when-rail-is-wide" data-pass4529-intel-movers-grid="container-query-two-column-only-when-rail-wide-enough"
                  data-pass4530-intel-movers-grid="reference-two-columns-only-after-rail-min-width">
                  <SectionList
                    title={t.gainers}
                    icon="up"
                    items={gainers}
                    metricLabel={t.changeColumn}
                    t={t}
                    onSelectItem={onSelectItem}
                  />
                  <SectionList
                    title={t.losers}
                    icon="down"
                    items={losers}
                    metricLabel={t.changeColumn}
                    t={t}
                    onSelectItem={onSelectItem}
                  />
                </div>
              </div>
            ) : (
              <SectionList
                title={tab === "risk" ? t.risk : t.evidence}
                icon={tab === "risk" ? "risk" : "evidence"}
                items={currentList}
                metricLabel={tab === "risk" ? t.riskColumn : t.evidenceColumn}
                t={t}
                onSelectItem={onSelectItem}
              />
            )}
          </div>

          <div className="velmere-intel-footer-metrics-pass4528 mt-3 grid grid-cols-3 overflow-hidden rounded-[1.05rem] border border-white/[0.07] bg-white/[0.018]" data-pass4528-intel-footer-metrics="reference-watchlist-risk-sources-bottom-cards" data-pass4529-intel-footer-metrics="three-cards-fixed-bottom-no-scrollbar-leak"
          data-pass4530-intel-footer-metrics="reference-bottom-cards-one-line-no-overflow">
            {footerMetrics.map((item) => (
              <div key={item.label} className="border-r border-white/[0.06] px-3 py-3 text-center last:border-r-0">
                <p className="font-mono text-[7px] uppercase tracking-[0.14em] text-white/[0.34]">{item.label}</p>
                <strong className="mt-1.5 block text-xl font-semibold text-white">{item.value}</strong>
                <span className="mt-0.5 block truncate text-[9px] text-white/[0.42]">{item.caption}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3 text-xs text-white/[0.52]" data-pass4527-intel-footer="reference-bottom-status-no-summary-duplication" data-pass4528-intel-footer="status-and-alert-button-under-reference-cards" data-pass4529-intel-footer="single-line-status-button-no-overflow">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />{" "}
              {t.updated}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-[11px] text-white/[0.70] transition hover:border-cyan-200/[0.20] hover:text-white"
            >
              <Bell className="h-3.5 w-3.5" /> {t.manage}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return mounted
    ? createPortal(
        <>
          {edgeHandle}
          {clickAway}
          {drawer}
        </>,
        document.body,
      )
    : null;
}
