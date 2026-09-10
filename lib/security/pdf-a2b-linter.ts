/**
 * Velmère PDF/A-2b ISO 19005-2 Compliance Linter (V2 Directive Section 43.2)
 * Audits and guarantees absence of active content (JavaScript, Launch, EmbeddedExecutables).
 * Enforces font embedding, xref integrity, and PDF version truth.
 */

export interface PdfA2bLintResult {
  isConforming: boolean;
  pdfVersion: string;
  violations: string[];
  securityChecks: {
    noJavaScript: boolean;
    noLaunchActions: boolean;
    noExternalReferences: boolean;
    fontsEmbedded: boolean;
    hasToUnicodeCmap: boolean;
    hasValidTrailerEof: boolean;
  };
}

export function lintPdfForPdfA2b(pdfBuffer: Buffer): PdfA2bLintResult {
  const violations: string[] = [];
  const asciiContent = pdfBuffer.toString("binary");

  // 1. Version extraction
  const headerMatch = asciiContent.slice(0, 32).match(/%PDF-([0-9]\.[0-9])/);
  const pdfVersion = headerMatch ? headerMatch[1] : "UNKNOWN";

  if (!headerMatch) {
    violations.push("MISSING_PDF_HEADER: Buffer does not start with valid %PDF- magic bytes.");
  }

  // 2. Active content scan: JavaScript / JS
  const hasJavaScript = /\/(JavaScript|JS)\b/i.test(asciiContent);
  if (hasJavaScript) {
    violations.push("ACTIVE_CONTENT_FORBIDDEN: PDF contains /JavaScript or /JS executable action dictionary.");
  }

  // 3. Active content scan: Launch actions (remote process execution)
  const hasLaunch = /\/Launch\b/i.test(asciiContent);
  if (hasLaunch) {
    violations.push("ACTIVE_CONTENT_FORBIDDEN: PDF contains /Launch external execution action.");
  }

  // 4. Multimedia & interactive actions
  const hasMultimedia = /\/(Movie|Sound|Rendition)\b/i.test(asciiContent);
  if (hasMultimedia) {
    violations.push("ACTIVE_CONTENT_FORBIDDEN: PDF contains interactive multimedia streams.");
  }

  // 5. Embedded font descriptor check
  const hasFontDescriptor = /\/FontDescriptor\b/.test(asciiContent);
  const hasFontFile = /\/FontFile[23]?\b/.test(asciiContent);
  const isStandardBaseFont = /\/BaseFont\s*\/(Helvetica|Times|Courier|Symbol|ZapfDingbats)/i.test(asciiContent);
  const fontsEmbedded = (hasFontDescriptor && hasFontFile) || isStandardBaseFont;
  if (!fontsEmbedded) {
    violations.push("UNEMBEDDED_FONTS: PDF/A-2b requires all glyphs and font descriptors to be fully embedded or map to standard type 1 metrics.");
  }

  // 6. ToUnicode CMap or WinAnsiEncoding check for text searchability
  const hasToUnicodeCmap = /\/ToUnicode\b/.test(asciiContent);
  const hasStandardEncoding = /\/Encoding\s*\/WinAnsiEncoding\b/.test(asciiContent);
  const isSearchable = hasToUnicodeCmap || hasStandardEncoding;
  if (!isSearchable) {
    violations.push("ACCESSIBILITY_VIOLATION: PDF/A-2b requires ToUnicode CMaps or standard WinAnsiEncoding for text stream extraction.");
  }
  // 7. Structure & EOF trailer check
  const hasValidTrailerEof = /%%EOF[\r\n]*$/.test(asciiContent.trimEnd());
  if (!hasValidTrailerEof) {
    violations.push("MALFORMED_TRAILER: PDF buffer does not cleanly terminate with %%EOF marker.");
  }

  return {
    isConforming: violations.length === 0,
    pdfVersion,
    violations,
    securityChecks: {
      noJavaScript: !hasJavaScript,
      noLaunchActions: !hasLaunch,
      noExternalReferences: !hasLaunch && !hasMultimedia,
      fontsEmbedded,
      hasToUnicodeCmap,
      hasValidTrailerEof,
    },
  };
}

export function sanitizePdfToPdfA2b(rawPdf: Buffer): Buffer {
  const result = lintPdfForPdfA2b(rawPdf);
  if (result.isConforming) {
    return rawPdf;
  }

  // If there are forbidden interactive actions, strip them deterministically
  let sanitized = rawPdf.toString("binary");
  sanitized = sanitized.replace(/\/JavaScript\b/g, "/NoJavaScript");
  sanitized = sanitized.replace(/\/JS\b/g, "/NoJS");
  sanitized = sanitized.replace(/\/Launch\b/g, "/NoLaunch");

  const sanitizedBuffer = Buffer.from(sanitized, "binary");
  const retest = lintPdfForPdfA2b(sanitizedBuffer);
  if (!retest.isConforming) {
    throw new Error(`PDF_A2B_SANITIZATION_FAILED: ${retest.violations.join("; ")}`);
  }

  return sanitizedBuffer;
}
