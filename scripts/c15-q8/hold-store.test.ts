import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import type {PGlite} from '@electric-sql/pglite';
import {database,sql,hash,create,hold,state,counts,request} from './test-helpers';
import {parseVlmTerminalHoldReceipt} from '../../lib/payments/vlm-terminal-hold';
let db:PGlite;
before(async()=>{db=await database();});after(async()=>{await db.close();});
for(const event of ['refund','chargeback'] as const) test(`Q8 SQL ${event} before grant prevents all later create/read calls`,async()=>{
  const name='first_'+event;const r=await hold(db,name,{p_event_type:event,p_event_id:request(name,event).eventId});
  assert.equal(parseVlmTerminalHoldReceipt(r,request(name,event)).disposition,'held_before_grant');assert.equal(await state(db,name),undefined);
  const blocked=await create(db,name);assert.equal(blocked.ok,false);assert.equal(blocked.error,'entitlement_release_hold');assert.equal(await state(db,name),undefined);
  assert.deepEqual(await counts(db,name),{holds:1,events:0});
});
test('Q8 hold replay returns one original receipt',async()=>{const name='replay';const first=await hold(db,name);assert.deepEqual(await hold(db,name),first);assert.deepEqual(await counts(db,name),{holds:1,events:0});});
for(const event of ['refund','chargeback'] as const)test(`Q8 ${event} handles grant appearing after the not-found lookup`,async()=>{
  const name='race_'+event;await create(db,name);const r=await hold(db,name,{p_event_type:event,p_event_id:request(name,event).eventId});
  assert.equal(r.disposition,'lifecycle_applied');assert.equal((await state(db,name)).status,event==='refund'?'refunded':'revoked');assert.deepEqual(await counts(db,name),{holds:1,events:1});
  assert.equal((await create(db,name)).ok,false);
});
test('Q8 later chargeback is not reverted by replay of a refund receipt',async()=>{
  const name='later_cb';await create(db,name);const first=await hold(db,name);await hold(db,name,{p_event_type:'chargeback',p_event_id:'evt_later_cb'});
  assert.deepEqual(await hold(db,name),first);assert.equal((await state(db,name)).status,'revoked');assert.deepEqual(await counts(db,name),{holds:2,events:2});
});
for(const terminal of ['refunded','revoked','consumed'] as const)test(`Q8 already ${terminal} is never restored or assigned an illegal transition`,async()=>{
  const name='already_'+terminal;await create(db,name);await db.query('UPDATE public.velmere_vlm_paid_entitlements SET status=$1 WHERE id=$2',[terminal,name]);
  const r=await hold(db,name);assert.equal(r.disposition,'already_terminal');assert.equal(r.observedStatus,terminal);assert.deepEqual(await counts(db,name),{holds:1,events:0});
});
test('Q8 identity collision cannot move a terminal hold to another session or context',async()=>{
  const name='identity';await hold(db,name);
  for(const change of [{p_stripe_session_id:'cs_test_other'},{p_product_id:'vlm_pro_pdf_single'},{p_context_hash:hash('other')},{p_event_type:'chargeback'},{p_event_created_at:1700000001}])await assert.rejects(()=>hold(db,name,change),/TERMINAL_HOLD_IDENTITY_CONFLICT/);
  assert.equal((await create(db,'unrelated')).ok,true);assert.deepEqual(await counts(db,name),{holds:1,events:0});
});
test('Q8 bound existing grant cannot be revoked under a different context',async()=>{
  const name='binding';await create(db,name);await assert.rejects(()=>hold(db,name,{p_context_hash:hash('wrong')}),/TERMINAL_HOLD_BINDING_CONFLICT/);assert.equal((await state(db,name)).status,'active');assert.deepEqual(await counts(db,name),{holds:0,events:0});
});
test('Q8 failed hold INSERT rolls back both lifecycle update and receipt',async()=>{
  const name='hold_fail';await create(db,name);await db.exec("ALTER TABLE velmere_billing_private.session_terminal_holds ADD CONSTRAINT injected_hold_error CHECK (event_id <> 'evt_hold_fail_refund')");
  await assert.rejects(()=>hold(db,name),/injected_hold_error/);assert.equal((await state(db,name)).status,'active');assert.deepEqual(await counts(db,name),{holds:0,events:0});
  await db.exec('ALTER TABLE velmere_billing_private.session_terminal_holds DROP CONSTRAINT injected_hold_error');assert.equal((await hold(db,name)).ok,true);
});
test('Q8 failed lifecycle journal INSERT cannot acknowledge a hold or refund',async()=>{
  const name='journal_fail';await create(db,name);await db.exec("ALTER TABLE velmere_billing_private.lifecycle_events ADD CONSTRAINT injected_journal_error CHECK (entitlement_id <> 'journal_fail')");
  await assert.rejects(()=>hold(db,name),/injected_journal_error/);assert.equal((await state(db,name)).status,'active');assert.deepEqual(await counts(db,name),{holds:0,events:0});
  await db.exec('ALTER TABLE velmere_billing_private.lifecycle_events DROP CONSTRAINT injected_journal_error');await hold(db,name);
});
test('Q8 outer ROLLBACK removes hold and lifecycle together',async()=>{
  const name='rollback';await create(db,name);await db.exec('BEGIN');await hold(db,name);await db.exec('ROLLBACK');assert.equal((await state(db,name)).status,'active');assert.deepEqual(await counts(db,name),{holds:0,events:0});
});
for(const role of ['anon','authenticated'])test(`Q8 ${role} has neither hold visibility nor execution`,async()=>{
  await db.exec(`SET ROLE ${role}`);try{await assert.rejects(()=>hold(db,'no_permissions'),/permission denied/);await assert.rejects(()=>db.query('SELECT * FROM velmere_billing_private.session_terminal_holds'),/permission denied/);}finally{await db.exec('RESET ROLE');}
});
test('Q8 service role cannot delete or edit historical holds',async()=>{
  await db.exec('SET ROLE service_role');try{await assert.rejects(()=>db.exec('DELETE FROM velmere_billing_private.session_terminal_holds'),/permission denied/);await assert.rejects(()=>db.exec("UPDATE velmere_billing_private.session_terminal_holds SET event_type='refund'"),/permission denied/);assert.equal((await hold(db,'service_ok')).ok,true);assert.equal((await create(db,'service_ok')).ok,false);}finally{await db.exec('RESET ROLE');}
});
test('Q8 force RLS and invoker privileges are retained',async()=>{
  const r=(await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='velmere_billing_private.session_terminal_holds'::regclass")).rows[0];assert.equal(r.relrowsecurity,true);assert.equal(r.relforcerowsecurity,true);
  const functions=(await db.query<{prosecdef:boolean;proconfig:string[]}>("SELECT prosecdef,proconfig FROM pg_proc WHERE proname IN ('velmere_create_or_read_vlm_paid_entitlement','velmere_record_vlm_terminal_payment_hold')")).rows;assert.equal(functions.length,3);for(const f of functions){assert.equal(f.prosecdef,false);assert.deepEqual(f.proconfig,['search_path=pg_catalog']);}
});
test('Q8 exact Q4 parity and reinstallation interlocks fail closed',async()=>{
  const other=await database(false);try{
    await assert.rejects(()=>other.exec(sql),/DISPOSABLE_TERMINAL_HOLD_ACK_REQUIRED/);await other.exec('ROLLBACK');
    await other.exec("SET velmere.disposable_terminal_hold_store='ISOLATED_TEST_ONLY'; ALTER FUNCTION public.velmere_apply_vlm_paid_entitlement_lifecycle_event(text,text,text,text,text,text,timestamptz) SET search_path=public");
    await assert.rejects(()=>other.exec(sql),/Q4_FUNCTION_PARITY_REVIEW_REQUIRED/);await other.exec('ROLLBACK');
  }finally{await other.close();}
  await assert.rejects(()=>db.exec(sql),/Q4_FUNCTION_PARITY_REVIEW_REQUIRED/);await db.exec('ROLLBACK');
});
for(const [label,value] of [['bad id','bad\n'],['oversized','x'.repeat(181)]])test(`Q8 SQL refuses ${label} without recording a hold`,async()=>{
  await assert.rejects(()=>hold(db,'invalid_'+label,{p_event_id:value}),/INVALID_TERMINAL_HOLD_INPUT/);
});
