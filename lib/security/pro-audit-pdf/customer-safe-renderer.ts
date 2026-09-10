import { JSON_CONTROL_PATTERN } from "../ascii-control-characters";
import {
  renderInstitutionalMerkleSealCard,
  generateQrMatrix21x21,
  generateQrCodePdfCommands,
} from "../pdf-institutional-seal";

import crypto from "node:crypto";

import {
  VELMERE_SANS_BOLD_CFF_ZLIB_BASE64,
  VELMERE_SANS_REGULAR_CFF_ZLIB_BASE64,
} from "./embedded-font-data";

const PDF_ASCII_MAP: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
  Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z",
  ä: "a", ö: "o", ü: "u", ß: "ss", Ä: "A", Ö: "O", Ü: "U",
  è: "e", é: "e", ê: "e", È: "E", É: "E", Ê: "E",
};

const POLISH_PDF_BYTES: Readonly<Record<string, number>> = Object.freeze({
  Ą: 129, Ć: 130, Ę: 131, Ł: 132, Ń: 133, Ó: 134, Ś: 135, Ź: 136, Ż: 137,
  ą: 138, ć: 139, ę: 140, ł: 141, ń: 142, ó: 143, ś: 144, ź: 145, ż: 146,
});

const POLISH_PDF_DIFFERENCES = [
  "Aogonek", "Cacute", "Eogonek", "Lslash", "Nacute", "Oacute", "Sacute", "Zacute", "Zdotaccent",
  "aogonek", "cacute", "eogonek", "lslash", "nacute", "oacute", "sacute", "zacute", "zdotaccent",
] as const;

// A custom Type1 encoding is required for Polish glyph names. Once an encoding
// differs from a Base-14 font's built-in encoding, readers are no longer
// required to infer the standard metrics. Poppler and some browser viewers then
// fall back to visibly incorrect, near-monospaced advances. Keep the existing
// Helvetica design, but make every glyph advance explicit.
const HELVETICA_ASCII_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
] as const;

const HELVETICA_BOLD_ASCII_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
] as const;

const POLISH_WIDTH_BASE_CHAR = [
  "A", "C", "E", "L", "N", "O", "S", "Z", "Z",
  "a", "c", "e", "l", "n", "o", "s", "z", "z",
] as const;

const CUSTOMER_UNSAFE_PATTERN = /\b(pass\d{3,}|debug|operator-only|private operator|raw payload|api key|seed phrase|exploit steps|session id|receipt token|private delivery pointer|operatorRows)\b/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const EVM_ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}/;
const PUBLIC_TARGET_ADDRESS_LINE = /^(target|contract(?: address)?|audited address):\s*0x[a-fA-F0-9]{40}$/i;
const PUBLIC_HISTORICAL_CHAIN_EVIDENCE_LINE = /^historicalDeployment=0x[a-fA-F0-9]{40}; snapshotBlock=\d+; attackBlock=\d+; attackTx=0x[a-fA-F0-9]{64}; proxy=EIP_1167_COMPATIBLE_MINIMAL_PROXY; implementation=0x[a-fA-F0-9]{40}; trustedForwarder=0x[a-fA-F0-9]{40}; upstreamReplay=PASS; profit=[0-9.]+ WBNB; independentVelmereReplay=false; currentExploitabilityProven=false$/;
const PUBLIC_CURRENT_DEPLOYMENT_QUORUM_LINE = /^currentDeployment=0x[a-fA-F0-9]{40}; snapshotBlock=\d+; blockHash=0x[a-fA-F0-9]{64}; stateRoot=0x[a-fA-F0-9]{64}; runtimeSha256=sha256:[a-f0-9]{64}; proxy=EIP_1167_COMPATIBLE_MINIMAL_PROXY; implementation=0x[a-fA-F0-9]{40}; implementationSha256=sha256:[a-f0-9]{64}; trustedForwarder=0x[a-fA-F0-9]{40}; trustedForwarderState=(?:ACTIVE|INACTIVE); negativeControl=INACTIVE; currentExploitabilityProven=false; independentReplay=false$/;

export const PASS4808_PDF_RENDER_CONTRACT_ID = "pass4808-deterministic-latin-extended-pagination-v1" as const;

export type CustomerSafePdfOptions = {
  title?: string;
  subtitle?: string;
  footer?: string;
  integrityLabel?: string;
  issuer?: string;
  generator?: string;
  maxLines?: number;
  documentId?: string;
  generatedAt?: string;
  locale?: "pl" | "en" | "de";
  classification?: "customer_private" | "customer_safe";
};

export type CustomerSafePdfRenderRow = {
  text: string;
  sourceLine: number;
  wrapIndex: number;
  heading: boolean;
  blank: boolean;
  height: number;
};

export type CustomerSafePdfRenderPlan = {
  schemaVersion: typeof PASS4808_PDF_RENDER_CONTRACT_ID;
  title: string;
  subtitle: string;
  footer: string;
  issuerLine: string;
  integrityLine: string;
  contentDigest: string;
  documentId: string;
  generatedAt: string;
  locale: "pl" | "en" | "de";
  classification: "customer_private" | "customer_safe";
  pages: Array<{ pageNumber: number; rows: CustomerSafePdfRenderRow[]; usedHeight: number }>;
  sourceLineCount: number;
  renderedRowCount: number;
  unsupportedGlyphReplacements: number;
  planDigest: string;
};

export function cleanProAuditPdfInput(value: string | null, fallback = "", max = 180) {
  const text = String(value ?? fallback).replace(/[<>\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : fallback;
}

/** Legacy transliteration retained only for replaying old PASS4807 snapshots/tests. */
export function toProAuditPdfAscii(value: string) {
  return value.replace(/[ąćęłńóśźżäöüßèéê]/gi, (char) => PDF_ASCII_MAP[char] ?? char).replace(/[^\x20-\x7E]/g, " ");
}

/** Legacy literal-string escaping retained for PASS4807 byte-identical replay. */
export function escapeProAuditPdfText(value: string) {
  return toProAuditPdfAscii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function isCustomerSafeProAuditPdfLine(value: string) {
  const trimmed = value.trim();
  const hasPublicTargetAddress = PUBLIC_TARGET_ADDRESS_LINE.test(trimmed);
  const hasClosedHistoricalChainEvidence = PUBLIC_HISTORICAL_CHAIN_EVIDENCE_LINE.test(trimmed);
  const hasClosedCurrentDeploymentQuorum = PUBLIC_CURRENT_DEPLOYMENT_QUORUM_LINE.test(trimmed);
  return !CUSTOMER_UNSAFE_PATTERN.test(value)
    && !EMAIL_PATTERN.test(value)
    && (!EVM_ADDRESS_PATTERN.test(value) || hasPublicTargetAddress || hasClosedHistoricalChainEvidence || hasClosedCurrentDeploymentQuorum);
}

function normalizeCustomerPdfText(value: string) {
  return value
    .normalize("NFC")
    .replace(JSON_CONTROL_PATTERN, " ")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2022\u2023\u2043]/g, "*")
    .replace(/\u2026/g, "...")
    .replace(/[\u2192\u21d2]/g, "->")
    .replace(/[\u2190\u21d0]/g, "<-")
    .replace(/\s+/g, " ")
    .trimEnd();
}

function encodeCustomerPdfBytes(value: string) {
  const normalized = normalizeCustomerPdfText(value);
  const bytes: number[] = [];
  let unsupported = 0;
  for (const char of normalized) {
    const polishByte = POLISH_PDF_BYTES[char];
    if (polishByte !== undefined) {
      bytes.push(polishByte);
      continue;
    }
    const code = char.codePointAt(0) ?? 32;
    if (code <= 0x7f) {
      bytes.push(code);
      continue;
    }
    if (code === 0x20ac) {
      bytes.push(128); // Euro in WinAnsiEncoding.
      continue;
    }
    if (code >= 0x00a1 && code <= 0x00ff) {
      bytes.push(code);
      continue;
    }
    bytes.push(63);
    unsupported += 1;
  }
  return { bytes: Uint8Array.from(bytes), unsupported };
}

export function encodeProAuditPdfHexText(value: string) {
  const { bytes } = encodeCustomerPdfBytes(value);
  return `<${Buffer.from(bytes).toString("hex").toUpperCase()}>`;
}

function asciiGlyphWidth(char: string, bold: boolean) {
  const code = char.codePointAt(0) ?? 32;
  if (code < 32 || code > 126) return 556;
  return (bold ? HELVETICA_BOLD_ASCII_WIDTHS : HELVETICA_ASCII_WIDTHS)[code - 32] ?? 556;
}

function pdfGlyphWidth(code: number, bold: boolean) {
  if (code >= 32 && code <= 126) return asciiGlyphWidth(String.fromCharCode(code), bold);
  if (code >= 129 && code <= 146) return asciiGlyphWidth(POLISH_WIDTH_BASE_CHAR[code - 129] ?? "?", bold);
  if (code === 128) return 556; // Euro.
  if (code === 223) return 611; // germandbls.
  if (code >= 192 && code <= 255) {
    const normalizedBase = String.fromCharCode(code).normalize("NFD").replace(/[\u0300-\u036f]/g, "")[0];
    if (normalizedBase && /^[A-Za-z]$/.test(normalizedBase)) return asciiGlyphWidth(normalizedBase, bold);
  }
  return 556;
}

function pdfFontWidths(bold: boolean) {
  return Array.from({ length: 224 }, (_, index) => pdfGlyphWidth(index + 32, bold)).join(" ");
}

function encodePdfMetadataText(value: string) {
  const normalized = normalizeCustomerPdfText(value);
  const body = Buffer.from(normalized, "utf16le");
  body.swap16();
  return `<FEFF${body.toString("hex").toUpperCase()}>`;
}

function estimateTextWidthPoints(value: string, fontSize: number, bold = false) {
  const { bytes } = encodeCustomerPdfBytes(value);
  return bytes.reduce((sum, code) => sum + pdfGlyphWidth(code, bold), 0) * fontSize / 1_000;
}

function wrapCustomerPdfLine(value: string, maxWidthPoints: number, fontSize: number, bold = false) {
  const clean = normalizeCustomerPdfText(value);
  if (!clean) return [""];
  const words = clean.split(" ").filter(Boolean);
  const rows: string[] = [];
  let current = "";
  const pushLongToken = (token: string) => {
    let segment = "";
    for (const char of token) {
      const candidate = `${segment}${char}`;
      if (segment && estimateTextWidthPoints(candidate, fontSize, bold) > maxWidthPoints) {
        rows.push(segment);
        segment = char;
      } else {
        segment = candidate;
      }
    }
    current = segment;
  };
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidthPoints(candidate, fontSize, bold) <= maxWidthPoints) {
      current = candidate;
      continue;
    }
    if (current) rows.push(current);
    if (estimateTextWidthPoints(word, fontSize, bold) > maxWidthPoints) pushLongToken(word);
    else current = word;
  }
  if (current || rows.length === 0) rows.push(current);
  return rows;
}

function pdfDate(value: string) {
  const date = new Date(value);
  const safe = Number.isFinite(date.getTime()) ? date : new Date(0);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `D:${safe.getUTCFullYear()}${pad(safe.getUTCMonth() + 1)}${pad(safe.getUTCDate())}${pad(safe.getUTCHours())}${pad(safe.getUTCMinutes())}${pad(safe.getUTCSeconds())}Z`;
}

function heading(line: string) {
  const trimmed = line.trim();
  return trimmed.endsWith(":") || (/^[A-Z0-9ĄĆĘŁŃÓŚŹŻÄÖÜ /&-]{5,}$/.test(trimmed) && trimmed.length <= 72);
}

function digestJson(value: unknown) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function fitTextToWidth(value: string, maxWidthPoints: number, fontSize: number, bold = false) {
  const normalized = normalizeCustomerPdfText(value);
  if (estimateTextWidthPoints(normalized, fontSize, bold) <= maxWidthPoints) return normalized;
  const suffix = "...";
  let output = "";
  for (const char of normalized) {
    const candidate = `${output}${char}${suffix}`;
    if (estimateTextWidthPoints(candidate, fontSize, bold) > maxWidthPoints) break;
    output += char;
  }
  return `${output.trimEnd()}${suffix}`;
}

function normalizedPdfOptions(options: CustomerSafePdfOptions) {
  const title = fitTextToWidth(options.title || "VELMERE AUDIT REPORT", 507, 18, true);
  const subtitle = fitTextToWidth(options.subtitle || "Evidence-bound customer report", 507, 9);
  const footer = fitTextToWidth(
    options.footer || "Automated informational analysis | Not manually QA-checked, independently certified or guaranteed safe",
    500,
    7,
  );
  const integrityLabel = fitTextToWidth(options.integrityLabel || "Document integrity verified by Velmère", 330, 7);
  const issuer = fitTextToWidth(options.issuer || "Issued by Velmère Security", 240, 7, true);
  const generator = fitTextToWidth(options.generator || "Generated automatically by Velmère Security Engine", 250, 7);
  const issuerLine = fitTextToWidth(`${issuer} | ${generator}`, 500, 7);
  const maxLines = Math.max(40, Math.min(720, Math.trunc(options.maxLines || 480)));
  const documentId = cleanProAuditPdfInput(options.documentId ?? "velmere-audit", "velmere-audit", 120);
  const generatedAt = Number.isFinite(new Date(options.generatedAt ?? "").getTime()) ? new Date(String(options.generatedAt)).toISOString() : new Date(0).toISOString();
  const locale = options.locale ?? "en";
  const classification = options.classification ?? "customer_safe";
  return { title, subtitle, footer, integrityLabel, issuerLine, maxLines, documentId, generatedAt, locale, classification } as const;
}

function paginateCustomerPdfGroups(
  groups: Array<{ sourceLine: number; heading: boolean; rows: CustomerSafePdfRenderRow[] }>,
  pageHeight: number,
) {
  const pages: Array<{ pageNumber: number; rows: CustomerSafePdfRenderRow[]; usedHeight: number }> = [];
  let currentRows: CustomerSafePdfRenderRow[] = [];
  let usedHeight = 0;
  const flush = () => {
    if (!currentRows.length) return;
    pages.push({ pageNumber: pages.length + 1, rows: currentRows, usedHeight });
    currentRows = [];
    usedHeight = 0;
  };

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const groupHeight = group.rows.reduce((sum, row) => sum + row.height, 0);
    const nextHeight = groups[index + 1]?.rows.reduce((sum, row) => sum + row.height, 0) ?? 0;
    const keepWithNextHeight = group.heading ? groupHeight + Math.min(nextHeight, 42) : groupHeight;
    if (currentRows.length && keepWithNextHeight > pageHeight - usedHeight) flush();
    if (groupHeight <= pageHeight) {
      currentRows.push(...group.rows);
      usedHeight += groupHeight;
      continue;
    }
    for (const row of group.rows) {
      if (currentRows.length && row.height > pageHeight - usedHeight) flush();
      currentRows.push(row);
      usedHeight += row.height;
    }
  }
  flush();
  return pages;
}

export function planCustomerSafePdf(lines: string[], options: CustomerSafePdfOptions = {}): CustomerSafePdfRenderPlan {
  const normalized = normalizedPdfOptions(options);
  const groups: Array<{ sourceLine: number; heading: boolean; rows: CustomerSafePdfRenderRow[] }> = [];
  let unsupportedGlyphReplacements = [normalized.title, normalized.subtitle, normalized.footer, normalized.integrityLabel, normalized.issuerLine]
    .reduce((sum, value) => sum + encodeCustomerPdfBytes(value).unsupported, 0);
  const safeSourceLines = lines
    .map((line, sourceLine) => ({ line, sourceLine }))
    .filter(({ line }) => isCustomerSafeProAuditPdfLine(line))
    .slice(0, normalized.maxLines);
  for (const entry of safeSourceLines) {
    const sourceLine = entry.sourceLine;
    const source = normalizeCustomerPdfText(entry.line ?? "");
    unsupportedGlyphReplacements += encodeCustomerPdfBytes(source).unsupported;
    const isHeading = heading(source);
    const isMerkleSeal = /^(?:Merkle Root|Piecz[eę]ć? Merkle(?: SHA-256)?|Merkle-Wurzel|Cryptographic Seal):\s*(sha256:[a-fA-F0-9]{32,64}|[a-fA-F0-9]{32,64})/i.test(source);
    const isQrCard = /^(?:Weryfikacja QR|QR Verification|QR-Verifizierung|QR Code):\s*(https?:\/\/\S+)/i.test(source);
    const wrapped = (isMerkleSeal || isQrCard) ? [source] : wrapCustomerPdfLine(source, 500, isHeading ? 10 : 9, isHeading);
    groups.push({
      sourceLine,
      heading: isHeading,
      rows: wrapped.map((text, wrapIndex) => ({
        text,
        sourceLine,
        wrapIndex,
        heading: isHeading,
        blank: text.length === 0,
        height: text.length === 0 ? 8 : isMerkleSeal ? 50 : isQrCard ? 58 : isHeading ? 18 : 14,
      })),
    });
  }
  if (groups.length === 0) {
    groups.push({
      sourceLine: 0,
      heading: false,
      rows: [{ text: "No customer-safe report content was available.", sourceLine: 0, wrapIndex: 0, heading: false, blank: false, height: 14 }],
    });
  }

  let pages = paginateCustomerPdfGroups(groups, 692);
  // Orphan prevention / height balancing:
  // If the last page has very few items (< 140 points used) and document is multi-page:
  if (pages.length > 1 && pages[pages.length - 1].usedHeight < 140) {
    const compactGroups = groups.map((g) => ({
      ...g,
      rows: g.rows.map((r) => ({
        ...r,
        height: r.blank ? 6 : r.heading ? 15 : 12.5,
      })),
    }));
    const compactPages = paginateCustomerPdfGroups(compactGroups, 706);
    if (compactPages.length < pages.length) {
      pages = compactPages;
    }
  }

  const contentCore = {
    schemaVersion: PASS4808_PDF_RENDER_CONTRACT_ID,
    title: normalized.title,
    subtitle: normalized.subtitle,
    footer: normalized.footer,
    issuerLine: normalized.issuerLine,
    documentId: normalized.documentId,
    generatedAt: normalized.generatedAt,
    locale: normalized.locale,
    classification: normalized.classification,
    pages,
    sourceLineCount: safeSourceLines.length,
    renderedRowCount: pages.reduce((sum, page) => sum + page.rows.length, 0),
  };
  const contentDigest = digestJson(contentCore);
  const integrityLine = fitTextToWidth(
    `${normalized.integrityLabel} | Ref ${normalized.documentId} / ${contentDigest.slice("sha256:".length, "sha256:".length + 16)}`,
    500,
    7,
  );
  unsupportedGlyphReplacements += encodeCustomerPdfBytes(integrityLine).unsupported;
  const unsigned = {
    ...contentCore,
    integrityLine,
    contentDigest,
    unsupportedGlyphReplacements,
  };
  return { ...unsigned, planDigest: digestJson(unsigned) };
}

function fontEncodingObject() {
  return `<< /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [129 ${POLISH_PDF_DIFFERENCES.map((name) => `/${name}`).join(" ")}] >>`;
}

function embeddedCffStream(base64: string, uncompressedLength: number) {
  const compressed = Buffer.from(base64, "base64");
  const encoded = `${compressed.toString("hex").toUpperCase()}>`;
  return `<< /Length ${Buffer.byteLength(encoded, "ascii")} /Length1 ${uncompressedLength} /Filter [/ASCIIHexDecode /FlateDecode] /Subtype /Type1C >>\nstream\n${encoded}\nendstream`;
}

function toUnicodeCmap() {
  const polishCodePoints = [
    0x0104, 0x0106, 0x0118, 0x0141, 0x0143, 0x00d3, 0x015a, 0x0179, 0x017b,
    0x0105, 0x0107, 0x0119, 0x0142, 0x0144, 0x00f3, 0x015b, 0x017a, 0x017c,
  ];
  const mappings = [
    ...Array.from({ length: 95 }, (_, index) => [index + 32, index + 32]),
    [128, 0x20ac],
    ...polishCodePoints.map((codePoint, index) => [index + 129, codePoint]),
    ...Array.from({ length: 95 }, (_, index) => [index + 161, index + 161]),
  ];
  const chunks = [];
  for (let index = 0; index < mappings.length; index += 100) {
    const entries = mappings.slice(index, index + 100);
    chunks.push(
      `${entries.length} beginbfchar`,
      ...entries.map(([source, target]) => `<${source.toString(16).padStart(2, "0").toUpperCase()}> <${target.toString(16).padStart(4, "0").toUpperCase()}>`),
      "endbfchar",
    );
  }
  return [
    "/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /VelmereLatinUnicode def", "/CMapType 2 def",
    "1 begincodespacerange", "<00> <FF>", "endcodespacerange",
    ...chunks,
    "endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end",
  ].join("\n");
}

function renderStyledPdfRow(row: CustomerSafePdfRenderRow, y: number, documentId?: string): { commands: string[]; actualHeight: number } {
  if (row.blank) {
    return { commands: [], actualHeight: row.height };
  }

  const text = row.text;
  const trimmed = text.trim();
  const commands: string[] = [];

  // 1. Top Report ID strip: ID raportu: ... | Tier: ... | Surface: ...
  const reportIdMatch = trimmed.match(/^(ID raportu|Berichts-ID|Report ID):\s*(.*)$/i);
  if (reportIdMatch) {
    commands.push("0.96 0.97 0.98 rg", "0.85 0.88 0.92 RG", "0.5 w", `44 ${y - 3} 507 14 re`, "B");
    commands.push("0.25 0.30 0.40 rg", "BT", "/F2 7.5 Tf", `50 ${y} Td`, `${encodeProAuditPdfHexText(fitTextToWidth(trimmed, 495, 7.5, true))} Tj`, "ET");
    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 2. Major Section Banner: --- TITLE [TIER] --- or POUFNOŚĆ I ZASTRZEŻENIE PRAWNE:
  const sectionMatch = trimmed.match(/^---\s*(.*?)(?:\s*\[(BASIC|PRO|ADVANCED)\])?\s*---$/i);
  const isLegalNotice = /^(POUFNOŚĆ I ZASTRZEŻENIE PRAWNE|CONFIDENTIALITY & LEGAL NOTICE|VERTRAULICHKEIT & RECHTLICHER HINWEIS):$/i.test(trimmed);

  if (sectionMatch || isLegalNotice) {
    const rawTitle = isLegalNotice ? trimmed.replace(/:$/, "") : sectionMatch![1].trim();
    const tier = isLegalNotice ? null : sectionMatch![2]?.toUpperCase();

    // Dark sleek banner background
    commands.push("0.11 0.15 0.22 rg", `44 ${y - 4} 507 16 re`, "f");
    // Velmère gold accent mark on left
    commands.push("0.77 0.62 0.31 rg", `44 ${y - 4} 3.5 16 re`, "f");

    // Title in crisp white
    commands.push(
      "1 1 1 rg",
      "BT",
      "/F2 8.5 Tf",
      `53 ${y} Td`,
      `${encodeProAuditPdfHexText(fitTextToWidth(rawTitle, tier ? 400 : 480, 8.5, true))} Tj`,
      "ET",
    );

    // Tier badge pill on right
    if (tier === "BASIC") {
      commands.push("0.28 0.33 0.42 rg", `488 ${y - 2} 55 12 re`, "f");
      commands.push("1 1 1 rg", "BT", "/F2 7 Tf", `496 ${y + 1} Td`, `${encodeProAuditPdfHexText("BASIC")} Tj`, "ET");
    } else if (tier === "PRO") {
      commands.push("0.18 0.38 0.78 rg", `498 ${y - 2} 45 12 re`, "f");
      commands.push("1 1 1 rg", "BT", "/F2 7 Tf", `508 ${y + 1} Td`, `${encodeProAuditPdfHexText("PRO")} Tj`, "ET");
    } else if (tier === "ADVANCED") {
      commands.push("0.72 0.52 0.12 rg", `474 ${y - 2} 69 12 re`, "f");
      commands.push("1 1 1 rg", "BT", "/F2 7 Tf", `480 ${y + 1} Td`, `${encodeProAuditPdfHexText("ADVANCED")} Tj`, "ET");
    }

    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 2b. Institutional Cryptographic Merkle Seal Card
  const merkleMatch = trimmed.match(/^(?:Merkle Root|Piecz[eę]ć? Merkle(?: SHA-256)?|Merkle-Wurzel|Cryptographic Seal):\s*(sha256:[a-fA-F0-9]{32,64}|[a-fA-F0-9]{32,64})/i);
  if (merkleMatch) {
    return renderInstitutionalMerkleSealCard(
      {
        merkleRoot: merkleMatch[1],
        documentId: documentId || cleanProAuditPdfInput(row.text, "velmere-audit", 32),
      },
      y
    );
  }

  // 2c. Institutional 2D QR Verification Card (ISO/IEC 18004)
  const qrMatch = trimmed.match(/^(?:Weryfikacja QR|QR Verification|QR-Verifizierung|QR Code):\s*(https?:\/\/\S+)/i);
  if (qrMatch) {
    const qrUrl = qrMatch[1].trim();
    const qrHeight = 52;
    const qrY = y - qrHeight + 10;
    // Card frame: clean white/slate with gold accent border
    commands.push(
      "0.97 0.98 0.99 rg",
      "0.77 0.62 0.31 RG",
      "0.75 w",
      `44 ${qrY} 507 ${qrHeight} re`,
      "B"
    );
    // Left gold spine
    commands.push("0.77 0.62 0.31 rg", `44 ${qrY} 4 ${qrHeight} re`, "f");
    // Vector QR matrix
    const matrix = generateQrMatrix21x21(qrUrl);
    const qrCommands = generateQrCodePdfCommands(matrix, 54, qrY + 6, 40, "0.12 0.18 0.32");
    commands.push(...qrCommands);
    // Text labels on right of QR code
    commands.push(
      "0.12 0.18 0.32 rg",
      "BT", "/F2 8.5 Tf",
      `104 ${qrY + 34} Td`,
      `${encodeProAuditPdfHexText("VELMERE INSTITUTIONAL QR VERIFICATION MATRIX")} Tj`,
      "ET",
      "0.35 0.40 0.48 rg",
      "BT", "/F1 7.5 Tf",
      `104 ${qrY + 22} Td`,
      `${encodeProAuditPdfHexText("ISO/IEC 18004 Compliant 2D Barcode | Direct On-Chain & Forensic Verification")} Tj`,
      "ET",
      "0.18 0.38 0.78 rg",
      "BT", "/F2 7 Tf",
      `104 ${qrY + 10} Td`,
      `${encodeProAuditPdfHexText(fitTextToWidth(qrUrl, 435, 7, true))} Tj`,
      "ET",
      "0 0 0 rg"
    );
    return { commands, actualHeight: qrHeight + 6 };
  }

  // 3. Executive Verdict Card
  const verdictMatch = trimmed.match(/^(WERDYKT KOŃCOWY|VERDICT SUMMARY|ENDGÜLTIGES URTEIL):\s*(.*)$/i);
  if (verdictMatch) {
    const verdictTitle = verdictMatch[1].toUpperCase();
    const verdictValue = verdictMatch[2].trim();
    const upperVal = verdictValue.toUpperCase();

    // Severity color calculation
    let r = 0.45, g = 0.40, b = 0.55; // default violet/slate
    if (upperVal.includes("CRITICAL") || upperVal.includes("KRYTYCZNE")) {
      r = 0.85; g = 0.15; b = 0.15;
    } else if (upperVal.includes("HIGH") || upperVal.includes("WYSOKIE") || upperVal.includes("ERHÖHT")) {
      r = 0.88; g = 0.42; b = 0.10;
    } else if (upperVal.includes("MODERATE") || upperVal.includes("UMIARKOWANE")) {
      r = 0.82; g = 0.58; b = 0.12;
    } else if (upperVal.includes("LOW") || upperVal.includes("NISKIE") || upperVal.includes("MINIMAL")) {
      r = 0.15; g = 0.60; b = 0.30;
    }

    // Card frame
    commands.push("0.96 0.97 0.99 rg", "0.80 0.84 0.90 RG", "0.75 w", `44 ${y - 5} 507 19 re`, "B");
    // Left color bar
    commands.push(`${r} ${g} ${b} rg`, `44 ${y - 5} 4 19 re`, "f");
    // Verdict title
    commands.push("0.10 0.12 0.18 rg", "BT", "/F2 8.5 Tf", `54 ${y} Td`, `${encodeProAuditPdfHexText(`${verdictTitle}:`)} Tj`, "ET");
    // Dynamic verdict badge pill on right - sized to content up to 320pt to prevent text truncation
    const verdictEstW = estimateTextWidthPoints(verdictValue, 7.5, true);
    const badgeW = Math.min(320, Math.max(120, verdictEstW + 20));
    const badgeX = 547 - badgeW;
    commands.push(`${r} ${g} ${b} rg`, `${badgeX} ${y - 3} ${badgeW} 15 re`, "f");
    commands.push("1 1 1 rg", "BT", "/F2 7.5 Tf", `${badgeX + 8} ${y + 1} Td`, `${encodeProAuditPdfHexText(fitTextToWidth(verdictValue, badgeW - 14, 7.5, true))} Tj`, "ET");

    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 4. Dual Confidence & Coverage Meters
  const dualMeterMatch = trimmed.match(/^(Confidence Score|Wskaźnik pewności|Vertrauensbewertung):\s*(\d+\/100)\s*\|\s*(Evidence Coverage|Pokrycie dowodami|Beweisabdeckung):\s*(\d+%)/i);
  if (dualMeterMatch) {
    const l1 = dualMeterMatch[1], v1 = dualMeterMatch[2], l2 = dualMeterMatch[3], v2 = dualMeterMatch[4];
    commands.push("0.97 0.98 0.99 rg", "0.88 0.90 0.94 RG", "0.5 w", `44 ${y - 3} 507 14 re`, "B");
    commands.push("0.38 0.42 0.48 rg", "BT", "/F1 7.5 Tf", `52 ${y} Td`, `${encodeProAuditPdfHexText(`${l1}:`)} Tj`, "ET");
    commands.push("0.20 0.25 0.35 rg", `155 ${y - 1.5} 44 11 re`, "f");
    commands.push("1 1 1 rg", "BT", "/F2 7 Tf", `160 ${y + 1} Td`, `${encodeProAuditPdfHexText(v1)} Tj`, "ET");

    commands.push("0.38 0.42 0.48 rg", "BT", "/F1 7.5 Tf", `290 ${y} Td`, `${encodeProAuditPdfHexText(`${l2}:`)} Tj`, "ET");
    commands.push("0.15 0.55 0.30 rg", `395 ${y - 1.5} 36 11 re`, "f");
    commands.push("1 1 1 rg", "BT", "/F2 7 Tf", `402 ${y + 1} Td`, `${encodeProAuditPdfHexText(v2)} Tj`, "ET");

    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 5. Analysis / Verification Type Bar
  const analysisTypeMatch = trimmed.match(/^(ANALYSIS TYPE|TYP ANALIZY|ANALYSETYP|VERIFICATION TYPE|TYP WERYFIKACJI|VERIFIZIERUNGSTYP):\s*(.*)$/i);
  if (analysisTypeMatch) {
    commands.push("0.45 0.50 0.60 rg", `48 ${y + 2} 4 4 re`, "f");
    commands.push("0.35 0.40 0.50 rg", "BT", "/F2 7.5 Tf", `56 ${y} Td`, `${encodeProAuditPdfHexText(trimmed)} Tj`, "ET");
    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 6. Structured Metric Row with Status Pill: Key : Value [STATUS]
  const metricMatch = trimmed.match(/^(.*?):\s*(.*?)\s*\[(VERIFIED|FLAGGED|LOCKED|NEUTRAL|PASS|FAIL)\]$/i);
  if (metricMatch) {
    const label = metricMatch[1].trim();
    const val = metricMatch[2].trim();
    const status = metricMatch[3].toUpperCase();

    // Subtle divider line
    commands.push("0.92 0.93 0.95 RG", "0.3 w", `48 ${y - 3} m`, `547 ${y - 3} l`, "S");

    // Dynamic width allocation between label and value to prevent truncation of either
    const pillW = 66;
    const pillX = 547 - pillW;
    const availableWidth = pillX - 52 - 12; // ~417pt
    const labelEst = estimateTextWidthPoints(label, 8);
    const valEst = estimateTextWidthPoints(val, 8, true);

    let labelMax = Math.min(availableWidth - 90, Math.max(160, labelEst + 6));
    let valMax = availableWidth - labelMax;
    if (valEst > valMax && labelEst < labelMax) {
      labelMax = Math.max(130, availableWidth - valEst - 10);
      valMax = availableWidth - labelMax;
    }
    const valX = 52 + labelMax + 8;

    // Label in muted slate
    commands.push("0.35 0.40 0.48 rg", "BT", "/F1 8 Tf", `52 ${y} Td`, `${encodeProAuditPdfHexText(fitTextToWidth(label, labelMax, 8))} Tj`, "ET");
    // Value in dark charcoal
    commands.push("0.08 0.08 0.10 rg", "BT", "/F2 8 Tf", `${valX} ${y} Td`, `${encodeProAuditPdfHexText(fitTextToWidth(val, valMax, 8, true))} Tj`, "ET");

    // Status pill
    let pr = 0.60, pg = 0.63, pb = 0.68; // neutral
    if (status === "VERIFIED" || status === "PASS") {
      pr = 0.15; pg = 0.60; pb = 0.32;
    } else if (status === "FLAGGED" || status === "FAIL") {
      pr = 0.82; pg = 0.18; pb = 0.18;
    } else if (status === "LOCKED") {
      pr = 0.48; pg = 0.52; pb = 0.58;
    }

    commands.push(`${pr} ${pg} ${pb} rg`, `${pillX} ${y - 2} ${pillW} 10 re`, "f");
    const statusTextW = estimateTextWidthPoints(status, 6.5, true);
    const statusTextX = pillX + Math.max(4, (pillW - statusTextW) / 2);
    commands.push("1 1 1 rg", "BT", "/F2 6.5 Tf", `${statusTextX} ${y + 1} Td`, `${encodeProAuditPdfHexText(status)} Tj`, "ET");

    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 7. Finding Card Header: - [SEVERITY] ID: Title
  const findingMatch = trimmed.match(/^-\s*\[(CRITICAL|HIGH|MEDIUM|LOW|INFORMATIONAL|INFO)\]\s*(.*?):\s*(.*)$/i);
  if (findingMatch) {
    const severity = findingMatch[1].toUpperCase();
    const findingId = findingMatch[2].trim();
    const findingTitle = findingMatch[3].trim();

    let fr = 0.50, fg = 0.55, fb = 0.62;
    if (severity === "CRITICAL") {
      fr = 0.85; fg = 0.15; fb = 0.15;
    } else if (severity === "HIGH") {
      fr = 0.88; fg = 0.42; fb = 0.10;
    } else if (severity === "MEDIUM") {
      fr = 0.82; fg = 0.60; fb = 0.10;
    } else if (severity === "LOW") {
      fr = 0.15; fg = 0.50; fb = 0.80;
    }

    commands.push("0.98 0.98 0.99 rg", "0.86 0.88 0.92 RG", "0.5 w", `48 ${y - 3} 499 13 re`, "B");
    commands.push(`${fr} ${fg} ${fb} rg`, `48 ${y - 3} 3.5 13 re`, "f");
    commands.push(`${fr} ${fg} ${fb} rg`, `56 ${y - 1.5} 42 10 re`, "f");
    commands.push("1 1 1 rg", "BT", "/F2 6.5 Tf", `60 ${y + 1} Td`, `${encodeProAuditPdfHexText(severity)} Tj`, "ET");
    const idWidth = estimateTextWidthPoints(`${findingId}:`, 7.5, true);
    commands.push("0.20 0.25 0.35 rg", "BT", "/F2 7.5 Tf", `104 ${y} Td`, `${encodeProAuditPdfHexText(`${findingId}:`)} Tj`, "ET");
    const titleX = 104 + idWidth + 6;
    const titleMax = 544 - titleX;
    commands.push("0.08 0.08 0.10 rg", "BT", "/F2 7.5 Tf", `${titleX} ${y} Td`, `${encodeProAuditPdfHexText(fitTextToWidth(findingTitle, titleMax, 7.5, true))} Tj`, "ET");

    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 8. Finding Sub-lines (Evidence, Category, Recommendation, Attack Scenario)
  const findingSubMatch = trimmed.match(/^(Dowód|Evidence|Beweis|Rekomendacja|Recommendation|Empfehlung|Kategoria|Category|Kategorie|Status|State|Scenariusz ataku|Attack Scenario|Angriffsszenario):\s*(.*)$/i);
  if (findingSubMatch) {
    const subTag = findingSubMatch[1].trim();
    const subVal = findingSubMatch[2].trim();
    const tagWidth = estimateTextWidthPoints(`${subTag}:`, 7.5, true);
    const subValX = 58 + tagWidth + 6;
    const subValMax = 547 - subValX;
    commands.push("0.40 0.44 0.52 rg", "BT", "/F2 7.5 Tf", `58 ${y} Td`, `${encodeProAuditPdfHexText(`${subTag}:`)} Tj`, "ET");
    commands.push("0.18 0.20 0.24 rg", "BT", "/F1 7.5 Tf", `${subValX} ${y} Td`, `${encodeProAuditPdfHexText(fitTextToWidth(subVal, subValMax, 7.5))} Tj`, "ET");
    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 9. Locked Section Entitlement Teaser Banner
  const lockedMatch = trimmed.match(/^\[(SEKCJA ZABLOKOWANA|GESPERRTER ABSCHNITT|LOCKED SECTION)\s*-\s*(.*?)\]$/i);
  if (lockedMatch) {
    commands.push("0.95 0.96 0.99 rg", "0.75 0.80 0.90 RG", "0.75 w", `44 ${y - 4} 507 17 re`, "B");
    commands.push("0.18 0.38 0.78 rg", `44 ${y - 4} 4 17 re`, "f");
    commands.push("0.20 0.35 0.65 rg", `52 ${y - 2} 48 12 re`, "f");
    commands.push("1 1 1 rg", "BT", "/F2 6.5 Tf", `56 ${y} Td`, `${encodeProAuditPdfHexText("[LOCKED]")} Tj`, "ET");
    commands.push("0.15 0.22 0.45 rg", "BT", "/F2 8 Tf", `106 ${y} Td`, `${encodeProAuditPdfHexText(fitTextToWidth(trimmed, 430, 8, true))} Tj`, "ET");
    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 10. Reviewer State Attestation Seal
  const reviewerMatch = trimmed.match(/^(Reviewer State|Stan weryfikacji|Prüferstatus):\s*(.*)$/i);
  if (reviewerMatch) {
    const revVal = reviewerMatch[2].trim().toUpperCase();
    if (revVal.includes("NOT COMMISSIONED") || revVal.includes("BRAK") || revVal.includes("PENDING")) {
      commands.push("0.97 0.97 0.98 rg", "0.85 0.87 0.90 RG", "0.5 w", `44 ${y - 3} 507 14 re`, "B");
      commands.push("0.38 0.42 0.48 rg", "BT", "/F2 7.5 Tf", `52 ${y} Td`, `${encodeProAuditPdfHexText(trimmed)} Tj`, "ET");
    } else {
      commands.push("0.95 0.98 0.95 rg", "0.50 0.75 0.55 RG", "0.75 w", `44 ${y - 4} 507 16 re`, "B");
      commands.push("0.15 0.65 0.30 rg", `44 ${y - 4} 4 16 re`, "f");
      commands.push("0.10 0.45 0.20 rg", "BT", "/F2 8 Tf", `54 ${y} Td`, `${encodeProAuditPdfHexText(trimmed)} Tj`, "ET");
      commands.push("0.15 0.60 0.30 rg", `475 ${y - 2} 70 11 re`, "f");
      commands.push("1 1 1 rg", "BT", "/F2 6.5 Tf", `483 ${y + 1} Td`, `${encodeProAuditPdfHexText("[VERIFIED]")} Tj`, "ET");
    }
    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 11. Findings section subhead
  if (/^(Findings|Ustalenia|Befunde):$/i.test(trimmed)) {
    commands.push("0.20 0.25 0.35 rg", "BT", "/F2 8.5 Tf", `48 ${y} Td`, `${encodeProAuditPdfHexText(trimmed)} Tj`, "ET");
    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 12. Code diff patch lines in Advanced Tier
  if (trimmed.startsWith("+ ") || (trimmed.startsWith("+") && trimmed.length > 2)) {
    commands.push("0.93 0.98 0.93 rg", `52 ${y - 2} 492 11 re`, "f");
    commands.push("0.10 0.50 0.20 rg", "BT", "/F1 7.5 Tf", `56 ${y} Td`, `${encodeProAuditPdfHexText(fitTextToWidth(trimmed, 480, 7.5))} Tj`, "ET");
    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }
  if (trimmed.startsWith("- ") || (trimmed.startsWith("-") && !trimmed.startsWith("- [") && trimmed.length > 2)) {
    commands.push("0.99 0.93 0.93 rg", `52 ${y - 2} 492 11 re`, "f");
    commands.push("0.70 0.15 0.15 rg", "BT", "/F1 7.5 Tf", `56 ${y} Td`, `${encodeProAuditPdfHexText(fitTextToWidth(trimmed, 480, 7.5))} Tj`, "ET");
    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 13. Bullet list line
  const bulletMatch = trimmed.match(/^\*\s*(.*)$/);
  if (bulletMatch) {
    commands.push("0.77 0.62 0.31 rg", `52 ${y + 2} 3 3 re`, "f");
    commands.push("0.20 0.22 0.28 rg", "BT", "/F1 8 Tf", `60 ${y} Td`, `${encodeProAuditPdfHexText(fitTextToWidth(bulletMatch[1].trim(), 480, 8))} Tj`, "ET");
    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 13. Key-Value Information Pair (Generic)
  const kvMatch = text.match(/^\s{2,4}(.*?):\s*(.*?)$/);
  if (kvMatch && !kvMatch[1].startsWith("-") && !kvMatch[1].startsWith("*")) {
    const label = kvMatch[1].trim();
    const val = kvMatch[2].trim();
    commands.push("0.94 0.95 0.97 RG", "0.25 w", `48 ${y - 3} m`, `547 ${y - 3} l`, "S");
    const labelW = estimateTextWidthPoints(label, 8);
    const labelMax = Math.min(260, Math.max(150, labelW + 6));
    const valX = 52 + labelMax + 8;
    const valMax = 547 - valX;
    commands.push("0.35 0.40 0.48 rg", "BT", "/F1 8 Tf", `52 ${y} Td`, `${encodeProAuditPdfHexText(fitTextToWidth(label, labelMax, 8))} Tj`, "ET");
    commands.push("0.08 0.08 0.10 rg", "BT", "/F1 8 Tf", `${valX} ${y} Td`, `${encodeProAuditPdfHexText(fitTextToWidth(val, valMax, 8))} Tj`, "ET");
    commands.push("0 0 0 rg");
    return { commands, actualHeight: row.height };
  }

  // 14. Default fallback
  commands.push("0 0 0 rg", "BT", `${row.heading ? "/F2 10 Tf" : "/F1 9 Tf"}`, `44 ${y} Td`, `${encodeProAuditPdfHexText(row.text)} Tj`, "ET");
  return { commands, actualHeight: row.height };
}

export function buildCustomerSafeMinimalPdf(lines: string[], options: CustomerSafePdfOptions = {}) {
  const plan = planCustomerSafePdf(lines, options);
  const catalogId = 1, pagesId = 2, regularFontId = 3, boldFontId = 4, encodingId = 5;
  const regularDescriptorId = 6, boldDescriptorId = 7, regularFontFileId = 8, boldFontFileId = 9;
  const toUnicodeId = 10, infoId = 11;
  const pageObjectIds = plan.pages.map((_, index) => 12 + index * 2);
  const contentObjectIds = plan.pages.map((_, index) => 13 + index * 2);
  const objects = new Map<number, string>();
  objects.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects.set(pagesId, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`);
  objects.set(regularFontId, `<< /Type /Font /Subtype /Type1 /BaseFont /VLMREG+NimbusSans-Regular /FirstChar 32 /LastChar 255 /Widths [${pdfFontWidths(false)}] /FontDescriptor ${regularDescriptorId} 0 R /Encoding ${encodingId} 0 R /ToUnicode ${toUnicodeId} 0 R >>`);
  objects.set(boldFontId, `<< /Type /Font /Subtype /Type1 /BaseFont /VLMBLD+NimbusSans-Bold /FirstChar 32 /LastChar 255 /Widths [${pdfFontWidths(true)}] /FontDescriptor ${boldDescriptorId} 0 R /Encoding ${encodingId} 0 R /ToUnicode ${toUnicodeId} 0 R >>`);
  objects.set(encodingId, fontEncodingObject());
  objects.set(regularDescriptorId, `<< /Type /FontDescriptor /FontName /VLMREG+NimbusSans-Regular /FontFamily (Nimbus Sans) /Flags 32 /FontBBox [-210 -299 1032 1075] /ItalicAngle 0 /Ascent 729 /Descent -271 /CapHeight 729 /StemV 80 /FontFile3 ${regularFontFileId} 0 R >>`);
  objects.set(boldDescriptorId, `<< /Type /FontDescriptor /FontName /VLMBLD+NimbusSans-Bold /FontFamily (Nimbus Sans) /Flags 32 /FontBBox [-188 -307 1069 1070] /ItalicAngle 0 /Ascent 729 /Descent -271 /CapHeight 729 /StemV 120 /FontFile3 ${boldFontFileId} 0 R >>`);
  objects.set(regularFontFileId, embeddedCffStream(VELMERE_SANS_REGULAR_CFF_ZLIB_BASE64, 15_263));
  objects.set(boldFontFileId, embeddedCffStream(VELMERE_SANS_BOLD_CFF_ZLIB_BASE64, 15_654));
  const cmap = toUnicodeCmap();
  objects.set(toUnicodeId, `<< /Length ${Buffer.byteLength(cmap, "ascii")} >>\nstream\n${cmap}\nendstream`);
  objects.set(infoId, `<< /Title ${encodePdfMetadataText(plan.title)} /Subject ${encodePdfMetadataText(`${plan.subtitle} | ${plan.documentId}`)} /Creator ${encodePdfMetadataText("Velmere Security")} /Producer ${encodePdfMetadataText(`Velmere deterministic PDF 1.7 | ${PASS4808_PDF_RENDER_CONTRACT_ID}`)} /CreationDate (${pdfDate(plan.generatedAt)}) /ModDate (${pdfDate(plan.generatedAt)}) /Keywords ${encodePdfMetadataText(`${plan.classification};${plan.locale};${plan.documentId};${plan.planDigest}`)} >>`);

  plan.pages.forEach((page, index) => {
    const pageId = pageObjectIds[index], contentId = contentObjectIds[index];
    const commands = [
      // Top luxury gold accent bar
      "0.77 0.62 0.31 rg", "44 822 507 2.5 re", "f",
      // Header typography
      "0 0 0 rg",
      "BT", "/F2 18 Tf", "44 796 Td", `${encodeProAuditPdfHexText(plan.title)} Tj`, "ET",
      "0.4 0.4 0.4 rg",
      "BT", "/F1 9 Tf", "44 776 Td", `${encodeProAuditPdfHexText(plan.subtitle)} Tj`, "ET",
      // Thin header divider rule
      "0.88 0.88 0.88 RG", "0.75 w", "44 766 m", "551 766 l", "S",
      "0 0 0 rg"
    ];
    let y = 744;
    for (const row of page.rows) {
      const rendered = renderStyledPdfRow(row, y, plan.documentId);
      if (rendered.commands.length > 0) {
        commands.push(...rendered.commands);
      }
      y -= rendered.actualHeight;
    }
    commands.push(
      "BT", "/F1 7 Tf", "44 34 Td", `${encodeProAuditPdfHexText(fitTextToWidth(`${plan.issuerLine} | Page ${index + 1}/${plan.pages.length}`, 500, 7))} Tj`, "ET",
      "BT", "/F1 7 Tf", "44 23 Td", `${encodeProAuditPdfHexText(plan.footer)} Tj`, "ET",
      "BT", "/F1 7 Tf", "44 12 Td", `${encodeProAuditPdfHexText(plan.integrityLine)} Tj`, "ET",
    );
    const content = commands.join("\n");
    objects.set(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`);
  });

  const trailerId = plan.planDigest.slice("sha256:".length, "sha256:".length + 32);
  const objectCount = Math.max(...objects.keys());
  let pdf = "%PDF-1.7\n%Velmere\n";
  const offsets = Array.from({ length: objectCount + 1 }, () => 0);
  for (let id = 1; id <= objectCount; id += 1) {
    const body = objects.get(id);
    if (!body) throw new Error(`pdf_object_missing:${id}`);
    offsets[id] = Buffer.byteLength(pdf, "ascii");
    pdf += `${id} 0 obj\n${body}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objectCount; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objectCount + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R /ID [<${trailerId}><${trailerId}>] >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}

/** Byte-identical legacy renderer for snapshots produced before PASS4808. */
export function buildCustomerSafeMinimalPdfLegacyV1(lines: string[], options: CustomerSafePdfOptions = {}) {
  const title = toProAuditPdfAscii(options.title || "VELMERE AUDIT REPORT").slice(0, 72);
  const subtitle = toProAuditPdfAscii(options.subtitle || "Evidence-bound customer report").slice(0, 96);
  const footer = toProAuditPdfAscii(options.footer || "Velmere | Passive public-source review | Not a guarantee of safety").slice(0, 108);
  const maxLines = Math.max(40, Math.min(720, Math.trunc(options.maxLines || 480)));
  const documentId = cleanProAuditPdfInput(options.documentId ?? "velmere-audit", "velmere-audit", 120);
  const generatedAt = Number.isFinite(new Date(options.generatedAt ?? "").getTime()) ? String(options.generatedAt) : new Date().toISOString();
  const locale = options.locale ?? "en";
  const classification = options.classification ?? "customer_safe";
  const safeLines = lines.filter(isCustomerSafeProAuditPdfLine).flatMap((line) => {
    const clean = toProAuditPdfAscii(line).replace(/\s+/g, " ").trimEnd();
    if (!clean) return [""];
    const rows: string[] = [];
    let remaining = clean;
    while (remaining.length > 92) {
      const cut = Math.max(1, remaining.lastIndexOf(" ", 92));
      rows.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trimStart();
    }
    rows.push(remaining);
    return rows;
  }).slice(0, maxLines);
  const maximumLinesPerPage = 38;
  const plannedPageCount = Math.max(1, Math.ceil(safeLines.length / maximumLinesPerPage));
  const balancedLinesPerPage = Math.max(1, Math.min(maximumLinesPerPage, Math.ceil(safeLines.length / plannedPageCount)));
  const pageChunks: string[][] = [];
  for (let index = 0; index < safeLines.length; index += balancedLinesPerPage) pageChunks.push(safeLines.slice(index, index + balancedLinesPerPage));
  if (pageChunks.length === 0) pageChunks.push(["No customer-safe report content was available."]);

  const catalogId = 1, pagesId = 2, regularFontId = 3, boldFontId = 4, infoId = 5;
  const pageObjectIds = pageChunks.map((_, index) => 6 + index * 2);
  const contentObjectIds = pageChunks.map((_, index) => 7 + index * 2);
  const objects = new Map<number, string>();
  objects.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects.set(pagesId, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`);
  objects.set(regularFontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.set(boldFontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  objects.set(infoId, `<< /Title (${escapeProAuditPdfText(title)}) /Subject (${escapeProAuditPdfText(`${subtitle} | ${documentId}`)}) /Creator (Velmere Security) /Producer (Velmere deterministic PDF 1.7) /CreationDate (${pdfDate(generatedAt)}) /ModDate (${pdfDate(generatedAt)}) /Keywords (${escapeProAuditPdfText(`${classification};${locale};${documentId}`)}) >>`);

  pageChunks.forEach((pageLines, index) => {
    const pageId = pageObjectIds[index], contentId = contentObjectIds[index];
    const commands = ["BT", "/F2 18 Tf", "44 800 Td", `(${escapeProAuditPdfText(title)}) Tj`, "ET", "BT", "/F1 9 Tf", "44 776 Td", `(${escapeProAuditPdfText(subtitle)}) Tj`, "ET"];
    let y = 744;
    for (const line of pageLines) {
      const useBold = heading(line);
      commands.push("BT", `${useBold ? "/F2 10 Tf" : "/F1 9 Tf"}`, `44 ${y} Td`, `(${escapeProAuditPdfText(line)}) Tj`, "ET");
      y -= useBold ? 18 : 16;
    }
    commands.push("BT", "/F1 8 Tf", "44 28 Td", `(${escapeProAuditPdfText(`${footer} | Page ${index + 1}/${pageChunks.length}`)}) Tj`, "ET");
    const content = commands.join("\n");
    objects.set(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
  });

  const digestSeed = JSON.stringify({ title, subtitle, footer, documentId, generatedAt, locale, classification, safeLines });
  const documentDigest = crypto.createHash("sha256").update(digestSeed).digest("hex");
  const trailerId = documentDigest.slice(0, 32);
  const objectCount = Math.max(...objects.keys());
  let pdf = "%PDF-1.7\n%Velmere\n";
  const offsets = Array.from({ length: objectCount + 1 }, () => 0);
  for (let id = 1; id <= objectCount; id += 1) {
    const body = objects.get(id);
    if (!body) throw new Error(`pdf_object_missing:${id}`);
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${body}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objectCount; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objectCount + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R /ID [<${trailerId}><${trailerId}>] >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
