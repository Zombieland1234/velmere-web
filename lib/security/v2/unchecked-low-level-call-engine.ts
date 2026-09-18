import { createHash } from "node:crypto";
import type { StandardFindingV2 } from "./types";
import type { CfgAnalysisResult } from "./evm-cfg-dataflow-engine";

const LOW_LEVEL_CALLS = new Set(["CALL", "CALLCODE", "DELEGATECALL", "STATICCALL"]);

/**
 * Immediate-discard SWC-104 candidate detector.
 *
 * CALL-family opcodes leave a success word on the stack.  An immediate POP is
 * direct bytecode evidence that the return status is discarded.  We keep the
 * rule deliberately narrow rather than guessing from unrelated source text.
 */
export function analyzeUncheckedLowLevelCalls(
  contractAddress: string,
  cfgResult: CfgAnalysisResult,
): StandardFindingV2[] {
  for (const block of cfgResult.cfg.blocks.values()) {
    // A straight-line block that always aborts cannot commit any bookkeeping.
    // Do not equate discarding a word with an unhandled successful continuation.
    const terminator = block.instructions.at(-1)?.name;
    if (terminator === "REVERT" || terminator === "INVALID") continue;
    for (let i = 0; i < block.instructions.length - 1; i++) {
      const call = block.instructions[i];
      const next = block.instructions[i + 1];
      if (!LOW_LEVEL_CALLS.has(call.name) || next.name !== "POP") continue;
      return [{
        findingId: "VLM-SEC-UNCHECKED-LOW-LEVEL-CALL-01",
        claimState: "DETECTOR_FINDING",
        analysisMethod: "BYTECODE_CFG_HEURISTIC",
        limitations: ["IMMEDIATE_CALL_STATUS_DISCARD_ONLY", "NO_EXECUTED_TARGET_CALL", "BUSINESS_REQUIREMENT_TO_REVERT_NOT_ESTABLISHED"],
        title: "Low-Level Call Success Flag Is Immediately Discarded",
        severity: "high",
        confidence: "high",
        exploitability: "theoretical",
        impact: "The contract continues without observing whether the low-level external call succeeded, which can desynchronize bookkeeping from external effects.",
        likelihood: "medium",
        taxonomy: {
          swcId: "SWC-104",
          cweId: "CWE-252",
          eeaSvsLevel: "S",
          owaspScsvsCategory: "G6: Secure Interactions",
        },
        affectedContract: contractAddress,
        affectedFunction: "Unresolved low-level call path",
        bytecodeOffset: { pcStart: call.pc, pcEnd: next.pc },
        executionPath: [block.id, `${call.name}@0x${call.pc.toString(16)}`, `POP@0x${next.pc.toString(16)}`],
        stateDependencies: { storageSlotsRead: [], storageSlotsWritten: [] },
        attackScenario: "The external call fails and returns zero, but the success word is immediately discarded; subsequent bookkeeping can therefore proceed as if the external action succeeded.",
        proofOfConcept: {
          summary: "UNEXECUTED bytecode observation: CALL-family success word is immediately consumed by POP.",
          sequence: [
            { step: 1, actor: "Contract", call: call.name, expectation: "callee may return success=0" },
            { step: 2, actor: "Contract", call: "POP", expectation: "success word is discarded without a branch/check" },
          ],
        },
        evidence: {
          opcodeTraceExcerpt: `PC 0x${call.pc.toString(16)} ${call.name} -> PC 0x${next.pc.toString(16)} POP`,
          disassemblyContext: "Immediate status discard is observed directly in deployed runtime bytecode; source association is not required.",
          hashProof: `sha256:${createHash("sha256").update(`${contractAddress}:${call.pc}:${next.pc}:${call.name}`).digest("hex")}`,
        },
        remediation: {
          strategy: "Capture the low-level call success value and explicitly handle failure before committing dependent state.",
          solidityPatchDiff: `- target.call(payload);\n+ (bool ok, ) = target.call(payload);\n+ require(ok, "low-level call failed");`,
          appliedSuccessfully: false,
          regressionPassed: false,
        },
        verificationState: "AUTOMATED",
      }];
    }
  }
  return [];
}
