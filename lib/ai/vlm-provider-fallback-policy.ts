export type VlmProviderFailureKind =
  | "rate_limited"
  | "timeout"
  | "server_error"
  | "network_error"
  | "model_unavailable"
  | "invalid_response"
  | "policy_rejected"
  | "unknown";

export type VlmProviderAttemptTrace = {
  model: string;
  attempt: number;
  outcome: "success" | "failure";
  failureKind: VlmProviderFailureKind | null;
  latencyMs: number;
};

export const VLM_MAX_MODEL_CANDIDATES = 4;

export function buildVlmModelCandidates(primary: string, configuredFallbacks: string[]) {
  const candidates = [
    primary.trim(),
    ...configuredFallbacks.map((value) => value.trim()),
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
  ];
  const bounded: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    bounded.push(candidate);
    if (bounded.length === VLM_MAX_MODEL_CANDIDATES) break;
  }
  return bounded;
}

export function classifyVlmProviderFailure(error: unknown): VlmProviderFailureKind {
  const message = String(error instanceof Error ? error.message : error ?? "").toLowerCase();
  if (/404|not found|not supported|unknown model|model.*unavailable/.test(message)) return "model_unavailable";
  if (/429|rate.?limit|quota/.test(message)) return "rate_limited";
  if (/timeout|timed out|abort/.test(message)) return "timeout";
  if (/\b5\d\d\b|server error|service unavailable|bad gateway/.test(message)) return "server_error";
  if (/fetch|network|socket|econn|enotfound|dns/.test(message)) return "network_error";
  if (/schema mismatch|empty response|invalid json|unexpected token/.test(message)) return "invalid_response";
  if (/cost budget|policy|rejected/.test(message)) return "policy_rejected";
  return "unknown";
}

export function shouldRetryVlmProviderFailure(kind: VlmProviderFailureKind) {
  return kind === "rate_limited" || kind === "timeout" || kind === "server_error" || kind === "network_error";
}

export function shouldTryNextVlmModel(kind: VlmProviderFailureKind) {
  return kind === "model_unavailable" || kind === "rate_limited" || kind === "server_error" || kind === "network_error";
}
