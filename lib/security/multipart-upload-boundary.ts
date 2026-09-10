import { createHash } from "node:crypto";

export const PASS36_A70_MULTIPART_UPLOAD_BOUNDARY_ID =
  "velmere.pass36.a70.multipart-upload-boundary.v1" as const;

export type ContactUploadErrorCode =
  | "contact_upload_content_type_invalid"
  | "contact_upload_boundary_invalid"
  | "contact_upload_transfer_encoding_forbidden"
  | "contact_upload_nested_multipart_forbidden"
  | "contact_upload_entry_limit_exceeded"
  | "contact_upload_unknown_field"
  | "contact_upload_duplicate_field"
  | "contact_upload_text_field_type_invalid"
  | "contact_upload_text_field_too_large"
  | "contact_upload_text_field_control_character"
  | "contact_upload_attachment_type_invalid"
  | "contact_upload_attachment_count_exceeded"
  | "contact_upload_attachment_name_invalid"
  | "contact_upload_attachment_too_large"
  | "contact_upload_attachment_empty"
  | "contact_upload_attachment_media_mismatch"
  | "contact_upload_attachment_structure_invalid"
  | "contact_upload_attachment_active_content"
  | "contact_upload_attachment_dimensions_invalid";

export class ContactUploadBoundaryError extends Error {
  readonly code: ContactUploadErrorCode;
  readonly status: 400 | 413 | 415 | 422;

  constructor(code: ContactUploadErrorCode, status: 400 | 413 | 415 | 422, message: string = code) {
    super(message);
    this.name = "ContactUploadBoundaryError";
    this.code = code;
    this.status = status;
  }
}

export type ContactUploadFields = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export type PassiveContactAttachmentInspection = {
  readonly kind: "pdf" | "png" | "jpeg";
  readonly contentType: "application/pdf" | "image/png" | "image/jpeg";
  readonly extension: "pdf" | "png" | "jpg" | "jpeg";
  readonly safeFilename: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly pageCountClaimed: null;
  readonly structuralChecks: readonly string[];
};

export type StrictContactFormInspection = {
  readonly fields: ContactUploadFields;
  readonly attachment: File | null;
  readonly entryCount: number;
};

const FIELD_NAMES = new Set(["name", "email", "subject", "message", "attachment"]);
const TEXT_LIMITS = Object.freeze({
  name: 480,
  email: 640,
  subject: 720,
  message: 24_000,
});
const MAX_FORM_ENTRIES = 5;
const MAX_IMAGE_DIMENSION = 12_000;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_PNG_CHUNKS = 20_000;
const ALLOWED_PNG_CRITICAL_CHUNKS = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);
const DANGEROUS_PDF_NAMES = new Set([
  "javascript",
  "js",
  "launch",
  "embeddedfile",
  "embeddedfiles",
  "openaction",
  "aa",
  "acroform",
  "xfa",
  "richmedia",
  "filespec",
  "encrypt",
]);

function fail(code: ContactUploadErrorCode, status: 400 | 413 | 415 | 422, message?: string): never {
  throw new ContactUploadBoundaryError(code, status, message);
}

function utf8Bytes(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function normalizedMediaType(value: string | null | undefined) {
  return String(value ?? "").split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function isFileValue(value: FormDataEntryValue): value is File {
  return typeof value !== "string";
}

function containsAsciiControl(value: string, allowLineBreaks = false) {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code === 0x7f) return true;
    if (code < 0x20 && !(allowLineBreaks && (code === 0x0a || code === 0x0d))) {
      return true;
    }
  }
  return false;
}

function containsForbiddenControl(value: string, allowLineBreaks: boolean) {
  return containsAsciiControl(value, allowLineBreaks);
}

function containsBidiControl(value: string) {
  return /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u.test(value);
}

function basename(value: string) {
  const segments = value.split(/[\\/]/u);
  return segments.at(-1) ?? "";
}

function extensionOf(value: string) {
  const index = value.lastIndexOf(".");
  return index >= 0 ? value.slice(index + 1).toLowerCase() : "";
}

export function normalizeContactAttachmentFilename(value: string) {
  const original = basename(String(value ?? "")).trim();
  if (!original || containsForbiddenControl(original, false) || containsBidiControl(original)) {
    fail("contact_upload_attachment_name_invalid", 415);
  }
  const normalized = original
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._ -]/gu, "_")
    .replace(/[. ]{2,}/gu, ".")
    .replace(/^[. ]+|[. ]+$/gu, "")
    .slice(0, 96);
  if (!normalized || normalized === "." || normalized === ".." || !extensionOf(normalized)) {
    fail("contact_upload_attachment_name_invalid", 415);
  }
  return normalized;
}

export function validateContactFormContentType(
  contentType: string | null | undefined,
  options: { allowUrlEncoded?: boolean } = {},
) {
  const raw = String(contentType ?? "").trim();
  const mediaType = raw.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (mediaType === "application/x-www-form-urlencoded") {
    if (
      options.allowUrlEncoded === false
      || raw.toLowerCase() !== "application/x-www-form-urlencoded"
      || containsAsciiControl(raw)
    ) {
      fail("contact_upload_content_type_invalid", 415);
    }
    return { mediaType, boundary: null } as const;
  }
  if (mediaType !== "multipart/form-data") {
    fail("contact_upload_content_type_invalid", 415);
  }
  if (
    raw.length > 240
    || containsAsciiControl(raw)
    || raw.includes(",")
    || (raw.match(/\bboundary\s*=/giu)?.length ?? 0) > 1
  ) {
    fail("contact_upload_content_type_invalid", 415);
  }
  const match = raw.match(
    /^multipart\/form-data\s*;\s*boundary\s*=\s*(?:"([0-9A-Za-z'()+_./:=?-]+)"|([0-9A-Za-z'()+_./:=?-]+))\s*$/iu,
  );
  const boundary = (match?.[1] ?? match?.[2] ?? "").trim();
  if (!boundary || boundary.length > 70) {
    fail("contact_upload_boundary_invalid", 415);
  }
  return { mediaType, boundary } as const;
}

/**
 * Contact attachments cross a stricter boundary than generic form readers.
 * A browser-generated multipart request must have exactly one Content-Type
 * boundary and must not rely on an intermediary transfer/content encoding.
 */
export function validateContactMultipartRequestFraming(request: Request) {
  for (const name of ["transfer-encoding", "content-transfer-encoding", "te"]) {
    if (request.headers.get(name)?.trim()) {
      fail("contact_upload_transfer_encoding_forbidden", 415);
    }
  }
  const contentEncoding = request.headers.get("content-encoding")?.trim().toLowerCase();
  if (contentEncoding && contentEncoding !== "identity") {
    fail("contact_upload_transfer_encoding_forbidden", 415);
  }
  return validateContactFormContentType(request.headers.get("content-type"), {
    allowUrlEncoded: false,
  });
}

export function inspectStrictContactFormData(form: FormData): StrictContactFormInspection {
  const values = new Map<string, FormDataEntryValue>();
  let entryCount = 0;
  let attachmentCount = 0;

  for (const [key, value] of form.entries()) {
    entryCount += 1;
    if (entryCount > MAX_FORM_ENTRIES) fail("contact_upload_entry_limit_exceeded", 413);
    if (!FIELD_NAMES.has(key)) fail("contact_upload_unknown_field", 400);
    if (values.has(key)) fail("contact_upload_duplicate_field", 400);
    if (key === "attachment") {
      attachmentCount += 1;
      if (attachmentCount > 1) fail("contact_upload_attachment_count_exceeded", 400);
      if (typeof value === "string" && value.length > 0) fail("contact_upload_attachment_type_invalid", 415);
      if (isFileValue(value) && normalizedMediaType(value.type).startsWith("multipart/")) {
        fail("contact_upload_nested_multipart_forbidden", 415);
      }
    } else if (isFileValue(value)) {
      fail("contact_upload_text_field_type_invalid", 400);
    } else {
      const limit = TEXT_LIMITS[key as keyof typeof TEXT_LIMITS];
      if (utf8Bytes(value) > limit) fail("contact_upload_text_field_too_large", 413);
      if (containsForbiddenControl(value, key === "message")) {
        fail("contact_upload_text_field_control_character", 400);
      }
    }
    values.set(key, value);
  }

  const text = (key: keyof ContactUploadFields, fallback: string) => {
    const value = values.get(key);
    return typeof value === "string" ? value : fallback;
  };
  const rawAttachment = values.get("attachment");
  const attachment = rawAttachment && isFileValue(rawAttachment) && rawAttachment.size > 0
    ? rawAttachment
    : null;

  return {
    fields: {
      name: text("name", "Anonymous"),
      email: text("email", ""),
      subject: text("subject", "Velmère message"),
      message: text("message", ""),
    },
    attachment,
    entryCount,
  };
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readU32(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] ?? 0) * 0x1000000)
    + ((bytes[offset + 1] ?? 0) << 16)
    + ((bytes[offset + 2] ?? 0) << 8)
    + (bytes[offset + 3] ?? 0);
}

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      crcTable[index] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function inspectPng(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.byteLength < 45 || !signature.every((byte, index) => bytes[index] === byte)) {
    fail("contact_upload_attachment_structure_invalid", 415);
  }
  let offset = 8;
  let chunks = 0;
  let width = 0;
  let height = 0;
  let seenIhdr = false;
  let seenIdat = false;
  let seenIend = false;
  while (offset < bytes.byteLength) {
    chunks += 1;
    if (chunks > MAX_PNG_CHUNKS || offset + 12 > bytes.byteLength) {
      fail("contact_upload_attachment_structure_invalid", 415);
    }
    const length = readU32(bytes, offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    if (!Number.isSafeInteger(length) || dataEnd + 4 > bytes.byteLength) {
      fail("contact_upload_attachment_structure_invalid", 415);
    }
    const type = String.fromCharCode(...bytes.subarray(typeStart, typeStart + 4));
    if (!/^[A-Za-z]{4}$/u.test(type)) fail("contact_upload_attachment_structure_invalid", 415);
    const expectedCrc = readU32(bytes, crcOffset) >>> 0;
    const actualCrc = crc32(bytes.subarray(typeStart, dataEnd));
    if (expectedCrc !== actualCrc) fail("contact_upload_attachment_structure_invalid", 415);
    const critical = type.charCodeAt(0) >= 65 && type.charCodeAt(0) <= 90;
    if (critical && !ALLOWED_PNG_CRITICAL_CHUNKS.has(type)) fail("contact_upload_attachment_structure_invalid", 415);
    if (type === "IHDR") {
      if (seenIhdr || chunks !== 1 || length !== 13) fail("contact_upload_attachment_structure_invalid", 415);
      seenIhdr = true;
      width = readU32(bytes, dataStart);
      height = readU32(bytes, dataStart + 4);
      if (!width || !height || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) {
        fail("contact_upload_attachment_dimensions_invalid", 422);
      }
    } else if (!seenIhdr) {
      fail("contact_upload_attachment_structure_invalid", 415);
    } else if (type === "IDAT") {
      seenIdat = true;
    } else if (type === "IEND") {
      if (length !== 0 || !seenIdat || seenIend) fail("contact_upload_attachment_structure_invalid", 415);
      seenIend = true;
      offset = crcOffset + 4;
      if (offset !== bytes.byteLength) fail("contact_upload_attachment_structure_invalid", 415);
      break;
    }
    offset = crcOffset + 4;
  }
  if (!seenIhdr || !seenIdat || !seenIend) fail("contact_upload_attachment_structure_invalid", 415);
  return { width, height, checks: ["png_signature", "png_crc", "png_chunk_order", "png_dimensions", "png_exact_iend"] };
}

function inspectJpeg(bytes: Uint8Array) {
  if (bytes.byteLength < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
    fail("contact_upload_attachment_structure_invalid", 415);
  }
  let offset = 2;
  let width = 0;
  let height = 0;
  let seenSos = false;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset < bytes.byteLength - 2) {
    if (bytes[offset] !== 0xff) {
      if (!seenSos) fail("contact_upload_attachment_structure_invalid", 415);
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0x00 || (marker !== undefined && marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) {
      if (offset !== bytes.byteLength) fail("contact_upload_attachment_structure_invalid", 415);
      break;
    }
    if (marker === 0x01 || marker === 0xd8) continue;
    if (offset + 2 > bytes.byteLength) fail("contact_upload_attachment_structure_invalid", 415);
    const length = ((bytes[offset] ?? 0) << 8) + (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.byteLength) fail("contact_upload_attachment_structure_invalid", 415);
    const dataStart = offset + 2;
    if (marker !== undefined && sofMarkers.has(marker)) {
      if (length < 8 || width || height) fail("contact_upload_attachment_structure_invalid", 415);
      height = ((bytes[dataStart + 1] ?? 0) << 8) + (bytes[dataStart + 2] ?? 0);
      width = ((bytes[dataStart + 3] ?? 0) << 8) + (bytes[dataStart + 4] ?? 0);
      if (!width || !height || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) {
        fail("contact_upload_attachment_dimensions_invalid", 422);
      }
    }
    if (marker === 0xda) seenSos = true;
    offset += length;
  }
  if (!width || !height || !seenSos) fail("contact_upload_attachment_structure_invalid", 415);
  return { width, height, checks: ["jpeg_soi_eoi", "jpeg_segment_bounds", "jpeg_dimensions", "jpeg_scan_present", "jpeg_no_trailing_payload"] };
}

function decodePdfName(value: string) {
  return value.replace(/#([0-9A-Fa-f]{2})/gu, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16))).toLowerCase();
}

function inspectPdf(bytes: Uint8Array) {
  if (bytes.byteLength < 16 || String.fromCharCode(...bytes.subarray(0, 8)).match(/^%PDF-1\.[0-9]/u) === null) {
    fail("contact_upload_attachment_structure_invalid", 415);
  }
  const tailStart = Math.max(0, bytes.byteLength - 2048);
  const tail = Buffer.from(bytes.subarray(tailStart)).toString("latin1");
  const eofIndex = tail.lastIndexOf("%%EOF");
  const trailingBytesAreWhitespace = [...tail.slice(eofIndex + 5)].every((character) =>
    [0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20].includes(character.charCodeAt(0)));
  if (eofIndex < 0 || !trailingBytesAreWhitespace) {
    fail("contact_upload_attachment_structure_invalid", 415);
  }
  const text = Buffer.from(bytes).toString("latin1");
  const names = text.match(/\/[A-Za-z0-9#._-]+/gu) ?? [];
  for (const raw of names) {
    const decoded = decodePdfName(raw.slice(1));
    if (DANGEROUS_PDF_NAMES.has(decoded)) fail("contact_upload_attachment_active_content", 415);
  }
  return { width: null, height: null, checks: ["pdf_header", "pdf_exact_eof", "pdf_no_active_names", "pdf_no_encryption", "pdf_no_trailing_payload"] };
}

export function inspectPassiveContactAttachment(input: {
  bytes: Uint8Array;
  declaredContentType: string;
  filename: string;
  maxBytes: number;
}): PassiveContactAttachmentInspection {
  if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes <= 0) throw new RangeError("maxBytes must be a positive safe integer");
  if (!input.bytes.byteLength) fail("contact_upload_attachment_empty", 415);
  if (input.bytes.byteLength > input.maxBytes) fail("contact_upload_attachment_too_large", 413);
  const safeFilename = normalizeContactAttachmentFilename(input.filename);
  const extension = extensionOf(safeFilename);
  const declared = normalizedMediaType(input.declaredContentType);

  let kind: "pdf" | "png" | "jpeg";
  let contentType: "application/pdf" | "image/png" | "image/jpeg";
  let dimensions: { width: number | null; height: number | null; checks: string[] };
  if (input.bytes[0] === 0x25 && input.bytes[1] === 0x50 && input.bytes[2] === 0x44 && input.bytes[3] === 0x46 && input.bytes[4] === 0x2d) {
    kind = "pdf";
    contentType = "application/pdf";
    if (declared !== contentType || extension !== "pdf") fail("contact_upload_attachment_media_mismatch", 415);
    dimensions = inspectPdf(input.bytes);
  } else if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => input.bytes[index] === byte)) {
    kind = "png";
    contentType = "image/png";
    if (declared !== contentType || extension !== "png") fail("contact_upload_attachment_media_mismatch", 415);
    dimensions = inspectPng(input.bytes);
  } else if (input.bytes[0] === 0xff && input.bytes[1] === 0xd8 && input.bytes[2] === 0xff) {
    kind = "jpeg";
    contentType = "image/jpeg";
    if (!new Set(["image/jpeg", "image/jpg"]).has(declared) || !new Set(["jpg", "jpeg"]).has(extension)) {
      fail("contact_upload_attachment_media_mismatch", 415);
    }
    dimensions = inspectJpeg(input.bytes);
  } else {
    fail("contact_upload_attachment_media_mismatch", 415);
  }

  return {
    kind,
    contentType,
    extension: extension as "pdf" | "png" | "jpg" | "jpeg",
    safeFilename,
    byteLength: input.bytes.byteLength,
    sha256: sha256(input.bytes),
    width: dimensions.width,
    height: dimensions.height,
    pageCountClaimed: null,
    structuralChecks: dimensions.checks,
  };
}
