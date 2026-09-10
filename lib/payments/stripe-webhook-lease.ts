import type { StripeWebhookProcessingStatus } from "./stripe-webhook-state";

export const PASS4684_STRIPE_WEBHOOK_LEASE_ID =
  "pass4684-stripe-webhook-attempt-lease-and-retry-resume" as const;

export type StripeWebhookLeaseSnapshot = {
  status: StripeWebhookProcessingStatus;
  attemptCount: number;
} | null;

export function assertStripeWebhookCompletionLease(
  current: StripeWebhookLeaseSnapshot,
  expectedAttempt: number,
): asserts current is { status: "processing"; attemptCount: number } {
  const normalizedAttempt = Math.max(1, Math.floor(expectedAttempt));
  if (
    !current ||
    current.status !== "processing" ||
    current.attemptCount !== normalizedAttempt
  ) {
    throw new Error("stripe_webhook_stale_completion");
  }
  return;
}

export function shouldResumeClaimedWebhookAfterWatermark(input: {
  claimed: boolean;
  attempt: number;
  orderingAccepted: boolean;
  orderingReason: string;
}) {
  return (
    input.claimed &&
    input.attempt > 1 &&
    !input.orderingAccepted &&
    input.orderingReason === "duplicate_event"
  );
}
