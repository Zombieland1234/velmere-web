import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getCheckoutReadiness } from "@/lib/checkout/config";
import { assessLiveCheckoutIdempotency } from "@/lib/checkout/live-checkout-safety";
import { createOrderDraft, markCheckoutStarted, markFailed, type OrderLineItem } from "@/lib/orders/order-store";
import { persistOrderDraftDurable, markDurableCheckoutStarted, markDurableOrderFailed } from "@/lib/orders/durable-order-state";
import { summarizeOrderTimeline } from "@/lib/orders/order-event-ledger";
import { flushOrderEventStorageWrites } from "@/lib/orders/order-event-storage";
import { formatMoney, getLocalizedString } from "@/lib/products/catalog";
import { buildProductCheckoutGuard, type ProductCheckoutGuardLineReceipt, type ProductCheckoutGuardResolvedLine } from "@/lib/products/checkout-guard";
import { buildProviderStockReservationDraft, summarizeProviderStockReservation, type ProviderStockReservationLineReceipt } from "@/lib/products/provider-stock-reservation";
import { getStripeServerClient } from "@/lib/stripe/server";
import { readBoundedJsonBody, validateCheckoutRequestBoundary } from "@/lib/security/payment-webhook-guard";
import { applyWriteApiRateLimit } from "@/lib/security/write-api-rate-limit";
import { assertSameOriginRequest } from "@/lib/security/api-guard";
import { completePass4394ClientRequestJsonResponse, pass4394IdempotencyHeaders, registerPass4394ClientRequestMutation, type Pass4394ClientRequestIdempotencyReceipt } from "@/lib/security/client-request-idempotency";
import { pass4396IdempotencyReplayResponse } from "@/lib/security/idempotency-replay-response";
import { publicApiError, reportApiError } from "@/lib/security/api-error-envelope";

export const runtime = "nodejs";

const MAX_CART_LINES = 25;
const ALLOWED_SHIPPING_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] = [
  "DE", "PL", "FR", "NL", "BE", "AT", "IT", "ES", "PT", "IE", "DK", "SE", "FI", "NO", "CH", "GB", "US",
];

const PASS4145_COMMERCE_CHECKOUT_RECEIPT_BOUNDARY =
  "pass4145-commerce-checkout-receipt-boundary: checkout success URL is not entitlement; order/payment truth requires server receipt plus Stripe webhook replay" as const;

type Pass4145CommerceCheckoutReceiptBoundary = {
  passId: "PASS4145_COMMERCE_CHECKOUT_RECEIPT_BOUNDARY";
  successUrlUnlockAllowed: false;
  stripeWebhookRequired: true;
  serverReceiptRequired: true;
  cartHash: string;
  checkoutGuardReceiptId?: string;
  stockReservationReceiptId?: string;
  boundary: typeof PASS4145_COMMERCE_CHECKOUT_RECEIPT_BOUNDARY;
};

function buildPass4145CommerceCheckoutReceiptBoundary(args: {
  cartHash: string;
  checkoutGuardReceiptId?: string;
  stockReservationReceiptId?: string;
}): Pass4145CommerceCheckoutReceiptBoundary {
  return {
    passId: "PASS4145_COMMERCE_CHECKOUT_RECEIPT_BOUNDARY",
    successUrlUnlockAllowed: false,
    stripeWebhookRequired: true,
    serverReceiptRequired: true,
    cartHash: args.cartHash,
    checkoutGuardReceiptId: args.checkoutGuardReceiptId,
    stockReservationReceiptId: args.stockReservationReceiptId,
    boundary: PASS4145_COMMERCE_CHECKOUT_RECEIPT_BOUNDARY,
  };
}

type CheckoutCartItem = {
  productId: string;
  variantId?: string;
  size?: string;
  selectedSize?: string;
  quantity?: number;
};

type CheckoutRequestBody = {
  items?: CheckoutCartItem[];
  locale?: string;
  walletAddress?: string | null;
  paymentMethod?: "card" | "wallet";
  clientRequestId?: unknown;
};

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

function normalizeWalletAddress(value: unknown) {
  if (typeof value !== "string") return "";
  const candidate = value.trim();
  if (!candidate) return "";
  return /^0x[a-fA-F0-9]{40}$/.test(candidate) ? candidate : "";
}


function isLocalCommerceCheckoutDemoEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.VELMERE_LOCAL_COMMERCE_CHECKOUT_DEMO !== "false"
  );
}

async function localCommerceCheckoutDemoResponse(args: {
  req: Request;
  locale: string;
  items: CheckoutCartItem[];
  walletAddress: string;
  paymentMethod: "card" | "wallet";
  blockedLiveReasons: string[];
  pass4394Idempotency: Pass4394ClientRequestIdempotencyReceipt;
}) {
  const cartHash = createHash("sha256")
    .update(
      JSON.stringify({
        items: args.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId ?? "",
          size: item.size ?? item.selectedSize ?? "",
          quantity: item.quantity ?? 1,
        })),
        walletAddress: args.walletAddress,
        paymentMethod: args.paymentMethod,
      }),
    )
    .digest("hex");
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    new URL(args.req.url).origin;
  const sessionId = `velmere_demo_cart_${cartHash.slice(0, 16)}_${Date.now().toString(36)}`;
  const successParams = new URLSearchParams({
    session_id: sessionId,
    demo: "local-commerce-checkout",
    payment_method: args.paymentMethod,
  });
  if (args.walletAddress) successParams.set("wallet", `${args.walletAddress.slice(0, 6)}…${args.walletAddress.slice(-4)}`);
  return completePass4394ClientRequestJsonResponse({
    receipt: args.pass4394Idempotency,
    body: {
      ok: true,
      sessionId,
      url: `${siteUrl}/${args.locale}/checkout/success?${successParams.toString()}`,
      orderDraftId: `demo_${cartHash.slice(0, 12)}`,
      cartHash,
      demoMode: "local_commerce_checkout_demo_no_live_charge",
      paymentMethod: args.paymentMethod,
      walletConnected: Boolean(args.walletAddress),
      warning:
        "Local development only. No Stripe session or live charge was created; production still requires Stripe, legal/store readiness and webhook receipt.",
      blockedLiveReasons: args.blockedLiveReasons,
      pass4145: buildPass4145CommerceCheckoutReceiptBoundary({ cartHash }),
      pass4394Idempotency: args.pass4394Idempotency,
    },
  });
}

function compactMetadataValue(value: unknown, max = 500) {
  const raw = JSON.stringify(value);
  if (raw.length <= max) return raw;
  return JSON.stringify({ truncated: true, sha256: createHash("sha256").update(raw).digest("hex") });
}

export async function POST(req: Request) {
  const writeRate = await applyWriteApiRateLimit(req, "checkout");
  if (!writeRate.ok) return writeRate.response;
  const originGuard = assertSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== "production" });
  if (originGuard) return originGuard;
  const paymentGuard = validateCheckoutRequestBoundary(req);
  if (!paymentGuard.ok) return paymentGuard.response;

  const parsedBody = await readBoundedJsonBody<CheckoutRequestBody>(req, 64_000);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  const items = body?.items ?? [];
  const locale = body?.locale === "en" || body?.locale === "de" || body?.locale === "pl" ? body.locale : "pl";
  const walletAddress = normalizeWalletAddress(body?.walletAddress);
  const paymentMethod = body?.paymentMethod === "wallet" ? "wallet" : "card";
  if (!Array.isArray(items) || items.length === 0) return jsonError("Cart is empty.");
  if (items.length > MAX_CART_LINES) return jsonError("Cart contains too many line items.", 413);

  for (const item of items) {
    if (!item || typeof item.productId !== "string") return jsonError("Invalid cart item payload.");
  }
  const pass4394Idempotency = await registerPass4394ClientRequestMutation({
    request: req,
    action: "commerce_checkout_session_create",
    targetType: "commerce_checkout",
    actorId: walletAddress ? "public:wallet-provided" : "public:checkout",
    body,
  });
  if (!pass4394Idempotency.ok) {
    return pass4396IdempotencyReplayResponse({
      surface: "commerce_checkout",
      pass4394Idempotency,
    });
  }

  const readiness = getCheckoutReadiness();
  const storeCommercialReady = process.env.STORE_COMMERCIAL_READY === "true";
  if (readiness.mode !== "stripe" || !readiness.enabled || !storeCommercialReady) {
    const blockedLiveReasons = [
      ...(readiness.mode !== "stripe" || !readiness.enabled
        ? readiness.reasons
        : []),
      ...(storeCommercialReady
        ? []
        : [
            "STORE_COMMERCIAL_READY must be true before live apparel checkout.",
          ]),
    ];
    if (isLocalCommerceCheckoutDemoEnabled()) {
      return localCommerceCheckoutDemoResponse({
        req,
        locale,
        items,
        walletAddress,
        paymentMethod,
        blockedLiveReasons,
        pass4394Idempotency,
      });
    }
    return jsonError(
      "Checkout is disabled until Stripe, legal/store readiness and webhook receipt are configured.",
      503,
      blockedLiveReasons,
    );
  }

  const liveIdempotency = assessLiveCheckoutIdempotency(pass4394Idempotency);
  if (!liveIdempotency.ok) {
    return NextResponse.json(
      {
        error:
          liveIdempotency.code === "checkout_idempotency_key_required"
            ? "Live checkout requires a client request id."
            : "Live checkout requires durable idempotency storage.",
        code: liveIdempotency.code,
        retryable: liveIdempotency.retryable,
        retryWithNewClientRequestId: liveIdempotency.retryMode === "new_client_request_id",
        retryWithSameClientRequestId: liveIdempotency.retryMode === "same_client_request_id",
        idempotencyMode: liveIdempotency.storageMode,
      },
      {
        status: liveIdempotency.status,
        headers: {
          ...pass4394IdempotencyHeaders(pass4394Idempotency),
          "cache-control": "no-store",
          ...(liveIdempotency.status === 503 ? { "retry-after": "30" } : {}),
        },
      },
    );
  }

  const checkoutGuard = await buildProductCheckoutGuard({ items, locale, mode: "checkout" });
  if (!checkoutGuard.ok) {
    const firstBlocked = checkoutGuard.receipt.lines.find((line: ProductCheckoutGuardLineReceipt) => line.outcome === "blocked"); // PASS4144_CHECKOUT_GUARD_TYPED_BLOCKED_LINE
    return jsonError(firstBlocked?.message ?? "A product in the cart is not cleared for checkout.", 409, {
      checkoutGuard: checkoutGuard.receipt,
    });
  }

  const orderItems: OrderLineItem[] = checkoutGuard.lines.map((resolvedLine: ProductCheckoutGuardResolvedLine) => { // PASS4144_CHECKOUT_RESOLVED_LINE_TYPED_MAPPING
    const { product, variant, receipt } = resolvedLine;
    if (!product || !variant) throw new Error("checkout_guard_resolved_line_missing");
    const variantPrice = variant.price ?? product.price;
    return {
      productId: product.id,
      variantId: variant.id,
      quantity: receipt.quantity,
      title: `${getLocalizedString(product.title, locale)} / ${variant.title}`,
      amount: variantPrice.amount,
      currency: variantPrice.currency,
      provider: product.provider,
      fulfilmentMode: product.fulfilmentMode,
      providerVariantId: receipt.providerVariantId,
      selectedSize: receipt.selectedSize ?? variant.size,
    };
  });

  const metadataOrderItems = orderItems.map((item) => ({
    id: item.productId,
    q: item.quantity,
    size: item.selectedSize ?? item.variantId,
  }));
  const expectedAmountTotal = orderItems.reduce(
    (total, item) => total + item.amount * item.quantity,
    0,
  );
  const expectedCurrency = orderItems[0]?.currency ?? "EUR";
  if (
    !Number.isSafeInteger(expectedAmountTotal) ||
    expectedAmountTotal < 0 ||
    orderItems.some((item) => item.currency !== expectedCurrency)
  ) {
    return jsonError("Cart payment totals are inconsistent.", 409);
  }
  const cartHash = createHash("sha256").update(JSON.stringify(orderItems)).digest("hex");
  const stockReservation = await buildProviderStockReservationDraft({ checkoutGuard, cartHash });
  if (!stockReservation.ok) {
    const firstBlocked = stockReservation.receipt.lines.find((line: ProviderStockReservationLineReceipt) => line.outcome === "blocked"); // PASS4144_STOCK_RESERVATION_TYPED_BLOCKED_LINE
    return jsonError(firstBlocked?.message ?? "A product in the cart could not be reserved for checkout.", 409, {
      checkoutGuard: checkoutGuard.receipt,
      stockReservation: stockReservation.receipt,
    });
  }

  const order = createOrderDraft({
    locale,
    cartHash,
    lineItems: orderItems,
    walletAddress: walletAddress || undefined,
    guardSummary: {
      checkoutGuardReceiptId: checkoutGuard.receipt.receiptId,
      stockReservationReceiptId: stockReservation.receipt.receiptId,
      providerReservationId: stockReservation.receipt.reservationId,
      stockReservationMode: stockReservation.receipt.mode,
      stockReservationExpiresAt: stockReservation.receipt.expiresAt,
    },
  });
  const durableDraftState = await persistOrderDraftDurable({ order, sourceRoute: "app.api.checkout.create_order_draft" });
  if (!durableDraftState.persisted) {
    markFailed(order.id, "durable_order_draft_persistence_failed");
    await flushOrderEventStorageWrites();
    return NextResponse.json(
      {
        error: "Checkout could not create durable order state.",
        code: "durable_order_draft_required",
        retryable: true,
        retryWithNewClientRequestId: true,
        orderDraftId: order.id,
        durableOrderState: { draft: durableDraftState },
      },
      {
        status: 503,
        headers: {
          ...pass4394IdempotencyHeaders(pass4394Idempotency),
          "cache-control": "no-store",
          "retry-after": "30",
        },
      },
    );
  }

  const stripe = getStripeServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
  const stripeIdempotencyKey = `commerce_checkout_${createHash("sha256")
    .update([
      cartHash,
      pass4394Idempotency.idempotencyKeyHash ?? "missing",
      checkoutGuard.receipt.receiptId,
      stockReservation.receipt.receiptId,
    ].join("|"))
    .digest("hex")}`;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        success_url: `${siteUrl}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/${locale}/checkout/cancel?order=${order.id}`,
        billing_address_collection: "auto",
        shipping_address_collection: {
          allowed_countries: ALLOWED_SHIPPING_COUNTRIES,
        },
        line_items: orderItems.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: item.currency.toLowerCase(),
            unit_amount: item.amount,
            product_data: {
              name: item.title,
              metadata: {
                productId: item.productId,
                variantId: item.variantId,
                selectedSize: item.selectedSize ?? "",
              },
            },
          },
        })),
        metadata: {
          kind: "physical_commerce",
          orderDraftId: order.id,
          locale,
          walletAddress,
          orderItems: compactMetadataValue(metadataOrderItems),
          providerIds: orderItems.map((item) => `${item.provider}:${item.providerVariantId ?? "manual"}`).join(",").slice(0, 450),
          cartHash,
          expectedAmountTotal: String(expectedAmountTotal),
          expectedCurrency,
          checkoutGuardReceipt: checkoutGuard.receipt.receiptId,
          stockReservationReceipt: stockReservation.receipt.receiptId,
          providerReservationId: stockReservation.receipt.reservationId,
          stockReservation: compactMetadataValue(summarizeProviderStockReservation(stockReservation.receipt), 500),
          pass4394ClientRequestIdHash: pass4394Idempotency.clientRequestIdHash ?? "missing",
          pass4394IdempotencyKeyHash: pass4394Idempotency.idempotencyKeyHash ?? "missing",
        },
        payment_intent_data: {
          metadata: {
            kind: "physical_commerce",
            orderDraftId: order.id,
            cartHash,
            expectedAmountTotal: String(expectedAmountTotal),
            expectedCurrency,
            checkoutGuardReceipt: checkoutGuard.receipt.receiptId,
            stockReservationReceipt: stockReservation.receipt.receiptId,
          },
        },
      },
      { idempotencyKey: stripeIdempotencyKey },
    );
  } catch (error) {
    markFailed(order.id, "stripe_checkout_session_create_failed");
    await markDurableOrderFailed(order.id, "stripe_checkout_session_create_failed");
    await flushOrderEventStorageWrites();
    return publicApiError(error, {
      route: "/api/checkout",
      code: "stripe_checkout_session_create_failed",
      status: 502,
      headers: {
        ...pass4394IdempotencyHeaders(pass4394Idempotency),
        "retry-after": "30",
      },
    });
  }

  if (!session.id) {
    markFailed(order.id, "stripe_checkout_session_missing_id");
    const durableFailure = await markDurableOrderFailed(order.id, "stripe_checkout_session_missing_id");
    await flushOrderEventStorageWrites();
    return NextResponse.json(
      {
        error: "Stripe did not return a checkout session ID.",
        code: "stripe_checkout_session_missing_id",
        retryable: true,
        retryWithNewClientRequestId: true,
        orderDraftId: order.id,
        durableOrderState: { draft: durableDraftState, failure: durableFailure },
      },
      {
        status: 502,
        headers: {
          ...pass4394IdempotencyHeaders(pass4394Idempotency),
          "cache-control": "no-store",
          "retry-after": "30",
        },
      },
    );
  }

  markCheckoutStarted(order.id, session.id);
  const stripePaymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const durableCheckoutState = await markDurableCheckoutStarted(
    order.id,
    session.id,
    {
      amountTotal: expectedAmountTotal,
      currency: expectedCurrency,
      livemode: session.livemode,
      paymentIntentId: stripePaymentIntentId,
    },
  );
  if (!durableCheckoutState.persisted) {
    let stripeSessionExpired = false;
    let stripeRollbackError: string | null = null;
    let stripeRollbackCorrelationId: string | null = null;
    try {
      await stripe.checkout.sessions.expire(session.id);
      stripeSessionExpired = true;
    } catch (error) {
      const reported = reportApiError(error, {
        route: "/api/checkout",
        code: "stripe_session_expire_failed",
        status: 502,
      });
      stripeRollbackError = reported.publicCode;
      stripeRollbackCorrelationId = reported.correlationId;
    }
    markFailed(order.id, "durable_checkout_state_persistence_failed");
    const durableFailure = await markDurableOrderFailed(
      order.id,
      "durable_checkout_state_persistence_failed",
      session.id,
    );
    await flushOrderEventStorageWrites();
    return NextResponse.json(
      {
        error: "Checkout session was not released because durable checkout state could not be persisted.",
        code: "durable_checkout_state_required",
        retryable: true,
        retryWithNewClientRequestId: true,
        orderDraftId: order.id,
        stripeRollback: {
          attempted: true,
          sessionExpired: stripeSessionExpired,
          error: stripeRollbackError,
          correlationId: stripeRollbackCorrelationId,
        },
        durableOrderState: { draft: durableDraftState, checkout: durableCheckoutState, failure: durableFailure },
      },
      {
        status: 503,
        headers: {
          ...pass4394IdempotencyHeaders(pass4394Idempotency),
          "cache-control": "no-store",
          "retry-after": "30",
        },
      },
    );
  }
  await flushOrderEventStorageWrites();
  const orderTimeline = summarizeOrderTimeline(order.id);

  return completePass4394ClientRequestJsonResponse({
    receipt: pass4394Idempotency,
    body: {
      sessionId: session.id,
      url: session.url,
      orderDraftId: order.id,
      checkoutGuard: checkoutGuard.receipt,
      stockReservation: stockReservation.receipt,
      orderTimeline,
      durableOrderState: { draft: durableDraftState, checkout: durableCheckoutState },
      pass4394Idempotency,
      pass4145: buildPass4145CommerceCheckoutReceiptBoundary({
        cartHash,
        checkoutGuardReceiptId: checkoutGuard.receipt.receiptId,
        stockReservationReceiptId: stockReservation.receipt.receiptId,
      }),
      subtotal: formatMoney(
        {
          amount: orderItems.reduce((sum, item) => sum + item.amount * item.quantity, 0),
          currency: orderItems[0].currency,
        },
        locale,
      ),
    },
  });
}
