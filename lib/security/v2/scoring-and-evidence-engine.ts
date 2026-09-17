/**
 * Velmère Security Engine V2 — Scoring & Evidence Engine
 *
 * Implements multi-dimensional risk scoring and deterministic audit snapshot generation:
 * - Security Risk, Centralization Risk, Upgrade Risk, Oracle Risk, Economic Risk
 * - Overall Composite Score calculation with rigorous risk weights
 * - Assessment Confidence metric (0% to 100%)
 * - Deterministic AuditSnapshotId cryptographic digest
 */

import { StandardFindingV2, MultiDimensionalScoreV2, AuditSnapshotId } from "./types";
import { createHash } from "node:crypto";

export function computeMultiDimensionalScores(
  findings: StandardFindingV2[],
  cfgMetrics: { blockCount: number; cyclomaticComplexity: number; instructionCount: number; unresolvedDynamicJumps: number },
  isProxy: boolean,
  coverageInput: { sourceProvided: boolean; meaningfulBytecode: boolean },
): MultiDimensionalScoreV2 {
  let securityRisk = 0;
  let centralizationRisk = 0;
  let upgradeRisk = isProxy ? 25 : 0;
  let oracleRisk = 0;
  let economicRisk = 0;
  const heuristicCandidateCount = findings.filter((finding) => finding.claimState === "HEURISTIC_CANDIDATE").length;
  const scoredFindings = findings.filter((finding) => finding.claimState !== "HEURISTIC_CANDIDATE");

  for (const finding of scoredFindings) {
    const weight =
      finding.severity === "critical"
        ? 35
        : finding.severity === "high"
        ? 20
        : finding.severity === "medium"
        ? 10
        : 5;

    if (
      finding.findingId.includes("REENTRANCY") ||
      finding.findingId.includes("SELFDESTRUCT") ||
      finding.findingId.includes("CRYPTO")
    ) {
      securityRisk += weight;
    }

    if (
      finding.findingId.includes("TXORIGIN") ||
      finding.findingId.includes("SINGLE-STEP") ||
      finding.findingId.includes("BLACKLIST") ||
      finding.findingId.includes("MINT")
    ) {
      centralizationRisk += weight;
    }

    if (finding.findingId.includes("UPGRADE") || finding.findingId.includes("UNINITIALIZED")) {
      upgradeRisk += weight;
    }

    if (finding.findingId.includes("ORACLE")) {
      oracleRisk += weight;
    }

    if (finding.findingId.includes("VAULT-INFLATION") || finding.findingId.includes("SANDWICH")) {
      economicRisk += weight;
    }
  }

  // Cap individual risk dimensions at 100
  securityRisk = Math.min(100, securityRisk);
  centralizationRisk = Math.min(100, centralizationRisk);
  upgradeRisk = Math.min(100, upgradeRisk);
  oracleRisk = Math.min(100, oracleRisk);
  economicRisk = Math.min(100, economicRisk);

  // Code Quality Risk based on complexity and findings count
  const complexityRisk = Math.min(100, Math.round(cfgMetrics.cyclomaticComplexity * 1.5));
  const codeQualityRisk = Math.min(100, Math.round(complexityRisk * 0.4 + scoredFindings.length * 5));

  // Operational Risk
  const operationalRisk = Math.min(100, Math.round((centralizationRisk + upgradeRisk) / 2));

  // Overall Score: 0 is highest risk, 100 is best (safe)
  // Higher individual risks pull overall safety score down
  const maxRisk = Math.max(securityRisk, centralizationRisk, upgradeRisk, oracleRisk, economicRisk);
  const averageRisk =
    (securityRisk * 0.35 +
      centralizationRisk * 0.2 +
      upgradeRisk * 0.15 +
      oracleRisk * 0.15 +
      economicRisk * 0.15);

  const rawOverallScore = Math.max(5, Math.min(99, Math.round(100 - (maxRisk * 0.6 + averageRisk * 0.4))));

  const limitations: string[] = [];
  if (!coverageInput.sourceProvided) limitations.push("SOURCE_NOT_PROVIDED");
  if (!coverageInput.meaningfulBytecode) limitations.push("BYTECODE_MISSING_OR_PLACEHOLDER");
  if (cfgMetrics.instructionCount < 8) limitations.push("BYTECODE_TOO_SHALLOW_FOR_FULL_ANALYSIS");
  if (cfgMetrics.blockCount < 2) limitations.push("CFG_TOO_SHALLOW_FOR_FULL_ANALYSIS");
  if (cfgMetrics.unresolvedDynamicJumps > 0) limitations.push(`UNRESOLVED_DYNAMIC_JUMPS:${cfgMetrics.unresolvedDynamicJumps}`);
  if (heuristicCandidateCount > 0) limitations.push(`HEURISTIC_CANDIDATES_EXCLUDED_FROM_SCORE:${heuristicCandidateCount}`);

  // A Full V2 safety score is withheld unless both source and meaningful runtime
  // bytecode were supplied and the CFG has enough structure to support analysis.
  // This prevents placeholder-bytecode corpora from producing a misleading 99.
  const assessmentState =
    coverageInput.sourceProvided &&
    coverageInput.meaningfulBytecode &&
    cfgMetrics.instructionCount >= 8 &&
    cfgMetrics.blockCount >= 2 &&
    cfgMetrics.unresolvedDynamicJumps === 0 &&
    heuristicCandidateCount === 0
      ? "COMPLETE"
      : "ANALYSIS_INCOMPLETE";

  const coveragePoints =
    (coverageInput.sourceProvided ? 25 : 0) +
    (coverageInput.meaningfulBytecode ? 35 : 0) +
    Math.min(20, cfgMetrics.blockCount * 2) +
    Math.min(15, Math.floor(cfgMetrics.instructionCount / 20)) +
    (cfgMetrics.unresolvedDynamicJumps === 0 ? 5 : 0);
  const assessmentConfidence = Math.max(0, Math.min(95, coveragePoints));
  const overallScore = assessmentState === "COMPLETE" ? rawOverallScore : null;

  return {
    securityRisk,
    centralizationRisk,
    upgradeRisk,
    oracleRisk,
    economicRisk,
    codeQualityRisk,
    operationalRisk,
    overallScore,
    assessmentConfidence,
    assessmentState,
    scopeStatement: "AVAILABLE_DETECTORS_ONLY_NOT_SECURITY_CERTIFICATION",
    coverage: {
      sourceProvided: coverageInput.sourceProvided,
      meaningfulBytecode: coverageInput.meaningfulBytecode,
      instructionCount: cfgMetrics.instructionCount,
      blockCount: cfgMetrics.blockCount,
      unresolvedDynamicJumps: cfgMetrics.unresolvedDynamicJumps,
      limitations,
      heuristicCandidateCount,
    },
  };
}

export function generateAuditSnapshotId(params: {
  contractAddress: string;
  chainId: string;
  blockNumber?: number;
  bytecode: string;
  sourceCode?: string;
  compilerVersion?: string;
}): AuditSnapshotId {
  const bytecodeSha256 = createHash("sha256").update(params.bytecode).digest("hex");
  const sourceCodeSha256 = params.sourceCode
    ? createHash("sha256").update(params.sourceCode).digest("hex")
    : undefined;

  const timestamp = new Date().toISOString();

  // The digest identifies analyzed content and context. Wall-clock observation
  // time remains metadata and is deliberately excluded so identical inputs
  // produce the same snapshotDigest across repeat runs.
  const rawPayload = `${params.contractAddress}-${params.chainId}-${params.blockNumber ?? "unknown_block"}-${bytecodeSha256}-${sourceCodeSha256 ?? "no_source"}-Velmère-V2.4.0`;
  const snapshotDigest = `0x${createHash("sha256").update(rawPayload).digest("hex")}`;

  return {
    snapshotDigest,
    contractAddress: params.contractAddress,
    chainId: params.chainId,
    blockNumber: params.blockNumber,
    bytecodeSha256: `0x${bytecodeSha256}`,
    sourceCodeSha256: sourceCodeSha256 ? `0x${sourceCodeSha256}` : undefined,
    compilerVersion: params.compilerVersion ?? "unknown-solc",
    engineVersion: "Velmère-V2.4.0",
    timestamp,
  };
}
