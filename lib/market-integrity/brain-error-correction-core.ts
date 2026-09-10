import type { Pass422EvidenceRail, Pass422MemoryPulse, Pass422SourceGenome } from "./brain-correction-contract";
import type { Pass423TieredMemorySummary } from "./long-term-memory-spine";

export type Pass424BrainMode = "sealed" | "observe" | "correct" | "adaptive";

export type Pass424BrainErrorCorrectionCore = {
  version: "brain-error-correction-core";
  mode: Pass424BrainMode;
  contradictionScore: number;
  narrativeNoiseBudget: number;
  overfitBrake: number;
  evidenceDensity: number;
  sourceReliabilityScore: number;
  memoryHorizon: {
    retentionYears: number;
    tier: "runtime" | "durable";
    archiveInfluenceCap: number;
    hotWeightCap: number;
  };
  fieldBudget: {
    basic: 10;
    pro: 14;
    advanced: 20;
  };
  correctionRails: Array<{
    id: string;
    label: string;
    action: "hide_claim" | "cap_confidence" | "ask_second_provider" | "keep_shadow" | "allow_small_adaptation";
    reason: string;
  }>;
  deterministicNarrativeRules: string[];
  publicSummary: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function buildPass424BrainErrorCorrectionCore(input: {
  score: number;
  confidence: number;
  memory: Pass422MemoryPulse;
  longTermMemory: Pass423TieredMemorySummary;
  sourceGenome: Pass422SourceGenome;
  evidenceRail: Pass422EvidenceRail[];
  missingData: string[];
}): Pass424BrainErrorCorrectionCore {
  const missingPressure = clamp(input.missingData.length * 7, 0, 48);
  const providerPenalty = input.sourceGenome.providerRisk === "degraded" ? 34 : input.sourceGenome.providerRisk === "watch" ? 18 : 4;
  const memoryNoise = input.memory.stability === "volatile" ? 22 : input.memory.stability === "warming" ? 12 : 3;
  const contradictionScore = clamp(missingPressure + providerPenalty + memoryNoise - input.evidenceRail.length * 2);
  const evidenceDensity = clamp(input.evidenceRail.reduce((sum, rail) => sum + Math.min(12, rail.evidence.length * 3), 0) / Math.max(1, input.evidenceRail.length));
  const sourceReliabilityScore = clamp(input.sourceGenome.confidence - providerPenalty - Math.min(18, input.sourceGenome.missingCoreCount * 2));
  const overfitBrake = input.memory.overfitGuard === "adaptive" ? 18 : input.memory.overfitGuard === "limited" ? 38 : input.memory.overfitGuard === "shadow" ? 62 : 82;
  const narrativeNoiseBudget = clamp(100 - contradictionScore - overfitBrake / 2, 8, 72);
  const mode: Pass424BrainMode = contradictionScore >= 62 || input.sourceGenome.secondProvider === "missing"
    ? "sealed"
    : input.memory.overfitGuard === "locked" || input.memory.overfitGuard === "shadow"
      ? "observe"
      : input.memory.overfitGuard === "limited" || input.sourceGenome.providerRisk === "watch"
        ? "correct"
        : "adaptive";

  const correctionRails: Pass424BrainErrorCorrectionCore["correctionRails"] = [
    input.sourceGenome.secondProvider === "missing" ? {
      id: "second_provider_missing",
      label: "Second provider missing",
      action: "ask_second_provider",
      reason: "Public wording stays capped until a second provider confirms the market lane.",
    } : null,
    input.missingData.length ? {
      id: "missing_data_visible",
      label: "Missing data visible",
      action: "cap_confidence",
      reason: `${input.missingData.length} missing field(s) stay in the report instead of being filled by AI copy.`,
    } : null,
    contradictionScore >= 55 ? {
      id: "contradiction_brake",
      label: "Contradiction brake",
      action: "hide_claim",
      reason: "Source gaps and memory noise are high; stronger claims are hidden until evidence improves.",
    } : null,
    input.memory.overfitGuard !== "adaptive" ? {
      id: "shadow_learning",
      label: "Shadow learning",
      action: "keep_shadow",
      reason: input.memory.overfitReason,
    } : {
      id: "small_adaptation",
      label: "Small adaptation allowed",
      action: "allow_small_adaptation",
      reason: "Stable multi-sample memory can slightly adjust context, never replace source evidence.",
    },
  ].filter(Boolean) as Pass424BrainErrorCorrectionCore["correctionRails"];

  return {
    version: "brain-error-correction-core",
    mode,
    contradictionScore: round(contradictionScore),
    narrativeNoiseBudget: round(narrativeNoiseBudget),
    overfitBrake: round(overfitBrake),
    evidenceDensity: round(evidenceDensity),
    sourceReliabilityScore: round(sourceReliabilityScore),
    memoryHorizon: {
      retentionYears: input.longTermMemory.retentionYears,
      tier: input.longTermMemory.storageReality === "durable_years_ready" ? "durable" : "runtime",
      archiveInfluenceCap: 0.2,
      hotWeightCap: mode === "adaptive" ? 0.42 : 0.22,
    },
    fieldBudget: {
      basic: 10,
      pro: 14,
      advanced: 20,
    },
    correctionRails,
    deterministicNarrativeRules: [
      "Same payload and locale must produce the same public PDF sections.",
      "Missing fields are named; the narrator never invents replacement facts.",
      "Second-provider gaps cap confidence and block stronger conclusions.",
      "Archive memory can explain long history but cannot dominate current risk.",
      "Basic, Pro and Advanced differ by field budget only, not by truth source.",
      "Contradictions trigger sealed/correct mode before any public claim is amplified.",
    ],
    publicSummary: `PASS424 brain ${mode}; contradiction ${round(contradictionScore)}; source reliability ${round(sourceReliabilityScore)}; narrative budget ${round(narrativeNoiseBudget)}.`,
  };
}
