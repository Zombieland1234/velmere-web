import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const sql = readFileSync(new URL('./terminal-hold-store.sql', import.meta.url), 'utf8');
export async function database(holds = true, pipeline = false): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(new URL('../c15-q4/bootstrap-roles.sql', import.meta.url),'utf8'));
  for (const [ack, file] of [
    ['entitlement', '../c15-q4/entitlement-store.sql'],
    ...(pipeline ? [['effect','../c15-q5/effect-store.sql'], ['event','../c15-q6/event-store.sql'], ['watermark','../c15-q7/watermark-store.sql']] : []),
  ]) {
    await db.exec(`SET velmere.disposable_${ack}_store='ISOLATED_TEST_ONLY'`);
    await db.exec(readFileSync(new URL(file, import.meta.url), 'utf8'));
  }
  if (holds) { await db.exec("SET velmere.disposable_terminal_hold_store='ISOLATED_TEST_ONLY'"); await db.exec(sql); }
  return db;
}
export const request = (name: string, event: 'refund' | 'chargeback' = 'refund') => ({
  stripeSessionId: `cs_test_${name}`, productId: 'vlm_pro_analysis_single' as const,
  contextHash: hash(name), eventId: `evt_${name}_${event}`, event, eventCreatedAt: 1700000000,
});
export function createArgs(name: string): Record<string,unknown> {
  return {p_id:name,p_stripe_session_id:`cs_test_${name}`,p_stripe_customer_id:null,
    p_product_id:'vlm_pro_analysis_single',p_access_scope:'vlm_pro_analysis',p_context_hash:hash(name),
    p_context:{surface:'shield',locale:'en',depth:'pro',accountIdHash:hash('owner:'+name)},p_locale:'en',
    p_amount_total:1000,p_currency:'EUR',p_customer_email:null,p_customer_name:null,p_payment_status:'paid',
    p_source:'checkout_verify',p_audit_queue_id:null,p_expires_at:'2099-01-01T00:00:00Z',p_created_at:'2026-01-01T00:00:00Z'};
}
export async function rpc(db: PGlite, name: string, args: Record<string,unknown>): Promise<unknown> {
  assert.ok(['velmere_create_or_read_vlm_paid_entitlement','velmere_record_vlm_terminal_payment_hold',
    'velmere_claim_stripe_webhook_event','velmere_complete_stripe_webhook_event','velmere_apply_payment_event_watermark',
    'velmere_claim_stripe_webhook_effect','velmere_complete_stripe_webhook_effect','velmere_fail_stripe_webhook_effect',
    'velmere_dead_letter_stripe_webhook_effect','velmere_apply_vlm_paid_entitlement_lifecycle_event'].includes(name));
  assert.ok(Object.keys(args).every(k=>/^p_[a-z_]+$/.test(k)));
  return (await db.query<{data:unknown}>(`SELECT public.${name}(${Object.keys(args).map((k,i)=>`${k} => $${i+1}`).join(',')}) AS data`,Object.values(args))).rows[0].data;
}
export async function create(db: PGlite, name: string, change: Record<string,unknown> = {}) {
  return await rpc(db,'velmere_create_or_read_vlm_paid_entitlement',{...createArgs(name),...change}) as Record<string,unknown>;
}
export async function hold(db: PGlite, name: string, change: Record<string,unknown> = {}) {
  const r=request(name);
  return await rpc(db,'velmere_record_vlm_terminal_payment_hold',{
    p_stripe_session_id:r.stripeSessionId,p_product_id:r.productId,p_context_hash:r.contextHash,
    p_event_id:r.eventId,p_event_type:r.event,p_event_created_at:r.eventCreatedAt,...change,
  }) as Record<string,unknown>;
}
export async function state(db: PGlite, name: string) {
  return (await db.query<{status:string;expires_at:string}>('SELECT status, expires_at::text FROM public.velmere_vlm_paid_entitlements WHERE id=$1',[name])).rows[0];
}
export async function counts(db: PGlite, name: string) {
  const result=await db.query<{holds:number;events:number}>(`SELECT
    (SELECT count(*)::int FROM velmere_billing_private.session_terminal_holds WHERE stripe_session_id=$1) AS holds,
    (SELECT count(*)::int FROM velmere_billing_private.lifecycle_events WHERE entitlement_id=$2) AS events`,[`cs_test_${name}`,name]);
  return result.rows[0];
}
