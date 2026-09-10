import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";
import { getVlmCurrentSkuTruth } from "@/lib/commerce/vlm-current-sku-truth";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2573AuditRuntimeConfidenceReport } from "./audit-runtime-confidence";
import type { Pass2575AuditSourceFreshnessReport } from "./audit-source-freshness";
import type { Pass2576AuditPermissionParserReport } from "./audit-permission-parser";
import type { Pass2577AuditLiquidityHolderLockRiskReport } from "./audit-liquidity-holder-lock-risk";
import type { Pass2584HolderLiquidityDepthEvidenceReport } from "./holder-liquidity-depth-evidence";
import type { Pass2586AdvancedOperatorConsoleMergeReport } from "./advanced-operator-console-merge";
import type { Pass2589SourceFreshnessRecheckOrchestratorReport } from "./source-freshness-recheck-orchestrator";

export const PASS2590_RISK_FORMULA_EVIDENCE_WEIGHTING_CONTRACT_ID = "risk-formula-evidence-weighting-contract" as const;

export type Pass2590WeightState = "confirmed" | "partial" | "missing" | "blocked" | "stale" | "operator_review" | "locked";
export type Pass2590FormulaFamily =
  | "runtime_confidence"
  | "permission_surface"
  | "liquidity_depth"
  | "freshness_decay"
  | "holder_exit_pressure"
  | "operator_signoff"
  | "missing_evidence"
  | "anti_random_score";

export type Pass2590WeightLane = {
  id: string;
  family: Pass2590FormulaFamily;
  label: string;
  state: Pass2590WeightState;
  weight: number;
  coverage: number;
  riskImpact: number;
  confidenceImpact: number;
  customerLine: string;
  proPdfLine: string;
  operatorLine: string;
  blocksFinalSign: boolean;
  evidenceRefs: string[];
  missingRefs: string[];
};

export type Pass2590FormulaRow = {
  label: string;
  state: Pass2590WeightState;
  output: string;
};

export type Pass2590RiskFormulaEvidenceWeightingContractReport = {
  passId: typeof PASS2590_RISK_FORMULA_EVIDENCE_WEIGHTING_CONTRACT_ID;
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
  scoreBoundary: string;
  summary: {
    baseRisk: number | null;
    weightedRiskDelta: number;
    finalRiskScore: number | null;
    scoreBand: "low" | "medium" | "high" | "unknown";
    sourceConfidence: number;
    formulaConfidence: number;
    evidenceCoverage: number;
    totalWeight: number;
    confirmedWeight: number;
    missingWeight: number;
    blockingLanes: number;
    canShowBasicScore: boolean;
    canIssueProScore: boolean;
    canFinalSignAdvancedScore: boolean;
    advancedScoreInternalReadiness: boolean;
    advancedSkuDecision: "NOT_FOR_SALE";
    nextCriticalStep: string;
  };
  lanes: Pass2590WeightLane[];
  customerRows: Pass2590FormulaRow[];
  proPdfRows: Pass2590FormulaRow[];
  operatorRows: Pass2590FormulaRow[];
  formulaContract: {
    version: string;
    invariant: string;
    scoreInputs: string[];
    scoreCaps: string[];
    downgradeRules: string[];
    antiRandomRules: string[];
  };
  calibrationPlan: Array<{ id: string; purpose: string; action: string }>;
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
  runtimeConfidence?: Pass2573AuditRuntimeConfidenceReport | null;
  sourceFreshness?: Pass2575AuditSourceFreshnessReport | null;
  permissionParser?: Pass2576AuditPermissionParserReport | null;
  liquidityHolderRisk?: Pass2577AuditLiquidityHolderLockRiskReport | null;
  holderLiquidityDepthEvidence?: Pass2584HolderLiquidityDepthEvidenceReport | null;
  advancedOperatorConsoleMerge?: Pass2586AdvancedOperatorConsoleMergeReport | null;
  sourceFreshnessRecheckOrchestrator?: Pass2589SourceFreshnessRecheckOrchestratorReport | null;
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

function scoreBand(score: number | null): Pass2590RiskFormulaEvidenceWeightingContractReport["summary"]["scoreBand"] {
  if (score === null) return "unknown";
  if (score >= 72) return "high";
  if (score >= 48) return "medium";
  if (score >= 18) return "low";
  return "unknown";
}

function stateLine(locale: string, state: Pass2590WeightState) {
  if (state === "confirmed") return t(locale, "potwierdzone", "bestaetigt", "confirmed");
  if (state === "partial") return t(locale, "częściowe", "teilweise", "partial");
  if (state === "stale") return t(locale, "wygasa / stale", "veraltet", "stale");
  if (state === "operator_review") return t(locale, "operator review", "Operator Review", "operator review");
  if (state === "locked") return t(locale, "zablokowane bezpiecznie", "sicher gesperrt", "safely locked");
  if (state === "blocked") return t(locale, "zablokowane", "blockiert", "blocked");
  return t(locale, "brak dowodu", "Nachweis fehlt", "missing evidence");
}

function lane(args: Pass2590WeightLane): Pass2590WeightLane {
  return {
    ...args,
    coverage: clamp(args.coverage, 0, 100),
    riskImpact: clamp(args.riskImpact, -35, 45),
    confidenceImpact: clamp(args.confidenceImpact, -30, 30),
    evidenceRefs: uniq(args.evidenceRefs),
    missingRefs: uniq(args.missingRefs),
  };
}

function row(label: string, state: Pass2590WeightState, output: string): Pass2590FormulaRow {
  return { label, state, output };
}

function stateCoverage(state: Pass2590WeightState) {
  if (state === "confirmed" || state === "locked") return 1;
  if (state === "partial") return 0.62;
  if (state === "operator_review") return 0.54;
  if (state === "stale") return 0.38;
  if (state === "blocked") return 0.22;
  return 0.08;
}

function stateRiskPenalty(state: Pass2590WeightState, base: number) {
  if (state === "confirmed" || state === "locked") return -Math.round(base * 0.26);
  if (state === "partial") return Math.round(base * 0.18);
  if (state === "operator_review") return Math.round(base * 0.28);
  if (state === "stale") return Math.round(base * 0.38);
  if (state === "blocked") return Math.round(base * 0.55);
  return Math.round(base * 0.72);
}

function stateConfidenceDelta(state: Pass2590WeightState, weight: number) {
  if (state === "confirmed" || state === "locked") return Math.round(weight * 0.42);
  if (state === "partial") return Math.round(weight * 0.12);
  if (state === "operator_review") return -Math.round(weight * 0.06);
  if (state === "stale") return -Math.round(weight * 0.2);
  if (state === "blocked") return -Math.round(weight * 0.32);
  return -Math.round(weight * 0.45);
}

export function buildPass2590RiskFormulaEvidenceWeightingContractReport(input: BuilderInput): Pass2590RiskFormulaEvidenceWeightingContractReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const runtime = input.runtimeConfidence;
  const freshness = input.sourceFreshness;
  const permissions = input.permissionParser;
  const liquidity = input.liquidityHolderRisk;
  const depth = input.holderLiquidityDepthEvidence;
  const operator = input.advancedOperatorConsoleMerge;
  const recheck = input.sourceFreshnessRecheckOrchestrator;
  const chain = clean(input.chain, 40) ?? runtime?.target.chain ?? freshness?.target.chain ?? permissions?.target.chain ?? liquidity?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? runtime?.target.contractAddress ?? permissions?.target.contractAddress ?? liquidity?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? runtime?.target.projectName ?? permissions?.target.projectName ?? liquidity?.target.projectName;

  const runtimeRisk = runtime?.overall.riskScore;
  const baseRisk = typeof runtimeRisk === "number" && Number.isFinite(runtimeRisk) ? clamp(runtimeRisk, 0, 100) : null;
  const sourceConfidence = runtime?.overall.sourceConfidence ?? 38;
  const permissionState: Pass2590WeightState = (permissions?.summary.blocked ?? 0) > 0
    ? "blocked"
    : (permissions?.summary.elevatedOrCritical ?? 0) > 0
      ? "operator_review"
      : (permissions?.summary.unknown ?? 1) === 0
        ? "confirmed"
        : "partial";
  const liquidityState: Pass2590WeightState = (depth?.summary.blockers ?? 0) > 0 || (liquidity?.summary.missing ?? 0) > 1
    ? "missing"
    : (depth?.summary.canFinalSignLiquidityDepth || liquidity?.summary.confirmed)
      ? "confirmed"
      : (depth?.summary.partial ?? 0) > 0 || (liquidity?.summary.partial ?? 0) > 0
        ? "partial"
        : "operator_review";
  const freshnessState: Pass2590WeightState = recheck?.summary.canFinalSignAfterRecheck
    ? "confirmed"
    : recheck?.summary.ready || recheck?.summary.watch
      ? "stale"
      : (freshness?.summary.expired ?? 0) > 0
        ? "stale"
        : "partial";
  const runtimeState: Pass2590WeightState = (runtime?.overall.runtimeConfirmedLanes ?? 0) >= 3 ? "confirmed" : (runtime?.overall.runtimeLiveLanes ?? 0) > 0 ? "partial" : "missing";
  const operatorState: Pass2590WeightState = operator?.summary.canFinalSignAdvanced ? "locked" : operator?.summary.canOpenAdvancedCase ? "operator_review" : "blocked";
  const missingEvidenceCount = (runtime?.topMissingEvidence.length ?? 0) + (permissions?.summary.unknown ?? 0) + (liquidity?.summary.missing ?? 0) + (depth?.summary.blockers ?? 0);
  const missingState: Pass2590WeightState = missingEvidenceCount === 0 ? "confirmed" : missingEvidenceCount <= 4 ? "partial" : "missing";

  const lanes: Pass2590WeightLane[] = [
    lane({
      id: "runtime-confidence-weight",
      family: "runtime_confidence",
      label: "Runtime confidence baseline",
      state: runtimeState,
      weight: 22,
      coverage: runtime?.overall.sourceCoverageScore ?? stateCoverage(runtimeState) * 100,
      riskImpact: stateRiskPenalty(runtimeState, 12),
      confidenceImpact: stateConfidenceDelta(runtimeState, 22),
      customerLine: t(locale, "Score startuje od live/source confidence, nie od losowej liczby.", "Score startet von Live/Source Confidence, nicht von Zufall.", "Score starts from live/source confidence, not a random number."),
      proPdfLine: `baseRisk=${baseRisk ?? "unavailable"}; sourceConfidence=${sourceConfidence}; runtimeConfirmed=${runtime?.overall.runtimeConfirmedLanes ?? 0}; runtimeProblems=${runtime?.overall.runtimeProblemLanes ?? 0}`,
      operatorLine: "Review runtime baseline before any manual override; no model-only final score is allowed.",
      blocksFinalSign: runtimeState === "missing",
      evidenceRefs: runtime?.decisions.slice(0, 4).map((item) => item.label) ?? [],
      missingRefs: runtime?.topMissingEvidence.slice(0, 4) ?? [],
    }),
    lane({
      id: "permission-surface-weight",
      family: "permission_surface",
      label: "Permission / admin surface",
      state: permissionState,
      weight: 20,
      coverage: permissions ? clamp(((permissions.summary.detected + permissions.summary.notDetected) / Math.max(1, permissions.summary.totalSignals)) * 100, 0, 100) : 0,
      riskImpact: (permissions?.summary.riskDelta ?? 0) + stateRiskPenalty(permissionState, 14),
      confidenceImpact: (permissions?.summary.confidenceDelta ?? 0) + stateConfidenceDelta(permissionState, 20),
      customerLine: t(locale, "Owner, proxy, mint, pause, blacklist i tax wpływają na score przez jawne wagi.", "Owner, Proxy, Mint, Pause, Blacklist und Tax beeinflussen den Score ueber klare Gewichte.", "Owner, proxy, mint, pause, blacklist and tax affect the score through explicit weights."),
      proPdfLine: `signals=${permissions?.summary.totalSignals ?? 0}; elevatedOrCritical=${permissions?.summary.elevatedOrCritical ?? 0}; riskDelta=${permissions?.summary.riskDelta ?? 0}`,
      operatorLine: "Critical admin/proxy permissions can cap customer confidence until source/ABI evidence is verified.",
      blocksFinalSign: (["blocked", "missing"] as Pass2590WeightState[]).includes(permissionState),
      evidenceRefs: permissions?.signals.filter((item) => item.evidence.length).slice(0, 4).map((item) => item.label) ?? [],
      missingRefs: (permissions?.signals ?? []).reduce<string[]>((items, item) => items.concat(item.missing), []).slice(0, 5),
    }),
    lane({
      id: "liquidity-depth-weight",
      family: "liquidity_depth",
      label: "Liquidity / holder depth",
      state: liquidityState,
      weight: 20,
      coverage: depth?.summary.depthReadiness ?? (liquidity ? clamp(((liquidity.summary.confirmed + liquidity.summary.partial * 0.55) / Math.max(1, liquidity.summary.totalSignals)) * 100, 0, 100) : 0),
      riskImpact: (depth?.summary.riskDelta ?? liquidity?.summary.riskDelta ?? 0) + stateRiskPenalty(liquidityState, 16),
      confidenceImpact: (depth?.summary.confidenceDelta ?? liquidity?.summary.confidenceDelta ?? 0) + stateConfidenceDelta(liquidityState, 20),
      customerLine: t(locale, "Liquidity, holders, LP ownership i exit pressure nie są copy — mają osobny udział w formule.", "Liquidity, Holder, LP Ownership und Exit Pressure haben eigene Formel-Gewichte.", "Liquidity, holders, LP ownership and exit pressure have their own formula weights."),
      proPdfLine: `depthReadiness=${depth?.summary.depthReadiness ?? 0}; blockers=${depth?.summary.blockers ?? 0}; liquidityCoverage=${liquidity?.summary.liquidityCoverageLabel ?? "unknown"}`,
      operatorLine: "Do not final-sign a low-risk score if liquidity/holders/locks are missing or only partially confirmed.",
      blocksFinalSign: (["missing", "blocked"] as Pass2590WeightState[]).includes(liquidityState),
      evidenceRefs: depth?.publicRows.filter((item) => item.state === "confirmed").slice(0, 4).map((item) => item.label) ?? [],
      missingRefs: depth?.operatorRows.filter((item) => item.state !== "confirmed").slice(0, 5).map((item) => item.output) ?? [],
    }),
    lane({
      id: "freshness-decay-weight",
      family: "freshness_decay",
      label: "Freshness decay / re-check",
      state: freshnessState,
      weight: 14,
      coverage: recheck?.summary.freshnessReplayReadiness ?? (freshness ? clamp(((freshness.summary.fresh + freshness.summary.acceptable * 0.82 + freshness.summary.static * 0.6) / Math.max(1, freshness.summary.totalLanes)) * 100, 0, 100) : stateCoverage(freshnessState) * 100),
      riskImpact: stateRiskPenalty(freshnessState, 10) + ((recheck?.summary.mustCreateNewVersion ?? false) ? 8 : 0),
      confidenceImpact: stateConfidenceDelta(freshnessState, 14) - ((recheck?.summary.ready ?? 0) * 2),
      customerLine: t(locale, "Stare źródła obniżają confidence i mogą wymagać nowej wersji raportu.", "Alte Quellen senken Confidence und koennen eine neue Report-Version erzwingen.", "Stale sources lower confidence and can require a new report version."),
      proPdfLine: `freshnessReadiness=${recheck?.summary.freshnessReplayReadiness ?? 0}; nextCheckAt=${recheck?.summary.nextRecheckAt ?? "preview"}; mustCreateNewVersion=${recheck?.summary.mustCreateNewVersion ?? false}`,
      operatorLine: "Freshness decay must be applied before claiming a score is final; stale lanes cannot be hidden.",
      blocksFinalSign: (["stale", "blocked"] as Pass2590WeightState[]).includes(freshnessState),
      evidenceRefs: recheck?.customerRows.slice(0, 3).map((item) => item.label) ?? [],
      missingRefs: recheck?.lanes.filter((item) => item.blocksFinalSign).slice(0, 5).map((item) => item.label) ?? [],
    }),
    lane({
      id: "operator-signoff-weight",
      family: "operator_signoff",
      label: "Advanced independent-review status",
      state: operatorState,
      weight: 14,
      coverage: operator?.summary.finalSignReadiness ?? stateCoverage(operatorState) * 100,
      riskImpact: stateRiskPenalty(operatorState, 8),
      confidenceImpact: stateConfidenceDelta(operatorState, 14),
      customerLine: t(locale, "Advanced nie jest na sprzedaż; brak niezależnego review. Basic pokazuje wyłącznie ograniczony wynik opisowy.", "Advanced ist nicht zum Verkauf; unabhängige Review-Nachweise fehlen. Basic zeigt nur einen begrenzten beschreibenden Score.", "Advanced is not for sale; independent review evidence remains absent. Basic exposes only a bounded descriptive score."),
      proPdfLine: `operatorReadiness=${operator?.summary.operatorConsoleReadiness ?? 0}; finalSign=${operator?.summary.canFinalSignAdvanced ?? false}; customerDeliver=${operator?.summary.canCustomerDeliverAdvanced ?? false}`,
      operatorLine: "Internal quality-control state may block release, but cannot lower evidence requirements or imply human review.",
      blocksFinalSign: operatorState === "blocked" || operatorState === "operator_review",
      evidenceRefs: operator?.customerRows.slice(0, 4).map((item) => item.label) ?? [],
      missingRefs: operator?.finalSignoffState.blockers.slice(0, 5) ?? [],
    }),
    lane({
      id: "missing-evidence-cap-weight",
      family: "missing_evidence",
      label: "Missing evidence cap",
      state: missingState,
      weight: 10,
      coverage: clamp(100 - missingEvidenceCount * 9, 8, 100),
      riskImpact: stateRiskPenalty(missingState, 12) + Math.min(18, missingEvidenceCount * 2),
      confidenceImpact: stateConfidenceDelta(missingState, 10) - Math.min(16, missingEvidenceCount * 2),
      customerLine: t(locale, "Braki dowodowe nakładają cap na confidence i blokują zbyt pewny werdykt.", "Evidence-Gaps deckeln Confidence und blockieren zu sichere Verdicts.", "Missing evidence caps confidence and blocks overconfident verdicts."),
      proPdfLine: `missingEvidenceCount=${missingEvidenceCount}; confidenceCapRule=true; overclaimBrake=true`,
      operatorLine: "Every missing blocker must be either resolved, downgraded or visible in customer-safe missing evidence.",
      blocksFinalSign: missingState === "missing",
      evidenceRefs: ["explicit missing evidence ledger"],
      missingRefs: [
        ...(runtime?.topMissingEvidence ?? []),
        ...((permissions?.signals ?? []).reduce<string[]>((items, item) => items.concat(item.missing), [])),
        ...((liquidity?.signals ?? []).reduce<string[]>((items, item) => items.concat(item.missing), [])),
      ].slice(0, 7),
    }),
  ];

  const totalWeight = lanes.reduce((sum, item) => sum + item.weight, 0) || 1;
  const confirmedWeight = lanes.filter((item) => item.state === "confirmed" || item.state === "locked").reduce((sum, item) => sum + item.weight, 0);
  const missingWeight = lanes.filter((item) => item.state === "missing" || item.state === "blocked" || item.state === "stale").reduce((sum, item) => sum + item.weight, 0);
  const weightedRiskDelta = clamp(lanes.reduce((sum, item) => sum + item.riskImpact * (item.weight / totalWeight), 0), -35, 45);
  const rawRisk = baseRisk === null ? null : baseRisk + weightedRiskDelta;
  const evidenceCoverage = clamp(lanes.reduce((sum, item) => sum + item.coverage * item.weight, 0) / totalWeight, 0, 100);
  const blockingLanes = lanes.filter((item) => item.blocksFinalSign).length;
  const confidenceDelta = lanes.reduce((sum, item) => sum + item.confidenceImpact * (item.weight / totalWeight), 0);
  const formulaConfidence = clamp(sourceConfidence + confidenceDelta + evidenceCoverage * 0.16 - missingWeight * 0.18 - blockingLanes * 6, 12, 96);
  const finalRiskScore = rawRisk === null ? null : clamp(rawRisk + (formulaConfidence < 42 ? 7 : 0) + (blockingLanes >= 3 ? 6 : 0), 8, 98);
  const canShowBasicScore = finalRiskScore !== null && evidenceCoverage >= 28 && formulaConfidence >= 25;
  const canIssueProScore = finalRiskScore !== null && evidenceCoverage >= 48 && formulaConfidence >= 42 && missingWeight <= 38;
  const advancedSku = getVlmCurrentSkuTruth("advanced", locale);
  if (advancedSku.decision !== "NOT_FOR_SALE") {
    throw new Error("risk_formula_advanced_sku_must_remain_not_for_sale");
  }
  const canFinalSignAdvancedScore = false; // Advanced is NOT_FOR_SALE in the current canonical SKU truth.
  const advancedScoreInternalReadiness = canIssueProScore && blockingLanes === 0 && formulaConfidence >= 58;
  const nextCriticalStep = lanes.find((item) => item.blocksFinalSign)?.label ?? lanes.find((item) => item.state !== "confirmed" && item.state !== "locked")?.label ?? "none";

  return {
    passId: PASS2590_RISK_FORMULA_EVIDENCE_WEIGHTING_CONTRACT_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { chain, contractAddress, projectName },
    rule: "PASS2590 makes the risk score evidence-weighted: no score may be final without visible weights, caps, freshness decay and missing-evidence downgrades.",
    customerRule: t(locale, "Risk score wynika z ważonych dowodów i braków — nie jest generowany losowo przez AI.", "Risk Score entsteht aus gewichteten Nachweisen und Gaps — nicht zufaellig durch AI.", "Risk score comes from weighted evidence and gaps — it is not randomly generated by AI."),
    proRule: "Pro PDF must show score inputs, confidence caps and missing-evidence downgrades without leaking raw internal quality-control payloads.",
    operatorRule: "Internal quality control may annotate formula lanes, but cannot release over blocked source, freshness, liquidity, rights, or evidence gates.",
    scoreBoundary: "Scores are bounded by source confidence, freshness, liquidity/holder depth, permission surface and visible missing evidence.",
    summary: {
      baseRisk,
      weightedRiskDelta,
      finalRiskScore,
      scoreBand: scoreBand(finalRiskScore),
      sourceConfidence,
      formulaConfidence,
      evidenceCoverage,
      totalWeight,
      confirmedWeight,
      missingWeight,
      blockingLanes,
      canShowBasicScore,
      canIssueProScore,
      canFinalSignAdvancedScore,
      advancedScoreInternalReadiness,
      advancedSkuDecision: advancedSku.decision,
      nextCriticalStep,
    },
    lanes,
    customerRows: lanes.slice(0, 6).map((item) => row(item.label, item.state, `${item.customerLine} ${t(locale, "Stan", "Status", "State")}: ${stateLine(locale, item.state)}; weight ${item.weight}; confidence ${item.confidenceImpact >= 0 ? "+" : ""}${item.confidenceImpact}.`)),
    proPdfRows: lanes.map((item) => row(item.label, item.state, `${item.proPdfLine}; riskImpact=${item.riskImpact}; confidenceImpact=${item.confidenceImpact}; coverage=${item.coverage}/100`)),
    operatorRows: lanes.map((item) => row(item.label, item.state, `${item.operatorLine} Blocks final sign: ${item.blocksFinalSign}. Missing: ${item.missingRefs.join(" | ") || "none"}`)),
    formulaContract: {
      version: "vlm-risk-formula-v0.1-pass2590",
      invariant: "Final risk score = bounded baseline + weighted evidence deltas + missing/freshness caps; never model-only.",
      scoreInputs: ["runtime confidence", "permission/admin surface", "liquidity/holder depth", "freshness/re-check state", "independent review status", "missing evidence"],
      scoreCaps: ["low confidence caps certainty", "stale sources downgrade confidence", "missing liquidity/holder data blocks low-risk final sign", "Advanced remains blocked until independent review evidence exists"],
      downgradeRules: ["missing critical evidence raises risk and lowers confidence", "stale source lanes create re-check blocker", "blocked provider state cannot become confirmed by AI text", "manual override requires an internal quality-control row and cannot authorize Advanced release"],
      antiRandomRules: ["no random/default score", "every delta has a lane", "customer sees missing evidence", "internal quality control sees private blockers", "replay creates new version when material"],
    },
    calibrationPlan: [
      { id: "calibrate-known-clean", purpose: "reduce false positives", action: "run known verified/liquid tokens and record expected low/medium boundaries" },
      { id: "calibrate-known-risk", purpose: "catch rug/exit patterns", action: "run known honeypot/high-tax/low-liquidity fixtures and assert elevated/high boundaries" },
      { id: "freshness-decay-fixture", purpose: "prevent stale certainty", action: "age provider lanes and ensure confidence decays before final sign" },
      { id: "operator-override-fixture", purpose: "prevent hidden manual override", action: "test that operator notes cannot bypass missing evidence blocks" },
    ],
    visualMergeContract: {
      publicSlot: "Basic audit -> score formula / evidence-weight card",
      proPdfSlot: "Pro PDF -> score formula appendix + visible confidence caps",
      operatorSlot: "Advanced console -> formula lane editor/reviewer",
      rule: "User visual may redesign score cards, but finalRiskScore, formulaConfidence, evidenceCoverage, blockingLanes and lane rows must remain wired.",
      keepWired: ["summary.finalRiskScore", "summary.formulaConfidence", "summary.evidenceCoverage", "summary.blockingLanes", "lanes[].weight", "lanes[].riskImpact"],
      doNotExpose: ["raw provider payload", "private operator notes", "API key errors", "billing/account private identifiers"],
    },
    nextImplementationBacklog: [
      "Persist formula version with every receipt so old scores remain reproducible.",
      "Add fixture testbench for known-clean and known-risk projects.",
      "Add Pro PDF score appendix with visual weights and caps.",
      "Keep Advanced unreleased; prepare independent-review evidence and dual-control quality gates before any future SKU decision.",
      "Calibrate thresholds after real provider adapters are connected to live keys.",
    ],
  };
}
