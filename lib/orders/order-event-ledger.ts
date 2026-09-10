import { createHash } from "node:crypto";
import { buildOrderEventStorageReadiness, queueOrderEventStorageWrite } from "@/lib/orders/order-event-storage";

export type OrderEventType =
  | "order_draft_created"
  | "checkout_started"
  | "payment_succeeded"
  | "payment_failed"
  | "provider_draft_requested"
  | "provider_draft_created"
  | "provider_draft_failed"
  | "provider_draft_retry_queued"
  | "provider_draft_retry_requested"
  | "provider_draft_retry_replay_started"
  | "provider_draft_retry_created"
  | "provider_draft_retry_blocked"
  | "provider_draft_retry_failed"
  | "provider_draft_retry_replay_discarded"
  | "fulfilment_pending"
  | "manual_fulfilment_required"
  | "fulfilled"
  | "order_failed"
  | "refund_partial"
  | "refunded"
  | "webhook_duplicate"
  | "webhook_unsupported";

export type OrderEventActor = "customer" | "stripe" | "printful" | "provider" | "system" | "operator";
export type OrderEventSeverity = "info" | "review" | "warning" | "error";
export type OrderEventStage = "checkout" | "payment" | "provider" | "fulfilment" | "support" | "audit";

export type OrderEventLineSnapshot = {
  productId: string;
  variantId?: string;
  provider?: string;
  providerVariantId?: string;
  fulfilmentMode?: string;
  selectedSize?: string;
  quantity: number;
  amount?: number;
  currency?: string;
};

export type OrderEventGuardSnapshot = {
  checkoutGuardReceiptId?: string;
  stockReservationReceiptId?: string;
  providerReservationId?: string;
  stockReservationMode?: string;
  stockReservationExpiresAt?: string;
};

export type OrderEventReceipt = {
  schemaVersion: "velmere.order-event-ledger.v1";
  eventId: string;
  idempotencyKey: string;
  caseId: string;
  orderDraftId: string;
  stripeSessionId?: string;
  stripeEventId?: string;
  providerOrderId?: string;
  providerReservationId?: string;
  createdAt: string;
  eventType: OrderEventType;
  stage: OrderEventStage;
  actor: OrderEventActor;
  sourceRoute: string;
  severity: OrderEventSeverity;
  statusBefore?: string;
  statusAfter?: string;
  progress: number;
  customerSafeLabel: string;
  operatorLabel: string;
  nextExpectedEvents: OrderEventType[];
  lineItemCount: number;
  productIds: string[];
  providerIds: string[];
  receiptIds: {
    checkoutGuardReceiptId?: string;
    stockReservationReceiptId?: string;
    providerReservationId?: string;
  };
  reasonCodes: string[];
  evidence: Record<string, unknown>;
  redactionBoundary: {
    rawCustomerPiiStored: false;
    rawProviderPayloadStored: false;
    secretsStored: false;
    allowedFields: string[];
  };
  checksum: string;
};

export type OrderEventInput = {
  orderDraftId: string;
  eventType: OrderEventType;
  actor: OrderEventActor;
  sourceRoute: string;
  severity?: OrderEventSeverity;
  statusBefore?: string;
  statusAfter?: string;
  stripeSessionId?: string;
  stripeEventId?: string;
  providerOrderId?: string | number;
  providerReservationId?: string;
  guardSummary?: OrderEventGuardSnapshot;
  lineItems?: OrderEventLineSnapshot[];
  reasonCodes?: string[];
  evidence?: Record<string, unknown>;
  idempotencyKey?: string;
};

export type OrderTimelineSummary = {
  schemaVersion: "velmere.order-event-timeline-summary.v1";
  orderDraftId: string;
  caseId: string;
  generatedAt: string;
  eventCount: number;
  latestStatus?: string;
  currentStage?: OrderEventStage;
  paymentConfirmed: boolean;
  providerDraftCreated: boolean;
  fulfilmentPending: boolean;
  failed: boolean;
  nextExpectedEvents: OrderEventType[];
  timeline: OrderEventReceipt[];
  customerSafeBoundary: string;
};

export type OrderEventLedgerReadiness = {
  schemaVersion: "velmere.order-event-ledger-readiness.v1";
  mode: "memory_timeline";
  durableWrite: false;
  durableStorageReady: boolean;
  storageMode: string;
  storageProvider: string;
  pendingStorageWriteCount: number;
  eventCount: number;
  orderCount: number;
  maxEvents: number;
  productionBoundary: string;
};

type OrderEventMemoryStore = {
  events: OrderEventReceipt[];
  byOrder: Map<string, string[]>;
  byIdempotency: Map<string, string>;
};

const MAX_EVENTS = 800;
const MAX_EVENTS_PER_ORDER = 80;

function getMemoryStore(): OrderEventMemoryStore {
  const globalStore = globalThis as typeof globalThis & { __velmereOrderEventLedger?: OrderEventMemoryStore };
  if (!globalStore.__velmereOrderEventLedger) {
    globalStore.__velmereOrderEventLedger = {
      events: [],
      byOrder: new Map(),
      byIdempotency: new Map(),
    };
  }
  return globalStore.__velmereOrderEventLedger;
}

function hashJson(value: unknown, prefix: string, length = 18) {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, length)}`;
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).slice(0, 40);
}

function caseIdFor(orderDraftId: string) {
  return hashJson({ orderDraftId }, "ordcase", 14);
}

function stageFor(eventType: OrderEventType): OrderEventStage {
  if (eventType === "order_draft_created" || eventType === "checkout_started") return "checkout";
  if (eventType === "payment_succeeded" || eventType === "payment_failed" || eventType === "webhook_duplicate" || eventType === "webhook_unsupported") return "payment";
  if (
    eventType === "provider_draft_requested" ||
    eventType === "provider_draft_created" ||
    eventType === "provider_draft_failed" ||
    eventType === "provider_draft_retry_queued" ||
    eventType === "provider_draft_retry_requested" ||
    eventType === "provider_draft_retry_replay_started" ||
    eventType === "provider_draft_retry_created" ||
    eventType === "provider_draft_retry_blocked" ||
    eventType === "provider_draft_retry_failed" ||
    eventType === "provider_draft_retry_replay_discarded"
  ) return "provider";
  if (eventType === "refund_partial") return "payment";
  if (eventType === "fulfilment_pending" || eventType === "manual_fulfilment_required" || eventType === "fulfilled" || eventType === "refunded") return "fulfilment";
  return "support";
}

function progressFor(eventType: OrderEventType) {
  const progress: Record<OrderEventType, number> = {
    order_draft_created: 10,
    checkout_started: 22,
    payment_succeeded: 45,
    payment_failed: 38,
    provider_draft_requested: 58,
    provider_draft_created: 70,
    provider_draft_failed: 62,
    provider_draft_retry_queued: 63,
    provider_draft_retry_requested: 64,
    provider_draft_retry_replay_started: 66,
    provider_draft_retry_created: 74,
    provider_draft_retry_blocked: 61,
    provider_draft_retry_failed: 63,
    provider_draft_retry_replay_discarded: 60,
    fulfilment_pending: 78,
    manual_fulfilment_required: 72,
    fulfilled: 100,
    order_failed: 55,
    refund_partial: 80,
    refunded: 100,
    webhook_duplicate: 45,
    webhook_unsupported: 20,
  };
  return progress[eventType];
}

function customerLabelFor(eventType: OrderEventType) {
  const labels: Record<OrderEventType, string> = {
    order_draft_created: "Order draft prepared.",
    checkout_started: "Checkout session started.",
    payment_succeeded: "Payment confirmed.",
    payment_failed: "Payment could not be confirmed.",
    provider_draft_requested: "Fulfilment draft requested.",
    provider_draft_created: "Fulfilment draft created.",
    provider_draft_failed: "Fulfilment draft needs review.",
    provider_draft_retry_queued: "Fulfilment retry queued for replay.",
    provider_draft_retry_requested: "Fulfilment retry requested.",
    provider_draft_retry_replay_started: "Queued fulfilment retry replay started.",
    provider_draft_retry_created: "Fulfilment retry created a provider draft.",
    provider_draft_retry_blocked: "Fulfilment retry is blocked for review.",
    provider_draft_retry_failed: "Fulfilment retry needs support review.",
    provider_draft_retry_replay_discarded: "Fulfilment retry queue item discarded.",
    fulfilment_pending: "Fulfilment is pending.",
    manual_fulfilment_required: "Manual fulfilment review is required.",
    fulfilled: "Order fulfilled.",
    order_failed: "Order needs support review.",
    refund_partial: "A partial refund was recorded; order state is under review.",
    refunded: "Order refunded.",
    webhook_duplicate: "Payment event already processed.",
    webhook_unsupported: "Payment event safely ignored.",
  };
  return labels[eventType];
}

function operatorLabelFor(eventType: OrderEventType) {
  const labels: Record<OrderEventType, string> = {
    order_draft_created: "checkout_guard_and_stock_reservation_accepted",
    checkout_started: "stripe_checkout_session_created",
    payment_succeeded: "stripe_checkout_session_completed",
    payment_failed: "stripe_payment_failed_or_unconfirmed",
    provider_draft_requested: "provider_draft_create_requested",
    provider_draft_created: "provider_draft_created_or_manual_pending",
    provider_draft_failed: "provider_draft_create_failed",
    provider_draft_retry_queued: "operator_provider_retry_queued_for_replay",
    provider_draft_retry_requested: "operator_provider_retry_requested",
    provider_draft_retry_replay_started: "operator_provider_retry_replay_started",
    provider_draft_retry_created: "operator_provider_retry_created_draft",
    provider_draft_retry_blocked: "operator_provider_retry_blocked_by_guard",
    provider_draft_retry_failed: "operator_provider_retry_failed",
    provider_draft_retry_replay_discarded: "operator_provider_retry_queue_discarded",
    fulfilment_pending: "order_waiting_for_provider_or_manual_fulfilment",
    manual_fulfilment_required: "manual_fulfilment_path_selected",
    fulfilled: "fulfilment_completed",
    order_failed: "order_support_or_reconciliation_required",
    refund_partial: "partial_refund_recorded_without_full_refund_transition",
    refunded: "refund_completed",
    webhook_duplicate: "stripe_event_idempotency_duplicate",
    webhook_unsupported: "unsupported_webhook_event_acknowledged",
  };
  return labels[eventType];
}

function nextExpectedFor(eventType: OrderEventType): OrderEventType[] {
  const next: Record<OrderEventType, OrderEventType[]> = {
    order_draft_created: ["checkout_started"],
    checkout_started: ["payment_succeeded", "payment_failed"],
    payment_succeeded: ["provider_draft_requested", "manual_fulfilment_required", "fulfilment_pending"],
    payment_failed: ["order_failed"],
    provider_draft_requested: ["provider_draft_created", "provider_draft_failed"],
    provider_draft_created: ["fulfilment_pending", "fulfilled"],
    provider_draft_failed: ["provider_draft_retry_queued", "provider_draft_retry_requested", "order_failed", "manual_fulfilment_required"],
    provider_draft_retry_queued: ["provider_draft_retry_replay_started", "provider_draft_retry_requested", "manual_fulfilment_required"],
    provider_draft_retry_requested: ["provider_draft_retry_created", "provider_draft_retry_failed", "provider_draft_retry_blocked"],
    provider_draft_retry_replay_started: ["provider_draft_retry_created", "provider_draft_retry_failed", "provider_draft_retry_blocked"],
    provider_draft_retry_created: ["fulfilment_pending", "fulfilled"],
    provider_draft_retry_blocked: ["provider_draft_retry_queued", "manual_fulfilment_required", "order_failed"],
    provider_draft_retry_failed: ["provider_draft_retry_queued", "manual_fulfilment_required", "order_failed"],
    provider_draft_retry_replay_discarded: ["manual_fulfilment_required", "order_failed"],
    fulfilment_pending: ["fulfilled", "order_failed", "refund_partial", "refunded"],
    manual_fulfilment_required: ["fulfilment_pending", "fulfilled", "order_failed"],
    fulfilled: ["refund_partial", "refunded"],
    order_failed: ["refund_partial", "refunded"],
    refund_partial: ["refund_partial", "refunded"],
    refunded: [],
    webhook_duplicate: [],
    webhook_unsupported: [],
  };
  return next[eventType];
}

function defaultSeverity(eventType: OrderEventType): OrderEventSeverity {
  if (eventType === "provider_draft_failed" || eventType === "provider_draft_retry_failed" || eventType === "payment_failed" || eventType === "order_failed") return "error";
  if (eventType === "manual_fulfilment_required" || eventType === "provider_draft_retry_replay_discarded" || eventType === "refund_partial") return "review";
  if (eventType === "provider_draft_retry_blocked") return "warning";
  if (eventType === "webhook_duplicate" || eventType === "webhook_unsupported") return "warning";
  return "info";
}

function sanitizeEvidence(evidence: Record<string, unknown> | undefined) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(evidence ?? {})) {
    if (/secret|token|authorization|cookie|email|phone|address|name/i.test(key)) continue;
    if (typeof value === "string") result[key] = value.slice(0, 240);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) result[key] = value;
    else result[key] = JSON.stringify(value).slice(0, 360);
  }
  return result;
}

export function appendOrderEvent(input: OrderEventInput): OrderEventReceipt {
  const store = getMemoryStore();
  const createdAt = new Date().toISOString();
  const stage = stageFor(input.eventType);
  const lineItems = input.lineItems ?? [];
  const idempotencyKey = input.idempotencyKey ?? hashJson(
    {
      orderDraftId: input.orderDraftId,
      eventType: input.eventType,
      stripeSessionId: input.stripeSessionId,
      stripeEventId: input.stripeEventId,
      providerOrderId: input.providerOrderId,
      statusAfter: input.statusAfter,
    },
    "ordevt_idem",
    20,
  );

  const duplicateEventId = store.byIdempotency.get(idempotencyKey);
  if (duplicateEventId) {
    const duplicate = store.events.find((event) => event.eventId === duplicateEventId);
    if (duplicate) return duplicate;
  }

  const productIds = uniqueStrings(lineItems.map((item) => item.productId));
  const providerIds = uniqueStrings(
    lineItems.map((item) => (item.provider ? `${item.provider}:${item.providerVariantId ?? item.variantId ?? "manual"}` : undefined)),
  );
  const providerReservationId = input.providerReservationId ?? input.guardSummary?.providerReservationId;
  const baseForHash = {
    orderDraftId: input.orderDraftId,
    eventType: input.eventType,
    createdAt,
    stripeSessionId: input.stripeSessionId,
    stripeEventId: input.stripeEventId,
    providerOrderId: input.providerOrderId,
    statusBefore: input.statusBefore,
    statusAfter: input.statusAfter,
    reasonCodes: input.reasonCodes ?? [],
  };
  const eventId = hashJson(baseForHash, "ordevt", 20);
  const checksum = hashJson({ ...baseForHash, productIds, providerIds, receiptIds: input.guardSummary }, "ordchk", 24);

  const receipt: OrderEventReceipt = {
    schemaVersion: "velmere.order-event-ledger.v1",
    eventId,
    idempotencyKey,
    caseId: caseIdFor(input.orderDraftId),
    orderDraftId: input.orderDraftId,
    stripeSessionId: input.stripeSessionId,
    stripeEventId: input.stripeEventId,
    providerOrderId: input.providerOrderId ? String(input.providerOrderId) : undefined,
    providerReservationId,
    createdAt,
    eventType: input.eventType,
    stage,
    actor: input.actor,
    sourceRoute: input.sourceRoute,
    severity: input.severity ?? defaultSeverity(input.eventType),
    statusBefore: input.statusBefore,
    statusAfter: input.statusAfter,
    progress: progressFor(input.eventType),
    customerSafeLabel: customerLabelFor(input.eventType),
    operatorLabel: operatorLabelFor(input.eventType),
    nextExpectedEvents: nextExpectedFor(input.eventType),
    lineItemCount: lineItems.length,
    productIds,
    providerIds,
    receiptIds: {
      checkoutGuardReceiptId: input.guardSummary?.checkoutGuardReceiptId,
      stockReservationReceiptId: input.guardSummary?.stockReservationReceiptId,
      providerReservationId,
    },
    reasonCodes: uniqueStrings(input.reasonCodes ?? []),
    evidence: sanitizeEvidence(input.evidence),
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
        "guard and reservation receipt ids",
        "product ids",
        "provider variant ids",
        "reason codes",
      ],
    },
    checksum,
  };

  store.events.unshift(receipt);
  if (store.events.length > MAX_EVENTS) store.events.length = MAX_EVENTS;

  const existing = store.byOrder.get(input.orderDraftId) ?? [];
  store.byOrder.set(input.orderDraftId, [eventId, ...existing].slice(0, MAX_EVENTS_PER_ORDER));
  store.byIdempotency.set(idempotencyKey, eventId);
  queueOrderEventStorageWrite(receipt);
  return receipt;
}

export function getOrderTimeline(orderDraftId: string) {
  const store = getMemoryStore();
  const ids = new Set(store.byOrder.get(orderDraftId) ?? []);
  return store.events
    .filter((event) => ids.has(event.eventId) || event.orderDraftId === orderDraftId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function listRecentOrderEvents(limit = 80) {
  const store = getMemoryStore();
  return store.events.slice(0, Math.max(1, Math.min(limit, 200)));
}

export function summarizeOrderTimeline(orderDraftId: string): OrderTimelineSummary {
  const timeline = getOrderTimeline(orderDraftId);
  const latest = timeline[timeline.length - 1];
  return {
    schemaVersion: "velmere.order-event-timeline-summary.v1",
    orderDraftId,
    caseId: caseIdFor(orderDraftId),
    generatedAt: new Date().toISOString(),
    eventCount: timeline.length,
    latestStatus: latest?.statusAfter,
    currentStage: latest?.stage,
    paymentConfirmed: timeline.some((event) => event.eventType === "payment_succeeded"),
    providerDraftCreated: timeline.some((event) => event.eventType === "provider_draft_created" || event.eventType === "provider_draft_retry_created"),
    fulfilmentPending: timeline.some((event) => event.eventType === "fulfilment_pending"),
    failed: timeline.some((event) => event.eventType === "order_failed" || event.eventType === "provider_draft_failed" || event.eventType === "provider_draft_retry_failed" || event.eventType === "payment_failed"),
    nextExpectedEvents: latest?.nextExpectedEvents ?? ["order_draft_created"],
    timeline,
    customerSafeBoundary:
      "Order timeline events are redacted. They store operational receipt ids and status transitions, not raw customer PII, provider payloads or secrets.",
  };
}

export function buildOrderEventLedgerReadiness(): OrderEventLedgerReadiness {
  const store = getMemoryStore();
  const storage = buildOrderEventStorageReadiness();
  return {
    schemaVersion: "velmere.order-event-ledger-readiness.v1",
    mode: "memory_timeline",
    durableWrite: false,
    durableStorageReady: storage.durableStorageReady,
    storageMode: storage.mode,
    storageProvider: storage.provider,
    pendingStorageWriteCount: storage.pendingWriteCount,
    eventCount: store.events.length,
    orderCount: store.byOrder.size,
    maxEvents: MAX_EVENTS,
    productionBoundary:
      "PASS2056 keeps the in-request order timeline and adds a redacted durable storage adapter for Upstash. Memory remains the local/dev fallback.",
  };
}
