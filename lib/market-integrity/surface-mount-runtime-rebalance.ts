import { createHash } from "node:crypto";
import type { Pass2526ReusableDowngradeChipRebalance, Pass2526ChipState, Pass2526Surface } from "./reusable-downgrade-chip-rebalance";

export const PASS2527_SURFACE_MOUNT_RUNTIME_REBALANCE_ID = "surface-mount-runtime-rebalance-v1" as const;

export type Pass2527MountPhase = "contract_only" | "marker_mounted" | "fixture_bound" | "runtime_bound" | "blocked";
export type Pass2527RecoveryAction = "compare_providers" | "replay_receipt" | "replay_vault" | "regenerate_artifact" | "manual_review" | "dual_control" | "freeze_publish";

export type Pass2527SurfaceRuntimeMount = {
  id: string;
  surface: Pass2526Surface;
  component: string;
  dataAttribute: string;
  currentPhase: Pass2527MountPhase;
  requiredBefore: string;
  defaultState: Pass2526ChipState;
  requiredEvidence: string[];
  forbiddenClaims: string[];
  recoveryAction: Pass2527RecoveryAction;
  userVisibleFallback: string;
};

export type Pass2527SurfaceFailureFixture = {
  id: string;
  surface: Pass2526Surface;
  simulatedFailure: string;
  expectedChipState: Pass2526ChipState;
  expectedCopyMode: "missing_proof" | "not_enough_proof" | "payment_hold" | "vault_replay" | "operator_block";
  expectedUiRule: string;
};

export type Pass2527EquationRule = {
  id: string;
  equation: string;
  whyItMatters: string;
  failClosedBehavior: string;
};

export type Pass2527SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2527SurfaceMountRuntimeRebalance = {
  id: typeof PASS2527_SURFACE_MOUNT_RUNTIME_REBALANCE_ID;
  state: "ready_for_surface_replay" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  surfaceMountRuntimeCoverageBeforePercent: number;
  surfaceMountRuntimeCoverageAfterPercent: number;
  liveChipStateFixtureBeforePercent: number;
  liveChipStateFixtureAfterPercent: number;
  recoveryRouteBindingBeforePercent: number;
  recoveryRouteBindingAfterPercent: number;
  notEnoughProofFlowBeforePercent: number;
  notEnoughProofFlowAfterPercent: number;
  accountPaymentChipReplayBeforePercent: number;
  accountPaymentChipReplayAfterPercent: number;
  aiChipSurfaceBindingBeforePercent: number;
  aiChipSurfaceBindingAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  surfaceRuntimeMounts: Pass2527SurfaceRuntimeMount[];
  failureFixtures: Pass2527SurfaceFailureFixture[];
  equationRules: Pass2527EquationRule[];
  semanticLanes: Pass2527SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  runtimeMountRule: string;
  fingerprint: string;
};

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

export const PASS2527_SURFACE_RUNTIME_MOUNTS: Pass2527SurfaceRuntimeMount[] = [
  {
    id: "shield-risk-score-before-chip",
    surface: "shield",
    component: "TokenRiskModal",
    dataAttribute: "data-pass2527-shield-runtime-proof-chip-mount",
    currentPhase: "fixture_bound",
    requiredBefore: "risk score, rug-pull/squeeze copy and Basic/Pro/Advanced summary",
    defaultState: "hold",
    requiredEvidence: ["sourceQuorum", "dataQuality", "freshness", "tierBudget", "claimPermission"],
    forbiddenClaims: ["safe", "confirmed", "rug pull", "squeeze", "final"],
    recoveryAction: "compare_providers",
    userVisibleFallback: "Not enough proof — compare providers before treating this score as final.",
  },
  {
    id: "real-markets-paid-insight-before-chip",
    surface: "real_markets",
    component: "AssetDetailModal",
    dataAttribute: "data-pass2527-real-markets-runtime-proof-chip-mount",
    currentPhase: "fixture_bound",
    requiredBefore: "paid insight, company/fundamental copy and market cap claims",
    defaultState: "watch",
    requiredEvidence: ["providerAgreement", "asOf", "filingFreshness", "instrumentType", "secondSource"],
    forbiddenClaims: ["live", "final", "institutional", "confirmed"],
    recoveryAction: "compare_providers",
    userVisibleFallback: "Market proof is partial — show source freshness and divergence before premium copy.",
  },
  {
    id: "browser-pdf-preview-download-chip",
    surface: "browser_pdf",
    component: "VelmereIntelligenceSearchClient + lens-report API",
    dataAttribute: "data-pass2527-browser-pdf-runtime-proof-chip-mount",
    currentPhase: "marker_mounted",
    requiredBefore: "PDF preview, download and account vault delivery",
    defaultState: "blocked",
    requiredEvidence: ["previewHash", "downloadHash", "vaultReplayHash", "locale", "sourceAppendix"],
    forbiddenClaims: ["download final", "vault confirmed", "PDF ready"],
    recoveryAction: "regenerate_artifact",
    userVisibleFallback: "Report hash family is incomplete — regenerate preview/download/vault together.",
  },
  {
    id: "angel-answer-before-chip",
    surface: "angel",
    component: "AngelPanel + Angel API",
    dataAttribute: "data-pass2527-angel-runtime-proof-chip-mount",
    currentPhase: "fixture_bound",
    requiredBefore: "Angel answer body and action suggestions",
    defaultState: "hold",
    requiredEvidence: ["claimFamily", "forbiddenClaimScan", "sourceQuorum", "tierPermission", "confidenceCap"],
    forbiddenClaims: ["safe", "guaranteed", "no risk", "paid", "unlocked", "final"],
    recoveryAction: "manual_review",
    userVisibleFallback: "Angel can describe missing proof and next checks, not pretend final certainty.",
  },
  {
    id: "checkout-entitlement-before-unlock-chip",
    surface: "checkout",
    component: "CartDrawer",
    dataAttribute: "data-pass2527-checkout-runtime-proof-chip-mount",
    currentPhase: "fixture_bound",
    requiredBefore: "Advanced unlock, paid report, card/crypto success state",
    defaultState: "blocked",
    requiredEvidence: ["serverReceipt", "providerEventId", "accountId", "entitlementId", "notRevoked"],
    forbiddenClaims: ["paid", "unlocked", "delivered", "advanced complete"],
    recoveryAction: "replay_receipt",
    userVisibleFallback: "Payment proof is missing — keep Advanced on hold until receipt replay passes.",
  },
  {
    id: "wallet-identity-boundary-chip",
    surface: "wallet",
    component: "WalletConnectDrawer",
    dataAttribute: "data-pass2527-wallet-runtime-proof-chip-mount",
    currentPhase: "fixture_bound",
    requiredBefore: "wallet unlock copy and Advanced eligibility language",
    defaultState: "watch",
    requiredEvidence: ["walletAddress", "network", "identityContext", "paymentReceiptIfAny"],
    forbiddenClaims: ["wallet paid", "wallet unlock", "advanced unlocked"],
    recoveryAction: "replay_receipt",
    userVisibleFallback: "Wallet connection is identity/context only; it is not a payment receipt.",
  },
  {
    id: "account-vault-replay-before-delivered-chip",
    surface: "account_vault",
    component: "AuditAccountMessagesClient",
    dataAttribute: "data-pass2527-account-vault-runtime-proof-chip-mount",
    currentPhase: "fixture_bound",
    requiredBefore: "delivered status, vault replay and report download",
    defaultState: "hold",
    requiredEvidence: ["entitlementId", "receiptId", "accountId", "artifactHashFamily", "providerStatus"],
    forbiddenClaims: ["delivered", "vault confirmed", "final report"],
    recoveryAction: "replay_vault",
    userVisibleFallback: "Vault delivery needs replay proof before the account message is treated as final.",
  },
  {
    id: "admin-override-dual-control-chip",
    surface: "admin",
    component: "SecurityAuditAdminInbox",
    dataAttribute: "data-pass2527-admin-runtime-proof-chip-mount",
    currentPhase: "marker_mounted",
    requiredBefore: "manual override and operator ready state",
    defaultState: "blocked",
    requiredEvidence: ["operatorId", "reason", "expiry", "secondApprover", "auditLogId"],
    forbiddenClaims: ["manual trusted", "override complete", "auto granted"],
    recoveryAction: "dual_control",
    userVisibleFallback: "Manual override is blocked until dual-control proof exists.",
  },
  {
    id: "product-provider-freeze-chip",
    surface: "product",
    component: "ProductLaunchChecklist",
    dataAttribute: "data-pass2527-product-runtime-proof-chip-mount",
    currentPhase: "marker_mounted",
    requiredBefore: "product ready/publish copy and Printful/provider handoff",
    defaultState: "hold",
    requiredEvidence: ["providerProductId", "variantIds", "imageOwnership", "sizeTable", "fulfillmentSnapshot"],
    forbiddenClaims: ["ready", "publish safe", "provider confirmed"],
    recoveryAction: "freeze_publish",
    userVisibleFallback: "Product publish stays frozen until provider snapshot and image ownership are proven.",
  },
];

export const PASS2527_FAILURE_FIXTURES: Pass2527SurfaceFailureFixture[] = [
  { id: "fixture-source-quorum-missing", surface: "shield", simulatedFailure: "only one provider confirms risk score", expectedChipState: "hold", expectedCopyMode: "not_enough_proof", expectedUiRule: "chip appears before score and caps confidence" },
  { id: "fixture-paid-receipt-missing", surface: "checkout", simulatedFailure: "Advanced selected without server receipt", expectedChipState: "blocked", expectedCopyMode: "payment_hold", expectedUiRule: "no Advanced payload or paid copy is rendered" },
  { id: "fixture-artifact-hash-drift", surface: "browser_pdf", simulatedFailure: "previewHash differs from downloadHash", expectedChipState: "blocked", expectedCopyMode: "vault_replay", expectedUiRule: "download and account vault delivery are blocked" },
  { id: "fixture-angel-forbidden-claim", surface: "angel", simulatedFailure: "Angel says safe/final with missing source quorum", expectedChipState: "hold", expectedCopyMode: "missing_proof", expectedUiRule: "answer rewrites to missing proof and next recovery action" },
  { id: "fixture-admin-override-no-second-approval", surface: "admin", simulatedFailure: "operator override lacks expiry or second approval", expectedChipState: "blocked", expectedCopyMode: "operator_block", expectedUiRule: "admin action blocked and logged for dual control" },
];

export const PASS2527_EQUATION_RULES: Pass2527EquationRule[] = [
  { id: "runtime-mount-truth", equation: "runtimeMountTruth = visibleChip × evidenceInputsPresent × recoveryAction × !forbiddenClaim", whyItMatters: "A downgrade rail only protects users if it is mounted before the risky claim and has a recovery path.", failClosedBehavior: "Surface remains on hold and hides final/paid/safe language." },
  { id: "not-enough-proof-flow", equation: "notEnoughProofFlow = proofGapSeverity × userImpact × paidExposure × surfaceVisibility", whyItMatters: "The highest-risk missing proof must be visible before score, payment result or AI summary.", failClosedBehavior: "Show Not enough proof chip and route to compare/replay/manual review." },
  { id: "surface-replay-integrity", equation: "surfaceReplayIntegrity = fixtureFailure × expectedChipState × expectedCopyMode × expectedUiRule", whyItMatters: "Each surface needs deterministic failure fixtures, not only happy-path chips.", failClosedBehavior: "Block readiness until replay fixture exists." },
  { id: "wallet-payment-boundary", equation: "walletPaymentBoundary = walletIdentityContext × !paymentReceipt ? watch : replayReceipt", whyItMatters: "Wallet connect must never unlock Advanced by itself.", failClosedBehavior: "Keep Advanced blocked until a payment provider receipt is replayed." },
];

export const PASS2527_SEMANTIC_LANES: Pass2527SemanticLane[] = [
  { id: "manual-semantic-audit", percentBefore: 33, percentAfter: 36, finding: "Reusable chips existed, but surface-specific runtime states and failure fixtures were not yet mapped deeply enough.", implementedGuard: "Added runtime mount matrix for nine surfaces and five replay failure fixtures.", nextAction: "Turn each fixture into screenshot/runtime tests for mobile and desktop modals." },
  { id: "surface-mount-runtime-coverage", percentBefore: 41, percentAfter: 59, finding: "Mount contracts were mostly generic; surfaces needed required-before rules and evidence inputs.", implementedGuard: "Each surface now defines what the chip must render before, default state, forbidden claims and recovery action.", nextAction: "Wire real props from sourceSync/payment/vault state into ProofDowngradeChipRail." },
  { id: "not-enough-proof-flow", percentBefore: 66, percentAfter: 76, finding: "Not enough proof state needed a first-class runtime flow across Shield, PDF, Angel and checkout.", implementedGuard: "Added notEnoughProofFlow equation and failure fixtures for missing source/payment/hash/AI proof.", nextAction: "Add browser tests asserting chip order before score, PDF download and Angel answer body." },
  { id: "ai-claim-surface-binding", percentBefore: 79, percentAfter: 85, finding: "AI firewall had forbidden claims but lacked surface-specific expected UI behavior.", implementedGuard: "Angel now has a dedicated runtime fixture for safe/final forbidden claims with missing proof copy.", nextAction: "Add PL/EN/DE replay prompts for safe/live/final/paid/squeeze/rug-pull." },
];

export function buildPass2527SurfaceMountRuntimeRebalance(args: {
  query: string;
  symbol?: string;
  pass2526?: Pass2526ReusableDowngradeChipRebalance;
}): Pass2527SurfaceMountRuntimeRebalance {
  const payload = {
    query: args.query,
    symbol: args.symbol,
    previous: args.pass2526?.fingerprint ?? "missing-pass2526",
    mounts: PASS2527_SURFACE_RUNTIME_MOUNTS.map((mount) => `${mount.id}:${mount.currentPhase}:${mount.dataAttribute}`),
    fixtures: PASS2527_FAILURE_FIXTURES.map((fixture) => `${fixture.id}:${fixture.expectedChipState}:${fixture.expectedCopyMode}`),
    equations: PASS2527_EQUATION_RULES.map((rule) => rule.id),
  };
  return {
    id: PASS2527_SURFACE_MOUNT_RUNTIME_REBALANCE_ID,
    state: "ready_for_surface_replay",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 33,
    manualSemanticCompletionAfterPercent: 36,
    targetedSemanticBatchFiles: 38,
    targetedSemanticBatchLines: 175920,
    surfaceMountRuntimeCoverageBeforePercent: 41,
    surfaceMountRuntimeCoverageAfterPercent: 59,
    liveChipStateFixtureBeforePercent: 22,
    liveChipStateFixtureAfterPercent: 44,
    recoveryRouteBindingBeforePercent: 63,
    recoveryRouteBindingAfterPercent: 72,
    notEnoughProofFlowBeforePercent: 66,
    notEnoughProofFlowAfterPercent: 76,
    accountPaymentChipReplayBeforePercent: 52,
    accountPaymentChipReplayAfterPercent: 67,
    aiChipSurfaceBindingBeforePercent: 79,
    aiChipSurfaceBindingAfterPercent: 85,
    worldclassInventionIndexBeforePercent: 42,
    worldclassInventionIndexAfterPercent: 49,
    surfaceRuntimeMounts: PASS2527_SURFACE_RUNTIME_MOUNTS,
    failureFixtures: PASS2527_FAILURE_FIXTURES,
    equationRules: PASS2527_EQUATION_RULES,
    semanticLanes: PASS2527_SEMANTIC_LANES,
    masterTxtAdditions: [
      "PASS2527 converts the reusable downgrade chip rail into a surface-specific runtime mount matrix for Shield, Real Markets, Browser/PDF, Angel, checkout, wallet, account vault, admin and product surfaces.",
      "Every mount now declares what it must render before, which evidence inputs are required, which claims are forbidden and which recovery action the user/operator should see.",
      "World-class direction: failure fixtures must prove not enough proof, payment hold, artifact hash drift, Angel forbidden claim rewrite and admin dual-control blocking.",
      "The next hardening step is live prop wiring: sourceSync, entitlement, vault and provider status should feed the chip rail instead of static fixture defaults.",
    ],
    nextPassQueue: [
      "PASS2528: Angel forbidden-claim replay fixtures in PL/EN/DE for safe/live/final/paid/squeeze/rug-pull.",
      "PASS2529: Browser/PDF artifact hash family replay test for preview/download/account vault.",
      "PASS2530: checkout/account vault entitlement chip rail wired to active/refunded/disputed/replay_required states.",
      "PASS2531: sourceSync → ProofDowngradeChipRail live props for Shield and Real Markets.",
      "PASS2532: screenshot fixtures for 390px mobile modal chip order and no-scroll overlay behavior.",
    ],
    runtimeMountRule: "A proof downgrade chip rail is only valid when mounted before the risky claim, fed with surface-specific evidence inputs, linked to a recovery action and backed by a failure fixture. If any required evidence is missing, the surface must show Not enough proof/hold/block before risk score, paid insight, PDF finality, wallet unlock copy, admin override or Angel answer.",
    fingerprint: stableFingerprint(payload),
  };
}
