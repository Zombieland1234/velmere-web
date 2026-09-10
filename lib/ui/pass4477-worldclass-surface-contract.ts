export type Pass4477Locale = "pl" | "en" | "de";
export type Pass4477Surface = "shield" | "real-markets" | "shield-pro" | "audit";

export type Pass4477ReceiptItem = {
  label: string;
  value: string;
  state: "locked" | "ready" | "review";
};

export type Pass4477AuditQueueRow = Pass4477ReceiptItem;

function queueState(value: boolean): Pass4477ReceiptItem["state"] {
  return value ? "ready" : "review";
}

function safeLocale(locale: string | undefined): Pass4477Locale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

const drawerCopy: Record<Pass4477Locale, {
  title: string;
  subtitle: string;
  clickAway: string;
  escape: string;
  scrollOwner: string;
  sourceBoundary: string;
  tierBoundary: string;
  mutedUtilities: string;
  chartParity: string;
  locked: string;
  ready: string;
  review: string;
}> = {
  pl: {
    title: "Paritet drawera",
    subtitle: "Klik poza panelem, Escape, scroll i źródła są spięte w jednym shellu.",
    clickAway: "Click-away",
    escape: "Escape",
    scrollOwner: "Scroll owner",
    sourceBoundary: "Source boundary",
    tierBoundary: "Basic / Pro / Advanced",
    mutedUtilities: "Angel / Intel muted",
    chartParity: "Chart parity",
    locked: "zablokowane",
    ready: "gotowe",
    review: "do kontroli",
  },
  en: {
    title: "Drawer parity",
    subtitle: "Click-away, Escape, scroll and sources are bound to one shell.",
    clickAway: "Click-away",
    escape: "Escape",
    scrollOwner: "Scroll owner",
    sourceBoundary: "Source boundary",
    tierBoundary: "Basic / Pro / Advanced",
    mutedUtilities: "Angel / Intel muted",
    chartParity: "Chart parity",
    locked: "locked",
    ready: "ready",
    review: "review",
  },
  de: {
    title: "Drawer-Parität",
    subtitle: "Click-away, Escape, Scroll und Quellen sind an eine Shell gebunden.",
    clickAway: "Click-away",
    escape: "Escape",
    scrollOwner: "Scroll Owner",
    sourceBoundary: "Source Boundary",
    tierBoundary: "Basic / Pro / Advanced",
    mutedUtilities: "Angel / Intel stumm",
    chartParity: "Chart-Parität",
    locked: "gesperrt",
    ready: "bereit",
    review: "Review",
  },
};

export function buildPass4477AssetDrawerReceipt(input: {
  locale?: string;
  surface: Pass4477Surface;
  symbol: string;
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
}) {
  const locale = safeLocale(input.locale);
  const c = drawerCopy[locale];
  const hasSource = Boolean(input.sourceLabel || input.sourceTimeLabel);
  const surfaceLabel = input.surface === "real-markets" ? "Real Markets" : input.surface === "shield-pro" ? "Shield Pro" : "Shield";
  const items: Pass4477ReceiptItem[] = [
    { label: c.clickAway, value: c.ready, state: "ready" },
    { label: c.escape, value: c.ready, state: "ready" },
    { label: c.scrollOwner, value: c.locked, state: "locked" },
    { label: c.mutedUtilities, value: c.locked, state: "locked" },
    { label: c.sourceBoundary, value: hasSource ? c.ready : c.review, state: hasSource ? "ready" : "review" },
    { label: c.tierBoundary, value: c.locked, state: "locked" },
    { label: c.chartParity, value: surfaceLabel, state: "ready" },
  ];
  return {
    title: c.title,
    subtitle: c.subtitle,
    asset: `${input.symbol} · ${surfaceLabel}`,
    source: input.sourceTimeLabel ? `${input.sourceLabel ?? "source"} · ${input.sourceTimeLabel}` : input.sourceLabel ?? "source pending",
    items,
  };
}

const auditCopy: Record<Pass4477Locale, {
  title: string;
  subtitle: string;
  normalized: string;
  scope: string;
  vault: string;
  receipt: string;
  delivery: string;
  waiting: string;
  staged: string;
  locked: string;
  manual: string;
}> = {
  pl: {
    title: "Evidence queue",
    subtitle: "To nie jest pusty formularz — klient widzi, co trafi do case vault i co nadal wymaga serwera.",
    normalized: "Input znormalizowany",
    scope: "Zakres planu",
    vault: "Case vault",
    receipt: "Receipt",
    delivery: "Delivery",
    waiting: "czeka na input",
    staged: "staged client-side",
    locked: "server lock",
    manual: "manual queue",
  },
  en: {
    title: "Evidence queue",
    subtitle: "This is not an empty form — the client can see what goes to the case vault and what still requires the server.",
    normalized: "Input normalized",
    scope: "Tier scope",
    vault: "Case vault",
    receipt: "Receipt",
    delivery: "Delivery",
    waiting: "waiting for input",
    staged: "staged client-side",
    locked: "server lock",
    manual: "manual queue",
  },
  de: {
    title: "Evidence Queue",
    subtitle: "Das ist kein leeres Formular — der Kunde sieht, was in den Case Vault geht und was Server benötigt.",
    normalized: "Input normalisiert",
    scope: "Planumfang",
    vault: "Case Vault",
    receipt: "Beleg",
    delivery: "Delivery",
    waiting: "wartet auf Input",
    staged: "client-side vorbereitet",
    locked: "Server Lock",
    manual: "Human Queue",
  },
};

export function buildPass4477AuditEvidenceQueue(input: {
  locale?: string;
  inputKind: string;
  tier: string;
  queued: boolean;
}) {
  const locale = safeLocale(input.locale);
  const c = auditCopy[locale];
  return {
    title: c.title,
    subtitle: c.subtitle,
    rows: [
      { label: c.normalized, value: input.queued ? input.inputKind : c.waiting, state: queueState(input.queued) },
      { label: c.scope, value: input.tier, state: "ready" },
      { label: c.vault, value: input.queued ? c.staged : c.waiting, state: queueState(input.queued) },
      { label: c.receipt, value: c.locked, state: "locked" },
      { label: c.delivery, value: c.manual, state: "locked" },
    ] satisfies Pass4477AuditQueueRow[],
  };
}
