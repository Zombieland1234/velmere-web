import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { paymentSubjectKeyFromEvent } from '../../lib/payments/stripe-webhook/shared';
import { resolveVlmPaidTerminalBindingFromEvent } from '../../lib/payments/stripe-webhook/vlm-terminal-binding';

// Static local fixtures and real SDK with controlled transport. No Stripe account.
const pi = 'pi_q8_identity';
const ch = 'ch_q8_identity';
const sessionId = 'cs_test_q8_identity';
const contextHash = 'ab'.repeat(32);
const metadata = { kind: 'vlm_paid_access', productId: 'vlm_pro_analysis_single', contextHash };
// Deliberately partial/malformed external-object fixtures; the cast is confined to tests.
function event(type: Stripe.Event.Type, object: Record<string, unknown>, live = false): Stripe.Event {
  return { id: 'evt_q8_identity', object: 'event', api_version: null, created: 1700000000,
    livemode: live, pending_webhooks: 1, request: null, type, data: { object } } as unknown as Stripe.Event;
}
function sdk(charge: unknown = { id: ch, object: 'charge', payment_intent: pi, livemode: false }, fail = false) {
  const calls: string[] = [];
  const stripe = new Stripe('sk_test_' + randomBytes(18).toString('hex'), {
    maxNetworkRetries: 0, httpClient: Stripe.createFetchHttpClient(async input => {
      const url = new URL(String(input)); calls.push(url.pathname);
      if (url.pathname.startsWith('/v1/charges/')) return new Response(JSON.stringify(fail ? {error:{message:'fixture_down'}} : charge), {status: fail ? 503 : 200});
      if (url.pathname === '/v1/payment_intents/' + pi) return new Response(JSON.stringify({id:pi, object:'payment_intent', metadata}));
      if (url.pathname === '/v1/checkout/sessions') return new Response(JSON.stringify({object:'list', has_more:false, data:[{
        id:sessionId, object:'checkout.session', payment_intent:pi, livemode:false, metadata,
      }]}));
      throw new Error('Unexpected isolated transport path');
    }),
  });
  return {stripe, calls};
}
const canonical = `stripe:payment_intent:${pi}`;
const directFixtures: [string, Stripe.Event.Type, Record<string, unknown>][] = [
  ['PaymentIntent itself', 'payment_intent.payment_failed', {id:pi, object:'payment_intent'}],
  ['paid Checkout', 'checkout.session.completed', {id:sessionId, object:'checkout.session', payment_intent:pi, payment_status:'paid'}],
  ['async Checkout success', 'checkout.session.async_payment_succeeded', {id:sessionId, object:'checkout.session', payment_intent:pi}],
  ['async Checkout failure', 'checkout.session.async_payment_failed', {id:sessionId, object:'checkout.session', payment_intent:pi}],
  ['expired Checkout with intent', 'checkout.session.expired', {id:sessionId, object:'checkout.session', payment_intent:pi}],
  ['refunded charge', 'charge.refunded', {id:ch, object:'charge', payment_intent:pi}],
  ['dispute direct intent', 'charge.dispute.created', {id:'du_q8_identity', object:'dispute', payment_intent:pi}],
  ['expanded intent', 'charge.refunded', {id:ch, object:'charge', payment_intent:{id:pi, object:'payment_intent', livemode:false}}],
];
for (const [label, type, object] of directFixtures) test(`Q8 canonical subject: ${label}`, async () => {
  const h=sdk(); assert.equal(await paymentSubjectKeyFromEvent(event(type,object),h.stripe), canonical); assert.equal(h.calls.length,0);
});
test('Q8 changing shared business metadata does not change the payment subject', async () => {
  const h=sdk(); const keys=[];
  for(const order of ['one','two']) keys.push(await paymentSubjectKeyFromEvent(event('payment_intent.payment_failed',{id:pi,object:'payment_intent',metadata:{orderDraftId:order,auditCaseRef:order}}),h.stripe));
  assert.deepEqual(keys,[canonical,canonical]);
});
test('Q8 dispute resolves its charge once, under the same payment subject',async()=>{
  const h=sdk(); assert.equal(await paymentSubjectKeyFromEvent(event('charge.dispute.created',{id:'du_q8_identity',object:'dispute',payment_intent:null,charge:ch}),h.stripe),canonical);assert.deepEqual(h.calls,['/v1/charges/'+ch]);
});
test('Q8 fully expanded charge does not need a second network lookup',async()=>{
  const h=sdk(undefined,true); assert.equal(await paymentSubjectKeyFromEvent(event('charge.dispute.created',{id:'du_q8_identity',object:'dispute',payment_intent:null,charge:{id:ch,object:'charge',payment_intent:pi,livemode:false}}),h.stripe),canonical);assert.equal(h.calls.length,0);
});
test('Q8 lookup failure is retryable failure, never a metadata subject',async()=>{
  const h=sdk(undefined,true); await assert.rejects(paymentSubjectKeyFromEvent(event('charge.dispute.created',{id:'du_q8_identity',object:'dispute',charge:ch,metadata:{orderDraftId:'same_order'}}),h.stripe));
});
for(const [label, change] of [
  ['wrong charge ID',{id:'ch_q8_other'}],['wrong object type',{object:'customer'}],['wrong mode',{livemode:true}],
  ['missing mode',{livemode:undefined}],['missing relationship',{payment_intent:undefined}],['malformed relationship',{payment_intent:'not_an_intent'}],
] as const) test(`Q8 refuses Charge lookup ${label}`,async()=>{
  const h=sdk(Object.assign({id:ch,object:'charge',livemode:false,payment_intent:pi},change));
  await assert.rejects(paymentSubjectKeyFromEvent(event('charge.dispute.created',{id:'du_q8_identity',object:'dispute',charge:ch}),h.stripe));
});
for(const [label,value] of [['whitespace',' '+pi],['invalid characters','pi_bad/path'],['wrong prefix','cs_bad'],['overlong','pi_'+ 'x'.repeat(200)],['empty',''],['non-string',3],['wrong expanded type',{id:pi,object:'charge'}],['expanded wrong mode',{id:pi,object:'payment_intent',livemode:true}]] as const) {
  test(`Q8 refuses malformed direct identity: ${label}`,async()=>{
    const h=sdk();await assert.rejects(paymentSubjectKeyFromEvent(event('charge.refunded',{id:ch,object:'charge',payment_intent:value}),h.stripe));assert.equal(h.calls.length,0);
  });
}
test('Q8 charge with explicit absent PaymentIntent has stable legacy charge key',async()=>{
  const h=sdk({id:ch,object:'charge',livemode:false,payment_intent:null});
  const refund=await paymentSubjectKeyFromEvent(event('charge.refunded',{id:ch,object:'charge',payment_intent:null}),h.stripe);
  const dispute=await paymentSubjectKeyFromEvent(event('charge.dispute.created',{id:'du_q8_identity',object:'dispute',payment_intent:null,charge:ch}),h.stripe);
  assert.equal(refund,`stripe:charge:${ch}`);assert.equal(dispute,refund);
});
test('Q8 uncreated intent on an expired Checkout remains scoped to its session',async()=>{
  const h=sdk();assert.equal(await paymentSubjectKeyFromEvent(event('checkout.session.expired',{id:sessionId,object:'checkout.session',payment_intent:null,metadata:{orderDraftId:'order'}}),h.stripe),`stripe:checkout_session:${sessionId}`);
});
test('Q8 paid Checkout without PaymentIntent is not accepted as an order fallback',async()=>{
  const h=sdk();await assert.rejects(paymentSubjectKeyFromEvent(event('checkout.session.completed',{id:sessionId,object:'checkout.session',payment_intent:null,payment_status:'paid',metadata:{orderDraftId:'order'}}),h.stripe));
});
test('Q8 conflicting expanded Charge and direct intent are refused before mutation',async()=>{
  const h=sdk();await assert.rejects(paymentSubjectKeyFromEvent(event('charge.dispute.created',{id:'du_q8_identity',object:'dispute',payment_intent:pi,charge:{id:ch,object:'charge',payment_intent:'pi_q8_other',livemode:false}}),h.stripe));
});
test('Q8 terminal resolver refuses the wrong Charge returned by transport',async()=>{
  const h=sdk({id:'ch_q8_other',object:'charge',payment_intent:pi,livemode:false});
  const r=await resolveVlmPaidTerminalBindingFromEvent(event('charge.dispute.created',{id:'du_q8_identity',object:'dispute',charge:ch,metadata}),h.stripe);
  assert.equal(r.ok,false);if(!r.ok)assert.equal(r.retryable,true);assert.deepEqual(h.calls,['/v1/charges/'+ch]);
});
test('Q8 terminal resolver accepts a verified Charge to PaymentIntent to Session chain',async()=>{
  const h=sdk();const r=await resolveVlmPaidTerminalBindingFromEvent(event('charge.dispute.created',{id:'du_q8_identity',object:'dispute',charge:ch,metadata}),h.stripe);
  assert.equal(r.ok,true);if(r.ok)assert.equal(r.binding.stripeSessionId,sessionId);
});
