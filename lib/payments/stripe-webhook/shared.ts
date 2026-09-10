import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { flushOrderEventStorageWrites } from "@/lib/orders/order-event-storage";
import { completeStripeWebhookEvent } from "@/lib/db/order-service";
import { isPaidAuditProduct } from "@/lib/security/audit-intake-case-vault";
import {
  stripeEventFallbackSubjectKey,
  stripeObjectPaymentIntentId,
} from "@/lib/payments/stripe-webhook-state";

export const SUPPORTED_STRIPE_WEBHOOK_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
]);

export type StripeWebhookContext = {
  event: Stripe.Event;
  stripe: Stripe;
  attempt: number;
};

type CompactMetadataItem = {
  id?: unknown;
  q?: unknown;
  size?: unknown;
};

export type PersistOrderItemInput = {
  productId: string;
  quantity: number;
  selectedSize?: string;
};

export type AuditPaymentEventMetadata = {
  kind?: string;
  productId?: string;
  auditCaseRef?: string;
  auditTier?: string;
  contextHash?: string;
};

export type CommercePaymentEventMetadata = {
  kind: "physical_commerce";
  orderDraftId: string;
  cartHash?: string;
  expectedAmountTotal?: string;
  expectedCurrency?: string;
};

export function customerWebhookHeaders(state: string) {
  return {
    "cache-control": "no-store",
    "x-velmere-webhook-status": state.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80),
  };
}

export async function orderEventJson(body: unknown, init?: ResponseInit) {
  await flushOrderEventStorageWrites();
  return NextResponse.json(body, init);
}

export function maybeOrderDraftIdFromEvent(event: Stripe.Event) {
  const object = event.data.object as {
    metadata?: { orderDraftId?: string };
  };
  return object.metadata?.orderDraftId;
}

export function stripeSessionIdFromEvent(event: Stripe.Event) {
  const object = event.data.object as {
    id?: string;
    metadata?: { stripeSessionId?: string };
  };
  return (
    object.metadata?.stripeSessionId ??
    (typeof object.id === "string" && object.id.startsWith("cs_")
      ? object.id
      : undefined)
  );
}

export function normalizeAuditPaymentMetadata(
  metadata: Stripe.Metadata | null | undefined,
): AuditPaymentEventMetadata | null {
  if (!metadata || metadata.kind !== "vlm_paid_access") return null;
  const productId = metadata.productId;
  const auditCaseRef = metadata.auditCaseRef;
  const contextHash = metadata.contextHash;
  if (
    !isPaidAuditProduct(productId) ||
    !auditCaseRef ||
    !/^[a-f0-9]{64}$/i.test(contextHash ?? "")
  ) {
    return null;
  }
  return {
    kind: metadata.kind,
    productId,
    auditCaseRef,
    auditTier: metadata.auditTier,
    contextHash: contextHash.toLowerCase(),
  };
}

export function normalizeCommercePaymentMetadata(
  metadata: Stripe.Metadata | null | undefined,
): CommercePaymentEventMetadata | null {
  if (!metadata || metadata.kind !== "physical_commerce") return null;
  const orderDraftId = metadata.orderDraftId?.trim();
  if (!orderDraftId || !/^[a-z0-9_-]{1,160}$/i.test(orderDraftId)) return null;
  const cartHash = metadata.cartHash;
  if (cartHash && !/^[a-f0-9]{64}$/i.test(cartHash)) return null;
  return {
    kind: "physical_commerce",
    orderDraftId,
    cartHash: cartHash?.toLowerCase(),
    expectedAmountTotal: metadata.expectedAmountTotal,
    expectedCurrency: metadata.expectedCurrency?.toUpperCase(),
  };
}

/** Resolve physical-order lineage through Session -> PaymentIntent -> Charge. */
export async function commercePaymentMetadataFromEvent(
  event: Stripe.Event,
  stripe: Stripe,
) {
  const object = event.data.object as {
    metadata?: Stripe.Metadata;
    payment_intent?: string | Stripe.PaymentIntent | null;
  };
  const direct = normalizeCommercePaymentMetadata(object.metadata);
  if (direct) return direct;

  const paymentIntentId =
    typeof object.payment_intent === "string"
      ? object.payment_intent
      : object.payment_intent?.id;
  if (paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return normalizeCommercePaymentMetadata(paymentIntent.metadata);
    } catch {
      throw new Error("commerce_payment_metadata_resolution_failed");
    }
  }

  if (event.type !== "charge.dispute.created") return null;
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return null;
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const chargeMetadata = normalizeCommercePaymentMetadata(charge.metadata);
    if (chargeMetadata) return chargeMetadata;
    const chargePaymentIntentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (!chargePaymentIntentId) return null;
    const paymentIntent = await stripe.paymentIntents.retrieve(
      chargePaymentIntentId,
    );
    return normalizeCommercePaymentMetadata(paymentIntent.metadata);
  } catch {
    throw new Error("commerce_payment_metadata_resolution_failed");
  }
}

export async function auditPaymentMetadataFromEvent(
  event: Stripe.Event,
  stripe: Stripe,
) {
  const object = event.data.object as {
    metadata?: Stripe.Metadata;
    payment_intent?: string | Stripe.PaymentIntent;
  };
  const direct = normalizeAuditPaymentMetadata(object.metadata);
  if (direct) return direct;

  if (event.type === "charge.refunded") {
    const paymentIntentId =
      typeof object.payment_intent === "string"
        ? object.payment_intent
        : object.payment_intent?.id;
    if (!paymentIntentId) return null;
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return normalizeAuditPaymentMetadata(paymentIntent.metadata);
    } catch {
      return null;
    }
  }

  if (event.type !== "charge.dispute.created") return null;
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return null;
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const chargeMetadata = normalizeAuditPaymentMetadata(charge.metadata);
    if (chargeMetadata) return chargeMetadata;
    const paymentIntentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (!paymentIntentId) return null;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return normalizeAuditPaymentMetadata(paymentIntent.metadata);
  } catch {
    return null;
  }
}

export async function paymentSubjectKeyFromEvent(
  event: Stripe.Event,
  stripe: Stripe,
) {
  const directPaymentIntent = stripeObjectPaymentIntentId(event.data.object);
  if (directPaymentIntent) return `stripe:payment_intent:${directPaymentIntent}`;

  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object as Stripe.Dispute;
    const chargeId =
      typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (chargeId) {
      try {
        const charge = await stripe.charges.retrieve(chargeId);
        const paymentIntentId = stripeObjectPaymentIntentId(charge);
        if (paymentIntentId) {
          return `stripe:payment_intent:${paymentIntentId}`;
        }
      } catch {
        // Fall back to a stable object/order/audit key below.
      }
    }
  }

  return stripeEventFallbackSubjectKey(event);
}

export async function markWebhookRetryableFailure(
  event: Stripe.Event,
  errorCode: string,
  expectedAttempt: number,
) {
  await completeStripeWebhookEvent({
    eventId: event.id,
    eventType: event.type,
    status: "retryable_failed",
    errorCode,
    expectedAttempt,
  });
}

export async function markWebhookTerminalFailure(
  event: Stripe.Event,
  errorCode: string,
  expectedAttempt: number,
) {
  await completeStripeWebhookEvent({
    eventId: event.id,
    eventType: event.type,
    status: "dead_letter",
    errorCode,
    expectedAttempt,
  });
}

export function parseMetadataOrderItems(
  value: string | null | undefined,
): PersistOrderItemInput[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): PersistOrderItemInput[] => {
      const entry = item as CompactMetadataItem;
      if (typeof entry.id !== "string") return [];
      return [
        {
          productId: entry.id,
          quantity: Number.isFinite(Number(entry.q))
            ? Math.max(1, Math.floor(Number(entry.q)))
            : 1,
          selectedSize:
            typeof entry.size === "string" ? entry.size : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}
