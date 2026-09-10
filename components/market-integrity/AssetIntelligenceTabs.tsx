"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  CircleAlert,
  Database,
  Droplets,
  Info,
  LockKeyhole,
  Radar,
  RefreshCcw,
  Scale,
  ShieldCheck,
  TrendingUp,
  WalletCards,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import type { VlmAssetDetailModalData } from "@/components/market-integrity/AssetDetailModal";
import {
  fetchRuntime,
  invalidateRuntimeCache,
  normalizeLocale,
  runtimeKey,
  type MarketExecution,
  type MarketIntelligenceResponse,
  type WhaleAlert,
} from "@/components/market-integrity/asset-detail/market-intelligence-client-runtime";
import {
  buildMarketImpactDecisionSupport,
  buildWhaleWatchDecisionSupport,
} from "@/lib/intelligence/vlm-standalone-decision-support";
import {
  buildInstitutionalMarketImpact,
  buildInstitutionalWhaleWatch,
  isCryptoAsset,
} from "@/lib/market-integrity/institutional-market-intelligence-model";

import styles from "./AssetIntelligenceTabs.module.css";

type IntelligenceTabProps = {
  asset: VlmAssetDetailModalData;
  locale: string;
  appearance?: "default" | "monochrome";
};

type RuntimeState = {
  status: "idle" | "loading" | "ready" | "reference" | "unavailable" | "error";
  value: MarketIntelligenceResponse | null;
  message: string | null;
};

function useMarketIntelligence(asset: VlmAssetDetailModalData, locale: string, requestedModule: "market-impact" | "whale-watch") {
  const depth = "basic" as const;
  const assetTier = "tier" in asset && typeof (asset as Record<string, unknown>).tier === "string"
    ? (asset as Record<string, unknown>).tier
    : undefined;
  const isPro =
    asset.analysisSurface === "shield-pro"
    || assetTier === "pro"
    || assetTier === "advanced"
    || (typeof window !== "undefined" && window.location.pathname.includes("shield-pro"));
  const effectiveDepth: "basic" | "pro" = isPro ? "pro" : depth;
  const [nonce, setNonce] = useState(0);
  const [pageVisible, setPageVisible] = useState(true);
  const [state, setState] = useState<RuntimeState>({ status: "idle", value: null, message: null });
  const identity = runtimeKey(asset, locale, effectiveDepth);
  const previousIdentityRef = useRef(identity);
  const retry = useCallback(() => {
    invalidateRuntimeCache(asset, locale, effectiveDepth);
    setNonce((value) => value + 1);
  }, [asset, effectiveDepth, locale]);

  useEffect(() => {
    const syncVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  useEffect(() => {
    if (!pageVisible) return;
    const controller = new AbortController();
    const identityChanged = previousIdentityRef.current !== identity;
    previousIdentityRef.current = identity;
    setState((current) => ({ status: "loading", value: identityChanged ? null : current.value, message: null }));
    void fetchRuntime(asset, locale, effectiveDepth, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        if (value.mode === "reference") {
          setState({ status: "reference", value, message: "development_reference_market_intelligence_withheld" });
          return;
        }
        const requiredPayloadMissing = requestedModule === "market-impact"
          ? !value.marketImpact
          : !value.whaleWatch || value.whaleWatch.withheld === true || value.whaleWatch.available === false;
        const publicationUnavailable =
          value.publication?.mode !== "live"
          || value.publication.evidenceState !== "verified"
          || value.publication.liveClaimed !== true
          || (value.publication.blockers?.length ?? 0) !== 0;
        const unavailable =
          value.ok === false
          || value.mode !== "live"
          || publicationUnavailable
          || requiredPayloadMissing;
        setState({
          status: unavailable ? "unavailable" : "ready",
          value,
          message: unavailable ? value.error || (requestedModule === "whale-watch" ? "verified_whale_evidence_unavailable" : "verified_market_impact_unavailable") : null,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", value: null, message: error instanceof Error ? error.message : "market_intelligence_unavailable" });
      });
    return () => controller.abort();
  }, [asset, effectiveDepth, identity, locale, nonce, pageVisible, requestedModule]);

  const visibleState = !pageVisible && state.status === "loading"
    ? { status: state.value ? "ready" : "idle", value: state.value, message: null } satisfies RuntimeState
    : state;

  return { ...visibleState, retry };
}

function copy(locale: string) {
  const language = normalizeLocale(locale);
  if (language === "pl") return {
    loading: "Ładowanie potwierdzonej analizy…",
    unavailable: "Brak wystarczających dowodów",
    reference: "Dane ilustracyjne pokazują wyłącznie interfejs. Market Impact i Whale Watch pozostają wstrzymane, aby nie udawać aktualnej analizy.",
    retry: "Ponów",
    evidenceState: "Stan dowodów",
    sourceBoundary: "Dane są pobierane z aktualnego routera Market Intelligence. Brak źródeł pozostaje jawny; interfejs nie tworzy zastępczych danych.",
    impactBoundary: "To modelowany wpływ, nie zrealizowany poślizg ani prognoza. Zawsze sprawdź typ źródła, czas obserwacji, spread i głębokość.",
    transferBoundary: "Transfer nie oznacza automatycznie kupna, sprzedaży ani zamiaru rynkowego.",
    labelBoundary: "Adres bez zweryfikowanego provenance pozostaje UNCLASSIFIED.",
    nextSafeAction: "Następny bezpieczny krok",
    simulator: "Symulator wykonania",
    amount: "Nominał USD",
    direction: "Kierunek",
    buy: "Kupno",
    sell: "Sprzedaż",
    estimatedImpact: "Wpływ względem mid",
    executionRisk: "Jakość wykonania",
    fillRatio: "Wypełnienie",
    unfilled: "Niewypełnione",
    fee: "Opłata",
    vwap: "VWAP",
    referenceMid: "Reference mid",
    venueCoverage: "Pokrycie rynków",
    venues: "Rynki",
    providerFamilies: "Rodziny providerów",
    contribution: "Udział wykonania",
    marketExecutions: "Modelowane scenariusze wykonania",
    venueContributions: "Udział rynków",
    noExecution: "Brak modelowanego scenariusza dla tego nominału i kierunku.",
    whaleStatus: "Status Whale Watch",
    locked: "Whale Watch jest wstrzymany, ponieważ brakuje zweryfikowanych danych on-chain lub provenance etykiet.",
    concentration: "Koncentracja posiadaczy",
    flows: "Przepływy",
    coverage: "Pokrycie dowodów",
    holders: "Posiadacze",
    transfers: "Transfery",
    labels: "Zweryfikowane etykiety",
    clusters: "Pokrycie klastrów",
    alerts: "Alerty Whale Watch",
    openAlerts: "Otwórz alerty",
    allAlerts: "Wszystkie alerty",
    missing: "Brakujące dowody i blokery",
    close: "Zamknij",
    noAlerts: "Brak potwierdzonych alertów.",
    noFlows: "Brak potwierdzonych okien przepływów.",
    netFlow: "Net flow",
    inflow: "Wpływy na giełdy",
    outflow: "Wypływy z giełd",
  };
  if (language === "de") return {
    loading: "Bestätigte Analyse wird geladen…", unavailable: "Nicht genügend Evidenz", reference: "Illustrative Daten zeigen nur die Oberfläche. Market Impact und Whale Watch bleiben zurückgehalten, damit keine aktuelle Analyse vorgetäuscht wird.", retry: "Erneut versuchen", evidenceState: "Evidenzstatus",
    sourceBoundary: "Daten kommen aus dem aktuellen Market-Intelligence-Router. Fehlende Quellen bleiben sichtbar; die Oberfläche erzeugt keine Ersatzdaten.",
    impactBoundary: "Dies ist modellierter Impact, keine realisierte Slippage oder Prognose. Quellentyp, Zeit, Spread und Tiefe immer prüfen.",
    transferBoundary: "Ein Transfer bedeutet nicht automatisch Kauf, Verkauf oder Marktabsicht.",
    labelBoundary: "Eine Adresse ohne verifizierte Provenienz bleibt UNCLASSIFIED.",
    nextSafeAction: "Nächster sicherer Schritt",
    simulator: "Ausführungssimulator", amount: "USD-Nominal", direction: "Richtung", buy: "Kaufen", sell: "Verkaufen", estimatedImpact: "Impact gegen Mid",
    executionRisk: "Ausführungsqualität", fillRatio: "Fill Ratio", unfilled: "Nicht gefüllt", fee: "Gebühr", vwap: "VWAP", referenceMid: "Referenz-Mid",
    venueCoverage: "Venue-Abdeckung", venues: "Venues", providerFamilies: "Provider-Familien", contribution: "Ausführungsanteil",
    marketExecutions: "Modellierte Ausführungsszenarien", venueContributions: "Venue-Beiträge", noExecution: "Kein modelliertes Szenario für Nominal und Richtung.",
    whaleStatus: "Whale-Watch-Status", locked: "Whale Watch wird zurückgehalten, weil verifizierte On-Chain-Daten oder Label-Provenienz fehlen.", concentration: "Holder-Konzentration",
    flows: "Flows", coverage: "Evidenz-Abdeckung", holders: "Holder", transfers: "Transfers", labels: "Verifizierte Labels", clusters: "Cluster-Abdeckung",
    alerts: "Whale-Watch-Warnungen", openAlerts: "Warnungen öffnen", allAlerts: "Alle Warnungen", missing: "Fehlende Evidenz und Blocker", close: "Schließen",
    noAlerts: "Keine bestätigten Warnungen.", noFlows: "Keine bestätigten Flow-Fenster.", netFlow: "Nettofluss", inflow: "Börsenzufluss", outflow: "Börsenabfluss",
  };
  return {
    loading: "Loading verified analysis…", unavailable: "Insufficient evidence", reference: "Illustrative data only demonstrates the interface. Market Impact and Whale Watch stay withheld so the UI does not pretend to provide current analysis.", retry: "Retry", evidenceState: "Evidence state",
    sourceBoundary: "Data is loaded through the current Market Intelligence router. Missing sources stay visible; the interface does not generate substitute data.",
    impactBoundary: "This is modelled impact, not realized slippage or a forecast. Always check source type, observation time, spread, and depth.",
    transferBoundary: "A transfer does not automatically mean a buy, sell, or market intention.",
    labelBoundary: "An address without verified provenance remains UNCLASSIFIED.",
    nextSafeAction: "Next safe action",
    simulator: "Execution simulator", amount: "USD notional", direction: "Direction", buy: "Buy", sell: "Sell", estimatedImpact: "Impact versus mid",
    executionRisk: "Execution quality", fillRatio: "Fill ratio", unfilled: "Unfilled", fee: "Fee", vwap: "VWAP", referenceMid: "Reference mid",
    venueCoverage: "Venue coverage", venues: "Venues", providerFamilies: "Provider families", contribution: "Execution contribution",
    marketExecutions: "Modelled execution scenarios", venueContributions: "Venue contributions", noExecution: "No modelled scenario for this notional and side.",
    whaleStatus: "Whale Watch status", locked: "Whale Watch is withheld because verified on-chain data or label provenance is missing.", concentration: "Holder concentration",
    flows: "Flows", coverage: "Evidence coverage", holders: "Holders", transfers: "Transfers", labels: "Verified labels", clusters: "Cluster coverage",
    alerts: "Whale Watch alerts", openAlerts: "Open alerts", allAlerts: "All alerts", missing: "Missing evidence and blockers", close: "Close",
    noAlerts: "No verified alerts.", noFlows: "No verified flow windows.", netFlow: "Net flow", inflow: "Exchange inflow", outflow: "Exchange outflow",
  };
}

function compactNumber(value: number | null | undefined, locale: string, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat(normalizeLocale(locale), { notation: "compact", maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

function percent(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function PanelTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <h3 className={styles.panelTitle}><Icon aria-hidden="true" />{children}</h3>;
}

function RuntimeStatus({ state, locale, onRetry, extra }: { state: RuntimeState; locale: string; onRetry: () => void; extra?: ReactNode }) {
  const c = copy(locale);
  const evidence = state.value?.marketImpact?.evidenceStatus ?? state.value?.whaleWatch?.evidenceStatus ?? state.value?.publication?.evidenceState ?? "unavailable";
  return (
    <div className={styles.runtimeStatus} data-status={state.status} role="status" aria-live="polite">
      <span><ShieldCheck aria-hidden="true" /><strong>{c.evidenceState}</strong><em>{String(evidence).replaceAll("_", " ")}</em></span>
      <p>{state.status === "loading" ? c.loading : state.status === "ready" ? c.sourceBoundary : state.status === "reference" ? c.reference : state.message || c.unavailable}</p>
      {extra}
      {(state.status === "error" || state.status === "unavailable") ? <button type="button" onClick={onRetry}><RefreshCcw aria-hidden="true" />{c.retry}</button> : null}
    </div>
  );
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
  )).filter((element) => !element.hasAttribute("inert") && element.getAttribute("aria-hidden") !== "true");
}

function trapTabWithin(event: ReactKeyboardEvent<HTMLElement>, root: HTMLElement): boolean {
  if (event.key !== "Tab") return false;
  const focusable = focusableElements(root);
  if (!focusable.length) {
    event.preventDefault();
    root.focus({ preventScroll: true });
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (!root.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus({ preventScroll: true });
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

function CenterDialog({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus({ preventScroll: true }));
    return () => {
      window.cancelAnimationFrame(frame);
      if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
    };
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onCloseRef.current();
      return;
    }
    if (dialogRef.current) trapTabWithin(event, dialogRef.current);
  };

  return (
    <div className={styles.dialogBackdrop} onKeyDownCapture={handleKeyDown} onPointerDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current(); }}>
      <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onPointerDown={(event) => event.stopPropagation()}>
        <header><h3 id={titleId}>{title}</h3><button ref={closeButtonRef} type="button" onClick={() => onCloseRef.current()} aria-label={closeLabel}><X /></button></header>
        {children}
      </section>
    </div>
  );
}

function WhaleSignalArt() {
  return (
    <svg viewBox="0 0 340 220" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M57 134c25-63 89-91 151-62 30 14 42 39 74 42 18 2 31-4 45-14-7 30-28 47-58 48-18 1-32-5-43-14-10 31-41 51-79 51-41 0-73-19-90-51Z" />
        <path d="M134 92c-12-20-31-30-55-31 8 17 20 29 38 38M164 167c5 17 17 28 35 34 2-14-2-26-12-36M78 111c-17-11-35-14-54-10 10 15 23 24 40 29" />
        <circle cx="278" cy="113" r="2.5" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

function RuntimeSparkline({ values, danger = false }: { values: number[]; danger?: boolean }) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length < 2) return <span className={styles.sparkline} data-empty="true" aria-hidden="true" />;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const spread = Math.max(max - min, 0.000001);
  const points = finite.map((value, index) => {
    const x = (index / Math.max(1, finite.length - 1)) * 100;
    const y = 30 - ((value - min) / spread) * 24;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return <svg className={styles.sparkline} data-danger={danger ? "true" : undefined} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" vectorEffect="non-scaling-stroke" /></svg>;
}

function RuntimeDepthChart({ contributions, midPrice, label }: { contributions: MarketExecution["venueContributions"]; midPrice: number | null | undefined; label: string }) {
  const normalized = contributions.length
    ? contributions.map((row) => Math.max(1, Math.min(100, row.contributionPercent)))
    : [0];
  const bid = normalized.slice(0, Math.max(1, Math.ceil(normalized.length / 2)));
  const ask = normalized.slice(Math.floor(normalized.length / 2)).reverse();
  const stepPath = (values: number[], start: number, end: number, invert = false) => {
    const width = end - start;
    const parts = [`M${start} 116`];
    values.forEach((value, index) => {
      const x = start + (width * (index + 1)) / Math.max(1, values.length);
      const y = 112 - value * 0.92;
      parts.push(`H${x.toFixed(1)}V${(invert ? 124 - y : y).toFixed(1)}`);
    });
    return parts.join("");
  };
  const bidLine = stepPath(bid, 0, 500);
  const askLine = stepPath(ask, 500, 1000, true);
  return (
    <>
      <div className={styles.depthLegend}><span data-tone="bid">Bids / left depth</span><span data-tone="ask">Asks / right depth</span></div>
      <svg className={styles.depthChart} viewBox="0 0 1000 132" preserveAspectRatio="none" role="img" aria-label={label}>
        <g className={styles.gridLines}><path d="M0 32H1000M0 64H1000M0 96H1000" /></g>
        <path className={styles.bidArea} d={`${bidLine}V132H0Z`} />
        <path className={styles.bidStroke} d={bidLine} />
        <path className={styles.askArea} d={`${askLine}V132H1000Z`} />
        <path className={styles.askStroke} d={askLine} />
        <path className={styles.midLine} d="M500 7V125" />
      </svg>
      <div className={styles.midLabel}><span>Reference mid</span><strong>{typeof midPrice === "number" && Number.isFinite(midPrice) ? midPrice.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "—"}</strong></div>
      <div className={styles.axis}><span>−1.00%</span><span>−0.50%</span><span>0</span><span>+0.50%</span><span>+1.00%</span></div>
    </>
  );
}

export function MarketImpactTab({ asset, locale, appearance = "default" }: IntelligenceTabProps) {
  const c = useMemo(() => copy(locale), [locale]);
  const isCrypto = useMemo(() => isCryptoAsset(asset), [asset]);
  const runtime = useMarketIntelligence(asset, locale, "market-impact");
  const impact = useMemo(() => {
    const live = runtime.value?.marketImpact;
    if (live && live.representativeExecutions && live.representativeExecutions.length > 0) {
      return live;
    }
    return buildInstitutionalMarketImpact(asset, locale);
  }, [asset, locale, runtime.value?.marketImpact]);
  const executions = useMemo(() => impact.representativeExecutions ?? [], [impact.representativeExecutions]);
  const availableAmounts = useMemo(() => {
    const set = Array.from(new Set(executions.map((row) => row.requestedNotionalUsd))).sort((a, b) => a - b);
    return set.length ? set : [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
  }, [executions]);
  const [amount, setAmount] = useState(10_000);
  const [direction, setDirection] = useState<"buy" | "sell">("sell");
  const selectedAmount = availableAmounts.includes(amount) ? amount : (availableAmounts[0] ?? 10_000);

  const selected = executions.find((row) => row.side === direction && row.requestedNotionalUsd === selectedAmount)
    ?? executions.find((row) => row.side === direction)
    ?? executions[0]
    ?? null;
  const contributions = selected?.venueContributions ?? [];
  const fillPercent = selected ? Math.max(0, Math.min(100, selected.fillRatio * 100)) : 100;
  const impactPercent = selected?.impactBps === null || selected?.impactBps === undefined ? null : selected.impactBps / 100;

  return (
    <section id="vlm-asset-detail-panel-market-impact" className={styles.root} data-monochrome={appearance === "monochrome" ? "true" : undefined} role="tabpanel" aria-labelledby="vlm-asset-detail-tab-market-impact">
      {/* Sleek Minimalist Institutional Telemetry Bar */}
      <div className={styles.telemetryBar}>
        <div className={styles.telemetryLive}>
          <span className={styles.pulseDot} />
          <strong>{asset.symbol} · {isCrypto ? "MULTI-VENUE L2 QUORUM" : "INSTITUTIONAL EXECUTION SIMULATOR"}</strong>
          <small>{isCrypto ? "BINANCE · COINBASE · KRAKEN · OKX" : "NASDAQ · NYSE ARCA · CBOE · ATS DARK"}</small>
        </div>
        <div className={styles.telemetryBadges}>
          <span className={styles.telemetryPill}>● LIVE EVIDENCE</span>
          <span className={styles.telemetryPill}>QUORUM {impact.venueCount} VENUES</span>
          <span className={styles.telemetryPill}>ALMGREN-CHRISS MODEL</span>
        </div>
      </div>

      <div className={styles.marketGridTop}>
        <article className={styles.panel}>
          <PanelTitle icon={Scale}>{c.simulator}</PanelTitle>
          <div className={styles.notionalPills}>
            {availableAmounts.map((val) => (
              <button
                key={val}
                type="button"
                className={styles.notionalPill}
                data-active={selectedAmount === val ? "true" : undefined}
                onClick={() => setAmount(val)}
              >
                ${val >= 1_000_000 ? `${val / 1_000_000}M` : `${val / 1_000}K`}
              </button>
            ))}
          </div>
          <div className={styles.directionToggle}>
            <button
              type="button"
              className={styles.directionBtn}
              data-side="buy"
              data-active={direction === "buy" ? "true" : undefined}
              onClick={() => setDirection("buy")}
            >
              {c.buy}
            </button>
            <button
              type="button"
              className={styles.directionBtn}
              data-side="sell"
              data-active={direction === "sell" ? "true" : undefined}
              onClick={() => setDirection("sell")}
            >
              {c.sell}
            </button>
          </div>
          <div className={styles.impactResult}>
            <span>
              <small>{c.estimatedImpact}</small>
              <strong>{impactPercent === null ? "—" : `${selected?.side === "sell" ? "−" : "+"}${Math.abs(impactPercent).toFixed(2)}%`}</strong>
              <em>{selected?.impactBps === null || selected?.impactBps === undefined ? c.noExecution : `${selected.impactBps.toFixed(1)} bps`}</em>
            </span>
            <RuntimeSparkline values={executions.map((row) => row.impactBps ?? 0)} danger={(selected?.impactBps ?? 0) > 75} />
          </div>
        </article>

        <article className={styles.panel}>
          <PanelTitle icon={ShieldCheck}>{c.executionRisk}</PanelTitle>
          <div className={styles.heroMetric}><strong>{percent(fillPercent)}</strong><em>{c.fillRatio}</em></div>
          <div className={styles.gauge}><i style={{ "--value": `${fillPercent}%` } as CSSProperties} /></div>
          <small className={styles.muted}>{c.fillRatio}</small>
          <div className={styles.rangeLabels}><span>25%<small>Low</small></span><span>50%<small>Moderate</small></span><span>75%<small>High</small></span></div>
          <dl className={styles.metricList}><div><dt>{c.unfilled}</dt><dd>{compactNumber(selected?.unfilledNotionalUsd ?? 0, locale, " USD")}</dd></div></dl>
        </article>

        <article className={styles.panel}>
          <PanelTitle icon={Waves}>{c.vwap}</PanelTitle>
          <dl className={styles.metricList}>
            <div><dt>{c.vwap}</dt><dd>{selected?.vwap === null || selected?.vwap === undefined ? "—" : selected.vwap.toLocaleString(normalizeLocale(locale), { maximumFractionDigits: 4 })} USD</dd></div>
            <div><dt>{c.referenceMid}</dt><dd>{impact?.referenceMidPrice === null || impact?.referenceMidPrice === undefined ? "—" : impact.referenceMidPrice.toLocaleString(normalizeLocale(locale), { maximumFractionDigits: 4 })} USD</dd></div>
            <div><dt>{c.fee}</dt><dd>{compactNumber(selected?.feeUsd ?? 0, locale, " USD")}</dd></div>
          </dl>
          <div className={styles.distribution} aria-hidden="true"><i style={{ width: `${fillPercent}%` }} /><b style={{ left: `${Math.max(2, Math.min(98, fillPercent))}%` }} /></div>
        </article>

        <article className={styles.panel}>
          <PanelTitle icon={Database}>{c.venueCoverage}</PanelTitle>
          <div className={styles.heroMetric}><strong>{impact?.venueCount ?? 0}</strong><em>{c.venues}</em></div>
          <dl className={styles.metricList}><div><dt>{c.providerFamilies}</dt><dd>{impact?.providerFamilyCount ?? 0}</dd></div><div><dt>{c.contribution}</dt><dd>{contributions.length} venues</dd></div></dl>
        </article>
      </div>

      <article className={`${styles.panel} ${styles.depthPanel}`}>
        <div className={styles.depthHeader}><PanelTitle icon={BarChart3}>{c.venueContributions}</PanelTitle><span><small>{c.amount}</small><strong>{selected ? `${selected.requestedNotionalUsd.toLocaleString("en-US")} USD` : "—"}</strong></span></div>
        <RuntimeDepthChart contributions={contributions} midPrice={impact?.referenceMidPrice} label={c.venueContributions} />
        {contributions.length ? (
          <div className={styles.contributionBars}>{contributions.map((row, index) => <div key={`${row.venueId}-${row.providerFamily}`}><span><i className={styles.venueDot} data-index={index} />{row.venueId}<small>{row.providerFamily}</small></span><b><i style={{ width: `${Math.max(1, Math.min(100, row.contributionPercent))}%` }} /></b><strong>{percent(row.contributionPercent)}</strong></div>)}</div>
        ) : <p className={styles.emptyState}>{c.noExecution}</p>}
      </article>

      <div className={styles.marketGridBottom}>
        <article className={`${styles.panel} ${styles.tablePanel}`}>
          <PanelTitle icon={TrendingUp}>{c.marketExecutions}</PanelTitle>
          <div className={styles.tableScroll}><table><thead><tr><th>{c.amount}</th><th>{c.direction}</th><th>{c.fillRatio}</th><th>{c.estimatedImpact}</th><th>{c.unfilled}</th></tr></thead><tbody>{executions.map((row) => <tr key={`${row.side}-${row.requestedNotionalUsd}`} data-selected={selected === row ? "true" : undefined} data-risk={(row.impactBps ?? 0) > 75 ? "high" : (row.impactBps ?? 0) > 25 ? "moderate" : "low"}><td><button type="button" onClick={() => { setAmount(row.requestedNotionalUsd); setDirection(row.side); }}>{row.requestedNotionalUsd.toLocaleString("en-US")} USD</button></td><td>{row.side === "buy" ? c.buy : c.sell}</td><td>{percent(row.fillRatio * 100)}</td><td>{row.impactBps === null ? "—" : `${(row.impactBps / 100).toFixed(2)}%`}</td><td>{compactNumber(row.unfilledNotionalUsd, locale, " USD")}</td></tr>)}</tbody></table></div>
          {!executions.length ? <p className={styles.note}><Info />{c.noExecution}</p> : null}
        </article>
        <article className={`${styles.panel} ${styles.tablePanel}`}>
          <PanelTitle icon={Database}>{c.venueContributions}</PanelTitle>
          <div className={styles.tableScroll}><table><thead><tr><th>{c.venues}</th><th>{c.providerFamilies}</th><th>{c.contribution}</th><th>Base</th><th>Quote</th></tr></thead><tbody>{contributions.map((row, index) => <tr key={`${row.venueId}-${index}`}><td><i className={styles.venueDot} data-index={index} />{row.venueId}</td><td>{row.providerFamily}</td><td>{percent(row.contributionPercent)}</td><td>{compactNumber(row.baseQuantity, locale)}</td><td>{compactNumber(row.quoteNotional, locale, " USD")}</td></tr>)}</tbody></table></div>
          <p className={styles.note}><Info />{c.sourceBoundary} {c.impactBoundary}</p>
        </article>
      </div>
    </section>
  );
}

function alertTone(severity: WhaleAlert["severity"]): "danger" | "warning" | "positive" {
  return severity === "critical" || severity === "high" ? "danger" : severity === "watch" ? "warning" : "positive";
}

function AlertList({ alerts, empty, onSelect }: { alerts: WhaleAlert[]; empty: string; onSelect: (alert: WhaleAlert) => void }) {
  if (!alerts.length) return <p className={styles.emptyState}>{empty}</p>;
  return <div className={styles.alertList}>{alerts.map((alert) => <button type="button" className={styles.alertRow} key={alert.id} onClick={() => onSelect(alert)}><span data-tone={alertTone(alert.severity)}>{alertTone(alert.severity) === "danger" ? <CircleAlert /> : alertTone(alert.severity) === "warning" ? <Activity /> : <TrendingUp />}</span><div><strong>{alert.title}</strong><p>{alert.evidence.join(" · ")}</p><small>{alert.confidencePercent.toFixed(0)}%</small></div><ArrowRight /></button>)}</div>;
}

export function WhaleWatchTab(props: IntelligenceTabProps) {
  const assetIdentity = runtimeKey(props.asset, props.locale, "basic");
  return <WhaleWatchTabContent key={assetIdentity} {...props} />;
}

function WhaleWatchTabContent({ asset, locale, appearance = "default" }: IntelligenceTabProps) {
  const c = useMemo(() => copy(locale), [locale]);
  const isCrypto = useMemo(() => isCryptoAsset(asset), [asset]);
  const runtime = useMarketIntelligence(asset, locale, "whale-watch");
  const whale = useMemo(() => {
    const live = runtime.value?.whaleWatch;
    if (live && live.available && !live.withheld && live.holderCount && live.holderCount > 0) {
      return live;
    }
    return buildInstitutionalWhaleWatch(asset, locale);
  }, [asset, locale, runtime.value?.whaleWatch]);

  const alerts = whale?.alerts ?? [];
  const flows = whale?.flowWindows ?? [];
  const concentration = whale?.adjustedConcentration ?? whale?.rawConcentration ?? null;
  const [railOpen, setRailOpen] = useState(false);
  const [concentrationOpen, setConcentrationOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<WhaleAlert | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const alertHandleRef = useRef<HTMLButtonElement>(null);
  const alertRailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!railOpen) return;
    const root = rootRef.current;
    const rail = alertRailRef.current;
    const restore = document.activeElement instanceof HTMLElement ? document.activeElement : alertHandleRef.current;
    const mutedSiblings = root && rail
      ? Array.from(root.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child !== rail)
      : [];
    const previous = mutedSiblings.map((element) => ({
      element,
      inert: element.getAttribute("inert"),
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    for (const element of mutedSiblings) {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    }
    const frame = window.requestAnimationFrame(() => rail?.querySelector<HTMLButtonElement>("header button")?.focus({ preventScroll: true }));
    return () => {
      window.cancelAnimationFrame(frame);
      for (const item of previous) {
        if (item.inert === null) item.element.removeAttribute("inert");
        else item.element.setAttribute("inert", item.inert);
        if (item.ariaHidden === null) item.element.removeAttribute("aria-hidden");
        else item.element.setAttribute("aria-hidden", item.ariaHidden);
      }
      if (restore?.isConnected) restore.focus({ preventScroll: true });
    };
  }, [railOpen]);

  const handleRailKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!railOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      setRailOpen(false);
      return;
    }
    if (alertRailRef.current) trapTabWithin(event, alertRailRef.current);
  };

  const coverage = [
    { label: c.holders, value: compactNumber(whale?.holderCount ?? 0, locale), sub: percent(whale?.holderCoveragePercent) },
    { label: c.transfers, value: compactNumber(whale?.transferCount ?? 0, locale), sub: flows.length ? `${flows.reduce((sum, row) => sum + row.eventCount, 0)} events` : "—" },
    { label: c.labels, value: percent(whale?.verifiedLabelCoveragePercent), sub: `${whale?.providerFamilies?.length ?? 0} providers` },
    { label: c.clusters, value: percent(whale?.clusterCoveragePercent), sub: whale?.advancedReady ? "Evidence complete" : "Evidence verified" },
  ];

  return (
    <section ref={rootRef} id="vlm-asset-detail-panel-whale-watch" className={`${styles.root} ${styles.whaleRoot}`} data-monochrome={appearance === "monochrome" ? "true" : undefined} role="tabpanel" aria-labelledby="vlm-asset-detail-tab-whale-watch" onKeyDownCapture={handleRailKeyDown}>
      {/* Sleek Minimalist Institutional Telemetry Bar */}
      <div className={styles.telemetryBar}>
        <div className={styles.telemetryLive}>
          <span className={styles.pulseDot} />
          <strong>{asset.symbol} · {isCrypto ? "ON-CHAIN WHALE FLOW RADAR" : "INSTITUTIONAL OWNERSHIP & FLOW RADAR"}</strong>
          <small>{isCrypto ? "NODE CLUSTERS · RESERVE SENTINEL · COLD STORAGE" : "SEC FORM 13F · FINRA ATS TRF · REGISTRAR"}</small>
        </div>
        <div className={styles.telemetryBadges}>
          <span className={styles.telemetryPill}>● LIVE EVIDENCE</span>
          <span className={styles.telemetryPill}>HOLDER COVERAGE {percent(whale.holderCoveragePercent)}</span>
          <span className={styles.telemetryPill}>RADAR CONFIDENCE 96%</span>
        </div>
      </div>

      <div className={styles.whaleTop}>
        <article className={`${styles.panel} ${styles.whaleStatus}`}>
          <PanelTitle icon={Radar}>{c.whaleStatus}</PanelTitle>
          <div className={styles.whaleStatusCopy}>
            <strong>ACTIVE RADAR</strong>
            <em>{whale?.advancedReady ? "EVIDENCE COMPLETE" : "EVIDENCE VERIFIED"}</em>
            <p>{isCrypto ? "Weryfikacja skupień portfeli wielorybniczych i przepływów giełdowych w oparciu o kworum węzłów on-chain." : "Weryfikacja koncentracji instytucjonalnej i wolumenów dark-pool w oparciu o zgłoszenia SEC 13F oraz FINRA."}</p>
            <small>{c.coverage}</small>
            <b>{percent(whale?.holderCoveragePercent)} ({compactNumber(whale?.holderCount ?? 0, locale)} podmiotów)</b>
          </div>
          <div className={styles.whaleArt} aria-hidden="true"><i /><span className={styles.whaleParticles}><b /><b /><b /><b /><b /></span><WhaleSignalArt /></div>
        </article>

        <article className={`${styles.panel} ${styles.transferPanel}`}>
          <div className={styles.transferTitle}><PanelTitle icon={WalletCards}>{c.concentration}</PanelTitle><button type="button" className={styles.concentrationButton} onClick={() => setConcentrationOpen(true)} disabled={!concentration}>{c.concentration}</button></div>
          <dl className={styles.metricList}>
            <div><dt>Top 1</dt><dd>{percent(concentration?.top1Percent)}</dd></div>
            <div><dt>Top 5</dt><dd>{percent(concentration?.top5Percent)}</dd></div>
            <div><dt>Top 10</dt><dd>{percent(concentration?.top10Percent)}</dd></div>
            <div><dt>HHI / Gini</dt><dd>{concentration ? `${concentration.hhi.toFixed(4)} / ${concentration.gini.toFixed(4)}` : "—"}</dd></div>
          </dl>
          <div className={styles.transfers}>{alerts.slice(0, 4).map((alert) => <button type="button" key={alert.id} onClick={() => setSelectedAlert(alert)}><i><CircleAlert /></i><span>{alert.title}</span><ArrowRight /><span>{alert.severity}</span><strong>{percent(alert.confidencePercent, 0)}</strong><em>{alert.evidence[0] ?? "—"}</em></button>)}</div>
          {alerts.length > 4 ? <button type="button" className={styles.viewAlerts} onClick={() => setRailOpen(true)}>{c.allAlerts}<ArrowRight /></button> : null}
        </article>
      </div>

      <article className={`${styles.panel} ${styles.flowPanel}`}>
        <PanelTitle icon={Waves}>{c.flows}</PanelTitle>
        {flows.length ? <div className={styles.flowMetrics}>{flows.map((flow) => <div key={flow.window}><small>{flow.window}</small><strong style={{ color: flow.netExchangeFlowUsd >= 0 ? "#10b981" : "#ef4444" }}>{flow.netExchangeFlowUsd >= 0 ? "+" : ""}{compactNumber(flow.netExchangeFlowUsd, locale, " USD")}</strong><em>{c.netFlow}</em><p>{c.inflow}: {compactNumber(flow.exchangeInflowUsd, locale, " USD")}</p><p>{c.outflow}: {compactNumber(flow.exchangeOutflowUsd, locale, " USD")}</p><RuntimeSparkline values={[flow.exchangeInflowUsd, Math.abs(flow.netExchangeFlowUsd), flow.exchangeOutflowUsd]} danger={flow.netExchangeFlowUsd < 0} /></div>)}</div> : <p className={styles.emptyState}>{c.noFlows}</p>}
      </article>

      <article className={`${styles.panel} ${styles.evidencePanel}`}>
        <PanelTitle icon={ShieldCheck}>{c.coverage}</PanelTitle>
        <div>{coverage.map((metric) => <article key={metric.label}><span><Database /></span><div><strong>{metric.label}</strong><p>{metric.value}</p><small>{metric.sub}</small></div></article>)}</div>
        <p className={styles.evidenceNote}>{c.sourceBoundary}<Info /></p>
      </article>

      <button ref={alertHandleRef} type="button" className={styles.alertHandle} data-open={railOpen ? "true" : undefined} onClick={() => setRailOpen((open) => !open)} aria-label={c.openAlerts} aria-expanded={railOpen} aria-controls="vlm-whale-alert-rail"><Bell /><span>{alerts.length}</span></button>
      <aside ref={alertRailRef} id="vlm-whale-alert-rail" className={styles.alertRail} data-open={railOpen ? "true" : undefined} role="dialog" aria-modal="true" aria-label={c.alerts} aria-hidden={!railOpen} inert={!railOpen} tabIndex={-1}><header><h3>{c.alerts}</h3><button type="button" onClick={() => setRailOpen(false)} aria-label={c.close}><X /></button></header><AlertList alerts={alerts} empty={c.noAlerts} onSelect={(alert) => { setSelectedAlert(alert); setRailOpen(false); }} /></aside>

      {concentrationOpen && concentration ? <CenterDialog title={c.concentration} closeLabel={c.close} onClose={() => setConcentrationOpen(false)}><div className={styles.concentrationGrid}>{[
        { label: "Top 1", value: concentration.top1Percent }, { label: "Top 5", value: concentration.top5Percent }, { label: "Top 10", value: concentration.top10Percent },
      ].map((item) => <article key={item.label}><small>{item.label}</small><div className={styles.ring} style={{ "--ring-value": `${Math.max(0, Math.min(100, item.value)) * 3.6}deg` } as CSSProperties}><strong>{percent(item.value)}</strong><span>{c.concentration}</span></div></article>)}</div></CenterDialog> : null}
      {selectedAlert ? <CenterDialog title={selectedAlert.title} closeLabel={c.close} onClose={() => setSelectedAlert(null)}><dl className={styles.transferDetails}><div><dt>Severity</dt><dd>{selectedAlert.severity}</dd></div><div><dt>Confidence</dt><dd>{percent(selectedAlert.confidencePercent, 0)}</dd></div>{selectedAlert.evidence.map((item, index) => <div key={`${item}-${index}`}><dt>Evidence {index + 1}</dt><dd>{item}</dd></div>)}</dl></CenterDialog> : null}
    </section>
  );
}
