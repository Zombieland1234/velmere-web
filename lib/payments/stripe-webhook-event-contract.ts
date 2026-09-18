import type { StripeWebhookClaimResult } from './stripe-webhook-state';

export type StripeWebhookEventIdentity = {
  eventId: string;
  eventType: string;
  eventCreatedAt: number;
};
export type StripeWebhookEventSettlement = {
  eventId: string;
  eventType: string;
  status: 'processed' | 'retryable_failed' | 'dead_letter';
  expectedAttempt: number;
  errorCode?: string;
};
const MAX_ATTEMPT = 2_147_483_647;
export function validateWebhookEventName(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,180}$/.test(value)) {
    throw new Error('stripe_webhook_invalid_identity');
  }
}
export function validateWebhookAttempt(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > MAX_ATTEMPT) {
    throw new Error('stripe_webhook_invalid_attempt');
  }
}
export function validateWebhookEvent(input: StripeWebhookEventIdentity): void {
  validateWebhookEventName(input.eventId);
  validateWebhookEventName(input.eventType);
  if (!Number.isSafeInteger(input.eventCreatedAt) || input.eventCreatedAt < 0 || input.eventCreatedAt > 253402300799) {
    throw new Error('stripe_webhook_invalid_created_at');
  }
}
export function validateWebhookSettlement(input: StripeWebhookEventSettlement): void {
  validateWebhookEventName(input.eventId);
  validateWebhookEventName(input.eventType);
  validateWebhookAttempt(input.expectedAttempt);
  if (!['processed', 'retryable_failed', 'dead_letter'].includes(input.status)) {
    throw new Error('stripe_webhook_invalid_status');
  }
}
export function webhookEventErrorCode(input: StripeWebhookEventSettlement): string | null {
  if (input.status === 'processed') return null;
  return typeof input.errorCode === 'string'
    ? input.errorCode.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 160) || 'webhook_processing_failed'
    : 'webhook_processing_failed';
}
function singleRow(data: unknown): Record<string, unknown> {
  const row = Array.isArray(data) && data.length === 1 ? data[0] : data;
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('stripe_webhook_invalid_response');
  }
  return row as Record<string, unknown>;
}
export function parseWebhookEventClaim(data: unknown, input: StripeWebhookEventIdentity): StripeWebhookClaimResult {
  const row = singleRow(data);
  validateWebhookAttempt(row.attempt_count);
  if (row.event_id !== input.eventId || row.event_type !== input.eventType || row.event_created_at !== input.eventCreatedAt
    || typeof row.claimed !== 'boolean' || typeof row.retry_after_seconds !== 'number'
    || !Number.isSafeInteger(row.retry_after_seconds) || row.retry_after_seconds < 0 || row.retry_after_seconds > 3600) {
    throw new Error('stripe_webhook_invalid_claim_response');
  }
  if (row.claimed) {
    if (row.status !== 'processing' || row.retry_after_seconds !== 0) throw new Error('stripe_webhook_invalid_claim_response');
    return { claimed: true, status: 'processing', attempt: row.attempt_count };
  }
  if (row.status === 'processing' && row.retry_after_seconds >= 1) {
    return { claimed: false, status: 'processing', attempt: row.attempt_count, retryAfterSeconds: row.retry_after_seconds };
  }
  if ((row.status === 'processed' || row.status === 'dead_letter') && row.retry_after_seconds === 0) {
    return { claimed: false, status: row.status, attempt: row.attempt_count };
  }
  throw new Error('stripe_webhook_invalid_claim_response');
}
export function assertWebhookEventSettlement(data: unknown, input: StripeWebhookEventSettlement): void {
  const row = singleRow(data);
  if (row.applied !== true || typeof row.idempotent !== 'boolean' || row.event_id !== input.eventId
    || row.event_type !== input.eventType || row.attempt_count !== input.expectedAttempt || row.status !== input.status) {
    throw new Error('stripe_webhook_stale_or_invalid_completion');
  }
}
