import { PASS2193_BROWSER_RUNTIME_RECEIPT_PACK_ID } from "@/lib/worldclass/browser-runtime-receipt-pack";
import { PASS2198_CUSTOMER_SAFE_STATUS_UI_BINDING_ID } from "@/lib/worldclass/customer-safe-status-ui-binding";

import { sha256Token } from "@/lib/security/cryptographic-digest";
import { canonicalJson } from "@/lib/security/canonical-json";
export const PASS2199_RUNTIME_SCREENSHOT_CHECKLIST_UI_ID = "runtime-screenshot-checklist-ui" as const;

export type Pass2199ChecklistGroup =
  | "build"
  | "shield"
  | "real_markets"
  | "account"
  | "checkout"
  | "pdf"
  | "angel"
  | "mobile"
  | "legal";

export type Pass2199ChecklistSeverity = "P0" | "P1" | "P2";

export type Pass2199RuntimeScreenshotChecklistItem = {
  id: string;
  group: Pass2199ChecklistGroup;
  severity: Pass2199ChecklistSeverity;
  route: string;
  action: string;
  expectedCustomerSafeResult: string;
  screenshotName: string;
  receiptTarget: string;
  boardLane: string;
  mustNotContain: string[];
  selectorHints: string[];
};

export type Pass2199RuntimeScreenshotChecklistReport = {
  schemaVersion: typeof PASS2199_RUNTIME_SCREENSHOT_CHECKLIST_UI_ID;
  passId: "PASS2199";
  generatedAt: string;
  status: "PASS_STATIC_ONLY" | "BLOCKED_RUNTIME" | "FAIL";
  productionGate: "BLOCK_RUNTIME_PRODUCTION";
  dependsOn: [typeof PASS2193_BROWSER_RUNTIME_RECEIPT_PACK_ID, typeof PASS2198_CUSTOMER_SAFE_STATUS_UI_BINDING_ID];
  checklistRoute: "/[locale]/runtime-proof";
  localCommand: "npm run runtime:screenshot-checklist-ui";
  items: Pass2199RuntimeScreenshotChecklistItem[];
  receiptTemplate: {
    file: "runtime-receipts/PASS2199_RUNTIME_SCREENSHOT_CHECKLIST.input.template.json";
    acceptedFields: string[];
    forbiddenFields: string[];
  };
  boardLane: "runtime_screenshot_checklist_ui";
  requiredReceipts: string[];
  nextOwnerActions: string[];
  checksum: string;
};

export const PASS2199_SECRET_AND_RAW_PAYLOAD_BLOCKLIST = [
  "GEMINI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PRINTFUL_API_TOKEN",
  "TAPSTITCH_API_KEY",
  "VELMERE_PAID_ACCESS_SECRET",
  ".env.local",
  "raw Stripe event",
  "raw provider payload",
  "customer email / phone / address",
  "seed phrase / private key",
  "full Advanced evidence ledger for unpaid user",
];

const ITEMS: Pass2199RuntimeScreenshotChecklistItem[] = [
  {
    id: "build_local_command_visible",
    group: "build",
    severity: "P0",
    route: "/runtime-proof",
    action: "Open the runtime proof checklist and confirm the local commands are visible before running them.",
    expectedCustomerSafeResult: "Owner sees exact local commands for npm ci, typecheck, build and dev without any embedded secrets.",
    screenshotName: "pass2199_01_runtime_proof_commands.png",
    receiptTarget: "runtime_checklist_route_visible",
    boardLane: "runtime_screenshot_checklist_ui",
    mustNotContain: [".env.local contents", "API key", "secret token"],
    selectorHints: ["data-pass2199-runtime-checklist", "data-pass2199-command-pack"],
  },
  {
    id: "shield_basic_pro_advanced_clicks",
    group: "shield",
    severity: "P0",
    route: "/market-integrity",
    action: "Open Shield, click Basic, Pro and unpaid Advanced on the same asset.",
    expectedCustomerSafeResult: "Basic/Pro open analysis; unpaid Advanced shows checkout/paywall state with visible recovery copy.",
    screenshotName: "pass2199_02_shield_basic_pro_advanced.png",
    receiptTarget: "basic_pro_advanced_clicks_visible",
    boardLane: "browser_click_runtime_receipts",
    mustNotContain: ["dead click", "blank modal", "raw error stack", "full Advanced ledger for unpaid user"],
    selectorHints: ["data-pass2195-runtime-ux", "data-pass2195-receipt-code"],
  },
  {
    id: "real_markets_advanced_paywall",
    group: "real_markets",
    severity: "P0",
    route: "/market-integrity/real-markets",
    action: "Open Real Markets and click Advanced while unpaid, then Basic/Pro.",
    expectedCustomerSafeResult: "Real Markets Advanced uses the server gate and shows checkout/local-demo/paid status instead of direct analysis bypass.",
    screenshotName: "pass2199_03_real_markets_advanced_paywall.png",
    receiptTarget: "real_markets_advanced_paywall_visible",
    boardLane: "real_markets_advanced_paywall_parity",
    mustNotContain: ["direct advanced bypass", "setAuditMode advanced without gate", "paid content while unpaid"],
    selectorHints: ["data-pass2195-runtime-ux", "data-pass2197-realmarkets-paywall"],
  },
  {
    id: "account_status_surfaces",
    group: "account",
    severity: "P1",
    route: "/account",
    action: "Open account overview, orders and wallet tabs.",
    expectedCustomerSafeResult: "Account shows calm proof/order/wallet boundary status and explains wallet connect is not paid access.",
    screenshotName: "pass2199_04_account_status_surfaces.png",
    receiptTarget: "account_status_surfaces_visible",
    boardLane: "customer_safe_status_ui_binding",
    mustNotContain: ["BLOCKED_ENV as main customer text", "PASS_STATIC_ONLY as main customer text", "seed phrase prompt"],
    selectorHints: ["data-pass2198-customer-safe-account-overview", "data-pass2198-customer-safe-account-orders", "data-pass2198-customer-safe-account-wallet"],
  },
  {
    id: "checkout_status_surfaces",
    group: "checkout",
    severity: "P0",
    route: "/cart → /checkout → /checkout/cancel → /checkout/success",
    action: "Open empty cart, cart with item, checkout readiness, cancel and success pages.",
    expectedCustomerSafeResult: "Checkout surfaces show provider/payment/order status without fake production fulfilment claims.",
    screenshotName: "pass2199_05_checkout_status_surfaces.png",
    receiptTarget: "checkout_status_surfaces_visible",
    boardLane: "customer_safe_status_ui_binding",
    mustNotContain: ["raw Stripe error", "raw provider payload", "customer address", "fake shipped claim"],
    selectorHints: ["data-pass2198-customer-safe-cart-surface", "data-pass2198-customer-safe-checkout-surface", "data-pass2198-customer-safe-success-surface", "data-pass2198-customer-safe-cancel-surface"],
  },
  {
    id: "pdf_preview_download_parity",
    group: "pdf",
    severity: "P1",
    route: "/search or Lens PDF surface",
    action: "Generate Basic/Pro PDF preview and verify preview/download parity; try Advanced unpaid.",
    expectedCustomerSafeResult: "Preview and download use the same payload; Advanced PDF remains locked while unpaid.",
    screenshotName: "pass2199_06_pdf_preview_download_parity.png",
    receiptTarget: "pdf_preview_download_parity_visible",
    boardLane: "pdf_sample_quality",
    mustNotContain: ["preview/download mismatch", "Advanced PDF unlocked while unpaid", "raw source-by-source ledger in free tier"],
    selectorHints: ["data-pass2195-runtime-ux", "data-pass2198-customer-safe-checkout-surface"],
  },
  {
    id: "angel_audit_handoff_locale",
    group: "angel",
    severity: "P1",
    route: "/angel or Audit Watch handoff surface",
    action: "Ask Angel in PL/EN/DE about audit context after Audit Watch handoff.",
    expectedCustomerSafeResult: "Angel keeps audit/security context and does not fall back to clothing-only mode or wrong language.",
    screenshotName: "pass2199_07_angel_audit_locale.png",
    receiptTarget: "angel_audit_locale_visible",
    boardLane: "gemini_audit_output",
    mustNotContain: ["local mode", "clothing only", "wrong locale", "secret-like debug output"],
    selectorHints: ["data-angel", "data-pass2195-runtime-ux"],
  },
  {
    id: "mobile_modal_scroll_lock",
    group: "mobile",
    severity: "P0",
    route: "mobile viewport: Shield / Real Markets / PDF preview",
    action: "Open modals on mobile viewport, scroll chart/modal, close and reopen.",
    expectedCustomerSafeResult: "Modal stays above header, body scroll is locked, chart interaction does not move the whole page.",
    screenshotName: "pass2199_08_mobile_modal_scroll_lock.png",
    receiptTarget: "mobile_modal_scroll_lock_visible",
    boardLane: "browser_click_runtime_receipts",
    mustNotContain: ["header over modal", "page scroll behind modal", "missing close button"],
    selectorHints: ["data-pass2199-runtime-checklist", "data-pass2195-runtime-ux"],
  },
  {
    id: "legal_no_overclaim_visible",
    group: "legal",
    severity: "P1",
    route: "/terms / privacy / checkout / security copy",
    action: "Review customer-facing legal/risk copy around paid AI, audits, refunds and fulfilment.",
    expectedCustomerSafeResult: "Copy avoids fake certification, ROI promises and production-ready claims before owner/legal sign-off.",
    screenshotName: "pass2199_09_legal_no_overclaim.png",
    receiptTarget: "legal_no_overclaim_visible",
    boardLane: "legal_owner_review",
    mustNotContain: ["guaranteed profit", "certified audit if not certified", "fake production-ready claim", "no-refund contradiction"],
    selectorHints: ["data-pass2196-customer-safe-status", "footer", "legal"],
  },
];

function checksum(value: unknown) {
  return `pass2199-sha256-${sha256Token(canonicalJson(value), 24)}`;
}

export function buildPass2199RuntimeScreenshotChecklistItems() {
  return ITEMS.map((item) => ({ ...item }));
}

export function buildPass2199RuntimeScreenshotChecklistReport(): Pass2199RuntimeScreenshotChecklistReport {
  const items = buildPass2199RuntimeScreenshotChecklistItems();
  const report: Omit<Pass2199RuntimeScreenshotChecklistReport, "checksum"> = {
    schemaVersion: PASS2199_RUNTIME_SCREENSHOT_CHECKLIST_UI_ID,
    passId: "PASS2199",
    generatedAt: new Date().toISOString(),
    status: "PASS_STATIC_ONLY",
    productionGate: "BLOCK_RUNTIME_PRODUCTION",
    dependsOn: [PASS2193_BROWSER_RUNTIME_RECEIPT_PACK_ID, PASS2198_CUSTOMER_SAFE_STATUS_UI_BINDING_ID],
    checklistRoute: "/[locale]/runtime-proof",
    localCommand: "npm run runtime:screenshot-checklist-ui",
    items,
    receiptTemplate: {
      file: "runtime-receipts/PASS2199_RUNTIME_SCREENSHOT_CHECKLIST.input.template.json",
      acceptedFields: ["id", "status", "screenshotName", "receiptHash", "redactedSummary", "capturedAt", "viewport", "route", "notes"],
      forbiddenFields: PASS2199_SECRET_AND_RAW_PAYLOAD_BLOCKLIST,
    },
    boardLane: "runtime_screenshot_checklist_ui",
    requiredReceipts: items.map((item) => item.receiptTarget),
    nextOwnerActions: [
      "Run npm ci, npm run typecheck, npm run build and npm run dev locally before capturing browser screenshots.",
      "Open /pl/runtime-proof, /en/runtime-proof and /de/runtime-proof to verify the checklist UI and locale shell.",
      "Capture only screenshots/redacted hashes; never paste .env.local, raw Stripe/provider payloads or customer PII into receipts.",
      "Paste redacted receipt names into PASS2194_RUNTIME_RECEIPT_INGESTION.input.json and re-run runtime receipt ingestion.",
    ],
  };
  return { ...report, checksum: checksum(report) };
}
