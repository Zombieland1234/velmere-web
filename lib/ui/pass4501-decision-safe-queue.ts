export type Pass4501Locale = "pl" | "en" | "de";
export type Pass4501QueueState = "complete" | "partial" | "blocked" | "manualReview";

export type Pass4501DecisionSafeStep = {
  label: string;
  value: string;
  state: Pass4501QueueState;
};

export type Pass4501DecisionSafeQueue = {
  title: string;
  subtitle: string;
  badge: string;
  state: Pass4501QueueState;
  steps: Pass4501DecisionSafeStep[];
  packet: {
    schema: string;
    pass: "PASS4501";
    surface: "asset-drawer" | "shield-pro" | "audit";
    state: Pass4501QueueState;
    steps: Array<{ label: string; value: string; state: Pass4501QueueState }>;
    boundary: string;
  };
};

const COPY = {
  pl: {
    title: "Kolejka bezpiecznej decyzji",
    subtitleReady: "Źródła i pakiet są gotowe do spokojnej weryfikacji.",
    subtitlePartial: "Brakuje części proofu — najpierw weryfikacja, potem mocniejszy raport.",
    subtitleBlocked: "Akcja ograniczona do obserwacji, bo proof jest za słaby.",
    subtitleManual: "Wymaga manualnego przeglądu przed mocniejszym claimem.",
    source: "Źródło",
    chart: "Wykres",
    proof: "Proof",
    packet: "Pakiet",
    coverage: "Coverage",
    evidence: "Evidence",
    queue: "Queue",
    input: "Input",
    plan: "Plan",
    receipt: "Receipt",
    ready: "Gotowe",
    partial: "Częściowo",
    blocked: "Zablokowane",
    manual: "Manual review",
    badgeReady: "READY",
    badgePartial: "VERIFY",
    badgeBlocked: "HOLD",
    badgeManual: "REVIEW",
  },
  en: {
    title: "Decision-safe queue",
    subtitleReady: "Sources and packet are ready for calm verification.",
    subtitlePartial: "Some proof is missing — verify first, then escalate the report.",
    subtitleBlocked: "Action is limited to observation because proof is too weak.",
    subtitleManual: "Manual review is required before a stronger claim.",
    source: "Source",
    chart: "Chart",
    proof: "Proof",
    packet: "Packet",
    coverage: "Coverage",
    evidence: "Evidence",
    queue: "Queue",
    input: "Input",
    plan: "Plan",
    receipt: "Receipt",
    ready: "Ready",
    partial: "Partial",
    blocked: "Blocked",
    manual: "Manual review",
    badgeReady: "READY",
    badgePartial: "VERIFY",
    badgeBlocked: "HOLD",
    badgeManual: "REVIEW",
  },
  de: {
    title: "Entscheidungssichere Queue",
    subtitleReady: "Quellen und Paket sind bereit für ruhige Verifikation.",
    subtitlePartial: "Ein Teil des Proofs fehlt — zuerst prüfen, dann Bericht vertiefen.",
    subtitleBlocked: "Aktion bleibt auf Beobachtung begrenzt, weil der Proof zu schwach ist.",
    subtitleManual: "Manuelle Prüfung ist vor stärkeren Claims erforderlich.",
    source: "Quelle",
    chart: "Chart",
    proof: "Proof",
    packet: "Paket",
    coverage: "Coverage",
    evidence: "Evidence",
    queue: "Queue",
    input: "Input",
    plan: "Plan",
    receipt: "Receipt",
    ready: "Bereit",
    partial: "Teilweise",
    blocked: "Blockiert",
    manual: "Manual review",
    badgeReady: "READY",
    badgePartial: "VERIFY",
    badgeBlocked: "HOLD",
    badgeManual: "REVIEW",
  },
} as const;

function copy(locale: Pass4501Locale) {
  return COPY[locale] ?? COPY.en;
}

function subtitleFor(locale: Pass4501Locale, state: Pass4501QueueState): string {
  const c = copy(locale);
  if (state === "complete") return c.subtitleReady;
  if (state === "blocked") return c.subtitleBlocked;
  if (state === "manualReview") return c.subtitleManual;
  return c.subtitlePartial;
}

function badgeFor(locale: Pass4501Locale, state: Pass4501QueueState): string {
  const c = copy(locale);
  if (state === "complete") return c.badgeReady;
  if (state === "blocked") return c.badgeBlocked;
  if (state === "manualReview") return c.badgeManual;
  return c.badgePartial;
}

function valueFor(locale: Pass4501Locale, state: Pass4501QueueState): string {
  const c = copy(locale);
  if (state === "complete") return c.ready;
  if (state === "blocked") return c.blocked;
  if (state === "manualReview") return c.manual;
  return c.partial;
}

function resolveState(states: Pass4501QueueState[]): Pass4501QueueState {
  if (states.includes("blocked")) return "blocked";
  if (states.includes("manualReview")) return "manualReview";
  if (states.includes("partial")) return "partial";
  return "complete";
}

function makeQueue(input: {
  locale: Pass4501Locale;
  surface: "asset-drawer" | "shield-pro" | "audit";
  steps: Pass4501DecisionSafeStep[];
}): Pass4501DecisionSafeQueue {
  const c = copy(input.locale);
  const state = resolveState(input.steps.map((step) => step.state));
  return {
    title: c.title,
    subtitle: subtitleFor(input.locale, state),
    badge: badgeFor(input.locale, state),
    state,
    steps: input.steps,
    packet: {
      schema: `velmere.pass4501.${input.surface}.decision-safe-queue.v1`,
      pass: "PASS4501",
      surface: input.surface,
      state,
      steps: input.steps.map((step) => ({ label: step.label, value: step.value, state: step.state })),
      boundary: "evidence_first_no_execution_prompt_claims_limited_to_available_sources",
    },
  };
}

export function buildPass4501AssetDecisionSafeQueue(input: {
  locale: Pass4501Locale;
  chartIsLoading: boolean;
  remoteReady: boolean;
  candleCount: number;
  copyState: "idle" | "copied" | "fallback";
  pdfQueueEnabled: boolean;
}): Pass4501DecisionSafeQueue {
  const c = copy(input.locale);
  const sourceState: Pass4501QueueState = input.remoteReady ? "complete" : "manualReview";
  const chartState: Pass4501QueueState = input.chartIsLoading ? "partial" : input.candleCount >= 12 ? "complete" : "blocked";
  const proofState: Pass4501QueueState = input.remoteReady && input.candleCount >= 12 ? "complete" : input.candleCount > 0 ? "partial" : "blocked";
  const packetState: Pass4501QueueState = input.copyState === "fallback" ? "partial" : input.pdfQueueEnabled ? "complete" : "manualReview";
  return makeQueue({
    locale: input.locale,
    surface: "asset-drawer",
    steps: [
      { label: c.source, value: valueFor(input.locale, sourceState), state: sourceState },
      { label: c.chart, value: input.chartIsLoading ? c.partial : `${input.candleCount}`, state: chartState },
      { label: c.proof, value: valueFor(input.locale, proofState), state: proofState },
      { label: c.packet, value: valueFor(input.locale, packetState), state: packetState },
    ],
  });
}

export function buildPass4501ShieldProDecisionSafeQueue(input: {
  locale: Pass4501Locale;
  visibleCount: number;
  totalCount: number;
  lowEvidenceCount: number;
  highRiskCount: number;
  copyState: "idle" | "copied" | "fallback";
}): Pass4501DecisionSafeQueue {
  const c = copy(input.locale);
  const coverageState: Pass4501QueueState = input.visibleCount > 0 && input.totalCount > 0 ? "complete" : "blocked";
  const evidenceState: Pass4501QueueState = input.lowEvidenceCount === 0 ? "complete" : input.lowEvidenceCount <= Math.max(1, Math.ceil(input.visibleCount / 3)) ? "partial" : "manualReview";
  const queueState: Pass4501QueueState = input.highRiskCount > 0 ? "manualReview" : "complete";
  const packetState: Pass4501QueueState = input.copyState === "fallback" ? "partial" : input.visibleCount > 0 ? "complete" : "blocked";
  return makeQueue({
    locale: input.locale,
    surface: "shield-pro",
    steps: [
      { label: c.coverage, value: `${input.visibleCount}/${input.totalCount}`, state: coverageState },
      { label: c.evidence, value: `${input.lowEvidenceCount}`, state: evidenceState },
      { label: c.queue, value: `${input.highRiskCount}`, state: queueState },
      { label: c.packet, value: valueFor(input.locale, packetState), state: packetState },
    ],
  });
}

export function buildPass4501AuditDecisionSafeQueue(input: {
  locale: Pass4501Locale;
  inputKindLabel: string;
  planLabel: string;
  valid: boolean;
  queued: boolean;
  fingerprint: string;
  copyState: "idle" | "copied" | "fallback";
}): Pass4501DecisionSafeQueue {
  const c = copy(input.locale);
  const inputState: Pass4501QueueState = input.valid ? "complete" : "blocked";
  const queueState: Pass4501QueueState = input.queued ? "complete" : input.valid ? "partial" : "blocked";
  const receiptState: Pass4501QueueState = input.queued && input.fingerprint !== "—" ? "complete" : input.valid ? "manualReview" : "blocked";
  const packetState: Pass4501QueueState = input.copyState === "fallback" ? "partial" : input.valid ? "complete" : "blocked";
  return makeQueue({
    locale: input.locale,
    surface: "audit",
    steps: [
      { label: c.input, value: input.inputKindLabel, state: inputState },
      { label: c.plan, value: input.planLabel, state: inputState },
      { label: c.queue, value: valueFor(input.locale, queueState), state: queueState },
      { label: c.receipt, value: input.fingerprint, state: receiptState },
      { label: c.packet, value: valueFor(input.locale, packetState), state: packetState },
    ],
  });
}
