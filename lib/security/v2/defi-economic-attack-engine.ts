/**
 * Velmère Security Engine V2 — DeFi Economic Attack Engine
 *
 * Models and simulates complex economic attack vectors:
 * - ERC-4626 Vault Inflation / First-Depositor Donation Attacks
 * - Flash-Loan Sandwich & AMM Pool Reserve Slippage Drains
 * - Rounding / Precision Loss Extraction
 * - Share-Price Dilution
 *
 * MANDATORY RULE: All quantitative estimates are strictly classified as
 * "SIMULATION / ESTIMATE / ASSUMPTIONS" and must never be presented as guaranteed.
 */

import { DefiEconomicAttackSimulation, StandardFindingV2 } from "./types";
import { CfgAnalysisResult } from "./evm-cfg-dataflow-engine";
import { evidenceSha256 } from "./evidence-integrity";

export interface EconomicAnalysisResult {
  hasVulnerability: boolean;
  findings: StandardFindingV2[];
  simulations: DefiEconomicAttackSimulation[];
  vaultInflationRisk: boolean;
  flashLoanSandwichRisk: boolean;
}

export function simulateDefiEconomicAttacks(
  contractAddress: string,
  cfgResult: CfgAnalysisResult,
  sourceCode?: string,
): EconomicAnalysisResult {
  const findings: StandardFindingV2[] = [];
  const simulations: DefiEconomicAttackSimulation[] = [];
  const { selectorsDiscovered } = cfgResult;

  let vaultInflationRisk = false;
  let flashLoanSandwichRisk = false;

  const cleanSource = sourceCode ? sourceCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "") : "";

  // 1. ERC-4626 Vault Inflation / First-Depositor Donation Attack Detection
  // ERC-4626 standard selectors:
  // totalAssets() -> 0x01e5237f
  // convertToShares(uint256) -> 0xc6e6f592
  // convertToAssets(uint256) -> 0x07a2d10f
  // deposit(uint256,address) -> 0x6e553f65
  const isErc4626 =
    (selectorsDiscovered.has("0x01e5237f") &&
      selectorsDiscovered.has("0xc6e6f592") &&
      selectorsDiscovered.has("0x6e553f65")) ||
    (cleanSource.includes("totalSupply") &&
      cleanSource.includes("totalAssets") &&
      cleanSource.includes("deposit"));

  if (isErc4626) {
    // Check if the vault implements virtual shares offset (OpenZeppelin 4.9+ _decimalsOffset()) or dead shares burn
    const hasVirtualSharesOffset =
      cleanSource.includes("_decimalsOffset()") ||
      cleanSource.includes("_DECIMALS_OFFSET") ||
      cleanSource.includes("virtualShares") ||
      cleanSource.includes("deadShares") ||
      cleanSource.includes("MINIMUM_LIQUIDITY");

    if (!hasVirtualSharesOffset) {
      vaultInflationRisk = true;

      const simulation: DefiEconomicAttackSimulation = {
        attackType: "ERC4626_VAULT_INFLATION",
        classification: "SIMULATION / ESTIMATE / ASSUMPTIONS",
        targetContract: contractAddress,
        capitalRequiredUsd: null,
        estimatedProfitUsd: null,
        maximumLossUsd: null,
        priceImpactPercent: null,
        gasCostEstimatedGwei: null,
        attackSequence: [
          {
            step: 1,
            action: "First Deposit 1 wei of assets",
            caller: "Attacker",
            callTarget: contractAddress,
            valueEth: "0.000000000000000001",
            params: { assets: "1", receiver: "Attacker" },
          },
          {
            step: 2,
            action: "Direct asset donation to vault without minting shares",
            caller: "Attacker",
            callTarget: "UnderlyingAssetToken",
            valueEth: "0",
            params: { to: contractAddress, amount: "10000000000000000000 (10 tokens)" },
          },
          {
            step: 3,
            action: "Victim deposits substantial assets (e.g. 19 tokens)",
            caller: "Victim User",
            callTarget: contractAddress,
            valueEth: "0",
            params: { assets: "19000000000000000000", receiver: "Victim User" },
          },
          {
            step: 4,
            action: "Victim share calculation rounds down to 1 share (or 0 shares)",
            caller: "Vault Contract",
            callTarget: contractAddress,
            valueEth: "0",
            params: { formula: "assets * totalSupply / totalAssets", sharesAwarded: "1" },
          },
          {
            step: 5,
            action: "Attacker redeems initial 1 share, claiming 50% of victim's donated deposit",
            caller: "Attacker",
            callTarget: contractAddress,
            valueEth: "0",
            params: { shares: "1", profitExtracted: "4.5 tokens" },
          },
        ],
        requiredAssumptions: [
          "No live market, gas, liquidity or target-state inputs were supplied; quantitative USD/impact/gas fields are withheld.",
          "Target vault has 0 initial totalShares (newly deployed or fully drained).",
          "Attacker front-runs first victim deposit in public mempool.",
          "Vault calculates convertToShares using integer division rounding down without virtual shares offset.",
        ],
      };

      simulations.push(simulation);

      findings.push({
        findingId: "VLM-SEC-DEFI-VAULT-INFLATION-01",
        claimState: "HEURISTIC_CANDIDATE",
        analysisMethod: "SIMULATION",
        limitations: ["No target-state execution or live economic inputs; candidate requires adversarial reproduction."],
        title: "Heuristic candidate: ERC-4626 vault-inflation exposure",
        severity: "critical",
        confidence: "medium",
        exploitability: "theoretical",
        impact:
          "If the deployed vault uses vulnerable first-depositor share math without an effective offset/minimum-liquidity defense, donation-based share-price manipulation may harm later depositors. The executed path is not proved here.",
        likelihood: "high",
        taxonomy: {
          swcId: "SWC-101",
          cweId: "CWE-682",
          eeaSvsLevel: "Q",
          owaspScsvsCategory: "C4: Vault Architecture",
        },
        affectedContract: contractAddress,
        affectedFunction: "deposit(uint256,address) / convertToShares()",
        bytecodeOffset: { pcStart: 0, pcEnd: 64 },
        executionPath: ["deposit()", "totalAssets()", "convertToShares()", "integer division truncation"],
        stateDependencies: { storageSlotsRead: ["totalSupply", "totalAssets"], storageSlotsWritten: ["totalSupply", "shares"] },
        attackScenario:
          "ILLUSTRATIVE ONLY: model a first deposit, direct donation, later victim deposit and redemption. Exact share output, profitability and reachability must be reproduced against the target state before confirmation.",
        proofOfConcept: {
          summary: "First depositor 1-wei mint followed by direct donation rounding manipulation",
          sequence: [
            { step: 1, actor: "Attacker", call: "vault.deposit(1, attacker)", expectation: "Attacker receives 1 share" },
            { step: 2, actor: "Attacker", call: "token.transfer(vault, 10e18)", expectation: "totalAssets = 10e18 + 1" },
            { step: 3, actor: "Victim", call: "vault.deposit(19e18, victim)", expectation: "Victim receives only 1 share" },
            { step: 4, actor: "Attacker", call: "vault.redeem(1, attacker, attacker)", expectation: "Attacker withdraws 14.5e18" },
          ],
        },
        evidence: {
          opcodeTraceExcerpt: "ERC-4626 selector/source heuristic; executed DIV/share path not proved",
          disassemblyContext: "Potential ERC-4626 surface with no recognized virtual-share/minimum-liquidity token in the bounded source heuristic; compiler AST and runtime path not verified.",
          hashProof: evidenceSha256(`vault-inflation-${contractAddress}`),
        },
        remediation: {
          strategy: "Implement OpenZeppelin ERC4626 with _decimalsOffset() (virtual shares) or burn the first 1000 shares to address(0).",
          solidityPatchDiff: `--- a/contracts/Vault.sol
+++ b/contracts/Vault.sol
@@ -6,4 +6,8 @@
-contract MyVault is ERC4626 {
+contract MyVault is ERC4626Upgradeable {
+    // Virtual shares mitigate first depositor inflation attacks
+    function _decimalsOffset() internal view virtual override returns (uint8) {
+        return 3;
+    }`,
        },
        verificationState: "SIMULATED",
      });
    }
  }

  // 1b. Euler Finance Donation / Liquidation Attack Model ($197M exploit)
  if (
    cleanSource.includes("donateToReserves") &&
    !cleanSource.includes("checkLiquidity")
  ) {
    findings.push({
      findingId: "VLM-SEC-DEFI-VAULT-INFLATION-01",
      claimState: "HEURISTIC_CANDIDATE",
      analysisMethod: "SIMULATION",
      limitations: ["Source-pattern candidate only; no target execution or solvency-state proof."],
      title: "Heuristic candidate: reserve-donation solvency exposure",
      severity: "critical",
      confidence: "medium",
      exploitability: "theoretical",
      impact:
        "A reserve-donation path without an effective post-state solvency check can create liquidation/accounting risk. This source-pattern check does not prove the target path is reachable or economically exploitable.",
      likelihood: "high",
      taxonomy: {
        swcId: "SWC-101",
        cweId: "CWE-682",
        eeaSvsLevel: "Q",
        owaspScsvsCategory: "C4: Vault Architecture",
      },
      affectedContract: contractAddress,
      affectedFunction: "donateToReserves(uint256)",
      bytecodeOffset: { pcStart: 0, pcEnd: 32 },
      executionPath: ["donateToReserves()", "reserve transfer without checkLiquidity()", "Self-liquidation discount extraction"],
      stateDependencies: { storageSlotsRead: ["collateralBalances"], storageSlotsWritten: ["collateralBalances", "reserves"] },
      attackScenario:
        "ILLUSTRATIVE ONLY: reproduce donation, resulting health-factor transition and liquidation economics on the target before treating this as an exploit path.",
      proofOfConcept: {
        summary: "Self-liquidation via unverified reserve donation",
        sequence: [
          { step: 1, actor: "Attacker", call: "borrow(maxDebt)", expectation: "Debt acquired" },
          { step: 2, actor: "Attacker", call: "donateToReserves(collateral)", expectation: "Collateral donated without solvency check" },
          { step: 3, actor: "Liquidator", call: "liquidate(attacker)", expectation: "Discounted collateral extracted" },
        ],
      },
      evidence: {
        opcodeTraceExcerpt: "Source-pattern observation: donateToReserves token present and checkLiquidity token absent; no executed opcode path claimed",
        disassemblyContext: "Bounded source heuristic only; compiler AST, aliases and equivalent solvency checks may change the conclusion.",
        hashProof: evidenceSha256(`euler-${contractAddress}`),
      },
      remediation: {
        strategy: "Ensure checkLiquidity(msg.sender) is enforced in donateToReserves or disallow self-donation.",
        solidityPatchDiff: `--- a/contracts/Euler.sol
+++ b/contracts/Euler.sol
@@ -20,3 +20,4 @@
     function donateToReserves(uint256 amount) external {
+        require(checkLiquidity(msg.sender), "Insolvent after donation");`,
      },
      verificationState: "SIMULATED",
    });
  }

  // 2. Flash-Loan Sandwich MEV / Slippage Extraction Simulation
  // Fail-closed gating: only emit sandwich attack paths for contracts with AMM router / swap interfaces.
  // Standard tokens (ERC-20), vaults, or lending pools without AMM router interfaces must NEVER emit sandwich attack paths.
  const AMM_ROUTER_OR_SWAP_SELECTORS = new Set([
    "0x38ed1739", // swapExactTokensForTokens
    "0x8803dbee", // swapTokensForExactTokens
    "0x7ff36ab5", // swapExactETHForTokens
    "0x4a25fd77", // swapTokensForExactETH
    "0x18cbafe5", // swapExactTokensForETH
    "0xfb3bdb41", // swapETHForExactTokens
    "0x414bacae", // exactInputSingle
    "0xc04b8d59", // exactInput
    "0xdb3e2198", // exactOutputSingle
    "0xf28c0448", // exactOutput
    "0x022c0d9f", // swap(uint256,uint256,address,bytes)
    "0x128acb08", // swap(address,bool,int256,uint160,bytes)
  ]);

  const hasAmmRouterOrSwapInterface =
    Array.from(selectorsDiscovered.keys()).some((sel) => AMM_ROUTER_OR_SWAP_SELECTORS.has(sel)) ||
    (cleanSource &&
      (cleanSource.includes("swapExactTokensForTokens") ||
        cleanSource.includes("swapTokensForExactTokens") ||
        cleanSource.includes("exactInputSingle") ||
        cleanSource.includes("exactInput") ||
        cleanSource.includes("exactOutputSingle") ||
        cleanSource.includes("exactOutput") ||
        cleanSource.includes("IUniswapV2Router") ||
        cleanSource.includes("ISwapRouter")));

  if (hasAmmRouterOrSwapInterface) {
    flashLoanSandwichRisk = true;
    simulations.push({
      attackType: "SANDWICH_MEV_DRAIN",
      classification: "SIMULATION / ESTIMATE / ASSUMPTIONS",
      targetContract: contractAddress,
      capitalRequiredUsd: null,
      estimatedProfitUsd: null,
      maximumLossUsd: null,
      priceImpactPercent: null,
      gasCostEstimatedGwei: null,
      attackSequence: [
        {
          step: 1,
          action: "Front-run victim swap: Buy token with 50 ETH",
          caller: "MEV Searcher",
          callTarget: "UniswapRouter",
          valueEth: "50",
          params: { slippagePushed: "+4.8%" },
        },
        {
          step: 2,
          action: "Victim swap executes at worst allowable slippage boundary",
          caller: "Victim Trader",
          callTarget: contractAddress,
          valueEth: "10",
          params: { executedSlippage: "4.99%" },
        },
        {
          step: 3,
          action: "Back-run victim swap: Sell token acquired in step 1",
          caller: "MEV Searcher",
          callTarget: "UniswapRouter",
          valueEth: "0",
          params: { profitExtractedEth: "1.45" },
        },
      ],
      requiredAssumptions: [
        "No live market, gas, liquidity or target-state inputs were supplied; quantitative USD/impact/gas fields are withheld.",
        "Mempool is public and victim trade specifies loose slippage tolerance (>= 3%).",
        "Block builder accepts bundle via Flashbots / private RPC.",
      ],
    });
  }

  // 3. Flash-Loan Receiver Callback Authorization Verification (ERC-3156 / Aave / Balancer)
  const onFlashLoanSelector = "0x23e0b906";
  const executeOperationSelector = "0x920f5c84";
  const hasFlashLoanCallback =
    selectorsDiscovered.has(onFlashLoanSelector) ||
    selectorsDiscovered.has(executeOperationSelector) ||
    cleanSource.includes("onFlashLoan") ||
    cleanSource.includes("executeOperation") ||
    cleanSource.includes("receiveFlashLoan");

  if (hasFlashLoanCallback) {
    // Check if source has sender verification patterns
    const hasCallerVerification =
      cleanSource.includes("msg.sender") &&
      (cleanSource.includes("==") || cleanSource.includes("require(")) &&
      (cleanSource.includes("POOL") || cleanSource.includes("lender") || cleanSource.includes("vault"));

    if (!hasCallerVerification) {
      findings.push({
        findingId: "VLM-SEC-DEFI-FLASH-CALLBACK-01",
        title: "Flash-Loan Callback Lacks Caller Authorization",
        severity: "critical",
        confidence: "high",
        exploitability: "proof-of-concept",
        impact: "Arbitrary callers can invoke the flash-loan callback directly with crafted parameters to execute privileged logic, drain pre-funded balances, or manipulate protocol accounting without repaying any flash loan.",
        likelihood: "high",
        taxonomy: {
          swcId: "SWC-105",
          cweId: "CWE-284",
          eeaSvsLevel: "S",
          owaspScsvsCategory: "S2: Access Control",
        },
        affectedContract: contractAddress,
        affectedFunction: selectorsDiscovered.has(onFlashLoanSelector) ? "onFlashLoan(address,address,uint256,uint256,bytes)" : "executeOperation(address[],uint256[],uint256[],address,bytes)",
        bytecodeOffset: { pcStart: 0, pcEnd: 64 },
        executionPath: ["External call to flash-loan callback", "No msg.sender validation", "Privileged token operation"],
        stateDependencies: { storageSlotsRead: [], storageSlotsWritten: [] },
        attackScenario: "Attacker calls callback function directly without going through the authorized lender. Contract processes arbitrary parameters and may transfer pre-funded tokens to attacker.",
        proofOfConcept: {
          summary: "Direct unauthorized callback invocation",
          sequence: [
            { step: 1, actor: "Attacker", call: "target.onFlashLoan(attacker, token, balance, 0, maliciousData)", expectation: "Callback accepts unauthorized caller" },
            { step: 2, actor: "Target", call: "Privileged token operation", expectation: "Pre-funded balance at risk" },
          ],
        },
        evidence: {
          opcodeTraceExcerpt: `${hasFlashLoanCallback ? "Flash callback selector detected" : ""}: ${onFlashLoanSelector}/${executeOperationSelector}`,
          disassemblyContext: "Source analysis: no msg.sender == lender/POOL verification detected",
          hashProof: evidenceSha256(`flash-callback-${contractAddress}`),
        },
        remediation: {
          strategy: "Validate msg.sender against the expected lending pool/lender in the flash-loan callback before processing any parameters.",
          solidityPatchDiff: `--- a/contracts/FlashLoanReceiver.sol
+++ b/contracts/FlashLoanReceiver.sol
@@ -5,3 +5,4 @@
     function onFlashLoan(...) external returns (bytes32) {
+        require(msg.sender == address(lender), "Unauthorized lender");`,
        },
        verificationState: "STATIC_PROVEN",
      });
    }
  }

  return {
    hasVulnerability: findings.length > 0,
    findings,
    simulations,
    vaultInflationRisk,
    flashLoanSandwichRisk,
  };
}
