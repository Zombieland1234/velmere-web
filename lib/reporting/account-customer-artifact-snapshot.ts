import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import { assertPass4824PayloadFieldPacket } from "@/lib/reporting/canonical-field-registry";
import { assertPass6PaidCommercialCompleteness } from "@/lib/reporting/commercial-field-completeness";
import {
  verifyCanonicalCustomerArtifact,
  type CanonicalCustomerArtifact,
  type CanonicalCustomerArtifactSurface,
} from "@/lib/reporting/canonical-customer-artifact";

export const PASS4822_ACCOUNT_CUSTOMER_ARTIFACT_SNAPSHOT_ID = "pass4822-account-customer-artifact-snapshot-v1" as const;
export const PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE = "exact_immutable_blob" as const;
export const P86_ACCOUNT_CUSTOMER_ARTIFACT_NEW_WRITE_EXACT_PDF_REQUIRED =
  "p86-account-customer-artifact-new-write-exact-pdf-required-v1" as const;

export type AccountCustomerArtifactPayloadKind =
  | "market_customer_report_v1"
  | "lens_report_v1"
  | "audit_customer_report_v1";

export type AccountCustomerArtifactSnapshot = {
  schemaVersion: typeof PASS4822_ACCOUNT_CUSTOMER_ARTIFACT_SNAPSHOT_ID;
  snapshotId: string;
  accountIdHash: string;
  surface: CanonicalCustomerArtifactSurface;
  payloadKind: AccountCustomerArtifactPayloadKind;
  reportId: string;
  requestedTier: string;
  deliveredTier: string | null;
  locale: "pl" | "en" | "de";
  title: string;
  subject: string;
  generatedAt: string;
  payload: unknown;
  payloadDigest: string;
  canonicalArtifact: CanonicalCustomerArtifact;
  /**
   * Absent only on snapshots created before the exact-PDF contract. Presence is
   * covered by snapshotDigest and makes a missing immutable blob fail closed.
   */
  pdfStorage?: typeof PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE;
  snapshotDigest: string;
};

const LEGACY_SNAPSHOT_KEYS = Object.freeze([
  "accountIdHash", "canonicalArtifact", "deliveredTier", "generatedAt", "locale", "payload",
  "payloadDigest", "payloadKind", "reportId", "requestedTier", "schemaVersion", "snapshotDigest",
  "snapshotId", "subject", "surface", "title",
] as const);
const EXACT_PDF_SNAPSHOT_KEYS = Object.freeze([...LEGACY_SNAPSHOT_KEYS, "pdfStorage"].sort());

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function validDigest(value: unknown) {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
}

function validLocale(value: unknown): value is AccountCustomerArtifactSnapshot["locale"] {
  return value === "pl" || value === "en" || value === "de";
}

function validPayloadKind(value: unknown): value is AccountCustomerArtifactPayloadKind {
  return value === "market_customer_report_v1"
    || value === "lens_report_v1"
    || value === "audit_customer_report_v1";
}

function validSurfacePayloadKind(
  surface: CanonicalCustomerArtifactSurface,
  payloadKind: AccountCustomerArtifactPayloadKind,
) {
  return (
    (surface === "lens" && payloadKind === "lens_report_v1")
    || ((surface === "shield" || surface === "real_markets") && payloadKind === "market_customer_report_v1")
    || (surface === "audit" && payloadKind === "audit_customer_report_v1")
  );
}

export function buildPass4822AccountCustomerArtifactSnapshot(args: {
  accountId: string;
  surface: CanonicalCustomerArtifactSurface;
  payloadKind: AccountCustomerArtifactPayloadKind;
  reportId: string;
  requestedTier: string;
  deliveredTier: string | null;
  locale: "pl" | "en" | "de";
  title: string;
  subject: string;
  generatedAt: string;
  payload: unknown;
  canonicalArtifact: CanonicalCustomerArtifact;
  pdfStorage?: typeof PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE;
}) {
  // P86: every newly constructed account artifact is a PDF-bearing customer
  // artifact and must bind the exact immutable bytes at creation. Legacy rows
  // remain readable for compatibility, but this builder cannot create another
  // deterministic-rerender obligation.
  if (args.pdfStorage !== PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE) {
    if (args.payloadKind === "audit_customer_report_v1" && args.surface === "audit") {
      throw new Error("account_customer_artifact_audit_exact_pdf_required");
    }
    throw new Error("account_customer_artifact_new_write_exact_pdf_required");
  }
  const usesMarketFieldContract = args.payloadKind === "market_customer_report_v1"
    && (args.surface === "shield" || args.surface === "real_markets");
  const usesAuditFieldContract = args.payloadKind === "audit_customer_report_v1"
    && args.surface === "audit";
  // Lens is validated by its frozen report, claim graph and canonical Lens
  // artifact contract. The market field registry is a separate schema.
  if (usesMarketFieldContract) {
    assertPass4824PayloadFieldPacket(args.payload, {
      module: args.surface === "real_markets" ? "real_markets" : "shield",
      tier: args.deliveredTier ?? args.requestedTier,
      requirePresent: true,
    });
    assertPass6PaidCommercialCompleteness(args.payload, args.requestedTier);
  }
  if (usesAuditFieldContract) {
    if (args.pdfStorage !== PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE) {
      throw new Error("account_customer_artifact_audit_exact_pdf_required");
    }
    if (args.deliveredTier === null) throw new Error("account_customer_artifact_audit_delivered_tier_required");
    assertPass4824PayloadFieldPacket(args.payload, {
      module: "audit",
      tier: args.deliveredTier,
      requirePresent: true,
    });
  }
  if (!verifyCanonicalCustomerArtifact(args.canonicalArtifact)) throw new Error("account_customer_artifact_invalid");
  if (args.canonicalArtifact.surface !== args.surface) throw new Error("account_customer_artifact_surface_mismatch");
  const reportId = clean(args.reportId, 180);
  const requestedTier = clean(args.requestedTier, 48);
  const deliveredTier = args.deliveredTier === null ? null : clean(args.deliveredTier, 48);
  const title = clean(args.title, 240);
  const subject = clean(args.subject, 180);
  const generatedAt = new Date(args.generatedAt).toISOString();
  if (!reportId || !requestedTier || !title || !subject || !validLocale(args.locale) || !validPayloadKind(args.payloadKind)) {
    throw new Error("account_customer_artifact_identity_invalid");
  }
  if (!validSurfacePayloadKind(args.surface, args.payloadKind)) {
    throw new Error("account_customer_artifact_surface_payload_kind_mismatch");
  }
  const payloadDigest = sha256Digest(canonicalJson(args.payload));
  if (payloadDigest !== args.canonicalArtifact.payloadDigest) throw new Error("account_customer_artifact_payload_digest_mismatch");
  if (args.canonicalArtifact.reportId !== reportId || args.canonicalArtifact.requestedTier !== requestedTier || args.canonicalArtifact.deliveredTier !== deliveredTier) {
    throw new Error("account_customer_artifact_contract_mismatch");
  }
  const accountIdHash = hashVelmereAccountBinding(args.accountId);
  const artifactDigestHex = args.canonicalArtifact.artifactDigest.replace(/^sha256:/, "");
  const snapshotId = `artifact-${args.surface}-${accountIdHash.slice(0, 16)}-${artifactDigestHex}`;
  if (args.pdfStorage !== undefined && args.pdfStorage !== PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE) {
    throw new Error("account_customer_artifact_pdf_storage_invalid");
  }
  const unsigned = {
    schemaVersion: PASS4822_ACCOUNT_CUSTOMER_ARTIFACT_SNAPSHOT_ID,
    snapshotId,
    accountIdHash,
    surface: args.surface,
    payloadKind: args.payloadKind,
    reportId,
    requestedTier,
    deliveredTier,
    locale: args.locale,
    title,
    subject,
    generatedAt,
    payload: args.payload,
    payloadDigest,
    canonicalArtifact: args.canonicalArtifact,
    ...(args.pdfStorage === PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE
      ? { pdfStorage: PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE }
      : {}),
  } as const;
  return { ...unsigned, snapshotDigest: sha256Digest(canonicalJson(unsigned)) } satisfies AccountCustomerArtifactSnapshot;
}

export function verifyPass4822AccountCustomerArtifactSnapshot(value: unknown): value is AccountCustomerArtifactSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<AccountCustomerArtifactSnapshot>;
  if (snapshot.schemaVersion !== PASS4822_ACCOUNT_CUSTOMER_ARTIFACT_SNAPSHOT_ID) return false;
  if (!snapshot.snapshotId || !snapshot.accountIdHash || !snapshot.reportId || !snapshot.requestedTier || !snapshot.title || !snapshot.subject) return false;
  if (!/^[a-f0-9]{64}$/i.test(snapshot.accountIdHash) || !validDigest(snapshot.payloadDigest) || !validDigest(snapshot.snapshotDigest)) return false;
  if (!validLocale(snapshot.locale) || !validPayloadKind(snapshot.payloadKind) || !verifyCanonicalCustomerArtifact(snapshot.canonicalArtifact)) return false;
  if (!snapshot.surface || !validSurfacePayloadKind(snapshot.surface, snapshot.payloadKind)) return false;
  if (snapshot.pdfStorage !== undefined && snapshot.pdfStorage !== PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE) return false;
  if (snapshot.surface === "audit" && snapshot.pdfStorage !== PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE) return false;
  const expectedKeys = snapshot.pdfStorage === PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE
    ? EXACT_PDF_SNAPSHOT_KEYS
    : LEGACY_SNAPSHOT_KEYS;
  const keys = Object.keys(snapshot).sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) return false;
  try {
    if (snapshot.pdfStorage === PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE
      && snapshot.payloadKind === "market_customer_report_v1"
      && (snapshot.surface === "shield" || snapshot.surface === "real_markets")) {
      assertPass4824PayloadFieldPacket(snapshot.payload, {
        module: snapshot.surface === "real_markets" ? "real_markets" : "shield",
        tier: snapshot.deliveredTier ?? snapshot.requestedTier,
        requirePresent: true,
      });
      assertPass6PaidCommercialCompleteness(snapshot.payload, snapshot.requestedTier!);
    }
    if (snapshot.pdfStorage === PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE
      && snapshot.payloadKind === "audit_customer_report_v1"
      && snapshot.surface === "audit") {
      if (snapshot.deliveredTier === null || snapshot.deliveredTier === undefined) return false;
      assertPass4824PayloadFieldPacket(snapshot.payload, {
        module: "audit",
        tier: snapshot.deliveredTier,
        requirePresent: true,
      });
    }
  } catch {
    return false;
  }
  if (snapshot.canonicalArtifact.surface !== snapshot.surface || snapshot.canonicalArtifact.payloadDigest !== snapshot.payloadDigest) return false;
  try {
    const generatedAt = new Date(snapshot.generatedAt!).toISOString();
    const payloadDigest = sha256Digest(canonicalJson(snapshot.payload));
    if (payloadDigest !== snapshot.payloadDigest) return false;
    if (snapshot.canonicalArtifact.reportId !== snapshot.reportId) return false;
    if (snapshot.canonicalArtifact.requestedTier !== snapshot.requestedTier) return false;
    if (snapshot.canonicalArtifact.deliveredTier !== (snapshot.deliveredTier ?? null)) return false;
    const artifactDigestHex = snapshot.canonicalArtifact.artifactDigest.replace(/^sha256:/, "");
    const expectedSnapshotId = `artifact-${snapshot.surface}-${snapshot.accountIdHash.slice(0, 16)}-${artifactDigestHex}`;
    // Read-only compatibility for PASS4822 rows. Every new PASS4823 snapshot uses
    // the complete artifact digest, removing the old 160-bit prefix collision.
    const legacySnapshotId = `artifact-${snapshot.surface}-${snapshot.accountIdHash.slice(0, 16)}-${artifactDigestHex.slice(0, 40)}`;
    if (snapshot.snapshotId !== expectedSnapshotId && snapshot.snapshotId !== legacySnapshotId) return false;
    const unsigned = {
      schemaVersion: snapshot.schemaVersion,
      snapshotId: snapshot.snapshotId,
      accountIdHash: snapshot.accountIdHash,
      surface: snapshot.surface,
      payloadKind: snapshot.payloadKind,
      reportId: snapshot.reportId,
      requestedTier: snapshot.requestedTier,
      deliveredTier: snapshot.deliveredTier ?? null,
      locale: snapshot.locale,
      title: snapshot.title,
      subject: snapshot.subject,
      generatedAt,
      payload: snapshot.payload,
      payloadDigest: snapshot.payloadDigest,
      canonicalArtifact: snapshot.canonicalArtifact,
      ...(snapshot.pdfStorage === PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE
        ? { pdfStorage: PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE }
        : {}),
    };
    return sha256Digest(canonicalJson(unsigned)) === snapshot.snapshotDigest;
  } catch {
    return false;
  }
}

export function isPass4824ExactPdfAccountCustomerArtifactSnapshot(
  snapshot: AccountCustomerArtifactSnapshot,
) {
  return snapshot.pdfStorage === PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_EXACT_PDF_STORAGE;
}

export function verifyPass4822AccountCustomerArtifactOwner(snapshot: AccountCustomerArtifactSnapshot, accountId: string) {
  return snapshot.accountIdHash === hashVelmereAccountBinding(accountId);
}
