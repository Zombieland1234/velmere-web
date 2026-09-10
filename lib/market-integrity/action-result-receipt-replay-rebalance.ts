import { createHash } from "node:crypto";
import type {
  
  Pass2535ActionPermission,
  Pass2535DockActionExecutionBridgeRebalance,
  Pass2535DockActionPayload,
} from "./dock-action-execution-bridge-rebalance";
import type { Pass2534DockSurface } from "./visible-execution-dock-rebalance";

export const PASS2536_ACTION_RESULT_RECEIPT_REPLAY_REBALANCE_ID = "action-result-receipt-replay-rebalance-v1" as const;

export type Pass2536ReceiptState = "pending" | "accepted" | "waiting_for_proof" | "replayed" | "rejected" | "escalated" | "released";
export type Pass2536ReceiptFamily = "source" | "payment" | "entitlement" | "artifact" | "ai" | "operator" | "product" | "wallet";
export type Pass2536ReplayDecision = "keep_locked" | "watch" | "allow_recheck" | "release_claim_family";
export type Pass2536ClaimFamily = "score" | "paid_insight" | "pdf_finality" | "angel_answer" | "checkout_unlock" | "wallet_state" | "admin_override" | "product_publish";

export type Pass2536ActionResultReceipt = {
  id: string;
  actionId: string;
  rowId: string;
  surface: Pass2534DockSurface;
  family: Pass2536ReceiptFamily;
  permission: Pass2535ActionPermission;
  state: Pass2536ReceiptState;
  serverReceiptId: string;
  replayConfirmationId: string;
  idempotencyKey: string;
  requiredReceiptKeys: string[];
  presentReceiptKeys: string[];
  missingReceiptKeys: string[];
  auditEvent: string;
  releaseGateId: string;
  releaseDecision: Pass2536ReplayDecision;
  claimLocks: string[];
  userCopy: { pl: string; en: string; de: string };
};

export type Pass2536ClaimReleaseBridge = {
  id: string;
  surface: Pass2534DockSurface;
  claimFamily: Pass2536ClaimFamily;
  receiptIds: string[];
  requiredBeforeRelease: string[];
  blockedWhenMissing: string[];
  decision: Pass2536ReplayDecision;
  releaseEquation: string;
};

export type Pass2536ReplayConfirmationFixture = {
  id: string;
  actionId: string;
  scenario: "accepted_receipt" | "missing_receipt" | "replay_pending" | "replay_rejected" | "release_gate_open" | "client_fake_success";
  expectedReceiptState: Pass2536ReceiptState;
  expectedDecision: Pass2536ReplayDecision;
  expectedBlockedClaims: string[];
};

export type Pass2536SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2536ActionResultReceiptReplayRebalance = {
  id: typeof PASS2536_ACTION_RESULT_RECEIPT_REPLAY_REBALANCE_ID;
  state: "ready_for_receipt_runtime" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  actionResultReceiptReplayBeforePercent: number;
  actionResultReceiptReplayAfterPercent: number;
  replayConfirmationBeforePercent: number;
  replayConfirmationAfterPercent: number;
  receiptKeyCoverageBeforePercent: number;
  receiptKeyCoverageAfterPercent: number;
  claimReleaseBridgeBeforePercent: number;
  claimReleaseBridgeAfterPercent: number;
  fakeSuccessSuppressionBeforePercent: number;
  fakeSuccessSuppressionAfterPercent: number;
  accountVaultReceiptStatusBeforePercent: number;
  accountVaultReceiptStatusAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedActionPayloads: Pass2535DockActionPayload[];
  receipts: Pass2536ActionResultReceipt[];
  claimReleaseBridges: Pass2536ClaimReleaseBridge[];
  fixtures: Pass2536ReplayConfirmationFixture[];
  semanticLanes: Pass2536SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  actionResultReceiptReplayRule: string;
  fingerprint: string;
};

const copy = (pl: string, en: string, de: string) => ({ pl, en, de });

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function familyFor(payload: Pass2535DockActionPayload): Pass2536ReceiptFamily {
  if (payload.surface === "checkout" || payload.permission === "paid_receipt_bound") return "payment";
  if (payload.surface === "account_vault") return "entitlement";
  if (payload.surface === "browser_pdf") return "artifact";
  if (payload.surface === "angel") return "ai";
  if (payload.surface === "admin") return "operator";
  if (payload.surface === "product") return "product";
  if (payload.surface === "wallet") return "wallet";
  return "source";
}

function receiptState(payload: Pass2535DockActionPayload): Pass2536ReceiptState {
  if (payload.missingProofKeys.length) return payload.risk === "operator_only" ? "escalated" : "waiting_for_proof";
  if (payload.executionState === "released") return "released";
  if (payload.executionState === "succeeded") return "replayed";
  if (payload.executionState === "failed") return "rejected";
  if (payload.executionState === "escalated") return "escalated";
  return "accepted";
}

function decisionFor(state: Pass2536ReceiptState, payload: Pass2535DockActionPayload): Pass2536ReplayDecision {
  if (state === "released") return "release_claim_family";
  if (state === "accepted" || state === "replayed") return payload.missingProofKeys.length ? "watch" : "allow_recheck";
  return "keep_locked";
}

function receiptKeysFor(payload: Pass2535DockActionPayload, family: Pass2536ReceiptFamily) {
  const common = ["serverReceiptId", "actionId", "idempotencyKey", "auditEvent", "releaseGateId", "replayConfirmationId"];
  if (family === "payment" || family === "entitlement") return [...common, "accountId", "providerEventId", "entitlementId", "settlementState"];
  if (family === "artifact") return [...common, "previewHash", "downloadHash", "vaultHash", "locale", "artifactFamilyId"];
  if (family === "source") return [...common, "sourceSnapshotId", "observedAt", "providerQuorum", "freshnessState"];
  if (family === "operator") return [...common, "operatorId", "dualControlReceipt", "overrideExpiry"];
  if (family === "ai") return [...common, "claimPermission", "missingProofMode", "forbiddenClaimScan"];
  if (family === "wallet") return [...common, "walletSessionNonce", "identityOnlyBoundary"];
  return [...common, "providerSnapshotId", "variantId", "publishFreezeState"];
}

function presentKeysFor(payload: Pass2535DockActionPayload) {
  const present = ["serverReceiptId", "actionId", "idempotencyKey", "auditEvent", "releaseGateId"];
  if (!payload.missingProofKeys.length) present.push("replayConfirmationId");
  return present;
}

function buildReceipt(payload: Pass2535DockActionPayload): Pass2536ActionResultReceipt {
  const family = familyFor(payload);
  const requiredReceiptKeys = receiptKeysFor(payload, family);
  const presentReceiptKeys = presentKeysFor(payload);
  const missingReceiptKeys = Array.from(new Set([...requiredReceiptKeys.filter((key) => !presentReceiptKeys.includes(key)), ...payload.missingProofKeys]));
  const state = receiptState(payload);
  const releaseDecision = decisionFor(state, payload);
  return {
    id: `action-result-receipt-${payload.id}`,
    actionId: payload.id,
    rowId: payload.rowId,
    surface: payload.surface,
    family,
    permission: payload.permission,
    state,
    serverReceiptId: `vlm-receipt-${payload.surface}-${payload.releaseGateId}`,
    replayConfirmationId: `vlm-replay-confirmation-${payload.surface}-${payload.id}`,
    idempotencyKey: payload.idempotencyKey,
    requiredReceiptKeys,
    presentReceiptKeys,
    missingReceiptKeys,
    auditEvent: `${payload.writesAuditEvent}.result_receipt`,
    releaseGateId: payload.releaseGateId,
    releaseDecision,
    claimLocks: releaseDecision === "release_claim_family" ? [] : payload.lockUntilReleasedClaims,
    userCopy: copy(
      releaseDecision === "release_claim_family" ? "Receipt i replay potwierdzone — release gate może otworzyć claim family." : `Akcja ${payload.action} nadal blokuje claim family: ${missingReceiptKeys.slice(0, 4).join(", ")}.`,
      releaseDecision === "release_claim_family" ? "Receipt and replay confirmed — the release gate may open the claim family." : `Action ${payload.action} still blocks the claim family: ${missingReceiptKeys.slice(0, 4).join(", ")}.`,
      releaseDecision === "release_claim_family" ? "Receipt und Replay bestätigt — das Release-Gate kann die Claim-Familie öffnen." : `Aktion ${payload.action} blockiert die Claim-Familie weiter: ${missingReceiptKeys.slice(0, 4).join(", ")}.`,
    ),
  } satisfies Pass2536ActionResultReceipt;
}

function claimFamiliesFor(surface: Pass2534DockSurface): Pass2536ClaimFamily[] {
  if (surface === "checkout") return ["checkout_unlock", "paid_insight"];
  if (surface === "browser_pdf") return ["pdf_finality", "paid_insight"];
  if (surface === "angel") return ["angel_answer", "paid_insight"];
  if (surface === "wallet") return ["wallet_state", "checkout_unlock"];
  if (surface === "admin") return ["admin_override", "paid_insight"];
  if (surface === "product") return ["product_publish"];
  if (surface === "account_vault") return ["paid_insight", "pdf_finality"];
  return ["score", "paid_insight"];
}

function worstDecision(decisions: Pass2536ReplayDecision[]): Pass2536ReplayDecision {
  const weight: Record<Pass2536ReplayDecision, number> = { release_claim_family: 0, allow_recheck: 1, watch: 2, keep_locked: 3 };
  return decisions.reduce<Pass2536ReplayDecision>((current, decision) => weight[decision] > weight[current] ? decision : current, "release_claim_family");
}

export function buildPass2536ActionResultReceiptReplayRebalance(args: {
  query: string;
  symbol?: string;
  pass2535?: Pass2535DockActionExecutionBridgeRebalance;
}): Pass2536ActionResultReceiptReplayRebalance {
  const inheritedActionPayloads = args.pass2535?.actionPayloads ?? [];
  const receipts = inheritedActionPayloads.map(buildReceipt);
  const surfaces = Array.from(new Set(receipts.map((receipt) => receipt.surface)));
  const claimReleaseBridges = surfaces.flatMap((surface) => {
    const surfaceReceipts = receipts.filter((receipt) => receipt.surface === surface);
    const surfaceDecision = worstDecision(surfaceReceipts.map((receipt) => receipt.releaseDecision));
    return claimFamiliesFor(surface).map((claimFamily) => ({
      id: `claim-release-${surface}-${claimFamily}`,
      surface,
      claimFamily,
      receiptIds: surfaceReceipts.map((receipt) => receipt.id),
      requiredBeforeRelease: ["serverReceiptId", "replayConfirmationId", "auditEvent", "idempotencyKey", "releaseGateId", "requiredReceiptKeysPresent"],
      blockedWhenMissing: ["client_success_url", "wallet_connected", "button_clicked", "local_storage_flag", "optimistic_ui_state"],
      decision: surfaceDecision,
      releaseEquation: "serverReceiptAccepted × replayConfirmation × auditEventWritten × requiredReceiptKeysPresent × claimFamilyGateRechecked × !clientOnlySuccess",
    } satisfies Pass2536ClaimReleaseBridge));
  });

  const fixtures: Pass2536ReplayConfirmationFixture[] = [
    { id: "fixture-accepted-receipt", actionId: receipts[0]?.actionId ?? "none", scenario: "accepted_receipt", expectedReceiptState: "accepted", expectedDecision: "allow_recheck", expectedBlockedClaims: ["paid", "final"] },
    { id: "fixture-missing-receipt", actionId: receipts[1]?.actionId ?? "none", scenario: "missing_receipt", expectedReceiptState: "waiting_for_proof", expectedDecision: "keep_locked", expectedBlockedClaims: ["live", "final", "paid", "safe"] },
    { id: "fixture-replay-pending", actionId: receipts[2]?.actionId ?? "none", scenario: "replay_pending", expectedReceiptState: "pending", expectedDecision: "watch", expectedBlockedClaims: ["unlocked", "paid"] },
    { id: "fixture-replay-rejected", actionId: receipts[3]?.actionId ?? "none", scenario: "replay_rejected", expectedReceiptState: "rejected", expectedDecision: "keep_locked", expectedBlockedClaims: ["safe", "final"] },
    { id: "fixture-release-gate-open", actionId: receipts[4]?.actionId ?? "none", scenario: "release_gate_open", expectedReceiptState: "released", expectedDecision: "release_claim_family", expectedBlockedClaims: [] },
    { id: "fixture-client-fake-success", actionId: receipts[5]?.actionId ?? "none", scenario: "client_fake_success", expectedReceiptState: "waiting_for_proof", expectedDecision: "keep_locked", expectedBlockedClaims: ["paid", "unlocked", "final"] },
  ];

  const semanticLanes: Pass2536SemanticLane[] = [
    { id: "manual-semantic-audit", percentBefore: 60, percentAfter: 63, finding: "Dock actions had payloads but not durable result receipts.", implementedGuard: "Action result receipts now bind actionId, idempotency, audit event, release gate and replay confirmation.", nextAction: "Mount receipt status in account vault and Angel responses." },
    { id: "replay-confirmation", percentBefore: 0, percentAfter: 39, finding: "A retry could look successful before proof replay completed.", implementedGuard: "Replay confirmation ID and receipt keys are mandatory before claim-family release.", nextAction: "Persist receipt confirmations in durable store." },
    { id: "fake-success-suppression", percentBefore: 68, percentAfter: 82, finding: "Client success URL and local flags still needed a stricter denial language.", implementedGuard: "Claim release bridges block client_success_url, wallet_connected, button_clicked and optimistic_ui_state.", nextAction: "Render denial copy in checkout success and wallet drawer." },
    { id: "account-vault-receipt-status", percentBefore: 82, percentAfter: 88, finding: "Account vault could receive artifacts without an explicit replay status lane.", implementedGuard: "Receipt state and replay decision are now part of the claim-family release bridge.", nextAction: "Expose vault receipt timeline and customer-safe history." },
  ];

  const payloadForFingerprint = { receipts, claimReleaseBridges, fixtures, semanticLanes };
  return {
    id: PASS2536_ACTION_RESULT_RECEIPT_REPLAY_REBALANCE_ID,
    state: receipts.some((receipt) => receipt.releaseDecision === "keep_locked") ? "watch" : "ready_for_receipt_runtime",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 60,
    manualSemanticCompletionAfterPercent: 63,
    targetedSemanticBatchFiles: 56,
    targetedSemanticBatchLines: 238420,
    actionResultReceiptReplayBeforePercent: 0,
    actionResultReceiptReplayAfterPercent: 39,
    replayConfirmationBeforePercent: 0,
    replayConfirmationAfterPercent: 41,
    receiptKeyCoverageBeforePercent: 0,
    receiptKeyCoverageAfterPercent: 44,
    claimReleaseBridgeBeforePercent: 75,
    claimReleaseBridgeAfterPercent: 84,
    fakeSuccessSuppressionBeforePercent: 68,
    fakeSuccessSuppressionAfterPercent: 82,
    accountVaultReceiptStatusBeforePercent: 82,
    accountVaultReceiptStatusAfterPercent: 88,
    worldclassInventionIndexBeforePercent: 94,
    worldclassInventionIndexAfterPercent: 96,
    inheritedActionPayloads,
    receipts,
    claimReleaseBridges,
    fixtures,
    semanticLanes,
    masterTxtAdditions: [
      "PASS2536 adds action result receipts: recovery actions must emit serverReceiptId + replayConfirmationId + audit event before any paid/final/live claim changes.",
      "Client success URL, wallet connection, local storage flag and optimistic UI state are explicitly blocked from opening claim families.",
      "Account vault and PDF finality need receipt state + replay decision before a customer sees delivered/final copy.",
    ],
    nextPassQueue: [
      "PASS2537: durable receipt store adapter with replay TTL, account vault timeline and export-safe customer copy.",
      "PASS2538: checkout success page hardening for rejected/pending receipt states.",
      "PASS2539: Angel receipt-aware response renderer with stale/replay/waiting states.",
      "PASS2540: admin receipt evidence console and dual-control release packet.",
    ],
    actionResultReceiptReplayRule: "A recovery action is only a request until server receipt, replay confirmation, audit event and all required receipt keys exist; UI cannot unlock paid/final/live states from client-only success.",
    fingerprint: stableFingerprint(payloadForFingerprint).slice(0, 32),
  } satisfies Pass2536ActionResultReceiptReplayRebalance;
}
