import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { randomBytes } from 'node:crypto';
import { resolveVlmPaidTerminalBindingFromEvent } from '../../lib/payments/stripe-webhook/vlm-terminal-binding';

// Real Stripe SDK decoding with a fully controlled transport. This does not use
// any Stripe account, publish an endpoint, or create/refund a payment.
const contextHash = 'ab'.repeat(32);
const metadata = {kind:'vlm_paid_access', productId:'vlm_pro_audit_review', contextHash};
const pi = 'pi_q2_isolated';
function session(id: string, change: Record<string,unknown> = {}) {
  return {id,object:'checkout.session',metadata,payment_intent:pi,livemode:false,...change};
}
function event(change: Record<string,unknown> = {}): Stripe.Event {
  return {id:'evt_q2_refund',object:'event',api_version:null,created:1,livemode:false,pending_webhooks:1,request:null,
    type:'charge.refunded',data:{object:{id:'ch_q2_isolated',object:'charge',payment_intent:pi,metadata:{},...change}}} as Stripe.Event;
}
function sdk(pages: unknown[], paymentMetadata: Record<string,string> = {}) {
  const calls: string[]=[];let page=0;
  const stripe=new Stripe('sk_test_'+randomBytes(18).toString('hex'),{
    maxNetworkRetries:0,
    httpClient:Stripe.createFetchHttpClient(async(input)=>{
      const url=new URL(String(input)); calls.push(url.pathname+url.search);
      if(url.pathname==='/v1/payment_intents/'+pi) return new Response(JSON.stringify({id:pi,object:'payment_intent',metadata:paymentMetadata}),{status:200});
      if(url.pathname==='/v1/checkout/sessions') {
        const data=pages[page++];
        if(data===undefined) return new Response(JSON.stringify({error:{message:'isolated unavailable'}}),{status:503});
        return new Response(JSON.stringify(data),{status:200});
      }
      throw new Error('Unexpected transport operation in isolated fixture');
    }),
  });
  return {stripe,calls};
}
const page=(data:unknown[],has_more=false)=>({object:'list',data,has_more,url:'/v1/checkout/sessions'});
test('Q2 terminal binding retains a unique complete session',async()=>{
 const h=sdk([page([session('cs_test_q2_a')])]);const r=await resolveVlmPaidTerminalBindingFromEvent(event(),h.stripe);
 assert.equal(r.ok,true);if(r.ok)assert.equal(r.binding.stripeSessionId,'cs_test_q2_a');
});
test('Q2 terminal binding finds paid scope on a later page',async()=>{
 const h=sdk([page([session('cs_test_q2_other',{metadata:{}})],true),page([session('cs_test_q2_a')])]);
 const r=await resolveVlmPaidTerminalBindingFromEvent(event(),h.stripe);assert.equal(r.ok,true);
 assert.ok(h.calls.some(c=>c.includes('starting_after=cs_test_q2_other')));
});
test('Q2 terminal binding never declares uniqueness from a partial list',async()=>{
 const h=sdk([page([session('cs_test_q2_a')],true),page([session('cs_test_q2_b')])]);
 const r=await resolveVlmPaidTerminalBindingFromEvent(event(),h.stripe);assert.equal(r.ok,false);if(!r.ok)assert.equal(r.retryable,true);
});
test('Q2 terminal binding retries if a later page is unavailable',async()=>{
 const h=sdk([page([session('cs_test_q2_a')],true)]);
 const r=await resolveVlmPaidTerminalBindingFromEvent(event(),h.stripe);assert.equal(r.ok,false);if(!r.ok)assert.equal(r.retryable,true);
});
test('Q2 terminal binding rejects a metadata session hint for another session',async()=>{
 const h=sdk([page([session('cs_test_q2_a')])]);
 const r=await resolveVlmPaidTerminalBindingFromEvent(event({metadata:{...metadata,stripeSessionId:'cs_test_q2_other'}}),h.stripe);
 assert.equal(r.ok,false);if(!r.ok)assert.equal(r.retryable,true);
});
test('Q2 terminal binding accepts a hint only after checking the session',async()=>{
 const h=sdk([page([session('cs_test_q2_a')])]);
 const r=await resolveVlmPaidTerminalBindingFromEvent(event({metadata:{...metadata,stripeSessionId:'cs_test_q2_a'}}),h.stripe);
 assert.equal(r.ok,true);assert.ok(h.calls.some(c=>c.startsWith('/v1/checkout/sessions')));
});
for (const [label, change] of [['payment intent',{payment_intent:'pi_q2_other'}],['payment mode',{livemode:true}]] as const) {
 test(`Q2 terminal binding rejects contradictory ${label}`,async()=>{
  const h=sdk([page([session('cs_test_q2_a',change)])]);
  const r=await resolveVlmPaidTerminalBindingFromEvent(event(),h.stripe);assert.equal(r.ok,false);if(!r.ok)assert.equal(r.retryable,true);
 });
}
test('Q2 terminal binding complete non-VLM list is not misclassified',async()=>{
 const h=sdk([page([session('cs_test_q2_a',{metadata:{}})])]);const r=await resolveVlmPaidTerminalBindingFromEvent(event(),h.stripe);
 assert.equal(r.ok,false);if(!r.ok)assert.equal(r.notVlmPaidAccess,true);
});
test('Q2 terminal binding refuses missing pagination metadata',async()=>{
 const h=sdk([{data:[]}]);const r=await resolveVlmPaidTerminalBindingFromEvent(event(),h.stripe);
 assert.equal(r.ok,false);if(!r.ok)assert.equal(r.retryable,true);
});
test('Q2 terminal binding bounds pagination without classifying unseen sessions',async()=>{
 const h=sdk(Array.from({length:5},(_,i)=>page([session(`cs_test_q2_${i}`,{metadata:{}})],true)));
 const r=await resolveVlmPaidTerminalBindingFromEvent(event(),h.stripe);
 assert.equal(r.ok,false);if(!r.ok)assert.equal(r.retryable,true);assert.ok(h.calls.length<=6);
});
test('Q2 terminal binding refuses a repeated pagination cursor',async()=>{
 const h=sdk([page([session('cs_test_q2_same',{metadata:{}})],true),page([session('cs_test_q2_same',{metadata:{}})],true)]);
 const r=await resolveVlmPaidTerminalBindingFromEvent(event(),h.stripe);assert.equal(r.ok,false);if(!r.ok)assert.equal(r.retryable,true);
});
test('Q2 terminal binding does not truncate an overlong session hint',async()=>{
 const h=sdk([page([session('cs_test_q2_a')])]);const r=await resolveVlmPaidTerminalBindingFromEvent(event({metadata:{...metadata,stripeSessionId:'cs_'+ 'x'.repeat(200)}}),h.stripe);
 assert.equal(r.ok,false);
});
test('Q2 terminal binding never treats the session hint as a payment relationship',async()=>{
 const h=sdk([]);const r=await resolveVlmPaidTerminalBindingFromEvent(event({payment_intent:null,metadata:{...metadata,stripeSessionId:'cs_test_q2_a'}}),h.stripe);
 assert.equal(r.ok,false);if(!r.ok)assert.equal(r.retryable,true);
});
