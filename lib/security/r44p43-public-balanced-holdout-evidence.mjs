import crypto from "node:crypto";

export const R44P43_HOLDOUT_SCHEMA = "velmere.pass36.a102r44p43.public-balanced-holdout.v1";
export const R44P43_SUPPORTED_RULES_BY_CATEGORY = Object.freeze({
  ACCESS_CONTROL: Object.freeze([
    "AST_R44P38_UNPROTECTED_UPGRADE",
    "AST_SELFDESTRUCT_SURFACE",
    "AST_TX_ORIGIN_AUTH",
    "AST_UNGUARDED_DELEGATECALL_TARGET",
    "AST_UNGUARDED_INITIALIZER",
    "AST_UNPROTECTED_PRIVILEGED_STATE_WRITE",
    "AST_UNBOUNDED_DYNAMIC_STORAGE_INDEX_WRITE",
    "AST_WITHDRAWAL_BALANCE_NOT_CONSUMED",
    "AST_WITHDRAWAL_LIMIT_COMPARISON_INVERTED",
  ]),
  REENTRANCY: Object.freeze(["AST_EXTERNAL_INTERACTION_BEFORE_STATE_EFFECT"]),
  UNCHECKED_LL_CALLS: Object.freeze(["AST_UNCHECKED_LOW_LEVEL_CALL"]),
});

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function round(value, places = 6) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? round(numerator / denominator) : null;
}

function categoryMetrics(cases) {
  const categories = [...new Set(cases.map((row) => row.category))].sort();
  return categories.map((category) => {
    const rows = cases.filter((row) => row.category === category);
    const eligible = rows.filter((row) => row.resultStatus === "SUPPORTED_SIGNAL_DETECTED" || row.resultStatus === "SUPPORTED_SIGNAL_MISSED");
    const detected = eligible.filter((row) => row.resultStatus === "SUPPORTED_SIGNAL_DETECTED").length;
    const missed = eligible.filter((row) => row.resultStatus === "SUPPORTED_SIGNAL_MISSED").length;
    return {
      category,
      publicCases: rows.length,
      analyzedWithCompactAst: eligible.length,
      detected,
      missed,
      recallWithinAnalyzedSubset: ratio(detected, eligible.length),
      withheldCompilerUnavailable: rows.filter((row) => row.resultStatus === "WITHHELD_COMPILER_UNAVAILABLE").length,
      withheldStandardJsonUnavailable: rows.filter((row) => row.resultStatus === "WITHHELD_STANDARD_JSON_UNAVAILABLE").length,
      withheldCompactAstUnavailable: rows.filter((row) => row.resultStatus === "WITHHELD_COMPACT_AST_UNAVAILABLE").length,
      withheldCompilationError: rows.filter((row) => row.resultStatus === "WITHHELD_COMPILATION_ERROR").length,
      unsupportedDetectorFamily: rows.filter((row) => row.resultStatus === "UNSUPPORTED_DETECTOR_FAMILY").length,
    };
  });
}

function forbiddenMetricPaths(value, path = "$") {
  const rows = [];
  if (!value || typeof value !== "object") return rows;
  if (Array.isArray(value)) {
    value.forEach((item, index) => rows.push(...forbiddenMetricPaths(item, `${path}[${index}]`)));
    return rows;
  }
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (["accuracy", "precision", "falsepositiverate", "fpr"].includes(normalized)) rows.push(`${path}.${key}`);
    rows.push(...forbiddenMetricPaths(item, `${path}.${key}`));
  }
  return rows;
}

export function buildR44P43HoldoutSummary({
  revisionId,
  parentRevisionId,
  smartbugsManifest,
  controlManifest,
  positiveCases,
  controlCases,
  caseIndex,
  observedAt = "2026-08-10T00:00:00.000Z",
}) {
  if (!Array.isArray(positiveCases) || !Array.isArray(controlCases)) throw new Error("holdout_case_arrays_required");
  const publicPositiveCases = positiveCases.length;
  const supportedPositiveCases = positiveCases.filter((row) => row.supportedCategory === true).length;
  const analyzedSupportedCases = positiveCases.filter((row) => row.resultStatus === "SUPPORTED_SIGNAL_DETECTED" || row.resultStatus === "SUPPORTED_SIGNAL_MISSED").length;
  const detectedSupportedCases = positiveCases.filter((row) => row.resultStatus === "SUPPORTED_SIGNAL_DETECTED").length;
  const missedSupportedCases = positiveCases.filter((row) => row.resultStatus === "SUPPORTED_SIGNAL_MISSED").length;
  const withheldSupportedCases = supportedPositiveCases - analyzedSupportedCases;
  const compiledControlCandidates = controlCases.filter((row) => row.compilationStatus === "EXECUTED").length;
  const controlsWithRootAlerts = controlCases.filter((row) => row.rootRuleIds.length > 0).length;
  const controlsWithBundleAlerts = controlCases.filter((row) => row.bundleRuleIds.length > 0).length;
  const core = {
    schemaVersion: R44P43_HOLDOUT_SCHEMA,
    revisionId,
    parentRevisionId,
    observedAt,
    testCycle: "2/3",
    sourceMode: "R44P41_CURRENT_ANALYZER_WITH_R44P43_LEGACY_OUTPUT_ADAPTER",
    publicEvidence: {
      smartbugs: {
        repository: smartbugsManifest.repository,
        commit: smartbugsManifest.commit,
        selection: smartbugsManifest.selection,
        cases: smartbugsManifest.cases,
        selectionFrozenBeforeAnalyzerExecution: true,
        publicLabelsNotIndependentTwoReviewerGroundTruth: true,
      },
      controls: {
        package: controlManifest.package,
        version: controlManifest.version,
        cases: controlManifest.cases,
        selectionFrozenBeforeAnalyzerExecution: controlManifest.selectionFrozenBeforeAnalyzerExecution === true,
        labelClass: "PUBLIC_CONTROL_CANDIDATE_NO_INDEPENDENT_SAFETY_CLAIM",
        formalTrueNegativeCredit: false,
      },
    },
    supportedDetectorFamilies: Object.fromEntries(Object.entries(R44P43_SUPPORTED_RULES_BY_CATEGORY).map(([key, value]) => [key, [...value]])),
    positiveEvaluation: {
      publicCases: publicPositiveCases,
      supportedCategoryCases: supportedPositiveCases,
      analyzedWithExactCompilerAndCompactAst: analyzedSupportedCases,
      withheldSupportedCases,
      supportedSignalsDetected: detectedSupportedCases,
      supportedSignalsMissed: missedSupportedCases,
      recallWithinAnalyzedSupportedSubset: ratio(detectedSupportedCases, analyzedSupportedCases),
      compileAndAstCoverageOfSupportedCases: ratio(analyzedSupportedCases, supportedPositiveCases),
      coverageAdjustedDetectionShare: ratio(detectedSupportedCases, supportedPositiveCases),
      categoryMetrics: categoryMetrics(positiveCases),
      unsupportedCases: positiveCases.filter((row) => row.resultStatus === "UNSUPPORTED_DETECTOR_FAMILY").length,
      compilerUnavailable: positiveCases.filter((row) => row.resultStatus === "WITHHELD_COMPILER_UNAVAILABLE").length,
      compactAstUnavailable: positiveCases.filter((row) => row.resultStatus === "WITHHELD_COMPACT_AST_UNAVAILABLE").length,
      compilationErrors: positiveCases.filter((row) => row.resultStatus === "WITHHELD_COMPILATION_ERROR").length,
    },
    controlCandidateEvaluation: {
      publicCandidates: controlCases.length,
      compiledCandidates: compiledControlCandidates,
      candidatesWithRootAlerts: controlsWithRootAlerts,
      candidatesWithBundleAlerts: controlsWithBundleAlerts,
      candidateRootAlertRate: ratio(controlsWithRootAlerts, compiledControlCandidates),
      candidateBundleAlertRate: ratio(controlsWithBundleAlerts, compiledControlCandidates),
      metricBoundary: "Candidate alert rates are diagnostic only. These public roots were not independently adjudicated as true negatives for this execution.",
      formalTrueNegativeCredit: false,
    },
    formalMetricAvailability: {
      balancedIndependentLabels: false,
      twoIndependentReviewers: false,
      sealedGroundTruthCreatedBeforeAnalyzerAccess: false,
      formalPositivePredictiveValueAvailable: false,
      formalNegativeControlRateAvailable: false,
      severityAgreementAvailable: false,
      exploitabilityAgreementAvailable: false,
      singleOverallScoreAllowed: false,
    },
    caseIndex,
    creditBoundary: {
      publicPinnedCorpusCredit: true,
      legacyExactCompilerExecutionCredit: true,
      currentAnalyzerExternalPublicCorpusCredit: true,
      independentGroundTruthCredit: false,
      formalBalancedMetricCredit: false,
      formalNegativeControlCredit: false,
      severityAgreementCredit: false,
      realDeploymentCredit: false,
      customerCredit: false,
      saleCredit: false,
      liveCredit: false,
      worldClassCredit: false,
    },
    limitations: [
      "SmartBugs labels are public benchmark metadata and were not independently re-adjudicated by two organizations for this execution.",
      "OpenZeppelin roots are preregistered public control candidates, not independently certified true negatives.",
      "Only explicitly supported signal families contribute to the reported recall-within-analyzed-subset metric; unsupported families are withheld, not marked safe.",
      "Compiler-unavailable and compact-AST-unavailable cases reduce coverage and are never converted into safe outcomes.",
      "No single overall performance score, formal positive-predictive metric, formal false-alert metric, severity agreement or world-class claim is permitted from this checkpoint.",
    ],
  };
  const forbidden = forbiddenMetricPaths(core);
  if (forbidden.length) throw new Error(`forbidden_formal_metric_keys:${forbidden.join(",")}`);
  return { ...core, evidenceSha256: sha256(stable(core)) };
}

export function verifyR44P43HoldoutSummary({ summary, positiveCases, controlCases, smartbugsManifest, controlManifest }) {
  const checks = [];
  const check = (id, ok, detail = undefined) => checks.push({ id, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
  check("schema", summary?.schemaVersion === R44P43_HOLDOUT_SCHEMA);
  check("cycle", summary?.testCycle === "2/3");
  check("smartbugs-count", positiveCases.length === 69 && summary?.publicEvidence?.smartbugs?.cases === 69 && smartbugsManifest?.cases === 69);
  check("control-count", controlCases.length === 29 && summary?.publicEvidence?.controls?.cases === 29 && controlManifest?.cases === 29);
  check("unique-positive-cases", new Set(positiveCases.map((row) => row.caseId)).size === positiveCases.length);
  check("unique-control-cases", new Set(controlCases.map((row) => row.caseId)).size === controlCases.length);
  check("smartbugs-commit", summary?.publicEvidence?.smartbugs?.commit === smartbugsManifest?.commit);
  check("control-version", summary?.publicEvidence?.controls?.version === controlManifest?.version);
  check("selection-frozen", summary?.publicEvidence?.smartbugs?.selectionFrozenBeforeAnalyzerExecution === true && summary?.publicEvidence?.controls?.selectionFrozenBeforeAnalyzerExecution === true);
  const rebuilt = buildR44P43HoldoutSummary({
    revisionId: summary.revisionId,
    parentRevisionId: summary.parentRevisionId,
    smartbugsManifest,
    controlManifest,
    positiveCases,
    controlCases,
    caseIndex: summary.caseIndex,
    observedAt: summary.observedAt,
  });
  check("metrics-recount", stable(rebuilt.positiveEvaluation) === stable(summary.positiveEvaluation));
  check("control-recount", stable(rebuilt.controlCandidateEvaluation) === stable(summary.controlCandidateEvaluation));
  check("evidence-hash", rebuilt.evidenceSha256 === summary.evidenceSha256);
  check("no-forbidden-formal-metric-keys", forbiddenMetricPaths(summary).length === 0, forbiddenMetricPaths(summary));
  check("no-independent-credit", summary?.creditBoundary?.independentGroundTruthCredit === false);
  check("no-formal-balanced-credit", summary?.creditBoundary?.formalBalancedMetricCredit === false && summary?.creditBoundary?.formalNegativeControlCredit === false);
  check("no-customer-credit", summary?.creditBoundary?.customerCredit === false);
  check("no-sale-credit", summary?.creditBoundary?.saleCredit === false);
  check("no-live-credit", summary?.creditBoundary?.liveCredit === false);
  check("no-world-class-credit", summary?.creditBoundary?.worldClassCredit === false);
  const failed = checks.filter((row) => !row.ok);
  return { ok: failed.length === 0, checks, failed };
}
