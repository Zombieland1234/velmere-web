export type StripeMetadataLike = Record<string, string | null | undefined>;

export type VlmPaidStripeSessionLike = {
  id: unknown;
  mode: unknown;
  status: unknown;
  payment_status: unknown;
  livemode: unknown;
  amount_total: unknown;
  amount_subtotal?: unknown;
  currency: unknown;
  payment_intent: unknown;
  metadata?: StripeMetadataLike | null;
  total_details?: {
    amount_discount?: unknown;
    amount_tax?: unknown;
  } | null;
};

export type VlmPaidStripePaymentIntentLike = {
  id: unknown;
  status: unknown;
  livemode: unknown;
  amount: unknown;
  amount_received: unknown;
  currency: unknown;
  metadata?: StripeMetadataLike | null;
};

export type VlmPaidStripeReceiptExpected = {
  eventType: string;
  eventLivemode: boolean;
  expectedLivemode: boolean;
  productId: string;
  productCellId: string;
  productCellBindingSha256: string;
  contextHash: string;
  accountIdHash: string;
  paymentRail: "stripe_checkout_auto" | "stripe_checkout_card" | "stripe_checkout_blik";
  amount: number;
  currency: string;
};

export type VlmPaidStripeReceiptContractVerdict =
  | {
      ok: true;
      sessionId: string;
      paymentIntentId: string;
      mode: "test" | "live";
    }
  | {
      ok: false;
      error: string;
      retryable: boolean;
      terminal: boolean;
    };

const HASH = /^[a-f0-9]{64}$/u;
const ACCOUNT_HASH = /^[a-f0-9]{32,128}$/u;
const SAFE_CELL_ID = /^[a-z0-9][a-z0-9:_-]{2,159}$/u;
const ALLOWED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "server.verify",
]);
const ALLOWED_PAYMENT_RAILS = new Set<string>([
  "stripe_checkout_auto",
  "stripe_checkout_card",
  "stripe_checkout_blik",
]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function integer(value: unknown) {
  return Number.isSafeInteger(value) ? Number(value) : null;
}
function paymentIntentId(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "id" in value) {
    return text((value as { id?: unknown }).id);
  }
  return "";
}
function metadataMatches(
  metadata: StripeMetadataLike | null | undefined,
  expected: VlmPaidStripeReceiptExpected,
) {
  if (!metadata) return false;
  return metadata.kind === "vlm_paid_access" &&
    metadata.productId === expected.productId &&
    metadata.productCellId === expected.productCellId &&
    metadata.productCellBindingSha256 === expected.productCellBindingSha256 &&
    metadata.contextHash === expected.contextHash &&
    metadata.accountIdHash === expected.accountIdHash;
}

export function evaluateVlmPaidStripeReceiptContract(input: {
  session: VlmPaidStripeSessionLike;
  paymentIntent: VlmPaidStripePaymentIntentLike;
  expected: VlmPaidStripeReceiptExpected;
}): VlmPaidStripeReceiptContractVerdict {
  const { session, paymentIntent, expected } = input;
  if (!ALLOWED_EVENT_TYPES.has(expected.eventType)) {
    return { ok: false, error: "vlm_paid_event_type_invalid", retryable: false, terminal: true };
  }
  if (typeof expected.eventLivemode !== "boolean" || expected.eventLivemode !== expected.expectedLivemode) {
    return { ok: false, error: "vlm_paid_event_livemode_mismatch", retryable: false, terminal: true };
  }
  if (!HASH.test(expected.contextHash) || !HASH.test(expected.productCellBindingSha256)) {
    return { ok: false, error: "vlm_paid_expected_hash_invalid", retryable: false, terminal: true };
  }
  if (!ACCOUNT_HASH.test(expected.accountIdHash) || !SAFE_CELL_ID.test(expected.productCellId)) {
    return { ok: false, error: "vlm_paid_expected_identity_invalid", retryable: false, terminal: true };
  }
  if (!ALLOWED_PAYMENT_RAILS.has(expected.paymentRail)) {
    return { ok: false, error: "vlm_paid_expected_payment_rail_invalid", retryable: false, terminal: true };
  }
  if (!Number.isSafeInteger(expected.amount) || expected.amount <= 0 || !/^[a-z]{3}$/u.test(expected.currency)) {
    return { ok: false, error: "vlm_paid_expected_price_invalid", retryable: false, terminal: true };
  }

  const sessionId = text(session.id);
  if (!/^cs_[A-Za-z0-9_-]{4,176}$/u.test(sessionId)) {
    return { ok: false, error: "vlm_paid_session_id_invalid", retryable: false, terminal: true };
  }
  if (session.mode !== "payment" || session.status !== "complete" || session.payment_status !== "paid") {
    return { ok: false, error: "vlm_paid_session_not_complete_paid_payment", retryable: false, terminal: true };
  }
  if (session.livemode !== expected.expectedLivemode) {
    return { ok: false, error: "vlm_paid_session_livemode_mismatch", retryable: false, terminal: true };
  }
  if (integer(session.amount_total) !== expected.amount || text(session.currency).toLowerCase() !== expected.currency) {
    return { ok: false, error: "vlm_paid_session_price_mismatch", retryable: false, terminal: true };
  }
  if (session.amount_subtotal !== undefined && integer(session.amount_subtotal) !== expected.amount) {
    return { ok: false, error: "vlm_paid_session_subtotal_mismatch", retryable: false, terminal: true };
  }
  const discount = session.total_details?.amount_discount;
  const tax = session.total_details?.amount_tax;
  if ((discount !== undefined && integer(discount) !== 0) || (tax !== undefined && integer(tax) !== 0)) {
    return { ok: false, error: "vlm_paid_session_unexpected_adjustment", retryable: false, terminal: true };
  }
  if (!metadataMatches(session.metadata, expected) || session.metadata?.paymentRail !== expected.paymentRail) {
    return { ok: false, error: "vlm_paid_session_metadata_mismatch", retryable: false, terminal: true };
  }

  const sessionPaymentIntentId = paymentIntentId(session.payment_intent);
  const verifiedPaymentIntentId = text(paymentIntent.id);
  if (!/^pi_[A-Za-z0-9_-]{4,176}$/u.test(verifiedPaymentIntentId) || sessionPaymentIntentId !== verifiedPaymentIntentId) {
    return { ok: false, error: "vlm_paid_payment_intent_binding_mismatch", retryable: true, terminal: false };
  }
  if (paymentIntent.status !== "succeeded") {
    return { ok: false, error: "vlm_paid_payment_intent_not_succeeded", retryable: true, terminal: false };
  }
  if (paymentIntent.livemode !== expected.expectedLivemode) {
    return { ok: false, error: "vlm_paid_payment_intent_livemode_mismatch", retryable: false, terminal: true };
  }
  if (
    integer(paymentIntent.amount) !== expected.amount ||
    integer(paymentIntent.amount_received) !== expected.amount ||
    text(paymentIntent.currency).toLowerCase() !== expected.currency
  ) {
    return { ok: false, error: "vlm_paid_payment_intent_price_mismatch", retryable: false, terminal: true };
  }
  if (!metadataMatches(paymentIntent.metadata, expected)) {
    return { ok: false, error: "vlm_paid_payment_intent_metadata_mismatch", retryable: false, terminal: true };
  }

  return {
    ok: true,
    sessionId,
    paymentIntentId: verifiedPaymentIntentId,
    mode: expected.expectedLivemode ? "live" : "test",
  };
}
