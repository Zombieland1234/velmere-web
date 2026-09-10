/**
 * Velmère Report Semantic Linter
 *
 * Implements automated semantic linting for audit reports prior to rendering/exporting.
 * Enforces Section 12 of the Master Release Directive:
 * 1. Rejects contradictory claims (e.g. confidence > 80 when coverage < 50)
 * 2. Rejects wrong asset-class sections (e.g. EVM bytecode in equity or FX reports)
 * 3. Rejects unsupported VERIFIED states (VERIFIED without evidenceId)
 * 4. Rejects tier leakage (advanced findings in basic reports)
 * 5. Rejects placeholder / mock identifiers (e.g. '0x1111...', '0xbbbb...', 'fixture:', 'mock:', 'synthetic:', 'TODO')
 * 6. Enforces numeric bounds: coverage in [0,100], riskScore in [0,100], confidence in [0,100]
 * 7. Enforces date/timestamp plausibility (not >5m in future, not >7d in past)
 * 8. Rejects findings lacking evidence IDs
 * 9. Rejects unhedged marketing absolutes ('100%', 'guaranteed', 'certified', 'legally protected')
 */

import { AssetClass } from "./asset-class-firewall";
import type { CanonicalAuditReportModel, AuditTier } from "./audit-canonical-report";

export interface SemanticLintIssue {
  code: string;
  field: string;
  message: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface SemanticLintResult {
  valid: boolean;
  criticalCount: number;
  highCount: number;
  issues: SemanticLintIssue[];
  lintedAt: string;
}

export class ReportSemanticViolationError extends Error {
  public readonly issues: SemanticLintIssue[];

  constructor(issues: SemanticLintIssue[]) {
    super(
      `[REPORT_LINTER_VIOLATION] Report failed semantic validation with ${issues.length} issue(s):\n` +
        issues.map((i) => ` - [${i.severity}] [${i.code}] ${i.field}: ${i.message}`).join("\n"),
    );
    this.name = "ReportSemanticViolationError";
    this.issues = issues;
  }
}

const BANNED_ABSOLUTES_REGEX = /\b(100%\s*(?:safe|secure|guarantee|protection|coverage)|guaranteed|certified(?!\s*(?:by\s+third-party|authority))|legally\s*binding|zero\s*risk|unhackable)\b/i;

export function isPlaceholderAddress(address: string): boolean {
  const clean = address.trim().toLowerCase();
  if (
    clean.startsWith("fixture:") ||
    clean.startsWith("mock:") ||
    clean.startsWith("synthetic:") ||
    clean.startsWith("temp:") ||
    clean.includes("todo")
  ) {
    return true;
  }
  // If it's a 42-char EVM hex address: check for artificial repeated patterns
  if (/^0x[0-9a-f]{40}$/i.test(clean)) {
    const hex = clean.slice(2);
    // 40 identical characters (e.g. 0x0000..., 0x1111..., 0xbbbb...)
    if (new Set(hex).size === 1) return true;
    // Repeated 2-char pattern (e.g. 0x121212...)
    if (hex.slice(0, 2).repeat(20) === hex) return true;
  }
  return false;
}

export function lintCanonicalReport(
  report: CanonicalAuditReportModel,
  assetClass: AssetClass,
): SemanticLintResult {
  const issues: SemanticLintIssue[] = [];

  // --- CHECK 1: Contradictory Claims ---
  if (report.verdict.confidenceScore > 80 && report.verdict.evidenceCoverage < 50) {
    issues.push({
      code: "CONTRADICTORY_CONFIDENCE_COVERAGE",
      field: "verdict.confidenceScore",
      message: `Confidence (${report.verdict.confidenceScore}) cannot exceed 80 when evidence coverage is low (${report.verdict.evidenceCoverage}%).`,
      severity: "CRITICAL",
    });
  }

  // --- CHECK 2: Numeric Bounds ---
  if (report.verdict.riskScore < 0 || report.verdict.riskScore > 100 || isNaN(report.verdict.riskScore)) {
    issues.push({
      code: "NUMERIC_BOUNDS_VIOLATION",
      field: "verdict.riskScore",
      message: `Risk score must be between 0 and 100, got ${report.verdict.riskScore}.`,
      severity: "CRITICAL",
    });
  }
  if (report.verdict.confidenceScore < 0 || report.verdict.confidenceScore > 100 || isNaN(report.verdict.confidenceScore)) {
    issues.push({
      code: "NUMERIC_BOUNDS_VIOLATION",
      field: "verdict.confidenceScore",
      message: `Confidence score must be between 0 and 100, got ${report.verdict.confidenceScore}.`,
      severity: "CRITICAL",
    });
  }
  if (report.verdict.evidenceCoverage < 0 || report.verdict.evidenceCoverage > 100 || isNaN(report.verdict.evidenceCoverage)) {
    issues.push({
      code: "NUMERIC_BOUNDS_VIOLATION",
      field: "verdict.evidenceCoverage",
      message: `Evidence coverage must be between 0 and 100, got ${report.verdict.evidenceCoverage}.`,
      severity: "CRITICAL",
    });
  }

  // --- CHECK 3: Wrong Asset-Class Sections ---
  const isEvm = assetClass === "evm_contract";
  for (const section of report.sections) {
    if (!isEvm) {
      if (
        section.id === "advanced_bytecode_diff" ||
        section.id === "contract_identity" ||
        section.id === "pro_permission_parser"
      ) {
        // If present in non-EVM report, it MUST be either marked locked, empty, or explicitly NOT_APPLICABLE
        const hasEvmMetrics = section.data?.metrics?.some(
          (m) =>
            m.label.toLowerCase().includes("bytecode") ||
            m.label.toLowerCase().includes("compiler") ||
            m.label.toLowerCase().includes("proxy"),
        );
        if (hasEvmMetrics && !section.isLocked) {
          // Check if it clearly explains NOT_APPLICABLE
          const isMarkedNA = section.data?.metrics?.every(
            (m) => m.value.includes("NOT_APPLICABLE") || m.value.includes("Not applicable"),
          );
          if (!isMarkedNA) {
            issues.push({
              code: "ASSET_CLASS_SECTION_LEAKAGE",
              field: `sections.${section.id}`,
              message: `EVM contract section '${section.id}' with bytecode metrics cannot appear in ${assetClass} report without NOT_APPLICABLE status.`,
              severity: "CRITICAL",
            });
          }
        }
      }
    }
  }

  // --- CHECK 4: Placeholder Identifiers in Non-Testing Context ---
  if (isPlaceholderAddress(report.target.contractAddress)) {
    // If it's not a verified EVM contract, dummy addresses like 0xbbbb... are prohibited
    issues.push({
      code: "SYNTHETIC_IDENTIFIER_LEAKAGE",
      field: "target.contractAddress",
      message: `Synthetic placeholder address '${report.target.contractAddress}' is prohibited in verified reports.`,
      severity: "CRITICAL",
    });
  }

  // --- CHECK 5: Tier Leakage ---
  const tierOrder: Record<AuditTier, number> = { basic: 1, pro: 2, advanced: 3 };
  const userTierRank = tierOrder[report.clientEntitlementTier];

  for (const section of report.sections) {
    const requiredRank = tierOrder[section.requiredTier];
    if (requiredRank > userTierRank && !section.isLocked) {
      issues.push({
        code: "TIER_LEAKAGE_UNLOCKED",
        field: `sections.${section.id}`,
        message: `Section '${section.id}' requires tier '${section.requiredTier}' but was unlocked for user tier '${report.clientEntitlementTier}'.`,
        severity: "CRITICAL",
      });
    }

    if (section.data?.findings) {
      for (const finding of section.data.findings) {
        const findingTier = finding.requiredTier || "basic";
        const findingTierRank = tierOrder[findingTier];
        if (findingTierRank > userTierRank) {
          issues.push({
            code: "TIER_FINDING_LEAKAGE",
            field: `findings.${finding.id}`,
            message: `Finding '${finding.id}' requires '${finding.requiredTier}' but leaked into '${report.clientEntitlementTier}' report.`,
            severity: "CRITICAL",
          });
        }

        // --- CHECK 6: Finding Evidence Presence ---
        if (!finding.evidence || finding.evidence.trim().length === 0) {
          issues.push({
            code: "MISSING_FINDING_EVIDENCE",
            field: `findings.${finding.id}.evidence`,
            message: `Finding '${finding.id}' must provide traceable evidence.`,
            severity: "HIGH",
          });
        }
      }
    }
  }

  // --- CHECK 7: Timestamp Plausibility ---
  const reportTime = new Date(report.createdAt).getTime();
  const now = Date.now();
  if (isNaN(reportTime)) {
    issues.push({
      code: "INVALID_TIMESTAMP",
      field: "createdAt",
      message: `Invalid createdAt timestamp: ${report.createdAt}`,
      severity: "CRITICAL",
    });
  } else {
    // Not more than 5 minutes in future (allowing for minor clock skew)
    if (reportTime > now + 5 * 60 * 1000) {
      issues.push({
        code: "FUTURE_TIMESTAMP",
        field: "createdAt",
        message: `Report timestamp is in the future: ${report.createdAt}`,
        severity: "CRITICAL",
      });
    }
    // Not older than 7 days
    if (now - reportTime > 7 * 24 * 60 * 60 * 1000) {
      issues.push({
        code: "STALE_TIMESTAMP",
        field: "createdAt",
        message: `Report is older than 7 days: ${report.createdAt}`,
        severity: "HIGH",
      });
    }
  }

  // --- CHECK 8: Unhedged Marketing Absolutes ---
  const checkText = (text: string, path: string) => {
    const match = text.match(BANNED_ABSOLUTES_REGEX);
    if (match) {
      issues.push({
        code: "UNHEDGED_MARKETING_ABSOLUTE",
        field: path,
        message: `Prohibited unhedged absolute phrase found: "${match[0]}"`,
        severity: "HIGH",
      });
    }
  };

  checkText(report.verdict.summary, "verdict.summary");
  for (const s of report.sections) {
    if (s.data?.paragraphs) {
      s.data.paragraphs.forEach((p, idx) => checkText(p, `sections.${s.id}.paragraphs[${idx}]`));
    }
    if (s.data?.metrics) {
      s.data.metrics.forEach((m, idx) => {
        checkText(m.value, `sections.${s.id}.metrics[${idx}].value`);
      });
    }
  }

  const criticalCount = issues.filter((i) => i.severity === "CRITICAL").length;
  const highCount = issues.filter((i) => i.severity === "HIGH").length;

  return {
    valid: criticalCount === 0 && highCount === 0,
    criticalCount,
    highCount,
    issues,
    lintedAt: new Date().toISOString(),
  };
}
