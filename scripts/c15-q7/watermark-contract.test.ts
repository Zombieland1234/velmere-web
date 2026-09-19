import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { applyPaymentEventWatermark } from '../../lib/db/order-service';
import { assertPaymentWatermarkInput, parsePaymentWatermarkReceipt, type PaymentWatermarkInput } from '../../lib/payments/payment-watermark-contract';
import { buildPaymentEventWatermark, decidePaymentEventOrdering } from '../../lib/payments/stripe-webhook-state';
const input: PaymentWatermarkInput={subjectKey:'stripe:payment_intent:pi_local',eventId:'evt_local',eventCreatedAt:1700000000,kind:'refund'};
const incoming=buildPaymentEventWatermark(input);
const receipt={schema:'velmere.payment-watermark.v1',ok:true,accepted:true,reason:'first_event',request:incoming,previous:null,current:incoming};
for(const [name,change] of [
 ['truthy string',{accepted:'false'}],['missing decision',{accepted:undefined}],['unknown reason',{reason:'anything'}],
 ['missing ok',{ok:undefined}],['wrong version',{schema:'unknown'}],['negative response',{ok:false}],
 ['claimed duplicate',{reason:'duplicate_event'}],['wrong incoming identity',{request:{...incoming,eventId:'evt_other'}}],
 ['wrong incoming kind',{request:{...incoming,kind:'chargeback',priority:100}}],
 ['fabricated priority',{current:{...incoming,priority:1}}],['fabricated terminal flag',{current:{...incoming,terminal:false}}],
 ['wrong current subject',{current:{...incoming,subjectKey:'stripe:payment_intent:pi_other'}}],
 ['unrelated previous',{previous:{...incoming,subjectKey:'stripe:payment_intent:pi_other'}}],
 ['duplicate with conflicting metadata',{previous:{...incoming,eventCreatedAt:input.eventCreatedAt-1}}],
 ['first without empty previous',{previous:incoming}],['missing current',{current:undefined}],
 ['decision inconsistent with state',{accepted:false}],['extra field',{unexpected:true}],
] as const)test(`Q7 watermark receipt refuses ${name}`,()=>assert.throws(()=>parsePaymentWatermarkReceipt({...receipt,...change},input)));
for(const [name,data] of [['null',null],['empty',[]],['ambiguous',[receipt,receipt]],['nested',[[receipt]]],['primitive',true]] as const)
 test(`Q7 watermark receipt refuses ${name} envelope`,()=>assert.throws(()=>parsePaymentWatermarkReceipt(data,input)));
test('Q7 explicit scalar and single-row first receipt agree',()=>{
 for(const data of [receipt,[receipt]])assert.deepEqual(parsePaymentWatermarkReceipt(data,input),{accepted:true,reason:'first_event',next:incoming,currentEventId:input.eventId,currentKind:input.kind});
});
test('Q7 rejected receipt returns actual current state, not incoming refund',()=>{
 const previous=buildPaymentEventWatermark({...input,eventId:'evt_chargeback',kind:'chargeback'});
 const r=parsePaymentWatermarkReceipt({...receipt,accepted:false,reason:'terminal_state_dominates',previous,current:previous},input);
 assert.deepEqual(r.next,previous);assert.equal(r.currentEventId,'evt_chargeback');assert.equal(r.accepted,false);
});
test('Q7 duplicate retains exact identity and explicit rejected status',()=>{
 const r=parsePaymentWatermarkReceipt({...receipt,accepted:false,reason:'duplicate_event',previous:incoming},input);
 assert.equal(r.accepted,false);assert.equal(r.reason,'duplicate_event');assert.deepEqual(r.next,incoming);
});
test('Q7 input IDs, timestamp and kind are validated without coercion',()=>{
 for(const change of [{eventId:''},{subjectKey:''},{subjectKey:'x'.repeat(513)},{eventId:'x'.repeat(181)},
   {eventId:'evt\n'},{subjectKey:'s\r'},{eventCreatedAt:'1700000000'},{eventCreatedAt:NaN},
   {eventCreatedAt:1.5},{eventCreatedAt:253402300800},{eventCreatedAt:-1},{kind:'toString'}]){
  assert.throws(()=>assertPaymentWatermarkInput({...input,...change} as PaymentWatermarkInput));
 }
});
test('Q7 development watermark identity cannot move between subjects',async()=>{
 const prior={url:process.env.SUPABASE_URL,pub:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
 delete process.env.SUPABASE_URL;delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 try {
  const e={...input,eventId:'evt_'+randomUUID(),subjectKey:'subject_'+randomUUID()};
  const first=await applyPaymentEventWatermark(e);assert.equal(first.accepted,true);
  await assert.rejects(applyPaymentEventWatermark({...e,subjectKey:e.subjectKey+'_other'}),/identity_conflict/);
  const repeat=await applyPaymentEventWatermark(e);assert.equal(repeat.reason,'duplicate_event');
 }finally{for(const [k,v] of [['SUPABASE_URL',prior.url],['NEXT_PUBLIC_SUPABASE_URL',prior.pub],['SUPABASE_SERVICE_ROLE_KEY',prior.key]] as const){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('Q7 completed policy remains the existing priority policy for valid receipts',()=>{
 for(const kind of ['payment_pending','payment_failed','checkout_completed','partial_refund','refund','chargeback'] as const){
  const previous=buildPaymentEventWatermark({...input,eventId:'evt_previous',kind});
  const expected=decidePaymentEventOrdering(previous,incoming);
  const parsed=parsePaymentWatermarkReceipt({...receipt,accepted:expected.accepted,reason:expected.reason,current:expected.next,previous},input);
  assert.equal(parsed.reason,expected.reason);
 }
});
