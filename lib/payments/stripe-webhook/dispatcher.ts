import type Stripe from "stripe";
import { appendOrderEvent } from "@/lib/orders/order-event-ledger";
import { markStripeWebhookEventProcessed } from "@/lib/db/order-service";
import {
  customerWebhookHeaders,
  maybeOrderDraftIdFromEvent,
  orderEventJson,
  SUPPORTED_STRIPE_WEBHOOK_EVENTS,
  type StripeWebhookContext,
} from "./shared";
import {
  handlePaymentFailedOrExpired,
  handleRefundOrChargeback,
  terminalEventDependencies,
  type TerminalEventDependencies,
} from "./handlers/terminal-events";
import {
  handleVlmPaidAccess,
  vlmPaidAccessDependencies,
  type VlmPaidAccessDependencies,
} from "./handlers/vlm-paid-access";
import {
  commerceCheckoutDependencies,
  handleCommerceCheckout,
  type CommerceCheckoutDependencies,
} from "./handlers/commerce-checkout";

export type StripeWebhookDispatcherDependencies = {
  appendOrderEvent: typeof appendOrderEvent;
  markStripeWebhookEventProcessed: typeof markStripeWebhookEventProcessed;
  maybeOrderDraftIdFromEvent: typeof maybeOrderDraftIdFromEvent;
  orderEventJson: typeof orderEventJson;
  customerWebhookHeaders: typeof customerWebhookHeaders;
  terminal: TerminalEventDependencies;
  vlmPaidAccess: VlmPaidAccessDependencies;
  commerce: CommerceCheckoutDependencies;
};

export const stripeWebhookDispatcherDependencies: StripeWebhookDispatcherDependencies = {
  appendOrderEvent,
  markStripeWebhookEventProcessed,
  maybeOrderDraftIdFromEvent,
  orderEventJson,
  customerWebhookHeaders,
  terminal: terminalEventDependencies,
  vlmPaidAccess: vlmPaidAccessDependencies,
  commerce: commerceCheckoutDependencies,
};

async function handleUnsupported(
  { event, attempt }: StripeWebhookContext,
  dependencies: StripeWebhookDispatcherDependencies,
) {
  const orderDraftId = dependencies.maybeOrderDraftIdFromEvent(event);
  if (orderDraftId) {
    dependencies.appendOrderEvent({
      orderDraftId,
      eventType: "webhook_unsupported",
      actor: "stripe",
      sourceRoute: "app.api.stripe.webhook.unsupported",
      stripeEventId: event.id,
      evidence: { eventType: event.type },
      idempotencyKey: `stripe:${event.id}:unsupported`,
    });
  }
  await dependencies.markStripeWebhookEventProcessed(
    event.id,
    event.type,
    attempt,
  );
  return dependencies.orderEventJson(
    { received: true, unsupported: true, type: event.type },
    {
      headers: dependencies.customerWebhookHeaders(
        "unsupported-acked-no-order-mutation",
      ),
    },
  );
}

export async function dispatchStripeWebhookEvent(
  context: StripeWebhookContext,
  dependencies: StripeWebhookDispatcherDependencies = stripeWebhookDispatcherDependencies,
) {
  const { event } = context;

  if (!SUPPORTED_STRIPE_WEBHOOK_EVENTS.has(event.type)) {
    return handleUnsupported(context, dependencies);
  }

  if (
    event.type === "checkout.session.expired" ||
    event.type === "payment_intent.payment_failed" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    return handlePaymentFailedOrExpired(context, dependencies.terminal);
  }

  if (
    event.type === "charge.refunded" ||
    event.type === "charge.dispute.created"
  ) {
    return handleRefundOrChargeback(context, dependencies.terminal);
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.kind === "vlm_paid_access") {
      return handleVlmPaidAccess(
        context,
        session,
        dependencies.vlmPaidAccess,
      );
    }
    return handleCommerceCheckout(context, session, dependencies.commerce);
  }

  return handleUnsupported(context, dependencies);
}
