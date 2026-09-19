import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { PGlite } from '@electric-sql/pglite';
import { handleStripeWebhookRequest, stripeWebhookIngressDependencies } from '../../lib/payments/stripe-webhook/ingress';
import { buildPaymentEventWatermark } from '../../lib/payments/stripe-webhook-state';

// Joined application path: authentic SDK HMAC verification, actual ingress,
// dispatcher, terminal binding, Supabase client, Q6 inbox, Q5 effects, Q4 SQL.
// Only transports and ordering are controlled. No real payment, GoTrue login,
// PostgREST service or HTTP socket is claimed. Grants below are fixture setup.
const db=new PGlite();const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const originalFetch=globalThis.fetch;
const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
const secret=randomBytes(32).toString('hex');
const calls:string[]=[];let fault:string|null=null;let ambiguousClaim=false;
const rpcNames=new Set(['velmere_claim_stripe_webhook_event','velmere_complete_stripe_webhook_event',
 'velmere_claim_stripe_webhook_effect','velmere_complete_stripe_webhook_effect',
 'velmere_fail_stripe_webhook_effect','velmere_dead_letter_stripe_webhook_effect',
 'velmere_apply_vlm_paid_entitlement_lifecycle_event']);
before(async()=>{
 process.env.SUPABASE_URL='https://q6-joined-transport.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');
 await db.exec(readFileSync(new URL('../c15-q4/bootstrap-roles.sql',import.meta.url),'utf8'));
 for(const [ack,file] of [['entitlement','../c15-q4/entitlement-store.sql'],['effect','../c15-q5/effect-store.sql'],['event','./event-store.sql']]){
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
async function deliver(subject:string,eventId:string,options:{type?:'charge.refunded'|'charge.dispute.created';tamper?:boolean;live?:boolean;created?:number}={}){
 const type=options.type??'charge.refunded';
 const stripe=new Stripe('sk_test_'+randomBytes(18).toString('hex'),{maxNetworkRetries:0,httpClient:Stripe.createFetchHttpClient(async(input)=>{
  const u=new URL(String(input));const meta=session(subject).metadata;
  if(u.pathname===`/v1/payment_intents/pi_${subject}`)return new Response(JSON.stringify({id:`pi_${subject}`,object:'payment_intent',metadata:meta}));
  if(u.pathname==='/v1/checkout/sessions')return new Response(JSON.stringify({object:'list',data:[session(subject)],has_more:false}));
  throw new Error('Unexpected Stripe transport');
 })});
 const payload=JSON.stringify({id:eventId,object:'event',created:options.created??1700000000,livemode:options.live??false,type,
  data:{object:{id:`ch_${subject}`,object:type==='charge.refunded'?'charge':'dispute',payment_intent:`pi_${subject}`,amount:1000,amount_refunded:1000,refunded:true,currency:'eur',metadata:session(subject).metadata}}});
 const signature=stripe.webhooks.generateTestHeaderString({payload,secret});
 const request=new Request('http://localhost:3000/api/stripe/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature},body:options.tamper?payload+' ':payload});
 const response=await handleStripeWebhookRequest(request,{...stripeWebhookIngressDependencies,webhookSecret:()=>secret,getStripe:()=>stripe,
  getRuntimeAuthority:()=>({credentialMode:'test',requestedMode:'test',modeMatches:true,testPaymentsAllowed:true,livePaymentsAllowed:false,blockers:[]}),
  // Ordering/holds are explicitly not supplied by Q6. This is a bounded pipeline test.
  applyPaymentEventWatermark:async input=>({accepted:true,reason:'first_event',next:buildPaymentEventWatermark(input)}),
 });
 return {status:response.status,body:await response.json()};
}
test('Q6 signed refund persists event, effect and exactly one lifecycle transition; duplicate replays',async()=>{
 await grant('q6_normal');const id='evt_q6_normal';const r=await deliver('q6_normal',id);assert.equal(r.status,200);assert.equal(r.body.received,true);
 assert.equal(await status('q6_normal'),'refunded');assert.equal(await count('q6_normal'),1);
 const mark=calls.length;const again=await deliver('q6_normal',id);assert.equal(again.body.duplicate,true);assert.deepEqual(calls.slice(mark),['velmere_claim_stripe_webhook_event']);
 assert.equal(await count('q6_normal'),1);
});
test('Q6 SQL failure leaves event retryable and retry later commits refund once',async()=>{
 await grant('q6_retry');fault='velmere_apply_vlm_paid_entitlement_lifecycle_event';const id='evt_q6_retry';
 assert.equal((await deliver('q6_retry',id)).status,500);assert.equal(await status('q6_retry'),'active');assert.equal(await count('q6_retry'),0);
 assert.equal((await deliver('q6_retry',id)).status,200);assert.equal(await status('q6_retry'),'refunded');assert.equal(await count('q6_retry'),1);
 const r=(await db.query<{attempt_count:number;status:string}>('SELECT attempt_count,status FROM public.velmere_stripe_webhook_events WHERE id=$1',[id])).rows[0];assert.equal(r.attempt_count,2);assert.equal(r.status,'processed');
});
test('Q6 lost final acknowledgement replays completed effect, not a second refund',async()=>{
 await grant('q6_lost');fault='velmere_complete_stripe_webhook_event';const id='evt_q6_lost';
 assert.equal((await deliver('q6_lost',id)).status,500);assert.equal(await status('q6_lost'),'refunded');assert.equal(await count('q6_lost'),1);
 const mark=calls.length;assert.equal((await deliver('q6_lost',id)).status,200);assert.equal(await count('q6_lost'),1);
 assert.equal(calls.slice(mark).includes('velmere_apply_vlm_paid_entitlement_lifecycle_event'),false);
});
test('Q6 old refund replay does not undo later chargeback',async()=>{
 await grant('q6_chargeback');await deliver('q6_chargeback','evt_q6_refund');
 assert.equal((await deliver('q6_chargeback','evt_q6_chargeback',{type:'charge.dispute.created'})).status,200);assert.equal(await status('q6_chargeback'),'revoked');
 await deliver('q6_chargeback','evt_q6_refund');assert.equal(await status('q6_chargeback'),'revoked');assert.equal(await count('q6_chargeback'),2);
});
for(const option of ['tamper','live'] as const)test(`Q6 ${option} never reaches database`,async()=>{
 const mark=calls.length;assert.equal((await deliver('q6_denied',`evt_q6_${option}`,{[option]:true})).status,400);assert.equal(calls.length,mark);
});
test('Q6 conflicting signed event identity is rejected before dispatch',async()=>{
 await grant('q6_conflict');await deliver('q6_conflict','evt_q6_conflict');const mark=calls.length;
 assert.equal((await deliver('q6_conflict','evt_q6_conflict',{created:1700000001})).status,503);assert.deepEqual(calls.slice(mark),['velmere_claim_stripe_webhook_event']);
});
test('Q6 ambiguous claim cannot be acknowledged as processed or dispatch a refund',async()=>{
 await grant('q6_ambiguous');ambiguousClaim=true;
 try{assert.equal((await deliver('q6_ambiguous','evt_q6_ambiguous')).status,503);}finally{ambiguousClaim=false;}
 assert.equal(await status('q6_ambiguous'),'active');assert.equal(await count('q6_ambiguous'),0);
});
