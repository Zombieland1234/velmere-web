/**
 * VELMÈRE ATTACK SURFACE TAXONOMY & EVALUATOR
 * 
 * Formal mapping to OWASP Smart Contract Security Top 10 (2025/2026):
 * - SC01: Access Control Vulnerabilities
 * - SC02: Business Logic Vulnerabilities
 * - SC03: Price Oracle Manipulation
 * - SC04: Flash Loan–Facilitated Attacks
 * - SC05: Lack of Input Validation
 * - SC06: Unchecked External Calls
 * - SC07: Arithmetic Errors
 * - SC08: Reentrancy Attacks
 * - SC09: Integer Overflow and Underflow
 * - SC10: Proxy & Upgradeability Vulnerabilities
 */

export interface OwaspScsVector {
  id: string; // e.g., "SC01"
  name: string;
  swcMapping: string[];
  cweMapping: string[];
  severityDefault: "critical" | "high" | "medium" | "low";
  description: string;
  testVectors: string[];
}

export const OWASP_SCS_TOP_10: Record<string, OwaspScsVector> = {
  SC01: {
    id: "SC01",
    name: "Access Control Vulnerabilities",
    swcMapping: ["SWC-105", "SWC-106", "SWC-115"],
    cweMapping: ["CWE-284", "CWE-285"],
    severityDefault: "critical",
    description: "Failure to restrict privileged functions, missing onlyOwner modifiers, or broken uninitialized owner pattern.",
    testVectors: ["unauthorized_mint", "arbitrary_pause", "ownership_drain"],
  },
  SC02: {
    id: "SC02",
    name: "Business Logic Vulnerabilities",
    swcMapping: ["SWC-100", "SWC-123"],
    cweMapping: ["CWE-840", "CWE-841"],
    severityDefault: "high",
    description: "Flaws in state transition logic, protocol reward accounting, fee routing, or staking balance invariants.",
    testVectors: ["state_transition_bypass", "double_spend_accounting"],
  },
  SC03: {
    id: "SC03",
    name: "Price Oracle Manipulation",
    swcMapping: ["SWC-101", "SWC-114"],
    cweMapping: ["CWE-829", "CWE-692"],
    severityDefault: "critical",
    description: "Reliance on manipulable spot AMM reserves, missing TWAP smoothing, or missing heartbeat checks.",
    testVectors: ["flash_swap_skew", "stale_oracle_drain"],
  },
  SC04: {
    id: "SC04",
    name: "Flash Loan–Facilitated Attacks",
    swcMapping: ["SWC-114"],
    cweMapping: ["CWE-840"],
    severityDefault: "critical",
    description: "Uncollateralized atomic loans used to amplify governance swing, liquidity skew, or transient arbitrage.",
    testVectors: ["governance_flash_vote", "liquidity_pool_drain"],
  },
  SC05: {
    id: "SC05",
    name: "Lack of Input Validation",
    swcMapping: ["SWC-128", "SWC-129"],
    cweMapping: ["CWE-20"],
    severityDefault: "medium",
    description: "Failure to sanitize parameters, boundary conditions, zero-address checks, or array length mismatches.",
    testVectors: ["zero_address_transfer", "array_length_dos"],
  },
  SC06: {
    id: "SC06",
    name: "Unchecked External Calls",
    swcMapping: ["SWC-104"],
    cweMapping: ["CWE-252", "CWE-703"],
    severityDefault: "medium",
    description: "Ignoring boolean return values of low-level call() or raw transfer() primitives.",
    testVectors: ["silent_call_failure", "dos_unresponsive_receiver"],
  },
  SC07: {
    id: "SC07",
    name: "Arithmetic Errors",
    swcMapping: ["SWC-101"],
    cweMapping: ["CWE-682"],
    severityDefault: "high",
    description: "Precision loss due to division before multiplication, rounding bias in liquidity minting.",
    testVectors: ["precision_loss_inflation", "rounding_sandwich"],
  },
  SC08: {
    id: "SC08",
    name: "Reentrancy Attacks",
    swcMapping: ["SWC-107"],
    cweMapping: ["CWE-841", "CWE-674"],
    severityDefault: "critical",
    description: "State mutation occurring after untrusted external calls, cross-function reentrancy, or read-only reentrancy.",
    testVectors: ["checks_effects_violation", "read_only_reentrancy_lending"],
  },
  SC09: {
    id: "SC09",
    name: "Integer Overflow and Underflow",
    swcMapping: ["SWC-101"],
    cweMapping: ["CWE-190", "CWE-191"],
    severityDefault: "high",
    description: "Unchecked arithmetic wrapping in Solidity <0.8.0 or explicit unchecked{} assembly blocks.",
    testVectors: ["unchecked_fee_underflow", "token_supply_wrap"],
  },
  SC10: {
    id: "SC10",
    name: "Proxy & Upgradeability Vulnerabilities",
    swcMapping: ["SWC-112", "SWC-124"],
    cweMapping: ["CWE-668", "CWE-787"],
    severityDefault: "critical",
    description: "Storage collisions between proxy and logic, uninitialized implementation contracts, arbitrary upgradeTo authority.",
    testVectors: ["uups_uninitialized_impl_destroy", "storage_slot_overwrite"],
  },
};
