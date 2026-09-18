import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { PGlite } from '@electric-sql/pglite';
import { handleStripeWebhookRequest, stripeWebhookIngressDependencies } from '../../lib/payments/stripe-webhook/ingress';

// Joined application path: authentic SDK HMAC verification, actual ingress,
// dispatcher, terminal binding, Supabase client, Q6 inbox, Q5 effects, Q4 SQL and Q7 ordering.
// Only transports are controlled; the actual Q7 SQL ordering and Q8 identity resolution are used. No real payment, GoTrue login,
// PostgREST service or HTTP socket is claimed. Grants below are fixture setup.
const db=new PGlite();const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const originalFetch=globalThis.fetch;
const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
const secret=randomBytes(32).toString('hex');
const calls:string[]=[];const fault:string|null=null;const ambiguousClaim=false;const corruptOrdering=false;
const rpcNames=new Set(['velmere_claim_stripe_webhook_event','velmere_complete_stripe_webhook_event',
 'velmere_claim_stripe_webhook_effect','velmere_complete_stripe_webhook_effect',
 'velmere_fail_stripe_webhook_effect','velmere_dead_letter_stripe_webhook_effect',
 'velmere_apply_vlm_paid_entitlement_lifecycle_event','velmere_apply_payment_event_watermark']);
before(async()=>{
 process.env.SUPABASE_URL='https://q6-joined-transport.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');
 await db.exec(readFileSync(new URL('../c15-q4/bootstrap-roles.sql',import.meta.url),'utf8'));
 for(const [ack,file] of [['entitlement','../c15-q4/entitlement-store.sql'],['effect','../c15-q5/effect-store.sql'],['event','../c15-q6/event-store.sql'],['watermark','../c15-q7/watermark-store.sql']]){
  await db.exec(`SET velmere.disposable_${ack}_store='ISOLATED_TEST_ONLY'`);await db.exec(readFileSync(new URL(file,import.meta.url),'utf8'));
 }
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.origin,'https://q6-joined-transport.invalid');
  const fn=url.pathname.split('/').at(-1)!;calls.push(fn);
  if(fault===fn){return new Response(JSON.stringify({code:'XX000',message:'controlled_failure'}),{status:500,headers:{'content-type':'application/json'}});}
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
async function deliver(subject:string,eventId:string,options:{type?:'charge.refunded'|'charge.dispute.created'|'checkout.session.completed'|'payment_intent.payment_failed';tamper?:boolean;live?:boolean;created?:number; indirect?:boolean; chargeDown?:boolean; wrongCharge?:boolean; metadata?:Record<string,string>}={}){
 const type=options.type??'charge.refunded';
 const stripe=new Stripe('sk_test_'+randomBytes(18).toString('hex'),{maxNetworkRetries:0,httpClient:Stripe.createFetchHttpClient(async(input)=>{
  const u=new URL(String(input));const meta=session(subject).metadata;
  if(u.pathname===`/v1/charges/ch_${subject}`)return new Response(JSON.stringify(options.chargeDown?{error:{message:'isolated_down'}}:{id:options.wrongCharge?'ch_q8_wrong':`ch_${subject}`,object:'charge',livemode:false,payment_intent:`pi_${subject}`}),{status:options.chargeDown?503:200});
  if(u.pathname===`/v1/payment_intents/pi_${subject}`)return new Response(JSON.stringify({id:`pi_${subject}`,object:'payment_intent',metadata:meta}));
  if(u.pathname==='/v1/checkout/sessions')return new Response(JSON.stringify({object:'list',data:[session(subject)],has_more:false}));
  throw new Error('Unexpected Stripe transport');
 })});
 const payload=JSON.stringify({id:eventId,object:'event',created:options.created??1700000000,livemode:options.live??false,type,
  data:{object:type==='payment_intent.payment_failed'?{id:`pi_${subject}`,object:'payment_intent',metadata:{}}:type==='checkout.session.completed'?{...session(subject),payment_status:'paid'}:{id:type==='charge.dispute.created'?`du_${subject}`:`ch_${subject}`,object:type==='charge.refunded'?'charge':'dispute',charge:`ch_${subject}`,payment_intent:options.indirect?null:`pi_${subject}`,amount:1000,amount_refunded:1000,refunded:true,currency:'eur',metadata:options.metadata??session(subject).metadata}}});
 const signature=stripe.webhooks.generateTestHeaderString({payload,secret});
 const request=new Request('http://localhost:3000/api/stripe/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature},body:options.tamper?payload+' ':payload});
 const response=await handleStripeWebhookRequest(request,{...stripeWebhookIngressDependencies,webhookSecret:()=>secret,getStripe:()=>stripe,
  getRuntimeAuthority:()=>({credentialMode:'test',requestedMode:'test',modeMatches:true,testPaymentsAllowed:true,livePaymentsAllowed:false,blockers:[]}),
  // The default real applyPaymentEventWatermark and SQL receipt parser are used.
 });
 return {status:response.status,body:await response.json()};
}


const identities=async(id:string)=>(await db.query('SELECT subject_key FROM velmere_payment_private.event_identities WHERE event_id=$1',[id])).rows;
test('Q8 dispute lookup outage records no provisional watermark; retry recovers',async()=>{
 const subject='q8_outage',id='evt_q8_outage';await grant(subject);
 const first=await deliver(subject,id,{type:'charge.dispute.created',indirect:true,chargeDown:true,metadata:{...session(subject).metadata,auditCaseRef:'shared_case'}});
 assert.equal(first.status,503);assert.equal(first.body.retryable,true);
 assert.deepEqual(await identities(id),[]);assert.equal(await status(subject),'active');assert.equal(await count(subject),0);
 const second=await deliver(subject,id,{type:'charge.dispute.created',indirect:true,metadata:{...session(subject).metadata,auditCaseRef:'shared_case'}});
 assert.equal(second.status,200);assert.equal(await status(subject),'revoked');assert.equal(await count(subject),1);
 assert.deepEqual(await identities(id),[{subject_key:'stripe:payment_intent:pi_'+subject}]);
});
test('Q8 later PaymentIntent failure cannot bypass an earlier refund watermark',async()=>{
 const subject='q8_same_intent';await grant(subject);
 assert.equal((await deliver(subject,'evt_q8_initial_refund')).status,200);
 const marker=calls.length;
 const r=await deliver(subject,'evt_q8_late_failure',{type:'payment_intent.payment_failed',created:1700000050});
 assert.equal(r.status,200);assert.equal(r.body.staleIgnored,true);assert.equal(r.body.orderingReason,'terminal_state_dominates');
 assert.equal(r.body.currentEventId,'evt_q8_initial_refund');assert.equal(await status(subject),'refunded');
 assert.equal(calls.slice(marker).includes('velmere_apply_vlm_paid_entitlement_lifecycle_event'),false);
});
test('Q8 mismatched Charge response does not create a watermark or revoke a grant',async()=>{
 const subject='q8_wrong_charge',id='evt_q8_wrong_charge';await grant(subject);
 const r=await deliver(subject,id,{type:'charge.dispute.created',indirect:true,wrongCharge:true});
 assert.equal(r.status,503);assert.deepEqual(await identities(id),[]);assert.equal(await status(subject),'active');assert.equal(await count(subject),0);
});
test('Q8 verified indirect dispute and direct refund share one canonical subject',async()=>{
 const subject='q8_common';await grant(subject);
 assert.equal((await deliver(subject,'evt_q8_indirect',{type:'charge.dispute.created',indirect:true})).status,200);
 const r=await deliver(subject,'evt_q8_direct_refund',{created:1700000090});
 assert.equal(r.status,200);assert.equal(r.body.staleIgnored,true);assert.equal(r.body.currentKind,'chargeback');
 assert.equal(await status(subject),'revoked');assert.equal(await count(subject),1);
});
test('Q8 distinct intents are not merged by identical business metadata',async()=>{
 for(const subject of ['q8_distinct_a','q8_distinct_b']){
  await grant(subject);const r=await deliver(subject,'evt_'+subject,{type:'charge.dispute.created',indirect:true,metadata:{...session(subject).metadata,auditCaseRef:'shared_case'}});
  assert.equal(r.status,200);assert.equal(await status(subject),'revoked');
  assert.deepEqual(await identities('evt_'+subject),[{subject_key:'stripe:payment_intent:pi_'+subject}]);
 }
});
test('Q8 invalid signature still touches none of the persistence layers',async()=>{
 const marker=calls.length;assert.equal((await deliver('q8_signature','evt_q8_signature',{type:'charge.dispute.created',indirect:true,tamper:true})).status,400);
 assert.equal(calls.length,marker);
});
