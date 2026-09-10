import { createHash } from "node:crypto";

export type Pass4651CommercialTier = "basic" | "pro" | "advanced";
export type Pass4651CommercialSurface = "shield" | "real_markets" | "lens_pdf" | "contract_audit";
export type Pass4651CommercialDeliveryState =
  | "free_prescreen_ready"
  | "free_prescreen_degraded"
  | "checkout_blocked_not_sell_ready"
  | "payment_required"
  | "paid_analysis_pending"
  | "manual_review_required"
  | "paid_delivery_ready"
  | "paid_delivery_blocked_retry_or_credit";

export type Pass4651CommercialDeliveryDecision = {
  schemaVersion: "pass4651_commercial_delivery_state_v1";
  tier: Pass4651CommercialTier;
  surface: Pass4651CommercialSurface;
  state: Pass4651CommercialDeliveryState;
  checkoutAllowed: boolean;
  captureAllowed: boolean;
  deliveryAllowed: boolean;
  entitlementMustBePreserved: boolean;
  retryAllowed: boolean;
  manualReviewRequired: boolean;
  compensationRequired: boolean;
  recommendedAction:
    | "deliver_free_prescreen"
    | "show_degraded_free_prescreen"
    | "block_checkout"
    | "request_payment"
    | "hold_capture_and_retry"
    | "queue_manual_review"
    | "deliver_paid_artifact"
    | "preserve_entitlement_retry_or_refund";
  blockers: string[];
  warnings: string[];
  decisionHash: string;
};

export type Pass4651CommercialDeliveryInput = {
  tier: Pass4651CommercialTier;
  surface: Pass4651CommercialSurface;
  entitlementVerified: boolean;
  preCheckoutReady: boolean;
  analysisSellReady: boolean;
  durableEvidenceReady: boolean;
  outputReady: boolean;
  providerDegraded?: boolean;
  operatorSignReady?: boolean;
};

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(",")}}`;
}

function hashDecision(value: unknown) {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function buildPass4651CommercialDeliveryDecision(input: Pass4651CommercialDeliveryInput): Pass4651CommercialDeliveryDecision {
  const operatorSignReady = input.tier !== "advanced" || input.operatorSignReady === true;
  const providerDegraded = input.providerDegraded === true;
  const paidTier = input.tier !== "basic";

  let state: Pass4651CommercialDeliveryState;
  let recommendedAction: Pass4651CommercialDeliveryDecision["recommendedAction"];
  let checkoutAllowed = false;
  let captureAllowed = false;
  let deliveryAllowed = false;
  let entitlementMustBePreserved = false;
  let retryAllowed = false;
  let manualReviewRequired = false;
  let compensationRequired = false;

  if (!paidTier) {
    const freeReady = input.analysisSellReady && input.outputReady && !providerDegraded;
    state = freeReady ? "free_prescreen_ready" : "free_prescreen_degraded";
    recommendedAction = freeReady ? "deliver_free_prescreen" : "show_degraded_free_prescreen";
    checkoutAllowed = true;
    deliveryAllowed = input.outputReady;
    retryAllowed = !freeReady;
  } else if (!input.entitlementVerified) {
    if (!input.preCheckoutReady || !input.analysisSellReady || !input.durableEvidenceReady || providerDegraded) {
      state = "checkout_blocked_not_sell_ready";
      recommendedAction = "block_checkout";
      checkoutAllowed = false;
      retryAllowed = true;
    } else {
      state = "payment_required";
      recommendedAction = "request_payment";
      checkoutAllowed = true;
      captureAllowed = false;
    }
  } else if (providerDegraded || !input.analysisSellReady || !input.durableEvidenceReady) {
    state = "paid_delivery_blocked_retry_or_credit";
    recommendedAction = "preserve_entitlement_retry_or_refund";
    entitlementMustBePreserved = true;
    retryAllowed = true;
    compensationRequired = true;
  } else if (!operatorSignReady) {
    state = "manual_review_required";
    recommendedAction = "queue_manual_review";
    entitlementMustBePreserved = true;
    retryAllowed = true;
    manualReviewRequired = true;
  } else if (!input.outputReady) {
    state = "paid_analysis_pending";
    recommendedAction = "hold_capture_and_retry";
    entitlementMustBePreserved = true;
    retryAllowed = true;
  } else {
    state = "paid_delivery_ready";
    recommendedAction = "deliver_paid_artifact";
    checkoutAllowed = true;
    captureAllowed = true;
    deliveryAllowed = true;
    entitlementMustBePreserved = true;
  }

  const blockers = unique([
    paidTier && !input.entitlementVerified ? "paid_entitlement_not_verified" : null,
    !input.preCheckoutReady ? "precheckout_value_not_proven" : null,
    !input.analysisSellReady ? "analysis_not_sell_ready" : null,
    !input.durableEvidenceReady ? "durable_evidence_not_ready" : null,
    !input.outputReady ? "customer_output_not_ready" : null,
    providerDegraded ? "provider_runtime_degraded" : null,
    !operatorSignReady ? "advanced_operator_sign_missing" : null,
  ]);
  const warnings = unique([
    state === "paid_delivery_blocked_retry_or_credit" ? "paid_customer_must_not_lose_entitlement" : null,
    compensationRequired ? "service_credit_or_refund_policy_required" : null,
    manualReviewRequired ? "automated_delivery_suspended" : null,
  ]);
  const decisionCore = {
    schemaVersion: "pass4651_commercial_delivery_state_v1" as const,
    tier: input.tier,
    surface: input.surface,
    state,
    checkoutAllowed,
    captureAllowed,
    deliveryAllowed,
    entitlementMustBePreserved,
    retryAllowed,
    manualReviewRequired,
    compensationRequired,
    recommendedAction,
    blockers,
    warnings,
  };
  return { ...decisionCore, decisionHash: hashDecision(decisionCore) };
}
