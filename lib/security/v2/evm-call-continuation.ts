import type { ControlFlowGraph } from './types';
import { applyLocalStackInstruction, isKnownLegacyOpcode, type LocalStack } from './evm-local-stack';

export interface CallContinuationScope {
  entryReachable: ReadonlySet<string>;
  canReachSuccessfulExit: ReadonlySet<string>;
  pruningApplied: boolean;
  limitations: readonly string[];
}

/** Bytecode-only overapproximation for the immediate-discard detector.
 * No source/ABI/name/address inputs, no mutation of the shared CFG or selectors.
 * Unknown jump targets go through one virtual node to ALL legal JUMPDESTs;
 * this avoids quadratic dynamic-edge expansion. Block-entry stack is unknown.
 * Reachable means MAY reach, not a proved feasible path or exploit.
 */
export function analyzeCallContinuation(cfg: ControlFlowGraph): CallContinuationScope {
  const all = new Set(cfg.blocks.keys());
  const limitations = ['LEGACY_CANCUN_CONTROL_FLOW_ONLY', 'NO_CROSS_BLOCK_STACK_OR_PATH_FEASIBILITY_PROOF'];
  const retainAll = (reason: string): CallContinuationScope => ({
    entryReachable: all, canReachSuccessfulExit: all, pruningApplied: false,
    limitations: [...limitations, reason],
  });
  if (!cfg.blocks.has(cfg.entryBlockId)) return retainAll('ENTRY_UNAVAILABLE_RETAINED');
  // Delegation/EOF must be resolved by the input layer, never treated as a proof
  // of an empty legacy execution. This helper does not claim format support.
  if (cfg.blocks.get(cfg.entryBlockId)?.instructions[0]?.opcode === 0xef) {
    return retainAll('NON_LEGACY_PREFIX_RETAINED');
  }
  if (cfg.blocks.size > 50_000) return retainAll('FLOW_BUDGET_RETAINED');
  let instructionCount = 0;
  for (const block of cfg.blocks.values()) {
    instructionCount += block.instructions.length;
    if (instructionCount > 200_000) return retainAll('FLOW_BUDGET_RETAINED');
  }
  // NUL cannot collide with the block_<pc> IDs emitted by our CFG builder.
  const anyDestination = '\0C14B_LEGACY_DYNAMIC_DESTINATIONS';
  if (cfg.blocks.has(anyDestination)) return retainAll('RESERVED_ID_RETAINED');
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();
  const starts = new Map<number, string>();
  const jumpDestinations = new Map<number, string>();
  const successful = new Set<string>();
  for (const block of cfg.blocks.values()) {
    if (starts.has(block.startPc)) return retainAll('DUPLICATE_PC_RETAINED');
    starts.set(block.startPc, block.id);
    if (block.instructions[0]?.opcode === 0x5b) jumpDestinations.set(block.startPc, block.id);
  }
  function edge(from: string, to: string) {
    if (!forward.has(from)) forward.set(from, new Set());
    if (!reverse.has(to)) reverse.set(to, new Set());
    forward.get(from)!.add(to); reverse.get(to)!.add(from);
  }
  for (const id of jumpDestinations.values()) edge(anyDestination, id);
  for (const block of cfg.blocks.values()) {
    const last = block.instructions.at(-1);
    if (!last) { successful.add(block.id); continue; }
    const stack: LocalStack = [];
    let target: bigint | null = null;
    let condition: bigint | null = null;
    for (const inst of block.instructions) {
      if (inst === last && (inst.opcode === 0x56 || inst.opcode === 0x57)) {
        target = stack.at(-1) ?? null;
        condition = inst.opcode === 0x57 ? stack.at(-2) ?? null : null;
      }
      applyLocalStackInstruction(stack, inst);
    }
    const fallthrough = () => {
      const next = starts.get(last.pc + last.size);
      if (next) edge(block.id, next);
      else successful.add(block.id); // falling off legacy code is an implicit STOP
    };
    const jump = () => {
      if (target === null) edge(block.id, anyDestination);
      else if (target >= 0n && target <= BigInt(Number.MAX_SAFE_INTEGER)) {
        const destination = jumpDestinations.get(Number(target));
        if (destination) edge(block.id, destination);
        // An exact non-JUMPDEST target aborts. We do NOT borrow a nearby PUSH.
      }
    };
    switch (last.opcode) {
      case 0x00: case 0xf3: case 0xff:
        successful.add(block.id); break;
      case 0xfd: case 0xfe:
        break;
      case 0x56:
        jump(); break;
      case 0x57:
        if (condition !== 0n) jump();
        if (condition === null || condition === 0n) fallthrough();
        break;
      default:
        if (isKnownLegacyOpcode(last.opcode)) fallthrough();
        // Unknown opcodes are exceptional halts in the explicitly scoped legacy
        // instruction set; no conclusion is made for EOF or a future fork.
    }
  }
  function closure(seeds: Iterable<string>, edges: Map<string, Set<string>>) {
    const visited = new Set(seeds); const queue = [...visited];
    for (let i = 0; i < queue.length; i++) {
      for (const id of edges.get(queue[i]) ?? []) {
        if (!visited.has(id)) { visited.add(id); queue.push(id); }
      }
    }
    visited.delete(anyDestination); return visited;
  }
  return {
    entryReachable: closure([cfg.entryBlockId], forward),
    canReachSuccessfulExit: closure(successful, reverse),
    pruningApplied: true, limitations,
  };
}
