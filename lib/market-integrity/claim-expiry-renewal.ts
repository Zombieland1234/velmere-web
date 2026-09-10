export type Pass2904ClaimExpiryRenewalState =
  | "ci_artifact_ingestion_ready"
  | "production_claim_expiry_window_required"
  | "claim_renewal_requires_fresh_ci_artifacts"
  | "expired_claim_reopens_no_go"
  | "stale_ci_artifact_rejected"
  | "manual_claim_renewal_blocked";

export type Pass2904ClaimExpiryRenewalFamily =
  | "ci_artifact_ingestion"
  | "expiry_window"
  | "renewal_manifest"
  | "install_typecheck_build_receipts"
  | "playwright_visual_receipts"
  | "pdf_tier_parity_receipts"
  | "payment_entitlement_receipts"
  | "provider_freshness_receipts"
  | "shield_visual_receipts"
  | "realmarkets_visual_receipts"
  | "public_claim_copy_receipts"
  | "operator_dual_control";

export type Pass2904ClaimExpiryRenewalRequirement = {
  readonly id: string;
  readonly family: Pass2904ClaimExpiryRenewalFamily;
  readonly requiredArtifact: string;
  readonly maxAgeMinutes: number;
  readonly renewalRule: string;
  readonly rejectsStaleOrManualArtifact: true;
};

export type Pass2904ClaimExpiryRenewalFinding = {
  readonly family: Pass2904ClaimExpiryRenewalFamily;
  readonly severity: "P0" | "P1";
  readonly currentStatus:
    | "adapter_contract_prepared"
    | "fresh_ci_receipt_required"
    | "claim_expiry_required"
    | "renewal_blocked_until_artifacts_ingested";
  readonly evidence: string;
  readonly requiredForClaimRenewal: boolean;
};

export type Pass2904ClaimExpiryRenewalGate = {
  readonly pass: 2904;
  readonly state: readonly Pass2904ClaimExpiryRenewalState[];
  readonly hardRule: string;
  readonly previousSurveillanceGate: "scripts/pass2903-post-claim-surveillance-probation.mjs";
  readonly ingestionScript: "scripts/pass2904-claim-expiry-renewal.mjs";
  readonly renewalSpec: "tests/e2e/pass2904-claim-expiry-renewal.spec.ts";
  readonly canClaimCleanTypecheck: false;
  readonly canClaimCleanBuild: false;
  readonly canClaimWorldClassLive: false;
  readonly canRenewProductionClaimNow: false;
  readonly canIngestManualArtifactsAsGoProof: false;
  readonly manualOverrideAllowed: false;
  readonly defaultProductionDecision: "NO_GO";
  readonly defaultRenewalDecision: "NO_GO_RENEWAL_ARTIFACTS_REQUIRED";
  readonly claimExpiryMinutes: 1440;
  readonly productionClaimRequiresFreshCiIngestion: true;
  readonly productionClaimRequiresRenewalManifest: true;
  readonly expiredClaimReopensNoGo: true;
  readonly staleArtifactQuarantineActive: true;
  readonly requirements: readonly Pass2904ClaimExpiryRenewalRequirement[];
  readonly findings: readonly Pass2904ClaimExpiryRenewalFinding[];
  readonly acceptanceGates: readonly string[];
  readonly nextPassRecommendation: string;
};

export const PASS2904_CLAIM_EXPIRY_RENEWAL_REQUIREMENTS: readonly Pass2904ClaimExpiryRenewalRequirement[] = [
  {
    id: "ci_install_receipt_must_be_ingested_from_runner",
    family: "install_typecheck_build_receipts",
    requiredArtifact: ".codex-qa/ci/PASS2904_NPM_CI_EXIT0_RECEIPT.json",
    maxAgeMinutes: 1440,
    renewalRule: "Production claim renewal must ingest a fresh npm ci exit0 receipt from the target Node 20.x CI runner; dry-run or local timeout logs do not renew the claim.",
    rejectsStaleOrManualArtifact: true,
  },
  {
    id: "ci_typecheck_receipt_must_be_ingested_from_runner",
    family: "install_typecheck_build_receipts",
    requiredArtifact: ".codex-qa/ci/PASS2904_TYPECHECK_EXIT0_RECEIPT.json",
    maxAgeMinutes: 1440,
    renewalRule: "Production claim renewal requires a fresh tsc/noEmit exit0 receipt with dependency-complete types. Missing module/type errors keep NO_GO.",
    rejectsStaleOrManualArtifact: true,
  },
  {
    id: "ci_next_build_receipt_must_be_ingested_from_runner",
    family: "install_typecheck_build_receipts",
    requiredArtifact: ".codex-qa/ci/PASS2904_NEXT_BUILD_EXIT0_RECEIPT.json",
    maxAgeMinutes: 1440,
    renewalRule: "Production claim renewal requires a fresh next build exit0 receipt from the release candidate commit and environment.",
    rejectsStaleOrManualArtifact: true,
  },
  {
    id: "playwright_visual_receipts_must_be_ingested_and_fresh",
    family: "playwright_visual_receipts",
    requiredArtifact: ".codex-qa/ci/PASS2904_PLAYWRIGHT_VISUAL_RECEIPTS.json",
    maxAgeMinutes: 720,
    renewalRule: "Shield and Real Markets browser screenshots/selectors must be collected from Playwright after the same build artifact. Old screenshots cannot renew production claim.",
    rejectsStaleOrManualArtifact: true,
  },
  {
    id: "pdf_tier_parity_receipts_must_be_ingested_and_fresh",
    family: "pdf_tier_parity_receipts",
    requiredArtifact: ".codex-qa/ci/PASS2904_BTC_AAPL_PDF_TIER_PARITY_RECEIPTS.json",
    maxAgeMinutes: 720,
    renewalRule: "BTC Shield and AAPL Real Markets Basic/Pro/Advanced preview/download hashes must be regenerated after the release candidate build and tied to entitlement proof.",
    rejectsStaleOrManualArtifact: true,
  },
  {
    id: "payment_entitlement_receipts_must_be_ingested_and_fresh",
    family: "payment_entitlement_receipts",
    requiredArtifact: ".codex-qa/ci/PASS2904_PAYMENT_ENTITLEMENT_RECEIPTS.json",
    maxAgeMinutes: 720,
    renewalRule: "Stripe/BLIK/Web3 entitlement receipts must be server-side, fresh and release-candidate-bound. Wallet identity alone is never renewal proof.",
    rejectsStaleOrManualArtifact: true,
  },
  {
    id: "provider_freshness_receipts_must_be_ingested_and_fresh",
    family: "provider_freshness_receipts",
    requiredArtifact: ".codex-qa/ci/PASS2904_PROVIDER_FRESHNESS_QUORUM_RECEIPTS.json",
    maxAgeMinutes: 240,
    renewalRule: "Provider freshness/quorum/timeouts/fallback receipts must be collected close to claim renewal. Stale market data or repeated 500 failed-to-fetch keeps NO_GO.",
    rejectsStaleOrManualArtifact: true,
  },
  {
    id: "public_claim_copy_receipt_must_match_expiry_state",
    family: "public_claim_copy_receipts",
    requiredArtifact: ".codex-qa/ci/PASS2904_PUBLIC_CLAIM_COPY_SCAN.json",
    maxAgeMinutes: 720,
    renewalRule: "Public copy/status endpoints must not say production-ready/world-class-live when claim is expired, renewal pending, or receipts are missing.",
    rejectsStaleOrManualArtifact: true,
  },
];

export function buildPass2904ClaimExpiryRenewalGate(): Pass2904ClaimExpiryRenewalGate {
  const findings: readonly Pass2904ClaimExpiryRenewalFinding[] = [
    {
      family: "ci_artifact_ingestion",
      severity: "P0",
      currentStatus: "adapter_contract_prepared",
      evidence: "PASS2904 defines a CI artifact ingestion contract that accepts only fresh, release-candidate-bound, hashable receipts for install/typecheck/build/browser/PDF/payment/provider/public-copy surfaces.",
      requiredForClaimRenewal: true,
    },
    {
      family: "expiry_window",
      severity: "P0",
      currentStatus: "claim_expiry_required",
      evidence: "Production/world-class-live claim cannot be permanent. It expires after a renewal window and reopens NO_GO unless new CI receipts are ingested.",
      requiredForClaimRenewal: true,
    },
    {
      family: "install_typecheck_build_receipts",
      severity: "P0",
      currentStatus: "fresh_ci_receipt_required",
      evidence: "Current package still lacks clean dependency-complete npm ci, typecheck and next build receipts from Node 20.x. Dry-run logs and typecheck exit2 cannot renew a production claim.",
      requiredForClaimRenewal: true,
    },
    {
      family: "operator_dual_control",
      severity: "P0",
      currentStatus: "renewal_blocked_until_artifacts_ingested",
      evidence: "Operator cannot manually renew a production claim. Renewal requires complete fresh CI artifact ingestion plus dual-control signing.",
      requiredForClaimRenewal: true,
    },
  ];

  return {
    pass: 2904,
    state: [
      "ci_artifact_ingestion_ready",
      "production_claim_expiry_window_required",
      "claim_renewal_requires_fresh_ci_artifacts",
      "expired_claim_reopens_no_go",
      "stale_ci_artifact_rejected",
      "manual_claim_renewal_blocked",
    ],
    hardRule:
      "claim expiry + renewal gate: no production/world-class-live claim is permanent. Renewal requires fresh CI-ingested, release-candidate-bound receipts for install/typecheck/build/browser/PDF/payment/provider/public-copy surfaces. Expired, stale, copied or manual artifacts reopen NO_GO.",
    previousSurveillanceGate: "scripts/pass2903-post-claim-surveillance-probation.mjs",
    ingestionScript: "scripts/pass2904-claim-expiry-renewal.mjs",
    renewalSpec: "tests/e2e/pass2904-claim-expiry-renewal.spec.ts",
    canClaimCleanTypecheck: false,
    canClaimCleanBuild: false,
    canClaimWorldClassLive: false,
    canRenewProductionClaimNow: false,
    canIngestManualArtifactsAsGoProof: false,
    manualOverrideAllowed: false,
    defaultProductionDecision: "NO_GO",
    defaultRenewalDecision: "NO_GO_RENEWAL_ARTIFACTS_REQUIRED",
    claimExpiryMinutes: 1440,
    productionClaimRequiresFreshCiIngestion: true,
    productionClaimRequiresRenewalManifest: true,
    expiredClaimReopensNoGo: true,
    staleArtifactQuarantineActive: true,
    requirements: PASS2904_CLAIM_EXPIRY_RENEWAL_REQUIREMENTS,
    findings,
    acceptanceGates: [
      "fresh npm ci exit0 receipt from target Node 20.x CI runner is ingested and hashed",
      "fresh typecheck exit0 receipt is ingested and proves dependency-complete type tree",
      "fresh next build exit0 receipt is ingested and bound to the same release candidate",
      "fresh Playwright Shield/Real Markets browser receipt pack is ingested after the same build",
      "BTC Shield and AAPL Real Markets Basic/Pro/Advanced PDF parity receipts are regenerated",
      "server-side Stripe/BLIK/Web3 entitlement receipts are fresh and release-bound",
      "provider freshness/quorum/timeout receipts are within SLO and not fallback-only",
      "public claim/status copy is scanned and matches NO_GO/renewal-pending state",
      "claim age is inside expiry window; expired claim reopens NO_GO",
      "dual-control operator renewal signature references the renewal manifest digest",
    ],
    nextPassRecommendation:
      "PASS2905 should add the CI artifact upload schema/API with signature validation, so real GitHub/Vercel/Playwright artifacts can be posted to the renewal gate without trusting filenames or manual notes.",
  };
}

export const PASS2904_CLAIM_EXPIRY_RENEWAL_GATE = buildPass2904ClaimExpiryRenewalGate();
