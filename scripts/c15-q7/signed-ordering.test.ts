import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { PGlite } from '@electric-sql/pglite';
import { handleStripeWebhookRequest, stripeWebhookIngressDependencies } from '../../lib/payments/stripe-webhook/ingress';

// Joined application path: authentic SDK HMAC verification, actual ingress,
// dispatcher, terminal binding, Supabase client, Q6 inbox, Q5 effects, Q4 SQL and Q7 ordering.
// Only transports are controlled; the actual Q7 SQL ordering is used. No real payment, GoTrue login,
// PostgREST service or HTTP socket is claimed. Grants below are fixture setup.
const db=new PGlite();const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const originalFetch=globalThis.fetch;
const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
const secret=randomBytes(32).toString('hex');
const calls:string[]=[];let fault:string|null=null;const ambiguousClaim=false;let corruptOrdering=false;
const rpcNames=new Set(['velmere_claim_stripe_webhook_event','velmere_complete_stripe_webhook_event',
 'velmere_claim_stripe_webhook_effect','velmere_complete_stripe_webhook_effect',
 'velmere_fail_stripe_webhook_effect','velmere_dead_letter_stripe_webhook_effect',
 'velmere_apply_vlm_paid_entitlement_lifecycle_event','velmere_apply_payment_event_watermark']);
before(async()=>{
 process.env.SUPABASE_URL='https://q6-joined-transport.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');
 await db.exec(readFileSync(new URL('../c15-q4/bootstrap-roles.sql',import.meta.url),'utf8'));
 for(const [ack,file] of [['entitlement','../c15-q4/entitlement-store.sql'],['effect','../c15-q5/effect-store.sql'],['event','../c15-q6/event-store.sql'],['watermark','./watermark-store.sql']]){
  await db.exec(`SET velmere.disposable_${ack}_store='ISOLATED_TEST_ONLY'`);await db.exec(readFileSync(new URL(file,import.meta.url),'utf8'));
 }
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.origin,'https://q6-joined-transport.invalid');
  const fn=url.pathname.split('/').at(-1)!;calls.push(fn);
  if(fault===fn){fault=null;return new Response(JSON.stringify({code:'XX000',message:'controlled_failure'}),{status:500,headers:{'content-type':'application/json'}});}
  await db.exec('SET ROLE service_role');
  try {
   if(url.pathname.startsWith('/rest/v1/rpc/')){
    assert.ok(rpcNames.has(fn));const args=JSON.parse(String(init?.body)) as Record<string,unknown>;
    assert.ok(Object.keys(args).every(k=>/^p_[a-z_]+$/.test(k)));
    const row=(await db.query<{data:unknown}>(`SELECT public.${fn}(${Object.keys(args).map((k,i)=>`${k} => $${i+1}`).join(',')}) AS data`,Object.values(args))).rows[0];
    if(corruptOrdering && fn==='velmere_apply_payment_event_watermark'){row.data={...(row.data as object),accepted:'false'};}
    const data=ambiguousClaim && fn==='velmere_claim_stripe_webhook_event'?[row.data,row.data]:row.data;
    return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
   }
   assert.equal(fn,'velmere_vlm_paid_entitlements');
   // Exact fixed lookup used by the real entitlement repository, no general SQL endpoint.
   const keys=['stripe_session_id','product_id','context_hash'];
   const values=keys.map(k=>{const v=url.searchParams.get(k);if (!v || !v.startsWith('eq.')) throw new Error('Unexpected filter');return v.slice(3);});
   const rows=(await db.query('SELECT * FROM public.velmere_vlm_paid_entitlements WHERE stripe_session_id=$1 AND product_id=$2 AND context_hash=$3',values)).rows;
   return new Response(JSON.stringify(rows),{headers:{'content-type':'application/json'}});
  }catch(e){return new Response(JSON.stringify({code:'P0001',message:e instanceof Error?e.message:'fixture_error'}),{status:400,headers:{'content-type':'application/json'}});}
  finally{await db.exec('RESET ROLE');}
 };
});
after(async()=>{globalThis.fetch=originalFetch;await db.close();for(const [k,v] of [['SUPABASE_URL',saved.url],['SUPABASE_SERVICE_ROLE_KEY',saved.key]] as const){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
function session(subject:string){return {id:`cs_test_${subject}`,object:'checkout.session',payment_intent:`pi_${subject}`,livemode:false,
 metadata:{kind:'vlm_paid_access',productId:'vlm_pro_analysis_single',contextHash:hash(subject)}};}
async function grant(subject:string){
 const args={p_id:subject,p_stripe_session_id:session(subject).id,p_stripe_customer_id:null,p_product_id:'vlm_pro_analysis_single',p_access_scope:'vlm_pro_analysis',
 p_context_hash:hash(subject),p_context:{surface:'shield',locale:'en',depth:'pro',accountIdHash:hash('owner:'+subject)},p_locale:'en',p_amount_total:1000,p_currency:'EUR',p_customer_email:null,p_customer_name:null,p_payment_status:'paid',p_source:'stripe_webhook',p_audit_queue_id:null,p_expires_at:'2099-01-01T00:00:00Z',p_created_at:'2026-01-01T00:00:00Z'};
 const x=(await db.query<{data:{ok:boolean}}>(`SELECT public.velmere_create_or_read_vlm_paid_entitlement(${Object.keys(args).map((k,i)=>`${k} => $${i+1}`).join(',')}) AS data`,Object.values(args))).rows[0].data;assert.equal(x.ok,true);
}
const status=async(subject:string)=>(await db.query<{status:string}>('SELECT status FROM public.velmere_vlm_paid_entitlements WHERE id=$1',[subject])).rows[0].status;
const count=async(subject:string)=>Number((await db.query<{n:number}>('SELECT count(*)::int AS n FROM velmere_billing_private.lifecycle_events WHERE entitlement_id=$1',[subject])).rows[0].n);
async function deliver(subject:string,eventId:string,options:{type?:'charge.refunded'|'charge.dispute.created'|'checkout.session.completed';tamper?:boolean;live?:boolean;created?:number}={}){
 const type=options.type??'charge.refunded';
 const stripe=new Stripe('sk_test_'+randomBytes(18).toString('hex'),{maxNetworkRetries:0,httpClient:Stripe.createFetchHttpClient(async(input)=>{
  const u=new URL(String(input));const meta=session(subject).metadata;
  if(u.pathname===`/v1/payment_intents/pi_${subject}`)return new Response(JSON.stringify({id:`pi_${subject}`,object:'payment_intent',metadata:meta}));
  if(u.pathname==='/v1/checkout/sessions')return new Response(JSON.stringify({object:'list',data:[session(subject)],has_more:false}));
  throw new Error('Unexpected Stripe transport');
 })});
 const payload=JSON.stringify({id:eventId,object:'event',created:options.created??1700000000,livemode:options.live??false,type,
  data:{object:type==='checkout.session.completed'?{...session(subject),payment_status:'paid'}:{id:`ch_${subject}`,object:type==='charge.refunded'?'charge':'dispute',payment_intent:`pi_${subject}`,amount:1000,amount_refunded:1000,refunded:true,currency:'eur',metadata:session(subject).metadata}}});
 const signature=stripe.webhooks.generateTestHeaderString({payload,secret});
 const request=new Request('http://localhost:3000/api/stripe/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature},body:options.tamper?payload+' ':payload});
 const response=await handleStripeWebhookRequest(request,{...stripeWebhookIngressDependencies,webhookSecret:()=>secret,getStripe:()=>stripe,
  getRuntimeAuthority:()=>({credentialMode:'test',requestedMode:'test',modeMatches:true,testPaymentsAllowed:true,livePaymentsAllowed:false,blockers:[]}),
  // The default real applyPaymentEventWatermark and SQL receipt parser are used.
 });
 return {status:response.status,body:await response.json()};
}

test('Q7 four-store path commits refund; duplicate inbox avoids additional work',async()=>{
 await grant('q7_full');const id='evt_q7_full';const r=await deliver('q7_full',id);
 assert.equal(r.status,200);assert.equal(await status('q7_full'),'refunded');assert.equal(await count('q7_full'),1);
 assert.ok(calls.includes('velmere_apply_payment_event_watermark'));
 const mark=calls.length;const again=await deliver('q7_full',id);assert.equal(again.body.duplicate,true);
 assert.deepEqual(calls.slice(mark),['velmere_claim_stripe_webhook_event']);
});
test('Q7 failed lifecycle retries despite the already stored duplicate watermark',async()=>{
 await grant('q7_retry');const id='evt_q7_retry';fault='velmere_apply_vlm_paid_entitlement_lifecycle_event';
 assert.equal((await deliver('q7_retry',id)).status,500);assert.equal(await status('q7_retry'),'active');
 const before=(await db.query<{event_id:string}>("SELECT event_id FROM velmere_payment_private.event_watermarks WHERE subject_key=$1",['stripe:payment_intent:pi_q7_retry'])).rows[0];
 assert.equal(before.event_id,id);
 assert.equal((await deliver('q7_retry',id)).status,200);assert.equal(await count('q7_retry'),1);assert.equal(await status('q7_retry'),'refunded');
 const inbox=(await db.query<{attempt_count:number}>('SELECT attempt_count FROM public.velmere_stripe_webhook_events WHERE id=$1',[id])).rows[0];assert.equal(inbox.attempt_count,2);
});
test('Q7 later chargeback suppresses a new lower-priority checkout without dispatch',async()=>{
 await grant('q7_terminal');await deliver('q7_terminal','evt_q7_terminal_cb',{type:'charge.dispute.created'});
 assert.equal(await status('q7_terminal'),'revoked');const mark=calls.length;
 const r=await deliver('q7_terminal','evt_q7_terminal_paid',{type:'checkout.session.completed',created:1700000010});
 assert.equal(r.status,200);assert.equal(r.body.staleIgnored,true);assert.equal(r.body.orderingReason,'terminal_state_dominates');
 assert.equal(r.body.currentEventId,'evt_q7_terminal_cb');assert.equal(r.body.currentKind,'chargeback');
 assert.equal(calls.slice(mark).includes('velmere_apply_vlm_paid_entitlement_lifecycle_event'),false);assert.equal(await status('q7_terminal'),'revoked');
});
test('Q7 a new old refund cannot override chargeback after a failed earlier refund',async()=>{
 await grant('q7_overtaken');fault='velmere_apply_vlm_paid_entitlement_lifecycle_event';
 assert.equal((await deliver('q7_overtaken','evt_q7_overtaken_refund')).status,500);
 assert.equal((await deliver('q7_overtaken','evt_q7_overtaken_cb',{type:'charge.dispute.created',created:1700000001})).status,200);
 const r=await deliver('q7_overtaken','evt_q7_overtaken_refund');assert.equal(r.body.staleIgnored,true);
 assert.equal(await status('q7_overtaken'),'revoked');assert.equal(await count('q7_overtaken'),1);
});
test('Q7 failed final acknowledgement retries completed effect with real ordering',async()=>{
 await grant('q7_completion');fault='velmere_complete_stripe_webhook_event';const id='evt_q7_completion';
 assert.equal((await deliver('q7_completion',id)).status,500);assert.equal(await count('q7_completion'),1);
 const mark=calls.length;assert.equal((await deliver('q7_completion',id)).status,200);
 assert.ok(calls.slice(mark).includes('velmere_apply_payment_event_watermark'));
 assert.equal(calls.slice(mark).includes('velmere_apply_vlm_paid_entitlement_lifecycle_event'),false);assert.equal(await count('q7_completion'),1);
});
test('Q7 malformed ordering receipt never dispatches and remains retryable',async()=>{
 await grant('q7_bad_reply');corruptOrdering=true;
 try{assert.equal((await deliver('q7_bad_reply','evt_q7_bad_reply')).status,503);}finally{corruptOrdering=false;}
 assert.equal(await status('q7_bad_reply'),'active');assert.equal(await count('q7_bad_reply'),0);
 assert.equal((await deliver('q7_bad_reply','evt_q7_bad_reply')).status,200);assert.equal(await count('q7_bad_reply'),1);
});
test('Q7 failed ordering transport persists retryable inbox; retry succeeds',async()=>{
 await grant('q7_order_error');fault='velmere_apply_payment_event_watermark';const id='evt_q7_order_error';
 assert.equal((await deliver('q7_order_error',id)).status,503);assert.equal(await status('q7_order_error'),'active');
 assert.equal((await deliver('q7_order_error',id)).status,200);assert.equal(await count('q7_order_error'),1);
});
test('Q7 invalid signature and LIVE event cannot touch any of the four stores',async()=>{
 for(const options of [{tamper:true},{live:true}]){
  const mark=calls.length;assert.equal((await deliver('q7_invalid','evt_q7_invalid',options)).status,400);assert.equal(calls.length,mark);
 }
});
