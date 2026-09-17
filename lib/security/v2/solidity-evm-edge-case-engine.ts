/**
 * Velmère Security Engine V2 — Solidity & EVM Edge-Case Engine
 *
 * Conservative edge-surface detection. A bytecode/source signal is not promoted
 * into an authorization or exploitability claim unless the bounded analysis
 * actually proves that property.
 */

import { StandardFindingV2 } from "./types";
import { CfgAnalysisResult } from "./evm-cfg-dataflow-engine";
import { evidenceSha256 } from "./evidence-integrity";

export interface EdgeCaseAnalysisResult {
  hasVulnerability: boolean;
  findings: StandardFindingV2[];
  usesTransientStorage: boolean;
  hasSignatureMalleability: boolean;
  hasUnprotectedSelfdestruct: boolean;
  hasUncheckedCall: boolean;
}

export function analyzeSolidityEvmEdgeCases(
  contractAddress: string,
  cfgResult: CfgAnalysisResult,
  sourceCode?: string,
): EdgeCaseAnalysisResult {
  const findings: StandardFindingV2[] = [];
  const { cfg } = cfgResult;

  let usesTransientStorage = false;
  let hasSignatureMalleability = false;
  // Authorization is not derivable from isReentrancyGuarded. Keep this false
  // unless a future authority-aware analysis proves an unprotected path.
  const hasUnprotectedSelfdestruct = false;
  const hasUncheckedCall = false;
  const cleanSource = sourceCode ? sourceCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "") : "";

  // 1. Transient Storage (EIP-1153: TLOAD = 0x5c, TSTORE = 0x5d)
  for (const block of cfg.blocks.values()) {
    for (const inst of block.instructions) {
      if (inst.opcode === 0x5c || inst.opcode === 0x5d) {
        usesTransientStorage = true;
        break;
      }
    }
    if (usesTransientStorage) break;
  }

  // 2. Raw Solidity ecrecover surface.
  // `permit` is NOT evidence that the implementation uses raw ecrecover, and an
  // ABI selector alone cannot establish signature malleability or replay risk.
  const rawEcrecoverObserved = /\becrecover\s*\(/.test(cleanSource);
  const usesHardenedEcdsaHelper = /\bECDSA\.(?:recover|tryRecover)\s*\(/.test(cleanSource);

  if (rawEcrecoverObserved && !usesHardenedEcdsaHelper) {
    hasSignatureMalleability = true;
    findings.push({
      findingId: "VLM-SEC-CRYPTO-SIGNATURE-MALLEABILITY-01",
      claimState: "HEURISTIC_CANDIDATE",
      analysisMethod: "STATIC",
      limitations: [
        "Raw ecrecover use is observed in supplied source, but low-s enforcement, zero-address rejection, nonce/domain separation and replay protection are not proved absent by this detector.",
        "No executed signature path or adversarial replay was performed.",
      ],
      title: "Heuristic candidate: raw ecrecover validation surface",
      severity: "medium",
      confidence: "medium",
      exploitability: "theoretical",
      impact:
        "Raw ecrecover requires careful low-s, zero-address and replay/domain validation. The observed call is a review surface, not proof that a malleable signature or replay is accepted.",
      likelihood: "medium",
      taxonomy: {
        swcId: "SWC-117",
        cweId: "CWE-347",
        eeaSvsLevel: "M",
        owaspScsvsCategory: "G5: Access Control and Authentication",
      },
      affectedContract: contractAddress,
      affectedFunction: "raw ecrecover caller",
      bytecodeOffset: { pcStart: 0, pcEnd: 0 },
      executionPath: ["Supplied source contains ecrecover(...)"],
      stateDependencies: { storageSlotsRead: [], storageSlotsWritten: [] },
      attackScenario:
        "Review the exact signature-validation path for low-s enforcement, signer != address(0), nonce/state consumption and domain separation. Construct a replay/malleability test only if those protections are missing.",
      proofOfConcept: {
        summary: "Not executed: candidate requires path-specific signature validation review",
        sequence: [],
      },
      evidence: {
        opcodeTraceExcerpt: "No opcode-level ecrecover target proof claimed; signal comes from supplied source.",
        disassemblyContext: "Raw ecrecover token observed without a recognized ECDSA.recover/tryRecover helper in the bounded source scan.",
        hashProof: evidenceSha256(`raw-ecrecover-source-${contractAddress}-${cleanSource}`),
      },
      remediation: {
        strategy:
          "Prefer a hardened ECDSA helper and explicitly enforce nonce/state consumption plus domain separation appropriate to the signed action.",
        solidityPatchDiff: `--- a/contracts/SignatureVerifier.sol
+++ b/contracts/SignatureVerifier.sol
@@ -4,3 +4,4 @@
+import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
-    address signer = ecrecover(hash, v, r, s);
+    address signer = ECDSA.recover(hash, v, r, s);`,
      },
      verificationState: "AUTOMATED",
    });
  }

  // 3. SELFDESTRUCT surface.
  // Presence of the opcode proves only that the bytecode contains the surface.
  // It does not prove an external caller can reach it, that authorization is
  // absent, or that modern EIP-6780 semantics will erase deployed code.
  for (const block of cfg.blocks.values()) {
    if (!block.hasSelfdestruct) continue;

    const pc = block.instructions.find((ins) => ins.name === "SELFDESTRUCT")?.pc ?? block.startPc;
    findings.push({
      findingId: "VLM-SEC-EVM-SELFDESTRUCT-02",
      claimState: "HEURISTIC_CANDIDATE",
      analysisMethod: "STATIC",
      limitations: [
        "CFG presence does not prove caller reachability or missing authorization.",
        "SELFDESTRUCT effects depend on chain/fork semantics; after EIP-6780 it generally does not delete pre-existing code/storage unless executed in the creation transaction.",
      ],
      title: "Heuristic candidate: SELFDESTRUCT lifecycle/authorization surface",
      severity: "medium",
      confidence: "high",
      exploitability: "theoretical",
      impact:
        "A reachable SELFDESTRUCT path can transfer the contract balance and has fork-dependent lifecycle effects. Authorization, reachability and exact chain semantics require separate proof.",
      likelihood: "medium",
      taxonomy: {
        swcId: "SWC-106",
        cweId: "CWE-284",
        eeaSvsLevel: "S",
        owaspScsvsCategory: "G1: Architecture and Threat Modeling",
      },
      affectedContract: contractAddress,
      affectedFunction: "SELFDESTRUCT-containing path (function mapping unresolved)",
      bytecodeOffset: { pcStart: pc, pcEnd: pc + 1 },
      executionPath: [`SELFDESTRUCT@0x${pc.toString(16)}`, "Reachability/authority unresolved"],
      stateDependencies: { storageSlotsRead: [], storageSlotsWritten: [] },
      attackScenario:
        "Determine the function/callback that reaches this opcode, prove its authorization conditions, and reproduce behavior on the target chain/fork before assigning exploitability.",
      proofOfConcept: {
        summary: "Not executed: opcode surface requires reachability and authority proof",
        sequence: [],
      },
      evidence: {
        opcodeTraceExcerpt: `PC 0x${pc.toString(16)}: SELFDESTRUCT opcode present`,
        disassemblyContext: "Opcode presence only; no claim of unprotected external reachability.",
        hashProof: evidenceSha256(`selfdestruct-surface-${contractAddress}-${pc}`),
      },
      remediation: {
        strategy:
          "Avoid SELFDESTRUCT in upgrade/lifecycle design where possible; otherwise prove intended authorization and target-chain semantics with explicit tests.",
        solidityPatchDiff: "Review/remove SELFDESTRUCT only after mapping the real lifecycle and authority path; no automatic patch is claimed safe.",
      },
      verificationState: "AUTOMATED",
    });
    break;
  }

  return {
    hasVulnerability: findings.length > 0,
    findings,
    usesTransientStorage,
    hasSignatureMalleability,
    hasUnprotectedSelfdestruct,
    hasUncheckedCall,
  };
}
