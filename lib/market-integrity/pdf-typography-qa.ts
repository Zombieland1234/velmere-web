import type { LensReport } from "@/lib/search/lens-report";

export type Pass519TypographyIssue = {
  id: string;
  severity: "review" | "block";
  sectionId: string;
  detail: string;
};

export type Pass519PdfTypographyQa = {
  version: "pdf-typography-qa";
  state: "ready" | "review" | "blocked";
  score: number;
  longestToken: number;
  longestParagraph: number;
  averageSentenceLength: number;
  issues: Pass519TypographyIssue[];
  recommendations: string[];
};

const words = (value: string) => value.trim().split(/\s+/).filter(Boolean);

export function buildPass519PdfTypographyQa(report: LensReport): Pass519PdfTypographyQa {
  const issues: Pass519TypographyIssue[] = [];
  const allBodies = report.sections.map((section) => section.body || "");
  let longestToken = 0;
  let longestParagraph = 0;
  const sentenceLengths: number[] = [];

  report.sections.forEach((section) => {
    const body = section.body || "";
    const bodyWords = words(body);
    longestParagraph = Math.max(longestParagraph, body.length);
    bodyWords.forEach((word) => {
      longestToken = Math.max(longestToken, word.length);
    });
    body.split(/[.!?]+/).map((item) => words(item).length).filter(Boolean).forEach((length) => sentenceLengths.push(length));

    if (bodyWords.some((word) => word.length > 42)) {
      issues.push({ id: `${section.id}-token`, severity: "block", sectionId: section.id, detail: "Contains an unbroken token longer than 42 characters." });
    }
    if (body.length > 1_350) {
      issues.push({ id: `${section.id}-density`, severity: "review", sectionId: section.id, detail: "Section density is high for a stable A4 card and should be shortened or split." });
    }
    const uppercase = body.replace(/[^A-ZÄÖÜĄĆĘŁŃÓŚŹŻ]/g, "").length;
    const letters = body.replace(/[^A-Za-zÀ-žĄĆĘŁŃÓŚŹŻ]/g, "").length;
    if (letters > 80 && uppercase / letters > 0.42) {
      issues.push({ id: `${section.id}-uppercase`, severity: "review", sectionId: section.id, detail: "Excessive uppercase density can reduce reading speed." });
    }
  });

  const combined = allBodies.join(" ");
  const repeatedSpaces = /\s{3,}/.test(combined);
  if (repeatedSpaces) {
    issues.push({ id: "spacing", severity: "review", sectionId: "document", detail: "Repeated whitespace may create uneven PDF line breaks." });
  }

  const averageSentenceLength = sentenceLengths.length
    ? Math.round((sentenceLengths.reduce((sum, value) => sum + value, 0) / sentenceLengths.length) * 10) / 10
    : 0;
  if (averageSentenceLength > 34) {
    issues.push({ id: "sentence-length", severity: "review", sectionId: "document", detail: "Average sentence length is too high for fast scanning." });
  }

  const blocked = issues.some((issue) => issue.severity === "block");
  const score = Math.max(0, 100 - issues.filter((issue) => issue.severity === "review").length * 8 - issues.filter((issue) => issue.severity === "block").length * 24);
  return {
    version: "pdf-typography-qa",
    state: blocked ? "blocked" : issues.length ? "review" : "ready",
    score,
    longestToken,
    longestParagraph,
    averageSentenceLength,
    issues,
    recommendations: [
      "Keep body measure near 55–78 characters per line in the A4 reader.",
      "Prefer short evidence bullets over dense all-caps paragraphs.",
      "Use break-word only for identifiers; preserve natural word wrapping for prose.",
    ],
  };
}
