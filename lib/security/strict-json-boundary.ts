export const STRICT_JSON_BOUNDARY_ID = "velmere.pass36.a69.strict-json-boundary.v1" as const;

const DEFAULT_FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export type StrictJsonBoundaryOptions = {
  maxBytes: number;
  maxDepth?: number;
  maxNodes?: number;
  requireObject?: boolean;
  requireArray?: boolean;
  rejectDuplicateKeys?: boolean;
  rejectDangerousKeys?: boolean;
};

export type StrictJsonBoundaryErrorCode =
  | "strict_json_input_type_invalid"
  | "strict_json_max_bytes_invalid"
  | "strict_json_too_large"
  | "strict_json_invalid_utf8"
  | "strict_json_invalid"
  | "strict_json_duplicate_key"
  | "strict_json_forbidden_key"
  | "strict_json_depth_exceeded"
  | "strict_json_node_limit_exceeded"
  | "strict_json_object_required"
  | "strict_json_array_required";

export class StrictJsonBoundaryError extends Error {
  readonly code: StrictJsonBoundaryErrorCode;
  readonly detail: string | number | null;

  constructor(code: StrictJsonBoundaryErrorCode, detail: string | number | null = null) {
    super(detail === null ? code : `${code}:${String(detail)}`);
    this.name = "StrictJsonBoundaryError";
    this.code = code;
    this.detail = detail;
  }
}

type ScanState = {
  raw: string;
  index: number;
  nodes: number;
  maxDepth: number;
  maxNodes: number;
  rejectDuplicateKeys: boolean;
  rejectDangerousKeys: boolean;
};

function skipWhitespace(state: ScanState) {
  while (state.index < state.raw.length && /\s/u.test(state.raw[state.index] ?? "")) state.index += 1;
}

function parseStringToken(state: ScanState): string {
  const start = state.index;
  if (state.raw[state.index] !== '"') throw new StrictJsonBoundaryError("strict_json_invalid");
  state.index += 1;
  let closed = false;
  while (state.index < state.raw.length) {
    const char = state.raw[state.index];
    if (char === "\\") {
      state.index += 1;
      if (state.index >= state.raw.length) break;
      state.index += 1;
      continue;
    }
    state.index += 1;
    if (char === '"') {
      closed = true;
      break;
    }
  }
  if (!closed) throw new StrictJsonBoundaryError("strict_json_invalid");
  try {
    return JSON.parse(state.raw.slice(start, state.index)) as string;
  } catch {
    throw new StrictJsonBoundaryError("strict_json_invalid");
  }
}

function parsePrimitiveToken(state: ScanState) {
  const start = state.index;
  while (state.index < state.raw.length && !/[\s,}\]]/u.test(state.raw[state.index] ?? "")) state.index += 1;
  if (state.index === start) throw new StrictJsonBoundaryError("strict_json_invalid");
}

function countNode(state: ScanState) {
  state.nodes += 1;
  if (state.nodes > state.maxNodes) {
    throw new StrictJsonBoundaryError("strict_json_node_limit_exceeded", state.maxNodes);
  }
}

function scanValue(state: ScanState, depth: number): void {
  if (depth > state.maxDepth) {
    throw new StrictJsonBoundaryError("strict_json_depth_exceeded", state.maxDepth);
  }
  countNode(state);
  skipWhitespace(state);
  const char = state.raw[state.index];
  if (char === "{") {
    scanObject(state, depth);
    return;
  }
  if (char === "[") {
    scanArray(state, depth);
    return;
  }
  if (char === '"') {
    parseStringToken(state);
    return;
  }
  parsePrimitiveToken(state);
}

function scanObject(state: ScanState, depth: number) {
  state.index += 1;
  skipWhitespace(state);
  const keys = new Set<string>();
  if (state.raw[state.index] === "}") {
    state.index += 1;
    return;
  }
  while (state.index < state.raw.length) {
    skipWhitespace(state);
    const key = parseStringToken(state);
    if (state.rejectDuplicateKeys && keys.has(key)) {
      throw new StrictJsonBoundaryError("strict_json_duplicate_key", key.slice(0, 128));
    }
    if (state.rejectDangerousKeys && DEFAULT_FORBIDDEN_KEYS.has(key)) {
      throw new StrictJsonBoundaryError("strict_json_forbidden_key", key);
    }
    keys.add(key);
    skipWhitespace(state);
    if (state.raw[state.index] !== ":") throw new StrictJsonBoundaryError("strict_json_invalid");
    state.index += 1;
    scanValue(state, depth + 1);
    skipWhitespace(state);
    const delimiter = state.raw[state.index];
    if (delimiter === ",") {
      state.index += 1;
      continue;
    }
    if (delimiter === "}") {
      state.index += 1;
      return;
    }
    throw new StrictJsonBoundaryError("strict_json_invalid");
  }
  throw new StrictJsonBoundaryError("strict_json_invalid");
}

function scanArray(state: ScanState, depth: number) {
  state.index += 1;
  skipWhitespace(state);
  if (state.raw[state.index] === "]") {
    state.index += 1;
    return;
  }
  while (state.index < state.raw.length) {
    scanValue(state, depth + 1);
    skipWhitespace(state);
    const delimiter = state.raw[state.index];
    if (delimiter === ",") {
      state.index += 1;
      continue;
    }
    if (delimiter === "]") {
      state.index += 1;
      return;
    }
    throw new StrictJsonBoundaryError("strict_json_invalid");
  }
  throw new StrictJsonBoundaryError("strict_json_invalid");
}

function validateOptions(options: StrictJsonBoundaryOptions) {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0 || options.maxBytes > 16 * 1024 * 1024) {
    throw new StrictJsonBoundaryError("strict_json_max_bytes_invalid");
  }
  if (options.requireObject && options.requireArray) throw new StrictJsonBoundaryError("strict_json_input_type_invalid");
}

export function parseStrictJsonText<T = unknown>(raw: string, options: StrictJsonBoundaryOptions): T {
  if (typeof raw !== "string") throw new StrictJsonBoundaryError("strict_json_input_type_invalid");
  validateOptions(options);
  const byteLength = new TextEncoder().encode(raw).byteLength;
  if (byteLength > options.maxBytes) throw new StrictJsonBoundaryError("strict_json_too_large", options.maxBytes);

  const state: ScanState = {
    raw,
    index: 0,
    nodes: 0,
    maxDepth: Math.max(1, Math.min(128, options.maxDepth ?? 32)),
    maxNodes: Math.max(1, Math.min(2_000_000, options.maxNodes ?? 250_000)),
    rejectDuplicateKeys: options.rejectDuplicateKeys !== false,
    rejectDangerousKeys: options.rejectDangerousKeys !== false,
  };
  skipWhitespace(state);
  scanValue(state, 0);
  skipWhitespace(state);
  if (state.index !== raw.length) throw new StrictJsonBoundaryError("strict_json_invalid");

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new StrictJsonBoundaryError("strict_json_invalid");
  }
  if (options.requireObject && (!value || typeof value !== "object" || Array.isArray(value))) {
    throw new StrictJsonBoundaryError("strict_json_object_required");
  }
  if (options.requireArray && !Array.isArray(value)) {
    throw new StrictJsonBoundaryError("strict_json_array_required");
  }
  return value as T;
}

export function parseStrictJsonBytes<T = unknown>(bytes: Uint8Array, options: StrictJsonBoundaryOptions): T {
  if (!(bytes instanceof Uint8Array)) throw new StrictJsonBoundaryError("strict_json_input_type_invalid");
  validateOptions(options);
  if (bytes.byteLength > options.maxBytes) throw new StrictJsonBoundaryError("strict_json_too_large", options.maxBytes);
  let raw: string;
  try {
    raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new StrictJsonBoundaryError("strict_json_invalid_utf8");
  }
  return parseStrictJsonText<T>(raw, options);
}
