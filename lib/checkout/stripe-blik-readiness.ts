import type { VlmPaidProduct, VlmPaidProductId } from "@/lib/commerce/vlm-paid-access";
import {
  evaluateRuntimePaymentAuthority,
  runtimePaymentModeAllowed,
} from "@/lib/checkout/runtime-payment-authority";

export const PASS2364_STRIPE_BLIK_REPLAY_ID = "pass2364-stripe-test-blik-webhook-replay-readiness" as const;

export type VlmServicePaymentRail =
  | "stripe_checkout_auto"
  | "stripe_checkout_card"
  | "stripe_checkout_blik"
  | "local_demo_zero_euro";

export type PaymentReadinessItem = {
  id: string;
  label: string;
  ready: boolean;
  progress: number;
  note: string;
};

export type VlmServicePaymentRailReadiness = {
  passId: typeof PASS2364_STRIPE_BLIK_REPLAY_ID;
  paymentRail: VlmServicePaymentRail;
  enabledForStripeSession: boolean;
  mode: "stripe_checkout" | "local_demo" | "blocked";
  stripeMode: "test" | "live" | "missing" | "mixed";
  productId: VlmPaidProductId;
  displayPrice: string;
  stripeLineCurrency: "eur" | "pln";
  stripeLineAmount: number;
  paymentMethodTypes?: ["card"] | ["blik"];
  checklist: PaymentReadinessItem[];
  blockers: string[];
  operatorReplay: {
    required: string[];
    stripeCliHint: string;
    expectedWebhook: string;
    duplicateReplayExpected: string;
  };
  productionBoundary: string;
};

const PRODUCT_TO_BLIK_PLN_ENV: Record<VlmPaidProductId, string> = {
  vlm_pro_analysis_single: "VELMERE_BLIK_PRO_ANALYSIS_PLN_AMOUNT",
  vlm_pro_pdf_single: "VELMERE_BLIK_PRO_PDF_PLN_AMOUNT",
  vlm_pro_audit_review: "VELMERE_BLIK_PRO_AUDIT_PLN_AMOUNT",
  vlm_advanced_analysis_single: "VELMERE_BLIK_ADVANCED_ANALYSIS_PLN_AMOUNT",
  vlm_advanced_pdf_single: "VELMERE_BLIK_ADVANCED_PDF_PLN_AMOUNT",
  vlm_advanced_audit_human_review: "VELMERE_BLIK_ADVANCED_AUDIT_PLN_AMOUNT",
};

function envFlag(name: string) {
  return process.env[name] === "true";
}

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function positiveInt(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const floored = Math.floor(parsed);
  return floored > 0 ? floored : null;
}

export function normalizeVlmServicePaymentRail(value: unknown): VlmServicePaymentRail {
  if (value === "stripe_checkout_card" || value === "card") return "stripe_checkout_card";
  if (value === "stripe_checkout_blik" || value === "blik") return "stripe_checkout_blik";
  if (value === "local_demo_zero_euro") return "local_demo_zero_euro";
  return "stripe_checkout_auto";
}

export function getBlikPlnAmountForProduct(productId: VlmPaidProductId) {
  const envName = PRODUCT_TO_BLIK_PLN_ENV[productId];
  return { envName, amount: positiveInt(process.env[envName]) };
}

function item(id: string, label: string, ready: boolean, note: string, progress = ready ? 100 : 0): PaymentReadinessItem {
  return { id, label, ready, progress, note };
}

export function buildVlmServicePaymentRailReadiness(args: {
  product: VlmPaidProduct;
  paymentRail?: VlmServicePaymentRail;
}): VlmServicePaymentRailReadiness {
  const rail = args.paymentRail ?? "stripe_checkout_auto";
  const paymentAuthority = evaluateRuntimePaymentAuthority();
  const stripeMode = paymentAuthority.credentialMode;
  const blik = getBlikPlnAmountForProduct(args.product.id);
  const wantsBlik = rail === "stripe_checkout_blik";
  const wantsCard = rail === "stripe_checkout_card";
  const stripeBaseReady =
    process.env.CHECKOUT_MODE === "stripe" &&
    hasEnv("STRIPE_SECRET_KEY") &&
    hasEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") &&
    hasEnv("NEXT_PUBLIC_SITE_URL") &&
    runtimePaymentModeAllowed(paymentAuthority);
  const serviceReady = envFlag("VELMERE_SERVICES_COMMERCIAL_READY");
  const webhookReady = hasEnv("STRIPE_WEBHOOK_SECRET");
  const testModeExpected =
    paymentAuthority.requestedMode === "test" &&
    stripeMode === "test" &&
    paymentAuthority.modeMatches;
  const blikDashboardReady = envFlag("VELMERE_STRIPE_BLIK_ENABLED");
  const blikPlnReady = Boolean(blik.amount);

  const checklist: PaymentReadinessItem[] = [
    item("checkout-mode", "CHECKOUT_MODE=stripe", process.env.CHECKOUT_MODE === "stripe", "Server checkout route can create Stripe sessions only in stripe mode."),
    item("stripe-keys", "Stripe key pair present", hasEnv("STRIPE_SECRET_KEY") && hasEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"), `Detected Stripe mode: ${stripeMode}.`),
    item(
      "payment-authority",
      "Runtime payment authority",
      runtimePaymentModeAllowed(paymentAuthority),
      paymentAuthority.blockers.join(" ") || `Explicit ${paymentAuthority.requestedMode} payment authority is ready.`,
    ),
    item("site-url", "NEXT_PUBLIC_SITE_URL present", hasEnv("NEXT_PUBLIC_SITE_URL"), "Success/cancel URLs must be same-site and deterministic."),
    item("webhook-secret", "STRIPE_WEBHOOK_SECRET present", webhookReady, "Webhook signature verification must exist before paid unlock."),
    item("service-commercial-ready", "VLM services commercial gate", serviceReady, "Advanced services stay fail-closed until terms/tax/support flow are ready."),
    item("test-mode", "Stripe test-mode rail", testModeExpected, "Sandbox replay should use pk_test_/sk_test_ keys before any live traffic.", testModeExpected ? 100 : 45),
  ];

  if (wantsBlik) {
    checklist.push(
      item("blik-enabled", "BLIK enabled in Stripe/payment config", blikDashboardReady, "BLIK is opt-in: keep false until Stripe Dashboard/payment method readiness is confirmed."),
      item("blik-pln-line", "BLIK PLN line item configured", blikPlnReady, `${blik.envName} must be an integer amount in grosz; BLIK checkout cannot use the current EUR product line.`),
      item("blik-one-time-boundary", "BLIK one-time receipt boundary", true, "Treat BLIK as one-use, customer-authenticated, webhook-verified payment proof; never unlock from client state alone."),
    );
  }

  const blockers = checklist.filter((entry) => !entry.ready).map((entry) => `${entry.id}: ${entry.note}`);
  const stripeLineCurrency: "eur" | "pln" = wantsBlik ? "pln" : args.product.currency;
  const stripeLineAmount = wantsBlik ? blik.amount ?? 0 : args.product.amount;
  const enabledForStripeSession = wantsBlik
    ? stripeBaseReady && serviceReady && webhookReady && blikDashboardReady && blikPlnReady
    : stripeBaseReady && serviceReady && webhookReady;

  return {
    passId: PASS2364_STRIPE_BLIK_REPLAY_ID,
    paymentRail: rail,
    enabledForStripeSession,
    mode: enabledForStripeSession ? "stripe_checkout" : process.env.NODE_ENV === "production" ? "blocked" : "local_demo",
    stripeMode,
    productId: args.product.id,
    displayPrice: wantsBlik && blik.amount ? `${(blik.amount / 100).toFixed(2)} PLN` : args.product.priceLabel,
    stripeLineCurrency,
    stripeLineAmount,
    paymentMethodTypes: wantsBlik ? ["blik"] : wantsCard ? ["card"] : undefined,
    checklist,
    blockers,
    operatorReplay: {
      required: [
        "Stripe CLI or Dashboard event replay for checkout.session.completed",
        "signed webhook reaches /api/stripe/webhook",
        "first event writes a controlled-beta entitlement ledger and analysisQueueId for an eligible Pro invitation",
        "second replay of the same event returns duplicate without duplicate queue side effects",
      ],
      stripeCliHint: "stripe listen --forward-to localhost:3000/api/stripe/webhook, then complete a test Checkout Session and replay the event id once.",
      expectedWebhook: "checkout.session.completed → vlm_paid_access → active controlled-beta entitlement → optional analysis_queue",
      duplicateReplayExpected: "duplicate=true and no second entitlement/audit queue side effect",
    },
    productionBoundary:
      "PASS2364 keeps production fail-closed: public checkout remains disabled; any controlled Pro beta entitlement requires a server-verified TEST receipt, signed webhook or server retrieve verification, and an entitlement ledger. Advanced remains NOT_FOR_SALE. Wallet connect and client params are not payment proof.",
  };
}
