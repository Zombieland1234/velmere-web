import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256BytesDigest, sha256Digest } from "@/lib/security/cryptographic-digest";
import { inspectPdfStructure } from "@/lib/reporting/pdf-structural-validation";
import {
  verifyPass4822AccountCustomerArtifactOwner,
  verifyPass4822AccountCustomerArtifactSnapshot,
  type AccountCustomerArtifactSnapshot,
} from "@/lib/reporting/account-customer-artifact-snapshot";

export const PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_BLOB_ID =
  "pass4824-account-customer-artifact-pdf-blob-v1" as const;
export const PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_MIME = "application/pdf" as const;
export const PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_MAX_BYTES = 8 * 1024 * 1024;

export type AccountCustomerArtifactPdfBlob = {
  schemaVersion: typeof PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_BLOB_ID;
  blobId: string;
  snapshotId: string;
  accountIdHash: string;
  surface: AccountCustomerArtifactSnapshot["surface"];
  reportId: string;
  artifactDigest: string;
  pdfDigest: string;
  pdfByteLength: number;
  mimeType: typeof PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_MIME;
  createdAt: string;
  recordDigest: string;
  pdfBytes: Uint8Array;
};

export type AccountCustomerArtifactPdfBlobMetadata = Omit<AccountCustomerArtifactPdfBlob, "pdfBytes">;
type UnsignedPdfBlobMetadata = Omit<AccountCustomerArtifactPdfBlobMetadata, "recordDigest">;

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function unsignedMetadata(metadata: UnsignedPdfBlobMetadata) {
  return {
    schemaVersion: metadata.schemaVersion,
    blobId: metadata.blobId,
    snapshotId: metadata.snapshotId,
    accountIdHash: metadata.accountIdHash,
    surface: metadata.surface,
    reportId: metadata.reportId,
    artifactDigest: metadata.artifactDigest,
    pdfDigest: metadata.pdfDigest,
    pdfByteLength: metadata.pdfByteLength,
    mimeType: metadata.mimeType,
    createdAt: metadata.createdAt,
  } as const;
}

export function buildPass4824AccountCustomerArtifactPdfBlob(args: {
  accountId: string;
  snapshot: AccountCustomerArtifactSnapshot;
  pdfBytes: Uint8Array;
}) {
  if (!verifyPass4822AccountCustomerArtifactSnapshot(args.snapshot)) {
    throw new Error("account_customer_artifact_pdf_snapshot_invalid");
  }
  if (!verifyPass4822AccountCustomerArtifactOwner(args.snapshot, args.accountId)) {
    throw new Error("account_customer_artifact_pdf_owner_mismatch");
  }
  const pdfBytes = new Uint8Array(args.pdfBytes);
  const structure = inspectPdfStructure(pdfBytes);
  if (!structure.headerValid) throw new Error("account_customer_artifact_pdf_header_invalid");
  if (!structure.valid) {
    throw new Error(`account_customer_artifact_pdf_structure_invalid:${structure.blockers.join(",")}`);
  }
  if (pdfBytes.byteLength > PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_MAX_BYTES) {
    throw new Error("account_customer_artifact_pdf_too_large");
  }
  const pdfDigest = sha256BytesDigest(pdfBytes);
  if (pdfDigest !== args.snapshot.canonicalArtifact.pdfDigest) {
    throw new Error("account_customer_artifact_pdf_digest_mismatch");
  }
  if (pdfBytes.byteLength !== args.snapshot.canonicalArtifact.pdfByteLength) {
    throw new Error("account_customer_artifact_pdf_length_mismatch");
  }
  const metadata: UnsignedPdfBlobMetadata = {
    schemaVersion: PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_BLOB_ID,
    blobId: `pdf-${args.snapshot.accountIdHash.slice(0, 16)}-${args.snapshot.canonicalArtifact.artifactDigest.slice(7)}`,
    snapshotId: args.snapshot.snapshotId,
    accountIdHash: args.snapshot.accountIdHash,
    surface: args.snapshot.surface,
    reportId: args.snapshot.reportId,
    artifactDigest: args.snapshot.canonicalArtifact.artifactDigest,
    pdfDigest,
    pdfByteLength: pdfBytes.byteLength,
    mimeType: PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_MIME,
    // The rendered artifact creation time is deterministic across retries.
    createdAt: args.snapshot.generatedAt,
  };
  return {
    ...metadata,
    recordDigest: sha256Digest(canonicalJson(unsignedMetadata(metadata))),
    pdfBytes,
  } satisfies AccountCustomerArtifactPdfBlob;
}

export function verifyPass4824AccountCustomerArtifactPdfBlob(
  value: unknown,
): value is AccountCustomerArtifactPdfBlob {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const blob = value as Partial<AccountCustomerArtifactPdfBlob>;
  if (!verifyPass4824AccountCustomerArtifactPdfBlobMetadata(blob)) return false;
  const pdfBytes = (value as Partial<AccountCustomerArtifactPdfBlob>).pdfBytes;
  if (!(pdfBytes instanceof Uint8Array)) return false;
  if (pdfBytes.byteLength !== blob.pdfByteLength || !inspectPdfStructure(pdfBytes).valid) return false;
  return sha256BytesDigest(pdfBytes) === blob.pdfDigest;
}

export function verifyPass4824AccountCustomerArtifactPdfBlobMetadata(
  value: unknown,
): value is AccountCustomerArtifactPdfBlobMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const blob = value as Partial<AccountCustomerArtifactPdfBlobMetadata>;
  if (blob.schemaVersion !== PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_BLOB_ID) return false;
  if (typeof blob.blobId !== "string" || !/^pdf-[a-f0-9]{16}-[a-f0-9]{64}$/.test(blob.blobId)) return false;
  if (typeof blob.snapshotId !== "string" || !blob.snapshotId.startsWith("artifact-") || blob.snapshotId.length > 180) return false;
  if (typeof blob.accountIdHash !== "string" || !/^[a-f0-9]{64}$/.test(blob.accountIdHash)) return false;
  if (blob.surface !== "audit" && blob.surface !== "shield" && blob.surface !== "real_markets" && blob.surface !== "lens") return false;
  if (typeof blob.reportId !== "string" || !blob.reportId || blob.reportId.length > 180) return false;
  if (!isDigest(blob.artifactDigest) || !isDigest(blob.pdfDigest) || !isDigest(blob.recordDigest)) return false;
  if (!Number.isSafeInteger(blob.pdfByteLength) || Number(blob.pdfByteLength) <= 0
    || Number(blob.pdfByteLength) > PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_MAX_BYTES) return false;
  if (blob.mimeType !== PASS4824_ACCOUNT_CUSTOMER_ARTIFACT_PDF_MIME) return false;
  if (blob.blobId !== `pdf-${blob.accountIdHash.slice(0, 16)}-${blob.artifactDigest.slice(7)}`) return false;
  let createdAt: string;
  try { createdAt = new Date(blob.createdAt!).toISOString(); } catch { return false; }
  if (createdAt !== blob.createdAt) return false;
  const metadata = unsignedMetadata({
    schemaVersion: blob.schemaVersion,
    blobId: blob.blobId,
    snapshotId: blob.snapshotId,
    accountIdHash: blob.accountIdHash,
    surface: blob.surface,
    reportId: blob.reportId,
    artifactDigest: blob.artifactDigest,
    pdfDigest: blob.pdfDigest,
    pdfByteLength: blob.pdfByteLength!,
    mimeType: blob.mimeType,
    createdAt,
  });
  return sha256Digest(canonicalJson(metadata)) === blob.recordDigest;
}

export function assertPass4824PdfBlobMetadataMatchesSnapshot(args: {
  blob: AccountCustomerArtifactPdfBlobMetadata;
  snapshot: AccountCustomerArtifactSnapshot;
  accountId: string;
}) {
  if (!verifyPass4824AccountCustomerArtifactPdfBlobMetadata(args.blob)) {
    throw new Error("account_customer_artifact_pdf_blob_metadata_invalid");
  }
  if (!verifyPass4822AccountCustomerArtifactOwner(args.snapshot, args.accountId)
    || args.blob.accountIdHash !== args.snapshot.accountIdHash) {
    throw new Error("account_customer_artifact_pdf_owner_immutable_conflict");
  }
  if (args.blob.snapshotId !== args.snapshot.snapshotId
    || args.blob.surface !== args.snapshot.surface
    || args.blob.reportId !== args.snapshot.reportId
    || args.blob.artifactDigest !== args.snapshot.canonicalArtifact.artifactDigest
    || args.blob.pdfDigest !== args.snapshot.canonicalArtifact.pdfDigest
    || args.blob.pdfByteLength !== args.snapshot.canonicalArtifact.pdfByteLength
    || args.blob.createdAt !== args.snapshot.generatedAt) {
    throw new Error("account_customer_artifact_pdf_immutable_conflict");
  }
  return args.blob;
}

export function assertPass4824PdfBlobMatchesSnapshot(args: {
  blob: AccountCustomerArtifactPdfBlob;
  snapshot: AccountCustomerArtifactSnapshot;
  accountId: string;
}) {
  if (!verifyPass4824AccountCustomerArtifactPdfBlob(args.blob)) {
    throw new Error("account_customer_artifact_pdf_blob_invalid");
  }
  assertPass4824PdfBlobMetadataMatchesSnapshot(args);
  return args.blob;
}
