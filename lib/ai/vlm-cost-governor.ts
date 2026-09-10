type CostWindow = { startedAt: number; requests: number; estimatedTokens: number };
const windows = new Map<string, CostWindow>();
const WINDOW_MS = 60_000;
const GLOBAL_PROVIDER_WINDOW = "provider:global";

export type VlmCostDecision = {
  allowed: boolean;
  reason?: string;
  estimatedPromptTokens: number;
  maxOutputTokens: number;
};

export class VlmCostGovernorExhaustedError extends Error {
  readonly code = "vlm_provider_cost_budget_exhausted";
  readonly decision: VlmCostDecision;

  constructor(decision: VlmCostDecision) {
    super(decision.reason ?? "Provider cost budget exhausted");
    this.name = "VlmCostGovernorExhaustedError";
    this.decision = decision;
  }
}

function positiveNumber(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function estimateVlmTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function checkVlmCostGovernor(input: {
  namespace: string;
  prompt: string;
  requestedOutputTokens: number;
}): VlmCostDecision {
  const now = Date.now();
  const maxPromptTokens = positiveNumber(process.env.VELMERE_GEMINI_MAX_PROMPT_TOKENS, 8_000);
  const maxOutputTokens = Math.min(4_000, positiveNumber(process.env.VELMERE_GEMINI_MAX_OUTPUT_TOKENS, 3_600));
  const maxRequestsPerMinute = positiveNumber(process.env.VELMERE_GEMINI_MAX_REQUESTS_PER_MINUTE, 90);
  const maxTokensPerMinute = positiveNumber(process.env.VELMERE_GEMINI_MAX_TOKENS_PER_MINUTE, 600_000);
  const estimatedPromptTokens = estimateVlmTokens(input.prompt);
  const outputTokens = Math.min(input.requestedOutputTokens, maxOutputTokens);

  if (estimatedPromptTokens > maxPromptTokens) {
    return {
      allowed: false,
      reason: "Provider cost budget exhausted: prompt token limit",
      estimatedPromptTokens,
      maxOutputTokens: outputTokens,
    };
  }

  const namespaceWindow = `provider:namespace:${input.namespace}`;
  const windowKeys = Array.from(new Set([GLOBAL_PROVIDER_WINDOW, namespaceWindow]));
  const activeWindows = windowKeys.map((key) => {
    const current = windows.get(key);
    return {
      key,
      window: !current || now - current.startedAt >= WINDOW_MS
        ? { startedAt: now, requests: 0, estimatedTokens: 0 }
        : current,
    };
  });
  for (const { key, window } of activeWindows) {
    const scope = key === GLOBAL_PROVIDER_WINDOW ? "global" : "namespace";
    if (window.requests >= maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: `Provider cost budget exhausted: ${scope} request limit`,
        estimatedPromptTokens,
        maxOutputTokens: outputTokens,
      };
    }
    if (window.estimatedTokens + estimatedPromptTokens + outputTokens > maxTokensPerMinute) {
      return {
        allowed: false,
        reason: `Provider cost budget exhausted: ${scope} token limit`,
        estimatedPromptTokens,
        maxOutputTokens: outputTokens,
      };
    }
  }

  for (const { key, window } of activeWindows) {
    window.requests += 1;
    window.estimatedTokens += estimatedPromptTokens + outputTokens;
    windows.set(key, window);
  }
  return { allowed: true, estimatedPromptTokens, maxOutputTokens: outputTokens };
}

export async function withVlmProviderCostGovernor<T>(
  input: {
    namespace: string;
    prompt: string;
    requestedOutputTokens: number;
  },
  dispatch: (decision: VlmCostDecision) => Promise<T>,
): Promise<T> {
  const decision = checkVlmCostGovernor(input);
  if (!decision.allowed) throw new VlmCostGovernorExhaustedError(decision);
  return dispatch(decision);
}

export function getVlmCostGovernorStats() {
  const now = Date.now();
  for (const [key, value] of windows) if (now - value.startedAt >= WINDOW_MS) windows.delete(key);
  return Array.from(windows.entries()).map(([namespace, value]) => ({ namespace, ...value }));
}

export function resetVlmCostGovernorForTests() {
  if (process.env.NODE_ENV !== "test") throw new Error("vlm_cost_governor_reset_test_only");
  windows.clear();
}
