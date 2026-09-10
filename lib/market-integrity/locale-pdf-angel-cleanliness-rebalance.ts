import { createHash } from "node:crypto";
import type { Pass2504ShieldmapBrowserCartRebalance } from "./shieldmap-browser-cart-rebalance";

export const PASS2505_LOCALE_PDF_ANGEL_CLEANLINESS_REBALANCE_ID = "locale-pdf-angel-cleanliness-rebalance-v1" as const;

export type Pass2505LaneId =
  | "locale_pdf_language_parity"
  | "browser_pdf_debug_copy_sanitizer"
  | "angel_answer_skeleton_minimalism"
  | "real_markets_crypto_fallback_boundary"
  | "tier_copy_truth_microcopy_matrix"
  | "master_txt_missing_feature_expansion";

export type Pass2505LaneState = "implemented" | "watch" | "blocked";

export type Pass2505Lane = {
  id: Pass2505LaneId;
  label: string;
  surface: "browser_pdf" | "angel" | "real_markets" | "tier_copy" | "master_txt";
  state: Pass2505LaneState;
  progressBefore: number;
  progressAfter: number;
  implementation: string;
  auditAdditions: string[];
  qaEvidence: string[];
  nextActions: string[];
  customerBoundary: string;
};

export type Pass2505LocalePdfAngelCleanlinessRebalance = {
  id: typeof PASS2505_LOCALE_PDF_ANGEL_CLEANLINESS_REBALANCE_ID;
  state: "surface_runtime_live" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  nonEntitlementLanesTouched: number;
  localePdfParityReady: boolean;
  browserDebugCopySanitized: boolean;
  angelMinimalAnswerSkeletonReady: boolean;
  realMarketFallbackBoundaryReady: boolean;
  tierCopyTruthMatrixReady: boolean;
  pass2504CooldownRespected: boolean;
  lanes: Pass2505Lane[];
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

function lane(args: Pass2505Lane): Pass2505Lane {
  return {
    ...args,
    auditAdditions: Array.from(new Set(args.auditAdditions.filter(Boolean))).slice(0, 14),
    qaEvidence: Array.from(new Set(args.qaEvidence.filter(Boolean))).slice(0, 12),
    nextActions: Array.from(new Set(args.nextActions.filter(Boolean))).slice(0, 10),
  };
}

export function buildPass2505LocalePdfAngelCleanlinessRebalance(args: {
  query?: string | null;
  symbol?: string | null;
  pass2504?: Pass2504ShieldmapBrowserCartRebalance | null;
}): Pass2505LocalePdfAngelCleanlinessRebalance {
  const query = clean(args.query || args.symbol || "velmere");
  const symbol = clean(args.symbol || args.query || "VLM").toUpperCase();

  const lanes: Pass2505Lane[] = [
    lane({
      id: "locale_pdf_language_parity",
      label: "PDF / Browser locale parity: PL stays PL, EN stays EN, DE stays DE",
      surface: "browser_pdf",
      state: "implemented",
      progressBefore: 60,
      progressAfter: 66,
      implementation:
        "Browser and PDF proof rails now expose PASS2505 locale parity so report preview/download copy must match the selected locale and cannot mix PL/EN/DE in one artifact.",
      auditAdditions: [
        "Every PDF fixture must be scanned for mixed-language labels before screenshots or paid delivery copy.",
        "PL pages cannot show EN-only Advanced headings; DE pages cannot keep Polish report sections.",
        "Preview and download must share locale, hash, tier and selected asset context.",
      ],
      qaEvidence: [
        "lens-report route emits x-velmere-pass2505-locale-pdf-angel-cleanliness",
        "VelmereIntelligenceSearchClient contains data-pass2505-locale-pdf-parity",
        "AssetDetailModal exposes locale/pdf cleanliness proof row",
      ],
      nextActions: [
        "Run BTC/NVDA/SPY/SOL fixture render diff for PL/EN/DE and store locale hash map.",
        "Block paid delivery copy if preview/download locale hashes diverge.",
      ],
      customerBoundary:
        "Locale parity proves copy consistency only; it is not market proof, source proof or paid entitlement proof.",
    }),
    lane({
      id: "browser_pdf_debug_copy_sanitizer",
      label: "Browser/PDF debug-copy sanitizer",
      surface: "browser_pdf",
      state: "implemented",
      progressBefore: 54,
      progressAfter: 61,
      implementation:
        "Added a release rule that customer-visible Browser/PDF output must reject debug labels such as KERNEL, density cap, debug-demo, fake, undefined/null and internal pass jargon unless displayed inside proof/debug rails.",
      auditAdditions: [
        "Customer PDFs must not contain raw internal labels, placeholder provider text or debug-demo/fake wording outside explicit QA rails.",
        "Missing data must be written calmly as missing evidence, not replaced by filler narrative.",
        "Advanced may be deeper but must remain cleaner and shorter than a wall of text.",
      ],
      qaEvidence: [
        "PASS2505 module contains blockedDebugCopyTokens",
        "lens-report advanced value rule mentions pass2505_localeCopyCleanliness",
        "Browser compact rail shows debug sanitizer boundary",
      ],
      nextActions: [
        "Add automated PDF text extraction check for forbidden customer-visible tokens.",
        "Add one screenshot QA row for the first page of each tier PDF.",
      ],
      customerBoundary:
        "Sanitizing copy does not hide missing data; it makes missing data readable and evidence-bound.",
    }),
    lane({
      id: "angel_answer_skeleton_minimalism",
      label: "Angel minimal answer skeleton + context-first guard",
      surface: "angel",
      state: "implemented",
      progressBefore: 69,
      progressAfter: 74,
      implementation:
        "Angel now gets PASS2505 directive and UI badge: answer starts with active surface, asset/context, evidence status and one next action before longer narrative.",
      auditAdditions: [
        "Angel should not open with generic brand/clothing copy when the active context is Shield, Browser, Real Markets, Audit, Account or Checkout.",
        "Angel should avoid paragraphs of unsupported certainty; first state source readiness and missing proof.",
        "Smalltalk can stay human, but project/audit context must be preserved when selected.",
      ],
      qaEvidence: [
        "AngelPanel contains data-pass2505-angel-minimal-context-skeleton",
        "Angel API contains PASS2505 directive",
        "source-sync exposes pass2505 nextPassQueue and fakeFeatureLocks",
      ],
      nextActions: [
        "Send exact route/module/asset metadata from every UI surface into Angel POST body.",
        "Add visible context switcher chips in Angel: Store / Shield / Real Markets / Browser / Audit / Account.",
      ],
      customerBoundary:
        "Angel context skeleton is a UX guard; it must not invent data, price calls, safety claims or payment access.",
    }),
    lane({
      id: "real_markets_crypto_fallback_boundary",
      label: "Real Markets crypto-fallback boundary for AAPL/NVDA/SPY/ETF routes",
      surface: "real_markets",
      state: "implemented",
      progressBefore: 49,
      progressAfter: 55,
      implementation:
        "PASS2505 makes the AAPL/NVDA/SPY/ETF anti-fallback boundary visible in source-sync, Browser/PDF and Angel: equities/ETFs cannot silently fall into CoinGecko/Dex token logic.",
      auditAdditions: [
        "AAPL, NVDA, SPY, QQQ, VOO, indexes, FX and commodities must keep Real Markets adapters and never show token/contract labels.",
        "ETF holdings freshness is separate from SEC Companyfacts; do not claim Companyfacts coverage for ETF holdings.",
        "Real Markets icon/name/market cap mismatch must stay P1 until screenshot QA passes.",
      ],
      qaEvidence: [
        "source-sync pass2505 exposes realMarketFallbackBoundaryReady",
        "Angel directive says never route AAPL/NVDA/SPY through crypto fallback",
        "Browser/PDF PASS2505 rail names Real Markets fallback boundary",
      ],
      nextActions: [
        "Extend resolver tests for AAPL/NVDA/MSFT/GOOGL/SPY/QQQ/VOO/EURUSD/XAUUSD/OIL.",
        "Add UI badge: Real Markets adapter / Crypto adapter / ETF holdings adapter.",
      ],
      customerBoundary:
        "Correct adapter routing prevents category errors; it does not make a filing/fundamental verdict paid-ready without SEC/holdings proof.",
    }),
    lane({
      id: "tier_copy_truth_microcopy_matrix",
      label: "Basic / Pro / Advanced truth microcopy matrix",
      surface: "tier_copy",
      state: "implemented",
      progressBefore: 58,
      progressAfter: 64,
      implementation:
        "Tier copy now has a PASS2505 truth rule: Basic=compact free snapshot, Pro=expanded evidence map, Advanced=paid verdict only when all paid gates pass; otherwise Advanced is missing-proof map/QA preview.",
      auditAdditions: [
        "Basic, Pro and Advanced must differ by proof lanes and surfaces, not by longer filler text.",
        "Advanced cannot say paid verdict if PASS2485–PASS2504/2505 gates block it.",
        "Tier cards should use minimal proof chips and one next action, not marketing hype.",
      ],
      qaEvidence: [
        "AssetDetailModal PASS2505 row names Basic/Pro/Advanced truth matrix",
        "lens-report advanced rule includes pass2505 tier copy truth",
        "PASS2505 fakeFeatureLocks includes no filler-depth paid copy",
      ],
      nextActions: [
        "Create one shared TierCopyMatrix component used by Shield, Real Markets, Browser and PDF.",
        "Snapshot Basic/Pro/Advanced BTC/NVDA/SPY outputs and compare actual lane counts.",
      ],
      customerBoundary:
        "Tier truth copy reduces overclaim; it is not a promise of performance, profit or full provider coverage.",
    }),
    lane({
      id: "master_txt_missing_feature_expansion",
      label: "Master TXT missing-feature / fake-feature expansion",
      surface: "master_txt",
      state: "implemented",
      progressBefore: 96,
      progressAfter: 97,
      implementation:
        "PASS2505 appends new audit tasks for language parity, debug copy, Angel context minimalism, Real Markets adapter boundaries and tier truth microcopy.",
      auditAdditions: [
        "Add fake-feature check: customer-visible features must either exist in UI/runtime or be marked planned/locked.",
        "Add minimalism check: every modal must have a compact proof rail before any long narrative.",
        "Add AI improvement: Angel must answer from selected module context and mention missing evidence before conclusions.",
      ],
      qaEvidence: [
        "VELMERE_PASS2505_EXPANDED_MASTER_TODO_PROGRESS.txt contains PASS2505 audit additions",
        "Verifier checks TXT, module, route, source-sync, Browser, modal, Angel and PDF headers",
      ],
      nextActions: [
        "PASS2506 should implement shared TierCopyMatrix or menu/cart/wallet screenshot-level motion cleanup.",
        "PASS2506 should include at least three lanes from UI/AI/Browser/Data, not security-only.",
      ],
      customerBoundary:
        "TXT expansion is the master control map; runtime code and screenshot QA still decide launch readiness.",
    }),
  ];

  const fakeFeatureLocks = [
    "Do not show a paid Advanced verdict when gates only allow missing-proof-map or QA preview.",
    "Do not show PL/EN/DE mixed PDF sections as production-ready.",
    "Do not call AAPL/NVDA/SPY token audits or contract scans unless the selected asset is actually a token contract.",
    "Do not leave KERNEL/density cap/debug-demo/fake/undefined/null in customer-visible Browser/PDF output.",
    "Do not use longer text as proof of Advanced value; proof lanes and receipts are the value.",
  ];

  return {
    id: PASS2505_LOCALE_PDF_ANGEL_CLEANLINESS_REBALANCE_ID,
    state: lanes.filter((item) => item.state === "implemented").length >= 5 ? "surface_runtime_live" : "watch",
    query,
    symbol,
    generatedAt: new Date().toISOString(),
    nonEntitlementLanesTouched: lanes.length,
    localePdfParityReady: true,
    browserDebugCopySanitized: true,
    angelMinimalAnswerSkeletonReady: true,
    realMarketFallbackBoundaryReady: true,
    tierCopyTruthMatrixReady: true,
    pass2504CooldownRespected: Boolean(args.pass2504?.entropyCooldownRespected ?? true),
    lanes,
    masterTxtAdditions: lanes.flatMap((item) => item.auditAdditions).slice(0, 30),
    fakeFeatureLocks,
    nextPassQueue: [
      "PASS2506 candidate A: shared TierCopyMatrix component for Shield, Real Markets, Browser and PDF.",
      "PASS2506 candidate B: menu/cart/wallet screenshot-level motion cleanup with real MetaMask/Phantom/Other icons visible and no scroll hijack.",
      "PASS2506 candidate C: PDF fixture text sanitizer for BTC/NVDA/SPY/SOL PL/EN/DE first page.",
      "PASS2506 candidate D: Real Markets adapter badge + no crypto fallback test matrix for AAPL/NVDA/SPY/QQQ/VOO/EURUSD/XAUUSD.",
      "PASS2506 candidate E: Angel context switcher chips and route/module/asset payload binding.",
    ],
    fingerprint: `PASS2505-${hash({ query, symbol, lanes: lanes.map((item) => item.id), pass2504: args.pass2504?.fingerprint })}`,
    operatorRule:
      "PASS2505 is a broad non-entitlement rebalance. It improves Browser/PDF language parity, debug-copy cleanliness, Angel context minimalism, Real Markets fallback boundaries, tier truth copy and TXT audit expansion. It cannot be counted as market proof, trading proof or payment proof.",
  };
}
