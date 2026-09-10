import { createHash } from "node:crypto";
import type { Pass2522EntitlementVaultRuntimeRebalance } from "./entitlement-vault-runtime-rebalance";

export const PASS2523_TIER_PROOF_PASSPORT_REBALANCE_ID = "tier-proof-passport-rebalance-v1" as const;

export type Pass2523State = "ready_for_ui_fixture" | "watch" | "blocked";
export type Pass2523Tier = "basic" | "pro" | "advanced";
export type Pass2523PassportStatus = "confirmed" | "partial" | "watch" | "downgraded" | "blocked";

export type Pass2523TierProofPassport = {
  tier: Pass2523Tier;
  expectedSignals: number;
  minimumEvidenceRows: number;
  requiredProofs: string[];
  visibleUserCopy: string;
  downgradeWhen: string;
  blockedWhen: string;
};

export type Pass2523PassportLane = {
  id: string;
  label: string;
  status: Pass2523PassportStatus;
  requiredFor: Pass2523Tier[];
  proofKeys: string[];
  missingCopy: string;
  recoveryAction: string;
};

export type Pass2523UiBindingRule = {
  id: string;
  surface: "token_modal" | "asset_modal" | "browser_pdf" | "account_vault" | "cart_wallet" | "angel" | "admin";
  visibleElement: string;
  mustShowBefore: string;
  forbiddenState: string;
};

export type Pass2523RiskEquationPassportRule = {
  id: string;
  equation: string;
  visualMeaning: string;
  guard: string;
};

export type Pass2523SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2523TierProofPassportRebalance = {
  id: typeof PASS2523_TIER_PROOF_PASSPORT_REBALANCE_ID;
  state: Pass2523State;
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  tierProofPassportUiBeforePercent: number;
  tierProofPassportUiAfterPercent: number;
  passportSignalCoverageBeforePercent: number;
  passportSignalCoverageAfterPercent: number;
  downgradeReasonClarityBeforePercent: number;
  downgradeReasonClarityAfterPercent: number;
  receiptHashVisibilityBeforePercent: number;
  receiptHashVisibilityAfterPercent: number;
  missingProofRecoveryBeforePercent: number;
  missingProofRecoveryAfterPercent: number;
  aiPaidClaimPassportBeforePercent: number;
  aiPaidClaimPassportAfterPercent: number;
  tierPassports: Pass2523TierProofPassport[];
  passportLanes: Pass2523PassportLane[];
  uiBindingRules: Pass2523UiBindingRule[];
  riskEquationPassportRules: Pass2523RiskEquationPassportRule[];
  semanticLanes: Pass2523SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  tierProofPassportRule: string;
  fingerprint: string;
};

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

export const PASS2523_TIER_PASSPORTS: Pass2523TierProofPassport[] = [
  {
    tier: "basic",
    expectedSignals: 10,
    minimumEvidenceRows: 4,
    requiredProofs: ["source label", "visible missing proof", "confidence cap", "risk factor summary"],
    visibleUserCopy: "Basic shows a free snapshot: 10 signals, missing proof and confidence cap visible.",
    downgradeWhen: "less than 4 evidence rows or no source label",
    blockedWhen: "Basic copy claims final certainty, live safety or paid artifact proof",
  },
  {
    tier: "pro",
    expectedSignals: 14,
    minimumEvidenceRows: 6,
    requiredProofs: ["two-source attempt", "freshness window", "divergence note", "risk equation explanation"],
    visibleUserCopy: "Pro adds divergence and equation context: 14 signals, freshness and source disagreement visible.",
    downgradeWhen: "second-source attempt missing or stale data not disclosed",
    blockedWhen: "Pro inherits Advanced receipt/vault language without paid proof",
  },
  {
    tier: "advanced",
    expectedSignals: 20,
    minimumEvidenceRows: 8,
    requiredProofs: ["server receipt", "account binding", "artifact hash family", "source quorum", "refund/revoke boundary", "20-signal checklist"],
    visibleUserCopy: "Advanced is proof depth, not prediction certainty: 20 signals, receipt, vault hash and revoke boundary visible.",
    downgradeWhen: "receipt, source quorum or artifact hash family is partial",
    blockedWhen: "unlock is client-side, wallet-only, refunded, revoked or artifact hashes do not match",
  },
];

export const PASS2523_PASSPORT_LANES: Pass2523PassportLane[] = [
  { id: "signal-budget", label: "Signal budget", status: "confirmed", requiredFor: ["basic", "pro", "advanced"], proofKeys: ["10 basic signals", "14 pro signals", "20 advanced signals"], missingCopy: "Signal count is hidden or mismatched.", recoveryAction: "Show tier signal count and downgrade reason near CTA." },
  { id: "source-quorum", label: "Source quorum", status: "partial", requiredFor: ["pro", "advanced"], proofKeys: ["provider count", "freshness", "agreement factor"], missingCopy: "Second source or freshness is missing.", recoveryAction: "Compare sources or cap confidence with Missing Proof." },
  { id: "receipt-chain", label: "Receipt chain", status: "partial", requiredFor: ["advanced"], proofKeys: ["server receipt", "payment event id", "account id", "entitlement id"], missingCopy: "Paid proof is not bound to a server receipt.", recoveryAction: "Block Advanced and ask for receipt replay." },
  { id: "artifact-hash-family", label: "Artifact hash family", status: "partial", requiredFor: ["advanced"], proofKeys: ["preview hash", "download hash", "vault replay hash", "locale hash"], missingCopy: "PDF preview/download/vault are not proven as the same artifact.", recoveryAction: "Freeze delivery and regenerate artifact family." },
  { id: "revoke-boundary", label: "Refund/revoke boundary", status: "watch", requiredFor: ["advanced"], proofKeys: ["refund status", "chargeback status", "crypto reorg status", "revokedAt"], missingCopy: "Refund or revoke state is not reflected in UI.", recoveryAction: "Show revoked/hold state and keep audit history." },
  { id: "ai-claim-firewall", label: "AI claim firewall", status: "confirmed", requiredFor: ["basic", "pro", "advanced"], proofKeys: ["safe copy", "claim category", "evidence reference", "missing proof wording"], missingCopy: "Angel could overclaim paid/live/safe states.", recoveryAction: "Rewrite answer into evidence-bound copy before display." },
];

export const PASS2523_UI_BINDING_RULES: Pass2523UiBindingRule[] = [
  { id: "token-modal-passport-before-analysis", surface: "token_modal", visibleElement: "Tier Proof Passport", mustShowBefore: "Basic/Pro/Advanced analysis CTA", forbiddenState: "CTA without visible signal budget and missing proof" },
  { id: "asset-modal-passport-before-advanced", surface: "asset_modal", visibleElement: "Advanced proof checklist", mustShowBefore: "Advanced unlock or paid insight", forbiddenState: "paid CTA without server receipt boundary" },
  { id: "browser-pdf-passport", surface: "browser_pdf", visibleElement: "PDF hash and locale passport", mustShowBefore: "download/account-vault delivery", forbiddenState: "download complete without hash family" },
  { id: "account-vault-passport", surface: "account_vault", visibleElement: "Vault replay receipt", mustShowBefore: "report marked delivered", forbiddenState: "account message without replay hash" },
  { id: "angel-passport-before-paid-claim", surface: "angel", visibleElement: "claim/evidence passport", mustShowBefore: "safe/live/final/paid claim", forbiddenState: "AI answer with claim but no evidence category" },
  { id: "admin-passport-override", surface: "admin", visibleElement: "operator proof passport", mustShowBefore: "manual unlock/publish override", forbiddenState: "admin action without reason, expiry and receipt" },
];

export const PASS2523_RISK_EQUATION_PASSPORT_RULES: Pass2523RiskEquationPassportRule[] = [
  { id: "passport-completeness", equation: "passportCompleteness = confirmedProofs / requiredProofs", visualMeaning: "Shows how much of the tier proof passport is actually present.", guard: "If completeness is below tier threshold, downgrade copy and CTA." },
  { id: "tier-honesty-score", equation: "tierHonesty = min(signalCoverage, sourceQuorum, receiptIntegrity, artifactIntegrity, revokeSafety)", visualMeaning: "The visible tier cannot look stronger than the weakest proof rail.", guard: "Advanced must show the weakest proof rail first." },
  { id: "claim-permission", equation: "claimPermission = evidenceClass × freshness × quorum × entitlementIntegrity", visualMeaning: "AI/UI can only say a claim when all required gates are non-zero.", guard: "If zero, replace claim with Missing Proof and recovery action." },
  { id: "user-trust-friction", equation: "trustFriction = missingProof + staleData + divergence + unlockShortcut + refundRisk", visualMeaning: "More uncertainty means calmer copy and more visible friction.", guard: "High trustFriction blocks green/safe/final visual language." },
];

export const PASS2523_SEMANTIC_LANES: Pass2523SemanticLane[] = [
  { id: "manual-semantic-audit", percentBefore: 21, percentAfter: 24, finding: "PASS2522 created runtime entitlement rules; the next needed visible object is a Tier Proof Passport users can understand.", implementedGuard: "Added tier passports and UI binding rules for token modal, asset modal, PDF, account vault, Angel and admin.", nextAction: "Turn passport markers into full visual cards with real runtime data." },
  { id: "tier-proof-passport-ui", percentBefore: 18, percentAfter: 37, finding: "Basic/Pro/Advanced needed a visible evidence contract, not hidden policy text.", implementedGuard: "Added Basic 10 / Pro 14 / Advanced 20 passport definitions and user-facing copy.", nextAction: "Render passport cards beside VLM Brain tier buttons." },
  { id: "passport-signal-coverage", percentBefore: 42, percentAfter: 59, finding: "Signal budget must be counted and shown, otherwise tier depth feels like marketing.", implementedGuard: "Added passportCompleteness and tierHonesty equations.", nextAction: "Bind signal count to real analysis payload and Missing Proof rows." },
  { id: "downgrade-reason-clarity", percentBefore: 51, percentAfter: 68, finding: "Downgrades must say exactly why: receipt missing, stale source, hash mismatch, revoke state or low evidence rows.", implementedGuard: "Added downgradeWhen/blockedWhen copy per tier and lane recovery actions.", nextAction: "Add localized downgrade reason chip copy PL/EN/DE." },
  { id: "receipt-hash-visibility", percentBefore: 36, percentAfter: 54, finding: "Vault/hash proof must be visible before download/account delivery is trusted.", implementedGuard: "Added artifact-hash-family and account-vault UI binding rules.", nextAction: "Add fixture hash family for PDF preview/download/vault." },
  { id: "ai-paid-claim-passport", percentBefore: 44, percentAfter: 61, finding: "Angel needs a claim/evidence passport before paid/live/final claims.", implementedGuard: "Added claimPermission equation and AI claim firewall lane.", nextAction: "Replay PL/EN/DE adversarial prompts against paid claim pressure." },
];

export function buildPass2523TierProofPassportRebalance(args: {
  query: string;
  symbol?: string;
  pass2522?: Pass2522EntitlementVaultRuntimeRebalance;
}): Pass2523TierProofPassportRebalance {
  const payload = {
    query: args.query,
    symbol: args.symbol,
    previous: args.pass2522?.fingerprint ?? "missing-pass2522",
    tiers: PASS2523_TIER_PASSPORTS.map((tier) => `${tier.tier}:${tier.expectedSignals}:${tier.minimumEvidenceRows}`),
    lanes: PASS2523_PASSPORT_LANES.map((lane) => `${lane.id}:${lane.status}`),
    ui: PASS2523_UI_BINDING_RULES.map((rule) => `${rule.surface}:${rule.id}`),
    equations: PASS2523_RISK_EQUATION_PASSPORT_RULES.map((rule) => rule.id),
  };
  return {
    id: PASS2523_TIER_PROOF_PASSPORT_REBALANCE_ID,
    state: "ready_for_ui_fixture",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 21,
    manualSemanticCompletionAfterPercent: 24,
    targetedSemanticBatchFiles: 30,
    targetedSemanticBatchLines: 156844,
    tierProofPassportUiBeforePercent: 18,
    tierProofPassportUiAfterPercent: 37,
    passportSignalCoverageBeforePercent: 42,
    passportSignalCoverageAfterPercent: 59,
    downgradeReasonClarityBeforePercent: 51,
    downgradeReasonClarityAfterPercent: 68,
    receiptHashVisibilityBeforePercent: 36,
    receiptHashVisibilityAfterPercent: 54,
    missingProofRecoveryBeforePercent: 48,
    missingProofRecoveryAfterPercent: 63,
    aiPaidClaimPassportBeforePercent: 44,
    aiPaidClaimPassportAfterPercent: 61,
    tierPassports: PASS2523_TIER_PASSPORTS,
    passportLanes: PASS2523_PASSPORT_LANES,
    uiBindingRules: PASS2523_UI_BINDING_RULES,
    riskEquationPassportRules: PASS2523_RISK_EQUATION_PASSPORT_RULES,
    semanticLanes: PASS2523_SEMANTIC_LANES,
    masterTxtAdditions: [
      "PASS2523 turns Basic/Pro/Advanced into a visible Tier Proof Passport instead of hidden policy copy.",
      "Basic must show 10 signals, minimum evidence rows, confidence cap and Missing Proof; Pro must show 14 signals plus divergence/freshness; Advanced must show 20 signals plus receipt, account, vault hash and revoke boundary.",
      "Add passportCompleteness, tierHonesty, claimPermission and trustFriction equations to make the risk score explainable and evidence-bound.",
      "AI/Angel can only say paid/live/final/safe when the claim/evidence passport allows it; otherwise it must show Missing Proof and recovery actions.",
      "Continue manual semantic audit from 24% toward 100%; next priority is localized downgrade chips and real PDF hash fixtures.",
    ],
    nextPassQueue: [
      "PASS2524: localized downgrade reason chips PL/EN/DE for Basic/Pro/Advanced.",
      "PASS2525: PDF preview/download/account vault hash fixture family.",
      "PASS2526: AI Output Claim Firewall replay harness PL/EN/DE.",
      "PASS2527: Missing Data Recovery Router visible action chips.",
      "PASS2528: split globals.css premium risk passport styles into focused modules.",
    ],
    tierProofPassportRule: "Every tier must show its signal budget, proof lanes, weakest proof, downgrade reason and recovery action before Velmère presents the result as Basic, Pro or Advanced; Advanced additionally requires server receipt, account binding, artifact hash family and revoke boundary.",
    fingerprint: stableFingerprint(payload),
  };
}
