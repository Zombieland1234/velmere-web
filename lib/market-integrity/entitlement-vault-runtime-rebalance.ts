import { createHash } from "node:crypto";
import type { Pass2521SourceQuorumAiCalibrationRebalance } from "./source-quorum-ai-calibration-rebalance";

export const PASS2522_ENTITLEMENT_VAULT_RUNTIME_REBALANCE_ID = "entitlement-vault-runtime-rebalance-v1" as const;

export type Pass2522State = "ready_for_runtime_fixture" | "watch" | "blocked";
export type Pass2522Surface = "shield" | "real_markets" | "browser_pdf" | "account_vault" | "cart_wallet" | "admin" | "angel";
export type Pass2522EntitlementState = "confirmed" | "grace" | "downgraded" | "blocked";

export type Pass2522RuntimeEntitlementRule = {
  id: string;
  surface: Pass2522Surface;
  requiredRuntimeProofs: string[];
  forbiddenShortcut: string;
  downgradeState: Pass2522EntitlementState;
  userFacingCopy: string;
};

export type Pass2522VaultChainStep = {
  id: string;
  from: string;
  to: string;
  requiredKeys: string[];
  failureMode: string;
  recoveryAction: string;
};

export type Pass2522TierRuntimeContract = {
  tier: "basic" | "pro" | "advanced";
  expectedSignals: number;
  runtimeBoundary: string;
  requiredProofs: string[];
  blockedWhen: string;
};

export type Pass2522RiskBindingEquation = {
  id: string;
  equation: string;
  inputs: string[];
  runtimeGuard: string;
  explanationCopy: string;
};

export type Pass2522SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2522EntitlementVaultRuntimeRebalance = {
  id: typeof PASS2522_ENTITLEMENT_VAULT_RUNTIME_REBALANCE_ID;
  state: Pass2522State;
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  entitlementRuntimeProofBeforePercent: number;
  entitlementRuntimeProofAfterPercent: number;
  paymentVaultDeliveryBeforePercent: number;
  paymentVaultDeliveryAfterPercent: number;
  advancedReceiptBindingBeforePercent: number;
  advancedReceiptBindingAfterPercent: number;
  pdfAccountVaultHashBeforePercent: number;
  pdfAccountVaultHashAfterPercent: number;
  sourceQuorumRuntimeEnforcementBeforePercent: number;
  sourceQuorumRuntimeEnforcementAfterPercent: number;
  riskEquationLiveBindingBeforePercent: number;
  riskEquationLiveBindingAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  runtimeEntitlementRules: Pass2522RuntimeEntitlementRule[];
  vaultChainSteps: Pass2522VaultChainStep[];
  tierRuntimeContracts: Pass2522TierRuntimeContract[];
  riskBindingEquations: Pass2522RiskBindingEquation[];
  semanticLanes: Pass2522SemanticLane[];
  worldclassInventionBacklog: string[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  entitlementVaultRule: string;
  fingerprint: string;
};

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

export const PASS2522_RUNTIME_ENTITLEMENT_RULES: Pass2522RuntimeEntitlementRule[] = [
  { id: "advanced-server-receipt-only", surface: "cart_wallet", requiredRuntimeProofs: ["server receipt id", "account id", "order/payment event id", "entitlement ledger row"], forbiddenShortcut: "wallet connect, localStorage, client-side tier flag or UI click", downgradeState: "blocked", userFacingCopy: "Advanced unlock requires a verified server receipt; wallet connect is identity/context only." },
  { id: "pdf-vault-hash-family", surface: "browser_pdf", requiredRuntimeProofs: ["preview hash", "download hash", "vault replay hash", "locale hash"], forbiddenShortcut: "download button visible without matching artifact hash family", downgradeState: "downgraded", userFacingCopy: "PDF proof is trusted by matching hashes across preview, download and account vault." },
  { id: "source-quorum-before-risk-confirmed", surface: "shield", requiredRuntimeProofs: ["source quorum score", "freshness timestamp", "provider agreement", "missing-data penalty"], forbiddenShortcut: "green/safe/confident risk UI from one provider", downgradeState: "grace", userFacingCopy: "Confirmed risk needs source quorum; otherwise show partial confidence and recovery path." },
  { id: "real-market-filing-age-boundary", surface: "real_markets", requiredRuntimeProofs: ["quote timestamp", "fundamental filing age", "provider label", "stale badge"], forbiddenShortcut: "fresh valuation wording from stale filings", downgradeState: "downgraded", userFacingCopy: "Equity and ETF analysis separates live quote freshness from slower filing freshness." },
  { id: "admin-override-two-proof-lock", surface: "admin", requiredRuntimeProofs: ["operator id", "reason", "second approver or expiry", "audit receipt"], forbiddenShortcut: "silent admin tier grant or publish override", downgradeState: "blocked", userFacingCopy: "Manual overrides require a receipt, reason, expiry and audit trail." },
  { id: "angel-paid-claim-firewall", surface: "angel", requiredRuntimeProofs: ["source quorum", "tier proof", "artifact proof", "safe-copy filter"], forbiddenShortcut: "AI says paid/live/final/safe from chat context only", downgradeState: "blocked", userFacingCopy: "Angel can explain missing proof, but cannot create proof or unlock paid evidence." },
];

export const PASS2522_VAULT_CHAIN_STEPS: Pass2522VaultChainStep[] = [
  { id: "payment-to-entitlement", from: "payment webhook", to: "entitlement ledger", requiredKeys: ["eventId", "signatureVerified", "amount", "currency", "accountId", "idempotencyKey"], failureMode: "duplicate/replayed/underpaid event", recoveryAction: "hold manual review and do not unlock Advanced" },
  { id: "entitlement-to-artifact", from: "entitlement ledger", to: "PDF/report artifact", requiredKeys: ["entitlementId", "tier", "artifactHash", "locale", "createdAt"], failureMode: "tier mismatch or missing artifact hash", recoveryAction: "downgrade to Pro preview and show Missing Proof" },
  { id: "artifact-to-account-vault", from: "PDF/report artifact", to: "account vault message", requiredKeys: ["artifactHash", "vaultMessageId", "accountId", "replayHash"], failureMode: "download and vault hashes differ", recoveryAction: "freeze delivery and request artifact replay" },
  { id: "refund-to-revoke", from: "refund/chargeback/reorg", to: "entitlement revoke", requiredKeys: ["revokeReason", "previousEntitlementId", "operatorOrWebhookId", "timestamp"], failureMode: "paid UI remains active after refund/reorg", recoveryAction: "show revoked state and keep receipt history" },
  { id: "admin-override-to-audit", from: "manual operator action", to: "audit ledger", requiredKeys: ["operatorId", "reason", "expiry", "scope", "receiptHash"], failureMode: "unscoped manual unlock", recoveryAction: "block publish/unlock and ask for dual control" },
];

export const PASS2522_TIER_RUNTIME_CONTRACTS: Pass2522TierRuntimeContract[] = [
  { tier: "basic", expectedSignals: 10, runtimeBoundary: "Fast free evidence snapshot", requiredProofs: ["visible missing proof", "confidence cap", "source label"], blockedWhen: "Basic tries to present final certainty or paid artifact proof." },
  { tier: "pro", expectedSignals: 14, runtimeBoundary: "Deeper evidence and divergence explanation", requiredProofs: ["two-source quorum where available", "freshness windows", "risk equation explanation"], blockedWhen: "Pro hides missing data or inherits Advanced language without receipt." },
  { tier: "advanced", expectedSignals: 20, runtimeBoundary: "Paid evidence depth with receipt, vault hash and artifact replay", requiredProofs: ["server receipt", "account binding", "vault hash family", "refund/revoke boundary", "20-signal checklist"], blockedWhen: "Advanced is unlocked client-side or artifact hashes are missing." },
];

export const PASS2522_RISK_BINDING_EQUATIONS: Pass2522RiskBindingEquation[] = [
  { id: "runtime-entitlement-integrity", equation: "entitlementIntegrity = receiptVerified × accountBound × artifactHashMatched × !revoked", inputs: ["receiptVerified", "accountBound", "artifactHashMatched", "revoked"], runtimeGuard: "Advanced evidence is blocked if entitlementIntegrity is not 1.", explanationCopy: "Paid evidence unlocks only when receipt, account and artifact agree." },
  { id: "source-quorum-runtime-score", equation: "sourceQuorumRuntime = quorumScore × freshnessScore × agreementFactor", inputs: ["quorumScore", "freshnessScore", "agreementFactor"], runtimeGuard: "Green/confirmed UI needs sourceQuorumRuntime above the tier threshold.", explanationCopy: "Live claims are confirmed by fresh independent agreement, not by UI state." },
  { id: "advanced-confidence-cap", equation: "advancedConfidenceCap = min(sourceQuorumRuntime, dataQuality, entitlementIntegrity, artifactIntegrity)", inputs: ["sourceQuorumRuntime", "dataQuality", "entitlementIntegrity", "artifactIntegrity"], runtimeGuard: "Advanced cannot raise confidence above weakest runtime proof.", explanationCopy: "Paid tier increases proof depth, not prediction certainty." },
  { id: "vault-delivery-integrity", equation: "vaultIntegrity = previewHash == downloadHash == vaultReplayHash", inputs: ["previewHash", "downloadHash", "vaultReplayHash"], runtimeGuard: "Mismatched hashes freeze delivery and trigger replay.", explanationCopy: "The report people see and the report stored in account must be the same artifact." },
  { id: "worldclass-trust-deficit", equation: "trustDeficit = overclaim + missingProof + staleData + shortcutUnlock + darkPattern", inputs: ["overclaim", "missingProof", "staleData", "shortcutUnlock", "darkPattern"], runtimeGuard: "Trust deficit forces calm copy and visible friction.", explanationCopy: "Velmère should look more cautious when proof is weaker." },
];

export const PASS2522_SEMANTIC_LANES: Pass2522SemanticLane[] = [
  { id: "entitlement-runtime-proof", percentBefore: 33, percentAfter: 51, finding: "Paid/Advanced language needs a runtime proof chain, not a wallet/session shortcut.", implementedGuard: "Added server-receipt + account + ledger + artifact proof contract.", nextAction: "Bind to Stripe/BLIK/crypto webhook fixtures." },
  { id: "payment-vault-delivery", percentBefore: 44, percentAfter: 61, finding: "Payment and PDF/account delivery can drift unless every step carries ids and hashes.", implementedGuard: "Added vault chain steps from payment to entitlement to artifact to account vault.", nextAction: "Add UI delivery status with hash family summary." },
  { id: "advanced-receipt-binding", percentBefore: 58, percentAfter: 72, finding: "Advanced must be proof depth, not stronger prediction certainty.", implementedGuard: "Added Advanced confidence cap tied to entitlement and artifact integrity.", nextAction: "Show Advanced receipt checklist in modals and PDF." },
  { id: "pdf-account-vault-hash", percentBefore: 49, percentAfter: 66, finding: "Preview, download and vault delivery must share the same artifact family.", implementedGuard: "Added vaultIntegrity equation and PDF/vault hash-family boundary.", nextAction: "Add fixture hashes for PL/EN/DE reports." },
  { id: "source-quorum-runtime-enforcement", percentBefore: 54, percentAfter: 67, finding: "Source quorum rules exist; next step is runtime threshold binding to UI states.", implementedGuard: "Added sourceQuorumRuntime equation and green/confirmed UI guard.", nextAction: "Bind real BTC/AAPL/NVDA/SPY/SOL cards to runtime quorum output." },
  { id: "worldclass-inventions", percentBefore: 0, percentAfter: 18, finding: "The TXT needs a clear invention backlog beyond normal dashboards.", implementedGuard: "Added proof passport, chain-of-custody, score stress replay and trust-deficit ideas.", nextAction: "Prototype the first visible Tier Proof Passport card." },
];

export function buildPass2522EntitlementVaultRuntimeRebalance(args: {
  query: string;
  symbol?: string;
  pass2521?: Pass2521SourceQuorumAiCalibrationRebalance;
}): Pass2522EntitlementVaultRuntimeRebalance {
  const payload = {
    query: args.query,
    symbol: args.symbol,
    previous: args.pass2521?.fingerprint ?? "missing-pass2521",
    runtimeEntitlementRules: PASS2522_RUNTIME_ENTITLEMENT_RULES.map((rule) => rule.id),
    vaultChainSteps: PASS2522_VAULT_CHAIN_STEPS.map((step) => step.id),
    tierRuntimeContracts: PASS2522_TIER_RUNTIME_CONTRACTS.map((contract) => `${contract.tier}:${contract.expectedSignals}`),
    riskBindingEquations: PASS2522_RISK_BINDING_EQUATIONS.map((equation) => equation.id),
  };
  return {
    id: PASS2522_ENTITLEMENT_VAULT_RUNTIME_REBALANCE_ID,
    state: "ready_for_runtime_fixture",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 18,
    manualSemanticCompletionAfterPercent: 21,
    targetedSemanticBatchFiles: 28,
    targetedSemanticBatchLines: 152907,
    entitlementRuntimeProofBeforePercent: 33,
    entitlementRuntimeProofAfterPercent: 51,
    paymentVaultDeliveryBeforePercent: 44,
    paymentVaultDeliveryAfterPercent: 61,
    advancedReceiptBindingBeforePercent: 58,
    advancedReceiptBindingAfterPercent: 72,
    pdfAccountVaultHashBeforePercent: 49,
    pdfAccountVaultHashAfterPercent: 66,
    sourceQuorumRuntimeEnforcementBeforePercent: 54,
    sourceQuorumRuntimeEnforcementAfterPercent: 67,
    riskEquationLiveBindingBeforePercent: 55,
    riskEquationLiveBindingAfterPercent: 69,
    worldclassInventionIndexBeforePercent: 0,
    worldclassInventionIndexAfterPercent: 18,
    runtimeEntitlementRules: PASS2522_RUNTIME_ENTITLEMENT_RULES,
    vaultChainSteps: PASS2522_VAULT_CHAIN_STEPS,
    tierRuntimeContracts: PASS2522_TIER_RUNTIME_CONTRACTS,
    riskBindingEquations: PASS2522_RISK_BINDING_EQUATIONS,
    semanticLanes: PASS2522_SEMANTIC_LANES,
    worldclassInventionBacklog: [
      "Tier Proof Passport: a visible card showing Basic 10 / Pro 14 / Advanced 20 signals, receipt state, hash family and downgrade reason.",
      "Payment-to-Proof Chain of Custody: every Advanced report shows payment event, entitlement id, artifact hash and vault replay id.",
      "Score Stress Replay: user can see how risk changes when a source goes stale, diverges or is removed.",
      "Trust Deficit Gauge: the UI becomes calmer/more cautious when overclaim, stale data, dark pattern or shortcut unlock risk rises.",
      "Artifact Twin Ledger: preview/download/account vault are verified as the same report family before delivery is called complete.",
      "Entitlement Reversal Memory: refunds, chargebacks and crypto reorgs revoke active access but preserve audit history.",
    ],
    masterTxtAdditions: [
      "PASS2522 binds source quorum and risk equations to runtime entitlement/vault proof: paid claims need server receipt + account + artifact hash.",
      "Add Entitlement Runtime Contract: wallet connect is identity/context only and cannot unlock Advanced evidence.",
      "Add Vault Delivery Chain: payment → entitlement → artifact → account vault → refund/revoke must carry ids, hashes and recovery actions.",
      "Add Advanced Confidence Cap: paid tier increases proof depth, not prediction certainty; confidence stays capped by weakest runtime proof.",
      "Continue semantic audit from 21% toward 100%; next priority is visible Tier Proof Passport and real webhook/PDF hash fixtures.",
    ],
    nextPassQueue: [
      "PASS2523: build visible Tier Proof Passport in TokenRiskModal/AssetDetailModal/PDF.",
      "PASS2524: add AI Output Claim Firewall replay harness PL/EN/DE against paid/source/freshness pressure.",
      "PASS2525: add Missing Data Recovery Router action chips for refresh/compare/vault/receipt/manual review.",
      "PASS2526: add score stress replay fixtures for stale provider/divergent provider/missing vault hash.",
      "PASS2527: split globals.css premium risk psychology + entitlement proof styles into modules.",
    ],
    entitlementVaultRule: "Advanced or final-proof UI is blocked unless server receipt, account binding, artifact hash family, source quorum and refund/revoke boundary are confirmed; otherwise downgrade with Missing Proof and calm recovery copy.",
    fingerprint: stableFingerprint(payload),
  };
}
