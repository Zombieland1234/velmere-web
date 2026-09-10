import { executeUpstashRestCommand, executeUpstashRestEval } from "@/lib/security/upstash-rest-atomic";
import { sha256Hex } from "@/lib/security/cryptographic-digest";
import { appendOrderEvent, type OrderEventLineSnapshot, type OrderEventReceipt } from "@/lib/orders/order-event-ledger";
import {
  buildOrderReplaySnapshotIntegrity,
  buildOrderReplaySnapshotRestoreGate,
  type OrderReplaySnapshotIntegrity,
  type OrderReplaySnapshotRestoreGate,
} from "@/lib/orders/order-replay-snapshot-hardening";
import { flushOrderEventStorageWrites } from "@/lib/orders/order-event-storage";
import { buildOrderReplaySnapshot, getOrder, restoreOrderFromReplaySnapshot, type OrderReplaySnapshot } from "@/lib/orders/order-store";
import {
  executeProviderFulfilmentRetry,
  previewProviderFulfilmentRetry,
  type ProviderFulfilmentRetryReceipt,
} from "@/lib/orders/provider-fulfilment-retry";

export type ProviderFulfilmentRetryQueueState =
  | "queued"
  | "replay_started"
  | "replay_created"
  | "replay_blocked"
  | "replay_failed"
  | "discarded";

export type ProviderFulfilmentRetryQueueMode = "memory_only" | "upstash_list" | "upstash_fallback_memory" | "disabled";
export type ProviderFulfilmentRetryQueueProvider = "memory" | "upstash" | "none";

export type ProviderFulfilmentRetryQueueItem = {
  schemaVersion: "velmere.provider-fulfilment-retry-queue.v1";
  queueId: string;
  idempotencyKey: string;
  caseId: string;
  orderDraftId: string;
  createdAt: string;
  updatedAt: string;
  operatorId: string;
  state: ProviderFulfilmentRetryQueueState;
  replayCount: number;
  maxReplayCount: number;
  nextReplayAfter?: string;
  lastReplayAt?: string;
  lastEventIds: string[];
  latestRetryReceipt?: ProviderFulfilmentRetryReceipt;
  initialPreviewReceipt: ProviderFulfilmentRetryReceipt;
  orderSnapshot?: OrderReplaySnapshot;
  snapshotIntegrity: OrderReplaySnapshotIntegrity;
  replayRestoreGate: OrderReplaySnapshotRestoreGate;
  reasonCodes: string[];
  replayFingerprint: string;
  checksum: string;
  redactionBoundary: {
    rawCustomerPiiStored: false;
    rawProviderPayloadStored: false;
    secretsStored: false;
    allowedFields: string[];
  };
};

export type ProviderFulfilmentRetryQueueStorageResult = {
  schemaVersion: "velmere.provider-fulfilment-retry-queue-storage-result.v1";
  ok: boolean;
  persisted: boolean;
  durableWrite: boolean;
  mode: ProviderFulfilmentRetryQueueMode;
  provider: ProviderFulfilmentRetryQueueProvider;
  attempted: boolean;
  queueId: string;
  orderDraftId: string;
  state: ProviderFulfilmentRetryQueueState;
  queueKey: string | null;
  orderQueueKey: string | null;
  idempotencyKey: string;
  writtenItemCount: number;
  duplicateItemCount: number;
  providerError?: string;
  productionBoundary: string;
};

export type ProviderFulfilmentRetryQueueReadiness = {
  schemaVersion: "velmere.provider-fulfilment-retry-queue-readiness.v1";
  mode: ProviderFulfilmentRetryQueueMode;
  provider: ProviderFulfilmentRetryQueueProvider;
  hasUpstashUrl: boolean;
  hasUpstashToken: boolean;
  queueKeyConfigured: boolean;
  orderQueuePrefixConfigured: boolean;
  maxGlobalItems: number;
  maxOrderItems: number;
  pendingWriteCount: number;
  recentAttempts: ProviderFulfilmentRetryQueueStorageResult[];
  recentFailureCount: number;
  memoryQueueItemCount: number;
  snapshotVerifiedCount: number;
  snapshotWarningCount: number;
  snapshotBlockedCount: number;
  durableReplayReadyCount: number;
  durableQueueReady: boolean;
  productionBoundary: string;
};

type RetryQueueEnvelope = {
  schemaVersion: "velmere.provider-fulfilment-retry-queue-envelope.v1";
  storedAt: string;
  item: ProviderFulfilmentRetryQueueItem;
  redactionBoundary: ProviderFulfilmentRetryQueueItem["redactionBoundary"];
};

type RetryQueueRuntime = {
  memoryItems: RetryQueueEnvelope[];
  memoryByOrder: Map<string, RetryQueueEnvelope[]>;
  recentAttempts: ProviderFulfilmentRetryQueueStorageResult[];
  pendingWrites: Set<Promise<ProviderFulfilmentRetryQueueStorageResult>>;
};

const MAX_ATTEMPTS = 120;
const DEFAULT_MAX_REPLAYS = 5;

function getRuntime(): RetryQueueRuntime {
  const globalStore = globalThis as typeof globalThis & { __velmereProviderFulfilmentRetryQueue?: RetryQueueRuntime };
  if (!globalStore.__velmereProviderFulfilmentRetryQueue) {
    globalStore.__velmereProviderFulfilmentRetryQueue = {
      memoryItems: [],
      memoryByOrder: new Map(),
      recentAttempts: [],
      pendingWrites: new Set(),
    };
  }
  return globalStore.__velmereProviderFulfilmentRetryQueue;
}

function sha(value: unknown, prefix: string, length = 18) {
  return `${prefix}_${sha256Hex(JSON.stringify(value)).slice(0, length)}`;
}

function now() {
  return new Date().toISOString();
}

function normalizeKey(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/[^a-zA-Z0-9:_@.-]/g, "_").slice(0, 180);
}

function shortHash(input: string) {
  return sha256Hex(input).slice(0, 24);
}

function getMode(): ProviderFulfilmentRetryQueueMode {
  if (process.env.VELMERE_PROVIDER_RETRY_QUEUE_DISABLED === "1") return "disabled";
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return "upstash_list";
  return "memory_only";
}

function getProvider(mode: ProviderFulfilmentRetryQueueMode): ProviderFulfilmentRetryQueueProvider {
  if (mode === "upstash_list" || mode === "upstash_fallback_memory") return "upstash";
  if (mode === "memory_only") return "memory";
  return "none";
}

function getQueueKey() {
  return normalizeKey(process.env.VELMERE_PROVIDER_RETRY_QUEUE_UPSTASH_KEY, "velmere:orders:provider-retry-queue");
}

function getOrderQueuePrefix() {
  return normalizeKey(process.env.VELMERE_PROVIDER_RETRY_QUEUE_ORDER_PREFIX, "velmere:orders:provider-retry-queue:order");
}

function getMaxGlobalItems() {
  return Math.max(50, Math.min(Number(process.env.VELMERE_PROVIDER_RETRY_QUEUE_MAX_GLOBAL ?? 1_000) || 1_000, 5_000));
}

function getMaxOrderItems() {
  return Math.max(20, Math.min(Number(process.env.VELMERE_PROVIDER_RETRY_QUEUE_MAX_PER_ORDER ?? 120) || 120, 1_000));
}

function getTimeoutMs() {
  return Math.max(300, Math.min(Number(process.env.VELMERE_PROVIDER_RETRY_QUEUE_TIMEOUT_MS ?? 1_200) || 1_200, 3_000));
}

function getIdempotencyTtlSeconds() {
  return Math.max(
    60 * 60 * 24,
    Math.min(Number(process.env.VELMERE_PROVIDER_RETRY_QUEUE_IDEMPOTENCY_TTL_SECONDS ?? 60 * 60 * 24 * 120) || 60 * 60 * 24 * 120, 60 * 60 * 24 * 366),
  );
}

function getMaxReplays() {
  return Math.max(1, Math.min(Number(process.env.VELMERE_PROVIDER_RETRY_QUEUE_MAX_REPLAYS ?? DEFAULT_MAX_REPLAYS) || DEFAULT_MAX_REPLAYS, 20));
}

function orderQueueKey(orderDraftId: string) {
  const safeOrder = normalizeKey(orderDraftId, "unknown-order");
  return `${getOrderQueuePrefix()}:${shortHash(safeOrder)}:${safeOrder.slice(0, 72)}`;
}

function storageIdempotencyKey(item: ProviderFulfilmentRetryQueueItem) {
  const safe = normalizeKey(item.idempotencyKey, item.queueId);
  return `velmere:orders:provider-retry-queue:idempotency:${shortHash(safe)}:${safe.slice(0, 72)}`;
}

function redactionBoundary(): ProviderFulfilmentRetryQueueItem["redactionBoundary"] {
  return {
    rawCustomerPiiStored: false,
    rawProviderPayloadStored: false,
    secretsStored: false,
    allowedFields: [
      "orderDraftId",
      "queue id",
      "retry receipt ids",
      "order event ids",
      "provider name",
      "provider order id",
      "provider variant readiness counts",
      "redacted order replay snapshot",
      "snapshot integrity checksum and restore gate",
      "reason codes",
      "replay count",
      "checksums",
    ],
  };
}

function fingerprintFromPreview(preview: ProviderFulfilmentRetryReceipt) {
  return sha(
    {
      orderDraftId: preview.orderDraftId,
      provider: preview.provider,
      currentStatus: preview.currentStatus,
      canRetry: preview.canRetry,
      readiness: preview.readiness,
      reasonCodes: preview.reasonCodes,
      nextAction: preview.nextAction,
    },
    "pfretryfp",
    22,
  );
}

function buildQueueItem(input: {
  orderDraftId: string;
  operatorId: string;
  state?: ProviderFulfilmentRetryQueueState;
  initialPreviewReceipt?: ProviderFulfilmentRetryReceipt;
  latestRetryReceipt?: ProviderFulfilmentRetryReceipt;
  previous?: ProviderFulfilmentRetryQueueItem | null;
  eventIds?: string[];
  nextReplayAfter?: string;
}): ProviderFulfilmentRetryQueueItem {
  const createdAt = input.previous?.createdAt ?? now();
  const updatedAt = now();
  const preview = input.initialPreviewReceipt ?? input.previous?.initialPreviewReceipt ?? previewProviderFulfilmentRetry(input.orderDraftId);
  const liveOrder = getOrder(input.orderDraftId);
  const orderSnapshot = input.previous?.orderSnapshot ?? (liveOrder ? buildOrderReplaySnapshot(liveOrder) : undefined);
  const snapshotIntegrity = buildOrderReplaySnapshotIntegrity(orderSnapshot, input.orderDraftId);
  const replayRestoreGate = buildOrderReplaySnapshotRestoreGate({
    snapshot: orderSnapshot,
    expectedOrderDraftId: input.orderDraftId,
    liveOrderAvailable: Boolean(liveOrder),
  });
  const fingerprint = input.previous?.replayFingerprint ?? fingerprintFromPreview(preview);
  const queueId = input.previous?.queueId ?? sha({ orderDraftId: input.orderDraftId, fingerprint }, "pfretryq", 20);
  const state = input.state ?? input.previous?.state ?? "queued";
  const replayCount = state === "replay_started" || state.startsWith("replay_")
    ? (input.previous?.replayCount ?? 0) + (state === "replay_started" ? 0 : 1)
    : (input.previous?.replayCount ?? 0);
  const reasonCodes = Array.from(new Set([
    ...(preview.reasonCodes ?? []),
    ...(input.latestRetryReceipt?.reasonCodes ?? []),
    ...(input.previous?.reasonCodes ?? []),
  ])).slice(0, 50);
  const checksum = sha(
    {
      queueId,
      orderDraftId: input.orderDraftId,
      state,
      replayCount,
      initialPreviewReceiptId: preview.receiptId,
      latestRetryReceiptId: input.latestRetryReceipt?.receiptId ?? input.previous?.latestRetryReceipt?.receiptId,
      snapshotChecksum: snapshotIntegrity.checksum,
      snapshotStatus: snapshotIntegrity.status,
      reasonCodes,
    },
    "pfretryqchk",
    24,
  );
  return {
    schemaVersion: "velmere.provider-fulfilment-retry-queue.v1",
    queueId,
    idempotencyKey: `provider_retry_queue:${input.orderDraftId}:${fingerprint}:${state}:${input.latestRetryReceipt?.receiptId ?? "initial"}`,
    caseId: preview.caseId,
    orderDraftId: input.orderDraftId,
    createdAt,
    updatedAt,
    operatorId: normalizeKey(input.operatorId, "operator"),
    state,
    replayCount,
    maxReplayCount: getMaxReplays(),
    nextReplayAfter: input.nextReplayAfter,
    lastReplayAt: state.startsWith("replay_") ? updatedAt : input.previous?.lastReplayAt,
    lastEventIds: (input.eventIds ?? input.latestRetryReceipt?.eventIds ?? input.previous?.lastEventIds ?? []).slice(0, 20),
    latestRetryReceipt: input.latestRetryReceipt ?? input.previous?.latestRetryReceipt,
    initialPreviewReceipt: preview,
    orderSnapshot,
    snapshotIntegrity,
    replayRestoreGate,
    reasonCodes,
    replayFingerprint: fingerprint,
    checksum,
    redactionBoundary: redactionBoundary(),
  };
}

function buildEnvelope(item: ProviderFulfilmentRetryQueueItem): RetryQueueEnvelope {
  return {
    schemaVersion: "velmere.provider-fulfilment-retry-queue-envelope.v1",
    storedAt: now(),
    item,
    redactionBoundary: item.redactionBoundary,
  };
}

function baseStorageResult(item: ProviderFulfilmentRetryQueueItem, overrides: Partial<ProviderFulfilmentRetryQueueStorageResult>): ProviderFulfilmentRetryQueueStorageResult {
  const mode = overrides.mode ?? getMode();
  return {
    schemaVersion: "velmere.provider-fulfilment-retry-queue-storage-result.v1",
    ok: false,
    persisted: false,
    durableWrite: false,
    mode,
    provider: overrides.provider ?? getProvider(mode),
    attempted: false,
    queueId: item.queueId,
    orderDraftId: item.orderDraftId,
    state: item.state,
    queueKey: null,
    orderQueueKey: null,
    idempotencyKey: storageIdempotencyKey(item),
    writtenItemCount: 0,
    duplicateItemCount: 0,
    productionBoundary:
      "Provider retry queue stores only redacted replay receipts and reason codes. It never stores customer PII, raw provider payloads, authorization headers, webhook signatures or secrets.",
    ...overrides,
  };
}

function pushAttempt(result: ProviderFulfilmentRetryQueueStorageResult) {
  const runtime = getRuntime();
  runtime.recentAttempts.unshift(result);
  if (runtime.recentAttempts.length > MAX_ATTEMPTS) runtime.recentAttempts.length = MAX_ATTEMPTS;
  return result;
}

function appendMemory(item: ProviderFulfilmentRetryQueueItem, mode: ProviderFulfilmentRetryQueueMode, providerError?: string) {
  const runtime = getRuntime();
  const envelope = buildEnvelope(item);
  runtime.memoryItems.unshift(envelope);
  if (runtime.memoryItems.length > getMaxGlobalItems()) runtime.memoryItems.length = getMaxGlobalItems();
  const byOrder = runtime.memoryByOrder.get(item.orderDraftId) ?? [];
  runtime.memoryByOrder.set(item.orderDraftId, [envelope, ...byOrder].slice(0, getMaxOrderItems()));
  return pushAttempt(
    baseStorageResult(item, {
      ok: mode !== "upstash_fallback_memory",
      persisted: false,
      durableWrite: false,
      mode,
      provider: mode === "memory_only" ? "memory" : "upstash",
      attempted: mode === "upstash_fallback_memory",
      queueKey: mode === "memory_only" ? "memory:orders:provider-retry-queue" : getQueueKey(),
      orderQueueKey: mode === "memory_only" ? `memory:orders:provider-retry-queue:${item.orderDraftId}` : orderQueueKey(item.orderDraftId),
      writtenItemCount: 1,
      providerError,
    }),
  );
}

async function appendToUpstash(item: ProviderFulfilmentRetryQueueItem): Promise<ProviderFulfilmentRetryQueueStorageResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return appendMemory(item, "memory_only", "upstash_env_missing");
  const queueKey = getQueueKey();
  const itemOrderQueueKey = orderQueueKey(item.orderDraftId);
  const idempotencyKey = storageIdempotencyKey(item);
  const envelope = JSON.stringify(buildEnvelope(item));
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
      keys: [idempotencyKey, queueKey, itemOrderQueueKey],
      argv: [
        item.queueId,
        String(getIdempotencyTtlSeconds()),
        envelope,
        String(getMaxGlobalItems()),
        String(getMaxOrderItems()),
      ],
      config: { url: url.replace(/\/$/, ""), token, provider: "upstash" },
      timeoutMs: getTimeoutMs(),
      operation: "provider_fulfilment_retry_atomic_append",
    });
    const values = Array.isArray(result) ? result : [];
    const written = Number(values[0]) === 1;
    const duplicate = Number(values[1]) === 1;
    if (!written && !duplicate) throw new Error("upstash_provider_retry_eval_result_invalid");
    return pushAttempt(baseStorageResult(item, {
      ok: true,
      persisted: true,
      durableWrite: true,
      mode: "upstash_list",
      provider: "upstash",
      attempted: true,
      queueKey,
      orderQueueKey: itemOrderQueueKey,
      writtenItemCount: written ? 1 : 0,
      duplicateItemCount: duplicate ? 1 : 0,
      idempotencyKey,
    }));
  } catch (error) {
    return appendMemory(item, "upstash_fallback_memory", error instanceof Error ? error.message.slice(0, 180) : "upstash_unknown_error");
  }
}

export async function appendProviderFulfilmentRetryQueueItem(item: ProviderFulfilmentRetryQueueItem) {
  const mode = getMode();
  if (mode === "disabled") {
    return pushAttempt(baseStorageResult(item, {
      ok: true,
      mode,
      provider: "none",
      providerError: "provider_retry_queue_disabled_by_env",
    }));
  }
  if (mode === "memory_only") return appendMemory(item, "memory_only");
  return appendToUpstash(item);
}

function queueWrite(item: ProviderFulfilmentRetryQueueItem) {
  const runtime = getRuntime();
  const pending = appendProviderFulfilmentRetryQueueItem(item).finally(() => runtime.pendingWrites.delete(pending));
  runtime.pendingWrites.add(pending);
  return pending;
}

export async function flushProviderFulfilmentRetryQueueWrites() {
  const runtime = getRuntime();
  const pending = Array.from(runtime.pendingWrites);
  if (pending.length === 0) return [];
  return Promise.allSettled(pending);
}

function hydrateQueueItem(item: ProviderFulfilmentRetryQueueItem): ProviderFulfilmentRetryQueueItem {
  const raw = item as Partial<ProviderFulfilmentRetryQueueItem>;
  const snapshotIntegrity = raw.snapshotIntegrity ?? buildOrderReplaySnapshotIntegrity(raw.orderSnapshot, raw.orderDraftId);
  const replayRestoreGate = raw.replayRestoreGate ?? buildOrderReplaySnapshotRestoreGate({
    snapshot: raw.orderSnapshot,
    expectedOrderDraftId: raw.orderDraftId,
    liveOrderAvailable: Boolean(raw.orderDraftId ? getOrder(raw.orderDraftId) : null),
  });
  return {
    ...item,
    snapshotIntegrity,
    replayRestoreGate,
  };
}

function parseEnvelope(value: unknown): RetryQueueEnvelope | null {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const parsed = JSON.parse(text) as RetryQueueEnvelope;
    if (parsed?.schemaVersion !== "velmere.provider-fulfilment-retry-queue-envelope.v1") return null;
    if (!parsed.item?.queueId || !parsed.item?.orderDraftId) return null;
    return { ...parsed, item: hydrateQueueItem(parsed.item) };
  } catch {
    return null;
  }
}

async function readUpstashList(key: string, limit: number): Promise<RetryQueueEnvelope[]> {
  const bounded = Math.max(1, Math.min(limit, 500));
  try {
    const result = await executeUpstashRestCommand<unknown[]>(["LRANGE", key, 0, bounded - 1], {
      timeoutMs: getTimeoutMs(),
      maxResponseBytes: 4_194_304,
      operation: "provider_fulfilment_retry_queue_read",
    });
    return (Array.isArray(result) ? result : [])
      .map((entry: unknown) => parseEnvelope(entry))
      .filter((entry): entry is RetryQueueEnvelope => Boolean(entry));
  } catch {
    return [];
  }
}

function latestByQueueId(envelopes: RetryQueueEnvelope[]) {
  const map = new Map<string, ProviderFulfilmentRetryQueueItem>();
  for (const envelope of envelopes) {
    const existing = map.get(envelope.item.queueId);
    if (!existing || Date.parse(envelope.item.updatedAt) > Date.parse(existing.updatedAt)) map.set(envelope.item.queueId, envelope.item);
  }
  return Array.from(map.values()).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function listProviderFulfilmentRetryQueueItems(limit = 80) {
  const mode = getMode();
  if (mode === "upstash_list") {
    const durable = await readUpstashList(getQueueKey(), limit);
    if (durable.length > 0) return latestByQueueId(durable).slice(0, Math.max(1, Math.min(limit, 200)));
  }
  return latestByQueueId(getRuntime().memoryItems).slice(0, Math.max(1, Math.min(limit, 200)));
}

export async function listProviderFulfilmentRetryQueueItemsForOrder(orderDraftId: string, limit = 40) {
  const mode = getMode();
  if (mode === "upstash_list") {
    const durable = await readUpstashList(orderQueueKey(orderDraftId), limit);
    if (durable.length > 0) return latestByQueueId(durable).slice(0, Math.max(1, Math.min(limit, 100)));
  }
  return latestByQueueId(getRuntime().memoryByOrder.get(orderDraftId) ?? []).slice(0, Math.max(1, Math.min(limit, 100)));
}

export async function getLatestProviderFulfilmentRetryQueueItem(orderDraftId: string) {
  const items = await listProviderFulfilmentRetryQueueItemsForOrder(orderDraftId, 40);
  return items[0] ?? null;
}

function latestByQueueIdFromItems(items: ProviderFulfilmentRetryQueueItem[], queueId: string) {
  return items.find((item) => item.queueId === queueId) ?? null;
}

function eventLineItemsFromSnapshot(item: ProviderFulfilmentRetryQueueItem): OrderEventLineSnapshot[] {
  return (item.orderSnapshot?.lineItems ?? []).map((line) => ({
    productId: line.productId,
    variantId: line.variantId,
    provider: line.provider,
    providerVariantId: line.providerVariantId,
    fulfilmentMode: line.fulfilmentMode,
    selectedSize: line.selectedSize,
    quantity: line.quantity,
    amount: line.amount,
    currency: line.currency,
  }));
}

function appendQueueEvent(item: ProviderFulfilmentRetryQueueItem, eventType: "provider_draft_retry_queued" | "provider_draft_retry_replay_started" | "provider_draft_retry_replay_discarded", operatorId: string): OrderEventReceipt {
  return appendOrderEvent({
    orderDraftId: item.orderDraftId,
    eventType,
    actor: "operator",
    sourceRoute: "app.api.admin.orders.fulfilment-retry-queue",
    severity: eventType === "provider_draft_retry_replay_discarded" ? "review" : "info",
    guardSummary: item.orderSnapshot?.guardSummary,
    stripeSessionId: item.orderSnapshot?.stripeSessionId ?? item.initialPreviewReceipt.stripeSessionId,
    lineItems: eventLineItemsFromSnapshot(item),
    reasonCodes: item.reasonCodes.length ? item.reasonCodes : [eventType],
    evidence: {
      operatorId,
      queueId: item.queueId,
      queueState: item.state,
      queueChecksum: item.checksum,
      replayCount: item.replayCount,
      latestRetryReceiptId: item.latestRetryReceipt?.receiptId ?? null,
      replaySnapshotAvailable: Boolean(item.orderSnapshot),
      snapshotIntegrityStatus: item.snapshotIntegrity.status,
      snapshotChecksum: item.snapshotIntegrity.checksum,
      replayRestoreGate: item.replayRestoreGate.nextAction,
    },
    idempotencyKey: `provider_retry_queue_event:${item.queueId}:${eventType}:${item.checksum}`,
  });
}

export async function enqueueProviderFulfilmentRetry(orderDraftId: string, operatorId = "admin") {
  const preview = previewProviderFulfilmentRetry(orderDraftId);
  const existing = await getLatestProviderFulfilmentRetryQueueItem(orderDraftId);
  const fingerprint = fingerprintFromPreview(preview);
  const activeDuplicate = existing?.state === "queued" && existing.replayFingerprint === fingerprint;
  const item = activeDuplicate
    ? existing
    : buildQueueItem({ orderDraftId, operatorId, state: "queued", initialPreviewReceipt: preview });
  const event = activeDuplicate ? null : appendQueueEvent(item, "provider_draft_retry_queued", operatorId);
  const storage = await queueWrite(item);
  await Promise.allSettled([flushOrderEventStorageWrites(), flushProviderFulfilmentRetryQueueWrites()]);
  return {
    schemaVersion: "velmere.provider-fulfilment-retry-queue-enqueue-result.v1" as const,
    item,
    previewReceipt: preview,
    queuedEvent: event,
    storage,
    duplicate: activeDuplicate,
  };
}

export async function replayProviderFulfilmentRetryQueue(input: { orderDraftId?: string; queueId?: string; operatorId?: string }) {
  const operatorId = input.operatorId ?? "admin";
  const candidates = input.orderDraftId
    ? await listProviderFulfilmentRetryQueueItemsForOrder(input.orderDraftId, 80)
    : await listProviderFulfilmentRetryQueueItems(120);
  const existing = input.queueId ? latestByQueueIdFromItems(candidates, input.queueId) : candidates[0] ?? null;
  if (!existing) {
    return {
      schemaVersion: "velmere.provider-fulfilment-retry-queue-replay-result.v1" as const,
      item: null,
      retryReceipt: null,
      startedEvent: null,
      storage: null,
      error: "queued_retry_not_found",
    };
  }
  if (existing.state === "discarded") {
    return {
      schemaVersion: "velmere.provider-fulfilment-retry-queue-replay-result.v1" as const,
      item: existing,
      retryReceipt: existing.latestRetryReceipt ?? null,
      startedEvent: null,
      storage: null,
      error: "queued_retry_discarded",
    };
  }
  if (existing.replayCount >= existing.maxReplayCount) {
    const blocked = buildQueueItem({
      orderDraftId: existing.orderDraftId,
      operatorId,
      previous: existing,
      state: "replay_blocked",
      latestRetryReceipt: existing.latestRetryReceipt,
      nextReplayAfter: existing.nextReplayAfter,
    });
    const storage = await queueWrite(blocked);
    await flushProviderFulfilmentRetryQueueWrites();
    return {
      schemaVersion: "velmere.provider-fulfilment-retry-queue-replay-result.v1" as const,
      item: blocked,
      retryReceipt: blocked.latestRetryReceipt ?? null,
      startedEvent: null,
      storage,
      error: "queued_retry_replay_limit_reached",
    };
  }

  const started = buildQueueItem({ orderDraftId: existing.orderDraftId, operatorId, previous: existing, state: "replay_started" });
  const startedEvent = appendQueueEvent(started, "provider_draft_retry_replay_started", operatorId);
  await queueWrite(started);
  const liveOrderBeforeReplay = getOrder(existing.orderDraftId);
  const restoreGate = buildOrderReplaySnapshotRestoreGate({
    snapshot: existing.orderSnapshot,
    expectedOrderDraftId: existing.orderDraftId,
    liveOrderAvailable: Boolean(liveOrderBeforeReplay),
  });
  if (!liveOrderBeforeReplay) {
    if (restoreGate.blocked || !existing.orderSnapshot) {
      const blocked = buildQueueItem({
        orderDraftId: existing.orderDraftId,
        operatorId,
        previous: started,
        state: "replay_blocked",
        latestRetryReceipt: existing.latestRetryReceipt,
        eventIds: [...started.lastEventIds, startedEvent.eventId],
        nextReplayAfter: undefined,
      });
      const storage = await queueWrite(blocked);
      await Promise.allSettled([flushOrderEventStorageWrites(), flushProviderFulfilmentRetryQueueWrites()]);
      return {
        schemaVersion: "velmere.provider-fulfilment-retry-queue-replay-result.v1" as const,
        item: blocked,
        retryReceipt: blocked.latestRetryReceipt ?? null,
        startedEvent,
        storage,
        restoreGate,
        error: "queued_retry_replay_snapshot_blocked",
      };
    }
    restoreOrderFromReplaySnapshot(existing.orderSnapshot, "provider fulfilment retry queue replay");
  }
  const retryReceipt = await executeProviderFulfilmentRetry(existing.orderDraftId, operatorId);
  const state: ProviderFulfilmentRetryQueueState = retryReceipt.outcome === "created"
    ? "replay_created"
    : retryReceipt.outcome === "failed"
      ? "replay_failed"
      : "replay_blocked";
  const replayed = buildQueueItem({
    orderDraftId: existing.orderDraftId,
    operatorId,
    previous: started,
    state,
    latestRetryReceipt: retryReceipt,
    eventIds: [...started.lastEventIds, startedEvent.eventId, ...retryReceipt.eventIds],
    nextReplayAfter: state === "replay_failed" ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : undefined,
  });
  const storage = await queueWrite(replayed);
  await Promise.allSettled([flushOrderEventStorageWrites(), flushProviderFulfilmentRetryQueueWrites()]);
  return {
    schemaVersion: "velmere.provider-fulfilment-retry-queue-replay-result.v1" as const,
    item: replayed,
    retryReceipt,
    startedEvent,
    storage,
    restoreGate,
    error: null,
  };
}

export async function discardProviderFulfilmentRetryQueue(input: { orderDraftId?: string; queueId?: string; operatorId?: string; reason?: string }) {
  const operatorId = input.operatorId ?? "admin";
  const candidates = input.orderDraftId
    ? await listProviderFulfilmentRetryQueueItemsForOrder(input.orderDraftId, 80)
    : await listProviderFulfilmentRetryQueueItems(120);
  const existing = input.queueId ? latestByQueueIdFromItems(candidates, input.queueId) : candidates[0] ?? null;
  if (!existing) {
    return { item: null, event: null, storage: null, error: "queued_retry_not_found" };
  }
  const discarded = buildQueueItem({
    orderDraftId: existing.orderDraftId,
    operatorId,
    previous: existing,
    state: "discarded",
    latestRetryReceipt: existing.latestRetryReceipt,
  });
  const event = appendQueueEvent(discarded, "provider_draft_retry_replay_discarded", operatorId);
  const storage = await queueWrite(discarded);
  await Promise.allSettled([flushOrderEventStorageWrites(), flushProviderFulfilmentRetryQueueWrites()]);
  return { item: discarded, event, storage, error: null };
}

export function buildProviderFulfilmentRetryQueueReadiness(): ProviderFulfilmentRetryQueueReadiness {
  const runtime = getRuntime();
  const mode = getMode();
  const recentAttempts = runtime.recentAttempts.slice(0, 30);
  const memoryItems = runtime.memoryItems.map((envelope) => envelope.item);
  const snapshotVerifiedCount = memoryItems.filter((item) => item.snapshotIntegrity.status === "verified").length;
  const snapshotWarningCount = memoryItems.filter((item) => item.snapshotIntegrity.status === "warning").length;
  const snapshotBlockedCount = memoryItems.filter((item) => item.snapshotIntegrity.status === "failed" || item.snapshotIntegrity.status === "missing").length;
  const durableReplayReadyCount = memoryItems.filter((item) => item.replayRestoreGate.canRestore && item.state !== "discarded").length;
  return {
    schemaVersion: "velmere.provider-fulfilment-retry-queue-readiness.v1",
    mode,
    provider: getProvider(mode),
    hasUpstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    queueKeyConfigured: Boolean(process.env.VELMERE_PROVIDER_RETRY_QUEUE_UPSTASH_KEY),
    orderQueuePrefixConfigured: Boolean(process.env.VELMERE_PROVIDER_RETRY_QUEUE_ORDER_PREFIX),
    maxGlobalItems: getMaxGlobalItems(),
    maxOrderItems: getMaxOrderItems(),
    pendingWriteCount: runtime.pendingWrites.size,
    recentAttempts,
    recentFailureCount: recentAttempts.filter((attempt) => !attempt.ok || attempt.mode === "upstash_fallback_memory").length,
    memoryQueueItemCount: runtime.memoryItems.length,
    snapshotVerifiedCount,
    snapshotWarningCount,
    snapshotBlockedCount,
    durableReplayReadyCount,
    durableQueueReady: mode === "upstash_list" && Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    productionBoundary:
      "Provider retry queue is redacted and replay-safe. PASS2060 adds snapshot integrity gates, so replay after serverless restart only restores from verified redacted snapshots and blocks unsafe snapshots for manual review.",
  };
}
