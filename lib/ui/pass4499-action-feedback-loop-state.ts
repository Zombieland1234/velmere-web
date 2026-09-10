type Locale = "pl" | "en" | "de";
type FeedbackState = "ready" | "busy" | "copied" | "blocked";

type FeedbackItem = {
  label: string;
  value: string;
  state: FeedbackState;
};

const copy = {
  pl: {
    assetTitle: "Feedback loop",
    assetIdle: "Akcje są spięte z aktualnym wykresem — bez starego cache i bez fałszywego PDF.",
    assetBusy: "Źródło jest ponownie sprawdzane. Recheck jest blokowany do końca fetchu świec.",
    assetCopied: "Pakiet został skopiowany jako bezpieczna kopia źródłowa.",
    recheckIdle: "Odśwież źródło",
    recheckBusy: "Sprawdzam źródło…",
    copyIdle: "Kopiuj pakiet",
    copyCopied: "Skopiowano",
    copyFallback: "Kopiuj ręcznie",
    chart: "Wykres",
    packet: "Pakiet",
    refresh: "Recheck",
    pdf: "PDF",
    live: "Live",
    fallback: "Fallback",
    waiting: "Oczekuje",
    locked: "Blokada",
    terminalTitle: "Export feedback",
    terminalSubtitle: "Eksport i reset działają na dokładnie widocznym filtrze, query i sortowaniu.",
    terminalCopy: "Kopiuj widok",
    terminalCopied: "Widok skopiowany",
    terminalFallback: "Kopiuj ręcznie",
    terminalReset: "Wyczyść filtry",
    visible: "Widoczne",
    filter: "Filtr",
    sort: "Sort",
    exportState: "Eksport",
    auditTitle: "Submit feedback",
    auditSubtitle: "Stage, reset i kopia pakietu są widoczne przed płatną kolejką.",
    auditStage: "Stage request",
    auditCopy: "Kopiuj pakiet",
    auditCopied: "Pakiet skopiowany",
    auditFallback: "Kopiuj ręcznie",
    auditReset: "Wyczyść input",
    auditInput: "Input",
    auditPlan: "Plan",
    auditQueue: "Kolejka",
    auditReceipt: "Receipt",
  },
  en: {
    assetTitle: "Feedback loop",
    assetIdle: "Actions are tied to the current chart — no stale cache and no fake PDF delivery.",
    assetBusy: "The source is being rechecked. Recheck is locked until candle fetch completes.",
    assetCopied: "The packet was copied as a safe source-bound snapshot.",
    recheckIdle: "Recheck source",
    recheckBusy: "Rechecking…",
    copyIdle: "Copy packet",
    copyCopied: "Copied",
    copyFallback: "Manual copy",
    chart: "Chart",
    packet: "Packet",
    refresh: "Recheck",
    pdf: "PDF",
    live: "Live",
    fallback: "Fallback",
    waiting: "Waiting",
    locked: "Locked",
    terminalTitle: "Export feedback",
    terminalSubtitle: "Export and reset act on the exact visible filter, query and sort state.",
    terminalCopy: "Copy view",
    terminalCopied: "View copied",
    terminalFallback: "Manual copy",
    terminalReset: "Clear filters",
    visible: "Visible",
    filter: "Filter",
    sort: "Sort",
    exportState: "Export",
    auditTitle: "Submit feedback",
    auditSubtitle: "Stage, reset and packet copy are visible before the paid queue.",
    auditStage: "Stage request",
    auditCopy: "Copy packet",
    auditCopied: "Packet copied",
    auditFallback: "Manual copy",
    auditReset: "Clear input",
    auditInput: "Input",
    auditPlan: "Plan",
    auditQueue: "Queue",
    auditReceipt: "Receipt",
  },
  de: {
    assetTitle: "Feedback loop",
    assetIdle: "Aktionen sind an den aktuellen Chart gebunden — kein alter Cache und keine falsche PDF-Lieferung.",
    assetBusy: "Die Quelle wird erneut geprüft. Recheck bleibt bis zum Kerzen-Fetch gesperrt.",
    assetCopied: "Das Paket wurde als sichere quellengebundene Momentaufnahme kopiert.",
    recheckIdle: "Quelle prüfen",
    recheckBusy: "Prüfe…",
    copyIdle: "Paket kopieren",
    copyCopied: "Kopiert",
    copyFallback: "Manuell kopieren",
    chart: "Chart",
    packet: "Paket",
    refresh: "Recheck",
    pdf: "PDF",
    live: "Live",
    fallback: "Fallback",
    waiting: "Wartet",
    locked: "Gesperrt",
    terminalTitle: "Export feedback",
    terminalSubtitle: "Export und Reset greifen auf den exakt sichtbaren Filter-, Query- und Sortierzustand zu.",
    terminalCopy: "Ansicht kopieren",
    terminalCopied: "Ansicht kopiert",
    terminalFallback: "Manuell kopieren",
    terminalReset: "Filter löschen",
    visible: "Sichtbar",
    filter: "Filter",
    sort: "Sortierung",
    exportState: "Export",
    auditTitle: "Submit feedback",
    auditSubtitle: "Stage, Reset und Paketkopie sind vor der Paid Queue sichtbar.",
    auditStage: "Request vormerken",
    auditCopy: "Paket kopieren",
    auditCopied: "Paket kopiert",
    auditFallback: "Manuell kopieren",
    auditReset: "Input löschen",
    auditInput: "Input",
    auditPlan: "Plan",
    auditQueue: "Queue",
    auditReceipt: "Receipt",
  },
} as const;

function safeLocale(locale: string): Locale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function compact(value: string | number | null | undefined, fallback = "—") {
  const clean = String(value ?? "").trim();
  if (!clean) return fallback;
  return clean.length > 34 ? `${clean.slice(0, 31)}…` : clean;
}

export function buildPass4499AssetActionFeedback(input: {
  locale: string;
  chartIsLoading: boolean;
  remoteReady: boolean;
  refreshNonce: number;
  copyState: "idle" | "copied" | "fallback";
  pdfQueueEnabled: boolean;
}) {
  const c = copy[safeLocale(input.locale)];
  const state: FeedbackState = input.chartIsLoading
    ? "busy"
    : input.copyState === "copied"
      ? "copied"
      : input.remoteReady
        ? "ready"
        : "blocked";
  const subtitle = input.chartIsLoading ? c.assetBusy : input.copyState === "copied" ? c.assetCopied : c.assetIdle;
  const items: FeedbackItem[] = [
    { label: c.chart, value: input.remoteReady ? c.live : c.fallback, state: input.remoteReady ? "ready" : "blocked" },
    { label: c.packet, value: input.copyState === "copied" ? c.copyCopied : input.copyState === "fallback" ? c.copyFallback : c.waiting, state: input.copyState === "copied" ? "copied" : input.copyState === "fallback" ? "blocked" : "ready" },
    { label: c.refresh, value: input.chartIsLoading ? c.recheckBusy : `#${input.refreshNonce}`, state: input.chartIsLoading ? "busy" : "ready" },
    { label: c.pdf, value: input.pdfQueueEnabled ? c.live : c.locked, state: input.pdfQueueEnabled ? "ready" : "blocked" },
  ];
  return {
    title: c.assetTitle,
    subtitle,
    state,
    items,
    copyLabel: input.copyState === "copied" ? c.copyCopied : input.copyState === "fallback" ? c.copyFallback : c.copyIdle,
    recheckLabel: input.chartIsLoading ? c.recheckBusy : c.recheckIdle,
  };
}

export function buildPass4499ShieldProCommandFeedback(input: {
  locale: string;
  visibleCount: number;
  totalCount: number;
  activeFilterLabel: string;
  sortLabel: string;
  copyState: "idle" | "copied" | "fallback";
}) {
  const c = copy[safeLocale(input.locale)];
  const hasRows = input.visibleCount > 0;
  const state: FeedbackState = input.copyState === "copied" ? "copied" : hasRows ? "ready" : "blocked";
  return {
    title: c.terminalTitle,
    subtitle: c.terminalSubtitle,
    state,
    copyLabel: input.copyState === "copied" ? c.terminalCopied : input.copyState === "fallback" ? c.terminalFallback : c.terminalCopy,
    resetLabel: c.terminalReset,
    items: [
      { label: c.visible, value: `${input.visibleCount}/${input.totalCount}`, state: hasRows ? "ready" : "blocked" },
      { label: c.filter, value: compact(input.activeFilterLabel, "all"), state: "ready" },
      { label: c.sort, value: compact(input.sortLabel, "neutral"), state: "ready" },
      { label: c.exportState, value: state === "copied" ? c.terminalCopied : hasRows ? "packet-ready" : "empty", state },
    ] satisfies FeedbackItem[],
  };
}

export function buildPass4499AuditCommandFeedback(input: {
  locale: string;
  inputKindLabel: string;
  planLabel: string;
  valid: boolean;
  queued: boolean;
  fingerprint: string;
  copyState: "idle" | "copied" | "fallback";
}) {
  const c = copy[safeLocale(input.locale)];
  const state: FeedbackState = input.copyState === "copied" ? "copied" : input.queued ? "ready" : input.valid ? "busy" : "blocked";
  return {
    title: c.auditTitle,
    subtitle: c.auditSubtitle,
    state,
    stageLabel: c.auditStage,
    copyLabel: input.copyState === "copied" ? c.auditCopied : input.copyState === "fallback" ? c.auditFallback : c.auditCopy,
    resetLabel: c.auditReset,
    items: [
      { label: c.auditInput, value: compact(input.inputKindLabel, "unknown"), state: input.valid ? "ready" : "blocked" },
      { label: c.auditPlan, value: compact(input.planLabel), state: "ready" },
      { label: c.auditQueue, value: input.queued ? "staged" : input.valid ? "ready" : "blocked", state: input.queued ? "ready" : input.valid ? "busy" : "blocked" },
      { label: c.auditReceipt, value: compact(input.fingerprint || "pending"), state: input.queued ? "ready" : "busy" },
    ] satisfies FeedbackItem[],
  };
}
