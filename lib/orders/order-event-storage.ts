import { executeUpstashRestCommand, executeUpstashRestEval } from "@/lib/security/upstash-rest-atomic";
import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { OrderEventReceipt } from "@/lib/orders/order-event-contract";

export type OrderEventStorageMode = "disabled" | "memory_only" | "upstash_list" | "upstash_fallback_memory";
export type OrderEventStorageProvider = "none" | "memory" | "upstash";

export type OrderEventStorageResult = {
  schemaVersion: "velmere.order-event-storage-result.v1";
  ok: boolean;
  persisted: boolean;
  durableWrite: boolean;
  mode: OrderEventStorageMode;
  provider: OrderEventStorageProvider;
  attempted: boolean;
  eventId: string;
  orderDraftId: string;
  eventType: string;
  writtenEventCount: number;
  duplicateEventCount: number;
  ledgerKey: string | null;
  orderTimelineKey: string | null;
  idempotencyKey: string;
  providerError?: string;
  productionBoundary: string;
};

export type OrderEventStorageReadiness = {
  schemaVersion: "velmere.order-event-storage-readiness.v1";
  mode: OrderEventStorageMode;
  provider: OrderEventStorageProvider;
  hasUpstashUrl: boolean;
  hasUpstashToken: boolean;
  ledgerKeyConfigured: boolean;
  orderTimelinePrefixConfigured: boolean;
  maxGlobalEvents: number;
  maxOrderEvents: number;
  pendingWriteCount: number;
  recentAttempts: OrderEventStorageResult[];
  recentFailureCount: number;
  memoryEventCount: number;
  durableStorageReady: boolean;
  productionBoundary: string;
};

type StoredOrderEventEnvelope = {
  schemaVersion: "velmere.order-event-storage-envelope.v1";
  storedAt: string;
  event: OrderEventReceipt;
  redactionBoundary: {
    rawCustomerPiiStored: false;
    rawProviderPayloadStored: false;
    secretsStored: false;
    allowedFields: string[];
  };
};

type OrderEventStorageRuntime = {
  recentAttempts: OrderEventStorageResult[];
  memoryEvents: StoredOrderEventEnvelope[];
  memoryByOrder: Map<string, StoredOrderEventEnvelope[]>;
  pendingWrites: Set<Promise<OrderEventStorageResult>>;
};

const MAX_ATTEMPTS = 120;
const MAX_MEMORY_EVENTS = 500;

function getRuntime(): OrderEventStorageRuntime {
  const globalStore = globalThis as typeof globalThis & { __velmereOrderEventStorage?: OrderEventStorageRuntime };
  if (!globalStore.__velmereOrderEventStorage) {
    globalStore.__velmereOrderEventStorage = {
      recentAttempts: [],
      memoryEvents: [],
      memoryByOrder: new Map(),
      pendingWrites: new Set(),
    };
  }
  return globalStore.__velmereOrderEventStorage;
}

function pushAttempt(result: OrderEventStorageResult) {
  const runtime = getRuntime();
  runtime.recentAttempts.unshift(result);
  if (runtime.recentAttempts.length > MAX_ATTEMPTS) runtime.recentAttempts.length = MAX_ATTEMPTS;
  return result;
}

function normalizeKey(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/[^a-zA-Z0-9:_@.-]/g, "_").slice(0, 180);
}

function stableHash(input: string) {
  return sha256Token(input, 24);
}

function getMode(): OrderEventStorageMode {
  if (process.env.VELMERE_ORDER_EVENT_STORAGE_DISABLED === "1") return "disabled";
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return "upstash_list";
  return "memory_only";
}

function getProvider(mode: OrderEventStorageMode): OrderEventStorageProvider {
  if (mode === "upstash_list" || mode === "upstash_fallback_memory") return "upstash";
  if (mode === "memory_only") return "memory";
  return "none";
}

function getLedgerKey() {
  return normalizeKey(process.env.VELMERE_ORDER_EVENT_UPSTASH_KEY, "velmere:orders:event-ledger");
}

function getOrderTimelinePrefix() {
  return normalizeKey(process.env.VELMERE_ORDER_TIMELINE_UPSTASH_PREFIX, "velmere:orders:timeline");
}

function orderTimelineKey(orderDraftId: string) {
  const safeOrder = normalizeKey(orderDraftId, "unknown-order");
  return `${getOrderTimelinePrefix()}:${stableHash(safeOrder)}:${safeOrder.slice(0, 72)}`;
}

function getMaxGlobalEvents() {
  return Math.max(50, Math.min(Number(process.env.VELMERE_ORDER_EVENT_MAX_GLOBAL ?? 1_000) || 1_000, 5_000));
}

function getMaxOrderEvents() {
  return Math.max(30, Math.min(Number(process.env.VELMERE_ORDER_EVENT_MAX_PER_ORDER ?? 160) || 160, 1_000));
}

function getTimeoutMs() {
  return Math.max(300, Math.min(Number(process.env.VELMERE_ORDER_EVENT_WRITE_TIMEOUT_MS ?? 1_200) || 1_200, 3_000));
}

function getIdempotencyTtlSeconds() {
  return Math.max(
    60 * 60 * 24,
    Math.min(Number(process.env.VELMERE_ORDER_EVENT_IDEMPOTENCY_TTL_SECONDS ?? 60 * 60 * 24 * 120) || 60 * 60 * 24 * 120, 60 * 60 * 24 * 366),
  );
}

function storageIdempotencyKey(event: OrderEventReceipt) {
  const safe = normalizeKey(event.idempotencyKey || event.eventId, event.eventId);
  return `velmere:orders:event-ledger:idempotency:${stableHash(safe)}:${safe.slice(0, 72)}`;
}

function buildEnvelope(event: OrderEventReceipt): StoredOrderEventEnvelope {
  return {
    schemaVersion: "velmere.order-event-storage-envelope.v1",
    storedAt: new Date().toISOString(),
    event: {
      ...event,
      evidence: event.evidence,
      redactionBoundary: event.redactionBoundary,
    },
    redactionBoundary: {
      rawCustomerPiiStored: false,
      rawProviderPayloadStored: false,
      secretsStored: false,
      allowedFields: [
        "orderDraftId",
        "stripeSessionId",
        "stripeEventId",
        "providerOrderId",
        "status transition",
        "guard and reservation receipts",
        "product ids",
        "provider ids",
        "reason codes",
        "checksum",
      ],
    },
  };
}

function baseResult(event: OrderEventReceipt, overrides: Partial<OrderEventStorageResult>): OrderEventStorageResult {
  const mode = overrides.mode ?? getMode();
  return {
    schemaVersion: "velmere.order-event-storage-result.v1",
    ok: false,
    persisted: false,
    durableWrite: false,
    mode,
    provider: overrides.provider ?? getProvider(mode),
    attempted: false,
    eventId: event.eventId,
    orderDraftId: event.orderDraftId,
    eventType: event.eventType,
    writtenEventCount: 0,
    duplicateEventCount: 0,
    ledgerKey: null,
    orderTimelineKey: null,
    idempotencyKey: storageIdempotencyKey(event),
    productionBoundary:
      "Order event storage stores only redacted operational receipts. It never stores raw customer PII, provider payloads, authorization headers, webhook signatures or secrets.",
    ...overrides,
  };
}

function appendMemory(event: OrderEventReceipt, mode: OrderEventStorageMode, providerError?: string) {
  const runtime = getRuntime();
  const envelope = buildEnvelope(event);
  runtime.memoryEvents.unshift(envelope);
  if (runtime.memoryEvents.length > MAX_MEMORY_EVENTS) runtime.memoryEvents.length = MAX_MEMORY_EVENTS;

  const existing = runtime.memoryByOrder.get(event.orderDraftId) ?? [];
  runtime.memoryByOrder.set(event.orderDraftId, [envelope, ...existing].slice(0, getMaxOrderEvents()));

  return pushAttempt(
    baseResult(event, {
      ok: mode !== "upstash_fallback_memory",
      persisted: false,
      durableWrite: false,
      mode,
      provider: mode === "memory_only" ? "memory" : "upstash",
      attempted: mode === "upstash_fallback_memory",
      writtenEventCount: 1,
      ledgerKey: mode === "memory_only" ? "memory:orders:event-ledger" : getLedgerKey(),
      orderTimelineKey: mode === "memory_only" ? `memory:orders:timeline:${event.orderDraftId}` : orderTimelineKey(event.orderDraftId),
      providerError,
    }),
  );
}

async function appendToUpstash(event: OrderEventReceipt): Promise<OrderEventStorageResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return appendMemory(event, "memory_only", "upstash_env_missing");

  const ledgerKey = getLedgerKey();
  const timelineKey = orderTimelineKey(event.orderDraftId);
  const idempotencyKey = storageIdempotencyKey(event);
  const envelope = JSON.stringify(buildEnvelope(event));
  const lua = [
    "if redis.call('EXISTS', KEYS[1]) == 1 then return {0, 1} end",
    "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])",
    "redis.call('LPUSH', KEYS[2], ARGV[3])",
    "redis.call('LTRIM', KEYS[2], 0, tonumber(ARGV[4]) - 1)",
    "redis.call('LPUSH', KEYS[3], ARGV[3])",
    "redis.call('LTRIM', KEYS[3], 0, tonumber(ARGV[5]) - 1)",
    "return {1, 0}",
  ].join("\n");

  try {
    const result = await executeUpstashRestEval<unknown>({
      script: lua,
      keys: [idempotencyKey, ledgerKey, timelineKey],
      argv: [
        event.eventId,
        String(getIdempotencyTtlSeconds()),
        envelope,
        String(getMaxGlobalEvents()),
        String(getMaxOrderEvents()),
      ],
      config: { url: url.replace(/\/$/, ""), token, provider: "upstash" },
      timeoutMs: getTimeoutMs(),
      operation: "order_event_atomic_append",
    });
    const values = Array.isArray(result) ? result : [];
    const written = Number(values[0]) === 1;
    const duplicate = Number(values[1]) === 1;
    if (!written && !duplicate) throw new Error("upstash_order_event_eval_result_invalid");
    return pushAttempt(
      baseResult(event, {
        ok: true,
        persisted: true,
        durableWrite: true,
        mode: "upstash_list",
        provider: "upstash",
        attempted: true,
        writtenEventCount: written ? 1 : 0,
        duplicateEventCount: duplicate ? 1 : 0,
        ledgerKey,
        orderTimelineKey: timelineKey,
        idempotencyKey,
      }),
    );
  } catch (error) {
    return appendMemory(event, "upstash_fallback_memory", error instanceof Error ? error.message.slice(0, 180) : "upstash_unknown_error");
  }
}

export async function appendOrderEventToStorageBestEffort(event: OrderEventReceipt): Promise<OrderEventStorageResult> {
  const mode = getMode();
  if (mode === "disabled") {
    return pushAttempt(
      baseResult(event, {
        ok: true,
        mode,
        provider: "none",
        attempted: false,
        providerError: "order_event_storage_disabled_by_env",
      }),
    );
  }
  if (mode === "memory_only") return appendMemory(event, "memory_only");
  return appendToUpstash(event);
}

export function queueOrderEventStorageWrite(event: OrderEventReceipt) {
  const runtime = getRuntime();
  const pending = appendOrderEventToStorageBestEffort(event).finally(() => {
    runtime.pendingWrites.delete(pending);
  });
  runtime.pendingWrites.add(pending);
}

export async function flushOrderEventStorageWrites() {
  const runtime = getRuntime();
  const pending = Array.from(runtime.pendingWrites);
  if (pending.length === 0) return [];
  return Promise.allSettled(pending);
}

function parseStoredEventEnvelope(value: unknown): StoredOrderEventEnvelope | null {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const parsed = JSON.parse(text) as StoredOrderEventEnvelope;
    if (parsed?.schemaVersion !== "velmere.order-event-storage-envelope.v1") return null;
    if (!parsed.event?.eventId || !parsed.event?.orderDraftId) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readUpstashList(key: string, limit: number): Promise<StoredOrderEventEnvelope[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 500));
  try {
    const result = await executeUpstashRestCommand<unknown[]>(["LRANGE", key, 0, boundedLimit - 1], {
      timeoutMs: getTimeoutMs(),
      maxResponseBytes: 4_194_304,
      operation: "order_event_storage_read",
    });
    return (Array.isArray(result) ? result : [])
      .map((entry: unknown) => parseStoredEventEnvelope(entry))
      .filter((entry): entry is StoredOrderEventEnvelope => Boolean(entry));
  } catch {
    return [];
  }
}

export async function listDurableOrderEvents(limit = 80): Promise<OrderEventReceipt[]> {
  const mode = getMode();
  if (mode === "upstash_list") {
    const events = await readUpstashList(getLedgerKey(), limit);
    if (events.length > 0) return events.map((entry) => entry.event);
  }
  return getRuntime().memoryEvents.slice(0, Math.max(1, Math.min(limit, 500))).map((entry) => entry.event);
}

export async function getDurableOrderTimeline(orderDraftId: string, limit = 160): Promise<OrderEventReceipt[]> {
  const mode = getMode();
  if (mode === "upstash_list") {
    const events = await readUpstashList(orderTimelineKey(orderDraftId), limit);
    if (events.length > 0) return events.map((entry) => entry.event).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }
  return (getRuntime().memoryByOrder.get(orderDraftId) ?? [])
    .slice(0, Math.max(1, Math.min(limit, 500)))
    .map((entry) => entry.event)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function buildOrderEventStorageReadiness(): OrderEventStorageReadiness {
  const runtime = getRuntime();
  const mode = getMode();
  const recentAttempts = runtime.recentAttempts.slice(0, 30);
  return {
    schemaVersion: "velmere.order-event-storage-readiness.v1",
    mode,
    provider: getProvider(mode),
    hasUpstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    ledgerKeyConfigured: Boolean(process.env.VELMERE_ORDER_EVENT_UPSTASH_KEY),
    orderTimelinePrefixConfigured: Boolean(process.env.VELMERE_ORDER_TIMELINE_UPSTASH_PREFIX),
    maxGlobalEvents: getMaxGlobalEvents(),
    maxOrderEvents: getMaxOrderEvents(),
    pendingWriteCount: runtime.pendingWrites.size,
    recentAttempts,
    recentFailureCount: recentAttempts.filter((attempt) => !attempt.ok || attempt.mode === "upstash_fallback_memory").length,
    memoryEventCount: runtime.memoryEvents.length,
    durableStorageReady: mode === "upstash_list" && Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    productionBoundary:
      "Durable order event storage uses redacted append-only event envelopes. Public/customer surfaces must not expose raw webhook payloads, addresses, emails, provider payloads or secrets.",
  };
}
