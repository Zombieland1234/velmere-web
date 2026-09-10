/** Neutral VLM Brain correction DTOs. This module imports no brain implementation. */
export type Pass422EvidenceRail = {
  id: string;
  label: string;
  score: number;
  confidence: number;
  reason: string;
  evidence: string[];
  contribution: number;
};

export type Pass422MemoryPulse = {
  sampleCount: number;
  decayedSampleCount: number;
  halfLifeHours: number;
  delta24h: number;
  delta7d: number;
  trend: "rising" | "falling" | "flat" | "insufficient_history";
  stability: "stable" | "warming" | "volatile" | "insufficient_history";
  learningWeight: number;
  overfitGuard: "locked" | "shadow" | "limited" | "adaptive";
  overfitReason: string;
};

export type Pass422SourceGenome = {
  sourceCount: number;
  confirmedSourceCount: number;
  missingCoreCount: number;
  confidence: number;
  freshness: "live" | "partial" | "demo" | "missing";
  secondProvider: "confirmed" | "partial" | "missing";
  providerRisk: "healthy" | "watch" | "degraded";
  notes: string[];
};

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
  fieldBudget: { basic: 10; pro: 14; advanced: 20 };
  correctionRails: Array<{
    id: string;
    label: string;
    action: "hide_claim" | "cap_confidence" | "ask_second_provider" | "keep_shadow" | "allow_small_adaptation";
    reason: string;
  }>;
  deterministicNarrativeRules: string[];
  publicSummary: string;
};
