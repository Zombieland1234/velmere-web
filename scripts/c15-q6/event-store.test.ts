import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { claimStripeWebhookEvent, completeStripeWebhookEvent, hasProcessedStripeWebhookEvent,
 type StripeWebhookEventStorageDependencies } from '../../lib/db/order-service';
import { SUPABASE_RPC_OPERATIONS } from '../../lib/db/supabase-rpc-operation-registry';
import { runStripeWebhookEffect, claimStripeWebhookEffect, completeStripeWebhookEffect,
 failStripeWebhookEffect, deadLetterStripeWebhookEffect } from '../../lib/payments/stripe-webhook-effect-ledger';
import { applyVlmPaidEntitlementLifecycleEvent } from '../../lib/commerce/vlm-entitlement-lifecycle';
// Real SQL and application, replaced network only. No GoTrue, PostgREST or Stripe payment.
const db=new PGlite();
const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,node:process.env.NODE_ENV,vercel:process.env.VERCEL_ENV};
const sql=readFileSync(new URL('./event-store.sql',import.meta.url),'utf8');
const input=(id:string)=>({eventId:'evt_q6_'+id,eventType:'charge.refunded',eventCreatedAt:1770000000});
const store:StripeWebhookEventStorageDependencies={rpc:async({operation,args={}})=>{
 const name=SUPABASE_RPC_OPERATIONS[operation].rpcName;
 await db.exec("SET ROLE service_role");
 try {
 const result=await db.query<{data:unknown}>(`SELECT public.${name}(${Object.keys(args).map((k,i)=>`${k}=>$${i+1}`).join(',')}) AS data`,Object.values(args));
 return {data:result.rows[0].data,receipt:{schemaVersion:'velmere.bounded-rpc-receipt.v1',operation,
  capability:'service_role_write',durationMs:0,deadlineMs:3000,aborted:false,durableBoundary:'service_role'}};
 } finally { await db.exec('RESET ROLE'); }
}};
const claim=(id:string)=>claimStripeWebhookEvent(input(id),store);
const complete=(id:string,attempt=1,status:'processed'|'retryable_failed'|'dead_letter'='processed')=>
 completeStripeWebhookEvent({...input(id),expectedAttempt:attempt,status,errorCode:status==='processed'?undefined:'temporary_failure'},store);
const state=async(id:string)=>(await db.query<{status:string;attempt_count:number;event_type:string;lease_expires_at:string;last_error_code:string|null}>(
 'SELECT * FROM public.velmere_stripe_webhook_events WHERE id=$1',[input(id).eventId])).rows[0];
const expire=(id:string)=>db.query("UPDATE public.velmere_stripe_webhook_events SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[input(id).eventId]);
before(async()=>{
 process.env.SUPABASE_URL='https://q6-test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');
 await db.exec(readFileSync(new URL('../c15-q4/bootstrap-roles.sql',import.meta.url),'utf8'));
 await assert.rejects(db.exec(sql),/DISPOSABLE_EVENT_STORE_ACK_REQUIRED/);await db.exec('ROLLBACK');
 await db.exec("SET velmere.disposable_event_store='ISOLATED_TEST_ONLY'");await db.exec(sql);
 await db.exec("SET velmere.disposable_entitlement_store='ISOLATED_TEST_ONLY'");
 await db.exec(readFileSync(new URL('../c15-q4/entitlement-store.sql',import.meta.url),'utf8'));
 await db.exec("SET velmere.disposable_effect_store='ISOLATED_TEST_ONLY'");
 await db.exec(readFileSync(new URL('../c15-q5/effect-store.sql',import.meta.url),'utf8'));
});
after(async()=>{
 await db.close();
 for(const [k,v] of [['SUPABASE_URL',saved.url],['SUPABASE_SERVICE_ROLE_KEY',saved.key],['VERCEL_ENV',saved.vercel]] as const){
  if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
test('Q6 creates a bound claim and returns busy without moving its deadline',async()=>{
 assert.deepEqual(await claim('busy'),{claimed:true,status:'processing',attempt:1});const first=await state('busy');
 const busy=await claim('busy');assert.equal(busy.claimed,false);assert.equal(busy.status,'processing');
 assert.deepEqual(await state('busy'),first);
});
test('Q6 completed event replays and exact completion is idempotent',async()=>{
 await claim('complete');await complete('complete');const first=await state('complete');await complete('complete');
 assert.deepEqual(await state('complete'),first);
 assert.deepEqual(await claim('complete'),{claimed:false,status:'processed',attempt:1});
});
test('Q6 changed event identity is rejected even after completion',async()=>{
 await claim('identity');await complete('identity');
 for(const change of [{eventType:'charge.dispute.created'},{eventCreatedAt:1770000001}])
  await assert.rejects(claimStripeWebhookEvent({...input('identity'),...change},store));
 assert.equal((await state('identity')).status,'processed');
});
test('Q6 completion checks event type, exact attempt and stored expiry',async()=>{
 await claim('fence');
 await assert.rejects(completeStripeWebhookEvent({...input('fence'),eventType:'other',expectedAttempt:1,status:'processed'},store));
 await assert.rejects(complete('fence',2));await expire('fence');await assert.rejects(complete('fence'));
 assert.equal((await state('fence')).status,'processing');
});
test('Q6 reclaimer fences every final state written by the previous generation',async()=>{
 await claim('reclaim');await expire('reclaim');assert.deepEqual(await claim('reclaim'),{claimed:true,status:'processing',attempt:2});
 for(const status of ['processed','retryable_failed','dead_letter'] as const)await assert.rejects(complete('reclaim',1,status));
 await complete('reclaim',2);assert.equal((await state('reclaim')).status,'processed');
});
test('Q6 retry increments generation and dead-letter blocks automatic reexecution',async()=>{
 await claim('retry');await complete('retry',1,'retryable_failed');await complete('retry',1,'retryable_failed');
 assert.equal((await claim('retry')).attempt,2);await assert.rejects(complete('retry',1,'retryable_failed'));
 await complete('retry',2,'dead_letter');assert.deepEqual(await claim('retry'),{claimed:false,status:'dead_letter',attempt:2});
});
test('Q6 nonzero attempt overflow fails without resetting history',async()=>{
 await claim('overflow');await expire('overflow');await db.query('UPDATE public.velmere_stripe_webhook_events SET attempt_count=2147483647 WHERE id=$1',[input('overflow').eventId]);
 await assert.rejects(claim('overflow'));assert.equal((await state('overflow')).attempt_count,2147483647);
});
test('Q6 app rejects fractional generation before a transport call',async()=>{
 let calls=0;const fake:StripeWebhookEventStorageDependencies={rpc:async()=>{calls++;throw Error('UNEXPECTED');}};
 await assert.rejects(completeStripeWebhookEvent({...input('bad'),expectedAttempt:1.9,status:'processed'},fake));assert.equal(calls,0);
});
test('Q6 RPC failure is sanitized and never switches to memory',async()=>{
 const fake:StripeWebhookEventStorageDependencies={rpc:async()=>{throw Error('private_transport_detail');}};
 await assert.rejects(claimStripeWebhookEvent(input('error'),fake),{message:'stripe_webhook_claim_failed'});
 assert.equal(await state('error'),undefined);
});
test('Q6 error code is bounded and no raw transport text is persisted',async()=>{
 await claim('errorcode');await completeStripeWebhookEvent({...input('errorcode'),expectedAttempt:1,status:'retryable_failed',errorCode:'x '.repeat(200)},store);
 const s=await state('errorcode');assert.equal(s.last_error_code?.length,160);assert.match(s.last_error_code!,/^[a-zA-Z0-9:_-]+$/);
});
test('Q6 outer rollback and failed update preserve the previous event state',async()=>{
 await claim('rollback');const first=await state('rollback');await db.exec('BEGIN');await complete('rollback');await db.exec('ROLLBACK');assert.deepEqual(await state('rollback'),first);
 await db.exec("ALTER TABLE public.velmere_stripe_webhook_events ADD CONSTRAINT q6_injected CHECK (id <> 'evt_q6_rollback' OR status <> 'processed')");
 await assert.rejects(complete('rollback'));assert.deepEqual(await state('rollback'),first);
 await db.exec('ALTER TABLE public.velmere_stripe_webhook_events DROP CONSTRAINT q6_injected');await complete('rollback');
});
for(const role of ['anon','authenticated'])test(`Q6 ${role} cannot read events or call either RPC`,async()=>{
 await db.exec(`SET ROLE ${role}`);
 try{
  await assert.rejects(db.query('SELECT * FROM public.velmere_stripe_webhook_events'));
  await assert.rejects(db.query('SELECT public.velmere_claim_stripe_webhook_event($1,$2,$3,$4)',['evt_a','type',0,300]));
  await assert.rejects(db.query('SELECT public.velmere_complete_stripe_webhook_event($1,$2,$3,$4,$5)',['evt_a','type',1,'processed',null]));
 }finally{await db.exec('RESET ROLE');}
});
test('Q6 invoker functions, fixed search path and forced RLS are explicit',async()=>{
 const r=await db.query<{prosecdef:boolean;proconfig:string[]}>('SELECT prosecdef,proconfig FROM pg_proc WHERE proname IN (\'velmere_claim_stripe_webhook_event\',\'velmere_complete_stripe_webhook_event\')');
 assert.equal(r.rows.length,2);for(const x of r.rows){assert.equal(x.prosecdef,false);assert.deepEqual(x.proconfig,['search_path=pg_catalog']);}
 const t=await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.velmere_stripe_webhook_events'::regclass");
 assert.equal(t.rows[0].relrowsecurity,true);assert.equal(t.rows[0].relforcerowsecurity,true);
});
test('Q6 processed event ID is retained; reinstall cannot wipe duplicate protection',async()=>{
 await assert.rejects(db.exec(sql),/EXISTING_EVENT_OBJECTS_REQUIRE_REVIEW/);await db.exec('ROLLBACK');
 assert.deepEqual(await claim('complete'),{claimed:false,status:'processed',attempt:1});
});
test('Q6 development store refuses expired, conflicting and rounded settlements',async()=>{
 const clock=Date.now;const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 let now=1800000000000;Date.now=()=>now;
 try{
  const c=await claim('memory');assert.equal(c.claimed,true);
  await assert.rejects(complete('memory',1.9));await assert.rejects(claimStripeWebhookEvent({...input('memory'),eventType:'other'}));
  now+=300001;await assert.rejects(complete('memory'));assert.equal((await claim('memory')).attempt,2);
  await complete('memory',2);assert.equal(await hasProcessedStripeWebhookEvent(input('memory').eventId),true);
 }finally{Date.now=clock;if(url)process.env.SUPABASE_URL=url;if(key)process.env.SUPABASE_SERVICE_ROLE_KEY=key;}
});
test('Q6 production without storage refuses claim, complete and compatibility lookup',async()=>{
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.VERCEL_ENV='production';
 try{
  await assert.rejects(claim('prod'),/storage_unavailable/);await assert.rejects(complete('prod'),/storage_unavailable/);
  await assert.rejects(hasProcessedStripeWebhookEvent(input('prod').eventId),/storage_unavailable/);
 }finally{if(url)process.env.SUPABASE_URL=url;if(key)process.env.SUPABASE_SERVICE_ROLE_KEY=key;
  if(saved.vercel===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=saved.vercel;}
});
test('Q6 event + Q5 effect + Q4 lifecycle: lost event completion resumes without a second refund',async()=>{
 const id='ent_q6_joined',hash=(s:string)=>createHash('sha256').update(s).digest('hex');
 const args={p_id:id,p_stripe_session_id:'cs_test_q6_joined',p_stripe_customer_id:null,p_product_id:'vlm_pro_analysis_single',p_access_scope:'vlm_pro_analysis',p_context_hash:hash('context'),
  p_context:{surface:'shield',locale:'en',depth:'pro',accountIdHash:hash('account')},p_locale:'en',p_amount_total:1000,p_currency:'EUR',p_customer_email:null,p_customer_name:null,
  p_payment_status:'paid',p_source:'stripe_webhook',p_audit_queue_id:null,p_expires_at:'2099-01-01T00:00:00Z',p_created_at:'2026-01-01T00:00:00Z'};
 await db.query(`SELECT public.velmere_create_or_read_vlm_paid_entitlement(${Object.keys(args).map((k,i)=>`${k}=>$${i+1}`).join(',')})`,Object.values(args));
 let callbacks=0;const deps={claim:<T>(p:Parameters<typeof claimStripeWebhookEffect>[0])=>claimStripeWebhookEffect<T>(p,store),
  complete:(p:Parameters<typeof completeStripeWebhookEffect>[0])=>completeStripeWebhookEffect(p,store),
  fail:(p:Parameters<typeof failStripeWebhookEffect>[0])=>failStripeWebhookEffect(p,store),
  deadLetter:(p:Parameters<typeof deadLetterStripeWebhookEffect>[0])=>deadLetterStripeWebhookEffect(p,store)};
 const operation={...input('joined'),effectKey:'refund',execute:()=>{callbacks++;return applyVlmPaidEntitlementLifecycleEvent({entitlementId:id,eventId:input('joined').eventId,event:'refund',dependencies:store});}};
 await claim('joined');await runStripeWebhookEffect(operation,deps); // simulated process loss before event completion
 await expire('joined');assert.equal((await claim('joined')).attempt,2);await runStripeWebhookEffect(operation,deps);await complete('joined',2);
 assert.equal(callbacks,1);assert.equal((await db.query<{n:number}>('SELECT count(*)::int AS n FROM velmere_billing_private.lifecycle_events WHERE entitlement_id=$1',[id])).rows[0].n,1);
 assert.equal((await state('joined')).status,'processed');assert.equal((await claim('joined')).claimed,false);
});
