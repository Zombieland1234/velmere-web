import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256BytesDigest, sha256Digest } from "@/lib/security/cryptographic-digest";
import { buildSafeDownloadDisposition } from "@/lib/security/download-response-boundary";
import type { LensReport, LensReportDepth } from "@/lib/search/lens-report";
import { isPdfTrailingWhitespace } from "@/lib/security/control-character-policy";
import { PASS4823_LENS_PDF_RENDERER_ID } from "@/lib/search/lens-pdf-renderer-identity";
import {
  P86_EXACT_IMMUTABLE_PDF_AVAILABLE,
  P86_PUBLIC_ACCOUNT_ARTIFACT_SCHEMA,
  parseP86PublicAccountArtifactDetail,
} from "@/lib/reporting/public-account-artifact-contract";

export const PASS36_A102R11_CLIENT_PDF_BLOB_BOUNDARY_ID =
  "velmere.pass36.a102r11.client-pdf-byte-binding-object-url-lifecycle.v1" as const;
export const PASS36_A102R11_MAX_CLIENT_PDF_BYTES = 16 * 1024 * 1024;
export const PASS36_A102R11_OBJECT_URL_REVOKE_DELAY_MS = 30_000;

export type ClientPdfHeaderReader = { get(name: string): string | null };
export type ClientPdfIntegrityVerdict =
  | {
      ok: true;
      pdfDigest: string;
      reportDigest: string;
      reportId: string;
      artifactDigest: string;
      byteLength: number;
      pageCount: number;
    }
  | { ok: false; error: string };

export type ClientPdfAccountArtifactBinding = {
  artifactId: string;
  route: string;
};

export type ClientPdfAccountArtifactBindingVerdict =
  | { ok: true; binding: ClientPdfAccountArtifactBinding | null }
  | { ok: false; error: string };

export type ClientPdfAccountArtifactReadback = ClientPdfAccountArtifactBinding & {
  accountRoute: string;
  previewRoute: string;
  downloadRoute: string;
};

export type ClientPdfAccountArtifactReadbackVerdict =
  | { ok: true; artifact: ClientPdfAccountArtifactReadback }
  | { ok: false; error: string };

type UrlApi = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
};

type DownloadAnchor = {
  href: string;
  download: string;
  rel: string;
  referrerPolicy: string;
  click(): void;
  remove(): void;
};

type DownloadDocument = {
  createElement(name: "a"): DownloadAnchor;
  body: { appendChild(anchor: DownloadAnchor): void };
};

function normalizeDigest(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  const hex = raw.startsWith("sha256:") ? raw.slice(7) : raw;
  return /^[a-f0-9]{64}$/.test(hex) ? `sha256:${hex}` : "";
}

function boundedHeader(headers: ClientPdfHeaderReader, name: string, max = 512) {
  const value = String(headers.get(name) ?? "").trim();
  return value.length <= max ? value : "";
}

const ACCOUNT_ARTIFACT_ID = /^[A-Za-z0-9._:-]{8,160}$/u;

function accountArtifactRoute(artifactId: string) {
  return `/api/account/customer-artifact?id=${encodeURIComponent(artifactId)}`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Treat the account artifact response headers as one atomic capability. An ID
 * without its exact same-origin detail route (or vice versa) is never accepted
 * as a durable-save claim.
 */
export function parseLensPdfAccountArtifactBinding(
  headers: ClientPdfHeaderReader,
): ClientPdfAccountArtifactBindingVerdict {
  const artifactId = boundedHeader(headers, "x-velmere-account-artifact-id", 180);
  const route = boundedHeader(headers, "x-velmere-account-artifact-route", 512);
  if (!artifactId && !route) return { ok: true, binding: null };
  if (!artifactId || !route) {
    return { ok: false, error: "lens_pdf_client_account_artifact_header_pair_incomplete" };
  }
  if (!ACCOUNT_ARTIFACT_ID.test(artifactId)) {
    return { ok: false, error: "lens_pdf_client_account_artifact_id_invalid" };
  }
  if (route !== accountArtifactRoute(artifactId)) {
    return { ok: false, error: "lens_pdf_client_account_artifact_route_invalid" };
  }
  return { ok: true, binding: { artifactId, route } };
}

/**
 * A browser may call a save verified only after the authenticated v3 detail
 * endpoint replays every immutable identity carried by the PDF response.
 */
export function verifyLensPdfAccountArtifactReadback(args: {
  payload: unknown;
  headers: ClientPdfHeaderReader;
  binding: ClientPdfAccountArtifactBinding;
  integrity: Extract<ClientPdfIntegrityVerdict, { ok: true }>;
  report: LensReport;
  depth: LensReportDepth;
  locale: "pl" | "en" | "de";
}): ClientPdfAccountArtifactReadbackVerdict {
  if (boundedHeader(args.headers, "x-velmere-contract", 128) !== P86_PUBLIC_ACCOUNT_ARTIFACT_SCHEMA) {
    return { ok: false, error: "lens_pdf_client_account_readback_contract_invalid" };
  }
  const parsed = parseP86PublicAccountArtifactDetail(args.payload);
  if (!parsed || !isPlainRecord((args.payload as { artifact?: unknown }).artifact)
    || !isPlainRecord(((args.payload as { artifact: Record<string, unknown> }).artifact).preview)) {
    return { ok: false, error: "lens_pdf_client_account_readback_schema_invalid" };
  }
  const artifact = parsed.artifact;
  const exactRoute = accountArtifactRoute(args.binding.artifactId);
  const previewRoute = `${exactRoute}&format=pdf&disposition=preview`;
  const downloadRoute = `${exactRoute}&format=pdf&disposition=download`;
  if (artifact.artifactId !== args.binding.artifactId || args.binding.route !== exactRoute) {
    return { ok: false, error: "lens_pdf_client_account_readback_id_mismatch" };
  }
  if (artifact.surface !== "lens"
    || artifact.reportId !== args.integrity.reportId
    || artifact.requestedTier !== args.depth
    || artifact.deliveredTier !== args.depth
    || artifact.locale !== args.locale
    || artifact.generatedAt !== args.report.generatedAt) {
    return { ok: false, error: "lens_pdf_client_account_readback_report_mismatch" };
  }
  if (normalizeDigest(artifact.integrityToken) !== args.integrity.artifactDigest
    || normalizeDigest(artifact.pdfSha256) !== args.integrity.pdfDigest
    || Number(artifact.pageCount) !== args.integrity.pageCount) {
    return { ok: false, error: "lens_pdf_client_account_readback_digest_mismatch" };
  }
  if (artifact.pdfAvailability !== P86_EXACT_IMMUTABLE_PDF_AVAILABLE
    || artifact.exactStoredPdf !== true
    || artifact.previewDownloadByteIdentical !== true
    || artifact.previewRoute !== previewRoute
    || artifact.downloadRoute !== downloadRoute) {
    return { ok: false, error: "lens_pdf_client_account_readback_delivery_invalid" };
  }
  return {
    ok: true,
    artifact: {
      artifactId: args.binding.artifactId,
      route: exactRoute,
      accountRoute: `/${args.locale}/account?artifact=${encodeURIComponent(args.binding.artifactId)}`,
      previewRoute,
      downloadRoute,
    },
  };
}

function hasPdfMagic(bytes: Uint8Array) {
  return bytes.byteLength >= 8
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}

function hasTerminalPdfEof(bytes: Uint8Array) {
  const tail = bytes.slice(Math.max(0, bytes.byteLength - 2048));
  const text = new TextDecoder("latin1").decode(tail);
  const marker = text.lastIndexOf("%%EOF");
  if (marker < 0) return false;
  return isPdfTrailingWhitespace(text.slice(marker + 5));
}

function expectedPageCount(depth: LensReportDepth, report: LensReport) {
  const count = Number(report.pass610?.pageCount);
  const allowed = depth === "basic" ? [2, 3] : depth === "pro" ? [4, 5, 6] : [8, 9, 10, 11, 12];
  return Number.isSafeInteger(count) && allowed.includes(count) ? count : 0;
}

export function verifyLensPdfResponseBytes(args: {
  bytes: Uint8Array;
  headers: ClientPdfHeaderReader;
  report: LensReport;
  depth: LensReportDepth;
}): ClientPdfIntegrityVerdict {
  const bytes = new Uint8Array(args.bytes);
  if (bytes.byteLength <= 0 || bytes.byteLength > PASS36_A102R11_MAX_CLIENT_PDF_BYTES) {
    return { ok: false, error: "lens_pdf_client_byte_budget_invalid" };
  }
  if (!hasPdfMagic(bytes)) return { ok: false, error: "lens_pdf_client_magic_invalid" };
  if (!hasTerminalPdfEof(bytes)) return { ok: false, error: "lens_pdf_client_eof_invalid" };

  const contentType = boundedHeader(args.headers, "content-type", 128).toLowerCase();
  if (!contentType.startsWith("application/pdf")) return { ok: false, error: "lens_pdf_client_content_type_invalid" };
  const declaredLengthText = boundedHeader(args.headers, "content-length", 32);
  if (declaredLengthText) {
    const declaredLength = Number(declaredLengthText);
    if (!Number.isSafeInteger(declaredLength) || declaredLength !== bytes.byteLength) {
      return { ok: false, error: "lens_pdf_client_content_length_mismatch" };
    }
  }

  if (args.report.selectedDepth !== args.depth || args.report.pass477?.selectedDepth !== args.depth) {
    return { ok: false, error: "lens_pdf_client_report_depth_invalid" };
  }
  const reportDigest = sha256Digest(canonicalJson(args.report));
  const reportId = `lens-report-${reportDigest.slice("sha256:".length)}`;
  const pdfDigest = sha256BytesDigest(bytes);
  const pageCount = expectedPageCount(args.depth, args.report);
  if (!pageCount) return { ok: false, error: "lens_pdf_client_expected_page_count_invalid" };

  if (normalizeDigest(boundedHeader(args.headers, "x-velmere-pdf-sha256", 96)) !== pdfDigest) {
    return { ok: false, error: "lens_pdf_client_sha256_mismatch" };
  }
  if (boundedHeader(args.headers, "x-velmere-report-id", 160) !== reportId) {
    return { ok: false, error: "lens_pdf_client_report_id_mismatch" };
  }
  if (normalizeDigest(boundedHeader(args.headers, "x-velmere-report-digest", 96)) !== reportDigest) {
    return { ok: false, error: "lens_pdf_client_report_digest_mismatch" };
  }
  if (normalizeDigest(boundedHeader(args.headers, "x-velmere-canonical-payload-digest", 96)) !== reportDigest) {
    return { ok: false, error: "lens_pdf_client_payload_digest_mismatch" };
  }
  const artifactDigest = normalizeDigest(boundedHeader(args.headers, "x-velmere-canonical-artifact-digest", 96));
  if (!artifactDigest) {
    return { ok: false, error: "lens_pdf_client_artifact_digest_invalid" };
  }
  if (boundedHeader(args.headers, "x-velmere-report-checksum", 256) !== String(args.report.brain?.checksum ?? "")) {
    return { ok: false, error: "lens_pdf_client_report_checksum_mismatch" };
  }
  if (boundedHeader(args.headers, "x-velmere-renderer-id", 160) !== PASS4823_LENS_PDF_RENDERER_ID) {
    return { ok: false, error: "lens_pdf_client_renderer_mismatch" };
  }
  if (boundedHeader(args.headers, "x-velmere-pdf-depth", 16) !== args.depth) {
    return { ok: false, error: "lens_pdf_client_depth_mismatch" };
  }
  if (Number(boundedHeader(args.headers, "x-velmere-pdf-page-count", 16)) !== pageCount) {
    return { ok: false, error: "lens_pdf_client_page_count_mismatch" };
  }
  if (boundedHeader(args.headers, "x-velmere-pdf-active-content", 32) !== "none") {
    return { ok: false, error: "lens_pdf_client_active_content_not_clean" };
  }
  if (boundedHeader(args.headers, "x-velmere-redaction", 32) !== "clean") {
    return { ok: false, error: "lens_pdf_client_redaction_not_clean" };
  }
  if (boundedHeader(args.headers, "x-velmere-preview-download-parity", 64) !== "same-blob-as-download") {
    return { ok: false, error: "lens_pdf_client_preview_download_parity_invalid" };
  }

  return { ok: true, pdfDigest, reportDigest, reportId, artifactDigest, byteLength: bytes.byteLength, pageCount };
}

export function buildSafeClientPdfFilename(filenameStem: string) {
  const normalizedStem = String(filenameStem ?? "").trim().replace(/\.pdf$/iu, "");
  return buildSafeDownloadDisposition({
    disposition: "attachment",
    filenameStem: normalizedStem,
    mediaKind: "pdf",
    fallbackStem: "velmere-report",
  }).filename;
}

export function createClientPdfObjectUrl(args: {
  bytes: Uint8Array;
  urlApi?: UrlApi;
}) {
  const bytes = new Uint8Array(args.bytes);
  if (bytes.byteLength <= 0 || bytes.byteLength > PASS36_A102R11_MAX_CLIENT_PDF_BYTES || !hasPdfMagic(bytes) || !hasTerminalPdfEof(bytes)) {
    throw new Error("client_pdf_object_url_bytes_invalid");
  }
  const urlApi = args.urlApi ?? URL;
  const url = urlApi.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  if (!url.startsWith("blob:")) {
    try { urlApi.revokeObjectURL(url); } catch { /* best-effort cleanup */ }
    throw new Error("client_pdf_object_url_invalid");
  }
  let revoked = false;
  return {
    url,
    revoke() {
      if (revoked) return;
      revoked = true;
      urlApi.revokeObjectURL(url);
    },
  };
}

export function triggerClientPdfDownload(args: {
  bytes: Uint8Array;
  filenameStem: string;
  urlApi?: UrlApi;
  documentApi?: DownloadDocument;
  schedule?: (callback: () => void, delayMs: number) => unknown;
}) {
  const objectUrl = createClientPdfObjectUrl({ bytes: args.bytes, urlApi: args.urlApi });
  try {
    const documentApi = args.documentApi ?? (document as unknown as DownloadDocument);
    const anchor = documentApi.createElement("a");
    anchor.href = objectUrl.url;
    anchor.download = buildSafeClientPdfFilename(args.filenameStem);
    anchor.rel = "noopener noreferrer";
    anchor.referrerPolicy = "no-referrer";
    documentApi.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    const schedule = args.schedule ?? ((callback, delayMs) => window.setTimeout(callback, delayMs));
    schedule(objectUrl.revoke, PASS36_A102R11_OBJECT_URL_REVOKE_DELAY_MS);
    return { ok: true as const, url: objectUrl.url, filename: anchor.download };
  } catch (error) {
    objectUrl.revoke();
    throw error;
  }
}
