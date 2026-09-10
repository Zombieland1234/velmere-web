import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2572AuditProviderRuntimeReport, Pass2572RuntimeState } from "./audit-provider-runtime-client";
import type { Pass2574AuditClaimLedgerReport, Pass2574EvidenceGrade } from "./audit-claim-ledger";
import type { Pass2582RealProviderAdapterHardeningReport, Pass2582AdapterState } from "./real-provider-adapter-hardening";
import type { Pass2589SourceFreshnessRecheckOrchestratorReport } from "./source-freshness-recheck-orchestrator";
import type { Pass2590RiskFormulaEvidenceWeightingContractReport } from "./risk-formula-evidence-weighting-contract";
import type { Pass2591RiskCalibrationGoldenFixtureHarnessReport } from "./risk-calibration-golden-fixture-harness";

export const PASS2592_PROVIDER_CONFLICT_ARBITRATION_MATRIX_ID = "provider-conflict-arbitration-matrix" as const;

export type Pass2592ConflictState =
  | "aligned"
  | "partial_alignment"
  | "missing_counterparty"
  | "provider_divergence"
  | "freshness_conflict"
  | "needs_operator"
  | "blocked";

export type Pass2592ArbitrationFamily =
  | "identity"
  | "source_code"
  | "permissions"
  | "liquidity"
  | "holders"
  | "market"
  | "freshness"
  | "delivery";

export type Pass2592ProviderSignal = {
  provider: string;
  laneId: string;
  state: Pass2572RuntimeState | Pass2582AdapterState | Pass2574EvidenceGrade | "scheduled" | "ready" | "watch" | "frozen" | "private";
  claim: string;
  evidence: string[];
  missing: string[];
};

export type Pass2592ConflictRow = {
  id: string;
  family: Pass2592ArbitrationFamily;
  label: string;
  state: Pass2592ConflictState;
  severity: "none" | "low" | "medium" | "high" | "critical";
  signals: Pass2592ProviderSignal[];
  primaryProvider: string;
  counterpartyProviders: string[];
  riskDelta: number;
  confidencePenalty: number;
  customerLine: string;
  proPdfLine: string;
  operatorLine: string;
  action: string;
  canShowAsFact: boolean;
  blocksFinalSign: boolean;
};

export type Pass2592ArbitrationRow = {
  label: string;
  state: Pass2592ConflictState;
  output: string;
};

export type Pass2592ProviderConflictArbitrationMatrixReport = {
  passId: typeof PASS2592_PROVIDER_CONFLICT_ARBITRATION_MATRIX_ID;
  generatedAt: string;
  locale: string;
  target: {
    chain: string;
    contractAddress?: string;
    projectName?: string;
  };
  rule: string;
  customerRule: string;
  proRule: string;
  operatorRule: string;
  summary: {
    rows: number;
    aligned: number;
    partialAlignment: number;
    missingCounterparty: number;
    providerDivergence: number;
    freshnessConflict: number;
    needsOperator: number;
    blocked: number;
    blockingConflicts: number;
    totalRiskDelta: number;
    totalConfidencePenalty: number;
    arbitrationReadiness: number;
    canShowUnifiedVerdict: boolean;
    canIssueProWithConflicts: boolean;
    canFinalSignAdvancedWithConflicts: boolean;
    nextCriticalConflict: string;
  };
  conflictMatrix: Pass2592ConflictRow[];
  customerRows: Pass2592ArbitrationRow[];
  proPdfRows: Pass2592ArbitrationRow[];
  operatorRows: Pass2592ArbitrationRow[];
  arbitrationContract: {
    version: string;
    invariant: string;
    primarySourceRules: string[];
    conflictDowngradeRules: string[];
    noSilentTieBreakerRules: string[];
  };
  visualMergeContract: {
    publicSlot: string;
    proPdfSlot: string;
    operatorSlot: string;
    rule: string;
    keepWired: string[];
    doNotExpose: string[];
  };
  nextImplementationBacklog: string[];
};

type BuilderInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  providerRuntime?: Pass2572AuditProviderRuntimeReport | null;
  claimLedger?: Pass2574AuditClaimLedgerReport | null;
  realProviderAdapterHardening?: Pass2582RealProviderAdapterHardeningReport | null;
  sourceFreshnessRecheckOrchestrator?: Pass2589SourceFreshnessRecheckOrchestratorReport | null;
  riskFormulaEvidenceWeightingContract?: Pass2590RiskFormulaEvidenceWeightingContractReport | null;
  riskCalibrationGoldenFixtureHarness?: Pass2591RiskCalibrationGoldenFixtureHarnessReport | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(C0_OR_TEMPLATE_META_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function uniq(values: string[], max = 8) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, max);
}

function familyFromText(text: string): Pass2592ArbitrationFamily {
  const value = text.toLowerCase();
  if (/address|identity|symbol|metadata|token name/.test(value)) return "identity";
  if (/source|abi|verified|explorer|etherscan|blockscout/.test(value)) return "source_code";
  if (/permission|owner|admin|proxy|mint|pause|freeze|blacklist|tax|honeypot|goplus|security/.test(value)) return "permissions";
  if (/liquidity|lp|pair|pool|dex|lock|reserve/.test(value)) return "liquidity";
  if (/holder|supply|concentration|deployer/.test(value)) return "holders";
  if (/market|price|volume|coingecko|defillama|tvl/.test(value)) return "market";
  if (/fresh|recheck|ttl|version|replay|stale|expired/.test(value)) return "freshness";
  return "delivery";
}

function familyLabel(locale: string, family: Pass2592ArbitrationFamily) {
  const labels: Record<Pass2592ArbitrationFamily, string> = {
    identity: t(locale, "Identity / metadata", "Identitaet / Metadaten", "Identity / metadata"),
    source_code: t(locale, "Source / ABI", "Source / ABI", "Source / ABI"),
    permissions: t(locale, "Permissions / security flags", "Berechtigungen / Security Flags", "Permissions / security flags"),
    liquidity: t(locale, "Liquidity / pair evidence", "Liquiditaet / Pair Evidence", "Liquidity / pair evidence"),
    holders: t(locale, "Holders / supply", "Holder / Supply", "Holders / supply"),
    market: t(locale, "Market / TVL", "Market / TVL", "Market / TVL"),
    freshness: t(locale, "Freshness / re-check", "Freshness / Re-check", "Freshness / re-check"),
    delivery: t(locale, "Delivery / receipt boundary", "Delivery / Receipt Boundary", "Delivery / receipt boundary"),
  };
  return labels[family];
}

function positiveState(state: Pass2592ProviderSignal["state"]) {
  return state === "confirmed" || state === "usable" || state === "ready" || state === "scheduled" || state === "frozen" || state === "private";
}

function partialState(state: Pass2592ProviderSignal["state"]) {
  return state === "partial" || state === "degraded" || state === "watch";
}

function problemState(state: Pass2592ProviderSignal["state"]) {
  return state === "missing" || state === "missing_input" || state === "blocked" || state === "timeout" || state === "error" || state === "needs_key" || state === "not_run";
}

function staleState(state: Pass2592ProviderSignal["state"], text: string) {
  return state === "watch" || /stale|expired|ttl|freshness|recheck/i.test(text);
}

function severityFor(state: Pass2592ConflictState): Pass2592ConflictRow["severity"] {
  if (state === "aligned") return "none";
  if (state === "partial_alignment") return "low";
  if (state === "missing_counterparty") return "medium";
  if (state === "freshness_conflict") return "medium";
  if (state === "needs_operator") return "high";
  if (state === "provider_divergence") return "high";
  return "critical";
}

function impactFor(state: Pass2592ConflictState) {
  const impact: Record<Pass2592ConflictState, { riskDelta: number; confidencePenalty: number }> = {
    aligned: { riskDelta: 0, confidencePenalty: 0 },
    partial_alignment: { riskDelta: 3, confidencePenalty: 6 },
    missing_counterparty: { riskDelta: 7, confidencePenalty: 12 },
    freshness_conflict: { riskDelta: 8, confidencePenalty: 16 },
    needs_operator: { riskDelta: 10, confidencePenalty: 18 },
    provider_divergence: { riskDelta: 14, confidencePenalty: 24 },
    blocked: { riskDelta: 16, confidencePenalty: 30 },
  };
  return impact[state];
}

function stateForSignals(family: Pass2592ArbitrationFamily, signals: Pass2592ProviderSignal[], calibrationBlocks: boolean): Pass2592ConflictState {
  const positive = signals.filter((signal) => positiveState(signal.state)).length;
  const partial = signals.filter((signal) => partialState(signal.state)).length;
  const problems = signals.filter((signal) => problemState(signal.state)).length;
  const stale = signals.filter((signal) => staleState(signal.state, `${signal.claim} ${signal.missing.join(" ")}`)).length;

  if (!signals.length) return "missing_counterparty";
  if (signals.some((signal) => signal.state === "blocked" || signal.state === "needs_key") && positive === 0) return "blocked";
  if (calibrationBlocks && (family === "permissions" || family === "liquidity" || family === "freshness")) return "needs_operator";
  if (positive > 0 && problems > 0) return stale > 0 ? "freshness_conflict" : "provider_divergence";
  if (positive === 1 && signals.length < 2) return "missing_counterparty";
  if (positive > 0 && partial > 0) return "partial_alignment";
  if (positive >= 2 && problems === 0 && stale === 0) return "aligned";
  if (stale > 0) return "freshness_conflict";
  if (partial > 0) return "partial_alignment";
  return problems > 0 ? "missing_counterparty" : "aligned";
}

function providerFromSignal(signal: Pass2592ProviderSignal) {
  return clean(signal.provider, 60) ?? "unknown";
}

function makeSignal(args: Pass2592ProviderSignal): Pass2592ProviderSignal {
  return {
    provider: clean(args.provider, 80) ?? "unknown",
    laneId: clean(args.laneId, 80) ?? "lane",
    state: args.state,
    claim: clean(args.claim, 220) ?? "provider signal",
    evidence: uniq(args.evidence ?? [], 5),
    missing: uniq(args.missing ?? [], 5),
  };
}

function row(label: string, state: Pass2592ConflictState, output: string): Pass2592ArbitrationRow {
  return { label, state, output };
}

function customerLine(locale: string, state: Pass2592ConflictState, family: Pass2592ArbitrationFamily) {
  const label = familyLabel(locale, family);
  if (state === "aligned") return t(locale, `${label}: źródła są spójne i mogą wspierać publiczny werdykt.`, `${label}: Quellen sind konsistent und koennen den public Verdict stuetzen.`, `${label}: sources are aligned and can support the public verdict.`);
  if (state === "partial_alignment") return t(locale, `${label}: sygnały są częściowe; wynik zostaje z limitem confidence.`, `${label}: Signale sind teilweise; Ergebnis bleibt mit Confidence-Limit.`, `${label}: signals are partial; the result stays confidence-capped.`);
  if (state === "missing_counterparty") return t(locale, `${label}: brakuje niezależnego drugiego źródła.`, `${label}: unabhaengige Gegenquelle fehlt.`, `${label}: independent second source is missing.`);
  if (state === "freshness_conflict") return t(locale, `${label}: źródła mają różną świeżość; potrzebny re-check.`, `${label}: Quellen haben verschiedene Freshness; Re-check noetig.`, `${label}: sources have different freshness; re-check is required.`);
  if (state === "provider_divergence") return t(locale, `${label}: providerzy nie są zgodni; nie pokazujemy tego jako fakt.`, `${label}: Provider widersprechen sich; nicht als Fakt anzeigen.`, `${label}: providers disagree; this is not shown as a fact.`);
  if (state === "needs_operator") return t(locale, `${label}: konflikt wymaga review operatora przed finalnym podpisem.`, `${label}: Konflikt braucht Operator-Review vor finaler Freigabe.`, `${label}: conflict requires operator review before final sign-off.`);
  return t(locale, `${label}: lane zablokowany przez brak klucza, błąd albo brak danych.`, `${label}: Lane ist durch fehlenden Key, Fehler oder Datenmangel blockiert.`, `${label}: lane is blocked by missing key, error, or missing data.`);
}

function buildConflictRow(locale: string, family: Pass2592ArbitrationFamily, signals: Pass2592ProviderSignal[], calibrationBlocks: boolean): Pass2592ConflictRow {
  const state = stateForSignals(family, signals, calibrationBlocks);
  const severity = severityFor(state);
  const impact = impactFor(state);
  const primaryProvider = signals.find((signal) => positiveState(signal.state))?.provider ?? signals[0]?.provider ?? "none";
  const counterpartyProviders = uniq(signals.map(providerFromSignal).filter((provider) => provider !== primaryProvider), 6);
  const label = familyLabel(locale, family);
  const blocksFinalSign = state === "provider_divergence" || state === "needs_operator" || state === "blocked" || (state === "freshness_conflict" && family !== "market");
  return {
    id: `${family}-arbitration`,
    family,
    label,
    state,
    severity,
    signals,
    primaryProvider,
    counterpartyProviders,
    riskDelta: impact.riskDelta,
    confidencePenalty: impact.confidencePenalty,
    customerLine: customerLine(locale, state, family),
    proPdfLine: `${label}: state=${state}; severity=${severity}; primary=${primaryProvider}; counterparties=${counterpartyProviders.join(",") || "none"}; signals=${signals.length}; riskDelta=${impact.riskDelta}; confidencePenalty=${impact.confidencePenalty}`,
    operatorLine: blocksFinalSign
      ? `Operator must resolve ${family} before final sign-off; keep old report version immutable and add a new receipt if source truth changes.`
      : `Keep ${family} in customer-safe report with visible confidence boundary and source count.`,
    action: blocksFinalSign
      ? "queue_operator_resolution_and_version_replay"
      : state === "missing_counterparty"
        ? "request_second_source_before_confidence_upgrade"
        : state === "freshness_conflict"
          ? "run_scheduled_recheck_before_pro_final"
          : "keep_confidence_cap_and_show_boundary",
    canShowAsFact: state === "aligned" || state === "partial_alignment",
    blocksFinalSign,
  };
}

function collectSignals(input: BuilderInput) {
  const groups: Record<Pass2592ArbitrationFamily, Pass2592ProviderSignal[]> = {
    identity: [],
    source_code: [],
    permissions: [],
    liquidity: [],
    holders: [],
    market: [],
    freshness: [],
    delivery: [],
  };

  for (const lane of input.providerRuntime?.lanes ?? []) {
    const family = familyFromText(`${lane.id} ${lane.label} ${lane.provider} ${lane.claim}`);
    groups[family].push(makeSignal({
      provider: lane.provider,
      laneId: lane.id,
      state: lane.state,
      claim: lane.claim || lane.label,
      evidence: lane.evidence,
      missing: lane.missing,
    }));
  }

  for (const adapter of input.realProviderAdapterHardening?.providerAdapters ?? []) {
    const family = familyFromText(`${adapter.id} ${adapter.provider} ${adapter.sourceLane} ${adapter.mapsTo.join(" ")}`);
    groups[family].push(makeSignal({
      provider: adapter.provider,
      laneId: adapter.id,
      state: adapter.state,
      claim: `${adapter.sourceLane}: ${adapter.customerClaimBoundary}`,
      evidence: adapter.evidence,
      missing: adapter.missing,
    }));
  }

  for (const claim of input.claimLedger?.claims ?? []) {
    const family = familyFromText(`${claim.category} ${claim.label} ${claim.sourceFamily} ${claim.claim}`);
    groups[family].push(makeSignal({
      provider: claim.sourceFamily,
      laneId: claim.id,
      state: claim.grade,
      claim: claim.claim,
      evidence: claim.canShowAsFact ? [claim.customerLine] : [],
      missing: claim.missing,
    }));
  }

  for (const recheck of input.sourceFreshnessRecheckOrchestrator?.lanes ?? []) {
    const family = familyFromText(`${recheck.id} ${recheck.label} ${recheck.trigger} ${recheck.operatorLine}`);
    groups[family === "delivery" ? "freshness" : family].push(makeSignal({
      provider: "Velmere re-check orchestrator",
      laneId: recheck.id,
      state: recheck.status,
      claim: recheck.trigger || recheck.label,
      evidence: [recheck.proPdfLine],
      missing: recheck.blocksFinalSign ? [recheck.operatorLine] : [],
    }));
  }

  return groups;
}

export function buildPass2592ProviderConflictArbitrationMatrixReport(input: BuilderInput): Pass2592ProviderConflictArbitrationMatrixReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? input.providerRuntime?.target.chain ?? input.realProviderAdapterHardening?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? input.providerRuntime?.target.contractAddress ?? input.realProviderAdapterHardening?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.providerRuntime?.target.projectName ?? input.realProviderAdapterHardening?.target.projectName;
  const groups = collectSignals(input);
  const calibrationBlocks = Boolean(input.riskCalibrationGoldenFixtureHarness && !input.riskCalibrationGoldenFixtureHarness.summary.canFinalSignAdvancedCalibration);
  const matrix = (Object.keys(groups) as Pass2592ArbitrationFamily[])
    .map((family) => buildConflictRow(locale, family, groups[family], calibrationBlocks))
    .sort((a, b) => {
      const severityRank = { critical: 5, high: 4, medium: 3, low: 2, none: 1 } as const;
      return severityRank[b.severity] - severityRank[a.severity] || b.confidencePenalty - a.confidencePenalty;
    });

  const summary = {
    rows: matrix.length,
    aligned: matrix.filter((item) => item.state === "aligned").length,
    partialAlignment: matrix.filter((item) => item.state === "partial_alignment").length,
    missingCounterparty: matrix.filter((item) => item.state === "missing_counterparty").length,
    providerDivergence: matrix.filter((item) => item.state === "provider_divergence").length,
    freshnessConflict: matrix.filter((item) => item.state === "freshness_conflict").length,
    needsOperator: matrix.filter((item) => item.state === "needs_operator").length,
    blocked: matrix.filter((item) => item.state === "blocked").length,
    blockingConflicts: matrix.filter((item) => item.blocksFinalSign).length,
    totalRiskDelta: clamp(matrix.reduce((sum, item) => sum + item.riskDelta, 0), 0, 100),
    totalConfidencePenalty: clamp(matrix.reduce((sum, item) => sum + item.confidencePenalty, 0), 0, 100),
    arbitrationReadiness: 0,
    canShowUnifiedVerdict: false,
    canIssueProWithConflicts: false,
    canFinalSignAdvancedWithConflicts: false,
    nextCriticalConflict: "none",
  };
  summary.arbitrationReadiness = clamp(100 - summary.totalConfidencePenalty - summary.blockingConflicts * 8 - summary.providerDivergence * 6, 0, 100);
  summary.canShowUnifiedVerdict = summary.blockingConflicts === 0 && summary.providerDivergence === 0 && summary.arbitrationReadiness >= 55;
  summary.canIssueProWithConflicts = summary.blocked === 0 && summary.arbitrationReadiness >= 46 && (input.riskFormulaEvidenceWeightingContract?.summary.canIssueProScore ?? true);
  summary.canFinalSignAdvancedWithConflicts = summary.blockingConflicts === 0 && summary.arbitrationReadiness >= 72 && (input.riskCalibrationGoldenFixtureHarness?.summary.canFinalSignAdvancedCalibration ?? false);
  summary.nextCriticalConflict = matrix.find((item) => item.blocksFinalSign)?.label ?? matrix.find((item) => item.state !== "aligned")?.label ?? "none";

  return {
    passId: PASS2592_PROVIDER_CONFLICT_ARBITRATION_MATRIX_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { chain, contractAddress, projectName },
    rule: "Provider conflicts must be explicit: no source disagreement may be hidden behind a single score or a clean PDF sentence.",
    customerRule: t(locale, "Jeśli źródła się różnią, Velmère pokazuje limit zaufania zamiast udawać fakt.", "Wenn Quellen abweichen, zeigt Velmère ein Confidence-Limit statt einen Fakt vorzutäuschen.", "When sources disagree, Velmère shows a confidence boundary instead of pretending it is a fact."),
    proRule: "Pro PDF includes conflict state, primary/counterparty providers, risk delta, confidence penalty, and the exact operator action.",
    operatorRule: "Operator may resolve conflicts only by adding a new evidence row, new receipt/version when material, and redaction-safe customer wording.",
    summary,
    conflictMatrix: matrix,
    customerRows: matrix.slice(0, 8).map((item) => row(item.label, item.state, item.customerLine)),
    proPdfRows: matrix.slice(0, 12).map((item) => row(item.label, item.state, item.proPdfLine)),
    operatorRows: matrix.slice(0, 12).map((item) => row(item.label, item.state, `${item.operatorLine} action=${item.action}; canShowAsFact=${item.canShowAsFact}; blocksFinal=${item.blocksFinalSign}`)),
    arbitrationContract: {
      version: "pass2592.v1",
      invariant: "Primary source priority never overrides an explicit counterparty conflict without a visible confidence penalty.",
      primarySourceRules: [
        "Explorer/source/ABI is primary for contract identity and function surface.",
        "DEX pair and LP sources are primary for liquidity, but cannot override holder concentration alone.",
        "GoPlus/Honeypot-style security flags are signals, not final proof, unless corroborated by source/ABI or runtime trade evidence.",
        "DeFiLlama/market metadata can contextualize liquidity but cannot prove contract safety.",
      ],
      conflictDowngradeRules: [
        "One confirmed source and one missing/error source creates at least a missing counterparty penalty.",
        "Freshness mismatch creates a re-check requirement and blocks high-confidence wording.",
        "Provider divergence blocks Advanced final sign-off until operator resolution.",
        "Payment/account delivery state never lowers technical risk or resolves a provider conflict.",
      ],
      noSilentTieBreakerRules: [
        "No silent majority vote: show the conflict and downgrade confidence.",
        "No old report mutation: create a new receipt/version if the resolution changes material risk.",
        "No customer-facing raw provider payload; expose only safe conflict wording.",
      ],
    },
    visualMergeContract: {
      publicSlot: "Basic audit conflict panel below risk formula / calibration panels.",
      proPdfSlot: "Provider conflict appendix after calibration section.",
      operatorSlot: "Operator conflict resolution queue with action, evidence refs and final-sign blocker flag.",
      rule: "Your visual redesign may replace layout, but must keep state, severity, riskDelta, confidencePenalty and blocksFinalSign wired.",
      keepWired: ["summary.arbitrationReadiness", "summary.blockingConflicts", "summary.canShowUnifiedVerdict", "conflictMatrix[].state", "conflictMatrix[].blocksFinalSign", "conflictMatrix[].confidencePenalty"],
      doNotExpose: ["raw provider payloads", "API keys", "operator notes before redaction", "private account delivery pointers"],
    },
    nextImplementationBacklog: [
      "Persist operator conflict resolution events in the durable case vault.",
      "Add real provider payload diff snapshots for DEX / Honeypot / GoPlus disagreements.",
      "Connect conflict penalties directly into PASS2590 final score bands.",
      "Add visual conflict timeline for Pro PDF after user visual design merge.",
      "Add golden fixtures for contradictory provider states.",
    ],
  };
}
