import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { handleStripeWebhookRequest, stripeWebhookIngressDependencies } from '../../lib/payments/stripe-webhook/ingress';
import { dispatchStripeWebhookEvent, stripeWebhookDispatcherDependencies } from '../../lib/payments/stripe-webhook/dispatcher';
import { terminalEventDependencies } from '../../lib/payments/stripe-webhook/handlers/terminal-events';
import { applyVlmPaidEntitlementLifecycleEvent } from '../../lib/commerce/vlm-entitlement-lifecycle';
import type { VlmPaidEntitlementRecord } from '../../lib/commerce/vlm-entitlement-ledger';
import { runStripeWebhookEffect } from '../../lib/payments/stripe-webhook-effect-ledger';
import { buildPaymentEventWatermark } from '../../lib/payments/stripe-webhook-state';
import type { runRegisteredServiceRoleRpc } from '../../lib/db/supabase-rpc-operation-registry';

// Actual ingress -> dispatcher -> terminal handler -> lifecycle parser. HMAC is
// verified by Stripe's SDK. Database/effect storage and Stripe API transport are
// controlled adapters: not a real checkout, JWT login, refund, or durable write.
const original={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
process.env.SUPABASE_URL='https://q2-fixture.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');
after(()=>{
 for(const [k,v] of [['SUPABASE_URL',original.url],['SUPABASE_SERVICE_ROLE_KEY',original.key]]) {
  if(v===undefined) delete process.env[k!];else process.env[k!]=v;
 }
});
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const secret=randomBytes(24).toString('hex');
const ent: VlmPaidEntitlementRecord={id:'ent_q2_alpha',stripeSessionId:'cs_test_q2_alpha',productId:'vlm_pro_audit_review',
 accessScope:'audit',status:'active',contextHash:'ac'.repeat(32),context:{surface:'audit',locale:'en',accountIdHash:'ad'.repeat(32)},locale:'en',
 amountTotal:1000,currency:'eur',source:'stripe_webhook',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',expiresAt:'2030-01-01T00:00:00.000Z'};
async function exercise(change: Record<string,unknown>={}, eventType:'charge.refunded'|'charge.dispute.created'='charge.refunded', mode:'normal'|'tampered'|'live'='normal') {
 const seen:string[]=[];
 const metadata={kind:'vlm_paid_access',productId:ent.productId,contextHash:ent.contextHash};
 const stripe=new Stripe('sk_test_'+randomBytes(18).toString('hex'),{maxNetworkRetries:0,httpClient:Stripe.createFetchHttpClient(async(input)=>{
  const u=new URL(String(input));
  if(u.pathname==='/v1/payment_intents/pi_q2_alpha')return new Response(JSON.stringify({id:'pi_q2_alpha',object:'payment_intent',metadata}));
  if(u.pathname==='/v1/checkout/sessions')return new Response(JSON.stringify({object:'list',has_more:false,data:[{id:ent.stripeSessionId,object:'checkout.session',payment_intent:'pi_q2_alpha',livemode:false,metadata}]}));
  throw new Error('Unplanned external operation');
 })});
 const id='evt_q2_bound_refund';
 const payload=JSON.stringify({id,object:'event',type:eventType,created:Math.floor(Date.now()/1000),livemode:mode==='live',data:{object:{
  id:'ch_q2_alpha',object:eventType==='charge.refunded'?'charge':'dispute',payment_intent:'pi_q2_alpha',metadata:{},amount:1000,amount_refunded:1000,refunded:true,currency:'eur',
 }}});
 let signature=stripe.webhooks.generateTestHeaderString({payload,secret});if(mode==='tampered')signature=signature.replace(/v1=./,'v1=x');
 const req=new Request('http://localhost:3000/api/stripe/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature},body:payload});
 const terminal={...terminalEventDependencies,
  commercePaymentMetadataFromEvent:async()=>null,
  auditPaymentMetadataFromEvent:async()=>null,
  findVlmPaidEntitlementByStripeBinding:async()=>({ok:true as const,entitlement:ent,ledgerMode:'durable' as const}),
  applyVlmPaidEntitlementLifecycleEvent:async(args:Parameters<typeof applyVlmPaidEntitlementLifecycleEvent>[0])=>{
   const rpc:typeof runRegisteredServiceRoleRpc=async()=>{seen.push('rpc');return {data:{ok:true,idempotent:false,event_type:args.event,
    previous_status:'active',next_status:args.event==='refund'?'refunded':'revoked',entitlement_id_hash:sha(args.entitlementId),event_id_hash:sha(args.eventId),...change},receipt:{ schemaVersion: 'velmere.bounded-rpc-receipt.v1' as const, operation: 'vlm_paid_entitlement_lifecycle_apply', capability: 'service_role_write' as const, durationMs: 0, deadlineMs: 5000, aborted: false, durableBoundary: 'service_role' as const }};};
   return applyVlmPaidEntitlementLifecycleEvent({...args,dependencies:{rpc}});
  },
  runStripeWebhookEffect:async<T>(input:{eventId:string;eventType:string;effectKey:string;execute:()=>Promise<T>})=>runStripeWebhookEffect(input,{
   claim:async()=>{seen.push('effect-claim');return {kind:'claimed' as const,attempt:1,leaseToken:'q2-isolated-lease'};},
   complete:async()=>{seen.push('effect-complete');},
   fail:async()=>{seen.push('effect-failed');},
   deadLetter:async()=>{seen.push('effect-dead-letter');},
  }),
  markStripeWebhookEventProcessed:async()=>{seen.push('processed');},
  markWebhookRetryableFailure:async()=>{seen.push('retry');},
  orderEventJson:async(body:unknown,init?:ResponseInit)=>NextResponse.json(body,init),
 };
 const deps={...stripeWebhookIngressDependencies,webhookSecret:()=>secret,getStripe:()=>stripe,
  getRuntimeAuthority:()=>({credentialMode:'test' as const,requestedMode:'test' as const,modeMatches:true,testPaymentsAllowed:true,livePaymentsAllowed:false,blockers:[]}),
  claimEvent:async()=>{seen.push('claim');return {claimed:true as const,status:'processing' as const,attempt:1};},
  paymentSubjectKeyFromEvent:async()=> 'stripe:payment_intent:pi_q2_alpha',
  applyPaymentEventWatermark:async()=>({accepted:true,reason:'first_event' as const,next:buildPaymentEventWatermark({subjectKey:'stripe:payment_intent:pi_q2_alpha',eventId:id,eventCreatedAt:1,kind:'refund'})}),
  dispatchEvent:async(context:Parameters<typeof dispatchStripeWebhookEvent>[0])=>dispatchStripeWebhookEvent(context,{...stripeWebhookDispatcherDependencies,terminal}),
  markRetryableFailure:async()=>{seen.push('retry-ingress');},
 };
 const response=await handleStripeWebhookRequest(req,deps);
 return {status:response.status,body:await response.json(),seen};
}
for(const [label,change] of [
 ['wrong account entitlement',{entitlement_id_hash:sha('ent_q2_beta')}],['different event',{event_id_hash:sha('evt_q2_old')}],
 ['wrong next status',{next_status:'active'}],['missing success',{ok:undefined}],['unknown state',{previous_status:'invented'}],
] as const) {
 test(`Q2 signed refund with ${label} is retryable, not acknowledged`,async()=>{
  const r=await exercise(change);assert.equal(r.status,500);assert.equal(r.body.received,false);assert.equal(r.body.retryable,true);
  assert.deepEqual(r.seen,['claim','effect-claim','rpc','effect-failed','retry']);
 });
}
for(const type of ['charge.refunded','charge.dispute.created'] as const) {
 test(`Q2 bound ${type} completes only after validated lifecycle receipt`,async()=>{
  const r=await exercise({},type);assert.equal(r.status,200);assert.equal(r.body.received,true);assert.deepEqual(r.seen,['claim','effect-claim','rpc','effect-complete','processed']);
 });
}
test('Q2 replayed bound receipt is accepted without requiring equal old/new state',async()=>{
 const r=await exercise({idempotent:true});assert.equal(r.status,200);assert.equal(r.body.received,true);
});
for(const mode of ['tampered','live'] as const) {
 test(`Q2 ${mode} request never reaches payment state`,async()=>{
  const r=await exercise({},'charge.refunded',mode);assert.equal(r.status,400);assert.deepEqual(r.seen,[]);
 });
}
