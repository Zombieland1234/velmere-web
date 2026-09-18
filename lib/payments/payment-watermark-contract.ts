import {
  buildPaymentEventWatermark,
  decidePaymentEventOrdering,
  type PaymentEventKind,
  type PaymentEventOrderingDecision,
  type PaymentEventWatermark,
} from './stripe-webhook-state';

export type PaymentWatermarkInput = Pick<PaymentEventWatermark,
  'subjectKey' | 'eventId' | 'eventCreatedAt' | 'kind'>;
export type PaymentWatermarkResult = PaymentEventOrderingDecision & {
  currentEventId?: string;
  currentKind?: PaymentEventKind;
};
const kinds: readonly string[] = [
  'payment_pending', 'payment_failed', 'checkout_completed',
  'partial_refund', 'refund', 'chargeback',
];
const fields = ['subjectKey', 'eventId', 'eventCreatedAt', 'kind', 'priority', 'terminal'];
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('payment_watermark_invalid_response');
  }
  return value as Record<string, unknown>;
}
function exactFields(row: Record<string, unknown>, expected: readonly string[]) {
  if (Object.keys(row).length !== expected.length || expected.some(key => !Object.hasOwn(row, key))) {
    throw new Error('payment_watermark_invalid_response');
  }
}
/** This is a single-payment-subject contract, not Stripe-account authentication. */
export function assertPaymentWatermarkInput(input: PaymentWatermarkInput): void {
  if (typeof input.subjectKey !== 'string' || input.subjectKey.length < 1 || input.subjectKey.length > 512 || /[^a-zA-Z0-9._:-]/.test(input.subjectKey) ||
      typeof input.eventId !== 'string' || input.eventId.length < 1 || input.eventId.length > 180 || /[^a-zA-Z0-9._:-]/.test(input.eventId) ||
      !Number.isSafeInteger(input.eventCreatedAt) || input.eventCreatedAt < 0 || input.eventCreatedAt > 253402300799 ||
      typeof input.kind !== 'string' || !kinds.includes(input.kind)) {
    throw new Error('payment_watermark_invalid_input');
  }
}
function readMark(value: unknown): PaymentEventWatermark {
  const r = record(value); exactFields(r, fields);
  const input: PaymentWatermarkInput = {
    subjectKey: r.subjectKey as string, eventId: r.eventId as string,
    eventCreatedAt: r.eventCreatedAt as number, kind: r.kind as PaymentEventKind,
  };
  assertPaymentWatermarkInput(input);
  const mark = buildPaymentEventWatermark(input);
  if (r.priority !== mark.priority || r.terminal !== mark.terminal) {
    throw new Error('payment_watermark_invalid_response');
  }
  return mark;
}
function equalMark(a: PaymentEventWatermark, b: PaymentEventWatermark): boolean {
  return a.subjectKey === b.subjectKey && a.eventId === b.eventId &&
    a.eventCreatedAt === b.eventCreatedAt && a.kind === b.kind &&
    a.priority === b.priority && a.terminal === b.terminal;
}
export function assertSamePaymentEventIdentity(a: PaymentEventWatermark, b: PaymentEventWatermark) {
  if (a.eventId === b.eventId && !equalMark(a, b)) {
    throw new Error('payment_watermark_event_identity_conflict');
  }
}
/** Validate the committed decision, not just truthiness of a server field.
 * A correct receipt is NOT proof that the downstream effect has completed.
 * Old RPC responses deliberately fail: app and SQL require a coordinated rollout.
 */
export function parsePaymentWatermarkReceipt(data: unknown, input: PaymentWatermarkInput): PaymentWatermarkResult {
  assertPaymentWatermarkInput(input);
  if (Array.isArray(data)) {
    if (data.length !== 1) throw new Error('payment_watermark_invalid_response');
    data = data[0];
  }
  const r = record(data);
  exactFields(r, ['schema', 'ok', 'accepted', 'reason', 'request', 'previous', 'current']);
  if (r.schema !== 'velmere.payment-watermark.v1' || r.ok !== true || typeof r.accepted !== 'boolean') {
    throw new Error('payment_watermark_invalid_response');
  }
  const incoming = buildPaymentEventWatermark(input);
  if (!equalMark(readMark(r.request), incoming)) throw new Error('payment_watermark_request_mismatch');
  const previous = r.previous === null ? null : readMark(r.previous);
  if (previous && previous.subjectKey !== input.subjectKey) throw new Error('payment_watermark_subject_mismatch');
  if (previous) assertSamePaymentEventIdentity(previous, incoming);
  const expected = decidePaymentEventOrdering(previous, incoming);
  const current = readMark(r.current);
  if (r.accepted !== expected.accepted || r.reason !== expected.reason || !equalMark(current, expected.next)) {
    throw new Error('payment_watermark_decision_mismatch');
  }
  return { ...expected, currentEventId: current.eventId, currentKind: current.kind };
}
