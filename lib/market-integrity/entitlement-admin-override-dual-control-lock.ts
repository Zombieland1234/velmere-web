import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { createHash } from "node:crypto";
import type { Pass2494EntitlementRevocationChargebackLock } from "./entitlement-revocation-chargeback-lock";

export const PASS2495_ENTITLEMENT_ADMIN_OVERRIDE_DUAL_CONTROL_LOCK_ID = "entitlement-admin-override-dual-control-lock-v1" as const;

export type Pass2495AdminOverrideState =
  | "no_override_needed"
  | "dual_control_ready"
  | "dual_control_required"
  | "revocation_override_blocked"
  | "vault_replay_required"
  | "blocked";

export type Pass2495AdminOverrideMode =
  | "normal_pass2494_access"
  | "dual_control_paid_access"
  | "dual_control_missing_proof_review"
  | "override_denied"
  | "blocked";

export type Pass2495OverrideReasonCode =
  | "none"
  | "manual_regrant"
  | "support_correction"
  | "payment_provider_delay"
  | "operator_test"
  | "compliance_hold"
  | "unknown";

export type Pass2495AdminSurface =
  | "admin_console"
  | "account_console"
  | "account_message_card"
  | "checkout_success"
  | "pdf_download"
  | "browser_preview"
  | "vlm_brain"
  | "angel";

export type Pass2495AdminOverrideInput = {
  overrideRequestId?: string;
  supportCaseId?: string;
  revocationLedgerKey?: string;
  requestedAccessMode?: string;
  reasonCode?: string;
  primaryOperatorFingerprint?: string;
  secondaryOperatorFingerprint?: string;
  approvalPolicyFingerprint?: string;
  customerNoticeFingerprint?: string;
  expiresAt?: string;
  requestSurface?: string;
  locale?: string;
};

export type Pass2495AdminSurfaceBinding = {
  surface: Pass2495AdminSurface;
  mustCheckAdminOverrideLedger: true;
  mustDenyLocalOverride: true;
  mustShowOverrideState: boolean;
  paidCopyAllowed: boolean;
  overrideCopyAllowed: boolean;
  requiredVisibleCopy: string;
};

export type Pass2495EntitlementAdminOverrideDualControlLock = {
  version: typeof PASS2495_ENTITLEMENT_ADMIN_OVERRIDE_DUAL_CONTROL_LOCK_ID;
  state: Pass2495AdminOverrideState;
  overrideMode: Pass2495AdminOverrideMode;
  query?: string;
  symbol?: string;
  overrideRequestId?: string;
  supportCaseId?: string;
  reasonCode: Pass2495OverrideReasonCode;
  pass2494RevocationLedgerKey?: string;
  requestedRevocationLedgerKey?: string;
  revocationLedgerMatch: boolean;
  dualControlActive: boolean;
  twoDistinctOperatorsPresent: boolean;
  approvalPolicyPresent: boolean;
  customerNoticePresent: boolean;
  overrideExpiryActive: boolean;
  finalPaidAdminOverrideAllowed: boolean;
  missingProofAdminReviewAllowed: boolean;
  manualRegrantAllowed: boolean;
  localAdminToggleDenied: true;
  clientSideRoleToggleDenied: true;
  walletOnlyOverrideDenied: true;
  publicCacheOverrideDenied: true;
  revokedEntitlementCannotBeRestoredByAdmin: boolean;
  linkedPass2494State?: string;
  linkedPass2494AccessMode?: string;
  blockers: string[];
  adminOverrideRequirements: string[];
  forbiddenOverrideStates: string[];
  surfaceAdminBindings: Pass2495AdminSurfaceBinding[];
  customerMessage: string;
  operatorMessage: string;
  redactionBoundary: string;
  nextImplementationActions: string[];
  adminOverrideLedgerKey: string;
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

function normalizeSymbol(value?: string) {
  return bounded(value, 40).toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function normalizeReason(value?: string): Pass2495OverrideReasonCode {
  const clean = bounded(value, 64, "none").toLowerCase().replace(/[^a-z_-]/g, "");
  if (!clean || clean === "none") return "none";
  if (clean === "manual_regrant" || clean === "regrant") return "manual_regrant";
  if (clean === "support_correction" || clean === "support") return "support_correction";
  if (clean === "payment_provider_delay" || clean === "provider_delay") return "payment_provider_delay";
  if (clean === "operator_test" || clean === "test") return "operator_test";
  if (clean === "compliance_hold" || clean === "compliance") return "compliance_hold";
  return "unknown";
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
  pass2494?: Pass2494EntitlementRevocationChargebackLock | null;
  overrideRequested: boolean;
  reasonCode: Pass2495OverrideReasonCode;
  ledgerMatch: boolean;
  twoDistinctOperatorsPresent: boolean;
  approvalPolicyPresent: boolean;
  customerNoticePresent: boolean;
  overrideExpiryActive: boolean;
}): Pass2495AdminOverrideState {
  if (!args.pass2494 || args.pass2494.state === "blocked") return "blocked";
  if (!args.pass2494.revocationLedgerKey || !args.pass2494.revocationLedgerActive) return "vault_replay_required";
  if (!args.overrideRequested) return args.pass2494.activeVaultAccessAllowed ? "no_override_needed" : "dual_control_required";
  if (args.pass2494.refundedOrChargebacked || args.pass2494.expiredOrSuperseded || !args.pass2494.revocationClear) return "revocation_override_blocked";
  if (!args.ledgerMatch || !args.twoDistinctOperatorsPresent || !args.approvalPolicyPresent || !args.customerNoticePresent || !args.overrideExpiryActive) return "dual_control_required";
  if (args.reasonCode === "operator_test" || args.reasonCode === "manual_regrant" || args.reasonCode === "support_correction" || args.reasonCode === "payment_provider_delay") return "dual_control_ready";
  return "dual_control_required";
}

function modeFor(state: Pass2495AdminOverrideState, pass2494?: Pass2494EntitlementRevocationChargebackLock | null): Pass2495AdminOverrideMode {
  if (state === "no_override_needed") return "normal_pass2494_access";
  if (state === "dual_control_ready" && pass2494?.finalPaidVerdictAccessAllowed) return "dual_control_paid_access";
  if (state === "dual_control_ready") return "dual_control_missing_proof_review";
  if (state === "dual_control_required" || state === "revocation_override_blocked" || state === "vault_replay_required") return "override_denied";
  return "blocked";
}

function buildSurfaceBindings(args: { allowed: boolean; mode: Pass2495AdminOverrideMode; ledgerKey: string; state: Pass2495AdminOverrideState }): Pass2495AdminSurfaceBinding[] {
  const surfaces: Pass2495AdminSurface[] = ["admin_console", "account_console", "account_message_card", "checkout_success", "pdf_download", "browser_preview", "vlm_brain", "angel"];
  const baseCopy = args.allowed
    ? `PASS2495 admin override is either not needed or dual-control approved (${args.mode}).`
    : `PASS2495 denies manual admin override until dual-control ledger and PASS2494 revocation replay are clear (${args.state}).`;
  return surfaces.map((surface) => ({
    surface,
    mustCheckAdminOverrideLedger: true,
    mustDenyLocalOverride: true,
    mustShowOverrideState: surface === "admin_console" || surface === "account_console" || surface === "account_message_card" || surface === "angel",
    paidCopyAllowed: args.allowed && args.mode !== "dual_control_missing_proof_review",
    overrideCopyAllowed: args.allowed,
    requiredVisibleCopy: `${baseCopy} adminOverrideLedgerKey=${args.ledgerKey} surface=${surface}`,
  }));
}

export function buildPass2495EntitlementAdminOverrideDualControlLock(args: {
  query?: string;
  symbol?: string;
  pass2494?: Pass2494EntitlementRevocationChargebackLock | null;
  adminOverride?: Pass2495AdminOverrideInput | null;
}): Pass2495EntitlementAdminOverrideDualControlLock {
  const requestedRevocationLedgerKey = normalizeKey(args.adminOverride?.revocationLedgerKey);
  const pass2494RevocationLedgerKey = normalizeKey(args.pass2494?.revocationLedgerKey);
  const primaryOperatorFingerprint = normalizeKey(args.adminOverride?.primaryOperatorFingerprint);
  const secondaryOperatorFingerprint = normalizeKey(args.adminOverride?.secondaryOperatorFingerprint);
  const approvalPolicyFingerprint = normalizeKey(args.adminOverride?.approvalPolicyFingerprint);
  const customerNoticeFingerprint = normalizeKey(args.adminOverride?.customerNoticeFingerprint);
  const overrideRequestId = normalizeKey(args.adminOverride?.overrideRequestId);
  const supportCaseId = normalizeKey(args.adminOverride?.supportCaseId);
  const reasonCode = normalizeReason(args.adminOverride?.reasonCode);
  const overrideRequested = Boolean(overrideRequestId || supportCaseId || reasonCode !== "none" || primaryOperatorFingerprint || secondaryOperatorFingerprint);
  const twoDistinctOperatorsPresent = Boolean(primaryOperatorFingerprint && secondaryOperatorFingerprint && primaryOperatorFingerprint !== secondaryOperatorFingerprint);
  const approvalPolicyPresent = Boolean(approvalPolicyFingerprint);
  const customerNoticePresent = Boolean(customerNoticeFingerprint);
  const overrideExpiryActive = overrideRequested ? isFuture(args.adminOverride?.expiresAt) : true;
  const revocationLedgerMatch = Boolean(pass2494RevocationLedgerKey && requestedRevocationLedgerKey && pass2494RevocationLedgerKey === requestedRevocationLedgerKey);
  const state = resolveState({
    pass2494: args.pass2494,
    overrideRequested,
    reasonCode,
    ledgerMatch: revocationLedgerMatch,
    twoDistinctOperatorsPresent,
    approvalPolicyPresent,
    customerNoticePresent,
    overrideExpiryActive,
  });
  const overrideMode = modeFor(state, args.pass2494);
  const dualControlActive = state === "dual_control_ready";
  const finalPaidAdminOverrideAllowed = (state === "no_override_needed" && Boolean(args.pass2494?.finalPaidVerdictAccessAllowed)) || overrideMode === "dual_control_paid_access";
  const missingProofAdminReviewAllowed = overrideMode === "dual_control_missing_proof_review" || (state === "no_override_needed" && Boolean(args.pass2494?.missingProofMapAccessAllowed));
  const manualRegrantAllowed = dualControlActive && Boolean(args.pass2494?.revocationClear) && !args.pass2494?.refundedOrChargebacked && !args.pass2494?.expiredOrSuperseded;
  const revokedEntitlementCannotBeRestoredByAdmin = Boolean(args.pass2494?.refundedOrChargebacked || args.pass2494?.expiredOrSuperseded || args.pass2494?.revocationClear === false);
  const blockers = unique([
    !args.pass2494 && "PASS2494 revocation / chargeback lock must run before admin override evaluation",
    args.pass2494 && !args.pass2494.revocationLedgerActive && "PASS2494 revocation ledger replay is missing",
    overrideRequested && !revocationLedgerMatch && "admin override must reference the exact PASS2494 revocationLedgerKey",
    overrideRequested && !twoDistinctOperatorsPresent && "two distinct operator approvals are required",
    overrideRequested && !approvalPolicyPresent && "approval policy fingerprint is required",
    overrideRequested && !customerNoticePresent && "customer notice fingerprint is required before account access copy changes",
    overrideRequested && !overrideExpiryActive && "admin override expiry must be present and in the future",
    revokedEntitlementCannotBeRestoredByAdmin && "refund/chargeback/revoked/expired/superseded entitlement cannot be restored by admin toggle",
  ]);
  const adminOverrideLedgerKey = `PASS2495-${hash({
    query: args.query,
    symbol: args.symbol,
    pass2494RevocationLedgerKey,
    overrideRequestId,
    supportCaseId,
    reasonCode,
    primaryOperatorFingerprint,
    secondaryOperatorFingerprint,
    approvalPolicyFingerprint,
    customerNoticeFingerprint,
    state,
  })}`;
  const surfaceAdminBindings = buildSurfaceBindings({ allowed: finalPaidAdminOverrideAllowed || missingProofAdminReviewAllowed, mode: overrideMode, ledgerKey: adminOverrideLedgerKey, state });
  const payload = {
    version: PASS2495_ENTITLEMENT_ADMIN_OVERRIDE_DUAL_CONTROL_LOCK_ID,
    state,
    overrideMode,
    query: bounded(args.query, 120) || undefined,
    symbol: normalizeSymbol(args.symbol),
    overrideRequestId: overrideRequestId || undefined,
    supportCaseId: supportCaseId || undefined,
    reasonCode,
    pass2494RevocationLedgerKey: pass2494RevocationLedgerKey || undefined,
    requestedRevocationLedgerKey: requestedRevocationLedgerKey || undefined,
    revocationLedgerMatch,
    dualControlActive,
    twoDistinctOperatorsPresent,
    approvalPolicyPresent,
    customerNoticePresent,
    overrideExpiryActive,
    finalPaidAdminOverrideAllowed,
    missingProofAdminReviewAllowed,
    manualRegrantAllowed,
    localAdminToggleDenied: true,
    clientSideRoleToggleDenied: true,
    walletOnlyOverrideDenied: true,
    publicCacheOverrideDenied: true,
    revokedEntitlementCannotBeRestoredByAdmin,
    linkedPass2494State: args.pass2494?.state,
    linkedPass2494AccessMode: args.pass2494?.accessMode,
    blockers,
    adminOverrideRequirements: [
      "Replay PASS2494 revocationLedgerKey before any manual account access mutation.",
      "Require two distinct operator fingerprints for manual regrant/support correction/payment-provider-delay flows.",
      "Require approvalPolicyFingerprint, customerNoticeFingerprint and a future expiresAt for any override.",
      "Deny localStorage, client role toggles, wallet-only and public cache paths.",
      "Never restore refunded, chargebacked, revoked, expired or superseded paid artifacts through admin console only.",
    ],
    forbiddenOverrideStates: [
      "admin_role=true without server-side override ledger",
      "single operator approval",
      "same operator approving twice",
      "wallet connect as support override",
      "checkout success as regrant after chargeback",
      "public cached PDF URL after revocation",
    ],
    surfaceAdminBindings,
    customerMessage: finalPaidAdminOverrideAllowed
      ? "Advanced account access is active after PASS2494 and PASS2495 server-side checks."
      : missingProofAdminReviewAllowed
        ? "Advanced is available only as a reviewed missing-proof map; final paid verdict copy is still locked."
        : "Advanced account access cannot be changed manually until the admin dual-control ledger and revocation replay are clear.",
    operatorMessage: blockers.length
      ? `PASS2495 blocked/manual review: ${blockers.slice(0, 4).join(" | ")}`
      : `PASS2495 ${state}: overrideMode=${overrideMode}; manual regrant remains server-only and dual-control-bound.`,
    redactionBoundary: "Support/admin screens may show ledger keys and state, but must not expose raw card, wallet, email, payment provider secrets, PDF URLs or private account identifiers.",
    nextImplementationActions: [
      "Bind admin console regrant buttons to PASS2495.adminOverrideLedgerKey rather than role/localStorage state.",
      "Add immutable support-case audit entries for primary/secondary operator approvals.",
      "Require customer notice before any entitlement state restoration is visible in account console.",
      "Add regression fixtures for refund, dispute, expired and single-operator override attempts.",
    ],
    adminOverrideLedgerKey,
    fingerprint: "",
    generatedAt: new Date().toISOString(),
  } satisfies Omit<Pass2495EntitlementAdminOverrideDualControlLock, "fingerprint"> & { fingerprint: string };
  payload.fingerprint = `PASS2495-${hash(payload)}`;
  return payload;
}
