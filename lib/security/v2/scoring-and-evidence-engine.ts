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

  const limitations: string[] = [];
  if (!coverageInput.sourceProvided) limitations.push("SOURCE_NOT_PROVIDED");
  if (!coverageInput.meaningfulBytecode) limitations.push("BYTECODE_MISSING_OR_PLACEHOLDER");
  if (cfgMetrics.instructionCount < 8) limitations.push("BYTECODE_TOO_SHALLOW_FOR_FULL_ANALYSIS");
  if (cfgMetrics.blockCount < 2) limitations.push("CFG_TOO_SHALLOW_FOR_FULL_ANALYSIS");
  if (cfgMetrics.unresolvedDynamicJumps > 0) limitations.push(`UNRESOLVED_DYNAMIC_JUMPS:${cfgMetrics.unresolvedDynamicJumps}`);
  if (heuristicCandidateCount > 0) limitations.push(`HEURISTIC_CANDIDATES_EXCLUDED_FROM_SCORE:${heuristicCandidateCount}`);

  // Structural depth and "no findings" do not prove target identity or detector
  // coverage. No independent evidence verifier exists in this API yet.
  limitations.push("SOURCE_RUNTIME_IDENTITY_NOT_VERIFIED", "DETECTOR_COVERAGE_NOT_QUALIFIED", "ASSESSMENT_CONFIDENCE_NOT_CALIBRATED");
  const assessmentState = "ANALYSIS_INCOMPLETE" as const;
  const overallScore = null;
  const assessmentConfidence = null;

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
  const hex = params.bytecode.replace(/^0x/i, "");
  if (hex.length % 2 || !/^[0-9a-f]*$/i.test(hex)) throw new Error("INVALID_HEX_SNAPSHOT");
  const bytecodeSha256 = createHash("sha256").update(Buffer.from(hex, "hex")).digest("hex");
  const sourceCodeSha256 = params.sourceCode
    ? createHash("sha256").update(params.sourceCode).digest("hex")
    : undefined;

  const timestamp = new Date().toISOString();

  // The digest identifies analyzed content and context. Wall-clock observation
  // time remains metadata and is deliberately excluded so identical inputs
  // produce the same snapshotDigest across repeat runs.
  const rawPayload = JSON.stringify({
    schema: "velmere.audit-content-snapshot.v2", address: params.contractAddress.toLowerCase(),
    chainId: params.chainId, blockNumber: params.blockNumber ?? null,
    bytecodeSha256, sourceCodeSha256: sourceCodeSha256 ?? null, engineVersion: "Velmère-V2.5.2",
  });
  const snapshotDigest = `0x${createHash("sha256").update(rawPayload).digest("hex")}`;

  return {
    snapshotDigest,
    contractAddress: params.contractAddress,
    chainId: params.chainId,
    blockNumber: params.blockNumber,
    bytecodeSha256: `0x${bytecodeSha256}`,
    sourceCodeSha256: sourceCodeSha256 ? `0x${sourceCodeSha256}` : undefined,
    compilerVersion: params.compilerVersion ?? "unknown-solc",
    engineVersion: "Velmère-V2.5.2",
    timestamp,
  };
}
