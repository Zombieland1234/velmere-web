/**
 * Deterministic JSON-like serialization used for hashes and receipts.
 * Object keys are sorted, array order is preserved and undefined is explicit.
 * Cyclic inputs are rejected instead of silently producing unstable output.
 */
export function canonicalJson(value: unknown, seen: WeakSet<object> = new WeakSet()): string {
  if (typeof value === "undefined") return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  const objectValue = value as object;
  if (seen.has(objectValue)) throw new Error("canonical_json_cycle");
  seen.add(objectValue);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalJson(item, seen)).join(",")}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], seen)}`)
      .join(",")}}`;
  } finally {
    seen.delete(objectValue);
  }
}
