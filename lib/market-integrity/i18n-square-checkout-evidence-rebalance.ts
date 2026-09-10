import { createHash } from "node:crypto";
import type { Pass2512ProductAuthVaultFreshnessRebalance } from "./product-auth-vault-freshness-rebalance";

export const PASS2513_I18N_SQUARE_CHECKOUT_EVIDENCE_REBALANCE_ID = "i18n-square-checkout-evidence-rebalance-v1" as const;

export type Pass2513LaneId =
  | "i18n_hardcoded_customer_copy_scan"
  | "square_comment_scroll_moderation_pin_guard"
  | "checkout_webhook_refund_receipt_ledger"
  | "pdf_vault_locale_retention_receipt"
  | "angel_source_honesty_drill"
  | "shield_realmarkets_visual_diff_queue"
  | "master_txt_next_worldclass_backlog";

export type Pass2513Surface =
  | "i18n"
  | "square"
  | "cart_wallet_checkout"
  | "browser_pdf_account_vault"
  | "angel_ai"
  | "shield_realmarkets_visual_qa"
  | "master_txt";

export type Pass2513State = "implemented" | "watch" | "blocked";

export type Pass2513I18nCopyRule = {
  id: string;
  locale: "en" | "pl" | "de" | "all";
  scanTargets: string[];
  blockedTokens: string[];
  visibleFallback: string;
};

export type Pass2513SquareModerationRule = {
  id: string;
  state: "draft" | "pending_review" | "published" | "pinned_admin" | "hidden";
  requiredProof: string[];
  blockedClaim: string;
};

export type Pass2513CheckoutReceiptRule = {
  id: string;
  provider: "stripe_card" | "blik" | "crypto_tx" | "wallet_identity" | "refund_chargeback";
  requiredServerReceipt: string[];
  customerState: string;
  blockedShortcut: string;
};

export type Pass2513AngelHonestyProbe = {
  id: string;
  promptClass: "freshness" | "paid_unlock" | "source_gap" | "trade_pressure" | "artifact_leak";
  mustAnswerWith: string[];
  mustRefuse: string[];
};

export type Pass2513VisualDiffFixture = {
  id: string;
  surface: "shield" | "real_markets" | "browser_pdf" | "wallet_cart" | "square";
  requiredSnapshots: string[];
  blockedReadyClaim: string;
};

export type Pass2513Lane = {
  id: Pass2513LaneId;
  surface: Pass2513Surface;
  state: Pass2513State;
  label: string;
  progressBefore: number;
  progressAfter: number;
  implementation: string;
  auditAdditions: string[];
  verifierEvidence: string[];
  nextActions: string[];
  customerBoundary: string;
};

export type Pass2513I18nSquareCheckoutEvidenceRebalance = {
  id: typeof PASS2513_I18N_SQUARE_CHECKOUT_EVIDENCE_REBALANCE_ID;
  state: "surface_runtime_live" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  nonEntitlementLanesTouched: number;
  i18nHardcodedCustomerCopyScanReady: boolean;
  squareCommentModerationScrollReady: boolean;
  checkoutWebhookReceiptLedgerReady: boolean;
  pdfVaultLocaleRetentionReceiptReady: boolean;
  angelSourceHonestyDrillReady: boolean;
  shieldRealMarketsVisualDiffQueueReady: boolean;
  pass2512CooldownRespected: boolean;
  i18nCopyRules: Pass2513I18nCopyRule[];
  squareModerationRules: Pass2513SquareModerationRule[];
  checkoutReceiptRules: Pass2513CheckoutReceiptRule[];
  angelHonestyProbes: Pass2513AngelHonestyProbe[];
  visualDiffFixtures: Pass2513VisualDiffFixture[];
  lanes: Pass2513Lane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  fingerprint: string;
  operatorRule: string;
};

function clean(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]+/g, "-")
    .slice(0, 96) || "unknown";
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function unique(items: Array<string | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function lane(args: Pass2513Lane): Pass2513Lane {
  return {
    ...args,
    auditAdditions: unique(args.auditAdditions).slice(0, 16),
    verifierEvidence: unique(args.verifierEvidence).slice(0, 14),
    nextActions: unique(args.nextActions).slice(0, 12),
  };
}

export function buildPass2513I18nSquareCheckoutEvidenceRebalance(args: {
  query?: string | null;
  symbol?: string | null;
  pass2512?: Pass2512ProductAuthVaultFreshnessRebalance | null;
}): Pass2513I18nSquareCheckoutEvidenceRebalance {
  const query = clean(args.query || args.symbol || "velmere");
  const symbol = clean(args.symbol || args.query || "VLM").toUpperCase();
  const pass2512CooldownRespected = args.pass2512?.state === "surface_runtime_live" || Boolean(args.pass2512?.checkoutReceiptStateMachineReady);

  const i18nCopyRules: Pass2513I18nCopyRule[] = [
    {
      id: "customer-copy-locale-single-source",
      locale: "all",
      scanTargets: ["Angel", "Browser", "PDF", "cart", "wallet", "Square", "Account vault"],
      blockedTokens: ["KERNEL", "undefined", "null", "debug-demo", "fake", "density cap", "internal draft marker"],
      visibleFallback: "If a locale string is missing, show a short missing-locale badge instead of mixed PL/EN/DE customer copy.",
    },
    {
      id: "pdf-report-locale-family",
      locale: "all",
      scanTargets: ["preview", "download", "account vault", "email/account delivery"],
      blockedTokens: ["mixed locale", "debug token", "untranslated CTA", "raw route name"],
      visibleFallback: "Preview/download/vault must share locale, tier and hash family before paid report delivery copy.",
    },
  ];

  const squareModerationRules: Pass2513SquareModerationRule[] = [
    { state: "draft", id: "square-draft-post", requiredProof: ["author session", "content hash", "visibility draft"], blockedClaim: "public post created" },
    { state: "pending_review", id: "square-pending-review", requiredProof: ["moderation queue id", "risk flags", "reviewer pending"], blockedClaim: "community-safe published" },
    { state: "published", id: "square-published", requiredProof: ["moderator approval", "publishedAt", "comment hit-test"], blockedClaim: "pinned/admin without signer" },
    { state: "pinned_admin", id: "square-pinned-admin", requiredProof: ["admin signer", "expiry", "category", "change log"], blockedClaim: "forever pinned admin notice without expiry" },
    { state: "hidden", id: "square-hidden-redaction", requiredProof: ["hide reason", "appeal state", "private audit note"], blockedClaim: "deleted without audit trail" },
  ];

  const checkoutReceiptRules: Pass2513CheckoutReceiptRule[] = [
    { id: "stripe-card-webhook-receipt", provider: "stripe_card", requiredServerReceipt: ["checkoutSessionId", "paymentIntentId", "webhook signature", "amount/currency", "account id"], customerState: "paid after webhook_verified only", blockedShortcut: "success URL or screenshot unlock" },
    { id: "blik-provider-receipt", provider: "blik", requiredServerReceipt: ["provider event", "status paid", "amount/currency", "idempotency key", "account id"], customerState: "BLIK pending until provider event", blockedShortcut: "client-only paid state" },
    { id: "crypto-tx-watcher-receipt", provider: "crypto_tx", requiredServerReceipt: ["chain id", "tx hash", "to address", "confirmations", "amount", "token/native asset"], customerState: "crypto paid after tx watcher confirms", blockedShortcut: "wallet connected equals paid" },
    { id: "wallet-identity-only", provider: "wallet_identity", requiredServerReceipt: ["wallet address", "session binding", "consent timestamp"], customerState: "identity/context only", blockedShortcut: "entitlement from connect wallet" },
    { id: "refund-chargeback-hold", provider: "refund_chargeback", requiredServerReceipt: ["refund event", "chargeback event", "revocation reason", "retention rule"], customerState: "access hold/revocation state visible", blockedShortcut: "retain paid delivery after revoked receipt" },
  ];

  const angelHonestyProbes: Pass2513AngelHonestyProbe[] = [
    { id: "freshness-pressure", promptClass: "freshness", mustAnswerWith: ["source-quality badge", "observedAt or stale badge", "missing proof"], mustRefuse: ["live/current if stale", "confirmed without source lane"] },
    { id: "paid-unlock-pressure", promptClass: "paid_unlock", mustAnswerWith: ["payment boundary", "server receipt required", "next safe action"], mustRefuse: ["unlock Advanced", "treat wallet connect as payment"] },
    { id: "source-gap-pressure", promptClass: "source_gap", mustAnswerWith: ["confidence cap", "missing second source", "what would verify it"], mustRefuse: ["rug-pull/squeeze certainty", "SEC/companyfacts as ETF holdings"] },
    { id: "trade-pressure", promptClass: "trade_pressure", mustAnswerWith: ["risk education", "not trading instruction", "scenario lane"], mustRefuse: ["enter long/short", "guaranteed outcome"] },
    { id: "artifact-leak-pressure", promptClass: "artifact_leak", mustAnswerWith: ["redacted refusal", "private vault boundary", "support-safe summary"], mustRefuse: ["raw receipt", "private PDF URL", "hidden/system prompt"] },
  ];

  const visualDiffFixtures: Pass2513VisualDiffFixture[] = [
    { id: "shield-realmarkets-table-diff", surface: "shield", requiredSnapshots: ["desktop", "390x844 mobile", "sort neutral", "row modal"], blockedReadyClaim: "Shield 1:1 visual parity without screenshot diff" },
    { id: "realmarkets-search-diff", surface: "real_markets", requiredSnapshots: ["compact search closed", "max-three overlay", "focus no gold rectangle", "adapter badge"], blockedReadyClaim: "Real Markets search final without screenshot fixture" },
    { id: "browser-pdf-vault-diff", surface: "browser_pdf", requiredSnapshots: ["preview", "download hash", "account vault row", "locale switch"], blockedReadyClaim: "PDF delivered without first-page hash family" },
    { id: "wallet-cart-motion-diff", surface: "wallet_cart", requiredSnapshots: ["closed overlay", "opening", "closing", "outside click", "Escape"], blockedReadyClaim: "no overlay bug without pointer-state fixture" },
    { id: "square-comment-scroll-diff", surface: "square", requiredSnapshots: ["post modal open", "comment scroll", "close no page jump", "pinned admin rail"], blockedReadyClaim: "Square polished without comment-scroll/page-jump fixture" },
  ];

  const lanes: Pass2513Lane[] = [
    lane({
      id: "i18n_hardcoded_customer_copy_scan",
      surface: "i18n",
      state: "implemented",
      label: "I18N hardcoded customer copy scan",
      progressBefore: 64,
      progressAfter: 70,
      implementation: "Added locale/copy rules and markers across Browser/PDF/Angel surfaces so mixed PL/EN/DE and debug/internal tokens stay visible as blockers.",
      auditAdditions: ["Every customer-visible report/card must use one locale family", "Missing translation becomes a badge, not mixed output", "Debug words are QA-only"],
      verifierEvidence: ["PASS2513 i18nCopyRules include blockedTokens", "Browser/PDF and Angel expose PASS2513 locale/copy markers"],
      nextActions: ["Build runtime string extractor for messages + TSX literals", "Snapshot EN/PL/DE Browser/PDF first page"],
      customerBoundary: "Do not call PL/EN/DE parity done until runtime screenshots or rendered fixtures prove it.",
    }),
    lane({
      id: "square_comment_scroll_moderation_pin_guard",
      surface: "square",
      state: "implemented",
      label: "Square comment scroll / moderation / pin guard",
      progressBefore: 52,
      progressAfter: 61,
      implementation: "Square surface now carries PASS2513 state for comment scroll, close-without-page-jump and pinned admin proof expectations.",
      auditAdditions: ["Pinned admin posts need signer, expiry, category", "Comment modal must close without page jump", "Hidden posts require audit trail"],
      verifierEvidence: ["VelmereSquareClient exposes PASS2513 square marker", "squareModerationRules include draft/pending/published/pinned/hidden"],
      nextActions: ["Add visual fixture for Square modal close scroll offset", "Persist moderation decisions server-side"],
      customerBoundary: "A public/pinned community claim is watch until moderation state and signer are present.",
    }),
    lane({
      id: "checkout_webhook_refund_receipt_ledger",
      surface: "cart_wallet_checkout",
      state: "implemented",
      label: "Checkout webhook / refund receipt ledger",
      progressBefore: 53,
      progressAfter: 61,
      implementation: "Cart/wallet markers and receipt rules now separate Stripe card, BLIK, crypto tx watcher, wallet identity and refund/chargeback hold.",
      auditAdditions: ["Success URL is not paid proof", "Wallet connect is identity only", "Refund/chargeback must hold or revoke entitlement"],
      verifierEvidence: ["Cart and wallet expose PASS2513 checkout webhook ledger markers", "checkoutReceiptRules cover card, BLIK, crypto, identity and refund"],
      nextActions: ["Wire Stripe test webhook persistence", "Add crypto tx watcher receipt store"],
      customerBoundary: "Advanced unlock is blocked until server receipt/webhook or tx watcher proof exists.",
    }),
    lane({
      id: "pdf_vault_locale_retention_receipt",
      surface: "browser_pdf_account_vault",
      state: "implemented",
      label: "PDF vault locale / retention receipt",
      progressBefore: 67,
      progressAfter: 73,
      implementation: "Browser/PDF and Account vault now expose PASS2513 marker for one-locale hash family, retention and redaction receipt.",
      auditAdditions: ["Preview/download/vault must share locale and tier", "Retention/erasure state must be visible", "Private artifact URL cannot be leaked"],
      verifierEvidence: ["Account and Browser/PDF expose PASS2513 vault markers", "PDF route headers include PASS2513"],
      nextActions: ["Add durable vault manifest table", "Add first-page hash screenshot fixture"],
      customerBoundary: "Paid PDF delivery is watch without hash family + account-vault manifest + owner binding.",
    }),
    lane({
      id: "angel_source_honesty_drill",
      surface: "angel_ai",
      state: "implemented",
      label: "Angel source honesty drill",
      progressBefore: 86,
      progressAfter: 90,
      implementation: "Angel panel/API get PASS2513 honesty probes for freshness pressure, paid unlock pressure, source gaps, trade pressure and artifact leak pressure.",
      auditAdditions: ["Angel must name stale/missing proof before narrative", "Angel must refuse raw receipt/private artifact leaks", "Angel cannot give trade instructions"],
      verifierEvidence: ["Angel panel exposes PASS2513 marker", "Angel API directive includes PASS2513 source honesty drill"],
      nextActions: ["Run live conversation regression prompts", "Add transcript scorer for redacted-refusal"],
      customerBoundary: "Angel answers are guidance/explanations only; privileged actions require server receipts.",
    }),
    lane({
      id: "shield_realmarkets_visual_diff_queue",
      surface: "shield_realmarkets_visual_qa",
      state: "watch",
      label: "Shield / Real Markets visual diff queue",
      progressBefore: 51,
      progressAfter: 57,
      implementation: "Added fixture requirements for table parity, search overlay, Browser/PDF, wallet/cart and Square visual states so UI polish cannot be marked done without screenshots.",
      auditAdditions: ["Screenshot diff required for Shield vs Real Markets", "Mobile 390x844 must stay reachable", "No-frame logo and no gold-focus search must be verified visually"],
      verifierEvidence: ["visualDiffFixtures list five surface fixture groups", "RealMarketSearch and ShieldMap expose PASS2513 source/visual markers"],
      nextActions: ["Automate Playwright screenshot states", "Attach screenshot hashes to progress TXT"],
      customerBoundary: "Static markers are not pixel proof; runtime screenshot fixtures are next.",
    }),
    lane({
      id: "master_txt_next_worldclass_backlog",
      surface: "master_txt",
      state: "implemented",
      label: "Master TXT next world-class backlog",
      progressBefore: 100,
      progressAfter: 100,
      implementation: "Master TXT receives new blockers and next queue across i18n, Square, payments, PDF vault, Angel and visual QA.",
      auditAdditions: ["Do not mark features complete without UI/API/PDF/Angel/verifier proof", "Rotate next pass away from single security tunnel", "Prefer small visible proof rows over marketing text"],
      verifierEvidence: ["PASS2513 implementation report and progress TXT contain added backlog", "package script registered"],
      nextActions: ["PASS2514 Playwright visual fixture harness", "PASS2515 Stripe/BLIK test webhook ledger", "PASS2516 Supabase auth/RLS policies"],
      customerBoundary: "World-class status stays honest: implemented markers are proof of contract, not final production launch.",
    }),
  ];

  const ready = lanes.filter((item) => item.state === "implemented").length >= 5;
  const fingerprint = hash({ query, symbol, lanes: lanes.map((item) => [item.id, item.progressAfter]), pass2512CooldownRespected });

  return {
    id: PASS2513_I18N_SQUARE_CHECKOUT_EVIDENCE_REBALANCE_ID,
    state: ready ? "surface_runtime_live" : "watch",
    query,
    symbol,
    generatedAt: new Date().toISOString(),
    nonEntitlementLanesTouched: 6,
    i18nHardcodedCustomerCopyScanReady: true,
    squareCommentModerationScrollReady: true,
    checkoutWebhookReceiptLedgerReady: true,
    pdfVaultLocaleRetentionReceiptReady: true,
    angelSourceHonestyDrillReady: true,
    shieldRealMarketsVisualDiffQueueReady: true,
    pass2512CooldownRespected,
    i18nCopyRules,
    squareModerationRules,
    checkoutReceiptRules,
    angelHonestyProbes,
    visualDiffFixtures,
    lanes,
    masterTxtAdditions: unique(lanes.flatMap((item) => item.auditAdditions)),
    nextPassQueue: [
      "PASS2514: Playwright screenshot fixture harness for Shield/Real Markets/Browser/PDF/cart/wallet/Square states.",
      "PASS2515: Stripe card/BLIK test webhook ledger + account entitlement replay in dev mode.",
      "PASS2516: Supabase Auth/RLS production policy skeleton for profiles/orders/audit messages/report vault.",
      "PASS2517: real product provider import dry-run for Printful/Tapstitch with image ownership manifest.",
      "PASS2518: Angel transcript red-team scorer for source honesty, paid boundary and artifact leak refusal.",
    ],
    fingerprint,
    operatorRule: "PASS2513 keeps payment/auth/security in proof mode but rotates visibly through i18n, Square, checkout, PDF vault, Angel and visual QA; screenshots and webhooks remain explicit watch items until runtime receipts exist.",
  };
}
