import type Stripe from "stripe";
import { markPaid, type OrderLineItem } from "@/lib/orders/order-store";
import {
  markDurableOrderPaid,
  hydrateDurableOrderDraftForPayment,
} from "@/lib/orders/durable-order-state";
import { appendOrderEvent } from "@/lib/orders/order-event-ledger";
import {
  markStripeWebhookEventProcessed,
  persistStripeCheckoutOrder,
} from "@/lib/db/order-service";
import {
  validateCommercePaidSession,
  type CommerceDurablePaymentBinding,
} from "@/lib/payments/commerce-payment-integrity";
import { runStripeWebhookEffect } from "@/lib/payments/stripe-webhook-effect-ledger";
import {
  customerWebhookHeaders,
  markWebhookTerminalFailure,
  orderEventJson,
  parseMetadataOrderItems,
  type StripeWebhookContext,
} from "../shared";

export type CommerceCheckoutDependencies = {
  markPaid: typeof markPaid;
  markDurableOrderPaid: typeof markDurableOrderPaid;
  hydrateDurableOrderDraftForPayment: typeof hydrateDurableOrderDraftForPayment;
  appendOrderEvent: typeof appendOrderEvent;
  markStripeWebhookEventProcessed: typeof markStripeWebhookEventProcessed;
  markWebhookTerminalFailure: typeof markWebhookTerminalFailure;
  persistStripeCheckoutOrder: typeof persistStripeCheckoutOrder;
  runStripeWebhookEffect: typeof runStripeWebhookEffect;
  parseMetadataOrderItems: typeof parseMetadataOrderItems;
  orderEventJson: typeof orderEventJson;
  customerWebhookHeaders: typeof customerWebhookHeaders;
};

export const commerceCheckoutDependencies: CommerceCheckoutDependencies = {
  markPaid,
  markDurableOrderPaid,
  hydrateDurableOrderDraftForPayment,
  appendOrderEvent,
  markStripeWebhookEventProcessed,
  markWebhookTerminalFailure,
  persistStripeCheckoutOrder,
  runStripeWebhookEffect,
  parseMetadataOrderItems,
  orderEventJson,
  customerWebhookHeaders,
};

function lineItemsForOrderEvent(order: ReturnType<typeof markPaid>) {
  return (order?.lineItems ?? []).map((item: OrderLineItem) => ({
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

export async function handleCommerceCheckout(
  context: StripeWebhookContext,
  session: Stripe.Checkout.Session,
  dependencies: CommerceCheckoutDependencies = commerceCheckoutDependencies,
) {
  const { event, attempt } = context;
  const orderDraftId = session.metadata?.orderDraftId;
  const metadataOrderItems = dependencies.parseMetadataOrderItems(
    session.metadata?.orderItems,
  );
  const walletAddress = session.metadata?.walletAddress || null;
  const locale = session.metadata?.locale || "en";

  // `checkout.session.completed` can be emitted while a delayed payment method
  // is still unpaid. It is safe to acknowledge that pending state, but never to
  // mutate paid/fulfilment state. The later async success event re-enters here.
  if (session.payment_status !== "paid") {
    if (event.type !== "checkout.session.completed") {
      throw new Error("commerce_payment_invariant_failed:payment_not_confirmed");
    }
    await dependencies.markStripeWebhookEventProcessed(
      event.id,
      event.type,
      attempt,
    );
    return dependencies.orderEventJson(
      {
        received: true,
        paymentPending: true,
        fulfilmentReleased: false,
      },
      {
        headers: dependencies.customerWebhookHeaders(
          "commerce-payment-pending-no-fulfilment",
        ),
      },
    );
  }

  if (!orderDraftId) {
    if (attempt >= 5) {
      await dependencies.markWebhookTerminalFailure(
        event,
        "commerce_paid_order_reference_missing",
        attempt,
      );
      return dependencies.orderEventJson(
        {
          received: false,
          retryable: false,
          reviewRequired: true,
          fulfilmentReleased: false,
          error: "commerce_paid_order_unresolved",
        },
        {
          status: 202,
          headers: dependencies.customerWebhookHeaders(
            "commerce-paid-order-dead-letter-review",
          ),
        },
      );
    }
    throw new Error("commerce_paid_order_reference_missing");
  }

  let durableBinding: CommerceDurablePaymentBinding | null;
  try {
    durableBinding =
      await dependencies.hydrateDurableOrderDraftForPayment(orderDraftId);
  } catch (error) {
    const hydrationCode =
      error instanceof Error ? error.message.slice(0, 100) : "unknown";
    if (
      attempt >= 5 &&
      /binding_invalid|replay_snapshot|line_item_invalid/.test(hydrationCode)
    ) {
      await dependencies.markWebhookTerminalFailure(
        event,
        "commerce_paid_order_durable_record_invalid",
        attempt,
      );
      return dependencies.orderEventJson(
        {
          received: false,
          retryable: false,
          reviewRequired: true,
          fulfilmentReleased: false,
          error: "commerce_paid_order_unresolved",
        },
        {
          status: 202,
          headers: dependencies.customerWebhookHeaders(
            "commerce-paid-order-dead-letter-review",
          ),
        },
      );
    }
    throw new Error(
      `commerce_order_durable_hydration_failed:${hydrationCode}`,
      { cause: error },
    );
  }
  if (!durableBinding) {
    if (attempt >= 5) {
      await dependencies.markWebhookTerminalFailure(
        event,
        "commerce_paid_order_durable_record_missing",
        attempt,
      );
      return dependencies.orderEventJson(
        {
          received: false,
          retryable: false,
          reviewRequired: true,
          fulfilmentReleased: false,
          error: "commerce_paid_order_unresolved",
        },
        {
          status: 202,
          headers: dependencies.customerWebhookHeaders(
            "commerce-paid-order-dead-letter-review",
          ),
        },
      );
    }
    throw new Error("commerce_paid_order_durable_record_missing");
  }

  const paymentIntegrity = validateCommercePaidSession({
    event,
    session,
    binding: durableBinding,
  });
  if (!paymentIntegrity.ok) {
    if (attempt >= 5) {
      await dependencies.markWebhookTerminalFailure(
        event,
        `commerce_payment_invariant_${paymentIntegrity.code}`,
        attempt,
      );
      return dependencies.orderEventJson(
        {
          received: false,
          retryable: false,
          reviewRequired: true,
          fulfilmentReleased: false,
          error: "commerce_payment_invariant_rejected",
          reasonCode: paymentIntegrity.code,
        },
        {
          status: 202,
          headers: dependencies.customerWebhookHeaders(
            "commerce-payment-invariant-dead-letter-review",
          ),
        },
      );
    }
    throw new Error(
      `commerce_payment_invariant_failed:${paymentIntegrity.code}`,
    );
  }

  const automaticPrintfulLineCount = durableBinding.order.lineItems.filter(
    (item: OrderLineItem) =>
      item.provider === "printful" && item.fulfilmentMode === "automatic",
  ).length;
  const fulfilmentAction = automaticPrintfulLineCount > 0
    ? "printful_order_draft" as const
    : "manual_fulfilment_review" as const;

  const durablePaid = await dependencies.markDurableOrderPaid({
    orderDraftId,
    stripeSessionId: session.id,
    stripeEventId: event.id,
    stripePaymentIntentId: paymentIntegrity.paymentIntentId,
    cartHash: durableBinding.cartHash,
    amountTotal: paymentIntegrity.amountTotal,
    currency: paymentIntegrity.currency,
    livemode: session.livemode,
    fulfilmentAction,
    automaticPrintfulLineCount,
  });
  if (
    !durablePaid.persisted ||
    !/^commerce_fulfilment_[a-f0-9]{32}$/.test(
      durablePaid.outboxRequestId ?? "",
    ) ||
    durablePaid.fulfilmentAction !== fulfilmentAction ||
    !durablePaid.outboxStatus ||
    durablePaid.outboxStatus === "dead_letter" ||
    durablePaid.outboxStatus === "cancelled"
  ) {
    throw new Error(
      `commerce_order_paid_transition_failed:${
        durablePaid.providerError ?? "durable_write_required"
      }`,
    );
  }

  // The in-process cache is only a convenience. The durable replay snapshot is
  // authoritative and keeps multi-instance/serverless webhook execution safe.
  const localPaidOrder = dependencies.markPaid(orderDraftId, session.id);
  const order = localPaidOrder ?? {
    ...durableBinding.order,
    status: "paid" as const,
    stripeSessionId: session.id,
  };

  const persistenceEffect = await dependencies.runStripeWebhookEffect({
    eventId: event.id,
    eventType: event.type,
    effectKey: "commerce:order_persistence",
    execute: async () => {
      const result = await dependencies.persistStripeCheckoutOrder({
        session,
        locale,
        walletAddress,
        orderItems:
          order?.lineItems.map((item: OrderLineItem) => ({
            productId: item.productId,
            variantId: item.variantId,
            selectedSize: item.selectedSize,
            quantity: item.quantity,
            title: item.title,
            unitAmount: item.amount,
            currency: item.currency,
            provider: item.provider,
            providerVariantId: item.providerVariantId,
          })) ?? metadataOrderItems,
        fallbackOrder: order,
      });
      return result.persisted
        ? { persisted: true as const, orderId: result.orderId }
        : { persisted: false as const };
    },
  });
  const persisted = persistenceEffect.receipt;
  if (!persisted.persisted) {
    throw new Error("commerce_order_persistence_durable_write_required");
  }

  const queuedEventType = fulfilmentAction === "printful_order_draft"
    ? "provider_draft_requested" as const
    : "manual_fulfilment_required" as const;
  dependencies.appendOrderEvent({
    orderDraftId,
    eventType: queuedEventType,
    actor: "system",
    sourceRoute: "app.api.stripe.webhook.atomic_fulfilment_outbox",
    statusBefore: order.status,
    statusAfter: order.status,
    stripeSessionId: session.id,
    stripeEventId: event.id,
    guardSummary: order.guardSummary,
    lineItems: lineItemsForOrderEvent(order),
    evidence: {
      fulfilmentAction,
      automaticPrintfulLineCount,
      outboxRequestId: durablePaid.outboxRequestId,
      outboxStatus: durablePaid.outboxStatus,
      providerExecutionInline: false,
    },
    idempotencyKey: `stripe:${event.id}:fulfilment_outbox_queued`,
  });

  await dependencies.markStripeWebhookEventProcessed(
    event.id,
    event.type,
    attempt,
  );
  return dependencies.orderEventJson(
    {
      received: true,
      fulfilmentQueued: true,
      fulfilmentReleased: false,
      outboxRequestId: durablePaid.outboxRequestId,
    },
    {
      headers: dependencies.customerWebhookHeaders(
        "commerce-order-webhook-signed",
      ),
    },
  );
}
