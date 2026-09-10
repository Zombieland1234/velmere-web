import type { VlmDepth, VlmLocale } from "./vlm-contract";
import type { VlmBrainKernelFinding, VlmBrainKernelSeverity } from "./vlm-brain-kernel";
import { buildVlmEntitlementFirewallDecision, type VlmEntitlementAccessMode } from "./vlm-entitlement-output-firewall";

export const PASS2186_VLM_AUDIT_FINDING_SCHEMA_ID = "pass2186-vlm-audit-finding-schema-v1" as const;

export type VlmAuditFindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type VlmAuditFindingConfidenceBand = "confirmed" | "likely" | "uncertain" | "needs_evidence";
export type VlmAuditExploitability = "none" | "low" | "medium" | "high" | "unknown";
export type VlmAuditFindingStatus = "confirmed" | "likely" | "needs_retest" | "missing_proof" | "false_positive_risk";
export type VlmAuditEvidenceStatus = "verified" | "partial" | "missing" | "contradicted" | "operator_only";
export type VlmAuditFindingAudience = "public_preview" | "customer_report" | "operator_advanced";

export type VlmAuditEvidenceRow = {
  id: string;
  claim: string;
  source: string;
  status: VlmAuditEvidenceStatus;
  confidence: number;
  publicSafe: boolean;
  redactedReason?: string;
};

export type VlmAuditRemediationPlan = {
  owner: "ai" | "operator" | "developer" | "provider" | "customer";
  recommendation: string;
  acceptanceCriteria: string[];
  regressionTest: string;
  estimatedEffort: "quick" | "medium" | "large" | "unknown";
};

export type VlmAuditFindingInput = {
  id?: string;
  title: string;
  description?: string;
  severity?: VlmAuditFindingSeverity | "warning" | "watch" | "critical" | "info";
  confidence?: number;
  exploitability?: VlmAuditExploitability;
  businessImpact?: string;
  evidence?: Array<string | Partial<VlmAuditEvidenceRow>>;
  recommendation?: string;
  affectedSurface?: string;
  status?: VlmAuditFindingStatus;
};

export type VlmAuditFinding = {
  schemaVersion: typeof PASS2186_VLM_AUDIT_FINDING_SCHEMA_ID;
  id: string;
  title: string;
  severity: VlmAuditFindingSeverity;
  confidence: number;
  confidenceBand: VlmAuditFindingConfidenceBand;
  status: VlmAuditFindingStatus;
  exploitability: VlmAuditExploitability;
  affectedSurface: string;
  businessImpact: string;
  evidenceRows: VlmAuditEvidenceRow[];
  remediation: VlmAuditRemediationPlan;
  falsePositiveRisk: "low" | "medium" | "high";
  customerSafeSummary: string;
  operatorNotes: string[];
};

export type VlmAuditFindingSchemaPack = {
  schemaVersion: typeof PASS2186_VLM_AUDIT_FINDING_SCHEMA_ID;
  locale: VlmLocale;
  requestedDepth: VlmDepth;
  allowedDepth: VlmDepth;
  advancedUnlocked: boolean;
  audience: VlmAuditFindingAudience;
  findings: VlmAuditFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    missingProof: number;
    falsePositiveRisk: number;
    reportAllowed: boolean;
    customerSafeBoundary: string;
  };
  rubric: {
    severityRule: string;
    confidenceRule: string;
    evidenceRule: string;
    paidBoundaryRule: string;
  };
};

function clampPercent(value: unknown, fallback = 50) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function compact(value: unknown, fallback: string, max = 420) {
  const text = typeof value === "string" ? value : fallback;
  const clean = text.replace(/\s+/g, " ").trim();
  return (clean || fallback).slice(0, max);
}

export function normalizeVlmAuditSeverity(value?: VlmAuditFindingInput["severity"]): VlmAuditFindingSeverity {
  if (value === "critical") return "critical";
  if (value === "high") return "high";
  if (value === "medium" || value === "warning") return "medium";
  if (value === "low" || value === "watch") return "low";
  return "info";
}

export function auditSeverityToKernelSeverity(severity: VlmAuditFindingSeverity): VlmBrainKernelSeverity {
  if (severity === "critical") return "critical";
  if (severity === "high" || severity === "medium") return "warning";
  if (severity === "low") return "watch";
  return "info";
}

export function buildVlmAuditConfidenceBand(confidence: number, evidenceRows: VlmAuditEvidenceRow[]): VlmAuditFindingConfidenceBand {
  const verified = evidenceRows.filter((row) => row.status === "verified").length;
  const missing = evidenceRows.some((row) => row.status === "missing" || row.status === "contradicted");
  if (confidence >= 82 && verified >= 2 && !missing) return "confirmed";
  if (confidence >= 62 && verified >= 1) return "likely";
  if (confidence >= 40) return "uncertain";
  return "needs_evidence";
}

function normalizeEvidenceRows(input: VlmAuditFindingInput, findingIndex: number): VlmAuditEvidenceRow[] {
  const rows = (input.evidence ?? []).slice(0, 12).map((item, index) => {
    if (typeof item === "string") {
      return {
        id: `audit.evidence.${findingIndex + 1}.${index + 1}`,
        claim: compact(item, "Evidence claim", 360),
        source: "operator-intake",
        status: "partial" as const,
        confidence: 58,
        publicSafe: true,
      };
    }
    return {
      id: compact(item.id, `audit.evidence.${findingIndex + 1}.${index + 1}`, 96),
      claim: compact(item.claim, "Evidence claim requires clearer wording", 360),
      source: compact(item.source, "operator-intake", 120),
      status: item.status === "verified" || item.status === "partial" || item.status === "missing" || item.status === "contradicted" || item.status === "operator_only" ? item.status : "partial",
      confidence: clampPercent(item.confidence, 55),
      publicSafe: item.publicSafe !== false && item.status !== "operator_only",
      redactedReason: item.redactedReason ? compact(item.redactedReason, "operator_only", 180) : undefined,
    } satisfies VlmAuditEvidenceRow;
  });

  if (rows.length) return rows;
  return [{
    id: `audit.evidence.${findingIndex + 1}.missing`,
    claim: "Finding has no verified evidence row yet.",
    source: "audit-brain",
    status: "missing",
    confidence: 0,
    publicSafe: true,
    redactedReason: "missing_proof",
  }];
}

function defaultBusinessImpact(severity: VlmAuditFindingSeverity) {
  if (severity === "critical") return "Can block launch or paid Advanced exposure until proof and remediation are complete.";
  if (severity === "high") return "Can materially reduce trust, payment safety or audit quality if released without remediation.";
  if (severity === "medium") return "Can create user confusion, false confidence or support burden if not fixed.";
  if (severity === "low") return "Should be fixed to reduce friction and regression risk.";
  return "Informational note that improves traceability but does not block release.";
}

function defaultRegressionTest(title: string) {
  return `Add or run a regression check proving the finding stays fixed: ${title}`.slice(0, 260);
}

export function normalizeVlmAuditFinding(input: VlmAuditFindingInput, index = 0): VlmAuditFinding {
  const severity = normalizeVlmAuditSeverity(input.severity);
  const evidenceRows = normalizeEvidenceRows(input, index);
  const confidence = clampPercent(input.confidence, evidenceRows.some((row) => row.status === "verified") ? 72 : 42);
  const confidenceBand = buildVlmAuditConfidenceBand(confidence, evidenceRows);
  const missingProof = evidenceRows.some((row) => row.status === "missing" || row.status === "contradicted");
  const status: VlmAuditFindingStatus = input.status ?? (missingProof ? "missing_proof" : confidenceBand === "confirmed" ? "confirmed" : confidenceBand === "likely" ? "likely" : "needs_retest");
  const falsePositiveRisk = status === "false_positive_risk" || confidence < 45 ? "high" : confidence < 68 ? "medium" : "low";
  const title = compact(input.title, `Audit finding ${index + 1}`, 180);
  const recommendation = compact(input.recommendation, "Define owner, fix, acceptance criteria and retest before release.", 500);
  return {
    schemaVersion: PASS2186_VLM_AUDIT_FINDING_SCHEMA_ID,
    id: compact(input.id, `audit.finding.${index + 1}`, 96),
    title,
    severity,
    confidence,
    confidenceBand,
    status,
    exploitability: input.exploitability ?? (severity === "critical" || severity === "high" ? "medium" : "low"),
    affectedSurface: compact(input.affectedSurface, "velmere-audit-brain", 160),
    businessImpact: compact(input.businessImpact, defaultBusinessImpact(severity), 520),
    evidenceRows,
    remediation: {
      owner: "developer",
      recommendation,
      acceptanceCriteria: [
        "Finding has at least one verified or deliberately marked missing evidence row.",
        "Fix is customer-safe and does not expose exploit instructions or secrets.",
        "Regression test or release gate is attached before closing the issue.",
      ],
      regressionTest: defaultRegressionTest(title),
      estimatedEffort: severity === "critical" || severity === "high" ? "medium" : "quick",
    },
    falsePositiveRisk,
    customerSafeSummary: compact(input.description ?? recommendation, recommendation, 420),
    operatorNotes: missingProof
      ? ["Missing or contradictory proof blocks a final customer-safe claim.", "Do not promote this as verified until evidence is attached."]
      : ["Evidence is present; keep raw operator details out of public/free responses."],
  };
}

function localizedBoundary(locale: VlmLocale, advancedUnlocked: boolean) {
  if (locale === "de") return advancedUnlocked
    ? "Advanced Audit ist entsperrt: vollständige Evidence-Tabelle und Operator-Notizen sind erlaubt, aber keine Exploit-Anleitungen oder falsche Zertifizierung."
    : "Kostenlose Ansicht: sichere Zusammenfassung, Scope, Severity und Missing Proof; vollständige Evidence-Tabelle und Operator-Anhang bleiben gesperrt.";
  if (locale === "en") return advancedUnlocked
    ? "Advanced Audit is unlocked: full evidence table and operator notes are allowed, but exploit steps and fake certification claims remain blocked."
    : "Free view: safe summary, scope, severity and missing proof; full evidence table and operator appendix stay locked.";
  return advancedUnlocked
    ? "Advanced Audit odblokowany: pełna tabela dowodów i notatki operatora są dozwolone, ale instrukcje exploitów i fałszywe certyfikaty dalej są blokowane."
    : "Widok darmowy: bezpieczne podsumowanie, scope, severity i missing proof; pełna tabela dowodów oraz operator appendix zostają zablokowane.";
}

export function buildVlmAuditFindingSchemaPack(args: {
  findings: VlmAuditFindingInput[];
  locale?: VlmLocale;
  requestedDepth?: VlmDepth;
  accessMode?: VlmEntitlementAccessMode | string | null;
  paidAccessVerified?: boolean;
}): VlmAuditFindingSchemaPack {
  const locale = args.locale ?? "pl";
  const requestedDepth = args.requestedDepth ?? "pro";
  const entitlement = buildVlmEntitlementFirewallDecision({
    locale,
    surface: "audit",
    requestedDepth,
    accessMode: args.accessMode,
    paidAccessVerified: args.paidAccessVerified,
  });
  const normalized = args.findings.slice(0, entitlement.advancedUnlocked ? 24 : entitlement.allowedDepth === "pro" ? 12 : 6).map((finding, index) => normalizeVlmAuditFinding(finding, index));
  const publicFindings = entitlement.advancedUnlocked ? normalized : normalized.map((finding) => ({
    ...finding,
    evidenceRows: finding.evidenceRows
      .filter((row) => row.publicSafe)
      .slice(0, entitlement.allowedDepth === "pro" ? 4 : 2)
      .map((row) => row.status === "operator_only" ? { ...row, claim: "Operator-only evidence redacted in free view.", status: "partial" as const, source: "redacted" } : row),
    operatorNotes: [],
  }));
  const counts = publicFindings.reduce((acc, finding) => {
    acc[finding.severity] += 1;
    if (finding.status === "missing_proof") acc.missingProof += 1;
    if (finding.falsePositiveRisk !== "low") acc.falsePositiveRisk += 1;
    return acc;
  }, { critical: 0, high: 0, medium: 0, low: 0, info: 0, missingProof: 0, falsePositiveRisk: 0 });
  const reportAllowed = counts.critical === 0 && counts.missingProof === 0 && publicFindings.every((finding) => finding.confidence >= 50);
  return {
    schemaVersion: PASS2186_VLM_AUDIT_FINDING_SCHEMA_ID,
    locale,
    requestedDepth,
    allowedDepth: entitlement.allowedDepth,
    advancedUnlocked: entitlement.advancedUnlocked,
    audience: entitlement.advancedUnlocked ? "operator_advanced" : entitlement.allowedDepth === "pro" ? "customer_report" : "public_preview",
    findings: publicFindings,
    summary: {
      total: publicFindings.length,
      critical: counts.critical,
      high: counts.high,
      medium: counts.medium,
      low: counts.low,
      info: counts.info,
      missingProof: counts.missingProof,
      falsePositiveRisk: counts.falsePositiveRisk,
      reportAllowed,
      customerSafeBoundary: localizedBoundary(locale, entitlement.advancedUnlocked),
    },
    rubric: {
      severityRule: "Critical/High block launch when payment, entitlement, secrets, audit integrity or customer trust can be materially harmed.",
      confidenceRule: "Confirmed requires high confidence plus verified evidence; missing or contradictory proof lowers confidence and blocks final claims.",
      evidenceRule: "Every finding must attach evidence rows; free views receive only public-safe rows, while operator-only rows stay behind Advanced entitlement.",
      paidBoundaryRule: "Full evidence ledger, operator appendix and proof capsule remain Advanced-only and server-gated.",
    },
  };
}

export function vlmAuditFindingsToKernelFindings(findings: VlmAuditFinding[]): VlmBrainKernelFinding[] {
  return findings.map((finding) => ({
    id: `audit.structured.${finding.id}`,
    title: `[${finding.severity.toUpperCase()}] ${finding.title}`,
    body: `${finding.customerSafeSummary} Impact: ${finding.businessImpact} Fix: ${finding.remediation.recommendation}`.slice(0, 900),
    severity: auditSeverityToKernelSeverity(finding.severity),
    confidence: finding.confidence,
    evidenceIds: finding.evidenceRows.map((row) => row.id),
  }));
}
