import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { applyPaymentEventWatermark } from '../../lib/db/order-service';
import { buildPaymentEventWatermark, decidePaymentEventOrdering, type PaymentEventWatermark } from '../../lib/payments/stripe-webhook-state';

const input = { subjectKey: 'stripe:payment_intent:pi_q7_test', eventId: 'evt_q7_test', eventCreatedAt: 1700000000, kind: 'refund' as const };
const originalFetch=globalThis.fetch;
const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY, node:process.env.NODE_ENV,vercel:process.env.VERCEL_ENV};
let reply: unknown; let calls=0;
before(()=>{
 process.env.SUPABASE_URL='https://q7-controlled-transport.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');
 globalThis.fetch=async(url)=>{assert.equal(new URL(String(url)).origin,'https://q7-controlled-transport.invalid');calls++;return new Response(JSON.stringify(reply),{headers:{'content-type':'application/json'}});};
});
after(()=>{globalThis.fetch=originalFetch;for(const[k,v]of Object.entries({SUPABASE_URL:saved.url,SUPABASE_SERVICE_ROLE_KEY:saved.key,NODE_ENV:saved.node,VERCEL_ENV:saved.vercel})){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
function receipt(previous:PaymentEventWatermark|null=null){const incoming=buildPaymentEventWatermark(input),d=decidePaymentEventOrdering(previous,incoming);return {
 schema_version:'velmere.payment-watermark.v1',ok:true,accepted:d.accepted,reason:d.reason,
 subject_key:input.subjectKey,event_id:input.eventId,event_kind:input.kind,event_created_at:input.eventCreatedAt,
 previous,current:d.next,current_event_id:d.next.eventId,current_kind:d.next.kind,
};}
test('Q7 actual entrypoint accepts explicit first-event receipt',async()=>{reply=receipt();const r=await applyPaymentEventWatermark(input);assert.equal(r.accepted,true);assert.equal(r.reason,'first_event');assert.deepEqual(r.next,buildPaymentEventWatermark(input));});
test('Q7 actual entrypoint accepts exactly one row',async()=>{reply=[receipt()];assert.equal((await applyPaymentEventWatermark(input)).accepted,true);});
test('Q7 rejected refund returns stored chargeback, not incoming refund',async()=>{
 const current=buildPaymentEventWatermark({...input,eventId:'evt_q7_chargeback',kind:'chargeback'});reply=receipt(current);
 const r=await applyPaymentEventWatermark(input);assert.equal(r.accepted,false);assert.equal(r.reason,'terminal_state_dominates');assert.deepEqual(r.next,current);
});
const invalid: [string,()=>unknown][] = [
 ['string false',()=>({...receipt(),accepted:'false'})],['numeric accepted',()=>({...receipt(),accepted:1})],
 ['missing accepted',()=>{const x:Record<string,unknown>=receipt();delete x.accepted;return x;}],
 ['missing ok',()=>{const x:Record<string,unknown>=receipt();delete x.ok;return x;}],
 ['false ok',()=>({...receipt(),ok:false})],['unknown reason',()=>({...receipt(),reason:'maybe'})],
 ['wrong policy reason',()=>({...receipt(),reason:'higher_priority'})],['wrong decision',()=>({...receipt(),accepted:false})],
 ['foreign subject',()=>({...receipt(),subject_key:'stripe:payment_intent:other'})],['foreign event',()=>({...receipt(),event_id:'evt_other'})],
 ['wrong event time',()=>({...receipt(),event_created_at:1700000001})],['wrong event kind',()=>({...receipt(),event_kind:'chargeback'})],
 ['two rows',()=>[receipt(),receipt()]],['empty rows',()=>[]],['null',()=>null],
 ['missing previous',()=>{const x:Record<string,unknown>=receipt();delete x.previous;return x;}],
 ['wrong current identity',()=>({...receipt(),current:{...receipt().current,eventId:'evt_other'}})],
 ['wrong priority',()=>({...receipt(),current:{...receipt().current,priority:100}})],
 ['wrong terminal bit',()=>({...receipt(),current:{...receipt().current,terminal:false}})],
 ['same event mutated',()=>({...receipt(),previous:buildPaymentEventWatermark({...input,eventCreatedAt:1699999999})})],
];
for(const[label,value]of invalid)test(`Q7 actual entrypoint refuses ${label}`,async()=>{reply=value();await assert.rejects(applyPaymentEventWatermark(input));});
test('Q7 invalid caller identity is rejected before transport',async()=>{
 const mark=calls;reply=receipt();for(const eventId of ['', 'a'.repeat(181), 'evt whitespace'])await assert.rejects(applyPaymentEventWatermark({...input,eventId}));assert.equal(calls,mark);
});
test('Q7 development path binds seen event identity across subjects and newer events',async()=>{
 delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;Object.assign(process.env,{NODE_ENV:'test'});delete process.env.VERCEL_ENV;
 try{const x={...input,eventId:'evt_q7_memory',subjectKey:'memory:q7'};await applyPaymentEventWatermark(x);
 await applyPaymentEventWatermark({...x,eventId:'evt_q7_memory_new',kind:'chargeback'});
 await assert.rejects(applyPaymentEventWatermark({...x,subjectKey:'memory:other'}));await assert.rejects(applyPaymentEventWatermark({...x,eventCreatedAt:1700000001}));
 assert.equal((await applyPaymentEventWatermark(x)).reason,'terminal_state_dominates');
 }finally{process.env.SUPABASE_URL='https://q7-controlled-transport.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');}
});
