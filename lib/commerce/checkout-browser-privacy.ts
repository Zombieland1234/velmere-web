export const PASS36_A102R8_CHECKOUT_BROWSER_PRIVACY_BOUNDARY_ID =
  "pass36-a102r8-checkout-customer-browser-privacy-v1" as const;

export const LEGACY_CHECKOUT_DRAFT_KEYS = [
  "velmere-checkout-draft-pl",
  "velmere-checkout-draft-en",
  "velmere-checkout-draft-de",
] as const;

type RemovableStorage = Pick<Storage, "removeItem">;

export function purgeLegacyCheckoutPiiDrafts(
  storage?: RemovableStorage | null,
) {
  const target = storage ?? (
    typeof window !== "undefined" ? window.localStorage : null
  );
  if (!target) return 0;
  let attempted = 0;
  for (const key of LEGACY_CHECKOUT_DRAFT_KEYS) {
    try {
      target.removeItem(key);
      attempted += 1;
    } catch {
      // Cleanup is best effort. Legacy contents are never read or migrated.
    }
  }
  return attempted;
}
