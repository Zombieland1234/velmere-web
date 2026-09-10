/**
 * Velmère Audit Engineering Architecture V2
 * Canonical Types for Asset-Class Engines, Proven Facts, and Audit Run Identity
 */

export type AssetClass = "evm_contract" | "native_chain" | "market_asset";

export type NetworkType = "evm" | "utxo" | "traditional_market";

export type AuditTier = "basic" | "pro" | "advanced";

export type FactStatus =
  | "VERIFIED"
  | "UNVERIFIED"
  | "NOT_APPLICABLE"
  | "UNAVAILABLE"
  | "SIMULATED"
  | "FLAGGED";

export interface CanonicalAssetIdentity {
  canonicalId: string; // e.g. "bsc:evm:0x8076c74c5e3f5852037f31ff0093eeb8c8add8d3", "bitcoin:native:btc", "nasdaq:equity:AAPL"
  assetClass: AssetClass;
  networkType: NetworkType;
  chainId: string | null;
  networkName: string;
  symbol: string;
  displayName: string;
  primaryIdentifier: string; // address, native coin symbol, or ticker
}

export interface ProvenFact {
  factId: string;
  runId: string;
  assetId: string;
  assetClass: AssetClass;
  chainId: string | null;
  blockNumber: number | null;
  retrievedAt: string;
  analyzerId: string;
  analyzerVersion: string;
  sourceType: "ON_CHAIN_BYTECODE" | "ON_CHAIN_RPC" | "DEPOSIT_REGISTRY" | "DISCLOSURE_FILING" | "STATIC_ANALYSIS" | "CONSENSUS_SPEC";
  sourceReference: string;
  claimKey: string;
  claimValue: unknown;
  status: FactStatus;
  evidenceDigest: string;
  provenanceDigest: string;
}

export interface EngineSectionPlan {
  id: string;
  title: string;
  subtitle: string;
  requiredTier: AuditTier;
  sampleSummaryLines: string[]; // MODE B Procedural Teasers (MUST contain NO numbers, NO contract-specific facts, NO addresses, NO synthetic protocol names)
  keyValuePairs?: Array<{ label: string; value: string }>;
  metrics?: Array<{
    label: string;
    value: string;
    status: "verified" | "flagged" | "missing" | "neutral";
    claimId?: string;
    evidenceId?: string;
  }>;
  paragraphs?: string[];
  findings?: Array<{
    id: string;
    swcId?: string;
    cweId?: string;
    severity: "critical" | "high" | "medium" | "low" | "informational";
    category: string;
    title: string;
    description: string;
    evidence: string;
    attackScenario?: string;
    proofOfConcept?: string;
    recommendation: string;
    remediationDiff?: string;
    requiredTier?: AuditTier;
    remediationState?: "recommended" | "applied" | "mitigated" | "open" | "verified" | "unresolved";
    claimId?: string;
    evidenceId?: string;
  }>;
}

import type { ContractAuditProfile } from "../contract-audit-profiles";

export type HumanAttestationPayload = {
  reviewer?: string;
  reviewedBy?: string;
  reviewDate?: string;
  status: "verified_evidence";
  signedHash: string;
} | null;

export interface SecurityAuditEngine {
  readonly assetClass: AssetClass;
  readonly engineVersion: string;
  matches(asset: CanonicalAssetIdentity): boolean;
  generateSections(params: {
    asset: CanonicalAssetIdentity;
    locale: "en" | "pl" | "de";
    rawBytecode?: string;
    profileOverride?: Partial<ContractAuditProfile> | null;
    humanAttestation?: HumanAttestationPayload;
  }): EngineSectionPlan[];
}

