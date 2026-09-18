import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { buildPaymentEventWatermark } from '../../lib/payments/stripe-webhook-state';
import { handleStripeWebhookRequest, stripeWebhookIngressDependencies, type StripeWebhookIngressDependencies } from '../../lib/payments/stripe-webhook/ingress';

// SDK signing is real. All downstream persistence/dispatch is a controlled adapter;
// these tests are NOT hosted Stripe TEST lifecycle or an actual payment.
const stripe = new Stripe('sk_test_c8_noncredential_fixture');
const secret = 'whsec_c8_noncredential_fixture';
const now = () => Math.floor(Date.now() / 1000);
const event = (change: Record<string, unknown> = {}) => ({ id: 'evt_c8_fixture_001', object: 'event', type: 'checkout.session.completed', created: now(), livemode: false,
  data: { object: { id: 'cs_test_c8_fixture', object: 'checkout.session', payment_status: 'paid', metadata: {} } }, ...change });
function request(payload: unknown, signatureChange?: (signature: string) => string, timestamp = now()) {
  const body = JSON.stringify(payload);
  let signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret, timestamp });
  if (signatureChange) signature = signatureChange(signature);
  return new Request('http://localhost:3000/api/stripe/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body });
}
function harness(overrides: Partial<StripeWebhookIngressDependencies> = {}) {
  const seen: string[] = [];
  const deps: StripeWebhookIngressDependencies = {
    ...stripeWebhookIngressDependencies,
    webhookSecret: () => secret, getStripe: () => stripe,
    getRuntimeAuthority: () => ({ credentialMode: 'test', requestedMode: 'test', modeMatches: true, testPaymentsAllowed: true, livePaymentsAllowed: false, blockers: [] }),
    claimEvent: async () => { seen.push('claim'); return { claimed: true, status: 'processing', attempt: 1 }; },
    paymentSubjectKeyFromEvent: async () => 'pi_c8_fixture',
    applyPaymentEventWatermark: async input => { seen.push('ordering'); return { accepted: true, reason: 'first_event', next: buildPaymentEventWatermark(input) }; },
    markEventProcessed: async () => { seen.push('processed'); },
    markRetryableFailure: async () => { seen.push('retry'); },
    markTerminalFailure: async () => { seen.push('terminal'); },
    dispatchEvent: async () => { seen.push('dispatch'); return NextResponse.json({ received: true }, { headers: { 'cache-control': 'no-store' } }); },
    orderEventJson: async (body, init) => NextResponse.json(body, init),
    ...overrides,
  };
  return { deps, seen };
}
test('real Stripe SDK accepts exact valid signed bytes before dispatch', async () => {
  const h = harness(); const r = await handleStripeWebhookRequest(request(event()), h.deps);
  assert.equal(r.status, 200); assert.deepEqual(h.seen, ['claim', 'ordering', 'dispatch']);
});
test('tampered HMAC never claims an event', async () => {
  const h = harness(); const r = await handleStripeWebhookRequest(request(event(), s => s.replace(/v1=./, 'v1=x')), h.deps);
  assert.equal(r.status, 400); assert.deepEqual(h.seen, []);
});
test('expired Stripe signature never claims an event', async () => {
  const h = harness(); const r = await handleStripeWebhookRequest(request(event(), undefined, now() - 600), h.deps);
  assert.equal(r.status, 400); assert.deepEqual(h.seen, []);
});
test('valid signature from a different secret never claims an event', async () => {
  const h = harness({ webhookSecret: () => 'whsec_other_noncredential_fixture' });
  assert.equal((await handleStripeWebhookRequest(request(event()), h.deps)).status, 400); assert.deepEqual(h.seen, []);
});
test('signed malformed data envelope is rejected before durable state changes', async () => {
  for (const payload of [null, [], event({ data: null }), event({ data: { object: null } }), event({ data: { object: [] } })]) {
    const h = harness(); const r = await handleStripeWebhookRequest(request(payload), h.deps);
    assert.equal(r.status, 400); assert.deepEqual(h.seen, []);
  }
});
test('LIVE signed event cannot be processed under TEST authority', async () => {
  const h = harness(); const r = await handleStripeWebhookRequest(request(event({ livemode: true })), h.deps);
  assert.equal(r.status, 400); assert.equal((await r.json()).error, 'stripe_event_runtime_mode_mismatch'); assert.deepEqual(h.seen, []);
});
test('closed TEST authority remains retryable without granting anything', async () => {
  const h = harness({ getRuntimeAuthority: () => ({ credentialMode: 'test', requestedMode: 'test', modeMatches: true, testPaymentsAllowed: false, livePaymentsAllowed: false, blockers: ['fixture closed'] }) });
  const r = await handleStripeWebhookRequest(request(event()), h.deps); assert.equal(r.status, 503); assert.deepEqual(h.seen, []);
});
test('Stripe initialization failure becomes structured non-leaking 503', async () => {
  const h = harness({ getStripe: () => { throw new Error('INTERNAL_DO_NOT_EXPOSE'); } });
  const r = await handleStripeWebhookRequest(request(event()), h.deps);
  assert.equal(r.status, 503); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(r.headers.get('retry-after'), '10');
  assert.doesNotMatch(await r.text(), /INTERNAL_DO_NOT_EXPOSE/); assert.deepEqual(h.seen, []);
});
test('claim database failure is retryable and never dispatches', async () => {
  const h = harness({ claimEvent: async () => { throw new Error('DB_UNAVAILABLE'); } });
  const r = await handleStripeWebhookRequest(request(event()), h.deps); assert.equal(r.status, 503); assert.deepEqual(h.seen, []);
});
test('duplicate-processing event asks for retry rather than repeating effects', async () => {
  const h = harness({ claimEvent: async () => ({ claimed: false, status: 'processing', attempt: 1, retryAfterSeconds: 7 }) });
  const r = await handleStripeWebhookRequest(request(event()), h.deps);
  assert.equal(r.status, 409); assert.equal(r.headers.get('retry-after'), '7'); assert.deepEqual(h.seen, []);
});
test('duplicate-processed event acknowledges without redispatch', async () => {
  const h = harness({ claimEvent: async () => ({ claimed: false, status: 'processed', attempt: 1 }) });
  const r = await handleStripeWebhookRequest(request(event()), h.deps); assert.equal(r.status, 200); assert.equal((await r.json()).duplicate, true); assert.deepEqual(h.seen, []);
});
test('duplicate response flush failure cannot escape as an uncaught exception', async () => {
  const h = harness({ claimEvent: async () => ({ claimed: false, status: 'processed', attempt: 1 }), orderEventJson: async () => { throw new Error('FLUSH_FAILED'); } });
  const r = await handleStripeWebhookRequest(request(event()), h.deps); assert.equal(r.status, 503); assert.deepEqual(h.seen, []);
});
test('ordering and retry-marker simultaneous failures remain retryable', async () => {
  const h = harness({ applyPaymentEventWatermark: async () => { throw new Error('WATERMARK_DOWN'); }, markRetryableFailure: async () => { throw new Error('MARKER_DOWN'); } });
  const r = await handleStripeWebhookRequest(request(event()), h.deps); assert.equal(r.status, 503); assert.deepEqual(h.seen, ['claim']);
});
test('older event is acknowledged without restoring superseded entitlements', async () => {
  const h = harness({ applyPaymentEventWatermark: async input => ({ accepted: false, reason: 'terminal_state_dominates', next: buildPaymentEventWatermark({ ...input, eventId: 'evt_newer', kind: 'refund' }), currentEventId: 'evt_newer', currentKind: 'refund' }) });
  const r = await handleStripeWebhookRequest(request(event()), h.deps); assert.equal(r.status, 200); assert.equal((await r.json()).staleIgnored, true); assert.deepEqual(h.seen, ['claim', 'processed']);
});
test('dispatch failure is non-success and schedules retry', async () => {
  const h = harness({ dispatchEvent: async () => { throw new Error('DISPATCH_FAILED'); } });
  const r = await handleStripeWebhookRequest(request(event()), h.deps); assert.equal(r.status, 500); assert.equal((await r.json()).retryable, true); assert.deepEqual(h.seen, ['claim', 'ordering', 'retry']);
});
test('missing signature fails before reading a never-ending body', async () => {
  const h = harness(); const request = new Request('http://localhost:3000/api/stripe/webhook', { method: 'POST', headers: { 'content-type': 'application/json' } });
  const r = await handleStripeWebhookRequest(request, h.deps); assert.equal(r.status, 400); assert.deepEqual(h.seen, []);
});
