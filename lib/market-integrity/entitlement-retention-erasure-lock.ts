import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { createHash } from "node:crypto";
import type { Pass2498EntitlementEvidenceExportDisputeLock } from "./entitlement-evidence-export-dispute-lock";

export const PASS2499_ENTITLEMENT_RETENTION_ERASURE_LOCK_ID = "entitlement-retention-erasure-lock-v1" as const;

export type Pass2499RetentionErasureState =
  | "retention_active_allowed"
  | "retention_replay_required"
  | "erasure_due_blocked"
  | "erasure_proof_required"
  | "evidence_export_blocked"
  | "blocked";

export type Pass2499RetentionMode =
  | "redacted_retention_allowed"
  | "redacted_retention_replay_only"
  | "erase_or_redact_now"
  | "export_denied"
  | "blocked";

export type Pass2499RetentionSurface =
  | "support_console"
  | "admin_console"
  | "account_console"
  | "payment_dispute"
  | "customer_request"
  | "angel"
  | "pdf_audit_footer"
  | "erasure_worker";

export type Pass2499RetentionErasureInput = {
  evidenceExportLedgerKey?: string;
  supportCaseId?: string;
  requesterRole?: string;
  retentionPolicyFingerprint?: string;
  dataMinimizationPolicyFingerprint?: string;
  retentionScheduleId?: string;
  archiveHash?: string;
  customerNoticeId?: string;
  retentionExpiry?: string;
  erasureJobId?: string;
  erasureProofFingerprint?: string;
  legalHoldStatus?: string;
  requestSurface?: string;
  locale?: string;
};

export type Pass2499RetentionSurfaceBinding = {
  surface: Pass2499RetentionSurface;
  mustReplayPass2498EvidenceExportLedger: true;
  mustKeepOnlyRedactedEvidencePack: true;
  mustDenyIndefiniteRetention: true;
  mustScheduleErasureOrReview: true;
  paidRetentionCopyAllowed: boolean;
  requiredVisibleCopy: string;
};

export type Pass2499EntitlementRetentionErasureLock = {
  version: typeof PASS2499_ENTITLEMENT_RETENTION_ERASURE_LOCK_ID;
  state: Pass2499RetentionErasureState;
  retentionMode: Pass2499RetentionMode;
  query?: string;
  symbol?: string;
  pass2498EvidenceExportLedgerKey?: string;
  requestedEvidenceExportLedgerKey?: string;
  evidenceExportLedgerMatch: boolean;
  supportCasePresent: boolean;
  requesterRoleAllowed: boolean;
  retentionPolicyPresent: boolean;
  dataMinimizationPolicyPresent: boolean;
  retentionSchedulePresent: boolean;
  archiveHashPresent: boolean;
  customerNoticePresent: boolean;
  retentionExpiryActive: boolean;
  erasureDue: boolean;
  erasureJobPresent: boolean;
  erasureProofPresent: boolean;
  legalHoldActive: boolean;
  rawPiiRetentionDenied: true;
  rawPaymentRetentionDenied: true;
  rawWalletSignatureRetentionDenied: true;
  rawIpDeviceRetentionDenied: true;
  publicEvidenceArchiveDenied: true;
  indefiniteRawEvidenceRetentionDenied: true;
  finalPaidEvidenceRetentionAllowed: boolean;
  finalPaidEvidenceErasureRecorded: boolean;
  linkedPass2498State?: string;
  linkedPass2498ExportMode?: string;
  blockers: string[];
  retentionRequirements: string[];
  forbiddenRetentionPatterns: string[];
  surfaceRetentionBindings: Pass2499RetentionSurfaceBinding[];
  customerMessage: string;
  operatorMessage: string;
  privacyBoundary: string;
  nextImplementationActions: string[];
  retentionLedgerKey: string;
  erasureLedgerKey: string;
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
  return bounded(value, 280, "").toUpperCase().replace(/[^A-Z0-9:_-]/g, "").slice(0, 280);
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

function isPastOrMissing(value?: string) {
  const text = bounded(value, 80, "");
  if (!text) return true;
  const parsed = Date.parse(text);
  return !Number.isFinite(parsed) || parsed <= Date.now();
}

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function requesterAllowed(value?: string) {
  const role = bounded(value, 80, "").toLowerCase().replace(/[^a-z0-9:_-]/g, "");
  return role === "support" || role === "admin" || role === "billing" || role === "compliance" || role === "customer_request" || role === "erasure_worker";
}

function legalHoldActive(value?: string) {
  const status = bounded(value, 80, "").toLowerCase().replace(/[^a-z0-9:_-]/g, "");
  return status === "active" || status === "hold_active" || status === "legal_hold_active";
}

function resolveState(args: {
  pass2498?: Pass2498EntitlementEvidenceExportDisputeLock | null;
  evidenceExportLedgerMatch: boolean;
  supportCasePresent: boolean;
  requesterRoleAllowed: boolean;
  retentionPolicyPresent: boolean;
  dataMinimizationPolicyPresent: boolean;
  retentionSchedulePresent: boolean;
  archiveHashPresent: boolean;
  customerNoticePresent: boolean;
  retentionExpiryActive: boolean;
  erasureDue: boolean;
  erasureJobPresent: boolean;
  erasureProofPresent: boolean;
  legalHoldActive: boolean;
}): Pass2499RetentionErasureState {
  if (!args.pass2498 || args.pass2498.state === "blocked") return "blocked";
  if (!args.pass2498.finalPaidEvidenceExportAllowed) return "evidence_export_blocked";
  if (args.erasureDue && !args.legalHoldActive && (!args.erasureJobPresent || !args.erasureProofPresent)) return "erasure_proof_required";
  if (args.erasureDue && !args.legalHoldActive) return "erasure_due_blocked";
  if (!args.evidenceExportLedgerMatch || !args.supportCasePresent || !args.requesterRoleAllowed || !args.retentionPolicyPresent || !args.dataMinimizationPolicyPresent || !args.retentionSchedulePresent || !args.archiveHashPresent || !args.customerNoticePresent || !args.retentionExpiryActive) return "retention_replay_required";
  return "retention_active_allowed";
}

function modeFor(state: Pass2499RetentionErasureState): Pass2499RetentionMode {
  if (state === "retention_active_allowed") return "redacted_retention_allowed";
  if (state === "retention_replay_required") return "redacted_retention_replay_only";
  if (state === "erasure_due_blocked" || state === "erasure_proof_required") return "erase_or_redact_now";
  if (state === "evidence_export_blocked") return "export_denied";
  return "blocked";
}

function buildSurfaceBindings(args: { allowed: boolean; state: Pass2499RetentionErasureState; ledgerKey: string }): Pass2499RetentionSurfaceBinding[] {
  const surfaces: Pass2499RetentionSurface[] = ["support_console", "admin_console", "account_console", "payment_dispute", "customer_request", "angel", "pdf_audit_footer", "erasure_worker"];
  const baseCopy = args.allowed
    ? "PASS2499 allows only a redacted evidence pack retained under a bounded schedule tied to PASS2498 evidenceExportLedgerKey."
    : `PASS2499 blocks retained paid evidence copy until bounded retention/erasure replay is clear (${args.state}).`;
  return surfaces.map((surface) => ({
    surface,
    mustReplayPass2498EvidenceExportLedger: true,
    mustKeepOnlyRedactedEvidencePack: true,
    mustDenyIndefiniteRetention: true,
    mustScheduleErasureOrReview: true,
    paidRetentionCopyAllowed: args.allowed,
    requiredVisibleCopy: `${baseCopy} retentionLedgerKey=${args.ledgerKey} surface=${surface}`,
  }));
}

export function buildPass2499EntitlementRetentionErasureLock(args: {
  query?: string;
  symbol?: string;
  pass2498?: Pass2498EntitlementEvidenceExportDisputeLock | null;
  retentionRequest?: Pass2499RetentionErasureInput | null;
}): Pass2499EntitlementRetentionErasureLock {
  const requestedEvidenceExportLedgerKey = normalizeKey(args.retentionRequest?.evidenceExportLedgerKey);
  const pass2498EvidenceExportLedgerKey = normalizeKey(args.pass2498?.evidenceExportLedgerKey);
  const supportCaseId = normalizeKey(args.retentionRequest?.supportCaseId);
  const retentionPolicyFingerprint = normalizeKey(args.retentionRequest?.retentionPolicyFingerprint);
  const dataMinimizationPolicyFingerprint = normalizeKey(args.retentionRequest?.dataMinimizationPolicyFingerprint);
  const retentionScheduleId = normalizeKey(args.retentionRequest?.retentionScheduleId);
  const archiveHash = normalizeKey(args.retentionRequest?.archiveHash);
  const customerNoticeId = normalizeKey(args.retentionRequest?.customerNoticeId);
  const erasureJobId = normalizeKey(args.retentionRequest?.erasureJobId);
  const erasureProofFingerprint = normalizeKey(args.retentionRequest?.erasureProofFingerprint);
  const evidenceExportLedgerMatch = Boolean(pass2498EvidenceExportLedgerKey && requestedEvidenceExportLedgerKey && pass2498EvidenceExportLedgerKey === requestedEvidenceExportLedgerKey);
  const supportCasePresent = Boolean(supportCaseId);
  const requesterRoleAllowed = requesterAllowed(args.retentionRequest?.requesterRole);
  const retentionPolicyPresent = Boolean(retentionPolicyFingerprint);
  const dataMinimizationPolicyPresent = Boolean(dataMinimizationPolicyFingerprint);
  const retentionSchedulePresent = Boolean(retentionScheduleId);
  const archiveHashPresent = Boolean(archiveHash);
  const customerNoticePresent = Boolean(customerNoticeId);
  const retentionExpiryActive = isFuture(args.retentionRequest?.retentionExpiry);
  const erasureDue = isPastOrMissing(args.retentionRequest?.retentionExpiry);
  const erasureJobPresent = Boolean(erasureJobId);
  const erasureProofPresent = Boolean(erasureProofFingerprint);
  const holdActive = legalHoldActive(args.retentionRequest?.legalHoldStatus);
  const state = resolveState({
    pass2498: args.pass2498,
    evidenceExportLedgerMatch,
    supportCasePresent,
    requesterRoleAllowed,
    retentionPolicyPresent,
    dataMinimizationPolicyPresent,
    retentionSchedulePresent,
    archiveHashPresent,
    customerNoticePresent,
    retentionExpiryActive,
    erasureDue,
    erasureJobPresent,
    erasureProofPresent,
    legalHoldActive: holdActive,
  });
  const retentionMode = modeFor(state);
  const finalPaidEvidenceRetentionAllowed = state === "retention_active_allowed";
  const finalPaidEvidenceErasureRecorded = state === "erasure_due_blocked" && erasureJobPresent && erasureProofPresent;
  const blockers = unique([
    !args.pass2498 && "PASS2498 evidence export/dispute lock missing",
    args.pass2498 && !args.pass2498.finalPaidEvidenceExportAllowed && "PASS2498 finalPaidEvidenceExportAllowed=false",
    !pass2498EvidenceExportLedgerKey && "PASS2498 evidenceExportLedgerKey missing",
    !requestedEvidenceExportLedgerKey && "requested evidenceExportLedgerKey missing",
    requestedEvidenceExportLedgerKey && !evidenceExportLedgerMatch && "requested evidenceExportLedgerKey does not match PASS2498",
    !supportCasePresent && "supportCaseId missing",
    !requesterRoleAllowed && "requesterRole not allowed for retention/erasure",
    !retentionPolicyPresent && "retentionPolicyFingerprint missing",
    !dataMinimizationPolicyPresent && "dataMinimizationPolicyFingerprint missing",
    !retentionSchedulePresent && "retentionScheduleId missing",
    !archiveHashPresent && "archiveHash missing",
    !customerNoticePresent && "customerNoticeId missing",
    !retentionExpiryActive && "retentionExpiry missing or expired",
    erasureDue && !holdActive && !erasureJobPresent && "erasureJobId required because retention is due/expired",
    erasureDue && !holdActive && !erasureProofPresent && "erasureProofFingerprint required because retention is due/expired",
  ]).slice(0, 17);
  const retentionLedgerKey = `PASS2499-${hash({
    version: PASS2499_ENTITLEMENT_RETENTION_ERASURE_LOCK_ID,
    query: bounded(args.query, 120),
    symbol: normalizeSymbol(args.symbol),
    pass2498EvidenceExportLedgerKey,
    requestedEvidenceExportLedgerKey,
    supportCaseId,
    retentionPolicyFingerprint,
    dataMinimizationPolicyFingerprint,
    retentionScheduleId,
    archiveHash,
    customerNoticeId,
  })}`;
  const erasureLedgerKey = `PASS2499-ERASE-${hash({ retentionLedgerKey, erasureJobId, erasureProofFingerprint, holdActive })}`;
  const surfaceRetentionBindings = buildSurfaceBindings({ allowed: finalPaidEvidenceRetentionAllowed, state, ledgerKey: retentionLedgerKey });
  const customerMessage = finalPaidEvidenceRetentionAllowed
    ? "A bounded, redacted evidence pack is retained for the scoped support/dispute request and has a visible review/expiry schedule."
    : finalPaidEvidenceErasureRecorded
      ? "The paid evidence pack is no longer available for access; erasure was recorded for the expired retention window."
      : "Paid evidence retention is blocked until PASS2499 replay confirms bounded retention, data minimization and erasure schedule.";
  const operatorMessage = finalPaidEvidenceRetentionAllowed
    ? "PASS2499 retention is active: keep only redacted evidence, enforce expiry and show the retentionLedgerKey on support/admin/account surfaces."
    : `PASS2499 ${state}: do not claim retained paid evidence access; resolve blockers before support/admin/account/Angel copy.`;

  return {
    version: PASS2499_ENTITLEMENT_RETENTION_ERASURE_LOCK_ID,
    state,
    retentionMode,
    query: bounded(args.query, 120, undefined as unknown as string),
    symbol: normalizeSymbol(args.symbol),
    pass2498EvidenceExportLedgerKey,
    requestedEvidenceExportLedgerKey,
    evidenceExportLedgerMatch,
    supportCasePresent,
    requesterRoleAllowed,
    retentionPolicyPresent,
    dataMinimizationPolicyPresent,
    retentionSchedulePresent,
    archiveHashPresent,
    customerNoticePresent,
    retentionExpiryActive,
    erasureDue,
    erasureJobPresent,
    erasureProofPresent,
    legalHoldActive: holdActive,
    rawPiiRetentionDenied: true,
    rawPaymentRetentionDenied: true,
    rawWalletSignatureRetentionDenied: true,
    rawIpDeviceRetentionDenied: true,
    publicEvidenceArchiveDenied: true,
    indefiniteRawEvidenceRetentionDenied: true,
    finalPaidEvidenceRetentionAllowed,
    finalPaidEvidenceErasureRecorded,
    linkedPass2498State: args.pass2498?.state,
    linkedPass2498ExportMode: args.pass2498?.exportMode,
    blockers,
    retentionRequirements: [
      "Replay the exact PASS2498 evidenceExportLedgerKey before any retained paid evidence copy.",
      "Retain only redacted support/dispute evidence packs; raw PII, raw payment data, wallet signatures and IP/device data remain server-only or denied.",
      "Require retentionPolicyFingerprint, dataMinimizationPolicyFingerprint, retentionScheduleId, archiveHash, customerNoticeId and active retentionExpiry.",
      "When retention expires, require erasureJobId and erasureProofFingerprint before support/admin can mark the evidence pack closed.",
    ],
    forbiddenRetentionPatterns: [
      "indefinite raw paid evidence archive",
      "public evidence ZIP/PDF URL",
      "retaining raw customer identity or payment details as support proof",
      "retaining wallet signatures or IP/device fingerprints in export packs",
      "support/admin copy that says retained evidence is available after retention expiry without erasure replay",
    ],
    surfaceRetentionBindings,
    customerMessage,
    operatorMessage,
    privacyBoundary: "PASS2499 is a data-minimization and erasure-schedule lock for Velmère entitlement evidence. It is not legal advice; it prevents product copy from overstating retained paid evidence availability.",
    nextImplementationActions: [
      "Persist retentionLedgerKey and erasureLedgerKey in the server evidence vault, not browser localStorage.",
      "Add a daily retention/erasure worker that closes expired redacted packs and writes erasureProofFingerprint.",
      "Show bounded retention state in account, support console, PDF footer and Angel before any retained-evidence copy.",
      "Block support/admin export screens from showing raw PII/payment/wallet/IP/device data or public artifact URLs.",
    ],
    retentionLedgerKey,
    erasureLedgerKey,
    fingerprint: `PASS2499-${hash({ state, retentionMode, retentionLedgerKey, erasureLedgerKey, blockers })}`,
    generatedAt: new Date().toISOString(),
  };
}
