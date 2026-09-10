const unsafePatterns = [
  /\bguaranteed\s+return\b/i,
  /\brisk[\s-]?free\b/i,
  /\bconfirmed\s+criminal\b/i,
  /\bproven\s+fraud\b/i,
  /\benter\s+seed\s+phrase\b/i,
];

export function sanitizeSearchInput(value: string) {
  return value
    .replace(/[<>]/g, "")
    .replace(/\b(seed phrase|private key|authorization bearer)\b/gi, "[redacted]")
    .trim()
    .slice(0, 96);
}

export function assertSearchCopyIsSafe(copy: string) {
  const hit = unsafePatterns.find((pattern) => pattern.test(copy));
  if (hit) {
    return {
      ok: false,
      reason: `Unsafe phrase pattern blocked: ${hit.source}`,
    };
  }
  return { ok: true, reason: "safe" };
}

export const velmereSearchSafetyBoundary =
  "Velmère Intelligence Search provides short research summaries, source confidence and a shortcut to Shield. It does not provide financial advice, certainty claims or accusations.";
