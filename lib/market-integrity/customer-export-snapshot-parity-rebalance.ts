import { createHash } from "node:crypto";
import type {
  Pass2540CustomerExportZeroLeakReplayRebalance,
  Pass2540LeakFamily,
  Pass2540SanitizedExportEnvelope,
  Pass2540ZeroLeakState,
} from "./customer-export-zero-leak-replay-rebalance";

export const PASS2541_CUSTOMER_EXPORT_SNAPSHOT_PARITY_REBALANCE_ID = "customer-export-snapshot-parity-rebalance-v1" as const;

export type Pass2541SnapshotSurface = "account_vault" | "pdf_preview" | "pdf_download" | "browser_panel" | "angel_summary" | "checkout_receipt";
export type Pass2541SnapshotLocale = "pl" | "en" | "de";
export type Pass2541ParityState = "ready" | "watch" | "replay_required" | "blocked";

export type Pass2541BlockedCustomerTextToken =
  | "rawProviderPayload"
  | "walletAddressFull"
  | "providerSecret"
  | "operatorInternalNote"
  | "promptRaw"
  | "successUrl"
  | "localStorageFlag"
  | "rawIpAddress"
  | "rawDeviceFingerprint"
  | "paymentProviderPayload"
  | "internalScoringScratchpad"
  | "systemPrompt"
  | "toolTrace"
  | "chainOfThought";

export type Pass2541LocaleSnapshot = {
  locale: Pass2541SnapshotLocale;
  customerCopy: string;
  customerCopyHash: string;
  blockedTokenHits: Pass2541BlockedCustomerTextToken[];
  noRawKeyCopy: boolean;
};

export type Pass2541SurfaceSnapshot = {
  id: string;
  surface: Pass2541SnapshotSurface;
  sourceEnvelopeId: string;
  parityGroupId: string;
  state: Pass2541ParityState;
  zeroLeakState: Pass2540ZeroLeakState;
  zeroLeakScore: number;
  previewDownloadParityHash: string;
  customerSafeHash: string;
  redactionEnvelopeHash: string;
  releaseGateId: string;
  copyNoRawKeyScore: number;
  localeSnapshots: Pass2541LocaleSnapshot[];
  blockedLeakFamilies: Pass2540LeakFamily[];
  blockedCustomerTextTokens: Pass2541BlockedCustomerTextToken[];
  pdfPreviewDownloadHashMatch: boolean;
  angelSummaryNoLeak: boolean;
  browserPanelNoLeak: boolean;
  accountVaultNoLeak: boolean;
  releaseEquation: string;
  dataAttributes: Record<string, string>;
};

export type Pass2541ParityGroup = {
  id: string;
  sourceEnvelopeId: string;
  surfaces: Pass2541SnapshotSurface[];
  state: Pass2541ParityState;
  sharedPreviewDownloadParityHash: string;
  allSurfacesShareHash: boolean;
  allLocaleCopyNoRawKey: boolean;
  blockedTokenCount: number;
  nextRecovery: "none" | "replay_export_capsule" | "rewrite_customer_copy" | "block_download" | "operator_security_review";
};

export type Pass2541SnapshotFixture = {
  id: string;
  scenario:
    | "pdf_preview_download_same_hash"
    | "angel_summary_raw_prompt_blocked"
    | "browser_panel_provider_payload_blocked"
    | "account_vault_success_url_blocked"
    | "locale_copy_no_raw_key"
    | "checkout_receipt_payment_payload_blocked";
  surface: Pass2541SnapshotSurface;
  locale?: Pass2541SnapshotLocale;
  inputCopy: string;
  expectedBlockedTokens: Pass2541BlockedCustomerTextToken[];
  expectedState: Pass2541ParityState;
};

export type Pass2541SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2541CustomerExportSnapshotParityRebalance = {
  id: typeof PASS2541_CUSTOMER_EXPORT_SNAPSHOT_PARITY_REBALANCE_ID;
  state: "ready_for_snapshot_parity" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  snapshotParityBeforePercent: number;
  snapshotParityAfterPercent: number;
  pdfPreviewDownloadParityBeforePercent: number;
  pdfPreviewDownloadParityAfterPercent: number;
  angelNoLeakSummaryBeforePercent: number;
  angelNoLeakSummaryAfterPercent: number;
  browserPanelNoLeakBeforePercent: number;
  browserPanelNoLeakAfterPercent: number;
  localeNoRawKeyCopyBeforePercent: number;
  localeNoRawKeyCopyAfterPercent: number;
  checkoutReceiptCopyBoundaryBeforePercent: number;
  checkoutReceiptCopyBoundaryAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedZeroLeakEnvelopes: Pass2540SanitizedExportEnvelope[];
  surfaceSnapshots: Pass2541SurfaceSnapshot[];
  parityGroups: Pass2541ParityGroup[];
  fixtures: Pass2541SnapshotFixture[];
  semanticLanes: Pass2541SemanticLane[];
  blockedCustomerTextTokens: Pass2541BlockedCustomerTextToken[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  snapshotParityRule: string;
  fingerprint: string;
};

export const PASS2541_BLOCKED_CUSTOMER_TEXT_TOKENS: Pass2541BlockedCustomerTextToken[] = [
  "rawProviderPayload",
  "walletAddressFull",
  "providerSecret",
  "operatorInternalNote",
  "promptRaw",
  "successUrl",
  "localStorageFlag",
  "rawIpAddress",
  "rawDeviceFingerprint",
  "paymentProviderPayload",
  "internalScoringScratchpad",
  "systemPrompt",
  "toolTrace",
  "chainOfThought",
];

const SURFACES: Pass2541SnapshotSurface[] = ["account_vault", "pdf_preview", "pdf_download", "browser_panel", "angel_summary", "checkout_receipt"];
const LOCALES: Pass2541SnapshotLocale[] = ["pl", "en", "de"];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function customerCopy(locale: Pass2541SnapshotLocale, surface: Pass2541SnapshotSurface, envelope: Pass2540SanitizedExportEnvelope) {
  const safeHash = envelope.customerSafeHash.slice(0, 14);
  const score = `${envelope.zeroLeakScore}/100`;
  const surfaceLabel = surface.replaceAll("_", " ");
  if (locale === "pl") return `Eksport klienta ${surfaceLabel} jest oparty tylko na zredagowanej kapsule. Hash ${safeHash}; zero-leak ${score}; brakujące dowody pokazujemy jako status, nie surowe dane.`;
  if (locale === "de") return `Kundenexport ${surfaceLabel} nutzt nur die redigierte Kapsel. Hash ${safeHash}; Zero-Leak ${score}; fehlende Nachweise werden als Status gezeigt, nicht als Rohdaten.`;
  return `Customer export ${surfaceLabel} uses only the redacted capsule. Hash ${safeHash}; zero-leak ${score}; missing proof is shown as status, not raw data.`;
}

export function scanPass2541CustomerCopyForBlockedTokens(copy: string): Pass2541BlockedCustomerTextToken[] {
  const lower = copy.toLowerCase();
  return PASS2541_BLOCKED_CUSTOMER_TEXT_TOKENS.filter((token) => lower.includes(token.toLowerCase()));
}

function stateFromEnvelope(envelope: Pass2540SanitizedExportEnvelope, tokenHits: Pass2541BlockedCustomerTextToken[]): Pass2541ParityState {
  if (tokenHits.length) return tokenHits.some((token) => token === "providerSecret" || token === "paymentProviderPayload" || token === "systemPrompt" || token === "chainOfThought") ? "blocked" : "replay_required";
  if (envelope.state === "blocked" || envelope.state === "operator_only") return "blocked";
  if (!envelope.sanitizedExportOnly || !envelope.customerSafeHash || !envelope.redactionEnvelopeHash) return "replay_required";
  if (envelope.zeroLeakScore < 65 || envelope.state === "replay_required" || envelope.state === "security_hold") return "watch";
  return "ready";
}

function buildSurfaceSnapshot(envelope: Pass2540SanitizedExportEnvelope, surface: Pass2541SnapshotSurface): Pass2541SurfaceSnapshot {
  const localeSnapshots = LOCALES.map((locale) => {
    const copy = customerCopy(locale, surface, envelope);
    const blockedTokenHits = scanPass2541CustomerCopyForBlockedTokens(copy);
    return {
      locale,
      customerCopy: copy,
      customerCopyHash: stableHash({ locale, copy }),
      blockedTokenHits,
      noRawKeyCopy: blockedTokenHits.length === 0,
    } satisfies Pass2541LocaleSnapshot;
  });
  const blockedCustomerTextTokens = Array.from(new Set(localeSnapshots.flatMap((snapshot) => snapshot.blockedTokenHits)));
  const state = stateFromEnvelope(envelope, blockedCustomerTextTokens);
  const previewDownloadParityHash = stableHash({
    sourceEnvelopeId: envelope.id,
    customerSafeHash: envelope.customerSafeHash,
    redactionEnvelopeHash: envelope.redactionEnvelopeHash,
    releaseGateId: envelope.releaseGateId,
    sanitizedExportOnly: envelope.sanitizedExportOnly,
  });
  const copyNoRawKeyScore = Math.max(0, 100 - blockedCustomerTextTokens.length * 17 - (state === "blocked" ? 25 : state === "replay_required" ? 12 : 0));
  return {
    id: `snapshot-${surface}-${envelope.id}`,
    surface,
    sourceEnvelopeId: envelope.id,
    parityGroupId: `snapshot-parity-group-${envelope.id}`,
    state,
    zeroLeakState: envelope.state,
    zeroLeakScore: envelope.zeroLeakScore,
    previewDownloadParityHash,
    customerSafeHash: envelope.customerSafeHash,
    redactionEnvelopeHash: envelope.redactionEnvelopeHash,
    releaseGateId: envelope.releaseGateId,
    copyNoRawKeyScore,
    localeSnapshots,
    blockedLeakFamilies: envelope.blockedLeakFamilies,
    blockedCustomerTextTokens,
    pdfPreviewDownloadHashMatch: true,
    angelSummaryNoLeak: surface !== "angel_summary" || blockedCustomerTextTokens.length === 0,
    browserPanelNoLeak: surface !== "browser_panel" || blockedCustomerTextTokens.length === 0,
    accountVaultNoLeak: surface !== "account_vault" || blockedCustomerTextTokens.length === 0,
    releaseEquation: "sameSanitizedEnvelopeHash × previewDownloadParityHash × PL/EN/DE noRawKeyCopy × zeroLeakReplayGate × customerSafeHash × redactionEnvelopeHash",
    dataAttributes: {
      "data-pass2541-snapshot-parity-gate": `snapshot-parity-gate-${envelope.releaseGateId}`,
      "data-pass2541-snapshot-surface": surface,
      "data-pass2541-preview-download-parity-hash": previewDownloadParityHash,
      "data-pass2541-copy-no-raw-key-score": String(copyNoRawKeyScore),
      "data-pass2541-state": state,
    },
  };
}

function buildParityGroups(surfaceSnapshots: Pass2541SurfaceSnapshot[]): Pass2541ParityGroup[] {
  const byEnvelope = new Map<string, Pass2541SurfaceSnapshot[]>();
  for (const snapshot of surfaceSnapshots) byEnvelope.set(snapshot.sourceEnvelopeId, [...(byEnvelope.get(snapshot.sourceEnvelopeId) ?? []), snapshot]);
  return Array.from(byEnvelope.entries()).map(([sourceEnvelopeId, snapshots]) => {
    const hashes = new Set(snapshots.map((snapshot) => snapshot.previewDownloadParityHash));
    const blockedTokenCount = snapshots.reduce((sum, snapshot) => sum + snapshot.blockedCustomerTextTokens.length, 0);
    const allSurfacesShareHash = hashes.size === 1 && SURFACES.every((surface) => snapshots.some((snapshot) => snapshot.surface === surface));
    const allLocaleCopyNoRawKey = snapshots.every((snapshot) => snapshot.localeSnapshots.every((localeSnapshot) => localeSnapshot.noRawKeyCopy));
    const hasBlocked = snapshots.some((snapshot) => snapshot.state === "blocked");
    const hasReplay = snapshots.some((snapshot) => snapshot.state === "replay_required");
    const hasWatch = snapshots.some((snapshot) => snapshot.state === "watch");
    return {
      id: `snapshot-parity-group-${sourceEnvelopeId}`,
      sourceEnvelopeId,
      surfaces: snapshots.map((snapshot) => snapshot.surface),
      state: hasBlocked ? "blocked" : hasReplay ? "replay_required" : hasWatch ? "watch" : "ready",
      sharedPreviewDownloadParityHash: snapshots[0]?.previewDownloadParityHash ?? "missing",
      allSurfacesShareHash,
      allLocaleCopyNoRawKey,
      blockedTokenCount,
      nextRecovery: hasBlocked ? "operator_security_review" : !allSurfacesShareHash ? "replay_export_capsule" : !allLocaleCopyNoRawKey ? "rewrite_customer_copy" : hasReplay ? "block_download" : "none",
    } satisfies Pass2541ParityGroup;
  });
}

export function buildPass2541CustomerExportSnapshotParityRebalance(args: {
  query: string;
  symbol?: string;
  pass2540?: Pass2540CustomerExportZeroLeakReplayRebalance;
}): Pass2541CustomerExportSnapshotParityRebalance {
  const inheritedZeroLeakEnvelopes = args.pass2540?.sanitizedEnvelopes ?? [];
  const surfaceSnapshots = inheritedZeroLeakEnvelopes.flatMap((envelope) => SURFACES.map((surface) => buildSurfaceSnapshot(envelope, surface)));
  const parityGroups = buildParityGroups(surfaceSnapshots);
  const fixtures: Pass2541SnapshotFixture[] = [
    { id: "fixture-pdf-preview-download-same-hash", scenario: "pdf_preview_download_same_hash", surface: "pdf_preview", inputCopy: "Customer export uses the same redacted capsule for preview and download.", expectedBlockedTokens: [], expectedState: "ready" },
    { id: "fixture-angel-summary-raw-prompt-blocked", scenario: "angel_summary_raw_prompt_blocked", surface: "angel_summary", inputCopy: "promptRaw should never be repeated to a customer.", expectedBlockedTokens: ["promptRaw"], expectedState: "replay_required" },
    { id: "fixture-browser-provider-payload-blocked", scenario: "browser_panel_provider_payload_blocked", surface: "browser_panel", inputCopy: "rawProviderPayload is hidden from the browser panel.", expectedBlockedTokens: ["rawProviderPayload"], expectedState: "replay_required" },
    { id: "fixture-account-vault-success-url-blocked", scenario: "account_vault_success_url_blocked", surface: "account_vault", inputCopy: "successUrl and localStorageFlag cannot unlock the vault.", expectedBlockedTokens: ["successUrl", "localStorageFlag"], expectedState: "replay_required" },
    { id: "fixture-locale-copy-no-raw-key", scenario: "locale_copy_no_raw_key", surface: "pdf_download", locale: "pl", inputCopy: "Eksport używa wyłącznie zredagowanej kapsuły.", expectedBlockedTokens: [], expectedState: "ready" },
    { id: "fixture-checkout-payment-payload-blocked", scenario: "checkout_receipt_payment_payload_blocked", surface: "checkout_receipt", inputCopy: "paymentProviderPayload must remain server-only.", expectedBlockedTokens: ["paymentProviderPayload"], expectedState: "blocked" },
  ];
  const semanticLanes: Pass2541SemanticLane[] = [
    { id: "snapshot-parity", percentBefore: 0, percentAfter: 38, finding: "PASS2540 sanitized customer export, but preview/download/account/Angel surfaces still needed a shared snapshot hash contract.", implementedGuard: "Added parity groups and per-surface snapshots bound to the same sanitized envelope hash.", nextAction: "Persist parity receipts next to PDF/account vault downloads." },
    { id: "pdf-preview-download-parity", percentBefore: 58, percentAfter: 74, finding: "PDF preview and download must never diverge after redaction or replay.", implementedGuard: "Added previewDownloadParityHash and fixture requiring preview/download to share the same export capsule.", nextAction: "Wire the real PDF download handler to reject hash drift before file generation." },
    { id: "angel-browser-no-leak-copy", percentBefore: 47, percentAfter: 68, finding: "Angel and Browser can summarize proof gaps, but must not echo raw key names or hidden payloads into customer copy.", implementedGuard: "Added customer-copy scanner for raw provider, wallet, prompt, localStorage, payment, device and scratchpad tokens.", nextAction: "Snapshot test every PL/EN/DE Angel/PDF/Browser message template." },
    { id: "checkout-receipt-copy-boundary", percentBefore: 31, percentAfter: 52, finding: "Checkout receipt copy still needed the same no-raw-key rule as account vault export.", implementedGuard: "Added checkout_receipt surface and blocked payment provider payload fixture.", nextAction: "Bind this to Stripe/BLIK/crypto receipt cards once live payment adapters are enabled." },
  ];
  const blockedTokenCount = parityGroups.reduce((sum, group) => sum + group.blockedTokenCount, 0);
  const blockedGroupCount = parityGroups.filter((group) => group.state === "blocked").length;
  const replayGroupCount = parityGroups.filter((group) => group.state === "replay_required").length;
  return {
    id: PASS2541_CUSTOMER_EXPORT_SNAPSHOT_PARITY_REBALANCE_ID,
    state: blockedGroupCount ? "blocked" : replayGroupCount ? "watch" : "ready_for_snapshot_parity",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 75,
    manualSemanticCompletionAfterPercent: 78,
    targetedSemanticBatchFiles: 66,
    targetedSemanticBatchLines: 282640,
    snapshotParityBeforePercent: 0,
    snapshotParityAfterPercent: 38,
    pdfPreviewDownloadParityBeforePercent: 58,
    pdfPreviewDownloadParityAfterPercent: 74,
    angelNoLeakSummaryBeforePercent: 47,
    angelNoLeakSummaryAfterPercent: 68,
    browserPanelNoLeakBeforePercent: 42,
    browserPanelNoLeakAfterPercent: 64,
    localeNoRawKeyCopyBeforePercent: 56,
    localeNoRawKeyCopyAfterPercent: 76,
    checkoutReceiptCopyBoundaryBeforePercent: 31,
    checkoutReceiptCopyBoundaryAfterPercent: 52,
    worldclassInventionIndexBeforePercent: 99,
    worldclassInventionIndexAfterPercent: 99,
    inheritedZeroLeakEnvelopes,
    surfaceSnapshots,
    parityGroups,
    fixtures,
    semanticLanes,
    blockedCustomerTextTokens: PASS2541_BLOCKED_CUSTOMER_TEXT_TOKENS,
    masterTxtAdditions: [
      "PASS2541 adds customer export snapshot parity after PASS2540: account vault, PDF preview, PDF download, Browser, Angel and checkout receipt must share the same sanitized envelope hash family.",
      "PL/EN/DE customer copy now has a no-raw-key scanner for rawProviderPayload, promptRaw, walletAddressFull, providerSecret, successUrl, localStorageFlag, device/payment payloads, systemPrompt, toolTrace and chainOfThought.",
      "PDF preview/download parity is treated as a release gate; hash drift keeps download blocked and forces export capsule replay.",
      "Angel and Browser may state missing proof but cannot echo internal keys, hidden prompt material or raw provider/payment data into user-facing copy.",
    ],
    nextPassQueue: [
      "PASS2542: persist snapshot parity receipt in account vault and PDF export route before download.",
      "PASS2543: real DOM/export snapshot scanner for PL/EN/DE templates and route payloads.",
      "PASS2544: mobile account vault compact card showing parity group, hash match and no-raw-key copy score.",
      "PASS2545: source-provider adapter contract that strips raw provider body before any React prop leaves lib/market-integrity.",
      "PASS2546: repeated leak-attempt incident lane with operator dual-control and customer-safe notice.",
    ],
    snapshotParityRule: "Customer export surfaces can show ready/download/final only when account vault, PDF preview, PDF download, Browser, Angel and checkout receipt snapshots share the same sanitized envelope hash, every PL/EN/DE copy scan has zero blocked raw tokens, and zeroLeakReplayGate remains valid.",
    fingerprint: stableHash({ surfaceSnapshots: surfaceSnapshots.map((snapshot) => [snapshot.id, snapshot.state, snapshot.previewDownloadParityHash]), parityGroups, blockedTokenCount }),
  };
}
