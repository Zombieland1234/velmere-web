export type Pass4486Locale = "pl" | "en" | "de";
export type Pass4486State = "ready" | "watch" | "blocked";

export type Pass4486TimeframeHintInput = {
  locale: string;
  activeLabel: string;
  loading: boolean;
};

export type Pass4486AuditActionInput = {
  locale: string;
  inputKind: string;
  intakeIsValid: boolean;
  intakeQueued: boolean;
  fingerprint: string;
};

const copy = {
  pl: {
    timeframeLabel: "Sterowanie zakresem",
    timeframeHint: "←/→ zmienia zakres, Home/End skacze do początku/końca. Wheel i drag zostają w wykresie.",
    loading: "ładowanie świec",
    ready: "gotowe",
    actionTitle: "Stan wysyłki",
    actionReady: "Input sklasyfikowany — można stage’ować case.",
    actionQueued: "Case jest staged po stronie klienta. Backend case vault + receipt dalej wymagany.",
    actionBlocked: "Wklej adres strony, repo albo smart kontrakt, zanim wyślesz zgłoszenie.",
    actionKind: "Typ",
    actionReceipt: "Fingerprint",
    actionStatus: "Status",
    blocked: "zablokowane",
    queued: "staged",
  },
  en: {
    timeframeLabel: "Timeframe control",
    timeframeHint: "←/→ changes range, Home/End jumps to first/last. Wheel and drag stay inside the chart.",
    loading: "loading candles",
    ready: "ready",
    actionTitle: "Submit state",
    actionReady: "Input is classified — the case can be staged.",
    actionQueued: "Case is staged client-side. Backend case vault + receipt are still required.",
    actionBlocked: "Paste a website, repository or smart contract before submitting.",
    actionKind: "Kind",
    actionReceipt: "Fingerprint",
    actionStatus: "Status",
    blocked: "blocked",
    queued: "staged",
  },
  de: {
    timeframeLabel: "Zeitraum-Steuerung",
    timeframeHint: "←/→ wechselt den Zeitraum, Home/End springt zum Anfang/Ende. Wheel und Drag bleiben im Chart.",
    loading: "Candles laden",
    ready: "bereit",
    actionTitle: "Submit-Status",
    actionReady: "Input ist klassifiziert — der Case kann staged werden.",
    actionQueued: "Case ist clientseitig staged. Backend Case Vault + Beleg bleiben erforderlich.",
    actionBlocked: "Website, Repository oder Smart Contract einfügen, bevor gesendet wird.",
    actionKind: "Typ",
    actionReceipt: "Fingerprint",
    actionStatus: "Status",
    blocked: "blockiert",
    queued: "staged",
  },
} as const;

export function pass4486Locale(locale: string): Pass4486Locale {
  return locale === "en" || locale === "de" ? locale : "pl";
}

function compact(value?: string | null, fallback = "—") {
  const clean = `${value ?? ""}`.trim();
  return clean.length ? clean : fallback;
}

export function buildPass4486TimeframeHint(input: Pass4486TimeframeHintInput) {
  const t = copy[pass4486Locale(input.locale)];
  return {
    label: t.timeframeLabel,
    hint: t.timeframeHint,
    active: input.activeLabel,
    state: (input.loading ? "watch" : "ready") as Pass4486State,
    badge: input.loading ? t.loading : t.ready,
  };
}

export function buildPass4486AuditActionState(input: Pass4486AuditActionInput) {
  const t = copy[pass4486Locale(input.locale)];
  const state: Pass4486State = input.intakeQueued ? "watch" : input.intakeIsValid ? "ready" : "blocked";
  const message = input.intakeQueued ? t.actionQueued : input.intakeIsValid ? t.actionReady : t.actionBlocked;
  const status = input.intakeQueued ? t.queued : input.intakeIsValid ? t.ready : t.blocked;
  return {
    title: t.actionTitle,
    message,
    state,
    ariaLabel: `${t.actionTitle}: ${message}`,
    items: [
      { label: t.actionKind, value: compact(input.inputKind), state },
      { label: t.actionReceipt, value: input.intakeIsValid ? compact(input.fingerprint) : t.blocked, state: (input.intakeIsValid ? state : "blocked") as Pass4486State },
      { label: t.actionStatus, value: status, state },
    ],
  };
}
