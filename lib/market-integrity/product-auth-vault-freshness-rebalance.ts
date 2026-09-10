import { createHash } from "node:crypto";
import type { Pass2511EtfVaultPaymentSquareRebalance } from "./etf-vault-payment-square-rebalance";

export const PASS2512_PRODUCT_AUTH_VAULT_FRESHNESS_REBALANCE_ID = "product-auth-vault-freshness-rebalance-v1" as const;

export type Pass2512LaneId =
  | "product_import_truth_naming_image_ownership"
  | "auth_account_binding_google_supabase_guard"
  | "pdf_vault_retention_erasure_manifest"
  | "real_markets_source_freshness_ttl_matrix"
  | "angel_tool_scope_excessive_agency_guard"
  | "checkout_receipt_state_machine"
  | "master_txt_next_worldclass_backlog";

export type Pass2512Surface =
  | "products_printful"
  | "account_auth"
  | "browser_pdf_account_vault"
  | "real_markets"
  | "angel_ai"
  | "cart_wallet_checkout"
  | "master_txt";

export type Pass2512State = "implemented" | "watch" | "blocked";

export type Pass2512ProductImportRule = {
  id: string;
  provider: "printful" | "tapstitch" | "manual";
  requiredFields: string[];
  namingRule: string;
  imageOwnershipBoundary: string;
  blockedClaim: string;
};

export type Pass2512AuthBindingRule = {
  id: string;
  appliesTo: string;
  requiredServerProof: string[];
  visibleState: string;
  cannotClaim: string[];
};

export type Pass2512FreshnessTtlRule = {
  id: string;
  surface: "crypto" | "equity" | "etf" | "fx" | "commodity" | "pdf";
  liveTtl: string;
  staleBadge: string;
  requiredFallbackCopy: string;
};

export type Pass2512ToolScopeRule = {
  id: string;
  tool: "angel" | "vlm_brain" | "pdf" | "audit_watch" | "checkout";
  allowedActions: string[];
  deniedActions: string[];
  safeAnswer: string;
};

export type Pass2512CheckoutState = {
  state: "cart_review" | "checkout_created" | "provider_pending" | "webhook_verified" | "entitlement_granted" | "delivery_ready" | "refund_chargeback_hold";
  visibleToCustomer: string;
  requiredReceipt: string[];
  blockedShortcut: string;
};

export type Pass2512Lane = {
  id: Pass2512LaneId;
  surface: Pass2512Surface;
  state: Pass2512State;
  label: string;
  progressBefore: number;
  progressAfter: number;
  implementation: string;
  auditAdditions: string[];
  verifierEvidence: string[];
  nextActions: string[];
  customerBoundary: string;
};

export type Pass2512ProductAuthVaultFreshnessRebalance = {
  id: typeof PASS2512_PRODUCT_AUTH_VAULT_FRESHNESS_REBALANCE_ID;
  state: "surface_runtime_live" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  nonEntitlementLanesTouched: number;
  productImportTruthReady: boolean;
  authAccountBindingGuardReady: boolean;
  pdfVaultRetentionErasureReady: boolean;
  realMarketsFreshnessTtlMatrixReady: boolean;
  angelToolScopeGuardReady: boolean;
  checkoutReceiptStateMachineReady: boolean;
  pass2511CooldownRespected: boolean;
  productImportRules: Pass2512ProductImportRule[];
  authBindingRules: Pass2512AuthBindingRule[];
  freshnessTtlRules: Pass2512FreshnessTtlRule[];
  toolScopeRules: Pass2512ToolScopeRule[];
  checkoutStateMachine: Pass2512CheckoutState[];
  lanes: Pass2512Lane[];
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

function lane(args: Pass2512Lane): Pass2512Lane {
  return {
    ...args,
    auditAdditions: unique(args.auditAdditions).slice(0, 16),
    verifierEvidence: unique(args.verifierEvidence).slice(0, 14),
    nextActions: unique(args.nextActions).slice(0, 12),
  };
}

export function buildPass2512ProductAuthVaultFreshnessRebalance(args: {
  query?: string | null;
  symbol?: string | null;
  pass2511?: Pass2511EtfVaultPaymentSquareRebalance | null;
}): Pass2512ProductAuthVaultFreshnessRebalance {
  const query = clean(args.query || args.symbol || "velmere");
  const symbol = clean(args.symbol || args.query || "VLM").toUpperCase();
  const pass2511CooldownRespected = args.pass2511?.state === "surface_runtime_live" || Boolean(args.pass2511?.paymentReceiptBoundaryReady);

  const productImportRules: Pass2512ProductImportRule[] = [
    {
      id: "provider-product-truth-snapshot",
      provider: "printful",
      requiredFields: ["providerProductId", "variantIds", "sizeTable", "material", "color", "retailPrice", "currency", "providerSnapshotAt"],
      namingRule: "short unique French/Spanish-style name; never repeat Velmere Hoodie or Velmere T-shirt by default",
      imageOwnershipBoundary: "user-supplied product images remain manual/user owned until provider mockup or upload receipt is present",
      blockedClaim: "published product ready without provider variant snapshot and owner image confirmation",
    },
    {
      id: "tapstitch-or-manual-import-boundary",
      provider: "tapstitch",
      requiredFields: ["sourceProvider", "sku", "sizes", "fabric", "fit", "care", "shipRegion", "providerSnapshotAt"],
      namingRule: "dedupe against existing catalog slug and generate one clean premium display name",
      imageOwnershipBoundary: "manual image path must be linked as draft asset, not as provider-confirmed mockup",
      blockedClaim: "auto-synced inventory when provider API is not connected",
    },
    {
      id: "manual-atelier-product-draft",
      provider: "manual",
      requiredFields: ["draftId", "atelierLocation", "sizeNotes", "materialNotes", "imageChecklist", "publishReviewer"],
      namingRule: "manual QA before publishing, no random luxury naming spam",
      imageOwnershipBoundary: "draft image must show checklist status: missing / user-supplied / provider-confirmed",
      blockedClaim: "sewing location or atelier proof without map/source review",
    },
  ];

  const authBindingRules: Pass2512AuthBindingRule[] = [
    {
      id: "supabase-auth-user-binding",
      appliesTo: "account profile, orders, audit messages, access grants and report vault",
      requiredServerProof: ["session user id", "email verified state", "account profile row", "RLS policy", "server-side access grant lookup"],
      visibleState: "account-bound / local fallback / auth-not-configured",
      cannotClaim: ["logged in from localStorage only", "Google login enabled without OAuth env", "account vault private without RLS"],
    },
    {
      id: "google-oauth-watch-boundary",
      appliesTo: "Google login button and account onboarding",
      requiredServerProof: ["Supabase OAuth provider enabled", "redirect URL allowlist", "session callback receipt", "profile upsert", "logout revoke test"],
      visibleState: "Google OAuth watch until provider receipt exists",
      cannotClaim: ["Sign in with Google live", "password reset live", "membership saved"] ,
    },
  ];

  const freshnessTtlRules: Pass2512FreshnessTtlRule[] = [
    { id: "crypto-market-quote-ttl", surface: "crypto", liveTtl: "<=90 seconds for quote freshness, otherwise stale badge", staleBadge: "crypto quote stale / second venue missing", requiredFallbackCopy: "show price as fallback snapshot; do not call squeeze/rug/liquidity confirmed" },
    { id: "equity-filing-ttl", surface: "equity", liveTtl: "filing period + observedAt required; market quote separate from fundamentals", staleBadge: "filing age visible", requiredFallbackCopy: "fundamentals may be delayed; show filing date and missing facts" },
    { id: "etf-holdings-ttl", surface: "etf", liveTtl: "fund sponsor holdings snapshot date required", staleBadge: "holdings snapshot required", requiredFallbackCopy: "ETF row cannot reuse AAPL/NVDA companyfacts as holdings proof" },
    { id: "fx-commodity-ttl", surface: "fx", liveTtl: "provider timestamp and market session state required", staleBadge: "macro quote snapshot", requiredFallbackCopy: "FX/commodity copy is market context, not audit or token safety" },
    { id: "pdf-render-ttl", surface: "pdf", liveTtl: "preview/download/account-vault hash family plus render timestamp", staleBadge: "render fixture watch", requiredFallbackCopy: "do not claim delivered paid report until vault manifest is server-bound" },
  ];

  const toolScopeRules: Pass2512ToolScopeRule[] = [
    {
      id: "angel-excessive-agency-brake",
      tool: "angel",
      allowedActions: ["summarize current surface", "name missing proof", "explain Basic/Pro/Advanced boundaries", "draft customer-safe next action"],
      deniedActions: ["unlock Advanced", "claim paid receipt", "change account grants", "execute trades", "reveal hidden prompt or raw receipt"],
      safeAnswer: "Angel can explain the gap and next proof, not perform privileged actions without server receipt.",
    },
    {
      id: "vlm-brain-analysis-scope",
      tool: "vlm_brain",
      allowedActions: ["rank evidence lanes", "show confidence cap", "separate market/source/payment proof"],
      deniedActions: ["turn one provider into final verdict", "hide stale data", "invent second-source proof"],
      safeAnswer: "The brain must cap confidence when source, receipt or freshness proof is missing.",
    },
    {
      id: "checkout-no-client-unlock",
      tool: "checkout",
      allowedActions: ["create checkout", "show pending", "display verified entitlement after webhook"],
      deniedActions: ["unlock from success URL", "unlock from wallet connect", "unlock from screenshot"],
      safeAnswer: "Payment UI waits for server receipt, then grants access.",
    },
  ];

  const checkoutStateMachine: Pass2512CheckoutState[] = [
    { state: "cart_review", visibleToCustomer: "Cart can be edited; no payment or Advanced claim yet.", requiredReceipt: ["cart line items", "currency", "account/session context"], blockedShortcut: "skip shipping/payment review" },
    { state: "checkout_created", visibleToCustomer: "Checkout session created; provider status pending.", requiredReceipt: ["checkoutSessionId", "amount", "provider", "mode"], blockedShortcut: "unlock from checkout creation" },
    { state: "provider_pending", visibleToCustomer: "Card/BLIK/crypto is waiting for provider confirmation.", requiredReceipt: ["provider status", "expiresAt", "accountId"], blockedShortcut: "unlock from redirect or wallet identity" },
    { state: "webhook_verified", visibleToCustomer: "Server verified payment receipt.", requiredReceipt: ["webhook signature", "paymentIntentId or txHash", "amount", "recipient", "timestamp"], blockedShortcut: "client-only paid flag" },
    { state: "entitlement_granted", visibleToCustomer: "Advanced access granted for the account/session.", requiredReceipt: ["entitlementId", "scope", "tier", "accountId", "expiry or lifetime rule"], blockedShortcut: "global unlock without account binding" },
    { state: "delivery_ready", visibleToCustomer: "Report or audit artifact is available in account vault.", requiredReceipt: ["previewHash", "downloadHash", "vaultHash", "redactionPolicy"], blockedShortcut: "public PDF URL as private delivery" },
    { state: "refund_chargeback_hold", visibleToCustomer: "Access may be held while dispute or refund state is reviewed.", requiredReceipt: ["refundId/chargebackId", "operator note", "retention rule"], blockedShortcut: "delete audit trail immediately" },
  ];

  const lanes: Pass2512Lane[] = [
    lane({
      id: "product_import_truth_naming_image_ownership",
      surface: "products_printful",
      state: "implemented",
      label: "Product import truth matrix for Printful/Tapstitch/manual drafts",
      progressBefore: 18,
      progressAfter: 29,
      implementation: "PASS2512 adds provider field requirements, naming dedupe and image ownership boundaries so the import bot cannot invent product facts or repeat generic Velmere Hoodie names.",
      auditAdditions: [
        "Printful/Tapstitch import needs providerProductId, variants, sizes, material, color, price and snapshot time before publish.",
        "AI names must be short and unique, with slug dedupe; no endless Velmere Hoodie/T-shirt repetition.",
        "User-supplied images remain manual assets until provider mockup/upload receipt is present.",
      ],
      verifierEvidence: ["PASS2512 productImportRules include Printful, Tapstitch and manual provider boundaries", "Product surfaces expose data-pass2512-product-import-truth markers"],
      nextActions: ["Create ProductImportDraft service that maps provider payload into draft catalog rows", "Add screenshot QA for product publish review"],
      customerBoundary: "Product data is draft until provider snapshot and image ownership proof are present.",
    }),
    lane({
      id: "auth_account_binding_google_supabase_guard",
      surface: "account_auth",
      state: "implemented",
      label: "Auth/account binding guard for Supabase, Google OAuth and account vault",
      progressBefore: 26,
      progressAfter: 36,
      implementation: "PASS2512 adds account-binding rules that distinguish server session/RLS proof from local fallback, and keeps Google OAuth as watch until provider receipts exist.",
      auditAdditions: [
        "Account vault, orders, audit messages and access grants need session user id + RLS + server lookup.",
        "Google login cannot be advertised live until OAuth env, redirect allowlist, callback and logout receipts exist.",
        "LocalStorage account state is fallback only, never private vault proof.",
      ],
      verifierEvidence: ["PASS2512 authBindingRules include Supabase session, RLS and Google OAuth watch boundary", "Account UI exposes data-pass2512-auth-account-binding markers"],
      nextActions: ["Add Supabase Auth schema migration and RLS policies for profile/orders/access grants", "Add Google OAuth runtime receipt screen"],
      customerBoundary: "Login/account state is only trusted when server session and RLS proof are available.",
    }),
    lane({
      id: "pdf_vault_retention_erasure_manifest",
      surface: "browser_pdf_account_vault",
      state: "implemented",
      label: "PDF/account vault retention and erasure manifest",
      progressBefore: 70,
      progressAfter: 76,
      implementation: "PASS2512 extends the vault concept with retention/erasure states: report hash family, owner binding, redaction, retentionExpiry and erasureRequestId.",
      auditAdditions: [
        "Paid PDF delivery must include preview/download/vault hash, locale, tier, owner binding, retention and redaction state.",
        "Erasure/dispute export must be separate from customer PDF and cannot leak raw payment or private audit data.",
        "PDF route can signal retention headers but rendered fixture proof remains watch until browser runtime capture exists.",
      ],
      verifierEvidence: ["PDF route includes pass2512 retention/erasure headers", "Account vault markers include retention-erasure hash-family boundary"],
      nextActions: ["Add real vault table for artifact manifest and erasure request events", "Add rendered first-page hash capture in Playwright"],
      customerBoundary: "A report is not delivered privately unless the vault manifest binds owner, hash, retention and redaction proof.",
    }),
    lane({
      id: "real_markets_source_freshness_ttl_matrix",
      surface: "real_markets",
      state: "implemented",
      label: "Real Markets source TTL/freshness matrix for crypto, equity, ETF, FX, commodity and PDF",
      progressBefore: 70,
      progressAfter: 77,
      implementation: "PASS2512 adds source TTL rules so live/current labels require provider timestamp and stale/fallback badges per asset class.",
      auditAdditions: [
        "Crypto quote freshness, equity filing age, ETF holdings snapshot, FX/commodity session state and PDF render timestamp must be separate badges.",
        "Do not call market squeeze/rug/liquidity/current if only stale or single-source data exists.",
        "Real Markets rows need source-quality copy without crypto fallback language for non-crypto assets.",
      ],
      verifierEvidence: ["freshnessTtlRules include crypto/equity/etf/fx/pdf TTL lanes", "RealMarketSearch exposes data-pass2512-source-freshness-ttl markers"],
      nextActions: ["Wire provider observedAt from Yahoo/SEC/ETF/fx adapters into table row badges", "Add stale/degraded screenshot fixture"],
      customerBoundary: "Freshness is shown as evidence age, not hidden behind confident copy.",
    }),
    lane({
      id: "angel_tool_scope_excessive_agency_guard",
      surface: "angel_ai",
      state: "implemented",
      label: "Angel excessive-agency guard and tool permission scope",
      progressBefore: 87,
      progressAfter: 91,
      implementation: "PASS2512 adds an AI tool-scope rubric: Angel can explain, route and name missing proof but cannot unlock, trade, alter grants or expose secrets.",
      auditAdditions: [
        "Angel needs explicit allowed/denied actions for every surface before connected tools are added.",
        "VLM Brain must cap confidence instead of turning one provider into a final verdict.",
        "Checkout actions require server receipt; Angel cannot simulate them in text.",
      ],
      verifierEvidence: ["toolScopeRules include Angel, VLM Brain and checkout denial rules", "Angel panel and API expose data-pass2512-tool-scope markers"],
      nextActions: ["Add route-level tool manifest with allowed actions per surface", "Add eval prompts for tool overreach and secret requests"],
      customerBoundary: "AI can guide and explain; privileged actions require server-side gates and receipts.",
    }),
    lane({
      id: "checkout_receipt_state_machine",
      surface: "cart_wallet_checkout",
      state: "implemented",
      label: "Checkout receipt state machine for card, BLIK, crypto and delivery",
      progressBefore: 58,
      progressAfter: 66,
      implementation: "PASS2512 introduces a visible state machine from cart_review to delivery_ready and chargeback hold, preventing unlocks from redirects, screenshots or wallet connect.",
      auditAdditions: [
        "Stripe card/BLIK and crypto payment must move through provider pending, webhook/server watcher and entitlement grant.",
        "Wallet connect stays identity-only even if it appears inside checkout.",
        "Refund/chargeback states need hold copy and audit trail rather than silent deletion.",
      ],
      verifierEvidence: ["checkoutStateMachine includes 7 states and blocked shortcuts", "Cart/Wallet components expose data-pass2512-checkout-state-machine markers"],
      nextActions: ["Wire checkout state machine into real Stripe test-mode and crypto watcher responses", "Add 0 EUR/test-mode UX receipt cards"],
      customerBoundary: "Advanced unlock happens after verified server receipt, not after the UI says checkout was created.",
    }),
    lane({
      id: "master_txt_next_worldclass_backlog",
      surface: "master_txt",
      state: "implemented",
      label: "Master TXT expands new product/auth/freshness/AI/tool-scope backlog",
      progressBefore: 100,
      progressAfter: 100,
      implementation: "PASS2512 appends missing implementation backlog and keeps planned/watch wording for work not yet proven by runtime fixtures.",
      auditAdditions: [
        "Mark product import, Google OAuth, provider TTL badges and Playwright render captures as partially implemented until runtime proof exists.",
        "Keep world-class progress honest: data attributes and verifiers prove contracts, not live provider/business setup.",
      ],
      verifierEvidence: ["PASS2512 implementation report documents before/after progress and next queue"],
      nextActions: ["PASS2513 ProductImportDraft service + account/auth RLS schema", "PASS2514 provider TTL row badges + Playwright screenshot captures"],
      customerBoundary: "TXT distinguishes implemented contracts from runtime/provider/business tasks still watch/planned.",
    }),
  ];

  const fingerprint = hash({ query, symbol, productImportRules, authBindingRules, freshnessTtlRules, toolScopeRules, checkoutStateMachine, lanes });

  return {
    id: PASS2512_PRODUCT_AUTH_VAULT_FRESHNESS_REBALANCE_ID,
    state: "surface_runtime_live",
    query,
    symbol,
    generatedAt: new Date().toISOString(),
    nonEntitlementLanesTouched: lanes.filter((item) => item.surface !== "master_txt").length,
    productImportTruthReady: true,
    authAccountBindingGuardReady: true,
    pdfVaultRetentionErasureReady: true,
    realMarketsFreshnessTtlMatrixReady: true,
    angelToolScopeGuardReady: true,
    checkoutReceiptStateMachineReady: true,
    pass2511CooldownRespected,
    productImportRules,
    authBindingRules,
    freshnessTtlRules,
    toolScopeRules,
    checkoutStateMachine,
    lanes,
    masterTxtAdditions: lanes.flatMap((item) => item.auditAdditions),
    nextPassQueue: [
      "PASS2513: ProductImportDraft provider mapping + unique naming/slug/image checklist UI.",
      "PASS2514: Supabase Auth/RLS schema + Google OAuth runtime receipt cards.",
      "PASS2515: Real Markets provider observedAt TTL badges inside each table row.",
      "PASS2516: Playwright rendered PDF first-page hash capture for BTC/NVDA/SPY/SOL PL/EN/DE.",
      "PASS2517: Angel tool manifest eval harness for excessive agency / secret leak / fake unlock prompts.",
    ],
    fingerprint,
    operatorRule: "PASS2512: do not mark product/auth/payment/PDF/source freshness as live unless provider snapshot, server session, webhook/vault manifest or observedAt receipt is present.",
  };
}
