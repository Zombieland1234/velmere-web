import type Stripe from "stripe";
import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import type { OrderLineItem } from "@/lib/orders/order-store";
import { assertStripeWebhookCompletionLease } from "@/lib/payments/stripe-webhook-lease";
import { buildOperationalLogRecord, writeOperationalEvent } from "@/lib/security/operational-log-boundary";
import {
  buildPaymentEventWatermark,
  decidePaymentEventOrdering,
  type PaymentEventKind,
  type PaymentEventWatermark,
  type StripeWebhookClaimResult,
  type StripeWebhookProcessingStatus,
} from "@/lib/payments/stripe-webhook-state";

export type PersistOrderItemInput = {
  productId: string;
  variantId?: string;
  selectedSize?: string;
  quantity: number;
  title?: string;
  unitAmount?: number | null;
  currency?: string | null;
  provider?: string | null;
  providerVariantId?: string | null;
};

export type PersistStripeOrderInput = {
  session: Stripe.Checkout.Session;
  locale?: string;
  walletAddress?: string | null;
  orderItems: PersistOrderItemInput[];
  fallbackOrder?: {
    id?: string;
    lineItems?: OrderLineItem[];
  } | null;
};


const memoryStripeWebhookEvents = new Map<
  string,
  {
    status: StripeWebhookProcessingStatus;
    eventType: string;
    eventCreatedAt: number;
    attemptCount: number;
    claimedAt: number;
    lastErrorCode?: string;
  }
>();
const memoryPaymentEventWatermarks = new Map<string, PaymentEventWatermark>();
const WEBHOOK_CLAIM_STALE_MS = 5 * 60 * 1000;

function requiresDurablePaymentStorage() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function canUseDurablePaymentStorage() {
  return hasSupabaseServiceRoleConfig();
}

export async function claimStripeWebhookEvent(input: {
  eventId: string;
  eventType: string;
  eventCreatedAt: number;
}): Promise<StripeWebhookClaimResult> {
  const now = Date.now();
  const existing = memoryStripeWebhookEvents.get(input.eventId);
  if (!canUseDurablePaymentStorage()) {
    if (requiresDurablePaymentStorage()) {
      throw new Error("stripe_webhook_claim_storage_unavailable");
    }
    if (existing?.status === "processed" || existing?.status === "dead_letter") {
      return { claimed: false, status: existing.status, attempt: existing.attemptCount };
    }
    if (
      existing?.status === "processing" &&
      now - existing.claimedAt < WEBHOOK_CLAIM_STALE_MS
    ) {
      return {
        claimed: false,
        status: "processing",
        attempt: existing.attemptCount,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((WEBHOOK_CLAIM_STALE_MS - (now - existing.claimedAt)) / 1000),
        ),
      };
    }
    const attemptCount = (existing?.attemptCount ?? 0) + 1;
    memoryStripeWebhookEvents.set(input.eventId, {
      status: "processing",
      eventType: input.eventType,
      eventCreatedAt: input.eventCreatedAt,
      attemptCount,
      claimedAt: now,
    });
    return { claimed: true, status: "processing", attempt: attemptCount };
  }

  let data: unknown;
  try {
    ({ data } = await runRegisteredServiceRoleRpc({
      operation: "stripe_webhook_event_claim",
      args: {
        p_event_id: input.eventId,
        p_event_type: input.eventType,
        p_event_created_at: input.eventCreatedAt,
        p_stale_after_seconds: Math.floor(WEBHOOK_CLAIM_STALE_MS / 1000),
      },
    }));
  } catch {
    throw new Error("stripe_webhook_claim_failed");
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("stripe_webhook_claim_empty_result");
  return row.claimed
    ? {
        claimed: true,
        status: "processing",
        attempt: Number(row.attempt_count ?? 1),
      }
    : {
        claimed: false,
        status: row.status === "processed"
          ? "processed"
          : row.status === "dead_letter"
            ? "dead_letter"
            : "processing",
        attempt: Number(row.attempt_count ?? 1),
        retryAfterSeconds: row.retry_after_seconds
          ? Number(row.retry_after_seconds)
          : undefined,
      };
}

export async function completeStripeWebhookEvent(input: {
  eventId: string;
  eventType: string;
  status: "processed" | "retryable_failed" | "dead_letter";
  errorCode?: string;
  expectedAttempt: number;
}) {
  const expectedAttempt = Math.max(1, Math.floor(input.expectedAttempt));
  const existing = memoryStripeWebhookEvents.get(input.eventId);

  if (!canUseDurablePaymentStorage()) {
    if (requiresDurablePaymentStorage()) {
      throw new Error("stripe_webhook_completion_storage_unavailable");
    }
    const activeLease = existing ?? null;
    assertStripeWebhookCompletionLease(activeLease, expectedAttempt);
    memoryStripeWebhookEvents.set(input.eventId, {
      status: input.status,
      eventType: input.eventType,
      eventCreatedAt: existing?.eventCreatedAt ?? 0,
      attemptCount: activeLease.attemptCount,
      claimedAt: existing?.claimedAt ?? Date.now(),
      lastErrorCode: input.errorCode,
    });
    return;
  }

  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("stripe_webhook_completion_storage_unavailable");
  const { data, error } = await supabase
    .from("velmere_stripe_webhook_events")
    .update({
      status: input.status,
      processed_at: new Date().toISOString(),
      last_error_code: input.errorCode ?? null,
    })
    .eq("id", input.eventId)
    .eq("status", "processing")
    .eq("attempt_count", expectedAttempt)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`stripe_webhook_completion_failed:${error.message}`);
  if (!data) throw new Error("stripe_webhook_stale_completion");
}

export async function applyPaymentEventWatermark(input: {
  subjectKey: string;
  eventId: string;
  eventCreatedAt: number;
  kind: PaymentEventKind;
}) {
  const incoming = buildPaymentEventWatermark(input);
  if (!canUseDurablePaymentStorage()) {
    if (requiresDurablePaymentStorage()) {
      throw new Error("payment_event_watermark_storage_unavailable");
    }
    const decision = decidePaymentEventOrdering(
      memoryPaymentEventWatermarks.get(input.subjectKey) ?? null,
      incoming,
    );
    if (decision.accepted) {
      memoryPaymentEventWatermarks.set(input.subjectKey, decision.next);
    }
    return decision;
  }

  let data: unknown;
  try {
    ({ data } = await runRegisteredServiceRoleRpc({
      operation: "payment_event_watermark_apply",
      args: {
        p_subject_key: incoming.subjectKey,
        p_event_id: incoming.eventId,
        p_event_created_at: incoming.eventCreatedAt,
        p_event_kind: incoming.kind,
        p_event_priority: incoming.priority,
        p_terminal: incoming.terminal,
      },
    }));
  } catch {
    throw new Error("payment_event_watermark_failed");
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("payment_event_watermark_empty_result");
  return {
    accepted: Boolean(row.accepted),
    reason: String(row.reason ?? "stale_or_lower_priority"),
    next: incoming,
    currentEventId: row.current_event_id ? String(row.current_event_id) : null,
    currentKind: row.current_kind ? String(row.current_kind) : null,
  };
}

// Compatibility wrappers for older callers. New webhook runtime uses atomic claim/complete.
export async function hasProcessedStripeWebhookEvent(eventId: string) {
  const row = memoryStripeWebhookEvents.get(eventId);
  if (!canUseDurablePaymentStorage()) return row?.status === "processed";
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return row?.status === "processed";
  const { data, error } = await supabase
    .from("velmere_stripe_webhook_events")
    .select("status")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(`stripe_webhook_lookup_failed:${error.message}`);
  return data?.status === "processed";
}

export async function markStripeWebhookEventProcessed(
  eventId: string,
  eventType: string,
  expectedAttempt: number,
) {
  await completeStripeWebhookEvent({
    eventId,
    eventType,
    status: "processed",
    expectedAttempt,
  });
}


function buildProductionLog(input: PersistStripeOrderInput, reason: string) {
  return buildOperationalLogRecord({
    level: "warn",
    system: "velmere.checkout.webhook",
    event: "checkout_session_completed",
    code: reason,
    metrics: {
      persisted: false,
      paymentStatus: input.session.payment_status ?? "unknown",
      amountTotal: input.session.amount_total ?? 0,
      currency: input.session.currency ?? "unknown",
      customerPresent: Boolean(input.session.customer_details),
      itemCount: input.orderItems.length,
    },
    identifiers: {
      stripeSession: input.session.id,
      walletAddress: input.walletAddress ?? "",
      customerEmail: input.session.customer_details?.email ?? "",
      productSet: input.orderItems.map((item) => item.productId).sort().join("|"),
    },
  });
}

export async function persistStripeCheckoutOrder(input: PersistStripeOrderInput) {
  if (!canUseDurablePaymentStorage()) {
    if (requiresDurablePaymentStorage()) {
      throw new Error("stripe_order_persistence_storage_unavailable");
    }
    const log = buildProductionLog(input, "durable_storage_missing");
    writeOperationalEvent({
      level: "warn",
      system: "velmere.checkout.webhook",
      event: "checkout_session_completed",
      code: "durable_storage_missing",
      metrics: log.metrics,
      identifiers: {
        stripeSession: input.session.id,
        walletAddress: input.walletAddress ?? "",
        customerEmail: input.session.customer_details?.email ?? "",
        productSet: input.orderItems.map((item) => item.productId).sort().join("|"),
      },
    });
    return { persisted: false, log } as const;
  }

  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) {
    if (requiresDurablePaymentStorage()) {
      throw new Error("stripe_order_persistence_storage_unavailable");
    }
    const log = buildProductionLog(input, "durable_client_unavailable");
    writeOperationalEvent({
      level: "warn",
      system: "velmere.checkout.webhook",
      event: "checkout_session_completed",
      code: "durable_client_unavailable",
      metrics: log.metrics,
      identifiers: {
        stripeSession: input.session.id,
        walletAddress: input.walletAddress ?? "",
        customerEmail: input.session.customer_details?.email ?? "",
        productSet: input.orderItems.map((item) => item.productId).sort().join("|"),
      },
    });
    return { persisted: false, log } as const;
  }

  const session = input.session;
  const shippingDetails = (session as unknown as { shipping_details?: unknown; collected_information?: { shipping_details?: unknown } }).shipping_details
    ?? (session as unknown as { collected_information?: { shipping_details?: unknown } }).collected_information?.shipping_details
    ?? null;

  const { data: order, error: orderError } = await supabase
    .from("velmere_orders")
    .upsert(
      {
        stripe_session_id: session.id,
        status: session.payment_status === "paid" ? "paid" : "checkout_completed",
        locale: input.locale ?? session.metadata?.locale ?? "en",
        wallet_address: input.walletAddress ?? null,
        currency: session.currency?.toUpperCase() ?? null,
        amount_total: session.amount_total ?? 0,
        amount_subtotal: session.amount_subtotal ?? null,
        amount_tax: session.total_details?.amount_tax ?? null,
        customer_email: session.customer_details?.email ?? null,
        customer_name: session.customer_details?.name ?? null,
        customer_phone: session.customer_details?.phone ?? null,
        customer_details: session.customer_details ?? null,
        shipping_details: shippingDetails,
        billing_details: session.customer_details ?? null,
        metadata: session.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_session_id" },
    )
    .select("id")
    .single();

  if (orderError) throw orderError;

  const rows = input.orderItems.map((item, index) => ({
    order_id: order.id,
    line_index: index,
    product_id: item.productId,
    variant_id: item.variantId ?? null,
    selected_size: item.selectedSize ?? null,
    quantity: item.quantity,
    title: item.title ?? null,
    unit_amount: item.unitAmount ?? null,
    currency: item.currency?.toUpperCase() ?? session.currency?.toUpperCase() ?? null,
    provider: item.provider ?? null,
    provider_variant_id: item.providerVariantId ?? null,
    metadata: item,
  }));

  if (rows.length > 0) {
    await supabase.from("velmere_order_items").delete().eq("order_id", order.id);
    const { error: itemsError } = await supabase.from("velmere_order_items").insert(rows);
    if (itemsError) throw itemsError;
  }

  return { persisted: true, orderId: order.id } as const;
}
