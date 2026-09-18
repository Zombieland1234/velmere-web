import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { claimStripeWebhookEvent, completeStripeWebhookEvent, type StripeWebhookEventStorageDependencies } from '../../lib/db/order-service';
const db=new PGlite();
const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
const sql=readFileSync(new URL('./event-store.sql',import.meta.url),'utf8');
const mapping={stripe_webhook_event_claim:'velmere_claim_stripe_webhook_event',stripe_webhook_event_complete:'velmere_complete_stripe_webhook_event'};
before(async()=>{
 process.env.SUPABASE_URL='https://q6-no-network.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');
 await db.exec(readFileSync(new URL('../c15-q4/bootstrap-roles.sql',import.meta.url),'utf8'));
 await assert.rejects(db.exec(sql),/DISPOSABLE_EVENT_STORE_ACK_REQUIRED/);await db.exec('ROLLBACK');
 await db.exec("SET velmere.disposable_event_store='ISOLATED_TEST_ONLY'");await db.exec(sql);
});
after(async()=>{await db.close();for(const [key,value] of [['SUPABASE_URL',saved.url],['SUPABASE_SERVICE_ROLE_KEY',saved.key]] as const){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
const deps:StripeWebhookEventStorageDependencies={rpc:async input=>{
 assert.ok(input.operation in mapping);const fn=mapping[input.operation as keyof typeof mapping];const args=input.args ?? {};
 assert.ok(Object.keys(args).every(k=>/^p_[a-z_]+$/.test(k)));await db.exec('SET ROLE service_role');
 try{const x=await db.query<{data:unknown}>(`SELECT public.${fn}(${Object.keys(args).map((k,i)=>`${k} => $${i+1}`).join(',')}) AS data`,Object.values(args));
 return {data:x.rows[0].data,receipt:{schemaVersion:'velmere.bounded-rpc-receipt.v1',operation:input.operation,capability:'service_role_write',durationMs:0,deadlineMs:4000,aborted:false,durableBoundary:'service_role'}};
 }finally{await db.exec('RESET ROLE');}
}};
const identity=(id:string)=>({eventId:`evt_q6_${id}`,eventType:'charge.refunded',eventCreatedAt:1700000000});
const finish=(id:string,attempt:number,status:'processed'|'retryable_failed'|'dead_letter'='processed')=>completeStripeWebhookEvent({...identity(id),expectedAttempt:attempt,status,...(status==='processed'?{}:{errorCode:'controlled_error'})},deps);
const state=async(id:string)=>(await db.query<Record<string,unknown>>('SELECT * FROM public.velmere_stripe_webhook_events WHERE id=$1',[identity(id).eventId])).rows[0];
const expire=async(id:string)=>db.query("UPDATE public.velmere_stripe_webhook_events SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[identity(id).eventId]);
test('Q6 SQL initial claim -> completion -> replay uses application parser',async()=>{
 assert.deepEqual(await claimStripeWebhookEvent(identity('normal'),deps),{claimed:true,status:'processing',attempt:1});
 await finish('normal',1);assert.deepEqual(await claimStripeWebhookEvent(identity('normal'),deps),{claimed:false,status:'processed',attempt:1});
});
test('Q6 SQL active claim returns busy without extending its deadline',async()=>{
 await claimStripeWebhookEvent(identity('busy'),deps);const old=await state('busy');
 const x=await claimStripeWebhookEvent(identity('busy'),deps);assert.equal(x.claimed,false);assert.equal(x.status,'processing');assert.deepEqual(await state('busy'),old);
});
test('Q6 SQL retry increments the generation, terminal is never reclaimed',async()=>{
 await claimStripeWebhookEvent(identity('retry'),deps);await finish('retry',1,'retryable_failed');
 const c=await claimStripeWebhookEvent(identity('retry'),deps);assert.equal(c.attempt,2);assert.equal(c.claimed,true);
 await finish('retry',2,'dead_letter');assert.equal((await claimStripeWebhookEvent(identity('retry'),deps)).status,'dead_letter');
});
for(const change of [{eventType:'charge.dispute.created'},{eventCreatedAt:1700000001}])test(`Q6 SQL rejects changed event identity ${Object.keys(change)[0]}`,async()=>{
 const id=Object.keys(change)[0];await claimStripeWebhookEvent(identity(id),deps);const old=await state(id);
 await assert.rejects(claimStripeWebhookEvent({...identity(id),...change},deps));assert.deepEqual(await state(id),old);
});
test('Q6 SQL expires a lease even before a successor claims it',async()=>{
 await claimStripeWebhookEvent(identity('expired'),deps);await expire('expired');
 await assert.rejects(finish('expired',1));assert.equal((await state('expired')).status,'processing');
});
for(const status of ['processed','retryable_failed','dead_letter'] as const)test(`Q6 SQL stale attempt cannot write ${status}`,async()=>{
 const id=`fence_${status}`;await claimStripeWebhookEvent(identity(id),deps);await expire(id);const c=await claimStripeWebhookEvent(identity(id),deps);
 assert.equal(c.attempt,2);await assert.rejects(finish(id,1,status));assert.equal((await state(id)).status,'processing');await finish(id,2);
});
test('Q6 SQL completion also checks event type',async()=>{
 await claimStripeWebhookEvent(identity('wrongtype'),deps);
 await assert.rejects(completeStripeWebhookEvent({...identity('wrongtype'),eventType:'charge.dispute.created',status:'processed',expectedAttempt:1},deps));
 assert.equal((await state('wrongtype')).status,'processing');
});
test('Q6 SQL caller rollback erases claim and completion together',async()=>{
 await db.exec('BEGIN');await claimStripeWebhookEvent(identity('rollback'),deps);await finish('rollback',1);await db.exec('ROLLBACK');assert.equal(await state('rollback'),undefined);
});
test('Q6 SQL mutation failure leaves the previous processing state intact',async()=>{
 await claimStripeWebhookEvent(identity('failwrite'),deps);
 await db.exec("CREATE FUNCTION public.q6_injected_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'controlled_write_failure'; END$$; CREATE TRIGGER q6_test_failure BEFORE UPDATE ON public.velmere_stripe_webhook_events FOR EACH ROW EXECUTE FUNCTION public.q6_injected_failure()");
 await assert.rejects(finish('failwrite',1));await db.exec('DROP TRIGGER q6_test_failure ON public.velmere_stripe_webhook_events; DROP FUNCTION public.q6_injected_failure()');
 assert.equal((await state('failwrite')).status,'processing');await finish('failwrite',1);
});
test('Q6 SQL access is denied to both untrusted client roles',async()=>{
 for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);
 try{await assert.rejects(db.query('SELECT * FROM public.velmere_stripe_webhook_events'));await assert.rejects(db.query("SELECT public.velmere_claim_stripe_webhook_event('evt_test','charge.refunded',1,300)"));}
 finally{await db.exec('RESET ROLE');}}
});
test('Q6 SQL functions are invoker with fixed search_path and forced RLS',async()=>{
 const rows=(await db.query<{prosecdef:boolean;proconfig:string[]}>('SELECT prosecdef,proconfig FROM pg_proc WHERE proname IN ($1,$2)',Object.values(mapping))).rows;
 assert.equal(rows.length,2);for(const r of rows){assert.equal(r.prosecdef,false);assert.deepEqual(r.proconfig,['search_path=pg_catalog']);}
 const r=(await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.velmere_stripe_webhook_events'::regclass")).rows[0];assert.equal(r.relrowsecurity,true);assert.equal(r.relforcerowsecurity,true);
});
test('Q6 SQL reinstall refuses existing objects and preserves records',async()=>{
 const n=(await db.query('SELECT count(*) FROM public.velmere_stripe_webhook_events')).rows;await assert.rejects(db.exec(sql),/EXISTING_EVENT_OBJECTS_REQUIRE_REVIEW/);await db.exec('ROLLBACK');
 assert.deepEqual((await db.query('SELECT count(*) FROM public.velmere_stripe_webhook_events')).rows,n);
});
