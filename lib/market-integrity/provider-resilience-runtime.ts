import { createHash } from "node:crypto";

export type ProviderFailureKind =
  | "timeout"
  | "rate_limited"
  | "http_error"
  | "invalid_payload"
  | "network_error"
  | "concurrency_limited"
  | "circuit_open";

export type ProviderResilienceStatus =
  | "live"
  | "fresh_cache"
  | "stale_cache"
  | "failed"
  | "blocked";

export type ProviderResilienceResult<T> = {
  ok: boolean;
  status: ProviderResilienceStatus;
  value: T | null;
  providerId: string;
  cacheKey: string;
  failureKind: ProviderFailureKind | null;
  cacheAgeMs: number | null;
  cacheStoredAtMs: number | null;
  retrievedAtMs: number;
  valueSha256: string | null;
  circuitState: "closed" | "open" | "half_open";
  consecutiveFailures: number;
  sharedExecution: boolean;
  evidenceEligible: boolean;
};

type CacheEntry<T> = { value: T; storedAt: number; valueSha256: string | null };
type CircuitEntry = { consecutiveFailures: number; openedAt: number | null; halfOpenProbe: boolean };

type ExecuteArgs<T> = {
  providerId: string;
  cacheKey: string;
  execute: () => Promise<T>;
  validate: (value: T) => boolean;
  classifyError?: (error: unknown) => ProviderFailureKind;
  freshTtlMs?: number;
  staleTtlMs?: number;
  timeoutMs?: number;
  failureThreshold?: number;
  cooldownMs?: number;
  maxConcurrent?: number;
  allowStaleOnFailure?: boolean;
};

export type ProviderFallbackAttempt = {
  providerId: string;
  status: ProviderResilienceStatus;
  failureKind: ProviderFailureKind | null;
  evidenceEligible: boolean;
  cacheAgeMs: number | null;
  valueSha256: string | null;
};

export type ProviderFallbackChainResult<T> = ProviderResilienceResult<T> & {
  selectedProviderId: string | null;
  fallbackUsed: boolean;
  attempts: ProviderFallbackAttempt[];
};

function stableValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => stableValue(item, seen));
  if (typeof value === "object") {
    if (seen.has(value)) throw new Error("provider_value_cycle");
    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      output[key] = stableValue((value as Record<string, unknown>)[key], seen);
    }
    seen.delete(value);
    return output;
  }
  return String(value);
}

export function providerValueSha256(value: unknown): string | null {
  try {
    return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
  } catch {
    return null;
  }
}

export function createProviderResilienceRuntime(deps: {
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
} = {}) {
  const now = deps.now ?? Date.now;
  const setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;
  const cache = new Map<string, CacheEntry<unknown>>();
  const circuits = new Map<string, CircuitEntry>();
  const inFlight = new Map<string, Promise<ProviderResilienceResult<unknown>>>();
  const activeByProvider = new Map<string, number>();

  const circuitFor = (providerId: string) => {
    const existing = circuits.get(providerId);
    if (existing) return existing;
    const created: CircuitEntry = { consecutiveFailures: 0, openedAt: null, halfOpenProbe: false };
    circuits.set(providerId, created);
    return created;
  };

  const cacheState = <T>(key: string, freshTtlMs: number, staleTtlMs: number) => {
    const entry = cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return { entry: null, ageMs: null, fresh: false, staleUsable: false };
    const ageMs = Math.max(0, now() - entry.storedAt);
    return { entry, ageMs, fresh: ageMs <= freshTtlMs, staleUsable: ageMs <= staleTtlMs };
  };

  async function execute<T>(args: ExecuteArgs<T>): Promise<ProviderResilienceResult<T>> {
    const freshTtlMs = Math.max(1_000, args.freshTtlMs ?? 60_000);
    const staleTtlMs = Math.max(freshTtlMs, args.staleTtlMs ?? 30 * 60_000);
    const timeoutMs = Math.max(100, args.timeoutMs ?? 3_000);
    const failureThreshold = Math.max(1, args.failureThreshold ?? 3);
    const cooldownMs = Math.max(1_000, args.cooldownMs ?? 30_000);
    const maxConcurrent = Math.max(1, args.maxConcurrent ?? 6);
    const allowStale = args.allowStaleOnFailure !== false;
    const cached = cacheState<T>(args.cacheKey, freshTtlMs, staleTtlMs);
    const circuit = circuitFor(args.providerId);
    const retrievedAtMs = now();

    if (cached.fresh && cached.entry) {
      return {
        ok: true, status: "fresh_cache", value: cached.entry.value, providerId: args.providerId,
        cacheKey: args.cacheKey, failureKind: null, cacheAgeMs: cached.ageMs,
        cacheStoredAtMs: cached.entry.storedAt, retrievedAtMs, valueSha256: cached.entry.valueSha256,
        circuitState: circuit.openedAt === null ? "closed" : "open",
        consecutiveFailures: circuit.consecutiveFailures, sharedExecution: false, evidenceEligible: true,
      };
    }

    if (circuit.openedAt !== null) {
      const elapsed = now() - circuit.openedAt;
      if (elapsed < cooldownMs || circuit.halfOpenProbe) {
        if (allowStale && cached.staleUsable && cached.entry) {
          return {
            ok: true, status: "stale_cache", value: cached.entry.value, providerId: args.providerId,
            cacheKey: args.cacheKey, failureKind: "circuit_open", cacheAgeMs: cached.ageMs,
            cacheStoredAtMs: cached.entry.storedAt, retrievedAtMs, valueSha256: cached.entry.valueSha256,
            circuitState: "open", consecutiveFailures: circuit.consecutiveFailures,
            sharedExecution: false, evidenceEligible: false,
          };
        }
        return {
          ok: false, status: "blocked", value: null, providerId: args.providerId,
          cacheKey: args.cacheKey, failureKind: "circuit_open", cacheAgeMs: cached.ageMs,
          cacheStoredAtMs: cached.entry?.storedAt ?? null, retrievedAtMs,
          valueSha256: cached.entry?.valueSha256 ?? null,
          circuitState: "open", consecutiveFailures: circuit.consecutiveFailures,
          sharedExecution: false, evidenceEligible: false,
        };
      }
      circuit.halfOpenProbe = true;
    }

    const existing = inFlight.get(args.cacheKey) as Promise<ProviderResilienceResult<T>> | undefined;
    if (existing) {
      const result = await existing;
      return { ...result, sharedExecution: true, retrievedAtMs: now() };
    }

    const active = activeByProvider.get(args.providerId) ?? 0;
    if (active >= maxConcurrent) {
      if (allowStale && cached.staleUsable && cached.entry) {
        return {
          ok: true, status: "stale_cache", value: cached.entry.value, providerId: args.providerId,
          cacheKey: args.cacheKey, failureKind: "concurrency_limited", cacheAgeMs: cached.ageMs,
          cacheStoredAtMs: cached.entry.storedAt, retrievedAtMs, valueSha256: cached.entry.valueSha256,
          circuitState: circuit.openedAt === null ? "closed" : "half_open",
          consecutiveFailures: circuit.consecutiveFailures, sharedExecution: false, evidenceEligible: false,
        };
      }
      return {
        ok: false, status: "blocked", value: null, providerId: args.providerId,
        cacheKey: args.cacheKey, failureKind: "concurrency_limited", cacheAgeMs: cached.ageMs,
        cacheStoredAtMs: cached.entry?.storedAt ?? null, retrievedAtMs,
        valueSha256: cached.entry?.valueSha256 ?? null,
        circuitState: circuit.openedAt === null ? "closed" : "half_open",
        consecutiveFailures: circuit.consecutiveFailures, sharedExecution: false, evidenceEligible: false,
      };
    }

    const task = (async (): Promise<ProviderResilienceResult<T>> => {
      activeByProvider.set(args.providerId, active + 1);
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      try {
        const timeoutPromise = new Promise<T>((_, reject) => {
          timeoutHandle = setTimeoutFn(() => reject(Object.assign(new Error("provider_timeout"), { code: "ETIMEDOUT" })), timeoutMs);
        });
        const value = await Promise.race([args.execute(), timeoutPromise]);
        if (!args.validate(value)) throw Object.assign(new Error("provider_invalid_payload"), { code: "INVALID_PAYLOAD" });
        const storedAt = now();
        const valueSha256 = providerValueSha256(value);
        cache.set(args.cacheKey, { value, storedAt, valueSha256 });
        circuit.consecutiveFailures = 0;
        circuit.openedAt = null;
        circuit.halfOpenProbe = false;
        return {
          ok: true, status: "live", value, providerId: args.providerId,
          cacheKey: args.cacheKey, failureKind: null, cacheAgeMs: 0,
          cacheStoredAtMs: storedAt, retrievedAtMs: now(), valueSha256,
          circuitState: "closed", consecutiveFailures: 0, sharedExecution: false, evidenceEligible: true,
        };
      } catch (error) {
        const failureKind = args.classifyError?.(error) ?? defaultProviderFailureClassifier(error);
        circuit.consecutiveFailures += 1;
        if (circuit.consecutiveFailures >= failureThreshold) circuit.openedAt = now();
        circuit.halfOpenProbe = false;
        const fallback = cacheState<T>(args.cacheKey, freshTtlMs, staleTtlMs);
        if (allowStale && fallback.staleUsable && fallback.entry) {
          return {
            ok: true, status: "stale_cache", value: fallback.entry.value, providerId: args.providerId,
            cacheKey: args.cacheKey, failureKind, cacheAgeMs: fallback.ageMs,
            cacheStoredAtMs: fallback.entry.storedAt, retrievedAtMs: now(), valueSha256: fallback.entry.valueSha256,
            circuitState: circuit.openedAt === null ? "closed" : "open",
            consecutiveFailures: circuit.consecutiveFailures, sharedExecution: false, evidenceEligible: false,
          };
        }
        return {
          ok: false, status: "failed", value: null, providerId: args.providerId,
          cacheKey: args.cacheKey, failureKind, cacheAgeMs: fallback.ageMs,
          cacheStoredAtMs: fallback.entry?.storedAt ?? null, retrievedAtMs: now(),
          valueSha256: fallback.entry?.valueSha256 ?? null,
          circuitState: circuit.openedAt === null ? "closed" : "open",
          consecutiveFailures: circuit.consecutiveFailures, sharedExecution: false, evidenceEligible: false,
        };
      } finally {
        if (timeoutHandle) clearTimeoutFn(timeoutHandle);
        activeByProvider.set(args.providerId, Math.max(0, (activeByProvider.get(args.providerId) ?? 1) - 1));
      }
    })();

    inFlight.set(args.cacheKey, task as Promise<ProviderResilienceResult<unknown>>);
    try { return await task; } finally { inFlight.delete(args.cacheKey); }
  }

  return {
    execute,
    clear() { cache.clear(); circuits.clear(); inFlight.clear(); activeByProvider.clear(); },
    invalidate(cacheKey: string) { cache.delete(cacheKey); },
    snapshot() {
      return {
        cacheEntries: cache.size,
        inFlight: inFlight.size,
        activeByProvider: Object.fromEntries(activeByProvider),
        circuits: Object.fromEntries(Array.from(circuits.entries()).map(([key, value]) => [key, { ...value }])),
        cache: Object.fromEntries(Array.from(cache.entries()).map(([key, value]) => [key, {
          storedAt: value.storedAt,
          valueSha256: value.valueSha256,
        }])),
      };
    },
  };
}

export async function executeProviderFallbackChain<T>(args: {
  runtime: ReturnType<typeof createProviderResilienceRuntime>;
  candidates: Array<Omit<ExecuteArgs<T>, "validate"> & { validate?: (value: T) => boolean }>;
  validate: (value: T) => boolean;
  preferFreshSecondary?: boolean;
}): Promise<ProviderFallbackChainResult<T>> {
  const attempts: ProviderFallbackAttempt[] = [];
  let staleCandidate: ProviderResilienceResult<T> | null = null;
  for (const candidate of args.candidates) {
    const result = await args.runtime.execute({ ...candidate, validate: candidate.validate ?? args.validate });
    attempts.push({
      providerId: result.providerId,
      status: result.status,
      failureKind: result.failureKind,
      evidenceEligible: result.evidenceEligible,
      cacheAgeMs: result.cacheAgeMs,
      valueSha256: result.valueSha256,
    });
    if (result.ok && result.value !== null && result.evidenceEligible) {
      return { ...result, selectedProviderId: result.providerId, fallbackUsed: attempts.length > 1, attempts };
    }
    if (result.ok && result.value !== null && !staleCandidate) staleCandidate = result;
    if (result.ok && result.value !== null && !args.preferFreshSecondary) {
      return { ...result, selectedProviderId: result.providerId, fallbackUsed: attempts.length > 1, attempts };
    }
  }
  if (staleCandidate) {
    return { ...staleCandidate, selectedProviderId: staleCandidate.providerId, fallbackUsed: attempts.length > 1, attempts };
  }
  const last = attempts.at(-1);
  return {
    ok: false,
    status: last?.status ?? "failed",
    value: null,
    providerId: last?.providerId ?? "none",
    cacheKey: "none",
    failureKind: last?.failureKind ?? "network_error",
    cacheAgeMs: last?.cacheAgeMs ?? null,
    cacheStoredAtMs: null,
    retrievedAtMs: Date.now(),
    valueSha256: last?.valueSha256 ?? null,
    circuitState: "closed",
    consecutiveFailures: 0,
    sharedExecution: false,
    evidenceEligible: false,
    selectedProviderId: null,
    fallbackUsed: attempts.length > 1,
    attempts,
  };
}

export function defaultProviderFailureClassifier(error: unknown): ProviderFailureKind {
  const value = error as { code?: unknown; status?: unknown; message?: unknown } | null;
  const code = String(value?.code ?? "").toUpperCase();
  const message = String(value?.message ?? error ?? "").toLowerCase();
  const status = Number(value?.status);
  if (code === "ETIMEDOUT" || code === "ABORT_ERR" || message.includes("timeout") || message.includes("aborted")) return "timeout";
  if (status === 429 || message.includes("rate_limit") || message.includes("rate limit")) return "rate_limited";
  if (code === "INVALID_PAYLOAD" || message.includes("invalid_payload") || message.includes("provider_empty")) return "invalid_payload";
  if (Number.isFinite(status) && status >= 400) return "http_error";
  return "network_error";
}

export const realMarketsProviderResilience = createProviderResilienceRuntime();
export const searchProviderResilience = createProviderResilienceRuntime();
