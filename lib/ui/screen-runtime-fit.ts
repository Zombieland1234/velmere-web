export type Pass4485Locale = "pl" | "en" | "de";
export type Pass4485FitState = "ready" | "watch" | "blocked";

export type Pass4485ChartEdgeOptions = {
  fallbackX?: number;
  fallbackY?: number;
  size?: number;
};

export type Pass4485FitItem = {
  label: string;
  value: string;
  state: Pass4485FitState;
};

export type Pass4485AuditSubmitFitInput = {
  locale: string;
  inputKind: string;
  selectedTier: string;
  intakeIsValid: boolean;
  intakeQueued: boolean;
  fingerprint: string;
};

const copy = {
  pl: {
    title: "Screen fit",
    subtitle: "Kontrakt mockupu: input, plan, kolejka i receipt bez fałszywej dostawy z frontendu.",
    badgeReady: "gotowe",
    badgeWatch: "w trakcie",
    badgeBlocked: "blokada",
    input: "Input",
    tier: "Plan",
    queue: "Kolejka",
    receipt: "Receipt",
    valid: "poprawny",
    invalid: "do poprawy",
    queued: "queued",
    staged: "staged",
    blocked: "blocked",
  },
  en: {
    title: "Screen fit",
    subtitle: "Mockup contract: input, plan, queue and receipt without fake frontend delivery.",
    badgeReady: "ready",
    badgeWatch: "staged",
    badgeBlocked: "blocked",
    input: "Input",
    tier: "Plan",
    queue: "Queue",
    receipt: "Receipt",
    valid: "valid",
    invalid: "needs fix",
    queued: "queued",
    staged: "staged",
    blocked: "blocked",
  },
  de: {
    title: "Screen Fit",
    subtitle: "Mockup-Vertrag: Input, Plan, Queue und Beleg ohne vorgetäuschte Frontend-Lieferung.",
    badgeReady: "bereit",
    badgeWatch: "staged",
    badgeBlocked: "blockiert",
    input: "Input",
    tier: "Plan",
    queue: "Queue",
    receipt: "Beleg",
    valid: "gültig",
    invalid: "korrigieren",
    queued: "queued",
    staged: "staged",
    blocked: "blocked",
  },
} as const;

export function pass4485Locale(locale: string): Pass4485Locale {
  return locale === "en" || locale === "de" ? locale : "pl";
}

function compact(value?: string | null, fallback = "—") {
  const clean = `${value ?? ""}`.trim();
  return clean.length ? clean : fallback;
}

export function buildPass4485ChartEdge(points: string, options: Pass4485ChartEdgeOptions = {}) {
  const fallbackX = options.fallbackX ?? 122;
  const fallbackY = options.fallbackY ?? 15;
  const size = options.size ?? 8;
  const pairs = points.trim().split(/\s+/).filter(Boolean);
  const finalPair = pairs[pairs.length - 1]?.split(",") ?? [];
  const x = Number(finalPair[0]);
  const y = Number(finalPair[1]);
  const finalX = Number.isFinite(x) ? x : fallbackX;
  const finalY = Number.isFinite(y) ? y : fallbackY;
  const startX = Math.max(0, finalX - size);
  return {
    x: finalX,
    y: finalY,
    arrowPath: `M${startX.toFixed(2)} ${(finalY - size / 2).toFixed(2)} L${finalX.toFixed(2)} ${finalY.toFixed(2)} L${startX.toFixed(2)} ${(finalY + size / 2).toFixed(2)}`,
  };
}

export function buildPass4485AuditSubmitFit(input: Pass4485AuditSubmitFitInput) {
  const t = copy[pass4485Locale(input.locale)];
  const receiptReady = input.intakeIsValid && compact(input.fingerprint) !== "—";
  const state: Pass4485FitState = input.intakeQueued ? "ready" : input.intakeIsValid ? "watch" : "blocked";
  const badge = state === "ready" ? t.badgeReady : state === "watch" ? t.badgeWatch : t.badgeBlocked;
  const queueValue = input.intakeQueued ? t.queued : input.intakeIsValid ? t.staged : t.blocked;
  const items: Pass4485FitItem[] = [
    { label: t.input, value: input.intakeIsValid ? `${input.inputKind} · ${t.valid}` : `${input.inputKind} · ${t.invalid}`, state: input.intakeIsValid ? "ready" : "blocked" },
    { label: t.tier, value: input.selectedTier, state: "ready" },
    { label: t.queue, value: queueValue, state },
    { label: t.receipt, value: receiptReady ? input.fingerprint : t.blocked, state: receiptReady ? "watch" : "blocked" },
  ];
  return {
    title: t.title,
    subtitle: t.subtitle,
    badge,
    state,
    items,
  };
}
