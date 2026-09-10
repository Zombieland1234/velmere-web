import type { LensReport } from "@/lib/search/lens-report";

export type Pass499A4ReaderHealth = {
  version: "a4-reader-health";
  status: "ready" | "review" | "blocked";
  parity: boolean;
  sourceCount: number;
  sourceConfidence: number;
  missingCount: number;
  checks: Array<{ id: string; label: string; passed: boolean }>;
};

export function buildPass499A4ReaderHealth(report: LensReport): Pass499A4ReaderHealth {
  const parity = report.pass488.readerPageCount === report.pass488.binaryPageCount && Boolean(report.pass488.parityKey);
  const sourceCount = report.sources.length;
  const missingCount = report.missingData.length;
  const checks = [
    { id: "parity", label: "Preview = download", passed: parity },
    { id: "sources", label: "Source ledger", passed: sourceCount > 0 },
    { id: "confidence", label: "Confidence bound", passed: report.sourceConfidence > 0 },
    { id: "boundary", label: "Missing data visible", passed: Boolean(report.pass450.unknownPolicy) },
  ];
  const failures = checks.filter((check) => !check.passed).length;
  const status = failures > 1 || sourceCount === 0 ? "blocked" : failures === 1 || missingCount > 3 ? "review" : "ready";
  return {
    version: "a4-reader-health",
    status,
    parity,
    sourceCount,
    sourceConfidence: report.sourceConfidence,
    missingCount,
    checks,
  };
}
