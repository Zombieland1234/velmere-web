import type Stripe from "stripe";
import type { OrderRecord } from "@/lib/orders/order-store";

export type CommerceDurablePaymentBinding = {
  order: OrderRecord;
  orderDraftId: string;
  cartHash: string;
  stripeSessionId: string;
  expectedAmountTotal: number;
  expectedCurrency: string;
  stripeLivemode: boolean;
  stripePaymentIntentId: string | null;
};

export type CommercePaymentIntegrityFailureCode =
  | "unsupported_payment_event"
  | "payment_not_confirmed"
  | "checkout_mode_mismatch"
  | "order_reference_missing"
  | "order_reference_mismatch"
  | "order_kind_mismatch"
  | "cart_hash_missing"
  | "cart_hash_mismatch"
  | "stripe_session_mismatch"
  | "amount_missing"
  | "amount_mismatch"
  | "currency_missing"
  | "currency_mismatch"
  | "livemode_mismatch"
  | "payment_intent_missing"
  | "payment_intent_mismatch"
  | "metadata_amount_mismatch"
  | "metadata_currency_mismatch";

export type CommercePaymentIntegrityResult =
  | {
      ok: true;
      paymentIntentId: string;
      amountTotal: number;
      currency: string;
    }
  | { ok: false; code: CommercePaymentIntegrityFailureCode };

function normalizeCurrency(value: unknown) {
  return typeof value === "string" && /^[a-z]{3}$/i.test(value)
    ? value.toUpperCase()
    : null;
}

export function stripePaymentIntentIdFromSession(
  session: Stripe.Checkout.Session,
) {
  const paymentIntent = session.payment_intent;
  if (typeof paymentIntent === "string" && paymentIntent) return paymentIntent;
  if (
    paymentIntent &&
    typeof paymentIntent === "object" &&
    typeof paymentIntent.id === "string" &&
    paymentIntent.id
  ) {
    return paymentIntent.id;
  }
  return null;
}

export function isCommercePaymentSuccessEvent(eventType: string) {
  return (
    eventType === "checkout.session.completed" ||
    eventType === "checkout.session.async_payment_succeeded"
  );
}

/**
 * A signed Stripe event is necessary but not sufficient to release fulfilment.
 * This binds it to the durable order created before redirecting the customer.
 */
export function validateCommercePaidSession(input: {
  event: Stripe.Event;
  session: Stripe.Checkout.Session;
  binding: CommerceDurablePaymentBinding;
}): CommercePaymentIntegrityResult {
  const { event, session, binding } = input;
  if (!isCommercePaymentSuccessEvent(event.type)) {
    return { ok: false, code: "unsupported_payment_event" };
  }
  if (session.payment_status !== "paid") {
    return { ok: false, code: "payment_not_confirmed" };
  }
  if (session.mode !== "payment") {
    return { ok: false, code: "checkout_mode_mismatch" };
  }

  const metadata = session.metadata;
  if (!metadata?.orderDraftId) {
    return { ok: false, code: "order_reference_missing" };
  }
  if (
    metadata.orderDraftId !== binding.orderDraftId ||
    binding.order.id !== binding.orderDraftId
  ) {
    return { ok: false, code: "order_reference_mismatch" };
  }
  if (metadata.kind && metadata.kind !== "physical_commerce") {
    return { ok: false, code: "order_kind_mismatch" };
  }
  if (!metadata.cartHash) {
    return { ok: false, code: "cart_hash_missing" };
  }
  if (
    metadata.cartHash !== binding.cartHash ||
    binding.order.cartHash !== binding.cartHash
  ) {
    return { ok: false, code: "cart_hash_mismatch" };
  }
  if (session.id !== binding.stripeSessionId) {
    return { ok: false, code: "stripe_session_mismatch" };
  }

  if (!Number.isSafeInteger(session.amount_total) || session.amount_total! < 0) {
    return { ok: false, code: "amount_missing" };
  }
  if (
    !Number.isSafeInteger(binding.expectedAmountTotal) ||
    binding.expectedAmountTotal < 0 ||
    session.amount_total !== binding.expectedAmountTotal
  ) {
    return { ok: false, code: "amount_mismatch" };
  }

  const sessionCurrency = normalizeCurrency(session.currency);
  const expectedCurrency = normalizeCurrency(binding.expectedCurrency);
  if (!sessionCurrency || !expectedCurrency) {
    return { ok: false, code: "currency_missing" };
  }
  if (sessionCurrency !== expectedCurrency) {
    return { ok: false, code: "currency_mismatch" };
  }

  if (
    typeof session.livemode !== "boolean" ||
    typeof event.livemode !== "boolean" ||
    event.livemode !== session.livemode ||
    binding.stripeLivemode !== session.livemode
  ) {
    return { ok: false, code: "livemode_mismatch" };
  }

  const paymentIntentId = stripePaymentIntentIdFromSession(session);
  if (!paymentIntentId) {
    return { ok: false, code: "payment_intent_missing" };
  }
  if (
    binding.stripePaymentIntentId &&
    binding.stripePaymentIntentId !== paymentIntentId
  ) {
    return { ok: false, code: "payment_intent_mismatch" };
  }

  if (
    metadata.expectedAmountTotal &&
    metadata.expectedAmountTotal !== String(binding.expectedAmountTotal)
  ) {
    return { ok: false, code: "metadata_amount_mismatch" };
  }
  if (
    metadata.expectedCurrency &&
    normalizeCurrency(metadata.expectedCurrency) !== expectedCurrency
  ) {
    return { ok: false, code: "metadata_currency_mismatch" };
  }

  return {
    ok: true,
    paymentIntentId,
    amountTotal: session.amount_total,
    currency: sessionCurrency,
  };
}

export type StripeChargeRefundClassification = {
  kind: "partial" | "full" | "unknown";
  amount: number | null;
  amountRefunded: number | null;
  currency: string | null;
};

export function classifyStripeChargeRefund(
  object: unknown,
): StripeChargeRefundClassification {
  if (!object || typeof object !== "object") {
    return { kind: "unknown", amount: null, amountRefunded: null, currency: null };
  }
  const charge = object as {
    amount?: unknown;
    amount_refunded?: unknown;
    refunded?: unknown;
    currency?: unknown;
  };
  const amount = Number.isSafeInteger(charge.amount) && Number(charge.amount) >= 0
    ? Number(charge.amount)
    : null;
  const amountRefunded =
    Number.isSafeInteger(charge.amount_refunded) && Number(charge.amount_refunded) >= 0
      ? Number(charge.amount_refunded)
      : null;
  const currency = normalizeCurrency(charge.currency);

  if (
    amount !== null &&
    amount > 0 &&
    amountRefunded !== null &&
    amountRefunded >= amount &&
    currency !== null
  ) {
    return { kind: "full", amount, amountRefunded, currency };
  }
  if (
    amount !== null &&
    amount > 0 &&
    amountRefunded !== null &&
    amountRefunded > 0 &&
    amountRefunded < amount &&
    currency !== null
  ) {
    return { kind: "partial", amount, amountRefunded, currency };
  }
  return { kind: "unknown", amount, amountRefunded, currency };
}
