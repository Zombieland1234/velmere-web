import {
  markPaymentFailed,
  markRefunded,
} from "@/lib/orders/order-store";
import {
  markDurableOrderPaymentFailed,
  markDurableOrderRefunded,
  recordDurableOrderPartialRefund,
} from "@/lib/orders/durable-order-state";
import { appendOrderEvent } from "@/lib/orders/order-event-ledger";
import { markStripeWebhookEventProcessed } from "@/lib/db/order-service";
import { runStripeWebhookEffect } from "@/lib/payments/stripe-webhook-effect-ledger";
import { applyVlmPaidEntitlementLifecycleEvent } from "@/lib/commerce/vlm-entitlement-lifecycle";
import { findVlmPaidEntitlementByStripeBinding } from "@/lib/commerce/vlm-entitlement-ledger";
import { resolveVlmPaidTerminalBindingFromEvent } from "@/lib/payments/stripe-webhook/vlm-terminal-binding";
import {
  applyAuditCasePaymentTerminalEvent,
  isPaidAuditProduct,
} from "@/lib/security/audit-intake-case-vault";
import {
  auditPaymentMetadataFromEvent,
  commercePaymentMetadataFromEvent,
  customerWebhookHeaders,
  markWebhookTerminalFailure,
  markWebhookRetryableFailure,
  maybeOrderDraftIdFromEvent,
  orderEventJson,
  stripeSessionIdFromEvent,
  type StripeWebhookContext,
} from "../shared";
import { classifyStripeChargeRefund } from "@/lib/payments/commerce-payment-integrity";

export type TerminalEventDependencies = {
  auditPaymentMetadataFromEvent: typeof auditPaymentMetadataFromEvent;
  commercePaymentMetadataFromEvent: typeof commercePaymentMetadataFromEvent;
  isPaidAuditProduct: typeof isPaidAuditProduct;
  applyAuditCasePaymentTerminalEvent: typeof applyAuditCasePaymentTerminalEvent;
  runStripeWebhookEffect: typeof runStripeWebhookEffect;
  applyVlmPaidEntitlementLifecycleEvent: typeof applyVlmPaidEntitlementLifecycleEvent;
  findVlmPaidEntitlementByStripeBinding: typeof findVlmPaidEntitlementByStripeBinding;
  resolveVlmPaidTerminalBindingFromEvent: typeof resolveVlmPaidTerminalBindingFromEvent;
  maybeOrderDraftIdFromEvent: typeof maybeOrderDraftIdFromEvent;
  stripeSessionIdFromEvent: typeof stripeSessionIdFromEvent;
  markPaymentFailed: typeof markPaymentFailed;
  markRefunded: typeof markRefunded;
  markDurableOrderPaymentFailed: typeof markDurableOrderPaymentFailed;
  markDurableOrderRefunded: typeof markDurableOrderRefunded;
  recordDurableOrderPartialRefund: typeof recordDurableOrderPartialRefund;
  appendOrderEvent: typeof appendOrderEvent;
  markStripeWebhookEventProcessed: typeof markStripeWebhookEventProcessed;
  markWebhookTerminalFailure: typeof markWebhookTerminalFailure;
  markWebhookRetryableFailure: typeof markWebhookRetryableFailure;
  orderEventJson: typeof orderEventJson;
  customerWebhookHeaders: typeof customerWebhookHeaders;
};

export const terminalEventDependencies: TerminalEventDependencies = {
  auditPaymentMetadataFromEvent,
  commercePaymentMetadataFromEvent,
  isPaidAuditProduct,
  applyAuditCasePaymentTerminalEvent,
  runStripeWebhookEffect,
  applyVlmPaidEntitlementLifecycleEvent,
  findVlmPaidEntitlementByStripeBinding,
  resolveVlmPaidTerminalBindingFromEvent,
  maybeOrderDraftIdFromEvent,
  stripeSessionIdFromEvent,
  markPaymentFailed,
  markRefunded,
  markDurableOrderPaymentFailed,
  markDurableOrderRefunded,
  recordDurableOrderPartialRefund,
  appendOrderEvent,
  markStripeWebhookEventProcessed,
  markWebhookTerminalFailure,
  markWebhookRetryableFailure,
  orderEventJson,
  customerWebhookHeaders,
};

export async function handlePaymentFailedOrExpired(
  { event, stripe, attempt }: StripeWebhookContext,
  dependencies: TerminalEventDependencies = terminalEventDependencies,
) {
  const commerceMetadata =
    await dependencies.commercePaymentMetadataFromEvent(event, stripe);
  const auditMetadata = await dependencies.auditPaymentMetadataFromEvent(
    event,
    stripe,
  );
  if (
    auditMetadata &&
    dependencies.isPaidAuditProduct(auditMetadata.productId)
  ) {
    const transition = await dependencies.applyAuditCasePaymentTerminalEvent({
      caseRef: auditMetadata.auditCaseRef ?? "",
      productId: auditMetadata.productId,
      contextHash: auditMetadata.contextHash ?? "",
      eventId: event.id,
      eventType:
        event.type === "checkout.session.expired"
          ? "checkout_expired"
          : "payment_failed",
    });
    if (!transition.ok) {
      await dependencies.markWebhookRetryableFailure(
        event,
        "audit_payment_terminal_transition_failed",
        attempt,
      );
      return dependencies.orderEventJson(
        {
          received: false,
          retryable: true,
          error: "webhook_processing_retryable",
        },
        {
          status: 500,
          headers: dependencies.customerWebhookHeaders(
            "audit-payment-terminal-retry",
          ),
        },
      );
    }
  }

  const orderDraftId =
    commerceMetadata?.orderDraftId ??
    dependencies.maybeOrderDraftIdFromEvent(event);
  const stripeSessionId = dependencies.stripeSessionIdFromEvent(event);
  if (orderDraftId) {
    const durableFailure = await dependencies.markDurableOrderPaymentFailed(
      orderDraftId,
      stripeSessionId,
      event.id,
      event.type,
    );
    if (!durableFailure.persisted) {
      await dependencies.markWebhookRetryableFailure(
        event,
        durableFailure.providerError ?? "durable_order_payment_failure_transition_failed",
        attempt,
      );
      return dependencies.orderEventJson(
        { received: false, retryable: true, error: "webhook_processing_retryable" },
        { status: 500, headers: dependencies.customerWebhookHeaders("payment-failure-durable-write-retry") },
      );
    }
    dependencies.markPaymentFailed(orderDraftId, event.type, stripeSessionId);
    dependencies.appendOrderEvent({
      orderDraftId,
      eventType: "payment_failed",
      actor: "stripe",
      sourceRoute: "app.api.stripe.webhook.payment_failed",
      stripeEventId: event.id,
      stripeSessionId,
      severity: "error",
      reasonCodes: [event.type],
      evidence: { eventType: event.type },
      idempotencyKey: `stripe:${event.id}:payment_failed`,
    });
  }

  await dependencies.markStripeWebhookEventProcessed(
    event.id,
    event.type,
    attempt,
  );
  return dependencies.orderEventJson({
    received: true,
    type: event.type,
    stateUpdated: true,
  });
}

export async function handleRefundOrChargeback(
  { event, stripe, attempt }: StripeWebhookContext,
  dependencies: TerminalEventDependencies = terminalEventDependencies,
) {
  const commerceMetadata =
    await dependencies.commercePaymentMetadataFromEvent(event, stripe);
  const refundClassification =
    event.type === "charge.refunded"
      ? classifyStripeChargeRefund(event.data.object)
      : null;

  if (event.type === "charge.refunded" && refundClassification?.kind === "unknown") {
    if (attempt >= 5) {
      await dependencies.markWebhookTerminalFailure(
        event,
        "stripe_refund_amount_or_currency_unverified",
        attempt,
      );
      return dependencies.orderEventJson({
        received: false,
        retryable: false,
        reviewRequired: true,
        accessRevoked: false,
        error: "stripe_refund_unverified_dead_letter",
      }, {
        status: 202,
        headers: dependencies.customerWebhookHeaders("refund-unverified-dead-letter-review"),
      });
    }
    await dependencies.markWebhookRetryableFailure(
      event,
      "stripe_refund_amount_or_currency_unverified",
      attempt,
    );
    return dependencies.orderEventJson({
      received: false,
      retryable: true,
      accessRevoked: false,
      error: "stripe_refund_unverified",
    }, {
      status: 500,
      headers: dependencies.customerWebhookHeaders("refund-unverified-retry"),
    });
  }

  // Stripe emits charge.refunded for partial refunds too. A partial refund is
  // reviewable evidence, not proof that the entire order/payment was refunded.
  if (refundClassification?.kind === "partial") {
    const orderDraftId =
      commerceMetadata?.orderDraftId ??
      dependencies.maybeOrderDraftIdFromEvent(event);
    const stripeSessionId = dependencies.stripeSessionIdFromEvent(event);
    if (!orderDraftId) {
      if (attempt >= 5) {
        await dependencies.markWebhookTerminalFailure(
          event,
          "partial_refund_order_binding_missing",
          attempt,
        );
        return dependencies.orderEventJson({
          received: false,
          retryable: false,
          reviewRequired: true,
          accessRevoked: false,
          error: "partial_refund_unbound_dead_letter",
        }, { status: 202, headers: dependencies.customerWebhookHeaders("partial-refund-unbound-dead-letter-review") });
      }
      await dependencies.markWebhookRetryableFailure(
        event,
        "partial_refund_order_binding_missing",
        attempt,
      );
      return dependencies.orderEventJson({
        received: false,
        retryable: true,
        accessRevoked: false,
        error: "partial_refund_order_binding_missing",
      }, { status: 500, headers: dependencies.customerWebhookHeaders("partial-refund-unbound-retry") });
    }
    {
      const durablePartialRefund =
        await dependencies.recordDurableOrderPartialRefund({
          orderDraftId,
          stripeSessionId,
          stripeEventId: event.id,
          amount: refundClassification.amount ?? 0,
          amountRefunded: refundClassification.amountRefunded ?? 0,
          currency: refundClassification.currency,
        });
      if (!durablePartialRefund.persisted) {
        await dependencies.markWebhookRetryableFailure(
          event,
          durablePartialRefund.providerError ??
            "durable_order_partial_refund_failed",
          attempt,
        );
        return dependencies.orderEventJson(
          {
            received: false,
            retryable: true,
            error: "webhook_processing_retryable",
          },
          {
            status: 500,
            headers: dependencies.customerWebhookHeaders(
              "partial-refund-durable-write-retry",
            ),
          },
        );
      }
      dependencies.appendOrderEvent({
        orderDraftId,
        eventType: "refund_partial",
        actor: "stripe",
        sourceRoute: "app.api.stripe.webhook.partial_refund",
        stripeEventId: event.id,
        stripeSessionId,
        severity: "review",
        reasonCodes: ["charge.refunded", "partial_refund"],
        evidence: {
          eventType: event.type,
          amount: refundClassification.amount,
          amountRefunded: refundClassification.amountRefunded,
          currency: refundClassification.currency,
          fullRefund: false,
        },
        idempotencyKey: `stripe:${event.id}:partial_refund`,
      });
    }
    await dependencies.markStripeWebhookEventProcessed(
      event.id,
      event.type,
      attempt,
    );
    return dependencies.orderEventJson({
      received: true,
      type: event.type,
      partialRefund: true,
      fullRefund: false,
      accessRevoked: false,
      reviewRequired: true,
      stateUpdated: Boolean(orderDraftId),
    });
  }

  const auditMetadata = await dependencies.auditPaymentMetadataFromEvent(
    event,
    stripe,
  );
  let auditEntitlementId: string | null = null;
  if (
    auditMetadata &&
    dependencies.isPaidAuditProduct(auditMetadata.productId)
  ) {
    const transition = await dependencies.applyAuditCasePaymentTerminalEvent({
      caseRef: auditMetadata.auditCaseRef ?? "",
      productId: auditMetadata.productId,
      contextHash: auditMetadata.contextHash ?? "",
      eventId: event.id,
      eventType:
        event.type === "charge.dispute.created" ? "chargeback" : "refund",
    });
    if (!transition.ok) {
      await dependencies.markWebhookRetryableFailure(
        event,
        "audit_access_revocation_failed",
        attempt,
      );
      return dependencies.orderEventJson(
        {
          received: false,
          retryable: true,
          error: "webhook_processing_retryable",
        },
        {
          status: 500,
          headers: dependencies.customerWebhookHeaders(
            "audit-access-revocation-retry",
          ),
        },
      );
    }
    auditEntitlementId = transition.record?.entitlementId?.trim() || null;
  }

  const terminalBinding = auditEntitlementId
    ? ({ ok: false, error: "audit_entitlement_already_bound", retryable: false, notVlmPaidAccess: true } as const)
    : await dependencies.resolveVlmPaidTerminalBindingFromEvent(event, stripe);
  if (!terminalBinding.ok && terminalBinding.retryable) {
    await dependencies.markWebhookRetryableFailure(event, terminalBinding.error, attempt);
    return dependencies.orderEventJson(
      { received: false, retryable: true, error: "webhook_processing_retryable" },
      { status: 500, headers: dependencies.customerWebhookHeaders("vlm-entitlement-binding-retry") },
    );
  }

  if (terminalBinding.ok || auditEntitlementId) {
    let entitlementId = auditEntitlementId;
    if (!entitlementId && terminalBinding.ok) {
      const lookup = await dependencies.findVlmPaidEntitlementByStripeBinding({
        stripeSessionId: terminalBinding.binding.stripeSessionId,
        productId: terminalBinding.binding.productId,
        contextHash: terminalBinding.binding.contextHash,
      });
      if (!lookup.ok) {
        await dependencies.markWebhookRetryableFailure(event, lookup.error, attempt);
        return dependencies.orderEventJson(
          { received: false, retryable: true, error: "webhook_processing_retryable" },
          { status: 500, headers: dependencies.customerWebhookHeaders("vlm-entitlement-lookup-retry") },
        );
      }
      entitlementId = lookup.entitlement.id;
    }

    if (!entitlementId) {
      await dependencies.markWebhookRetryableFailure(event, "vlm_entitlement_binding_missing", attempt);
      return dependencies.orderEventJson(
        { received: false, retryable: true, error: "webhook_processing_retryable" },
        { status: 500, headers: dependencies.customerWebhookHeaders("vlm-entitlement-binding-missing") },
      );
    }

    try {
      await dependencies.runStripeWebhookEffect({
        eventId: event.id,
        eventType: event.type,
        effectKey: "vlm_paid_access:entitlement_terminal_revoke",
        execute: async () => {
          const lifecycle = await dependencies.applyVlmPaidEntitlementLifecycleEvent({
            entitlementId,
            eventId: `stripe:${event.id}:entitlement:${entitlementId}`,
            event: event.type === "charge.dispute.created" ? "chargeback" : "refund",
            sourceEventId: event.id,
            reason: event.type,
          });
          if (!lifecycle.ok) throw new Error(lifecycle.error);
          return lifecycle;
        },
      });
    } catch (error) {
      await dependencies.markWebhookRetryableFailure(
        event,
        error instanceof Error ? error.message : "vlm_entitlement_revocation_failed",
        attempt,
      );
      return dependencies.orderEventJson(
        { received: false, retryable: true, error: "webhook_processing_retryable" },
        { status: 500, headers: dependencies.customerWebhookHeaders("vlm-entitlement-revocation-retry") },
      );
    }
  }

  const orderDraftId =
    commerceMetadata?.orderDraftId ??
    dependencies.maybeOrderDraftIdFromEvent(event);
  const stripeSessionId = dependencies.stripeSessionIdFromEvent(event);
  if (orderDraftId) {
    const durableRefund = await dependencies.markDurableOrderRefunded(
      orderDraftId,
      stripeSessionId,
      event.id,
    );
    if (!durableRefund.persisted) {
      await dependencies.markWebhookRetryableFailure(
        event,
        durableRefund.providerError ?? "durable_order_refund_transition_failed",
        attempt,
      );
      return dependencies.orderEventJson(
        { received: false, retryable: true, error: "webhook_processing_retryable" },
        { status: 500, headers: dependencies.customerWebhookHeaders("refund-durable-write-retry") },
      );
    }
    dependencies.markRefunded(orderDraftId, stripeSessionId);
    dependencies.appendOrderEvent({
      orderDraftId,
      eventType: "refunded",
      actor: "stripe",
      sourceRoute:
        event.type === "charge.dispute.created"
          ? "app.api.stripe.webhook.chargeback"
          : "app.api.stripe.webhook.refunded",
      stripeEventId: event.id,
      stripeSessionId,
      severity: "review",
      reasonCodes: [event.type],
      evidence: { eventType: event.type },
      idempotencyKey: `stripe:${event.id}:refunded`,
    });
  }

  await dependencies.markStripeWebhookEventProcessed(
    event.id,
    event.type,
    attempt,
  );
  return dependencies.orderEventJson({
    received: true,
    type: event.type,
    stateUpdated: true,
  });
}
