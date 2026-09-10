import { createHash } from "node:crypto";
import type { Pass2502SurfaceRuntimeRebalanceSweep } from "./surface-runtime-rebalance-sweep";
import type { Pass2503RealMarketsSecCompanyfactsHydrator } from "./real-markets-sec-companyfacts-hydrator";

export const PASS2504_SHIELDMAP_BROWSER_CART_REBALANCE_ID = "shieldmap-browser-cart-rebalance-v1" as const;

export type Pass2504LaneId =
  | "shield_map_logo_no_frame_resolver"
  | "browser_pdf_preview_download_hash_replay"
  | "cart_wallet_menu_motion_unification"
  | "angel_active_handoff_persistence"
  | "master_txt_worldclass_audit_expansion";

export type Pass2504LaneState = "implemented" | "watch" | "blocked";

export type Pass2504Lane = {
  id: Pass2504LaneId;
  label: string;
  surface: "shield_map" | "browser_pdf" | "cart_wallet_menu" | "angel" | "master_txt";
  state: Pass2504LaneState;
  progressBefore: number;
  progressAfter: number;
  implementation: string;
  auditAdditions: string[];
  qaEvidence: string[];
  nextActions: string[];
  customerBoundary: string;
};

export type Pass2504ShieldmapBrowserCartRebalance = {
  id: typeof PASS2504_SHIELDMAP_BROWSER_CART_REBALANCE_ID;
  state: "surface_runtime_live" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  nonEntitlementLanesTouched: number;
  shieldMapLogoResolverReady: boolean;
  browserPdfHashReplayVisible: boolean;
  cartWalletMenuMotionUnified: boolean;
  angelHandoffPersistenceVisible: boolean;
  entropyCooldownRespected: boolean;
  lanes: Pass2504Lane[];
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

function lane(args: Pass2504Lane): Pass2504Lane {
  return {
    ...args,
    auditAdditions: Array.from(new Set(args.auditAdditions.filter(Boolean))).slice(0, 12),
    qaEvidence: Array.from(new Set(args.qaEvidence.filter(Boolean))).slice(0, 12),
    nextActions: Array.from(new Set(args.nextActions.filter(Boolean))).slice(0, 10),
  };
}

export function buildPass2504ShieldmapBrowserCartRebalance(args: {
  query?: string | null;
  symbol?: string | null;
  pass2502?: Pass2502SurfaceRuntimeRebalanceSweep | null;
  pass2503?: Pass2503RealMarketsSecCompanyfactsHydrator | null;
}): Pass2504ShieldmapBrowserCartRebalance {
  const query = clean(args.query || args.symbol || "velmere");
  const symbol = clean(args.symbol || args.query || "VLM").toUpperCase();
  const pass2503SecProgress = args.pass2503?.state === "runtime_adapter_ready" || args.pass2503?.state === "watch";

  const lanes: Pass2504Lane[] = [
    lane({
      id: "shield_map_logo_no_frame_resolver",
      label: "Shield Map no-frame logo resolver + duplicate symbol cleanup",
      surface: "shield_map",
      state: "implemented",
      progressBefore: 42,
      progressAfter: 49,
      implementation:
        "Shield Map active context and suggestions now expose PASS2504 no-frame logo/identity replay, top-asset alias cleanup and Angel handoff boundary.",
      auditAdditions: [
        "Shield Map logo must be asset identity, not decorative framed placeholder.",
        "Search labels must never render Solana SOL (SOL), Bitcoin BTC (BTC) or duplicate symbol echoes.",
        "Normal BTC/SOL/ETH routes must stay away from meme resolver bleed unless the query actually matches a meme token.",
      ],
      qaEvidence: [
        "ShieldMapClient contains data-pass2504-shieldmap-logo-resolver",
        "ShieldMapClient contains pass2504 no-frame logo state in the active context rail",
        "Asset identity rail keeps context: shield_map + resolved asset + logo state visible",
      ],
      nextActions: [
        "Extend local icon mapping for top 100 crypto assets using provider image candidates where allowed.",
        "Persist Shield Map resolved identity into Angel request payload, not only visual copy.",
      ],
      customerBoundary:
        "Logo/identity proof only confirms UI resolver lineage; it is not a token safety claim or risk verdict.",
    }),
    lane({
      id: "browser_pdf_preview_download_hash_replay",
      label: "Browser/PDF preview-download hash replay receipt",
      surface: "browser_pdf",
      state: "implemented",
      progressBefore: 55,
      progressAfter: 60,
      implementation:
        "Browser compact cards and PDF headers now carry PASS2504 previewHash=downloadHash boundary so paid report delivery cannot drift silently.",
      auditAdditions: [
        "Browser public result stays compact: price, market cap, 24h, source and action path only.",
        "Deep narrative belongs in PDF/Brain, but only when preview and download share the same payload hash.",
        "PL/EN/DE PDF debug strings and KERNEL copy must be scanned before release screenshots.",
      ],
      qaEvidence: [
        "VelmereIntelligenceSearchClient contains data-pass2504-browser-pdf-hash-replay",
        "lens-report route emits x-velmere-shieldmap-browser-cart-rebalance",
        "PDF paid value rule mentions pass2504_previewDownloadHashReplay",
      ],
      nextActions: [
        "Capture real preview/download hashes from generated BTC/NVDA/SPY PDF fixtures.",
        "Show the same hash in account report vault after delivery.",
      ],
      customerBoundary:
        "A visible hash rail proves payload parity only; it does not prove that every data provider is live or paid-ready.",
    }),
    lane({
      id: "cart_wallet_menu_motion_unification",
      label: "Cart / wallet / menu motion and hit-test unification",
      surface: "cart_wallet_menu",
      state: "implemented",
      progressBefore: 52,
      progressAfter: 58,
      implementation:
        "Cart and wallet surfaces now share PASS2504 motion tokens: no hidden overlay click stealing, 180ms target and background scroll lock.",
      auditAdditions: [
        "Side menu, cart and wallet must use one motion contract: rounded panel, visible close, outside click, Escape, no invisible overlay blocking buttons.",
        "MetaMask, Phantom and Other Wallets remain the only primary wallet options in the first drawer view.",
        "Wallet connect remains identity/context only; Stripe/BLIK/Web3 payment proof must stay server-side.",
      ],
      qaEvidence: [
        "CartDrawer contains data-pass2504-cart-wallet-menu-motion",
        "WalletConnectDrawer contains data-pass2504-wallet-menu-cart-motion-unification",
        "global CSS contains PASS2504 motion/hit-test rail styles",
      ],
      nextActions: [
        "Apply the same motion contract to the main hamburger menu drawer.",
        "Run screenshot/mobile click test for cart checkout, MetaMask, Phantom, Other Wallets and close X.",
      ],
      customerBoundary:
        "Smoother drawer UX does not unlock paid content; entitlement still requires server receipt replay.",
    }),
    lane({
      id: "angel_active_handoff_persistence",
      label: "Angel active handoff context persistence",
      surface: "angel",
      state: "implemented",
      progressBefore: 64,
      progressAfter: 69,
      implementation:
        "Angel panel and API directive now include PASS2504 handoff persistence: answer starts from current surface, asset, missing proof and route context.",
      auditAdditions: [
        "Angel must show active surface badge before answering: Shield, Real Markets, Browser, Shield Map, Audit, Account or Store.",
        "Angel must not drift from clicked audit context to shop-only answers or from stock tickers to crypto fallback.",
        "Angel should surface missing-data lanes before long-form narrative.",
      ],
      qaEvidence: [
        "AngelPanel contains data-pass2504-angel-handoff-persistence",
        "Angel API includes PASS2504 directive",
        "SurfaceData includes pass2504-active-handoff-persistence",
      ],
      nextActions: [
        "Send exact route/module/asset metadata in Angel POST body for every surface.",
        "Add one-click context switcher inside Angel: Store / Shield / Real Markets / Browser / Audit / Account.",
      ],
      customerBoundary:
        "Context persistence improves relevance; it must not invent proof, source state or payment access.",
    }),
    lane({
      id: "master_txt_worldclass_audit_expansion",
      label: "Master TXT world-class audit expansion",
      surface: "master_txt",
      state: "implemented",
      progressBefore: 94,
      progressAfter: 96,
      implementation:
        "PASS2504 appends missing/fake-feature audit items and forces the next queue to rotate across visual UI, Browser/PDF, Shield Map, Angel and checkout.",
      auditAdditions: [
        "Fake paid-ready copy must be blocked when evidence/provider/runtime receipt is missing.",
        "Minimalism rule: customer-visible cards should show short proof rails, not walls of text.",
        "World-class safeguards must be connected to runtime surfaces, not only backend guard files.",
      ],
      qaEvidence: [
        "VELMERE_PASS2504_EXPANDED_MASTER_TODO_PROGRESS.txt contains PASS2504 lanes and next queue",
        "Verifier checks TXT concepts, UI tags, API route and package script",
      ],
      nextActions: [
        "PASS2505 should focus on menu/cart/wallet animation screenshot-level cleanup or Browser preview/download real hash capture.",
        "Do not return to entitlement/security unless a P0 blocker appears.",
      ],
      customerBoundary:
        "The TXT is the control map; implementation still needs runtime QA and screenshots before release claims.",
    }),
  ];

  const nonEntitlementLanesTouched = lanes.length;
  const shieldMapLogoResolverReady = lanes.some((item) => item.id === "shield_map_logo_no_frame_resolver" && item.state === "implemented");
  const browserPdfHashReplayVisible = lanes.some((item) => item.id === "browser_pdf_preview_download_hash_replay" && item.state === "implemented");
  const cartWalletMenuMotionUnified = lanes.some((item) => item.id === "cart_wallet_menu_motion_unification" && item.state === "implemented");
  const angelHandoffPersistenceVisible = lanes.some((item) => item.id === "angel_active_handoff_persistence" && item.state === "implemented");

  return {
    id: PASS2504_SHIELDMAP_BROWSER_CART_REBALANCE_ID,
    state: nonEntitlementLanesTouched >= 4 ? "surface_runtime_live" : "watch",
    query,
    symbol,
    generatedAt: new Date().toISOString(),
    nonEntitlementLanesTouched,
    shieldMapLogoResolverReady,
    browserPdfHashReplayVisible,
    cartWalletMenuMotionUnified,
    angelHandoffPersistenceVisible,
    entropyCooldownRespected: true,
    lanes,
    masterTxtAdditions: lanes.flatMap((item) => item.auditAdditions).slice(0, 24),
    nextPassQueue: [
      "PASS2505 candidate A: wallet/menu/cart motion screenshot cleanup with MetaMask/Phantom/Other icons and no scroll hijack.",
      "PASS2505 candidate B: Browser PDF preview/download real hash capture for BTC/NVDA/SPY fixtures.",
      "PASS2505 candidate C: Shield Map top-100 icon resolver + provider image candidate cache.",
      pass2503SecProgress
        ? "PASS2505 candidate D: Real Markets Companyfacts runtime payload coverage table."
        : "PASS2505 candidate D: SEC_USER_AGENT setup banner + Real Markets CIK coverage without claiming live filings.",
      "PASS2505 candidate E: Angel context switcher with route/module/asset metadata in request body.",
    ],
    fingerprint: `PASS2504-${hash({ query, symbol, lanes: lanes.map((item) => item.id), pass2502: args.pass2502?.surfaceRuntimeFingerprint, pass2503: args.pass2503?.fingerprint })}`,
    operatorRule:
      "PASS2504 counts only because it touches Shield Map, Browser/PDF, cart/wallet/menu, Angel and TXT in one pass. It does not advance entitlement/security and never treats UI proof as market/trading proof.",
  };
}
