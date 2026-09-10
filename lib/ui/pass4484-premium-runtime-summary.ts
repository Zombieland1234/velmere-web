export type Pass4484Locale = "pl" | "en" | "de";
export type Pass4484RuntimeState = "live" | "watch" | "missing";

export type Pass4484RuntimeItem = {
  label: string;
  value: string;
  state: Pass4484RuntimeState;
};

export type Pass4484AssetRuntimeSummaryInput = {
  locale: string;
  surface: "shield" | "real-markets";
  symbol: string;
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  timeframeLabel: string;
  chartIsLoading: boolean;
  analysisMenuOpen: boolean;
};

export type Pass4484AuditConversionGuardInput = {
  locale: string;
  inputKind: string;
  selectedTier: string;
  intakeIsValid: boolean;
  intakeQueued: boolean;
  fingerprint: string;
};

const copy = {
  pl: {
    assetTitle: "Runtime summary",
    shield: "Shield",
    realMarkets: "Real Markets",
    chartFirst: "wykres pierwszy",
    source: "Źródło",
    freshness: "Świeżość",
    timeframe: "Zakres",
    analysis: "Analiza",
    ready: "gotowe",
    loading: "ładowanie",
    missing: "brak danych",
    qaHidden: "QA schowane",
    menuOpen: "menu otwarte",
    auditTitle: "Conversion guard",
    auditSubtitle: "Widoczny stan przed wysłaniem: input, plan, kolejka i receipt bez udawania backendu.",
    input: "Input",
    tier: "Plan",
    queue: "Kolejka",
    receipt: "Receipt",
    blocked: "zablokowane",
    staged: "staged",
    queued: "queued",
  },
  en: {
    assetTitle: "Runtime summary",
    shield: "Shield",
    realMarkets: "Real Markets",
    chartFirst: "chart first",
    source: "Source",
    freshness: "Freshness",
    timeframe: "Timeframe",
    analysis: "Analysis",
    ready: "ready",
    loading: "loading",
    missing: "missing data",
    qaHidden: "QA hidden",
    menuOpen: "menu open",
    auditTitle: "Conversion guard",
    auditSubtitle: "Visible pre-submit state: input, plan, queue and receipt without pretending the backend is complete.",
    input: "Input",
    tier: "Plan",
    queue: "Queue",
    receipt: "Receipt",
    blocked: "blocked",
    staged: "staged",
    queued: "queued",
  },
  de: {
    assetTitle: "Runtime Summary",
    shield: "Shield",
    realMarkets: "Real Markets",
    chartFirst: "Chart zuerst",
    source: "Quelle",
    freshness: "Aktualität",
    timeframe: "Zeitraum",
    analysis: "Analyse",
    ready: "bereit",
    loading: "lädt",
    missing: "Daten fehlen",
    qaHidden: "QA versteckt",
    menuOpen: "Menü offen",
    auditTitle: "Conversion Guard",
    auditSubtitle: "Sichtbarer Pre-submit-Status: Input, Plan, Queue und Beleg ohne Backend vorzutäuschen.",
    input: "Input",
    tier: "Plan",
    queue: "Queue",
    receipt: "Beleg",
    blocked: "blockiert",
    staged: "staged",
    queued: "queued",
  },
} as const;

export function pass4484Locale(locale: string): Pass4484Locale {
  return locale === "en" || locale === "de" ? locale : "pl";
}

function compact(value?: string | null, fallback = "—") {
  const clean = `${value ?? ""}`.trim();
  return clean.length ? clean : fallback;
}

export function buildPass4484AssetRuntimeSummary(input: Pass4484AssetRuntimeSummaryInput) {
  const t = copy[pass4484Locale(input.locale)];
  const hasSource = Boolean(input.sourceLabel);
  const hasFreshness = Boolean(input.sourceTimeLabel);
  const state: Pass4484RuntimeState = input.chartIsLoading ? "watch" : hasSource && hasFreshness ? "live" : "missing";
  const surfaceLabel = input.surface === "shield" ? t.shield : t.realMarkets;
  const badge = input.chartIsLoading ? t.loading : state === "live" ? t.ready : t.missing;
  const items: Pass4484RuntimeItem[] = [
    { label: surfaceLabel, value: t.chartFirst, state: "live" },
    { label: t.source, value: compact(input.sourceLabel, t.missing), state: hasSource ? "live" : "missing" },
    { label: t.freshness, value: compact(input.sourceTimeLabel, t.missing), state: hasFreshness ? "live" : "watch" },
    { label: t.timeframe, value: input.timeframeLabel, state: input.chartIsLoading ? "watch" : "live" },
    { label: t.analysis, value: input.analysisMenuOpen ? t.menuOpen : t.qaHidden, state: input.analysisMenuOpen ? "watch" : "live" },
  ];
  return {
    title: t.assetTitle,
    subtitle: `${input.symbol} · ${surfaceLabel} · ${t.chartFirst}`,
    badge,
    state,
    items,
  };
}

export function buildPass4484AuditConversionGuard(input: Pass4484AuditConversionGuardInput) {
  const t = copy[pass4484Locale(input.locale)];
  const receiptReady = input.intakeIsValid && input.fingerprint !== "—";
  const state: Pass4484RuntimeState = input.intakeQueued ? "live" : input.intakeIsValid ? "watch" : "missing";
  const badge = input.intakeQueued ? t.queued : input.intakeIsValid ? t.staged : t.blocked;
  const items: Pass4484RuntimeItem[] = [
    { label: t.input, value: input.inputKind, state: input.intakeIsValid ? "live" : "missing" },
    { label: t.tier, value: input.selectedTier, state: "live" },
    { label: t.queue, value: input.intakeQueued ? t.queued : input.intakeIsValid ? t.staged : t.blocked, state },
    { label: t.receipt, value: receiptReady ? input.fingerprint : t.blocked, state: receiptReady ? "watch" : "missing" },
  ];
  return { title: t.auditTitle, subtitle: t.auditSubtitle, badge, state, items };
}
