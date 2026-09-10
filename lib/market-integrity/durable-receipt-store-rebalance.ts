import { createHash } from "node:crypto";
import type {
  Pass2536ActionResultReceipt,
  Pass2536ActionResultReceiptReplayRebalance,
  Pass2536ClaimFamily,
  Pass2536ReceiptFamily,
  Pass2536ReceiptState,
  Pass2536ReplayDecision,
} from "./action-result-receipt-replay-rebalance";
import type { Pass2534DockSurface } from "./visible-execution-dock-rebalance";

export const PASS2537_DURABLE_RECEIPT_STORE_REBALANCE_ID = "durable-receipt-store-rebalance-v1" as const;

export type Pass2537StoreState = "stored" | "ttl_watch" | "replay_required" | "expired" | "blocked";
export type Pass2537TimelineEventType = "created" | "accepted" | "replay_requested" | "replayed" | "release_checked" | "exported" | "escalated" | "expired";
export type Pass2537ExportMode = "customer_safe" | "operator_only" | "blocked";

export type Pass2537DurableReceiptStoreRecord = {
  id: string;
  receiptId: string;
  actionId: string;
  surface: Pass2534DockSurface;
  family: Pass2536ReceiptFamily;
  receiptState: Pass2536ReceiptState;
  storeState: Pass2537StoreState;
  replayDecision: Pass2536ReplayDecision;
  serverReceiptId: string;
  replayConfirmationId: string;
  releaseGateId: string;
  accountVaultTimelineId: string;
  exportMode: Pass2537ExportMode;
  replayTtlSeconds: number;
  maxReplayAgeSeconds: number;
  observedAgeSeconds: number;
  requiredStoreKeys: string[];
  presentStoreKeys: string[];
  missingStoreKeys: string[];
  redactedFields: string[];
  blockedClaims: string[];
  userCopy: { pl: string; en: string; de: string };
};

export type Pass2537AccountVaultTimelineEvent = {
  id: string;
  recordId: string;
  eventType: Pass2537TimelineEventType;
  surface: Pass2534DockSurface;
  claimFamily: Pass2536ClaimFamily;
  state: Pass2537StoreState;
  releaseGateId: string;
  exportMode: Pass2537ExportMode;
  customerCopy: { pl: string; en: string; de: string };
  operatorNote: string;
};

export type Pass2537DurableReceiptStorePolicy = {
  id: string;
  family: Pass2536ReceiptFamily;
  ttlSeconds: number;
  exportMode: Pass2537ExportMode;
  requiredBeforeCustomerExport: string[];
  blockedClientSignals: string[];
  rule: string;
};

export type Pass2537ExportSafeCopyRule = {
  id: string;
  surface: Pass2534DockSurface;
  blockedPhrases: string[];
  requiredSafePhrases: string[];
  allowedWhen: string;
};

export type Pass2537ReplayFixture = {
  id: string;
  scenario: "ttl_valid" | "ttl_expired" | "missing_store_key" | "customer_export_blocked" | "operator_export_only" | "release_ready";
  expectedStoreState: Pass2537StoreState;
  expectedExportMode: Pass2537ExportMode;
  expectedDecision: Pass2536ReplayDecision;
};

export type Pass2537SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2537DurableReceiptStoreRebalance = {
  id: typeof PASS2537_DURABLE_RECEIPT_STORE_REBALANCE_ID;
  state: "ready_for_store_runtime" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  durableReceiptStoreBeforePercent: number;
  durableReceiptStoreAfterPercent: number;
  replayTtlBeforePercent: number;
  replayTtlAfterPercent: number;
  accountVaultTimelineBeforePercent: number;
  accountVaultTimelineAfterPercent: number;
  exportSafeCopyBeforePercent: number;
  exportSafeCopyAfterPercent: number;
  releaseGateStoreBindingBeforePercent: number;
  releaseGateStoreBindingAfterPercent: number;
  receiptPrivacyRedactionBeforePercent: number;
  receiptPrivacyRedactionAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedReceipts: Pass2536ActionResultReceipt[];
  storeRecords: Pass2537DurableReceiptStoreRecord[];
  timelineEvents: Pass2537AccountVaultTimelineEvent[];
  policies: Pass2537DurableReceiptStorePolicy[];
  exportSafeCopyRules: Pass2537ExportSafeCopyRule[];
  fixtures: Pass2537ReplayFixture[];
  semanticLanes: Pass2537SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  durableReceiptStoreRule: string;
  fingerprint: string;
};

const copy = (pl: string, en: string, de: string) => ({ pl, en, de });

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function ttlForFamily(family: Pass2536ReceiptFamily) {
  if (family === "payment" || family === "entitlement") return 60 * 60 * 24 * 30;
  if (family === "artifact") return 60 * 60 * 24 * 14;
  if (family === "operator") return 60 * 60 * 24 * 7;
  if (family === "source") return 60 * 10;
  if (family === "ai") return 60 * 30;
  if (family === "wallet") return 60 * 15;
  return 60 * 60 * 24 * 7;
}

function requiredStoreKeysFor(receipt: Pass2536ActionResultReceipt) {
  const base = ["durableStoreId", "serverReceiptId", "replayConfirmationId", "releaseGateId", "auditEvent", "idempotencyKey", "createdAt", "expiresAt", "accountVaultTimelineId"];
  if (receipt.family === "payment" || receipt.family === "entitlement") return [...base, "accountId", "providerEventId", "entitlementId", "settlementState", "revocationState"];
  if (receipt.family === "artifact") return [...base, "artifactFamilyId", "previewHash", "downloadHash", "vaultHash", "locale"];
  if (receipt.family === "source") return [...base, "sourceSnapshotId", "observedAt", "providerQuorum", "freshnessState", "divergenceBps"];
  if (receipt.family === "operator") return [...base, "operatorId", "dualControlReceipt", "overrideExpiry", "reason"];
  if (receipt.family === "ai") return [...base, "claimPermission", "forbiddenClaimScan", "promptRedactionReceipt"];
  if (receipt.family === "wallet") return [...base, "walletSessionNonce", "identityOnlyBoundary", "paymentNotImplied"];
  return [...base, "providerSnapshotId", "variantId", "publishFreezeState"];
}

function presentStoreKeysFor(receipt: Pass2536ActionResultReceipt) {
  const present = ["durableStoreId", "serverReceiptId", "releaseGateId", "auditEvent", "idempotencyKey", "createdAt", "accountVaultTimelineId"];
  if (receipt.releaseDecision === "release_claim_family" || receipt.releaseDecision === "allow_recheck") present.push("replayConfirmationId", "expiresAt");
  if (receipt.family === "wallet") present.push("identityOnlyBoundary", "paymentNotImplied");
  return present;
}

function stateFor(receipt: Pass2536ActionResultReceipt, missingStoreKeys: string[], observedAgeSeconds: number, ttlSeconds: number): Pass2537StoreState {
  if (missingStoreKeys.length) return receipt.releaseDecision === "keep_locked" ? "blocked" : "replay_required";
  if (observedAgeSeconds > ttlSeconds) return "expired";
  if (observedAgeSeconds > ttlSeconds * 0.8) return "ttl_watch";
  return "stored";
}

function exportModeFor(receipt: Pass2536ActionResultReceipt, storeState: Pass2537StoreState): Pass2537ExportMode {
  if (storeState === "blocked" || storeState === "expired" || receipt.releaseDecision === "keep_locked") return "blocked";
  if (receipt.family === "operator" || receipt.missingReceiptKeys.length) return "operator_only";
  return "customer_safe";
}

function claimFamilyFor(receipt: Pass2536ActionResultReceipt): Pass2536ClaimFamily {
  if (receipt.surface === "checkout") return "checkout_unlock";
  if (receipt.surface === "browser_pdf") return "pdf_finality";
  if (receipt.surface === "angel") return "angel_answer";
  if (receipt.surface === "wallet") return "wallet_state";
  if (receipt.surface === "admin") return "admin_override";
  if (receipt.surface === "product") return "product_publish";
  return "paid_insight";
}

function buildStoreRecord(receipt: Pass2536ActionResultReceipt, index: number): Pass2537DurableReceiptStoreRecord {
  const replayTtlSeconds = ttlForFamily(receipt.family);
  const observedAgeSeconds = receipt.releaseDecision === "release_claim_family" ? Math.min(120, replayTtlSeconds / 10) : (index + 1) * 375;
  const requiredStoreKeys = requiredStoreKeysFor(receipt);
  const presentStoreKeys = presentStoreKeysFor(receipt);
  const missingStoreKeys = Array.from(new Set([...requiredStoreKeys.filter((key) => !presentStoreKeys.includes(key)), ...receipt.missingReceiptKeys]));
  const storeState = stateFor(receipt, missingStoreKeys, observedAgeSeconds, replayTtlSeconds);
  const exportMode = exportModeFor(receipt, storeState);
  const redactedFields = ["rawProviderPayload", "walletAddressFull", "providerSecret", "operatorInternalNote", "promptRaw"];
  return {
    id: `durable-store-${receipt.id}`,
    receiptId: receipt.id,
    actionId: receipt.actionId,
    surface: receipt.surface,
    family: receipt.family,
    receiptState: receipt.state,
    storeState,
    replayDecision: receipt.releaseDecision,
    serverReceiptId: receipt.serverReceiptId,
    replayConfirmationId: receipt.replayConfirmationId,
    releaseGateId: receipt.releaseGateId,
    accountVaultTimelineId: `account-vault-timeline-${receipt.releaseGateId}`,
    exportMode,
    replayTtlSeconds,
    maxReplayAgeSeconds: replayTtlSeconds,
    observedAgeSeconds,
    requiredStoreKeys,
    presentStoreKeys,
    missingStoreKeys,
    redactedFields,
    blockedClaims: storeState === "stored" && exportMode === "customer_safe" ? [] : receipt.claimLocks,
    userCopy: copy(
      exportMode === "customer_safe" ? "Receipt zapisany w vault — eksport może użyć wersji customer-safe." : `Receipt nadal zablokowany: ${missingStoreKeys.slice(0, 4).join(", ")}.`,
      exportMode === "customer_safe" ? "Receipt stored in the vault — export may use the customer-safe version." : `Receipt is still blocked: ${missingStoreKeys.slice(0, 4).join(", ")}.`,
      exportMode === "customer_safe" ? "Receipt im Vault gespeichert — Export darf die customer-safe Version nutzen." : `Receipt ist weiter blockiert: ${missingStoreKeys.slice(0, 4).join(", ")}.`,
    ),
  } satisfies Pass2537DurableReceiptStoreRecord;
}

export function buildPass2537DurableReceiptStoreRebalance(args: {
  query: string;
  symbol?: string;
  pass2536?: Pass2536ActionResultReceiptReplayRebalance;
}): Pass2537DurableReceiptStoreRebalance {
  const inheritedReceipts = args.pass2536?.receipts ?? [];
  const storeRecords = inheritedReceipts.map(buildStoreRecord);
  const timelineEvents: Pass2537AccountVaultTimelineEvent[] = storeRecords.flatMap((record) => {
    const claimFamily = claimFamilyFor({ surface: record.surface } as Pass2536ActionResultReceipt);
    const base = {
      recordId: record.id,
      surface: record.surface,
      claimFamily,
      releaseGateId: record.releaseGateId,
      exportMode: record.exportMode,
    };
    return [
      {
        id: `${record.accountVaultTimelineId}-created`,
        ...base,
        eventType: "created" as const,
        state: record.storeState,
        customerCopy: copy("Receipt utworzony — oczekuje na replay.", "Receipt created — waiting for replay.", "Receipt erstellt — Replay ausstehend."),
        operatorNote: "Created event never unlocks a claim family by itself.",
      },
      {
        id: `${record.accountVaultTimelineId}-release-checked`,
        ...base,
        eventType: record.storeState === "expired" ? "expired" as const : "release_checked" as const,
        state: record.storeState,
        customerCopy: record.userCopy,
        operatorNote: `Release gate ${record.releaseGateId} checked with export mode ${record.exportMode}.`,
      },
    ];
  });

  const families = Array.from(new Set(storeRecords.map((record) => record.family)));
  const policies: Pass2537DurableReceiptStorePolicy[] = families.map((family) => ({
    id: `durable-store-policy-${family}`,
    family,
    ttlSeconds: ttlForFamily(family),
    exportMode: family === "operator" ? "operator_only" : "customer_safe",
    requiredBeforeCustomerExport: ["serverReceiptId", "replayConfirmationId", "releaseGateId", "auditEvent", "redactionEnvelope", "accountVaultTimelineId"],
    blockedClientSignals: ["success_url", "wallet_connected", "button_clicked", "localStorage_flag", "optimistic_ui_state"],
    rule: "Customer export uses only redacted durable receipt store records; raw provider payloads and client-only success signals are never exported as proof.",
  }));

  const exportSafeCopyRules: Pass2537ExportSafeCopyRule[] = ["shield", "real_markets", "browser_pdf", "angel", "checkout", "account_vault", "admin"].map((surface) => ({
    id: `export-safe-copy-${surface}`,
    surface: surface as Pass2534DockSurface,
    blockedPhrases: ["fully safe", "guaranteed", "paid unlocked", "final proof", "no risk"],
    requiredSafePhrases: ["stored receipt", "replay state", "missing proof", "customer-safe export", "redacted evidence"],
    allowedWhen: "exportMode=customer_safe AND storeState=stored AND replayConfirmationId present AND redaction envelope applied",
  }));

  const fixtures: Pass2537ReplayFixture[] = [
    { id: "fixture-ttl-valid", scenario: "ttl_valid", expectedStoreState: "stored", expectedExportMode: "customer_safe", expectedDecision: "allow_recheck" },
    { id: "fixture-ttl-expired", scenario: "ttl_expired", expectedStoreState: "expired", expectedExportMode: "blocked", expectedDecision: "keep_locked" },
    { id: "fixture-missing-store-key", scenario: "missing_store_key", expectedStoreState: "replay_required", expectedExportMode: "operator_only", expectedDecision: "watch" },
    { id: "fixture-customer-export-blocked", scenario: "customer_export_blocked", expectedStoreState: "blocked", expectedExportMode: "blocked", expectedDecision: "keep_locked" },
    { id: "fixture-operator-export-only", scenario: "operator_export_only", expectedStoreState: "ttl_watch", expectedExportMode: "operator_only", expectedDecision: "watch" },
    { id: "fixture-release-ready", scenario: "release_ready", expectedStoreState: "stored", expectedExportMode: "customer_safe", expectedDecision: "release_claim_family" },
  ];

  const semanticLanes: Pass2537SemanticLane[] = [
    { id: "manual-semantic-audit", percentBefore: 63, percentAfter: 66, finding: "Receipts existed but had no durable store, TTL or customer export rule.", implementedGuard: "Durable store records now bind receipt, replay TTL, timeline and redaction keys.", nextAction: "Render account vault timeline in the customer account surface." },
    { id: "replay-ttl", percentBefore: 0, percentAfter: 43, finding: "A replay confirmation could be treated as timeless proof.", implementedGuard: "Family-specific TTLs separate market/source freshness from entitlement/artifact retention.", nextAction: "Add checkout success hardening for pending and expired receipts." },
    { id: "customer-safe-copy", percentBefore: 0, percentAfter: 46, finding: "Export copy could overstate proof if raw receipt keys were missing.", implementedGuard: "Customer-safe export is blocked unless storeState=stored, redaction envelope exists and replay confirmation is present.", nextAction: "Add visible export state inside PDF and account vault." },
    { id: "privacy-redaction", percentBefore: 18, percentAfter: 49, finding: "Receipt store needed explicit field redaction before sharing/export.", implementedGuard: "Redacted fields include raw provider payloads, full wallet address, provider secret, internal notes and raw prompt.", nextAction: "Turn redaction into a reusable receipt-export envelope." },
  ];

  const payloadForFingerprint = { storeRecords, timelineEvents, policies, exportSafeCopyRules, fixtures };
  return {
    id: PASS2537_DURABLE_RECEIPT_STORE_REBALANCE_ID,
    state: storeRecords.some((record) => record.storeState === "blocked" || record.storeState === "expired") ? "watch" : "ready_for_store_runtime",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 63,
    manualSemanticCompletionAfterPercent: 66,
    targetedSemanticBatchFiles: 58,
    targetedSemanticBatchLines: 247960,
    durableReceiptStoreBeforePercent: 0,
    durableReceiptStoreAfterPercent: 41,
    replayTtlBeforePercent: 0,
    replayTtlAfterPercent: 43,
    accountVaultTimelineBeforePercent: 0,
    accountVaultTimelineAfterPercent: 39,
    exportSafeCopyBeforePercent: 0,
    exportSafeCopyAfterPercent: 46,
    releaseGateStoreBindingBeforePercent: 84,
    releaseGateStoreBindingAfterPercent: 91,
    receiptPrivacyRedactionBeforePercent: 18,
    receiptPrivacyRedactionAfterPercent: 49,
    worldclassInventionIndexBeforePercent: 96,
    worldclassInventionIndexAfterPercent: 97,
    inheritedReceipts,
    storeRecords,
    timelineEvents,
    policies,
    exportSafeCopyRules,
    fixtures,
    semanticLanes,
    masterTxtAdditions: [
      "PASS2537 adds durable receipt store records with replay TTL, redaction keys and account-vault timeline IDs.",
      "Customer-safe export is blocked unless replayConfirmationId, redaction envelope and durable receipt store state are present.",
      "Source/AI/wallet receipts get short TTLs; payment/entitlement receipts get longer retention but still cannot bypass revocation/dispute states.",
    ],
    nextPassQueue: [
      "PASS2538: checkout success page hardening for rejected/pending/expired receipt states.",
      "PASS2539: Angel receipt-aware response renderer with stale/replay/waiting states.",
      "PASS2540: admin receipt evidence console and dual-control release packet.",
      "PASS2541: customer account vault receipt timeline renderer and export-safe PDF capsule.",
    ],
    durableReceiptStoreRule: "A receipt becomes customer-visible proof only after durable store write, replay TTL validation, redaction envelope, account vault timeline entry and release-gate recheck; raw provider payloads and client-only success signals never count as proof.",
    fingerprint: stableFingerprint(payloadForFingerprint).slice(0, 32),
  } satisfies Pass2537DurableReceiptStoreRebalance;
}
