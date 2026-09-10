/**
 * Traceable Evidence & Source-to-Report Lineage Engine
 *
 * Implements Sections 13 and 14 of the Master Release Directive:
 * - Every finding is immutably anchored to an evidence record.
 * - Provides bidirectional source-to-report traceability:
 *   Raw Input / Source Provider -> Evidence Node -> Check / Finding -> Report Statement / PDF Section.
 * - Unanchored findings are marked UNVERIFIED.
 */

import { sha256Digest } from "./cryptographic-digest";

export type AcquisitionStatus =
  | "FRESH"
  | "CACHED"
  | "REPLAYED"
  | "STALE"
  | "FAILED";

export interface EvidenceRecord {
  evidenceId: string;
  assetId: string;
  checkId: string;
  sourceProvider: string;
  sourceUri?: string;
  rawPayloadSha256: string;
  acquiredAt: string;
  acquisitionStatus: AcquisitionStatus;
  freshnessAgeSeconds: number;
  analyzerVersion: string;
  confidenceScore: number;
  confidenceBasis: string;
  limitations: string[];
}

export interface TraceableFinding {
  findingId: string;
  assetId: string;
  checkId: string;
  evidenceId: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  description: string;
  status: "VERIFIED" | "UNVERIFIED" | "NOT_APPLICABLE";
  evidence: EvidenceRecord;
  pdfStatementReference?: string;
}

export interface SourceToReportLineageNode {
  statement: string;
  findingId: string;
  evidenceId: string;
  sourceProvider: string;
  rawPayloadHash: string;
  freshnessAgeSeconds: number;
  limitations: string[];
}

export class TraceableEvidenceLedger {
  private evidenceStore: Map<string, EvidenceRecord> = new Map();
  private findingStore: Map<string, TraceableFinding> = new Map();

  /**
   * Registers a verified evidence record into the ledger.
   */
  public registerEvidence(args: {
    assetId: string;
    checkId: string;
    sourceProvider: string;
    sourceUri?: string;
    rawPayload: string | Uint8Array;
    acquiredAt?: string;
    acquisitionStatus?: AcquisitionStatus;
    freshnessAgeSeconds?: number;
    analyzerVersion?: string;
    confidenceScore?: number;
    confidenceBasis?: string;
    limitations?: string[];
  }): EvidenceRecord {
    const rawPayloadSha256 =
      typeof args.rawPayload === "string"
        ? sha256Digest(args.rawPayload)
        : sha256Digest(Buffer.from(args.rawPayload).toString("hex"));

    const evidenceId = `evd_${args.assetId.slice(0, 10)}_${args.checkId}_${rawPayloadSha256.slice(0, 8)}`;
    const acquiredAt = args.acquiredAt ?? new Date().toISOString();
    const freshnessAgeSeconds = args.freshnessAgeSeconds ?? 0;
    const acquisitionStatus = args.acquisitionStatus ?? "FRESH";
    const analyzerVersion = args.analyzerVersion ?? "velmere.engine.v2.4";
    const confidenceScore = Math.max(0, Math.min(100, args.confidenceScore ?? 85));
    const confidenceBasis = args.confidenceBasis ?? "Direct bytecode disassembly and AST pattern matching";
    const limitations = args.limitations ?? [
      "Cannot detect off-chain oracle collusion or economic multi-block MEV exploits",
      "Analysis is bounded by decompilation heuristic accuracy",
    ];

    const record: EvidenceRecord = {
      evidenceId,
      assetId: args.assetId,
      checkId: args.checkId,
      sourceProvider: args.sourceProvider,
      sourceUri: args.sourceUri,
      rawPayloadSha256,
      acquiredAt,
      acquisitionStatus,
      freshnessAgeSeconds,
      analyzerVersion,
      confidenceScore,
      confidenceBasis,
      limitations,
    };

    this.evidenceStore.set(evidenceId, record);
    return record;
  }

  /**
   * Attaches a finding to an evidence record.
   * If evidence is missing, the finding is marked UNVERIFIED.
   */
  public registerFinding(args: {
    findingId: string;
    assetId: string;
    checkId: string;
    evidenceId?: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low" | "informational";
    description: string;
    pdfStatementReference?: string;
  }): TraceableFinding {
    const evidence = args.evidenceId ? this.evidenceStore.get(args.evidenceId) : undefined;
    const isVerified = Boolean(evidence && evidence.acquisitionStatus !== "FAILED");

    const finding: TraceableFinding = {
      findingId: args.findingId,
      assetId: args.assetId,
      checkId: args.checkId,
      evidenceId: evidence ? evidence.evidenceId : "NONE_UNVERIFIED",
      title: args.title,
      severity: args.severity,
      description: args.description,
      status: isVerified ? "VERIFIED" : "UNVERIFIED",
      evidence: evidence ?? {
        evidenceId: "MISSING_EVIDENCE",
        assetId: args.assetId,
        checkId: args.checkId,
        sourceProvider: "UNVERIFIED_SOURCE",
        rawPayloadSha256: "0".repeat(64),
        acquiredAt: new Date().toISOString(),
        acquisitionStatus: "FAILED",
        freshnessAgeSeconds: -1,
        analyzerVersion: "UNKNOWN",
        confidenceScore: 0,
        confidenceBasis: "No evidence submitted",
        limitations: ["Unverified claim without backing evidence"],
      },
      pdfStatementReference: args.pdfStatementReference,
    };

    this.findingStore.set(args.findingId, finding);
    return finding;
  }

  /**
   * Resolves full source-to-report lineage for a given statement or finding ID.
   */
  public traceStatementLineage(findingId: string): SourceToReportLineageNode | null {
    const finding = this.findingStore.get(findingId);
    if (!finding) return null;

    return {
      statement: finding.description,
      findingId: finding.findingId,
      evidenceId: finding.evidence.evidenceId,
      sourceProvider: finding.evidence.sourceProvider,
      rawPayloadHash: finding.evidence.rawPayloadSha256,
      freshnessAgeSeconds: finding.evidence.freshnessAgeSeconds,
      limitations: finding.evidence.limitations,
    };
  }
}

export const globalEvidenceLedger = new TraceableEvidenceLedger();
