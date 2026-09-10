import {
  pageCountForDepth,
  type LensTierPageCount,
  type LensTierPageDepth,
} from "./lens-tier-page-count";

export type Pass611PdfAccessibilityPhase2 = {
  version: "pdf-accessibility-phase-2";
  state: "structured_not_pdfua";
  documentLanguage: "pl-PL" | "de-DE" | "en-US";
  reader: {
    headingOutline: Array<{ level: 1 | 2; id: string; label: string }>;
    descriptiveLinks: true;
    chartAlternative: string;
    readingOrder: string[];
  };
  pdf: {
    structTreeRootPrepared: true;
    markedContent: true;
    pageSections: LensTierPageCount;
    titleMetadata: true;
    languageMetadata: true;
    pdfUaClaim: false;
  };
  boundary: string;
};

function localeOf(locale: string): "pl" | "de" | "en" {
  return locale === "de" || locale === "en" ? locale : "pl";
}

export function buildPass611PdfAccessibilityPhase2(input: {
  locale: string;
  depth: LensTierPageDepth;
  symbol: string;
  title: string;
  pageTitles: readonly string[];
  price?: number;
  change24h?: number;
  sourceEvidenceCoverage?: number;
  /** @deprecated Compatibility input; interpreted as evidence coverage, not calibrated confidence. */
  sourceConfidence?: number;
}): Pass611PdfAccessibilityPhase2 {
  const locale = localeOf(input.locale);
  const sourceEvidenceCoverage = Math.max(0, Math.min(100, Math.round(input.sourceEvidenceCoverage ?? input.sourceConfidence ?? 0)));
  const documentLanguage = locale === "de" ? "de-DE" : locale === "en" ? "en-US" : "pl-PL";
  const chartAlternative =
    locale === "de"
      ? `${input.symbol}: Datenzusammenfassung statt dekorativer Grafik. Preis ${input.price ?? "nicht verfügbar"}, 24-Stunden-Änderung ${input.change24h ?? "nicht verfügbar"}, Evidenzabdeckung ${sourceEvidenceCoverage} Prozent.`
      : locale === "en"
        ? `${input.symbol}: data summary instead of a decorative chart. Price ${input.price ?? "unavailable"}, 24-hour change ${input.change24h ?? "unavailable"}, source evidence coverage ${sourceEvidenceCoverage} percent.`
        : `${input.symbol}: tekstowe podsumowanie danych zamiast dekoracyjnego wykresu. Cena ${input.price ?? "brak"}, zmiana 24h ${input.change24h ?? "brak"}, pokrycie dowodów źródłowych ${sourceEvidenceCoverage} procent.`;
  const pageCount = pageCountForDepth(input.depth);
  const pageIds = [
    "decision",
    "evidence",
    "analysis",
    "boundary",
    "evidence-ledger",
    "claim-map",
    "missing-recheck",
    "methodology-signature",
  ].slice(0, pageCount);
  return {
    version: "pdf-accessibility-phase-2",
    state: "structured_not_pdfua",
    documentLanguage,
    reader: {
      headingOutline: [
        { level: 1, id: "document-title", label: input.title },
        ...pageIds.map((id, index) => ({
          level: 2 as const,
          id: `page-${id}`,
          label: input.pageTitles[index] || id,
        })),
      ],
      descriptiveLinks: true,
      chartAlternative,
      readingOrder: pageIds.map((id) => `page-${id}`),
    },
    pdf: {
      structTreeRootPrepared: true,
      markedContent: true,
      pageSections: pageCount,
      titleMetadata: true,
      languageMetadata: true,
      pdfUaClaim: false,
    },
    boundary:
      "The binary now carries a real StructTreeRoot preparation and marked page sections, but Velmère does not claim PDF/UA conformance until complete tag coverage and external validation are proven.",
  };
}
