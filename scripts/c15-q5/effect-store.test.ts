import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { applyVlmPaidEntitlementLifecycleEvent } from '../../lib/commerce/vlm-entitlement-lifecycle';
import { claimStripeWebhookEffect, completeStripeWebhookEffect, failStripeWebhookEffect,
  deadLetterStripeWebhookEffect, runStripeWebhookEffect, StripeWebhookTerminalEffectError,
  type StripeWebhookEffectStorageDependencies, type StripeWebhookEffectRunnerDependencies } from '../../lib/payments/stripe-webhook-effect-ledger';

// Actual SQL + application claim/settle/effect runner. Adapter replaces transport,
// not the database state machine. No Stripe/GoTrue/HTTP, no production database.
const db = new PGlite();
const saved = {url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
const sql = readFileSync(new URL('./effect-store.sql',import.meta.url),'utf8');
const mapping = {
  vlm_paid_entitlement_lifecycle_apply:'velmere_apply_vlm_paid_entitlement_lifecycle_event',
  stripe_webhook_effect_claim:'velmere_claim_stripe_webhook_effect',
  stripe_webhook_effect_complete:'velmere_complete_stripe_webhook_effect',
  stripe_webhook_effect_fail:'velmere_fail_stripe_webhook_effect',
  stripe_webhook_effect_dead_letter:'velmere_dead_letter_stripe_webhook_effect',
} as const;
before(async()=>{
  process.env.SUPABASE_URL='https://q5-no-network.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');
  await db.exec(readFileSync(new URL('../c15-q4/bootstrap-roles.sql',import.meta.url),'utf8'));
  await db.exec("SET velmere.disposable_effect_store='ISOLATED_TEST_ONLY'");
  await db.exec(sql);
  await db.exec("SET velmere.disposable_entitlement_store='ISOLATED_TEST_ONLY'");
  await db.exec(readFileSync(new URL('../c15-q4/entitlement-store.sql',import.meta.url),'utf8'));
});
after(async()=>{
  await db.close();
  for(const [key,value] of [['SUPABASE_URL',saved.url],['SUPABASE_SERVICE_ROLE_KEY',saved.key]] as const){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
const storage:StripeWebhookEffectStorageDependencies = {rpc:async input=>{
  assert.ok(input.operation in mapping);
  const fn=mapping[input.operation as keyof typeof mapping];
  const args=input.args as Record<string,unknown>;
  assert.ok(Object.keys(args).every(k=>/^p_[a-z_]+$/.test(k)));
  await db.exec('SET ROLE service_role');
  try{
    const result=await db.query<{data:unknown}>(`SELECT public.${fn}(${Object.keys(args).map((k,i)=>`${k} => $${i+1}`).join(',')}) AS data`,Object.values(args));
    return {data:result.rows[0].data,receipt:{schemaVersion:'velmere.bounded-rpc-receipt.v1',operation:input.operation,
      capability:'service_role_write',durationMs:0,deadlineMs:4000,aborted:false,durableBoundary:'service_role'}};
  }finally{await db.exec('RESET ROLE');}
}};
const deps:StripeWebhookEffectRunnerDependencies={
  claim:input=>claimStripeWebhookEffect(input,storage),
  complete:input=>completeStripeWebhookEffect(input,storage),
  fail:input=>failStripeWebhookEffect(input,storage),
  deadLetter:input=>deadLetterStripeWebhookEffect(input,storage),
};
const input=(id:string)=>({eventId:`evt_q5_${id}`,eventType:'charge.refunded',effectKey:'refund'});
async function claim(id:string){const x=await claimStripeWebhookEffect(input(id),storage);assert.equal(x.kind,'claimed');if(x.kind!=='claimed')throw Error('fixture');return x;}
async function state(id:string){return (await db.query<Record<string,unknown>>('SELECT * FROM velmere_webhook_private.effects WHERE event_id=$1 AND effect_key=$2',[input(id).eventId,'refund'])).rows[0];}
async function expire(id:string){await db.query("UPDATE velmere_webhook_private.effects SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE event_id=$1",[input(id).eventId]);}
function settle(id:string,c:{attempt:number;leaseToken:string}){return {eventId:input(id).eventId,effectKey:'refund',expectedAttempt:c.attempt,leaseToken:c.leaseToken};}

test('Q5 actual effect executes once then replays its stored receipt',async()=>{
  let executed=0;const args={...input('replay'),execute:async()=>({ok:true,n:++executed})};
  const first=await runStripeWebhookEffect(args,deps),second=await runStripeWebhookEffect(args,deps);
  assert.equal(first.source,'executed');assert.equal(second.source,'replayed');assert.equal(executed,1);
  assert.deepEqual(second.receipt,first.receipt);assert.equal((await state('replay')).lease_token,null);
});
test('Q5 busy claim does not reveal token or shorten stored deadline',async()=>{
  await claim('busy');const before=await state('busy');
  const b=await claimStripeWebhookEffect({...input('busy'),staleAfterMs:1000},storage);
  assert.equal(b.kind,'busy');assert.equal('leaseToken' in b,false);assert.deepEqual(await state('busy'),before);
});
test('Q5 reclaim increments attempt and fences old completion failure and dead-letter',async()=>{
  const first=await claim('fence');await expire('fence');const second=await claim('fence');
  assert.equal(second.attempt,first.attempt+1);assert.notEqual(second.leaseToken,first.leaseToken);
  await assert.rejects(completeStripeWebhookEffect({...settle('fence',first),receipt:{ok:true}},storage),/stale_completion/);
  await assert.rejects(failStripeWebhookEffect({...settle('fence',first),errorCode:'old'},storage),/stale_failure/);
  await assert.rejects(deadLetterStripeWebhookEffect({...settle('fence',first),errorCode:'old'},storage),/stale_dead_letter/);
  await completeStripeWebhookEffect({...settle('fence',second),receipt:{ok:true}},storage);
  assert.equal((await state('fence')).status,'completed');
});
test('Q5 expired lease cannot settle even before another worker claims',async()=>{
  const c=await claim('expired');await expire('expired');
  await assert.rejects(completeStripeWebhookEffect({...settle('expired',c),receipt:null},storage),/stale_completion/);
  assert.equal((await state('expired')).status,'processing');
});
test('Q5 callback failure stays retryable and successful retry stores a receipt',async()=>{
  await assert.rejects(runStripeWebhookEffect({...input('retry'),execute:async()=>({ok:false,error:'upstream_timeout',retryable:true})},deps),/upstream_timeout/);
  assert.equal((await state('retry')).status,'retryable_failed');assert.equal((await state('retry')).last_error_code,'upstream_timeout');
  const result=await runStripeWebhookEffect({...input('retry'),execute:async()=>({ok:true})},deps);
  assert.equal(result.attempt,2);assert.equal((await state('retry')).status,'completed');
});
test('Q5 terminal failure stays dead-lettered and cannot silently run again',async()=>{
  await assert.rejects(runStripeWebhookEffect({...input('terminal'),execute:async()=>{throw new StripeWebhookTerminalEffectError('bad_binding');}},deps),/bad_binding/);
  assert.equal((await state('terminal')).status,'dead_letter');let executions=0;
  await assert.rejects(runStripeWebhookEffect({...input('terminal'),execute:async()=>++executions},deps),/dead_lettered/);
  assert.equal(executions,0);
});
test('Q5 same event/effect cannot change event type',async()=>{
  await claim('type');await assert.rejects(claimStripeWebhookEffect({...input('type'),eventType:'checkout.session.completed'},storage));
  assert.equal((await state('type')).event_type,'charge.refunded');
});
test('Q5 distinct effect keys have distinct leases',async()=>{
  const a=await claim('key');const b=await claimStripeWebhookEffect({...input('key'),effectKey:'notify'},storage);
  assert.equal(b.kind,'claimed');if(b.kind==='claimed')assert.notEqual(a.leaseToken,b.leaseToken);
});
test('Q5 tuple identity does not conflate colon-separated identifiers',async()=>{
  const a=await claimStripeWebhookEffect({eventId:'evt:q5',eventType:'charge.refunded',effectKey:'refund'},storage);
  const b=await claimStripeWebhookEffect({eventId:'evt',eventType:'charge.refunded',effectKey:'q5:refund'},storage);
  assert.equal(a.kind,'claimed');assert.equal(b.kind,'claimed');
});
test('Q5 failed receipt is never persisted as completed even via direct complete',async()=>{
  const c=await claim('bad_receipt');await assert.rejects(completeStripeWebhookEffect({...settle('bad_receipt',c),receipt:{ok:false}},storage));
  assert.equal((await state('bad_receipt')).status,'processing');
});
test('Q5 JSON null is a valid successful receipt',async()=>{
  const c=await claim('jsonnull');await completeStripeWebhookEffect({...settle('jsonnull',c),receipt:null},storage);
  const replay=await claimStripeWebhookEffect(input('jsonnull'),storage);assert.equal(replay.kind,'completed');
  if(replay.kind==='completed')assert.equal(replay.receipt,null);
});
test('Q5 result byte limit refuses oversize without completing effect',async()=>{
  const c=await claim('big');await assert.rejects(completeStripeWebhookEffect({...settle('big',c),receipt:'x'.repeat(16384)},storage));
  assert.equal((await state('big')).status,'processing');
});
test('Q5 invalid lease duration and attempt are refused before RPC',async()=>{
  for(const duration of [NaN,Infinity,0,999,3600001])await assert.rejects(claimStripeWebhookEffect({...input('duration'),staleAfterMs:duration},storage));
  const c=await claim('attempt');await assert.rejects(completeStripeWebhookEffect({...settle('attempt',c),expectedAttempt:1.9,receipt:true},storage),/invalid_attempt/);
});
test('Q5 stale or foreign tokens cannot write another receipt',async()=>{
  const c=await claim('wrongtoken');await assert.rejects(completeStripeWebhookEffect({...settle('wrongtoken',c),leaseToken:randomUUID(),receipt:{ok:true}},storage));
  assert.equal((await state('wrongtoken')).status,'processing');
});
test('Q5 outer transaction rollback removes completion',async()=>{
  const c=await claim('rollback');await db.exec('BEGIN');
  await completeStripeWebhookEffect({...settle('rollback',c),receipt:{ok:true}},storage);
  await db.exec('ROLLBACK');assert.equal((await state('rollback')).status,'processing');
});
test('Q5 lost completion response requires downstream idempotency on retry',async()=>{
  let sideEffects=0;const c=await claim('crash');sideEffects++; // simulated callback committed, worker died before complete
  await expire('crash');await runStripeWebhookEffect({...input('crash'),execute:async()=>({ok:true,n:++sideEffects})},deps);
  assert.equal(c.attempt,1);assert.equal(sideEffects,2,'Lease is not an exactly-once external-effect guarantee');
});
for(const role of ['anon','authenticated'])test(`Q5 ${role} has no table read or RPC execute`,async()=>{
  await db.exec(`SET ROLE ${role}`);
  try{
    await assert.rejects(db.query('SELECT * FROM velmere_webhook_private.effects'));
    await assert.rejects(db.query('SELECT public.velmere_claim_stripe_webhook_effect($1,$2,$3,$4,$5)', ['event','type','effect',randomUUID(),300]));
    await assert.rejects(db.query('SELECT public.velmere_complete_stripe_webhook_effect($1,$2,$3,$4,$5)', ['event','effect',1,randomUUID(),'{}']));
  }finally{await db.exec('RESET ROLE');}
});
test('Q5 all functions stay invoker with pinned search path; table RLS is forced',async()=>{
  const rows=await db.query<{prosecdef:boolean;proconfig:string[]}>('SELECT prosecdef,proconfig FROM pg_proc WHERE pronamespace IN (\'public\'::regnamespace,\'velmere_webhook_private\'::regnamespace) AND proname LIKE \'%effect%\'');
  assert.equal(rows.rows.length,5);for(const row of rows.rows){assert.equal(row.prosecdef,false);assert.deepEqual(row.proconfig,['search_path=pg_catalog']);}
  const r=await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='velmere_webhook_private.effects'::regclass");
  assert.equal(r.rows[0].relrowsecurity,true);assert.equal(r.rows[0].relforcerowsecurity,true);
});
test('Q5 reinstall is refused instead of overwriting active records',async()=>{
  await assert.rejects(db.exec(sql),/EXISTING_EFFECT_OBJECTS_REQUIRE_REVIEW/);await db.exec('ROLLBACK');
  assert.equal((await state('replay')).status,'completed');
});

async function seedGrant(id:string){
  const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
  const args={p_id:id,p_stripe_session_id:'cs_test_'+id,p_stripe_customer_id:null,p_product_id:'vlm_pro_analysis_single',
    p_access_scope:'vlm_pro_analysis',p_context_hash:hash('ctx:'+id),
    p_context:{surface:'shield',locale:'en',depth:'pro',accountIdHash:hash('account:'+id)},p_locale:'en',p_amount_total:1000,
    p_currency:'EUR',p_customer_email:null,p_customer_name:null,p_payment_status:'paid',p_source:'stripe_webhook',
    p_audit_queue_id:null,p_expires_at:'2099-01-01T00:00:00Z',p_created_at:'2026-01-01T00:00:00Z'};
  const r=await db.query<{data:{ok:boolean}}>(`SELECT public.velmere_create_or_read_vlm_paid_entitlement(${Object.keys(args).map((k,i)=>`${k} => $${i+1}`).join(',')}) AS data`,Object.values(args));
  assert.equal(r.rows[0].data.ok,true);
}
test('Q5 effect + Q4 lifecycle: crash between refund and completion retries without a second transition',async()=>{
  const id='q5_crash_grant';await seedGrant(id);let callbackCount=0;
  const args={...input('joined'),execute:async()=>{callbackCount++;return applyVlmPaidEntitlementLifecycleEvent({
    entitlementId:id,eventId:'evt_joined_refund',event:'refund',sourceEventId:'evt_joined_refund',dependencies:{rpc:storage.rpc}});}};
  await assert.rejects(runStripeWebhookEffect(args,{...deps,complete:async()=>{throw Error('injected_lost_completion');}}),/injected_lost_completion/);
  assert.equal((await db.query<{status:string}>('SELECT status FROM public.velmere_vlm_paid_entitlements WHERE id=$1',[id])).rows[0].status,'refunded');
  assert.equal((await state('joined')).status,'processing');await expire('joined');
  const r=await runStripeWebhookEffect(args,deps);assert.equal(r.attempt,2);assert.equal(r.receipt.ok,true);
  if(r.receipt.ok)assert.equal(r.receipt.idempotent,true);
  const n=await db.query<{n:number}>('SELECT count(*)::int AS n FROM velmere_billing_private.lifecycle_events WHERE entitlement_id=$1',[id]);
  assert.equal(callbackCount,2);assert.equal(n.rows[0].n,1);assert.equal((await state('joined')).status,'completed');
  await runStripeWebhookEffect(args,deps);assert.equal(callbackCount,2);
});
test('Q5 completed effect replay does not undo a later chargeback',async()=>{
  const id='q5_newer_grant';await seedGrant(id);const args={...input('newer'),execute:()=>applyVlmPaidEntitlementLifecycleEvent({
    entitlementId:id,eventId:'evt_old_refund',event:'refund',dependencies:{rpc:storage.rpc}})};
  await runStripeWebhookEffect(args,deps);
  const revoked=await applyVlmPaidEntitlementLifecycleEvent({entitlementId:id,eventId:'evt_new_dispute',event:'chargeback',dependencies:{rpc:storage.rpc}});
  assert.equal(revoked.ok,true);const replay=await runStripeWebhookEffect(args,deps);assert.equal(replay.source,'replayed');
  assert.equal((await db.query<{status:string}>('SELECT status FROM public.velmere_vlm_paid_entitlements WHERE id=$1',[id])).rows[0].status,'revoked');
});
test('Q5 development memory store also uses unambiguous tuple identity',async()=>{
  const config=[process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY];
  delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try{
    const a=await claimStripeWebhookEffect({eventId:'evt:q5memory',eventType:'charge.refunded',effectKey:'refund'});
    const b=await claimStripeWebhookEffect({eventId:'evt',eventType:'charge.refunded',effectKey:'q5memory:refund'});
    assert.equal(a.kind,'claimed');assert.equal(b.kind,'claimed');
  }finally{if(config[0]!==undefined)process.env.SUPABASE_URL=config[0];if(config[1]!==undefined)process.env.SUPABASE_SERVICE_ROLE_KEY=config[1];}
});
