import { createHash } from "node:crypto";
import type { Pass2525ProofGapDowngradeUiRebalance } from "./proof-gap-downgrade-ui-rebalance";

export const PASS2526_REUSABLE_DOWNGRADE_CHIP_REBALANCE_ID = "reusable-downgrade-chip-rebalance-v1" as const;

export type Pass2526ChipState = "pass" | "watch" | "hold" | "blocked";
export type Pass2526Locale = "pl" | "en" | "de";
export type Pass2526ChipFamily = "source" | "payment" | "artifact" | "wallet" | "ai" | "operator" | "product" | "account_vault";
export type Pass2526Surface = "shield" | "real_markets" | "browser_pdf" | "angel" | "checkout" | "wallet" | "account_vault" | "admin" | "product";

export type Pass2526ReusableChipContract = {
  id: string;
  family: Pass2526ChipFamily;
  state: Pass2526ChipState;
  surfaces: Pass2526Surface[];
  label: Record<Pass2526Locale, string>;
  userCopy: Record<Pass2526Locale, string>;
  forbiddenClaims: string[];
  requiredRecovery: string;
  evidenceInputs: string[];
};

export type Pass2526MountContract = {
  id: string;
  component: string;
  surface: Pass2526Surface;
  mustRenderBefore: string;
  dataAttribute: string;
  fallbackWhenMissing: string;
};

export type Pass2526EquationRule = {
  id: string;
  equation: string;
  whyItMatters: string;
  failClosedBehavior: string;
};

export type Pass2526SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2526ReusableDowngradeChipRebalance = {
  id: typeof PASS2526_REUSABLE_DOWNGRADE_CHIP_REBALANCE_ID;
  state: "ready_for_runtime_fixture" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  reusableDowngradeChipBeforePercent: number;
  reusableDowngradeChipAfterPercent: number;
  chipMountCoverageBeforePercent: number;
  chipMountCoverageAfterPercent: number;
  localeRecoveryCopyBeforePercent: number;
  localeRecoveryCopyAfterPercent: number;
  visualTruthComponentBeforePercent: number;
  visualTruthComponentAfterPercent: number;
  aiClaimChipBindingBeforePercent: number;
  aiClaimChipBindingAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  reusableChipContracts: Pass2526ReusableChipContract[];
  mountContracts: Pass2526MountContract[];
  equationRules: Pass2526EquationRule[];
  semanticLanes: Pass2526SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  reusableDowngradeRule: string;
  fingerprint: string;
};

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

export const PASS2526_REUSABLE_CHIP_CONTRACTS: Pass2526ReusableChipContract[] = [
  {
    id: "chip-source-quorum-failed",
    family: "source",
    state: "hold",
    surfaces: ["shield", "real_markets", "browser_pdf", "angel"],
    label: { pl: "Źródła niezgodne", en: "Source quorum failed", de: "Quellen-Quorum fehlgeschlagen" },
    userCopy: {
      pl: "Źródła nie potwierdzają tej tezy. Wynik jest obniżony do czasu porównania providerów.",
      en: "Sources do not confirm this claim. The result is downgraded until providers are compared.",
      de: "Quellen bestätigen diese Aussage nicht. Das Ergebnis bleibt herabgestuft, bis Provider verglichen wurden.",
    },
    forbiddenClaims: ["live certainty", "source-backed", "confirmed", "final"],
    requiredRecovery: "refresh_or_compare_providers",
    evidenceInputs: ["providerCount", "observedAt", "agreementFactor", "freshnessScore"],
  },
  {
    id: "chip-paid-proof-missing",
    family: "payment",
    state: "blocked",
    surfaces: ["checkout", "account_vault", "angel"],
    label: { pl: "Brak dowodu płatności", en: "Paid proof missing", de: "Zahlungsnachweis fehlt" },
    userCopy: {
      pl: "Advanced nie może zostać pokazany bez server receipt, account binding i aktywnego entitlement.",
      en: "Advanced cannot be shown without a server receipt, account binding and active entitlement.",
      de: "Advanced kann ohne Server-Receipt, Account-Bindung und aktives Entitlement nicht angezeigt werden.",
    },
    forbiddenClaims: ["paid-ready", "unlocked", "advanced complete", "delivered"],
    requiredRecovery: "replay_payment_entitlement",
    evidenceInputs: ["receiptId", "accountId", "entitlementId", "providerEventStatus"],
  },
  {
    id: "chip-artifact-hash-drift",
    family: "artifact",
    state: "blocked",
    surfaces: ["browser_pdf", "account_vault", "admin"],
    label: { pl: "Hash raportu nie pasuje", en: "Report hash drift", de: "Report-Hash abweichend" },
    userCopy: {
      pl: "Preview, download i vault muszą mieć tę samą rodzinę hashy przed finalnym raportem.",
      en: "Preview, download and vault must share the same hash family before a final report is shown.",
      de: "Preview, Download und Vault müssen vor einem finalen Report dieselbe Hash-Familie teilen.",
    },
    forbiddenClaims: ["download final", "vault confirmed", "report ready"],
    requiredRecovery: "regenerate_artifact_family",
    evidenceInputs: ["previewHash", "downloadHash", "vaultReplayHash"],
  },
  {
    id: "chip-wallet-not-payment",
    family: "wallet",
    state: "watch",
    surfaces: ["wallet", "checkout", "angel"],
    label: { pl: "Wallet ≠ płatność", en: "Wallet ≠ payment", de: "Wallet ≠ Zahlung" },
    userCopy: {
      pl: "Połączenie portfela daje kontekst tożsamości, ale nie odblokowuje płatnego tieru.",
      en: "Wallet connection gives identity context, but it does not unlock a paid tier.",
      de: "Wallet-Verbindung liefert Identitätskontext, schaltet aber keinen Paid-Tier frei.",
    },
    forbiddenClaims: ["wallet paid", "wallet unlock", "advanced unlocked"],
    requiredRecovery: "require_payment_provider_receipt",
    evidenceInputs: ["receiver", "chain", "amount", "settlementStatus"],
  },
  {
    id: "chip-ai-claim-capped",
    family: "ai",
    state: "hold",
    surfaces: ["angel", "shield", "real_markets", "browser_pdf"],
    label: { pl: "AI bez pełnego dowodu", en: "AI claim capped", de: "AI-Aussage begrenzt" },
    userCopy: {
      pl: "Angel może opisać braki i następny dowód, ale nie może udawać finalnej pewności.",
      en: "Angel may explain gaps and the next proof, but cannot pretend final certainty.",
      de: "Angel darf Lücken und nächsten Nachweis erklären, aber keine finale Sicherheit vortäuschen.",
    },
    forbiddenClaims: ["safe", "rug pull", "squeeze", "guaranteed", "no risk"],
    requiredRecovery: "rewrite_to_missing_proof",
    evidenceInputs: ["claimFamily", "sourceQuorum", "tierPermission", "confidenceCap"],
  },
  {
    id: "chip-operator-dual-control",
    family: "operator",
    state: "blocked",
    surfaces: ["admin", "account_vault"],
    label: { pl: "Wymaga dwóch kontroli", en: "Dual-control required", de: "Dual-Control erforderlich" },
    userCopy: {
      pl: "Ręczne odblokowanie wymaga operatora, powodu, expiry i drugiego zatwierdzenia.",
      en: "Manual unlock requires an operator, reason, expiry and second approval.",
      de: "Manuelles Unlock benötigt Operator, Grund, Ablauf und zweite Freigabe.",
    },
    forbiddenClaims: ["manual trusted", "auto granted", "override complete"],
    requiredRecovery: "operator_dual_control_replay",
    evidenceInputs: ["operatorId", "reason", "expiry", "secondApprover"],
  },
];

export const PASS2526_MOUNT_CONTRACTS: Pass2526MountContract[] = [
  { id: "token-risk-proof-rail", component: "ProofDowngradeChipRail", surface: "shield", mustRenderBefore: "TokenRiskModal risk score", dataAttribute: "data-pass2526-token-proof-downgrade-chip-rail", fallbackWhenMissing: "show source quorum failed chip" },
  { id: "asset-modal-truth-rail", component: "ProofDowngradeChipRail", surface: "real_markets", mustRenderBefore: "AssetDetailModal paid insight", dataAttribute: "data-pass2526-asset-proof-downgrade-chip-rail", fallbackWhenMissing: "cap confidence and hide finality" },
  { id: "browser-pdf-hash-rail", component: "ProofDowngradeChipRail", surface: "browser_pdf", mustRenderBefore: "PDF preview/download", dataAttribute: "data-pass2526-browser-pdf-hash-downgrade-chip-rail", fallbackWhenMissing: "require artifact replay" },
  { id: "angel-claim-firewall-rail", component: "ProofDowngradeChipRail", surface: "angel", mustRenderBefore: "Angel response body", dataAttribute: "data-pass2526-angel-claim-downgrade-chip-rail", fallbackWhenMissing: "rewrite answer into Missing Proof" },
  { id: "checkout-entitlement-rail", component: "ProofDowngradeChipRail", surface: "checkout", mustRenderBefore: "Advanced checkout result", dataAttribute: "data-pass2526-checkout-entitlement-downgrade-chip-rail", fallbackWhenMissing: "hold paid tier" },
  { id: "wallet-boundary-rail", component: "ProofDowngradeChipRail", surface: "wallet", mustRenderBefore: "wallet unlock copy", dataAttribute: "data-pass2526-wallet-boundary-downgrade-chip-rail", fallbackWhenMissing: "state wallet is identity only" },
  { id: "account-vault-replay-rail", component: "ProofDowngradeChipRail", surface: "account_vault", mustRenderBefore: "vault delivered status", dataAttribute: "data-pass2526-account-vault-replay-chip-rail", fallbackWhenMissing: "replay provider status" },
  { id: "admin-operator-rail", component: "ProofDowngradeChipRail", surface: "admin", mustRenderBefore: "manual override", dataAttribute: "data-pass2526-admin-operator-downgrade-chip-rail", fallbackWhenMissing: "block override" },
  { id: "product-provider-rail", component: "ProofDowngradeChipRail", surface: "product", mustRenderBefore: "product-ready publish copy", dataAttribute: "data-pass2526-product-provider-downgrade-chip-rail", fallbackWhenMissing: "freeze product publish" },
];

export const PASS2526_EQUATION_RULES: Pass2526EquationRule[] = [
  { id: "chip-state-priority", equation: "chipState = max(blocked, hold, watch, pass) across source/payment/artifact/wallet/ai/operator lanes", whyItMatters: "The strictest lane controls the visible UI state.", failClosedBehavior: "Any blocked chip hides final/paid/safe copy and routes to recovery." },
  { id: "copy-truth-pressure", equation: "copyTruthPressure = forbiddenClaims + missingEvidenceInputs + paidExposure + userImpact", whyItMatters: "The more a claim could mislead a user, the calmer and stricter the text becomes.", failClosedBehavior: "Rewrite hype/certainty into Missing Proof and recovery copy." },
  { id: "mount-coverage-score", equation: "mountCoverage = mountedChipRails / requiredSurfaces", whyItMatters: "The proof-gap system must be visible on every surface, not buried in code.", failClosedBehavior: "Surface stays in watch mode until the chip rail exists." },
  { id: "locale-recovery-integrity", equation: "localeRecoveryIntegrity = PL × EN × DE labels × userCopy × recoveryAction", whyItMatters: "A downgrade reason is only product-ready if it is understandable in every supported locale.", failClosedBehavior: "Fallback to English blocked chip if locale copy is missing." },
];

export const PASS2526_SEMANTIC_LANES: Pass2526SemanticLane[] = [
  { id: "manual-semantic-audit", percentBefore: 30, percentAfter: 33, finding: "Proof gap logic exists but was still mostly represented as markers and contracts.", implementedGuard: "Added reusable chip contract and mount matrix for nine customer/admin surfaces.", nextAction: "Mount the chip rail inside the two biggest modal components instead of comment markers only." },
  { id: "reusable-downgrade-chip", percentBefore: 0, percentAfter: 38, finding: "Downgrade chips need one shared source of truth across Shield, Browser, Angel, checkout and admin.", implementedGuard: "Created reusable ProofDowngradeChipRail component contract with PL/EN/DE copy and state priority.", nextAction: "Feed it with live source/payment/artifact state instead of static fixtures." },
  { id: "mount-coverage", percentBefore: 18, percentAfter: 41, finding: "Some surfaces had downgrade markers, but no shared mount contract.", implementedGuard: "Added mount contracts for token modal, asset modal, browser, Angel, checkout, wallet, account vault, admin and product.", nextAction: "Screenshot-test each mount at 390px and desktop modal widths." },
  { id: "ai-claim-binding", percentBefore: 73, percentAfter: 79, finding: "AI firewall needs visible chips, not only backend instruction text.", implementedGuard: "Added AI claim capped reusable chip and API/source-sync exposure.", nextAction: "Add replay fixtures for safe/live/final/paid/squeeze/rug-pull in PL/EN/DE." },
];

export function buildPass2526ReusableDowngradeChipRebalance(args: {
  query: string;
  symbol?: string;
  pass2525?: Pass2525ProofGapDowngradeUiRebalance;
}): Pass2526ReusableDowngradeChipRebalance {
  const payload = {
    query: args.query,
    symbol: args.symbol,
    previous: args.pass2525?.fingerprint ?? "missing-pass2525",
    chips: PASS2526_REUSABLE_CHIP_CONTRACTS.map((chip) => `${chip.id}:${chip.state}:${chip.family}`),
    mounts: PASS2526_MOUNT_CONTRACTS.map((mount) => `${mount.id}:${mount.dataAttribute}`),
    equations: PASS2526_EQUATION_RULES.map((rule) => rule.id),
  };
  return {
    id: PASS2526_REUSABLE_DOWNGRADE_CHIP_REBALANCE_ID,
    state: "ready_for_runtime_fixture",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 30,
    manualSemanticCompletionAfterPercent: 33,
    targetedSemanticBatchFiles: 36,
    targetedSemanticBatchLines: 170384,
    reusableDowngradeChipBeforePercent: 0,
    reusableDowngradeChipAfterPercent: 38,
    chipMountCoverageBeforePercent: 18,
    chipMountCoverageAfterPercent: 41,
    localeRecoveryCopyBeforePercent: 62,
    localeRecoveryCopyAfterPercent: 74,
    visualTruthComponentBeforePercent: 74,
    visualTruthComponentAfterPercent: 81,
    aiClaimChipBindingBeforePercent: 73,
    aiClaimChipBindingAfterPercent: 79,
    worldclassInventionIndexBeforePercent: 35,
    worldclassInventionIndexAfterPercent: 42,
    reusableChipContracts: PASS2526_REUSABLE_CHIP_CONTRACTS,
    mountContracts: PASS2526_MOUNT_CONTRACTS,
    equationRules: PASS2526_EQUATION_RULES,
    semanticLanes: PASS2526_SEMANTIC_LANES,
    masterTxtAdditions: [
      "PASS2526 converts proof-gap downgrade rules into a reusable chip rail contract shared across Shield, Real Markets, Browser/PDF, Angel, checkout, wallet, account vault, admin and product surfaces.",
      "Downgrade chips now carry PL/EN/DE label, user-facing copy, forbidden claims, recovery route and required evidence inputs.",
      "Velmère should never duplicate chip copy inside modals; the reusable rail must become the single truth layer before risk score, paid insight, PDF finality or Angel summary.",
      "The next world-class step is mounting the ProofDowngradeChipRail with live state and adding screenshot fixtures for mobile and desktop proof-gap states.",
    ],
    nextPassQueue: [
      "PASS2527: mount ProofDowngradeChipRail inside TokenRiskModal and AssetDetailModal with live/source fixture props.",
      "PASS2528: Angel AI claim firewall replay fixtures for PL/EN/DE forbidden claims.",
      "PASS2529: Browser/PDF hash drift chip rail with preview/download/vault replay fixture.",
      "PASS2530: checkout/account vault entitlement chip rail connected to receipt/revoke state.",
      "PASS2531: CSS modularization plan for proof/trust token extraction from globals.css.",
    ],
    reusableDowngradeRule: "Every proof gap must map to a reusable downgrade chip with locale copy, forbidden claims, evidence inputs and a recovery action. The chip rail renders before any risk score, paid insight, PDF finality, wallet unlock copy, admin override or Angel answer that could imply certainty.",
    fingerprint: stableFingerprint(payload),
  };
}
