export type Pass4489Locale = "pl" | "en" | "de";
export type Pass4489AnalysisTier = "Basic" | "Pro" | "Advanced" | null;
export type Pass4489AuditKind = "website" | "repo" | "contract" | "unknown";
export type Pass4489AuditTier = "basic" | "pro" | "advanced";

export type Pass4489RailItem = {
  label: string;
  value: string;
  state: "ready" | "watch" | "locked";
};

const copy = {
  pl: {
    badge: "PASS4489",
    analysisTitle: "VLM Analysis · keyboard safe",
    analysisHint: "Użyj ↑/↓ albo Home/End. Escape zamyka menu, bez zamykania całego drawera.",
    menuOpen: "menu otwarte",
    menuClosed: "menu zamknięte",
    activeTier: "Aktywny tier",
    gate: "Bramka",
    gateVisible: "widoczna",
    gateClean: "czysta",
    filterTitle: "Filtry · keyboard safe",
    filterHint: "←/→ oraz Home/End zmieniają aktywny filtr bez gubienia focusu i bez starego zakresu tabeli.",
    filter: "Filtr",
    result: "Wynik",
    keyboard: "Klawiatura",
    auditTitle: "Customer deliverables",
    auditSubtitle: "Użytkownik widzi, co realnie dostanie przed wysłaniem zgłoszenia; zakres reaguje na typ inputu i plan.",
    report: "Raport",
    sources: "Źródła",
    queue: "Kolejka",
    delivery: "Dostawa",
    valid: "gotowe",
    invalid: "uzupełnij input",
    queued: "staged",
    waiting: "czeka",
  },
  en: {
    badge: "PASS4489",
    analysisTitle: "VLM Analysis · keyboard safe",
    analysisHint: "Use ↑/↓ or Home/End. Escape closes the menu without closing the whole drawer.",
    menuOpen: "menu open",
    menuClosed: "menu closed",
    activeTier: "Active tier",
    gate: "Gate",
    gateVisible: "visible",
    gateClean: "clean",
    filterTitle: "Filters · keyboard safe",
    filterHint: "←/→ and Home/End change the active filter without losing focus or showing a stale table range.",
    filter: "Filter",
    result: "Result",
    keyboard: "Keyboard",
    auditTitle: "Customer deliverables",
    auditSubtitle: "The customer can see what will actually be delivered before submission; scope follows input type and tier.",
    report: "Report",
    sources: "Sources",
    queue: "Queue",
    delivery: "Delivery",
    valid: "ready",
    invalid: "complete input",
    queued: "staged",
    waiting: "waiting",
  },
  de: {
    badge: "PASS4489",
    analysisTitle: "VLM Analysis · keyboard safe",
    analysisHint: "↑/↓ oder Home/End nutzen. Escape schließt das Menü, nicht den ganzen Drawer.",
    menuOpen: "Menü offen",
    menuClosed: "Menü geschlossen",
    activeTier: "Aktiver Tier",
    gate: "Gate",
    gateVisible: "sichtbar",
    gateClean: "klar",
    filterTitle: "Filter · keyboard safe",
    filterHint: "←/→ und Home/End wechseln den aktiven Filter ohne Focus-Verlust oder alte Tabellenbereiche.",
    filter: "Filter",
    result: "Ergebnis",
    keyboard: "Tastatur",
    auditTitle: "Customer Deliverables",
    auditSubtitle: "Der Kunde sieht vor dem Absenden, was wirklich geliefert wird; Umfang folgt Input-Typ und Plan.",
    report: "Bericht",
    sources: "Quellen",
    queue: "Queue",
    delivery: "Delivery",
    valid: "bereit",
    invalid: "Input ergänzen",
    queued: "staged",
    waiting: "wartet",
  },
} as const;

function safeLocale(locale: string): Pass4489Locale {
  return locale === "pl" || locale === "de" ? locale : "en";
}

function auditKindLabel(locale: Pass4489Locale, kind: Pass4489AuditKind) {
  const labels: Record<Pass4489Locale, Record<Pass4489AuditKind, string>> = {
    pl: { website: "strona", repo: "repo", contract: "kontrakt", unknown: "unknown" },
    en: { website: "website", repo: "repo", contract: "contract", unknown: "unknown" },
    de: { website: "Website", repo: "Repo", contract: "Contract", unknown: "unknown" },
  };
  return labels[locale][kind];
}

function tierReportLabel(locale: Pass4489Locale, tier: Pass4489AuditTier) {
  const labels: Record<Pass4489Locale, Record<Pass4489AuditTier, string>> = {
    pl: { basic: "brief + ryzyka", pro: "findings + priorytety", advanced: "pełny PDF + manual queue" },
    en: { basic: "brief + risks", pro: "findings + priorities", advanced: "full PDF + manual queue" },
    de: { basic: "Brief + Risiken", pro: "Findings + Prioritäten", advanced: "volles PDF + Manual Queue" },
  };
  return labels[locale][tier];
}

function sourceScope(locale: Pass4489Locale, kind: Pass4489AuditKind, tier: Pass4489AuditTier) {
  const advanced = tier === "advanced";
  const pro = tier === "pro" || advanced;
  const values: Record<Pass4489Locale, Record<Pass4489AuditKind, string>> = {
    pl: {
      website: pro ? "headers + DNS + OSINT" : "headers + domena",
      repo: pro ? "repo + dependencies + surface" : "README + pliki publiczne",
      contract: advanced ? "source + holders + liquidity + exploit path" : pro ? "source + holders + liquidity" : "ABI/source check",
      unknown: "wymagany input",
    },
    en: {
      website: pro ? "headers + DNS + OSINT" : "headers + domain",
      repo: pro ? "repo + dependencies + surface" : "README + public files",
      contract: advanced ? "source + holders + liquidity + exploit path" : pro ? "source + holders + liquidity" : "ABI/source check",
      unknown: "input required",
    },
    de: {
      website: pro ? "Header + DNS + OSINT" : "Header + Domain",
      repo: pro ? "Repo + Dependencies + Surface" : "README + Public Files",
      contract: advanced ? "Source + Holder + Liquidität + Exploit Path" : pro ? "Source + Holder + Liquidität" : "ABI/Source Check",
      unknown: "Input erforderlich",
    },
  };
  return values[locale][kind];
}

export function buildPass4489AnalysisMenuState(input: {
  locale: string;
  menuOpen: boolean;
  activeTier: Pass4489AnalysisTier;
  gated: boolean;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  return {
    title: t.analysisTitle,
    hint: t.analysisHint,
    badge: t.badge,
    state: input.menuOpen ? "ready" : "watch",
    items: [
      { label: "Menu", value: input.menuOpen ? t.menuOpen : t.menuClosed, state: input.menuOpen ? "ready" : "watch" },
      { label: t.activeTier, value: input.activeTier ?? "—", state: input.activeTier ? "ready" : "watch" },
      { label: t.gate, value: input.gated ? t.gateVisible : t.gateClean, state: input.gated ? "locked" : "ready" },
    ] satisfies Pass4489RailItem[],
  };
}

export function buildPass4489ShieldProFilterKeyboardState(input: {
  locale: string;
  activeFilterLabel: string;
  visibleCount: number;
  totalCount: number;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  return {
    title: t.filterTitle,
    hint: t.filterHint,
    badge: t.badge,
    items: [
      { label: t.filter, value: input.activeFilterLabel, state: "ready" },
      { label: t.result, value: `${input.visibleCount}/${input.totalCount}`, state: input.visibleCount > 0 ? "ready" : "watch" },
      { label: t.keyboard, value: "← / → / Home / End", state: "ready" },
    ] satisfies Pass4489RailItem[],
  };
}

export function buildPass4489AuditDeliverableRail(input: {
  locale: string;
  kind: Pass4489AuditKind;
  tier: Pass4489AuditTier;
  valid: boolean;
  queued: boolean;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  return {
    title: t.auditTitle,
    subtitle: t.auditSubtitle,
    badge: t.badge,
    state: input.valid ? (input.queued ? "ready" : "watch") : "locked",
    items: [
      { label: t.report, value: tierReportLabel(locale, input.tier), state: input.valid ? "ready" : "watch" },
      { label: t.sources, value: `${auditKindLabel(locale, input.kind)} · ${sourceScope(locale, input.kind, input.tier)}`, state: input.valid ? "ready" : "watch" },
      { label: t.queue, value: input.queued ? t.queued : t.waiting, state: input.queued ? "ready" : "locked" },
      { label: t.delivery, value: input.valid ? t.valid : t.invalid, state: input.valid ? "ready" : "locked" },
    ] satisfies Pass4489RailItem[],
  };
}
