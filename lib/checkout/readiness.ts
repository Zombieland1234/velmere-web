import { getMerchantLegalReadiness } from "@/lib/legal/merchant-legal-registry";
import { hasCompleteAutomaticFulfilment } from "@/lib/products/catalog";
import type { Product } from "@/lib/products/types";
import {
  evaluateRuntimePaymentAuthority,
  runtimePaymentModeAllowed,
} from "@/lib/checkout/runtime-payment-authority";

export type CheckoutReadinessReason = {
  code: string;
  message: string;
};

export type CheckoutReadiness = {
  enabled: boolean;
  reasons: CheckoutReadinessReason[];
};

function hasEnv(name: string) {
  return Boolean(process.env[name]);
}

function flagEnabled(name: string) {
  return process.env[name] === "true";
}

export function getStoreCheckoutReadiness(product?: Product): CheckoutReadiness {
  const reasons: CheckoutReadinessReason[] = [];
  const paymentAuthority = evaluateRuntimePaymentAuthority();
  const merchantLegal = getMerchantLegalReadiness();
  if (!merchantLegal.ready) {
    for (const field of merchantLegal.missingProfileFields) {
      reasons.push({ code: `merchant_profile_${field}`, message: `Verified merchant profile field is missing: ${field}.` });
    }
    for (const policy of merchantLegal.incompletePolicies) {
      reasons.push({ code: `merchant_policy_${policy}`, message: `Merchant legal policy is not approved: ${policy}.` });
    }
  }

  if (process.env.CHECKOUT_MODE !== "stripe") {
    reasons.push({ code: "checkout_mode", message: "CHECKOUT_MODE must be stripe." });
  }
  if (!hasEnv("STRIPE_SECRET_KEY")) {
    reasons.push({ code: "stripe_secret", message: "STRIPE_SECRET_KEY is missing." });
  }
  if (!hasEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")) {
    reasons.push({ code: "stripe_publishable", message: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing." });
  }
  if (!hasEnv("STRIPE_WEBHOOK_SECRET")) {
    reasons.push({ code: "stripe_webhook", message: "STRIPE_WEBHOOK_SECRET is missing." });
  }
  if (!hasEnv("NEXT_PUBLIC_SITE_URL")) {
    reasons.push({ code: "site_url", message: "NEXT_PUBLIC_SITE_URL is required for redirects." });
  }
  if (!runtimePaymentModeAllowed(paymentAuthority)) {
    for (const blocker of paymentAuthority.blockers) {
      reasons.push({ code: "payment_authority", message: blocker });
    }
  }
  if (!hasEnv("NEXT_PUBLIC_SUPABASE_URL") || !hasEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    reasons.push({
      code: "durable_order_state",
      message: "Live checkout requires Supabase service-role storage for durable order drafts and state events.",
    });
  }
  if (!flagEnabled("STORE_COMMERCIAL_READY")) {
    reasons.push({ code: "commercial_ready", message: "STORE_COMMERCIAL_READY must be true." });
  }
  if (!flagEnabled("STORE_SELLER_ADDRESS_READY")) {
    reasons.push({ code: "seller_address", message: "Full seller address must be finalized." });
  }
  if (!flagEnabled("STORE_SHIPPING_RATES_READY")) {
    reasons.push({ code: "shipping_rates", message: "Shipping rates must be configured." });
  }
  if (!flagEnabled("STORE_RETURNS_POLICY_FINAL")) {
    reasons.push({ code: "returns_policy", message: "Returns policy must be final." });
  }
  if (!flagEnabled("STORE_PRIVACY_POLICY_FINAL")) {
    reasons.push({ code: "privacy_policy", message: "Privacy policy must be final." });
  }
  if (!flagEnabled("STORE_TAX_READY")) {
    reasons.push({ code: "tax_ready", message: "Tax/VAT handling must be finalized." });
  }
  if (!flagEnabled("STORE_FULFILMENT_READY")) {
    reasons.push({ code: "fulfilment_ready", message: "Fulfilment workflow must be production-ready." });
  }

  if (product) {
    if (product.status !== "active") {
      reasons.push({ code: "product_status", message: "Product must be active." });
    }
    if (product.price.amount <= 0) {
      reasons.push({ code: "product_price", message: "Product price must be real." });
    }
    if (product.variants.length === 0) {
      reasons.push({ code: "product_variants", message: "Product variants are required." });
    }
    if (product.images.length === 0) {
      reasons.push({ code: "product_images", message: "Product images are required." });
    }
    if (!hasCompleteAutomaticFulfilment(product)) {
      reasons.push({ code: "provider_mapping", message: "Automatic fulfilment requires provider variant mapping." });
    }
  }

  return {
    enabled: reasons.length === 0,
    reasons,
  };
}
