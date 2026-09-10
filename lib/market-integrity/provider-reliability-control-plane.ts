import { createHash } from "node:crypto";
import { canonicalJson } from "../security/canonical-json";

export const PASS4801_PROVIDER_RELIABILITY_CONTROL_PLANE_ID = "pass4801-provider-reliability-control-plane-v1" as const;

export type ProviderReliabilityFailureKind =
  | "timeout"
  | "rate_limited"
  | "quota_limited"
  | "http_error"
  | "invalid_payload"
  | "schema_drift"
  | "network_error"
  | "concurrency_limited"
  | "circuit_open"
  | "shared_state_unavailable";

export type ProviderReliabilityState = "live" | "fresh_cache" | "stale_cache" | "failed" | "blocked";
export type ProviderCircuitState = "closed" | "open" | "half_open";
export type ProviderSchemaState = "baseline" | "stable" | "drift" | "unavailable";


export type ProviderDistributedAttemptAdmission = {
  allowed: boolean;
  failureKind: ProviderReliabilityFailureKind | null;
  mode: "memory" | "durable" | "unavailable";
  leaseId: string | null;
  circuitState: ProviderCircuitState;
  consecutiveFailures: number;
  stateVersion: number;
  quota: { limit: number; remaining: number; resetAtMs: number };
  blockers: string[];
};

export type ProviderDistributedAttemptSettlement = {
  settled: boolean;
  mode: "memory" | "durable" | "unavailable";
  stateVersion: number;
  circuitState: ProviderCircuitState;
  consecutiveFailures: number;
  blockers: string[];
};

export type ProviderDistributedStateReceipt = {
  mode: ProviderDistributedAttemptAdmission["mode"];
  admitted: boolean;
  settled: boolean;
  stateVersion: number;
  circuitState: ProviderCircuitState;
  consecutiveFailures: number;
  quota: { limit: number; remaining: number; resetAtMs: number };
  blockers: string[];
};

export type ProviderAttemptReceipt = {
  attempt: number;
  startedAtMs: number;
  endedAtMs: number;
  latencyMs: number;
  failureKind: ProviderReliabilityFailureKind | null;
  retryDelayMs: number;
};

export type ProviderReliabilityReceipt = {
  schemaVersion: typeof PASS4801_PROVIDER_RELIABILITY_CONTROL_PLANE_ID;
  providerId: string;
  endpointId: string;
  cacheKey: string;
  state: ProviderReliabilityState;
  failureKind: ProviderReliabilityFailureKind | null;
  circuitState: ProviderCircuitState;
  consecutiveFailures: number;
  attemptCount: number;
  attempts: ProviderAttemptReceipt[];
  sharedExecution: boolean;
  evidenceEligible: boolean;
  cacheAgeMs: number | null;
  payloadDigest: string | null;
  schemaFingerprint: string | null;
  schemaState: ProviderSchemaState;
  quota: {
    limit: number;
    remaining: number;
    resetAtMs: number;
  };
  distributedState: ProviderDistributedStateReceipt | null;
  observedAtMs: number;
  completedAtMs: number;
  totalLatencyMs: number;
  blockers: string[];
};

export type ProviderReliabilityResult<T> = {
  ok: boolean;
  value: T | null;
  receipt: ProviderReliabilityReceipt;
};

export type ProviderAvailabilityLedgerEntry = {
  schemaVersion: typeof PASS4801_PROVIDER_RELIABILITY_CONTROL_PLANE_ID;
  providerId: string;
  endpointId: string;
  sequence: number;
  previousHash: string | null;
  entryHash: string;
  state: ProviderReliabilityState;
  failureKind: ProviderReliabilityFailureKind | null;
  evidenceEligible: boolean;
  attemptCount: number;
  latencyMs: number;
  payloadDigest: string | null;
  schemaFingerprint: string | null;
  observedAtMs: number;
};

export type ProviderAvailabilityLedgerSnapshot = {
  schemaVersion: typeof PASS4801_PROVIDER_RELIABILITY_CONTROL_PLANE_ID;
  providerId: string;
  endpointId: string;
  anchorSequence: number;
  anchorHash: string | null;
  entryCount: number;
  headHash: string | null;
  successRate: number;
  liveRate: number;
  cacheRate: number;
  p95LatencyMs: number | null;
  entries: ProviderAvailabilityLedgerEntry[];
};

type ProviderPolicy = {
  freshTtlMs?: number;
  staleTtlMs?: number;
  timeoutMs?: number;
  maxConcurrent?: number;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  retryJitterRatio?: number;
  failureThreshold?: number;
  cooldownMs?: number;
  quotaLimit?: number;
  quotaWindowMs?: number;
  allowStaleOnFailure?: boolean;
  rejectSchemaDrift?: boolean;
};

type ExecuteArgs<T> = {
  providerId: string;
  endpointId: string;
  cacheKey: string;
  execute: (signal: AbortSignal) => Promise<T>;
  validate: (value: T) => boolean;
  schemaProjection?: (value: T) => unknown;
  classifyError?: (error: unknown) => ProviderReliabilityFailureKind;
  policy?: ProviderPolicy;
};

type CacheEntry<T> = {
  value: T;
  storedAtMs: number;
  payloadDigest: string;
  schemaFingerprint: string;
  schemaState: Exclude<ProviderSchemaState, "unavailable">;
};

type CircuitEntry = {
  consecutiveFailures: number;
  openedAtMs: number | null;
  halfOpenProbe: boolean;
};

type QuotaEntry = {
  windowStartedAtMs: number;
  used: number;
};

type SchemaEntry = {
  fingerprint: string;
  firstSeenAtMs: number;
  lastSeenAtMs: number;
  driftCount: number;
};

type AvailabilityState = {
  anchorSequence: number;
  anchorHash: string | null;
  nextSequence: number;
  entries: ProviderAvailabilityLedgerEntry[];
};

const MAX_AVAILABILITY_ENTRIES = 720;

function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function safeId(value: string, max = 120) {
  return value.trim().toLowerCase().replace(/[^a-z0-9:._/-]+/g, "-").replace(/-+/g, "-").slice(0, max) || "unknown";
}

function stableShape(value: unknown, depth = 0): unknown {
  if (depth > 8) return "depth_limit";
  if (value === null) return "null";
  if (Array.isArray(value)) {
    const sample = value.slice(0, 5).map((item) => stableShape(item, depth + 1));
    return { type: "array", sample };
  }
  const type = typeof value;
  if (type !== "object") return type;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, stableShape(record[key], depth + 1)]));
}

export function providerSchemaFingerprint(value: unknown) {
  return sha256(canonicalJson(stableShape(value)));
}

export function providerPayloadDigest(value: unknown) {
  return sha256(canonicalJson(value));
}

function endpointKey(providerId: string, endpointId: string) {
  return `${safeId(providerId)}::${safeId(endpointId)}`;
}

function executionKey(providerId: string, endpointId: string, cacheKey: string) {
  return `${endpointKey(providerId, endpointId)}::${sha256(cacheKey.trim())}`;
}

function classifyDefault(error: unknown): ProviderReliabilityFailureKind {
  const value = error as { code?: unknown; status?: unknown; message?: unknown; name?: unknown } | null;
  const code = String(value?.code ?? "").toUpperCase();
  const name = String(value?.name ?? "").toUpperCase();
  const message = String(value?.message ?? error ?? "").toLowerCase();
  const status = Number(value?.status);
  if (code === "ETIMEDOUT" || name === "ABORTERROR" || message.includes("timeout") || message.includes("aborted")) return "timeout";
  if (status === 429 || message.includes("rate_limit") || message.includes("rate limit")) return "rate_limited";
  if (code === "INVALID_PAYLOAD" || message.includes("invalid_payload")) return "invalid_payload";
  if (code === "SCHEMA_DRIFT" || message.includes("schema_drift")) return "schema_drift";
  if (Number.isFinite(status) && status >= 400) return "http_error";
  return "network_error";
}

function retryable(kind: ProviderReliabilityFailureKind) {
  return kind === "timeout" || kind === "rate_limited" || kind === "http_error" || kind === "network_error";
}

function percentile95(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? null;
}

export function verifyProviderAvailabilityLedger(snapshot: ProviderAvailabilityLedgerSnapshot) {
  const blockers: string[] = [];
  let previousHash: string | null = snapshot.anchorHash;
  let expectedSequence = snapshot.anchorSequence + 1;
  for (const entry of snapshot.entries) {
    if (entry.providerId !== snapshot.providerId || entry.endpointId !== snapshot.endpointId) blockers.push(`identity_mismatch:${entry.sequence}`);
    if (entry.sequence !== expectedSequence) blockers.push(`sequence_mismatch:${entry.sequence}/${expectedSequence}`);
    if (entry.previousHash !== previousHash) blockers.push(`previous_hash_mismatch:${entry.sequence}`);
    const { entryHash, ...unsigned } = entry;
    if (sha256(canonicalJson(unsigned)) !== entryHash) blockers.push(`entry_hash_mismatch:${entry.sequence}`);
    previousHash = entryHash;
    expectedSequence += 1;
  }
  if ((snapshot.entries.at(-1)?.entryHash ?? null) !== snapshot.headHash) blockers.push("head_hash_mismatch");
  if (snapshot.entryCount !== snapshot.entries.length) blockers.push("entry_count_mismatch");
  return { valid: blockers.length === 0, blockers } as const;
}

export function createProviderReliabilityControlPlane(deps: {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  beforeAttempt?: (input: {
    providerId: string;
    endpointId: string;
    cacheKey: string;
    attempt: number;
    quotaLimit: number;
    quotaWindowMs: number;
    cooldownMs: number;
    timeoutMs: number;
  }) => Promise<ProviderDistributedAttemptAdmission>;
  afterAttempt?: (input: {
    admission: ProviderDistributedAttemptAdmission;
    success: boolean;
    failureKind: ProviderReliabilityFailureKind | null;
    failureThreshold: number;
  }) => Promise<ProviderDistributedAttemptSettlement>;
} = {}) {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = deps.random ?? Math.random;
  const cache = new Map<string, CacheEntry<unknown>>();
  const inFlight = new Map<string, Promise<ProviderReliabilityResult<unknown>>>();
  const circuits = new Map<string, CircuitEntry>();
  const quotas = new Map<string, QuotaEntry>();
  const schemas = new Map<string, SchemaEntry>();
  const availability = new Map<string, AvailabilityState>();
  const activeByEndpoint = new Map<string, number>();

  function circuitFor(key: string) {
    const existing = circuits.get(key);
    if (existing) return existing;
    const created: CircuitEntry = { consecutiveFailures: 0, openedAtMs: null, halfOpenProbe: false };
    circuits.set(key, created);
    return created;
  }

  function quotaSnapshot(key: string, limit: number, windowMs: number, consume = false) {
    const currentTime = now();
    let quota = quotas.get(key);
    if (!quota || currentTime - quota.windowStartedAtMs >= windowMs) {
      quota = { windowStartedAtMs: currentTime, used: 0 };
      quotas.set(key, quota);
    }
    if (consume && quota.used < limit) quota.used += 1;
    return {
      allowed: quota.used < limit || (consume && quota.used <= limit),
      limit,
      remaining: Math.max(0, limit - quota.used),
      resetAtMs: quota.windowStartedAtMs + windowMs,
    };
  }

  function appendAvailability(receipt: ProviderReliabilityReceipt) {
    const key = endpointKey(receipt.providerId, receipt.endpointId);
    const state = availability.get(key) ?? { anchorSequence: 0, anchorHash: null, nextSequence: 1, entries: [] };
    const previousHash = state.entries.at(-1)?.entryHash ?? null;
    const unsigned = {
      schemaVersion: PASS4801_PROVIDER_RELIABILITY_CONTROL_PLANE_ID,
      providerId: receipt.providerId,
      endpointId: receipt.endpointId,
      sequence: state.nextSequence,
      previousHash,
      state: receipt.state,
      failureKind: receipt.failureKind,
      evidenceEligible: receipt.evidenceEligible,
      attemptCount: receipt.attemptCount,
      latencyMs: receipt.totalLatencyMs,
      payloadDigest: receipt.payloadDigest,
      schemaFingerprint: receipt.schemaFingerprint,
      observedAtMs: receipt.completedAtMs,
    } satisfies Omit<ProviderAvailabilityLedgerEntry, "entryHash">;
    const entry: ProviderAvailabilityLedgerEntry = { ...unsigned, entryHash: sha256(canonicalJson(unsigned)) };
    state.nextSequence += 1;
    state.entries.push(entry);
    if (state.entries.length > MAX_AVAILABILITY_ENTRIES) {
      const removeCount = state.entries.length - MAX_AVAILABILITY_ENTRIES;
      const removed = state.entries.splice(0, removeCount);
      const anchor = removed.at(-1);
      if (anchor) {
        state.anchorSequence = anchor.sequence;
        state.anchorHash = anchor.entryHash;
      }
    }
    availability.set(key, state);
  }

  function buildReceipt(args: {
    providerId: string;
    endpointId: string;
    cacheKey: string;
    state: ProviderReliabilityState;
    failureKind?: ProviderReliabilityFailureKind | null;
    circuit: CircuitEntry;
    attempts?: ProviderAttemptReceipt[];
    sharedExecution?: boolean;
    evidenceEligible?: boolean;
    cacheAgeMs?: number | null;
    payloadDigest?: string | null;
    schemaFingerprint?: string | null;
    schemaState?: ProviderSchemaState;
    quota: { limit: number; remaining: number; resetAtMs: number };
    distributedState?: ProviderDistributedStateReceipt | null;
    observedAtMs: number;
    completedAtMs?: number;
    blockers?: string[];
  }): ProviderReliabilityReceipt {
    const completedAtMs = args.completedAtMs ?? now();
    return {
      schemaVersion: PASS4801_PROVIDER_RELIABILITY_CONTROL_PLANE_ID,
      providerId: safeId(args.providerId),
      endpointId: safeId(args.endpointId),
      cacheKey: safeId(args.cacheKey, 220),
      state: args.state,
      failureKind: args.failureKind ?? null,
      circuitState: args.circuit.openedAtMs === null ? "closed" : args.circuit.halfOpenProbe ? "half_open" : "open",
      consecutiveFailures: args.circuit.consecutiveFailures,
      attemptCount: args.attempts?.length ?? 0,
      attempts: args.attempts ?? [],
      sharedExecution: args.sharedExecution ?? false,
      evidenceEligible: args.evidenceEligible ?? false,
      cacheAgeMs: args.cacheAgeMs ?? null,
      payloadDigest: args.payloadDigest ?? null,
      schemaFingerprint: args.schemaFingerprint ?? null,
      schemaState: args.schemaState ?? "unavailable",
      quota: args.quota,
      distributedState: args.distributedState ?? null,
      observedAtMs: args.observedAtMs,
      completedAtMs,
      totalLatencyMs: Math.max(0, completedAtMs - args.observedAtMs),
      blockers: Array.from(new Set(args.blockers ?? [])).sort(),
    };
  }

  async function execute<T>(args: ExecuteArgs<T>): Promise<ProviderReliabilityResult<T>> {
    const providerId = safeId(args.providerId);
    const endpointId = safeId(args.endpointId);
    const key = endpointKey(providerId, endpointId);
    const requestKey = executionKey(providerId, endpointId, args.cacheKey);
    const freshTtlMs = Math.max(250, args.policy?.freshTtlMs ?? 10_000);
    const policy = {
      freshTtlMs,
      staleTtlMs: Math.max(freshTtlMs, args.policy?.staleTtlMs ?? 120_000),
      timeoutMs: Math.max(100, args.policy?.timeoutMs ?? 4_000),
      maxConcurrent: Math.max(1, args.policy?.maxConcurrent ?? 6),
      maxAttempts: Math.max(1, Math.min(5, args.policy?.maxAttempts ?? 3)),
      retryBaseDelayMs: Math.max(0, args.policy?.retryBaseDelayMs ?? 120),
      retryMaxDelayMs: Math.max(0, args.policy?.retryMaxDelayMs ?? 1_500),
      retryJitterRatio: Math.max(0, Math.min(1, args.policy?.retryJitterRatio ?? 0.25)),
      failureThreshold: Math.max(1, args.policy?.failureThreshold ?? 3),
      cooldownMs: Math.max(500, args.policy?.cooldownMs ?? 30_000),
      quotaLimit: Math.max(1, args.policy?.quotaLimit ?? 120),
      quotaWindowMs: Math.max(1_000, args.policy?.quotaWindowMs ?? 60_000),
      allowStaleOnFailure: args.policy?.allowStaleOnFailure !== false,
      rejectSchemaDrift: args.policy?.rejectSchemaDrift !== false,
    };
    const observedAtMs = now();
    const circuit = circuitFor(key);
    const cached = cache.get(requestKey) as CacheEntry<T> | undefined;
    const cacheAgeMs = cached ? Math.max(0, observedAtMs - cached.storedAtMs) : null;
    const quota = quotaSnapshot(key, policy.quotaLimit, policy.quotaWindowMs);

    if (cached && cacheAgeMs !== null && cacheAgeMs <= policy.freshTtlMs) {
      const drifted = cached.schemaState === "drift";
      const receipt = buildReceipt({ providerId, endpointId, cacheKey: args.cacheKey, state: "fresh_cache", circuit, evidenceEligible: !drifted, cacheAgeMs, payloadDigest: cached.payloadDigest, schemaFingerprint: cached.schemaFingerprint, schemaState: cached.schemaState, quota, observedAtMs, blockers: drifted ? ["cached_schema_drift_not_evidence_eligible"] : [] });
      appendAvailability(receipt);
      return { ok: true, value: cached.value, receipt };
    }

    if (circuit.openedAtMs !== null) {
      const elapsed = observedAtMs - circuit.openedAtMs;
      if (elapsed < policy.cooldownMs || circuit.halfOpenProbe) {
        if (policy.allowStaleOnFailure && cached && cacheAgeMs !== null && cacheAgeMs <= policy.staleTtlMs) {
          const receipt = buildReceipt({ providerId, endpointId, cacheKey: args.cacheKey, state: "stale_cache", failureKind: "circuit_open", circuit, evidenceEligible: false, cacheAgeMs, payloadDigest: cached.payloadDigest, schemaFingerprint: cached.schemaFingerprint, schemaState: cached.schemaState, quota, observedAtMs, blockers: ["circuit_open_stale_evidence_only"] });
          appendAvailability(receipt);
          return { ok: true, value: cached.value, receipt };
        }
        const receipt = buildReceipt({ providerId, endpointId, cacheKey: args.cacheKey, state: "blocked", failureKind: "circuit_open", circuit, quota, observedAtMs, blockers: ["provider_circuit_open"] });
        appendAvailability(receipt);
        return { ok: false, value: null, receipt };
      }
      circuit.halfOpenProbe = true;
    }
    const halfOpenProbeAcquired = circuit.openedAtMs !== null && circuit.halfOpenProbe;

    const shared = inFlight.get(requestKey) as Promise<ProviderReliabilityResult<T>> | undefined;
    if (shared) {
      const result = await shared;
      return { ...result, receipt: { ...result.receipt, sharedExecution: true } };
    }

    const active = activeByEndpoint.get(key) ?? 0;
    if (active >= policy.maxConcurrent) {
      if (policy.allowStaleOnFailure && cached && cacheAgeMs !== null && cacheAgeMs <= policy.staleTtlMs) {
        if (halfOpenProbeAcquired) circuit.halfOpenProbe = false;
        const receipt = buildReceipt({ providerId, endpointId, cacheKey: args.cacheKey, state: "stale_cache", failureKind: "concurrency_limited", circuit, evidenceEligible: false, cacheAgeMs, payloadDigest: cached.payloadDigest, schemaFingerprint: cached.schemaFingerprint, schemaState: cached.schemaState, quota, observedAtMs, blockers: ["provider_concurrency_limited"] });
        appendAvailability(receipt);
        return { ok: true, value: cached.value, receipt };
      }
      if (halfOpenProbeAcquired) circuit.halfOpenProbe = false;
      const receipt = buildReceipt({ providerId, endpointId, cacheKey: args.cacheKey, state: "blocked", failureKind: "concurrency_limited", circuit, quota, observedAtMs, blockers: ["provider_concurrency_limited"] });
      appendAvailability(receipt);
      return { ok: false, value: null, receipt };
    }

    const task = (async (): Promise<ProviderReliabilityResult<T>> => {
      activeByEndpoint.set(key, active + 1);
      const attempts: ProviderAttemptReceipt[] = [];
      const distributedBlockers = new Set<string>();
      let distributedState: ProviderDistributedStateReceipt | null = null;
      let finalFailure: ProviderReliabilityFailureKind = "network_error";
      let quotaState: { limit: number; remaining: number; resetAtMs: number } = quota;

      const applyDistributedState = (
        admission: ProviderDistributedAttemptAdmission,
        settlement?: ProviderDistributedAttemptSettlement | null,
      ) => {
        for (const blocker of admission.blockers) distributedBlockers.add(blocker);
        for (const blocker of settlement?.blockers ?? []) distributedBlockers.add(blocker);
        distributedState = {
          mode: settlement?.mode ?? admission.mode,
          admitted: admission.allowed,
          settled: settlement?.settled ?? false,
          stateVersion: settlement?.stateVersion ?? admission.stateVersion,
          circuitState: settlement?.circuitState ?? admission.circuitState,
          consecutiveFailures: settlement?.consecutiveFailures ?? admission.consecutiveFailures,
          quota: admission.quota,
          blockers: Array.from(distributedBlockers).sort(),
        };
        quotaState = admission.quota;
      };

      try {
        for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
          const beforeConsume = quotaSnapshot(key, policy.quotaLimit, policy.quotaWindowMs);
          if (beforeConsume.remaining <= 0) {
            finalFailure = "quota_limited";
            break;
          }

          let admission: ProviderDistributedAttemptAdmission | null = null;
          if (deps.beforeAttempt) {
            try {
              admission = await deps.beforeAttempt({
                providerId,
                endpointId,
                cacheKey: requestKey,
                attempt,
                quotaLimit: policy.quotaLimit,
                quotaWindowMs: policy.quotaWindowMs,
                cooldownMs: policy.cooldownMs,
                timeoutMs: policy.timeoutMs,
              });
            } catch {
              admission = {
                allowed: false,
                failureKind: "shared_state_unavailable",
                mode: "unavailable",
                leaseId: null,
                circuitState: "open",
                consecutiveFailures: 0,
                stateVersion: 0,
                quota: { limit: policy.quotaLimit, remaining: 0, resetAtMs: now() + policy.quotaWindowMs },
                blockers: ["provider_shared_state_acquire_failed"],
              };
            }
            applyDistributedState(admission);
            if (!admission.allowed) {
              finalFailure = admission.failureKind ?? "shared_state_unavailable";
              break;
            }
          }

          quotaState = admission?.quota ?? quotaSnapshot(key, policy.quotaLimit, policy.quotaWindowMs, true);
          if (admission) quotaSnapshot(key, policy.quotaLimit, policy.quotaWindowMs, true);
          const startedAtMs = now();
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(Object.assign(new Error("provider_timeout"), { code: "ETIMEDOUT" })), policy.timeoutMs);
          let failureKind: ProviderReliabilityFailureKind | null = null;
          try {
            const value = await args.execute(controller.signal);
            if (!args.validate(value)) throw Object.assign(new Error("provider_invalid_payload"), { code: "INVALID_PAYLOAD" });
            const projected = args.schemaProjection ? args.schemaProjection(value) : value;
            const fingerprint = providerSchemaFingerprint(projected);
            const knownSchema = schemas.get(key);
            let schemaState: ProviderSchemaState = "baseline";
            if (!knownSchema) {
              schemas.set(key, { fingerprint, firstSeenAtMs: now(), lastSeenAtMs: now(), driftCount: 0 });
            } else if (knownSchema.fingerprint === fingerprint) {
              knownSchema.lastSeenAtMs = now();
              schemaState = "stable";
            } else {
              knownSchema.driftCount += 1;
              knownSchema.lastSeenAtMs = now();
              schemaState = "drift";
              if (policy.rejectSchemaDrift) throw Object.assign(new Error("provider_schema_drift"), { code: "SCHEMA_DRIFT" });
            }
            const endedAtMs = now();
            attempts.push({ attempt, startedAtMs, endedAtMs, latencyMs: Math.max(0, endedAtMs - startedAtMs), failureKind: null, retryDelayMs: 0 });
            const payloadDigest = providerPayloadDigest(value);
            cache.set(requestKey, { value, storedAtMs: endedAtMs, payloadDigest, schemaFingerprint: fingerprint, schemaState });
            circuit.consecutiveFailures = 0;
            circuit.openedAtMs = null;
            circuit.halfOpenProbe = false;
            let distributedSettled = true;
            if (admission && deps.afterAttempt) {
              const settlement = await deps.afterAttempt({ admission, success: true, failureKind: null, failureThreshold: policy.failureThreshold });
              applyDistributedState(admission, settlement);
              distributedSettled = settlement.settled;
            }
            const blockers = distributedSettled ? [] : ["provider_shared_state_settlement_required", ...distributedBlockers];
            const receipt = buildReceipt({ providerId, endpointId, cacheKey: args.cacheKey, state: "live", circuit, attempts, evidenceEligible: schemaState !== "drift" && distributedSettled, cacheAgeMs: 0, payloadDigest, schemaFingerprint: fingerprint, schemaState, quota: quotaState, distributedState, observedAtMs, completedAtMs: endedAtMs, blockers });
            appendAvailability(receipt);
            return { ok: true, value, receipt };
          } catch (error) {
            failureKind = args.classifyError?.(error) ?? classifyDefault(error);
            finalFailure = failureKind;
            const endedAtMs = now();
            if (admission && deps.afterAttempt) {
              try {
                const settlement = await deps.afterAttempt({ admission, success: false, failureKind, failureThreshold: policy.failureThreshold });
                applyDistributedState(admission, settlement);
              } catch {
                distributedBlockers.add("provider_shared_state_settle_failed");
                applyDistributedState(admission, null);
              }
            }
            const canRetry = attempt < policy.maxAttempts && retryable(failureKind);
            const exponential = Math.min(policy.retryMaxDelayMs, policy.retryBaseDelayMs * (2 ** (attempt - 1)));
            const jitter = exponential * policy.retryJitterRatio * ((random() * 2) - 1);
            const retryDelayMs = canRetry ? Math.max(0, Math.round(exponential + jitter)) : 0;
            attempts.push({ attempt, startedAtMs, endedAtMs, latencyMs: Math.max(0, endedAtMs - startedAtMs), failureKind, retryDelayMs });
            if (!canRetry) break;
            if (retryDelayMs > 0) await sleep(retryDelayMs);
          } finally {
            clearTimeout(timeout);
          }
        }

        const providerHealthFailure = finalFailure !== "quota_limited" && finalFailure !== "concurrency_limited" && finalFailure !== "circuit_open" && finalFailure !== "shared_state_unavailable";
        if (providerHealthFailure) {
          circuit.consecutiveFailures += 1;
          if (circuit.consecutiveFailures >= policy.failureThreshold) circuit.openedAtMs = now();
        }
        circuit.halfOpenProbe = false;
        const completedAtMs = now();
        const failureBlockers = [`provider_failure:${finalFailure}`, ...distributedBlockers];
        if (policy.allowStaleOnFailure && cached && cacheAgeMs !== null && cacheAgeMs <= policy.staleTtlMs) {
          const receipt = buildReceipt({ providerId, endpointId, cacheKey: args.cacheKey, state: "stale_cache", failureKind: finalFailure, circuit, attempts, evidenceEligible: false, cacheAgeMs, payloadDigest: cached.payloadDigest, schemaFingerprint: cached.schemaFingerprint, schemaState: cached.schemaState, quota: quotaState, distributedState, observedAtMs, completedAtMs, blockers: [...failureBlockers, "stale_evidence_not_live_eligible"] });
          appendAvailability(receipt);
          return { ok: true, value: cached.value, receipt };
        }
        const blocked = finalFailure === "quota_limited" || finalFailure === "circuit_open" || finalFailure === "shared_state_unavailable";
        const receipt = buildReceipt({ providerId, endpointId, cacheKey: args.cacheKey, state: blocked ? "blocked" : "failed", failureKind: finalFailure, circuit, attempts, quota: quotaState, distributedState, observedAtMs, completedAtMs, blockers: failureBlockers });
        appendAvailability(receipt);
        return { ok: false, value: null, receipt };
      } finally {
        activeByEndpoint.set(key, Math.max(0, (activeByEndpoint.get(key) ?? 1) - 1));
      }
    })();

    inFlight.set(requestKey, task as Promise<ProviderReliabilityResult<unknown>>);
    try {
      return await task;
    } finally {
      inFlight.delete(requestKey);
    }
  }

  function availabilitySnapshot(providerId: string, endpointId: string): ProviderAvailabilityLedgerSnapshot {
    const normalizedProvider = safeId(providerId);
    const normalizedEndpoint = safeId(endpointId);
    const state = availability.get(endpointKey(normalizedProvider, normalizedEndpoint));
    const entries = state?.entries.map((entry) => ({ ...entry })) ?? [];
    const successful = entries.filter((entry) => entry.state === "live" || entry.state === "fresh_cache" || entry.state === "stale_cache").length;
    const live = entries.filter((entry) => entry.state === "live").length;
    const cached = entries.filter((entry) => entry.state === "fresh_cache" || entry.state === "stale_cache").length;
    return {
      schemaVersion: PASS4801_PROVIDER_RELIABILITY_CONTROL_PLANE_ID,
      providerId: normalizedProvider,
      endpointId: normalizedEndpoint,
      anchorSequence: state?.anchorSequence ?? 0,
      anchorHash: state?.anchorHash ?? null,
      entryCount: entries.length,
      headHash: entries.at(-1)?.entryHash ?? state?.anchorHash ?? null,
      successRate: entries.length ? successful / entries.length : 0,
      liveRate: entries.length ? live / entries.length : 0,
      cacheRate: entries.length ? cached / entries.length : 0,
      p95LatencyMs: percentile95(entries.map((entry) => entry.latencyMs)),
      entries,
    };
  }

  return {
    execute,
    availabilitySnapshot,
    verifyAvailability(providerId: string, endpointId: string) {
      return verifyProviderAvailabilityLedger(availabilitySnapshot(providerId, endpointId));
    },
    snapshot() {
      return {
        cacheEntries: cache.size,
        inFlight: inFlight.size,
        circuits: Object.fromEntries(Array.from(circuits.entries()).map(([key, value]) => [key, { ...value }])),
        quotas: Object.fromEntries(Array.from(quotas.entries()).map(([key, value]) => [key, { ...value }])),
        schemas: Object.fromEntries(Array.from(schemas.entries()).map(([key, value]) => [key, { ...value }])),
        activeByEndpoint: Object.fromEntries(activeByEndpoint),
      };
    },
    clear() {
      cache.clear();
      inFlight.clear();
      circuits.clear();
      quotas.clear();
      schemas.clear();
      availability.clear();
      activeByEndpoint.clear();
    },
  };
}

export const serverOwnedProviderReliability = createProviderReliabilityControlPlane();
