export type Pass4483Locale = "pl" | "en" | "de";

export type Pass4483RailItem = {
  label: string;
  value: string;
  state: "live" | "watch" | "missing" | "queued";
};

export type Pass4483SourceHealthInput = {
  locale: string;
  surface: "shield" | "real-markets" | "market";
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  timeframeLabel: string;
  chartIsLoading: boolean;
  queueCount: number;
};

export type Pass4483AuditDeliveryInput = {
  locale: string;
  inputKind: string;
  selectedTier: string;
  intakeIsValid: boolean;
  intakeQueued: boolean;
  fingerprint: string;
};

const copy = {
  pl: {
    sourceTitle: "Stan źródeł",
    sourceSubtitle: "Czysty podgląd przed wykresem; pełne receipty zostają w QA.",
    sourceBadgeLive: "Źródło gotowe",
    sourceBadgeWatch: "Do sprawdzenia",
    source: "Źródło",
    freshness: "Czas",
    chart: "Wykres",
    range: "Zakres",
    pending: "oczekuje",
    loading: "ładowanie",
    stable: "stabilny",
    locks: "blokady",
    noLocks: "bez blokad",
    auditTitle: "Ścieżka dostawy",
    auditSubtitle: "Intake → tier → case vault → receipt → raport. Frontend nie udaje płatnej dostawy.",
    auditBadgeQueued: "w kolejce",
    auditBadgeReady: "gotowe do wysłania",
    auditBadgeBlocked: "wymaga inputu",
    input: "Input",
    tier: "Plan",
    vault: "Case vault",
    receipt: "Receipt",
    queued: "zakolejkowane",
    staged: "stage",
    blocked: "blokada",
  },
  en: {
    sourceTitle: "Source health",
    sourceSubtitle: "Clean pre-chart status; full receipts stay inside QA.",
    sourceBadgeLive: "Source ready",
    sourceBadgeWatch: "Review needed",
    source: "Source",
    freshness: "Time",
    chart: "Chart",
    range: "Range",
    pending: "pending",
    loading: "loading",
    stable: "stable",
    locks: "locks",
    noLocks: "no locks",
    auditTitle: "Delivery path",
    auditSubtitle: "Intake → tier → case vault → receipt → report. The frontend does not fake paid delivery.",
    auditBadgeQueued: "queued",
    auditBadgeReady: "ready to submit",
    auditBadgeBlocked: "input required",
    input: "Input",
    tier: "Tier",
    vault: "Case vault",
    receipt: "Receipt",
    queued: "queued",
    staged: "staged",
    blocked: "blocked",
  },
  de: {
    sourceTitle: "Quellenstatus",
    sourceSubtitle: "Sauberer Status vor dem Chart; volle Receipts bleiben im QA-Bereich.",
    sourceBadgeLive: "Quelle bereit",
    sourceBadgeWatch: "Prüfung nötig",
    source: "Quelle",
    freshness: "Zeit",
    chart: "Chart",
    range: "Bereich",
    pending: "ausstehend",
    loading: "lädt",
    stable: "stabil",
    locks: "Sperren",
    noLocks: "keine Sperren",
    auditTitle: "Lieferpfad",
    auditSubtitle: "Intake → Tier → Case Vault → Receipt → Report. Das Frontend täuscht keine bezahlte Lieferung vor.",
    auditBadgeQueued: "in Warteschlange",
    auditBadgeReady: "sendebereit",
    auditBadgeBlocked: "Input nötig",
    input: "Input",
    tier: "Plan",
    vault: "Case Vault",
    receipt: "Receipt",
    queued: "eingereiht",
    staged: "bereitgestellt",
    blocked: "blockiert",
  },
} as const;

export function pass4483Locale(locale: string): Pass4483Locale {
  return locale === "pl" || locale === "de" ? locale : "en";
}

export function buildPass4483AssetSourceHealth(input: Pass4483SourceHealthInput) {
  const t = copy[pass4483Locale(input.locale)];
  const sourceReady = Boolean(input.sourceLabel);
  const timeReady = Boolean(input.sourceTimeLabel);
  const chartReady = !input.chartIsLoading;
  const healthy = sourceReady && timeReady && chartReady && input.queueCount === 0;
  const items: Pass4483RailItem[] = [
    {
      label: t.source,
      value: input.sourceLabel || t.pending,
      state: sourceReady ? "live" : "missing",
    },
    {
      label: t.freshness,
      value: input.sourceTimeLabel || t.pending,
      state: timeReady ? "live" : "watch",
    },
    {
      label: t.chart,
      value: input.chartIsLoading ? t.loading : t.stable,
      state: chartReady ? "live" : "watch",
    },
    {
      label: t.range,
      value: `${input.timeframeLabel} · ${input.queueCount ? `${input.queueCount} ${t.locks}` : t.noLocks}`,
      state: input.queueCount ? "watch" : "live",
    },
  ];
  return {
    title: t.sourceTitle,
    subtitle: t.sourceSubtitle,
    badge: healthy ? t.sourceBadgeLive : t.sourceBadgeWatch,
    tone: healthy ? "live" : "watch",
    surface: input.surface,
    items,
  };
}

export function buildPass4483AuditDeliveryRail(input: Pass4483AuditDeliveryInput) {
  const t = copy[pass4483Locale(input.locale)];
  const state = input.intakeQueued ? "queued" : input.intakeIsValid ? "live" : "missing";
  const items: Pass4483RailItem[] = [
    {
      label: t.input,
      value: input.inputKind,
      state: input.intakeIsValid ? "live" : "missing",
    },
    {
      label: t.tier,
      value: input.selectedTier,
      state: "live",
    },
    {
      label: t.vault,
      value: input.intakeQueued ? t.queued : input.intakeIsValid ? t.staged : t.blocked,
      state,
    },
    {
      label: t.receipt,
      value: input.intakeQueued ? input.fingerprint : input.intakeIsValid ? t.staged : t.blocked,
      state,
    },
  ];
  return {
    title: t.auditTitle,
    subtitle: t.auditSubtitle,
    badge: input.intakeQueued ? t.auditBadgeQueued : input.intakeIsValid ? t.auditBadgeReady : t.auditBadgeBlocked,
    state,
    items,
  };
}
