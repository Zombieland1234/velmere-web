import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type OrderEventLedgerStatus = "ready" | "partial" | "blocked" | "manual_review";

export type OrderEventLedgerItem = {
  id: string;
  label: string;
  status: OrderEventLedgerStatus;
  progress: number;
  sourceMode: "missing" | "internal_draft" | "provider_pending" | "manual_review" | "blocked";
  requiredBeforePayment: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export const orderEventLedgerMatrix: OrderEventLedgerItem[] = [
  {
    id: "event-id",
    label: "Event identity",
    status: "blocked",
    progress: 18,
    sourceMode: "internal_draft",
    requiredBeforePayment: true,
    operatorPromise: "Every checkout, payment, refund and fulfillment action needs a stable event id.",
    safetyBoundary: "No order state mutation without event id, timestamp, route and actor type.",
    blockers: ["event id generator", "timestamp source", "actor type", "route label", "case id"],
    nextStep: "Create event envelope contract for checkout session, payment succeeded, payment failed, refund requested and fulfillment updated.",
  },
  {
    id: "idempotency-key",
    label: "Idempotency key",
    status: "blocked",
    progress: 14,
    sourceMode: "missing",
    requiredBeforePayment: true,
    operatorPromise: "Repeated provider events must not duplicate orders, charges, refunds or customer emails.",
    safetyBoundary: "No webhook mutation without idempotency key and duplicate detection.",
    blockers: ["idempotency key", "dedupe store", "provider event id", "retry replay guard"],
    nextStep: "Add idempotency key storage and duplicate-event rejection before production webhooks.",
  },
  {
    id: "signed-webhook",
    label: "Signed webhook verification",
    status: "blocked",
    progress: 16,
    sourceMode: "provider_pending",
    requiredBeforePayment: true,
    operatorPromise: "The store only trusts provider events that pass signature verification.",
    safetyBoundary: "No payment/order state update from unsigned or replayed webhook payloads.",
    blockers: ["provider secret", "signature verification", "clock tolerance", "replay window"],
    nextStep: "Wire provider-specific signature verification and reject unsigned/replayed events.",
  },
  {
    id: "retry-policy",
    label: "Retry and failure policy",
    status: "manual_review",
    progress: 26,
    sourceMode: "internal_draft",
    requiredBeforePayment: true,
    operatorPromise: "Failed provider events need a safe retry path and visible operator review state.",
    safetyBoundary: "No silent failure when payment, order or refund state is uncertain.",
    blockers: ["retry queue", "dead-letter state", "operator alert", "manual reconciliation"],
    nextStep: "Add retry policy, dead-letter state and operator escalation path.",
  },
  {
    id: "order-timeline",
    label: "Order timeline",
    status: "blocked",
    progress: 20,
    sourceMode: "blocked",
    requiredBeforePayment: true,
    operatorPromise: "Customer support can see the exact order timeline from cart to payment to refund/fulfillment.",
    safetyBoundary: "No support response should rely on guessed order state.",
    blockers: ["order database", "event timeline", "support view", "status transitions"],
    nextStep: "Persist order events and render support-safe timeline labels.",
  },
  {
    id: "support-handoff",
    label: "Support handoff",
    status: "manual_review",
    progress: 32,
    sourceMode: "manual_review",
    requiredBeforePayment: true,
    operatorPromise: "If checkout or refund fails, customer has a clear support path with event context.",
    safetyBoundary: "No customer-facing failure state without support contact and event reference.",
    blockers: ["support mailbox", "case reference", "localized failure copy", "operator checklist"],
    nextStep: "Attach case reference and support route to failed payment/refund states.",
  },
];

export function getOrderEventLedgerSummary() {
  return summarizeLaunchReadiness(orderEventLedgerMatrix);
}

export function getPaymentBlockingOrderEventItems() {
  return orderEventLedgerMatrix.filter((item) => item.requiredBeforePayment && item.status !== "ready");
}
