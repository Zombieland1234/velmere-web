import type { TokenRiskResult } from "./risk-types";
import type { Pass423TieredMemorySummary } from "./long-term-memory-spine";
import type { Pass424BrainErrorCorrectionCore } from "./brain-correction-contract";

export type Pass425SourceArbitrationMode =
  | "quorum_confirmed"
  | "single_provider_shadow"
  | "source_conflict_review"
  | "stale_or_missing_sealed";

export type Pass425ConfidenceBand = "low" | "guarded" | "usable" | "strong";
export type Pass425ClaimAllowance = "facts_only" | "cautious_summary" | "bounded_analysis" | "adaptive_summary";
export type Pass425MemoryWriteMode = "observation_only" | "shadow_write" | "bounded_write" | "adaptive_write_capped";

type MemoryLike = {
  sampleCount: number;
  trend: string;
  stability: string;
  overfitGuard: string;
  learningWeight: number;
};

type SourceGenomeLike = {
  sourceCount: number;
  confirmedSourceCount: number;
  missingCoreCount: number;
  confidence: number;
  freshness: string;
  secondProvider: string;
  providerRisk: string;
  notes: string[];
};

type EvidenceRailLike = {
  id: string;
  label: string;
  score: number;
  confidence: number;
  reason: string;
  evidence: string[];
  contribution: number;
};

export type Pass425SourceArbitrationCore = {
  version: "source-arbitration-hallucination-brake";
  generatedAt: string;
  arbitrationMode: Pass425SourceArbitrationMode;
  confidenceBand: Pass425ConfidenceBand;
  sourceQuorum: {
    required: 2;
    available: number;
    secondProvider: string;
    agreementScore: number;
    freshnessState: string;
    providerRisk: string;
  };
  hallucinationBrake: {
    score: number;
    allowance: Pass425ClaimAllowance;
    maxNarrativeSentences: number;
    blockedClaims: string[];
    allowedClaims: string[];
  };
  memoryWritePolicy: {
    mode: Pass425MemoryWriteMode;
    sampleFloor: number;
    maxAdaptiveWeight: number;
    retentionYears: number;
    reason: string;
  };
  pdfNarrativeContract: {
    sectionOrder: ["brief", "risk", "evidence", "sources", "missing", "memory", "next", "signature"];
    deterministic: true;
    localeBound: true;
    maxBodyChars: number;
    repeatSuppression: true;
    sourceBoundOnly: true;
  };
  claimFilters: Array<{
    id: string;
    action: "allow" | "soften" | "block" | "route_to_operator";
    reason: string;
  }>;
  livingBrainState: "quiet_observer" | "reviewing_conflict" | "learning_shadow" | "bounded_adaptive";
  publicSummary: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function confidenceBand(value: number): Pass425ConfidenceBand {
  if (value >= 82) return "strong";
  if (value >= 64) return "usable";
  if (value >= 42) return "guarded";
  return "low";
}

function claimAllowance(mode: Pass425SourceArbitrationMode, band: Pass425ConfidenceBand, brake: number): Pass425ClaimAllowance {
  if (mode === "stale_or_missing_sealed" || brake >= 78 || band === "low") return "facts_only";
  if (mode === "source_conflict_review" || band === "guarded") return "cautious_summary";
  if (band === "usable") return "bounded_analysis";
  return "adaptive_summary";
}

function memoryWriteMode(memory: MemoryLike, longTerm: Pass423TieredMemorySummary, mode: Pass425SourceArbitrationMode): Pass425MemoryWriteMode {
  if (mode === "stale_or_missing_sealed" || memory.sampleCount < 4) return "observation_only";
  if (memory.overfitGuard === "locked" || memory.overfitGuard === "shadow") return "shadow_write";
  if (longTerm.learningMode === "adaptive" && mode === "quorum_confirmed") return "adaptive_write_capped";
  return "bounded_write";
}

export function buildPass425SourceArbitrationCore(input: {
  result: Pick<TokenRiskResult, "score" | "confidence" | "dataQuality" | "dataSources" | "signals" | "metaModel">;
  memory: MemoryLike;
  longTermMemory: Pass423TieredMemorySummary;
  pass424: Pass424BrainErrorCorrectionCore;
  sourceGenome: SourceGenomeLike;
  evidenceRail: EvidenceRailLike[];
  missingData: string[];
}): Pass425SourceArbitrationCore {
  const conflictPenalty = input.result.metaModel?.conflictLevel === "high" ? 34
    : input.result.metaModel?.conflictLevel === "medium" ? 22
      : input.result.metaModel?.conflictLevel === "low" ? 10
        : 0;
  const freshnessPenalty = input.sourceGenome.freshness === "missing" ? 28
    : input.sourceGenome.freshness === "demo" ? 22
      : input.sourceGenome.freshness === "partial" ? 12
        : 0;
  const providerPenalty = input.sourceGenome.providerRisk === "degraded" ? 30
    : input.sourceGenome.providerRisk === "watch" ? 16
      : 4;
  const missingPenalty = Math.min(42, input.missingData.length * 5 + input.sourceGenome.missingCoreCount * 3);
  const evidenceSupport = clamp(input.evidenceRail.length * 5 + input.evidenceRail.reduce((sum, rail) => sum + Math.min(8, rail.evidence.length * 2), 0), 0, 46);
  const agreementScore = clamp(input.sourceGenome.confidence + evidenceSupport - conflictPenalty - freshnessPenalty - missingPenalty / 2);
  const mode: Pass425SourceArbitrationMode = input.sourceGenome.sourceCount === 0 || input.sourceGenome.freshness === "missing"
    ? "stale_or_missing_sealed"
    : input.result.metaModel?.conflictLevel === "high" || input.pass424.contradictionScore >= 68
      ? "source_conflict_review"
      : input.sourceGenome.secondProvider !== "confirmed" || input.sourceGenome.sourceCount < 2
        ? "single_provider_shadow"
        : "quorum_confirmed";
  const band = confidenceBand(Math.min(input.sourceGenome.confidence, agreementScore));
  const hallucinationBrakeScore = clamp(providerPenalty + freshnessPenalty + missingPenalty + input.pass424.contradictionScore * 0.42 - evidenceSupport * 0.35);
  const allowance = claimAllowance(mode, band, hallucinationBrakeScore);
  const writeMode = memoryWriteMode(input.memory, input.longTermMemory, mode);
  const blockedClaims = [
    "price certainty",
    "guaranteed direction",
    "investment instruction",
    "unstated provider confirmation",
    "hidden missing-data replacement",
    mode !== "quorum_confirmed" ? "strong public conclusion without quorum" : "unbounded long-term extrapolation",
  ];
  const allowedClaims = [
    "visible source state",
    "risk score with confidence band",
    "named missing data",
    "evidence-backed layer summary",
    "operator next step",
    "memory trend with decay context",
  ];
  const claimFilters: Pass425SourceArbitrationCore["claimFilters"] = [
    {
      id: "source_quorum_gate",
      action: mode === "quorum_confirmed" ? "allow" : mode === "single_provider_shadow" ? "soften" : "route_to_operator",
      reason: mode === "quorum_confirmed" ? "Two-provider quorum is present." : "Public narrative must stay capped until provider quorum is stronger.",
    },
    {
      id: "missing_data_truth_gate",
      action: input.missingData.length ? "soften" : "allow",
      reason: input.missingData.length ? `${input.missingData.length} missing field(s) must stay visible.` : "No core missing-data gate in this payload.",
    },
    {
      id: "memory_overfit_gate",
      action: writeMode === "adaptive_write_capped" ? "allow" : writeMode === "observation_only" ? "block" : "soften",
      reason: input.longTermMemory.antiOverfitReason,
    },
    {
      id: "narrative_noise_gate",
      action: hallucinationBrakeScore >= 74 ? "block" : hallucinationBrakeScore >= 44 ? "soften" : "allow",
      reason: `Hallucination brake ${round(hallucinationBrakeScore)} with allowance ${allowance}.`,
    },
  ];
  const livingBrainState: Pass425SourceArbitrationCore["livingBrainState"] = mode === "source_conflict_review" || mode === "stale_or_missing_sealed"
    ? "reviewing_conflict"
    : writeMode === "adaptive_write_capped"
      ? "bounded_adaptive"
      : writeMode === "shadow_write"
        ? "learning_shadow"
        : "quiet_observer";

  return {
    version: "source-arbitration-hallucination-brake",
    generatedAt: new Date().toISOString(),
    arbitrationMode: mode,
    confidenceBand: band,
    sourceQuorum: {
      required: 2,
      available: input.sourceGenome.sourceCount,
      secondProvider: input.sourceGenome.secondProvider,
      agreementScore: round(agreementScore),
      freshnessState: input.sourceGenome.freshness,
      providerRisk: input.sourceGenome.providerRisk,
    },
    hallucinationBrake: {
      score: round(hallucinationBrakeScore),
      allowance,
      maxNarrativeSentences: allowance === "facts_only" ? 3 : allowance === "cautious_summary" ? 5 : allowance === "bounded_analysis" ? 7 : 9,
      blockedClaims,
      allowedClaims,
    },
    memoryWritePolicy: {
      mode: writeMode,
      sampleFloor: writeMode === "adaptive_write_capped" ? 120 : writeMode === "bounded_write" ? 24 : 8,
      maxAdaptiveWeight: writeMode === "adaptive_write_capped" ? 0.42 : writeMode === "bounded_write" ? 0.22 : writeMode === "shadow_write" ? 0.08 : 0,
      retentionYears: input.longTermMemory.retentionYears,
      reason: writeMode === "adaptive_write_capped"
        ? "Long-term memory can add small context because quorum and sample depth are strong enough."
        : writeMode === "bounded_write"
          ? "Memory can be written but cannot dominate current-source evidence."
          : writeMode === "shadow_write"
            ? "Memory is stored in shadow until sample depth and provider quorum improve."
            : "Observation is retained, but this event cannot change rules or scoring weights.",
    },
    pdfNarrativeContract: {
      sectionOrder: ["brief", "risk", "evidence", "sources", "missing", "memory", "next", "signature"],
      deterministic: true,
      localeBound: true,
      maxBodyChars: 520,
      repeatSuppression: true,
      sourceBoundOnly: true,
    },
    claimFilters,
    livingBrainState,
    publicSummary: `PASS425 ${mode}; band ${band}; agreement ${round(agreementScore)}; brake ${round(hallucinationBrakeScore)}; memory ${writeMode}.`,
  };
}

export function buildPass425LensNarrativeContract(input: {
  locale: "pl" | "en" | "de";
  sourceConfidence: number;
  sourceCount: number;
  missingData: string[];
  checksum: string;
}) {
  const band = confidenceBand(input.sourceConfidence);
  const mode: Pass425SourceArbitrationMode = input.sourceCount >= 2
    ? "quorum_confirmed"
    : input.sourceCount === 1
      ? "single_provider_shadow"
      : "stale_or_missing_sealed";
  const brake = clamp((input.sourceCount < 2 ? 34 : 6) + input.missingData.length * 7 + (band === "low" ? 24 : band === "guarded" ? 12 : 0));
  return {
    version: "pass425-lens-hallucination-brake" as const,
    mode,
    confidenceBand: band,
    hallucinationBrake: round(brake),
    checksum: input.checksum,
    localeBranch: input.locale,
    customerFacingLabel: input.locale === "pl" ? "Podgląd PDF" : input.locale === "de" ? "PDF-Vorschau" : "PDF preview",
    deterministicRules: [
      "Preview and download use one resolved report object.",
      "Text may summarize only fields present in the payload.",
      "Missing data stays visible and cannot be replaced by generated copy.",
      "Locale branch controls the final language of every section.",
    ],
  };
}
