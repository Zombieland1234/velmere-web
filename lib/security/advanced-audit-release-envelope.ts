import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "./ascii-control-characters";

import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalJson } from "./canonical-json";
import { sha256Digest, sha256Token } from "./cryptographic-digest";

export const PASS4801_ADVANCED_AUDIT_RELEASE_ENVELOPE_ID = "pass4801-advanced-audit-release-envelope-v2" as const;

export type AdvancedAuditReleaseState = "blocked" | "ready" | "expired" | "revoked";

export type AdvancedAuditReleaseEnvelope = {
  schemaVersion: typeof PASS4801_ADVANCED_AUDIT_RELEASE_ENVELOPE_ID;
  releaseId: string;
  caseRef: string;
  tier: "advanced";
  target: string;
  accountRefHash: string;
  entitlementRefHash: string;
  evidencePacketId: string;
  payloadHash: string;
  sourceReceiptRoot: string;
  pdfDigest: string;
  issuedAt: string;
  expiresAt: string;
  state: AdvancedAuditReleaseState;
  blockers: string[];
  automation: {
    processingMode: "advanced_automation";
    completionState: "completed" | "incomplete";
    immutableSnapshotBound: boolean;
    automationLeaseActive: boolean;
    completedAt: string | null;
  };
  /** Optional internal QA metadata. It never changes release eligibility. */
  review: {
    receiptId: string;
    operatorPseudonym: string;
    signatureHash: string;
    reviewedAt: string;
    sanitizedNotePreview: string;
  } | null;
  /** Optional internal QA annotation. required is always false for current V17 delivery. */
  dualControl?: {
    required: false;
    approvalReceiptId: string | null;
    approverPseudonym: string | null;
    signatureHash: string | null;
    approvedAt: string | null;
    payloadHash: string | null;
  } | null;
  delivery: {
    paymentVerified: boolean;
    entitlementActive: boolean;
    scopeConsentVerified: boolean;
    evidenceReadinessMet: boolean;
    redactionPassed: boolean;
  };
  signature: {
    algorithm: "hmac-sha256";
    keyId: string;
    value: string;
  } | null;
};

export type AdvancedAuditReleaseVerification = {
  integrityValid: boolean;
  policyValid: boolean;
  valid: boolean;
  deliverable: boolean;
  state: AdvancedAuditReleaseState;
  integrityBlockers: string[];
  policyBlockers: string[];
  blockers: string[];
};

function clean(value: string, max: number) {
  return value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeSha256(value: string, label: string) {
  const normalized = value.trim().toLowerCase();
  const digest = normalized.startsWith("sha256:") ? normalized : `sha256:${normalized}`;
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error(`${label}_sha256_required`);
  return digest;
}

function operatorPseudonym(value: string) {
  return `operator-${sha256Token(clean(value, 220), 24).slice(-6)}`;
}

function safeDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("advanced_release_invalid_date");
  return date;
}

function reviewShape(value: unknown) {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const review = value as Record<string, unknown>;
  return ["receiptId", "operatorPseudonym", "signatureHash", "reviewedAt", "sanitizedNotePreview"]
    .every((key) => typeof review[key] === "string");
}

export function isAdvancedAuditReleaseEnvelope(value: unknown): value is AdvancedAuditReleaseEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const delivery = record.delivery;
  const signature = record.signature;
  const automation = record.automation;
  return record.schemaVersion === PASS4801_ADVANCED_AUDIT_RELEASE_ENVELOPE_ID
    && typeof record.releaseId === "string"
    && typeof record.caseRef === "string"
    && record.tier === "advanced"
    && typeof record.target === "string"
    && typeof record.accountRefHash === "string"
    && typeof record.entitlementRefHash === "string"
    && typeof record.evidencePacketId === "string"
    && typeof record.payloadHash === "string"
    && typeof record.sourceReceiptRoot === "string"
    && typeof record.pdfDigest === "string"
    && typeof record.issuedAt === "string"
    && typeof record.expiresAt === "string"
    && (record.state === "blocked" || record.state === "ready" || record.state === "expired" || record.state === "revoked")
    && Array.isArray(record.blockers)
    && record.blockers.every((item) => typeof item === "string")
    && Boolean(automation && typeof automation === "object" && !Array.isArray(automation))
    && (automation as Record<string, unknown>).processingMode === "advanced_automation"
    && ((automation as Record<string, unknown>).completionState === "completed" || (automation as Record<string, unknown>).completionState === "incomplete")
    && typeof (automation as Record<string, unknown>).immutableSnapshotBound === "boolean"
    && typeof (automation as Record<string, unknown>).automationLeaseActive === "boolean"
    && ((automation as Record<string, unknown>).completedAt === null || typeof (automation as Record<string, unknown>).completedAt === "string")
    && reviewShape(record.review)
    && (record.dualControl === undefined || record.dualControl === null || (
      typeof record.dualControl === "object"
      && !Array.isArray(record.dualControl)
      && (record.dualControl as Record<string, unknown>).required === false
    ))
    && Boolean(delivery && typeof delivery === "object" && !Array.isArray(delivery))
    && ["paymentVerified", "entitlementActive", "scopeConsentVerified", "evidenceReadinessMet", "redactionPassed"]
      .every((key) => typeof (delivery as Record<string, unknown>)[key] === "boolean")
    && Boolean(signature && typeof signature === "object" && !Array.isArray(signature))
    && (signature as Record<string, unknown>).algorithm === "hmac-sha256"
    && typeof (signature as Record<string, unknown>).keyId === "string"
    && typeof (signature as Record<string, unknown>).value === "string";
}

function unsigned(envelope: AdvancedAuditReleaseEnvelope) {
  const { signature, ...rest } = envelope;
  void signature;
  return rest;
}

function signValue(envelope: AdvancedAuditReleaseEnvelope, secret: string) {
  return createHmac("sha256", secret).update(canonicalJson(unsigned(envelope))).digest("hex");
}

function signatureMatches(expected: string, supplied: string) {
  if (!/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

export function buildAdvancedAuditReleaseEnvelope(args: {
  secret: string;
  keyId?: string;
  caseRef: string;
  target: string;
  accountRef: string;
  entitlementRef: string;
  entitlementState: "active" | "expired" | "refunded" | "chargeback" | "revoked";
  paymentVerified: boolean;
  scopeConsentVerified: boolean;
  evidenceReadinessMet: boolean;
  redactionPassed: boolean;
  evidencePacketId: string;
  payloadHash: string;
  sourceReceiptRoot: string;
  pdfDigest: string;
  automationCompleted: boolean;
  automationLeaseActive: boolean;
  immutableSnapshotBound: boolean;
  automationCompletedAt?: string | Date | null;
  issuedAt?: string | Date;
  expiresInMinutes?: number;
  revoked?: boolean;
}): AdvancedAuditReleaseEnvelope {
  const secret = args.secret.trim();
  if (secret.length < 32) throw new Error("advanced_release_secret_too_short");
  const issued = safeDate(args.issuedAt ?? new Date());
  const expiresInMinutes = Math.max(15, Math.min(7 * 24 * 60, Math.trunc(args.expiresInMinutes ?? 24 * 60)));
  const expires = new Date(issued.getTime() + expiresInMinutes * 60_000);
  const caseRef = clean(args.caseRef, 48).toUpperCase();
  const target = clean(args.target, 180);
  const accountRef = clean(args.accountRef, 180);
  const entitlementRef = clean(args.entitlementRef, 180);
  const evidencePacketId = clean(args.evidencePacketId, 220);
  if (!/^AUD-[A-Z0-9-]{6,32}$/.test(caseRef)) throw new Error("advanced_release_case_ref_invalid");
  if (!target || !accountRef || !entitlementRef || !evidencePacketId) throw new Error("advanced_release_identity_missing");

  const payloadHash = normalizeSha256(args.payloadHash, "payload_hash");
  const sourceReceiptRoot = normalizeSha256(args.sourceReceiptRoot, "source_receipt_root");
  const pdfDigest = normalizeSha256(args.pdfDigest, "pdf_digest");
  const entitlementActive = args.entitlementState === "active";
  let completedAt: string | null = null;
  if (args.automationCompletedAt) completedAt = safeDate(args.automationCompletedAt).toISOString();

  const blockers = new Set<string>();
  if (!args.paymentVerified) blockers.add("payment_not_verified");
  if (!entitlementActive) blockers.add(`entitlement_${args.entitlementState}`);
  if (!args.scopeConsentVerified) blockers.add("scope_consent_missing");
  if (!args.evidenceReadinessMet) blockers.add("evidence_readiness_not_met");
  if (!args.redactionPassed) blockers.add("redaction_not_passed");
  if (!args.automationCompleted || !completedAt) blockers.add("advanced_automation_not_completed");
  if (args.automationLeaseActive) blockers.add("advanced_automation_lease_active");
  if (!args.immutableSnapshotBound) blockers.add("advanced_immutable_snapshot_not_bound");
  if (args.revoked) blockers.add("release_revoked");

  const nowMs = issued.getTime();
  let state: AdvancedAuditReleaseState = blockers.size > 0 ? "blocked" : "ready";
  if (args.revoked) state = "revoked";
  if (expires.getTime() <= nowMs) state = "expired";

  const releaseId = `advrel-${sha256Token(`${caseRef}:${evidencePacketId}:${payloadHash}:${pdfDigest}`, 32)}`;
  const envelope: AdvancedAuditReleaseEnvelope = {
    schemaVersion: PASS4801_ADVANCED_AUDIT_RELEASE_ENVELOPE_ID,
    releaseId,
    caseRef,
    tier: "advanced",
    target,
    accountRefHash: sha256Digest(accountRef.toLowerCase()),
    entitlementRefHash: sha256Digest(entitlementRef.toLowerCase()),
    evidencePacketId,
    payloadHash,
    sourceReceiptRoot,
    pdfDigest,
    issuedAt: issued.toISOString(),
    expiresAt: expires.toISOString(),
    state,
    blockers: Array.from(blockers).sort(),
    automation: {
      processingMode: "advanced_automation",
      completionState: args.automationCompleted ? "completed" : "incomplete",
      immutableSnapshotBound: args.immutableSnapshotBound,
      automationLeaseActive: args.automationLeaseActive,
      completedAt,
    },
    review: null,
    dualControl: {
      required: false,
      approvalReceiptId: null,
      approverPseudonym: null,
      signatureHash: null,
      approvedAt: null,
      payloadHash: null,
    },
    delivery: {
      paymentVerified: args.paymentVerified,
      entitlementActive,
      scopeConsentVerified: args.scopeConsentVerified,
      evidenceReadinessMet: args.evidenceReadinessMet,
      redactionPassed: args.redactionPassed,
    },
    signature: null,
  };

  envelope.signature = {
    algorithm: "hmac-sha256",
    keyId: clean(args.keyId ?? "advanced-release-v2", 80) || "advanced-release-v2",
    value: signValue(envelope, secret),
  };
  return envelope;
}

export function verifyAdvancedAuditReleaseEnvelope(args: {
  envelope: AdvancedAuditReleaseEnvelope;
  secret: string;
  now?: string | Date;
}): AdvancedAuditReleaseVerification {
  const integrityBlockers = new Set<string>();
  const policyBlockers = new Set<string>();
  const envelope = args.envelope;
  const secret = args.secret.trim();
  if (secret.length < 32) integrityBlockers.add("verification_secret_invalid");
  if (!isAdvancedAuditReleaseEnvelope(envelope)) integrityBlockers.add("envelope_shape_invalid");
  if (envelope.schemaVersion !== PASS4801_ADVANCED_AUDIT_RELEASE_ENVELOPE_ID) integrityBlockers.add("schema_version_invalid");
  if (!envelope.signature || envelope.signature.algorithm !== "hmac-sha256") integrityBlockers.add("signature_missing");
  if (envelope.signature && secret.length >= 32) {
    const expected = signValue(envelope, secret);
    if (!signatureMatches(expected, envelope.signature.value)) integrityBlockers.add("signature_mismatch");
  }
  try {
    normalizeSha256(envelope.accountRefHash, "account_ref_hash");
    normalizeSha256(envelope.entitlementRefHash, "entitlement_ref_hash");
    normalizeSha256(envelope.payloadHash, "payload_hash");
    normalizeSha256(envelope.sourceReceiptRoot, "source_receipt_root");
    normalizeSha256(envelope.pdfDigest, "pdf_digest");
  } catch (error) {
    integrityBlockers.add(error instanceof Error ? error.message : "digest_invalid");
  }
  let now: Date | null = null;
  let expires: Date | null = null;
  try {
    now = safeDate(args.now ?? new Date());
    expires = safeDate(envelope.expiresAt);
    if (envelope.automation.completedAt) safeDate(envelope.automation.completedAt);
  } catch (error) {
    integrityBlockers.add(error instanceof Error ? error.message : "release_timestamp_invalid");
  }
  let state = envelope.state;
  if (now && expires && expires.getTime() <= now.getTime() && state !== "revoked") {
    state = "expired";
    policyBlockers.add("release_expired");
  }
  if (state === "revoked") policyBlockers.add("release_revoked");
  if (state === "blocked") {
    for (const blocker of envelope.blockers) policyBlockers.add(blocker);
  }
  if (envelope.automation.processingMode !== "advanced_automation") policyBlockers.add("advanced_automation_mode_invalid");
  if (envelope.automation.completionState !== "completed" || !envelope.automation.completedAt) policyBlockers.add("advanced_automation_not_completed");
  if (envelope.automation.automationLeaseActive) policyBlockers.add("advanced_automation_lease_active");
  if (!envelope.automation.immutableSnapshotBound) policyBlockers.add("advanced_immutable_snapshot_not_bound");
  if (!envelope.delivery.paymentVerified || !envelope.delivery.entitlementActive) policyBlockers.add("paid_entitlement_not_active");
  if (!envelope.delivery.scopeConsentVerified) policyBlockers.add("scope_consent_missing");
  if (!envelope.delivery.evidenceReadinessMet) policyBlockers.add("evidence_readiness_not_met");
  if (!envelope.delivery.redactionPassed) policyBlockers.add("redaction_not_passed");
  const rawDualControl = (envelope as unknown as { dualControl?: { required?: unknown } | null }).dualControl;
  if (rawDualControl?.required === true) integrityBlockers.add("human_approval_must_not_gate_advanced_v17");

  const integrity = Array.from(integrityBlockers).sort();
  const policy = Array.from(policyBlockers).sort();
  const blockers = Array.from(new Set([...integrity, ...policy])).sort();
  const integrityValid = integrity.length === 0;
  const policyValid = policy.length === 0;
  return {
    integrityValid,
    policyValid,
    valid: integrityValid && policyValid,
    deliverable: integrityValid && policyValid && state === "ready",
    state,
    integrityBlockers: integrity,
    policyBlockers: policy,
    blockers,
  };
}

/**
 * Legacy-named compatibility helper. In V17 this can only attach optional internal
 * QA metadata to an already deliverable automated release. It cannot clear a blocker,
 * change the state to ready or create customer feature/release credit.
 */
export function approveAdvancedAuditReleaseEnvelope(args: {
  envelope: AdvancedAuditReleaseEnvelope;
  secret: string;
  approverId: string;
  approverSignature: string;
  approvalReceiptId: string;
  approvalPayloadHash?: string | null;
  approvedAt?: string | Date;
  now?: string | Date;
  keyId?: string;
}): AdvancedAuditReleaseEnvelope {
  const secret = args.secret.trim();
  if (secret.length < 32) throw new Error("advanced_release_secret_too_short");
  const current = verifyAdvancedAuditReleaseEnvelope({ envelope: args.envelope, secret, now: args.now });
  if (!current.integrityValid) throw new Error("advanced_release_integrity_invalid");
  if (!current.deliverable || args.envelope.state !== "ready") throw new Error("advanced_release_optional_qa_requires_ready_automation");
  const expiresAt = safeDate(args.envelope.expiresAt);
  const approvedAt = safeDate(args.approvedAt ?? args.now ?? new Date());
  const now = safeDate(args.now ?? new Date());
  if (expiresAt.getTime() <= now.getTime() || approvedAt.getTime() > expiresAt.getTime()) throw new Error("advanced_release_expired");

  const approverId = clean(args.approverId, 220);
  const approverSignature = clean(args.approverSignature, 220);
  const approvalReceiptId = clean(args.approvalReceiptId, 160);
  if (!approverId || approverSignature.length < 16 || !approvalReceiptId) throw new Error("advanced_release_optional_qa_evidence_missing");
  const approvalPayloadHash = args.approvalPayloadHash
    ? normalizeSha256(args.approvalPayloadHash, "approval_payload_hash")
    : args.envelope.payloadHash;
  if (approvalPayloadHash !== args.envelope.payloadHash) throw new Error("advanced_release_approval_payload_mismatch");
  if (approvedAt.getTime() > now.getTime() + 5 * 60_000) throw new Error("advanced_release_approval_in_future");

  const dualControl = {
    required: false as const,
    approvalReceiptId,
    approverPseudonym: operatorPseudonym(approverId),
    signatureHash: sha256Digest(`${approverId}:${approverSignature}:${approvalReceiptId}:${approvalPayloadHash}`),
    approvedAt: approvedAt.toISOString(),
    payloadHash: approvalPayloadHash,
  };
  const envelope: AdvancedAuditReleaseEnvelope = {
    ...args.envelope,
    dualControl,
    signature: null,
  };
  envelope.signature = {
    algorithm: "hmac-sha256",
    keyId: clean(args.keyId ?? args.envelope.signature?.keyId ?? "advanced-release-v2", 80) || "advanced-release-v2",
    value: signValue(envelope, secret),
  };
  return envelope;
}

export function revokeAdvancedAuditReleaseEnvelope(args: {
  envelope: AdvancedAuditReleaseEnvelope;
  secret: string;
  reason: "refund" | "chargeback" | "manual_revoke" | "evidence_recalled";
  keyId?: string;
}): AdvancedAuditReleaseEnvelope {
  const secret = args.secret.trim();
  if (secret.length < 32) throw new Error("advanced_release_secret_too_short");
  const envelope: AdvancedAuditReleaseEnvelope = {
    ...args.envelope,
    state: "revoked",
    blockers: Array.from(new Set([...args.envelope.blockers, `release_revoked:${args.reason}`])).sort(),
    signature: null,
  };
  envelope.signature = {
    algorithm: "hmac-sha256",
    keyId: clean(args.keyId ?? args.envelope.signature?.keyId ?? "advanced-release-v2", 80) || "advanced-release-v2",
    value: signValue(envelope, secret),
  };
  return envelope;
}
