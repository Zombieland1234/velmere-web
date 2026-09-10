/**
 * VELMÈRE DETERMINISTIC REPLAY & DIFFERENTIAL ENGINE
 * 
 * Guarantees reproducibility:
 * NO REPRODUCIBILITY -> DO NOT CALL RESULT REPRODUCIBLE
 * 
 * Supports:
 * - Deterministic replay of audit snapshots -> PASS / MISMATCH
 * - Differential analysis between Report A and Report B
 */

import { computeSha256 } from "../evidence/claim-evidence-model";

export interface ReplayResult {
  assetId: string;
  originalReportDigest: string;
  replayedReportDigest: string;
  status: "PASS" | "MISMATCH";
  executionDurationMs: number;
  diffExplanation?: string;
}

export interface DifferentialReportDiff {
  assetId: string;
  reportAId: string;
  reportBId: string;
  scoreDelta: number;
  confidenceDelta: number;
  coverageDelta: number;
  newFindings: string[];
  resolvedFindings: string[];
  newClaims: string[];
  removedClaims: string[];
  isMaterialChange: boolean;
}

export interface ReplayableReport {
  reportId?: string;
  reportDigest?: string;
  target?: { contractAddress?: string };
  verdict?: {
    riskScore?: number;
    confidenceScore?: number;
    evidenceCoverage?: number;
  };
  sections?: Array<{
    data?: {
      findings?: Array<{ id?: string; title?: string }>;
    };
  }>;
  [key: string]: unknown;
}

export class EvidenceReplayEngine {
  public static replayReport<TInput = unknown, TOutput extends ReplayableReport = ReplayableReport>(
    originalReport: ReplayableReport,
    generatorFn: (input: TInput) => TOutput,
    input: TInput,
  ): ReplayResult {
    const startTime = Date.now();
    const replayed = generatorFn(input);
    const duration = Date.now() - startTime;

    const originalDigest = originalReport.reportDigest || computeSha256(JSON.stringify(originalReport));
    const replayedDigest = replayed.reportDigest || computeSha256(JSON.stringify(replayed));

    const isMatch = originalDigest === replayedDigest;

    return {
      assetId: originalReport.reportId || originalReport.target?.contractAddress || "unknown",
      originalReportDigest: originalDigest,
      replayedReportDigest: replayedDigest,
      status: isMatch ? "PASS" : "MISMATCH",
      executionDurationMs: duration,
      diffExplanation: isMatch ? undefined : `Digest mismatch. Expected ${originalDigest}, got ${replayedDigest}`,
    };
  }

  public static computeDifferential(reportA: ReplayableReport, reportB: ReplayableReport): DifferentialReportDiff {
    const scoreA = reportA.verdict?.riskScore ?? 0;
    const scoreB = reportB.verdict?.riskScore ?? 0;
    const scoreDelta = scoreB - scoreA;

    const confA = reportA.verdict?.confidenceScore ?? 0;
    const confB = reportB.verdict?.confidenceScore ?? 0;
    const confidenceDelta = confB - confA;

    const covA = reportA.verdict?.evidenceCoverage ?? 0;
    const covB = reportB.verdict?.evidenceCoverage ?? 0;
    const coverageDelta = covB - covA;

    const findingsA = new Set<string>();
    const findingsB = new Set<string>();

    for (const sec of reportA.sections || []) {
      for (const f of sec.data?.findings || []) {
        findingsA.add(f.id || f.title);
      }
    }
    for (const sec of reportB.sections || []) {
      for (const f of sec.data?.findings || []) {
        findingsB.add(f.id || f.title);
      }
    }

    const newFindings = Array.from(findingsB).filter((id) => !findingsA.has(id));
    const resolvedFindings = Array.from(findingsA).filter((id) => !findingsB.has(id));

    const isMaterial = Math.abs(scoreDelta) >= 10 || newFindings.length > 0 || resolvedFindings.length > 0;

    return {
      assetId: reportB.reportId || reportA.reportId || "unknown",
      reportAId: reportA.reportDigest || "A",
      reportBId: reportB.reportDigest || "B",
      scoreDelta,
      confidenceDelta,
      coverageDelta,
      newFindings,
      resolvedFindings,
      newClaims: [],
      removedClaims: [],
      isMaterialChange: isMaterial,
    };
  }
}
