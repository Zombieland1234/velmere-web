export const PASS1734_RUNTIME_CLEANLINESS_VERSION = "pass1734-1773-popup-cart-minimalism-audit" as const;

export const PASS1734_RUNTIME_CLEANLINESS_LANES = [
  "header_language_wallet_account_dropdowns",
  "cart_bottom_sheet_visibility",
  "rectangular_asset_modal_only",
  "chart_wheel_zoom_ownership",
  "real_markets_minimal_table_flow",
  "mobile_safe_area_and_overflow",
  "color_noise_reduction",
  "z_index_scroll_lock_audit",
] as const;

export type Pass1734RuntimeCleanlinessLane =
  (typeof PASS1734_RUNTIME_CLEANLINESS_LANES)[number];

export type Pass1734RuntimeCleanlinessChecklistItem = {
  id: string;
  lane: Pass1734RuntimeCleanlinessLane;
  label: string;
  required: true;
};

export const PASS1734_RUNTIME_CLEANLINESS_CHECKLIST: readonly Pass1734RuntimeCleanlinessChecklistItem[] = [
  { id: "dropdown-language-visible", lane: "header_language_wallet_account_dropdowns", label: "Language dropdown is anchored, bounded and cannot render from the left corner.", required: true },
  { id: "dropdown-wallet-visible", lane: "header_language_wallet_account_dropdowns", label: "Wallet dropdown is visible on mobile/desktop and never asks for seed phrases.", required: true },
  { id: "dropdown-account-visible", lane: "header_language_wallet_account_dropdowns", label: "Account dropdown uses unique keys and does not collide with /account links.", required: true },
  { id: "dropdown-exclusive-open", lane: "header_language_wallet_account_dropdowns", label: "Opening one header surface closes the other header surfaces.", required: true },
  { id: "dropdown-focus-return", lane: "header_language_wallet_account_dropdowns", label: "Escape/outside click returns focus only to a visible trigger.", required: true },
  { id: "cart-bottom-sheet-only", lane: "cart_bottom_sheet_visibility", label: "Cart opens as a bottom sheet only, never as a left/right ghost panel.", required: true },
  { id: "cart-safe-area", lane: "cart_bottom_sheet_visibility", label: "Cart respects safe areas and owns its internal scroll region.", required: true },
  { id: "cart-header-arbiter", lane: "cart_bottom_sheet_visibility", label: "Cart opening closes language/wallet/account/menu surfaces first.", required: true },
  { id: "cart-no-bg-scroll", lane: "cart_bottom_sheet_visibility", label: "Cart locks background scroll and keeps item/footer scroll contained.", required: true },
  { id: "asset-modal-rectangular", lane: "rectangular_asset_modal_only", label: "Shield and Real Markets use the same rectangular modal grammar.", required: true },
  { id: "asset-no-bubble-orb", lane: "rectangular_asset_modal_only", label: "Public bubble/orbit/circular analysis overlay is suppressed in market modals.", required: true },
  { id: "asset-depth-rail", lane: "rectangular_asset_modal_only", label: "Basic/Pro/Advanced are attached rectangular rail controls.", required: true },
  { id: "asset-close-visible", lane: "rectangular_asset_modal_only", label: "Modal close is visible, keyboard reachable and above the chart.", required: true },
  { id: "chart-wheel-owner", lane: "chart_wheel_zoom_ownership", label: "Wheel/pinch belongs to the chart and must not move the modal/page.", required: true },
  { id: "chart-pointer-throttle", lane: "chart_wheel_zoom_ownership", label: "Pointer hover/drag stays throttled and contained.", required: true },
  { id: "chart-touch-none", lane: "chart_wheel_zoom_ownership", label: "Touch gestures stay inside the chart panel on mobile.", required: true },
  { id: "real-markets-no-extra-pills", lane: "real_markets_minimal_table_flow", label: "Real Markets avoids extra hero pills and keeps sort controls inline.", required: true },
  { id: "real-markets-single-table", lane: "real_markets_minimal_table_flow", label: "Real Markets presents one calm table before the modal.", required: true },
  { id: "real-markets-source-first", lane: "real_markets_minimal_table_flow", label: "Source truth appears before AI copy; no fake live claims.", required: true },
  { id: "mobile-depth-row", lane: "mobile_safe_area_and_overflow", label: "Basic/Pro/Advanced collapse into a compact three-button row on small screens.", required: true },
  { id: "mobile-no-horizontal-overflow", lane: "mobile_safe_area_and_overflow", label: "No horizontal overflow from chart, dropdown, PDF or cart surfaces.", required: true },
  { id: "mobile-tap-targets", lane: "mobile_safe_area_and_overflow", label: "Header/cart/modal controls keep app-like tap targets.", required: true },
  { id: "minimal-color-system", lane: "color_noise_reduction", label: "Gold remains the primary accent; cyan is restricted to source/analysis states.", required: true },
  { id: "minimal-backgrounds", lane: "color_noise_reduction", label: "Market modals reduce decorative gradients and keep readable contrast.", required: true },
  { id: "minimal-copy-density", lane: "color_noise_reduction", label: "Hero/status copy stays short and does not create dashboard clutter.", required: true },
  { id: "z-index-constitution", lane: "z_index_scroll_lock_audit", label: "Dropdowns, drawers and modals use the shared overlay constitution.", required: true },
  { id: "scroll-lock-ref-count", lane: "z_index_scroll_lock_audit", label: "Nested modals/drawers keep reference-counted scroll lock.", required: true },
  { id: "body-portal-surfaces", lane: "z_index_scroll_lock_audit", label: "Popup, cart and modal surfaces render through BodyPortal.", required: true },
  { id: "runtime-data-markers", lane: "z_index_scroll_lock_audit", label: "All critical surfaces expose data markers for Playwright/runtime QA.", required: true },
] as const;

export function getPass1734RuntimeCleanlinessSummary() {
  return {
    version: PASS1734_RUNTIME_CLEANLINESS_VERSION,
    lanes: PASS1734_RUNTIME_CLEANLINESS_LANES,
    requiredChecks: PASS1734_RUNTIME_CLEANLINESS_CHECKLIST.length,
    publicModalRule: "rectangular-chart-attached-depth-rail-only",
    cartRule: "bottom-sheet-only",
    dropdownRule: "anchored-bounded-exclusive",
    blockedPatterns: [
      "public bubble/orbit asset modal",
      "left-corner dropdown fallback",
      "cart as side drawer",
      "background scroll while modal/cart is open",
      "uncapped decorative color noise",
    ],
  } as const;
}
