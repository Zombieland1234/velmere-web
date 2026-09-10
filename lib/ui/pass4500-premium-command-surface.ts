type Locale = "pl" | "en" | "de";
type CommandState = "ready" | "busy" | "copied" | "blocked";

type CopyState = "idle" | "copied" | "fallback";

const copy = {
  pl: {
    assetTitle: "Command surface",
    assetReady: "Akcje są gotowe, a wykres pozostaje pierwszym planem.",
    assetBusy: "Źródło jest sprawdzane — blokuję ponowny recheck do końca świec.",
    assetCopied: "Pakiet źródłowy skopiowany bez podbijania pewności analizy.",
    assetBlocked: "Źródło działa w fallbacku — PDF zostaje w kolejce, nie w automatycznej dostawie.",
    terminalTitle: "Command surface",
    terminalReady: "Widok jest gotowy do eksportu bez odsłaniania operator debugów.",
    terminalCopied: "Widoczny zakres został skopiowany jako pakiet klienta.",
    terminalBlocked: "Brak widocznych pozycji — eksport jest blokowany do zmiany filtra.",
    auditTitle: "Submit surface",
    auditReady: "Zgłoszenie jest gotowe do kolejki i receipt.",
    auditBusy: "Input jest poprawny — stage pokaże receipt przed płatną ścieżką.",
    auditCopied: "Pakiet audytu skopiowany z planem i fingerprintem.",
    auditBlocked: "Uzupełnij poprawny URL, repo albo kontrakt przed submit.",
    stateReady: "Gotowe",
    stateBusy: "W toku",
    stateCopied: "Skopiowano",
    stateBlocked: "Zablokowane",
    details: "Szczegóły techniczne",
    proof: "Proof",
    visible: "Widoczne",
    filter: "Filtr",
    plan: "Plan",
    queue: "Kolejka",
    live: "Live",
    fallback: "Fallback",
    locked: "Locked",
    staged: "Staged",
    waiting: "Waiting",
  },
  en: {
    assetTitle: "Command surface",
    assetReady: "Actions are ready while the chart stays as the first surface.",
    assetBusy: "The source is being checked — recheck is locked until candles return.",
    assetCopied: "The source packet was copied without overstating analysis confidence.",
    assetBlocked: "The source is in fallback — PDF stays queued, not auto-delivered.",
    terminalTitle: "Command surface",
    terminalReady: "The visible view is ready to export without exposing operator debug noise.",
    terminalCopied: "The visible scope was copied as a customer packet.",
    terminalBlocked: "No visible rows — export is blocked until filter/query changes.",
    auditTitle: "Submit surface",
    auditReady: "The request is ready for queue and receipt.",
    auditBusy: "The input is valid — staging will show a receipt before the paid path.",
    auditCopied: "The audit packet was copied with plan and fingerprint.",
    auditBlocked: "Enter a valid URL, repo or contract before submit.",
    stateReady: "Ready",
    stateBusy: "Working",
    stateCopied: "Copied",
    stateBlocked: "Blocked",
    details: "Technical details",
    proof: "Proof",
    visible: "Visible",
    filter: "Filter",
    plan: "Plan",
    queue: "Queue",
    live: "Live",
    fallback: "Fallback",
    locked: "Locked",
    staged: "Staged",
    waiting: "Waiting",
  },
  de: {
    assetTitle: "Command surface",
    assetReady: "Aktionen sind bereit, während der Chart im Vordergrund bleibt.",
    assetBusy: "Die Quelle wird geprüft — Recheck bleibt bis zu den Kerzen gesperrt.",
    assetCopied: "Das Quellenpaket wurde kopiert, ohne die Analyse-Sicherheit zu überzeichnen.",
    assetBlocked: "Die Quelle läuft im Fallback — PDF bleibt in der Queue, nicht in Auto-Lieferung.",
    terminalTitle: "Command surface",
    terminalReady: "Die sichtbare Ansicht ist exportbereit, ohne Operator-Debugs zu zeigen.",
    terminalCopied: "Der sichtbare Umfang wurde als Kundenpaket kopiert.",
    terminalBlocked: "Keine sichtbaren Zeilen — Export bleibt bis zur Filteränderung gesperrt.",
    auditTitle: "Submit surface",
    auditReady: "Die Anfrage ist bereit für Queue und Receipt.",
    auditBusy: "Der Input ist gültig — Staging zeigt vor dem Paid Path ein Receipt.",
    auditCopied: "Das Audit-Paket wurde mit Plan und Fingerprint kopiert.",
    auditBlocked: "Gib eine gültige URL, ein Repo oder einen Contract vor dem Submit ein.",
    stateReady: "Bereit",
    stateBusy: "Läuft",
    stateCopied: "Kopiert",
    stateBlocked: "Gesperrt",
    details: "Technische Details",
    proof: "Proof",
    visible: "Sichtbar",
    filter: "Filter",
    plan: "Plan",
    queue: "Queue",
    live: "Live",
    fallback: "Fallback",
    locked: "Locked",
    staged: "Staged",
    waiting: "Waiting",
  },
} as const;

function safeLocale(locale: string): Locale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function badge(c: (typeof copy)[Locale], state: CommandState) {
  if (state === "copied") return c.stateCopied;
  if (state === "busy") return c.stateBusy;
  if (state === "blocked") return c.stateBlocked;
  return c.stateReady;
}

function compact(value: string | number | null | undefined, fallback = "—") {
  const clean = String(value ?? "").trim();
  if (!clean) return fallback;
  return clean.length > 28 ? `${clean.slice(0, 25)}…` : clean;
}

export function buildPass4500AssetCommandSurface(input: {
  locale: string;
  chartIsLoading: boolean;
  remoteReady: boolean;
  copyState: CopyState;
  pdfQueueEnabled: boolean;
  refreshNonce: number;
}) {
  const c = copy[safeLocale(input.locale)];
  const state: CommandState = input.chartIsLoading
    ? "busy"
    : input.copyState === "copied"
      ? "copied"
      : input.remoteReady
        ? "ready"
        : "blocked";
  const subtitle = state === "busy" ? c.assetBusy : state === "copied" ? c.assetCopied : state === "blocked" ? c.assetBlocked : c.assetReady;
  return {
    title: c.assetTitle,
    subtitle,
    badge: badge(c, state),
    detailsLabel: c.details,
    state,
    packet: {
      pass: "PASS4500",
      surface: "asset-command-surface",
      state,
      refreshNonce: input.refreshNonce,
      source: input.remoteReady ? c.live : c.fallback,
      pdf: input.pdfQueueEnabled ? c.queue : c.locked,
    },
  };
}

export function buildPass4500ShieldProCommandSurface(input: {
  locale: string;
  visibleCount: number;
  totalCount: number;
  activeFilterLabel: string;
  sortLabel: string;
  copyState: CopyState;
}) {
  const c = copy[safeLocale(input.locale)];
  const state: CommandState = input.copyState === "copied" ? "copied" : input.visibleCount > 0 ? "ready" : "blocked";
  const subtitle = state === "copied" ? c.terminalCopied : state === "blocked" ? c.terminalBlocked : c.terminalReady;
  return {
    title: c.terminalTitle,
    subtitle,
    badge: badge(c, state),
    detailsLabel: c.details,
    state,
    items: [
      { label: c.visible, value: `${input.visibleCount}/${input.totalCount}` },
      { label: c.filter, value: compact(input.activeFilterLabel, "all") },
      { label: c.proof, value: input.visibleCount > 0 ? c.live : c.locked },
    ],
    packet: {
      pass: "PASS4500",
      surface: "shield-pro-command-surface",
      state,
      visibleCount: input.visibleCount,
      totalCount: input.totalCount,
      filter: input.activeFilterLabel,
      sort: input.sortLabel,
    },
  };
}

export function buildPass4500AuditCommandSurface(input: {
  locale: string;
  inputKindLabel: string;
  planLabel: string;
  valid: boolean;
  queued: boolean;
  copyState: CopyState;
}) {
  const c = copy[safeLocale(input.locale)];
  const state: CommandState = input.copyState === "copied" ? "copied" : input.queued ? "ready" : input.valid ? "busy" : "blocked";
  const subtitle = state === "copied" ? c.auditCopied : state === "ready" ? c.auditReady : state === "busy" ? c.auditBusy : c.auditBlocked;
  return {
    title: c.auditTitle,
    subtitle,
    badge: badge(c, state),
    detailsLabel: c.details,
    state,
    items: [
      { label: c.plan, value: compact(input.planLabel) },
      { label: c.filter, value: compact(input.inputKindLabel) },
      { label: c.queue, value: input.queued ? c.staged : input.valid ? c.waiting : c.locked },
    ],
    packet: {
      pass: "PASS4500",
      surface: "audit-command-surface",
      state,
      kind: input.inputKindLabel,
      plan: input.planLabel,
      queued: input.queued,
    },
  };
}
