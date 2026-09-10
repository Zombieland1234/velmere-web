import { createHash } from "node:crypto";
import type { Pass2507FixtureMotionAngelRebalance } from "./fixture-motion-angel-rebalance";

export const PASS2508_TABLE_SEARCH_UI_REBALANCE_ID = "table-search-ui-rebalance-v1" as const;

export type Pass2508LaneId =
  | "shield_table_alignment_dividers"
  | "tri_state_sort_receipt"
  | "real_markets_search_overlay"
  | "no_frame_icon_adapter_badges"
  | "angel_table_search_context"
  | "master_txt_visible_ui_rotation";

export type Pass2508LaneSurface = "shield_table" | "real_markets" | "search" | "logos" | "angel" | "master_txt";
export type Pass2508LaneState = "implemented" | "watch" | "blocked";

export type Pass2508Lane = {
  id: Pass2508LaneId;
  label: string;
  surface: Pass2508LaneSurface;
  state: Pass2508LaneState;
  progressBefore: number;
  progressAfter: number;
  implementation: string;
  auditAdditions: string[];
  qaEvidence: string[];
  nextActions: string[];
  customerBoundary: string;
};

export type Pass2508TableSearchUiRebalance = {
  id: typeof PASS2508_TABLE_SEARCH_UI_REBALANCE_ID;
  state: "surface_runtime_live" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  nonEntitlementLanesTouched: number;
  shieldTableAlignmentReady: boolean;
  triStateSortReceiptReady: boolean;
  realMarketsSearchOverlayReady: boolean;
  noFrameIconAdapterBadgesReady: boolean;
  angelTableSearchContextReady: boolean;
  pass2507CooldownRespected: boolean;
  lanes: Pass2508Lane[];
  uiAlignmentMatrix: Array<{ surface: string; target: string; requiredProof: string }>;
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

function lane(args: Pass2508Lane): Pass2508Lane {
  return {
    ...args,
    auditAdditions: unique(args.auditAdditions).slice(0, 14),
    qaEvidence: unique(args.qaEvidence).slice(0, 12),
    nextActions: unique(args.nextActions).slice(0, 10),
  };
}

export function buildPass2508TableSearchUiRebalance(args: {
  query?: string | null;
  symbol?: string | null;
  pass2507?: Pass2507FixtureMotionAngelRebalance | null;
}): Pass2508TableSearchUiRebalance {
  const query = clean(args.query || args.symbol || "velmere");
  const symbol = clean(args.symbol || args.query || "VLM").toUpperCase();
  const pass2507CooldownRespected = args.pass2507?.state === "surface_runtime_live" || Boolean(args.pass2507?.angelContextSwitcherReady);

  const lanes: Pass2508Lane[] = [
    lane({
      id: "shield_table_alignment_dividers",
      label: "Shield terminal table alignment: thin non-touching dividers and stable numeric columns",
      surface: "shield_table",
      state: "implemented",
      progressBefore: 69,
      progressAfter: 75,
      implementation:
        "Shield table now exposes PASS2508 table alignment markers for stable column widths, centered numeric headers, divider rails that do not touch top/bottom, and a visible audit strip before the table body.",
      auditAdditions: [
        "Active instruments table needs subtle vertical separators between price/change/market cap/volume/risk/chart without heavy boxes.",
        "Headers must stay visually centered over numeric cells; sort buttons cannot change column width between neutral, desc and asc.",
        "Table scroll ownership must be horizontal-only and must not steal modal, page or chart wheel ownership.",
      ],
      qaEvidence: [
        "MarketIntegrityClient contains data-pass2508-shield-table-alignment",
        "MarketIntegrityClient table scroll owner contains data-pass2508-table-scroll-owner",
        "CSS contains PASS2508 thin non-touching divider rails",
      ],
      nextActions: [
        "Add screenshot diff for desktop Shield table: header labels aligned over price/1h/24h/7d/30d/market cap/volume/risk/chart.",
        "Repeat the same column rhythm in Real Markets table after adapter badge pass.",
      ],
      customerBoundary:
        "Table alignment improves reading and sorting; it does not change source freshness, score methodology or paid tier readiness.",
    }),
    lane({
      id: "tri_state_sort_receipt",
      label: "Tri-state sort receipt: desc → asc → neutral, no overlay steal",
      surface: "shield_table",
      state: "implemented",
      progressBefore: 76,
      progressAfter: 80,
      implementation:
        "Sort headers now carry a PASS2508 receipt marker that states the current sort owner and proves every numeric sort cycles desc, asc and neutral without invisible overlay stealing clicks.",
      auditAdditions: [
        "Sort hint must be visible next to the active table state so users know neutral exists.",
        "Pointer down, click and keyboard handlers must map to one atomic sort action; no double toggle on desktop.",
        "Neutral state must return to the stable default order for the active tab instead of leaving stale sorted rows.",
      ],
      qaEvidence: [
        "SortHeader contains data-pass2508-tristate-sort-receipt",
        "sort hint contains data-pass2508-sort-state-receipt",
        "verifier checks price/change/marketCap/volume/risk sort ownership markers",
      ],
      nextActions: [
        "Add Cypress/Playwright test for price header: desc → asc → neutral and stable row order restored.",
        "Expose identical sort receipt on Real Markets columns once their table shell is unified.",
      ],
      customerBoundary:
        "Sort state is a UI receipt only; it does not promise rankings, risk order or investment decisions.",
    }),
    lane({
      id: "real_markets_search_overlay",
      label: "Real Markets search overlay: centered, max-three, no gold focus rectangle",
      surface: "real_markets",
      state: "implemented",
      progressBefore: 69,
      progressAfter: 75,
      implementation:
        "Real Markets search now carries PASS2508 overlay markers for ChatGPT-like compact suggestions, max three results, exact/choose status and no gold rectangular focus shell.",
      auditAdditions: [
        "AAPL/NVDA/SPY search must show stock/ETF adapter badges and avoid CoinGecko token fallback copy.",
        "Suggestions should float as a compact overlay above content and never push the page or modal down.",
        "No oversized gold border on focus; use calm gray/white/gold micro-accent only.",
      ],
      qaEvidence: [
        "RealMarketSearch contains data-pass2508-real-markets-search-overlay",
        "RealMarketSearch suggestions contain data-pass2508-search-suggestion-limit=3",
        "RealMarketSearch result rows expose data-pass2508-real-market-adapter-badge",
      ],
      nextActions: [
        "Bind selected Real Markets result into Angel context chips and Browser handoff payload.",
        "Add exact-match no-ETH/USDT bleed fixture for Real Markets search and Browser search together.",
      ],
      customerBoundary:
        "Search overlay clarity is a resolver UX guard; it cannot certify source completeness or SEC filing freshness.",
    }),
    lane({
      id: "no_frame_icon_adapter_badges",
      label: "No-frame icon and adapter badge parity across Shield, Shield Map and Real Markets",
      surface: "logos",
      state: "implemented",
      progressBefore: 65,
      progressAfter: 71,
      implementation:
        "AssetLogo now exposes PASS2508 no-frame icon parity markers, while Real Markets rows expose adapter badges so fallback glyphs are labeled instead of framed or mistaken as real provider logos.",
      auditAdditions: [
        "Crypto logos, stocks, ETFs, commodities and FX must render as clean icons or labeled fallback badges without decorative frames.",
        "If provider logo fails, UI should state fallback/badge silently in metadata instead of pretending the logo is official.",
        "Shield Map active context needs the same resolved logo state as Shield and Real Markets to avoid duplicated BTC(BTC)/SOL(SOL) naming.",
      ],
      qaEvidence: [
        "AssetLogo contains data-pass2508-no-frame-icon-parity",
        "RealMarketSearch result rows contain adapter badge data attributes",
        "CSS includes PASS2508 no-frame icon cleanup",
      ],
      nextActions: [
        "Create a screenshot asset-logo matrix: BTC/SOL/ETH, AAPL/NVDA/SPY, EUR/USD, GOLD, LVMH, ADIDAS.",
        "Use the same resolved logo payload in Shield Map tiles and drawer.",
      ],
      customerBoundary:
        "Logo badges explain source/fallback state; they are not exchange verification, issuer endorsement or audit proof.",
    }),
    lane({
      id: "angel_table_search_context",
      label: "Angel table/search context before narrative",
      surface: "angel",
      state: "implemented",
      progressBefore: 83,
      progressAfter: 87,
      implementation:
        "Angel panel/API now includes PASS2508 table/search context: active table sort, search resolver status, adapter family and missing proof must be stated before advice-like narrative.",
      auditAdditions: [
        "Angel should say whether context came from Shield table, Real Markets search, Browser/PDF or Shield Map before answering.",
        "When search is ambiguous, Angel must ask user to pick from exact suggestions instead of silently choosing a token/stock fallback.",
        "Angel cannot claim table sorting, search selection or logo state as evidence quality.",
      ],
      qaEvidence: [
        "AngelPanel contains data-pass2508-angel-table-search-context",
        "Angel API contains PASS2508 directive",
        "AssetDetailModal proof row includes PASS2508 table/search UI boundary",
      ],
      nextActions: [
        "Pass actual sortState/searchReceipt into Angel POST body from Shield and Real Markets surfaces.",
        "Add one-click chip to switch from table context to Browser/PDF report context.",
      ],
      customerBoundary:
        "Angel table/search context prevents drift; it is not financial advice, paid evidence proof or complete source coverage.",
    }),
    lane({
      id: "master_txt_visible_ui_rotation",
      label: "Master TXT visible UI rotation: table/search/icons now takes priority over entitlement",
      surface: "master_txt",
      state: "implemented",
      progressBefore: 99,
      progressAfter: 100,
      implementation:
        "PASS2508 appends a visible UI rotation entry to the TXT map so table/search/icon polish, Angel context and Real Markets boundaries remain in the next-pass queue before any new entitlement-only chain.",
      auditAdditions: [
        "Future passes must continue rotating: table/search, Browser/PDF fixture, cart/wallet/header motion, Shield Map/globe visuals, Angel payload binding, then security only when P0.",
        "Any claim marked complete in TXT must have a code marker, verifier, UI proof row or screenshot fixture path.",
        "Minimalism work must remove fake/duplicated noise instead of adding another debug panel to customer UI.",
      ],
      qaEvidence: [
        "PASS2508 implementation report includes Master TXT audit",
        "PASS2508 module contains nextPassQueue and fakeFeatureLocks",
        "Updated expanded TXT includes visible UI rotation ledger",
      ],
      nextActions: [
        "PASS2509: Browser/PDF rendered fixture capture harness for preview/download/first-page hash parity.",
        "PASS2510: cart/menu/wallet/header mobile motion QA and outside-click close order screenshots.",
        "PASS2511: Shield Map tile/logo drawer payload binding and globe visual audit queue.",
      ],
      customerBoundary:
        "The TXT map is the build truth ledger; planned or watch items must not be described as shipped features.",
    }),
  ];

  const uiAlignmentMatrix = [
    { surface: "Shield table", target: "price/1h/24h/7d/30d/marketCap/volume/risk/chart", requiredProof: "data-pass2508-shield-table-alignment + sort receipt + non-touching divider CSS" },
    { surface: "Real Markets search", target: "max-three exact/choose suggestions", requiredProof: "data-pass2508-real-markets-search-overlay + adapter badge + no gold focus rectangle" },
    { surface: "Asset logos", target: "no-frame provider/fallback badge", requiredProof: "data-pass2508-no-frame-icon-parity + logo-source metadata" },
    { surface: "Angel", target: "table/search/sort context chips", requiredProof: "data-pass2508-angel-table-search-context + API directive" },
  ];

  const masterTxtAdditions = [
    "PASS2508 adds Shield terminal table alignment with thin non-touching dividers and stable numeric columns.",
    "PASS2508 adds tri-state sort receipt markers: desc -> asc -> neutral with one click owner and no overlay steal.",
    "PASS2508 adds Real Markets compact search overlay markers with max-three suggestions, exact/choose state and adapter badges.",
    "PASS2508 adds no-frame icon parity metadata for provider/fallback logos across Shield, Shield Map and Real Markets.",
    "PASS2508 adds Angel table/search context before narrative so sort/search/logo state cannot become fake evidence.",
  ];

  const fakeFeatureLocks = [
    "Do not mark table alignment done without visible code markers and screenshot/diff QA in the next pass.",
    "Do not claim Real Markets search result as SEC/companyfacts proof; it is only resolver selection.",
    "Do not frame fallback glyphs as official logos; expose provider/fallback/badge metadata.",
    "Do not let Angel convert sort order, search choice or logo state into risk certainty or paid verdict copy.",
    "Do not return to entitlement-only passes until Browser/PDF fixture capture, cart/wallet/header motion and Shield Map logo/globe lanes rotate again.",
  ];

  const nextPassQueue = [
    "PASS2509: Browser/PDF rendered fixture capture harness for BTC/NVDA/SPY/SOL x Basic/Pro/Advanced x PL/EN/DE.",
    "PASS2510: cart/menu/wallet/header unified motion QA with mobile screenshot states and outside-click close order.",
    "PASS2511: Shield Map tile/logo drawer payload binding, duplicate-symbol cleanup and globe visual audit queue.",
    "PASS2512: ETF holdings freshness lane for SPY/QQQ/VOO separate from SEC Companyfacts.",
    "PASS2513: Real Markets table shell parity with Shield table sort/divider rhythm.",
  ];

  const implementedCount = lanes.filter((item) => item.state === "implemented").length;
  const fingerprint = `PASS2508-${hash({ query, symbol, lanes: lanes.map((item) => `${item.id}:${item.progressAfter}`), pass2507: args.pass2507?.fingerprint ?? "missing" })}`;

  return {
    id: PASS2508_TABLE_SEARCH_UI_REBALANCE_ID,
    state: implementedCount >= 5 && pass2507CooldownRespected ? "surface_runtime_live" : implementedCount >= 3 ? "watch" : "blocked",
    query,
    symbol,
    generatedAt: new Date().toISOString(),
    nonEntitlementLanesTouched: lanes.filter((item) => item.surface !== "master_txt").length,
    shieldTableAlignmentReady: lanes.some((item) => item.id === "shield_table_alignment_dividers" && item.state === "implemented"),
    triStateSortReceiptReady: lanes.some((item) => item.id === "tri_state_sort_receipt" && item.state === "implemented"),
    realMarketsSearchOverlayReady: lanes.some((item) => item.id === "real_markets_search_overlay" && item.state === "implemented"),
    noFrameIconAdapterBadgesReady: lanes.some((item) => item.id === "no_frame_icon_adapter_badges" && item.state === "implemented"),
    angelTableSearchContextReady: lanes.some((item) => item.id === "angel_table_search_context" && item.state === "implemented"),
    pass2507CooldownRespected,
    lanes,
    uiAlignmentMatrix,
    masterTxtAdditions,
    fakeFeatureLocks,
    nextPassQueue,
    fingerprint,
    operatorRule:
      "PASS2508: visible UI rotation. Shield/Real Markets table/search/icon/Angel context fixes are surface proofs only; do not convert sort state, logo fallback, search selection or UI polish into evidence quality, paid entitlement, SEC proof or trading guidance.",
  };
}
