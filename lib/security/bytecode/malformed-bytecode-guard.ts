/**
 * VELMÈRE MALFORMED BYTECODE GUARD
 * 
 * Enforces the critical invariant:
 * bytecode == missing => bytecode_derived_claims == 0
 * 
 * When bytecode is missing or malformed:
 * The engine MUST NEVER output claims like:
 * - "Zero Destructive Opcodes: verified"
 * - "Direct Execution (Non-Proxy): verified"
 * - "TWAP / No Spot Dependency: verified"
 * - "Guarded / Clean Checks-Effects: verified"
 * 
 * Instead:
 * status = "missing"
 * value = "NOT ANALYZABLE FROM AVAILABLE EVIDENCE"
 * reason = machine-readable explanation
 */

export interface BytecodeInspectionResult {
  isValid: boolean;
  isBytecodePresent: boolean;
  lengthBytes: number;
  statusCode: "VALID_BYTECODE" | "MISSING_BYTECODE" | "MALFORMED_HEX" | "TRUNCATED_BYTECODE" | "EMPTY_BYTECODE";
  reason: string;
  bytecodeDerivedClaimsAllowed: boolean;
}

export function inspectBytecode(rawBytecode?: string): BytecodeInspectionResult {
  if (!rawBytecode || typeof rawBytecode !== "string") {
    return {
      isValid: false,
      isBytecodePresent: false,
      lengthBytes: 0,
      statusCode: "MISSING_BYTECODE",
      reason: "Bytecode string is null, undefined, or empty. Bytecode analysis cannot proceed.",
      bytecodeDerivedClaimsAllowed: false,
    };
  }

  const cleanHex = rawBytecode.trim().replace(/^0x/i, "");

  if (cleanHex.length === 0) {
    return {
      isValid: false,
      isBytecodePresent: false,
      lengthBytes: 0,
      statusCode: "EMPTY_BYTECODE",
      reason: "Bytecode is 0x with zero length bytes.",
      bytecodeDerivedClaimsAllowed: false,
    };
  }

  // Check valid hex characters
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
    return {
      isValid: false,
      isBytecodePresent: true,
      lengthBytes: Math.floor(cleanHex.length / 2),
      statusCode: "MALFORMED_HEX",
      reason: "Bytecode contains non-hexadecimal characters.",
      bytecodeDerivedClaimsAllowed: false,
    };
  }

  // Check odd length hex
  if (cleanHex.length % 2 !== 0) {
    return {
      isValid: false,
      isBytecodePresent: true,
      lengthBytes: Math.floor(cleanHex.length / 2),
      statusCode: "MALFORMED_HEX",
      reason: "Bytecode hex length is odd, invalid byte alignment.",
      bytecodeDerivedClaimsAllowed: false,
    };
  }

  const lengthBytes = cleanHex.length / 2;

  // Minimal viable EVM bytecode requires at least minimal runtime instructions
  if (lengthBytes < 8) {
    return {
      isValid: false,
      isBytecodePresent: true,
      lengthBytes,
      statusCode: "TRUNCATED_BYTECODE",
      reason: `Bytecode length is ${lengthBytes} bytes (< 8 bytes minimum threshold).`,
      bytecodeDerivedClaimsAllowed: false,
    };
  }

  return {
    isValid: true,
    isBytecodePresent: true,
    lengthBytes,
    statusCode: "VALID_BYTECODE",
    reason: "Bytecode is valid hexadecimal and meets size threshold.",
    bytecodeDerivedClaimsAllowed: true,
  };
}

export const NOT_ANALYZABLE_TEXT = "NOT ANALYZABLE FROM AVAILABLE EVIDENCE";

/**
 * Returns fail-closed metrics for any bytecode-dependent section when bytecode is missing/malformed.
 */
export function getFailClosedBytecodeMetrics(reason: string) {
  return [
    {
      label: "Dangerous Opcode Scan",
      value: NOT_ANALYZABLE_TEXT,
      status: "missing" as const,
      reason,
    },
    {
      label: "Proxy Implementation Slot",
      value: NOT_ANALYZABLE_TEXT,
      status: "missing" as const,
      reason,
    },
    {
      label: "Reentrancy Mutation Scan",
      value: NOT_ANALYZABLE_TEXT,
      status: "missing" as const,
      reason,
    },
    {
      label: "Unstructured DELEGATECALL",
      value: NOT_ANALYZABLE_TEXT,
      status: "missing" as const,
      reason,
    },
    {
      label: "Spot AMM Oracle Sensitivity",
      value: NOT_ANALYZABLE_TEXT,
      status: "missing" as const,
      reason,
    },
  ];
}
