export type Pass2917RevalidationExecutionState =
  | "pass2916_final_seal_exists_or_pending"
  | "scheduled_revalidation_job_required"
  | "missed_revalidation_auto_downgrade_required"
  | "fresh_receipt_revalidation_required"
  | "customer_visible_degraded_status_required"
  | "append_only_revalidation_breach_history_required";

export type Pass2917RevalidationSurface =
  | "pass2916_final_seal_link"
  | "shield_revalidation_receipts"
  | "realmarkets_revalidation_receipts"
  | "pdf_tier_revalidation_receipts"
  | "payment_entitlement_revalidation_receipts"
  | "provider_freshness_revalidation_receipts"
  | "scheduled_job_execution"
  | "missed_sla_auto_downgrade"
  | "customer_visible_degraded_board"
  | "append_only_breach_history";

export type Pass2917RevalidationStatus =
  | "missing"
  | "pass2916_final_seal_link_required"
  | "scheduled_job_required"
  | "fresh_revalidation_receipt_required"
  | "auto_downgrade_required"
  | "customer_degraded_board_required"
  | "accepted_only_as_degraded_revalidation_candidate";

export type Pass2917RevalidationRequirement = {
  readonly id: string;
  readonly surface: Pass2917RevalidationSurface;
  readonly publicLabel: string;
  readonly revalidationStatus: Pass2917RevalidationStatus;
  readonly customerVisibleExplanation: string;
  readonly proofSurface: "lineage" | "shield" | "realmarkets" | "pdf" | "payment" | "provider" | "scheduler" | "downgrade" | "public_board" | "history";
  readonly canKeepRestoredTrust: false;
  readonly canShowGreenBadge: false;
  readonly canClaimWorldClassLive: false;
  readonly requiresFreshExecutionReceipt: true;
  readonly requiresAutomaticDowngradeOnMiss: true;
};

export type Pass2917RevalidationFinding = {
  readonly surface: Pass2917RevalidationSurface;
  readonly severity: "P0" | "P1";
  readonly executionStatus:
    | "NO_GO"
    | "PASS2916_FINAL_SEAL_LINK_REQUIRED"
    | "SCHEDULED_JOB_REQUIRED"
    | "FRESH_RECEIPTS_REQUIRED"
    | "AUTO_DOWNGRADE_REQUIRED"
    | "CUSTOMER_BOARD_REQUIRED";
  readonly customerFacingCopy: string;
  readonly canBypassRevalidation: false;
};

export type Pass2917ScheduledRevalidationExecutionBreachGate = {
  readonly pass: 2917;
  readonly state: readonly Pass2917RevalidationExecutionState[];
  readonly hardRule: string;
  readonly previousFinalSealGate: "scripts/pass2916-renewal-promotion-final-seal.mjs";
  readonly revalidationExecutionScript: "scripts/pass2917-scheduled-revalidation-execution-breach.mjs";
  readonly revalidationExecutionSpec: "tests/e2e/pass2917-scheduled-revalidation-execution-breach.spec.ts";
  readonly defaultProductionDecision: "NO_GO";
  readonly publicClaimStatus: "NO_GO_PUBLIC_RECEIPTS_REQUIRED";
  readonly finalSealStatus: "NO_GO_RENEWAL_PROMOTION_FINAL_SEAL_REQUIRED";
  readonly scheduledRevalidationStatus: "NO_GO_SCHEDULED_REVALIDATION_REQUIRED";
  readonly revalidationExecutionStatus: "NO_GO_SCHEDULED_REVALIDATION_EXECUTION_REQUIRED";
  readonly revalidationBreachStatus: "NO_GO_REVALIDATION_BREACH_AUTO_DOWNGRADE_REQUIRED";
  readonly degradedPublicTrustStatus: "NO_GO_PUBLIC_TRUST_DEGRADED_REVALIDATION_MISSED";
  readonly finalSealEndpoint: "/api/market-integrity/renewal-promotion-final-seal";
  readonly revalidationExecutionEndpoint: "/api/market-integrity/scheduled-revalidation-execution-breach";
  readonly canClaimCleanTypecheck: false;
  readonly canClaimCleanBuild: false;
  readonly canClaimWorldClassLive: false;
  readonly canShowGreenProductionBadge: false;
  readonly canKeepRestoredTrust: false;
  readonly canIgnoreMissedRevalidation: false;
  readonly canManuallyKeepGreenOnBreach: false;
  readonly canUseOldFinalSealAsCurrentProof: false;
  readonly canHideDegradedStatusFromCustomers: false;
  readonly canRewriteRevalidationHistory: false;
  readonly pass2916FinalSealDigestRequired: true;
  readonly scheduledJobExecutionReceiptRequired: true;
  readonly freshRevalidationReceiptsRequired: true;
  readonly automaticDowngradeOnMissRequired: true;
  readonly customerVisibleDegradedBoardRequired: true;
  readonly appendOnlyBreachHistoryRequired: true;
  readonly missedRevalidationGraceMinutes: 0;
  readonly revalidationCadenceHours: 24;
  readonly breachDowngradeMode: "fail_closed_immediate";
  readonly requiredSurfaces: readonly string[];
  readonly requirements: readonly Pass2917RevalidationRequirement[];
  readonly findings: readonly Pass2917RevalidationFinding[];
  readonly revalidationExecutionAcceptanceGates: readonly string[];
  readonly nextPassRecommendation: string;
};

export const PASS2917_SCHEDULED_REVALIDATION_EXECUTION_REQUIREMENTS: readonly Pass2917RevalidationRequirement[] = [
  {
    id: "pass2916_final_seal_digest_must_link_before_revalidation_execution",
    surface: "pass2916_final_seal_link",
    publicLabel: "PASS2916 final seal linkage",
    revalidationStatus: "pass2916_final_seal_link_required",
    customerVisibleExplanation: "Scheduled revalidation cannot start from an unsealed or copied restore candidate; it must link to the PASS2916 final seal digest.",
    proofSurface: "lineage",
    canKeepRestoredTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresFreshExecutionReceipt: true,
    requiresAutomaticDowngradeOnMiss: true,
  },
  {
    id: "shield_revalidation_requires_fresh_rows_chart_mobile_execution_receipts",
    surface: "shield_revalidation_receipts",
    publicLabel: "Shield scheduled revalidation receipts",
    revalidationStatus: "fresh_revalidation_receipt_required",
    customerVisibleExplanation: "Shield restored trust expires unless rows >10, no forced highlight, desktop chart and mobile safe-area receipts are freshly revalidated on schedule.",
    proofSurface: "shield",
    canKeepRestoredTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresFreshExecutionReceipt: true,
    requiresAutomaticDowngradeOnMiss: true,
  },
  {
    id: "realmarkets_revalidation_requires_fresh_icons_chart_no_underlay_receipts",
    surface: "realmarkets_revalidation_receipts",
    publicLabel: "Real Markets scheduled revalidation receipts",
    revalidationStatus: "fresh_revalidation_receipt_required",
    customerVisibleExplanation: "Real Markets restored trust expires unless AAPL/NVDA/ADIDAS/BINANCE/MEXC icons and chart/no-underlay receipts are freshly revalidated on schedule.",
    proofSurface: "realmarkets",
    canKeepRestoredTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresFreshExecutionReceipt: true,
    requiresAutomaticDowngradeOnMiss: true,
  },
  {
    id: "pdf_tier_revalidation_requires_fresh_preview_download_hashes",
    surface: "pdf_tier_revalidation_receipts",
    publicLabel: "BTC/AAPL PDF tier scheduled revalidation",
    revalidationStatus: "fresh_revalidation_receipt_required",
    customerVisibleExplanation: "BTC Shield and AAPL Real Markets Basic/Pro/Advanced PDF preview/download parity must be freshly revalidated after restore.",
    proofSurface: "pdf",
    canKeepRestoredTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresFreshExecutionReceipt: true,
    requiresAutomaticDowngradeOnMiss: true,
  },
  {
    id: "payment_entitlement_revalidation_requires_server_receipts_not_wallet_identity",
    surface: "payment_entitlement_revalidation_receipts",
    publicLabel: "Payment entitlement scheduled revalidation",
    revalidationStatus: "fresh_revalidation_receipt_required",
    customerVisibleExplanation: "Advanced access must keep proving server-side entitlement receipts; wallet identity alone cannot renew restored trust.",
    proofSurface: "payment",
    canKeepRestoredTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresFreshExecutionReceipt: true,
    requiresAutomaticDowngradeOnMiss: true,
  },
  {
    id: "provider_freshness_revalidation_requires_live_quorum_timeout_receipts",
    surface: "provider_freshness_revalidation_receipts",
    publicLabel: "Provider freshness scheduled revalidation",
    revalidationStatus: "fresh_revalidation_receipt_required",
    customerVisibleExplanation: "Provider quorum, freshness and timeout fallback receipts must be renewed on schedule or public trust is degraded.",
    proofSurface: "provider",
    canKeepRestoredTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresFreshExecutionReceipt: true,
    requiresAutomaticDowngradeOnMiss: true,
  },
  {
    id: "scheduled_job_execution_receipt_must_exist_before_restored_trust_can_continue",
    surface: "scheduled_job_execution",
    publicLabel: "Scheduled job execution receipt",
    revalidationStatus: "scheduled_job_required",
    customerVisibleExplanation: "A scheduled revalidation plan is not enough; the job execution receipt must exist and be hash-bound.",
    proofSurface: "scheduler",
    canKeepRestoredTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresFreshExecutionReceipt: true,
    requiresAutomaticDowngradeOnMiss: true,
  },
  {
    id: "missed_sla_must_auto_downgrade_public_status_fail_closed",
    surface: "missed_sla_auto_downgrade",
    publicLabel: "Missed SLA auto-downgrade",
    revalidationStatus: "auto_downgrade_required",
    customerVisibleExplanation: "If scheduled revalidation misses its window, public trust must degrade immediately; operators cannot keep a green badge manually.",
    proofSurface: "downgrade",
    canKeepRestoredTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresFreshExecutionReceipt: true,
    requiresAutomaticDowngradeOnMiss: true,
  },
  {
    id: "customer_visible_degraded_board_must_show_revalidation_miss",
    surface: "customer_visible_degraded_board",
    publicLabel: "Customer-visible degraded board",
    revalidationStatus: "customer_degraded_board_required",
    customerVisibleExplanation: "Customers must see that restored trust is degraded when scheduled revalidation is missed or stale.",
    proofSurface: "public_board",
    canKeepRestoredTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresFreshExecutionReceipt: true,
    requiresAutomaticDowngradeOnMiss: true,
  },
  {
    id: "append_only_breach_history_must_preserve_every_miss_and_downgrade",
    surface: "append_only_breach_history",
    publicLabel: "Append-only revalidation breach history",
    revalidationStatus: "auto_downgrade_required",
    customerVisibleExplanation: "Every missed revalidation, downgrade and later renewal attempt must be appended without rewriting previous trust history.",
    proofSurface: "history",
    canKeepRestoredTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresFreshExecutionReceipt: true,
    requiresAutomaticDowngradeOnMiss: true,
  },
];

export const PASS2917_SCHEDULED_REVALIDATION_EXECUTION_FINDINGS: readonly Pass2917RevalidationFinding[] = [
  {
    surface: "pass2916_final_seal_link",
    severity: "P0",
    executionStatus: "PASS2916_FINAL_SEAL_LINK_REQUIRED",
    customerFacingCopy: "Scheduled revalidation execution is blocked until PASS2916 final seal digest is linked.",
    canBypassRevalidation: false,
  },
  {
    surface: "scheduled_job_execution",
    severity: "P0",
    executionStatus: "SCHEDULED_JOB_REQUIRED",
    customerFacingCopy: "The scheduled revalidation job has no fresh execution receipt; restored trust cannot continue.",
    canBypassRevalidation: false,
  },
  {
    surface: "missed_sla_auto_downgrade",
    severity: "P0",
    executionStatus: "AUTO_DOWNGRADE_REQUIRED",
    customerFacingCopy: "Missed revalidation must immediately degrade public trust and keep green/world-class-live badges blocked.",
    canBypassRevalidation: false,
  },
  {
    surface: "shield_revalidation_receipts",
    severity: "P1",
    executionStatus: "FRESH_RECEIPTS_REQUIRED",
    customerFacingCopy: "Shield restore must be renewed with fresh rows/chart/mobile receipts.",
    canBypassRevalidation: false,
  },
  {
    surface: "customer_visible_degraded_board",
    severity: "P1",
    executionStatus: "CUSTOMER_BOARD_REQUIRED",
    customerFacingCopy: "A degraded public board is required so customers can see why trust was downgraded.",
    canBypassRevalidation: false,
  },
];

export function buildPass2917ScheduledRevalidationExecutionBreachGate(): Pass2917ScheduledRevalidationExecutionBreachGate {
  return {
    pass: 2917,
    state: [
      "pass2916_final_seal_exists_or_pending",
      "scheduled_revalidation_job_required",
      "missed_revalidation_auto_downgrade_required",
      "fresh_receipt_revalidation_required",
      "customer_visible_degraded_status_required",
      "append_only_revalidation_breach_history_required",
    ],
    hardRule: "Scheduled revalidation must actually execute. If the job misses its window, any restored public trust is automatically downgraded to degraded/NO_GO; operators cannot keep green status by hand or reuse the old final seal as current proof.",
    previousFinalSealGate: "scripts/pass2916-renewal-promotion-final-seal.mjs",
    revalidationExecutionScript: "scripts/pass2917-scheduled-revalidation-execution-breach.mjs",
    revalidationExecutionSpec: "tests/e2e/pass2917-scheduled-revalidation-execution-breach.spec.ts",
    defaultProductionDecision: "NO_GO",
    publicClaimStatus: "NO_GO_PUBLIC_RECEIPTS_REQUIRED",
    finalSealStatus: "NO_GO_RENEWAL_PROMOTION_FINAL_SEAL_REQUIRED",
    scheduledRevalidationStatus: "NO_GO_SCHEDULED_REVALIDATION_REQUIRED",
    revalidationExecutionStatus: "NO_GO_SCHEDULED_REVALIDATION_EXECUTION_REQUIRED",
    revalidationBreachStatus: "NO_GO_REVALIDATION_BREACH_AUTO_DOWNGRADE_REQUIRED",
    degradedPublicTrustStatus: "NO_GO_PUBLIC_TRUST_DEGRADED_REVALIDATION_MISSED",
    finalSealEndpoint: "/api/market-integrity/renewal-promotion-final-seal",
    revalidationExecutionEndpoint: "/api/market-integrity/scheduled-revalidation-execution-breach",
    canClaimCleanTypecheck: false,
    canClaimCleanBuild: false,
    canClaimWorldClassLive: false,
    canShowGreenProductionBadge: false,
    canKeepRestoredTrust: false,
    canIgnoreMissedRevalidation: false,
    canManuallyKeepGreenOnBreach: false,
    canUseOldFinalSealAsCurrentProof: false,
    canHideDegradedStatusFromCustomers: false,
    canRewriteRevalidationHistory: false,
    pass2916FinalSealDigestRequired: true,
    scheduledJobExecutionReceiptRequired: true,
    freshRevalidationReceiptsRequired: true,
    automaticDowngradeOnMissRequired: true,
    customerVisibleDegradedBoardRequired: true,
    appendOnlyBreachHistoryRequired: true,
    missedRevalidationGraceMinutes: 0,
    revalidationCadenceHours: 24,
    breachDowngradeMode: "fail_closed_immediate",
    requiredSurfaces: ["pass2916-final-seal", "scheduler-execution", "shield", "realmarkets", "pdf-tier-parity", "payment-entitlement", "provider-freshness", "customer-degraded-board", "append-only-history"],
    requirements: PASS2917_SCHEDULED_REVALIDATION_EXECUTION_REQUIREMENTS,
    findings: PASS2917_SCHEDULED_REVALIDATION_EXECUTION_FINDINGS,
    revalidationExecutionAcceptanceGates: [
      "Link PASS2916 final seal digest before scheduled revalidation execution can be evaluated.",
      "Require a fresh scheduled job execution receipt; a plan alone is not proof.",
      "Renew Shield, Real Markets, BTC/AAPL PDF tier parity, payment entitlement and provider freshness receipts on schedule.",
      "Automatically downgrade public trust with zero grace when revalidation misses SLA or receipts expire.",
      "Expose customer-visible degraded status; do not hide a missed revalidation behind green copy.",
      "Append every miss, downgrade and later renewal attempt without rewriting revalidation history.",
    ],
    nextPassRecommendation: "PASS2918 should add revalidation recovery re-entry gate: after an automatic downgrade, recovery must re-enter escrow with fresh receipts instead of jumping directly back to restored trust.",
  };
}

export const PASS2917_SCHEDULED_REVALIDATION_EXECUTION_BREACH_GATE = buildPass2917ScheduledRevalidationExecutionBreachGate();
