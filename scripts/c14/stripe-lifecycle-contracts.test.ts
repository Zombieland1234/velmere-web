import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import {
  buildPaymentEventWatermark,
  decidePaymentEventOrdering,
  paymentEventKindFromStripeType,
} from "../../lib/payments/stripe-webhook-state";
import { evaluateVlmPaidStripeReceiptContract } from "../../lib/payments/vlm-paid-stripe-receipt-contract";
import {
  clearMemoryEntitlements,
  seedMemoryEntitlementRecord,
  verifyVlmPaidEntitlementById,
  type VlmPaidEntitlementRecord,
} from "../../lib/commerce/vlm-entitlement-ledger";
import { applyVlmPaidEntitlementLifecycleEvent } from "../../lib/commerce/vlm-entitlement-lifecycle";
import { buildStripeWebhookReconciliationReadiness } from "../../lib/payments/stripe-webhook-reconciler";

const ACCOUNT_A = "a".repeat(64);
const ACCOUNT_B = "b".repeat(64);
const CONTEXT_HASH = "c".repeat(64);
const CELL_HASH = "d".repeat(64);

const ENV_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VELMERE_REQUIRE_PAID_ENTITLEMENT_LEDGER",
  "VELMERE_STRIPE_DURABLE_STORAGE_QUALIFIED",
] as const;
let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  clearMemoryEntitlements();
});

afterEach(() => {
  clearMemoryEntitlements();
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function expectedReceipt() {
  return {
    eventType: "checkout.session.completed",
    eventLivemode: false,
    expectedLivemode: false,
    productId: "vlm_pro_analysis_single",
    productCellId: "vlm:pro:analysis",
    productCellBindingSha256: CELL_HASH,
    contextHash: CONTEXT_HASH,
    accountIdHash: ACCOUNT_A,
    paymentRail: "stripe_checkout_auto" as const,
    amount: 7999,
    currency: "eur",
  };
}

function validReceiptPair() {
  const expected = expectedReceipt();
  const metadata = {
    kind: "vlm_paid_access",
    productId: expected.productId,
    productCellId: expected.productCellId,
    productCellBindingSha256: expected.productCellBindingSha256,
    contextHash: expected.contextHash,
    accountIdHash: expected.accountIdHash,
    paymentRail: expected.paymentRail,
  };
  return {
    expected,
    session: {
      id: "cs_test_c14p19_001",
      mode: "payment",
      status: "complete",
      payment_status: "paid",
      livemode: false,
      amount_total: expected.amount,
      amount_subtotal: expected.amount,
      currency: expected.currency,
      payment_intent: "pi_c14p19_001",
      total_details: { amount_discount: 0, amount_tax: 0 },
      metadata,
    },
    paymentIntent: {
      id: "pi_c14p19_001",
      status: "succeeded",
      livemode: false,
      amount: expected.amount,
      amount_received: expected.amount,
      currency: expected.currency,
      metadata,
    },
  };
}

function entitlement(status: VlmPaidEntitlementRecord["status"] = "active"): VlmPaidEntitlementRecord {
  return {
    id: "ent_c14p19_fixture_001",
    stripeSessionId: "cs_test_c14p19_001",
    stripeCustomerId: "cus_c14p19_fixture",
    productId: "vlm_pro_analysis_single",
    accessScope: "vlm_pro_analysis",
    status,
    contextHash: CONTEXT_HASH,
    context: {
      surface: "shield",
      locale: "en",
      depth: "pro",
      accountIdHash: ACCOUNT_A,
    },
    locale: "en",
    amountTotal: 7999,
    currency: "eur",
    customerEmail: null,
    customerName: null,
    paymentStatus: "paid",
    source: "stripe_webhook",
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    auditQueueId: null,
  };
}

test("exact TEST receipt binds session, PaymentIntent, price and account metadata", () => {
  const pair = validReceiptPair();
  const verdict = evaluateVlmPaidStripeReceiptContract(pair);
  assert.deepEqual(verdict, {
    ok: true,
    sessionId: pair.session.id,
    paymentIntentId: pair.paymentIntent.id,
    mode: "test",
  });
});

test("forged client amount cannot satisfy the server receipt contract", () => {
  const pair = validReceiptPair();
  pair.session.amount_total = 1;
  const verdict = evaluateVlmPaidStripeReceiptContract(pair);
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.error, "vlm_paid_session_price_mismatch");
});

test("forged account binding in PaymentIntent metadata is terminally rejected", () => {
  const pair = validReceiptPair();
  pair.paymentIntent.metadata = { ...pair.paymentIntent.metadata, accountIdHash: ACCOUNT_B };
  const verdict = evaluateVlmPaidStripeReceiptContract(pair);
  assert.equal(verdict.ok, false);
  if (!verdict.ok) {
    assert.equal(verdict.error, "vlm_paid_payment_intent_metadata_mismatch");
    assert.equal(verdict.terminal, true);
  }
});

test("terminal refund watermark dominates a later checkout replay", () => {
  const current = buildPaymentEventWatermark({
    subjectKey: "stripe:payment_intent:pi_c14p19",
    eventId: "evt_refund_c14p19",
    eventCreatedAt: 200,
    kind: "refund",
  });
  const replay = buildPaymentEventWatermark({
    subjectKey: current.subjectKey,
    eventId: "evt_checkout_replay_c14p19",
    eventCreatedAt: 300,
    kind: "checkout_completed",
  });
  const verdict = decidePaymentEventOrdering(current, replay);
  assert.equal(verdict.accepted, false);
  assert.equal(verdict.reason, "terminal_state_dominates");
  assert.equal(verdict.next.eventId, current.eventId);
});

test("a successful checkout may supersede an earlier failed attempt for the same subject", () => {
  const failed = buildPaymentEventWatermark({
    subjectKey: "stripe:payment_intent:pi_retry_c14p19",
    eventId: "evt_failed_c14p19",
    eventCreatedAt: 100,
    kind: "payment_failed",
  });
  const succeeded = buildPaymentEventWatermark({
    subjectKey: failed.subjectKey,
    eventId: "evt_succeeded_c14p19",
    eventCreatedAt: 200,
    kind: "checkout_completed",
  });
  const verdict = decidePaymentEventOrdering(failed, succeeded);
  assert.equal(verdict.accepted, true);
  assert.equal(verdict.reason, "higher_priority");
});

test("subscription events are not silently treated as supported one-time lifecycle events", () => {
  const kind = paymentEventKindFromStripeType("customer.subscription.updated" as Stripe.Event.Type, {});
  assert.equal(kind, null);
});

test("user A entitlement cannot be reused by user B", async () => {
  seedMemoryEntitlementRecord(entitlement());
  const own = await verifyVlmPaidEntitlementById({
    entitlementId: "ent_c14p19_fixture_001",
    allowedProductIds: ["vlm_pro_analysis_single"],
    accountIdHash: ACCOUNT_A,
  });
  assert.equal(own.ok, true);

  const other = await verifyVlmPaidEntitlementById({
    entitlementId: "ent_c14p19_fixture_001",
    allowedProductIds: ["vlm_pro_analysis_single"],
    accountIdHash: ACCOUNT_B,
  });
  assert.equal(other.ok, false);
  if (!other.ok) assert.equal(other.error, "entitlement_account_mismatch");
});

test("full refund removes privilege and duplicate refund is idempotent", async () => {
  seedMemoryEntitlementRecord(entitlement());
  const first = await applyVlmPaidEntitlementLifecycleEvent({
    entitlementId: "ent_c14p19_fixture_001",
    eventId: "evt_refund_c14p19_001",
    event: "refund",
    now: new Date("2026-09-18T01:00:00.000Z"),
  });
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.nextStatus, "refunded");
    assert.equal(first.idempotent, false);
  }

  const access = await verifyVlmPaidEntitlementById({
    entitlementId: "ent_c14p19_fixture_001",
    allowedProductIds: ["vlm_pro_analysis_single"],
    accountIdHash: ACCOUNT_A,
    now: new Date("2026-09-18T01:01:00.000Z"),
  });
  assert.equal(access.ok, false);
  if (!access.ok) assert.equal(access.error, "entitlement_inactive");

  const duplicate = await applyVlmPaidEntitlementLifecycleEvent({
    entitlementId: "ent_c14p19_fixture_001",
    eventId: "evt_refund_c14p19_002",
    event: "refund",
  });
  assert.equal(duplicate.ok, true);
  if (duplicate.ok) assert.equal(duplicate.idempotent, true);
});

test("chargeback escalates a refunded entitlement to revoked", async () => {
  seedMemoryEntitlementRecord(entitlement("refunded"));
  const result = await applyVlmPaidEntitlementLifecycleEvent({
    entitlementId: "ent_c14p19_fixture_001",
    eventId: "evt_dispute_c14p19_001",
    event: "chargeback",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.nextStatus, "revoked");
});

test("Stripe reconciliation readiness no longer equates credentials with durable readiness", () => {
  process.env.SUPABASE_URL = "https://fixture.supabase.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_fixture_only";
  delete process.env.VELMERE_STRIPE_DURABLE_STORAGE_QUALIFIED;
  const unqualified = buildStripeWebhookReconciliationReadiness();
  assert.equal(unqualified.serviceRoleConfigured, true);
  assert.equal(unqualified.durableStorageQualified, false);
  assert.equal(unqualified.durableReady, false);
  assert.ok(unqualified.blockers.includes("stripe_durable_storage_not_qualified"));

  process.env.VELMERE_STRIPE_DURABLE_STORAGE_QUALIFIED = "true";
  const qualified = buildStripeWebhookReconciliationReadiness();
  assert.equal(qualified.serviceRoleConfigured, true);
  assert.equal(qualified.durableStorageQualified, true);
  assert.equal(qualified.durableReady, true);
  assert.deepEqual(qualified.blockers, []);
});
