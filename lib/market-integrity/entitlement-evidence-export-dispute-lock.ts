import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { createHash } from "node:crypto";
import type { Pass2497EntitlementArtifactWatermarkShareLock } from "./entitlement-artifact-watermark-share-lock";

export const PASS2498_ENTITLEMENT_EVIDENCE_EXPORT_DISPUTE_LOCK_ID = "entitlement-evidence-export-dispute-lock-v1" as const;

export type Pass2498EvidenceExportState =
  | "redacted_export_allowed"
  | "redaction_replay_required"
  | "support_case_required"
  | "watermark_blocked"
  | "retention_expired_blocked"
  | "blocked";

export type Pass2498EvidenceExportMode =
  | "support_evidence_export_allowed"
  | "redacted_evidence_replay_only"
  | "support_case_only"
  | "access_denied"
  | "blocked";

export type Pass2498EvidenceExportSurface =
  | "support_console"
  | "admin_console"
  | "account_console"
  | "customer_request"
  | "payment_dispute"
  | "angel"
  | "pdf_audit_footer";

export type Pass2498EvidenceExportInput = {
  watermarkLedgerKey?: string;
  artifactHash?: string;
  customerPseudonymHash?: string;
  supportCaseId?: string;
  exportRequestId?: string;
  exportScope?: string;
  requesterRole?: string;
  redactionPolicyFingerprint?: string;
  auditSignerFingerprint?: string;
  secondOperatorFingerprint?: string;
  exportNonceFingerprint?: string;
  retentionExpiry?: string;
  disputeReason?: string;
  locale?: string;
};

export type Pass2498EvidenceExportBinding = {
  surface: Pass2498EvidenceExportSurface;
  mustReplayPass2497WatermarkLedger: true;
  mustUseRedactedEvidencePack: true;
  mustDenyRawPiiExport: true;
  mustRecordSupportCase: true;
  paidEvidenceExportCopyAllowed: boolean;
  requiredVisibleCopy: string;
};

export type Pass2498EntitlementEvidenceExportDisputeLock = {
  version: typeof PASS2498_ENTITLEMENT_EVIDENCE_EXPORT_DISPUTE_LOCK_ID;
  state: Pass2498EvidenceExportState;
  exportMode: Pass2498EvidenceExportMode;
  query?: string;
  symbol?: string;
  pass2497WatermarkLedgerKey?: string;
  requestedWatermarkLedgerKey?: string;
  watermarkLedgerMatch: boolean;
  artifactHashPresent: boolean;
  customerPseudonymHashPresent: boolean;
  supportCasePresent: boolean;
  exportRequestPresent: boolean;
  exportScopePresent: boolean;
  requesterRoleAllowed: boolean;
  redactionPolicyPresent: boolean;
  auditSignerPresent: boolean;
  secondOperatorPresent: boolean;
  exportNoncePresent: boolean;
  retentionExpiryActive: boolean;
  rawPiiExportDenied: true;
  rawPaymentDataDenied: true;
  rawWalletSignatureDenied: true;
  rawIpDeviceFingerprintDenied: true;
  publicArtifactUrlDenied: true;
  finalPaidEvidenceExportAllowed: boolean;
  linkedPass2497State?: string;
  linkedPass2497AccessMode?: string;
  blockers: string[];
  exportRequirements: string[];
  forbiddenEvidenceExports: string[];
  surfaceEvidenceBindings: Pass2498EvidenceExportBinding[];
  customerMessage: string;
  operatorMessage: string;
  privacyBoundary: string;
  nextImplementationActions: string[];
  evidenceExportLedgerKey: string;
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
  return bounded(value, 260, "").toUpperCase().replace(/[^A-Z0-9:_-]/g, "").slice(0, 260);
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

function requesterAllowed(value?: string) {
  const role = bounded(value, 80, "").toLowerCase().replace(/[^a-z0-9:_-]/g, "");
  return role === "support" || role === "admin" || role === "billing" || role === "compliance" || role === "customer_request";
}

function resolveState(args: {
  pass2497?: Pass2497EntitlementArtifactWatermarkShareLock | null;
  watermarkLedgerMatch: boolean;
  artifactHashPresent: boolean;
  customerPseudonymHashPresent: boolean;
  supportCasePresent: boolean;
  exportRequestPresent: boolean;
  exportScopePresent: boolean;
  requesterRoleAllowed: boolean;
  redactionPolicyPresent: boolean;
  auditSignerPresent: boolean;
  secondOperatorPresent: boolean;
  exportNoncePresent: boolean;
  retentionExpiryActive: boolean;
}): Pass2498EvidenceExportState {
  if (!args.pass2497 || args.pass2497.state === "blocked") return "blocked";
  if (!args.pass2497.finalPaidWatermarkedArtifactAllowed) return "watermark_blocked";
  if (!args.retentionExpiryActive) return "retention_expired_blocked";
  if (!args.supportCasePresent || !args.exportRequestPresent || !args.exportScopePresent || !args.requesterRoleAllowed) return "support_case_required";
  if (!args.watermarkLedgerMatch || !args.artifactHashPresent || !args.customerPseudonymHashPresent || !args.redactionPolicyPresent || !args.auditSignerPresent || !args.secondOperatorPresent || !args.exportNoncePresent) return "redaction_replay_required";
  return "redacted_export_allowed";
}

function modeFor(state: Pass2498EvidenceExportState): Pass2498EvidenceExportMode {
  if (state === "redacted_export_allowed") return "support_evidence_export_allowed";
  if (state === "redaction_replay_required") return "redacted_evidence_replay_only";
  if (state === "support_case_required") return "support_case_only";
  if (state === "watermark_blocked" || state === "retention_expired_blocked") return "access_denied";
  return "blocked";
}

function buildSurfaceBindings(args: { allowed: boolean; state: Pass2498EvidenceExportState; ledgerKey: string }): Pass2498EvidenceExportBinding[] {
  const surfaces: Pass2498EvidenceExportSurface[] = ["support_console", "admin_console", "account_console", "customer_request", "payment_dispute", "angel", "pdf_audit_footer"];
  const baseCopy = args.allowed
    ? "PASS2498 allows only a redacted evidence export pack tied to PASS2497 watermark replay and a support/dispute case."
    : `PASS2498 blocks evidence export copy until redaction/support-case replay is clear (${args.state}).`;
  return surfaces.map((surface) => ({
    surface,
    mustReplayPass2497WatermarkLedger: true,
    mustUseRedactedEvidencePack: true,
    mustDenyRawPiiExport: true,
    mustRecordSupportCase: true,
    paidEvidenceExportCopyAllowed: args.allowed,
    requiredVisibleCopy: `${baseCopy} evidenceExportLedgerKey=${args.ledgerKey} surface=${surface}`,
  }));
}

export function buildPass2498EntitlementEvidenceExportDisputeLock(args: {
  query?: string;
  symbol?: string;
  pass2497?: Pass2497EntitlementArtifactWatermarkShareLock | null;
  exportRequest?: Pass2498EvidenceExportInput | null;
}): Pass2498EntitlementEvidenceExportDisputeLock {
  const requestedWatermarkLedgerKey = normalizeKey(args.exportRequest?.watermarkLedgerKey);
  const pass2497WatermarkLedgerKey = normalizeKey(args.pass2497?.watermarkLedgerKey);
  const artifactHash = normalizeKey(args.exportRequest?.artifactHash);
  const customerPseudonymHash = normalizeKey(args.exportRequest?.customerPseudonymHash);
  const supportCaseId = normalizeKey(args.exportRequest?.supportCaseId);
  const exportRequestId = normalizeKey(args.exportRequest?.exportRequestId);
  const exportScope = bounded(args.exportRequest?.exportScope, 120, "").toLowerCase().replace(/[^a-z0-9:_-]/g, "");
  const redactionPolicyFingerprint = normalizeKey(args.exportRequest?.redactionPolicyFingerprint);
  const auditSignerFingerprint = normalizeKey(args.exportRequest?.auditSignerFingerprint);
  const secondOperatorFingerprint = normalizeKey(args.exportRequest?.secondOperatorFingerprint);
  const exportNonceFingerprint = normalizeKey(args.exportRequest?.exportNonceFingerprint);
  const watermarkLedgerMatch = Boolean(pass2497WatermarkLedgerKey && requestedWatermarkLedgerKey && pass2497WatermarkLedgerKey === requestedWatermarkLedgerKey);
  const artifactHashPresent = Boolean(artifactHash);
  const customerPseudonymHashPresent = Boolean(customerPseudonymHash);
  const supportCasePresent = Boolean(supportCaseId);
  const exportRequestPresent = Boolean(exportRequestId);
  const exportScopePresent = Boolean(exportScope && exportScope !== "raw_full_export");
  const requesterRoleAllowed = requesterAllowed(args.exportRequest?.requesterRole);
  const redactionPolicyPresent = Boolean(redactionPolicyFingerprint);
  const auditSignerPresent = Boolean(auditSignerFingerprint);
  const secondOperatorPresent = Boolean(secondOperatorFingerprint && secondOperatorFingerprint !== auditSignerFingerprint);
  const exportNoncePresent = Boolean(exportNonceFingerprint);
  const retentionExpiryActive = isFuture(args.exportRequest?.retentionExpiry);
  const state = resolveState({
    pass2497: args.pass2497,
    watermarkLedgerMatch,
    artifactHashPresent,
    customerPseudonymHashPresent,
    supportCasePresent,
    exportRequestPresent,
    exportScopePresent,
    requesterRoleAllowed,
    redactionPolicyPresent,
    auditSignerPresent,
    secondOperatorPresent,
    exportNoncePresent,
    retentionExpiryActive,
  });
  const exportMode = modeFor(state);
  const finalPaidEvidenceExportAllowed = state === "redacted_export_allowed";
  const blockers = unique([
    !args.pass2497 && "PASS2497 watermark/share lock missing",
    args.pass2497 && !args.pass2497.finalPaidWatermarkedArtifactAllowed && "PASS2497 finalPaidWatermarkedArtifactAllowed=false",
    !pass2497WatermarkLedgerKey && "PASS2497 watermarkLedgerKey missing",
    !requestedWatermarkLedgerKey && "requested watermarkLedgerKey missing",
    requestedWatermarkLedgerKey && !watermarkLedgerMatch && "requested watermarkLedgerKey does not match PASS2497",
    !artifactHashPresent && "artifactHash missing",
    !customerPseudonymHashPresent && "customer pseudonym hash missing",
    !supportCasePresent && "supportCaseId missing",
    !exportRequestPresent && "exportRequestId missing",
    !exportScopePresent && "redacted exportScope missing or unsafe",
    !requesterRoleAllowed && "requesterRole not allowed for evidence export",
    !redactionPolicyPresent && "redactionPolicyFingerprint missing",
    !auditSignerPresent && "auditSignerFingerprint missing",
    !secondOperatorPresent && "secondOperatorFingerprint missing or equals audit signer",
    !exportNoncePresent && "exportNonceFingerprint missing",
    !retentionExpiryActive && "retentionExpiry missing or expired",
  ]).slice(0, 16);
  const evidenceExportLedgerKey = `PASS2498-${hash({
    version: PASS2498_ENTITLEMENT_EVIDENCE_EXPORT_DISPUTE_LOCK_ID,
    query: bounded(args.query, 120),
    symbol: normalizeSymbol(args.symbol),
    pass2497WatermarkLedgerKey,
    requestedWatermarkLedgerKey,
    artifactHash,
    customerPseudonymHash,
    supportCaseId,
    exportRequestId,
    exportScope,
    redactionPolicyFingerprint,
    auditSignerFingerprint,
    secondOperatorFingerprint,
    exportNonceFingerprint,
  })}`;
  const surfaceEvidenceBindings = buildSurfaceBindings({ allowed: finalPaidEvidenceExportAllowed, state, ledgerKey: evidenceExportLedgerKey });
  const customerMessage = finalPaidEvidenceExportAllowed
    ? "A redacted Advanced evidence export pack is available for the scoped support/dispute request."
    : state === "support_case_required"
      ? "Evidence export is blocked until a scoped support/dispute case and allowed requester role are recorded."
      : "Evidence export is blocked until PASS2497 watermark replay and redaction signatures match.";
  const operatorMessage = finalPaidEvidenceExportAllowed
    ? "PASS2498 clear: watermark ledger, artifact hash, support case, redaction policy, dual signatures, nonce and retention window are aligned."
    : `PASS2498 blocked/replay: ${blockers.join("; ") || "evidence export replay incomplete"}.`;
  const fingerprint = `PASS2498-${hash({ state, exportMode, finalPaidEvidenceExportAllowed, blockers, evidenceExportLedgerKey })}`;
  return {
    version: PASS2498_ENTITLEMENT_EVIDENCE_EXPORT_DISPUTE_LOCK_ID,
    state,
    exportMode,
    query: bounded(args.query, 120) || undefined,
    symbol: normalizeSymbol(args.symbol) || undefined,
    pass2497WatermarkLedgerKey: pass2497WatermarkLedgerKey || undefined,
    requestedWatermarkLedgerKey: requestedWatermarkLedgerKey || undefined,
    watermarkLedgerMatch,
    artifactHashPresent,
    customerPseudonymHashPresent,
    supportCasePresent,
    exportRequestPresent,
    exportScopePresent,
    requesterRoleAllowed,
    redactionPolicyPresent,
    auditSignerPresent,
    secondOperatorPresent,
    exportNoncePresent,
    retentionExpiryActive,
    rawPiiExportDenied: true,
    rawPaymentDataDenied: true,
    rawWalletSignatureDenied: true,
    rawIpDeviceFingerprintDenied: true,
    publicArtifactUrlDenied: true,
    finalPaidEvidenceExportAllowed,
    linkedPass2497State: args.pass2497?.state,
    linkedPass2497AccessMode: args.pass2497?.accessMode,
    blockers,
    exportRequirements: [
      "Replay PASS2497 watermarkLedgerKey before any dispute/support evidence export.",
      "Export only redacted evidence packs scoped to supportCaseId + exportRequestId + safe exportScope.",
      "Require redactionPolicyFingerprint, auditSignerFingerprint, secondOperatorFingerprint and exportNonceFingerprint.",
      "Deny raw PII, raw payment data, raw wallet signatures, raw IP/device fingerprints and public artifact URLs.",
      "Expose PASS2498 evidenceExportLedgerKey in support console, account console, payment dispute view, PDF footer and Angel.",
    ],
    forbiddenEvidenceExports: [
      "raw customer PII export",
      "raw card/BLIK/payment data export",
      "raw wallet signature or seed phrase request",
      "raw IP/device fingerprint export",
      "public cached PDF URL as evidence export",
      "single-operator admin export",
      "unscoped full report dump",
    ],
    surfaceEvidenceBindings,
    customerMessage,
    operatorMessage,
    privacyBoundary: "PASS2498 exposes only redacted hashes, case IDs and evidence ledger state; raw customer identity, payment data, wallet signatures, IP/device fingerprints and original PDF bytes remain server-only.",
    nextImplementationActions: [
      "Add support/dispute evidence export UI that creates supportCaseId and exportRequestId before download.",
      "Generate redacted evidence bundles from PASS2492-PASS2497 ledger keys instead of raw customer data.",
      "Require two different operator signatures for non-customer-initiated exports.",
      "Expire evidenceExportLedgerKey after retentionExpiry and deny public artifact URLs in dispute screens.",
    ],
    evidenceExportLedgerKey,
    fingerprint,
    generatedAt: new Date().toISOString(),
  };
}
