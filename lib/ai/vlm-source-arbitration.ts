import type { VlmFact, VlmSource } from "./vlm-contract";
import { evaluateVlmEvidenceQuorum, type VlmEvidenceQuorum } from "./vlm-evidence-quorum";
import { assessVlmSourceIntegrity, type VlmSourceIntegrityAssessment } from "./vlm-source-integrity";
import { evaluateVlmTemporalConsistency, type VlmTemporalConsistencyAssessment } from "./vlm-temporal-consistency";

export type VlmSourceArbitration = {
  confidenceCap: number;
  providerCount: number;
  sourceCount: number;
  freshSources: number;
  agingSources: number;
  staleSources: number;
  unknownSources: number;
  sourceBackedFactRatio: number;
  conflictCount: number;
  evidenceQuorum: VlmEvidenceQuorum;
  sourceIntegrity: VlmSourceIntegrityAssessment;
  temporalConsistency: VlmTemporalConsistencyAssessment;
  reasons: string[];
};

function freshnessState(observedAt: string | null) {
  if (!observedAt) return "unknown" as const;
  const time = new Date(observedAt).getTime();
  if (!Number.isFinite(time)) return "unknown" as const;
  const age = Date.now() - time;
  if (age < 0) return "unknown" as const;
  if (age <= 15 * 60_000) return "fresh" as const;
  if (age <= 6 * 60 * 60_000) return "aging" as const;
  return "stale" as const;
}

export function arbitrateVlmSources(input: {
  sources: VlmSource[];
  facts: VlmFact[];
  conflictCount: number;
  baseConfidenceCap: number;
}): VlmSourceArbitration {
  const providers = new Set(
    input.sources
      .filter((source) => source.id !== "internal:risk-engine")
      .map((source) => source.provider.trim().toLowerCase())
      .filter(Boolean),
  );
  const states = input.sources.map((source) => freshnessState(source.observedAt));
  const freshSources = states.filter((state) => state === "fresh").length;
  const agingSources = states.filter((state) => state === "aging").length;
  const staleSources = states.filter((state) => state === "stale").length;
  const unknownSources = states.filter((state) => state === "unknown").length;
  const factsWithValue = input.facts.filter((fact) => fact.value !== null);
  const sourceBackedFacts = factsWithValue.filter((fact) => fact.sourceIds.length > 0);
  const sourceBackedFactRatio = factsWithValue.length ? sourceBackedFacts.length / factsWithValue.length : 0;
  const qualityAverage = input.sources.length
    ? input.sources.reduce((sum, source) => sum + source.quality, 0) / input.sources.length
    : 0;
  const sourceIntegrity = assessVlmSourceIntegrity({ sources: input.sources, requiredProviderFamilies: 2 });
  const temporalConsistency = evaluateVlmTemporalConsistency({
    sources: input.sources,
    facts: input.facts,
    quarantinedSourceIds: sourceIntegrity.quarantinedSourceIds,
  });
  const evidenceQuorum = evaluateVlmEvidenceQuorum({
    sources: input.sources,
    facts: input.facts,
    conflictCount: input.conflictCount,
    requiredProviderCount: 2,
    quarantinedSourceIds: sourceIntegrity.quarantinedSourceIds,
  });

  const reasons: string[] = [];
  let cap = Math.min(input.baseConfidenceCap, qualityAverage || input.baseConfidenceCap);
  if (providers.size < 2) {
    cap -= 12;
    reasons.push("Fewer than two independent external provider families are represented.");
  }
  if (sourceBackedFactRatio < 0.75) {
    cap -= 10;
    reasons.push("Some populated facts do not carry a source identifier.");
  }
  if (staleSources > 0) {
    cap -= Math.min(18, staleSources * 6);
    reasons.push("Stale source observations reduce confidence.");
  }
  if (unknownSources > 0) {
    cap -= Math.min(10, unknownSources * 3);
    reasons.push("Some source timestamps are unknown.");
  }
  if (input.conflictCount > 0) {
    cap -= Math.min(24, input.conflictCount * 8);
    reasons.push("Conflicting evidence requires manual review.");
  }
  if (sourceIntegrity.status === "quarantined") {
    cap = Math.min(cap - sourceIntegrity.confidencePenalty, 34);
    reasons.push("Source Integrity Sentinel quarantined source evidence; live confidence is blocked.");
  } else if (sourceIntegrity.status === "degraded") {
    cap = Math.min(cap - sourceIntegrity.confidencePenalty, 52);
    reasons.push("Source Integrity Sentinel degraded source confidence.");
  }
  if (evidenceQuorum.status === "weak") {
    cap = Math.min(cap - 14, 39);
    reasons.push("Evidence quorum is weak; strong confidence is not allowed.");
  } else if (evidenceQuorum.status === "mixed") {
    cap = Math.min(cap - 6, 59);
    reasons.push("Evidence quorum is mixed; confidence stays below high-conviction band.");
  }
  if (temporalConsistency.status === "invalid") {
    cap = Math.min(cap - temporalConsistency.confidencePenalty, 28);
    reasons.push("Temporal Consistency Sentinel found invalid or future-dated evidence; live confidence is blocked.");
  } else if (temporalConsistency.status === "stale") {
    cap = Math.min(cap - temporalConsistency.confidencePenalty, 39);
    reasons.push("Evidence Half-Life marks key facts as stale; confidence stays in fallback band.");
  } else if (temporalConsistency.status === "aging") {
    cap = Math.min(cap - temporalConsistency.confidencePenalty, 62);
    reasons.push("Evidence Half-Life marks some facts as aging; confidence is conditional.");
  }
  if (!input.sources.length) {
    cap = Math.min(cap, 18);
    reasons.push("No source record is available.");
  }

  return {
    confidenceCap: Math.round(Math.max(8, Math.min(94, cap))),
    providerCount: providers.size,
    sourceCount: input.sources.length,
    freshSources,
    agingSources,
    staleSources,
    unknownSources,
    sourceBackedFactRatio: Number(sourceBackedFactRatio.toFixed(3)),
    conflictCount: input.conflictCount,
    evidenceQuorum,
    sourceIntegrity,
    temporalConsistency,
    reasons: Array.from(new Set([...reasons, ...evidenceQuorum.reasons, ...sourceIntegrity.reasons, ...temporalConsistency.reasons])).slice(0, 16),
  };
}
