export const PASS2192_ADVANCED_CLICK_RUNTIME_PROOF_ID = "advanced-click-runtime-proof" as const;

export type Pass2192ClickStateId =
  | "basic_start_analysis"
  | "pro_start_analysis"
  | "advanced_paid_start_analysis"
  | "advanced_local_demo_start_analysis"
  | "advanced_unpaid_checkout_visible"
  | "advanced_checkout_failure_visible_error";

export type Pass2192ClickState = {
  id: Pass2192ClickStateId;
  required: boolean;
  userVisibleOutcome: "loading" | "analysis" | "checkout" | "error";
  backendContract: string;
  noDeadClickRule: string;
};

export type Pass2192AdvancedClickRuntimeProof = {
  schemaVersion: typeof PASS2192_ADVANCED_CLICK_RUNTIME_PROOF_ID;
  passId: "PASS2192";
  generatedAt: string;
  status: "PASS_STATIC_ONLY" | "PASS_RUNTIME" | "FAIL";
  runtimeReceiptsCaptured: boolean;
  clickStates: Pass2192ClickState[];
  publicBoundary: string[];
  freeVsPaidBoundary: string[];
  localDemoBoundary: string[];
  missingRuntimeReceipts: string[];
  checksum: string;
};

export const PASS2192_REQUIRED_CLICK_STATES: Pass2192ClickState[] = [
  {
    id: "basic_start_analysis",
    required: true,
    userVisibleOutcome: "analysis",
    backendContract: "Basic never requires payment and must start the VLM brain sequence immediately.",
    noDeadClickRule: "Basic click must set a visible sequence mode, not only change button state.",
  },
  {
    id: "pro_start_analysis",
    required: true,
    userVisibleOutcome: "analysis",
    backendContract: "Pro never requires payment and must start the deeper free analysis immediately.",
    noDeadClickRule: "Pro click must set a visible sequence mode and preserve missing-data honesty.",
  },
  {
    id: "advanced_paid_start_analysis",
    required: true,
    userVisibleOutcome: "analysis",
    backendContract: "Advanced starts only after server-side paid entitlement is verified.",
    noDeadClickRule: "Paid Advanced click must show an access-checking state before the analysis opens.",
  },
  {
    id: "advanced_local_demo_start_analysis",
    required: true,
    userVisibleOutcome: "analysis",
    backendContract: "Local development may unlock Advanced only after the server demo checkout/verify flow creates an account-bound entitlement; production still requires durable payment evidence.",
    noDeadClickRule: "Local Advanced demo click must visibly open analysis with a local-demo boundary notice.",
  },
  {
    id: "advanced_unpaid_checkout_visible",
    required: true,
    userVisibleOutcome: "checkout",
    backendContract: "Unpaid Advanced must return payment_required/checkout_required instead of silently failing or leaking Advanced output.",
    noDeadClickRule: "Unpaid Advanced click must show secure checkout/loading copy before redirecting.",
  },
  {
    id: "advanced_checkout_failure_visible_error",
    required: true,
    userVisibleOutcome: "error",
    backendContract: "Checkout popup failure, blocked popup or route failure must become a visible error state.",
    noDeadClickRule: "Advanced click must never disappear silently after a failed checkout attempt.",
  },
];

function checksumFor(parts: string[]) {
  let hash = 0;
  for (const part of parts.join("|")) {
    hash = (hash * 31 + part.charCodeAt(0)) >>> 0;
  }
  return `p2192-${hash.toString(16).padStart(8, "0")}`;
}

export function buildPass2192AdvancedClickRuntimeProof(args: {
  runtimeReceiptsCaptured?: boolean;
  staticRoutePresent?: boolean;
  staticClientNoticePresent?: boolean;
  staticClientGateFetchPresent?: boolean;
  failReason?: string;
} = {}): Pass2192AdvancedClickRuntimeProof {
  const staticPass = args.staticRoutePresent !== false && args.staticClientNoticePresent !== false && args.staticClientGateFetchPresent !== false && !args.failReason;
  const runtimeReceiptsCaptured = args.runtimeReceiptsCaptured === true;
  const status = args.failReason ? "FAIL" : runtimeReceiptsCaptured ? "PASS_RUNTIME" : staticPass ? "PASS_STATIC_ONLY" : "FAIL";
  const missingRuntimeReceipts = runtimeReceiptsCaptured
    ? []
    : [
        "real Basic click screenshot/receipt showing analysis overlay",
        "real Pro click screenshot/receipt showing analysis overlay",
        "Advanced unpaid click receipt showing checkout_required state",
        "Advanced local demo receipt showing VLM overlay when env unlock is enabled",
        "Advanced paid entitlement receipt showing paid analysis overlay",
        "checkout failure receipt showing visible error state",
      ];

  return {
    schemaVersion: PASS2192_ADVANCED_CLICK_RUNTIME_PROOF_ID,
    passId: "PASS2192",
    generatedAt: new Date().toISOString(),
    status,
    runtimeReceiptsCaptured,
    clickStates: PASS2192_REQUIRED_CLICK_STATES,
    publicBoundary: [
      "This pass proves the click contract and static UI/runtime routing, not a real browser screenshot in the sandbox.",
      "Advanced must be fail-closed without paid entitlement, except explicit local-demo mode outside production.",
      "Every click must produce loading, analysis, checkout or visible error; silent no-op is a blocker.",
    ],
    freeVsPaidBoundary: [
      "Basic stays free; Pro and Advanced require server-side paid entitlement.",
      "Pro and Advanced require server-side entitlement; explicit local demo mode may be used only outside production.",
      "Wallet connect alone never unlocks Pro or Advanced.",
      "Free tiers must not receive Advanced evidence ledger, proof capsule or operator appendix.",
    ],
    localDemoBoundary: [
      "Use the server demo checkout/verify flow only in local development; never bypass the entitlement record.",
      "Do not use NEXT_PUBLIC secret values for paid access keys.",
      "Production and Vercel production ignore local demo unlock and require durable paid entitlement.",
    ],
    missingRuntimeReceipts,
    checksum: checksumFor([
      status,
      String(runtimeReceiptsCaptured),
      ...PASS2192_REQUIRED_CLICK_STATES.map((state) => `${state.id}:${state.userVisibleOutcome}`),
      ...(args.failReason ? [args.failReason] : []),
    ]),
  };
}
