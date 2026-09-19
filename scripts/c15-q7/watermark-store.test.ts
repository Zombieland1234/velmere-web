import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { buildPaymentEventWatermark, type PaymentEventKind } from '../../lib/payments/stripe-webhook-state';
import { parsePaymentWatermarkReceipt, type PaymentWatermarkInput } from '../../lib/payments/payment-watermark-contract';
const db=new PGlite();
const sql=readFileSync(new URL('./watermark-store.sql',import.meta.url),'utf8');
before(async()=>{await db.exec(readFileSync(new URL('../c15-q4/bootstrap-roles.sql',import.meta.url),'utf8'));await db.exec("SET velmere.disposable_watermark_store='ISOLATED_TEST_ONLY'");await db.exec(sql);});
after(()=>db.close());
const mark=(id:string,kind:PaymentEventKind='refund',t=100):PaymentWatermarkInput=>({subjectKey:'subject:'+id,eventId:'evt:'+id,eventCreatedAt:t,kind});
async function apply(input:PaymentWatermarkInput,override:Record<string,unknown>={}){
 const w=buildPaymentEventWatermark(input);
 const args={p_subject_key:w.subjectKey,p_event_id:w.eventId,p_event_created_at:w.eventCreatedAt,p_event_kind:w.kind,p_event_priority:w.priority,p_terminal:w.terminal,...override};
 const result=await db.query<{data:unknown}>(`SELECT public.velmere_apply_payment_event_watermark(${Object.keys(args).map((key,i)=>`${key} => $${i+1}`).join(',')}) AS data`,Object.values(args));
 return parsePaymentWatermarkReceipt(result.rows[0].data,input);
}
const ranks={payment_pending:10,payment_failed:20,checkout_completed:40,partial_refund:60,refund:80,chargeback:100} as const;
for(const current of Object.keys(ranks) as PaymentEventKind[])for(const next of Object.keys(ranks) as PaymentEventKind[]){
 test(`Q7 SQL policy ${current} -> ${next}, older/equal/newer times`,async()=>{
  // Independent expected table/rule. Three times within one policy-cell test, not three extra cases.
  for(const time of [99,100,101]){
   const first=mark(`${current}:${next}:${time}`,current);await apply(first);
   const incoming={...first,eventId:first.eventId+':next',kind:next,eventCreatedAt:time};
   const r=await apply(incoming);const terminal=current==='refund'||current==='chargeback';
   const accepted=ranks[next]>ranks[current]||(ranks[next]===ranks[current]&&time>100);
   const reason=accepted?(ranks[next]>ranks[current]?'higher_priority':'same_priority_newer'):
    ranks[next]<ranks[current]?(terminal?'terminal_state_dominates':'lower_priority'):'older_same_priority';
   assert.equal(r.accepted,accepted);assert.equal(r.reason,reason);
   assert.equal(r.next.eventId,accepted?incoming.eventId:first.eventId);
  }
 });
}
test('Q7 duplicate is explicit and old replay cannot replace chargeback',async()=>{
 const x=mark('duplicates');await apply(x);assert.equal((await apply(x)).reason,'duplicate_event');
 await apply({...x,eventId:'evt:cb',kind:'chargeback'});
 const repeated=await apply(x);assert.equal(repeated.reason,'terminal_state_dominates');assert.equal(repeated.next.kind,'chargeback');
});
test('Q7 same-second same-priority events are not lexicographically reordered',async()=>{
 const x=mark('ties');await apply(x);
 assert.equal((await apply({...x,eventId:'evt:z_tie'})).reason,'older_same_priority');
});
test('Q7 event identity remains bound after its watermark was superseded',async()=>{
 const x=mark('binding');await apply(x);await apply({...x,eventId:'evt:binding_next',kind:'chargeback'});
 for(const change of [{subjectKey:'other'},{kind:'checkout_completed' as const},{eventCreatedAt:101}]){
  await assert.rejects(apply({...x,...change}),/PAYMENT_EVENT_IDENTITY_CONFLICT/);
 }
});
test('Q7 SQL derives priority and terminal semantics instead of trusting parameters',async()=>{
 for(const override of [{p_event_priority:1},{p_event_priority:null},{p_terminal:false},{p_terminal:null},{p_event_kind:'unknown'}]){
  await assert.rejects(apply(mark('bad_parameters'),override),/INVALID_PAYMENT_WATERMARK/);
 }
 const count=(await db.query<{n:number}>("SELECT count(*)::int n FROM velmere_payment_private.event_identities WHERE event_id='evt:bad_parameters'")).rows[0].n;
 assert.equal(count,0);
});
test('Q7 SQL validates whitespace, bounds and timestamp before writes',async()=>{
 for(const override of [{p_subject_key:''},{p_subject_key:'subject\n'},{p_event_id:'evt\r'},{p_event_created_at:-1},{p_event_created_at:253402300800},{p_event_created_at:null}]){
  await assert.rejects(apply(mark('bad_input'),override),/INVALID_PAYMENT_WATERMARK/);
 }
});
test('Q7 caller rollback leaves both identity and watermark absent',async()=>{
 await db.exec('BEGIN');await apply(mark('rollback'));await db.exec('ROLLBACK');
 const r=(await db.query<{n:number}>("SELECT count(*)::int n FROM velmere_payment_private.event_identities WHERE event_id='evt:rollback'")).rows[0];assert.equal(r.n,0);
 assert.equal((await apply(mark('rollback'))).reason,'first_event');
});
test('Q7 failed watermark write rolls back new identity insertion',async()=>{
 await db.exec("CREATE FUNCTION public.q7_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'TEST_WRITE_FAILURE'; END$$; CREATE TRIGGER q7_test_failure BEFORE INSERT ON velmere_payment_private.event_watermarks FOR EACH ROW EXECUTE FUNCTION public.q7_test_failure()");
 await assert.rejects(apply(mark('write_failure')),/TEST_WRITE_FAILURE/);
 assert.equal((await db.query<{n:number}>("SELECT count(*)::int n FROM velmere_payment_private.event_identities WHERE event_id='evt:write_failure'")).rows[0].n,0);
 await db.exec('DROP TRIGGER q7_test_failure ON velmere_payment_private.event_watermarks; DROP FUNCTION public.q7_test_failure()');
 assert.equal((await apply(mark('write_failure'))).reason,'first_event');
});
test('Q7 invoker and forced RLS do not grant client roles RPC or table access',async()=>{
 const r=(await db.query<{prosecdef:boolean;proconfig:string[]}>("SELECT prosecdef,proconfig FROM pg_proc WHERE proname='velmere_apply_payment_event_watermark'")).rows[0];
 assert.equal(r.prosecdef,false);assert.ok(r.proconfig.includes('search_path=pg_catalog'));
 const rows=(await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='velmere_payment_private'::regnamespace AND relkind='r'")).rows;
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
 for(const role of ['anon','authenticated']){
  await db.exec(`SET ROLE ${role}`);
  try{await assert.rejects(apply(mark('acl')),/permission denied/);await assert.rejects(db.query('SELECT * FROM velmere_payment_private.event_watermarks'),/permission denied/);}
  finally{await db.exec('RESET ROLE');}
 }
});
test('Q7 service role can use invoker RPC but cannot rewrite event identities',async()=>{
 await db.exec('SET ROLE service_role');try{
  assert.equal((await apply(mark('service'))).accepted,true);
  await assert.rejects(db.query("UPDATE velmere_payment_private.event_identities SET event_kind='chargeback' WHERE event_id='evt:service'"),/permission denied/);
  await assert.rejects(db.query('DELETE FROM velmere_payment_private.event_watermarks'),/permission denied/);
 }finally{await db.exec('RESET ROLE');}
});
test('Q7 installation refuses existing objects',async()=>{
 await assert.rejects(db.exec(sql),/EXISTING_WATERMARK_OBJECTS_REQUIRE_REVIEW/);await db.exec('ROLLBACK');
});
test('Q7 installation requires disposable-environment acknowledgement',async()=>{
 const other=new PGlite();try{await other.exec(readFileSync(new URL('../c15-q4/bootstrap-roles.sql',import.meta.url),'utf8'));await assert.rejects(other.exec(sql),/DISPOSABLE_WATERMARK_STORE_ACK_REQUIRED/);}finally{await other.close();}
});
