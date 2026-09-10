export type Pass4492Locale = "pl" | "en" | "de";
export type Pass4492State = "ready" | "watch" | "locked";
export type Pass4492AuditKind = "website" | "repo" | "contract" | "unknown";
export type Pass4492Tier = "basic" | "pro" | "advanced";

export type Pass4492RailItem = {
  label: string;
  value: string;
  state: Pass4492State;
};

const copy = {
  pl: {
    badge: "PASS4492",
    assetTitle: "Operator action plan",
    assetSubtitle: "Konkretna ścieżka po kliknięciu instrumentu: obserwuj, weryfikuj albo zablokuj głębszy wniosek do czasu proofu.",
    posture: "Posture",
    next: "Następny krok",
    proof: "Proof gap",
    route: "Route",
    monitor: "monitoruj",
    verify: "weryfikuj źródła",
    hold: "hold proof",
    advanced: "Advanced queue",
    pdf: "PDF after proof",
    source: "source-first",
    noTrade: "bez trade promptu",
    candles: "świece",
    timestamp: "timestamp",
    provider: "provider",
    none: "brak",
    shieldTitle: "Action queue",
    shieldSubtitle: "Widoczny zakres Shield Pro zamienia risk/evidence na kolejkę pracy operatora, bez sygnałów kierunkowych.",
    priority: "Priorytet",
    rows: "Wiersze",
    sourceAudit: "Source audit",
    escalation: "Escalation",
    highRisk: "high risk",
    lowEvidence: "low evidence",
    stable: "stabilny zakres",
    auditTitle: "Remediation guide",
    auditSubtitle: "Użytkownik widzi, co poprawić przed wysyłką audytu i co wydarzy się po staged receipt.",
    input: "Input",
    fix: "Popraw",
    submit: "Submit",
    delivery: "Delivery",
    pasteUrl: "wklej URL/repo/contract",
    readySubmit: "gotowe do kolejki",
    queued: "receipt staged",
    backend: "backend required",
  },
  en: {
    badge: "PASS4492",
    assetTitle: "Operator action plan",
    assetSubtitle: "A concrete route after opening an instrument: monitor, verify or hold deeper conclusions until proof exists.",
    posture: "Posture",
    next: "Next step",
    proof: "Proof gap",
    route: "Route",
    monitor: "monitor",
    verify: "verify sources",
    hold: "hold proof",
    advanced: "Advanced queue",
    pdf: "PDF after proof",
    source: "source-first",
    noTrade: "no trade prompt",
    candles: "candles",
    timestamp: "timestamp",
    provider: "provider",
    none: "none",
    shieldTitle: "Action queue",
    shieldSubtitle: "The visible Shield Pro range turns risk/evidence into an operator work queue without directional signals.",
    priority: "Priority",
    rows: "Rows",
    sourceAudit: "Source audit",
    escalation: "Escalation",
    highRisk: "high risk",
    lowEvidence: "low evidence",
    stable: "stable range",
    auditTitle: "Remediation guide",
    auditSubtitle: "The user sees what to fix before submit and what happens after the staged receipt.",
    input: "Input",
    fix: "Fix",
    submit: "Submit",
    delivery: "Delivery",
    pasteUrl: "paste URL/repo/contract",
    readySubmit: "ready to queue",
    queued: "receipt staged",
    backend: "backend required",
  },
  de: {
    badge: "PASS4492",
    assetTitle: "Operator Action Plan",
    assetSubtitle: "Konkrete Route nach dem Öffnen eines Instruments: monitoren, verifizieren oder stärkere Schlüsse bis zum Proof halten.",
    posture: "Posture",
    next: "Nächster Schritt",
    proof: "Proof Gap",
    route: "Route",
    monitor: "monitoren",
    verify: "Quellen prüfen",
    hold: "Proof halten",
    advanced: "Advanced Queue",
    pdf: "PDF nach Proof",
    source: "source-first",
    noTrade: "kein Trade-Prompt",
    candles: "Candles",
    timestamp: "Timestamp",
    provider: "Provider",
    none: "keine",
    shieldTitle: "Action Queue",
    shieldSubtitle: "Der sichtbare Shield-Pro-Bereich übersetzt Risk/Evidence in eine Operator-Queue ohne Directional Signals.",
    priority: "Priorität",
    rows: "Zeilen",
    sourceAudit: "Source Audit",
    escalation: "Escalation",
    highRisk: "High Risk",
    lowEvidence: "Low Evidence",
    stable: "stabiler Bereich",
    auditTitle: "Remediation Guide",
    auditSubtitle: "Nutzer sehen, was vor dem Submit zu korrigieren ist und was nach dem staged Receipt passiert.",
    input: "Input",
    fix: "Fix",
    submit: "Submit",
    delivery: "Delivery",
    pasteUrl: "URL/Repo/Contract einfügen",
    readySubmit: "bereit für Queue",
    queued: "Receipt staged",
    backend: "Backend erforderlich",
  },
} as const;

function safeLocale(locale: string): Pass4492Locale {
  return locale === "pl" || locale === "de" ? locale : "en";
}

function numericPercent(label?: string | null) {
  if (!label) return null;
  const match = label.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}

function stateLabel(state: Pass4492State, t: (typeof copy)[Pass4492Locale]) {
  if (state === "ready") return t.monitor;
  if (state === "watch") return t.verify;
  return t.hold;
}

export function buildPass4492AssetActionPlan(input: {
  locale: string;
  surface: string;
  riskLabel?: string | null;
  confidenceLabel?: string | null;
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  candleCount: number;
  remoteReady: boolean;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const risk = numericPercent(input.riskLabel) ?? (input.riskLabel?.toLowerCase().includes("high") ? 78 : 44);
  const confidence = numericPercent(input.confidenceLabel) ?? 58;
  const hasSource = Boolean(input.sourceLabel);
  const hasTimestamp = Boolean(input.sourceTimeLabel);
  const enoughCandles = input.candleCount >= 30;
  const missing = [
    !enoughCandles ? t.candles : null,
    !hasTimestamp ? t.timestamp : null,
    !(hasSource || input.remoteReady) ? t.provider : null,
  ].filter(Boolean) as string[];
  const state: Pass4492State = missing.length > 1 ? "locked" : risk >= 70 || confidence < 55 || missing.length ? "watch" : "ready";
  const next = state === "ready" ? t.monitor : state === "watch" ? t.verify : t.hold;
  const route = state === "ready" ? t.pdf : state === "watch" ? t.advanced : t.source;
  return {
    title: t.assetTitle,
    subtitle: t.assetSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.posture, value: stateLabel(state, t), state },
      { label: t.next, value: next, state },
      { label: t.proof, value: missing.length ? missing.join(" · ") : t.none, state: missing.length ? "watch" : "ready" },
      { label: t.route, value: `${input.surface} · ${route} · ${t.noTrade}`, state: state === "locked" ? "locked" : "ready" },
    ] satisfies Pass4492RailItem[],
  };
}

export function buildPass4492ShieldProActionQueue(input: {
  locale: string;
  visibleRows: Array<{ integrity: number; liquidity: number; manipulation: number; squeeze: number; evidence: number }>;
  totalCount: number;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const count = input.visibleRows.length;
  const highRisk = input.visibleRows.filter((row) => row.manipulation >= 55 || row.squeeze >= 68 || row.integrity < 68).length;
  const lowEvidence = input.visibleRows.filter((row) => row.evidence < 78).length;
  const sourceAudit = input.visibleRows.filter((row) => row.evidence < 82 || row.integrity < 72).length;
  const state: Pass4492State = count === 0 ? "locked" : highRisk || lowEvidence ? "watch" : "ready";
  const priority = highRisk ? t.highRisk : lowEvidence ? t.lowEvidence : t.stable;
  return {
    title: t.shieldTitle,
    subtitle: t.shieldSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.priority, value: priority, state },
      { label: t.rows, value: `${count}/${input.totalCount}`, state: count ? "ready" : "locked" },
      { label: t.sourceAudit, value: `${sourceAudit}`, state: sourceAudit ? "watch" : count ? "ready" : "locked" },
      { label: t.escalation, value: highRisk || lowEvidence ? t.advanced : t.monitor, state: highRisk || lowEvidence ? "watch" : "ready" },
    ] satisfies Pass4492RailItem[],
  };
}

export function buildPass4492AuditRemediationGuide(input: {
  locale: string;
  kind: Pass4492AuditKind;
  tier: Pass4492Tier;
  valid: boolean;
  queued: boolean;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const state: Pass4492State = !input.valid ? "locked" : input.queued ? "ready" : "watch";
  const delivery = input.queued ? (input.tier === "advanced" ? t.backend : t.queued) : input.valid ? t.readySubmit : t.pasteUrl;
  return {
    title: t.auditTitle,
    subtitle: t.auditSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.input, value: input.valid ? input.kind : t.pasteUrl, state: input.valid ? "ready" : "locked" },
      { label: t.fix, value: input.valid ? t.none : t.pasteUrl, state: input.valid ? "ready" : "locked" },
      { label: t.submit, value: input.queued ? t.queued : input.valid ? t.readySubmit : t.hold, state: input.queued ? "ready" : input.valid ? "watch" : "locked" },
      { label: t.delivery, value: delivery, state: input.queued ? (input.tier === "advanced" ? "watch" : "ready") : state },
    ] satisfies Pass4492RailItem[],
  };
}
