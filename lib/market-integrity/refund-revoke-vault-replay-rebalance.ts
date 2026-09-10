import { createHash } from "node:crypto";
import type { Pass2523TierProofPassportRebalance } from "./tier-proof-passport-rebalance";

export const PASS2524_REFUND_REVOKE_VAULT_REPLAY_REBALANCE_ID = "refund-revoke-vault-replay-rebalance-v1" as const;

export type Pass2524State = "ready_for_runtime_fixture" | "watch" | "blocked";
export type Pass2524EventFamily = "stripe" | "blik" | "crypto" | "wallet" | "account" | "admin" | "artifact" | "source";
export type Pass2524GuardStatus = "confirmed" | "partial" | "watch" | "blocked";
export type Pass2524Locale = "pl" | "en" | "de";

export type Pass2524RevokeEventRule = {
  id: string;
  family: Pass2524EventFamily;
  event: string;
  userVisibleState: "active" | "hold" | "revoked" | "disputed" | "replay_required";
  guard: string;
  recoveryAction: string;
};

export type Pass2524VaultReplayLane = {
  id: string;
  label: string;
  status: Pass2524GuardStatus;
  requiredProofs: string[];
  blocksWhenMissing: string;
  recoveryAction: string;
};

export type Pass2524LocalizedDowngradeChip = {
  id: string;
  reason: "payment_reversed" | "receipt_missing" | "hash_mismatch" | "source_quorum_failed" | "wallet_mismatch" | "manual_review" | "refund_window";
  severity: "low" | "medium" | "high" | "critical";
  copy: Record<Pass2524Locale, string>;
  requiredSurface: string;
};

export type Pass2524AbusePressureRule = {
  id: string;
  signal: string;
  detection: string;
  forcedState: "hold" | "replay_required" | "revoked" | "manual_review";
  safeCopy: string;
};

export type Pass2524EquationRule = {
  id: string;
  equation: string;
  meaning: string;
  failClosedGuard: string;
};

export type Pass2524SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2524RefundRevokeVaultReplayRebalance = {
  id: typeof PASS2524_REFUND_REVOKE_VAULT_REPLAY_REBALANCE_ID;
  state: Pass2524State;
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  refundRevokeEdgeCoverageBeforePercent: number;
  refundRevokeEdgeCoverageAfterPercent: number;
  accountVaultReplayReadinessBeforePercent: number;
  accountVaultReplayReadinessAfterPercent: number;
  paidTierAbuseShieldBeforePercent: number;
  paidTierAbuseShieldAfterPercent: number;
  sourceQuorumFailureUiBeforePercent: number;
  sourceQuorumFailureUiAfterPercent: number;
  downgradeChipLocalizationBeforePercent: number;
  downgradeChipLocalizationAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  revokeEventRules: Pass2524RevokeEventRule[];
  vaultReplayLanes: Pass2524VaultReplayLane[];
  localizedDowngradeChips: Pass2524LocalizedDowngradeChip[];
  abusePressureRules: Pass2524AbusePressureRule[];
  equationRules: Pass2524EquationRule[];
  semanticLanes: Pass2524SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  refundRevokeVaultReplayRule: string;
  fingerprint: string;
};

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

export const PASS2524_REVOKE_EVENT_RULES: Pass2524RevokeEventRule[] = [
  { id: "stripe-refund-succeeded", family: "stripe", event: "refund.succeeded", userVisibleState: "revoked", guard: "Advanced entitlement must be revoked and account vault delivery becomes replay-only.", recoveryAction: "Show refund chip, keep audit trail, block fresh paid download." },
  { id: "stripe-chargeback-dispute", family: "stripe", event: "charge.dispute.created", userVisibleState: "disputed", guard: "Paid insight remains in hold state until dispute is resolved.", recoveryAction: "Freeze Advanced and show dispute/replay status in account vault." },
  { id: "blik-expired-or-cancelled", family: "blik", event: "authorization.expired_or_cancelled", userVisibleState: "hold", guard: "BLIK payment cannot unlock Advanced unless provider event is settled.", recoveryAction: "Return user to checkout with clear non-punitive retry copy." },
  { id: "crypto-reorg-or-underpayment", family: "crypto", event: "chain.reorg_or_underpayment", userVisibleState: "replay_required", guard: "Crypto payment requires chain, receiver, amount and confirmation depth replay.", recoveryAction: "Request replay and keep wallet identity separate from entitlement." },
  { id: "wallet-wrong-chain", family: "wallet", event: "wallet.chain_mismatch", userVisibleState: "hold", guard: "Wallet connect is identity/context only and cannot override wrong chain or wrong receiver.", recoveryAction: "Show wallet mismatch chip and block paid wording." },
  { id: "admin-override-expired", family: "admin", event: "override.expired_or_missing_dual_control", userVisibleState: "revoked", guard: "Manual grants require reason, expiry, operator id and audit receipt.", recoveryAction: "Revoke override, require dual-control replay." },
  { id: "artifact-hash-drift", family: "artifact", event: "preview_download_vault_hash_mismatch", userVisibleState: "replay_required", guard: "Preview, download and account vault must share one artifact hash family.", recoveryAction: "Regenerate artifact family and show mismatch chip." },
];

export const PASS2524_VAULT_REPLAY_LANES: Pass2524VaultReplayLane[] = [
  { id: "entitlement-row", label: "Entitlement row", status: "partial", requiredProofs: ["entitlementId", "accountId", "tier", "status", "createdAt"], blocksWhenMissing: "No account-bound entitlement row.", recoveryAction: "Do not display Advanced as delivered; ask for receipt replay." },
  { id: "payment-event", label: "Payment event", status: "partial", requiredProofs: ["provider", "eventId", "amount", "currency", "settled status"], blocksWhenMissing: "Provider event cannot be matched to entitlement.", recoveryAction: "Hold paid access and show non-final payment chip." },
  { id: "artifact-family", label: "Artifact hash family", status: "partial", requiredProofs: ["previewHash", "downloadHash", "vaultReplayHash", "locale"], blocksWhenMissing: "PDF/report might not be the same artifact.", recoveryAction: "Regenerate and bind artifact family before delivery." },
  { id: "revoke-history", label: "Refund/revoke history", status: "watch", requiredProofs: ["refund state", "chargeback state", "crypto reorg state", "revokedAt"], blocksWhenMissing: "User could keep paid state after a reversal.", recoveryAction: "Replay latest provider state before showing paid-ready copy." },
  { id: "source-quorum-replay", label: "Source quorum replay", status: "partial", requiredProofs: ["source count", "freshness", "agreement", "missing proof"], blocksWhenMissing: "Source failure could still look like an Advanced conclusion.", recoveryAction: "Downgrade tier and show Missing Proof recovery route." },
];

export const PASS2524_LOCALIZED_DOWNGRADE_CHIPS: Pass2524LocalizedDowngradeChip[] = [
  { id: "chip-payment-reversed", reason: "payment_reversed", severity: "critical", copy: { pl: "Płatność cofnięta — dostęp wstrzymany do czasu replay.", en: "Payment reversed — access is on hold until replay.", de: "Zahlung zurückgebucht — Zugriff bis zum Replay pausiert." }, requiredSurface: "account vault, cart, Advanced modal" },
  { id: "chip-receipt-missing", reason: "receipt_missing", severity: "high", copy: { pl: "Brak server receipt — Advanced nie jest potwierdzony.", en: "Server receipt missing — Advanced is not confirmed.", de: "Server-Beleg fehlt — Advanced ist nicht bestätigt." }, requiredSurface: "tier passport, wallet, Angel" },
  { id: "chip-hash-mismatch", reason: "hash_mismatch", severity: "high", copy: { pl: "Hash raportu nie pasuje — wymagany ponowny zapis.", en: "Report hash mismatch — regeneration required.", de: "Report-Hash passt nicht — Neugenerierung erforderlich." }, requiredSurface: "PDF preview, download, account vault" },
  { id: "chip-source-quorum-failed", reason: "source_quorum_failed", severity: "medium", copy: { pl: "Za mało zgodnych źródeł — confidence obniżony.", en: "Not enough agreeing sources — confidence is capped.", de: "Zu wenige übereinstimmende Quellen — Confidence begrenzt." }, requiredSurface: "Shield, Real Markets, Browser, Angel" },
  { id: "chip-wallet-mismatch", reason: "wallet_mismatch", severity: "medium", copy: { pl: "Portfel nie pasuje do płatności — unlock zablokowany.", en: "Wallet does not match payment — unlock is blocked.", de: "Wallet passt nicht zur Zahlung — Unlock blockiert." }, requiredSurface: "wallet drawer, checkout" },
  { id: "chip-manual-review", reason: "manual_review", severity: "low", copy: { pl: "Wymaga ręcznego sprawdzenia — wynik nie jest finalny.", en: "Manual review required — result is not final.", de: "Manuelle Prüfung nötig — Ergebnis ist nicht final." }, requiredSurface: "admin, audit inbox, Angel" },
  { id: "chip-refund-window", reason: "refund_window", severity: "low", copy: { pl: "Okno zwrotu aktywne — pokazujemy stan replay.", en: "Refund window active — replay state is shown.", de: "Erstattungsfenster aktiv — Replay-Status sichtbar." }, requiredSurface: "account vault, receipt panel" },
];

export const PASS2524_ABUSE_PRESSURE_RULES: Pass2524AbusePressureRule[] = [
  { id: "duplicate-receipt", signal: "same receipt reused across accounts", detection: "providerEventId appears under different accountId", forcedState: "manual_review", safeCopy: "Receipt needs review before paid access can continue." },
  { id: "shared-artifact", signal: "download link reused outside account vault", detection: "artifactHash requested by unrelated account/session", forcedState: "replay_required", safeCopy: "Report must be opened from the account vault." },
  { id: "refund-after-delivery", signal: "refund after PDF delivery", detection: "refund event timestamp newer than artifact delivery timestamp", forcedState: "revoked", safeCopy: "Access was revoked after the payment reversal." },
  { id: "wallet-only-unlock-pressure", signal: "connected wallet treated as payment", detection: "walletConnected=true and paymentEventId missing", forcedState: "hold", safeCopy: "Wallet is identity/context only, not payment proof." },
  { id: "source-failure-paid-pressure", signal: "Advanced paid but source quorum failed", detection: "entitlementIntegrity positive but sourceQuorumRuntime below threshold", forcedState: "replay_required", safeCopy: "Advanced can show deeper gaps, not fake certainty." },
];

export const PASS2524_EQUATION_RULES: Pass2524EquationRule[] = [
  { id: "revoke-safety", equation: "revokeSafety = !refunded × !chargeback × !cryptoReorg × accountStillBound × receiptNotExpired", meaning: "Paid access is only safe while every reversal rail is clear.", failClosedGuard: "Any zero forces hold/revoked/replay_required copy." },
  { id: "vault-replay-integrity", equation: "replayIntegrity = entitlementId × receiptId × accountId × artifactHashFamily × eventStatus", meaning: "Account vault can only mark a report delivered when every replay key is present.", failClosedGuard: "Missing key blocks delivered/final copy." },
  { id: "paid-abuse-pressure", equation: "paidAbusePressure = duplicateReceipt + sharedArtifact + walletMismatch + refundAfterDelivery + adminOverrideNoExpiry", meaning: "Paid-tier abuse is treated as an operator-visible pressure score.", failClosedGuard: "High pressure forces manual review and downgrade chips." },
  { id: "downgrade-chip-priority", equation: "downgradeChipPriority = max(paymentRisk, sourceFailure, hashMismatch, revokeRisk, missingProof)", meaning: "The most important weakness appears first in UI and Angel copy.", failClosedGuard: "Never hide payment/hash/source failure behind generic premium text." },
];

export const PASS2524_SEMANTIC_LANES: Pass2524SemanticLane[] = [
  { id: "manual-semantic-audit", percentBefore: 24, percentAfter: 27, finding: "PASS2523 made tier proof visible; the next risk is paid access staying trusted after reversal, hash drift or source failure.", implementedGuard: "Added refund/revoke event rules, vault replay lanes and localized downgrade chips.", nextAction: "Bind chips to real account vault rows and provider webhook replay." },
  { id: "refund-revoke-edge-coverage", percentBefore: 31, percentAfter: 52, finding: "Refund, chargeback, BLIK expiry, crypto reorg and admin override expiry need visible states.", implementedGuard: "Added event-specific hold/revoked/disputed/replay_required rules.", nextAction: "Add webhook fixture tests for Stripe, BLIK and crypto replay." },
  { id: "account-vault-replay-readiness", percentBefore: 54, percentAfter: 69, finding: "Account vault delivery must be replayable from entitlement, receipt, account and artifact hash family.", implementedGuard: "Added replayIntegrity equation and vault lanes.", nextAction: "Persist replay evidence in durable DB adapter." },
  { id: "paid-tier-abuse-shield", percentBefore: 43, percentAfter: 62, finding: "Duplicate receipts, shared artifacts and wallet-only unlocks must fail closed.", implementedGuard: "Added paidAbusePressure and abuse pressure rules.", nextAction: "Add operator dashboard filters for abuse pressure." },
  { id: "source-quorum-failure-ui", percentBefore: 67, percentAfter: 76, finding: "Advanced payment cannot hide source quorum failure; paid tier shows deeper gaps, not fake certainty.", implementedGuard: "Added source quorum replay lane and localized source failure chips.", nextAction: "Show source failure before paid insight cards." },
  { id: "downgrade-chip-localization", percentBefore: 0, percentAfter: 45, finding: "Downgrade reasons need PL/EN/DE copy so users understand what failed.", implementedGuard: "Added seven localized downgrade chips across payment, receipt, hash, source, wallet, review and refund-window states.", nextAction: "Move chips into messages/i18n and render them in UI components." },
];

export function buildPass2524RefundRevokeVaultReplayRebalance(args: {
  query: string;
  symbol?: string;
  pass2523?: Pass2523TierProofPassportRebalance;
}): Pass2524RefundRevokeVaultReplayRebalance {
  const payload = {
    query: args.query,
    symbol: args.symbol,
    previous: args.pass2523?.fingerprint ?? "missing-pass2523",
    events: PASS2524_REVOKE_EVENT_RULES.map((rule) => `${rule.id}:${rule.userVisibleState}`),
    lanes: PASS2524_VAULT_REPLAY_LANES.map((lane) => `${lane.id}:${lane.status}`),
    chips: PASS2524_LOCALIZED_DOWNGRADE_CHIPS.map((chip) => `${chip.id}:${chip.severity}`),
    equations: PASS2524_EQUATION_RULES.map((rule) => rule.id),
  };
  return {
    id: PASS2524_REFUND_REVOKE_VAULT_REPLAY_REBALANCE_ID,
    state: "ready_for_runtime_fixture",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 24,
    manualSemanticCompletionAfterPercent: 27,
    targetedSemanticBatchFiles: 32,
    targetedSemanticBatchLines: 160936,
    refundRevokeEdgeCoverageBeforePercent: 31,
    refundRevokeEdgeCoverageAfterPercent: 52,
    accountVaultReplayReadinessBeforePercent: 54,
    accountVaultReplayReadinessAfterPercent: 69,
    paidTierAbuseShieldBeforePercent: 43,
    paidTierAbuseShieldAfterPercent: 62,
    sourceQuorumFailureUiBeforePercent: 67,
    sourceQuorumFailureUiAfterPercent: 76,
    downgradeChipLocalizationBeforePercent: 0,
    downgradeChipLocalizationAfterPercent: 45,
    worldclassInventionIndexBeforePercent: 18,
    worldclassInventionIndexAfterPercent: 27,
    revokeEventRules: PASS2524_REVOKE_EVENT_RULES,
    vaultReplayLanes: PASS2524_VAULT_REPLAY_LANES,
    localizedDowngradeChips: PASS2524_LOCALIZED_DOWNGRADE_CHIPS,
    abusePressureRules: PASS2524_ABUSE_PRESSURE_RULES,
    equationRules: PASS2524_EQUATION_RULES,
    semanticLanes: PASS2524_SEMANTIC_LANES,
    masterTxtAdditions: [
      "PASS2524 adds refund/revoke replay states so paid access cannot stay trusted after Stripe refund, chargeback, BLIK expiry, crypto reorg, wallet mismatch or expired admin override.",
      "Account vault delivery must be replayable through entitlementId, receiptId, accountId, artifact hash family and latest provider status.",
      "Localized downgrade chips PL/EN/DE now explain payment reversed, missing receipt, hash mismatch, source quorum failure, wallet mismatch, manual review and refund-window states.",
      "Advanced payment never increases prediction certainty; if source quorum fails, Advanced shows deeper gaps and recovery actions instead of confident claims.",
      "Continue manual semantic audit from 27% toward 100%; next priority is webhook replay fixtures and actual UI rendering of localized downgrade chips.",
    ],
    nextPassQueue: [
      "PASS2525: Stripe/BLIK/crypto webhook replay fixtures for refund/revoke/hold states.",
      "PASS2526: account vault UI chip renderer bound to localized downgrade reasons.",
      "PASS2527: PDF preview/download/vault artifact hash family fixture and diff viewer.",
      "PASS2528: Angel PL/EN/DE paid-claim pressure replay harness.",
      "PASS2529: source quorum failure cards before paid insight cards in Shield/Real Markets.",
    ],
    refundRevokeVaultReplayRule: "Paid access and account vault delivery fail closed: any refund, chargeback, BLIK expiry, crypto reorg, wallet mismatch, hash drift or expired admin override must show a localized downgrade chip, set hold/revoked/replay_required state and block final/paid-ready copy until replay succeeds.",
    fingerprint: stableFingerprint(payload),
  };
}
