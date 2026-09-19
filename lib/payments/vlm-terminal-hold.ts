import { hasSupabaseServiceRoleConfig } from '@/lib/db/supabase';
import { runRegisteredServiceRoleRpc } from '@/lib/db/supabase-rpc-operation-registry';
import { normalizeVlmPaidProductId, type VlmPaidProductId } from '@/lib/commerce/vlm-paid-access';

export type VlmTerminalHoldInput = {
  stripeSessionId: string;
  productId: VlmPaidProductId;
  contextHash: string;
  eventId: string;
  event: 'refund' | 'chargeback';
  eventCreatedAt: number;
};
export type VlmTerminalHoldReceipt = {
  schema: 'velmere.vlm-terminal-hold.v1';
  ok: true;
  request: VlmTerminalHoldInput;
  disposition: 'held_before_grant' | 'lifecycle_applied' | 'already_terminal';
  entitlementId: string | null;
  // An observation at the time this receipt was committed, not a current-state query.
  observedStatus: 'refunded' | 'revoked' | 'consumed' | null;
};
function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('vlm_terminal_hold_invalid_response');
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) throw new Error('vlm_terminal_hold_invalid_response');
}
function id(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 180 && !/[^a-zA-Z0-9._:-]/.test(value);
}
export function assertVlmTerminalHoldInput(input: VlmTerminalHoldInput): void {
  if (!id(input.stripeSessionId) || !id(input.eventId) || normalizeVlmPaidProductId(input.productId) !== input.productId ||
      typeof input.contextHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.contextHash) ||
      (input.event !== 'refund' && input.event !== 'chargeback') ||
      !Number.isSafeInteger(input.eventCreatedAt) || input.eventCreatedAt < 0 || input.eventCreatedAt > 253402300799) {
    throw new Error('vlm_terminal_hold_invalid_input');
  }
}
export function parseVlmTerminalHoldReceipt(data: unknown, input: VlmTerminalHoldInput): VlmTerminalHoldReceipt {
  assertVlmTerminalHoldInput(input);
  if (Array.isArray(data)) {
    if (data.length !== 1) throw new Error('vlm_terminal_hold_invalid_response');
    data = data[0];
  }
  const r = obj(data);
  exact(r, ['schema','ok','request','disposition','entitlementId','observedStatus']);
  const request = obj(r.request);
  exact(request, ['stripeSessionId','productId','contextHash','eventId','event','eventCreatedAt']);
  if (r.schema !== 'velmere.vlm-terminal-hold.v1' || r.ok !== true ||
      Object.keys(request).some(k => request[k] !== input[k as keyof VlmTerminalHoldInput])) {
    throw new Error('vlm_terminal_hold_request_mismatch');
  }
  if (r.disposition === 'held_before_grant') {
    if (r.entitlementId !== null || r.observedStatus !== null) throw new Error('vlm_terminal_hold_invalid_response');
  } else if (r.disposition === 'lifecycle_applied' || r.disposition === 'already_terminal') {
    if (!id(r.entitlementId) || (typeof r.observedStatus !== 'string' || !['refunded','revoked','consumed'].includes(r.observedStatus))) throw new Error('vlm_terminal_hold_invalid_response');
    if (r.disposition === 'lifecycle_applied' && r.observedStatus !== (input.event === 'refund' ? 'refunded' : 'revoked')) throw new Error('vlm_terminal_hold_invalid_response');
    if (r.disposition === 'already_terminal' && input.event === 'chargeback' && r.observedStatus === 'refunded') throw new Error('vlm_terminal_hold_invalid_response');
  } else throw new Error('vlm_terminal_hold_invalid_response');
  return r as unknown as VlmTerminalHoldReceipt;
}
/** Only called after authoritative Stripe binding and a durable not-found lookup.
 * No memory fallback: a terminal event may be acknowledged only after durable
 * prevention of a later grant. The SQL and guarded create/read RPC must deploy together.
 */
export async function recordVlmTerminalPaymentHold(
  input: VlmTerminalHoldInput,
  dependencies: {rpc: typeof runRegisteredServiceRoleRpc} = {rpc: runRegisteredServiceRoleRpc},
): Promise<VlmTerminalHoldReceipt> {
  assertVlmTerminalHoldInput(input);
  if (!hasSupabaseServiceRoleConfig()) throw new Error('vlm_terminal_hold_storage_unavailable');
  const {data} = await dependencies.rpc({operation: 'vlm_terminal_hold_apply', args: {
    p_stripe_session_id: input.stripeSessionId, p_product_id: input.productId,
    p_context_hash: input.contextHash, p_event_id: input.eventId,
    p_event_type: input.event, p_event_created_at: input.eventCreatedAt,
  }});
  return parseVlmTerminalHoldReceipt(data, input);
}
