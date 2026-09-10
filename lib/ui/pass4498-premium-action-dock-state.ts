type Locale = "pl" | "en" | "de";
type DockState = "ready" | "watch" | "locked";
type Tier = "basic" | "pro" | "advanced";

type DockItem = {
  label: string;
  value: string;
  state: DockState;
};

const copy = {
  pl: {
    assetTitle: "Action Dock",
    assetSubtitle: "Kopiuj bezpieczny pakiet, odśwież źródło albo kolejkuj PDF bez claimów ponad dowody.",
    copyPacket: "Kopiuj pakiet",
    copied: "Skopiowano pakiet",
    copyFallback: "Kopiowanie ręczne",
    recheck: "Odśwież źródło",
    pdfQueue: "Kolejkuj PDF",
    pdfLocked: "PDF wymaga proof",
    ready: "Gotowe",
    watch: "Weryfikuj",
    locked: "Blokada",
    source: "Źródło",
    candles: "Świece",
    timeframe: "Zakres",
    packet: "Pakiet",
    proof: "Proof",
    terminalTitle: "Terminal Action Dock",
    terminalSubtitle: "Eksport i kolejka działań liczone po aktualnym filtrze, query i sortowaniu.",
    visible: "Widoczne",
    review: "Review",
    exportState: "Eksport",
    auditTitle: "Submission Action Dock",
    auditSubtitle: "Formularz pokazuje gotowość zgłoszenia bez udawania backendowej dostawy.",
    plan: "Plan",
    input: "Input",
    queue: "Kolejka",
    receipt: "Receipt",
    submitReady: "Gotowe do kolejki",
    submitBlocked: "Uzupełnij input",
  },
  en: {
    assetTitle: "Action Dock",
    assetSubtitle: "Copy the safe packet, recheck the source, or queue PDF without claims beyond proof.",
    copyPacket: "Copy packet",
    copied: "Packet copied",
    copyFallback: "Manual copy needed",
    recheck: "Recheck source",
    pdfQueue: "Queue PDF",
    pdfLocked: "PDF needs proof",
    ready: "Ready",
    watch: "Verify",
    locked: "Locked",
    source: "Source",
    candles: "Candles",
    timeframe: "Range",
    packet: "Packet",
    proof: "Proof",
    terminalTitle: "Terminal Action Dock",
    terminalSubtitle: "Export and action queue are calculated from the current filter, query and sort state.",
    visible: "Visible",
    review: "Review",
    exportState: "Export",
    auditTitle: "Submission Action Dock",
    auditSubtitle: "The form shows submission readiness without pretending backend delivery exists.",
    plan: "Plan",
    input: "Input",
    queue: "Queue",
    receipt: "Receipt",
    submitReady: "Ready to queue",
    submitBlocked: "Complete input",
  },
  de: {
    assetTitle: "Action Dock",
    assetSubtitle: "Sicheres Paket kopieren, Quelle erneut prüfen oder PDF ohne Claims über den Proof hinaus vormerken.",
    copyPacket: "Paket kopieren",
    copied: "Paket kopiert",
    copyFallback: "Manuelles Kopieren nötig",
    recheck: "Quelle prüfen",
    pdfQueue: "PDF vormerken",
    pdfLocked: "PDF braucht Proof",
    ready: "Bereit",
    watch: "Prüfen",
    locked: "Gesperrt",
    source: "Quelle",
    candles: "Kerzen",
    timeframe: "Zeitraum",
    packet: "Paket",
    proof: "Proof",
    terminalTitle: "Terminal Action Dock",
    terminalSubtitle: "Export und Aktionsqueue werden aus aktuellem Filter, Query und Sortierung berechnet.",
    visible: "Sichtbar",
    review: "Review",
    exportState: "Export",
    auditTitle: "Submission Action Dock",
    auditSubtitle: "Das Formular zeigt Readiness, ohne Backend-Lieferung vorzutäuschen.",
    plan: "Plan",
    input: "Input",
    queue: "Queue",
    receipt: "Receipt",
    submitReady: "Bereit für Queue",
    submitBlocked: "Input ergänzen",
  },
} as const;

function safeLocale(locale: string): Locale {
  return locale === "en" || locale === "de" || locale === "pl" ? locale : "en";
}

function short(value: string | null | undefined, fallback: string) {
  const clean = String(value ?? "").trim();
  if (!clean) return fallback;
  return clean.length > 38 ? `${clean.slice(0, 35)}…` : clean;
}

export function buildPass4498AssetActionDock(input: {
  locale: string;
  symbol: string;
  name: string;
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  timeframe: string;
  candleCount: number;
  remoteReady: boolean;
  riskLabel?: string | null;
  confidenceLabel?: string | null;
}) {
  const l = safeLocale(input.locale);
  const c = copy[l];
  const hasSource = Boolean(input.sourceLabel);
  const hasCandles = input.candleCount >= 8;
  const proofReady = Boolean(input.remoteReady && hasSource && hasCandles);
  const state: DockState = proofReady ? "ready" : hasCandles ? "watch" : "locked";
  const badge = state === "ready" ? c.ready : state === "watch" ? c.watch : c.locked;
  const packet = {
    schema: "velmere.pass4498.asset-action-packet.v1",
    symbol: input.symbol,
    name: input.name,
    timeframe: input.timeframe,
    source: input.sourceLabel ?? "source_missing",
    sourceTime: input.sourceTimeLabel ?? "time_missing",
    candles: input.candleCount,
    remoteReady: input.remoteReady,
    risk: input.riskLabel ?? "not_scored",
    confidence: input.confidenceLabel ?? "not_capped",
    claimBoundary: proofReady ? "source_bound" : "limited_until_rechecked",
  } as const;
  const items: DockItem[] = [
    { label: c.source, value: short(input.sourceLabel, "missing"), state: hasSource ? "ready" : "locked" },
    { label: c.candles, value: String(input.candleCount), state: hasCandles ? "ready" : "locked" },
    { label: c.timeframe, value: input.timeframe, state: "ready" },
    { label: c.packet, value: proofReady ? "source-bound" : "limited", state },
  ];
  return {
    title: c.assetTitle,
    subtitle: c.assetSubtitle,
    badge,
    state,
    items,
    packet,
    copyPacket: c.copyPacket,
    copied: c.copied,
    copyFallback: c.copyFallback,
    recheck: c.recheck,
    pdfLabel: proofReady ? c.pdfQueue : c.pdfLocked,
    pdfQueueEnabled: proofReady,
  };
}

export function buildPass4498ShieldProActionDock(input: {
  locale: string;
  visibleCount: number;
  totalCount: number;
  activeFilterLabel: string;
  lowEvidenceCount: number;
  highRiskCount: number;
}) {
  const l = safeLocale(input.locale);
  const c = copy[l];
  const hasVisible = input.visibleCount > 0;
  const state: DockState = hasVisible ? (input.lowEvidenceCount > 0 ? "watch" : "ready") : "locked";
  return {
    title: c.terminalTitle,
    subtitle: c.terminalSubtitle,
    badge: state === "ready" ? c.ready : state === "watch" ? c.review : c.locked,
    state,
    items: [
      { label: c.visible, value: `${input.visibleCount}/${input.totalCount}`, state: hasVisible ? "ready" : "locked" },
      { label: "Filter", value: short(input.activeFilterLabel, "all"), state: "ready" },
      { label: c.review, value: `${input.lowEvidenceCount} evidence`, state: input.lowEvidenceCount > 0 ? "watch" : "ready" },
      { label: c.exportState, value: hasVisible ? "packet-ready" : "empty", state },
    ] satisfies DockItem[],
  };
}

export function buildPass4498AuditActionDock(input: {
  locale: string;
  tier: Tier;
  planLabel: string;
  inputKindLabel: string;
  valid: boolean;
  queued: boolean;
  fingerprint: string;
}) {
  const l = safeLocale(input.locale);
  const c = copy[l];
  const state: DockState = input.queued ? "ready" : input.valid ? "watch" : "locked";
  return {
    title: c.auditTitle,
    subtitle: c.auditSubtitle,
    badge: input.queued ? c.ready : input.valid ? c.submitReady : c.submitBlocked,
    state,
    items: [
      { label: c.plan, value: short(input.planLabel, input.tier), state: "ready" },
      { label: c.input, value: short(input.inputKindLabel, "unknown"), state: input.valid ? "ready" : "locked" },
      { label: c.queue, value: input.queued ? "staged" : "client-only", state },
      { label: c.receipt, value: input.fingerprint || "pending", state: input.queued ? "ready" : "watch" },
    ] satisfies DockItem[],
  };
}
