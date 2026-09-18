import type { StripeWebhookClaimResult } from './stripe-webhook-state';

export type StripeWebhookEventIdentity = { eventId: string; eventType: string; eventCreatedAt: number };
export type StripeWebhookEventSettlement = {
  eventId: string; eventType: string; expectedAttempt: number;
  status: 'processed' | 'retryable_failed' | 'dead_letter'; errorCode?: string;
};
const name = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9._:-]{1,180}$/.test(x);
const attempt = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 1 && (x as number) <= 2147483647;
function record(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) {
    if (data.length !== 1) throw new Error('stripe_webhook_invalid_receipt');
    data = data[0];
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('stripe_webhook_invalid_receipt');
  return data as Record<string, unknown>;
}
export function assertStripeWebhookEventIdentity(input: StripeWebhookEventIdentity): void {
  if (!name(input.eventId) || !name(input.eventType) || !Number.isSafeInteger(input.eventCreatedAt) ||
      input.eventCreatedAt < 0 || input.eventCreatedAt > 253402300799) throw new Error('stripe_webhook_invalid_identity');
}
export function assertStripeWebhookEventSettlement(input: StripeWebhookEventSettlement): void {
  if (!name(input.eventId) || !name(input.eventType) || !attempt(input.expectedAttempt) ||
      !['processed','retryable_failed','dead_letter'].includes(input.status) ||
      (input.errorCode !== undefined && !/^[a-zA-Z0-9:_-]{1,160}$/.test(input.errorCode)) ||
      (input.status === 'processed' && input.errorCode !== undefined) ||
      (input.status !== 'processed' && input.errorCode === undefined)) throw new Error('stripe_webhook_invalid_settlement');
}
/** Fail closed on ambiguous replies. No string/boolean/numeric coercions or invented attempts. */
export function parseStripeWebhookEventClaim(data: unknown, input: StripeWebhookEventIdentity): StripeWebhookClaimResult {
  assertStripeWebhookEventIdentity(input);
  const r = record(data);
  if (r.event_id !== input.eventId || r.event_type !== input.eventType || r.event_created_at !== input.eventCreatedAt ||
      typeof r.claimed !== 'boolean' || !attempt(r.attempt_count) ||
      !Number.isInteger(r.retry_after_seconds) || (r.retry_after_seconds as number) < 0 ||
      (r.retry_after_seconds as number) > 3600) throw new Error('stripe_webhook_invalid_claim');
  if (r.claimed === true && r.status === 'processing' && r.retry_after_seconds === 0)
    return { claimed: true, status: 'processing', attempt: r.attempt_count };
  if (r.claimed === false && r.status === 'processing' && (r.retry_after_seconds as number) > 0)
    return { claimed: false, status: 'processing', attempt: r.attempt_count, retryAfterSeconds: r.retry_after_seconds as number };
  if (r.claimed === false && (r.status === 'processed' || r.status === 'dead_letter') && r.retry_after_seconds === 0)
    return { claimed: false, status: r.status, attempt: r.attempt_count };
  throw new Error('stripe_webhook_invalid_claim');
}
export function assertStripeWebhookEventReceipt(data: unknown, input: StripeWebhookEventSettlement): void {
  assertStripeWebhookEventSettlement(input);
  const r = record(data);
  if (r.ok !== true || r.event_id !== input.eventId || r.event_type !== input.eventType ||
      r.attempt_count !== input.expectedAttempt || r.status !== input.status)
    throw new Error('stripe_webhook_stale_completion');
}
