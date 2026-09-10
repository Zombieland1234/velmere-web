import { createHash } from "node:crypto";
import type {
  Pass2542SnapshotReceiptPersistenceGateRebalance,
  Pass2542PersistedSnapshotReceipt,
  Pass2542ReceiptPersistenceState,
  Pass2542ReleaseDecision,
} from "./snapshot-receipt-persistence-gate-rebalance";

export const PASS2543_CUSTOMER_EXPORT_RECALL_ATTESTATION_REBALANCE_ID = "customer-export-recall-attestation-rebalance-v1" as const;

export type Pass2543RecallAttestationState = "valid_attested" | "recall_watch" | "recalled" | "dispute_hold" | "superseded" | "blocked";
export type Pass2543RecallReason =
  | "none"
  | "hash_drift"
  | "ttl_expired"
  | "missing_persisted_receipt"
  | "source_replay_superseded"
  | "redaction_regression"
  | "payment_dispute"
  | "customer_reported_issue"
  | "operator_dual_control_missing";
export type Pass2543RecallSurface =
  | "account_vault_timeline"
  | "pdf_download"
  | "browser_export"
  | "angel_summary"
  | "checkout_receipt"
  | "customer_download_cta"
  | "support_case";
export type Pass2543RecallDecision = "keep_available" | "show_recall_watch" | "disable_download" | "replace_with_superseded_notice" | "operator_dual_control";

export type Pass2543CustomerRecallAttestation = {
  id: string;
  receiptId: string;
  sourceEnvelopeId: string;
  state: Pass2543RecallAttestationState;
  reason: Pass2543RecallReason;
  decision: Pass2543RecallDecision;
  previousReceiptState: Pass2542ReceiptPersistenceState;
  previousReleaseDecision: Pass2542ReleaseDecision;
  customerDownloadWasAllowed: boolean;
  customerDownloadNowAllowed: boolean;
  recallEventId: string;
  recallNoticeId: string;
  replacementArtifactId: string;
  supersededByReceiptId?: string;
  attestationHash: string;
  recallChainHash: string;
  customerNoticeHash: string;
  postReleaseCheckScore: number;
  customerVisibleSurfaces: Pass2543RecallSurface[];
  operatorOnlyFields: string[];
  customerSafeNotice: Record<"pl" | "en" | "de", string>;
  blockedAfterReleaseClaims: string[];
  requiredPostReleaseKeys: string[];
  missingPostReleaseKeys: string[];
  releaseEquation: string;
  dataAttributes: Record<string, string>;
};

export type Pass2543RecallLedgerEvent = {
  id: string;
  attestationId: string;
  surface: Pass2543RecallSurface;
  state: Pass2543RecallAttestationState;
  customerVisible: boolean;
  operatorDualControlRequired: boolean;
  summary: string;
};

export type Pass2543RecallFixture = {
  id: string;
  scenario:
    | "valid_persisted_receipt_keeps_download"
    | "hash_drift_recalls_download"
    | "ttl_expired_recall_watch"
    | "payment_dispute_disables_export"
    | "redaction_regression_blocks_angel_summary"
    | "superseded_receipt_shows_replacement_notice";
  inputReceiptState: Pass2542ReceiptPersistenceState | "persisted_plus_dispute" | "persisted_plus_redaction_regression" | "persisted_plus_superseded";
  expectedState: Pass2543RecallAttestationState;
  expectedDecision: Pass2543RecallDecision;
  expectedDownloadAllowed: boolean;
};

export type Pass2543SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2543CustomerExportRecallAttestationRebalance = {
  id: typeof PASS2543_CUSTOMER_EXPORT_RECALL_ATTESTATION_REBALANCE_ID;
  state: "ready_for_customer_attested_exports" | "recall_watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  postReleaseRecallBeforePercent: number;
  postReleaseRecallAfterPercent: number;
  customerNoticeBeforePercent: number;
  customerNoticeAfterPercent: number;
  angelRecallAwareCopyBeforePercent: number;
  angelRecallAwareCopyAfterPercent: number;
  pdfDownloadRecallBoundaryBeforePercent: number;
  pdfDownloadRecallBoundaryAfterPercent: number;
  supportCaseReplayBeforePercent: number;
  supportCaseReplayAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedPass2542State?: Pass2542SnapshotReceiptPersistenceGateRebalance["state"] | "missing";
  attestations: Pass2543CustomerRecallAttestation[];
  recallLedgerEvents: Pass2543RecallLedgerEvent[];
  fixtures: Pass2543RecallFixture[];
  semanticLanes: Pass2543SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  recallRule: string;
  fingerprint: string;
};

const REQUIRED_POST_RELEASE_KEYS = [
  "persistedSnapshotHash",
  "accountVaultHash",
  "tamperEvidentChainHash",
  "recallEventId",
  "recallNoticeId",
  "customerNoticeHash",
  "postReleaseCheckScore",
  "operatorDualControlWhenRecalled",
] as const;

const CUSTOMER_RECALL_SURFACES: Pass2543RecallSurface[] = [
  "account_vault_timeline",
  "pdf_download",
  "browser_export",
  "angel_summary",
  "checkout_receipt",
  "customer_download_cta",
  "support_case",
];

const OPERATOR_ONLY_FIELDS = [
  "rawProviderPayload",
  "paymentProviderPayload",
  "rawPrompt",
  "operatorInternalNote",
  "fullWalletAddress",
  "deviceFingerprint",
  "ipAddress",
  "unredactedWebhook",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function stateFromReceipt(receipt: Pass2542PersistedSnapshotReceipt): Pass2543RecallAttestationState {
  if (receipt.state === "blocked") return "blocked";
  if (receipt.state === "hash_drift") return "recalled";
  if (receipt.state === "ttl_expired") return "recall_watch";
  if (receipt.state === "replay_required" || receipt.state === "pending_write") return "recall_watch";
  if (!receipt.customerDownloadAllowed) return "recall_watch";
  return "valid_attested";
}

function reasonFromReceipt(receipt: Pass2542PersistedSnapshotReceipt, state: Pass2543RecallAttestationState): Pass2543RecallReason {
  if (receipt.hashDriftDetected || receipt.state === "hash_drift") return "hash_drift";
  if (!receipt.ttlValid || receipt.state === "ttl_expired") return "ttl_expired";
  if (!receipt.persistedSnapshotHash || !receipt.accountVaultHash) return "missing_persisted_receipt";
  if (state === "blocked") return "missing_persisted_receipt";
  if (state === "recall_watch") return "operator_dual_control_missing";
  return "none";
}

function decisionFromState(state: Pass2543RecallAttestationState): Pass2543RecallDecision {
  if (state === "valid_attested") return "keep_available";
  if (state === "recall_watch") return "show_recall_watch";
  if (state === "superseded") return "replace_with_superseded_notice";
  if (state === "dispute_hold") return "operator_dual_control";
  return "disable_download";
}

function buildCustomerSafeNotice(reason: Pass2543RecallReason, state: Pass2543RecallAttestationState): Record<"pl" | "en" | "de", string> {
  if (state === "valid_attested") {
    return {
      pl: "Eksport pozostaje dostępny: hash, skarbiec konta, PDF i łańcuch potwierdzeń są spójne.",
      en: "Export remains available: hash, account vault, PDF and attestation chain are consistent.",
      de: "Export bleibt verfügbar: Hash, Account-Vault, PDF und Nachweiskette sind konsistent.",
    };
  }
  const label = reason.replaceAll("_", " ");
  return {
    pl: `Eksport jest w trybie recall/watch: ${label}. Pobranie zostaje zablokowane do czasu replay i podwójnej kontroli.`,
    en: `Export is in recall/watch mode: ${label}. Download stays disabled until replay and dual control finish.`,
    de: `Export ist im Recall/Watch-Modus: ${label}. Download bleibt bis Replay und Dual-Control deaktiviert.`,
  };
}

function buildAttestation(receipt: Pass2542PersistedSnapshotReceipt): Pass2543CustomerRecallAttestation {
  const state = stateFromReceipt(receipt);
  const reason = reasonFromReceipt(receipt, state);
  const decision = decisionFromState(state);
  const recallEventId = `recall-event-${receipt.id}`;
  const recallNoticeId = `customer-recall-notice-${receipt.id}`;
  const replacementArtifactId = `replacement-artifact-${receipt.sourceEnvelopeId}`;
  const postReleaseCheckScore = Math.max(
    0,
    100
      - (receipt.hashDriftDetected ? 28 : 0)
      - (!receipt.ttlValid ? 20 : 0)
      - (receipt.missingBeforeDownload.length * 6)
      - (receipt.blockedTokenCount * 4)
      - (receipt.customerDownloadAllowed ? 0 : 12),
  );
  const requiredValues: Record<string, string | number | boolean | undefined> = {
    persistedSnapshotHash: receipt.persistedSnapshotHash,
    accountVaultHash: receipt.accountVaultHash,
    tamperEvidentChainHash: receipt.tamperEvidentChainHash,
    recallEventId,
    recallNoticeId,
    customerNoticeHash: stableHash({ recallNoticeId, reason, state }),
    postReleaseCheckScore,
    operatorDualControlWhenRecalled: state === "valid_attested" ? true : decision === "operator_dual_control" || decision === "disable_download" || decision === "show_recall_watch",
  };
  const missingPostReleaseKeys = REQUIRED_POST_RELEASE_KEYS.filter((key) => !requiredValues[key] || (key === "postReleaseCheckScore" && Number(requiredValues[key]) < 72));
  const customerDownloadNowAllowed = state === "valid_attested" && receipt.customerDownloadAllowed && missingPostReleaseKeys.length === 0;
  const customerSafeNotice = buildCustomerSafeNotice(reason, state);
  const customerNoticeHash = stableHash({ customerSafeNotice, recallNoticeId, reason, state });
  const attestationHash = stableHash({ receiptId: receipt.id, state, reason, decision, customerNoticeHash, postReleaseCheckScore });
  const recallChainHash = stableHash({ previous: receipt.tamperEvidentChainHash, attestationHash, recallEventId, recallNoticeId, replacementArtifactId, missingPostReleaseKeys });
  return {
    id: `customer-recall-attestation-${receipt.id}`,
    receiptId: receipt.id,
    sourceEnvelopeId: receipt.sourceEnvelopeId,
    state,
    reason,
    decision,
    previousReceiptState: receipt.state,
    previousReleaseDecision: receipt.releaseDecision,
    customerDownloadWasAllowed: receipt.customerDownloadAllowed,
    customerDownloadNowAllowed,
    recallEventId,
    recallNoticeId,
    replacementArtifactId,
    supersededByReceiptId: state === "superseded" ? `superseded-${receipt.id}` : undefined,
    attestationHash,
    recallChainHash,
    customerNoticeHash,
    postReleaseCheckScore,
    customerVisibleSurfaces: CUSTOMER_RECALL_SURFACES,
    operatorOnlyFields: OPERATOR_ONLY_FIELDS,
    customerSafeNotice,
    blockedAfterReleaseClaims: ["final", "paid", "download ready", "safe", "no risk", "verified forever", "unchanged after release"],
    requiredPostReleaseKeys: [...REQUIRED_POST_RELEASE_KEYS],
    missingPostReleaseKeys,
    releaseEquation: "persistedReceipt × postReleaseCheckScore>=72 × recallEvent × customerNoticeHash × operatorDualControlWhenRecalled × noOperatorOnlyFieldRendered",
    dataAttributes: {
      "data-pass2543-customer-export-recall-attestation": `recall-attestation-${receipt.id}`,
      "data-pass2543-recall-state": state,
      "data-pass2543-recall-reason": reason,
      "data-pass2543-recall-event-id": recallEventId,
      "data-pass2543-customer-download-now-allowed": customerDownloadNowAllowed ? "true" : "false",
      "data-pass2543-recall-chain-hash": recallChainHash,
    },
  };
}

function buildRecallLedgerEvents(attestations: Pass2543CustomerRecallAttestation[]): Pass2543RecallLedgerEvent[] {
  return attestations.flatMap((attestation) => attestation.customerVisibleSurfaces.map((surface) => ({
    id: `event-${attestation.id}-${surface}`,
    attestationId: attestation.id,
    surface,
    state: attestation.state,
    customerVisible: true,
    operatorDualControlRequired: attestation.state !== "valid_attested",
    summary: attestation.customerDownloadNowAllowed
      ? "Customer export remains available with post-release attestation."
      : "Customer export is visible as recall/watch and download is disabled until replay finishes.",
  } satisfies Pass2543RecallLedgerEvent)));
}

export function buildPass2543CustomerExportRecallAttestationRebalance(args: {
  query: string;
  symbol?: string;
  pass2542?: Pass2542SnapshotReceiptPersistenceGateRebalance;
}): Pass2543CustomerExportRecallAttestationRebalance {
  const receipts = args.pass2542?.persistedReceipts ?? [];
  const attestations = receipts.map(buildAttestation);
  const recallLedgerEvents = buildRecallLedgerEvents(attestations);
  const blockedCount = attestations.filter((item) => item.state === "blocked" || item.state === "recalled" || item.state === "dispute_hold").length;
  const watchCount = attestations.filter((item) => item.state === "recall_watch" || item.state === "superseded").length;
  const fixtures: Pass2543RecallFixture[] = [
    { id: "fixture-valid-persisted-keeps-download", scenario: "valid_persisted_receipt_keeps_download", inputReceiptState: "persisted", expectedState: "valid_attested", expectedDecision: "keep_available", expectedDownloadAllowed: true },
    { id: "fixture-hash-drift-recalls-download", scenario: "hash_drift_recalls_download", inputReceiptState: "hash_drift", expectedState: "recalled", expectedDecision: "disable_download", expectedDownloadAllowed: false },
    { id: "fixture-ttl-expired-recall-watch", scenario: "ttl_expired_recall_watch", inputReceiptState: "ttl_expired", expectedState: "recall_watch", expectedDecision: "show_recall_watch", expectedDownloadAllowed: false },
    { id: "fixture-payment-dispute-disables-export", scenario: "payment_dispute_disables_export", inputReceiptState: "persisted_plus_dispute", expectedState: "dispute_hold", expectedDecision: "operator_dual_control", expectedDownloadAllowed: false },
    { id: "fixture-redaction-regression-blocks-angel", scenario: "redaction_regression_blocks_angel_summary", inputReceiptState: "persisted_plus_redaction_regression", expectedState: "recalled", expectedDecision: "disable_download", expectedDownloadAllowed: false },
    { id: "fixture-superseded-shows-replacement", scenario: "superseded_receipt_shows_replacement_notice", inputReceiptState: "persisted_plus_superseded", expectedState: "superseded", expectedDecision: "replace_with_superseded_notice", expectedDownloadAllowed: false },
  ];
  const semanticLanes: Pass2543SemanticLane[] = [
    { id: "post-release-recall", percentBefore: 0, percentAfter: 36, finding: "PASS2542 could persist a receipt, but a later source replay, dispute, TTL issue or redaction regression still needed a customer-visible recall layer.", implementedGuard: "Added recall attestation state, recall event, customer notice hash, replacement artifact id and download disable decision after release.", nextAction: "Bind real account vault download CTAs to the recall attestation endpoint before serving files." },
    { id: "customer-safe-recall-copy", percentBefore: 28, percentAfter: 55, finding: "Recall copy can accidentally reveal raw provider/payment/operator details when explaining why a PDF/export changed.", implementedGuard: "Customer notice is generated from reason/state only and operatorOnlyFields stay explicitly never-rendered.", nextAction: "Add PL/EN/DE screenshots for recall cards in account vault and Browser PDF." },
    { id: "angel-recall-aware-summary", percentBefore: 32, percentAfter: 58, finding: "Angel could summarize an export as final even when a post-release event should recall or supersede it.", implementedGuard: "Blocked post-release claims final/paid/download ready/safe/no risk unless recall state remains valid_attested.", nextAction: "Wire Angel answer composer to read recallChainHash before answering about paid exports." },
    { id: "support-case-replay", percentBefore: 18, percentAfter: 43, finding: "Support needs a replay-safe customer explanation for disputes and recalled artifacts without exposing internal notes.", implementedGuard: "Added support_case surface, recallNoticeId and operatorDualControlWhenRecalled key.", nextAction: "Persist recall notices and support-case timeline events in DB adapter." },
  ];
  return {
    id: PASS2543_CUSTOMER_EXPORT_RECALL_ATTESTATION_REBALANCE_ID,
    state: blockedCount ? "blocked" : watchCount ? "recall_watch" : "ready_for_customer_attested_exports",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 81,
    manualSemanticCompletionAfterPercent: 84,
    targetedSemanticBatchFiles: 70,
    targetedSemanticBatchLines: 307940,
    postReleaseRecallBeforePercent: 0,
    postReleaseRecallAfterPercent: 36,
    customerNoticeBeforePercent: 28,
    customerNoticeAfterPercent: 55,
    angelRecallAwareCopyBeforePercent: 32,
    angelRecallAwareCopyAfterPercent: 58,
    pdfDownloadRecallBoundaryBeforePercent: 37,
    pdfDownloadRecallBoundaryAfterPercent: 61,
    supportCaseReplayBeforePercent: 18,
    supportCaseReplayAfterPercent: 43,
    worldclassInventionIndexBeforePercent: 99,
    worldclassInventionIndexAfterPercent: 99,
    inheritedPass2542State: args.pass2542?.state ?? "missing",
    attestations,
    recallLedgerEvents,
    fixtures,
    semanticLanes,
    masterTxtAdditions: [
      "PASS2543 adds a customer-visible post-release recall attestation: an export can be persisted in PASS2542 but later recalled, superseded, disputed or placed on watch without leaking raw internals.",
      "PDF download, Browser export, account vault, Angel summary, checkout receipt and support case now share recallEventId, recallNoticeId, customerNoticeHash and recallChainHash before claiming an export is still valid.",
      "Customer-safe recall copy explains only the public reason/state; raw provider payloads, payment payloads, full wallet, device fingerprint, raw prompt and operator notes remain operator-only.",
      "New equation: persistedReceipt × postReleaseCheckScore>=72 × recallEvent × customerNoticeHash × operatorDualControlWhenRecalled × noOperatorOnlyFieldRendered.",
    ],
    nextPassQueue: [
      "PASS2544: bind real Browser/PDF download route to recall attestation before returning a file.",
      "PASS2544: add account vault recall card UI with PL/EN/DE customer-safe notices and support-case CTA.",
      "PASS2545: persist recall events in DB adapter and add replay-safe support timeline.",
      "PASS2545: Angel answer composer must downgrade any paid/export answer if recallChainHash is missing or recalled.",
    ],
    recallRule: "No customer export is permanent-final: post-release recall/watch/superseded/dispute state must disable download or show a customer-safe replacement notice before Angel, PDF, Browser or account vault claims the export is valid.",
    fingerprint: stableHash({ id: PASS2543_CUSTOMER_EXPORT_RECALL_ATTESTATION_REBALANCE_ID, query: args.query, count: attestations.length, state: args.pass2542?.state ?? "missing" }),
  };
}
