import { sha256Token } from "@/lib/security/cryptographic-digest";
import { canonicalJson } from "@/lib/security/canonical-json";
export const PASS2193_BROWSER_RUNTIME_RECEIPT_PACK_ID = "browser-runtime-receipt-pack" as const;

export type Pass2193BrowserReceiptLaneId =
  | "basic_overlay_opens"
  | "pro_overlay_opens"
  | "advanced_unpaid_checkout_visible"
  | "advanced_checkout_failure_visible_error"
  | "advanced_local_demo_overlay"
  | "advanced_paid_entitlement_overlay"
  | "angel_audit_handoff_context"
  | "pdf_preview_download_parity"
  | "modal_scroll_lock_mobile";

export type Pass2193ReceiptStatus = "PASS" | "FAIL" | "BLOCKED_ENV" | "NOT_RUN";

export type Pass2193BrowserReceiptInput = {
  status?: Pass2193ReceiptStatus;
  capturedAt?: string;
  urlPath?: string;
  screenshotRef?: string;
  consoleErrorsCount?: number;
  networkStatus?: number;
  visibleState?: "loading" | "analysis" | "checkout" | "error" | "redacted" | "locked" | "success";
  paidBoundaryObserved?: boolean;
  scrollLockObserved?: boolean;
  locale?: "pl" | "en" | "de";
  redactedNotes?: string;
};

export type Pass2193BrowserReceiptLane = {
  id: Pass2193BrowserReceiptLaneId;
  label: string;
  p0: boolean;
  expectedVisibleState: string;
  requiredArtifacts: string[];
  status: Pass2193ReceiptStatus;
  currentEvidence: string[];
  missingProofs: string[];
  customerSafeClaim: string;
  noOverclaimBoundary: string;
};

export type Pass2193BrowserRuntimeReceiptReport = {
  schemaVersion: typeof PASS2193_BROWSER_RUNTIME_RECEIPT_PACK_ID;
  passId: "PASS2193";
  generatedAt: string;
  status: "PASS" | "PARTIAL" | "BLOCKED_BROWSER_RUNTIME" | "FAIL";
  productionGate: "ALLOW_BROWSER_PROMOTION" | "BLOCK_BROWSER_PROMOTION";
  lanes: Pass2193BrowserReceiptLane[];
  summary: {
    total: number;
    pass: number;
    fail: number;
    blockedEnv: number;
    notRun: number;
    p0Missing: Pass2193BrowserReceiptLaneId[];
  };
  receiptInputTemplatePath: string;
  runtimeProofBoardMapping: {
    lane: "browser_click_runtime_receipts";
    suggestedStatusForBoard: "PASS" | "PASS_STATIC_ONLY" | "BLOCKED_ENV" | "FAIL";
    receiptCount: number;
  };
  redactionRules: string[];
  nextOwnerActions: string[];
  checksum: string;
};

const BLUEPRINTS: Omit<Pass2193BrowserReceiptLane, "status" | "currentEvidence" | "missingProofs">[] = [
  {
    id: "basic_overlay_opens",
    label: "Basic click opens VLM analysis overlay",
    p0: true,
    expectedVisibleState: "analysis or loading, never silent",
    requiredArtifacts: ["desktop screenshot", "network status 200/ok", "no blocking console error"],
    customerSafeClaim: "Basic analysis opens correctly.",
    noOverclaimBoundary: "Do not claim Basic runtime is fixed until screenshot/network receipt exists.",
  },
  {
    id: "pro_overlay_opens",
    label: "Pro click opens VLM analysis overlay",
    p0: true,
    expectedVisibleState: "analysis or loading, never silent",
    requiredArtifacts: ["desktop screenshot", "network status 200/ok", "no blocking console error"],
    customerSafeClaim: "Pro analysis opens correctly.",
    noOverclaimBoundary: "Do not claim Pro runtime is fixed until screenshot/network receipt exists.",
  },
  {
    id: "advanced_unpaid_checkout_visible",
    label: "Unpaid Advanced shows checkout/paywall state",
    p0: true,
    expectedVisibleState: "checkout_required notice or checkout opening, never silent",
    requiredArtifacts: ["unpaid screenshot", "402/checkout_required payload or checkout redirect proof", "paid boundary observed"],
    customerSafeClaim: "Unpaid Advanced is locked behind payment.",
    noOverclaimBoundary: "Do not claim paid boundary works unless unpaid Advanced cannot access full analysis.",
  },
  {
    id: "advanced_checkout_failure_visible_error",
    label: "Checkout failure shows visible safe error",
    p0: true,
    expectedVisibleState: "visible error with retry, never dead click",
    requiredArtifacts: ["failed checkout screenshot", "safe error copy", "no secret leakage"],
    customerSafeClaim: "Checkout failure is visible and safe.",
    noOverclaimBoundary: "Do not hide checkout errors or expose provider/Stripe internals.",
  },
  {
    id: "advanced_local_demo_overlay",
    label: "Local demo Advanced opens only in development flag mode",
    p0: false,
    expectedVisibleState: "analysis with local-demo notice",
    requiredArtifacts: ["local env flag screenshot/log", "visible demo notice", "not production"],
    customerSafeClaim: "Advanced local demo works for development testing only.",
    noOverclaimBoundary: "Local demo receipt cannot be used as paid production proof.",
  },
  {
    id: "advanced_paid_entitlement_overlay",
    label: "Paid Advanced opens after durable entitlement",
    p0: true,
    expectedVisibleState: "Advanced analysis after paid entitlement proof",
    requiredArtifacts: ["Stripe/Supabase receipt", "Advanced overlay screenshot", "entitlement source redacted"],
    customerSafeClaim: "Paid Advanced opens only after entitlement.",
    noOverclaimBoundary: "Do not claim paid Advanced production-ready until durable payment proof exists.",
  },
  {
    id: "angel_audit_handoff_context",
    label: "Audit Watch to Angel preserves audit context",
    p0: false,
    expectedVisibleState: "Angel answers audit/project context, not clothing-only fallback",
    requiredArtifacts: ["handoff screenshot", "PL/EN/DE sample if possible", "no clothing-only fallback"],
    customerSafeClaim: "Angel continues audit handoff correctly.",
    noOverclaimBoundary: "Do not claim multilingual Angel quality until real Gemini receipt exists.",
  },
  {
    id: "pdf_preview_download_parity",
    label: "PDF preview/download parity and Advanced boundary",
    p0: false,
    expectedVisibleState: "preview and downloaded PDF contain same safe payload",
    requiredArtifacts: ["preview screenshot", "downloaded PDF hash", "unpaid Advanced redaction proof"],
    customerSafeClaim: "PDF preview/download parity is verified.",
    noOverclaimBoundary: "Do not claim PDF premium quality without A4 visual receipt.",
  },
  {
    id: "modal_scroll_lock_mobile",
    label: "Mobile modal scroll lock and no header overlap",
    p0: false,
    expectedVisibleState: "modal over header, inner scroll only, page locked",
    requiredArtifacts: ["mobile screenshot", "scroll lock note", "no header overlap"],
    customerSafeClaim: "Mobile modal behavior is verified.",
    noOverclaimBoundary: "Do not claim world-class mobile UX until screenshot/accessibility receipts exist.",
  },
];

const SECRET_PATTERNS = [
  /GEMINI_API_KEY/i,
  /STRIPE_SECRET/i,
  /STRIPE_WEBHOOK_SECRET/i,
  /SUPABASE_SERVICE_ROLE/i,
  /PRINTFUL_API_TOKEN/i,
  /TAPSTITCH_API_KEY/i,
  /VELMERE_PAID_ACCESS_SECRET/i,
  /sk_live_[a-z0-9_]+/i,
  /sk_test_[a-z0-9_]+/i,
  /AIza[0-9A-Za-z_-]{20,}/,
];

function safeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function hasSecretLikeText(receipt: Pass2193BrowserReceiptInput | undefined) {
  const combined = [receipt?.screenshotRef, receipt?.redactedNotes, receipt?.urlPath].map(safeText).join("\n");
  return SECRET_PATTERNS.some((pattern) => pattern.test(combined));
}

function normalizeStatus(input: Pass2193BrowserReceiptInput | undefined): Pass2193ReceiptStatus {
  if (!input) return "NOT_RUN";
  if (hasSecretLikeText(input)) return "FAIL";
  if (input.status) return input.status;
  if (input.networkStatus && input.networkStatus >= 500) return "FAIL";
  if (input.visibleState && input.screenshotRef) return "PASS";
  return "BLOCKED_ENV";
}

function evidenceFor(input: Pass2193BrowserReceiptInput | undefined, status: Pass2193ReceiptStatus) {
  const evidence: string[] = [];
  if (input?.screenshotRef) evidence.push(`screenshot:${input.screenshotRef}`);
  if (input?.urlPath) evidence.push(`url:${input.urlPath}`);
  if (input?.networkStatus) evidence.push(`network:${input.networkStatus}`);
  if (typeof input?.consoleErrorsCount === "number") evidence.push(`console_errors:${input.consoleErrorsCount}`);
  if (input?.visibleState) evidence.push(`visible_state:${input.visibleState}`);
  if (input?.paidBoundaryObserved) evidence.push("paid_boundary_observed");
  if (input?.scrollLockObserved) evidence.push("scroll_lock_observed");
  if (input?.locale) evidence.push(`locale:${input.locale}`);
  if (status === "FAIL" && hasSecretLikeText(input)) evidence.push("secret_like_text_detected_in_receipt_input");
  return evidence.length ? evidence : ["not_captured_yet"];
}

function missingFor(blueprint: Omit<Pass2193BrowserReceiptLane, "status" | "currentEvidence" | "missingProofs">, input: Pass2193BrowserReceiptInput | undefined, status: Pass2193ReceiptStatus) {
  if (status === "PASS") return [];
  if (status === "FAIL") return ["fix failing runtime state and recapture redacted receipt"];
  const missing = [...blueprint.requiredArtifacts];
  if (!input?.screenshotRef) missing.push("screenshotRef");
  if (!input?.visibleState) missing.push("visibleState");
  return Array.from(new Set(missing));
}

function checksumFor(payload: unknown) {
  return `pass2193-${sha256Token(canonicalJson(payload), 24)}`;
}

export const PASS2193_BROWSER_RUNTIME_RECEIPT_TEMPLATE: Record<Pass2193BrowserReceiptLaneId, Pass2193BrowserReceiptInput> = Object.fromEntries(
  BLUEPRINTS.map((lane) => [
    lane.id,
    {
      status: "NOT_RUN",
      capturedAt: "YYYY-MM-DDTHH:mm:ss.sssZ",
      urlPath: "/en/shield-or-real-markets-or-audit-watch",
      screenshotRef: `owner-runtime/screenshots/${lane.id}.png`,
      consoleErrorsCount: 0,
      networkStatus: 200,
      visibleState: lane.id.includes("checkout") ? "checkout" : "analysis",
      paidBoundaryObserved: lane.id.includes("advanced"),
      scrollLockObserved: lane.id.includes("modal") || lane.id.includes("pdf"),
      locale: "en",
      redactedNotes: "Describe the visible result only. Do not paste .env.local, API keys, tokens, addresses, phone numbers, emails or raw provider payloads.",
    },
  ]),
) as Record<Pass2193BrowserReceiptLaneId, Pass2193BrowserReceiptInput>;

export function evaluatePass2193BrowserRuntimeReceipts(input?: {
  receipts?: Partial<Record<Pass2193BrowserReceiptLaneId, Pass2193BrowserReceiptInput>>;
}): Pass2193BrowserRuntimeReceiptReport {
  const receiptMap = input?.receipts ?? {};
  const lanes = BLUEPRINTS.map((blueprint) => {
    const receipt = receiptMap[blueprint.id];
    const status = normalizeStatus(receipt);
    return {
      ...blueprint,
      status,
      currentEvidence: evidenceFor(receipt, status),
      missingProofs: missingFor(blueprint, receipt, status),
    } satisfies Pass2193BrowserReceiptLane;
  });

  const summary = {
    total: lanes.length,
    pass: lanes.filter((lane) => lane.status === "PASS").length,
    fail: lanes.filter((lane) => lane.status === "FAIL").length,
    blockedEnv: lanes.filter((lane) => lane.status === "BLOCKED_ENV").length,
    notRun: lanes.filter((lane) => lane.status === "NOT_RUN").length,
    p0Missing: lanes.filter((lane) => lane.p0 && lane.status !== "PASS").map((lane) => lane.id),
  };

  const status: Pass2193BrowserRuntimeReceiptReport["status"] = summary.fail > 0
    ? "FAIL"
    : summary.p0Missing.length === 0 && summary.pass === summary.total
      ? "PASS"
      : summary.pass > 0
        ? "PARTIAL"
        : "BLOCKED_BROWSER_RUNTIME";

  const boardStatus: Pass2193BrowserRuntimeReceiptReport["runtimeProofBoardMapping"]["suggestedStatusForBoard"] =
    status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : "BLOCKED_ENV";

  const shell = {
    schemaVersion: PASS2193_BROWSER_RUNTIME_RECEIPT_PACK_ID,
    passId: "PASS2193" as const,
    generatedAt: new Date().toISOString(),
    status,
    productionGate: status === "PASS" ? "ALLOW_BROWSER_PROMOTION" as const : "BLOCK_BROWSER_PROMOTION" as const,
    lanes,
    summary,
    receiptInputTemplatePath: "runtime-receipts/PASS2193_BROWSER_RUNTIME_RECEIPTS.input.template.json",
    runtimeProofBoardMapping: {
      lane: "browser_click_runtime_receipts" as const,
      suggestedStatusForBoard: boardStatus,
      receiptCount: summary.pass,
    },
    redactionRules: [
      "Never paste .env.local or secret values into receipts.",
      "Screenshots should hide emails, addresses, phone numbers, provider tokens and payment secrets.",
      "Use screenshot filenames or hashes, not raw image base64 in chat.",
      "Local demo Advanced receipts are useful for click proof but not proof of paid production entitlement.",
    ],
    nextOwnerActions: [
      "Run the local server demo checkout and verify flow to create an account-bound entitlement before Advanced proof.",
      "Capture screenshots for every required lane under owner-runtime/screenshots/.",
      "Fill runtime-receipts/PASS2193_BROWSER_RUNTIME_RECEIPTS.input.json from the template.",
      "Run npm run browser:runtime-receipt-pack and then npm run runtime:proof-board.",
      "Send the ZIP back without .env.local so engine and Codex visual changes can be merged safely.",
    ],
  };

  return {
    ...shell,
    checksum: checksumFor({ lanes, summary, status }),
  };
}
