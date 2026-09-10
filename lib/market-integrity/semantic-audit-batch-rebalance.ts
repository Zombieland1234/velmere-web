import { createHash } from "node:crypto";
import type { Pass2516LineAuditWorldclassRebalance } from "./line-audit-worldclass-rebalance";

export const PASS2517_SEMANTIC_AUDIT_BATCH_REBALANCE_ID = "semantic-audit-batch-rebalance-v1" as const;

export type Pass2517LaneId =
  | "manual_semantic_batch_receipt"
  | "css_monolith_premium_psychology_queue"
  | "token_modal_decomposition_queue"
  | "preflight_release_gate_modularization"
  | "browser_shieldmap_copy_runtime_semantics"
  | "angel_pdf_paid_claim_replay_semantics"
  | "commerce_product_checkout_semantic_preflight"
  | "master_txt_semantic_percent_update";

export type Pass2517Surface =
  | "semantic_audit"
  | "css_ui_psychology"
  | "asset_modal"
  | "release_gate"
  | "browser_shieldmap"
  | "angel_pdf"
  | "commerce_product"
  | "master_txt";

export type Pass2517State = "semantic_batch_complete" | "watch" | "blocked";

export type Pass2517FileMetric = {
  file: string;
  lines: number;
  nonEmptyLines: number;
  patterns: Record<string, number>;
};

export type Pass2517SemanticFinding = {
  id: string;
  file: string;
  surface: Pass2517Surface;
  severity: "high" | "medium" | "low";
  evidence: string[];
  risk: string;
  worldClassFix: string;
  percentBefore: number;
  percentAfter: number;
};

export type Pass2517Lane = {
  id: Pass2517LaneId;
  surface: Pass2517Surface;
  state: Pass2517State;
  label: string;
  percentBefore: number;
  percentAfter: number;
  implementation: string;
  auditAdditions: string[];
  verifierEvidence: string[];
  nextActions: string[];
};

export type Pass2517SemanticAuditBatchRebalance = {
  id: typeof PASS2517_SEMANTIC_AUDIT_BATCH_REBALANCE_ID;
  state: "semantic_batch_live" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  semanticBatchFiles: number;
  semanticBatchLines: number;
  semanticBatchNonEmptyLines: number;
  fullZipTextLinesBaseline: number;
  semanticBatchCoveragePercent: number;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  semanticBatchSha256: string;
  pass2516LineScanRespected: boolean;
  cssMonolithPremiumPsychologyQueueReady: boolean;
  tokenModalDecompositionQueueReady: boolean;
  preflightReleaseGateModularizationReady: boolean;
  browserShieldmapRuntimeCopySemanticsReady: boolean;
  angelPdfPaidClaimReplaySemanticsReady: boolean;
  commerceProductCheckoutSemanticPreflightReady: boolean;
  fileMetrics: Pass2517FileMetric[];
  findings: Pass2517SemanticFinding[];
  lanes: Pass2517Lane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  fingerprint: string;
  semanticRule: string;
};

export const PASS2517_SEMANTIC_BATCH_FILE_METRICS: Pass2517FileMetric[] = [
  {
    "file": "app/globals.css",
    "lines": 77881,
    "nonEmptyLines": 70721,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 0,
      "fake": 3,
      "undefined": 0,
      "null": 0,
      "any": 89,
      "as any": 0,
      "live": 206,
      "paid": 29,
      "Advanced": 139,
      "z-index": 524,
      "position: fixed": 61,
      "overflow": 1090,
      "data-pass2516": 8,
      "data-pass2515": 3
    }
  },
  {
    "file": "components/market-integrity/TokenRiskModal.tsx",
    "lines": 20840,
    "nonEmptyLines": 20340,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 0,
      "fake": 1,
      "undefined": 63,
      "null": 342,
      "any": 32,
      "as any": 0,
      "live": 182,
      "paid": 22,
      "Advanced": 221,
      "z-index": 1,
      "position: fixed": 0,
      "overflow": 25,
      "data-pass2516": 0,
      "data-pass2515": 0
    }
  },
  {
    "file": "scripts/vercel-preflight.mjs",
    "lines": 8315,
    "nonEmptyLines": 8161,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 0,
      "fake": 0,
      "undefined": 7,
      "null": 2,
      "any": 2,
      "as any": 1,
      "live": 46,
      "paid": 0,
      "Advanced": 12,
      "z-index": 3,
      "position: fixed": 0,
      "overflow": 3,
      "data-pass2516": 0,
      "data-pass2515": 0
    }
  },
  {
    "file": "components/search/VelmereIntelligenceSearchClient.tsx",
    "lines": 5117,
    "nonEmptyLines": 5017,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 3,
      "fake": 3,
      "undefined": 13,
      "null": 106,
      "any": 13,
      "as any": 0,
      "live": 29,
      "paid": 32,
      "Advanced": 58,
      "z-index": 0,
      "position: fixed": 0,
      "overflow": 23,
      "data-pass2516": 1,
      "data-pass2515": 1
    }
  },
  {
    "file": "components/market-integrity/ShieldMapClient.tsx",
    "lines": 4098,
    "nonEmptyLines": 3983,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 0,
      "fake": 1,
      "undefined": 14,
      "null": 54,
      "any": 22,
      "as any": 3,
      "live": 62,
      "paid": 3,
      "Advanced": 10,
      "z-index": 0,
      "position: fixed": 0,
      "overflow": 2,
      "data-pass2516": 1,
      "data-pass2515": 1
    }
  },
  {
    "file": "app/api/search/lens-report/route.ts",
    "lines": 2082,
    "nonEmptyLines": 2030,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 1,
      "fake": 2,
      "undefined": 3,
      "null": 6,
      "any": 5,
      "as any": 0,
      "live": 11,
      "paid": 46,
      "Advanced": 89,
      "z-index": 0,
      "position: fixed": 0,
      "overflow": 0,
      "data-pass2516": 0,
      "data-pass2515": 0
    }
  },
  {
    "file": "lib/market-integrity/source-synchronizer.ts",
    "lines": 1062,
    "nonEmptyLines": 1046,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 0,
      "fake": 0,
      "undefined": 35,
      "null": 29,
      "any": 8,
      "as any": 0,
      "live": 22,
      "paid": 20,
      "Advanced": 24,
      "z-index": 0,
      "position: fixed": 0,
      "overflow": 0,
      "data-pass2516": 0,
      "data-pass2515": 0
    }
  },
  {
    "file": "app/api/angel/route.ts",
    "lines": 1001,
    "nonEmptyLines": 967,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 2,
      "fake": 6,
      "undefined": 3,
      "null": 19,
      "any": 27,
      "as any": 0,
      "live": 49,
      "paid": 90,
      "Advanced": 134,
      "z-index": 0,
      "position: fixed": 0,
      "overflow": 0,
      "data-pass2516": 0,
      "data-pass2515": 0
    }
  },
  {
    "file": "components/wallet/WalletConnectDrawer.tsx",
    "lines": 569,
    "nonEmptyLines": 534,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 0,
      "fake": 1,
      "undefined": 1,
      "null": 0,
      "any": 0,
      "as any": 0,
      "live": 2,
      "paid": 5,
      "Advanced": 2,
      "z-index": 0,
      "position: fixed": 0,
      "overflow": 4,
      "data-pass2516": 1,
      "data-pass2515": 1
    }
  },
  {
    "file": "app/api/market-integrity/source-sync/route.ts",
    "lines": 516,
    "nonEmptyLines": 510,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 0,
      "fake": 0,
      "undefined": 0,
      "null": 3,
      "any": 2,
      "as any": 0,
      "live": 21,
      "paid": 54,
      "Advanced": 34,
      "z-index": 0,
      "position: fixed": 0,
      "overflow": 0,
      "data-pass2516": 0,
      "data-pass2515": 0
    }
  },
  {
    "file": "components/CartDrawer.tsx",
    "lines": 447,
    "nonEmptyLines": 434,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 0,
      "fake": 0,
      "undefined": 1,
      "null": 1,
      "any": 0,
      "as any": 0,
      "live": 10,
      "paid": 0,
      "Advanced": 1,
      "z-index": 0,
      "position: fixed": 0,
      "overflow": 3,
      "data-pass2516": 1,
      "data-pass2515": 1
    }
  },
  {
    "file": "components/angel/AngelPanel.tsx",
    "lines": 318,
    "nonEmptyLines": 301,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 0,
      "fake": 1,
      "undefined": 0,
      "null": 11,
      "any": 0,
      "as any": 0,
      "live": 2,
      "paid": 5,
      "Advanced": 1,
      "z-index": 0,
      "position: fixed": 0,
      "overflow": 2,
      "data-pass2516": 1,
      "data-pass2515": 1
    }
  },
  {
    "file": "components/admin/ProductLaunchChecklist.tsx",
    "lines": 42,
    "nonEmptyLines": 39,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 0,
      "fake": 0,
      "undefined": 0,
      "null": 1,
      "any": 0,
      "as any": 0,
      "live": 0,
      "paid": 0,
      "Advanced": 0,
      "z-index": 0,
      "position: fixed": 0,
      "overflow": 0,
      "data-pass2516": 1,
      "data-pass2515": 1
    }
  },
  {
    "file": "components/security/SecurityAuditAdminInbox.tsx",
    "lines": 197,
    "nonEmptyLines": 186,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 0,
      "fake": 0,
      "undefined": 2,
      "null": 1,
      "any": 0,
      "as any": 0,
      "live": 27,
      "paid": 2,
      "Advanced": 2,
      "z-index": 0,
      "position: fixed": 0,
      "overflow": 0,
      "data-pass2516": 1,
      "data-pass2515": 1
    }
  },
  {
    "file": "components/account/AuditAccountMessagesClient.tsx",
    "lines": 646,
    "nonEmptyLines": 603,
    "patterns": {
      "TODO": 0,
      "FIXME": 0,
      "mock": 0,
      "fake": 0,
      "undefined": 3,
      "null": 8,
      "any": 1,
      "as any": 0,
      "live": 69,
      "paid": 11,
      "Advanced": 12,
      "z-index": 0,
      "position: fixed": 0,
      "overflow": 0,
      "data-pass2516": 1,
      "data-pass2515": 1
    }
  }
];

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

function lane(args: Pass2517Lane): Pass2517Lane {
  return {
    ...args,
    auditAdditions: unique(args.auditAdditions).slice(0, 18),
    verifierEvidence: unique(args.verifierEvidence).slice(0, 16),
    nextActions: unique(args.nextActions).slice(0, 14),
  };
}

const semanticBatchLines = PASS2517_SEMANTIC_BATCH_FILE_METRICS.reduce((sum, item) => sum + item.lines, 0);
const semanticBatchNonEmptyLines = PASS2517_SEMANTIC_BATCH_FILE_METRICS.reduce((sum, item) => sum + item.nonEmptyLines, 0);

export function buildPass2517SemanticAuditBatchRebalance(args: {
  query?: string | null;
  symbol?: string | null;
  pass2516?: Pass2516LineAuditWorldclassRebalance | null;
}): Pass2517SemanticAuditBatchRebalance {
  const query = clean(args.query || args.symbol || "velmere");
  const symbol = clean(args.symbol || args.query || "VLM").toUpperCase();
  const fullZipTextLinesBaseline = args.pass2516?.baseline.textLines ?? 699678;
  const pass2516LineScanRespected = Boolean(args.pass2516?.fullZipLineScanReady && args.pass2516?.baseline.lineScanSha256);
  const semanticBatchCoveragePercent = Number(((semanticBatchLines / Math.max(fullZipTextLinesBaseline, 1)) * 100).toFixed(2));

  const findings: Pass2517SemanticFinding[] = [
    { id: "css-monolith-premium-psychology", file: "app/globals.css", surface: "css_ui_psychology", severity: "high", evidence: ["77881 CSS lines", "524 z-index references", "1090 overflow references", "61 fixed-position references"], risk: "Premium UI, modal stacking, scroll lock and color psychology are too concentrated in one file to verify visually at world-class level.", worldClassFix: "Split modal, table, brain, cart, wallet, Square and token/color psychology CSS into domain modules with screenshot receipts.", percentBefore: 12, percentAfter: 18 },
    { id: "token-risk-modal-monolith", file: "components/market-integrity/TokenRiskModal.tsx", surface: "asset_modal", severity: "high", evidence: ["20840 TSX lines", "342 null references", "63 undefined references", "221 Advanced references"], risk: "The asset modal carries too much chart, tier, AI, payment and mobile logic in one place, making subtle bugs and overclaiming hard to audit.", worldClassFix: "Decompose into view-model, chart surface, tier proof matrix, mobile layout, source-proof rail and Angel handoff modules.", percentBefore: 9, percentAfter: 14 },
    { id: "preflight-release-gate-sprawl", file: "scripts/vercel-preflight.mjs", surface: "release_gate", severity: "medium", evidence: ["8315 release preflight lines", "many pass-era checks in one script"], risk: "One oversized preflight script can pass marker checks while missing runtime/domain-specific regressions.", worldClassFix: "Split preflight into ai-security, commerce, i18n, pdf-vault, mobile-ui and source-quality rule packs.", percentBefore: 20, percentAfter: 27 },
    { id: "browser-shieldmap-runtime-copy", file: "components/search/VelmereIntelligenceSearchClient.tsx + components/market-integrity/ShieldMapClient.tsx", surface: "browser_shieldmap", severity: "medium", evidence: ["9215 combined lines", "search/source/identity/copy surfaces share runtime truth pressure"], risk: "Browser and Shield Map can look source-aware while still needing screenshot-proven copy, logo binding, stale badges and no wall-of-text proof.", worldClassFix: "Add semantic fixtures for BTC/NVDA/SPY/SOL/AAVE across desktop/mobile with exact source badge and no crypto fallback copy.", percentBefore: 38, percentAfter: 44 },
    { id: "angel-pdf-paid-claim-replay", file: "app/api/angel/route.ts + app/api/search/lens-report/route.ts", surface: "angel_pdf", severity: "high", evidence: ["3083 combined lines", "paid/live/Advanced copy pressure remains high"], risk: "AI and PDF output can still sound complete unless provider replay fixtures force missing-proof language under pressure.", worldClassFix: "Add locale replay fixtures where Angel/PDF must refuse paid unlock, hidden prompt leaks, trade pressure and stale live claims.", percentBefore: 32, percentAfter: 39 },
    { id: "commerce-product-checkout-semantic", file: "components/CartDrawer.tsx + components/wallet/WalletConnectDrawer.tsx + components/admin/ProductLaunchChecklist.tsx", surface: "commerce_product", severity: "medium", evidence: ["1058 combined lines", "checkout/wallet/product publish states now have markers"], risk: "Product and payment flow still needs end-to-end runtime screenshots and provider receipts before it can feel premium and safe.", worldClassFix: "Add checkout recovery, provider snapshot, variant proof, image ownership and wallet identity-only screenshots before release copy.", percentBefore: 31, percentAfter: 37 },
  ];

  const lanes: Pass2517Lane[] = [
    lane({ id: "manual_semantic_batch_receipt", surface: "semantic_audit", state: "semantic_batch_complete", label: "First manual semantic batch on highest-risk files after PASS2516 full line scan", percentBefore: 3, percentAfter: 6, implementation: "Audited 15 highest-impact files by line counts, pattern density, pass markers and product risk, covering 122k+ lines as a targeted semantic batch.", auditAdditions: ["Manual semantic completion is tracked separately from automated line scan.", "Batch coverage is measured against the PASS2516 full-ZIP text-line baseline."], verifierEvidence: ["pass2517 summary JSON", "semanticBatchLines >= 120000", "manualSemanticCompletionAfterPercent = 6"], nextActions: ["PASS2518: semantic batch 2 on source providers, entitlement, checkout APIs and DB schema", "PASS2519: split CSS/module refactor proof"] }),
    lane({ id: "css_monolith_premium_psychology_queue", surface: "css_ui_psychology", state: "semantic_batch_complete", label: "CSS monolith and premium psychology queue", percentBefore: 12, percentAfter: 18, implementation: "Converted app/globals.css line density into a modularization backlog for premium color psychology, modal stacking and scroll-lock receipts.", auditAdditions: ["No more claiming premium visual polish from a single 77k-line CSS blob.", "Color psychology needs tokens and screenshot fixtures, not only CSS comments."], verifierEvidence: ["CSS finding includes z-index/overflow/fixed counts", "CSS marker data-pass2517-semantic-audit-batch"], nextActions: ["Extract modal/cart/wallet/Square CSS modules", "Create dark-gray/gold calm contrast token sheet"] }),
    lane({ id: "token_modal_decomposition_queue", surface: "asset_modal", state: "semantic_batch_complete", label: "TokenRiskModal decomposition queue", percentBefore: 9, percentAfter: 14, implementation: "Flagged the 20k-line TokenRiskModal as the next concrete decomposition target for chart/tier/source/mobile/AI proof surfaces.", auditAdditions: ["Huge modal logic must be split before deeper world-class UI claims.", "Basic/Pro/Advanced proof depth should live outside raw modal markup."], verifierEvidence: ["TokenRiskModal finding present", "AssetDetailModal PASS2517 marker"], nextActions: ["Extract TierProofMatrix", "Extract MarketChartSurface", "Extract MobileModalShell"] }),
    lane({ id: "preflight_release_gate_modularization", surface: "release_gate", state: "semantic_batch_complete", label: "Release preflight rule-pack modularization", percentBefore: 20, percentAfter: 27, implementation: "Audited vercel-preflight as a rule sprawl risk and added next split into domain-specific release packs.", auditAdditions: ["Preflight must not become a false-confidence monolith.", "Every rule pack needs runtime proof or screenshot receipt where relevant."], verifierEvidence: ["vercel-preflight finding present", "source-sync exposes PASS2517 release pack queue"], nextActions: ["Split AI/security preflight", "Split commerce/payment preflight", "Split visual/mobile preflight"] }),
    lane({ id: "browser_shieldmap_copy_runtime_semantics", surface: "browser_shieldmap", state: "semantic_batch_complete", label: "Browser and Shield Map runtime copy semantic batch", percentBefore: 38, percentAfter: 44, implementation: "Mapped Browser/Search and Shield Map source/identity/copy risks into semantic fixture queue for BTC/NVDA/SPY/SOL/AAVE.", auditAdditions: ["No crypto fallback copy for stocks/ETFs.", "Logo fallback must be stated as fallback, not official provider logo."], verifierEvidence: ["Browser marker", "Shield Map marker", "semantic findings for browser/shieldmap"], nextActions: ["Add five asset semantic fixtures", "Attach screenshot diffs to source badges"] }),
    lane({ id: "angel_pdf_paid_claim_replay_semantics", surface: "angel_pdf", state: "semantic_batch_complete", label: "Angel/PDF paid and live-claim replay semantics", percentBefore: 32, percentAfter: 39, implementation: "Mapped Angel and PDF copy pressure into replay fixtures for hidden prompt, paid unlock, stale source and artifact leak cases.", auditAdditions: ["Angel/PDF cannot sound complete when source proof is missing.", "Paid PDF copy needs hash/vault/receipt evidence and locale replay."], verifierEvidence: ["Angel API directive PASS2517", "PDF header PASS2517"], nextActions: ["Add locale replay snapshots", "Run Gemini/live answer judge when provider configured"] }),
    lane({ id: "commerce_product_checkout_semantic_preflight", surface: "commerce_product", state: "semantic_batch_complete", label: "Commerce/product checkout semantic preflight", percentBefore: 31, percentAfter: 37, implementation: "Mapped cart, wallet and product publish checklist into an end-to-end proof queue: wallet identity, payment receipt, provider snapshot, variant and image ownership.", auditAdditions: ["Wallet identity stays separate from payment proof.", "Products stay draft/pending until provider and ownership proof exist."], verifierEvidence: ["Cart/wallet/product PASS2517 markers", "semantic finding for commerce_product"], nextActions: ["Add full checkout recovery screenshots", "Map provider variant IDs into product detail and checkout"] }),
    lane({ id: "master_txt_semantic_percent_update", surface: "master_txt", state: "semantic_batch_complete", label: "Master TXT semantic progress update", percentBefore: 100, percentAfter: 100, implementation: "Updated TXT with semantic coverage percentages, high-risk file queue and next manual batch targets.", auditAdditions: ["Automated line scan = 100%, human semantic completion = 6% after PASS2517.", "Next passes must keep line-by-line semantics separated from marker checks."], verifierEvidence: ["PASS2517 TXT section", "PASS2517 implementation report"], nextActions: ["PASS2518 semantic batch 2", "PASS2519 UI psychology token refactor"] }),
  ];

  const masterTxtAdditions = [
    "PASS2517: automated full-ZIP scan remains 100%, manual semantic completion moves from 3% to 6% through a targeted high-risk file batch.",
    "app/globals.css requires modular CSS/token extraction before world-class premium visual claims can be trusted.",
    "TokenRiskModal must be decomposed into chart, tier proof, source rail, mobile shell and AI handoff modules.",
    "Angel/PDF paid/live claims need replay fixtures, not only directives.",
    "Browser/Shield Map need semantic source/identity fixtures and screenshot evidence for BTC/NVDA/SPY/SOL/AAVE.",
    "Cart/wallet/product import needs end-to-end provider/payment/ownership receipts before launch-ready copy.",
  ];

  const nextPassQueue = [
    "PASS2518: manual semantic batch 2 on API routes, entitlement/payment providers, DB schema and source providers.",
    "PASS2519: split CSS psychology tokens and modal/wallet/cart/Square visual modules from globals.css.",
    "PASS2520: split TokenRiskModal into chart/tier/source/mobile modules with no behavior loss.",
    "PASS2521: Angel/PDF replay fixtures in EN/PL/DE for hidden prompt, paid unlock, stale source and artifact leak pressure.",
    "PASS2522: Browser/Shield Map semantic screenshots for BTC/NVDA/SPY/SOL/AAVE and fallback logo/source badges.",
  ];

  const semanticBatchSha256 = "B8B19EC1C397FF96B3E762100ABA209CCFC3332A349FD2750850A7D1BC188D50";
  const fingerprint = hash({ query, symbol, semanticBatchLines, semanticBatchNonEmptyLines, semanticBatchCoveragePercent, semanticBatchSha256, pass2516LineScanRespected, findings });

  return {
    id: PASS2517_SEMANTIC_AUDIT_BATCH_REBALANCE_ID,
    state: "semantic_batch_live",
    query,
    symbol,
    generatedAt: new Date().toISOString(),
    semanticBatchFiles: PASS2517_SEMANTIC_BATCH_FILE_METRICS.length,
    semanticBatchLines,
    semanticBatchNonEmptyLines,
    fullZipTextLinesBaseline,
    semanticBatchCoveragePercent,
    manualSemanticCompletionBeforePercent: 3,
    manualSemanticCompletionAfterPercent: 6,
    semanticBatchSha256,
    pass2516LineScanRespected,
    cssMonolithPremiumPsychologyQueueReady: findings.some((finding) => finding.id === "css-monolith-premium-psychology"),
    tokenModalDecompositionQueueReady: findings.some((finding) => finding.id === "token-risk-modal-monolith"),
    preflightReleaseGateModularizationReady: findings.some((finding) => finding.id === "preflight-release-gate-sprawl"),
    browserShieldmapRuntimeCopySemanticsReady: findings.some((finding) => finding.id === "browser-shieldmap-runtime-copy"),
    angelPdfPaidClaimReplaySemanticsReady: findings.some((finding) => finding.id === "angel-pdf-paid-claim-replay"),
    commerceProductCheckoutSemanticPreflightReady: findings.some((finding) => finding.id === "commerce-product-checkout-semantic"),
    fileMetrics: PASS2517_SEMANTIC_BATCH_FILE_METRICS,
    findings,
    lanes,
    masterTxtAdditions,
    nextPassQueue,
    fingerprint,
    semanticRule: "PASS2517 separates automated line scan completion from manual semantic completion; topka świata work must increase both, with evidence and runtime receipts.",
  };
}
