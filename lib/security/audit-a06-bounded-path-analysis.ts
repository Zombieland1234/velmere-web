import { createHash } from "node:crypto";

export const PASS35_A5_A06_ENGINE_ID = "pass35-a5-bounded-cfg-path-analysis" as const;

export type Pass35A5A06InputClass =
  | "SYNTHETIC_OFFLINE"
  | "CUSTOMER_SUPPLIED_UNVERIFIED"
  | "CUSTOMER_SUPPLIED_VERIFIED";

export type Pass35A5A06Case = {
  schemaVersion: "velmere.pass35.audit-a5-a06-case.v1";
  inputClass: Pass35A5A06InputClass;
  caseRef: string;
  observedAt: string;
  chainId: string;
  contractAddress: string;
  deployedRuntimeBytecode: string;
  chainProviderReceiptSha256?: string | null;
  limits?: {
    maxPaths?: number;
    maxDepth?: number;
    maxVisitsPerBlock?: number;
  };
};

type Instruction = {
  pc: number;
  opcode: number;
  name: string;
  size: number;
  pushBytes: number;
  pushValueHex: string | null;
  pushValueNumber: number | null;
};

type BasicBlock = {
  id: string;
  startPc: number;
  endPc: number;
  instructionPcs: number[];
  terminalOpcode: string;
  edges: Array<{ kind: "FALLTHROUGH" | "STATIC_JUMP" | "STATIC_CONDITIONAL_JUMP"; targetPc: number }>;
  unresolvedDynamicJump: boolean;
};

export type Pass35A5A06Receipt = {
  schemaVersion: "velmere.pass35.audit-a5-a06-receipt.v1";
  engineId: typeof PASS35_A5_A06_ENGINE_ID;
  familyId: "symbolic_path_analysis";
  caseRef: string;
  inputClass: Pass35A5A06InputClass;
  target: {
    chainId: string;
    contractAddress: string;
    runtimeBytecodeSha256: string | null;
    runtimeByteLength: number | null;
    chainProviderReceiptSha256: string | null;
  };
  execution: {
    status: "VERIFIED_LOCAL_BOUNDED_CFG" | "BLOCKED";
    assuranceClass: "LOCAL_BOUNDED_CFG_NOT_SYMBOLIC";
    realCaseExecution: boolean;
    paidGateEligible: false;
    fullAuditClaimAllowed: false;
    promotionAllowed: false;
  };
  decoder: {
    instructionCount: number;
    pushInstructionCount: number;
    unknownOpcodeCount: number;
    truncatedPushCount: number;
  };
  cfg: {
    blockCount: number;
    edgeCount: number;
    reachableBlockCount: number;
    reachableCoveragePercent: number;
    unresolvedDynamicJumpCount: number;
    staticJumpCount: number;
    conditionalJumpCount: number;
    blocks: BasicBlock[];
  };
  paths: {
    completedPathCount: number;
    uniqueTerminalKinds: string[];
    maxObservedDepth: number;
    truncatedByMaxPaths: boolean;
    truncatedByMaxDepth: boolean;
    truncatedByVisitLimit: boolean;
    maxPaths: number;
    maxDepth: number;
    maxVisitsPerBlock: number;
  };
  riskSignals: Array<{
    signalId: string;
    severity: "high" | "medium" | "low" | "informational";
    opcode: string;
    programCounter: number;
    evidence: string;
  }>;
  blockers: string[];
  limitations: string[];
  rawAnalysisSha256: string;
  receiptSha256: string;
  truthBoundary: string;
};

const DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/i;
const HEX = /^0x(?:[a-f0-9]{2})+$/i;
const ADDRESS = /^0x[a-f0-9]{40}$/i;
const CASE_REF = /^AUD-[A-Z0-9-]{8,64}$/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

const OPCODE_NAMES = new Map<number, string>([
  [0x00, "STOP"], [0x01, "ADD"], [0x02, "MUL"], [0x03, "SUB"], [0x04, "DIV"],
  [0x05, "SDIV"], [0x06, "MOD"], [0x07, "SMOD"], [0x08, "ADDMOD"], [0x09, "MULMOD"],
  [0x0a, "EXP"], [0x0b, "SIGNEXTEND"], [0x10, "LT"], [0x11, "GT"], [0x12, "SLT"],
  [0x13, "SGT"], [0x14, "EQ"], [0x15, "ISZERO"], [0x16, "AND"], [0x17, "OR"],
  [0x18, "XOR"], [0x19, "NOT"], [0x1a, "BYTE"], [0x1b, "SHL"], [0x1c, "SHR"],
  [0x1d, "SAR"], [0x20, "KECCAK256"], [0x30, "ADDRESS"], [0x31, "BALANCE"],
  [0x32, "ORIGIN"], [0x33, "CALLER"], [0x34, "CALLVALUE"], [0x35, "CALLDATALOAD"],
  [0x36, "CALLDATASIZE"], [0x37, "CALLDATACOPY"], [0x38, "CODESIZE"], [0x39, "CODECOPY"],
  [0x3a, "GASPRICE"], [0x3b, "EXTCODESIZE"], [0x3c, "EXTCODECOPY"], [0x3d, "RETURNDATASIZE"],
  [0x3e, "RETURNDATACOPY"], [0x3f, "EXTCODEHASH"], [0x40, "BLOCKHASH"], [0x41, "COINBASE"],
  [0x42, "TIMESTAMP"], [0x43, "NUMBER"], [0x44, "PREVRANDAO"], [0x45, "GASLIMIT"],
  [0x46, "CHAINID"], [0x47, "SELFBALANCE"], [0x48, "BASEFEE"], [0x49, "BLOBHASH"],
  [0x4a, "BLOBBASEFEE"], [0x50, "POP"], [0x51, "MLOAD"], [0x52, "MSTORE"],
  [0x53, "MSTORE8"], [0x54, "SLOAD"], [0x55, "SSTORE"], [0x56, "JUMP"], [0x57, "JUMPI"],
  [0x58, "PC"], [0x59, "MSIZE"], [0x5a, "GAS"], [0x5b, "JUMPDEST"], [0x5f, "PUSH0"],
  [0xf0, "CREATE"], [0xf1, "CALL"], [0xf2, "CALLCODE"], [0xf3, "RETURN"],
  [0xf4, "DELEGATECALL"], [0xf5, "CREATE2"], [0xfa, "STATICCALL"], [0xfd, "REVERT"],
  [0xfe, "INVALID"], [0xff, "SELFDESTRUCT"],
]);

for (let opcode = 0x60; opcode <= 0x7f; opcode += 1) OPCODE_NAMES.set(opcode, `PUSH${opcode - 0x5f}`);
for (let opcode = 0x80; opcode <= 0x8f; opcode += 1) OPCODE_NAMES.set(opcode, `DUP${opcode - 0x7f}`);
for (let opcode = 0x90; opcode <= 0x9f; opcode += 1) OPCODE_NAMES.set(opcode, `SWAP${opcode - 0x8f}`);
for (let opcode = 0xa0; opcode <= 0xa4; opcode += 1) OPCODE_NAMES.set(opcode, `LOG${opcode - 0xa0}`);

const TERMINALS = new Set(["STOP", "RETURN", "REVERT", "INVALID", "SELFDESTRUCT"]);
const CONTROL_BREAKS = new Set([...TERMINALS, "JUMP", "JUMPI"]);

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalDigest(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (!DIGEST.test(text)) return null;
  return text.startsWith("sha256:") ? text : `sha256:${text}`;
}

function decodeBytecode(bytes: Buffer): { instructions: Instruction[]; truncatedPushCount: number } {
  const instructions: Instruction[] = [];
  let truncatedPushCount = 0;
  for (let pc = 0; pc < bytes.length;) {
    const opcode = bytes[pc];
    const pushBytes = opcode >= 0x60 && opcode <= 0x7f ? opcode - 0x5f : 0;
    const available = Math.max(0, Math.min(pushBytes, bytes.length - pc - 1));
    if (available !== pushBytes) truncatedPushCount += 1;
    const pushData = pushBytes ? bytes.subarray(pc + 1, pc + 1 + available) : Buffer.alloc(0);
    let pushValueNumber: number | null = null;
    if (pushBytes > 0 && pushBytes <= 6 && available === pushBytes) {
      pushValueNumber = Number.parseInt(pushData.toString("hex") || "0", 16);
    }
    instructions.push({
      pc,
      opcode,
      name: OPCODE_NAMES.get(opcode) ?? `UNKNOWN_0x${opcode.toString(16).padStart(2, "0")}`,
      size: 1 + available,
      pushBytes,
      pushValueHex: pushBytes ? `0x${pushData.toString("hex")}` : null,
      pushValueNumber,
    });
    pc += 1 + available;
  }
  return { instructions, truncatedPushCount };
}

function buildCfg(instructions: Instruction[]): BasicBlock[] {
  if (!instructions.length) return [];
  const byPc = new Map(instructions.map((instruction) => [instruction.pc, instruction]));
  const boundaries = new Set<number>([instructions[0].pc]);
  for (const instruction of instructions) {
    if (instruction.name === "JUMPDEST") boundaries.add(instruction.pc);
    if (CONTROL_BREAKS.has(instruction.name)) {
      const nextPc = instruction.pc + instruction.size;
      if (byPc.has(nextPc)) boundaries.add(nextPc);
    }
  }
  const starts = [...boundaries].sort((a, b) => a - b);
  const blockByStart = new Map<number, BasicBlock>();
  for (let index = 0; index < starts.length; index += 1) {
    const startPc = starts[index];
    const nextStart = starts[index + 1] ?? Number.POSITIVE_INFINITY;
    const rows = instructions.filter((instruction) => instruction.pc >= startPc && instruction.pc < nextStart);
    if (!rows.length) continue;
    const last = rows.at(-1)!;
    const block: BasicBlock = {
      id: `B${String(blockByStart.size + 1).padStart(4, "0")}`,
      startPc,
      endPc: last.pc + last.size - 1,
      instructionPcs: rows.map((row) => row.pc),
      terminalOpcode: last.name,
      edges: [],
      unresolvedDynamicJump: false,
    };
    blockByStart.set(startPc, block);
  }
  const ordered = [...blockByStart.values()].sort((a, b) => a.startPc - b.startPc);
  const blockStartSet = new Set(ordered.map((block) => block.startPc));
  const instructionIndex = new Map(instructions.map((instruction, index) => [instruction.pc, index]));
  const jumpDestSet = new Set(instructions.filter((instruction) => instruction.name === "JUMPDEST").map((instruction) => instruction.pc));
  for (let index = 0; index < ordered.length; index += 1) {
    const block = ordered[index];
    const lastPc = block.instructionPcs.at(-1)!;
    const lastInstruction = byPc.get(lastPc)!;
    const lastIndex = instructionIndex.get(lastPc)!;
    const previous = lastIndex > 0 ? instructions[lastIndex - 1] : null;
    const staticTarget = previous && previous.pushBytes > 0 ? previous.pushValueNumber : null;
    const targetValid = staticTarget !== null && blockStartSet.has(staticTarget) && jumpDestSet.has(staticTarget);
    if (lastInstruction.name === "JUMP") {
      if (targetValid) block.edges.push({ kind: "STATIC_JUMP", targetPc: staticTarget! });
      else block.unresolvedDynamicJump = true;
      continue;
    }
    if (lastInstruction.name === "JUMPI") {
      if (targetValid) block.edges.push({ kind: "STATIC_CONDITIONAL_JUMP", targetPc: staticTarget! });
      else block.unresolvedDynamicJump = true;
      const fallthrough = ordered[index + 1];
      if (fallthrough) block.edges.push({ kind: "FALLTHROUGH", targetPc: fallthrough.startPc });
      continue;
    }
    if (TERMINALS.has(lastInstruction.name)) continue;
    const fallthrough = ordered[index + 1];
    if (fallthrough) block.edges.push({ kind: "FALLTHROUGH", targetPc: fallthrough.startPc });
  }
  return ordered;
}

function explorePaths(blocks: BasicBlock[], maxPaths: number, maxDepth: number, maxVisitsPerBlock: number) {
  const byPc = new Map(blocks.map((block) => [block.startPc, block]));
  const start = blocks[0];
  if (!start) return {
    completedPathCount: 0,
    uniqueTerminalKinds: [] as string[],
    maxObservedDepth: 0,
    truncatedByMaxPaths: false,
    truncatedByMaxDepth: false,
    truncatedByVisitLimit: false,
    reachableBlocks: new Set<number>(),
  };
  const stack: Array<{ pc: number; depth: number; visits: Map<number, number> }> = [{ pc: start.startPc, depth: 1, visits: new Map() }];
  const reachableBlocks = new Set<number>();
  const terminals = new Set<string>();
  let completedPathCount = 0;
  let maxObservedDepth = 0;
  let truncatedByMaxPaths = false;
  let truncatedByMaxDepth = false;
  let truncatedByVisitLimit = false;
  while (stack.length) {
    if (completedPathCount >= maxPaths) {
      truncatedByMaxPaths = true;
      break;
    }
    const current = stack.pop()!;
    const block = byPc.get(current.pc);
    if (!block) continue;
    reachableBlocks.add(block.startPc);
    maxObservedDepth = Math.max(maxObservedDepth, current.depth);
    const visits = new Map(current.visits);
    const seen = (visits.get(block.startPc) ?? 0) + 1;
    visits.set(block.startPc, seen);
    if (seen > maxVisitsPerBlock) {
      truncatedByVisitLimit = true;
      completedPathCount += 1;
      terminals.add("VISIT_LIMIT");
      continue;
    }
    if (current.depth >= maxDepth && block.edges.length) {
      truncatedByMaxDepth = true;
      completedPathCount += 1;
      terminals.add("DEPTH_LIMIT");
      continue;
    }
    if (!block.edges.length) {
      completedPathCount += 1;
      terminals.add(block.unresolvedDynamicJump ? "UNRESOLVED_DYNAMIC_JUMP" : block.terminalOpcode);
      continue;
    }
    for (const edge of [...block.edges].reverse()) {
      stack.push({ pc: edge.targetPc, depth: current.depth + 1, visits });
    }
  }
  return {
    completedPathCount,
    uniqueTerminalKinds: [...terminals].sort(),
    maxObservedDepth,
    truncatedByMaxPaths,
    truncatedByMaxDepth,
    truncatedByVisitLimit,
    reachableBlocks,
  };
}

function validateInput(input: Pass35A5A06Case): string[] {
  const blockers: string[] = [];
  const add = (ok: unknown, code: string) => { if (!ok) blockers.push(code); };
  add(input?.schemaVersion === "velmere.pass35.audit-a5-a06-case.v1", "a5_a06_schema_invalid");
  add(["SYNTHETIC_OFFLINE", "CUSTOMER_SUPPLIED_UNVERIFIED", "CUSTOMER_SUPPLIED_VERIFIED"].includes(input?.inputClass), "a5_a06_input_class_invalid");
  add(CASE_REF.test(String(input?.caseRef ?? "")), "a5_a06_case_ref_invalid");
  add(ISO.test(String(input?.observedAt ?? "")), "a5_a06_observed_at_invalid");
  add(/^\d+$/u.test(String(input?.chainId ?? "")), "a5_a06_chain_id_invalid");
  add(ADDRESS.test(String(input?.contractAddress ?? "")), "a5_a06_contract_address_invalid");
  add(HEX.test(String(input?.deployedRuntimeBytecode ?? "")), "a5_a06_runtime_bytecode_invalid");
  const runtimeBytes = HEX.test(String(input?.deployedRuntimeBytecode ?? "")) ? Buffer.byteLength(String(input.deployedRuntimeBytecode).slice(2), "hex") : 0;
  add(runtimeBytes > 0 && runtimeBytes <= 24 * 1024, "a5_a06_runtime_bytecode_size_invalid");
  if (input?.chainProviderReceiptSha256 != null) add(canonicalDigest(input.chainProviderReceiptSha256) !== null, "a5_a06_chain_receipt_digest_invalid");
  const maxPaths = Number(input?.limits?.maxPaths ?? 512);
  const maxDepth = Number(input?.limits?.maxDepth ?? 128);
  const maxVisits = Number(input?.limits?.maxVisitsPerBlock ?? 2);
  add(Number.isInteger(maxPaths) && maxPaths >= 1 && maxPaths <= 4096, "a5_a06_max_paths_invalid");
  add(Number.isInteger(maxDepth) && maxDepth >= 1 && maxDepth <= 1024, "a5_a06_max_depth_invalid");
  add(Number.isInteger(maxVisits) && maxVisits >= 1 && maxVisits <= 8, "a5_a06_max_visits_invalid");
  return [...new Set(blockers)].sort();
}

export function executeBoundedPathAnalysis(input: Pass35A5A06Case): Pass35A5A06Receipt {
  const blockers = validateInput(input);
  const runtimeHex = HEX.test(String(input?.deployedRuntimeBytecode ?? "")) ? String(input.deployedRuntimeBytecode).toLowerCase() : null;
  const runtimeBytes = runtimeHex ? Buffer.from(runtimeHex.slice(2), "hex") : null;
  const maxPaths = Number(input?.limits?.maxPaths ?? 512);
  const maxDepth = Number(input?.limits?.maxDepth ?? 128);
  const maxVisitsPerBlock = Number(input?.limits?.maxVisitsPerBlock ?? 2);
  let instructions: Instruction[] = [];
  let truncatedPushCount = 0;
  let blocks: BasicBlock[] = [];
  let exploration = explorePaths([], maxPaths, maxDepth, maxVisitsPerBlock);
  if (!blockers.length && runtimeBytes) {
    const decoded = decodeBytecode(runtimeBytes);
    instructions = decoded.instructions;
    truncatedPushCount = decoded.truncatedPushCount;
    if (truncatedPushCount > 0) blockers.push("a5_a06_truncated_push_data");
    blocks = buildCfg(instructions);
    exploration = explorePaths(blocks, maxPaths, maxDepth, maxVisitsPerBlock);
  }
  const riskSignals = instructions.flatMap((instruction) => {
    const severity: "high" | "medium" | "low" | "informational" | null = instruction.name === "SELFDESTRUCT"
      ? "high"
      : ["DELEGATECALL", "CALLCODE"].includes(instruction.name)
        ? "medium"
        : ["CREATE", "CREATE2", "CALL"].includes(instruction.name)
          ? "low"
          : instruction.name === "STATICCALL"
            ? "informational"
            : null;
    if (!severity) return [];
    return [{
      signalId: `A06-${instruction.name}-${String(instruction.pc).padStart(6, "0")}`,
      severity,
      opcode: instruction.name,
      programCounter: instruction.pc,
      evidence: `Opcode ${instruction.name} occurs at program counter ${instruction.pc}; exploitability is not inferred.`,
    }];
  });
  const unknownOpcodeCount = instructions.filter((instruction) => instruction.name.startsWith("UNKNOWN_")).length;
  const reachableCoveragePercent = blocks.length ? Number(((exploration.reachableBlocks.size / blocks.length) * 100).toFixed(2)) : 0;
  const rawAnalysis = {
    instructions,
    blocks,
    pathSummary: {
      completedPathCount: exploration.completedPathCount,
      uniqueTerminalKinds: exploration.uniqueTerminalKinds,
      maxObservedDepth: exploration.maxObservedDepth,
      truncatedByMaxPaths: exploration.truncatedByMaxPaths,
      truncatedByMaxDepth: exploration.truncatedByMaxDepth,
      truncatedByVisitLimit: exploration.truncatedByVisitLimit,
    },
    riskSignals,
  };
  const realCaseExecution = blockers.length === 0
    && input.inputClass !== "SYNTHETIC_OFFLINE"
    && canonicalDigest(input.chainProviderReceiptSha256) !== null;
  const core = {
    schemaVersion: "velmere.pass35.audit-a5-a06-receipt.v1" as const,
    engineId: PASS35_A5_A06_ENGINE_ID,
    familyId: "symbolic_path_analysis" as const,
    caseRef: String(input?.caseRef ?? ""),
    inputClass: input?.inputClass,
    target: {
      chainId: String(input?.chainId ?? ""),
      contractAddress: String(input?.contractAddress ?? "").toLowerCase(),
      runtimeBytecodeSha256: runtimeBytes ? sha256(runtimeBytes) : null,
      runtimeByteLength: runtimeBytes?.length ?? null,
      chainProviderReceiptSha256: canonicalDigest(input?.chainProviderReceiptSha256),
    },
    execution: {
      status: blockers.length ? "BLOCKED" as const : "VERIFIED_LOCAL_BOUNDED_CFG" as const,
      assuranceClass: "LOCAL_BOUNDED_CFG_NOT_SYMBOLIC" as const,
      realCaseExecution,
      paidGateEligible: false as const,
      fullAuditClaimAllowed: false as const,
      promotionAllowed: false as const,
    },
    decoder: {
      instructionCount: instructions.length,
      pushInstructionCount: instructions.filter((instruction) => instruction.pushBytes > 0).length,
      unknownOpcodeCount,
      truncatedPushCount,
    },
    cfg: {
      blockCount: blocks.length,
      edgeCount: blocks.reduce((sum, block) => sum + block.edges.length, 0),
      reachableBlockCount: exploration.reachableBlocks.size,
      reachableCoveragePercent,
      unresolvedDynamicJumpCount: blocks.filter((block) => block.unresolvedDynamicJump).length,
      staticJumpCount: blocks.reduce((sum, block) => sum + block.edges.filter((edge) => edge.kind === "STATIC_JUMP").length, 0),
      conditionalJumpCount: blocks.reduce((sum, block) => sum + block.edges.filter((edge) => edge.kind === "STATIC_CONDITIONAL_JUMP").length, 0),
      blocks,
    },
    paths: {
      completedPathCount: exploration.completedPathCount,
      uniqueTerminalKinds: exploration.uniqueTerminalKinds,
      maxObservedDepth: exploration.maxObservedDepth,
      truncatedByMaxPaths: exploration.truncatedByMaxPaths,
      truncatedByMaxDepth: exploration.truncatedByMaxDepth,
      truncatedByVisitLimit: exploration.truncatedByVisitLimit,
      maxPaths,
      maxDepth,
      maxVisitsPerBlock,
    },
    riskSignals,
    blockers: [...new Set(blockers)].sort(),
    limitations: [
      "This engine builds a bounded control-flow graph and explores structural paths only.",
      "It does not solve symbolic constraints, model storage, memory, calldata, balances, gas or environment state.",
      "Dynamic jump targets that are not an immediately preceding PUSH are unresolved.",
      "Opcode presence is a review signal, not proof of exploitability or vulnerability.",
      "No paid-gate, full-audit, independent-assurance or benchmark credit is granted.",
    ],
    rawAnalysisSha256: sha256(stable(rawAnalysis)),
    truthBoundary: "A5 A06 proves deterministic bounded EVM decoding, CFG construction and structural path exploration for the supplied bytecode only. It is not full symbolic execution, exploit proof, fork replay, manual QA or customer-grade audit evidence.",
  };
  return { ...core, receiptSha256: sha256(stable(core)) };
}
