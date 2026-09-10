import { ASCII_CONTROL_PATTERN, NUL_CR_LF_PATTERN } from "./ascii-control-characters";

export const PASS36_A72_DOWNLOAD_RESPONSE_BOUNDARY_ID =
  "velmere.pass36.a72.download-response-boundary.v1" as const;

export type DownloadDisposition = "attachment" | "inline";
export type DownloadMediaKind =
  | "pdf"
  | "json"
  | "markdown"
  | "svg"
  | "png"
  | "jpeg"
  | "gif"
  | "webp"
  | "avif"
  | "ico";

export type SafeDownloadDisposition = {
  readonly boundaryId: typeof PASS36_A72_DOWNLOAD_RESPONSE_BOUNDARY_ID;
  readonly disposition: DownloadDisposition;
  readonly mediaKind: DownloadMediaKind;
  readonly contentType: string;
  readonly extension: string;
  readonly filename: string;
  readonly asciiFilename: string;
  readonly contentDisposition: string;
};

export type DownloadResponseBoundaryErrorCode =
  | "download_disposition_invalid"
  | "download_media_kind_invalid"
  | "download_filename_control_character"
  | "download_filename_bidi_character"
  | "download_filename_empty"
  | "download_filename_header_budget_exceeded";

export class DownloadResponseBoundaryError extends Error {
  readonly code: DownloadResponseBoundaryErrorCode;

  constructor(code: DownloadResponseBoundaryErrorCode) {
    super(code);
    this.name = "DownloadResponseBoundaryError";
    this.code = code;
  }
}

const MEDIA_PROFILES = Object.freeze({
  pdf: { extension: "pdf", contentType: "application/pdf" },
  json: { extension: "json", contentType: "application/json; charset=utf-8" },
  markdown: { extension: "md", contentType: "text/markdown; charset=utf-8" },
  svg: { extension: "svg", contentType: "image/svg+xml; charset=utf-8" },
  png: { extension: "png", contentType: "image/png" },
  jpeg: { extension: "jpg", contentType: "image/jpeg" },
  gif: { extension: "gif", contentType: "image/gif" },
  webp: { extension: "webp", contentType: "image/webp" },
  avif: { extension: "avif", contentType: "image/avif" },
  ico: { extension: "ico", contentType: "image/x-icon" },
} satisfies Record<DownloadMediaKind, { extension: string; contentType: string }>);

const WINDOWS_RESERVED_BASENAMES = new Set([
  "con", "prn", "aux", "nul", "clock$",
  ...Array.from({ length: 9 }, (_value, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_value, index) => `lpt${index + 1}`),
]);
const MAX_UNICODE_STEM_BYTES = 144;
const MAX_ASCII_STEM_CHARS = 84;
const MAX_CONTENT_DISPOSITION_BYTES = 512;

function fail(code: DownloadResponseBoundaryErrorCode): never {
  throw new DownloadResponseBoundaryError(code);
}

function truncateUtf8(value: string, maxBytes: number) {
  let output = "";
  let bytes = 0;
  for (const character of value) {
    const next = Buffer.byteLength(character, "utf8");
    if (bytes + next > maxBytes) break;
    output += character;
    bytes += next;
  }
  return output;
}

function trimUnsafeEdges(value: string) {
  return value
    .replace(/^[.\s_-]+/gu, "")
    .replace(/[.\s_-]+$/gu, "");
}

function avoidReservedBasename(value: string) {
  const base = value.split(".", 1)[0]?.toLowerCase() ?? "";
  return WINDOWS_RESERVED_BASENAMES.has(base) ? `velmere-${value}` : value;
}

function normalizeUnicodeStem(value: string, fallback: string) {
  const input = String(value ?? "");
  if(ASCII_CONTROL_PATTERN.test(input)) fail("download_filename_control_character");
  if(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u.test(input)) fail("download_filename_bidi_character");
  const normalized = input
    .normalize("NFKC")
    .replace(/[\\/]+/gu, "-")
    .replace(/["';:%<>|?*]+/gu, "-")
    .replace(/[^\p{L}\p{N}._ -]+/gu, "-")
    .replace(/[\s_-]+/gu, "-")
    .replace(/\.{2,}/gu, ".");
  const cleaned = avoidReservedBasename(trimUnsafeEdges(normalized));
  const safeFallback = trimUnsafeEdges(
    String(fallback || "velmere-download")
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9._-]+/gu, "-")
      .replace(/-+/gu, "-"),
  ) || "velmere-download";
  const selected = cleaned || safeFallback;
  const truncated = trimUnsafeEdges(truncateUtf8(selected, MAX_UNICODE_STEM_BYTES));
  if (!truncated || truncated === "." || truncated === "..") fail("download_filename_empty");
  return avoidReservedBasename(truncated);
}

function normalizeAsciiStem(value: string, fallback: string) {
  const transliterated = value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/\.{2,}/gu, ".");
  const cleaned = avoidReservedBasename(trimUnsafeEdges(transliterated));
  const fallbackAscii = trimUnsafeEdges(
    String(fallback || "velmere-download")
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .replace(/[^a-zA-Z0-9._-]+/gu, "-")
      .replace(/-+/gu, "-"),
  ) || "velmere-download";
  const selected = (cleaned || fallbackAscii).slice(0, MAX_ASCII_STEM_CHARS);
  const truncated = trimUnsafeEdges(selected) || "velmere-download";
  return avoidReservedBasename(truncated);
}

function encodeRfc5987(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function buildSafeDownloadDisposition(input: {
  readonly disposition: DownloadDisposition;
  readonly filenameStem: string;
  readonly mediaKind: DownloadMediaKind;
  readonly fallbackStem?: string;
}): SafeDownloadDisposition {
  if (input.disposition !== "attachment" && input.disposition !== "inline") {
    fail("download_disposition_invalid");
  }
  const profile = MEDIA_PROFILES[input.mediaKind];
  if (!profile) fail("download_media_kind_invalid");
  const fallback = input.fallbackStem ?? "velmere-download";
  let unicodeStem = normalizeUnicodeStem(input.filenameStem, fallback);
  let asciiStem = normalizeAsciiStem(unicodeStem, fallback);
  let filename = `${unicodeStem}.${profile.extension}`;
  let asciiFilename = `${asciiStem}.${profile.extension}`;
  let contentDisposition = `${input.disposition}; filename="${asciiFilename}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
  while (Buffer.byteLength(contentDisposition, "utf8") > MAX_CONTENT_DISPOSITION_BYTES && [...unicodeStem].length > 1) {
    unicodeStem = trimUnsafeEdges([...unicodeStem].slice(0, -1).join(""));
    asciiStem = normalizeAsciiStem(unicodeStem, fallback);
    filename = `${unicodeStem}.${profile.extension}`;
    asciiFilename = `${asciiStem}.${profile.extension}`;
    contentDisposition = `${input.disposition}; filename="${asciiFilename}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
  }
  if (NUL_CR_LF_PATTERN.test(contentDisposition) || Buffer.byteLength(contentDisposition, "utf8") > MAX_CONTENT_DISPOSITION_BYTES) {
    fail("download_filename_header_budget_exceeded");
  }
  return {
    boundaryId: PASS36_A72_DOWNLOAD_RESPONSE_BOUNDARY_ID,
    disposition: input.disposition,
    mediaKind: input.mediaKind,
    contentType: profile.contentType,
    extension: profile.extension,
    filename,
    asciiFilename,
    contentDisposition,
  };
}
