import { getStoreCheckoutReadiness, type CheckoutReadinessReason } from "@/lib/checkout/readiness";
import {
  evaluateRuntimePaymentAuthority,
  runtimePaymentModeAllowed,
} from "@/lib/checkout/runtime-payment-authority";

export type CheckoutMode = "disabled" | "stripe";

export type CheckoutReadiness = {
  mode: CheckoutMode;
  stripeConfigured: boolean;
  siteUrlConfigured: boolean;
  enabled: boolean;
  reasons: string[];
};

export function getCheckoutMode(): CheckoutMode {
  const mode = process.env.CHECKOUT_MODE;
  if (mode === "stripe") return mode;
  return "disabled";
}

export function getCheckoutReadiness(): CheckoutReadiness {
  const mode = getCheckoutMode();
  const stripeConfigured = Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET,
  );
  const siteUrlConfigured = Boolean(process.env.NEXT_PUBLIC_SITE_URL);
  const reasons: string[] = [];
  const storeReadiness = getStoreCheckoutReadiness();
  const paymentAuthority = evaluateRuntimePaymentAuthority();

  if (mode === "disabled") reasons.push("CHECKOUT_MODE is disabled.");
  if (mode === "stripe" && !stripeConfigured) {
    reasons.push("Stripe checkout requires STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET.");
  }
  if (!siteUrlConfigured) reasons.push("NEXT_PUBLIC_SITE_URL is required for checkout redirects.");
  if (!runtimePaymentModeAllowed(paymentAuthority)) {
    reasons.push(...paymentAuthority.blockers);
  }
  reasons.push(...storeReadiness.reasons.map((reason: CheckoutReadinessReason) => reason.message)); // PASS4144_CHECKOUT_READINESS_REASON_TYPED

  return {
    mode,
    stripeConfigured,
    siteUrlConfigured,
    enabled: mode === "stripe" && stripeConfigured && siteUrlConfigured && storeReadiness.enabled,
    reasons,
  };
}
