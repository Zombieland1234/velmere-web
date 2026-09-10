import { createHash } from "node:crypto";
import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import type { OrderRecord, OrderStatus } from "@/lib/orders/order-store";
import { buildOrderReplaySnapshot, restoreOrderFromReplaySnapshot } from "@/lib/orders/order-store";
import { enqueueFulfilmentProviderSync } from "@/lib/orders/fulfilment-provider-sync-queue";
import type { CommerceDurablePaymentBinding } from "@/lib/payments/commerce-payment-integrity";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";

export type DurableOrderStateMode = "supabase" | "memory_only_blocked_for_production";
export type DurableOrderStateEventType =
  | "order_draft_created"
  | "checkout_started"
  | "payment_succeeded"
  | "payment_failed"
  | "fulfilment_pending"
  | "manual_fulfilment_required"
  | "provider_draft_created"
  | "provider_draft_failed"
  | "provider_status_synced"
  | "provider_fulfilled"
  | "provider_sync_escalated"
  | "refund_pending"
  | "partial_refund_recorded"
  | "refunded"
  | "order_failed";

export type DurableOrderStateWriteResult = {
  schemaVersion: "velmere.durable-order-state.write-result.v1";
  ok: boolean;
  persisted: boolean;
  durableWrite: boolean;
  mode: DurableOrderStateMode;
  orderDraftId: string;
  status: OrderStatus;
  eventType: DurableOrderStateEventType;
  idempotencyKey: string;
  outboxRequestId?: string;
  outboxStatus?: DurableCommerceFulfilmentOutboxStatus;
  fulfilmentAction?: DurableCommerceFulfilmentAction;
  idempotentReplay?: boolean;
  providerError?: string;
  productionBoundary: string;
};

export type DurableOrderStateReadiness = {
  schemaVersion: "velmere.durable-order-state.readiness.v1";
  mode: DurableOrderStateMode;
  hasSupabaseConfig: boolean;
  durableOrderDraftsReady: boolean;
  durableOrderEventsReady: boolean;
  durableFulfilmentOutboxReady: boolean;
  requiredTables: string[];
  productionBoundary: string;
};

export type DurableCheckoutBinding = {
  amountTotal: number;
  currency: string;
  livemode: boolean;
  paymentIntentId?: string | null;
};

export type DurableCommerceFulfilmentAction =
  | "printful_order_draft"
  | "manual_fulfilment_review";

export type DurableCommerceFulfilmentOutboxStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "retryable_failed"
  | "dead_letter"
  | "cancelled";

export type DurablePaidTransitionDependencies = {
  hasDurableStorage: () => boolean;
  runRpc: (input: {
    operation: "commerce_paid_fulfilment_enqueue";
    args: Record<string, unknown>;
  }) => Promise<{ data: unknown }>;
};

const ORDER_STATUSES = new Set<OrderStatus>([
  "draft",
  "checkout_started",
  "paid",
  "fulfilment_pending",
  "manual_fulfilment_required",
  "fulfilment_created",
  "fulfilled",
  "cancelled",
  "failed",
  "refunded",
]);

type DurableRuntime = { writes: DurableOrderStateWriteResult[] };

function runtime(): DurableRuntime {
  const store = globalThis as typeof globalThis & { __velmereDurableOrderState?: DurableRuntime };
  store.__velmereDurableOrderState ??= { writes: [] };
  return store.__velmereDurableOrderState;
}

function now() {
  return new Date().toISOString();
}

function requiresDurableOrderStorage() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function assertDurableOrderStorageConfigured() {
  if (requiresDurableOrderStorage() && !hasSupabaseServiceRoleConfig()) {
    throw new Error("durable_order_storage_unavailable");
  }
}

function stableHash(value: unknown, prefix = "dos", length = 24) {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, length)}`;
}

function walletFingerprint(walletAddress?: string) {
  if (!walletAddress) return null;
  return stableHash({ walletAddress: walletAddress.toLowerCase() }, "wallet", 18);
}

function lineItemRedaction(order: OrderRecord) {
  return order.lineItems.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    currency: item.currency,
    amount: item.amount,
    provider: item.provider,
    fulfilmentMode: item.fulfilmentMode,
    providerVariantId: item.providerVariantId ?? null,
    selectedSize: item.selectedSize ?? null,
  }));
}

function expectedCheckoutBinding(order: OrderRecord) {
  if (order.lineItems.length === 0) {
    throw new Error("durable_order_line_items_missing");
  }
  const currencies = new Set(
    order.lineItems.map((item) => item.currency.toUpperCase()),
  );
  if (currencies.size !== 1) {
    throw new Error("durable_order_currency_mixed");
  }
  const amountTotal = order.lineItems.reduce((total, item) => {
    if (
      !Number.isSafeInteger(item.amount) ||
      item.amount < 0 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1
    ) {
      throw new Error("durable_order_amount_invalid");
    }
    const lineTotal = item.amount * item.quantity;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total + lineTotal)) {
      throw new Error("durable_order_amount_overflow");
    }
    return total + lineTotal;
  }, 0);
  return { amountTotal, currency: Array.from(currencies)[0] };
}

function parseDurableOrderRecord(row: Record<string, unknown>): OrderRecord {
  const replay = row.replay_snapshot;
  if (!replay || typeof replay !== "object" || Array.isArray(replay)) {
    throw new Error("durable_order_replay_snapshot_missing");
  }
  const snapshot = replay as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const status = typeof row.status === "string" && ORDER_STATUSES.has(row.status as OrderStatus)
    ? (row.status as OrderStatus)
    : null;
  const cartHash = typeof row.cart_hash === "string" ? row.cart_hash : "";
  const locale = typeof row.locale === "string" ? row.locale : "";
  const lineItems = snapshot.lineItems;
  if (
    !id ||
    !status ||
    !/^[a-f0-9]{64}$/i.test(cartHash) ||
    !locale ||
    !Array.isArray(lineItems) ||
    lineItems.length === 0
  ) {
    throw new Error("durable_order_replay_snapshot_invalid");
  }

  const parsedLineItems = lineItems.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("durable_order_line_item_invalid");
    }
    const item = value as Record<string, unknown>;
    if (
      typeof item.productId !== "string" ||
      typeof item.variantId !== "string" ||
      typeof item.title !== "string" ||
      typeof item.amount !== "number" ||
      !Number.isSafeInteger(item.amount) ||
      item.amount < 0 ||
      typeof item.quantity !== "number" ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.currency !== "EUR" ||
      !["manual", "printful", "tapstitch", "external"].includes(String(item.provider)) ||
      !["disabled", "external_link", "manual", "automatic"].includes(String(item.fulfilmentMode))
    ) {
      throw new Error("durable_order_line_item_invalid");
    }
    return {
      productId: item.productId,
      variantId: item.variantId,
      title: item.title,
      amount: item.amount,
      quantity: item.quantity,
      currency: "EUR" as const,
      provider: item.provider as OrderRecord["lineItems"][number]["provider"],
      fulfilmentMode: item.fulfilmentMode as OrderRecord["lineItems"][number]["fulfilmentMode"],
      providerVariantId:
        typeof item.providerVariantId === "string" ? item.providerVariantId : undefined,
      selectedSize:
        typeof item.selectedSize === "string" ? item.selectedSize : undefined,
    };
  });

  const stripeSessionId =
    typeof row.stripe_session_id === "string" ? row.stripe_session_id : undefined;
  const createdAt =
    typeof snapshot.createdAt === "string" ? snapshot.createdAt : now();
  const updatedAt =
    typeof row.updated_at === "string"
      ? row.updated_at
      : typeof snapshot.updatedAt === "string"
        ? snapshot.updatedAt
        : now();
  const guardSummary =
    snapshot.guardSummary &&
    typeof snapshot.guardSummary === "object" &&
    !Array.isArray(snapshot.guardSummary)
      ? (snapshot.guardSummary as OrderRecord["guardSummary"])
      : undefined;

  return {
    id,
    status,
    locale,
    cartHash,
    stripeSessionId,
    lineItems: parsedLineItems,
    guardSummary,
    createdAt,
    updatedAt,
    logs: [],
    eventReceiptIds: [],
  };
}

function blockedResult(input: {
  orderDraftId: string;
  status: OrderStatus;
  eventType: DurableOrderStateEventType;
  idempotencyKey: string;
  providerError?: string;
}): DurableOrderStateWriteResult {
  const result: DurableOrderStateWriteResult = {
    schemaVersion: "velmere.durable-order-state.write-result.v1",
    ok: !input.providerError,
    persisted: false,
    durableWrite: false,
    mode: "memory_only_blocked_for_production",
    orderDraftId: input.orderDraftId,
    status: input.status,
    eventType: input.eventType,
    idempotencyKey: input.idempotencyKey,
    providerError: input.providerError,
    productionBoundary: "Durable order state needs Supabase/Postgres service-role ENV. Memory runtime is allowed only for local/dev smoke and is BLOCKED for production truth.",
  };
  runtime().writes.unshift(result);
  runtime().writes = runtime().writes.slice(0, 50);
  return result;
}

export function buildDurableOrderStateReadiness(): DurableOrderStateReadiness {
  const configured = hasSupabaseServiceRoleConfig();
  return {
    schemaVersion: "velmere.durable-order-state.readiness.v1",
    mode: configured ? "supabase" : "memory_only_blocked_for_production",
    hasSupabaseConfig: configured,
    durableOrderDraftsReady: configured,
    durableOrderEventsReady: configured,
    durableFulfilmentOutboxReady: configured,
    requiredTables: ["velmere_order_drafts", "velmere_order_state_events", "velmere_commerce_fulfilment_outbox", "velmere_orders", "velmere_order_items"],
    productionBoundary: configured
      ? "Durable order state can write server-side redacted order state. Verify SQL schema has been applied before production traffic."
      : "BLOCKED: configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then apply lib/db/schema.sql.",
  };
}

async function appendDurableStateEvent(input: {
  orderDraftId: string;
  eventType: DurableOrderStateEventType;
  statusBefore?: OrderStatus;
  statusAfter: OrderStatus;
  stripeSessionId?: string;
  stripeEventId?: string;
  provider?: string;
  providerOrderId?: string;
  severity?: "info" | "review" | "warning" | "error" | "critical";
  sourceRoute: string;
  idempotencyKey: string;
  redactedPayload?: Record<string, unknown>;
}) {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("Supabase service client unavailable.");
  const { error } = await supabase.from("velmere_order_state_events").upsert(
    {
      order_draft_id: input.orderDraftId,
      event_type: input.eventType,
      status_before: input.statusBefore ?? null,
      status_after: input.statusAfter,
      stripe_session_id: input.stripeSessionId ?? null,
      stripe_event_id: input.stripeEventId ?? null,
      provider: input.provider ?? null,
      provider_order_id: input.providerOrderId ?? null,
      severity: input.severity ?? "info",
      source_route: input.sourceRoute,
      idempotency_key: input.idempotencyKey,
      redacted_payload: input.redactedPayload ?? {},
    },
    { onConflict: "idempotency_key" },
  );
  if (error) throw error;
}

export async function persistOrderDraftDurable(input: { order: OrderRecord; sourceRoute?: string }) {
  const order = input.order;
  const idempotencyKey = stableHash({ orderDraftId: order.id, cartHash: order.cartHash, event: "draft" }, "order_draft");
  if (!hasSupabaseServiceRoleConfig()) {
    assertDurableOrderStorageConfigured();
    return blockedResult({ orderDraftId: order.id, status: order.status, eventType: "order_draft_created", idempotencyKey });
  }
  try {
    const expectedPayment = expectedCheckoutBinding(order);
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) throw new Error("Supabase service client unavailable.");
    const replaySnapshot = buildOrderReplaySnapshot(order);
    const { error } = await supabase.from("velmere_order_drafts").upsert(
      {
        id: order.id,
        status: order.status,
        locale: order.locale,
        cart_hash: order.cartHash,
        expected_amount_total: expectedPayment.amountTotal,
        expected_currency: expectedPayment.currency,
        stripe_session_id: order.stripeSessionId ?? null,
        stripe_livemode: null,
        stripe_payment_intent_id: null,
        wallet_fingerprint: walletFingerprint(order.walletAddress),
        line_items: lineItemRedaction(order),
        guard_summary: order.guardSummary ?? {},
        replay_snapshot: replaySnapshot,
        source_route: input.sourceRoute ?? "lib.orders.durable-order-state.persistOrderDraftDurable",
        idempotency_key: idempotencyKey,
        updated_at: now(),
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    await appendDurableStateEvent({
      orderDraftId: order.id,
      eventType: "order_draft_created",
      statusAfter: order.status,
      sourceRoute: input.sourceRoute ?? "lib.orders.durable-order-state.persistOrderDraftDurable",
      idempotencyKey: `${idempotencyKey}:event`,
      redactedPayload: {
        cartHash: order.cartHash,
        lineItemCount: order.lineItems.length,
        expectedAmountTotal: expectedPayment.amountTotal,
        expectedCurrency: expectedPayment.currency,
      },
    });
    return {
      schemaVersion: "velmere.durable-order-state.write-result.v1",
      ok: true,
      persisted: true,
      durableWrite: true,
      mode: "supabase",
      orderDraftId: order.id,
      status: order.status,
      eventType: "order_draft_created",
      idempotencyKey,
      productionBoundary: "Server-only durable order draft persisted with redacted line items and replay snapshot.",
    } satisfies DurableOrderStateWriteResult;
  } catch (error) {
    return blockedResult({ orderDraftId: order.id, status: order.status, eventType: "order_draft_created", idempotencyKey, providerError: error instanceof Error ? error.message : "durable_order_draft_write_failed" });
  }
}

export async function updateDurableOrderState(input: {
  orderDraftId: string;
  status: OrderStatus;
  eventType: DurableOrderStateEventType;
  sourceRoute: string;
  statusBefore?: OrderStatus;
  stripeSessionId?: string;
  stripeEventId?: string;
  stripeLivemode?: boolean;
  stripePaymentIntentId?: string;
  expectedAmountTotal?: number;
  expectedCurrency?: string;
  provider?: string;
  providerOrderId?: string;
  severity?: "info" | "review" | "warning" | "error" | "critical";
  redactedPayload?: Record<string, unknown>;
}) {
  const idempotencyKey = stableHash({ orderDraftId: input.orderDraftId, eventType: input.eventType, stripeSessionId: input.stripeSessionId, stripeEventId: input.stripeEventId, providerOrderId: input.providerOrderId }, "order_state");
  if (!hasSupabaseServiceRoleConfig()) {
    assertDurableOrderStorageConfigured();
    return blockedResult({ orderDraftId: input.orderDraftId, status: input.status, eventType: input.eventType, idempotencyKey });
  }
  try {
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) throw new Error("Supabase service client unavailable.");
    const { data, error } = await supabase.from("velmere_order_drafts").update({
      status: input.status,
      stripe_session_id: input.stripeSessionId ?? undefined,
      stripe_livemode: input.stripeLivemode ?? undefined,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? undefined,
      expected_amount_total: input.expectedAmountTotal ?? undefined,
      expected_currency: input.expectedCurrency?.toUpperCase() ?? undefined,
      updated_at: now(),
    }).eq("id", input.orderDraftId).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("durable_order_state_target_missing");
    await appendDurableStateEvent({ ...input, statusAfter: input.status, idempotencyKey });
    return {
      schemaVersion: "velmere.durable-order-state.write-result.v1",
      ok: true,
      persisted: true,
      durableWrite: true,
      mode: "supabase",
      orderDraftId: input.orderDraftId,
      status: input.status,
      eventType: input.eventType,
      idempotencyKey,
      productionBoundary: "Server-only durable order state/event persisted. No raw PII, secrets or raw provider payload stored.",
    } satisfies DurableOrderStateWriteResult;
  } catch (error) {
    return blockedResult({ orderDraftId: input.orderDraftId, status: input.status, eventType: input.eventType, idempotencyKey, providerError: error instanceof Error ? error.message : "durable_order_state_write_failed" });
  }
}

export async function hydrateDurableOrderDraftForPayment(
  orderDraftId: string,
): Promise<CommerceDurablePaymentBinding | null> {
  if (!hasSupabaseServiceRoleConfig()) {
    assertDurableOrderStorageConfigured();
    throw new Error("durable_order_hydration_storage_unavailable");
  }
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("durable_order_hydration_storage_unavailable");
  const { data, error } = await supabase
    .from("velmere_order_drafts")
    .select(
      "id,status,locale,cart_hash,stripe_session_id,stripe_livemode,stripe_payment_intent_id,expected_amount_total,expected_currency,replay_snapshot,updated_at",
    )
    .eq("id", orderDraftId)
    .maybeSingle();
  if (error) throw new Error(`durable_order_hydration_failed:${error.message}`);
  if (!data) return null;

  const row = data as unknown as Record<string, unknown>;
  const order = parseDurableOrderRecord(row);
  const expectedAmountTotal = row.expected_amount_total;
  const expectedCurrency = row.expected_currency;
  const stripeSessionId = row.stripe_session_id;
  const stripeLivemode = row.stripe_livemode;
  const stripePaymentIntentId = row.stripe_payment_intent_id;
  const computed = expectedCheckoutBinding(order);
  if (
    typeof expectedAmountTotal !== "number" ||
    !Number.isSafeInteger(expectedAmountTotal) ||
    expectedAmountTotal < 0 ||
    computed.amountTotal !== expectedAmountTotal ||
    typeof expectedCurrency !== "string" ||
    computed.currency !== expectedCurrency.toUpperCase() ||
    typeof stripeSessionId !== "string" ||
    !stripeSessionId ||
    typeof stripeLivemode !== "boolean" ||
    (stripePaymentIntentId !== null && typeof stripePaymentIntentId !== "string")
  ) {
    throw new Error("durable_order_payment_binding_invalid");
  }

  const hydrated = restoreOrderFromReplaySnapshot(
    buildOrderReplaySnapshot(order),
    "stripe paid webhook durable hydration",
  );
  return {
    order: hydrated,
    orderDraftId,
    cartHash: order.cartHash,
    stripeSessionId,
    expectedAmountTotal,
    expectedCurrency: expectedCurrency.toUpperCase(),
    stripeLivemode,
    stripePaymentIntentId,
  };
}

export function markDurableCheckoutStarted(
  orderDraftId: string,
  stripeSessionId: string,
  binding: DurableCheckoutBinding,
) {
  return updateDurableOrderState({
    orderDraftId,
    status: "checkout_started",
    eventType: "checkout_started",
    sourceRoute: "app.api.checkout.stripe_session_create",
    stripeSessionId,
    stripeLivemode: binding.livemode,
    stripePaymentIntentId: binding.paymentIntentId ?? undefined,
    expectedAmountTotal: binding.amountTotal,
    expectedCurrency: binding.currency,
    redactedPayload: {
      stripeSessionId,
      stripeLivemode: binding.livemode,
      stripePaymentIntentPresent: Boolean(binding.paymentIntentId),
      expectedAmountTotal: binding.amountTotal,
      expectedCurrency: binding.currency.toUpperCase(),
    },
  });
}

const durablePaidTransitionDependencies: DurablePaidTransitionDependencies = {
  hasDurableStorage: hasSupabaseServiceRoleConfig,
  runRpc: runRegisteredServiceRoleRpc,
};

function atomicPaidOutboxRow(data: unknown) {
  const candidate = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("durable_order_paid_outbox_rpc_result_invalid");
  }
  const row = candidate as Record<string, unknown>;
  const transitionResult = row.transition_result;
  const status = row.order_status;
  const outboxRequestId = row.outbox_request_id;
  const outboxStatus = row.outbox_status;
  const fulfilmentAction = row.fulfilment_action;
  const idempotentReplay = row.idempotent_replay;
  if (
    (transitionResult !== "enqueued" && transitionResult !== "already_enqueued") ||
    typeof status !== "string" ||
    !ORDER_STATUSES.has(status as OrderStatus) ||
    typeof outboxRequestId !== "string" ||
    !/^commerce_fulfilment_[a-f0-9]{32}$/.test(outboxRequestId) ||
    ![
      "pending",
      "processing",
      "succeeded",
      "retryable_failed",
      "dead_letter",
      "cancelled",
    ].includes(String(outboxStatus)) ||
    (fulfilmentAction !== "printful_order_draft" &&
      fulfilmentAction !== "manual_fulfilment_review") ||
    typeof idempotentReplay !== "boolean" ||
    idempotentReplay !== (transitionResult === "already_enqueued")
  ) {
    throw new Error("durable_order_paid_outbox_rpc_result_invalid");
  }
  return {
    transitionResult,
    status: status as OrderStatus,
    outboxRequestId,
    outboxStatus: outboxStatus as DurableCommerceFulfilmentOutboxStatus,
    fulfilmentAction: fulfilmentAction as DurableCommerceFulfilmentAction,
    idempotentReplay,
  };
}

export async function markDurableOrderPaid(input: {
  orderDraftId: string;
  stripeSessionId: string;
  stripeEventId: string;
  stripePaymentIntentId: string;
  cartHash: string;
  amountTotal: number;
  currency: string;
  livemode: boolean;
  fulfilmentAction: DurableCommerceFulfilmentAction;
  automaticPrintfulLineCount: number;
}, dependencies: DurablePaidTransitionDependencies = durablePaidTransitionDependencies) {
  const idempotencyKey = stableHash(
    {
      orderDraftId: input.orderDraftId,
      stripeSessionId: input.stripeSessionId,
      stripeEventId: input.stripeEventId,
      stripePaymentIntentId: input.stripePaymentIntentId,
      eventType: "payment_succeeded",
    },
    "order_state",
  );
  if (
    !/^[a-z0-9_-]{1,160}$/i.test(input.orderDraftId) ||
    !/^cs_[a-z0-9_]+$/i.test(input.stripeSessionId) ||
    input.stripeSessionId.length > 255 ||
    !/^evt_[a-z0-9_]+$/i.test(input.stripeEventId) ||
    input.stripeEventId.length > 255 ||
    !/^pi_[a-z0-9_]+$/i.test(input.stripePaymentIntentId) ||
    input.stripePaymentIntentId.length > 255 ||
    !/^[a-f0-9]{64}$/i.test(input.cartHash) ||
    !Number.isSafeInteger(input.amountTotal) ||
    input.amountTotal < 0 ||
    !/^[A-Z]{3}$/i.test(input.currency) ||
    !Number.isSafeInteger(input.automaticPrintfulLineCount) ||
    input.automaticPrintfulLineCount < 0 ||
    input.automaticPrintfulLineCount > 1_000 ||
    (input.fulfilmentAction === "printful_order_draft" &&
      input.automaticPrintfulLineCount < 1) ||
    (input.fulfilmentAction === "manual_fulfilment_review" &&
      input.automaticPrintfulLineCount !== 0)
  ) {
    return blockedResult({
      orderDraftId: input.orderDraftId,
      status: "paid",
      eventType: "payment_succeeded",
      idempotencyKey,
      providerError: "durable_order_paid_outbox_input_invalid",
    });
  }
  if (!dependencies.hasDurableStorage()) {
    assertDurableOrderStorageConfigured();
    return blockedResult({
      orderDraftId: input.orderDraftId,
      status: "paid",
      eventType: "payment_succeeded",
      idempotencyKey,
      providerError: "durable_order_storage_unavailable",
    });
  }
  try {
    const { data } = await dependencies.runRpc({
      operation: "commerce_paid_fulfilment_enqueue",
      args: {
        p_order_draft_id: input.orderDraftId,
        p_stripe_session_id: input.stripeSessionId,
        p_stripe_event_id: input.stripeEventId,
        p_stripe_payment_intent_id: input.stripePaymentIntentId,
        p_cart_hash: input.cartHash.toLowerCase(),
        p_amount_total: input.amountTotal,
        p_currency: input.currency.toUpperCase(),
        p_livemode: input.livemode,
        p_fulfilment_action: input.fulfilmentAction,
        p_automatic_printful_line_count: input.automaticPrintfulLineCount,
      },
    });
    const row = atomicPaidOutboxRow(data);
    if (row.fulfilmentAction !== input.fulfilmentAction) {
      throw new Error("durable_order_paid_outbox_action_mismatch");
    }
    if (row.outboxStatus === "dead_letter" || row.outboxStatus === "cancelled") {
      throw new Error("durable_order_paid_outbox_not_actionable");
    }
    return {
      schemaVersion: "velmere.durable-order-state.write-result.v1",
      ok: true,
      persisted: true,
      durableWrite: true,
      mode: "supabase",
      orderDraftId: input.orderDraftId,
      status: row.status,
      eventType: "payment_succeeded",
      idempotencyKey,
      outboxRequestId: row.outboxRequestId,
      outboxStatus: row.outboxStatus,
      fulfilmentAction: row.fulfilmentAction,
      idempotentReplay: row.idempotentReplay,
      productionBoundary:
        "One service-role RPC atomically bound the exact order/session/cart/amount/currency/livemode/payment-intent, committed the payment event, and enqueued one idempotent fulfilment request. Provider execution remains blocked until a separately verified worker consumes that request.",
    } satisfies DurableOrderStateWriteResult;
  } catch (error) {
    return blockedResult({
      orderDraftId: input.orderDraftId,
      status: "paid",
      eventType: "payment_succeeded",
      idempotencyKey,
      providerError:
        error instanceof Error ? error.message : "durable_order_payment_transition_failed",
    });
  }
}

export function markDurableOrderPaymentFailed(orderDraftId: string, stripeSessionId: string | undefined, stripeEventId: string | undefined, reason: string) {
  return updateDurableOrderState({
    orderDraftId,
    status: "failed",
    eventType: "payment_failed",
    sourceRoute: "app.api.stripe.webhook.payment_failed",
    stripeSessionId,
    stripeEventId,
    provider: "stripe",
    severity: "error",
    redactedPayload: { reason: reason.slice(0, 180), stripeEventId: stripeEventId ?? null },
  });
}

export function markDurableOrderFulfilmentPending(orderDraftId: string, stripeSessionId?: string, stripeEventId?: string) {
  return updateDurableOrderState({
    orderDraftId,
    status: "fulfilment_pending",
    eventType: "fulfilment_pending",
    sourceRoute: "app.api.stripe.webhook.fulfilment_pending",
    stripeSessionId,
    stripeEventId,
    redactedPayload: { stripeEventId: stripeEventId ?? null },
  });
}

export function markDurableManualFulfilmentRequired(orderDraftId: string, stripeSessionId?: string, stripeEventId?: string) {
  return updateDurableOrderState({
    orderDraftId,
    status: "manual_fulfilment_required",
    eventType: "manual_fulfilment_required",
    sourceRoute: "app.api.stripe.webhook.manual_fulfilment",
    stripeSessionId,
    stripeEventId,
    severity: "review",
    redactedPayload: { reason: "no_automatic_provider_items" },
  });
}

export async function markDurableProviderDraftCreated(orderDraftId: string, stripeSessionId: string | undefined, stripeEventId: string | undefined, providerOrderId: string | number | undefined) {
  const result = await updateDurableOrderState({
    orderDraftId,
    status: "fulfilment_pending",
    eventType: "provider_draft_created",
    sourceRoute: "lib.providers.fulfilment.create_provider_order_draft",
    stripeSessionId,
    stripeEventId,
    provider: "printful",
    providerOrderId: providerOrderId ? String(providerOrderId) : undefined,
    redactedPayload: { providerOrderId: providerOrderId ? String(providerOrderId) : null },
  });
  if (!result.durableWrite) return result;
  await enqueueFulfilmentProviderSync({
    orderDraftId,
    expectedProviderOrderId: providerOrderId,
    previousStatus: "draft",
    pendingSince: new Date().toISOString(),
  });
  return result;
}

export function markDurableOrderFailed(orderDraftId: string, reason: string, stripeSessionId?: string, stripeEventId?: string) {
  return updateDurableOrderState({
    orderDraftId,
    status: "failed",
    eventType: "order_failed",
    sourceRoute: "lib.orders.durable-order-state.markDurableOrderFailed",
    stripeSessionId,
    stripeEventId,
    severity: "error",
    redactedPayload: { reason: reason.slice(0, 180) },
  });
}


export function markDurableOrderRefundPending(orderDraftId: string, paymentActionReference: string) {
  return updateDurableOrderState({
    orderDraftId,
    status: "cancelled",
    eventType: "refund_pending",
    sourceRoute: "lib.orders.fulfilment-incident-outbox-worker.refund_pending",
    provider: "stripe",
    severity: "review",
    redactedPayload: { paymentActionReference: paymentActionReference.slice(0, 160) },
  });
}

export async function recordDurableOrderPartialRefund(input: {
  orderDraftId: string;
  stripeSessionId?: string;
  stripeEventId: string;
  amount: number;
  amountRefunded: number;
  currency?: string | null;
}) {
  const idempotencyKey = stableHash(
    {
      orderDraftId: input.orderDraftId,
      stripeEventId: input.stripeEventId,
      eventType: "partial_refund_recorded",
    },
    "order_state",
  );
  if (!hasSupabaseServiceRoleConfig()) {
    assertDurableOrderStorageConfigured();
    return blockedResult({
      orderDraftId: input.orderDraftId,
      status: "paid",
      eventType: "partial_refund_recorded",
      idempotencyKey,
    });
  }
  try {
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) throw new Error("durable_order_storage_unavailable");
    const { data, error } = await supabase
      .from("velmere_order_drafts")
      .select("id,status,stripe_session_id")
      .eq("id", input.orderDraftId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("durable_order_partial_refund_target_missing");
    const status = data.status as OrderStatus;
    if (!ORDER_STATUSES.has(status)) {
      throw new Error("durable_order_partial_refund_status_invalid");
    }
    if (
      input.stripeSessionId &&
      data.stripe_session_id &&
      data.stripe_session_id !== input.stripeSessionId
    ) {
      throw new Error("durable_order_partial_refund_session_mismatch");
    }
    await appendDurableStateEvent({
      orderDraftId: input.orderDraftId,
      eventType: "partial_refund_recorded",
      statusBefore: status,
      statusAfter: status,
      stripeSessionId: input.stripeSessionId,
      stripeEventId: input.stripeEventId,
      provider: "stripe",
      severity: "review",
      sourceRoute: "app.api.stripe.webhook.partial_refund",
      idempotencyKey,
      redactedPayload: {
        amount: input.amount,
        amountRefunded: input.amountRefunded,
        currency: input.currency?.toUpperCase() ?? null,
        fullRefund: false,
      },
    });
    return {
      schemaVersion: "velmere.durable-order-state.write-result.v1",
      ok: true,
      persisted: true,
      durableWrite: true,
      mode: "supabase",
      orderDraftId: input.orderDraftId,
      status,
      eventType: "partial_refund_recorded",
      idempotencyKey,
      productionBoundary:
        "Partial refund was recorded durably without changing the order to fully refunded.",
    } satisfies DurableOrderStateWriteResult;
  } catch (error) {
    return blockedResult({
      orderDraftId: input.orderDraftId,
      status: "paid",
      eventType: "partial_refund_recorded",
      idempotencyKey,
      providerError:
        error instanceof Error ? error.message : "durable_order_partial_refund_failed",
    });
  }
}



export function markDurableProviderStatusSynced(
  orderDraftId: string,
  providerOrderId: string,
  providerStatus: string,
) {
  return updateDurableOrderState({
    orderDraftId,
    status: "fulfilment_pending",
    eventType: "provider_status_synced",
    sourceRoute: "lib.orders.fulfilment-provider-status-sync",
    provider: "printful",
    providerOrderId,
    redactedPayload: { providerStatus: providerStatus.slice(0, 40) },
  });
}

export function markDurableOrderFulfilled(orderDraftId: string, providerOrderId: string) {
  return updateDurableOrderState({
    orderDraftId,
    status: "fulfilled",
    eventType: "provider_fulfilled",
    sourceRoute: "lib.orders.fulfilment-provider-status-sync",
    provider: "printful",
    providerOrderId,
    redactedPayload: { providerStatus: "fulfilled" },
  });
}


export function markDurableProviderRefunded(orderDraftId: string, providerOrderId: string) {
  return updateDurableOrderState({
    orderDraftId,
    status: "refunded",
    eventType: "refunded",
    sourceRoute: "lib.orders.fulfilment-provider-status-sync",
    provider: "printful",
    providerOrderId,
    severity: "review",
    redactedPayload: { providerStatus: "fulfilled_after_refund_expected" },
  });
}
export function markDurableOrderRefunded(orderDraftId: string, stripeSessionId?: string, stripeEventId?: string) {
  return updateDurableOrderState({
    orderDraftId,
    status: "refunded",
    eventType: "refunded",
    sourceRoute: "app.api.stripe.webhook.refunded",
    stripeSessionId,
    stripeEventId,
    provider: "stripe",
    severity: "review",
    redactedPayload: { stripeEventId: stripeEventId ?? null },
  });
}
