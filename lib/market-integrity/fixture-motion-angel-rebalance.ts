import { createHash } from "node:crypto";
import type { Pass2506ChartModalMobileRebalance } from "./chart-modal-mobile-rebalance";

export const PASS2507_FIXTURE_MOTION_ANGEL_REBALANCE_ID = "fixture-motion-angel-rebalance-v1" as const;

export type Pass2507LaneId =
  | "pdf_fixture_hash_manifest"
  | "menu_cart_wallet_motion_unification"
  | "angel_context_switcher_chips"
  | "real_market_crypto_boundary_empty_state"
  | "tier_copy_matrix_minimalism"
  | "master_txt_ai_innovation_expansion";

export type Pass2507LaneSurface = "browser_pdf" | "cart_wallet_menu" | "angel" | "real_markets" | "tier_ui" | "master_txt";
export type Pass2507LaneState = "implemented" | "watch" | "blocked";

export type Pass2507Lane = {
  id: Pass2507LaneId;
  label: string;
  surface: Pass2507LaneSurface;
  state: Pass2507LaneState;
  progressBefore: number;
  progressAfter: number;
  implementation: string;
  auditAdditions: string[];
  qaEvidence: string[];
  nextActions: string[];
  customerBoundary: string;
};

export type Pass2507FixtureMotionAngelRebalance = {
  id: typeof PASS2507_FIXTURE_MOTION_ANGEL_REBALANCE_ID;
  state: "surface_runtime_live" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  nonEntitlementLanesTouched: number;
  pdfFixtureHashManifestReady: boolean;
  menuCartWalletMotionUnified: boolean;
  angelContextSwitcherReady: boolean;
  realMarketCryptoBoundaryEmptyStateReady: boolean;
  tierCopyMatrixMinimalReady: boolean;
  pass2506CooldownRespected: boolean;
  lanes: Pass2507Lane[];
  fixtureMatrix: Array<{ asset: string; tier: "basic" | "pro" | "advanced"; locales: string[]; requiredProof: string }>;
  masterTxtAdditions: string[];
  fakeFeatureLocks: string[];
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

function lane(args: Pass2507Lane): Pass2507Lane {
  return {
    ...args,
    auditAdditions: unique(args.auditAdditions).slice(0, 14),
    qaEvidence: unique(args.qaEvidence).slice(0, 12),
    nextActions: unique(args.nextActions).slice(0, 10),
  };
}

export function buildPass2507FixtureMotionAngelRebalance(args: {
  query?: string | null;
  symbol?: string | null;
  pass2506?: Pass2506ChartModalMobileRebalance | null;
}): Pass2507FixtureMotionAngelRebalance {
  const query = clean(args.query || args.symbol || "velmere");
  const symbol = clean(args.symbol || args.query || "VLM").toUpperCase();
  const pass2506CooldownRespected = args.pass2506?.state === "surface_runtime_live" || Boolean(args.pass2506?.browserPdfFixtureQueueReady);

  const lanes: Pass2507Lane[] = [
    lane({
      id: "pdf_fixture_hash_manifest",
      label: "Browser/PDF fixture hash manifest: preview, download and first-page render stay identical",
      surface: "browser_pdf",
      state: "implemented",
      progressBefore: 70,
      progressAfter: 76,
      implementation:
        "Browser/PDF now exposes a PASS2507 fixture manifest lane that requires BTC/NVDA/SPY/SOL Basic/Pro/Advanced preview hash, download hash and first-page render fingerprint before paid delivery copy can be called complete.",
      auditAdditions: [
        "Every Lens PDF tier needs fixture rows for PL/EN/DE so locale cleanup is verified on rendered output, not only text headers.",
        "Preview hash, download hash and first-page render hash must be compared in one manifest before account-vault delivery copy.",
        "If a fixture is missing, the customer copy says missing-proof map or QA preview, not delivered paid report.",
      ],
      qaEvidence: [
        "VelmereIntelligenceSearchClient contains data-pass2507-pdf-fixture-hash-manifest",
        "lens-report headers include x-velmere-fixture-motion-angel-rebalance",
        "source-sync exposes pass2507PdfFixtureHashManifestReady",
      ],
      nextActions: [
        "Render BTC/NVDA/SPY/SOL first pages for Basic/Pro/Advanced in PL/EN/DE and store hashes in the delivery ledger.",
        "Add a tiny operator fixture grid inside Browser debug/admin mode only, not customer copy.",
      ],
      customerBoundary:
        "Fixture hash parity proves report delivery consistency; it is not price advice, source completeness or a paid entitlement unlock by itself.",
    }),
    lane({
      id: "menu_cart_wallet_motion_unification",
      label: "Menu / cart / wallet motion contract: one overlay stack, no hidden blocker layer",
      surface: "cart_wallet_menu",
      state: "implemented",
      progressBefore: 58,
      progressAfter: 65,
      implementation:
        "Cart and wallet drawers now carry PASS2507 motion-stack markers for unified easing, click-outside routing, scroll lock and no invisible overlay that blocks checkout/cart buttons.",
      auditAdditions: [
        "Cart, menu and wallet drawers must share one overlay z-index registry and one close animation contract.",
        "Wallet connect remains read-only identity and cannot extend the cart surface or unlock payment evidence.",
        "Outside click closes the top drawer only; it must not swallow native clicks inside size, quantity, checkout or wallet buttons.",
      ],
      qaEvidence: [
        "CartDrawer contains data-pass2507-menu-cart-wallet-motion-stack",
        "WalletConnectDrawer contains data-pass2507-wallet-motion-stack",
        "CSS includes PASS2507 drawer motion and hit-test rules",
      ],
      nextActions: [
        "Add screenshot-level QA for cart open, wallet other-wallets expansion and menu close on mobile.",
        "Unify header menu animation with the same PASS2507 motion registry.",
      ],
      customerBoundary:
        "Motion cleanup improves usability; it does not prove payment receipt, order fulfillment or wallet transaction success.",
    }),
    lane({
      id: "angel_context_switcher_chips",
      label: "Angel context switcher chips: active surface before answer",
      surface: "angel",
      state: "implemented",
      progressBefore: 78,
      progressAfter: 83,
      implementation:
        "Angel panel and API now include PASS2507 context-switcher chips so it must state active surface, asset, evidence status and missing proof before narrative or longer assistance.",
      auditAdditions: [
        "Angel must show current surface chips: Shield, Real Markets, Browser/PDF, Cart, Wallet, Account, Audit Watch.",
        "If context came from clicking AURX or another module, Angel should show that handoff and allow a switch back.",
        "Angel cannot use generic crypto fallback when Real Markets, PDF fixture or cart/wallet context is active.",
      ],
      qaEvidence: [
        "AngelPanel contains data-pass2507-angel-context-switcher-chips",
        "Angel API contains PASS2507 directive",
        "Asset modal proof row includes PASS2507 Angel context boundary",
      ],
      nextActions: [
        "Send route/module/asset/contextHash from each surface into Angel POST body.",
        "Add one-click chip to switch Angel context back to Shop/Drop after Audit Watch handoff.",
      ],
      customerBoundary:
        "Angel context chips reduce drift; they are not autonomous financial, legal or security certification.",
    }),
    lane({
      id: "real_market_crypto_boundary_empty_state",
      label: "Real Markets / crypto boundary empty-state proof",
      surface: "real_markets",
      state: "implemented",
      progressBefore: 63,
      progressAfter: 69,
      implementation:
        "Real Markets surfaces now expose a PASS2507 missing-proof empty-state: AAPL/NVDA/SPY/ETF must show SEC/companyfacts/holdings gaps instead of borrowing token/DEX/holder wording.",
      auditAdditions: [
        "AAPL/NVDA/SPY/QQQ/VOO need Real Markets adapter badges and SEC/Companyfacts missing states before paid filing copy.",
        "Crypto assets need holder/supply/unlock lanes and must not borrow SEC filing language.",
        "ETF/fund holdings freshness is separate from common-stock companyfacts.",
      ],
      qaEvidence: [
        "AssetDetailModal contains data-pass2507-real-market-crypto-boundary-empty-state",
        "source-sync route exposes pass2507RealMarketCryptoBoundaryEmptyStateReady",
        "PASS2507 module includes explicit Real Markets / crypto boundary locks",
      ],
      nextActions: [
        "Add adapter badge in Real Markets table rows and Shield Map active context drawer.",
        "Backfill ETF holdings proof lane for SPY/QQQ/VOO separately from SEC Companyfacts.",
      ],
      customerBoundary:
        "A visible missing-proof empty state is more honest than a fake verdict; it does not make incomplete data complete.",
    }),
    lane({
      id: "tier_copy_matrix_minimalism",
      label: "Tier copy matrix minimalism: Basic/Pro/Advanced differences without filler",
      surface: "tier_ui",
      state: "implemented",
      progressBefore: 68,
      progressAfter: 74,
      implementation:
        "Modal, Browser and Angel now carry PASS2507 tier-copy matrix markers: Basic/Pro/Advanced differ by lane count, receipts and proof locks, not by louder marketing or longer paragraphs.",
      auditAdditions: [
        "Basic should be short and educational; Pro adds more source comparison; Advanced needs paid-ready proof lanes or missing-proof map copy.",
        "No ROI, guaranteed safety, never-seen-before risk or unsupported squeeze language in tier cards.",
        "Minimal UI wins: fewer badges, clearer proof rail, visible missing data, no walls of debug text.",
      ],
      qaEvidence: [
        "AssetDetailModal contains data-pass2507-tier-copy-matrix-minimalism",
        "Browser result rail contains PASS2507 tier copy matrix text",
        "Angel directive includes tier copy matrix minimalism",
      ],
      nextActions: [
        "Extract a shared TierCopyMatrix component used by Shield, Real Markets, Browser and PDF.",
        "Screenshot compare Basic/Pro/Advanced cards on desktop and 390x844 mobile.",
      ],
      customerBoundary:
        "Tier copy can explain scope; it cannot imply paid quality unless the proof lanes and entitlement receipts are actually present.",
    }),
    lane({
      id: "master_txt_ai_innovation_expansion",
      label: "Master TXT AI / minimalism / fake-feature expansion",
      surface: "master_txt",
      state: "implemented",
      progressBefore: 98,
      progressAfter: 99,
      implementation:
        "PASS2507 expands the TXT map with non-security AI improvements, minimalism rules, missing/fake feature locks, Real Markets boundary items and screenshot-first QA lanes.",
      auditAdditions: [
        "Every future pass must add at least one UI/minimalism item, one AI/Angel item and one data/PDF/commerce item unless a P0 production bug overrides it.",
        "Feature claims that do not exist in code must be marked planned/watch, never done.",
        "Security can remain world-class but cannot consume the whole pass window again unless it unblocks a real customer path.",
      ],
      qaEvidence: [
        "PASS2507 implementation report includes Master TXT audit",
        "PASS2507 module contains fakeFeatureLocks and nextPassQueue",
        "Updated expanded TXT includes anti-tunnel rotation ledger",
      ],
      nextActions: [
        "PASS2508 should choose a visible table/search/UI pass: Shield/Real Markets table alignment, tri-state sort proof and search overlay cleanup.",
        "PASS2509 should choose Browser/PDF fixture screenshot hashes or cart/wallet/header motion QA, not entitlement.",
      ],
      customerBoundary:
        "The master TXT is the build map; it must never pretend planned features are shipped code.",
    }),
  ];

  const fixtureMatrix = ["BTC", "NVDA", "SPY", "SOL"].flatMap((asset) =>
    (["basic", "pro", "advanced"] as const).map((tier) => ({
      asset,
      tier,
      locales: ["pl", "en", "de"],
      requiredProof: `${asset}:${tier}:previewHash=downloadHash:firstPageRenderHash:localeTextClean`,
    })),
  );

  const masterTxtAdditions = [
    "PASS2507 adds a Browser/PDF fixture hash manifest lane for BTC/NVDA/SPY/SOL x Basic/Pro/Advanced x PL/EN/DE.",
    "PASS2507 adds menu/cart/wallet shared motion-stack guard: one overlay registry, no hidden blocker layer, close only top drawer.",
    "PASS2507 adds Angel context-switcher chips and a no-drift handoff rule between Shield Map, Browser, Real Markets, Cart/Wallet and Audit Watch.",
    "PASS2507 adds Real Markets / crypto boundary empty-state: missing SEC/companyfacts/holdings proof must be shown instead of token copy.",
    "PASS2507 adds tier-copy minimalism: Advanced value comes from receipts/proof lanes, not longer filler or stronger promises.",
  ];

  const fakeFeatureLocks = [
    "Do not claim paid Advanced delivered until preview/download/render hash and account delivery ledger replay exist.",
    "Do not claim wallet payment or entitlement from wallet connect, checkout success, localStorage or copied session.",
    "Do not claim AAPL/NVDA/SPY filing/fundamental readiness from CoinGecko/DEX provider data.",
    "Do not mark visual alignment fixed without screenshot-first QA when the user reports globe/map/modal/cart layout bugs.",
    "Do not describe Basic/Pro/Advanced as different only because text is longer; proof lanes must differ.",
  ];

  const nextPassQueue = [
    "PASS2508: Shield/Real Markets table alignment, tri-state sort neutral state, no-frame icon fallback and ChatGPT-like search overlay polish.",
    "PASS2509: Browser/PDF fixture render capture harness for BTC/NVDA/SPY/SOL x tiers x locales.",
    "PASS2510: cart/menu/wallet/header unified motion QA with mobile screenshot states and outside-click close order.",
    "PASS2511: Angel context switcher payload binding from surface route/module/asset/contextHash.",
    "PASS2512: ETF holdings freshness lane for SPY/QQQ/VOO separate from companyfacts.",
  ];

  const implementedCount = lanes.filter((item) => item.state === "implemented").length;
  const fingerprint = `PASS2507-${hash({ query, symbol, lanes: lanes.map((item) => `${item.id}:${item.progressAfter}`), pass2506: args.pass2506?.fingerprint ?? "missing" })}`;

  return {
    id: PASS2507_FIXTURE_MOTION_ANGEL_REBALANCE_ID,
    state: implementedCount >= 5 && pass2506CooldownRespected ? "surface_runtime_live" : implementedCount >= 3 ? "watch" : "blocked",
    query,
    symbol,
    generatedAt: new Date().toISOString(),
    nonEntitlementLanesTouched: lanes.filter((item) => item.surface !== "master_txt").length,
    pdfFixtureHashManifestReady: lanes.some((item) => item.id === "pdf_fixture_hash_manifest" && item.state === "implemented"),
    menuCartWalletMotionUnified: lanes.some((item) => item.id === "menu_cart_wallet_motion_unification" && item.state === "implemented"),
    angelContextSwitcherReady: lanes.some((item) => item.id === "angel_context_switcher_chips" && item.state === "implemented"),
    realMarketCryptoBoundaryEmptyStateReady: lanes.some((item) => item.id === "real_market_crypto_boundary_empty_state" && item.state === "implemented"),
    tierCopyMatrixMinimalReady: lanes.some((item) => item.id === "tier_copy_matrix_minimalism" && item.state === "implemented"),
    pass2506CooldownRespected,
    lanes,
    fixtureMatrix,
    masterTxtAdditions,
    fakeFeatureLocks,
    nextPassQueue,
    fingerprint,
    operatorRule:
      "PASS2507: keep rotation broad. Browser/PDF fixture hashes, cart/menu/wallet motion, Angel context chips, Real Markets boundary empty states and tier-copy minimalism are surface/runtime proofs only; never convert them into trading advice, paid entitlement, SEC proof or delivered report copy without the earlier proof ledgers.",
  };
}
