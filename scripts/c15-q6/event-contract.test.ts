import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertStripeWebhookEventIdentity, assertStripeWebhookEventSettlement, parseStripeWebhookEventClaim, assertStripeWebhookEventReceipt } from '../../lib/payments/stripe-webhook-event-contract';
const input={eventId:'evt_q6_contract',eventType:'charge.refunded',eventCreatedAt:1700000000};
const reply={claimed:true,status:'processing',attempt_count:1,retry_after_seconds:0,event_id:input.eventId,event_type:input.eventType,event_created_at:input.eventCreatedAt};
for(const [label,change] of [
 ['missing claimed',{claimed:undefined}],['truthy string',{claimed:'false'}],['unknown state',{status:'other'}],
 ['missing attempt',{attempt_count:undefined}],['string attempt',{attempt_count:'1'}],['fractional attempt',{attempt_count:1.5}],
 ['zero attempt',{attempt_count:0}],['overflow attempt',{attempt_count:2147483648}],['infinite attempt',{attempt_count:Infinity}],
 ['wrong event',{event_id:'evt_q6_other'}],['wrong type',{event_type:'charge.dispute.created'}],['wrong timestamp',{event_created_at:1700000001}],
 ['string timestamp',{event_created_at:'1700000000'}],['negative delay',{retry_after_seconds:-1}],['huge delay',{retry_after_seconds:3601}],
 ['non-integer delay',{retry_after_seconds:0.5}],['claimed terminal',{status:'processed'}],['claimed with wait',{retry_after_seconds:1}],
 ['busy without wait',{claimed:false}],['unclaimed retryable',{claimed:false,status:'retryable_failed'}],
] as const){test(`Q6 event receipt rejects ${label}`,()=>assert.throws(()=>parseStripeWebhookEventClaim({...reply,...change},input)));}
for(const [label,data] of [['empty array',[]],['two rows',[reply,reply]],['null',null],['nested',[[reply]]]] as const){test(`Q6 event receipt rejects ${label}`,()=>assert.throws(()=>parseStripeWebhookEventClaim(data,input)));}
test('Q6 accepts explicit bound claim as scalar and one row',()=>{
 for(const r of [reply,[reply]])assert.deepEqual(parseStripeWebhookEventClaim(r,input),{claimed:true,status:'processing',attempt:1});
});
test('Q6 busy and terminal responses retain their exact meaning',()=>{
 assert.deepEqual(parseStripeWebhookEventClaim({...reply,claimed:false,retry_after_seconds:19},input),{claimed:false,status:'processing',attempt:1,retryAfterSeconds:19});
 for(const status of ['processed','dead_letter']) assert.deepEqual(parseStripeWebhookEventClaim({...reply,claimed:false,status},input),{claimed:false,status,attempt:1});
});
for(const bad of [0,-1,1.2,NaN,Infinity,2147483648])test(`Q6 never normalizes invalid attempt ${String(bad)}`,()=>assert.throws(()=>assertStripeWebhookEventSettlement({...input,status:'processed',expectedAttempt:bad})));
test('Q6 malformed identity is rejected before any storage call',()=>{
 for(const change of [{eventId:''},{eventId:'a'.repeat(181)},{eventId:' evt '},{eventType:'bad\nvalue'},{eventCreatedAt:0.5},{eventCreatedAt:-1},{eventCreatedAt:Infinity}])assert.throws(()=>assertStripeWebhookEventIdentity({...input,...change}));
});
test('Q6 completed receipt is bound to the exact event attempt and state',()=>{
 const expected={...input,status:'processed' as const,expectedAttempt:2};const data={ok:true,event_id:input.eventId,event_type:input.eventType,attempt_count:2,status:'processed'};
 assertStripeWebhookEventReceipt(data,expected);
 for(const change of [{ok:'true'},{event_id:'evt_other'},{event_type:'other'},{attempt_count:1},{status:'dead_letter'}])assert.throws(()=>assertStripeWebhookEventReceipt({...data,...change},expected));
});
test('Q6 error identity is bounded and never attached to a processed event',()=>{
 assertStripeWebhookEventSettlement({...input,expectedAttempt:1,status:'retryable_failed',errorCode:'provider_failed'});
 for(const errorCode of ['', 'message with secret', 'a'.repeat(161)])assert.throws(()=>assertStripeWebhookEventSettlement({...input,expectedAttempt:1,status:'retryable_failed',errorCode}));
 assert.throws(()=>assertStripeWebhookEventSettlement({...input,expectedAttempt:1,status:'processed',errorCode:'wrong'}));
});
