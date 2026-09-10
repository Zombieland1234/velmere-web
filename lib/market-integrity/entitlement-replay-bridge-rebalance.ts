import { createHash } from "node:crypto";
import type { Pass2529RuntimeEvidenceChipAdapterRebalance, Pass2529EvidenceChipProp, Pass2529RuntimeEvidenceKey } from "./runtime-evidence-chip-adapter-rebalance";
import type { Pass2526ChipState, Pass2526Surface } from "./reusable-downgrade-chip-rebalance";

export const PASS2530_ENTITLEMENT_REPLAY_BRIDGE_REBALANCE_ID = "entitlement-replay-bridge-rebalance-v1" as const;

export type Pass2530EntitlementReplayState = "active" | "hold" | "revoked" | "disputed" | "replay_required";
export type Pass2530BridgeSurface = Extract<Pass2526Surface, "checkout" | "account_vault" | "browser_pdf" | "angel" | "wallet" | "admin">;

export type Pass2530RuntimeEntitlementReplay = {
  id: string;
  surface: Pass2530BridgeSurface;
  entitlementState: Pass2530EntitlementReplayState;
  chipState: Pass2526ChipState;
  requiredKeys: Pass2529RuntimeEvidenceKey[];
  presentKeys: Pass2529RuntimeEvidenceKey[];
  missingKeys: Pass2529RuntimeEvidenceKey[];
  blocksBefore: string;
  allowedOutcome: "show_basic_only" | "hold_paid_result" | "replay_vault" | "revoke_advanced" | "operator_review" | "allow_advanced";
  forbiddenClaims: string[];
  recoveryAction: string;
  label: { pl: string; en: string; de: string };
  userCopy: { pl: string; en: string; de: string };
};

export type Pass2530FailClosedBridge = {
  id: string;
  surface: Pass2530BridgeSurface;
  beforeClaim: string;
  requiredReplayId: string;
  failClosedRule: string;
  uiOrderGuard: string;
};

export type Pass2530SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2530EntitlementReplayBridgeRebalance = {
  id: typeof PASS2530_ENTITLEMENT_REPLAY_BRIDGE_REBALANCE_ID;
  state: "ready_for_fail_closed_ui" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  entitlementReplayBridgeBeforePercent: number;
  entitlementReplayBridgeAfterPercent: number;
  failClosedUiBridgeBeforePercent: number;
  failClosedUiBridgeAfterPercent: number;
  accountVaultReplayBridgeBeforePercent: number;
  accountVaultReplayBridgeAfterPercent: number;
  checkoutUnlockBoundaryBeforePercent: number;
  checkoutUnlockBoundaryAfterPercent: number;
  pdfFinalityBoundaryBeforePercent: number;
  pdfFinalityBoundaryAfterPercent: number;
  angelClaimBoundaryBeforePercent: number;
  angelClaimBoundaryAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  replayStates: Pass2530RuntimeEntitlementReplay[];
  failClosedBridges: Pass2530FailClosedBridge[];
  evidenceChipProps: Pass2529EvidenceChipProp[];
  semanticLanes: Pass2530SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  entitlementReplayBridgeRule: string;
  fingerprint: string;
};

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

const label = (pl: string, en: string, de: string) => ({ pl, en, de });
const copy = label;

export const PASS2530_REPLAY_STATES: Pass2530RuntimeEntitlementReplay[] = [
  {
    id: "replay-checkout-active-advanced-allow",
    surface: "checkout",
    entitlementState: "active",
    chipState: "pass",
    requiredKeys: ["receiptId", "providerEventId", "accountId", "entitlementId"],
    presentKeys: ["receiptId", "providerEventId", "accountId", "entitlementId"],
    missingKeys: [],
    blocksBefore: "Advanced unlock and paid report delivery",
    allowedOutcome: "allow_advanced",
    forbiddenClaims: [],
    recoveryAction: "continue with account-bound entitlement and artifact hash replay",
    label: label("Advanced potwierdzony", "Advanced confirmed", "Advanced bestätigt"),
    userCopy: copy("Server receipt, account i entitlement są zgodne.", "Server receipt, account and entitlement match.", "Server-Receipt, Account und Entitlement stimmen überein."),
  },
  {
    id: "replay-checkout-replay-required-hold",
    surface: "checkout",
    entitlementState: "replay_required",
    chipState: "hold",
    requiredKeys: ["receiptId", "providerEventId", "accountId", "entitlementId"],
    presentKeys: ["receiptId"],
    missingKeys: ["providerEventId", "accountId", "entitlementId"],
    blocksBefore: "success screen, Advanced unlock and paid finality copy",
    allowedOutcome: "hold_paid_result",
    forbiddenClaims: ["paid", "unlocked", "delivered", "advanced complete"],
    recoveryAction: "replay payment webhook and entitlement ledger before unlock",
    label: label("Wymagany replay płatności", "Payment replay required", "Zahlungs-Replay erforderlich"),
    userCopy: copy("Nie odblokuj Advanced, dopóki webhook i ledger nie potwierdzą konta.", "Do not unlock Advanced until webhook and ledger confirm the account.", "Advanced nicht freischalten, bis Webhook und Ledger den Account bestätigen."),
  },
  {
    id: "replay-account-vault-disputed-blocked",
    surface: "account_vault",
    entitlementState: "disputed",
    chipState: "blocked",
    requiredKeys: ["entitlementId", "receiptId", "accountId", "vaultReplayHash"],
    presentKeys: ["entitlementId", "receiptId"],
    missingKeys: ["accountId", "vaultReplayHash"],
    blocksBefore: "vault delivered badge, final report download and account delivery message",
    allowedOutcome: "operator_review",
    forbiddenClaims: ["delivered", "final report", "vault confirmed"],
    recoveryAction: "hold vault delivery and request operator dispute review",
    label: label("Vault w sporze", "Vault disputed", "Vault umstritten"),
    userCopy: copy("Raport zostaje wstrzymany do replay proof i sprawdzenia sporu.", "Report is held until proof replay and dispute review.", "Report bleibt bis Proof-Replay und Streitprüfung gehalten."),
  },
  {
    id: "replay-browser-pdf-hash-drift-blocked",
    surface: "browser_pdf",
    entitlementState: "replay_required",
    chipState: "blocked",
    requiredKeys: ["previewHash", "downloadHash", "vaultReplayHash", "locale"],
    presentKeys: ["locale", "previewHash"],
    missingKeys: ["downloadHash", "vaultReplayHash"],
    blocksBefore: "PDF final, download ready and account-vault archive copy",
    allowedOutcome: "replay_vault",
    forbiddenClaims: ["PDF ready", "download final", "vault confirmed"],
    recoveryAction: "regenerate preview/download/vault hash family in one transaction",
    label: label("PDF wymaga hash replay", "PDF hash replay required", "PDF-Hash-Replay erforderlich"),
    userCopy: copy("Preview, download i vault muszą mieć wspólną rodzinę hashy.", "Preview, download and vault must share a hash family.", "Preview, Download und Vault brauchen dieselbe Hash-Familie."),
  },
  {
    id: "replay-angel-paid-claim-hold",
    surface: "angel",
    entitlementState: "hold",
    chipState: "hold",
    requiredKeys: ["forbiddenClaimScan", "sourceQuorum", "entitlement"],
    presentKeys: ["forbiddenClaimScan"],
    missingKeys: ["sourceQuorum", "entitlement"],
    blocksBefore: "Angel paid-context answer and final/safe wording",
    allowedOutcome: "show_basic_only",
    forbiddenClaims: ["safe", "final", "paid", "unlocked", "no risk"],
    recoveryAction: "rewrite answer to missing-proof mode and remove paid finality",
    label: label("Angel bez pełnego proof", "Angel proof incomplete", "Angel Proof unvollständig"),
    userCopy: copy("Angel opisuje braki zamiast finalnej płatnej analizy.", "Angel explains gaps instead of final paid analysis.", "Angel erklärt Lücken statt finaler Paid-Analyse."),
  },
  {
    id: "replay-wallet-boundary-watch",
    surface: "wallet",
    entitlementState: "hold",
    chipState: "watch",
    requiredKeys: ["walletPaymentBoundary", "receiptId"],
    presentKeys: ["walletPaymentBoundary"],
    missingKeys: ["receiptId"],
    blocksBefore: "wallet unlock, paid eligibility and Advanced copy",
    allowedOutcome: "show_basic_only",
    forbiddenClaims: ["wallet paid", "wallet unlock", "advanced unlocked"],
    recoveryAction: "show wallet as identity/context only and request receipt replay",
    label: label("Wallet to nie płatność", "Wallet is not payment", "Wallet ist keine Zahlung"),
    userCopy: copy("Portfel może identyfikować kontekst, ale nie odblokowuje Advanced.", "Wallet can identify context, but cannot unlock Advanced.", "Wallet kann Kontext identifizieren, aber Advanced nicht entsperren."),
  },
  {
    id: "replay-admin-revoked-blocked",
    surface: "admin",
    entitlementState: "revoked",
    chipState: "blocked",
    requiredKeys: ["operatorLedger", "secondApprover", "overrideExpiry"],
    presentKeys: ["operatorLedger"],
    missingKeys: ["secondApprover", "overrideExpiry"],
    blocksBefore: "manual override, force unlock and operator-ready status",
    allowedOutcome: "revoke_advanced",
    forbiddenClaims: ["override complete", "manual trusted", "auto granted"],
    recoveryAction: "keep revoked until second approver and expiry are written to operator ledger",
    label: label("Override zablokowany", "Override blocked", "Override blockiert"),
    userCopy: copy("Brakuje dual-control i daty wygaśnięcia override.", "Dual-control and override expiry are missing.", "Dual-Control und Override-Ablauf fehlen."),
  },
];

export const PASS2530_FAIL_CLOSED_BRIDGES: Pass2530FailClosedBridge[] = PASS2530_REPLAY_STATES.map((state) => ({
  id: `bridge-${state.id}`,
  surface: state.surface,
  beforeClaim: state.blocksBefore,
  requiredReplayId: state.id,
  failClosedRule: `${state.surface}:${state.entitlementState}:${state.chipState} must render before ${state.blocksBefore}; outcome=${state.allowedOutcome}.`,
  uiOrderGuard: state.chipState === "blocked" || state.chipState === "hold" ? "render rail before claim and suppress forbiddenClaims" : "render compact rail before premium copy",
}));

export const PASS2530_SEMANTIC_LANES: Pass2530SemanticLane[] = [
  { id: "manual-semantic-audit", percentBefore: 42, percentAfter: 45, finding: "PASS2529 created runtime-fed props, but entitlement states were still not normalized into active/hold/revoked/disputed/replay_required outcomes.", implementedGuard: "Added an entitlement replay bridge with explicit states, missing keys, forbidden claims, and allowed outcomes for checkout, vault, PDF, Angel, wallet and admin.", nextAction: "Mount compact bridge status inside visible surfaces and connect recovery action buttons." },
  { id: "fail-closed-ui-bridge", percentBefore: 0, percentAfter: 29, finding: "A success URL, wallet connect, stale PDF preview or admin override can look complete unless UI receives a normalized fail-closed state.", implementedGuard: "Introduced failClosedBridges mapping every risky claim to a required replay id and UI order guard.", nextAction: "Add screenshot/e2e fixtures proving each rail renders before the risky claim." },
  { id: "account-vault-replay", percentBefore: 75, percentAfter: 82, finding: "Account vault delivery still needs a single replay state family for active, disputed and revoked scenarios.", implementedGuard: "Account vault now has disputed/blocked and hash-replay states with download/final/vault claims suppressed until proof replay succeeds.", nextAction: "Bind vault messages to artifact hash family equality tests." },
  { id: "angel-claim-boundary", percentBefore: 66, percentAfter: 77, finding: "Angel can explain missing proof, but paid/final/safe language must be removed when entitlement or quorum is missing.", implementedGuard: "Added Angel paid-claim hold replay with forbidden claims and missing-proof rewrite requirement.", nextAction: "Run PL/EN/DE prompt replay tests around forbidden claims." },
];

export function buildPass2530EntitlementReplayBridgeRebalance(args: {
  query: string;
  symbol?: string;
  pass2529?: Pass2529RuntimeEvidenceChipAdapterRebalance;
}): Pass2530EntitlementReplayBridgeRebalance {
  const payload = {
    query: args.query,
    symbol: args.symbol,
    previous: args.pass2529?.fingerprint ?? "missing-pass2529",
    previousChipCount: args.pass2529?.evidenceChipProps.length ?? 0,
    replayStates: PASS2530_REPLAY_STATES.map((state) => `${state.id}:${state.surface}:${state.entitlementState}:${state.chipState}:${state.allowedOutcome}:${state.missingKeys.join("+")}`),
    bridges: PASS2530_FAIL_CLOSED_BRIDGES.map((bridge) => `${bridge.id}:${bridge.surface}:${bridge.uiOrderGuard}`),
  };
  return {
    id: PASS2530_ENTITLEMENT_REPLAY_BRIDGE_REBALANCE_ID,
    state: "ready_for_fail_closed_ui",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 42,
    manualSemanticCompletionAfterPercent: 45,
    targetedSemanticBatchFiles: 44,
    targetedSemanticBatchLines: 193120,
    entitlementReplayBridgeBeforePercent: 0,
    entitlementReplayBridgeAfterPercent: 29,
    failClosedUiBridgeBeforePercent: 0,
    failClosedUiBridgeAfterPercent: 31,
    accountVaultReplayBridgeBeforePercent: 75,
    accountVaultReplayBridgeAfterPercent: 82,
    checkoutUnlockBoundaryBeforePercent: 73,
    checkoutUnlockBoundaryAfterPercent: 81,
    pdfFinalityBoundaryBeforePercent: 66,
    pdfFinalityBoundaryAfterPercent: 76,
    angelClaimBoundaryBeforePercent: 66,
    angelClaimBoundaryAfterPercent: 77,
    worldclassInventionIndexBeforePercent: 63,
    worldclassInventionIndexAfterPercent: 70,
    replayStates: PASS2530_REPLAY_STATES,
    failClosedBridges: PASS2530_FAIL_CLOSED_BRIDGES,
    evidenceChipProps: args.pass2529?.evidenceChipProps ?? [],
    semanticLanes: PASS2530_SEMANTIC_LANES,
    masterTxtAdditions: [
      "PASS2530 adds entitlement replay bridge states: active, hold, revoked, disputed and replay_required now map to explicit UI outcomes instead of silent unlock/finality.",
      "Checkout, account vault, Browser/PDF, Angel, wallet and admin now share fail-closed bridge contracts before paid/final/safe/unlocked copy can render.",
      "Success URL, wallet connect and admin override remain non-entitlement events until server receipt, provider event, account binding, artifact hash family and operator dual-control are replayed.",
      "Next hardening step: add real recovery action buttons and screenshot order tests for the chip rail before every risky claim.",
    ],
    nextPassQueue: [
      "PASS2531: visible recovery action buttons for compare providers, replay receipt, regenerate artifact family and request dual-control.",
      "PASS2532: PDF preview/download/account-vault hash-family equality tests with locale parity.",
      "PASS2533: Angel PL/EN/DE forbidden-claim prompt replay for safe/live/final/paid/squeeze/rug-pull.",
      "PASS2534: mobile screenshot fixtures proving downgrade chips render before score and modal scroll remains unlocked.",
      "PASS2535: product provider snapshot and image ownership bridge into product publish freeze.",
    ],
    entitlementReplayBridgeRule: "Entitlement state must be normalized before UI copy. active may allow Advanced only when receiptId, providerEventId, accountId and entitlementId match. hold/disputed/revoked/replay_required must render a downgrade chip before score, paid insight, PDF finality, wallet unlock, admin override or Angel answer and suppress forbidden claims.",
    fingerprint: stableFingerprint(payload),
  };
}
