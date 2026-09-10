import type { VlmBrainOutput } from "./vlm-contract";
import type { VlmCanonicalFactPacket } from "./vlm-fact-packet";
import type { VlmShadowReview } from "./vlm-shadow-contract";
import { evaluateVlmDecisionReversibility } from "./vlm-narrative-drift";

export type VlmShadowGate = {
  publish: boolean;
  status: "approved" | "revised" | "rejected";
  confidenceCap: number;
  issueCodes: string[];
  invalidSourceIds: string[];
};

export function evaluateVlmShadowReview(
  review: VlmShadowReview,
  candidate: VlmBrainOutput,
  packet: VlmCanonicalFactPacket,
): VlmShadowGate {
  const allowedSources = new Set(packet.allowedSourceIds);
  const candidateFindingIds = new Set(candidate.keyFindings.map((finding: VlmBrainOutput["keyFindings"][number]) => finding.id));
  const invalidSourceIds = review.issues
    .flatMap((issue: VlmShadowReview["issues"][number]) => issue.sourceIds)
    .filter((sourceId: string) => !allowedSources.has(sourceId));
  const invalidFindingReference = review.issues.some(
    (issue: VlmShadowReview["issues"][number]) => issue.findingId && !candidateFindingIds.has(issue.findingId),
  );
  const weakFactIds = new Set(packet.sourceArbitration.evidenceQuorum.weakFactIds);
  const weakQuorumOverconfidence = candidate.keyFindings.some((finding: VlmBrainOutput["keyFindings"][number]) => {
    const factId = finding.id.startsWith("fact-") ? finding.id.replace(/^fact-/, "") : null;
    return Boolean(factId && weakFactIds.has(factId) && finding.confidence > 39);
  });
  const weakQuorumHighConfidence = packet.sourceArbitration.evidenceQuorum.status !== "strong" && candidate.confidence > packet.confidenceCap;
  const sourceIntegrity = packet.sourceArbitration.sourceIntegrity;
  const sourceIntegrityOverconfidence = sourceIntegrity.status !== "trusted" && candidate.confidence > Math.min(packet.confidenceCap, 44);
  const sourceIntegrityUnsupportedTrust = sourceIntegrity.status !== "trusted" && [candidate.headline, candidate.summary, candidate.report.sourceAssessment, candidate.report.conclusion].some((text) =>
    /\b(?:verified source coverage|robust sources|trusted source set|source integrity confirmed|zrodla zweryfikowane|solidne zrodla|zaufane zrodla|źr[oó]dła zweryfikowane|solidne źr[oó]dła|zaufane źr[oó]dła|quellenintegritaet bestaetigt|quellenintegrität bestätigt|robuste quellen|vertrauenswuerdige quellen|vertrauenswürdige quellen)\b/i.test(text),
  );
  const temporalConsistency = packet.sourceArbitration.temporalConsistency;
  const temporalOverconfidence = temporalConsistency.status !== "current" && candidate.confidence > Math.min(packet.confidenceCap, 39);
  const temporalUnsupportedLiveClaim = temporalConsistency.status !== "current" && [candidate.headline, candidate.summary, candidate.report.marketStructure, candidate.report.sourceAssessment, candidate.report.conclusion].some((text) =>
    /\b(?:live evidence|real[- ]time|up[- ]to[- ]date|freshly verified|current market proof|świeżo potwierdzon\w*|dane live|dane w czasie rzeczywistym|aktualny dowód|echtzeitdaten|aktuell verifiziert|frisch bestätigt|live[- ]daten)\b/i.test(text),
  );
  const reversibility = evaluateVlmDecisionReversibility(packet);
  const reversibilityOverclaim = reversibility.tier !== "high" && [candidate.headline, candidate.summary, candidate.report.liquidityAnalysis, candidate.report.riskScenarios, candidate.report.conclusion].some((text) =>
    /\b(?:fully reversible|easy to reverse|no execution friction|no slippage risk|łatw\w* do odwrócenia|bez poślizgu|bez tarcia wykonania|vollständig umkehrbar|leicht umkehrbar|kein slippage risiko)\b/i.test(text),
  );
  const highImpactIssue = review.issues.some((issue: VlmShadowReview["issues"][number]) =>
    issue.code === "unsupported_claim" ||
    issue.code === "source_mismatch" ||
    issue.code === "unsafe_decision_copy",
  );
  const forcedReject =
    review.verdict === "reject" ||
    invalidSourceIds.length > 0 ||
    invalidFindingReference ||
    weakQuorumOverconfidence ||
    sourceIntegrityUnsupportedTrust ||
    temporalUnsupportedLiveClaim ||
    reversibilityOverclaim ||
    (sourceIntegrity.status === "quarantined" && sourceIntegrityOverconfidence) ||
    (temporalConsistency.status === "invalid" && temporalOverconfidence) ||
    (review.riskScore >= 85 && highImpactIssue);
  const revisionRequired =
    review.verdict === "revise" ||
    review.riskScore >= 45 ||
    review.issues.length > 0 ||
    review.missingChallenges.length > 0 ||
    weakQuorumHighConfidence ||
    sourceIntegrityOverconfidence ||
    temporalOverconfidence ||
    reversibilityOverclaim ||
    reversibility.tier === "low" ||
    reversibility.tier === "unknown" ||
    sourceIntegrity.status !== "trusted" ||
    temporalConsistency.status !== "current" ||
    packet.sourceArbitration.evidenceQuorum.status !== "strong";
  const confidenceCap = Math.max(
    0,
    Math.min(
      packet.confidenceCap,
      review.confidenceCap,
      forcedReject ? 0 : revisionRequired ? 59 : 100,
    ),
  );

  return {
    publish: !forcedReject,
    status: forcedReject ? "rejected" : revisionRequired ? "revised" : "approved",
    confidenceCap,
    issueCodes: Array.from(new Set([
      ...review.issues.map((issue: VlmShadowReview["issues"][number]) => issue.code),
      ...(weakQuorumOverconfidence ? ["weak_quorum_overconfidence"] : []),
      ...(weakQuorumHighConfidence ? ["weak_quorum_confidence_cap"] : []),
      ...(sourceIntegrityOverconfidence ? ["source_integrity_confidence_cap"] : []),
      ...(sourceIntegrityUnsupportedTrust ? ["source_integrity_overclaim"] : []),
      ...(sourceIntegrity.status !== "trusted" ? [`source_integrity_${sourceIntegrity.status}`] : []),
      ...(temporalOverconfidence ? ["temporal_consistency_confidence_cap"] : []),
      ...(temporalUnsupportedLiveClaim ? ["temporal_consistency_overclaim"] : []),
      ...(temporalConsistency.status !== "current" ? [`temporal_consistency_${temporalConsistency.status}`] : []),
      ...(reversibilityOverclaim ? ["decision_reversibility_overclaim"] : []),
      ...(reversibility.tier === "low" || reversibility.tier === "unknown" ? [`decision_reversibility_${reversibility.tier}`] : []),
      ...(packet.sourceArbitration.evidenceQuorum.status !== "strong" ? ["evidence_quorum_not_strong"] : []),
    ])),
    invalidSourceIds: Array.from(new Set(invalidSourceIds)),
  };
}
