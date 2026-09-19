import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import {database,create,counts,state} from './test-helpers';
import { createHash, randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { PGlite } from '@electric-sql/pglite';
import { handleStripeWebhookRequest, stripeWebhookIngressDependencies } from '../../lib/payments/stripe-webhook/ingress';

// Joined actual application + Q4/Q5/Q6/Q7/Q8 SQL. Stripe and Supabase transports
// are controlled; no real Stripe TEST payment, Auth, PostgREST socket or native
// concurrent PostgreSQL. Grant creation is fixture setup, never a claimed purchase.
let db:PGlite;const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const originalFetch=globalThis.fetch;
const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
const secret=randomBytes(32).toString('hex');
const calls:string[]=[];let fault:string|null=null;let lostHoldResponse=false;let malformedHold=false;let createDuringHold:string|null=null;
const baseline = process.env.Q8_BASELINE_REPLAY === '1';
const rpcNames=new Set(['velmere_claim_stripe_webhook_event','velmere_complete_stripe_webhook_event',
 'velmere_claim_stripe_webhook_effect','velmere_complete_stripe_webhook_effect',
 'velmere_fail_stripe_webhook_effect','velmere_dead_letter_stripe_webhook_effect',
 'velmere_apply_vlm_paid_entitlement_lifecycle_event','velmere_apply_payment_event_watermark','velmere_record_vlm_terminal_payment_hold']);
before(async()=>{
 process.env.SUPABASE_URL='https://q8-joined-transport.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');
 db=await database(!baseline, true);
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.origin,'https://q8-joined-transport.invalid');
  const fn=url.pathname.split('/').at(-1)!;calls.push(fn);
  if(fault===fn){fault=null;return new Response(JSON.stringify({code:'XX000',message:'controlled_failure'}),{status:500,headers:{'content-type':'application/json'}});}
  await db.exec('SET ROLE service_role');
  try {
   if(url.pathname.startsWith('/rest/v1/rpc/')){
    assert.ok(rpcNames.has(fn));const args=JSON.parse(String(init?.body)) as Record<string,unknown>;
    assert.ok(Object.keys(args).every(k=>/^p_[a-z_]+$/.test(k)));
    if(fn==='velmere_record_vlm_terminal_payment_hold' && createDuringHold){const name=createDuringHold;createDuringHold=null;assert.equal((await create(db,name)).ok,true);}
    const row=(await db.query<{data:unknown}>(`SELECT public.${fn}(${Object.keys(args).map((k,i)=>`${k} => $${i+1}`).join(',')}) AS data`,Object.values(args))).rows[0];
    // This branch executes the SQL before dropping the response: unlike the
    // pre-RPC fault above it models a committed hold with an unavailable reply.
    if(fn==='velmere_record_vlm_terminal_payment_hold' && lostHoldResponse){lostHoldResponse=false;return new Response(JSON.stringify({code:'XX000',message:'response_lost_after_commit'}),{status:500,headers:{'content-type':'application/json'}});}
    const data=fn==='velmere_record_vlm_terminal_payment_hold' && malformedHold ? {...row.data as object,ok:'true'} : row.data;
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


test('Q8 signed full refund before first grant prevents later verified Checkout grant',async()=>{
 const name='q8_early';const result=await deliver(name,'evt_q8_early');const grant=await create(db,name);
 console.log(JSON.stringify({scenario:'EARLY_REFUND_BEFORE_FIRST_GRANT',baseline,responseStatus:result.status,received:result.body.received,grantAllowed:grant.ok,grantState:(await state(db,name))?.status??null}));
 assert.equal(result.status,200);assert.equal(result.body.paymentBlocked,true);assert.equal(result.body.heldBeforeGrant,true);assert.equal(result.body.accessRevoked,false);
 assert.equal(grant.ok,false);assert.equal(grant.error,'entitlement_release_hold');assert.equal(await state(db,name),undefined);assert.deepEqual(await counts(db,name),{holds:1,events:0});
});
test('Q8 signed early chargeback also prevents grant and does not pretend revoking a missing row',async()=>{
 const name='q8_early_cb';const result=await deliver(name,'evt_q8_early_cb',{type:'charge.dispute.created'});
 assert.equal(result.status,200);assert.equal(result.body.accessRevoked,false);assert.equal((await create(db,name)).ok,false);assert.equal(await state(db,name),undefined);
});
test('Q8 early terminal duplicate returns inbox receipt without repeating hold work',async()=>{
 const name='q8_duplicate';await deliver(name,'evt_q8_duplicate');const mark=calls.length;
 const r=await deliver(name,'evt_q8_duplicate');assert.equal(r.status,200);assert.equal(r.body.duplicate,true);
 assert.deepEqual(calls.slice(mark),['velmere_claim_stripe_webhook_event']);assert.deepEqual(await counts(db,name),{holds:1,events:0});
});
test('Q8 hold transport failure cannot acknowledge processing and retry persists hold',async()=>{
 const name='q8_transport';fault='velmere_record_vlm_terminal_payment_hold';const r=await deliver(name,'evt_q8_transport');
 assert.equal(r.status,503);assert.equal(r.body.retryable,true);assert.deepEqual(await counts(db,name),{holds:0,events:0});
 assert.equal((await deliver(name,'evt_q8_transport')).status,200);assert.equal((await create(db,name)).ok,false);assert.deepEqual(await counts(db,name),{holds:1,events:0});
});
test('Q8 lost response after real hold commit retries without removing or duplicating hold',async()=>{
 const name='q8_lost_response';lostHoldResponse=true;assert.equal((await deliver(name,'evt_q8_lost_response')).status,503);
 assert.deepEqual(await counts(db,name),{holds:1,events:0});assert.equal((await create(db,name)).ok,false);
 assert.equal((await deliver(name,'evt_q8_lost_response')).status,200);assert.deepEqual(await counts(db,name),{holds:1,events:0});
});
for(const type of ['charge.refunded','charge.dispute.created'] as const)test(`Q8 ${type} sees a grant inserted after not-found before hold write`,async()=>{
 const name=type==='charge.refunded'?'q8_race_refund':'q8_race_cb';createDuringHold=name;
 const result=await deliver(name,'evt_'+name,{type});assert.equal(result.status,200);assert.equal(result.body.accessRevoked,true);
 assert.equal((await state(db,name)).status,type==='charge.refunded'?'refunded':'revoked');assert.deepEqual(await counts(db,name),{holds:1,events:1});
 assert.equal((await create(db,name)).ok,false);
});
test('Q8 malformed response after committed hold is not an acknowledgement or a rollback',async()=>{
 const name='q8_malformed';malformedHold=true;try{assert.equal((await deliver(name,'evt_q8_malformed')).status,503);}finally{malformedHold=false;}
 assert.equal((await create(db,name)).ok,false);assert.deepEqual(await counts(db,name),{holds:1,events:0});
 assert.equal((await deliver(name,'evt_q8_malformed')).status,200);
});
test('Q8 failed inbox completion after hold still blocks later creation and retries safely',async()=>{
 const name='q8_completion';fault='velmere_complete_stripe_webhook_event';assert.equal((await deliver(name,'evt_q8_completion')).status,503);
 assert.equal((await create(db,name)).ok,false);assert.equal((await deliver(name,'evt_q8_completion')).status,200);assert.deepEqual(await counts(db,name),{holds:1,events:0});
});
test('Q8 signature failure or LIVE event cannot reach any SQL transport',async()=>{
 for(const options of [{tamper:true},{live:true}]){const mark=calls.length;assert.equal((await deliver('q8_invalid','evt_q8_invalid',options)).status,400);assert.equal(calls.length,mark);}
});
