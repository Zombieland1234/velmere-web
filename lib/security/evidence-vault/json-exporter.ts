/**
 * VELMÈRE ULTIMATE EVIDENCE-FIRST AUDIT PLATFORM
 * CANONICAL MACHINE-READABLE JSON EXPORT SUITE (Directive v3 Section 48)
 * 
 * Generates:
 * - report.json
 * - findings.json
 * - evidence.json
 * - manifest.json
 */

import type { EvidenceRecord } from "../evidence/evidence-record.ts";
import type { FindingRecord } from "../analyzer/contract-analyzer.ts";
import type { ScoreBreakdown } from "../scoring/two-dimensional-scorer.ts";
import type { ReproducibilityManifest } from "./evidence-vault.ts";

export interface CanonicalJsonSuite {
  reportJson: Record<string, unknown>;
  findingsJson: Record<string, unknown>;
  evidenceJson: Record<string, unknown>;
  manifestJson: ReproducibilityManifest;
}

export class JsonExporter {
  public static exportSuite(params: {
    auditId: string;
    target: {
      symbol: string;
      name: string;
      tier: "basic" | "pro" | "advanced";
      addressOrId: string;
      networkOrExchange: string;
    };
    scoring: ScoreBreakdown;
    findings: FindingRecord[];
    evidenceRecords: EvidenceRecord[];
    manifest: ReproducibilityManifest;
  }): CanonicalJsonSuite {
    const reportJson = {
      schemaVersion: "velmere.v3.audit-report",
      auditId: params.auditId,
      generatedAt: new Date().toISOString(),
      engineVersion: "3.0.0-institutional",
      target: params.target,
      scoring: params.scoring,
      findingsSummary: {
        total: params.findings.length,
        critical: params.findings.filter((f) => f.severity === "CRITICAL").length,
        high: params.findings.filter((f) => f.severity === "HIGH").length,
        medium: params.findings.filter((f) => f.severity === "MEDIUM").length,
        low: params.findings.filter((f) => f.severity === "LOW").length,
      },
      evidenceSummary: {
        totalEvidenceRecords: params.evidenceRecords.length,
        evidenceRoot: params.manifest.evidenceRoot,
        sealType: params.manifest.timestamping.sealType,
      },
    };

    const findingsJson = {
      schemaVersion: "velmere.v3.findings-registry",
      auditId: params.auditId,
      findingsCount: params.findings.length,
      findings: params.findings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        confidence: f.confidence,
        detector: f.detector,
        category: f.category,
        location: {
          file: f.file,
          lineStart: f.lineStart,
          lineEnd: f.lineEnd,
        },
        codeSnippet: f.codeSnippet,
        description: f.description,
        attackScenario: f.attackScenario,
        recommendation: f.recommendation,
        backingEvidenceIds: f.evidenceIds,
      })),
    };

    const evidenceJson = {
      schemaVersion: "velmere.v3.evidence-records",
      auditId: params.auditId,
      evidenceRoot: params.manifest.evidenceRoot,
      recordsCount: params.evidenceRecords.length,
      records: params.evidenceRecords,
    };

    return {
      reportJson,
      findingsJson,
      evidenceJson,
      manifestJson: params.manifest,
    };
  }
}
