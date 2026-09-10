export type Pass4496Locale = "pl" | "en" | "de";
export type Pass4496State = "ready" | "watch" | "locked";

type Item = {
  label: string;
  value: string;
  state: Pass4496State;
};

type ProofDock = {
  title: string;
  subtitle: string;
  badge: string;
  state: Pass4496State;
  detailsLabel: string;
  items: Item[];
};

const copy = {
  pl: {
    assetTitle: "Proof dock",
    assetSubtitle: "Jedna spokojna kapsuła przed wykresem: źródło, świece, ryzyko i granica claimu.",
    shieldTitle: "Terminal proof dock",
    shieldSubtitle: "Coverage, evidence i export są skompresowane, żeby tabela została pierwszym planem.",
    auditTitle: "Audit proof dock",
    auditSubtitle: "Input, plan, kolejka i receipt w jednym railu zamiast ciężkiej listy debugów.",
    details: "Pokaż operator details",
    ready: "ready",
    watch: "watch",
    locked: "locked",
    source: "Source",
    candles: "Candles",
    risk: "Risk",
    claim: "Claim",
    coverage: "Coverage",
    evidence: "Evidence",
    queue: "Queue",
    export: "Export",
    plan: "Plan",
    input: "Input",
    receipt: "Receipt",
    boundary: "Boundary",
  },
  en: {
    assetTitle: "Proof dock",
    assetSubtitle: "One calm capsule before the chart: source, candles, risk and claim boundary.",
    shieldTitle: "Terminal proof dock",
    shieldSubtitle: "Coverage, evidence and export are compressed so the table stays first.",
    auditTitle: "Audit proof dock",
    auditSubtitle: "Input, plan, queue and receipt in one rail instead of a heavy debug stack.",
    details: "Show operator details",
    ready: "ready",
    watch: "watch",
    locked: "locked",
    source: "Source",
    candles: "Candles",
    risk: "Risk",
    claim: "Claim",
    coverage: "Coverage",
    evidence: "Evidence",
    queue: "Queue",
    export: "Export",
    plan: "Plan",
    input: "Input",
    receipt: "Receipt",
    boundary: "Boundary",
  },
  de: {
    assetTitle: "Proof dock",
    assetSubtitle: "Eine ruhige Kapsel vor dem Chart: Quelle, Kerzen, Risiko und Claim-Grenze.",
    shieldTitle: "Terminal Proof Dock",
    shieldSubtitle: "Coverage, Evidenz und Export sind komprimiert, damit die Tabelle im Vordergrund bleibt.",
    auditTitle: "Audit Proof Dock",
    auditSubtitle: "Input, Plan, Queue und Receipt in einer Rail statt schwerem Debug-Stack.",
    details: "Operator-Details anzeigen",
    ready: "ready",
    watch: "watch",
    locked: "locked",
    source: "Quelle",
    candles: "Kerzen",
    risk: "Risiko",
    claim: "Claim",
    coverage: "Coverage",
    evidence: "Evidenz",
    queue: "Queue",
    export: "Export",
    plan: "Plan",
    input: "Input",
    receipt: "Receipt",
    boundary: "Boundary",
  },
} as const;

function safeLocale(locale: string | undefined): Pass4496Locale {
  return locale === "pl" || locale === "de" ? locale : "en";
}

function aggregateState(states: Pass4496State[]): Pass4496State {
  if (states.includes("locked")) return "locked";
  if (states.includes("watch")) return "watch";
  return "ready";
}

function percent(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

export function buildPass4496AssetProofDock(input: {
  locale: Pass4496Locale;
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  candleCount: number;
  remoteReady: boolean;
  riskLabel?: string | null;
  confidenceLabel?: string | null;
}) : ProofDock {
  const c = copy[safeLocale(input.locale)];
  const hasSource = Boolean(input.sourceLabel || input.sourceTimeLabel || input.remoteReady);
  const hasCandles = input.candleCount >= 24;
  const hasRisk = Boolean(input.riskLabel || input.confidenceLabel);
  const sourceState: Pass4496State = hasSource ? "ready" : "watch";
  const candleState: Pass4496State = hasCandles ? "ready" : input.candleCount > 1 ? "watch" : "locked";
  const riskState: Pass4496State = hasRisk ? "ready" : "watch";
  const claimState: Pass4496State = hasSource && hasCandles ? "ready" : "watch";
  const state = aggregateState([sourceState, candleState, riskState, claimState]);
  return {
    title: c.assetTitle,
    subtitle: c.assetSubtitle,
    badge: c[state],
    state,
    detailsLabel: c.details,
    items: [
      { label: c.source, value: input.sourceLabel || (input.remoteReady ? "remote" : "fallback"), state: sourceState },
      { label: c.candles, value: String(Math.max(0, input.candleCount)), state: candleState },
      { label: c.risk, value: input.riskLabel || input.confidenceLabel || "limited", state: riskState },
      { label: c.claim, value: claimState === "ready" ? "source-bound" : "proof capped", state: claimState },
    ],
  };
}

export function buildPass4496ShieldProProofDock(input: {
  locale: Pass4496Locale;
  visibleRows: Array<{ integrity: number; evidence: number; manipulation: number; squeeze: number }>;
  totalCount: number;
  activeFilterLabel: string;
}) : ProofDock {
  const c = copy[safeLocale(input.locale)];
  const visible = input.visibleRows.length;
  const avgEvidence = visible ? input.visibleRows.reduce((sum, row) => sum + row.evidence, 0) / visible : 0;
  const highRisk = input.visibleRows.filter((row) => row.manipulation >= 55 || row.squeeze >= 70).length;
  const coverageState: Pass4496State = visible > 0 ? "ready" : "locked";
  const evidenceState: Pass4496State = avgEvidence >= 80 ? "ready" : avgEvidence >= 60 ? "watch" : "locked";
  const queueState: Pass4496State = highRisk > 0 ? "watch" : coverageState;
  const exportState: Pass4496State = visible > 0 && avgEvidence >= 60 ? "ready" : "watch";
  const state = aggregateState([coverageState, evidenceState, queueState, exportState]);
  return {
    title: c.shieldTitle,
    subtitle: c.shieldSubtitle,
    badge: c[state],
    state,
    detailsLabel: c.details,
    items: [
      { label: c.coverage, value: `${visible}/${input.totalCount}`, state: coverageState },
      { label: c.evidence, value: percent(avgEvidence), state: evidenceState },
      { label: c.queue, value: highRisk ? `${highRisk} watch` : input.activeFilterLabel, state: queueState },
      { label: c.export, value: exportState === "ready" ? "safe packet" : "limited", state: exportState },
    ],
  };
}

export function buildPass4496AuditProofDock(input: {
  locale: Pass4496Locale;
  selectedPlan: string;
  inputKind: string;
  fingerprint?: string | null;
  hasStagedReceipt: boolean;
  checklistCount: number;
}) : ProofDock {
  const c = copy[safeLocale(input.locale)];
  const inputState: Pass4496State = input.inputKind && input.inputKind !== "unknown" ? "ready" : "locked";
  const planState: Pass4496State = input.selectedPlan ? "ready" : "watch";
  const queueState: Pass4496State = input.hasStagedReceipt ? "ready" : inputState === "ready" ? "watch" : "locked";
  const receiptState: Pass4496State = input.hasStagedReceipt && input.fingerprint ? "ready" : "watch";
  const state = aggregateState([inputState, planState, queueState, receiptState]);
  return {
    title: c.auditTitle,
    subtitle: c.auditSubtitle,
    badge: c[state],
    state,
    detailsLabel: c.details,
    items: [
      { label: c.input, value: input.inputKind || "unknown", state: inputState },
      { label: c.plan, value: input.selectedPlan, state: planState },
      { label: c.queue, value: input.hasStagedReceipt ? "staged" : `${input.checklistCount} checks`, state: queueState },
      { label: c.receipt, value: input.fingerprint ? input.fingerprint.slice(0, 14) : "pending", state: receiptState },
    ],
  };
}
