/**
 * Velmère Security Engine V2 — EVM CFG & Data-Flow Analysis Engine
 *
 * Implements linear-time opcode disassembling, basic-block partitioning,
 * static jump resolution, directed Control-Flow Graph construction,
 * abstract stack simulation, storage slot mapping, and taint tracking.
 */

import { EvmInstruction, BasicBlock, ControlFlowGraph, TaintSource, TaintSink } from "./types";

export interface DisassemblyResult {
  instructions: EvmInstruction[];
  totalBytes: number;
}

export interface CfgAnalysisResult {
  cfg: ControlFlowGraph;
  selectorsDiscovered: Map<string, number>; // selectorHex -> pc
  storageSlotsRead: Set<string>;
  storageSlotsWritten: Set<string>;
  taintSinks: TaintSink[];
  hasReentrancyGuard: boolean;
  guardedStorageSlots: Set<string>;
}

// Opcode constants
const OP_STOP = 0x00;
const OP_JUMP = 0x56;
const OP_JUMPI = 0x57;
const OP_JUMPDEST = 0x5b;
const OP_PUSH1 = 0x60;
const OP_PUSH4 = 0x63;
const OP_PUSH32 = 0x7f;
const OP_SLOAD = 0x54;
const OP_SSTORE = 0x55;
const OP_RETURN = 0xf3;
const OP_REVERT = 0xfd;
const OP_INVALID = 0xfe;
const OP_SELFDESTRUCT = 0xff;
const OP_CALL = 0xf1;
const OP_DELEGATECALL = 0xf4;
const OP_STATICCALL = 0xfa;
const OP_CALLDATALOAD = 0x35;
const OP_CALLER = 0x33;
const OP_ORIGIN = 0x32;
const OP_RETURNDATACOPY = 0x3e;

const OP_NAMES: Record<number, string> = {
  0x00: "STOP", 0x01: "ADD", 0x02: "MUL", 0x03: "SUB", 0x04: "DIV", 0x05: "SDIV",
  0x06: "MOD", 0x07: "SMOD", 0x08: "ADDMOD", 0x09: "MULMOD", 0x0a: "EXP", 0x0b: "SIGNEXTEND",
  0x10: "LT", 0x11: "GT", 0x12: "SLT", 0x13: "SGT", 0x14: "EQ", 0x15: "ISZERO",
  0x16: "AND", 0x17: "OR", 0x18: "XOR", 0x19: "NOT", 0x1a: "BYTE", 0x1b: "SHL",
  0x1c: "SHR", 0x1d: "SAR", 0x20: "SHA3", 0x30: "ADDRESS", 0x31: "BALANCE",
  0x32: "ORIGIN", 0x33: "CALLER", 0x34: "CALLVALUE", 0x35: "CALLDATALOAD",
  0x36: "CALLDATASIZE", 0x37: "CALLDATACOPY", 0x38: "CODESIZE", 0x39: "CODECOPY",
  0x3a: "GASPRICE", 0x3b: "EXTCODESIZE", 0x3c: "EXTCODECOPY", 0x3d: "RETURNDATASIZE",
  0x3e: "RETURNDATACOPY", 0x3f: "EXTCODEHASH", 0x40: "BLOCKHASH", 0x41: "COINBASE",
  0x42: "TIMESTAMP", 0x43: "NUMBER", 0x44: "PREVRANDAO", 0x45: "GASLIMIT",
  0x46: "CHAINID", 0x47: "SELFBALANCE", 0x48: "BASEFEE", 0x50: "POP", 0x51: "MLOAD",
  0x52: "MSTORE", 0x53: "MSTORE8", 0x54: "SLOAD", 0x55: "SSTORE", 0x56: "JUMP",
  0x57: "JUMPI", 0x58: "PC", 0x59: "MSIZE", 0x5a: "GAS", 0x5b: "JUMPDEST",
  0x5c: "TLOAD", 0x5d: "TSTORE", 0x5e: "MCOPY",
  0x80: "DUP1", 0x81: "DUP2", 0x82: "DUP3", 0x83: "DUP4", 0x8f: "DUP16",
  0x90: "SWAP1", 0x91: "SWAP2", 0x9f: "SWAP16", 0xa0: "LOG0", 0xa1: "LOG1",
  0xa4: "LOG4", 0xf0: "CREATE", 0xf1: "CALL", 0xf2: "CALLCODE", 0xf3: "RETURN",
  0xf4: "DELEGATECALL", 0xf5: "CREATE2", 0xfa: "STATICCALL", 0xfd: "REVERT",
  0xfe: "INVALID", 0xff: "SELFDESTRUCT",
};

/**
 * Disassembles raw EVM bytecode cleanly into structured instructions.
 */
export function disassembleBytecode(rawHex: string): DisassemblyResult {
  const cleanHex = rawHex.startsWith("0x") ? rawHex.slice(2) : rawHex;
  const bytes = Buffer.from(cleanHex, "hex");
  const instructions: EvmInstruction[] = [];
  let pc = 0;

  while (pc < bytes.length) {
    const opcode = bytes[pc];
    let size = 1;
    let pushBytes = 0;
    let pushValueHex: string | undefined;
    let pushValueBigInt: bigint | undefined;

    if (opcode >= OP_PUSH1 && opcode <= OP_PUSH32) {
      pushBytes = opcode - OP_PUSH1 + 1;
      const dataStart = pc + 1;
      const dataEnd = Math.min(dataStart + pushBytes, bytes.length);
      const slice = bytes.subarray(dataStart, dataEnd);
      pushValueHex = slice.toString("hex").padStart(pushBytes * 2, "0");
      if (slice.length > 0) {
        try {
          pushValueBigInt = BigInt(`0x${pushValueHex}`);
        } catch {
          pushValueBigInt = 0n;
        }
      }
      size = 1 + pushBytes;
    }

    const name =
      OP_NAMES[opcode] ??
      (opcode >= OP_PUSH1 && opcode <= OP_PUSH32 ? `PUSH${opcode - OP_PUSH1 + 1}` : `UNKNOWN_0x${opcode.toString(16)}`);

    instructions.push({
      pc,
      opcode,
      name,
      size,
      pushBytes: pushBytes > 0 ? pushBytes : undefined,
      pushValueHex,
      pushValueBigInt,
    });

    pc += size;
  }

  return { instructions, totalBytes: bytes.length };
}

/**
 * Builds the Control-Flow Graph and basic blocks from disassembled instructions.
 */
export function buildControlFlowGraph(instructions: EvmInstruction[]): CfgAnalysisResult {
  if (instructions.length === 0) {
    return {
      cfg: {
        blocks: new Map(),
        entryBlockId: "block_0",
        totalInstructions: 0,
        cyclomaticComplexity: 1,
        unresolvedDynamicJumps: 0,
      },
      selectorsDiscovered: new Map(),
      storageSlotsRead: new Set(),
      storageSlotsWritten: new Set(),
      taintSinks: [],
      hasReentrancyGuard: false,
      guardedStorageSlots: new Set(),
    };
  }

  // 1. Identify block leaders (entry, JUMPDEST, instructions right after JUMP/JUMPI/RETURN/REVERT/STOP)
  const leaderPcs = new Set<number>([instructions[0].pc]);
  const pcToIndex = new Map<number, number>();

  for (let i = 0; i < instructions.length; i++) {
    const inst = instructions[i];
    pcToIndex.set(inst.pc, i);

    if (inst.opcode === OP_JUMPDEST) {
      leaderPcs.add(inst.pc);
    }

    if (
      inst.opcode === OP_JUMP ||
      inst.opcode === OP_JUMPI ||
      inst.opcode === OP_RETURN ||
      inst.opcode === OP_REVERT ||
      inst.opcode === OP_STOP ||
      inst.opcode === OP_SELFDESTRUCT ||
      inst.opcode === OP_INVALID
    ) {
      if (i + 1 < instructions.length) {
        leaderPcs.add(instructions[i + 1].pc);
      }
    }
  }

  const sortedLeaders = Array.from(leaderPcs).sort((a, b) => a - b);
  const blocks = new Map<string, BasicBlock>();
  const pcToBlockId = new Map<number, string>();

  // 2. Create basic blocks
  for (let b = 0; b < sortedLeaders.length; b++) {
    const startPc = sortedLeaders[b];
    const startIndex = pcToIndex.get(startPc)!;
    const nextStartPc = b + 1 < sortedLeaders.length ? sortedLeaders[b + 1] : Infinity;

    const blockInstructions: EvmInstruction[] = [];
    let endPc = startPc;

    for (let i = startIndex; i < instructions.length; i++) {
      const inst = instructions[i];
      if (inst.pc >= nextStartPc) break;
      blockInstructions.push(inst);
      endPc = inst.pc;
    }

    const blockId = `block_${startPc}`;
    const terminalOpcode = blockInstructions[blockInstructions.length - 1]?.name ?? "NONE";

    const block: BasicBlock = {
      id: blockId,
      startPc,
      endPc,
      instructions: blockInstructions,
      predecessors: [],
      successors: [],
      terminalOpcode,
      hasCall: blockInstructions.some((ins) => ins.opcode === OP_CALL),
      hasSstore: blockInstructions.some((ins) => ins.opcode === OP_SSTORE),
      hasSload: blockInstructions.some((ins) => ins.opcode === OP_SLOAD),
      hasDelegatecall: blockInstructions.some((ins) => ins.opcode === OP_DELEGATECALL),
      hasSelfdestruct: blockInstructions.some((ins) => ins.opcode === OP_SELFDESTRUCT),
      readsStorageSlots: new Set(),
      writesStorageSlots: new Set(),
      isReentrancyGuarded: false,
    };

    blocks.set(blockId, block);
    for (const inst of blockInstructions) {
      pcToBlockId.set(inst.pc, blockId);
    }
  }

  // 3. Connect CFG edges and resolve static jumps
  let unresolvedDynamicJumps = 0;
  const selectorsDiscovered = new Map<string, number>();
  const storageSlotsRead = new Set<string>();
  const storageSlotsWritten = new Set<string>();
  const taintSinks: TaintSink[] = [];
  const guardedStorageSlots = new Set<string>();

  for (const block of blocks.values()) {
    const lastInst = block.instructions[block.instructions.length - 1];
    if (!lastInst) continue;

    // Analyze stack inside the block to track push values, storage slots, and jump targets
    const abstractStack: bigint[] = [];
    const activeTaint: TaintSource[] = [];

    for (let i = 0; i < block.instructions.length; i++) {
      const inst = block.instructions[i];

      // Track taint sources
      if (inst.opcode === OP_CALLDATALOAD) {
        activeTaint.push({ kind: "CALLDATA", instructionPc: inst.pc, label: "calldata_offset" });
      } else if (inst.opcode === OP_CALLER) {
        activeTaint.push({ kind: "CALLER", instructionPc: inst.pc, label: "msg.sender" });
      } else if (inst.opcode === OP_ORIGIN) {
        activeTaint.push({ kind: "ORIGIN", instructionPc: inst.pc, label: "tx.origin" });
      }

      // Track method dispatcher selectors: PUSH4 0xXXXXXXXX -> EQ -> JUMPI
      if (inst.opcode === OP_PUSH4 && inst.pushValueHex && inst.pushValueHex.length === 8) {
        selectorsDiscovered.set(`0x${inst.pushValueHex}`, inst.pc);
      }

      // Track push values on abstract stack
      if (inst.pushValueBigInt !== undefined) {
        abstractStack.push(inst.pushValueBigInt);
      }

      // Track SLOAD / SSTORE storage slots
      if (inst.opcode === OP_SLOAD) {
        const slot = abstractStack.length > 0 ? `0x${abstractStack[abstractStack.length - 1].toString(16)}` : "unknown";
        block.readsStorageSlots.add(slot);
        storageSlotsRead.add(slot);
      }

      if (inst.opcode === OP_SSTORE) {
        const slot = abstractStack.length > 1 ? `0x${abstractStack[abstractStack.length - 2].toString(16)}` : "unknown";
        block.writesStorageSlots.add(slot);
        storageSlotsWritten.add(slot);

        if (activeTaint.length > 0) {
          taintSinks.push({
            kind: "SSTORE",
            instructionPc: inst.pc,
            taintedBy: [...activeTaint],
          });
        }
      }

      // Track DELEGATECALL and SELFDESTRUCT sinks
      if (inst.opcode === OP_DELEGATECALL && activeTaint.length > 0) {
        taintSinks.push({ kind: "DELEGATECALL", instructionPc: inst.pc, taintedBy: [...activeTaint] });
      }
      if (inst.opcode === OP_SELFDESTRUCT && activeTaint.length > 0) {
        taintSinks.push({ kind: "SELFDESTRUCT", instructionPc: inst.pc, taintedBy: [...activeTaint] });
      }

      // Check for Mutex lock pattern: SLOAD slot -> PUSH 2 -> SSTORE slot (Reentrancy Guard)
      if (
        i >= 3 &&
        block.instructions[i].opcode === OP_SSTORE &&
        block.instructions[i - 1].opcode === OP_PUSH1 &&
        (block.instructions[i - 1].pushValueHex === "02" || block.instructions[i - 1].pushValueHex === "01")
      ) {
        const guardedSlot =
          abstractStack.length > 1 ? `0x${abstractStack[abstractStack.length - 2].toString(16)}` : "0x0";
        guardedStorageSlots.add(guardedSlot);
        block.isReentrancyGuarded = true;
      }
    }

    // Connect edges based on terminal instruction
    if (lastInst.opcode === OP_JUMP) {
      const prevInst = block.instructions[block.instructions.length - 2];
      if (prevInst && prevInst.pushValueBigInt !== undefined) {
        const targetPc = Number(prevInst.pushValueBigInt);
        const targetBlockId = pcToBlockId.get(targetPc);
        if (targetBlockId && blocks.has(targetBlockId)) {
          block.successors.push(targetBlockId);
          blocks.get(targetBlockId)!.predecessors.push(block.id);
        } else {
          unresolvedDynamicJumps++;
        }
      } else {
        unresolvedDynamicJumps++;
      }
    } else if (lastInst.opcode === OP_JUMPI) {
      // 1. Conditional jump target
      const prevInst = block.instructions[block.instructions.length - 2];
      if (prevInst && prevInst.pushValueBigInt !== undefined) {
        const targetPc = Number(prevInst.pushValueBigInt);
        const targetBlockId = pcToBlockId.get(targetPc);
        if (targetBlockId && blocks.has(targetBlockId)) {
          block.successors.push(targetBlockId);
          blocks.get(targetBlockId)!.predecessors.push(block.id);
        }
      } else {
        unresolvedDynamicJumps++;
      }

      // 2. Fallthrough target
      const nextBlockPc = lastInst.pc + lastInst.size;
      const fallthroughId = pcToBlockId.get(nextBlockPc);
      if (fallthroughId && blocks.has(fallthroughId)) {
        block.successors.push(fallthroughId);
        blocks.get(fallthroughId)!.predecessors.push(block.id);
      }
    } else if (
      lastInst.opcode !== OP_RETURN &&
      lastInst.opcode !== OP_REVERT &&
      lastInst.opcode !== OP_STOP &&
      lastInst.opcode !== OP_SELFDESTRUCT &&
      lastInst.opcode !== OP_INVALID
    ) {
      // Standard sequential fallthrough
      const nextBlockPc = lastInst.pc + lastInst.size;
      const fallthroughId = pcToBlockId.get(nextBlockPc);
      if (fallthroughId && blocks.has(fallthroughId)) {
        block.successors.push(fallthroughId);
        blocks.get(fallthroughId)!.predecessors.push(block.id);
      }
    }
  }

  // Calculate Cyclomatic Complexity: M = E - N + 2P
  let totalEdges = 0;
  for (const b of blocks.values()) {
    totalEdges += b.successors.length;
  }
  const cyclomaticComplexity = Math.max(1, totalEdges - blocks.size + 2);

  return {
    cfg: {
      blocks,
      entryBlockId: `block_${instructions[0].pc}`,
      totalInstructions: instructions.length,
      cyclomaticComplexity,
      unresolvedDynamicJumps,
    },
    selectorsDiscovered,
    storageSlotsRead,
    storageSlotsWritten,
    taintSinks,
    hasReentrancyGuard: guardedStorageSlots.size > 0,
    guardedStorageSlots,
  };
}
