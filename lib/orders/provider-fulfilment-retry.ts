import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { appendOrderEvent, summarizeOrderTimeline } from "@/lib/orders/order-event-ledger";
import { flushOrderEventStorageWrites } from "@/lib/orders/order-event-storage";
import { getOrder, markFulfilmentPending, type OrderLineItem, type OrderRecord } from "@/lib/orders/order-store";
import { createPrintfulOrderDraft } from "@/lib/printful/orders";
import { classifyPrintfulFailure, isPrintfulConfigured } from "@/lib/printful/client";
import { upsertFulfilmentIncidentCase } from "@/lib/orders/fulfilment-incident-case-store";
import { markDurableManualFulfilmentRequired, markDurableOrderFulfilmentPending } from "@/lib/orders/durable-order-state";
import { getStripeServerClient } from "@/lib/stripe/server";

export type ProviderFulfilmentRetryMode = "preview" | "execute";
export type ProviderFulfilmentRetryOutcome = "ready" | "created" | "blocked" | "failed" | "incident";

export type ProviderFulfilmentRetryReceipt = {
  schemaVersion: "velmere.provider-fulfilment-retry.v1";
  receiptId: string;
  caseId: string;
  orderDraftId: string;
  createdAt: string;
  mode: ProviderFulfilmentRetryMode;
  outcome: ProviderFulfilmentRetryOutcome;
  canRetry: boolean;
  executed: boolean;
  provider: "printful" | "manual" | "mixed" | "none";
  currentStatus?: OrderRecord["status"];
  stripeSessionId?: string;
  printfulOrderId?: string;
  providerStatus?: string;
  confirmOrders: boolean;
  strictMode: boolean;
  readiness: {
    orderInMemory: boolean;
    paymentConfirmed: boolean;
    alreadyFulfilled: boolean;
    providerDraftAlreadyCreated: boolean;
    hasStripeSessionId: boolean;
    printfulConfigured: boolean;
    automaticPrintfulLineCount: number;
    manualLineCount: number;
    missingProviderVariantCount: number;
    totalQuantity: number;
  };
  reasonCodes: string[];
  eventIds: string[];
  nextAction: "retry_execute" | "open_order_timeline" | "manual_fulfilment" | "configure_provider" | "stop_already_done" | "open_incident_case";
  redactionBoundary: {
    rawCustomerPiiStored: false;
    rawProviderPayloadStored: false;
    secretsStored: false;
    allowedFields: string[];
  };
  checksum: string;
};

type RetryContext = {
  order: OrderRecord | null;
  paymentConfirmed: boolean;
  alreadyFulfilled: boolean;
  providerDraftAlreadyCreated: boolean;
  automaticPrintfulLines: OrderLineItem[];
  manualLines: OrderLineItem[];
  missingProviderVariantCount: number;
  reasonCodes: string[];
};

function hashJson(value: unknown, prefix: string, length = 18) {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, length)}`;
}

function now() {
  return new Date().toISOString();
}

function toEventLineItems(order: OrderRecord | null) {
  return (order?.lineItems ?? []).map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    provider: item.provider,
    providerVariantId: item.providerVariantId,
    fulfilmentMode: item.fulfilmentMode,
    selectedSize: item.selectedSize,
    quantity: item.quantity,
    amount: item.amount,
    currency: item.currency,
  }));
}

function providerFor(lines: OrderLineItem[]) {
  const providers = new Set(lines.map((line) => line.provider));
  if (providers.size === 0) return "none" as const;
  if (providers.size > 1) return "mixed" as const;
  const only = Array.from(providers)[0];
  return only === "printful" ? "printful" : "manual";
}

function buildContext(orderDraftId: string): RetryContext {
  const order = getOrder(orderDraftId);
  const summary = summarizeOrderTimeline(orderDraftId);
  const automaticPrintfulLines = (order?.lineItems ?? []).filter(
    (item) => item.provider === "printful" && item.fulfilmentMode === "automatic",
  );
  const manualLines = (order?.lineItems ?? []).filter(
    (item) => item.provider !== "printful" || item.fulfilmentMode !== "automatic",
  );
  const missingProviderVariantCount = automaticPrintfulLines.filter((item) => !item.providerVariantId).length;
  const reasonCodes: string[] = [];

  if (!order) reasonCodes.push("order_not_available_in_current_runtime");
  if (!summary.paymentConfirmed && order?.status !== "paid" && order?.status !== "failed" && order?.status !== "fulfilment_pending") reasonCodes.push("payment_not_confirmed");
  if (summary.providerDraftCreated) reasonCodes.push("provider_draft_already_created");
  if (order?.status === "fulfilled") reasonCodes.push("order_already_fulfilled");
  if (!order?.stripeSessionId) reasonCodes.push("stripe_session_id_missing");
  if (!isPrintfulConfigured()) reasonCodes.push("printful_api_token_missing");
  if (automaticPrintfulLines.length === 0) reasonCodes.push("no_automatic_printful_lines");
  if (missingProviderVariantCount > 0) reasonCodes.push("provider_variant_id_missing");

  return {
    order,
    paymentConfirmed: summary.paymentConfirmed || order?.status === "paid" || order?.status === "failed" || order?.status === "fulfilment_pending",
    alreadyFulfilled: order?.status === "fulfilled" || summary.timeline.some((event) => event.eventType === "fulfilled"),
    providerDraftAlreadyCreated: summary.providerDraftCreated,
    automaticPrintfulLines,
    manualLines,
    missingProviderVariantCount,
    reasonCodes,
  };
}

function buildReceipt(input: {
  orderDraftId: string;
  mode: ProviderFulfilmentRetryMode;
  outcome: ProviderFulfilmentRetryOutcome;
  context: RetryContext;
  eventIds?: string[];
  printfulOrderId?: string | number;
  providerStatus?: string;
  extraReasonCodes?: string[];
}): ProviderFulfilmentRetryReceipt {
  const createdAt = now();
  const reasonCodes = Array.from(new Set([...(input.context.reasonCodes ?? []), ...(input.extraReasonCodes ?? [])])).slice(0, 40);
  const canRetry =
    Boolean(input.context.order) &&
    input.context.paymentConfirmed &&
    !input.context.alreadyFulfilled &&
    !input.context.providerDraftAlreadyCreated &&
    Boolean(input.context.order?.stripeSessionId) &&
    isPrintfulConfigured() &&
    input.context.automaticPrintfulLines.length > 0 &&
    input.context.missingProviderVariantCount === 0 &&
    reasonCodes.length === 0;
  const receiptBase = {
    orderDraftId: input.orderDraftId,
    mode: input.mode,
    outcome: input.outcome,
    createdAt,
    reasonCodes,
    eventIds: input.eventIds ?? [],
    printfulOrderId: input.printfulOrderId,
    providerStatus: input.providerStatus,
  };
  const totalQuantity = (input.context.order?.lineItems ?? []).reduce((sum, item) => sum + item.quantity, 0);
  const receiptId = hashJson(receiptBase, "pfretry", 20);
  const checksum = hashJson({ ...receiptBase, totalQuantity }, "pfretrychk", 24);
  return {
    schemaVersion: "velmere.provider-fulfilment-retry.v1",
    receiptId,
    caseId: hashJson({ orderDraftId: input.orderDraftId }, "ordcase", 14),
    orderDraftId: input.orderDraftId,
    createdAt,
    mode: input.mode,
    outcome: input.outcome,
    canRetry,
    executed: input.mode === "execute" && (input.outcome === "created" || input.outcome === "failed" || input.outcome === "incident"),
    provider: providerFor(input.context.order?.lineItems ?? []),
    currentStatus: input.context.order?.status,
    stripeSessionId: input.context.order?.stripeSessionId,
    printfulOrderId: input.printfulOrderId ? String(input.printfulOrderId) : undefined,
    providerStatus: input.providerStatus,
    confirmOrders: process.env.PRINTFUL_CONFIRM_ORDERS === "true",
    strictMode: process.env.VELMERE_PROVIDER_RETRY_STRICT === "1",
    readiness: {
      orderInMemory: Boolean(input.context.order),
      paymentConfirmed: input.context.paymentConfirmed,
      alreadyFulfilled: input.context.alreadyFulfilled,
      providerDraftAlreadyCreated: input.context.providerDraftAlreadyCreated,
      hasStripeSessionId: Boolean(input.context.order?.stripeSessionId),
      printfulConfigured: isPrintfulConfigured(),
      automaticPrintfulLineCount: input.context.automaticPrintfulLines.length,
      manualLineCount: input.context.manualLines.length,
      missingProviderVariantCount: input.context.missingProviderVariantCount,
      totalQuantity,
    },
    reasonCodes,
    eventIds: input.eventIds ?? [],
    nextAction: input.outcome === "incident"
      ? "open_incident_case"
      : canRetry
      ? "retry_execute"
      : reasonCodes.includes("printful_api_token_missing")
        ? "configure_provider"
        : reasonCodes.includes("provider_draft_already_created") || reasonCodes.includes("order_already_fulfilled")
          ? "stop_already_done"
          : reasonCodes.includes("no_automatic_printful_lines")
            ? "manual_fulfilment"
            : "open_order_timeline",
    redactionBoundary: {
      rawCustomerPiiStored: false,
      rawProviderPayloadStored: false,
      secretsStored: false,
      allowedFields: [
        "orderDraftId",
        "stripeSessionId",
        "provider order id",
        "provider variant ids",
        "quantity summary",
        "reason codes",
        "event ids",
        "checksum",
      ],
    },
    checksum,
  };
}

export function previewProviderFulfilmentRetry(orderDraftId: string) {
  const context = buildContext(orderDraftId);
  return buildReceipt({ orderDraftId, mode: "preview", outcome: context.reasonCodes.length ? "blocked" : "ready", context });
}

export async function executeProviderFulfilmentRetry(orderDraftId: string, operatorId = "admin") {
  const context = buildContext(orderDraftId);
  const preview = buildReceipt({ orderDraftId, mode: "execute", outcome: context.reasonCodes.length ? "blocked" : "ready", context });
  const eventIds: string[] = [];

  if (!preview.canRetry || !context.order) {
    const blocked = appendOrderEvent({
      orderDraftId,
      eventType: "provider_draft_retry_blocked",
      actor: "operator",
      sourceRoute: "app.api.admin.orders.fulfilment-retry",
      statusBefore: context.order?.status,
      statusAfter: context.order?.status,
      stripeSessionId: context.order?.stripeSessionId,
      providerReservationId: context.order?.guardSummary?.providerReservationId,
      guardSummary: context.order?.guardSummary,
      lineItems: toEventLineItems(context.order),
      severity: "warning",
      reasonCodes: preview.reasonCodes,
      evidence: { operatorId, retryReceiptId: preview.receiptId, nextAction: preview.nextAction },
      idempotencyKey: `provider_retry:${orderDraftId}:blocked:${preview.checksum}`,
    });
    eventIds.push(blocked.eventId);
    await flushOrderEventStorageWrites();
    return buildReceipt({ orderDraftId, mode: "execute", outcome: "blocked", context, eventIds });
  }

  const requested = appendOrderEvent({
    orderDraftId,
    eventType: "provider_draft_retry_requested",
    actor: "operator",
    sourceRoute: "app.api.admin.orders.fulfilment-retry",
    statusBefore: context.order.status,
    statusAfter: context.order.status,
    stripeSessionId: context.order.stripeSessionId,
    providerReservationId: context.order.guardSummary?.providerReservationId,
    guardSummary: context.order.guardSummary,
    lineItems: toEventLineItems(context.order),
    reasonCodes: ["operator_retry_requested"],
    evidence: { operatorId, retryReceiptId: preview.receiptId, automaticPrintfulLineCount: context.automaticPrintfulLines.length },
    idempotencyKey: `provider_retry:${orderDraftId}:requested:${preview.checksum}`,
  });
  eventIds.push(requested.eventId);

  try {
    const stripe = getStripeServerClient();
    const session = (await stripe.checkout.sessions.retrieve(context.order.stripeSessionId as string)) as Stripe.Checkout.Session;
    const fulfilment = await createPrintfulOrderDraft(context.order, session);
    if (fulfilment.created) {
      const created = appendOrderEvent({
        orderDraftId,
        eventType: "provider_draft_retry_created",
        actor: "printful",
        sourceRoute: "lib.printful.orders.createPrintfulOrderDraft.retry",
        statusBefore: context.order.status,
        statusAfter: "fulfilment_pending",
        stripeSessionId: context.order.stripeSessionId,
        providerOrderId: fulfilment.printfulOrderId,
        providerReservationId: context.order.guardSummary?.providerReservationId,
        guardSummary: context.order.guardSummary,
        lineItems: toEventLineItems(context.order),
        evidence: { confirm: fulfilment.confirm, printfulStatus: fulfilment.status ?? null, retryReceiptId: preview.receiptId },
        idempotencyKey: `provider_retry:${orderDraftId}:created:${fulfilment.printfulOrderId}`,
      });
      eventIds.push(created.eventId);
      markFulfilmentPending(orderDraftId);
      await flushOrderEventStorageWrites();
      return buildReceipt({
        orderDraftId,
        mode: "execute",
        outcome: "created",
        context: buildContext(orderDraftId),
        eventIds,
        printfulOrderId: fulfilment.printfulOrderId,
        providerStatus: fulfilment.status,
      });
    }

    const reasonCode = fulfilment.reasonCode;
    const incident = await upsertFulfilmentIncidentCase({
      orderDraftId,
      status: "open",
      severity: "warning",
      assignedRole: "operator",
      incidentType: `printful_${reasonCode}`,
      decision: "manual_review_required",
      supportPacket: { provider: "printful", reasonCode, retryable: false, ambiguous: false },
      redactedSnapshot: { retryReceiptPresent: true, orderPaid: true },
    });
    const failed = appendOrderEvent({
      orderDraftId,
      eventType: "provider_draft_retry_failed",
      actor: "printful",
      sourceRoute: "lib.printful.orders.createPrintfulOrderDraft.retry",
      statusBefore: context.order.status,
      statusAfter: "manual_fulfilment_required",
      stripeSessionId: context.order.stripeSessionId,
      providerReservationId: context.order.guardSummary?.providerReservationId,
      guardSummary: context.order.guardSummary,
      lineItems: toEventLineItems(context.order),
      severity: "warning",
      reasonCodes: [reasonCode],
      evidence: { reasonCode, retryReceiptId: preview.receiptId, incidentPersisted: incident.persisted },
      idempotencyKey: `provider_retry:${orderDraftId}:incident:${reasonCode}`,
    });
    eventIds.push(failed.eventId);
    markFulfilmentPending(orderDraftId);
    await markDurableManualFulfilmentRequired(orderDraftId, context.order.stripeSessionId);
    await markDurableOrderFulfilmentPending(orderDraftId, context.order.stripeSessionId);
    await flushOrderEventStorageWrites();
    return buildReceipt({ orderDraftId, mode: "execute", outcome: "incident", context: buildContext(orderDraftId), eventIds, extraReasonCodes: [reasonCode] });
  } catch (error) {
    const failure = classifyPrintfulFailure(error);
    const incident = await upsertFulfilmentIncidentCase({
      orderDraftId,
      status: failure.ambiguous ? "escalated" : "open",
      severity: failure.severity,
      assignedRole: "operator",
      incidentType: `printful_${failure.code}`,
      decision: failure.operatorAction,
      supportPacket: {
        provider: "printful",
        reasonCode: failure.code,
        retryable: failure.retryable,
        ambiguous: failure.ambiguous,
        status: failure.status ?? null,
      },
      redactedSnapshot: { retryReceiptPresent: true, orderPaid: true },
    });
    const failed = appendOrderEvent({
      orderDraftId,
      eventType: "provider_draft_retry_failed",
      actor: "printful",
      sourceRoute: "app.api.admin.orders.fulfilment-retry.exception",
      statusBefore: context.order.status,
      statusAfter: "manual_fulfilment_required",
      stripeSessionId: context.order.stripeSessionId,
      providerReservationId: context.order.guardSummary?.providerReservationId,
      guardSummary: context.order.guardSummary,
      lineItems: toEventLineItems(context.order),
      severity: failure.severity === "critical" ? "error" : failure.severity,
      reasonCodes: [failure.code],
      evidence: {
        reasonCode: failure.code,
        retryable: failure.retryable,
        ambiguous: failure.ambiguous,
        status: failure.status ?? null,
        retryReceiptId: preview.receiptId,
        incidentPersisted: incident.persisted,
      },
      idempotencyKey: `provider_retry:${orderDraftId}:exception:${failure.code}`,
    });
    eventIds.push(failed.eventId);
    markFulfilmentPending(orderDraftId);
    await markDurableManualFulfilmentRequired(orderDraftId, context.order.stripeSessionId);
    await markDurableOrderFulfilmentPending(orderDraftId, context.order.stripeSessionId);
    await flushOrderEventStorageWrites();
    return buildReceipt({
      orderDraftId,
      mode: "execute",
      outcome: "incident",
      context: buildContext(orderDraftId),
      eventIds,
      extraReasonCodes: [failure.code, failure.ambiguous ? "provider_result_ambiguous" : "provider_manual_review"],
    });
  }
}
