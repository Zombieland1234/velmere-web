/**
 * Velmère Proven Fact & Evidence Ledger Architecture (V2 Directive Sections 4, 5, 6, 7, 83)
 * Implements deterministic RFC 8785 canonical hashing and strict evidence tracking.
 */

import crypto from "crypto";
import { ProvenFact, FactStatus, AssetClass, CanonicalAssetIdentity } from "./engines/types";

/**
 * Deterministic JSON serialization following RFC 8785 principles.
 * Lexicographically sorts all object keys recursively.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalJson).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJson((obj as Record<string, unknown>)[key])}`
  );
  return `{${entries.join(",")}}`;
}

export function sha256Digest(content: string | Buffer): string {
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  return `sha256:${hash}`;
}

export function createProvenFact(params: {
  runId: string;
  asset: CanonicalAssetIdentity;
  blockNumber?: number | null;
  analyzerId: string;
  analyzerVersion: string;
  sourceType: ProvenFact["sourceType"];
  sourceReference: string;
  claimKey: string;
  claimValue: unknown;
  status: FactStatus;
  retrievedAt?: string;
}): ProvenFact {
  const retrievedAt = params.retrievedAt || new Date().toISOString();
  const evidenceDigest = sha256Digest(
    canonicalJson({
      claimKey: params.claimKey,
      claimValue: params.claimValue,
      sourceType: params.sourceType,
      sourceReference: params.sourceReference,
    })
  );

  const factId = crypto
    .createHash("sha256")
    .update(`${params.runId}:${params.asset.canonicalId}:${params.claimKey}:${evidenceDigest}`)
    .digest("hex")
    .slice(0, 24);

  const provenanceDigest = sha256Digest(
    canonicalJson({
      factId,
      runId: params.runId,
      assetId: params.asset.canonicalId,
      analyzerId: params.analyzerId,
      analyzerVersion: params.analyzerVersion,
      evidenceDigest,
      retrievedAt,
    })
  );

  return {
    factId,
    runId: params.runId,
    assetId: params.asset.canonicalId,
    assetClass: params.asset.assetClass,
    chainId: params.asset.chainId,
    blockNumber: params.blockNumber ?? null,
    retrievedAt,
    analyzerId: params.analyzerId,
    analyzerVersion: params.analyzerVersion,
    sourceType: params.sourceType,
    sourceReference: params.sourceReference,
    claimKey: params.claimKey,
    claimValue: params.claimValue,
    status: params.status,
    evidenceDigest,
    provenanceDigest,
  };
}

export interface ProvenFactLedger {
  runId: string;
  asset: CanonicalAssetIdentity;
  facts: ProvenFact[];
  ledgerDigest: string;
}

export function buildFactLedger(runId: string, asset: CanonicalAssetIdentity, facts: ProvenFact[]): ProvenFactLedger {
  // Sort facts by claimKey deterministically
  const sortedFacts = [...facts].sort((a, b) => a.claimKey.localeCompare(b.claimKey));
  const ledgerDigest = sha256Digest(canonicalJson(sortedFacts));

  return {
    runId,
    asset,
    facts: sortedFacts,
    ledgerDigest,
  };
}
