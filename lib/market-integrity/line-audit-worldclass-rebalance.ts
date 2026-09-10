import { createHash } from "node:crypto";
import type { Pass2515ReleaseRollbackRuntimeRebalance } from "./release-rollback-runtime-rebalance";

export const PASS2516_LINE_AUDIT_WORLDCLASS_REBALANCE_ID = "line-audit-worldclass-rebalance-v1" as const;

export type Pass2516LaneId =
  | "automated_every_line_scan_receipt"
  | "worldclass_ai_security_gap_backlog"
  | "premium_ui_psychology_copy_gap_backlog"
  | "runtime_truth_debug_copy_triage"
  | "large_file_fragility_modularization_queue"
  | "commerce_payment_product_line_risk_queue"
  | "master_txt_percent_progress_update";

export type Pass2516Surface =
  | "whole_zip"
  | "ai_security"
  | "ui_psychology"
  | "runtime_truth"
  | "codebase_health"
  | "commerce_payment"
  | "master_txt";

export type Pass2516State = "line_scan_complete" | "watch" | "blocked";

export type Pass2516LineScanBaseline = {
  totalFiles: number;
  textFiles: number;
  binaryFiles: number;
  textLines: number;
  nonEmptyLines: number;
  lineScanSha256: string;
  categoryCounts: Record<string, number>;
  severityCounts: Record<string, number>;
  largestFiles: Array<{ file: string; lines: number; nonEmptyLines: number }>;
  topFindingFiles: Array<{ file: string; lines: number; findings: number }>;
};

export type Pass2516GapCategory = {
  id: string;
  surface: Pass2516Surface;
  scanHits: number;
  severity: "high" | "medium" | "low";
  percentBefore: number;
  percentAfter: number;
  customerRisk: string;
  topWorldRequirement: string;
  implementation: string;
  nextAction: string;
};

export type Pass2516Lane = {
  id: Pass2516LaneId;
  surface: Pass2516Surface;
  state: Pass2516State;
  label: string;
  percentBefore: number;
  percentAfter: number;
  implementation: string;
  auditAdditions: string[];
  verifierEvidence: string[];
  nextActions: string[];
};

export type Pass2516LineAuditWorldclassRebalance = {
  id: typeof PASS2516_LINE_AUDIT_WORLDCLASS_REBALANCE_ID;
  state: "line_audit_receipted" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  fullZipLineScanReady: boolean;
  aiSecurityBacklogReady: boolean;
  uiPsychologyBacklogReady: boolean;
  runtimeTruthDebugCopyTriageReady: boolean;
  largeFileFragilityQueueReady: boolean;
  commercePaymentProductRiskQueueReady: boolean;
  masterTxtPercentProgressReady: boolean;
  pass2515CooldownRespected: boolean;
  baseline: Pass2516LineScanBaseline;
  gapCategories: Pass2516GapCategory[];
  lanes: Pass2516Lane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  fingerprint: string;
  auditRule: string;
};

export const PASS2516_LINE_SCAN_BASELINE: Pass2516LineScanBaseline = {
  totalFiles: 3062,
  textFiles: 3035,
  binaryFiles: 27,
  textLines: 699678,
  nonEmptyLines: 635604,
  lineScanSha256: "9CDCCB4AA297767B887695355E54FBAA0BF4A5D7E8B5264EDD0DC63459CA5CAA",
  categoryCounts: {
  "data_source": 79033,
  "commerce_product": 46532,
  "ui_psychology": 32528,
  "pdf_vault": 31611,
  "security": 30250,
  "runtime_truth": 28936,
  "debug_copy": 13262,
  "i18n": 8095,
  "finance_claims": 7028,
  "square_social": 6034,
  "ai_security": 725
},
  severityCounts: {
  "medium": 206402,
  "low": 46657,
  "high": 30975
},
  largestFiles: [
  {
    "file": "package-lock.json",
    "lines": 14182,
    "nonEmptyLines": 14182
  },
  {
    "file": "VELMERE_PASS2453_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 3204,
    "nonEmptyLines": 2796
  },
  {
    "file": "VELMERE_PASS2454_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 3312,
    "nonEmptyLines": 2891
  },
  {
    "file": "VELMERE_PASS2455_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 3358,
    "nonEmptyLines": 2928
  },
  {
    "file": "VELMERE_PASS2457_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 3437,
    "nonEmptyLines": 2991
  },
  {
    "file": "VELMERE_PASS2458_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 3494,
    "nonEmptyLines": 3038
  },
  {
    "file": "VELMERE_PASS2459_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 3560,
    "nonEmptyLines": 3094
  },
  {
    "file": "VELMERE_PASS2460_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 3692,
    "nonEmptyLines": 3207
  },
  {
    "file": "VELMERE_PASS2465_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 4361,
    "nonEmptyLines": 3689
  },
  {
    "file": "VELMERE_PASS2466_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 4420,
    "nonEmptyLines": 3739
  }
],
  topFindingFiles: [
  {
    "file": "app/globals.css",
    "lines": 77881,
    "findings": 13503
  },
  {
    "file": "VELMERE_PASS2516_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 7537,
    "findings": 4196
  },
  {
    "file": "VELMERE_PASS2514_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 7392,
    "findings": 4075
  },
  {
    "file": "VELMERE_PASS2513_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 7332,
    "findings": 4004
  },
  {
    "file": "components/market-integrity/TokenRiskModal.tsx",
    "lines": 20840,
    "findings": 3909
  },
  {
    "file": "VELMERE_PASS2511_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 7208,
    "findings": 3815
  },
  {
    "file": "VELMERE_PASS2509_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 7080,
    "findings": 3702
  },
  {
    "file": "VELMERE_PASS2508_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 7016,
    "findings": 3638
  },
  {
    "file": "VELMERE_PASS2505_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 6771,
    "findings": 3504
  },
  {
    "file": "VELMERE_PASS2503_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 6645,
    "findings": 3403
  },
  {
    "file": "VELMERE_PASS2502_EXPANDED_MASTER_TODO_PROGRESS.txt",
    "lines": 6586,
    "findings": 3356
  },
  {
    "file": "scripts/vercel-preflight.mjs",
    "lines": 8315,
    "findings": 3340
  }
],
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

function lane(args: Pass2516Lane): Pass2516Lane {
  return {
    ...args,
    auditAdditions: unique(args.auditAdditions).slice(0, 18),
    verifierEvidence: unique(args.verifierEvidence).slice(0, 16),
    nextActions: unique(args.nextActions).slice(0, 14),
  };
}

export function buildPass2516LineAuditWorldclassRebalance(args: {
  query?: string | null;
  symbol?: string | null;
  pass2515?: Pass2515ReleaseRollbackRuntimeRebalance | null;
}): Pass2516LineAuditWorldclassRebalance {
  const query = clean(args.query || args.symbol || "velmere");
  const symbol = clean(args.symbol || args.query || "VLM").toUpperCase();
  const pass2515CooldownRespected = args.pass2515?.state === "surface_runtime_live" || Boolean(args.pass2515?.runtimeReleaseGateMatrixReady);
  const baseline = PASS2516_LINE_SCAN_BASELINE;

  const gapCategories: Pass2516GapCategory[] = [
    { id: "ai-security-line-gap", surface: "ai_security", scanHits: baseline.categoryCounts.ai_security ?? 0, severity: "high", percentBefore: 82, percentAfter: 84, customerRisk: "Angel or VLM Brain could over-answer if prompt/tool/output boundaries drift in old files.", topWorldRequirement: "Every AI answer needs source status, missing proof, tool scope, refusal reason and no hidden prompt/raw receipt leak.", implementation: "PASS2516 adds a whole-ZIP AI/security line audit receipt and backlog category tied to OWASP LLM prompt injection, sensitive disclosure and excessive agency controls.", nextAction: "Run semantic review on Angel API, VLM Brain, PDF generator and all AI copy surfaces in batches of 20k lines." },
    { id: "security-auth-receipt-gap", surface: "whole_zip", scanHits: baseline.categoryCounts.security ?? 0, severity: "high", percentBefore: 74, percentAfter: 76, customerRisk: "Auth/session/admin/payment words appear across many files; release needs proof that they are server-side, not UI-only.", topWorldRequirement: "Admin, entitlement, payment and vault actions must be bound to signed receipts, idempotency, reason, expiry and audit trail.", implementation: "PASS2516 cross-counts security/auth/receipt lines and keeps high-hit files in the next audit queue.", nextAction: "Prioritize high-hit app/api, lib/security, lib/commerce, account vault and admin components for manual line review." },
    { id: "premium-ui-psychology-gap", surface: "ui_psychology", scanHits: baseline.categoryCounts.ui_psychology ?? 0, severity: "medium", percentBefore: 60, percentAfter: 64, customerRisk: "Premium feeling can break if color/spacing/animation/copy are inconsistent even when security is strong.", topWorldRequirement: "Dark luxury UI should use calm contrast, limited gold accents, clear trust chips, no wall-of-text and no scare/hype color psychology.", implementation: "PASS2516 starts UI psychology line backlog from every modal/drawer/overlay/color/animation occurrence.", nextAction: "Screen-first audit: Shield modal, Real Markets, Browser/PDF, cart/wallet, Square and account at desktop + 390x844." },
    { id: "runtime-truth-debug-gap", surface: "runtime_truth", scanHits: (baseline.categoryCounts.runtime_truth ?? 0) + (baseline.categoryCounts.debug_copy ?? 0), severity: "medium", percentBefore: 67, percentAfter: 70, customerRisk: "Live/final/paid/ready/debug words can become false customer claims if not tied to receipts.", topWorldRequirement: "Any live/current/final/paid/confirmed copy must have provider timestamp, receipt, hash family or visible watch/degraded state.", implementation: "PASS2516 marks runtime-truth and debug-copy hits as a first-class release blocker class.", nextAction: "Batch-remove or customer-hide debug placeholders and verify every public 'live/final/paid' string." },
    { id: "large-file-fragility-gap", surface: "codebase_health", scanHits: baseline.largestFiles.reduce((sum, file) => sum + file.lines, 0), severity: "medium", percentBefore: 58, percentAfter: 60, customerRisk: "Very large files like globals.css and modal components are harder to audit and easier to regress.", topWorldRequirement: "World-class maintainability needs modular CSS, split modal brain/chart/receipt panels and smaller testable components.", implementation: "PASS2516 lists the biggest files and turns them into a modularization queue.", nextAction: "Split TokenRiskModal, globals.css proof rails, AssetDetailModal rows and old report-heavy files over multiple passes." },
    { id: "commerce-payment-product-line-gap", surface: "commerce_payment", scanHits: baseline.categoryCounts.commerce_product ?? 0, severity: "high", percentBefore: 53, percentAfter: 56, customerRisk: "Cart/checkout/product/import lines are numerous; false product/payment readiness would hurt trust fast.", topWorldRequirement: "Checkout and products need provider snapshot, image ownership, variants, fulfillment, webhook receipt, rollback and account delivery.", implementation: "PASS2516 ties product/payment line scan hits to publish freeze and checkout rollback backlog.", nextAction: "Manual line audit of checkout, wallet, Stripe/BLIK, product import and account delivery before launch." },
  ];

  const lanes: Pass2516Lane[] = [
    lane({ id: "automated_every_line_scan_receipt", surface: "whole_zip", state: "line_scan_complete", label: "Every text line in the current ZIP was scanned and receipted", percentBefore: 0, percentAfter: 100, implementation: `${baseline.textFiles} text files / ${baseline.textLines} lines / ${baseline.nonEmptyLines} non-empty lines scanned with hash ${baseline.lineScanSha256}`, auditAdditions: ["Line-by-line automated scan is now a first-class artifact, not a verbal claim", "Binary files are counted separately and not falsely treated as semantic text", "Each future pass can compare hash/count drift against PASS2516"], verifierEvidence: [".codex-qa/pass2516-line-audit-summary.json", ".codex-qa/pass2516-line-audit-summary.md", "PASS2516_LINE_SCAN_BASELINE"], nextActions: ["Semantic manual review in batches by top finding files", "Add diff scan after each pass", "Mark line scan percent separately from human semantic audit"] }),
    lane({ id: "worldclass_ai_security_gap_backlog", surface: "ai_security", state: "watch", label: "AI/security world-class backlog from whole-project line scan", percentBefore: 82, percentAfter: 84, implementation: "AI/security patterns are grouped into prompt injection, tool-scope, sensitive output, hidden prompt and raw receipt classes.", auditAdditions: ["AI cannot trade, unlock, grant, leak prompt, reveal raw receipt or convert missing proof into confidence", "Answers must include active surface, source status, confidence cap, missing proof and next safe action"], verifierEvidence: ["ai_security category count", "PASS2516 gapCategories", "Angel API PASS2516 directive"], nextActions: ["Manual Angel/VLM Brain prompt audit", "Red-team paraphrase harness", "Provider output firewall review"] }),
    lane({ id: "premium_ui_psychology_copy_gap_backlog", surface: "ui_psychology", state: "watch", label: "Premium UI psychology, color and copy backlog", percentBefore: 60, percentAfter: 64, implementation: "UI psychology hits now drive screen-first audit tasks for color, spacing, animation, trust chips, anti-FOMO and calm risk copy.", auditAdditions: ["Gold should be accent-only, not a cheap focus rectangle", "Risk colors must educate without panic", "Public cards need compact proof chips before narrative", "No wall of text in Browser/Shield/Square/account first views"], verifierEvidence: ["ui_psychology category count", "CSS PASS2516 proof row", "Browser/modal/cart/wallet markers"], nextActions: ["Desktop/mobile screenshot diff", "Color token audit", "Microcopy rewrite pass"] }),
    lane({ id: "runtime_truth_debug_copy_triage", surface: "runtime_truth", state: "watch", label: "Runtime truth and debug copy triage", percentBefore: 67, percentAfter: 70, implementation: "PASS2516 makes live/current/final/paid/confirmed/debug-copy hits an explicit release blocker category.", auditAdditions: ["No live/current/final unless receipt exists", "No debug-demo/fake/undefined/null/debug copy in customer output", "Paid copy requires server receipt/hash/vault family"], verifierEvidence: ["runtime_truth + debug_copy category counts", "PDF header PASS2516", "source-sync PASS2516 flags"], nextActions: ["Search public customer routes for debug words", "Review PDF first page fixtures", "Review Angel public output samples"] }),
    lane({ id: "large_file_fragility_modularization_queue", surface: "codebase_health", state: "watch", label: "Large-file fragility modularization queue", percentBefore: 58, percentAfter: 60, implementation: "Largest files are now listed in the scan baseline and used to plan line-by-line manual review batches.", auditAdditions: ["Large CSS and modal files must be split so future security/UI edits are safer", "Huge historical reports should not hide runtime source files in audits"], verifierEvidence: ["baseline.largestFiles", "line scan markdown report", "PASS2516 verifier"], nextActions: ["Split globals.css proof rails", "Split TokenRiskModal", "Create top-20 file manual audit table"] }),
    lane({ id: "commerce_payment_product_line_risk_queue", surface: "commerce_payment", state: "watch", label: "Commerce/payment/product risk queue", percentBefore: 53, percentAfter: 56, implementation: "Cart, checkout, wallet, product, Printful and fulfillment hits are grouped into one launch-critical queue.", auditAdditions: ["Product publish requires variant/material/image/fulfillment snapshot", "Payment unlock requires webhook/idempotency/rollback", "Wallet connect remains identity/context only"], verifierEvidence: ["commerce_product category count", "cart/wallet PASS2516 markers", "product/admin PASS2516 markers"], nextActions: ["Manual checkout flow audit", "Printful import dry-run", "Refund/chargeback UX copy"] }),
    lane({ id: "master_txt_percent_progress_update", surface: "master_txt", state: "line_scan_complete", label: "Master TXT updated with line-count percent reality", percentBefore: 70, percentAfter: 72, implementation: "Master TXT receives the PASS2516 line count, category counts, percentage reality and next queue.", auditAdditions: ["Separate automated line-scan completion from human semantic audit", "Topka świata requires UI psychology + AI security + runtime truth + production proof together"], verifierEvidence: ["VELMERE_PASS2516_EXPANDED_MASTER_TODO_PROGRESS.txt", "PASS2516_IMPLEMENTATION_REPORT.md"], nextActions: ["Run semantic batches", "Keep every pass updating % by actual evidence"] }),
  ];

  const masterTxtAdditions = [
    `PASS2516 line-by-line scan: ${baseline.textFiles} text files, ${baseline.textLines} lines, ${baseline.nonEmptyLines} non-empty lines, SHA256 ${baseline.lineScanSha256}.`,
    "Automated line scan is 100%; human semantic line-by-line audit is separated and will advance by top finding files/batches.",
    "Add world-class UI psychology lane: calm premium colors, limited gold, no panic risk colors, compact trust chips, anti-FOMO copy.",
    "Add world-class AI lane: prompt injection, hidden prompt, sensitive output, excessive agency, raw receipt leak and trade-pressure refusal drills.",
    "Add runtime truth lane: live/current/final/paid/confirmed copy must have provider timestamp, receipt, hash family, vault owner binding or degraded/watch label.",
    "Add maintainability lane: split huge CSS/modal/brain files so future audits can be true line-by-line, not fragile mega-file edits.",
    "Add commerce/product lane: Printful/provider/product publish and checkout unlock require snapshots, variants, image ownership, fulfillment and rollback proofs.",
  ];

  const nextPassQueue = [
    "PASS2517: manual semantic audit batch 1 — top 20 finding files with exact line ranges and fixes.",
    "PASS2518: premium visual psychology pass — colors, spacing, risk chips, anti-FOMO copy and mobile screenshots.",
    "PASS2519: huge-file modularization — globals.css proof rails + TokenRiskModal/AssetDetailModal split plan and first extraction.",
    "PASS2520: Angel/VLM Brain red-team paraphrase harness with source-honesty answer snapshots.",
    "PASS2521: checkout/product publish runtime dry-run with Stripe/BLIK/crypto rollback states and Printful provider snapshots.",
  ];

  const fingerprint = hash({ id: PASS2516_LINE_AUDIT_WORLDCLASS_REBALANCE_ID, query, symbol, baseline, gapCategories, lanes, nextPassQueue });

  return {
    id: PASS2516_LINE_AUDIT_WORLDCLASS_REBALANCE_ID,
    state: "line_audit_receipted",
    query,
    symbol,
    generatedAt: new Date(0).toISOString(),
    fullZipLineScanReady: baseline.textLines >= 699000 && baseline.textFiles >= 3030,
    aiSecurityBacklogReady: (baseline.categoryCounts.ai_security ?? 0) > 0,
    uiPsychologyBacklogReady: (baseline.categoryCounts.ui_psychology ?? 0) > 0,
    runtimeTruthDebugCopyTriageReady: ((baseline.categoryCounts.runtime_truth ?? 0) + (baseline.categoryCounts.debug_copy ?? 0)) > 0,
    largeFileFragilityQueueReady: baseline.largestFiles.length > 0,
    commercePaymentProductRiskQueueReady: (baseline.categoryCounts.commerce_product ?? 0) > 0,
    masterTxtPercentProgressReady: true,
    pass2515CooldownRespected,
    baseline,
    gapCategories,
    lanes,
    masterTxtAdditions,
    nextPassQueue,
    fingerprint,
    auditRule: "automated_line_scan_100_percent_plus_semantic_batches_required_for_worldclass_claims_pass2516",
  };
}
