export type Pass4491Locale = "pl" | "en" | "de";
export type Pass4491State = "ready" | "watch" | "locked";
export type Pass4491AuditKind = "website" | "repo" | "contract" | "unknown";
export type Pass4491Tier = "basic" | "pro" | "advanced";

export type Pass4491RailItem = {
  label: string;
  value: string;
  state: Pass4491State;
};

const copy = {
  pl: {
    badge: "PASS4491",
    assetTitle: "Evidence readiness",
    assetSubtitle: "Czy analiza, PDF i płatna głębia mają minimalny proof przed pokazaniem mocniejszego wniosku.",
    analysis: "Analiza",
    pdf: "PDF",
    source: "Source",
    missing: "Braki",
    ready: "ready",
    watch: "watch",
    locked: "locked",
    none: "brak",
    candles: "świece",
    timestamp: "timestamp",
    provider: "provider",
    shieldTitle: "Evidence readiness",
    shieldSubtitle: "Widoczny zakres Shield Pro pokazuje, ile instrumentów ma wystarczającą evidencję do dalszej kolejki.",
    readyRows: "Gotowe",
    queuedRows: "Queue",
    avgEvidence: "Avg evidence",
    lowProof: "Low proof",
    auditTitle: "Evidence readiness",
    auditSubtitle: "Przed wysłaniem użytkownik widzi, co jest gotowe, co idzie do kolejki i czego backend musi jeszcze dostarczyć.",
    intake: "Input",
    checklist: "Checklist",
    receipt: "Receipt",
    delivery: "Delivery",
    queued: "queued",
    notQueued: "not queued",
    manualQueue: "manual queue",
    previewOnly: "preview only",
  },
  en: {
    badge: "PASS4491",
    assetTitle: "Evidence readiness",
    assetSubtitle: "Shows whether analysis, PDF and paid depth have enough proof before stronger conclusions are displayed.",
    analysis: "Analysis",
    pdf: "PDF",
    source: "Source",
    missing: "Missing",
    ready: "ready",
    watch: "watch",
    locked: "locked",
    none: "none",
    candles: "candles",
    timestamp: "timestamp",
    provider: "provider",
    shieldTitle: "Evidence readiness",
    shieldSubtitle: "The visible Shield Pro range shows how many instruments have enough evidence for the next queue.",
    readyRows: "Ready",
    queuedRows: "Queue",
    avgEvidence: "Avg evidence",
    lowProof: "Low proof",
    auditTitle: "Evidence readiness",
    auditSubtitle: "Before submit, the user sees what is ready, what is queued and what backend delivery still needs.",
    intake: "Input",
    checklist: "Checklist",
    receipt: "Receipt",
    delivery: "Delivery",
    queued: "queued",
    notQueued: "not queued",
    manualQueue: "manual queue",
    previewOnly: "preview only",
  },
  de: {
    badge: "PASS4491",
    assetTitle: "Evidence Readiness",
    assetSubtitle: "Zeigt, ob Analyse, PDF und Paid Depth genug Proof haben, bevor stärkere Aussagen sichtbar werden.",
    analysis: "Analyse",
    pdf: "PDF",
    source: "Quelle",
    missing: "Fehlt",
    ready: "ready",
    watch: "watch",
    locked: "locked",
    none: "keine",
    candles: "Candles",
    timestamp: "Timestamp",
    provider: "Provider",
    shieldTitle: "Evidence Readiness",
    shieldSubtitle: "Der sichtbare Shield-Pro-Bereich zeigt, wie viele Instrumente genug Evidence für die nächste Queue haben.",
    readyRows: "Ready",
    queuedRows: "Queue",
    avgEvidence: "Avg Evidence",
    lowProof: "Low Proof",
    auditTitle: "Evidence Readiness",
    auditSubtitle: "Vor dem Absenden sieht der Nutzer, was bereit ist, was in der Queue liegt und was Backend-Delivery noch braucht.",
    intake: "Input",
    checklist: "Checklist",
    receipt: "Receipt",
    delivery: "Delivery",
    queued: "queued",
    notQueued: "not queued",
    manualQueue: "manual queue",
    previewOnly: "preview only",
  },
} as const;

function safeLocale(locale: string): Pass4491Locale {
  return locale === "pl" || locale === "de" ? locale : "en";
}

function pct(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

function stateLabel(t: (typeof copy)[Pass4491Locale], state: Pass4491State) {
  if (state === "ready") return t.ready;
  if (state === "watch") return t.watch;
  return t.locked;
}

export function buildPass4491AssetEvidenceReadiness(input: {
  locale: string;
  surface: string;
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  candleCount: number;
  timeframeLabel: string;
  remoteReady: boolean;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const hasSource = Boolean(input.sourceLabel);
  const hasTimestamp = Boolean(input.sourceTimeLabel);
  const enoughCandles = input.candleCount >= 30;
  const hasProvider = input.remoteReady || hasSource;
  const missing = [
    !enoughCandles ? t.candles : null,
    !hasTimestamp ? t.timestamp : null,
    !hasProvider ? t.provider : null,
  ].filter(Boolean) as string[];
  const analysisState: Pass4491State = hasSource && input.candleCount >= 12 ? "ready" : input.candleCount > 1 ? "watch" : "locked";
  const pdfState: Pass4491State = hasSource && hasTimestamp && enoughCandles ? "ready" : hasSource ? "watch" : "locked";
  const overall: Pass4491State = analysisState === "ready" && pdfState === "ready" ? "ready" : analysisState === "locked" && pdfState === "locked" ? "locked" : "watch";
  return {
    title: t.assetTitle,
    subtitle: t.assetSubtitle,
    badge: t.badge,
    state: overall,
    missing: missing.length ? missing.join(" · ") : t.none,
    items: [
      { label: t.analysis, value: stateLabel(t, analysisState), state: analysisState },
      { label: t.pdf, value: stateLabel(t, pdfState), state: pdfState },
      { label: t.source, value: input.sourceLabel || input.surface, state: hasSource ? "ready" : "watch" },
      { label: t.missing, value: missing.length ? missing.join(" · ") : t.none, state: missing.length ? "watch" : "ready" },
    ] satisfies Pass4491RailItem[],
  };
}

export function buildPass4491ShieldProEvidenceReadiness(input: {
  locale: string;
  visibleRows: Array<{ integrity: number; manipulation: number; squeeze: number; evidence: number }>;
  totalCount: number;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const count = input.visibleRows.length;
  const readyRows = input.visibleRows.filter((row) => row.evidence >= 82 && row.integrity >= 72).length;
  const queuedRows = input.visibleRows.filter((row) => row.manipulation >= 50 || row.squeeze >= 65 || row.evidence < 82).length;
  const lowProof = input.visibleRows.filter((row) => row.evidence < 75 || row.integrity < 68).length;
  const avgEvidence = count ? input.visibleRows.reduce((sum, row) => sum + row.evidence, 0) / count : 0;
  const state: Pass4491State = count === 0 ? "locked" : lowProof > 0 || queuedRows > readyRows ? "watch" : "ready";
  return {
    title: t.shieldTitle,
    subtitle: t.shieldSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.readyRows, value: `${readyRows}/${input.totalCount}`, state: readyRows ? "ready" : "watch" },
      { label: t.queuedRows, value: `${queuedRows}`, state: queuedRows ? "watch" : "ready" },
      { label: t.avgEvidence, value: pct(avgEvidence), state: avgEvidence >= 82 ? "ready" : count ? "watch" : "locked" },
      { label: t.lowProof, value: `${lowProof}`, state: lowProof ? "watch" : count ? "ready" : "locked" },
    ] satisfies Pass4491RailItem[],
  };
}

export function buildPass4491AuditEvidenceReadiness(input: {
  locale: string;
  kind: Pass4491AuditKind;
  tier: Pass4491Tier;
  valid: boolean;
  queued: boolean;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const checklistState: Pass4491State = input.valid ? (input.kind === "unknown" ? "watch" : "ready") : "locked";
  const receiptState: Pass4491State = input.queued ? "ready" : input.valid ? "watch" : "locked";
  const deliveryState: Pass4491State = input.queued ? (input.tier === "advanced" ? "watch" : "ready") : "locked";
  const state: Pass4491State = input.valid && input.queued ? (input.tier === "advanced" ? "watch" : "ready") : input.valid ? "watch" : "locked";
  return {
    title: t.auditTitle,
    subtitle: t.auditSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.intake, value: input.valid ? input.kind : t.locked, state: input.valid ? "ready" : "locked" },
      { label: t.checklist, value: stateLabel(t, checklistState), state: checklistState },
      { label: t.receipt, value: input.queued ? t.queued : t.notQueued, state: receiptState },
      { label: t.delivery, value: input.tier === "advanced" ? t.manualQueue : t.previewOnly, state: deliveryState },
    ] satisfies Pass4491RailItem[],
  };
}
