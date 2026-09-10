import type Stripe from "stripe";
import { classifyStripeChargeRefund } from "@/lib/payments/commerce-payment-integrity";

export type StripeWebhookProcessingStatus =
  | "processing"
  | "processed"
  | "retryable_failed"
  | "dead_letter";

export type StripeWebhookClaimResult =
  | { claimed: true; status: "processing"; attempt: number }
  | {
      claimed: false;
      status: "processing" | "processed" | "dead_letter";
      attempt: number;
      retryAfterSeconds?: number;
    };

export type PaymentEventKind =
  | "payment_pending"
  | "payment_failed"
  | "checkout_completed"
  | "partial_refund"
  | "refund"
  | "chargeback";

export type PaymentEventWatermark = {
  subjectKey: string;
  eventId: string;
  eventCreatedAt: number;
  kind: PaymentEventKind;
  priority: number;
  terminal: boolean;
};

export type PaymentEventOrderingDecision = {
  accepted: boolean;
  reason:
    | "first_event"
    | "higher_priority"
    | "same_priority_newer"
    | "duplicate_event"
    | "terminal_state_dominates"
    | "lower_priority"
    | "older_same_priority";
  next: PaymentEventWatermark;
};

const EVENT_PRIORITY: Record<PaymentEventKind, number> = {
  payment_pending: 10,
  payment_failed: 20,
  checkout_completed: 40,
  partial_refund: 60,
  refund: 80,
  chargeback: 100,
};

export function paymentEventKindFromStripeType(
  eventType: Stripe.Event.Type,
  object?: unknown,
): PaymentEventKind | null {
  switch (eventType) {
    case "checkout.session.expired":
    case "payment_intent.payment_failed":
    case "checkout.session.async_payment_failed":
      return "payment_failed";
    case "checkout.session.completed":
      return object === undefined ||
        (object as { payment_status?: unknown }).payment_status === "paid"
        ? "checkout_completed"
        : "payment_pending";
    case "checkout.session.async_payment_succeeded":
      return "checkout_completed";
    case "charge.refunded":
      {
        const refund = classifyStripeChargeRefund(object);
        if (refund.kind === "partial") return "partial_refund";
        if (refund.kind === "full") return "refund";
        return null;
      }
    case "charge.dispute.created":
      return "chargeback";
    default:
      return null;
  }
}

export function buildPaymentEventWatermark(input: {
  subjectKey: string;
  eventId: string;
  eventCreatedAt: number;
  kind: PaymentEventKind;
}): PaymentEventWatermark {
  return {
    ...input,
    priority: EVENT_PRIORITY[input.kind],
    terminal: input.kind === "refund" || input.kind === "chargeback",
  };
}

export function decidePaymentEventOrdering(
  current: PaymentEventWatermark | null,
  incoming: PaymentEventWatermark,
): PaymentEventOrderingDecision {
  if (!current) {
    return { accepted: true, reason: "first_event", next: incoming };
  }

  if (current.eventId === incoming.eventId) {
    return { accepted: false, reason: "duplicate_event", next: current };
  }

  // Refund and chargeback are irreversible for the same payment subject.
  // A later/lower-priority checkout event must never reactivate access.
  if (current.terminal && incoming.priority < current.priority) {
    return {
      accepted: false,
      reason: "terminal_state_dominates",
      next: current,
    };
  }

  if (incoming.priority > current.priority) {
    return { accepted: true, reason: "higher_priority", next: incoming };
  }

  if (incoming.priority < current.priority) {
    return { accepted: false, reason: "lower_priority", next: current };
  }

  if (incoming.eventCreatedAt > current.eventCreatedAt) {
    return { accepted: true, reason: "same_priority_newer", next: incoming };
  }

  return { accepted: false, reason: "older_same_priority", next: current };
}

export function stripeObjectPaymentIntentId(object: unknown): string | null {
  if (!object || typeof object !== "object") return null;
  const paymentIntent = (object as { payment_intent?: unknown }).payment_intent;
  if (typeof paymentIntent === "string" && paymentIntent) return paymentIntent;
  if (
    paymentIntent &&
    typeof paymentIntent === "object" &&
    typeof (paymentIntent as { id?: unknown }).id === "string"
  ) {
    return (paymentIntent as { id: string }).id;
  }
  return null;
}

export function stripeEventFallbackSubjectKey(event: Stripe.Event): string {
  const object = event.data.object as {
    id?: string;
    metadata?: Stripe.Metadata;
  };
  const paymentIntentId = stripeObjectPaymentIntentId(object);
  if (paymentIntentId) return `stripe:payment_intent:${paymentIntentId}`;

  const auditCaseRef = object.metadata?.auditCaseRef;
  if (auditCaseRef) return `velmere:audit_case:${auditCaseRef}`;

  const orderDraftId = object.metadata?.orderDraftId;
  if (orderDraftId) return `velmere:order:${orderDraftId}`;

  return `stripe:object:${object.id ?? event.id}`;
}
