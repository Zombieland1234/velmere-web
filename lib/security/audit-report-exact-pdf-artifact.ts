import { sha256BytesDigest, sha256Digest } from "@/lib/security/cryptographic-digest";
import { inspectPdfStructure } from "@/lib/reporting/pdf-structural-validation";
import type { ProAuditPdfSnapshot } from "@/lib/security/pro-audit-pdf/render-pro-audit-pdf";
import { PASS4808_PDF_RENDER_CONTRACT_ID } from "@/lib/security/pro-audit-pdf/customer-safe-renderer";

export const P88_AUDIT_EXACT_PDF_ARTIFACT_ID =
  "p88-audit-paid-exact-immutable-pdf-artifact-v1" as const;
export const P88_AUDIT_EXACT_PDF_MAX_BYTES = 4 * 1024 * 1024;
export const P88_AUDIT_EXACT_PDF_MIN_BYTES = 1_000;

const ACTIVE_PDF_TOKEN_PATTERN = /\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA)\b/i;

export type AuditExactPdfArtifactMetadata = Readonly<{
  schemaVersion: typeof P88_AUDIT_EXACT_PDF_ARTIFACT_ID;
  reportId: string;
  caseRef: string;
  requestId: string;
  accountIdHash: string;
  entitlementId: string;
  tier: "pro" | "advanced";
  targetHash: string;
  reportVersionHash: string;
  snapshotDigest: string;
  sourceReceiptRoot: string;
  pdfDigest: string;
  pdfByteLength: number;
  renderContractId: typeof PASS4808_PDF_RENDER_CONTRACT_ID;
  createdAt: string;
  recordDigest: string;
}>;

export type AuditExactPdfArtifact = AuditExactPdfArtifactMetadata & Readonly<{
  pdfBytes: Uint8Array;
}>;

type UnsignedMetadata = Omit<AuditExactPdfArtifactMetadata, "recordDigest">;

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

export function p88AuditExactPdfMetadataBindingText(metadata: UnsignedMetadata) {
  return [
    metadata.schemaVersion,
    metadata.reportId,
    metadata.caseRef,
    metadata.requestId,
    metadata.accountIdHash,
    metadata.entitlementId,
    metadata.tier,
    metadata.targetHash,
    metadata.reportVersionHash,
    metadata.snapshotDigest,
    metadata.sourceReceiptRoot,
    metadata.pdfDigest,
    String(metadata.pdfByteLength),
    metadata.renderContractId,
    metadata.createdAt,
  ].join("\n");
}

function exactMetadataDigest(metadata: UnsignedMetadata) {
  return sha256Digest(p88AuditExactPdfMetadataBindingText(metadata));
}

function hasCanonicalPdfTail(bytes: Uint8Array) {
  const tail = bytes.slice(Math.max(0, bytes.byteLength - 2_048));
  const text = new TextDecoder("latin1").decode(tail);
  const marker = text.lastIndexOf("%%EOF");
  if (marker < 0) return false;
  return Array.from(text.slice(marker + 5)).every((character) => (
    [9, 10, 12, 13, 32].includes(character.charCodeAt(0))
  ));
}

function assertNoActivePdfContent(bytes: Uint8Array) {
  const text = new TextDecoder("latin1").decode(bytes);
  if (ACTIVE_PDF_TOKEN_PATTERN.test(text)) throw new Error("audit_exact_pdf_active_content_forbidden");
}

export function assertP88AuditExactPdfBytes(args: {
  snapshot: ProAuditPdfSnapshot;
  pdfBytes: Uint8Array;
  expectedDigest?: string;
  expectedByteLength?: number;
  expectedRenderContractId?: string;
}) {
  const bytes = new Uint8Array(args.pdfBytes);
  if (bytes.byteLength < P88_AUDIT_EXACT_PDF_MIN_BYTES || bytes.byteLength > P88_AUDIT_EXACT_PDF_MAX_BYTES) {
    throw new Error("audit_exact_pdf_byte_budget_invalid");
  }
  const structure = inspectPdfStructure(bytes);
  if (!structure.headerValid) throw new Error("audit_exact_pdf_header_invalid");
  if (!structure.valid) throw new Error(`audit_exact_pdf_structure_invalid:${structure.blockers.join(",")}`);
  if (!hasCanonicalPdfTail(bytes)) throw new Error("audit_exact_pdf_eof_invalid");
  assertNoActivePdfContent(bytes);

  const contract = args.snapshot.renderContract;
  if (!contract || contract.id !== PASS4808_PDF_RENDER_CONTRACT_ID) {
    throw new Error("audit_exact_pdf_render_contract_missing");
  }
  const digest = sha256BytesDigest(bytes);
  if (digest !== contract.pdfDigest) throw new Error("audit_exact_pdf_snapshot_digest_mismatch");
  if (bytes.byteLength !== contract.pdfByteLength) throw new Error("audit_exact_pdf_snapshot_length_mismatch");
  if (args.expectedDigest !== undefined && digest !== args.expectedDigest) {
    throw new Error("audit_exact_pdf_stored_digest_mismatch");
  }
  if (args.expectedByteLength !== undefined && bytes.byteLength !== args.expectedByteLength) {
    throw new Error("audit_exact_pdf_stored_length_mismatch");
  }
  if (args.expectedRenderContractId !== undefined && contract.id !== args.expectedRenderContractId) {
    throw new Error("audit_exact_pdf_stored_render_contract_mismatch");
  }
  return { bytes, pdfDigest: digest, pdfByteLength: bytes.byteLength, renderContractId: contract.id } as const;
}

export function encodeP88AuditExactPdfBase64(value: Uint8Array) {
  const bytes = new Uint8Array(value);
  if (!bytes.byteLength || bytes.byteLength > P88_AUDIT_EXACT_PDF_MAX_BYTES) {
    throw new Error("audit_exact_pdf_base64_byte_budget_invalid");
  }
  return Buffer.from(bytes).toString("base64");
}

export function decodeP88AuditExactPdfBase64(value: unknown) {
  if (typeof value !== "string"
    || value.length < 4
    || value.length > Math.ceil(P88_AUDIT_EXACT_PDF_MAX_BYTES / 3) * 4 + 4
    || value.length % 4 !== 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("audit_exact_pdf_base64_noncanonical");
  }
  const bytes = new Uint8Array(Buffer.from(value, "base64"));
  if (Buffer.from(bytes).toString("base64") !== value) {
    throw new Error("audit_exact_pdf_base64_noncanonical");
  }
  return bytes;
}

export function decodeP88StoredAuditExactPdfBytes(value: unknown) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  if (typeof value !== "string") throw new Error("audit_exact_pdf_stored_bytes_invalid");
  if (value.startsWith("\\x")) {
    const hex = value.slice(2);
    if (!hex || hex.length % 2 !== 0 || !/^[a-f0-9]+$/i.test(hex)) {
      throw new Error("audit_exact_pdf_stored_bytes_invalid");
    }
    return new Uint8Array(Buffer.from(hex, "hex"));
  }
  return decodeP88AuditExactPdfBase64(value);
}

export function buildP88AuditExactPdfArtifact(args: Omit<UnsignedMetadata,
  "schemaVersion" | "pdfDigest" | "pdfByteLength" | "renderContractId"> & {
    snapshot: ProAuditPdfSnapshot;
    pdfBytes: Uint8Array;
  }): AuditExactPdfArtifact {
  const exact = assertP88AuditExactPdfBytes({ snapshot: args.snapshot, pdfBytes: args.pdfBytes });
  const metadata: UnsignedMetadata = {
    schemaVersion: P88_AUDIT_EXACT_PDF_ARTIFACT_ID,
    reportId: args.reportId,
    caseRef: args.caseRef,
    requestId: args.requestId,
    accountIdHash: args.accountIdHash,
    entitlementId: args.entitlementId,
    tier: args.tier,
    targetHash: args.targetHash,
    reportVersionHash: args.reportVersionHash,
    snapshotDigest: args.snapshotDigest,
    sourceReceiptRoot: args.sourceReceiptRoot,
    pdfDigest: exact.pdfDigest,
    pdfByteLength: exact.pdfByteLength,
    renderContractId: exact.renderContractId,
    createdAt: args.createdAt,
  };
  return {
    ...metadata,
    recordDigest: exactMetadataDigest(metadata),
    pdfBytes: exact.bytes,
  };
}

export function verifyP88AuditExactPdfArtifact(value: unknown, snapshot: ProAuditPdfSnapshot): value is AuditExactPdfArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const artifact = value as Partial<AuditExactPdfArtifact>;
  if (artifact.schemaVersion !== P88_AUDIT_EXACT_PDF_ARTIFACT_ID
    || typeof artifact.reportId !== "string" || !artifact.reportId
    || typeof artifact.caseRef !== "string" || !artifact.caseRef
    || typeof artifact.requestId !== "string" || !artifact.requestId
    || typeof artifact.accountIdHash !== "string" || !/^[a-f0-9]{64}$/.test(artifact.accountIdHash)
    || typeof artifact.entitlementId !== "string" || !artifact.entitlementId
    || (artifact.tier !== "pro" && artifact.tier !== "advanced")
    || !isSha256(artifact.targetHash)
    || !isSha256(artifact.reportVersionHash)
    || !isSha256(artifact.snapshotDigest)
    || !isSha256(artifact.sourceReceiptRoot)
    || !isSha256(artifact.pdfDigest)
    || artifact.renderContractId !== PASS4808_PDF_RENDER_CONTRACT_ID
    || typeof artifact.createdAt !== "string"
    || !isSha256(artifact.recordDigest)
    || !(artifact.pdfBytes instanceof Uint8Array)) return false;
  if (!Number.isSafeInteger(artifact.pdfByteLength)
    || artifact.pdfByteLength! < P88_AUDIT_EXACT_PDF_MIN_BYTES
    || artifact.pdfByteLength! > P88_AUDIT_EXACT_PDF_MAX_BYTES) return false;
  try {
    const exact = assertP88AuditExactPdfBytes({
      snapshot,
      pdfBytes: artifact.pdfBytes,
      expectedDigest: artifact.pdfDigest,
      expectedByteLength: artifact.pdfByteLength,
      expectedRenderContractId: artifact.renderContractId,
    });
    if (exact.pdfDigest !== artifact.pdfDigest || exact.pdfByteLength !== artifact.pdfByteLength) return false;
    const metadata: UnsignedMetadata = {
      schemaVersion: artifact.schemaVersion,
      reportId: artifact.reportId,
      caseRef: artifact.caseRef,
      requestId: artifact.requestId,
      accountIdHash: artifact.accountIdHash,
      entitlementId: artifact.entitlementId,
      tier: artifact.tier,
      targetHash: artifact.targetHash,
      reportVersionHash: artifact.reportVersionHash,
      snapshotDigest: artifact.snapshotDigest,
      sourceReceiptRoot: artifact.sourceReceiptRoot,
      pdfDigest: artifact.pdfDigest,
      pdfByteLength: artifact.pdfByteLength,
      renderContractId: artifact.renderContractId,
      createdAt: artifact.createdAt,
    };
    return exactMetadataDigest(metadata) === artifact.recordDigest;
  } catch {
    return false;
  }
}
