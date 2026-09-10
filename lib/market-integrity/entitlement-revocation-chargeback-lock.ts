import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { createHash } from "node:crypto";
import type { Pass2493EntitlementAccountVaultRetrievalContract } from "./entitlement-account-vault-retrieval-contract";

export const PASS2494_ENTITLEMENT_REVOCATION_CHARGEBACK_LOCK_ID = "entitlement-revocation-chargeback-lock-v1" as const;

export type Pass2494RevocationState = "active_access_allowed" | "revocation_watch" | "refunded_or_chargebacked" | "expired_or_superseded" | "vault_replay_required" | "blocked";
export type Pass2494RevocationMode = "active_paid_vault_access" | "active_missing_proof_map_access" | "revoked_access_hidden" | "review_required" | "blocked";
export type Pass2494RevocationStatus = "active" | "refunded" | "chargeback" | "disputed" | "expired" | "revoked" | "superseded" | "unknown";
export type Pass2494RevocationSurface = "account_console" | "account_message_card" | "pdf_download" | "browser_preview" | "vlm_brain" | "angel" | "checkout_success" | "admin_console";

export type Pass2494RevocationInput = {
  entitlementId?: string;
  serverReceiptFingerprint?: string;
  vaultRetrievalKey?: string;
  revocationStatus?: string;
  refundFingerprint?: string;
  disputeFingerprint?: string;
  chargebackFingerprint?: string;
  revokedAt?: string;
  expiresAt?: string;
  replacementEntitlementFingerprint?: string;
  operatorReviewFingerprint?: string;
  requestSurface?: string;
  locale?: string;
};

export type Pass2494SurfaceRevocationBinding = {
  surface: Pass2494RevocationSurface;
  mustCheckRevocationLedger: true;
  mustHidePaidArtifactWhenRevoked: true;
  mustShowRevocationState: boolean;
  paidCopyAllowed: boolean;
  retrievalCopyAllowed: boolean;
  requiredVisibleCopy: string;
};

export type Pass2494EntitlementRevocationChargebackLock = {
  version: typeof PASS2494_ENTITLEMENT_REVOCATION_CHARGEBACK_LOCK_ID;
  state: Pass2494RevocationState;
  accessMode: Pass2494RevocationMode;
  query?: string;
  symbol?: string;
  entitlementId?: string;
  revocationStatus: Pass2494RevocationStatus;
  revocationLedgerActive: boolean;
  revocationClear: boolean;
  activeVaultAccessAllowed: boolean;
  finalPaidVerdictAccessAllowed: boolean;
  missingProofMapAccessAllowed: boolean;
  refundedOrChargebacked: boolean;
  disputeReviewRequired: boolean;
  expiredOrSuperseded: boolean;
  accountVaultRetrievalStillRequired: boolean;
  serverReceiptStillRequired: true;
  walletOnlyStillDenied: true;
  localStorageUnlockStillDenied: true;
  publicCacheStillDenied: true;
  linkedPass2493VaultRetrievalKey?: string;
  requestedVaultRetrievalKey?: string;
  revocationLedgerKey: string;
  refundFingerprint?: string;
  disputeFingerprint?: string;
  chargebackFingerprint?: string;
  replacementEntitlementFingerprint?: string;
  operatorReviewFingerprint?: string;
  customerMessage: string;
  operatorMessage: string;
  blockers: string[];
  revocationRequirements: string[];
  surfaceRevocationBindings: Pass2494SurfaceRevocationBinding[];
  forbiddenAccessStates: string[];
  redactionBoundary: string;
  nextImplementationActions: string[];
  fingerprint: string;
  generatedAt: string;
};

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function bounded(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, "").trim().slice(0, maxLength) || fallback;
}

function normalizeKey(value?: string) {
  return bounded(value, 220, "").toUpperCase().replace(/[^A-Z0-9:_-]/g, "").slice(0, 220);
}

function normalizeSymbol(value?: string) {
  return bounded(value, 40).toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function normalizeStatus(value?: string): Pass2494RevocationStatus {
  const clean = bounded(value, 40, "unknown").toLowerCase().replace(/[^a-z_-]/g, "");
  if (clean === "active") return "active";
  if (clean === "refunded" || clean === "refund") return "refunded";
  if (clean === "chargeback" || clean === "chargebacked") return "chargeback";
  if (clean === "disputed" || clean === "dispute" || clean === "review") return "disputed";
  if (clean === "expired") return "expired";
  if (clean === "revoked") return "revoked";
  if (clean === "superseded" || clean === "replaced") return "superseded";
  return "unknown";
}

function isExpired(value?: string) {
  const text = bounded(value, 64, "");
  if (!text) return false;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && parsed <= Date.now();
}

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function resolveState(args: {
  pass2493?: Pass2493EntitlementAccountVaultRetrievalContract | null;
  status: Pass2494RevocationStatus;
  requestedVaultRetrievalKey: string;
  linkedVaultRetrievalKey: string;
  receiptReady: boolean;
  expiredByTime: boolean;
  refundFingerprint: string;
  disputeFingerprint: string;
  chargebackFingerprint: string;
  operatorReviewFingerprint: string;
}): Pass2494RevocationState {
  if (!args.pass2493 || args.pass2493.state === "blocked") return "blocked";
  if (!args.pass2493.accountVaultRetrievalAllowed || !args.linkedVaultRetrievalKey || !args.requestedVaultRetrievalKey || args.linkedVaultRetrievalKey !== args.requestedVaultRetrievalKey) return "vault_replay_required";
  if (!args.receiptReady) return "vault_replay_required";
  if (args.status === "refunded" || args.status === "chargeback" || args.status === "revoked") return "refunded_or_chargebacked";
  if (args.chargebackFingerprint || args.refundFingerprint) return "refunded_or_chargebacked";
  if (args.status === "expired" || args.status === "superseded" || args.expiredByTime) return "expired_or_superseded";
  if (args.status === "disputed" || args.disputeFingerprint) return args.operatorReviewFingerprint ? "revocation_watch" : "revocation_watch";
  if (args.status !== "active") return "revocation_watch";
  return "active_access_allowed";
}

function accessModeFor(state: Pass2494RevocationState, pass2493?: Pass2493EntitlementAccountVaultRetrievalContract | null): Pass2494RevocationMode {
  if (state === "active_access_allowed" && pass2493?.finalPaidVerdictVaultAccessAllowed) return "active_paid_vault_access";
  if (state === "active_access_allowed" && pass2493?.missingProofMapVaultAccessAllowed) return "active_missing_proof_map_access";
  if (state === "refunded_or_chargebacked" || state === "expired_or_superseded") return "revoked_access_hidden";
  if (state === "revocation_watch" || state === "vault_replay_required") return "review_required";
  return "blocked";
}

function buildSurfaceBindings(args: { accessAllowed: boolean; revocationLedgerKey: string; status: Pass2494RevocationStatus; accessMode: Pass2494RevocationMode; }): Pass2494SurfaceRevocationBinding[] {
  const surfaces: Pass2494RevocationSurface[] = ["account_console", "account_message_card", "pdf_download", "browser_preview", "vlm_brain", "angel", "checkout_success", "admin_console"];
  const baseCopy = args.accessAllowed
    ? `Advanced vault access is active after PASS2494 revocation ledger check (${args.accessMode}).`
    : `Advanced vault access is hidden or review-only until PASS2494 revocation ledger is clear (${args.status}).`;
  return surfaces.map((surface) => ({
    surface,
    mustCheckRevocationLedger: true,
    mustHidePaidArtifactWhenRevoked: true,
    mustShowRevocationState: surface === "account_console" || surface === "account_message_card" || surface === "angel" || surface === "admin_console",
    paidCopyAllowed: args.accessAllowed,
    retrievalCopyAllowed: args.accessAllowed,
    requiredVisibleCopy: `${baseCopy} revocationLedgerKey=${args.revocationLedgerKey} surface=${surface}`,
  }));
}

export function buildPass2494EntitlementRevocationChargebackLock(args: {
  query?: string;
  symbol?: string;
  pass2493?: Pass2493EntitlementAccountVaultRetrievalContract | null;
  revocation?: Pass2494RevocationInput | null;
}): Pass2494EntitlementRevocationChargebackLock {
  const status = normalizeStatus(args.revocation?.revocationStatus);
  const linkedVaultRetrievalKey = normalizeKey(args.pass2493?.vaultRetrievalKey);
  const requestedVaultRetrievalKey = normalizeKey(args.revocation?.vaultRetrievalKey);
  const serverReceiptFingerprint = normalizeKey(args.revocation?.serverReceiptFingerprint);
  const refundFingerprint = normalizeKey(args.revocation?.refundFingerprint);
  const disputeFingerprint = normalizeKey(args.revocation?.disputeFingerprint);
  const chargebackFingerprint = normalizeKey(args.revocation?.chargebackFingerprint);
  const replacementEntitlementFingerprint = normalizeKey(args.revocation?.replacementEntitlementFingerprint);
  const operatorReviewFingerprint = normalizeKey(args.revocation?.operatorReviewFingerprint);
  const expiredByTime = isExpired(args.revocation?.expiresAt);
  const receiptReady = Boolean(serverReceiptFingerprint);
  const state = resolveState({
    pass2493: args.pass2493,
    status,
    requestedVaultRetrievalKey,
    linkedVaultRetrievalKey,
    receiptReady,
    expiredByTime,
    refundFingerprint,
    disputeFingerprint,
    chargebackFingerprint,
    operatorReviewFingerprint,
  });
  const accessMode = accessModeFor(state, args.pass2493);
  const activeVaultAccessAllowed = state === "active_access_allowed";
  const finalPaidVerdictAccessAllowed = accessMode === "active_paid_vault_access";
  const missingProofMapAccessAllowed = accessMode === "active_missing_proof_map_access";
  const refundedOrChargebacked = state === "refunded_or_chargebacked";
  const disputeReviewRequired = state === "revocation_watch";
  const expiredOrSuperseded = state === "expired_or_superseded";
  const accountVaultRetrievalStillRequired = state === "vault_replay_required" || state === "blocked";
  const revocationLedgerActive = Boolean(args.pass2493 && linkedVaultRetrievalKey && requestedVaultRetrievalKey && serverReceiptFingerprint);
  const revocationClear = activeVaultAccessAllowed;
  const entitlementId = bounded(args.revocation?.entitlementId, 160, "");
  const revocationLedgerKey = `PASS2494-${hash({
    query: args.query,
    symbol: normalizeSymbol(args.symbol || args.pass2493?.symbol),
    entitlementId,
    linkedVaultRetrievalKey,
    requestedVaultRetrievalKey,
    serverReceiptFingerprint,
    status,
    refundFingerprint,
    disputeFingerprint,
    chargebackFingerprint,
    replacementEntitlementFingerprint,
    state,
    accessMode,
  })}`;
  const blockers = unique([
    !args.pass2493 && "PASS2493 account vault retrieval contract missing",
    args.pass2493 && !args.pass2493.accountVaultRetrievalAllowed && "PASS2493 account vault retrieval not allowed yet",
    !linkedVaultRetrievalKey && "PASS2493 vaultRetrievalKey missing",
    !requestedVaultRetrievalKey && "request vaultRetrievalKey missing",
    linkedVaultRetrievalKey && requestedVaultRetrievalKey && linkedVaultRetrievalKey !== requestedVaultRetrievalKey && "request vaultRetrievalKey does not match PASS2493",
    !serverReceiptFingerprint && "server receipt fingerprint missing for revocation replay",
    status === "unknown" && "revocation status unknown; default to review-only",
    (status === "refunded" || refundFingerprint) && "refund ledger is present; hide paid artifact access",
    (status === "chargeback" || chargebackFingerprint) && "chargeback ledger is present; hide paid artifact access",
    status === "revoked" && "entitlement explicitly revoked",
    (status === "expired" || expiredByTime) && "entitlement expired",
    (status === "superseded" || replacementEntitlementFingerprint) && "entitlement superseded by a newer fingerprint",
    (status === "disputed" || disputeFingerprint) && "payment dispute requires operator review before account vault access",
    state !== "active_access_allowed" && "Advanced paid artifact retrieval remains hidden or review-only",
  ]).slice(0, 18);
  const fingerprint = hash({
    version: PASS2494_ENTITLEMENT_REVOCATION_CHARGEBACK_LOCK_ID,
    revocationLedgerKey,
    linkedVaultRetrievalKey,
    serverReceiptFingerprint,
    status,
    state,
    accessMode,
    blockers: blockers.slice(0, 8),
  });

  return {
    version: PASS2494_ENTITLEMENT_REVOCATION_CHARGEBACK_LOCK_ID,
    state,
    accessMode,
    query: bounded(args.query, 140, undefined as unknown as string),
    symbol: normalizeSymbol(args.symbol || args.pass2493?.symbol) || undefined,
    entitlementId: entitlementId || undefined,
    revocationStatus: status,
    revocationLedgerActive,
    revocationClear,
    activeVaultAccessAllowed,
    finalPaidVerdictAccessAllowed,
    missingProofMapAccessAllowed,
    refundedOrChargebacked,
    disputeReviewRequired,
    expiredOrSuperseded,
    accountVaultRetrievalStillRequired,
    serverReceiptStillRequired: true,
    walletOnlyStillDenied: true,
    localStorageUnlockStillDenied: true,
    publicCacheStillDenied: true,
    linkedPass2493VaultRetrievalKey: linkedVaultRetrievalKey || undefined,
    requestedVaultRetrievalKey: requestedVaultRetrievalKey || undefined,
    revocationLedgerKey,
    refundFingerprint: refundFingerprint || undefined,
    disputeFingerprint: disputeFingerprint || undefined,
    chargebackFingerprint: chargebackFingerprint || undefined,
    replacementEntitlementFingerprint: replacementEntitlementFingerprint || undefined,
    operatorReviewFingerprint: operatorReviewFingerprint || undefined,
    customerMessage: activeVaultAccessAllowed
      ? "PASS2494 revocation ledger is clear. Account-vault Advanced access may remain visible with receipt and vault proof shown."
      : refundedOrChargebacked
        ? "PASS2494 hides paid Advanced access because refund, chargeback or revocation proof is present."
        : `PASS2494 keeps Advanced access review-only: ${blockers.join("; ") || "revocation ledger not clear"}`,
    operatorMessage: activeVaultAccessAllowed
      ? "Keep revocationLedgerKey visible in account vault, PDF download footer, VLM Brain and Angel."
      : "Do not show paid Advanced artifact bytes or paid-verdict copy until PASS2494 clears the revocation/chargeback ledger.",
    blockers,
    revocationRequirements: [
      "PASS2493 accountVaultRetrievalAllowed=true",
      "request vaultRetrievalKey must match PASS2493 vaultRetrievalKey",
      "server receipt fingerprint must be replayed",
      "revocationStatus must be active",
      "refund/chargeback/dispute/revoked/expired/superseded fingerprints must be absent or operator-reviewed",
      "account console, PDF download, Brain and Angel must show the same revocationLedgerKey",
    ],
    surfaceRevocationBindings: buildSurfaceBindings({ accessAllowed: activeVaultAccessAllowed, revocationLedgerKey, status, accessMode }),
    forbiddenAccessStates: [
      "wallet connect cannot bypass revocation ledger",
      "checkout success cannot bypass chargeback/refund status",
      "localStorage cannot preserve revoked Advanced access",
      "public cached PDF URL cannot remain accessible after revocation",
      "account message card must hide paid report when PASS2494 is not active_access_allowed",
    ],
    redactionBoundary: "PASS2494 stores only entitlement identifiers, receipt/vault fingerprints, revocation/chargeback/refund/dispute fingerprints, expiry timestamps and replacement entitlement fingerprints. It must not store raw card numbers, seed phrases, private keys, raw PDF bytes or full payment provider payloads.",
    nextImplementationActions: activeVaultAccessAllowed
      ? ["Persist PASS2494 revocationLedgerKey with account delivery", "Show active revocation state in account console", "Keep paid Advanced access hidden if any future refund/chargeback event appears"]
      : ["Attach server revocation ledger adapter", "Replay refund/chargeback/dispute webhooks into PASS2494", "Hide account-vault artifact and PDF download until revocationClear=true"],
    fingerprint,
    generatedAt: new Date().toISOString(),
  };
}
