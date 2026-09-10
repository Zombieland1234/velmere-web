/**
 * VELMÈRE ULTIMATE EVIDENCE-FIRST AUDIT PLATFORM
 * MASTER EVIDENCE RECORD SPECIFICATION (Directive v3)
 * ZERO-BULLSHIT / ZERO-FABRICATION / REPRODUCIBLE / ADVERSARIAL / INSTITUTIONAL
 * 
 * CORE RULES:
 * NO EVIDENCE = NO CLAIM
 * NO TEST = NO PASS
 * NO SOLVER = NO FORMALLY PROVEN
 * NO TSA TOKEN = NO RFC 3161
 * NO HUMAN REVIEW = NO HUMAN REVIEWED
 * NO SOURCE = NO SOURCE VERIFIED
 * NO OBSERVED MARKET DATA = NO OBSERVED MARKET RESULT
 * NO COMMIT = NO SOURCE-REVISION CLAIM
 * NO DATASET = NO MARKET-PROVENANCE CLAIM
 */

import crypto from "crypto";

export type EvidenceCategory =
  | "SOURCE"
  | "BYTECODE"
  | "ABI"
  | "STATIC_ANALYSIS"
  | "AST"
  | "CALL_GRAPH"
  | "CFG"
  | "ACCESS_CONTROL"
  | "UPGRADEABILITY"
  | "DYNAMIC_TEST"
  | "FUZZING"
  | "STATEFUL_FUZZING"
  | "INVARIANT"
  | "FORMAL"
  | "POC"
  | "MARKET_DATA"
  | "MARKET_MICROSTRUCTURE"
  | "REGULATORY_DATA"
  | "REMEDIATION"
  | "HUMAN_REVIEW"
  | "CRYPTOGRAPHIC"
  | "SYSTEM";

export type EvidenceStatus =
  | "PASS"
  | "FAIL"
  | "WARN"
  | "UNKNOWN"
  | "NOT_RUN"
  | "NOT_VERIFIED"
  | "NOT_APPLICABLE"
  | "INSUFFICIENT_EVIDENCE"
  | "SKIPPED"
  | "TIMEOUT"
  | "ERROR";

export type EvidenceMethod =
  | "OBSERVED"
  | "CALCULATED"
  | "ESTIMATED"
  | "SIMULATED"
  | "SYNTHETIC"
  | "FORMALLY_PROVEN"
  | "HUMAN_VERIFIED"
  | "AUTOMATED_EXECUTION";

export interface EvidenceRecord {
  id: string; // e.g., EV-SOURCE-0001
  auditId: string;
  category: EvidenceCategory;
  status: EvidenceStatus;
  method: EvidenceMethod;
  source: string; // e.g. "Etherscan API", "Live RPC node", "SEC EDGAR", "Foundry runner"
  tool: string; // e.g. "solc", "slither", "aderyn", "z3", "velmere-l3-engine"
  toolVersion?: string;
  timestamp: string; // ISO 8601
  inputHash: string; // SHA-256 of raw input
  outputHash: string; // SHA-256 of normalized output
  rawArtifact?: string; // verbatim output or serialized JSON
  normalizedArtifact?: Record<string, unknown>;
  
  // Smart Contract Provenance
  chain?: string;
  chainId?: number;
  blockNumber?: number;
  contractAddress?: string;
  repositoryUrl?: string;
  branch?: string;
  commitHash?: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  command?: string;
  environment?: string;

  // Market & Regulatory Provenance
  provider?: string;
  dataset?: string;
  observedAt?: string;
  retrievedAt?: string;
  dataFreshness?: "FRESH" | "STALE" | "EXPIRED";

  // Human Review
  reviewerId?: string;
  reviewStatus?: "QUEUED" | "UNDER_REVIEW" | "CONFIRMED" | "REJECTED" | "MODIFIED";
  reviewNotes?: string;
}

export type ClaimType =
  | "ARCHITECTURAL"
  | "SECURITY_INVARIANT"
  | "VULNERABILITY"
  | "ACCESS_CONTROL"
  | "UPGRADEABILITY"
  | "FORMAL_PROOF"
  | "MARKET_LIQUIDITY"
  | "REGULATORY_COMPLIANCE"
  | "CRYPTOGRAPHIC_SEAL"
  | "HUMAN_ATTESTATION";

export interface ClaimRecord {
  claimId: string; // e.g. CLM-SEC-001
  claimText: string;
  claimType: ClaimType;
  evidenceIds: string[];
  confidence: number; // 0 to 100
  status: EvidenceStatus;
  source: string;
  calculation?: string;
  timestamp: string;
}

export function computeSha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function computeNormalizedSha256(data: unknown): string {
  const jsonStr = typeof data === "string" ? data : JSON.stringify(data, Object.keys(data as object || {}).sort());
  return computeSha256(jsonStr);
}

export function createEvidenceRecord(params: Omit<EvidenceRecord, "inputHash" | "outputHash"> & {
  inputData?: string | Buffer | unknown;
  outputData?: string | Buffer | unknown;
}): EvidenceRecord {
  const inputHash = params.inputData
    ? typeof params.inputData === "string" || Buffer.isBuffer(params.inputData)
      ? computeSha256(params.inputData)
      : computeNormalizedSha256(params.inputData)
    : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // empty hash

  const outputHash = params.outputData
    ? typeof params.outputData === "string" || Buffer.isBuffer(params.outputData)
      ? computeSha256(params.outputData)
      : computeNormalizedSha256(params.outputData)
    : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  return {
    ...params,
    inputHash,
    outputHash,
  };
}
