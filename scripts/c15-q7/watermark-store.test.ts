import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { applyPaymentEventWatermark, type StripeWebhookEventStorageDependencies } from '../../lib/db/order-service';
import { buildPaymentEventWatermark, decidePaymentEventOrdering, type PaymentEventKind } from '../../lib/payments/stripe-webhook-state';
const db=new PGlite();const sql=readFileSync(new URL('./watermark-store.sql',import.meta.url),'utf8');
const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
before(async()=>{process.env.SUPABASE_URL='https://q7-no-network.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');
 await db.exec(readFileSync(new URL('../c15-q4/bootstrap-roles.sql',import.meta.url),'utf8'));
 await assert.rejects(db.exec(sql),/ACK_REQUIRED/);await db.exec('ROLLBACK');await db.exec("SET velmere.disposable_watermark_store='ISOLATED_TEST_ONLY'");await db.exec(sql);
});
after(async()=>{await db.close();for(const[k,v]of Object.entries({SUPABASE_URL:saved.url,SUPABASE_SERVICE_ROLE_KEY:saved.key})){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
async function rpc(args:Record<string,unknown>){assert.ok(Object.keys(args).every(k=>/^p_[a-z_]+$/.test(k)));await db.exec('SET ROLE service_role');try{return(await db.query<{data:unknown}>(`SELECT public.velmere_apply_payment_event_watermark(${Object.keys(args).map((k,i)=>`${k}=>$${i+1}`).join(',')}) AS data`,Object.values(args))).rows[0].data;}finally{await db.exec('RESET ROLE');}}
const deps:StripeWebhookEventStorageDependencies={rpc:async input=>{assert.equal(input.operation,'payment_event_watermark_apply');return {data:await rpc(input.args??{}),receipt:{schemaVersion:'velmere.bounded-rpc-receipt.v1',operation:input.operation,capability:'service_role_write',durationMs:0,deadlineMs:3000,aborted:false,durableBoundary:'service_role'}};}};
let seq=0;const identity=(subject:string,kind:PaymentEventKind,time=1700000000)=>({subjectKey:subject,eventId:`evt_q7_sql_${++seq}`,kind,eventCreatedAt:time});
const apply=(input:ReturnType<typeof identity>)=>applyPaymentEventWatermark(input,deps);
const snapshot=async()=>({watermarks:(await db.query('SELECT * FROM public.velmere_payment_event_watermarks ORDER BY subject_key')).rows,identities:(await db.query('SELECT * FROM velmere_billing_private.payment_event_identities ORDER BY event_id')).rows});
test('Q7 SQL matches unchanged TypeScript priority policy across all 108 ordered pairs',async()=>{
 const kinds:PaymentEventKind[]=['payment_pending','payment_failed','checkout_completed','partial_refund','refund','chargeback'];
 for(const a of kinds)for(const b of kinds)for(const offset of [-1,0,1]){
  const first=identity(`matrix:${a}:${b}:${offset}`,a),next=identity(first.subjectKey,b,first.eventCreatedAt+offset);
  assert.equal((await apply(first)).reason,'first_event');const actual=await apply(next),expected=decidePaymentEventOrdering(buildPaymentEventWatermark(first),buildPaymentEventWatermark(next));
  assert.equal(actual.accepted,expected.accepted);assert.equal(actual.reason,expected.reason);assert.deepEqual(actual.next,expected.next);
 }
});
test('Q7 rejected and older identities cannot be replayed under another payment',async()=>{
 const first=identity('binding:one','chargeback');await apply(first);const lower=identity('binding:one','refund');await apply(lower);const before=await snapshot();
 for(const input of [{...first,subjectKey:'binding:two'},{...lower,kind:'chargeback' as const},{...lower,eventCreatedAt:1700000100}])await assert.rejects(apply(input));
 assert.deepEqual(await snapshot(),before);
});
test('Q7 same-event replay is duplicate; after stronger observation it uses current state',async()=>{
 const first=identity('replay:q7','refund');await apply(first);assert.equal((await apply(first)).reason,'duplicate_event');
 const chargeback=identity(first.subjectKey,'chargeback');await apply(chargeback);const r=await apply(first);assert.equal(r.reason,'terminal_state_dominates');assert.deepEqual(r.next,buildPaymentEventWatermark(chargeback));
});
test('Q7 caller cannot forge priority or terminal flag directly through SQL',async()=>{
 for(const [priority,terminal] of [[100,false],[10,true],[null,false]] as const){const x=identity('invalid:priority','payment_pending');await assert.rejects(rpc({p_subject_key:x.subjectKey,p_event_id:x.eventId,p_event_created_at:x.eventCreatedAt,p_event_kind:x.kind,p_event_priority:priority,p_terminal:terminal}));}
});
test('Q7 caller rollback removes both observed identity and watermark',async()=>{
 const before=await snapshot();await db.exec('BEGIN');await apply(identity('rollback:q7','refund'));await db.exec('ROLLBACK');assert.deepEqual(await snapshot(),before);
});
test('Q7 failed watermark write cannot leave a partial observed-event entry',async()=>{
 const first=identity('failure:q7','checkout_completed');await apply(first);const before=await snapshot();
 await db.exec("CREATE FUNCTION public.q7_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'q7_injected_failure'; END$$; CREATE TRIGGER q7_failure BEFORE UPDATE ON public.velmere_payment_event_watermarks FOR EACH ROW EXECUTE FUNCTION public.q7_failure()");
 await assert.rejects(apply(identity(first.subjectKey,'refund')));assert.deepEqual(await snapshot(),before);
 await db.exec('DROP TRIGGER q7_failure ON public.velmere_payment_event_watermarks; DROP FUNCTION public.q7_failure()');await apply(identity(first.subjectKey,'refund'));
});
test('Q7 observed watermark is not evidence of a completed external effect',async()=>{
 // Observation succeeds independently: no Q4 grant or Q5 effect is installed here.
 const x=identity('observation:not-completion','refund');assert.equal((await apply(x)).accepted,true);
 assert.equal((await db.query<{t:string|null}>("SELECT to_regclass('public.velmere_vlm_paid_entitlements')::text AS t")).rows[0].t,null);
});
test('Q7 role ACL, invoker and forced RLS remain explicit',async()=>{
 for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);try{
 await assert.rejects(db.query('SELECT * FROM public.velmere_payment_event_watermarks'));await assert.rejects(db.query("SELECT public.velmere_apply_payment_event_watermark('q7','evt_q7',1,'refund',80,true)"));
 }finally{await db.exec('RESET ROLE');}}
 const fn=(await db.query<{prosecdef:boolean;proconfig:string[]}>("SELECT prosecdef,proconfig FROM pg_proc WHERE proname='velmere_apply_payment_event_watermark'")).rows[0];assert.equal(fn.prosecdef,false);assert.deepEqual(fn.proconfig,['search_path=pg_catalog']);
 const rows=(await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('public.velmere_payment_event_watermarks'::regclass,'velmere_billing_private.payment_event_identities'::regclass)")).rows;
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
 await db.exec('SET ROLE service_role');try{await assert.rejects(db.query('DELETE FROM velmere_billing_private.payment_event_identities'));await assert.rejects(db.query("UPDATE velmere_billing_private.payment_event_identities SET kind='refund'"));}finally{await db.exec('RESET ROLE');}
});
test('Q7 reinstall refuses without changing existing state',async()=>{const before=await snapshot();await assert.rejects(db.exec(sql),/EXISTING_WATERMARK/);await db.exec('ROLLBACK');assert.deepEqual(await snapshot(),before);});
