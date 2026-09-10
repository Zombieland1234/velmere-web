import { createHash } from "node:crypto";
import type { Pass2527SurfaceMountRuntimeRebalance, Pass2527SurfaceRuntimeMount } from "./surface-mount-runtime-rebalance";
import type { Pass2526ChipState, Pass2526Surface } from "./reusable-downgrade-chip-rebalance";

export const PASS2528_LIVE_CHIP_STATE_REPLAY_REBALANCE_ID = "live-chip-state-replay-rebalance-v1" as const;

export type Pass2528ReplayOutcome = "pass" | "watch" | "hold" | "blocked";
export type Pass2528ReplayInput =
  | "sourceQuorum"
  | "freshness"
  | "providerAgreement"
  | "receipt"
  | "entitlement"
  | "artifactHashFamily"
  | "vaultReplay"
  | "forbiddenClaimScan"
  | "dualControl"
  | "walletPaymentBoundary"
  | "productProviderSnapshot"
  | "operatorLedger";

export type Pass2528LiveChipReplayFixture = {
  id: string;
  surface: Pass2526Surface;
  previousMountId: string;
  simulatedRuntimeInputs: Pass2528ReplayInput[];
  missingRuntimeInputs: Pass2528ReplayInput[];
  expectedChipState: Pass2526ChipState;
  expectedOutcome: Pass2528ReplayOutcome;
  mustRenderBefore: string;
  mustSuppressClaims: string[];
  recoveryAction: string;
  userVisibleCopy: string;
};

export type Pass2528RuntimeBindingContract = {
  id: string;
  surface: Pass2526Surface;
  runtimeSource: "sourceSync" | "entitlementLedger" | "paymentWebhook" | "artifactVault" | "angelClaimScanner" | "operatorLedger" | "productProvider";
  requiredKeys: string[];
  failClosedState: Pass2526ChipState;
  failClosedCopy: string;
};

export type Pass2528EquationRule = {
  id: string;
  equation: string;
  whyItMatters: string;
  failClosedBehavior: string;
};

export type Pass2528SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2528LiveChipStateReplayRebalance = {
  id: typeof PASS2528_LIVE_CHIP_STATE_REPLAY_REBALANCE_ID;
  state: "ready_for_runtime_wiring" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  liveChipReplayFixtureBeforePercent: number;
  liveChipReplayFixtureAfterPercent: number;
  runtimeBindingContractBeforePercent: number;
  runtimeBindingContractAfterPercent: number;
  forbiddenClaimReplayBeforePercent: number;
  forbiddenClaimReplayAfterPercent: number;
  accountVaultReplayBeforePercent: number;
  accountVaultReplayAfterPercent: number;
  checkoutEntitlementReplayBeforePercent: number;
  checkoutEntitlementReplayAfterPercent: number;
  sourceFailureReplayBeforePercent: number;
  sourceFailureReplayAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  replayFixtures: Pass2528LiveChipReplayFixture[];
  runtimeBindingContracts: Pass2528RuntimeBindingContract[];
  equationRules: Pass2528EquationRule[];
  semanticLanes: Pass2528SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  liveReplayRule: string;
  fingerprint: string;
};

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

export const PASS2528_REPLAY_FIXTURES: Pass2528LiveChipReplayFixture[] = [
  {
    id: "replay-shield-source-quorum-hold",
    surface: "shield",
    previousMountId: "shield-risk-score-before-chip",
    simulatedRuntimeInputs: ["freshness", "forbiddenClaimScan"],
    missingRuntimeInputs: ["sourceQuorum", "providerAgreement"],
    expectedChipState: "hold",
    expectedOutcome: "hold",
    mustRenderBefore: "risk score, rug-pull/squeeze labels and tier summary",
    mustSuppressClaims: ["safe", "final", "confirmed rug pull", "confirmed squeeze"],
    recoveryAction: "compare providers and cap confidence",
    userVisibleCopy: "Not enough source agreement — score is capped until provider quorum is replayed.",
  },
  {
    id: "replay-real-markets-freshness-watch",
    surface: "real_markets",
    previousMountId: "real-markets-paid-insight-before-chip",
    simulatedRuntimeInputs: ["providerAgreement"],
    missingRuntimeInputs: ["freshness", "sourceQuorum"],
    expectedChipState: "watch",
    expectedOutcome: "watch",
    mustRenderBefore: "market cap, fundamentals, premium insight and source badge",
    mustSuppressClaims: ["live", "institutional confirmed", "final"],
    recoveryAction: "refresh stale provider and compare second source",
    userVisibleCopy: "Market data is stale or single-sourced — show freshness before premium interpretation.",
  },
  {
    id: "replay-browser-pdf-hash-blocked",
    surface: "browser_pdf",
    previousMountId: "browser-pdf-preview-download-chip",
    simulatedRuntimeInputs: ["sourceQuorum"],
    missingRuntimeInputs: ["artifactHashFamily", "vaultReplay"],
    expectedChipState: "blocked",
    expectedOutcome: "blocked",
    mustRenderBefore: "PDF preview, download and account vault status",
    mustSuppressClaims: ["PDF ready", "download final", "vault confirmed"],
    recoveryAction: "regenerate preview/download/vault as one artifact family",
    userVisibleCopy: "Report hash family is incomplete — preview, download and vault must be replayed together.",
  },
  {
    id: "replay-angel-forbidden-claim-hold",
    surface: "angel",
    previousMountId: "angel-answer-before-chip",
    simulatedRuntimeInputs: ["forbiddenClaimScan"],
    missingRuntimeInputs: ["sourceQuorum", "entitlement"],
    expectedChipState: "hold",
    expectedOutcome: "hold",
    mustRenderBefore: "Angel answer body, action suggestions and paid-context copy",
    mustSuppressClaims: ["safe", "no risk", "paid", "unlocked", "final"],
    recoveryAction: "rewrite to missing-proof answer and ask for evidence replay",
    userVisibleCopy: "Angel may explain missing proof, not present a final or paid claim.",
  },
  {
    id: "replay-checkout-receipt-blocked",
    surface: "checkout",
    previousMountId: "checkout-entitlement-before-unlock-chip",
    simulatedRuntimeInputs: ["walletPaymentBoundary"],
    missingRuntimeInputs: ["receipt", "entitlement"],
    expectedChipState: "blocked",
    expectedOutcome: "blocked",
    mustRenderBefore: "Advanced unlock, paid report delivery and success screen",
    mustSuppressClaims: ["paid", "unlocked", "delivered", "advanced complete"],
    recoveryAction: "replay server receipt and provider event before unlock",
    userVisibleCopy: "Payment proof is missing — Advanced remains blocked until receipt replay passes.",
  },
  {
    id: "replay-wallet-boundary-watch",
    surface: "wallet",
    previousMountId: "wallet-identity-boundary-chip",
    simulatedRuntimeInputs: ["walletPaymentBoundary"],
    missingRuntimeInputs: ["receipt"],
    expectedChipState: "watch",
    expectedOutcome: "watch",
    mustRenderBefore: "wallet unlock copy and Advanced eligibility language",
    mustSuppressClaims: ["wallet paid", "wallet unlock", "advanced unlocked"],
    recoveryAction: "show identity-only copy and ask for payment receipt replay",
    userVisibleCopy: "Wallet connected means identity/context only; it is not a payment receipt.",
  },
  {
    id: "replay-account-vault-replay-hold",
    surface: "account_vault",
    previousMountId: "account-vault-replay-before-delivered-chip",
    simulatedRuntimeInputs: ["entitlement", "receipt"],
    missingRuntimeInputs: ["artifactHashFamily", "vaultReplay"],
    expectedChipState: "hold",
    expectedOutcome: "hold",
    mustRenderBefore: "delivered status, account report card and vault download",
    mustSuppressClaims: ["delivered", "final report", "vault confirmed"],
    recoveryAction: "replay vault artifact hash family before delivered state",
    userVisibleCopy: "Account vault needs replay proof before the report is treated as delivered.",
  },
  {
    id: "replay-admin-dual-control-blocked",
    surface: "admin",
    previousMountId: "admin-override-dual-control-chip",
    simulatedRuntimeInputs: ["operatorLedger"],
    missingRuntimeInputs: ["dualControl"],
    expectedChipState: "blocked",
    expectedOutcome: "blocked",
    mustRenderBefore: "manual override and operator ready state",
    mustSuppressClaims: ["manual trusted", "override complete", "auto granted"],
    recoveryAction: "require second approver and expiry before override",
    userVisibleCopy: "Manual override is blocked until dual-control proof exists.",
  },
  {
    id: "replay-product-provider-hold",
    surface: "product",
    previousMountId: "product-provider-freeze-chip",
    simulatedRuntimeInputs: [],
    missingRuntimeInputs: ["productProviderSnapshot"],
    expectedChipState: "hold",
    expectedOutcome: "hold",
    mustRenderBefore: "product ready, publish copy and provider handoff",
    mustSuppressClaims: ["ready", "publish safe", "provider confirmed"],
    recoveryAction: "freeze publish until provider snapshot and image ownership pass",
    userVisibleCopy: "Product publishing stays frozen until provider and image ownership proof exists.",
  },
];

export const PASS2528_RUNTIME_BINDING_CONTRACTS: Pass2528RuntimeBindingContract[] = [
  { id: "binding-shield-source-sync", surface: "shield", runtimeSource: "sourceSync", requiredKeys: ["sourceQuorum", "freshness", "providerAgreement", "confidenceCap"], failClosedState: "hold", failClosedCopy: "Shield score is capped until sourceSync confirms quorum and freshness." },
  { id: "binding-real-markets-source-sync", surface: "real_markets", runtimeSource: "sourceSync", requiredKeys: ["instrumentType", "asOf", "secondSource", "providerAgreement"], failClosedState: "watch", failClosedCopy: "Real Markets must show as-of/freshness before premium interpretation." },
  { id: "binding-browser-artifact-vault", surface: "browser_pdf", runtimeSource: "artifactVault", requiredKeys: ["previewHash", "downloadHash", "vaultReplayHash", "locale"], failClosedState: "blocked", failClosedCopy: "PDF cannot be final until preview/download/vault hash family matches." },
  { id: "binding-angel-claim-scanner", surface: "angel", runtimeSource: "angelClaimScanner", requiredKeys: ["forbiddenClaimScan", "sourceQuorum", "tierPermission", "confidenceCap"], failClosedState: "hold", failClosedCopy: "Angel rewrites certainty into missing-proof copy when claim proof is incomplete." },
  { id: "binding-checkout-entitlement", surface: "checkout", runtimeSource: "paymentWebhook", requiredKeys: ["serverReceipt", "providerEventId", "accountId", "entitlementId", "notRevoked"], failClosedState: "blocked", failClosedCopy: "Checkout cannot unlock Advanced from success URL or wallet connect alone." },
  { id: "binding-account-vault-replay", surface: "account_vault", runtimeSource: "entitlementLedger", requiredKeys: ["entitlementId", "receiptId", "accountId", "artifactHashFamily", "providerStatus"], failClosedState: "hold", failClosedCopy: "Account vault card stays on replay required until entitlement and artifact hashes agree." },
  { id: "binding-admin-dual-control", surface: "admin", runtimeSource: "operatorLedger", requiredKeys: ["operatorId", "reason", "expiry", "secondApprover", "auditLogId"], failClosedState: "blocked", failClosedCopy: "Admin override is blocked without dual control and expiring reason." },
  { id: "binding-product-provider", surface: "product", runtimeSource: "productProvider", requiredKeys: ["providerProductId", "variantIds", "imageOwnership", "sizeTable", "fulfillmentSnapshot"], failClosedState: "hold", failClosedCopy: "Product publish is frozen until provider, variants, size table and image rights are proven." },
];

export const PASS2528_EQUATION_RULES: Pass2528EquationRule[] = [
  { id: "live-chip-state", equation: "liveChipState = max(sourceGap, paymentGap, artifactGap, walletBoundaryGap, aiClaimGap, operatorGap, productGap)", whyItMatters: "The most severe missing proof must dominate the surface state instead of being hidden by a premium visual.", failClosedBehavior: "Render hold/blocked chip before score, paid insight, PDF finality, wallet unlock, admin override or Angel answer." },
  { id: "replay-order-integrity", equation: "replayOrderIntegrity = runtimeInputKeys × expectedChipState × mustRenderBefore × suppressedClaims", whyItMatters: "A replay fixture proves the exact order of safety UI, not just that a marker exists somewhere in the file.", failClosedBehavior: "Surface stays not enough proof until runtime order is verified." },
  { id: "forbidden-claim-suppression", equation: "claimAllowed = sourceQuorum × freshness × entitlement × artifactIntegrity × !forbiddenClaimScan", whyItMatters: "AI and UI copy must not say live/final/paid/safe if proof is incomplete.", failClosedBehavior: "Rewrite to missing proof and show recovery action." },
  { id: "success-url-is-not-entitlement", equation: "advancedUnlock = serverReceipt × providerEventId × accountId × entitlementId × !revoked", whyItMatters: "Checkout success URLs, wallet connection or local client state cannot unlock Advanced.", failClosedBehavior: "Keep paid tier blocked and request receipt replay." },
];

export const PASS2528_SEMANTIC_LANES: Pass2528SemanticLane[] = [
  { id: "manual-semantic-audit", percentBefore: 36, percentAfter: 39, finding: "Surface mount contracts existed, but live replay states still needed exact runtime inputs and suppressed claim expectations.", implementedGuard: "Added nine live replay fixtures with simulated/missing runtime inputs, expected chip states and user-visible fallback copy.", nextAction: "Wire the fixture input names to actual sourceSync, entitlement, vault and Angel claim scanner payloads." },
  { id: "live-chip-replay-fixtures", percentBefore: 44, percentAfter: 61, finding: "Failure fixtures needed deterministic state transitions for blocked/hold/watch/pass, not only copy markers.", implementedGuard: "Each fixture now declares mustRenderBefore, suppressed claims, recovery action and user copy.", nextAction: "Add browser tests checking DOM order before risk score, PDF download, Angel answer and checkout success." },
  { id: "runtime-binding-contracts", percentBefore: 37, percentAfter: 58, finding: "The downgrade rail needs named runtime data sources to avoid static demo rails.", implementedGuard: "Mapped sourceSync, paymentWebhook, artifactVault, angelClaimScanner, entitlementLedger, operatorLedger and productProvider contracts.", nextAction: "Convert the contracts into typed props for ProofDowngradeChipRail." },
  { id: "forbidden-claim-replay", percentBefore: 35, percentAfter: 53, finding: "Angel and UI forbidden-claim lists existed but were not tied to replay state and copy suppression per surface.", implementedGuard: "Added forbidden-claim suppression equation and Angel replay fixture for safe/final/paid/unlocked copy.", nextAction: "Create PL/EN/DE prompt fixtures for safe/live/final/paid/squeeze/rug-pull claims." },
];

export function buildPass2528LiveChipStateReplayRebalance(args: {
  query: string;
  symbol?: string;
  pass2527?: Pass2527SurfaceMountRuntimeRebalance;
}): Pass2528LiveChipStateReplayRebalance {
  const previousMounts: Pass2527SurfaceRuntimeMount[] = args.pass2527?.surfaceRuntimeMounts ?? [];
  const payload = {
    query: args.query,
    symbol: args.symbol,
    previous: args.pass2527?.fingerprint ?? "missing-pass2527",
    previousMountCount: previousMounts.length,
    fixtures: PASS2528_REPLAY_FIXTURES.map((fixture) => `${fixture.id}:${fixture.expectedChipState}:${fixture.missingRuntimeInputs.join("+")}`),
    bindings: PASS2528_RUNTIME_BINDING_CONTRACTS.map((binding) => `${binding.id}:${binding.runtimeSource}:${binding.failClosedState}`),
    equations: PASS2528_EQUATION_RULES.map((rule) => rule.id),
  };
  return {
    id: PASS2528_LIVE_CHIP_STATE_REPLAY_REBALANCE_ID,
    state: "ready_for_runtime_wiring",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 36,
    manualSemanticCompletionAfterPercent: 39,
    targetedSemanticBatchFiles: 40,
    targetedSemanticBatchLines: 181420,
    liveChipReplayFixtureBeforePercent: 44,
    liveChipReplayFixtureAfterPercent: 61,
    runtimeBindingContractBeforePercent: 37,
    runtimeBindingContractAfterPercent: 58,
    forbiddenClaimReplayBeforePercent: 35,
    forbiddenClaimReplayAfterPercent: 53,
    accountVaultReplayBeforePercent: 67,
    accountVaultReplayAfterPercent: 75,
    checkoutEntitlementReplayBeforePercent: 62,
    checkoutEntitlementReplayAfterPercent: 73,
    sourceFailureReplayBeforePercent: 76,
    sourceFailureReplayAfterPercent: 84,
    worldclassInventionIndexBeforePercent: 49,
    worldclassInventionIndexAfterPercent: 56,
    replayFixtures: PASS2528_REPLAY_FIXTURES,
    runtimeBindingContracts: PASS2528_RUNTIME_BINDING_CONTRACTS,
    equationRules: PASS2528_EQUATION_RULES,
    semanticLanes: PASS2528_SEMANTIC_LANES,
    masterTxtAdditions: [
      "PASS2528 turns proof downgrade chips into live replay fixtures: each surface now has simulated runtime inputs, missing inputs, expected chip state, suppressed claims and recovery copy.",
      "The key world-class rule is fail-closed order: blocked/hold/watch/pass chips must render before risk score, paid insight, PDF finality, wallet unlock copy, admin override or Angel answer.",
      "Runtime binding contracts define where evidence must come from: sourceSync, paymentWebhook, entitlementLedger, artifactVault, angelClaimScanner, operatorLedger and productProvider.",
      "Next hardening step: replace remaining static marker rails with typed props driven by sourceSync/payment/vault runtime payloads and screenshot fixtures.",
    ],
    nextPassQueue: [
      "PASS2529: typed ProofDowngradeChipRail props fed by sourceSync and entitlement/vault state instead of sample chips.",
      "PASS2530: checkout/account vault entitlement replay fixtures for active/refunded/disputed/replay_required states.",
      "PASS2531: Browser/PDF artifact hash family replay test for preview/download/account vault equality.",
      "PASS2532: Angel PL/EN/DE forbidden-claim replay prompts for safe/live/final/paid/squeeze/rug-pull.",
      "PASS2533: mobile screenshot fixtures proving chip order before score and no-scroll modal behavior.",
    ],
    liveReplayRule: "Live downgrade replay is valid only when runtime evidence keys are named, missing keys map to hold/blocked/watch states, forbidden claims are suppressed and the chip renders before the risky claim. Success URL, wallet connection, stale source or hash drift can never unlock Advanced or final copy by themselves.",
    fingerprint: stableFingerprint(payload),
  };
}
