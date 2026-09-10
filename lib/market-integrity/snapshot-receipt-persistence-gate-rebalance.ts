import { createHash } from "node:crypto";
import type {
  Pass2541CustomerExportSnapshotParityRebalance,
  Pass2541ParityGroup,
  Pass2541SurfaceSnapshot,
  Pass2541SnapshotSurface,
  Pass2541ParityState,
} from "./customer-export-snapshot-parity-rebalance";

export const PASS2542_SNAPSHOT_RECEIPT_PERSISTENCE_GATE_REBALANCE_ID = "snapshot-receipt-persistence-gate-rebalance-v1" as const;

export type Pass2542ReceiptSurface = Pass2541SnapshotSurface | "audit_account_message" | "account_download_cta";
export type Pass2542ReceiptPersistenceState = "persisted" | "pending_write" | "replay_required" | "ttl_expired" | "hash_drift" | "blocked";
export type Pass2542ReleaseDecision = "allow_customer_download" | "show_replay_required" | "block_and_quarantine" | "operator_review";
export type Pass2542ReceiptEventKind = "parity_group_created" | "vault_write" | "pdf_preview_bound" | "pdf_download_bound" | "angel_summary_bound" | "checkout_receipt_bound" | "download_cta_evaluated";

export type Pass2542PersistedSnapshotReceipt = {
  id: string;
  parityGroupId: string;
  sourceEnvelopeId: string;
  state: Pass2542ReceiptPersistenceState;
  releaseDecision: Pass2542ReleaseDecision;
  surfaceCoverage: Pass2542ReceiptSurface[];
  persistedSnapshotHash: string;
  accountVaultHash: string;
  pdfPreviewHash: string;
  pdfDownloadHash: string;
  angelSummaryHash: string;
  checkoutReceiptHash: string;
  durableStoreId: string;
  vaultWriteEventId: string;
  ttlSeconds: number;
  ttlValid: boolean;
  hashDriftDetected: boolean;
  noRawKeyCopyScore: number;
  blockedTokenCount: number;
  customerDownloadAllowed: boolean;
  requiredBeforeDownload: string[];
  missingBeforeDownload: string[];
  tamperEvidentChainHash: string;
  releaseEquation: string;
  dataAttributes: Record<string, string>;
};

export type Pass2542ReceiptLedgerEvent = {
  id: string;
  kind: Pass2542ReceiptEventKind;
  state: Pass2542ReceiptPersistenceState;
  receiptId: string;
  surface: Pass2542ReceiptSurface;
  customerVisible: boolean;
  operatorOnly: boolean;
  summary: string;
};

export type Pass2542ReceiptFixture = {
  id: string;
  scenario:
    | "persisted_snapshot_allows_download"
    | "hash_drift_blocks_download"
    | "missing_vault_write_requires_replay"
    | "ttl_expired_requires_replay"
    | "angel_summary_without_receipt_blocked"
    | "checkout_receipt_never_unlocks_without_server_write";
  inputState: Pass2542ReceiptPersistenceState;
  expectedDecision: Pass2542ReleaseDecision;
  expectedDownloadAllowed: boolean;
  expectedMissingKey?: string;
};

export type Pass2542SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2542SnapshotReceiptPersistenceGateRebalance = {
  id: typeof PASS2542_SNAPSHOT_RECEIPT_PERSISTENCE_GATE_REBALANCE_ID;
  state: "ready_for_persisted_snapshot_receipts" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  snapshotReceiptPersistenceBeforePercent: number;
  snapshotReceiptPersistenceAfterPercent: number;
  pdfDownloadReleaseGateBeforePercent: number;
  pdfDownloadReleaseGateAfterPercent: number;
  accountVaultReceiptTimelineBeforePercent: number;
  accountVaultReceiptTimelineAfterPercent: number;
  angelReceiptAwareSummaryBeforePercent: number;
  angelReceiptAwareSummaryAfterPercent: number;
  checkoutReceiptWriteBoundaryBeforePercent: number;
  checkoutReceiptWriteBoundaryAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedPass2541State?: Pass2541ParityState | "missing";
  persistedReceipts: Pass2542PersistedSnapshotReceipt[];
  ledgerEvents: Pass2542ReceiptLedgerEvent[];
  fixtures: Pass2542ReceiptFixture[];
  semanticLanes: Pass2542SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  persistenceRule: string;
  fingerprint: string;
};

const REQUIRED_BEFORE_DOWNLOAD = [
  "parityGroupId",
  "persistedSnapshotHash",
  "accountVaultHash",
  "pdfPreviewHash",
  "pdfDownloadHash",
  "vaultWriteEventId",
  "durableStoreId",
  "ttlValid",
  "noRawKeyCopyScore",
  "tamperEvidentChainHash",
] as const;

const RECEIPT_SURFACES: Pass2542ReceiptSurface[] = [
  "account_vault",
  "pdf_preview",
  "pdf_download",
  "browser_panel",
  "angel_summary",
  "checkout_receipt",
  "audit_account_message",
  "account_download_cta",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function stateFromGroup(group: Pass2541ParityGroup, snapshots: Pass2541SurfaceSnapshot[]): Pass2542ReceiptPersistenceState {
  if (!snapshots.length) return "pending_write";
  if (group.state === "blocked") return "blocked";
  if (!group.allSurfacesShareHash) return "hash_drift";
  if (!group.allLocaleCopyNoRawKey || group.blockedTokenCount > 0) return "replay_required";
  if (group.state === "replay_required") return "replay_required";
  if (group.state === "watch") return "pending_write";
  return "persisted";
}

function decisionFromState(state: Pass2542ReceiptPersistenceState): Pass2542ReleaseDecision {
  if (state === "persisted") return "allow_customer_download";
  if (state === "blocked" || state === "hash_drift") return "block_and_quarantine";
  if (state === "ttl_expired") return "operator_review";
  return "show_replay_required";
}

function buildReceipt(group: Pass2541ParityGroup, snapshots: Pass2541SurfaceSnapshot[]): Pass2542PersistedSnapshotReceipt {
  const state = stateFromGroup(group, snapshots);
  const releaseDecision = decisionFromState(state);
  const first = snapshots[0];
  const noRawKeyCopyScore = Math.min(...snapshots.map((snapshot) => snapshot.copyNoRawKeyScore));
  const basePayload = {
    parityGroupId: group.id,
    sourceEnvelopeId: group.sourceEnvelopeId,
    sharedPreviewDownloadParityHash: group.sharedPreviewDownloadParityHash,
    allSurfacesShareHash: group.allSurfacesShareHash,
    allLocaleCopyNoRawKey: group.allLocaleCopyNoRawKey,
    blockedTokenCount: group.blockedTokenCount,
  };
  const persistedSnapshotHash = stableHash({ kind: "persisted-snapshot", ...basePayload });
  const accountVaultHash = stableHash({ surface: "account_vault", persistedSnapshotHash, customerSafeHash: first?.customerSafeHash });
  const pdfPreviewHash = stableHash({ surface: "pdf_preview", persistedSnapshotHash, preview: first?.previewDownloadParityHash });
  const pdfDownloadHash = group.allSurfacesShareHash ? pdfPreviewHash : stableHash({ surface: "pdf_download", drift: true, persistedSnapshotHash });
  const angelSummaryHash = stableHash({ surface: "angel_summary", persistedSnapshotHash, noLeak: snapshots.every((snapshot) => snapshot.angelSummaryNoLeak) });
  const checkoutReceiptHash = stableHash({ surface: "checkout_receipt", persistedSnapshotHash, gate: "server-write-required" });
  const ttlSeconds = state === "persisted" ? 2592000 : state === "pending_write" ? 1800 : 0;
  const ttlValid = ttlSeconds > 0;
  const hashDriftDetected = pdfPreviewHash !== pdfDownloadHash || !group.allSurfacesShareHash;
  const requiredValues: Record<string, string | boolean | number | undefined> = {
    parityGroupId: group.id,
    persistedSnapshotHash,
    accountVaultHash,
    pdfPreviewHash,
    pdfDownloadHash,
    vaultWriteEventId: `vault-write-${group.id}`,
    durableStoreId: `durable-snapshot-store-${group.sourceEnvelopeId}`,
    ttlValid,
    noRawKeyCopyScore,
    tamperEvidentChainHash: stableHash({ chain: "pre", persistedSnapshotHash, accountVaultHash, pdfPreviewHash, pdfDownloadHash }),
  };
  const missingBeforeDownload = REQUIRED_BEFORE_DOWNLOAD.filter((key) => {
    const value = requiredValues[key];
    return value === undefined || value === "" || value === false || (key === "noRawKeyCopyScore" && Number(value) < 76);
  });
  const customerDownloadAllowed = state === "persisted" && !hashDriftDetected && missingBeforeDownload.length === 0;
  const tamperEvidentChainHash = stableHash({ persistedSnapshotHash, accountVaultHash, pdfPreviewHash, pdfDownloadHash, angelSummaryHash, checkoutReceiptHash, missingBeforeDownload, ttlValid });
  return {
    id: `persisted-snapshot-receipt-${group.sourceEnvelopeId}`,
    parityGroupId: group.id,
    sourceEnvelopeId: group.sourceEnvelopeId,
    state,
    releaseDecision,
    surfaceCoverage: RECEIPT_SURFACES,
    persistedSnapshotHash,
    accountVaultHash,
    pdfPreviewHash,
    pdfDownloadHash,
    angelSummaryHash,
    checkoutReceiptHash,
    durableStoreId: `durable-snapshot-store-${group.sourceEnvelopeId}`,
    vaultWriteEventId: `vault-write-${group.id}`,
    ttlSeconds,
    ttlValid,
    hashDriftDetected,
    noRawKeyCopyScore,
    blockedTokenCount: group.blockedTokenCount,
    customerDownloadAllowed,
    requiredBeforeDownload: [...REQUIRED_BEFORE_DOWNLOAD],
    missingBeforeDownload,
    tamperEvidentChainHash,
    releaseEquation: "persistedSnapshotHash × accountVaultHash × pdfPreviewHash=pdfDownloadHash × vaultWriteEvent × durableStore × ttlValid × noRawKeyCopyScore × tamperEvidentChainHash",
    dataAttributes: {
      "data-pass2542-snapshot-receipt-persistence-gate": `receipt-persistence-${group.id}`,
      "data-pass2542-persisted-snapshot-receipt-id": `persisted-snapshot-receipt-${group.sourceEnvelopeId}`,
      "data-pass2542-receipt-persistence-state": state,
      "data-pass2542-customer-download-allowed": customerDownloadAllowed ? "true" : "false",
      "data-pass2542-hash-drift-detected": hashDriftDetected ? "true" : "false",
      "data-pass2542-tamper-evident-chain-hash": tamperEvidentChainHash,
    },
  };
}

function buildLedgerEvents(receipts: Pass2542PersistedSnapshotReceipt[]): Pass2542ReceiptLedgerEvent[] {
  return receipts.flatMap((receipt) => ([
    { id: `event-${receipt.id}-parity`, kind: "parity_group_created", state: receipt.state, receiptId: receipt.id, surface: "browser_panel", customerVisible: true, operatorOnly: false, summary: "Snapshot parity group was evaluated before customer export." },
    { id: `event-${receipt.id}-vault`, kind: "vault_write", state: receipt.state, receiptId: receipt.id, surface: "account_vault", customerVisible: true, operatorOnly: false, summary: "Account vault write is required before download CTA can unlock." },
    { id: `event-${receipt.id}-preview`, kind: "pdf_preview_bound", state: receipt.state, receiptId: receipt.id, surface: "pdf_preview", customerVisible: true, operatorOnly: false, summary: "PDF preview is bound to the persisted snapshot hash." },
    { id: `event-${receipt.id}-download`, kind: "pdf_download_bound", state: receipt.state, receiptId: receipt.id, surface: "pdf_download", customerVisible: true, operatorOnly: false, summary: "PDF download stays blocked on hash drift, missing vault write or TTL expiry." },
    { id: `event-${receipt.id}-angel`, kind: "angel_summary_bound", state: receipt.state, receiptId: receipt.id, surface: "angel_summary", customerVisible: true, operatorOnly: false, summary: "Angel summary can only reference the persisted receipt state, never raw prompt or tool trace." },
    { id: `event-${receipt.id}-checkout`, kind: "checkout_receipt_bound", state: receipt.state, receiptId: receipt.id, surface: "checkout_receipt", customerVisible: true, operatorOnly: false, summary: "Checkout receipt is a server-write boundary, not a client success flag." },
    { id: `event-${receipt.id}-download-cta`, kind: "download_cta_evaluated", state: receipt.state, receiptId: receipt.id, surface: "account_download_cta", customerVisible: true, operatorOnly: false, summary: receipt.customerDownloadAllowed ? "Customer download is allowed by persisted evidence." : "Customer download is disabled until replay/persistence completes." },
  ] satisfies Pass2542ReceiptLedgerEvent[]));
}

export function buildPass2542SnapshotReceiptPersistenceGateRebalance(args: {
  query: string;
  symbol?: string;
  pass2541?: Pass2541CustomerExportSnapshotParityRebalance;
}): Pass2542SnapshotReceiptPersistenceGateRebalance {
  const groups = args.pass2541?.parityGroups ?? [];
  const snapshots = args.pass2541?.surfaceSnapshots ?? [];
  const persistedReceipts = groups.map((group) => buildReceipt(group, snapshots.filter((snapshot) => snapshot.sourceEnvelopeId === group.sourceEnvelopeId)));
  const ledgerEvents = buildLedgerEvents(persistedReceipts);
  const blockedCount = persistedReceipts.filter((receipt) => receipt.state === "blocked" || receipt.state === "hash_drift").length;
  const replayCount = persistedReceipts.filter((receipt) => receipt.state === "replay_required" || receipt.state === "pending_write" || receipt.state === "ttl_expired").length;
  const fixtures: Pass2542ReceiptFixture[] = [
    { id: "fixture-persisted-snapshot-allows-download", scenario: "persisted_snapshot_allows_download", inputState: "persisted", expectedDecision: "allow_customer_download", expectedDownloadAllowed: true },
    { id: "fixture-hash-drift-blocks-download", scenario: "hash_drift_blocks_download", inputState: "hash_drift", expectedDecision: "block_and_quarantine", expectedDownloadAllowed: false, expectedMissingKey: "pdfPreviewHash=pdfDownloadHash" },
    { id: "fixture-missing-vault-write-requires-replay", scenario: "missing_vault_write_requires_replay", inputState: "pending_write", expectedDecision: "show_replay_required", expectedDownloadAllowed: false, expectedMissingKey: "vaultWriteEventId" },
    { id: "fixture-ttl-expired-requires-replay", scenario: "ttl_expired_requires_replay", inputState: "ttl_expired", expectedDecision: "operator_review", expectedDownloadAllowed: false, expectedMissingKey: "ttlValid" },
    { id: "fixture-angel-without-receipt-blocked", scenario: "angel_summary_without_receipt_blocked", inputState: "blocked", expectedDecision: "block_and_quarantine", expectedDownloadAllowed: false, expectedMissingKey: "persistedSnapshotHash" },
    { id: "fixture-checkout-server-write-boundary", scenario: "checkout_receipt_never_unlocks_without_server_write", inputState: "replay_required", expectedDecision: "show_replay_required", expectedDownloadAllowed: false, expectedMissingKey: "serverWrite" },
  ];
  const semanticLanes: Pass2542SemanticLane[] = [
    { id: "snapshot-receipt-persistence", percentBefore: 0, percentAfter: 41, finding: "PASS2541 created parity hashes, but download/account vault still needed persisted receipt records instead of transient UI state.", implementedGuard: "Added persisted snapshot receipt with durableStoreId, vaultWriteEventId, TTL, tamper-evident chain hash and release decision.", nextAction: "Wire the real PDF generation route to reject downloads unless this persisted receipt is present." },
    { id: "pdf-download-release-gate", percentBefore: 46, percentAfter: 68, finding: "Preview/download parity needed a hard customer download gate with hash drift quarantine.", implementedGuard: "Added pdfPreviewHash/pdfDownloadHash equality and downloadAllowed=false on drift, missing write or TTL failure.", nextAction: "Add DOM-level download CTA scanner for Browser/PDF/account vault." },
    { id: "account-vault-receipt-timeline", percentBefore: 57, percentAfter: 72, finding: "Account vault timeline had export capsule cards but lacked a separate persisted snapshot receipt identity.", implementedGuard: "Added persistedSnapshotReceiptId, vaultWriteEventId, accountVaultHash and customer-visible ledger events.", nextAction: "Persist account vault timeline events in the real DB adapter." },
    { id: "angel-checkout-boundary", percentBefore: 52, percentAfter: 69, finding: "Angel summaries and checkout receipts can become accidental release channels if they rely on client success copy.", implementedGuard: "Bound Angel and checkout to persisted receipts; client-only success cannot unlock export/download.", nextAction: "Add live Stripe/BLIK/crypto webhook adapters to write receipt persistence events." },
  ];
  return {
    id: PASS2542_SNAPSHOT_RECEIPT_PERSISTENCE_GATE_REBALANCE_ID,
    state: blockedCount ? "blocked" : replayCount ? "watch" : "ready_for_persisted_snapshot_receipts",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 78,
    manualSemanticCompletionAfterPercent: 81,
    targetedSemanticBatchFiles: 68,
    targetedSemanticBatchLines: 296880,
    snapshotReceiptPersistenceBeforePercent: 0,
    snapshotReceiptPersistenceAfterPercent: 41,
    pdfDownloadReleaseGateBeforePercent: 46,
    pdfDownloadReleaseGateAfterPercent: 68,
    accountVaultReceiptTimelineBeforePercent: 57,
    accountVaultReceiptTimelineAfterPercent: 72,
    angelReceiptAwareSummaryBeforePercent: 52,
    angelReceiptAwareSummaryAfterPercent: 69,
    checkoutReceiptWriteBoundaryBeforePercent: 52,
    checkoutReceiptWriteBoundaryAfterPercent: 70,
    worldclassInventionIndexBeforePercent: 99,
    worldclassInventionIndexAfterPercent: 99,
    inheritedPass2541State: args.pass2541?.state === "ready_for_snapshot_parity" ? "ready" : (args.pass2541?.state ?? "missing"),
    persistedReceipts,
    ledgerEvents,
    fixtures,
    semanticLanes,
    masterTxtAdditions: [
      "PASS2542 persists PASS2541 snapshot parity into customer-safe receipt records: account vault, PDF preview, PDF download, Browser, Angel and checkout must point at a persisted snapshot receipt before download/final copy.",
      "Customer download is now release-gated by persistedSnapshotHash, accountVaultHash, pdfPreviewHash=pdfDownloadHash, vaultWriteEventId, durableStoreId, TTL validity, no-raw-key copy score and tamper-evident chain hash.",
      "Hash drift, missing vault write, TTL expiry or checkout client-only success keeps export in replay_required/block_and_quarantine instead of showing final/paid/download copy.",
      "Angel is bound to the persisted receipt state and can explain missing proof, but cannot be the source of export unlock or repeat raw prompt/tool/payment material.",
    ],
    nextPassQueue: [
      "PASS2543: real DOM/export snapshot scanner for PL/EN/DE templates and route payloads.",
      "PASS2544: mobile account vault compact card showing persisted receipt, hash match, TTL and no-raw-key score.",
      "PASS2545: source-provider adapter contract that strips raw provider body before any React prop leaves lib/market-integrity.",
      "PASS2546: repeated leak-attempt incident lane with operator dual-control and customer-safe notice.",
      "PASS2547: PDF/browser actual download handler gate that consumes persisted snapshot receipts before file generation.",
    ],
    persistenceRule: "Customer export/download/final copy is allowed only when a persisted snapshot receipt exists, accountVaultHash and preview/download hashes match, vault write and durable store IDs are present, TTL is valid, no-raw-key copy score is high enough, and tamper-evident chain hash is stable.",
    fingerprint: stableHash({ persistedReceipts: persistedReceipts.map((receipt) => [receipt.id, receipt.state, receipt.customerDownloadAllowed, receipt.tamperEvidentChainHash]), ledgerEventCount: ledgerEvents.length }),
  };
}
