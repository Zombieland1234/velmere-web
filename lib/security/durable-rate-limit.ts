import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import {
  buildPass632FixedWindow,
  buildPass632RateLimitHeaders,
  buildPass632RecoveryDelay,
} from "@/lib/security/production-rate-limit-adapter";

export type DurableRateLimitMode = "memory" | "upstash_rest" | "upstash_fallback_memory" | "unavailable" | "disabled";
// PASS183 compatibility marker: upstash_ready was upgraded to upstash_rest in PASS184.
export type DurableRateLimitDecision = {
  ok: boolean;
  mode: DurableRateLimitMode;
  remaining: number;
  resetAt: number;
  limit: number;
  windowMs: number;
  fixedWindowId: number;
  boundaryKey: string;
  degraded: boolean;
  reason?: string;
  retryAfterSeconds?: number;
  provider?: "memory" | "upstash";
  providerError?: string;
};

export type DurableRateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  namespace?: string;
  /** Atomic units consumed by this decision. Provider fan-out can cost more than one unit. */
  cost?: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const memoryBuckets = new Map<string, Bucket>();
type UpstashCircuit = {
  consecutiveFailures: number;
  cooldownUntil: number;
  recoveryProbeInFlight: boolean;
};
const upstashCircuits = new Map<string, UpstashCircuit>();

function nowMs() {
  return Date.now();
}

function normalizeKey(value: string) {
  return value
    .replace(/[^a-zA-Z0-9:_@.-]/g, "_")
    .slice(0, 240);
}

function isUsableUpstashRestUrl(value: string | undefined) {
  if (!value?.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function inspectDurableRateLimitRuntime(env: NodeJS.ProcessEnv = process.env) {
  // A production deployment may be self-hosted. Durable state must remain a
  // hard requirement there too; Vercel metadata is not a security boundary.
  const productionLike = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  const disabledRequested = env.VELMERE_RATE_LIMIT_DISABLED === "1";
  const hasUpstashUrl = Boolean(env.UPSTASH_REDIS_REST_URL?.trim());
  const hasUpstashToken = Boolean(env.UPSTASH_REDIS_REST_TOKEN?.trim());
  const upstashUrlValid = isUsableUpstashRestUrl(env.UPSTASH_REDIS_REST_URL);
  const upstashConfigured = upstashUrlValid && hasUpstashToken;
  const unsupportedConfiguredSignals = [
    hasUpstashUrl && !upstashUrlValid ? "upstash_rest_url_invalid" : null,
    env.KV_REST_API_URL || env.KV_REST_API_TOKEN ? "vercel_kv_not_implemented" : null,
    env.REDIS_URL ? "redis_url_not_implemented" : null,
  ].filter((item): item is string => Boolean(item));
  const mode: DurableRateLimitMode = disabledRequested
    ? productionLike ? "unavailable" : "disabled"
    : upstashConfigured
      ? "upstash_rest"
      : productionLike ? "unavailable" : "memory";
  return {
    productionLike,
    disabledRequested,
    hasUpstashUrl,
    hasUpstashToken,
    upstashUrlValid,
    upstashConfigured,
    unsupportedConfiguredSignals,
    mode,
    exactRuntimeAdapter: mode === "upstash_rest" ? "upstash_rest_eval_incrby_pexpire" : mode,
    memoryAllowed: !productionLike,
    productionFailClosed: productionLike,
    productionConfigured: productionLike && mode === "upstash_rest",
  } as const;
}

function resolveMode(): DurableRateLimitMode {
  return inspectDurableRateLimitRuntime().mode;
}

function normalizedOptions(options: DurableRateLimitOptions) {
  const limit = Math.max(1, Math.round(options.limit));
  const windowMs = Math.max(1_000, Math.round(options.windowMs));
  const cost = Math.max(1, Math.min(100, Math.round(options.cost ?? 1)));
  const baseKey = normalizeKey(`${options.namespace ?? "velmere"}:${options.key}`);
  const fixedWindow = buildPass632FixedWindow({ key: baseKey, windowMs });
  return { limit, windowMs, cost, baseKey, fixedWindow };
}

function memoryDecision(
  options: DurableRateLimitOptions,
  mode: DurableRateLimitMode,
  providerError?: string,
): DurableRateLimitDecision {
  const normalized = normalizedOptions(options);
  const key = normalized.fixedWindow.bucketKey;
  const now = nowMs();
  const existing = memoryBuckets.get(key);
  const degraded = mode === "upstash_fallback_memory";

  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: normalized.cost, resetAt: normalized.fixedWindow.resetAt });
    const ok = normalized.cost <= normalized.limit;
    return {
      ok,
      mode,
      provider: "memory",
      remaining: Math.max(0, normalized.limit - normalized.cost),
      resetAt: normalized.fixedWindow.resetAt,
      limit: normalized.limit,
      windowMs: normalized.windowMs,
      fixedWindowId: normalized.fixedWindow.windowId,
      boundaryKey: normalized.baseKey,
      degraded,
      providerError,
      ...(!ok ? {
        retryAfterSeconds: Math.max(1, Math.ceil((normalized.fixedWindow.resetAt - now) / 1000)),
        reason: "rate_limit_exceeded",
      } : {}),
    };
  }

  existing.count += normalized.cost;
  const remaining = Math.max(0, normalized.limit - existing.count);
  if (existing.count > normalized.limit) {
    return {
      ok: false,
      mode,
      provider: "memory",
      remaining: 0,
      resetAt: existing.resetAt,
      limit: normalized.limit,
      windowMs: normalized.windowMs,
      fixedWindowId: normalized.fixedWindow.windowId,
      boundaryKey: normalized.baseKey,
      degraded,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      reason: "rate_limit_exceeded",
      providerError,
    };
  }

  return {
    ok: true,
    mode,
    provider: "memory",
    remaining,
    resetAt: existing.resetAt,
    limit: normalized.limit,
    windowMs: normalized.windowMs,
    fixedWindowId: normalized.fixedWindow.windowId,
    boundaryKey: normalized.baseKey,
    degraded,
    providerError,
  };
}

function unavailableDecision(
  options: DurableRateLimitOptions,
  providerError: string,
): DurableRateLimitDecision {
  const normalized = normalizedOptions(options);
  return {
    ok: false,
    mode: "unavailable",
    provider: "upstash",
    remaining: 0,
    resetAt: normalized.fixedWindow.resetAt,
    limit: normalized.limit,
    windowMs: normalized.windowMs,
    fixedWindowId: normalized.fixedWindow.windowId,
    boundaryKey: normalized.baseKey,
    degraded: true,
    retryAfterSeconds: Math.max(1, Math.ceil((normalized.fixedWindow.resetAt - nowMs()) / 1000)),
    reason: "rate_limit_store_unavailable",
    providerError,
  };
}

function providerFailureDecision(options: DurableRateLimitOptions, providerError: string) {
  return inspectDurableRateLimitRuntime().productionLike
    ? unavailableDecision(options, providerError)
    : memoryDecision(options, "upstash_fallback_memory", providerError);
}

function upstashCircuit(options: DurableRateLimitOptions, url: string) {
  const providerOrigin = new URL(url).origin;
  const circuitKey = normalizeKey(`${providerOrigin}:${options.namespace ?? "velmere"}`);
  let circuit = upstashCircuits.get(circuitKey);
  if (!circuit) {
    circuit = { consecutiveFailures: 0, cooldownUntil: 0, recoveryProbeInFlight: false };
    upstashCircuits.set(circuitKey, circuit);
  }
  return { circuitKey, circuit };
}

function registerUpstashFailure(circuitKey: string, circuit: UpstashCircuit) {
  circuit.consecutiveFailures = Math.min(8, circuit.consecutiveFailures + 1);
  circuit.cooldownUntil = nowMs() + buildPass632RecoveryDelay({
    key: circuitKey,
    consecutiveFailures: circuit.consecutiveFailures,
    baseDelayMs: 1_000,
    maxDelayMs: 30_000,
  });
}

function registerUpstashSuccess(circuit: UpstashCircuit) {
  circuit.consecutiveFailures = 0;
  circuit.cooldownUntil = 0;
}

function beginUpstashRecoveryProbe(circuit: UpstashCircuit) {
  if (circuit.consecutiveFailures === 0) return { ok: true as const, recoveryProbe: false };
  if (circuit.recoveryProbeInFlight) return { ok: false as const, recoveryProbe: false };
  circuit.recoveryProbeInFlight = true;
  return { ok: true as const, recoveryProbe: true };
}

function finishUpstashRecoveryProbe(circuit: UpstashCircuit, recoveryProbe: boolean) {
  if (recoveryProbe) circuit.recoveryProbeInFlight = false;
}

function legacyCircuitSummary() {
  const circuits = [...upstashCircuits.values()];
  return {
    consecutiveFailures: circuits.reduce((max, circuit) => Math.max(max, circuit.consecutiveFailures), 0),
    cooldownUntil: circuits.reduce((max, circuit) => Math.max(max, circuit.cooldownUntil), 0),
    recoveryProbesInFlight: circuits.filter((circuit) => circuit.recoveryProbeInFlight).length,
  };
}

async function upstashRestDecision(options: DurableRateLimitOptions): Promise<DurableRateLimitDecision> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return inspectDurableRateLimitRuntime().productionLike
      ? unavailableDecision(options, "upstash_configuration_missing")
      : memoryDecision(options, "memory");
  }

  const normalized = normalizedOptions(options);
  const now = nowMs();
  const { circuitKey, circuit } = upstashCircuit(options, url);
  if (now < circuit.cooldownUntil) {
    return providerFailureDecision(options, "upstash_recovery_cooldown");
  }
  const probe = beginUpstashRecoveryProbe(circuit);
  if (!probe.ok) return providerFailureDecision(options, "upstash_recovery_probe_in_progress");

  const retentionMs = normalized.windowMs + 30_000;
  const key = normalized.fixedWindow.bucketKey;
  try {
    const lua = [
      "local current = redis.call('INCRBY', KEYS[1], ARGV[2])",
      "if current == tonumber(ARGV[2]) then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
      "local ttl = redis.call('PTTL', KEYS[1])",
      "if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end",
      "return {current, ttl}",
    ].join("\n");
    const response = await brokeredConfiguredOriginFetch(url.replace(/\/$/, ""), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(["EVAL", lua, "1", key, String(retentionMs), String(normalized.cost)]),
      cache: "no-store",
    }, {
      configuredProfile: "upstash_rest",
      environment: { UPSTASH_REDIS_REST_URL: url },
      operation: "durable_rate_limit_eval",
      timeoutMs: 2_200,
      maxRequestBytes: 1_048_576,
      maxResponseBytes: 1_048_576,
    });

    if (!response.ok) {
      registerUpstashFailure(circuitKey, circuit);
      return providerFailureDecision(options, `upstash_http_${response.status}`);
    }

    const payload = await readJsonResponseBounded<{ result?: unknown; error?: string }>(
      response,
      1_048_576,
    );
    const result = Array.isArray(payload?.result) ? payload.result : [];
    const count = Number(result[0]);
    const ttlMs = Number(result[1]);
    if (payload?.error || !Number.isFinite(count) || count < 1 || !Number.isFinite(ttlMs) || ttlMs < 0) {
      registerUpstashFailure(circuitKey, circuit);
      return providerFailureDecision(options, "upstash_invalid_eval_result");
    }

    registerUpstashSuccess(circuit);
    const remaining = Math.max(0, normalized.limit - count);
    if (count > normalized.limit) {
      return {
        ok: false,
        mode: "upstash_rest",
        provider: "upstash",
        remaining: 0,
        resetAt: normalized.fixedWindow.resetAt,
        limit: normalized.limit,
        windowMs: normalized.windowMs,
        fixedWindowId: normalized.fixedWindow.windowId,
        boundaryKey: normalized.baseKey,
        degraded: false,
        retryAfterSeconds: Math.max(1, Math.ceil((normalized.fixedWindow.resetAt - now) / 1000)),
        reason: "rate_limit_exceeded",
      };
    }

    return {
      ok: true,
      mode: "upstash_rest",
      provider: "upstash",
      remaining,
      resetAt: normalized.fixedWindow.resetAt,
      limit: normalized.limit,
      windowMs: normalized.windowMs,
      fixedWindowId: normalized.fixedWindow.windowId,
      boundaryKey: normalized.baseKey,
      degraded: false,
    };
  } catch (error) {
    registerUpstashFailure(circuitKey, circuit);
    return providerFailureDecision(
      options,
      error instanceof Error ? error.message.slice(0, 120) : "upstash_unknown_error",
    );
  } finally {
    finishUpstashRecoveryProbe(circuit, probe.recoveryProbe);
  }
}

export async function applyDurableRateLimit(options: DurableRateLimitOptions): Promise<DurableRateLimitDecision> {
  const mode = resolveMode();
  const normalized = normalizedOptions(options);

  if (mode === "disabled") {
    return {
      ok: true,
      mode,
      remaining: Math.max(0, normalized.limit - normalized.cost),
      resetAt: normalized.fixedWindow.resetAt,
      limit: normalized.limit,
      windowMs: normalized.windowMs,
      fixedWindowId: normalized.fixedWindow.windowId,
      boundaryKey: normalized.baseKey,
      degraded: false,
    };
  }

  if (mode === "unavailable") {
    const runtime = inspectDurableRateLimitRuntime();
    return unavailableDecision(
      options,
      runtime.disabledRequested ? "rate_limit_disabled_in_production" : "upstash_configuration_missing",
    );
  }
  if (mode === "upstash_rest") return upstashRestDecision(options);
  return memoryDecision(options, "memory");
}

export function buildDurableRateLimitHeaders(decision: DurableRateLimitDecision) {
  return buildPass632RateLimitHeaders({
    limit: decision.limit,
    remaining: decision.remaining,
    resetAt: decision.resetAt,
    retryAfterSeconds: decision.ok ? undefined : decision.retryAfterSeconds,
    mode: decision.mode,
    degraded: decision.degraded,
  });
}

export function buildDurableRateLimitReadiness() {
  const runtime = inspectDurableRateLimitRuntime();
  const mode = runtime.mode;
  const circuit = legacyCircuitSummary();
  return {
    schemaVersion: "velmere-durable-rate-limit-readiness-v4-pass4824",
    mode,
    hasUpstashUrl: runtime.hasUpstashUrl,
    hasUpstashToken: runtime.hasUpstashToken,
    upstashUrlValid: runtime.upstashUrlValid,
    configuredAdapter: runtime.upstashConfigured ? "upstash_rest" : null,
    exactRuntimeAdapter: runtime.exactRuntimeAdapter,
    productionConfigured: runtime.productionConfigured,
    productionFailClosed: runtime.productionFailClosed,
    memoryFallback: runtime.memoryAllowed,
    unsupportedConfiguredSignals: runtime.unsupportedConfiguredSignals,
    upstashRestAdapter: "implemented",
    fixedWindowBuckets: true,
    retryAfterHeaders: true,
    recoveryCooldown: true,
    isolatedFailureDomains: true,
    singleRecoveryProbe: true,
    circuitCount: upstashCircuits.size,
    recoveryProbesInFlight: circuit.recoveryProbesInFlight,
    consecutiveProviderFailures: circuit.consecutiveFailures,
    providerCooldownUntil: circuit.cooldownUntil ? new Date(circuit.cooldownUntil).toISOString() : null,
    fallbackMode: runtime.memoryAllowed ? "non_production_memory_only" : "production_fail_closed",
    productionBoundary:
      "PASS4824 accepts only the implemented Upstash REST EVAL/INCRBY adapter as distributed-ready. Missing or failed durable state is fail-closed in production; memory is non-production only.",
  };
}
