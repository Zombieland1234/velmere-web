/** Strict boundary for the existing effect-claim RPC. No guessed lease or status. */
export type EffectClaim<Receipt> =
  | { kind: 'claimed'; attempt: number; leaseToken: string }
  | { kind: 'completed'; attempt: number; receipt: Receipt }
  | { kind: 'busy'; attempt: number; retryAfterSeconds: number }
  | { kind: 'dead_letter'; attempt: number };

export function validateEffectAttempt(attempt: number): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt > 2_147_483_647) {
    throw new Error('stripe_webhook_effect_invalid_attempt');
  }
  return attempt;
}

export function validateEffectLease(token: string): string {
  if (typeof token !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token)) {
    throw new Error('stripe_webhook_effect_invalid_lease');
  }
  return token;
}

export function parseEffectClaim<Receipt>(data: unknown, requestedLeaseToken: string): EffectClaim<Receipt> {
  const invalid = () => new Error('stripe_webhook_effect_invalid_claim_result');
  if (Array.isArray(data) && data.length !== 1) throw invalid();
  const row: unknown = Array.isArray(data) ? data[0] : data;
  if (row === null || typeof row !== 'object' || Array.isArray(row)) throw invalid();
  const r = row as Record<string, unknown>;
  if (typeof r.claimed !== 'boolean' || typeof r.attempt_count !== 'number') throw invalid();
  const attempt = validateEffectAttempt(r.attempt_count);
  if (r.status === 'processing') {
    if (r.claimed === true) {
      if (r.lease_token !== requestedLeaseToken) throw invalid();
      return { kind: 'claimed', attempt, leaseToken: validateEffectLease(requestedLeaseToken) };
    }
    if (r.lease_token !== null || !Number.isSafeInteger(r.retry_after_seconds) ||
        (r.retry_after_seconds as number) < 1 || (r.retry_after_seconds as number) > 3_600) throw invalid();
    return { kind: 'busy', attempt, retryAfterSeconds: r.retry_after_seconds as number };
  }
  if (r.claimed !== false || r.lease_token !== null) throw invalid();
  if (r.status === 'dead_letter') return { kind: 'dead_letter', attempt };
  if (r.status !== 'completed' || !Object.hasOwn(r, 'result_json')) throw invalid();
  // Returned JSON is a receipt, not proof of a Stripe payment or external effect.
  const encoded = JSON.stringify(r.result_json);
  if (encoded === undefined || Buffer.byteLength(encoded, 'utf8') > 16_384) throw invalid();
  return { kind: 'completed', attempt, receipt: JSON.parse(encoded) as Receipt };
}
