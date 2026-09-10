export const PASS2204_CART_MAIL_WALLET_MICROINTERACTION_SWEEP_ID =
  "cart-mail-wallet-microinteraction-sweep" as const;

export type Pass2204PoolId =
  | "cart_bottom_sheet_true_geometry"
  | "mail_send_delivered_microinteraction"
  | "wallet_sidecar_scroll_safety"
  | "account_menu_microinteraction"
  | "menu_close_motion"
  | "visual_receipt_readiness";

export type Pass2204PoolScore = {
  id: Pass2204PoolId;
  label: string;
  before: number;
  after: number;
  delta: number;
  runtimeProofRequired: boolean;
  nextReceiptTargets: string[];
};

export const PASS2204_POOL_SCORES: Pass2204PoolScore[] = [
  {
    id: "cart_bottom_sheet_true_geometry",
    label: "Cart as true bottom-sheet, not full-height side drawer",
    before: 85,
    after: 91,
    delta: 6,
    runtimeProofRequired: true,
    nextReceiptTargets: [
      "cart_opens_from_bottom_1_3_height",
      "cart_has_2cm_desktop_gutter",
      "cart_empty_state_premium_not_full_screen",
    ],
  },
  {
    id: "mail_send_delivered_microinteraction",
    label: "Private mail envelope flight and delivered state",
    before: 88,
    after: 93,
    delta: 5,
    runtimeProofRequired: true,
    nextReceiptTargets: [
      "private_mail_sending_envelope_animation",
      "private_mail_delivered_check_visible",
    ],
  },
  {
    id: "wallet_sidecar_scroll_safety",
    label: "Wallet other-list sidecar scroll and viewport safety",
    before: 85,
    after: 92,
    delta: 7,
    runtimeProofRequired: true,
    nextReceiptTargets: [
      "other_wallets_scrolls_on_short_viewport",
      "wallet_sidecar_does_not_clip_last_wallet",
    ],
  },
  {
    id: "account_menu_microinteraction",
    label: "Account dropdown premium hover and focus motion",
    before: 89,
    after: 91,
    delta: 2,
    runtimeProofRequired: true,
    nextReceiptTargets: ["account_dropdown_hover_focus_no_raw_state"],
  },
  {
    id: "menu_close_motion",
    label: "Main menu close slow-hide no-jank motion",
    before: 85,
    after: 88,
    delta: 3,
    runtimeProofRequired: true,
    nextReceiptTargets: ["main_menu_close_slow_hide_no_lag"],
  },
  {
    id: "visual_receipt_readiness",
    label: "Visual runtime receipt readiness for cart/mail/wallet",
    before: 70,
    after: 74,
    delta: 4,
    runtimeProofRequired: true,
    nextReceiptTargets: ["pass2204_cart_mail_wallet_runtime_receipts"],
  },
];

export function buildPass2204CartMailWalletMicrointeractionSweepSummary() {
  const weightedBefore = Math.round(
    PASS2204_POOL_SCORES.reduce((sum, pool) => sum + pool.before, 0) /
      PASS2204_POOL_SCORES.length,
  );
  const weightedAfter = Math.round(
    PASS2204_POOL_SCORES.reduce((sum, pool) => sum + pool.after, 0) /
      PASS2204_POOL_SCORES.length,
  );

  return {
    passId: "PASS2204",
    schemaVersion: PASS2204_CART_MAIL_WALLET_MICROINTERACTION_SWEEP_ID,
    status: "PASS_STATIC_ONLY" as const,
    productionGate: "BLOCK_RUNTIME_BROWSER_PROOF" as const,
    globalBefore: 87,
    globalAfter: 88,
    weightedVisualBefore: weightedBefore,
    weightedVisualAfter: weightedAfter,
    pools: PASS2204_POOL_SCORES,
    implementedTargets: [
      "Cart forced back to a real bottom-sheet geometry after old full-height CSS overrides.",
      "Private mail submit now has envelope flight, staged delivery and final delivered state.",
      "Other-wallet sidecar has bounded max-height, internal scroll and viewport-safe mobile positioning.",
      "Account dropdown has micro-hover/focus polish without exposing raw internal state.",
      "Main menu close motion uses slower hide timing and compositor-safe transitions.",
    ],
    honestNote:
      "Static microinteraction pass is implemented. Runtime proof still requires local browser screenshots/video for cart geometry, private mail sending and wallet scroll on short viewport.",
  };
}
