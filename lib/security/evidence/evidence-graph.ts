/**
 * VELMÈRE EVIDENCE GRAPH ENGINE
 * Enforces end-to-end provenance:
 * Asset -> Snapshot -> Source -> Observation -> Analysis -> Finding -> ScoreContribution -> Recommendation
 */

import {
  type ClaimObject,
  type EvidenceObject,
  validateClaimIntegrity,
} from "./claim-evidence-model";

export interface GraphNode {
  id: string;
  type: "Asset" | "Snapshot" | "Source" | "Observation" | "Analysis" | "Finding" | "ScoreContribution" | "Recommendation" | "Claim" | "Evidence";
  label: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface GraphEdge {
  fromId: string;
  toId: string;
  relation: "HAS_SNAPSHOT" | "FROM_SOURCE" | "OBSERVED_IN" | "ANALYZED_BY" | "EMITTED_FINDING" | "CONTRIBUTED_SCORE" | "GENERATED_RECOMMENDATION" | "BACKED_BY_EVIDENCE" | "CLAIMS";
}

export class VelmereEvidenceGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private claims: Map<string, ClaimObject> = new Map();
  private evidences: Map<string, EvidenceObject> = new Map();

  public addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  public addEdge(edge: GraphEdge): void {
    if (!this.nodes.has(edge.fromId)) {
      throw new Error(`Cannot add edge: source node ${edge.fromId} does not exist in graph.`);
    }
    if (!this.nodes.has(edge.toId)) {
      throw new Error(`Cannot add edge: target node ${edge.toId} does not exist in graph.`);
    }
    this.edges.push(edge);
  }

  public registerEvidence(evidence: EvidenceObject): void {
    this.evidences.set(evidence.evidence_id, evidence);
    this.addNode({
      id: evidence.evidence_id,
      type: "Evidence",
      label: `Evidence [${evidence.source_type}] ${evidence.evidence_id}`,
      metadata: { ...evidence },
      createdAt: evidence.retrieved_at,
    });
  }

  public registerClaim(claim: ClaimObject): void {
    this.claims.set(claim.claim_id, claim);
    this.addNode({
      id: claim.claim_id,
      type: "Claim",
      label: `Claim [${claim.classification}] ${claim.statement.slice(0, 50)}...`,
      metadata: { ...claim },
      createdAt: claim.created_at,
    });

    for (const evId of claim.evidence_ids) {
      if (this.nodes.has(evId)) {
        this.addEdge({
          fromId: claim.claim_id,
          toId: evId,
          relation: "BACKED_BY_EVIDENCE",
        });
      }
    }
  }

  public getClaimsForAsset(assetId: string): ClaimObject[] {
    return Array.from(this.claims.values()).filter((c) => c.asset_id === assetId);
  }

  public getEvidenceForClaim(claimId: string): EvidenceObject[] {
    const claim = this.claims.get(claimId);
    if (!claim) return [];
    return claim.evidence_ids
      .map((id) => this.evidences.get(id))
      .filter((e): e is EvidenceObject => Boolean(e));
  }

  public validateGraphIntegrity(): {
    isFullyCompliant: boolean;
    orphanClaimsCount: number;
    invalidClaims: string[];
    unsupportedVerifiedClaims: string[];
  } {
    const invalidClaims: string[] = [];
    const unsupportedVerifiedClaims: string[] = [];
    let orphanClaimsCount = 0;

    for (const [claimId, claim] of this.claims.entries()) {
      const validation = validateClaimIntegrity(claim, this.evidences);
      if (!validation.isValid) {
        invalidClaims.push(...validation.violations);
      }

      if (claim.evidence_ids.length === 0 && claim.classification !== "F") {
        orphanClaimsCount++;
      }

      if (claim.status === "verified") {
        const evs = this.getEvidenceForClaim(claimId);
        if (evs.length === 0 || evs.some((e) => e.status !== "verified")) {
          unsupportedVerifiedClaims.push(
            `Claim ${claimId} claims verified status but lacks verified evidence backing.`,
          );
        }
      }
    }

    return {
      isFullyCompliant: invalidClaims.length === 0 && unsupportedVerifiedClaims.length === 0,
      orphanClaimsCount,
      invalidClaims,
      unsupportedVerifiedClaims,
    };
  }

  public exportGraphSummary() {
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      totalClaims: this.claims.size,
      totalEvidences: this.evidences.size,
      nodeTypeBreakdown: Array.from(this.nodes.values()).reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
