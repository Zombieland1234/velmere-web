import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { appendOrderEvent } from "@/lib/orders/order-event-ledger";
import {
  applyPaymentEventWatermark,
  claimStripeWebhookEvent,
  markStripeWebhookEventProcessed,
} from "@/lib/db/order-service";
import { getStripeServerClient } from "@/lib/stripe/server";
import {
  readBoundedBodyBytes,
  validateStripeWebhookBoundary,
} from "@/lib/security/payment-webhook-guard";
import { shouldResumeClaimedWebhookAfterWatermark } from "@/lib/payments/stripe-webhook-lease";
import { paymentEventKindFromStripeType } from "@/lib/payments/stripe-webhook-state";
import { isStripeWebhookTerminalEffectError } from "@/lib/payments/stripe-webhook-effect-ledger";
import { dispatchStripeWebhookEvent } from "./dispatcher";
import { evaluateRuntimePaymentAuthority } from "@/lib/checkout/runtime-payment-authority";
import { evaluateStripeWebhookRuntimeContract } from "@/lib/payments/stripe-webhook-runtime-contract";
import {
  customerWebhookHeaders,
  markWebhookRetryableFailure,
  markWebhookTerminalFailure,
  maybeOrderDraftIdFromEvent,
  orderEventJson,
  paymentSubjectKeyFromEvent,
  SUPPORTED_STRIPE_WEBHOOK_EVENTS,
} from "./shared";

export type StripeWebhookIngressDependencies = {
  validateBoundary: typeof validateStripeWebhookBoundary;
  readBodyBytes: typeof readBoundedBodyBytes;
  webhookSecret: () => string | undefined;
  getSignature: (request: Request) => string | null;
  getStripe: typeof getStripeServerClient;
  getRuntimeAuthority: typeof evaluateRuntimePaymentAuthority;
  validateRuntimeEvent: typeof evaluateStripeWebhookRuntimeContract;
  constructEvent: (
    stripe: Stripe,
    bytes: Uint8Array,
    signature: string,
    webhookSecret: string,
  ) => Stripe.Event;
  claimEvent: typeof claimStripeWebhookEvent;
  appendOrderEvent: typeof appendOrderEvent;
  maybeOrderDraftIdFromEvent: typeof maybeOrderDraftIdFromEvent;
  paymentEventKindFromStripeType: typeof paymentEventKindFromStripeType;
  paymentSubjectKeyFromEvent: typeof paymentSubjectKeyFromEvent;
  applyPaymentEventWatermark: typeof applyPaymentEventWatermark;
  shouldResumeClaimedWebhookAfterWatermark: typeof shouldResumeClaimedWebhookAfterWatermark;
  markEventProcessed: typeof markStripeWebhookEventProcessed;
  markRetryableFailure: typeof markWebhookRetryableFailure;
  markTerminalFailure: typeof markWebhookTerminalFailure;
  dispatchEvent: typeof dispatchStripeWebhookEvent;
  orderEventJson: typeof orderEventJson;
  customerWebhookHeaders: typeof customerWebhookHeaders;
};

export const stripeWebhookIngressDependencies: StripeWebhookIngressDependencies = {
  validateBoundary: validateStripeWebhookBoundary,
  readBodyBytes: readBoundedBodyBytes,
  webhookSecret: () => process.env.STRIPE_WEBHOOK_SECRET,
  getSignature: (request) => request.headers.get("stripe-signature"),
  getStripe: getStripeServerClient,
  getRuntimeAuthority: evaluateRuntimePaymentAuthority,
  validateRuntimeEvent: evaluateStripeWebhookRuntimeContract,
  constructEvent: (stripe, bytes, signature, webhookSecret) =>
    stripe.webhooks.constructEvent(
      Buffer.from(bytes),
      signature,
      webhookSecret,
    ),
  claimEvent: claimStripeWebhookEvent,
  appendOrderEvent,
  maybeOrderDraftIdFromEvent,
  paymentEventKindFromStripeType,
  paymentSubjectKeyFromEvent,
  applyPaymentEventWatermark,
  shouldResumeClaimedWebhookAfterWatermark,
  markEventProcessed: markStripeWebhookEventProcessed,
  markRetryableFailure: markWebhookRetryableFailure,
  markTerminalFailure: markWebhookTerminalFailure,
  dispatchEvent: dispatchStripeWebhookEvent,
  orderEventJson,
  customerWebhookHeaders,
};

async function handleDuplicate(
  event: Stripe.Event,
  claim: {
    status: string;
    attempt: number;
    retryAfterSeconds?: number;
  },
  dependencies: StripeWebhookIngressDependencies,
) {
  const orderDraftId = dependencies.maybeOrderDraftIdFromEvent(event);
  if (orderDraftId) {
    dependencies.appendOrderEvent({
      orderDraftId,
      eventType: "webhook_duplicate",
      actor: "stripe",
      sourceRoute: "app.api.stripe.webhook.atomic_claim",
      stripeEventId: event.id,
      evidence: { eventType: event.type, claimStatus: claim.status },
      idempotencyKey: `stripe:${event.id}:duplicate`,
    });
  }

  if (claim.status === "processing") {
    return dependencies.orderEventJson(
      {
        received: false,
        duplicate: true,
        retryable: true,
        processing: true,
        attempt: claim.attempt,
      },
      {
        status: 409,
        headers: {
          ...dependencies.customerWebhookHeaders("duplicate-processing-retry"),
          "retry-after": String(claim.retryAfterSeconds ?? 10),
        },
      },
    );
  }

  if (claim.status === "dead_letter") {
    return dependencies.orderEventJson(
      {
        received: false,
        duplicate: true,
        retryable: false,
        reviewRequired: true,
      },
      {
        status: 202,
        headers: dependencies.customerWebhookHeaders("dead-letter-review-required"),
      },
    );
  }

  return dependencies.orderEventJson(
    { received: true, duplicate: true },
    { headers: dependencies.customerWebhookHeaders("duplicate-idempotent") },
  );
}

async function applyOrdering(
  event: Stripe.Event,
  stripe: Stripe,
  attempt: number,
  dependencies: StripeWebhookIngressDependencies,
): Promise<Response | null> {
  if (!SUPPORTED_STRIPE_WEBHOOK_EVENTS.has(event.type)) return null;
  const kind = dependencies.paymentEventKindFromStripeType(
    event.type,
    event.data.object,
  );
  if (!kind) return null;

  try {
    const subjectKey = await dependencies.paymentSubjectKeyFromEvent(event, stripe);
    const ordering = await dependencies.applyPaymentEventWatermark({
      subjectKey,
      eventId: event.id,
      eventCreatedAt: event.created,
      kind,
    });
    if (ordering.accepted) return null;

    const resumeRetry = dependencies.shouldResumeClaimedWebhookAfterWatermark({
      claimed: true,
      attempt,
      orderingAccepted: ordering.accepted,
      orderingReason: ordering.reason,
    });
    if (resumeRetry) return null;

    await dependencies.markEventProcessed(event.id, event.type, attempt);
    return dependencies.orderEventJson(
      {
        received: true,
        staleIgnored: true,
        orderingReason: ordering.reason,
        currentEventId:
          "currentEventId" in ordering ? ordering.currentEventId : null,
        currentKind: "currentKind" in ordering ? ordering.currentKind : null,
      },
      { headers: dependencies.customerWebhookHeaders("stale-event-ignored") },
    );
  } catch {
    await dependencies.markRetryableFailure(
      event,
      "payment_event_ordering_failed",
      attempt,
    );
    return NextResponse.json(
      {
        received: false,
        retryable: true,
        error: "webhook_temporarily_unavailable",
      },
      { status: 503, headers: { "retry-after": "10" } },
    );
  }
}

export async function handleStripeWebhookRequest(
  req: Request,
  dependencies: StripeWebhookIngressDependencies = stripeWebhookIngressDependencies,
) {
  const paymentGuard = dependencies.validateBoundary(req);
  if (!paymentGuard.ok) return paymentGuard.response;

  const webhookSecret = dependencies.webhookSecret();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook temporarily unavailable." },
      { status: 503, headers: { "retry-after": "60" } },
    );
  }

  const signature = dependencies.getSignature(req);
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      {
        status: 400,
        headers: dependencies.customerWebhookHeaders("missing-signature-rejected"),
      },
    );
  }

  const boundedBody = await dependencies.readBodyBytes(req, 1_000_000);
  if (!boundedBody.ok) return boundedBody.response;

  const stripe = dependencies.getStripe();
  let event: Stripe.Event;
  try {
    event = dependencies.constructEvent(
      stripe,
      boundedBody.bytes,
      signature,
      webhookSecret,
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid Stripe webhook signature." },
      {
        status: 400,
        headers: dependencies.customerWebhookHeaders("invalid-signature-rejected"),
      },
    );
  }

  const runtimeVerdict = dependencies.validateRuntimeEvent({
    eventId: event.id,
    eventType: event.type,
    eventCreatedAt: event.created,
    eventLivemode: event.livemode,
    authority: dependencies.getRuntimeAuthority(),
  });
  if (!runtimeVerdict.ok) {
    return NextResponse.json(
      {
        received: false,
        retryable: runtimeVerdict.retryable,
        error: runtimeVerdict.error,
      },
      {
        status: runtimeVerdict.retryable ? 503 : 400,
        headers: {
          ...dependencies.customerWebhookHeaders("runtime-mode-rejected"),
          ...(runtimeVerdict.retryable ? { "retry-after": "60" } : {}),
        },
      },
    );
  }

  let claim: Awaited<ReturnType<typeof claimStripeWebhookEvent>>;
  try {
    claim = await dependencies.claimEvent({
      eventId: event.id,
      eventType: event.type,
      eventCreatedAt: event.created,
    });
  } catch {
    return NextResponse.json(
      {
        received: false,
        retryable: true,
        error: "webhook_temporarily_unavailable",
      },
      { status: 503, headers: { "retry-after": "10" } },
    );
  }

  if (!claim.claimed) return handleDuplicate(event, claim, dependencies);

  const orderingResponse = await applyOrdering(
    event,
    stripe,
    claim.attempt,
    dependencies,
  );
  if (orderingResponse) return orderingResponse;

  try {
    return await dependencies.dispatchEvent(
      {
        event,
        stripe,
        attempt: claim.attempt,
      },
    );
  } catch (error) {
    const errorCode =
      error instanceof Error
        ? error.message.slice(0, 160)
        : "webhook_processing_failed";
    if (isStripeWebhookTerminalEffectError(error)) {
      try {
        await dependencies.markTerminalFailure(event, errorCode, claim.attempt);
      } catch {
        return NextResponse.json(
          {
            received: false,
            retryable: true,
            error: "webhook_terminal_review_write_failed",
          },
          { status: 500, headers: { "retry-after": "10" } },
        );
      }
      return NextResponse.json(
        {
          received: false,
          retryable: false,
          reviewRequired: true,
          error: "webhook_effect_dead_lettered",
        },
        {
          status: 202,
          headers: dependencies.customerWebhookHeaders("dead-letter-review-required"),
        },
      );
    }
    try {
      await dependencies.markRetryableFailure(event, errorCode, claim.attempt);
    } catch {
      // Stripe will retry the original event.
    }
    return NextResponse.json(
      {
        received: false,
        retryable: true,
        error: "webhook_processing_retryable",
      },
      {
        status: 500,
        headers: {
          ...dependencies.customerWebhookHeaders("processing-retryable"),
          "retry-after": "10",
        },
      },
    );
  }
}
