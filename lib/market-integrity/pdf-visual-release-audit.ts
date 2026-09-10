import type { Pass512ReportIntegritySeal } from "./report-integrity-seal";
import type { Pass519PdfTypographyQa } from "./pdf-typography-qa";
import type { Pass526PdfReleaseScorecard } from "./pdf-release-scorecard";
import type { Pass539PdfPageRhythm } from "./pdf-page-rhythm";

export type Pass547PageVisualFlag = {
  id: string;
  state: "ready" | "review" | "blocked";
  density: number;
  note: string;
};

export type Pass547PdfVisualReleaseAudit = {
  version: "pdf-visual-release-audit";
  state: "release" | "review" | "blocked";
  score: number;
  pageFlags: Pass547PageVisualFlag[];
  headline: string;
  recommendation: string;
  boundary: string;
};

export function buildPass547PdfVisualReleaseAudit(
  locale: "pl" | "de" | "en",
  scorecard: Pass526PdfReleaseScorecard,
  seal: Pass512ReportIntegritySeal,
  typography: Pass519PdfTypographyQa,
  rhythm: Pass539PdfPageRhythm,
): Pass547PdfVisualReleaseAudit {
  const pageFlags = rhythm.pages.map((page) => ({
    id: page.id,
    state: page.status,
    density: page.density,
    note:
      page.status === "ready"
        ? `${page.estimatedLines}/${page.lineBudget} lines`
        : page.widowRisk || page.orphanRisk
          ? `line rhythm ${page.estimatedLines}/${page.lineBudget}; widow/orphan review`
          : `density ${page.density}%`,
  }));
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        scorecard.score * 0.42 + seal.readiness * 0.25 + typography.score * 0.18 + rhythm.score * 0.15,
      ),
    ),
  );
  const state: Pass547PdfVisualReleaseAudit["state"] =
    scorecard.state === "blocked" || seal.state === "blocked" || rhythm.state === "blocked"
      ? "blocked"
      : scorecard.state === "review" || typography.state === "review" || rhythm.state === "review" || score < 88
        ? "review"
        : "release";
  const headline =
    state === "release"
      ? locale === "pl"
        ? "Dokument spełnia wspólny kontrakt wizualny Reader/PDF"
        : locale === "de"
          ? "Das Dokument erfüllt den gemeinsamen visuellen Reader/PDF-Vertrag"
          : "The document satisfies the shared Reader/PDF visual contract"
      : state === "blocked"
        ? locale === "pl"
          ? "Eksport wymaga naprawy blokera wizualnego lub integralności"
          : locale === "de"
            ? "Der Export benötigt eine visuelle oder Integritätskorrektur"
            : "Export requires a visual or integrity blocker to be fixed"
        : locale === "pl"
          ? "Dokument jest czytelny, ale wymaga finalnego przeglądu rytmu"
          : locale === "de"
            ? "Das Dokument ist lesbar, benötigt aber eine finale Rhythmusprüfung"
            : "The document is readable but needs a final rhythm review";
  return {
    version: "pdf-visual-release-audit",
    state,
    score,
    pageFlags,
    headline,
    recommendation:
      state === "release"
        ? scorecard.recommendation
        : state === "blocked"
          ? scorecard.blockers[0] || rhythm.recommendation
          : scorecard.warnings[0] || rhythm.recommendation,
    boundary:
      "The audit combines shared-model checks and estimated line rhythm. Final font rendering still requires a browser or binary PDF visual test.",
  };
}
