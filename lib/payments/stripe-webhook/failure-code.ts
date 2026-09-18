const SAFE_STRIPE_WEBHOOK_FAILURE_CODE = /^[a-z][a-z0-9_]{2,79}$/;

export function stripeWebhookFailureCode(error: unknown) {
  const candidate = error instanceof Error ? error.message.trim().toLowerCase() : "";
  return SAFE_STRIPE_WEBHOOK_FAILURE_CODE.test(candidate)
    ? candidate
    : "webhook_processing_failed";
}
