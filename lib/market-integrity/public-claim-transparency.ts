export type Pass2905PublicClaimTransparencyState =
  | "customer_verifiable_status_contract_ready"
  | "public_claim_must_match_no_go_state"
  | "receipt_matrix_visible_without_secrets"
  | "marketing_copy_firewall_active"
  | "operator_status_attestation_required"
  | "green_badge_blocked_until_live_receipts";

export type Pass2905PublicClaimTransparencyFamily =
  | "public_status_api"
  | "customer_verifiable_receipt_matrix"
  | "marketing_claim_copy"
  | "expiry_and_renewal_visibility"
  | "operator_attestation_visibility"
  | "shield_public_status"
  | "realmarkets_public_status"
  | "pdf_report_public_status"
  | "payment_entitlement_public_status"
  | "provider_freshness_public_status";

export type Pass2905PublicReceiptStatus =
  | "missing"
  | "prepared_contract_only"
  | "stale_or_not_runtime_bound"
  | "fresh_runtime_receipt_required"
  | "verified_live_receipt";

export type Pass2905PublicClaimRequirement = {
  readonly id: string;
  readonly family: Pass2905PublicClaimTransparencyFamily;
  readonly publicLabel: string;
  readonly publicStatus: Pass2905PublicReceiptStatus;
  readonly customerVisibleExplanation: string;
  readonly secretSafe: true;
  readonly requiredBeforeGreenBadge: true;
};

export type Pass2905PublicClaimFinding = {
  readonly family: Pass2905PublicClaimTransparencyFamily;
  readonly severity: "P0" | "P1";
  readonly currentPublicStatus: "NO_GO" | "RENEWAL_REQUIRED" | "CONTRACT_PREPARED" | "RUNTIME_RECEIPT_REQUIRED";
  readonly customerFacingCopy: string;
  readonly canShowAsProductionReady: false;
};

export type Pass2905PublicClaimTransparencyGate = {
  readonly pass: 2905;
  readonly state: readonly Pass2905PublicClaimTransparencyState[];
  readonly hardRule: string;
  readonly previousExpiryGate: "scripts/pass2904-claim-expiry-renewal.mjs";
  readonly transparencyScript: "scripts/pass2905-public-claim-transparency.mjs";
  readonly transparencySpec: "tests/e2e/pass2905-public-claim-transparency.spec.ts";
  readonly defaultProductionDecision: "NO_GO";
  readonly publicClaimStatus: "NO_GO_PUBLIC_RECEIPTS_REQUIRED";
  readonly canClaimCleanTypecheck: false;
  readonly canClaimCleanBuild: false;
  readonly canClaimWorldClassLive: false;
  readonly canShowGreenProductionBadge: false;
  readonly canShowWorldClassLiveBadge: false;
  readonly canHideMissingReceiptsFromCustomer: false;
  readonly canUseMarketingCopyAsProof: false;
  readonly publicStatusEndpoint: "/api/market-integrity/public-claim-transparency";
  readonly publicStatusRefreshMinutes: 60;
  readonly claimExpiryMinutes: 1440;
  readonly secretRedactionRequired: true;
  readonly requirements: readonly Pass2905PublicClaimRequirement[];
  readonly findings: readonly Pass2905PublicClaimFinding[];
  readonly publicAcceptanceGates: readonly string[];
  readonly nextPassRecommendation: string;
};

export const PASS2905_PUBLIC_CLAIM_REQUIREMENTS: readonly Pass2905PublicClaimRequirement[] = [
  {
    id: "public_status_api_must_report_no_go_until_receipts_exist",
    family: "public_status_api",
    publicLabel: "Public release status API",
    publicStatus: "prepared_contract_only",
    customerVisibleExplanation: "The public status API is prepared, but it must keep NO_GO until live install/typecheck/build/browser/PDF/payment/provider receipts are uploaded and verified.",
    secretSafe: true,
    requiredBeforeGreenBadge: true,
  },
  {
    id: "shield_public_receipts_must_show_rows_chart_mobile_state",
    family: "shield_public_status",
    publicLabel: "Shield rows, chart and mobile receipts",
    publicStatus: "fresh_runtime_receipt_required",
    customerVisibleExplanation: "Shield must publish customer-safe proof for rows >10, no forced highlight, right chart/skeleton and mobile safe-area chart before any green production badge.",
    secretSafe: true,
    requiredBeforeGreenBadge: true,
  },
  {
    id: "realmarkets_public_receipts_must_show_icons_and_no_underlay",
    family: "realmarkets_public_status",
    publicLabel: "Real Markets icon/chart receipts",
    publicStatus: "fresh_runtime_receipt_required",
    customerVisibleExplanation: "Real Markets must publish safe proof for AAPL/NVDA/ADIDAS/BINANCE/MEXC icons, clean chart skeleton and no grey underlay.",
    secretSafe: true,
    requiredBeforeGreenBadge: true,
  },
  {
    id: "pdf_public_receipts_must_show_btc_aapl_tier_hashes",
    family: "pdf_report_public_status",
    publicLabel: "BTC/AAPL PDF tier parity receipts",
    publicStatus: "fresh_runtime_receipt_required",
    customerVisibleExplanation: "BTC Shield and AAPL Real Markets Basic/Pro/Advanced preview/download hashes must be visible as receipt status without exposing private customer data.",
    secretSafe: true,
    requiredBeforeGreenBadge: true,
  },
  {
    id: "payment_public_receipts_must_be_server_side",
    family: "payment_entitlement_public_status",
    publicLabel: "Server-side entitlement receipts",
    publicStatus: "fresh_runtime_receipt_required",
    customerVisibleExplanation: "Advanced unlock must show server-side payment/entitlement receipt status. Wallet identity alone is displayed as identity, never proof of payment.",
    secretSafe: true,
    requiredBeforeGreenBadge: true,
  },
  {
    id: "provider_public_receipts_must_show_freshness_quorum",
    family: "provider_freshness_public_status",
    publicLabel: "Provider freshness/quorum receipts",
    publicStatus: "fresh_runtime_receipt_required",
    customerVisibleExplanation: "Provider freshness, quorum and timeout fallback state must be visible. Repeated failed-to-fetch or stale data keeps NO_GO.",
    secretSafe: true,
    requiredBeforeGreenBadge: true,
  },
  {
    id: "marketing_copy_must_match_no_go_until_green_badge_allowed",
    family: "marketing_claim_copy",
    publicLabel: "Marketing copy firewall",
    publicStatus: "prepared_contract_only",
    customerVisibleExplanation: "Public copy may say prepared/tested/static-gated, but cannot say live production-ready or world-class-live until the public receipt matrix is green.",
    secretSafe: true,
    requiredBeforeGreenBadge: true,
  },
  {
    id: "expiry_renewal_state_must_be_customer_visible",
    family: "expiry_and_renewal_visibility",
    publicLabel: "Claim expiry and renewal state",
    publicStatus: "prepared_contract_only",
    customerVisibleExplanation: "Claim age, expiry window and renewal-required state must be visible so a customer can see when old evidence is no longer valid.",
    secretSafe: true,
    requiredBeforeGreenBadge: true,
  },
];

export function buildPass2905PublicClaimTransparencyGate(): Pass2905PublicClaimTransparencyGate {
  const findings: readonly Pass2905PublicClaimFinding[] = [
    {
      family: "public_status_api",
      severity: "P0",
      currentPublicStatus: "CONTRACT_PREPARED",
      customerFacingCopy: "Velmere release status is publicly verifiable, but current state remains NO_GO until runtime receipts exist.",
      canShowAsProductionReady: false,
    },
    {
      family: "customer_verifiable_receipt_matrix",
      severity: "P0",
      currentPublicStatus: "RUNTIME_RECEIPT_REQUIRED",
      customerFacingCopy: "The receipt matrix must show missing runtime receipts plainly; missing proof cannot be hidden behind premium copy.",
      canShowAsProductionReady: false,
    },
    {
      family: "marketing_claim_copy",
      severity: "P0",
      currentPublicStatus: "NO_GO",
      customerFacingCopy: "World-class-live, production-ready and clean-build claims stay blocked until public receipt statuses are green.",
      canShowAsProductionReady: false,
    },
    {
      family: "expiry_and_renewal_visibility",
      severity: "P1",
      currentPublicStatus: "RENEWAL_REQUIRED",
      customerFacingCopy: "Claim expiry and renewal status must be shown instead of implied. Old screenshots/logs do not renew trust.",
      canShowAsProductionReady: false,
    },
  ];

  return {
    pass: 2905,
    state: [
      "customer_verifiable_status_contract_ready",
      "public_claim_must_match_no_go_state",
      "receipt_matrix_visible_without_secrets",
      "marketing_copy_firewall_active",
      "operator_status_attestation_required",
      "green_badge_blocked_until_live_receipts",
    ],
    hardRule:
      "public claim transparency gate: customer-facing status must mirror the release evidence state. No green production/world-class-live badge, no clean build claim and no production-ready copy may be shown until live runtime receipts are verified, unexpired and secret-redacted.",
    previousExpiryGate: "scripts/pass2904-claim-expiry-renewal.mjs",
    transparencyScript: "scripts/pass2905-public-claim-transparency.mjs",
    transparencySpec: "tests/e2e/pass2905-public-claim-transparency.spec.ts",
    defaultProductionDecision: "NO_GO",
    publicClaimStatus: "NO_GO_PUBLIC_RECEIPTS_REQUIRED",
    canClaimCleanTypecheck: false,
    canClaimCleanBuild: false,
    canClaimWorldClassLive: false,
    canShowGreenProductionBadge: false,
    canShowWorldClassLiveBadge: false,
    canHideMissingReceiptsFromCustomer: false,
    canUseMarketingCopyAsProof: false,
    publicStatusEndpoint: "/api/market-integrity/public-claim-transparency",
    publicStatusRefreshMinutes: 60,
    claimExpiryMinutes: 1440,
    secretRedactionRequired: true,
    requirements: PASS2905_PUBLIC_CLAIM_REQUIREMENTS,
    findings,
    publicAcceptanceGates: [
      "public status endpoint returns NO_GO_PUBLIC_RECEIPTS_REQUIRED until all live receipts are verified",
      "public receipt matrix includes Shield rows/chart/mobile state without exposing secrets",
      "public receipt matrix includes Real Markets icons/chart/no-underlay state without exposing secrets",
      "PDF tier parity status for BTC Shield and AAPL Real Markets is visible and hash-based",
      "server-side payment/entitlement status is visible; wallet identity is never proof of payment",
      "provider freshness/quorum/timeout status is visible and stale provider state blocks green badge",
      "claim expiry/renewal timestamp and expiry window are public and customer-readable",
      "public copy scan blocks production-ready/world-class-live/clean-build claims while receipts are missing",
      "operator attestation references the same public manifest digest",
      "no manual override can hide missing receipts from the customer-verifiable status endpoint",
    ],
    nextPassRecommendation:
      "PASS2906 should add the signed CI artifact upload API/schema that feeds customer-verifiable receipt statuses with runner identity, timestamps, sha256, signature and release-candidate binding.",
  };
}

export const PASS2905_PUBLIC_CLAIM_TRANSPARENCY_GATE = buildPass2905PublicClaimTransparencyGate();
