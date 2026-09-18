import type { ControlFlowGraph } from './types';
import { foldEvmConstant, isLegacyHalt, legacyStackEffect } from './evm-local-stack';

export const ORIGIN_DATAFLOW_LIMITATION =
  'ORIGIN_DATAFLOW_BLOCK_LOCAL: memory/storage/call results and cross-block stack inputs are not tracked; branch dependency is not authorization, reachability or exploit proof.';

interface Value {
  constant: bigint | null;
  originPc: number | null;
  comparisonPc: number | null;
}
export interface OriginBranchEvidence {
  blockId: string;
  originPc: number;
  comparisonPc: number | null;
  branchPc: number;
}
const unknown = (): Value => ({ constant: null, originPc: null, comparisonPc: null });
const constant = (value: bigint): Value => ({ ...unknown(), constant: value });
const first = (values: Array<number | null>): number | null => {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? Math.min(...known) : null;
};
const arithmetic = (op: number) => (op >= 0x01 && op <= 0x0b) || (op >= 0x10 && op <= 0x1d);

/** A single bounded forward pass over each basic block. This tracks actual
 * operand provenance, not opcode proximity. A consumed/discarded ORIGIN cannot
 * taint later independent comparisons. It deliberately does NOT claim complete
 * taint analysis: unmodelled loads/results become unknown, never proven clean.
 * Candidate output is bounded to the first 64 distinct origin-dependent branches.
 */
export function findOriginDependentBranches(cfg: ControlFlowGraph): OriginBranchEvidence[] {
  const branches: OriginBranchEvidence[] = [];
  for (const block of cfg.blocks.values()) {
    const stack: Value[] = [];
    const pop = (): Value => stack.pop() ?? unknown();
    for (const inst of block.instructions) {
      const op = inst.opcode;
      if (isLegacyHalt(op)) break;
      if (op === 0x57) {
        pop(); // Destination is NOT the conditional operand.
        const condition = pop();
        if (condition.originPc !== null && condition.constant === null) {
          branches.push({ blockId: block.id, originPc: condition.originPc, comparisonPc: condition.comparisonPc, branchPc: inst.pc });
          if (branches.length === 64) return branches;
        }
      } else if (inst.pushValueBigInt !== undefined) {
        stack.push(constant(inst.pushValueBigInt));
      } else if (op === 0x58) {
        stack.push(constant(BigInt(inst.pc)));
      } else if (op === 0x32) {
        stack.push({ ...unknown(), originPc: inst.pc });
      } else if (op >= 0x80 && op <= 0x8f) {
        stack.push({ ...(stack.at(-(op - 0x7f)) ?? unknown()) });
      } else if (op >= 0x90 && op <= 0x9f) {
        const depth = op - 0x8f;
        while (stack.length <= depth) stack.unshift(unknown());
        const index = stack.length - 1 - depth;
        [stack[index], stack[stack.length - 1]] = [stack[stack.length - 1], stack[index]];
      } else if (arithmetic(op)) {
        const arity = op === 0x15 || op === 0x19 ? 1 : op === 0x08 || op === 0x09 ? 3 : 2;
        const args = Array.from({ length: arity }, pop);
        // Simple annihilators remove an actual dependency, not just its label.
        let folded: bigint | null = null;
        if (args.every(v => v.constant !== null)) {
          folded = foldEvmConstant(op, args[0].constant!, args[1]?.constant ?? 0n, args[2]?.constant ?? 0n);
        } else if ((op === 0x02 || op === 0x16) && args.some(v => v.constant === 0n)) {
          folded = 0n;
        } else if ((op === 0x1b || op === 0x1c) && args[0].constant !== null && args[0].constant >= 256n) {
          folded = 0n;
        }
        if (folded !== null) stack.push(constant(folded));
        else {
          const originPc = first(args.map(v => v.originPc));
          stack.push({ constant: null, originPc, comparisonPc: originPc !== null && op >= 0x10 && op <= 0x15
            ? inst.pc : first(args.map(v => v.comparisonPc)) });
        }
      } else {
        const effect = legacyStackEffect(op);
        if (!effect) { stack.length = 0; continue; }
        for (let i = 0; i < effect[0]; i++) pop();
        // MLOAD/SLOAD/TLOAD, CALL results etc. need separate dataflow models.
        for (let i = 0; i < effect[1]; i++) stack.push(unknown());
      }
      // An overflowing fragment has no validated EVM continuation. Stop rather
      // than silently resetting and fabricating evidence after exceptional halt.
      if (stack.length > 1024) break;
    }
  }
  return branches;
}
