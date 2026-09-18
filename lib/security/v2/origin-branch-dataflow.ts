import type { BasicBlock, ControlFlowGraph } from './types';
import { foldEvmConstant, isLegacyHalt, legacyStackEffect } from './evm-local-stack';

export const ORIGIN_DATAFLOW_LIMITATION =
  'ORIGIN_DATAFLOW_BOUNDED: only constant-resolved legacy jumps and fallthrough are followed; memory/storage/call results and unresolved stack inputs remain unknown. Limits: 512 states, 100000 instructions, 64 branches, 1024 stack words. Branch dependency is not authorization, reachability or exploit proof.';
interface Value {
  constant: bigint | null;
  originPc: number | null;
  comparisonPc: number | null;
  identity: 'origin' | 'caller' | null;
  callerEquality: boolean;
}
export interface OriginBranchEvidence {
  blockId: string;
  originPc: number;
  comparisonPc: number | null;
  branchPc: number;
  directCallerComparison: boolean;
}
const unknown = (): Value => ({ constant: null, originPc: null, comparisonPc: null, identity: null, callerEquality: false });
const constant = (value: bigint): Value => ({ ...unknown(), constant: value });
const first = (values: Array<number | null>): number | null => {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? Math.min(...known) : null;
};
const arithmetic = (op: number) => (op >= 0x01 && op <= 0x0b) || (op >= 0x10 && op <= 0x1d);
const ADDRESS_MASK = (1n << 160n) - 1n;

/** Bounded abstract stack propagation. No merging of values from incompatible
 * paths and no guessed jump destinations. Entry traversal retains compiler
 * helper return addresses; ORIGIN-block seeds also cover unresolved dispatch.
 * Such seeds are deliberately NOT evidence of reachability from contract entry.
 * Pure CALLER/ORIGIN equality remains an observation, not owner-auth evidence.
 */
export function findOriginDependentBranches(cfg: ControlFlowGraph): OriginBranchEvidence[] {
  const branches = new Map<string, OriginBranchEvidence>();
  const blocks = [...cfg.blocks.values()].sort((a, b) => a.startPc - b.startPc);
  const byPc = new Map(blocks.map(b => [b.startPc, b]));
  const queue: Array<{ block: BasicBlock; stack: Value[] }> = [];
  const entry = cfg.blocks.get(cfg.entryBlockId);
  if (entry) queue.push({ block: entry, stack: [] });
  for (const block of blocks) {
    if (queue.length < 512 && block !== entry && block.instructions.some(i => i.opcode === 0x32)) queue.push({ block, stack: [] });
  }
  const seen = new Set<string>();
  let instructions = 0;
  const enqueue = (block: BasicBlock | undefined, stack: Value[]) => {
    if (block && queue.length < 512) queue.push({ block, stack: [...stack] });
  };
  const jumpTarget = (dest: Value) => {
    if (dest.constant === null || dest.constant > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
    const block = byPc.get(Number(dest.constant));
    return block?.instructions[0]?.opcode === 0x5b ? block : undefined;
  };
  for (let q = 0; q < queue.length && q < 512 && instructions < 100000; q++) {
    const { block, stack } = queue[q];
    const key = block.id + ':' + stack.map(v => `${v.constant?.toString(16) ?? '?'}:${v.originPc ?? '-'}:${v.comparisonPc ?? '-'}:${v.identity ?? '-'}:${+v.callerEquality}`).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const pop = (): Value => stack.pop() ?? unknown();
    let terminated = false;
    for (const inst of block.instructions) {
      if (++instructions > 100000) { terminated = true; break; }
      const op = inst.opcode;
      if (isLegacyHalt(op)) { terminated = true; break; }
      if (op === 0x56 || op === 0x57) {
        const destination = pop();
        if (op === 0x56) enqueue(jumpTarget(destination), stack);
        else {
          const condition = pop();
          if (condition.originPc !== null && condition.constant === null) {
            const evidence = { blockId: block.id, originPc: condition.originPc, comparisonPc: condition.comparisonPc, branchPc: inst.pc, directCallerComparison: condition.callerEquality };
            branches.set(`${inst.pc}:${condition.originPc}:${+condition.callerEquality}`, evidence);
            if (branches.size >= 64) return [...branches.values()];
          }
          if (condition.constant !== 0n) enqueue(jumpTarget(destination), stack);
          if (condition.constant === null || condition.constant === 0n) enqueue(byPc.get(inst.pc + inst.size), stack);
        }
        terminated = true; break;
      } else if (inst.pushValueBigInt !== undefined) {
        stack.push(constant(inst.pushValueBigInt));
      } else if (op === 0x58) {
        stack.push(constant(BigInt(inst.pc)));
      } else if (op === 0x32 || op === 0x33) {
        stack.push({ ...unknown(), originPc: op === 0x32 ? inst.pc : null, identity: op === 0x32 ? 'origin' : 'caller' });
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
          // A 160-bit address mask does not change ORIGIN or CALLER identity.
          const masked = op === 0x16 ? args.find((v, i) => v.identity !== null && args[1-i]?.constant !== null && (args[1-i].constant! & ADDRESS_MASK) === ADDRESS_MASK) : undefined;
          const equality = op === 0x14 && ((args[0].identity === 'origin' && args[1].identity === 'caller') || (args[0].identity === 'caller' && args[1].identity === 'origin'));
          stack.push({ constant: null, originPc,
            comparisonPc: originPc !== null && op >= 0x10 && op <= 0x15 ? inst.pc : first(args.map(v => v.comparisonPc)),
            identity: masked?.identity ?? null,
            // Only EQ and boolean inversion preserve the precise comparison.
            // Compound AND/OR, arithmetic or mixing with owner checks do NOT.
            callerEquality: equality || (op === 0x15 && args[0].callerEquality),
          });
        }
      } else {
        const effect = legacyStackEffect(op);
        if (!effect) { terminated = true; break; }
        for (let i = 0; i < effect[0]; i++) pop();
        for (let i = 0; i < effect[1]; i++) stack.push(unknown());
      }
      if (stack.length > 1024) { terminated = true; break; }
    }
    if (!terminated && block.instructions.length) {
      const last = block.instructions[block.instructions.length - 1];
      enqueue(byPc.get(last.pc + last.size), stack);
    }
  }
  return [...branches.values()];
}
