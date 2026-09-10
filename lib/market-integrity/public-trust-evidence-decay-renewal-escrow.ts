export type Pass2914EvidenceDecayState =
  | "pass2913_post_restore_continuity_exists_or_pending"
  | "public_trust_evidence_decay_policy_required"
  | "renewal_escrow_required"
  | "receipt_age_matrix_required"
  | "customer_visible_degraded_status_required"
  | "public_trust_sustain_blocked_until_renewal_escrow_receipts";

export type Pass2914EvidenceDecayFamily =
  | "pass2913_post_restore_continuity_link"
  | "shield_evidence_age_renewal_receipts"
  | "realmarkets_evidence_age_renewal_receipts"
  | "pdf_tier_evidence_age_renewal_receipts"
  | "payment_entitlement_evidence_age_renewal_receipts"
  | "provider_freshness_evidence_age_renewal_receipts"
  | "receipt_age_matrix"
  | "renewal_escrow_digest"
  | "customer_visible_degraded_status"
  | "operator_renewal_attestation"
  | "append_only_evidence_decay_history";

export type Pass2914EvidenceDecayStatus =
  | "missing"
  | "post_restore_continuity_required"
  | "renewal_receipt_required"
  | "age_matrix_required"
  | "renewal_escrow_required"
  | "degraded_status_required"
  | "operator_attestation_required"
  | "accepted_for_renewal_escrow_candidate";

export type Pass2914EvidenceDecayRequirement = {
  readonly id: string;
  readonly family: Pass2914EvidenceDecayFamily;
  readonly publicLabel: string;
  readonly evidenceStatus: Pass2914EvidenceDecayStatus;
  readonly customerVisibleExplanation: string;
  readonly maxReceiptAgeMinutes: number;
  readonly canSustainPublicTrust: false;
  readonly canShowGreenBadge: false;
  readonly canClaimWorldClassLive: false;
  readonly requiresRenewalEscrow: true;
  readonly requiresReceiptAgeCheck: true;
};

export type Pass2914EvidenceDecayFinding = {
  readonly family: Pass2914EvidenceDecayFamily;
  readonly severity: "P0" | "P1";
  readonly decayStatus: "NO_GO" | "EVIDENCE_DECAY_POLICY_REQUIRED" | "RENEWAL_ESCROW_REQUIRED" | "CUSTOMER_DEGRADED_STATUS_REQUIRED" | "OPERATOR_ATTESTATION_REQUIRED";
  readonly customerFacingCopy: string;
  readonly canSilentlyExtendTrust: false;
};

export type Pass2914PublicTrustEvidenceDecayGate = {
  readonly pass: 2914;
  readonly state: readonly Pass2914EvidenceDecayState[];
  readonly hardRule: string;
  readonly previousPostRestoreContinuityGate: "scripts/pass2913-post-restore-continuity-monitor.mjs";
  readonly evidenceDecayRenewalEscrowScript: "scripts/pass2914-public-trust-evidence-decay-renewal-escrow.mjs";
  readonly evidenceDecayRenewalEscrowSpec: "tests/e2e/pass2914-public-trust-evidence-decay-renewal-escrow.spec.ts";
  readonly defaultProductionDecision: "NO_GO";
  readonly publicClaimStatus: "NO_GO_PUBLIC_RECEIPTS_REQUIRED";
  readonly postRestoreContinuityStatus: "NO_GO_POST_RESTORE_CONTINUITY_MONITOR_REQUIRED";
  readonly publicTrustEvidenceDecayStatus: "NO_GO_PUBLIC_TRUST_EVIDENCE_DECAY_RENEWAL_REQUIRED";
  readonly renewalEscrowStatus: "NO_GO_RENEWAL_ESCROW_REQUIRED";
  readonly postRestoreContinuityEndpoint: "/api/market-integrity/post-restore-continuity-monitor";
  readonly evidenceDecayRenewalEscrowEndpoint: "/api/market-integrity/public-trust-evidence-decay-renewal-escrow";
  readonly canClaimCleanTypecheck: false;
  readonly canClaimCleanBuild: false;
  readonly canClaimWorldClassLive: false;
  readonly canShowGreenProductionBadge: false;
  readonly canSustainPublicTrust: false;
  readonly canAutoRenewPublicTrust: false;
  readonly canUseStableStatusAloneAsFreshProof: false;
  readonly canSilentlyExtendTrustWindow: false;
  readonly canHideEvidenceDecayFromCustomers: false;
  readonly canRewriteEvidenceAgeHistory: false;
  readonly freshRenewalReceiptRollupRequired: true;
  readonly receiptAgeMatrixRequired: true;
  readonly renewalEscrowDigestRequired: true;
  readonly customerVisibleDegradedStatusRequired: true;
  readonly operatorRenewalAttestationRequired: true;
  readonly appendOnlyEvidenceDecayHistoryRequired: true;
  readonly evidenceMaxAgeMinutes: 1440;
  readonly renewalEscrowWindowHours: 72;
  readonly requirements: readonly Pass2914EvidenceDecayRequirement[];
  readonly findings: readonly Pass2914EvidenceDecayFinding[];
  readonly evidenceDecayRenewalAcceptanceGates: readonly string[];
  readonly nextPassRecommendation: string;
};

export const PASS2914_PUBLIC_TRUST_EVIDENCE_DECAY_REQUIREMENTS: readonly Pass2914EvidenceDecayRequirement[] = [
  {
    id: "pass2913_post_restore_continuity_must_link_before_evidence_decay_renewal",
    family: "pass2913_post_restore_continuity_link",
    publicLabel: "PASS2913 post-restore continuity linkage",
    evidenceStatus: "post_restore_continuity_required",
    customerVisibleExplanation: "Evidence renewal cannot start from marketing copy or a static public board; it must link to the PASS2913 continuity monitor digest.",
    maxReceiptAgeMinutes: 1440,
    canSustainPublicTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresRenewalEscrow: true,
    requiresReceiptAgeCheck: true,
  },
  {
    id: "shield_evidence_age_requires_rows_chart_mobile_renewal_receipts",
    family: "shield_evidence_age_renewal_receipts",
    publicLabel: "Shield evidence age renewal receipts",
    evidenceStatus: "renewal_receipt_required",
    customerVisibleExplanation: "Shield trust evidence expires unless rows >10, no forced highlight, desktop chart and mobile safe-area receipts are freshly renewed into escrow.",
    maxReceiptAgeMinutes: 1440,
    canSustainPublicTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresRenewalEscrow: true,
    requiresReceiptAgeCheck: true,
  },
  {
    id: "realmarkets_evidence_age_requires_icons_chart_no_underlay_renewal_receipts",
    family: "realmarkets_evidence_age_renewal_receipts",
    publicLabel: "Real Markets evidence age renewal receipts",
    evidenceStatus: "renewal_receipt_required",
    customerVisibleExplanation: "Real Markets trust evidence expires unless AAPL/NVDA/ADIDAS/BINANCE/MEXC icons and chart/no-underlay receipts are freshly renewed into escrow.",
    maxReceiptAgeMinutes: 1440,
    canSustainPublicTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresRenewalEscrow: true,
    requiresReceiptAgeCheck: true,
  },
  {
    id: "pdf_tier_evidence_age_requires_btc_aapl_preview_download_renewal_receipts",
    family: "pdf_tier_evidence_age_renewal_receipts",
    publicLabel: "BTC/AAPL PDF tier evidence age renewal",
    evidenceStatus: "renewal_receipt_required",
    customerVisibleExplanation: "BTC Shield and AAPL Real Markets Basic/Pro/Advanced PDF parity evidence expires unless preview/download hashes are freshly renewed into escrow.",
    maxReceiptAgeMinutes: 1440,
    canSustainPublicTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresRenewalEscrow: true,
    requiresReceiptAgeCheck: true,
  },
  {
    id: "payment_entitlement_evidence_age_requires_server_side_renewal_receipts",
    family: "payment_entitlement_evidence_age_renewal_receipts",
    publicLabel: "Payment entitlement evidence age renewal",
    evidenceStatus: "renewal_receipt_required",
    customerVisibleExplanation: "Stripe/BLIK/Web3 entitlement evidence expires unless server-side receipts are freshly renewed; wallet identity alone is not proof.",
    maxReceiptAgeMinutes: 1440,
    canSustainPublicTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresRenewalEscrow: true,
    requiresReceiptAgeCheck: true,
  },
  {
    id: "provider_freshness_evidence_age_requires_quorum_timeout_renewal_receipts",
    family: "provider_freshness_evidence_age_renewal_receipts",
    publicLabel: "Provider freshness evidence age renewal",
    evidenceStatus: "renewal_receipt_required",
    customerVisibleExplanation: "Provider quorum, freshness and timeout evidence expires unless fresh live-provider receipts are renewed into escrow.",
    maxReceiptAgeMinutes: 1440,
    canSustainPublicTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresRenewalEscrow: true,
    requiresReceiptAgeCheck: true,
  },
  {
    id: "receipt_age_matrix_must_classify_fresh_stale_missing_and_rejected_evidence",
    family: "receipt_age_matrix",
    publicLabel: "Receipt age matrix",
    evidenceStatus: "age_matrix_required",
    customerVisibleExplanation: "The public status board must classify every receipt as fresh, stale, missing or rejected; unknown age cannot sustain trust.",
    maxReceiptAgeMinutes: 1440,
    canSustainPublicTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresRenewalEscrow: true,
    requiresReceiptAgeCheck: true,
  },
  {
    id: "renewal_escrow_digest_must_bind_all_fresh_receipts_before_public_trust_extension",
    family: "renewal_escrow_digest",
    publicLabel: "Renewal escrow digest",
    evidenceStatus: "renewal_escrow_required",
    customerVisibleExplanation: "Fresh receipts must be bound into a renewal escrow digest before public trust can be extended.",
    maxReceiptAgeMinutes: 1440,
    canSustainPublicTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresRenewalEscrow: true,
    requiresReceiptAgeCheck: true,
  },
  {
    id: "customer_visible_degraded_status_must_show_when_evidence_decays",
    family: "customer_visible_degraded_status",
    publicLabel: "Customer-visible degraded status",
    evidenceStatus: "degraded_status_required",
    customerVisibleExplanation: "If evidence ages out, customers must see degraded/renewal-required status instead of a hidden downgrade.",
    maxReceiptAgeMinutes: 1440,
    canSustainPublicTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresRenewalEscrow: true,
    requiresReceiptAgeCheck: true,
  },
  {
    id: "operator_renewal_attestation_must_acknowledge_evidence_decay_and_no_auto_renewal",
    family: "operator_renewal_attestation",
    publicLabel: "Operator renewal attestation",
    evidenceStatus: "operator_attestation_required",
    customerVisibleExplanation: "The operator must sign that evidence decays and public trust cannot auto-renew without fresh escrow-bound receipts.",
    maxReceiptAgeMinutes: 1440,
    canSustainPublicTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresRenewalEscrow: true,
    requiresReceiptAgeCheck: true,
  },
  {
    id: "append_only_evidence_decay_history_must_preserve_all_age_and_renewal_events",
    family: "append_only_evidence_decay_history",
    publicLabel: "Append-only evidence decay history",
    evidenceStatus: "age_matrix_required",
    customerVisibleExplanation: "Evidence age, stale detections and renewals must be appended without rewriting old proof history.",
    maxReceiptAgeMinutes: 1440,
    canSustainPublicTrust: false,
    canShowGreenBadge: false,
    canClaimWorldClassLive: false,
    requiresRenewalEscrow: true,
    requiresReceiptAgeCheck: true,
  },
];

export const PASS2914_PUBLIC_TRUST_EVIDENCE_DECAY_FINDINGS: readonly Pass2914EvidenceDecayFinding[] = [
  {
    family: "pass2913_post_restore_continuity_link",
    severity: "P0",
    decayStatus: "EVIDENCE_DECAY_POLICY_REQUIRED",
    customerFacingCopy: "Public trust renewal is blocked until the PASS2913 post-restore continuity digest is linked.",
    canSilentlyExtendTrust: false,
  },
  {
    family: "receipt_age_matrix",
    severity: "P0",
    decayStatus: "EVIDENCE_DECAY_POLICY_REQUIRED",
    customerFacingCopy: "Public trust cannot be extended until every required receipt has an age classification.",
    canSilentlyExtendTrust: false,
  },
  {
    family: "renewal_escrow_digest",
    severity: "P0",
    decayStatus: "RENEWAL_ESCROW_REQUIRED",
    customerFacingCopy: "Fresh receipts must be locked into renewal escrow before any trust extension.",
    canSilentlyExtendTrust: false,
  },
  {
    family: "customer_visible_degraded_status",
    severity: "P1",
    decayStatus: "CUSTOMER_DEGRADED_STATUS_REQUIRED",
    customerFacingCopy: "If evidence decays, customers must see renewal-required/degraded status instead of a silent downgrade.",
    canSilentlyExtendTrust: false,
  },
  {
    family: "operator_renewal_attestation",
    severity: "P1",
    decayStatus: "OPERATOR_ATTESTATION_REQUIRED",
    customerFacingCopy: "Operator renewal attestation is required before public trust can be extended.",
    canSilentlyExtendTrust: false,
  },
];

export function buildPass2914PublicTrustEvidenceDecayGate(): Pass2914PublicTrustEvidenceDecayGate {
  return {
    pass: 2914,
    state: [
      "pass2913_post_restore_continuity_exists_or_pending",
      "public_trust_evidence_decay_policy_required",
      "renewal_escrow_required",
      "receipt_age_matrix_required",
      "customer_visible_degraded_status_required",
      "public_trust_sustain_blocked_until_renewal_escrow_receipts",
    ],
    hardRule: "Stable public status is not permanent proof. Public trust evidence decays after the TTL and can only be renewed by fresh escrow-bound receipts, customer-visible age status and operator attestation.",
    previousPostRestoreContinuityGate: "scripts/pass2913-post-restore-continuity-monitor.mjs",
    evidenceDecayRenewalEscrowScript: "scripts/pass2914-public-trust-evidence-decay-renewal-escrow.mjs",
    evidenceDecayRenewalEscrowSpec: "tests/e2e/pass2914-public-trust-evidence-decay-renewal-escrow.spec.ts",
    defaultProductionDecision: "NO_GO",
    publicClaimStatus: "NO_GO_PUBLIC_RECEIPTS_REQUIRED",
    postRestoreContinuityStatus: "NO_GO_POST_RESTORE_CONTINUITY_MONITOR_REQUIRED",
    publicTrustEvidenceDecayStatus: "NO_GO_PUBLIC_TRUST_EVIDENCE_DECAY_RENEWAL_REQUIRED",
    renewalEscrowStatus: "NO_GO_RENEWAL_ESCROW_REQUIRED",
    postRestoreContinuityEndpoint: "/api/market-integrity/post-restore-continuity-monitor",
    evidenceDecayRenewalEscrowEndpoint: "/api/market-integrity/public-trust-evidence-decay-renewal-escrow",
    canClaimCleanTypecheck: false,
    canClaimCleanBuild: false,
    canClaimWorldClassLive: false,
    canShowGreenProductionBadge: false,
    canSustainPublicTrust: false,
    canAutoRenewPublicTrust: false,
    canUseStableStatusAloneAsFreshProof: false,
    canSilentlyExtendTrustWindow: false,
    canHideEvidenceDecayFromCustomers: false,
    canRewriteEvidenceAgeHistory: false,
    freshRenewalReceiptRollupRequired: true,
    receiptAgeMatrixRequired: true,
    renewalEscrowDigestRequired: true,
    customerVisibleDegradedStatusRequired: true,
    operatorRenewalAttestationRequired: true,
    appendOnlyEvidenceDecayHistoryRequired: true,
    evidenceMaxAgeMinutes: 1440,
    renewalEscrowWindowHours: 72,
    requirements: PASS2914_PUBLIC_TRUST_EVIDENCE_DECAY_REQUIREMENTS,
    findings: PASS2914_PUBLIC_TRUST_EVIDENCE_DECAY_FINDINGS,
    evidenceDecayRenewalAcceptanceGates: [
      "Link PASS2913 post-restore continuity digest before renewal escrow starts.",
      "Classify Shield, Real Markets, PDF, payment and provider receipts by age.",
      "Reject stale, missing, copied or manually edited receipts from renewal escrow.",
      "Publish customer-visible degraded/renewal-required status while evidence is stale.",
      "Require operator renewal attestation before any public trust extension.",
      "Keep green/world-class-live badge blocked until live build/browser/PDF/payment/provider receipts are fresh and escrow-bound.",
    ],
    nextPassRecommendation: "PASS2915 should add renewal-escrow promotion quarantine: accepted renewal candidates remain quarantined until independent replay verifies the fresh receipts across browser, PDF, payment and provider surfaces.",
  };
}

export const PASS2914_PUBLIC_TRUST_EVIDENCE_DECAY_GATE = buildPass2914PublicTrustEvidenceDecayGate();
