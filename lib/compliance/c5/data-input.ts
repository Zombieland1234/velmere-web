/** Bounded snapshot of data-only values. Never invokes an object's getters/toJSON.
 * Not a sandbox for executable JS (Proxy traps may execute). HTTP inputs should
 * originate from a size-limited JSON decoder; policies stay server-owned.
 */
export type Snapshot = {ok: true; value: unknown} | {ok: false};
export function snapshotData(input: unknown): Snapshot {
  let nodes = 0, chars = 0;
  const active = new Set<object>();
  function copy(value: unknown, depth: number): unknown {
    if (++nodes > 25_000 || depth > 32) throw new Error('LIMIT');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      chars += value.length;
      if (value.length > 16_384 || chars > 1_048_576) throw new Error('LIMIT');
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object' || active.has(value)) throw new Error('DATA_ONLY');
    const array = Array.isArray(value);
    const proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new Error('PROTOTYPE');
    active.add(value);
    try {
      const keys = Reflect.ownKeys(value);
      if (array) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
        const length: unknown = lengthDescriptor?.value;
        if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > 1000 || keys.length !== length + 1) throw new Error('ARRAY');
        const out: unknown[] = [];
        for (let i = 0; i < length; i++) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
          if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error('DENSE_DATA_ARRAY_REQUIRED');
          out.push(copy(descriptor.value, depth + 1));
        }
        return out;
      }
      if (keys.length > 64) throw new Error('KEY_LIMIT');
      const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const key of keys) {
        if (typeof key !== 'string' || key.length > 512 || ['__proto__','prototype','constructor'].includes(key)) throw new Error('KEY');
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error('DATA_DESCRIPTOR_REQUIRED');
        out[key] = copy(descriptor.value, depth + 1);
      }
      return out;
    } finally {
      active.delete(value);
    }
  }
  try { return {ok: true, value: copy(input, 0)}; }
  catch { return {ok: false}; }
}
