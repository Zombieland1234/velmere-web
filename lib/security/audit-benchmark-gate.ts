import { createHash } from "node:crypto";

export type Pass4656AuditSeverity = "critical" | "high" | "medium" | "low";

export type Pass4656AuditFinding = {
  category: string;
  severity: Pass4656AuditSeverity;
  evidenceBound: boolean;
};

export type Pass4656AuditBenchmarkCase = {
  id: string;
  kind: "vulnerable" | "control";
  sourceSnapshotAt: string;
  publicDisclosureAt: string;
  expectedFindings: Pass4656AuditFinding[];
  detectedFindings: Pass4656AuditFinding[];
};

export type Pass4656AuditBenchmarkThresholds = {
  minimumCases: number;
  minimumVulnerableCases: number;
  minimumControlCases: number;
  minimumCategoryCoverage: number;
  minimumOverallRecall: number;
  minimumCriticalRecall: number;
  minimumHighRecall: number;
  minimumPrecision: number;
  maximumControlFalsePositiveRate: number;
  minimumEvidenceBindingRate: number;
};

export const PASS4656_WORLDCLASS_AUDIT_THRESHOLDS: Pass4656AuditBenchmarkThresholds = {
  minimumCases: 100,
  minimumVulnerableCases: 35,
  minimumControlCases: 35,
  minimumCategoryCoverage: 10,
  minimumOverallRecall: 0.85,
  minimumCriticalRecall: 0.95,
  minimumHighRecall: 0.9,
  minimumPrecision: 0.85,
  maximumControlFalsePositiveRate: 0.08,
  minimumEvidenceBindingRate: 1,
};

function normalizedCategory(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function key(finding: Pass4656AuditFinding) {
  return `${normalizedCategory(finding.category)}:${finding.severity}`;
}

function finiteDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((field) => `${JSON.stringify(field)}:${stableSerialize(object[field])}`).join(",")}}`;
}

export function evaluatePass4656AuditBenchmark(
  cases: Pass4656AuditBenchmarkCase[],
  thresholds: Pass4656AuditBenchmarkThresholds = PASS4656_WORLDCLASS_AUDIT_THRESHOLDS,
) {
  const seen = new Set<string>();
  const blockers: string[] = [];
  const validCases = cases.filter((item, index) => {
    const snapshotAt = finiteDate(item.sourceSnapshotAt);
    const disclosureAt = finiteDate(item.publicDisclosureAt);
    const rowBlockers = [
      !item.id.trim() ? "id_missing" : null,
      seen.has(item.id) ? "duplicate_id" : null,
      snapshotAt === null ? "snapshot_timestamp_invalid" : null,
      disclosureAt === null ? "disclosure_timestamp_invalid" : null,
      snapshotAt !== null && disclosureAt !== null && snapshotAt > disclosureAt ? "post_disclosure_leakage" : null,
      item.kind === "vulnerable" && item.expectedFindings.length === 0 ? "expected_findings_missing" : null,
      item.kind === "control" && item.expectedFindings.length > 0 ? "control_has_expected_vulnerability" : null,
    ].filter((value): value is string => Boolean(value));
    if (rowBlockers.length) {
      blockers.push(...rowBlockers.map((value) => `case_${index}:${value}`));
      return false;
    }
    seen.add(item.id);
    return true;
  });

  const vulnerableCases = validCases.filter((item) => item.kind === "vulnerable");
  const controlCases = validCases.filter((item) => item.kind === "control");
  const expected = validCases.flatMap((item) => item.expectedFindings.map((finding) => ({ caseId: item.id, finding })));
  const detected = validCases.flatMap((item) => item.detectedFindings.map((finding) => ({ caseId: item.id, kind: item.kind, finding })));
  const expectedKeys = new Set(expected.map((item) => `${item.caseId}:${key(item.finding)}`));
  const matched = detected.filter((item) => expectedKeys.has(`${item.caseId}:${key(item.finding)}`));
  const truePositiveKeys = new Set(matched.map((item) => `${item.caseId}:${key(item.finding)}`));
  const falsePositive = detected.filter((item) => !expectedKeys.has(`${item.caseId}:${key(item.finding)}`));
  const expectedBySeverity = (severity: Pass4656AuditSeverity) => expected.filter((item) => item.finding.severity === severity);
  const matchedBySeverity = (severity: Pass4656AuditSeverity) => expectedBySeverity(severity).filter((item) => truePositiveKeys.has(`${item.caseId}:${key(item.finding)}`));
  const controlFalsePositiveCases = controlCases.filter((item) => item.detectedFindings.length > 0).length;
  const evidenceBoundMatched = matched.filter((item) => item.finding.evidenceBound).length;
  const categories = [...new Set(expected.map((item) => normalizedCategory(item.finding.category)).filter(Boolean))].sort();

  const overallRecall = ratio(truePositiveKeys.size, expectedKeys.size);
  const criticalRecall = ratio(matchedBySeverity("critical").length, expectedBySeverity("critical").length);
  const highRecall = ratio(matchedBySeverity("high").length, expectedBySeverity("high").length);
  const precision = ratio(matched.length, detected.length);
  const controlFalsePositiveRate = ratio(controlFalsePositiveCases, controlCases.length);
  const evidenceBindingRate = ratio(evidenceBoundMatched, matched.length);

  blockers.push(...[
    validCases.length < thresholds.minimumCases ? `case_count:${validCases.length}/${thresholds.minimumCases}` : null,
    vulnerableCases.length < thresholds.minimumVulnerableCases ? `vulnerable_cases:${vulnerableCases.length}/${thresholds.minimumVulnerableCases}` : null,
    controlCases.length < thresholds.minimumControlCases ? `control_cases:${controlCases.length}/${thresholds.minimumControlCases}` : null,
    categories.length < thresholds.minimumCategoryCoverage ? `category_coverage:${categories.length}/${thresholds.minimumCategoryCoverage}` : null,
    overallRecall < thresholds.minimumOverallRecall ? `overall_recall:${overallRecall.toFixed(3)}/${thresholds.minimumOverallRecall}` : null,
    criticalRecall < thresholds.minimumCriticalRecall ? `critical_recall:${criticalRecall.toFixed(3)}/${thresholds.minimumCriticalRecall}` : null,
    highRecall < thresholds.minimumHighRecall ? `high_recall:${highRecall.toFixed(3)}/${thresholds.minimumHighRecall}` : null,
    precision < thresholds.minimumPrecision ? `precision:${precision.toFixed(3)}/${thresholds.minimumPrecision}` : null,
    controlFalsePositiveRate > thresholds.maximumControlFalsePositiveRate ? `control_false_positive_rate:${controlFalsePositiveRate.toFixed(3)}/${thresholds.maximumControlFalsePositiveRate}` : null,
    evidenceBindingRate < thresholds.minimumEvidenceBindingRate ? `evidence_binding_rate:${evidenceBindingRate.toFixed(3)}/${thresholds.minimumEvidenceBindingRate}` : null,
  ].filter((value): value is string => Boolean(value)));

  const canonical = validCases.map((item) => ({
    ...item,
    expectedFindings: [...item.expectedFindings].sort((a, b) => key(a).localeCompare(key(b))),
    detectedFindings: [...item.detectedFindings].sort((a, b) => key(a).localeCompare(key(b))),
  })).sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: "pass4656_audit_benchmark_gate_v1" as const,
    worldClassAuditReady: blockers.length === 0,
    caseCount: validCases.length,
    invalidCaseCount: cases.length - validCases.length,
    vulnerableCaseCount: vulnerableCases.length,
    controlCaseCount: controlCases.length,
    expectedFindingCount: expected.length,
    detectedFindingCount: detected.length,
    matchedFindingCount: matched.length,
    falsePositiveFindingCount: falsePositive.length,
    categoryCoverage: categories,
    overallRecall,
    criticalRecall,
    highRecall,
    precision,
    controlFalsePositiveRate,
    evidenceBindingRate,
    fingerprint: createHash("sha256").update(stableSerialize(canonical)).digest("hex"),
    blockers: [...new Set(blockers)].sort(),
    boundary: "A smart-contract audit claim is release-ready only after pre-disclosure benchmark cases prove severity recall, precision, control false-positive limits and evidence-bound findings.",
  };
}
