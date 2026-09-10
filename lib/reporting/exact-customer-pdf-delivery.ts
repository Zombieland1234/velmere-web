import { sha256BytesDigest } from "@/lib/security/cryptographic-digest";
import { buildSafeDownloadDisposition, type DownloadDisposition } from "@/lib/security/download-response-boundary";
import { inspectPdfStructure } from "@/lib/reporting/pdf-structural-validation";

export const VELMERE_EXACT_CUSTOMER_PDF_DELIVERY_SCHEMA = "velmere.exact-customer-pdf-delivery.v1" as const;

export type ExactCustomerPdfDelivery = Readonly<{
  schemaVersion: typeof VELMERE_EXACT_CUSTOMER_PDF_DELIVERY_SCHEMA;
  disposition: DownloadDisposition;
  bytes: Uint8Array<ArrayBuffer>;
  pdfSha256: string;
  byteLength: number;
  headers: Readonly<Record<string, string>>;
}>;

export function buildExactCustomerPdfDelivery(args: {
  pdfBytes: Uint8Array;
  expectedPdfSha256: string;
  disposition: DownloadDisposition;
  filenameStem: string;
  fallbackStem?: string;
}): ExactCustomerPdfDelivery {
  // Constructing from the array-like view creates an owned ArrayBuffer-backed
  // copy. Besides preventing mutation of stored bytes, this is the exact DOM
  // BodyInit shape accepted by Response (SharedArrayBuffer is not eligible).
  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(args.pdfBytes);
  const structure = inspectPdfStructure(bytes);
  if (!structure.headerValid) throw new Error("exact_customer_pdf_header_invalid");
  if (!structure.valid) {
    throw new Error(`exact_customer_pdf_structure_invalid:${structure.blockers.join(",")}`);
  }
  const pdfSha256 = sha256BytesDigest(bytes);
  if (pdfSha256 !== args.expectedPdfSha256) throw new Error("exact_customer_pdf_digest_mismatch");
  const download = buildSafeDownloadDisposition({
    disposition: args.disposition,
    filenameStem: args.filenameStem,
    mediaKind: "pdf",
    fallbackStem: args.fallbackStem ?? "Velmere-report",
  });
  return {
    schemaVersion: VELMERE_EXACT_CUSTOMER_PDF_DELIVERY_SCHEMA,
    disposition: args.disposition,
    bytes,
    pdfSha256,
    byteLength: bytes.byteLength,
    headers: {
      "content-type": download.contentType,
      "content-length": String(bytes.byteLength),
      "content-disposition": download.contentDisposition,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "x-velmere-document-contract": VELMERE_EXACT_CUSTOMER_PDF_DELIVERY_SCHEMA,
      "x-velmere-pdf-sha256": pdfSha256,
    },
  };
}

export function verifyExactCustomerPdfPreviewDownloadPair(args: {
  pdfBytes: Uint8Array;
  expectedPdfSha256: string;
  filenameStem: string;
  fallbackStem?: string;
}) {
  const preview = buildExactCustomerPdfDelivery({ ...args, disposition: "inline" });
  const download = buildExactCustomerPdfDelivery({ ...args, disposition: "attachment" });
  const byteIdentical = preview.bytes.byteLength === download.bytes.byteLength
    && preview.bytes.every((byte, index) => byte === download.bytes[index]);
  return {
    schemaVersion: "velmere.exact-customer-pdf-parity-receipt.v1" as const,
    previewSha256: preview.pdfSha256,
    downloadSha256: download.pdfSha256,
    byteIdentical,
    contentDispositionDifferent: preview.headers["content-disposition"] !== download.headers["content-disposition"],
    pass: byteIdentical
      && preview.pdfSha256 === download.pdfSha256
      && preview.pdfSha256 === args.expectedPdfSha256
      && preview.disposition === "inline"
      && download.disposition === "attachment",
  };
}
