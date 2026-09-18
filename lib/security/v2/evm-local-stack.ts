import type { EvmInstruction } from "./types";

/** Bounded block-local constant propagation, not path feasibility or a full EVM.
 * A null denotes an unknown input/result. We never borrow a nearby PUSH as proof
 * of the top of the stack. Cross-block state and memory remain unmodelled.
 * Semantics below target the legacy Cancun opcode set, not EOF/experimental EIPs.
 */
export type LocalStack = Array<bigint | null>;
const MOD = 1n << 256n;
const MASK = MOD - 1n;
const signed = (n: bigint) => n >= (1n << 255n) ? n - MOD : n;
const word = (n: bigint) => n & MASK;
const abs = (n: bigint) => n < 0n ? -n : n;

function power(base: bigint, exponent: bigint) {
  let result = 1n;
  // Exponent is a 256-bit word: at most 256 iterations, never base ** exponent.
  for (; exponent > 0n; exponent >>= 1n, base = word(base * base)) {
    if (exponent & 1n) result = word(result * base);
  }
  return result;
}

/** Return null for an unknown/unsupported expression. Operand a is the stack top. */
export function foldEvmConstant(op: number, a: bigint, b = 0n, c = 0n): bigint | null {
  switch (op) {
    case 0x01: return word(a + b);
    case 0x02: return word(a * b);
    case 0x03: return word(a - b);
    case 0x04: return b === 0n ? 0n : a / b;
    case 0x05: return b === 0n ? 0n : word(signed(a) / signed(b));
    case 0x06: return b === 0n ? 0n : a % b;
    case 0x07: return b === 0n ? 0n : word((signed(a) < 0n ? -1n : 1n) * (abs(signed(a)) % abs(signed(b))));
    case 0x08: return c === 0n ? 0n : (a + b) % c;
    case 0x09: return c === 0n ? 0n : (a * b) % c;
    case 0x0a: return power(a, b);
    case 0x0b: {
      if (a >= 32n) return b;
      const bit = 8n * a + 7n, lowMask = (1n << (bit + 1n)) - 1n;
      return (b & (1n << bit)) !== 0n ? b | (MASK ^ lowMask) : b & lowMask;
    }
    case 0x10: return a < b ? 1n : 0n;
    case 0x11: return a > b ? 1n : 0n;
    case 0x12: return signed(a) < signed(b) ? 1n : 0n;
    case 0x13: return signed(a) > signed(b) ? 1n : 0n;
    case 0x14: return a === b ? 1n : 0n;
    case 0x15: return a === 0n ? 1n : 0n;
    case 0x16: return a & b;
    case 0x17: return a | b;
    case 0x18: return a ^ b;
    case 0x19: return MASK ^ a;
    case 0x1a: return a >= 32n ? 0n : (b >> (8n * (31n - a))) & 255n;
    case 0x1b: return a >= 256n ? 0n : word(b << a);
    case 0x1c: return a >= 256n ? 0n : b >> a;
    case 0x1d: return a >= 256n ? signed(b) < 0n ? MASK : 0n : word(signed(b) >> a);
    default: return null;
  }
}

// Only stack effects are modelled for contextual/memory/storage/call opcodes.
const effects: Readonly<Record<number, readonly [number, number]>> = {
  0x20:[2,1],0x30:[0,1],0x31:[1,1],0x32:[0,1],0x33:[0,1],0x34:[0,1],0x35:[1,1],
  0x36:[0,1],0x37:[3,0],0x38:[0,1],0x39:[3,0],0x3a:[0,1],0x3b:[1,1],0x3c:[4,0],
  0x3d:[0,1],0x3e:[3,0],0x3f:[1,1],0x40:[1,1],0x41:[0,1],0x42:[0,1],0x43:[0,1],
  0x44:[0,1],0x45:[0,1],0x46:[0,1],0x47:[0,1],0x48:[0,1],0x49:[1,1],0x4a:[0,1],
  0x50:[1,0],0x51:[1,1],0x52:[2,0],0x53:[2,0],0x54:[1,1],0x55:[2,0],0x56:[1,0],
  0x57:[2,0],0x59:[0,1],0x5a:[0,1],0x5b:[0,0],0x5c:[1,1],0x5d:[2,0],0x5e:[3,0],
  0xf0:[3,1],0xf1:[7,1],0xf2:[7,1],0xf3:[2,0],0xf4:[6,1],0xf5:[4,1],0xfa:[6,1],
  0xfd:[2,0],0xff:[1,0],
};
/** Stack effects for non-arithmetic legacy operations; callers handle PUSH/DUP/SWAP separately. */
export function legacyStackEffect(op: number): readonly [number, number] | null {
  return effects[op] ?? (op >= 0xa0 && op <= 0xa4 ? [2 + op - 0xa0, 0] as const : null);
}

const arithmetic = (op: number) => (op >= 1 && op <= 0x0b) || (op >= 0x10 && op <= 0x1d);
export function isKnownLegacyOpcode(op: number): boolean {
  return op === 0 || op === 0xfe || op === 0x58 || op === 0x5f || arithmetic(op) ||
    Object.hasOwn(effects, op) || (op >= 0x60 && op <= 0x9f) || (op >= 0xa0 && op <= 0xa4);
}
export function isLegacyHalt(op: number): boolean {
  return op === 0 || op === 0xf3 || op === 0xfd || op === 0xfe || op === 0xff || !isKnownLegacyOpcode(op);
}

export function applyLocalStackInstruction(stack: LocalStack, inst: EvmInstruction): void {
  const op = inst.opcode;
  const pop = () => stack.pop() ?? null;
  if (inst.pushValueBigInt !== undefined) stack.push(word(inst.pushValueBigInt));
  else if (op === 0x58) stack.push(BigInt(inst.pc));
  else if (op >= 0x80 && op <= 0x8f) stack.push(stack.at(-(op - 0x7f)) ?? null);
  else if (op >= 0x90 && op <= 0x9f) {
    const depth = op - 0x8f;
    // Missing block-entry stack items are unknown, not removed/replaced constants.
    while (stack.length <= depth) stack.unshift(null);
    const idx = stack.length - 1 - depth;
    [stack[idx], stack[stack.length-1]] = [stack[stack.length-1], stack[idx]];
  } else if (arithmetic(op)) {
    const arity = op === 0x15 || op === 0x19 ? 1 : op === 0x08 || op === 0x09 ? 3 : 2;
    const args = Array.from({length:arity}, pop);
    stack.push(args.some(x => x === null) ? null : foldEvmConstant(op, args[0]!, args[1] ?? 0n, args[2] ?? 0n));
  } else {
    const effect = legacyStackEffect(op);
    if (!effect) { stack.length = 0; return; }
    for (let i = 0; i < effect[0]; i++) pop();
    for (let i = 0; i < effect[1]; i++) stack.push(null);
  }
  // No valid EVM stack can contain more than 1024 words. Preserve no constants
  // on an overfull local fragment; this module never certifies that it executes.
  if (stack.length > 1024) { stack.length = 0; stack.push(null); }
}
