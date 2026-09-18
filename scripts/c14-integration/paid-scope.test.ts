import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { clearMemoryEntitlements, seedMemoryEntitlementRecord, verifyVlmPaidAccountEntitlement, verifyVlmPaidEntitlementById, type VlmPaidEntitlementRecord } from '../../lib/commerce/vlm-entitlement-ledger';
import { hashVlmPaidAccessContext } from '../../lib/commerce/vlm-paid-access-server';
import type { VlmPaidAccessContext } from '../../lib/commerce/vlm-paid-access';

// Isolated memory fixtures exercise actual ledger code, not Stripe/JWT/storage E2E.
const now = new Date('2026-09-18T00:00:00.000Z');
const owner = 'a'.repeat(64);
const context: VlmPaidAccessContext = { surface:'shield', locale:'en', depth:'pro', accountIdHash:owner };
function record(status: VlmPaidEntitlementRecord['status'] = 'active', expiresAt = '2026-09-19T00:00:00.000Z'): VlmPaidEntitlementRecord {
 return { id:'c14-isolated-scope', stripeSessionId:'cs_test_isolated_fixture', stripeCustomerId:null,
 productId:'vlm_pro_analysis_single', accessScope:'vlm_pro_analysis', status,
 contextHash:hashVlmPaidAccessContext(context), context, locale:'en', amountTotal:0, currency:'EUR',
 customerEmail:null, customerName:null, paymentStatus:'paid', source:'local_demo_verify',
 createdAt:'2026-09-17T23:00:00.000Z', updatedAt:'2026-09-17T23:00:00.000Z', expiresAt, auditQueueId:null };
}
beforeEach(() => { clearMemoryEntitlements(); seedMemoryEntitlementRecord(record()); });
afterEach(() => clearMemoryEntitlements());
const byId = (changes: Partial<Parameters<typeof verifyVlmPaidEntitlementById>[0]> = {}) => verifyVlmPaidEntitlementById({ entitlementId:'c14-isolated-scope', allowedProductIds:['vlm_pro_analysis_single'], accountIdHash:owner, surface:'shield', depth:'pro', now, ...changes });
test('P18 matching account and exact scope remains allowed', async () => {
 assert.equal((await verifyVlmPaidAccountEntitlement({ productId:'vlm_pro_analysis_single',context,now })).ok,true);
 assert.equal((await byId()).ok,true);
});
test('P18 account lookup cannot reuse Shield scope in Real Markets', async () => {
 assert.equal((await verifyVlmPaidAccountEntitlement({ productId:'vlm_pro_analysis_single',context:{...context,surface:'real-markets'},now })).ok,false);
});
test('P18 direct ID cannot cross product surface', async () => { assert.equal((await byId({surface:'real-markets'})).ok,false); });
test('P18 direct ID cannot cross account', async () => { assert.equal((await byId({accountIdHash:'b'.repeat(64)})).ok,false); });
test('P18 direct ID cannot cross requested depth', async () => { assert.equal((await byId({depth:'advanced'})).ok,false); });
test('P18 Pro cannot satisfy Advanced SKU', async () => { assert.equal((await byId({allowedProductIds:['vlm_advanced_analysis_single']})).ok,false); });
test('P18 expired scope denies', async () => { clearMemoryEntitlements();seedMemoryEntitlementRecord(record('active','2026-09-17T00:00:00.000Z'));assert.equal((await byId()).ok,false); });
test('P18 revoked scope denies including concurrent lookups', async () => {
 clearMemoryEntitlements();seedMemoryEntitlementRecord(record('revoked'));
 const results=await Promise.all(Array.from({length:32},()=>byId()));
 assert.ok(results.every(result=>!result.ok)); // One scenario, not 32 extra tests.
});
test('P18 unknown ID denies without widening account search', async () => { assert.equal((await byId({entitlementId:'unknown-id'})).ok,false); });
