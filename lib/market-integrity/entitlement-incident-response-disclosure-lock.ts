import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { createHash } from "node:crypto";
import type { Pass2499EntitlementRetentionErasureLock } from "./entitlement-retention-erasure-lock";

export const PASS2500_ENTITLEMENT_INCIDENT_RESPONSE_DISCLOSURE_LOCK_ID = "entitlement-incident-response-disclosure-lock-v1" as const;

export type Pass2500IncidentResponseState =
  | "incident_response_clear_allowed"
  | "incident_response_replay_required"
  | "incident_open_blocked"
  | "customer_notice_required"
  | "retention_erasure_blocked"
  | "blocked";

export type Pass2500IncidentResponseMode =
  | "contained_incident_allowed"
  | "incident_response_map_only"
  | "customer_notice_required"
  | "retention_erasure_denied"
  | "blocked";

export type Pass2500IncidentSurface =
  | "support_console"
  | "admin_console"
  | "account_console"
  | "payment_dispute"
  | "customer_request"
  | "angel"
  | "pdf_audit_footer"
  | "incident_worker";

export type Pass2500IncidentRequest = {
  retentionLedgerKey?: string;
  incidentCaseId?: string;
  incidentSeverity?: string;
  activeIncidentSignal?: string;
  incidentTriageFingerprint?: string;
  containmentFingerprint?: string;
  customerNoticeId?: string;
  operatorAckFingerprint?: string;
  postIncidentReviewExpiry?: string;
  affectedArtifactHash?: string;
  forensicExportMode?: string;
  requestSurface?: string;
  locale?: string;
};

export type Pass2500IncidentSurfaceBinding = {
  surface: Pass2500IncidentSurface;
  mustReplayPass2499RetentionLedger: true;
  mustShowIncidentState: true;
  mustDenySilentRecovery: true;
  mustKeepForensicsRedacted: true;
  paidIncidentResponseCopyAllowed: boolean;
  requiredVisibleCopy: string;
};

export type Pass2500EntitlementIncidentResponseDisclosureLock = {
  version: typeof PASS2500_ENTITLEMENT_INCIDENT_RESPONSE_DISCLOSURE_LOCK_ID;
  state: Pass2500IncidentResponseState;
  incidentMode: Pass2500IncidentResponseMode;
  query?: string;
  symbol?: string;
  pass2499RetentionLedgerKey?: string;
  requestedRetentionLedgerKey?: string;
  retentionLedgerMatch: boolean;
  incidentCasePresent: boolean;
  severityPresent: boolean;
  activeIncidentSignal: boolean;
  incidentTriagePresent: boolean;
  containmentPresent: boolean;
  customerNoticePresent: boolean;
  operatorAckPresent: boolean;
  postIncidentReviewActive: boolean;
  affectedArtifactHashPresent: boolean;
  silentIncidentRecoveryDenied: true;
  rawForensicExportDenied: true;
  rawPiiIncidentExportDenied: true;
  rawPaymentIncidentExportDenied: true;
  rawWalletIpDeviceIncidentExportDenied: true;
  publicIncidentArchiveDenied: true;
  finalPaidIncidentResponseAllowed: boolean;
  linkedPass2499State?: string;
  linkedPass2499RetentionMode?: string;
  blockers: string[];
  incidentRequirements: string[];
  forbiddenIncidentPatterns: string[];
  surfaceIncidentBindings: Pass2500IncidentSurfaceBinding[];
  customerMessage: string;
  operatorMessage: string;
  privacyBoundary: string;
  nextImplementationActions: string[];
  incidentLedgerKey: string;
  disclosureLedgerKey: string;
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

function normalizeSeverity(value?: string) {
  const clean = bounded(value, 40, "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return ["low", "medium", "high", "critical", "informational"].includes(clean) ? clean : "";
}

function incidentSignalActive(value?: string) {
  const clean = bounded(value, 80, "none").toLowerCase();
  return /open|active|confirmed|breach|leak|security_incident|token_compromised|artifact_shared|suspected/.test(clean);
}

function isFuture(value?: string) {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time > Date.now();
}

function makeSurfaceBindings(finalAllowed: boolean, blockers: string[]): Pass2500IncidentSurfaceBinding[] {
  const requiredVisibleCopy = finalAllowed
    ? "PASS2500 incident response clear: show incidentLedgerKey, disclosureLedgerKey, contained state and redacted customer notice before paid evidence copy."
    : `PASS2500 incident response blocked: ${blockers.slice(0, 4).join("; ") || "incident response replay required"}.`;
  return ([
    "support_console",
    "admin_console",
    "account_console",
    "payment_dispute",
    "customer_request",
    "angel",
    "pdf_audit_footer",
    "incident_worker",
  ] as Pass2500IncidentSurface[]).map((surface) => ({
    surface,
    mustReplayPass2499RetentionLedger: true,
    mustShowIncidentState: true,
    mustDenySilentRecovery: true,
    mustKeepForensicsRedacted: true,
    paidIncidentResponseCopyAllowed: finalAllowed,
    requiredVisibleCopy,
  }));
}

export function buildPass2500EntitlementIncidentResponseDisclosureLock(args: {
  query?: string;
  symbol?: string;
  pass2499?: Pass2499EntitlementRetentionErasureLock | null;
  incidentRequest?: Pass2500IncidentRequest;
}): Pass2500EntitlementIncidentResponseDisclosureLock {
  const now = new Date().toISOString();
  const request = args.incidentRequest ?? {};
  const pass2499RetentionLedgerKey = normalizeKey(args.pass2499?.retentionLedgerKey);
  const requestedRetentionLedgerKey = normalizeKey(request.retentionLedgerKey) || pass2499RetentionLedgerKey;
  const retentionLedgerMatch = Boolean(pass2499RetentionLedgerKey && requestedRetentionLedgerKey && pass2499RetentionLedgerKey === requestedRetentionLedgerKey);
  const pass2499Allowed = Boolean(args.pass2499?.finalPaidEvidenceRetentionAllowed);
  const incidentCaseId = bounded(request.incidentCaseId, 180);
  const severity = normalizeSeverity(request.incidentSeverity);
  const activeSignal = incidentSignalActive(request.activeIncidentSignal);
  const incidentTriageFingerprint = normalizeKey(request.incidentTriageFingerprint);
  const containmentFingerprint = normalizeKey(request.containmentFingerprint);
  const customerNoticeId = bounded(request.customerNoticeId, 180);
  const operatorAckFingerprint = normalizeKey(request.operatorAckFingerprint);
  const affectedArtifactHash = normalizeKey(request.affectedArtifactHash);
  const postIncidentReviewActive = isFuture(request.postIncidentReviewExpiry);
  const unsafeForensicExport = /raw|full|unredacted|public|pii|payment|wallet|ip|device/i.test(request.forensicExportMode ?? "");

  const blockers: string[] = [];
  if (!args.pass2499) blockers.push("PASS2499 retention/erasure lock missing");
  if (!pass2499Allowed) blockers.push("PASS2499 finalPaidEvidenceRetentionAllowed=false");
  if (!retentionLedgerMatch) blockers.push("PASS2499 retentionLedgerKey replay mismatch");
  if (!incidentCaseId) blockers.push("incidentCaseId missing");
  if (!severity) blockers.push("incidentSeverity missing");
  if (!incidentTriageFingerprint) blockers.push("incidentTriageFingerprint missing");
  if (!containmentFingerprint) blockers.push("containmentFingerprint missing");
  if (!customerNoticeId) blockers.push("customerNoticeId missing");
  if (!operatorAckFingerprint) blockers.push("operatorAckFingerprint missing");
  if (!affectedArtifactHash) blockers.push("affectedArtifactHash missing");
  if (!postIncidentReviewActive) blockers.push("postIncidentReviewExpiry inactive or missing");
  if (unsafeForensicExport) blockers.push("raw/public forensic export requested");
  if (activeSignal && (!containmentFingerprint || !customerNoticeId)) blockers.push("active incident requires containment and customer notice");

  const finalAllowed = pass2499Allowed
    && retentionLedgerMatch
    && Boolean(incidentCaseId)
    && Boolean(severity)
    && Boolean(incidentTriageFingerprint)
    && Boolean(containmentFingerprint)
    && Boolean(customerNoticeId)
    && Boolean(operatorAckFingerprint)
    && Boolean(affectedArtifactHash)
    && postIncidentReviewActive
    && !unsafeForensicExport;

  const state: Pass2500IncidentResponseState = !pass2499Allowed
    ? "retention_erasure_blocked"
    : activeSignal && !finalAllowed
      ? "incident_open_blocked"
      : !customerNoticeId
        ? "customer_notice_required"
        : finalAllowed
          ? "incident_response_clear_allowed"
          : blockers.length
            ? "incident_response_replay_required"
            : "blocked";

  const incidentMode: Pass2500IncidentResponseMode = finalAllowed
    ? "contained_incident_allowed"
    : !pass2499Allowed
      ? "retention_erasure_denied"
      : !customerNoticeId
        ? "customer_notice_required"
        : activeSignal
          ? "incident_response_map_only"
          : "blocked";

  const incidentLedgerKey = `PASS2500-${hash({
    version: PASS2500_ENTITLEMENT_INCIDENT_RESPONSE_DISCLOSURE_LOCK_ID,
    pass2499RetentionLedgerKey,
    incidentCaseId,
    severity,
    activeSignal,
    incidentTriageFingerprint,
    containmentFingerprint,
    customerNoticeId,
    operatorAckFingerprint,
    affectedArtifactHash,
  })}`;
  const disclosureLedgerKey = `PASS2500-DISCLOSE-${hash({ incidentLedgerKey, customerNoticeId, postIncidentReviewActive, blockers })}`;
  const customerMessage = finalAllowed
    ? "PASS2500 incident response is contained and disclosed: paid evidence copy may reference a redacted incident ledger and customer notice."
    : "Paid Advanced evidence access stays in incident-response mode until containment, customer notice and PASS2499 retention replay are verified.";
  const operatorMessage = finalAllowed
    ? "PASS2500 clear: show incidentLedgerKey/disclosureLedgerKey on account, support, PDF footer and Angel surfaces."
    : `PASS2500 ${state}: do not claim retained paid evidence is healthy; resolve blockers before account/support/PDF/Angel copy.`;

  return {
    version: PASS2500_ENTITLEMENT_INCIDENT_RESPONSE_DISCLOSURE_LOCK_ID,
    state,
    incidentMode,
    query: bounded(args.query, 120) || undefined,
    symbol: bounded(args.symbol, 40).toUpperCase() || undefined,
    pass2499RetentionLedgerKey: pass2499RetentionLedgerKey || undefined,
    requestedRetentionLedgerKey: requestedRetentionLedgerKey || undefined,
    retentionLedgerMatch,
    incidentCasePresent: Boolean(incidentCaseId),
    severityPresent: Boolean(severity),
    activeIncidentSignal: activeSignal,
    incidentTriagePresent: Boolean(incidentTriageFingerprint),
    containmentPresent: Boolean(containmentFingerprint),
    customerNoticePresent: Boolean(customerNoticeId),
    operatorAckPresent: Boolean(operatorAckFingerprint),
    postIncidentReviewActive,
    affectedArtifactHashPresent: Boolean(affectedArtifactHash),
    silentIncidentRecoveryDenied: true,
    rawForensicExportDenied: true,
    rawPiiIncidentExportDenied: true,
    rawPaymentIncidentExportDenied: true,
    rawWalletIpDeviceIncidentExportDenied: true,
    publicIncidentArchiveDenied: true,
    finalPaidIncidentResponseAllowed: finalAllowed,
    linkedPass2499State: args.pass2499?.state,
    linkedPass2499RetentionMode: args.pass2499?.retentionMode,
    blockers,
    incidentRequirements: [
      "Replay the same PASS2499 retentionLedgerKey before incident/audit disclosure copy.",
      "Attach incidentCaseId, severity, triage fingerprint, containment fingerprint and affected artifact hash.",
      "Show customerNoticeId and operator acknowledgement on account/support/PDF/Angel surfaces.",
      "Keep incident forensics redacted; never expose raw PII/payment/wallet/IP/device payloads or public incident archives.",
      "Set a future postIncidentReviewExpiry so contained incident status is reviewed instead of permanent silent recovery.",
    ],
    forbiddenIncidentPatterns: [
      "silent paid evidence recovery after incident without customer-visible notice",
      "support note says issue fixed while PASS2499 retention replay is missing",
      "raw forensic bundle, raw PII, payment metadata, wallet signature, IP or device payload exported to user/admin",
      "public incident ZIP/PDF/archive URL used as proof of paid delivery",
      "wallet connect, checkout success, localStorage or cached PDF URL used to bypass incident containment",
    ],
    surfaceIncidentBindings: makeSurfaceBindings(finalAllowed, blockers),
    customerMessage,
    operatorMessage,
    privacyBoundary: "PASS2500 is an entitlement incident-response disclosure lock. It is product safety and evidence-bound copy control, not legal advice or an incident-notification legal determination.",
    nextImplementationActions: finalAllowed
      ? [
          "Persist incidentLedgerKey and disclosureLedgerKey with the account delivery manifest.",
          "Render customer notice and review expiry on account, support, PDF footer and Angel surfaces.",
          "Keep raw forensics server-only and export only redacted support packets.",
        ]
      : [
          "Add incident triage/containment ledger writer for account/support/admin surfaces.",
          "Bind customerNoticeId to every retained paid evidence access after any active incident signal.",
          "Add a post-incident review scheduler before restoring paid Advanced copy.",
          "Keep public cached PDF URLs and raw forensic exports blocked under PASS2500.",
        ],
    incidentLedgerKey,
    disclosureLedgerKey,
    fingerprint: `PASS2500-${hash({ state, incidentMode, incidentLedgerKey, disclosureLedgerKey, blockers })}`,
    generatedAt: now,
  };
}
