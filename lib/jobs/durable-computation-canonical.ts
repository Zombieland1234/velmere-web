import { createHash } from "node:crypto";

export function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalDurableJson(value: unknown, rootPath = "$input"): string {
  const ancestors = new WeakSet<object>();
  const visit = (entry: unknown, path: string): string => {
    if (entry === null || entry === undefined) return "null";
    if (typeof entry === "string" || typeof entry === "boolean") return JSON.stringify(entry);
    if (typeof entry === "number") {
      if (!Number.isFinite(entry)) throw new Error(`durable_canonical_json_non_finite:${path}`);
      return Object.is(entry, -0) ? "0" : JSON.stringify(entry);
    }
    if (typeof entry !== "object") throw new Error(`durable_canonical_json_unsupported:${typeof entry}:${path}`);
    if (ancestors.has(entry)) throw new Error(`durable_canonical_json_cycle:${path}`);
    ancestors.add(entry);
    try {
      if (Array.isArray(entry)) {
        const values: string[] = [];
        for (let index = 0; index < entry.length; index += 1) {
          if (!(index in entry)) throw new Error(`durable_canonical_json_sparse_array:${path}[${index}]`);
          values.push(visit(entry[index], `${path}[${index}]`));
        }
        return `[${values.join(",")}]`;
      }
      const prototype = Object.getPrototypeOf(entry);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error(`durable_canonical_json_non_plain_object:${path}`);
      }
      if (Object.getOwnPropertySymbols(entry).length > 0) {
        throw new Error(`durable_canonical_json_symbol_key:${path}`);
      }
      const object = entry as Record<string, unknown>;
      const keys = Object.keys(object).sort((left, right) => left.localeCompare(right));
      return `{${keys.map((key) => `${JSON.stringify(key)}:${visit(object[key], `${path}.${key}`)}`).join(",")}}`;
    } finally {
      ancestors.delete(entry);
    }
  };
  return visit(value, rootPath);
}
