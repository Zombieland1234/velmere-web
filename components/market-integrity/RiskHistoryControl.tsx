"use client";

import BodyPortal from "@/components/ui/BodyPortal";
import { useDialogFocusBoundary } from "@/components/ui/useDialogFocusBoundary";
import {
  buildRiskHistoryChartPolyline,
  fetchRiskHistoryCustomerPayload,
  mergeRiskHistoryCustomerPages,
  RISK_HISTORY_CUSTOMER_MAX_EVENTS,
  RISK_HISTORY_CUSTOMER_MAX_MERGED_EVENTS,
  type RiskHistoryCustomerRoutePayload,
} from "@/lib/market-integrity/risk-history-customer-client";
import type { RiskHistoryEventType } from "@/lib/market-integrity/risk-history-contract";
import {
  alignRiskHistoryCurrentObservation,
  type RiskHistoryCurrentAlignmentState,
  type RiskHistoryCurrentObservation,
} from "@/lib/market-integrity/risk-history-current-alignment";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock3,
  History,
  Info,
  Loader2,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import RiskCalculationWaterfallFork from "@/components/market-integrity/RiskCalculationWaterfallFork";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Locale = "pl" | "en" | "de";
type LoadState = "idle" | "loading" | "loaded" | "error";
type RiskHistoryVariant = "cell" | "mobile";
type RiskHistoryControlProps = {
  assetId: string;
  assetName: string;
  symbol: string;
  currentObservation: RiskHistoryCurrentObservation;
  locale: Locale;
  enabled: boolean;
  variant?: RiskHistoryVariant;
};

const COPY = {
  pl: {
    title: "Historia ryzyka",
    open: "Otwórz widoczną historię ryzyka",
    close: "Zamknij historię ryzyka",
    loading: "Ładowanie zweryfikowanej historii…",
    error: "Historia jest obecnie niedostępna.",
    retry: "Spróbuj ponownie",
    empty: "Velmère nie ma jeszcze publicznych, zweryfikowanych obserwacji dla tego aktywa.",
    withheld: "Brak publicznej historii ryzyka dla tego żądania.",
    trackedSince: "Widoczna historia od",
    observations: "Obserwacje",
    segments: "Segmenty metodologii",
    scoreVersion: "Wersja score",
    current: "Bieżący wynik tabeli",
    currentUnavailable: "Bieżący wynik jest wstrzymany; dostępna może być wyłącznie wcześniejsza zweryfikowana historia.",
    latestStored: "Najnowsza zapisana obserwacja",
    asOf: "Stan na",
    alignment: {
      CURRENT_WITHHELD: "Bieżący wynik nie ma kompletnego, publikowalnego powiązania. Historia pozostaje osobnym dowodem.",
      HISTORY_EMPTY: "Bieżący wynik jest dostępny, ale nie ma jeszcze publicznej zapisanej obserwacji historii.",
      ALIGNED_SAME_OBSERVATION: "Bieżący wynik i najnowsza zapisana obserwacja są zgodne dla tej samej tożsamości, wersji i czasu.",
      CURRENT_NEWER_COMPARABLE: "Bieżący wynik jest nowszy niż zapis historii. Oba należą do porównywalnego segmentu metodologii.",
      CURRENT_NEWER_NEW_SEGMENT: "Bieżący wynik jest nowszy i używa innego segmentu metodologii lub dowodu. Nie porównuj go bezpośrednio ze starszą historią.",
      HISTORY_NEWER_THAN_CURRENT: "Zapis historii jest nowszy niż wynik tabeli. Bieżący wynik tabeli został wstrzymany jako potencjalnie nieaktualny.",
      IDENTITY_CONFLICT: "Tożsamość bieżącego wyniku nie zgadza się z historią. Bieżący wynik został wstrzymany.",
      SAME_OBSERVATION_CONFLICT: "Dla tego samego czasu istnieją sprzeczne wartości lub wersje. Bieżący wynik został wstrzymany.",
    },
    storageDurable: "Ta strona została odczytana z bazy i zweryfikowana integralnościowo; retencja wieloletnia i restore pozostają nieudowodnione.",
    storageRuntime: "Ta strona pochodzi wyłącznie z pamięci bieżącego środowiska; odczyt z bazy, retencja i restore nie są udowodnione.",
    storageUnknown: "Pochodzenie tej strony historii nie zostało potwierdzone.",
    notProbability: "To opisowy sygnał priorytetu przeglądu, nie prawdopodobieństwo ani prognoza ceny.",
    historyRounding: "Zapis historii normalizuje wynik do pełnych punktów; bieżąca tabela może pokazywać większą precyzję.",
    startsAtTracking: "Widoczna historia zaczyna się od pierwszej obserwacji dopuszczonej do publikacji; nie oznacza to wcześniejszego wewnętrznego trackingu.",
    incomparable: "Nowy segment nie jest bezpośrednio porównywalny z poprzednim.",
    comparable: "Porównywalne w ramach tego samego segmentu metodologii.",
    latestEvents: "Ostatnie zmiany",
    fullTimeline: "Widoczna oś czasu",
    loadOlder: "Załaduj starsze obserwacje",
    loadingOlder: "Ładowanie starszych obserwacji…",
    olderUnavailable: "Nie udało się załadować starszej części historii.",
    boundedWindow: "Pokazano ograniczone okno widocznej historii. Starsze publiczne obserwacje są dostępne na żądanie.",
    historyLimitReached: "Osiągnięto bezpieczny limit tego widoku. Dalsza historia nie została automatycznie pobrana.",
    completeTimeline: "Załadowano całą widoczną historię od najwcześniejszej obserwacji dopuszczonej do publikacji.",
    visibleFrom: "Widoczne okno od",
    score: "Wynik",
    confidence: "Pewność",
    unknownConfidence: "niepodana",
    event: {
      TRACKING_STARTED: "Rozpoczęto zweryfikowane śledzenie",
      SCORE_CHANGED: "Zmienił się wynik ryzyka",
      LEVEL_CHANGED: "Zmienił się poziom ryzyka",
      METHODOLOGY_CHANGED: "Zmieniono metodologię lub konfigurację źródeł",
      EVIDENCE_CHANGED: "Zmienił się powiązany dowód",
      PUBLICATION_STATE_CHANGED: "Zmieniła się możliwość publikacji",
      HEARTBEAT: "Potwierdzono ciągłość bez materialnej zmiany",
    },
  },
  en: {
    title: "Risk history",
    open: "Open visible risk history",
    close: "Close risk history",
    loading: "Loading verified history…",
    error: "Risk history is currently unavailable.",
    retry: "Try again",
    empty: "Velmère has no public verified observations for this asset yet.",
    withheld: "No public risk history is available for this request.",
    trackedSince: "Visible history since",
    observations: "Observations",
    segments: "Methodology segments",
    scoreVersion: "Score version",
    current: "Current table score",
    currentUnavailable: "The current score is withheld; only earlier verified history may be available.",
    latestStored: "Latest stored observation",
    asOf: "As of",
    alignment: {
      CURRENT_WITHHELD: "The current score lacks a complete publishable binding. History remains separate evidence.",
      HISTORY_EMPTY: "The current score is available, but no public stored history observation exists yet.",
      ALIGNED_SAME_OBSERVATION: "The current score and latest stored observation align on identity, version and time.",
      CURRENT_NEWER_COMPARABLE: "The current score is newer than stored history. Both remain in a comparable methodology segment.",
      CURRENT_NEWER_NEW_SEGMENT: "The current score is newer and uses a different methodology or evidence segment. Do not compare it directly with older history.",
      HISTORY_NEWER_THAN_CURRENT: "Stored history is newer than the table score. The table score is withheld as potentially stale.",
      IDENTITY_CONFLICT: "The current score identity does not match the history identity. The current score is withheld.",
      SAME_OBSERVATION_CONFLICT: "The same observation time has conflicting values or versions. The current score is withheld.",
    },
    storageDurable: "This page was read from the database and integrity-verified; multi-year retention and restore remain unproven.",
    storageRuntime: "This page comes only from the current runtime memory; database read, retention and restore are unproven.",
    storageUnknown: "This history page provenance has not been verified.",
    notProbability: "This is a descriptive review-priority signal, not a probability or price forecast.",
    historyRounding: "Stored history normalizes scores to whole points; the current table may show greater precision.",
    startsAtTracking: "Visible history begins with the first publishable observation; it does not imply earlier internal tracking.",
    incomparable: "The new segment is not directly comparable with the preceding segment.",
    comparable: "Comparable within the same methodology segment.",
    latestEvents: "Latest changes",
    fullTimeline: "Visible timeline",
    loadOlder: "Load older observations",
    loadingOlder: "Loading older observations…",
    olderUnavailable: "The older history window could not be loaded.",
    boundedWindow: "A bounded visible-history window is shown. Older public observations are available on request.",
    historyLimitReached: "This view reached its safety limit. Additional history was not fetched automatically.",
    completeTimeline: "The complete visible history has been loaded back to the earliest publishable observation.",
    visibleFrom: "Visible window since",
    score: "Score",
    confidence: "Confidence",
    unknownConfidence: "not provided",
    event: {
      TRACKING_STARTED: "Verified tracking started",
      SCORE_CHANGED: "Risk score changed",
      LEVEL_CHANGED: "Risk level changed",
      METHODOLOGY_CHANGED: "Methodology or source configuration changed",
      EVIDENCE_CHANGED: "Bound evidence changed",
      PUBLICATION_STATE_CHANGED: "Publication eligibility changed",
      HEARTBEAT: "Continuity confirmed with no material change",
    },
  },
  de: {
    title: "Risikoverlauf",
    open: "Sichtbaren Risikoverlauf öffnen",
    close: "Risikoverlauf schließen",
    loading: "Verifizierter Verlauf wird geladen…",
    error: "Der Risikoverlauf ist derzeit nicht verfügbar.",
    retry: "Erneut versuchen",
    empty: "Velmère hat für dieses Asset noch keine öffentlichen verifizierten Beobachtungen.",
    withheld: "Für diese Anfrage ist kein öffentlicher Risikoverlauf verfügbar.",
    trackedSince: "Sichtbarer Verlauf seit",
    observations: "Beobachtungen",
    segments: "Methodiksegmente",
    scoreVersion: "Score-Version",
    current: "Aktueller Tabellenwert",
    currentUnavailable: "Der aktuelle Wert ist zurückgehalten; möglicherweise ist nur ein früherer verifizierter Verlauf verfügbar.",
    latestStored: "Neueste gespeicherte Beobachtung",
    asOf: "Stand",
    alignment: {
      CURRENT_WITHHELD: "Dem aktuellen Wert fehlt eine vollständige veröffentlichungsfähige Bindung. Der Verlauf bleibt ein getrennter Nachweis.",
      HISTORY_EMPTY: "Der aktuelle Wert ist verfügbar, aber es gibt noch keine öffentliche gespeicherte Verlaufsbeobachtung.",
      ALIGNED_SAME_OBSERVATION: "Aktueller Wert und neueste gespeicherte Beobachtung stimmen bei Identität, Version und Zeit überein.",
      CURRENT_NEWER_COMPARABLE: "Der aktuelle Wert ist neuer als der gespeicherte Verlauf. Beide liegen in einem vergleichbaren Methodiksegment.",
      CURRENT_NEWER_NEW_SEGMENT: "Der aktuelle Wert ist neuer und verwendet ein anderes Methodik- oder Nachweissegment. Kein direkter Vergleich mit älteren Verlaufsdaten.",
      HISTORY_NEWER_THAN_CURRENT: "Der gespeicherte Verlauf ist neuer als der Tabellenwert. Der Tabellenwert wird als möglicherweise veraltet zurückgehalten.",
      IDENTITY_CONFLICT: "Die Identität des aktuellen Werts stimmt nicht mit der Verlaufsidentität überein. Der aktuelle Wert wird zurückgehalten.",
      SAME_OBSERVATION_CONFLICT: "Für denselben Beobachtungszeitpunkt bestehen widersprüchliche Werte oder Versionen. Der aktuelle Wert wird zurückgehalten.",
    },
    storageDurable: "Diese Seite wurde aus der Datenbank gelesen und auf Integrität geprüft; Langzeitaufbewahrung und Wiederherstellung sind nicht belegt.",
    storageRuntime: "Diese Seite stammt nur aus dem Speicher der aktuellen Laufzeit; Datenbanklesung, Aufbewahrung und Wiederherstellung sind nicht belegt.",
    storageUnknown: "Die Herkunft dieser Verlaufsseite wurde nicht bestätigt.",
    notProbability: "Dies ist ein beschreibendes Prüfsignal, keine Wahrscheinlichkeit oder Preisprognose.",
    historyRounding: "Der gespeicherte Verlauf normalisiert Werte auf ganze Punkte; die aktuelle Tabelle kann genauer sein.",
    startsAtTracking: "Der sichtbare Verlauf beginnt mit der ersten veröffentlichungsfähigen Beobachtung; frühere interne Erfassung wird nicht offengelegt.",
    incomparable: "Das neue Segment ist nicht direkt mit dem vorherigen Segment vergleichbar.",
    comparable: "Innerhalb desselben Methodiksegments vergleichbar.",
    latestEvents: "Letzte Änderungen",
    fullTimeline: "Sichtbare Zeitleiste",
    loadOlder: "Ältere Beobachtungen laden",
    loadingOlder: "Ältere Beobachtungen werden geladen…",
    olderUnavailable: "Der ältere Verlaufsabschnitt konnte nicht geladen werden.",
    boundedWindow: "Es wird ein begrenztes sichtbares Verlaufsfenster gezeigt. Ältere öffentliche Beobachtungen können gezielt geladen werden.",
    historyLimitReached: "Die Sicherheitsgrenze dieser Ansicht wurde erreicht. Weitere Historie wurde nicht automatisch geladen.",
    completeTimeline: "Der vollständige sichtbare Verlauf bis zur frühesten veröffentlichungsfähigen Beobachtung wurde geladen.",
    visibleFrom: "Sichtbares Fenster seit",
    score: "Wert",
    confidence: "Konfidenz",
    unknownConfidence: "nicht angegeben",
    event: {
      TRACKING_STARTED: "Verifiziertes Tracking gestartet",
      SCORE_CHANGED: "Risikowert geändert",
      LEVEL_CHANGED: "Risikostufe geändert",
      METHODOLOGY_CHANGED: "Methodik oder Quellenkonfiguration geändert",
      EVIDENCE_CHANGED: "Gebundener Nachweis geändert",
      PUBLICATION_STATE_CHANGED: "Veröffentlichungsstatus geändert",
      HEARTBEAT: "Kontinuität ohne wesentliche Änderung bestätigt",
    },
  },
} as const;

function formatDate(value: string | null, locale: Locale) {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : locale === "de" ? "de-DE" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(parsed));
}

function scoreTone(score: number | null) {
  if (score === null || !Number.isFinite(score)) return "text-white/[0.34]";
  if (score >= 78) return "text-rose-300";
  if (score >= 62) return "text-orange-200";
  if (score >= 36) return "text-cyan-200";
  return "text-emerald-300";
}

function scorePillClasses(score: number | null) {
  if (score === null || !Number.isFinite(score)) return "border-white/10 bg-white/[0.04] text-white/40";
  if (score >= 78) return "border-rose-400/30 bg-rose-500/10 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]";
  if (score >= 62) return "border-orange-400/30 bg-orange-500/10 text-orange-200 shadow-[0_0_12px_rgba(249,115,22,0.15)]";
  if (score >= 36) return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.15)]";
  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]";
}

function formatScore(score: number | null, locale: Locale, maximumFractionDigits = 2) {
  if (score === null || !Number.isFinite(score)) return "—";
  return `${new Intl.NumberFormat(locale === "pl" ? "pl-PL" : locale === "de" ? "de-DE" : "en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(score)}/100`;
}

function shortVersion(value: string) {
  return /^sha256:[a-f0-9]{64}$/u.test(value) ? `…${value.slice(-10)}` : "—";
}

function storageLabel(payload: RiskHistoryCustomerRoutePayload | null, locale: Locale) {
  const copy = COPY[locale];
  const storage = payload?.riskHistory.storage;
  if (storage?.pageSource === "DATABASE" && storage.pageReadState === "DATABASE_PAGE_RESPONSE_VERIFIED") {
    return copy.storageDurable;
  }
  if (storage?.pageSource === "MEMORY" && storage.pageReadState === "RUNTIME_PAGE_ONLY") {
    return copy.storageRuntime;
  }
  return copy.storageUnknown;
}

function eventLabel(type: RiskHistoryEventType, locale: Locale) {
  return COPY[locale].event[type];
}

function alignmentMessage(state: RiskHistoryCurrentAlignmentState, locale: Locale) {
  return COPY[locale].alignment[state];
}

function alignmentTone(state: RiskHistoryCurrentAlignmentState) {
  return state === "ALIGNED_SAME_OBSERVATION"
    ? "border-emerald-200/[0.14] bg-emerald-200/[0.035] text-emerald-100/[0.74]"
    : state === "HISTORY_EMPTY" || state === "CURRENT_NEWER_COMPARABLE"
      ? "border-cyan-200/[0.12] bg-cyan-200/[0.03] text-cyan-100/[0.68]"
      : "border-amber-200/[0.15] bg-amber-200/[0.04] text-amber-100/[0.78]";
}

function EventSummary({
  row,
  locale,
  compact = false,
}: {
  row: RiskHistoryCustomerRoutePayload["riskHistory"]["history"][number];
  locale: Locale;
  compact?: boolean;
}) {
  const copy = COPY[locale];
  return (
    <li className="border-l border-white/[0.10] pl-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <time className="font-mono text-[9px] uppercase tracking-[0.10em] text-white/[0.38]" dateTime={row.observedAt}>
          {formatDate(row.observedAt, locale)} UTC
        </time>
        <span className={`font-mono text-[10px] font-semibold ${scoreTone(row.score)}`}>
          {copy.score} {row.score}/100
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-white/[0.72]">
        {row.eventTypes.slice(0, compact ? 1 : 3).map((type) => eventLabel(type, locale)).join(" · ")}
      </p>
      {!compact ? (
        <p className="mt-1 font-mono text-[9px] text-white/[0.38]">
          {copy.confidence}: {row.confidence === null ? copy.unknownConfidence : `${row.confidence.toFixed(0)}%`}
          {row.comparableToPrevious ? ` · ${copy.comparable}` : ` · ${copy.incomparable}`}
        </p>
      ) : null}
    </li>
  );
}

function RiskCalculationSchematic({ locale, currentScore }: { locale: Locale; currentScore?: number | null }) {
  return (
    <div className="mt-4">
      <RiskCalculationWaterfallFork
        locale={locale}
        currentScore={currentScore}
        className="border-cyan-400/25 bg-gradient-to-b from-[#091316]/95 to-[#05080a]/95"
      />
    </div>
  );
}

function RiskHistoryChart({
  history,
  currentScore,
  locale,
  large = false,
  timeframe = "24h",
}: {
  history: RiskHistoryCustomerRoutePayload["riskHistory"]["history"];
  currentScore: number | null;
  locale: Locale;
  large?: boolean;
  timeframe?: "1h" | "24h" | "30d";
}) {
  const width = large ? 720 : 280;
  const height = large ? 180 : 88;
  const pad = large ? 16 : 8;

  // Filter history points according to selected timeframe
  const filteredHistory = useMemo(() => {
    if (!history.length) return [];
    const now = Date.now();
    const cutoff =
      timeframe === "1h" ? now - 3600 * 1000 :
      timeframe === "24h" ? now - 24 * 3600 * 1000 :
      now - 30 * 24 * 3600 * 1000;
    const subset = history.filter((h) => Date.parse(h.observedAt) >= cutoff);
    return subset.length >= 2 ? subset : history;
  }, [history, timeframe]);

  // Compute authentic coordinates from real history observations
  const { pointsString, coordinates, pathD } = useMemo(() => {
    if (!filteredHistory.length) {
      return { pointsString: "", coordinates: [], pathD: "" };
    }
    const timestamps = filteredHistory.map((row) => Date.parse(row.observedAt));
    const minTime = timestamps[0]!;
    const maxTime = timestamps[timestamps.length - 1]!;
    const timeSpan = maxTime - minTime || 1;
    const innerWidth = width - pad * 2;
    const innerHeight = height - pad * 2;

    const coords = filteredHistory.map((row, idx) => {
      const timeRatio = filteredHistory.length === 1 ? 0.5 : (timestamps[idx]! - minTime) / timeSpan;
      const x = pad + timeRatio * innerWidth;
      const y = pad + ((100 - Math.min(100, Math.max(0, row.score))) / 100) * innerHeight;
      return { x, y, row };
    });

    const ptsStr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const pathD = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`, "");
    return { pointsString: ptsStr, coordinates: coords, pathD };
  }, [filteredHistory, width, height, pad]);

  const [hoveredCoord, setHoveredCoord] = useState<{
    x: number;
    y: number;
    row: RiskHistoryCustomerRoutePayload["riskHistory"]["history"][number];
  } | null>(null);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!coordinates.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    let closest = coordinates[0]!;
    let minDist = Math.abs(closest.x - mouseX);
    for (let i = 1; i < coordinates.length; i++) {
      const dist = Math.abs(coordinates[i]!.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = coordinates[i]!;
      }
    }
    setHoveredCoord(closest);
  };

  const xLabels = timeframe === "1h"
    ? (locale === "pl" ? ["-60m", "-45m", "-30m", "-15m", "Teraz"] : ["-60m", "-45m", "-30m", "-15m", "Now"])
    : timeframe === "30d"
      ? (locale === "pl" ? ["-30d", "-21d", "-14d", "-7d", "Dziś"] : ["-30d", "-21d", "-14d", "-7d", "Today"])
      : (locale === "pl" ? ["-24h", "-18h", "-12h", "-6h", "Teraz"] : ["-24h", "-18h", "-12h", "-6h", "Now"]);

  if (!pointsString && coordinates.length === 0) {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.01] p-3 text-center">
        <p className="font-mono text-[10px] text-white/50">
          {locale === "pl" ? "Oczekiwanie na kolejne okno obserwacyjne w ledgerze" : "Awaiting next observation window in risk ledger"}
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full select-none">
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={large ? "h-44 w-full overflow-visible" : "h-[5.5rem] w-full overflow-visible"}
          role="img"
          aria-label="Risk history chart"
          preserveAspectRatio="none"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredCoord(null)}
        >
          <defs>
            <linearGradient id={`riskGrad-${large ? "lg" : "sm"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <line x1="0" y1={height * 0.15} x2={width} y2={height * 0.15} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 4" />
          <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 4" />
          <line x1="0" y1={height * 0.85} x2={width} y2={height * 0.85} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 4" />

          {/* Shaded Area */}
          {pointsString && coordinates.length >= 2 ? (
            <motion.polygon
              points={`0,${height} ${pointsString} ${width},${height}`}
              fill={`url(#riskGrad-${large ? "lg" : "sm"})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            />
          ) : null}

          {/* Animated slowly-forming Risk Path */}
          {pathD ? (
            <motion.path
              d={pathD}
              fill="none"
              stroke="#2dd4bf"
              strokeWidth={large ? 2.5 : 1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
              className="drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]"
            />
          ) : pointsString ? (
            <polyline
              points={pointsString}
              fill="none"
              stroke="#2dd4bf"
              strokeWidth={large ? 2.5 : 1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]"
            />
          ) : null}

          {/* Observation dots popping sequentially */}
          {coordinates.map((c, i) => (
            <motion.circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={large ? 2.5 : 2}
              fill="#2dd4bf"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.75 }}
              transition={{ duration: 0.3, delay: 0.2 + (i / Math.max(coordinates.length, 1)) * 1.1 }}
            />
          ))}

          {/* Active Hover Crosshair and Target Node */}
          {hoveredCoord ? (
            <g>
              <line
                x1={hoveredCoord.x}
                y1={0}
                x2={hoveredCoord.x}
                y2={height}
                stroke="#2dd4bf"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.7}
              />
              <circle
                cx={hoveredCoord.x}
                cy={hoveredCoord.y}
                r={large ? 5 : 4}
                fill="#2dd4bf"
                stroke="#0b0d10"
                strokeWidth={2}
                className="drop-shadow-[0_0_10px_rgba(45,212,191,0.9)]"
              />
            </g>
          ) : null}
        </svg>

        {/* Hover Tooltip Popup with Date, Score, Level, and Confidence */}
        {hoveredCoord ? (
          <div
            className="pointer-events-none absolute z-30 rounded-lg border border-cyan-400/40 bg-[#070e11]/95 px-2.5 py-1.5 font-mono shadow-xl backdrop-blur-md"
            style={{
              left: `${Math.max(8, Math.min(width - (large ? 170 : 140), hoveredCoord.x - (large ? 85 : 70)))}px`,
              top: `${Math.max(4, hoveredCoord.y - (large ? 56 : 46))}px`,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-cyan-200">
                {hoveredCoord.row.score}/100
              </span>
              <span className="text-[8px] uppercase tracking-wider text-white/60">
                {hoveredCoord.row.level}
              </span>
            </div>
            <div className="text-[8px] text-white/50">
              {formatDate(hoveredCoord.row.observedAt, locale)} UTC
            </div>
          </div>
        ) : null}

        {/* Y-axis risk height scale */}
        <div className="pointer-events-none absolute right-1.5 top-1 bottom-1 flex flex-col justify-between font-mono text-[7px] text-white/[0.38] text-right">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
      </div>

      {/* X-axis time timeline */}
      <div className="mt-1 flex items-center justify-between font-mono text-[8px] uppercase tracking-wider text-white/[0.42] px-1">
        {xLabels.map((lbl, idx) => (
          <span key={idx}>{lbl}</span>
        ))}
      </div>
    </div>
  );
}

function RiskHistoryControlStateful({
  assetId,
  assetName,
  symbol,
  currentObservation,
  locale,
  enabled,
  variant = "cell",
}: RiskHistoryControlProps) {
  const copy = COPY[locale];
  const dialogId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const previewId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [olderLoadState, setOlderLoadState] = useState<LoadState>("idle");
  const [pages, setPages] = useState<RiskHistoryCustomerRoutePayload[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ left: 12, top: 12, above: false });
  const [selectedTimeframe, setSelectedTimeframe] = useState<"1h" | "24h" | "30d">("24h");
  const [showSchematic, setShowSchematic] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const available = enabled;
  const payload = pages[0] ?? null;
  const mergedView = useMemo(() => {
    try {
      return mergeRiskHistoryCustomerPages(pages);
    } catch {
      return null;
    }
  }, [pages]);
  const history = useMemo(
    () => mergedView?.history ?? payload?.riskHistory.history ?? [],
    [mergedView?.history, payload?.riskHistory.history],
  );
  const segments = mergedView?.segments ?? payload?.riskHistory.segments ?? [];
  const historyLimitReached = Boolean(
    mergedView?.hasOlder
    && mergedView.observations >= RISK_HISTORY_CUSTOMER_MAX_MERGED_EVENTS,
  );
  const canLoadOlder = Boolean(mergedView?.hasOlder && !historyLimitReached);
  const visibleTrackingStartedAt = mergedView?.trackingStartedAt ?? payload?.riskHistory.trackingStartedAt ?? null;
  const historyAssetCanonicalId = mergedView?.asset.canonicalAssetId
    ?? payload?.riskHistory.asset.canonicalAssetId
    ?? null;
  const alignment = useMemo(() => alignRiskHistoryCurrentObservation({
    current: currentObservation,
    historyAssetCanonicalId,
    history,
  }), [currentObservation, historyAssetCanonicalId, history]);
  const currentScore = alignment.currentDisplayAllowed && alignment.current.score !== null
    ? alignment.current.score
    : (typeof currentObservation.score === "number" && Number.isFinite(currentObservation.score)
      ? currentObservation.score
      : null);
  const latestStored = alignment.historyDisplayAllowed ? alignment.latestHistory : null;
  const recent = history.slice(-3).reverse();
  const dialogTitle = `${copy.title} · ${symbol}`;

  const closeDialog = useCallback(() => setDialogOpen(false), []);
  useDialogFocusBoundary(dialogOpen, dialogRef, {
    onClose: closeDialog,
    initialFocus: closeRef,
    returnFocus: true,
  });

  const load = useCallback(async (force = false) => {
    if (!available || inFlightRef.current || (!force && (pages.length > 0 || loadState === "error"))) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    inFlightRef.current = true;
    setLoadState("loading");
    setOlderLoadState("idle");
    try {
      const next = await fetchRiskHistoryCustomerPayload({ assetId, signal: controller.signal });
      if (controller.signal.aborted) return;
      setPages([next]);
      setLoadState("loaded");
    } catch {
      if (controller.signal.aborted) return;
      setPages([]);
      setLoadState("error");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        inFlightRef.current = false;
      }
    }
  }, [assetId, available, loadState, pages.length]);

  const loadOlder = useCallback(async () => {
    const before = mergedView?.nextBefore ?? null;
    const remainingCapacity = RISK_HISTORY_CUSTOMER_MAX_MERGED_EVENTS - (mergedView?.observations ?? 0);
    const pageLimit = Math.min(RISK_HISTORY_CUSTOMER_MAX_EVENTS, remainingCapacity);
    if (!available || !before || pageLimit < 1 || inFlightRef.current || olderLoadState === "loading") return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    inFlightRef.current = true;
    setOlderLoadState("loading");
    try {
      const next = await fetchRiskHistoryCustomerPayload({ assetId, before, limit: pageLimit, signal: controller.signal });
      if (controller.signal.aborted) return;
      const candidate = [...pages, next];
      if (!mergeRiskHistoryCustomerPages(candidate)) throw new Error("risk_history_older_page_empty");
      setPages(candidate);
      setOlderLoadState("loaded");
    } catch {
      if (controller.signal.aborted) return;
      setOlderLoadState("error");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        inFlightRef.current = false;
      }
    }
  }, [assetId, available, mergedView?.nextBefore, mergedView?.observations, olderLoadState, pages]);

  const updatePopoverPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect || typeof window === "undefined") return;
    const width = Math.min(340, window.innerWidth - 24);
    const estimatedHeight = 360;
    const margin = 12;

    const left = Math.min(
      Math.max(margin, rect.left + rect.width / 2 - width / 2),
      Math.max(margin, window.innerWidth - width - margin),
    );

    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const above = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    let top: number;
    if (above) {
      top = Math.max(margin, rect.top - 10);
    } else {
      top = Math.min(window.innerHeight - estimatedHeight - margin, rect.bottom + 10);
    }

    setPopoverPosition({ left, top, above });
  }, []);

  useEffect(() => () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightRef.current = false;
  }, []);

  useEffect(() => {
    if (!previewOpen) return undefined;
    updatePopoverPosition();
    const update = () => updatePopoverPosition();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [previewOpen, updatePopoverPosition]);

  useEffect(() => {
    if (!dialogOpen) return undefined;
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prior;
    };
  }, [dialogOpen]);

  const ariaLabel = currentScore === null
    ? `${assetName}: ${copy.open}. ${copy.currentUnavailable}`
    : `${assetName}: ${copy.open}. ${copy.current}: ${formatScore(currentScore, locale, 0)}. ${copy.asOf}: ${formatDate(alignment.current.observedAt, locale)} UTC`;

  if (!available) {
    return (
      <span className={`inline-flex items-center justify-center gap-1 font-mono text-xs font-semibold ${scoreTone(currentScore)}`} aria-label={ariaLabel}>
        {currentScore !== null ? <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" /> : null}
        {formatScore(currentScore, locale)}
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={variant === "mobile"
          ? `inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 ${scorePillClasses(currentScore)}`
          : `inline-flex h-7 min-h-7 shrink-0 items-center justify-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap transition-all hover:scale-105 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 ${scorePillClasses(currentScore)}`}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={dialogOpen}
        aria-controls={dialogOpen ? dialogId : undefined}
        aria-describedby={previewOpen ? previewId : undefined}
        data-velmere-risk-history-trigger="verified-customer-projection-only"
        onPointerEnter={(event: ReactPointerEvent<HTMLButtonElement>) => {
          if (event.pointerType === "mouse" || event.pointerType === "pen") {
            if (previewTimerRef.current) {
              clearTimeout(previewTimerRef.current);
              previewTimerRef.current = null;
            }
            setPreviewOpen(true);
            updatePopoverPosition();
            void load();
          }
        }}
        onPointerLeave={() => {
          if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
          previewTimerRef.current = setTimeout(() => {
            setPreviewOpen(false);
          }, 180);
        }}
        onFocus={() => {
          setPreviewOpen(true);
          updatePopoverPosition();
          void load();
        }}
        onBlur={() => {
          if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
          previewTimerRef.current = setTimeout(() => {
            setPreviewOpen(false);
          }, 180);
        }}
        onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => event.stopPropagation()}
        onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => event.stopPropagation()}
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          event.stopPropagation();
          setPreviewOpen(false);
          setDialogOpen(true);
          void load();
        }}
      >
        <span className="inline-flex items-center gap-1">
          {currentScore !== null ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
          {formatScore(currentScore, locale, 0)}
        </span>
        {variant === "mobile" ? (
          <span className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.52]">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.title}
          </span>
        ) : <History className="ml-0.5 h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />}
      </button>

      {previewOpen ? (
        <BodyPortal>
          <aside
            id={previewId}
            className="pointer-events-auto fixed z-[80] w-[min(340px,calc(100vw-24px))] max-h-[min(480px,calc(100vh-24px))] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#0b0d10]/[0.98] p-4 text-left text-white shadow-[0_24px_80px_rgba(0,0,0,0.62)] backdrop-blur-xl"
            style={{
              left: popoverPosition.left,
              top: popoverPosition.top,
              transform: popoverPosition.above ? "translateY(-100%)" : undefined,
            }}
            aria-live="polite"
            data-risk-history-popover="compact-customer-safe"
            onMouseEnter={() => {
              if (previewTimerRef.current) {
                clearTimeout(previewTimerRef.current);
                previewTimerRef.current = null;
              }
            }}
            onMouseLeave={() => {
              setPreviewOpen(false);
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-cyan-100/[0.58]">{copy.title}</p>
                <strong className="mt-1 block text-sm text-white">{assetName} · {symbol}</strong>
              </div>
              <span className={`font-mono text-sm ${scoreTone(currentScore)}`}>
                {formatScore(currentScore, locale, 0)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5" data-risk-history-score-role="current-table">
                <span className="block font-mono text-[8px] uppercase tracking-[0.10em] text-white/[0.36]">{copy.current}</span>
                <strong className={`mt-1 block font-mono text-xs ${scoreTone(currentScore)}`}>{formatScore(currentScore, locale, 0)}</strong>
                <time className="mt-1 block font-mono text-[8px] leading-4 text-white/[0.34]" dateTime={alignment.current.observedAt ?? undefined}>{copy.asOf} {formatDate(alignment.current.observedAt, locale)} UTC</time>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5" data-risk-history-score-role="latest-stored">
                <span className="block font-mono text-[8px] uppercase tracking-[0.10em] text-white/[0.36]">{copy.latestStored}</span>
                <strong className={`mt-1 block font-mono text-xs ${scoreTone(latestStored?.score ?? currentScore)}`}>{formatScore(latestStored?.score ?? currentScore, locale, 0)}</strong>
                <time className="mt-1 block font-mono text-[8px] leading-4 text-white/[0.34]" dateTime={latestStored?.observedAt ?? alignment.current.observedAt ?? undefined}>{copy.asOf} {formatDate(latestStored?.observedAt ?? alignment.current.observedAt ?? null, locale)} UTC</time>
              </div>
            </div>
            {loadState === "loaded" ? <p className={`mt-3 rounded-xl border px-3 py-2 text-[10px] leading-4 ${alignmentTone(alignment.state)}`} data-risk-history-current-alignment={alignment.state}>{alignmentMessage(alignment.state, locale)}</p> : null}
            {loadState === "loading" ? (
              <p className="mt-4 flex items-center gap-2 text-xs text-white/[0.62]"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{copy.loading}</p>
            ) : loadState === "error" ? (
              <p className="mt-4 flex items-center gap-2 text-xs text-amber-100/[0.78]"><AlertTriangle className="h-4 w-4" aria-hidden="true" />{copy.error}</p>
            ) : (
              <>
                <div className="mt-3 text-cyan-200/[0.88]"><RiskHistoryChart history={history} currentScore={currentScore} locale={locale} timeframe="24h" /></div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
                  <p className="font-mono text-[9px] text-white/[0.38]">{copy.open}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewOpen(false);
                      setShowSchematic(true);
                      setDialogOpen(true);
                      void load();
                    }}
                    className="inline-flex items-center gap-1 font-mono text-[9px] text-cyan-300 hover:text-cyan-100 transition uppercase tracking-wider"
                  >
                    <Sparkles className="h-3 w-3 text-cyan-400" />
                    <span>{locale === "pl" ? "Jak obliczamy" : "Calculation flow"}</span>
                  </button>
                </div>
              </>
            )}
          </aside>
        </BodyPortal>
      ) : null}

      {dialogOpen ? (
        <BodyPortal>
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/[0.76] p-0 backdrop-blur-md sm:items-center sm:p-5"
            role="presentation"
            onClick={(event: ReactMouseEvent<HTMLDivElement>) => {
              if (event.target === event.currentTarget) closeDialog();
            }}
            onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
              if (event.target === event.currentTarget) closeDialog();
            }}
          >
            <section
              id={dialogId}
              ref={dialogRef}
              className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-[1.75rem] border border-white/[0.12] bg-[#090b0e] p-5 text-white shadow-[0_32px_120px_rgba(0,0,0,0.72)] sm:rounded-[1.75rem] sm:p-7"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              tabIndex={-1}
              data-risk-history-dialog="expanded-customer-safe"
              onClick={(event: ReactMouseEvent<HTMLElement>) => event.stopPropagation()}
              onPointerDown={(event: ReactPointerEvent<HTMLElement>) => event.stopPropagation()}
            >
              <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100/[0.54]">Velmère Risk Indicator</p>
                  <h2 id={titleId} className="mt-2 text-xl font-semibold tracking-[-0.02em] sm:text-2xl">{dialogTitle}</h2>
                  <p id={descriptionId} className="mt-2 max-w-2xl text-sm leading-6 text-white/[0.55]">{mergedView?.completeVisibleHistory ? copy.completeTimeline : copy.boundedWindow} {copy.notProbability}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowSchematic((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-2 font-mono text-[10px] uppercase font-bold tracking-[0.12em] text-cyan-200 transition hover:bg-cyan-400/20 shadow-[0_0_12px_rgba(45,212,191,0.2)]"
                    aria-expanded={showSchematic}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                    <span>{locale === "pl" ? "Jak obliczamy to ryzyko" : "How Velmère calculates this risk"}</span>
                    {showSchematic ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  <button ref={closeRef} type="button" onClick={closeDialog} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-white/[0.72] transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60" aria-label={copy.close}>
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </header>

              {showSchematic ? (
                <RiskCalculationSchematic locale={locale} currentScore={currentScore} />
              ) : null}

              {loadState === "loading" ? (
                <div className="mt-8 flex min-h-48 items-center justify-center gap-3 text-sm text-white/[0.62]" role="status"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />{copy.loading}</div>
              ) : loadState === "error" ? (
                <div className="mt-8 rounded-2xl border border-amber-200/[0.15] bg-amber-200/[0.04] p-5" role="alert">
                  <p className="flex items-center gap-2 text-sm text-amber-100/[0.78]"><AlertTriangle className="h-5 w-5" aria-hidden="true" />{copy.error}</p>
                  <button type="button" onClick={() => void load(true)} className="mt-4 min-h-11 rounded-full border border-white/[0.12] px-4 font-mono text-[9px] uppercase tracking-[0.13em] text-white/[0.72] hover:bg-white/[0.05]">{copy.retry}</button>
                </div>
              ) : payload?.riskHistory.status === "AVAILABLE" ? (
                <>
                  <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4" data-risk-history-score-role="current-table">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.38]">{copy.current}</span>
                      <strong className={`mt-2 block text-2xl ${scoreTone(currentScore)}`}>{formatScore(currentScore, locale, 0)}</strong>
                      <time className="mt-2 block font-mono text-[9px] leading-5 text-white/[0.38]" dateTime={alignment.current.observedAt ?? undefined}>{copy.asOf} {formatDate(alignment.current.observedAt, locale)} UTC</time>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4" data-risk-history-score-role="latest-stored">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.38]">{copy.latestStored}</span>
                      <strong className={`mt-2 block text-2xl ${scoreTone(latestStored?.score ?? null)}`}>{formatScore(latestStored?.score ?? null, locale, 0)}</strong>
                      <time className="mt-2 block font-mono text-[9px] leading-5 text-white/[0.38]" dateTime={latestStored?.observedAt}>{copy.asOf} {formatDate(latestStored?.observedAt ?? null, locale)} UTC</time>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.38]">{copy.observations}</span><strong className="mt-2 block text-2xl text-white">{mergedView?.observations ?? payload.riskHistory.observations}</strong></div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.38]">{copy.segments}</span><strong className="mt-2 block text-2xl text-white">{segments.length}</strong></div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.38]">{visibleTrackingStartedAt ? copy.trackedSince : copy.visibleFrom}</span><strong className="mt-2 block text-sm leading-6 text-white">{formatDate(visibleTrackingStartedAt ?? history[0]?.observedAt ?? null, locale)} UTC</strong></div>
                  </div>
                  <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs leading-5 ${alignmentTone(alignment.state)}`} role={alignment.disclosureRequired ? "status" : undefined} data-risk-history-current-alignment={alignment.state}>
                    {alignmentMessage(alignment.state, locale)}
                  </div>
                  {/* Timeframe Selector & Chart */}
                  <div className="mt-5 rounded-2xl border border-cyan-200/[0.10] bg-cyan-300/[0.025] p-5 text-cyan-200/[0.88]">
                    <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/[0.06]">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
                        {locale === "pl" ? "Dynamika zmian wskaźnika ryzyka" : "Risk Index Trajectory"}
                      </span>
                      <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/[0.08]">
                        {(["1h", "24h", "30d"] as const).map((tf) => (
                          <button
                            key={tf}
                            type="button"
                            onClick={() => setSelectedTimeframe(tf)}
                            className={`px-3 py-1 rounded-lg font-mono text-[10px] uppercase font-bold transition-all ${
                              selectedTimeframe === tf
                                ? "bg-cyan-400/20 text-cyan-200 border border-cyan-400/30 shadow-[0_0_10px_rgba(45,212,191,0.2)]"
                                : "text-white/40 hover:text-white/70"
                            }`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>
                    <RiskHistoryChart history={history} currentScore={currentScore} locale={locale} large timeframe={selectedTimeframe} />
                  </div>
                  <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-3 text-xs text-white/[0.52]"><Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />{storageLabel(payload, locale)}</div>
                  <section className="mt-7" aria-labelledby={`${titleId}-segments`}>
                    <h3 id={`${titleId}-segments`} className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/[0.48]">{copy.segments}</h3>
                    <ol className="mt-3 grid gap-3 sm:grid-cols-2">
                      {segments.map((segment, index) => (
                        <li key={segment.comparabilityKey} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <strong className="text-sm text-white">#{index + 1}</strong>
                            <span className="font-mono text-[9px] text-cyan-100/[0.58]">{copy.scoreVersion} {shortVersion(segment.scoreVersion)}</span>
                          </div>
                          <p className="mt-2 font-mono text-[9px] leading-5 text-white/[0.40]">{formatDate(segment.startedAt, locale)} UTC → {formatDate(segment.endedAt, locale)} UTC</p>
                          <p className="mt-2 text-[11px] leading-5 text-white/[0.58]">{segment.comparableWithPreviousSegment ? copy.comparable : index === 0 ? (visibleTrackingStartedAt ? copy.startsAtTracking : copy.boundedWindow) : copy.incomparable}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                  <section className="mt-7" aria-labelledby={`${titleId}-timeline`}>
                    <h3 id={`${titleId}-timeline`} className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/[0.48]">{copy.fullTimeline}</h3>
                    <ol className="mt-4 space-y-5">{[...history].reverse().map((row) => <EventSummary key={row.eventReference} row={row} locale={locale} />)}</ol>
                    {canLoadOlder ? (
                      <div className="mt-6">
                        <button
                          type="button"
                          onClick={() => void loadOlder()}
                          disabled={olderLoadState === "loading"}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-200/[0.18] px-4 font-mono text-[9px] uppercase tracking-[0.13em] text-cyan-100/[0.76] transition hover:bg-cyan-200/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 disabled:cursor-wait disabled:opacity-55"
                        >
                          {olderLoadState === "loading" ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <History className="h-4 w-4" aria-hidden="true" />}
                          {olderLoadState === "loading" ? copy.loadingOlder : copy.loadOlder}
                        </button>
                        {olderLoadState === "error" ? <p className="mt-3 text-xs text-amber-100/[0.72]" role="alert">{copy.olderUnavailable}</p> : null}
                      </div>
                    ) : historyLimitReached ? <p className="mt-4 text-xs leading-5 text-amber-100/[0.66]" role="status">{copy.historyLimitReached}</p> : null}
                  </section>
                  <div className="mt-7 space-y-2 border-t border-white/[0.08] pt-5 text-xs leading-5 text-white/[0.44]">
                    <p>{mergedView?.completeVisibleHistory ? copy.completeTimeline : copy.boundedWindow}</p><p>{copy.historyRounding}</p><p>{copy.notProbability}</p>
                  </div>
                </>
              ) : (
                <div className="mt-8 space-y-4" role="status">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4" data-risk-history-score-role="current-table">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.38]">{copy.current}</span>
                      <strong className={`mt-2 block text-2xl ${scoreTone(currentScore)}`}>{formatScore(currentScore, locale, 0)}</strong>
                      <time className="mt-2 block font-mono text-[9px] leading-5 text-white/[0.38]" dateTime={alignment.current.observedAt ?? undefined}>{copy.asOf} {formatDate(alignment.current.observedAt, locale)} UTC</time>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4" data-risk-history-score-role="latest-stored">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.38]">{copy.latestStored}</span>
                      <strong className={`mt-2 block text-2xl ${scoreTone(latestStored?.score ?? currentScore)}`}>{formatScore(latestStored?.score ?? currentScore, locale, 0)}</strong>
                      <time className="mt-2 block font-mono text-[9px] leading-5 text-white/[0.38]" dateTime={latestStored?.observedAt}>{copy.asOf} {formatDate(latestStored?.observedAt ?? null, locale)} UTC</time>
                    </div>
                  </div>
                  {/* Interactive Dynamic Trajectory Chart */}
                  <div className="mt-5 rounded-2xl border border-cyan-200/[0.10] bg-cyan-300/[0.025] p-5 text-cyan-200/[0.88]">
                    <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/[0.06]">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
                        {locale === "pl" ? "Dynamika zmian wskaźnika ryzyka" : "Risk Index Trajectory"}
                      </span>
                      <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/[0.08]">
                        {(["1h", "24h", "30d"] as const).map((tf) => (
                          <button
                            key={tf}
                            type="button"
                            onClick={() => setSelectedTimeframe(tf)}
                            className={`px-3 py-1 rounded-lg font-mono text-[10px] uppercase font-bold transition-all ${
                              selectedTimeframe === tf
                                ? "bg-cyan-400/20 text-cyan-200 border border-cyan-400/30 shadow-[0_0_10px_rgba(45,212,191,0.2)]"
                                : "text-white/40 hover:text-white/70"
                            }`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>
                    <RiskHistoryChart history={[]} currentScore={currentScore} locale={locale} large timeframe={selectedTimeframe} />
                  </div>
                </div>
              )}
            </section>
          </div>
        </BodyPortal>
      ) : null}
    </>
  );
}

export default function RiskHistoryControl(props: RiskHistoryControlProps) {
  const stateKey = `${props.assetId}:${props.enabled ? "enabled" : "disabled"}`;
  return <RiskHistoryControlStateful key={stateKey} {...props} />;
}
