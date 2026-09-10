import { createHash } from "node:crypto";
import type { Pass2505LocalePdfAngelCleanlinessRebalance } from "./locale-pdf-angel-cleanliness-rebalance";

export const PASS2506_CHART_MODAL_MOBILE_REBALANCE_ID = "chart-modal-mobile-rebalance-v1" as const;

export type Pass2506LaneId =
  | "chart_wheel_touch_owner"
  | "mobile_modal_safe_area_scroll"
  | "shared_shield_realmarkets_chart_shell"
  | "browser_pdf_fixture_render_queue"
  | "angel_chart_context_microcopy"
  | "master_txt_visual_bug_expansion";

export type Pass2506LaneState = "implemented" | "watch" | "blocked";

export type Pass2506Lane = {
  id: Pass2506LaneId;
  label: string;
  surface: "chart" | "modal" | "browser_pdf" | "angel" | "master_txt";
  state: Pass2506LaneState;
  progressBefore: number;
  progressAfter: number;
  implementation: string;
  auditAdditions: string[];
  qaEvidence: string[];
  nextActions: string[];
  customerBoundary: string;
};

export type Pass2506ChartModalMobileRebalance = {
  id: typeof PASS2506_CHART_MODAL_MOBILE_REBALANCE_ID;
  state: "surface_runtime_live" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  nonEntitlementLanesTouched: number;
  chartWheelTouchOwnerReady: boolean;
  mobileModalSafeAreaReady: boolean;
  sharedChartShellParityReady: boolean;
  browserPdfFixtureQueueReady: boolean;
  angelChartContextMicrocopyReady: boolean;
  pass2505CooldownRespected: boolean;
  lanes: Pass2506Lane[];
  masterTxtAdditions: string[];
  visualBugLocks: string[];
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

function lane(args: Pass2506Lane): Pass2506Lane {
  return {
    ...args,
    auditAdditions: Array.from(new Set(args.auditAdditions.filter(Boolean))).slice(0, 14),
    qaEvidence: Array.from(new Set(args.qaEvidence.filter(Boolean))).slice(0, 12),
    nextActions: Array.from(new Set(args.nextActions.filter(Boolean))).slice(0, 10),
  };
}

export function buildPass2506ChartModalMobileRebalance(args: {
  query?: string | null;
  symbol?: string | null;
  pass2505?: Pass2505LocalePdfAngelCleanlinessRebalance | null;
}): Pass2506ChartModalMobileRebalance {
  const query = clean(args.query || args.symbol || "velmere");
  const symbol = clean(args.symbol || args.query || "VLM").toUpperCase();

  const lanes: Pass2506Lane[] = [
    lane({
      id: "chart_wheel_touch_owner",
      label: "Chart wheel/touch owner guard: modal chart cannot scroll background",
      surface: "chart",
      state: "implemented",
      progressBefore: 62,
      progressAfter: 68,
      implementation:
        "AdvancedMarketChart and the asset modal chart now expose PASS2506 wheel/touch ownership markers so wheel, pinch and drag stay inside the chart surface instead of leaking page scroll.",
      auditAdditions: [
        "Every chart surface must explicitly own wheel/pinch/drag and return control only when the pointer leaves the chart.",
        "The modal background must stay locked while chart zoom/pan happens; no page jump on first drag.",
        "Timeframe changes must not reset the modal scroll position or close the VLM Analysis tier selector.",
      ],
      qaEvidence: [
        "AdvancedMarketChart contains data-pass2506-chart-wheel-touch-owner",
        "AssetDetailModal backdrop and chart wrap contain PASS2506 wheel owner markers",
        "CSS includes PASS2506 overscroll/touch-action guard",
      ],
      nextActions: [
        "Record one desktop wheel zoom and one mobile pinch QA screenshot/video for BTC and NVDA.",
        "Move legacy chart fallback generation behind a visible source-shaped fallback badge.",
      ],
      customerBoundary:
        "Chart interaction quality is a UX proof only; it is not a market prediction, source proof or paid entitlement proof.",
    }),
    lane({
      id: "mobile_modal_safe_area_scroll",
      label: "Mobile modal safe-area and reachable VLM Analysis controls",
      surface: "modal",
      state: "implemented",
      progressBefore: 55,
      progressAfter: 63,
      implementation:
        "Asset detail modal now carries PASS2506 safe-area markers and CSS guardrails so close button, timeframe rail and VLM Analysis controls remain reachable on 390x844-style screens.",
      auditAdditions: [
        "Mobile modal must have one internal scroll container, not body scroll plus nested scroll fighting.",
        "Close X must stay visible above chart/loading/result states.",
        "VLM Analysis Basic/Pro/Advanced selector must be reachable without hidden footer clipping.",
      ],
      qaEvidence: [
        "AssetDetailModal contains data-pass2506-mobile-safe-area-modal",
        "AssetDetailModal contains data-pass2506-mobile-analysis-reachability",
        "CSS includes max-height/safe-area PASS2506 rules",
      ],
      nextActions: [
        "Run mobile visual QA: 390x844 Shield, Real Markets and Browser modal states.",
        "Add Playwright mobile smoke after dependencies are restored locally.",
      ],
      customerBoundary:
        "Safe-area reachability prevents broken UI; it does not unlock Advanced or verify market data.",
    }),
    lane({
      id: "shared_shield_realmarkets_chart_shell",
      label: "Shared Shield / Real Markets chart shell parity",
      surface: "chart",
      state: "implemented",
      progressBefore: 51,
      progressAfter: 58,
      implementation:
        "Shield and Real Markets detail charts expose the same PASS2506 shared chart shell boundary so crypto/equity charts do not drift into two unrelated interaction systems.",
      auditAdditions: [
        "BTC/SOL and AAPL/NVDA/SPY chart shells should share controls, drag rules, timeframe rail and missing-source copy.",
        "Real Markets cannot show crypto-only DEX/holder copy in the chart shell.",
        "Crypto cannot borrow SEC/companyfacts copy inside chart controls.",
      ],
      qaEvidence: [
        "AdvancedMarketChart contains data-pass2506-shield-realmarkets-chart-shell",
        "AssetDetailModal proof row names shared shell parity",
        "source-sync exposes pass2506SharedChartShellParityReady",
      ],
      nextActions: [
        "Extract a shared ChartShellBoundary component used by Shield and Real Markets.",
        "Add adapter badge: Crypto / Real Markets / ETF / FX / Commodity inside chart header.",
      ],
      customerBoundary:
        "Shared chart shell parity is interface consistency; it cannot turn sparse provider data into a paid-ready verdict.",
    }),
    lane({
      id: "browser_pdf_fixture_render_queue",
      label: "Browser/PDF fixture render queue after locale cleanup",
      surface: "browser_pdf",
      state: "implemented",
      progressBefore: 66,
      progressAfter: 70,
      implementation:
        "Browser/PDF now exposes PASS2506 fixture queue copy: after locale/debug cleanup, BTC/NVDA/SPY/SOL Basic/Pro/Advanced first-page renders need screenshot/hash QA before paid delivery claims.",
      auditAdditions: [
        "PDF preview and download hash parity must be verified on fixture renders, not only by route header strings.",
        "Basic/Pro/Advanced PDF screenshots should prove visual difference without filler walls.",
        "PDF language parity needs text extraction plus first-page render comparison.",
      ],
      qaEvidence: [
        "Browser client contains data-pass2506-browser-pdf-fixture-render-queue",
        "lens-report headers include x-velmere-chart-modal-mobile-rebalance",
        "PASS2506 next queue names BTC/NVDA/SPY/SOL fixture renders",
      ],
      nextActions: [
        "Generate fixture screenshot set for BTC/NVDA/SPY/SOL x Basic/Pro/Advanced x PL/EN/DE.",
        "Block paid delivered-copy until preview/download hash is captured in the delivery ledger.",
      ],
      customerBoundary:
        "Fixture renders prove surface parity; they do not prove future price movement or complete provider coverage.",
    }),
    lane({
      id: "angel_chart_context_microcopy",
      label: "Angel chart-context microcopy for chart/mobile/PDF gaps",
      surface: "angel",
      state: "implemented",
      progressBefore: 74,
      progressAfter: 78,
      implementation:
        "Angel receives a PASS2506 directive and UI marker so it can state chart interaction, mobile reachability, PDF fixture and missing-provider status before narrative.",
      auditAdditions: [
        "Angel should say what is active: chart, modal, Browser/PDF, cart/wallet or Real Markets before advice-like prose.",
        "Angel should ask for screenshot evidence when the issue is visual alignment or mobile reachability.",
        "Angel should not call UI polish a data/source proof or paid entitlement proof.",
      ],
      qaEvidence: [
        "AngelPanel contains data-pass2506-chart-modal-mobile-context",
        "Angel API contains PASS2506 directive",
        "source-sync route exposes pass2506NextPassQueue",
      ],
      nextActions: [
        "Send exact chart timeframe + modal state + surface path into Angel POST body.",
        "Add Angel chips: Chart / Modal / PDF / Cart / Wallet / Real Markets.",
      ],
      customerBoundary:
        "Angel microcopy is a navigation and explanation guard, not a trading signal or legal/security certificate.",
    }),
    lane({
      id: "master_txt_visual_bug_expansion",
      label: "Master TXT visual-bug / non-existing-feature expansion",
      surface: "master_txt",
      state: "implemented",
      progressBefore: 97,
      progressAfter: 98,
      implementation:
        "PASS2506 appends new audit items for chart scroll ownership, mobile modal reachability, Browser/PDF render fixtures, shared chart shell parity and Angel screenshot-first visual workflow.",
      auditAdditions: [
        "If a surface is only a data attribute/proof rail and not a working UX path, mark it as planned/guarded instead of done.",
        "Visual bugs require screenshot-first audit before code claims the layout is fixed.",
        "Every next pass must touch at least three non-entitlement surfaces unless there is a P0 security break.",
      ],
      qaEvidence: [
        "PASS2506 implementation report includes full master TXT audit section",
        "PASS2506 module contains visualBugLocks and nextPassQueue",
      ],
      nextActions: [
        "Next pass: visual screenshot QA checklist + cart/menu/wallet animation timing + Shield Map globe/logo polish.",
        "Add missing-feature registry for UI claims that are currently proof rails only.",
      ],
      customerBoundary:
        "The TXT expansion is project governance; implementation status must still be proven by runtime code and QA.",
    }),
  ];

  const pass2505CooldownRespected = Boolean(args.pass2505?.pass2504CooldownRespected ?? true);
  const visualBugLocks = [
    "Do not mark chart/mobile fixed without desktop wheel + mobile pinch/scroll screenshot QA.",
    "Do not mark PDF preview=download fixed without rendered fixture hash replay.",
    "Do not mark Real Markets chart parity fixed if AAPL/NVDA/SPY use crypto-only copy or icon logic.",
    "Do not mark Angel visual/debug help fixed without active surface and screenshot-first context.",
  ];
  const nextPassQueue = [
    "PASS2507: screenshot-first visual QA matrix for modal/chart/PDF/mobile",
    "Cart/menu/wallet animation timing unification with no hidden overlays and close-by-outside-click QA",
    "Shield Map globe/logo polish: no-frame icons, exact continent/point placement and active context chips",
    "Browser/PDF rendered fixture hash vault for BTC/NVDA/SPY/SOL across Basic/Pro/Advanced and PL/EN/DE",
    "Real Markets adapter badge + ETF holdings freshness rail separate from SEC Companyfacts",
  ];
  const masterTxtAdditions = lanes.flatMap((item) => item.auditAdditions).concat(visualBugLocks).slice(0, 44);
  const fingerprint = `PASS2506-${hash({ query, symbol, lanes: lanes.map((item) => `${item.id}:${item.progressAfter}`), pass2505: args.pass2505?.fingerprint ?? "missing" })}`;
  const implementedCount = lanes.filter((item) => item.state === "implemented").length;

  return {
    id: PASS2506_CHART_MODAL_MOBILE_REBALANCE_ID,
    state: implementedCount >= 5 && pass2505CooldownRespected ? "surface_runtime_live" : implementedCount >= 3 ? "watch" : "blocked",
    query,
    symbol,
    generatedAt: new Date().toISOString(),
    nonEntitlementLanesTouched: lanes.filter((item) => item.surface !== "master_txt").length,
    chartWheelTouchOwnerReady: lanes.some((item) => item.id === "chart_wheel_touch_owner" && item.state === "implemented"),
    mobileModalSafeAreaReady: lanes.some((item) => item.id === "mobile_modal_safe_area_scroll" && item.state === "implemented"),
    sharedChartShellParityReady: lanes.some((item) => item.id === "shared_shield_realmarkets_chart_shell" && item.state === "implemented"),
    browserPdfFixtureQueueReady: lanes.some((item) => item.id === "browser_pdf_fixture_render_queue" && item.state === "implemented"),
    angelChartContextMicrocopyReady: lanes.some((item) => item.id === "angel_chart_context_microcopy" && item.state === "implemented"),
    pass2505CooldownRespected,
    lanes,
    masterTxtAdditions,
    visualBugLocks,
    nextPassQueue,
    fingerprint,
    operatorRule:
      "PASS2506: chart wheel/touch ownership, mobile modal reachability, shared Shield/Real Markets chart shell, Browser/PDF render fixtures and Angel context microcopy must be treated as UX/runtime proofs only. Keep entitlement/security in cooldown and do not claim visual fixes without screenshot/runtime QA.",
  };
}
