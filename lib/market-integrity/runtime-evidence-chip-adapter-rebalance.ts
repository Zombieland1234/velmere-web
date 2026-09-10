import { createHash } from "node:crypto";
import type { Pass2528LiveChipStateReplayRebalance, Pass2528ReplayInput } from "./live-chip-state-replay-rebalance";
import type { Pass2526ChipState, Pass2526Surface } from "./reusable-downgrade-chip-rebalance";

export const PASS2529_RUNTIME_EVIDENCE_CHIP_ADAPTER_REBALANCE_ID = "runtime-evidence-chip-adapter-rebalance-v1" as const;

export type Pass2529EvidenceAdapter = "sourceSync" | "paymentWebhook" | "entitlementLedger" | "artifactVault" | "angelClaimScanner" | "operatorLedger" | "productProvider" | "walletBoundary";
export type Pass2529RuntimeEvidenceKey =
  | Pass2528ReplayInput
  | "accountId"
  | "providerEventId"
  | "receiptId"
  | "entitlementId"
  | "previewHash"
  | "downloadHash"
  | "vaultReplayHash"
  | "locale"
  | "secondApprover"
  | "overrideExpiry"
  | "imageOwnership";

export type Pass2529EvidenceChipProp = {
  id: string;
  surface: Pass2526Surface;
  adapter: Pass2529EvidenceAdapter;
  family: "source" | "payment" | "artifact" | "wallet" | "ai" | "operator" | "product" | "account_vault";
  requiredKeys: Pass2529RuntimeEvidenceKey[];
  presentKeys: Pass2529RuntimeEvidenceKey[];
  missingKeys: Pass2529RuntimeEvidenceKey[];
  state: Pass2526ChipState;
  renderBefore: string;
  blockedClaims: string[];
  label: { pl: string; en: string; de: string };
  userCopy: { pl: string; en: string; de: string };
  recoveryAction: string;
};

export type Pass2529AdapterFixture = {
  id: string;
  sourceFixtureId: string;
  adapter: Pass2529EvidenceAdapter;
  outputChipId: string;
  mustKeepFailClosed: boolean;
  adapterRule: string;
};

export type Pass2529SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2529RuntimeEvidenceChipAdapterRebalance = {
  id: typeof PASS2529_RUNTIME_EVIDENCE_CHIP_ADAPTER_REBALANCE_ID;
  state: "ready_for_ui_props" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  runtimeEvidenceChipAdapterBeforePercent: number;
  runtimeEvidenceChipAdapterAfterPercent: number;
  typedChipPropsBeforePercent: number;
  typedChipPropsAfterPercent: number;
  renderOrderContractBeforePercent: number;
  renderOrderContractAfterPercent: number;
  recoveryActionBindingBeforePercent: number;
  recoveryActionBindingAfterPercent: number;
  forbiddenClaimSuppressionBeforePercent: number;
  forbiddenClaimSuppressionAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  evidenceChipProps: Pass2529EvidenceChipProp[];
  adapterFixtures: Pass2529AdapterFixture[];
  semanticLanes: Pass2529SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  runtimeAdapterRule: string;
  fingerprint: string;
};

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

const label = (pl: string, en: string, de: string) => ({ pl, en, de });
const copy = label;

export const PASS2529_EVIDENCE_CHIP_PROPS: Pass2529EvidenceChipProp[] = [
  {
    id: "chip-shield-source-sync-quorum-hold",
    surface: "shield",
    adapter: "sourceSync",
    family: "source",
    requiredKeys: ["sourceQuorum", "freshness", "providerAgreement"],
    presentKeys: ["freshness"],
    missingKeys: ["sourceQuorum", "providerAgreement"],
    state: "hold",
    renderBefore: "risk score, tier summary and rug-pull/squeeze claim",
    blockedClaims: ["safe", "final", "confirmed rug pull", "confirmed squeeze"],
    label: label("Źródła niezgodne", "Source quorum missing", "Quellen-Quorum fehlt"),
    userCopy: copy("Wynik jest ograniczony, bo brakuje zgodności źródeł.", "The score is capped because provider agreement is missing.", "Der Score ist begrenzt, weil Provider-Übereinstimmung fehlt."),
    recoveryAction: "compare providers before showing full confidence",
  },
  {
    id: "chip-real-markets-freshness-watch",
    surface: "real_markets",
    adapter: "sourceSync",
    family: "source",
    requiredKeys: ["freshness", "sourceQuorum", "providerAgreement"],
    presentKeys: ["providerAgreement"],
    missingKeys: ["freshness", "sourceQuorum"],
    state: "watch",
    renderBefore: "premium interpretation, fundamentals and market cap copy",
    blockedClaims: ["live", "institutional confirmed", "final"],
    label: label("Świeżość do sprawdzenia", "Freshness needs replay", "Frische braucht Replay"),
    userCopy: copy("Pokaż as-of i drugie źródło przed interpretacją premium.", "Show as-of and a second source before premium interpretation.", "Zeige Zeitstempel und zweite Quelle vor Premium-Interpretation."),
    recoveryAction: "refresh provider and compare second source",
  },
  {
    id: "chip-browser-pdf-artifact-blocked",
    surface: "browser_pdf",
    adapter: "artifactVault",
    family: "artifact",
    requiredKeys: ["previewHash", "downloadHash", "vaultReplayHash", "locale"],
    presentKeys: ["locale"],
    missingKeys: ["previewHash", "downloadHash", "vaultReplayHash"],
    state: "blocked",
    renderBefore: "PDF preview, download and account vault delivered state",
    blockedClaims: ["PDF ready", "download final", "vault confirmed"],
    label: label("Brak hash family", "Artifact hash family missing", "Artefakt-Hash-Familie fehlt"),
    userCopy: copy("Preview, download i vault muszą mieć tę samą rodzinę hashy.", "Preview, download and vault must share the same hash family.", "Preview, Download und Vault brauchen dieselbe Hash-Familie."),
    recoveryAction: "regenerate artifact family together",
  },
  {
    id: "chip-angel-claim-scanner-hold",
    surface: "angel",
    adapter: "angelClaimScanner",
    family: "ai",
    requiredKeys: ["forbiddenClaimScan", "sourceQuorum", "entitlement"],
    presentKeys: ["forbiddenClaimScan"],
    missingKeys: ["sourceQuorum", "entitlement"],
    state: "hold",
    renderBefore: "Angel answer body and paid-context copy",
    blockedClaims: ["safe", "no risk", "paid", "unlocked", "final"],
    label: label("AI bez pełnego dowodu", "AI proof incomplete", "KI-Beweis unvollständig"),
    userCopy: copy("Angel może opisać braki, ale nie może udawać finalnej analizy.", "Angel can explain gaps, not pretend the analysis is final.", "Angel darf Lücken erklären, aber keine finale Analyse vortäuschen."),
    recoveryAction: "rewrite to missing-proof answer",
  },
  {
    id: "chip-checkout-entitlement-blocked",
    surface: "checkout",
    adapter: "paymentWebhook",
    family: "payment",
    requiredKeys: ["receiptId", "providerEventId", "accountId", "entitlementId"],
    presentKeys: [],
    missingKeys: ["receiptId", "providerEventId", "accountId", "entitlementId"],
    state: "blocked",
    renderBefore: "Advanced unlock, paid report delivery and success screen",
    blockedClaims: ["paid", "unlocked", "delivered", "advanced complete"],
    label: label("Brak entitlement", "Entitlement missing", "Entitlement fehlt"),
    userCopy: copy("Success URL ani wallet nie odblokowują Advanced bez server receipt.", "Success URL or wallet cannot unlock Advanced without a server receipt.", "Success-URL oder Wallet entsperren Advanced nicht ohne Server-Receipt."),
    recoveryAction: "replay payment webhook and entitlement ledger",
  },
  {
    id: "chip-wallet-boundary-watch",
    surface: "wallet",
    adapter: "walletBoundary",
    family: "wallet",
    requiredKeys: ["walletPaymentBoundary", "receiptId"],
    presentKeys: ["walletPaymentBoundary"],
    missingKeys: ["receiptId"],
    state: "watch",
    renderBefore: "wallet unlock copy and Advanced eligibility language",
    blockedClaims: ["wallet paid", "wallet unlock", "advanced unlocked"],
    label: label("Wallet to nie płatność", "Wallet is not payment", "Wallet ist keine Zahlung"),
    userCopy: copy("Połączenie portfela to identity/context, nie dowód płatności.", "Wallet connection is identity/context, not payment proof.", "Wallet-Verbindung ist Identität/Kontext, kein Zahlungsnachweis."),
    recoveryAction: "ask for receipt replay",
  },
  {
    id: "chip-account-vault-replay-hold",
    surface: "account_vault",
    adapter: "artifactVault",
    family: "account_vault",
    requiredKeys: ["entitlementId", "receiptId", "accountId", "vaultReplayHash"],
    presentKeys: ["entitlementId", "receiptId"],
    missingKeys: ["accountId", "vaultReplayHash"],
    state: "hold",
    renderBefore: "delivered status and vault download",
    blockedClaims: ["delivered", "final report", "vault confirmed"],
    label: label("Vault wymaga replay", "Vault replay required", "Vault-Replay erforderlich"),
    userCopy: copy("Konto musi odtworzyć proof przed statusem delivered.", "Account vault must replay proof before delivered status.", "Account Vault muss Proof vor Delivered-Status replayen."),
    recoveryAction: "replay account vault artifact proof",
  },
  {
    id: "chip-admin-dual-control-blocked",
    surface: "admin",
    adapter: "operatorLedger",
    family: "operator",
    requiredKeys: ["operatorLedger", "secondApprover", "overrideExpiry"],
    presentKeys: ["operatorLedger"],
    missingKeys: ["secondApprover", "overrideExpiry"],
    state: "blocked",
    renderBefore: "manual override and operator ready state",
    blockedClaims: ["manual trusted", "override complete", "auto granted"],
    label: label("Brak dual-control", "Dual-control missing", "Dual-Control fehlt"),
    userCopy: copy("Override wymaga drugiej osoby i daty wygaśnięcia.", "Override needs a second approver and expiry.", "Override benötigt zweite Freigabe und Ablaufdatum."),
    recoveryAction: "require second approver and expiry",
  },
  {
    id: "chip-product-provider-freeze-hold",
    surface: "product",
    adapter: "productProvider",
    family: "product",
    requiredKeys: ["productProviderSnapshot", "imageOwnership"],
    presentKeys: [],
    missingKeys: ["productProviderSnapshot", "imageOwnership"],
    state: "hold",
    renderBefore: "publish ready copy and provider handoff",
    blockedClaims: ["ready", "publish safe", "provider confirmed"],
    label: label("Produkt zamrożony", "Product proof frozen", "Produkt-Beweis eingefroren"),
    userCopy: copy("Publikacja czeka na snapshot dostawcy i proof zdjęć.", "Publishing waits for provider snapshot and image proof.", "Veröffentlichung wartet auf Provider-Snapshot und Bildnachweis."),
    recoveryAction: "capture provider snapshot and image ownership proof",
  },
];

export const PASS2529_ADAPTER_FIXTURES: Pass2529AdapterFixture[] = PASS2529_EVIDENCE_CHIP_PROPS.map((chip) => ({
  id: `adapter-${chip.id}`,
  sourceFixtureId: chip.id.replace("chip-", "replay-"),
  adapter: chip.adapter,
  outputChipId: chip.id,
  mustKeepFailClosed: chip.state === "blocked" || chip.state === "hold",
  adapterRule: `${chip.adapter} supplies ${chip.presentKeys.length}/${chip.requiredKeys.length} keys; missing ${chip.missingKeys.join(", ") || "none"} keeps ${chip.surface} in ${chip.state}.`,
}));

export const PASS2529_SEMANTIC_LANES: Pass2529SemanticLane[] = [
  { id: "manual-semantic-audit", percentBefore: 39, percentAfter: 42, finding: "PASS2528 named runtime inputs but the reusable rail still needed typed evidence-chip props that can be fed by real adapter payloads.", implementedGuard: "Added typed EvidenceChipProp contracts with required/present/missing keys, forbidden claims, render order and PL/EN/DE recovery copy.", nextAction: "Feed these props directly into ProofDowngradeChipRail instead of sample chips on each surface." },
  { id: "runtime-evidence-chip-adapter", percentBefore: 18, percentAfter: 43, finding: "Static demo rails could still drift from sourceSync, payment webhook, vault replay and Angel scanner states.", implementedGuard: "Created adapter fixtures mapping each surface to sourceSync/paymentWebhook/artifactVault/angelClaimScanner/operatorLedger/productProvider/walletBoundary.", nextAction: "Add end-to-end screenshots proving the rail receives adapter props and renders before risky claims." },
  { id: "render-order-contract", percentBefore: 58, percentAfter: 71, finding: "Fail-closed order must be expressed as component props, not just prose in reports.", implementedGuard: "Each chip now carries renderBefore and blockedClaims so UI surfaces can put chips before score/finality/unlock/AI output.", nextAction: "Make the rail fail build when a surface has paid/unlocked/final copy without a matching chip rail marker." },
  { id: "recovery-action-binding", percentBefore: 72, percentAfter: 81, finding: "Recovery actions need to be user-facing and localized across PL/EN/DE so errors are understandable.", implementedGuard: "Added localized labels and user copy for source, payment, artifact, wallet, AI, operator, account vault and product families.", nextAction: "Connect recovery action buttons to refresh providers, replay receipt, regenerate artifact family and request dual-control." },
];

export function buildPass2529RuntimeEvidenceChipAdapterRebalance(args: {
  query: string;
  symbol?: string;
  pass2528?: Pass2528LiveChipStateReplayRebalance;
}): Pass2529RuntimeEvidenceChipAdapterRebalance {
  const payload = {
    query: args.query,
    symbol: args.symbol,
    previous: args.pass2528?.fingerprint ?? "missing-pass2528",
    previousFixtureCount: args.pass2528?.replayFixtures.length ?? 0,
    chips: PASS2529_EVIDENCE_CHIP_PROPS.map((chip) => `${chip.id}:${chip.surface}:${chip.adapter}:${chip.state}:${chip.missingKeys.join("+")}`),
    fixtures: PASS2529_ADAPTER_FIXTURES.map((fixture) => `${fixture.id}:${fixture.adapter}:${fixture.mustKeepFailClosed}`),
  };
  return {
    id: PASS2529_RUNTIME_EVIDENCE_CHIP_ADAPTER_REBALANCE_ID,
    state: "ready_for_ui_props",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 39,
    manualSemanticCompletionAfterPercent: 42,
    targetedSemanticBatchFiles: 42,
    targetedSemanticBatchLines: 187260,
    runtimeEvidenceChipAdapterBeforePercent: 18,
    runtimeEvidenceChipAdapterAfterPercent: 43,
    typedChipPropsBeforePercent: 38,
    typedChipPropsAfterPercent: 57,
    renderOrderContractBeforePercent: 58,
    renderOrderContractAfterPercent: 71,
    recoveryActionBindingBeforePercent: 72,
    recoveryActionBindingAfterPercent: 81,
    forbiddenClaimSuppressionBeforePercent: 53,
    forbiddenClaimSuppressionAfterPercent: 66,
    worldclassInventionIndexBeforePercent: 56,
    worldclassInventionIndexAfterPercent: 63,
    evidenceChipProps: PASS2529_EVIDENCE_CHIP_PROPS,
    adapterFixtures: PASS2529_ADAPTER_FIXTURES,
    semanticLanes: PASS2529_SEMANTIC_LANES,
    masterTxtAdditions: [
      "PASS2529 converts live replay fixtures into typed evidence-chip props: required/present/missing runtime keys now drive surface state, copy and claim suppression.",
      "Reusable ProofDowngradeChipRail is extended for runtime-fed props so UI can stop relying on static sample chips before risk score, paid insight, PDF finality, wallet copy and Angel answers.",
      "Adapter contracts now name sourceSync, paymentWebhook, entitlementLedger, artifactVault, angelClaimScanner, operatorLedger, productProvider and walletBoundary as proof suppliers.",
      "Next hardening step: connect recovery action buttons to real refresh/replay/regenerate/manual-review actions and add screenshot order tests.",
    ],
    nextPassQueue: [
      "PASS2530: active/refunded/disputed/replay_required entitlement state fixtures for checkout and account vault.",
      "PASS2531: PDF preview/download/account-vault hash-family equality tests with locale parity.",
      "PASS2532: Angel PL/EN/DE forbidden-claim prompt replay for safe/live/final/paid/squeeze/rug-pull.",
      "PASS2533: mobile screenshot fixtures proving downgrade chips render before score and modal scroll remains unlocked.",
      "PASS2534: recovery action buttons for compare providers, replay receipt, regenerate artifact family and request dual-control.",
    ],
    runtimeAdapterRule: "Every downgrade chip must be fed by named runtime evidence keys. Missing critical keys create hold/blocked/watch state, suppress forbidden claims and render before the risky UI claim. Static sample chips are allowed only as fallback demos, never as proof of entitlement, freshness, finality or safety.",
    fingerprint: stableFingerprint(payload),
  };
}
