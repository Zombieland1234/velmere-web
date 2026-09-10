import { sha256Token } from "../security/cryptographic-digest";
import type { LensReport } from "@/lib/search/lens-report";

export type Pass539PageRhythm = {
  id: LensReport["pass488"]["pages"][number]["id"];
  label: string;
  wordCount: number;
  estimatedLines: number;
  lineBudget: number;
  density: number;
  widowRisk: boolean;
  orphanRisk: boolean;
  status: "ready" | "review" | "blocked";
};

export type Pass539PdfPageRhythm = {
  version: "pdf-page-rhythm";
  state: "ready" | "review" | "blocked";
  score: number;
  pages: Pass539PageRhythm[];
  reviewCount: number;
  blockedCount: number;
  checksum: string;
  recommendation: string;
  boundary: string;
};

const pageSections: Record<
  LensReport["pass488"]["pages"][number]["id"],
  LensReport["sections"][number]["id"][]
> = {
  decision: ["brief", "next"],
  evidence: ["sources", "secondProvider", "missing"],
  analysis: ["marketData"],
  boundary: ["signature"],
};

function words(value: string) {
  return value.trim().split(/\s+/).filter(Boolean);
}

function stableChecksum(value: string) {
  return `rhythm-${sha256Token(value, 16)}`;
}

export function buildPass539PdfPageRhythm(
  report: LensReport,
): Pass539PdfPageRhythm {
  const lineBudgets: Record<Pass539PageRhythm["id"], number> = {
    decision: 46,
    evidence: 54,
    analysis: 50,
    boundary: 44,
  };

  const pages = report.pass488.pages.map((page) => {
    const matching = report.sections.filter((section) =>
      pageSections[page.id].includes(section.id),
    );
    const body = matching
      .map((section) => `${section.title}. ${section.body}`)
      .join("\n");
    const tokenCount = words(body).length;
    const estimatedLines = matching.reduce(
      (total, section) =>
        total + Math.max(2, Math.ceil((section.title.length + section.body.length) / 68)),
      0,
    );
    const lineBudget = lineBudgets[page.id];
    const density = Math.round((estimatedLines / lineBudget) * 100);
    const sentences = body
      .split(/[.!?]+/)
      .map((sentence) => words(sentence).length)
      .filter(Boolean);
    const widowRisk = Boolean(sentences.length && sentences.at(-1)! <= 5);
    const orphanRisk = Boolean(sentences.length && sentences[0] <= 4);
    const status: Pass539PageRhythm["status"] =
      density > 118
        ? "blocked"
        : density > 94 || widowRisk || orphanRisk || matching.length === 0
          ? "review"
          : "ready";
    return {
      id: page.id,
      label: page.shortLabel,
      wordCount: tokenCount,
      estimatedLines,
      lineBudget,
      density,
      widowRisk,
      orphanRisk,
      status,
    } satisfies Pass539PageRhythm;
  });

  const reviewCount = pages.filter((page) => page.status === "review").length;
  const blockedCount = pages.filter((page) => page.status === "blocked").length;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          reviewCount * 8 -
          blockedCount * 24 -
          pages.reduce((total, page) => total + Math.max(0, page.density - 100) * 0.35, 0),
      ),
    ),
  );
  const state: Pass539PdfPageRhythm["state"] = blockedCount
    ? "blocked"
    : reviewCount
      ? "review"
      : "ready";
  const checksum = stableChecksum(
    pages
      .map(
        (page) =>
          `${page.id}:${page.wordCount}:${page.estimatedLines}:${page.status}`,
      )
      .join("|"),
  );

  return {
    version: "pdf-page-rhythm",
    state,
    score,
    pages,
    reviewCount,
    blockedCount,
    checksum,
    recommendation:
      state === "ready"
        ? "Page rhythm is inside the A4 reading budget."
        : state === "review"
          ? "Shorten dense sections or rebalance them before treating the layout as final."
          : "Block export until overfilled pages are split or reduced.",
    boundary:
      "This audit estimates page rhythm from the shared report model. It does not replace a final visual render check at the target font metrics.",
  };
}
