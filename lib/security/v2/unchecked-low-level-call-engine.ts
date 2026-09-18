import { createHash } from "node:crypto";
import type { StandardFindingV2 } from "./types";
import type { CfgAnalysisResult } from "./evm-cfg-dataflow-engine";

import { analyzeCallContinuation } from "./evm-call-continuation";

const LOW_LEVEL_CALLS = new Set(["CALL", "CALLCODE", "DELEGATECALL", "STATICCALL"]);

/**
 * Immediate unused-status SWC-104 candidate detector.
 *
 * CALL-family opcodes leave a success word on the stack. An immediate POP
 * discards it; STOP or end-of-code abandons it without observing success. These
 * are generic EVM stack semantics, not compiler or benchmark-specific patterns.
 * Other instructions may use the result and are deliberately not guessed about.
 */
export function analyzeUncheckedLowLevelCalls(
  contractAddress: string,
  cfgResult: CfgAnalysisResult,
): StandardFindingV2[] {
  const continuation = analyzeCallContinuation(cfgResult.cfg);
  let finalInstructionPc = -1;
  for (const block of cfgResult.cfg.blocks.values()) {
    finalInstructionPc = Math.max(finalInstructionPc, block.instructions.at(-1)?.pc ?? -1);
  }
  for (const block of cfgResult.cfg.blocks.values()) {
    if (!continuation.entryReachable.has(block.id) || !continuation.canReachSuccessfulExit.has(block.id)) continue;
    // A straight-line block that always aborts cannot commit any bookkeeping.
    // Do not equate discarding a word with an unhandled successful continuation.
    const terminator = block.instructions.at(-1)?.name;
    if (terminator === "REVERT" || terminator === "INVALID") continue;
    for (let i = 0; i < block.instructions.length; i++) {
      const call = block.instructions[i];
      const next = block.instructions[i + 1];
      if (!LOW_LEVEL_CALLS.has(call.name)) continue;
      const handling = next?.name === "POP" ? "POP" : next?.opcode === 0x00 ? "STOP"
        : !next && call.pc === finalInstructionPc ? "END_OF_CODE" : null;
      if (!handling) continue;
      const endPc = next?.pc ?? call.pc;
      const observation = handling === "POP" ? "success word is discarded by POP"
        : "successful caller termination does not observe the call success word";
      return [{
        findingId: "VLM-SEC-UNCHECKED-LOW-LEVEL-CALL-01",
        claimState: "DETECTOR_FINDING",
        analysisMethod: "BYTECODE_CFG_HEURISTIC",
        limitations: ["IMMEDIATE_UNUSED_CALL_STATUS_ONLY", "ENTRY_REACHABILITY_OVERAPPROXIMATION_NOT_EXECUTION_PROOF", "NO_EXECUTED_TARGET_CALL", "BUSINESS_REQUIREMENT_TO_REVERT_NOT_ESTABLISHED", ...continuation.limitations],
        title: handling === "POP" ? "Low-Level Call Success Flag Is Immediately Discarded" : "Low-Level Call Success Flag Is Abandoned at Successful Termination",
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
        bytecodeOffset: { pcStart: call.pc, pcEnd: endPc },
        executionPath: [block.id, `${call.name}@0x${call.pc.toString(16)}`, `${handling}@0x${endPc.toString(16)}`],
        stateDependencies: { storageSlotsRead: [], storageSlotsWritten: [] },
        attackScenario: "The external call may fail and return zero, while the caller discards or abandons that status and can finish successfully. Whether the application requires failure propagation is not established.",
        proofOfConcept: {
          summary: `UNEXECUTED bytecode observation: ${observation}.`,
          sequence: [
            { step: 1, actor: "Contract", call: call.name, expectation: "callee may return success=0" },
            { step: 2, actor: "Contract", call: handling, expectation: observation },
          ],
        },
        evidence: {
          opcodeTraceExcerpt: `PC 0x${call.pc.toString(16)} ${call.name} -> ${handling} at/after PC 0x${endPc.toString(16)}`,
          disassemblyContext: "The unused-status pattern is observed in supplied legacy runtime bytecode with conservative entry reachability; execution, business impact and source association are not established.",
          hashProof: `sha256:${createHash("sha256").update(`${contractAddress}:${call.pc}:${endPc}:${call.name}:${handling}`).digest("hex")}`,
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
