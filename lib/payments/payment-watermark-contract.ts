import {
  buildPaymentEventWatermark, decidePaymentEventOrdering,
  type PaymentEventKind, type PaymentEventWatermark, type PaymentEventOrderingDecision,
} from './stripe-webhook-state';

export type PaymentWatermarkInput = {
  subjectKey: string; eventId: string; eventCreatedAt: number; kind: PaymentEventKind;
};
const kinds = new Set<string>(['payment_pending', 'payment_failed', 'checkout_completed', 'partial_refund', 'refund', 'chargeback']);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown, length: number) => typeof value === 'string' &&
  value.length >= 1 && value.length <= length && /^[A-Za-z0-9._:-]+$/.test(value);
const invalid = (): never => { throw new Error('payment_event_watermark_invalid_contract'); };

export function assertPaymentWatermarkInput(value: unknown): asserts value is PaymentWatermarkInput {
  if (!record(value) || !id(value.subjectKey, 240) || !id(value.eventId, 180) ||
      !Number.isSafeInteger(value.eventCreatedAt) || (value.eventCreatedAt as number) < 0 ||
      (value.eventCreatedAt as number) > 253402300799 || typeof value.kind !== 'string' || !kinds.has(value.kind)) invalid();
}

export function assertSamePaymentEventIdentity(a: PaymentEventWatermark, b: PaymentEventWatermark): void {
  if (a.eventId === b.eventId && (a.subjectKey !== b.subjectKey || a.kind !== b.kind || a.eventCreatedAt !== b.eventCreatedAt)) {
    throw new Error('payment_event_watermark_identity_conflict');
  }
}

function watermark(value: unknown, subject: string): PaymentEventWatermark {
  assertPaymentWatermarkInput(value);
  const raw = value as PaymentWatermarkInput & Record<string, unknown>;
  const expected = buildPaymentEventWatermark(value);
  if (value.subjectKey !== subject || raw.priority !== expected.priority || raw.terminal !== expected.terminal) invalid();
  return expected;
}
const same = (a: PaymentEventWatermark, b: PaymentEventWatermark) =>
  a.subjectKey === b.subjectKey && a.eventId === b.eventId && a.eventCreatedAt === b.eventCreatedAt &&
  a.kind === b.kind && a.priority === b.priority && a.terminal === b.terminal;

/** Validate the trusted RPC's bounded decision, NOT proof of a completed payment effect.
 * Recompute the existing policy from the declared previous state; never coerce a
 * string into approval, invent a reason, or describe rejected input as current.
 */
export function parsePaymentWatermarkDecision(data: unknown, input: PaymentWatermarkInput): PaymentEventOrderingDecision & {
  currentEventId: string; currentKind: PaymentEventKind;
} {
  assertPaymentWatermarkInput(input);
  const row = Array.isArray(data) && data.length === 1 ? data[0] : data;
  if (!record(row) || row.ok !== true || row.schema_version !== 'velmere.payment-watermark.v1' ||
      typeof row.accepted !== 'boolean' || row.subject_key !== input.subjectKey ||
      row.event_id !== input.eventId || row.event_kind !== input.kind || row.event_created_at !== input.eventCreatedAt) invalid();
  const previous = row.previous === null ? null : watermark(row.previous, input.subjectKey);
  const incoming = buildPaymentEventWatermark(input);
  if (previous) assertSamePaymentEventIdentity(previous, incoming);
  const decision = decidePaymentEventOrdering(previous, incoming);
  const current = watermark(row.current, input.subjectKey);
  if (decision.accepted !== row.accepted || decision.reason !== row.reason || !same(decision.next, current)) invalid();
  return { ...decision, currentEventId: current.eventId, currentKind: current.kind };
}
