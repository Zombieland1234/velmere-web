import type { LensReportDepth, LensReportLocale } from "@/lib/search/lens-report-contract";
import {
  pageCountForDepth,
  type LensTierPageCount,
} from "./lens-tier-page-count";

type Pass1254TypographyState = "release_ready" | "review" | "blocked";

export type Pass1254PdfTypographyReleaseGate = {
  version: "pdf-typography-release-gate";
  state: Pass1254TypographyState;
  score: number;
  manifestKey: string;
  previewDownloadTypography: "same_reader_pdf_typography_budget";
  lineClamp: {
    title: number;
    metadata: number;
    body: number;
    footer: number;
  };
  reader: {
    mode: "premium_a4_reader";
    maxWidthRem: 54;
    mobileSingleColumn: true;
    noHorizontalOverflow: true;
  };
  pdf: {
    pageCount: LensTierPageCount;
    safeMargins: "46_46_36_36";
    footerLane: "single_line_no_overlap";
    longTokenPolicy: "hyphenate_then_ellipsis";
  };
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
  }>;
  copy: {
    badge: string;
    title: string;
    body: string;
  };
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function copy(locale: LensReportLocale, state: Pass1254TypographyState) {
  if (locale === "pl") {
    return {
      badge: state === "release_ready" ? "Typografia gotowa" : state === "review" ? "Typografia do kontroli" : "Typografia zablokowana",
      title: "PDF bez nachodzących tekstów",
      body: "Reader i pobierany PDF używają tego samego budżetu linii, skracania metadanych i jedno-kolumnowego trybu mobile.",
    };
  }
  if (locale === "de") {
    return {
      badge: state === "release_ready" ? "Typografie bereit" : state === "review" ? "Typografie prüfen" : "Typografie blockiert",
      title: "PDF ohne überlappende Texte",
      body: "Reader und Download-PDF nutzen dasselbe Zeilenbudget, gekürzte Metadaten und einen einspaltigen Mobile-Modus.",
    };
  }
  return {
    badge: state === "release_ready" ? "Typography ready" : state === "review" ? "Typography review" : "Typography blocked",
    title: "PDF without overlapping text",
    body: "Reader and downloaded PDF share one line budget, compact metadata and a single-column mobile mode.",
  };
}

export function buildPass1254PdfTypographyReleaseGate(input: {
  locale: LensReportLocale;
  depth: LensReportDepth;
  reportChecksum: string;
  sectionCount: number;
  sourceCount: number;
  missingCount: number;
  claimCount: number;
  readerDownloadManifest: string;
  evidenceManifest: string;
  typographyState: string;
  densityState: string;
  maxDensity: number;
  mobileBudgetState: string;
}): Pass1254PdfTypographyReleaseGate {
  const checks = [
    {
      id: "reader_pdf_same_budget",
      label: "Reader/PDF typography budget is shared",
      passed: Boolean(input.readerDownloadManifest && input.evidenceManifest),
    },
    {
      id: "long_token_policy",
      label: "Long tokens are hyphenated or ellipsized",
      passed: input.typographyState !== "blocked",
    },
    {
      id: "density_cap",
      label: "A4 density stays under hard cap",
      passed: input.densityState !== "blocked" && input.maxDensity <= 0.92,
    },
    {
      id: "mobile_single_column",
      label: "Mobile reader avoids horizontal overflow",
      passed: input.mobileBudgetState !== "blocked",
    },
    {
      id: "source_rows_bounded",
      label: "Source and gap rows are bounded before export",
      passed: input.sourceCount <= 8 && input.missingCount <= 12,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const score = clampScore((passed / checks.length) * 100);
  const state: Pass1254TypographyState = score >= 90 ? "release_ready" : score >= 70 ? "review" : "blocked";
  return {
    version: "pdf-typography-release-gate",
    state,
    score,
    manifestKey: `pass1254:${input.depth}:${input.reportChecksum.slice(0, 10)}:${input.readerDownloadManifest.slice(0, 10)}:${input.evidenceManifest.slice(0, 10)}`,
    previewDownloadTypography: "same_reader_pdf_typography_budget",
    lineClamp: {
      title: 68,
      metadata: 62,
      body: input.depth === "advanced" ? 118 : 104,
      footer: 86,
    },
    reader: {
      mode: "premium_a4_reader",
      maxWidthRem: 54,
      mobileSingleColumn: true,
      noHorizontalOverflow: true,
    },
    pdf: {
      pageCount: pageCountForDepth(input.depth),
      safeMargins: "46_46_36_36",
      footerLane: "single_line_no_overlap",
      longTokenPolicy: "hyphenate_then_ellipsis",
    },
    checks,
    copy: copy(input.locale, state),
  };
}
