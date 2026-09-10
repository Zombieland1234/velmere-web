import { createHash, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import {
  runRegisteredServiceRoleRpc,
  type SupabaseRpcOperation,
} from "@/lib/db/supabase-rpc-operation-registry";
import type { OrderLineItem, OrderRecord, OrderStatus } from "@/lib/orders/order-store";
import { classifyPrintfulFailure, isPrintfulConfigured } from "@/lib/printful/client";
import {
  createPrintfulOrderDraft,
  type PrintfulOrderDraftResult,
} from "@/lib/printful/orders";
import { canonicalJson } from "@/lib/security/canonical-json";
import { getStripeServerClient } from "@/lib/stripe/server";

const CLAIM_OPERATION = "commerce_fulfilment_outbox_claim" satisfies SupabaseRpcOperation;
const COMPLETE_OPERATION = "commerce_fulfilment_outbox_complete" satisfies SupabaseRpcOperation;
const FAIL_OPERATION = "commerce_fulfilment_outbox_fail" satisfies SupabaseRpcOperation;
const RELEASE_OPERATION = "commerce_fulfilment_outbox_release" satisfies SupabaseRpcOperation;

export type CommerceFulfilmentAction =
  | "printful_order_draft"
  | "manual_fulfilment_review";

export type CommerceFulfilmentOutboxItem = {
  requestId: string;
  idempotencyKey: string;
  orderDraftId: string;
  stripeSessionId: string;
  stripeEventId: string;
  stripePaymentIntentId: string;
  cartHash: string;
  amountTotal: number;
  currency: string;
  stripeLivemode: boolean;
  fulfilmentAction: CommerceFulfilmentAction;
  provider: "printful" | "manual";
  automaticPrintfulLineCount: number;
  attemptCount: number;
  leaseToken: string;
  durableOrderBinding: {
    cartHash: string;
    expectedAmountTotal: number;
    expectedCurrency: string;
    stripeSessionId: string;
    stripeLivemode: boolean | null;
    stripePaymentIntentId: string;
  };
  order: OrderRecord;
};

export type CommerceFulfilmentExecutionReceipt = {
  schemaVersion: "velmere.commerce-fulfilment-execution-receipt.v1";
  receiptId: string;
  receiptDigest: string;
  requestBindingDigest: string;
  requestId: string;
  orderDraftId: string;
  stripePaymentIntentIdHash: string;
  action: CommerceFulfilmentAction;
  provider: "printful" | "manual";
  attempt: number;
  result:
    | "provider_draft_created"
    | "provider_draft_reconciled"
    | "manual_review_required"
    | "retryable_failed"
    | "dead_letter";
  providerResult: {
    externalId: string;
    providerOrderIdHash: string | null;
    status: string | null;
    confirmed: boolean;
    reconciled: boolean;
    reconciliationAttempts: number;
    errorCode: string | null;
    ambiguous: boolean;
  };
  processedAt: string;
  redactionBoundary: {
    customerPiiStored: false;
    rawProviderPayloadStored: false;
    secretsStored: false;
  };
};

export type CommerceFulfilmentOutboxSummary = {
  schemaVersion: "velmere.commerce-fulfilment-outbox-worker.v1";
  runId: string;
  claimedCount: number;
  providerEffectCount: number;
  providerSucceededCount: number;
  manualSettledCount: number;
  retryableFailedCount: number;
  deadLetteredCount: number;
  releasedByDeadlineCount: number;
  completionWriteFailedCount: number;
  configurationBlockedCount: number;
  durable: true;
  liveExecutionEnabled: boolean;
  ok: boolean;
};

type ClaimBatchResult = { items: CommerceFulfilmentOutboxItem[] };
type FailureSettlement = {
  status: "retryable_failed" | "dead_letter";
  retryAfterSeconds: number | null;
};

export type CommerceFulfilmentOutboxWorkerDependencies = {
  hasDurableStorage: () => boolean;
  providerExecutionEnabled: () => boolean;
  providerConfigured: () => boolean;
  claimBatch: (input: {
    runId: string;
    leaseToken: string;
    limit: number;
    leaseSeconds: number;
  }) => Promise<ClaimBatchResult>;
  complete: (input: {
    requestId: string;
    leaseToken: string;
    providerOrderId: string | null;
    receipt: CommerceFulfilmentExecutionReceipt;
  }) => Promise<void>;
  fail: (input: {
    requestId: string;
    leaseToken: string;
    retryable: boolean;
    errorCode: string;
    retryThreshold: number;
    receipt: CommerceFulfilmentExecutionReceipt;
  }) => Promise<FailureSettlement>;
  release: (input: {
    requestId: string;
    leaseToken: string;
    reasonCode: string;
  }) => Promise<void>;
  retrieveStripeSession: (sessionId: string) => Promise<Stripe.Checkout.Session>;
  createProviderDraft: (
    order: OrderRecord,
    session: Stripe.Checkout.Session,
  ) => Promise<PrintfulOrderDraftResult>;
  now: () => number;
  randomId: () => string;
};

class CommerceFulfilmentWorkerError extends Error {
  readonly retryable: boolean;
  readonly ambiguous: boolean;

  constructor(code: string, options: { retryable: boolean; ambiguous?: boolean }) {
    super(code);
    this.name = "CommerceFulfilmentWorkerError";
    this.retryable = options.retryable;
    this.ambiguous = options.ambiguous ?? false;
  }
}

function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function safeString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function safeErrorCode(error: unknown) {
  return (error instanceof Error ? error.message : "commerce_fulfilment_failed")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "_")
    .slice(0, 120) || "commerce_fulfilment_failed";
}

function paymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  if (
    session.payment_intent
    && typeof session.payment_intent === "object"
    && typeof session.payment_intent.id === "string"
  ) {
    return session.payment_intent.id;
  }
  return null;
}

function parseLineItems(value: unknown): OrderLineItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 1_000) {
    throw new CommerceFulfilmentWorkerError("commerce_outbox_line_items_invalid", { retryable: false });
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new CommerceFulfilmentWorkerError("commerce_outbox_line_item_invalid", { retryable: false });
    }
    const row = entry as Record<string, unknown>;
    const amount = Number(row.amount);
    const quantity = Number(row.quantity);
    const provider = String(row.provider ?? "");
    const fulfilmentMode = String(row.fulfilmentMode ?? "");
    const currency = String(row.currency ?? "");
    if (
      !safeString(row.productId, 160)
      || !safeString(row.variantId, 160)
      || !safeString(row.title, 500)
      || !Number.isSafeInteger(amount)
      || amount < 0
      || !Number.isSafeInteger(quantity)
      || quantity < 1
      || quantity > 1_000
      || currency !== "EUR"
      || !["manual", "printful", "tapstitch", "external"].includes(provider)
      || !["disabled", "external_link", "manual", "automatic"].includes(fulfilmentMode)
    ) {
      throw new CommerceFulfilmentWorkerError("commerce_outbox_line_item_invalid", { retryable: false });
    }
    return {
      productId: String(row.productId),
      variantId: String(row.variantId),
      title: String(row.title),
      amount,
      quantity,
      currency: "EUR",
      provider: provider as OrderLineItem["provider"],
      fulfilmentMode: fulfilmentMode as OrderLineItem["fulfilmentMode"],
      providerVariantId: typeof row.providerVariantId === "string" ? row.providerVariantId : undefined,
      selectedSize: typeof row.selectedSize === "string" ? row.selectedSize : undefined,
    };
  });
}

function normalizeClaimRows(data: unknown, leaseToken: string): ClaimBatchResult {
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const items = rows.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new CommerceFulfilmentWorkerError("commerce_outbox_claim_row_invalid", { retryable: true });
    }
    const row = entry as Record<string, unknown>;
    const orderDraftId = safeString(row.order_draft_id, 160);
    const requestId = safeString(row.request_id, 96);
    const action = row.fulfilment_action;
    const provider = row.provider;
    const amountTotal = Number(row.amount_total);
    const automaticPrintfulLineCount = Number(row.automatic_printful_line_count);
    const attemptCount = Number(row.attempt_count);
    const status = safeString(row.order_status, 60) as OrderStatus;
    const orderCartHash = safeString(row.order_cart_hash, 64);
    const orderExpectedAmountTotal = Number(row.order_expected_amount_total);
    const orderExpectedCurrency = safeString(row.order_expected_currency, 3);
    const orderStripeSessionId = safeString(row.order_stripe_session_id, 255);
    const orderStripeLivemode = typeof row.order_stripe_livemode === "boolean"
      ? row.order_stripe_livemode
      : null;
    const orderStripePaymentIntentId = safeString(row.order_stripe_payment_intent_id, 255);
    const lineItems = parseLineItems(row.order_line_items);
    if (
      !/^commerce_fulfilment_[a-f0-9]{32}$/.test(requestId)
      || !orderDraftId
      || !/^cs_[A-Za-z0-9_]+$/.test(String(row.stripe_session_id ?? ""))
      || !/^evt_[A-Za-z0-9_]+$/.test(String(row.stripe_event_id ?? ""))
      || !/^pi_[A-Za-z0-9_]+$/.test(String(row.stripe_payment_intent_id ?? ""))
      || !/^[a-f0-9]{64}$/.test(String(row.cart_hash ?? ""))
      || !Number.isSafeInteger(amountTotal)
      || amountTotal < 0
      || !/^[A-Z]{3}$/.test(String(row.currency ?? ""))
      || typeof row.stripe_livemode !== "boolean"
      || (action !== "printful_order_draft" && action !== "manual_fulfilment_review")
      || (provider !== "printful" && provider !== "manual")
      || !Number.isSafeInteger(automaticPrintfulLineCount)
      || automaticPrintfulLineCount < 0
      || !Number.isSafeInteger(attemptCount)
      || attemptCount < 1
      || !["paid", "fulfilment_pending", "manual_fulfilment_required", "fulfilment_created"].includes(status)
    ) {
      throw new CommerceFulfilmentWorkerError("commerce_outbox_claim_binding_invalid", { retryable: false });
    }
    const guardSummary = row.order_guard_summary && typeof row.order_guard_summary === "object"
      ? row.order_guard_summary as OrderRecord["guardSummary"]
      : undefined;
    const order: OrderRecord = {
      id: orderDraftId,
      status,
      locale: safeString(row.order_locale, 20) || "en",
      cartHash: orderCartHash,
      stripeSessionId: orderStripeSessionId || undefined,
      lineItems,
      guardSummary,
      createdAt: safeString(row.order_created_at, 80) || new Date(0).toISOString(),
      updatedAt: safeString(row.order_updated_at, 80) || new Date(0).toISOString(),
      logs: [],
      eventReceiptIds: [],
    };
    return {
      requestId,
      idempotencyKey: safeString(row.idempotency_key, 200),
      orderDraftId,
      stripeSessionId: String(row.stripe_session_id),
      stripeEventId: String(row.stripe_event_id),
      stripePaymentIntentId: String(row.stripe_payment_intent_id),
      cartHash: String(row.cart_hash),
      amountTotal,
      currency: String(row.currency),
      stripeLivemode: row.stripe_livemode,
      fulfilmentAction: action,
      provider,
      automaticPrintfulLineCount,
      attemptCount,
      leaseToken,
      durableOrderBinding: {
        cartHash: orderCartHash,
        expectedAmountTotal: orderExpectedAmountTotal,
        expectedCurrency: orderExpectedCurrency,
        stripeSessionId: orderStripeSessionId,
        stripeLivemode: orderStripeLivemode,
        stripePaymentIntentId: orderStripePaymentIntentId,
      },
      order,
    } satisfies CommerceFulfilmentOutboxItem;
  });
  return { items };
}

function validateDurableItem(item: CommerceFulfilmentOutboxItem) {
  if (
    item.order.id !== item.orderDraftId
    || item.durableOrderBinding.cartHash !== item.cartHash
    || item.durableOrderBinding.expectedAmountTotal !== item.amountTotal
    || item.durableOrderBinding.expectedCurrency !== item.currency
    || item.durableOrderBinding.stripeSessionId !== item.stripeSessionId
    || item.durableOrderBinding.stripeLivemode !== item.stripeLivemode
    || item.durableOrderBinding.stripePaymentIntentId !== item.stripePaymentIntentId
    || item.order.cartHash !== item.durableOrderBinding.cartHash
    || item.order.stripeSessionId !== item.durableOrderBinding.stripeSessionId
    || item.order.lineItems.some((line) => line.currency !== item.currency)
  ) {
    throw new CommerceFulfilmentWorkerError("commerce_outbox_durable_binding_mismatch", { retryable: false });
  }
  const automatic = item.order.lineItems.filter(
    (line) => line.provider === "printful" && line.fulfilmentMode === "automatic",
  );
  const missingVariant = automatic.some(
    (line) => !line.providerVariantId || !/^\d+$/.test(line.providerVariantId),
  );
  if (
    automatic.length !== item.automaticPrintfulLineCount
    || (item.fulfilmentAction === "printful_order_draft" && (
      item.provider !== "printful" || automatic.length < 1 || missingVariant
    ))
    || (item.fulfilmentAction === "manual_fulfilment_review" && (
      item.provider !== "manual" || automatic.length !== 0
    ))
  ) {
    throw new CommerceFulfilmentWorkerError("commerce_outbox_action_binding_mismatch", { retryable: false });
  }
}

export function validateAuthoritativeStripeSession(
  item: CommerceFulfilmentOutboxItem,
  session: Stripe.Checkout.Session,
) {
  const metadata = session.metadata ?? {};
  const currency = typeof session.currency === "string" ? session.currency.toUpperCase() : "";
  if (
    session.id !== item.stripeSessionId
    || session.payment_status !== "paid"
    || session.mode !== "payment"
    || metadata.orderDraftId !== item.orderDraftId
    || metadata.cartHash !== item.cartHash
    || (metadata.kind !== undefined && metadata.kind !== "physical_commerce")
    || session.amount_total !== item.amountTotal
    || currency !== item.currency
    || session.livemode !== item.stripeLivemode
    || paymentIntentId(session) !== item.stripePaymentIntentId
    || (metadata.expectedAmountTotal !== undefined && metadata.expectedAmountTotal !== String(item.amountTotal))
    || (metadata.expectedCurrency !== undefined && metadata.expectedCurrency.toUpperCase() !== item.currency)
  ) {
    throw new CommerceFulfilmentWorkerError("commerce_outbox_stripe_binding_mismatch", { retryable: false });
  }
}

function requestBindingDigest(item: CommerceFulfilmentOutboxItem) {
  // Values are SQL-constrained not to contain `|`; this serialization is also
  // recomputed by the settlement RPC before it accepts the receipt.
  return sha256([
    "velmere.commerce-fulfilment-request-binding.v1",
    item.requestId,
    item.orderDraftId,
    item.stripeSessionId,
    item.stripeEventId,
    item.stripePaymentIntentId,
    item.cartHash,
    String(item.amountTotal),
    item.currency,
    String(item.stripeLivemode),
    item.fulfilmentAction,
    item.provider,
    String(item.automaticPrintfulLineCount),
  ].join("|"));
}

function buildReceipt(input: {
  item: CommerceFulfilmentOutboxItem;
  result: CommerceFulfilmentExecutionReceipt["result"];
  providerOrderId?: string | number | null;
  providerStatus?: string | null;
  confirmed?: boolean;
  reconciled?: boolean;
  reconciliationAttempts?: number;
  errorCode?: string | null;
  ambiguous?: boolean;
  processedAt: string;
}): CommerceFulfilmentExecutionReceipt {
  const base = {
    schemaVersion: "velmere.commerce-fulfilment-execution-receipt.v1" as const,
    requestBindingDigest: requestBindingDigest(input.item),
    requestId: input.item.requestId,
    orderDraftId: input.item.orderDraftId,
    stripePaymentIntentIdHash: sha256(input.item.stripePaymentIntentId),
    action: input.item.fulfilmentAction,
    provider: input.item.provider,
    attempt: input.item.attemptCount,
    result: input.result,
    providerResult: {
      externalId: input.item.orderDraftId,
      providerOrderIdHash: input.providerOrderId === undefined || input.providerOrderId === null
        ? null
        : sha256(String(input.providerOrderId)),
      status: input.providerStatus?.slice(0, 80) || null,
      confirmed: input.confirmed ?? false,
      reconciled: input.reconciled ?? false,
      reconciliationAttempts: boundedInteger(input.reconciliationAttempts, 0, 0, 20),
      errorCode: input.errorCode?.slice(0, 120) || null,
      ambiguous: input.ambiguous ?? false,
    },
    processedAt: input.processedAt,
    redactionBoundary: {
      customerPiiStored: false as const,
      rawProviderPayloadStored: false as const,
      secretsStored: false as const,
    },
  };
  const receiptDigest = sha256(canonicalJson(base));
  return {
    ...base,
    receiptId: `commerce_fulfilment_receipt_${receiptDigest.slice("sha256:".length, "sha256:".length + 32)}`,
    receiptDigest,
  };
}

async function defaultClaimBatch(input: {
  runId: string;
  leaseToken: string;
  limit: number;
  leaseSeconds: number;
}) {
  const { data } = await runRegisteredServiceRoleRpc({
    operation: CLAIM_OPERATION,
    args: {
      p_worker_id: input.runId,
      p_lease_token: input.leaseToken,
      p_limit: input.limit,
      p_lease_seconds: input.leaseSeconds,
    },
  });
  return normalizeClaimRows(data, input.leaseToken);
}

async function defaultComplete(input: {
  requestId: string;
  leaseToken: string;
  providerOrderId: string | null;
  receipt: CommerceFulfilmentExecutionReceipt;
}) {
  const { data } = await runRegisteredServiceRoleRpc({
    operation: COMPLETE_OPERATION,
    args: {
      p_request_id: input.requestId,
      p_lease_token: input.leaseToken,
      p_provider_order_id: input.providerOrderId,
      p_execution_receipt: input.receipt,
    },
  });
  if (data !== "succeeded") throw new Error("commerce_outbox_completion_write_failed");
}

async function defaultFail(input: {
  requestId: string;
  leaseToken: string;
  retryable: boolean;
  errorCode: string;
  retryThreshold: number;
  receipt: CommerceFulfilmentExecutionReceipt;
}): Promise<FailureSettlement> {
  const { data } = await runRegisteredServiceRoleRpc({
    operation: FAIL_OPERATION,
    args: {
      p_request_id: input.requestId,
      p_lease_token: input.leaseToken,
      p_retryable: input.retryable,
      p_error_code: input.errorCode,
      p_retry_threshold: input.retryThreshold,
      p_execution_receipt: input.receipt,
    },
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("commerce_outbox_fail_write_failed");
  const status = String((row as Record<string, unknown>).settled_status);
  if (status !== "retryable_failed" && status !== "dead_letter") {
    throw new Error("commerce_outbox_fail_write_invalid");
  }
  const seconds = Number((row as Record<string, unknown>).retry_after_seconds);
  return {
    status,
    retryAfterSeconds: Number.isFinite(seconds) && seconds >= 0 ? seconds : null,
  };
}

async function defaultRelease(input: {
  requestId: string;
  leaseToken: string;
  reasonCode: string;
}) {
  const { data } = await runRegisteredServiceRoleRpc({
    operation: RELEASE_OPERATION,
    args: {
      p_request_id: input.requestId,
      p_lease_token: input.leaseToken,
      p_reason_code: input.reasonCode,
    },
  });
  if (data !== "released") throw new Error("commerce_outbox_release_failed");
}

export const commerceFulfilmentOutboxWorkerDependencies: CommerceFulfilmentOutboxWorkerDependencies = {
  hasDurableStorage: hasSupabaseServiceRoleConfig,
  providerExecutionEnabled: () => process.env.VELMERE_COMMERCE_FULFILMENT_EXECUTION_ENABLED === "true",
  providerConfigured: isPrintfulConfigured,
  claimBatch: defaultClaimBatch,
  complete: defaultComplete,
  fail: defaultFail,
  release: defaultRelease,
  retrieveStripeSession: async (sessionId) => {
    const stripe = getStripeServerClient();
    return stripe.checkout.sessions.retrieve(sessionId) as Promise<Stripe.Checkout.Session>;
  },
  createProviderDraft: createPrintfulOrderDraft,
  now: Date.now,
  randomId: randomUUID,
};

function classifyFailure(error: unknown) {
  if (error instanceof CommerceFulfilmentWorkerError) {
    return { code: safeErrorCode(error), retryable: error.retryable, ambiguous: error.ambiguous };
  }
  const printful = classifyPrintfulFailure(error);
  return {
    code: safeErrorCode(printful.code),
    retryable: printful.retryable,
    ambiguous: printful.ambiguous,
  };
}

async function settleFailure(input: {
  item: CommerceFulfilmentOutboxItem;
  leaseToken: string;
  error: unknown;
  retryThreshold: number;
  dependencies: CommerceFulfilmentOutboxWorkerDependencies;
}) {
  const failure = classifyFailure(input.error);
  const provisionalResult = failure.retryable && input.item.attemptCount < input.retryThreshold
    ? "retryable_failed"
    : "dead_letter";
  const receipt = buildReceipt({
    item: input.item,
    result: provisionalResult,
    errorCode: failure.code,
    ambiguous: failure.ambiguous,
    processedAt: new Date(input.dependencies.now()).toISOString(),
  });
  return input.dependencies.fail({
    requestId: input.item.requestId,
    leaseToken: input.leaseToken,
    retryable: failure.retryable,
    errorCode: failure.code,
    retryThreshold: input.retryThreshold,
    receipt,
  });
}

export async function runCommerceFulfilmentOutboxWorker(
  options: {
    limit?: number;
    deadlineMs?: number;
    leaseSeconds?: number;
    retryThreshold?: number;
  } = {},
  dependencies: CommerceFulfilmentOutboxWorkerDependencies = commerceFulfilmentOutboxWorkerDependencies,
): Promise<CommerceFulfilmentOutboxSummary> {
  if (!dependencies.hasDurableStorage()) {
    throw new CommerceFulfilmentWorkerError("commerce_outbox_durable_storage_required", { retryable: true });
  }
  const limit = boundedInteger(options.limit, 5, 1, 10);
  const deadlineMs = boundedInteger(options.deadlineMs, 20_000, 2_000, 25_000);
  const leaseSeconds = boundedInteger(options.leaseSeconds, 120, 90, 300);
  const retryThreshold = boundedInteger(options.retryThreshold, 8, 1, 20);
  const startedAt = dependencies.now();
  const deadlineAt = startedAt + deadlineMs;
  const runId = `commerce_fulfilment_run_${dependencies.randomId()}`.slice(0, 160);
  const leaseToken = `commerce_fulfilment_lease_${dependencies.randomId()}`.slice(0, 180);
  const claimed = await dependencies.claimBatch({ runId, leaseToken, limit, leaseSeconds });
  const summary: CommerceFulfilmentOutboxSummary = {
    schemaVersion: "velmere.commerce-fulfilment-outbox-worker.v1",
    runId,
    claimedCount: claimed.items.length,
    providerEffectCount: 0,
    providerSucceededCount: 0,
    manualSettledCount: 0,
    retryableFailedCount: 0,
    deadLetteredCount: 0,
    releasedByDeadlineCount: 0,
    completionWriteFailedCount: 0,
    configurationBlockedCount: 0,
    durable: true,
    liveExecutionEnabled: dependencies.providerExecutionEnabled(),
    ok: true,
  };

  for (const item of claimed.items) {
    if (dependencies.now() >= deadlineAt - 1_000) {
      await dependencies.release({
        requestId: item.requestId,
        leaseToken,
        reasonCode: "worker_deadline_before_effect",
      });
      summary.releasedByDeadlineCount += 1;
      continue;
    }

    try {
      validateDurableItem(item);
      if (item.fulfilmentAction === "manual_fulfilment_review") {
        const receipt = buildReceipt({
          item,
          result: "manual_review_required",
          processedAt: new Date(dependencies.now()).toISOString(),
        });
        await dependencies.complete({
          requestId: item.requestId,
          leaseToken,
          providerOrderId: null,
          receipt,
        });
        summary.manualSettledCount += 1;
        continue;
      }

      if (!dependencies.providerExecutionEnabled()) {
        summary.configurationBlockedCount += 1;
        throw new CommerceFulfilmentWorkerError("commerce_outbox_execution_kill_switch_closed", { retryable: true });
      }
      if (!dependencies.providerConfigured()) {
        summary.configurationBlockedCount += 1;
        throw new CommerceFulfilmentWorkerError("commerce_outbox_printful_configuration_missing", { retryable: true });
      }

      let session: Stripe.Checkout.Session;
      try {
        session = await dependencies.retrieveStripeSession(item.stripeSessionId);
      } catch (error) {
        throw new CommerceFulfilmentWorkerError(
          safeErrorCode(error).includes("missing_stripe_secret_key")
            ? "commerce_outbox_stripe_configuration_missing"
            : "commerce_outbox_stripe_retrieve_failed",
          { retryable: true },
        );
      }
      validateAuthoritativeStripeSession(item, session);

      // Effects are deliberately sequential. A provider call is possible only
      // after a durable SKIP LOCKED claim has returned this exact lease token.
      summary.providerEffectCount += 1;
      let providerResult: PrintfulOrderDraftResult;
      try {
        providerResult = await dependencies.createProviderDraft(item.order, session);
      } catch (error) {
        const failure = classifyPrintfulFailure(error);
        throw new CommerceFulfilmentWorkerError(failure.code, {
          retryable: failure.retryable,
          ambiguous: failure.ambiguous,
        });
      }
      if (!providerResult.created) {
        throw new CommerceFulfilmentWorkerError(providerResult.reasonCode, {
          retryable: providerResult.retryable,
          ambiguous: providerResult.ambiguous,
        });
      }

      const receipt = buildReceipt({
        item,
        result: providerResult.reconciled ? "provider_draft_reconciled" : "provider_draft_created",
        providerOrderId: providerResult.printfulOrderId,
        providerStatus: providerResult.status,
        confirmed: providerResult.confirm,
        reconciled: providerResult.reconciled,
        reconciliationAttempts: providerResult.reconciliationAttempts,
        processedAt: new Date(dependencies.now()).toISOString(),
      });
      try {
        await dependencies.complete({
          requestId: item.requestId,
          leaseToken,
          providerOrderId: String(providerResult.printfulOrderId),
          receipt,
        });
      } catch {
        // Never overwrite a successful/ambiguous external effect with a failed
        // state. The lease expires and the next run reconciles by external_id.
        summary.completionWriteFailedCount += 1;
        summary.ok = false;
        continue;
      }
      summary.providerSucceededCount += 1;
    } catch (error) {
      try {
        const settled = await settleFailure({
          item,
          leaseToken,
          error,
          retryThreshold,
          dependencies,
        });
        if (settled.status === "retryable_failed") summary.retryableFailedCount += 1;
        else summary.deadLetteredCount += 1;
      } catch {
        summary.completionWriteFailedCount += 1;
        summary.ok = false;
      }
    }
  }
  return summary;
}
