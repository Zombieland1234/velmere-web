export const PASS4808_CLIENT_AUDIT_PDF_INTEGRITY_ID = "pass4808-account-bearer-pdf-byte-integrity-v1" as const;
export const PASS4808_MAX_PAID_AUDIT_PDF_BYTES = 8 * 1024 * 1024;

export type PaidAuditPdfTokenEnvelope = {
  ok: true;
  token: string;
  reportId: string;
  reportVersionHash: string;
  downloadPath: string;
  expiresAt: string;
  reportBinding: {
    auditCaseRef: string;
    tier: "pro" | "advanced";
    pdfDigest: string;
    snapshotDigest: string;
  };
  canonicalPreview: {
    parityMode: "exact_render_bound" | "legacy_layout_only";
    expectedPdf: {
      digest: string;
      byteLength: number;
    };
  };
  authorization: {
    mode: "bearer_header";
    header: "Authorization";
    scheme: "Bearer";
    queryTokenAllowed: false;
  };
};

export type PaidAuditPdfIntegrityVerdict =
  | { ok: true; digest: string; byteLength: number }
  | { ok: false; error: string };

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizePaidAuditPdfDigest(value: unknown) {
  const digest = cleanText(value, 80).toLowerCase();
  return /^sha256:[a-f0-9]{64}$/.test(digest) ? digest : "";
}

export function parsePaidAuditPdfTokenEnvelope(value: unknown): PaidAuditPdfTokenEnvelope | null {
  const root = recordOf(value);
  const binding = recordOf(root?.reportBinding);
  const preview = recordOf(root?.canonicalPreview);
  const expectedPdf = recordOf(preview?.expectedPdf);
  const authorization = recordOf(root?.authorization);
  const token = cleanText(root?.token, 16 * 1024);
  const reportId = cleanText(root?.reportId, 160);
  const reportVersionHash = cleanText(root?.reportVersionHash, 180);
  const downloadPath = cleanText(root?.downloadPath, 2_048);
  const expiresAt = cleanText(root?.expiresAt, 80);
  const auditCaseRef = cleanText(binding?.auditCaseRef, 160).toUpperCase();
  const tier = binding?.tier === "advanced" ? "advanced" : binding?.tier === "pro" ? "pro" : null;
  const pdfDigest = normalizePaidAuditPdfDigest(binding?.pdfDigest);
  const snapshotDigest = normalizePaidAuditPdfDigest(binding?.snapshotDigest);
  const previewDigest = normalizePaidAuditPdfDigest(expectedPdf?.digest);
  const byteLength = Number(expectedPdf?.byteLength);
  const parityMode = preview?.parityMode === "legacy_layout_only" ? "legacy_layout_only" : preview?.parityMode === "exact_render_bound" ? "exact_render_bound" : null;

  if (
    root?.ok !== true
    || !token
    || !reportId
    || !reportVersionHash
    || !downloadPath.startsWith("/api/security/audit-watch/pro-pdf?")
    || !expiresAt
    || !auditCaseRef
    || !tier
    || !pdfDigest
    || !snapshotDigest
    || !previewDigest
    || previewDigest !== pdfDigest
    || !Number.isSafeInteger(byteLength)
    || byteLength <= 0
    || byteLength > PASS4808_MAX_PAID_AUDIT_PDF_BYTES
    || !parityMode
    || authorization?.mode !== "bearer_header"
    || authorization?.header !== "Authorization"
    || authorization?.scheme !== "Bearer"
    || authorization?.queryTokenAllowed !== false
  ) return null;

  return {
    ok: true,
    token,
    reportId,
    reportVersionHash,
    downloadPath,
    expiresAt,
    reportBinding: { auditCaseRef, tier, pdfDigest, snapshotDigest },
    canonicalPreview: { parityMode, expectedPdf: { digest: previewDigest, byteLength } },
    authorization: {
      mode: "bearer_header",
      header: "Authorization",
      scheme: "Bearer",
      queryTokenAllowed: false,
    },
  };
}

export function assertSameOriginPaidAuditPdfPath(path: string, origin: string) {
  try {
    const url = new URL(path, origin);
    return url.origin === origin && url.pathname === "/api/security/audit-watch/pro-pdf" ? url.pathname + url.search : "";
  } catch {
    return "";
  }
}

export async function sha256DigestBrowser(bytes: Uint8Array) {
  if (!globalThis.crypto?.subtle) throw new Error("web_crypto_unavailable");
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", copied.buffer);
  return `sha256:${Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export async function verifyPaidAuditPdfBytes(args: {
  bytes: Uint8Array;
  expectedDigest: string;
  expectedByteLength: number;
  responseDigest?: string | null;
  contentType?: string | null;
}): Promise<PaidAuditPdfIntegrityVerdict> {
  const expectedDigest = normalizePaidAuditPdfDigest(args.expectedDigest);
  const responseDigest = args.responseDigest ? normalizePaidAuditPdfDigest(args.responseDigest) : expectedDigest;
  if (!expectedDigest || !responseDigest || responseDigest !== expectedDigest) return { ok: false, error: "audit_pdf_response_digest_binding_invalid" };
  if (!Number.isSafeInteger(args.expectedByteLength) || args.expectedByteLength <= 0 || args.expectedByteLength > PASS4808_MAX_PAID_AUDIT_PDF_BYTES) {
    return { ok: false, error: "audit_pdf_expected_length_invalid" };
  }
  if (args.bytes.byteLength !== args.expectedByteLength) return { ok: false, error: "audit_pdf_byte_length_mismatch" };
  if (args.bytes.byteLength > PASS4808_MAX_PAID_AUDIT_PDF_BYTES) return { ok: false, error: "audit_pdf_too_large" };
  if (args.contentType && !args.contentType.toLowerCase().startsWith("application/pdf")) return { ok: false, error: "audit_pdf_content_type_invalid" };
  if (args.bytes.byteLength < 8 || String.fromCharCode(...args.bytes.slice(0, 5)) !== "%PDF-") return { ok: false, error: "audit_pdf_magic_invalid" };
  const actualDigest = await sha256DigestBrowser(args.bytes);
  if (actualDigest !== expectedDigest) return { ok: false, error: "audit_pdf_sha256_mismatch" };
  return { ok: true, digest: actualDigest, byteLength: args.bytes.byteLength };
}
