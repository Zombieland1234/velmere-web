/**
 * VELMÈRE WORLD-CLASS EVIDENCE INTELLIGENCE
 * Claim and Evidence Authoritative Model
 * 
 * CORE PRINCIPLE:
 * NO EVIDENCE -> NO FACT
 * NO VERIFIED PROVENANCE -> NO VERIFIED CLAIM
 */

import crypto from "crypto";

export type CanonicalAssetClassV2 =
  | "EVM_CONTRACT"
  | "NATIVE_BLOCKCHAIN"
  | "TRADITIONAL_EQUITY"
  | "ETF"
  | "COMMODITY_FUTURE"
  | "FX"
  | "OTHER_TRADITIONAL"
  | "SIMULATED_FIXTURE";

export type ClaimClassification =
  | "A" // Directly evidenced
  | "B" // Derived deterministically from evidenced data
  | "C" // Heuristic / inference (must state HEURISTIC / INFERENCE)
  | "D" // Unverified
  | "E" // Contradictory / impossible (must become defect)
  | "F"; // Fixture / simulation only (must state SIMULATED_FIXTURE)

export type EvidenceSourceType =
  | "onchain_rpc"
  | "block_explorer_api"
  | "verified_solidity_source"
  | "market_exchange_feed"
  | "node_p2p"
  | "simulated_fixture";

export interface EvidenceObject {
  evidence_id: string; // e.g., EVD-EVM-000001
  claim_id: string;
  asset_id: string;
  asset_class: CanonicalAssetClassV2;
  chain_or_market: string;
  source_type: EvidenceSourceType;
  source_uri: string;
  source_provider: string;
  retrieved_at: string;
  snapshot_id: string;
  block_number: number | null;
  transaction_hash: string | null;
  contract_address: string | null;
  symbol: string | null;
  raw_input_hash: string;
  normalized_input_hash: string;
  analysis_version: string;
  ruleset_version: string;
  result_hash: string;
  status: "verified" | "derived" | "heuristic" | "unverified" | "fixture";
  reproducible: boolean;
  notes: string;
}

export interface ClaimObject {
  claim_id: string; // e.g., CLM-EVM-000001
  asset_id: string;
  subject: string;
  statement: string;
  classification: ClaimClassification;
  status: "verified" | "derived" | "heuristic" | "unverified" | "fixture";
  evidence_ids: string[];
  confidence: number; // 0 to 100
  created_at: string;
}

export function computeSha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function computeNormalizedSha256(data: Record<string, unknown>): string {
  const jsonStr = JSON.stringify(data, Object.keys(data).sort());
  return computeSha256(jsonStr);
}

export function generateEvidenceId(prefix: string, index: number): string {
  return `EVD-${prefix.toUpperCase()}-${String(index).padStart(6, "0")}`;
}

export function generateClaimId(prefix: string, index: number): string {
  return `CLM-${prefix.toUpperCase()}-${String(index).padStart(6, "0")}`;
}

/**
 * Validates that a claim meets strict truth requirements.
 * Returns true if valid, throws an error if unproven claim is labeled VERIFIED.
 */
export function validateClaimIntegrity(claim: ClaimObject, evidenceMap: Map<string, EvidenceObject>): {
  isValid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Rule 1: Only A and B may be called VERIFIED
  if (claim.status === "verified" && claim.classification !== "A" && claim.classification !== "B") {
    violations.push(`Violation: Claim ${claim.claim_id} is marked 'verified' but has classification ${claim.classification}. Only A and B may be verified.`);
  }

  // Rule 2: Must have at least one valid evidence reference if verified or derived
  if ((claim.status === "verified" || claim.status === "derived") && claim.evidence_ids.length === 0) {
    violations.push(`Violation: Claim ${claim.claim_id} is marked ${claim.status} but has zero evidence IDs.`);
  }

  // Rule 3: Evidence IDs must exist in evidenceMap
  for (const evId of claim.evidence_ids) {
    if (!evidenceMap.has(evId)) {
      violations.push(`Violation: Claim ${claim.claim_id} references nonexistent evidence ID ${evId}.`);
    }
  }

  // Rule 4: Fixture classification F must not be labeled verified
  if (claim.classification === "F" && claim.status === "verified") {
    violations.push(`Violation: Fixture claim ${claim.claim_id} cannot be labeled 'verified'. Must be 'fixture'.`);
  }

  // Rule 5: Heuristic C must not be labeled verified
  if (claim.classification === "C" && claim.status === "verified") {
    violations.push(`Violation: Heuristic claim ${claim.claim_id} cannot be labeled 'verified'. Must be 'heuristic'.`);
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}
