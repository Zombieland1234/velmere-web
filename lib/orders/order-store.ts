import type { Product } from "@/lib/products/types";
import { createSecureRuntimeId } from "@/lib/runtime/secure-runtime-id";
import { appendOrderEvent } from "@/lib/orders/order-event-ledger";

export type OrderStatus =
  | "draft"
  | "checkout_started"
  | "paid"
  | "fulfilment_pending"
  | "manual_fulfilment_required"
  | "fulfilment_created"
  | "fulfilled"
  | "cancelled"
  | "failed"
  | "refunded";

export type OrderLineItem = {
  productId: string;
  variantId: string;
  quantity: number;
  title: string;
  amount: number;
  currency: Product["price"]["currency"];
  provider: Product["provider"];
  fulfilmentMode: Product["fulfilmentMode"];
  providerVariantId?: string;
  selectedSize?: string;
};

export type OrderGuardSummary = {
  checkoutGuardReceiptId?: string;
  stockReservationReceiptId?: string;
  providerReservationId?: string;
  stockReservationMode?: string;
  stockReservationExpiresAt?: string;
};


export type OrderReplaySnapshot = {
  schemaVersion: "velmere.order-replay-snapshot.v1";
  id: string;
  status: OrderStatus;
  locale: string;
  cartHash: string;
  stripeSessionId?: string;
  lineItems: OrderLineItem[];
  guardSummary?: OrderGuardSummary;
  createdAt: string;
  updatedAt: string;
  redactionBoundary: {
    rawCustomerPiiStored: false;
    rawProviderPayloadStored: false;
    secretsStored: false;
    allowedFields: string[];
  };
};

export type OrderRecord = {
  id: string;
  status: OrderStatus;
  locale: string;
  cartHash: string;
  stripeSessionId?: string;
  lineItems: OrderLineItem[];
  createdAt: string;
  updatedAt: string;
  logs: string[];
  walletAddress?: string;
  guardSummary?: OrderGuardSummary;
  eventReceiptIds?: string[];
};

const orders = new Map<string, OrderRecord>();
const sessions = new Map<string, string>();

function now() {
  return new Date().toISOString();
}

function toEventLineItems(lineItems: OrderLineItem[]) {
  return lineItems.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    provider: item.provider,
    providerVariantId: item.providerVariantId,
    fulfilmentMode: item.fulfilmentMode,
    selectedSize: item.selectedSize,
    quantity: item.quantity,
    amount: item.amount,
    currency: item.currency,
  }));
}

function write(
  order: OrderRecord,
  status: OrderStatus,
  log: string,
  eventType: Parameters<typeof appendOrderEvent>[0]["eventType"],
  eventInput: Partial<Parameters<typeof appendOrderEvent>[0]> = {},
) {
  const event = appendOrderEvent({
    orderDraftId: order.id,
    eventType,
    actor: eventInput.actor ?? "system",
    sourceRoute: eventInput.sourceRoute ?? "lib.orders.order-store",
    statusBefore: order.status,
    statusAfter: status,
    stripeSessionId: eventInput.stripeSessionId ?? order.stripeSessionId,
    providerOrderId: eventInput.providerOrderId,
    providerReservationId: eventInput.providerReservationId ?? order.guardSummary?.providerReservationId,
    guardSummary: order.guardSummary,
    lineItems: toEventLineItems(order.lineItems),
    reasonCodes: eventInput.reasonCodes,
    evidence: eventInput.evidence,
    idempotencyKey: eventInput.idempotencyKey,
    severity: eventInput.severity,
    stripeEventId: eventInput.stripeEventId,
  });
  const updated: OrderRecord = {
    ...order,
    status,
    updatedAt: now(),
    logs: [...order.logs, `${now()} ${log}`],
    eventReceiptIds: [...(order.eventReceiptIds ?? []), event.eventId],
  };
  orders.set(updated.id, updated);
  if (updated.stripeSessionId) sessions.set(updated.stripeSessionId, updated.id);
  return updated;
}

export function createOrderDraft(input: {
  locale: string;
  cartHash: string;
  lineItems: OrderLineItem[];
  walletAddress?: string;
  guardSummary?: OrderGuardSummary;
}) {
  const id = createSecureRuntimeId("ord");
  const draftEvent = appendOrderEvent({
    orderDraftId: id,
    eventType: "order_draft_created",
    actor: "system",
    sourceRoute: "app.api.checkout.create_order_draft",
    statusAfter: "draft",
    guardSummary: input.guardSummary,
    lineItems: toEventLineItems(input.lineItems),
    reasonCodes: ["checkout_guard_passed", "stock_reservation_passed"],
    evidence: {
      cartHash: input.cartHash,
      lineItemCount: input.lineItems.length,
      providerReservationId: input.guardSummary?.providerReservationId ?? null,
    },
  });
  const order: OrderRecord = {
    id,
    status: "draft",
    locale: input.locale,
    cartHash: input.cartHash,
    lineItems: input.lineItems,
    createdAt: now(),
    updatedAt: now(),
    logs: [
      `${now()} order draft created`,
      input.guardSummary?.checkoutGuardReceiptId ? `${now()} checkout guard ${input.guardSummary.checkoutGuardReceiptId} accepted` : "",
      input.guardSummary?.stockReservationReceiptId
        ? `${now()} stock reservation ${input.guardSummary.stockReservationReceiptId} accepted`
        : "",
    ].filter(Boolean),
    walletAddress: input.walletAddress,
    guardSummary: input.guardSummary,
    eventReceiptIds: [draftEvent.eventId],
  };
  orders.set(id, order);
  return order;
}

export function markCheckoutStarted(orderDraftId: string, stripeSessionId: string) {
  const order = orders.get(orderDraftId);
  if (!order) return null;
  return write(
    { ...order, stripeSessionId },
    "checkout_started",
    `checkout session ${stripeSessionId} started${order.guardSummary?.providerReservationId ? ` with reservation ${order.guardSummary.providerReservationId}` : ""}`,
    "checkout_started",
    {
      actor: "customer",
      sourceRoute: "app.api.checkout.stripe_session_create",
      stripeSessionId,
      evidence: { stripeSessionId, providerReservationId: order.guardSummary?.providerReservationId ?? null },
    },
  );
}

export function markPaid(orderDraftId: string, stripeSessionId?: string) {
  const order = orders.get(orderDraftId) ?? (stripeSessionId ? orders.get(sessions.get(stripeSessionId) ?? "") : undefined);
  if (!order) return null;
  return write({ ...order, stripeSessionId: stripeSessionId ?? order.stripeSessionId }, "paid", "payment confirmed", "payment_succeeded", {
    actor: "stripe",
    sourceRoute: "app.api.stripe.webhook.checkout_session_completed",
    stripeSessionId: stripeSessionId ?? order.stripeSessionId,
    evidence: { stripeSessionId: stripeSessionId ?? order.stripeSessionId ?? null },
  });
}

export function markFulfilmentPending(orderDraftId: string) {
  const order = orders.get(orderDraftId);
  if (!order) return null;
  return write(order, "fulfilment_pending", "fulfilment pending", "fulfilment_pending", {
    actor: "system",
    sourceRoute: "app.api.stripe.webhook.fulfilment_pending",
  });
}

export function markFulfilled(orderDraftId: string) {
  const order = orders.get(orderDraftId);
  if (!order) return null;
  return write(order, "fulfilled", "order fulfilled", "fulfilled", {
    actor: "provider",
    sourceRoute: "lib.orders.order-store.mark_fulfilled",
  });
}

export function markFailed(orderDraftId: string, reason = "order failed") {
  const order = orders.get(orderDraftId);
  if (!order) return null;
  return write(order, "failed", reason, "order_failed", {
    actor: "system",
    sourceRoute: "lib.orders.order-store.mark_failed",
    severity: "error",
    reasonCodes: [reason],
    evidence: { reason },
  });
}


export function markPaymentFailed(orderDraftId: string, reason = "payment failed", stripeSessionId?: string) {
  const order = orders.get(orderDraftId) ?? (stripeSessionId ? orders.get(sessions.get(stripeSessionId) ?? "") : undefined);
  if (!order) return null;
  return write({ ...order, stripeSessionId: stripeSessionId ?? order.stripeSessionId }, "failed", reason, "payment_failed", {
    actor: "stripe",
    sourceRoute: "app.api.stripe.webhook.payment_failed",
    stripeSessionId: stripeSessionId ?? order.stripeSessionId,
    severity: "error",
    reasonCodes: [reason],
    evidence: { reason, stripeSessionId: stripeSessionId ?? order.stripeSessionId ?? null },
  });
}

export function markRefunded(orderDraftId: string, stripeSessionId?: string) {
  const order = orders.get(orderDraftId) ?? (stripeSessionId ? orders.get(sessions.get(stripeSessionId) ?? "") : undefined);
  if (!order) return null;
  return write({ ...order, stripeSessionId: stripeSessionId ?? order.stripeSessionId }, "refunded", "payment refunded", "refunded", {
    actor: "stripe",
    sourceRoute: "app.api.stripe.webhook.refunded",
    stripeSessionId: stripeSessionId ?? order.stripeSessionId,
    severity: "review",
    evidence: { stripeSessionId: stripeSessionId ?? order.stripeSessionId ?? null },
  });
}

export function buildOrderReplaySnapshot(order: OrderRecord): OrderReplaySnapshot {
  return {
    schemaVersion: "velmere.order-replay-snapshot.v1",
    id: order.id,
    status: order.status,
    locale: order.locale,
    cartHash: order.cartHash,
    stripeSessionId: order.stripeSessionId,
    lineItems: order.lineItems.map((item) => ({ ...item })),
    guardSummary: order.guardSummary ? { ...order.guardSummary } : undefined,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    redactionBoundary: {
      rawCustomerPiiStored: false,
      rawProviderPayloadStored: false,
      secretsStored: false,
      allowedFields: [
        "orderDraftId",
        "status",
        "locale",
        "cart hash",
        "stripe session id",
        "line item product/variant/provider ids",
        "prices",
        "guard receipt ids",
      ],
    },
  };
}

export function restoreOrderFromReplaySnapshot(snapshot: OrderReplaySnapshot, reason = "provider retry queue replay") {
  const existing = orders.get(snapshot.id);
  if (existing) return existing;
  const restored: OrderRecord = {
    id: snapshot.id,
    status: snapshot.status,
    locale: snapshot.locale,
    cartHash: snapshot.cartHash,
    stripeSessionId: snapshot.stripeSessionId,
    lineItems: snapshot.lineItems.map((item) => ({ ...item })),
    createdAt: snapshot.createdAt,
    updatedAt: now(),
    logs: [`${now()} restored from redacted replay snapshot: ${reason}`],
    guardSummary: snapshot.guardSummary ? { ...snapshot.guardSummary } : undefined,
    eventReceiptIds: [],
  };
  orders.set(restored.id, restored);
  if (restored.stripeSessionId) sessions.set(restored.stripeSessionId, restored.id);
  return restored;
}

export function getOrder(orderDraftId: string) {
  return orders.get(orderDraftId) ?? null;
}
