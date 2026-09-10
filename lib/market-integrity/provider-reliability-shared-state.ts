import { createHash, randomUUID } from "node:crypto";
import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import type {
  ProviderDistributedAttemptAdmission,
  ProviderDistributedAttemptSettlement,
  ProviderReliabilityFailureKind,
} from "./provider-reliability-control-plane";

export const PASS4802_PROVIDER_SHARED_STATE_ID = "pass4802-provider-shared-state-v1" as const;

type SharedStateRecord = {
  providerId: string;
  endpointId: string;
  quotaWindowStartedAtMs: number;
  quotaUsed: number;
  consecutiveFailures: number;
  openedAtMs: number | null;
  halfOpenLeaseId: string | null;
  halfOpenLeaseExpiresAtMs: number | null;
  version: number;
};

type SharedLeaseRecord = {
  leaseId: string;
  endpointKey: string;
  requestIdHash: string;
  mode: "normal" | "half_open";
  expiresAtMs: number;
  settled: boolean;
};

type AcquireInput = {
  providerId: string;
  endpointId: string;
  requestIdHash: string;
  quotaLimit: number;
  quotaWindowMs: number;
  cooldownMs: number;
  leaseTtlMs: number;
  nowMs: number;
};

type SettleInput = {
  leaseId: string;
  success: boolean;
  providerFailure: boolean;
  failureThreshold: number;
  completedAtMs: number;
};

export type ProviderReliabilitySharedStateStore = {
  mode: "memory" | "durable";
  acquire(input: AcquireInput): Promise<ProviderDistributedAttemptAdmission>;
  settle(input: SettleInput): Promise<ProviderDistributedAttemptSettlement>;
  clear?(): void;
};

function cleanId(value: string, max = 120) {
  return value.trim().toLowerCase().replace(/[^a-z0-9:._/-]+/g, "-").replace(/-+/g, "-").slice(0, max) || "unknown";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function endpointKey(providerId: string, endpointId: string) {
  return `${cleanId(providerId)}::${cleanId(endpointId)}`;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function row(value: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null;
}

function circuitState(record: Pick<SharedStateRecord, "openedAtMs" | "halfOpenLeaseId">) {
  return record.openedAtMs === null ? "closed" as const : record.halfOpenLeaseId ? "half_open" as const : "open" as const;
}

export function createMemoryProviderReliabilitySharedState(deps: {
  uuid?: () => string;
} = {}): ProviderReliabilitySharedStateStore {
  const uuid = deps.uuid ?? randomUUID;
  const states = new Map<string, SharedStateRecord>();
  const leases = new Map<string, SharedLeaseRecord>();

  function stateFor(providerId: string, endpointId: string, nowMs: number) {
    const key = endpointKey(providerId, endpointId);
    const existing = states.get(key);
    if (existing) return { key, record: existing };
    const record: SharedStateRecord = {
      providerId: cleanId(providerId),
      endpointId: cleanId(endpointId),
      quotaWindowStartedAtMs: nowMs,
      quotaUsed: 0,
      consecutiveFailures: 0,
      openedAtMs: null,
      halfOpenLeaseId: null,
      halfOpenLeaseExpiresAtMs: null,
      version: 0,
    };
    states.set(key, record);
    return { key, record };
  }

  return {
    mode: "memory",
    async acquire(input) {
      const quotaLimit = boundedInteger(input.quotaLimit, 120, 1, 1_000_000);
      const quotaWindowMs = boundedInteger(input.quotaWindowMs, 60_000, 1_000, 86_400_000);
      const cooldownMs = boundedInteger(input.cooldownMs, 30_000, 500, 86_400_000);
      const leaseTtlMs = boundedInteger(input.leaseTtlMs, 15_000, 500, 120_000);
      const { key, record } = stateFor(input.providerId, input.endpointId, input.nowMs);
      if (input.nowMs - record.quotaWindowStartedAtMs >= quotaWindowMs) {
        record.quotaWindowStartedAtMs = input.nowMs;
        record.quotaUsed = 0;
      }
      if (record.halfOpenLeaseExpiresAtMs !== null && record.halfOpenLeaseExpiresAtMs <= input.nowMs) {
        record.halfOpenLeaseId = null;
        record.halfOpenLeaseExpiresAtMs = null;
      }

      let mode: "normal" | "half_open" = "normal";
      if (record.openedAtMs !== null) {
        if (input.nowMs - record.openedAtMs < cooldownMs) {
          return {
            allowed: false,
            failureKind: "circuit_open",
            mode: "memory",
            leaseId: null,
            circuitState: "open",
            consecutiveFailures: record.consecutiveFailures,
            stateVersion: record.version,
            quota: { limit: quotaLimit, remaining: Math.max(0, quotaLimit - record.quotaUsed), resetAtMs: record.quotaWindowStartedAtMs + quotaWindowMs },
            blockers: ["shared_provider_circuit_open"],
          };
        }
        if (record.halfOpenLeaseId) {
          return {
            allowed: false,
            failureKind: "circuit_open",
            mode: "memory",
            leaseId: null,
            circuitState: "half_open",
            consecutiveFailures: record.consecutiveFailures,
            stateVersion: record.version,
            quota: { limit: quotaLimit, remaining: Math.max(0, quotaLimit - record.quotaUsed), resetAtMs: record.quotaWindowStartedAtMs + quotaWindowMs },
            blockers: ["shared_provider_half_open_probe_busy"],
          };
        }
        mode = "half_open";
      }

      if (record.quotaUsed >= quotaLimit) {
        return {
          allowed: false,
          failureKind: "quota_limited",
          mode: "memory",
          leaseId: null,
          circuitState: circuitState(record),
          consecutiveFailures: record.consecutiveFailures,
          stateVersion: record.version,
          quota: { limit: quotaLimit, remaining: 0, resetAtMs: record.quotaWindowStartedAtMs + quotaWindowMs },
          blockers: ["shared_provider_quota_exhausted"],
        };
      }

      const leaseId = uuid();
      record.quotaUsed += 1;
      record.version += 1;
      if (mode === "half_open") {
        record.halfOpenLeaseId = leaseId;
        record.halfOpenLeaseExpiresAtMs = input.nowMs + leaseTtlMs;
      }
      leases.set(leaseId, {
        leaseId,
        endpointKey: key,
        requestIdHash: input.requestIdHash,
        mode,
        expiresAtMs: input.nowMs + leaseTtlMs,
        settled: false,
      });
      return {
        allowed: true,
        failureKind: null,
        mode: "memory",
        leaseId,
        circuitState: mode === "half_open" ? "half_open" : circuitState(record),
        consecutiveFailures: record.consecutiveFailures,
        stateVersion: record.version,
        quota: { limit: quotaLimit, remaining: Math.max(0, quotaLimit - record.quotaUsed), resetAtMs: record.quotaWindowStartedAtMs + quotaWindowMs },
        blockers: [],
      };
    },
    async settle(input) {
      const lease = leases.get(input.leaseId);
      if (!lease) {
        return { settled: false, mode: "memory", stateVersion: 0, circuitState: "open", consecutiveFailures: 0, blockers: ["shared_provider_lease_missing"] };
      }
      const record = states.get(lease.endpointKey);
      if (!record) {
        return { settled: false, mode: "memory", stateVersion: 0, circuitState: "open", consecutiveFailures: 0, blockers: ["shared_provider_state_missing"] };
      }
      if (lease.settled) {
        return { settled: true, mode: "memory", stateVersion: record.version, circuitState: circuitState(record), consecutiveFailures: record.consecutiveFailures, blockers: [] };
      }
      if (lease.expiresAtMs <= input.completedAtMs) {
        lease.settled = true;
        if (record.halfOpenLeaseId === lease.leaseId) {
          record.halfOpenLeaseId = null;
          record.halfOpenLeaseExpiresAtMs = null;
        }
        record.version += 1;
        return {
          settled: false,
          mode: "memory",
          stateVersion: record.version,
          circuitState: circuitState(record),
          consecutiveFailures: record.consecutiveFailures,
          blockers: ["shared_provider_lease_expired"],
        };
      }
      lease.settled = true;
      const threshold = boundedInteger(input.failureThreshold, 3, 1, 100);
      if (input.success) {
        record.consecutiveFailures = 0;
        record.openedAtMs = null;
      } else if (input.providerFailure) {
        record.consecutiveFailures += 1;
        if (record.consecutiveFailures >= threshold) record.openedAtMs = input.completedAtMs;
      }
      if (record.halfOpenLeaseId === lease.leaseId) {
        record.halfOpenLeaseId = null;
        record.halfOpenLeaseExpiresAtMs = null;
      }
      record.version += 1;
      return {
        settled: true,
        mode: "memory",
        stateVersion: record.version,
        circuitState: circuitState(record),
        consecutiveFailures: record.consecutiveFailures,
        blockers: [],
      };
    },
    clear() {
      states.clear();
      leases.clear();
    },
  };
}

function parseAdmission(data: unknown): ProviderDistributedAttemptAdmission {
  const value = row(data);
  if (!value) throw new Error("provider_shared_state_invalid_admission");
  const allowed = value.allowed === true;
  const reason = String(value.reason ?? "");
  const failureKind: ProviderReliabilityFailureKind | null = allowed
    ? null
    : reason === "quota_limited" ? "quota_limited" : reason === "circuit_open" || reason === "half_open_busy" ? "circuit_open" : "shared_state_unavailable";
  const leaseId = typeof value.lease_id === "string" && /^[a-f0-9-]{36}$/i.test(value.lease_id) ? value.lease_id : null;
  const state = String(value.circuit_state ?? "open");
  const circuit = state === "closed" || state === "half_open" ? state : "open";
  const resetAt = Date.parse(String(value.quota_reset_at ?? ""));
  return {
    allowed,
    failureKind,
    mode: "durable",
    leaseId,
    circuitState: circuit,
    consecutiveFailures: boundedInteger(value.consecutive_failures, 0, 0, 1_000_000),
    stateVersion: boundedInteger(value.state_version, 0, 0, Number.MAX_SAFE_INTEGER),
    quota: {
      limit: boundedInteger(value.quota_limit, 1, 1, 1_000_000),
      remaining: boundedInteger(value.quota_remaining, 0, 0, 1_000_000),
      resetAtMs: Number.isFinite(resetAt) ? resetAt : Date.now(),
    },
    blockers: allowed ? [] : [`shared_provider_${reason || "state_unavailable"}`],
  };
}

function parseSettlement(data: unknown): ProviderDistributedAttemptSettlement {
  const value = row(data);
  if (!value) throw new Error("provider_shared_state_invalid_settlement");
  const state = String(value.circuit_state ?? "open");
  return {
    settled: value.settled === true,
    mode: "durable",
    stateVersion: boundedInteger(value.state_version, 0, 0, Number.MAX_SAFE_INTEGER),
    circuitState: state === "closed" || state === "half_open" ? state : "open",
    consecutiveFailures: boundedInteger(value.consecutive_failures, 0, 0, 1_000_000),
    blockers: value.settled === true ? [] : [String(value.reason ?? "shared_provider_settlement_failed")],
  };
}

export function createDurableProviderReliabilitySharedState(): ProviderReliabilitySharedStateStore {
  return {
    mode: "durable",
    async acquire(input) {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "provider_reliability_lease_acquire",
        args: {
          p_provider_id: cleanId(input.providerId),
          p_endpoint_id: cleanId(input.endpointId),
          p_request_id_hash: input.requestIdHash,
          p_quota_limit: boundedInteger(input.quotaLimit, 120, 1, 1_000_000),
          p_quota_window_seconds: Math.max(1, Math.ceil(input.quotaWindowMs / 1_000)),
          p_cooldown_seconds: Math.max(1, Math.ceil(input.cooldownMs / 1_000)),
          p_lease_seconds: Math.max(1, Math.ceil(input.leaseTtlMs / 1_000)),
          p_now: new Date(input.nowMs).toISOString(),
        },
      });
      return parseAdmission(data);
    },
    async settle(input) {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "provider_reliability_lease_settle",
        args: {
          p_lease_id: input.leaseId,
          p_success: input.success,
          p_provider_failure: input.providerFailure,
          p_failure_threshold: boundedInteger(input.failureThreshold, 3, 1, 100),
          p_completed_at: new Date(input.completedAtMs).toISOString(),
        },
      });
      return parseSettlement(data);
    },
  };
}

const GLOBAL_MEMORY_KEY = "__velmereProviderReliabilitySharedStateV1";

function processSharedMemoryStore() {
  const root = globalThis as typeof globalThis & { [GLOBAL_MEMORY_KEY]?: ProviderReliabilitySharedStateStore };
  root[GLOBAL_MEMORY_KEY] ??= createMemoryProviderReliabilitySharedState();
  return root[GLOBAL_MEMORY_KEY];
}

export function createProviderReliabilitySharedAttemptHooks(deps: {
  store?: ProviderReliabilitySharedStateStore;
  now?: () => number;
  requestId?: () => string;
} = {}) {
  const now = deps.now ?? Date.now;
  const requestId = deps.requestId ?? randomUUID;
  const configuredStore = deps.store;

  function storeForRuntime() {
    if (configuredStore) return configuredStore;
    if (hasSupabaseServiceRoleConfig()) return createDurableProviderReliabilitySharedState();
    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") return null;
    return processSharedMemoryStore();
  }

  return {
    beforeAttempt: async (input: {
      providerId: string;
      endpointId: string;
      cacheKey: string;
      attempt: number;
      quotaLimit: number;
      quotaWindowMs: number;
      cooldownMs: number;
      timeoutMs: number;
    }): Promise<ProviderDistributedAttemptAdmission> => {
      const store = storeForRuntime();
      if (!store) {
        return {
          allowed: false,
          failureKind: "shared_state_unavailable",
          mode: "unavailable",
          leaseId: null,
          circuitState: "open",
          consecutiveFailures: 0,
          stateVersion: 0,
          quota: { limit: input.quotaLimit, remaining: 0, resetAtMs: now() + input.quotaWindowMs },
          blockers: ["durable_provider_shared_state_required"],
        };
      }
      try {
        return await store.acquire({
          providerId: input.providerId,
          endpointId: input.endpointId,
          requestIdHash: sha256(`${input.cacheKey}:${input.attempt}:${requestId()}`),
          quotaLimit: input.quotaLimit,
          quotaWindowMs: input.quotaWindowMs,
          cooldownMs: input.cooldownMs,
          leaseTtlMs: Math.max(input.timeoutMs * 2, 5_000),
          nowMs: now(),
        });
      } catch {
        if (process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production") {
          return processSharedMemoryStore().acquire({
            providerId: input.providerId,
            endpointId: input.endpointId,
            requestIdHash: sha256(`${input.cacheKey}:${input.attempt}:${requestId()}`),
            quotaLimit: input.quotaLimit,
            quotaWindowMs: input.quotaWindowMs,
            cooldownMs: input.cooldownMs,
            leaseTtlMs: Math.max(input.timeoutMs * 2, 5_000),
            nowMs: now(),
          });
        }
        return {
          allowed: false,
          failureKind: "shared_state_unavailable",
          mode: store.mode,
          leaseId: null,
          circuitState: "open",
          consecutiveFailures: 0,
          stateVersion: 0,
          quota: { limit: input.quotaLimit, remaining: 0, resetAtMs: now() + input.quotaWindowMs },
          blockers: ["provider_shared_state_acquire_failed"],
        };
      }
    },
    afterAttempt: async (input: {
      admission: ProviderDistributedAttemptAdmission;
      success: boolean;
      failureKind: ProviderReliabilityFailureKind | null;
      failureThreshold: number;
    }): Promise<ProviderDistributedAttemptSettlement> => {
      const store = storeForRuntime();
      if (!store || !input.admission.leaseId) {
        return {
          settled: false,
          mode: input.admission.mode,
          stateVersion: input.admission.stateVersion,
          circuitState: input.admission.circuitState,
          consecutiveFailures: input.admission.consecutiveFailures,
          blockers: ["provider_shared_state_settlement_unavailable"],
        };
      }
      const providerFailure = input.failureKind !== null
        && input.failureKind !== "quota_limited"
        && input.failureKind !== "concurrency_limited"
        && input.failureKind !== "circuit_open"
        && input.failureKind !== "shared_state_unavailable";
      try {
        return await store.settle({
          leaseId: input.admission.leaseId,
          success: input.success,
          providerFailure,
          failureThreshold: input.failureThreshold,
          completedAtMs: now(),
        });
      } catch {
        if (process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production") {
          return processSharedMemoryStore().settle({
            leaseId: input.admission.leaseId,
            success: input.success,
            providerFailure,
            failureThreshold: input.failureThreshold,
            completedAtMs: now(),
          });
        }
        return {
          settled: false,
          mode: store.mode,
          stateVersion: input.admission.stateVersion,
          circuitState: input.admission.circuitState,
          consecutiveFailures: input.admission.consecutiveFailures,
          blockers: ["provider_shared_state_settle_failed"],
        };
      }
    },
    clearMemoryForTests() {
      const store = configuredStore ?? processSharedMemoryStore();
      store.clear?.();
    },
    requestId,
  };
}
