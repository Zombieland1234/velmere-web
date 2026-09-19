import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {assertVlmTerminalHoldInput, parseVlmTerminalHoldReceipt, recordVlmTerminalPaymentHold,
  type VlmTerminalHoldInput} from '../../lib/payments/vlm-terminal-hold';
import {resolveVlmPaidEntitlementSessionWrite, type VlmPaidEntitlementRecord} from '../../lib/commerce/vlm-entitlement-ledger';

const input: VlmTerminalHoldInput={stripeSessionId:'cs_test_hold_parser',productId:'vlm_pro_analysis_single',contextHash:'a'.repeat(64),eventId:'evt_hold_parser',event:'refund',eventCreatedAt:1700000000};
const valid=()=>({schema:'velmere.vlm-terminal-hold.v1',ok:true,request:{...input},disposition:'held_before_grant',entitlementId:null,observedStatus:null});
for (const [label, value] of [
  ['null',null], ['empty',{}], ['no ok',{...valid(),ok:undefined}], ['text ok',{...valid(),ok:'true'}],
  ['two rows',[valid(),valid()]],['array empty',[]],['wrong schema',{...valid(),schema:'old'}],
  ['extra field',{...valid(),untrusted:true}],['unknown disposition',{...valid(),disposition:'active'}],
  ['held but id',{...valid(),entitlementId:'wrong'}],['held but status',{...valid(),observedStatus:'refunded'}],
  ['applied without id',{...valid(),disposition:'lifecycle_applied',observedStatus:'refunded'}],
  ['applied wrong status',{...valid(),disposition:'lifecycle_applied',entitlementId:'ent',observedStatus:'revoked'}],
  ['applied active',{...valid(),disposition:'lifecycle_applied',entitlementId:'ent',observedStatus:'active'}],
  ['request array',{...valid(),request:[input]}],['request extra',{...valid(),request:{...input,extra:1}}],
] as const) test(`Q8 terminal receipt rejects ${label}`,()=>assert.throws(()=>parseVlmTerminalHoldReceipt(value,input)));
for (const key of ['stripeSessionId','productId','contextHash','eventId','event','eventCreatedAt'] as const) {
  test(`Q8 receipt must match request ${key}`,()=>assert.throws(()=>parseVlmTerminalHoldReceipt({...valid(),request:{...input,[key]:key==='eventCreatedAt'?42:'different'}},input)));
}
test('Q8 receipt accepts one exact object or singleton row',()=>{
  assert.equal(parseVlmTerminalHoldReceipt(valid(),input).disposition,'held_before_grant');
  assert.deepEqual(parseVlmTerminalHoldReceipt([valid()],input),valid());
});
test('Q8 existing-race receipt is bound to the matching terminal transition',()=>{
  assert.equal(parseVlmTerminalHoldReceipt({...valid(),disposition:'lifecycle_applied',entitlementId:'ent_race',observedStatus:'refunded'},input).observedStatus,'refunded');
  assert.equal(parseVlmTerminalHoldReceipt({...valid(),request:{...input,event:'chargeback'},disposition:'lifecycle_applied',entitlementId:'ent_race',observedStatus:'revoked'},{...input,event:'chargeback'}).observedStatus,'revoked');
});
for (const [key,value] of [['stripeSessionId','x'.repeat(181)],['eventId','bad\nline'],['productId','unknown'],['contextHash','A'.repeat(64)],['event','partial_refund'],['eventCreatedAt',1.5],['eventCreatedAt',-1]] as const) {
  test(`Q8 input rejects ${key}:${String(value).slice(0,12)}`,()=>assert.throws(()=>assertVlmTerminalHoldInput({...input,[key]:value} as VlmTerminalHoldInput)));
}
const candidate: VlmPaidEntitlementRecord={id:'ent_first',stripeSessionId:input.stripeSessionId,productId:input.productId,accessScope:'vlm_pro_analysis',status:'active',contextHash:input.contextHash,context:{surface:'shield',locale:'en',depth:'pro',accountIdHash:'b'.repeat(64)},locale:'en',amountTotal:1000,currency:'EUR',source:'stripe_webhook',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z'};
test('Q8 explicit release hold blocks first creation as well as existing replay',()=>{
  for(const existing of [null,candidate]){const r=resolveVlmPaidEntitlementSessionWrite({existing,candidate,releaseHoldBlocked:true});assert.equal(r.ok,false);if(!r.ok)assert.equal(r.error,'entitlement_release_hold');}
});
test('Q8 absent explicit hold preserves the first-grant decision',()=>assert.equal(resolveVlmPaidEntitlementSessionWrite({existing:null,candidate}).ok,true));
const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
after(()=>{for(const [k,v] of [['SUPABASE_URL',saved.url],['SUPABASE_SERVICE_ROLE_KEY',saved.key]]){if(v===undefined)delete process.env[k!];else process.env[k!]=v;}});
test('Q8 terminal-hold client validates before RPC and binds exact request parameters',async()=>{
  process.env.SUPABASE_URL='https://q8-fixture.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');let calls=0;
  const dependencies:Parameters<typeof recordVlmTerminalPaymentHold>[1]={rpc:async args=>{calls++;assert.equal(args.operation,'vlm_terminal_hold_apply');assert.deepEqual(args.args,{p_stripe_session_id:input.stripeSessionId,p_product_id:input.productId,p_context_hash:input.contextHash,p_event_id:input.eventId,p_event_type:input.event,p_event_created_at:input.eventCreatedAt});return {data:valid(),receipt:{schemaVersion:'velmere.bounded-rpc-receipt.v1',operation:args.operation,capability:'service_role_write',durationMs:0,deadlineMs:4000,aborted:false,durableBoundary:'service_role'}};}};
  await assert.rejects(()=>recordVlmTerminalPaymentHold({...input,eventId:'x'.repeat(181)},dependencies));assert.equal(calls,0);
  assert.equal((await recordVlmTerminalPaymentHold(input,dependencies)).ok,true);assert.equal(calls,1);
});
