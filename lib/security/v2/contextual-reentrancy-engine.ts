import { createHash } from "node:crypto";
/**
 * Velmère Security Engine V2 — Contextual Reentrancy Engine
 *
 * Implements multi-layer reentrancy analysis:
 * - Classic state mutation after external call (Checks-Effects-Interactions violation)
 * - Mutex proof is not implemented; post-call writes remain review candidates
 * - Cross-function reentrancy on shared storage slots
 * - Read-only reentrancy during dynamic AMM LP pricing queries
 * - Token callback reentrancy (ERC-777 tokensReceived, ERC-721/1155 hooks)
 */

import type { StandardFindingV2 } from "./types";
import type { CfgAnalysisResult } from "./evm-cfg-dataflow-engine";
import { analyzeCallContinuation } from "./evm-call-continuation";
import { analyzeReentrancyGuardCoverage } from "../solidity-structured-signal.mjs";

export interface ReentrancyAnalysisResult {
  hasVulnerability: boolean;
  findings: StandardFindingV2[];
  isGuardedByMutex: boolean;
  ceiAdherence: boolean | null;
  sourceMutexObserved: boolean;
  limitations: string[];
  readOnlyVulnerable: boolean;
}

export function analyzeContextualReentrancy(
  contractAddress: string,
  cfgResult: CfgAnalysisResult,
  sourceCode?: string,
): ReentrancyAnalysisResult {
  const findings: StandardFindingV2[] = [];
  const { cfg, selectorsDiscovered } = cfgResult;
  // Bytecode-only MAY-reach overapproximation. Unknown jumps and exhausted
  // budgets retain candidates; optional source never removes a bytecode signal.
  // Only the classic persistent post-CALL-write hypothesis uses this scope.
  const continuation = analyzeCallContinuation(cfg);
  const eligible = (id: string) => continuation.entryReachable.has(id) &&
    continuation.canReachSuccessfulExit.has(id);

  // Submitted source is NOT authenticated against this runtime. Recognizing a
  // valid mutex in that text cannot suppress an independent bytecode signal.
  const sourceGuardCoverage = sourceCode?.trim()
    ? analyzeReentrancyGuardCoverage(sourceCode)
    : null;
  const hasReentrancyGuard = false;

  let classicReentrancyDetected = false;
  let readOnlyReentrancyDetected = false;

  // 1. Classic Reentrancy: Check CFG paths for CALL followed by SSTORE in non-guarded blocks
  for (const block of cfg.blocks.values()) {
    if (!eligible(block.id)) continue;
    let callPc = -1;
    let sstorePc = -1;
    let evidencePath: string[] = [];
    for (const [index, instruction] of block.instructions.entries()) {
      if (instruction.name !== "CALL") continue;
      const localWrite = block.instructions.slice(index + 1).find(candidate => candidate.name === "SSTORE");
      if (localWrite) {
        callPc = instruction.pc; sstorePc = localWrite.pc; evidencePath = [block.id]; break;
      }
      // Compiler return-data/revert checks often span more than one successor.
      // Traverse the represented CFG with a strict work bound; unresolved jumps
      // remain a limitation, not proof that a storage write cannot follow.
      const queue = block.successors.map(id => ({id, path:[block.id, id]}));
      const visited = new Set<string>();
      for (let cursor = 0; cursor < queue.length && visited.size < 512; cursor++) {
        const current = queue[cursor];
        if (visited.has(current.id)) continue;
        visited.add(current.id);
        const next = cfg.blocks.get(current.id);
        if (!next || !eligible(next.id)) continue;
        const write = next.instructions.find(candidate => candidate.name === "SSTORE");
        if (write) {
          callPc = instruction.pc; sstorePc = write.pc; evidencePath = current.path; break;
        }
        for (const id of next.successors) if (!visited.has(id)) queue.push({id,path:[...current.path,id]});
      }
      if (sstorePc >= 0) break;
    }
    if (sstorePc >= 0) classicReentrancyDetected = true;

    if (classicReentrancyDetected) {
      findings.push({
        findingId: "VLM-SEC-REENTRANCY-01",
        title: "State Write Reachable After External Call (Mutex Proof Unavailable)",
        severity: "high",
        confidence: "medium",
        exploitability: "theoretical",
        impact:
          "A represented post-call state write may warrant review if an external callback can re-enter a state-dependent path. Call target, shared-state dependency, feasible execution, guards and financial impact have not been established.",
        likelihood: "high",
        taxonomy: {
          swcId: "SWC-107",
          cweId: "CWE-841",
          eeaSvsLevel: "S",
          owaspScsvsCategory: "G6: Secure Interactions",
        },
        affectedContract: contractAddress,
        affectedFunction: "Unresolved external-call path",
        bytecodeOffset: {
          pcStart: callPc,
          pcEnd: sstorePc,
        },
        executionPath: [...evidencePath, `CALL@0x${callPc.toString(16)}`, `SSTORE@0x${sstorePc.toString(16)}`],
        stateDependencies: {
          storageSlotsRead: Array.from(block.readsStorageSlots),
          storageSlotsWritten: Array.from(block.writesStorageSlots),
        },
        attackScenario: "UNEXECUTED hypothesis only. Review the observed CALL/write ordering and establish callback reachability, state dependencies and guards before concluding reentrancy.",
        proofOfConcept: {
          summary: "No target execution or executable proof of concept was produced by this static observation.",
          sequence: [],
        },
        evidence: {
          opcodeTraceExcerpt: `PC 0x${callPc.toString(16)}: CALL -> PC 0x${sstorePc.toString(16)}: SSTORE`,
          disassemblyContext: `Represented CFG path ${evidencePath.join(" -> ")} reaches a state write after CALL; mutex, call target and path feasibility are not proved.`,
          hashProof: `sha256:${createHash("sha256").update(JSON.stringify({contractAddress,callPc,sstorePc,evidencePath})).digest("hex")}`,
        },
        remediation: {
          strategy: "Enforce Checks-Effects-Interactions (CEI) pattern or apply OpenZeppelin ReentrancyGuard.",
          solidityPatchDiff: `--- a/contracts/Vault.sol
+++ b/contracts/Vault.sol
@@ -10,7 +10,8 @@
+    import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
-    function withdraw(uint256 amount) external {
+    function withdraw(uint256 amount) external nonReentrant {
         require(balances[msg.sender] >= amount, "Insufficient");
+        balances[msg.sender] -= amount;
         (bool s, ) = msg.sender.call{value: amount}("");
         require(s, "Transfer failed");
-        balances[msg.sender] -= amount;
     }`,
          appliedSuccessfully: false,
          regressionPassed: false,
        },
        verificationState: "AUTOMATED",
      });
      break; // Only report primary classic reentrancy per contract
    }
  }

  // 2. Read-Only Reentrancy Detection: Inspect queries to AMM virtual prices without pool lock checks
  const getVirtualPriceSelector = "0xbb7b8686";
  const getRateSelector = "0x679aefce";

  if (selectorsDiscovered.has(getVirtualPriceSelector) || selectorsDiscovered.has(getRateSelector)) {
    // Arbitrary source text, including comments or unused function names, is
    // not evidence of a lock on the relevant bytecode call path.
    const hasLockCheck = false;

    if (!hasLockCheck) {
      readOnlyReentrancyDetected = true;
      const pc = selectorsDiscovered.get(getVirtualPriceSelector) ?? selectorsDiscovered.get(getRateSelector)!;

      findings.push({
        findingId: "VLM-SEC-REENTRANCY-RO-02",
        title: "AMM Price Selector Present (Call Path and Lock Unverified)",
        severity: "high",
        confidence: "low",
        exploitability: "theoretical",
        impact:
          "A consumer may be exposed if it uses a manipulable pool price during a callback. Selector presence alone does not prove an external call, a reachable attack path, or loss.",
        likelihood: "medium",
        taxonomy: {
          swcId: "SWC-107",
          cweId: "CWE-841",
          eeaSvsLevel: "M",
          owaspScsvsCategory: "G6: Secure Interactions",
        },
        affectedContract: contractAddress,
        affectedFunction: "get_virtual_price() / getRate() consumer",
        bytecodeOffset: {
          pcStart: pc,
          pcEnd: pc + 4,
        },
        executionPath: [`Selector@0x${pc.toString(16)}`, "STATICCALL AMM pool", "Collateral valuation"],
        stateDependencies: {
          storageSlotsRead: ["0x0 (collateral valuation)"],
          storageSlotsWritten: [],
        },
        attackScenario:
          "1. Attacker takes flash loan of underlying assets.\n2. Attacker removes liquidity from Curve/Balancer pool using raw ETH removal.\n3. During the ETH receive callback, pool reserves are distorted but pool lock is not checked by external consumer.\n4. Attacker invokes consumer protocol to borrow undercollateralized assets based on inflated virtual price.\n5. Transaction completes and flash loan is repaid with excess profit.",
        proofOfConcept: {
          summary: "UNEXECUTED hypothesis: validate an actual consumer call path and pool state before confirming read-only reentrancy",
          sequence: [
            { step: 1, actor: "Attacker", call: "CurvePool.remove_liquidity_one_coin()", expectation: "ETH transfer callback" },
            { step: 2, actor: "Attacker Callback", call: "VictimProtocol.borrow()", expectation: "Uses inflated get_virtual_price" },
            { step: 3, actor: "Victim Protocol", call: "AMM.get_virtual_price()", expectation: "Unchecked mid-reentrancy price returned" },
          ],
        },
        evidence: {
          opcodeTraceExcerpt: `PUSH4 ${selectorsDiscovered.has(getVirtualPriceSelector) ? getVirtualPriceSelector : getRateSelector} at PC ${pc}; external call and lock are unverified`,
          disassemblyContext: "Selector constant detected. It may be a declaration or unrelated constant; target identity, call path, lock and exploitability are not proved.",
          hashProof: `sha256:${createHash("sha256").update(JSON.stringify({ contractAddress, pc, kind: "readonly-selector-observation" })).digest("hex")}`,
        },
        remediation: {
          strategy: "Verify target AMM pool reentrancy lock or consume a reentrancy-guarded price feed.",
          solidityPatchDiff: `--- a/contracts/OracleConsumer.sol
+++ b/contracts/OracleConsumer.sol
@@ -15,6 +15,7 @@
+    // Assert pool reentrancy lock before reading virtual price
+    ICurvePool(pool).claim_admin_fees(); // Reverts if pool is mid-reentrant
     uint256 price = ICurvePool(pool).get_virtual_price();`,
          appliedSuccessfully: false,
          regressionPassed: false,
        },
        verificationState: "AUTOMATED",
      });
    }
  }

  // 3. Token Callback Reentrancy: Check for ERC-777 tokensReceived hook
  const tokensReceivedSelector = "0x0023de29";
  if (selectorsDiscovered.has(tokensReceivedSelector)) {
    const pc = selectorsDiscovered.get(tokensReceivedSelector)!;

    findings.push({
      findingId: "VLM-SEC-REENTRANCY-ERC777-03",
      title: "ERC-777 Hook Selector Present (Reentrancy Unverified)",
      severity: "high",
      confidence: "low",
      exploitability: "theoretical",
      impact: "Token callbacks can be a reentrancy surface, but a hook selector alone does not establish a vulnerable state transition or a successful exploit.",
      likelihood: "high",
      taxonomy: {
        swcId: "SWC-107",
        cweId: "CWE-841",
        eeaSvsLevel: "S",
        owaspScsvsCategory: "I2: Token Interactions",
      },
      affectedContract: contractAddress,
      affectedFunction: "tokensReceived()",
      bytecodeOffset: { pcStart: pc, pcEnd: pc + 4 },
      executionPath: [`Hook@0x${pc.toString(16)}`, "tokensReceived callback", "Reentrant state invocation"],
      stateDependencies: { storageSlotsRead: [], storageSlotsWritten: [] },
      attackScenario: "1. Attacker receives ERC-777 token.\n2. tokensReceived hook executes.\n3. Attacker re-enters protocol before balance deduction.",
      proofOfConcept: {
        summary: "UNEXECUTED hypothesis: validate callback reachability, shared state and guards before confirming reentrancy",
        sequence: [
          { step: 1, actor: "Attacker", call: "triggerTransfer()", expectation: "ERC-777 transfers" },
          { step: 2, actor: "ERC-777", call: "tokensReceived() callback", expectation: "Attacker gains control" },
          { step: 3, actor: "Attacker", call: "reenter()", expectation: "Re-entrant call succeeds" },
        ],
      },
      evidence: {
        opcodeTraceExcerpt: `PUSH4 0x0023de29 (tokensReceived) at PC ${pc}; guard status is unverified`,
        disassemblyContext: "Hook selector observed; no proof of callback execution, missing mutex, or feasible state-changing reentry",
        hashProof: `sha256:${createHash("sha256").update(JSON.stringify({ contractAddress, pc, kind: "erc777-selector-observation" })).digest("hex")}`,
      },
      remediation: {
        strategy: "Apply nonReentrant modifier to all state-mutating functions accepting arbitrary ERC-20/ERC-777 tokens.",
        solidityPatchDiff: `--- a/contracts/Vault.sol
+++ b/contracts/Vault.sol
@@ -8,3 +8,4 @@
+    // Reject ERC-777 hooks or enforce nonReentrant
+    function deposit(uint256 amount) external nonReentrant {`,
      },
      verificationState: "AUTOMATED",
    });
  }

  return {
    hasVulnerability: findings.length > 0,
    findings,
    isGuardedByMutex: hasReentrancyGuard,
    // No signal is not a proof that CEI holds on unresolved/unrepresented paths.
    ceiAdherence: classicReentrancyDetected ? false : null,
    sourceMutexObserved: Boolean(sourceGuardCoverage?.allSupportedPathsGuarded),
    limitations: [...continuation.limitations, "SOURCE_RUNTIME_IDENTITY_NOT_VERIFIED", "NO_COMPLETE_PATH_FEASIBILITY_PROOF", ...(cfg.unresolvedDynamicJumps ? [`UNRESOLVED_DYNAMIC_JUMPS:${cfg.unresolvedDynamicJumps}`] : [])],
    readOnlyVulnerable: readOnlyReentrancyDetected,
  };
}
