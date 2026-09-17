import type { StandardFindingV2 } from './types';

export const UNBOUND_SOURCE_LIMITATION =
  'SOURCE_RUNTIME_IDENTITY_NOT_VERIFIED: submitted source may add review candidates but cannot suppress or replace bytecode-only observations.';

/** Source is not compiler-bound to the queried runtime. Keep the independent
 * bytecode lane authoritative for its own observations and profile metadata.
 * This is a provenance boundary, not evidence that a candidate is a real bug. */
export function preserveBytecodeCandidates<T extends { findings: StandardFindingV2[] }>(
  evaluate: (sourceCode?: string) => T,
  submittedSource?: string,
): T {
  const bytecodeOnly = evaluate(undefined);
  if (!submittedSource?.trim()) return bytecodeOnly;
  const sourceConditioned = evaluate(submittedSource);
  const findings = [...bytecodeOnly.findings];
  const ids = new Set(findings.map(finding => finding.findingId));
  for (const finding of sourceConditioned.findings) {
    if (ids.has(finding.findingId)) continue;
    ids.add(finding.findingId);
    findings.push({
      ...finding,
      claimState: 'HEURISTIC_CANDIDATE',
      analysisMethod: finding.analysisMethod === 'STRUCTURED_SOURCE_HEURISTIC'
        ? 'STRUCTURED_SOURCE_HEURISTIC' : 'SUBMITTED_SOURCE_HEURISTIC',
      limitations: Array.from(new Set([...(finding.limitations ?? []), UNBOUND_SOURCE_LIMITATION])),
    });
  }
  // Never promote source-conditioned proxy/conformance/simulation metadata.
  return { ...bytecodeOnly, findings };
}
