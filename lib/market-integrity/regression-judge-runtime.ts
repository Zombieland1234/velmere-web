import type { TokenRiskResult } from "./risk-types";
import type { Pass433ProviderProbe } from "./real-internet-data-arbitration";
import type { Pass435LiveQueryTestBench } from "./live-query-test-bench";
import type { Pass439TruthReplayHarnessRuntime } from "./truth-replay-harness-runtime";
import type { Pass440SemanticDriftSourceLineageRuntime } from "./semantic-drift-source-lineage-runtime";
import type { Pass441BrainEvalHarnessRuntime } from "./brain-eval-harness-runtime";

export type Pass442RegressionMode = "quality_stable" | "guarded_regression" | "sealed_regression" | "operator_regression_review";
export type Pass442RegressionLane = "source" | "provider" | "memory" | "narrative" | "pdf" | "chat" | "live";
export type Pass442RegressionStatus = "stable" | "watch" | "regressed" | "blocked";

export type Pass442RegressionCheck = {
  id: string;
  lane: Pass442RegressionLane;
  status: Pass442RegressionStatus;
  score: number;
  observed: string;
  baseline: string;
  repair: string;
  customerVisible: boolean;
};

export type Pass442BrainRegressionJudgeRuntime = {
  version: "pass442-brain-regression-judge-runtime";
  generatedAt: string;
  regressionMode: Pass442RegressionMode;
  regressionScore: number;
  checks: Pass442RegressionCheck[];
  blockedRegressionCount: number;
  watchCount: number;
  qualityBudget: {
    evidenceBudget: number;
    fakeLiveBudgetRemaining: number;
    narrativeBudget: number;
    providerBudget: number;
    memoryBudget: number;
  };
  releaseGate: {
    pdfAllowed: boolean;
    chatAllowed: boolean;
    factsOnly: boolean;
    operatorReview: boolean;
    noRegressionRelease: true;
    onePayload: true;
  };
  regressionPolicy: {
    compareAgainstPreviousGuards: true;
    noQualityBackslide: true;
    doNotHideMissingData: true;
    doNotUpgradeConfidenceWithoutProvider: true;
    memoryCannotOverrideLiveProbe: true;
    deterministicPdfChat: true;
  };
  repairQueue: Array<{
    id: string;
    priority: "p0" | "p1" | "p2";
    action: string;
    reason: string;
  }>;
  customerReadout: string;
  operatorReadout: string;
};

export type Pass442LensRegressionJudgeContract = {
  version: "pass442-lens-regression-judge-contract";
  locale: "pl" | "en" | "de";
  customerLabel: "pdf_preview";
  onePayload: true;
  oneLocale: true;
  oneSectionOrder: true;
  technicalRegressionHidden: true;
  missingDataVisible: boolean;
  customerLine: string;
  noRegressionRelease: true;
  maxSuggestions: 3;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function check(input: {
  id: string;
  lane: Pass442RegressionLane;
  score: number;
  observed: string;
  baseline: string;
  repair: string;
  customerVisible?: boolean;
}): Pass442RegressionCheck {
  const score = clamp(input.score);
  const status: Pass442RegressionStatus = score >= 76 ? "stable" : score >= 55 ? "watch" : score >= 34 ? "regressed" : "blocked";
  return {
    id: input.id,
    lane: input.lane,
    status,
    score,
    observed: input.observed,
    baseline: input.baseline,
    repair: input.repair,
    customerVisible: Boolean(input.customerVisible),
  };
}

function usableProviderCount(attempts: Pass433ProviderProbe[] = []) {
  return attempts.filter((item) => item.status === "ok" || item.status === "partial").length;
}

function hasAttemptField(attempts: Pass433ProviderProbe[] = [], field: keyof Pick<Pass433ProviderProbe, "hasPrice" | "has24hChange" | "hasVolume24h" | "hasCandles" | "hasSecurity">) {
  return attempts.some((item) => item.status !== "error" && Boolean(item[field]));
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildPass442BrainRegressionJudgeRuntime(input: {
  result: TokenRiskResult;
  pass435: Pass435LiveQueryTestBench;
  pass439: Pass439TruthReplayHarnessRuntime;
  pass440: Pass440SemanticDriftSourceLineageRuntime;
  pass441: Pass441BrainEvalHarnessRuntime;
  providerAttempts?: Pass433ProviderProbe[];
}): Pass442BrainRegressionJudgeRuntime {
  const attempts = input.providerAttempts ?? [];
  const sourceCount = Math.max(input.result.dataSources.length, usableProviderCount(attempts));
  const hasPrice = typeof input.result.metrics.currentPrice === "number" || hasAttemptField(attempts, "hasPrice");
  const hasChange = typeof input.result.metrics.priceChange24h === "number" || hasAttemptField(attempts, "has24hChange");
  const hasVolume = typeof input.result.metrics.volume24h === "number" || hasAttemptField(attempts, "hasVolume24h");
  const hasCandles = (input.result.chart?.sevenDay?.length ?? 0) > 4 || hasAttemptField(attempts, "hasCandles");
  const hasSecondProvider = sourceCount >= 2;
  const truthReplaySafe = input.pass439.replayState === "replay_clean" || input.pass439.replayState === "replay_partial";
  const driftSafe = input.pass440.driftState === "semantic_aligned" || input.pass440.driftState === "semantic_guarded";
  const evalSafe = input.pass441.evalMode === "eval_green" || input.pass441.evalMode === "eval_guarded";
  const pass435FactsOnly = input.pass435.releaseMode === "facts_only_no_live_claim" || input.pass435.releaseMode === "block_pdf_until_probe";
  const factsOnly = pass435FactsOnly || input.pass439.releaseGate.factsOnly || input.pass440.pdfChatGate.factsOnly || input.pass441.pdfChatGate.factsOnly;
  const coreFieldScore = clamp([hasPrice, hasChange, hasVolume, hasCandles].filter(Boolean).length * 25);
  const checks: Pass442RegressionCheck[] = [
    check({
      id: "pass442_core_fields_no_backslide",
      lane: "source",
      score: coreFieldScore,
      observed: `price=${hasPrice}; change=${hasChange}; volume=${hasVolume}; candles=${hasCandles}`,
      baseline: "PASS435/PASS441 require observed core fields or visible missing-data before live wording.",
      repair: "Keep missing fields surfaced and run the next provider lane before stronger PDF/chat copy.",
      customerVisible: coreFieldScore < 75,
    }),
    check({
      id: "pass442_second_provider_regression",
      lane: "provider",
      score: hasSecondProvider ? 96 : factsOnly ? 64 : 28,
      observed: `${sourceCount} usable provider/source lane(s); factsOnly=${factsOnly}`,
      baseline: "Second provider confirmed, or confidence must stay capped with missing data visible.",
      repair: "Do not upgrade confidence without a second source; schedule crosscheck provider.",
      customerVisible: !hasSecondProvider,
    }),
    check({
      id: "pass442_eval_no_backslide",
      lane: "live",
      score: evalSafe ? input.pass441.evalScore : Math.min(42, input.pass441.evalScore),
      observed: `${input.pass441.evalMode}; eval score ${input.pass441.evalScore}/100; fails ${input.pass441.failedCount}`,
      baseline: "PASS441 eval must stay green/guarded before normal narrative release.",
      repair: "Seal live wording or request operator review when eval falls to sealed/review.",
      customerVisible: !evalSafe,
    }),
    check({
      id: "pass442_truth_replay_no_backslide",
      lane: "narrative",
      score: truthReplaySafe ? input.pass439.replayScore : Math.min(36, input.pass439.replayScore),
      observed: `${input.pass439.replayState}; replay score ${input.pass439.replayScore}/100`,
      baseline: "PASS439 requires replayable evidence for customer-facing claims.",
      repair: "Rewrite unsupported claims into facts-only or missing-data language.",
      customerVisible: !truthReplaySafe,
    }),
    check({
      id: "pass442_semantic_drift_no_backslide",
      lane: "narrative",
      score: driftSafe ? clamp(100 - input.pass440.semanticDriftScore) : Math.max(18, 52 - input.pass440.semanticDriftScore),
      observed: `${input.pass440.driftState}; drift ${input.pass440.semanticDriftScore}/100; response ${input.pass440.responseMode}`,
      baseline: "PASS440 blocks narrative that sounds stronger than the source lineage.",
      repair: "Apply guarded/facts-only rewrite when drift risk rises.",
      customerVisible: !driftSafe,
    }),
    check({
      id: "pass442_fake_live_budget_no_backslide",
      lane: "chat",
      score: clamp(100 - input.pass435.fakeLiveRisk),
      observed: `fake-live risk ${input.pass435.fakeLiveRisk}/100; release ${input.pass435.releaseMode}`,
      baseline: "Fake-live risk cannot rise above budget before PDF/chat release.",
      repair: "Show partial-provider status and block live claims until probes succeed.",
      customerVisible: input.pass435.fakeLiveRisk >= 58,
    }),
    check({
      id: "pass442_pdf_payload_regression_lock",
      lane: "pdf",
      score: input.pass441.pdfChatGate.pdfAllowed || factsOnly ? 90 : 24,
      observed: `pdfAllowed=${input.pass441.pdfChatGate.pdfAllowed}; factsOnly=${factsOnly}; onePayload=true`,
      baseline: "PDF preview/download/chat must share one resolved payload and one section order.",
      repair: "Keep second generator disabled and preserve checksum/locale/section-order lock.",
    }),
    check({
      id: "pass442_memory_not_live_provider",
      lane: "memory",
      score: input.pass440.lineagePolicy.memoryCannotInventSource ? 96 : 12,
      observed: `memoryCannotInventSource=${input.pass440.lineagePolicy.memoryCannotInventSource}`,
      baseline: "Long-term memory can guide context only; it cannot become a live data provider.",
      repair: "Fence memory-derived claims and force provider execution before live wording.",
    }),
  ];
  const blockedRegressionCount = checks.filter((item) => item.status === "blocked" || item.status === "regressed").length;
  const watchCount = checks.filter((item) => item.status === "watch").length;
  const regressionScore = clamp(checks.reduce((sum, item) => sum + item.score, 0) / checks.length);
  const regressionMode: Pass442RegressionMode = blockedRegressionCount >= 3 || input.pass441.evalMode === "operator_eval_review"
    ? "operator_regression_review"
    : blockedRegressionCount >= 1 || input.pass441.evalMode === "eval_sealed"
      ? "sealed_regression"
      : watchCount >= 2 || input.pass441.evalMode === "eval_guarded"
        ? "guarded_regression"
        : "quality_stable";
  const operatorReview = regressionMode === "operator_regression_review";
  const factsOnlyRelease = factsOnly || regressionMode === "sealed_regression" || operatorReview;
  const pdfAllowed = !operatorReview && (input.pass441.pdfChatGate.pdfAllowed || factsOnlyRelease);
  const chatAllowed = !operatorReview || factsOnlyRelease;
  const repairQueue = unique(checks.filter((item) => item.status !== "stable").map((item) => item.id)).map((id) => {
    const item = checks.find((entry) => entry.id === id)!;
    return {
      id,
      priority: item.status === "blocked" ? "p0" as const : item.status === "regressed" ? "p1" as const : "p2" as const,
      action: item.status === "blocked" || item.status === "regressed" ? "seal_or_rewrite_before_release" : "guard_and_monitor",
      reason: `${item.lane}: ${item.repair}`,
    };
  });
  if (!repairQueue.length) {
    repairQueue.push({ id: "pass442_quality_stable", priority: "p2", action: "keep_release_path", reason: "No regression against PASS435-PASS441 guards." });
  }

  return {
    version: "pass442-brain-regression-judge-runtime",
    generatedAt: new Date().toISOString(),
    regressionMode,
    regressionScore,
    checks,
    blockedRegressionCount,
    watchCount,
    qualityBudget: {
      evidenceBudget: clamp((truthReplaySafe ? input.pass439.replayScore : 36) - blockedRegressionCount * 9),
      fakeLiveBudgetRemaining: clamp(100 - input.pass435.fakeLiveRisk),
      narrativeBudget: clamp((driftSafe ? 100 - input.pass440.semanticDriftScore : 38) - watchCount * 4),
      providerBudget: clamp((hasSecondProvider ? 92 : 54) + coreFieldScore * 0.08 - blockedRegressionCount * 7),
      memoryBudget: input.pass440.lineagePolicy.memoryCannotInventSource ? 94 : 12,
    },
    releaseGate: {
      pdfAllowed,
      chatAllowed,
      factsOnly: factsOnlyRelease,
      operatorReview,
      noRegressionRelease: true,
      onePayload: true,
    },
    regressionPolicy: {
      compareAgainstPreviousGuards: true,
      noQualityBackslide: true,
      doNotHideMissingData: true,
      doNotUpgradeConfidenceWithoutProvider: true,
      memoryCannotOverrideLiveProbe: true,
      deterministicPdfChat: true,
    },
    repairQueue,
    customerReadout: regressionMode === "quality_stable"
      ? "Velmère kept the report inside the verified evidence budget."
      : regressionMode === "guarded_regression"
        ? "Velmère found a possible quality backslide and keeps the answer guarded."
        : regressionMode === "sealed_regression"
          ? "Velmère found a regression risk and limits the output to facts-only until more evidence arrives."
          : "Velmère requires operator review before stronger customer-facing claims.",
    operatorReadout: `PASS442 regression judge ${regressionMode}; score ${regressionScore}/100; blocked/watch ${blockedRegressionCount}/${watchCount}; repairs ${repairQueue.map((item) => item.id).join(", ")}.`,
  };
}

export function buildPass442LensRegressionJudgeContract(input: {
  locale: "pl" | "en" | "de";
  sourceConfidence: number;
  sourceCount: number;
  missingDataCount: number;
  pass441MissingVisible: boolean;
}): Pass442LensRegressionJudgeContract {
  const missingDataVisible = input.pass441MissingVisible || input.sourceCount < 2 || input.missingDataCount > 0 || input.sourceConfidence < 58;
  const customerLine = input.locale === "de"
    ? "PDF-Vorschau"
    : input.locale === "en"
      ? "PDF preview"
      : "Podgląd PDF";
  return {
    version: "pass442-lens-regression-judge-contract",
    locale: input.locale,
    customerLabel: "pdf_preview",
    onePayload: true,
    oneLocale: true,
    oneSectionOrder: true,
    technicalRegressionHidden: true,
    missingDataVisible,
    customerLine,
    noRegressionRelease: true,
    maxSuggestions: 3,
  };
}
