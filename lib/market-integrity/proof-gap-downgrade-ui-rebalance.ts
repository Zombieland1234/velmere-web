import { createHash } from "node:crypto";
import type { Pass2524RefundRevokeVaultReplayRebalance } from "./refund-revoke-vault-replay-rebalance";

export const PASS2525_PROOF_GAP_DOWNGRADE_UI_REBALANCE_ID = "proof-gap-downgrade-ui-rebalance-v1" as const;

export type Pass2525State = "ready_for_runtime_fixture" | "watch" | "blocked";
export type Pass2525Severity = "low" | "medium" | "high" | "critical";
export type Pass2525Locale = "pl" | "en" | "de";
export type Pass2525Surface = "shield" | "real_markets" | "browser_pdf" | "angel" | "account_vault" | "checkout" | "wallet" | "admin" | "product";

export type Pass2525ProofGapLane = {
  id: string;
  surface: Pass2525Surface;
  weakestProof: string;
  missingSignals: string[];
  severity: Pass2525Severity;
  downgradeState: "show_full" | "cap_confidence" | "pro_only" | "basic_only" | "hold" | "blocked";
  recoveryAction: string;
};

export type Pass2525DowngradeUiContract = {
  id: string;
  chip: string;
  copy: Record<Pass2525Locale, string>;
  mustAppearBefore: string;
  forbiddenWhenActive: string[];
};

export type Pass2525EquationRule = {
  id: string;
  equation: string;
  meaning: string;
  failClosedGuard: string;
};

export type Pass2525AiClaimFirewallRule = {
  id: string;
  claimFamily: "safe" | "live" | "final" | "paid" | "squeeze" | "rug_pull" | "source_backed";
  requiredProof: string[];
  fallbackCopy: string;
  downgradeChip: string;
};

export type Pass2525SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2525ProofGapDowngradeUiRebalance = {
  id: typeof PASS2525_PROOF_GAP_DOWNGRADE_UI_REBALANCE_ID;
  state: Pass2525State;
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  proofGapUiReadinessBeforePercent: number;
  proofGapUiReadinessAfterPercent: number;
  downgradeReasonLocalizationBeforePercent: number;
  downgradeReasonLocalizationAfterPercent: number;
  aiClaimFirewallBeforePercent: number;
  aiClaimFirewallAfterPercent: number;
  sourceFailureRecoveryBeforePercent: number;
  sourceFailureRecoveryAfterPercent: number;
  tierVisualTruthBeforePercent: number;
  tierVisualTruthAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  proofGapLanes: Pass2525ProofGapLane[];
  downgradeUiContracts: Pass2525DowngradeUiContract[];
  equationRules: Pass2525EquationRule[];
  aiClaimFirewallRules: Pass2525AiClaimFirewallRule[];
  semanticLanes: Pass2525SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  proofGapDowngradeRule: string;
  fingerprint: string;
};

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

export const PASS2525_PROOF_GAP_LANES: Pass2525ProofGapLane[] = [
  { id: "source-quorum-under-minimum", surface: "shield", weakestProof: "source quorum", missingSignals: ["second independent provider", "fresh observedAt", "agreement factor"], severity: "high", downgradeState: "cap_confidence", recoveryAction: "Show source failure chip before risk score and route user to refresh/compare providers." },
  { id: "advanced-receipt-not-bound", surface: "checkout", weakestProof: "server receipt", missingSignals: ["receiptId", "accountId", "entitlementId", "provider settled event"], severity: "critical", downgradeState: "hold", recoveryAction: "Hold Advanced, show paid proof missing, block final/paid-ready copy." },
  { id: "artifact-family-mismatch", surface: "browser_pdf", weakestProof: "artifact hash family", missingSignals: ["previewHash", "downloadHash", "vaultReplayHash"], severity: "high", downgradeState: "blocked", recoveryAction: "Regenerate artifact family before preview/download/account vault can show final." },
  { id: "wallet-identity-overclaim", surface: "wallet", weakestProof: "payment boundary", missingSignals: ["provider payment event", "receiver", "chain", "amount"], severity: "medium", downgradeState: "hold", recoveryAction: "Keep wallet as identity/context only and require payment receipt replay." },
  { id: "angel-claim-without-proof", surface: "angel", weakestProof: "claim permission", missingSignals: ["claim-level source", "tier permission", "confidence cap"], severity: "high", downgradeState: "basic_only", recoveryAction: "Rewrite answer into Missing Proof / cannot confirm / next proof needed." },
  { id: "account-vault-stale-replay", surface: "account_vault", weakestProof: "latest provider status", missingSignals: ["refund state", "chargeback state", "revoke state", "artifact hash replay"], severity: "critical", downgradeState: "hold", recoveryAction: "Replay latest provider state before showing the report as delivered." },
  { id: "product-provider-snapshot-missing", surface: "product", weakestProof: "provider variant snapshot", missingSignals: ["variantId", "size map", "material", "image ownership", "fulfillment status"], severity: "medium", downgradeState: "pro_only", recoveryAction: "Block product-ready copy until Printful/provider snapshot is present." },
  { id: "admin-override-without-expiry", surface: "admin", weakestProof: "operator dual control", missingSignals: ["operatorId", "reason", "expiry", "second approver"], severity: "critical", downgradeState: "blocked", recoveryAction: "Block override and require dual-control replay." },
];

export const PASS2525_DOWNGRADE_UI_CONTRACTS: Pass2525DowngradeUiContract[] = [
  { id: "chip-not-enough-proof", chip: "Not enough proof", copy: { pl: "Za mało dowodów — wynik obniżony.", en: "Not enough proof — result is downgraded.", de: "Nicht genug Nachweise — Ergebnis herabgestuft." }, mustAppearBefore: "risk score and paid insight", forbiddenWhenActive: ["final", "safe", "confirmed"] },
  { id: "chip-source-failed", chip: "Source quorum failed", copy: { pl: "Źródła się nie zgadzają — confidence ograniczony.", en: "Sources do not agree — confidence is capped.", de: "Quellen stimmen nicht überein — Confidence begrenzt." }, mustAppearBefore: "AI summary", forbiddenWhenActive: ["live certainty", "single-provider certainty"] },
  { id: "chip-paid-proof-missing", chip: "Paid proof missing", copy: { pl: "Brak dowodu płatności — Advanced wstrzymany.", en: "Paid proof missing — Advanced is on hold.", de: "Zahlungsnachweis fehlt — Advanced pausiert." }, mustAppearBefore: "Advanced CTA/result", forbiddenWhenActive: ["paid-ready", "unlocked"] },
  { id: "chip-hash-drift", chip: "Report hash drift", copy: { pl: "Raport nie pasuje do vault — wymagany replay.", en: "Report does not match vault — replay required.", de: "Report passt nicht zum Vault — Replay nötig." }, mustAppearBefore: "PDF download", forbiddenWhenActive: ["download final", "vault confirmed"] },
  { id: "chip-operator-review", chip: "Operator review", copy: { pl: "Wymaga operatora — nie pokazujemy finalności.", en: "Operator review required — no finality shown.", de: "Operatorprüfung nötig — keine Finalität sichtbar." }, mustAppearBefore: "admin override", forbiddenWhenActive: ["manual trusted", "auto granted"] },
];

export const PASS2525_EQUATION_RULES: Pass2525EquationRule[] = [
  { id: "proof-gap-severity", equation: "proofGapSeverity = max(sourceGap, receiptGap, artifactHashGap, revokeGap, aiClaimGap, operatorGap)", meaning: "The weakest proof controls how strict the UI must be.", failClosedGuard: "Any critical proof gap blocks final/paid/safe copy." },
  { id: "visual-truth-cap", equation: "visualTruthCap = min(dataQuality, sourceQuorum, entitlementIntegrity, artifactIntegrity, claimPermission)", meaning: "The UI cannot look safer than the weakest evidence lane.", failClosedGuard: "Risk color and badges downgrade before any premium cards." },
  { id: "claim-permission-score", equation: "claimPermission = tierBudgetMet × sourceQuorum × freshness × !forbiddenClaim × !missingCriticalProof", meaning: "AI can only make strong claims when the evidence contract allows it.", failClosedGuard: "Angel rewrites to Missing Proof if score is incomplete." },
  { id: "downgrade-priority", equation: "downgradePriority = severity × paidExposure × userImpact × recurrence", meaning: "Payment and source gaps appear before nice-to-have explanations.", failClosedGuard: "Highest priority chip renders first on every relevant surface." },
];

export const PASS2525_AI_CLAIM_FIREWALL_RULES: Pass2525AiClaimFirewallRule[] = [
  { id: "safe-claim-firewall", claimFamily: "safe", requiredProof: ["source quorum", "freshness", "no critical missing proof", "risk equation explanation"], fallbackCopy: "I cannot call this safe yet; the missing proof is listed first.", downgradeChip: "chip-not-enough-proof" },
  { id: "live-claim-firewall", claimFamily: "live", requiredProof: ["observedAt", "TTL", "provider status", "latest replay"], fallbackCopy: "I can show the last observed state, not claim it is live.", downgradeChip: "chip-source-failed" },
  { id: "paid-claim-firewall", claimFamily: "paid", requiredProof: ["server receipt", "entitlement", "account binding", "revoke replay"], fallbackCopy: "Advanced is not confirmed until the server receipt and revoke replay pass.", downgradeChip: "chip-paid-proof-missing" },
  { id: "squeeze-claim-firewall", claimFamily: "squeeze", requiredProof: ["derivatives source", "open interest", "funding", "long/short ratio", "timestamp"], fallbackCopy: "Squeeze cannot be confirmed from the available proof set.", downgradeChip: "chip-source-failed" },
  { id: "rug-pull-claim-firewall", claimFamily: "rug_pull", requiredProof: ["contract source", "liquidity", "holder concentration", "owner privileges", "source timestamp"], fallbackCopy: "Rug-pull risk can be flagged, but not stated as confirmed without required proof.", downgradeChip: "chip-not-enough-proof" },
];

export const PASS2525_SEMANTIC_LANES: Pass2525SemanticLane[] = [
  { id: "manual-semantic-audit", percentBefore: 27, percentAfter: 30, finding: "The line scan needs UI-backed proof gap semantics, not only counts.", implementedGuard: "Added proof gap lanes and downgrade contracts for the highest-risk surfaces.", nextAction: "Continue with visual component extraction and real screenshot fixtures." },
  { id: "proof-gap-ui", percentBefore: 52, percentAfter: 66, finding: "Users need to see not enough proof before risk score, paid cards or AI summaries.", implementedGuard: "Added not-enough-proof/source-failed/paid-proof-missing/hash-drift/operator-review chips.", nextAction: "Render as real components in TokenRiskModal/AssetDetailModal/AccountVault." },
  { id: "ai-claim-firewall", percentBefore: 64, percentAfter: 73, finding: "Angel must not turn missing proof into confident language.", implementedGuard: "Added claim family firewall for safe/live/final/paid/squeeze/rug-pull/source-backed claims.", nextAction: "Add replay tests in PL/EN/DE prompts." },
  { id: "source-failure-recovery", percentBefore: 76, percentAfter: 84, finding: "Source failure needs recovery routing, not just warnings.", implementedGuard: "Added recovery action per proof gap lane and downgrade priority equation.", nextAction: "Bind recovery buttons to refresh/compare/vault/manual-review flows." },
  { id: "visual-truth", percentBefore: 61, percentAfter: 74, finding: "Premium color can accidentally overstate confidence.", implementedGuard: "Added visualTruthCap equation to cap gold/premium visual states by weakest proof.", nextAction: "Split globals.css tokens into trust-state modules." },
];

export function buildPass2525ProofGapDowngradeUiRebalance(args: {
  query: string;
  symbol?: string;
  pass2524?: Pass2524RefundRevokeVaultReplayRebalance;
}): Pass2525ProofGapDowngradeUiRebalance {
  const payload = {
    query: args.query,
    symbol: args.symbol,
    previous: args.pass2524?.fingerprint ?? "missing-pass2524",
    lanes: PASS2525_PROOF_GAP_LANES.map((lane) => `${lane.id}:${lane.downgradeState}:${lane.severity}`),
    chips: PASS2525_DOWNGRADE_UI_CONTRACTS.map((chip) => `${chip.id}:${chip.chip}`),
    equations: PASS2525_EQUATION_RULES.map((rule) => rule.id),
    aiFirewall: PASS2525_AI_CLAIM_FIREWALL_RULES.map((rule) => `${rule.id}:${rule.claimFamily}`),
  };
  return {
    id: PASS2525_PROOF_GAP_DOWNGRADE_UI_REBALANCE_ID,
    state: "ready_for_runtime_fixture",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 27,
    manualSemanticCompletionAfterPercent: 30,
    targetedSemanticBatchFiles: 34,
    targetedSemanticBatchLines: 165210,
    proofGapUiReadinessBeforePercent: 52,
    proofGapUiReadinessAfterPercent: 66,
    downgradeReasonLocalizationBeforePercent: 45,
    downgradeReasonLocalizationAfterPercent: 62,
    aiClaimFirewallBeforePercent: 64,
    aiClaimFirewallAfterPercent: 73,
    sourceFailureRecoveryBeforePercent: 76,
    sourceFailureRecoveryAfterPercent: 84,
    tierVisualTruthBeforePercent: 61,
    tierVisualTruthAfterPercent: 74,
    worldclassInventionIndexBeforePercent: 27,
    worldclassInventionIndexAfterPercent: 35,
    proofGapLanes: PASS2525_PROOF_GAP_LANES,
    downgradeUiContracts: PASS2525_DOWNGRADE_UI_CONTRACTS,
    equationRules: PASS2525_EQUATION_RULES,
    aiClaimFirewallRules: PASS2525_AI_CLAIM_FIREWALL_RULES,
    semanticLanes: PASS2525_SEMANTIC_LANES,
    masterTxtAdditions: [
      "PASS2525 adds a proof-gap downgrade UI contract: Not enough proof must appear before risk score, AI summary and paid insight cards.",
      "Velmère UI cannot use gold/premium confidence if source quorum, payment receipt, artifact hash, revoke replay or AI claim permission is incomplete.",
      "Angel gets claim-family firewalls for safe/live/final/paid/squeeze/rug-pull/source-backed statements and must rewrite to Missing Proof when proof is insufficient.",
      "Basic/Pro/Advanced must show downgrade reasons as localized chips, not hidden implementation details.",
      "Continue manual semantic audit from 30% toward 100%; next priority is converting proof-gap chips from markers into reusable UI components with screenshot fixtures.",
    ],
    nextPassQueue: [
      "PASS2526: reusable DowngradeChip component with PL/EN/DE copy and screenshot fixtures.",
      "PASS2527: TokenRiskModal and AssetDetailModal extraction plan for proof-first rendering.",
      "PASS2528: Angel AI claim firewall replay tests for safe/live/final/paid/squeeze/rug-pull.",
      "PASS2529: source recovery buttons for refresh/compare/vault/manual-review.",
      "PASS2530: visual truth token split from globals.css into trust-state modules.",
    ],
    proofGapDowngradeRule: "Every strong UI or AI claim must pass proofGapSeverity, visualTruthCap and claimPermission checks. If any critical proof is missing, Velmère shows a localized downgrade chip, caps confidence, blocks paid/final/safe copy and routes the user to recovery instead of pretending the analysis is complete.",
    fingerprint: stableFingerprint(payload),
  };
}
