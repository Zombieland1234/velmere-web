/** A textual proposal is not an applied, compiled, or regression-tested patch. */
import { createHash } from "node:crypto";
import type { StandardFindingV2 } from "./types";
export interface PatchValidationReport {
  findingId:string; patchApplied:boolean; compilationClean:boolean;
  vulnerabilityEliminated:boolean; regressionIntroduced:boolean;
  allInvariantsSatisfied:boolean; validationStatus:"VERIFIED"|"FAILED"|"INCONCLUSIVE";
  validationProofDigest:string;
}
export function validateRemediationPatch(finding:StandardFindingV2, originalSource?:string):PatchValidationReport {
  const diff=finding.remediation.solidityPatchDiff;
  const hasDiff=typeof diff==="string" && /^--- /m.test(diff) && /^\+\+\+ /m.test(diff) && /^@@/m.test(diff);
  const status=hasDiff?"INCONCLUSIVE":"FAILED";
  return {findingId:finding.findingId,patchApplied:false,compilationClean:false,
    vulnerabilityEliminated:false,regressionIntroduced:false,allInvariantsSatisfied:false,
    validationStatus:status,
    // Integrity of this observation only. This digest is not a correctness proof.
    validationProofDigest:"sha256:"+createHash("sha256").update(JSON.stringify({
      findingId:finding.findingId,diff,source:originalSource??null,status,
      boundary:"NO_PATCH_EXECUTOR_COMPILER_OR_REGRESSION_RUNNER"})).digest("hex")};
}
