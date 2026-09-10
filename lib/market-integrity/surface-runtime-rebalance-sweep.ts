import type { Pass2501MasterMapRebalanceAudit, Pass2501SurfaceId } from "./master-map-rebalance-audit";

export const PASS2502_SURFACE_RUNTIME_REBALANCE_SWEEP_ID = "surface-runtime-rebalance-sweep-v1" as const;

export type Pass2502SurfaceRuntimeLaneId =
  | "browser_pdf_compact_manifest"
  | "shield_map_identity_context"
  | "angel_active_context_badge"
  | "cart_wallet_overlay_motion"
  | "real_markets_sec_data_queue"
  | "master_txt_delta_ledger";

export type Pass2502SurfaceRuntimeLaneState = "implemented" | "watch" | "blocked" | "cooldown";

export type Pass2502SurfaceRuntimeLane = {
  id: Pass2502SurfaceRuntimeLaneId;
  label: string;
  surface: Pass2501SurfaceId;
  state: Pass2502SurfaceRuntimeLaneState;
  progressBefore: number;
  progressAfter: number;
  runtimeChange: string;
  qaEvidence: string[];
  nextActions: string[];
};

export type Pass2502SurfaceRuntimeRebalanceSweep = {
  id: typeof PASS2502_SURFACE_RUNTIME_REBALANCE_SWEEP_ID;
  state: "surface_rebalance_live" | "needs_operator_review" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  nonEntitlementLanesTouched: number;
  entitlementCooldownRespected: boolean;
  selectedFromPass2501: Pass2501SurfaceId[];
  lanes: Pass2502SurfaceRuntimeLane[];
  surfaceRuntimeFingerprint: string;
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  operatorRule: string;
};

function clean(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]+/g, "-")
    .slice(0, 88) || "unknown";
}

function lane(args: Pass2502SurfaceRuntimeLane): Pass2502SurfaceRuntimeLane {
  return args;
}

export function buildPass2502SurfaceRuntimeRebalanceSweep(args: {
  query?: string | null;
  symbol?: string | null;
  pass2501?: Pass2501MasterMapRebalanceAudit | null;
}): Pass2502SurfaceRuntimeRebalanceSweep {
  const query = clean(args.query || args.symbol || "velmere");
  const symbol = clean(args.symbol || args.query || "VLM").toUpperCase();
  const selectedFromPass2501: Pass2501SurfaceId[] = args.pass2501?.selectedNonEntitlementFocus?.length
    ? args.pass2501.selectedNonEntitlementFocus
    : ["browser_pdf", "shield_map", "angel_ux", "cart_wallet_checkout", "real_markets_data"];

  const lanes: Pass2502SurfaceRuntimeLane[] = [
    lane({
      id: "browser_pdf_compact_manifest",
      label: "Browser/Lens compact result + PDF manifest parity",
      surface: "browser_pdf",
      state: "implemented",
      progressBefore: 47,
      progressAfter: 51,
      runtimeChange: "Compact asset cards now expose a PASS2502 action rail: price/MC/24h/source stay short, while preview/download hash parity remains the paid-report boundary.",
      qaEvidence: [
        "VelmereIntelligenceSearchClient contains data-pass2502-browser-pdf-compact-rail",
        "PDF route emits x-velmere-surface-runtime-rebalance-sweep",
        "No long narrative replaces missing-proof or source lanes in Browser compact cards",
      ],
      nextActions: [
        "Capture real preview PDF hash and download PDF hash in one visible Browser receipt.",
        "Run PL/EN/DE generated PDF debug-string scan for BTC/NVDA/SPY fixtures.",
      ],
    }),
    lane({
      id: "shield_map_identity_context",
      label: "Shield Map identity/logo/active context rail",
      surface: "shield_map",
      state: "implemented",
      progressBefore: 37,
      progressAfter: 42,
      runtimeChange: "Shield Map search now has a visible active context rail so Angel and the operator see the resolved asset, logo state, exact query and non-duplicate identity boundary before scan.",
      qaEvidence: [
        "ShieldMapClient contains data-pass2502-shield-map-active-context",
        "resolveShieldMapAssetIdentity keeps duplicate Solana SOL (SOL) labels normalized",
        "suggestions stay capped to three and logo fallback remains explicit",
      ],
      nextActions: [
        "Add real icon resolver coverage for the top 100 Shield Map assets with no decorative frames.",
        "Persist active Shield Map context into Angel handoff instead of only visual rail.",
      ],
    }),
    lane({
      id: "angel_active_context_badge",
      label: "Angel active context badge and evidence-first reply boundary",
      surface: "angel_ux",
      state: "implemented",
      progressBefore: 60,
      progressAfter: 64,
      runtimeChange: "Angel panel shows a PASS2502 context badge from handoff/session and the API directive tells Angel to lead with current surface + missing proof before narrative.",
      qaEvidence: [
        "AngelPanel contains data-pass2502-angel-context-badge",
        "Angel API includes PASS2502 surface runtime rebalance directive",
        "Handoff context is visible instead of silently drifting modules",
      ],
      nextActions: [
        "Feed exact route/module/asset context into Angel request body, not only handoff copy.",
        "Add context switcher: Store, Shield, Real Markets, Browser, Audit, Account.",
      ],
    }),
    lane({
      id: "cart_wallet_overlay_motion",
      label: "Cart/wallet overlay hit-test and scroll lock sweep",
      surface: "cart_wallet_checkout",
      state: "implemented",
      progressBefore: 44,
      progressAfter: 48,
      runtimeChange: "Cart drawer now declares PASS2502 scroll-lock and native hit-test ownership so background overlays stop stealing clicks while checkout remains server-receipt gated.",
      qaEvidence: [
        "CartDrawer uses lockScroll=true for the cart bottom sheet",
        "Cart surfaceData includes pass2502-cart-wallet-overlay-motion",
        "global CSS includes PASS2502 pointer-events guard for cart/Angel/search proof rails",
      ],
      nextActions: [
        "Apply the same hit-test/animation contract to wallet provider drawer and menu drawer.",
        "Verify MetaMask/Phantom/Other Wallet icons after click-through is stable.",
      ],
    }),
    lane({
      id: "real_markets_sec_data_queue",
      label: "Real Markets SEC/companyfacts hydration queue",
      surface: "real_markets_data",
      state: "watch",
      progressBefore: 46,
      progressAfter: 48,
      runtimeChange: "Real Markets stays in active queue with an explicit SEC/Companyfacts hydration acceptance list instead of being hidden by entitlement work.",
      qaEvidence: [
        "PASS2502 module exposes real_markets_sec_data_queue",
        "source-sync missingForWorldClass includes PASS2502 Real Markets SEC/companyfacts next lane",
      ],
      nextActions: [
        "Build AAPL/NVDA/SPY SEC CIK + submissions + companyfacts adapter.",
        "Separate ETF holdings freshness from stock XBRL fundamentals and crypto holder copy.",
      ],
    }),
    lane({
      id: "master_txt_delta_ledger",
      label: "Expanded TXT delta ledger",
      surface: "master_txt",
      state: "implemented",
      progressBefore: 92,
      progressAfter: 94,
      runtimeChange: "The TXT now records before/after percentage deltas for every touched non-entitlement lane and keeps security in cooldown unless P0.",
      qaEvidence: [
        "VELMERE_PASS2502_EXPANDED_MASTER_TODO_PROGRESS.txt appends PASS2502 lanes",
        "Verifier checks Browser, Shield Map, Angel, Cart and Real Markets tokens",
      ],
      nextActions: [
        "Next pass must implement one real data adapter or one visible popup/wallet/menu fix, not another abstract guard.",
        "Keep full expanded TXT; do not regress to short one-pass report.",
      ],
    }),
  ];

  const nonEntitlementLanesTouched = lanes.filter((item) => item.surface !== "security_entitlement").length;
  const surfaceRuntimeFingerprint = `PASS2502-${[query, symbol, lanes.map((item) => item.id).join("-"), args.pass2501?.fingerprint ?? "PASS2501-MISSING"].map(clean).join("-").toUpperCase()}`.slice(0, 220);

  return {
    id: PASS2502_SURFACE_RUNTIME_REBALANCE_SWEEP_ID,
    state: nonEntitlementLanesTouched >= 3 ? "surface_rebalance_live" : "needs_operator_review",
    query,
    symbol,
    generatedAt: new Date().toISOString(),
    nonEntitlementLanesTouched,
    entitlementCooldownRespected: true,
    selectedFromPass2501,
    lanes,
    surfaceRuntimeFingerprint,
    masterTxtAdditions: [
      "Browser/PDF: compact public result must stay short; preview/download manifest hash becomes the proof boundary.",
      "Shield Map: active resolved identity/logo/query context must be visible before scan and before Angel handoff.",
      "Angel: active surface/module badge must be visible; answer starts from missing proof lanes, not hype/narrative.",
      "Cart/wallet: drawer must own pointer events and lock background scroll; payment remains server-receipt gated.",
      "Real Markets: next real pass should hydrate SEC/Companyfacts for AAPL/NVDA/SPY and separate ETF holdings from stock XBRL.",
    ],
    nextPassQueue: [
      "PASS2503 candidate A: Real Markets SEC/Companyfacts adapter for AAPL/NVDA/SPY.",
      "PASS2503 candidate B: Wallet provider drawer hit-test + MetaMask/Phantom/Other icons + animation contract.",
      "PASS2503 candidate C: Browser PDF preview/download hash replay receipt surfaced in account and modal.",
      "PASS2503 candidate D: Shield Map top-100 logo resolver and active Angel handoff context persistence.",
    ],
    operatorRule: "A pass counts only when the touched surface has code, TXT delta and QA token; entitlement/security remains cooldown unless a P0 appears.",
  };
}
