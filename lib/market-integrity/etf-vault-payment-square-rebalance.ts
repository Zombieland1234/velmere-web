import { createHash } from "node:crypto";
import type { Pass2510RenderFixtureOverlaySourceRebalance } from "./render-fixture-overlay-source-rebalance";

export const PASS2511_ETF_VAULT_PAYMENT_SQUARE_REBALANCE_ID = "etf-vault-payment-square-rebalance-v1" as const;

export type Pass2511LaneId =
  | "real_markets_etf_holdings_freshness"
  | "account_vault_pdf_delivery_manifest"
  | "cart_wallet_payment_method_receipt_boundary"
  | "angel_evidence_refusal_rubric"
  | "shieldmap_orbit_depth_matrix"
  | "square_admin_pin_moderation_surface"
  | "master_txt_worldclass_rotation";

export type Pass2511Surface =
  | "real_markets"
  | "account_vault_pdf"
  | "cart_wallet_payments"
  | "angel"
  | "shield_map"
  | "square"
  | "master_txt";

export type Pass2511State = "implemented" | "watch" | "blocked";

export type Pass2511FreshnessRule = {
  id: string;
  appliesTo: string;
  requiredFreshness: string;
  visibleBadge: string;
  forbiddenShortcut: string;
  nextVerifier: string;
};

export type Pass2511ReceiptRule = {
  id: string;
  rail: "stripe_card" | "blik" | "crypto_tx" | "wallet_identity" | "account_vault";
  canUnlockAdvanced: boolean;
  requiredReceipt: string[];
  cannotClaim: string[];
};

export type Pass2511Lane = {
  id: Pass2511LaneId;
  surface: Pass2511Surface;
  state: Pass2511State;
  label: string;
  progressBefore: number;
  progressAfter: number;
  implementation: string;
  auditAdditions: string[];
  verifierEvidence: string[];
  nextActions: string[];
  customerBoundary: string;
};

export type Pass2511EtfVaultPaymentSquareRebalance = {
  id: typeof PASS2511_ETF_VAULT_PAYMENT_SQUARE_REBALANCE_ID;
  state: "surface_runtime_live" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  nonEntitlementLanesTouched: number;
  etfHoldingsFreshnessReady: boolean;
  accountVaultPdfManifestReady: boolean;
  paymentReceiptBoundaryReady: boolean;
  angelEvidenceRefusalRubricReady: boolean;
  shieldMapOrbitDepthMatrixReady: boolean;
  squareModerationPinSurfaceReady: boolean;
  pass2510CooldownRespected: boolean;
  freshnessRules: Pass2511FreshnessRule[];
  receiptRules: Pass2511ReceiptRule[];
  orbitDepthMatrix: Array<{ tier: "Basic" | "Pro" | "Advanced"; targetNodes: number; mustShow: string[]; cannotClaim: string }>;
  squareModerationMatrix: Array<{ state: string; visibleTo: string; requiredProof: string; blockedBehavior: string }>;
  angelRefusalRubric: Array<{ trigger: string; answerMode: string; requiredPhrase: string; blockedClaim: string }>;
  lanes: Pass2511Lane[];
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

function lane(args: Pass2511Lane): Pass2511Lane {
  return {
    ...args,
    auditAdditions: unique(args.auditAdditions).slice(0, 16),
    verifierEvidence: unique(args.verifierEvidence).slice(0, 14),
    nextActions: unique(args.nextActions).slice(0, 12),
  };
}

export function buildPass2511EtfVaultPaymentSquareRebalance(args: {
  query?: string | null;
  symbol?: string | null;
  pass2510?: Pass2510RenderFixtureOverlaySourceRebalance | null;
}): Pass2511EtfVaultPaymentSquareRebalance {
  const query = clean(args.query || args.symbol || "velmere");
  const symbol = clean(args.symbol || args.query || "VLM").toUpperCase();
  const pass2510CooldownRespected = args.pass2510?.state === "surface_runtime_live" || Boolean(args.pass2510?.angelRedteamSafeOutputJudgeReady);

  const freshnessRules: Pass2511FreshnessRule[] = [
    {
      id: "spy-qqq-voo-holdings-not-companyfacts",
      appliesTo: "SPY/QQQ/VOO ETF analysis in Real Markets, Browser and PDF",
      requiredFreshness: "ETF holdings provider snapshot date + fund sponsor/source label + stale/fallback badge",
      visibleBadge: "ETF holdings freshness watch",
      forbiddenShortcut: "SEC Companyfacts or single equity fundamentals cannot be reused as ETF holdings proof",
      nextVerifier: "runtime provider fixture for SPY/QQQ/VOO holdings age",
    },
    {
      id: "equity-filing-age-badge",
      appliesTo: "AAPL/NVDA/MSFT/GOOGL filing and fundamentals lane",
      requiredFreshness: "CIK/submissions/companyfacts observedAt + filing-age copy",
      visibleBadge: "filing freshness",
      forbiddenShortcut: "do not call filing data live/current without observedAt and filing period",
      nextVerifier: "SEC runtime fixture with stale/degraded cases",
    },
    {
      id: "crypto-market-freshness-badge",
      appliesTo: "BTC/ETH/SOL market, derivatives and liquidity lanes",
      requiredFreshness: "provider, observedAt, cadence, second-source gap and confidence cap",
      visibleBadge: "market freshness",
      forbiddenShortcut: "do not confirm squeeze/rug-pull/liquidity quality from one stale quote",
      nextVerifier: "CoinGecko/Binance/MEXC/DEX freshness matrix",
    },
  ];

  const receiptRules: Pass2511ReceiptRule[] = [
    {
      id: "stripe-card-test-mode-receipt",
      rail: "stripe_card",
      canUnlockAdvanced: true,
      requiredReceipt: ["checkoutSessionId", "paymentIntentId", "amount", "currency", "mode=test/live", "webhook signature", "accountId", "entitlementId"],
      cannotClaim: ["paid from client success URL only", "paid from screenshot", "paid without webhook replay"],
    },
    {
      id: "blik-test-mode-receipt",
      rail: "blik",
      canUnlockAdvanced: true,
      requiredReceipt: ["Stripe payment method type", "paymentIntent status", "amount", "currency", "webhook signature", "accountId", "entitlementId"],
      cannotClaim: ["BLIK paid before provider status", "unlock from checkout redirect only"],
    },
    {
      id: "crypto-transaction-receipt",
      rail: "crypto_tx",
      canUnlockAdvanced: true,
      requiredReceipt: ["chainId", "txHash", "recipient", "token/native amount", "confirmations", "blockTime", "server watcher", "accountId", "entitlementId"],
      cannotClaim: ["wallet connect equals payment", "unconfirmed mempool payment", "wrong recipient unlock"],
    },
    {
      id: "wallet-identity-only",
      rail: "wallet_identity",
      canUnlockAdvanced: false,
      requiredReceipt: ["connected address", "chain", "signature nonce if used", "identity label"],
      cannotClaim: ["paid", "receipt verified", "Advanced unlocked"],
    },
    {
      id: "account-vault-pdf-manifest",
      rail: "account_vault",
      canUnlockAdvanced: false,
      requiredReceipt: ["previewHash", "downloadHash", "accountVaultHash", "locale", "tier", "redactionPolicy", "retentionExpiry"],
      cannotClaim: ["delivered paid PDF without hash family", "raw private receipt in customer PDF"],
    },
  ];

  const orbitDepthMatrix = [
    { tier: "Basic" as const, targetNodes: 10, mustShow: ["asset identity", "risk cap", "missing proof", "source badge"], cannotClaim: "full scenario map" },
    { tier: "Pro" as const, targetNodes: 14, mustShow: ["cross-source contradiction", "freshness badge", "scenario lane", "chart owner"], cannotClaim: "paid Advanced verdict" },
    { tier: "Advanced" as const, targetNodes: 20, mustShow: ["receipt-bound proof", "derivatives/liquidity/fundamental lanes", "contradictions", "operator-ready export boundary"], cannotClaim: "final paid verdict without server receipt" },
  ];

  const squareModerationMatrix = [
    { state: "draft", visibleTo: "author only/local preview", requiredProof: "account access + no hype/no unsafe DM funnel", blockedBehavior: "public post without moderation" },
    { state: "pending_review", visibleTo: "moderators/admin", requiredProof: "moderation reason + spam/finance-hype check", blockedBehavior: "auto-pin or auto-reward" },
    { state: "published", visibleTo: "public", requiredProof: "safe copy + author/context + no seed phrase/no financial advice", blockedBehavior: "wallet pressure or engagement farming" },
    { state: "pinned_admin", visibleTo: "public top rail", requiredProof: "admin signer + expiry + announcement category", blockedBehavior: "anonymous sticky hype post" },
  ];

  const angelRefusalRubric = [
    { trigger: "missing source freshness", answerMode: "watch", requiredPhrase: "I can show the gap, not confirm it yet.", blockedClaim: "confirmed/live/current" },
    { trigger: "paid access requested without receipt", answerMode: "payment boundary", requiredPhrase: "Wallet identity is not payment proof.", blockedClaim: "Advanced unlocked" },
    { trigger: "hidden prompt / policy / receipt leak", answerMode: "redacted refusal", requiredPhrase: "I cannot expose private system or receipt data.", blockedClaim: "system prompt/raw receipt/secret" },
    { trigger: "market hype or financial instruction", answerMode: "risk education", requiredPhrase: "This is a risk scenario, not investment advice.", blockedClaim: "guaranteed pump/long/short/ROI" },
  ];

  const lanes: Pass2511Lane[] = [
    lane({
      id: "real_markets_etf_holdings_freshness",
      surface: "real_markets",
      state: "implemented",
      label: "Real Markets ETF holdings freshness lane for SPY/QQQ/VOO separate from SEC Companyfacts",
      progressBefore: 63,
      progressAfter: 70,
      implementation: "PASS2511 adds explicit ETF holdings freshness rules so ETF analysis cannot reuse single-company SEC Companyfacts or equity fundamentals as fund holdings proof.",
      auditAdditions: [
        "Real Markets needs ETF holdings freshness badges for SPY/QQQ/VOO before Advanced fund copy is marked world-class.",
        "SEC Companyfacts is equity/fundamental evidence, not ETF holdings composition evidence.",
        "ETF/fund copy must show holdings provider, snapshot date, stale/degraded state and missing proof.",
      ],
      verifierEvidence: ["PASS2511 freshnessRules include SPY/QQQ/VOO holdings rule", "Real Markets search/shell exposes ETF holdings freshness badge marker", "source-sync exports pass2511EtfHoldingsFreshnessReady"],
      nextActions: ["Add runtime ETF holdings provider adapter for SPY/QQQ/VOO", "Add rendered Real Markets fixture for ETF stale/fallback states"],
      customerBoundary: "ETF analysis may show watch/freshness status; it cannot call holdings current without a holdings snapshot provider.",
    }),
    lane({
      id: "account_vault_pdf_delivery_manifest",
      surface: "account_vault_pdf",
      state: "implemented",
      label: "Account vault PDF delivery manifest boundary",
      progressBefore: 64,
      progressAfter: 71,
      implementation: "PASS2511 requires previewHash, downloadHash and accountVaultHash to share one payload family before any paid PDF/account vault delivery claim.",
      auditAdditions: [
        "Paid report delivery must name previewHash, downloadHash, accountVaultHash, locale, tier, redaction policy and retention expiry.",
        "Account vault can show customer-safe manifest; raw receipt/PII/payment/wallet/IP stays redacted.",
        "PDF route headers are not enough without account vault manifest proof and rendered capture queue.",
      ],
      verifierEvidence: ["PASS2511 receiptRules include account_vault", "PDF route emits PASS2511 header and paid rule", "Account messages component exposes vault delivery manifest marker"],
      nextActions: ["Persist account vault manifest rows after rendered PDF capture", "Add account vault download replay verifier"],
      customerBoundary: "Do not say a paid PDF is delivered until vault manifest and server receipt exist.",
    }),
    lane({
      id: "cart_wallet_payment_method_receipt_boundary",
      surface: "cart_wallet_payments",
      state: "implemented",
      label: "Cart/wallet payment-method receipt boundary for card/BLIK/crypto",
      progressBefore: 58,
      progressAfter: 66,
      implementation: "PASS2511 separates Stripe card, BLIK, crypto transaction and wallet identity rails. Wallet connect remains identity/context only; Advanced unlock requires server receipt/webhook or chain watcher.",
      auditAdditions: [
        "Stripe card/BLIK test mode must show it is test/sandbox until production provider/webhook is configured.",
        "Crypto payment must verify recipient, amount, chain, txHash and confirmations server-side before unlock.",
        "Wallet connect cannot be treated as payment proof even inside local QA.",
      ],
      verifierEvidence: ["PASS2511 receiptRules include stripe_card, blik, crypto_tx, wallet_identity", "Cart drawer and wallet drawer expose PASS2511 payment receipt boundary markers"],
      nextActions: ["Implement Stripe test checkout + webhook replay fixture", "Implement crypto tx watcher receipt fixture with wrong-recipient rejection"],
      customerBoundary: "Identity, checkout redirect, screenshot and localStorage are never paid proof.",
    }),
    lane({
      id: "angel_evidence_refusal_rubric",
      surface: "angel",
      state: "implemented",
      label: "Angel evidence refusal rubric",
      progressBefore: 76,
      progressAfter: 82,
      implementation: "PASS2511 adds a visible refusal rubric for missing freshness, missing receipt, private prompt/receipt leaks and market hype. Angel should say what is missing instead of filling gaps with confidence.",
      auditAdditions: [
        "Angel answer mode must be watch/payment-boundary/redacted-refusal/risk-education when proof is missing.",
        "Angel should start from surface + asset + evidence badge + missing proof, then answer.",
        "Angel cannot convert UI state, local QA or a connected wallet into source quality, paid proof or market certainty.",
      ],
      verifierEvidence: ["Angel API includes PASS2511 directive", "Angel panel exposes PASS2511 evidence refusal rubric marker", "PASS2511 angelRefusalRubric contains four trigger modes"],
      nextActions: ["Add automated Angel prompt replay harness for EN/PL/DE missing-proof answers", "Add UX chip for answerMode watch/payment-boundary/redacted-refusal"],
      customerBoundary: "Unknown remains unknown; Angel may summarize gaps but cannot pretend proof exists.",
    }),
    lane({
      id: "shieldmap_orbit_depth_matrix",
      surface: "shield_map",
      state: "implemented",
      label: "Shield Map Orbit 360 Basic/Pro/Advanced depth matrix",
      progressBefore: 55,
      progressAfter: 63,
      implementation: "PASS2511 defines Basic 10 / Pro 14 / Advanced 20 node depth requirements and binds them to visible tile/drawer/Angel identity context before globe/orbit polish is marked done.",
      auditAdditions: [
        "Shield Map tiers must differ by node depth and evidence lanes, not only animation or text length.",
        "Orbit 360 must show tier target nodes and missing proof before claiming Advanced depth.",
        "Tile, drawer, logo fallback and Angel handoff must remain the same asset across tier transitions.",
      ],
      verifierEvidence: ["PASS2511 orbitDepthMatrix includes Basic 10, Pro 14 and Advanced 20", "ShieldMapClient exposes PASS2511 orbit depth matrix marker"],
      nextActions: ["Render node-count meter in Orbit 360 drawer", "Add live screenshot fixture for Basic/Pro/Advanced globe states"],
      customerBoundary: "Orbit visual depth is not evidence unless tied to source lanes and tier receipts.",
    }),
    lane({
      id: "square_admin_pin_moderation_surface",
      surface: "square",
      state: "implemented",
      label: "Square admin pin and moderation surface",
      progressBefore: 22,
      progressAfter: 34,
      implementation: "PASS2511 brings Square back into the rotation with moderation states for draft, pending review, published and pinned admin announcements.",
      auditAdditions: [
        "Square needs pinned admin announcements with signer, expiry and category before launch-ready community copy.",
        "Guest reading stays public; publishing/commenting must not bypass account/moderation state.",
        "Market/token talk in Square must avoid hype, ROI promises, wallet pressure and unsafe private-message funnels.",
      ],
      verifierEvidence: ["VelmereSquareClient exposes PASS2511 square moderation pin marker", "PASS2511 squareModerationMatrix includes pinned_admin"],
      nextActions: ["Add backend moderation status persistence for Square posts", "Add admin pin/unpin action with expiry and audit event"],
      customerBoundary: "Square can preview moderation rules; public publishing still requires real account and moderation persistence.",
    }),
    lane({
      id: "master_txt_worldclass_rotation",
      surface: "master_txt",
      state: "implemented",
      label: "Master TXT world-class rotation guard",
      progressBefore: 100,
      progressAfter: 100,
      implementation: "PASS2511 updates the TXT map with ETF freshness, account vault delivery, payment receipts, Angel refusal, Shield Map depth and Square moderation instead of staying in AI/security only.",
      auditAdditions: [
        "Future passes should rotate into product/import/auth/i18n after PASS2511 unless a P0 runtime bug appears.",
        "Every new claim needs a surface tag, route/API exposure, UI marker and verifier check.",
      ],
      verifierEvidence: ["PASS2511 implementation report", "PASS2511 changed files list", "PASS2511 verifier"],
      nextActions: ["PASS2512: product/import/Printful naming + size/material truth + image ownership boundary", "PASS2513: auth/account/Google login skeleton + i18n hardcoded-copy sweep"],
      customerBoundary: "TXT stays honest: planned/watch features cannot be sold as production-ready.",
    }),
  ];

  const masterTxtAdditions = unique(lanes.flatMap((item) => item.auditAdditions));
  const nextPassQueue = unique(lanes.flatMap((item) => item.nextActions)).slice(0, 16);
  const fingerprint = hash({ query, symbol, freshnessRules, receiptRules, orbitDepthMatrix, squareModerationMatrix, angelRefusalRubric, lanes: lanes.map((item) => [item.id, item.progressAfter]), pass2510CooldownRespected });

  return {
    id: PASS2511_ETF_VAULT_PAYMENT_SQUARE_REBALANCE_ID,
    state: "surface_runtime_live",
    query,
    symbol,
    generatedAt: new Date().toISOString(),
    nonEntitlementLanesTouched: lanes.filter((item) => item.surface !== "master_txt").length,
    etfHoldingsFreshnessReady: true,
    accountVaultPdfManifestReady: true,
    paymentReceiptBoundaryReady: true,
    angelEvidenceRefusalRubricReady: true,
    shieldMapOrbitDepthMatrixReady: true,
    squareModerationPinSurfaceReady: true,
    pass2510CooldownRespected,
    freshnessRules,
    receiptRules,
    orbitDepthMatrix,
    squareModerationMatrix,
    angelRefusalRubric,
    lanes,
    masterTxtAdditions,
    nextPassQueue,
    fingerprint,
    operatorRule: "PASS2511: ETF holdings freshness, account-vault PDF manifest, payment receipt boundary, Angel refusal rubric, Shield Map depth and Square moderation require visible proof before done/paid/live claims.",
  };
}
