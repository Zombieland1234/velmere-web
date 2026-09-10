/**
 * VELMÈRE ULTIMATE EVIDENCE-FIRST AUDIT PLATFORM
 * TWO-DIMENSIONAL SCORING ENGINE (Directive v3 Sections 35, 36, 63, 64)
 * ZERO-BULLSHIT / ZERO-FABRICATION / REPRODUCIBLE
 * 
 * Separates:
 * 1. Target Risk Score (0-100, higher means riskier asset/contract)
 * 2. Audit Quality Score (0-100, higher means more thorough, complete evidence)
 * 3. Confidence (0-100, mathematical degree of certainty based on verified claims)
 */

import type { EvidenceRecord } from "../evidence/evidence-record.ts";
import type { FindingRecord } from "../analyzer/contract-analyzer.ts";

export interface ScoreBreakdown {
  riskScore: number; // 0 to 100
  riskTier: "LOW" | "GUARDED" | "ELEVATED" | "HIGH" | "CRITICAL";
  auditQualityScore: number; // 0 to 100
  auditQualityTier: "PRELIMINARY" | "STANDARD" | "COMPREHENSIVE" | "INSTITUTIONAL";
  confidenceScore: number; // 0 to 100
  
  riskFactors: {
    criticalFindingsPenalty: number;
    highFindingsPenalty: number;
    mediumFindingsPenalty: number;
    centralizationPenalty: number;
    upgradeabilityRiskPenalty: number;
    marketLiquidityPenalty: number;
    baseScore: number;
  };

  qualityFactors: {
    sourceProvenancePoints: number; // max 20
    bytecodeVerificationPoints: number; // max 15
    staticAnalysisPoints: number; // max 15
    dynamicFuzzingPoints: number; // max 15
    formalVerificationPoints: number; // max 15
    reproducibilityManifestPoints: number; // max 10
    humanReviewPoints: number; // max 10
  };

  explanation: string;
}

export class TwoDimensionalScorer {
  /**
   * Computes the reproducible two-dimensional audit score.
   */
  public static calculate(params: {
    findings: FindingRecord[];
    evidenceRecords: EvidenceRecord[];
    isUpgradeable?: boolean;
    hasCentralizedAuthority?: boolean;
    hasHumanReview?: boolean;
    hasDynamicFuzzing?: boolean;
    hasFormalProofs?: boolean;
    marketSlippageBps?: number;
  }): ScoreBreakdown {
    // 1. Compute Target Risk Score
    let criticalPenalty = 0;
    let highPenalty = 0;
    let mediumPenalty = 0;

    for (const f of params.findings) {
      if (f.severity === "CRITICAL") criticalPenalty += 35;
      else if (f.severity === "HIGH") highPenalty += 18;
      else if (f.severity === "MEDIUM") mediumPenalty += 8;
    }

    const centralizationPenalty = params.hasCentralizedAuthority ? 15 : 0;
    const upgradeabilityRiskPenalty = params.isUpgradeable ? 10 : 0;
    const marketLiquidityPenalty = params.marketSlippageBps && params.marketSlippageBps > 15 ? 12 : 0;

    // Total risk score capped between 0 and 100
    const rawRisk = criticalPenalty + highPenalty + mediumPenalty + centralizationPenalty + upgradeabilityRiskPenalty + marketLiquidityPenalty;
    const riskScore = Math.min(100, Math.max(5, rawRisk || 12));

    const riskTier =
      riskScore >= 75 ? "CRITICAL" :
      riskScore >= 55 ? "HIGH" :
      riskScore >= 35 ? "ELEVATED" :
      riskScore >= 20 ? "GUARDED" : "LOW";

    // 2. Compute Audit Quality Score (Completeness of the audit itself)
    const hasSource = params.evidenceRecords.some((e) => e.category === "SOURCE" && e.status === "PASS");
    const hasBytecode = params.evidenceRecords.some((e) => e.category === "BYTECODE" && e.status === "PASS");
    const hasStatic = params.evidenceRecords.some((e) => e.category === "STATIC_ANALYSIS" || e.category === "AST");
    const hasFuzz = params.hasDynamicFuzzing || params.evidenceRecords.some((e) => e.category === "FUZZING" || e.category === "STATEFUL_FUZZING");
    const hasFormal = params.hasFormalProofs || params.evidenceRecords.some((e) => e.category === "FORMAL" || e.category === "INVARIANT");
    const hasManifest = params.evidenceRecords.some((e) => e.category === "SYSTEM" || e.category === "CRYPTOGRAPHIC");
    const hasHuman = Boolean(params.hasHumanReview);

    const sourcePoints = hasSource ? 20 : 0;
    const bytecodePoints = hasBytecode ? 15 : 5; // 5 if unverified chain
    const staticPoints = hasStatic ? 15 : 5;
    const fuzzPoints = hasFuzz ? 15 : 0;
    const formalPoints = hasFormal ? 15 : 0;
    const manifestPoints = hasManifest ? 10 : 5;
    const humanPoints = hasHuman ? 10 : 0; // Honest: 0 if no human review performed!

    const auditQualityScore = Math.min(100, sourcePoints + bytecodePoints + staticPoints + fuzzPoints + formalPoints + manifestPoints + humanPoints);

    const auditQualityTier =
      auditQualityScore >= 85 ? "INSTITUTIONAL" :
      auditQualityScore >= 65 ? "COMPREHENSIVE" :
      auditQualityScore >= 45 ? "STANDARD" : "PRELIMINARY";

    // 3. Compute Confidence Score
    const unknownCount = params.evidenceRecords.filter((e) => e.status === "UNKNOWN" || e.status === "NOT_VERIFIED").length;
    const passCount = params.evidenceRecords.filter((e) => e.status === "PASS").length;
    const totalCount = params.evidenceRecords.length || 1;
    const confidenceScore = Math.round(Math.min(99, Math.max(40, (passCount / (passCount + unknownCount * 1.5)) * 100)));

    const explanation = `Risk Score (${riskScore}/100, ${riskTier}) derived from ${params.findings.length} findings and architectural penalties. Audit Quality Score (${auditQualityScore}/100, ${auditQualityTier}) reflects tool coverage: source=${sourcePoints}/20, static=${staticPoints}/15, fuzz=${fuzzPoints}/15, formal=${formalPoints}/15, human=${humanPoints}/10.`;

    return {
      riskScore,
      riskTier,
      auditQualityScore,
      auditQualityTier,
      confidenceScore,
      riskFactors: {
        criticalFindingsPenalty: criticalPenalty,
        highFindingsPenalty: highPenalty,
        mediumFindingsPenalty: mediumPenalty,
        centralizationPenalty,
        upgradeabilityRiskPenalty,
        marketLiquidityPenalty,
        baseScore: rawRisk,
      },
      qualityFactors: {
        sourceProvenancePoints: sourcePoints,
        bytecodeVerificationPoints: bytecodePoints,
        staticAnalysisPoints: staticPoints,
        dynamicFuzzingPoints: fuzzPoints,
        formalVerificationPoints: formalPoints,
        reproducibilityManifestPoints: manifestPoints,
        humanReviewPoints: humanPoints,
      },
      explanation,
    };
  }
}
