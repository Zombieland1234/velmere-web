import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { createHash } from "node:crypto";
import type { Pass2495EntitlementAdminOverrideDualControlLock } from "./entitlement-admin-override-dual-control-lock";

export const PASS2496_ENTITLEMENT_SESSION_DEVICE_ANOMALY_LOCK_ID = "entitlement-session-device-anomaly-lock-v1" as const;

export type Pass2496SessionState =
  | "session_bound_access"
  | "session_replay_required"
  | "step_up_required"
  | "admin_override_review_required"
  | "revocation_blocked"
  | "blocked";

export type Pass2496SessionAccessMode =
  | "paid_access_session_bound"
  | "missing_proof_session_review"
  | "step_up_only"
  | "access_denied"
  | "blocked";

export type Pass2496SessionSurface =
  | "account_console"
  | "account_message_card"
  | "checkout_success"
  | "pdf_download"
  | "browser_preview"
  | "vlm_brain"
  | "angel"
  | "admin_console";

export type Pass2496SessionRiskLevel = "low" | "medium" | "high" | "unknown";

export type Pass2496SessionInput = {
  accountSessionFingerprint?: string;
  vaultReadTokenFingerprint?: string;
  adminOverrideLedgerKey?: string;
  deviceBindingFingerprint?: string;
  csrfNonceFingerprint?: string;
  ipRiskFingerprint?: string;
  userAgentHash?: string;
  mfaChallengeFingerprint?: string;
  signedAt?: string;
  expiresAt?: string;
  sessionRiskLevel?: string;
  requestSurface?: string;
  locale?: string;
};

export type Pass2496SessionSurfaceBinding = {
  surface: Pass2496SessionSurface;
  mustReplaySessionFingerprint: true;
  mustReplayVaultToken: true;
  mustDenyCopiedSession: true;
  mustShowSessionState: boolean;
  paidCopyAllowed: boolean;
  vaultReadAllowed: boolean;
  requiredVisibleCopy: string;
};

export type Pass2496EntitlementSessionDeviceAnomalyLock = {
  version: typeof PASS2496_ENTITLEMENT_SESSION_DEVICE_ANOMALY_LOCK_ID;
  state: Pass2496SessionState;
  accessMode: Pass2496SessionAccessMode;
  query?: string;
  symbol?: string;
  accountSessionFingerprint?: string;
  vaultReadTokenFingerprint?: string;
  pass2495AdminOverrideLedgerKey?: string;
  requestedAdminOverrideLedgerKey?: string;
  adminOverrideLedgerMatch: boolean;
  sessionFingerprintPresent: boolean;
  vaultReadTokenPresent: boolean;
  deviceBindingPresent: boolean;
  csrfNoncePresent: boolean;
  mfaChallengePresent: boolean;
  sessionExpiryActive: boolean;
  sessionRiskLevel: Pass2496SessionRiskLevel;
  copiedSessionDenied: true;
  stolenVaultTokenDenied: true;
  publicCacheSessionDenied: true;
  walletOnlySessionDenied: true;
  finalPaidSessionAccessAllowed: boolean;
  missingProofSessionReviewAllowed: boolean;
  stepUpRequired: boolean;
  linkedPass2495State?: string;
  linkedPass2495OverrideMode?: string;
  blockers: string[];
  sessionRequirements: string[];
  forbiddenSessionUnlocks: string[];
  surfaceSessionBindings: Pass2496SessionSurfaceBinding[];
  customerMessage: string;
  operatorMessage: string;
  redactionBoundary: string;
  nextImplementationActions: string[];
  sessionLedgerKey: string;
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
  return bounded(value, 240, "").toUpperCase().replace(/[^A-Z0-9:_-]/g, "").slice(0, 240);
}

function normalizeRisk(value?: string): Pass2496SessionRiskLevel {
  const clean = bounded(value, 40, "unknown").toLowerCase().replace(/[^a-z_-]/g, "");
  if (clean === "low" || clean === "medium" || clean === "high") return clean;
  return "unknown";
}

function normalizeSymbol(value?: string) {
  return bounded(value, 40).toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function isFuture(value?: string) {
  const text = bounded(value, 80, "");
  if (!text) return false;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && parsed > Date.now();
}

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function resolveState(args: {
  pass2495?: Pass2495EntitlementAdminOverrideDualControlLock | null;
  adminOverrideLedgerMatch: boolean;
  sessionFingerprintPresent: boolean;
  vaultReadTokenPresent: boolean;
  deviceBindingPresent: boolean;
  csrfNoncePresent: boolean;
  mfaChallengePresent: boolean;
  sessionExpiryActive: boolean;
  sessionRiskLevel: Pass2496SessionRiskLevel;
}): Pass2496SessionState {
  if (!args.pass2495 || args.pass2495.state === "blocked") return "blocked";
  if (!args.pass2495.finalPaidAdminOverrideAllowed) return args.pass2495.overrideMode === "override_denied" ? "revocation_blocked" : "admin_override_review_required";
  if (!args.adminOverrideLedgerMatch || !args.sessionFingerprintPresent || !args.vaultReadTokenPresent || !args.sessionExpiryActive) return "session_replay_required";
  if (args.sessionRiskLevel === "high") return "step_up_required";
  if (!args.deviceBindingPresent || !args.csrfNoncePresent || (args.sessionRiskLevel === "medium" && !args.mfaChallengePresent)) return "step_up_required";
  return "session_bound_access";
}

function modeFor(state: Pass2496SessionState): Pass2496SessionAccessMode {
  if (state === "session_bound_access") return "paid_access_session_bound";
  if (state === "admin_override_review_required") return "missing_proof_session_review";
  if (state === "step_up_required") return "step_up_only";
  if (state === "session_replay_required" || state === "revocation_blocked") return "access_denied";
  return "blocked";
}

function buildSurfaceBindings(args: { allowed: boolean; state: Pass2496SessionState; ledgerKey: string }): Pass2496SessionSurfaceBinding[] {
  const surfaces: Pass2496SessionSurface[] = ["account_console", "account_message_card", "checkout_success", "pdf_download", "browser_preview", "vlm_brain", "angel", "admin_console"];
  const baseCopy = args.allowed
    ? "PASS2496 session/device replay is bound to the paid Advanced entitlement."
    : `PASS2496 denies copied-session or copied-vault-token access until session/device replay is clear (${args.state}).`;
  return surfaces.map((surface) => ({
    surface,
    mustReplaySessionFingerprint: true,
    mustReplayVaultToken: true,
    mustDenyCopiedSession: true,
    mustShowSessionState: surface === "account_console" || surface === "account_message_card" || surface === "angel" || surface === "admin_console",
    paidCopyAllowed: args.allowed,
    vaultReadAllowed: args.allowed,
    requiredVisibleCopy: `${baseCopy} sessionLedgerKey=${args.ledgerKey} surface=${surface}`,
  }));
}

export function buildPass2496EntitlementSessionDeviceAnomalyLock(args: {
  query?: string;
  symbol?: string;
  pass2495?: Pass2495EntitlementAdminOverrideDualControlLock | null;
  session?: Pass2496SessionInput | null;
}): Pass2496EntitlementSessionDeviceAnomalyLock {
  const accountSessionFingerprint = normalizeKey(args.session?.accountSessionFingerprint);
  const vaultReadTokenFingerprint = normalizeKey(args.session?.vaultReadTokenFingerprint);
  const requestedAdminOverrideLedgerKey = normalizeKey(args.session?.adminOverrideLedgerKey);
  const pass2495AdminOverrideLedgerKey = normalizeKey(args.pass2495?.adminOverrideLedgerKey);
  const deviceBindingFingerprint = normalizeKey(args.session?.deviceBindingFingerprint);
  const csrfNonceFingerprint = normalizeKey(args.session?.csrfNonceFingerprint);
  const mfaChallengeFingerprint = normalizeKey(args.session?.mfaChallengeFingerprint);
  const ipRiskFingerprint = normalizeKey(args.session?.ipRiskFingerprint);
  const userAgentHash = normalizeKey(args.session?.userAgentHash);
  const sessionRiskLevel = normalizeRisk(args.session?.sessionRiskLevel);
  const adminOverrideLedgerMatch = Boolean(pass2495AdminOverrideLedgerKey && requestedAdminOverrideLedgerKey && pass2495AdminOverrideLedgerKey === requestedAdminOverrideLedgerKey);
  const sessionFingerprintPresent = Boolean(accountSessionFingerprint);
  const vaultReadTokenPresent = Boolean(vaultReadTokenFingerprint);
  const deviceBindingPresent = Boolean(deviceBindingFingerprint && userAgentHash);
  const csrfNoncePresent = Boolean(csrfNonceFingerprint);
  const mfaChallengePresent = Boolean(mfaChallengeFingerprint);
  const sessionExpiryActive = isFuture(args.session?.expiresAt);
  const state = resolveState({
    pass2495: args.pass2495,
    adminOverrideLedgerMatch,
    sessionFingerprintPresent,
    vaultReadTokenPresent,
    deviceBindingPresent,
    csrfNoncePresent,
    mfaChallengePresent,
    sessionExpiryActive,
    sessionRiskLevel,
  });
  const accessMode = modeFor(state);
  const stepUpRequired = state === "step_up_required";
  const finalPaidSessionAccessAllowed = state === "session_bound_access";
  const missingProofSessionReviewAllowed = state === "admin_override_review_required" || state === "step_up_required";
  const blockers = unique([
    !args.pass2495 && "PASS2495 admin override lock missing",
    args.pass2495 && !args.pass2495.finalPaidAdminOverrideAllowed && "PASS2495 finalPaidAdminOverrideAllowed=false",
    !pass2495AdminOverrideLedgerKey && "PASS2495 adminOverrideLedgerKey missing",
    !requestedAdminOverrideLedgerKey && "requested adminOverrideLedgerKey missing",
    requestedAdminOverrideLedgerKey && !adminOverrideLedgerMatch && "requested adminOverrideLedgerKey does not match PASS2495",
    !sessionFingerprintPresent && "account session fingerprint missing",
    !vaultReadTokenPresent && "vault read token fingerprint missing",
    !deviceBindingPresent && "device binding + user-agent hash missing",
    !csrfNoncePresent && "CSRF nonce fingerprint missing",
    !sessionExpiryActive && "session expiry is missing or expired",
    sessionRiskLevel === "high" && "high session risk requires denial / support review",
    sessionRiskLevel === "medium" && !mfaChallengePresent && "medium session risk requires MFA challenge fingerprint",
  ]).slice(0, 12);
  const sessionLedgerKey = `PASS2496-${hash({
    version: PASS2496_ENTITLEMENT_SESSION_DEVICE_ANOMALY_LOCK_ID,
    query: bounded(args.query, 120),
    symbol: normalizeSymbol(args.symbol),
    pass2495AdminOverrideLedgerKey,
    accountSessionFingerprint,
    vaultReadTokenFingerprint,
    deviceBindingFingerprint,
    csrfNonceFingerprint,
    ipRiskFingerprint,
    userAgentHash,
    sessionRiskLevel,
  })}`;
  const surfaceSessionBindings = buildSurfaceBindings({ allowed: finalPaidSessionAccessAllowed, state, ledgerKey: sessionLedgerKey });
  const customerMessage = finalPaidSessionAccessAllowed
    ? "Paid Advanced access is bound to this account session, device and vault read token."
    : stepUpRequired
      ? "Extra verification is required before this paid Advanced vault artifact can be opened."
      : "Paid Advanced vault access is blocked until the session/device replay matches the entitlement ledger.";
  const operatorMessage = finalPaidSessionAccessAllowed
    ? "PASS2496 clear: account session, vault read token, device binding, CSRF nonce and expiry replay match PASS2495."
    : `PASS2496 blocked/review: ${blockers.join("; ") || "session ledger replay incomplete"}.`;
  const fingerprint = `PASS2496-${hash({ state, accessMode, finalPaidSessionAccessAllowed, blockers, sessionLedgerKey })}`;
  return {
    version: PASS2496_ENTITLEMENT_SESSION_DEVICE_ANOMALY_LOCK_ID,
    state,
    accessMode,
    query: bounded(args.query, 120) || undefined,
    symbol: normalizeSymbol(args.symbol) || undefined,
    accountSessionFingerprint: accountSessionFingerprint || undefined,
    vaultReadTokenFingerprint: vaultReadTokenFingerprint || undefined,
    pass2495AdminOverrideLedgerKey: pass2495AdminOverrideLedgerKey || undefined,
    requestedAdminOverrideLedgerKey: requestedAdminOverrideLedgerKey || undefined,
    adminOverrideLedgerMatch,
    sessionFingerprintPresent,
    vaultReadTokenPresent,
    deviceBindingPresent,
    csrfNoncePresent,
    mfaChallengePresent,
    sessionExpiryActive,
    sessionRiskLevel,
    copiedSessionDenied: true,
    stolenVaultTokenDenied: true,
    publicCacheSessionDenied: true,
    walletOnlySessionDenied: true,
    finalPaidSessionAccessAllowed,
    missingProofSessionReviewAllowed,
    stepUpRequired,
    linkedPass2495State: args.pass2495?.state,
    linkedPass2495OverrideMode: args.pass2495?.overrideMode,
    blockers,
    sessionRequirements: [
      "Replay the exact PASS2495 adminOverrideLedgerKey.",
      "Bind accountSessionFingerprint + vaultReadTokenFingerprint to the server entitlement session.",
      "Require deviceBindingFingerprint + userAgentHash + CSRF nonce for Browser/PDF/account reads.",
      "Require MFA/step-up on medium risk and deny high-risk copied-session attempts.",
      "Expose PASS2496 sessionLedgerKey on account console, modal, PDF, Brain and Angel before vault-read copy.",
    ],
    forbiddenSessionUnlocks: [
      "copied session cookie",
      "stolen vault read token",
      "wallet connect as session proof",
      "checkout success redirect as session proof",
      "localStorage paid flag",
      "public cached PDF URL",
      "admin role toggle without PASS2495 and PASS2496 replay",
    ],
    surfaceSessionBindings,
    customerMessage,
    operatorMessage,
    redactionBoundary: "PASS2496 exposes fingerprints and state only; raw cookies, IP address, device identifiers, card data and full vault tokens remain server-only.",
    nextImplementationActions: [
      "Persist sessionLedgerKey in the server entitlement session store.",
      "Bind vault read tokens to one account session and rotate on logout, refund, chargeback or admin override.",
      "Add step-up challenge UX for medium-risk access and hard denial for high-risk copied-session replay.",
      "Purge public-cache access when PASS2496 is not session_bound_access.",
    ],
    sessionLedgerKey,
    fingerprint,
    generatedAt: new Date().toISOString(),
  };
}
