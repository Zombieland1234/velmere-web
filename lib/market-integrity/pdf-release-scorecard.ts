import type { Pass499A4ReaderHealth } from "./a4-reader-health";
import type { Pass505PdfPageBreakAudit } from "./pdf-page-break-audit";
import type { Pass512ReportIntegritySeal } from "./report-integrity-seal";
import type { Pass519PdfTypographyQa } from "./pdf-typography-qa";

export type Pass526PdfReleaseScorecard = {
  version: "pdf-release-scorecard";
  state: "release" | "review" | "blocked";
  score: number;
  blockers: string[];
  warnings: string[];
  strengths: string[];
  recommendation: string;
};

export function buildPass526PdfReleaseScorecard(
  health: Pass499A4ReaderHealth,
  pageAudit: Pass505PdfPageBreakAudit,
  seal: Pass512ReportIntegritySeal,
  typography: Pass519PdfTypographyQa,
): Pass526PdfReleaseScorecard {
  const blockers = [
    ...(health.status === "blocked" ? ["Reader health is blocked"] : []),
    ...(!health.parity ? ["Preview/download parity is broken"] : []),
    ...(seal.state === "blocked" ? ["Integrity seal is blocked"] : []),
    ...(typography.state === "blocked" ? ["Typography QA is blocked"] : []),
  ];
  const warnings = [
    ...(health.status === "review" ? ["Reader health requires review"] : []),
    ...(pageAudit.status === "review" ? pageAudit.warnings : []),
    ...(typography.state === "review" ? typography.issues.map((issue) => issue.detail).slice(0, 3) : []),
    ...(seal.state === "review" ? ["Integrity seal contains review-state checks"] : []),
  ];
  const strengths = [
    ...(health.parity ? ["Reader and binary report share the same page contract"] : []),
    ...(health.sourceCount > 0 ? [`${health.sourceCount} source entries are visible`] : []),
    ...(seal.state === "sealed" ? ["Integrity seal is complete"] : []),
    ...(typography.state === "ready" ? ["Typography density is inside the release budget"] : []),
  ];
  const score = Math.max(0, Math.min(100, Math.round(
    health.sourceConfidence * 0.25 + seal.readiness * 0.4 + typography.score * 0.25 + (pageAudit.status === "ready" ? 10 : 4),
  )));
  const state: Pass526PdfReleaseScorecard["state"] = blockers.length ? "blocked" : warnings.length || score < 86 ? "review" : "release";
  return {
    version: "pdf-release-scorecard",
    state,
    score,
    blockers,
    warnings,
    strengths,
    recommendation: state === "release"
      ? "Report is ready for download under the current source and depth boundaries."
      : state === "review"
        ? "Keep download available with a visible review state and resolve the listed density or integrity warnings."
        : "Block the final export until parity, typography and integrity blockers are resolved.",
  };
}
