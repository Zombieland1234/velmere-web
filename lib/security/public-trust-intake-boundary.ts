import { ASCII_CONTROL_PATTERN } from "./ascii-control-characters";

import { createHash } from "node:crypto";
import { createPrivacyFingerprint } from "@/lib/security/privacy-fingerprint";

export const PASS36_A89_PUBLIC_TRUST_INTAKE_BOUNDARY_ID = "velmere.pass36.a89.public-trust-intake-boundary.v1" as const;

export const PASS36_A89_TRUST_CENTER_SECTION_IDS = [
  "methodology",
  "scope_and_limitations",
  "public_audit_registry",
  "validated_findings",
  "remediation_confirmations",
  "retest_confirmations",
  "cross_audit_benchmark",
  "false_positive_duplicate_dispute_ledger",
  "responsible_disclosure",
  "safe_harbor_and_authorization",
  "provider_and_data_rights",
  "model_and_ai_limitations",
  "risk_calibration",
  "pdf_and_report_integrity",
  "security_and_privacy",
  "sbom_and_supply_chain",
  "accessibility",
  "corrections_and_supersession",
  "independent_assurance",
  "legal_and_contact",
] as const;

export type TrustIntakeAuthorizationBasis = "public_contest" | "active_bug_bounty" | "written_permission";
export type TrustIntakeEvidenceType =
  | "finding_acknowledgement"
  | "remediation_confirmation"
  | "retest_confirmation"
  | "rights_record"
  | "correction_request"
  | "safe_harbor_scope";

const AUTHORIZATION = new Set<TrustIntakeAuthorizationBasis>(["public_contest", "active_bug_bounty", "written_permission"]);
const EVIDENCE_TYPES = new Set<TrustIntakeEvidenceType>(["finding_acknowledgement", "remediation_confirmation", "retest_confirmation", "rights_record", "correction_request", "safe_harbor_scope"]);
const EXACT_KEYS = new Set(["evidenceType", "authorizationBasis", "subjectId", "artifactSha256", "issuedAt", "embargoUntil", "publicDisclosureAllowed", "contact", "externalAcceptanceClaimed", "accreditedCertificationClaimed"]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const FORBIDDEN = /(BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|sk_(?:live|test)_|whsec_|Bearer\s+[A-Za-z0-9._-]{12,}|password\s*[:=]|secret\s*[:=]|token\s*[:=])/iu;

export type PublicTrustIntakeResult =
  | { ok: true; privateRecord: Record<string, unknown>; publicProjection: Record<string, unknown> }
  | { ok: false; code: string };

export function validatePublicTrustIntake(input: unknown, nowMs = Date.now()): PublicTrustIntakeResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, code: "trust_intake_object_required" };
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => !EXACT_KEYS.has(key))) return { ok: false, code: "trust_intake_unknown_field" };
  const evidenceType = record.evidenceType;
  const authorizationBasis = record.authorizationBasis;
  const subjectId = record.subjectId;
  const artifactSha256 = record.artifactSha256;
  const issuedAt = record.issuedAt;
  const embargoUntil = record.embargoUntil;
  const contact = record.contact;
  if (typeof evidenceType !== "string" || !EVIDENCE_TYPES.has(evidenceType as TrustIntakeEvidenceType)) return { ok: false, code: "trust_intake_evidence_type_invalid" };
  if (typeof authorizationBasis !== "string" || !AUTHORIZATION.has(authorizationBasis as TrustIntakeAuthorizationBasis)) return { ok: false, code: "trust_intake_authorization_missing" };
  if (typeof subjectId !== "string" || !SAFE_ID.test(subjectId)) return { ok: false, code: "trust_intake_subject_invalid" };
  if (typeof artifactSha256 !== "string" || !SHA256.test(artifactSha256)) return { ok: false, code: "trust_intake_artifact_digest_invalid" };
  if (typeof issuedAt !== "string") return { ok: false, code: "trust_intake_issued_at_invalid" };
  const issuedMs = Date.parse(issuedAt);
  if (!Number.isFinite(issuedMs) || new Date(issuedMs).toISOString() !== issuedAt || issuedMs > nowMs + 5 * 60_000 || issuedMs < nowMs - 366 * 24 * 60 * 60_000) return { ok: false, code: "trust_intake_issued_at_invalid" };
  let embargoMs: number | null = null;
  if (embargoUntil !== null && embargoUntil !== undefined) {
    if (typeof embargoUntil !== "string") return { ok: false, code: "trust_intake_embargo_invalid" };
    embargoMs = Date.parse(embargoUntil);
    if (!Number.isFinite(embargoMs) || new Date(embargoMs).toISOString() !== embargoUntil || embargoMs < issuedMs || embargoMs > issuedMs + 2 * 366 * 24 * 60 * 60_000) return { ok: false, code: "trust_intake_embargo_invalid" };
  }
  if (typeof record.publicDisclosureAllowed !== "boolean") return { ok: false, code: "trust_intake_publication_flag_invalid" };
  if (record.externalAcceptanceClaimed !== false || record.accreditedCertificationClaimed !== false) return { ok: false, code: "trust_intake_client_promotion_rejected" };
  if (typeof contact !== "string" || contact.length < 3 || contact.length > 320 || FORBIDDEN.test(contact) || ASCII_CONTROL_PATTERN.test(contact)) return { ok: false, code: "trust_intake_contact_invalid" };
  if (record.publicDisclosureAllowed && embargoMs !== null && embargoMs > nowMs) return { ok: false, code: "trust_intake_embargo_active" };
  const contactFingerprint = createPrivacyFingerprint(contact.trim().toLowerCase(), "trust-contact");
  const recordId = createHash("sha256").update(`${PASS36_A89_PUBLIC_TRUST_INTAKE_BOUNDARY_ID}:${evidenceType}:${authorizationBasis}:${subjectId}:${artifactSha256}:${issuedAt}`, "utf8").digest("hex");
  return {
    ok: true,
    privateRecord: {
      schemaVersion: PASS36_A89_PUBLIC_TRUST_INTAKE_BOUNDARY_ID,
      recordId,
      evidenceType,
      authorizationBasis,
      subjectId,
      artifactSha256,
      issuedAt,
      embargoUntil: embargoUntil ?? null,
      publicDisclosureAllowed: record.publicDisclosureAllowed,
      contactFingerprint,
      rawContactStored: false,
      externalAcceptanceVerified: false,
      accreditedCertification: false,
    },
    publicProjection: {
      schemaVersion: PASS36_A89_PUBLIC_TRUST_INTAKE_BOUNDARY_ID,
      recordId,
      evidenceType,
      authorizationBasis,
      subjectId,
      artifactSha256,
      issuedAt,
      publicationState: record.publicDisclosureAllowed ? "eligible_after_independent_verification" : "private_only",
      externallyAccepted: false,
      accreditedCertification: false,
    },
  };
}

export function inspectPublicTrustCenterReadiness() {
  return {
    schemaVersion: PASS36_A89_PUBLIC_TRUST_INTAKE_BOUNDARY_ID,
    mandatorySections: PASS36_A89_TRUST_CENTER_SECTION_IDS.length,
    sectionIds: PASS36_A89_TRUST_CENTER_SECTION_IDS,
    implementedPublicSections: 0,
    externallyAcceptedFindings: 0,
    remediationConfirmations: 0,
    retestConfirmations: 0,
    rightsApprovedRecords: 0,
    legalApprovals: 0,
    sellEnabled: false,
    boundary: "The intake contract cannot create an externally accepted finding, accredited certificate, provider right or legal approval. Those states require externally supplied, independently verified evidence.",
  } as const;
}
