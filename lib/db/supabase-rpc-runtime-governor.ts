import { BoundedSupabaseRpcError } from "@/lib/db/bounded-supabase-rpc";

export type SupabaseRpcOperationFamily = "payments" | "fulfilment" | "audit" | "auth";

export type SupabaseRpcGovernorConfig = {
  maxConcurrent: number;
  failureWindowMs: number;
  failureThreshold: number;
  cooldownMs: number;
};

type OutcomeKind = "success" | "error" | "deadline";
type MetricKind = OutcomeKind | "backpressure" | "circuit_open";

type TimedOutcome = {
  at: number;
  kind: OutcomeKind;
};

type FamilyState = {
  inFlight: number;
  circuitOpenUntil: number;
  outcomes: TimedOutcome[];
  metrics: Record<MetricKind, number>;
  latencyBuckets: {
    under250ms: number;
    under1000ms: number;
    under3000ms: number;
    over3000ms: number;
  };
};

export const SUPABASE_RPC_GOVERNOR_CONFIG: Record<SupabaseRpcOperationFamily, SupabaseRpcGovernorConfig> = {
  payments: { maxConcurrent: 8, failureWindowMs: 30_000, failureThreshold: 5, cooldownMs: 15_000 },
  fulfilment: { maxConcurrent: 6, failureWindowMs: 45_000, failureThreshold: 6, cooldownMs: 20_000 },
  audit: { maxConcurrent: 4, failureWindowMs: 60_000, failureThreshold: 5, cooldownMs: 30_000 },
  auth: { maxConcurrent: 8, failureWindowMs: 30_000, failureThreshold: 5, cooldownMs: 20_000 },
};

const familyStates = new Map<SupabaseRpcOperationFamily, FamilyState>();

function createState(): FamilyState {
  return {
    inFlight: 0,
    circuitOpenUntil: 0,
    outcomes: [],
    metrics: { success: 0, error: 0, deadline: 0, backpressure: 0, circuit_open: 0 },
    latencyBuckets: { under250ms: 0, under1000ms: 0, under3000ms: 0, over3000ms: 0 },
  };
}

function getState(family: SupabaseRpcOperationFamily): FamilyState {
  const existing = familyStates.get(family);
  if (existing) return existing;
  const created = createState();
  familyStates.set(family, created);
  return created;
}

function boundedConfig(
  family: SupabaseRpcOperationFamily,
  override?: Partial<SupabaseRpcGovernorConfig>,
): SupabaseRpcGovernorConfig {
  const base = SUPABASE_RPC_GOVERNOR_CONFIG[family];
  const integer = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
  };
  return {
    maxConcurrent: integer(override?.maxConcurrent, base.maxConcurrent, 1, 64),
    failureWindowMs: integer(override?.failureWindowMs, base.failureWindowMs, 1_000, 300_000),
    failureThreshold: integer(override?.failureThreshold, base.failureThreshold, 2, 50),
    cooldownMs: integer(override?.cooldownMs, base.cooldownMs, 1_000, 300_000),
  };
}

function prune(state: FamilyState, now: number, windowMs: number) {
  const threshold = now - windowMs;
  state.outcomes = state.outcomes.filter((item) => item.at >= threshold);
  if (state.circuitOpenUntil > 0 && state.circuitOpenUntil <= now) {
    state.circuitOpenUntil = 0;
  }
}

function classifyFailure(error: unknown): OutcomeKind {
  if (error instanceof BoundedSupabaseRpcError) {
    if (error.code === "rpc_deadline_exceeded" || error.code === "rpc_aborted") return "deadline";
    if (error.code === "rpc_capability_unavailable" || error.code === "rpc_invalid_operation") return "error";
  }
  return "error";
}

function countsTowardCircuit(error: unknown) {
  if (!(error instanceof BoundedSupabaseRpcError)) return true;
  return error.code === "rpc_deadline_exceeded" || error.code === "rpc_aborted" || error.code === "rpc_failed";
}

function recordLatency(state: FamilyState, durationMs: number) {
  if (durationMs < 250) state.latencyBuckets.under250ms += 1;
  else if (durationMs < 1_000) state.latencyBuckets.under1000ms += 1;
  else if (durationMs < 3_000) state.latencyBuckets.under3000ms += 1;
  else state.latencyBuckets.over3000ms += 1;
}

export class SupabaseRpcGovernorError extends Error {
  readonly code: "rpc_backpressure" | "rpc_circuit_open";
  readonly family: SupabaseRpcOperationFamily;

  constructor(code: SupabaseRpcGovernorError["code"], family: SupabaseRpcOperationFamily) {
    super(`${family}:${code}`);
    this.name = "SupabaseRpcGovernorError";
    this.code = code;
    this.family = family;
  }
}

export async function runGovernedSupabaseRpc<T>(input: {
  family: SupabaseRpcOperationFamily;
  execute: () => Promise<T>;
  now?: () => number;
  configOverride?: Partial<SupabaseRpcGovernorConfig>;
}): Promise<T> {
  const now = input.now ?? Date.now;
  const config = boundedConfig(input.family, input.configOverride);
  const state = getState(input.family);
  const startedAt = now();
  prune(state, startedAt, config.failureWindowMs);

  if (state.circuitOpenUntil > startedAt) {
    state.metrics.circuit_open += 1;
    throw new SupabaseRpcGovernorError("rpc_circuit_open", input.family);
  }
  if (state.inFlight >= config.maxConcurrent) {
    state.metrics.backpressure += 1;
    throw new SupabaseRpcGovernorError("rpc_backpressure", input.family);
  }

  state.inFlight += 1;
  try {
    const result = await input.execute();
    const finishedAt = now();
    state.metrics.success += 1;
    state.outcomes.push({ at: finishedAt, kind: "success" });
    recordLatency(state, Math.max(0, finishedAt - startedAt));
    return result;
  } catch (error) {
    const finishedAt = now();
    const kind = classifyFailure(error);
    state.metrics[kind] += 1;
    state.outcomes.push({ at: finishedAt, kind });
    recordLatency(state, Math.max(0, finishedAt - startedAt));
    if (countsTowardCircuit(error)) {
      const recentFailures = state.outcomes.filter((item) => item.kind !== "success").length;
      if (recentFailures >= config.failureThreshold) {
        state.circuitOpenUntil = finishedAt + config.cooldownMs;
      }
    }
    throw error;
  } finally {
    state.inFlight = Math.max(0, state.inFlight - 1);
  }
}

export type SupabaseRpcGovernorSnapshot = {
  schemaVersion: "velmere.supabase-rpc-governor-snapshot.v1";
  generatedAt: string;
  families: Record<SupabaseRpcOperationFamily, {
    inFlight: number;
    circuitState: "closed" | "open";
    metrics: Record<MetricKind, number>;
    latencyBuckets: FamilyState["latencyBuckets"];
  }>;
};

export function getSupabaseRpcGovernorSnapshot(nowValue = Date.now()): SupabaseRpcGovernorSnapshot {
  const families = {} as SupabaseRpcGovernorSnapshot["families"];
  for (const family of Object.keys(SUPABASE_RPC_GOVERNOR_CONFIG) as SupabaseRpcOperationFamily[]) {
    const state = getState(family);
    prune(state, nowValue, SUPABASE_RPC_GOVERNOR_CONFIG[family].failureWindowMs);
    families[family] = {
      inFlight: state.inFlight,
      circuitState: state.circuitOpenUntil > nowValue ? "open" : "closed",
      metrics: { ...state.metrics },
      latencyBuckets: { ...state.latencyBuckets },
    };
  }
  return {
    schemaVersion: "velmere.supabase-rpc-governor-snapshot.v1",
    generatedAt: new Date(nowValue).toISOString(),
    families,
  };
}

export function resetSupabaseRpcGovernorForTests() {
  familyStates.clear();
}
