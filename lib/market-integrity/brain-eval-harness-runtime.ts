import type { TokenRiskResult } from "./risk-types";
import type { Pass435LiveQueryTestBench } from "./live-query-test-bench";
import type { Pass439TruthReplayHarnessRuntime } from "./truth-replay-harness-runtime";
import type { Pass440SemanticDriftSourceLineageRuntime } from "./semantic-drift-source-lineage-runtime";
import type { Pass433ProviderProbe } from "./real-internet-data-arbitration";

export type Pass441EvalStatus = "pass" | "warn" | "fail";
export type Pass441EvalMode = "eval_green" | "eval_guarded" | "eval_sealed" | "operator_eval_review";
export type Pass441EvalLane = "source" | "risk" | "memory" | "narrative" | "pdf" | "chat" | "provider";

export type Pass441BrainEvalCase = {
  id: string;
  lane: Pass441EvalLane;
  title: string;
  status: Pass441EvalStatus;
  score: number;
  observed: string;
  expected: string;
  repair: string;
  customerVisible: boolean;
};

export type Pass441BrainEvalHarnessRuntime = {
  version: "brain-eval-harness-runtime";
  generatedAt: string;
  evalMode: Pass441EvalMode;
  evalScore: number;
  failedCount: number;
  warningCount: number;
  passedCount: number;
  evalCases: Pass441BrainEvalCase[];
  regressionTripwires: Array<{
    id: string;
    severity: "low" | "medium" | "high";
    trigger: string;
    action: "allow" | "guard" | "seal" | "operator_review";
  }>;
  modelBehaviorPolicy: {
    evalBeforeNarration: true;
    noAnswerWithoutEvidence: true;
    memoryCannotBecomeProvider: true;
    missingDataMustStayVisible: true;
    factsOnlyWhenLineageFails: true;
    onePayloadForPdfAndChat: true;
  };
  pdfChatGate: {
    pdfAllowed: boolean;
    chatAllowed: boolean;
    factsOnly: boolean;
    operatorReview: boolean;
    noFakeLive: true;
  };
  customerReadout: string;
  operatorReadout: string;
};

export type Pass441LensEvalHarnessContract = {
  version: "pass441-lens-eval-harness-contract";
  locale: "pl" | "en" | "de";
  customerLabel: "pdf_preview";
  evalBeforePreview: true;
  onePayload: true;
  oneLocale: true;
  oneSectionOrder: true;
  technicalEvalHidden: true;
  missingDataVisible: boolean;
  customerLine: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function statusFromScore(score: number): Pass441EvalStatus {
  if (score >= 74) return "pass";
  if (score >= 42) return "warn";
  return "fail";
}

function evalCase(input: {
  id: string;
  lane: Pass441EvalLane;
  title: string;
  score: number;
  observed: string;
  expected: string;
  repair: string;
  customerVisible?: boolean;
}): Pass441BrainEvalCase {
  const score = clamp(input.score);
  return {
    id: input.id,
    lane: input.lane,
    title: input.title,
    status: statusFromScore(score),
    score,
    observed: input.observed,
    expected: input.expected,
    repair: input.repair,
    customerVisible: Boolean(input.customerVisible),
  };
}

function providerCountFromAttempts(attempts: Pass433ProviderProbe[] = []) {
  return attempts.filter((probe) => probe.status === "ok" || probe.status === "partial").length;
}

function hasProbeField(attempts: Pass433ProviderProbe[] = [], field: keyof Pick<Pass433ProviderProbe, "hasPrice" | "has24hChange" | "hasVolume24h" | "hasCandles" | "hasSecurity">) {
  return attempts.some((probe) => probe.status !== "error" && Boolean(probe[field]));
}

export function buildPass441BrainEvalHarnessRuntime(input: {
  result: TokenRiskResult;
  pass435: Pass435LiveQueryTestBench;
  pass439: Pass439TruthReplayHarnessRuntime;
  pass440: Pass440SemanticDriftSourceLineageRuntime;
  providerAttempts?: Pass433ProviderProbe[];
}): Pass441BrainEvalHarnessRuntime {
  const attempts = input.providerAttempts ?? [];
  const usableProviders = providerCountFromAttempts(attempts);
  const resultSources = input.result.dataSources.length;
  const sourceCount = Math.max(usableProviders, resultSources);
  const hasPrice = finite(input.result.metrics.currentPrice) || hasProbeField(attempts, "hasPrice");
  const hasChange = finite(input.result.metrics.priceChange24h) || hasProbeField(attempts, "has24hChange");
  const hasVolume = finite(input.result.metrics.volume24h) || hasProbeField(attempts, "hasVolume24h");
  const hasCandles = (input.result.chart?.sevenDay?.length ?? 0) > 4 || hasProbeField(attempts, "hasCandles");
  const hasSecondProvider = sourceCount >= 2;
  const lineageClean = input.pass440.driftState === "semantic_aligned" || input.pass440.driftState === "semantic_guarded";
  const replayClean = input.pass439.replayState === "replay_clean" || input.pass439.replayState === "replay_partial";
  const pdfAllowedUpstream = input.pass439.releaseGate.pdfAllowed && input.pass440.pdfChatGate.pdfAllowed;
  const pass435FactsOnly = input.pass435.releaseMode === "facts_only_no_live_claim" || input.pass435.releaseMode === "block_pdf_until_probe";
  const factsOnlyUpstream = pass435FactsOnly || input.pass439.releaseGate.factsOnly || input.pass440.pdfChatGate.factsOnly;
  const missingCount = input.pass435.missingDataReplay.length;
  const liveReadiness = input.pass435.liveReadinessScore;

  const cases: Pass441BrainEvalCase[] = [
    evalCase({
      id: "pass441_price_observed",
      lane: "source",
      title: "Price is source-backed",
      score: hasPrice ? 100 : 12,
      observed: hasPrice ? "price present in result/probe" : "price missing from result/probe",
      expected: "No live wording without price evidence.",
      repair: "Run crypto market, DEX or real-market provider before live PDF wording.",
      customerVisible: !hasPrice,
    }),
    evalCase({
      id: "pass441_second_provider_or_cap",
      lane: "provider",
      title: "Second provider or confidence cap",
      score: hasSecondProvider ? 94 : factsOnlyUpstream ? 62 : 28,
      observed: `${sourceCount} usable source lane(s); facts-only=${factsOnlyUpstream}`,
      expected: "Second provider confirmed or public confidence is capped/facts-only.",
      repair: "Keep missing second provider visible and schedule next provider probe.",
      customerVisible: !hasSecondProvider,
    }),
    evalCase({
      id: "pass441_core_market_fields",
      lane: "source",
      title: "Core market fields are present",
      score: clamp([hasPrice, hasChange, hasVolume, hasCandles].filter(Boolean).length * 25),
      observed: `price=${hasPrice}; change=${hasChange}; volume=${hasVolume}; candles=${hasCandles}`,
      expected: "Price/change/volume/candles should be observed or called out as missing.",
      repair: "Surface missing fields in PDF/chat and keep release partial until provider lanes fill them.",
      customerVisible: !hasPrice || !hasChange,
    }),
    evalCase({
      id: "pass441_truth_replay_alignment",
      lane: "narrative",
      title: "Truth replay supports customer narrative",
      score: replayClean ? input.pass439.replayScore : Math.min(38, input.pass439.replayScore),
      observed: `${input.pass439.replayState}; replay ${input.pass439.replayScore}/100`,
      expected: "Every customer-facing claim has replayable evidence.",
      repair: "Rewrite unsupported claims into missing-data/facts-only lines.",
      customerVisible: input.pass439.replayState === "replay_sealed",
    }),
    evalCase({
      id: "pass441_semantic_drift_alignment",
      lane: "narrative",
      title: "Semantic drift is controlled",
      score: lineageClean ? 100 - input.pass440.semanticDriftScore : Math.max(8, 54 - input.pass440.semanticDriftScore),
      observed: `${input.pass440.driftState}; drift ${input.pass440.semanticDriftScore}/100; mode ${input.pass440.responseMode}`,
      expected: "Narrative cannot be stronger than source lineage.",
      repair: "Use guarded/facts-only rewrite when tone exceeds evidence.",
      customerVisible: input.pass440.driftState === "semantic_sealed",
    }),
    evalCase({
      id: "pass441_fake_live_budget",
      lane: "chat",
      title: "Fake-live budget is safe",
      score: clamp(100 - input.pass435.fakeLiveRisk),
      observed: `fake-live risk ${input.pass435.fakeLiveRisk}/100; release ${input.pass435.releaseMode}`,
      expected: "No fake-live copy when provider coverage is partial.",
      repair: "Switch to facts-only or block PDF until probe when fake-live risk is high.",
      customerVisible: input.pass435.fakeLiveRisk >= 58,
    }),
    evalCase({
      id: "pass441_pdf_payload_invariant",
      lane: "pdf",
      title: "PDF/chat one payload invariant",
      score: pdfAllowedUpstream || factsOnlyUpstream ? 88 : 34,
      observed: `pdfAllowed=${pdfAllowedUpstream}; factsOnly=${factsOnlyUpstream}`,
      expected: "Preview/download/chat read one resolved payload and one section order.",
      repair: "Block second copy generator and keep checksum/locale/section-order locked.",
    }),
    evalCase({
      id: "pass441_memory_not_provider",
      lane: "memory",
      title: "Memory cannot invent provider evidence",
      score: input.pass440.lineagePolicy.memoryCannotInventSource ? 96 : 16,
      observed: `memoryCannotInventSource=${input.pass440.lineagePolicy.memoryCannotInventSource}`,
      expected: "Long-term memory supports context only; it never replaces live provider evidence.",
      repair: "Seal memory-derived live claims and ask provider execution loop for fresh evidence.",
    }),
    evalCase({
      id: "pass441_live_readiness",
      lane: "provider",
      title: "Live readiness has enough coverage",
      score: liveReadiness,
      observed: `live readiness ${liveReadiness}/100; missing ${missingCount}`,
      expected: "Release full live readout only when enough data coverage exists.",
      repair: "Keep partial readout and run next-best provider queue before stronger output.",
      customerVisible: liveReadiness < 50,
    }),
  ];

  const failedCount = cases.filter((item) => item.status === "fail").length;
  const warningCount = cases.filter((item) => item.status === "warn").length;
  const passedCount = cases.filter((item) => item.status === "pass").length;
  const evalScore = clamp(cases.reduce((sum, item) => sum + item.score, 0) / cases.length);
  const evalMode: Pass441EvalMode = failedCount >= 3 || input.pass440.driftState === "semantic_sealed"
    ? "operator_eval_review"
    : failedCount >= 1 || input.pass435.releaseMode === "block_pdf_until_probe"
      ? "eval_sealed"
      : warningCount >= 2 || input.pass440.responseMode === "facts_only_rewrite"
        ? "eval_guarded"
        : "eval_green";

  const tripwires: Pass441BrainEvalHarnessRuntime["regressionTripwires"] = [];
  if (!hasPrice) tripwires.push({ id: "pass441_tripwire_missing_price", severity: "high", trigger: "price missing before live wording", action: "seal" });
  if (!hasSecondProvider) tripwires.push({ id: "pass441_tripwire_second_provider", severity: "medium", trigger: "second provider missing", action: "guard" });
  if (input.pass435.fakeLiveRisk >= 58) tripwires.push({ id: "pass441_tripwire_fake_live", severity: "high", trigger: `fake-live risk ${input.pass435.fakeLiveRisk}/100`, action: "seal" });
  if (!lineageClean) tripwires.push({ id: "pass441_tripwire_semantic_drift", severity: "high", trigger: input.pass440.driftState, action: "operator_review" });
  if (!replayClean) tripwires.push({ id: "pass441_tripwire_truth_replay", severity: "high", trigger: input.pass439.replayState, action: "operator_review" });
  if (!tripwires.length) tripwires.push({ id: "pass441_tripwire_clear", severity: "low", trigger: "all eval gates within budget", action: "allow" });

  const factsOnly = evalMode === "eval_sealed" || evalMode === "operator_eval_review" || factsOnlyUpstream;
  const operatorReview = evalMode === "operator_eval_review";
  const pdfAllowed = evalMode !== "operator_eval_review" && (pdfAllowedUpstream || factsOnly);
  const chatAllowed = evalMode !== "operator_eval_review" || factsOnly;

  return {
    version: "brain-eval-harness-runtime",
    generatedAt: new Date().toISOString(),
    evalMode,
    evalScore,
    failedCount,
    warningCount,
    passedCount,
    evalCases: cases,
    regressionTripwires: tripwires,
    modelBehaviorPolicy: {
      evalBeforeNarration: true,
      noAnswerWithoutEvidence: true,
      memoryCannotBecomeProvider: true,
      missingDataMustStayVisible: true,
      factsOnlyWhenLineageFails: true,
      onePayloadForPdfAndChat: true,
    },
    pdfChatGate: {
      pdfAllowed,
      chatAllowed,
      factsOnly,
      operatorReview,
      noFakeLive: true,
    },
    customerReadout: evalMode === "eval_green"
      ? "Velmère verified the core evidence gates before preparing the report."
      : evalMode === "eval_guarded"
        ? "Velmère found partial evidence and keeps the report bounded to confirmed data."
        : evalMode === "eval_sealed"
          ? "Velmère found missing or weak provider evidence and limits the output to facts-only."
          : "Velmère requires operator review before stronger customer-facing claims.",
    operatorReadout: `PASS441 eval ${evalMode}; score ${evalScore}/100; pass/warn/fail ${passedCount}/${warningCount}/${failedCount}; tripwires ${tripwires.map((item) => item.id).join(", ")}.`,
  };
}

export function buildPass441LensEvalHarnessContract(input: {
  locale: "pl" | "en" | "de";
  sourceConfidence: number;
  sourceCount: number;
  missingDataCount: number;
  pass440MissingVisible: boolean;
}): Pass441LensEvalHarnessContract {
  const missingDataVisible = input.pass440MissingVisible || input.sourceCount < 2 || input.missingDataCount > 0 || input.sourceConfidence < 55;
  const customerLine = input.locale === "de"
    ? "PDF-Vorschau"
    : input.locale === "en"
      ? "PDF preview"
      : "Podgląd PDF";
  return {
    version: "pass441-lens-eval-harness-contract",
    locale: input.locale,
    customerLabel: "pdf_preview",
    evalBeforePreview: true,
    onePayload: true,
    oneLocale: true,
    oneSectionOrder: true,
    technicalEvalHidden: true,
    missingDataVisible,
    customerLine,
  };
}
