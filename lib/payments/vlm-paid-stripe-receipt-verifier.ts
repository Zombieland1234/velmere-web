import type Stripe from "stripe";
import {
  getVlmPaidProduct,
  normalizePaidContext,
  normalizeVlmPaidProductId,
  type VlmPaidAccessContext,
  type VlmPaidProductId,
} from "@/lib/commerce/vlm-paid-access";
import { hashVlmPaidAccessContext } from "@/lib/commerce/vlm-paid-access-server";
import { resolvePass35ProductCellBinding } from "@/lib/commerce/pass35-product-cell-readiness";
import { normalizeVlmServicePaymentRail } from "@/lib/checkout/stripe-blik-readiness";
import { evaluateRuntimePaymentAuthority } from "@/lib/checkout/runtime-payment-authority";
import { evaluateVlmPaidStripeReceiptContract } from "@/lib/payments/vlm-paid-stripe-receipt-contract";

export type VerifiedVlmPaidStripeReceipt =
  | {
      ok: true;
      productId: VlmPaidProductId;
      context: VlmPaidAccessContext;
      contextHash: string;
      paymentIntent: Stripe.PaymentIntent;
      productCellId: string;
      productCellBindingSha256: string;
      mode: "test" | "live";
    }
  | {
      ok: false;
      error: string;
      retryable: boolean;
      terminal: boolean;
    };

function contextFromSession(session: Stripe.Checkout.Session): VlmPaidAccessContext {
  const locale = session.metadata?.locale === "pl" || session.metadata?.locale === "de"
    ? session.metadata.locale
    : "en";
  return normalizePaidContext({
    surface: session.metadata?.surface as VlmPaidAccessContext["surface"] | undefined,
    locale,
    assetId: session.metadata?.assetId || undefined,
    symbol: session.metadata?.symbol || undefined,
    depth: session.metadata?.depth as VlmPaidAccessContext["depth"] | undefined,
    requestId: session.metadata?.requestId || undefined,
    auditCaseRef: session.metadata?.auditCaseRef || undefined,
    accountIdHash: session.metadata?.accountIdHash || undefined,
    returnPath: session.metadata?.returnPath || undefined,
  }, locale);
}

function expectedPrice(
  session: Stripe.Checkout.Session,
  productId: VlmPaidProductId,
  locale: VlmPaidAccessContext["locale"],
) {
  const product = getVlmPaidProduct(productId, locale);
  const paymentRail = normalizeVlmServicePaymentRail(session.metadata?.paymentRail);
  if (paymentRail === "local_demo_zero_euro") {
    return null;
  }
  if (paymentRail !== "stripe_checkout_blik") {
    return { amount: product.amount, currency: product.currency, paymentRail };
  }
  const originalAmount = Number(session.metadata?.originalAmount);
  const stripeLineAmount = Number(session.metadata?.stripeLineAmount);
  const originalCurrency = session.metadata?.originalCurrency?.trim().toLowerCase();
  const stripeLineCurrency = session.metadata?.stripeLineCurrency?.trim().toLowerCase();
  if (
    !Number.isSafeInteger(originalAmount) ||
    originalAmount !== product.amount ||
    originalCurrency !== product.currency ||
    !Number.isSafeInteger(stripeLineAmount) ||
    stripeLineAmount <= 0 ||
    stripeLineCurrency !== "pln"
  ) return null;
  return { amount: stripeLineAmount, currency: stripeLineCurrency, paymentRail };
}

function paymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") return session.payment_intent.trim();
  return session.payment_intent?.id?.trim() ?? "";
}

export async function verifyVlmPaidStripeReceipt(args: {
  stripe: Stripe;
  session: Stripe.Checkout.Session;
  event?: Pick<Stripe.Event, "type" | "livemode">;
}): Promise<VerifiedVlmPaidStripeReceipt> {
  const authority = evaluateRuntimePaymentAuthority();
  if (authority.requestedMode === "missing" || !authority.modeMatches) {
    return { ok: false, error: "vlm_paid_runtime_mode_unavailable", retryable: true, terminal: false };
  }
  const expectedLivemode = authority.requestedMode === "live";
  const authorityOpen = expectedLivemode ? authority.livePaymentsAllowed : authority.testPaymentsAllowed;
  if (!authorityOpen) {
    return { ok: false, error: "vlm_paid_runtime_authority_closed", retryable: true, terminal: false };
  }

  const productId = normalizeVlmPaidProductId(args.session.metadata?.productId);
  if (!productId) {
    return { ok: false, error: "vlm_paid_product_invalid", retryable: false, terminal: true };
  }
  const context = contextFromSession(args.session);
  const contextHash = hashVlmPaidAccessContext(context);
  if (args.session.metadata?.contextHash !== contextHash || !context.accountIdHash) {
    return { ok: false, error: "vlm_paid_context_binding_mismatch", retryable: false, terminal: true };
  }
  const tier = productId.startsWith("vlm_pro_") ? "pro" : "advanced";
  const binding = resolvePass35ProductCellBinding({
    legacyProductId: productId,
    requestedProductCellId: args.session.metadata?.productCellId,
    surface: context.surface,
    tier,
  });
  if (!binding.ok || args.session.metadata?.productCellBindingSha256 !== binding.bindingSha256) {
    return { ok: false, error: "vlm_paid_product_cell_binding_mismatch", retryable: false, terminal: true };
  }
  const price = expectedPrice(args.session, productId, context.locale);
  if (!price) {
    return { ok: false, error: "vlm_paid_expected_price_invalid", retryable: false, terminal: true };
  }

  const intentId = paymentIntentId(args.session);
  if (!/^pi_[A-Za-z0-9_-]{4,176}$/u.test(intentId)) {
    return { ok: false, error: "vlm_paid_payment_intent_missing", retryable: true, terminal: false };
  }
  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = typeof args.session.payment_intent === "object" && args.session.payment_intent?.object === "payment_intent"
      ? args.session.payment_intent
      : await args.stripe.paymentIntents.retrieve(intentId);
  } catch {
    return { ok: false, error: "vlm_paid_payment_intent_retrieve_failed", retryable: true, terminal: false };
  }

  const eventType = args.event?.type ?? "server.verify";
  const eventLivemode = args.event?.livemode ?? expectedLivemode;
  const verdict = evaluateVlmPaidStripeReceiptContract({
    session: args.session,
    paymentIntent,
    expected: {
      eventType,
      eventLivemode,
      expectedLivemode,
      productId,
      productCellId: binding.productCell.productCellId,
      productCellBindingSha256: binding.bindingSha256,
      contextHash,
      accountIdHash: context.accountIdHash,
      paymentRail: price.paymentRail,
      amount: price.amount,
      currency: price.currency,
    },
  });
  if (!verdict.ok) return verdict;
  return {
    ok: true,
    productId,
    context,
    contextHash,
    paymentIntent,
    productCellId: binding.productCell.productCellId,
    productCellBindingSha256: binding.bindingSha256,
    mode: verdict.mode,
  };
}
