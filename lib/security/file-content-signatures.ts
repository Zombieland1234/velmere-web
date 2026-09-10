import { buildSafeDownloadDisposition } from "@/lib/security/download-response-boundary";

export type SafeRasterImageKind = "png" | "jpeg" | "gif" | "webp" | "avif" | "ico";

export type SafeRasterImageSignature = {
  readonly kind: SafeRasterImageKind;
  readonly contentType: string;
  readonly extension: string;
};

export type ContactAttachmentSignature =
  | { readonly kind: "pdf"; readonly contentType: "application/pdf"; readonly extensions: readonly ["pdf"] }
  | { readonly kind: "png"; readonly contentType: "image/png"; readonly extensions: readonly ["png"] }
  | { readonly kind: "jpeg"; readonly contentType: "image/jpeg"; readonly extensions: readonly ["jpg", "jpeg"] };

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return bytes.byteLength >= signature.length && signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  if (start < 0 || length < 0 || start + length > bytes.byteLength) return "";
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

export function detectSafeRasterImageSignature(bytes: Uint8Array): SafeRasterImageSignature | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "png", contentType: "image/png", extension: "png" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { kind: "jpeg", contentType: "image/jpeg", extension: "jpg" };
  }
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") {
    return { kind: "gif", contentType: "image/gif", extension: "gif" };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { kind: "webp", contentType: "image/webp", extension: "webp" };
  }
  if (ascii(bytes, 4, 4) === "ftyp" && (ascii(bytes, 8, 4) === "avif" || ascii(bytes, 8, 4) === "avis")) {
    return { kind: "avif", contentType: "image/avif", extension: "avif" };
  }
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00]) && bytes.byteLength >= 6 && ((bytes[4] ?? 0) > 0 || (bytes[5] ?? 0) > 0)) {
    return { kind: "ico", contentType: "image/x-icon", extension: "ico" };
  }
  return null;
}

function normalizedMediaType(value: string | null | undefined) {
  return String(value ?? "").split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function declaredRasterTypeMatches(signature: SafeRasterImageSignature, declaredContentType: string | null | undefined) {
  const declared = normalizedMediaType(declaredContentType);
  if (signature.kind === "jpeg") return declared === "image/jpeg" || declared === "image/jpg";
  if (signature.kind === "ico") {
    return declared === "image/x-icon" || declared === "image/vnd.microsoft.icon" || declared === "image/ico";
  }
  return declared === signature.contentType;
}

function readUint32Be(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > bytes.byteLength) return null;
  return (
    ((bytes[offset] ?? 0) * 0x1000000) +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array, start: number, end: number) {
  let value = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    value = CRC32_TABLE[(value ^ (bytes[index] ?? 0)) & 0xff]! ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function validPngContainer(bytes: Uint8Array) {
  if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return false;
  let offset = 8;
  let chunks = 0;
  let sawHeader = false;
  while (offset + 12 <= bytes.byteLength && chunks < 10_000) {
    const length = readUint32Be(bytes, offset);
    if (length === null || length > 16 * 1024 * 1024) return false;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    if (crcOffset + 4 > bytes.byteLength) return false;
    const type = ascii(bytes, offset + 4, 4);
    if (!/^[A-Za-z]{4}$/u.test(type)) return false;
    const declaredCrc = readUint32Be(bytes, crcOffset);
    if (declaredCrc === null || crc32(bytes, offset + 4, dataEnd) !== declaredCrc) return false;
    chunks += 1;
    if (chunks === 1) {
      if (type !== "IHDR" || length !== 13) return false;
      const width = readUint32Be(bytes, dataStart) ?? 0;
      const height = readUint32Be(bytes, dataStart + 4) ?? 0;
      if (!width || !height || width > 8192 || height > 8192 || width * height > 16_777_216) return false;
      sawHeader = true;
    } else if (type === "IHDR") {
      return false;
    }
    offset = crcOffset + 4;
    if (type === "IEND") return sawHeader && length === 0 && offset === bytes.byteLength;
  }
  return false;
}

function validJpegContainer(bytes: Uint8Array) {
  if (!startsWith(bytes, [0xff, 0xd8, 0xff])) return false;
  let offset = 2;
  let sawFrame = false;
  let inScan = false;
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      if (!inScan) return false;
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.byteLength) return false;
    const marker = bytes[offset] ?? 0;
    offset += 1;
    if (inScan && marker === 0x00) continue;
    if (marker === 0xd9) return sawFrame && offset === bytes.byteLength;
    if (marker === 0xd8) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    inScan = false;
    if (offset + 2 > bytes.byteLength) return false;
    const segmentLength = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) return false;
    if (frameMarkers.has(marker)) {
      if (segmentLength < 8) return false;
      const height = ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0);
      const width = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
      if (!width || !height || width > 8192 || height > 8192 || width * height > 16_777_216) return false;
      sawFrame = true;
    }
    if (marker === 0xda) inScan = true;
    offset += segmentLength;
  }
  return false;
}

/**
 * Accept only passive raster formats whose declared media type agrees with
 * their signature and complete container structure. SVG/XML, trailing-data
 * polyglots, malformed CRCs and formats without a local structural verifier
 * fail closed.
 */
export function validateProxiedRasterImage(
  bytes: Uint8Array,
  declaredContentType: string | null | undefined,
): SafeRasterImageSignature | null {
  const signature = detectSafeRasterImageSignature(bytes);
  if (!signature || !declaredRasterTypeMatches(signature, declaredContentType)) return null;
  const structurallyValid =
    signature.kind === "png"
      ? validPngContainer(bytes)
      : signature.kind === "jpeg"
        ? validJpegContainer(bytes)
        : false;
  return structurallyValid ? signature : null;
}

export function safeProxiedImageHeaders(
  signature: SafeRasterImageSignature,
  cacheControl: string,
  filenameStem = "velmere-proxied-image",
) {
  const download = buildSafeDownloadDisposition({
    disposition: "inline",
    filenameStem,
    mediaKind: signature.kind,
    fallbackStem: "velmere-proxied-image",
  });
  return {
    "content-type": download.contentType,
    "content-disposition": download.contentDisposition,
    "cache-control": cacheControl,
    "content-security-policy": "default-src 'none'; sandbox",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "same-origin",
  } as const;
}

export function detectContactAttachmentSignature(bytes: Uint8Array): ContactAttachmentSignature | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { kind: "pdf", contentType: "application/pdf", extensions: ["pdf"] };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "png", contentType: "image/png", extensions: ["png"] };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { kind: "jpeg", contentType: "image/jpeg", extensions: ["jpg", "jpeg"] };
  }
  return null;
}

export function validateContactAttachmentSignature(input: {
  readonly bytes: Uint8Array;
  readonly declaredContentType: string;
  readonly extension: string;
}) {
  const signature = detectContactAttachmentSignature(input.bytes);
  if (!signature) return null;
  const declared = normalizedMediaType(input.declaredContentType);
  const typeMatches = signature.kind === "jpeg"
    ? declared === "image/jpeg" || declared === "image/jpg"
    : declared === signature.contentType;
  const extension = input.extension.trim().toLowerCase();
  return typeMatches && signature.extensions.includes(extension as never) ? signature : null;
}
