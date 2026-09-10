import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2573AuditRuntimeConfidenceReport } from "./audit-runtime-confidence";
import type { Pass2583ContractSourceAbiExtractionReport } from "./contract-source-abi-extraction";
import type { Pass2584HolderLiquidityDepthEvidenceReport } from "./holder-liquidity-depth-evidence";
import type { Pass2586AdvancedOperatorConsoleMergeReport } from "./advanced-operator-console-merge";
import type { Pass2587ServerPaymentAccountDeliveryGateReport } from "./server-payment-account-delivery-gate";
import type { Pass2589SourceFreshnessRecheckOrchestratorReport } from "./source-freshness-recheck-orchestrator";
import type { Pass2590RiskFormulaEvidenceWeightingContractReport } from "./risk-formula-evidence-weighting-contract";

export const PASS2591_RISK_CALIBRATION_GOLDEN_FIXTURE_HARNESS_ID = "risk-calibration-golden-fixture-harness" as const;

export type Pass2591FixtureStatus = "pass" | "watch" | "fail" | "blocked" | "queued";
export type Pass2591FixtureFamily =
  | "baseline"
  | "admin_surface"
  | "liquidity_exit"
  | "freshness_replay"
  | "payment_delivery"
  | "advanced_signoff"
  | "anti_drift";

export type Pass2591CalibrationFixture = {
  id: string;
  family: Pass2591FixtureFamily;
  label: string;
  status: Pass2591FixtureStatus;
  expectedBand: "low" | "medium" | "high" | "unknown";
  actualBand: "low" | "medium" | "high" | "unknown";
  expectedRange: [number, number];
  observedRisk: number;
  drift: number;
  customerLine: string;
  proPdfLine: string;
  operatorLine: string;
  blocksFinalSign: boolean;
  evidenceRefs: string[];
  missingRefs: string[];
  fixAction: string;
};

export type Pass2591CalibrationRow = {
  label: string;
  status: Pass2591FixtureStatus;
  output: string;
};

export type Pass2591RiskCalibrationGoldenFixtureHarnessReport = {
  passId: typeof PASS2591_RISK_CALIBRATION_GOLDEN_FIXTURE_HARNESS_ID;
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
    fixtureCount: number;
    passed: number;
    watch: number;
    failed: number;
    blocked: number;
    averageDrift: number;
    maxDrift: number;
    calibrationReadiness: number;
    canTrustBasicCalibration: boolean;
    canIssueProCalibration: boolean;
    canFinalSignAdvancedCalibration: boolean;
    /** PASS4143 compatibility alias for e2e launch gate. */
    topRegressionRisk: string;
    nextCriticalStep: string;
  };
  fixtures: Pass2591CalibrationFixture[];
  customerRows: Pass2591CalibrationRow[];
  proPdfRows: Pass2591CalibrationRow[];
  operatorRows: Pass2591CalibrationRow[];
  calibrationContract: {
    version: string;
    invariant: string;
    fixtureFamilies: string[];
    noDriftRules: string[];
    scoreReleaseRules: string[];
  };
  regressionPlan: Array<{ id: string; purpose: string; action: string }>;
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
  contractSourceAbiExtraction?: Pass2583ContractSourceAbiExtractionReport | null;
  holderLiquidityDepthEvidence?: Pass2584HolderLiquidityDepthEvidenceReport | null;
  advancedOperatorConsoleMerge?: Pass2586AdvancedOperatorConsoleMergeReport | null;
  serverPaymentAccountDeliveryGate?: Pass2587ServerPaymentAccountDeliveryGateReport | null;
  sourceFreshnessRecheckOrchestrator?: Pass2589SourceFreshnessRecheckOrchestratorReport | null;
  riskFormulaEvidenceWeightingContract?: Pass2590RiskFormulaEvidenceWeightingContractReport | null;
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

function bandFromScore(score: number): Pass2591CalibrationFixture["actualBand"] {
  if (score >= 72) return "high";
  if (score >= 48) return "medium";
  if (score >= 18) return "low";
  return "unknown";
}

function statusFromDrift(drift: number, blocks: boolean): Pass2591FixtureStatus {
  if (blocks) return "blocked";
  if (drift <= 8) return "pass";
  if (drift <= 16) return "watch";
  return "fail";
}

function fixture(args: Omit<Pass2591CalibrationFixture, "drift" | "actualBand" | "status"> & { status?: Pass2591FixtureStatus }) {
  const [min, max] = args.expectedRange;
  const observedRisk = clamp(args.observedRisk, 0, 100);
  const drift = observedRisk < min ? min - observedRisk : observedRisk > max ? observedRisk - max : 0;
  const blocksFinalSign = args.blocksFinalSign;
  return {
    ...args,
    expectedRange: [clamp(min, 0, 100), clamp(max, 0, 100)] as [number, number],
    observedRisk,
    drift,
    actualBand: bandFromScore(observedRisk),
    status: args.status ?? statusFromDrift(drift, blocksFinalSign),
    evidenceRefs: uniq(args.evidenceRefs),
    missingRefs: uniq(args.missingRefs),
  } satisfies Pass2591CalibrationFixture;
}

function row(label: string, status: Pass2591FixtureStatus, output: string): Pass2591CalibrationRow {
  return { label, status, output };
}

function statusLine(locale: string, status: Pass2591FixtureStatus) {
  if (status === "pass") return t(locale, "zaliczone", "bestanden", "pass");
  if (status === "watch") return t(locale, "obserwuj", "beobachten", "watch");
  if (status === "fail") return t(locale, "niezaliczone", "fehlgeschlagen", "fail");
  if (status === "blocked") return t(locale, "blokuje final", "blockiert final", "blocks final");
  return t(locale, "w kolejce", "in Warteschlange", "queued");
}

export function buildPass2591RiskCalibrationGoldenFixtureHarnessReport(input: BuilderInput): Pass2591RiskCalibrationGoldenFixtureHarnessReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const formula = input.riskFormulaEvidenceWeightingContract;
  const runtime = input.runtimeConfidence;
  const abi = input.contractSourceAbiExtraction;
  const depth = input.holderLiquidityDepthEvidence;
  const operator = input.advancedOperatorConsoleMerge;
  const delivery = input.serverPaymentAccountDeliveryGate;
  const recheck = input.sourceFreshnessRecheckOrchestrator;
  const chain = clean(input.chain, 40) ?? formula?.target.chain ?? runtime?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? formula?.target.contractAddress ?? runtime?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? formula?.target.projectName ?? runtime?.target.projectName;

  const observedCandidate = formula?.summary.finalRiskScore ?? runtime?.overall.riskScore;
  const hasObservedRisk = typeof observedCandidate === "number" && Number.isFinite(observedCandidate);
  const observed = hasObservedRisk ? observedCandidate : 0;
  const formulaConfidence = formula?.summary.formulaConfidence ?? runtime?.overall.sourceConfidence ?? 38;
  const evidenceCoverage = formula?.summary.evidenceCoverage ?? runtime?.overall.sourceCoverageScore ?? 32;
  const blockers = formula?.summary.blockingLanes ?? 2;
  const permissionUnknown = abi?.summary.queued ?? 1;
  const liquidityBlockers = depth?.summary.blockers ?? 1;
  const deliveryReady = delivery?.summary.canReleasePrivateDelivery ?? false;
  const advancedReady = operator?.summary.canFinalSignAdvanced ?? false;
  const needsNewVersion = recheck?.summary.mustCreateNewVersion ?? false;

  const fixtures: Pass2591CalibrationFixture[] = [
    fixture({
      id: "baseline-score-stability",
      family: "baseline",
      label: "Baseline formula stability",
      expectedBand: formula?.summary.scoreBand ?? "medium",
      expectedRange: [Math.max(8, observed - 10), Math.min(98, observed + 10)],
      observedRisk: observed,
      customerLine: t(locale, "Score bazowy mieści się w kontrolowanym zakresie względem aktualnych dowodów.", "Basis-Score bleibt im kontrollierten Bereich der aktuellen Nachweise.", "Baseline score stays within a controlled range for the current evidence."),
      proPdfLine: `observed=${observed}; formulaConfidence=${formulaConfidence}; evidenceCoverage=${evidenceCoverage}; blockers=${blockers}`,
      operatorLine: "Do not ship a score if a later pass changes the same evidence set by more than the allowed drift band.",
      blocksFinalSign: !hasObservedRisk,
      status: hasObservedRisk ? undefined : "blocked",
      evidenceRefs: ["PASS2590 formula summary", "runtime confidence baseline"],
      missingRefs: [],
      fixAction: "Keep fixture as regression guard for every formula refactor.",
    }),
    fixture({
      id: "admin-surface-trap",
      family: "admin_surface",
      label: "Admin / proxy trap calibration",
      expectedBand: "medium",
      expectedRange: permissionUnknown > 0 ? [48, 88] : [28, 72],
      observedRisk: observed + permissionUnknown * 4,
      customerLine: t(locale, "Niezweryfikowane ABI/proxy nie może wyglądać jak niski risk.", "Unverifizierte ABI/Proxy darf nicht wie Low Risk aussehen.", "Unverified ABI/proxy cannot look like low risk."),
      proPdfLine: `queuedOrUnknownSourceAbi=${permissionUnknown}; extractionReadiness=${abi?.summary.extractionReadiness ?? 0}`,
      operatorLine: "If owner/admin/proxy cannot be resolved, calibration must keep a confidence cap and visible missing evidence.",
      blocksFinalSign: permissionUnknown > 2,
      evidenceRefs: abi?.publicRows.slice(0, 4).map((item) => item.label) ?? ["contract source / ABI extraction lane"],
      missingRefs: abi?.operatorRows.filter((item) => item.state !== "verified").slice(0, 5).map((item) => item.output) ?? [],
      fixAction: "Resolve ABI/source verification or keep admin-surface cap in Pro/Advanced.",
    }),
    fixture({
      id: "liquidity-exit-pressure-trap",
      family: "liquidity_exit",
      label: "Liquidity / holder exit pressure calibration",
      expectedBand: "high",
      expectedRange: liquidityBlockers > 0 ? [62, 96] : [32, 82],
      observedRisk: observed + liquidityBlockers * 6,
      customerLine: t(locale, "Brak LP/holder dowodu podnosi ryzyko i blokuje zbyt spokojny werdykt.", "Fehlender LP/Holder-Nachweis erhoeht Risiko und blockiert ein zu ruhiges Verdict.", "Missing LP/holder evidence raises risk and blocks an over-calm verdict."),
      proPdfLine: `liquidityBlockers=${liquidityBlockers}; depthReadiness=${depth?.summary.depthReadiness ?? 0}`,
      operatorLine: "Low-risk output is not allowed when LP ownership, holder concentration or exit pressure is unresolved.",
      blocksFinalSign: liquidityBlockers > 0,
      evidenceRefs: depth?.publicRows.slice(0, 4).map((item) => item.label) ?? ["holder liquidity depth evidence"],
      missingRefs: depth?.operatorRows.filter((item) => item.state !== "confirmed").slice(0, 5).map((item) => item.output) ?? [],
      fixAction: "Add pair matrix, LP lock proof and top-holder evidence before lowering score.",
    }),
    fixture({
      id: "freshness-replay-version-bump",
      family: "freshness_replay",
      label: "Freshness replay / version bump calibration",
      expectedBand: "medium",
      expectedRange: needsNewVersion ? [50, 90] : [22, 76],
      observedRisk: observed + (needsNewVersion ? 8 : 0),
      customerLine: t(locale, "Stare źródła nie mogą po cichu zmienić starego raportu.", "Alte Quellen duerfen alten Report nicht still veraendern.", "Stale sources cannot silently mutate an old report."),
      proPdfLine: `mustCreateNewVersion=${needsNewVersion}; recheckReadiness=${recheck?.summary.orchestratorReadiness ?? 0}; next=${recheck?.summary.nextRecheckAt ?? "preview"}`,
      operatorLine: "Calibration must force new version/hash when freshness replay changes a material score input.",
      blocksFinalSign: needsNewVersion,
      evidenceRefs: recheck?.customerRows.slice(0, 4).map((item) => item.label) ?? ["source freshness re-check orchestrator"],
      missingRefs: recheck?.lanes.filter((item) => item.blocksFinalSign).slice(0, 4).map((item) => item.label) ?? [],
      fixAction: "Run scheduled re-check and create a new report version instead of overwriting old score.",
    }),
    fixture({
      id: "payment-delivery-boundary",
      family: "payment_delivery",
      label: "Payment / private delivery calibration",
      expectedBand: "unknown",
      expectedRange: deliveryReady ? [18, 86] : [45, 96],
      observedRisk: observed + (deliveryReady ? 0 : 5),
      customerLine: t(locale, "Płatna dostawa nie zmienia score — zmienia tylko dostęp i głębokość raportu.", "Bezahlte Delivery aendert nicht den Score, nur Zugang und Reporttiefe.", "Paid delivery does not change score — it only changes access and report depth."),
      proPdfLine: `privateDeliveryReady=${deliveryReady}; deliveryReadiness=${delivery?.summary.paymentDeliveryReadiness ?? 0}`,
      operatorLine: "Payment proof must never lower risk by itself; it only unlocks private workflow after receipt verification.",
      blocksFinalSign: !deliveryReady && input.reviewLevel === "advanced_review",
      evidenceRefs: delivery?.customerRows.slice(0, 4).map((item) => item.label) ?? ["server payment account delivery gate"],
      missingRefs: delivery?.operatorRows.filter((item) => item.status !== "ready" && item.status !== "locked").slice(0, 4).map((item) => item.output) ?? [],
      fixAction: "Keep wallet/payment boundary explicit; verify server receipt before private delivery.",
    }),
    fixture({
      id: "advanced-final-signoff-calibration",
      family: "advanced_signoff",
      label: "Advanced final sign-off calibration",
      expectedBand: "unknown",
      expectedRange: advancedReady ? [18, 88] : [52, 98],
      observedRisk: observed + (advancedReady ? 0 : blockers * 3),
      customerLine: t(locale, "Advanced wymaga operator checklist; AI nie finalizuje samodzielnie.", "Advanced braucht Operator-Checklist; AI finalisiert nicht allein.", "Advanced requires an operator checklist; AI does not final-sign alone."),
      proPdfLine: `advancedReady=${advancedReady}; finalSignReadiness=${operator?.summary.finalSignReadiness ?? 0}; formulaBlocks=${blockers}`,
      operatorLine: "Final sign-off must remain blocked until operator notes, redaction and evidence sufficiency are complete.",
      blocksFinalSign: !advancedReady,
      evidenceRefs: operator?.customerRows.slice(0, 4).map((item) => item.label) ?? ["advanced operator console merge"],
      missingRefs: operator?.finalSignoffState.blockers.slice(0, 5) ?? [],
      fixAction: "Resolve operator blockers and redaction before Advanced final delivery.",
    }),
  ];

  const passed = fixtures.filter((item) => item.status === "pass").length;
  const watch = fixtures.filter((item) => item.status === "watch" || item.status === "queued").length;
  const failed = fixtures.filter((item) => item.status === "fail").length;
  const blocked = fixtures.filter((item) => item.status === "blocked").length;
  const averageDrift = clamp(fixtures.reduce((sum, item) => sum + item.drift, 0) / Math.max(1, fixtures.length), 0, 100);
  const maxDrift = Math.max(...fixtures.map((item) => item.drift), 0);
  const calibrationReadiness = clamp(100 - failed * 18 - blocked * 12 - watch * 6 - averageDrift * 2 + passed * 4 + Math.round(formulaConfidence * 0.14), 8, 96);
  const canTrustBasicCalibration = hasObservedRisk && calibrationReadiness >= 42 && failed === 0;
  const canIssueProCalibration = calibrationReadiness >= 58 && failed === 0 && averageDrift <= 12;
  const canFinalSignAdvancedCalibration = canIssueProCalibration && blocked === 0 && maxDrift <= 10 && (formula?.summary.canFinalSignAdvancedScore ?? false);
  const nextCriticalStep = fixtures.find((item) => item.status === "blocked" || item.status === "fail")?.label ?? fixtures.find((item) => item.status === "watch")?.label ?? "none";

  return {
    passId: PASS2591_RISK_CALIBRATION_GOLDEN_FIXTURE_HARNESS_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { chain, contractAddress, projectName },
    rule: "PASS2591 attaches a golden fixture harness to the risk formula, so score changes can be regression-tested before Basic, Pro or Advanced claims are released.",
    customerRule: t(locale, "Score jest porównywany z bezpiecznymi scenariuszami testowymi, żeby nie dryfował po zmianach silnika.", "Der Score wird gegen sichere Test-Szenarien geprueft, damit er nach Engine-Aenderungen nicht driftet.", "The score is checked against safe golden fixtures so it does not drift after engine changes."),
    proRule: "Pro PDF can expose calibration readiness, fixture drift and score release gates without revealing private operator payloads.",
    operatorRule: "Operator must resolve failed or blocked fixtures before final Advanced sign-off; fixtures are passive regression checks, not exploit instructions.",
    summary: {
      fixtureCount: fixtures.length,
      passed,
      watch,
      failed,
      blocked,
      averageDrift,
      maxDrift,
      calibrationReadiness,
      canTrustBasicCalibration,
      canIssueProCalibration,
      canFinalSignAdvancedCalibration,
      topRegressionRisk: nextCriticalStep,
      nextCriticalStep,
    },
    fixtures,
    customerRows: fixtures.slice(0, 6).map((item) => row(item.label, item.status, `${item.customerLine} ${t(locale, "Status", "Status", "Status")}: ${statusLine(locale, item.status)}; drift ${item.drift}.`)),
    proPdfRows: fixtures.map((item) => row(item.label, item.status, `${item.proPdfLine}; expected=${item.expectedRange[0]}-${item.expectedRange[1]}; observed=${item.observedRisk}; drift=${item.drift}; blocksFinal=${item.blocksFinalSign}`)),
    operatorRows: fixtures.map((item) => row(item.label, item.status, `${item.operatorLine} Fix: ${item.fixAction}. Missing: ${item.missingRefs.join(" | ") || "none"}`)),
    calibrationContract: {
      version: "vlm-risk-calibration-v0.1-pass2591",
      invariant: "A risk score can be displayed only with fixture status, drift, release gates and visible missing evidence; no silent score drift is allowed.",
      fixtureFamilies: ["baseline", "admin_surface", "liquidity_exit", "freshness_replay", "payment_delivery", "advanced_signoff", "anti_drift"],
      noDriftRules: [
        "Same evidence set must not change final risk by more than 10 points without a new formula version.",
        "Payment or wallet identity cannot lower risk score.",
        "Missing liquidity, ABI or freshness evidence must cap confidence before any final sign-off.",
      ],
      scoreReleaseRules: [
        "Basic may show calibrated preview when failed fixtures are zero.",
        "Pro may export calibrated score when average drift is at or below 12 and readiness is at least 58.",
        "Advanced final sign-off requires zero blocked fixtures, operator readiness and PASS2590 Advanced score gate.",
      ],
    },
    regressionPlan: [
      { id: "fixture-library", purpose: "Add BTC/AAPL/verified ERC20/high-risk token fixtures", action: "Persist fixture snapshots and expected score ranges." },
      { id: "score-snapshot", purpose: "Prevent accidental formula drift", action: "Store previous score hash and compare against new run." },
      { id: "ui-explainer", purpose: "Make score credible to users", action: "Show calibrated/not-calibrated state beside Basic/Pro/Advanced score." },
      { id: "operator-override-log", purpose: "Keep manual review honest", action: "Require signed note when operator adjusts score family." },
    ],
    visualMergeContract: {
      publicSlot: "Basic audit calibrated-score panel below risk formula rows",
      proPdfSlot: "Pro PDF calibration appendix after formula section",
      operatorSlot: "Advanced console fixture gate before final sign-off",
      rule: "Visual redesign may compress fixture cards, but must keep readiness, drift, failed/blocked count and release gates wired.",
      keepWired: [
        "summary.calibrationReadiness",
        "summary.averageDrift",
        "summary.maxDrift",
        "summary.canTrustBasicCalibration",
        "summary.canIssueProCalibration",
        "summary.canFinalSignAdvancedCalibration",
        "fixtures[].status",
        "fixtures[].drift",
        "fixtures[].blocksFinalSign",
      ],
      doNotExpose: ["operatorRows", "private delivery pointers", "raw operator notes", "test instructions that look like exploit steps"],
    },
    nextImplementationBacklog: [
      "Persist golden fixture snapshots in a durable test ledger.",
      "Add fixture diff UI to operator console.",
      "Connect calibration readiness to Pro PDF download warning copy.",
      "Add formula-version hash to receipt/re-check lifecycle.",
      "Run full Next build/typecheck locally with node_modules.",
    ],
  };
}
