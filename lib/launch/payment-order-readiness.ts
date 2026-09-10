import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type PaymentOrderReadinessStatus = "ready" | "partial" | "blocked" | "manual_review";

export type PaymentOrderReadinessItem = {
  id: string;
  label: string;
  status: PaymentOrderReadinessStatus;
  progress: number;
  sourceMode: "provider_missing" | "provider_config" | "internal_draft" | "manual_review" | "blocked";
  requiredBeforeCheckout: boolean;
  customerPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export const paymentOrderReadinessMatrix: PaymentOrderReadinessItem[] = [
  {
    id: "payment-provider",
    label: "Payment provider",
    status: "blocked",
    progress: 18,
    sourceMode: "provider_missing",
    requiredBeforeCheckout: true,
    customerPromise: "Customer must only see payment entry when the real payment provider is production configured.",
    safetyBoundary: "No card fields, wallet payment, payment intent or fake payment success before provider wiring.",
    blockers: ["provider account", "production keys", "webhook signature", "failure states", "refund capability"],
    nextStep: "Choose payment provider and wire production checkout/session flow behind environment gates.",
  },
  {
    id: "tax-calculation",
    label: "Tax calculation",
    status: "blocked",
    progress: 20,
    sourceMode: "blocked",
    requiredBeforeCheckout: true,
    customerPromise: "Taxes and final total must be visible before the customer confirms payment.",
    safetyBoundary: "No final payable total while tax rules, region handling and rounding are missing.",
    blockers: ["merchant tax profile", "destination rules", "currency rounding", "receipt tax lines"],
    nextStep: "Connect tax engine or merchant-approved static policy before enabling payment.",
  },
  {
    id: "order-confirmation",
    label: "Order confirmation",
    status: "blocked",
    progress: 26,
    sourceMode: "internal_draft",
    requiredBeforeCheckout: true,
    customerPromise: "After payment, customer must receive a clear order confirmation with items, totals and support path.",
    safetyBoundary: "No successful purchase flow without persisted order id, confirmation page and email receipt.",
    blockers: ["order database", "confirmation route", "email receipt", "support contact", "invoice/receipt copy"],
    nextStep: "Create persistent order state and localized confirmation/receipt templates.",
  },
  {
    id: "webhook-audit",
    label: "Webhook and audit trail",
    status: "blocked",
    progress: 24,
    sourceMode: "internal_draft",
    requiredBeforeCheckout: true,
    customerPromise: "Payment and fulfillment state must not be lost between provider, store and support.",
    safetyBoundary: "No production checkout without signed webhooks, retry handling and audit log.",
    blockers: ["webhook endpoint", "signature verification", "retry policy", "operator audit log"],
    nextStep: "Order event ledger now exists; next persist signed webhook events, idempotency keys and retry state."
  },
  {
    id: "refund-state",
    label: "Refund state",
    status: "blocked",
    progress: 22,
    sourceMode: "manual_review",
    requiredBeforeCheckout: true,
    customerPromise: "Customer must know how a refund is requested, tracked and confirmed.",
    safetyBoundary: "No public payment launch without refund status, support escalation and notification copy.",
    blockers: ["refund provider", "refund status model", "support SLA", "notification copy"],
    nextStep: "Connect refund status to order state and customer support workflow.",
  },
  {
    id: "customer-emails",
    label: "Customer emails",
    status: "manual_review",
    progress: 34,
    sourceMode: "internal_draft",
    requiredBeforeCheckout: true,
    customerPromise: "Customer receives localized transactional emails for confirmation, shipping and support.",
    safetyBoundary: "No checkout launch with marketing-only email setup or missing transactional sender.",
    blockers: ["transactional email provider", "localized templates", "sender verification", "unsubscribe boundary"],
    nextStep: "Wire transactional email provider and draft PL/DE/EN order/refund templates.",
  },
];

export function getPaymentOrderReadinessSummary() {
  return summarizeLaunchReadiness(paymentOrderReadinessMatrix);
}

export function getCheckoutBlockingPaymentOrderItems() {
  return paymentOrderReadinessMatrix.filter((item) => item.requiredBeforeCheckout && item.status !== "ready");
}
