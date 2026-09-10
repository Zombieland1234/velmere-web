import type { LensReport } from "@/lib/search/lens-report";

export type Pass505PageAudit = {
  id: string;
  label: string;
  index: number;
  sectionCount: number;
  estimatedLines: number;
  status: "ready" | "review";
};

export type Pass505PdfPageBreakAudit = {
  version: "pdf-page-break-audit";
  status: "ready" | "review";
  pageCountParity: boolean;
  pages: Pass505PageAudit[];
  warnings: string[];
};

export function buildPass505PdfPageBreakAudit(report: LensReport): Pass505PdfPageBreakAudit {
  const sectionsByPage: Record<(typeof report.pass488.pages)[number]["id"], LensReport["sections"][number]["id"][]> = {
    decision: ["brief", "next"],
    evidence: ["sources", "secondProvider", "missing"],
    analysis: ["marketData"],
    boundary: ["signature"],
  };
  const pages = report.pass488.pages.map((page) => {
    const allowed = sectionsByPage[page.id];
    const matching = report.sections.filter((section) => allowed.includes(section.id));
    const estimatedLines = matching.reduce((total, section) => total + Math.ceil((section.title.length + section.body.length) / 72), 0);
    const status = estimatedLines > 48 || matching.length === 0 ? "review" : "ready";
    return {
      id: page.id,
      label: page.shortLabel,
      index: page.index,
      sectionCount: matching.length,
      estimatedLines,
      status,
    } satisfies Pass505PageAudit;
  });
  const pageCountParity = report.pass488.readerPageCount === report.pass488.binaryPageCount;
  const warnings = [
    ...pages.filter((page) => page.status === "review").map((page) => `${page.label}: content density requires review`),
    ...(pageCountParity ? [] : ["Reader and binary PDF page counts differ"]),
  ];
  return {
    version: "pdf-page-break-audit",
    status: warnings.length ? "review" : "ready",
    pageCountParity,
    pages,
    warnings,
  };
}
