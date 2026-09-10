/** Neutral order-event DTO used by ledger and storage adapters. */
export type OrderEventType =
  | "order_draft_created" | "checkout_started" | "payment_succeeded" | "payment_failed"
  | "provider_draft_requested" | "provider_draft_created" | "provider_draft_failed"
  | "provider_draft_retry_queued" | "provider_draft_retry_requested" | "provider_draft_retry_replay_started"
  | "provider_draft_retry_created" | "provider_draft_retry_blocked" | "provider_draft_retry_failed"
  | "provider_draft_retry_replay_discarded" | "fulfilment_pending" | "manual_fulfilment_required"
  | "fulfilled" | "order_failed" | "refund_partial" | "refunded" | "webhook_duplicate" | "webhook_unsupported";
export type OrderEventActor = "customer" | "stripe" | "printful" | "provider" | "system" | "operator";
export type OrderEventSeverity = "info" | "review" | "warning" | "error";
export type OrderEventStage = "checkout" | "payment" | "provider" | "fulfilment" | "support" | "audit";
export type OrderEventReceipt = {
  schemaVersion: "velmere.order-event-ledger.v1";
  eventId: string;
  idempotencyKey: string;
  caseId: string;
  orderDraftId: string;
  stripeSessionId?: string;
  stripeEventId?: string;
  providerOrderId?: string;
  providerReservationId?: string;
  createdAt: string;
  eventType: OrderEventType;
  stage: OrderEventStage;
  actor: OrderEventActor;
  sourceRoute: string;
  severity: OrderEventSeverity;
  statusBefore?: string;
  statusAfter?: string;
  progress: number;
  customerSafeLabel: string;
  operatorLabel: string;
  nextExpectedEvents: OrderEventType[];
  lineItemCount: number;
  productIds: string[];
  providerIds: string[];
  receiptIds: {
    checkoutGuardReceiptId?: string;
    stockReservationReceiptId?: string;
    providerReservationId?: string;
  };
  reasonCodes: string[];
  evidence: Record<string, unknown>;
  redactionBoundary: {
    rawCustomerPiiStored: false;
    rawProviderPayloadStored: false;
    secretsStored: false;
    allowedFields: string[];
  };
  checksum: string;
};
