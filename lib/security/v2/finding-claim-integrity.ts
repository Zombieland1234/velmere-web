import type { StandardFindingV2 } from "./types";

const UNEXECUTED_LIMITATION =
  "No target exploit execution was performed by Full V2; static/heuristic evidence must not be presented as an active exploit.";

/** Fail closed on exploit-status language at the final Full V2 boundary. */
export function enforceFindingClaimIntegrity(findings: StandardFindingV2[]): void {
  for (const finding of findings) {
    // This pipeline has no trusted execution/solver receipt for ANY detector.
    // A legacy label other than active_exploit must not escape as a proven finding.
    finding.analysisMethod ??= finding.sourceLocation ? "STRUCTURED_SOURCE_HEURISTIC" : "BYTECODE_CFG_HEURISTIC";
    finding.claimState = "HEURISTIC_CANDIDATE";
    finding.exploitability = "theoretical";
    if (finding.confidence === "certain" || finding.confidence === "high") finding.confidence = "medium";
    finding.limitations = Array.from(new Set([...(finding.limitations ?? []), UNEXECUTED_LIMITATION]));
    if (!finding.title.startsWith("Heuristic candidate:")) finding.title = `Heuristic candidate: ${finding.title}`;
    if (!finding.impact.startsWith("POTENTIAL IMPACT IF CONFIRMED:")) finding.impact = `POTENTIAL IMPACT IF CONFIRMED: ${finding.impact}`;
    if (!finding.attackScenario.startsWith("UNEXECUTED HYPOTHESIS:")) finding.attackScenario = `UNEXECUTED HYPOTHESIS: ${finding.attackScenario}`;
    if (!finding.proofOfConcept.summary.startsWith("UNEXECUTED HYPOTHESIS:")) {
      finding.proofOfConcept.summary = `UNEXECUTED HYPOTHESIS: ${finding.proofOfConcept.summary}`;
    }
  }
}
