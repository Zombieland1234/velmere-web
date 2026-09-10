import { getVlmCurrentSkuTruth, type VlmCurrentSkuLocale } from "@/lib/commerce/vlm-current-sku-truth";

export type VlmTierDepth = "basic" | "pro" | "advanced";

/**
 * Current public SKU truth deliberately has no customer-visible numeric prices.
 * Historical amounts remain only in frozen evidence and legacy product identifiers.
 */
export const VLM_TIER_PRICE_EUR: Readonly<Record<VlmTierDepth, null>> = Object.freeze({
  basic: null,
  pro: null,
  advanced: null,
});

/** Public payment is disabled for every current tier. */
export function vlmTierRequiresPayment(_depth: VlmTierDepth) {
  return false;
}

export function vlmTierRequiresControlledAccess(depth: VlmTierDepth) {
  return depth === "pro";
}

export function vlmTierPriceEur(_depth: VlmTierDepth): null {
  return null;
}

/**
 * Compatibility name retained for downstream gates. It now means that the
 * requested non-Basic tier is unavailable without current server-bound access.
 * Advanced remains locked even if an old payment/entitlement marker exists.
 */
export function vlmTierPaidLocked(depth: VlmTierDepth, accessVerified: boolean | null | undefined) {
  if (depth === "basic") return false;
  if (depth === "advanced") return true;
  return !accessVerified;
}

export function vlmTierLabel(depth: VlmTierDepth) {
  return depth === "basic" ? "Basic" : depth === "pro" ? "Pro" : "Advanced";
}

export function vlmTierPriceLabel(depth: VlmTierDepth, locale: VlmCurrentSkuLocale = "en") {
  return getVlmCurrentSkuTruth(depth, locale).publicPriceLabel;
}

export function vlmTierAvailabilityLabel(depth: VlmTierDepth, locale: VlmCurrentSkuLocale = "en") {
  return getVlmCurrentSkuTruth(depth, locale).availabilityLabel;
}

export function vlmTierCurrentDecision(depth: VlmTierDepth) {
  return getVlmCurrentSkuTruth(depth, "en").decision;
}
