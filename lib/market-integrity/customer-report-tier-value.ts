import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { AdvancedDeliveryMode } from "@/lib/market-integrity/top1-entitlement-report-access";

export const PASS4819_CUSTOMER_REPORT_TIER_VALUE_ID = "pass4819-customer-report-tier-value-v1" as const;

type DecisionSectionLike = {
  minimumTier: VelmereTier;
  state: "ready" | "watch" | "blocked" | "missing";
  evidence: string[];
  actions: string[];
};

export type CustomerReportTierValueGate = {
  schemaVersion: typeof PASS4819_CUSTOMER_REPORT_TIER_VALUE_ID;
  requestedTier: VelmereTier;
  readiness: Record<VelmereTier, boolean>;
  highestValueTier: VelmereTier | null;
  score: number;
  uniqueDecisionUnits: Record<VelmereTier, number>;
  evidenceUnits: Record<VelmereTier, number>;
  actionUnits: Record<VelmereTier, number>;
  blockers: Record<VelmereTier, string[]>;
  measurableDelta: {
    basicToPro: number;
    proToAdvanced: number;
  };
  rule: string;
};

const rank: Record<VelmereTier, number> = { Basic: 0, Pro: 1, Advanced: 2 };

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sectionUnits(sections: DecisionSectionLike[], tier: VelmereTier) {
  const exact = sections.filter((section) => section.minimumTier === tier);
  return {
    decisions: exact.filter((section) => section.state !== "missing").length,
    readyDecisions: exact.filter((section) => section.state === "ready" || section.state === "watch").length,
    evidence: unique(exact.flatMap((section) => section.evidence)).length,
    actions: unique(exact.flatMap((section) => section.actions)).length,
  };
}

export function buildCustomerReportTierValueGate(args: {
  requestedTier: VelmereTier;
  surface: "shield" | "real_markets" | "security";
  coverageOverall: number;
  independentContentBoundUpstreams: number;
  contentBoundReceiptCount: number;
  decisionSections: DecisionSectionLike[];
  executedTests: string[];
  manualReviewVerified: boolean;
  monitoringConfigured: boolean;
  advancedDeliveryMode?: AdvancedDeliveryMode;
  advancedAutomationVerified?: boolean;
}): CustomerReportTierValueGate {
  const basic = sectionUnits(args.decisionSections, "Basic");
  const pro = sectionUnits(args.decisionSections, "Pro");
  const advanced = sectionUnits(args.decisionSections, "Advanced");
  const executed = new Set(args.executedTests);
  const advancedDeliveryMode = args.advancedDeliveryMode ?? "manual_review";

  const blockers: Record<VelmereTier, string[]> = { Basic: [], Pro: [], Advanced: [] };

  if (args.coverageOverall < 30) blockers.Basic.push("basic_coverage_below_30");
  if (args.contentBoundReceiptCount < 1) blockers.Basic.push("basic_content_bound_receipt_missing");
  if (basic.readyDecisions < 1) blockers.Basic.push("basic_decision_section_missing");
  if (basic.evidence < 2) blockers.Basic.push("basic_evidence_units_below_2");
  
  if (blockers.Basic.length) blockers.Pro.push("basic_value_not_ready");
  if (args.coverageOverall < 70) blockers.Pro.push("pro_coverage_below_70");
  if (args.independentContentBoundUpstreams < 2) blockers.Pro.push("pro_two_independent_upstreams_missing");
  if (args.contentBoundReceiptCount < 2) blockers.Pro.push("pro_content_bound_receipts_below_2");
  if (pro.readyDecisions < 2) blockers.Pro.push("pro_unique_decision_sections_below_2");
  if (pro.evidence < 4) blockers.Pro.push("pro_unique_evidence_units_below_4");
  if (pro.actions < 2) blockers.Pro.push("pro_unique_action_units_below_2");
  if (args.surface === "shield" && !executed.has("stress_scenarios")) blockers.Pro.push("pro_stress_scenarios_not_executed");
  if (args.surface === "real_markets" && !executed.has("chart_lifecycle")) blockers.Pro.push("pro_historical_context_not_verified");
  if (!executed.has("evidence_ledger")) blockers.Pro.push("pro_evidence_ledger_not_verified");

  if (blockers.Pro.length) blockers.Advanced.push("pro_value_not_ready");
  if (args.coverageOverall < 85) blockers.Advanced.push("advanced_coverage_below_85");
  if (args.independentContentBoundUpstreams < 3) blockers.Advanced.push("advanced_three_independent_upstreams_missing");
  if (advanced.readyDecisions < 1) blockers.Advanced.push("advanced_ready_decision_section_missing");
  if (advanced.evidence < 3) blockers.Advanced.push("advanced_unique_evidence_units_below_3");
  if (advanced.actions < 2) blockers.Advanced.push("advanced_unique_action_units_below_2");
  if (advancedDeliveryMode === "automated") {
    if (!args.advancedAutomationVerified) blockers.Advanced.push("advanced_automation_not_verified");
    if (!executed.has("advanced_automation")) blockers.Advanced.push("advanced_automation_test_missing");
    if (!executed.has("stress_scenarios")) blockers.Advanced.push("advanced_stress_scenarios_not_executed");
    if (!executed.has("evidence_ledger")) blockers.Advanced.push("advanced_evidence_ledger_not_verified");
  } else {
    if (!args.manualReviewVerified) blockers.Advanced.push("advanced_manual_review_not_verified");
    if (!args.monitoringConfigured) blockers.Advanced.push("advanced_monitoring_not_configured");
    if (!executed.has("manual_review")) blockers.Advanced.push("advanced_manual_review_test_missing");
  }

  const readiness = {
    Basic: blockers.Basic.length === 0,
    Pro: blockers.Pro.length === 0,
    Advanced: blockers.Advanced.length === 0,
  };
  const highestValueTier: VelmereTier | null = readiness.Advanced ? "Advanced" : readiness.Pro ? "Pro" : readiness.Basic ? "Basic" : null;
  const basicUnits = basic.decisions * 5 + basic.evidence * 2 + basic.actions;
  const proUnits = pro.decisions * 7 + pro.evidence * 2 + pro.actions * 2;
  const advancedUnits = advanced.decisions * 8
    + advanced.evidence * 2
    + advanced.actions * 2
    + (advancedDeliveryMode === "automated"
      ? args.advancedAutomationVerified ? 12 : 0
      : args.manualReviewVerified ? 12 : 0)
    + (advancedDeliveryMode === "manual_review" && args.monitoringConfigured ? 6 : 0);
  const requestedReady = readiness[args.requestedTier];
  const score = clamp(
    args.coverageOverall * 0.35
      + Math.min(25, args.independentContentBoundUpstreams * 7)
      + Math.min(20, basicUnits * 0.7)
      + Math.min(15, proUnits * 0.5)
      + Math.min(5, advancedUnits * 0.2)
      - blockers[args.requestedTier].length * 8,
  );

  return {
    schemaVersion: PASS4819_CUSTOMER_REPORT_TIER_VALUE_ID,
    requestedTier: args.requestedTier,
    readiness,
    highestValueTier,
    score: requestedReady ? Math.max(score, args.requestedTier === "Advanced" ? 88 : args.requestedTier === "Pro" ? 72 : 45) : score,
    uniqueDecisionUnits: { Basic: basic.decisions, Pro: pro.decisions, Advanced: advanced.decisions },
    evidenceUnits: { Basic: basic.evidence, Pro: pro.evidence, Advanced: advanced.evidence },
    actionUnits: { Basic: basic.actions, Pro: pro.actions, Advanced: advanced.actions },
    blockers,
    measurableDelta: {
      basicToPro: Math.max(0, proUnits),
      proToAdvanced: Math.max(0, advancedUnits),
    },
    rule: advancedDeliveryMode === "automated"
      ? "Automated paid value is earned by unique evidence, corroboration, scenario execution, decision sections and safe actions—not by payment, optional human QA, report length or tier labels."
      : "Paid value is earned by unique evidence, decision sections, safe actions and verified review—not by report length, payment or tier labels.",
  };
}

export function highestAllowedTierByValue(gate: CustomerReportTierValueGate, requestedTier: VelmereTier): VelmereTier | null {
  const candidates: VelmereTier[] = ["Advanced", "Pro", "Basic"];
  return candidates.find((tier) => rank[tier] <= rank[requestedTier] && gate.readiness[tier]) ?? null;
}
