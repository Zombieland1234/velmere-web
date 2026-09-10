import type { VlmDepth } from "./vlm-contract";
import type { VlmCanonicalFactPacket } from "./vlm-fact-packet";

export type VlmEpistemicDecision = {
  confidenceCap: number;
  evidenceCoverage: number;
  uncertaintyBudget: number;
  interpretationMode: "facts_only" | "bounded_interpretation" | "counterfactual_review";
  requiredChallenges: string[];
  blockedClaims: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function buildVlmEpistemicDecision(
  packet: VlmCanonicalFactPacket,
  depth: VlmDepth,
): VlmEpistemicDecision {
  const populatedFacts = packet.facts.filter((fact) => fact.value !== null);
  const sourceBoundFacts = populatedFacts.filter((fact) => fact.sourceIds.length > 0);
  const evidenceCoverage = populatedFacts.length
    ? clamp((sourceBoundFacts.length / populatedFacts.length) * 100)
    : 0;
  const sourceIntegrity = packet.sourceArbitration.sourceIntegrity;
  const temporalConsistency = packet.sourceArbitration.temporalConsistency;
  const uncertaintyBudget = clamp(
    100 -
      evidenceCoverage * 0.45 -
      packet.sourceArbitration.providerCount * 12 -
      sourceIntegrity.score * 0.18 -
      temporalConsistency.score * 0.16 +
      packet.missingData.length * 4 +
      packet.conflicts.length * 10 +
      sourceIntegrity.confidencePenalty +
      temporalConsistency.confidencePenalty,
  );
  const interpretationMode =
    packet.sourceArbitration.providerCount < 2 || sourceIntegrity.status !== "trusted" || temporalConsistency.status !== "current" || packet.confidenceCap < 40
      ? "facts_only"
      : depth === "advanced"
        ? "counterfactual_review"
        : "bounded_interpretation";

  const requiredChallenges = [
    "State the strongest evidence against the leading interpretation.",
    "Name the missing observation with the highest decision value.",
    ...(sourceIntegrity.status !== "trusted" ? ["Explain the source-integrity limitation before interpreting the market signal."] : []),
    ...(temporalConsistency.status !== "current" ? ["Explain the evidence half-life limitation before treating a market fact as current."] : []),
    ...(depth === "advanced"
      ? [
          "Describe a plausible benign explanation and a plausible adverse explanation.",
          "State the condition that would reverse the current verdict.",
        ]
      : []),
  ];

  return {
    confidenceCap: Math.min(packet.confidenceCap, evidenceCoverage || packet.confidenceCap),
    evidenceCoverage,
    uncertaintyBudget,
    interpretationMode,
    requiredChallenges,
    blockedClaims: [
      "certainty from absence of evidence",
      "price direction from risk score",
      "safety from calm verdict",
      "wrongdoing from missing data",
      "causation from correlation",
      "source robustness from duplicate provider-family records",
      "high confidence from quarantined source metadata",
      "live-market interpretation from stale or aging evidence",
    ],
  };
}
