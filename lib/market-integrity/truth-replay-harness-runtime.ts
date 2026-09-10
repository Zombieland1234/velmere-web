import type { TokenRiskResult } from "./risk-types";
import type { Pass433ProviderProbe } from "./real-internet-data-arbitration";
import type { Pass435LiveQueryTestBench } from "./live-query-test-bench";
import type { Pass436WorldBrainSloGraphRuntime } from "./world-brain-slo-graph-runtime";
import type { Pass438ProviderExecutionLoopRuntime } from "./provider-execution-loop-runtime";

export type Pass439ReplayState = "replay_clean" | "replay_partial" | "replay_conflict" | "replay_sealed";
export type Pass439ClaimState = "supported" | "weakly_supported" | "missing_evidence" | "conflict_review";
export type Pass439ReplayLane = "source" | "market" | "risk" | "memory" | "pdf" | "chat" | "operator";

export type Pass439TruthReplayNode = {
  id: string;
  lane: Pass439ReplayLane;
  claim: string;
  state: Pass439ClaimState;
  evidenceIds: string[];
  providerNames: string[];
  missingFields: string[];
  confidence: number;
  customerVisible: boolean;
  replayLine: string;
};

export type Pass439TruthReplayHarnessRuntime = {
  version: "truth-replay-harness-runtime";
  generatedAt: string;
  replayState: Pass439ReplayState;
  replayScore: number;
  truthReplayNodes: Pass439TruthReplayNode[];
  releaseGate: {
    pdfAllowed: boolean;
    chatAllowed: boolean;
    factsOnly: boolean;
    operatorReview: boolean;
    noFakeLive: true;
    onePayload: true;
  };
  replayPolicy: {
    replayEveryCustomerClaim: true;
    hideRawProviderPayloads: true;
    showMissingDataWhenConfidenceDrops: true;
    blockUnsupportedLiveLanguage: true;
    neverInventSecondProvider: true;
  };
  customerReadout: string;
  operatorReadout: string;
};

export type Pass439LensTruthReplayContract = {
  version: "pass439-lens-truth-replay-contract";
  locale: "pl" | "de" | "en";
  onePayload: true;
  replayRequired: true;
  customerLabel: "pdf_preview";
  customerLine: string;
  technicalReplayHidden: true;
  missingDataVisible: boolean;
  noFakeLive: true;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 62) || "claim";
}

function providerNames(probes: Pass433ProviderProbe[]) {
  return unique(probes.filter((probe) => probe.status === "ok" || probe.status === "partial").map((probe) => probe.provider));
}

function missingFromProbes(probes: Pass433ProviderProbe[]) {
  return unique(probes.flatMap((probe) => probe.missing ?? []));
}

function stateFromConfidence(confidence: number, hasConflict: boolean, missingFields: string[]): Pass439ClaimState {
  if (hasConflict) return "conflict_review";
  if (confidence < 30 || missingFields.includes("price")) return "missing_evidence";
  if (confidence < 62 || missingFields.length > 0) return "weakly_supported";
  return "supported";
}

function node(input: {
  lane: Pass439ReplayLane;
  claim: string;
  evidenceIds: string[];
  providerNames: string[];
  missingFields: string[];
  confidence: number;
  conflict?: boolean;
  customerVisible?: boolean;
}): Pass439TruthReplayNode {
  const state = stateFromConfidence(input.confidence, Boolean(input.conflict), input.missingFields);
  return {
    id: `pass439_${input.lane}_${slug(input.claim)}`,
    lane: input.lane,
    claim: input.claim,
    state,
    evidenceIds: unique(input.evidenceIds),
    providerNames: unique(input.providerNames),
    missingFields: unique(input.missingFields),
    confidence: clamp(input.confidence),
    customerVisible: input.customerVisible ?? state !== "supported",
    replayLine: `${input.lane}: ${state}; ${input.providerNames.length || 0} provider(s); missing ${unique(input.missingFields).join("/") || "none"}.`,
  };
}

export function buildPass439TruthReplayHarnessRuntime(input: {
  result: TokenRiskResult;
  pass435: Pass435LiveQueryTestBench;
  pass436: Pass436WorldBrainSloGraphRuntime;
  pass438: Pass438ProviderExecutionLoopRuntime;
  providerAttempts?: Pass433ProviderProbe[];
}): Pass439TruthReplayHarnessRuntime {
  const probes = input.providerAttempts ?? [];
  const providers = providerNames(probes);
  const probeMissing = missingFromProbes(probes);
  const executionMissing = unique(input.pass438.providerExecutionLedger.flatMap((item) => item.missingFields.map(String)));
  const allMissing = unique([...probeMissing, ...executionMissing, ...(input.pass435.missingDataReplay ?? []).map((item) => item.field)]);
  const executionConflicts = input.pass438.providerExecutionLedger.some((item) => item.executionRisk === "sealed" || item.state === "blocked");
  const hasConflict = input.pass436.releaseDecision === "operator_interrupt" || executionConflicts;
  const hasLivePrice = typeof input.result.metrics.currentPrice === "number" && Number.isFinite(input.result.metrics.currentPrice);
  const rawConfidence = input.result.confidence ?? 0.35;
  const sourceConfidence = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;
  const liveReadiness = input.pass435.liveReadinessScore ?? 0;
  const executionScore = input.pass438.executionScore ?? 0;
  const baseConfidence = clamp((sourceConfidence * 0.25) + (liveReadiness * 0.35) + (executionScore * 0.4));

  const nodes: Pass439TruthReplayNode[] = [
    node({
      lane: "source",
      claim: "Provider payload can support a customer-facing market readout",
      evidenceIds: providers,
      providerNames: providers,
      missingFields: allMissing.filter((field) => ["price", "secondProvider", "freshness"].includes(field)),
      confidence: baseConfidence,
      conflict: hasConflict,
    }),
    node({
      lane: "market",
      claim: `${input.result.token.symbol || input.result.token.marketId || "asset"} price/change/volume were observed or explicitly marked missing`,
      evidenceIds: ["metrics.currentPrice", "metrics.priceChange24h", "metrics.volume24h"],
      providerNames: providers,
      missingFields: [
        hasLivePrice ? "" : "price",
        typeof input.result.metrics.priceChange24h === "number" ? "" : "change24h",
        typeof input.result.metrics.volume24h === "number" ? "" : "volume24h",
      ].filter(Boolean),
      confidence: hasLivePrice ? baseConfidence + 8 : baseConfidence - 25,
      conflict: hasConflict,
    }),
    node({
      lane: "risk",
      claim: `Risk score ${input.result.score}/100 is explainable from source, execution and missing-data rails`,
      evidenceIds: ["risk-engine", "pass435", "pass438"],
      providerNames: providers,
      missingFields: allMissing.filter((field) => ["security", "liquidity", "candles", "marketCap"].includes(field)),
      confidence: baseConfidence - Math.min(20, allMissing.length * 2),
      conflict: hasConflict,
    }),
    node({
      lane: "memory",
      claim: "Long-term memory is contextual and cannot override fresh provider evidence",
      evidenceIds: ["pass423-retention", "pass427-memory-safety", "pass438-execution-ledger"],
      providerNames: providers,
      missingFields: [],
      confidence: 78,
      customerVisible: false,
    }),
    node({
      lane: "pdf",
      claim: "PDF preview/download can use the same resolved payload without a second narrative generator",
      evidenceIds: ["lens-report", "pass438", "pass439"],
      providerNames: providers,
      missingFields: allMissing.includes("price") ? ["price"] : [],
      confidence: input.pass438.pdfChatGate.releaseAllowed ? baseConfidence : baseConfidence - 18,
      conflict: hasConflict,
    }),
    node({
      lane: "chat",
      claim: "Angel/chat response must stay source-bound and facts-only when replay is partial",
      evidenceIds: ["pass426-provider-gateway", "pass430-answer-verifier", "pass439"],
      providerNames: providers,
      missingFields: allMissing.filter((field) => ["price", "secondProvider", "freshness"].includes(field)),
      confidence: input.pass438.pdfChatGate.factsOnly ? Math.min(baseConfidence, 58) : baseConfidence,
      conflict: hasConflict,
    }),
  ];

  const weak = nodes.filter((item) => item.state === "weakly_supported").length;
  const missing = nodes.filter((item) => item.state === "missing_evidence").length;
  const conflicts = nodes.filter((item) => item.state === "conflict_review").length;
  const replayScore = clamp(baseConfidence - weak * 5 - missing * 12 - conflicts * 18 - Math.min(15, allMissing.length * 1.5));
  const replayState: Pass439ReplayState = conflicts > 0 || hasConflict
    ? "replay_conflict"
    : missing > 0 || !input.pass438.pdfChatGate.releaseAllowed
      ? "replay_sealed"
      : weak > 0 || allMissing.length > 0
        ? "replay_partial"
        : "replay_clean";
  const factsOnly = replayState === "replay_sealed" || replayState === "replay_conflict" || input.pass438.pdfChatGate.factsOnly;
  const operatorReview = replayState === "replay_conflict" || conflicts > 0;

  return {
    version: "truth-replay-harness-runtime",
    generatedAt: new Date().toISOString(),
    replayState,
    replayScore,
    truthReplayNodes: nodes,
    releaseGate: {
      pdfAllowed: !operatorReview && replayState !== "replay_sealed",
      chatAllowed: !operatorReview,
      factsOnly,
      operatorReview,
      noFakeLive: true,
      onePayload: true,
    },
    replayPolicy: {
      replayEveryCustomerClaim: true,
      hideRawProviderPayloads: true,
      showMissingDataWhenConfidenceDrops: true,
      blockUnsupportedLiveLanguage: true,
      neverInventSecondProvider: true,
    },
    customerReadout: replayState === "replay_clean"
      ? "Velmère replay confirmed the core market readout from the resolved payload."
      : replayState === "replay_partial"
        ? "Velmère replay found partial evidence; missing data stays visible in the report."
        : replayState === "replay_conflict"
          ? "Velmère replay found source conflict; the report must stay cautious."
          : "Velmère replay sealed unsupported live wording until more provider evidence is available.",
    operatorReadout: `PASS439 ${replayState}; replay score ${replayScore}/100; weak ${weak}; missing ${missing}; conflicts ${conflicts}; providers ${providers.join(", ") || "none"}.`,
  };
}

export function buildPass439LensTruthReplayContract(input: {
  locale: "pl" | "de" | "en";
  sourceConfidence: number;
  sourceCount: number;
  missingDataCount: number;
  pass438ReleaseAllowed?: boolean;
}): Pass439LensTruthReplayContract {
  const partial = input.sourceConfidence < 62 || input.sourceCount < 2 || input.missingDataCount > 0 || input.pass438ReleaseAllowed === false;
  const lines: Record<"pl" | "de" | "en", string> = {
    pl: partial ? "Podgląd PDF pokazuje tylko potwierdzone pola i widoczne braki danych." : "Podgląd PDF odtwarza ten sam potwierdzony payload raportu.",
    en: partial ? "PDF preview shows confirmed fields and visible missing data only." : "PDF preview replays the same confirmed report payload.",
    de: partial ? "Die PDF-Vorschau zeigt nur bestätigte Felder und sichtbare Datenlücken." : "Die PDF-Vorschau gibt dieselbe bestätigte Berichtsnutzlast wieder.",
  };
  return {
    version: "pass439-lens-truth-replay-contract",
    locale: input.locale,
    onePayload: true,
    replayRequired: true,
    customerLabel: "pdf_preview",
    customerLine: lines[input.locale],
    technicalReplayHidden: true,
    missingDataVisible: partial,
    noFakeLive: true,
  };
}
