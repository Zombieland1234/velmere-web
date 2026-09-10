import { getCheckoutReadiness } from "@/lib/checkout/config";
import { getStoreCheckoutReadiness } from "@/lib/checkout/readiness";
import { getOrderEventLedgerSummary } from "@/lib/launch/order-event-ledger";
import { getPaymentOrderReadinessSummary } from "@/lib/launch/payment-order-readiness";
import { paymentWebhookGuardReadiness } from "@/lib/security/payment-webhook-guard";
import { buildPaymentRuntimeEvidenceSnapshot } from "@/lib/security/payment-runtime-evidence";
import { buildStripeWebhookReplayQaSnapshot } from "@/lib/security/stripe-webhook-replay-qa";

export type PaymentWebhookControlStatus = "ready" | "partial" | "blocked" | "manual";
export type PaymentWebhookControl = {
  id: string;
  label: string;
  status: PaymentWebhookControlStatus;
  progress: number;
  implemented: string[];
  blockers: string[];
  nextAction: string;
  safetyBoundary: string;
};

function hasEnv(name: string) {
  return Boolean(process.env[name]);
}

function enabled(name: string) {
  return process.env[name] === "true";
}

function stripeModeStatus(): PaymentWebhookControl {
  const checkout = getCheckoutReadiness();
  const ready = checkout.enabled && process.env.CHECKOUT_MODE === "stripe";
  return {
    id: "stripe-provider-env",
    label: "Stripe provider env gate",
    status: ready ? "ready" : checkout.stripeConfigured ? "partial" : "blocked",
    progress: ready ? 92 : checkout.stripeConfigured ? 72 : 38,
    implemented: ["CHECKOUT_MODE gate", "Stripe env readiness", "site URL readiness"],
    blockers: checkout.reasons,
    nextAction: ready ? "Run Vercel checkout smoke with test product only." : "Configure Stripe envs, site URL and store readiness flags before exposing checkout.",
    safetyBoundary: "Checkout remains disabled unless Stripe mode, Stripe keys, webhook secret, site URL and store readiness are all configured.",
  };
}

function commercialReadinessStatus(): PaymentWebhookControl {
  const store = getStoreCheckoutReadiness();
  return {
    id: "commercial-readiness",
    label: "Commercial readiness gate",
    status: store.enabled ? "ready" : "blocked",
    progress: store.enabled ? 90 : 58,
    implemented: ["commercial readiness flags", "seller/shipping/returns/tax/fulfilment gates"],
    blockers: store.reasons.map((reason) => `${reason.code}: ${reason.message}`),
    nextAction: store.enabled ? "Keep checkout flags locked to production policy documents." : "Complete seller address, shipping rates, returns, privacy, tax and fulfilment readiness flags.",
    safetyBoundary: "No customer payment launch while legal, shipping, returns, tax or fulfilment data are incomplete.",
  };
}

function webhookSignatureStatus(): PaymentWebhookControl {
  const ready = hasEnv("STRIPE_WEBHOOK_SECRET");
  return {
    id: "signed-webhook",
    label: "Signed Stripe webhook verification",
    status: ready ? "partial" : "blocked",
    progress: ready ? 78 : 34,
    implemented: ["raw body read", "stripe-signature header requirement", "constructEvent signature verification", "oversized payload guard"],
    blockers: ready ? ["Vercel live webhook test", "replay/clock tolerance evidence", "operator retry policy"] : ["STRIPE_WEBHOOK_SECRET"],
    nextAction: ready ? "Run Stripe webhook test on Vercel and capture status/evidence." : "Configure STRIPE_WEBHOOK_SECRET and verify signed webhook rejection/acceptance.",
    safetyBoundary: "No order state mutation should happen from unsigned or oversized webhook payloads.",
  };
}

function idempotencyStatus(): PaymentWebhookControl {
  const persistenceReady = hasEnv("SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    id: "webhook-idempotency",
    label: "Webhook idempotency and duplicate event guard",
    status: persistenceReady ? "partial" : "manual",
    progress: persistenceReady ? 76 : 54,
    implemented: ["processed Stripe event lookup", "processed event upsert", "memory fallback"],
    blockers: persistenceReady ? ["Vercel duplicate-event smoke", "dead-letter queue"] : ["durable Supabase config", "duplicate replay test"],
    nextAction: persistenceReady ? "Replay a test event and verify duplicate response does not duplicate order state." : "Configure durable storage before relying on idempotency beyond a single runtime instance.",
    safetyBoundary: "Duplicate provider events must not create duplicate orders, emails, charges or fulfilment drafts.",
  };
}

function orderPersistenceStatus(): PaymentWebhookControl {
  const persistenceReady = hasEnv("SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    id: "order-persistence",
    label: "Order persistence and event ledger",
    status: persistenceReady ? "partial" : "blocked",
    progress: persistenceReady ? 74 : 46,
    implemented: ["order upsert by Stripe session", "line item rewrite", "safe production log fallback", "order event ledger readiness"],
    blockers: persistenceReady ? ["support timeline QA", "transactional email provider", "refund state persistence"] : ["Supabase URL/service key", "order timeline persistence"],
    nextAction: persistenceReady ? "Run checkout.session.completed flow and verify order + line items in DB." : "Configure durable database before enabling payment.",
    safetyBoundary: "Payment success must not be considered complete unless order state is persisted or explicitly escalated for operator review.",
  };
}

function fulfilmentStatus(): PaymentWebhookControl {
  const ready = enabled("STORE_FULFILMENT_READY");
  return {
    id: "fulfilment-handoff",
    label: "Fulfilment handoff after payment",
    status: ready ? "partial" : "blocked",
    progress: ready ? 70 : 42,
    implemented: ["Printful draft creation path", "manual fulfilment fallback", "fulfilment pending/failed state"],
    blockers: ready ? ["provider SKU proof", "shipping rate proof", "failure alert"] : ["STORE_FULFILMENT_READY", "provider SKU mapping", "shipping rates"],
    nextAction: ready ? "Test paid order with automatic and manual fulfilment variants." : "Keep checkout blocked until fulfilment workflow and provider truth are production-ready.",
    safetyBoundary: "A paid order must not silently fail fulfilment; operator review must be visible if provider handoff fails.",
  };
}

function refundAndSupportStatus(): PaymentWebhookControl {
  const paymentSummary = getPaymentOrderReadinessSummary();
  const orderSummary = getOrderEventLedgerSummary();
  const progress = Math.round((paymentSummary.averageProgress + orderSummary.averageProgress) / 2);
  return {
    id: "refund-support",
    label: "Refund, failure and support workflow",
    status: progress >= 70 ? "partial" : "blocked",
    progress,
    implemented: ["payment/order readiness matrix", "order event ledger matrix", "support handoff requirements"],
    blockers: ["refund provider", "transactional email provider", "support SLA", "localized failure copy"],
    nextAction: "Wire refund state, transactional emails and support case references before enabling production payment.",
    safetyBoundary: "No customer-facing payment launch without refund/support path and failure-state communication.",
  };
}

export function buildPaymentWebhookSecuritySnapshot() {
  const controls = [
    stripeModeStatus(),
    commercialReadinessStatus(),
    webhookSignatureStatus(),
    idempotencyStatus(),
    orderPersistenceStatus(),
    fulfilmentStatus(),
    refundAndSupportStatus(),
  ];
  const averageProgress = Math.round(controls.reduce((sum, control) => sum + control.progress, 0) / controls.length);
  const blocked = controls.filter((control) => control.status === "blocked").length;
  const partial = controls.filter((control) => control.status === "partial").length;
  const ready = controls.filter((control) => control.status === "ready").length;
  const runtimeEvidence = buildPaymentRuntimeEvidenceSnapshot();
  const replayQa = buildStripeWebhookReplayQaSnapshot();

  return {
    schemaVersion: "velmere-payment-webhook-security-v1",
    mode: "payment_webhook_security_review",
    generatedAt: new Date().toISOString(),
    averageProgress,
    blocked,
    partial,
    ready,
    checkoutReadiness: getCheckoutReadiness(),
    storeReadiness: getStoreCheckoutReadiness(),
    webhookGuard: paymentWebhookGuardReadiness,
    runtimeEvidence,
    replayQa,
    controls,
    productionBoundary:
      "Payment/webhook security remains a release blocker until envs, signed webhooks, idempotency, order persistence, fulfilment, refunds, support and runtime QA are verified on Vercel.",
  };
}
