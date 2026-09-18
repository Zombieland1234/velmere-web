import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWebhookEventClaim, assertWebhookEventSettlement, validateWebhookEvent,
  validateWebhookSettlement } from '../../lib/payments/stripe-webhook-event-contract';
const input={eventId:'evt_q6_contract',eventType:'charge.refunded',eventCreatedAt:1770000000};
const row={claimed:true,status:'processing',attempt_count:1,event_id:input.eventId,event_type:input.eventType,event_created_at:input.eventCreatedAt,retry_after_seconds:0};
for (const [label,data] of [
  ['null',null],['empty object',{}],['ambiguous rows',[row,row]],['empty rows',[]],
  ['truthy flag',{...row,claimed:'false'}],['missing attempt',{...row,attempt_count:undefined}],
  ['fractional attempt',{...row,attempt_count:1.5}],['string attempt',{...row,attempt_count:'1'}],
  ['overflow attempt',{...row,attempt_count:2147483648}],['different event',{...row,event_id:'evt_other'}],
  ['different type',{...row,event_type:'charge.dispute.created'}],['different timestamp',{...row,event_created_at:0}],
  ['wrong acquired status',{...row,status:'processed'}],['busy without retry',{...row,claimed:false}],
  ['out of budget retry',{...row,claimed:false,retry_after_seconds:3601}],
  ['terminal with retry',{...row,claimed:false,status:'processed',retry_after_seconds:1}],
] as const) test(`Q6 event claim rejects ${label}`,()=>assert.throws(()=>parseWebhookEventClaim(data,input)));
for (const data of [row,[row]]) test(`Q6 accepts one explicit claimed result ${Array.isArray(data)?'row array':'object'}`,()=>{
  assert.deepEqual(parseWebhookEventClaim(data,input),{claimed:true,status:'processing',attempt:1});
});
for(const status of ['processed','dead_letter'] as const)test(`Q6 accepts explicit ${status} replay`,()=>{
  assert.deepEqual(parseWebhookEventClaim({...row,claimed:false,status},input),{claimed:false,status,attempt:1});
});
test('Q6 busy claim preserves exact attempt and bounded retry',()=>assert.deepEqual(
  parseWebhookEventClaim({...row,claimed:false,attempt_count:4,retry_after_seconds:6},input),
  {claimed:false,status:'processing',attempt:4,retryAfterSeconds:6}));
const done={eventId:input.eventId,eventType:input.eventType,expectedAttempt:1,status:'processed' as const};
const receipt={applied:true,idempotent:false,event_id:input.eventId,event_type:input.eventType,attempt_count:1,status:'processed'};
test('Q6 completion permits only a bound explicit receipt or its idempotent replay',()=>{
 assert.doesNotThrow(()=>assertWebhookEventSettlement(receipt,done));
 assert.doesNotThrow(()=>assertWebhookEventSettlement([{...receipt,idempotent:true}],done));
 for(const bad of [true,{},[receipt,receipt],{...receipt,applied:false},{...receipt,event_id:'other'},
  {...receipt,event_type:'other'},{...receipt,attempt_count:2},{...receipt,status:'dead_letter'},
  {...receipt,idempotent:undefined}])assert.throws(()=>assertWebhookEventSettlement(bad,done));
});
test('Q6 input validation never truncates identities or rounds attempts',()=>{
 for(const eventId of ['', ' spaced ', 'a'.repeat(181),'a\nb'])assert.throws(()=>validateWebhookEvent({...input,eventId}));
 for(const eventCreatedAt of [-1,1.5,NaN,Infinity,253402300800])assert.throws(()=>validateWebhookEvent({...input,eventCreatedAt}));
 for(const expectedAttempt of [0,-1,1.5,NaN,Infinity,2147483648])assert.throws(()=>validateWebhookSettlement({...done,expectedAttempt}));
});
