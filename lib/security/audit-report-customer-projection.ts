import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "./ascii-control-characters";

import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import type {
  Pass2578AuditReportAssemblerReport,
  Pass2578ReportSection,
  Pass2578ReportTier,
} from "@/lib/security/audit-report-assembler";
import type { AuditTierId } from "@/lib/security/audit-tier-contract";

export const PASS4820_AUDIT_REPORT_CUSTOMER_PROJECTION_ID = "pass4820-audit-report-customer-projection-v1" as const;

type DeliveredAuditTier = AuditTierId;

const TIER_RANK: Record<Pass2578ReportTier, number> = { basic: 0, pro: 1, advanced: 2 };

function clean(value: unknown, max = 900) {
  return typeof value === "string"
    ? value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function safeLockedAction(locale: string) {
  if (locale === "pl") return "Advanced nie jest w sprzedaży. Manual review ani podpis operatora nie są częścią produktu.";
  if (locale === "de") return "Advanced steht nicht zum Verkauf. Manuelle Prüfung und Operator-Freigabe sind nicht enthalten.";
  return "Advanced is not for sale. Manual review and operator sign-off are not included.";
}

function tierVisible(sectionTier: Pass2578ReportTier, deliveredTier: DeliveredAuditTier) {
  return TIER_RANK[sectionTier] <= TIER_RANK[deliveredTier];
}

function projectSection(section: Pass2578ReportSection, deliveredTier: DeliveredAuditTier, locale: string): Pass2578ReportSection {
  const paidVisible = deliveredTier === "pro" || deliveredTier === "advanced";
  return {
    ...section,
    customerSummary: clean(section.customerSummary),
    proPdfSummary: paidVisible ? clean(section.proPdfSummary) : "Paid evidence details are locked.",
    advancedAction: deliveredTier === "basic" ? safeLockedAction(locale) : clean(section.advancedAction),
    sourceFamilies: Array.from(new Set(section.sourceFamilies.map((item) => clean(item, 100)).filter(Boolean))).slice(0, 8),
  };
}

export function projectAuditReportForCustomer(args: {
  report: Pass2578AuditReportAssemblerReport;
  requestedTier: AuditTierId;
  deliveredTier: DeliveredAuditTier;
  manualReviewVerified: boolean;
}) {
  const report = args.report;
  // R44P44: Advanced is never customer-deliverable, regardless of legacy operator flags.
  const deliveredTier: DeliveredAuditTier = args.deliveredTier === "advanced" ? "pro" : args.deliveredTier;
  const sections = report.sections
    .filter((section) => tierVisible(section.tier, deliveredTier))
    .map((section) => projectSection(section, deliveredTier, report.locale));
  const visibleIds = new Set(sections.map((section) => section.id));
  const basicSections = sections.filter((section) => section.tier === "basic" || section.state !== "ready").slice(0, 6);
  const proPdfSections = deliveredTier === "basic" ? [] : sections.filter((section) => section.tier === "pro" || section.state !== "ready");
  const topFindings = report.topFindings
    .filter((finding) => {
      const sectionId = finding.id.replace(/^finding-/, "");
      if (visibleIds.has(sectionId)) return true;
      if (finding.sourceFamily.startsWith("permission:") && visibleIds.has("permission-parser")) return true;
      if (finding.sourceFamily.startsWith("historical-deployment:") && visibleIds.has("claim-ledger")) return true;
      if (finding.sourceFamily.startsWith("current-chain:") && visibleIds.has("claim-ledger")) return true;
      return false;
    })
    .map((finding) => ({
      ...finding,
      publicLine: clean(finding.publicLine),
      proLine: deliveredTier === "basic" ? clean(finding.publicLine) : clean(finding.proLine),
      advancedAction: deliveredTier === "basic" ? safeLockedAction(report.locale) : clean(finding.advancedAction),
      sourceFamily: clean(finding.sourceFamily, 100) || "evidence-bound-source",
    }));
  const advancedQueue: string[] = [];
  const proPdfLines = deliveredTier === "basic"
    ? []
    : report.proPdfLines.map((line) => clean(line, 1_200)).filter(Boolean).slice(0, 480);

  const projectedReport: Pass2578AuditReportAssemblerReport = {
    ...report,
    reportMode: "customer-projected canonical audit contract",
    sections,
    basicSections,
    proPdfSections,
    advancedQueue,
    topFindings,
    proPdfLines,
    visualMergeContract: {
      ...report.visualMergeContract,
      purpose: clean(report.visualMergeContract.purpose),
      doNotBreak: report.visualMergeContract.doNotBreak.map((item) => clean(item)).filter(Boolean),
      uiSlots: report.visualMergeContract.uiSlots
        .filter((slot) => slot.slot !== "advanced_manual_queue" && slot.slot !== "advanced_automated_evidence_actions")
        .map((slot) => ({ ...slot, notes: clean(slot.notes) })),
    },
  };

  const unsigned = {
    schemaVersion: PASS4820_AUDIT_REPORT_CUSTOMER_PROJECTION_ID,
    requestedTier: args.requestedTier,
    deliveredTier,
    manualReviewVerified: false,
    manualReviewInputIgnored: args.manualReviewVerified,
    sourceReportGeneratedAt: report.generatedAt,
    report: projectedReport,
    hidden: {
      advancedQueueHidden: report.advancedQueue.length - advancedQueue.length,
      proPdfLinesHidden: report.proPdfLines.length - proPdfLines.length,
      sectionsHidden: report.sections.length - sections.length,
    },
    rule: "Customer projection never exposes Pro evidence to Basic and never exposes Advanced automated evidence actions below Advanced. Advanced remains not for sale and human review/operator sign-off are not included.",
  } as const;

  return { ...unsigned, projectionDigest: sha256Digest(canonicalJson(unsigned)) };
}

/**
 * PASS4829 rights/currentness boundary. This projection deliberately preserves
 * only customer-authorized target identity and the fact that delivery is
 * blocked. Provider-derived scores, findings, section evidence and paid lines
 * are removed before the pipeline result can cross another route boundary.
 */
export function projectBlockedAuditReportForCustomer(args: {
  report: Pass2578AuditReportAssemblerReport;
  requestedTier: AuditTierId;
  reasonDigest: string;
}) {
  const report = args.report;
  const blockedReport: Pass2578AuditReportAssemblerReport = {
    ...report,
    rule: "Provider-derived audit facts are withheld until field-level rights and currentness are verified.",
    reportMode: "customer-blocked rights/currentness projection",
    finalVerdict: {
      riskScore: null,
      riskLabel: "WITHHELD",
      reviewPriorityScore: 0,
      sourceConfidence: 0,
      readinessScore: 0,
      basicState: "blocked",
      proState: "blocked",
      advancedState: "blocked",
      publicVerdict: "Provider-derived audit findings are withheld.",
      proVerdict: "Provider-derived audit findings are withheld.",
      advancedVerdict: "Provider-derived audit findings are withheld.",
    },
    summary: {
      totalSections: 0,
      ready: 0,
      partial: 0,
      missing: 0,
      blocked: 1,
      manualReview: 0,
      totalEvidence: 0,
      totalMissing: 1,
      proPdfSections: 0,
      advancedActions: 0,
    },
    sections: [],
    basicSections: [],
    proPdfSections: [],
    advancedQueue: [],
    topFindings: [],
    proPdfLines: [],
    visualMergeContract: {
      purpose: "Render only a customer-safe blocked state.",
      doNotBreak: ["No provider-derived fact may cross this boundary while rights/currentness is blocked."],
      uiSlots: [],
    },
  };
  const unsigned = {
    schemaVersion: "pass4829-audit-report-customer-blocked-projection-v1" as const,
    requestedTier: args.requestedTier,
    deliveredTier: "basic" as const,
    manualReviewVerified: false,
    manualReviewInputIgnored: true,
    sourceReportGeneratedAt: report.generatedAt,
    reasonDigest: args.reasonDigest,
    report: blockedReport,
    hidden: {
      advancedQueueHidden: report.advancedQueue.length,
      proPdfLinesHidden: report.proPdfLines.length,
      sectionsHidden: report.sections.length,
      findingsHidden: report.topFindings.length,
    },
    rule: "Rights/currentness blocking removes scores, findings, evidence sections and paid lines rather than relying only on the outer HTTP handler.",
  } as const;
  return { ...unsigned, projectionDigest: sha256Digest(canonicalJson(unsigned)) };
}

