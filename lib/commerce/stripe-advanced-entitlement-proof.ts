import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { getStripeServerClient } from "@/lib/stripe/server";
import { getVlmPaidEntitlementRuntimeMode, requiresDurableVlmPaidEntitlementLedger } from "@/lib/commerce/vlm-entitlement-ledger";
import { listVlmPaidProducts } from "@/lib/commerce/vlm-paid-access";

export const PASS2180_STRIPE_ADVANCED_ENTITLEMENT_PROOF_ID = "pass2180-stripe-advanced-entitlement-runtime-proof" as const;

export type Pass2180ReadinessStatus = "PASS" | "BLOCKED_ENV" | "FAIL";

export type Pass2180ReadinessCheck = {
  name: string;
  ok: boolean;
  severity: "p0" | "p1" | "info";
  detail: string;
};

function secretReady(value: string | undefined, min = 8) {
  return Boolean(value && value.trim().length >= min && !value.includes("..."));
}

export function buildPass2180AdvancedEntitlementReadiness(env: NodeJS.ProcessEnv = process.env) {
  const runtimeMode = getVlmPaidEntitlementRuntimeMode();
  const productionLike = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  const commercialReady = env.VELMERE_SERVICES_COMMERCIAL_READY === "true";
  const checks: Pass2180ReadinessCheck[] = [
    {
      name: "checkout_mode_is_stripe",
      ok: env.CHECKOUT_MODE === "stripe",
      severity: "p0",
      detail: "VLM Advanced checkout must use Stripe before paid access is sold.",
    },
    {
      name: "stripe_secret_key_present",
      ok: secretReady(env.STRIPE_SECRET_KEY, 12),
      severity: "p0",
      detail: "Server Stripe key is required to create and retrieve Checkout Sessions.",
    },
    {
      name: "stripe_webhook_secret_present",
      ok: secretReady(env.STRIPE_WEBHOOK_SECRET, 12),
      severity: "p0",
      detail: "Webhook secret is required for Stripe-Signature verification.",
    },
    {
      name: "paid_access_secret_present",
      ok: secretReady(env.VELMERE_PAID_ACCESS_SECRET, 32),
      severity: "p0",
      detail: "Server-only VLM paid access secret must be at least 32 characters.",
    },
    {
      name: "site_url_present",
      ok: Boolean(env.NEXT_PUBLIC_SITE_URL || env.VERCEL_URL),
      severity: "p1",
      detail: "Checkout success/cancel URLs need a stable public site URL.",
    },
    {
      name: "commercial_ready_flag_true",
      ok: commercialReady,
      severity: "p0",
      detail: "Paid digital services must stay disabled until terms/tax/support/payment handling are ready.",
    },
    {
      name: "supabase_service_role_present",
      ok: hasSupabaseServiceRoleConfig(),
      severity: "p0",
      detail: "Advanced production access requires a durable Supabase entitlement row.",
    },
    {
      name: "production_requires_durable_ledger",
      ok: requiresDurableVlmPaidEntitlementLedger() || !productionLike,
      severity: "p0",
      detail: "Production/Vercel production must fail closed without durable entitlement ledger.",
    },
    {
      name: "token_only_fallback_not_production",
      ok: !productionLike || !runtimeMode.tokenOnlyFallbackAllowed,
      severity: "p0",
      detail: "Token-only fallback is allowed only for non-production/local proof work.",
    },
  ];

  const p0Blockers = checks.filter((check) => check.severity === "p0" && !check.ok).map((check) => check.name);
  const status: Pass2180ReadinessStatus = p0Blockers.length ? "BLOCKED_ENV" : "PASS";

  return {
    schemaVersion: "velmere.pass2180.advanced-entitlement-readiness.v1",
    passId: PASS2180_STRIPE_ADVANCED_ENTITLEMENT_PROOF_ID,
    generatedAt: new Date().toISOString(),
    status,
    productionLike,
    runtimeMode,
    products: listVlmPaidProducts("en").map((product) => ({
      id: product.id,
      amount: product.amount,
      currency: product.currency,
      accessScope: product.accessScope,
      boundaries: product.boundaries,
    })),
    paymentRailMatrix: [
      {
        rail: "stripe_card",
        unlocksAdvanced: true,
        requiredProof: "Stripe Checkout Session with payment_status=paid + verified webhook/checkout verification + durable entitlement row.",
      },
      {
        rail: "wallet_identity",
        unlocksAdvanced: false,
        requiredProof: "Wallet signature may bind an address to a user/session, but does not prove payment.",
      },
      {
        rail: "token_only_non_production",
        unlocksAdvancedInProduction: false,
        localFallbackAllowed: !runtimeMode.durableRequired,
        requiredProof: "Signed token fallback is local/non-production only and is denied when durableRequired=true.",
      },
      {
        rail: "manual_owner_grant",
        unlocksAdvanced: true,
        requiredProof: "Admin-only grant with durable audit event and expiry. Not implemented as a public route.",
      },
    ],
    checks,
    p0Blockers,
  };
}

export function assertPass2180StripeClientReadiness() {
  try {
    getStripeServerClient();
    return { ok: true as const, error: null };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "stripe_client_unavailable",
    };
  }
}
