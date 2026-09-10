export type Pass4481Locale = "pl" | "en" | "de";
export type Pass4481Surface = "shield" | "real-markets" | "shield-pro" | "audit";
export type Pass4481InputKind = "website" | "repo" | "contract" | "unknown";
export type Pass4481State = "ready" | "watch" | "blocked" | "queued";

export type Pass4481AcceptanceRow = {
  label: string;
  value: string;
  state: Pass4481State;
};

export type Pass4481AcceptanceRail = {
  title: string;
  subtitle: string;
  badge: string;
  state: Pass4481State;
  rows: Pass4481AcceptanceRow[];
  blockers: string[];
};

const copy = {
  pl: {
    drawerTitle: "Acceptance state",
    drawerSubtitle: "Widoczny stan zgodności drawera z kontraktem ze screenów: prawa krawędź, wykres, źródło, klawiatura i safe-area.",
    auditTitle: "Submit readiness",
    auditSubtitle: "Widoczna maszyna stanu przed wysłaniem audytu: input, tier, fingerprint, case vault i receipt.",
    ready: "gotowe",
    watch: "do weryfikacji",
    blocked: "zablokowane",
    queued: "w kolejce klienta",
    chart: "Wykres",
    source: "Źródło",
    keyboard: "Klawiatura",
    close: "Zamykanie",
    analysis: "VLM Analysis",
    mobile: "Mobile",
    input: "Input",
    tier: "Plan",
    fingerprint: "Fingerprint",
    vault: "Case vault",
    receipt: "Receipt",
    missingSource: "brak widocznego source/timestamp",
    loadingChart: "świece jeszcze się ładują",
    unknownInput: "input nie jest URL/repo/kontraktem",
    serverRequired: "wymagany backend + receipt",
  },
  en: {
    drawerTitle: "Acceptance state",
    drawerSubtitle: "Visible state of the drawer against the screenshot contract: right edge, chart, source, keyboard and safe-area.",
    auditTitle: "Submit readiness",
    auditSubtitle: "Visible state machine before audit submission: input, tier, fingerprint, case vault and receipt.",
    ready: "ready",
    watch: "review",
    blocked: "blocked",
    queued: "client queued",
    chart: "Chart",
    source: "Source",
    keyboard: "Keyboard",
    close: "Close",
    analysis: "VLM Analysis",
    mobile: "Mobile",
    input: "Input",
    tier: "Tier",
    fingerprint: "Fingerprint",
    vault: "Case vault",
    receipt: "Receipt",
    missingSource: "missing visible source/timestamp",
    loadingChart: "candles still loading",
    unknownInput: "input is not URL/repo/contract",
    serverRequired: "backend + receipt required",
  },
  de: {
    drawerTitle: "Acceptance State",
    drawerSubtitle: "Sichtbarer Zustand des Drawers gegen den Screenshot-Vertrag: rechte Kante, Chart, Quelle, Tastatur und Safe-Area.",
    auditTitle: "Submit Readiness",
    auditSubtitle: "Sichtbare State Machine vor der Audit-Übermittlung: Input, Plan, Fingerprint, Case Vault und Beleg.",
    ready: "bereit",
    watch: "prüfen",
    blocked: "blockiert",
    queued: "Client-Warteschlange",
    chart: "Chart",
    source: "Quelle",
    keyboard: "Tastatur",
    close: "Schließen",
    analysis: "VLM Analysis",
    mobile: "Mobile",
    input: "Input",
    tier: "Plan",
    fingerprint: "Fingerprint",
    vault: "Case Vault",
    receipt: "Beleg",
    missingSource: "sichtbare Quelle/Zeit fehlt",
    loadingChart: "Kerzen laden noch",
    unknownInput: "Input ist keine URL/Repo/Contract",
    serverRequired: "Backend + Beleg erforderlich",
  },
} as const;

export function pass4481Locale(locale: string): Pass4481Locale {
  return locale === "pl" || locale === "de" ? locale : "en";
}

function stateLabel(locale: Pass4481Locale, state: Pass4481State) {
  const c = copy[locale];
  if (state === "ready") return c.ready;
  if (state === "queued") return c.queued;
  if (state === "blocked") return c.blocked;
  return c.watch;
}

export function buildPass4481AssetDrawerAcceptance(args: {
  locale: Pass4481Locale;
  surface: Pass4481Surface;
  symbol: string;
  chartIsLoading: boolean;
  hasChartData: boolean;
  hasSource: boolean;
  analysisMenuOpen: boolean;
}) : Pass4481AcceptanceRail {
  const c = copy[args.locale];
  const blockers: string[] = [];
  if (args.chartIsLoading) blockers.push(c.loadingChart);
  if (!args.hasSource) blockers.push(c.missingSource);
  const sourceState: Pass4481State = args.hasSource ? "ready" : "watch";
  const chartState: Pass4481State = args.chartIsLoading ? "watch" : args.hasChartData ? "ready" : "watch";
  const state: Pass4481State = blockers.length ? "watch" : "ready";
  return {
    title: c.drawerTitle,
    subtitle: c.drawerSubtitle,
    badge: `PASS4481 · ${args.surface} · ${args.symbol.toUpperCase()}`,
    state,
    blockers,
    rows: [
      { label: c.chart, value: stateLabel(args.locale, chartState), state: chartState },
      { label: c.source, value: stateLabel(args.locale, sourceState), state: sourceState },
      { label: c.keyboard, value: "Tab trap + focus return", state: "ready" },
      { label: c.close, value: "click-away + Escape", state: "ready" },
      { label: c.analysis, value: args.analysisMenuOpen ? "menu open / safe-area" : "footer safe-area", state: "ready" },
      { label: c.mobile, value: "100dvh / safe-area", state: "ready" },
    ],
  };
}

export function buildPass4481AuditSubmitState(args: {
  locale: Pass4481Locale;
  inputKind: Pass4481InputKind;
  normalizedInput: string;
  selectedTier: string;
  fingerprint: string;
  intakeIsValid: boolean;
  intakeQueued: boolean;
}) : Pass4481AcceptanceRail {
  const c = copy[args.locale];
  const blockers: string[] = [];
  if (!args.intakeIsValid || args.inputKind === "unknown") blockers.push(c.unknownInput);
  blockers.push(c.serverRequired);
  const inputState: Pass4481State = args.intakeIsValid ? "ready" : "blocked";
  const vaultState: Pass4481State = args.intakeQueued && args.intakeIsValid ? "queued" : "blocked";
  const state: Pass4481State = !args.intakeIsValid ? "blocked" : args.intakeQueued ? "queued" : "watch";
  return {
    title: c.auditTitle,
    subtitle: c.auditSubtitle,
    badge: `PASS4481 · ${args.inputKind.toUpperCase()} · ${args.selectedTier}`,
    state,
    blockers,
    rows: [
      { label: c.input, value: args.normalizedInput || "—", state: inputState },
      { label: c.tier, value: args.selectedTier, state: "ready" },
      { label: c.fingerprint, value: args.fingerprint, state: args.intakeIsValid ? "ready" : "watch" },
      { label: c.vault, value: stateLabel(args.locale, vaultState), state: vaultState },
      { label: c.receipt, value: c.serverRequired, state: "blocked" },
    ],
  };
}
