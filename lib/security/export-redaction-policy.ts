import { sha256Token } from "@/lib/security/cryptographic-digest";
export const PASS635_REDACTION_VERSION = "pass635-central-export-redaction-policy" as const;

export type Pass635RedactionSurface = "pdf" | "reader" | "log" | "receipt" | "security_export";
export type Pass635RedactionReceipt = {
  version: typeof PASS635_REDACTION_VERSION;
  receiptId: string;
  surface: Pass635RedactionSurface;
  removedPaths: string[];
  maskedPaths: string[];
  leakMatches: string[];
  leakCount: number;
  state: "clean" | "blocked";
  generatedAt: string;
};

const DROP_KEY = /(?:^|_)(?:password|passwd|secret|private[_-]?key|seed|mnemonic|recovery[_-]?phrase|api[_-]?key|authorization|cookie|set[_-]?cookie|prompt|system[_-]?instruction|hidden[_-]?weight|internal[_-]?weight|raw[_-]?ip|access[_-]?token|refresh[_-]?token)(?:$|_)/i;
const MASK_KEY = /(?:email|wallet[_-]?address|actor[_-]?id|user[_-]?id|session[_-]?id|client[_-]?fingerprint)/i;
const LEAK_PATTERNS: Array<[string, RegExp]> = [
  ["bearer_token", /bearer\s+[a-z0-9._~+/-]{12,}/i],
  ["private_key_value", /(?:private[_ -]?key|secret[_ -]?key)\s*[":=]+\s*["']?(?:0x)?[a-f0-9]{64}|-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/i],
  ["seed_phrase_value", /(?:seed[_ -]?phrase|recovery[_ -]?phrase|mnemonic)\s*[":=]+\s*["']?[a-z]+(?:\s+[a-z]+){7,}/i],
  ["secret_assignment", /(?:api[_-]?key|secret|token)\s*[:=]\s*["']?[a-z0-9._~+/-]{12,}/i],
  ["raw_prompt_value", /(?:system[_ -]?prompt|developer[_ -]?message|hidden[_ -]?instruction)\s*[":=]+\s*["']?[^,}]{16,}/i],
];

function hash(value: string) {
  return sha256Token(value, 24);
}

function mask(value: unknown) {
  const text = String(value ?? "");
  if (!text) return "[masked]";
  return `[masked:${hash(text)}]`;
}

function walk(value: unknown, path: string, removedPaths: string[], maskedPaths: string[], seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.slice(0, 20_000);
  if (typeof value !== "object") return value;
  if (seen.has(value as object)) return "[circular]";
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.slice(0, 500).map((item, index) => walk(item, `${path}[${index}]`, removedPaths, maskedPaths, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    if (DROP_KEY.test(key)) {
      removedPaths.push(childPath);
      continue;
    }
    if (MASK_KEY.test(key) && child !== null && child !== undefined && child !== "") {
      maskedPaths.push(childPath);
      output[key] = mask(child);
      continue;
    }
    output[key] = walk(child, childPath, removedPaths, maskedPaths, seen);
  }
  return output;
}

export function detectPass635Leaks(value: unknown) {
  let serialized = "";
  try {
    serialized = JSON.stringify(value);
  } catch {
    serialized = String(value);
  }
  return LEAK_PATTERNS.filter(([, pattern]) => pattern.test(serialized)).map(([id]) => id);
}

export function applyPass635ExportRedaction<T>(input: {
  surface: Pass635RedactionSurface;
  payload: T;
  generatedAt?: string;
}): { payload: unknown; receipt: Pass635RedactionReceipt } {
  const removedPaths: string[] = [];
  const maskedPaths: string[] = [];
  const generatedAt = input.generatedAt && Number.isFinite(Date.parse(input.generatedAt))
    ? new Date(input.generatedAt).toISOString()
    : new Date().toISOString();
  const redacted = walk(input.payload, "", removedPaths, maskedPaths, new WeakSet<object>());
  const leakMatches = detectPass635Leaks(redacted);
  const receiptId = `redact_${hash(`${input.surface}:${generatedAt}:${removedPaths.join(",")}:${maskedPaths.join(",")}`)}`;
  const receipt: Pass635RedactionReceipt = {
    version: PASS635_REDACTION_VERSION,
    receiptId,
    surface: input.surface,
    removedPaths: Array.from(new Set(removedPaths)).sort(),
    maskedPaths: Array.from(new Set(maskedPaths)).sort(),
    leakMatches,
    leakCount: leakMatches.length,
    state: leakMatches.length === 0 ? "clean" : "blocked",
    generatedAt,
  };
  return { payload: redacted, receipt };
}
