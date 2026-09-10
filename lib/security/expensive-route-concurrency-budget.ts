export type ExpensiveRouteKey =
  | "angel_post"
  | "lens_report_post"
  | "market_report_get"
  | "market_chat_get"
  | "vlm_get"
  | "vlm_post"
  | "audit_watch_post"
  | "pro_audit_pdf_get"
  | "real_markets_get"
  | "search_get"
  | "source_sync_get"
  | "audit_provider_get"
  | "audit_provider_post"
  | "legacy_brain_get"
  | "legacy_assistant_get"
  | "market_probe_get"
  | "risk_calibration_get"
  | "venue_health_get"
  | "tier_180_output_matrix_get"
  | "worldclass_integrity_get"
  | "admin_ai_post";

type BudgetConfig = {
  maxActive: number;
  maxQueue: number;
  waitMs: number;
  retryAfterSeconds: number;
};

type QueueEntry = {
  id: number;
  resolve: (permit: ExpensiveRoutePermit | null) => void;
  timer: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abortHandler?: () => void;
};

type BudgetState = {
  active: number;
  nextId: number;
  queue: QueueEntry[];
  accepted: number;
  rejected: number;
  timedOut: number;
  aborted: number;
};

type BudgetStore = Map<ExpensiveRouteKey, BudgetState>;

export type ExpensiveRoutePermit = {
  key: ExpensiveRouteKey;
  release: () => void;
};

const DEFAULT_CONFIG: Record<ExpensiveRouteKey, BudgetConfig> = {
  angel_post: { maxActive: 4, maxQueue: 12, waitMs: 1_500, retryAfterSeconds: 2 },
  lens_report_post: { maxActive: 2, maxQueue: 8, waitMs: 2_500, retryAfterSeconds: 3 },
  market_report_get: { maxActive: 2, maxQueue: 8, waitMs: 2_000, retryAfterSeconds: 2 },
  market_chat_get: { maxActive: 3, maxQueue: 8, waitMs: 1_500, retryAfterSeconds: 2 },
  vlm_get: { maxActive: 4, maxQueue: 12, waitMs: 1_500, retryAfterSeconds: 2 },
  vlm_post: { maxActive: 3, maxQueue: 10, waitMs: 2_000, retryAfterSeconds: 2 },
  audit_watch_post: { maxActive: 2, maxQueue: 8, waitMs: 2_500, retryAfterSeconds: 3 },
  pro_audit_pdf_get: { maxActive: 1, maxQueue: 4, waitMs: 3_000, retryAfterSeconds: 4 },
  real_markets_get: { maxActive: 4, maxQueue: 16, waitMs: 1_500, retryAfterSeconds: 2 },
  search_get: { maxActive: 4, maxQueue: 12, waitMs: 1_500, retryAfterSeconds: 2 },
  source_sync_get: { maxActive: 3, maxQueue: 10, waitMs: 2_000, retryAfterSeconds: 2 },
  audit_provider_get: { maxActive: 4, maxQueue: 16, waitMs: 1_500, retryAfterSeconds: 2 },
  audit_provider_post: { maxActive: 3, maxQueue: 10, waitMs: 2_000, retryAfterSeconds: 2 },
  legacy_brain_get: { maxActive: 3, maxQueue: 8, waitMs: 1_500, retryAfterSeconds: 2 },
  legacy_assistant_get: { maxActive: 3, maxQueue: 8, waitMs: 1_500, retryAfterSeconds: 2 },
  market_probe_get: { maxActive: 2, maxQueue: 6, waitMs: 2_000, retryAfterSeconds: 3 },
  risk_calibration_get: { maxActive: 3, maxQueue: 8, waitMs: 1_500, retryAfterSeconds: 2 },
  venue_health_get: { maxActive: 2, maxQueue: 6, waitMs: 1_500, retryAfterSeconds: 2 },
  tier_180_output_matrix_get: { maxActive: 2, maxQueue: 6, waitMs: 2_500, retryAfterSeconds: 3 },
  worldclass_integrity_get: { maxActive: 4, maxQueue: 12, waitMs: 1_500, retryAfterSeconds: 2 },
  admin_ai_post: { maxActive: 2, maxQueue: 6, waitMs: 2_500, retryAfterSeconds: 3 },
};

const GLOBAL_KEY = Symbol.for("velmere.expensive-route-concurrency-budget.v1");

function globalStore(): BudgetStore {
  const holder = globalThis as typeof globalThis & Record<symbol, unknown>;
  const existing = holder[GLOBAL_KEY];
  if (existing instanceof Map) return existing as BudgetStore;
  const created: BudgetStore = new Map();
  holder[GLOBAL_KEY] = created;
  return created;
}

function stateFor(key: ExpensiveRouteKey): BudgetState {
  const store = globalStore();
  const existing = store.get(key);
  if (existing) return existing;
  const created: BudgetState = {
    active: 0,
    nextId: 1,
    queue: [],
    accepted: 0,
    rejected: 0,
    timedOut: 0,
    aborted: 0,
  };
  store.set(key, created);
  return created;
}

function readBoundedInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function configFor(key: ExpensiveRouteKey): BudgetConfig {
  const base = DEFAULT_CONFIG[key];
  const suffix = key.toUpperCase();
  return {
    maxActive: readBoundedInteger(`VELMERE_CAPACITY_${suffix}_ACTIVE`, base.maxActive, 1, 64),
    maxQueue: readBoundedInteger(`VELMERE_CAPACITY_${suffix}_QUEUE`, base.maxQueue, 0, 256),
    waitMs: readBoundedInteger(`VELMERE_CAPACITY_${suffix}_WAIT_MS`, base.waitMs, 50, 30_000),
    retryAfterSeconds: base.retryAfterSeconds,
  };
}

function cleanupEntry(entry: QueueEntry) {
  clearTimeout(entry.timer);
  if (entry.signal && entry.abortHandler) entry.signal.removeEventListener("abort", entry.abortHandler);
}

function removeQueuedEntry(state: BudgetState, id: number): QueueEntry | null {
  const index = state.queue.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const [entry] = state.queue.splice(index, 1);
  return entry ?? null;
}

function createPermit(key: ExpensiveRouteKey, state: BudgetState): ExpensiveRoutePermit {
  let released = false;
  return {
    key,
    release() {
      if (released) return;
      released = true;
      state.active = Math.max(0, state.active - 1);
      drainQueue(key, state);
    },
  };
}

function drainQueue(key: ExpensiveRouteKey, state: BudgetState) {
  const config = configFor(key);
  while (state.active < config.maxActive && state.queue.length > 0) {
    const entry = state.queue.shift();
    if (!entry) break;
    cleanupEntry(entry);
    if (entry.signal?.aborted) {
      state.aborted += 1;
      entry.resolve(null);
      continue;
    }
    state.active += 1;
    state.accepted += 1;
    entry.resolve(createPermit(key, state));
  }
}

export async function acquireExpensiveRoutePermit(
  key: ExpensiveRouteKey,
  signal?: AbortSignal,
): Promise<ExpensiveRoutePermit | null> {
  const state = stateFor(key);
  const config = configFor(key);

  if (signal?.aborted) {
    state.aborted += 1;
    return null;
  }

  if (state.active < config.maxActive) {
    state.active += 1;
    state.accepted += 1;
    return createPermit(key, state);
  }

  if (state.queue.length >= config.maxQueue) {
    state.rejected += 1;
    return null;
  }

  return new Promise<ExpensiveRoutePermit | null>((resolve) => {
    const id = state.nextId++;
    const entry: QueueEntry = {
      id,
      resolve,
      timer: setTimeout(() => {
        const removed = removeQueuedEntry(state, id);
        if (!removed) return;
        cleanupEntry(removed);
        state.timedOut += 1;
        resolve(null);
      }, config.waitMs),
      signal,
    };

    if (signal) {
      entry.abortHandler = () => {
        const removed = removeQueuedEntry(state, id);
        if (!removed) return;
        cleanupEntry(removed);
        state.aborted += 1;
        resolve(null);
      };
      signal.addEventListener("abort", entry.abortHandler, { once: true });
    }

    state.queue.push(entry);
  });
}

function capacityResponse(key: ExpensiveRouteKey): Response {
  const config = configFor(key);
  const state = stateFor(key);
  return new Response(
    JSON.stringify({
      ok: false,
      error: "expensive_route_capacity_exhausted",
      routeBudget: key,
      retryAfterSeconds: config.retryAfterSeconds,
    }),
    {
      status: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": String(config.retryAfterSeconds),
        "x-content-type-options": "nosniff",
        "x-velmere-capacity-budget": key,
        "x-velmere-capacity-active": String(state.active),
        "x-velmere-capacity-queued": String(state.queue.length),
      },
    },
  );
}

export async function withExpensiveRouteBudget(
  request: Request,
  key: ExpensiveRouteKey,
  handler: () => Promise<Response>,
): Promise<Response> {
  const permit = await acquireExpensiveRoutePermit(key, request.signal);
  if (!permit) return capacityResponse(key);
  try {
    const response = await handler();
    response.headers.set("x-velmere-capacity-budget", key);
    return response;
  } finally {
    permit.release();
  }
}

export function getExpensiveRouteBudgetSnapshot() {
  return Object.fromEntries(
    (Object.keys(DEFAULT_CONFIG) as ExpensiveRouteKey[]).map((key) => {
      const state = stateFor(key);
      const config = configFor(key);
      return [key, {
        active: state.active,
        queued: state.queue.length,
        accepted: state.accepted,
        rejected: state.rejected,
        timedOut: state.timedOut,
        aborted: state.aborted,
        maxActive: config.maxActive,
        maxQueue: config.maxQueue,
        waitMs: config.waitMs,
      }];
    }),
  );
}

export const EXPENSIVE_ROUTE_CONCURRENCY_BUDGET_READINESS = {
  schemaVersion: "velmere.expensive-route-concurrency-budget.v1",
  processLocalProtection: true,
  crossInstanceCoordination: false,
  failClosedWhenQueueFullOrTimedOut: true,
  requestAbortAware: true,
  permitReleaseInFinally: true,
  productionBoundary:
    "This protects each runtime instance from concurrent CPU/memory spikes. It complements, but does not replace, durable distributed rate limiting, queue workers, autoscaling, cgroup limits or live load tests.",
} as const;
