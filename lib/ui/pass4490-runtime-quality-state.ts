export type Pass4490Locale = "pl" | "en" | "de";
export type Pass4490RailState = "ready" | "watch" | "locked";
export type Pass4490AuditKind = "website" | "repo" | "contract" | "unknown";
export type Pass4490AuditTier = "basic" | "pro" | "advanced";

export type Pass4490RailItem = {
  label: string;
  value: string;
  state: Pass4490RailState;
};

const copy = {
  pl: {
    badge: "PASS4490",
    assetTitle: "Jakość runtime",
    assetSubtitle: "Czy drawer ma wystarczająco świec i źródeł, zanim użytkownik odpali analizę lub PDF.",
    surface: "Rynek",
    source: "Źródło",
    candles: "Świece",
    timeframe: "Zakres",
    remote: "provider live",
    fallback: "fallback lokalny",
    loading: "ładowanie",
    ready: "gotowe",
    pending: "oczekuje",
    shieldTitle: "Coverage quality",
    shieldSubtitle: "Filtr i sortowanie pokazują realną jakość widocznego zakresu, nie ukryty pełny dataset.",
    visible: "Widoczne",
    avgIntegrity: "Avg integrity",
    highRisk: "High risk",
    lowEvidence: "Low evidence",
    auditTitle: "Delivery SLA",
    auditSubtitle: "Zakres dostawy jest pokazany bez obiecywania backendu: kolejka, receipt i manual review są jawne.",
    eta: "ETA",
    review: "Review",
    receipt: "Receipt",
    vault: "Case vault",
    blocked: "zablokowane",
    staged: "staged",
    manual: "manual review",
    instant: "instant preview",
    inputNeeded: "input wymagany",
  },
  en: {
    badge: "PASS4490",
    assetTitle: "Runtime quality",
    assetSubtitle: "Checks whether the drawer has enough candles and source context before analysis or PDF depth is started.",
    surface: "Surface",
    source: "Source",
    candles: "Candles",
    timeframe: "Range",
    remote: "live provider",
    fallback: "local fallback",
    loading: "loading",
    ready: "ready",
    pending: "pending",
    shieldTitle: "Coverage quality",
    shieldSubtitle: "Filter and sorting expose the quality of the visible range, not a hidden full dataset.",
    visible: "Visible",
    avgIntegrity: "Avg integrity",
    highRisk: "High risk",
    lowEvidence: "Low evidence",
    auditTitle: "Delivery SLA",
    auditSubtitle: "Delivery scope stays honest: queue, receipt and manual review are visible without pretending a backend is done.",
    eta: "ETA",
    review: "Review",
    receipt: "Receipt",
    vault: "Case vault",
    blocked: "blocked",
    staged: "staged",
    manual: "manual review",
    instant: "instant preview",
    inputNeeded: "input required",
  },
  de: {
    badge: "PASS4490",
    assetTitle: "Runtime-Qualität",
    assetSubtitle: "Prüft, ob der Drawer genug Candles und Source-Kontext hat, bevor Analyse oder PDF-Tiefe startet.",
    surface: "Surface",
    source: "Quelle",
    candles: "Candles",
    timeframe: "Bereich",
    remote: "Live Provider",
    fallback: "lokaler Fallback",
    loading: "lädt",
    ready: "bereit",
    pending: "wartet",
    shieldTitle: "Coverage Quality",
    shieldSubtitle: "Filter und Sortierung zeigen die Qualität des sichtbaren Bereichs, nicht einen versteckten Full Dataset.",
    visible: "Sichtbar",
    avgIntegrity: "Avg Integrity",
    highRisk: "High Risk",
    lowEvidence: "Low Evidence",
    auditTitle: "Delivery SLA",
    auditSubtitle: "Der Lieferumfang bleibt ehrlich: Queue, Receipt und Manual Review sind sichtbar, ohne Backend zu behaupten.",
    eta: "ETA",
    review: "Review",
    receipt: "Receipt",
    vault: "Case Vault",
    blocked: "blockiert",
    staged: "staged",
    manual: "Manual Review",
    instant: "Instant Preview",
    inputNeeded: "Input erforderlich",
  },
} as const;

function safeLocale(locale: string): Pass4490Locale {
  return locale === "pl" || locale === "de" ? locale : "en";
}

function pct(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(0)}%`;
}

export function buildPass4490AssetSourceQuality(input: {
  locale: string;
  surface: "Shield" | "Real Markets" | string;
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  candleCount: number;
  timeframeLabel: string;
  loading: boolean;
  remoteReady: boolean;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const enoughCandles = input.candleCount >= 30;
  const sourceReady = Boolean(input.sourceLabel);
  const timeReady = Boolean(input.sourceTimeLabel);
  const state: Pass4490RailState = input.loading ? "watch" : enoughCandles && sourceReady ? "ready" : "locked";
  return {
    title: t.assetTitle,
    subtitle: t.assetSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.surface, value: input.surface, state: "ready" },
      { label: t.source, value: sourceReady ? (input.sourceLabel as string) : t.pending, state: sourceReady ? "ready" : "watch" },
      { label: t.candles, value: input.loading ? t.loading : `${input.candleCount}`, state: enoughCandles ? "ready" : "watch" },
      { label: t.timeframe, value: `${input.timeframeLabel} · ${input.remoteReady ? t.remote : t.fallback}`, state: timeReady || input.remoteReady ? "ready" : "watch" },
    ] satisfies Pass4490RailItem[],
  };
}

export function buildPass4490ShieldProCoverageRail(input: {
  locale: string;
  visibleRows: Array<{ integrity: number; manipulation: number; squeeze: number; evidence: number }>;
  totalCount: number;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const count = input.visibleRows.length;
  const avgIntegrity = count ? input.visibleRows.reduce((sum, row) => sum + row.integrity, 0) / count : 0;
  const highRisk = input.visibleRows.filter((row) => row.manipulation >= 50 || row.squeeze >= 65 || row.integrity < 72).length;
  const lowEvidence = input.visibleRows.filter((row) => row.evidence < 82).length;
  return {
    title: t.shieldTitle,
    subtitle: t.shieldSubtitle,
    badge: t.badge,
    state: count > 0 ? "ready" : "locked",
    items: [
      { label: t.visible, value: `${count}/${input.totalCount}`, state: count > 0 ? "ready" : "locked" },
      { label: t.avgIntegrity, value: pct(avgIntegrity), state: avgIntegrity >= 80 ? "ready" : "watch" },
      { label: t.highRisk, value: `${highRisk}`, state: highRisk > 0 ? "watch" : "ready" },
      { label: t.lowEvidence, value: `${lowEvidence}`, state: lowEvidence > 0 ? "watch" : "ready" },
    ] satisfies Pass4490RailItem[],
  };
}

function etaFor(tier: Pass4490AuditTier, valid: boolean) {
  if (!valid) return "—";
  if (tier === "basic") return "24h";
  if (tier === "pro") return "24–48h";
  return "manual queue";
}

export function buildPass4490AuditSlaRail(input: {
  locale: string;
  kind: Pass4490AuditKind;
  tier: Pass4490AuditTier;
  valid: boolean;
  queued: boolean;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const readyState: Pass4490RailState = input.valid ? (input.queued ? "ready" : "watch") : "locked";
  return {
    title: t.auditTitle,
    subtitle: t.auditSubtitle,
    badge: t.badge,
    state: readyState,
    items: [
      { label: t.eta, value: input.valid ? etaFor(input.tier, input.valid) : t.inputNeeded, state: readyState },
      { label: t.review, value: input.tier === "advanced" ? t.manual : t.instant, state: input.valid ? "ready" : "locked" },
      { label: t.receipt, value: input.queued ? t.staged : t.blocked, state: input.queued ? "ready" : "watch" },
      { label: t.vault, value: input.valid ? input.kind : t.inputNeeded, state: input.valid ? "watch" : "locked" },
    ] satisfies Pass4490RailItem[],
  };
}
