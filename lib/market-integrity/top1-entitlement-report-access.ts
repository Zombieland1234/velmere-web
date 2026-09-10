import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";

export type AdvancedDeliveryMode = "manual_review" | "automated";

export type EntitlementSignal = {
  id: string;
  label: string;
  state: "present" | "missing" | "invalid" | "unverified" | "not_required";
  customerSafeCopy: string;
};

export type ReportAccessDecision = {
  schemaVersion: "pass2812_report_access_decision_v1";
  tier: VelmereTier;
  paidTierRequested: boolean;
  paidEvidenceAllowed: boolean;
  status: "public_basic" | "locked_paid_evidence" | "paid_evidence_ready" | "advanced_review_pending";
  requiredSignals: EntitlementSignal[];
  blockedReasons: string[];
  rendererRule: string;
  downloadRule: string;
  auditLogRule: string;
};

export type ReportTokenPolicy = {
  schemaVersion: "pass2812_report_token_policy_v1";
  tokenRequiredFor: VelmereTier[];
  tokenFormat: string;
  expiresInMinutes: number;
  singleUse: boolean;
  bindToAccount: boolean;
  bindToReportPayloadHash: boolean;
  customerSafeCopy: string;
};

export type PaymentEntitlementBoundary = {
  schemaVersion: "pass2812_payment_entitlement_boundary_v1";
  ruleId: "server_receipt_or_basic_only";
  walletBoundary: string;
  stripeBoundary: string;
  successUrlBoundary: string;
  pdfBoundary: string;
  advancedBoundary: string;
  requiredServerReceipts: string[];
  forbiddenClientProofs: string[];
  acceptanceGates: string[];
};

export type PaymentEntitlementBoundaryV2 = Omit<PaymentEntitlementBoundary, "schemaVersion"> & {
  schemaVersion: "pass2812_payment_entitlement_boundary_v2";
  advancedDeliveryMode: AdvancedDeliveryMode;
};

const REPORT_TOKEN_PATTERN = /^vlm_rpt_[a-z0-9_-]{24,96}$/i;
const SERVER_RECEIPT_PATTERN = /^(stripe|blik|web3|manual|vlm)_receipt_[a-z0-9_-]{16,96}$/i;
const ACCOUNT_PATTERN = /^(?:(?:acct|user|vlm_user)_[a-z0-9_-]{8,96}|(?:email|google_preview|server):[a-f0-9]{18,64})$/i;

export const PASS2812_ENTITLEMENT_ACCEPTANCE_GATES = [
  "Basic can remain public, but Pro/Advanced proof lanes must be locked unless server entitlement is present.",
  "Wallet connect is identity/context only; it cannot unlock paid report evidence or Advanced PDF.",
  "Stripe/BLIK/Web3 success URL is never enough; webhook/server receipt must be verified server-side.",
  "Pro/Advanced PDF download requires account binding, server receipt, expiring report token and payload hash binding.",
  "Advanced requires manual_review/operator receipt before reviewed notes, signed appendix or private delivery can render.",
  "Report renderer must show locked/missing-evidence state instead of silently rendering paid evidence from client state.",
] as const;

export function buildPass2812PaymentEntitlementBoundary(): PaymentEntitlementBoundary {
  return {
    schemaVersion: "pass2812_payment_entitlement_boundary_v1",
    ruleId: "server_receipt_or_basic_only",
    walletBoundary: "Wallet connection may identify the account/session and sign a nonce, but it is not payment proof and must never unlock paid evidence by itself.",
    stripeBoundary: "Stripe/BLIK/card/Web3 payment must be converted into a server-side entitlement receipt through a verified webhook or trusted server action.",
    successUrlBoundary: "A success URL, query parameter, localStorage flag, client tier selector or route state is not an entitlement.",
    pdfBoundary: "Paid PDF download requires server receipt + account binding + expiring one-time report token + report payload hash binding.",
    advancedBoundary: "Advanced requires paid entitlement plus manual_review/operator receipt before manually QA-checked notes or signed appendix render.",
    requiredServerReceipts: ["account_id", "server_receipt_id", "report_token", "payload_hash", "tier", "expires_at", "single_use_status"],
    forbiddenClientProofs: ["success_url", "client_tier_state", "localStorage", "wallet_connected", "query_unlock", "frontend_only_receipt"],
    acceptanceGates: [...PASS2812_ENTITLEMENT_ACCEPTANCE_GATES],
  };
}

export function buildPass2812PaymentEntitlementBoundaryV2(args: {
  advancedDeliveryMode: AdvancedDeliveryMode;
}): PaymentEntitlementBoundaryV2 {
  const automated = args.advancedDeliveryMode === "automated";
  return {
    schemaVersion: "pass2812_payment_entitlement_boundary_v2",
    ruleId: "server_receipt_or_basic_only",
    advancedDeliveryMode: args.advancedDeliveryMode,
    walletBoundary: "Wallet connection may identify the account/session and sign a nonce, but it is not payment proof and must never unlock paid evidence by itself.",
    stripeBoundary: "Stripe/BLIK/card/Web3 payment must be converted into a server-side entitlement receipt through a verified webhook or trusted server action.",
    successUrlBoundary: "A success URL, query parameter, localStorage flag, client tier selector or route state is not an entitlement.",
    pdfBoundary: "Paid PDF download requires server receipt + account binding + expiring one-time report token + report payload hash binding.",
    advancedBoundary: automated
      ? "Advanced remains automated. Optional human QA earns no entitlement or delivery credit; exact automated evidence and value gates must pass for the requested tier."
      : "Advanced requires paid entitlement plus a trusted manual-review receipt before manually QA-checked notes or signed appendix render.",
    requiredServerReceipts: ["account_id", "server_receipt_id", "report_token", "payload_hash", "tier", "expires_at", "single_use_status"],
    forbiddenClientProofs: ["success_url", "client_tier_state", "localStorage", "wallet_connected", "query_unlock", "frontend_only_receipt"],
    acceptanceGates: [
      "Basic can remain public, but Pro/Advanced proof lanes must be locked unless server entitlement is present.",
      "Wallet connect is identity/context only; it cannot unlock paid report evidence or Advanced PDF.",
      "Stripe/BLIK/Web3 success URL is never enough; webhook/server receipt must be verified server-side.",
      "Pro/Advanced PDF download requires account binding, server receipt, expiring report token and payload hash binding.",
      automated
        ? "Automated Advanced requires exact requested-tier evidence and value gates; payment never authorizes a Pro fallback or optional human-QA lane."
        : "Manual-review Advanced requires a trusted reviewer receipt before reviewed notes, signed appendix or private delivery can render.",
      "Report renderer must show locked/missing-evidence state instead of silently rendering paid evidence from client state.",
    ],
  };
}

function signal(id: string, label: string, state: EntitlementSignal["state"], customerSafeCopy: string): EntitlementSignal {
  return { id, label, state, customerSafeCopy };
}

export function buildReportAccessDecision(args: {
  tier: VelmereTier;
  accountId?: string | null;
  serverReceiptId?: string | null;
  reportToken?: string | null;
  payloadHash?: string | null;
  manualReviewReceiptId?: string | null;
  manualReviewRequired?: boolean;
  advancedDeliveryMode?: AdvancedDeliveryMode;
  verification?: {
    accountBound: boolean;
    serverReceiptVerified: boolean;
    reportTokenVerified: boolean;
    payloadHashBound: boolean;
    manualReviewVerified?: boolean;
    source: "server_entitlement" | "trusted_internal" | "diagnostic_only";
  };
}): ReportAccessDecision {
  const paidTierRequested = args.tier !== "Basic";
  const verification = args.verification;
  const accountFormatValid = Boolean(args.accountId && ACCOUNT_PATTERN.test(args.accountId));
  const receiptFormatValid = Boolean(args.serverReceiptId && SERVER_RECEIPT_PATTERN.test(args.serverReceiptId));
  const tokenFormatValid = Boolean(args.reportToken && REPORT_TOKEN_PATTERN.test(args.reportToken));
  const payloadHashFormatValid = Boolean(args.payloadHash && args.payloadHash.length >= 24 && !/[<>\s]/.test(args.payloadHash));
  const advancedDeliveryMode = args.advancedDeliveryMode ?? "manual_review";
  const manualReviewRequired = args.tier === "Advanced"
    && advancedDeliveryMode === "manual_review"
    && args.manualReviewRequired !== false;
  const manualReviewFormatValid = Boolean(args.manualReviewReceiptId && SERVER_RECEIPT_PATTERN.test(args.manualReviewReceiptId));
  const accountValid = accountFormatValid && verification?.accountBound === true;
  const receiptValid = receiptFormatValid && verification?.serverReceiptVerified === true;
  const tokenValid = tokenFormatValid && verification?.reportTokenVerified === true;
  const payloadHashValid = payloadHashFormatValid && verification?.payloadHashBound === true;
  const manualReviewValid = manualReviewFormatValid && verification?.manualReviewVerified === true;

  if (!paidTierRequested) {
    return {
      schemaVersion: "pass2812_report_access_decision_v1",
      tier: args.tier,
      paidTierRequested,
      paidEvidenceAllowed: false,
      status: "public_basic",
      requiredSignals: [
        signal("account_id", "Account binding", "not_required", "Basic remains public triage; account improves delivery but is not required."),
        signal("server_receipt", "Server receipt", "not_required", "Basic must not pretend to include paid source receipt bundles."),
        signal("report_token", "Report token", "not_required", "Basic preview can render limited evidence without paid download token."),
      ],
      blockedReasons: [],
      rendererRule: "Render Basic triage, missing evidence and paid boundaries. Do not render Pro/Advanced receipt bundle.",
      downloadRule: "Full PDF/source bundle remains locked unless the user has server entitlement.",
      auditLogRule: "Log public report creation without storing private payment proof.",
    };
  }

  const verifiedState = (value: string | null | undefined, formatValid: boolean, verified: boolean): EntitlementSignal["state"] => {
    if (!value) return "missing";
    if (!formatValid) return "invalid";
    return verified ? "present" : "unverified";
  };
  const requiredSignals = [
    signal("account_id", "Account binding", verifiedState(args.accountId, accountFormatValid, accountValid), "Paid evidence must be attached to a signed, server-resolved account/session, not a browser-only state."),
    signal("server_receipt", "Server entitlement receipt", verifiedState(args.serverReceiptId, receiptFormatValid, receiptValid), "Payment success must be verified by webhook plus durable entitlement lookup before paid proof renders."),
    signal("report_token", "Expiring report token", verifiedState(args.reportToken, tokenFormatValid, tokenValid), "Paid PDF access requires a cryptographically verified token bound to the durable entitlement."),
    signal("payload_hash", "Payload hash binding", verifiedState(args.payloadHash, payloadHashFormatValid, payloadHashValid), "The verified token and entitlement must bind to the exact account, asset, tier and report context."),
    signal(
      "manual_review",
      "Manual review receipt",
      manualReviewRequired ? verifiedState(args.manualReviewReceiptId, manualReviewFormatValid, manualReviewValid) : "not_required",
      manualReviewRequired
        ? "This manual-review product path needs a verified operator receipt before reviewed notes render."
        : "Human QA is optional and cannot create entitlement, unlock evidence or substitute for automated requested-tier readiness.",
    ),
  ];

  const blockedReasons = requiredSignals
    .filter((entry) => entry.state === "missing" || entry.state === "invalid" || entry.state === "unverified")
    .map((entry) => `${entry.label}: ${entry.state}`);
  const paidEvidenceAllowed = blockedReasons.length === 0;
  const status: ReportAccessDecision["status"] = paidEvidenceAllowed
    ? args.tier === "Advanced" && manualReviewRequired
      ? "advanced_review_pending"
      : "paid_evidence_ready"
    : "locked_paid_evidence";

  return {
    schemaVersion: "pass2812_report_access_decision_v1",
    tier: args.tier,
    paidTierRequested,
    paidEvidenceAllowed,
    status,
    requiredSignals,
    blockedReasons,
    rendererRule: paidEvidenceAllowed
      ? "Render paid tier evidence only from server-bound payload receipts; keep customer-safe disclaimers visible."
      : "Render locked paid-evidence boundary, missing-evidence copy and upgrade/account receipt instructions; never silently render Pro/Advanced proof.",
    downloadRule: paidEvidenceAllowed
      ? "Allow paid PDF download only through the expiring server token and bind access to account + payload hash."
      : "Block full paid PDF/source receipt download; show Basic preview or locked receipt table placeholder.",
    auditLogRule: "Append report access attempt with tier, account binding status, receipt status, token status and payload hash status; never log raw secrets.",
  };
}

export function buildReportTokenPolicy(): ReportTokenPolicy {
  return {
    schemaVersion: "pass2812_report_token_policy_v1",
    tokenRequiredFor: ["Pro", "Advanced"],
    tokenFormat: "vlm_rpt_<random 24-96 url-safe chars>",
    expiresInMinutes: 15,
    singleUse: true,
    bindToAccount: true,
    bindToReportPayloadHash: true,
    customerSafeCopy: "Paid report links should expire quickly, work once, and be bound to the exact report payload and account receipt.",
  };
}

export function buildPass2812PaidTierSecuritySuite(args?: Parameters<typeof buildReportAccessDecision>[0]) {
  const decision = buildReportAccessDecision(
    args ?? {
      tier: "Pro",
      accountId: null,
      serverReceiptId: null,
      reportToken: null,
      payloadHash: null,
      manualReviewReceiptId: null,
    },
  );
  return {
    schemaVersion: "pass2812_paid_tier_security_suite_v1" as const,
    boundary: buildPass2812PaymentEntitlementBoundary(),
    tokenPolicy: buildReportTokenPolicy(),
    accessDecision: decision,
  };
}

export function buildPass2812PaidTierSecuritySuiteV2(
  args: Parameters<typeof buildReportAccessDecision>[0],
  advancedDeliveryMode: AdvancedDeliveryMode,
) {
  const decision = buildReportAccessDecision({ ...args, advancedDeliveryMode });
  return {
    schemaVersion: "pass2812_paid_tier_security_suite_v2" as const,
    boundary: buildPass2812PaymentEntitlementBoundaryV2({ advancedDeliveryMode }),
    tokenPolicy: buildReportTokenPolicy(),
    accessDecision: decision,
  };
}
