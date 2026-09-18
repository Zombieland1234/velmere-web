import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { applyVlmPaidEntitlementLifecycleEvent, type VlmPaidEntitlementLifecycleEvent } from '../../lib/commerce/vlm-entitlement-lifecycle';
import type { runRegisteredServiceRoleRpc } from '../../lib/db/supabase-rpc-operation-registry';

// Actual lifecycle entry, controlled RPC responses. No network, customer rows or
// Stripe payment. Credentials are random fixture text, never real secrets.
const original = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
process.env.SUPABASE_URL = 'https://q2-fixture.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = randomBytes(24).toString('hex');
after(() => {
  for (const [key, value] of [['SUPABASE_URL', original.url], ['SUPABASE_SERVICE_ROLE_KEY', original.key]]) {
    if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  }
});
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const entitlementId = 'ent_q2_owned_alpha';
const eventId = 'evt_q2_refund_alpha';
function receipt(change: Record<string, unknown> = {}): Record<string, unknown> {
  return { ok: true, event_type: 'refund', previous_status: 'active', next_status: 'refunded', idempotent: false,
    entitlement_id_hash: hash(entitlementId), event_id_hash: hash(eventId), ...change };
}
async function apply(data: unknown, change: { entitlementId?: string; eventId?: string; event?: VlmPaidEntitlementLifecycleEvent } = {}) {
  let calls = 0;
  const rpc: typeof runRegisteredServiceRoleRpc = async () => {
    calls++;
    return { data, receipt: { schemaVersion: 'velmere.bounded-rpc-receipt.v1' as const, operation: 'vlm_paid_entitlement_lifecycle_apply', capability: 'service_role_write' as const, durationMs: 0, deadlineMs: 5000, aborted: false, durableBoundary: 'service_role' as const } };
  };
  const result = await applyVlmPaidEntitlementLifecycleEvent({ entitlementId, eventId, event: 'refund', ...change, dependencies: { rpc } });
  return { result, calls };
}
for (const [label, data] of [
  ['null',null], ['empty response',[]], ['multiple rows',[receipt(), receipt()]], ['primitive',42],
  ['missing success flag',receipt({ok:undefined})], ['string success flag',receipt({ok:'true'})],
  ['wrong entitlement',receipt({entitlement_id_hash:hash('ent_q2_other_account')})],
  ['wrong event identity',receipt({event_id_hash:hash('evt_q2_other_event')})],
  ['different operation',receipt({event_type:'restore',previous_status:'expired',next_status:'active'})],
  ['unknown previous status',receipt({previous_status:'surprise'})],
  ['unknown next status',receipt({next_status:'surprise'})],
  ['no refund transition',receipt({next_status:'active'})],
  ['revoked cannot restore',receipt({event_type:'restore',previous_status:'revoked',next_status:'active'})],
  ['nonboolean idempotence',receipt({idempotent:'false'})],
  ['absent idempotence',receipt({idempotent:undefined})],
  ['overlong digest',receipt({event_id_hash:hash(eventId)+'extra'})],
  ['padded status',receipt({previous_status:' active '})],
] as const) {
  test(`Q2 lifecycle rejects ${label}`, async () => {
    const {result,calls}=await apply(data);
    assert.equal(calls,1);
    assert.deepEqual(result,{ok:false,error:'invalid_lifecycle_rpc_result',retryable:true,ledgerMode:'durable'});
  });
}
for (const [label, data] of [['object',receipt()],['single row',[receipt()]],['replayed receipt',receipt({idempotent:true})]] as const) {
  test(`Q2 lifecycle accepts bound ${label}`,async()=>{const {result}=await apply(data);assert.equal(result.ok,true);});
}
test('Q2 lifecycle preserves structured server rejection',async()=>{
  const {result}=await apply({ok:false,error:'entitlement_not_found',retryable:false});
  assert.deepEqual(result,{ok:false,error:'entitlement_not_found',retryable:false,ledgerMode:'durable'});
});
test('Q2 lifecycle ambiguous rejection remains retryable',async()=>{
  const {result}=await apply({ok:false,error:'store_unavailable'});
  assert.equal(result.ok,false);if(!result.ok)assert.equal(result.retryable,true);
});
for (const key of ['entitlementId','eventId'] as const) {
  test(`Q2 lifecycle refuses overlong ${key} without truncating or writing`,async()=>{
    const {result,calls}=await apply(receipt(),{[key]:'x'.repeat(181)});
    assert.equal(result.ok,false);assert.equal(calls,0);
  });
}
for(const [event,from,to] of [
 ['expire','active','expired'],['expire','expired','expired'],['refund','expired','refunded'],
 ['chargeback','refunded','revoked'],['manual_revoke','revoked','revoked'],['restore','expired','active'],
] as const) {
 test(`Q2 lifecycle keeps ${event}: ${from} -> ${to}`,async()=>{
  const {result}=await apply(receipt({event_type:event,previous_status:from,next_status:to}),{event});assert.equal(result.ok,true);
 });
}
