import type Stripe from "stripe";
import type { OrderRecord } from "@/lib/orders/order-store";
import { classifyPrintfulFailure, PrintfulRequestError, printfulRequest } from "./client";

function getRecipient(session: Stripe.Checkout.Session) {
  const details = session.customer_details;
  const address = details?.address;
  if (!details?.name || !address?.line1 || !address?.country) return null;

  return {
    name: details.name,
    email: details.email ?? undefined,
    address1: address.line1,
    address2: address.line2 ?? undefined,
    city: address.city ?? undefined,
    state_code: address.state ?? undefined,
    country_code: address.country,
    zip: address.postal_code ?? undefined,
  };
}

type PrintfulOrderSummary = {
  result: {
    id: number;
    status?: string;
    external_id?: string;
  };
};

export type PrintfulOrderDraftResult =
  | {
      created: true;
      confirm: boolean;
      printfulOrderId: number;
      status?: string;
      reconciled: boolean;
      reconciliationAttempts: number;
    }
  | {
      created: false;
      warning: string;
      reasonCode: "recipient_incomplete" | "no_automatic_printful_items";
      retryable: false;
      ambiguous: false;
      reconciled: false;
      reconciliationAttempts: 0;
    };

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(ms, 1_500))));
}

export async function findPrintfulOrderByExternalId(externalId: string) {
  const normalized = externalId.trim().slice(0, 180);
  if (!normalized) return null;
  try {
    const result = await printfulRequest<PrintfulOrderSummary>(
      `/orders/@${encodeURIComponent(normalized)}`,
      {
        method: "GET",
        revalidate: 0,
        timeoutMs: 4_000,
        maxResponseBytes: 131_072,
        operation: "printful_order_lookup",
        retryMode: "safe_read",
      },
    );
    return result.result;
  } catch (error) {
    if (error instanceof PrintfulRequestError && error.status === 404) return null;
    throw error;
  }
}

async function reconcileAfterAmbiguousCreate(externalId: string) {
  const delays = [0, 250, 750];
  let lastLookupError: unknown = null;
  for (let index = 0; index < delays.length; index += 1) {
    if (delays[index] > 0) await delay(delays[index]);
    try {
      const found = await findPrintfulOrderByExternalId(externalId);
      if (found) return { found, attempts: index + 1 };
    } catch (error) {
      lastLookupError = error;
    }
  }
  return { found: null, attempts: delays.length, lastLookupError };
}

export async function createPrintfulOrderDraft(order: OrderRecord, session: Stripe.Checkout.Session): Promise<PrintfulOrderDraftResult> {
  const reconciledBeforeCreate = await findPrintfulOrderByExternalId(order.id);
  if (reconciledBeforeCreate) {
    return {
      created: true,
      confirm: process.env.PRINTFUL_CONFIRM_ORDERS === "true",
      printfulOrderId: reconciledBeforeCreate.id,
      status: reconciledBeforeCreate.status,
      reconciled: true,
      reconciliationAttempts: 1,
    };
  }

  const recipient = getRecipient(session);
  if (!recipient) {
    return {
      created: false,
      warning: "Shipping recipient is incomplete for automatic fulfilment.",
      reasonCode: "recipient_incomplete",
      retryable: false,
      ambiguous: false,
      reconciled: false,
      reconciliationAttempts: 0,
    };
  }

  const items = order.lineItems
    .filter((item) => item.provider === "printful" && item.fulfilmentMode === "automatic" && item.providerVariantId)
    .map((item) => ({
      sync_variant_id: Number(item.providerVariantId),
      quantity: item.quantity,
      retail_price: (item.amount / 100).toFixed(2),
    }));

  if (items.length === 0) {
    return {
      created: false,
      warning: "No automatic Printful line items are eligible for provider draft creation.",
      reasonCode: "no_automatic_printful_items",
      retryable: false,
      ambiguous: false,
      reconciled: false,
      reconciliationAttempts: 0,
    };
  }

  const confirm = process.env.PRINTFUL_CONFIRM_ORDERS === "true";
  try {
    const result = await printfulRequest<PrintfulOrderSummary>(`/orders?confirm=${confirm ? "true" : "false"}`, {
      method: "POST",
      body: {
        external_id: order.id,
        recipient,
        items,
        packing_slip: {
          email: recipient.email,
          message: "Velmère order received.",
        },
      },
      timeoutMs: 8_000,
      maxResponseBytes: 262_144,
      operation: "printful_order_create",
      retryMode: "single_attempt",
    });

    return {
      created: true,
      confirm,
      printfulOrderId: result.result.id,
      status: result.result.status,
      reconciled: false,
      reconciliationAttempts: 0,
    };
  } catch (createError) {
    const failure = classifyPrintfulFailure(createError);
    if (failure.ambiguous || failure.retryable) {
      const reconciliation = await reconcileAfterAmbiguousCreate(order.id);
      if (reconciliation.found) {
        return {
          created: true,
          confirm,
          printfulOrderId: reconciliation.found.id,
          status: reconciliation.found.status,
          reconciled: true,
          reconciliationAttempts: reconciliation.attempts,
        };
      }
    }
    throw createError;
  }
}
