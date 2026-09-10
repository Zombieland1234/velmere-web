import type { CustomerReportDecisionSection } from "@/lib/market-integrity/customer-report-payload";
import type { AnalysisReadiness } from "@/lib/market-integrity/analysis-readiness";
import type { LiquidityIntelligenceBrief } from "@/lib/market-integrity/liquidity-intelligence";
import type { StressScenarioBundle } from "@/lib/market-integrity/stress-simulator";
import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";
import type { buildHolderIntelligence } from "@/lib/market-integrity/holder-intelligence";
import type { buildRiskBrain } from "@/lib/market-integrity/risk-brain";

export const PASS4818_CUSTOMER_REPORT_DECISION_SECTIONS_ID = "pass4818-customer-report-decision-sections-v1" as const;

type HolderIntelligence = ReturnType<typeof buildHolderIntelligence>;
type RiskBrain = ReturnType<typeof buildRiskBrain>;

function unique(values: Array<string | null | undefined>, limit: number): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))).slice(0, limit);
}

function scoreState(score: number, missingCount = 0): CustomerReportDecisionSection["state"] {
  if (missingCount >= 4) return "missing";
  if (score >= 75) return "blocked";
  if (score >= 45 || missingCount > 0) return "watch";
  return "ready";
}

function readinessState(readiness: AnalysisReadiness, depth: "basic" | "pro" | "advanced") {
  if (readiness.tiers[depth].sellReady) return "ready" as const;
  if (readiness.status === "insufficient_data") return "missing" as const;
  return "blocked" as const;
}

export function buildCustomerReportDecisionSections(args: {
  result: TokenRiskResult;
  readiness: AnalysisReadiness;
  riskBrain: RiskBrain;
  holderIntelligence: HolderIntelligence;
  liquidityIntelligence: LiquidityIntelligenceBrief;
  stressSimulator: StressScenarioBundle;
}): CustomerReportDecisionSection[] {
  const strongestLayer = args.riskBrain.strongestLayer;
  const strongestSynergy = args.riskBrain.synergyChecks[0];
  const worstStress = args.stressSimulator.worstScenario;
  const missing = unique([
    ...args.readiness.missingProof,
    ...args.riskBrain.missingData,
    ...args.holderIntelligence.missingData,
    ...args.liquidityIntelligence.missingData,
  ], 20);

  const basicRisk: CustomerReportDecisionSection = {
    id: "risk-drivers",
    title: "Risk drivers and decision path",
    minimumTier: "Basic",
    state: scoreState(args.riskBrain.brainScore, args.readiness.missingProof.length),
    summary: `Source-bound screening score ${args.riskBrain.brainScore}/100 (${args.riskBrain.verdict}); confidence ${args.riskBrain.confidence}/100. ${strongestLayer ? `Dominant lane: ${strongestLayer.label} (${strongestLayer.score}/100).` : "No dominant lane was established."}`,
    evidence: unique([
      `Base model score: ${args.result.score}/100`,
      strongestLayer ? `${strongestLayer.label}: ${strongestLayer.score}/100 — ${strongestLayer.explanation}` : null,
      strongestSynergy ? `${strongestSynergy.label}: ${strongestSynergy.score}/100 — ${strongestSynergy.body}` : null,
      ...args.result.signals.slice(0, 5).map((signal) => `${signal.id}: ${signal.points} points`),
    ], 10),
    actions: unique(args.riskBrain.nextActions, 6),
  };

  const basicEvidence: CustomerReportDecisionSection = {
    id: "evidence-coverage",
    title: "Evidence coverage and confidence limits",
    minimumTier: "Basic",
    state: readinessState(args.readiness, "basic"),
    summary: `${args.readiness.verifiedReceiptCount} verified provider receipts, ${args.readiness.sourceFamilyCount} provider families, ${args.readiness.evidenceCategoryCount} evidence categories and ${args.readiness.evidenceObservationCount} observations. ${args.readiness.customerMessage}`,
    evidence: unique([
      `Evidence fingerprint: ${args.readiness.evidenceFingerprint}`,
      `Durable evidence ledger: ${args.readiness.durableReceiptReady ? "verified" : "not verified"}`,
      ...args.readiness.evidenceCategories.map((category) => `Covered category: ${category}`),
      ...missing.map((item) => `Missing: ${item}`),
    ], 12),
    actions: unique([
      ...args.readiness.tiers.basic.missingCategories.map((category) => `Collect Basic evidence category: ${category}`),
      args.readiness.durableReceiptReady ? null : "Persist and read back the provider-evidence ledger before paid delivery.",
      "Treat missing evidence as uncertainty, never as evidence of safety.",
    ], 6),
  };

  const proLiquidity: CustomerReportDecisionSection = {
    id: "liquidity-exit-stress",
    title: "Liquidity, depth and exit stress",
    minimumTier: "Pro",
    state: scoreState(args.liquidityIntelligence.liquidityScore, args.liquidityIntelligence.missingData.length),
    summary: `${args.liquidityIntelligence.headline} Liquidity score ${args.liquidityIntelligence.liquidityScore}/100; uncertainty ${args.liquidityIntelligence.uncertaintyPercent}%. ${args.liquidityIntelligence.sourceTruth}`,
    evidence: unique([
      ...args.liquidityIntelligence.zones.map((zone) => `${zone.label}: ${zone.value} — ${zone.explanation}`),
      ...args.liquidityIntelligence.depthStress.map((row) => `${row.label}: ${row.value} — ${row.note}`),
      ...args.liquidityIntelligence.missingData.map((item) => `Missing: ${item}`),
    ], 12),
    actions: unique([
      ...args.liquidityIntelligence.zones.map((zone) => zone.command),
      ...args.liquidityIntelligence.analystCommands,
    ], 7),
  };

  const proStress: CustomerReportDecisionSection = {
    id: "scenario-stress",
    title: "Scenario and stress analysis",
    minimumTier: "Pro",
    state: worstStress ? scoreState(worstStress.score) : "missing",
    summary: worstStress
      ? `Worst deterministic scenario: ${worstStress.label}, score ${worstStress.score}/100 (${worstStress.severity}). These scenarios are screening estimates, not execution guarantees.`
      : "No stress scenario was produced from the current evidence.",
    evidence: unique(args.stressSimulator.scenarios.slice(0, 5).flatMap((scenario) => [
      `${scenario.label}: ${scenario.score}/100 (${scenario.severity})`,
      ...scenario.evidence,
      scenario.estimatedSlippagePercent === undefined ? null : `Estimated slippage: ${scenario.estimatedSlippagePercent.toFixed(2)}%`,
      scenario.estimatedDrawdownPercent === undefined ? null : `Estimated drawdown: ${scenario.estimatedDrawdownPercent.toFixed(2)}%`,
    ]), 14),
    actions: unique(args.stressSimulator.scenarios.slice(0, 5).map((scenario) => scenario.nextStep), 6),
  };

  const proHolders: CustomerReportDecisionSection = {
    id: "holder-concentration",
    title: "Holder concentration and ownership uncertainty",
    minimumTier: "Pro",
    state: scoreState(args.holderIntelligence.holderRiskScore, args.holderIntelligence.missingData.length),
    summary: `Holder risk ${args.holderIntelligence.holderRiskScore}/100 (${args.holderIntelligence.verdict}); data completeness ${args.holderIntelligence.dataCompleteness}% and uncertainty ${args.holderIntelligence.dataUncertaintyPercent}%.`,
    evidence: unique([
      ...args.holderIntelligence.lanes.map((lane) => `${lane.label}: ${lane.value}; score ${lane.score}/100`),
      ...args.holderIntelligence.nodes.map((node) => `${node.label}: ${node.dataStatus}; risk ${node.risk}/100; ${node.note}`),
      ...args.holderIntelligence.missingData.map((item) => `Missing: ${item}`),
    ], 14),
    actions: unique(args.holderIntelligence.nextActions, 6),
  };

  const advancedReview: CustomerReportDecisionSection = {
    id: "advanced-review-boundary",
    title: "Advanced separate manual-QA boundary",
    minimumTier: "Advanced",
    state: "blocked",
    summary: "The automated Advanced SKU is not for sale. Any future separately contracted manual-QA addendum would require validation of the same immutable payload, provider receipts, conflicts, severities and false-positive risk before delivery.",
    evidence: unique([
      `Automated readiness: ${args.readiness.tiers.advanced.sellReady ? "technical evidence ready" : "technical evidence incomplete"}`,
      `Advanced missing categories: ${args.readiness.tiers.advanced.missingCategories.join(", ") || "none"}`,
      `Unique evidence delta: ${args.readiness.tiers.advanced.uniqueEvidenceDelta}/${args.readiness.tiers.advanced.minimumUniqueEvidenceDelta}`,
      `Corroborated categories: ${args.readiness.tiers.advanced.corroboratedCategoryCount}`,
      "Payment entitlement is not proof that manual review was completed.",
    ], 10),
    actions: unique([
      "Queue the immutable report snapshot for an assigned reviewer.",
      "Validate severity, evidence lineage, provider conflicts and false positives.",
      "Bind reviewer and approver receipts to the exact payload and PDF digest.",
      "Release the Advanced appendix only after dual-control approval.",
    ], 6),
  };

  return [basicRisk, basicEvidence, proLiquidity, proStress, proHolders, advancedReview];
}
